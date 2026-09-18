import express from "express";
import type { Pool, PoolClient } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";


import { registerLeadgridLeadCreationRoutes } from "./leadgrid-lead-creation-routes.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const CREATION_ID = "33333333-3333-4333-8333-333333333333";
const LEAD_ID = "44444444-4444-4444-8444-444444444444";

type QueryResult = { rows: unknown[]; rowCount?: number };

function testApp(
  clientHandler: (sql: string, params: unknown[]) => Promise<QueryResult>,
) {
  const poolQuery = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("SELECT role FROM organization_members")) {
      return { rows: [{ role: "admin" }], rowCount: 1 };
    }
    if (sql.includes("SELECT key FROM permissions")) {
      return { rows: [{ key: "leads.create" }], rowCount: 1 };
    }
    throw new Error("Unexpected pool SQL: " + sql);
  });
  const clientQuery = vi.fn(async (sqlValue: unknown, paramsValue?: unknown[]) => {
    const sql = String(sqlValue);
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
    if (sql.includes("INSERT INTO background_jobs")) {
      return { rows: [{ id: "job-id" }], rowCount: 1 };
    }
    return clientHandler(sql, paramsValue ?? []);
  });
  const release = vi.fn();
  const client = { query: clientQuery, release } as unknown as PoolClient;
  const pool = {
    query: poolQuery,
    connect: vi.fn(async () => client),
  } as unknown as Pool;
  const app = express();
  app.use(express.json());
  registerLeadgridLeadCreationRoutes({
    app,
    pool,
    activeSessions: new Map([["session-token", { userId: USER_ID }]]),
  });
  return { app, clientQuery, release };
}

function payload(extra: Record<string, unknown> = {}) {
  return {
    creation_id: CREATION_ID,
    organization_id: ORG_ID,
    name: "Nordic Elektro AS",
    contact_name: "Ada Nordmann",
    contact_role: "Daglig leder",
    email: "ada@nordicelektro.no",
    phone: "+47 999 88 777",
    address: "Storgata 1",
    postal_code: "0155",
    city: "Oslo",
    country: "NO",
    industry: "Elektro",
    employee_count_estimate: 38,
    annual_revenue_nok_estimate: 15_000_000,
    notes: "Ring tirsdag",
    lead_temperature: "hot",
    pipeline_stage: "qualified",
    lead_status: "interested",
    location_confidence: "geocoded",
    lead_source: "company_lookup",
    project_id: "leadgrid-project-2026",
    ...extra,
  };
}

describe("Leadgrid canonical lead creation routes", () => {
  it("returns 201 and persists the authorized tenant plus the full draft", async () => {
    let insertParams: unknown[] | null = null;
    const { app, release } = testApp(async (sql, params) => {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("creation_idempotency_key") && sql.includes("SELECT")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM crm_customers") && sql.includes("archived_at IS NULL")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM casting_projects")) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO crm_customers")) {
        insertParams = params;
        return { rows: [{ id: LEAD_ID }], rowCount: 1 };
      }
      throw new Error("Unexpected client SQL: " + sql);
    });

    const response = await request(app)
      .post("/api/admin-room/lead-map/leads")
      .set("Authorization", "Bearer session-token")
      .send(payload())
      .expect(201);

    expect(response.body).toMatchObject({
      ok: true,
      id: LEAD_ID,
      created: true,
      replayed: false,
      duplicates_checked: 0,
    });
    expect(insertParams).not.toBeNull();
    expect(insertParams![2]).toBe("Ada Nordmann");
    expect(insertParams![3]).toBe("Daglig leder");
    expect(insertParams![31]).toBe("leadgrid-project-2026");
    expect(insertParams![19]).toBe(38);
    expect(insertParams![20]).toBe(15_000_000);
    expect(insertParams![29]).toBe(USER_ID);
    expect(insertParams![30]).toBe(ORG_ID);
    expect(insertParams![32]).toBe(CREATION_ID);
    expect(release).toHaveBeenCalledOnce();
  });

  it("returns structured 409 candidates and rolls back instead of inserting", async () => {
    let inserted = false;
    const { app, clientQuery } = testApp(async (sql) => {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("creation_idempotency_key") && sql.includes("SELECT")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM crm_customers") && sql.includes("archived_at IS NULL")) {
        return {
          rows: [{
            id: LEAD_ID,
            name: "Nordic Elektro AS",
            company: "Nordic Elektro AS",
            email: null,
            phone: null,
            website_url: null,
            website_domain_normalized: null,
            address: "Storgata 1",
            city: "Oslo",
            enrichment_org_nr: "937518684",
            google_place_id: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO crm_customers")) {
        inserted = true;
        return { rows: [{ id: "should-not-exist" }], rowCount: 1 };
      }
      throw new Error("Unexpected client SQL: " + sql);
    });

    const response = await request(app)
      .post("/api/admin-room/lead-map/leads")
      .set("Authorization", "Bearer session-token")
      .send(payload({
        organization_number: "937 518 684",
        email: null,
        phone: null,
      }))
      .expect(409);

    expect(response.body.error).toBe("duplicate_conflict");
    expect(response.body.candidates).toEqual([expect.objectContaining({
      id: LEAD_ID,
      name: "Nordic Elektro AS",
      match_reasons: expect.arrayContaining(["organization_number", "name_city"]),
    })]);
    expect(inserted).toBe(false);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql) === "ROLLBACK")).toBe(true);
  });

  it("rejects unknown fields and unauthenticated creation before persistence", async () => {
    const { app, clientQuery } = testApp(async () => {
      throw new Error("transaction should not start");
    });

    await request(app)
      .post("/api/admin-room/lead-map/leads")
      .send(payload())
      .expect(401);

    const invalid = await request(app)
      .post("/api/admin-room/lead-map/leads")
      .set("Authorization", "Bearer session-token")
      .send(payload({ owner_user_id: "attacker-controlled" }))
      .expect(400);

    expect(invalid.body.error).toBe("validation_failed");
    expect(clientQuery).not.toHaveBeenCalled();
  });
});
