import SwiftUI
import PencilKit
import UIKit

/// Apple Pencil-first signature canvas. Drop this into any flow that
/// needs a handwritten signature — contract signing (task #59),
/// quote approval (task #62), future invoice sign-offs.
///
/// The view is modal-shaped (full-sheet) because signatures are a
/// discrete interaction: you open it, write, commit. It returns a
/// completed ``SignatureCapture`` via the ``onFinish`` callback and
/// dismisses itself. The caller decides what to do with the result
/// — persist via ``SignatureStorage``, stamp into a PDF, send to
/// the backend, etc.
///
/// Constraints:
///   * Canvas is fixed aspect ratio 3:1 so signatures look natural
///     and can be stamped onto a typical signature line.
///   * Ink colour is ``.label`` (system primary) so light/dark mode
///     both work out of the box.
///   * Clear + Undo + Done actions in the toolbar.
///   * Background is ``tertiarySystemBackground`` so the signature
///     visually sits on a "card" rather than floating against the
///     surrounding view.
struct SignatureCanvasView: View {
    let title: String
    let prompt: String?
    let onFinish: (SignatureCapture?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var canvasView = {
        let c = PKCanvasView()
        c.drawingPolicy = .anyInput
        c.backgroundColor = .clear
        c.tool = PKInkingTool(.pen, color: .label, width: 3)
        return c
    }()
    @State private var hasInk = false

    init(
        title: String = "Signatur",
        prompt: String? = nil,
        onFinish: @escaping (SignatureCapture?) -> Void,
    ) {
        self.title = title
        self.prompt = prompt
        self.onFinish = onFinish
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                if let prompt {
                    Text(prompt)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                canvasCard

                signatureHintBar

                Spacer()
            }
            .padding()
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
                        canvasView.undoManager?.undo()
                        hasInk = !canvasView.drawing.bounds.isEmpty
                    } label: {
                        Image(systemName: "arrow.uturn.backward")
                    }
                    .disabled(!hasInk)

                    Button(role: .destructive) {
                        canvasView.drawing = PKDrawing()
                        hasInk = false
                    } label: {
                        Image(systemName: "trash")
                    }
                    .disabled(!hasInk)

                    Button("Ferdig") {
                        commit()
                    }
                    .disabled(!hasInk)
                }
            }
        }
    }

    // MARK: - Subviews

    private var canvasCard: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let height = width / 3.0
            ZStack(alignment: .bottomLeading) {
                // Signature "line" — slim divider near the bottom.
                // Gives the user a cue for where to sign without
                // forcing the ink onto it.
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(uiColor: .tertiarySystemBackground))
                Rectangle()
                    .fill(Color.secondary.opacity(0.35))
                    .frame(height: 1)
                    .padding(.bottom, 36)
                    .padding(.horizontal, 24)
                Text("× Signer her")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .padding(.bottom, 18)
                    .padding(.horizontal, 28)

                PencilCanvasRepresentable(
                    canvas: $canvasView,
                    onChange: { hasInk = !canvasView.drawing.bounds.isEmpty },
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .frame(width: width, height: height)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(3.0, contentMode: .fit)
    }

    private var signatureHintBar: some View {
        HStack(spacing: 6) {
            Image(systemName: "pencil.tip")
                .foregroundStyle(.tertiary)
            Text("Bruk Apple Pencil eller finger. Undo + slett er tilgjengelig øverst til høyre.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }

    // MARK: - Commit

    private func commit() {
        let drawing = canvasView.drawing
        if drawing.bounds.isEmpty {
            onFinish(nil)
            dismiss()
            return
        }

        // Render PNG at 2x so stamping onto a PDF survives retina
        // inspection. Background stays transparent so the signature
        // overlays cleanly onto the PDF's own signature line.
        let image = drawing.image(from: drawing.bounds, scale: 2.0)
        guard let png = image.pngData() else {
            onFinish(nil)
            dismiss()
            return
        }

        let capture = SignatureCapture(
            drawingData: drawing.dataRepresentation(),
            pngData: png,
            bounds: drawing.bounds,
            capturedAt: Date(),
        )
        onFinish(capture)
        dismiss()
    }
}

/// Thin UIViewRepresentable over ``PKCanvasView``. Exposes the
/// canvas as an external binding so the parent view can trigger
/// undo / clear / read drawing bounds without re-creating the view.
private struct PencilCanvasRepresentable: UIViewRepresentable {
    @Binding var canvas: PKCanvasView
    var onChange: () -> Void = {}

    func makeUIView(context: Context) -> PKCanvasView {
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
