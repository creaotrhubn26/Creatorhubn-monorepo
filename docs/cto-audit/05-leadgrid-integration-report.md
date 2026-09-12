# 5. Leadgrid Integration Report

## What Leadgrid is, today

Leadgrid is a client-facing lead-generation / field-sales / territory-management
product, branded separately (`leadgrid.theroleroom.com`) but built as a module
inside the same backend and database as the rest of the platform — **not** a
separate service, deployment, or credential set. It has native iPad/watchOS/visionOS
apps (`ipad/LeadMapApp` + `LeadgridWatchApp` + `LeadgridVisionApp`) that are pure
API consumers over the shared backend (its own README states this explicitly:
"iPad-appen er en CONSUMER av backenden, ikke en uavhengig kilde").

This is good news for the request's requirements (§7–§11): Leadgrid is *already*
close to the "optional feature module with shared platform services" shape the
request asks for. The work is less "decouple Leadgrid from the core" and more
"formalize and extend the pattern it already follows so Market Intelligence uses
the same shape."

## Data model

Leadgrid does not duplicate entities — it extends the existing CRM:
- `crm_customers` (existing table) gained lead-specific columns
  (`lead_status`, geo, `territory_id`, `ai_opportunity_score`) rather than a new
  parallel `leads` table.
- New tables are additive and single-purpose: `crm_visits`, `crm_lead_activities`,
  `lead_territories` / `lead_territory_events`.
- Shared identity/org tables throughout: `organizations`, `users`,
  `enterprise_team_members` — no separate user or org table for Leadgrid.

**No duplicate-model risk found** — the request's §9 concern ("unngå dupliserte
parallelle modeller") is already satisfied for Leads/Territories/Visits.

## Feature-flag / entitlement model (the best existing pattern in the repo)

`leadgrid_org_entitlements` (`0370_leadgrid_org_entitlements.sql`) is a
per-`(organization_id, feature_key)` row with `state ∈
{included, trial, add_on, locked}`, optional `monthly_limit` and
`addon_price_monthly`. No row for an org = no override = defaults apply
(backward-compatible by construction). This is materially more capable than the
generic `useFeatureFlag`/`/api/admin/features` flat boolean flag system used
elsewhere in the frontend, and is the recommended base for the request's §10
"Feature Flag Architecture" — see that document for the concrete generalization
(this PR ships a first step: `module_feature_entitlements`, modeled directly on
this table but with a `module_key` instead of being Leadgrid-only).

`leadgrid-org-resolver.ts` centralizes org-resolution (super-admin override →
active enterprise membership → solo/self fallback), replacing five previously
duplicated copies across sales-leadership/sales-teams/proposals/pondus/routes
modules. This resolver is a good template for a generic
"resolve tenant context for the current user" helper MI should also use.

## Shared services confirmed

- **Auth/session**: same `activeSessions` map, same `enforceOrgStatus` middleware
  mount as every other module (`index.ts:25021-25022`).
- **Database**: same Postgres `pool`, same `organizations`/`users` FKs.
- **No separate credentials or service** — confirmed no isolated deployment target
  for Leadgrid backend logic.

## Where Leadgrid and Market Intelligence already touch

- `frontend/client/src/components/admin-room/market-intelligence/MarketIntelligenceSection.tsx:17-19,59`
  directly renders Leadgrid components inline (`LeadInboxSection`,
  `WonLostDashboard`, `ScheduledReportsPanel`) with the comment "Innkommende
  Leadgrid-leads — øverst, høyest urgency" — i.e. today's MI admin panel already
  assumes Leadgrid is present, which **violates** the request's requirement that MI
  work fully with Leadgrid disabled (§10, Scenario E). This is a concrete, fixable
  P1 finding: gate that import behind the Leadgrid feature flag.
- `backend/server/leadgrid-market-scan-routes.ts` (mounted at
  `/api/leadgrid/market-scan/*`) is a **second, Leadgrid-branded implementation**
  of market scanning, built on the same `market_scans` schema as the standalone
  Market Intelligence Scanner. Having two route surfaces
  (`/api/market-scans/...` and `/api/leadgrid/market-scan/...`) over the same table
  is exactly the kind of "duplicated parallel model" the request warns against in
  §9/§11 — flagged as a P1 migration item: consolidate to one canonical
  `/api/market-scans` surface with Leadgrid consuming it via the shared entitlement
  gate, rather than mounting its own copy.
- `backend/server/market-intelligence/lead-map-campaign-routes.ts` (campaign/
  analytics endpoints for lead-map) is physically colocated inside the
  `market-intelligence/` server directory even though it's Leadgrid-domain code —
  cosmetic, but worth moving during the eventual restructure so module boundaries
  in the codebase match the service boundaries in `07-proposed-generic-architecture.md`.

## Verdict against the request's acceptance criteria (§22)

| Criterion | Status |
|---|---|
| Leadgrid can be activated/deactivated per org | Yes — `leadgrid_org_entitlements` already supports this |
| Leadgrid is not the platform's core data model | Yes — it extends shared CRM entities, doesn't own them |
| MI works fully with Leadgrid disabled | **No** — MI's admin panel hardcodes Leadgrid component imports; fix is P1, small |
| MI results can flow to Leadgrid and back | Partial — a Leadgrid-branded market-scan endpoint exists, but it's a duplicate surface, not a clean handoff; needs consolidation (P1/P2, see Migration Plan) |
