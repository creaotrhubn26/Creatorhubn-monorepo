import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupPrototypeTesterInvitesRoutes } from "./prototype-tester-invites-routes.js";

const acceptedAgreements = {
  program_terms: true,
  nda: true,
  dpa: true,
  letter_of_intent: true,
};

const agreementVersions = {
  program_terms: "1.0",
  nda: "1.1",
  dpa: "1.0",
  letter_of_intent: "1.0",
};

function buildApp(
  query: ReturnType<typeof vi.fn>,
  verifySigningCode = vi.fn().mockResolvedValue({
    ok: true,
    verifiedAt: "2026-09-09T12:00:00.000Z",
  }),
) {
  const app = express();
  app.use(express.json());
  setupPrototypeTesterInvitesRoutes({
    app,
    pool: { query },
    getPricingUserId: () => "",
    requireUserSession: () => true,
    requireAdminSession: () => true,
    verifySigningCode,
  });
  return app;
}

describe("prototype tester agreement acceptance validation", () => {
  it("rejects an oversized legal signature before database side effects", async () => {
    const query = vi.fn();
    const response = await request(buildApp(query))
      .post("/api/prototype-tester-invites/token/accept")
      .send({
        ndaName: "A".repeat(201),
        acceptedProgramTerms: true,
        acceptedAgreements,
        agreementVersions,
        confirmedSigningAuthority: true,
        verificationCode: "123456",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("200 tegn");
    expect(query).not.toHaveBeenCalled();
  });

  it("refuses activation until every document and signing authority are accepted", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const response = await request(buildApp(query))
      .post("/api/prototype-tester-invites/token/accept")
      .send({
        ndaName: "Test Tester",
        acceptedProgramTerms: true,
        acceptedAgreements: { program_terms: true, nda: true },
        agreementVersions,
        confirmedSigningAuthority: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.missingAgreements).toEqual([
      "dpa",
      "letter_of_intent",
    ]);
    expect(response.body.signingAuthorityRequired).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("SET status = 'accepted'"),
      ),
    ).toBe(false);
  });

  it("refuses a stale document version before writing acceptance evidence", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("SELECT * FROM prototype_tester_invites WHERE token")) {
        return {
          rows: [
            {
              id: "invite-id",
              token: "token",
              name: "Test Tester",
              email: "tester@example.com",
              status: "pending",
              expires_at: "2099-01-01T00:00:00.000Z",
              program_terms_version: "1.0",
              nda_version: "1.1",
              dpa_version: "1.0",
              letter_of_intent_version: "1.0",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const response = await request(buildApp(query))
      .post("/api/prototype-tester-invites/token/accept")
      .send({
        ndaName: "Test Tester",
        acceptedProgramTerms: true,
        acceptedAgreements,
        agreementVersions: { ...agreementVersions, dpa: "0.9" },
        confirmedSigningAuthority: true,
        verificationCode: "123456",
      });

    expect(response.status).toBe(409);
    expect(response.body.mismatchedVersions).toEqual(["dpa"]);
    expect(
      query.mock.calls.some(([sql]) => {
        const statement = String(sql);
        return (
          statement.includes("SET status = 'accepted'") &&
          statement.includes("agreement_digest")
        );
      }),
    ).toBe(false);
  });

  it("does not write acceptance evidence when the e-mail code is wrong", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("SELECT * FROM prototype_tester_invites WHERE token")) {
        return {
          rows: [{
            id: "invite-id",
            token: "token",
            name: "Test Tester",
            email: "tester@example.com",
            status: "pending",
            expires_at: "2099-01-01T00:00:00.000Z",
            program_terms_version: "1.0",
            nda_version: "1.1",
            dpa_version: "1.0",
            letter_of_intent_version: "1.0",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const verifySigningCode = vi.fn().mockResolvedValue({
      ok: false,
      reason: "wrong_code",
      attemptsRemaining: 3,
    });
    const response = await request(buildApp(query, verifySigningCode))
      .post("/api/prototype-tester-invites/token/accept")
      .send({
        ndaName: "Test Tester",
        acceptedProgramTerms: true,
        acceptedAgreements,
        agreementVersions,
        confirmedSigningAuthority: true,
        verificationCode: "000000",
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      reason: "wrong_code",
      attemptsRemaining: 3,
    });
    expect(verifySigningCode).toHaveBeenCalledWith({
      recipientEmail: "tester@example.com",
      code: "000000",
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'accepted'"))).toBe(false);
  });
});
