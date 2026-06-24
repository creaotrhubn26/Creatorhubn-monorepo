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

/// Mappes mot backend `GET /api/admin-room/newsletter/role-room/issues`.
/// Backend gir `{items: [...]}`. Vi støtter både items og issues for
/// fremover-kompatibilitet.
struct NewsletterIssuesResponse: Codable {
    let issues: [NewsletterIssue]

    private struct Envelope: Codable {
        let items: [NewsletterIssue]?
        let issues: [NewsletterIssue]?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        self.issues = env.items ?? env.issues ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(issues, forKey: DynamicCodingKey(stringValue: "items")!)
    }
}

struct NewsletterStats: Codable, Hashable {
    let totalIssues: Int?
    let totalSubscribers: Int?
    let totalSent: Int?
    let avgOpenRate: Double?
    let avgClickRate: Double?
    let last30dGrowth: Int?
}

/// Mappes mot backend `GET /api/admin-room/newsletter/role-room/stats`.
/// Backend gir `{totals: {total, confirmed, pending, unsubscribed,
/// new_last_7d, new_last_30d}, bySource: [...]}`. Vi mapper inn totals.
struct NewsletterStatsResponse: Codable {
    let stats: NewsletterStats

    private struct Totals: Codable {
        let total: Int?
        let confirmed: Int?
        let new_last_30d: Int?
    }
    private struct Envelope: Codable {
        let totals: Totals?
        let stats: NewsletterStats?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        if let s = env.stats {
            self.stats = s
        } else {
            self.stats = NewsletterStats(
                totalIssues: nil,
                totalSubscribers: env.totals?.confirmed ?? env.totals?.total ?? 0,
                totalSent: nil,
                avgOpenRate: nil,
                avgClickRate: nil,
                last30dGrowth: env.totals?.new_last_30d,
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode([
            "total": stats.totalSubscribers ?? 0,
            "confirmed": stats.totalSubscribers ?? 0,
        ], forKey: DynamicCodingKey(stringValue: "totals")!)
    }
}

/// Mappes mot backend `GET /api/admin-room/newsletter/role-room/signups`.
/// Backend gir `{items: [...]}`. iPad bruker historisk `signups`.
struct NewsletterSignup: Codable, Hashable, Identifiable {
    let id: String
    let email: String
    let createdAt: String?
    let status: String?
    let confirmedAt: String?
    let unsubscribedAt: String?
    let source: String?
    let locale: String?

    var confirmed: Bool? { status == "confirmed" || confirmedAt != nil }
}

struct NewsletterSignupsResponse: Codable {
    let signups: [NewsletterSignup]
    let total: Int?

    private struct Envelope: Codable {
        let items: [NewsletterSignup]?
        let signups: [NewsletterSignup]?
        let total: Int?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        self.signups = env.items ?? env.signups ?? []
        self.total = env.total ?? self.signups.count
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(signups, forKey: DynamicCodingKey(stringValue: "items")!)
    }
}

// ============================================================
// MARK: - RR-Økonomi aggregat (Stripe-data per RR-kunde)
// ============================================================

/// Mappes mot backend `GET /api/admin-room/role-room/economy/aggregate`
/// (admin-room-role-room-economy-routes.ts). Backend gir Stripe-tall i NOK
/// (Double), ikke øre — vi konverterer i computed-properties.
struct RoleRoomEconomyAggregate: Codable, Hashable {
    let mrrNok: Double?
    let arrNok: Double?
    let mrrUsd: Double?
    let arrUsd: Double?
    let activeCount: Int?
    let trialingCount: Int?
    let pastDueCount: Int?
    let canceledLast30d: Int?
    let newLast30d: Int?
    let churnRatePct: Double?

    var mrrNokOere: Int { Int((mrrNok ?? 0) * 100) }
    var arrNokOere: Int { Int((arrNok ?? 0) * 100) }
    var activeSubscribers: Int { activeCount ?? 0 }
    var avgArpuOere: Int? {
        guard let active = activeCount, active > 0, let m = mrrNok else { return nil }
        return Int((m / Double(active)) * 100)
    }
    var avgArpuNok: Double {
        guard let active = activeCount, active > 0, let m = mrrNok else { return 0 }
        return m / Double(active)
    }
}

/// Mappes mot backend `GET /api/admin-room/role-room/economy/subscribers`.
/// Backend gir `{items: [{customerEmail, status, monthlyContributionUsd,
/// customerCreated, canceledAt, currentPeriodEnd, userId, firstName,
/// lastName, ...}], meta: {totalCount, activeCount, nokPerUsd}}`. iPad-UI
/// brukte tidligere `subscribers` — vi mapper via init.
struct RoleRoomEconomySubscriber: Hashable, Identifiable {
    let id: String
    let userId: String?
    let email: String?
    let name: String?
    let status: String?
    let mrrUsd: Double
    let mrrNok: Double
    let createdAt: String?
    let cancelAt: String?
    let nextBillAt: String?
    let profession: String?

    var planKey: String? { profession }
    var mrrOere: Int? { Int(mrrNok * 100) }
}

struct RoleRoomEconomySubscribersResponse: Codable {
    let subscribers: [RoleRoomEconomySubscriber]
    let total: Int?

    private struct RawItem: Codable {
        let userId: String?
        let customerEmail: String?
        let firstName: String?
        let lastName: String?
        let status: String?
        let monthlyContributionUsd: Double?
        let customerCreated: String?
        let canceledAt: String?
        let currentPeriodEnd: String?
        let profession: String?
        let subscriptionId: String?
    }

    private struct Meta: Codable {
        let totalCount: Int?
        let activeCount: Int?
        let nokPerUsd: Double?
    }

    private struct Envelope: Codable {
        let items: [RawItem]?
        let subscribers: [RawItem]?
        let meta: Meta?
        let total: Int?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        let nokPerUsd = env.meta?.nokPerUsd ?? 11.0
        let rawItems = env.items ?? env.subscribers ?? []
        self.subscribers = rawItems.enumerated().map { (idx, r) in
            let usd = r.monthlyContributionUsd ?? 0
            let name: String? = {
                if let f = r.firstName, let l = r.lastName { return "\(f) \(l)" }
                return r.firstName
            }()
            return RoleRoomEconomySubscriber(
                id: r.userId ?? r.subscriptionId ?? r.customerEmail ?? "row-\(idx)",
                userId: r.userId,
                email: r.customerEmail,
                name: name,
                status: r.status,
                mrrUsd: usd,
                mrrNok: usd * nokPerUsd,
                createdAt: r.customerCreated,
                cancelAt: r.canceledAt,
                nextBillAt: r.currentPeriodEnd,
                profession: r.profession,
            )
        }
        self.total = env.total ?? env.meta?.totalCount ?? self.subscribers.count
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(subscribers.map { sub -> [String: String?] in
            [
                "userId": sub.userId,
                "customerEmail": sub.email,
                "status": sub.status,
            ]
        }, forKey: DynamicCodingKey(stringValue: "items")!)
    }
}

struct RoleRoomEconomyTimeseriesPoint: Hashable, Identifiable {
    let month: String           // "2026-01"
    let mrrOere: Int
    let activeSubscribers: Int
    let newCount: Int
    let canceledCount: Int

    var id: String { month }
    var mrrNok: Double { Double(mrrOere) / 100 }
}

/// Mappes mot backend `GET /api/admin-room/role-room/economy/timeseries`.
/// Backend gir `{months: [{monthLabel, mrrUsd, activeCount, newCount,
/// churnCount, aiCostUsd}], meta: {nokPerUsd}}`.
struct RoleRoomEconomyTimeseriesResponse: Codable {
    let points: [RoleRoomEconomyTimeseriesPoint]

    private struct RawMonth: Codable {
        let monthLabel: String?
        let mrrUsd: Double?
        let activeCount: Int?
        let newCount: Int?
        let churnCount: Int?
    }

    private struct Meta: Codable {
        let nokPerUsd: Double?
    }

    private struct Envelope: Codable {
        let months: [RawMonth]?
        let meta: Meta?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        let nokPerUsd = env.meta?.nokPerUsd ?? 11.0
        self.points = (env.months ?? []).map { m in
            RoleRoomEconomyTimeseriesPoint(
                month: m.monthLabel ?? "",
                mrrOere: Int((m.mrrUsd ?? 0) * nokPerUsd * 100),
                activeSubscribers: m.activeCount ?? 0,
                newCount: m.newCount ?? 0,
                canceledCount: m.churnCount ?? 0,
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        let serialized: [[String: String]] = points.map { p in
            [
                "monthLabel": p.month,
                "activeCount": String(p.activeSubscribers),
                "newCount": String(p.newCount),
                "churnCount": String(p.canceledCount),
            ]
        }
        try c.encode(serialized, forKey: DynamicCodingKey(stringValue: "months")!)
    }
}

// ============================================================
// MARK: - Outreach-templates (B2B-outreach-CRM)
// ============================================================

/// Mappes mot backend `GET /api/admin-room/outreach-templates`
/// (admin-room-outreach-routes.ts). Backend gir rå rader fra
/// role_room_outreach_templates: `{id, user_id, slug, title, segment,
/// channel, language, description, body, variables, is_default,
/// created_at, updated_at}`. Vi aliaser via computed.
struct OutreachTemplate: Codable, Hashable, Identifiable {
    let id: String
    let slug: String?
    let title: String?
    let segment: String?
    let channel: String?
    let language: String?
    let description: String?
    let body: String?
    let variables: [String]?
    let isDefault: Bool?
    let createdAt: String?
    let updatedAt: String?

    var name: String { title ?? slug ?? "(uten navn)" }
    var subjectTemplate: String? { description }
    var bodyTemplate: String? { body }
    var placeholders: [String]? { variables }
    var lastUsedAt: String? { updatedAt }
    var useCount: Int? { nil }
}

struct OutreachTemplatesResponse: Codable {
    let templates: [OutreachTemplate]

    private struct Envelope: Codable {
        let items: [OutreachTemplate]?
        let templates: [OutreachTemplate]?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        self.templates = env.items ?? env.templates ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(templates, forKey: DynamicCodingKey(stringValue: "items")!)
    }
}
