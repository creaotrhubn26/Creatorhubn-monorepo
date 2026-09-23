// TourCelebrationView.swift
//
// Feiringen når siste sted i touren er fullført (SenseAid Explore pakke 1,
// punkt 3): kort ark med melding og haptikk; konfetti-liknende bevegelse
// bare når «Reduser bevegelse» er av. RootTabView poster annonseringen
// (samme mønster som framme-varselet).

import SwiftUI

struct TourCelebrationView: View {
    let area: GuideArea
    let onDismiss: () -> Void

    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    private var uiLang: String { env.settings.uiLanguage }

    var body: some View {
        VStack(spacing: AppSpacing.l) {
            ZStack {
                if !reduceMotion {
                    ConfettiView()
                }
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(AppColor.accent)
                    .scaleEffect(appeared ? 1 : 0.6)
                    .animation(reduceMotion ? nil : .bouncy, value: appeared)
            }
            .frame(height: 120)
            .accessibilityHidden(true)
            Text("tour.celebration.title")
                .font(AppFont.screenTitle)
                .foregroundStyle(AppColor.textPrimary)
                .multilineTextAlignment(.center)
                .asHeader()
            Text(L10n.string("tour.celebration.message", lang: uiLang).replacingOccurrences(of: "%@", with: area.name))
                .font(AppFont.body)
                .foregroundStyle(contrast.textSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "action.done", action: onDismiss)
        }
        .padding(AppSpacing.xl)
        .background(AppColor.bgBase)
        .presentationDetents([.medium])
        .preferredColorScheme(.dark)
        .onAppear { appeared = true }
    }
}

/// Rent dekorativ konfetti-animasjon, skjult for VoiceOver. Startposisjonene
/// regnes ut én gang når visningen dukker opp, ikke ved hvert oppdatering.
private struct ConfettiView: View {
    private let colors: [Color] = [AppColor.accent, AppColor.rating, AppColor.accentMuted]

    @State private var xOffsets = (0 ..< 16).map { _ in CGFloat.random(in: -80 ... 80) }
    @State private var animate = false

    var body: some View {
        ZStack {
            ForEach(0 ..< xOffsets.count, id: \.self) { index in
                Circle()
                    .fill(colors[index % colors.count])
                    .frame(width: 6, height: 6)
                    .offset(x: xOffsets[index], y: animate ? 140 : -20)
                    .opacity(animate ? 0 : 1)
                    .animation(.easeIn(duration: 1.2).delay(Double(index) * 0.03), value: animate)
            }
        }
        .accessibilityHidden(true)
        .onAppear { animate = true }
    }
}
