// VisitSync.swift
//
// Speiler besøksloggen til serveren (Daniel 18.09.2026: «ja vil ha loggen på
// serveren … samtidig er det viktig med GDPR»). Telefonen er kilden; serveren
// får bare det brukeren har samtykket til, og bare når bryteren
// «Lagre loggen på serveren» er på (AppSettings.syncVisitsToServer, av som
// standard).
//
// Slik virker det:
//   * VisitLogStore melder hver endring (onEntryChanged/onEntryRemoved). Med
//     samtykke havner id-en i en kø, og en kort debounce samler flere
//     endringer (start, fullført, stjerner, quiz) i én PUT.
//   * Feiler nettet, blir køen stående og sendes ved neste endring eller når
//     appen kommer i forgrunnen (ReiseguideApp kaller flush()).
//   * Slås bryteren på, sendes hele loggen. Slås den av, slettes loggen på
//     serveren (vurderinger beholdes, de er anonyme snitt).
//   * «Slett mine data på serveren» sletter alt om enheten (også vurderinger)
//     og gir appen ny enhets-ID, så ingenting kan kobles til det gamle.
//
// Nettverket er abstrahert bak VisitSyncTransport så logikken testes uten
// URLSession (ReiseguideTests/VisitSyncTests.swift).

import Foundation
import Observation

protocol VisitSyncTransport: Sendable {
    func syncVisits(deviceId: String, visits: [VisitEntry]) async throws -> VisitSyncResponse
    func deleteVisit(deviceId: String, id: String) async throws
    func deleteVisits(deviceId: String) async throws
    func deleteDeviceData(deviceId: String) async throws -> DeviceDeletionResponse
}

@MainActor
@Observable
final class VisitSync {
    enum State: Equatable {
        /// Samtykke ikke gitt: ingenting sendes.
        case off
        case idle
        case syncing
        case failed
        /// Alt om enheten er nettopp slettet på serveren.
        case deleted
    }

    private(set) var state: State
    private(set) var lastSyncedAt: Date?
    /// Oppbevaringstid serveren oppga sist (dager); nil før første synk.
    private(set) var retentionDays: Int?
    /// Besøk som er endret lokalt, men ikke bekreftet av serveren.
    private(set) var pendingIds: Set<String> = []
    private(set) var pendingDeletes: Set<String> = []

    @ObservationIgnored private let settings: AppSettings
    @ObservationIgnored private let visits: VisitLogStore
    @ObservationIgnored private let transport: any VisitSyncTransport
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let debounce: Duration
    @ObservationIgnored private(set) var scheduledFlush: Task<Void, Never>?

    var isEnabled: Bool { settings.syncVisitsToServer }

    var hasPending: Bool { !pendingIds.isEmpty || !pendingDeletes.isEmpty }

    init(
        settings: AppSettings,
        visits: VisitLogStore,
        transport: any VisitSyncTransport,
        now: @escaping () -> Date = { Date() },
        debounce: Duration = .seconds(2)
    ) {
        self.settings = settings
        self.visits = visits
        self.transport = transport
        self.now = now
        self.debounce = debounce
        state = settings.syncVisitsToServer ? .idle : .off
        visits.onEntryChanged = { [weak self] entry in self?.entryChanged(entry) }
        visits.onEntryRemoved = { [weak self] id in self?.entryRemoved(id) }
    }

    /// Bryteren i Personvern. På: hele loggen sendes. Av: loggen slettes på serveren.
    func setEnabled(_ enabled: Bool) async {
        scheduledFlush?.cancel()
        scheduledFlush = nil
        settings.syncVisitsToServer = enabled
        if enabled {
            pendingIds = Set(visits.entries.map(\.id))
            pendingDeletes = []
            state = .idle
            await flush()
        } else {
            pendingIds = []
            pendingDeletes = []
            state = .syncing
            do {
                try await transport.deleteVisits(deviceId: settings.deviceId)
                state = .off
            } catch {
                // Bryteren er av uansett; sletting prøves igjen neste gang den slås av.
                state = .failed
            }
        }
    }

    /// Sender alt som venter. Trygg å kalle når som helst (ingenting å gjøre → returnerer).
    func flush() async {
        guard isEnabled, hasPending, state != .syncing else { return }
        state = .syncing
        for id in pendingDeletes.sorted() {
            do {
                try await transport.deleteVisit(deviceId: settings.deviceId, id: id)
                pendingDeletes.remove(id)
            } catch {
                state = .failed
                return
            }
        }
        let batch = visits.entries.filter { pendingIds.contains($0.id) }
        // Oppføringer som er borte lokalt, skal ikke sendes.
        pendingIds = Set(batch.map(\.id))
        guard !batch.isEmpty else {
            state = .idle
            return
        }
        do {
            let response = try await transport.syncVisits(deviceId: settings.deviceId, visits: batch)
            pendingIds.subtract(batch.map(\.id))
            retentionDays = response.retentionDays
            lastSyncedAt = now()
            state = .idle
        } catch {
            state = .failed
        }
    }

    /// Retten til sletting: alt på serveren fjernes, og enheten får ny ID.
    /// Loggen på telefonen beholdes. Returnerer om serveren bekreftet.
    @discardableResult
    func deleteAllServerData() async -> Bool {
        scheduledFlush?.cancel()
        scheduledFlush = nil
        state = .syncing
        do {
            _ = try await transport.deleteDeviceData(deviceId: settings.deviceId)
            settings.resetDeviceId()
            settings.syncVisitsToServer = false
            pendingIds = []
            pendingDeletes = []
            lastSyncedAt = nil
            state = .deleted
            return true
        } catch {
            state = .failed
            return false
        }
    }

    // MARK: - Privat

    private func entryChanged(_ entry: VisitEntry) {
        guard isEnabled else { return }
        pendingIds.insert(entry.id)
        pendingDeletes.remove(entry.id)
        scheduleFlush()
    }

    private func entryRemoved(_ id: String) {
        guard isEnabled else { return }
        pendingIds.remove(id)
        pendingDeletes.insert(id)
        scheduleFlush()
    }

    private func scheduleFlush() {
        scheduledFlush?.cancel()
        let delay = debounce
        scheduledFlush = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await self?.flush()
        }
    }
}
