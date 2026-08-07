# StageOne fase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lights-konsoll og Cameras-multicam-switcher som ekte skjermer på fase 1-fundamentet.

**Architecture:** Samme `SceneDocument` + `StageRenderer`; nye views. `CameraTileView` (gestless MTKView per kamera-node) er den ene nye render-brikken.

**Tech Stack:** Som fase 1. Gren: `feat/stageone-fase2` fra `feat/stageone`.

## Global Constraints

Som fase 1-planen (Swift 6 strict, iOS 17, sim «iPad Pro 13-inch (M5)», full xcodebuild-verifisering, eksplisitt staging).

---

### Task 1: Modell — camera role + LightPresets (+ tester)

**Files:** Modify `Model/SceneData.swift` (CameraParams.role), `Model/DefaultScene.swift` (roller); Create `Model/LightPresets.swift`; Test `StageOneTests/LightPresetTests.swift`

**Interfaces:**
```swift
struct CameraParams { ...; var role: String? = nil }  // optional → bakoverkompatibel decode
struct LightPreset: Identifiable, Sendable {
    var id: String; var name: String; var summary: String  // "85 · 45 · 60"
    var key: (intensity: Double, tempK: Double?); var fill: (Double, Double?); var back: (Double, Double?)
}
enum LightPresets {
    static let all: [LightPreset]  // Interview 3-Point / Moody Single Key / Broadcast Flat / Golden Hour (verdier fra prototypen)
    @MainActor static func apply(_ preset: LightPreset, to doc: SceneDocument)  // én mutate() → én undo
}
```
Tester: apply setter intensitet/temp på key/fill/back + én undo ruller alt tilbake; `CameraParams`-JSON UTEN role dekoder OK; DefaultScene har roller.

- [ ] Failing tester → impl → grønt → commit `feat(stageone): lys-presets + kamera-roller`

### Task 2: CameraTileView

**Files:** Create `UI/CameraTileView.swift`

**Interfaces:**
```swift
struct CameraTileView: UIViewRepresentable {  // gestless live-tile
    let document: SceneDocument
    let renderer: StageRenderer
    let cameraNodeId: String
    var fps: Int = 30
}
```
Delegate henter kamera-noden per frame (`RenderCamera.from`), hopper over render om noden mangler (tile viser clear-farge). Verifisering: build.

- [ ] Impl → build → commit `feat(stageone): CameraTileView (delt renderer, gestless)`

### Task 3: Lights-skjermen

**Files:** Create `UI/LightsScreen.swift`; Modify `App/StageOneApp.swift` (mode .lights → LightsScreen)

Innhold per spec: rig-liste, presets, add-light (Spot/Area), viewport (ViewportView m/ tool fast .move), mixer-strips (switch + Intensity + Temp m/ gradientspor — gjenbruk ValueChipSlider; gradient via bakgrunn på sporet i egen TempSlider-variant), detalj (Beam/Shadows/quality).
Add light:
```swift
let id = "light-\(UUID().uuidString.prefix(8).lowercased())"
doc.mutate { $0.nodes.append(Node(id: id, name: name, kind: .light, enabled: true,
    transform: Transform(position: [0,3,2], rotationEulerDeg: [-40,0,0], scale: .one),
    params: .light(LightParams(type: type, intensity: 60, temperatureK: 5600, beamDeg: 50, castsShadows: false, quality: "Medium"))))
    if let i = $0.groups.firstIndex(where: { $0.id == "lights" }) { $0.groups[i].childIds.append(id) } }
```

- [ ] Impl → build → sim-screenshot → commit `feat(stageone): Lights-skjermen`

### Task 4: Cameras-skjermen + switcher-logikk

**Files:** Create `Model/Switcher.swift`, `UI/CamerasScreen.swift`; Modify `App/StageOneApp.swift`; Test `StageOneTests/SwitcherTests.swift`

**Interfaces:**
```swift
@Observable @MainActor final class Switcher {
    var programId: String?
    var previewId: String?
    var isAutoTransitioning = false
    var autoProgress: Double = 0
    func ensureValid(in scene: SceneData)   // init/oppdater til første kameraer
    func cut()                               // swap program/preview
    func auto(duration: Double = 0.8)        // driver autoProgress 0→1, så cut()
    func setPreview(_ id: String)
}
```
Tester: ensureValid velger to første kameraer; cut swapper; setPreview på program-id = no-op eller swap-fritt sett; auto ender i swap + isAutoTransitioning false (async test m/ kort duration).
UI per spec: liste m/ PGM/PVW-badges, program/preview-tiles (CameraTileView 60fps, rød/grønn ramme, ON AIR/NEXT), multicam-strip (30fps, tap = setPreview), CUT/AUTO-knapper (AUTO: ZStack program+preview-tile m/ opacity = autoProgress), lens-readout, detalj-panel (Focal/ISO-sliders, Aperture/Shutter SegmentPicker, DOF-toggle).

- [ ] Failing Switcher-tester → impl → grønt → UI → build → sim-screenshot → commit `feat(stageone): Cameras multicam-switcher`

### Task 5: Sluttverifisering fase 2

- [ ] Full suite + begge skjermer screenshotted i landscape + Studio-kryssjekk (lysendring i Lights synes i Studio) → ev. fikser → commit → push → PR (mot feat/stageone eller main, spør)
