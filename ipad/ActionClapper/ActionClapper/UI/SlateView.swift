import SwiftUI

/// Selve klaffebrettet: kroppen med produksjon + felt, og den interaktive
/// armen liggende oppå. Hele enheten er klaffen.
struct SlateView: View {
    @Bindable var model: SlateModel
    let scale: CGFloat

    @State private var impactPulse: CGFloat = 1.0
    @State private var impactFlash: Double = 0
    @State private var klapOpacity: Double = 0
    @State private var klapScale: CGFloat = 1.5
    @State private var klapTask: Task<Void, Never>?
    @State private var showLastClap = false
    @State private var hideTask: Task<Void, Never>?

    var body: some View {
        GeometryReader { geo in
            let armHeight: CGFloat = max(52, min(geo.size.height * 0.14, geo.size.width * 0.15))

            ZStack(alignment: .top) {
                slateBody(armHeight: armHeight)
                ClapperArmView(model: model, height: armHeight, scale: scale)
            }
            .scaleEffect(impactPulse)
            .overlay { klapBurst }
            .overlay(alignment: .bottom) { lastClapBadge }
        }
        .onChange(of: model.slateState) { _, newState in
            if newState == .closed { pulseOnImpact() }
        }
        .onChange(of: model.claps.count) { _, _ in
            guard model.lastClap != nil else { return }
            withAnimation(.spring(duration: 0.28)) { showLastClap = true }
            hideTask?.cancel()
            hideTask = Task {
                try? await Task.sleep(for: .seconds(1.9))
                guard !Task.isCancelled else { return }
                withAnimation(.easeOut(duration: 0.3)) { showLastClap = false }
            }
        }
    }

    // MARK: - Kroppen

    private func slateBody(armHeight: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 20 * scale, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [Color(white: 0.10), Color(white: 0.045), Color(white: 0.12)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay {
                VStack(spacing: 0) {
                    productionBlock
                    Spacer(minLength: 8)
                    fieldsGrid
                }
                .padding(.horizontal, 26 * scale)
                .padding(.top, armHeight + 16 * scale)
                .padding(.bottom, 22 * scale)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 20 * scale, style: .continuous)
                    .strokeBorder(
                        LinearGradient(
                            colors: [.white.opacity(0.35), .white.opacity(0.06)],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 1.5
                    )
            }
            .overlay(alignment: .topLeading) { SlateScrew(scale: scale).padding(12 * scale) }
            .overlay(alignment: .topTrailing) { SlateScrew(scale: scale).padding(12 * scale) }
            .overlay(alignment: .bottomLeading) { SlateScrew(scale: scale).padding(12 * scale) }
            .overlay(alignment: .bottomTrailing) { SlateScrew(scale: scale).padding(12 * scale) }
            .overlay(alignment: .top) {
                if impactFlash > 0.01 {
                    LinearGradient(
                        colors: [.white.opacity(impactFlash), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 64 * scale)
                    .allowsHitTesting(false)
                }
            }
            .shadow(color: .black.opacity(0.6), radius: 22, y: 10)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var productionBlock: some View {
        VStack(spacing: 5 * scale) {
            Text("PRODUCTION")
                .font(.system(size: 12 * scale, weight: .bold, design: .rounded))
                .tracking(3)
                .foregroundStyle(.white.opacity(0.55))

            TextField("Production", text: $model.production)
                .multilineTextAlignment(.center)
                .font(Theme.handwritten(36 * scale, preferBold: true))
                .foregroundStyle(.white)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.characters)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .onSubmit { dismissKeyboard() }

            TextField("Tagline", text: $model.tagline)
                .multilineTextAlignment(.center)
                .font(Theme.handwritten(16 * scale))
                .foregroundStyle(Theme.accent.opacity(0.9))
                .autocorrectionDisabled()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .onSubmit { dismissKeyboard() }
        }
        .frame(maxWidth: .infinity)
    }

    private var fieldsGrid: some View {
        VStack(spacing: 14 * scale) {
            HStack(spacing: 14 * scale) {
                SlateFieldView(label: "Scene", text: $model.scene, scale: scale)
                SlateFieldView(label: "Roll", text: $model.roll, scale: scale)
                SlateFieldView(
                    label: "Take",
                    text: $model.take,
                    scale: scale,
                    highlighted: model.isClosed
                )
            }

            HStack(spacing: 14 * scale) {
                SlateFieldView(label: "Director", text: $model.director, scale: scale)
                SlateFieldView(label: "Camera", text: $model.camera, scale: scale)
            }

            HStack(spacing: 14 * scale) {
                SlateFieldView(label: "Date", text: $model.date, scale: scale)
                SlateTimecodeView(model: model, scale: scale, highlighted: model.isClosed)
            }
        }
    }

    // MARK: - Feedback

    private var lastClapBadge: some View {
        Group {
            if showLastClap, let last = model.lastClap {
                HStack(spacing: 10 * scale) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.accent)
                    Text(last.summary)
                        .font(.system(size: 15 * scale, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 18 * scale)
                .padding(.vertical, 10 * scale)
                .background(Capsule().fill(Color(white: 0.12)))
                .overlay(Capsule().strokeBorder(Color.white.opacity(0.15), lineWidth: 1))
                .padding(.bottom, 10)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    /// Liten "thud" + lysglimt på hele brettet i nedslagsøyeblikket.
    private func pulseOnImpact() {
        withAnimation(.spring(response: 0.06, dampingFraction: 0.42)) {
            impactPulse = 1.008
        }
        impactFlash = 0.5
        withAnimation(.easeOut(duration: 0.3)) { impactFlash = 0 }

        // Stort, tydelig ACTION!-utbrudd så alle ser at klaffen slår.
        // Holder seg synlig lenge nok til å leses foran kamera.
        klapTask?.cancel()
        klapScale = 1.6
        withAnimation(.spring(response: 0.14, dampingFraction: 0.55)) {
            klapOpacity = 0.9
            klapScale = 1.0
        }
        klapTask = Task {
            try? await Task.sleep(for: .seconds(1.2))
            withAnimation(.easeOut(duration: 0.45)) { klapOpacity = 0 }
        }

        Task {
            try? await Task.sleep(for: .seconds(0.07))
            withAnimation(.spring(response: 0.12, dampingFraction: 0.7)) {
                impactPulse = 1.0
            }
        }
    }

    /// Stort «ACTION!»-utbrudd som vises i nedslagsøyeblikket.
    private var klapBurst: some View {
        Group {
            if klapOpacity > 0.01 {
                Text("ACTION!")
                    .font(Theme.handwritten(104 * scale, preferBold: true))
                    .foregroundStyle(Theme.accent.opacity(0.92))
                    .scaleEffect(klapScale)
                    .opacity(klapOpacity)
                    .shadow(color: .black.opacity(0.5), radius: 14)
                    .allowsHitTesting(false)
            }
        }
    }
}

/// Liten metallskrue i hjørnene av klaffebrettet.
private struct SlateScrew: View {
    let scale: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color(white: 0.7), Color(white: 0.28)],
                        center: .topLeading,
                        startRadius: 0,
                        endRadius: 8 * scale
                    )
                )
            Circle().strokeBorder(Color.black.opacity(0.6), lineWidth: 1)
            Rectangle()
                .fill(Color.black.opacity(0.7))
                .frame(width: 6 * scale, height: 1.4 * scale)
                .rotationEffect(.degrees(35))
        }
        .frame(width: 14 * scale, height: 14 * scale)
    }
}
