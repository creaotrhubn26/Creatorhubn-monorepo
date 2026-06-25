import Foundation

/// The project a conversation belongs to (from the CRM context link).
struct ConversationProjectLink: Sendable, Hashable {
    let id: String
    let name: String?
}

extension DashboardClient {
    /// Resolve which project a conversation belongs to, via the CRM context
    /// endpoint (`conversation.projectId/projectName` or `link.projectId`).
    /// Returns nil when the conversation isn't tied to a project.
    func conversationProject(conversationId: String, provider: String) async throws -> ConversationProjectLink? {
        struct Resp: Decodable {
            struct Conv: Decodable { var projectId: String?; var projectName: String? }
            struct Link: Decodable { var projectId: String? }
            var conversation: Conv?
            var link: Link?
        }
        guard var comps = URLComponents(string: "/api/universal-crm/context/by-conversation") else { return nil }
        comps.queryItems = [
            .init(name: "conversationId", value: conversationId),
            .init(name: "provider", value: provider)
        ]
        let resp: Resp = try await getJSON(path: comps.string ?? "")
        let pid = resp.conversation?.projectId ?? resp.link?.projectId
        guard let pid, !pid.isEmpty else { return nil }
        return ConversationProjectLink(id: pid, name: resp.conversation?.projectName)
    }

    /// Full project detail — bundles the project, its worklog (time entries)
    /// and linked galleries in one call.
    func projectDetail(id: String) async throws -> ProjectDetailResponse {
        try await getJSON(path: "/api/photographer/projects/\(id)")
    }

    /// Timeline milestones.
    func projectMilestones(id: String) async throws -> [ProjectMilestone] {
        let resp: ProjectMilestonesResponse = try await getJSON(path: "/api/photographer/projects/\(id)/milestones")
        return resp.milestones
    }

    /// Move the project along the lifecycle.
    func updateProjectStatus(id: String, status: String) async throws {
        struct Body: Encodable { let status: String }
        try await send(path: "/api/photographer/projects/\(id)", method: "PATCH", body: Body(status: status))
    }

    /// Log a worklog entry (hours) against the project.
    func logProjectTime(
        projectId: String,
        taskDescription: String,
        hoursSpent: Double,
        billableHours: Double? = nil,
        rate: Double? = nil,
        dateWorked: String? = nil,
    ) async throws {
        struct Body: Encodable {
            let taskDescription: String
            let hoursSpent: Double
            let billableHours: Double?
            let rate: Double?
            let dateWorked: String?
        }
        try await send(
            path: "/api/photographer/projects/\(projectId)/time",
            method: "POST",
            body: Body(taskDescription: taskDescription, hoursSpent: hoursSpent, billableHours: billableHours, rate: rate, dateWorked: dateWorked),
        )
    }
}
