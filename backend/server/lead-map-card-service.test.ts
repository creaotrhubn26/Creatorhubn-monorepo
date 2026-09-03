import type { Pool, PoolClient, QueryResult } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  CardLeadProjectScopeError,
  createCardLead,
  type CardLeadCreationInput,
} from "./lead-map-card-service.js";
import { LeadCreationIdempotencyConflictError } from "./lead-map-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const idempotencyKey = "22222222-2222-4222-8222-222222222222";

const baseInput: CardLeadCreationInput = {
  name: "Ada Lovelace",
  title: "Daglig leder",
  company: "Analytical AS",
  email: "ada@example.no",
  phone: "+4799999999",
  website: "https://www.example.no/contact",
  notes: "Skannet på messe",
  projectId: null,
  leadSource: "business_card_scan",
  organizationNumber: "999999999",
  ownerUserId: "user-a",
  organizationId,
  idempotencyKey,
};

function result<T>(rows: T[] = [], rowCount = rows.length): QueryResult<T> {
  return { rows, rowCount } as QueryResult<T>;
}

describe("createCardLead", () => {
  it("persists once and replays the same request without a second lead or activity", async () => {
    let storedHash: string | null = null;
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return result();
      if (sql.includes("creation_idempotency_key = $2::uuid") && sql.includes("SELECT id::text")) {
        return storedHash
          ? result([{ id: "lead-a", creation_request_hash: storedHash }])
          : result([]);
      }
      if (sql.includes("pg_advisory_xact_lock")) return result([{ pg_advisory_xact_lock: null }]);
      if (sql.includes("CASE") && sql.includes("duplicate_match")) return result([]);
      if (sql.includes("INSERT INTO crm_customers")) {
        storedHash = String(params?.[14]);
        return result([{ id: "lead-a" }]);
      }
      if (sql.includes("INSERT INTO crm_lead_activities")) return result([], 1);
      throw new Error(`Unhandled SQL: ${sql.slice(0, 80)}`);
    });
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    const created = await createCardLead(pool, baseInput);
    const replay = await createCardLead(pool, baseInput);

    expect(created).toMatchObject({ id: "lead-a", created: true, idempotentReplay: false });
    expect(replay).toMatchObject({ id: "lead-a", created: false, idempotentReplay: true });
    expect(query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO crm_customers"))).toHaveLength(1);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO crm_lead_activities"))).toHaveLength(1);
    const insertSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("INSERT INTO crm_customers"),
      )?.[0] ?? "",
    );
    expect(insertSql).toContain("$9::text, $10::uuid, $9::text");
    expect(insertSql).toContain("NOW(), $9::text, $11");
  });

  it("rejects reuse of an idempotency key for a different payload", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return result();
      if (sql.includes("creation_idempotency_key = $2::uuid")) {
        return result([{ id: "lead-a", creation_request_hash: "different-hash" }]);
      }
      throw new Error(`Unhandled SQL: ${sql.slice(0, 80)}`);
    });
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await expect(createCardLead(pool, baseInput)).rejects.toBeInstanceOf(
      LeadCreationIdempotencyConflictError,
    );
    expect(query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("returns an existing workspace lead for a normalized-domain duplicate", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") return result();
      if (sql.includes("pg_advisory_xact_lock")) return result([{ pg_advisory_xact_lock: null }]);
      if (sql.includes("duplicate_match")) {
        return result([{ id: "lead-existing", duplicate_match: "domain" }]);
      }
      throw new Error(`Unhandled SQL: ${sql.slice(0, 80)}`);
    });
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    const duplicate = await createCardLead(pool, {
      ...baseInput,
      idempotencyKey: null,
      organizationNumber: null,
    });

    expect(duplicate).toEqual({
      id: "lead-existing",
      created: false,
      idempotentReplay: false,
      duplicateMatch: "domain",
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO crm_customers"))).toBe(false);
  });

  it("rejects a project from another workspace before creating the lead", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return result();
      if (sql.includes("FROM leadgrid_projects")) return result([]);
      throw new Error(`Unhandled SQL: ${sql.slice(0, 80)}`);
    });
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await expect(createCardLead(pool, { ...baseInput, projectId: "foreign-project" }))
      .rejects.toBeInstanceOf(CardLeadProjectScopeError);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO crm_customers"))).toBe(false);
    expect(query).toHaveBeenCalledWith("ROLLBACK");
  });
});
