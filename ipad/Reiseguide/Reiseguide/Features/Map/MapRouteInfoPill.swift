// MapRouteInfoPill.swift
//
// Liten etikett over nærmeste-kortet med gangtid og avstand til valgt sted
// («6 min å gå · 450 m»), eller luftlinje når gangruta mangler (ingen svar
// fra MKDirections). Tekst i textPrimary på bgElevated, samme som
// liste/kart-knappen; bryter over flere linjer i stedet for å kuttes med
// store tekststørrelser. Ett VoiceOver-element med gangtiden skrevet ut.

import SwiftUI

struct MapRouteInfoPill: View {
    let line: MapRouteLine
    let uiLanguage: String
    let locale: Locale

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        Label {
            Text(visibleText)
                .font(AppFont.chip)
                .foregroundStyle(AppColor.textPrimary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        } icon: {
            Image(systemName: line.isWalkingRoute ? "figure.walk" : "ruler")
                .foregroundStyle(AppColor.accent)
        }
        .padding(.horizontal, AppSpacing.m)
        .padding(.vertical, AppSpacing.s)
        .background(AppColor.bgElevated, in: RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous).strokeBorder(contrast.border, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(spokenText))
    }

    private var distanceText: String { L10n.distance(meters: line.distanceM, locale: locale) }

    private var visibleText: String {
        guard let seconds = line.walkingTimeS else { return straightLineText }
        return L10n.string("map.route.walking", lang: uiLanguage)
            .replacingOccurrences(of: "%1$@", with: L10n.shortDuration(seconds: seconds, locale: locale))
            .replacingOccurrences(of: "%2$@", with: distanceText)
    }

    private var spokenText: String {
        guard let seconds = line.walkingTimeS else { return straightLineText }
        // Hele minutter: «6 minutter», ikke «5 minutter 48 sekunder».
        let minutes = Double(WalkingRoute.wholeMinutes(seconds: seconds) * 60)
        return L10n.string("map.route.walkingSpoken", lang: uiLanguage)
            .replacingOccurrences(of: "%1$@", with: L10n.spokenDuration(seconds: minutes, locale: locale))
            .replacingOccurrences(of: "%2$@", with: distanceText)
    }

    private var straightLineText: String {
        L10n.string("map.route.straightLine", lang: uiLanguage).replacingOccurrences(of: "%@", with: distanceText)
    }
}
