# 7. Proposed Generic Architecture

## Principle

Reuse what already works (Leadgrid's org/entitlement/industries patterns), replace
what's compiled-in with what's configured, and treat the request's screenshot as a
target UI to build, not a refactor target — because the code behind it does not
exist yet.

## Service boundaries (per request §11)

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│      Market Intelligence     │   │           Leadgrid            │
│  (backend/server/market-     │   │  (backend/server/leadgrid-*, │
│   intelligence/*)             │   │   lead-map-*, crm_* tables)   │
│                              │   │                                │
│  - market scans              │   │  - leads / territories / routes│
│  - competitor discovery      │   │  - visits / meetings           │
│  - opportunity generation    │   │  - CRM, notifications, billing │
│  - score models (proposed)   │   │  - iPad/watch/vision apps       │
│  - reporting                 │   │                                │
└──────────────┬───────────────┘   └───────────────┬────────────────┘
               │  "send segment/opportunity"        │ "return outcome data"
               │  (shared Opportunity/Insight rows)  │ (feedback loop, §8)
               └──────────────────┬───────────────────┘
                                  │
                      ┌───────────▼───────────┐
                      │  Shared Platform       │
                      │  Services              │
                      │  - auth/sessions        │
                      │  - organizations/teams  │
                      │  - permissions/RBAC     │
                      │  - industries catalog   │
                      │  - module entitlements  │
                      │  - billing              │
                      │  - notifications        │
                      │  - audit log            │
                      │  - design system         │
                      └────────────────────────┘
```

This is not a new topology to build from scratch — it is what Leadgrid already
demonstrates (shared `organizations`/`users`/entitlements, its own domain tables,
its own routes). The concrete architectural change is: **give Market Intelligence
the same shape** (org-scoped, entitlement-gated) instead of leaving it on the
per-user `workspace_owner_user_id` pattern, and **formalize the shared-services
layer** so both modules (and future ones) consume it identically instead of each
reinventing org-resolution/feature-gating (as Leadgrid itself had to do — see the
"replaces five duplicated copies" comment in `leadgrid-org-resolver.ts`).

## Layering

1. **Data layer** — Postgres, one database, tenant column (`organization_id`) on
   every module-owned table. No per-module database, no per-module schema.
2. **Domain services** — one service module per bounded context (MI, Leadgrid,
   future verticals), each exposing its own route file(s), but all reading tenant
   context and feature state through the shared resolver (this PR:
   `backend/server/feature-flags/module-entitlement-resolver.ts`), not
   reimplementing it.
3. **API layer** — generic resource routes (`/api/markets`, `/api/opportunities`,
   `/api/problems`, `/api/widgets`, `/api/insights`) with `?industry=` /
   `?organizationId=` (implicit from session) query-based filtering, per request
   §19. Module-specific routes (`/api/leadgrid/*`) stay explicitly namespaced.
4. **Presentation layer** — one design system (shadcn/Tailwind, not MUI — see
   System Audit), one widget contract (`10-widget-architecture.md`), industry
   templates as data (`08-proposed-data-model.md`) rather than compiled profession
   configs (the anti-pattern found in `profession-type-registry.ts`).
5. **AI layer** — one shared LLM client module (replacing the ~6 duplicated
   `getAnthropic()` singletons in `market-intelligence/*`), which always receives
   explicit context (`industry`, `market`, `segment`, `geography`, `workspace`,
   `enabledFeatures`) in its system prompt construction — never assumes a vertical.

## What this explicitly does NOT require

- Does not require moving off Render/Postgres/R2 onto native GCP services — no
  finding in this audit justifies that migration; the Google Cloud checklist in the
  request is aspirational relative to a codebase that currently has zero GCP
  infrastructure dependency. If the business decides to adopt Vertex AI/BigQuery
  later for MI's AI/analytics layer, that's a deliberate future decision, not a
  audit finding to act on now.
- Does not require rewriting Leadgrid — it is already close to compliant; changes
  to Leadgrid in this plan are narrow (decouple the MI-admin-panel's hardcoded
  Leadgrid imports, consolidate the duplicate market-scan route surface).
- Does not require a rename/rebrand of the whole platform — "MarketIntel" can be
  the product name for this dashboard specifically without the underlying
  `market-intelligence` backend module needing to change its internal naming.

See `08-proposed-data-model.md`, `09-feature-flag-architecture.md`,
`10-widget-architecture.md`, `11-migration-plan.md`, and
`12-prioritized-implementation-plan.md` for the concrete next layer of detail.
