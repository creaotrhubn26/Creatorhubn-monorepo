import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  canAutoOnboard,
  canCreateCustomer,
  tryClaimAutoOnboard,
} from "./plan-limits-service.js";

function buildUnknownPlanPool(planKey: string) {
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("SELECT plan FROM organizations")) {
      return { rows: [{ plan: planKey }], rowCount: 1 };
    }
    if (sql.includes("FROM plan_grace")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("FROM plan_limits")) {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  return { pool: { query } as unknown as Pool, query };
}

describe("plan limit fail-closed behavior", () => {
  it.each([
    ["auto-onboard preflight", canAutoOnboard],
    ["atomic auto-onboard claim", tryClaimAutoOnboard],
    ["customer creation", canCreateCustomer],
  ] as const)("denies %s when the active plan key is unknown", async (_name, gate) => {
    const planKey = `unknown-${crypto.randomUUID()}`;
    const { pool, query } = buildUnknownPlanPool(planKey);

    await expect(gate(pool, "org-1")).resolves.toEqual({
      allowed: false,
      current_plan: planKey,
      reason: "plan_not_found",
    });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO plan_usage") ||
        String(sql).includes("FROM crm_customers"),
      ),
    ).toBe(false);
  });
});
