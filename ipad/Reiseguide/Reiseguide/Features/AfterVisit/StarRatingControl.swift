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

    var body: some View {
        HStack(spacing: AppSpacing.s) {
            ForEach(1 ... 5, id: \.self) { value in
                Button {
                    onSelect(value)
                } label: {
                    Image(systemName: value <= stars ? "star.fill" : "star")
                        .font(.system(size: 30))
                        .foregroundStyle(value <= stars ? AppColor.rating : AppColor.textTertiary)
                        .frame(width: AppSpacing.minTapTarget, height: AppSpacing.minTapTarget)
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
        }
    }

    private func spoken(_ value: Int) -> String {
        L10n.string("rating.star", lang: locale.identifier).replacingOccurrences(of: "%@", with: String(value))
    }
}
