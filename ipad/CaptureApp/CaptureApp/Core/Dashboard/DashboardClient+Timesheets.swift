import Foundation

extension DashboardClient {
    func timesheets(projectId: String) async throws -> CaptureTimesheetListResponse {
        try await getJSON(path: "/api/projects/\(Self.pathSegment(projectId))/timesheets")
    }

    func timesheet(projectId: String, periodId: String) async throws -> CaptureTimesheetDetailResponse {
        try await getJSON(path: "/api/projects/\(Self.pathSegment(projectId))/timesheets/\(Self.pathSegment(periodId))")
    }

    func ensureCurrentTimesheet(
        projectId: String,
        periodStart: String,
        periodEnd: String
    ) async throws -> CaptureCurrentPeriodResponse {
        struct Body: Encodable { let periodStart: String; let periodEnd: String }
        return try await postJSON(
            path: "/api/projects/\(Self.pathSegment(projectId))/timesheets/current",
            body: Body(periodStart: periodStart, periodEnd: periodEnd)
        )
    }

    func submitTimesheet(projectId: String, periodId: String, note: String?) async throws {
        struct Body: Encodable { let note: String? }
        try await send(
            path: "/api/projects/\(Self.pathSegment(projectId))/timesheets/\(Self.pathSegment(periodId))/submit",
            method: "POST",
            body: Body(note: note)
        )
    }

    private static func pathSegment(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_.~"))
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}
