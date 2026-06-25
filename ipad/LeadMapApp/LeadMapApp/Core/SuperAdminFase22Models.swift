// SuperAdminFase22Models.swift
//
// Fase 22: Modeller for de 5 siste manglende super-admin-views.
// Alle endepunkter eksisterer allerede på main.

import Foundation

// ============================================================
// MARK: - Errors / Observability
// ============================================================

/// Mappes mot backend `GET /api/admin-room/errors` (error-log-routes.ts).
/// Backend gir per error: `{id, level, source, statusCode, endpoint, message,
/// errorName, stack, fingerprint, userId, userEmail, claritySessionId, ip,
/// userAgent, url, meta, occurrenceCount, firstSeenAt, lastSeenAt,
/// resolvedAt, resolvedByUserId, resolvedNote}`. iPad-UI bruker historisk
/// title/stackTrace/createdAt/metadata — vi aliaser.
struct AdminErrorEntry: Codable, Hashable, Identifiable {
    let id: String
    let source: String?
    let level: String?
    let errorName: String?
    let message: String?
    let stack: String?
    let endpoint: String?
    let userId: String?
    let userEmail: String?
    let firstSeenAt: String?
    let lastSeenAt: String?
    let resolvedAt: String?
    let resolvedByUserId: String?
    let occurrenceCount: Int?
    let statusCode: Int?

    var title: String? { errorName ?? message?.prefix(80).description }
    var stackTrace: String? { stack }
    var createdAt: String? { firstSeenAt }
    var metadata: [String: String]? { nil }
}

struct AdminErrorsResponse: Codable {
    let errors: [AdminErrorEntry]
    let total: Int?
}

/// Mappes mot backend `GET /api/admin-room/errors/stats`. Backend gir:
/// `{stats: {total24h, unresolvedTotal, bySource: [{source, count}],
/// byStatus, topEndpoints}}`. Vi normaliserer til iPad-shape via init.
struct AdminErrorsStats: Hashable {
    let total: Int
    let unresolved: Int
    let critical: Int
    let last24h: Int
    let bySource: [String: Int]?
    let byLevel: [String: Int]?
}

private struct StatsRawTuple: Codable {
    let source: String?
    let count: Int?
}

private struct StatsRawByStatus: Codable {
    let statusCode: Int?
    let count: Int?
}

struct AdminErrorsStatsResponse: Codable {
    let stats: AdminErrorsStats

    private struct Envelope: Codable {
        let stats: RawStats?
    }
    private struct RawStats: Codable {
        let total24h: Int?
        let unresolvedTotal: Int?
        let bySource: [StatsRawTuple]?
        let byStatus: [StatsRawByStatus]?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        let raw = env.stats
        var sourceMap: [String: Int] = [:]
        for t in raw?.bySource ?? [] {
            if let s = t.source { sourceMap[s] = t.count ?? 0 }
        }
        let critical = (raw?.byStatus ?? [])
            .filter { ($0.statusCode ?? 0) >= 500 }
            .reduce(0) { $0 + ($1.count ?? 0) }
        self.stats = AdminErrorsStats(
            total: raw?.unresolvedTotal ?? 0,
            unresolved: raw?.unresolvedTotal ?? 0,
            critical: critical,
            last24h: raw?.total24h ?? 0,
            bySource: sourceMap.isEmpty ? nil : sourceMap,
            byLevel: nil,
        )
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        let rawStats: [String: Int] = [
            "total24h": stats.last24h,
            "unresolvedTotal": stats.unresolved,
        ]
        try c.encode(rawStats, forKey: DynamicCodingKey(stringValue: "stats")!)
    }
}

// ============================================================
// MARK: - Market Intelligence (market-scans)
// ============================================================

struct MarketScan: Codable, Hashable, Identifiable {
    let id: String
    let name: String?
    let industry: String?
    let region: String?
    let status: String?         // 'pending' | 'running' | 'completed' | 'failed'
    let createdAt: String?
    let completedAt: String?
    let competitorCount: Int?
    let opportunityCount: Int?
    let totalAddressableMarketNok: Double?
    let metadata: [String: String]?
}

struct MarketScansResponse: Codable {
    let scans: [MarketScan]
}

struct MarketScanCompetitor: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let url: String?
    let estimatedRevenue: Double?
    let threatLevel: String?    // 'low' | 'medium' | 'high'
    let positioningSummary: String?
    let strengths: [String]?
    let weaknesses: [String]?
}

struct MarketScanCompetitorsResponse: Codable {
    let competitors: [MarketScanCompetitor]
}

struct MarketScanOpportunity: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let estimatedValueNok: Double?
    let priority: String?
    let status: String?         // 'open' | 'in_progress' | 'won' | 'lost'
}

struct MarketScanOpportunitiesResponse: Codable {
    let opportunities: [MarketScanOpportunity]
}

// ============================================================
// MARK: - Brand Kit (per prosjekt)
// ============================================================

struct BrandKit: Codable, Hashable {
    let projectId: String?
    let companyName: String?
    let logoUrl: String?
    let primaryColor: String?
    let secondaryColor: String?
    let fontFamily: String?
    let voiceTone: String?
    let tagline: String?
    let mission: String?
    let targetAudience: String?
    let usp: String?
    let socialHandles: [String: String]?
    let lastScannedAt: String?
}

struct BrandKitResponse: Codable {
    let brandKit: BrandKit?
}

// ============================================================
// MARK: - Lead Map Campaigns (ads-kampanjer per org)
// ============================================================

struct LeadMapCampaign: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let status: String?         // 'active' | 'paused' | 'ended'
    let platform: String?       // 'google_ads' | 'meta_ads' | 'linkedin_ads'
    let totalSpendNok: Double?
    let totalImpressions: Int?
    let totalClicks: Int?
    let totalLeads: Int?
    let cpa: Double?            // cost per acquisition
    let conversionRate: Double?
    let startedAt: String?
    let endedAt: String?
}

struct LeadMapCampaignsResponse: Codable {
    let campaigns: [LeadMapCampaign]
}

struct CategoryConversion: Codable, Hashable, Identifiable {
    let category: String
    let leads: Int
    let won: Int
    let conversionPct: Double

    var id: String { category }
}

struct CategoryConversionResponse: Codable {
    let categories: [CategoryConversion]
}

// ============================================================
// MARK: - Org-switcher (impersonation)
// ============================================================

/// Mappes mot backend `GET /api/superadmin/organizations`
/// (superadmin-routes.ts). Backend gir rader fra `organizations`-tabellen
/// med rå kolonnenavn (org_type, plan osv.) — convertFromSnakeCase
/// dekker mest, men `memberCount` kommer som `member_count` → vi
/// støtter begge.
struct SuperAdminOrgEntry: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let memberCount: Int?
    let createdAt: String?
    let plan: String?
    let orgType: String?
    let ownerEmail: String?
    let customerCount: Int?

    var planKey: String? { plan }
    var lastActiveAt: String? { nil }
}

struct SuperAdminOrgsResponse: Codable {
    let organizations: [SuperAdminOrgEntry]
}

/// Mappes mot backend `GET /api/superadmin/active-impersonation`. Backend gir
/// `{active: {active_org_id, started_at, expires_at, org_name, org_type} | null}`.
/// iPad-UI bruker `active: Bool` — vi syntetiserer fra om feltet finnes.
struct ImpersonationStatus: Hashable {
    let isActive: Bool
    let targetOrgId: String?
    let targetOrgName: String?
    let startedAt: String?
}

extension ImpersonationStatus: Codable {
    private struct Envelope: Codable {
        struct Row: Codable {
            let activeOrgId: String?
            let orgName: String?
            let startedAt: String?
        }
        let active: Row?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        if let row = env.active {
            self.isActive = row.activeOrgId != nil
            self.targetOrgId = row.activeOrgId
            self.targetOrgName = row.orgName
            self.startedAt = row.startedAt
        } else {
            self.isActive = false
            self.targetOrgId = nil
            self.targetOrgName = nil
            self.startedAt = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        if isActive {
            try c.encode([
                "activeOrgId": targetOrgId,
                "orgName": targetOrgName,
                "startedAt": startedAt,
            ], forKey: DynamicCodingKey(stringValue: "active")!)
        } else {
            try c.encodeNil(forKey: DynamicCodingKey(stringValue: "active")!)
        }
    }

    var active: Bool { isActive }
}
