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

/// Mappes mot backend `GET /api/admin-room/cockpit/pr/releases`
/// (cockpit-b2b-routes.ts). Backend gir `{id, headline, subheadline,
/// milestone, status, generated_at, sent_at, embargo_until,
/// distributed_to_journalist_count}`. iPad bruker historisk
/// title/distributedAt/recipientCount — vi aliaser.
struct PRRelease: Codable, Hashable, Identifiable {
    let id: String
    let headline: String?
    let subheadline: String?
    let milestone: String?
    let status: String?
    let generatedAt: String?
    let sentAt: String?
    let embargoUntil: String?
    let distributedToJournalistCount: Int?

    var title: String? { headline }
    var slug: String? { nil }
    var body: String? { subheadline }
    var distributedAt: String? { sentAt }
    var recipientCount: Int? { distributedToJournalistCount }
    var createdAt: String? { generatedAt }
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

/// Mappes mot backend `GET /api/admin-room/cockpit/referrals`
/// (cockpit-b2b-routes.ts). Backend gir `{id, referrer_email, referrer_name,
/// referral_code, reward_type, reward_value, status, click_count,
/// referred_email, referred_agency_name, signed_up_at,
/// became_customer_at, created_at, expires_at}`.
struct CockpitReferral: Codable, Hashable, Identifiable {
    let id: String
    let referrerName: String?
    let referrerEmail: String?
    let referralCode: String?
    let rewardType: String?
    let rewardValue: Double?
    let status: String?
    let clickCount: Int?
    let referredEmail: String?
    let referredAgencyName: String?
    let signedUpAt: String?
    let becameCustomerAt: String?
    let createdAt: String?
    let expiresAt: String?

    var referredName: String? { referredAgencyName }
    var rewardOere: Int? {
        // reward_value er antall gratis-mnd eller %-rabatt. Vi vet ikke
        // hva penge-ekvivalent er per default — sett nil.
        return nil
    }
    var convertedAt: String? { becameCustomerAt }
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

    private struct Envelope: Codable {
        let items: [AdminDeck]?
        let decks: [AdminDeck]?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        self.decks = env.items ?? env.decks ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(decks, forKey: DynamicCodingKey(stringValue: "items")!)
    }
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

/// Mappes mot backend `GET /api/admin-room/funding-apps`
/// (admin-room-funding-routes.ts). Backend gir rå rader fra
/// `admin_funding_apps`: `{id, user_id, scheme, scheme_label, project_name,
/// applicant_company, status, amount_requested, currency, description,
/// milestones, budget_breakdown, contact_person, contact_email,
/// submission_date, decision_date, deadline, notes, metadata, created_at,
/// updated_at}`. Vi aliaser via computed.
struct FundingApp: Codable, Hashable, Identifiable {
    let id: String
    let projectName: String?
    let scheme: String?
    let schemeLabel: String?
    let applicantCompany: String?
    let status: String?
    let amountRequested: Double?
    let currency: String?
    let submissionDate: String?
    let decisionDate: String?
    let deadline: String?
    let createdAt: String?

    var name: String { projectName ?? scheme ?? "(uten navn)" }
    var fundingProgram: String? { schemeLabel ?? scheme }
    var amountRequestedNok: Double? { amountRequested }
    var submittedAt: String? { submissionDate }
}

struct FundingAppsResponse: Codable {
    let apps: [FundingApp]

    private struct Envelope: Codable {
        let items: [FundingApp]?
        let apps: [FundingApp]?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        self.apps = env.items ?? env.apps ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(apps, forKey: DynamicCodingKey(stringValue: "items")!)
    }
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
