// EnturService.swift
//
// Kollektiv- og mobilitets-data via Leadgrid-backendens Entur-proxy
// (`/api/leadgrid/entur/*`). Speiler KartverketService: klienten snakker
// aldri direkte med Entur (cache + ET-Client-Name + attribusjon ligger
// server-side), bare med vår egen backend.
//
// To bruk:
//   1) reachability(lat:lon:) → hvor lett en lead er å nå kollektivt
//      (score + nærmeste holdeplass + avganger + el-sparkesykler).
//   2) alternatives(from:to:walkMin:) → «raskere alternativ» under
//      navigering (kollektiv/sparkesykkel som slår gå-ETA-en).
//
// NB: backend sender snake_case JSON; APIClient._get dekoder med
// .convertFromSnakeCase, så feltnavnene her er camelCase (samme mønster
// som KartverketService). Query bygges med streng-konkat — IKKE
// appendingPathComponent (den percent-koder `?` og bryter ruteren).

import Foundation
import CoreLocation

@MainActor
final class EnturService {
    static let shared = EnturService()

    // MARK: - Reachability

    struct Reachability: Decodable, Sendable {
        struct Stop: Decodable, Sendable, Identifiable {
            let id: String
            let name: String
            let distanceM: Int
            let modes: [String]
        }
        struct NearestStop: Decodable, Sendable {
            let id: String
            let name: String
            let distanceM: Int
            let modes: [String]
            let walkMin: Int
        }
        struct Departure: Decodable, Sendable, Identifiable {
            let line: String
            let mode: String
            let destination: String
            let expectedTime: String
            let inMin: Int
            let realtime: Bool
            var id: String { "\(line)-\(destination)-\(expectedTime)" }
        }
        struct Micromobility: Decodable, Sendable {
            let scooters: Int
            let bikes: Int
            let nearestM: Int?
            let operators: [String]
        }
        struct Components: Decodable, Sendable {
            let walk: Int
            let freq: Int
            let mode: Int
            let micro: Int
        }
        let score: Int?
        let label: String
        let nearestStop: NearestStop?
        let stops: [Stop]
        let departures: [Departure]
        let micromobility: Micromobility
        let components: Components
    }

    /// Hent tilgjengelighet for en lead-koordinat. Returnerer nil ved feil
    /// (UI viser da bare ingenting — aldri blokkerende).
    func reachability(lat: Double, lon: Double, using api: APIClient?) async -> Reachability? {
        guard let api else { return nil }
        let path = "/api/leadgrid/entur/reachability?lat=\(lat)&lon=\(lon)"
        return try? await api._get(path)
    }

    // MARK: - Raskere alternativ

    struct Alternative: Decodable, Sendable, Identifiable {
        let kind: String          // "transit" | "scooter"
        let etaMin: Int
        let savedMin: Int?
        let headline: String
        let detail: String
        let distanceM: Int?
        let rentalUrl: String?    // deep-link til operatør-app (kun scooter)
        var id: String { "\(kind)-\(headline)" }
    }

    private struct AlternativesDTO: Decodable { let alternatives: [Alternative] }

    /// Foreslå raskere transport enn å gå fra `from` til `to`. `walkMin` er
    /// brukerens gjeldende gå-ETA (min) — backend beholder kun alternativer
    /// som faktisk er raskere.
    func alternatives(
        from: CLLocationCoordinate2D,
        to: CLLocationCoordinate2D,
        walkMin: Int,
        using api: APIClient?
    ) async -> [Alternative] {
        guard let api else { return [] }
        let path = "/api/leadgrid/entur/alternatives"
            + "?fromLat=\(from.latitude)&fromLon=\(from.longitude)"
            + "&toLat=\(to.latitude)&toLon=\(to.longitude)&walkMin=\(walkMin)"
        let dto: AlternativesDTO? = try? await api._get(path)
        return dto?.alternatives ?? []
    }

    // MARK: - Presentasjon

    /// Farge for score-etiketten (grønn → rød).
    static func labelColor(_ label: String) -> (r: Double, g: Double, b: Double) {
        switch label {
        case "Utmerket": return (0.20, 0.85, 0.55)
        case "God":      return (0.45, 0.80, 0.45)
        case "Grei":     return (1.00, 0.72, 0.20)
        default:          return (1.00, 0.45, 0.35)
        }
    }

    /// SF Symbol for en kollektiv-modus.
    static func modeIcon(_ mode: String) -> String {
        switch mode.lowercased() {
        case "bus", "coach": return "bus.fill"
        case "tram":         return "tram.fill"
        case "rail":         return "tram.fill"    // tog
        case "metro":        return "tram.tunnel.fill"
        case "water":        return "ferry.fill"
        default:              return "location.fill"
        }
    }
}
