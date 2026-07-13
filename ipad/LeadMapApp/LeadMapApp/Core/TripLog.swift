// TripLog.swift
//
// Leadgrid Go — elektronisk kjørebok. Modell + lokal store for automatisk
// loggede kjøreturer. Hver fullført nav-tur opprettes automatisk som en `Trip`;
// føreren bekrefter kun formål (firma/privat) — Skatteetaten krever at formålet
// attesteres, det kan ikke være 100 % automatisk.
//
// Fase 1 MVP: lokal persistens (UserDefaults JSON). Fase 1b: backend-sync +
// PDF/Excel-eksport + auto-rapport. Bygger på nav-motoren og «Min bil».

import Foundation
import CoreLocation

/// Formål for en kjøretur — Skatteetaten skiller yrkeskjøring (firma) fra privat.
enum TripPurpose: String, Codable, CaseIterable, Hashable {
    case unconfirmed   // auto-logget, venter på førers bekreftelse
    case business      // yrkeskjøring (firma)
    case commute       // arbeidsreise (hjem↔fast arbeidssted)
    case privateUse    // privat

    var label: String {
        switch self {
        case .unconfirmed: return "Ikke bekreftet"
        case .business:    return "Firma"
        case .commute:     return "Arbeidsreise"
        case .privateUse:  return "Privat"
        }
    }
    var icon: String {
        switch self {
        case .unconfirmed: return "questionmark.circle"
        case .business:    return "briefcase.fill"
        case .commute:     return "building.2.fill"
        case .privateUse:  return "house.fill"
        }
    }
    /// Teller som fradragsberettiget yrkeskjøring i kjørebok-summer.
    var isBusiness: Bool { self == .business }
}

struct Trip: Codable, Identifiable, Hashable {
    var id: UUID = UUID()
    var startDate: Date
    var endDate: Date
    var startPlace: String
    var endPlace: String
    var startLat: Double
    var startLon: Double
    var endLat: Double
    var endLon: Double
    var distanceKm: Double
    var vehicleName: String?     // «Tesla Model Y» fra Min bil
    var vehiclePlate: String?
    var purpose: TripPurpose = .unconfirmed
    var note: String = ""
    /// Beregnet kjøregodtgjørelse (kr) og bom (kr) fra nav-motoren, hvis kjent.
    var mileageAmount: Double?
    var tollAmount: Double?
    /// Kilde: «auto» (nav-motor) eller «manual».
    var source: String = "auto"

    var durationMin: Int { max(0, Int(endDate.timeIntervalSince(startDate) / 60)) }
}

/// Lokal kjørebok-store (@Observable → SwiftUI-oppdatering). Persisteres i
/// UserDefaults som JSON. Nyeste tur først.
@MainActor
@Observable
final class TripStore {
    static let shared = TripStore()

    private(set) var trips: [Trip] = []
    private let key = "leadgrid.go.trips"

    init() { load() }

    // MARK: mutasjon

    /// Legg til en auto-logget tur (fra fullført nav). Dedup på nær-identisk
    /// start/slutt-tid + distanse så en tur ikke logges dobbelt.
    @discardableResult
    func add(_ trip: Trip) -> Bool {
        let dup = trips.contains {
            abs($0.startDate.timeIntervalSince(trip.startDate)) < 120 &&
            abs($0.distanceKm - trip.distanceKm) < 0.3
        }
        guard !dup else { return false }
        trips.insert(trip, at: 0)
        save()
        return true
    }

    func setPurpose(_ purpose: TripPurpose, for id: Trip.ID) {
        guard let i = trips.firstIndex(where: { $0.id == id }) else { return }
        trips[i].purpose = purpose
        save()
    }

    func setNote(_ note: String, for id: Trip.ID) {
        guard let i = trips.firstIndex(where: { $0.id == id }) else { return }
        trips[i].note = note
        save()
    }

    func update(_ trip: Trip) {
        guard let i = trips.firstIndex(where: { $0.id == trip.id }) else { return }
        trips[i] = trip
        save()
    }

    func delete(_ id: Trip.ID) {
        trips.removeAll { $0.id == id }
        save()
    }

    /// Erstatt lokal liste med autoritativ server-liste (etter synk).
    func replaceAll(_ serverTrips: [Trip]) {
        trips = serverTrips.sorted { $0.startDate > $1.startDate }
        save()
    }

    // MARK: avledet

    var unconfirmedCount: Int { trips.filter { $0.purpose == .unconfirmed }.count }

    /// Turer i en gitt måned (kalender-lokal).
    func trips(inMonth date: Date) -> [Trip] {
        let cal = Calendar.current
        return trips.filter { cal.isDate($0.startDate, equalTo: date, toGranularity: .month) }
    }

    /// Sum yrkeskjøring-km + kjøregodtgjørelse for en måned.
    func businessSummary(inMonth date: Date) -> (km: Double, amount: Double, tolls: Double) {
        let month = trips(inMonth: date).filter { $0.purpose.isBusiness }
        return (
            km: month.reduce(0) { $0 + $1.distanceKm },
            amount: month.reduce(0) { $0 + ($1.mileageAmount ?? 0) },
            tolls: month.reduce(0) { $0 + ($1.tollAmount ?? 0) }
        )
    }

    // MARK: persistens

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let t = try? JSONDecoder().decode([Trip].self, from: data) else { return }
        trips = t
    }
    private func save() {
        if let data = try? JSONEncoder().encode(trips) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
