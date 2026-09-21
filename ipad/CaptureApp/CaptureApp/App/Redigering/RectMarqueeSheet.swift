import SwiftUI

// MARK: - Rectangle marquee (shared by Beskjær + Masker)

/// Draw a rectangle over the fitted image and return it in normalised image
/// coordinates (origin top-left, 0…1). Used for crop and for marking a region
/// to inpaint.
struct RectMarqueeSheet: View {
    let imagePath: String
    let title: String
    let applyLabel: String
    let initialRect: CGRect?
    let allowReset: Bool
    let onReset: () -> Void
    let onApply: (CGRect) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var startPoint: CGPoint?
    @State private var currentRect: CGRect?   // in container coords

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                let image = UIImage(contentsOfFile: imagePath)
                let fitted = fittedRect(image: image?.size ?? .zero, in: geo.size)
                ZStack {
                    CHTheme.bg
                    if let image {
                        Image(uiImage: image).resizable().scaledToFit()
                    }
                    if let r = displayRect(in: fitted) {
                        Rectangle().path(in: r).stroke(CHTheme.accent, lineWidth: 2)
                        Rectangle().path(in: r).fill(CHTheme.accent.opacity(0.12))
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Beskjæringslerret")
                .accessibilityIdentifier("redigering-crop-canvas")
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 4)
                        .onChanged { v in
                            let s = startPoint ?? v.startLocation
                            startPoint = s
                            let r = CGRect(x: min(s.x, v.location.x), y: min(s.y, v.location.y),
                                           width: abs(v.location.x - s.x), height: abs(v.location.y - s.y))
                                .intersection(fitted)
                            currentRect = r
                            if fitted.width > 0, fitted.height > 0 {
                                normalized = CGRect(x: (r.minX - fitted.minX) / fitted.width,
                                                    y: (r.minY - fitted.minY) / fitted.height,
                                                    width: r.width / fitted.width,
                                                    height: r.height / fitted.height)
                            }
                        }
                        .onEnded { _ in startPoint = nil }
                )
            }
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(applyLabel) { apply() }.disabled(currentRect == nil || (currentRect?.width ?? 0) < 8)
                }
                if allowReset {
                    ToolbarItem(placement: .bottomBar) {
                        Button("Tilbakestill", role: .destructive) { onReset(); dismiss() }
                    }
                }
            }
        }
        .chBranded()
    }

    private func fittedRect(image: CGSize, in container: CGSize) -> CGRect {
        guard image.width > 0, image.height > 0 else { return CGRect(origin: .zero, size: container) }
        let scale = min(container.width / image.width, container.height / image.height)
        let w = image.width * scale, h = image.height * scale
        return CGRect(x: (container.width - w) / 2, y: (container.height - h) / 2, width: w, height: h)
    }

    private func displayRect(in fitted: CGRect) -> CGRect? {
        if let currentRect { return currentRect }
        if let initialRect {
            return CGRect(x: fitted.minX + initialRect.minX * fitted.width,
                          y: fitted.minY + initialRect.minY * fitted.height,
                          width: initialRect.width * fitted.width, height: initialRect.height * fitted.height)
        }
        return nil
    }

    private func apply() {
        guard let norm = normalized else { return }
        onApply(norm.intersection(CGRect(x: 0, y: 0, width: 1, height: 1)))
        dismiss()
    }

    /// Normalised rect (0…1, image space) computed live during the drag.
    @State private var normalized: CGRect?
}

// MARK: - Freehand retouch brush

struct NormalizedBrushStroke: Sendable {
    var points: [CGPoint]
}

/// Freehand removal mask. SwiftUI's drag input also receives Apple Pencil
/// events, while the normalized path keeps the mask independent of screen size
/// and lets the backend work against the source pixel dimensions.
struct RetouchBrushSheet: View {
    let imagePath: String
    let onApply: ([NormalizedBrushStroke], CGFloat) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var strokes: [NormalizedBrushStroke] = []
    @State private var active: [CGPoint] = []
    /// Diameter as a fraction of the image's shortest edge.
    @State private var brushDiameter: CGFloat = 0.025

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                GeometryReader { geo in
                    let image = UIImage(contentsOfFile: imagePath)
                    let fitted = fittedRect(image: image?.size ?? .zero, in: geo.size)
                    ZStack {
                        CHTheme.bg
                        if let image { Image(uiImage: image).resizable().scaledToFit() }
                        Canvas { context, _ in
                            for stroke in strokes + (active.isEmpty ? [] : [.init(points: active)]) {
                                draw(stroke, in: fitted, context: &context)
                            }
                        }
                        .allowsHitTesting(false)
                    }
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                guard fitted.contains(value.location), fitted.width > 0, fitted.height > 0 else { return }
                                let p = CGPoint(
                                    x: (value.location.x - fitted.minX) / fitted.width,
                                    y: (value.location.y - fitted.minY) / fitted.height
                                )
                                if active.isEmpty || distance(active.last!, p) > 0.002 { active.append(p) }
                            }
                            .onEnded { _ in
                                if !active.isEmpty { strokes.append(.init(points: active)); active = [] }
                            }
                    )
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Retusjeringspensel")
                    .accessibilityHint("Tegn over området som skal fjernes")
                }
                HStack(spacing: 12) {
                    Image(systemName: "smallcircle.filled.circle")
                    Slider(value: $brushDiameter, in: 0.008...0.09).tint(CHTheme.accent)
                    Image(systemName: "largecircle.fill.circle")
                    Button("Angre strøk") { if !strokes.isEmpty { strokes.removeLast() } }
                        .disabled(strokes.isEmpty)
                }
                .font(.caption)
                .foregroundStyle(CHTheme.textSecondary)
                .padding(14)
                .background(CHTheme.surface)
            }
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Retusjeringspensel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fjern markert") {
                        onApply(strokes, brushDiameter)
                        dismiss()
                    }
                    .disabled(strokes.isEmpty)
                }
            }
        }
        .chBranded()
    }

    private func draw(_ stroke: NormalizedBrushStroke, in fitted: CGRect, context: inout GraphicsContext) {
        guard let first = stroke.points.first else { return }
        var path = Path()
        path.move(to: canvasPoint(first, fitted))
        if stroke.points.count == 1 {
            path.addLine(to: canvasPoint(CGPoint(x: first.x + 0.0001, y: first.y), fitted))
        } else {
            for point in stroke.points.dropFirst() { path.addLine(to: canvasPoint(point, fitted)) }
        }
        context.stroke(
            path,
            with: .color(CHTheme.accent.opacity(0.82)),
            style: StrokeStyle(
                lineWidth: brushDiameter * min(fitted.width, fitted.height),
                lineCap: .round,
                lineJoin: .round
            )
        )
    }

    private func canvasPoint(_ point: CGPoint, _ fitted: CGRect) -> CGPoint {
        CGPoint(x: fitted.minX + point.x * fitted.width, y: fitted.minY + point.y * fitted.height)
    }

    private func fittedRect(image: CGSize, in container: CGSize) -> CGRect {
        guard image.width > 0, image.height > 0 else { return CGRect(origin: .zero, size: container) }
        let scale = min(container.width / image.width, container.height / image.height)
        let size = CGSize(width: image.width * scale, height: image.height * scale)
        return CGRect(x: (container.width - size.width) / 2,
                      y: (container.height - size.height) / 2,
                      width: size.width, height: size.height)
    }

    private func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        hypot(a.x - b.x, a.y - b.y)
    }
}
