// APIClient+Doffin.swift — Anbud (Doffin) tilleggstjeneste (2026-08-02)
//
// Søk i offentlige anskaffelser via backend-proxyen (/api/leadgrid/doffin/*).
// Backend håndhever entitlement (leadgridAnbud) og cacher upstream-svar.

import Foundation

private func doffinScopedPath(
    _ path: String,
    projectId: String,
    queryItems: [URLQueryItem] = []
) -> String {
    var components = URLComponents()
    components.path = path
    components.queryItems = [URLQueryItem(name: "projectId", value: projectId)]
        + queryItems
    return components.string ?? path
}

#if DEBUG
private func tidumDoffinQAProfile(
    status: String = "draft",
    selectedWatchKeys: [String] = []
) -> DoffinProjectProfileDTO {
    DoffinProjectProfileDTO(
        id: "22222222-2222-4222-8222-222222222222",
        templateKey: "tidum.procurement",
        templateVersion: 1,
        name: "Tidum – arbeidstid, turnus og dokumentasjon",
        description: "Offentlige anskaffelser av arbeidstids-, HR-, turnus- og dokumentasjonsprogramvare.",
        status: status,
        cpvCodes: ["48450000", "72212450", "48332000", "48311000", "48311100"],
        keywords: ["arbeidstid", "turnus", "digital dokumentasjon"],
        exclusionTerms: ["kjøp av omsorgsplasser", "bemanningstjenester"],
        suggestedWatches: [
            .init(
                key: "tidum.time_hr_software",
                name: "Tidum · Arbeidstid og HR-programvare",
                query: .init(q: nil, location: nil, cpv: "48450000,72212450")
            ),
            .init(
                key: "tidum.scheduling",
                name: "Tidum · Turnus og planlegging",
                query: .init(q: "turnus", location: nil, cpv: "48332000,48450000")
            ),
            .init(
                key: "tidum.documentation",
                name: "Tidum · Digital dokumentasjon",
                query: .init(q: "dokumentasjon", location: nil, cpv: "48311000,48311100")
            ),
        ],
        selectedWatchKeys: selectedWatchKeys,
        requiresAdminConfirmation: true,
        confirmedAt: status == "active" ? "2026-09-13T10:00:00.000Z" : nil,
        canManage: true
    )
}

private func usesTidumDoffinQAFixture(projectId: String) -> Bool {
    ProcessInfo.processInfo.environment["QA_TOUR"] == "domain-onboarding"
        && projectId == "qa-tidum-project"
}
#endif

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
    /// Stable identity for watches provisioned from a project tender profile.
    let templateKey: String?
    let templateVersion: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, query
        case createdAt = "created_at"
        case newHitsCount = "new_hits_count"
        case templateKey = "template_key"
        case templateVersion = "template_version"
    }
}

struct DoffinWatchQueryDTO: Codable, Hashable, Sendable {
    var q: String?
    var location: String?
    var cpv: String?
}

struct DoffinProjectProfileDTO: Decodable, Identifiable, Hashable, Sendable {
    struct SuggestedWatch: Decodable, Identifiable, Hashable, Sendable {
        let key: String
        let name: String
        let query: DoffinWatchQueryDTO
        var id: String { key }
    }

    let id: String
    let templateKey: String
    let templateVersion: Int
    let name: String
    let description: String
    let status: String
    let cpvCodes: [String]
    let keywords: [String]
    let exclusionTerms: [String]
    let suggestedWatches: [SuggestedWatch]
    let selectedWatchKeys: [String]
    let requiresAdminConfirmation: Bool
    let confirmedAt: String?
    let canManage: Bool

    var isActive: Bool { status == "active" }

    enum CodingKeys: String, CodingKey {
        case id, name, description, status, keywords
        case templateKey = "template_key"
        case templateVersion = "template_version"
        case cpvCodes = "cpv_codes"
        case exclusionTerms = "exclusion_terms"
        case suggestedWatches = "suggested_watches"
        case selectedWatchKeys = "selected_watch_keys"
        case requiresAdminConfirmation = "requires_admin_confirmation"
        case confirmedAt = "confirmed_at"
        case canManage = "can_manage"
    }
}

struct DoffinProjectProfileConfirmationDTO: Decodable, Sendable {
    let ok: Bool
    let profile: DoffinProjectProfileDTO
    let watches: [DoffinWatchDTO]
}

// MARK: - Pipeline (nivå 2, 2026-08-03)

/// Anbud i salgsprosessen: vurderer → går for → tilbud levert → vant/tapt.
struct AnbudPipelineItemDTO: Decodable, Identifiable, Hashable {
    let id: String
    let doffinId: String
    let tittel: String
    let oppdragsgiver: String
    let orgnr: String
    let url: String
    let frist: String?
    let verdi: Double?
    let status: String
    let assignedUserId: String?
    let assignedNavn: String?
    let notat: String
    /// Nivå 3: geokodet oppdragsgiver-adresse (Brreg → Geonorge, best effort).
    var lat: Double?
    var lng: Double?
    var adresse: String?
    /// Nivå 3: læringssløyfe — hvorfor tapte vi (whitelist i backend).
    var taptAarsak: String?

    enum CodingKeys: String, CodingKey {
        case id, tittel, oppdragsgiver, orgnr, url, frist, verdi, status, notat
        case lat, lng, adresse
        case doffinId = "doffin_id"
        case assignedUserId = "assigned_user_id"
        case assignedNavn = "assigned_navn"
        case taptAarsak = "tapt_aarsak"
    }
}

struct AnbudTapsAarsakDTO: Decodable, Identifiable, Hashable {
    let aarsak: String
    let antall: Int
    var id: String { aarsak }
}

struct AnbudPipelineStatsDTO: Decodable, Hashable {
    let aapne: Int
    let vant: Int
    let tapt: Int
    let vinnrate: Double?
    let sumAapneVerdi: Double
    var tapsaarsaker: [AnbudTapsAarsakDTO]?

    enum CodingKeys: String, CodingKey {
        case aapne, vant, tapt, vinnrate, tapsaarsaker
        case sumAapneVerdi = "sum_aapne_verdi"
    }
}

/// AI-lesehjelp (nivå 2): oppsummering + krav-ekstraksjon.
struct AnbudOppsummeringDTO: Decodable, Hashable {
    let sammendrag: String
    let krav: [String]
    let verdtAaVite: String?

    enum CodingKeys: String, CodingKey {
        case sammendrag, krav
        case verdtAaVite = "verdt_aa_vite"
    }
}

/// Tilbuds-assistent (2026-08-04): AI-UTKAST til disposisjon + følgebrev
/// + sjekkliste. [FYLL INN]-markører der bedriftsinfo trengs — skal
/// alltid redigeres av mennesker før innsending.
struct AnbudTilbudsutkastDTO: Decodable, Hashable {
    struct SeksjonDTO: Decodable, Hashable, Identifiable {
        let seksjon: String
        let innhold: String
        var id: String { seksjon }
    }
    let disposisjon: [SeksjonDTO]
    let folgebrev: String
    let sjekkliste: [String]
}

// MARK: - API

extension APIClient {

    func fetchDoffinProjectProfile(
        projectId: String
    ) async throws -> DoffinProjectProfileDTO? {
        #if DEBUG
        if usesTidumDoffinQAFixture(projectId: projectId) {
            return tidumDoffinQAProfile()
        }
        #endif
        struct Response: Decodable { let profile: DoffinProjectProfileDTO? }
        let response: Response = try await _get(doffinScopedPath(
            "/api/leadgrid/doffin/project-profile", projectId: projectId))
        return response.profile
    }

    func confirmDoffinProjectProfile(
        projectId: String,
        watchKeys: [String]
    ) async throws -> DoffinProjectProfileConfirmationDTO {
        #if DEBUG
        if usesTidumDoffinQAFixture(projectId: projectId) {
            let draft = tidumDoffinQAProfile()
            let selected = draft.suggestedWatches.filter { watchKeys.contains($0.key) }
            let profile = tidumDoffinQAProfile(
                status: "active",
                selectedWatchKeys: selected.map(\.key)
            )
            return DoffinProjectProfileConfirmationDTO(
                ok: true,
                profile: profile,
                watches: selected.map { watch in
                    DoffinWatchDTO(
                        id: "qa-\(watch.key)",
                        name: watch.name,
                        query: watch.query,
                        createdAt: nil,
                        newHitsCount: 0,
                        templateKey: watch.key,
                        templateVersion: 1
                    )
                }
            )
        }
        #endif
        struct Payload: Encodable {
            let watchKeys: [String]
            enum CodingKeys: String, CodingKey { case watchKeys = "watch_keys" }
        }
        return try await _post(doffinScopedPath(
            "/api/leadgrid/doffin/project-profile/confirm", projectId: projectId),
                               body: Payload(watchKeys: watchKeys))
    }

    /// Søk i Doffin. `location` = NUTS-koder kommaseparert, `cpv` = CPV-koder.
    func searchDoffin(
        projectId: String,
        q: String? = nil, location: String? = nil, cpv: String? = nil,
        status: String = "ACTIVE", hits: Int = 25, page: Int = 1,
        useProjectProfile: Bool = false
    ) async throws -> DoffinSearchResponseDTO {
        var comps = URLComponents()
        comps.path = "/api/leadgrid/doffin/search"
        var items: [URLQueryItem] = [
            .init(name: "projectId", value: projectId),
            .init(name: "status", value: status),
            .init(name: "hits", value: String(hits)),
        ]
        if page > 1 { items.append(.init(name: "page", value: String(page))) }
        if let q, !q.isEmpty { items.append(.init(name: "q", value: q)) }
        if let location, !location.isEmpty { items.append(.init(name: "location", value: location)) }
        if let cpv, !cpv.isEmpty { items.append(.init(name: "cpv", value: cpv)) }
        if useProjectProfile {
            items.append(.init(name: "projectProfile", value: "true"))
        }
        comps.queryItems = items
        return try await _get(comps.string ?? comps.path)
    }

    func fetchDoffinWatches(projectId: String) async throws -> [DoffinWatchDTO] {
        struct Resp: Decodable { let watches: [DoffinWatchDTO] }
        let r: Resp = try await _get(doffinScopedPath(
            "/api/leadgrid/doffin/watches", projectId: projectId))
        return r.watches
    }

    @discardableResult
    func createDoffinWatch(
        name: String, query: DoffinWatchQueryDTO, projectId: String
    ) async throws -> String {
        struct Payload: Encodable { let name: String; let query: DoffinWatchQueryDTO }
        struct Resp: Decodable { let ok: Bool; let id: String }
        let r: Resp = try await _post(doffinScopedPath(
            "/api/leadgrid/doffin/watches", projectId: projectId),
                                      body: Payload(name: name, query: query))
        return r.id
    }

    func deleteDoffinWatch(id: String, projectId: String) async throws {
        _ = try await _request(doffinScopedPath(
            "/api/leadgrid/doffin/watches/\(id)", projectId: projectId),
            method: "DELETE")
    }

    /// Nullstill «nye treff»-telleren når brukeren kjører overvåkningen.
    func markDoffinWatchSeen(id: String, projectId: String) async throws {
        _ = try await _request(doffinScopedPath(
            "/api/leadgrid/doffin/watches/\(id)/mark-seen", projectId: projectId),
            method: "POST")
    }

    // MARK: Pipeline (nivå 2)

    func fetchAnbudPipeline(
        projectId: String
    ) async throws -> (items: [AnbudPipelineItemDTO], stats: AnbudPipelineStatsDTO?) {
        struct Resp: Decodable {
            let items: [AnbudPipelineItemDTO]
            let stats: AnbudPipelineStatsDTO?
        }
        let r: Resp = try await _get(doffinScopedPath(
            "/api/leadgrid/doffin/pipeline", projectId: projectId))
        return (r.items, r.stats)
    }

    @discardableResult
    func addToAnbudPipeline(
        _ k: DoffinKunngjoringDTO, projectId: String
    ) async throws -> Bool {
        struct Payload: Encodable {
            let doffin_id: String
            let tittel: String
            let oppdragsgiver: String
            let orgnr: String
            let url: String
            let frist: String?
            let verdi: Double?
        }
        struct Resp: Decodable { let ok: Bool; let allerede: Bool? }
        let og = k.oppdragsgivere.first
        let r: Resp = try await _post(doffinScopedPath(
            "/api/leadgrid/doffin/pipeline", projectId: projectId),
            body: Payload(doffin_id: k.id, tittel: k.tittel,
                          oppdragsgiver: og?.navn ?? "", orgnr: og?.orgnr ?? "",
                          url: k.url, frist: k.frist, verdi: k.verdi?.belop))
        return !(r.allerede ?? false)
    }

    func updateAnbudPipeline(id: String, status: String? = nil,
                             assignedUserId: String?? = nil, notat: String? = nil,
                             taptAarsak: String? = nil,
                             projectId: String) async throws {
        var body: [String: AnyEncodableValue] = [:]
        if let status { body["status"] = .string(status) }
        if let assigned = assignedUserId {
            body["assigned_user_id"] = assigned.map { .string($0) } ?? .null
        }
        if let notat { body["notat"] = .string(notat) }
        if let taptAarsak { body["tapt_aarsak"] = .string(taptAarsak) }
        struct Wrapper: Encodable {
            let values: [String: AnyEncodableValue]
            func encode(to encoder: Encoder) throws {
                try values.encode(to: encoder)
            }
        }
        _ = try await _request(doffinScopedPath(
            "/api/leadgrid/doffin/pipeline/\(id)", projectId: projectId), method: "PATCH",
                               body: try JSONEncoder().encode(Wrapper(values: body)))
    }

    func deleteAnbudPipeline(id: String, projectId: String) async throws {
        _ = try await _request(doffinScopedPath(
            "/api/leadgrid/doffin/pipeline/\(id)", projectId: projectId),
            method: "DELETE")
    }

    /// AI-lesehjelp (nivå 2): oppsummer kunngjøringen + trekk ut kravene.
    func oppsummerAnbud(
        tittel: String, beskrivelse: String, projectId: String
    ) async throws -> AnbudOppsummeringDTO {
        struct Payload: Encodable { let tittel: String; let beskrivelse: String }
        return try await _post(doffinScopedPath(
            "/api/leadgrid/doffin/oppsummer", projectId: projectId),
                               body: Payload(tittel: tittel, beskrivelse: beskrivelse))
    }

    /// Tilbuds-assistent (2026-08-04): AI-utkast til disposisjon/følgebrev/
    /// sjekkliste. `krav` = ekstraherte krav fra oppsummeringen hvis kjørt.
    func lagTilbudsutkast(
        tittel: String, beskrivelse: String, krav: [String], projectId: String
    ) async throws -> AnbudTilbudsutkastDTO {
        struct Payload: Encodable {
            let tittel: String
            let beskrivelse: String
            let krav: [String]
        }
        return try await _post(doffinScopedPath(
            "/api/leadgrid/doffin/tilbudsutkast", projectId: projectId),
                               body: Payload(tittel: tittel, beskrivelse: beskrivelse, krav: krav))
    }

    /// AI-prioritering (nivå 1): scorer treffene mot org-ens overvåkninger.
    func scoreDoffin(
        kunngjoringer: [DoffinKunngjoringDTO], projectId: String
    ) async throws -> [DoffinScoreDTO] {
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
        let r: Resp = try await _post(doffinScopedPath(
            "/api/leadgrid/doffin/score", projectId: projectId),
                                      body: Payload(kunngjoringer: Array(items)))
        return r.scores
    }

    /// Tildelings-innsikt (nivå 1) for valgt bransje/fylke.
    func fetchDoffinTildelinger(
        cpv: String?, location: String?, projectId: String
    ) async throws -> DoffinTildelingerDTO {
        var comps = URLComponents(string: "/api/leadgrid/doffin/tildelinger")!
        var items: [URLQueryItem] = [.init(name: "projectId", value: projectId)]
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
        navn: String, orgnr: String, tittel: String, url: String, frist: String?,
        organizationId: String?, projectId: String, idempotencyKey: UUID
    ) async throws -> String {
        var raw = "Org.nr: \(orgnr)\nAnbud: \(tittel)"
        if let frist, !frist.isEmpty { raw += "\nFrist: \(frist)" }
        raw += "\n\(url)"
        struct Payload: Encodable {
            let name: String
            let company: String
            let raw_text: String
            let lead_source: String
            let organization_id: String?
            let project_id: String
        }
        struct Resp: Decodable { let ok: Bool; let id: String }
        let r: Resp = try await _post(
            "/api/admin-room/lead-map/leads/from-card",
            body: Payload(name: navn, company: navn, raw_text: raw,
                          lead_source: "doffin_anbud", organization_id: organizationId,
                          project_id: projectId),
            headers: ["Idempotency-Key": idempotencyKey.uuidString.lowercased()])
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
    case null

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let s): try c.encode(s)
        case .double(let d): try c.encode(d)
        case .stringArray(let a): try c.encode(a)
        case .dict(let m): try c.encode(m)
        case .null: try c.encodeNil()
        }
    }
}
