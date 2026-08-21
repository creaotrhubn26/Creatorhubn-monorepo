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
    // Board Pro-lag: nye strøk tagges med aktivt lag; skjulte lag filtreres
    // fra rendering (web-paritet — dataene beholdes urørt).
    @Published var activeBoardLayer = "Drawing"
    @Published var hiddenLayers: Set<String> = []
    // Lagret tegneflate-dimensjon (drawingData.width/height). Satt → strøk
    // holdes i det koordinatrommet (web-paritet); view skalerer ved rendering
    // og inverterer ved input. nil → view-punktrom (Frikanvas).
    @Published var contentSize: CGSize?
    var undoStack: [[PencilStroke]] = []
    var redoStack: [[PencilStroke]] = []

    func currentBrush() -> BrushSpec {
        BrushSpec.preset(brushType, size: brushSize, color: brushColor, opacity: brushOpacity)
    }

    func visibleStrokes() -> [PencilStroke] {
        // Lag-sortert som web (stabil sortering på BOARD_LAYERS-indeks).
        strokes
            .filter { !hiddenLayers.contains($0.boardLayer ?? "Drawing") }
            .enumerated()
            .sorted { lhs, rhs in
                let li = BoardLayers.index(of: lhs.element.boardLayer)
                let ri = BoardLayers.index(of: rhs.element.boardLayer)
                return li == ri ? lhs.offset < rhs.offset : li < ri
            }
            .map(\.element)
    }

    func undo() {
        guard let previous = undoStack.popLast() else { return }
        redoStack.append(strokes)
        strokes = previous
    }

    func redo() {
        guard let next = redoStack.popLast() else { return }
        undoStack.append(strokes)
        strokes = next
    }

    func clear() {
        undoStack.append(strokes)
        redoStack = []
        strokes = []
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
        metalLayer.pixelFormat = .bgra8Unorm
        metalLayer.framebufferOnly = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }

    // Inne i SwiftUI ScrollView (native Board) kansellerer UIScrollView
    // content-touches — tegnestrøk dør. Slå av cancel/delay i alle
    // forfedre-scrollviews så canvasen eier sine touches.
    override func didMoveToWindow() {
        super.didMoveToWindow()
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
            inputType: "pencil",
            color: brush.color,
            width: brush.size,
            opacity: brush.opacity,
            brush: brush,
            boardLayer: state.activeBoardLayer)
    }

    private func smoothed(_ point: StrokePoint) -> StrokePoint {
        let amount = Streamline.amount(for: state?.brushType ?? .pencil)
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

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        strokeStartedAt = Date()
        let point = strokePoint(from: touch)
        streamlineState = (point.x, point.y)
        lastRawPoint = point
        activePoints = [point]
        predictedPoints = []
        redraw()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
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
        state.strokes.append(stroke)
        renderer?.commitStroke(stroke, scale: renderScale)
        committedCount = state.strokes.count
        redraw()
    }

    private var lastHiddenLayers: Set<String> = []

    func syncIfNeeded() {
        guard let state,
              state.strokes.count != committedCount || state.hiddenLayers != lastHiddenLayers
        else { return }
        renderer?.rebuild(strokes: state.visibleStrokes(), scale: renderScale)
        committedCount = state.strokes.count
        lastHiddenLayers = state.hiddenLayers
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

    func makeUIView(context: Context) -> MetalCanvasUIView {
        let view = MetalCanvasUIView(frame: .zero)
        view.renderer = renderer
        view.state = state
        return view
    }

    func updateUIView(_ view: MetalCanvasUIView, context: Context) {
        // Undo/clear endrer strokes utenfra → full rebuild av akkumulatoren.
        // Egne commits er allerede appendet inkrementelt og hopper over.
        view.syncIfNeeded()
    }
}
