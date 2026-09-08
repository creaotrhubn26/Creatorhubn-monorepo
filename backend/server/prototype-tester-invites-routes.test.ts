import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInviteFromApprovedRequest,
  setupPrototypeTesterInvitesRoutes,
} from "./prototype-tester-invites-routes.js";

const { sendTransactionalEmailMock, emailConfiguredMock } = vi.hoisted(() => ({
  sendTransactionalEmailMock: vi.fn(),
  emailConfiguredMock: vi.fn(() => true),
}));

vi.mock("./transactional-email-service.ts", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
  isTransactionalEmailConfigured: emailConfiguredMock,
}));

describe("prototype tester invitation delivery", () => {
  beforeEach(() => {
    sendTransactionalEmailMock.mockReset();
    sendTransactionalEmailMock.mockResolvedValue({
      sent: true,
      provider: "resend",
      reason: null,
      messageId: "resend-message-id",
      accepted: ["tester@example.com"],
      errorMessage: null,
    });
  });

  it("awaits the persisted admin-session guard before creating a manual invite", async () => {
    const query = vi.fn();
    const app = express();
    app.use(express.json());
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async (_req, res) => {
        res.status(401).json({ error: "Admin-innlogging kreves" });
        return null;
      },
    });

    const response = await request(app)
      .post("/api/prototype-tester-invites")
      .send({ email: "tester@example.com", name: "Test Tester" });

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("sends a manual admin invite through the CreatorHub Email Designer sender", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("INSERT INTO prototype_tester_invites")) {
        return {
          rows: [
            {
              id: "manual-invite-id",
              token: "manual-invite-token",
              expires_at: new Date("2027-02-14T12:00:00.000Z"),
              created_at: new Date("2027-01-31T12:00:00.000Z"),
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const sendInviteEmail = vi.fn().mockResolvedValue({
      sent: true,
      provider: "resend",
      reason: null,
      messageId: "manual-email-id",
    });
    const app = express();
    app.use(express.json());
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
      sendInviteEmail,
    });

    const response = await request(app)
      .post("/api/prototype-tester-invites")
      .send({
        email: "manual.tester@example.com",
        name: "Manual Tester",
        profession: "photographer",
        company: "Manual AS",
        testingAreas: ["Story Arc Studio"],
        personalMessage: "Vi vil gjerne ha deg med.",
        invitedBy: "spoofed-admin-id",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: "manual-invite-id",
      emailDelivery: {
        sent: true,
        provider: "resend",
        messageId: "manual-email-id",
      },
    });
    expect(sendInviteEmail).toHaveBeenCalledWith({
      recipientEmail: "manual.tester@example.com",
      recipientName: "Manual Tester",
      inviteUrl: expect.stringContaining("/prototype-tester/accept-invite?token="),
      ctaUrl: expect.stringContaining("/api/prototype-tester-invites/track/click/"),
      trackingPixelUrl: expect.stringContaining("/api/prototype-tester-invites/track/open/"),
      inviteId: "manual-invite-id",
      sentByUserId: "verified-admin-id",
      profession: "photographer",
      company: "Manual AS",
      testingAreas: ["Story Arc Studio"],
      personalMessage: "Vi vil gjerne ha deg med.",
      programDurationWeeks: 12,
      inviteExpiresDays: 14,
    });
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("SET email_sent_at = CASE"),
      ),
    ).toBe(true);

    const openResponse = await request(app).get(
      "/api/prototype-tester-invites/track/open/manual-invite-token",
    );
    expect(openResponse.status).toBe(200);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("SET email_opened_at = COALESCE(email_opened_at, NOW())"),
      ),
    ).toBe(true);
  });

  it("returns a protected admin funnel with legal and solo_pro status", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("FROM prototype_tester_invites p")) {
        return {
          rows: [
            {
              id: "listed-invite-id",
              token: "listed-invite-token",
              email: "listed.tester@example.com",
              name: "Listed Tester",
              testing_areas: ["Story Arc Studio"],
              status: "accepted",
              nda_version: "1.1",
              program_terms_version: "1.0",
              dpa_version: "1.0",
              letter_of_intent_version: "1.0",
              accepted_at: new Date("2027-01-31T12:30:00.000Z"),
              provisioned_user_id: "listed-user-id",
              email_sent_at: new Date("2027-01-31T12:00:00.000Z"),
              email_opened_at: new Date("2027-01-31T12:10:00.000Z"),
              invite_link_clicked_at: new Date("2027-01-31T12:20:00.000Z"),
              solo_pro_active: true,
              created_at: new Date("2027-01-31T11:59:00.000Z"),
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const app = express();
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
    });

    const response = await request(app).get("/api/prototype-tester-invites");

    expect(response.status).toBe(200);
    expect(response.body.invites[0]).toMatchObject({
      id: "listed-invite-id",
      status: "accepted",
      accountProvisioningComplete: true,
      soloProActive: true,
      emailDelivery: { sent: true },
      emailOpenedAt: "2027-01-31T12:10:00.000Z",
      inviteLinkClickedAt: "2027-01-31T12:20:00.000Z",
      inviteUrl: expect.stringContaining("/prototype-tester/accept-invite?token="),
    });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("s.plan_id = 'solo_pro'"),
      ),
    ).toBe(true);
  });

  it("sends approval invitations through the centralized provider and records the journey", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("SELECT id, token FROM prototype_tester_invites")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO prototype_tester_invites")) {
        return {
          rows: [{ id: "invite-id", token: "generated-token" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const pool = { query };

    const result = await createInviteFromApprovedRequest(
      pool,
      "11111111-1111-4111-8111-111111111111",
      "tester@example.com",
      "Test Tester",
      "daniel-admin",
      [],
      "https://creatorhubn.com",
      "tester_all_access",
      [],
      1,
      "photographer",
      "Testbedriften AS",
    );

    expect(result).toMatchObject({
      id: "invite-id",
      reused: false,
      emailDelivery: {
        sent: true,
        provider: "resend",
        messageId: "resend-message-id",
      },
    });
    expect(sendTransactionalEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tester@example.com",
        replyTo: "daniel@creatorhubn.com",
        fromLabel: "CreatorHub",
        kind: "prototype_tester_invite",
        projectId: "11111111-1111-4111-8111-111111111111",
        sentByUserId: "daniel-admin",
      }),
    );
    const emailOptions = sendTransactionalEmailMock.mock.calls[0][0];
    expect(emailOptions.html).toContain("/track/click/");
    expect(emailOptions.text).toContain("/prototype-tester/accept-invite?token=");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("user_journey_status = 'invite_sent'"))).toBe(true);
  });

  it("does not resend an already active invitation", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("SELECT id, token FROM prototype_tester_invites")) {
        return {
          rows: [{ id: "existing-id", token: "existing-token" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const result = await createInviteFromApprovedRequest(
      { query },
      "11111111-1111-4111-8111-111111111111",
      "tester@example.com",
      "Test Tester",
      null,
      [],
      "https://creatorhubn.com",
    );

    expect(result).toMatchObject({
      id: "existing-id",
      reused: true,
      emailDelivery: null,
    });
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("uses the injected CreatorHub template sender for approved applications", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("SELECT id, token FROM prototype_tester_invites")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO prototype_tester_invites")) {
        return {
          rows: [{ id: "template-invite-id", token: "template-token" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const sendApprovalEmail = vi.fn().mockResolvedValue({
      sent: true,
      provider: "resend",
      reason: null,
      messageId: "template-email-id",
    });

    const result = await createInviteFromApprovedRequest(
      { query },
      "44444444-4444-4444-8444-444444444444",
      "template.tester@example.com",
      "Template Tester",
      "daniel-admin",
      [],
      "https://creatorhubn.com",
      "tester_all_access",
      [],
      1,
      "photographer",
      "Template AS",
      sendApprovalEmail,
    );

    expect(result?.emailDelivery).toMatchObject({
      sent: true,
      provider: "resend",
      messageId: "template-email-id",
    });
    expect(sendApprovalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "template.tester@example.com",
        recipientName: "Template Tester",
        inviteRequestId: "44444444-4444-4444-8444-444444444444",
        profession: "photographer",
        company: "Template AS",
        programDurationWeeks: 12,
        inviteExpiresDays: 14,
        ctaUrl: expect.stringContaining("/track/click/"),
        trackingPixelUrl: expect.stringContaining("/track/open/"),
      }),
    );
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("sends access-activated email after NDA acceptance and account provisioning", async () => {
    const programEndsAt = new Date("2027-01-31T12:00:00.000Z");
    const acceptedRow = {
      id: "activated-invite-id",
      invite_request_id: "55555555-5555-4555-8555-555555555555",
      token: "accept-token",
      email: "activated.tester@example.com",
      name: "Activated Tester",
      status: "accepted",
      expires_at: new Date("2027-02-01T12:00:00.000Z"),
      program_started_at: new Date("2026-11-01T12:00:00.000Z"),
      program_ends_at: programEndsAt,
      member_profession: "videographer",
      member_company: "Activated AS",
      testing_areas: [],
      granted_features: [],
    };
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("SELECT * FROM prototype_tester_invites WHERE token")) {
        return {
          rows: [{
            ...acceptedRow,
            status: "pending",
            expires_at: new Date("2099-01-01T00:00:00.000Z"),
            nda_version: "1.1",
            program_terms_version: "1.0",
            dpa_version: "1.0",
            letter_of_intent_version: "1.0",
            master_invite_id: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("RETURNING *")) {
        return { rows: [acceptedRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const sendAccessActivatedEmail = vi.fn().mockResolvedValue({
      sent: true,
      provider: "resend",
      reason: null,
      messageId: "activated-email-id",
    });
    const app = express();
    app.use(express.json());
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: () => true,
      provisionTesterAccount: vi.fn().mockResolvedValue({ id: "tester-user-id" }),
      sendAccessActivatedEmail,
    });

    const response = await request(app)
      .post("/api/prototype-tester-invites/accept-token/accept")
      .send({
        ndaName: "Activated Tester",
        acceptedProgramTerms: true,
        programTermsVersion: "1.0",
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
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      accountCreated: true,
      accessActivatedEmailDelivery: {
        sent: true,
        provider: "resend",
        messageId: "activated-email-id",
      },
    });
    expect(sendAccessActivatedEmail).toHaveBeenCalledWith({
      recipientEmail: acceptedRow.email,
      recipientName: "Activated Tester",
      loginUrl: "https://creatorhubn.com/login?redirect=%2Fvideographer-dashboard-material",
      inviteRequestId: acceptedRow.invite_request_id,
      inviteId: acceptedRow.id,
      profession: acceptedRow.member_profession,
      company: acceptedRow.member_company,
      programEndsAt,
    });
  });
});
