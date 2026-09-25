import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { getCanvasAuthorization } from "./leadgrid-canvas-authorization.js";

function authorizationPool(options: {
  globalRole?: string | null;
  orgRole?: string | null;
  enterpriseRole?: string | null;
  hidden?: string[];
  failOn?: "users" | "organization_members" | "enterprise_team_members" | "policy";
  failureCode?: string;
}) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const query = vi.fn(async (sqlValue: string, values: unknown[] = []) => {
    const sql = String(sqlValue);
    calls.push({ sql, values });
    const fail = (source: NonNullable<typeof options.failOn>) => {
      if (options.failOn !== source) return;
      throw Object.assign(new Error(`${source} unavailable`), {
        code: options.failureCode ?? "42501",
      });
    };
    if (sql.includes("FROM users")) {
      fail("users");
      return { rows: options.globalRole ? [{ role: options.globalRole }] : [] };
    }
    if (sql.includes("FROM organization_members")) {
      fail("organization_members");
      return { rows: options.orgRole ? [{ role: options.orgRole }] : [] };
    }
    if (sql.includes("FROM enterprise_team_members")) {
      fail("enterprise_team_members");
      return {
        rows: options.enterpriseRole ? [{ role: options.enterpriseRole }] : [],
      };
    }
    if (sql.includes("FROM leadgrid_canvas_policy")) {
      fail("policy");
      return { rows: [{ skjulte_funksjoner: options.hidden ?? [] }] };
    }
    return { rows: [] };
  });
  return { pool: { query } as unknown as Pool, calls };
}

describe("Canvas organization-scoped authorization", () => {
  it("never uses a role membership without the resolved organization", async () => {
    const { pool, calls } = authorizationPool({ orgRole: "viewer" });
    const decision = await getCanvasAuthorization(pool, "user-a", "org-a");

    expect(decision.canWrite).toBe(false);
    const membershipCalls = calls.filter(
      (call) =>
        call.sql.includes("organization_members") ||
        call.sql.includes("enterprise_team_members"),
    );
    expect(membershipCalls).toHaveLength(2);
    for (const call of membershipCalls) {
      expect(call.sql).toContain("organization_id::text = $1");
      expect(call.sql).toContain("user_id::text = $2");
      expect(call.values).toEqual(["org-a", "user-a"]);
    }
  });

  it("applies the seller policy without turning a member into a viewer", async () => {
    const { pool } = authorizationPool({
      orgRole: "member",
      hidden: ["deling", "pdf", "tidsreise"],
    });
    const decision = await getCanvasAuthorization(pool, "user-a", "org-a");
    expect(decision).toEqual(
      expect.objectContaining({
        roleGroup: "selger",
        canWrite: true,
        canShare: false,
        canUploadPdf: false,
        canRestoreHistory: false,
      }),
    );
  });

  it("lets an org admin bypass subordinate feature hiding", async () => {
    const { pool } = authorizationPool({
      orgRole: "admin",
      hidden: ["deling", "pdf"],
    });
    const decision = await getCanvasAuthorization(pool, "user-a", "org-a");
    expect(decision).toEqual(
      expect.objectContaining({
        roleGroup: "admin",
        canWrite: true,
        canShare: true,
        canUploadPdf: true,
      }),
    );
  });

  it("fails closed when a role or policy query is indeterminate", async () => {
    await expect(getCanvasAuthorization(
      authorizationPool({ failOn: "organization_members" }).pool,
      "user-a",
      "org-a",
    )).rejects.toThrow("organization_members unavailable");

    await expect(getCanvasAuthorization(
      authorizationPool({ orgRole: "member", failOn: "policy" }).pool,
      "user-a",
      "org-a",
    )).rejects.toThrow("policy unavailable");
  });

  it("keeps the explicitly absent legacy membership table compatible", async () => {
    const decision = await getCanvasAuthorization(
      authorizationPool({
        failOn: "organization_members",
        failureCode: "42P01",
        enterpriseRole: "viewer",
      }).pool,
      "user-a",
      "org-a",
    );
    expect(decision.canWrite).toBe(false);
  });
});
