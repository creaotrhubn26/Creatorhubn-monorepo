// SessionStore.swift — Spotting Session: fanger konteksten rundt en
// fotoøkt. Start → capture-events fra CCAPI teller bilder og knytter
// nærmeste fly → stopp gir oppsummering.

import Foundation
import Observation
import CoreLocation

struct SessionAircraft: Identifiable, Sendable {
    let id: String
    let callsign: String
    let aircraftType: String?
    let rarity: Rarity
    var photoCount: Int
}

struct SessionSummary: Identifiable, Sendable {
    let id = UUID()
    let start: Date
    let end: Date
    let photoCount: Int
    let aircraft: [SessionAircraft]
    let locationName: String?
    let runway: String?

    var duration: TimeInterval { end.timeIntervalSince(start) }
    var rareCount: Int { aircraft.filter { $0.rarity.rank >= 2 }.count }
}

@MainActor
@Observable
final class SessionStore {
    private(set) var isActive = false
    private(set) var startedAt: Date?
    private(set) var photoCount = 0
    private(set) var aircraft: [String: SessionAircraft] = [:]
    private(set) var locationName: String?
    private(set) var runway: String?
    var lastSummary: SessionSummary?

    func start(locationName: String?, runway: String?) {
        isActive = true
        startedAt = Date()
        photoCount = 0
        aircraft = [:]
        self.locationName = locationName
        self.runway = runway
    }

    /// Kalles på hvert CCAPI capture-event med nærmeste fly (om noe).
    func registerCapture(nearest: LiveFlight?) {
        guard isActive else { return }
        photoCount += 1
        guard let flight = nearest else { return }
        if var existing = aircraft[flight.id] {
            existing.photoCount += 1
            aircraft[flight.id] = existing
        } else {
            aircraft[flight.id] = SessionAircraft(
                id: flight.id,
                callsign: flight.callsign,
                aircraftType: flight.aircraftType,
                rarity: flight.rarity,
                photoCount: 1
            )
        }
    }

    func stop() {
        guard isActive, let start = startedAt else { return }
        lastSummary = SessionSummary(
            start: start,
            end: Date(),
            photoCount: photoCount,
            aircraft: Array(aircraft.values).sorted { $0.photoCount > $1.photoCount },
            locationName: locationName,
            runway: runway
        )
        isActive = false
        startedAt = nil
    }
}
