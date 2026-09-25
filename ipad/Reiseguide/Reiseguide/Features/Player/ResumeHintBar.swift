// ResumeHintBar.swift
//
// «Fortsett der du slapp» (item 3): en liten, avviselig linje øverst i
// kontrollene («Fortsetter fra 2:14 · Start på nytt») når `start(poi:)` har
// hoppet til en lagret posisjon (PlayerViewModel.resumeHint). Selve
// gjenopptagelsen har allerede skjedd når dette vises — kortet er bare en
// forklaring, med en vei tilbake til begynnelsen for den som heller vil det.

import SwiftUI

struct ResumeHintBar: View {
    let savedPositionS: Double
    let uiLang: String
    let onRestart: () -> Void
    let onDismiss: () -> Void

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        HStack(spacing: AppSpacing.s) {
            Image(systemName: "arrow.uturn.forward.circle")
                .foregroundStyle(AppColor.accent)
                .accessibilityHidden(true)
            Text(message)
                .font(AppFont.subtitle)
                .foregroundStyle(AppColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: AppSpacing.s)
            Button("player.resume.restart", action: onRestart)
                .font(AppFont.chip)
                .foregroundStyle(AppColor.accent)
                .minTapTarget()
                .accessibilityHint(Text("player.resume.restartHint"))
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(contrast.textSecondary)
                    .minTapTarget()
            }
            .accessibilityLabel(Text("action.close"))
        }
        .padding(.horizontal, AppSpacing.m)
        .padding(.vertical, AppSpacing.s)
        .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
        .accessibilityElement(children: .contain)
    }

    private var message: String {
        L10n.string("player.resume.message", lang: uiLang).replacingOccurrences(of: "%@", with: L10n.clock(seconds: savedPositionS))
    }
}
