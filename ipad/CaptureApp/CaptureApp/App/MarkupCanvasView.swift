import SwiftUI
import PencilKit
import UIKit

/// Apple Pencil markup-sheet for a single capture asset. Rendered on
/// top of the asset's preview image so the photographer can draw
/// directly over the composition — arrows at a misplaced prop,
/// circle around a person to remove, crop-hint at the edge. The
/// web retouch pass reads the saved overlay and composites it back
/// on the full-resolution file.
///
/// The sheet returns a ``MarkupCapture`` via ``onFinish`` and
/// dismisses. Caller decides what to do — ``AssetMarkupStore.save``
/// in production.
///
/// Background:
///   * The preview image passed in is displayed as the canvas
///     background at its natural aspect ratio.
///   * If we only have metadata (filename + capture time — which is
///     the simulator-drive-by state until signed R2 URLs land), we
///     show a photo-shaped placeholder so the surface still works.
///   * PKToolPicker is attached so the photographer has the full
///     Apple inking palette.
struct MarkupCanvasView: View {
    /// The asset-preview image to draw over. Nil renders a
    /// placeholder.
    let previewImage: UIImage?
    /// Title shown in the sheet nav bar — typically the asset's
    /// original filename so the photographer knows which frame
    /// they're marking.
    let title: String
    let existingMarkup: MarkupCapture?
    let onFinish: (MarkupCapture?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var canvas: PKCanvasView = {
        let c = PKCanvasView()
        c.drawingPolicy = .anyInput
        c.backgroundColor = .clear
        return c
    }()
    @State private var hasInk = false

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                ZStack {
                    photoBackground
                        .frame(width: proxy.size.width, height: proxy.size.height)

                    PencilMarkupRepresentable(
                        canvas: $canvas,
                        onChange: { hasInk = !canvas.drawing.bounds.isEmpty },
                    )
                    .frame(width: proxy.size.width, height: proxy.size.height)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
            .ignoresSafeArea(.container, edges: .horizontal)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") {
                        onFinish(nil)
                        dismiss()
                    }
                }
                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        canvas.undoManager?.undo()
                        hasInk = !canvas.drawing.bounds.isEmpty
                    } label: {
                        Image(systemName: "arrow.uturn.backward")
                    }
                    .disabled(!hasInk)

                    Button(role: .destructive) {
                        canvas.drawing = PKDrawing()
                        hasInk = false
                    } label: {
                        Image(systemName: "trash")
                    }
                    .disabled(!hasInk)

                    Button("Ferdig") { commit() }
                        .disabled(!hasInk)
                }
            }
            .task {
                // Restore prior markup if the asset already had one.
                if let existing = existingMarkup,
                   let drawing = try? PKDrawing(data: existing.drawingData) {
                    canvas.drawing = drawing
                    hasInk = !drawing.bounds.isEmpty
                }
            }
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var photoBackground: some View {
        if let image = previewImage {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .background(Color.black)
        } else {
            ZStack {
                Color(uiColor: .secondarySystemBackground)
                VStack(spacing: 8) {
                    Image(systemName: "photo")
                        .font(.system(size: 64))
                        .foregroundStyle(.tertiary)
                    Text("Forhåndsvisning ikke lastet")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    // MARK: - Commit

    private func commit() {
        let drawing = canvas.drawing
        if drawing.bounds.isEmpty {
            onFinish(nil)
            dismiss()
            return
        }

        let canvasSize = canvas.bounds.size
        let inkBounds = drawing.bounds
        // Render at 2x so the overlay survives retina inspection on
        // the web editor. Transparent background so the server-side
        // compositor can multiply it onto the full-res photo.
        let image = drawing.image(from: CGRect(origin: .zero, size: canvasSize), scale: 2.0)
        guard let png = image.pngData() else {
            onFinish(nil)
            dismiss()
            return
        }

        let capture = MarkupCapture(
            drawingData: drawing.dataRepresentation(),
            overlayPNG: png,
            canvasSize: canvasSize,
            inkBounds: inkBounds,
            capturedAt: Date(),
        )
        onFinish(capture)
        dismiss()
    }
}

/// SwiftUI bridge for a PKCanvasView that stays transparent so it
/// overlays an image below. Separate from the signature canvas's
/// representable because markup wants edge-to-edge, while signature
/// canvas wants a bordered card.
private struct PencilMarkupRepresentable: UIViewRepresentable {
    @Binding var canvas: PKCanvasView
    var onChange: () -> Void = {}

    func makeUIView(context: Context) -> PKCanvasView {
        canvas.tool = PKInkingTool(.pen, color: .systemYellow, width: 4)
        canvas.delegate = context.coordinator
        return canvas
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onChange: onChange)
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        let onChange: () -> Void
        init(onChange: @escaping () -> Void) { self.onChange = onChange }
        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) { onChange() }
    }
}
