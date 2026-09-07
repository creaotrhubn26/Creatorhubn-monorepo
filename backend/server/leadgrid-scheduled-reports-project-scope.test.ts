import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { __test } from "./leadgrid-scheduled-reports-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("Leadgrid scheduled report project scope", () => {
  it("applies one project to every PDF summary query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    await __test.buildSummary(
      { query } as unknown as Pool,
      organizationId,
      30,
      { scope: "org" },
      "project-a",
    );

    expect(query).toHaveBeenCalledTimes(4);
    for (const [sql, params] of query.mock.calls) {
      expect(String(sql)).toContain("c.project_id = $3");
      expect(params).toEqual(expect.arrayContaining([
        organizationId,
        30,
        "project-a",
      ]));
    }
  });

  it("applies one project to the CSV lead query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await __test.buildLeadsCsv(
      { query } as unknown as Pool,
      organizationId,
      30,
      "all",
      { scope: "org" },
      "project-a",
    );

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("c.project_id = $3");
    expect(params).toEqual([organizationId, 30, "project-a"]);
    expect(String(sql)).not.toContain("project-b");
  });
});
