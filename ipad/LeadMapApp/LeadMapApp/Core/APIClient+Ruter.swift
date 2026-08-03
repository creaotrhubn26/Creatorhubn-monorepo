// APIClient+Ruter.swift — fler-stopp besøksruter (Ruteplanlegger nivå 3)
//
// Salgssjef tildeler en planlagt rute til en selger; selgeren får push og
// henter ruta inn i Kart-fanens rute-motor (/api/leadgrid/ruter/*).

import Foundation

// MARK: - DTO-er

/// Speiler AppState.RuteStopp — serialisert med de delte _get/_post-
/// hjelperne (snake_case-konvertering; backend godtar begge former).
struct RuteStoppDTO: Codable, Hashable {
    let id: String
    let name: String
    let address: String
    let lat: Double
    let lon: Double
    var ankerTid: String? = nil
}

struct TildeltRuteDTO: Decodable {
    let id: String
    let navn: String
    let stopp: [RuteStoppDTO]
    let status: String
    let createdBy: String
    let createdAt: String
}

extension APIClient {

    /// Opprett rute — evt. tildelt et teammedlem (backend sender push).
    func opprettRute(stopp: [RuteStoppDTO], assignedUserId: String?,
                     navn: String) async throws {
        struct Body: Encodable {
            let stopp: [RuteStoppDTO]
            let assignedUserId: String?
            let navn: String
        }
        struct Resp: Decodable { let ok: Bool }
        let _: Resp = try await _post(
            "/api/leadgrid/ruter",
            body: Body(stopp: stopp, assignedUserId: assignedUserId, navn: navn))
    }

    /// Min nyeste åpne tildelte rute (hentes ved varsel-tap / Kart-åpning).
    func hentMinTildelteRute() async throws -> TildeltRuteDTO? {
        struct Resp: Decodable { let rute: TildeltRuteDTO? }
        let r: Resp = try await _get("/api/leadgrid/ruter/min")
        return r.rute
    }

    /// Statusoppdatering: akseptert (hentet), fullfort, avvist.
    func settRuteStatus(id: String, status: String) async throws {
        struct Body: Encodable { let status: String }
        try await _post("/api/leadgrid/ruter/\(id)/status", body: Body(status: status))
    }
}
