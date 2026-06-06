# Dance Formation — Workflow audit (Irlin POV)

> Audit-dato: 2026-05-31. Persona: **Irlin** — profesjonell danser/koreograf,
> ~10 års erfaring fra contemporary + jazz, jobber med oppvisninger på
> 8-24 dansere. Forventer at flaten oppfører seg som Final Cut Pro /
> Cinema 4D / branche-standard. Tenker i *counts*, ikke timecodes.

Hensikten: avdekke hva som **føles ulogisk eller bortgjemt** for noen som
ikke kjenner flaten fra innsiden. Hver gap har **status** (✅ levert i
PR #37 / 🟡 quick win / 🔴 krever større arbeid) + **konkret fix-forslag**.

---

## Fase 1 — Hun åpner flaten første gang

### G1. Hvor begynner jeg? 🟡 quick win

**Hva hun ser:** Tom shell, tom canvas, tom ClipsSidebar, tom timeline.
Ingen onboarding-tekst. Bare en mørk skjerm.

**Hva hun forventer:** "Welcome — last opp en clip, eller start fra
en mal" — Notion-style empty state.

**Fix:** Tom-state-illustrasjon på stage-area når
`formations.length === 0 && dancers.length === 0`. CTA-kort:
- "Last opp ditt første videoklipp" (router til Video-tab)
- "Bruk en mal: V-shape, Circle, Line"

---

### G2. Hva er forskjellen på Annotate, Formation, Dancers, Analysis, Review? 🔴

**Hva hun ser:** 5 sub-tabs i header. Hun klikker rundt — alle ser like ut
inntil hun forstår det er ulike syn.

**Hva hun forventer:** Hver tab har et tooltip eller intro-card første
gang den åpnes.

**Fix:** First-time-tour (eksisterende `FirstTimeTour`-komponent i kodebasen)
brukt for sub-tabsene. Eller subtle "*Hva er denne fanen?*"-link i header.

---

## Fase 2 — Hun legger til dansere

### G3. Hvor legger jeg til mine 5 dansere? 🔴

**Hva hun ser:** Roster i venstre kolonne av FormationView viser
demo-dansere (DEMO_DANCERS), ikke hennes. Pucks på stage er gamle dummy-data.

**Hva hun forventer:** "Mine dansere" — drag-fra-roster-til-stage funker
bare hvis dansere er definerte i prosjektet.

**Fix:**
- Hvis `dancers.length === 0`: vis CTA "Legg til dansere i Dancers-fanen"
  i Roster med en direkte-link.
- Lenke `dance:set-tab` til `students` ved klikk.
- Demo-dansere fjernes når brukeren har egne (allerede gjort via
  FormationViewConnected — verifiser).

---

### G4. D1, D2, D3... hva betyr disse? 🟡 quick win

**Hva hun ser:** Etter showIds er på, pucks har "D1", "D2" badges. Men hun
har døpt sin danser "Anna", "Maja", "Lin"...

**Hva hun forventer:** Badgene reflekterer hennes navn (initialer = "A",
"M", "L") eller hennes valgte forkortelse.

**Fix:** Endre D1-badges til `dancer.initials` (eksisterer allerede i
`Dancer`-typen). D-rekkefølgen er en utility for placering, ikke identitet.
**Alternativ:** behold D1-D5 som *position-tags* og vis navnet inni puck-en
i tillegg (allerede gjort — verifiser).

---

## Fase 3 — Hun laster opp en clip

### G5. "+ New Clip" rute meg til Video-fanen — jeg mistet konteksten 🟡 quick win

**Hva hun forventer:** Modal-upload som ikke flytter henne fra Formations-flaten.

**Fix:** Phase 7 — upload-modal direkte i ClipsSidebar:
- "+ New Clip" → `<UploadClipDialog>` med drag-drop-zone
- Bruker `uploadClip()` fra `danceVideoService.ts`
- Etter ferdig: refresh clips + auto-select den nye

**Midlertidig:** behold tab-switch men husk siste sub-tab i URL hash så hun
kommer tilbake til Formations etter upload.

---

### G6. Hvor er thumbnails fra? 🟢 fungerer

Cloudflare Stream gir auto-thumbnails (PR #37 Lag B). Verifiser at backend
serverer `signedUrl` som peker til customer-subdomain ELLER videodelivery.net
m/ `<uid>/manifest/video.m3u8` — hvis ikke får hun ikon-placeholder.

---

## Fase 4 — Hun spiller av clipen og koreograferer

### G7. Spille av-knappen, scrubber, speed-control 🔴

**Hva hun forventer:** Profesjonelle transport-kontroller (FCP-style):
⏮ ⏯ ⏭ · 0.25x/0.5x/1.0x/1.5x/2.0x speed · J-K-L scrubbing · frame-by-frame
m/ pilene · loop region.

**Hva vi har:** Native HTML5 `<video controls>`. Funker men er ikke
"profesjonelt".

**Fix (Lag C2 senere):** Bytt til custom transport-bar matching mockup:
- ⏮ ⏯ ⏭ ikoner
- 1.0x speed-dropdown (vibrant range 0.25-2.0)
- Frame-by-frame `j/k/l`-keybinds (allerede del av FormationView's
  keyboard-bus — verifiser)
- "Loop region" - hold shift+drag på scrubber

---

### G8. Hvor er current-time / total-time-display? 🟡 quick win

**Hva hun forventer:** `00:00:18:12 / 00:02:35:00` i video-spilleren.

**Hva vi har:** Bare native browser-controls; tids-overlay mangler.

**Fix (Lag C2 senere):** Overlay i FormationVideoPanel som leser
`video.currentTime` + `video.duration` og viser HH:MM:SS:FF / total.
Counts samtidig (G18).

---

### G9. Auto-velger ikke formasjon når playhead krysser tider 🟢 fungerer

Phase 5's `dance:video-time` → FormationView's formasjons-velg-event er
wired. Men *kun* hvis formasjonen har `startSec` og `endSec` satt. Hvis
disse er null, skjer ingenting.

**Fix:** Når formasjonen lages ved dobbeltklikk på timeline (G11), settes
`startSec` automatisk. Da fungerer auto-velg ut-av-boksen.

---

## Fase 5 — Hun oppretter formasjoner

### G10. Hvordan oppretter jeg en formasjon? 🟡 quick win

**Hva hun ser:** Formations-list til høyre, ingen synlig "+"-knapp i
tom-tilstand. Må scrolle for å finne "Ny formasjon"-text-input.

**Hva hun forventer:** STOR "+ Add Formation"-knapp øverst i lista, eller
naturlig dobbeltklikk på timeline.

**Fix (denne sesjonen):**
- Big "+ Opprett første formasjon" CTA når lista er tom
- Dobbeltklikk på timeline-bakgrunn → opprett formasjon ved klikket tid

---

### G11. Dobbeltklikk på timeline burde lage formasjon ved den tiden 🟡 quick win — IMPLEMENTERES

**Hva hun forventer:** Standard FCP/Premiere-konvensjon — dobbeltklikk
tomrom = ny marker/blokk.

**Hva vi har:** Klikk dispatcher `dance:video-seek` (Phase 5). Dobbeltklikk
ikke håndtert.

**Fix:** FormationTimeline lytter på `onDoubleClick` → dispatcher
`dance:create-formation-at` `{ timeSec }`. FormationView lytter → lager ny
formasjon m/ `startSec: timeSec`, `endSec: timeSec + 4`.

---

### G12. Bind formasjon til ekte navn (V-Shape, Circle, Line) 🔴

**Hva hun ser:** Hun må skrive "V-Shape" som navn manuelt. Mockup viser
en dropdown med pre-laget templates.

**Hva vi har:** `FORMATION_TEMPLATES`-array med Circle, V-Shape, Grid, osv.
Applies via "Bruk mal" i details-panel.

**Fix:** Erstatt formation-name-text-input med en searchable Combobox:
- Type-ahead viser templates
- Velger → fyller inn navnet + anvender template
- Fri-skrift fortsatt mulig

---

## Fase 6 — Hun plasserer dansere på stage

### G13. Drag fra Roster — fungerer det? 🟢 fungerer

Eksisterende Roster-pane i FormationView håndterer drag. Verifiser at det
faktisk svarer på drag-events på første-bruks-sjekk.

---

### G14. Kan jeg "låse" en formasjon så jeg ikke flytter ved et uhell? 🔴

**Hva hun forventer:** Lock-ikon per formasjon i lista som forhindrer
endring (men beholder visning).

**Fix:** Legg til `locked?: boolean` på Formation-typen. UI: lock-icon i
formasjon-row + i details-panel. Drag/click-handlers respekterer.

---

### G15. Curve-mode mellom dansere — ikke åpenbart 🟡 quick win

**Hva hun ser:** "⌒"-toggle-button i toolbar. Hva betyr det?

**Hva hun forventer:** Tooltip + onboarding "Tegn buer mellom posisjoner"
+ kanskje en kort animasjon-demo.

**Fix:** Bedre tooltip-tekst (allerede der: "Slå av kurve-modus" / "Tegn
kurve mellom dansere"). Legg til en hjelp-link.

---

## Fase 7 — Hun jobber med musikk-sync

### G16. Hvor er counts? 🟡 quick win — IMPLEMENTERES

**Hva hun forventer:** "I am at count 32 of 192". Koreografer tenker i
1-2-3-4-5-6-7-8.

**Hva vi har:** Bare timecode (HH:MM:SS:FF). Counts mangler.

**Fix:** I FormationVideoPanel / FormationHeaderBar / Timeline ruler:
vis Counts-tall ved siden av timecode.
- Default 120 BPM ⇒ 2 beats/sek ⇒ count = currentTime × 2
- Per prosjekt: definerbar BPM (legg på `Choreography`-typen senere)

---

### G17. MUSIC-track viser bare clip-video-lyd 🔴

**Hva hun forventer:** Mulig å laste opp separat musikk-fil og syncer
mot videoen. F.eks. dansestudio-mix uten kommentarer.

**Fix:** "Music source"-velger i timeline:
- "Fra valgt clip" (default) eller
- "Egen musikk-fil" (last opp `.mp3`/`.wav`)
- Holder offset (i sek) hvis musikken må shiftes

---

## Fase 8 — Hun noterer + samarbeider

### G18. Notes på tid, ikke per-formasjon 🔴

**Hva hun forventer:** "Watch D2 & D4 cross" knyttet til tid 0:24, ikke
til en formasjon. Time-anchored comments som Adobe Premiere markers.

**Hva vi har:** `noteAnnotations?` i Formation-typen (Phase 5 nevner
schema-utvidelse), men ingen UI/backend ennå.

**Fix:** Phase 5b — Migrasjon `formation_timeline_items` med
`(project_id, type='note'|'movement', start_sec, end_sec, text)`. UI:
right-click på timeline tomrom → "Legg til note her".

---

### G19. Share-knappen gjør ingenting 🟡 quick win

**Hva hun ser:** Klikker Share → tomt.

**Hva hun forventer:** Kopier delbar URL, eller send til e-post.

**Fix:** `onShare`-callback wired:
- `navigator.clipboard.writeText(window.location.href)` + snackbar
  "Lenke kopiert"
- Eventuelt en "Share dialog" m/ PDF-eksport-link, embed-iframe-snippet

---

### G20. Hvordan ser jeg endring-historikk? 🔴

**Hva hun forventer:** "Endret av X kl Y" — multi-user audit-trail.

**Hva vi har:** Lokal Undo/Redo (⌘Z), men ingen server-side audit.

**Fix:** Phase 8 — `formation_audit_log`-tabell + UI-side-panel.

---

## Fase 9 — Hun eksporterer

### G21. PNG bare aktiv formasjon, hva med ALLE? 🔴

**Hva hun forventer:** "Stage plot for hele stykket" — én PDF med alle
formasjoner kronologisk + counts + dansere-bemerkninger. Print-friendly
for å ta med til prøver.

**Hva vi har:** PNG av nåværende canvas (Phase 2) + JSON-dump. PDF stub.

**Fix:** Phase 6e — `<StagePlotPdf>`-print-stylesheet:
- Én side per formasjon
- Tittel + tid + counts
- Stage-thumbnail (canvas.toDataURL)
- Dancer-tabell m/ posisjoner
- Notes/transitions
- Bruk same `@react-pdf/renderer` som Branded Decks (allerede installert)

---

### G22. JSON-eksport — hva er use-case? 🟡

**Hva hun ser:** "JSON (rådata)" mens hun har null-anelse hva JSON er.

**Fix:** Endre label til "Backup-fil" + tooltip "For re-import eller
deling med en annen DanceFlow-bruker".

---

## Fase 10 — Hun arbeider på mobil

### G23. Touch-drag på Fabric-stage — fungerer? 🔴

**Hva hun forventer:** Tap-and-hold for å plukke puck, drag for å flytte.

**Hva vi har:** Fabric.js v6 har touch-support, men ikke testet i denne
PR-en. ResizeObserver (Phase 6c) skalerer canvas, men touch-koordinater
må mappes riktig til canvas-koordinater.

**Fix:** Eksplisitt touch-event-test under Playwright mobile-viewport.

---

### G24. Sub-grid `[video | stage]` på mobil 🟡

**Hva hun forventer:** Stack vertikalt, ikke side-by-side når skjermen
er smal.

**Hva vi har:** `gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px,1fr) auto' }`
— allerede stacker på under-lg. Verifiser.

---

## Fase 11 — Hun jobber med assistent (samarbeid)

### G25. Real-time collab 🔴

**Hva hun forventer:** Sin assistent på en annen laptop ser endringene
hennes i sanntid.

**Hva vi har:** Ingenting. autosave-debounce på 1.2s, men ingen WebSocket-
sync.

**Fix:** Phase 9 — Yjs eller Liveblocks for shared cursors + presence.

---

## Fase 12 — Hun setter struktur for hele stykket

### G26. Sections / Acts 🔴

**Hva hun forventer:** Stykket har "Intro", "Vers 1", "Refreng", "Vers 2",
"Bridge", "Outro". Hver section har egne formasjoner.

**Hva vi har:** Bare flat formations-liste.

**Fix:** Phase 10 — Section/Act-gruppering. Vises som collapsible
i formations-list + timeline.

---

## Topp-5 fix-prioriteringer (mest UX-verdi per time)

| Rank | Gap | Type | Effort |
|---|---|---|---|
| 1 | **G11 dobbeltklikk-timeline-create** | Quick win | 30 min |
| 2 | **G10 Big "+ Add" CTA i tom-state** | Quick win | 30 min |
| 3 | **G16 Counts-display** | Quick win | 1 t |
| 4 | **G19 Share-knapp wired (copy URL)** | Quick win | 15 min |
| 5 | **G3 Tom-roster CTA → Dancers-tab** | Quick win | 30 min |

Implementeres i denne sesjonen: 1, 2, 3.

## Topp-5 stra­te­gis­ke gaps (krever planlegging)

| Rank | Gap | Type | Notater |
|---|---|---|---|
| 1 | **G21 Stage-plot-PDF** | Strategisk | Mest etterspurte hos koreografer |
| 2 | **G7 Profesjonell transport-bar** | Strategisk | Branche-forventning |
| 3 | **G18 Time-anchored notes** | Strategisk | Krever migrasjon |
| 4 | **G25 Real-time collab** | Strategisk | Yjs/Liveblocks |
| 5 | **G26 Sections/Acts** | Strategisk | Schema-endring |

---

## Hvordan validere disse fix'ene

1. Bruker-test med Irlin (én sesjon, 60 min) gjennom workflowen
2. Time hver oppgave + telle "huh?"-øyeblikk
3. Sammenligne pre/post-fix
4. Beslutning: ship neste tier basert på faktisk friksjon
