// APIClient.swift
//
// Tynn URLSession-wrapper for /api/admin-room/lead-map/* endepunkter.
// Alle metoder er async throws — caller bestemmer error-handling.
//
// Base-URL er hardkodet til prod. Lokal-utvikling kan overstyre via
// LEAD_MAP_API_BASE i Info.plist senere.

import Foundation
import CoreLocation

actor APIClient {
    private let token: String
    private let baseURL: URL
    private let session: URLSession

    init(token: String, baseURL: URL = URL(string: "https://creatorhub-backend-rtbl.onrender.com")!) {
        self.token = token
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
    }

    // MARK: - GET-endepunkter

    /// Bygg ?projectId=… query-string når aktivt prosjekt er satt.
    private func projectQuery(_ projectId: String?, sep: String = "?") -> String {
        guard let p = projectId, !p.isEmpty else { return "" }
        let encoded = p.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? p
        return "\(sep)projectId=\(encoded)"
    }

    func fetchLeads(projectId: String? = nil) async throws -> [LeadModel] {
        let resp: LeadsResponse = try await get("/api/admin-room/lead-map/leads\(projectQuery(projectId))")
        return resp.leads
    }

    func fetchLead(id: String) async throws -> LeadModel {
        try await get("/api/admin-room/lead-map/leads/\(id)")
    }

    func fetchCompetitors(projectId: String? = nil) async throws -> [CompetitorModel] {
        let resp: CompetitorsResponse = try await get("/api/admin-room/lead-map/competitors\(projectQuery(projectId))")
        return resp.competitors
    }

    func fetchMetrics(projectId: String? = nil) async throws -> MetricsModel {
        try await get("/api/admin-room/lead-map/metrics\(projectQuery(projectId))")
    }

    func fetchCalendar(projectId: String? = nil) async throws -> [CalendarEvent] {
        let resp: CalendarResponse = try await get("/api/admin-room/lead-map/calendar\(projectQuery(projectId))")
        return resp.events
    }

    func fetchReminders(projectId: String? = nil) async throws -> RemindersResponse {
        try await get("/api/admin-room/lead-map/reminders\(projectQuery(projectId))")
    }

    func fetchProjects() async throws -> [ProjectListItem] {
        let resp: ProjectsResponse = try await get("/api/admin-room/lead-map/projects")
        return resp.projects
    }

    func fetchProjectSummary(id: String) async throws -> ProjectSummary {
        try await get("/api/admin-room/lead-map/projects/\(id)/summary")
    }

    func fetchEnrichment(leadId: String) async throws -> EnrichmentModel? {
        let resp: EnrichmentEnvelope = try await get(
            "/api/admin-room/lead-map/leads/\(leadId)/enrichment"
        )
        return resp.enrichment
    }

    func fetchDemographics(leadId: String) async throws -> DemographicsModel? {
        let resp: DemographicsEnvelope = try await get(
            "/api/admin-room/lead-map/leads/\(leadId)/demographics"
        )
        return resp.demographics
    }

    // MARK: - PATCH/POST

    func updateStatus(leadId: String, status: String) async throws {
        try await patch(
            "/api/admin-room/lead-map/leads/\(leadId)/status",
            body: ["status": status]
        )
    }

    func logVisit(leadId: String, body: [String: Any]) async throws {
        try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/visits",
            body: body
        )
    }

    /// Sendable-vennlig variant — body er ferdig JSON-serialisert til Data.
    func logVisitRaw(leadId: String, jsonBody: Data) async throws {
        var req = makeRequest("/api/admin-room/lead-map/leads/\(leadId)/visits", method: "POST")
        req.httpBody = jsonBody
        let (_, response) = try await session.data(for: req)
        try Self.validate(response)
    }

    func generateStrategy(leadId: String) async throws -> StrategyModel {
        let resp: StrategyEnvelope = try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/strategy"
        )
        return resp.strategy
    }

    func triggerEnrichment(leadId: String) async throws -> EnrichmentModel? {
        let resp: EnrichmentEnvelope = try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/enrich"
        )
        return resp.enrichment
    }

    // MARK: - Min dag (PR #616)

    func fetchWorkload(
        organizationId: String?,
        location: CLLocation? = nil
    ) async throws -> WorkloadResponse {
        var qs: [String] = []
        if let orgId = organizationId {
            qs.append("organization_id=\(orgId)")
        }
        if let loc = location {
            qs.append("lat=\(loc.coordinate.latitude)")
            qs.append("lng=\(loc.coordinate.longitude)")
        }
        let q = qs.isEmpty ? "" : "?\(qs.joined(separator: "&"))"
        return try await get("/api/admin-room/lead-map/me/workload\(q)")
    }

    func fetchQuota(organizationId: String) async throws -> QuotaProgress {
        try await get("/api/admin-room/lead-map/me/quota?organization_id=\(organizationId)")
    }

    // MARK: - Organisasjoner (PR #611+#612)

    func fetchOrganizations() async throws -> [OrganizationSummary] {
        let resp: OrgsResponse = try await get("/api/admin-room/lead-map/organizations")
        return resp.organizations
    }

    func fetchOrgProfile(_ organizationId: String) async throws -> OrgProfileEnvelope {
        try await get("/api/admin-room/lead-map/organizations/\(organizationId)/profile")
    }

    func fetchOrgMembers(_ organizationId: String) async throws -> [MemberProfile] {
        let resp: OrgProfilesResponse = try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/profiles"
        )
        return resp.profiles
    }

    func fetchSalesTeams(_ organizationId: String) async throws -> [SalesTeam] {
        let resp: TeamsResponse = try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/teams"
        )
        return resp.teams
    }

    func fetchMemberLocations(_ organizationId: String) async throws -> [MemberLocation] {
        let resp: MemberLocationsResponse = try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/member-locations"
        )
        return resp.locations
    }

    // MARK: - RBAC (PR #615)

    func fetchPermissions(organizationId: String?) async throws -> PermissionsResponse {
        let q = organizationId.map { "?organization_id=\($0)" } ?? ""
        return try await get("/api/admin-room/lead-map/me/permissions\(q)")
    }

    // MARK: - Heartbeat + posisjons-deling (PR #612)

    func sendHeartbeat(
        organizationId: String,
        location: CLLocation? = nil,
        activity: String = "idle"
    ) async throws {
        var body: [String: Any] = ["organization_id": organizationId]
        if let loc = location {
            body["lat"] = loc.coordinate.latitude
            body["lng"] = loc.coordinate.longitude
            body["accuracy_m"] = loc.horizontalAccuracy
            body["activity"] = activity
        }
        try await post("/api/admin-room/lead-map/heartbeat", body: body)
    }

    func setLocationConsent(_ organizationId: String, consent: Bool) async throws {
        if consent {
            try await post(
                "/api/admin-room/lead-map/organizations/\(organizationId)/location/consent",
                body: [:]
            )
        } else {
            try await delete(
                "/api/admin-room/lead-map/organizations/\(organizationId)/location/consent"
            )
        }
    }

    func fetchLocationConsent(_ organizationId: String) async throws -> Bool {
        let resp: ConsentResponse = try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/location/consent"
        )
        return resp.consented
    }

    // MARK: - Team-leaderboard (PR #620)

    func fetchLeaderboard(
        organizationId: String,
        period: String = "this_month",
        teamId: String? = nil,
        sort: String = "progress"
    ) async throws -> LeaderboardResponse {
        var qs = "?period=\(period)&sort=\(sort)"
        if let tid = teamId, !tid.isEmpty {
            qs += "&team_id=\(tid)"
        }
        return try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/leaderboard\(qs)"
        )
    }

    func fetchLeaderboardSummary(
        organizationId: String,
        period: String = "this_month"
    ) async throws -> LeaderboardSummary {
        try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/leaderboard-summary?period=\(period)"
        )
    }

    // MARK: - Lead-tildeling (PR #616)

    func assignLead(_ leadId: String, toUserId: String, reason: String = "manual") async throws {
        try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/assign",
            body: ["user_id": toUserId, "reason": reason]
        )
    }

    func releaseLead(_ leadId: String) async throws {
        try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/release",
            body: [:]
        )
    }

    // MARK: - Internal

    private func makeRequest(_ path: String, method: String = "GET") -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return req
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let req = makeRequest(path)
        let (data, response) = try await session.data(for: req)
        try Self.validate(response)
        return try Self.decoder.decode(T.self, from: data)
    }

    private func patch(_ path: String, body: [String: Any]) async throws {
        var req = makeRequest(path, method: "PATCH")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await session.data(for: req)
        try Self.validate(response)
    }

    private func post<T: Decodable>(_ path: String, body: [String: Any]? = nil) async throws -> T {
        var req = makeRequest(path, method: "POST")
        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await session.data(for: req)
        try Self.validate(response)
        return try Self.decoder.decode(T.self, from: data)
    }

    private func post(_ path: String, body: [String: Any]) async throws {
        var req = makeRequest(path, method: "POST")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await session.data(for: req)
        try Self.validate(response)
    }

    private func delete(_ path: String) async throws {
        let req = makeRequest(path, method: "DELETE")
        let (_, response) = try await session.data(for: req)
        try Self.validate(response)
    }

    private static func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.statusCode(http.statusCode)
        }
    }

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

enum APIError: Error {
    case invalidResponse
    case statusCode(Int)
}

// MARK: - Response envelopes

private struct LeadsResponse: Decodable { let leads: [LeadModel] }
private struct ProjectsResponse: Decodable { let projects: [ProjectListItem] }
private struct CompetitorsResponse: Decodable { let competitors: [CompetitorModel] }
private struct CalendarResponse: Decodable { let events: [CalendarEvent] }
private struct EnrichmentEnvelope: Decodable { let enrichment: EnrichmentModel? }
private struct DemographicsEnvelope: Decodable { let demographics: DemographicsModel? }
private struct StrategyEnvelope: Decodable { let strategy: StrategyModel }
private struct OrgsResponse: Decodable { let organizations: [OrganizationSummary] }
private struct OrgProfilesResponse: Decodable { let profiles: [MemberProfile] }
private struct TeamsResponse: Decodable { let teams: [SalesTeam] }
private struct MemberLocationsResponse: Decodable { let locations: [MemberLocation] }
private struct ConsentResponse: Decodable { let consented: Bool }

struct OrgProfileEnvelope: Decodable {
    let profile: OrganizationProfile
    let canEdit: Bool
    let isOwner: Bool
    let ownerOnlyFields: [String]
}
