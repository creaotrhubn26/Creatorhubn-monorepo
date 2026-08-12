import SwiftUI

/// Den interaktive klaffearmen — stripete brett hengslet øverst på slaten.
///
/// - Trykk eller dra ned → armen slår ned i slaten: klaffelyd, haptikk og
///   metadata-fangst skjer NØYAKTIG i nedslagsøyeblikket.
/// - Trykk eller dra opp igjen → READY, og take økes med 1 (hvis Auto Take).
struct ClapperArmView: View {
    @Bindable var model: SlateModel
    let height: CGFloat
    let scale: CGFloat

    @State private var angle: Double = SlateModel.openAngle
    @State private var closeTask: Task<Void, Never>?

    private static var openAngle: Double { SlateModel.openAngle }
    /// Så raskt armen slår ned (s) — kjapt nok til null følt latens, men
    /// fortsatt synlig.
    private static let closeDuration: Double = 0.08

    var body: some View {
        StripedBoard()
            .frame(height: height)
            .clipShape(RoundedRectangle(cornerRadius: 8 * scale, style: .continuous))
            .overlay(alignment: .top) {
                // Hengsel med metallglans.
                RoundedRectangle(cornerRadius: 3 * scale)
                    .fill(
                        LinearGradient(
                            colors: [Color(white: 0.42), Color(white: 0.78), Color(white: 0.38)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: 6 * scale)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 8 * scale, style: .continuous)
                    .strokeBorder(Color.black.opacity(0.5), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.5), radius: 10, y: 6)
            .rotation3DEffect(
                .degrees(angle),
                axis: (x: 1, y: 0, z: 0),
                anchor: .top,
                perspective: 0.5
            )
            .offset(y: raisedOffset)
            .contentShape(Rectangle())
            .gesture(armGesture)
            .onChange(of: model.slateState) { _, newState in
                switch newState {
                case .closing:
                    closeTask?.cancel()
                    withAnimation(.easeIn(duration: Self.closeDuration), completionCriteria: .logicallyComplete) {
                        angle = 0
                    } completion: {
                        model.completeClapImpact()
                        settleBounce()
                    }
                    // Fallback: dekker tilfellet der vinkelen allerede er 0
                    // (armen er allerede nede), så animasjonen har ingenting å
                    // animere og completion aldri kjører.
                    closeTask = Task {
                        try? await Task.sleep(for: .seconds(Self.closeDuration + 0.01))
                        guard !Task.isCancelled else { return }
                        model.completeClapImpact()
                    }
                case .ready:
                    closeTask?.cancel()
                    withAnimation(.spring(response: 0.34, dampingFraction: 0.72)) {
                        angle = Self.openAngle
                    }
                case .closed:
                    closeTask?.cancel()
                    withAnimation(.easeOut(duration: 0.08)) {
                        angle = 0
                    }
                }
            }
            .onAppear {
                angle = model.slateState == .ready ? Self.openAngle : 0
            }
    }

    private var raisedOffset: CGFloat {
        model.slateState == .ready ? -height * 0.5 : 0
    }

    // MARK: - Gest

    private var armGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                switch model.slateState {
                case .ready:
                    // Dra ned → mot lukket (angle mot 0).
                    let down = max(0, value.translation.height)
                    angle = Self.openAngle + (down / height) * -Self.openAngle
                case .closed:
                    // Dra opp → mot åpen (angle mot openAngle).
                    let fraction = max(0, -value.translation.height) / height
                    angle = fraction * Self.openAngle
                case .closing:
                    break
                }
            }
            .onEnded { value in
                let isTap = value.translation.height.magnitude < 6
                    && value.translation.width.magnitude < 6

                switch model.slateState {
                case .ready:
                    let shouldClap = isTap || value.translation.height > height * 0.4
                    if shouldClap {
                        model.clap()   // onChange(.closing) animerer + slår ned
                    } else {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                            angle = Self.openAngle
                        }
                    }

                case .closed:
                    let shouldOpen = isTap || value.translation.height < -height * 0.3
                    if shouldOpen {
                        model.open()
                    } else {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                            angle = 0
                        }
                    }

                case .closing:
                    break
                }
            }
    }

    /// Liten «tre-fjær»-bounce rett etter nedslag — armen dunker og legger seg.
    private func settleBounce() {
        guard model.slateState == .closed else { return }
        withAnimation(.spring(response: 0.045, dampingFraction: 0.28)) { angle = 3.2 }
        Task {
            try? await Task.sleep(for: .seconds(0.05))
            guard model.slateState == .closed, !Task.isCancelled else { return }
            withAnimation(.spring(response: 0.12, dampingFraction: 0.5)) { angle = 0 }
        }
    }
}

/// Stripete klaffebrett-flate (svart/hvite skrå striper) tegnet med Canvas.
struct StripedBoard: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = max(12, size.height * 0.42)
            var x: CGFloat = -size.height
            var index = 0

            while x < size.width {
                var path = Path()
                path.move(to: CGPoint(x: x, y: size.height))
                path.addLine(to: CGPoint(x: x + size.height, y: 0))
                path.addLine(to: CGPoint(x: x + size.height + step, y: 0))
                path.addLine(to: CGPoint(x: x + step, y: size.height))
                path.closeSubpath()

                context.fill(path, with: .color(index % 2 == 0 ? .black : .white))
                x += step
                index += 1
            }
        }
        .background(Color.black)
    }
}
