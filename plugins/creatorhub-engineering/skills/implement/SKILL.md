---
name: implement
description: Implementation conventions for the Creatorhubn monorepo — commit style, migrations, org-scoping, frontend invariants, iPad/Tauri specifics. Use while writing or reviewing code changes in this repo, or when preparing commits and PRs.
---

# Implement — Creatorhubn-monorepo

Slik skrives kode og commits i dette repoet. Konvensjonene er håndhevet av
maskiner der det går (ESLint, pre-push, CI-gates) — resten står her.

## Commits og PR-er

- **Conventional Commits med norsk emnelinje:**
  `type(scope): norsk beskrivelse` — typer `feat|fix|chore|docs`, scopes som
  `role-room`, `leadgrid`, `education`, `lti`, `doc-intel`, `partner`,
  `capture`, `blender-bridge`, `google`, `tsc`. Eksempel:
  `fix(lead-map): verifyConfigAccess 403 for alle (feil kolonnenavn)`.
- `main` er beskyttet — alt går via branch + PR. Store leveranser deles i
  nummererte faser som separate PR-er («Fase 1», «Fase 2»).
- Rot-`prepare` setter `core.hooksPath .githooks`; `.githooks/pre-push`
  blokkerer to kjente deploy-feller (CH-ARCH-004/-005). I cloud-økter uten
  hooks: kjør sjekkene manuelt.

## Backend (Node/TS, Express-stil, Drizzle/Postgres)

- **Migrasjoner:** sekvensielle SQL-filer i `backend/migrations/`
  (`0NNN_*.sql`), applied av `backend/migrate.sh` (idempotent,
  `_migrations_applied`-tabell, continue-on-error per fil). SQL er
  autoritativt — ikke drizzle-push i prod. Etter push til `main` kjører
  `auto-migrate-on-push.yml` migrering via admin-endepunkt FØRST når riktig
  commit er stabilt deployet (fikser Render-rollover-racet). MEN: workflowen
  har en timeout-fallback — tar deployen >15 min eller er `/api/version`
  utilgjengelig, varsler den og trigger migrering LIKEVEL. Skriv derfor
  alltid migrasjoner og kode som tåler begge rekkefølger (ny kode mot
  gammelt skjema OG migrert skjema mot gammel kode).
  - Kolonner som leses før migrasjonen garantert er applied → lazy
    self-heal-mønsteret (mig 0448, #1996).
  - Verifiser alltid mot `_migrations_applied`, ikke GH-action-suksess.
- **Org-scoping fra dag 1:** nye tabeller får `organization_id`; spørringer
  mot legacy-tabeller uten kolonnen bruker
  `owner_user_id IN (SELECT user_id::text FROM organization_members WHERE organization_id = $1::uuid)`.
- **Rutefiler:** én fil per domene (`leadgrid-*.ts`, `academy-*.ts`). Sjekk
  at ny path ikke allerede er registrert i en eldre fil (rute-skygging,
  #2002).
- **Ytelse-mønstre som er standard:** batch-fetch med CTE-er fremfor
  N-roundtrips (PR #870), AI-kall bak rate-limiter, zod-validering på
  eksterne endepunkter, 202+async for tunge jobber (PR #867).

## Frontend (Vite/React/TS/MUI)

- Invariantene i `docs/architecture-rules.md` gjelder alltid; de tre du
  oftest treffer:
  - Ingen `use*`-hook inline i JSX (CH-ARCH-002).
  - `<ErrorBoundary>` over hver `<Suspense>`, samme fil, helst keyet
    (CH-ARCH-003).
  - Relative stier i dynamiske imports, aldri `await import('@/…')`
    (CH-ARCH-005).
- Delte a11y-konstanter fra `constants/accessibility.ts` — aldri lokal
  re-deklarasjon (CH-ARCH-001).
- Kritiske flater har egne typecheck-scripts:
  `npm run typecheck:story-arc-studio`, `typecheck:professional-timeline` —
  kjør dem når du endrer de flatene, i tillegg til full `typecheck`.
- ESLint er `--fix`-basert flat config (`eslint.config.js` +
  `eslint-rules/`); signalet er bevisst ikke-blokkerende i CI, men brudd på
  error-regler skal likevel ikke sjekkes inn.

## iPad (Swift) og apper (Tauri)

- iPad-agenter/økter skal skrive Swift-filer, IKKE kjøre `xcodebuild`
  (stall-fellen i memory.md) — bygg/commit gjøres manuelt eller via CI
  (`ipad-capture-ci.yml`, `*-testflight.yml`).
- Tauri-apper typesjekkes i CI men bundles ikke — ved import-/ikon-endringer,
  kjør `vite build` i appen selv (CH-ARCH-007).

## Modell-disiplin under implementasjon

Mekanisk arbeid (kodegen, grep-sveip, formattering) = scripts uten modell;
selve implementasjonen på produksjonskritiske flater = sterkeste modell, og
si fra om valget (CLAUDE.md-regelen).

## Ferdig-definisjon

En endring er ikke ferdig før: relevante typecheck-scripts er grønne, kjente
feilklasser er sjekket (`regression-check`), riktig E2E-gate er identifisert
(`e2e-verify`), og commit-meldingen følger konvensjonen.
