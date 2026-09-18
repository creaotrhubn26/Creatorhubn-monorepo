// SettingsView.swift
//
// Innstillinger: språk, teksting, hastighet, mock-kjøp (nullstill) og
// informasjon om demo-modus og API.

import SwiftUI

struct SettingsView: View {
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        @Bindable var settings = env.settings
        List {
            Section("settings.language") {
                Picker("language.label", selection: $settings.guideLanguage) {
                    ForEach(languages, id: \.self) { code in
                        Text(L10n.languageName(code)).tag(code)
                    }
                }
                .pickerStyle(.navigationLink)
            }
            Section("settings.playback") {
                Toggle("captions.label", isOn: $settings.captionsEnabled)
                Picker("player.rate", selection: $settings.playbackRate) {
                    ForEach(PlayerViewModel.rates, id: \.self) { rate in
                        Text("\(rate.formatted(.number.precision(.fractionLength(0 ... 2))))×").tag(rate)
                    }
                }
            }
            Section("settings.demo") {
                if let area = env.store.area {
                    LabeledContent("settings.area", value: area.name)
                    LabeledContent("settings.unlocked", value: L10n.string(settings.isUnlocked(areaId: area.id) ? "state.yes" : "state.no", lang: settings.uiLanguage))
                    if settings.isUnlocked(areaId: area.id) {
                        Button("settings.resetPurchase", role: .destructive) {
                            settings.lock(areaId: area.id)
                        }
                    }
                }
                LabeledContent("settings.api", value: GuideAPIClient.baseURL.host() ?? GuideAPIClient.baseURL.absoluteString)
                if case let .loaded(_, fromCache) = env.store.state, fromCache {
                    Label("settings.offlineCache", systemImage: "wifi.slash")
                        .foregroundStyle(AppColor.textSecondary)
                }
                Button("settings.reload") {
                    Task { await env.store.load(lang: settings.guideLanguage) }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(AppColor.bgBase)
        .navigationTitle("tab.settings")
        .toolbarBackground(AppColor.bgBase, for: .navigationBar)
    }

    private var languages: [String] {
        let fromArea = env.store.area?.languages ?? []
        return Array(Set(fromArea + AppSettings.uiLanguages)).sorted { L10n.languageName($0) < L10n.languageName($1) }
    }
}
