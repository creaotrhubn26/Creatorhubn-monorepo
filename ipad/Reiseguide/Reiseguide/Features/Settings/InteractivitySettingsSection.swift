// InteractivitySettingsSection.swift
//
// Innstillinger for pakke 3: «Spørsmål underveis» av/på (standard PÅ) og én
// linje om «Spør guiden»: at svarene lages på telefonen, eller hvorfor
// funksjonen ikke er tilgjengelig (iOS-versjon, enhet, Apple Intelligence av,
// modellen lastes ned, språket støttes ikke).

import SwiftUI

struct InteractivitySettingsSection: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast

    var body: some View {
        @Bindable var settings = env.settings
        Section {
            Toggle("prompts.setting", isOn: $settings.inNarrationPromptsEnabled)
                .accessibilityHint(Text("prompts.settingHint"))
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("askGuide.title")
                    .font(AppFont.body)
                    .foregroundStyle(AppColor.textPrimary)
                Text(askGuideStatus)
                    .font(AppFont.subtitle)
                    .foregroundStyle(contrast.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityElement(children: .combine)
        } header: {
            Text("settings.duringStory")
        } footer: {
            Text("prompts.settingFooter")
                .foregroundStyle(contrast.textSecondary)
        }
    }

    private var askGuideStatus: String {
        let key: String
        switch AskGuideIntelligence.live.availability(for: env.settings.guideLanguage) {
        case .available:
            key = "askGuide.status.available"
        case let .unavailable(reason):
            key = reason.messageKey
        }
        return L10n.string(key, lang: env.settings.uiLanguage)
    }
}
