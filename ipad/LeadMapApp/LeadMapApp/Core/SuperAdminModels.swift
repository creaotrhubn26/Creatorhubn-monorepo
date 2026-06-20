// SuperAdminModels.swift
//
// Fase 18: Super-admin paritet på iPad. Daniel skal kunne bruke
// alle superadmin-flows fra felt (B2B-pipeline, WA-templates,
// partners, email-branding, API-keys/webhooks, TestFlight, notif-log).

import Foundation

// ============================================================
// MARK: - /api/auth/user (user-level role-deteksjon)
// ============================================================

struct AuthUserResponse: Codable {
    let user: AuthUser?
    let authenticated: Bool
}

struct AuthUser: Codable, Hashable {
    let id: String
    let email: String?
    let name: String?
    let displayName: String?
    let role: String?           // 'super_admin' | 'admin' | 'user' | ...
    let roleLabel: String?
    let permissions: [String]?
    let isAdmin: Bool?
    let isPlatformAdmin: Bool?
    let accessScope: String?
    let accessScopeLabel: String?
    let businessName: String?
    let picture: String?
}

// ============================================================
// MARK: - Agency-leads (B2B-pipeline — markedssjefer som leads)
// ============================================================

struct AgencyLead: Codable, Hashable, Identifiable {
    let id: String
    let agencyName: String
    let contactName: String
    let email: String
    let phone: String?
    let status: String          // 'new' | 'contacted' | 'demo_booked' | 'trial' | 'customer' | 'disqualified' | 'archived'
    let segment: String?        // 'skuespillerbyrå' | 'modellbyrå' | 'bookingbyrå' | 'annet'
    let source: String?
    let rosterSize: String?
    let message: String?
    let internalNotes: String?
    let assignedToUserId: String?
    let orgNumber: String?
    let website: String?
    let contactTitle: String?
    let teamSize: String?
    let currentTools: String?
    let useCase: String?
    let preferredDemoTime: String?
    let demoLanguage: String?
    let consentResearchGiven: Bool?
    let utmSource: String?
    let utmCampaign: String?
    let createdAt: String?
    let contactedAt: String?
    let trialStartedAt: String?
    let customerAt: String?
    let updatedAt: String?

    var formattedCreatedAt: String { LeadgridDate.formatNo(createdAt) }
}

struct AgencyLeadsResponse: Codable {
    let leads: [AgencyLead]
    let total: Int?
}

struct AgencyLeadConvertResponse: Codable {
    let ok: Bool
    let onboardingUrl: String
    let persona: String
    let emailed: Bool
}

// ============================================================
// MARK: - WhatsApp templates (superadmin)
// ============================================================

struct WaTemplate: Codable, Hashable, Identifiable {
    let name: String                // template-navn = primary key
    let category: String?           // UTILITY | MARKETING | AUTHENTICATION
    let language: String?
    let status: String?             // APPROVED | PENDING | REJECTED
    let bodyText: String?
    let headerText: String?
    let footerText: String?
    let lastSyncedAt: String?
    let orgKey: String?
    let metaApprovalReason: String?

    var id: String { name }
}

struct WaTemplatesResponse: Codable {
    let templates: [WaTemplate]
}

struct WaTemplateAnalytics: Codable, Hashable {
    let name: String
    let sentLast30d: Int
    let deliveredLast30d: Int
    let failedLast30d: Int
    let avgCostNok: Double?
}

struct WaTemplateAnalyticsResponse: Codable {
    let analytics: [WaTemplateAnalytics]
}

// ============================================================
// MARK: - WhatsApp Org configs
// ============================================================

struct WaOrgConfig: Codable, Hashable, Identifiable {
    let orgKey: String
    let displayName: String?
    let phoneNumberId: String?
    let businessAccountId: String?
    let senderName: String?
    let active: Bool
    let monthlyBudgetNok: Double?
    let createdAt: String?
    let updatedAt: String?

    var id: String { orgKey }
}

struct WaOrgConfigsResponse: Codable {
    let configs: [WaOrgConfig]
}

// ============================================================
// MARK: - Partners + applications
// ============================================================

struct SuperAdminPartner: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let slug: String?
    let logoUrl: String?
    let website: String?
    let tagline: String?
    let partnerType: String?
    let tier: String?               // strategic | verified_integration | integration | certified | listed
    let isActive: Bool
    let createdAt: String?
}

struct SuperAdminPartnersResponse: Codable {
    let partners: [SuperAdminPartner]
}

struct PartnerApplication: Codable, Hashable, Identifiable {
    let id: String
    let companyName: String
    let contactName: String
    let contactEmail: String
    let website: String?
    let partnerType: String?
    let proposedTier: String?
    let status: String              // pending | approved | rejected | sandbox
    let pitchSummary: String?
    let riskScore: Int?
    let createdAt: String?
    let reviewedAt: String?
    let reviewerNotes: String?
}

struct PartnerApplicationsResponse: Codable {
    let applications: [PartnerApplication]
    let total: Int?
}

// ============================================================
// MARK: - Email branding (per org)
// ============================================================

struct EmailBrandingConfig: Codable, Hashable, Identifiable {
    let orgKey: String
    let displayName: String?
    let senderEmail: String?
    let senderName: String?
    let logoUrl: String?
    let primaryColor: String?
    let footerText: String?
    let replyToEmail: String?
    let updatedAt: String?

    var id: String { orgKey }
}

struct EmailBrandingResponse: Codable {
    let configs: [EmailBrandingConfig]
}

// ============================================================
// MARK: - API keys + webhooks
// ============================================================

struct LeadgridApiKey: Codable, Hashable, Identifiable {
    let id: String
    let orgId: String?
    let orgName: String?
    let label: String?
    let prefix: String              // visible prefix (full key not stored)
    let scopes: [String]?
    let lastUsedAt: String?
    let createdAt: String?
    let revokedAt: String?
}

struct LeadgridApiKeysResponse: Codable {
    let keys: [LeadgridApiKey]
}

struct WebhookEndpoint: Codable, Hashable, Identifiable {
    let id: String
    let orgId: String?
    let orgName: String?
    let url: String
    let events: [String]?
    let secret: String?             // masked
    let active: Bool
    let lastDeliveryAt: String?
    let lastDeliveryStatus: String?
    let createdAt: String?
}

struct WebhookEndpointsResponse: Codable {
    let endpoints: [WebhookEndpoint]
}

struct WebhookDelivery: Codable, Hashable, Identifiable {
    let id: String
    let endpointId: String
    let eventType: String
    let status: String              // pending | succeeded | failed | dead
    let httpStatus: Int?
    let attemptCount: Int
    let lastError: String?
    let createdAt: String?
    let deliveredAt: String?
}

struct WebhookDeliveriesResponse: Codable {
    let deliveries: [WebhookDelivery]
}

// ============================================================
// MARK: - TestFlight testers
// ============================================================

struct TestflightTester: Codable, Hashable, Identifiable {
    let id: String
    let email: String
    let firstName: String?
    let lastName: String?
    let appId: String?
    let beta: String?
    let inviteStatus: String?       // pending | invited | installed | dropped
    let ndaStatus: String?          // none | sent | signed
    let lastBuildVersion: String?
    let lastBuildInstalled: String?
    let createdAt: String?
}

struct TestflightTestersResponse: Codable {
    let testers: [TestflightTester]
}

struct AscHealthResponse: Codable {
    let healthy: Bool
    let lastSyncAt: String?
    let lastErrorMessage: String?
}

// ============================================================
// MARK: - Notification log + onboarding-funnel + payments
// ============================================================

struct NotificationLogEntry: Codable, Hashable, Identifiable {
    let id: String
    let channel: String             // email | sms | whatsapp | push | in_app
    let recipient: String
    let templateKey: String?
    let status: String              // sent | delivered | failed | bounced
    let errorMessage: String?
    let createdAt: String?
    let deliveredAt: String?
}

struct NotificationLogResponse: Codable {
    let log: [NotificationLogEntry]
    let total: Int?
}

struct OnboardingFunnelStep: Codable, Hashable, Identifiable {
    let step: String
    let entered: Int
    let completed: Int
    let droppedOff: Int
    let avgTimeMinutes: Double?

    var id: String { step }
}

struct OnboardingFunnelResponse: Codable {
    let steps: [OnboardingFunnelStep]
    let totalSignups: Int?
}

struct PaymentOverviewMetrics: Codable, Hashable {
    let mrrNokOere: Int
    let arrNokOere: Int
    let activeSubscriptions: Int
    let inGraceCount: Int
    let churnedLast30d: Int
    let newCustomersLast30d: Int

    var mrrNok: Double { Double(mrrNokOere) / 100 }
    var arrNok: Double { Double(arrNokOere) / 100 }
}

struct PaymentOverviewResponse: Codable {
    let metrics: PaymentOverviewMetrics
}

struct OverageStat: Codable, Hashable, Identifiable {
    let orgId: String
    let orgName: String?
    let planKey: String?
    let customersActive: Int
    let customersLimit: Int?
    let overageCharges: Int         // antall ganger overage trigget siste 30d
    let overageAmountOereLast30d: Int

    var id: String { orgId }
}

struct OverageStatsResponse: Codable {
    let overages: [OverageStat]
}
