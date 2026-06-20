// SuperAdminFase22Models.swift
//
// Fase 22: Modeller for de 5 siste manglende super-admin-views.
// Alle endepunkter eksisterer allerede på main.

import Foundation

// ============================================================
// MARK: - Errors / Observability
// ============================================================

struct AdminErrorEntry: Codable, Hashable, Identifiable {
    let id: String
    let source: String?         // 'lead-map' | 'stripe' | osv
    let level: String?          // 'error' | 'warning' | 'critical'
    let title: String?
    let message: String?
    let stackTrace: String?
    let endpoint: String?
    let userId: String?
    let userEmail: String?
    let createdAt: String?
    let resolvedAt: String?
    let resolvedByUserId: String?
    let occurrenceCount: Int?
    let metadata: [String: String]?
}

struct AdminErrorsResponse: Codable {
    let errors: [AdminErrorEntry]
    let total: Int?
}

struct AdminErrorsStats: Codable, Hashable {
    let total: Int
    let unresolved: Int
    let critical: Int
    let last24h: Int
    let bySource: [String: Int]?
    let byLevel: [String: Int]?
}

struct AdminErrorsStatsResponse: Codable {
    let stats: AdminErrorsStats
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

struct SuperAdminOrgEntry: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let memberCount: Int?
    let createdAt: String?
    let planKey: String?
    let lastActiveAt: String?
}

struct SuperAdminOrgsResponse: Codable {
    let organizations: [SuperAdminOrgEntry]
}

struct ImpersonationStatus: Codable, Hashable {
    let active: Bool
    let targetOrgId: String?
    let targetOrgName: String?
    let startedAt: String?
}
