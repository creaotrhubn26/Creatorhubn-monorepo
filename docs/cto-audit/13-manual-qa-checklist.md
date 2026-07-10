# 13. Manual QA Checklist

This checklist covers (a) verification of what actually shipped in this PR, and
(b) the scenario-based QA the request specifies (§16–§17) for the *next* PRs, so
whoever picks up `12-prioritized-implementation-plan.md` has the acceptance bar
written down in advance.

## A. This PR — verify before merge

- [ ] `0374_market_intelligence_tenant_and_industry.sql` applies cleanly against a
      staging DB that already has migrations through `0373` + `275`/`329` applied.
- [ ] `0375_module_feature_entitlements.sql` applies cleanly, independent of 0374.
- [ ] Existing `market_scans` reads/writes (via `market-scan-service.ts`) still work
      unmodified — the new columns are nullable and no existing query was changed.
- [ ] `leadgrid_org_entitlements` and all Leadgrid routes are untouched — confirm no
      Leadgrid behavior changed (this PR does not modify any Leadgrid file).
- [ ] `backend/server/feature-flags/module-entitlement-resolver.test.ts` passes
      (`npm run test:unit` in `backend/`, or targeted:
      `vitest run server/feature-flags/module-entitlement-resolver.test.ts`).
- [ ] `frontend/shared/dashboard-widget-schema.test.ts` passes (`npm run test:unit`
      in `frontend/`, now covered by the broadened `shared/**` include added to
      `frontend/vitest.config.ts`).
- [ ] Confirm `module-entitlement-resolver.ts` is not yet imported/wired into any
      route — it's a standalone, unused-until-adopted module in this PR, by design
      (adoption is P1, next PR).

## B. Scenario-based QA for the next implementation PRs (per request §16)

Run each scenario against whatever the next PR actually builds (e.g. once the
first real widget + industry template mechanism exists). Do not mark this section
complete based on this PR alone — this PR ships schema/infrastructure, not the
end-to-end dashboard.

**Scenario A — Tannhelse (dental)**: create an MI scan with `industry_id` pointing
at the "Tannhelsetjeneste" row in `industries`; verify problems around booking,
treatment cost, patient follow-up, and clinic comparison render using generic
widget types, with no dental-specific code path involved.

**Scenario B — Foto og video**: same flow, `industry_id` → a photography/video
vertical; verify demand-for-video-production, local competitors, customer
problems, and product-package widgets render from the same generic pipeline.

**Scenario C — SaaS**: verify competitor-feature, pricing, reviews, churn-signal,
and product-opportunity widgets render for a SaaS-tagged scan.

**Scenario D — Local sales with Leadgrid enabled**: with
`module_feature_entitlements` set to `included` for `(org, leadgrid, core)`,
verify geographic segments/leads/routes/visits/meetings/conversion flow end-to-end
and that an MI opportunity can be sent to Leadgrid and a resulting outcome can flow
back (per the feedback loop in request §8) once that hand-off is built.

**Scenario E — Leadgrid disabled**: set `(org, leadgrid, core)` to `locked` (or
leave no row, with a `locked` code default); verify — no Leadgrid nav items
render, no Leadgrid API calls fire, no broken links appear, and Market Intelligence
functions normally. **This is the one scenario that currently fails against the
existing codebase** (see `05-leadgrid-integration-report.md`) — the P1 fix
(gate `MarketIntelligenceSection.tsx`'s Leadgrid imports) must land before this
scenario can pass.

## C. Dynamic-UX QA (request §17) — checklist for when the admin tooling exists

- [ ] Admin can create a new industry without a deploy (already true today via the
      `industries` table + its RBAC-gated CRUD — verify the admin UI for it exists
      and is reachable, not just the table).
- [ ] Admin can create a new market/segment without a deploy — **not yet possible**,
      pending the Market/Segment entities in `08-proposed-data-model.md` (P2).
- [ ] Admin can change dashboard labels without a deploy — **not yet possible**,
      pending the widget/template system built on this PR's schema.
- [ ] Admin can create/version a score model without a deploy — **not yet
      possible**, pending `score_models`/`score_factors` (P2, needs product
      sign-off first per the Migration Plan).
- [ ] Admin can activate/deactivate Leadgrid per org without a deploy — **already
      possible** via `leadgrid_org_entitlements` today, and via
      `module_feature_entitlements` once the resolver is adopted (P1).
- [ ] Admin can create an industry template without a deploy — **not yet
      possible**, this is the biggest remaining gap (P2/P3, see Implementation Plan).

## D. Regression guard

- [ ] Confirm no existing test suite broke: run the full `backend` and `frontend`
      `test:unit` suites (not just the two new files) before merging any PR in this
      sequence — this audit did not run the full suite (no dependency install was
      feasible in the audit sandbox; the two new test files were verified in an
      isolated scratch environment instead — see sign-off report for details).
