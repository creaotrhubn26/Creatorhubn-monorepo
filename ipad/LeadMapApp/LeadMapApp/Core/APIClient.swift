// APIClient.swift
//
// Tynn URLSession-wrapper for /api/admin-room/lead-map/* endepunkter.
// Alle metoder er async throws — caller bestemmer error-handling.
//
// Base-URL er hardkodet til prod. Lokal-utvikling kan overstyre via
// LEAD_MAP_API_BASE i Info.plist senere.

import Foundation

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
