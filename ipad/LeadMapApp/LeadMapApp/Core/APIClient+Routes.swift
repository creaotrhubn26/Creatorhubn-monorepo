// APIClient+Routes.swift
//
// Project-explicit client contract for route planning, GPS samples and
// adherence reports. Every active call carries the selected customer project;
// retryable creations additionally carry a stable idempotency key.

import Foundation

extension APIClient {
    private func routesPath(
        _ path: String,
        projectId: String,
        queryItems: [URLQueryItem] = []
    ) throws -> String {
        let trimmedProjectId = projectId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedProjectId.isEmpty else { throw URLError(.badURL) }
        var components = URLComponents()
        components.path = path
        components.queryItems = [URLQueryItem(name: "projectId", value: trimmedProjectId)]
            + queryItems
        guard let value = components.string else { throw URLError(.badURL) }
        return value
    }

    // MARK: - Position samples

    @discardableResult
    func flushPositionSamples(
        _ samples: [PositionSampleDTO],
        projectId: String
    ) async throws -> Int {
        let payload = PositionSamplesBatchPayload(samples: samples)
        let path = try routesPath(
            "/api/leadgrid/routes/positions",
            projectId: projectId
        )
        let response: PositionSamplesBatchResponse = try await _post(path, body: payload)
        return response.inserted
    }

    // MARK: - My route

    func fetchMyRoute(
        projectId: String,
        date: String? = nil
    ) async throws -> MyRouteResponse {
        var queryItems: [URLQueryItem] = []
        if let date, !date.isEmpty {
            queryItems.append(URLQueryItem(name: "date", value: date))
        }
        return try await _get(routesPath(
            "/api/leadgrid/routes/my-route",
            projectId: projectId,
            queryItems: queryItems
        ))
    }

    // MARK: - Assignments

    @discardableResult
    func createRouteAssignment(
        _ payload: CreateRouteAssignmentPayload,
        projectId: String,
        idempotencyKey: String
    ) async throws -> RouteAssignmentDTO {
        let path = try routesPath(
            "/api/leadgrid/routes/assignments",
            projectId: projectId
        )
        return try await _post(
            path,
            body: payload,
            headers: ["Idempotency-Key": idempotencyKey]
        )
    }

    @discardableResult
    func updateRouteAssignment(
        id: UUID,
        _ payload: UpdateRouteAssignmentPayload,
        projectId: String
    ) async throws -> RouteAssignmentDTO {
        let path = try routesPath(
            "/api/leadgrid/routes/assignments/\(id.uuidString.lowercased())",
            projectId: projectId
        )
        let encoded = try Self._sharedEncoder.encode(payload)
        let data = try await _request(path, method: "PATCH", body: encoded)
        return try Self._sharedDecoder.decode(RouteAssignmentDTO.self, from: data)
    }

    @discardableResult
    func logRouteVisit(
        assignmentId: UUID,
        _ payload: LogRouteVisitPayload,
        projectId: String,
        idempotencyKey: String
    ) async throws -> RouteVisitDTO {
        let path = try routesPath(
            "/api/leadgrid/routes/assignments/\(assignmentId.uuidString.lowercased())/visits",
            projectId: projectId
        )
        return try await _post(
            path,
            body: payload,
            headers: ["Idempotency-Key": idempotencyKey]
        )
    }

    // MARK: - Team nearby

    func fetchTeamNearby(
        lat: Double,
        lon: Double,
        radiusKm: Double = 5,
        projectId: String
    ) async throws -> [NearbyTeamMemberDTO] {
        let path = try routesPath(
            "/api/leadgrid/routes/team-nearby",
            projectId: projectId,
            queryItems: [
                URLQueryItem(name: "lat", value: String(lat)),
                URLQueryItem(name: "lon", value: String(lon)),
                URLQueryItem(name: "radius_km", value: String(radiusKm)),
            ]
        )
        let response: NearbyTeamResponse = try await _get(path)
        return response.members
    }

    // MARK: - Adherence reports

    func fetchAdherenceReport(
        projectId: String,
        userId: String? = nil,
        from: String? = nil,
        to: String? = nil
    ) async throws -> RouteAdherenceReportDTO {
        var queryItems: [URLQueryItem] = []
        if let userId, !userId.isEmpty {
            queryItems.append(URLQueryItem(name: "user_id", value: userId))
        }
        if let from, !from.isEmpty {
            queryItems.append(URLQueryItem(name: "from", value: from))
        }
        if let to, !to.isEmpty {
            queryItems.append(URLQueryItem(name: "to", value: to))
        }
        return try await _get(routesPath(
            "/api/leadgrid/routes/adherence-report",
            projectId: projectId,
            queryItems: queryItems
        ))
    }

    func fetchTeamAdherenceSummary(
        projectId: String,
        date: String? = nil
    ) async throws -> TeamAdherenceReportDTO {
        var queryItems: [URLQueryItem] = []
        if let date, !date.isEmpty {
            queryItems.append(URLQueryItem(name: "date", value: date))
        }
        return try await _get(routesPath(
            "/api/leadgrid/routes/adherence-report/team-summary",
            projectId: projectId,
            queryItems: queryItems
        ))
    }

    // MARK: - Cleanup

    @discardableResult
    func cleanupOldPositions(
        beforeDate: String,
        projectId: String
    ) async throws -> Int {
        struct CleanupResponse: Decodable {
            let deleted: Int
            let before: String
        }
        let path = try routesPath(
            "/api/leadgrid/routes/positions/before",
            projectId: projectId,
            queryItems: [URLQueryItem(name: "date", value: beforeDate)]
        )
        let data = try await _request(path, method: "DELETE")
        return try Self._sharedDecoder.decode(CleanupResponse.self, from: data).deleted
    }
}
