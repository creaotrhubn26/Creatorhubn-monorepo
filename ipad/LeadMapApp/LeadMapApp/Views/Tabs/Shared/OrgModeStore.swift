// OrgModeStore.swift
//
// Modus-velgeren i profil-menyen (super_admin): bytt mellom solo-modus
// og valgfri org. Etter bytte refreshes alle live-stores så hele appen
// viser den valgte org-ens data.

import SwiftUI

@MainActor
@Observable
final class OrgModeStore {
    static let shared = OrgModeStore()

    private(set) var modes: [OrgModeDTO] = []
    private(set) var canSwitch = false
    private(set) var switching = false

    private weak var api: APIClient?
    private var didInitialLoad = false

    private init() {}

    func attach(api: APIClient) {
        self.api = api
        guard !didInitialLoad else { return }
        didInitialLoad = true
        Task { await load() }
    }

    func load() async {
        guard let api else { return }
        do {
            let resp = try await api.fetchOrgModes()
            self.modes = resp.modes
            self.canSwitch = resp.canSwitch
        } catch {
            print("[OrgModeStore] load feilet: \(error)")
        }
    }

    /// Bytt modus og refresh alt som er org-avhengig.
    func switchTo(_ modeId: String, appState: AppState) {
        guard let api, !switching else { return }
        switching = true
        Task {
            defer { switching = false }
            do {
                try await api.setOrgMode(modeId)
                await load()
                // Refresh alle org-avhengige datakilder så appen viser
                // den valgte modusens data umiddelbart.
                await appState.refreshAll()
                await TeamLiveStore.shared.refresh(appState: appState)
                await LeadbookLiveStore.shared.refresh()
                await LeadgridSalesTeamStore.shared.syncFromBackend()
            } catch {
                print("[OrgModeStore] bytte feilet: \(error)")
            }
        }
    }
}
