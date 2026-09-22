// QuizCardView.swift
//
// Den korte quizen etter besøket: intro → ett spørsmål om gangen med fasit og
// forklaring → resultat. Tilstanden ligger i QuizSession (Core), her er bare
// visningen. `onFinished` kalles én gang når siste spørsmål er besvart.

import SwiftUI

struct QuizCardView: View {
    let questions: [QuizQuestion]
    let onFinished: (_ correct: Int, _ total: Int) -> Void

    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast

    @State private var quiz: QuizSession
    @State private var started = false

    init(questions: [QuizQuestion], onFinished: @escaping (_ correct: Int, _ total: Int) -> Void) {
        self.questions = questions
        self.onFinished = onFinished
        _quiz = State(initialValue: QuizSession(questions: questions))
    }

    private var uiLang: String { env.settings.uiLanguage }

    var body: some View {
        SectionCard(title: "quiz.title") {
            if quiz.isEmpty {
                Text("quiz.none")
                    .font(AppFont.body)
                    .foregroundStyle(contrast.textSecondary)
            } else if !started {
                Text("quiz.intro")
                    .font(AppFont.body)
                    .foregroundStyle(contrast.textSecondary)
                PrimaryButton(title: "quiz.start", systemImage: "questionmark.circle") {
                    started = true
                }
            } else if quiz.isFinished {
                result
            } else if let question = quiz.current {
                questionView(question)
            }
        }
    }

    private func questionView(_ question: QuizQuestion) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            Text(L10n.string("quiz.progress", lang: uiLang)
                .replacingOccurrences(of: "%1$@", with: String(quiz.index + 1))
                .replacingOccurrences(of: "%2$@", with: String(quiz.total)))
                .font(.caption)
                .foregroundStyle(contrast.textTertiary)
            Text(question.question)
                .font(AppFont.cardTitle)
                .foregroundStyle(AppColor.textPrimary)
                .asHeader()
            ForEach(Array(question.options.enumerated()), id: \.offset) { index, option in
                QuizOptionButton(text: option, mode: mode(of: index, question: question)) {
                    quiz.answer(index)
                }
            }
            if let chosen = quiz.currentAnswer {
                feedback(question, chosen: chosen)
                PrimaryButton(title: quiz.isLastQuestion ? "quiz.finish" : "quiz.next", systemImage: "arrow.right") {
                    advance()
                }
            }
        }
    }

    private func feedback(_ question: QuizQuestion, chosen: Int) -> some View {
        let correct = chosen == question.correctIndex
        let headline = correct
            ? L10n.string("quiz.correct", lang: uiLang)
            : L10n.string("quiz.wrong", lang: uiLang).replacingOccurrences(of: "%@", with: question.options[question.correctIndex])
        return VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(headline)
                .font(AppFont.subtitle.weight(.semibold))
                .foregroundStyle(correct ? AppColor.accent : AppColor.textPrimary)
            if let explanation = question.explanation {
                Text(explanation)
                    .font(AppFont.body)
                    .foregroundStyle(contrast.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var result: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            Text(L10n.string("quiz.result", lang: uiLang)
                .replacingOccurrences(of: "%1$@", with: String(quiz.correctCount))
                .replacingOccurrences(of: "%2$@", with: String(quiz.total)))
                .font(AppFont.cardTitle)
                .foregroundStyle(AppColor.textPrimary)
            Text(resultKey)
                .font(AppFont.body)
                .foregroundStyle(contrast.textSecondary)
            SecondaryButton(title: "quiz.again", systemImage: "arrow.counterclockwise") {
                quiz.restart()
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var resultKey: LocalizedStringKey {
        if quiz.correctCount == quiz.total { return "quiz.perfect" }
        if quiz.correctCount * 2 >= quiz.total { return "quiz.good" }
        return "quiz.ok"
    }

    private func mode(of index: Int, question: QuizQuestion) -> QuizOptionButton.Mode {
        guard let chosen = quiz.currentAnswer else { return .open }
        if index == question.correctIndex { return .correct }
        if index == chosen { return .wrong }
        return .locked
    }

    private func advance() {
        let wasLast = quiz.isLastQuestion
        quiz.next()
        if wasLast {
            onFinished(quiz.correctCount, quiz.total)
        }
    }
}

/// Svaralternativ: åpent, riktig (accent), feil valgt (error) eller låst.
struct QuizOptionButton: View {
    enum Mode: Equatable {
        case open, correct, wrong, locked
    }

    let text: String
    let mode: Mode
    let action: () -> Void

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.m) {
                Image(systemName: icon)
                    .foregroundStyle(iconColor)
                    .accessibilityHidden(true)
                Text(text)
                    .font(AppFont.body)
                    .foregroundStyle(mode == .locked ? contrast.textSecondary : AppColor.textPrimary)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, AppSpacing.l)
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
            .background(AppColor.bgElevated, in: RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: mode == .open ? 1 : 2)
            )
            .contentShape(RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(mode != .open)
        .accessibilityValue(Text(accessibilityValueKey))
    }

    private var icon: String {
        switch mode {
        case .open, .locked: return "circle"
        case .correct: return "checkmark.circle.fill"
        case .wrong: return "xmark.circle.fill"
        }
    }

    private var iconColor: Color {
        switch mode {
        case .open: return contrast.textSecondary
        case .correct: return AppColor.accent
        case .wrong: return AppColor.error
        case .locked: return contrast.textTertiary
        }
    }

    private var borderColor: Color {
        switch mode {
        case .open, .locked: return contrast.border
        case .correct: return AppColor.accent
        case .wrong: return AppColor.error
        }
    }

    private var accessibilityValueKey: LocalizedStringKey {
        switch mode {
        case .open, .locked: return ""
        case .correct: return "quiz.option.correct"
        case .wrong: return "quiz.option.wrong"
        }
    }
}
