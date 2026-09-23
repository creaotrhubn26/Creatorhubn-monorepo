// AskGuideSheet.swift
//
// «Spør guiden» (pakke 3): knapp på detaljsiden og i avspilleren som åpner et
// ark med tekstfelt (tastaturets diktering gir tale inn uten nye tillatelser),
// tre forslag og svaret. Svaret bygger bare på guideteksten (se
// Core/AskGuide/AskGuideGrounding.swift), annonseres for VoiceOver når det
// kommer, får fokus og kan markeres og kopieres. Knappen vises bare når Apple
// Intelligence kan svare på brukerens språk; ellers forklarer Innstillinger hvorfor.

import SwiftUI

/// Inngangen. Tegner ingenting når funksjonen ikke er tilgjengelig.
struct AskGuideButton: View {
    let poi: GuidePOI?
    /// I avspilleren: sett fortellingen på pause mens arket er åpent, og fortsett etterpå.
    var pausesPlayer = false
    var topPadding: CGFloat = 0

    @Environment(AppEnvironment.self) private var env
    @State private var isPresented = false
    @State private var resumeOnDismiss = false

    private var language: String { env.settings.guideLanguage }

    var body: some View {
        if let poi, AskGuideGrounding.hasContent(poi), AskGuideIntelligence.live.isAvailable(for: language) {
            SecondaryButton(title: "askGuide.button", systemImage: "questionmark.bubble") {
                open()
            }
            .accessibilityHint(Text("askGuide.buttonHint"))
            .padding(.top, topPadding)
            .sheet(isPresented: $isPresented, onDismiss: { resume() }) {
                AskGuideSheet(poi: poi, language: language)
            }
        }
    }

    private func open() {
        if pausesPlayer && env.player.isPlaying {
            env.player.pause()
            resumeOnDismiss = true
        }
        isPresented = true
    }

    private func resume() {
        guard resumeOnDismiss else { return }
        resumeOnDismiss = false
        env.player.play()
    }
}

struct AskGuideSheet: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @Environment(\.dismiss) private var dismiss

    @State private var session: AskGuideSession
    @AccessibilityFocusState private var resultFocused: Bool
    @FocusState private var fieldFocused: Bool

    init(poi: GuidePOI, language: String, intelligence: AskGuideIntelligence = .live) {
        _session = State(initialValue: AskGuideSession(poi: poi, language: language, intelligence: intelligence))
    }

    private var uiLang: String { env.settings.uiLanguage }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.xl) {
                    Text(L10n.string("askGuide.intro", lang: uiLang).replacingOccurrences(of: "%@", with: session.poi.title))
                        .font(AppFont.body)
                        .foregroundStyle(contrast.textSecondary)
                    questionField
                    suggestions
                    result
                    Text("askGuide.footer")
                        .font(.caption)
                        .foregroundStyle(contrast.textTertiary)
                }
                .padding(AppSpacing.screenMargin)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(AppColor.bgBase)
            .navigationTitle("askGuide.title")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(AppColor.bgBase, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.close") { dismiss() }
                        .minTapTarget()
                }
            }
        }
        .presentationDragIndicator(.visible)
        .onChange(of: session.resultCount) { _, _ in
            announceResult()
        }
        .onDisappear { session.cancel() }
    }

    private var questionField: some View {
        VStack(alignment: .leading, spacing: AppSpacing.s) {
            Text("askGuide.fieldLabel")
                .font(AppFont.cardTitle)
                .foregroundStyle(AppColor.textPrimary)
                .accessibilityHidden(true)
            TextField(
                text: Bindable(session).question,
                prompt: Text("askGuide.placeholder").foregroundStyle(AppColor.textPlaceholder),
                axis: .vertical
            ) {
                Text("askGuide.fieldLabel")
            }
            .font(AppFont.body)
            .foregroundStyle(AppColor.textPrimary)
            .submitLabel(.send)
            .onSubmit { ask(nil) }
            .focused($fieldFocused)
            .padding(AppSpacing.l)
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
            .background(AppColor.bgElevated, in: RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous)
                    .strokeBorder(contrast.border, lineWidth: 1)
            )
            .accessibilityHint(Text("askGuide.fieldHint"))
            PrimaryButton(
                title: "askGuide.ask",
                systemImage: "paperplane.fill",
                isLoading: session.isThinking,
                isEnabled: AskGuideGrounding.normalizedQuestion(session.question) != nil
            ) {
                ask(nil)
            }
        }
    }

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: AppSpacing.s) {
            Text("askGuide.suggestions")
                .font(AppFont.subtitle.weight(.semibold))
                .foregroundStyle(contrast.textSecondary)
                .asHeader()
            ForEach(AskGuideGrounding.suggestionKeys, id: \.self) { key in
                let text = L10n.string(key, lang: uiLang)
                Button {
                    session.question = text
                    ask(text)
                } label: {
                    Text(text)
                        .font(AppFont.chip)
                        .foregroundStyle(AppColor.textPrimary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, AppSpacing.l)
                        .padding(.vertical, AppSpacing.s)
                        .frame(maxWidth: .infinity, minHeight: AppSpacing.minTapTarget, alignment: .leading)
                        .background(AppColor.bgElevated, in: RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
                        .contentShape(RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
                }
                .buttonStyle(PressableButtonStyle())
                .disabled(session.isThinking)
                .accessibilityHint(Text("askGuide.suggestionHint"))
            }
        }
    }

    @ViewBuilder
    private var result: some View {
        switch session.phase {
        case .idle:
            EmptyView()
        case .thinking:
            HStack(spacing: AppSpacing.s) {
                ProgressView().tint(AppColor.accent)
                Text("askGuide.thinking")
                    .font(AppFont.body)
                    .foregroundStyle(contrast.textSecondary)
            }
            .accessibilityElement(children: .combine)
        case let .answered(answer):
            answerCard(answer)
        case let .failed(failure):
            Text(L10n.string(failure.messageKey, lang: uiLang))
                .font(AppFont.body)
                .foregroundStyle(AppColor.error)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityFocused($resultFocused)
        }
    }

    private func answerCard(_ answer: String) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.s) {
            if let asked = session.askedQuestion {
                Text(L10n.string("askGuide.youAsked", lang: uiLang).replacingOccurrences(of: "%@", with: asked))
                    .font(.caption)
                    .foregroundStyle(contrast.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text("askGuide.answerHeading")
                .font(AppFont.cardTitle)
                .foregroundStyle(AppColor.textPrimary)
                .asHeader()
            Text(answer)
                .font(AppFont.body)
                .foregroundStyle(AppColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
                .accessibilityFocused($resultFocused)
        }
        .padding(AppSpacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
    }

    private func ask(_ text: String?) {
        fieldFocused = false
        session.ask(text)
    }

    /// Svaret (eller feilen) kommer utenfor fokus: les det opp og flytt fokus dit.
    private func announceResult() {
        let message: String
        switch session.phase {
        case let .answered(answer):
            message = L10n.string("askGuide.answerAnnouncement", lang: uiLang).replacingOccurrences(of: "%@", with: answer)
        case let .failed(failure):
            message = L10n.string(failure.messageKey, lang: uiLang)
        case .idle, .thinking:
            return
        }
        AccessibilityNotification.Announcement(message).post()
        resultFocused = true
    }
}
