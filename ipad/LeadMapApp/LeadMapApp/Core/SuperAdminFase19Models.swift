// SuperAdminFase19Models.swift
//
// Fase 19: utvidet super-admin-paritet. Modeller for admin-room-features
// som tidligere bare fantes på web — RBAC matrise, promote-medlem,
// customer success, B2B cockpit, LinkedIn cockpit, case-studies,
// role nav config.

import Foundation

// ============================================================
// MARK: - RBAC permissions-matrise (per org)
// ============================================================

/// Liste over alle role-keys + default permissions per rolle.
/// Returnert fra `/api/admin-room/lead-map/organizations/:id/role-defaults`.
struct PermissionsMatrixResponse: Codable {
    let roles: [PermissionsRole]
}

struct PermissionsRole: Codable, Hashable, Identifiable {
    let key: String                 // 'sales_director' | 'team_leader' | ...
    let label: String?
    let defaultPermissions: [String]?
    let memberCount: Int?

    var id: String { key }
}

// ============================================================
// MARK: - Promote-medlem (sales-hierarki)
// ============================================================

struct PromotionPreview: Codable, Hashable {
    let fromRole: String?
    let toRole: String
    let permissionsAdded: [String]?
    let permissionsRemoved: [String]?
    let warningMessages: [String]?
    let memberName: String?
}

struct OrgMember: Codable, Hashable, Identifiable {
    let userId: String
    let name: String?
    let email: String?
    let role: String?
    let teamId: String?
    let teamName: String?
    let avatar: String?
    let lastSeenAt: String?

    var id: String { userId }
}

struct OrgMembersResponse: Codable {
    let members: [OrgMember]
}

// ============================================================
// MARK: - Customer Success
// ============================================================

struct CSDashboardSummary: Codable, Hashable {
    let totalCustomers: Int
    let activeCustomers: Int
    let atRiskCount: Int
    let churnedLast30d: Int
    let avgHealthScore: Double?
    let upcomingRenewalsCount: Int
    let newCustomersLast30d: Int
    let mrrTotalOere: Int?
    let mrrAtRiskOere: Int?

    var mrrTotalKr: Double { Double(mrrTotalOere ?? 0) / 100 }
    var mrrAtRiskKr: Double { Double(mrrAtRiskOere ?? 0) / 100 }
}

struct CSRenewal: Codable, Hashable, Identifiable {
    let id: String
    let userId: String?
    let customerName: String?
    let customerEmail: String?
    let renewalAt: String?
    let status: String              // 'pending' | 'confirmed' | 'churned' | 'at_risk'
    let mrrOere: Int?
    let lastInteractionAt: String?
    let assignedToUserId: String?
    let healthScore: Int?
    let notes: String?

    var formattedRenewalAt: String { LeadgridDate.formatNo(renewalAt) }
    var mrrKr: Double { Double(mrrOere ?? 0) / 100 }
}

struct CSRenewalsResponse: Codable {
    let renewals: [CSRenewal]
}

// ============================================================
// MARK: - B2B Cockpit (Daniels B2B-funnel for Leadgrid)
// ============================================================

struct B2BFunnelStep: Codable, Hashable, Identifiable {
    let step: String
    let count: Int
    let convertedCount: Int
    let dropOffCount: Int

    var id: String { step }
    var conversionPct: Int {
        guard count > 0 else { return 0 }
        return Int(Double(convertedCount) / Double(count) * 100)
    }
}

struct B2BFunnelResponse: Codable {
    let steps: [B2BFunnelStep]
    let totalLeads: Int
    let totalConverted: Int
    let arpuMonthlyNok: Double?
}

// ============================================================
// MARK: - LinkedIn Cockpit
// ============================================================

struct LinkedInCapiStatus: Codable, Hashable {
    let connected: Bool
    let lastSendAt: String?
    let pendingEvents: Int
    let sentLast30d: Int
    let failedLast30d: Int
    let expiredLast30d: Int?
}

struct LinkedInLeadSyncStatus: Codable, Hashable {
    let connected: Bool
    let lastPollAt: String?
    let lastFormSyncAt: String?
    let formsConnected: Int
    let leadsSyncedLast30d: Int
    let pendingForms: Int?
}

struct LinkedInCockpitOrg: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let vanityName: String?
    let logoUrl: String?
    let isDefault: Bool
    let connectedAt: String?
}

struct LinkedInCockpitOrgsResponse: Codable {
    let orgs: [LinkedInCockpitOrg]
}

// ============================================================
// MARK: - Case Studies
// ============================================================

struct CaseStudy: Codable, Hashable, Identifiable {
    let id: String
    let customerName: String?
    let title: String?
    let challenge: String?
    let solution: String?
    let outcome: String?
    let metrics: [String]?
    let publishedAt: String?
    let status: String              // 'draft' | 'published' | 'generating'
    let aiGenerated: Bool?
}

struct CaseStudiesResponse: Codable {
    let caseStudies: [CaseStudy]
}

// ============================================================
// MARK: - Role Nav Config (rolle-spesifikk nav-meny)
// ============================================================

struct RoleNavConfig: Codable, Hashable, Identifiable {
    let role: String
    let displayName: String?
    let tabs: [String]?
    let hiddenTabs: [String]?
    let defaultLanding: String?
    let updatedAt: String?

    var id: String { role }
}

struct RoleNavConfigsResponse: Codable {
    let configs: [RoleNavConfig]
}
