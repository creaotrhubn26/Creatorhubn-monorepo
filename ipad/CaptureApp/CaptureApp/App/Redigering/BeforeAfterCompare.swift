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
    /// Per-person focus from the persisted capture analysis. Unlike the local
    /// edit dots, this is diagnostic only and never changes the photograph.
    var faceFocus: [FaceFocusAssessment] = []
    var showFaceFocus = false
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
                if showFaceFocus {
                    ForEach(faceFocus) { assessment in
                        if let displayRect = focusDisplayRect(for: assessment.rect, in: imageRect) {
                            FaceFocusBox(assessment: assessment)
                                .frame(width: displayRect.width, height: displayRect.height)
                                .position(x: displayRect.midX, y: displayRect.midY)
                        }
                    }
                    if !faceFocus.isEmpty {
                        focusSummary
                            .padding(10)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    }
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

    /// Vision stores bottom-left coordinates while crop state is top-left.
    /// Convert, clip to the active crop, then map into the fitted image rect so
    /// focus boxes stay attached to the right person after cropping/rotation.
    private func focusDisplayRect(for visionRect: CGRect, in imageRect: CGRect) -> CGRect? {
        let faceTopLeft = CGRect(
            x: visionRect.minX,
            y: 1 - visionRect.maxY,
            width: visionRect.width,
            height: visionRect.height
        )
        let crop = beforeCrop ?? CGRect(x: 0, y: 0, width: 1, height: 1)
        guard crop.width > 0, crop.height > 0 else { return nil }
        let visible = faceTopLeft.intersection(crop)
        guard !visible.isNull, visible.width > 0.002, visible.height > 0.002 else { return nil }
        let normalized = CGRect(
            x: (visible.minX - crop.minX) / crop.width,
            y: (visible.minY - crop.minY) / crop.height,
            width: visible.width / crop.width,
            height: visible.height / crop.height
        )
        return CGRect(
            x: imageRect.minX + normalized.minX * imageRect.width,
            y: imageRect.minY + normalized.minY * imageRect.height,
            width: normalized.width * imageRect.width,
            height: normalized.height * imageRect.height
        )
    }

    private var focusSummary: some View {
        let sharp = faceFocus.filter { $0.state == .sharp }.count
        let soft = faceFocus.filter { $0.state == .soft }.count
        let unknown = faceFocus.filter { $0.state == .unmeasured }.count
        return HStack(spacing: 6) {
            Image(systemName: soft > 0 ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
            Text(soft > 0
                 ? "\(sharp) av \(faceFocus.count) skarpe · \(soft) ute av fokus"
                 : (unknown > 0
                    ? "\(sharp) av \(faceFocus.count) skarpe · \(unknown) ikke målt"
                    : "Alle \(sharp) ansikter er skarpe"))
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background((soft > 0 ? CHTheme.danger : CHTheme.success).opacity(0.92), in: Capsule())
        .accessibilityLabel(soft > 0
                            ? "Fokusadvarsel. \(sharp) av \(faceFocus.count) ansikter er skarpe. \(soft) er ute av fokus."
                            : "Fokuskontroll. Alle målte ansikter er skarpe.")
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

struct FaceFocusBox: View {
    let assessment: FaceFocusAssessment

    private var color: Color {
        switch assessment.state {
        case .sharp: return CHTheme.success
        case .soft: return CHTheme.danger
        case .unmeasured: return CHTheme.textMuted
        }
    }

    var body: some View {
        RoundedRectangle(cornerRadius: 6)
            .stroke(color, style: StrokeStyle(
                lineWidth: assessment.state == .soft ? 3 : 2,
                dash: assessment.state == .unmeasured ? [5, 4] : []
            ))
            .overlay(alignment: .topLeading) {
                Text("\(assessment.personNumber) · \(assessment.state.label)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(color.opacity(0.94), in: Capsule())
                    .fixedSize()
                    .offset(y: -22)
            }
            .shadow(color: .black.opacity(0.45), radius: 2)
            .allowsHitTesting(false)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Person \(assessment.personNumber), \(assessment.state.label.lowercased())")
    }
}
