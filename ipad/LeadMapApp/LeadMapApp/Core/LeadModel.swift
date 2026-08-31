// LeadModel.swift
//
// Codable som matcher backend MapLead-typen (frontend/client TypeScript-
// versjonen). Backend bruker snake_case → JSONDecoder konfigurert med
// .convertFromSnakeCase, så vi skriver felt-navn i camelCase her.

import Foundation

enum LeadStatus: String, Codable, CaseIterable, Identifiable {
    case unvisited
    case visited
    case `return`
    case notPresent = "not_present"
    case declined
    case interested
    case meetingBooked = "meeting_booked"
    case proposalSent = "proposal_sent"
    case won
    case lost
    case doNotContact = "do_not_contact"

    public var id: String { rawValue }

    /// Norsk visning i UI (2026-07-02: byttet fra engelsk fordi picker-menyer
    /// i VisitLogModal viste «Interested / Meeting booked / Declined» osv.
    /// Rå enum-verdiene ligger fortsatt i engelsk snake_case mot backend).
    var label: String {
        switch self {
        case .unvisited: return "Ikke besøkt"
        case .visited: return "Besøkt"
        case .return: return "Kom tilbake"
        case .notPresent: return "Ikke tilstede"
        case .declined: return "Avslo"
        case .interested: return "Interessert"
        case .meetingBooked: return "Møte booket"
        case .proposalSent: return "Tilbud sendt"
        case .won: return "Vunnet"
        case .lost: return "Tapt"
        case .doNotContact: return "Ikke kontakt"
        }
    }
}

struct LeadModel: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let company: String?
    let category: String?
    let status: LeadStatus
    let address: String?
    let postalCode: String?
    let city: String?
    let country: String?
    let latitude: Double
    let longitude: Double
    let phone: String?
    let email: String?
    let websiteUrl: String?
    // ── Strukturert bedrifts- og kontaktprofil (mig 474) ─────────────
    // Default nil holder eksplisitte test-/preview-initializers kompatible.
    var organizationNumber: String? = nil
    var contactName: String? = nil
    var contactRole: String? = nil
    var employeeCountEstimate: Int? = nil
    var annualRevenueNokEstimate: Double? = nil
    let instagramUrl: String?
    let linkedinUrl: String?
    let googleRating: Double?
    let googlePlaceId: String?
    /// Bedrifts-logo (mig 288). Vises som sirkulær pin på kartet.
    let logoUrl: String?
    let aiOpportunityScore: Int?
    /// CPV-koder (anbuds-språket) — settes automatisk fra bransjen.
    var cpvKoder: [String]? = nil
    let estimatedValue: Double?
    let leadSource: String?
    let assignedUserId: String?
    let assignedUserName: String?
    let assignedUserEmail: String?
    let projectId: String?
    let lastVisitAt: Date?
    let nextFollowUpAt: Date?
    let nextAction: String?
    let tags: [String]?
    let notes: String?
    let createdAt: Date
    let updatedAt: Date
    // ── Leadgrid Intelligence (PR #855) ──────────────────────────────
    // Felter som backend kan returnere på MapLead-payloaden. Brukes til å
    // styre pulserende lilla "hot"-pin og pipeline-baserte map-farger.
    // Alle valgfrie så eldre/cachede payloads fortsatt decodes.
    let leadTemperature: String?
    let pipelineStage: String?
    let leadScore: Int?
    // ── Bransje-kategorisering (mig 329) ─────────────────────────────
    /// Bransje-id (industries.id). Brukes for IndustryBadge i UI og
    /// «Bare mine bransjer»-filter på kartet. Backwards-compat: optional
    /// så eldre cached payloads fortsatt decodes.
    let industryId: String?
}
