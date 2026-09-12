import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  assertAutoDiscoveryProfileCapacity,
  bindDiscoveryCapacityReservation,
  DiscoveryGovernanceError,
  reserveDiscoveryMonthlyCapacityInTransaction,
} from "./leadgrid-discovery-governance.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("Leadgrid Discovery governance", () => {
  it("serializes and rejects an organization above the automatic profile cap", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)"))
        return { rows: [{ count: 5 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });

    await expect(
      assertAutoDiscoveryProfileCapacity(
        { query } as unknown as Pick<PoolClient, "query">,
        { organizationId },
        { LEADGRID_DISCOVERY_MAX_AUTO_PROFILES_PER_ORG: "5" },
      ),
    ).rejects.toBeInstanceOf(DiscoveryGovernanceError);
    expect(query.mock.calls[0]?.[0]).toContain("pg_advisory_xact_lock");
  });

  it("reserves monthly candidates once and fails closed at the budget boundary", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_discovery_capacity_reservations")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_monthly_usage")) {
        return { rows: [{ reserved_candidates: 20 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const client = { query } as unknown as Pick<PoolClient, "query">;

    await expect(
      reserveDiscoveryMonthlyCapacityInTransaction(
        client,
        {
          organizationId,
          idempotencyKey: "reservation-a",
          requestedCandidates: 20,
          at: new Date("2026-08-31T12:00:00.000Z"),
        },
        { LEADGRID_DISCOVERY_ORG_MONTHLY_CANDIDATE_BUDGET: "500" },
      ),
    ).resolves.toMatchObject({ allowed: true, replayed: false });
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes(
          "INSERT INTO leadgrid_discovery_capacity_reservations",
        ),
      ),
    ).toHaveLength(1);

    query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM leadgrid_discovery_capacity_reservations")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_monthly_usage")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 1 };
    });
    await expect(
      reserveDiscoveryMonthlyCapacityInTransaction(
        client,
        {
          organizationId,
          idempotencyKey: "reservation-b",
          requestedCandidates: 20,
          at: new Date("2026-08-31T12:00:00.000Z"),
        },
        { LEADGRID_DISCOVERY_ORG_MONTHLY_CANDIDATE_BUDGET: "500" },
      ),
    ).resolves.toMatchObject({ allowed: false, replayed: false });
  });

  it("fails closed when a reservation cannot be bound to its run", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    await expect(
      bindDiscoveryCapacityReservation(
        { query } as unknown as Pick<PoolClient, "query">,
        {
          organizationId,
          idempotencyKey: "reservation-a",
          runId: "22222222-2222-4222-8222-222222222222",
        },
      ),
    ).rejects.toMatchObject({ code: "capacity_reservation_conflict" });
  });
});
