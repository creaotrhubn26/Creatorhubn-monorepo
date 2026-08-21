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
    // Lagret tegneflate-dimensjon (drawingData.width/height). Satt → strøk
    // holdes i det koordinatrommet (web-paritet); view skalerer ved rendering
    // og inverterer ved input. nil → view-punktrom (Frikanvas).
    @Published var contentSize: CGSize?
    var undoStack: [[PencilStroke]] = []
    var redoStack: [[PencilStroke]] = []
    // Pencil 2-dobbelttrykk: husk forrige pensel for viskelær-toggle.
    var previousBrushBeforeEraser: BrushType = .pencil
    // Bumpes ved ALLE strokes-mutasjoner (også flytt, som ikke endrer antall)
    // — rebuild- og autosynk-trigger.
    @Published var revision = 0
    // Nylige farger (maks 8, persistert).
    @Published var recentColors: [String] =
        UserDefaults.standard.stringArray(forKey: "sb.recentColors") ?? []

    func registerRecentColor(_ hex: String) {
        var colors = recentColors.filter { $0 != hex }
        colors.insert(hex, at: 0)
        recentColors = Array(colors.prefix(8))
        UserDefaults.standard.set(recentColors, forKey: "sb.recentColors")
    }

    // Brush-editor (spec §25/§48-lett): per-økt-overstyringer oppå preset.
    @Published var grainOverride: Double?
    @Published var flowOverride: Double?
    @Published var hardnessOverride: Double?

    /// Velg pensel og sett spec-defaults (størrelse/opacity) for typen —
    /// hvert verktøy skal starte med sin fysiske karakter. Editor-overrides
    /// nullstilles (de gjelder per pensel-økt).
    func selectBrush(_ type: BrushType) {
        brushType = type
        if let defaults = BrushDefaults.sizeAndOpacity(for: type) {
            brushSize = defaults.size
            brushOpacity = defaults.opacity
        }
        grainOverride = nil
        flowOverride = nil
        hardnessOverride = nil
    }

    func currentBrush() -> BrushSpec {
        var brush = BrushSpec.preset(brushType, size: brushSize, color: brushColor, opacity: brushOpacity)
        if let grain = grainOverride { brush.grain = grain }
        if let flow = flowOverride { brush.flow = flow }
        if let hardness = hardnessOverride { brush.hardness = hardness }
        return brush
    }

    func visibleStrokes() -> [PencilStroke] {
        // Lag-sortert som web (stabil sortering på BOARD_LAYERS-indeks).
        // textAnnotation-strøk rendres som tekst-overlay (ikke dabs) — web-paritet.
        // Lag-opacity multipliseres inn i strøk-opacity ved render (som web) —
        // dataene beholdes urørt.
        strokes
            .filter { $0.textAnnotation == nil && !hiddenLayers.contains($0.boardLayer ?? "Drawing") }
            .enumerated()
            .sorted { lhs, rhs in
                let li = BoardLayers.index(of: lhs.element.boardLayer)
                let ri = BoardLayers.index(of: rhs.element.boardLayer)
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

    func undo() {
        guard let previous = undoStack.popLast() else { return }
        redoStack.append(strokes)
        strokes = previous
        revision += 1
    }

    func redo() {
        guard let next = redoStack.popLast() else { return }
        undoStack.append(strokes)
        strokes = next
        revision += 1
    }

    func clear() {
        undoStack.append(strokes)
        redoStack = []
        strokes = []
        revision += 1
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
        guard let size = state?.contentSize, size.width > 0, bounds.width > 0 else { return 1 }
        return Double(bounds.width / size.width)
    }
    // Samlet skala innholdsrom → piksler; brukes mot renderer.
    private var renderScale: Double { displayScale * contentScale }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isMultipleTouchEnabled = false
        isAccessibilityElement = true
        accessibilityIdentifier = "tegneflate"
        metalLayer.pixelFormat = .bgra8Unorm
        metalLayer.framebufferOnly = true
        // Apple Pencil 2 dobbelttrykk: bytt viskelær ↔ forrige pensel.
        let pencilInteraction = UIPencilInteraction()
        pencilInteraction.delegate = self
        addInteraction(pencilInteraction)
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
        if let renderer, renderer.committedTexture?.width != width {
            renderer.resizeCanvas(width: width, height: height)
            renderer.rebuild(strokes: state?.visibleStrokes() ?? [], scale: scale * contentScale)
            redraw()
        }
    }

    private func strokePoint(from touch: UITouch) -> StrokePoint {
        let location = touch.preciseLocation(in: self)
        let pressure = touch.type == .pencil
            ? Double(touch.force / max(touch.maximumPossibleForce, 0.0001))
            : 0.6
        // altitude/azimuth → tiltX/tiltY i GRADER (PointerEvent-konvensjon,
        // samme som web-motoren forventer).
        var tiltX = 0.0, tiltY = 0.0
        if touch.type == .pencil {
            let altitude = Double(touch.altitudeAngle)          // 0 = flat, π/2 = vertikal
            let azimuth = Double(touch.azimuthAngle(in: self))
            let tiltMagnitude = (1 - altitude / (.pi / 2)) * 90 // 0..90 grader
            tiltX = cos(azimuth) * tiltMagnitude
            tiltY = sin(azimuth) * tiltMagnitude
        }
        let inputScale = contentScale
        return StrokePoint(
            x: Double(location.x) / inputScale, y: Double(location.y) / inputScale,
            pressure: max(0.05, min(1, pressure)),
            tiltX: tiltX, tiltY: tiltY,
            timestamp: touch.timestamp * 1000)
    }

    private func makeStroke(points: [StrokePoint], idSuffix: String = "") -> PencilStroke? {
        guard let state, !points.isEmpty else { return nil }
        let brush = state.currentBrush()
        return PencilStroke(
            id: "ipad-\(Int(strokeStartedAt.timeIntervalSince1970 * 1000))\(idSuffix)",
            points: points,
            inputType: currentInputType,
            color: brush.color,
            width: brush.size,
            opacity: brush.opacity,
            brush: brush,
            boardLayer: state.activeBoardLayer)
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

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        // Palm rejection (fullskjerm): finger skal panorere, ikke tegne.
        if pencilOnly && touch.type != .pencil {
            strokeSuppressed = true
            return
        }
        // Låst lag: ingen tegning (web-paritet med lockedLayers).
        if let state, state.lockedLayers.contains(state.activeBoardLayer) {
            strokeSuppressed = true
            return
        }
        strokeSuppressed = false
        currentInputType = touch.type == .pencil ? "pencil" : "touch"
        strokeStartedAt = Date()
        let point = strokePoint(from: touch)
        streamlineState = (point.x, point.y)
        lastRawPoint = point
        activePoints = [point]
        predictedPoints = []
        redraw()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, !strokeSuppressed else { return }
        let coalesced = event?.coalescedTouches(for: touch) ?? [touch]
        for sample in coalesced {
            let raw = strokePoint(from: sample)
            lastRawPoint = raw
            activePoints.append(smoothed(raw))
        }
        predictedPoints = (event?.predictedTouches(for: touch) ?? []).map(strokePoint(from:))
        redraw()
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        finishStroke()
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        finishStroke()
    }

    private func finishStroke() {
        if strokeSuppressed { strokeSuppressed = false; activePoints = []; predictedPoints = []; return }
        predictedPoints = []
        // Catch-up: streken skal lande der pennen faktisk sluttet.
        if let raw = lastRawPoint, activePoints.count >= 3 {
            activePoints.append(raw)
        }
        streamlineState = nil
        lastRawPoint = nil
        guard let state, let stroke = makeStroke(points: activePoints) else {
            activePoints = []
            redraw()
            return
        }
        activePoints = []
        state.undoStack.append(state.strokes)
        state.redoStack = []
        var finalStroke = stroke
        // Quick-shape (Procreate-vane): hold pennen stille på slutten →
        // strøket snappes til rett linje fra start til holdepunktet.
        if let snapped = Self.quickShapeSnap(stroke, brushType: state.brushType) {
            finalStroke = snapped
        }
        state.strokes.append(finalStroke)
        state.registerRecentColor(state.brushColor)
        state.revision += 1
        renderer?.commitStroke(finalStroke, scale: renderScale)
        committedCount = state.strokes.count
        lastRevision = state.revision
        redraw()
    }

    /// Hold stille >0,45 s på slutten av et langt strøk → rett linje.
    /// Gjelder tegnepensler (ikke smudge/viskelær).
    static func quickShapeSnap(_ stroke: PencilStroke, brushType: BrushType) -> PencilStroke? {
        guard brushType != .smudge, brushType != .eraser,
              let first = stroke.points.first, let last = stroke.points.last,
              stroke.points.count > 8 else { return nil }
        // Finn starten av holdet: gå bakover til punkt >8px fra siste.
        var holdStart = last
        for point in stroke.points.reversed() {
            if hypot(point.x - last.x, point.y - last.y) > 8 { break }
            holdStart = point
        }
        guard last.timestamp - holdStart.timestamp > 450 else { return nil }
        let lineLength = hypot(holdStart.x - first.x, holdStart.y - first.y)
        guard lineLength > 40 else { return nil }
        let meanPressure = stroke.points.map(\.pressure).reduce(0, +) / Double(stroke.points.count)
        let steps = 24
        let points = (0...steps).map { step -> StrokePoint in
            let t = Double(step) / Double(steps)
            return StrokePoint(
                x: first.x + (holdStart.x - first.x) * t,
                y: first.y + (holdStart.y - first.y) * t,
                pressure: meanPressure, tiltX: 0, tiltY: 0,
                timestamp: first.timestamp + (holdStart.timestamp - first.timestamp) * t)
        }
        var snapped = stroke
        snapped.points = points
        return snapped
    }

    private var lastHiddenLayers: Set<String> = []
    private var lastLayerOpacity: [String: Double] = [:]
    private var lastRevision = -1

    func syncIfNeeded() {
        guard let state,
              state.strokes.count != committedCount
                || state.revision != lastRevision
                || state.hiddenLayers != lastHiddenLayers
                || state.layerOpacity != lastLayerOpacity
        else { return }
        renderer?.rebuild(strokes: state.visibleStrokes(), scale: renderScale)
        committedCount = state.strokes.count
        lastRevision = state.revision
        lastHiddenLayers = state.hiddenLayers
        lastLayerOpacity = state.layerOpacity
        redraw()
    }

    func redraw() {
        guard let renderer, let drawable = metalLayer.nextDrawable() else { return }
        let active = makeStroke(points: activePoints)
        // Predicted: fortsettelse av aktivt strøk med Apples predikerte bane.
        let predicted: PencilStroke?
        if !predictedPoints.isEmpty, let lastActual = activePoints.last {
            predicted = makeStroke(points: [lastActual] + predictedPoints, idSuffix: "-pred")
        } else {
            predicted = nil
        }
        renderer.present(drawable: drawable,
                         activeStroke: active,
                         predictedStroke: predicted,
                         scale: renderScale)
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
