import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { buildPrototypeTesterAgreementBundle } from "../../frontend/shared/prototype-tester-agreements.js";
import { setupPrototypeTesterInvitesRoutes } from "./prototype-tester-invites-routes.js";
import {
  buildPrototypeTesterSigningReceiptPdf,
  isPrototypeTesterReceiptSnapshotValid,
  prototypeTesterAgreementDigest,
} from "./prototype-tester-signing-receipt.js";

const receiptId = "88888888-8888-4888-8888-888888888888";
const inviteId = "77777777-7777-4777-8777-777777777777";
const acceptedAt = "2026-09-09T12:00:00.000Z";
const emailVerifiedAt = "2026-09-09T11:59:00.000Z";
const snapshot = {
  schemaVersion: 2,
  acceptedAt,
  signerName: "Test Tester",
  signerEmail: "tester@example.com",
  representedCompany: "Test AS",
  representedCompanyOrganizationNumber: "998989159",
  representedCompanyBusinessAddress: "Styrilia 16, 2080 EIDSVOLL",
  confirmedSigningAuthority: true,
  signatureMethod: "email_otp_typed_name",
  emailVerifiedAt,
  documents: buildPrototypeTesterAgreementBundle({
    testerName: "Test Tester",
    testerEmail: "tester@example.com",
    testerCompany: "Test AS",
  }),
};
const agreementDigest = prototypeTesterAgreementDigest(snapshot);

function appWith(options: {
  query: ReturnType<typeof vi.fn>;
  session?: { userId: string; email: string; name: string; role: string } | null;
  issueSigningCode?: ReturnType<typeof vi.fn>;
}) {
  const app = express();
  app.use(express.json());
  setupPrototypeTesterInvitesRoutes({
    app,
    pool: { query: options.query },
    getPricingUserId: () => options.session?.userId || "",
    requireUserSession: (_req, res) => {
      if (options.session) return options.session;
      res.status(401).json({ error: "auth_required" });
      return null;
    },
    requireAdminSession: () => true,
    issueSigningCode: options.issueSigningCode,
  });
  return app;
}

describe("prototype tester signing code", () => {
  it("always sends to the invited email and never trusts a submitted recipient", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("SELECT id, email, name, status, expires_at")) {
        return {
          rows: [{
            id: inviteId,
            email: "tester@example.com",
            name: "Test Tester",
            status: "pending",
            expires_at: "2099-01-01T00:00:00.000Z",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const issueSigningCode = vi.fn().mockResolvedValue({
      ok: true,
      expiresAt: "2026-09-09T12:10:00.000Z",
    });

    const response = await request(appWith({ query, issueSigningCode }))
      .post("/api/prototype-tester-invites/invite-token/signing-code")
      .send({ email: "attacker@example.net" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      maskedEmail: "te****@example.com",
    });
    expect(response.body).not.toHaveProperty("code");
    expect(issueSigningCode).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: "tester@example.com",
      recipientName: "Test Tester",
      inviteId,
    }));
  });
});

describe("prototype tester signing receipt", () => {
  it("generates a PDF only from a snapshot matching its SHA-256 digest", async () => {
    expect(isPrototypeTesterReceiptSnapshotValid(snapshot, agreementDigest)).toBe(true);
    expect(isPrototypeTesterReceiptSnapshotValid(
      { ...snapshot, signerName: "Endret Navn" },
      agreementDigest,
    )).toBe(false);

    const pdf = await buildPrototypeTesterSigningReceiptPdf({
      receiptId,
      inviteId,
      snapshot,
      agreementDigest,
      signatureMethod: "email_otp_typed_name",
      emailVerifiedAt,
      programEndsAt: "2026-12-02T12:00:00.000Z",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(25_000);
    const pdfSource = pdf.toString("latin1");
    expect(pdfSource).toContain("CreatorHub signeringskvittering");
    expect(pdfSource.match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("rejects a logged-in user who does not own the receipt", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("WHERE signing_receipt_id = $1")) {
        return {
          rows: [{
            id: inviteId,
            email: "tester@example.com",
            provisioned_user_id: "tester-user-id",
            status: "accepted",
            signing_receipt_id: receiptId,
            agreement_digest: agreementDigest,
            accepted_agreements_snapshot: snapshot,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const response = await request(appWith({
      query,
      session: {
        userId: "different-user-id",
        email: "other@example.com",
        name: "Other User",
        role: "user",
      },
    })).get(`/api/prototype-tester-agreements/${receiptId}/receipt.pdf`);

    expect(response.status).toBe(403);
  });

  it("lists only authenticated receipt records with a verified snapshot", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("SELECT id, email, accepted_nda_name")) {
        return {
          rows: [{
            id: inviteId,
            email: "tester@example.com",
            accepted_nda_name: "Test Tester",
            accepted_at: acceptedAt,
            program_ends_at: "2026-12-02T12:00:00.000Z",
            signature_method: "email_otp_typed_name",
            email_verified_at: emailVerifiedAt,
            signing_receipt_id: receiptId,
            agreement_digest: agreementDigest,
            accepted_agreements_snapshot: snapshot,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const response = await request(appWith({
      query,
      session: {
        userId: "tester-user-id",
        email: "tester@example.com",
        name: "Test Tester",
        role: "user",
      },
    })).get("/api/prototype-tester-agreements/me");

    expect(response.status).toBe(200);
    expect(response.body.agreements).toEqual([
      expect.objectContaining({
        id: inviteId,
        receiptId,
        integrityVerified: true,
        signatureMethod: "email_otp_typed_name",
      }),
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("provisioned_user_id::text = $1"),
      ["tester-user-id", "tester@example.com"],
    );
  });

  it("returns a no-store PDF to the receipt owner", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("WHERE signing_receipt_id = $1")) {
        return {
          rows: [{
            id: inviteId,
            email: "tester@example.com",
            provisioned_user_id: "tester-user-id",
            status: "accepted",
            signing_receipt_id: receiptId,
            agreement_digest: agreementDigest,
            accepted_agreements_snapshot: snapshot,
            signature_method: "email_otp_typed_name",
            email_verified_at: emailVerifiedAt,
            program_ends_at: "2026-12-02T12:00:00.000Z",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const response = await request(appWith({
      query,
      session: {
        userId: "tester-user-id",
        email: "tester@example.com",
        name: "Test Tester",
        role: "user",
      },
    })).get(`/api/prototype-tester-agreements/${receiptId}/receipt.pdf`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("allows a super-admin to download the receipt for audit", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("WHERE signing_receipt_id = $1")) {
        return {
          rows: [{
            id: inviteId,
            email: "tester@example.com",
            provisioned_user_id: "tester-user-id",
            status: "accepted",
            signing_receipt_id: receiptId,
            agreement_digest: agreementDigest,
            accepted_agreements_snapshot: snapshot,
            signature_method: "email_otp_typed_name",
            email_verified_at: emailVerifiedAt,
            program_ends_at: "2026-12-02T12:00:00.000Z",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const response = await request(appWith({
      query,
      session: {
        userId: "admin-user-id",
        email: "admin@creatorhubn.com",
        name: "CreatorHub Admin",
        role: "super_admin",
      },
    })).get(`/api/prototype-tester-agreements/${receiptId}/receipt.pdf`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
  });
});
