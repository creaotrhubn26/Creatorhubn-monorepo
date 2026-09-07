import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { __test } from "./lead-export-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("Leadgrid PDF summary project scope", () => {
  it("keeps every aggregate inside the selected organization and project", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    await __test.buildExportSummary(
      { query } as unknown as Pool,
      organizationId,
      30,
      "project-a",
    );

    expect(query).toHaveBeenCalledTimes(4);
    for (const [sql, params] of query.mock.calls) {
      expect(String(sql)).toContain("c.organization_id = $1::uuid");
      expect(String(sql)).toContain("c.project_id = $3");
      expect(params).toEqual([organizationId, 30, "project-a"]);
      expect(params).not.toContain("project-b");
    }
  });
});
