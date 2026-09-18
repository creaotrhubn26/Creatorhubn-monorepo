import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { registerLeadgridPublicApiV1 } from "./leadgrid-public-api-v1.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN = "lgk_test_public_api_contract_token";
let keySequence = 0;

type QueryHandler = (sql: string, params: unknown[]) => Promise<{
  rows: unknown[];
  rowCount?: number;
}>;

function createTestApp(handler: QueryHandler) {
  keySequence += 1;
  const apiKeyId = `44444444-4444-4444-8444-${String(keySequence).padStart(12, "0")}`;
  const query = vi.fn(async (sqlValue: unknown, paramsValue?: unknown[]) => {
    const sql = String(sqlValue);
    const params = paramsValue ?? [];
    if (sql.includes("FROM leadgrid_api_keys")) {
      return {
        rows: [{
          id: apiKeyId,
          organization_id: ORG_ID,
          scopes: ["*"],
          rate_limit_rpm: 10_000,
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("UPDATE leadgrid_api_keys")) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("FROM organizations")) {
      return { rows: [{ status: "active" }], rowCount: 1 };
    }
    return handler(sql, params);
  });
  const app = express();
  app.use(express.json());
  registerLeadgridPublicApiV1({ app, pool: { query } as unknown as Pool });
  return { app, query };
}

describe("Leadgrid Public API v1 tenant contract", () => {
  it("lister og teller kun på crm_customers.organization_id", async () => {
    const customerSql: string[] = [];
    const { app } = createTestApp(async (sql) => {
      customerSql.push(sql);
      if (sql.includes("COUNT(*)")) return { rows: [{ total: "0" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    await request(app)
      .get("/api/v1/leads")
      .set("Authorization", `Bearer ${TOKEN}`)
      .expect(200);

    expect(customerSql).toHaveLength(2);
    for (const sql of customerSql) {
      expect(sql).toContain("organization_id = $1::uuid");
      expect(sql).not.toContain("owner_user_id IN");
      expect(sql).not.toContain("organization_members");
    }
  });

  it("returnerer 404 når direct org-scope ikke finner leaden", async () => {
    let captured: { sql: string; params: unknown[] } | null = null;
    const { app } = createTestApp(async (sql, params) => {
      captured = { sql, params };
      return { rows: [], rowCount: 0 };
    });

    await request(app)
      .get(`/api/v1/leads/${LEAD_ID}`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .expect(404);

    expect(captured).not.toBeNull();
    expect(captured!.sql).toContain("id = $1::uuid");
    expect(captured!.sql).toContain("organization_id = $2::uuid");
    expect(captured!.sql).not.toContain("organization_members");
    expect(captured!.params).toEqual([LEAD_ID, ORG_ID]);
  });

  it("skriver API-keyens org ved create og ignorerer body-org", async () => {
    let insert: { sql: string; params: unknown[] } | null = null;
    const { app } = createTestApp(async (sql, params) => {
      if (sql.includes("FROM organization_members")) {
        return { rows: [{ user_id: OWNER_ID }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO crm_customers")) {
        insert = { sql, params };
        return { rows: [{ id: LEAD_ID }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await request(app)
      .post("/api/v1/leads")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        name: "Tenantbundet lead",
        organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      })
      .expect(201);

    expect(response.body.data.id).toBe(LEAD_ID);
    expect(insert).not.toBeNull();
    expect(insert!.sql).toContain("owner_user_id, organization_id");
    expect(insert!.params.at(-2)).toBe(OWNER_ID);
    expect(insert!.params.at(-1)).toBe(ORG_ID);
    expect(insert!.params).not.toContain("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("krever at både recommendation og tilhørende lead har samme org", async () => {
    let captured: { sql: string; params: unknown[] } | null = null;
    const { app } = createTestApp(async (sql, params) => {
      captured = { sql, params };
      return { rows: [], rowCount: 0 };
    });

    await request(app)
      .get("/api/v1/recommendations?priority=high")
      .set("Authorization", `Bearer ${TOKEN}`)
      .expect(200);

    expect(captured).not.toBeNull();
    expect(captured!.sql).toContain("JOIN crm_customers c");
    expect(captured!.sql).toContain("c.organization_id = $1::uuid");
    expect(captured!.sql).toContain("lr.organization_id = $1::uuid");
    expect(captured!.sql).toContain("c.archived_at IS NULL");
    expect(captured!.params).toEqual([ORG_ID, 50, "high"]);
  });

  it("blokkerer writes for paused org, men tillater lesing", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_api_keys")) {
        return {
          rows: [{
            id: "55555555-5555-4555-8555-555555555555",
            organization_id: ORG_ID,
            scopes: ["*"],
            rate_limit_rpm: 10_000,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM organizations")) {
        return { rows: [{ status: "paused" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE leadgrid_api_keys")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM crm_customers") && sql.includes("COUNT(*)")) {
        return { rows: [{ total: "0" }], rowCount: 1 };
      }
      if (sql.includes("FROM crm_customers")) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const app = express();
    app.use(express.json());
    registerLeadgridPublicApiV1({ app, pool: { query } as unknown as Pool });

    await request(app)
      .get("/api/v1/leads")
      .set("Authorization", `Bearer ${TOKEN}`)
      .expect(200);
    const blocked = await request(app)
      .post("/api/v1/leads")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "Skal ikke opprettes" })
      .expect(423);
    expect(blocked.body.error).toBe("organization_read_only");
  });

  it.each(["suspended", "closed"])(
    "blokkerer all Public API-bruk for %s org",
    async (status) => {
      const query = vi.fn(async (sqlValue: unknown) => {
        const sql = String(sqlValue);
        if (sql.includes("FROM leadgrid_api_keys")) {
          return {
            rows: [{
              id: "66666666-6666-4666-8666-666666666666",
              organization_id: ORG_ID,
              scopes: ["*"],
              rate_limit_rpm: 10_000,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("FROM organizations")) {
          return { rows: [{ status }], rowCount: 1 };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      });
      const app = express();
      app.use(express.json());
      registerLeadgridPublicApiV1({ app, pool: { query } as unknown as Pool });

      const response = await request(app)
        .get("/api/v1/health")
        .set("Authorization", `Bearer ${TOKEN}`)
        .expect(403);
      expect(response.body).toMatchObject({
        error: "organization_suspended",
        status,
      });
    },
  );
});
