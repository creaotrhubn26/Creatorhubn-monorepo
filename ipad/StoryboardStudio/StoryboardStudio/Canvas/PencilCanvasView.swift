import SwiftUI
import UIKit
import QuartzCore

// Tegneflate: CAMetalLayer + UITouch med coalesced (full samplingsrate,
// 240Hz på Pencil) og predicted touches (latens-maskering — Apples mønster:
// predicted tegnes transient og forkastes når ekte samples ankommer).

@MainActor
final class CanvasState: ObservableObject {
    @Published var strokes: [PencilStroke] = []
    @Published var brushType: BrushType = .pencil
    @Published var brushSize: Double = 6
    @Published var brushColor: String = "#26282e"
    @Published var brushOpacity: Double = 0.95
    // Smoothing-slider (0–1) — overstyrer per-pensel Streamline-verdi når
    // satt (web-paritet: streamlineOverride = pct * 0.92).
    @Published var streamlineOverride: Double?
    // Board Pro-lag: nye strøk tagges med aktivt lag; skjulte lag filtreres
    // fra rendering (web-paritet — dataene beholdes urørt).
    @Published var activeBoardLayer = "Drawing"
    @Published var hiddenLayers: Set<String> = []
    // Per-lag opacity (0–1) og lås (blokkerer tegning på laget) — web-paritet.
    @Published var layerOpacity: [String: Double] = [:]
    @Published var lockedLayers: Set<String> = []
    @Published var layerOrder: [String] = BoardLayers.defaultOrder
    @Published var layerBlendModes: [String: BoardLayerBlendMode] = [:]
    // Runtime-only source layers already represented by an approved AI raster.
    // They remain persisted/editable and reappear if the camera is changed,
    // but are not drawn twice over the canonicalized Color/Atmosphere base.
    @Published var suppressedSourceLayers: Set<String> = []
    // Lagret tegneflate-dimensjon (drawingData.width/height). Satt → strøk
    // holdes i det koordinatrommet (web-paritet); view skalerer ved rendering
    // og inverterer ved input. nil → view-punktrom (Frikanvas).
    @Published var contentSize: CGSize?
    // Canonical camera window. Strokes always remain in contentSize/source
    // coordinates; this transform only controls how that source is viewed.
    @Published var shotFraming: ShotFramingState = .standard
    /// Durable authored viewport motion. Presentation ticks are still
    /// runtime-only; one saved editor transaction is one history command.
    @Published var cameraMotionTrack: CameraMotionTrack?
    /// Runtime-only camera chosen by FrameEvaluator for the current
    /// presentation tick. Editing/input always remains in persisted
    /// shotFraming coordinates; nil means the canonical t=0 pose.
    @Published var presentationFraming: ShotFramingState?

    var renderFraming: ShotFramingState {
        (presentationFraming ?? shotFraming).normalized()
    }

    /// Input is defined in the persisted document camera. A future playback
    /// tick may present another camera pose, but accepting strokes through
    /// that transform would write them into the wrong source coordinates.
    /// Keep presentation read-only until the editor explicitly returns to the
    /// canonical pose.
    var acceptsDrawingInputForCurrentPresentation: Bool {
        guard let presentationFraming else { return true }
        return presentationFraming.normalized().canonicalFingerprint
            == shotFraming.normalized().canonicalFingerprint
    }

    /// Identity captured when an editing gesture begins. Returning nil makes
    /// the read-only presentation gate explicit at the call site.
    var drawingInputPresentationFingerprint: String? {
        guard acceptsDrawingInputForCurrentPresentation else { return nil }
        return renderFraming.canonicalFingerprint
    }

    /// A gesture may commit only through the exact camera transform it began
    /// with. This closes the race where playback or a camera edit changes the
    /// inverse transform between touchesBegan and touchesEnded.
    func continuesDrawingInput(from fingerprint: String?) -> Bool {
        guard let fingerprint else { return false }
        return drawingInputPresentationFingerprint == fingerprint
    }
    // Dokumenthistorikk omfatter både innhold og lag. Arkivet er frame-
    // scoped og beskyttet på disk, slik at framebytte/app-kill ikke tar
    // fra artisten muligheten til å angre.
    static let undoDepthLimit = CanvasHistoryBudgetPolicy.maximumEntriesPerStack
    @Published var undoStack: [CanvasHistoryEntry] = []
    @Published var redoStack: [CanvasHistoryEntry] = []
    private(set) var historyFrameId: String?
    // Pencil 2-dobbelttrykk: husk forrige pensel for viskelær-toggle.
    var previousBrushBeforeEraser: BrushType = .pencil
    // Pencil Pro squeeze: veksle mellom to siste pensler.
    var previousBrush: BrushType = .pencil
    // Eyedropper: neste tap på canvasen plukker farge i stedet for å tegne.
    @Published var colorPickArmed = false
    // Viskelær-objektmodus: berørte STRØK slettes hele (opprydding),
    // i stedet for piksel-visking.
    @Published var eraserObjectMode = false
    // Perspektiv-snap: strøk som peker mot et VP magnetiseres til strålen.
    // VP-ene i INNHOLDSROM; settes av boardet fra guide-oppsettet.
    @Published var perspectiveSnapEnabled = false
    var perspectiveSnapPoints: [CGPoint] = []
    // Bumpes ved ALLE strokes-mutasjoner (også flytt, som ikke endrer antall)
    // — rebuild- og autosynk-trigger.
    @Published var revision = 0
    // Separat visuell revisjon: nytt/oppdatert panelbilde krever GPU-rebuild,
    // men skal aldri feiltolkes som et nytt strøk og autosynkes som tegning.
    @Published var backgroundRevision = 0
    // Pensel-favoritter (persistert) — sorteres først i glyf-griden.
    @Published var favoriteBrushes: Set<String> =
        Set(UserDefaults.standard.stringArray(forKey: "sb.favBrushes") ?? [])

    func toggleFavoriteBrush(_ type: BrushType) {
        if favoriteBrushes.contains(type.rawValue) {
            favoriteBrushes.remove(type.rawValue)
        } else {
            favoriteBrushes.insert(type.rawValue)
        }
        UserDefaults.standard.set(Array(favoriteBrushes), forKey: "sb.favBrushes")
    }

    // Nylige farger (maks 8, persistert).
    @Published var recentColors: [String] =
        UserDefaults.standard.stringArray(forKey: "sb.recentColors") ?? []

    func registerRecentColor(_ hex: String) {
        var colors = recentColors.filter { $0 != hex }
        colors.insert(hex, at: 0)
        recentColors = Array(colors.prefix(8))
        UserDefaults.standard.set(recentColors, forKey: "sb.recentColors")
    }

    // Brush-editor (spec §25/§48): per-økt-overstyringer oppå preset.
    // Verdiene bakes inn i strøkets BrushSpec → følger dokumentet.
    @Published var grainOverride: Double?
    @Published var flowOverride: Double?
    @Published var hardnessOverride: Double?
    @Published var wetnessOverride: Double?
    @Published var bleedOverride: Double?
    @Published var pigmentDepletionOverride: Double?
    @Published var bristleCountOverride: Double?
    @Published var paperProfileOverride: PaperProfile?
    @Published var hatchAngleOverride: Double?    // grader
    @Published var hatchDensityOverride: Double?
    @Published var hatchLengthOverride: Double?
    @Published var envDensityOverride: Double?
    @Published var envScaleOverride: Double?
    @Published var hueJitterOverride: Double?
    // Stamp Engine 2.0 — kontrollene gjelder nye stamps og bakes deretter inn
    // per PencilStroke. nil variant/dybde betyr deterministisk auto.
    @Published var stampVariantOverride: Int?
    @Published var stampDepthOverride: ProductionStampDepth?
    @Published var stampFlipX = false
    @Published var stampStyleProfileId = "trr-story-pencil"
    @Published var stampContinuityId = ""
    // Egen penselspiss/stamp (PNG-dataURL) — én aktiv per type, persistert.
    @Published var customTipDataURL: String? =
        UserDefaults.standard.string(forKey: "sb.customTip")
    @Published var stampTipDataURL: String? =
        UserDefaults.standard.string(forKey: "sb.stampTip")

    /// Velg pensel og sett spec-defaults (størrelse/opacity) for typen —
    /// hvert verktøy skal starte med sin fysiske karakter. Editor-overrides
    /// nullstilles (de gjelder per pensel-økt).
    func selectBrush(_ type: BrushType) {
        if type != brushType { previousBrush = brushType }
        brushType = type
        if let defaults = BrushDefaults.sizeAndOpacity(for: type) {
            brushSize = defaults.size
            brushOpacity = defaults.opacity
        }
        if let hint = BrushDefaults.colorHint(for: type) {
            brushColor = hint
        }
        grainOverride = nil
        flowOverride = nil
        hardnessOverride = nil
        wetnessOverride = nil
        bleedOverride = nil
        pigmentDepletionOverride = nil
        bristleCountOverride = nil
        paperProfileOverride = nil
        hatchAngleOverride = nil
        hatchDensityOverride = nil
        hatchLengthOverride = nil
        envDensityOverride = nil
        envScaleOverride = nil
        hueJitterOverride = nil
        if type.isProductionStamp {
            stampVariantOverride = nil
            stampDepthOverride = nil
            stampFlipX = false
        }
    }

    func currentBrush() -> BrushSpec {
        var brush = BrushSpec.preset(brushType, size: brushSize, color: brushColor, opacity: brushOpacity)
        if let grain = grainOverride { brush.grain = grain }
        if let flow = flowOverride { brush.flow = flow }
        if let hardness = hardnessOverride { brush.hardness = hardness }
        if let wetness = wetnessOverride { brush.wetness = wetness }
        if let bleed = bleedOverride { brush.bleed = bleed }
        if let depletion = pigmentDepletionOverride { brush.pigmentDepletion = depletion }
        if let bristles = bristleCountOverride {
            brush.bristleCount = max(1, min(16, Int(bristles.rounded())))
        }
        if let paper = paperProfileOverride { brush.paperProfile = paper }
        brush.hatchAngleDeg = hatchAngleOverride
        brush.hatchDensity = hatchDensityOverride
        brush.hatchLength = hatchLengthOverride
        brush.envDensity = envDensityOverride
        brush.envScale = envScaleOverride
        brush.hueJitter = hueJitterOverride
        if brushType == .custom { brush.stampDataURL = customTipDataURL }
        if brushType == .stamp { brush.stampDataURL = stampTipDataURL }
        return brush
    }

    func stampInstance(for type: BrushType, strokeID: String,
                       points: [StrokePoint]) -> ProductionStampInstance? {
        guard type.isProductionStamp, let first = points.first else { return nil }
        let last = points.last ?? first
        let dx = last.x - first.x, dy = last.y - first.y
        let dragDistance = hypot(dx, dy)
        let seed = ProductionStampCatalog.stableSeed(for: strokeID)
        let variants = ProductionStampCatalog.variants(for: type)
        let automaticVariant = variants.isEmpty ? 0 : Int(seed % UInt32(variants.count))
        let variantIndex = ProductionStampCatalog.normalizedVariant(
            stampVariantOverride ?? automaticVariant, for: type)
        let variant = ProductionStampCatalog.variant(variantIndex, for: type)
        let inferredDepth: ProductionStampDepth = {
            guard let height = contentSize?.height, height > 0 else { return .midground }
            let normalizedY = first.y / Double(height)
            if normalizedY < 0.38 { return .background }
            if normalizedY > 0.74 { return .foreground }
            return .midground
        }()
        let scale = dragDistance >= 8
            ? min(4, max(0.25, dragDistance / max(20, brushSize)))
            : 1
        let rotationDegrees: Double = {
            if dragDistance >= 8 { return atan2(dy, dx) * 180 / .pi }
            return first.rollAngle ?? 0
        }()
        let continuity = stampContinuityId.trimmingCharacters(in: .whitespacesAndNewlines)
        let perspectiveSkew: Double? = {
            guard let size = contentSize, size.width > 0,
                  let closest = perspectiveSnapPoints.min(by: {
                      hypot(Double($0.x) - first.x, Double($0.y) - first.y)
                          < hypot(Double($1.x) - first.x, Double($1.y) - first.y)
                  }) else { return nil }
            // Toppen av objektet trekkes svakt mot nærmeste VP. Verdien
            // persisteres, så resultatet er stabilt også uten hjelpelinjer.
            return min(0.45, max(-0.45,
                (Double(closest.x) - first.x) / Double(size.width) * 0.62))
        }()
        let geometry = ProductionStampGeometryCatalog.geometry(
            for: type, variant: variantIndex, seed: seed)
        return ProductionStampInstance(
            variant: variantIndex,
            variantName: variant?.name ?? "Variant \(variantIndex + 1)",
            seed: seed,
            scale: scale,
            rotationDegrees: rotationDegrees,
            flipX: stampFlipX,
            depth: stampDepthOverride ?? inferredDepth,
            styleProfileId: stampStyleProfileId,
            continuityId: continuity.isEmpty ? nil : String(continuity.prefix(120)),
            renderLayer: [.cameraRigStamp, .boomMicStamp, .filmLightStamp]
                .contains(type) ? .productionOverlay : .artwork,
            parameters: variant?.parameters ?? [:],
            compoundGeometry: geometry,
            perspectiveSkew: perspectiveSkew)
    }

    func visibleStrokes() -> [PencilStroke] {
        // Lag-sortert som web (stabil sortering på BOARD_LAYERS-indeks).
        // textAnnotation-strøk rendres som tekst-overlay (ikke dabs) — web-paritet.
        // Lag-opacity multipliseres inn i strøk-opacity ved render (som web) —
        // dataene beholdes urørt.
        strokes
            .filter {
                let layer = $0.boardLayer ?? "Drawing"
                return $0.textAnnotation == nil
                    && !hiddenLayers.contains(layer)
                    && !suppressedSourceLayers.contains(layer)
            }
            .enumerated()
            .sorted { lhs, rhs in
                let li = BoardLayers.index(of: lhs.element.boardLayer, in: layerOrder)
                let ri = BoardLayers.index(of: rhs.element.boardLayer, in: layerOrder)
                return li == ri ? lhs.offset < rhs.offset : li < ri
            }
            .map { entry -> PencilStroke in
                let factor = layerOpacity[entry.element.boardLayer ?? "Drawing"] ?? 1
                guard factor < 1 else { return entry.element }
                var stroke = entry.element
                stroke.opacity *= factor
                stroke.brush?.opacity *= factor
                return stroke
            }
    }

    var layerState: BoardLayerState {
        BoardLayerState(order: layerOrder, hidden: hiddenLayers,
                        locked: lockedLayers, opacity: layerOpacity,
                        blendModes: layerBlendModes, activeLayer: activeBoardLayer)
    }

    var documentSnapshot: CanvasDocumentSnapshot {
        CanvasDocumentSnapshot(
            strokes: strokes, layers: layerState, shotFraming: shotFraming,
            cameraMotionTrack: cameraMotionTrack)
    }

    func applyLayerState(_ state: BoardLayerState) {
        var normalized = state
        normalized.normalize()
        layerOrder = normalized.order
        hiddenLayers = normalized.hidden
        lockedLayers = normalized.locked
        layerOpacity = normalized.opacity
        layerBlendModes = normalized.blendModes
        activeBoardLayer = normalized.activeLayer
    }

    func applyDocumentSnapshot(_ snapshot: CanvasDocumentSnapshot) {
        strokes = snapshot.strokes
        applyLayerState(snapshot.layers)
        if let framing = snapshot.shotFraming { shotFraming = framing.normalized() }
        cameraMotionTrack = snapshot.cameraMotionTrack
        presentationFraming = nil
    }

    func captureUndo(_ label: String) {
        undoStack.append(CanvasHistoryEntry(
            label: label, createdAt: Date(), snapshot: documentSnapshot))
        redoStack = []
        enforceHistoryBudget()
        persistHistory()
    }

    func beginHistory(
        frameId: String, layerState: BoardLayerState?,
        shotFraming: ShotFramingState? = nil,
        cameraMotionTrack: CameraMotionTrack? = nil
    ) {
        historyFrameId = frameId
        applyLayerState(layerState ?? .standard)
        self.shotFraming = (shotFraming ?? .standard).normalized()
        self.cameraMotionTrack = cameraMotionTrack
        presentationFraming = nil
        if let archive = StoryboardFrameHistoryStore.load(frameId: frameId) {
            if archive.version < CanvasHistoryArchive.schemaVersion {
                // Pre-CAM-M2 snapshots have no tri-state field. Treat their
                // missing value as "inherit the current track", never as an
                // intentional Static command that could erase new motion.
                func migrated(_ entry: CanvasHistoryEntry) -> CanvasHistoryEntry {
                    var value = entry
                    value.snapshot.cameraMotionTrack = cameraMotionTrack
                    // The snapshot changed, so a persisted estimate from an
                    // older archive no longer describes its resident cost.
                    value.estimatedByteCount = nil
                    return value
                }
                undoStack = archive.undo.map(migrated)
                redoStack = archive.redo.map(migrated)
                StoryboardFrameHistoryStore.save(
                    frameId: frameId, undo: undoStack, redo: redoStack)
            } else {
                undoStack = archive.undo
                redoStack = archive.redo
            }
        } else {
            undoStack = []
            redoStack = []
        }
        enforceHistoryBudget()
    }

    func persistHistory() {
        guard let historyFrameId else { return }
        enforceHistoryBudget()
        StoryboardFrameHistoryStore.save(
            frameId: historyFrameId, undo: undoStack, redo: redoStack)
    }

    func endHistory() {
        persistHistory()
        historyFrameId = nil
    }

    func undo() {
        guard let previous = undoStack.popLast() else { return }
        redoStack.append(CanvasHistoryEntry(
            label: previous.label, createdAt: Date(), snapshot: documentSnapshot))
        enforceHistoryBudget()
        applyDocumentSnapshot(previous.snapshot)
        revision += 1
        persistHistory()
    }

    func redo() {
        guard let next = redoStack.popLast() else { return }
        undoStack.append(CanvasHistoryEntry(
            label: next.label, createdAt: Date(), snapshot: documentSnapshot))
        enforceHistoryBudget()
        applyDocumentSnapshot(next.snapshot)
        revision += 1
        persistHistory()
    }

    func clear() {
        guard !strokes.isEmpty else { return }
        captureUndo("Tøm tegning")
        strokes = []
        revision += 1
        persistHistory()
    }

    private func enforceHistoryBudget() {
        let bounded = CanvasHistoryBudgetPolicy.trimmed(
            undo: undoStack, redo: redoStack)
        if undoStack != bounded.undo { undoStack = bounded.undo }
        if redoStack != bounded.redo { redoStack = bounded.redo }
    }

    func exportWebJSON() -> String {
        (try? StrokeSerialization.encodeToWebJSON(strokes)) ?? "[]"
    }
}

final class MetalCanvasUIView: UIView {
    override class var layerClass: AnyClass { CAMetalLayer.self }
    var metalLayer: CAMetalLayer { layer as! CAMetalLayer }

    var renderer: MetalStrokeRenderer?
    weak var state: CanvasState?
    // Fullskjerm tegnemodus: kun Pencil tegner (finger panorerer ScrollView).
    var pencilOnly = false
    // Inline (i arket) må slå av scroll-cancel for å eie touches; fullskjerm
    // vil beholde den så finger-pan fungerer.
    var disableScrollCancel = true
    private var currentInputType = "pencil"

    private var activePoints: [StrokePoint] = []
    private var predictedPoints: [StrokePoint] = []
    private var strokeStartedAt = Date()
    // StreamLine: EMA-glatting av posisjon (web-paritet, samme koeffisienter).
    // Trykk/tilt glattes ikke. Siste råpunkt legges til ved stroke-end
    // (catch-up) så streken lander der pennen sluttet.
    private var streamlineState: (x: Double, y: Double)?
    private var lastRawPoint: StrokePoint?
    // Antall strøk allerede i akkumulatoren — skiller inkrementell append
    // (vår egen commit) fra ekstern endring (undo/clear → full rebuild).
    private var committedCount = 0
    private var displayScale: Double { Double(window?.screen.scale ?? 2) }
    // Innholdsrom → view-punkter (1 når contentSize ikke er satt).
    private var contentScale: Double {
        guard let size = state?.contentSize,
              size.width > 0, size.height > 0,
              bounds.width > 0, bounds.height > 0 else { return 1 }
        // Source texture always retains the complete document aspect. The
        // viewport may be 2.39:1/vertical; aspect-fill happens only in present.
        return Double(max(bounds.width / size.width,
                          bounds.height / size.height))
    }
    // Samlet skala innholdsrom → kildepiksler. Tette crops rendres mot faktisk
    // zoom (med en iPad-safe 8192-cap) før Metal sampler utsnittet.
    private var committedOversample = 1.0
    private var renderScale: Double {
        displayScale * contentScale * committedOversample
    }

    private func ensureCanvasResolution() -> Bool {
        guard let renderer else { return false }
        let drawableWidth = Int(metalLayer.drawableSize.width)
        let drawableHeight = Int(metalLayer.drawableSize.height)
        guard drawableWidth > 0, drawableHeight > 0 else { return false }
        let sourceSize = state?.contentSize ?? bounds.size
        guard sourceSize.width > 0, sourceSize.height > 0 else { return false }
        let baseScale = displayScale * contentScale
        let baseWidth = Double(sourceSize.width) * baseScale
        let baseHeight = Double(sourceSize.height) * baseScale
        let requested = min(4.5, max(1, state?.renderFraming.zoom ?? 1))
        let cap = 8_192 / max(baseWidth, baseHeight)
        // The cap is absolute. On an unusually large external display even
        // the 1× base may exceed it, so allow a sub-1 render scale instead of
        // silently allocating an unsupported Metal texture.
        committedOversample = max(0.05, min(requested, cap))
        let width = Int((baseWidth * committedOversample).rounded())
        let height = Int((baseHeight * committedOversample).rounded())
        guard renderer.committedTexture?.width != width
                || renderer.committedTexture?.height != height else { return false }
        renderer.resizeCanvas(width: width, height: height)
        return true
    }

    private var framingGeometry: ShotFramingGeometry? {
        guard let state,
              let source = state.contentSize,
              source.width > 0, source.height > 0,
              bounds.width > 0, bounds.height > 0 else { return nil }
        return ShotFramingGeometry(
            sourceSize: ShotFramingSize(width: source.width, height: source.height),
            viewportSize: ShotFramingSize(width: bounds.width, height: bounds.height),
            state: state.shotFraming
        )
    }

    private func sourcePoint(fromViewportPoint point: CGPoint) -> CGPoint {
        guard let geometry = framingGeometry else {
            return CGPoint(x: point.x / contentScale, y: point.y / contentScale)
        }
        let mapped = geometry.sourcePoint(fromViewportPoint: ShotFramingPoint(
            x: point.x, y: point.y))
        return CGPoint(x: mapped.x, y: mapped.y)
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        // Må være på for 2-finger Angre og 3-finger Gjenta. Den var tidligere
        // satt til false, som gjorde begge registrerte gestene uoppnåelige.
        isMultipleTouchEnabled = true
        isAccessibilityElement = true
        accessibilityIdentifier = "tegneflate"
        metalLayer.pixelFormat = .bgra8Unorm
        metalLayer.framebufferOnly = true
        // Apple Pencil 2 dobbelttrykk: bytt viskelær ↔ forrige pensel.
        let pencilInteraction = UIPencilInteraction()
        pencilInteraction.delegate = self
        addInteraction(pencilInteraction)
        // Standard tegneapp-gester: 2-finger-tap = angre, 3-finger = gjenta.
        let undoTap = UITapGestureRecognizer(target: self, action: #selector(handleUndoTap))
        undoTap.numberOfTouchesRequired = 2
        undoTap.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
        undoTap.cancelsTouchesInView = true
        addGestureRecognizer(undoTap)
        let redoTap = UITapGestureRecognizer(target: self, action: #selector(handleRedoTap))
        redoTap.numberOfTouchesRequired = 3
        redoTap.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
        redoTap.cancelsTouchesInView = true
        addGestureRecognizer(redoTap)
        // Pencil-hover (iOS 16+, M2-iPader): ring viser penselstørrelse.
        let hover = UIHoverGestureRecognizer(target: self, action: #selector(handleHover(_:)))
        addGestureRecognizer(hover)
        hoverRing.fillColor = nil
        hoverRing.strokeColor = UIColor(white: 0.2, alpha: 0.55).cgColor
        hoverRing.lineWidth = 1
        hoverRing.isHidden = true
        layer.addSublayer(hoverRing)
    }

    private let hoverRing = CAShapeLayer()
    private var hoverStampPoint: StrokePoint?

    // Objekt-viskelær: én undo-snapshot per gest, slett under drag.
    private var objectEraseInProgress = false
    private var objectEraseSnapshotTaken = false

    private func objectErase(at location: CGPoint) {
        guard let state else { return }
        let source = sourcePoint(fromViewportPoint: location)
        let x = Double(source.x)
        let y = Double(source.y)
        let hitIds = state.strokes.filter { stroke in
            guard stroke.textAnnotation == nil,
                  !state.lockedLayers.contains(stroke.boardLayer ?? "Drawing") else { return false }
            let stampScale = stroke.stampInstance.map {
                $0.scale * $0.depth.renderScale
            } ?? 1
            let radius = max(8, stroke.width * stampScale / 2 + 8)
            return stroke.points.contains { hypot($0.x - x, $0.y - y) < radius }
        }.map(\.id)
        guard !hitIds.isEmpty else { return }
        if !objectEraseSnapshotTaken {
            state.captureUndo("Slett objekt")
            objectEraseSnapshotTaken = true
        }
        state.strokes.removeAll { hitIds.contains($0.id) }
        state.revision += 1
    }

    @objc private func handleUndoTap() { state?.undo() }
    @objc private func handleRedoTap() { state?.redo() }

    @objc private func handleHover(_ recognizer: UIHoverGestureRecognizer) {
        switch recognizer.state {
        case .began, .changed:
            guard let state else { return }
            let location = recognizer.location(in: self)
            if state.brushType.isProductionStamp {
                let source = sourcePoint(fromViewportPoint: location)
                hoverStampPoint = StrokePoint(
                    x: Double(source.x),
                    y: Double(source.y),
                    pressure: 0.72, tiltX: 0, tiltY: 0,
                    timestamp: Date().timeIntervalSince1970 * 1_000)
                hoverRing.isHidden = true
                redraw()
                return
            }
            hoverStampPoint = nil
            let radius = max(1.5, state.brushSize
                * (framingGeometry?.sourceScale ?? contentScale) / 2)
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            hoverRing.path = UIBezierPath(
                arcCenter: location, radius: radius,
                startAngle: 0, endAngle: .pi * 2, clockwise: true).cgPath
            hoverRing.isHidden = false
            CATransaction.commit()
        default:
            hoverRing.isHidden = true
            hoverStampPoint = nil
            redraw()
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }

    // Inne i SwiftUI ScrollView (native Board) kansellerer UIScrollView
    // content-touches — tegnestrøk dør. Slå av cancel/delay i alle
    // forfedre-scrollviews så canvasen eier sine touches.
    override func didMoveToWindow() {
        super.didMoveToWindow()
        // Interactive pop (tilbake-swipe) stjeler venstre→høyre-strøk og
        // popper tegneskjermen — av mens canvasen er i vinduet.
        var responder: UIResponder? = next
        while let current = responder {
            if let controller = current as? UIViewController {
                controller.navigationController?
                    .interactivePopGestureRecognizer?.isEnabled = (window == nil)
                break
            }
            responder = current.next
        }
        guard disableScrollCancel else { return }
        var view: UIView? = superview
        while let current = view {
            if let scroll = current as? UIScrollView {
                scroll.canCancelContentTouches = false
                scroll.delaysContentTouches = false
            }
            view = current.superview
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let scale = displayScale
        metalLayer.contentsScale = scale
        let width = Int(bounds.width * scale)
        let height = Int(bounds.height * scale)
        guard width > 0, height > 0 else { return }
        metalLayer.drawableSize = CGSize(width: width, height: height)
        if ensureCanvasResolution(), let renderer {
            renderer.rebuild(
                strokes: state?.visibleStrokes() ?? [], scale: renderScale,
                layerBlendModes: state?.layerBlendModes ?? [:])
        }
        // Canvasen flyttes mellom shot-radene. En ny CAMetalLayer kan ha
        // samme størrelse som forrige og trenger likevel sin første present.
        // Uten denne redraw-en var 1B/1C hvite til neste resize eller strøk.
        redraw()
    }

    private func strokePoint(from touch: UITouch,
                             previous: StrokePoint? = nil) -> StrokePoint {
        let location = touch.preciseLocation(in: self)
        let pressure = touch.type == .pencil
            ? Double(touch.force / max(touch.maximumPossibleForce, 0.0001))
            : 0.6
        // altitude/azimuth → tiltX/tiltY i GRADER (PointerEvent-konvensjon,
        // samme som web-motoren forventer).
        var tiltX = 0.0, tiltY = 0.0
        var rollDegrees: Double?
        var rawAltitude: Double?
        var rawAzimuth: Double?
        if touch.type == .pencil {
            let altitude = Double(touch.altitudeAngle)          // 0 = flat, π/2 = vertikal
            let azimuth = Double(touch.azimuthAngle(in: self))
            rawAltitude = altitude
            rawAzimuth = azimuth
            let tiltMagnitude = (1 - altitude / (.pi / 2)) * 90 // 0..90 grader
            tiltX = cos(azimuth) * tiltMagnitude
            tiltY = sin(azimuth) * tiltMagnitude
            // Pencil Pro barrel-roll (kalibreres mot ekte hardware).
            if #available(iOS 17.5, *) {
                rollDegrees = Double(touch.rollAngle) * 180 / .pi
            }
        }
        let source = sourcePoint(fromViewportPoint: location)
        let x = Double(source.x)
        let y = Double(source.y)
        let timestamp = touch.timestamp * 1000
        let velocity: Double?
        if let previous {
            let elapsed = max(0.001, timestamp - previous.timestamp)
            velocity = hypot(x - previous.x, y - previous.y) / elapsed * 1000
        } else {
            velocity = nil
        }
        return StrokePoint(
            x: x, y: y,
            pressure: max(0.05, min(1, pressure)),
            tiltX: tiltX, tiltY: tiltY,
            timestamp: timestamp,
            rollAngle: rollDegrees,
            altitudeAngle: rawAltitude,
            azimuthAngle: rawAzimuth,
            velocity: velocity,
            estimationUpdateIndex: touch.estimationUpdateIndex?.intValue,
            estimatedProperties: Int(touch.estimatedPropertiesExpectingUpdates.rawValue))
    }

    private func makeStroke(points: [StrokePoint], idSuffix: String = "") -> PencilStroke? {
        guard let state, !points.isEmpty else { return nil }
        let brush = state.currentBrush()
        let strokeID = "ipad-\(Int(strokeStartedAt.timeIntervalSince1970 * 1000))\(idSuffix)"
        let stampInstance = state.stampInstance(
            for: brush.type, strokeID: strokeID, points: points)
        // Production stamps er ett logisk objekt. Draget bestemmer størrelse
        // og retning; det skal ikke etterlate en rekke identiske dabs.
        let storedPoints = stampInstance == nil ? points : [points[0]]
        let boardLayer = stampInstance?.renderLayer == .productionOverlay
            ? "Camera / Arrows"
            : state.activeBoardLayer
        return PencilStroke(
            id: strokeID,
            points: storedPoints,
            inputType: currentInputType,
            color: brush.color,
            width: brush.size,
            opacity: brush.opacity,
            brush: brush,
            boardLayer: boardLayer,
            stampInstance: stampInstance)
    }

    private func smoothed(_ point: StrokePoint) -> StrokePoint {
        let amount = state?.streamlineOverride
            ?? Streamline.amount(for: state?.brushType ?? .pencil)
        guard amount > 0, var sl = streamlineState else {
            streamlineState = (point.x, point.y)
            return point
        }
        let k = min(0.92, amount)
        sl.x += (point.x - sl.x) * (1 - k)
        sl.y += (point.y - sl.y) * (1 - k)
        streamlineState = sl
        var smoothedPoint = point
        smoothedPoint.x = sl.x
        smoothedPoint.y = sl.y
        return smoothedPoint
    }

    // Satt når strøket avvises ved start (låst lag) — touchesMoved/finish
    // må også respektere det, ellers lekker punktene inn likevel.
    private var strokeSuppressed = false
    private var multiTouchGestureInProgress = false
    private var activeInputFramingFingerprint: String?

    private func activeDirectTouchCount(in event: UIEvent?) -> Int {
        guard let touches = event?.allTouches else { return 0 }
        return touches.filter {
            $0.type == .direct
                && ($0.phase == .began || $0.phase == .moved || $0.phase == .stationary)
        }.count
    }

    private func beginMultiTouchGesture() {
        multiTouchGestureInProgress = true
        strokeSuppressed = true
        activeInputFramingFingerprint = nil
        activePoints = []
        predictedPoints = []
        streamlineState = nil
        lastRawPoint = nil
        redraw()
    }

    private func finishMultiTouchGestureIfNeeded(event: UIEvent?) {
        guard activeDirectTouchCount(in: event) == 0 else { return }
        multiTouchGestureInProgress = false
        objectEraseInProgress = false
        objectEraseSnapshotTaken = false
        strokeSuppressed = false
        streamlineState = nil
        lastRawPoint = nil
        activeInputFramingFingerprint = nil
        activePoints = []
        predictedPoints = []
        redraw()
    }

    @discardableResult
    private func cancelStrokeIfPresentationChanged() -> Bool {
        guard activeInputFramingFingerprint != nil else { return false }
        guard state?.continuesDrawingInput(
            from: activeInputFramingFingerprint) != true else { return false }
        strokeSuppressed = true
        objectEraseInProgress = false
        objectEraseSnapshotTaken = false
        activeInputFramingFingerprint = nil
        activePoints = []
        predictedPoints = []
        streamlineState = nil
        lastRawPoint = nil
        redraw()
        return true
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        activeInputFramingFingerprint = nil
        if activeDirectTouchCount(in: event) > 1 {
            beginMultiTouchGesture()
            return
        }
        guard let touch = touches.first else { return }
        guard let inputFingerprint = state?.drawingInputPresentationFingerprint else {
            strokeSuppressed = true
            return
        }
        // Eyedropper armert: plukk farge under fingeren i stedet for å tegne.
        if let state, state.colorPickArmed {
            strokeSuppressed = true
            let location = touch.location(in: self)
            let source = sourcePoint(fromViewportPoint: location)
            let sourceSize = state.contentSize
                ?? CGSize(width: max(1, bounds.width), height: max(1, bounds.height))
            if sourceSize.width > 0, sourceSize.height > 0,
               let hex = renderer?.pickColorHex(
                   normalizedX: source.x / sourceSize.width,
                   normalizedY: source.y / sourceSize.height) {
                state.brushColor = hex
                state.registerRecentColor(hex)
            }
            state.colorPickArmed = false
            return
        }
        // Palm rejection (fullskjerm): finger skal panorere, ikke tegne.
        if pencilOnly && touch.type != .pencil {
            strokeSuppressed = true
            return
        }
        // Objekt-viskelær: slett hele strøk under fingeren, ingen tegning.
        if let state, (state.brushType == .eraser || state.brushType == .vinyl),
           state.eraserObjectMode {
            strokeSuppressed = true
            objectEraseInProgress = true
            activeInputFramingFingerprint = inputFingerprint
            objectErase(at: touch.location(in: self))
            return
        }
        // Låst lag: ingen tegning (web-paritet med lockedLayers).
        if let state, state.lockedLayers.contains(state.activeBoardLayer) {
            strokeSuppressed = true
            return
        }
        strokeSuppressed = false
        activeInputFramingFingerprint = inputFingerprint
        currentInputType = touch.type == .pencil ? "pencil" : "touch"
        strokeStartedAt = Date()
        hoverStampPoint = nil
        let point = strokePoint(from: touch)
        streamlineState = (point.x, point.y)
        lastRawPoint = point
        activePoints = [point]
        predictedPoints = []
        redraw()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard !multiTouchGestureInProgress else { return }
        guard !cancelStrokeIfPresentationChanged() else { return }
        if objectEraseInProgress, let touch = touches.first {
            objectErase(at: touch.location(in: self))
            return
        }
        guard let touch = touches.first, !strokeSuppressed else { return }
        let coalesced = event?.coalescedTouches(for: touch) ?? [touch]
        for sample in coalesced {
            let raw = strokePoint(from: sample, previous: lastRawPoint)
            lastRawPoint = raw
            activePoints.append(smoothed(raw))
        }
        var predictionPrevious = lastRawPoint
        predictedPoints = (event?.predictedTouches(for: touch) ?? []).map { sample in
            let point = strokePoint(from: sample, previous: predictionPrevious)
            predictionPrevious = point
            return point
        }
        redraw()
    }

    override func touchesEstimatedPropertiesUpdated(_ touches: Set<UITouch>) {
        guard !multiTouchGestureInProgress else { return }
        guard !cancelStrokeIfPresentationChanged() else { return }
        guard !strokeSuppressed else { return }
        var changed = false
        for touch in touches {
            guard let updateIndex = touch.estimationUpdateIndex?.intValue,
                  let index = activePoints.lastIndex(where: {
                      $0.estimationUpdateIndex == updateIndex
                  }) else { continue }
            let previous = index > 0 ? activePoints[index - 1] : nil
            let updated = strokePoint(from: touch, previous: previous)
            // Behold den glattede plasseringen. Force/pose/roll er de feltene
            // UIKit vanligvis korrigerer etter den første estimerte samplen.
            activePoints[index].pressure = updated.pressure
            activePoints[index].tiltX = updated.tiltX
            activePoints[index].tiltY = updated.tiltY
            activePoints[index].rollAngle = updated.rollAngle
            activePoints[index].altitudeAngle = updated.altitudeAngle
            activePoints[index].azimuthAngle = updated.azimuthAngle
            activePoints[index].velocity = updated.velocity
            activePoints[index].estimatedProperties = updated.estimatedProperties
            changed = true
        }
        if changed { redraw() }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        if multiTouchGestureInProgress {
            finishMultiTouchGestureIfNeeded(event: event)
            return
        }
        finishStroke()
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        if multiTouchGestureInProgress {
            finishMultiTouchGestureIfNeeded(event: event)
            return
        }
        finishStroke()
    }

    private func finishStroke() {
        _ = cancelStrokeIfPresentationChanged()
        if objectEraseInProgress {
            objectEraseInProgress = false
            objectEraseSnapshotTaken = false
            strokeSuppressed = false
            activeInputFramingFingerprint = nil
            return
        }
        if strokeSuppressed { strokeSuppressed = false; activeInputFramingFingerprint = nil; activePoints = []; predictedPoints = []; return }
        predictedPoints = []
        // Catch-up: streken skal lande der pennen faktisk sluttet.
        if let raw = lastRawPoint, activePoints.count >= 3 {
            activePoints.append(raw)
        }
        streamlineState = nil
        lastRawPoint = nil
        guard let state, let stroke = makeStroke(points: activePoints) else {
            activePoints = []
            activeInputFramingFingerprint = nil
            redraw()
            return
        }
        activePoints = []
        activeInputFramingFingerprint = nil
        state.captureUndo(state.brushType.isProductionStamp ? "Plasser stamp" : "Tegn strøk")
        var finalStroke = stroke
        // Quick-shape (Procreate-vane): hold pennen stille på slutten →
        // strøket snappes til rett linje fra start til holdepunktet.
        if !state.brushType.isProductionStamp,
           let snapped = Self.quickShapeSnap(stroke, brushType: state.brushType) {
            finalStroke = snapped
        }
        if !state.brushType.isProductionStamp, state.perspectiveSnapEnabled,
           let projected = Self.perspectiveSnap(finalStroke,
                                                vanishingPoints: state.perspectiveSnapPoints) {
            finalStroke = projected
        }
        state.strokes.append(finalStroke)
        state.registerRecentColor(state.brushColor)
        state.revision += 1
        renderer?.commitStroke(
            finalStroke, scale: renderScale,
            blendMode: state.layerBlendModes[finalStroke.boardLayer ?? "Drawing"] ?? .normal)
        committedCount = state.strokes.count
        lastRevision = state.revision
        redraw()
    }

    /// Perspektiv-snap (SBP-paritet): peker strøket <10° mot en VP-stråle,
    /// projiseres alle punkter på linjen gjennom startpunktet mot VP-en.
    static func perspectiveSnap(_ stroke: PencilStroke,
                                vanishingPoints: [CGPoint]) -> PencilStroke? {
        guard !vanishingPoints.isEmpty,
              let first = stroke.points.first, let last = stroke.points.last else { return nil }
        let strokeDX = last.x - first.x, strokeDY = last.y - first.y
        let length = hypot(strokeDX, strokeDY)
        guard length > 30 else { return nil }
        var best: (unit: (Double, Double), deviation: Double)?
        for vp in vanishingPoints {
            let toVP = (Double(vp.x) - first.x, Double(vp.y) - first.y)
            let vpLength = hypot(toVP.0, toVP.1)
            guard vpLength > 1 else { continue }
            let unit = (toVP.0 / vpLength, toVP.1 / vpLength)
            // |sin| av vinkelen mellom strøk og stråle (retning likegyldig)
            let cross = abs(strokeDX / length * unit.1 - strokeDY / length * unit.0)
            if best == nil || cross < best!.deviation {
                best = (unit, cross)
            }
        }
        guard let match = best, match.deviation < 0.17 else { return nil } // <~10°
        var snapped = stroke
        snapped.points = snapped.points.map { point in
            var p = point
            let t = (p.x - first.x) * match.unit.0 + (p.y - first.y) * match.unit.1
            p.x = first.x + match.unit.0 * t
            p.y = first.y + match.unit.1 * t
            return p
        }
        return snapped
    }

    /// Hold stille >0,45 s på slutten av et langt strøk → rett linje.
    /// Gjelder tegnepensler (ikke smudge/viskelær).
    static func quickShapeSnap(_ stroke: PencilStroke, brushType: BrushType) -> PencilStroke? {
        guard ![BrushType.smudge, .tortillon, .softfocus, .eraser, .vinyl,
                .kneaded, .lightlift].contains(brushType),
              let first = stroke.points.first, let last = stroke.points.last,
              stroke.points.count > 8 else { return nil }
        // Finn starten av holdet: gå bakover til punkt >8px fra siste.
        var holdStart = last
        for point in stroke.points.reversed() {
            if hypot(point.x - last.x, point.y - last.y) > 8 { break }
            holdStart = point
        }
        guard last.timestamp - holdStart.timestamp > 450 else { return nil }
        let meanPressure = stroke.points.map(\.pressure).reduce(0, +) / Double(stroke.points.count)
        let drawn = stroke.points.filter { $0.timestamp <= holdStart.timestamp }
        func generated(_ coords: [(Double, Double)]) -> PencilStroke {
            let duration = holdStart.timestamp - first.timestamp
            var snapped = stroke
            snapped.points = coords.enumerated().map { index, xy in
                StrokePoint(x: xy.0, y: xy.1, pressure: meanPressure, tiltX: 0, tiltY: 0,
                            timestamp: first.timestamp
                                + duration * Double(index) / Double(max(1, coords.count - 1)))
            }
            return snapped
        }

        // Lukket form (start ≈ slutt av tegnedelen) → ellipse eller rektangel.
        let xs = drawn.map(\.x), ys = drawn.map(\.y)
        if let minX = xs.min(), let maxX = xs.max(),
           let minY = ys.min(), let maxY = ys.max(),
           maxX - minX > 40, maxY - minY > 40,
           hypot(holdStart.x - first.x, holdStart.y - first.y)
               < 0.35 * max(maxX - minX, maxY - minY),
           drawn.count > 12 {
            let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
            let a = max(1, (maxX - minX) / 2), b = max(1, (maxY - minY) / 2)
            // Klassifiser: snittavvik fra enhets-ellipsen vs avstand til
            // bbox-kant — hjørnepunkter avslører rektangel.
            let ellipseError = drawn.map { point in
                abs(hypot((point.x - cx) / a, (point.y - cy) / b) - 1)
            }.reduce(0, +) / Double(drawn.count)
            let rectError = drawn.map { point in
                min(min(abs(point.x - minX), abs(point.x - maxX)),
                    min(abs(point.y - minY), abs(point.y - maxY))) / min(a, b)
            }.reduce(0, +) / Double(drawn.count)
            if ellipseError <= rectError {
                let steps = 48
                return generated((0...steps).map { step in
                    let t = Double(step) / Double(steps) * .pi * 2
                    return (cx + a * cos(t), cy + b * sin(t))
                })
            }
            let corners = [(minX, minY), (maxX, minY), (maxX, maxY), (minX, maxY), (minX, minY)]
            var coords: [(Double, Double)] = []
            for index in 0..<(corners.count - 1) {
                for step in 0..<12 {
                    let t = Double(step) / 12
                    coords.append((corners[index].0 + (corners[index + 1].0 - corners[index].0) * t,
                                   corners[index].1 + (corners[index + 1].1 - corners[index].1) * t))
                }
            }
            coords.append(corners[0])
            return generated(coords)
        }

        // Åpen form → rett linje (som før).
        let lineLength = hypot(holdStart.x - first.x, holdStart.y - first.y)
        guard lineLength > 40 else { return nil }
        let steps = 24
        return generated((0...steps).map { step in
            let t = Double(step) / Double(steps)
            return (first.x + (holdStart.x - first.x) * t,
                    first.y + (holdStart.y - first.y) * t)
        })
    }

    private var lastHiddenLayers: Set<String> = []
    private var lastLayerOpacity: [String: Double] = [:]
    private var lastLayerBlendModes: [String: BoardLayerBlendMode] = [:]
    private var lastLayerOrder: [String] = []
    private var lastRevision = -1
    private var lastBackgroundRevision = -1
    private var lastShotFraming = ShotFramingState.standard

    func syncIfNeeded() {
        guard let state else { return }
        let resizedForFraming = ensureCanvasResolution()
        let needsRebuild = resizedForFraming
                || state.strokes.count != committedCount
                || state.revision != lastRevision
                || state.hiddenLayers != lastHiddenLayers
                || state.layerOpacity != lastLayerOpacity
                || state.layerBlendModes != lastLayerBlendModes
                || state.layerOrder != lastLayerOrder
                || state.backgroundRevision != lastBackgroundRevision
        let presentationFraming = state.renderFraming
        let cameraChanged = presentationFraming != lastShotFraming
        guard needsRebuild || cameraChanged else { return }
        if needsRebuild {
            renderer?.rebuild(strokes: state.visibleStrokes(), scale: renderScale,
                              layerBlendModes: state.layerBlendModes)
            committedCount = state.strokes.count
            lastRevision = state.revision
            lastHiddenLayers = state.hiddenLayers
            lastLayerOpacity = state.layerOpacity
            lastLayerBlendModes = state.layerBlendModes
            lastLayerOrder = state.layerOrder
            lastBackgroundRevision = state.backgroundRevision
        }
        lastShotFraming = presentationFraming
        redraw()
    }

    func redraw() {
        guard let renderer, let drawable = metalLayer.nextDrawable() else { return }
        let active = makeStroke(points: activePoints)
            ?? hoverStampPoint.flatMap { makeStroke(points: [$0], idSuffix: "-hover") }
        // Predicted: fortsettelse av aktivt strøk med Apples predikerte bane.
        let predicted: PencilStroke?
        if state?.brushType.isProductionStamp != true,
           !predictedPoints.isEmpty, let lastActual = activePoints.last {
            predicted = makeStroke(points: [lastActual] + predictedPoints, idSuffix: "-pred")
        } else {
            predicted = nil
        }
        renderer.present(drawable: drawable,
                         activeStroke: active,
                         predictedStroke: predicted,
                         scale: renderScale,
                         framing: state?.renderFraming ?? .standard)
    }
}

struct PencilCanvasView: UIViewRepresentable {
    @ObservedObject var state: CanvasState
    let renderer: MetalStrokeRenderer?
    var pencilOnly = false
    var disableScrollCancel = true

    func makeUIView(context: Context) -> MetalCanvasUIView {
        let view = MetalCanvasUIView(frame: .zero)
        view.renderer = renderer
        view.state = state
        view.pencilOnly = pencilOnly
        view.disableScrollCancel = disableScrollCancel
        return view
    }

    func updateUIView(_ view: MetalCanvasUIView, context: Context) {
        view.pencilOnly = pencilOnly
        // Undo/clear endrer strokes utenfra → full rebuild av akkumulatoren.
        // Egne commits er allerede appendet inkrementelt og hopper over.
        view.syncIfNeeded()
    }
}

// Apple Pencil 2/Pro dobbelttrykk → viskelær ↔ forrige pensel (systemvalg
// respekteres ikke-konfigurerbart her; standard oppførsel).
@available(iOS 17.5, *)
extension MetalCanvasUIView {
    // Pencil Pro squeeze: veksle til forrige pensel (validering krever
    // ekte hardware — sim sender aldri squeeze).
    func pencilInteraction(_ interaction: UIPencilInteraction,
                           didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze) {
        guard squeeze.phase == .ended, let state else { return }
        state.selectBrush(state.previousBrush)
    }
}

extension MetalCanvasUIView: UIPencilInteractionDelegate {
    func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        guard let state else { return }
        if state.brushType == .eraser {
            state.brushType = state.previousBrushBeforeEraser
        } else {
            state.previousBrushBeforeEraser = state.brushType
            state.brushType = .eraser
        }
    }
}

// Fullskjerm-canvas i UIScrollView: ekte pinch-zoom rundt fingrene.
// Under zoom skaleres view-transformen (rask, litt uskarp); ved zoom-slutt
// bakes skalaen inn i canvas-rammen og zoomScale resettes → layoutSubviews
// gir ny drawableSize og skarp re-rendring (contentScale holder
// koordinatrommet korrekt).
struct ZoomablePencilCanvas: UIViewRepresentable {
    @ObservedObject var state: CanvasState
    let renderer: MetalStrokeRenderer?
    let baseSize: CGSize
    var fingerDraws: Bool

    func makeUIView(context: Context) -> UIScrollView {
        let scroll = UIScrollView()
        scroll.minimumZoomScale = 0.4
        scroll.maximumZoomScale = 3
        scroll.delegate = context.coordinator
        scroll.backgroundColor = UIColor(white: 0.13, alpha: 1)
        scroll.contentInsetAdjustmentBehavior = .never
        // Pan kun med finger — Pencil går til canvasen.
        scroll.panGestureRecognizer.allowedTouchTypes = [UITouch.TouchType.direct.rawValue as NSNumber]

        let canvas = MetalCanvasUIView(frame: CGRect(origin: .zero, size: baseSize))
        canvas.renderer = renderer
        canvas.state = state
        canvas.pencilOnly = !fingerDraws
        canvas.disableScrollCancel = false
        canvas.backgroundColor = UIColor(red: 0.992, green: 0.992, blue: 0.984, alpha: 1)
        scroll.addSubview(canvas)
        scroll.contentSize = baseSize
        context.coordinator.canvas = canvas
        return scroll
    }

    func updateUIView(_ scroll: UIScrollView, context: Context) {
        context.coordinator.canvas?.pencilOnly = !fingerDraws
        // «Finger tegner»: scroll av så fingeren når canvasen; pinch-zoom
        // fungerer fortsatt (egen recognizer).
        scroll.isScrollEnabled = !fingerDraws
        scroll.canCancelContentTouches = !fingerDraws
        context.coordinator.canvas?.syncIfNeeded()
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        var canvas: MetalCanvasUIView?

        func viewForZooming(in scrollView: UIScrollView) -> UIView? { canvas }

        func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
            guard let canvas, scale != 1 else { return }
            // Bak skalaen inn i rammen og re-render skarpt.
            let offset = scrollView.contentOffset
            canvas.transform = .identity
            canvas.frame = CGRect(origin: .zero,
                                  size: CGSize(width: canvas.bounds.width * scale,
                                               height: canvas.bounds.height * scale))
            scrollView.zoomScale = 1
            scrollView.contentSize = canvas.frame.size
            scrollView.contentOffset = offset
            canvas.setNeedsLayout()
        }
    }
}
