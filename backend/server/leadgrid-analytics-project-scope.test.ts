import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  computeChannelPerformance,
  computeConversionFunnel,
  computeOrgAnalyticsOverview,
  computeSegmentPerformance,
  computeSourcePerformance,
  computeTerritoryPerformance,
  computeVelocityHistory,
} from "./leadgrid-analytics-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";

describe("Leadgrid analytics project scope", () => {
  it("applies the selected project to every lead query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    const pool = { query } as unknown as Pool;

    await computeOrgAnalyticsOverview(pool, organizationId, 90, projectId);
    await computeChannelPerformance(pool, organizationId, 90, projectId);
    await computeSourcePerformance(pool, organizationId, projectId);
    await computeSegmentPerformance(pool, organizationId, "city", projectId);
    await computeTerritoryPerformance(pool, organizationId, projectId);
    await computeVelocityHistory(pool, organizationId, 90, projectId);
    await computeConversionFunnel(pool, organizationId, projectId);

    const leadQueries = query.mock.calls.filter(([sql]) =>
      String(sql).includes("crm_customers"));
    expect(leadQueries).toHaveLength(9);
    for (const [sql, params] of leadQueries) {
      expect(String(sql)).toMatch(/project_id\s*=\s*\$\d+/);
      expect(params).toContain(projectId);
    }
  });

  it("keeps organization-wide analytics backwards compatible with null project", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    await computeSourcePerformance(
      { query } as unknown as Pool,
      organizationId,
      null,
    );
    expect(query.mock.calls[0][1]).toContain(null);
  });
});
