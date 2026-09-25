# StageOne — Virtual Studio, fase 1 (fundament + Studio-skjerm)

**Dato:** 2026-08-07
**Kilde:** HTML-prototype i `The role room ipad  virtual studio/` (Claude Design-bundle) + `brand-spec.md`
**Status:** Godkjent design, fase 1 av 6

## Bakgrunn

StageOne er en virtual-studio-produksjonsapp for iPad (landscape, mørk pro-tool-chrome).
Prototypen har fire skjermer: Studio (3D-editor), Lights (lyskonsoll), Cameras
(multicam-switcher), Export (leveranse). Alt skal bygges native. Full faseplan:

1. **Fundament + Studio-skjerm (denne specen)**
2. Lights + Cameras
3. Export (offscreen render → video/PNG)
4. Role Room-auth + sky-lagring av scener (backend-ruter + klient)
5. AI-assistent (backend-Claude → scene-diff)
6. AR-preview + RoomPlan-skann

Beslutninger tatt i brainstorm: custom **Metal**-renderer (ikke SceneKit/RealityKit) —
multicam-tiles og eksport er «render scenen N ganger til teksturer», og volumetriske
lysstråler krever custom shaders uansett. Navn **StageOne**, bundle
`com.creatorhubn.StageOne`.

## 1. Prosjektoppsett

- `ipad/StageOne/` med xcodegen `project.yml` etter CaptureApp-malen:
  Swift 6, `SWIFT_STRICT_CONCURRENCY: complete`, iOS 17 deployment target,
  team `9TAUZCPK95`, `CODE_SIGN_STYLE: Automatic`, apple-generic versioning.
- iPad-only (`TARGETED_DEVICE_FAMILY: 2`), landscape-orienteringer only.
- Ingen tredjeparts pakker.
- Targets: `StageOne` (app) + `StageOneTests` (unit).

## 2. Scenemodell

`SceneDocument` — Codable + `@Observable`, én delt instans alle skjermer leser/muterer.

```
SceneDocument
├─ nodes: [Node]
│    Node: id, name, kind (.light/.camera/.talent/.prop), enabled,
│          transform (position/rotationEuler/scale, SIMD3<Float>),
│          params (enum med assosierte verdier per kind):
│            .light(LightParams: type spot|area, intensity 0–100, tempK,
│                   beamDeg, castsShadows, quality)
│            .camera(CameraParams: focalMm, aperture, iso, shutter, dofEnabled)
│            .talent(TalentParams: seat, eyeline, marker)
│            .prop(PropParams: material, shape (box|plane|cylinder|capsule|stage))
├─ groups: [Group] (id, name, childIds) — speiler prototypens hierarki-tre
├─ environment: String (preset-id, f.eks. "mountain-dusk")
└─ shots: [Shot] (id, cameraNodeId, durationSec)
```

- Standardscene = prototypens: 3 lys (key/fill/back), 3 kameraer (35/50/85 mm),
  host+guest, stoler, bord, gulv, LED-vegg, stage, bakgrunn.
- Persistens: JSON-fil i Documents (`<sceneId>.stageone.json`). Autosave ved endring
  (debounced). Fase 4 syncer samme JSON til sky.
- Undo: `UndoManager` — hver mutasjon registrerer invers.

## 3. Metal-renderer

`StageRenderer` (klasse, eier `MTLDevice`/kø/pipelines):

- **Forward-pass**, én frame-uniform-buffer (kamera + opptil 8 lys).
- **Geometri:** genererte primitiver (boks, plan, sylinder, kapsel-person,
  avrundet stage-sylinder) — stilisert look som prototypen. Ingen asset-import i fase 1.
- **Shading:** Blinn-Phong + enkel tone-map («PBR-lite»), lys-temp → RGB via
  Kelvin-approksimasjon. Skyggekart (depth) kun for key light i fase 1.
- **Beams:** volumetrisk kjegle per spot-lys — additiv blending, avstands-falloff
  i fragment-shader. Diegetisk glød per brand-spec (UI-chrome flat).
- **Hjelpegrafikk:** gulv-grid, selection-outline (accent), gizmo-linjer for
  move/rotate/scale, kamera-frustum- og lys-ikoner i 3D.
- **Render-til-tekstur** fra vilkårlig kamera-node — API-et fase 2 (multicam-tiles)
  og fase 3 (eksport) gjenbruker.
- **View:** `MTKView` i `UIViewRepresentable`. Gester: én-finger orbit, to-finger pan,
  pinch zoom, tap = picking (ray mot bounding-boxes), drag på valgt node m/ aktivt
  verktøy = transformasjon.

## 4. Studio-UI (SwiftUI)

Brand-spec-tokens som Swift-konstanter (OKLch → sRGB forhåndskonvertert).

- **Layout:** 264px hierarki-panel · fluid viewport · 280px inspector.
  Hairline-borders, radii 8–12, accent kun funksjonelt.
- **Toolbar (topp):** app-navn, undo/redo, mode-tabs (Studio/Lights/Cameras/Export —
  de tre siste ruter til stub-skjermer i fase 1), søk, «+».
- **Hierarki:** gruppert tre fra `groups`, rad = ikon + navn + øye-toggle (enabled).
  Valgt rad = accent. Assets-seksjon + Scan Room-kort vises inaktive («kommer»).
- **Inspector:** transform-seksjon (pos/rot/scale, numeriske felt) + kind-spesifikk
  seksjon (sliders m/ verdichips i mono-font, toggles, segmenterte valg) — felter
  identiske med prototypens params.
- **Viewport-overlays:** view-cube-snarveier (Front/Top/Left/…, animert kamera-tween),
  verktøypille (select/move/rotate/scale), AI-assistent- og AR-kort som inaktive
  plasser.
- **Transport + shot-strip (bunn):** play/pause (Space på hardware-keyboard),
  tidskode (mono), shot-kort per `Shot` — play tweener viewport-kamera gjennom
  shot-sekvensen.

## 5. Testing og verifisering

- Unit: Codable-roundtrip av `SceneDocument`, mutasjon+undo, shot-sekvens-logikk,
  Kelvin→RGB.
- Renderer-røyktest: offscreen render av standardscenen 1 frame → ikke-blank
  (variasjon i piksler), kjørbar i sim.
- Verifisering: full `xcodebuild build` + `test` mot iPad-simulator — aldri bare
  grep/type-sjekk av delfiler.

## Ikke i fase 1 (eksplisitt)

Lights/Cameras/Export-funksjonalitet (stubs only), sky/auth, AI, AR, RoomPlan,
asset-import, materialbibliotek, flere skyggekast enn key light, DOF-rendering
(param lagres, effekt kommer senere).
