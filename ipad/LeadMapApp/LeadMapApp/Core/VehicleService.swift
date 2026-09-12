// VehicleService.swift
//
// Slår opp et kjøretøy på registreringsnummer via Leadgrid-backendens
// Vegvesen-proxy (`/api/leadgrid/vehicle/lookup`). Backend snakker med
// Statens vegvesens kjøretøyregister (Autosys) med API-nøkkel fra env, og
// returnerer KUN tekniske felt (drivstoff/merke/type) — aldri eier-info.
//
// camelCase-DTO (backend snake_case → convertFromSnakeCase). Nil ved feil
// eller når oppslag ikke er konfigurert (aldri blokkerende).

import Foundation

@MainActor
final class VehicleService {
    static let shared = VehicleService()

    struct Result: Decodable, Sendable {
        let fuelCode: String?       // Vegvesens drivstoff-kode, f.eks. "Elektrisk"
        let make: String?           // "Tesla"
        let model: String?          // "Model Y"
        let bodyKind: String?       // "personbil" | "motorsykkel" | "moped"
        let euControlDue: String?   // EU-kontroll (PKK) neste frist, ISO-dato
        let firstRegistered: String?

        /// Avledet drivstoff-enum for «Min bil».
        var fuel: VehicleFuel { VehicleFuel.fromNvdbCode(fuelCode) }
        /// Avledet type.
        var kind: VehicleProfile.Kind {
            switch (bodyKind ?? "").lowercased() {
            case let s where s.contains("motorsyk"): return .motorcycle
            case let s where s.contains("moped"):    return .moped
            default:                                  return .car
            }
        }
        /// Visningsnavn «Tesla Model Y».
        var displayName: String {
            [make, model].compactMap { $0?.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
                .joined(separator: " ")
        }
    }

    private struct Ack: Decodable { let ok: Bool? }

    /// Synk «Min bil» server-side (så admin-dashbordet ser registrert firmabil).
    func syncProfile(_ profile: VehicleProfile, using api: APIClient?) async {
        guard let api else { return }
        let _: Ack? = try? await api._post("/api/leadgrid/vehicle/profile", body: profile)
    }

    /// Slå opp kjøretøy på regnr. Nil ved feil / ikke konfigurert.
    func lookup(plate: String, using api: APIClient?) async -> Result? {
        guard let api else { return nil }
        let clean = plate.replacingOccurrences(of: " ", with: "").uppercased()
        guard clean.count >= 4 else { return nil }
        let path = "/api/leadgrid/vehicle/lookup?plate=\(clean)"
        let r: Result? = try? await api._get(path)
        // Uten navn OG uten drivstoff er treffet tomt → nil.
        if let r, (!r.displayName.isEmpty || r.fuelCode != nil) { return r }
        return nil
    }
}
