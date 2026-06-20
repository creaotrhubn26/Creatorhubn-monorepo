// SuperAdminFase24Models.swift
//
// Fase 24: 4 nye områder — Newsletter + RR-økonomi + Outreach-templates +
// Partner-application submit-flyt.

import Foundation

// ============================================================
// MARK: - Newsletter (RR-Newsletter CMS)
// ============================================================

struct NewsletterIssue: Codable, Hashable, Identifiable {
    let id: String
    let slug: String?
    let title: String?
    let subject: String?
    let preheader: String?
    let status: String          // 'draft' | 'scheduled' | 'sent' | 'unpublished'
    let scheduledFor: String?
    let sentAt: String?
    let sentCount: Int?
    let failedCount: Int?
    let createdAt: String?
    let updatedAt: String?
    let bodyLength: Int?
}

struct NewsletterIssuesResponse: Codable {
    let issues: [NewsletterIssue]
}

struct NewsletterStats: Codable, Hashable {
    let totalIssues: Int?
    let totalSubscribers: Int?
    let totalSent: Int?
    let avgOpenRate: Double?
    let avgClickRate: Double?
    let last30dGrowth: Int?
}

struct NewsletterStatsResponse: Codable {
    let stats: NewsletterStats
}

struct NewsletterSignup: Codable, Hashable, Identifiable {
    let id: String
    let email: String
    let createdAt: String?
    let confirmed: Bool?
    let unsubscribedAt: String?
    let source: String?
}

struct NewsletterSignupsResponse: Codable {
    let signups: [NewsletterSignup]
    let total: Int?
}

// ============================================================
// MARK: - RR-Økonomi aggregat (Stripe-data per RR-kunde)
// ============================================================

struct RoleRoomEconomyAggregate: Codable, Hashable {
    let mrrNokOere: Int
    let arrNokOere: Int
    let activeSubscribers: Int
    let trialingCount: Int
    let canceledLast30d: Int
    let newLast30d: Int
    let churnRatePct: Double?
    let avgArpuOere: Int?

    var mrrNok: Double { Double(mrrNokOere) / 100 }
    var arrNok: Double { Double(arrNokOere) / 100 }
    var avgArpuNok: Double { Double(avgArpuOere ?? 0) / 100 }
}

struct RoleRoomEconomySubscriber: Codable, Hashable, Identifiable {
    let userId: String
    let email: String?
    let name: String?
    let planKey: String?
    let status: String?         // 'active' | 'trialing' | 'past_due' | 'canceled'
    let mrrOere: Int?
    let createdAt: String?
    let cancelAt: String?
    let nextBillAt: String?

    var id: String { userId }
    var mrrNok: Double { Double(mrrOere ?? 0) / 100 }
}

struct RoleRoomEconomySubscribersResponse: Codable {
    let subscribers: [RoleRoomEconomySubscriber]
    let total: Int?
}

struct RoleRoomEconomyTimeseriesPoint: Codable, Hashable, Identifiable {
    let month: String           // "2026-01"
    let mrrOere: Int
    let activeSubscribers: Int
    let newCount: Int
    let canceledCount: Int

    var id: String { month }
    var mrrNok: Double { Double(mrrOere) / 100 }
}

struct RoleRoomEconomyTimeseriesResponse: Codable {
    let points: [RoleRoomEconomyTimeseriesPoint]
}

// ============================================================
// MARK: - Outreach-templates (B2B-outreach-CRM)
// ============================================================

struct OutreachTemplate: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let segment: String?        // 'agency' | 'corporate' | 'creator' | 'b2b_agency' | ...
    let language: String?       // 'nb' | 'en'
    let subjectTemplate: String?
    let bodyTemplate: String?
    let placeholders: [String]?
    let lastUsedAt: String?
    let useCount: Int?
    /// Multi-produkt (PR #827): hvilket produkt template-en tilhører.
    /// Backend filtrerer på `?product=role_room|leadgrid`, men feltet
    /// dekodes også for chips/UI-bekreftelse.
    let productKey: String?
}

struct OutreachTemplatesResponse: Codable {
    let templates: [OutreachTemplate]
}
