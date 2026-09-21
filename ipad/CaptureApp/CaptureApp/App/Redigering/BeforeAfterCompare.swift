import SwiftUI
import CoreImage

// MARK: - Before/After compare

enum RedigeringComparisonMode: CaseIterable {
    case split
    case before
    case after

    var label: String {
        switch self {
        case .split: "Delt"
        case .before: "Før"
        case .after: "Etter"
        }
    }

    mutating func advance() {
        switch self {
        case .split: self = .before
        case .before: self = .after
        case .after: self = .split
        }
    }
}

struct BeforeAfterCompare: View {
    let beforePath: String?
    /// Samme normaliserte crop som er brukt på `after`. Før og etter må ha
    /// identisk geometri; ellers sammenligner deleren ulike bildepartier.
    let beforeCrop: CGRect?
    let after: UIImage?
    let rendering: Bool
    @Binding var zoom: CGFloat
    let comparisonMode: RedigeringComparisonMode
    var showHistogram: Bool = false
    var maskOverlay: UIImage?
    var diffOverlay: UIImage?
    var faceDots: [CGRect] = []          // normaliserte CI-rekter (origo nede-venstre)
    var activeFace: Int?
    var onTapFace: (Int) -> Void = { _ in }
    @State private var split: CGFloat = 0.5
    @State private var holdingOriginal = false
    @GestureState private var pinch: CGFloat = 1
    /// «Før»-bildet dekodes ÉN gang (i .task) — ikke i body ved hver drag-frame.
    @State private var beforeImage: UIImage?

    var body: some View {
        GeometryReader { geo in
            // «Før» (original) = VENSTRE, «Etter» (resultat) = HØYRE — matcher
            // etikettene. `after` avsløres til HØYRE for deleren. Hold-for-original
            // → skjul Etter helt (deler helt til høyre → kun original synlig).
            let effSplit: CGFloat = {
                if holdingOriginal { return 1 }
                switch comparisonMode {
                case .split: return split
                case .before: return 1
                case .after: return 0
                }
            }()
            let imageRect = fittedImageRect(in: geo.size)
            ZStack(alignment: .topLeading) {
                Color.black
                if let before = beforeImage {
                    Image(uiImage: before).resizable().scaledToFit()
                        .frame(width: geo.size.width, height: geo.size.height)
                    Color.clear
                        .frame(width: 1, height: 1)
                        .accessibilityElement()
                        .accessibilityIdentifier("redigering-image-loaded")
                        .accessibilityLabel("Redigeringsbildet er lastet")
                }
                if let after {
                    Image(uiImage: after).resizable().scaledToFit()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .mask(alignment: .trailing) {
                            Rectangle().frame(width: geo.size.width * (1 - effSplit))
                        }
                }
                if let maskOverlay {
                    Image(uiImage: maskOverlay).resizable().scaledToFit()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .opacity(0.4).allowsHitTesting(false)
                }
                if let diffOverlay {
                    Image(uiImage: diffOverlay).resizable().scaledToFit()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .opacity(0.7).allowsHitTesting(false)
                }
                // Tappbare ansikts-prikker (lokal justering). CI-koord (nede-
                // venstre) → SwiftUI (topp-venstre): flipp Y.
                ForEach(faceDots.indices, id: \.self) { i in
                    let r = faceDots[i]
                    let cx = imageRect.minX + r.midX * imageRect.width
                    let cy = imageRect.minY + (1 - r.midY) * imageRect.height
                    Circle()
                        .stroke(activeFace == i ? CHTheme.accent : .white, lineWidth: activeFace == i ? 3 : 2)
                        .background(Circle().fill((activeFace == i ? CHTheme.accent : .black).opacity(0.35)))
                        .frame(width: 30, height: 30)
                        .overlay(Text("\(i + 1)").font(.caption.weight(.bold)).foregroundStyle(.white))
                        .position(x: cx, y: cy)
                        .onTapGesture { onTapFace(i) }
                }
                labels
                if !holdingOriginal, comparisonMode == .split { handle(in: geo) }
                if showHistogram, let after {
                    HistogramOverlay(image: after)
                        .frame(height: 84).padding(10)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                }
                if rendering {
                    ProgressView().padding(8).background(.black.opacity(0.4), in: Circle())
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .scaleEffect(max(1, zoom * pinch))
            .contentShape(Rectangle())
            .gesture(DragGesture().onChanged { v in
                guard comparisonMode == .split else { return }
                split = min(1, max(0, v.location.x / geo.size.width))
            })
            .simultaneousGesture(
                MagnificationGesture()
                    .updating($pinch) { value, state, _ in state = value }
                    .onEnded { value in zoom = min(4, max(1, zoom * value)) }
            )
        }
        .task(id: beforeLoadKey) {
            let path = beforePath
            let crop = beforeCrop
            beforeImage = await Task.detached(priority: .userInitiated) {
                guard let image = path.flatMap({ UIImage(contentsOfFile: $0) }) else { return nil }
                return crop.map { RedigeringPipeline.cropped(image, to: $0) } ?? image
            }.value
            split = 0.5
        }
    }

    private var beforeLoadKey: String {
        guard let crop = beforeCrop else { return "\(beforePath ?? "")|full" }
        return "\(beforePath ?? "")|\(crop.origin.x),\(crop.origin.y),\(crop.width),\(crop.height)"
    }

    private func fittedImageRect(in container: CGSize) -> CGRect {
        guard let image = beforeImage, image.size.width > 0, image.size.height > 0 else {
            return CGRect(origin: .zero, size: container)
        }
        let scale = min(container.width / image.size.width, container.height / image.size.height)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        return CGRect(
            x: (container.width - size.width) / 2,
            y: (container.height - size.height) / 2,
            width: size.width,
            height: size.height
        )
    }

    private var labels: some View {
        VStack {
            Group {
                if comparisonMode == .split, !holdingOriginal {
                    HStack {
                        tag("Før"); Spacer()
                        holdButton
                        Spacer()
                        tag("Etter")
                    }
                } else {
                    HStack {
                        tag(holdingOriginal || comparisonMode == .before ? "Original" : "Etter")
                        Spacer()
                        holdButton
                    }
                }
            }
            .padding(10)
            Spacer()
        }
    }

    /// Trykk-og-hold for å se originalen (rå sammenligning).
    private var holdButton: some View {
        Text("Hold for original")
            .font(.caption2.weight(.semibold)).foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(.black.opacity(holdingOriginal ? 0.55 : 0.3), in: Capsule())
            .overlay(Capsule().stroke(.white.opacity(0.25)))
            .onLongPressGesture(minimumDuration: 0, maximumDistance: 60,
                                pressing: { holdingOriginal = $0 }, perform: {})
    }
    private func tag(_ t: String) -> some View {
        Text(t).font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 5)
            .background(.black.opacity(0.45), in: Capsule()).foregroundStyle(.white)
    }
    private func handle(in geo: GeometryProxy) -> some View {
        ZStack {
            Rectangle().fill(.white.opacity(0.8)).frame(width: 1.5)
            Image(systemName: "arrow.left.and.right.circle.fill")
                .font(.title).foregroundStyle(.white).background(Circle().fill(CHTheme.accent))
        }
        .position(x: geo.size.width * split, y: geo.size.height / 2)
    }
}
