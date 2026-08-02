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

    enum CodingKeys: String, CodingKey {
        case id, name, query
        case createdAt = "created_at"
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
}
