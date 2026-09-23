// SettingsView.swift
//
// Innstillinger: språk, teksting, hastighet, interaktivt (pakke 3), personvern (besøksloggen på
// serveren: samtykke, status og «slett mine data»), mock-kjøp (nullstill) og
// informasjon om demo-modus og API.

import SwiftUI

struct SettingsView: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @State private var confirmDelete = false

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
            InteractivitySettingsSection()
            privacySection
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
        .confirmationDialog("privacy.deleteConfirmTitle", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("privacy.deleteConfirm", role: .destructive) {
                Task { await env.visitSync.deleteAllServerData() }
            }
        } message: {
            Text("privacy.deleteConfirmMessage")
        }
    }

    /// GDPR: samtykke (av som standard), hva som lagres, status og sletting.
    private var privacySection: some View {
        Section {
            Toggle("privacy.syncLog", isOn: syncBinding)
                .disabled(env.visitSync.state == .syncing)
            Text(syncStatusText)
                .font(AppFont.subtitle)
                .foregroundStyle(env.visitSync.state == .failed ? AppColor.error : contrast.textSecondary)
                .accessibilityLabel(Text(syncStatusText))
            Button("privacy.deleteAll", role: .destructive) {
                confirmDelete = true
            }
            .disabled(env.visitSync.state == .syncing)
        } header: {
            Text("settings.privacy")
        } footer: {
            Text("privacy.footer")
                .foregroundStyle(contrast.textSecondary)
        }
    }

    private var syncBinding: Binding<Bool> {
        Binding(
            get: { env.settings.syncVisitsToServer },
            set: { enabled in Task { await env.visitSync.setEnabled(enabled) } }
        )
    }

    private var syncStatusText: String {
        let uiLang = env.settings.uiLanguage
        switch env.visitSync.state {
        case .off:
            return L10n.string("privacy.status.off", lang: uiLang)
        case .syncing:
            return L10n.string("privacy.status.syncing", lang: uiLang)
        case .failed:
            return L10n.string("privacy.status.failed", lang: uiLang)
        case .deleted:
            return L10n.string("privacy.status.deleted", lang: uiLang)
        case .idle:
            if env.visitSync.hasPending {
                return L10n.string("privacy.status.pending", lang: uiLang)
            }
            if let at = env.visitSync.lastSyncedAt {
                return L10n.string("privacy.status.synced", lang: uiLang)
                    .replacingOccurrences(of: "%@", with: AfterVisitView.visitDate(at, locale: env.settings.locale))
            }
            return L10n.string("privacy.status.on", lang: uiLang)
        }
    }

    private var languages: [String] {
        let fromArea = env.store.area?.languages ?? []
        return Array(Set(fromArea + AppSettings.uiLanguages)).sorted { L10n.languageName($0) < L10n.languageName($1) }
    }
}
