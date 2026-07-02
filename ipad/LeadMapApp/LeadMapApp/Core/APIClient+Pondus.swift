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

    // -- List / get -------------------------------------------------

    /// List publiserte maler (Leadgrid-global + egen org).
    /// `publishedOnly = false` er kun gyldig for SuperAdmin — backend
    /// tvinger `is_published = TRUE`-filter ellers.
    func pondusListTemplates(
        category: String?,
        kind: String?,
        publishedOnly: Bool
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
        let path = "/api/leadgrid/pondus/templates"
            + (qs.isEmpty ? "" : "?\(qs.joined(separator: "&"))")
        let resp: PondusTemplatesResponse = try await _get(path)
        return resp.templates
    }

    func pondusGetTemplate(id: String) async throws -> PondusTemplateDTO {
        let resp: PondusTemplateResponse = try await _get(
            "/api/leadgrid/pondus/templates/\(id)"
        )
        return resp.template
    }

    // -- Mutations (SuperAdmin only) -------------------------------

    func pondusCreateTemplate(
        _ payload: CreatePondusTemplatePayload
    ) async throws -> PondusTemplateDTO {
        let resp: PondusTemplateResponse = try await _post(
            "/api/leadgrid/pondus/templates",
            body: payload
        )
        return resp.template
    }

    func pondusUpdateTemplate(
        id: String,
        _ payload: UpdatePondusTemplatePayload
    ) async throws -> PondusTemplateDTO {
        let resp: PondusTemplateResponse = try await _patch(
            "/api/leadgrid/pondus/templates/\(id)",
            body: payload
        )
        return resp.template
    }

    func pondusPublishTemplate(
        id: String,
        published: Bool
    ) async throws -> PondusTemplateDTO {
        struct PublishPayload: Encodable { let published: Bool }
        let resp: PondusTemplateResponse = try await _post(
            "/api/leadgrid/pondus/templates/\(id)/publish",
            body: PublishPayload(published: published)
        )
        return resp.template
    }

    func pondusDeleteTemplate(id: String) async throws {
        try await _delete("/api/leadgrid/pondus/templates/\(id)")
    }

    // -- Versions --------------------------------------------------

    func pondusTemplateVersions(id: String) async throws -> [PondusTemplateVersionDTO] {
        let resp: PondusVersionsResponse = try await _get(
            "/api/leadgrid/pondus/templates/\(id)/versions"
        )
        return resp.versions
    }

    func pondusRollback(
        id: String,
        version: Int
    ) async throws -> PondusTemplateDTO {
        let resp: PondusTemplateResponse = try await _postEmpty(
            "/api/leadgrid/pondus/templates/\(id)/rollback/\(version)"
        )
        return resp.template
    }

    // -- Content-by-step (varianter) -------------------------------

    func pondusContentByStep(
        templateId: String,
        stepKey: String?
    ) async throws -> [PondusContentVariantDTO] {
        var qs: [String] = ["template_id=\(templateId)"]
        if let s = stepKey, !s.isEmpty,
           let enc = s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        {
            qs.append("step_key=\(enc)")
        }
        let path = "/api/leadgrid/pondus/content-by-step?\(qs.joined(separator: "&"))"
        let resp: PondusVariantsResponse = try await _get(path)
        return resp.variants
    }

    func pondusCreateVariant(
        _ payload: CreatePondusVariantPayload
    ) async throws -> PondusContentVariantDTO {
        let resp: PondusVariantResponse = try await _post(
            "/api/leadgrid/pondus/content-by-step",
            body: payload
        )
        return resp.variant
    }
}
