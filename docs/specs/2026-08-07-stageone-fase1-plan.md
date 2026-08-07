# StageOne fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Native iPad-app `StageOne` med Metal-rendret Studio-skjerm (viewport + hierarki + inspector + transport/shots) fra HTML-prototypen.

**Architecture:** Ett delt `@Observable SceneDocument` (Codable JSON) som alle skjermer leser; én `StageRenderer` (custom Metal forward-pass) som rendrer scenen fra vilkårlig kamera til drawable eller tekstur; SwiftUI-chrome rundt en `MTKView`.

**Tech Stack:** Swift 6 (strict concurrency complete), SwiftUI, Metal/MetalKit, XCTest, xcodegen. Ingen tredjeparts pakker.

## Global Constraints

- Sti: `ipad/StageOne/` — mal: `ipad/CaptureApp/project.yml`
- `SWIFT_VERSION: "6"`, `SWIFT_STRICT_CONCURRENCY: complete`
- Deployment target iOS **17.0**, `DEVELOPMENT_TEAM: "9TAUZCPK95"`, `CODE_SIGN_STYLE: Automatic`
- Bundle: `com.creatorhubn.StageOne`. iPad-only (`TARGETED_DEVICE_FAMILY: 2`), kun landscape.
- Ingen tredjeparts avhengigheter.
- Verifisering = full `xcodebuild` mot iPad-simulator (aldri bare grep/delvis typesjekk).
- Sim-destinasjon i alle kommandoer: `-destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)'` (fall tilbake til første tilgjengelige iPad i `xcrun simctl list devices available`).
- Alle commits på gren `feat/stageone`. Stage alltid EKSPLISITTE filer (aldri `git add -A`).

---

### Task 1: Prosjekt-skaffold (xcodegen + tom app som bygger)

**Files:**
- Create: `ipad/StageOne/project.yml`
- Create: `ipad/StageOne/StageOne/App/StageOneApp.swift`
- Create: `ipad/StageOne/StageOneTests/SmokeTests.swift`

**Interfaces:**
- Produces: byggbart Xcode-prosjekt `StageOne.xcodeproj` med targets `StageOne` + `StageOneTests`; app-entry `StageOneApp` som viser `RootView()` (placeholder `Text` inntil Task 9).

- [ ] **Step 1: Skriv `project.yml`**

```yaml
name: StageOne
options:
  bundleIdPrefix: com.creatorhubn
  deploymentTarget:
    iOS: "17.0"
  createIntermediateGroups: true
  developmentLanguage: en

settings:
  base:
    SWIFT_VERSION: "6"
    SWIFT_STRICT_CONCURRENCY: complete
    CODE_SIGN_STYLE: Automatic
    DEVELOPMENT_TEAM: "9TAUZCPK95"
    ENABLE_USER_SCRIPT_SANDBOXING: YES
    VERSIONING_SYSTEM: apple-generic
    CURRENT_PROJECT_VERSION: "1"
    MARKETING_VERSION: "0.1.0"

targets:
  StageOne:
    type: application
    platform: iOS
    sources:
      - path: StageOne
    settings:
      base:
        TARGETED_DEVICE_FAMILY: "2"
        PRODUCT_BUNDLE_IDENTIFIER: com.creatorhubn.StageOne
    info:
      path: StageOne/Generated/Info.plist
      properties:
        CFBundleShortVersionString: $(MARKETING_VERSION)
        CFBundleVersion: $(CURRENT_PROJECT_VERSION)
        CFBundleDisplayName: StageOne
        CFBundleName: StageOne
        UILaunchScreen: {}
        UIRequiredDeviceCapabilities: [arm64]
        UISupportedInterfaceOrientations:
          - UIInterfaceOrientationLandscapeLeft
          - UIInterfaceOrientationLandscapeRight
        UIRequiresFullScreen: true

  StageOneTests:
    type: bundle.unit-test
    platform: iOS
    sources:
      - path: StageOneTests
    dependencies:
      - target: StageOne
```

- [ ] **Step 2: Skriv app-entry**

```swift
// StageOne/App/StageOneApp.swift
import SwiftUI

@main
struct StageOneApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

struct RootView: View {
    var body: some View {
        Text("StageOne")
    }
}
```

- [ ] **Step 3: Skriv røyktest**

```swift
// StageOneTests/SmokeTests.swift
import XCTest
@testable import StageOne

final class SmokeTests: XCTestCase {
    func testAppModuleLoads() {
        XCTAssertTrue(true)
    }
}
```

- [ ] **Step 4: Generer og bygg**

Run:
```bash
cd ipad/StageOne && xcodegen generate
xcodebuild -project StageOne.xcodeproj -scheme StageOne -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)' build
```
Expected: `BUILD SUCCEEDED`

- [ ] **Step 5: Commit**

```bash
git add ipad/StageOne/project.yml ipad/StageOne/StageOne ipad/StageOne/StageOneTests ipad/StageOne/StageOne.xcodeproj
git commit -m "feat(stageone): prosjekt-skaffold — xcodegen, Swift 6, iPad landscape"
```
(Sjekk først om `*.xcodeproj` er gitignored — CaptureApp committer sin; følg samme praksis.)

---

### Task 2: Brand-tokens (Theme)

**Files:**
- Create: `ipad/StageOne/StageOne/UI/Theme.swift`

**Interfaces:**
- Produces: `enum Theme` med statiske `Color`/`Font`-konstanter brukt av all UI:
  `Theme.bg`, `Theme.surface`, `Theme.raise`, `Theme.fg`, `Theme.muted`, `Theme.border`, `Theme.accent` (Color); `Theme.mono(_ size: CGFloat) -> Font`; `Theme.hairline: CGFloat = 1`.

- [ ] **Step 1: Implementer (OKLch fra brand-spec forhåndskonvertert til sRGB)**

```swift
// StageOne/UI/Theme.swift
import SwiftUI

enum Theme {
    // OKLch fra brand-spec.md konvertert til sRGB (D65)
    static let bg      = Color(red: 0.075, green: 0.066, blue: 0.098) // oklch(0.16 0.012 295)
    static let surface = Color(red: 0.108, green: 0.098, blue: 0.135) // oklch(0.20 0.015 292)
    static let raise   = Color(red: 0.157, green: 0.145, blue: 0.192) // oklch(0.25 0.018 292)
    static let fg      = Color(red: 0.925, green: 0.918, blue: 0.945) // oklch(0.95 0.006 290)
    static let muted   = Color(red: 0.545, green: 0.525, blue: 0.600) // oklch(0.65 0.02 288)
    static let border  = Color.white.opacity(0.09)
    static let accent  = Color(red: 0.545, green: 0.360, blue: 0.965) // oklch(0.60 0.21 295)
    static let hairline: CGFloat = 1
    static func mono(_ size: CGFloat) -> Font { .system(size: size, design: .monospaced) }
}
```
(Verifiser konverteringene med et raskt script — `python3 -c` med colour-math eller kjent OKLch→sRGB-formel — juster verdiene til det scriptet gir. Nøyaktighet > disse eksempeltallene.)

- [ ] **Step 2: Bygg**

Run: samme `xcodebuild build` som Task 1. Expected: `BUILD SUCCEEDED`

- [ ] **Step 3: Commit**

```bash
git add ipad/StageOne/StageOne/UI/Theme.swift
git commit -m "feat(stageone): brand-tokens fra brand-spec (OKLch→sRGB)"
```

---

### Task 3: Scenemodell + default-scene + undo

**Files:**
- Create: `ipad/StageOne/StageOne/Model/SceneData.swift`
- Create: `ipad/StageOne/StageOne/Model/SceneDocument.swift`
- Create: `ipad/StageOne/StageOne/Model/DefaultScene.swift`
- Test: `ipad/StageOne/StageOneTests/SceneModelTests.swift`

**Interfaces:**
- Produces (eksakte typer, brukes av ALLE senere tasks):

```swift
enum NodeKind: String, Codable, Sendable { case light, camera, talent, prop }

struct Transform: Codable, Equatable, Sendable {
    var position: SIMD3<Float>
    var rotationEulerDeg: SIMD3<Float> // grader, som prototypen
    var scale: SIMD3<Float>
    static let identity = Transform(position: .zero, rotationEulerDeg: .zero, scale: .one)
}

enum LightType: String, Codable, Sendable, CaseIterable { case spot, area }
struct LightParams: Codable, Equatable, Sendable {
    var type: LightType; var intensity: Double; var temperatureK: Double
    var beamDeg: Double; var castsShadows: Bool; var quality: String
}
struct CameraParams: Codable, Equatable, Sendable {
    var focalMm: Double; var aperture: String; var iso: Int
    var shutter: String; var dofEnabled: Bool
}
struct TalentParams: Codable, Equatable, Sendable { var seat: String; var eyeline: Bool; var marker: String }
enum PropShape: String, Codable, Sendable { case box, plane, cylinder, capsule, stage }
struct PropParams: Codable, Equatable, Sendable { var material: String; var shape: PropShape }

enum NodeParams: Codable, Equatable, Sendable {
    case light(LightParams), camera(CameraParams), talent(TalentParams), prop(PropParams)
}

struct Node: Codable, Equatable, Identifiable, Sendable {
    var id: String; var name: String; var kind: NodeKind; var enabled: Bool
    var transform: Transform; var params: NodeParams
}
struct Group: Codable, Equatable, Identifiable, Sendable { var id: String; var name: String; var childIds: [String] }
struct Shot: Codable, Equatable, Identifiable, Sendable { var id: String; var cameraNodeId: String; var durationSec: Double }

struct SceneData: Codable, Equatable, Sendable {
    var nodes: [Node]; var groups: [Group]; var environment: String; var shots: [Shot]
    func node(_ id: String) -> Node?
}

@Observable @MainActor final class SceneDocument {
    var data: SceneData
    var selectedNodeId: String?
    let undoManager = UndoManager()
    init(data: SceneData)
    /// All mutasjon går her — registrerer helhets-snapshot for undo.
    func mutate(_ change: (inout SceneData) -> Void)
    func updateNode(_ id: String, _ change: (inout Node) -> Void)
}

enum DefaultScene { static func make() -> SceneData } // prototypens 15 noder + 5 shots
```

- [ ] **Step 1: Skriv failing tests**

```swift
// StageOneTests/SceneModelTests.swift
import XCTest
@testable import StageOne

final class SceneModelTests: XCTestCase {
    func testCodableRoundtrip() throws {
        let scene = DefaultScene.make()
        let data = try JSONEncoder().encode(scene)
        let back = try JSONDecoder().decode(SceneData.self, from: data)
        XCTAssertEqual(scene, back)
    }

    func testDefaultSceneContents() {
        let s = DefaultScene.make()
        XCTAssertEqual(s.nodes.filter { $0.kind == .light }.count, 3)
        XCTAssertEqual(s.nodes.filter { $0.kind == .camera }.count, 3)
        XCTAssertEqual(s.nodes.filter { $0.kind == .talent }.count, 2)
        XCTAssertNotNil(s.node("key-light"))
        XCTAssertEqual(s.shots.count, 5)
        // hver shot peker på eksisterende kamera
        for shot in s.shots { XCTAssertEqual(s.node(shot.cameraNodeId)?.kind, .camera) }
        // grupper refererer kun eksisterende noder
        for g in s.groups { for c in g.childIds { XCTAssertNotNil(s.node(c)) } }
    }

    @MainActor func testMutateRegistersUndo() {
        let doc = SceneDocument(data: DefaultScene.make())
        let before = doc.data
        doc.updateNode("key-light") { node in
            if case .light(var p) = node.params { p.intensity = 12; node.params = .light(p) }
        }
        XCTAssertNotEqual(doc.data, before)
        XCTAssertTrue(doc.undoManager.canUndo)
        doc.undoManager.undo()
        XCTAssertEqual(doc.data, before)
    }
}
```

- [ ] **Step 2: Kjør — verifiser FAIL (typer finnes ikke)**

```bash
xcodebuild -project StageOne.xcodeproj -scheme StageOne -destination '<iPad-sim>' test 2>&1 | tail -20
```
Expected: kompileringsfeil «cannot find 'DefaultScene'» e.l.

- [ ] **Step 3: Implementer modellen (typene over, verbatim) + `SceneDocument`:**

```swift
// StageOne/Model/SceneDocument.swift
import Foundation
import Observation

@Observable @MainActor
final class SceneDocument {
    var data: SceneData
    var selectedNodeId: String?
    @ObservationIgnored let undoManager = UndoManager()

    init(data: SceneData) { self.data = data }

    func mutate(_ change: (inout SceneData) -> Void) {
        let snapshot = data
        undoManager.registerUndo(withTarget: self) { doc in
            MainActor.assumeIsolated { doc.mutate { $0 = snapshot } }
        }
        change(&data)
    }

    func updateNode(_ id: String, _ change: (inout Node) -> Void) {
        mutate { scene in
            guard let i = scene.nodes.firstIndex(where: { $0.id == id }) else { return }
            change(&scene.nodes[i])
        }
    }
}
```
`DefaultScene.make()`: overfør prototypens `NODES`-tabell verbatim (posisjoner/rotasjoner/params fra `virtual-studio-ipad.html`, se JS `var NODES=`): key/fill/back-light, camera-a/b/c (35/50/85mm), host/guest, chair-left/right, coffee-table, floor, led-wall, stage, background + grupper (Studio → floor/led-wall/stage/background; Seating → chairs+table; Talent; Lights; Cameras) + 5 shots (a,b,c,a,b à 4s). `environment: "mountain-dusk"`.

- [ ] **Step 4: Kjør tester — PASS**

Samme kommando. Expected: `Test Suite 'All tests' passed`

- [ ] **Step 5: Commit**

```bash
git add ipad/StageOne/StageOne/Model ipad/StageOne/StageOneTests/SceneModelTests.swift
git commit -m "feat(stageone): scenemodell m/ undo + default-scene fra prototypen"
```

---

### Task 4: Persistens (DocumentStore, autosave)

**Files:**
- Create: `ipad/StageOne/StageOne/Model/DocumentStore.swift`
- Test: `ipad/StageOne/StageOneTests/DocumentStoreTests.swift`

**Interfaces:**
- Consumes: `SceneData` (Task 3)
- Produces:

```swift
struct DocumentStore: Sendable {
    let directory: URL // default: Documents
    func save(_ scene: SceneData, id: String) throws        // <id>.stageone.json, atomisk
    func load(id: String) throws -> SceneData
    func listSceneIds() -> [String]
}
```
  Autosave kobles i Task 9 (RootView `.onChange(of: doc.data)` med 1s debounce-`Task`).

- [ ] **Step 1: Failing tests**

```swift
import XCTest
@testable import StageOne

final class DocumentStoreTests: XCTestCase {
    func testSaveLoadRoundtrip() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let store = DocumentStore(directory: dir)
        let scene = DefaultScene.make()
        try store.save(scene, id: "test-scene")
        let back = try store.load(id: "test-scene")
        XCTAssertEqual(scene, back)
        XCTAssertEqual(store.listSceneIds(), ["test-scene"])
    }
}
```

- [ ] **Step 2: Kjør — FAIL** (`cannot find 'DocumentStore'`)

- [ ] **Step 3: Implementer**

```swift
import Foundation

struct DocumentStore: Sendable {
    var directory: URL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    private static let suffix = ".stageone.json"

    func save(_ scene: SceneData, id: String) throws {
        let enc = JSONEncoder(); enc.outputFormatting = [.sortedKeys]
        try enc.encode(scene).write(to: url(id), options: .atomic)
    }
    func load(id: String) throws -> SceneData {
        try JSONDecoder().decode(SceneData.self, from: Data(contentsOf: url(id)))
    }
    func listSceneIds() -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
        return names.filter { $0.hasSuffix(Self.suffix) }
            .map { String($0.dropLast(Self.suffix.count)) }.sorted()
    }
    private func url(_ id: String) -> URL { directory.appendingPathComponent(id + Self.suffix) }
}
```

- [ ] **Step 4: Kjør tester — PASS**
- [ ] **Step 5: Commit** — `feat(stageone): DocumentStore (JSON i Documents)`

---

### Task 5: Matte + mesh-generering

**Files:**
- Create: `ipad/StageOne/StageOne/Render/MathX.swift`
- Create: `ipad/StageOne/StageOne/Render/MeshFactory.swift`
- Test: `ipad/StageOne/StageOneTests/RenderMathTests.swift`

**Interfaces:**
- Consumes: `Transform`, `PropShape`, `NodeKind` (Task 3)
- Produces:

```swift
// MathX.swift
extension float4x4 {
    static func perspective(fovYRadians: Float, aspect: Float, near: Float, far: Float) -> float4x4
    static func lookAt(eye: SIMD3<Float>, center: SIMD3<Float>, up: SIMD3<Float>) -> float4x4
    static func model(_ t: Transform) -> float4x4  // T * Rz*Ry*Rx (grader→rad) * S
}
func kelvinToRGB(_ kelvin: Double) -> SIMD3<Float> // Tanner Helland-approksimasjon, 1000–12000K

// MeshFactory.swift
struct Vertex { var position: SIMD3<Float>; var normal: SIMD3<Float> } // + padding for Metal-layout
struct Mesh: Sendable { var vertices: [Vertex]; var indices: [UInt16]; var boundsMin: SIMD3<Float>; var boundsMax: SIMD3<Float> }
enum MeshFactory {
    static func mesh(for shape: PropShape) -> Mesh   // box/plane/cylinder/capsule/stage
    static func mesh(forNodeKind kind: NodeKind, params: NodeParams) -> Mesh
    // .talent → capsule, .light → liten boks (ikon-proxy), .camera → boks-proxy
}
```

- [ ] **Step 1: Failing tests**

```swift
import XCTest
import simd
@testable import StageOne

final class RenderMathTests: XCTestCase {
    func testKelvinToRGB() {
        let warm = kelvinToRGB(2000), neutral = kelvinToRGB(6600), cold = kelvinToRGB(10000)
        XCTAssertGreaterThan(warm.x, warm.z)          // varm = rød > blå
        XCTAssertGreaterThan(cold.z, cold.x)          // kald = blå > rød
        for c in [neutral.x, neutral.y, neutral.z] { XCTAssertEqual(c, 1.0, accuracy: 0.15) }
    }
    func testMeshesAreSane() {
        for shape in [PropShape.box, .plane, .cylinder, .capsule, .stage] {
            let m = MeshFactory.mesh(for: shape)
            XCTAssertFalse(m.vertices.isEmpty); XCTAssertFalse(m.indices.isEmpty)
            XCTAssertEqual(m.indices.count % 3, 0)
            for v in m.vertices {
                XCTAssertEqual(simd_length(v.normal), 1.0, accuracy: 0.01)
                XCTAssertTrue(all(v.position .>= m.boundsMin .- 0.001) && all(v.position .<= m.boundsMax .+ 0.001))
            }
            XCTAssertLessThanOrEqual(m.indices.max().map(Int.init) ?? 0, m.vertices.count - 1)
        }
    }
    func testModelMatrixTranslates() {
        var t = Transform.identity; t.position = [1, 2, 3]
        let p = float4x4.model(t) * SIMD4<Float>(0, 0, 0, 1)
        XCTAssertEqual(p.x, 1, accuracy: 0.001); XCTAssertEqual(p.y, 2, accuracy: 0.001); XCTAssertEqual(p.z, 3, accuracy: 0.001)
    }
}
```

- [ ] **Step 2: Kjør — FAIL**
- [ ] **Step 3: Implementer.** Standard grafikk-matte (høyrehendt, kolonne-major simd). Mesh-generering: boks = 24 verts (per-face-normaler); plan = 4 verts; sylinder/kapsel/stage = 24 segmenter; kapsel = sylinder + halvkule-ender; stage = flat sylinder r=1, h=0.15. Alle enhets-størrelse (skaleres via `Transform.scale`).
- [ ] **Step 4: Kjør tester — PASS**
- [ ] **Step 5: Commit** — `feat(stageone): render-matte + mesh-generering m/ tester`

---

### Task 6: Metal-renderer (forward-pass, offscreen-API)

**Files:**
- Create: `ipad/StageOne/StageOne/Render/Shaders.metal`
- Create: `ipad/StageOne/StageOne/Render/ShaderTypes.h` (bridging via `SWIFT_OBJC_INTEROP` unødvendig — bruk ren Swift-speiling, se under)
- Create: `ipad/StageOne/StageOne/Render/StageRenderer.swift`
- Test: `ipad/StageOne/StageOneTests/RendererSmokeTests.swift`

**Interfaces:**
- Consumes: `SceneData` (Task 3), `MeshFactory`/`MathX` (Task 5)
- Produces:

```swift
struct RenderCamera: Sendable {
    var position: SIMD3<Float>; var target: SIMD3<Float>
    var fovYRadians: Float
    static func from(node: Node) -> RenderCamera  // focalMm→fov (36mm-ekv.: fov = 2*atan(12/focal))
}

@MainActor final class StageRenderer {
    init() throws  // MTLCreateSystemDefaultDevice, pipelines fra .metal
    var selectedNodeId: String?
    func draw(scene: SceneData, camera: RenderCamera, in view: MTKView)          // brukes av viewport (Task 8)
    func renderOffscreen(scene: SceneData, camera: RenderCamera,
                         width: Int, height: Int) throws -> MTLTexture           // brukes av test + fase 2/3
}
func averageLuminance(of texture: MTLTexture) -> Double  // CPU-lesning, testhjelper (i testfil)
```

Swift↔shader-uniforms: definer `struct FrameUniforms` og `struct NodeUniforms` IDENTISK i Swift (med eksplisitt `SIMD`-typer) og i MSL — ingen bridging header. Layout-kommentar begge steder.

```swift
struct GPULight { var position, direction, color: SIMD3<Float>; var intensity, beamCos, isSpot: Float; var pad: SIMD2<Float> }
struct FrameUniforms { var viewProj: float4x4; var cameraPos: SIMD3<Float>; var lightCount: Int32; var lights: (GPULight, GPULight, GPULight, GPULight, GPULight, GPULight, GPULight, GPULight) }
struct NodeUniforms { var model: float4x4; var normalMatrix: float4x4; var baseColor: SIMD3<Float>; var selected: Float }
```

- [ ] **Step 1: Failing røyktest**

```swift
import XCTest
import Metal
@testable import StageOne

final class RendererSmokeTests: XCTestCase {
    @MainActor func testOffscreenRenderIsNotBlank() throws {
        let renderer = try StageRenderer()
        let scene = DefaultScene.make()
        let cam = RenderCamera.from(node: scene.node("camera-a")!)
        let tex = try renderer.renderOffscreen(scene: scene, camera: cam, width: 640, height: 360)
        // les tilbake, sjekk variasjon (ikke ensfarget)
        var pixels = [UInt8](repeating: 0, count: 640 * 360 * 4)
        tex.getBytes(&pixels, bytesPerRow: 640 * 4, from: MTLRegionMake2D(0, 0, 640, 360), mipmapLevel: 0)
        let unique = Set(stride(from: 0, to: pixels.count, by: 4).map { pixels[$0] })
        XCTAssertGreaterThan(unique.count, 8, "render ser blank/ensfarget ut")
    }
}
```

- [ ] **Step 2: Kjør — FAIL**
- [ ] **Step 3: Implementer.**
  - `Shaders.metal`: vertex (pos/normal → clip + world), fragment: Blinn-Phong per lys (spot-falloff via `beamCos`, avstands-attenuasjon 1/d²), ambient 0.08, Reinhard tone-map, gamma 2.2. Selected → additivt accent-tint (0.545, 0.36, 0.965)·0.25.
  - `StageRenderer`: bygger mesh-buffere per NodeKind/PropShape lazily (cache `[String: MTLBuffer]` per mesh-nøkkel); depth-tekstur; én render-pass; hopper over `enabled == false`-noder; lys fra scene-noder (`kelvinToRGB` × intensity/100); gulv-grid som linje-primitiver (egen enkel unlit pipeline, farge = border-grå).
  - `renderOffscreen`: `MTLTextureDescriptor` bgra8Unorm + `.shared` storage, render, `waitUntilCompleted`.
- [ ] **Step 4: Kjør test — PASS** (kjøres i sim; Metal-sim-støtte finnes. Om sim-GPU feiler: kjør testen betinget `#if targetEnvironment(simulator)` med `try XCTSkipIf(MTLCreateSystemDefaultDevice() == nil)` — men forvent at den kjører.)
- [ ] **Step 5: Commit** — `feat(stageone): Metal forward-renderer + offscreen-API + røyktest`

---

### Task 7: Beams, skyggekart, selection/gizmo-hjelpegrafikk

**Files:**
- Modify: `ipad/StageOne/StageOne/Render/Shaders.metal`
- Modify: `ipad/StageOne/StageOne/Render/StageRenderer.swift`
- Test: utvid `RendererSmokeTests.swift`

**Interfaces:**
- Consumes: Task 6.
- Produces: samme `StageRenderer`-API — nå med: skyggekart (2048² depth, kun for første `castsShadows`-spot-lys, PCF 3×3), volumetriske beam-kjegler (additiv blending, alpha ∝ intensity, fade mot kjegle-kant og lengde), kamera-frustum-linjer + lys-ikon-proxyer for ikke-valgte hjelpeobjekter, selection-outline (skalert backface-pass i accent).

- [ ] **Step 1: Utvid test** — render med `key-light.castsShadows = true` vs alle lys `enabled=false`; assert lysere gjennomsnitt med lys på:

```swift
@MainActor func testLightsAffectImage() throws {
    let renderer = try StageRenderer()
    var scene = DefaultScene.make()
    let cam = RenderCamera.from(node: scene.node("camera-a")!)
    let lit = try renderer.renderOffscreen(scene: scene, camera: cam, width: 320, height: 180)
    for i in scene.nodes.indices where scene.nodes[i].kind == .light { scene.nodes[i].enabled = false }
    let dark = try renderer.renderOffscreen(scene: scene, camera: cam, width: 320, height: 180)
    XCTAssertGreaterThan(avgLuma(lit), avgLuma(dark) + 0.02)
}
```
(`avgLuma`: CPU-lesning som i Task 6-testen, gjennomsnitt av RGB.)

- [ ] **Step 2: Kjør — ny test FAIL (eller trivielt PASS — da styrk assert til beams: sjekk piksler over stage-området endres)**
- [ ] **Step 3: Implementer** beam-pass (egen pipeline, kjegle-mesh fra lysets `beamDeg`, additiv, depth-read-only), shadow-pass før hovedpass, outline-pass etter. Gizmo-linjer for aktivt verktøy tegnes i Task 8 (trenger tool-state).
- [ ] **Step 4: Kjør alle tester — PASS**
- [ ] **Step 5: Commit** — `feat(stageone): beams, skyggekart, selection-outline`

---

### Task 8: Viewport (MTKView-wrapper, orbit-kamera, picking, verktøy-drag)

**Files:**
- Create: `ipad/StageOne/StageOne/UI/ViewportView.swift`
- Create: `ipad/StageOne/StageOne/UI/OrbitCamera.swift`
- Create: `ipad/StageOne/StageOne/Render/Picking.swift`
- Test: `ipad/StageOne/StageOneTests/PickingTests.swift`

**Interfaces:**
- Consumes: `StageRenderer` (Task 6/7), `SceneDocument` (Task 3)
- Produces:

```swift
enum EditorTool: String, CaseIterable, Sendable { case select, move, rotate, scale }

struct OrbitCamera: Sendable {
    var target: SIMD3<Float>; var distance: Float; var azimuthDeg: Float; var elevationDeg: Float
    func renderCamera(fovYRadians: Float) -> RenderCamera
    static let `default` = OrbitCamera(target: [0, 1, 0], distance: 8, azimuthDeg: 0, elevationDeg: 18)
    static func preset(_ name: ViewPreset) -> OrbitCamera // .front/.back/.left/.right/.top
}
enum ViewPreset: String, CaseIterable { case front, back, left, right, top }

// Picking.swift — ren funksjon, testbar uten Metal:
func pickNode(in scene: SceneData, rayOrigin: SIMD3<Float>, rayDir: SIMD3<Float>) -> String?
func ray(fromScreenPoint p: CGPoint, viewSize: CGSize, camera: RenderCamera) -> (origin: SIMD3<Float>, dir: SIMD3<Float>)

struct ViewportView: UIViewRepresentable { // MTKView + gester
    let document: SceneDocument
    @Binding var orbit: OrbitCamera
    @Binding var tool: EditorTool
    @Binding var lookThroughCameraId: String?  // nil = orbit; ellers scenens kamera (transport bruker denne)
}
```
Gester: 1-finger drag = orbit (eller node-drag når tool ≠ .select og treff på valgt node — move: XZ-plan-projeksjon; rotate: Δx→Y-rotasjon; scale: Δy→uniform), 2-finger = pan, pinch = zoom, tap = picking/deselect.

- [ ] **Step 1: Failing picking-tester**

```swift
final class PickingTests: XCTestCase {
    func testRayHitsCoffeeTable() {
        let scene = DefaultScene.make()
        // rett ovenfra ned på bordet (pos ca [0,0,0.3])
        let hit = pickNode(in: scene, rayOrigin: [0, 5, 0.3], rayDir: [0, -1, 0])
        XCTAssertNotNil(hit)
    }
    func testRayMissesEverything() {
        let hit = pickNode(in: DefaultScene.make(), rayOrigin: [50, 5, 50], rayDir: [0, -1, 0])
        XCTAssertNil(hit)  // OBS: floor er stor — bruk origin utenfor gulvet
    }
    func testNearestNodeWins() {
        let scene = DefaultScene.make()
        let hit = pickNode(in: scene, rayOrigin: [0.7, 5, 0.2], rayDir: [0, -1, 0])
        XCTAssertEqual(hit, "chair-right") // stol nærmere strålen enn gulvet under
    }
}
```

- [ ] **Step 2: Kjør — FAIL**
- [ ] **Step 3: Implementer** ray-AABB (slab method) mot world-space-bounds (`MeshFactory`-bounds × modellmatrise, 8 hjørner → AABB); nærmeste t vinner; `enabled==false` hoppes over. `ViewportView` med `MTKViewDelegate`-coordinator som kaller `renderer.draw(scene:camera:in:)` per frame.
- [ ] **Step 4: Kjør tester — PASS + full build**
- [ ] **Step 5: Commit** — `feat(stageone): viewport m/ orbit, picking, verktøy-drag`

---

### Task 9: App-skall — tre-panels layout, toolbar, hierarki

**Files:**
- Modify: `ipad/StageOne/StageOne/App/StageOneApp.swift` (RootView → ekte skall)
- Create: `ipad/StageOne/StageOne/UI/StudioScreen.swift`
- Create: `ipad/StageOne/StageOne/UI/HierarchyPanel.swift`
- Create: `ipad/StageOne/StageOne/UI/TopToolbar.swift`
- Create: `ipad/StageOne/StageOne/UI/StubScreens.swift`

**Interfaces:**
- Consumes: Theme (2), SceneDocument (3), DocumentStore (4), ViewportView (8)
- Produces:

```swift
enum AppMode: String, CaseIterable { case studio = "Studio", lights = "Lights", cameras = "Cameras", export = "Export" }

// RootView eier: @State doc = SceneDocument(data: lagret ?? DefaultScene.make()),
// @State mode: AppMode = .studio, autosave: .onChange(of: doc.data) debounce 1s → DocumentStore.save(id: "default")
// mode-switch: .studio → StudioScreen(document:), andre → StubScreen(mode:) («kommer i fase 2/3»)

struct StudioScreen: View { let document: SceneDocument }
// HStack(spacing:0): HierarchyPanel.frame(width:264) | Divider(Theme.border) | midt-kolonne | Divider | InspectorPanel.frame(width:280)
// midt-kolonne: ViewportView + overlays (Task 11) + TransportBar (Task 11)

struct TopToolbar: View { // app-navn, undo/redo-knapper (doc.undoManager), mode-tabs (accent-pill på aktiv), + -knapp (meny: Add Box/Cylinder/Capsule → mutate append prop-node)
    let document: SceneDocument
    @Binding var mode: AppMode
}
struct HierarchyPanel: View { let document: SceneDocument }
// Seksjoner fra doc.data.groups; rad: SF Symbol per kind (lightbulb, video, person, cube), navn,
// øye-knapp (eye/eye.slash → updateNode enabled.toggle). Tap = selectedNodeId. Valgt = accent-bakgrunn 12%.
// Nederst: «Scan Room»-kort + «Assets» — begge disabled m/ «Kommer»-badge (Theme.muted).
```

- [ ] **Step 1: Implementer alle views** (SwiftUI, Theme-tokens; ingen ny logikk utover interfacet over)
- [ ] **Step 2: Full build + kjør i sim, ta screenshot**

```bash
xcodebuild ... build && xcrun simctl boot "iPad Pro 13-inch (M4)" 2>/dev/null;
xcrun simctl install booted <app-path> && xcrun simctl launch booted com.creatorhubn.StageOne
xcrun simctl io booted screenshot /tmp/stageone-shell.png
```
Expected: tre paneler, hierarki viser 15 noder gruppert, viewport rendrer scenen, tabs bytter til stubs.
- [ ] **Step 3: Verifiser undo-knapp + øye-toggle + selection (viewport-outline følger hierarki-valg) manuelt i sim**
- [ ] **Step 4: Commit** — `feat(stageone): app-skall — toolbar, hierarki, tre-panels layout`

---

### Task 10: Inspector

**Files:**
- Create: `ipad/StageOne/StageOne/UI/InspectorPanel.swift`
- Create: `ipad/StageOne/StageOne/UI/Controls.swift` (ValueChipSlider, NumericField, SegmentPicker)
- Test: `ipad/StageOneTests/InspectorBindingTests.swift`

**Interfaces:**
- Consumes: SceneDocument (3), Theme (2)
- Produces:

```swift
struct InspectorPanel: View { let document: SceneDocument }
// Ingen node valgt → «Ingen valgt»-empty-state.
// Transform-seksjon: NumericField ×9 (pos/rot/scale xyz) → updateNode.
// Kind-seksjoner (matcher prototypens params):
//  light: SegmentPicker(Spot/Area), ValueChipSlider(Intensity 0–100 «%»), (Temp 2000–10000 «K»),
//         (Beam 10–120 «°»), Toggle(Shadows), SegmentPicker(quality Low/Medium/High)
//  camera: ValueChipSlider(Focal 12–135 «mm»), TextField(aperture), ValueChipSlider(ISO 100–6400, step 50),
//          TextField(shutter), Toggle(DOF)
//  talent: TextField(seat), Toggle(eyeline), TextField(marker)
//  prop:  TextField(material)  (shape er ikke redigerbar i v1)

struct ValueChipSlider: View { // 3px track, accent-fylling, verdichip i mono-font m/ border, høyre-justert
    let label: String; let unit: String; let range: ClosedRange<Double>; var step: Double = 1
    @Binding var value: Double
}
```

- [ ] **Step 1: Failing binding-test** (logikk-test uten UI: mutasjon via updateNode speiles i data + undo — dekker inspector-skrivebanen)

```swift
@MainActor func testLightIntensityEdit() {
    let doc = SceneDocument(data: DefaultScene.make())
    doc.updateNode("fill-light") { n in
        if case .light(var p) = n.params { p.intensity = 99; n.params = .light(p) }
    }
    guard case .light(let p)? = doc.data.node("fill-light")?.params else { return XCTFail() }
    XCTAssertEqual(p.intensity, 99)
    doc.undoManager.undo()
    guard case .light(let p2)? = doc.data.node("fill-light")?.params else { return XCTFail() }
    XCTAssertEqual(p2.intensity, 45)
}
```

- [ ] **Step 2: Kjør — FAIL først?** Denne passerer alt fra Task 3 — behold som regresjonsvakt; UI-verifisering skjer i sim.
- [ ] **Step 3: Implementer views.** Bindings: `Binding(get: { param fra doc }, set: { doc.updateNode(...) })`. Slider-drag skal registrere ÉN undo per drag (mutér direkte under drag via `updateNodeWithoutUndo`-variant + registrer snapshot på `onEditingChanged(false)` — legg til `func updateNodeTransient(_ id:_ change:)` på SceneDocument som muterer uten undo-registrering, og `func commitTransient(from snapshot: SceneData)`).
- [ ] **Step 4: Full build + sim-verifisering:** velg key-light → dra Intensity → viewport-lys endres live; undo reverserer hele draget.
- [ ] **Step 5: Commit** — `feat(stageone): inspector m/ verdichip-sliders og transient undo`

---

### Task 11: Transport, shot-strip, view-cube, inaktive AI/AR-kort

**Files:**
- Create: `ipad/StageOne/StageOne/UI/TransportBar.swift`
- Create: `ipad/StageOne/StageOne/UI/ViewportOverlays.swift`
- Create: `ipad/StageOne/StageOne/Model/ShotPlayer.swift`
- Modify: `ipad/StageOne/StageOne/UI/StudioScreen.swift` (montér)
- Test: `ipad/StageOneTests/ShotPlayerTests.swift`

**Interfaces:**
- Consumes: SceneDocument (3), OrbitCamera/ViewportView (8)
- Produces:

```swift
@Observable @MainActor final class ShotPlayer {
    var isPlaying: Bool; var elapsed: Double // sek i sekvensen
    var currentShotIndex: Int? { get }       // fra elapsed + shots
    func currentCameraId(in scene: SceneData) -> String?
    func play(); func pause(); func tick(dt: Double)  // drives av TimelineView i TransportBar
    func timecode: String                             // "00:00:00" HH:MM:SS fra elapsed
}
```
`TransportBar`: play/pause-knapp, mono-timecode, shot-kort (accent-border på aktiv, tap = hopp til shot). Ved `isPlaying`: `ViewportView.lookThroughCameraId = player.currentCameraId` → viewport ser gjennom shot-kameraet; pause → tilbake til orbit. `.keyboardShortcut(.space, modifiers: [])` på play.
`ViewportOverlays`: view-cube-pill (Front/Top/Left/Right/Back → `orbit = .preset(...)` m/ animasjon), verktøy-pille (select/move/rotate/scale), «AI Assistant»- og «AR Preview»-kort disabled m/ «Kommer»-badge.

- [ ] **Step 1: Failing ShotPlayer-tester**

```swift
@MainActor func testShotSequence() {
    let scene = DefaultScene.make() // 5 shots à 4s
    let p = ShotPlayer()
    p.play(); p.tick(dt: 0.5)
    XCTAssertEqual(p.currentShotIndex, 0)
    p.tick(dt: 4.0)
    XCTAssertEqual(p.currentShotIndex, 1)
    XCTAssertEqual(p.currentCameraId(in: scene), scene.shots[1].cameraNodeId)
    p.tick(dt: 100)  // forbi slutten → stopp på siste + pause
    XCTAssertFalse(p.isPlaying)
    XCTAssertEqual(p.timecode.count, 8)
}
```
(NB: `currentShotIndex`/`currentCameraId` trenger shots — gi `tick`/computed tilgang via lagret `shots: [Shot]` satt av `func load(shots: [Shot])`; juster testen tilsvarende.)

- [ ] **Step 2: Kjør — FAIL**
- [ ] **Step 3: Implementer** ShotPlayer + views + montering i StudioScreen.
- [ ] **Step 4: Full build + tester PASS + sim-verifisering** (space spiller, viewport klipper mellom kameraer, view-cube animerer)
- [ ] **Step 5: Commit** — `feat(stageone): transport + shots + view-cube + kommer-kort`

---

### Task 12: Sluttverifisering

**Files:** ingen nye — fikser det som dukker opp.

- [ ] **Step 1: Full test-suite + build**

```bash
cd ipad/StageOne && xcodegen generate
xcodebuild -project StageOne.xcodeproj -scheme StageOne -destination '<iPad-sim>' test
```
Expected: alle tester PASS, 0 errors. Rydd alle warnings som er våre.
- [ ] **Step 2: Kjør appen i sim, full manuell runde:** velg noder i hierarki + viewport, flytt/roter/skaler, endre lys/kamera-params, toggle øyne, spill shots, bytt view-preset, undo/redo-kjede, drep app + relaunch → scenen er persistert.
- [ ] **Step 3: Screenshot** `/tmp/stageone-final.png` — sammenlign visuelt mot prototypen (`virtual-studio-ipad.html`).
- [ ] **Step 4: Commit ev. fikser** — `fix(stageone): sluttverifisering fase 1`. IKKE push (Daniel pusher per feature-disiplin — spør om han vil pushe/PR).

## Self-review-notater

- Spec-dekning: prosjektoppsett (T1), tokens (T2), modell+undo (T3), persistens (T4), renderer m/ beams/skygge/grid/outline (T5–T7), viewport+gester+picking (T8), tre-panels UI+hierarki+stubs (T9), inspector (T10), transport/shots/view-cube/kommer-kort (T11), full verifisering (T12). DOF-param lagres (T3) uten render-effekt — som spec.
- Kjente avvik: gizmo-akse-håndtak i 3D er forenklet til drag-på-valgt-node med aktivt verktøy (prototypen viser gizmo visuelt — outline + verktøypille dekker funksjonen i v1).
- Typenavn konsistente på tvers av tasks (SceneDocument.updateNode, MeshFactory.mesh, RenderCamera.from, OrbitCamera.preset).
