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
}

struct MarketingPostDraftsResponse: Codable {
    let drafts: [MarketingPostDraft]
    let total: Int
}

// ============================================================
// MARK: - Content-calendar items
// ============================================================

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
}

struct ContentCalendarResponse: Codable {
    let items: [ContentCalendarItem]
    let total: Int
}

// ============================================================
// MARK: - What's New (release notes)
// ============================================================

struct WhatsNewEntry: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let body: String?
    let category: String?       // 'feature' | 'fix' | 'announcement'
    let publishedAt: String?
    let pinned: Bool?
    let imageUrl: String?
    let linkUrl: String?
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

struct MigrationsStatus: Codable, Hashable {
    let lockHeld: Bool
    let pendingFiles: [String]?
    let pendingCount: Int
    let lastRunAt: String?
    let lastRunStatus: String?
    let lastError: String?
}
