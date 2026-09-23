// HeroImageCreditLine.swift
//
// Krediteringslinje under heltebildet på detaljsiden (migrasjon 0663):
// «Foto: {fotograf} · {lisens}». Bildene kommer fra Wikimedia Commons, og
// lisensene (CC BY / CC BY-SA) krever at opphav og lisens vises der bildet
// vises. Linjen lenker til filsiden på Commons når den finnes, er ett eget
// VoiceOver-element med hint, bruker kontrastsikker tekstfarge (ikke
// textTertiary), er understreket som lenke (ikke bare farge) og brytes over
// flere linjer ved stor tekst i stedet for å kuttes.

import SwiftUI

struct HeroImageCreditLine: View {
    let credit: HeroImageCredit
    let uiLanguage: String

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        if let url = credit.sourceURL {
            Link(destination: url) {
                HStack(alignment: .firstTextBaseline, spacing: AppSpacing.xs) {
                    creditText(isLink: true)
                    Image(systemName: "arrow.up.right")
                        .font(.caption2.weight(.semibold))
                        .accessibilityHidden(true)
                }
                .foregroundStyle(contrast.textSecondary)
                .minTapTarget()
            }
            .accessibilityLabel(Text(spokenText))
            .accessibilityHint(Text("detail.photoCredit.hint"))
        } else {
            creditText(isLink: false)
                .foregroundStyle(contrast.textSecondary)
                .accessibilityLabel(Text(spokenText))
        }
    }

    private func creditText(isLink: Bool) -> some View {
        Text(displayText)
            .font(.caption)
            .underline(isLink)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// «Foto: Ola Nordmann · CC BY-SA 4.0», eller «Foto: Ola Nordmann» uten lisens.
    private var displayText: String {
        guard let license = credit.license else {
            return String(format: L10n.string("detail.photoCredit.noLicense", lang: uiLanguage), credit.author)
        }
        return String(format: L10n.string("detail.photoCredit", lang: uiLanguage), credit.author, license)
    }

    /// Samme innhold uten «·», som VoiceOver ellers leser som tegn.
    private var spokenText: String {
        guard let license = credit.license else { return displayText }
        return String(format: L10n.string("detail.photoCredit.spoken", lang: uiLanguage), credit.author, license)
    }
}
