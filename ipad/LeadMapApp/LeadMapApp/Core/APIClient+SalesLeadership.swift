// APIClient+SalesLeadership.swift
//
// Salgsledelse: provisjons-modeller, konkurranse-maler, premie-katalog,
// konkurranser + fulfillment-tildelinger.
//
// Backend-skjema: backend/migrations/0354_sales_leadership_prizes.sql
// Endpoints:      /api/leadgrid/sales-leadership/*
//
// PG `::text`-timestamps fra backend kan ikke parses av
// `ISO8601DateFormatter` direkte (se memory:
// feedback_pg_text_cast_not_iso8601). Vi holder derfor alle timestamps
// som `String?` og lar views formatere via `LeadgridDate.formatNo(...)`.
//
// Bilde-opplasting (`uploadPrizeImage`) bruker JSON + base64 i stedet
// for multipart (ingen eksisterende multipart-mønster i denne klienten),
// med wrapper `PrizeImageUploadPayload { data: base64, mime_type }`.

import Foundation

// ============================================================
// MARK: - DTO-er
// ============================================================

/// Provisjons-konfig (én per org). `config` lagres som rå JSON-Data
/// fordi den er polymorf JSONB i Postgres (tiers, bands, spiffs osv.).
struct CommissionConfigDTO: Codable, Hashable {
    let preset: String
    let activeModels: [String]
    let config: Data

    enum CodingKeys: String, CodingKey {
        case preset
        case activeModels
        case config
    }

    init(preset: String, activeModels: [String], config: Data) {
        self.preset = preset
        self.activeModels = activeModels
        self.config = config
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.preset = try c.decode(String.self, forKey: .preset)
        self.activeModels = try c.decodeIfPresent([String].self, forKey: .activeModels) ?? []
        // `config` er JSONB → kan være et hvilket som helst JSON-objekt.
        // Vi re-serialiserer det til rå Data slik at views kan parse
        // det polymorft eller bare lagre det videre.
        if let raw = try? c.decode(JSONValue.self, forKey: .config) {
            self.config = (try? JSONEncoder().encode(raw)) ?? Data("{}".utf8)
        } else {
            self.config = Data("{}".utf8)
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(preset, forKey: .preset)
        try c.encode(activeModels, forKey: .activeModels)
        // Send `config` som JSON-objekt (ikke base64-streng).
        if let value = try? JSONDecoder().decode(JSONValue.self, from: config) {
            try c.encode(value, forKey: .config)
        } else {
            try c.encode(JSONValue.object([:]), forKey: .config)
        }
    }
}

/// Konkurranse-mal aktivering per org.
struct ContestTemplateDTO: Codable, Hashable, Identifiable {
    var id: String { templateType }
    let templateType: String
    let enabled: Bool
    /// Frittflytende key→value overstyringer (default_days, default_kpi,
    /// default_prize osv.). Holder kun string-verdier for enklere UI.
    let defaults: [String: String]

    enum CodingKeys: String, CodingKey {
        case templateType
        case enabled
        case defaults
    }

    init(templateType: String, enabled: Bool, defaults: [String: String]) {
        self.templateType = templateType
        self.enabled = enabled
        self.defaults = defaults
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.templateType = try c.decode(String.self, forKey: .templateType)
        self.enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        // Defaults kommer som JSONB; vi tolererer både string-map og rik
        // struktur ved å flate alt til strenger.
        if let raw = try? c.decode(JSONValue.self, forKey: .defaults) {
            self.defaults = raw.flatStringMap()
        } else {
            self.defaults = [:]
        }
    }
}

/// Produkt i org-spesifikk premiekatalog.
struct OrgPrizeProductDTO: Codable, Hashable, Identifiable {
    let id: UUID
    let name: String
    let icon: String
    let category: String        // tech / travel / food / voucher / experience / cash
    let priceNok: Int
    let vendor: String?
    let imageUrl: String?
    let imageB2Key: String?
    let fulfillmentMethod: String?
    let archived: Bool
}

/// Konkurranse-instans m/ premier (rank → snapshot).
struct ContestDTO: Codable, Hashable, Identifiable {
    let id: UUID
    let name: String
    let templateType: String
    let kpi: String
    /// JSONB kpi_config (cityFilter, industryFilter, teams osv.) — rå Data.
    let kpiConfig: Data?
    /// `String?` pga PG ::text-cast inkonsistens (memory:
    /// feedback_pg_text_cast_not_iso8601). Bruk `LeadgridDate.parse`/
    /// `formatNo` i views.
    let startsAt: String?
    let endsAt: String?
    let status: String          // active / ended / archived
    let prizes: [ContestPrizeDTO]

    enum CodingKeys: String, CodingKey {
        case id, name, templateType, kpi, kpiConfig, startsAt, endsAt, status, prizes
    }

    init(
        id: UUID,
        name: String,
        templateType: String,
        kpi: String,
        kpiConfig: Data?,
        startsAt: String?,
        endsAt: String?,
        status: String,
        prizes: [ContestPrizeDTO]
    ) {
        self.id = id
        self.name = name
        self.templateType = templateType
        self.kpi = kpi
        self.kpiConfig = kpiConfig
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.status = status
        self.prizes = prizes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(UUID.self, forKey: .id)
        self.name = try c.decode(String.self, forKey: .name)
        self.templateType = try c.decode(String.self, forKey: .templateType)
        self.kpi = try c.decode(String.self, forKey: .kpi)
        if let raw = try? c.decode(JSONValue.self, forKey: .kpiConfig) {
            self.kpiConfig = try? JSONEncoder().encode(raw)
        } else {
            self.kpiConfig = nil
        }
        self.startsAt = try c.decodeIfPresent(String.self, forKey: .startsAt)
        self.endsAt = try c.decodeIfPresent(String.self, forKey: .endsAt)
        self.status = try c.decode(String.self, forKey: .status)
        self.prizes = try c.decodeIfPresent([ContestPrizeDTO].self, forKey: .prizes) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(templateType, forKey: .templateType)
        try c.encode(kpi, forKey: .kpi)
        if let kc = kpiConfig,
           let value = try? JSONDecoder().decode(JSONValue.self, from: kc)
        {
            try c.encode(value, forKey: .kpiConfig)
        }
        try c.encodeIfPresent(startsAt, forKey: .startsAt)
        try c.encodeIfPresent(endsAt, forKey: .endsAt)
        try c.encode(status, forKey: .status)
        try c.encode(prizes, forKey: .prizes)
    }
}

/// Premie per plass (rank) i en konkurranse. `productSnapshot` er en
/// frosset kopi av `OrgPrizeProductDTO` ved opprettelse.
struct ContestPrizeDTO: Codable, Hashable {
    let rank: Int
    /// Rå JSONB — typisk hele PrizeProduct + pris ved opprettelse.
    let productSnapshot: Data

    enum CodingKeys: String, CodingKey {
        case rank
        case productSnapshot
    }

    init(rank: Int, productSnapshot: Data) {
        self.rank = rank
        self.productSnapshot = productSnapshot
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.rank = try c.decode(Int.self, forKey: .rank)
        if let raw = try? c.decode(JSONValue.self, forKey: .productSnapshot) {
            self.productSnapshot = (try? JSONEncoder().encode(raw)) ?? Data("{}".utf8)
        } else {
            self.productSnapshot = Data("{}".utf8)
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(rank, forKey: .rank)
        if let value = try? JSONDecoder().decode(JSONValue.self, from: productSnapshot) {
            try c.encode(value, forKey: .productSnapshot)
        } else {
            try c.encode(JSONValue.object([:]), forKey: .productSnapshot)
        }
    }
}

/// Deltaker i en konkurranse + løpende score.
struct ContestParticipantDTO: Codable, Hashable, Identifiable {
    var id: String { userId }
    let userId: String
    let score: Double
    let lastUpdatedAt: String?
}

/// Endelig rangering ved lukking av konkurranse.
struct ContestWinnerDTO: Codable, Hashable, Identifiable {
    var id: String { "\(userId)#\(rank)" }
    let userId: String
    let rank: Int
    let finalScore: Double
    let awardedAt: String?
}

/// Fulfillment-tildeling per vinner (status-tidslinje pending → ordered
/// → shipped → received).
struct PrizeAwardDTO: Codable, Hashable, Identifiable {
    let id: UUID
    let contestId: UUID
    let winnerId: UUID
    let userId: String
    let productSnapshot: Data
    let fulfillmentMethod: String
    let status: String
    let trackingNumber: String?
    let notes: String?
    let orderedAt: String?
    let shippedAt: String?
    let receivedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, contestId, winnerId, userId, productSnapshot
        case fulfillmentMethod, status, trackingNumber, notes
        case orderedAt, shippedAt, receivedAt
    }

    init(
        id: UUID, contestId: UUID, winnerId: UUID, userId: String,
        productSnapshot: Data, fulfillmentMethod: String, status: String,
        trackingNumber: String?, notes: String?,
        orderedAt: String?, shippedAt: String?, receivedAt: String?
    ) {
        self.id = id
        self.contestId = contestId
        self.winnerId = winnerId
        self.userId = userId
        self.productSnapshot = productSnapshot
        self.fulfillmentMethod = fulfillmentMethod
        self.status = status
        self.trackingNumber = trackingNumber
        self.notes = notes
        self.orderedAt = orderedAt
        self.shippedAt = shippedAt
        self.receivedAt = receivedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(UUID.self, forKey: .id)
        self.contestId = try c.decode(UUID.self, forKey: .contestId)
        self.winnerId = try c.decode(UUID.self, forKey: .winnerId)
        self.userId = try c.decode(String.self, forKey: .userId)
        if let raw = try? c.decode(JSONValue.self, forKey: .productSnapshot) {
            self.productSnapshot = (try? JSONEncoder().encode(raw)) ?? Data("{}".utf8)
        } else {
            self.productSnapshot = Data("{}".utf8)
        }
        self.fulfillmentMethod = try c.decode(String.self, forKey: .fulfillmentMethod)
        self.status = try c.decode(String.self, forKey: .status)
        self.trackingNumber = try c.decodeIfPresent(String.self, forKey: .trackingNumber)
        self.notes = try c.decodeIfPresent(String.self, forKey: .notes)
        self.orderedAt = try c.decodeIfPresent(String.self, forKey: .orderedAt)
        self.shippedAt = try c.decodeIfPresent(String.self, forKey: .shippedAt)
        self.receivedAt = try c.decodeIfPresent(String.self, forKey: .receivedAt)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(contestId, forKey: .contestId)
        try c.encode(winnerId, forKey: .winnerId)
        try c.encode(userId, forKey: .userId)
        if let value = try? JSONDecoder().decode(JSONValue.self, from: productSnapshot) {
            try c.encode(value, forKey: .productSnapshot)
        }
        try c.encode(fulfillmentMethod, forKey: .fulfillmentMethod)
        try c.encode(status, forKey: .status)
        try c.encodeIfPresent(trackingNumber, forKey: .trackingNumber)
        try c.encodeIfPresent(notes, forKey: .notes)
        try c.encodeIfPresent(orderedAt, forKey: .orderedAt)
        try c.encodeIfPresent(shippedAt, forKey: .shippedAt)
        try c.encodeIfPresent(receivedAt, forKey: .receivedAt)
    }
}

// ============================================================
// MARK: - Input-payloads
// ============================================================

struct OrgPrizeProductCreatePayload: Encodable, Hashable {
    let name: String
    let icon: String
    let category: String
    let priceNok: Int
    let vendor: String?
    let imageUrl: String?
    let imageB2Key: String?
    let fulfillmentMethod: String?
}

struct OrgPrizeProductPatchPayload: Encodable, Hashable {
    var name: String?
    var icon: String?
    var category: String?
    var priceNok: Int?
    var vendor: String?
    var imageUrl: String?
    var imageB2Key: String?
    var fulfillmentMethod: String?
    var archived: Bool?
}

struct CreateContestPrizePayload: Encodable, Hashable {
    let rank: Int
    /// Rå JSON-Data (samme form som `ContestPrizeDTO.productSnapshot`).
    let productSnapshot: Data

    enum CodingKeys: String, CodingKey {
        case rank, productSnapshot
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(rank, forKey: .rank)
        if let value = try? JSONDecoder().decode(JSONValue.self, from: productSnapshot) {
            try c.encode(value, forKey: .productSnapshot)
        } else {
            try c.encode(JSONValue.object([:]), forKey: .productSnapshot)
        }
    }
}

struct CreateContestPayload: Encodable, Hashable {
    let name: String
    let templateType: String
    let kpi: String
    /// Polymorf JSONB. Send som rå Data; serialiseres til JSON-objekt.
    let kpiConfig: Data?
    /// ISO8601-streng (vi konverterer Date → ISO8601 ved opprettelse).
    let endsAt: String
    let prizes: [CreateContestPrizePayload]

    enum CodingKeys: String, CodingKey {
        case name, templateType, kpi, kpiConfig, endsAt, prizes
    }

    init(
        name: String,
        templateType: String,
        kpi: String,
        kpiConfig: Data? = nil,
        endsAt: Date,
        prizes: [CreateContestPrizePayload]
    ) {
        self.name = name
        self.templateType = templateType
        self.kpi = kpi
        self.kpiConfig = kpiConfig
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        self.endsAt = f.string(from: endsAt)
        self.prizes = prizes
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(name, forKey: .name)
        try c.encode(templateType, forKey: .templateType)
        try c.encode(kpi, forKey: .kpi)
        if let kc = kpiConfig,
           let value = try? JSONDecoder().decode(JSONValue.self, from: kc)
        {
            try c.encode(value, forKey: .kpiConfig)
        }
        try c.encode(endsAt, forKey: .endsAt)
        try c.encode(prizes, forKey: .prizes)
    }
}

struct ShippingAddress: Codable, Hashable {
    let name: String
    let street: String
    let postal: String
    let city: String
    let country: String
}

// ============================================================
// MARK: - APIClient extension
// ============================================================

extension APIClient {

    // -- Commission ----------------------------------------------

    func fetchCommissionConfig() async throws -> CommissionConfigDTO {
        try await _get("/api/leadgrid/sales-leadership/commission-config")
    }

    func saveCommissionConfig(_ config: CommissionConfigDTO) async throws {
        try await _post("/api/leadgrid/sales-leadership/commission-config", body: config)
    }

    // -- Templates -----------------------------------------------

    func fetchContestTemplates() async throws -> [ContestTemplateDTO] {
        let resp: SalesLeadershipTemplatesEnvelope =
            try await _get("/api/leadgrid/sales-leadership/contest-templates")
        return resp.templates
    }

    func updateContestTemplate(
        type: String,
        enabled: Bool,
        defaults: [String: String]
    ) async throws {
        let payload = UpdateContestTemplatePayload(
            templateType: type, enabled: enabled, defaults: defaults
        )
        try await _post(
            "/api/leadgrid/sales-leadership/contest-templates",
            body: payload
        )
    }

    // -- Catalog -------------------------------------------------

    func fetchOrgPrizeCatalog() async throws -> [OrgPrizeProductDTO] {
        let resp: SalesLeadershipCatalogEnvelope =
            try await _get("/api/leadgrid/sales-leadership/prize-catalog")
        return resp.products
    }

    func createPrizeProduct(
        _ product: OrgPrizeProductCreatePayload
    ) async throws -> OrgPrizeProductDTO {
        let resp: SalesLeadershipPrizeProductEnvelope =
            try await _post(
                "/api/leadgrid/sales-leadership/prize-catalog",
                body: product
            )
        return resp.product
    }

    func updatePrizeProduct(
        id: UUID,
        _ patch: OrgPrizeProductPatchPayload
    ) async throws -> OrgPrizeProductDTO {
        let resp: SalesLeadershipPrizeProductEnvelope =
            try await _patch(
                "/api/leadgrid/sales-leadership/prize-catalog/\(id.uuidString)",
                body: patch
            )
        return resp.product
    }

    func deletePrizeProduct(id: UUID) async throws {
        try await _delete("/api/leadgrid/sales-leadership/prize-catalog/\(id.uuidString)")
    }

    /// Last opp bilde for premie. Bruker JSON + base64 (ingen multipart-
    /// mønster i denne klienten). Returnerer (url, b2Key) som lagres på
    /// `OrgPrizeProductDTO.imageUrl` / `imageB2Key`.
    func uploadPrizeImage(
        data: Data,
        mimeType: String
    ) async throws -> (url: String, b2Key: String) {
        let payload = PrizeImageUploadPayload(
            data: data.base64EncodedString(),
            mimeType: mimeType
        )
        let resp: PrizeImageUploadResponse = try await _post(
            "/api/leadgrid/sales-leadership/prize-catalog/upload-image",
            body: payload
        )
        return (resp.url, resp.b2Key)
    }

    // -- Contests ------------------------------------------------

    func fetchContests(status: String?) async throws -> [ContestDTO] {
        var path = "/api/leadgrid/sales-leadership/contests"
        if let s = status, !s.isEmpty,
           let enc = s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        {
            path += "?status=\(enc)"
        }
        let resp: SalesLeadershipContestsEnvelope = try await _get(path)
        return resp.contests
    }

    func fetchContestDetail(id: UUID) async throws -> ContestDTO {
        let resp: SalesLeadershipContestEnvelope =
            try await _get("/api/leadgrid/sales-leadership/contests/\(id.uuidString)")
        return resp.contest
    }

    func createContest(_ payload: CreateContestPayload) async throws -> ContestDTO {
        let resp: SalesLeadershipContestEnvelope = try await _post(
            "/api/leadgrid/sales-leadership/contests",
            body: payload
        )
        return resp.contest
    }

    /// Lukker en konkurranse → backend registrerer vinnere og oppretter
    /// `sales_prize_awards`-rader. Returnerer den oppdaterte konkurransen.
    func closeContest(id: UUID) async throws -> ContestDTO {
        let resp: SalesLeadershipContestEnvelope = try await _postEmpty(
            "/api/leadgrid/sales-leadership/contests/\(id.uuidString)/close"
        )
        return resp.contest
    }

    func deleteContest(id: UUID) async throws {
        try await _delete("/api/leadgrid/sales-leadership/contests/\(id.uuidString)")
    }

    // -- Awards (fulfillment) ------------------------------------

    /// Hent fulfillment-tildelinger. `orgWide=true` → alle i org (admin
    /// view); ellers kun mine egne.
    func fetchAwards(status: String?, orgWide: Bool) async throws -> [PrizeAwardDTO] {
        var qs: [String] = []
        if let s = status, !s.isEmpty,
           let enc = s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        {
            qs.append("status=\(enc)")
        }
        if orgWide { qs.append("scope=org") }
        let path = "/api/leadgrid/sales-leadership/awards"
            + (qs.isEmpty ? "" : "?\(qs.joined(separator: "&"))")
        let resp: SalesLeadershipAwardsEnvelope = try await _get(path)
        return resp.awards
    }

    /// Skyv award ett steg videre i status-tidslinjen (pending → ordered
    /// → shipped → received). Backend setter riktig timestamp-felt.
    func advanceAward(
        id: UUID,
        trackingNumber: String?,
        notes: String?
    ) async throws -> PrizeAwardDTO {
        let payload = AdvanceAwardPayload(trackingNumber: trackingNumber, notes: notes)
        let resp: SalesLeadershipAwardEnvelope = try await _post(
            "/api/leadgrid/sales-leadership/awards/\(id.uuidString)/advance",
            body: payload
        )
        return resp.award
    }

    func setAwardShippingAddress(id: UUID, address: ShippingAddress) async throws {
        let payload = SetAwardAddressPayload(address: address)
        try await _post(
            "/api/leadgrid/sales-leadership/awards/\(id.uuidString)/shipping-address",
            body: payload
        )
    }
}

// ============================================================
// MARK: - Private payloads + response envelopes
// ============================================================

private struct UpdateContestTemplatePayload: Encodable {
    let templateType: String
    let enabled: Bool
    let defaults: [String: String]
}

private struct PrizeImageUploadPayload: Encodable {
    /// Base64-kodet bilde-data.
    let data: String
    let mimeType: String
}

private struct PrizeImageUploadResponse: Decodable {
    let url: String
    let b2Key: String
}

private struct AdvanceAwardPayload: Encodable {
    let trackingNumber: String?
    let notes: String?
}

private struct SetAwardAddressPayload: Encodable {
    let address: ShippingAddress
}

private struct SalesLeadershipTemplatesEnvelope: Decodable {
    let templates: [ContestTemplateDTO]
}

private struct SalesLeadershipCatalogEnvelope: Decodable {
    let products: [OrgPrizeProductDTO]
}

private struct SalesLeadershipPrizeProductEnvelope: Decodable {
    let product: OrgPrizeProductDTO
}

private struct SalesLeadershipContestsEnvelope: Decodable {
    let contests: [ContestDTO]
}

private struct SalesLeadershipContestEnvelope: Decodable {
    let contest: ContestDTO
}

private struct SalesLeadershipAwardsEnvelope: Decodable {
    let awards: [PrizeAwardDTO]
}

private struct SalesLeadershipAwardEnvelope: Decodable {
    let award: PrizeAwardDTO
}

// ============================================================
// MARK: - JSONValue (polymorf JSON-bro for Codable)
// ============================================================
//
// Brukes til å re-serialisere JSONB-felter (commission config,
// kpi_config, product_snapshot) der vi ikke ønsker å typebinde
// strukturen i Swift. Decoder leser arbitrær JSON → vi koder den
// tilbake som rå Data; view-laget kan parse polymorft eller bare
// videresende.

enum JSONValue: Codable, Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let b = try? c.decode(Bool.self) { self = .bool(b); return }
        if let n = try? c.decode(Double.self) { self = .number(n); return }
        if let s = try? c.decode(String.self) { self = .string(s); return }
        if let a = try? c.decode([JSONValue].self) { self = .array(a); return }
        if let o = try? c.decode([String: JSONValue].self) { self = .object(o); return }
        throw DecodingError.dataCorruptedError(
            in: c, debugDescription: "Ukjent JSON-form"
        )
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .number(let n): try c.encode(n)
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }

    /// Flat key→string map (for ContestTemplateDTO.defaults).
    /// Nestede strukturer ignoreres; arrays joines med komma.
    func flatStringMap() -> [String: String] {
        guard case .object(let dict) = self else { return [:] }
        var out: [String: String] = [:]
        for (k, v) in dict {
            switch v {
            case .null: out[k] = ""
            case .bool(let b): out[k] = b ? "true" : "false"
            case .number(let n):
                if n.rounded() == n, abs(n) < 1e15 {
                    out[k] = String(Int64(n))
                } else {
                    out[k] = String(n)
                }
            case .string(let s): out[k] = s
            case .array(let a):
                out[k] = a.compactMap { v -> String? in
                    if case .string(let s) = v { return s }
                    if case .number(let n) = v { return String(n) }
                    return nil
                }.joined(separator: ",")
            case .object: continue
            }
        }
        return out
    }
}
