// WatchPondusStore.swift
//
// @Observable-store for Pondus-templates på Apple Watch. Persisterer i
// UserDefaults slik at Watch har innhold umiddelbart ved neste app-load
// selv om WCSession ikke er ferdig aktivert enda.
//
// Data-flyt:
//   iPhone (PondusStore.load) → PondusWatchSync.push (transferUserInfo) →
//   PhoneSession (didReceiveUserInfo) → WatchPondusStore.apply
//
// Setting active template:
//   Watch-UI → WatchPondusStore.setActive → PhoneSession.sendPondusActivate →
//   iPhone (PondusWatchSync.handleIncomingMessage) → NotificationCenter →
//   LeadbookView switcher til .pondus + setter selected.

import Foundation
import Observation

@MainActor
@Observable
final class WatchPondusStore {
    static let shared = WatchPondusStore()

    private(set) var templates: [WatchPondusTemplate] = []
    private(set) var activeTemplate: WatchPondusTemplate?
    private(set) var lastSync: Date?

    private let storageKey = "leadgrid.watch.pondus.templates.v1"
    private let activeKey = "leadgrid.watch.pondus.active.v1"

    init() {
        loadFromDisk()
    }

    // MARK: - Public API

    /// Kall ved app-oppstart hvis vi ikke har data enda — Watch venter da
    /// på at iPhone-siden pusher via transferUserInfo. Vi kan ikke pull-e
    /// fra Watch; iPhone sender når `PondusStore.templates` endres.
    func load() {
        // No-op ved oppstart — data kommer via PhoneSession.
        // Delegat kaller `apply(_:)` når payload lander.
    }

    /// Kalles av PhoneSession når iPhone pusher templates.
    func apply(_ next: [WatchPondusTemplate]) {
        self.templates = next
        self.lastSync = Date()
        if next.isEmpty {
            // Tom liste = iPhone gated bort Pondus (mistet tilgang) →
            // fjern også aktiv mal, ellers henger et lynkort igjen i
            // «Aktive steg»-fanen.
            self.activeTemplate = nil
        } else if let current = activeTemplate,
                  let refreshed = next.first(where: { $0.id == current.id }) {
            // Aktiv mal finnes fortsatt — oppdater (score kan ha endret seg).
            self.activeTemplate = refreshed
        } else if activeTemplate == nil || !next.contains(where: { $0.id == activeTemplate?.id }) {
            // Ingen (gyldig) aktiv mal → auto-velg første så fanen ikke er tom.
            self.activeTemplate = next.first
        }
        saveToDisk()
    }

    /// Brukeren valgte en mal på Watch. Vi speiler til iPhone slik at
    /// hovedappen kan bytte til Leadbook > Pondus med samme valg.
    func setActive(_ template: WatchPondusTemplate) {
        self.activeTemplate = template
        saveToDisk()
        // Fire-and-forget — PhoneSession håndterer kø hvis iPhone er offline.
        PhoneSession.shared.sendPondusActivate(templateId: template.id)
    }

    // MARK: - Persistence

    private func loadFromDisk() {
        let defaults = UserDefaults.standard
        if let data = defaults.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode([WatchPondusTemplate].self, from: data) {
            self.templates = decoded
        }
        if let activeId = defaults.string(forKey: activeKey),
           let match = templates.first(where: { $0.id == activeId }) {
            self.activeTemplate = match
        }
    }

    private func saveToDisk() {
        let defaults = UserDefaults.standard
        if let data = try? JSONEncoder().encode(templates) {
            defaults.set(data, forKey: storageKey)
        }
        if let activeId = activeTemplate?.id {
            defaults.set(activeId, forKey: activeKey)
        } else {
            defaults.removeObject(forKey: activeKey)
        }
    }
}
