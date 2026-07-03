# Product Demo Studio — ende-til-ende workflow-audit

**Dato:** 2026-07-03 · **Type:** read-only audit med kode-bevis · **Kode-tilstand:** filer per 2026-06-29

> **TL;DR:** Kjeden URL → analyse → AI-manus → eksport er *reell* og koblet i begge ender — dette er ikke et fasade-produkt. Men produktet har i praksis **to opptaksbaner**: en autonom Playwright-bane som fikk nesten all ny robusthet (TTS, cursor/zoom-polish, self-heal, cross-origin), og en guidet Tauri-bane som fortsatt bærer de gamle gapene. Fire P0-er blokkerer «leveringsklar». Valideringen («forventet vs detektert») er streng-sammenligning av CSS-stier, ikke faktisk utfall — «verifisert» kan være falskt begge veier.

**Avvik i grunnlaget:** `fusionDemoExport.ts` finnes ikke i repoet (ingenting refererer «fusion»). `demoCaptureService.ts` ligger i `src/services/`, ikke i demo-studio-mappen.

---

## 1. Workflow-spor (de 9 stegene)

| # | Steg | Status | Hvorfor (bevis) |
|---|------|--------|-----------------|
| 1 | URL-input | ✅ | Tilgivende normalisering + Enter/knapp-gate. `DemoStudioShell.tsx:93-96, 807-814` |
| 2 | Side-analyse | ⚠️ | Ekte WebviewWindow-skann (omgår X-Frame-Options) m/ shadow-DOM, multi-locators, html2canvas (`demo_capture.rs:55-73`, `demo_scan_inject.js`), men fast 1200 ms SPA-vent (`demo_scan_inject.js:277`), 20 s-timeout kortere enn skannet selv (`demoCaptureService.ts:55`), og cookie-/login-vegger katalogiseres som om de var produktet |
| 3 | AI-scene-generering | ✅ | Begge ender finnes: `claudeProxyService.ts:149` → `post-agent-anthropic-routes.ts:326` (montert `index.ts:139`); scener bindes til **ekte** skannede elementer m/ locators + bindingConfidence (`demoStudioAI.ts:887-899`). Mangler timeout/retry (⚠️) |
| 4 | Manus-redigering | ✅ | Generate/AI Improve/Annotér/skjermbilde wiret m/ busy/error/undo (`ScriptBuilderView.tsx:94-145`); kun kosmetiske blindveier (søk ⌘K, tilbake-pil, ⋮) |
| 5 | Enhetsvalg | ⚠️ | Native iOS/simulator/iPhone-Mirroring-capture er ekte og komplett (`capture_sources.rs:169-252`), men web-«iPhone»-rammen mangler UA-emulering → desktop-layout i mobilramme (`FramedDevice.tsx:19-21`); `CaptureChooser.tsx` er død kode |
| 6a | Veiledet opptak | ⚠️ | Web-veien funker e2e: getDisplayMedia → MediaRecorder → ffmpeg-mp4 (`useSceneRecorder.ts:98-168`, `demo_recording.rs:64-109`). Men Tauri-fallback tar opp **hele skjermen** inkl. app-UI (`useSceneRecorder.ts:130-144`), og native opptak gir null UI-feedback |
| 6b | Auto-opptak | ❌ | Stale closure gjør at auto-modus aldri lagrer opptak (`GuidedRecorderView.tsx:207,224`); shellens «Kjør automatisk» åpner nytt vindu på base-URL per steg → flerstegs-flyt umulig (`demo_capture.rs:131-148`); `continueMode='assisted'` er helt ukoblet |
| 7 | Validering | ❌ | «Match» = normalisert streng-likhet av CSS-stier, ikke utfall (`demoStudioModel.ts:381-387`); vision-verifisering skjermdumper en **fersk sidelast**, ikke tilstanden etter handlingen (`DemoStudioShell.tsx:480-487` → `demo_capture.rs:164-180`); auto-inject rapporterer `ok:true` selv når handlingen kaster (`demo_auto_inject.js:62-65`); fritekst `validationRule` evalueres aldri |
| 8 | Eksport | ⚠️ | Video-kjeden er reell (`ExportView.tsx:318` → `mockup_render.rs:58` → `mockup-polish-pro.mts`, med ramme/musikk/ducking/loudnorm), men **ingen voiceover** i guided-eksport (P0) og overlays sendes inn men droppes stille (`ExportView.tsx:288-297` vs `mockup-polish-pro.mts:46-51`). Autonom-banen er derimot komplett: TTS 3-lags fallback + QA-retry + mux (`autonomousDemo.ts:19-150`, `autonomous_demo.rs:279+`). Guide-HTML er reell men iframe-fallback gir svart boks og `startScrollPct` ignoreres (`demoStudioExports.ts:577-579, 519`) |
| 9 | Deling | ⚠️ | Publisert guide-lenke er ekte og B2-backet m/ view-stats (`ExportView.tsx:206-220` → `role-room-published-guides-routes.ts:79,130`). Men selve **prosjektet** er localStorage-only på én maskin — ingen sky, samarbeid, embed eller funnel-analytics |

---

## 2. Gap-liste (med fikse-sjekkbokser)

### P0 — blokkerer brukbarhet

- [x] **G1 · Falskt «Lagret»-signal ved quota-feil** — *FIKSET 2026-07-03: `saveProject` returnerer `SaveResult` ('saved'/'saved_partial'/'error') m/ slank-fallback som dropper base64-bildene ved full kvote; storen sporer `saveStatus`/`lastSavedAt`; topbaren viser ekte status (grønn/gul/rød).* · alle steg · `demoStudioModel.ts:1251-1259`, `DemoStudioShell.tsx:843,853`
  Forventet: bruker kan stole på at arbeid er lagret. Faktisk: `saveProject` svelger quota-exception stille, og «Draft · Autosaved just now» / «✓ Lagret» er hardkodet uansett utfall. Prosjektet bærer base64 `scanShots` (`demoStudioModel.ts:304`) — ett prosjekt kan alene sprenge localStorage-kvoten (~5 MB).
  Fiks: returner suksess fra `saveProject`, vis ekte lagringsstatus, strip shots ved lagring / flytt til IndexedDB. **Est: M**

- [x] **G2 · Guided video-eksport leverer video uten voiceover tross toggle** — *FIKSET 2026-07-03: `startExport` syntetiserer TTS per scene m/ autonom-banens stemme-prioritet (server-ElevenLabs `ttsProxy` → macOS `say`), best-effort m/ advarsel ved feil. Nytt `voiceover`-felt gjennom `mockupRenderVideo` → `mockup_render.rs` → `mockup-polish-pro.mts`, som mikser inn hver narration på klippets kumulative offset — FØR musikk-ducking (musikk dukker under stemmen) og loudnorm (samlet normalisering). Bevarer ProRes-alfa (ingen ettermux). Advarer i logg når narration er lengre enn klippet. Runtime-test av full eksport gjenstår.* · eksport · `ExportView.tsx:305`, `mockup-polish-pro.mts:329-343`, `useSceneRecorder.ts:105`
  Forventet: «Inkluder voiceover» + skrevet narration → video med VO. Faktisk (før fiks): togglen styrte kun klippenes egen (stille) lyd. `voiceoverResolve` (`ExportView.tsx:240-252`) genererer fortsatt kun i DaVinci Resolve (eget verktøy, alltid engelsk) — vurder å fjerne/omdøpe den nå som ekte VO finnes.

- [x] **G3 · Auto-modus i Guided Recorder lagrer aldri opptak** — *FIKSET 2026-07-03: `runAuto` leser start-indeks/scener ferskt fra storen og kaller `stopAndSave` ubetinget (hooken sjekker selv ekte MediaRecorder-tilstand); samme i `doneAndNext`. Runtime-verifisering gjenstår.* · opptak · `GuidedRecorderView.tsx:207,224`, `useSceneRecorder.ts:147-150`
  Forventet: auto tar opp alle scener. Faktisk: stale closure leser `rec.state === 'recording'` fra render før opptak startet → alltid false → `stopAndSave` hoppes over; neste `rec.start` forkaster forrige scenes chunks. Scener markeres «done» uten recordingPath.
  Fiks: les state fra ref/retur-verdi. **Est: S** *(kode-entydig; verifiser i runtime)*

- [x] **G4 · Auto-utfør/capture kan ikke kjede steg — ingen persistent sesjon** — *FIKSET 2026-07-03 (Tauri-banen): nytt vedvarende `demo-session`-vindu (`demo_session_open/exec/verify/shot/close/report` i `demo_capture.rs` + `demo_session_inject.js` + capability). Steg kjøres via eval() i SAMME vindu — navigasjon og innlogging består mellom stegene. Shell: `autoRunCurrent`/`verifyCurrentAction` omkoblet til økten + ny «⏩ Kjør alle automatisk» (alle gjenstående scener sekvensielt i én økt, stopper med forklaring ved feil). Folder inn: **G6** (vision-shot tas av øktens tilstand ETTER at handlingen faktisk utføres), **G19** (session-exec prøver locator-strategiene id→testid→aria→text→css før css-fallback), deler av **G7** (ekte utfall: exception → ok:false+error; klikk-rapport sendes umiddelbart siden navigasjon dreper utsatt rapport). GJENSTÅR: Playwright-banens storageState/auth, runtime-test i appen.*
  Opprinnelig funn: hvert `demo_auto_execute`/verify/shot åpnet NYTT WebviewWindow på base-URL (`demo_capture.rs:42,100,131-148,172`) — tilstand tapt per steg, self-heal mot feil side, innloggede produkter umulige.

### P1 — blokkerer robusthet

- [ ] **G5 · Validering = streng-sammenligning, aldri utfall** · validering · `demoStudioModel.ts:381-387`, `ScriptBuilderView.tsx:293` — `sceneActionMatch` er normalisert streng-likhet expected↔detected; fritekst `validationRule` maskin-evalueres ingen steder. `verifyOutcomeVision` finnes (`demoStudioAI.ts:152-165`) men er ikke koblet. Fiks: utfallsbasert sjekk (effekt/URL-endring) + koble vision-QA. **Est: M**
- [x] **G6 · Vision-verifisering ser feil tilstand** — *FIKSET 2026-07-03 via G4: `verifyCurrentAction` utfører nå handlingen for ekte i økt-vinduet og tar `sessionShot` av tilstanden ETTERPÅ før vision-vurdering.* · validering · `DemoStudioShell.tsx` (verifyCurrentAction)
- [ ] **G7 · Auto-inject rapporterer alltid suksess** · opptak · `demo_auto_inject.js:62-65,68` — handling som kaster gir likevel `ok:true, found:true` etter 900 ms; fast 1200 ms SPA-vent. Fiks: fang exception + effekt-sjekk. **Est: S/M**
- [x] **G8 · `continueMode='assisted'` + per-scene-modus er blindvei** — *FIKSET 2026-07-03: 'assisted' fjernet fra begge typene (aldri implementert), den døde per-scene-dropdownen i ScriptBuilder fjernet (feltet beholdt for lagrings-kompat), og shellens hardkodede «continueMode: manual»-tekst erstattet med en levende manual/auto-select bundet til prosjektet.* · opptak · `demoStudioModel.ts`, `ScriptBuilderView.tsx`, `DemoStudioShell.tsx`
- [x] **G9 · Claude-kall uten timeout/retry** — *DELVIS FIKSET 2026-07-03: `sendRaw` har nå 90 s timeout (konfigurerbar `timeoutMs`) m/ tydelig feilmelding + ett auto-retry på nettverksglipp/429/5xx; bruker-abort respekteres. GJENSTÅR: auto-retry på parse-feil i `demoStudioAI.ts:51-74` og hardkodet modell.* · generering · `claudeProxyService.ts:149-157`
- [ ] **G10 · Skann-timing: fast 1200 ms vent + 20 s frontend-timeout** · analyse · `demo_scan_inject.js:277,216-275`, `demoCaptureService.ts:55` — trege SPA-er gir tom/delvis katalog; frontend faller stille tilbake til rå-HTML mens skann-vinduet fortsatt jobber synlig. Fiks: DOM-stabilitet-poll + progress-event + dynamisk timeout + lukk vindu ved abort. **Est: S/M**
- [ ] **G11 · SPA-blank kontekst-fallback** · analyse · `demo_capture.rs:191-243` (reqwest rå-HTML), `demoStudioAI.ts:432-450` (CORS-blokkert i web) — klient-rendrede sider gir nær tom kontekst → AI skriver manus fra URL alene, stille. Fiks: bruk skann-vinduets `pageText` som primærkilde + «tynn kontekst»-flagg til bruker. **Est: S**
- [ ] **G12 · Cookie-/login-vegg skannes som produktet** · analyse · `demo_scan_inject.js` (hele) — er det en consent-banner/login-side, katalogiseres DEN; oppdages først i video-QA (`demoStudioAI.ts:182`). Fiks: vegg-deteksjon før skann fullfører + «logg inn, så skanner jeg»-pause. **Est: M**
- [x] **G13 · Overlays sendes men droppes i video-render** — *FIKSET 2026-07-03: `MockupConfig` har nå `overlays: ClipOverlay[]`, og draw-loopen i Chromium tegner cursor (glir inn 600 ms), ripple (1,4 s loop), tap-ring og pulserende spotlight-highlight oppå videoen — samme visuelle språk som preview-ens `SceneInteractionOverlay`, klippet til skjerm-flaten. Hotspot mappes viewport-brøk → canvas med samme statusCrop/zoom/fitRect-matte som videoen tegnes med. «(kommer)»-teksten i ExportView er fjernet. Visuell runtime-test gjenstår (krever Playwright i repo-rot).* · eksport · `mockup-polish-pro.mts` (drawClipOverlays), `ExportView.tsx`
- [x] **G14 · Guide: iframe-fallback + `startScrollPct` ignorert + hotspots i viewport-%** — *I HOVEDSAK FIKSET 2026-07-03: hvert steg bruker nå scenens thumbnail ELLER scan-shotet for scenens scroll-posisjon (`pickShot(scanShots, startScrollPct)`) som statisk steg-bilde → hotspots forankres eksakt (ingen scroll-drift), frame-blokkerte sider gir ikke svart boks, og `startScrollPct` konsumeres. Desktop-steg matcher skjerm-høyden til bildets forhold så hotspot-% treffer presist. Live-iframe er kun siste utvei og merkes ærlig («kan være blokkert av nettstedet»). Smoke-testet i Node (riktig shot per scroll + gyldig inline-JS). GJENSTÅR (L): ekte DOM-snapshot-guide.* · eksport · `demoStudioExports.ts` (buildInteractiveGuideHtml)
- [x] **G15 · Ett-prosjekt-fellen** — *FIKSET 2026-07-03: `listStoredProjects()`/`deleteStoredProject()` i modellen + `openProject()` i storen (peker `last` uten å bumpe updatedAt) + «Tidligere demoer»-liste i Create-viewet med Åpne/Slett (slett rydder kvote — adresserer G1-lekkasjen). «Lag ny video»-bekreftelsen sier nå ærlig at den gamle blir liggende i lista.* · alle · `demoStudioModel.ts`, `demoStudioStore.ts`, `DemoStudioShell.tsx` (CreateDemoView)
- [ ] **G16 · Ingen sky-prosjekt/delbar demo/samarbeid** · deling · `demoStudioStore.ts:6`; `role-room-demo-assets-routes.ts:35-104` lagrer kun Marketing-artefakter — `DemoProject` (scener, manus, hotspots, opptak) finnes kun i localStorage på én maskin. Fiks: sky-prosjektmodell. **Est: L**
- [x] **G17 · Blank iframe-preview uten feilmelding** — *FIKSET 2026-07-03: shellen sjekker `checkUrlEmbeddable` på prosjekt-URL; blokkert side uten scanShots gir gult banner med forklaring + «Hent forhåndsvisning»-knapp (Playwright-shots m/ scan-fallback).* · preview · `DemoStudioShell.tsx` (embedBlocked/fetchShotsNow)
- [x] **G18 · URL-bytte invaliderer ikke avledet state** — *FIKSET 2026-07-03: `handleUrlCommitted` på topbarens blur sammenligner host mot sist committede; host-bytte nullstiller understanding/generated/scanShots. Kalles ved commit (blur), ikke per tastetrykk, så halvskrevne hosts ikke nuker shots.* · alle · `DemoStudioShell.tsx` (handleUrlCommitted)
- [x] **G19 · Multi-locators samles men replay bruker kun skjør cssPath** — *FIKSET 2026-07-03 via G4: `sessionExec` sender scenens `targetLocators` og `demo_session_inject.js` prøver strategiene i prioritert rekkefølge (id → testid → aria → text → css) før css-fallback. Legacy `demo_auto_execute` (engangs-vindu) er uendret — brukes ikke lenger av shellen.* · opptak/validering · `demo_session_inject.js` (findTarget), `DemoStudioShell.tsx`
- [ ] **G20 · Vision-skjermbilde matcher ikke scenen** · manus · `ScriptBuilderView.tsx:112,124,365` — `captureScreenshot(project.url)` tar alltid forsidens topp; scene på `/pricing` m/ scroll får forside-bildet. Fiks: shot m/ scenens URL + scroll-param. **Est: M**
- [x] **G21 · Native opptak gir null UI-feedback** — *FIKSET 2026-07-03: `nativeBusy`-state settes rundt `recordNativeScene` og inngår i `recording`-indikatoren, så «Recording»-badgen vises under hele det blokkende native-opptaket (inkl. auto-startet neste scene). Samtidig fikset duration-stale-buggen (P2): varigheten leses nå ferskt fra storen for scenen som faktisk tas opp.* · opptak · `GuidedRecorderView.tsx`
- [ ] **G22 · To recorder-UIer med ulik funksjonalitet** · opptak/validering · `DemoStudioShell.tsx:831-832` vs `:1443-1471` — dedikert Guided Recorder mangler Verifiser/Kjør automatisk; validering er usynlig i hoved-opptaksflyten. Fiks: konsolider til én recorder. **Est: M**
- [ ] **G23 · Ingen PII-sladding i shots/guider/vision-kall** · output-tillit · ingen redact/mask-treff i demo-studio/AI (verifisert grep) — skjermbilder går usladdet til Claude vision og inn i publiserte guider. Fiks: deteksjon + blur-pass. **Est: L**

### P2 — polish

**Dekorative blindveier:**
- [ ] «Lagrede maler ›» statisk tekst (`DemoStudioShell.tsx:1264`)
- [ ] Stat-kortenes «Endre →» / «Eksport →» uten onClick (`DemoStudioShell.tsx:1569-1573, 2102-2111`)
- [ ] Søk «⌘K», prosjekt-dropdown, tilbake-pil, «⋮» i ScriptBuilder (`ScriptBuilderView.tsx:193-198,221,438`)
- [ ] Guide/Script/Notes-faner hardkodet aktiv `i === 0`, ingen onClick (`GuidedRecorderView.tsx:416-418`)
- [ ] «✦ Flere versjoner» / AI Export Assistant — fire døde «(kommer)»-kort (`ExportView.tsx:515-530`)
- [ ] `CaptureChooser.tsx` foreldreløs utenfor `?test=demo`-harness — slett eller koble

**Funksjonelle P2:**
- [ ] Audience-select viser ikke adoptert fritekst-verdi (`ScriptBuilderView.tsx:244-246` vs `DemoStudioShell.tsx:671`); default «Healthcare Professionals» er mockup-rest (`:70`)
- [ ] Variant-feil svelges stille (`demoStudioAI.ts:1349-1351`)
- [ ] SRT times fra `scene.duration`, ikke faktiske klipp → drift mot montert video (`demoStudioExports.ts:355-369`)
- [ ] Hele videoen rammes som `scenes[0].device` — multi-device får feil ramme (`ExportView.tsx:299,162-164`)
- [ ] 9:16 → prores4444 `.mov` er rart leveranseformat for Reels/Shorts (`ExportView.tsx:308`)
- [ ] «PDF» = print-dialog, ikke fil (`demo_export.rs:33-49`)
- [ ] Embeddable-sjekk er fail-open, sjekker ikke meta-CSP (`demo_recording.rs:122-159`)
- [ ] Duration-stale: neste scenes native opptak bruker forrige scenes varighet (`GuidedRecorderView.tsx:131,242`)
- [ ] Verify når bare forsiden — klikk preventDefault-es (`demo_verify_inject.js:76-77`)
- [ ] Learned-targets GET er uautentisert — alle kan lese alle delte selectors per host (`post-agent-anthropic-routes.ts:1265`) — bevisst «kollektiv læring»? Bør besluttes
- [ ] `loadExisting` feiler stille ved korrupt JSON (`demoStudioModel.ts:1261-1268`); undo/redo kun i minne (`demoStudioStore.ts:78-79`)
- [ ] Ingen UA-emulering i web-device-rammer (`FramedDevice.tsx:19-21,92-97`)
- [ ] Render krever `node_modules/.bin/tsx` i repo-rot (`mockup_render.rs:44-53`) — feiler når node_modules mangler (god feilmelding finnes)

---

## 3. Robusthets-vurdering (rangert)

1. 🎯 **Ett vedvarende capture-vindu med sesjon (G4)** — **høyest gjennomslag.** Én arkitektur-endring løser fire ting samtidig: flerstegs auto-kjøring, innloggede produkter, vision-verifisering av *faktisk* tilstand (G6), og self-heal mot riktig side. Uten dette er hele auto/verify-løftet begrenset til enkle offentlige forsider.
2. **Ærlig og holdbar lagring (G1+G15+G16)** — i dag kan en kunde miste alt arbeid uten varsel, og aldri gjenåpne forrige demo.
3. **Utfallsbasert verifisering (G5+G7+G19)** — «verifisert» må bety at handlingen faktisk skjedde. Byggeklossene finnes (multi-locators, vision-QA, lærte korreksjoner) — de er bare ikke koblet i guided-banen.
4. **Lever voiceover-løftet i guided eksport (G2)** — narration er kjerneverdien i manuset; videoen som leveres er stille. TTS-mux finnes ferdig i autonom-banen.
5. **Konsolider de to banene (G13+G22)** — nesten all robusthet (TTS, polish, self-heal, cross-origin) ligger i autonom/Playwright-banen; guided-banen bør konsumere samme motor.
6. **Analyse-robusthet (G10+G11+G12)** — SPA-readiness, ærlig timeout og vegg-deteksjon avgjør om «lim inn URL»-førsteinntrykket treffer.
7. **Guide-integritet (G14)** — DOM-forankrede hotspots + snapshot-fallback; i dag kan den delte guiden vise svart boks eller feilplasserte hotspots hos mottakeren.
8. **Tillits-laget (G23 + fasade-opprydding)** — PII-sladding og at hvert UI-element enten virker eller er tydelig merket.

## 4. Quick wins vs fundament

**Quick wins (låser opp happy-path, S–M):**
G3 stale-closure-fiks (S) · G9 timeout+retry (S) · G1 ærlig save-status (S→M) · G2 TTS-mux ved gjenbruk av autonom-banen (M) · G8 assisted-opprydding (S) · G17 frame-blokk-hint (S) · G18 URL-invalidering (S) · G11 pageText-som-kontekst (S) · G21 rec-state (S) · G19 locator-liste til auto-script (M)

**Fundament (må bygges, M–L):**
G4 persistent capture-vindu + auth/storageState (M/L, forutsetning for G5/G6) · G16+G15 sky-prosjektmodell + prosjektliste (L) · G5 utfallsbasert verifisering (M) · G14 DOM-snapshot-guide (M/L) · G13 overlay-burn-in (M) · G23 PII-sladding (L)

## 5. Kryssjekk mot PRODUCT-IMPROVEMENTS.md (2026-06-06)

Notatet er ~3 uker utdatert. **Gjort siden:** TTS (gap 8), ekte thumbnails (9), hosted delbar guide-lenke m/ view-stats (deler av 1+4), self-heal + lærende locators i Playwright-replay (deler av 5), cross-origin auto via Playwright (7), `startScrollPct` i render/recorder (deler av 16), undo/multi-select/drag (18). **Fortsatt åpne:** validering (2), DOM-snapshot-guide (3), persistent sesjon/innlogget capture (6), embed SDK (11), SPA-kontekst (12), samarbeid (14), lead-gate (15), PII (17), «Flere versjoner»-mockup (19). Strukturelt hovedpoeng notatet ikke fanger: all ny robusthet havnet i den autonome banen.

## 6. Usikkert / må testes live

- Om Tauri-WebviewWindows deler cookie-jar (påvirker G4-omfanget: login i capture-vindu → gjelder skann/auto-vinduene?)
- Faktisk skann-tid vs 20 s-timeouten på tunge sider
- G3-oppførselen i runtime (koden er entydig, men verifiser)
- `learned.json`-persistens mellom Playwright-kjøringer
- Hvordan React rendrer audience-select med ukjent value (antatt blank)
