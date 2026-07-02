// PondusModels.swift
//
// Leadgrid Pondus — mal-katalog for salgs-scripts. DTO-er som matcher
// `backend/server/pondus-routes.ts` + skjema i mig 0355.
//
// NB: Backend snake_case → camelCase via `APIClient._sharedDecoder`
// (keyDecodingStrategy = .convertFromSnakeCase). Vi navngir alle felt
// camelCase her.
//
// NB: `PondusTemplate` / `PondusStep` finnes allerede som mock-models i
// `Views/Tabs/Leadbook/LeadbookView.swift` (`PondusData.templates`). For
// å unngå kollisjon bruker vi `DTO`-suffiks — matcher konvensjonen i
// `APIClient+SalesLeadership.swift` (`CommissionConfigDTO`, `ContestDTO`).
// Views laget for backend-data typer eksplisitt på `*DTO`; existing mock
// fortsetter å bruke gamle structs inntil views er portet over.
//
// Timestamps holdes som `String?` (backend returnerer ISO8601 via
// `TIMESTAMPTZ`). Views kan formatere via `LeadgridDate.formatNo(...)`.

import Foundation

// ============================================================
// MARK: - Templates
// ============================================================

/// Kanoniske «kind»-verdier fra backend (matcher `VALID_KINDS` i
/// pondus-routes.ts). Åpen-verdi-CaseIterable — ukjente verdier faller
/// til `.telephone` for enum-cast, men vi lagrer rå streng for framtidig
/// utvidbarhet.
enum PondusKind: String, Codable, Hashable, CaseIterable, Sendable {
    case telephone
    case video
    case email
    case meeting
    case field
}

/// Kategoriene er åpne strenger backend-side. Vi eksponerer noen
/// kanoniske konstanter for autocompletion / UI-badge-farge; view kan
/// alltid vise rå streng for ukjente kategorier.
enum PondusCategory {
    static let firstContact = "first_contact"
    static let meetingOpen = "meeting_open"
    static let priceObjection = "price_objection"
    static let decisionMaker = "decision_maker"
    static let followUp = "follow_up"
    static let custom = "custom"
}

/// Ett steg i en pondus-mal. Matcher `pondus_templates.steps[]` JSONB.
struct PondusStepDTO: Codable, Hashable, Identifiable, Sendable {
    /// Stabil nøkkel (matcher `pondus_content_by_step.step_key`).
    let id: String
    let title: String
    let subtitle: String?
    let icon: String?      // SF Symbols-navn
    let prompt: String?
    let minLength: Int?
    let maxLength: Int?
    let order: Int

    enum CodingKeys: String, CodingKey {
        case id, title, subtitle, icon, prompt, minLength, maxLength, order
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        self.subtitle = try c.decodeIfPresent(String.self, forKey: .subtitle)
        self.icon = try c.decodeIfPresent(String.self, forKey: .icon)
        self.prompt = try c.decodeIfPresent(String.self, forKey: .prompt)
        self.minLength = try c.decodeIfPresent(Int.self, forKey: .minLength)
        self.maxLength = try c.decodeIfPresent(Int.self, forKey: .maxLength)
        self.order = try c.decodeIfPresent(Int.self, forKey: .order) ?? 0
    }

    init(
        id: String,
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        prompt: String? = nil,
        minLength: Int? = nil,
        maxLength: Int? = nil,
        order: Int
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.prompt = prompt
        self.minLength = minLength
        self.maxLength = maxLength
        self.order = order
    }
}

/// Per-akse pondus-analyse (0-100 per akse). Matcher backend-kolonnen
/// `pondus_templates.analysis` (mig 0356). Nøkler er engelske i backend for
/// stabilitet; view-lag mapper til norsk UI-tekst
/// (autoritet / klarhet / troverdighet / trygghet / fremdrift).
///
/// `analysis: PondusAnalysisDTO?` på `PondusTemplateDTO` — nil for legacy-
/// rader hentet fra en backend uten 0356. Views + Watch-sync har fallback
/// til overall score.
struct PondusAnalysisDTO: Codable, Hashable, Sendable {
    let authority: Int
    let clarity: Int
    let trust: Int
    let safety: Int
    let momentum: Int

    init(
        authority: Int,
        clarity: Int,
        trust: Int,
        safety: Int,
        momentum: Int
    ) {
        self.authority = authority
        self.clarity = clarity
        self.trust = trust
        self.safety = safety
        self.momentum = momentum
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Klemmer verdier til 0-100 og faller til 0 for manglende akser.
        // Views/Watch-sync gjør ytterligere fallback (til overall score)
        // hvis hele analysen mangler.
        self.authority = Self.clamp(try c.decodeIfPresent(Int.self, forKey: .authority) ?? 0)
        self.clarity   = Self.clamp(try c.decodeIfPresent(Int.self, forKey: .clarity)   ?? 0)
        self.trust     = Self.clamp(try c.decodeIfPresent(Int.self, forKey: .trust)     ?? 0)
        self.safety    = Self.clamp(try c.decodeIfPresent(Int.self, forKey: .safety)    ?? 0)
        self.momentum  = Self.clamp(try c.decodeIfPresent(Int.self, forKey: .momentum)  ?? 0)
    }

    private static func clamp(_ v: Int) -> Int { max(0, min(100, v)) }

    enum CodingKeys: String, CodingKey {
        case authority, clarity, trust, safety, momentum
    }

    /// True hvis alle akser er 0 — brukes av views/Watch-sync for å
    /// bestemme om vi skal falle tilbake til overall score.
    var isEmpty: Bool {
        authority == 0 && clarity == 0 && trust == 0 && safety == 0 && momentum == 0
    }
}

/// Én innvending m/ forslag til svar. Matcher `pondus_templates.objections[]`.
struct PondusObjectionDTO: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let prompt: String
    let response: String

    init(id: String, prompt: String, response: String) {
        self.id = id
        self.prompt = prompt
        self.response = response
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.prompt = try c.decodeIfPresent(String.self, forKey: .prompt) ?? ""
        self.response = try c.decodeIfPresent(String.self, forKey: .response) ?? ""
    }

    enum CodingKeys: String, CodingKey { case id, prompt, response }
}

/// Hoved-DTO — én rad fra `pondus_templates`.
struct PondusTemplateDTO: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let description: String?
    let category: String                 // åpen streng — se PondusCategory
    /// Rå streng slik at ukjente «kind»-verdier ikke krasjer decode.
    /// Bruk `kindEnum` for typet variant.
    let kind: String
    let score: Int                       // 0-100
    let steps: [PondusStepDTO]
    let objections: [PondusObjectionDTO]
    /// Per-akse analyse (mig 0356). Nil hvis backend ikke har 0356 kjørt
    /// enda — views/Watch-sync har fallback til overall score.
    let analysis: PondusAnalysisDTO?
    let createdBy: String?
    let orgId: UUID?
    let isPublished: Bool
    let publishedAt: String?
    let publishedBy: String?
    let version: Int
    let createdAt: String?
    let updatedAt: String?

    /// Typet `kind` med default `.telephone` for ukjente verdier.
    var kindEnum: PondusKind {
        PondusKind(rawValue: kind) ?? .telephone
    }

    /// True = Leadgrid-global mal (alle orgs kan bruke).
    var isLeadgridGlobal: Bool { orgId == nil }

    /// Steg sortert etter `order`.
    var orderedSteps: [PondusStepDTO] {
        steps.sorted { $0.order < $1.order }
    }
}

// ============================================================
// MARK: - Versions (audit + rollback)
// ============================================================

/// Versjons-snapshot fra `pondus_template_versions`. `snapshot` er hele
/// forrige tilstand som JSON — vi tolker den ikke i Swift, kun viser
/// metadata (dato + endret av).
struct PondusTemplateVersionDTO: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let templateId: UUID
    let version: Int
    /// Rå JSON-snapshot. Bruk `snapshotSummary` for kort visning.
    let snapshot: PondusSnapshotSummary
    let changedBy: String?
    let changedAt: String?
}

/// Vi trekker ut de vanligste feltene fra snapshot (name, version,
/// isPublished) for UI. Ukjente felt ignoreres.
struct PondusSnapshotSummary: Codable, Hashable, Sendable {
    let name: String?
    let description: String?
    let category: String?
    let kind: String?
    let score: Int?
    let version: Int?
    let isPublished: Bool?

    init(
        name: String? = nil,
        description: String? = nil,
        category: String? = nil,
        kind: String? = nil,
        score: Int? = nil,
        version: Int? = nil,
        isPublished: Bool? = nil
    ) {
        self.name = name
        self.description = description
        self.category = category
        self.kind = kind
        self.score = score
        self.version = version
        self.isPublished = isPublished
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.name = try c.decodeIfPresent(String.self, forKey: .name)
        self.description = try c.decodeIfPresent(String.self, forKey: .description)
        self.category = try c.decodeIfPresent(String.self, forKey: .category)
        self.kind = try c.decodeIfPresent(String.self, forKey: .kind)
        self.score = try c.decodeIfPresent(Int.self, forKey: .score)
        self.version = try c.decodeIfPresent(Int.self, forKey: .version)
        self.isPublished = try c.decodeIfPresent(Bool.self, forKey: .isPublished)
    }

    enum CodingKeys: String, CodingKey {
        case name, description, category, kind, score, version, isPublished
    }
}

// ============================================================
// MARK: - Content variants (per-steg bibliotek)
// ============================================================

/// Én variant av innhold for et enkelt steg. Matcher
/// `pondus_content_by_step`.
struct PondusContentVariantDTO: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let templateId: UUID
    let stepKey: String
    let variantName: String
    let contentText: String
    let score: Int
    let createdBy: String?
    let createdAt: String?
}

// ============================================================
// MARK: - Request payloads (create/update)
// ============================================================

/// Payload for POST /templates. `orgId` = nil → Leadgrid-global.
struct CreatePondusTemplatePayload: Encodable, Sendable {
    let name: String
    let description: String?
    let category: String
    let kind: String
    let score: Int
    let steps: [PondusStepDTO]
    let objections: [PondusObjectionDTO]
    let analysis: PondusAnalysisDTO?
    let orgId: UUID?

    init(
        name: String,
        description: String?,
        category: String,
        kind: String,
        score: Int,
        steps: [PondusStepDTO],
        objections: [PondusObjectionDTO],
        analysis: PondusAnalysisDTO? = nil,
        orgId: UUID?
    ) {
        self.name = name
        self.description = description
        self.category = category
        self.kind = kind
        self.score = score
        self.steps = steps
        self.objections = objections
        self.analysis = analysis
        self.orgId = orgId
    }

    enum CodingKeys: String, CodingKey {
        case name, description, category, kind, score, steps, objections, analysis, orgId
    }
}

/// Payload for PATCH /templates/:id. Alle felt er optional — kun
/// medsendte oppdateres backend-side.
struct UpdatePondusTemplatePayload: Encodable, Sendable {
    var name: String?
    var description: String?
    var category: String?
    var kind: String?
    var score: Int?
    var steps: [PondusStepDTO]?
    var objections: [PondusObjectionDTO]?
    var analysis: PondusAnalysisDTO?
}

/// Payload for POST /content-by-step.
struct CreatePondusVariantPayload: Encodable, Sendable {
    let templateId: UUID
    let stepKey: String
    let variantName: String
    let contentText: String
    let score: Int
}

// ============================================================
// MARK: - Response envelopes
// ============================================================

struct PondusTemplatesResponse: Codable, Sendable {
    let templates: [PondusTemplateDTO]
}

struct PondusTemplateResponse: Codable, Sendable {
    let template: PondusTemplateDTO
}

struct PondusVersionsResponse: Codable, Sendable {
    let versions: [PondusTemplateVersionDTO]
}

struct PondusVariantsResponse: Codable, Sendable {
    let variants: [PondusContentVariantDTO]
}

struct PondusVariantResponse: Codable, Sendable {
    let variant: PondusContentVariantDTO
}
