# StageOne fase 2 — Lights + Cameras

**Dato:** 2026-08-07. Bygger på fase 1 (`2026-08-07-stageone-fase1-design.md`, PR #1942).
Kilder: `virtual-studio-lights.html` + `virtual-studio-cameras.html` i prototypemappen.

## Prinsipp

Begge skjermer er nye views på samme `SceneDocument` + samme `StageRenderer` —
ingen ny scene-tilstand utover UI-sesjonsvalg (valgt lys, program/preview-kamera).
Endringer her synes umiddelbart i Studio (og omvendt).

## Lights-skjermen

- **Venstre panel (264px):** «Rig» = liste over scenens lys-noder (ikon, navn,
  type · intensitet%); valgt = accent. «Presets» = 4 stk fra prototypen
  (Interview 3-Point, Moody Single Key, Broadcast Flat, Golden Hour) — setter
  intensitet + temperatur på key/fill/back-light i ÉN mutasjon (én undo).
  «Add light»: Spot / Area — legger til ekte lys-node (prototypen toastet;
  vi har ekte motor). Nye lys posisjoneres [0, 3, 2], navngis «Spot Light N».
- **Midten:** live `ViewportView` (delt renderer; move-verktøy = draggbare
  fixtures) over en **mixer**: én strip per lys — on/off-switch, Intensity
  0–100%, Temperature 2700–7500K (slider m/ varm→kald-gradientspor).
  Tap på strip = velg lys (deles med `SceneDocument.selectedNodeId`).
- **Detalj (valgt lys):** Beam 10–120°, Shadows-toggle, quality-segmenter —
  gjenbruker fase 1-kontrollene (ValueChipSlider/SegmentPicker, transient undo).

## Cameras-skjermen

- **Venstre panel:** kameraliste (navn, focal mm · rolle, PGM/PVW-badge) +
  «Add camera» (ekte kamera-node, 35mm, posisjon [0, 1.5, 4.5], navn «Camera N»).
- **Midten:** **Program**-tile (stor, live, rød ramme + «ON AIR») og
  **Preview**-tile (grønn ramme, «NEXT») side om side; under: multicam-strip
  med én live-tile per kamera-node (tap = sett som preview). **CUT** bytter
  program↔preview øyeblikkelig; **AUTO** krysstoner (~0.8s, to lag m/
  opacity-animasjon) og bytter så. Lens-readout (focal · aperture · ISO ·
  shutter) under program-tilen.
- **Detalj (valgt kamera):** Focal 14–135mm, ISO 100–3200 (step 100),
  Aperture-velger (f/1.4–f/5.6), Shutter-velger (1/25–1/200), DOF-toggle.
- Program/preview er **sesjonstilstand** (ikke persistert).

## Teknisk

- `CameraTileView`: `UIViewRepresentable` MTKView uten gester som rendrer
  scenen fra en gitt kamera-node via delt `StageRenderer`; `fps`-parameter
  (store tiles 60, strip-tiles 30). Gjenbrukes av fase 3-preview.
- `CameraParams` får `role: String?` (optional → gamle lagrede JSON-scener
  dekoder fortsatt). DefaultScene setter rollene fra prototypen
  (Wide master / Cross on host / Cross on guest).
- `LightPresets`: statisk tabell + `apply(_:to:)` som muterer key/fill/back
  via id-oppslag; mangler en av dem → hopper over (ingen krasj).

## Testing

- Preset-apply (verdier + én undo), role-dekoding bakoverkompatibel
  (JSON uten role dekoder), add-light/add-camera-mutasjoner, CUT/AUTO-tilstands-
  logikk (program/preview-swap) som ren funksjon/observable-test.
- Full `xcodebuild test` + sim-screenshots av begge skjermer.

## Ikke i fase 2

Point/Directional-lystyper (kun UI-valg Spot/Area), DOF-rendering, AUTO med
wipe-varianter, persistert program-valg, Export-funksjon (fase 3).
