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

  it("rejects malformed manual-invite fields before database or email side effects", async () => {
    const query = vi.fn();
    const sendInviteEmail = vi.fn();
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
        email: "tester@example.com",
        name: "Test Tester",
        testingAreas: [{ name: "not-a-string" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Velg minst ett gyldig testområde");
    expect(query).not.toHaveBeenCalled();
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });

  it("requires profession and at least one testing area at the API boundary", async () => {
    const query = vi.fn();
    const sendInviteEmail = vi.fn();
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

    const missingArea = await request(app)
      .post("/api/prototype-tester-invites")
      .send({
        email: "tester@example.com",
        name: "Test Tester",
        profession: "photographer",
        testingAreas: [],
      });
    expect(missingArea.status).toBe(400);
    expect(missingArea.body.error).toContain("minst ett");

    const missingProfession = await request(app)
      .post("/api/prototype-tester-invites")
      .send({
        email: "tester@example.com",
        name: "Test Tester",
        testingAreas: ["CreatorHub-dashboard"],
      });
    expect(missingProfession.status).toBe(400);
    expect(missingProfession.body.error).toContain("profesjon");
    expect(query).not.toHaveBeenCalled();
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });

  it("exposes an admin-protected BRREG company search without forwarding session data", async () => {
    const searchBrregCompanies = vi.fn().mockResolvedValue([
      {
        organizationNumber: "937518684",
        name: "CREATORHUB AS",
        organizationForm: "Aksjeselskap",
        primaryIndustryCode: "62.100",
        primaryIndustryDescription: "Programmeringstjenester",
        businessAddress: {
          adresse: "Søsterveien 11",
          postnummer: "1474",
          poststed: "LØRENSKOG",
        },
        operationalStatus: "active",
      },
    ]);
    const app = express();
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query: vi.fn() },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
      searchBrregCompanies,
    });

    const response = await request(app)
      .get("/api/prototype-tester-invites/brreg/search")
      .query({ q: "Creatorhub" })
      .set("Cookie", "session=must-not-be-forwarded");

    expect(response.status).toBe(200);
    expect(searchBrregCompanies).toHaveBeenCalledWith("Creatorhub");
    expect(response.body).toEqual({
      companies: [
        {
          organizationNumber: "937518684",
          name: "CREATORHUB AS",
          organizationForm: "Aksjeselskap",
          organizationFormCode: null,
          primaryIndustryCode: "62.100",
          primaryIndustryDescription: "Programmeringstjenester",
          recommendedProfession: null,
          professionRecommendation: null,
          suggestedTestingAreas: [
            "CreatorHub-dashboard",
            "Prosjekt og arbeidsflyt",
            "Kontrakt og fakturering",
            "Integrasjoner",
          ],
          businessAddress: "Søsterveien 11, 1474 LØRENSKOG",
          operationalStatus: "active",
        },
      ],
    });
  });

  it("recommends music producer from Estremo's BRREG industry code", async () => {
    const app = express();
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query: vi.fn() },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
      searchBrregCompanies: vi.fn().mockResolvedValue([
        {
          organizationNumber: "998989159",
          name: "ESTREMO RECORDING STUDIOS JENS MICHAEL PETERS NIELSEN",
          organizationForm: "Enkeltpersonforetak",
          organizationFormCode: "ENK",
          primaryIndustryCode: "59.200",
          primaryIndustryDescription:
            "Produksjon og utgivelse av musikk- og lydopptak",
          businessAddress: "Styrilia 16, 2080 EIDSVOLL",
          operationalStatus: "active",
        },
      ]),
    });

    const response = await request(app)
      .get("/api/prototype-tester-invites/brreg/search")
      .query({ q: "Estremo Records" });

    expect(response.status).toBe(200);
    expect(response.body.companies[0]).toMatchObject({
      organizationNumber: "998989159",
      organizationFormCode: "ENK",
      primaryIndustryCode: "59.200",
      recommendedProfession: "music_producer",
      professionRecommendation: {
        profession: "music_producer",
        confidence: "high",
      },
      suggestedTestingAreas: expect.arrayContaining(["Integrasjoner"]),
    });
  });

  it("suggests only the public ENK holder and requires UI confirmation", async () => {
    const lookupBrregContact = vi.fn().mockResolvedValue({
      name: "Jens Michael Peters Nielsen",
      role: "Innehaver",
    });
    const app = express();
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query: vi.fn() },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
      lookupBrregContact,
    });

    const response = await request(app).get(
      "/api/prototype-tester-invites/brreg/998989159/contact",
    );

    expect(response.status).toBe(200);
    expect(response.body.contact).toEqual({
      name: "Jens Michael Peters Nielsen",
      role: "Innehaver",
      source: "BRREG_ROLLER",
      requiresConfirmation: true,
    });
    expect(response.body.contact).not.toHaveProperty("fodselsdato");
  });

  it("previews the exact Email Designer output without database or mail side effects", async () => {
    const query = vi.fn();
    const sendInviteEmail = vi.fn();
    const previewInviteEmail = vi.fn().mockResolvedValue({
      subject: "Du er invitert til CreatorHubs prototypeprogram",
      html: "<html><body>CreatorHub preview</body></html>",
      text: "CreatorHub preview",
      fromLabel: "CreatorHub Norge",
      fromAddress: "hello@creatorhubn.com",
      replyToEmail: "hello@creatorhubn.com",
    });
    const app = express();
    app.use(express.json());
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
      previewInviteEmail,
      sendInviteEmail,
    });

    const response = await request(app)
      .post("/api/prototype-tester-invites/preview")
      .send({
        email: "tester@example.com",
        name: "Test Tester",
        profession: "music_producer",
        testingAreas: ["CreatorHub-dashboard"],
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      recipientEmail: "tester@example.com",
      subject: "Du er invitert til CreatorHubs prototypeprogram",
      agreements: [
        "Programvilkår",
        "NDA",
        "Databehandleravtale",
        "Intensjonsavtale",
      ],
    });
    expect(previewInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: "tester@example.com",
      profession: "music_producer",
      testingAreas: ["CreatorHub-dashboard"],
    }));
    expect(query).not.toHaveBeenCalled();
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });

  it("omits non-active companies from BRREG search results", async () => {
    const app = express();
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query: vi.fn() },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
      searchBrregCompanies: vi.fn().mockResolvedValue([
        {
          organizationNumber: "937518684",
          name: "ACTIVE AS",
          organizationForm: "Aksjeselskap",
          businessAddress: null,
          operationalStatus: "active",
        },
        {
          organizationNumber: "937518684",
          name: "UNDER AVVIKLING AS",
          organizationForm: "Aksjeselskap",
          businessAddress: null,
          operationalStatus: "liquidation",
        },
      ]),
    });

    const response = await request(app)
      .get("/api/prototype-tester-invites/brreg/search")
      .query({ q: "active" });

    expect(response.status).toBe(200);
    expect(response.body.companies).toHaveLength(1);
    expect(response.body.companies[0].name).toBe("ACTIVE AS");
  });

  it("persists only the BRREG-verified legal identity for a direct invite", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("INSERT INTO prototype_tester_invites")) {
        return {
          rows: [{
            id: "verified-invite-id",
            token: "verified-token",
            expires_at: new Date("2027-02-14T12:00:00.000Z"),
            created_at: new Date("2027-01-31T12:00:00.000Z"),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const lookupBrregCompany = vi.fn().mockResolvedValue({
      lookupStatus: "verified",
      company: {
        organizationNumber: "937518684",
        name: "CREATORHUB AS",
        organizationForm: "Aksjeselskap",
        businessAddress: {
          adresse: "Søsterveien 11",
          postnummer: "1474",
          poststed: "LØRENSKOG",
        },
        operationalStatus: "active",
      },
    });
    const sendInviteEmail = vi.fn().mockResolvedValue({
      sent: true,
      provider: "resend",
      reason: null,
      messageId: "verified-email-id",
    });
    const app = express();
    app.use(express.json());
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
      lookupBrregCompany,
      sendInviteEmail,
    });

    const response = await request(app)
      .post("/api/prototype-tester-invites")
      .send({
        email: "tester@example.com",
        name: "Test Tester",
        company: "Forfalsket navn AS",
        organizationNumber: "937 518 684",
        businessAddress: "Forfalsket adresse 1",
        profession: "photographer",
        testingAreas: ["CreatorHub-dashboard"],
      });

    expect(response.status).toBe(201);
    expect(response.body.verifiedCompany).toEqual({
      name: "CREATORHUB AS",
      organizationNumber: "937518684",
      businessAddress: "Søsterveien 11, 1474 LØRENSKOG",
    });
    expect(lookupBrregCompany).toHaveBeenCalledWith("937518684");
    const insertCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO prototype_tester_invites"),
    );
    expect(insertCall?.[1]).toEqual(expect.arrayContaining([
      "CREATORHUB AS",
      "937518684",
      "Søsterveien 11, 1474 LØRENSKOG",
    ]));
    expect(sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ company: "CREATORHUB AS" }),
    );
  });

  it("fails closed before persistence when BRREG cannot verify the company", async () => {
    const query = vi.fn();
    const sendInviteEmail = vi.fn();
    const app = express();
    app.use(express.json());
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
      lookupBrregCompany: vi.fn().mockResolvedValue({
        lookupStatus: "fallback",
        company: null,
      }),
      sendInviteEmail,
    });

    const response = await request(app)
      .post("/api/prototype-tester-invites")
      .send({
        email: "tester@example.com",
        name: "Test Tester",
        profession: "photographer",
        organizationNumber: "937518684",
        testingAreas: ["CreatorHub-dashboard"],
      });

    expect(response.status).toBe(503);
    expect(query).not.toHaveBeenCalled();
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });

  it("rejects a verified company that is not operationally active", async () => {
    const query = vi.fn();
    const sendInviteEmail = vi.fn();
    const app = express();
    app.use(express.json());
    setupPrototypeTesterInvitesRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "",
      requireUserSession: () => true,
      requireAdminSession: async () => ({ userId: "verified-admin-id" }),
      lookupBrregCompany: vi.fn().mockResolvedValue({
        lookupStatus: "verified",
        company: {
          organizationNumber: "937518684",
          name: "UNDER AVVIKLING AS",
          organizationForm: "Aksjeselskap",
          businessAddress: null,
          operationalStatus: "liquidation",
        },
      }),
      sendInviteEmail,
    });

    const response = await request(app)
      .post("/api/prototype-tester-invites")
      .send({
        email: "tester@example.com",
        name: "Test Tester",
        profession: "photographer",
        organizationNumber: "937518684",
        testingAreas: ["CreatorHub-dashboard"],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("ikke aktiv");
    expect(query).not.toHaveBeenCalled();
    expect(sendInviteEmail).not.toHaveBeenCalled();
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
              signature_method: "email_otp_typed_name",
              email_verified_at: new Date("2027-01-31T12:29:00.000Z"),
              signing_receipt_id: "88888888-8888-4888-8888-888888888888",
              receipt_email_sent_at: new Date("2027-01-31T12:31:00.000Z"),
              receipt_email_provider: "resend",
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
      signatureMethod: "email_otp_typed_name",
      emailVerifiedAt: "2027-01-31T12:29:00.000Z",
      signingReceiptId: "88888888-8888-4888-8888-888888888888",
      receiptEmailDelivery: { sent: true, provider: "resend" },
      inviteUrl: expect.stringContaining("/prototype-tester/accept-invite?token="),
    });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("s.plan_id = 'solo_pro'"),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("r.id::text = p.invite_request_id::text"),
      ),
    ).toBe(true);
  });

  it("retries a failed delivery on the same invitation without creating a new row", async () => {
    const inviteId = "77777777-7777-4777-8777-777777777777";
    const inviteRow = {
      id: inviteId,
      token: "same-invite-token",
      email: "retry.tester@example.com",
      name: "Retry Tester",
      status: "pending",
      expires_at: "2099-01-01T00:00:00.000Z",
      member_profession: "photographer",
      member_company: "Retry AS",
      testing_areas: ["CreatorHub-dashboard"],
      personal_message: null,
      email_sent_at: null,
      email_last_attempt_at: null,
      program_duration_weeks: 12,
    };
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("WHERE p.id = $1")) return { rows: [inviteRow], rowCount: 1 };
      if (sql.includes("email_delivery_attempt_count") && sql.includes("RETURNING *")) {
        return { rows: [inviteRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const sendInviteEmail = vi.fn().mockResolvedValue({
      sent: true,
      provider: "resend",
      reason: null,
      messageId: "retry-message-id",
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
      .post(`/api/prototype-tester-invites/${inviteId}/retry`)
      .send({ step: "invite_email" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, inviteId, step: "invite_email" });
    expect(sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      inviteId,
      inviteUrl: expect.stringContaining("same-invite-token"),
    }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO prototype_tester_invites"))).toBe(false);
  });

  it("does not consume a retry attempt when the requested step is already complete", async () => {
    const inviteId = "77777777-7777-4777-8777-777777777777";
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("WHERE p.id = $1")) {
        return {
          rows: [{
            id: inviteId,
            status: "pending",
            email_sent_at: "2026-09-10T10:00:00.000Z",
            expires_at: "2099-01-01T00:00:00.000Z",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const sendInviteEmail = vi.fn();
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
      .post(`/api/prototype-tester-invites/${inviteId}/retry`)
      .send({ step: "invite_email" });

    expect(response.status).toBe(409);
    expect(sendInviteEmail).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) =>
      String(sql).includes("email_delivery_attempt_count") &&
      String(sql).includes("RETURNING *"),
    )).toBe(false);
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
      null,
      null,
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
      signing_receipt_id: "66666666-6666-4666-8666-666666666666",
      agreement_digest: "a".repeat(64),
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
    const sendReceiptEmail = vi.fn().mockResolvedValue({
      sent: true,
      provider: "resend",
      reason: null,
      messageId: "receipt-email-id",
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
      sendReceiptEmail,
      verifySigningCode: vi.fn().mockResolvedValue({
        ok: true,
        verifiedAt: "2026-09-09T12:00:00.000Z",
      }),
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
        verificationCode: "123456",
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
      receiptEmailDelivery: {
        sent: true,
        provider: "resend",
        messageId: "receipt-email-id",
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
    expect(sendReceiptEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: acceptedRow.email,
      recipientName: "Activated Tester",
      receiptId: acceptedRow.signing_receipt_id,
      agreementsUrl: "https://creatorhubn.com/login?redirect=%2Fmine-avtaler",
      inviteId: acceptedRow.id,
    }));
  });
});
