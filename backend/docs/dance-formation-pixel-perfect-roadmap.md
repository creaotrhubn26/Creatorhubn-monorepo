# Dance Formation — Pixel-Perfect Roadmap

Referansedokument for å lukke gap-et mellom eksisterende formasjons-flate i
The Role Room og DanceFlow-mockupet. Basert på en grundig kode-audit
(2026-05-31) av alle relevante filer.

## TL;DR

**Du har allerede alt av byggeklosser.** Alle tunge biblioteker er installert,
alle visualiserings-komponenter eksisterer. Gap-et er **outer-layout og
wiring**, ikke manglende infrastruktur.

## 1. Installert (verifisert i frontend/package.json)

| Bibliotek | Versjon | Brukt til |
|---|---|---|
| `fabric` | ^6.9.0 | 2D drag-canvas (FormationView) |
| `@react-three/fiber` | ^8.18.0 | 3D stage (StageMap3D) |
| `@react-three/drei` | ^9.122.0 | OrbitControls, Grid, Text |
| `three` | ^0.182.0 | 3D scene |
| `wavesurfer.js` | ^7.12.1 | Music waveform-spor |
| `framer-motion` | ^12.23.12 | Animasjoner |
| `@dnd-kit/core+sortable+utilities` | ^6/10/3 | Drag-handlers |
| `@mui/material + icons + lab` | ^6.1.6 | UI-primitiver |
| `tailwindcss` | ^4.1.13 | Utility-CSS |

**Ingenting kritisk å installere.** `@react-three/fiber` v8 pinner React 18 —
ikke bump React uten å koordinere fiber v9.

## 2. Eksisterende komponenter (linje-tellinger)

| Fil | Linjer | Hva den gjør |
|---|---|---|
| `FormationView.tsx` | 1753 | Fabric.js 2D-editor, 3-pane (Roster\|Stage\|Formations) |
| `FormationViewConnected.tsx` | 253 | Backend-wrap: load + 1.2s debounced autosave + status-pill |
| `FormationTimeline.tsx` | 261 | Multi-track (FORMATION/MOVEMENT/MUSIC/NOTES) m/ zoom 50–400% |
| `StageMap3D.tsx` | 231 | Three.js 3D-stage 12×8m, OrbitControls, cylinder-dansere |
| `CurveOverlay.tsx` | 238 | SVG cubic bezier-curves med dragbare handles per danser |
| `DancerPathsView.tsx` | 157 | Per-danser y-posisjon over formasjons-sekvens |
| `DancerPathPreview.tsx` | 160 | Mini-canvas + Path Length (m) + Travel Time (HH:MM:SS:FF) |
| `MusicWaveformTrack.tsx` | ~140 | wavesurfer.js m/ ±100ms playhead-sync |
| `formationTypes.ts` | 123 | Dancer/Formation/DancerPosition/DancerTransitionPath |
| `danceFormationService.ts` | 181 | REST /api/dance/formations (GET/POST/PATCH/PUT/DELETE) |
| `DanceWorkspace.tsx` | 669 | 18-tab shell; mounter FormationViewConnected under tab `'formations'` |
| `timecode.ts` | 31 | formatTimecode / parseTimecode HH:MM:SS:FF |

## 3. Mockup-element → eksisterende komponent (gap-analyse)

| Mockup-element | Eksisterer? | Gap | Effort |
|---|---|---|---|
| Leftmost CLIPS-sidebar | ❌ | `danceVideoService.listClips` finnes — wrap som `ClipsSidebar` | L |
| Main app nav (icon-rail) | Delvis | Eksisterende Tabs → konverter til vertikal rail | M |
| Header breadcrumbs | Delvis | `PlannerBreadcrumb.tsx` finnes i `role-room/components` — wire | S |
| Header sub-tabs (Annotate/Formation/Dancers/Analysis/Review) | ❌ | Ny `FormationHeaderBar` med MUI Tabs | M |
| Share/Export-knapper | Delvis | `SharingPanel` finnes; legg til `exportFormation('png'\|'pdf'\|'json')` | M |
| Video player (left) | ✅ | `VideoRefPlayer` (196 linjer) finnes; mount inni FormationView | M |
| 2D/3D Stage Map | ✅ | Begge finnes + toggle. Gjør Fabric responsive (fra fast 720×480) | S |
| Dancer-ID-badges D1-D5 | ❌ | Bruk ordinal `D${idx+1}` når `showIds`=true (FormationView 1587-1601) | S |
| Movement-path-kurver på stage | ✅ | `CurveOverlay` + `drawFormation` viser allerede dashed paths | S |
| Timeline FORMATION-track | ✅ | Virker | done |
| Timeline MOVEMENT-track | Delvis | Komponent støtter; data-kilde mangler — legg til `movements?` på Formation | M |
| Timeline MUSIC waveform | ✅ | Komponent virker; FormationView sender ikke `musicUrl` — wire fra choreography | S |
| Timeline NOTES-track | Delvis | Komponent støtter; data-kilde mangler — legg til `noteAnnotations?` | M |
| Timeline DANCERS color-lines | ✅ | `DancerPathsView` finnes; flytt INNI `FormationTimeline` | S |
| Playhead/scrubber | ❌ | Bind vertikal cursor til `dance:video-time`-event | M |
| Right FORMATION start/end/duration | ✅ | `FormationDetailsPanel` 1085-1110; legg til computed Duration | S |
| Right DANCERS m/ eye-toggles | ✅ | `FormationDetailsPanel` 1165-1199 | done |
| Right NOTES-textarea | ✅ | `FormationDetailsPanel` 1111-1122 | done |
| Right TAGS chips | ✅ | `FormationDetailsPanel` 1126-1162 | done |
| Right TRANSITION From/To | ✅ | `FormationDetailsPanel` 1254-1287 (To er read-only auto-next) | S |
| Right MOVEMENT PATHS m/ mini-preview | ✅ | `DancerPathPreview` (160 linjer) over details panel | done |
| Tema-konsistens | Delvis | Hex-literals spredt over 8 filer — sentraliser i `danceFlowTheme.ts` | S |
| Save-status-pill kolliderer med planlagt header | ⚠️ | Flytt fra `FormationViewConnected` 209 inn i `FormationHeaderBar` | S |

**Effort-skala:** S = <½ dag, M = 1-2 dager, L = 3+ dager.

## 4. Faseplan (~9-12 dagsverk totalt)

### Phase 1 — DanceFlow-skall + tema-tokens (1 dag)
- Ny `dance/danceFlowTheme.ts`: alle palette-konstanter (#0a0a0a bg, #a78bfa
  lavender, #fbbf24 gold, #1e2536 border, #f59e0b accent) — sentralisert
- Ny `DanceFlowShell.tsx`: 3-kolonne ytre layout (left clips · center workspace · right details)
- Edit `DanceWorkspace.tsx` 392-397: mount `<DanceFlowShell><FormationViewConnected…/></DanceFlowShell>`

### Phase 2 — Header-bar (breadcrumbs + sub-tabs + Share/Export) (1-2 dager)
- Ny `FormationHeaderBar.tsx`: breadcrumbs · 5 sub-tabs · Share · Export-meny · save-pill-slot
- Flytt save-status-logikk fra `FormationViewConnected.tsx` 206-236 inn i headeren
- Ny `formationExport.ts`: `exportFormation(fmt)` — PNG via `fabricRef.current.toDataURL()`, JSON dump, PDF stub
- Wire sub-tabs: Formation = nåværende view, Dancers = `DancerProfileGridConnected`, Analysis = `DanceAnalysisPanel`, Review = `VideoReviewRoom`, Annotate = ny drawer

### Phase 3 — CLIPS-sidebar + Main nav-rail (2-3 dager)
- Ny `DanceFlowNavRail.tsx`: vertikal icon-rail; konverter DanceWorkspace-tabs til ikoner
- Ny `ClipsSidebar.tsx`: fetch `danceVideoService.listClips(projectId)`, list m/ thumbnail + duration, click → emit `dance:select-clip` CustomEvent
- Vurder: legg `clipId` på Formation-modellen (krever migrasjon) — eller hold seleksjon lokal og la Phase 4 trekke `signedUrl` fra valgt clip

### Phase 4 — Video player + responsive stage (1-2 dager)
- Ny `FormationVideoPanel.tsx` ved siden av Fabric-canvas i FormationView's stage-area
- Grid endres fra `200/1fr/260` til `200/[video|stage]/260` (center er sub-grid)
- Gjenbruk `VideoRefPlayer`; wire `onTimeUpdate` → dispatch `dance:video-time` (lytteren finnes allerede i FormationView 185-200)
- Gjør Fabric-canvas responsive: erstatt fast 720×480 m/ `ResizeObserver` + `canvas.setDimensions()`

### Phase 5 — Multi-track timeline polish (2 dager)
- Wire `musicUrl` gjennom `FormationViewConnected` → `FormationView` → `FormationTimeline` (hent fra choreography eller valgt clip)
- Flytt `DancerPathsView` INNI `FormationTimeline` som «DANCERS»-track-gruppe nedenfor NOTES
- Playhead-cursor på timeline (vertikal linje på `currentTime / computedDuration`) bundet til `dance:video-time`
- Utvid `Formation`-typen med `movements?: {id,label,startSec,endSec}[]` og `noteAnnotations?: {id,text,startSec,endSec}[]` (eller ny `formation_timeline_items`-tabell)
- Klikk på timeline-ruler → emit seek-event tilbake til video

### Phase 6 — Visual polish + D1-D5 badges + tester (1 dag)
- Rendre «D1/D2/D3» korte-ID-er i FormationView 1587-1601 når `showIds`
- «Duration»-computed-display under start/end i right-sidebar
- Migrer alle hex-literals til `danceFlowTheme`-tokens (8 filer)
- Snapshot-tester oppdatert; Playwright smoke-test for nytt skall

## 5. Risiko-liste

- **`@react-three/fiber` v8 låser React 18.** Ikke bump uten å oppgradere fiber til v9 først.
- **Server-id-rekonsiliasjon** i `FormationViewConnected` 159-162 er fragil ved drag-then-immediately-save. Phase 5's playhead kan kreve lengre debounce eller optimistic-id-mapping.
- **`CustomEvent`-bus** (`dance:video-time`, `dance:set-tab`, `dance:select-clip`) er de-facto IPC-mønster i kodebasen — fortsett å bruke den, ikke kontekst.
- **`StageMap3D`** bruker statiske 12×8m uansett StageType — OK for V1, må fikses når runway/in_the_round vises.
- **`FormationView` er 1753 linjer** med intern `FormationDetailsPanel`. Phase 2 er god anledning til å ekstraheres detaljpanelet til egen fil.

## 6. Kritiske eksisterende detaljer å bevare

- `dance:video-time` CustomEvent (FormationView 185-200) auto-velger formasjon basert på currentTime — ikke bryt denne flyten
- ARIA live region (FormationView 455-473) — viktig for tilgjengelighet
- `data-testid` på alle interaktive elementer — Playwright-tester bygger på dette
- Undo/Redo + ⌘Z/⌘⇧Z (FormationView 128-180) — keybind-kontrakt
- `replaceFormations` PUT-route er atomic — autosave-mønsteret avhenger av dette

## 7. Lenker til relevant kode

- `frontend/client/src/components/role-room/dance/FormationView.tsx`
- `frontend/client/src/components/role-room/dance/FormationViewConnected.tsx`
- `frontend/client/src/components/role-room/dance/FormationTimeline.tsx`
- `frontend/client/src/components/role-room/dance/StageMap3D.tsx`
- `frontend/client/src/components/role-room/dance/CurveOverlay.tsx`
- `frontend/client/src/components/role-room/dance/DancerPathsView.tsx`
- `frontend/client/src/components/role-room/dance/DancerPathPreview.tsx`
- `frontend/client/src/components/role-room/dance/MusicWaveformTrack.tsx`
- `frontend/client/src/components/role-room/dance/formationTypes.ts`
- `frontend/client/src/components/role-room/dance/danceFormationService.ts`
- `frontend/client/src/components/role-room/dance/DanceWorkspace.tsx` (mount-punkt linje 392-397)
- `frontend/client/src/components/role-room/dance/timecode.ts`
