// APIClient+Pondus.swift
//
// Leadgrid Pondus — mal-katalog for salgs-scripts.
//
// Backend-skjema: backend/migrations/0355_leadgrid_pondus_templates.sql
// Endpoints:      /api/leadgrid/pondus/*
//
// Auth: SuperAdmin (users.role IN ('admin','super_admin')) kan
// create/update/publish/delete/rollback; alle innloggede kan liste
// og hente publiserte maler + varianter.

import Foundation

extension APIClient {

    private func pondusPath(_ path: String, organizationId: String?) -> String {
        guard let organizationId, !organizationId.isEmpty,
              let encoded = organizationId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        else { return path }
        return path + (path.contains("?") ? "&" : "?") + "organization_id=\(encoded)"
    }

    // -- List / get -------------------------------------------------

    /// List publiserte maler (Leadgrid-global + egen org).
    /// `publishedOnly = false` er kun gyldig for SuperAdmin — backend
    /// tvinger `is_published = TRUE`-filter ellers.
    func pondusListTemplates(
        category: String?,
        kind: String?,
        publishedOnly: Bool,
        organizationId: String? = nil
    ) async throws -> [PondusTemplateDTO] {
        var qs: [String] = []
        if let c = category, !c.isEmpty,
           let enc = c.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        {
            qs.append("category=\(enc)")
        }
        if let k = kind, !k.isEmpty,
           let enc = k.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        {
            qs.append("kind=\(enc)")
        }
        if !publishedOnly {
            qs.append("published=all")
        }
        let path = pondusPath("/api/leadgrid/pondus/templates"
            + (qs.isEmpty ? "" : "?\(qs.joined(separator: "&"))")
            , organizationId: organizationId)
        let resp: PondusTemplatesResponse = try await _get(path)
        return resp.templates
    }

    func pondusGetTemplate(id: String, organizationId: String? = nil) async throws -> PondusTemplateDTO {
        let resp: PondusTemplateResponse = try await _get(
            pondusPath("/api/leadgrid/pondus/templates/\(id)", organizationId: organizationId)
        )
        return resp.template
    }

    // -- Mutations (SuperAdmin only) -------------------------------

    func pondusCreateTemplate(
        _ payload: CreatePondusTemplatePayload,
        organizationId: String? = nil
    ) async throws -> PondusTemplateDTO {
        let resp: PondusTemplateResponse = try await _post(
            pondusPath("/api/leadgrid/pondus/templates", organizationId: organizationId),
            body: payload
        )
        return resp.template
    }

    func pondusUpdateTemplate(
        id: String,
        _ payload: UpdatePondusTemplatePayload,
        organizationId: String? = nil
    ) async throws -> PondusTemplateDTO {
        let resp: PondusTemplateResponse = try await _patch(
            pondusPath("/api/leadgrid/pondus/templates/\(id)", organizationId: organizationId),
            body: payload
        )
        return resp.template
    }

    func pondusPublishTemplate(
        id: String,
        published: Bool,
        expectedVersion: Int,
        organizationId: String? = nil
    ) async throws -> PondusTemplateDTO {
        struct PublishPayload: Encodable { let published: Bool; let expectedVersion: Int }
        let resp: PondusTemplateResponse = try await _post(
            pondusPath("/api/leadgrid/pondus/templates/\(id)/publish", organizationId: organizationId),
            body: PublishPayload(published: published, expectedVersion: expectedVersion)
        )
        return resp.template
    }

    func pondusDeleteTemplate(id: String, organizationId: String? = nil) async throws {
        try await _delete(pondusPath("/api/leadgrid/pondus/templates/\(id)", organizationId: organizationId))
    }

    func pondusAnalyzeTemplate(
        _ payload: CreatePondusTemplatePayload,
        organizationId: String? = nil
    ) async throws -> PondusAnalysisResponse {
        try await _post(
            pondusPath("/api/leadgrid/pondus/analyze", organizationId: organizationId),
            body: payload
        )
    }

    /// Legg samme innvending til alle maler i én kategori («Legg til i
    /// alle relevante maler» i NewObjectionSheet). Samme org-scoping som
    /// pondusCreateTemplate (org-leder → egen org, SuperAdmin → globale).
    func pondusBulkAttachObjection(
        category: String,
        prompt: String,
        response: String,
        organizationId: String? = nil
    ) async throws -> [PondusTemplateDTO] {
        struct Payload: Encodable { let category: String; let prompt: String; let response: String }
        struct BulkAttachResponse: Decodable { let updated: Int; let templates: [PondusTemplateDTO] }
        let resp: BulkAttachResponse = try await _post(
            pondusPath("/api/leadgrid/pondus/objections/bulk-attach", organizationId: organizationId),
            body: Payload(category: category, prompt: prompt, response: response)
        )
        return resp.templates
    }

    // -- Versions --------------------------------------------------

    func pondusTemplateVersions(id: String, organizationId: String? = nil) async throws -> [PondusTemplateVersionDTO] {
        let resp: PondusVersionsResponse = try await _get(
            pondusPath("/api/leadgrid/pondus/templates/\(id)/versions", organizationId: organizationId)
        )
        return resp.versions
    }

    func pondusRollback(
        id: String,
        version: Int,
        expectedVersion: Int,
        organizationId: String? = nil
    ) async throws -> PondusTemplateDTO {
        struct RollbackPayload: Encodable { let expectedVersion: Int }
        let resp: PondusTemplateResponse = try await _post(
            pondusPath("/api/leadgrid/pondus/templates/\(id)/rollback/\(version)", organizationId: organizationId),
            body: RollbackPayload(expectedVersion: expectedVersion)
        )
        return resp.template
    }

    // -- Content-by-step (varianter) -------------------------------

    func pondusContentByStep(
        templateId: String,
        stepKey: String?,
        organizationId: String? = nil
    ) async throws -> [PondusContentVariantDTO] {
        var qs: [String] = ["template_id=\(templateId)"]
        if let s = stepKey, !s.isEmpty,
           let enc = s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        {
            qs.append("step_key=\(enc)")
        }
        let path = pondusPath(
            "/api/leadgrid/pondus/content-by-step?\(qs.joined(separator: "&"))",
            organizationId: organizationId
        )
        let resp: PondusVariantsResponse = try await _get(path)
        return resp.variants
    }

    func pondusCreateVariant(
        _ payload: CreatePondusVariantPayload,
        organizationId: String? = nil
    ) async throws -> PondusContentVariantDTO {
        let resp: PondusVariantResponse = try await _post(
            pondusPath("/api/leadgrid/pondus/content-by-step", organizationId: organizationId),
            body: payload
        )
        return resp.variant
    }
}

// MARK: - Usage-tracking (mig 0364)

/// Aggregert bruk per mal — datakilde for Leadbook-KPI-ene og
/// used/conversion på mal-kortene.
struct PondusTemplateUsageStatDTO: Decodable, Hashable {
    let templateId: String
    let usedTotal: Int
    let usedToday: Int
    let used30d: Int
    /// (meeting_booked + won) / used_total, 0-1.
    let meetingRate: Double
    /// Andel logget bruk som IKKE endte i no_answer, 0-1.
    let responseRate: Double
    /// won / (won+lost) blant avgjorte utfall, 0-1.
    let conversionRate: Double
}

/// Per-mal drill-down (2026-08-16) — utfalls-fordeling, per-selger,
/// siste logger. Erstatter EmptyView-placeholderen i PondusTab.
struct PondusTemplateUsageDetailDTO: Decodable {
    struct SellerRow: Decodable, Identifiable, Hashable {
        let userId: String
        let name: String
        let used: Int
        let meetings: Int
        var id: String { userId }
    }
    struct LogRow: Decodable, Identifiable, Hashable {
        /// ISO8601-streng fra backend (samme mønster som andre tidsfelt i
        /// APIClient — parses i UI-laget der visning krever det).
        let usedAt: String
        let outcome: String
        let usageSessionId: UUID?
        let source: String?
        let userName: String
        var id: String { usageSessionId?.uuidString ?? "\(usedAt)-\(userName)" }
    }
    /// outcome → antall, f.eks. ["used": 12, "won": 3, "lost": 2].
    let outcomes: [String: Int]
    let bySeller: [SellerRow]
    let recent: [LogRow]
}

struct PondusUsageTotalsDTO: Decodable, Hashable {
    let usedToday: Int
    let used30d: Int
    let distinctUsers30d: Int
    let meetingRate30d: Double
}

struct PondusUsageStatsDTO: Decodable {
    let templates: [PondusTemplateUsageStatDTO]
    let totals: PondusUsageTotalsDTO
}

extension APIClient {
    /// Logg at en mal ble brukt («Bruk mal»). Outcome kan ettersendes
    /// som ny logging (meeting_booked/won/...) for konverteringsrater.
    func pondusLogUsage(
        templateId: String,
        usageSessionId: UUID,
        leadId: String? = nil,
        outcome: String = "used",
        source: String = "ipad",
        organizationId: String? = nil
    ) async throws -> PondusUsageResponse {
        struct Payload: Encodable {
            let usageSessionId: UUID
            let leadId: String?
            let outcome: String
            let source: String
        }
        return try await _post(
            pondusPath("/api/leadgrid/pondus/templates/\(templateId)/usage", organizationId: organizationId),
            body: Payload(
                usageSessionId: usageSessionId,
                leadId: leadId,
                outcome: outcome,
                source: source
            )
        )
    }

    /// Aggregert bruk for org-en (per mal + topp-nivå).
    /// `period`: nil = all-time (uendret standardoppførsel), ellers
    /// "7d"/"30d"/"90d"/"ytd" — filtrerer per-mal-radene til vinduet.
    func pondusUsageStats(
        period: String? = nil,
        organizationId: String? = nil
    ) async throws -> PondusUsageStatsDTO {
        var path = "/api/leadgrid/pondus/usage/stats"
        if let period, !period.isEmpty {
            path += "?period=\(period)"
        }
        return try await _get(pondusPath(path, organizationId: organizationId))
    }

    /// Per-mal drill-down: utfalls-fordeling + per-selger + siste 20 logger.
    func pondusTemplateUsageDetail(
        templateId: String,
        organizationId: String? = nil
    ) async throws -> PondusTemplateUsageDetailDTO {
        try await _get(pondusPath(
            "/api/leadgrid/pondus/templates/\(templateId)/usage-detail",
            organizationId: organizationId
        ))
    }
}
