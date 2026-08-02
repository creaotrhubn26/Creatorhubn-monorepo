# 3. Domain Coupling Report

Purpose: identify every place business logic is *structurally* coupled to a single
industry/vertical (would break or misbehave for a different industry), as distinct
from the Hardcoded Values Report (which covers copy/labels/example data). See also
`04-hardcoded-values-report.md` for the literal-string inventory.

## Market Intelligence module — coupling assessment: LOW

`backend/server/market-intelligence/*` and
`frontend/client/src/components/admin-room/market-intelligence/*` have **no
industry-specific business logic**:
- `market_scans.industry` is a free-text `VARCHAR(200)` — any string works today.
- Claude prompts in `competitor-discovery-service.ts`,
  `opportunity-recommendation-service.ts`, `content-signal-service.ts` are generic
  marketing/competitor-analysis prompts; they take `industry`/`market_query` as
  interpolated input, they do not branch on a specific vertical.
- The frontend's industry field is a plain `TextField` ("Industri (valgfritt)"),
  not an enum tied to a specific vertical.

**Conclusion**: the module already satisfies the request's core constraint ("ingen
forretningslogikk låst til tannhelse") for the code that exists. The gap is not
"remove dental coupling" — it's "this module has no widget system, no dashboard UI,
no industry template mechanism, and no org-tenant scoping," none of which existed to
begin with (see System Audit).

## Leadgrid — coupling assessment: LOW, by design

Leadgrid's domain coupling to specific verticals is intentional and already
generic: `leadgrid-industry-classify.ts` and
`leadgrid-project-lead-discovery-routes.ts` implement a **keyword → industry
category → Google Places query** mapping table with ~10+ entries (fotograf,
restaurant, kafé, tannlege, frisør, regnskap, advokat, bilverksted, wedding venue,
helse/legesenter). "Tannlege" (dentist) is one row in this table, not a special
case — adding a new vertical means adding a new row, which is exactly the
"configuration, not code" property the request asks for. The `industries` table
(`329_leadgrid_industries.sql`) generalizes this further into an admin-editable,
org-custom-extensible catalog.

**No changes needed here** — this is a good existing pattern to reuse for MI's
industry concept (see Proposed Data Model), not a violation to fix.

## The `universal` profession system — coupling assessment: MEDIUM

`frontend/shared/profession-type-registry.ts` +
`useProfessionTabs.ts` hardcode per-profession tab/stat configuration in source
(`photographer`, `psychologist`, `spa_wellness` with `treatment_beds`/`treatment
rooms`, `veterinarian`, etc.). This is domain-specific logic **compiled into the
frontend bundle** rather than configuration — adding a new profession requires a
code change and redeploy, which conflicts with the request's §17 acceptance
criterion ("ingen skal kreve kodeendring eller ny deploy"). This system is outside
MI/Leadgrid's direct scope but is the most relevant precedent to *not* repeat when
building MI's industry-template mechanism.

## Places/coupling found and how they should be read

| Location | Coupling type | Verdict |
|---|---|---|
| `leadgrid-industry-classify.ts:182,184` (tannlege keyword) | Config row in a generic keyword table | Legitimate, generalizable — no fix needed |
| `leadgrid-project-lead-discovery-routes.ts:276-483` (tannlege regex → Places query) | Config-like mapping, currently in code not DB | P2: migrate this mapping table into the `industries` catalog's `metadata` JSONB so it becomes admin-editable, same effort class as adding a template |
| `frontend/shared/profession-type-registry.ts` (spa/psychologist treatment tabs) | Compiled-in vertical config | P2: not urgent for MI, but same anti-pattern to avoid replicating |
| `market_scans.industry` free text | Absence of structure, not wrong-domain coupling | P1: link to `industries` catalog (this PR ships the additive column) |

## What "domain coupling" does NOT mean here

To be precise for sign-off purposes: there is no dental-specific SQL `CHECK`
constraint, no `if (industry === 'dental')` branch, no dental-only API route, and
no dental-only scoring formula anywhere in the reviewed code. The request's premise
("kontroller at ingen forretningslogikk er låst til tannhelse") is **already true**
for the Market Intelligence module as it exists today — the actual risk is the
*absence* of a generic framework (widgets, templates, tenant scoping), not the
*presence* of dental lock-in.
