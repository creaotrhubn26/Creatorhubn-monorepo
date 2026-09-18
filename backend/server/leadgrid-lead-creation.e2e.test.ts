import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";

import express from "express";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clearJobHandlers, processNextJob } from "./job-queue.js";
import { registerCoreJobHandlers } from "./job-handlers.js";
import { setupLeadMapRoutes } from "./lead-map-routes.js";
import { registerRoutesAdherenceRoutes } from "./routes-adherence-routes.js";

const DATABASE_URL = process.env.LEADGRID_E2E_DATABASE_URL;
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "e2e-user";
const TOKEN = "e2e-token";
const CREATION_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_CREATION_ID = "44444444-4444-4444-8444-444444444444";

describe.skipIf(!DATABASE_URL)("Leadgrid lead creation HTTP/PostgreSQL E2E", () => {
  let pool: Pool;
  let server: ReturnType<express.Express["listen"]>;
  let baseUrl: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await pool.query(`
      CREATE TABLE organization_members (
        organization_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE permissions (key TEXT PRIMARY KEY);
      CREATE TABLE role_permissions (role TEXT, permission_key TEXT);
      CREATE TABLE user_permission_overrides (
        organization_id UUID, user_id TEXT, permission_key TEXT, effect TEXT
      );
      CREATE TABLE casting_projects (id TEXT PRIMARY KEY, organization_id UUID);
      CREATE TABLE industries (
        id UUID PRIMARY KEY, organization_id UUID, scope TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE TABLE crm_customers (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT,
        email TEXT,
        phone TEXT,
        website_url TEXT,
        address TEXT,
        postal_code TEXT,
        city TEXT,
        country TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        location_confidence TEXT,
        enrichment_org_nr TEXT,
        google_place_id TEXT,
        industry_id UUID,
        lead_category TEXT,
        estimated_value NUMERIC(14,2),
        notes TEXT,
        lead_temperature TEXT,
        pipeline_stage TEXT,
        lead_status TEXT,
        lead_source TEXT,
        next_follow_up_at TIMESTAMPTZ,
        next_action TEXT,
        status TEXT,
        owner_user_id TEXT,
        assigned_user_id TEXT,
        assigned_at TIMESTAMPTZ,
        assigned_by_user_id TEXT,
        organization_id UUID,
        project_id TEXT,
        archived_at TIMESTAMPTZ,
        lead_score INTEGER,
        deal_amount NUMERIC,
        deal_probability INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE leadgrid_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        created_by TEXT NOT NULL,
        name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        trigger_type TEXT NOT NULL,
        trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
        conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
        actions JSONB NOT NULL DEFAULT '[]'::jsonb,
        last_error_at TIMESTAMPTZ,
        last_error_message TEXT
      );
    `);
    for (const migration of [
      "0400_background_jobs.sql",
      "0485_leadgrid_add_lead_profile_fields.sql",
      "0489_leadgrid_lead_creation_idempotency.sql",
      "0490_leadgrid_lead_creation_duplicate_indexes.sql",
      "0491_leadgrid_normalized_contact_fields.sql",
    ]) {
      const sql = await readFile(new URL("../migrations/" + migration, import.meta.url), "utf8");
      await pool.query(sql);
    }
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1::uuid, $2, 'admin')`,
      [ORG_ID, USER_ID],
    );
    await pool.query("INSERT INTO permissions (key) VALUES ('leads.create')");

    const app = express();
    app.use(express.json());
    const activeSessions = new Map([[TOKEN, {
      userId: USER_ID,
      role: "admin",
      email: "e2e@example.no",
    }]]);
    setupLeadMapRoutes({
      app,
      pool,
      activeSessions,
    });
    registerRoutesAdherenceRoutes({
      app,
      pool,
      requireUserSession: (req, res) => {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
        if (token === TOKEN) {
          return { userId: USER_ID, role: "admin", email: "e2e@example.no", name: "E2E" };
        }
        res.status(401).json({ error: "Innlogging kreves" });
        return null;
      },
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = "http://127.0.0.1:" + address.port;
  }, 30_000);

  afterAll(async () => {
    clearJobHandlers();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (pool) await pool.end();
  });

  async function create(body: Record<string, unknown>, authorized = true) {
    return post("/api/admin-room/lead-map/leads", body, authorized);
  }

  async function post(path: string, body: Record<string, unknown>, authorized = true) {
    return fetch(baseUrl + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorized ? { authorization: "Bearer " + TOKEN } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it("enforces auth and tenant, persists once, blocks coordinates, overrides explicitly, and drains outbox", async () => {
    const firstPayload = {
      creation_id: CREATION_ID,
      organization_id: ORG_ID,
      name: "E2E Elektro AS",
      email: "post@e2e-elektro.no",
      phone: "+47 999 88 777",
      latitude: 59.9139,
      longitude: 10.7522,
      location_confidence: "exact",
      lead_source: "e2e",
    };

    expect((await create(firstPayload, false)).status).toBe(401);

    const created = await create(firstPayload);
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { id: string; created: boolean };
    expect(createdBody.created).toBe(true);

    const replay = await create(firstPayload);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      id: createdBody.id,
      created: false,
      replayed: true,
    });

    const stored = await pool.query(
      `SELECT organization_id::text, owner_user_id, email,
              email_normalized, phone_normalized,
              creation_idempotency_key::text
         FROM crm_customers WHERE id = $1::uuid`,
      [createdBody.id],
    );
    expect(stored.rows[0]).toMatchObject({
      organization_id: ORG_ID,
      owner_user_id: USER_ID,
      email: "post@e2e-elektro.no",
      email_normalized: "post@e2e-elektro.no",
      phone_normalized: "99988777",
      creation_idempotency_key: CREATION_ID,
    });

    await pool.query(
      `UPDATE crm_customers
          SET email = '  Normalized@Example.NO ',
              phone = '+47 (912) 34 567',
              email_normalized = 'corrupt',
              phone_normalized = 'corrupt'
        WHERE id = $1::uuid`,
      [createdBody.id],
    );
    const triggerOwned = await pool.query(
      `SELECT email_normalized, phone_normalized
         FROM crm_customers WHERE id = $1::uuid`,
      [createdBody.id],
    );
    expect(triggerOwned.rows[0]).toMatchObject({
      email_normalized: "normalized@example.no",
      phone_normalized: "91234567",
    });

    const duplicatePayload = {
      ...firstPayload,
      creation_id: SECOND_CREATION_ID,
      name: "Annet navn",
      email: "annet@e2e-elektro.no",
    };
    const duplicate = await create(duplicatePayload);
    expect(duplicate.status).toBe(409);
    const duplicateBody = await duplicate.json() as {
      error: string;
      candidates: Array<{ match_reasons: string[] }>;
    };
    expect(duplicateBody.error).toBe("duplicate_conflict");
    expect(duplicateBody.candidates[0].match_reasons).toContain("coordinates");

    const overridden = await create({ ...duplicatePayload, allow_duplicate: true });
    expect(overridden.status).toBe(201);

    const wrongTenant = await create({
      ...firstPayload,
      creation_id: "55555555-5555-4555-8555-555555555555",
      organization_id: OTHER_ORG_ID,
      email: "tenant@example.no",
      latitude: 60,
      longitude: 11,
    });
    expect(wrongTenant.status).toBe(403);

    const fromPin = await post("/api/admin-room/lead-map/leads/from-pin", {
      creation_id: "66666666-6666-4666-8666-666666666666",
      organization_id: ORG_ID,
      name: "Legacy pin",
      email: "pin@example.no",
      latitude: 60.1,
      longitude: 11.1,
    });
    expect(fromPin.status).toBe(200);

    const fromCard = await post("/api/admin-room/lead-map/leads/from-card", {
      creation_id: "77777777-7777-4777-8777-777777777777",
      organization_id: ORG_ID,
      name: "Legacy kort",
      email: "kort@example.no",
    });
    expect(fromCard.status).toBe(200);

    const atPosition = await post("/api/leadgrid/routes/leads/at-position", {
      creation_id: "88888888-8888-4888-8888-888888888888",
      org_id: ORG_ID,
      lat: 61,
      lon: 12,
    });
    expect(atPosition.status).toBe(201);

    const persistedCount = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM crm_customers",
    );
    expect(persistedCount.rows[0].count).toBe("5");

    const queued = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM background_jobs WHERE job_type = 'leadgrid_workflow_event'",
    );
    expect(queued.rows[0].count).toBe("5");

    clearJobHandlers();
    registerCoreJobHandlers();
    for (let index = 0; index < 5; index += 1) {
      expect(await processNextJob(pool)).toBe("completed");
    }
    expect(await processNextJob(pool)).toBe("idle");

    const completed = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM background_jobs WHERE status = 'completed'",
    );
    expect(completed.rows[0].count).toBe("5");
  }, 30_000);
});
