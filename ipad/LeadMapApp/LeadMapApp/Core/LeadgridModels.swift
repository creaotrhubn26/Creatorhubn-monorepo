// LeadgridModels.swift
//
// Swift-modeller som matcher backend /api/leadgrid/* response-typene.
// JSONDecoder bruker .convertFromSnakeCase (samme som de andre modellene
// i appen), så felt-navn her er camelCase.
//
// Disse er paritets-modeller for "web Leadgrid"-stacken (PR #730+) som
// kjører parallelt med eldre /api/admin-room/lead-map/* (LeadMapApp's
// originale CRM).

import Foundation

// ============================================================
// MARK: - Status-history (PR #751)
// ============================================================

struct LeadgridStatusHistoryItem: Identifiable, Codable, Hashable {
    let id: String
    let fromStatus: String?
    let toStatus: String
    let note: String?
    let metadata: LeadgridStatusMetadata?
    let changedAt: String
    let changedByUserId: String?
    let firstName: String?
    let lastName: String?
    let profileImageUrl: String?

    var changedByName: String {
        [firstName, lastName].compactMap { $0 }.joined(separator: " ")
    }
}

struct LeadgridStatusMetadata: Codable, Hashable {
    let wonAmountOere: Int?
    let wonRecurringOere: Int?
    let lostReason: String?
    let lostReasonDetail: String?
}

struct StatusHistoryResponse: Codable {
    let history: [LeadgridStatusHistoryItem]
}

// ============================================================
// MARK: - Assignable users (PR #746)
// ============================================================

struct AssignableUser: Identifiable, Codable, Hashable {
    let userId: String
    let role: String
    let fullName: String
    let firstName: String?
    let lastName: String?
    let email: String?
    let profileImageUrl: String?
    let activeLeads: Int
    let teamLeaderLeads: Int
    let lastSeenAt: String?
    let isOnline: Bool

    var id: String { userId }

    var isTeamLeader: Bool { role == "teamleder" }
    var isRep: Bool { role == "salgskonsulent" || role == "promotor" }
}

struct AssignableUsersResponse: Codable {
    let users: [AssignableUser]
}

// ============================================================
// MARK: - Assignment-status (PR #746)
// ============================================================

struct AssignmentStatusResponse: Codable {
    let id: String
    let assignedTeamLeaderId: String?
    let assignedUserId: String?
    let teamLeaderFirstOpenedAt: String?
    let teamLeaderLastSeenAt: String?
    let repFirstOpenedAt: String?
    let repLastSeenAt: String?
    let assignedAt: String?
    let lastActionAt: String?
    let lastActionType: String?
    // Teamleder-info
    let tlFirst: String?
    let tlLast: String?
    let tlAvatar: String?
    let tlLastOnline: String?
    let tlCurrentRoute: String?
    // Rep-info
    let repFirst: String?
    let repLast: String?
    let repAvatar: String?
    let repLastOnline: String?
    let repCurrentRoute: String?

    var teamLeaderName: String {
        [tlFirst, tlLast].compactMap { $0 }.joined(separator: " ")
    }
    var repName: String {
        [repFirst, repLast].compactMap { $0 }.joined(separator: " ")
    }
}

// ============================================================
// MARK: - Mine tildelinger (PR #746)
// ============================================================

struct MyAssignmentItem: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let email: String?
    let phone: String?
    let status: String
    let aiOpportunityScore: Int?
    let leadCategory: String?
    let assignedAt: String?
    let assignmentNote: String?
    let teamLeaderFirstOpenedAt: String?
    let teamLeaderLastSeenAt: String?
    let repFirstOpenedAt: String?
    let repLastSeenAt: String?
    let lastActionAt: String?
    let lastActionType: String?
    let projectName: String?
}

struct MyAssignmentsResponse: Codable {
    let items: [MyAssignmentItem]
}

// ============================================================
// MARK: - Leadgrid customer detail (PR #752)
// ============================================================

struct LeadgridCustomerDetail: Codable, Identifiable {
    let id: String
    let name: String
    let email: String?
    let phone: String?
    let websiteUrl: String?
    let logoUrl: String?
    let status: String
    let leadCategory: String?
    let aiOpportunityScore: Int?
    let assignmentNote: String?
    let assignedTeamLeaderId: String?
    let assignedUserId: String?
}

// ============================================================
// MARK: - Won/Lost-stats (PR #752)
// ============================================================

struct WonLostStatsResponse: Codable {
    let periodDays: Int
    let wonCount: String
    let lostCount: String
    let inPipeline: String?
    let totalWonOere: String
    let totalRecurringOere: String
    let winRate: Double
    let topLostReasons: [TopLostReason]
    let monthOverMonth: [MonthOverMonthBucket]
    let topReps: [TopRepStat]
    let funnel: ConversionFunnel?

    var wonCountInt: Int { Int(wonCount) ?? 0 }
    var lostCountInt: Int { Int(lostCount) ?? 0 }
    var totalWonKr: Double { (Double(totalWonOere) ?? 0) / 100 }
    var totalRecurringKr: Double { (Double(totalRecurringOere) ?? 0) / 100 }
    var winRatePct: Int { Int(winRate * 100) }
}

struct TopLostReason: Codable, Hashable, Identifiable {
    let lostReason: String
    let n: String
    var id: String { lostReason }
    var nInt: Int { Int(n) ?? 0 }
}

struct MonthOverMonthBucket: Codable, Hashable, Identifiable {
    let month: String
    let won: String
    let lost: String
    let wonAmountOere: String
    let wonRecurringOere: String
    var id: String { month }
    var wonInt: Int { Int(won) ?? 0 }
    var lostInt: Int { Int(lost) ?? 0 }
    var wonAmountKr: Double { (Double(wonAmountOere) ?? 0) / 100 }
}

struct TopRepStat: Codable, Hashable, Identifiable {
    let assignedUserId: String?
    let firstName: String?
    let lastName: String?
    let profileImageUrl: String?
    let wonCount: String
    let wonAmountOere: String

    var id: String { assignedUserId ?? "\(firstName ?? "")\(lastName ?? "")" }
    var fullName: String {
        [firstName, lastName].compactMap { $0 }.joined(separator: " ")
    }
    var wonCountInt: Int { Int(wonCount) ?? 0 }
    var wonAmountKr: Double { (Double(wonAmountOere) ?? 0) / 100 }
}

struct ConversionFunnel: Codable {
    // Alle Optional fordi backend returnerer `{}` hvis ingen data i
    // perioden — Swift Codable ville ellers throw'e og dashboard
    // ville krasje uten leads i org-en (typisk for nye orgs).
    let newLeads: String?
    let contacted: String?
    let meetingBooked: String?
    let proposalSent: String?
    let negotiating: String?
    let won: String?
    let lost: String?

    var stages: [(label: String, count: Int)] {
        [
            ("Nye leads", Int(newLeads ?? "0") ?? 0),
            ("Kontaktet", Int(contacted ?? "0") ?? 0),
            ("Møte booket", Int(meetingBooked ?? "0") ?? 0),
            ("Forslag sendt", Int(proposalSent ?? "0") ?? 0),
            ("I forhandling", Int(negotiating ?? "0") ?? 0),
            ("Vunnet", Int(won ?? "0") ?? 0),
        ]
    }
}

// ============================================================
// MARK: - Notification-prefs (PR #748)
// ============================================================

struct LeadgridNotificationPrefs: Codable {
    var notifyEmail: Bool
    var notifyWhatsapp: Bool
    var notifySms: Bool
    var notifyInApp: Bool
    var notifyOnAssignedTeamLeader: Bool
    var notifyOnAssignedAsRep: Bool
    var notifyOnLeadStatusChange: Bool
    var notifyOnLeadWon: Bool
    var notifyOnLeadLost: Bool
    var notifyOnAssignmentSeenStatus: Bool?
    var quietHoursStart: String?
    var quietHoursEnd: String?

    static let defaults = LeadgridNotificationPrefs(
        notifyEmail: true, notifyWhatsapp: false, notifySms: false, notifyInApp: true,
        notifyOnAssignedTeamLeader: true, notifyOnAssignedAsRep: true,
        notifyOnLeadStatusChange: true, notifyOnLeadWon: true, notifyOnLeadLost: false,
        notifyOnAssignmentSeenStatus: false,
        quietHoursStart: nil, quietHoursEnd: nil,
    )
}

// ============================================================
// MARK: - In-app notifications (PR #748)
// ============================================================

struct LeadgridNotification: Identifiable, Codable, Hashable {
    let id: String
    let eventType: String
    let title: String
    let body: String?
    let leadId: String?
    let deepLink: String?
    let meta: LeadgridNotificationMeta?
    let readAt: String?
    let createdAt: String
    let triggeredByUserId: String?
    let byFirst: String?
    let byLast: String?

    var isUnread: Bool { readAt == nil }
    var byName: String {
        [byFirst, byLast].compactMap { $0 }.joined(separator: " ")
    }
    var tier: String? { meta?.tier }
}

struct LeadgridNotificationMeta: Codable, Hashable {
    let tier: String?
    let note: String?
}

struct LeadgridNotificationsResponse: Codable {
    let items: [LeadgridNotification]
    let unreadCount: Int
}

// ============================================================
// MARK: - Schedulerte rapporter (PR #756-759)
// ============================================================

struct ScheduledReport: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let reportType: String
    let periodDays: Int
    let statusFilter: String?
    let recipientUserIds: [String]?
    let recipientEmails: [String]?
    let frequency: String
    let dayOfWeek: Int?
    let dayOfMonth: Int?
    let timeOfDay: String
    let timezone: String?
    let isActive: Bool
    let lastSentAt: String?
    let lastSendStatus: String?
    let lastSendError: String?
    let nextSendAt: String
    let scope: String?
    let targetTeamLeaderId: String?
    let targetUserId: String?
    let autoSendToTarget: Bool?
}

struct ScheduledReportsResponse: Codable {
    let items: [ScheduledReport]
}

struct AutoCreateReportsResponse: Codable {
    let ok: Bool
    let created: Int
    let skipped: Int
    let errors: [String]?
}

// ============================================================
// MARK: - Klient-onboarding wizard (PR #737)
// ============================================================

struct ChannelOnboardingState: Codable {
    let deliveryModel: String?  // "shared" | "own_waba" | nil
    let currentStep: String
    let stepsCompleted: [String]
    let activated: Bool
    let lastTestPhone: String?
    let lastTestError: String?
}

struct ChannelOnboardingStateResponse: Codable {
    let state: ChannelOnboardingState
    let orgKey: String
    let emailBrandingExists: Bool
    let emailBrandingHasSender: Bool
    let wabaConfigExists: Bool
    let wabaValidated: Bool
    let wabaValidationError: String?
}

struct AdvanceOnboardingResponse: Codable {
    let ok: Bool
    let nextStep: String
}

struct OnboardingTestResponse: Codable {
    let ok: Bool
    let attempted: Int
    let sent: Int
    let channels: [String]
}

// ============================================================
// MARK: - Min profil (lead-map-me-profile-routes)
// ============================================================

struct MyProfile: Codable, Identifiable {
    let userId: String
    let firstName: String?
    let lastName: String?
    let email: String?
    let phone: String?
    let profession: String?
    let profileImageUrl: String?
    let profileComplete: Bool
    let profileCompletedCount: Int
    let profileTotalRequired: Int

    var id: String { userId }
    var fullName: String {
        [firstName, lastName].compactMap { $0 }.joined(separator: " ")
    }
}

struct MyProfileResponse: Codable {
    let profile: MyProfile
}

// ============================================================
// MARK: - Robust date-parsing
// ============================================================
//
// KRITISK: PostgreSQL ::text-cast returnerer datoer i formatet
// "2026-06-19 18:42:09.317304+00" (mellomrom-separator + microsec)
// — IKKE ISO8601 ("2026-06-19T18:42:09.317Z").
//
// ISO8601DateFormatter parser ikke PG-formatet. Vi trenger en parser
// som håndterer BEGGE — fordi noen endpoints caster .text mens andre
// returnerer Date-objekter som blir ISO via JSON.stringify.
//
// Brukes overalt i Leadgrid-views der vi formaterer relative tider.

enum LeadgridDate {
    /// Parse fra Leadgrid backend. Returnerer nil hvis strenger ikke
    /// matcher noen kjente format.
    static func parse(_ s: String?) -> Date? {
        guard let s, !s.isEmpty else { return nil }

        // 1. ISO8601 m/ fraksjons-sekunder (typisk fra res.json av Date-obj)
        let isoFrac = ISO8601DateFormatter()
        isoFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = isoFrac.date(from: s) { return d }

        // 2. ISO8601 uten fraksjons-sekunder
        if let d = ISO8601DateFormatter().date(from: s) { return d }

        // 3. PostgreSQL-format: "YYYY-MM-DD HH:MM:SS[.MICROS]+TZ"
        //    Backend ::text returnerer typisk +00 (kun timezone-timer).
        //    `x` matcher +00, `xx` matcher +0000, `xxx` matcher +00:00.
        let pgFormats = [
            "yyyy-MM-dd HH:mm:ss.SSSSSSx",   // 2026-06-19 18:42:09.317304+00
            "yyyy-MM-dd HH:mm:ss.SSSSSSxx",  // 2026-06-19 18:42:09.317304+0000
            "yyyy-MM-dd HH:mm:ss.SSSSSSxxx", // 2026-06-19 18:42:09.317304+00:00
            "yyyy-MM-dd HH:mm:ss.SSSx",      // millisek + kort TZ
            "yyyy-MM-dd HH:mm:ss.SSSxxx",    // millisek + lang TZ
            "yyyy-MM-dd HH:mm:ssx",          // ingen brøkdel + kort TZ
            "yyyy-MM-dd HH:mm:ssxxx",        // ingen brøkdel + lang TZ
            "yyyy-MM-dd HH:mm:ss",           // fallback uten TZ
        ]
        for fmt in pgFormats {
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.timeZone = TimeZone(identifier: "UTC")
            f.dateFormat = fmt
            if let d = f.date(from: s) { return d }
        }
        return nil
    }

    /// Relativ tid: "5 min siden", "2 t siden", "3d siden", "nå"
    static func relativeAgo(_ s: String?) -> String {
        guard let d = parse(s) else { return s ?? "—" }
        let mins = Int(Date().timeIntervalSince(d) / 60)
        if mins < 1 { return "nå" }
        if mins < 60 { return "\(mins) min siden" }
        let hours = mins / 60
        if hours < 24 { return "\(hours) t siden" }
        return "\(hours / 24)d siden"
    }

    /// Online hvis siste-sett er nyere enn 90 sek.
    static func isOnline(_ s: String?) -> Bool {
        guard let d = parse(s) else { return false }
        return Date().timeIntervalSince(d) < 90
    }

    /// Norsk-lokal formatert tid (eks: "19. juni 14:32")
    static func formatNo(_ s: String?) -> String {
        guard let d = parse(s) else { return s ?? "—" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM HH:mm"
        return f.string(from: d)
    }
}

// ============================================================
// MARK: - Helpers — formatering
// ============================================================

extension LeadgridStatusHistoryItem {
    /// Norsk-lokal lest-tid (eks: "19. juni 14:32"). Bruker robust
    /// PG-format-tolerant parser.
    var formattedChangedAt: String {
        LeadgridDate.formatNo(changedAt)
    }
}

extension LeadgridNotification {
    var timeAgo: String {
        LeadgridDate.relativeAgo(createdAt)
    }
}

// ============================================================
// MARK: - Fase 16: Plan-quota (PlanUsageBar)
// ============================================================

struct LeadgridPlanLimits: Codable, Hashable {
    let displayName: String?
    let maxCustomers: Int?
    let maxAutoOnboardsPerMonth: Int?
    let maxTeamLeaders: Int?
    let maxReps: Int?
}

struct LeadgridPlanUsage: Codable, Hashable {
    let customersActive: Int
    let autoOnboardsThisMonth: Int
}

struct LeadgridPlanPct: Codable, Hashable {
    let customers: Int      // 0-100
    let autoOnboards: Int   // 0-100
}

struct LeadgridPlanSummary: Codable, Hashable {
    let planKey: String
    let displayName: String
    let inGrace: Bool
    let graceExpiresAt: String?
    let limits: LeadgridPlanLimits
    let usage: LeadgridPlanUsage
    let pct: LeadgridPlanPct

    /// Worst-case prosent (det som bør vises i kompakt bar).
    var worstPct: Int {
        max(pct.customers, pct.autoOnboards)
    }

    /// Hovedmetrikk-label for kompakt visning.
    var primaryLabel: String {
        if let max = limits.maxCustomers {
            return "\(usage.customersActive) / \(max) leads"
        }
        return "\(usage.customersActive) leads"
    }
}

// ============================================================
// MARK: - Fase 16: Assignment-historikk per lead
// ============================================================

struct AssignmentHistoryItem: Codable, Hashable, Identifiable {
    let id: String
    let fromUserId: String?
    let toUserId: String?
    let assignedByUserId: String?
    let reason: String?
    let assignedAt: String?

    var formattedAssignedAt: String {
        LeadgridDate.formatNo(assignedAt)
    }
}

struct AssignmentHistoryResponse: Codable {
    let history: [AssignmentHistoryItem]
}

// ============================================================
// MARK: - Fase 16: Export-summary (KPI før eksport)
// ============================================================

struct LeadsExportSummary: Codable, Hashable {
    let totalLeads: Int
    let period: String
    let estimatedSizeKb: Int?
}

// ============================================================
// MARK: - Fase 16: Onboarding-state (org-overordnet wizard)
// ============================================================

struct LeadgridOnboardingState: Codable, Hashable {
    let completed: Bool
    let currentStep: String?
    let stepsCompleted: [String]?
    let stepsRemaining: [String]?
    let skippedAt: String?
}

// ============================================================
// MARK: - Fase 16: Billing (faktura + Stripe portal)
// ============================================================

struct LeadgridBillingInvoice: Codable, Hashable, Identifiable {
    let id: String
    let stripeInvoiceId: String?
    let number: String?
    let status: String                // 'paid' | 'open' | 'void' | 'uncollectible'
    let amountOere: Int
    let currency: String
    let periodStart: String?
    let periodEnd: String?
    let createdAt: String?
    let invoicePdfUrl: String?
    let hostedInvoiceUrl: String?

    var amountKr: Double { Double(amountOere) / 100 }
    var formattedAmount: String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = currency.uppercased()
        f.locale = Locale(identifier: "nb_NO")
        return f.string(from: NSNumber(value: amountKr)) ?? "\(amountKr) \(currency)"
    }
}

struct LeadgridBillingInvoicesResponse: Codable {
    let invoices: [LeadgridBillingInvoice]
}

struct BillingPortalSessionResponse: Codable {
    let url: String
}

// ============================================================
// MARK: - Fase 16: Partners (Partner-program-landing)
// ============================================================

struct LeadgridPartner: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let logoUrl: String?
    let website: String?
    let tagline: String?
    let partnerType: String?
}

struct LeadgridPartnersResponse: Codable {
    let partners: [LeadgridPartner]
}

// ============================================================
// MARK: - Fase 17: Klient-portal-varsler
// ============================================================

struct ClientPortalNotificationPrefs: Codable, Hashable {
    let email: Bool
    let sms: Bool
    let whatsapp: Bool
    let push: Bool?
    let weeklyDigest: Bool?
    let language: String?    // 'nb' | 'en'
}
