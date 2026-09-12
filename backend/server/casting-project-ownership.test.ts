import { describe, expect, it, vi } from "vitest";

import {
  userCanAccessCastingProject,
  userCanCoordinateCastingProduction,
  userCanEditCastingProduction,
  userCanManageCastingProduction,
} from "./casting-project-ownership.js";

describe("userCanAccessCastingProject", () => {
  it("accepts canonical owners and project-role members", async () => {
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      expect(text).toContain("FROM casting_projects cp");
      expect(text).toContain("FROM casting_user_roles cur");
      expect(text).toContain("cur.deactivated_at IS NULL");
      expect(text).toContain("cur.expires_at IS NULL OR cur.expires_at > NOW()");
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

describe("userCanCoordinateCastingProduction", () => {
  it("allows coordinators, PMs, producers and explicit coordination grants only", async () => {
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      expect(text).toContain("'production_coordinator'");
      expect(text).toContain("'production_manager'");
      expect(text).toContain("'producer'");
      expect(text).toContain("canCoordinateProduction");
      expect(text).not.toContain("'first_ad'");
      expect(text).not.toContain("canManageProduction");
      expect(params).toEqual(["project-1", "coordinator-1"]);
      return { rows: [{ project_exists: true, can_coordinate_production: true }] };
    });

    await expect(userCanCoordinateCastingProduction(
      { query },
      "project-1",
      "coordinator-1",
    )).resolves.toBe(true);
  });
});

describe("userCanEditCastingProduction", () => {
  it("accepts an active 1st AD production grant", async () => {
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      expect(text).toContain("'first_ad'");
      expect(text).toContain("'second_ad'");
      expect(text).toContain("canEditProduction");
      expect(text).toContain("cur.deactivated_at IS NULL");
      expect(text).toContain("cur.expires_at IS NULL OR cur.expires_at > NOW()");
      expect(params).toEqual(["project-1", "first-ad-1"]);
      return { rows: [{ project_exists: true, can_edit_production: true }] };
    });

    await expect(userCanEditCastingProduction(
      { query },
      "project-1",
      "first-ad-1",
    )).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("denies a canonical project member without production write access", async () => {
    const query = vi.fn(async () => ({
      rows: [{ project_exists: true, can_edit_production: false }],
    }));

    await expect(userCanEditCastingProduction(
      { query },
      "project-1",
      "viewer-1",
    )).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("keeps legacy-only projects owner-only", async () => {
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      if (text.includes("FROM casting_projects cp")) {
        return { rows: [{ project_exists: false, can_edit_production: false }] };
      }
      expect(text).toContain("legacy_compat_store");
      expect(params).toEqual(["casting:project:legacy-1"]);
      return { rows: [{ store_value: { created_by: "owner-1" } }] };
    });

    await expect(userCanEditCastingProduction(
      { query },
      "legacy-1",
      "owner-1",
    )).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe("userCanManageCastingProduction", () => {
  it("limits the management lane to owners, producer roles and an explicit grant", async () => {
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      expect(text).toContain("'production_manager'");
      expect(text).toContain("'producer'");
      expect(text).toContain("canManageProduction");
      expect(text).not.toContain("'first_ad'");
      expect(text).not.toContain("'second_ad'");
      expect(text).not.toContain("'production_coordinator'");
      expect(params).toEqual(["project-1", "manager-1"]);
      return { rows: [{ project_exists: true, can_manage_production: true }] };
    });

    await expect(userCanManageCastingProduction(
      { query },
      "project-1",
      "manager-1",
    )).resolves.toBe(true);
  });

  it("denies canonical production editors without management authority", async () => {
    const query = vi.fn(async () => ({
      rows: [{ project_exists: true, can_manage_production: false }],
    }));

    await expect(userCanManageCastingProduction(
      { query },
      "project-1",
      "first-ad-1",
    )).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
