import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

const USER = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";
const RESOURCE_ORG = "33333333-3333-4333-8333-333333333333";
const SPOOFED_ORG = "44444444-4444-4444-8444-444444444444";

describe("Lead Map RBAC resource tenant resolution", () => {
  it("authorizes a lead write against the lead's org, never body org", async () => {
    const permissionOrgIds: string[] = [];
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM crm_customers c")) {
        return {
          rows: [{ organization_id: RESOURCE_ORG }],
          rowCount: 1,
        };
      }
      if (sql.includes("SELECT role FROM organization_members")) {
        permissionOrgIds.push(String(params[0]));
        return { rows: [{ role: "admin" }], rowCount: 1 };
      }
      if (sql.includes("SELECT key FROM permissions")) {
        return { rows: [{ key: "leads.update" }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const app = express();
    app.use(express.json());
    app.patch(
      "/api/admin-room/lead-map/leads/:id/status",
      requireLeadMapPermission("leads.update", {
        pool: { query } as unknown as Pool,
        activeSessions: new Map([["session", { userId: USER }]]),
      }),
      (_req, res) => res.json({ ok: true }),
    );

    await request(app)
      .patch(`/api/admin-room/lead-map/leads/${LEAD}/status`)
      .set("Authorization", "Bearer session")
      .send({ organization_id: SPOOFED_ORG, status: "won" })
      .expect(200, { ok: true });

    expect(permissionOrgIds).toEqual([RESOURCE_ORG]);
    expect(permissionOrgIds).not.toContain(SPOOFED_ORG);
  });
});
