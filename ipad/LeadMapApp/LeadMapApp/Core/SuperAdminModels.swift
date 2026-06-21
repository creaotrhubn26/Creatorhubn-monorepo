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

/// Mappes mot backend `GET /api/superadmin/wa-templates`
/// (wa-templates-admin-routes.ts). Backend gir rå rader fra
/// `wa_templates_managed`: `{id, meta_template_id, org_key, name,
/// language, category, header_format, header_text, body_text,
/// body_param_count, body_param_examples, footer_text, buttons,
/// status, rejected_reason, quality_score, last_status_sync_at,
/// created_at, updated_at, notes}`. iPad bruker historisk
/// lastSyncedAt/metaApprovalReason — vi aliaser.
struct WaTemplate: Codable, Hashable, Identifiable {
    let name: String
    let category: String?
    let language: String?
    let status: String?
    let bodyText: String?
    let headerText: String?
    let footerText: String?
    let lastStatusSyncAt: String?
    let orgKey: String?
    let rejectedReason: String?

    var id: String { name }
    var lastSyncedAt: String? { lastStatusSyncAt }
    var metaApprovalReason: String? { rejectedReason }
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

/// Mappes mot backend `GET /api/superadmin/wa-org-configs`
/// (wa-templates-admin-routes.ts). Backend gir `{org_key,
/// business_account_id, phone_number_id, display_name,
/// template_language, last_validated_at, last_validation_error,
/// provider, bsp_onboarded_at, created_at, updated_at}`. iPad-UI bruker
/// `active` — vi syntetiserer fra om phone_number_id finnes.
struct WaOrgConfig: Codable, Hashable, Identifiable {
    let orgKey: String
    let displayName: String?
    let phoneNumberId: String?
    let businessAccountId: String?
    let templateLanguage: String?
    let provider: String?
    let lastValidatedAt: String?
    let lastValidationError: String?
    let createdAt: String?
    let updatedAt: String?

    var id: String { orgKey }
    var senderName: String? { displayName }
    var active: Bool { (phoneNumberId ?? "").isEmpty == false && lastValidationError == nil }
    var monthlyBudgetNok: Double? { nil }
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

/// Mappes mot backend `GET /api/superadmin/partner-applications`
/// (partner-applications-routes.ts). Backend gir rå rader fra
/// `partner_applications` (organization_id, applicant_user_id, origin,
/// partner_type, proposed_logo_url, proposed_tagline, reason,
/// terms_version, status, ...) + JOIN-felt org_name + applicant_email.
/// iPad bruker historisk companyName/contactName/contactEmail/pitchSummary
/// — vi aliaser.
struct PartnerApplication: Codable, Hashable, Identifiable {
    let id: String
    let organizationId: String?
    let orgName: String?
    let orgType: String?
    let orgWebsite: String?
    let applicantEmail: String?
    let partnerType: String?
    let status: String?
    let reason: String?
    let proposedTagline: String?
    let createdAt: String?
    let reviewedAt: String?
    let reviewNotes: String?

    var companyName: String { orgName ?? "(ukjent)" }
    var contactName: String { applicantEmail?.components(separatedBy: "@").first ?? "—" }
    var contactEmail: String { applicantEmail ?? "—" }
    var website: String? { orgWebsite }
    var proposedTier: String? { partnerType }
    var pitchSummary: String? { reason ?? proposedTagline }
    var riskScore: Int? { nil }
    var reviewerNotes: String? { reviewNotes }
}

struct PartnerApplicationsResponse: Codable {
    let applications: [PartnerApplication]
    let total: Int?
}

// ============================================================
// MARK: - Email branding (per org)
// ============================================================

/// Mappes mot backend `GET /api/superadmin/email-branding`
/// (leadgrid-email-branding-routes.ts). Backend gir rå rader fra
/// `leadgrid_email_branding_config` med felt som `brand_name,
/// brand_logo_url, brand_primary_color, sender_full_name, sender_email,
/// reply_to_email, footer_html, ...`. iPad bruker historisk
/// displayName/senderName/logoUrl/primaryColor/footerText — vi aliaser.
struct EmailBrandingConfig: Codable, Hashable, Identifiable {
    let orgKey: String?
    let brandName: String?
    let brandLogoUrl: String?
    let brandPrimaryColor: String?
    let brandAccentColor: String?
    let fromName: String?
    let fromEmail: String?
    let replyToEmail: String?
    let senderFullName: String?
    let senderTitle: String?
    let senderEmail: String?
    let footerHtml: String?
    let footerAddress: String?
    let updatedAt: String?

    var id: String { orgKey ?? "__global__" }
    var displayName: String? { brandName ?? fromName }
    var senderName: String? { senderFullName ?? fromName }
    var logoUrl: String? { brandLogoUrl }
    var primaryColor: String? { brandPrimaryColor }
    var footerText: String? { footerHtml ?? footerAddress }
}

struct EmailBrandingResponse: Codable {
    let configs: [EmailBrandingConfig]
}

// ============================================================
// MARK: - API keys + webhooks
// ============================================================

/// Mappes mot backend `GET /api/superadmin/api-keys`
/// (partner-api-management-routes.ts). Backend gir
/// `{data: [{id, name, key_prefix, scopes, partner_id,
/// organization_id, is_active, expires_at, revoked_at, last_used_at,
/// created_at, partner_name, organization_name, calls_7d}]}`.
struct LeadgridApiKey: Codable, Hashable, Identifiable {
    let id: String
    let name: String?
    let keyPrefix: String?
    let scopes: [String]?
    let partnerId: String?
    let organizationId: String?
    let organizationName: String?
    let isActive: Bool?
    let lastUsedAt: String?
    let createdAt: String?
    let revokedAt: String?
    let expiresAt: String?

    var label: String? { name }
    var prefix: String { keyPrefix ?? "" }
    var orgId: String? { organizationId }
    var orgName: String? { organizationName }
}

struct LeadgridApiKeysResponse: Codable {
    let keys: [LeadgridApiKey]

    private struct Envelope: Codable {
        let data: [LeadgridApiKey]?
        let keys: [LeadgridApiKey]?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        self.keys = env.data ?? env.keys ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(keys, forKey: DynamicCodingKey(stringValue: "data")!)
    }
}

/// Mappes mot backend `GET /api/superadmin/webhook-endpoints`
/// (partner-api-management-routes.ts). Backend gir `{data: [{id, url,
/// description, events, is_active, partner_id, organization_id,
/// last_delivery_at, last_success_at, last_failure_at,
/// consecutive_failures, auto_disabled_at, created_at, partner_name,
/// organization_name}]}`.
struct WebhookEndpoint: Codable, Hashable, Identifiable {
    let id: String
    let url: String
    let description: String?
    let events: [String]?
    let isActive: Bool?
    let partnerId: String?
    let organizationId: String?
    let organizationName: String?
    let lastDeliveryAt: String?
    let lastSuccessAt: String?
    let lastFailureAt: String?
    let consecutiveFailures: Int?
    let autoDisabledAt: String?
    let createdAt: String?

    var orgId: String? { organizationId }
    var orgName: String? { organizationName }
    var secret: String? { nil }
    var active: Bool { isActive ?? false }
    var lastDeliveryStatus: String? {
        if let dis = autoDisabledAt, !dis.isEmpty { return "auto_disabled" }
        if (consecutiveFailures ?? 0) > 0 { return "failing" }
        if lastSuccessAt != nil { return "ok" }
        return nil
    }
}

struct WebhookEndpointsResponse: Codable {
    let endpoints: [WebhookEndpoint]

    private struct Envelope: Codable {
        let data: [WebhookEndpoint]?
        let endpoints: [WebhookEndpoint]?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        self.endpoints = env.data ?? env.endpoints ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(endpoints, forKey: DynamicCodingKey(stringValue: "data")!)
    }
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

/// Mappes mot backend `GET /api/superadmin/testflight-testers`
/// (testflight-testers-routes.ts). Backend gir rå rader fra
/// `testflight_testers` (email, full_name, apple_id, organization_id,
/// app_bundle_id, app_version, status, ...) + JOIN-felt fra organisasjoner
/// og NDA-avtaler. iPad bruker historisk firstName/lastName/beta/
/// inviteStatus — vi aliaser.
struct TestflightTester: Codable, Hashable, Identifiable {
    let id: String
    let email: String
    let fullName: String?
    let appleId: String?
    let appBundleId: String?
    let appVersion: String?
    let status: String?
    let notes: String?
    let invitedAt: String?
    let orgName: String?

    var firstName: String? { fullName?.components(separatedBy: " ").first }
    var lastName: String? {
        let parts = fullName?.components(separatedBy: " ") ?? []
        return parts.count > 1 ? parts.dropFirst().joined(separator: " ") : nil
    }
    var appId: String? { appBundleId }
    var beta: String? { appVersion }
    var inviteStatus: String? { status }
    var ndaStatus: String? { nil }
    var lastBuildVersion: String? { appVersion }
    var lastBuildInstalled: String? { nil }
    var createdAt: String? { invitedAt }
}

struct TestflightTestersResponse: Codable {
    let testers: [TestflightTester]
}

/// Mappes mot backend `GET /api/superadmin/testflight-testers/asc-health`.
/// Backend gir `{ok: Bool, error?: String}`. iPad bruker historisk
/// healthy/lastErrorMessage — vi aliaser.
struct AscHealthResponse: Codable {
    let ok: Bool
    let error: String?

    var healthy: Bool { ok }
    var lastSyncAt: String? { nil }
    var lastErrorMessage: String? { error }
}

// ============================================================
// MARK: - Notification log + onboarding-funnel + payments
// ============================================================

/// Mappes mot backend `GET /api/superadmin/notification-log`
/// (client-notification-prefs-routes.ts). Backend gir `{items:
/// [{id, customer_id, channel, event_type, recipient, subject,
/// sent_at, delivery_status, external_message_id, error_message}]}`.
/// iPad bruker historisk `log/templateKey/status/createdAt` — vi aliaser.
struct NotificationLogEntry: Codable, Hashable, Identifiable {
    let id: String
    let customerId: String?
    let channel: String
    let eventType: String?
    let recipient: String
    let subject: String?
    let sentAt: String?
    let deliveryStatus: String?
    let errorMessage: String?

    var templateKey: String? { eventType }
    var status: String { deliveryStatus ?? "sent" }
    var createdAt: String? { sentAt }
    var deliveredAt: String? { deliveryStatus == "delivered" ? sentAt : nil }
}

struct NotificationLogResponse: Codable {
    let log: [NotificationLogEntry]
    let total: Int?

    private struct Envelope: Codable {
        let items: [NotificationLogEntry]?
        let log: [NotificationLogEntry]?
        let total: Int?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        self.log = env.items ?? env.log ?? []
        self.total = env.total ?? self.log.count
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(log, forKey: DynamicCodingKey(stringValue: "items")!)
    }
}

struct OnboardingFunnelStep: Hashable, Identifiable {
    let step: String
    let entered: Int
    let completed: Int
    let droppedOff: Int
    let avgTimeMinutes: Double?

    var id: String { step }
}

/// Mappes mot backend-respons fra
/// `GET /api/superadmin/onboarding-funnel` (leadgrid-onboarding-routes.ts).
/// Backend gir `{funnel: [{step, count: <string>}]}` (count er ::text-cast).
/// iPad-UI vil ha per-step entered/completed/droppedOff — vi rebuilder.
struct OnboardingFunnelResponse: Codable {
    let steps: [OnboardingFunnelStep]
    let totalSignups: Int?

    private struct RawRow: Codable {
        let step: String?
        let count: String?            // ::text-cast i backend
    }

    private struct Envelope: Codable {
        let funnel: [RawRow]?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        let rows = env.funnel ?? []

        // Standard onboarding-rekkefølge (samme som STEPS i backend)
        let order = ["welcome", "add_first_customer", "see_portal",
                     "try_playbook", "view_apis", "completed", "skipped"]
        let counts: [String: Int] = Dictionary(uniqueKeysWithValues:
            rows.compactMap { row -> (String, Int)? in
                guard let s = row.step else { return nil }
                return (s, Int(row.count ?? "0") ?? 0)
            })

        // Bygg listen i kanonisk rekkefølge — fall tilbake til alfabetisk for ukjente steg.
        let known = order.filter { counts[$0] != nil }
        let extra = counts.keys.filter { !order.contains($0) }.sorted()
        let allKeys = known + extra

        // For onboarding-tour: "entered" = i dette steget + alle senere.
        // "completed" = alle senere steg. "droppedOff" = entered − completed
        // − (de som fortsatt står og venter på dette steget hvis ikke vist).
        // Forenkling: vi rapporterer "entered" = count i dette steget,
        // "completed" = sum av alle senere, "droppedOff" = 0 (mangler tracking).
        var built: [OnboardingFunnelStep] = []
        for (i, key) in allKeys.enumerated() {
            let entered = counts[key] ?? 0
            let completed = allKeys.dropFirst(i + 1)
                .filter { $0 != "skipped" }
                .reduce(0) { $0 + (counts[$1] ?? 0) }
            built.append(OnboardingFunnelStep(
                step: key,
                entered: entered,
                completed: completed,
                droppedOff: 0,
                avgTimeMinutes: nil,
            ))
        }
        self.steps = built
        self.totalSignups = counts.values.reduce(0, +)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        let rows: [[String: String]] = steps.map {
            ["step": $0.step, "count": String($0.entered)]
        }
        try c.encode(rows, forKey: DynamicCodingKey(stringValue: "funnel")!)
    }
}

struct PaymentOverviewMetrics: Hashable {
    let mrrNokOere: Int
    let arrNokOere: Int
    let activeSubscriptions: Int
    let inGraceCount: Int
    let churnedLast30d: Int
    let newCustomersLast30d: Int

    var mrrNok: Double { Double(mrrNokOere) / 100 }
    var arrNok: Double { Double(arrNokOere) / 100 }
}

/// Mappes mot backend-respons fra
/// `GET /api/superadmin/payments-overview` (leadgrid-billing-routes.ts).
/// Backend returnerer FLATE felter: `mrr_nok_total, arr_nok_estimate,
/// lifetime_nok, total_paid_invoices, churn_orgs_30d, by_plan,
/// recent_invoices`. iPad-UI bruker historisk `metrics`-envelope —
/// vi rekonstruerer den i init.
struct PaymentOverviewResponse: Codable {
    let metrics: PaymentOverviewMetrics

    private struct ByPlan: Codable {
        let plan: String?
        let active_orgs: String?
        let mrr_nok: String?
    }

    private struct Flat: Codable {
        let mrr_nok_total: Double?
        let arr_nok_estimate: Double?
        let lifetime_nok: Double?
        let total_paid_invoices: Int?
        let churn_orgs_30d: Int?
        let by_plan: [ByPlan]?
    }

    init(from decoder: Decoder) throws {
        let f = try Flat(from: decoder)
        let mrrKr = f.mrr_nok_total ?? 0
        let arrKr = f.arr_nok_estimate ?? (mrrKr * 12)
        let activeSubs = (f.by_plan ?? []).reduce(0) {
            $0 + (Int($1.active_orgs ?? "0") ?? 0)
        }
        self.metrics = PaymentOverviewMetrics(
            mrrNokOere: Int(mrrKr * 100),
            arrNokOere: Int(arrKr * 100),
            activeSubscriptions: activeSubs,
            inGraceCount: 0,
            churnedLast30d: f.churn_orgs_30d ?? 0,
            newCustomersLast30d: 0,
        )
    }

    func encode(to encoder: Encoder) throws {
        // Encode rene flat-felter for round-trip-tests.
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(metrics.mrrNok,
                     forKey: DynamicCodingKey(stringValue: "mrr_nok_total")!)
        try c.encode(metrics.arrNok,
                     forKey: DynamicCodingKey(stringValue: "arr_nok_estimate")!)
        try c.encode(metrics.churnedLast30d,
                     forKey: DynamicCodingKey(stringValue: "churn_orgs_30d")!)
    }
}

struct OverageStat: Hashable, Identifiable {
    let orgId: String
    let orgName: String?
    let planKey: String?
    let customersActive: Int
    let customersLimit: Int?
    let overageCharges: Int         // antall ganger overage trigget siste 30d
    let overageAmountOereLast30d: Int

    var id: String { orgId }
}

/// Mappes mot backend-respons fra
/// `GET /api/superadmin/overage-stats` (leadgrid-overage-billing.ts).
/// Backend gir: `{unbilled_rows, unbilled_oere, billed_30d_oere,
/// overage_calls_30d, top_consumers: [{key_name, org_name,
/// overage_30d, charge_30d_oere}]}`. iPad-UI bruker historisk
/// `overages: [OverageStat]` — vi mapper top_consumers inn.
struct OverageStatsResponse: Codable {
    let overages: [OverageStat]
    let unbilledRows: Int
    let unbilledOere: Int
    let billed30dOere: Int
    let overageCalls30d: Int

    private struct TopConsumer: Codable {
        let key_name: String?
        let org_name: String?
        let overage_30d: String?
        let charge_30d_oere: String?
    }

    private struct Flat: Codable {
        let unbilled_rows: String?
        let unbilled_oere: String?
        let billed_30d_oere: String?
        let overage_calls_30d: String?
        let top_consumers: [TopConsumer]?
    }

    init(from decoder: Decoder) throws {
        let f = try Flat(from: decoder)
        self.unbilledRows = Int(f.unbilled_rows ?? "0") ?? 0
        self.unbilledOere = Int(f.unbilled_oere ?? "0") ?? 0
        self.billed30dOere = Int(f.billed_30d_oere ?? "0") ?? 0
        self.overageCalls30d = Int(f.overage_calls_30d ?? "0") ?? 0
        self.overages = (f.top_consumers ?? []).enumerated().map { (idx, t) in
            OverageStat(
                orgId: "\(t.org_name ?? "ukjent")-\(idx)",
                orgName: t.org_name,
                planKey: t.key_name,
                customersActive: 0,
                customersLimit: nil,
                overageCharges: Int(t.overage_30d ?? "0") ?? 0,
                overageAmountOereLast30d: Int(t.charge_30d_oere ?? "0") ?? 0,
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(String(unbilledRows),
                     forKey: DynamicCodingKey(stringValue: "unbilled_rows")!)
        try c.encode(String(unbilledOere),
                     forKey: DynamicCodingKey(stringValue: "unbilled_oere")!)
        try c.encode(String(billed30dOere),
                     forKey: DynamicCodingKey(stringValue: "billed_30d_oere")!)
        try c.encode(String(overageCalls30d),
                     forKey: DynamicCodingKey(stringValue: "overage_calls_30d")!)
    }
}
