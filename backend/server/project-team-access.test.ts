import { describe, expect, it } from "vitest";
import { canAccessProject, canEditProject, getProjectAccess } from "./project-team-routes";

function accessPool(options: {
  owner?: boolean;
  role?: string;
  permissions?: Record<string, boolean> | string;
}) {
  return {
    query: async (sql: string) => {
      if (sql.includes("SELECT 1 WHERE EXISTS")) {
        return { rows: options.owner ? [{ ok: 1 }] : [], rowCount: options.owner ? 1 : 0 };
      }
      if (sql.includes("SELECT role, permissions")) {
        if (!options.role) return { rows: [], rowCount: 0 };
        return {
          rows: [{ role: options.role, permissions: options.permissions }],
          rowCount: 1,
        };
      }
      // Runtime schema bootstrap queries.
      return { rows: [], rowCount: 0 };
    },
  };
}

describe("Team Workspace project access", () => {
  it("gives project owners read and edit access", async () => {
    const access = await getProjectAccess(accessPool({ owner: true }), "owner", "project");
    expect(access).toEqual({ canRead: true, canEdit: true, isOwner: true });
  });

  it("keeps active viewers read-only even if malformed permissions claim edit", async () => {
    const pool = accessPool({
      role: "viewer",
      permissions: { canRead: true, canEdit: true },
    });
    await expect(canAccessProject(pool, "viewer", "project")).resolves.toBe(true);
    await expect(canEditProject(pool, "viewer", "project")).resolves.toBe(false);
  });

  it("allows active editors only when permissions.canEdit is true", async () => {
    const editor = accessPool({
      role: "member",
      permissions: { canRead: true, canEdit: true },
    });
    const readOnlyMember = accessPool({
      role: "member",
      permissions: { canRead: true, canEdit: false },
    });
    await expect(canEditProject(editor, "editor", "project")).resolves.toBe(true);
    await expect(canEditProject(readOnlyMember, "member", "project")).resolves.toBe(false);
  });

  it("fails closed for denied reads, invalid JSON and database errors", async () => {
    const denied = accessPool({ role: "member", permissions: { canRead: false, canEdit: true } });
    const invalid = accessPool({ role: "member", permissions: "not-json" });
    const broken = { query: async () => { throw new Error("db down"); } };

    await expect(getProjectAccess(denied, "member", "project")).resolves.toEqual({
      canRead: false, canEdit: false, isOwner: false,
    });
    await expect(canEditProject(invalid, "member", "project")).resolves.toBe(false);
    await expect(canAccessProject(broken, "member", "project")).resolves.toBe(false);
  });
});
