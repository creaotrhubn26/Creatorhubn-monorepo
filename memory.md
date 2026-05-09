# memory.md — Role Room session-state og refaktor-plan

> Levende dokument for Claude Code-sesjoner og produkt-eier. Sist oppdatert: 2026-05-09.
> Plassert i repo-rot slik at Claude Code (lokal eller web) automatisk leser den ved oppstart.

---

## ✅ FERDIG — pushet til `claude/check-git-status-BAfbj`

### Konfigurerbar rolle-navigasjon (alle viewports)

Live på branch og venter på merge til `main`. Migrasjon kjørt mot Neon.

**Backend:**
- `backend/migrations/139_role_nav_config.sql` — tabell `role_nav_config(role PK, tab_values text[], updated_at, updated_by)`
- `backend/server/admin-room-role-nav-routes.ts` — eksportert `setupRoleNavConfigRoutes()` med GET/PUT/DELETE under `/api/admin-room/role-nav-config`
- `backend/server/index.ts` — wirer opp ved kall til `setupRoleNavConfigRoutes({ app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity })`

**Frontend (alle nye filer):**
- `frontend/client/src/components/role-room/hooks/useRoleNavConfig.ts` — `useRoleNavConfigs / useUpdate / useDelete / useEffectiveTabsForRole` + hardcoded defaults for 11 brukerroller
- `frontend/client/src/components/role-room/components/ipad/RoleRoomTabRail.tsx` — vertikal ikon-nav for iPad landscape (88px bred)
- `frontend/client/src/components/role-room/components/mobile/RoleRoomBottomNav.tsx` — telefon-bunn-nav (4 primære + Mer-ark)
- `frontend/client/src/components/role-room/components/admin-room/RoleNavConfigTab.tsx` — admin-UI med 4 device-mockups (iPhone/iPad-p/iPad-l/MacBook)

**Frontend (modifisert):**
- `RoleRoomDashboardPanel.tsx` — sentralt `TAB_DEFS`-katalog, `effectiveTabs.map(...)`, side-rail på iPad landscape, bottom-nav på telefon
- `pages/AdminRoom.tsx` — ny "Rolle-navigasjon"-fane wirer opp `RoleNavConfigTab`
- `styles/role-room-mobile.css` — touch-polish (`@media (hover: none)`), iPad-spesifikke regler, `.rr-tab-rail`-CSS, prefers-reduced-motion

**Sikkerhet:**
- Skriving på endpoints krever `requireAdminRoomAccess` (email-låst til `daniel@creatorhubn.com`)
- Klient-side gates: `publishing` krever `canUsePublishing`, `admin-room` krever produkteier-email — håndhevet i alle 3 nav-komponenter

---

## ✅ FERDIG — emoji → MUI

- `StoryStructurePanel.tsx` — `PURPOSE_CONFIG` (9 emoji): MenuBook, Whatshot, TrendingUp, GpsFixed, TrendingDown, CheckCircle, ArrowForward, AccountCircle, CallSplit. Brukes som `Icon: SvgIconComponent`-felt + render i Filter-MenuItem og Chip-legend.

---

## 🚧 IKKE PUSHET — venter på re-implementering

**Disse ble bygget lokalt i sandbox men gikk tapt i `git reset --hard` (commit `fffb2b5` aldri pushet).**

| Fil | Hva som ble gjort | Strategi for re-push |
|---|---|---|
| `DashboardPanel.tsx` (38KB) | Stat-kort hover-only/press-state/empty-hint, 3-col Hurtighandlinger på mobil, Casting-fremdrift icon-box + chip-style legend, Bolt-ikon i header, Kanban-skeleton, sectionGap-konstant, aria-regions | Re-apply via Edit + push via MCP `create_or_update_file` |
| `StoryLogicPanel.tsx` (168KB) | Mobile-responsiv header, START_MODES emoji→MUI (💡→Lightbulb, 🎭→TheaterComedy, 🧠→Psychology), strukturert "Hvor vil du starte?"-Paper med ikon-boks per modus, inline 🔍/💡 → GpsFixed/Tips | Re-apply + push via MCP (borderline størrelse) |
| `CastingPlannerPanel.tsx` (737KB) — Ny rolle-dialog | DialogActions column-reverse på mobil, full-bredde knapper, lukkeknapp 44x44, safe-area-padding | Liten 4-linjers diff → applyes via Claude Code på Mac (kan ikke pushes hele) |

---

## 📋 PLANLAGT REFAKTOR — bryte gigantiske filer i moduler

**Hvorfor:** MCP `create_or_update_file` har output-vindu-grense. Filer >200KB kan ikke pushes i én operasjon. Og monolitter er vanskelige å vedlikeholde uansett.

### `backend/server/index.ts` (3.9MB → mål: <100KB aggregator + ~10-15 modul-filer)

**Strategi:** Ekstrakt hver endpoint-gruppe til egen `*-routes.ts`-fil med `setupXxxRoutes()`-eksport, etter mønsteret av `admin-room-role-nav-routes.ts`. `index.ts` blir tynn aggregator som importerer og kaller `setupXxxRoutes(deps)` for hver gruppe.

**Foreløpig liste over endpoint-grupper (må verifiseres ved gjennomgang):**
- `admin-room/funding-apps/*` → `admin-room-funding-routes.ts`
- `admin-room/investor-contacts/*` → `admin-room-investors-routes.ts`
- `admin-room/partner-contacts/*` → `admin-room-partners-routes.ts`
- `admin-room/decks/*` → `admin-room-decks-routes.ts`
- `admin-room/business-plan/*` → `admin-room-business-plan-routes.ts`
- `admin-room/activity-log` → `admin-room-activity-routes.ts`
- `admin-room/role-nav-config` → ✅ Allerede ekstraktert som `admin-room-role-nav-routes.ts`
- `client/gallery/*` → `client-gallery-routes.ts`
- `photographer/galleries/*` → `photographer-gallery-routes.ts`
- `auth/*`, `role-room/*`, `casting/*`, `youtube/*` osv. — må kartlegges

**Felles `deps`-interface** (vurder shared utility):
```ts
interface AppDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (req: Request) => Session | null;
  // ...andre delte helpers
}
```

### `CastingPlannerPanel.tsx` (737KB → mål: <100KB orkestrator + N SubPanel-filer)

**Strategi:** Hver sub-panel + dialog flyttes til egen fil under `frontend/client/src/components/role-room/components/casting/`:
- `RolesSubPanel.tsx`
- `CandidatesSubPanel.tsx`
- `CrewSubPanel.tsx`
- `ScheduleSubPanel.tsx`
- `RoleEditDialog.tsx` (Ny rolle-modal)
- `CandidateEditDialog.tsx`
- `LocationsSubPanel.tsx`
- `PropsSubPanel.tsx`
- `ShotListSubPanel.tsx`
- (m.fl. — må kartlegges)

`CastingPlannerPanel.tsx` blir lett orkestrator som velger hvilken SubPanel som vises.

---

## 🛠️ Push-strategi i denne sandboksen

Sandbox-proxyen blokkerer `git push` direkte. **Eneste vei ut er GitHub MCP-write** (`create_or_update_file` / `push_files`).

**Begrensning:** MCP-tool-kall bundet av output-token-vindu (~64-128k tokens). Det betyr:
- ≤100KB filer: rett push, fungerer fint
- 100-200KB: borderline
- >200KB: krever refaktor til mindre moduler først

**Når MCP-write er aktivert** (kreves etter første session-oppsett):
- Github.com → Settings → Applications → Installed GitHub Apps → Anthropic/Claude → Configure → grant Contents: Read+Write, Issues: Read+Write, PRs: Read+Write

**Om MCP-write ikke er aktivert:** generer diff-tekst i chat, bruker applyer via lokal Claude Code på Mac.

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
