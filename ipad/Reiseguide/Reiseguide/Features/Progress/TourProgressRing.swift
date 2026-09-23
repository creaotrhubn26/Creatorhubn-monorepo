// TourProgressRing.swift
//
// Progresjonsringen «X av Y steder» (SenseAid Explore pakke 1, punkt 3),
// vist på Utforsk-forsiden og øverst i Mine steder. Ringen selv er
// dekorativ; hele raden er ett accessibility-element med etikett og verdi
// («Turfremdrift, 3 av 6 steder besøkt»), se UU-krav i pakke 1.

import SwiftUI

struct TourProgressRing: View {
    let progress: TourProgress
    let locale: Locale

    @Environment(\.contrastColors) private var contrast
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            ring
            Text(countText)
                .font(AppFont.subtitle)
                .foregroundStyle(contrast.textSecondary)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("progress.label"))
        .accessibilityValue(Text(spokenValue))
    }

    private var ring: some View {
        ZStack {
            Circle().stroke(contrast.border, lineWidth: 4)
            Circle()
                .trim(from: 0, to: progress.fraction)
                .stroke(AppColor.accent, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.4), value: progress.fraction)
            Text("\(progress.visitedCount)")
                .font(AppFont.meta)
                .foregroundStyle(AppColor.textPrimary)
        }
        .frame(width: 36, height: 36)
        .accessibilityHidden(true)
    }

    private var countText: String {
        L10n.string("progress.count", lang: locale.identifier)
            .replacingOccurrences(of: "%1$@", with: String(progress.visitedCount))
            .replacingOccurrences(of: "%2$@", with: String(progress.total))
    }

    private var spokenValue: String {
        L10n.string("progress.spokenValue", lang: locale.identifier)
            .replacingOccurrences(of: "%1$@", with: String(progress.visitedCount))
            .replacingOccurrences(of: "%2$@", with: String(progress.total))
    }
}
