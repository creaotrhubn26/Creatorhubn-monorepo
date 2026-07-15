// APIClient+Routes.swift
//
// Klient-metoder mot /api/leadgrid/routes/* — MeMapPin tap-actions +
// route-adherence-dashboard (pakke 2026-07-02).
//
// Backend: backend/server/routes-adherence-routes.ts
// DTOer:   RouteModels.swift

import Foundation

extension APIClient {

    // MARK: - Position samples (batch flush)

    /// Batch-log posisjons-samples. Klienten sender hvert 30s (eller 30
    /// samples). Idempotent på sampled_at (dedup-index på backend).
    @discardableResult
    func flushPositionSamples(_ samples: [PositionSampleDTO]) async throws -> Int {
        let payload = PositionSamplesBatchPayload(samples: samples)
        let resp: PositionSamplesBatchResponse = try await _post(
            "/api/leadgrid/routes/positions", body: payload
        )
        return resp.inserted
    }

    // MARK: - My route

    /// Dagens rute for innlogget bruker. `date` = "YYYY-MM-DD" (default i dag).
    func fetchMyRoute(date: String? = nil) async throws -> MyRouteResponse {
        var path = "/api/leadgrid/routes/my-route"
        if let d = date, !d.isEmpty {
            path += "?date=\(d)"
        }
        return try await _get(path)
    }

    // MARK: - Assignments (salgssjef+)

    /// Opprett en ny planlagt rute. Krever sales_manager+.
    @discardableResult
    func createRouteAssignment(
        _ payload: CreateRouteAssignmentPayload
    ) async throws -> RouteAssignmentDTO {
        try await _post("/api/leadgrid/routes/assignments", body: payload)
    }

    /// Oppdater rute (status/stops/name). Eier kan bytte status; salgssjef+
    /// kan endre navn + stops.
    @discardableResult
    func updateRouteAssignment(
        id: UUID,
        _ payload: UpdateRouteAssignmentPayload
    ) async throws -> RouteAssignmentDTO {
        try await _patch(
            "/api/leadgrid/routes/assignments/\(id.uuidString)",
            body: payload
        )
    }

    /// Log at bruker ankom en stopp. Backend beregner
    /// `deviationFromPlannedM` + `wasOnRoute`.
    @discardableResult
    func logRouteVisit(
        assignmentId: UUID,
        _ payload: LogRouteVisitPayload
    ) async throws -> RouteVisitDTO {
        try await _post(
            "/api/leadgrid/routes/assignments/\(assignmentId.uuidString)/visits",
            body: payload
        )
    }

    // MARK: - Team-nearby

    /// Team-medlemmer innen `radiusKm` km fra (lat, lon), sortert
    /// nærmeste-først. Selv-brukeren er ekskludert.
    func fetchTeamNearby(
        lat: Double, lon: Double, radiusKm: Double = 5
    ) async throws -> [NearbyTeamMemberDTO] {
        let path = "/api/leadgrid/routes/team-nearby"
            + "?lat=\(lat)&lon=\(lon)&radius_km=\(radiusKm)"
        let resp: NearbyTeamResponse = try await _get(path)
        return resp.members
    }

    // MARK: - Adherence report

    /// Adherence-rapport for en bruker (default = innlogget). Uten
    /// `userId` returneres egen data; salgssjef+ kan sette hvilken som helst.
    func fetchAdherenceReport(
        userId: String? = nil,
        from: String? = nil,
        to: String? = nil
    ) async throws -> RouteAdherenceReportDTO {
        var qs: [String] = []
        if let u = userId, !u.isEmpty,
           let enc = u.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        { qs.append("user_id=\(enc)") }
        if let f = from, !f.isEmpty { qs.append("from=\(f)") }
        if let t = to, !t.isEmpty { qs.append("to=\(t)") }
        let path = "/api/leadgrid/routes/adherence-report"
            + (qs.isEmpty ? "" : "?\(qs.joined(separator: "&"))")
        return try await _get(path)
    }

    /// Salgssjef+: team-summary for gitt dato (default i dag), rangert
    /// etter compliance (best → verst).
    func fetchTeamAdherenceSummary(
        date: String? = nil
    ) async throws -> TeamAdherenceReportDTO {
        var path = "/api/leadgrid/routes/adherence-report/team-summary"
        if let d = date, !d.isEmpty { path += "?date=\(d)" }
        return try await _get(path)
    }

    // MARK: - Create lead at position

    /// Opprett et lead på bestemt koordinat. Backend reverse-geocoder via
    /// Places. Klienten kan navigere til AddLeadSheet m/ lead-id prefilled.
    func createLeadAtPosition(
        lat: Double, lon: Double, orgId: String? = nil
    ) async throws -> CreatedLeadAtPositionDTO {
        let payload = CreateLeadAtPositionPayload(lat: lat, lon: lon, orgId: orgId)
        return try await _post(
            "/api/leadgrid/routes/leads/at-position",
            body: payload
        )
    }

    // MARK: - Cleanup

    /// Cleanup av gamle position-samples. Kun for job-scheduler /
    /// salgssjef+. `beforeDate` = "YYYY-MM-DD".
    @discardableResult
    func cleanupOldPositions(beforeDate: String) async throws -> Int {
        struct CleanupResp: Decodable { let deleted: Int; let before: String }
        let data = try await _request(
            "/api/leadgrid/routes/positions/before?date=\(beforeDate)",
            method: "DELETE"
        )
        let resp = try Self._sharedDecoder.decode(CleanupResp.self, from: data)
        return resp.deleted
    }
}
