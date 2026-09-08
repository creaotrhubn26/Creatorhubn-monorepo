import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupPrototypeTesterInvitesRoutes } from "./prototype-tester-invites-routes.js";

const acceptanceBody = {
  ndaName: "Retry Tester",
  acceptedProgramTerms: true,
  acceptedAgreements: {
    program_terms: true,
    nda: true,
    dpa: true,
    letter_of_intent: true,
  },
  agreementVersions: {
    program_terms: "1.0",
    nda: "1.1",
    dpa: "1.0",
    letter_of_intent: "1.0",
  },
  confirmedSigningAuthority: true,
};

describe("prototype tester account activation recovery", () => {
  it("keeps acceptance evidence and retries only account provisioning", async () => {
    let persistedRow: Record<string, unknown> = {
      id: "retry-invite-id",
      invite_request_id: "77777777-7777-4777-8777-777777777777",
      token: "retry-token",
      email: "retry.tester@example.com",
      name: "Retry Tester",
      status: "pending",
      expires_at: "2099-01-01T00:00:00.000Z",
      nda_version: "1.1",
      program_terms_version: "1.0",
      dpa_version: "1.0",
      letter_of_intent_version: "1.0",
      master_invite_id: null,
      member_profession: "photographer",
      member_company: "Retry AS",
      testing_areas: [],
      granted_features: [],
    };

    const query = vi
      .fn()
      .mockImplementation(
        async (statement: unknown, params: unknown[] = []) => {
          const sql = String(statement);
          if (
            sql.includes("SELECT * FROM prototype_tester_invites WHERE token")
          ) {
            return { rows: [persistedRow], rowCount: 1 };
          }
          if (sql.includes("SET status = 'accepted'")) {
            persistedRow = {
              ...persistedRow,
              status: "accepted",
              accepted_nda_name: params[0],
              accepted_at: params[1],
              accepted_program_terms: true,
              accepted_dpa: true,
              accepted_letter_of_intent: true,
              confirmed_signing_authority: true,
              accepted_agreements_snapshot: JSON.parse(String(params[4])),
              agreement_digest: params[5],
              program_started_at: params[6],
              program_ends_at: params[7],
            };
            return { rows: [persistedRow], rowCount: 1 };
          }
          if (sql.includes("SET provisioned_user_id")) {
            persistedRow = {
              ...persistedRow,
              provisioned_user_id: params[0],
              provisioned_at: "2026-09-07T22:00:00.000Z",
            };
            return { rows: [persistedRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
      );
    const provisionTesterAccount = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary database failure"))
      .mockResolvedValueOnce({ id: "retry-user-id" });
    const sendAccessActivatedEmail = vi.fn().mockResolvedValue({
      sent: true,
      provider: "resend",
      reason: null,
      messageId: "retry-activation-email-id",
    });
    const app = express();
    app.use(express.json());
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: () => true,
      provisionTesterAccount,
      sendAccessActivatedEmail,
    });

    const firstAttempt = await request(app)
      .post("/api/prototype-tester-invites/retry-token/accept")
      .send(acceptanceBody);

    expect(firstAttempt.status).toBe(503);
    expect(firstAttempt.body).toMatchObject({
      agreementsAccepted: true,
      accountCreated: false,
      retryable: true,
    });
    const originalDigest = persistedRow.agreement_digest;
    const originalAcceptedAt = persistedRow.accepted_at;

    const retry = await request(app)
      .post("/api/prototype-tester-invites/retry-token/accept")
      .send(acceptanceBody);

    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ success: true, accountCreated: true });
    expect(retry.body.invite.accountProvisioningComplete).toBe(true);
    expect(persistedRow.agreement_digest).toBe(originalDigest);
    expect(persistedRow.accepted_at).toBe(originalAcceptedAt);
    expect(provisionTesterAccount).toHaveBeenCalledTimes(2);
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes("SET status = 'accepted'"),
      ),
    ).toHaveLength(1);
    expect(sendAccessActivatedEmail).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "registered_user_id = COALESCE(registered_user_id, $2)",
      ),
      [expect.any(String), "retry-user-id", persistedRow.invite_request_id],
    );
  });
});
