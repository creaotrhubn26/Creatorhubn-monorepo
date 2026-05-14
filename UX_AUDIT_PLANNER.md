# UX-audit — Casting Planner (alle moduser)

> Audit-dato: 2026-05-14
> Scope: produksjonsteam · innholdsprodusent · dansestudio
> Etter dagens commit-bølge — flere prod-bugs fikset, ny UX-fundament

---

## 1. Workflow-gaps (utenfor visuell UX)

### A. Demo-seed / data-rendering
| Status | Beskrivelse | Påvirker |
|---|---|---|
| ✅ Fikset (f14615c5) | `castingDbService.getCastingProjectsFromDb` forventet `[...]` men backend returnerer `{ projects: [...] }` → alle prosjekt-views var tomme | Alle moduser |
| ⚠️ Mulig gjenstående | Troll-seed med ownerId="demo-user" kan filtreres bort i prosjektliste hvis frontend gjør ownership-filter. Bruker session-user-id, vil seed-user-id mismatche | Alle moduser |
| ⚠️ Story-logic 404 | `/api/role-room/projects/.../story-logic` returnerer 404 for projects uten content. Service håndterer det riktig men console-noise gir feilinntrykk | Story-fokuserte moduser |

### B. Auth-bevissthet
| Status | Beskrivelse |
|---|---|
| ✅ Fikset (8bca823a) | AdminRoom-gate leste feil localStorage-keys → Google-login fungerer nå |
| ⚠️ Gap | Mange components leser bare userId, ikke email. Hvis userId mismatch mellom seed og logged-in user, ser man tomme paneler uten feilmelding |
| ⚠️ Gap | Ingen tydelig "Du er ikke logget inn"-tilstand før paneler prøver å laste data |

### C. Stale chunks
| Status | Beskrivelse |
|---|---|
| ✅ Fikset (58620e8e) | `lazyWithRetry` håndterer "Failed to fetch dynamically imported module"-feil etter deploy |

---

## 2. Per mode-analyse

### 🎬 Produksjonsteam (klassisk casting-flyt)
**Hovedflyt:** Roller → Kandidater → Auditions → Casting-call → Crew → Lokasjoner → Plan

**Sterke sider:**
- ✅ Komplett pipeline fra rolle til opptaksdag
- ✅ Live Set Mode for selve opptaksdagen
- ✅ DIT-backup-system kjedet til kameraer

**UX-svakheter:**
1. **Navigasjons-trøtthet** — 16K-linje-komponent, tab-systemet har 8+ hovedtabs og sub-tabs. Bruker mister oversikt over hvor de er.
2. **Søk er ikke globalt** — å finne en spesifikk kandidat krever å åpne riktig prosjekt, riktig rolle, riktig view.
3. **Endre-tilstand er destruktiv** — drag-and-drop i Kanban skifter status uten tydelig "angre"-flyt.
4. **Manglende empty-states** — tomme paneler viser bare blanke felt, ikke onboarding-prompter.
5. **Status-piler henger igjen** — etter handlinger oppdateres state, men UI-en re-rendrer ikke alltid umiddelbart.

**Anbefalinger (prioritert):**
- P0 — Cmd+K command palette med global søk (UX-4)
- P0 — Empty-states med "Opprett første X"-prompts (UX-2)
- P1 — Breadcrumb-bar som viser hvor du er
- P1 — Undo-knapp eller toast med "Angre" etter destruktive handlinger
- P2 — Bredere bruk av optimistic updates

### 🎥 Innholdsprodusent (Content Producer)
**Hovedflyt:** Brief → Story → Storyboard → Shotlist → Plan → Klient-godkjenning → Levering → Økonomi

**Sterke sider:**
- ✅ Sammensatt content-pipeline (brief → story-logic → manus → storyboard → shotlist)
- ✅ Klient-godkjenning innebygd i flyten
- ✅ Økonomisenter med fakturering

**UX-svakheter:**
1. **Story-verktøy fragmentert** — Story Writer, Sceneliste, Story Logic, Storyboard er separate verktøy men deler underliggende data. Ikke alltid klart for bruker når de skal hoppe mellom dem.
2. **Klient-portal koblet løst** — invitasjon til klient skjer fra én tab men respons-status vises på en annen.
3. **Brief-prosjektkobling** — Producer-demoen seeder brief + andre felter, men det er ikke en tydelig "Brief →" knapp som starter neste fase.
4. **Tab-rad overflod** — 5 hovedtabs + Story-tools + Plan-knapper = ~12 trykk-mål på samme rad.
5. **Animasjon ved tab-switch** — vi fikset shake, men perceived-latency er fortsatt høy.

**Anbefalinger:**
- P0 — Workflow-progress-bar som viser hvor i pipeline man er
- P0 — Klient-godkjenning-status synlig på alle relevante tabs
- P1 — Story-verktøy som vertikal sidebar (slik vi har vurdert workspace-modus)
- P1 — Skeleton-states ved tab-switch (UX-3)
- P2 — Animert workflow-stepper øverst

### 💃 Dansestudio
**Hovedflyt:** Klasser → Elever → Koreografi → Skriv → Audition → Forestillinger

**Sterke sider:**
- ✅ DanceWorkspace replacement når professionMode = dance_*
- ✅ Dedikert vertikal — slipper irrelevante casting-features

**UX-svakheter:**
- Vanskelig å granske uten admin-auth, men generelt: samme felle som content-producer mhva tab-trøtthet
- Mangler tydelig "studio-modus" vs "produksjons-modus"-skille

**Anbefalinger:**
- P1 — Onboarding-tour spesifikt for dance-modus
- P2 — Egen "studio-dashboard" med klasse-kalender som primært element

---

## 3. Stabilitet — workflow stability

### Identifiserte risikoer
| Risk | Sannsynlighet | Konsekvens | Mitigasjon |
|---|---|---|---|
| Drag-and-drop endring uten persist-feedback | Høy | Bruker tror handlingen feilet, dobbel-aksjon | Optimistic-update + toast |
| Tab-switch under autosave | Mid | Data-tap | Block-tab-switch under save, vis spinner |
| Browser-back midt i edit-modus | Høy | Mister edits | Detect unsaved + prompt |
| Stale chunks etter deploy | ✅ Fikset | — | lazyWithRetry |
| Story-logic 404 logges som feil | Lav | Bruker tror noe er ødelagt | Stillere håndtering |
| Auth-mismatch ved Google-login | ✅ Fikset (admin) | — | getCurrentUserEmail med flere keys |
| Auth-mismatch i prosjekt-ownership | Mid | Tomme paneler etter login | Standardiser userId-source |
| Manglende loading-states på tab-switch | Mid | Bruker antar tomt prosjekt | Skeleton-fallbacks |
| Concurrent editing i flere fane | Lav | Overwrite-konflikt | Last-write-wins er greit for nå |

### Audit-funn
- **Ingen sentral error-boundary rundt hovedpaneler** — én feil = hele Planner krasjer (det finnes en ErrorBoundary, men ikke wired overall)
- **Console-warnings i prod** (404-noise) — gir falsk inntrykk av at noe er ødelagt
- **State som persister i localStorage** kan bli korrupt over tid (workspaceState, pinnedProjects) — ingen versjons-migrasjon

---

## 4. Foreslått sprint-plan (3-5 fokuserte fikser i denne sesjonen)

### Sprint 1 — Stabilitet + tydelighet (~2 t)
1. **Story-logic 404 console-noise** — silence den uten å miste meningsfull error-info
2. **Empty-state-komponent** — én reusable, brukt i 3 mest sårbare paneler (Roller, Kandidater, Storyboard)
3. **Project-ownership-debug-toast** — når et prosjekt åpnes uten å laste paneler, vis "Du har ikke tilgang"-feedback i stedet for å bare være tomt

### Sprint 2 — Navigasjon (~2-3 t)
4. **Cmd+K command palette** — global søk på prosjekter + kandidater + tab-bytte
5. **Breadcrumb-bar** — viser nåværende plassering

### Sprint 3 — Workflow-progress (~3 t)
6. **Workflow-stepper for content-producer** — visualiserer brief → story → storyboard → klient → levering → økonomi
7. **Klient-status-badge på alle relevante tabs**

### Sprint 4 — Polering (~2 t)
8. **Skeleton-states ved tab-switch**
9. **Toast-system for AI-anbefalinger** (forberedelse til onboarding-tour senere)

### Stoppet/utsatt
- **Full onboarding-tour** — 1-2 dager arbeid, neste sesjon
- **Workspace-modus med sidebar-nav** — stor refaktor, etter dette
- **Real screenshots på landing** — krever admin-session-cookie fra deg

---

## 5. Hvordan vi vil oppdage workflow-gaps systematisk

Forslag:
- **Klikk-stien-test:** Brukerstier (story-A: "Lag prosjekt + cast 3 roller", story-B: "Levere ferdig film til klient") kjøres som Playwright e2e — hvert klikk loggføres. Stier som krever > 8 klikk eller mer enn 30 sekunder = flag for forenkling.
- **Clarity heatmap-audit:** Microsoft Clarity er allerede installert. Se etter rage-clicks (gjentatte klikk på samme element = forvirring) og dead-clicks (klikk på ikke-interaktive elementer).
- **Console-error tracking** — koble Clarity til console.error-events for å se hvor i flyten brukerne treffer fail-states.

---

## 6. Hva neste sesjon

1. Du godkjenner denne planen (eller endrer prioritering)
2. Jeg kjører Sprint 1 (~2 timer) i én commit-runde
3. Smoke-test + verifiser
4. Sprint 2 hvis tid + energi

**Anbefaling akkurat nå** — ta pause. Det er 04:30. Vi har gjort 14+ commits på en lang sesjon. Risiko for å introdusere bugs øker eksponentielt etter kveldstimer. Neste sesjon kan jeg gå inn frisk på Sprint 1.
