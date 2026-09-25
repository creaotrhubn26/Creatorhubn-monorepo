// PlayerHeaderViews.swift
//
// Toppfelt (lukk, teksting av/på, del) og tittelblokken over kapittelbildet.
// Egen fil (flyttet ut av PlayerView.swift, som nærmet seg SwiftLint sin
// type_body_length-grense): rene visningskomponenter uten egen tilstand.

import SwiftUI

struct PlayerTopBar: View {
    let poi: GuidePOI?
    let captionsEnabled: Bool
    let onClose: () -> Void
    let onToggleCaptions: () -> Void

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            IconCircleButton(systemImage: "chevron.down", label: "action.close", action: onClose)
            Spacer()
            Button(action: onToggleCaptions) {
                Image(systemName: captionsEnabled ? "captions.bubble.fill" : "captions.bubble")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(captionsEnabled ? AppColor.accent : AppColor.textPrimary)
                    .frame(width: 44, height: 44)
                    .background(AppColor.bgOverlay, in: Circle())
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text("captions.label"))
            .accessibilityValue(Text(captionsEnabled ? "state.on" : "state.off"))
            .accessibilityAddTraits(.isToggle)
            if let poi {
                ShareLinkButton(url: poi.shareURL, fallbackText: poi.title, subject: poi.title, message: poi.title) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(AppColor.textPrimary)
                        .frame(width: 44, height: 44)
                        .background(AppColor.bgOverlay, in: Circle())
                }
            }
        }
    }
}

struct PlayerTitleBlock: View {
    let title: String
    let chapterTitle: String?
    let isReadByPhone: Bool
    let isSimulated: Bool
    let isPlaying: Bool

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(title)
                .font(AppFont.playerTitle)
                .foregroundStyle(AppColor.textPrimary)
                .asHeader()
            if let chapterTitle {
                Text(chapterTitle)
                    .font(AppFont.subtitle)
                    .foregroundStyle(contrast.textSecondary)
            }
            PlaybackSourceLabel(isReadByPhone: isReadByPhone, isSimulated: isSimulated)
            AudioLevelBars(isPlaying: isPlaying)
                .padding(.top, AppSpacing.xs)
        }
    }
}
