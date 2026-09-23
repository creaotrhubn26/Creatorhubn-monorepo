// ArrivalCardView.swift
//
// Bunnkortet for «Du er framme» (SenseAid Explore pakke 1, punkt 1): dukker
// opp over innholdet når ArrivalCoordinator sier brukeren har nådd et sted,
// og blir liggende til brukeren avviser det eller forlater sonen (WCAG
// 2.2.1: ingen auto-lukking av noe brukeren må reagere på). VoiceOver-fokus
// flyttes hit med det samme kortet vises.

import SwiftUI

struct ArrivalCardView: View {
    let card: ArrivalCard
    let locale: Locale
    let onPlay: () -> Void
    let onDismiss: () -> Void

    @Environment(\.contrastColors) private var contrast
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @AccessibilityFocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.l) {
            HStack(spacing: AppSpacing.m) {
                Image(systemName: "mappin.circle.fill")
                    .font(.title2)
                    .foregroundStyle(AppColor.accent)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("arrival.title")
                        .font(.caption)
                        .foregroundStyle(contrast.textSecondary)
                        .asHeader()
                    Text(card.poi.title)
                        .font(AppFont.cardTitle)
                        .foregroundStyle(AppColor.textPrimary)
                }
                Spacer(minLength: 0)
            }
            actions
        }
        .padding(AppSpacing.l)
        .background(AppColor.bgElevated, in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous).strokeBorder(contrast.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 16, x: 0, y: 8)
        .padding(.horizontal, AppSpacing.screenMargin)
        .accessibilityElement(children: .contain)
        .accessibilityFocused($isFocused)
        .onAppear { isFocused = true }
    }

    @ViewBuilder
    private var actions: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: AppSpacing.s) {
                primaryButton
                SecondaryButton(title: "arrival.notNow", action: onDismiss)
            }
        } else {
            HStack(spacing: AppSpacing.s) {
                SecondaryButton(title: "arrival.notNow", action: onDismiss)
                primaryButton
            }
        }
    }

    private var primaryButton: some View {
        Button(action: onPlay) {
            HStack(spacing: AppSpacing.s) {
                Image(systemName: "play.fill")
                Text(primaryLabel)
            }
            .font(AppFont.button)
            .foregroundStyle(AppColor.onAccent)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(AppColor.accent, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(PressableButtonStyle())
    }

    /// «Spill av» hvis ingenting spiller, ellers «Bytt til {tittel}».
    private var primaryLabel: String {
        if card.previouslyPlaying != nil {
            return L10n.string("arrival.switchTo", lang: locale.identifier).replacingOccurrences(of: "%@", with: card.poi.title)
        }
        return L10n.string("arrival.play", lang: locale.identifier)
    }
}
