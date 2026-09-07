import { readFileSync } from "node:fs";
import type { Pool, PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const territory = vi.hoisted(() => ({
  hasTerritory: vi.fn(),
  isInside: vi.fn(),
  recordBreach: vi.fn(),
}));
vi.mock("./leadgrid-territory-service.js", () => ({
  userHasTerritory: territory.hasTerritory,
  isPointInUserGrid: territory.isInside,
  recordBreach: territory.recordBreach,
}));

import { logVisit } from "./lead-map-service.js";
import { hashLeadVisitRequest } from "./lead-map-visit-contract.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const ownerUserId = "seller-1";
const organizationId = "22222222-2222-4222-8222-222222222222";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";

type QueryResultLike = {
  rows: Record<string, unknown>[];
  rowCount?: number;
};

function makePool(
  clientHandler: (
    sql: string,
    params?: readonly unknown[],
  ) => QueryResultLike | Promise<QueryResultLike>,
  poolHandler: (
    sql: string,
    params?: readonly unknown[],
  ) => QueryResultLike | Promise<QueryResultLike> = () => ({ rows: [] }),
) {
  let released = false;
  const afterReleaseClientQueries: string[] = [];
  const clientQuery = vi.fn(
    async (sql: string, params?: readonly unknown[]) => {
      if (released) afterReleaseClientQueries.push(sql);
      return clientHandler(sql, params);
    },
  );
  const release = vi.fn(() => {
    released = true;
  });
  const client = { query: clientQuery, release } as unknown as PoolClient;
  const poolQuery = vi.fn(
    async (sql: string, params?: readonly unknown[]) =>
      poolHandler(sql, params),
  );
  const pool = {
    connect: vi.fn(async () => client),
    query: poolQuery,
  } as unknown as Pool;
  return {
    pool,
    clientQuery,
    poolQuery,
    release,
    afterReleaseClientQueries,
  };
}

function visitPayload() {
  return {
    visitType: "phone" as const,
    contactPerson: "Ada",
    conversationSummary: "Avtalte demo",
    newStatus: "interested" as const,
    nextAction: "Send kalenderlenke",
    nextFollowUpAt: "2026-09-10T10:00:00.000Z",
    activityKind: "call" as const,
    outcome: "interested" as const,
    durationMinutes: 12,
  };
}

function idempotentInput() {
  const payload = visitPayload();
  return {
    ownerUserId,
    organizationId,
    leadId,
    ...payload,
    idempotencyKey,
    requestHash: hashLeadVisitRequest(leadId, payload),
  };
}

function successfulWriteHandler(
  sql: string,
): QueryResultLike {
  if (sql.includes("SELECT lead_status FROM crm_customers")) {
    return { rows: [{ lead_status: "unvisited" }], rowCount: 1 };
  }
  if (sql.includes("SELECT id::text, request_hash, previous_status")) {
    return { rows: [], rowCount: 0 };
  }
  if (sql.includes("INSERT INTO crm_visits")) {
    return { rows: [{ id: "visit-new" }], rowCount: 1 };
  }
  return { rows: [], rowCount: 1 };
}

beforeEach(() => {
  vi.clearAllMocks();
  territory.hasTerritory.mockResolvedValue(true);
  territory.isInside.mockResolvedValue(false);
  territory.recordBreach.mockResolvedValue(undefined);
});

describe("Leadgrid visit idempotency", () => {
  it("hashes a fixed canonical payload together with lead id", () => {
    const first = hashLeadVisitRequest(leadId, {
      visitType: "phone",
      notes: undefined,
      durationMinutes: 5,
    });
    const reordered = hashLeadVisitRequest(leadId.toUpperCase(), {
      durationMinutes: 5,
      visitType: "phone",
    });
    const anotherLead = hashLeadVisitRequest(
      "44444444-4444-4444-8444-444444444444",
      { visitType: "phone", durationMinutes: 5 },
    );

    expect(first).toBe(reordered);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(anotherLead);
  });

  it("persists the key/hash pair and performs status/audit once", async () => {
    const mock = makePool(successfulWriteHandler);
    const input = idempotentInput();

    await expect(logVisit(mock.pool, input)).resolves.toMatchObject({
      ok: true,
      visitId: "visit-new",
      previousStatus: "unvisited",
      idempotentReplay: false,
    });

    const insert = mock.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO crm_visits"));
    expect(String(insert?.[0])).toContain("idempotency_key, request_hash");
    expect(String(insert?.[0])).toContain(
      "ON CONFLICT (customer_id, user_id, idempotency_key)",
    );
    expect(insert?.[1]?.[17]).toBe(idempotencyKey);
    expect(insert?.[1]?.[18]).toBe(input.requestHash);
    expect(mock.clientQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("UPDATE crm_customers"))).toHaveLength(1);
    expect(mock.clientQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO crm_lead_activities"))).toHaveLength(1);
  });

  it("returns an identical retry without duplicate visit, status or audit writes", async () => {
    const input = idempotentInput();
    const mock = makePool((sql) => {
      if (sql.includes("SELECT lead_status FROM crm_customers")) {
        return { rows: [{ lead_status: "interested" }], rowCount: 1 };
      }
      if (sql.includes("SELECT id::text, request_hash, previous_status")) {
        return {
          rows: [{
            id: "visit-existing",
            request_hash: input.requestHash,
            previous_status: "unvisited",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(logVisit(mock.pool, input)).resolves.toEqual({
      ok: true,
      visitId: "visit-existing",
      previousStatus: "unvisited",
      idempotentReplay: true,
    });
    expect(mock.clientQuery.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO crm_visits"))).toBe(false);
    expect(mock.clientQuery.mock.calls.some(([sql]) =>
      String(sql).includes("UPDATE crm_customers"))).toBe(false);
    expect(mock.clientQuery.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO crm_lead_activities"))).toBe(false);
    expect(mock.clientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("returns a typed conflict for the same key with another payload", async () => {
    const input = idempotentInput();
    const mock = makePool((sql) => {
      if (sql.includes("SELECT lead_status FROM crm_customers")) {
        return { rows: [{ lead_status: "interested" }], rowCount: 1 };
      }
      if (sql.includes("SELECT id::text, request_hash, previous_status")) {
        return {
          rows: [{
            id: "visit-existing",
            request_hash: "f".repeat(64),
            previous_status: "unvisited",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(logVisit(mock.pool, input)).rejects.toMatchObject({
      name: "VisitIdempotencyConflictError",
      existingVisitId: "visit-existing",
    });
    expect(mock.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mock.clientQuery.mock.calls.some(([sql]) =>
      String(sql).includes("UPDATE crm_customers"))).toBe(false);
  });

  it("keeps legacy requests without a header non-idempotent", async () => {
    const mock = makePool(successfulWriteHandler);

    await expect(logVisit(mock.pool, {
      ownerUserId,
      organizationId,
      leadId,
      ...visitPayload(),
    })).resolves.toMatchObject({
      ok: true,
      idempotentReplay: false,
    });

    const insert = mock.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO crm_visits"));
    expect(insert?.[1]?.[17]).toBeNull();
    expect(insert?.[1]?.[18]).toBeNull();
  });

  it("uses the pool, never the released client, for async territory checks", async () => {
    const mock = makePool(
      successfulWriteHandler,
      (sql) => {
        if (sql.includes("SELECT organization_id::text")) {
          return { rows: [{ organization_id: organizationId }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      },
    );

    await logVisit(mock.pool, {
      ownerUserId,
      organizationId,
      leadId,
      visitType: "physical",
      visitLatitude: 59.91,
      visitLongitude: 10.75,
    });

    await vi.waitFor(() => {
      expect(mock.poolQuery.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE crm_visits SET out_of_grid"))).toBe(true);
    });
    expect(mock.release).toHaveBeenCalledOnce();
    expect(mock.afterReleaseClientQueries).toEqual([]);
  });

  it("defines pair/hash constraints and the required scoped unique index", () => {
    const migration = readFileSync(
      new URL(
        "../migrations/0527_leadgrid_visit_idempotency.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS idempotency_key UUID");
    expect(migration).toContain("crm_visits_idempotency_pair_check");
    expect(migration).toContain("crm_visits_request_hash_format_check");
    expect(migration).toContain(
      "ON crm_visits(customer_id, user_id, idempotency_key)",
    );
    expect(migration).toContain("WHERE idempotency_key IS NOT NULL");
  });
});

  it("resolves an insert race as a replay without later side effects", async () => {
    const input = idempotentInput();
    let lookups = 0;
    const mock = makePool((sql) => {
      if (sql.includes("SELECT lead_status FROM crm_customers")) {
        return { rows: [{ lead_status: "interested" }], rowCount: 1 };
      }
      if (sql.includes("SELECT id::text, request_hash, previous_status")) {
        lookups += 1;
        return lookups === 1
          ? { rows: [], rowCount: 0 }
          : {
              rows: [{
                id: "visit-race-winner",
                request_hash: input.requestHash,
                previous_status: "unvisited",
              }],
              rowCount: 1,
            };
      }
      if (sql.includes("INSERT INTO crm_visits")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(logVisit(mock.pool, input)).resolves.toMatchObject({
      visitId: "visit-race-winner",
      idempotentReplay: true,
    });
    expect(lookups).toBe(2);
    expect(mock.clientQuery.mock.calls.some(([sql]) =>
      String(sql).includes("UPDATE crm_customers"))).toBe(false);
    expect(mock.clientQuery.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO crm_lead_activities"))).toBe(false);
  });
