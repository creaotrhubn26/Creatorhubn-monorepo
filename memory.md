# memory.md — Role Room session-state, refaktor-plan og kø

> Levende dokument for Claude Code-sesjoner og produkt-eier. Sist oppdatert: 2026-05-09.
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
 24  /api/admin-room    ← ✅ delvis ekstraktert (role-nav-config)
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

1. `role-room-routes.ts` (97 endpoints) — sannsynligvis splittes i 3-4 sub-moduler:
   - `role-room-projects-routes.ts`
   - `role-room-casting-routes.ts`
   - `role-room-crew-routes.ts`
   - `role-room-misc-routes.ts`
2. `showcase-routes.ts` (60)
3. `admin-routes.ts` (51) — eventuelt splittes
4. `evendi-routes.ts` (50)
5. `projects-routes.ts` (48)
6. `casting-routes.ts` (48)
7. `story-arc-routes.ts` (40)
8. `community-routes.ts` (30)
9. `equipment-routes.ts` (25)
10. `split-sheets-routes.ts` (24)
11. `analytics-routes.ts` (24)
12. `admin-room-funding-routes.ts` (3)
13. `admin-room-investors-routes.ts` (5)
14. `admin-room-partners-routes.ts` (5)
15. `admin-room-decks-routes.ts` (6)
16. `admin-room-business-plan-routes.ts` (3)
17. `admin-room-activity-routes.ts` (1)
18. (resten av smågrupper bundles eller utsettes)

**Kritisk:** Felles helpers (`pool`, `getActiveSessionFromRequest`, `requireAdminRoomAccess`, `logAdminActivity`, `getActiveProfessionMode` osv.) bør eksporteres fra en `backend/server/_shared.ts`-fil eller passes inn via deps. Velg én strategi før første ekstrakt.

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
