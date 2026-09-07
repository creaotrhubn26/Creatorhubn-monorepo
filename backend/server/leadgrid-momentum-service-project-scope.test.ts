import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  computeTodayMomentum,
  getOrCreateGoal,
  setGoal,
} from "./leadgrid-momentum-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";

function goalRow(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: organizationId,
    project_id: projectId,
    year_month: "2026-09",
    revenue_target: "500000",
    deals_target: 5,
    meetings_target: 12,
    proposals_target: 8,
    daily_contacts_target: 4,
    daily_followups_target: 6,
    daily_meetings_target: 1,
    daily_pipeline_moves_target: 2,
    monthly_leads_needed: 80,
    notes: "Dentum",
    ...overrides,
  };
}

describe("Leadgrid momentum service project scope", () => {
  it("loads and maps a goal only by organization/project/month", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [goalRow()],
      rowCount: 1,
    });
    const pool = { query } as unknown as Pool;

    const goal = await getOrCreateGoal(
      pool,
      organizationId,
      projectId,
      "2026-09",
    );

    expect(goal).toMatchObject({
      organizationId,
      projectId,
      yearMonth: "2026-09",
      notes: "Dentum",
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0]![0])).toContain(
      "FROM leadgrid_project_sales_goals",
    );
    expect(query.mock.calls[0]![1]).toEqual([
      organizationId,
      projectId,
      "2026-09",
    ]);
  });

  it("updates a goal in the same tuple and preserves omitted notes", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [goalRow()], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [goalRow({ deals_target: 9 })],
        rowCount: 1,
      });
    const pool = { query } as unknown as Pool;

    const goal = await setGoal(
      pool,
      organizationId,
      projectId,
      "user-a",
      { yearMonth: "2026-09", dealsTarget: 9 },
    );

    expect(goal.dealsTarget).toBe(9);
    expect(goal.notes).toBe("Dentum");
    const [sql, params] = query.mock.calls[1]!;
    expect(String(sql)).toContain("UPDATE leadgrid_project_sales_goals");
    expect(String(sql)).toContain("project_id = $13");
    expect(params.slice(-3)).toEqual([organizationId, projectId, "2026-09"]);
    expect(params[9]).toBe("Dentum");
  });

  it("filters every KPI input and snapshot cache by project", async () => {
    const query = vi.fn(async (queryText: unknown) => {
      const sql = String(queryText);
      if (sql.includes("FROM leadgrid_project_sales_goals")) {
        return { rows: [goalRow()], rowCount: 1 };
      }
      if (sql.includes("AS contacts")) {
        return {
          rows: [{
            contacts: "1",
            followups: "2",
            meetings: "0",
            pipeline_moves: "1",
            calls: "1",
            emails: "0",
            visits: "0",
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("AS moved")) {
        return { rows: [{ moved: "1", total: "2" }], rowCount: 1 };
      }
      if (sql.includes("AS contacted_hot")) {
        return {
          rows: [{ contacted_hot: "1", total_hot: "2" }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM lead_recommendations")) {
        return { rows: [{ count: "1" }], rowCount: 1 };
      }
      if (sql.includes("SELECT momentum_score::text")) {
        return { rows: [{ momentum_score: "20" }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO leadgrid_project_momentum_snapshots")) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = { query } as unknown as Pool;

    const momentum = await computeTodayMomentum(pool, organizationId, projectId);

    expect(momentum).toMatchObject({ organizationId, projectId });
    const calls = query.mock.calls.map(([sql, params]) => ({
      sql: String(sql),
      params,
    }));
    const kpiCalls = calls.filter(({ sql }) =>
      sql.includes("crm_customers")
      || sql.includes("lead_recommendations")
      || sql.includes("leadgrid_project_momentum_snapshots")
    );
    expect(kpiCalls.length).toBeGreaterThan(0);
    for (const call of kpiCalls) {
      expect(call.sql).toContain("project_id");
      expect(call.params?.slice(0, 2)).toEqual([organizationId, projectId]);
    }
    const snapshot = calls.find(({ sql }) =>
      sql.includes("INSERT INTO leadgrid_project_momentum_snapshots")
    );
    expect(snapshot?.sql).toContain(
      "ON CONFLICT (organization_id, project_id, snapshot_date)",
    );
    expect(calls.map(({ sql }) => sql).join("\n")).not.toContain(
      "FROM leadgrid_momentum_snapshots",
    );
  });

  it("awaits snapshot persistence instead of returning an unpersisted score", async () => {
    const query = vi.fn(async (queryText: unknown) => {
      const sql = String(queryText);
      if (sql.includes("FROM leadgrid_project_sales_goals")) {
        return { rows: [goalRow()], rowCount: 1 };
      }
      if (sql.includes("AS contacts")) {
        return {
          rows: [{
            contacts: "0",
            followups: "0",
            meetings: "0",
            pipeline_moves: "0",
            calls: "0",
            emails: "0",
            visits: "0",
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("AS moved")) {
        return { rows: [{ moved: "0", total: "0" }], rowCount: 1 };
      }
      if (sql.includes("AS contacted_hot")) {
        return {
          rows: [{ contacted_hot: "0", total_hot: "0" }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM lead_recommendations")) {
        return { rows: [{ count: "0" }], rowCount: 1 };
      }
      if (sql.includes("SELECT momentum_score::text")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO leadgrid_project_momentum_snapshots")) {
        throw new Error("snapshot_write_failed");
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const pool = { query } as unknown as Pool;

    await expect(
      computeTodayMomentum(pool, organizationId, projectId),
    ).rejects.toThrow("snapshot_write_failed");
  });
});
