// EndOfVisitCard.swift
//
// «Rolig slutt på besøket» (avspiller-redesignet, item 1): når fortellingen
// tar slutt av seg selv viser spilleren dette kortet i stedet for å åpne
// etter-besøket-arket med det samme (PlayerViewModel.narrationEndedVisit).
// Besøket er allerede merket fullført og Live Activity avsluttet
// (PlayerViewModel.completeNarrationEnd). Brukeren velger selv: ta quizen
// (åpner arket), gå til neste stopp (item 2), eller spille av på nytt.
// VoiceOver-fokus flyttes hit når kortet dukker opp (samme mønster som
// ArrivalCardView).

import SwiftUI

extension PlayerViewModel {
    /// «Ta quizen og gi stjerner» på avslutningskortet: åpner etter-besøket,
    /// akkurat som «Avslutt besøket» gjør.
    func openAfterVisitFromEndCard() {
        guard let visit = narrationEndedVisit else { return }
        narrationEndedVisit = nil
        finishedVisit = visit
    }

    /// «Spill av på nytt» på avslutningskortet: samme sted forfra.
    func replayVisit() {
        narrationEndedVisit = nil
        chapterIndex = 0
        loadChapter(announce: false)
        play()
    }
}

struct EndOfVisitCard: View {
    /// Nil skjuler «Gå til neste stopp» (ingen flere ubesøkte stopp på ruten).
    let nextStopTitle: String?
    let uiLang: String
    let onTakeQuiz: () -> Void
    let onNextStop: () -> Void
    let onReplay: () -> Void

    @Environment(\.contrastColors) private var contrast
    @AccessibilityFocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("player.visitEnded.title")
                    .font(AppFont.cardTitle)
                    .foregroundStyle(AppColor.textPrimary)
                    .asHeader()
                Text("player.visitEnded.subtitle")
                    .font(AppFont.subtitle)
                    .foregroundStyle(contrast.textSecondary)
            }
            PrimaryButton(title: "player.visitEnded.quiz", systemImage: "star.fill", action: onTakeQuiz)
            if let nextStopTitle {
                SecondaryButton(title: "visit.nextStop", systemImage: "arrow.forward.circle", action: onNextStop)
                    .accessibilityLabel(Text(nextStopLabel(nextStopTitle)))
                    .accessibilityHint(Text("visit.nextStopHint"))
            }
            replayButton
        }
        .padding(AppSpacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous).strokeBorder(contrast.border, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityFocused($isFocused)
        .onAppear { isFocused = true }
    }

    private var replayButton: some View {
        Button(action: onReplay) {
            Text("player.visitEnded.replay")
                .font(AppFont.chip)
                .foregroundStyle(AppColor.accent)
                .frame(minHeight: AppSpacing.minTapTarget)
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityHint(Text("player.visitEnded.replayHint"))
    }

    /// «Gå til neste stopp, Akershus festning» — stedsnavnet leses med, siden
    /// knappeteksten alene ikke sier hvor den fører.
    private func nextStopLabel(_ nextStopTitle: String) -> String {
        "\(L10n.string("visit.nextStop", lang: uiLang)), \(nextStopTitle)"
    }
}
