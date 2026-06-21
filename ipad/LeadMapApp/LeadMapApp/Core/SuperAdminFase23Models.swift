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
