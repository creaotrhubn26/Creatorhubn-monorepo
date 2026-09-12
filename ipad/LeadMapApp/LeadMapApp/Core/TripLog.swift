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

// MARK: - Demo-data (Leadgrid Go)

/// Demo-turer + team-oversikt for demo-modus (salgsmøter): kjøreboka fylles
/// ellers kun av EKTE kjøring og ville stått tom i en demo. Brukes av
/// KjorebokView og LeadgridGoDashboardView — ALDRI skrevet til TripStore
/// eller backend.
enum GoDemoData {
    /// Realistiske Oslo-turer denne måneden — Skatteetaten-feltene fylt,
    /// blanding av bekreftet firma/privat + uattesterte (viser bekreft-flyten).
    static func trips() -> [Trip] {
        let now = Date()
        func trip(
            _ dagerSiden: Int, _ klokka: Int, _ fra: String, _ til: String,
            _ km: Double, _ minutter: Int, _ formaal: TripPurpose,
            bom: Double = 0
        ) -> Trip {
            let start = Calendar.current.date(
                bySettingHour: klokka, minute: 12, second: 0,
                of: Calendar.current.date(byAdding: .day, value: -dagerSiden, to: now) ?? now
            ) ?? now
            return Trip(
                startDate: start,
                endDate: start.addingTimeInterval(Double(minutter) * 60),
                startPlace: fra, endPlace: til,
                startLat: 59.91, startLon: 10.75, endLat: 59.92, endLon: 10.76,
                distanceKm: km,
                vehicleName: "Tesla Model Y", vehiclePlate: "EL 12345",
                purpose: formaal,
                mileageAmount: formaal.isBusiness ? (km * 3.5).rounded() : nil,
                tollAmount: formaal.isBusiness && bom > 0 ? bom : nil,
                source: "auto"
            )
        }
        return [
            trip(0, 8,  "Karenslyst allé 5, Oslo", "Jessheim sentrum",     38.4, 42, .unconfirmed, bom: 24),
            trip(0, 15, "Jessheim sentrum",        "Karenslyst allé 5",    39.1, 47, .unconfirmed, bom: 24),
            trip(1, 9,  "Karenslyst allé 5, Oslo", "Ski storsenter",       27.2, 34, .business,    bom: 31),
            trip(1, 16, "Ski storsenter",          "Karenslyst allé 5",    26.8, 38, .business,    bom: 31),
            trip(2, 8,  "Hjemme, Nordstrand",      "Karenslyst allé 5",    11.3, 24, .commute),
            trip(3, 10, "Karenslyst allé 5, Oslo", "Drammen sentrum",      41.6, 39, .business,    bom: 47),
            trip(3, 17, "Drammen sentrum",         "Karenslyst allé 5",    42.0, 44, .business,    bom: 47),
            trip(4, 18, "Karenslyst allé 5, Oslo", "SATS Colosseum",        4.2, 12, .privateUse),
            trip(6, 9,  "Karenslyst allé 5, Oslo", "Lillestrøm torv",      21.7, 28, .business,    bom: 29),
            trip(6, 15, "Lillestrøm torv",         "Karenslyst allé 5",    22.1, 33, .business,    bom: 29),
        ]
    }

    /// Admin-team-oversikten (Go Dashboard) med samme demo-selgere som resten
    /// av appen. EU-frist beregnes relativt så varsel-chippen alltid vises.
    static func team() -> GoTeamResponse {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let euSoon = df.string(from: Calendar.current.date(byAdding: .day, value: 38, to: Date()) ?? Date())
        func driver(
            _ id: String, _ name: String, _ role: String, _ trips: Int,
            _ businessKm: Double, _ unconfirmed: Int,
            vehicle: String?, plate: String?, company: Bool, fuel: String?,
            eu: String? = nil
        ) -> GoDriverSummary {
            GoDriverSummary(
                userId: id, name: name, role: role, trips: trips,
                km: businessKm * 1.2, businessKm: businessKm,
                amount: (businessKm * 3.5).rounded(), tolls: (businessKm * 0.9).rounded(),
                unconfirmed: unconfirmed,
                vehicleName: vehicle, vehiclePlate: plate, isCompanyCar: company,
                vehicleFuel: fuel, euControlDue: eu, lastTrip: nil
            )
        }
        let drivers = [
            driver("demo-espen",  "Espen Berg",      "salgskonsulent", 42, 611, 2, vehicle: "Tesla Model Y",  plate: "EL 12345", company: true,  fuel: "elektrisk"),
            driver("demo-marit",  "Marit Johansen",  "teamleder",      38, 548, 0, vehicle: "VW ID.4",        plate: "EK 98765", company: true,  fuel: "elektrisk", eu: euSoon),
            driver("demo-lars",   "Lars Erik Moen",  "salgskonsulent", 31, 402, 1, vehicle: "Toyota Corolla", plate: "DR 45678", company: false, fuel: "hybrid"),
            driver("demo-helena", "Helena Dahl",     "salgskonsulent", 27, 356, 0, vehicle: "Tesla Model 3",  plate: "EL 55443", company: true,  fuel: "elektrisk"),
            driver("demo-aaron",  "Aaron Nilsen",    "promotor",       12, 118, 1, vehicle: nil,              plate: nil,        company: false, fuel: nil),
        ]
        return GoTeamResponse(
            role: "admin",
            drivers: drivers,
            totals: GoTeamTotals(
                drivers: drivers.count,
                activeDrivers: drivers.filter { $0.trips > 0 }.count,
                km: drivers.reduce(0) { $0 + $1.businessKm },
                amount: drivers.reduce(0) { $0 + $1.amount },
                tolls: drivers.reduce(0) { $0 + $1.tolls },
                unconfirmed: drivers.reduce(0) { $0 + $1.unconfirmed }
            )
        )
    }
}
