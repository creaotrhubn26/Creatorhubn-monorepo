# Stabilitetsaudit — The Role Room
> **Audit-dato:** 2026-05-14
> **Auditør:** System-arkitekt-rollen (Claude Opus 4.7)
> **Scope:** The Role Room frontend + backend + integrasjoner, e2e
> **Eier (fremover):** Daniel Qazi (daniel@creatorhubn.com)

---

## 0. Hvordan lese dette dokumentet

Dette er en levende kontrakt for stabiliteten i The Role Room. Den har tre formål:

1. **Identifisere** konkrete kilder til ustabilitet med kode-referanser
2. **Klassifisere** dem etter alvorlighetsgrad og sannsynlighet
3. **Foreskrive** fixer + prosesser som hindrer regresjon

**Når noe knekker i prod:** Slå opp symptom-tabellen (§ 11), finn den passende seksjonen, kjør fix-resepten. Hvis det ikke står her — legg det til etter at det er løst.

**Når du legger til kode:** Sjekk at endringen ikke åpner én av kategoriene i § 2–§ 8. Hvis den gjør det, dokumenter avbøtende tiltak i PR-en.

---

## 1. Executive Summary

The Role Room er stabil **i happy-path**, men har strukturelle svakheter som gjør at den blir ustabil under:
- Nettverks-degradering (Render-backend som sover, WebSocket-failures, 4xx-API-respons)
- Endringer i schema/feltnavn (localStorage og JSON-payloads har lite versjonering)
- Re-bruk på tvers av modus (content-producer / production-team / klient / dance) — én flagg gir 4 forskjellige UI-er
- Auth-state-divergens (samme bruker har data på 6+ localStorage-nøkler som kan komme ut av synk)

**De fem viktigste stabilitetsbrudd-mekanismene** observert i kodebasen:

| # | Mekanisme | Lokasjon (eksempel) | Konsekvens |
|---|---|---|---|
| 1 | WebSocket-reconnect-storm | `useKanbanRealtime.ts` (fikset Sprint 7.4) | Console-spam, ~5% CPU, batterilekkasje |
| 2 | localStorage-state-divergens | `creatorhub_auth_*` + `userId` + `userEmail` + `role_room_auth_*` (6+ keys) | Bruker virker logget inn men paneler tomme |
| 3 | API-contract-drift | Frontend kaller `/api/role-room/favorites/...`, backend hadde kun `/api/casting/favorites/...` (fikset Sprint 7.4) | 404 → silent failure → tom UI |
| 4 | Stale chunk etter deploy | Vercel CDN serverer nye chunks, gammel kode i fanen — fikset av `lazyWithRetry` | "Failed to fetch dynamically imported module" |
| 5 | Race i demo-seed | Troll-data lastet før user-session etablert → ownerId-mismatch | Tomme paneler uten feilmelding |

**Total kode-helsa:**

| Metrikk | Verdi | Vurdering |
|---|---|---|
| `// @ts-nocheck`-filer (role-room) | **108** | 🔴 Type-sikkerhet er av i flertallet |
| Mega-filer (>10K linjer) | **5** (top: FrameDrawingEditor 18K, CastingPlannerPanel 17K) | 🔴 Vanskelig å revidere/teste |
| `} catch {}`-silent-fails (frontend) | **321** | 🟠 Mange feil dør stille |
| `setTimeout`/`setInterval` | **255** | 🟠 Memory-leak-risiko |
| Raw `pool.query` (backend) | **694** | 🟠 Ingen ORM-validering |
| `localStorage`-auth-keys (alle) | **704** | 🔴 State spredt overalt |
| Backend `index.ts` lengde | **102 672 linjer** | 🔴 Ekstrem mega-fil |
| Drizzle ORM-bruk vs raw | **47 / 694** | 🟠 ~93% raw SQL |
| Sentry/error-tracking integrasjoner | **16** | 🟠 Tynn observability |
| Migrations (SQL) | 179 filer | ✅ Pen historikk |
| E2e specs | 79 | ✅ Pen dekning |
| Vitest unit-tester | 59 | 🟠 Burde være 3-5x |

**Eksisterende e2e-stabilitet (per Sprint 5 audit):**
- `role-room-workflow.spec.ts`: 20/20 var FAILED før Sprint 5.2 (test-harness manglet providere). Nå 20/20.
- `threeActs.test.ts`: 2/6 FAILED før Sprint 5.1 (Cobb-navn for kort). Nå 6/6.
- `storyboard-drawing-editor.spec.ts`: 75 tester, kun 1 spot-checked passerer. **Resten ukjent.**

---

## 2. Stabilitetsprinsipper (manifest)

Disse 12 prinsippene er kontrakten. Ingen PR skal merges hvis den bryter ett uten avbøtende tiltak.

### 2.1 Én kilde til sannhet per state-bit
Hver state-bit (currentUserId, projectId, authToken) har ÉN kanonisk lagring og ÉN getter. Alt annet er derivert.
**Bryter:** Auth-state er spredt på `creatorhub_auth_user`, `creatorhub_auth_token`, `userId`, `userEmail`, `role_room_auth_token`, `role_room_auth_session`, plus `window.__currentUserId`.

### 2.2 Failure-modus skal være eksplisitt
`} catch {}` er forbudt unntatt for genuinly best-effort-operasjoner (telemetri, dedup-cache). Alltid logg + report.

### 2.3 Schema-versjonering på alle persisterte data
Alt som lagres i localStorage / IndexedDB / cookies har en `__v`-versjon og en migrasjons-kjede. Bruker `createVersionedStorage` (Sprint 6.10).

### 2.4 Idempotent retries med budsjett
Retry-loops skal ha eksponentiell backoff + max-attempts. Etter budsjett-overskridelse: gi opp, log warning, gi bruker mulighet å manuelt retry. (Eks: WebSocket-fix Sprint 7.4)

### 2.5 Failures degraderer, krasjer ikke
Hver Suspense-grense har en ErrorBoundary. Hver async-operasjon har et fallback-UI. Et panel som feiler skal aldri ta ned Planner.

### 2.6 Network er upålitelig
All API-kall håndterer 4xx, 5xx, timeout og offline. Optimistiske oppdateringer kan rolles tilbake.

### 2.7 Pure → testable → stable
Komponenter med business-logic-funksjoner > 10 linjer skal ha ekstrahert pure helper med unit-test (mønster: `evaluateProjectOwnership`, `deriveActiveWorkflowStep`).

### 2.8 Type-sikkerhet over kommentarer
`// @ts-nocheck` er en stabilitets-debt. Nye filer er ALDRI nocheck. Eksisterende reduseres månedlig.

### 2.9 Mega-filer er anti-stabilitet
Filer > 1500 linjer er per definisjon vanskelige å revidere → høy risiko for regresjon. Refaktor over tid.

### 2.10 Schema-endringer er reversible
DB-migrasjoner: `IF NOT EXISTS` + `ADD COLUMN` + idempotente. Aldri `DROP COLUMN` uten 2-deploy-cycle. (Pattern: 146_cms_pages_published_column.sql)

### 2.11 Observability før features
Hver nye user-flow får telemetri: success-rate, latency, error-class. Hvis vi ikke kan se det knekke, kan vi ikke fikse det.

### 2.12 E2e-stabilitet > funksjons-bredde
En knust e2e er en stabilitet-skyldnoen. Aldri merge over rød e2e. Hvis testen er flaky: fix testen eller systemet, ikke skip.

---

## 3. Severity & Probability classification

Alle funn i denne audit-en er klassifisert med `(S, P, K)`:

- **S — Severity** (hvis det skjer, hvor ille er det?):
  - `S1` = data-tap eller crash-loop som blokkerer alle brukere
  - `S2` = funksjonalitet utilgjengelig for én bruker / sesjon
  - `S3` = degradering (tregt, ekstra klikk, console-spam)
  - `S4` = kosmetisk

- **P — Probability** (hvor ofte trigger?):
  - `P1` = > 50% av brukere uker
  - `P2` = 10-50% av brukere
  - `P3` = < 10% (edge-cases)
  - `P4` = < 1% (perfect-storm)

- **K — Kategori** (hvor passer det i taksonomien §4–§8):
  - `K-FE` = Frontend state/render
  - `K-BE` = Backend
  - `K-NET` = Network/integrasjon
  - `K-DATA` = Demo/seed/migrasjon
  - `K-TEST` = Test/CI
  - `K-DEPL` = Deploy/release

**Prioritet** = `S × P`. S1×P1 og S1×P2 må adresseres umiddelbart. S2×P3 kan vente til neste sprint. S4×P4 noteres men ikke planlegges.

---

## 4. Frontend stabilitet (K-FE)

### 4.1 Auth-state divergens — `(S1, P2, K-FE)` 🔴 HØY PRIORITET
**Lokasjon:** `EnhancedMasterIntegrationProvider.tsx:35-50`, `contexts/AuthContext.tsx`, `CommunicationStatusContext.tsx:57-62`, `authSessionService.ts`, `settingsService.ts`

**Symptom:** Bruker er logget inn, men paneler er tomme eller redirecter til login. Sprint 1.3 ownership-toast var en delvis avbøtning.

**Mekanisme:** Vi har 6+ separate localStorage-nøkler som inneholder bruker-info:
```
creatorhub_auth_token            ← App-level token
creatorhub_auth_user             ← App-level user-objekt (JSON)
userId                           ← Legacy direkte string
userEmail                        ← Legacy direkte string
role_room_auth_token             ← Role Room session-token
role_room_auth_session           ← Role Room session-objekt (JSON)
+ window.__currentUserId         ← In-memory mirror
```

Hver komponent leser i sin egen rekkefølge. Når én oppdateres uten å bli reflektert i de andre → divergens.

**Konkret eksempel:** I `EnhancedMasterIntegrationProvider:50` leses email i denne prioriteten:
```
1. creatorhub_auth_user.email
2. userId
3. userEmail
```
Men `CastingPlannerPanel` leser fra `adminUser` (React state) som ikke alltid speiler localStorage etter første render.

**Fix-resept (3-stegs):**
1. **Kort sikt (1 dag):** Lag `authStateService.ts` med kanonisk `getAuthSnapshot(): { userId, email, displayName, tokens }` som leser fra alle kilder med deterministisk prioritet. Alle andre lesere kalles fra denne.
2. **Mellomlang sikt (1 uke):** Refaktor alle direkte `localStorage.getItem('userId')` til å gå gjennom service. Skriv unit-tester for prioritet.
3. **Lang sikt (1 sprint):** Konsolidér til ÉN nøkkel `creatorhub:auth-state` med versjonert envelope (bruk `createVersionedStorage`). Legacy keys synkroniseres ved oppstart men leses ikke.

---

### 4.2 Mega-komponent ustabilitet — `(S2, P1, K-FE)` 🔴
**Lokasjon:**
- `CastingPlannerPanel.tsx` — **17 207 linjer**
- `FrameDrawingEditor.tsx` — **18 098 linjer**
- `ProducerMediaPanel.tsx` — **16 295 linjer**
- `EquipmentManagementPanel.tsx` — **10 437 linjer**
- `ProductionManuscriptView.tsx` — **10 210 linjer**

**Symptom:** Små endringer trigger regresjoner i urelaterte panels. Re-renders cascade på tvers av tabs. TypeScript er av (`// @ts-nocheck`) i alle disse.

**Mekanisme:**
- 17K-linje komponenter har 100+ useState/useRef. State-co-location-fordelene fra React forsvinner.
- Cross-cutting bekymringer (auth, modus, viewport) leses fra mange ulike hooks i ulike rekkefølger
- Memoization-hints (`useMemo`, `useCallback`) blir til invariantene-bryter-mål: én endring i deps-array kan trigge re-render i halve appen.

**Fix-resept:**
1. **Akutt:** ErrorBoundary rundt hver TabPanel + Suspense fallback skeleton (Sprint 4.1 + 5.4 har dette i hovedfrontene — utvid til alle ~16 TabPanels).
2. **Sprint:** Ekstraher pure business-logikk til utils (mønster fra Sprint 1.3 + 3 + 6.10). Mål: hver mega-komponent skal ha minst 30% av logikken testbar uten React.
3. **Kvartal:** Slice mega-komponentene. `CastingPlannerPanel` kan brytes til ~16 sub-komponenter (én per tab). Krever varsom refaktor; bygg én ny sub-komponent per uke, behold mega-komponenten som orkestrator inntil alle er ute.

---

### 4.3 Memory-leak fra timers — `(S3, P2, K-FE)` 🟠
**Symptom:** Etter 30+ min bruk: UI tregere, batteri trekker raskere, GC pauser.

**Mekanisme:** **255 setTimeout/setInterval** i role-room-koden. Mange er korrekt clean-uppet i `useEffect`-cleanup, men noen er ikke. Eks: gamle drag-handlers, autosave-debouncere.

**Søk-mønster for å finne lekkasjer:**
```bash
# Hver setTimeout/setInterval skal ha clearTimeout/clearInterval
grep -n "setTimeout\|setInterval" <file> | wc -l
grep -n "clearTimeout\|clearInterval" <file> | wc -l
# Ratio < 1: leakage-risiko
```

**Fix-resept:**
1. Bygg helper `useTrackedTimeout(fn, delay)` som auto-clears på unmount.
2. Migrer eksisterende usecases gradvis.
3. Legg til devtools-warning hvis komponent-unmount etterlater > 5 pending timers.

---

### 4.4 Silent failures (`} catch {}`) — `(S2, P2, K-FE)` 🟠
**Tall:** 321 silent-catch-patterns i role-room.

**Symptom:** Knapper slutter å fungere, lagring feiler stille, UI-state divergerer fra DB.

**Fix-resept:**
1. **Akseptable silent-fails** (whitelist): localStorage-read i SSR-context, dedup-cache write.
2. **Forbudte silent-fails:** alle API-kall (må vise toast eller logge til Sentry), alle save-handlers, alle navigasjon-utløsende handlere.
3. **Lint-regel:** Lag eslint-rule som flagger `catch {}` uten kommentar — krev en `/* expected: ... */` for whitelist.

---

### 4.5 Re-render storms — `(S3, P2, K-FE)` 🟠
**Symptom:** Tab-switch tar 500ms+, drag-handler er laggy, mobil får frame drops.

**Mekanisme:** Mega-komponenter med 100+ state-variabler trigger re-render av hele subtreet på hver setState. `useMemo` deps inkluderer ofte hele objekter i stedet for primitives.

**Diagnostikk:**
```bash
# I dev tools, profile en tab-switch.
# Hvis > 50 komponenter re-renderer for én user-action → re-render-storm.
```

**Fix-resept:**
1. Bruk React DevTools profiler systematisk — fang konkrete eksempler.
2. Splitt mega-state med `useReducer` per tema (auth-state, project-state, ui-state).
3. Migrer kandidat- og role-listene til `react-virtuoso` der det er > 50 items.

---

### 4.6 Stale chunks etter deploy — `(S2, P1, K-FE)` ✅ FIKSET
**Status:** Fikset i commit `58620e8e` via `lazyWithRetry` som retry-er `Failed to fetch dynamically imported module` med eksponentiell backoff.

**Hva som kan re-introdusere:**
- Hvis Vercel CDN deler ut nye chunks før HTML er invalidert
- Hvis vi legger til ny `lazy()` uten å bruke `lazyWithRetry`-wrapperen

**Vakthold:** PR-mal må kreve `lazyWithRetry` for nye lazy imports.

---

## 5. Backend stabilitet (K-BE)

### 5.1 Mega-index.ts — `(S2, P3, K-BE)` 🔴
**Lokasjon:** `backend/server/index.ts` — **102 672 linjer**.

**Symptom:** Endringer her gir lange CI-build-tider. Risiko for shadow-bugs der to handlers registrer samme path. TypeScript-checking på filen tar > 30s og spiser 8GB RAM (vi måtte bruke `NODE_OPTIONS=--max-old-space-size=8192` for typecheck).

**Mekanisme:** Alle 239+ endpoints er flate i ÉN fil. Den eksisterende `casting-misc-routes.ts`, `role-room-routes.ts` etc. er en god start (Phase 2-refactor `efb7f19f`), men majoriteten av endpoints lever fortsatt i index.ts.

**Fix-resept:**
1. Identifiser endpoints som hører sammen tematisk: `role-room-tickets`, `role-room-tester-invites`, `casting-favorites`, etc.
2. Flytt til dedikerte route-filer som eksporterer setup-funksjoner.
3. Pre-flight-sjekk for duplicate path-registreringer ved boot (logg warning).

---

### 5.2 Raw SQL uten typesikker ORM — `(S2, P3, K-BE)` 🟠
**Tall:** **694 `pool.query`** vs **47 drizzle imports**.

**Symptom:** Schema-endringer i én tabell oppdager vi først i runtime (`column "foo" does not exist`).

**Mekanisme:** Vi har Drizzle schemas i `backend/migrations/role-room-schema.ts`, men brukes lite. Mest direkte SQL-string-interpolasjon (`pool.query('SELECT * FROM ...', [params])`).

**Fix-resept:**
1. Hver ny endpoint som lager nye queries SKAL gå via drizzle eller skrive integration-test.
2. Eksisterende: prioriter handlerne som har høyest call-volume. Migrer over flere sprinter.
3. Legg til `pg-schema-validator` som CI-step: leser alle migration-filer + sjekker at frontend types er konsistente.

---

### 5.3 Migration-fragmentering — `(S2, P3, K-BE)` 🟠
**Lokasjon:** 5 forskjellige migration-script i backend/:
- `migrate-smart.js`
- `migrate-with-schema-mapping.js`
- `migrate-database.js`
- `migrate-database-auto.js`
- `migrate.sh`

**Symptom:** Ingen vet hvilken som er "den rette". Migration 141 ble markert som applied selv om kolonner ble lagt til senere (eksisterende eksempel i `146_cms_pages_published_column.sql`).

**Fix-resept:**
1. Konsolidér til ÉN canonical migrate-runner (foreslag: `migrate.sh` siden den er sist).
2. Slett de andre.
3. Bytt fra "filnavn-basert applied"-tracking til "checksum-basert" — så endringer i en fil etter at den er kjørt blir oppdaget.

---

### 5.4 Ensure-table-IF-NOT-EXISTS som migration-pattern — `(S3, P2, K-BE)` 🟠
**Tall:** **19 forekomster** av `CREATE TABLE IF NOT EXISTS` i `index.ts` (inkludert min Sprint 7-tilføyelse).

**Symptom:** Tabeller opprettes ved første request, men hvis migrasjon-driveren feiler kan vi ende opp med tabeller med gammelt schema.

**Mekanisme:** Vi har dette mønsteret som "soft migration" — bra for raskt prototyping, dårlig for produksjons-integritet.

**Fix-resept:**
1. Behold IF-NOT-EXISTS som boot-safety-net.
2. Sørg ALLTID for at en formell migration-fil finnes (har lagt til 147 + 148 for Sprint 7).
3. Lag CI-check: alle `CREATE TABLE IF NOT EXISTS` i kode → finnes en matching migration-fil? Hvis ikke, fail PR.

---

### 5.5 Backend silent-catch (744 forekomster) — `(S2, P2, K-BE)` 🟠
**Symptom:** Endpoints svarer "ok" når de egentlig feilet, eller returnerer tomme arrays i stedet for 500.

**Mekanisme:**
```ts
try {
  // ...
} catch (err) {
  console.error("...", err);
  res.json([]);  // ← Returner tom liste, ingen indikasjon på feil
}
```

**Fix-resept:**
1. Endre alle slike steder til returnere `503` + retry-after-header.
2. Logg til structured logger (ikke bare console.error som forsvinner i Render).
3. Frontend kan da skille mellom "data finnes ikke" og "vi kan ikke nå databasen".

---

## 6. Network / integrasjon stabilitet (K-NET)

### 6.1 WebSocket reconnect-storm — `(S2, P2, K-NET)` ✅ FIKSET (Sprint 7.4)
**Lokasjon:** `useKanbanRealtime.ts`

**Status:** Fikset. Max 5 raske failures innen 60s → gir opp.

**Re-introduksjons-risiko:**
- Hvis vi legger til flere WS-baserte hooks uten å bruke samme give-up-pattern
- Hvis Render restarter Free-tier-instansen (vil trigge force-reconnect ved neste user-action)

**Vakthold:** Felles `createBudgetedReconnect` helper for alle WS-hooks (`useShotListRealTime`, `liveSetRealtimeService`).

---

### 6.2 API-contract-drift — `(S1, P2, K-NET)` ✅ DELVIS FIKSET (Sprint 7.4)
**Status:** Favorites-endpoint hadde split-personality (`/api/role-room/favorites` vs `/api/casting/favorites`). Lagt til path-alias i Sprint 7.4.

**Re-introduksjons-risiko:** HØYT. Vi har 100+ frontend → backend kall som ikke har contract-tests.

**Fix-resept:**
1. **Akutt:** Stub-list over alle endpoints som frontend kaller med base-prefix.
2. **Kort sikt:** Endpoint-survey-script som kjører alle `apiRequest` mot backend og logger 404.
3. **Lang sikt:** Generer typer fra OpenAPI / Drizzle. Frontend SDK genereres fra backend-route-definisjoner.

---

### 6.3 Cross-origin / CDN-cache — `(S2, P3, K-NET)` 🟠
**Symptom:** Vercel frontend kaller theroleroom.com som CDN — Render backend som API. Failures i edge-rewrite gjør at /api-kall returnerer HTML.

**Mekanisme:** Bruker er på `theroleroom.com`, frontend trenger `/api/role-room/...`. Vercel rewrite-konfigurasjon må peke til Render-instansen. Hvis rewrite-regel mangler eller har feil URL → CDN serverer index.html i stedet for å proxy.

**Fix-resept:**
1. Lag e2e-smoke som verifiserer at en GET /api/role-room/health returnerer JSON (ikke HTML) fra theroleroom.com.
2. Sentry-alarm hvis frontend mottar `Content-Type: text/html` på `/api/`-respons.

---

### 6.4 Render Free-tier sleep — `(S2, P2, K-NET)` 🟠
**Symptom:** Første request etter 15 min idle tar 30-60s, brukeren ser hvitt skjerm.

**Mekanisme:** Render free-tier suspenderer instansen etter inaktivitet. Første request våkner den.

**Fix-resept:**
1. **Akutt:** Skeleton-states (Sprint 4.1) gir noe tilbakemelding i ventetiden.
2. **Mellomlang:** Pinger backend hver 10. minutt fra Vercel cron eller eksternt (UptimeRobot).
3. **Lang sikt:** Oppgrader Render til paid plan ved produksjons-launch.

---

### 6.5 OAuth callback-stabilitet — `(S2, P3, K-NET)` 🟠
**Lokasjon:** `/api/role-room/google/oauth/start`, `/linkedin/oauth/start`, callbacks i frontend.

**Symptom:** Bruker fullfører OAuth → kommer tilbake → blir omdirigert til login igjen.

**Mekanisme:** State-cookie kan utløpe under OAuth-roundtrip. CSRF-state-mismatch hvis bruker har flere fane åpne.

**Fix-resept:**
1. Lengre state-cookie-levetid (10 min, ikke 5).
2. Tilstand-binding til sesjons-ID, ikke kun cookie.
3. Telemetri: success-rate per OAuth-provider, alert om < 95%.

---

## 7. Demo / seed-data stabilitet (K-DATA)

### 7.1 Demo-seed race med session — `(S2, P2, K-DATA)` 🟠
**Lokasjon:** `castingService.ts:3961` (Troll-demo-seed), `producerDemo.ts`

**Symptom:** Bruker logger inn første gang, ser tom dashboard, må refreshe to ganger før Troll-data dukker opp.

**Mekanisme:** Demo-seed sjekker `isRoleRoomDemoSeedAllowed()` som leser fra session. Session blir etablert asynkront. Race: seed kjører før session er klar → `ownerId` blir feil → demo-data filtreres bort av panel.

**Fix-resept:**
1. Vent eksplisitt på `authSessionService.ready()` før noen demo-seed.
2. Hvis seed feiler en gang, retry ved neste `authSession.changed`-event.
3. Telemetri: hvor mange brukere ser tom dashboard i > 5s etter login → trigger alert.

---

### 7.2 localStorage-korrupsjon — `(S2, P3, K-DATA)` ✅ DELVIS FIKSET (Sprint 6.10)
**Status:** `createVersionedStorage` finnes nå. Trenger å migrere eksisterende state-objekter.

**Eksisterende ubeskyttede keys:**
- `role-room:workspace-state` (per project state)
- `role-room:pinned-projects`
- `story-logic-data:*`
- `story-logic-sync-meta:*`
- `ai-rec-seen:*` (Sprint 4.2)

**Fix-resept:**
1. Migrer hver av disse til `createVersionedStorage` i egen mikro-sprint.
2. Skriv migration-funksjoner som tåler eldre shape.
3. Telemetri: hvor mange brukere får migration-fallback-værdi (= korrupt) per uke.

---

### 7.3 Demo-vs-real-prosjekt-divergens — `(S3, P2, K-DATA)` 🟠
**Symptom:** Bruker oppretter prosjekt, ser sin egen data, men plutselig viser Troll-data i panelet.

**Mekanisme:** `isProtectedDemoProject` brukes inconsistent — noen paneler sjekker det, andre ikke. Hvis bruker har Troll fast-pinned og opprettet et nytt, kan listen rendre Troll-data fra cache.

**Fix-resept:**
1. Sentralisert demo-detection helper (én funksjon, ett ord på sannhet).
2. Workspace-state-key inkluderer brukerID, så cross-bruker-feks ikke skjer.

---

## 8. Test / CI stabilitet (K-TEST)

### 8.1 Pre-eksisterende failing tests — `(S1, P1, K-TEST)` ⚠️ BASELINE LANDET
**Status:** Sprint A.5 baseline ferdig — 24 av 79 specs kjørt (de andre 55 er
større / krever ekstern setup og dokumenteres i `PLAYWRIGHT_BASELINE.md`).

**Endelig baseline-resultat (24 specs, 268 tester, 23.4 min wall-time):**

| Batch | Specs | Pass | Fail | Pass-rate |
|---|---|---|---|---|
| 1 — Core role-room | 8 | 37 | 29 | 51% |
| 2 — Producer/storyboard | 8 | 55 | 16 | 77% |
| 3 — Story-arc/cross-cutting | 8 | 106 | 8 | 93% |
| **Totalt** | **24** | **198** | **53** | **74%** |

**Top fail-kategorier:**

| # | Kategori | Antall | Status |
|---|---|---|---|
| 1 | `gotoCastingPlanner`-helper venter på subtittel | 28 | **Mount-fasen FIKSET i Sprint A.6.** Data-seeding gjenstår. |
| 2 | Manglende seedet data i test-harness (`selectFirstProject` ingen `<li>`) | 10 | A.7 — seed minimal demo-prosjekt i `test-harness-casting.tsx` |
| 3 | SEO landingssider mangler i dev-server (`/vs-*`, robots.txt, llms.txt) | 9 | Ikke role-room-bug — egen SEO-sprint |
| 4 | Externe deps (ffmpeg-fixture-video) | 2 | Trenger ffmpeg installert i CI |
| 5 | **Reelle perf-issues (frame-budget overskredet)** | 3 | **Verdig egen sprint** — `professional-timeline-render-budget` |
| 6 | GA4 event-fyring (role_room_project_created) | 1 | Sjekk om event-emit fungerer korrekt |
| 7 | Krever prod-backend (treffer DB) | 1 | Skip i CI |

**Sprint A.6 leveranse:**
- Ny `frontend/e2e/helpers/role-room.ts` med `openRoleRoomDashboard` +
  `openCastingPlanner` som venter på stabile DOM-markører
- Lagt til `data-testid="casting-planner-root"` på CastingPlannerPanel
- Migrert 4 specs til ny helper
- **Mount-fasen: 100% pass** (var 0% for de migrerte specs før)

**Fix-resept (gjenstående lag):**
1. **Sprint A.7 — data-seeding:** `test-harness-casting.tsx` seeder ett minimalt
   demo-prosjekt når URL-flag `?seed=basic` settes. Lar specs bypass
   selectFirstProject-feilen.
2. **Sprint A.8 — perf-issues:** Adresser `professional-timeline-render-budget`-
   fail (real perf-regresjon).
3. **CI-step:** Kjør Batch 1+2+3 (24 specs, 23 min) på hver main-merge.
4. **Quarantine:** Spec med > 2 fail i en uke flagges som flaky.

---

### 8.2 E2e tests bruker test-harnesser i stedet for ekte app — `(S2, P3, K-TEST)` 🟠
**Symptom:** Test-harness manglet `EnhancedMasterIntegrationProvider` i Sprint 5.2 — alle 20 tester feilet.

**Mekanisme:** Vi har `test-harness.tsx`, `test-harness-casting.tsx`, `test-harness-production-manuscript.tsx` — alle re-implementerer provider-treet manuelt. Når app-en endrer provider-krav, må harnessene oppdateres.

**Fix-resept:**
1. Lag én delt `<TestProviders />`-komponent som speiler `App.tsx` provider-stack.
2. Alle harnesser bruker den.
3. Når noen legger til en ny provider i App.tsx må de oppdatere TestProviders — fanges av lint hvis vi sjekker imports.

---

### 8.3 Visual baseline-tester — `(S3, P2, K-TEST)` 🟠
**Lokasjon:** `storyboard-drawing-editor.spec.ts-snapshots/` har 55 PNG-snapshots.

**Symptom:** Endring i topbar-padding bryter alle storyboard-snapshots.

**Fix-resept:**
1. Visual baselines bør være per visual-area, ikke per page.
2. Re-baseline-script som gjør det enkelt å re-akseptere etter intensjonell endring.
3. Run i CI-modus som flagger forskjell uten å auto-feile (manuell review).

---

### 8.4 Manglende coverage på state-overgang-grenser — `(S2, P2, K-TEST)` 🟠
**Symptom:** Auth-state-divergens (§ 4.1) ble ikke fanget av noen test.

**Fix-resept:**
1. Skriv unit-tester for hver state-transition (login, logout, refresh, mode-switch).
2. Mock-localStorage med presise scenarios for hver auth-state-permutation.

---

## 9. Deploy / release stabilitet (K-DEPL)

### 9.1 Atomic frontend + backend release — `(S2, P2, K-DEPL)` 🟠
**Symptom:** Frontend deployer på Vercel umiddelbart, backend på Render tar 3-5 min. I vinduet returnerer nye frontend-kall 404 mot gammel backend.

**Fix-resept:**
1. Backend-first deploy som default.
2. Feature flags for inkompatible frontend-endringer — slå på etter at backend er bekreftet.
3. Stale-chunk-retry (Sprint 5/lazyWithRetry) hjelper for client-side.

---

### 9.2 Schema-rollback — `(S1, P3, K-DEPL)` 🟠
**Symptom:** Vi bruker `IF NOT EXISTS` for additive, men aldri `DROP COLUMN` (= ingen reversible schemas).

**Fix-resept:**
1. Hver migration har et "rollback"-script (kan være tom for additive).
2. Backup før hver prod-deploy.

---

### 9.3 Env-var-drift — `(S1, P3, K-DEPL)` 🟠
**Symptom:** Prod-instansen mangler en ny env-var, kunder ser cryptic feil.

**Fix-resept:**
1. CI sjekker at `.env.example` har alle env-vars som koden refererer til.
2. Backend boot validerer hver `process.env.X` ved oppstart, exit 1 hvis mangler.
3. Vercel + Render env-vars synces fra én kanonisk fil i repo (krypteret).

---

## 10. Observability — hva vi IKKE kan se

Vi har **16 Sentry-relaterte forekomster** — det er for lite. Følgende er kritisk å instrumentere:

### 10.1 Frontend signaler vi mangler
| Signal | Hvorfor | Foreslått implementering |
|---|---|---|
| Auth-failure-rate | § 4.1 vi vet ikke om brukere blir kicket ut stille | `authStateService.onMismatch → Sentry` |
| Tab-switch-tid | § 4.5 vi vet ikke om panels er lagye | Sentry performance trace |
| WebSocket-give-up | § 6.1 vi vet ikke om backend ikke responds | Custom Sentry event |
| Localstorage-migration-fallback | § 7.2 vi vet ikke om data er korrupt | versionedStorage.onMigrate → telemetri |
| Stale-chunk-retry | § 4.6 vi vet ikke om deploys er smerteful | `lazyWithRetry → Sentry breadcrumb` |

### 10.2 Backend signaler vi mangler
| Signal | Hvorfor | Foreslått |
|---|---|---|
| Endpoint-404-rate | § 6.2 contract-drift | Express middleware som teller 404 per path |
| DB-connection-pool-exhaustion | Render pg-pool limit = 10 | Log warning når pool > 8 busy |
| Slow-queries (> 500ms) | Tregheter | pg-stat-statements + threshold-alert |
| Migrasjon-feil ved boot | "Ensure-table"-pattern feiler stille | Throw if `ensureRoleRoomTicketsTable` feiler 3 ganger |

### 10.3 End-user signaler vi mangler
| Signal | Hvorfor | Hvor |
|---|---|---|
| Rage-clicks (samme element 3+ ganger) | UX-frustrasjon | Microsoft Clarity (allerede integrert) — bare må bruke dataene |
| Dead-clicks (klikk på ikke-interaktive) | Bug-fanger | Samme |
| Form-abandonment | Konvertering | Clarity |

---

## 11. Symptom-tabell (runbook for prod-feil)

Når noe knekker, slå opp her:

| Symptom (i console / DOM) | Sannsynlig årsak | Seksjon | Fix-resept |
|---|---|---|---|
| `WebSocket is closed before connection established` | Render-instans sover, eller WS-endepunkt mangler | § 6.1 | Sprint 7.4 fikset reconnect-loop. Verifiser at Render-deploy var vellykket. |
| `GET /api/role-room/.../* 404` | API-contract-drift | § 6.2 | Sjekk Sprint 7.4 path-aliases. Lag flere hvis nye endpoints føyes til kun én side. |
| Tomme paneler etter login | Auth-state-divergens ELLER demo-race | § 4.1, § 7.1 | Sprint 1.3 ownership-toast hjelper diagnostisere. Sjekk localStorage manuelt. |
| Hvit skjerm 30s+ | Render free-tier wake-up | § 6.4 | Vent, eller refresh. Lang sikt: pinger eller paid plan. |
| `Failed to fetch dynamically imported module` | Stale chunk | § 4.6 | lazyWithRetry skal håndtere. Hvis ikke: hard-refresh. |
| Status-endring i kanban "fjerner" kandidat | Optimistic update + save-feil + ingen revert | § 4.4 silent catch | Sprint 6.9 Angre-toast løser dette mønsteret. |
| Tab-switch frys 2-3 sek | Re-render storm | § 4.5 | React DevTools profil for å finne fanget komponent. |
| Konsoll spammer 404 hver 30s | Mismatch endpoint i polling | § 6.2 | Finn hooken, fix endpoint eller stopp polling. |
| Drag-drop forsvinner uten å lagre | Save-failure + silent catch | § 4.4 + § 5.5 | Verifiser ws-connection + se backend-logs. |

---

## 12. Stability budget (SLO)

Forslag SLO for The Role Room som produkt:

| Metrikk | Mål | Måling |
|---|---|---|
| API success-rate (excl. 4xx) | ≥ 99.5% | Sentry / Render logs |
| Frontend Sentry-error-rate per user-session | ≤ 1.0 errors | Sentry |
| Tab-switch-tid (p95) | ≤ 800ms | Sentry performance |
| First-meaningful-paint (mobile) | ≤ 2.5s | Lighthouse / Sentry |
| E2e pass-rate (full suite) | ≥ 95% per PR | CI |
| Migrasjons-feil ved boot | 0 per uke | Backend logger |
| Auth-mismatch-toasts vist | ≤ 0.5% av sessions | Sentry custom event |

**Error budget:** Hvis vi bryter SLO 2 uker på rad, neste sprint er reservert til stabilitet, ikke features.

---

## 13. Implementation roadmap

Foreslått prioritering for å forbedre stabilitet over de neste 4 sprintene:

### Sprint A — Akutt (uke 1) 🔴
1. **§ 4.1** Konsolidér auth-state-spredning (kanonisk `authStateService`)
2. **§ 5.2** Migrer toppfem high-call-volume endpoints til Drizzle
3. **§ 10.1** Instrumenter auth-failure + WS-give-up til Sentry
4. **§ 8.1** Kjør full playwright-suite, dokumenter alle failures
5. **§ 6.4** Sett opp ping-cron mot Render-backend hver 10 min

### Sprint B — Kortsiktig (uke 2) 🟠
6. **§ 5.5** Backend silent-catch → strukturert respons (503 + retry-after)
7. **§ 7.2** Migrer 3 mest brukte localStorage-keys til `createVersionedStorage`
8. **§ 4.4** Lint-rule: forbudt `} catch {}` uten kommentar
9. **§ 5.3** Konsolidér migration-scripts til ÉN canonical
10. **§ 9.3** Validate env-vars ved backend boot

### Sprint C — Mellomlang sikt (uke 3-4)
11. **§ 4.2** Slice CastingPlannerPanel (mål: 17K → < 5K i orchestrator)
12. **§ 4.3** Bygg `useTrackedTimeout`-helper, migrer 50% av timers
13. **§ 6.2** Generér frontend-API-klient fra backend route-definisjoner
14. **§ 10.2** Backend slow-query-detection + pool-exhaust-alarm
15. **§ 8.2** Konsolidér test-harnesser med felles `<TestProviders />`

### Sprint D — Kvartal-prosjekt
16. **§ 4.2** Slice ProducerMediaPanel + FrameDrawingEditor
17. **§ 5.1** Splitt index.ts til < 5K-linje route-filer
18. **§ 5.2** Migrer alle endpoints til Drizzle + auto-genererte typer
19. **§ 9.2** Implement formal rollback-scripts per migration
20. **§ 8.3** Re-baseline visual-snapshot-testene + automatisk re-baseline-PR

---

## 14. Eierskaps-matrise

| Område | Primær eier | Reviewer | Backup |
|---|---|---|---|
| Auth + session | Daniel | (TBD) | (TBD) |
| Casting Planner (mega) | Daniel | (TBD) | (TBD) |
| Backend route-arkitektur | Daniel | (TBD) | (TBD) |
| Testing / CI | Daniel | (TBD) | (TBD) |
| Observability (Sentry/Clarity) | Daniel | (TBD) | (TBD) |
| Deploy pipeline | Daniel | (TBD) | (TBD) |

I 1-person-team eier Daniel alt. Når team vokser fylles kolonnene inn. **Ingen område kan være ueid.**

---

## 15. Hvordan oppdage ny ustabilitet (proaktiv)

### 15.1 Ukentlig health-check (15 min)
- [ ] Sjekk Sentry: nye error-typer siste 7 dager
- [ ] Sjekk Render dashboard: minne, CPU, restart-count
- [ ] Sjekk Vercel: deploy-failures, edge-error-rate
- [ ] Kjør `npx playwright test --reporter=list` — antall fail?
- [ ] Kjør `npx vitest run` — antall fail?
- [ ] Sjekk Clarity rage-click-rate (hvis > 5% av sessions: ny UX-issue)

### 15.2 Per-PR sjekk
- [ ] Endrer PR-en authentication-state? Hvis ja, oppdater § 4.1
- [ ] Legger PR-en til ny `setTimeout`/`setInterval`? Hvis ja, har den cleanup?
- [ ] Legger PR-en til ny `} catch {}`? Hvis ja, krev kommentar eller fix.
- [ ] Endrer PR-en `localStorage`-shape? Hvis ja, bruk `createVersionedStorage`.
- [ ] Legger PR-en til ny backend-endpoint? Hvis ja, har den smoke-test + sentry-instrumentert?
- [ ] Endrer PR-en mega-fil (> 10K linjer)? Hvis ja, ekstraher logikk til testbar helper.

### 15.3 Når noe knekker i prod
1. Identifiser symptom i § 11.
2. Hvis nytt symptom: legg til i § 11 før fix.
3. Fix utfør ifølge resept i den passende § 4–§ 8 seksjonen.
4. Skriv post-mortem hvis det var brukerimpact > 5 min.
5. Legg til regresjons-test (unit eller e2e) som ville fanget feilen.

---

## 16. Appendix

### A. Kommandoer for å gjenta diagnose-tellinger
```bash
# ts-nocheck count
grep -rl "// @ts-nocheck" frontend/client/src/components/role-room --include="*.{ts,tsx}" | wc -l

# Mega-files
find frontend/client/src/components/role-room -name "*.{ts,tsx}" | xargs wc -l | sort -rn | head -10

# Silent catches frontend
grep -rn "} catch {" frontend/client/src/components/role-room --include="*.{ts,tsx}" | wc -l

# Silent catches backend
grep -rc "} catch (err" backend/server | sort -rn | head -10

# Timer leakage check (per fil)
for f in $(find frontend/client/src/components/role-room -name "*.{ts,tsx}"); do
  set_count=$(grep -c "setTimeout\|setInterval" $f)
  clear_count=$(grep -c "clearTimeout\|clearInterval" $f)
  if [ $set_count -gt $clear_count ]; then echo "$f: $set_count set / $clear_count clear"; fi
done

# Raw SQL vs Drizzle
grep -rc "pool.query" backend/server | sort -rn | head -10
grep -rc "drizzle" backend/server | sort -rn | head -10

# Auth-key sprawl
grep -rn "localStorage.\(get\|set\)Item.*\('userId'\|'userEmail'\|'creatorhub_auth_'\|'role_room_auth_'\)" frontend/client/src | wc -l
```

### B. Test-runner-snippet
```bash
# Full suite-test for stability-baseline:
cd frontend
npx vitest run client/src/components/role-room --reporter=verbose 2>&1 | tee /tmp/vitest-baseline.log
npx playwright test --project=chromium --reporter=list 2>&1 | tee /tmp/playwright-baseline.log
grep -E "✓|✗|passed|failed" /tmp/playwright-baseline.log | tail -5
```

### C. Akutt-incident-runbook
Hvis prod er ned eller alvorlig degradert:
1. Sjekk Render dashboard — er backend oppe? Hvis sleeping: våkner ved første kall.
2. Sjekk Vercel deploy-status — er siste deploy vellykket?
3. Sjekk Sentry — er det en ny error-spike?
4. Sjekk DB-connection — kan du kjøre `psql` mot den?
5. Hvis feilen er ny: opprett git-branch `incident/<dato>`, fix der, deploy via Vercel preview først.
6. Etter fix: skriv post-mortem som git-commit, oppdater dette dokumentet.

### D. Refererte commits (Sprint 1-7 historikk)
```
90c85bde Sprint 7    — backend-endepunkter, prod-feil-fix, accept-invite-flow
0c441706 Sprint 6.8  — pre-prod sub-tab-strip
6c788888 Sprint 6.7  — top-bar konsolidering
2a1211e0 Sprint 6.9  — Kanban drag-drop med Angre
2740ebf3 Sprint 6.6+ — Send til klient + Økonomi i Story Arc
0ec33660 Sprint 6.11 — Onboarding-tour + Feedback FAB
f792d2c3 Sprint 6.10 — versioned storage + tester-fane
6195c190 Sprint 6.3-5+ — Live Set, mode-badge, story-numre, NDA
3150a244 Sprint 6.1-2+ — Cmd+K-hint, empty hero, Troll-avatarer
d749eed3 Sprint 5    — e2e + threeActs-fix, browser-back, ErrorBoundary
4e9d85d4 Sprint 4    — skeleton-states + AI-recommendation
5969ef73 Sprint 3    — workflow-stepper + klient-status-badge
72cd1776 Sprint 2    — Cmd+K + breadcrumb
d1c13578 Sprint 1    — 404-støy + empty-state + ownership-toast
```

---

## 17. Endringslogg for dette dokumentet

| Dato | Endring | Forfatter |
|---|---|---|
| 2026-05-14 | Initial audit, alle 17 seksjoner | System-arkitekt (Claude Opus 4.7) |

> **Til neste auditør:** Når du oppdaterer dette dokumentet, legg ALDRI til en feil uten en fix-resept. Stabilitet er en kontinuerlig praksis, ikke en milestone.
