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
/// Backend gir `{ defaults: { role: [permission_key, ...] } }`. Vi bygger
/// PermissionsRole-listen i custom init.
struct PermissionsMatrixResponse: Codable {
    let roles: [PermissionsRole]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: DynamicCodingKey.self)
        let map = (try? c.decode([String: [String]].self,
                                  forKey: DynamicCodingKey(stringValue: "defaults")!))
            ?? [:]
        self.roles = map.keys.sorted().map { key in
            PermissionsRole(key: key, label: nil,
                            defaultPermissions: map[key], memberCount: nil)
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        let map = Dictionary(uniqueKeysWithValues:
            roles.map { ($0.key, $0.defaultPermissions ?? []) })
        try c.encode(map, forKey: DynamicCodingKey(stringValue: "defaults")!)
    }
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

/// Mappes mot backend-respons fra
/// `GET /api/admin-room/lead-map/organizations/:id/members`
/// (lead-map-org-routes.ts). Backend gir:
/// `{members: [{id, userId, role, joinedAt, lastActiveAt, userName, userEmail}]}`.
/// Vi aksepterer både backend-feltnavn (userName/userEmail/lastActiveAt) og
/// iPad-historiske felt (name/email/lastSeenAt) via CodingKeys+computed.
struct OrgMember: Codable, Hashable, Identifiable {
    let userId: String
    let userName: String?
    let userEmail: String?
    let role: String?
    let lastActiveAt: String?

    var id: String { userId }
    var name: String? { userName }
    var email: String? { userEmail }
    var teamId: String? { nil }
    var teamName: String? { nil }
    var avatar: String? { nil }
    var lastSeenAt: String? { lastActiveAt }
}

struct OrgMembersResponse: Codable {
    let members: [OrgMember]
}

// ============================================================
// MARK: - Customer Success
// ============================================================

/// Mappes mot backend-respons fra
/// `GET /api/admin-room/customer-success/dashboard` (customer-success-routes.ts).
/// Backend gir: `{ totalCustomers, tierCounts: {green,yellow,red},
/// avgScore, upcomingRenewals30d, openFollowups, recentChurnSignals,
/// customers: [...] }`. iPad-UI derives sine egne metrics fra dette.
struct CSDashboardSummary: Codable, Hashable {
    let totalCustomers: Int
    let tierCounts: CSTierCounts?
    let avgScore: Double?
    let upcomingRenewals30d: Int?
    let openFollowups: Int?
    let recentChurnSignals: Int?

    // Computed properties som matcher de gamle UI-felt-navnene.
    var activeCustomers: Int {
        // "Active" = green + yellow tier (ikke i red).
        (tierCounts?.green ?? 0) + (tierCounts?.yellow ?? 0)
    }
    var atRiskCount: Int { tierCounts?.red ?? 0 }
    var churnedLast30d: Int { recentChurnSignals ?? 0 }
    var avgHealthScore: Double? { avgScore }
    var upcomingRenewalsCount: Int { upcomingRenewals30d ?? 0 }
    var newCustomersLast30d: Int { openFollowups ?? 0 }

    // MRR-felt: backend gir ikke dette per i dag — vis 0 til vi har
    // Stripe-aggregat. Holder UI-kontraktet.
    var mrrTotalOere: Int? { nil }
    var mrrAtRiskOere: Int? { nil }
    var mrrTotalKr: Double { 0 }
    var mrrAtRiskKr: Double { 0 }
}

struct CSTierCounts: Codable, Hashable {
    let green: Int
    let yellow: Int
    let red: Int
}

/// Mappes mot backend-respons fra
/// `GET /api/admin-room/customer-success/renewals` (customer-success-routes.ts).
/// Backend gir: `{id, userId, email, displayName, businessName,
/// renewalAt, daysUntilRenewal, currentPlanName, currentArpuNok,
/// renewalStatus, expansionOpportunityNok, lastOutreachAt, notes,
/// healthTier, healthScore}`. Vi mapper inn felter med ulike navn
/// via CodingKeys + computed properties.
struct CSRenewal: Codable, Hashable, Identifiable {
    let id: String
    let userId: String?
    let email: String?              // backend gir "email", ikke "customerEmail"
    let displayName: String?        // backend gir "displayName"
    let businessName: String?       // backend gir "businessName"
    let renewalAt: String?
    let renewalStatus: String?      // backend gir "renewalStatus", ikke "status"
    let currentArpuNok: Double?     // backend gir kroner (Double), ikke øre
    let lastOutreachAt: String?     // backend gir "lastOutreachAt"
    let healthScore: Int?
    let notes: String?

    // Aliaser for å beholde tidligere UI-callsites.
    var customerName: String? { businessName ?? displayName }
    var customerEmail: String? { email }
    var status: String { renewalStatus ?? "pending" }
    var mrrOere: Int? {
        guard let kr = currentArpuNok else { return nil }
        return Int(kr * 100)
    }
    var lastInteractionAt: String? { lastOutreachAt }
    var assignedToUserId: String? { nil }

    var formattedRenewalAt: String { LeadgridDate.formatNo(renewalAt) }
    var mrrKr: Double { currentArpuNok ?? 0 }
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

/// Mappes mot backend-respons fra
/// `GET /api/admin-room/cockpit/b2b/funnel` (cockpit-b2b-routes.ts).
/// Backend gir: `{funnel: {status: count}, by_segment, last_30d:
/// {new_30d, contacted_30d, qualified, won_30d}, score_distribution,
/// recent}`. Vi rebuilder iPad-shape (steps + totals) i decode-init.
struct B2BFunnelResponse: Codable {
    let steps: [B2BFunnelStep]
    let totalLeads: Int
    let totalConverted: Int
    let arpuMonthlyNok: Double?

    private struct Last30d: Codable {
        let new_30d: Int?
        let contacted_30d: Int?
        let qualified: Int?
        let won_30d: Int?
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: DynamicCodingKey.self)

        // funnel: {status: count}
        let funnelMap = (try? c.decode([String: Int].self,
                                        forKey: DynamicCodingKey(stringValue: "funnel")!))
            ?? [:]

        // Standard funnel-rekkefølge for visning (selv om backend mangler en status,
        // viser vi 0 så Daniel ser hele pipeline).
        let stepOrder = ["new", "contacted", "demo_booked", "trial", "customer",
                         "disqualified", "archived"]
        let presentSteps = stepOrder.filter { funnelMap[$0] != nil }
        let extraSteps = funnelMap.keys.filter { !stepOrder.contains($0) }.sorted()
        let allSteps = presentSteps + extraSteps

        // "Konvertert" per step = neste step + alle videre. Drop-off = count − converted.
        var built: [B2BFunnelStep] = []
        for (i, key) in allSteps.enumerated() {
            let count = funnelMap[key] ?? 0
            // Konvertert: hvis vi er i 'customer' har alle 'konvertert' (count = converted).
            // Ellers regn alle senere stadier (kun for ekte progress-stadier).
            let convertedCount: Int = {
                if key == "customer" { return count }
                if key == "disqualified" || key == "archived" { return 0 }
                // Sum count fra i+1 og senere blant progress-keys (drop disqualified/archived).
                return allSteps.dropFirst(i + 1)
                    .filter { $0 != "disqualified" && $0 != "archived" }
                    .reduce(0) { $0 + (funnelMap[$1] ?? 0) }
            }()
            let dropOff = max(0, count - convertedCount)
            built.append(B2BFunnelStep(
                step: key, count: count,
                convertedCount: convertedCount, dropOffCount: dropOff,
            ))
        }
        self.steps = built

        let totalLeads = funnelMap.values.reduce(0, +)
        let totalConverted = funnelMap["customer"] ?? 0
        self.totalLeads = totalLeads
        self.totalConverted = totalConverted

        // Backend gir ikke ARPU per i dag — la den være nil.
        self.arpuMonthlyNok = nil
    }

    func encode(to encoder: Encoder) throws {
        // Encode-en brukes ikke fra UI (Response-typer leses kun). Lar default
        // fungere på de Codable-feltene som finnes.
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(steps, forKey: DynamicCodingKey(stringValue: "steps")!)
        try c.encode(totalLeads, forKey: DynamicCodingKey(stringValue: "totalLeads")!)
        try c.encode(totalConverted, forKey: DynamicCodingKey(stringValue: "totalConverted")!)
    }
}

/// Hjelper for å dekode ad-hoc JSON-nøkler.
struct DynamicCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
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

/// Mappes mot backend-respons fra
/// `GET /api/admin-room/cockpit/case-studies` (cockpit-b2b-routes.ts).
/// Backend gir `{case_studies: [{id, agency_name, slug, headline,
/// status, published_at, generated_at, hero_image_url}]}`. iPad bruker
/// historisk customerName/title — vi aliaser via computed felter.
struct CaseStudy: Codable, Hashable, Identifiable {
    let id: String
    let agencyName: String?
    let slug: String?
    let headline: String?
    let status: String?              // 'draft' | 'published' | 'generating'
    let publishedAt: String?
    let generatedAt: String?
    let heroImageUrl: String?

    // Aliaser for å beholde tidligere UI-felter.
    var customerName: String? { agencyName }
    var title: String? { headline }
    var challenge: String? { nil }
    var solution: String? { nil }
    var outcome: String? { nil }
    var metrics: [String]? { nil }
    var aiGenerated: Bool? { generatedAt != nil }
}

struct CaseStudiesResponse: Codable {
    let caseStudies: [CaseStudy]
}

// ============================================================
// MARK: - Role Nav Config (rolle-spesifikk nav-meny)
// ============================================================

/// Mappes mot backend-respons fra
/// `GET /api/admin-room/role-nav-config` (admin-room-role-nav-routes.ts).
/// Backend gir `{configs: [{role, tabValues, updatedAt, updatedBy}]}`.
/// iPad-UI bruker historisk "tabs" — vi aksepterer begge feltnavn.
struct RoleNavConfig: Codable, Hashable, Identifiable {
    let role: String
    let tabValues: [String]?
    let updatedAt: String?
    let updatedBy: String?

    var id: String { role }
    var displayName: String? { nil }
    var tabs: [String]? { tabValues }
    var hiddenTabs: [String]? { nil }
    var defaultLanding: String? { nil }
}

struct RoleNavConfigsResponse: Codable {
    let configs: [RoleNavConfig]
}
