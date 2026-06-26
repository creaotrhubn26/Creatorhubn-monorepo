// LeadgridLeadDiscoveryModels.swift
//
// Decode-typer for /api/leadgrid/projects/:projectId/discover-leads*
// (mig 0352). "Finn leads for {prosjekt}" → batch-research → pins på kartet.
//
// Gjenbruker eksisterende BulkUrlBatchProgress / BulkUrlBatchDetail for
// per-item-status — bare backend-respons-skallet for `/start` + `/result`
// er nytt her.
//
// camelCase brukes; APIClient.decoder har convertFromSnakeCase.

import Foundation

// MARK: - /discover-leads (POST) respons

struct LeadDiscoveryStartResponse: Codable, Sendable {
    let batchId: String?
    let projectId: String
    let projectName: String?
    let foundCount: Int
    let discoveryQuery: String
    let estimatedCompletionSeconds: Int
    /// Kun satt når foundCount == 0 (alt allerede importert).
    let message: String?
}

// MARK: - /discover-leads/:batchId/result (GET) respons

struct LeadDiscoveryBatchInfo: Codable, Sendable, Identifiable {
    let id: String
    let status: BulkUrlBatchStatus
    let totalUrls: Int
    let completedUrls: Int
    let failedUrls: Int
    let pinnedLeads: Int
    let startedAt: String?
    let finishedAt: String?
}

struct LeadDiscoveryProjectRef: Codable, Sendable {
    let id: String
    let name: String?
}

/// Subset av items vi får tilbake — vi har ikke fullt research_result
/// her, men nok til å rendre item-list-status og dedupe mot eksisterende
/// pins når WebSocket-eventet pinger oss.
struct LeadDiscoveryItem: Codable, Sendable, Identifiable {
    let id: String
    let url: String
    let orderIndex: Int
    let status: BulkUrlItemStatus
    let draftLeadId: String?
    let hasPin: Bool
    let locationConfidence: LocationConfidence?
    let errorMessage: String?
}

struct LeadDiscoveryBreakdownIndustry: Codable, Sendable {
    let industryId: String
    let count: Int
}

struct LeadDiscoveryBreakdownCity: Codable, Sendable {
    let city: String
    let count: Int
}

struct LeadDiscoveryBreakdown: Codable, Sendable {
    let exact: Int
    let geocoded: Int
    let approximate: Int
    let unknown: Int
    let failed: Int
    let byIndustry: [LeadDiscoveryBreakdownIndustry]
    let byCity: [LeadDiscoveryBreakdownCity]
}

struct LeadDiscoveryResultResponse: Codable, Sendable {
    let batch: LeadDiscoveryBatchInfo
    let project: LeadDiscoveryProjectRef
    let items: [LeadDiscoveryItem]
    let summary: BulkUrlBatchSummary
    let breakdown: LeadDiscoveryBreakdown
}

// MARK: - Request bodies

/// Geo-bias for discovery (valgfritt — uten dette søker vi globalt på
/// bransje+by-streng).
struct LeadDiscoveryGeo: Sendable {
    var lat: Double
    var lng: Double
    var radiusKm: Int
}

/// Body for POST /discover-leads. Alle felter optional; backend bruker
/// prosjekt-kontekst (brand-kit / siste market-scan) som default.
struct LeadDiscoveryRequest: Sendable {
    var count: Int = 20
    /// Override av bransje-streng. Hvis nil bruker backend
    /// prosjektets industry-hint.
    var industryQuery: String?
    /// Override av by. Hvis nil bruker backend prosjektets city-hint.
    var city: String?
    /// Geo-bias. Hvis satt overrides city for radius-søk.
    var geo: LeadDiscoveryGeo?

    func toDict() -> [String: Any] {
        var d: [String: Any] = ["count": count]
        if let v = industryQuery, !v.isEmpty { d["industry_query"] = v }
        if let v = city, !v.isEmpty { d["city"] = v }
        if let g = geo {
            d["geo"] = [
                "lat": g.lat,
                "lng": g.lng,
                "radius_km": g.radiusKm,
            ]
        }
        return d
    }
}
