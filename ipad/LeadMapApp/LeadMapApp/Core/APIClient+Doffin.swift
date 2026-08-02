// APIClient+Doffin.swift — Anbud (Doffin) tilleggstjeneste (2026-08-02)
//
// Søk i offentlige anskaffelser via backend-proxyen (/api/leadgrid/doffin/*).
// Backend håndhever entitlement (leadgridAnbud) og cacher upstream-svar.

import Foundation

// MARK: - DTO-er

struct DoffinOppdragsgiverDTO: Decodable, Hashable {
    let navn: String
    let orgnr: String
}

struct DoffinVerdiDTO: Decodable, Hashable {
    let belop: Double
    let valuta: String
}

struct DoffinKunngjoringDTO: Decodable, Identifiable, Hashable {
    let id: String
    let tittel: String
    let beskrivelse: String
    let oppdragsgivere: [DoffinOppdragsgiverDTO]
    let verdi: DoffinVerdiDTO?
    let type: String
    let status: String
    let kunngjort: String?
    let frist: String?
    let nutsKoder: [String]
    let cpvKoder: [String]
    let url: String
}

struct DoffinSearchResponseDTO: Decodable {
    let total: Int
    let kunngjoringer: [DoffinKunngjoringDTO]
}

struct DoffinWatchDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let query: DoffinWatchQueryDTO
    let createdAt: String?
    /// Nye treff siden sist bruker åpnet/kjørte overvåkningen (2026-08-03).
    /// Akkumuleres av cron-sjekken, nullstilles via mark-seen.
    let newHitsCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, query
        case createdAt = "created_at"
        case newHitsCount = "new_hits_count"
    }
}

struct DoffinWatchQueryDTO: Codable, Hashable {
    var q: String?
    var location: String?
    var cpv: String?
}

// MARK: - API

extension APIClient {

    /// Søk i Doffin. `location` = NUTS-koder kommaseparert, `cpv` = CPV-koder.
    func searchDoffin(
        q: String? = nil, location: String? = nil, cpv: String? = nil,
        status: String = "ACTIVE", hits: Int = 25, page: Int = 1
    ) async throws -> DoffinSearchResponseDTO {
        var comps = URLComponents()
        comps.path = "/api/leadgrid/doffin/search"
        var items: [URLQueryItem] = [
            .init(name: "status", value: status),
            .init(name: "hits", value: String(hits)),
        ]
        if page > 1 { items.append(.init(name: "page", value: String(page))) }
        if let q, !q.isEmpty { items.append(.init(name: "q", value: q)) }
        if let location, !location.isEmpty { items.append(.init(name: "location", value: location)) }
        if let cpv, !cpv.isEmpty { items.append(.init(name: "cpv", value: cpv)) }
        comps.queryItems = items
        return try await _get(comps.string ?? comps.path)
    }

    func fetchDoffinWatches() async throws -> [DoffinWatchDTO] {
        struct Resp: Decodable { let watches: [DoffinWatchDTO] }
        let r: Resp = try await _get("/api/leadgrid/doffin/watches")
        return r.watches
    }

    @discardableResult
    func createDoffinWatch(name: String, query: DoffinWatchQueryDTO) async throws -> String {
        struct Payload: Encodable { let name: String; let query: DoffinWatchQueryDTO }
        struct Resp: Decodable { let ok: Bool; let id: String }
        let r: Resp = try await _post("/api/leadgrid/doffin/watches",
                                      body: Payload(name: name, query: query))
        return r.id
    }

    func deleteDoffinWatch(id: String) async throws {
        _ = try await _request("/api/leadgrid/doffin/watches/\(id)", method: "DELETE")
    }

    /// Nullstill «nye treff»-telleren når brukeren kjører overvåkningen.
    func markDoffinWatchSeen(id: String) async throws {
        _ = try await _request("/api/leadgrid/doffin/watches/\(id)/mark-seen", method: "POST")
    }

    /// «Opprett lead fra anbud» (fase 2, 2026-08-02): gjenbruker
    /// from-card-løypa — org.nr i raw_text gir sikker BRREG-kobling og
    /// full berikelse (adresse/NACE/daglig leder) i jobbkøen.
    /// lead_source = doffin_anbud så kilden spores i CRM-et.
    func createLeadFromAnbud(
        navn: String, orgnr: String, tittel: String, url: String, frist: String?
    ) async throws -> String {
        var raw = "Org.nr: \(orgnr)\nAnbud: \(tittel)"
        if let frist, !frist.isEmpty { raw += "\nFrist: \(frist)" }
        raw += "\n\(url)"
        struct Payload: Encodable {
            let name: String
            let company: String
            let raw_text: String
            let lead_source: String
        }
        struct Resp: Decodable { let ok: Bool; let id: String }
        let r: Resp = try await _post(
            "/api/admin-room/lead-map/leads/from-card",
            body: Payload(name: navn, company: navn, raw_text: raw,
                          lead_source: "doffin_anbud"))
        return r.id
    }
}
