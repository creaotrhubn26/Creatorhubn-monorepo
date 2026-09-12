import { describe, expect, it, vi } from "vitest";

import {
  isModuleFeatureEnabled,
  resolveModuleFeatureState,
} from "./module-entitlement-resolver.js";

function mockPool(rowsByQuery: Array<Record<string, unknown> | null>) {
  const query = vi.fn();
  rowsByQuery.forEach((row) => {
    query.mockImplementationOnce(async () => ({ rows: row ? [row] : [] }));
  });
  return { query } as unknown as import("pg").Pool;
}

describe("resolveModuleFeatureState", () => {
  it("returns the caller default when no override row exists", async () => {
    const pool = mockPool([null]); // org-level lookup (no workspaceId given)
    const state = await resolveModuleFeatureState(pool, {
      organizationId: "org-1",
      moduleKey: "market_intelligence",
      featureKey: "core",
      defaultState: "included",
    });
    expect(state).toBe("included");
  });

  it("defaults to 'locked' when no defaultState is supplied", async () => {
    const pool = mockPool([null]);
    const state = await resolveModuleFeatureState(pool, {
      organizationId: "org-1",
      moduleKey: "leadgrid",
      featureKey: "route_planning",
    });
    expect(state).toBe("locked");
  });

  it("prefers a workspace-level override over the org-level row", async () => {
    const pool = mockPool([{ state: "included", trial_ends_at: null }]);
    const state = await resolveModuleFeatureState(pool, {
      organizationId: "org-1",
      workspaceId: "ws-1",
      moduleKey: "leadgrid",
      featureKey: "territory_management",
      defaultState: "locked",
    });
    expect(state).toBe("included");
  });

  it("falls back to the org-level row when no workspace override exists", async () => {
    const pool = mockPool([null, { state: "add_on", trial_ends_at: null }]);
    const state = await resolveModuleFeatureState(pool, {
      organizationId: "org-1",
      workspaceId: "ws-1",
      moduleKey: "leadgrid",
      featureKey: "route_planning",
      defaultState: "locked",
    });
    expect(state).toBe("add_on");
  });

  it("treats an expired trial as locked", async () => {
    const pool = mockPool([
      { state: "trial", trial_ends_at: "2000-01-01T00:00:00.000Z" },
    ]);
    const state = await resolveModuleFeatureState(pool, {
      organizationId: "org-1",
      moduleKey: "market_intelligence",
      featureKey: "ai_recommendations",
    });
    expect(state).toBe("locked");
  });

  it("treats an active trial as trial", async () => {
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const pool = mockPool([{ state: "trial", trial_ends_at: farFuture }]);
    const state = await resolveModuleFeatureState(pool, {
      organizationId: "org-1",
      moduleKey: "market_intelligence",
      featureKey: "ai_recommendations",
    });
    expect(state).toBe("trial");
  });

  it("falls back to the default when the table doesn't exist yet (pre-migration)", async () => {
    const query = vi.fn().mockRejectedValueOnce(new Error('relation "module_feature_entitlements" does not exist'));
    const pool = { query } as unknown as import("pg").Pool;
    const state = await resolveModuleFeatureState(pool, {
      organizationId: "org-1",
      moduleKey: "market_intelligence",
      featureKey: "core",
      defaultState: "included",
    });
    expect(state).toBe("included");
  });
});

describe("isModuleFeatureEnabled", () => {
  it("is true for 'included'", async () => {
    const pool = mockPool([{ state: "included", trial_ends_at: null }]);
    expect(
      await isModuleFeatureEnabled(pool, {
        organizationId: "org-1",
        moduleKey: "leadgrid",
        featureKey: "core",
      }),
    ).toBe(true);
  });

  it("is false for 'locked'", async () => {
    const pool = mockPool([{ state: "locked", trial_ends_at: null }]);
    expect(
      await isModuleFeatureEnabled(pool, {
        organizationId: "org-1",
        moduleKey: "leadgrid",
        featureKey: "core",
      }),
    ).toBe(false);
  });

  it("is false for 'add_on' (must be explicitly purchased/included)", async () => {
    const pool = mockPool([{ state: "add_on", trial_ends_at: null }]);
    expect(
      await isModuleFeatureEnabled(pool, {
        organizationId: "org-1",
        moduleKey: "leadgrid",
        featureKey: "route_planning",
      }),
    ).toBe(false);
  });
});
