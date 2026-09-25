// POIDetailTabContent.swift
//
// Innholdet under segmentfanene på detaljsiden: Om (ingress + ikonrad med
// varighet/lyd/teksting/synstolking), Opplevelse (kapitler med transkripsjon)
// og Praktisk (etikett/verdi-par). Skilt ut fra POIDetailView for lesbarhet.

import SwiftUI

struct POIDetailTabContent: View {
    let poi: GuidePOI
    let tab: POIDetailView.DetailTab

    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast

    private var locale: Locale { env.settings.locale }

    var body: some View {
        switch tab {
        case .about:
            VStack(alignment: .leading, spacing: AppSpacing.xl) {
                Text(poi.summary ?? poi.subtitle ?? "")
                    .font(AppFont.body)
                    .foregroundStyle(contrast.textSecondary)
                InfoIconRow(
                    durationText: poi.totalDurationS.map { L10n.shortDuration(seconds: $0, locale: locale) },
                    hasAudio: poi.primaryVariant?.hasAudio ?? false,
                    hasCaptions: poi.hasCaptions,
                    hasAudioDescription: poi.hasAudioDescription,
                    spokenSummary: infoSummary(poi)
                )
            }
        case .experience:
            VStack(alignment: .leading, spacing: AppSpacing.l) {
                if let variant = poi.variants.narration {
                    ForEach(variant.chapters) { chapter in
                        ChapterRow(chapter: chapter, locale: locale)
                    }
                } else {
                    Text("detail.noNarration")
                        .font(AppFont.body)
                        .foregroundStyle(contrast.textSecondary)
                }
            }
        case .practical:
            VStack(alignment: .leading, spacing: AppSpacing.l) {
                // Look Around (pakke 2, item 7): egen kortkomponent, viser
                // ingenting mens scenen sjekkes eller når Apple ikke har en.
                LookAroundPreviewCard(poi: poi)
                if poi.practicalInfo.isEmpty {
                    Text("detail.noPractical")
                        .font(AppFont.body)
                        .foregroundStyle(contrast.textSecondary)
                }
                ForEach(poi.practicalInfo, id: \.self) { item in
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text(item.label)
                            .font(AppFont.cardTitle)
                            .foregroundStyle(AppColor.textPrimary)
                        Text(item.value)
                            .font(AppFont.body)
                            .foregroundStyle(contrast.textSecondary)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    private func infoSummary(_ poi: GuidePOI) -> String {
        let lang = env.settings.uiLanguage
        var parts: [String] = []
        if let duration = poi.totalDurationS {
            parts.append(L10n.string("info.durationSpoken", lang: lang)
                .replacingOccurrences(of: "%@", with: L10n.spokenDuration(seconds: duration, locale: locale)))
        }
        var features: [String] = []
        if poi.primaryVariant?.hasAudio == true { features.append(L10n.string("info.audio", lang: lang)) }
        if poi.hasCaptions { features.append(L10n.string("info.captions", lang: lang)) }
        if poi.hasAudioDescription { features.append(L10n.string("info.audioDescription", lang: lang)) }
        if !features.isEmpty {
            parts.append(L10n.string("info.hasFeatures", lang: lang)
                .replacingOccurrences(of: "%@", with: features.joined(separator: ", ")))
        }
        return parts.joined(separator: ". ")
    }
}
