# 8. Proposed Data Model

Principle: reuse existing tables wherever one already covers a requested entity;
only add new tables for concepts that genuinely don't exist yet. Every new/extended
table gets an `organization_id` (or inherits tenant scope via a parent FK).

## Organizing entities — mostly already exist

| Requested entity | Existing table | Action |
|---|---|---|
| Organization | `organizations` | none |
| Workspace | `market_scans.project_id` (loose), no formal `workspaces` table found | P2: evaluate whether a real `workspaces` table is needed, or whether `project_id` + org is sufficient for MI's needs — do not add a table speculatively |
| Team | `enterprise_team_members` | none |
| User | `users` | none |
| Role / Permission | `permissions`, `role_permissions` (used by the `industries.*` RBAC keys) | none — reuse, add new permission keys per module |
| Project | `market_scans.project_id` | none |

## Market and analysis entities

| Requested entity | Existing table | Action |
|---|---|---|
| Industry | `industries` (329) — NACE + custom, hierarchical, org-scoped custom verticals | **Reuse as-is.** This is the request's "Industry" entity already built. Do not create a second industries table for MI. |
| Market / Segment / Geography | none dedicated | P2: model as attributes on `market_scans` (`region`, `market_query`) rather than new tables initially — promote to real tables only once a second consumer needs to query them independently of a scan |
| Audience | `market_scans.target_audience` (free text) | P3: structure later if/when audience becomes filterable |
| Company / Competitor | `market_scan_competitors` | Rename conceptually to "Company" only if MI starts tracking companies outside the context of a scan; not needed yet |
| Product / Service | none | Not needed until a concrete requirement surfaces — do not add speculatively (per repo engineering conventions) |
| Problem | none — MI currently only has "Opportunity", no "Problem" entity | P1: add `market_scan_problems` (or a generic `problems` table, org + industry scoped) mirroring the `opportunities` shape, since the request's dashboard explicitly surfaces "Topp problemer" separately from "Muligheter" |
| Need / Trend / Signal | `market_scan_content_signals`, `market_scan_techniques`, `market_scan_funnel_stages` | Reuse; these already are "signal" entities, just scan-scoped instead of market-scoped |
| Opportunity | `market_scan_opportunities` | **This PR's migration adds `industry_id`/`organization_id`.** Numeric score fields are P1 (see Score Model below) |
| Hypothesis / Evidence | `source_urls`, `evidence_summary` columns already exist inline on opportunities/competitors | P2: promote to a first-class `evidence` table only if evidence needs to be reused across multiple opportunities |
| Data Source / Source Record | none formal | P1: add a `data_sources` table (id, key, label, category, config) so widgets can reference a data source by ID instead of hardcoding "Google Places" in code |
| Insight | none formal (AI output is stored inline per-opportunity) | P2: add `insights` table if AI Insight needs to be a standalone, dashboard-level widget (per the screenshot's "AI Insight" card) rather than always attached to one opportunity |
| Recommendation | `market_scan_opportunities.recommended_action` | Sufficient for now |
| Alert | none | P1: add `alerts` table (org-scoped, source type, severity, read/unread) to back the screenshot's "Varsler" widget |
| Report | none dedicated to MI | Reuse `reports`-style pattern if one exists elsewhere in the repo (not found in this pass) or add minimal `mi_reports` |

## Analysis models (score model — the biggest structural gap)

Today, `impact`/`difficulty`/`confidence` on `market_scan_opportunities` are
free-text enums written directly by the LLM — there is no configurable formula,
weight, or threshold anywhere (request §14 requires this). Proposed:

```sql
CREATE TABLE score_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id), -- NULL = global default
  industry_id UUID REFERENCES industries(id),         -- NULL = industry-agnostic
  name VARCHAR(200) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  formula JSONB NOT NULL,       -- factor keys + weights + threshold config
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE score_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_model_id UUID NOT NULL REFERENCES score_models(id) ON DELETE CASCADE,
  key VARCHAR(80) NOT NULL,      -- 'demand' | 'competition' | 'willingness_to_pay' | ...
  weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  threshold NUMERIC(5,2),
  source VARCHAR(40) NOT NULL DEFAULT 'ai_inference'
    CHECK (source IN ('ai_inference','user_hypothesis','leadgrid_outcome','external_data')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- score_model_id + score_model_version stamped onto whatever record was scored,
-- so "which version generated this score" (request §14) is always traceable.
ALTER TABLE market_scan_opportunities
  ADD COLUMN IF NOT EXISTS score_model_id UUID REFERENCES score_models(id),
  ADD COLUMN IF NOT EXISTS score_model_version INT,
  ADD COLUMN IF NOT EXISTS numeric_score NUMERIC(5,2);
```

This is deliberately **not shipped in this PR** — it changes how opportunities are
generated/scored, which touches the live Claude prompt pipeline
(`opportunity-recommendation-service.ts`) and needs product sign-off on the default
factor set before landing. It's specified here so the next implementation PR has an
exact schema to build against (see `11-migration-plan.md` for sequencing and
`12-prioritized-implementation-plan.md` for why it's P1-next rather than in this PR).

## Dashboard entities

`Dashboard`, `DashboardLayout`, `Widget`, `WidgetInstance`, `Filter`, `SavedView` —
none exist today. The widget contract is specified in
`10-widget-architecture.md` and seeded in this PR as
`frontend/shared/dashboard-widget-schema.ts`; the corresponding
`dashboard_layouts` / `widget_instances` persistence tables are P2 (next PR),
sequenced after the schema is validated against at least one real widget.

## Feature-module entities

`Feature`, `Module`, `Integration`, `IntegrationCredential` — Leadgrid's
`leadgrid_org_entitlements` already covers "Feature" + "state per org". This PR
generalizes it (`module_feature_entitlements`, see `09-feature-flag-architecture.md`)
rather than inventing a parallel `features` table.
