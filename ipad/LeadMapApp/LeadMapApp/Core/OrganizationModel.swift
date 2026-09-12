// OrganizationModel.swift
//
// Organisasjons-modell speilet fra web (mig 285+).
// Brukes for org-velger, org-profil og medlems-liste.

import Foundation

struct OrganizationSummary: Identifiable, Decodable, Hashable {
    let id: String
    let name: String
    let slug: String?
    let plan: String
    let orgType: String
    let logoUrl: String?
    let role: String
    let memberCount: Int
    let projectCount: Int

    var isDeveloperOrg: Bool { orgType == "developer" }
}

struct OrganizationProfile: Decodable {
    let id: String
    let name: String
    let slug: String?
    let plan: String
    let orgType: String
    let description: String?
    let website: String?
    let industry: String?
    let orgNumber: String?
    let phone: String?
    let contactEmail: String?
    let addressLine: String?
    let postalCode: String?
    let city: String?
    let country: String?
    let logoUrl: String?
    let brandColor: String?

    /// owner_user_id-flagget. Settes av /profile-respons.
    var isOwnerOnlyLocked: Bool = false

    private enum CodingKeys: String, CodingKey {
        case id, name, slug, plan, description, website, industry, phone, country
        case orgType = "orgType"
        case orgNumber = "orgNumber"
        case contactEmail = "contactEmail"
        case addressLine = "addressLine"
        case postalCode = "postalCode"
        case city
        case logoUrl = "logoUrl"
        case brandColor = "brandColor"
    }
}

struct MemberProfile: Decodable, Identifiable {
    let userId: String
    let role: String
    let salesTeamId: String?
    let userEmail: String?
    let userName: String?
    let displayName: String?
    let title: String?
    let avatarUrl: String?
    let phone: String?
    let profileContactEmail: String?
    let linkedinUrl: String?
    let territory: String?
    let quotaMonthlyNok: String?
    let commissionPct: String?
    let isActive: Bool?
    let teamName: String?
    let lastActiveAt: String?
    let isOnline: Bool?

    var id: String { userId }
}

struct SalesTeam: Identifiable, Decodable {
    let id: String
    let name: String
    let description: String?
    let territory: String?
    let teamLeadUserId: String?
    let teamLeadName: String?
    let teamLeadEmail: String?
    let memberCount: Int
}

struct MemberLocation: Decodable, Identifiable {
    let userId: String
    let lat: Double
    let lng: Double
    let accuracyM: Double?
    let activity: String
    let currentLeadId: String?
    let currentVisitId: String?
    let updatedAt: String
    let displayName: String?
    let title: String?
    let avatarUrl: String?
    let role: String
    let teamName: String?

    var id: String { userId }

    /// Online = oppdatert siste 5 min
    var isFresh: Bool {
        guard let date = ISO8601DateFormatter().date(from: updatedAt) else { return false }
        return Date().timeIntervalSince(date) < 5 * 60
    }
}

struct PermissionsResponse: Decodable {
    let role: String?
    let permissions: [String]
    let organizationId: String?
}
