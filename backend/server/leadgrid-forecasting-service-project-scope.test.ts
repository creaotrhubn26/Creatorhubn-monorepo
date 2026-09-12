import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeAttribution,
  getOrComputeForecast,
} from "./leadgrid-forecasting-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";

describe("Leadgrid forecasting service project scope", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
  });

  it("reads cached forecasts by the complete tenant tuple", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{
        organization_id: organizationId,
        project_id: projectId,
        horizon_days: 90,
        predicted_revenue_low: "100",
        predicted_revenue_mid: "200",
        predicted_revenue_high: "300",
        predicted_won_deals: 2,
        predicted_avg_cycle_days: "21",
        confidence_score: "0.70",
        reasoning: "Prosjektbundet.",
        contributing_factors: [],
        active_pipeline_value: "1000",
        active_deals: 4,
        computed_at: "2026-09-06T00:00:00.000Z",
      }],
    });

    const result = await getOrComputeForecast(
      { query } as unknown as Pool,
      organizationId,
      projectId,
      90,
    );

    expect(result.projectId).toBe(projectId);
    expect(String(query.mock.calls[0]?.[0])).toContain("project_id = $2");
    expect(query.mock.calls[0]?.[1]).toEqual([
      organizationId,
      projectId,
      90,
      "6",
    ]);
  });

  it("filters every baseline cohort and cache write by project", async () => {
    const query = vi.fn(async (sqlValue: string) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT * FROM leadgrid_forecast_cache")) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes("WITH active AS")) {
        return {
          rowCount: 1,
          rows: [{
            active_deals: 4,
            active_pipeline_value: 100_000,
            historic_won: 2,
            historic_revenue: 50_000,
            avg_cycle_days: 30,
            total_leads: 10,
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    });
    const pool = { query } as unknown as Pool;

    const result = await getOrComputeForecast(
      pool,
      organizationId,
      projectId,
      90,
    );

    const stats = query.mock.calls.find(([sql]) =>
      String(sql).includes("WITH active AS"),
    );
    const cache = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO leadgrid_forecast_cache"),
    );
    expect((String(stats?.[0]).match(/project_id = \$2/g) ?? [])).toHaveLength(3);
    expect(stats?.[1]).toEqual([organizationId, projectId, "90", "180"]);
    expect(String(cache?.[0])).toContain(
      "ON CONFLICT (organization_id, project_id, horizon_days)",
    );
    expect(cache?.[1]?.slice(0, 3)).toEqual([
      organizationId,
      projectId,
      90,
    ]);
    expect(result.projectId).toBe(projectId);
  });

  it("attributes actions through scoped leads and caches total lost correctly", async () => {
    const query = vi.fn(async (sqlValue: string) => {
      const sql = String(sqlValue);
      if (sql.includes("WITH executed AS")) {
        return {
          rowCount: 1,
          rows: [{
            action_type: "book_meeting",
            total_executed: 5,
            total_won: 2,
            total_lost: 1,
            avg_days_to_won: 12,
            avg_deal_value: 25_000,
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    });
    const pool = { query } as unknown as Pool;

    const result = await computeAttribution(
      pool,
      organizationId,
      projectId,
      90,
    );

    const aggregate = query.mock.calls[0];
    const cleanup = query.mock.calls[1];
    const cache = query.mock.calls[2];
    expect(String(aggregate?.[0])).toContain("c.project_id = $2");
    expect(aggregate?.[1]).toEqual([organizationId, projectId, "90"]);
    expect(String(cleanup?.[0])).toContain("project_id = $2");
    expect(cleanup?.[1]).toEqual([organizationId, projectId, 90]);
    expect(String(cache?.[0])).toContain(
      "ON CONFLICT (organization_id, project_id, action_type, window_days)",
    );
    expect(cache?.[1]).toEqual([
      organizationId,
      projectId,
      "book_meeting",
      90,
      5,
      2,
      1,
      0.4,
      12,
      25_000,
    ]);
    expect(result.actions[0]).toMatchObject({ totalLost: 1, winRate: 0.4 });
    expect(result.projectId).toBe(projectId);
  });
});
