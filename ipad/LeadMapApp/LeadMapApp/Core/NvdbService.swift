// NvdbService.swift
//
// Fartsgrense (og senere enveiskjøring) via Leadgrid-backendens NVDB-proxy
// (`/api/leadgrid/nvdb/*`). Brukes til å vise fartsgrense-skilt i nav-modus.
// camelCase-DTO (backend snake_case → convertFromSnakeCase). Streng-konkat
// på query (ikke appendingPathComponent → percent-koder `?`).

import Foundation

@MainActor
final class NvdbService {
    static let shared = NvdbService()

    struct SpeedLimit: Decodable, Sendable {
        let speedLimit: Int?
        let speedLimits: [Int]
    }

    /// Fartsgrense nær en koordinat. Nil ved feil (aldri blokkerende).
    func speedLimit(lat: Double, lon: Double, using api: APIClient?) async -> Int? {
        guard let api else { return nil }
        let path = "/api/leadgrid/nvdb/near?lat=\(lat)&lon=\(lon)&radius=150"
        let r: SpeedLimit? = try? await api._get(path)
        return r?.speedLimit
    }

    // MARK: bomstasjoner (ekte takst fra NVDB)

    struct TollStation: Decodable, Sendable, Hashable {
        let lat: Double
        let lon: Double
        let operatorName: String?
        let rateSmall: Double?   // Takst liten bil
        let rateLarge: Double?   // Takst stor bil
        let rushSmall: Double?
        let rushLarge: Double?
    }
    private struct TollResponse: Decodable { let stations: [TollStation] }

    /// Bomstasjoner i et kartutsnitt (bbox = "minLon,minLat,maxLon,maxLat").
    /// Tom liste ved feil (aldri blokkerende).
    func tolls(bbox: String, using api: APIClient?) async -> [TollStation] {
        guard let api else { return [] }
        let path = "/api/leadgrid/nvdb/tolls?bbox=\(bbox)"
        let r: TollResponse? = try? await api._get(path)
        return r?.stations ?? []
    }
}
