# 11. Migration Plan

## Ground rules

No destructive migration, no data loss, no renaming of production tables in this
plan. Every step below is additive (new nullable column or new table) and
reversible (drop column / drop table). Nothing in this plan requires deleting or
renaming `market_scans`, `market_scan_opportunities`, or any Leadgrid/CRM table.

## Step 1 (this PR) — `0374_market_intelligence_tenant_and_industry.sql`

- Add `market_scans.organization_id UUID REFERENCES organizations(id) ON DELETE
  CASCADE` — nullable, no backfill required for existing rows (old rows keep
  working via `workspace_owner_user_id`; new code paths should start populating
  `organization_id` going forward). Index added.
- Add `market_scans.industry_id UUID REFERENCES industries(id) ON DELETE SET
  NULL` — nullable, existing free-text `industry` column is untouched (kept for
  backward compat, exactly the "fritekst-felter beholdes midlertidig" pattern the
  repo already used for `crm_customers.industry_id` in migration 329). Index added.
- **Reversible**: `ALTER TABLE market_scans DROP COLUMN organization_id, DROP
  COLUMN industry_id;` — no data loss since both are additive/nullable.
- **Not included**: a backfill script that resolves `organization_id` from
  `workspace_owner_user_id` via `enterprise_team_members` (mirroring
  `leadgrid-org-resolver.ts`'s resolution order) and fuzzy-matches free-text
  `industry` strings to `industries.name_no` via the existing `pg_trgm` index —
  this is a data-quality-sensitive operation that should run as a reviewed,
  monitored one-off script against production, not as an inline migration. Sketch:

```sql
-- Run as a monitored script, NOT inline in a migration file:
UPDATE market_scans ms
SET organization_id = (
  SELECT etm.organization_id FROM enterprise_team_members etm
  WHERE etm.user_id = ms.workspace_owner_user_id AND etm.status = 'active'
  ORDER BY etm.joined_at DESC NULLS LAST LIMIT 1
)
WHERE ms.organization_id IS NULL;

UPDATE market_scans ms
SET industry_id = (
  SELECT i.id FROM industries i
  WHERE i.is_active AND LOWER(i.name_no) = LOWER(ms.industry)
  LIMIT 1
)
WHERE ms.industry_id IS NULL AND ms.industry IS NOT NULL;
```

## Step 2 (this PR) — `0375_module_feature_entitlements.sql`

New table only (see `09-feature-flag-architecture.md`). No existing table touched.
Fully additive.

## Step 3 (next PR, P1) — decouple MI's admin panel from hardcoded Leadgrid imports

Code change only, no migration: gate
`MarketIntelligenceSection.tsx`'s `LeadInboxSection`/`WonLostDashboard`/
`ScheduledReportsPanel` imports behind
`isModuleFeatureEnabled(pool, { moduleKey: 'leadgrid', featureKey: 'core', ... })`.

## Step 4 (next PR, P1) — consolidate the duplicate market-scan route surface

`backend/server/leadgrid-market-scan-routes.ts` (`/api/leadgrid/market-scan/*`)
and `backend/server/market-intelligence/market-scan-routes.ts`
(`/api/market-scans/*`) both operate on `market_scans`. Plan: make the Leadgrid
route file a thin wrapper delegating to the canonical MI service functions
(no schema change), rather than duplicating query logic — reduces drift risk
without a data migration.

## Step 5 (P2, requires product sign-off before scheduling) — score model tables

`score_models` / `score_factors` (see Data Model doc) plus
`market_scan_opportunities.score_model_id` /
`score_model_version` / `numeric_score` columns — additive, but changes what the
Claude prompt in `opportunity-recommendation-service.ts` is asked to produce, so it
needs a product decision on the default factor set (demand/growth/pain/competition/
willingness-to-pay/etc. per request §14) before the migration is written.

## Step 6 (P2) — dashboard/widget persistence

`dashboard_layouts`, `widget_instances`, `data_sources`, `alerts`, `insights`,
`market_scan_problems` — all new, additive tables per the Data Model doc, scheduled
after at least one widget type is built end-to-end (see Widget Architecture doc's
sequencing recommendation) so the schema reflects a real usage pattern rather than
a speculative one.

## Step 7 (P3, no urgency) — Leadgrid entitlement table consolidation

Once `module_feature_entitlements` has been proven with a second module (MI) in
production, migrate `leadgrid_org_entitlements` rows into it
(`module_key = 'leadgrid'`) and repoint `leadgrid-entitlement-guard.ts` at the new
resolver. This is explicitly sequenced last because `leadgrid_org_entitlements` is
live, working infrastructure — touching it is the highest-blast-radius change in
this entire plan and should not happen until the generalized resolver has track
record.

## Rollback

Every step above is a `DROP COLUMN`/`DROP TABLE` away from full rollback because
nothing here deletes or renames existing columns/tables. Steps 3–4 are pure code
changes (revert the PR). Steps 5–7 explicitly require a review gate before
scheduling, not just before deploying.
