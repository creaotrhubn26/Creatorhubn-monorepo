// SuperAdminFase20Models.swift
//
// Fase 20: Platform-status + integrations-overview + API-endpoints-health.

import Foundation

// ============================================================
// MARK: - /api/admin-room/platform-status
// ============================================================

/// Health-status per provider (Render/Neon/Vercel/Stripe/Anthropic).
struct ProviderHealthStatus: Codable, Hashable, Identifiable {
    let provider: String
    let health: String          // 'ok' | 'warning' | 'error' | 'unconfigured'
    let message: String?
    let metrics: [String: String]?
    let dashboardUrl: String?
    let lastCheckedAt: String?

    var id: String { provider }
}

struct UserPresenceSummary: Codable, Hashable {
    let onlineCount: Int
    let totalActiveLast24h: Int
    let lastSampleAt: String?
}

struct PlatformStatusResponse: Codable {
    let overall: String         // 'ok' | 'warning' | 'error'
    let summary: PlatformStatusSummary
    let providers: [ProviderHealthStatus]
    let presence: UserPresenceSummary?
    let checkedAt: String?
}

struct PlatformStatusSummary: Codable, Hashable {
    let okCount: Int
    let warningCount: Int
    let errorCount: Int
    let unconfiguredCount: Int
}

// ============================================================
// MARK: - /api/admin/integrations/overview + status + keys + webhooks
// ============================================================

struct IntegrationsOverview: Codable, Hashable {
    let totalIntegrations: Int
    let active: Int
    let broken: Int
    let byCategory: [String: Int]?  // {"payment": 3, "ai": 2, ...}
}

struct IntegrationKey: Codable, Hashable, Identifiable {
    let id: String?
    let name: String
    let provider: String?
    let category: String?
    let isActive: Bool?
    let lastUsedAt: String?
    let createdAt: String?
    let maskedValue: String?

    // Use name as fallback ID if id missing
    var keyId: String { id ?? name }
}

struct IntegrationKeysResponse: Codable {
    let keys: [IntegrationKey]
    let total: Int
}

struct IntegrationWebhook: Codable, Hashable, Identifiable {
    let id: String
    let url: String
    let events: [String]?
    let isActive: Bool?
    let lastDeliveredAt: String?
    let lastStatus: String?
    let consecutiveFailures: Int?
}

struct IntegrationWebhooksResponse: Codable {
    let webhooks: [IntegrationWebhook]
    let total: Int
}

// ============================================================
// MARK: - /api/admin/api-endpoints/health
// ============================================================

struct ApiEndpointHealth: Codable, Hashable, Identifiable {
    let source: String          // 'lead-map-routes' | 'stripe-webhook' | ...
    let errorCount24h: Int
    let warningCount24h: Int
    let infoCount24h: Int
    let lastEventAt: String?
    let health: String?         // 'ok' | 'warning' | 'error'

    var id: String { source }
}

struct ApiEndpointsHealthResponse: Codable {
    let endpoints: [ApiEndpointHealth]
    let healthScore: Int        // 0-100
    let windowHours: Int
}
