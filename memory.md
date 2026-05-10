# memory.md — Role Room session-state, refaktor-plan og kø

> Levende dokument for Claude Code-sesjoner og produkt-eier. Sist oppdatert: 2026-05-10 (round 2 — etter service-laget-refactor for education-inquiries).
> Plassert i repo-rot slik at Claude Code (lokal eller web) automatisk leser den ved oppstart.

---

## 🚀 SESSIONS-OPPSUMMERING (2026-05-09 til 2026-05-10)

**Sesjon 1 (2026-05-09 → tidlig 2026-05-10):** Massiv Fase 2-refaktor — 40 commits, 238 endpoints fra `admin-room` + `role-room` + `showcase` + `evendi` i 40 moduler. Alle pushet til `origin/claude/check-git-status-BAfbj`. tsc passerer på hver. Ingen funksjonelle endringer.

**Sesjon 2 (2026-05-10 round 2):** Service-laget-refactor for `role-room-education-inquiries` (1 av 3 utsatte sub-clustre). 3 commits, 1 endpoint, men *betydelig* netto linje-reduksjon (-1150) fordi store helper-blokker fulgte med. Ikke pushet ennå.

### Totaler (akkumulert etter sesjon 2)

| Cluster | Endpoints ekstraktert | Moduler |
|---|---|---|
| `/api/admin-room` | 27 | 7 (komplett ✅) |
| `/api/role-room` | 89 | 14 (~komplett, 19 utsatt) |
| `/api/showcase` | 60 | 13 (komplett ✅) |
| `/api/evendi` | 63 | 7 (komplett ✅) |
| `_shared.ts` + commercial-access-error | foundation | 2 |
| **TOTAL** | **239** | **43** |

`index.ts`: ~119,066 → ~105,723 linjer (**-13,343 linjer netto, ~11.2% reduksjon**).

### Strategi-mønstre etablert (gjelder for fremtidig refaktor)

- **Stateful helpers** (pool, requireAdminSession, getActiveSessionFromRequest, getVendorFromSession, requireAdminRoomAccess, isCompatAdminFeatureEnabled, getCompatAdminFeature, hasTable, getTableColumns, compatStoreGet/Set/Delete, dbCompatUserKvKey osv.) → passes via deps-objekt til hver `setupXxxRoutes()`-funksjon.
- **Pure helpers** (asString, asNumberOrNull, asJsonbArray, asJsonbObject, readBoolean, readString, readStringArray, readNumber, readOptionalIsoDate, normalizeJsonObjectField) → bor i `backend/server/_shared.ts` og importeres direkte i alle moduler.
- **Service-laget (etablert sesjon 2):** Når en endpoint-modul har 10+ deps trengs service-laget først. Mønster: `createXxxService(deps)`-factory returnerer hovedfunksjonene som closures over deps. Service-modulen tar inn delte index.ts-helpers via deps og kan ha interne sub-helpers + module-private state (eks. rate-limit-Map). Routes-modulen instansierer 1-N services og holder kun endpoint-handlere. Se `role-room-turnstile-service.ts` + `role-room-education-inquiry-service.ts` + `role-room-education-inquiries-routes.ts` som referanse-implementasjon.
- **Mode-relevans:** Backend er stort sett mode-agnostic. Mode-spesifikke features styres via feature-flag (`role-room-agent-producer`) eller persona-validering (`production_team`/`content_producer`), ikke via `getActiveProfessionMode`-helper. Ingen slik helper finnes i backend per nå.
- **Auth-mønstre:**
  - `requireAdminRoomAccess` → admin-room (produkteier-låst til daniel@creatorhubn.com)
  - `requireAdminSession` → admin-rolle bredere (admin/owner/super_admin)
  - `getVendorFromSession` → token-basert vendor-tilgang (Bearer + vendor-lookup)
  - `getActiveSessionFromRequest` + activeSessions-Map (via lambda) → fleksibel session-tilgang
  - `requireAdminOrDemoBypass` → admin eller demo-bypass-flag
  - åpen → mange showcase + public role-room-endpoints (eksisterende oppførsel bevart)

### ⚠️ Lærdom (sesjon 2): kartlegging FØR planlegging

Memory.md sin opprinnelige plan for education-inquiries var **6 commits / 4 service-moduler** basert på en liste over "21 lokale helpers". Reality (etter Explore-agent-kartlegging):

- **12 av 21 helpers var faktisk education-spesifikke** (kun brukt av education-inquiries-endpointet)
- **8 av 21 helpers var DELTE** med commercial-access, invite-requests, payments etc. (4-139 callsites utenfor education-inquiries) — kan IKKE flyttes uten større refactor
- Linjenumrene i memory.md var utdatert (endpointet var på linje 41405, ikke 45486)

**Resultat:** 3 commits / 2 service-moduler + 1 routes-modul ble den realistiske planen. De 8 delte helpers ble igjen i index.ts og passes via deps.

**Regel for fremtidige sesjoner:** ALLTID kjør Explore-agent-kartlegging av callsites før du tror på memory.md sin helper-liste. Verifiser også at navn/linjenummer fortsatt stemmer.

### 🚧 UTSATT — krever service-laget-refactor før endpoint-extraction

Disse sub-clustrene ble vurdert under sesjon 1 og **utsatt** fordi endpoint-extraction alene blir ufordragelig (15-21 deps per endpoint = code-smell). Riktig tilnærming: **flytt helper-funksjonene til egne service-moduler først**, deretter ekstraktér endpoints med rene importer.

#### `role-room-education-inquiries` ✅ **FERDIG (sesjon 2, 2026-05-10)**

3 commits: `8b23d867` (turnstile-service), `00cd5a76` (education-inquiry-service), `e8994de1` (routes-modul + index.ts wiring).

- `role-room-turnstile-service.ts` (218 l) — 3 hovedhelpers + 3 interne + konstanter. Factory tar 2 delte helpers (`normalizeMailConfigValue`, `getDefaultRoleRoomPublicOrigin`).
- `role-room-education-inquiry-service.ts` (826 l) — 9 hovedfunksjoner + 2 interne + 5 LABEL-konstanter + 4 timing-konstanter + IP-attempt-Map. Factory tar 11 delte helpers.
- `role-room-education-inquiries-routes.ts` (554 l) — 1 endpoint, instansierer begge services.

Netto effekt på `index.ts`: −1150 linjer. tsc passerer. Ingen funksjonelle endringer.

#### `role-room-projects` (10 endpoints) — fortsatt utsatt
**Lokale helpers som må flyttes (14):**
- Maps: `legacyOffersByProject`, `legacyContractsByProject`, `legacyProjectAgreementsByProject`
- Helpers: `getProjectItems`, `setProjectItems`, `findByIdInProjectMap`, `findByIdInDbProjectArrays`
- Factory/normalizers: `createProjectAgreementRecord`, `normalizeProjectAgreementStatus`
- Key generators: `dbLegacyOffersKey`, `dbLegacyContractsKey`, `dbLegacyProjectAgreementsKey`
- Plus: `compatStoreGet`, `compatStoreSet` (allerede passes via deps i andre moduler)

**Foreslått splitt:**
1. `role-room-legacy-project-store.ts` — alle Maps + getProjectItems/setProjectItems/findByIdInProjectMap/findByIdInDbProjectArrays
2. `role-room-project-agreements-service.ts` — createProjectAgreementRecord + normalizeProjectAgreementStatus
3. `role-room-project-keys.ts` — dbLegacy*Key-funksjoner (eller behold inline)
4. Endpoint-modul (`role-room-projects-routes.ts`) som importerer fra service-modulene

#### `role-room-billing` (9 endpoints)
**Karakteristikk:** Endpoints spredt fra linje 642 (webhook) til 45000+, Stripe-state heavy.

**Lokale dependencies som må karlegges:**
- Stripe-klient + webhook-secret (env-config)
- Customer-resolution (`resolveStripeCustomerForRoleRoomCheckout`)
- Plan-mapping + checkout-session-builder
- Subscription-state-tracking (Webhooks fra Stripe)

**Foreslått splitt:**
1. Først: kartlegg alle Stripe-helpers brukt av disse 9 endpoints
2. Flytt webhook-handler-logikken til en egen `role-room-billing-webhook.ts`-service
3. Flytt checkout/manage-helpers til `role-room-billing-checkout-service.ts`
4. Endpoint-modul importerer fra services

### Anbefalt rekkefølge for fremtidig sesjon (gjenværende utsatt role-room)

1. ~~Education-inquiries~~ ✅ ferdig (sesjon 2, 3 commits, faktisk antall vs estimert 6).
2. **Projects** (10 endpoints, helpers er mer entangled — kjør Explore-agent på alle 14 helpers først for å skille education-spesifikke fra delte). Estimat: 2-3 service-moduler + 1 route-modul = 3-4 commits.
3. **Billing** (9 endpoints, Stripe-state heavy, spredt utover hele filen). Krever særlig grundig kartlegging: webhook-handler (linje 642), Stripe-customer-resolver-helpers, plan-mapping. Estimat: 2-3 service-moduler + 1 route-modul = 3-4 commits.

**Lærdom fra sesjon 2:** Det opprinnelige 13-14-commit-estimatet var for høyt fordi det antok 4 service-moduler per cluster. Realistisk er 2-3 service-moduler + 1 route-modul = 3-4 commits per cluster. Resterende totalt: **6-8 commits**.

---

## ⚠️ HVA SOM MANGLER — komplett status (2026-05-10 round 2)

### Backend `index.ts`: **fortsatt 105,723 linjer / 912 endpoints i 110 grupper**

Selv om vi har ekstraktert 239 endpoints til 43 moduler, er det fortsatt MYE igjen. Her er hva som ikke er rørt:

#### A. Backend Fase 2 — store kluster IKKE rørt (~600+ endpoints)

Alle disse mangler komplett ekstraktering. Listet etter størrelse:

| Cluster | Endpoints | Notater |
|---|---|---|
| `/api/casting` | 59 | Roller, manuskripter, role-pool, candidate-pool, acts, calendar, dialogue. **Hovedfeature for Produksjonsteam-mode.** Sannsynligvis sub-splitt i 5-7 moduler. |
| `/api/projects` | 56 | Mest under `/projects/:projectId/*` (worklog, billing, timeline, stages). Sub-splitt nødvendig. |
| `/api/admin` | 51 | users (10), features (6), analytics (5), refund-requests (3), seo-projects (2), activity-feed (2), system, smoke-tests. Sub-splitt: admin-users, admin-features, admin-analytics, admin-misc. |
| `/api/story-arc` | 42 | v2 dominant (18 endpoints), auto-monitor (7), auto-edit (4). Story-arc er kjerne-feature. |
| `/api/community` | 32 | Diskusjons-forum, posts, comments, reactions. Sub-splitt etter sub-domener. |
| `/api/price-administration` | 30 | Plan-administrasjon. Trolig kohesivt. |
| `/api/split-sheets` | 27 | Music split-sheets (composer-credits). Kohesivt cluster. |
| `/api/equipment` | 25 | Equipment-inventory, brands, marketplace. Sub-splitt mulig. |
| `/api/analytics` | 24 | Analytics-aggregat på tvers. Trolig kohesivt. |
| `/api/business` | 23 | Business-profil + plan-data. |
| `/api/contracts` | 22 | Contract CRUD + signering. Tett koblet til Google Drive. |
| `/api/user` | 20 | User CRUD + settings. Auth-tett. |
| `/api/quotes` | 19 | Quote-system (tilbud). |
| `/api/universal-crm` | 18 | CRM-funksjonalitet. |
| `/api/academy` | 18 | Academy/course-features. |
| `/api/pricing` | 17 | Pricing-config. |
| `/api/photographer` | 16 | Photographer-spesifikt (profession-vertikal). |
| `/api/client` | 14 | Client-portal-relaterte. Klient-side av prøvegallerier. |
| `/api/inspirations` | 11 | Inspiration-board. |
| `/api/cms` | 11 | CMS for landingssider. |
| `/api/platform` | 10 | Platform-config + features. |
| `/api/auth` | 10 | Auth-flows (login, signup, OAuth-bridges). |
| `/api/audio` | 10 | Audio-relaterte (musikk-settings). |
| `/api/wedding` | 9 | Wedding-timeline + planning. |
| `/api/payments` | 9 | Payment-handling (separat fra role-room/billing). |
| `/api/file-management` | 9 | File upload/storage. |
| `/api/external-data` | 9 | External data lookups. |
| `/api/seo-bot` | 8 | SEO-bot crawling. |
| `/api/google-photos` | 8 | Google Photos OAuth + albums (delvis dekket av showcase-google-photos). |
| `/api/deliveries` | 8 | Delivery-tracking (separat fra evendi-delivery). |
| `/api/davinci-resolve` | 8 | DaVinci Resolve-integrasjon. |
| `/api/video` | 7 | Video-relaterte. |
| `/api/vendor-types` | 7 | Vendor-type-config. |
| `/api/sales` | 7 | Sales-flow. |
| `/api/orchestration` | 7 | Orkestrering av tjenester. |
| `/api/meeting-notes` | 7 | Møtenotat-funksjonalitet. |
| `/api/invite-requests` | 7 | Invite-request-system (delt med commercial-access). |
| `/api/audio-settings` | 7 | Audio-konfig. |
| `/api/video-analysis` | 6 | Video-analyse. |
| `/api/universal-vendor-showcase` | 6 | Vendor-showcase (separat fra showcase-cluster). |
| `/api/submissions` | 6 | Generelle submissions. |
| `/api/google-wallet` | 6 | Google Wallet-integrasjon. |
| `/api/google` | 6 | Generell Google-integrasjon. |
| `/api/branding` | 6 | Branding-config. |
| `/api/audio-enhancement` | 6 | Audio-forbedring (AI). |
| `/api/ai` | 6 | Generelle AI-endpoints. |
| `/api/accounting` | 6 | Regnskapsintegrasjon (Tripletex etc.). |

**Pluss ~70 mindre grupper med 1-5 endpoints hver.**

#### B. Backend Fase 2 — `/api/role-room` utsatt (19 endpoints)

Allerede dokumentert over: ~~`education-inquiries` (1)~~ ✅ ferdig sesjon 2, `projects` (10), `billing` (9). Krever service-laget-refactor først.

#### C. Frontend Fase 1 — IKKE PUSHET (re-implementering trengs)

Per den eldre seksjonen "🚧 IKKE PUSHET — venter på re-implementering" øverst i fila:

| Fil | Hva ble gjort | Status |
|---|---|---|
| `DashboardPanel.tsx` (38KB) | Stat-kort hover-only/press/empty-hint, 3-col Hurtighandlinger, Casting-fremdrift icon-box, Bolt-ikon header, Kanban-skeleton, sectionGap, aria-regions | Mistet i `git reset --hard` (commit `fffb2b5` aldri pushet). Trenger re-apply. |
| `StoryLogicPanel.tsx` (168KB) | Mobile header, START_MODES emoji→MUI-ikoner (💡→Lightbulb, 🎭→TheaterComedy, 🧠→Psychology), strukturert Paper, inline-emoji→MUI | Samme — borderline størrelse for én MCP-write. |
| `CastingPlannerPanel.tsx` (737KB) — Ny rolle-dialog | DialogActions column-reverse, full-bredde knapper på mobil, lukkeknapp 44x44, safe-area-padding | Krever splitt-først pga. størrelse (Fase 3). |

#### D. Frontend Fase 3 — CastingPlannerPanel-splitt (helt urørt)

**Mål:** `CastingPlannerPanel.tsx` (737KB) → < 100KB orkestrator + N SubPanel-filer.

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
- (m.fl. — kartlegges ved oppstart)

**Mode-relevans:** SubPanels kan trenge mode-awareness (eks. `CrewSubPanel` for Produksjonsteam vs. minimal versjon for Innholdsprodusent). Separat axis fra `useEffectiveTabsForRole`.

#### E. Frontend Fase 4 — responsiv-optimering av alle paneler (helt urørt)

**Mål:** Alle ~50 paneler i Role Room rendres optimalt på iPhone, iPad portrait, iPad landscape, MacBook, desktop.

**Test-matrise:** 4 modes × 4 viewports = **16 kombinasjoner per panel**.

Felles patterns dokumentert i seksjonen "Fase 4" under (WCAG 2.2 44x44 touch-target, `@media (hover: hover)`, `WebkitTapHighlightColor: transparent`, breakpoints, safe-area, m.fl.).

**Rekkefølge:** DashboardPanel først (vises ved oppstart) → core-flyt (Roles/Candidates/Crew SubPanel) → AuditionSchedulePanel → mobile-only-views → KanbanPanel → StoryLogicPanel → StoryStructurePanel → resten alfabetisk.

#### F. Database / migrasjoner

Migrasjon `139_role_nav_config.sql` er kjørt i Neon. Ingen kjente nye migrasjoner trengs umiddelbart. Følg med på endringer i de utsatte clustrene (kan trenge nye tabeller/kolonner).

#### G. Sikkerhet / observability

- **Sterkt anbefalt:** roter Neon-passordet `npg_SM7AZYxyvK4L` som ble delt i klartekst i tidligere chat-tråd (allerede notert i sikkerhets-noter).
- Tsc-sjekk er den eneste kvalitetsporten brukt i sesjonen. Det finnes ingen kjente integration-tester eller lint-pipeline koblet til extraction-arbeidet — fremtidige sesjoner bør vurdere å legge til automatisert end-to-end-test før de utsatte clustrene flyttes.

### Estimat for resterende arbeid (oppdatert sesjon 2)

| Fase / område | Estimert commits | Risiko |
|---|---|---|
| Role-room utsatt (projects+billing) | 6-8 | Middels (service-refactor først; mønster nå etablert) |
| Backend Fase 2 — gjenstående store clustre | 50-80 | Høy (mange entangled helpers) |
| Frontend Fase 1 re-implementering | 3 | Lav (mistet kode må gjenskapes fra spec i memory.md) |
| Frontend Fase 3 (CastingPlannerPanel-splitt) | 10-15 | Middels-høy |
| Frontend Fase 4 (responsiv-optimering) | 30-50 | Lav-middels per panel, men 50 paneler × ~1 commit hver |
| **Totalt resterende** | **~95-155 commits** | |

Til sammenligning: sesjon 1 leverte 40 commits / 238 endpoints, sesjon 2 leverte 3 commits / 1 endpoint men med tung helper-extraction (-1150 linjer). Det gjenstår **~2-3× mer arbeid** enn det som er gjort.

---

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
   - `role-room-agent-*-routes.ts` (19 endpoints, splittet i 3 sub-moduler):
     - `role-room-agent-core-routes.ts` (3) — /access, /producer-bootstrap, /feed-plan/approvals/pending ✅ **gjort** (commit `6d5943a9`). Deps: 6.
     - `role-room-agent-feed-plan-routes.ts` (10) — templates CRUD, strategy/refresh (Claude), recommend (Claude vision + GDPR consent), drive (images/import + sharp), feed-plan CRUD, approve ✅ **gjort** (commit `303cd0a3`). Deps: 4. 8 eksterne moduler importert.
     - `role-room-agent-inspect-routes.ts` (6) — meta-page-inspect, page-search, page-content-inspect, hashtag-suggest (Claude), ig-hashtag-inspect, ads-attribution-inspect ✅ **gjort** (commit pending push). Bruker Meta Graph API direkte via fetch + Anthropic SDK dynamisk import. Deps: 4.

**🎉 Hele agent-clusteret (19 endpoints, 3 sub-moduler) ferdig.**

   - `role-room-whatsapp-routes.ts` (18 endpoints) — Meta WhatsApp Business API ✅ **gjort** (commit `9702a788`). Deps: 4.
   - `role-room-social-routes.ts` (16 endpoints) — non-Meta sosiale plattformer (linkedin, youtube, tiktok) + generelle /social/* (inbox, publish, analytics, metrics, health, agent-insights, access-request) ✅ **gjort** (commit `64af8cd4`). 9 eksterne moduler. Deps: 4.
   - `role-room-social-meta-routes.ts` (16 endpoints) — Meta-plattformer (instagram + facebook): OAuth, publish, webhooks, deauthorize, data-deletion (GDPR/Meta App Review-compliant) ✅ **gjort** (commit pending push). 6 eksterne moduler (instagram-oauth, instagram-publish, instagram-webhook, social-events, instagram-deauth, instagram-image-upload + agent-entitlements). Deps: 4.

**🎉 Hele social-clusteret (32 endpoints, 2 sub-moduler) ferdig.**
   - `role-room-whatsapp-routes.ts` (15) — WhatsApp messaging
   - `role-room-social-routes.ts` (8 social + 8 instagram + 4 tiktok + 4 facebook + 2 youtube + 2 linkedin = 28) — sosiale OAuth/posting
   - `role-room-billing-routes.ts` (9 endpoints — webhook ved linje 642 + 8 ved linje 43672-45392) — **utsatt 2026-05-09:** ekstremt spredt utover hele filen, krever Stripe-state og webhook-secrets. Kommer tilbake når subsystemet kan ekstrakteres samlet med Stripe-customer-resolver-helpers.
   - `role-room-projects-routes.ts` (10 endpoints — multi-line app.X-format avslørte 3 ekstra) — **utsatt 2026-05-09:** entangled med 14 module-scope helpers (legacyOffersByProject, legacyContractsByProject, legacyProjectAgreementsByProject Maps + getProjectItems/setProjectItems/findByIdInProjectMap/findByIdInDbProjectArrays/createProjectAgreementRecord/normalizeProjectAgreementStatus/dbLegacy*Key + compatStoreGet/compatStoreSet). Disse helpers brukes også av andre endpoints utenfor role-room-projects, så de kan ikke flyttes uten større refactor. Kommer tilbake til denne etter (a) helpers ekstraktert til egen modul, eller (b) større "casting-offers-contracts-agreements"-subsystem-extract som flytter helpers og endpoints sammen.
   - `role-room-casting-routes.ts` (6) — casting-funksjonalitet (lite — det meste ligger i `/api/casting`-clusteret som er separat)
   - `role-room-client-portal-routes.ts` (3) — admin-side av klient-portal (invite/list/revoke) ✅ **gjort** (commit pending push). Klient-siden (magic-link-auth via session_token) blir igjen i index.ts som /api/client/portal/*.
   - `role-room-education-inquiries-routes.ts` (1 endpoint) ✅ **gjort (sesjon 2)** (commits `8b23d867` + `00cd5a76` + `e8994de1`). Service-laget-refactor: 2 nye service-moduler (`role-room-turnstile-service.ts`, `role-room-education-inquiry-service.ts`) + 1 routes-modul. 17 delte helpers passes via deps. -1150 linjer netto i index.ts.
   - `role-room-commercial-access-routes.ts` (1 endpoint) ✅ **gjort (sesjon 1)** (commit `01fd6f55`). Onboarding-flyt for produksjonsteam/innholdsprodusent. `ensureRoleRoomCommercialAccess` blir værende i index.ts og passes via deps.
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
