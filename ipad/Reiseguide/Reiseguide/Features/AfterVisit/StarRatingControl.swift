// StarRatingControl.swift
//
// Fem stjerner à 44 pt (UU-krav 8.3). Hver stjerne er en knapp med eget navn
// («3 av 5 stjerner»), og hele raden er justerbar for VoiceOver (sveip
// opp/ned), samme mønster som fremdriftslinjen i avspilleren.

import SwiftUI

struct StarRatingControl: View {
    let stars: Int
    let locale: Locale
    let onSelect: (Int) -> Void

    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    /// 30 pt ved standard tekststørrelse; følger Dynamic Type opp til 48 pt.
    @ScaledMetric(relativeTo: .title) private var starSize: CGFloat = 30
    /// Trigger for haptikk (pakke 1, punkt 2): telles opp ved hvert valg, uavhengig av om verdien er den samme som før.
    @State private var selectionTick = 0

    var body: some View {
        HStack(spacing: AppSpacing.s) {
            ForEach(1 ... 5, id: \.self) { value in
                Button {
                    onSelect(value)
                    selectionTick += 1
                } label: {
                    Image(systemName: value <= stars ? "star.fill" : "star")
                        .font(.system(size: min(starSize, 48)))
                        .foregroundStyle(value <= stars ? AppColor.rating : contrast.textTertiary)
                        .frame(minWidth: AppSpacing.minTapTarget, minHeight: AppSpacing.minTapTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel(Text(spoken(value)))
                .accessibilityAddTraits(value == stars ? [.isButton, .isSelected] : .isButton)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("rating.label"))
        .accessibilityValue(Text(stars > 0 ? spoken(stars) : ""))
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: onSelect(min(5, stars + 1))
            case .decrement: onSelect(max(1, stars - 1))
            @unknown default: break
            }
            selectionTick += 1
        }
        .sensoryFeedback(trigger: selectionTick) { _, _ in
            AppHaptics.feedback(.selection, enabled: env.settings.hapticsEnabled)
        }
    }

    private func spoken(_ value: Int) -> String {
        L10n.string("rating.star", lang: locale.identifier).replacingOccurrences(of: "%@", with: String(value))
    }
}
