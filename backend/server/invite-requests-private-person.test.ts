/**
 * Prototype-testere som er privatpersoner.
 *
 * invite_requests krevde firmanavn og et org.nr som slår opp i Brønnøysund.
 * En tester uten firma — skuespiller, frilanser, student — kunne dermed ikke
 * sende søknad i det hele tatt. Testene her holder på at kravet er fjernet
 * KUN for tester-søknader merket applicantType='private', og står urørt for
 * alle andre.
 */

import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupInviteRequestsRoutes } from "./invite-requests-routes.js";

vi.mock("./admin-notify", () => ({
  notifyAdmins: vi.fn(async () => undefined),
}));

const INVITE_COLUMNS = new Set([
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
  "tester_profession",
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
]);

interface Recorded {
  insertColumns: string[];
  insertValues: unknown[];
  brregLookups: string[];
  proffRuns: number;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const recorded: Recorded = { insertColumns: [], insertValues: [], brregLookups: [], proffRuns: 0 };

  const pool = {
    query: async (sql: string, values?: unknown[]) => {
      if (sql.includes("INSERT INTO invite_requests")) {
        const columns = sql.slice(sql.indexOf("(") + 1, sql.indexOf(")")).split(",").map((c) => c.trim());
        recorded.insertColumns = columns;
        recorded.insertValues = values ?? [];
        return { rows: [{ id: "req-1", email: "tester@privat.test", status: "pending" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  setupInviteRequestsRoutes({
    app,
    pool,
    getActiveSessionFromRequest: () => null,
    isValidNorwegianOrgNumber: (value: string) => /^\d{9}$/.test(value),
    getTableColumns: async () => INVITE_COLUMNS,
    hasTable: async () => true,
    toAdminString: (value: unknown) => (typeof value === "string" ? value : null),
    lookupInviteRequestBrregCompany: async (organizationNumber: string) => {
      recorded.brregLookups.push(organizationNumber);
      return { lookupStatus: "found", company: { name: "Ekte AS", businessAddress: null } };
    },
    buildInviteRequestProffAnalysis: async () => {
      recorded.proffRuns += 1;
      return {
        approvalRecommendation: "approve",
        riskLevel: "low",
        riskScore: 10,
        screeningSource: "proff",
        summary: "ok",
        scannedAt: new Date().toISOString(),
        brregVerified: true,
        screeningStatus: "done",
      };
    },
    upsertInviteRequestProffScreening: async () => undefined,
    ensureInviteRequestAccessProvisioning: async () => null,
    ensureCommunityAccessForApprovedInvite: async () => null,
    createInviteFromApprovedRequest: async () => null,
  } as never);

  return { app, recorded };
}

function columnValue(recorded: Recorded, column: string): unknown {
  const index = recorded.insertColumns.indexOf(column);
  return index === -1 ? undefined : recorded.insertValues[index];
}

describe("privatperson som prototype-tester", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("slipper gjennom uten firmanavn og org.nr", async () => {
    const { app, recorded } = buildApp();
    const res = await request(app).post("/api/invite-requests").send({
      email: "tester@privat.test",
      firstName: "Kari",
      lastName: "Nordmann",
      profession: "prototype_tester",
      testerProfession: "photographer",
      applicantType: "private",
    });

    expect(res.status).toBe(201);
    expect(columnValue(recorded, "company_name")).toBeNull();
    expect(columnValue(recorded, "organization_number")).toBeNull();
  });

  it("hopper over Brreg-oppslag og Proff-screening for privatpersoner", async () => {
    const { app, recorded } = buildApp();
    await request(app).post("/api/invite-requests").send({
      email: "tester@privat.test",
      firstName: "Kari",
      lastName: "Nordmann",
      profession: "prototype_tester",
      testerProfession: "photographer",
      applicantType: "private",
    });

    expect(recorded.brregLookups).toHaveLength(0);
    expect(recorded.proffRuns).toBe(0);
  });

  it("krever fortsatt tester-profesjon", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/api/invite-requests").send({
      email: "tester@privat.test",
      firstName: "Kari",
      lastName: "Nordmann",
      profession: "prototype_tester",
      applicantType: "private",
    });

    expect(res.status).toBe(400);
  });

  it("gjelder ikke vanlige søknader — org.nr er fortsatt påkrevd", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/api/invite-requests").send({
      email: "firma@bedrift.test",
      firstName: "Ola",
      lastName: "Nordmann",
      profession: "photographer",
      applicantType: "private",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Alle obligatoriske felt må fylles ut");
  });

  it("beholder Brreg og screening for en tester som søker for et firma", async () => {
    const { app, recorded } = buildApp();
    const res = await request(app).post("/api/invite-requests").send({
      email: "tester@firma.test",
      firstName: "Per",
      lastName: "Hansen",
      profession: "prototype_tester",
      testerProfession: "photographer",
      companyName: "Ekte AS",
      organizationNumber: "123456789",
    });

    expect(res.status).toBe(201);
    expect(recorded.brregLookups).toEqual(["123456789"]);
    expect(recorded.proffRuns).toBe(1);
    expect(columnValue(recorded, "organization_number")).toBe("123456789");
  });
});
