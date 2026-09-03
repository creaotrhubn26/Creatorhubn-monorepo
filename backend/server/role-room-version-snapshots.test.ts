import { describe, expect, it, vi } from "vitest";

import { snapshotIntakeVersion } from "./role-room-intake-versions-routes.js";
import { snapshotPlanVersion } from "./role-room-plan-versions-routes.js";

function sqlOf(call: unknown[] | undefined): string {
  return String(call?.[0] ?? "").replace(/\s+/g, " ").trim();
}

describe("Role Room version snapshot concurrency", () => {
  it("serializes intake version allocation inside the write transaction", async () => {
    const transactionQuery = vi.fn(async (sql: string) => {
      if (sql.includes("MAX(version_number)")) return { rows: [{ next_n: 7 }] };
      if (sql.includes("RETURNING id")) return { rows: [{ id: "intake-v7" }] };
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const poolQuery = vi.fn(async () => ({ rows: [{ snapshot: { project_goal: "Goal" } }] }));
    const pool = {
      query: poolQuery,
      connect: vi.fn(async () => ({ query: transactionQuery, release })),
    };

    await expect(snapshotIntakeVersion(pool as never, {
      projectId: "project-1",
      generatedByUserId: "user-1",
    })).resolves.toEqual({ versionId: "intake-v7", versionNumber: 7 });

    const sql = transactionQuery.mock.calls.map(sqlOf);
    expect(sql[0]).toBe("BEGIN");
    expect(sql[1]).toContain("pg_advisory_xact_lock");
    expect(sql[1]).toContain("hashtextextended");
    expect(sql[2]).toContain("MAX(version_number)");
    expect(sql.indexOf("COMMIT")).toBeGreaterThan(sql.findIndex((q) => q.includes("INSERT INTO")));
    expect(poolQuery).not.toHaveBeenCalledWith(expect.stringContaining("MAX(version_number)"), expect.anything());
    expect(release).toHaveBeenCalledOnce();
  });

  it("serializes marketing-plan version allocation inside the write transaction", async () => {
    const transactionQuery = vi.fn(async (sql: string) => {
      if (sql.includes("MAX(version_number)")) return { rows: [{ next_n: 4 }] };
      if (sql.includes("RETURNING id")) return { rows: [{ id: "plan-v4" }] };
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const poolQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ planId: "plan-1", plan: { id: "plan-1" } }] })
      .mockResolvedValueOnce({ rows: [{ pillar: { id: "pillar-1" } }] })
      .mockResolvedValueOnce({ rows: [{ post: { id: "post-1" } }] });
    const pool = {
      query: poolQuery,
      connect: vi.fn(async () => ({ query: transactionQuery, release })),
    };

    await expect(snapshotPlanVersion(pool as never, {
      projectId: "project-1",
      generatedByUserId: "user-1",
    })).resolves.toEqual({ versionId: "plan-v4", versionNumber: 4 });

    const sql = transactionQuery.mock.calls.map(sqlOf);
    expect(sql[0]).toBe("BEGIN");
    expect(sql[1]).toContain("pg_advisory_xact_lock");
    expect(sql[2]).toContain("MAX(version_number)");
    expect(sql.indexOf("COMMIT")).toBeGreaterThan(sql.findIndex((q) => q.includes("INSERT INTO")));
    expect(poolQuery).toHaveBeenCalledTimes(3);
    expect(release).toHaveBeenCalledOnce();
  });
});
