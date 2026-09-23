// ChapterPromptCard.swift
//
// Spørsmål underveis i avspilleren (pakke 3). `ChapterPromptSlot` står under
// tekstingen i PlayerView, så tekstingen alltid er synlig, og viser innslaget
// ChapterPromptController har fremme:
//   - look: kort med haptikk og VoiceOver-annonsering; fortellingen spiller
//     videre, kortet står til brukeren lukker det eller kapittelet byttes.
//   - guess: fortellingen er pauset; alternativene er knapper (≥ 44 pt), så
//     fasit og forklaring, og «Fortsett» starter fortellingen igjen. «Hopp over»
//     fortsetter uten å svare.
// Ingen automatisk lukking. Fokus flyttes til gjettespørsmålet og til fasiten.

import SwiftUI

extension PlayerViewModel {
    /// «Fortsett» eller «Hopp over» på et gjettespørsmål, og lukk på et look-kort
    /// når fortellingen står (den startes ikke av å lukke et look-kort).
    func continueAfterPrompt() {
        let wasGuess = prompts.active?.promptKind == .guess
        prompts.dismiss()
        if wasGuess && !isPlaying { play() }
    }
}

/// Tegner ingenting uten innslag, så avspilleren ikke får tomrom.
struct ChapterPromptSlot: View {
    @Environment(AppEnvironment.self) private var env

    private var controller: ChapterPromptController { env.player.prompts }

    var body: some View {
        if let prompt = controller.active {
            ChapterPromptCard(
                prompt: prompt,
                chosenIndex: controller.chosenIndex,
                uiLang: env.settings.uiLanguage,
                onChoose: { controller.choose($0) },
                onContinue: { env.player.continueAfterPrompt() }
            )
            // Ny identitet per innslag: haptikk, annonsering og fokus kjører på nytt.
            .id(prompt.id)
        }
    }
}

struct ChapterPromptCard: View {
    let prompt: ChapterPrompt
    let chosenIndex: Int?
    let uiLang: String
    let onChoose: (Int) -> Void
    let onContinue: () -> Void

    @Environment(\.contrastColors) private var contrast
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AccessibilityFocusState private var questionFocused: Bool
    @AccessibilityFocusState private var revealFocused: Bool
    @State private var appeared = false

    private var isGuess: Bool { prompt.promptKind == .guess }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            header
            Text(prompt.text)
                .font(AppFont.cardTitle)
                .foregroundStyle(AppColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityFocused($questionFocused)
            if isGuess {
                guessContent
            }
        }
        .padding(AppSpacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                .strokeBorder(AppColor.accent, lineWidth: 1.5)
        )
        .accessibilityElement(children: .contain)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared || reduceMotion ? 0 : AppSpacing.m)
        .promptHaptic(.impact, trigger: appeared)
        .task(id: prompt.id) {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25)) { appeared = true }
            announce()
            // Gjettespørsmål krever svar: flytt fokus dit når kortet er på plass.
            guard isGuess else { return }
            try? await Task.sleep(for: .milliseconds(400))
            questionFocused = true
        }
        .onChange(of: chosenIndex) { _, newValue in
            if newValue != nil { revealFocused = true }
        }
    }

    /// Innslaget kommer utenfor fokus: les det opp. Gjettespørsmål sier også at
    /// fortellingen står.
    private func announce() {
        let message = isGuess
            ? L10n.string("prompt.guess.announcement", lang: uiLang).replacingOccurrences(of: "%@", with: prompt.text)
            : prompt.text
        AccessibilityNotification.Announcement(message).post()
    }

    private var header: some View {
        HStack(alignment: .center, spacing: AppSpacing.s) {
            Label {
                Text(isGuess ? "prompt.guess.title" : "prompt.look.title")
            } icon: {
                Image(systemName: isGuess ? "questionmark.bubble" : "eye")
            }
            .font(AppFont.chip)
            .foregroundStyle(AppColor.accent)
            .asHeader()
            Spacer(minLength: 0)
            if !isGuess {
                Button(action: onContinue) {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(AppColor.textPrimary)
                        .minTapTarget()
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel(Text("prompt.dismiss"))
            }
        }
    }

    @ViewBuilder
    private var guessContent: some View {
        let options = prompt.options ?? []
        if chosenIndex == nil {
            Text("prompt.guess.paused")
                .font(.caption)
                .foregroundStyle(contrast.textSecondary)
        }
        ForEach(Array(options.enumerated()), id: \.offset) { index, option in
            QuizOptionButton(text: option, mode: mode(of: index)) {
                onChoose(index)
            }
        }
        if let chosenIndex {
            reveal(chosen: chosenIndex)
            PrimaryButton(title: "prompt.continue", systemImage: "play.fill", action: onContinue)
        } else {
            SecondaryButton(title: "prompt.guess.skip", systemImage: "forward.fill", action: onContinue)
        }
    }

    private func reveal(chosen: Int) -> some View {
        let correct = chosen == prompt.answerIndex
        let headline = correct
            ? L10n.string("quiz.correct", lang: uiLang)
            : L10n.string("quiz.wrong", lang: uiLang).replacingOccurrences(of: "%@", with: prompt.correctOption ?? "")
        return VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(headline)
                .font(AppFont.subtitle.weight(.semibold))
                .foregroundStyle(correct ? AppColor.accent : AppColor.textPrimary)
            if let explanation = prompt.revealText, !explanation.isEmpty {
                Text(explanation)
                    .font(AppFont.body)
                    .foregroundStyle(contrast.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityFocused($revealFocused)
    }

    private func mode(of index: Int) -> QuizOptionButton.Mode {
        guard let chosenIndex else { return .open }
        if index == prompt.answerIndex { return .correct }
        if index == chosenIndex { return .wrong }
        return .locked
    }
}
