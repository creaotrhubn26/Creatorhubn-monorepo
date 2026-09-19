import { describe, expect, it, vi } from "vitest";

import {
  resolveCastingProjectAccess,
  userCanAccessCastingProject,
  userCanCommentCastingContinuity,
  userCanCoordinateCastingProduction,
  userCanEditCasting,
  userCanEditCastingProduction,
  userCanManageCastingLocations,
  userCanManageCastingContinuity,
  userCanManageCastingProduction,
} from "./casting-project-ownership.js";

/**
 * Canonical project with one membership row. The grant rules live in
 * TypeScript now, so these tests state who may do what rather than asserting
 * the shape of a SQL predicate.
 */
const canonicalMember = (
  role: string | null,
  permissions: Record<string, unknown> | null = null,
  { isOwner = false, additionalRoles = null }: {
    isOwner?: boolean;
    additionalRoles?: string[] | null;
  } = {},
) => vi.fn(async (text: string) => {
  if (text.includes("FROM casting_projects cp")) {
    return {
      rows: [{
        project_exists: true,
        is_owner: isOwner,
        member_role: role,
        member_permissions: permissions,
        member_additional_roles: additionalRoles,
      }],
    };
  }
  return { rows: [] };
});

const legacyOnly = (owner: string | null) => vi.fn(async (text: string) => {
  if (text.includes("FROM casting_projects cp")) {
    return {
      rows: [{
        project_exists: false,
        is_owner: false,
        member_role: null,
        member_permissions: null,
      }],
    };
  }
  return { rows: owner ? [{ store_value: { created_by: owner } }] : [] };
});

describe("resolveCastingProjectAccess", () => {
  it("answers every grant from one query", async () => {
    const query = canonicalMember("production_manager");

    const access = await resolveCastingProjectAccess({ query }, "project-1", "pm-1");

    expect(query).toHaveBeenCalledTimes(1);
    expect(access.role).toBe("production_manager");
    expect(access.isMember).toBe(true);
    expect(access.canAccess).toBe(true);
    expect(access.grants).toEqual({
      canEditCasting: false,
      canEditProduction: true,
      canManageProduction: true,
      canCoordinateProduction: true,
      canManageLocations: true,
      canManageContinuity: false,
      canCommentContinuity: false,
    });
  });

  it("filters deactivated and expired membership rows in the query", async () => {
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      expect(text).toContain("cur.deactivated_at IS NULL");
      expect(text).toContain("cur.expires_at IS NULL OR cur.expires_at > NOW()");
      expect(params).toEqual(["project-1", "user-1"]);
      return {
        rows: [{
          project_exists: true,
          is_owner: false,
          member_role: null,
          member_permissions: null,
        }],
      };
    });

    const access = await resolveCastingProjectAccess({ query }, "project-1", "user-1");

    expect(access.isMember).toBe(false);
    expect(access.canAccess).toBe(false);
  });

  it("gives the project creator every grant without a membership row", async () => {
    const query = canonicalMember(null, null, { isOwner: true });

    const access = await resolveCastingProjectAccess({ query }, "project-1", "owner-1");

    expect(access.isOwner).toBe(true);
    expect(access.role).toBeNull();
    expect(Object.values(access.grants).every(Boolean)).toBe(true);
  });

  it("ignores a permissions column that is not an object", async () => {
    const query = canonicalMember("grip", "not-json" as never);

    const access = await resolveCastingProjectAccess({ query }, "project-1", "grip-1");

    expect(access.permissions).toEqual({});
    expect(Object.values(access.grants).some(Boolean)).toBe(false);
  });

  it("denies everything without a project id or user id", async () => {
    const query = vi.fn(async () => ({ rows: [] }));

    await expect(resolveCastingProjectAccess({ query }, "", "user-1"))
      .resolves.toMatchObject({ canAccess: false });
    await expect(resolveCastingProjectAccess({ query }, "project-1", null))
      .resolves.toMatchObject({ canAccess: false });
    expect(query).not.toHaveBeenCalled();
  });

  it("stays fail-closed when the canonical query throws and no legacy owner matches", async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes("FROM casting_projects cp")) throw new Error("relation missing");
      return { rows: [] };
    });

    const access = await resolveCastingProjectAccess({ query }, "project-1", "user-1");

    expect(access.canAccess).toBe(false);
    expect(Object.values(access.grants).some(Boolean)).toBe(false);
  });
});

describe("userCanEditCasting", () => {
  it("allows dedicated casting roles without granting production writes", async () => {
    for (const role of ["casting_director", "local_casting_director", "extras_casting_director"]) {
      await expect(userCanEditCasting(
        { query: canonicalMember(role) }, "project-1", `${role}-1`,
      )).resolves.toBe(true);
      await expect(userCanEditCastingProduction(
        { query: canonicalMember(role) }, "project-1", `${role}-1`,
      )).resolves.toBe(false);
    }
  });

  it("unions casting access across additional roles", async () => {
    const query = canonicalMember("viewer", null, { additionalRoles: ["casting_director"] });

    await expect(userCanEditCasting({ query }, "project-1", "casting-1"))
      .resolves.toBe(true);
  });

  it("accepts an explicit casting grant and denies ordinary viewers", async () => {
    await expect(userCanEditCasting(
      { query: canonicalMember("viewer", { canEditCasting: true }) }, "project-1", "viewer-1",
    )).resolves.toBe(true);
    await expect(userCanEditCasting(
      { query: canonicalMember("viewer") }, "project-1", "viewer-1",
    )).resolves.toBe(false);
  });
});

describe("userCanAccessCastingProject", () => {
  it("accepts canonical owners and project-role members", async () => {
    await expect(userCanAccessCastingProject(
      { query: canonicalMember(null, null, { isOwner: true }) }, "project-1", "owner-1",
    )).resolves.toBe(true);

    await expect(userCanAccessCastingProject(
      { query: canonicalMember("viewer") }, "project-1", "viewer-1",
    )).resolves.toBe(true);
  });

  it("denies a user with no membership row", async () => {
    await expect(userCanAccessCastingProject(
      { query: canonicalMember(null) }, "project-1", "stranger-1",
    )).resolves.toBe(false);
  });

  it("falls back to the strict compat owner for legacy-only projects", async () => {
    const query = legacyOnly("user-1");

    await expect(userCanAccessCastingProject({ query }, "legacy-1", "user-1"))
      .resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("never falls back to stale legacy ownership for a canonical project", async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes("FROM casting_projects cp")) {
        return {
          rows: [{
            project_exists: true,
            is_owner: false,
            member_role: null,
            member_permissions: null,
          }],
        };
      }
      return { rows: [{ store_value: { created_by: "user-1" } }] };
    });

    await expect(userCanAccessCastingProject({ query }, "project-1", "user-1"))
      .resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("never accepts the placeholder demo owner", async () => {
    await expect(userCanAccessCastingProject(
      { query: legacyOnly("demo-user") }, "legacy-1", "demo-user",
    )).resolves.toBe(false);
  });
});

describe("userCanEditCastingProduction", () => {
  it("accepts an active 1st AD production grant", async () => {
    await expect(userCanEditCastingProduction(
      { query: canonicalMember("first_ad") }, "project-1", "first-ad-1",
    )).resolves.toBe(true);

    await expect(userCanEditCastingProduction(
      { query: canonicalMember("second_ad") }, "project-1", "second-ad-1",
    )).resolves.toBe(true);
  });

  it("accepts an explicit grant on a role that does not carry it by default", async () => {
    await expect(userCanEditCastingProduction(
      { query: canonicalMember("grip", { canEditProduction: true }) }, "project-1", "grip-1",
    )).resolves.toBe(true);
  });

  it("denies a canonical project member without production write access", async () => {
    const query = canonicalMember("viewer");

    await expect(userCanEditCastingProduction({ query }, "project-1", "viewer-1"))
      .resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("keeps legacy-only projects owner-only", async () => {
    const query = legacyOnly("owner-1");

    await expect(userCanEditCastingProduction({ query }, "legacy-1", "owner-1"))
      .resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(2);

    await expect(userCanEditCastingProduction(
      { query: legacyOnly("someone-else") }, "legacy-1", "intruder-1",
    )).resolves.toBe(false);
  });
});

describe("userCanManageCastingProduction", () => {
  it("limits the management lane to owners, producer roles and an explicit grant", async () => {
    await expect(userCanManageCastingProduction(
      { query: canonicalMember("production_manager") }, "project-1", "manager-1",
    )).resolves.toBe(true);

    await expect(userCanManageCastingProduction(
      { query: canonicalMember("producer") }, "project-1", "producer-1",
    )).resolves.toBe(true);

    await expect(userCanManageCastingProduction(
      { query: canonicalMember("grip", { canManageProduction: true }) }, "project-1", "grip-1",
    )).resolves.toBe(true);
  });

  it("denies canonical production editors without management authority", async () => {
    for (const role of ["first_ad", "second_ad", "production_coordinator", "director"]) {
      await expect(userCanManageCastingProduction(
        { query: canonicalMember(role) }, "project-1", `${role}-1`,
      )).resolves.toBe(false);
    }
  });
});

describe("userCanCoordinateCastingProduction", () => {
  it("allows coordinators, PMs, producers and explicit coordination grants only", async () => {
    for (const role of ["production_coordinator", "production_manager", "producer"]) {
      await expect(userCanCoordinateCastingProduction(
        { query: canonicalMember(role) }, "project-1", `${role}-1`,
      )).resolves.toBe(true);
    }

    await expect(userCanCoordinateCastingProduction(
      { query: canonicalMember("grip", { canCoordinateProduction: true }) }, "project-1", "grip-1",
    )).resolves.toBe(true);

    await expect(userCanCoordinateCastingProduction(
      { query: canonicalMember("first_ad") }, "project-1", "first-ad-1",
    )).resolves.toBe(false);
  });
});

describe("userCanManageCastingLocations", () => {
  it("allows location managers, scouts and explicit grants without granting location security writes", async () => {
    for (const role of ["location_manager", "location_scout", "producer", "production_manager"]) {
      await expect(userCanManageCastingLocations(
        { query: canonicalMember(role) }, "project-1", `${role}-1`,
      )).resolves.toBe(true);
    }

    await expect(userCanManageCastingLocations(
      { query: canonicalMember("location_security") }, "project-1", "security-1",
    )).resolves.toBe(false);
  });
});

describe("continuity ownership", () => {
  it("limits the canonical continuity lane to script supervisors or an explicit grant", async () => {
    await expect(userCanManageCastingContinuity(
      { query: canonicalMember("script_supervisor") }, "project-1", "script-supervisor-1",
    )).resolves.toBe(true);

    await expect(userCanManageCastingContinuity(
      { query: canonicalMember("grip", { canManageContinuity: true }) }, "project-1", "grip-1",
    )).resolves.toBe(true);

    for (const role of ["production_manager", "director", "first_ad"]) {
      await expect(userCanManageCastingContinuity(
        { query: canonicalMember(role) }, "project-1", `${role}-1`,
      )).resolves.toBe(false);
    }
  });

  it("lets directors and ADs comment without granting continuity management", async () => {
    for (const role of ["director", "first_ad", "second_ad", "producer"]) {
      await expect(userCanCommentCastingContinuity(
        { query: canonicalMember(role) }, "project-1", `${role}-1`,
      )).resolves.toBe(true);
      await expect(userCanManageCastingContinuity(
        { query: canonicalMember(role) }, "project-1", `${role}-1`,
      )).resolves.toBe(false);
    }
  });

  it("accepts a plain comment grant for commenting only", async () => {
    await expect(userCanCommentCastingContinuity(
      { query: canonicalMember("grip", { canComment: true }) }, "project-1", "grip-1",
    )).resolves.toBe(true);

    await expect(userCanManageCastingContinuity(
      { query: canonicalMember("grip", { canComment: true }) }, "project-1", "grip-1",
    )).resolves.toBe(false);
  });

  it("denies a crew member with no continuity relationship", async () => {
    await expect(userCanCommentCastingContinuity(
      { query: canonicalMember("grip") }, "project-1", "grip-1",
    )).resolves.toBe(false);
  });
});

describe("several project roles on one membership", () => {
  it("unions grants across the primary and additional roles", async () => {
    const query = canonicalMember("director", null, { additionalRoles: ["producer"] });

    const access = await resolveCastingProjectAccess({ query }, "project-1", "user-1");

    expect(access.role).toBe("director");
    expect(access.roles).toEqual(["director", "producer"]);
    // director alone never carried the management lane; producer does.
    expect(access.grants.canManageProduction).toBe(true);
    expect(access.grants.canEditProduction).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("leaves a single-role member unchanged", async () => {
    const access = await resolveCastingProjectAccess(
      { query: canonicalMember("director") }, "project-1", "user-1",
    );

    expect(access.roles).toEqual(["director"]);
    expect(access.grants.canManageProduction).toBe(false);
  });

  it("normalises and dedupes stored role values", async () => {
    const access = await resolveCastingProjectAccess(
      { query: canonicalMember("director", null, {
        additionalRoles: ["  PRODUCER ", "director", "", "location_scout"],
      }) },
      "project-1",
      "user-1",
    );

    expect(access.roles).toEqual(["director", "producer", "location_scout"]);
  });

  it("ignores additional roles when the membership itself is gone", async () => {
    const access = await resolveCastingProjectAccess(
      { query: canonicalMember(null, null, { additionalRoles: ["producer"] }) },
      "project-1",
      "user-1",
    );

    expect(access.isMember).toBe(false);
    expect(access.canAccess).toBe(false);
    expect(access.grants.canManageProduction).toBe(false);
  });

  it("survives a database that has not run the migration yet", async () => {
    const query = vi.fn(async () => ({
      rows: [{
        project_exists: true,
        is_owner: false,
        member_role: "producer",
        member_permissions: null,
      }],
    }));

    const access = await resolveCastingProjectAccess({ query }, "project-1", "user-1");

    expect(access.roles).toEqual(["producer"]);
    expect(access.grants.canManageProduction).toBe(true);
  });
});
