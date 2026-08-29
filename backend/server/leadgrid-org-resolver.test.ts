import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  invalidateOrgCache,
  resolveOrgIdForUser,
} from "./leadgrid-org-resolver.js";

function poolFor(input: {
  override?: string | null;
  enterprise?: string | null;
  membership?: string | null;
  failOn?: "override" | "enterprise" | "membership";
}) {
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("leadgrid_org_overrides")) {
      if (input.failOn === "override") {
        throw Object.assign(new Error("query cancelled"), { code: "57014" });
      }
      return { rows: input.override === undefined ? [] : [{ override_org_id: input.override }] };
    }
    if (sql.includes("enterprise_team_members")) {
      if (input.failOn === "enterprise") {
        throw Object.assign(new Error("permission denied"), { code: "42501" });
      }
      return { rows: input.enterprise ? [{ organization_id: input.enterprise }] : [] };
    }
    if (sql.includes("organization_members")) {
      if (input.failOn === "membership") {
        throw Object.assign(new Error("query cancelled"), { code: "57014" });
      }
      return { rows: input.membership ? [{ organization_id: input.membership }] : [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  return { pool: { query } as unknown as Pool, query };
}

describe("Leadgrid canonical organization resolution", () => {
  it("preserves an explicit override before all memberships", async () => {
    const userId = "override-user";
    invalidateOrgCache(userId);
    const context = poolFor({
      override: "org-override",
      enterprise: "org-enterprise",
      membership: "org-native",
    });
    await expect(resolveOrgIdForUser(context.pool, userId))
      .resolves.toBe("org-override");
    expect(context.query).toHaveBeenCalledTimes(1);
  });

  it("preserves enterprise precedence over native membership", async () => {
    const userId = "enterprise-user";
    invalidateOrgCache(userId);
    const context = poolFor({
      enterprise: "org-enterprise",
      membership: "org-native",
    });
    await expect(resolveOrgIdForUser(context.pool, userId))
      .resolves.toBe("org-enterprise");
    expect(context.query.mock.calls.some(([sql]) =>
      String(sql).includes("organization_members"),
    )).toBe(false);
  });

  it("uses organization_members for a normal native Google user", async () => {
    const userId = "native-user";
    invalidateOrgCache(userId);
    const context = poolFor({ membership: "org-native" });
    await expect(resolveOrgIdForUser(context.pool, userId))
      .resolves.toBe("org-native");
    expect(context.query).toHaveBeenCalledWith(
      expect.stringMatching(/FROM organization_members[\s\S]*ORDER BY joined_at DESC/),
      [userId],
    );
  });

  it("keeps the legacy user-id fallback when no membership exists", async () => {
    const userId = "solo-user";
    invalidateOrgCache(userId);
    const context = poolFor({});
    await expect(resolveOrgIdForUser(context.pool, userId))
      .resolves.toBe(userId);
  });

  it.each(["override", "enterprise", "membership"] as const)(
    "fails closed when the %s query fails for a non-schema reason",
    async (failOn) => {
      const userId = `failed-${failOn}`;
      invalidateOrgCache(userId);
      const context = poolFor({ failOn });
      await expect(resolveOrgIdForUser(context.pool, userId))
        .rejects.toMatchObject({ code: expect.stringMatching(/^(57014|42501)$/) });
    },
  );
});
