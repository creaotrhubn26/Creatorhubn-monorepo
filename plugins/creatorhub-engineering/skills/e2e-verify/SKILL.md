---
name: e2e-verify
description: Verify changes in the Creatorhubn monorepo with the right test/E2E gate — Playwright suites, hardened gates (Story Arc, Visual Editor), Vitest, Sentinel, live smokes. Use after implementation, when a gate fails, or when deciding which tests prove a change works.
---

# E2E-verify — Creatorhubn-monorepo

Verifiseringskartet: hvilken maskin beviser at endringen din virker. Velg
gate etter flate — ikke kjør alt, og ikke stol på «grønn CI» uten å vite
hvilke gates som faktisk dekker diffen (se `regression-check` for klassene
der grønn CI lyver).

## Gate-kart per flate

| Flate | Gate | Kjøring |
|---|---|---|
| Story Arc Studio | **«Story Arc Hardened E2E»** (`story-arc-e2e-gate.yml`, PR + merge_group) | `npm run test:e2e:story-arc-hardened` i `frontend/` (3 specs, `--repeat-each=2 --retries=1`) + `typecheck:story-arc-studio` |
| Visual Editor | **«Visual Editor Regression»** (`visual-editor-e2e-gate.yml`) | `npm run test:e2e:visual-editor-hardened` |
| Frontend generelt | «Frontend tsc --noEmit» (**eneste required check**), `frontend-eslint-gate.yml` | `npm run typecheck` / `npm run lint` i `frontend/` |
| Backend | `backend-typecheck-gate.yml`, `backend-vitest-gate.yml` | `npm run typecheck` / `vitest run` i `backend/` |
| Frontend/backend/sentinel-kode | `sentinel-gate.yml` — blokkerer kun NYE funn (~240 pre-eksisterende er backlog) | `sentinel-ci` fra `crates/sentinel-core/` |
| Timeline-ytelse | `test:e2e:timeline-render-budget` | render-budsjett-spec |
| Role Room live | Live-smokes mot prod | `npm run smoke:role-room:live`, `e2e:role-room-exporter:live`, `e2e:role-room-google-workspace:live` (rot-scripts) |
| Nightly | «Story Arc V2 Nightly Golden Benchmark» (cron 01:30) — testet i `backend/` | ikke PR-gate; regresjoner dukker opp dagen etter |

## Playwright-oppsettet

- `frontend/e2e/` — ~118 spec-filer (`dance-*`, `academy-*`, `admin-*`,
  `story-arc-*`, `visual-editor-*`, `casting-*`).
- `frontend/playwright.config.ts`: testDir `./e2e`, `fullyParallel: false`,
  `workers: 1`, 120s timeout, CI-retries 2, baseURL `PLAYWRIGHT_BASE_URL` ||
  `http://localhost:5001` (dev-serveren kjører `--strictPort` på 5001).
  Prosjekter: `chromium` (grepInvert `@mobile|@tablet`), `mobile-chrome`,
  `mobile-safari`. Smoke-variant: `playwright.smoke.config.ts`.
- Egen Playwright-config i `apps/resolve-script-manager/` for Tauri-appen.
- Basislinje/stabilitetsnotater: `PLAYWRIGHT_BASELINE.md` og
  `stabilitetsaudit.md`.

## Feilsøking av gates

- Story Arc-feil → bruk `story-arc-debugger`-agenten (`.claude/agents/`).
  Merk: nightly-golden-workflowen er IKKE samme flate som PR-gaten.
- Visual Editor-feil → `visual-editor-debugger`-agenten.
- Hooks-relaterte «rendered fewer/more hooks»-kollapser i `dance-*`-specs er
  klassisk CH-ARCH-002 (hook inline i JSX) — sjekk diffen før du mistenker
  testen.
- E2E-funne hull skal lukkes som egne fikser med spec som bevis
  (#1982-mønsteret: «E2E-funne gap»).

## Live-verifisering (prod)

Etter deploy av Role Room-/backend-endringer: kjør relevant live-smoke fra
rot-`scripts/` og `smoke-production.sh`. Leadgrid har egen
post-deploy-smoketest-workflow. Photo-enhancer har `photo-enhancer:e2e:live`
i backend-scripts.

## Prinsipper

- En endring på en gate-dekket flate er ikke levert uten grønn gate — og en
  gate-udekket flate skal få minst én spec i samme PR hvis endringen er
  E2E-testbar.
- Rapportér verdikt først: hvilke gates kjørt, utfall, hva som IKKE er
  dekket. Utelat aldri kjente hull stille.
