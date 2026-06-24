// SuperAdminFase21Models.swift
//
// Fase 21: Modeller for 9 nye iPad-views koblet til både nye og
// eksisterende backend-endepunkter.
//
// Nye backend-endepunkter (4):
//   /api/admin-room/leads-growth
//   /api/admin-room/social-connections/status
//   /api/admin-room/lead-map/leads/:id/competitor-report
//   /api/admin-room/resend/status
//
// Eksisterende endepunkter som tidligere ikke hadde iPad-view (5):
//   /api/role-room/agent/post-drafts/*
//   /api/role-room/marketing-cockpit/content-calendar
//   /api/admin-room/whats-new
//   /api/admin/b2-archive/*
//   /api/admin-room/migrations/status

import Foundation

// ============================================================
// MARK: - Leads growth (vekst-graf)
// ============================================================

struct LeadsGrowthBucket: Codable, Hashable, Identifiable {
    let month: String           // "2026-01"
    let new: Int
    let converted: Int
    let churned: Int

    var id: String { month }
}

struct LeadsGrowthResponse: Codable {
    let period: String          // "3m" | "6m" | "12m"
    let scope: String           // "b2b" | "org:<uuid>"
    let buckets: [LeadsGrowthBucket]
    let totalNew: Int
    let totalConverted: Int
    let totalChurned: Int
}

// ============================================================
// MARK: - Social connections status
// ============================================================

struct SocialConnection: Codable, Hashable, Identifiable {
    let orgId: String?
    let orgName: String?
    let provider: String        // 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'google'
    let connected: Bool
    let accountName: String?
    let accountId: String?
    let connectedAt: String?
    let expiresAt: String?
    let lastUsedAt: String?

    var id: String { "\(orgId ?? "_"):\(provider):\(accountId ?? "_")" }
}

struct SocialConnectionsStatusResponse: Codable {
    let connections: [SocialConnection]
    let byProvider: [String: ProviderConnCount]?
    let totalConnected: Int
    let totalConnections: Int
    let note: String?
}

struct ProviderConnCount: Codable, Hashable {
    let connected: Int
    let total: Int
}

// ============================================================
// MARK: - Competitor report (Claude SWOT)
// ============================================================

struct CompetitorSWOT: Codable, Hashable {
    let strengths: [String]
    let weaknesses: [String]
    let opportunities: [String]
    let threats: [String]
}

struct CompetitorReportResponse: Codable {
    let competitorId: String
    let reportMd: String
    let swot: CompetitorSWOT
    let recommendations: [String]
    let generatedAt: String?
    let modelUsed: String?
    let cached: Bool?
}

// ============================================================
// MARK: - Resend status
// ============================================================

struct ResendDomain: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let status: String          // 'verified' | 'pending' | 'failed'
    let createdAt: String?
}

struct ResendRecentEmail: Codable, Hashable, Identifiable {
    let id: String
    let to: String
    let subject: String
    let status: String
    let sentAt: String
}

struct ResendStatusResponse: Codable {
    let healthy: Bool
    let apiConfigured: Bool
    let domainCount: Int
    let verifiedDomainCount: Int
    let domains: [ResendDomain]?
    let lastErrorMessage: String?
    let lastSendCheckedAt: String?
    let recentEmails: [ResendRecentEmail]?
}

// ============================================================
// MARK: - Post drafts (Role Room Agent)
// ============================================================

/// Mappes mot backend `GET /api/role-room/agent/post-drafts`
/// (role-room-post-drafts-routes.ts → mapDraftRow). Backend gir
/// `{id: Int, brandKey, platform, status, caption, hashtags,
/// suggestedPublishTime, generatedAt, publishedAt, imageUrl, ...}`.
/// iPad-UI bruker historisk content/mediaUrls/scheduledAt/createdAt
/// — vi aliaser via custom init og computed properties.
struct MarketingPostDraft: Codable, Hashable, Identifiable {
    let id: String
    let userId: String
    let organizationId: String?
    let platform: String
    let content: String?
    let mediaUrls: [String]?
    let scheduledAt: String?
    let status: String          // 'draft' | 'scheduled' | 'published'
    let brandKey: String?
    let createdAt: String?
    let updatedAt: String?
    let publishedAt: String?

    private enum Keys: String, CodingKey {
        case id, userId, organizationId, platform, content, mediaUrls
        case scheduledAt, status, brandKey, createdAt, updatedAt, publishedAt
        // Backend-spesifikke aliaser:
        case caption, imageUrl, suggestedPublishTime, generatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)

        // id kan være Int eller String avhengig av kilde.
        if let intId = try? c.decode(Int.self, forKey: .id) {
            self.id = String(intId)
        } else {
            self.id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        }

        self.userId = (try? c.decode(String.self, forKey: .userId)) ?? ""
        self.organizationId = try? c.decode(String.self, forKey: .organizationId)
        self.platform = (try? c.decode(String.self, forKey: .platform)) ?? ""

        // content: legacy felt; nytt format = caption
        self.content = (try? c.decode(String.self, forKey: .content))
            ?? (try? c.decode(String.self, forKey: .caption))

        // mediaUrls: legacy array; nytt format gir én imageUrl
        if let arr = try? c.decode([String].self, forKey: .mediaUrls) {
            self.mediaUrls = arr
        } else if let img = try? c.decode(String.self, forKey: .imageUrl) {
            self.mediaUrls = [img]
        } else {
            self.mediaUrls = nil
        }

        // scheduledAt: legacy; nytt format = suggestedPublishTime
        self.scheduledAt = (try? c.decode(String.self, forKey: .scheduledAt))
            ?? (try? c.decode(String.self, forKey: .suggestedPublishTime))

        self.status = (try? c.decode(String.self, forKey: .status)) ?? "draft"
        self.brandKey = try? c.decode(String.self, forKey: .brandKey)

        // createdAt: legacy; nytt format = generatedAt
        self.createdAt = (try? c.decode(String.self, forKey: .createdAt))
            ?? (try? c.decode(String.self, forKey: .generatedAt))

        self.updatedAt = try? c.decode(String.self, forKey: .updatedAt)
        self.publishedAt = try? c.decode(String.self, forKey: .publishedAt)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        try c.encode(id, forKey: .id)
        try c.encode(userId, forKey: .userId)
        try c.encodeIfPresent(organizationId, forKey: .organizationId)
        try c.encode(platform, forKey: .platform)
        try c.encodeIfPresent(content, forKey: .content)
        try c.encodeIfPresent(mediaUrls, forKey: .mediaUrls)
        try c.encodeIfPresent(scheduledAt, forKey: .scheduledAt)
        try c.encode(status, forKey: .status)
        try c.encodeIfPresent(brandKey, forKey: .brandKey)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try c.encodeIfPresent(publishedAt, forKey: .publishedAt)
    }
}

struct MarketingPostDraftsResponse: Codable {
    let drafts: [MarketingPostDraft]
    let total: Int

    private struct Envelope: Codable {
        let drafts: [MarketingPostDraft]?
        let total: Int?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        self.drafts = env.drafts ?? []
        self.total = env.total ?? self.drafts.count
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(drafts, forKey: DynamicCodingKey(stringValue: "drafts")!)
        try c.encode(total, forKey: DynamicCodingKey(stringValue: "total")!)
    }
}

// ============================================================
// MARK: - Content-calendar items
// ============================================================

/// Mappes mot backend `GET /api/role-room/marketing-cockpit/content-calendar`
/// (role-room-post-drafts-routes.ts). Backend returnerer scheduled drafts
/// + publiserte poster + en separat unscheduled-bucket — vi flater
/// scheduled+unscheduled til én `items`-liste for iPad-UI.
struct ContentCalendarItem: Codable, Hashable, Identifiable {
    let id: String
    let title: String?
    let description: String?
    let contentType: String?
    let platforms: [String]?
    let status: String?
    let scheduledFor: String?
    let publishedAt: String?
    let campaignId: String?
    let assetUrls: [String]?
    let copyText: String?
    let hashtags: [String]?
    let authorUserId: String?
    let notes: String?
    let createdAt: String?
    let updatedAt: String?

    // Custom decoder mapper enten den nye {id, platform, status, caption,
    // hashtags, ...}-shape fra backend, eller den eldre {title, contentType,
    // platforms, ...}-shape (test-data).
    private enum Keys: String, CodingKey {
        case id, platform, status, caption, hashtags, ctaText, ctaLink
        case suggestedPublishTime, publishedAt, generatedAt, imageUrl
        // Legacy felter:
        case title, description, contentType, platforms, scheduledFor
        case campaignId, assetUrls, copyText, authorUserId, notes
        case createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)

        // id kan være enten Int (fra marketing_post_drafts) eller String.
        if let intId = try? c.decode(Int.self, forKey: .id) {
            self.id = String(intId)
        } else {
            self.id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        }

        // Title: bruk legacy title, eller fall til caption (de første ~80 tegn).
        if let t = try? c.decode(String.self, forKey: .title) {
            self.title = t
        } else if let cap = try? c.decode(String.self, forKey: .caption) {
            self.title = String(cap.prefix(80))
        } else {
            self.title = nil
        }

        self.description = (try? c.decode(String.self, forKey: .description))
            ?? (try? c.decode(String.self, forKey: .caption))

        self.contentType = try? c.decode(String.self, forKey: .contentType)

        // Platforms: nytt format gir én "platform"-streng → wrap som array.
        if let arr = try? c.decode([String].self, forKey: .platforms) {
            self.platforms = arr
        } else if let single = try? c.decode(String.self, forKey: .platform) {
            self.platforms = [single]
        } else {
            self.platforms = nil
        }

        self.status = try? c.decode(String.self, forKey: .status)

        // scheduledFor: nytt format = suggestedPublishTime; legacy = scheduledFor
        self.scheduledFor = (try? c.decode(String.self, forKey: .scheduledFor))
            ?? (try? c.decode(String.self, forKey: .suggestedPublishTime))

        self.publishedAt = try? c.decode(String.self, forKey: .publishedAt)
        self.campaignId = try? c.decode(String.self, forKey: .campaignId)

        // assetUrls: legacy array; nytt format gir én imageUrl.
        if let arr = try? c.decode([String].self, forKey: .assetUrls) {
            self.assetUrls = arr
        } else if let img = try? c.decode(String.self, forKey: .imageUrl) {
            self.assetUrls = [img]
        } else {
            self.assetUrls = nil
        }

        self.copyText = (try? c.decode(String.self, forKey: .copyText))
            ?? (try? c.decode(String.self, forKey: .caption))

        self.hashtags = try? c.decode([String].self, forKey: .hashtags)
        self.authorUserId = try? c.decode(String.self, forKey: .authorUserId)
        self.notes = try? c.decode(String.self, forKey: .notes)

        // createdAt: legacy felt; nytt format = generatedAt
        self.createdAt = (try? c.decode(String.self, forKey: .createdAt))
            ?? (try? c.decode(String.self, forKey: .generatedAt))

        self.updatedAt = try? c.decode(String.self, forKey: .updatedAt)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encodeIfPresent(contentType, forKey: .contentType)
        try c.encodeIfPresent(platforms, forKey: .platforms)
        try c.encodeIfPresent(status, forKey: .status)
        try c.encodeIfPresent(scheduledFor, forKey: .scheduledFor)
        try c.encodeIfPresent(publishedAt, forKey: .publishedAt)
        try c.encodeIfPresent(campaignId, forKey: .campaignId)
        try c.encodeIfPresent(assetUrls, forKey: .assetUrls)
        try c.encodeIfPresent(copyText, forKey: .copyText)
        try c.encodeIfPresent(hashtags, forKey: .hashtags)
        try c.encodeIfPresent(authorUserId, forKey: .authorUserId)
        try c.encodeIfPresent(notes, forKey: .notes)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(updatedAt, forKey: .updatedAt)
    }
}

struct ContentCalendarResponse: Codable {
    let items: [ContentCalendarItem]
    let total: Int

    private struct Envelope: Codable {
        let items: [ContentCalendarItem]?
        let scheduled: [ContentCalendarItem]?
        let unscheduled: [ContentCalendarItem]?
        let total: Int?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        // Backend gir {scheduled: [...], unscheduled: [...]} — flat-join.
        // Legacy gir {items: [...]}.
        var combined: [ContentCalendarItem] = []
        if let s = env.scheduled { combined.append(contentsOf: s) }
        if let u = env.unscheduled { combined.append(contentsOf: u) }
        if combined.isEmpty, let i = env.items { combined = i }
        self.items = combined
        self.total = env.total ?? combined.count
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(items, forKey: DynamicCodingKey(stringValue: "items")!)
        try c.encode(total, forKey: DynamicCodingKey(stringValue: "total")!)
    }
}

// ============================================================
// MARK: - What's New (release notes)
// ============================================================

/// Mappes mot backend `GET /api/admin-room/whats-new` (whats-new-routes.ts).
/// Backend gir: `{id, mode, kind, date, title, description, published,
/// displayOrder, createdAt, updatedAt}`. iPad-UI bruker historisk
/// body/category/publishedAt/pinned — vi aliaser via computed.
struct WhatsNewEntry: Codable, Hashable, Identifiable {
    let id: String
    let mode: String?
    let kind: String?
    let date: String?
    let title: String
    let description: String?
    let published: Bool?
    let displayOrder: Int?
    let createdAt: String?
    let updatedAt: String?

    var body: String? { description }
    var category: String? { kind }
    var publishedAt: String? { date ?? createdAt }
    var pinned: Bool? { (displayOrder ?? 0) > 0 }
    var imageUrl: String? { nil }
    var linkUrl: String? { nil }
}

struct WhatsNewResponse: Codable {
    let items: [WhatsNewEntry]
}

// ============================================================
// MARK: - B2 Archive (storage usage)
// ============================================================

struct B2ArchiveUsage: Codable, Hashable {
    let bucketName: String?
    let totalBytes: Int?
    let fileCount: Int?
    let lastChangeAt: String?

    var totalGB: Double {
        Double(totalBytes ?? 0) / 1_000_000_000
    }
}

struct B2ArchiveFile: Codable, Hashable, Identifiable {
    let key: String
    let size: Int
    let lastModified: String?
    let contentType: String?

    var id: String { key }
    var sizeMB: Double { Double(size) / 1_000_000 }
}

struct B2ArchiveFilesResponse: Codable {
    let files: [B2ArchiveFile]
    let total: Int?
}

// ============================================================
// MARK: - Migrations status
// ============================================================

/// Mappes mot backend `GET /api/admin-room/migrations/status`
/// (admin-room-migrations-routes.ts). Backend gir hele in-memory state +
/// pendingFiles + pendingCount + lockHeld. iPad bruker historisk
/// lastRunAt/lastRunStatus/lastError — vi aliaser.
struct MigrationsStatus: Codable, Hashable {
    let lockHeld: Bool?
    let pendingFiles: [String]?
    let pendingCount: Int?
    let status: String?
    let startedAt: String?
    let finishedAt: String?
    let triggeredBy: String?
    let exitCode: Int?
    let errorMessage: String?
    let appliedThisRun: Int?
    let skippedThisRun: Int?

    var lastRunAt: String? { finishedAt ?? startedAt }
    var lastRunStatus: String? { status }
    var lastError: String? { errorMessage }
}
