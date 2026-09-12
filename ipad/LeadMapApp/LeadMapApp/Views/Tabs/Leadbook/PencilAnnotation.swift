// PencilAnnotation.swift — Apple Pencil-annotering på Eksempler (2026-06-30)
//
// PKCanvasView wrapped i UIViewRepresentable + flytende verktøyrad.
// Tegninger lagres som PKDrawing-data per eksempel (kan persisteres til backend).

import SwiftUI
import PencilKit

// MARK: - Kanvas-wrapper

struct PencilAnnotationCanvas: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    @Binding var tool: PKTool
    /// Hvis true: tillat finger + Pencil. Hvis false: bare Pencil.
    var allowFinger: Bool = true
    /// Hvis true: bakgrunn er klar (transparent overlay).
    var transparentBackground: Bool = true

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawing = drawing
        canvas.tool = tool
        canvas.drawingPolicy = allowFinger ? .anyInput : .pencilOnly
        canvas.backgroundColor = transparentBackground ? .clear : .black
        canvas.isOpaque = !transparentBackground
        canvas.delegate = context.coordinator
        canvas.minimumZoomScale = 1
        canvas.maximumZoomScale = 1
        canvas.alwaysBounceVertical = false
        canvas.alwaysBounceHorizontal = false
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        if canvas.drawing != drawing { canvas.drawing = drawing }
        canvas.tool = tool
        canvas.drawingPolicy = allowFinger ? .anyInput : .pencilOnly
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: PencilAnnotationCanvas
        init(_ p: PencilAnnotationCanvas) { self.parent = p }
        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            DispatchQueue.main.async {
                self.parent.drawing = canvasView.drawing
            }
        }
    }
}

// MARK: - Verktøyrad

struct PencilToolbar: View {
    @Binding var tool: PKTool
    @Binding var drawing: PKDrawing
    @Binding var allowFinger: Bool
    var onClose: () -> Void
    var onExport: () -> Void
    var onSave: () -> Void

    @State private var inkType: PKInkingTool.InkType = .pen
    @State private var color: UIColor = UIColor(red: 0.75, green: 0.45, blue: 1.0, alpha: 1.0)
    @State private var width: CGFloat = 4
    @State private var mode: Mode = .ink

    enum Mode { case ink, marker, pencil, eraser, lasso }

    private let palette: [UIColor] = [
        UIColor(red: 0.75, green: 0.45, blue: 1.0, alpha: 1.0),  // purple
        UIColor(red: 0.98, green: 0.35, blue: 0.65, alpha: 1.0), // pink
        UIColor(red: 0.34, green: 0.60, blue: 0.98, alpha: 1.0), // blue
        UIColor(red: 0.20, green: 0.85, blue: 0.60, alpha: 1.0), // green
        UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 1.0), // yellow
        UIColor(red: 0.98, green: 0.55, blue: 0.10, alpha: 1.0), // orange
        UIColor(red: 0.95, green: 0.20, blue: 0.20, alpha: 1.0), // red
        .white
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                // Inking-typer
                toolButton(icon: "pencil.tip", label: "Penn", active: mode == .ink) {
                    mode = .ink; inkType = .pen; applyInking()
                }
                toolButton(icon: "highlighter", label: "Marker", active: mode == .marker) {
                    mode = .marker; inkType = .marker; applyInking()
                }
                toolButton(icon: "pencil", label: "Blyant", active: mode == .pencil) {
                    mode = .pencil; inkType = .pencil; applyInking()
                }
                Divider().background(LBrand.stroke).frame(height: 28)
                toolButton(icon: "eraser.fill", label: "Visk", active: mode == .eraser) {
                    mode = .eraser
                    tool = PKEraserTool(.bitmap)
                }
                toolButton(icon: "lasso", label: "Lasso", active: mode == .lasso) {
                    mode = .lasso
                    tool = PKLassoTool()
                }
                Divider().background(LBrand.stroke).frame(height: 28)

                // Farger
                HStack(spacing: 5) {
                    ForEach(palette.indices, id: \.self) { i in
                        let c = palette[i]
                        Button {
                            color = c
                            if mode == .ink || mode == .marker || mode == .pencil { applyInking() }
                        } label: {
                            Circle()
                                .fill(Color(uiColor: c))
                                .frame(width: 22, height: 22)
                                .overlay(
                                    Circle().stroke(
                                        sameColor(c, color) ? .white : Color.clear,
                                        lineWidth: 2
                                    )
                                )
                                .overlay(
                                    Circle().stroke(.black.opacity(0.4), lineWidth: 1)
                                )
                        }.buttonStyle(.plain)
                    }
                }

                Divider().background(LBrand.stroke).frame(height: 28)

                // Strektykkelse-stepper
                HStack(spacing: 6) {
                    Image(systemName: "scribble").font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(LBrand.textTertiary)
                    Slider(value: Binding(
                        get: { Double(width) },
                        set: { width = CGFloat($0); applyInking() }
                    ), in: 1...20)
                    .tint(LBrand.purpleLight)
                    .frame(width: 90)
                    Text("\(Int(width))")
                        .font(.appScaled(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white)
                        .frame(width: 18)
                }

                Spacer()

                // Pencil-only toggle
                Button { allowFinger.toggle() } label: {
                    HStack(spacing: 4) {
                        Image(systemName: allowFinger ? "hand.draw.fill" : "hand.raised.fill")
                            .font(.appScaled(size: 11, weight: .bold))
                        Text(allowFinger ? "Finger + Pencil" : "Bare Pencil")
                            .font(.appScaled(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(allowFinger ? LBrand.green : LBrand.purpleLight)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(LBrand.cardHi, in: Capsule())
                    .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)

                Button { drawing = PKDrawing() } label: {
                    Image(systemName: "trash.fill")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(LBrand.red)
                        .frame(width: 32, height: 28)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 7))
                }.buttonStyle(.plain)

                Button(action: onExport) {
                    HStack(spacing: 5) {
                        Image(systemName: "square.and.arrow.up").font(.appScaled(size: 11, weight: .bold))
                        Text("PDF").font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(LBrand.cardHi, in: Capsule())
                    .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)

                Button(action: onSave) {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark").font(.appScaled(size: 11, weight: .bold))
                        Text("Lagre").font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }.buttonStyle(.plain)

                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(LBrand.textSecondary)
                        .frame(width: 28, height: 28)
                        .background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(.black.opacity(0.85))
            .overlay(
                Rectangle().fill(LBrand.purple.opacity(0.4)).frame(height: 1),
                alignment: .top
            )
        }
        .onAppear { applyInking() }
    }

    private func applyInking() {
        let t = PKInkingTool(inkType, color: color, width: width)
        tool = t
    }

    private func sameColor(_ a: UIColor, _ b: UIColor) -> Bool {
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        b.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        return abs(ar - br) < 0.05 && abs(ag - bg) < 0.05 && abs(ab - bb) < 0.05
    }

    private func toolButton(icon: String, label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 1) {
                Image(systemName: icon).font(.appScaled(size: 14, weight: .bold))
                Text(label).font(.appScaled(size: 8, weight: .black)).tracking(0.4)
            }
            .foregroundStyle(active ? .white : LBrand.textSecondary)
            .frame(width: 40, height: 36)
            .background(active ? LBrand.purple.opacity(0.32) : LBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? LBrand.purple.opacity(0.55) : LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - PDF-eksport-utility

enum PencilExporter {
    /// Rendrer en gitt SwiftUI-view + drawing-overlay til en PDF.
    /// Vi flater til et UIImage og pakker i en PDF-side.
    @MainActor
    static func exportPDF(snapshot: UIImage, drawing: PKDrawing, size: CGSize) -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size))
        return renderer.pdfData { ctx in
            ctx.beginPage()
            snapshot.draw(in: CGRect(origin: .zero, size: size))
            // Tegn-laget
            let drawingImage = drawing.image(from: CGRect(origin: .zero, size: size), scale: UIScreen.main.scale)
            drawingImage.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
