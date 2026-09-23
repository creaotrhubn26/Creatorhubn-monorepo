// MapOverlayControls.swift
//
// Små flytende elementer over kartet i MapView: posisjonsknappen (accent,
// 48 pt, fylt ikon mens kartet følger brukeren) og oppsummeringen VoiceOver
// leser først (vises bare når VoiceOver kjører, så den ikke tar plass fra
// kartet ellers). Tekst i textPrimary på bgElevated, som resten av kartets
// flytende UI.

import SwiftUI

struct MapLocationButton: View {
    let isFollowing: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: isFollowing ? "location.fill" : "location")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(AppColor.onAccent)
                .frame(width: 48, height: 48)
                .background(AppColor.accent, in: Circle())
                .shadow(color: .black.opacity(0.35), radius: 16, x: 0, y: 8)
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(Text("map.showMyLocation"))
        .accessibilityAddTraits(isFollowing ? .isSelected : [])
    }
}

struct MapSummaryBanner: View {
    let text: String

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        Text(text)
            .font(AppFont.subtitle)
            .foregroundStyle(AppColor.textPrimary)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(AppSpacing.m)
            .background(AppColor.bgElevated, in: RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous).strokeBorder(contrast.border, lineWidth: 1))
            .accessibilityAddTraits(.isSummaryElement)
            .accessibilitySortPriority(1)
    }
}
