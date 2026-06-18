// SuperAdminFase26Models.swift
//
// Fase 26: Cockpit sub-features + Lead-map detalj + Decks/funding + Errors-detail.

import Foundation

// ============================================================
// MARK: - Cockpit: PR/Journalists
// ============================================================

struct PRJournalist: Codable, Hashable, Identifiable {
    let id: String
    let fullName: String
    let outlet: String?
    let role: String?
    let email: String?
    let beat: String?
    let status: String?         // 'active' | 'cold' | 'do_not_contact' | 'archived'
    let lastContactedAt: String?
    let lastResponseAt: String?
    let responseRate: Double?
}

struct PRJournalistsResponse: Codable {
    let journalists: [PRJournalist]
}

struct PRRelease: Codable, Hashable, Identifiable {
    let id: String
    let title: String?
    let slug: String?
    let status: String?         // 'draft' | 'ready' | 'distributed'
    let body: String?
    let distributedAt: String?
    let recipientCount: Int?
    let createdAt: String?
}

struct PRReleasesResponse: Codable {
    let releases: [PRRelease]
}

// ============================================================
// MARK: - Cockpit: Webinars
// ============================================================

struct CockpitWebinar: Codable, Hashable, Identifiable {
    let id: String
    let slug: String?
    let title: String
    let scheduledAt: String?
    let durationMinutes: Int?
    let status: String?         // 'draft' | 'scheduled' | 'live' | 'completed'
    let capacity: Int?
    let zoomJoinUrl: String?
    let registrationCount: Int?
}

struct CockpitWebinarsResponse: Codable {
    let webinars: [CockpitWebinar]
}

// ============================================================
// MARK: - Cockpit: Referrals + nurture
// ============================================================

struct CockpitReferral: Codable, Hashable, Identifiable {
    let id: String
    let referrerName: String?
    let referrerEmail: String?
    let referredName: String?
    let referredEmail: String?
    let status: String?         // 'pending' | 'qualified' | 'converted' | 'lost'
    let rewardOere: Int?
    let createdAt: String?
    let convertedAt: String?
}

struct CockpitReferralsResponse: Codable {
    let referrals: [CockpitReferral]
}

struct NurtureRunResult: Codable {
    let sent: Int?
    let skipped: Int?
    let failed: Int?
}

// ============================================================
// MARK: - Lead Map detalj-sub
// ============================================================

struct LeadMapPlaceImportResult: Codable {
    let imported: Int
    let skipped: Int
    let errors: Int?
}

struct LeadMapPlaceSearchResult: Codable, Hashable, Identifiable {
    let placeId: String
    let name: String
    let address: String?
    let lat: Double?
    let lng: Double?
    let category: String?

    var id: String { placeId }
}

struct LeadMapPlacesSearchResponse: Codable {
    let places: [LeadMapPlaceSearchResult]
}

struct LeadMapPitch: Codable {
    let pitchMarkdown: String
    let generatedAt: String?
    let modelUsed: String?
}

// ============================================================
// MARK: - Admin Decks (business decks for super-admin)
// ============================================================

struct AdminDeck: Codable, Hashable, Identifiable {
    let id: String
    let title: String?
    let purpose: String?         // 'investor' | 'partner' | 'sales' | 'internal'
    let slideCount: Int?
    let status: String?          // 'draft' | 'ready' | 'archived'
    let createdAt: String?
    let updatedAt: String?
}

struct AdminDecksResponse: Codable {
    let decks: [AdminDeck]
}

struct AdminDeckSlide: Codable, Hashable, Identifiable {
    let id: String
    let deckId: String
    let title: String?
    let bodyMarkdown: String?
    let position: Int
    let layout: String?
}

struct AdminDeckSlidesResponse: Codable {
    let slides: [AdminDeckSlide]
}

// ============================================================
// MARK: - Funding Apps
// ============================================================

struct FundingApp: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let fundingProgram: String?
    let amountRequestedNok: Double?
    let status: String?          // 'draft' | 'submitted' | 'approved' | 'rejected'
    let deadline: String?
    let submittedAt: String?
    let createdAt: String?
}

struct FundingAppsResponse: Codable {
    let apps: [FundingApp]
}

// ============================================================
// MARK: - CS Snapshot-all
// ============================================================

struct CSSnapshotAllResult: Codable {
    let ok: Bool
    let snapshotted: Int?
    let skipped: Int?
    let failed: Int?
    let durationMs: Int?
}

// ============================================================
// MARK: - Error detail
// ============================================================

struct AdminErrorDetail: Codable, Hashable {
    let id: String
    let source: String?
    let level: String?
    let title: String?
    let message: String?
    let stackTrace: String?
    let endpoint: String?
    let httpStatus: Int?
    let userId: String?
    let userEmail: String?
    let userAgent: String?
    let ipAddress: String?
    let metadata: [String: String]?
    let occurrenceCount: Int?
    let firstSeenAt: String?
    let lastSeenAt: String?
    let createdAt: String?
    let resolvedAt: String?
    let resolvedByUserId: String?
    let resolvedNote: String?
}

struct AdminErrorDetailResponse: Codable {
    let error: AdminErrorDetail
}
