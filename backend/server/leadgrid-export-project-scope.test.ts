import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { __test } from "./lead-export-routes.js";

describe("Leadgrid CSV/PDF export project scope", () => {
  it("uses the validated project id in the exported lead query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await __test.fetchLeadsForExport(
      { query } as unknown as Pool,
      {
        orgId: "11111111-1111-4111-8111-111111111111",
        projectId: "project-a",
        periodDays: 30,
        status: "all",
      },
    );

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("c.organization_id = $1::uuid");
    expect(String(sql)).toContain("c.project_id = $3");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      30,
      "project-a",
    ]);
  });
});
