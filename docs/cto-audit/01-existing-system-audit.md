# 1. Existing System Audit

## Scope note

This audits the monorepo as a whole where relevant to Market Intelligence (MI) and
Leadgrid, not every product in it (the repo also contains "The Role Room" — a
casting/production platform — CreatorHub creator tools, native iPad/desktop apps,
etc.). Those are treated as context, not as part of the generalization scope.

## Frontend architecture

- Two frontend trees exist: `frontend/client` (the active one, Vite + React +
  TypeScript, ~2,000+ components) and `frontend/creatorhub-frontend` (appears to be
  an older/parallel tree — not touched by this audit; flag for cleanup separately).
- Two parallel design systems are in active use:
  - `frontend/client/src/components/ui/` — shadcn/Tailwind primitives
    (`button.tsx`, `card.tsx`, `dialog.tsx`, `select.tsx`, `tabs.tsx`, etc.) plus
    `design-system.tsx` tokens. This is the modern, product-wide system.
  - MUI (`@mui/material`), used specifically by the "admin-room" surface, including
    the current Market Intelligence panels (`MarketIntelligenceOverviewPanel.tsx`
    header comment: "matching AdminRoom styling", accent `#a78bfa`).
  - **Implication**: any new MI dashboard should standardize on the shadcn/Tailwind
    system (§13 of the request), not MUI — building a third system is out of scope
    and building on MUI would fragment the design system further.
- A generic profession/vertical config already exists:
  `frontend/shared/profession-type-registry.ts` +
  `frontend/client/src/components/universal/hooks/useProfessionTabs.ts` — a
  hardcoded-but-structured `professionId → { tabs, projectTypes, stats }` map
  (photographer, psychologist, spa_wellness, tattoo_artist, veterinarian, etc.).
  This is the closest existing analog to "industry templates" (deliverable 7 of the
  request) and is a reasonable starting shape, but it is compiled into the bundle,
  not admin-editable — the request requires templates to be data-driven, not
  code-driven.
- Feature flags: `useFeatureFlag(featureId)` /
  `useFeatureFlags(featureIds)` (`frontend/client/src/hooks/useFeatureFlag.ts`) call
  `GET /api/admin/features` and return `isEnabled`. Admin UI exists
  (`FeatureFlagManager.tsx`, `feature-management.tsx`). This flag system is flat
  (id → boolean), no org/workspace/role layering — see `09-feature-flag-architecture.md`
  for the gap vs. what Leadgrid already does at the org level.

## Backend architecture

- Single Node/Express monolith, `backend/server/index.ts` (very large — tens of
  thousands of lines) mounts feature-specific route files
  (`*-routes.ts`, ~200+ files). Route modules are largely independent, each owning
  its own service file(s) and often its own duplicated auth/session helpers
  (explicitly called out as a problem and partially fixed for Leadgrid — see
  `leadgrid-org-resolver.ts` header comment: "Erstatter fem identiske modul-private
  kopier").
- Database access: raw `pg` (`Pool`), no ORM for most tables (a `schema.ts` /
  `relations.ts` under `backend/migrations` suggests partial Drizzle usage
  elsewhere, but MI and Leadgrid tables are hand-written SQL migrations, not
  Drizzle-modeled).
- Session/auth: a shared in-memory `activeSessions: Map<string, SessionData>`
  passed by reference into route mounters (e.g.
  `lead-map-campaign-routes.ts:28-46`), plus an `enforceOrgStatus(pool,
  activeSessions)` middleware applied per-mount (`index.ts:25021-25022` for both
  `/api/admin-room/lead-map` and `/api/leadgrid`).
- Background jobs: no queue system (no Pub/Sub, no BullMQ/Redis queue found) —
  scheduled work runs as **GitHub Actions cron workflows**
  (`.github/workflows/ads-attribution-daily.yml`, `lead-map-followup-cron.yml`,
  `leadgrid-grace-expire.yml`, `cockpit-cron.yml`) and `scripts/cron/`, hitting the
  deployed backend's HTTP endpoints on a schedule. There is also a
  `Dockerfile.cron` at repo root, suggesting a dedicated cron container image.
- Storage: Cloudflare R2 (S3-compatible), not GCS — `env-validator.ts:87-88`.
  Database: Postgres (`DATABASE_URL`), hosted per `render.yaml`, not Cloud SQL.

## Database (Market Intelligence + Leadgrid, relevant tables)

- **Market Intelligence** (`backend/migrations/275_market_intelligence.sql`):
  `market_scans`, `market_scan_competitors`, `market_scan_funnel_stages`,
  `market_scan_techniques`, `market_scan_tech_stack`, `market_scan_content_signals`,
  `market_scan_opportunities`. Scoping is `workspace_owner_user_id` only — **no
  `organization_id`** anywhere in this migration (comment at line 31 explicitly
  says "samme mønster som lead-map", i.e. copied the per-user pattern rather than
  the org pattern). `industry` is `VARCHAR(200)` free text (line 40). `impact` /
  `difficulty` / `confidence` on opportunities are free-text enums generated
  directly by an LLM, not a numeric/configurable score model.
- **Leadgrid / CRM** — built by *extending* the existing Universal CRM rather than
  a parallel schema: `crm_customers` (extended with lead_status, geo, territory_id,
  ai_opportunity_score — `271_lead_map.sql:24-52`), `crm_visits`,
  `crm_lead_activities`, `lead_territories` / `lead_territory_events`
  (`314_leadgrid_territories.sql`), route/entitlement tables
  (`273_lead_map_module_entitlements.sql`, `0370_leadgrid_org_entitlements.sql`,
  `0365_leadgrid_org_overrides.sql`). All FK to `organizations(id)` / `users(id)`.
- **Industries catalog** (`329_leadgrid_industries.sql`) — a 3-layer, already
  generic taxonomy: `industries` (NACE codes + org-custom verticals, hierarchical
  via `parent_id`, `scope = global|custom`), `crm_customers.industry_id` FK,
  `organization_member_industries` (sales-rep × industry × expertise). This is the
  best existing building block for a domain-agnostic "Industry" entity — see
  `08-proposed-data-model.md`.
- No `soft delete` convention was verified across all tables in this pass; several
  tables use `archived_at` (e.g. `crm_customers`). No dedicated audit-log table was
  found scoped to MI or Leadgrid specifically (Leadgrid has activity feeds
  `crm_lead_activities`, which is domain activity, not a security audit log).

## AI integrations

- **Anthropic Claude** is the primary LLM (`@anthropic-ai/sdk`), used directly (no
  abstraction layer) in ~50+ backend files. Within MI specifically: each service
  file (`competitor-discovery-service.ts`, `opportunity-recommendation-service.ts`,
  `content-signal-service.ts`, `content-pack-generator-service.ts`,
  `learning-loop-service.ts`) instantiates its own `getAnthropic()` singleton
  reading `process.env.ANTHROPIC_API_KEY` — duplicated per file, no shared client
  module.
- **OpenAI** is a documented fallback (`env-validator.ts:44-51`,
  `role-room-agent.ts:5808` — `claude_failed_retrying_openai`).
- **No Vertex AI anywhere** in the repo.
- MI prompts are already industry-agnostic (Norwegian, generic marketing/competitor
  language) — no hardcoded "dental" framing found. See `04-hardcoded-values-report.md`.

## Logging / monitoring / caching

- Sentry (`@sentry/node`, `@sentry/react`) and Winston are both dependencies with
  init modules (`sentry-init.ts`, `frontend/.../utils/sentry.ts`); `SENTRY_DSN` is
  optional. No sensitive-value logging was found in a targeted grep.
- No dedicated caching layer (Redis, etc.) was found for MI; `leadgrid-org-resolver.ts`
  uses a simple 30s in-process `Map` cache for org resolution — fine for a single
  instance, will not be correct if the backend is horizontally scaled without a
  shared cache.

## Multi-tenant logic

- Real org/tenant model exists and is used properly by Leadgrid: `organizations`,
  `enterprise_team_members`, org-scoped entitlement tables, an `resolveOrgIdForUser()`
  helper with override support for super-admin "view as org" mode.
- MI does **not** participate in this model — it is scoped to `workspace_owner_user_id`
  (an individual user), which is the single biggest architectural gap for making MI
  multi-tenant (§1 of the request). See `03-domain-coupling-report.md` and the P0
  item in `12-prioritized-implementation-plan.md`.

## Mockdata / incomplete flows

- `ipad/LeadMapApp` ships a `DemoModeManager.swift` with hardcoded demo leads
  ("Frogner Tannlege", "Stabekk Tannlege") — legitimate demo-mode sample data for
  the iOS app, gated behind a demo toggle, not live business logic.
- `docs/leadgrid/ipad-parity-gap-2026-06-19.md` documents an active, tracked gap
  between the iPad app and newer web Leadgrid features (won/lost dialogs,
  hierarchical assignment, CSV export, partner marketplace, Stripe overage billing)
  — i.e. there is a known, already-tracked partial-parity flow, not a hidden one.
- The MI frontend module (`MarketIntelligenceOverviewPanel.tsx` et al.) has no
  loading/empty/error state pattern beyond ad-hoc `isLoading` checks — no
  standardized partial-failure UI, which the request explicitly calls for (§3, §6).
