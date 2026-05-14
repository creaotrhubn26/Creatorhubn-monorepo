# Playwright Baseline — The Role Room

> **Baseline-dato:** 2026-05-15 (Sprint A.5 fra stabilitetsaudit § 8)
> **Total spec-filer:** 79
> **Total tester (estimat):** ~400+ (mange specs har 10-75 tester hver)
> **Konfigurasjon:** chromium, workers:1 (sequential), timeout 20s/test
> **Sist oppdatert:** under utfylling

## 0. Hvorfor dette dokumentet

Stabilitetsaudit § 8.1 krevde at vi fikk en baseline på hvilke e2e-specs som
faktisk passerer/feiler. Sprint 5 oppdaget at 20/20 `role-room-workflow`-
tester hadde vært knust i månedsvis uten at noen visste det. Vi trenger en
sannhets-kilde for å fange regresjoner per PR.

## 1. Spec-katalog

Klassifisering per spec — oppdateres etter hvert som de kjøres:

| Status | Betydning |
|---|---|
| ✅ PASS | Alle tester i specen passerer |
| ⚠️ PARTIAL | Noen passerer, noen feiler — flaky eller delvis brutt |
| ❌ FAIL | Alle / nesten alle feiler — knust spec |
| ⏳ TODO | Ikke kjørt enda i denne baseline-runden |
| 🚫 SKIP | Bevisst hoppet over (visual snapshots, heavy, etc.) |

### 1.1 Core Role Room (kritiske)

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `smoke.spec.ts` | 1 | ✅ | Smoke-test av homepage — PASS |
| `casting-project-sync-persistence.spec.ts` | 7 | ✅ | DB-persist + sync — PASS |
| `creatorhub-login-flow.spec.ts` | ~7 | ✅ | Login-flyt — PASS |
| `role-room-api-integration.spec.ts` | 18 | ❌ | **ALLE 18 fail** — `gotoCastingPlanner`-helper venter på `'Casting, crew & produksjonsplanlegging'`-subtittel som ikke vises. Samme rot-årsak som Sprint 5.2 men annen helper. Krever oppdatert test-harness eller spec-helper. |
| `role-room-clarity-smoke.spec.ts` | ~9 | ⚠️ | 1 fail: `/vs-castingnetworks`-side timeout. Resten passerer. |
| `role-room-workflow.spec.ts` | 20 | ✅ | Fikset Sprint 5.2 — fortsatt PASS |
| `story-logic-secure-sync.spec.ts` | 2 | ✅ | Verifisert Sprint 1.1 — PASS |
| `story-logic.spec.ts` | 10 | ❌ | **ALLE 10 fail** — samme `gotoCastingPlanner`-helper-pattern. Subtittel-venting timer ut. |
| `role-room-comprehensive.spec.ts` | 97 | 🚫 | Ikke kjørt i baseline (for stor) |
| `role-room-full.spec.ts` | 51 | 🚫 | Ikke kjørt i baseline (for stor) |

**Batch 1 totalt: 37 passed, 29 failed, 7 did not run, 10.7 min wall time.**

#### 1.1.x Rot-årsak-analyse: 28 av 29 failures var ÉN bug-klasse
Helperen `gotoCastingPlanner` i `role-room-api-integration.spec.ts` og
`story-logic.spec.ts` ventet på `getByText('Casting, crew & produksjonsplanlegging')`
som er subtittelen i `RoleRoomDashboardPanel`. Subtittelen vises kun når
`viewport.isDesktop` er true.

**Sprint A.6 fix:**
- Ny felles `frontend/e2e/helpers/role-room.ts` med:
  - `openRoleRoomDashboard(page)` — venter på `.role-room-route` (klasse)
  - `openCastingPlanner(page)` — venter på `[data-testid="casting-planner-root"]`
- Lagt til `data-testid="casting-planner-root"` i `CastingPlannerPanel.tsx`
- Migrert: `story-logic`, `role-room-api-integration`, `shotlist-storyboard-bridge`, `client-media-workspaces`

**Resultat etter Sprint A.6 helper-fix:**
- `.role-room-route`/casting-planner-root-venting fungerer nå ✓
- 33 tester feiler fortsatt — men NY rot-årsak: `selectFirstProject` finner
  ingen `<li>` i sidebar fordi harnessene ikke seeder demo-prosjekter.
- Dette er en separat fix-klasse (data-seeding i test-harness).

**Neste-steg-fix (egen sprint):**
- `test-harness-casting.tsx` skal seede ETT demo-prosjekt så `selectFirstProject` funker
- Eller spec-er må bruke API/`fetch` til å opprette prosjekt før test
- API-baserte tester (`role-room-api-integration`) trenger backend tilgjengelig på `localhost:3001/api/role-room`

### 1.2 Producer / klient

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `producer-client-review-overview.spec.ts` | ? | ⏳ | |
| `producer-export-handoff.spec.ts` | ? | ⏳ | |
| `production-manuscript-view.spec.ts` | ? | ⏳ | |
| `production-team-demo-isolation.spec.ts` | ? | ⏳ | Demo-isolation |
| `client-media-workspaces.spec.ts` | ? | ⏳ | Klient-portal |

### 1.3 Storyboard / drawing

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `storyboard-drawing-editor.spec.ts` | 75 | 🚫 | Visual baselines — kjør etter snapshot-rebaseline |
| `shotlist-storyboard-bridge.spec.ts` | ? | ⏳ | |

### 1.4 Live Set / production day

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `role-room-live-set.spec.ts` | ? | ⏳ | |
| `role-room-troll-demo-seed.spec.ts` | ? | ⏳ | Troll demo-seed |

### 1.5 Story Arc Studio

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `story-arc-regression.spec.ts` | ? | ⏳ | |
| `story-arc-edit-tools-isolated.spec.ts` | ? | ⏳ | |
| `professional-timeline-render-budget.spec.ts` | ? | ⏳ | |
| `professional-timeline-hardpass.spec.ts` | ? | ⏳ | |

### 1.6 Crew / Team

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `crew-team-dashboard-flow.spec.ts` | ? | ⏳ | |

### 1.7 Universal / cross-cutting

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `universal-dashboard.spec.ts` | ? | ⏳ | |
| `universal-showcase-sync.spec.ts` | ? | ⏳ | |
| `admin-chat.spec.ts` | ? | ⏳ | |
| `component-sync.spec.ts` | ? | ⏳ | |
| `evendi-bridge.spec.ts` | ? | ⏳ | |
| `debug-harness.spec.ts` | ? | ⏳ | |
| `debug-tabs2.spec.ts` | ? | ⏳ | |
| `frequency-sep.spec.ts` | ? | ⏳ | |

### 1.8 Role Room — undervurderte (smaller)

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `role-room-cms-r2-upload.spec.ts` | ? | ⏳ | |
| `role-room-ga4-events.spec.ts` | ? | ⏳ | |

### 1.9 Academy (own vertical)

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `academy-a-to-z-e2e.spec.ts` | ? | ⏳ | Stor academy-test |
| `academy-full-smoke.spec.ts` | ? | ⏳ | |
| `academy-presentation-e2e.spec.ts` | ? | ⏳ | |
| `academy-user-center-header.spec.ts` | ? | ⏳ | |
| `academy-ux-psych-audit.spec.ts` | ? | ⏳ | |

### 1.10 Dance vertical (parallell modul)

| Spec | Tester | Status | Notater |
|---|---:|---|---|
| `dance-a11y-axe.spec.ts` | ? | ⏳ | |
| `dance-admin-gate.spec.ts` | ? | ⏳ | |
| `dance-admin-ops-smoke.spec.ts` | ? | ⏳ | |
| `dance-aria-live-formation.spec.ts` | ? | ⏳ | |
| `dance-autosave-debounce.spec.ts` | ? | ⏳ | |
| `dance-capability-gate.spec.ts` | ? | ⏳ | |
| `dance-choreography-build.spec.ts` | ? | ⏳ | |
| `dance-drawing-overlay.spec.ts` | ? | ⏳ | |
| `dance-empty-state.spec.ts` | ? | ⏳ | |
| `dance-focus-trap.spec.ts` | ? | ⏳ | |
| `dance-formation-canvas.spec.ts` | ? | ⏳ | |
| `dance-ga4-events.spec.ts` | ? | ⏳ | |
| `dance-instructors-rooms-crud.spec.ts` | ? | ⏳ | |
| `dance-invite-already-member.spec.ts` | ? | ⏳ | |
| `dance-invite-deeplink.spec.ts` | ? | ⏳ | |
| `dance-invite-generation.spec.ts` | ? | ⏳ | |
| `dance-invite-lifecycle.spec.ts` | ? | ⏳ | |
| `dance-invite-mobile.spec.ts` | ? | ⏳ | |
| `dance-invite-role-assignment.spec.ts` | ? | ⏳ | |
| `dance-keyboard-nav.spec.ts` | ? | ⏳ | |
| `dance-member-management.spec.ts` | ? | ⏳ | |
| `dance-mobile-shell.spec.ts` | ? | ⏳ | |
| `dance-movement-vocab.spec.ts` | ? | ⏳ | |
| `dance-multi-team-switch.spec.ts` | ? | ⏳ | |
| `dance-music-upload.spec.ts` | ? | ⏳ | |
| `dance-plan-gate.spec.ts` | ? | ⏳ | |
| `dance-profession-mode-routing.spec.ts` | ? | ⏳ | |
| `dance-rehearsal-flow.spec.ts` | ? | ⏳ | |
| `dance-render-budget.spec.ts` | ? | ⏳ | |
| `dance-studio-ops-crud.spec.ts` | ? | ⏳ | |
| `dance-tab-persistence.spec.ts` | ? | ⏳ | |
| `dance-team-roles.spec.ts` | ? | ⏳ | |
| `dance-video-library.spec.ts` | ? | ⏳ | |
| `dance-video-mobile.spec.ts` | ? | ⏳ | |
| `dance-video-realtime.spec.ts` | ? | ⏳ | |
| `dance-video-review-comments.spec.ts` | ? | ⏳ | |
| `dance-video-virtualization.spec.ts` | ? | ⏳ | |
| `dance-team-invite-flow.spec.ts` | ? | ⏳ | |

## 2. Batch-kjøringer

### Batch 1 — Core Role Room (kjører nå, ~10 min)
8 specs: smoke, story-logic-secure-sync, role-room-workflow, casting-project-sync-persistence, creatorhub-login-flow, role-room-clarity-smoke, role-room-api-integration, story-logic.

Resultater: ⏳ Pågår

### Batch 2 — Producer/storyboard (ferdig)
Specs: producer-client-review-overview, producer-export-handoff, production-manuscript-view, production-team-demo-isolation, client-media-workspaces, shotlist-storyboard-bridge, role-room-live-set, role-room-troll-demo-seed.

**Resultater: 55 passed, 16 failed, 4 skipped (6.3 min).**

| Spec | Pass/Fail | Rot-årsak |
|---|---|---|
| `producer-client-review-overview.spec.ts` | ✅ | — |
| `producer-export-handoff.spec.ts` | ✅ | — |
| `production-manuscript-view.spec.ts` | ✅ | — |
| `production-team-demo-isolation.spec.ts` | ✅ | — |
| `client-media-workspaces.spec.ts` | ⚠️ (1 fail) | Mangler seedet prosjekt — A.6-helper løste mount, men test trenger data |
| `shotlist-storyboard-bridge.spec.ts` | ❌ (4 fail) | Samme seedet-data-mangel |
| `role-room-live-set.spec.ts` | ❌ (9 fail) | SEO landingssider (`/vs-studiobinder`, `/vs-castingnetworks`, etc.) + `robots.txt`/`llms.txt`/`sitemap.xml` mangler i dev-server. **Ikke role-room-koden — SEO-infra.** |
| `role-room-troll-demo-seed.spec.ts` | ❌ (1 fail) | Krever prod-backend (treffer DB) |

### Batch 3 — Story Arc + cross-cutting (ferdig)
Specs: story-arc-regression, story-arc-edit-tools-isolated, professional-timeline-render-budget, universal-dashboard, universal-showcase-sync, role-room-ga4-events, role-room-cms-r2-upload, crew-team-dashboard-flow.

**Resultater: 106 passed, 8 failed, 6 skipped (6.4 min). 🏆 Beste batch.**

| Spec | Pass/Fail | Rot-årsak |
|---|---|---|
| `story-arc-regression.spec.ts` | ⚠️ (2 fail) | 1: ffmpeg-fixture-video mangler (extern dep). 1: `getByText('Story Arc Studio')` timeout |
| `story-arc-edit-tools-isolated.spec.ts` | ⚠️ (1 fail) | ffmpeg-fixture mangler |
| `professional-timeline-render-budget.spec.ts` | ⚠️ (3 fail) | **Reelle perf-issues!** playhead/hover/drag overskrider frame-budget |
| `universal-dashboard.spec.ts` | ✅ | — |
| `universal-showcase-sync.spec.ts` | ✅ | — |
| `role-room-ga4-events.spec.ts` | ⚠️ (1 fail) | `role_room_project_created` event fires ikke ved "Nytt prosjekt" submit |
| `role-room-cms-r2-upload.spec.ts` | ✅ | — |
| `crew-team-dashboard-flow.spec.ts` | ⚠️ (1 fail) | Mangler seedet data — A.7-arbeid |

### Egne sprinter (excluded fra baseline)
- `role-room-comprehensive.spec.ts` (97 tester) — egen workflow-trigger
- `role-room-full.spec.ts` (51 tester) — egen workflow-trigger
- `storyboard-drawing-editor.spec.ts` (75 visual baselines) — etter snapshot-rebaseline
- Academy + Dance verticals — egne owner-teams

## SLUTT-SUMMARY: 24 specs av 79 baselinet

**Totale resultater på tvers av batch 1-3:**

| Batch | Specs | Tester | Pass | Fail | Skipped | Wall-tid |
|---|---|---|---|---|---|---|
| 1 (core) | 8 | 73 | 37 | 29 | 7 | 10.7 min |
| 2 (producer/storyboard) | 8 | 75 | 55 | 16 | 4 | 6.3 min |
| 3 (story-arc/cross) | 8 | 120 | 106 | 8 | 6 | 6.4 min |
| **Totalt** | **24** | **268** | **198** | **53** | **17** | **23.4 min** |

**Pass-rate: 74%** (198 av 268 tester).

### Top fail-kategorier
1. **`gotoCastingPlanner`-helper venter på subtittel** (28 tester) — FIKSET i Sprint A.6 (mount-fasen). Underliggende data-seed-issue krever Sprint A.7.
2. **Manglende seedet data i test-harness** (~10 tester) — `selectFirstProject` finner ingen `<li>`.
3. **SEO landingssider mangler i dev-server** (9 tester) — `/vs-*` URLer + robots.txt/llms.txt/sitemap.xml ikke konfigurert. Ikke role-room-bug.
4. **Externe deps (ffmpeg-fixture)** (2 tester) — story-arc trenger video-fil generert.
5. **Reelle perf-issues** (3 tester) — `professional-timeline-render-budget` overskrider frame-budget. **Verdt å adressere.**
6. **GA4 event-fyring** (1 test) — `role_room_project_created` fyrer ikke.
7. **Krever prod-backend** (1 test) — `troll-demo-seed` treffer DB.

## 3. Vedlikehold

Per PR:
- [ ] Kjør "core" batch-en (8 specs) hvis PR berører role-room-koden
- [ ] Hvis spec endrer status → oppdater denne fila

Ukentlig:
- [ ] Kjør full liste-batch (~30 specs)
- [ ] Hvis tester begynner å flakke → flytt til "PARTIAL"-kategorien
- [ ] Hvis ny spec er PASS i 3 uker → graduerer til ✅

## 4. Connection til audit

Denne fila er den konkrete realiseringen av:
- `stabilitetsaudit.md § 8.1` — Pre-existing failing tests baseline
- `stabilitetsaudit.md § 8.2` — Test-harnesser audit
- `stabilitetsaudit.md § 8.4` — Coverage på state-overgang-grenser

Når en ny e2e blir lagt til skal den legges i denne fila samme dag.
