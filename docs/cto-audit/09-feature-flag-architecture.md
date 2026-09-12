# 9. Feature Flag Architecture

## Two existing systems, one to standardize on

1. **Generic flat flags** — `GET /api/admin/features`,
   `useFeatureFlag`/`useFeatureFlags` hooks. Shape: `{ id, isEnabled }` — no
   org/workspace/role/environment layering. Fine for global kill-switches, not
   sufficient for "activate Leadgrid for org X, trial for org Y" (request §10).
2. **Leadgrid's org entitlements** — `leadgrid_org_entitlements`
   `(organization_id, feature_key) → state ∈ {included, trial, add_on, locked}`,
   with `monthly_limit`/`trial_ends_at`/`addon_price_monthly`. This already
   satisfies most of request §10's per-level requirement at the org layer, and is
   the shape to generalize — not replace.

## Proposed: `module_feature_entitlements` (generalized, shipped in this PR)

```sql
CREATE TABLE module_feature_entitlements (
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id        UUID,                 -- nullable: NULL = org-wide
  module_key          VARCHAR(80) NOT NULL, -- 'market_intelligence' | 'leadgrid' | ...
  feature_key         VARCHAR(80) NOT NULL, -- 'route_planning' | 'ai_recommendations' | ...
  state               VARCHAR(16) NOT NULL CHECK (state IN ('included','trial','add_on','locked')),
  monthly_limit       INTEGER,
  trial_ends_at       TIMESTAMPTZ,
  environment         VARCHAR(20) NOT NULL DEFAULT 'production'
                      CHECK (environment IN ('production','staging','development')),
  updated_by          VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, module_key, feature_key, environment)
);
```

Same no-row-means-default-applies backward-compatibility property as
`leadgrid_org_entitlements`. `leadgrid_org_entitlements` itself is **not** migrated
or dropped in this PR — that's a P2 data-migration step (see Migration Plan) once
the new resolver is proven against a second module (MI) in production.

## Resolution order (matches request §10's levels, resolved cheapest-to-most-specific)

```
global default (code constant, e.g. features.marketIntelligence = true)
  → environment override (module_feature_entitlements, workspace_id NULL, environment match)
    → organization override (module_feature_entitlements, workspace_id NULL)
      → workspace override (module_feature_entitlements, workspace_id set)
        → user-role gate (existing `permissions`/`role_permissions`, e.g. 'leadgrid.access')
          → subscription/plan gate (existing Stripe-linked entitlement tables, e.g. `lead_map_module_entitlements`)
```

Implemented in this PR as
`backend/server/feature-flags/module-entitlement-resolver.ts`:
`resolveModuleFeatureState(pool, { organizationId, workspaceId, moduleKey, featureKey, environment })`
→ `'included' | 'trial' | 'add_on' | 'locked'`, plus `isModuleFeatureEnabled(...)` →
boolean (`included` or active `trial`). Unit-tested with a mocked `pg.Pool` (no live
DB required), following the existing `_shared-auth.test.ts` convention in this repo.

## When Leadgrid is disabled (request §10 acceptance criteria)

- No Leadgrid nav items render — gate `MarketIntelligenceSection.tsx`'s currently
  hardcoded `LeadInboxSection`/`WonLostDashboard`/`ScheduledReportsPanel` imports
  behind `isModuleFeatureEnabled(..., 'leadgrid', 'core')` (P1 fix, see Migration
  Plan — this is the concrete violation found in the Leadgrid Integration Report).
- No Leadgrid API calls run — already true structurally (Leadgrid routes are
  separately mounted at `/api/leadgrid/*` and `/api/admin-room/lead-map/*`; the
  frontend simply must stop calling them when the flag is off, which follows from
  the fix above).
- Market Intelligence continues to work — true today by construction, since MI's
  own routes (`/api/market-scans/*`) don't depend on Leadgrid; the only violation
  is the one-way dependency described above (MI's UI reaching into Leadgrid's
  components, not the reverse).

## Admin UX

Reuse `FeatureFlagManager.tsx`/`feature-management.tsx` as the base, extended with
an org/workspace picker so an admin can set entitlement state for a specific
tenant without touching code — no new admin UI framework needed, per request §17.
