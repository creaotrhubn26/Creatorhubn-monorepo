import SwiftUI

/// Reidar — Reknarens elg-maskott, animert per tilstand. Respekterer Reduser bevegelse.
/// `.idle` puster (login-hero) · `.loading` hopper + «tenker» (gull-prikker) ·
/// `.success` spretter inn med tommel opp.
struct ReidarView: View {
    enum Style { case idle, loading, success }
    var style: Style = .idle
    var size: CGFloat = 120
    var caption: String? = nil

    @State private var animate = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var imageName: String {
        switch style {
        case .idle: return "ReidarMascot"    // vinker
        case .loading: return "ReidarThink"  // tenker
        case .success: return "ReidarThumbs" // tommel opp
        }
    }

    var body: some View {
        VStack(spacing: 16) {
            mascot
                .frame(width: size, height: size)
                .shadow(color: .reknarenGreen.opacity(0.16), radius: 16, y: 10)
                .accessibilityLabel("Reidar")
            if style == .loading { ReidarDots() }
            if let caption {
                Text(caption).font(.subheadline).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .onAppear { animate = true }
    }

    @ViewBuilder private var mascot: some View {
        let img = Image(imageName).resizable().scaledToFit()
        switch style {
        case .idle:
            img
                .scaleEffect(animate ? 1.04 : 1.0, anchor: .bottom)
                .offset(y: animate ? -5 : 2)
                .rotationEffect(.degrees(animate ? 1.6 : -1.6), anchor: .bottom)
                .animation(reduceMotion ? nil : .easeInOut(duration: 1.5).repeatForever(autoreverses: true), value: animate)
        case .loading:
            // Hopp: presset (squash) ved bakken, strukket (stretch) i lufta.
            img
                .scaleEffect(x: animate ? 0.94 : 1.05, y: animate ? 1.09 : 0.93, anchor: .bottom)
                .offset(y: animate ? -24 : 0)
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.52).repeatForever(autoreverses: true), value: animate)
        case .success:
            img
                .scaleEffect(animate ? 1.0 : 0.6)
                .opacity(animate ? 1 : 0)
                .rotationEffect(.degrees(animate ? 0 : -12))
                .animation(reduceMotion ? nil : .spring(response: 0.5, dampingFraction: 0.55), value: animate)
        }
    }
}

/// Tre gull-prikker som pulserer i tur — Reidar «tenker».
private struct ReidarDots: View {
    @State private var phase = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let timer = Timer.publish(every: 0.32, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(spacing: 9) {
            ForEach(0..<3, id: \.self) { i in
                Circle().fill(Color.reknarenGold)
                    .frame(width: 8, height: 8)
                    .opacity(phase == i ? 1 : 0.3)
                    .scaleEffect(phase == i ? 1.25 : 1)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: phase)
        .onReceive(timer) { _ in if !reduceMotion { phase = (phase + 1) % 3 } }
        .accessibilityHidden(true)
    }
}
