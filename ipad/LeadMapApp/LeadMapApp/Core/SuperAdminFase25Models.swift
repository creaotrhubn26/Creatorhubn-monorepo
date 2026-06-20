// SuperAdminFase25Models.swift
//
// Fase 25: Ad-tech-stack (62 backend-endepunkter).
// Daniel kan i felt: liste alle ads-configs, sjekke status per platform,
// trigge sync-actions, godkjenne ventende approvals.

import Foundation

// ============================================================
// MARK: - Ads Config (multi-platform ads-konfigurasjon per klient)
// ============================================================

struct AdsConfig: Codable, Hashable, Identifiable {
    let id: String
    let clientName: String?
    let clientWebsiteUrl: String?
    let clientProjectId: String?
    let status: String?              // 'draft' | 'active' | 'paused' | 'awaiting_client' | 'rejected'
    let approvalStatus: String?      // 'pending' | 'awaiting_client' | 'approved' | 'rejected'
    let approvalDeadline: String?

    // Per-platform-status (alle optional siden ulike kunder bruker ulike platforms)
    let metaPixelId: String?
    let metaPixelProvisionedAt: String?
    let metaCapiTokenSetAt: String?
    let metaLastSyncAt: String?

    let googleAdsCustomerId: String?
    let googleAdsTagId: String?
    let googleAdsLastSyncAt: String?

    let linkedinOrganizationId: String?
    let linkedinInsightTagId: String?
    let linkedinCapiTokenSetAt: String?
    let linkedinLastSyncAt: String?

    let tiktokAdvertiserId: String?
    let tiktokPixelId: String?
    let tiktokCapiTokenSetAt: String?
    let tiktokLastSyncAt: String?

    let ga4PropertyId: String?
    let ga4ProvisionedAt: String?
    let gtmContainerId: String?
    let gtmProvisionedAt: String?
    let gscVerifiedAt: String?

    let createdAt: String?
    let updatedAt: String?
}

struct AdsConfigsResponse: Codable {
    let configs: [AdsConfig]
}

struct AdsConfigDetailResponse: Codable {
    let config: AdsConfig
    let actions: [AdsAction]
}

struct AdsAction: Codable, Hashable, Identifiable {
    let id: String
    let configId: String
    let actionType: String
    let platform: String?
    let status: String?              // 'pending' | 'completed' | 'failed'
    let result: String?
    let createdAt: String?
    let completedAt: String?
    let errorMessage: String?
}

// ============================================================
// MARK: - Diagnostics & insights
// ============================================================

struct AdsSetupDiagnostic: Codable, Hashable, Identifiable {
    let id: String
    let category: String?            // 'pixel' | 'capi' | 'audience' | 'oauth'
    let platform: String?
    let status: String               // 'ok' | 'warning' | 'error' | 'unconfigured'
    let message: String
    let recommendedAction: String?
}

struct AdsSetupDiagnoseResponse: Codable {
    let diagnostics: [AdsSetupDiagnostic]
    let overallStatus: String?
}

struct AdsInsightMetric: Codable, Hashable {
    let metric: String               // 'impressions' | 'clicks' | 'spend' | 'leads'
    let value: Double
    let platform: String?
    let periodDays: Int?
}

struct AdsInsightsResponse: Codable {
    let metrics: [AdsInsightMetric]
    let totalSpendNok: Double?
    let totalLeads: Int?
    let cpa: Double?
}

// ============================================================
// MARK: - Approvals (klient godkjenner Agent-anbefalinger)
// ============================================================

struct AdsApproval: Codable, Hashable, Identifiable {
    let configId: String
    let clientName: String?
    let producerName: String?
    let recommendationsSummary: String?
    let totalSpendNok: Double?
    let requestedAt: String?
    let deadline: String?

    var id: String { configId }
}

struct AdsApprovalsResponse: Codable {
    let approvals: [AdsApproval]
}

// ============================================================
// MARK: - Account-lookups (for å koble OAuth-account til config)
// ============================================================

struct OAuthAccount: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let accountType: String?         // 'ad_account' | 'business_manager' | 'property'
    let isLinked: Bool?
}

struct OAuthAccountsResponse: Codable {
    let accounts: [OAuthAccount]
}
