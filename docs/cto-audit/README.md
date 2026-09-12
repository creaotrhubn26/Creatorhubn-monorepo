# CTO Audit — Generic Market Intelligence Platform with Leadgrid Integration

Dato: 2026-07-10
Forfatter: Claude (CTO/principal architect/QA-rolle, på oppdrag)
Branch: `claude/cto-audit-market-intelligence-re6cy3`

Dette er en fullstendig audit av det eksisterende Market Intelligence-arbeidet og
Leadgrid-integrasjonen i Creatorhubn-monorepoet, gjort på oppdrag om å gjøre
plattformen domain-agnostic, multi-tenant og konfigurasjonsdrevet. UX-referansen
(tannhelse-dashboard) ble brukt som visuell retning, ikke som implementeringsmal.

## Viktigste funn før du leser videre

**Dashboardet i UX-referansen ("MarketIntel", norsk sidebar med Dashboard/Explore/
Analyze/Track/Library, tannhelse-eksempeldata, mulighetsscore/markedskart-widgets)
finnes ikke i kodebasen.** Det ble søkt eksplisitt etter alle tekster, widget-titler
og layout-elementer fra referansebildet — null treff. Det som faktisk finnes og heter
"Market Intelligence" er en annen, mindre ting: en konkurrent-/mulighets-scanner
("market scan") bygget inn i "The Role Room" sitt admin-panel, med et helt annet
formål (markedsførings-konkurrentanalyse for produsenter, ikke et generelt
bransje-dashboard).

Det betyr at store deler av oppdraget ("gjør UX-en dynamisk", "bygg widget-system",
"industry templates") ikke er en refaktorering av noe som finnes, men et **nytt
produkt som må designes og bygges fra grunnen** — med den eksisterende MI-scanneren
og den allerede modne Leadgrid-modulen som byggeklosser.

Den gode nyheten: dental/tannhelse-hardkoding er **ikke** et reelt problem i praksis.
Alle "tannlege"-forekomster i kodebasen er legitime eksempeldata (én bransje blant
mange i en NACE-katalog, plassholdertekst i skjemaer, demo-data) — ikke forretningslogikk
låst til tannhelse. Se `04-hardcoded-values-report.md`.

## Leveranser (nummerert som i oppdraget, seksjon 20)

| # | Leveranse | Dokument |
|---|---|---|
| 1 | Existing System Audit | `01-existing-system-audit.md` |
| 2 | Google Cloud Integration Map | `02-google-cloud-integration-map.md` |
| 3 | Domain Coupling Report | `03-domain-coupling-report.md` |
| 4 | Hardcoded Values Report | `04-hardcoded-values-report.md` |
| 5 | Leadgrid Integration Report | `05-leadgrid-integration-report.md` |
| 6 | Security and Secrets Report | `06-security-and-secrets-report.md` |
| 7 | Proposed Generic Architecture | `07-proposed-generic-architecture.md` |
| 8 | Proposed Data Model | `08-proposed-data-model.md` |
| 9 | Feature Flag Architecture | `09-feature-flag-architecture.md` |
| 10 | Widget Architecture | `10-widget-architecture.md` |
| 11 | Migration Plan | `11-migration-plan.md` |
| 12 | Prioritized Implementation Plan | `12-prioritized-implementation-plan.md` |
| 13 | Code Changes | shipped in this PR — see "Code changes in this PR" below |
| 14 | Automated Tests | shipped in this PR — see "Code changes in this PR" below |
| 15 | Manual QA Checklist | `13-manual-qa-checklist.md` |
| 16 | Final CTO Sign-off Report | `14-cto-signoff-report.md` |

## Code changes in this PR (deliverables 13–14)

Given the scope of this request (a multi-month platform re-architecture), this PR
ships the audit + design package above in full, plus a **first, safe, additive
slice** of the generalization work — chosen because it de-risks the two biggest real
findings (no tenant isolation on Market Intelligence data; no shared industry
taxonomy) without touching any working code path:

1. `backend/migrations/0374_market_intelligence_tenant_and_industry.sql` — adds
   nullable `organization_id` and `industry_id` columns (+ indexes) to `market_scans`,
   reusing the existing `organizations` and `industries` tables instead of inventing
   new ones. Additive, backward-compatible, reversible.
2. `backend/server/feature-flags/module-entitlement-resolver.ts` (+ migration
   `0375_module_feature_entitlements.sql`) — a domain-agnostic generalization of the
   Leadgrid org-entitlement pattern (`leadgrid_org_entitlements` +
   `leadgrid-org-resolver.ts`) that any feature module (Market Intelligence, Leadgrid,
   future modules) can use to resolve global/org/workspace/role/environment feature
   state. Unit-tested.
3. `frontend/shared/dashboard-widget-schema.ts` — the generic widget contract from
   deliverable 10 (id, widgetType, dataSource, queryDefinition, visualization,
   filters, layout, permissions, loading/empty/error state, etc.) as a Zod schema +
   TypeScript types, with a validator and unit tests. This is the seed the future
   widget-registry/renderer builds on.

Everything else in "Leveranser" 7–12 is delivered as design documents rather than
code, because implementing them fully (a new dashboard product, an industry-template
engine, a configurable scoring engine, a full drag/drop widget renderer) is
multi-month engineering work that must be sequenced and staffed, not something to
half-build in one pass. The `12-prioritized-implementation-plan.md` gives the
concrete next-PR breakdown.
