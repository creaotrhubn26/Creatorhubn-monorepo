import { describe, expect, it, vi } from "vitest";

import { userCanAccessCastingProject } from "./casting-project-ownership.js";

describe("userCanAccessCastingProject", () => {
  it("accepts canonical owners and project-role members", async () => {
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      expect(text).toContain("FROM casting_projects cp");
      expect(text).toContain("FROM casting_user_roles cur");
      expect(params).toEqual(["project-1", "user-1"]);
      return { rows: [{ project_exists: true, can_access: true }] };
    });

    await expect(userCanAccessCastingProject(
      { query },
      "project-1",
      "user-1",
    )).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("falls back to the strict compat owner for legacy-only projects", async () => {
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      if (text.includes("FROM casting_projects cp")) {
        return { rows: [{ project_exists: false, can_access: false }] };
      }
      expect(text).toContain("legacy_compat_store");
      expect(params).toEqual(["casting:project:legacy-1"]);
      return { rows: [{ store_value: { created_by: "user-1" } }] };
    });

    await expect(userCanAccessCastingProject(
      { query },
      "legacy-1",
      "user-1",
    )).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("never falls back to stale legacy ownership for a canonical project", async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes("FROM casting_projects cp")) {
        return { rows: [{ project_exists: true, can_access: false }] };
      }
      return { rows: [{ store_value: { created_by: "user-1" } }] };
    });

    await expect(userCanAccessCastingProject(
      { query },
      "project-1",
      "user-1",
    )).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
