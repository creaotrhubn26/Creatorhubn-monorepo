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

/// Mappes mot client_ads_actions-rader fra backend
/// `GET /api/admin-room/agent/ads/configs/:id`. Backend gir mange felter
/// — vi aksepterer den minimale undermengden iPad-UI bruker.
struct AdsAction: Codable, Hashable, Identifiable {
    let id: String
    let configId: String?
    let actionName: String?
    let displayName: String?
    let goalCategory: String?
    let triggerType: String?
    let createdAt: String?

    var actionType: String { actionName ?? "unknown" }
    var platform: String? { "google_ads" }
    var status: String? { nil }
    var result: String? { nil }
    var completedAt: String? { nil }
    var errorMessage: String? { nil }
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

/// Mappes mot backend `GET /api/role-room/ads-approvals/pending`
/// (client-ads-routes.ts). Backend gir `{pending: [{config: {...},
/// actions: [...]}]}`. Vi unpack-er config-objektet til en flat
/// AdsApproval.
struct AdsApprovalsResponse: Codable {
    let approvals: [AdsApproval]

    private struct ConfigRow: Codable {
        let id: String?
        let clientName: String?
        let approvalMessage: String?
        let sentForApprovalAt: String?
        let reviewDeadline: String?
    }
    private struct Item: Codable {
        let config: ConfigRow?
    }
    private struct Envelope: Codable {
        let pending: [Item]?
        let approvals: [AdsApproval]?
    }

    init(from decoder: Decoder) throws {
        let env = try Envelope(from: decoder)
        if let direct = env.approvals {
            self.approvals = direct
        } else {
            self.approvals = (env.pending ?? []).compactMap { item -> AdsApproval? in
                guard let cfg = item.config, let id = cfg.id else { return nil }
                return AdsApproval(
                    configId: id,
                    clientName: cfg.clientName,
                    producerName: nil,
                    recommendationsSummary: cfg.approvalMessage,
                    totalSpendNok: nil,
                    requestedAt: cfg.sentForApprovalAt,
                    deadline: cfg.reviewDeadline,
                )
            }
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicCodingKey.self)
        try c.encode(approvals, forKey: DynamicCodingKey(stringValue: "approvals")!)
    }
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
