# memory.md — Role Room session-state, refaktor-plan og kø

> Levende dokument for Claude Code-sesjoner og produkt-eier. Sist oppdatert: 2026-05-09 (etter funding-ekstrakt).
> Plassert i repo-rot slik at Claude Code (lokal eller web) automatisk leser den ved oppstart.

---

## 🎯 Formål

Spore (1) hva som er gjort, (2) hva som må gjøres, (3) hvordan det skal gjøres, slik at hver sesjon
kan plukke opp arbeidet uten å miste tråden eller duplisere innsats.

---

## ✅ FERDIG — pushet til `claude/check-git-status-BAfbj`

### Konfigurerbar rolle-navigasjon (alle viewports)

Live på branch og venter på merge til `main`. Migrasjon kjørt mot Neon.

**Backend:**
- `backend/migrations/139_role_nav_config.sql` — tabell `role_nav_config(role PK, tab_values text[], updated_at, updated_by)`
- `backend/server/admin-room-role-nav-routes.ts` — eksportert `setupRoleNavConfigRoutes()` med GET/PUT/DELETE under `/api/admin-room/role-nav-config`
- `backend/server/index.ts` — wirer opp ved kall til `setupRoleNavConfigRoutes({ app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity })`

**Frontend (alle nye filer):**
- `frontend/client/src/components/role-room/hooks/useRoleNavConfig.ts`
- `frontend/client/src/components/role-room/components/ipad/RoleRoomTabRail.tsx`
- `frontend/client/src/components/role-room/components/mobile/RoleRoomBottomNav.tsx`
- `frontend/client/src/components/role-room/components/admin-room/RoleNavConfigTab.tsx` — admin-UI med 4 device-mockups

**Frontend (modifisert):**
- `RoleRoomDashboardPanel.tsx`, `pages/AdminRoom.tsx`, `styles/role-room-mobile.css`

### Emoji → MUI ikoner

- `StoryStructurePanel.tsx` — PURPOSE_CONFIG (9 emoji): MenuBook, Whatshot, TrendingUp, GpsFixed, TrendingDown, CheckCircle, ArrowForward, AccountCircle, CallSplit

### Backend Fase 2 — første ekstrakt (commit `17060294`)

- `backend/server/_shared.ts` — felles types (`AdminSession`, `AdminRoomRoutesDeps`, `LogAdminActivityArgs`) og 4 pure helpers (`asString`, `asNumberOrNull`, `asJsonbArray`, `asJsonbObject`)
- `backend/server/admin-room-funding-routes.ts` — `setupAdminFundingRoutes()` med 5 endpoints (memory.md sa "3" — feil; korrigert: list, create, patch, delete, AI-generate)
- `backend/server/admin-room-role-nav-routes.ts` — retrofit til å importere `AdminRoomRoutesDeps` fra `_shared` (én konsistent strategi)
- `index.ts` — netto -266 linjer; importerer pure helpers fra `_shared` (101 bruk i admin-room-clusteret 19810-20432)
- `tsc --noEmit` passerer

**Strategi-valg (gjelder for resten av Fase 2):** Stateful helpers (`pool`, `getActiveSessionFromRequest`, `requireAdminRoomAccess`, `logAdminActivity`) blir værende i `index.ts` og passes via deps-objekt. Pure helpers bor i `_shared.ts` og importeres direkte. Hver `admin-room-*-routes.ts` tar en `AdminRoomRoutesDeps` som eneste argument.

---

## 🚧 IKKE PUSHET — venter på re-implementering

Bygget lokalt men gikk tapt i `git reset --hard` (commit `fffb2b5` aldri pushet).

| Fil | Hva som ble gjort | Strategi |
|---|---|---|
| `DashboardPanel.tsx` (38KB) | Stat-kort hover-only/press/empty-hint, 3-col Hurtighandlinger, Casting-fremdrift icon-box + chip-legend, Bolt-ikon header, Kanban-skeleton, sectionGap, aria-regions | Re-apply via Edit + push via MCP (~50k tokens) |
| `StoryLogicPanel.tsx` (168KB) | Mobile header, START_MODES emoji→MUI (💡→Lightbulb, 🎭→TheaterComedy, 🧠→Psychology), strukturert Paper, inline 🔍/💡 → GpsFixed/Tips | Re-apply + push via MCP, borderline størrelse (~80k tokens) |
| `CastingPlannerPanel.tsx` (737KB) — Ny rolle-dialog | DialogActions column-reverse, full-bredde knapper på mobil, lukkeknapp 44x44, safe-area-padding | Krever refaktor først (se Fase 2) — eller liten diff applyes lokalt |

---

## 📊 KARTLAGT INVENTAR

### `backend/server/index.ts` — 1052 endpoints i 119 grupper

**Topp 30 grupper etter antall endpoints:**

```
 97  /api/role-room
 60  /api/showcase
 51  /api/admin
 50  /api/evendi
 48  /api/projects
 48  /api/casting
 40  /api/story-arc
 30  /api/community
 25  /api/equipment
 24  /api/split-sheets
 24  /api/analytics
 24  /api/admin-room    ← ✅ delvis ekstraktert (role-nav-config + funding-apps)
 23  /api/price-administration
 20  /api/user
 19  /api/quotes
 19  /api/business
 18  /api/universal-crm
 17  /api/pricing
 17  /api/contracts
 16  /api/photographer
 16  /api/academy
 14  /api/client
 11  /api/cms
 10  /api/auth
 10  /api/audio
  9  /api/platform
  9  /api/payments
  9  /api/file-management
  8  /api/seo-bot
  8  /api/inspirations
```

(89 mindre grupper utelatt for korthet — totalt 119.)

### `frontend/client/src/components/role-room` — paneler som trenger responsiv-gjennomgang

Estimert ~50 paneler. Må kartlegges presist i Fase 4.

---

## 🎭 Modes — kontekst for all refaktor

Appen har **4 produkt-modes** som bestemmer hvilke features som vises, hvilken terminologi som brukes, og hvilke workflows som gir mening. Modes er **ortogonale til brukerroller** (director, producer, casting_director, …) — en regissør i Produksjonsteam-mode vs. samme rolle i Innholdsprodusent-mode kan se ulike tab-sett selv om rolle-konfigen er lik.

| Mode | Hva | Eksempler |
|---|---|---|
| **Produksjonsteam** | Film/TV-produksjon | Full casting + crew + scheduling + shotlist + audition |
| **Innholdsprodusent** | Sosiale medier / brand-content | Brief → Plan → Approval → Publishing-flyt (lett casting) |
| **Utdanningsinstitusjon** | Skoler/akademier | Academy-/kurs-tilpasset, mindre produksjons-fokus |
| **Dansestudio** | Dans-produksjoner | Egen `DanceWorkspace` med koreografi-verktøy |

**Mode-switcher:** ser ut til å eksistere i admin-profil-sheet via `isAdminUser`-check i `RoleRoomDashboardPanel`. Gjør 4×4-testing håndterbart i Fase 4.

### Hvor mode-logikk er funnet (per 2026-05-09)

- **Backend:** ingen helper-funksjon ved navn `getActiveProfessionMode` eller `isDanceMode` finnes i `backend/server/index.ts` per dette tidspunkt. Hvis mode-aware filter-logikk eksisterer, er det inline i hver endpoint og må kartlegges per gruppe ved ekstrakt.
- **Frontend:** `DanceWorkspace` er allerede et eksempel på mode-spesifikk UI. Flere paneler kan ha implisitte mode-antagelser (kartlegges i Fase 4).
- **Funding-endpoints (commit `17060294`):** ingen mode-logikk funnet. Funding er Admin Room-funksjonalitet låst til produkteier; orthogonalt til alle 4 modes.

### Regler for resten av refaktoren

1. **Når en route-gruppe ekstrakteres:** søk i blokken etter `profession`, `mode`, `isDance`, `getActiveProfession*` *før* du kopierer. Hvis truffet — bevar logikken, ikke "rens" den. Hvis det finnes avhengigheter til en mode-helper, legg den i `AdminRoomRoutesDeps` (eller en route-gruppe-spesifikk deps-utvidelse).
2. **Fase 3 (CastingPlannerPanel-splitt):** SubPanels kan trenge mode-awareness (eks. `CrewSubPanel` for Produksjonsteam vs. minimal versjon for Innholdsprodusent). Denne axis er separat fra `useEffectiveTabsForRole` (som handler om bruker-rolle innen et prosjekt).
3. **Fase 4 (responsiv-optimering):** hvert panel testes i alle **4 modes × 4 viewports = 16 kombinasjoner**.
4. **Rolle-nav-konfig vs. modes:** brukerrollene er ortogonale til modes. Vurder å utvide `useEffectiveTabsForRole(role)` til `useEffectiveTabsForRole(role, mode)` senere når mode-spesifikke tab-sett trengs.

---

## 📋 PLANLAGT ARBEID — prioritert kø

### Fase 1 (umiddelbart)
- [x] Push memory.md
- [ ] Re-implementer DashboardPanel mobile UX → push (38KB, 1 commit)
- [ ] Re-implementer StoryLogicPanel emoji→MUI + mobile header → push (168KB, 1 commit, borderline output-grense)

### Fase 2 — Backend refaktor (multi-sesjon)

**Mål:** `index.ts` < 200KB aggregator + ~15-20 `*-routes.ts`-filer, hver < 200KB.

**Mønster** (allerede etablert med `admin-room-role-nav-routes.ts`):
```ts
// backend/server/<gruppe>-routes.ts
export interface XxxRoutesDeps {
  app: express.Application;
  pool: Pool;
  // ...delte helpers
}
export function setupXxxRoutes(deps: XxxRoutesDeps): void {
  app.get("/api/xxx/...", async (req, res) => { /* ... */ });
  // ...
}
```

**Anbefalt rekkefølge** (fra størst til minst, delt i håndterlige biter):

1. `role-room-*-routes.ts` (97 endpoints) — **kartlagt 2026-05-09:** spredt utover index.ts (linje 13676 → 33479+), ikke ett kluster. Faktiske sub-kategorier:
   - `role-room-vendor-links-routes.ts` (2) — public, statisk vendor-data ✅ **gjort** (commit `67091ba2`)
   - `role-room-casting-routes.ts` (6) — admin-tooling for reminder/SMS/WhatsApp-invoice-sveep ✅ **gjort** (commit pending push). Bruker `requireAdminSession` (admin-rolle, ikke produkteier-låst).
   - `role-room-agent-routes.ts` (19 + 7 marketing-plan = 26) — Innholdsprodusent-mode (sjekk for getActiveProfessionMode i hver endpoint før ekstrakt)
   - `role-room-whatsapp-routes.ts` (15) — WhatsApp messaging
   - `role-room-social-routes.ts` (8 social + 8 instagram + 4 tiktok + 4 facebook + 2 youtube + 2 linkedin = 28) — sosiale OAuth/posting
   - `role-room-billing-routes.ts` (9 endpoints — webhook ved linje 642 + 8 ved linje 43672-45392) — **utsatt 2026-05-09:** ekstremt spredt utover hele filen, krever Stripe-state og webhook-secrets. Kommer tilbake når subsystemet kan ekstrakteres samlet med Stripe-customer-resolver-helpers.
   - `role-room-projects-routes.ts` (10 endpoints — multi-line app.X-format avslørte 3 ekstra) — **utsatt 2026-05-09:** entangled med 14 module-scope helpers (legacyOffersByProject, legacyContractsByProject, legacyProjectAgreementsByProject Maps + getProjectItems/setProjectItems/findByIdInProjectMap/findByIdInDbProjectArrays/createProjectAgreementRecord/normalizeProjectAgreementStatus/dbLegacy*Key + compatStoreGet/compatStoreSet). Disse helpers brukes også av andre endpoints utenfor role-room-projects, så de kan ikke flyttes uten større refactor. Kommer tilbake til denne etter (a) helpers ekstraktert til egen modul, eller (b) større "casting-offers-contracts-agreements"-subsystem-extract som flytter helpers og endpoints sammen.
   - `role-room-casting-routes.ts` (6) — casting-funksjonalitet (lite — det meste ligger i `/api/casting`-clusteret som er separat)
   - `role-room-client-portal-routes.ts` (3) — admin-side av klient-portal (invite/list/revoke) ✅ **gjort** (commit pending push). Klient-siden (magic-link-auth via session_token) blir igjen i index.ts som /api/client/portal/*.
   - **Restende misc:** `commercial-access` (1, linje 43640) og `education-inquiries` (1, linje 45486) blir stående i index.ts — for små for egen modul, ingen logisk gruppering med andre endpoints. Vurder å bundle med education-/marketing-modul senere.
   - `role-room-marketing-plan-routes.ts` (7) — Innholdsprodusent-mode-feature: AI-genererte markedsplaner med pillars/strategi/30-post Claude-forslag som aksepteres inn i feed-planneren ✅ **gjort** (commit pending push). Feature-flag-gated på `role-room-agent-producer`. Deps: 4 (app, pool, requireAdminSession, isCompatAdminFeatureEnabled). Importerer 5 modul-helpers direkte (checkAgentEntitlement, listInstagramConnections, marketing-plan-helpers x4 + plan-posts x4 + feed-plan x2).
   - **Mode-relevans:** `agent` og `marketing-plan` er primært Innholdsprodusent-mode; `social` har OAuth som er mode-uavhengig men feed/publishing er mode-spesifikt. Sjekk per endpoint.
2. `showcase-*-routes.ts` (60 endpoints, ~2800 linjer 105258-108050) — **kartlagt 2026-05-10:** ~40 unike sub-segmenter, krever splitt i ~8 sub-moduler. Sub-modul-progresjon:
   - `showcase-templates-routes.ts` (4) — design-maler, drizzle CRUD ✅ **gjort** (commit `3ca075de`). Auth: open (eksisterende oppførsel — userId fra query/header, ingen session-validering).
   - `showcase-collections-routes.ts` (6) — samlinger av showcase-items, raw SQL via pool ✅ **gjort** (commit `dace8ae3`). 7 deps inkl. 3 collection-spesifikke helpers (`getShowcaseCollectionShowcaseIds`, `setShowcaseCollectionShowcaseIds`, `showcaseCollectionShowcasesKey`) som blir værende i index.ts inntil resten av showcase er ekstraktert. `readStringArray` flyttet til `_shared.ts` som del av denne commiten.
   - `showcase-items-routes.ts` (7) — items CRUD inkl. legacy/alias URL-er ✅ **gjort** (commit `03c1afb0`). 4 deps (app, pool, updateShowcaseItemRecord, mapShowcaseItemRow). De 2 helpers blir værende i index.ts (12 bruk hver, brukt av mange ikke-ekstraktrte endpoints).
   - `showcase-categories-routes.ts` (4) — GET/POST /categories, GET /profession/:profession, GET /day-categories ✅ **gjort** (commit `b9b2472e`). 4 deps (app, pool, getTableColumns, mapShowcaseItemRow).
   - `showcase-comments-routes.ts` (3) — drizzle CRUD for klient-feedback + like-counter ✅ **gjort** (commit `d8791e59`). Minimal deps (app, db).
   - `showcase-analytics-routes.ts` (2) — POST track view/like/share/download + GET aggregat ✅ **gjort** (commit `37106b2f`). Minimal deps (app, pool).
   - `showcase-pricing-routes.ts` (2) — GET /pricing + GET /pricing/:profession ✅ **gjort** (commit pending push). Deps: app + resolveShowcasePricing (blir værende i index.ts).
   - `showcase-smart-albums-routes.ts` (2) — POST create + POST :albumId/update (regelbasert auto-tildeling) ✅ **gjort** (commit `e36d865a`). Deps: app, pool, db, mapShowcaseItemRow.
   - `showcase-batch-operations-routes.ts` (2) — masseoperasjoner (delete/archive/publish/feature/bulk-photo-enhance) + undo med compat-store-state ✅ **gjort** (commit `3b833e1d`). Deps: 8 (app, pool, 3× compatStore-funksjoner, updateShowcaseItemRecord, createShowcaseItemRecord, showcaseBatchUndoKey).
   - `showcase-google-photos-routes.ts` (2) — POST /sync-google-photos + POST /import-google-photos ✅ **gjort** (commit `84523e52`). Deps: 4 (app, getShowcaseGoogleAlbumPhotos, createShowcaseItemRecord, mapShowcaseItemRow). NB: De andre /api/google-photos/*-endpoints (test-connection, auth, albums) er ikke under /api/showcase/ og blir værende i index.ts.
   - `showcase-client-routes.ts` (8) — klient-portal-funksjoner: send-overage-email, client-session/:id, client-selections (GET/POST/DELETE), public/:userId, client-submissions, project-state PUT ✅ **gjort** (commit `1bbf0c9e`). Deps: 5 (app, pool, compatStoreGet, compatStoreSet, showcaseCompatKey). Importerer broadcastChatEventToUser direkte fra ./websocket-chat.js for WS-broadcast ved klientvalg.
   - `showcase-misc-routes.ts` (9) — bundlet samling av singletons + medium-complexity utenfor de fokuserte sub-modulene: sets, email, enhancement-presets (med SHOWCASE_ENHANCEMENT_PRESETS-const flyttet med), showcases, settings (50+ felt UPSERT), portfolios, link-project, bare POST /api/showcase, calculate-selection-price ✅ **gjort** (commit `077eca20`). 8 deps.
   - `showcase-image-ops-routes.ts` (12) — image-manipulasjon + bulk-operasjoner: upload-media, bulk-upload, enhance-photo, crop, watermark, copy-/move-/archive-/delete-images, toggle-favorite, quick-transform, bulk-download (zip-streaming via archiver) ✅ **gjort** (commit pending push). 10 deps inkl. multer-instans (showcaseMediaUpload) og fileBufferToDataUrl/persistUploadedShowcaseAsset/inferShowcaseFileType. **🎉 Hele showcase-clusteret (60 endpoints, 13 moduler) er nå ekstraktert.**
   - Gjenstår: collections (6), items (4), client-selections (3), smart-albums (2), pricing (2), client-session (2), categories+day-categories+profession (4), batch-operations (2), analytics (2), watermark/upload-media/update-metadata/toggle-favorite/sync-google-photos/quick-transform/showcases/settings/sets/send-overage-email/portfolios/move-images/link-project/import-google-photos/enhancement-presets/enhance-photo/email/delete-images/crop/copy-images/comments/client-submissions/calculate-selection-price/bulk-upload/bulk-download/archive-images (~37 misc image-ops). **Foreslått gruppering:** items (CRUD + comments), collections, categories, client (portal/sessions/submissions/selections), image-ops (bulk + transformations), google-photos, misc.

3. `admin-routes.ts` (51) — eventuelt splittes
4. `evendi-*-routes.ts` (~63 endpoints, ikke 50 som memory.md sa) — kartlagt 2026-05-10: 39 unike sub-segmenter. Sub-modul-progresjon:
   - `evendi-planning-routes.ts` (9) — bryllups-planlegging med sync mellom Evendi (klient-app) og fotograf-tidslinje ✅ **gjort** (commit `b5ea64ee`). Deps: 3 (app, pool, resolveCoupleId). Død helper `mapPlanningTimeline` slettet.
   - `evendi-weather-location-routes.ts` (6) — bridger Kartverket (adresse-søk), YR.no (vær), reise-kostnad mellom CreatorHub og Evendi ✅ **gjort** (commit `5bd5cb52`). Inkl. 4 module-scope helpers flyttet med (YR_BRIDGE_CACHE, fetchYrWeatherBridge, searchKartverketAddress, calculateTravelInfo). Deps: 3 (app, pool, resolveCoupleId).
   - `evendi-sales-routes.ts` (6) — vendor-side salgs-flyt (offers CRUD + contracts list/PATCH) ✅ **gjort** (commit `51243531`). Auth: token-basert via `getVendorFromSession` (Bearer + vendor-lookup). Deps: 3 (app, pool, getVendorFromSession).
   - `evendi-people-routes.ts` (10) — vendor-rettet people-management: contacts, important-people CRUD, couple-profile, couple/:coupleId/... endpoints, couple/guests PUT, coordinators/:coupleId ✅ **gjort** (commit `acc56b2e`). Tilgang valideres mot `conversations` (eller `couple_vendor_contracts` for koordinatorer). Deps: 3.
   - `evendi-conversations-routes.ts` (3) — vendor-side chat (list, hent meldinger, send) ✅ **gjort** (commit `2d495ac6`). Auth distinkt: bruker activeSessions-Map direkte med vendor-lookup via email. Deps: 3 (app, pool, getSessionByToken-lambda).
   - `evendi-bridges-routes.ts` (18 endpoints + EVENDI_TO_CREATORHUB_CULTURE-konstant) — bridges + delivery-tracking: traditions, photo-shots-bridge (2), vendor-project-bridge, timeline-bridge (3), delivery-project-bridge, delivery-to-showcase-bridge, link-delivery-project, project-showcase-bridge, showcase-create-delivery, publish-to-website, showcase-delivery-status, delivery-access-by-id, delivery-track, delivery-tracking, delivery-notify-chat ✅ **gjort** (commit `a1ebfccf`). Deps: 5 (app, pool, getVendorFromSession, getSessionByToken, normalizeEventType).
   - `evendi-misc-routes.ts` (16 endpoints) — vendor-categories, products, photo-shots, schedule-events, resolve-couple, unified-access-code, checklist (seed+list), budget (seed+list), speeches, tables, music, reviews, bookings, analytics/summary ✅ **gjort** (commit pending push). EVENDI_TO_CREATORHUB_CULTURE-duplikatet i index.ts er nå flyttet hit. Deps: 6 (app, pool, getVendorFromSession, fetchEvendiVendorCategories, hasTable, getTableColumns).

**🎉 Evendi-clusteret er fullstendig ekstraktert (~63 endpoints fordelt på 7 moduler).**
   - Gjenstår: weather-location (6), offers (4)+contracts (2), important-people (4)+couple (3)+coordinators (1)+contacts (1) = people (9), conversations (3), bridges (~10), delivery-* (~7), m.fl. singletons.
5. `projects-routes.ts` (48)
6. `casting-routes.ts` (48)
7. `story-arc-routes.ts` (40)
8. `community-routes.ts` (30)
9. `equipment-routes.ts` (25)
10. `split-sheets-routes.ts` (24)
11. `analytics-routes.ts` (24)
12. ~~`admin-room-funding-routes.ts` (3)~~ ✅ **gjort** — 5 endpoints (commit `17060294`)
13. ~~`admin-room-investors-routes.ts` (4)~~ ✅ **gjort** — admin-only investor-CRM, due-diligence checklist + deck-status (commit pending push)
14. ~~`admin-room-partners-routes.ts` (4)~~ ✅ **gjort** — partner-CRM, kontrakt-status (commit `71f2a360`)
15. ~~`admin-room-decks-routes.ts` (7)~~ ✅ **gjort** — pitch-decks for investor-pipeline, AI-generate per slide (commit `4ab32dcc`)
16. ~~`admin-room-business-plan-routes.ts` (3)~~ ✅ **gjort** — UPSERT på 35 tekstfelt + AI-generate per felt (commit pending push)
17. ~~`admin-room-activity-routes.ts` (1)~~ ✅ **gjort** — GET med filter på entityType/entityId/limit (commit pending push)
18. (resten av smågrupper bundles eller utsettes)

**🎉 Admin-room-clusteret er fullstendig ekstraktert.** Alle 24 endpoints fra `/api/admin-room/*` er flyttet til 7 dedikerte route-moduler. `index.ts` har nå kun 7 setup-kall i admin-room-blokken. Neste mål: større grupper (`role-room`, `showcase`, `admin`, `evendi`, `projects`, `casting`).

**Strategi (avgjort 2026-05-09):** Se "Backend Fase 2 — første ekstrakt" over. Stateful helpers via deps; pure helpers fra `_shared.ts`. `getActiveProfessionMode` finnes ikke som navngitt funksjon i backend per dette tidspunkt — sjekk hver gruppe ved ekstrakt (se `## 🎭 Modes` under).

### Fase 3 — Frontend refaktor (multi-sesjon)

**Mål:** `CastingPlannerPanel.tsx` (737KB) < 100KB orkestrator + N SubPanel-filer.

**Foreslått splitt** under `frontend/client/src/components/role-room/components/casting/`:
- `RolesSubPanel.tsx`
- `CandidatesSubPanel.tsx`
- `CrewSubPanel.tsx`
- `ScheduleSubPanel.tsx`
- `RoleEditDialog.tsx` (Ny rolle-modal)
- `CandidateEditDialog.tsx`
- `LocationsSubPanel.tsx`
- `PropsSubPanel.tsx`
- `ShotListSubPanel.tsx`
- (m.fl. — kartlegges ved oppstart av fasen)

`CastingPlannerPanel.tsx` blir lett orkestrator som velger SubPanel basert på state.

### Fase 4 — Responsiv-optimering av alle paneler

**Mål:** Alle ~50 paneler i Role Room rendres optimalt på iPhone, iPad portrait, iPad landscape, MacBook, desktop.

**Felles patterns** (etablert i tidligere arbeid, dokumentert her som referanse):
- WCAG 2.2: minimum 44x44 touch-target
- Hover-effekter inne i `@media (hover: hover)` så de ikke henger igjen på touch
- `WebkitTapHighlightColor: 'transparent'` for å fjerne Safari iOS gray flash
- `&:active` med `transform: scale(0.97)` eller lignende for press-feedback
- Breakpoints: `xs: 0-599 (telefon)`, `sm: 600-899 (iPad portrait)`, `md: 900-1199 (iPad landscape)`, `lg: 1200+ (desktop)`
- Font-sizes responsive: ofte `{ xs: '0.8125rem', sm: '0.875rem', md: '0.9rem', lg: '1rem' }`
- Spacing responsive: `{ xs: 1.5, sm: 2, md: 2.5, lg: 3 }` for `p` og `mb`
- Safe-area: `paddingBottom: env(safe-area-inset-bottom, 0px)` for iPhone home-indicator
- Stack vertikalt på telefon: `flexDirection: { xs: 'column', sm: 'row' }`
- Bunn-nav på telefon respekterer ekstra padding på outer container

**Kartlegg paneler:**
```bash
find frontend/client/src/components/role-room -name "*Panel.tsx" -o -name "*View.tsx" | sort
```

**Anbefalt rekkefølge** (mest brukt først):
1. DashboardPanel (vises ved oppstart)
2. RolesSubPanel / CandidatesSubPanel / CrewSubPanel (kjerne-flyt)
3. AuditionSchedulePanel
4. RoleRoomMobileApprovalView, BriefWizard, PlannerView, ShootingDayView, ShotListView, CrewView (allerede mobile-only — bør kvalitetssjekkes)
5. KanbanPanel
6. StoryLogicPanel
7. StoryStructurePanel
8. (resten alfabetisk)

---

## 🛠️ Push-strategi i sandbox

Sandbox-proxyen blokkerer `git push` direkte. **Eneste vei ut er GitHub MCP-write** (`create_or_update_file` / `push_files`).

**Begrensning:** MCP-tool-kall bundet av output-token-vindu (~64-128k tokens). Det betyr:
- ≤100KB filer: rett push, fungerer fint
- 100-200KB: borderline
- >200KB: krever refaktor til mindre moduler først

**Når MCP-write er aktivert** (kreves etter første session-oppsett):
- Github.com → Settings → Applications → Installed GitHub Apps → Anthropic/Claude → Configure → grant Contents: Read+Write, Issues: Read+Write, PRs: Read+Write

**For arbeid på store filer (Fase 2-3):** Bruk Claude Code lokalt på Mac. Den har ingen output-flaskehals og kan håndtere 3.9MB-filer direkte. Kjør med `claude` i repo-rot etter `git fetch origin && git checkout claude/check-git-status-BAfbj`.

---

## 🔐 Sikkerhets-noter

- **Neon Postgres-passord** delt i klartekst i tidligere chat-tråd: `npg_SM7AZYxyvK4L`. **MÅ ROTERES** i Neon-konsollen før produksjons-bruk. Oppdater også Render env-vars + lokal `.env`.
- `ADMIN_ROOM_OWNER_EMAIL = "daniel@creatorhubn.com"` — produkt-eier-låst på både UI og backend.

---

## 📝 Konvensjoner brukt i denne sesjonen

- Norsk i kode-kommentarer og UI-tekst, engelsk i identifikatorer
- Co-Authored-By-trailer i commits: `Claude Opus 4.7 (1M context)`
- Mobile UX: WCAG 2.2 minimum 44x44 touch-target, `@media (hover: hover)` for hover-effekter, `WebkitTapHighlightColor: 'transparent'`, `&:active` for press-feedback
- iPad-breakpoint: 600-1199px (sm/md), distinkt fra phone (xs) og desktop (lg+)
- Emoji erstattes med MUI-ikoner i alle nye komponenter

---

## ✅ Test-flyt etter merge

1. Logg inn som produkteier (`daniel@creatorhubn.com`) → Role Room → Admin Room → "Rolle-navigasjon"
2. Velg en rolle, endre faner, se live preview i 4 device-mockups, lagre
3. Bytt rolle eller logg inn som annen bruker → verifiser at:
   - **Telefon (≤599px):** bunn-nav viser 4 primære + Mer
   - **iPad portrait (600-899px):** scrollable top-tabs i ny rekkefølge
   - **iPad landscape (900-1199px):** side-rail med ny rekkefølge
   - **Desktop (≥1200px):** top-tabs i ny rekkefølge
4. Sjekk at `publishing` og `admin-room` fortsatt skjules for brukere uten tilgang, selv om de er i konfigen

---

## 📞 Kontakt

- Produkt-eier: daniel@creatorhubn.com
- GitHub: creaotrhubn26/Creatorhubn-monorepo
