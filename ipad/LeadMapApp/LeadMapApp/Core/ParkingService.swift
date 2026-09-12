// ParkingService.swift
//
// Bilparkering via Leadgrid-backendens proxy mot Statens vegvesens åpne
// Parkeringsregister (`/api/leadgrid/parking/*`). Finner nærmeste
// p-områder for en lead + operatør + gangavstand, og hvilke parkerings-
// apper selgeren kan åpne for å starte parkeringen.
//
// Registeret har ingen pris (den står på skiltet) — vi viser operatør +
// kapasitet ærlig og lar operatørens app håndtere betaling. Streng-konkat
// på query (IKKE appendingPathComponent → percent-koder `?`).

import Foundation
import CoreLocation

@MainActor
final class ParkingService {
    static let shared = ParkingService()

    struct Area: Decodable, Sendable, Identifiable {
        let id: Int
        let navn: String
        let adresse: String
        let poststed: String
        let `operator`: String
        let lat: Double
        let lon: Double
        let distanceM: Int
        let walkMin: Int
    }

    struct ParkingApp: Decodable, Sendable, Identifiable {
        let name: String
        let url: String
        var id: String { name }
    }

    struct NearbyResult: Decodable, Sendable {
        let areas: [Area]
        let apps: [ParkingApp]
    }

    struct Detail: Decodable, Sendable {
        let id: Int
        let navn: String
        let type: String
        let paidSpaces: Int
        let freeSpaces: Int
        let totalSpaces: Int
        let chargingSpaces: Int
        let accessibleSpaces: Int
        let parkAndRide: Bool
    }

    /// Nærmeste p-områder for en lead-koordinat. Tom ved feil (aldri blokkerende).
    func nearby(
        lat: Double, lon: Double, radius: Int = 900, limit: Int = 4, using api: APIClient?
    ) async -> NearbyResult {
        guard let api else { return NearbyResult(areas: [], apps: []) }
        let path = "/api/leadgrid/parking/nearby"
            + "?lat=\(lat)&lon=\(lon)&radius=\(radius)&limit=\(limit)"
        let r: NearbyResult? = try? await api._get(path)
        return r ?? NearbyResult(areas: [], apps: [])
    }

    /// Full detalj (type, plasser, lade/HC) — hentes on-tap.
    func detail(id: Int, using api: APIClient?) async -> Detail? {
        guard let api else { return nil }
        return try? await api._get("/api/leadgrid/parking/\(id)")
    }

    /// Norsk etikett for områdetype.
    static func typeLabel(_ type: String) -> String {
        switch type {
        case "PARKERINGSHUS": return "P-hus"
        case "LANGS_KJOREBANE": return "Langs vei"
        case "AVGRENSET_OMRADE": return "P-plass"
        default: return "Parkering"
        }
    }
}
