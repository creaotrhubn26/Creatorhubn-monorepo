// SuperAdminFase23Models.swift
//
// Fase 23: Leadgrid public-flyter + admin-actions som mangler.
// - Drips management (super-admin cron-status + manuell-run)
// - Marketplace (utforske partner-tilbud)
// - Partner-application status (selv-tjeneste søknads-flyt)
// - Developer-application (utvikler-program)
// - Scheduled-reports manuell-run + auto-create-for-team

import Foundation

// ============================================================
// MARK: - Drips (e-post-serier)
// ============================================================

struct DripRunResult: Codable {
    let ok: Bool
    let sent: Int?
    let skipped: Int?
    let errors: Int?
}

struct DripConversionPayload: Codable {
    let leadId: String
    let conversionType: String  // 'meeting_booked' | 'won' | 'demo_signed'
}

// ============================================================
// MARK: - Marketplace
// ============================================================

struct LeadgridMarketplacePartner: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let slug: String?
    let logoUrl: String?
    let website: String?
    let tagline: String?
    let partnerType: String?
    let tier: String?
}

struct LeadgridMarketplaceResponse: Codable {
    let partners: [LeadgridMarketplacePartner]
}

// ============================================================
// MARK: - Partner-application (selv-tjeneste)
// ============================================================

struct LeadgridPartnerApplication: Codable, Hashable, Identifiable {
    let id: String
    let organizationId: String?
    let organizationName: String?
    let partnerType: String?
    let proposedTagline: String?
    let reason: String?
    let proposedLogoUrl: String?
    let status: String              // 'pending' | 'approved' | 'rejected' | 'sandbox'
    let documentCount: Int?
    let termsVersion: String?
    let createdAt: String?
    let reviewedAt: String?
    let reviewerNotes: String?

    // Custom decoder så `status` faller tilbake til "pending" hvis backend
    // gir null, og `documentCount` parses fra både Int og String (pg returnerer
    // BIGINT som streng om vi ikke caster ::int).
    private enum Keys: String, CodingKey {
        case id, organizationId, organizationName, partnerType, proposedTagline
        case reason, proposedLogoUrl, status, documentCount, termsVersion
        case createdAt, reviewedAt, reviewerNotes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        self.id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        self.organizationId = try? c.decode(String.self, forKey: .organizationId)
        self.organizationName = try? c.decode(String.self, forKey: .organizationName)
        self.partnerType = try? c.decode(String.self, forKey: .partnerType)
        self.proposedTagline = try? c.decode(String.self, forKey: .proposedTagline)
        self.reason = try? c.decode(String.self, forKey: .reason)
        self.proposedLogoUrl = try? c.decode(String.self, forKey: .proposedLogoUrl)
        self.status = (try? c.decode(String.self, forKey: .status)) ?? "pending"

        // documentCount kan være Int eller "5"-streng (bigint uten cast)
        if let i = try? c.decode(Int.self, forKey: .documentCount) {
            self.documentCount = i
        } else if let s = try? c.decode(String.self, forKey: .documentCount), let n = Int(s) {
            self.documentCount = n
        } else {
            self.documentCount = nil
        }

        self.termsVersion = try? c.decode(String.self, forKey: .termsVersion)
        self.createdAt = try? c.decode(String.self, forKey: .createdAt)
        self.reviewedAt = try? c.decode(String.self, forKey: .reviewedAt)
        self.reviewerNotes = try? c.decode(String.self, forKey: .reviewerNotes)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(organizationId, forKey: .organizationId)
        try c.encodeIfPresent(organizationName, forKey: .organizationName)
        try c.encodeIfPresent(partnerType, forKey: .partnerType)
        try c.encodeIfPresent(proposedTagline, forKey: .proposedTagline)
        try c.encodeIfPresent(reason, forKey: .reason)
        try c.encodeIfPresent(proposedLogoUrl, forKey: .proposedLogoUrl)
        try c.encode(status, forKey: .status)
        try c.encodeIfPresent(documentCount, forKey: .documentCount)
        try c.encodeIfPresent(termsVersion, forKey: .termsVersion)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(reviewedAt, forKey: .reviewedAt)
        try c.encodeIfPresent(reviewerNotes, forKey: .reviewerNotes)
    }
}

struct LeadgridPartnerApplicationsResponse: Codable {
    let applications: [LeadgridPartnerApplication]
}

struct LeadgridMyPartnerApplicationResponse: Codable {
    let application: LeadgridPartnerApplication?
    let canApply: Bool?
    let blockedReason: String?
}

// ============================================================
// MARK: - Developer-application (Leadgrid API for utviklere)
// ============================================================

struct LeadgridDeveloperApplication: Codable, Hashable {
    let id: String?
    let email: String
    let fullName: String?
    let organizationName: String?
    let website: String?
    let useCase: String?
    let integrationDescription: String?
    let expectedMonthlyApiCalls: Int?
    let status: String?             // 'pending' | 'approved' | 'rejected'
    let createdAt: String?
    let reviewedAt: String?
}

/// Mappes mot backend `GET /api/leadgrid/partner-terms`
/// (partner-applications-routes.ts). Backend gir `{version, body_md,
/// effective_at}`. iPad bruker historisk title/body/publishedAt.
struct LeadgridPartnerTerms: Codable, Hashable {
    let version: String
    let bodyMd: String?
    let effectiveAt: String?

    var title: String { "Partner-vilkår v\(version)" }
    var body: String { bodyMd ?? "" }
    var publishedAt: String? { effectiveAt }
}
