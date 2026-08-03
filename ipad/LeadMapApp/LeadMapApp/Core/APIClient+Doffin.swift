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

/// Kunde-match (nivå 1, 2026-08-03): oppdragsgiveren finnes allerede i
/// org-ens CRM — leaden + eieren flagges rett på kunngjøringen.
struct DoffinKundeMatchDTO: Decodable, Hashable {
    let leadId: String
    let leadNavn: String
    let leadStatus: String?
    let eier: String?

    enum CodingKeys: String, CodingKey {
        case leadId = "lead_id"
        case leadNavn = "lead_navn"
        case leadStatus = "lead_status"
        case eier
    }
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
    /// Nivå 1: satt av backend når oppdragsgiver allerede er kunde.
    var kundeMatch: DoffinKundeMatchDTO?
    /// AWARDED best-effort — tom når Doffin ikke eksponerer vinnere.
    var vinnere: [DoffinOppdragsgiverDTO]?

    enum CodingKeys: String, CodingKey {
        case id, tittel, beskrivelse, oppdragsgivere, verdi, type, status
        case kunngjort, frist, nutsKoder, cpvKoder, url, vinnere
        case kundeMatch = "kunde_match"
    }
}

/// AI-prioritering (nivå 1): score 0-100 + kort begrunnelse per treff.
struct DoffinScoreDTO: Decodable, Hashable {
    let id: String
    let score: Int
    let hvorfor: String?
}

/// Tildelings-innsikt (nivå 1): aggregert AWARDED for valgt bransje/fylke.
struct DoffinTildelingerDTO: Decodable {
    struct AktorDTO: Decodable, Identifiable, Hashable {
        let navn: String
        let antall: Int
        let verdi: Double?
        var id: String { navn }
    }
    let total: Int
    let utvalg: Int
    let sumVerdi: Double
    let toppOppdragsgivere: [AktorDTO]
    let toppVinnere: [AktorDTO]

    enum CodingKeys: String, CodingKey {
        case total, utvalg
        case sumVerdi = "sum_verdi"
        case toppOppdragsgivere = "topp_oppdragsgivere"
        case toppVinnere = "topp_vinnere"
    }
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

    /// AI-prioritering (nivå 1): scorer treffene mot org-ens overvåkninger.
    func scoreDoffin(kunngjoringer: [DoffinKunngjoringDTO]) async throws -> [DoffinScoreDTO] {
        struct Payload: Encodable { let kunngjoringer: [[String: AnyEncodableValue]] }
        // Enkel manuell payload (unngår Encodable-kompleksitet for nested DTO).
        let items = kunngjoringer.prefix(20).map { k -> [String: AnyEncodableValue] in
            var d: [String: AnyEncodableValue] = [
                "id": .string(k.id),
                "tittel": .string(k.tittel),
                "beskrivelse": .string(String(k.beskrivelse.prefix(350))),
                "cpvKoder": .stringArray(k.cpvKoder),
                "nutsKoder": .stringArray(k.nutsKoder),
            ]
            if let v = k.verdi { d["verdi"] = .dict(["belop": .double(v.belop)]) }
            return d
        }
        struct Resp: Decodable { let scores: [DoffinScoreDTO] }
        let r: Resp = try await _post("/api/leadgrid/doffin/score",
                                      body: Payload(kunngjoringer: Array(items)))
        return r.scores
    }

    /// Tildelings-innsikt (nivå 1) for valgt bransje/fylke.
    func fetchDoffinTildelinger(cpv: String?, location: String?) async throws -> DoffinTildelingerDTO {
        var comps = URLComponents(string: "/api/leadgrid/doffin/tildelinger")!
        var items: [URLQueryItem] = []
        if let cpv, !cpv.isEmpty { items.append(.init(name: "cpv", value: cpv)) }
        if let location, !location.isEmpty { items.append(.init(name: "location", value: location)) }
        comps.queryItems = items.isEmpty ? nil : items
        return try await _get(comps.string ?? comps.path)
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

/// Minimal JSON-verdi for håndbygde payloads (unngår [String: Any] som
/// ikke er Encodable). Dekker det score-endepunktet trenger.
enum AnyEncodableValue: Encodable {
    case string(String)
    case double(Double)
    case stringArray([String])
    case dict([String: AnyEncodableValue])

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let s): try c.encode(s)
        case .double(let d): try c.encode(d)
        case .stringArray(let a): try c.encode(a)
        case .dict(let m): try c.encode(m)
        }
    }
}
