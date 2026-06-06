# Dance Formation — Workflow audit v2 (dyp gjennomgang)

> Bygger på `dance-formation-workflow-audit.md` (v1, 26 gaps).
> v2 går dypere på 11 nye kategorier: error states, accessibility, mobile-
> touch, keyboard-power-user, internationalization, performance, data-
> integritet, permissions, onboarding, cross-device sync, edge cases.

Hver gap har: persona-vinkel (Irlin med variasjoner), **scenario** (hva
hun gjør), **gap** (hvor det halter), **fix-forslag** (konkret).

---

## Kategori A — Error & recovery states

Dancers er sensitive til "har jeg mistet arbeidet mitt". Mer enn UI-glans.

### A1 🔴 Network drop midt i drag

**Scenario:** Irlin holder på å dra en puck. WiFi-en mister forbindelsen.
Hun fullfører dragen. Autosave feiler.

**Gap i dag:** Bare en rød "Lagring feilet"-pill. Hun vet ikke om
endringen forsvant eller bare sitter lokalt.

**Fix:**
- Klart skille mellom "endring lagret lokalt" (offline-tilstand) og
  "endring forsvunnet"
- Persist til `localStorage` ved autosave-feil
- Sync ved reconnect
- UI: "📡 Offline — endringer lagres når du er på nett igjen"

### A2 🔴 Concurrent edit conflict

**Scenario:** Irlin + assistent åpner samme prosjekt. Begge endrer
formasjon A samtidig.

**Gap:** `replaceFormations` PUT er atomic, sist-skriver-vinner. Mister
endringer stille.

**Fix:** Version-counter på formasjon. Hvis server-versjon > local,
vis "Konflikt — assistent endret denne. Behold min / behold deres".

### A3 🟡 Save error i form-felter

**Scenario:** Hun setter `endSec < startSec`. UI lar henne gjøre det.
TimecodeInput committer. Backend reagerer.

**Gap:** Ingen client-side validering.

**Fix:** TimecodeInput respekterer min/max-prop. Vis hint "Slutten må
være etter starten".

### A4 🔴 Slettet danser med posisjoner

**Scenario:** Irlin sletter Anna fra Dancers-tab. Anna har posisjoner i
3 formasjoner.

**Gap i dag:** Posisjoner blir orphan-poster (dancerId peker mot intet).
Pucks forsvinner stille.

**Fix:** Slett-dialog: "Anna er i 3 formasjoner. Slett posisjonene
også, eller ta henne ut?". Default = "ta henne ut" (sett `hiddenDancerIds`).

### A5 🟡 Save-pill vises kun et øyeblikk

**Scenario:** Hun jobber i 30 min uten å se save-pillen siden den fades
ut. Vet ikke om autosave faktisk fungerer.

**Fix:** Ved siden av "Lagret" — vis "Sist lagret 14:32" som persistent
status. Hvis > 5 min siden siste lagring, varsel.

### A6 🟡 Hard refresh = mistede unsaved-endringer

**Scenario:** Hun trykker F5 mens "Lagrer..."-pill er aktiv.

**Gap:** `window.onbeforeunload` ikke implementert.

**Fix:** Når save-status = 'saving', bind beforeunload til "Endringer
holder på å lagres — vent et øyeblikk".

---

## Kategori B — Accessibility

Skjermlesere, tastatur-only, høy-kontrast, reduced motion.

### B1 🔴 Fabric-canvas er ikke tastatur-tilgjengelig

**Scenario:** Irlin bruker assistive teknologi (tab + piltaster).

**Gap:** Canvas-objekter er ikke fokuserbare. Hun kan ikke flytte
pucks uten mus.

**Fix:** Tab gjennom pucks via Fabric's `canvas.setActiveObject()`. Piltaster
flytter aktiv puck (1% av STAGE per piltrykk).

### B2 🟡 Skjermleser kunngjør ikke formasjonsbytter

**Scenario:** Hun lytter mens hun navigerer timeline.

**Gap:** ARIA live region for canvas-events er ikke koblet til formasjon-
bytter (kun til drag-events).

**Fix:** Når `activeFormationId` endres, oppdater `ariaAnnounce` med
"Bytte til V-Shape ved 12 sekunder".

### B3 🔴 Farge-bare info (D1-D5 fargede sirkler)

**Scenario:** Daltonist (rød-grønn-blindhet) ser ikke forskjell på D1 og D4.

**Gap:** Eneste skille er farge.

**Fix:** Dancer-pucks: farge + mønster (stripet/prikkete/heltrukket).
Eller alltid vis initialer + tall.

### B4 🟡 Reduced motion respekteres ikke

**Scenario:** Hun har "Reduce motion" på i macOS. Animasjoner fortsatt
spiller.

**Fix:** `@media (prefers-reduced-motion: reduce)` — disable transitions
+ animasjoner. Fabric-animasjon mellom A→B kan også hoppe.

### B5 🟡 Lavender på mørk bakgrunn — kontrast

**Scenario:** Hun har dim skjerm under øvelse i sterkt lys.

**Gap:** `#a78bfa` på `#0a0a0a` er 4.5:1 (AA-tilstrekkelig, men ikke AAA).

**Fix:** Sjekk WCAG-kontrast på alle tekst-farger. Tilby "High contrast"-
modus.

---

## Kategori C — Mobile/touch

### C1 🔴 Pinch-zoom på stage

**Scenario:** Hun arbeider på iPad. Vil pinch-zoom inn for å se detalj
på pucks.

**Gap:** Fabric-canvas tar over touch-events. Ingen pinch-zoom.

**Fix:** Pinch-gesture toggles fabric `canvas.setZoom()` proporsjonalt.
Bevar Phase 6c ResizeObserver-zoom som baseline.

### C2 🔴 Drag på touch — ikke testet

**Scenario:** Tap-and-hold for å plukke puck.

**Gap:** Fabric v6 har touch-support, men ikke verifisert.

**Fix:** Playwright mobile-viewport-test + manual test på iPad.

### C3 🟡 Sidebar-collapse på mobile er for hard

**Scenario:** På iPhone er ClipsSidebar gjemt. Hun finner ikke clips.

**Gap:** Sidebar er `display: none` under md i DanceFlowShell.

**Fix:** Bottom-sheet eller drawer-trigger for clips på mobile.

### C4 🟡 Tastatur popper opp dekker timeline på iPad

**Scenario:** Hun bruker TimecodeInput. Soft keyboard skjuler timeline.

**Fix:** Scroll-into-view + auto-collapse-elements ved focus.

---

## Kategori D — Keyboard power-user

### D1 🟡 Ingen Cmd+K command palette i Formations-flate

**Scenario:** Power-user vil hoppe direkte til "Phase 2 formation".

**Gap:** CommandPalette finnes på DanceWorkspace-nivå men ikke inni
FormationsTabBody.

**Fix:** Inkluder formation-actions i CommandPalette: "Opprett V-Shape",
"Hopp til 0:24", "Bytt til Annotate-fanen".

### D2 🟡 Space-bar play/pause kollapser med dragging

**Scenario:** Hun vil play/pause med space, men har en puck selected.

**Gap:** Ingen global space-binding.

**Fix:** `window.addEventListener('keydown')`: hvis space + ikke i input-
felt → dispatch `dance:video-toggle-play`.

### D3 🟡 J/K/L scrub

**Scenario:** Standard NLE-konvensjon.

**Gap:** Ikke implementert.

**Fix:** J=rewind/reverse, K=pause, L=play/fast-forward.

### D4 🟡 . og , for frame-by-frame

**Scenario:** Standard editor-konvensjon.

**Gap:** Ikke implementert.

**Fix:** Comma = -1 frame, period = +1 frame (forutsetter 30fps default).

---

## Kategori E — Internationalization

### E1 🟡 Norsk + engelsk-blanding

**Scenario:** Header sub-tabs er engelsk ("Annotate/Formation/Dancers/
Analysis/Review"), men details-panel er norsk ("Formasjoner", "Slutt").

**Gap:** Ingen i18n-strategi.

**Fix:** Bestem språk-policy per dans-flate. Best: bruker velger.
DanceFlow-spesifikke termer (counts, upstage) er typisk engelsk fordi
internasjonale dansere lærer dem på engelsk.

### E2 🟡 Dato-format hardkodet til 'en-US'

**Scenario:** Norsk bruker leser "May 12" — funker, men "12. mai" er
mer naturlig.

**Fix:** `toLocaleDateString(navigator.language, ...)` i ClipCard.

### E3 🟡 BPM-counts antar 4/4-takt

**Scenario:** Hun jobber med 3/4 (vals) eller 6/8.

**Gap:** Count-display antar 4/4 implisitt.

**Fix:** Per-prosjekt time-signature-prop på Choreography. Counts blir
"1 of 8" eller "1 of 6" basert på takt-arten.

---

## Kategori F — Performance

### F1 🟡 30+ formasjoner i timeline

**Scenario:** Show med 30 formasjoner. Timeline blir overlappende, vanskelig
å skille blokker.

**Fix:** Auto-skala farge-koding (regnbue rundt sirkel?) + zoom-til-fit.

### F2 🔴 Mange pucks på stage = sakte drag

**Scenario:** 20+ dansere. Fabric `requestRenderAll` blir tregt.

**Gap:** Vi bruker `requestRenderAll` overalt; bør være `renderAll` selektivt.

**Fix:** Bruk `canvas.renderOnAddRemove = false` + manuell render. Lazy
re-render kun aktive objekter.

### F3 🟡 ResizeObserver throttle bytter mellom values

**Scenario:** Bruker drar window-bredden.

**Gap:** Vi har requestAnimationFrame throttle (Phase 6c), men hver tick
trigger setDimensions = re-render av alle pucks.

**Fix:** Debounce 100ms + bare resize hvis bredden faktisk endret > 5px.

---

## Kategori G — Data integritet

### G_1 🔴 Drag-then-immediately-edit-name = lost edit

**Scenario:** Hun drar puck, så endrer navn på formasjonen før autosave
fullfører.

**Gap:** Server-id-rekonsiliasjon (FormationViewConnected.tsx 159-162) er
fragil. Memory dokumenterer dette: "drag-then-immediately-save".

**Fix:** Optimistic ID-mapping. Generer client UUID, behold mapping til
server-ID returneres.

### G_2 🟡 Eksport av tomt projekt

**Scenario:** Hun klikker Export PNG før hun har lagt til noe.

**Gap:** Eksporterer en tom canvas.

**Fix:** Disable Export-knapp når `formations.length === 0`.

---

## Kategori H — Permissions / multi-user

### H1 🔴 Eier vs visningsmodus

**Scenario:** Hun deler URL med dansere. De skal kun se, ikke endre.

**Gap:** Ingen read-only-modus.

**Fix:** Detect role (session.role) — show-only renders ingen drag-handlers,
ingen "+ Ny formasjon"-knapp, ingen Eksport for sensitive data.

### H2 🟡 "Hvem så på sist?"

**Scenario:** Hun lurer på hvilke dansere som har åpnet stage-plotet.

**Fix:** Server-side `formation_views`-tabell. Vis i details-panel.

---

## Kategori I — Onboarding

### I1 🔴 Første-bruk skjuler nye funksjoner

**Scenario:** Hun har brukt flaten i 2 uker. Vi shipper Phase 5
playhead-cursor. Hun oppdager den ikke.

**Fix:** "What's new" - badge på header (Whats-new-system finnes i kodebasen,
verifiser at dance-modus er inkludert).

### I2 🟡 Cheat-sheet for keybinds

**Scenario:** "Jeg kan ikke huske om det er Cmd+Z eller Ctrl+Z".

**Fix:** "?" tastatur-shortcut viser modal med alle keybinds.

---

## Kategori J — Cross-device

### J1 🔴 Sync mellom laptop og iPad i bevegelse

**Scenario:** Hun jobber på laptop i kafé. På vei til studio åpner iPad.

**Gap:** Hver fanesesjon-laster trinn — debounced server-state. Ingen
push-sync.

**Fix:** WebSocket eller SSE — last endringer i sanntid.

---

## Kategori K — Edge cases

### K1 🟡 Undo etter delete

**Scenario:** Hun sletter en formasjon. Trykker Cmd+Z.

**Gap:** Undo-stack inkluderer slette-actions?

**Fix:** Verifiser at slett-actions snapshottes til undoStackRef.

### K2 🟡 Klikk på timeline UTENFOR computedDuration

**Scenario:** Hun klikker mer-til-høyre enn siste formasjon.

**Gap:** Klikk dispatcher seek til computedDuration (klampet).

**Fix:** Vis bruker-feedback: "Lengre enn klippet" varsel.

### K3 🟡 Slette aktiv formasjon

**Scenario:** Hun sletter formasjon hun jobber i.

**Gap:** activeFormationId blir orphan.

**Fix:** Auto-velg nærmeste eller første formasjon etter delete.

### K4 🟡 Last opp 4K-video — performance + cost

**Scenario:** Hun laster opp en 4K-clip av oppvisning.

**Gap:** Cloudflare-pris + nettleser-spilling-tregt.

**Fix:** Backend transkoder til 1080p auto. Vis "Bearbeider..."-status
i ClipsSidebar.

---

## Topp-10 fix-prioriteringer (oppdatert post-v2)

| Rank | Gap | Effort | UX-verdi |
|---|---|---|---|
| 1 | A1 Offline-tilstand m/ localStorage | 2 t | Høy (data-tap er katastrofalt) |
| 2 | I1 Onboarding av nye funksjoner | 1 t | Medium |
| 3 | D2 Space play/pause | 30 min | Høy (power-user) |
| 4 | A3 Validering endSec > startSec | 30 min | Medium |
| 5 | G21 (v1) Stage-plot-PDF | 4 t | Høy (mest etterspurte) |
| 6 | G7 (v1) Custom transport-bar | 3 t | Høy |
| 7 | A4 Slette danser m/ posisjoner | 1 t | Høy |
| 8 | B1 Tastatur-tilgjengelighet Fabric | 4 t | Compliance |
| 9 | H1 Read-only-modus | 2 t | Multi-user |
| 10 | A5 Sist-lagret-timestamp | 30 min | Trygghet |

Implementeres i denne sesjonen: G7, G21 (v1-prioriteringer) + quick wins
G3, G15, G19, G22.

## Topp-5 strategiske (egne PRer)

| Gap | Vil ta | Hvorfor utsatt |
|---|---|---|
| G_1 Optimistic ID-mapping | 1 dag | Krever backend-API-endring |
| J1 WebSocket-sync | 3 dager | Stor scope |
| C1/C2 Pinch + touch-test | 2 dager | Krever fysisk iPad-test |
| H1 Read-only-rolle | 2 dager | Krever session-role-design |
| F2 Performance på 20+ dansere | 2 dager | Krever Fabric-render-refactor |

---

## Validerings-strategi (oppdatert)

1. **Bruker-test med Irlin** + 2 assisterende dansere (parallel-session)
2. **Accessibility-audit** med VoiceOver + tab-only
3. **Mobile-test** på iPad Pro + iPhone 14
4. **Network-throttle-test** i Chrome DevTools (slow 3G, offline)
5. **Stress-test** med 30 formasjoner × 20 dansere

Mål: < 3 "huh?"-øyeblikk per 30-min-sesjon. < 200ms latens på drag.
< 5s første-paint. AA-tilgjengelig minimum.
