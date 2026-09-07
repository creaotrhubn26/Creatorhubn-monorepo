import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { setupInviteRequestsRoutes } from "./invite-requests-routes.js";

const { notifyAdminsMock } = vi.hoisted(() => ({
  notifyAdminsMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./admin-notify.js", () => ({
  notifyAdmins: notifyAdminsMock,
}));

const INVITE_COLUMNS = new Set([
  "id",
  "email",
  "first_name",
  "last_name",
  "profession",
  "company_name",
  "organization_number",
  "business_address",
  "phone_number",
  "website",
  "message",
  "status",
  "selected_plan",
  "plan_name",
  "plan_price",
  "user_journey_status",
  "source",
  "enterprise_team_size",
  "enterprise_pricing",
  "created_at",
  "updated_at",
  "processed_by",
]);

const analysis = {
  approvalRecommendation: "approve",
  riskLevel: "low",
  riskScore: 8,
  screeningSource: "brreg",
  summary: "Lav risiko",
};

const baseBody = {
  email: "e2e.prototype@example.com",
  firstName: "E2E",
  lastName: "Prototype",
  profession: "prototype_tester",
  testerProfession: "photographer",
  companyName: "REGISTERENHETEN I BRØNNØYSUND",
  organizationNumber: "974760673",
  message: "Jeg kan teste ukentlig.",
  selectedPlan: "prototype_tester",
  planName: "Prototype Tester",
  source: "prototype_tester_pricing",
};

function buildApp(overrides: Record<string, any> = {}) {
  const app = express() as Express;
  app.use(express.json());
  const query = overrides.query ?? vi.fn().mockResolvedValue({ rows: [] });
  const createInviteFromApprovedRequest =
    overrides.createInviteFromApprovedRequest ??
    vi.fn().mockResolvedValue({
      id: "tester-invite-id",
      token: "tester-token",
      inviteUrl: "https://creatorhubn.com/prototype-tester/accept-invite?token=tester-token",
      reused: false,
      emailDelivery: {
        sent: true,
        provider: "resend",
        reason: null,
        messageId: "email-id",
      },
    });
  const upsertInviteRequestProffScreening =
    overrides.upsertInviteRequestProffScreening ?? vi.fn().mockResolvedValue(undefined);

  setupInviteRequestsRoutes({
    app,
    pool: { query } as unknown as Pool,
    getActiveSessionFromRequest: overrides.getActiveSessionFromRequest ?? (() => ({
      userId: "daniel-admin",
      email: "daniel@creatorhubn.com",
      name: "Daniel",
      role: "super_admin",
      loginAt: new Date().toISOString(),
    })),
    isValidNorwegianOrgNumber: () => true,
    getTableColumns: async () => INVITE_COLUMNS,
    hasTable: overrides.hasTable ?? (async () => false),
    toAdminString: (value) => typeof value === "string" ? value : null,
    lookupInviteRequestBrregCompany: async () => ({
      lookupStatus: "found",
      company: {
        name: "REGISTERENHETEN I BRØNNØYSUND",
        businessAddress: {
          adresse: "Havnegata 48",
          postnummer: "8900",
          poststed: "BRØNNØYSUND",
        },
      },
    }),
    buildInviteRequestProffAnalysis: async () => analysis,
    upsertInviteRequestProffScreening,
    ensureInviteRequestAccessProvisioning:
      overrides.ensureInviteRequestAccessProvisioning ??
      vi.fn().mockResolvedValue({ userId: "applicant-user" }),
    ensureCommunityAccessForApprovedInvite:
      overrides.ensureCommunityAccessForApprovedInvite ??
      vi.fn().mockResolvedValue({ success: true }),
    createInviteFromApprovedRequest,
  });

  return {
    app,
    query,
    createInviteFromApprovedRequest,
    upsertInviteRequestProffScreening,
  };
}

describe("prototype-tester application flow", () => {
  beforeEach(() => {
    notifyAdminsMock.mockClear();
  });

  it("rejects malformed email addresses before database work", async () => {
    const { app, query } = buildApp();
    const response = await request(app)
      .post("/api/invite-requests")
      .set("x-forwarded-for", "198.51.100.1")
      .send({ ...baseBody, email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/gyldig e-postadresse/i);
    expect(query).not.toHaveBeenCalled();
  });

  it("requires the applicant's actual profession", async () => {
    const { app, query } = buildApp();
    const response = await request(app)
      .post("/api/invite-requests")
      .set("x-forwarded-for", "198.51.100.2")
      .send({ ...baseBody, testerProfession: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/profesjon/i);
    expect(query).not.toHaveBeenCalled();
  });

  it("persists the application and waits for the admin email attempt", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: "11111111-1111-4111-8111-111111111111", status: "pending" }],
    });
    const screening = vi.fn().mockRejectedValue(new Error("screening table unavailable"));
    const { app } = buildApp({
      query,
      upsertInviteRequestProffScreening: screening,
    });

    const response = await request(app)
      .post("/api/invite-requests")
      .set("x-forwarded-for", "198.51.100.3")
      .set("referer", "https://creatorhubn.com/landing-desktop")
      .send(baseBody);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      status: "pending",
      proffAnalysis: {
        recommendation: "approve",
        riskLevel: "low",
        riskScore: 8,
        screeningSource: "brreg",
        summary: "Lav risiko",
      },
    });
    expect(screening).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "974760673",
      analysis,
    );
    const insertedValues = query.mock.calls[0][1] as unknown[];
    expect(insertedValues).toContain("[Tester-profesjon: Fotograf]\n\nJeg kan teste ukentlig.");
    expect(notifyAdminsMock).toHaveBeenCalledTimes(1);
    expect(notifyAdminsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "invite_request",
        source: "creatorhubn.com · prototype_tester_pricing",
        relatedId: "11111111-1111-4111-8111-111111111111",
        summary: expect.stringContaining("Proff: approve/low"),
      }),
    );
  });

  it("returns a retryable service error when the database is unavailable", async () => {
    const databaseError = Object.assign(new Error("authentication failed"), { code: "28P01" });
    const { app } = buildApp({ query: vi.fn().mockRejectedValue(databaseError) });

    const response = await request(app)
      .post("/api/invite-requests")
      .set("x-forwarded-for", "198.51.100.4")
      .send(baseBody);

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/midlertidig utilgjengelig/i);
  });

  it("approves from admin, returns delivery status, and forwards the actual profession", async () => {
    const row = {
      id: "22222222-2222-4222-8222-222222222222",
      email: "e2e.prototype@example.com",
      first_name: "E2E",
      last_name: "Prototype",
      profession: "prototype_tester",
      company_name: "REGISTERENHETEN I BRØNNØYSUND",
      organization_number: "974760673",
      message: "[Tester-profesjon: Fotograf]\n\n[Team: 3 medlemmer]",
      selected_plan: "prototype_tester",
      plan_name: "Prototype Tester",
      source: "prototype_tester_pricing",
      status: "approved",
      user_journey_status: "approved",
      created_at: new Date().toISOString(),
    };
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("UPDATE invite_requests")) return { rows: [row], rowCount: 1 };
      if (sql.includes("SELECT * FROM invite_requests")) return { rows: [row], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const { app, createInviteFromApprovedRequest } = buildApp({ query });

    const response = await request(app)
      .post("/api/invite-requests/22222222-2222-4222-8222-222222222222/process")
      .send({ status: "approved" });

    expect(response.status).toBe(200);
    expect(response.body.testerInvite.emailDelivery).toMatchObject({
      sent: true,
      provider: "resend",
    });
    expect(createInviteFromApprovedRequest).toHaveBeenCalledWith(
      expect.anything(),
      row.id,
      row.email,
      "E2E Prototype",
      null,
      [],
      expect.any(String),
      "tester_all_access",
      [],
      3,
      "photographer",
      row.company_name,
    );
  });
});
