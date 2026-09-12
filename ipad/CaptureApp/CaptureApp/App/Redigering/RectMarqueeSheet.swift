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
