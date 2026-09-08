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

function buildApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  setupPrototypeTesterInvitesRoutes({
    app,
    pool: { query },
    getPricingUserId: () => "",
    requireUserSession: () => true,
    requireAdminSession: () => true,
  });
  return app;
}

describe("prototype tester agreement acceptance validation", () => {
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
      });

    expect(response.status).toBe(409);
    expect(response.body.mismatchedVersions).toEqual(["dpa"]);
    expect(
      query.mock.calls.some(([sql]) => {
        const statement = String(sql);
        return (
          statement.includes("UPDATE prototype_tester_invites") &&
          statement.includes("agreement_digest")
        );
      }),
    ).toBe(false);
  });
});
