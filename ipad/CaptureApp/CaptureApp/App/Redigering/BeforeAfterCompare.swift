import SwiftUI
import CoreImage

// MARK: - Before/After compare

struct BeforeAfterCompare: View {
    let beforePath: String?
    let after: UIImage?
    let rendering: Bool
    @Binding var zoom: CGFloat
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
            let effSplit = holdingOriginal ? 1 : split
            ZStack(alignment: .topLeading) {
                CHTheme.surfaceElevated
                if let before = beforeImage {
                    Image(uiImage: before).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                }
                if let after {
                    Image(uiImage: after).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                        .mask(alignment: .trailing) {
                            Rectangle().frame(width: geo.size.width * (1 - effSplit))
                        }
                }
                if let maskOverlay {
                    Image(uiImage: maskOverlay).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                        .opacity(0.4).allowsHitTesting(false)
                }
                if let diffOverlay {
                    Image(uiImage: diffOverlay).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height).clipped()
                        .opacity(0.7).allowsHitTesting(false)
                }
                // Tappbare ansikts-prikker (lokal justering). CI-koord (nede-
                // venstre) → SwiftUI (topp-venstre): flipp Y.
                ForEach(faceDots.indices, id: \.self) { i in
                    let r = faceDots[i]
                    let cx = r.midX * geo.size.width
                    let cy = (1 - r.midY) * geo.size.height
                    Circle()
                        .stroke(activeFace == i ? CHTheme.accent : .white, lineWidth: activeFace == i ? 3 : 2)
                        .background(Circle().fill((activeFace == i ? CHTheme.accent : .black).opacity(0.35)))
                        .frame(width: 30, height: 30)
                        .overlay(Text("\(i + 1)").font(.caption.weight(.bold)).foregroundStyle(.white))
                        .position(x: cx, y: cy)
                        .onTapGesture { onTapFace(i) }
                }
                labels
                if !holdingOriginal { handle(in: geo) }
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
                split = min(1, max(0, v.location.x / geo.size.width))
            })
            .simultaneousGesture(
                MagnificationGesture()
                    .updating($pinch) { value, state, _ in state = value }
                    .onEnded { value in zoom = min(4, max(1, zoom * value)) }
            )
        }
        .task(id: beforePath) {
            let path = beforePath
            beforeImage = await Task.detached(priority: .userInitiated) {
                path.flatMap { UIImage(contentsOfFile: $0) }
            }.value
        }
    }

    private var labels: some View {
        VStack {
            HStack {
                tag(holdingOriginal ? "Original" : "Før"); Spacer()
                holdButton
                Spacer()
                tag("Etter")
            }.padding(10)
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
