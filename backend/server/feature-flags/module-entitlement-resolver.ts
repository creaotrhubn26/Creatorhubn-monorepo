/**
 * module-entitlement-resolver.ts
 *
 * Domain-agnostic feature-entitlement resolver, generalizing the pattern
 * proven by leadgrid-org-resolver.ts + leadgrid_org_entitlements (0370) so
 * any module (market_intelligence, leadgrid, future modules) can gate a
 * feature per organization/workspace/environment without a module-private
 * copy of this logic.
 *
 * Resolution order (cheapest/most-specific wins):
 *   1. workspace-level override (module_feature_entitlements, workspace_id set)
 *   2. organization-level override (module_feature_entitlements, workspace_id NULL)
 *   3. caller-supplied default (a code constant — e.g. features.marketIntelligence)
 *
 * No row for a (organization, module, feature, environment) combination means
 * "no override" — the caller's default applies. This mirrors 0370's
 * backward-compatible design: rolling this table out never changes existing
 * behavior until an admin explicitly sets an override.
 *
 * leadgrid_org_entitlements is NOT read or written here — Leadgrid keeps using
 * its existing table until the consolidation step in
 * docs/cto-audit/11-migration-plan.md (step 7) is scheduled.
 */

import type { Pool } from "pg";

export type EntitlementState = "included" | "trial" | "add_on" | "locked";
export type Environment = "production" | "staging" | "development";

export interface ResolveModuleFeatureStateParams {
  organizationId: string;
  workspaceId?: string | null;
  moduleKey: string;
  featureKey: string;
  environment?: Environment;
  /** Code-level default applied when no entitlement row overrides it. */
  defaultState?: EntitlementState;
}

interface EntitlementRow {
  state: EntitlementState;
  trial_ends_at: string | null;
}

async function findOverride(
  pool: Pool,
  params: Required<Pick<ResolveModuleFeatureStateParams, "organizationId" | "moduleKey" | "featureKey">> & {
    workspaceId: string | null;
    environment: Environment;
  },
): Promise<EntitlementRow | null> {
  const { organizationId, workspaceId, moduleKey, featureKey, environment } = params;

  if (workspaceId) {
    const workspaceRow = await pool.query<EntitlementRow>(
      `SELECT state, trial_ends_at FROM module_feature_entitlements
        WHERE organization_id = $1 AND workspace_id = $2
          AND module_key = $3 AND feature_key = $4 AND environment = $5`,
      [organizationId, workspaceId, moduleKey, featureKey, environment],
    );
    if (workspaceRow.rows[0]) return workspaceRow.rows[0];
  }

  const orgRow = await pool.query<EntitlementRow>(
    `SELECT state, trial_ends_at FROM module_feature_entitlements
      WHERE organization_id = $1 AND workspace_id IS NULL
        AND module_key = $2 AND feature_key = $3 AND environment = $4`,
    [organizationId, moduleKey, featureKey, environment],
  );
  return orgRow.rows[0] ?? null;
}

/**
 * Resolves the entitlement state for a module feature. Falls back to
 * `defaultState` (default: 'locked') on missing rows or if the table doesn't
 * exist yet in an environment that hasn't run migration 0375.
 */
export async function resolveModuleFeatureState(
  pool: Pool,
  params: ResolveModuleFeatureStateParams,
): Promise<EntitlementState> {
  const {
    organizationId,
    workspaceId = null,
    moduleKey,
    featureKey,
    environment = "production",
    defaultState = "locked",
  } = params;

  try {
    const override = await findOverride(pool, {
      organizationId,
      workspaceId,
      moduleKey,
      featureKey,
      environment,
    });
    if (!override) return defaultState;

    if (override.state === "trial" && override.trial_ends_at) {
      const trialExpired = new Date(override.trial_ends_at).getTime() < Date.now();
      return trialExpired ? "locked" : "trial";
    }
    return override.state;
  } catch {
    // Table missing (pre-migration environment) or transient DB error —
    // never let entitlement lookup crash the caller; fall back to default.
    return defaultState;
  }
}

/**
 * Convenience boolean check: true when the resolved state is 'included' or an
 * active (non-expired) 'trial'.
 */
export async function isModuleFeatureEnabled(
  pool: Pool,
  params: ResolveModuleFeatureStateParams,
): Promise<boolean> {
  const state = await resolveModuleFeatureState(pool, params);
  return state === "included" || state === "trial";
}
