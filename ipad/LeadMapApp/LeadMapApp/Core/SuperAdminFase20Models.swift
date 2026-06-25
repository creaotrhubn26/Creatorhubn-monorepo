// SuperAdminFase20Models.swift
//
// Fase 20: Platform-status + integrations-overview + API-endpoints-health.

import Foundation

// ============================================================
// MARK: - /api/admin-room/platform-status
// ============================================================

/// Health-status per provider (Render/Neon/Vercel/Stripe/Anthropic).
/// Backend (admin-room-platform-status-routes.ts) gir `metrics: Record<string,
/// string | number>` — vi støtter begge i custom init.
struct ProviderHealthStatus: Codable, Hashable, Identifiable {
    let provider: String
    let health: String          // 'ok' | 'warning' | 'error' | 'unconfigured'
    let message: String?
    let metrics: [String: String]?
    let dashboardUrl: String?
    let lastCheckedAt: String?

    var id: String { provider }

    private enum Keys: String, CodingKey {
        case provider, health, message, metrics, dashboardUrl, lastCheckedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        self.provider = (try? c.decode(String.self, forKey: .provider)) ?? "ukjent"
        self.health = (try? c.decode(String.self, forKey: .health)) ?? "unconfigured"
        self.message = try? c.decode(String.self, forKey: .message)
        self.dashboardUrl = try? c.decode(String.self, forKey: .dashboardUrl)
        self.lastCheckedAt = try? c.decode(String.self, forKey: .lastCheckedAt)

        // metrics: object med string | number-verdier — vi stringify-er alt.
        if let raw = try? c.decode([String: AnyMetricValue].self, forKey: .metrics) {
            var out: [String: String] = [:]
            for (k, v) in raw { out[k] = v.stringified }
            self.metrics = out.isEmpty ? nil : out
        } else {
            self.metrics = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        try c.encode(provider, forKey: .provider)
        try c.encode(health, forKey: .health)
        try c.encodeIfPresent(message, forKey: .message)
        try c.encodeIfPresent(metrics, forKey: .metrics)
        try c.encodeIfPresent(dashboardUrl, forKey: .dashboardUrl)
        try c.encodeIfPresent(lastCheckedAt, forKey: .lastCheckedAt)
    }
}

/// Hjelper for å dekode JSON-verdier som kan være string ELLER number ELLER bool.
private struct AnyMetricValue: Codable {
    let stringified: String
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { stringified = s }
        else if let i = try? c.decode(Int.self) { stringified = String(i) }
        else if let d = try? c.decode(Double.self) {
            // Drop ".0" for hele tall.
            stringified = d == d.rounded() ? String(Int(d)) : String(d)
        }
        else if let b = try? c.decode(Bool.self) { stringified = b ? "true" : "false" }
        else { stringified = "" }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(stringified)
    }
}

/// Mappes mot backend-presence-shape `{activeNow, activeLast24h,
/// activeLast7d, totalRoleRoomUsers, recentUsers}`. iPad bruker
/// historisk onlineCount/totalActiveLast24h — vi aliaser via computed.
struct UserPresenceSummary: Codable, Hashable {
    let activeNow: Int?
    let activeLast24h: Int?
    let activeLast7d: Int?
    let totalRoleRoomUsers: Int?

    var onlineCount: Int { activeNow ?? 0 }
    var totalActiveLast24h: Int { activeLast24h ?? 0 }
    var lastSampleAt: String? { nil }
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

/// Mappes mot backend `GET /api/admin/integrations/keys`
/// (admin-integrations-extras-routes.ts). Backend gir per nøkkel:
/// `{id, keyPrefix, label, scopes, createdAt, lastUsedAt, expiresAt,
/// isActive}`. iPad-UI bruker historisk `name/maskedValue` — vi aliaser.
struct IntegrationKey: Codable, Hashable, Identifiable {
    let id: String?
    let label: String?
    let keyPrefix: String?
    let scopes: [String]?
    let isActive: Bool?
    let lastUsedAt: String?
    let createdAt: String?
    let expiresAt: String?

    var keyId: String { id ?? label ?? keyPrefix ?? UUID().uuidString }
    var name: String { label ?? keyPrefix ?? "(uten label)" }
    var provider: String? { nil }
    var category: String? { nil }
    var maskedValue: String? { keyPrefix }
}

struct IntegrationKeysResponse: Codable {
    let keys: [IntegrationKey]
    let total: Int?
}

/// Mappes mot backend `GET /api/admin/integrations/webhooks`. Backend gir
/// `{id, url, events, isActive, lastDelivered, lastStatus (number),
/// failureCount}`. iPad UI bruker historisk `lastDeliveredAt`,
/// `lastStatus (string)`, `consecutiveFailures` — vi aliaser.
struct IntegrationWebhook: Codable, Hashable, Identifiable {
    let id: String
    let url: String
    let events: [String]?
    let isActive: Bool?
    let lastDelivered: String?
    let lastStatusCode: Int?
    let failureCount: Int?

    private enum Keys: String, CodingKey {
        case id, url, events, isActive, lastDelivered, lastStatus, failureCount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        self.id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        self.url = (try? c.decode(String.self, forKey: .url)) ?? ""
        self.events = try? c.decode([String].self, forKey: .events)
        self.isActive = try? c.decode(Bool.self, forKey: .isActive)
        self.lastDelivered = try? c.decode(String.self, forKey: .lastDelivered)
        self.lastStatusCode = try? c.decode(Int.self, forKey: .lastStatus)
        self.failureCount = try? c.decode(Int.self, forKey: .failureCount)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        try c.encode(id, forKey: .id)
        try c.encode(url, forKey: .url)
        try c.encodeIfPresent(events, forKey: .events)
        try c.encodeIfPresent(isActive, forKey: .isActive)
        try c.encodeIfPresent(lastDelivered, forKey: .lastDelivered)
        try c.encodeIfPresent(lastStatusCode, forKey: .lastStatus)
        try c.encodeIfPresent(failureCount, forKey: .failureCount)
    }

    var lastDeliveredAt: String? { lastDelivered }
    var lastStatus: String? {
        guard let s = lastStatusCode else { return nil }
        return String(s)
    }
    var consecutiveFailures: Int? { failureCount }
}

struct IntegrationWebhooksResponse: Codable {
    let webhooks: [IntegrationWebhook]
    let total: Int?
}

// ============================================================
// MARK: - /api/admin/api-endpoints/health
// ============================================================

/// Mappes mot backend `GET /api/admin/api-endpoints/health`
/// (admin-monitoring-routes.ts). Backend gir per endpoint:
/// `{id, path, method, critical, status, errorCount, warningCount,
/// lastEventAt}`. iPad-UI bruker historisk `source/errorCount24h/health`
/// — vi aliaser via computed felter.
struct ApiEndpointHealth: Codable, Hashable, Identifiable {
    let endpointId: String
    let path: String?
    let method: String?
    let status: String?         // 'up' | 'degraded' | 'down'
    let errorCount: Int?
    let warningCount: Int?
    let lastEventAt: String?
    let critical: Bool?

    private enum Keys: String, CodingKey {
        case id, path, method, status, errorCount, warningCount, lastEventAt, critical
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        self.endpointId = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        self.path = try? c.decode(String.self, forKey: .path)
        self.method = try? c.decode(String.self, forKey: .method)
        self.status = try? c.decode(String.self, forKey: .status)
        self.errorCount = try? c.decode(Int.self, forKey: .errorCount)
        self.warningCount = try? c.decode(Int.self, forKey: .warningCount)
        self.lastEventAt = try? c.decode(String.self, forKey: .lastEventAt)
        self.critical = try? c.decode(Bool.self, forKey: .critical)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        try c.encode(endpointId, forKey: .id)
        try c.encodeIfPresent(path, forKey: .path)
        try c.encodeIfPresent(method, forKey: .method)
        try c.encodeIfPresent(status, forKey: .status)
        try c.encodeIfPresent(errorCount, forKey: .errorCount)
        try c.encodeIfPresent(warningCount, forKey: .warningCount)
        try c.encodeIfPresent(lastEventAt, forKey: .lastEventAt)
        try c.encodeIfPresent(critical, forKey: .critical)
    }

    var id: String { endpointId }
    var source: String { path ?? endpointId }
    var errorCount24h: Int { errorCount ?? 0 }
    var warningCount24h: Int { warningCount ?? 0 }
    var infoCount24h: Int { 0 }
    var health: String? {
        switch status {
        case "up": return "ok"
        case "degraded": return "warning"
        case "down": return "error"
        default: return status
        }
    }
}

struct ApiEndpointsHealthResponse: Codable {
    let endpoints: [ApiEndpointHealth]
    let healthScore: Int?
    let windowHours: Int?
}
