# 12. Prioritized Implementation Plan

Priority tiers per the request's §21.

## P0 — shipped in this PR

- [x] `market_scans.organization_id` + `industry_id` columns (tenant isolation gap
  + shared industry taxonomy gap) — `0374_market_intelligence_tenant_and_industry.sql`.
- [x] No secrets/credentials found exposed — confirmed, no fix needed
  (`06-security-and-secrets-report.md`).
- [ ] **Not done in this PR, flagged for immediate follow-up**: the org-resolver
  backfill script (Migration Plan Step 1's sketch) should run before any code
  starts *relying* on `organization_id` being populated — until then, treat the
  column as "available, not yet authoritative."

## P1 — recommended next PR(s)

1. Gate `MarketIntelligenceSection.tsx`'s hardcoded Leadgrid component imports
   behind the new `module_feature_entitlements` resolver (fixes the one concrete
   "Leadgrid must be optional" violation found — Leadgrid Integration Report).
2. Consolidate `/api/leadgrid/market-scan/*` into the canonical
   `/api/market-scans/*` service (Migration Plan Step 4) — removes duplicate query
   logic over the same table.
3. Wrap external Google API calls (Ads, Search Console) in the same
   timeout+catch+null-return pattern Places already uses
   (`callExternalApi()` helper) — closes the partial-failure-state gap called out
   in the Security report and required by request §3/§6.
4. Rename `frontend/client/.env.production` to `.env.production.example`, inject
   real values at deploy time (Security report P1 item).
5. Add a standardized loading/empty/error component for MI panels, matching the
   `loadingState`/`emptyState`/`errorState` fields already defined in this PR's
   widget schema, so the current bespoke panels start moving toward the contract
   incrementally instead of needing a big-bang rewrite.

## P2 — after P1 lands

1. `score_models`/`score_factors` tables + wiring
   `opportunity-recommendation-service.ts` to read an active score model instead of
   asking the LLM to freehand `impact`/`difficulty`/`confidence` (requires product
   sign-off on default factors first — Migration Plan Step 5).
2. Build the first real widget (`kpi_card` backed by opportunity counts) against
   `dashboard-widget-schema.ts`, prove the contract, then build `WidgetRenderer`.
3. `dashboard_layouts`/`widget_instances`/`data_sources`/`alerts`/`insights`/
   `market_scan_problems` tables (Data Model doc), sequenced after the first widget
   proves the schema.
4. Migrate the compiled-in `profession-type-registry.ts` vertical config toward a
   data-driven "industry template" shape once MI's own template mechanism exists —
   reuse one engine for both instead of building a second.
5. Move `market-intelligence/lead-map-campaign-routes.ts` out of the
   `market-intelligence/` directory into a Leadgrid-owned location (cosmetic
   module-boundary cleanup).
6. Per-org API cost/usage counters for Places/Ads calls.

## P3 — later, no urgency

1. Consolidate `leadgrid_org_entitlements` into `module_feature_entitlements`
   (Migration Plan Step 7) — only after the generalized resolver has production
   track record.
2. Reconcile the two parallel frontend trees (`frontend/client` vs.
   `frontend/creatorhub-frontend`) if the latter is confirmed dead.
3. UX polish on the actual "MarketIntel" dashboard once the widget renderer and at
   least 3-4 real widgets exist — this is where the screenshot's exact visual
   design (bubble chart market map, AI insight card styling, etc.) gets built, and
   it should be built against the widget contract from day one so it's
   industry-agnostic by construction rather than needing a later generalization
   pass.

## Explicit non-goals for the near term

- Migrating hosting off Render onto GCP Cloud Run/Cloud SQL — no finding in this
  audit justifies it; would be a business/infra decision independent of this work.
- Adopting Vertex AI in place of Claude — no finding suggests Claude is
  insufficient; would need its own cost/quality evaluation.
- Building a full drag-and-drop dashboard builder before a single real widget
  exists end-to-end — sequencing risk called out in the Widget Architecture doc.
