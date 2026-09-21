import Foundation

extension DashboardClient {
    /// Inbound client requests for the photographer.
    func listSubmissions(status: String = "open", search: String? = nil) async throws -> [Submission] {
        var comps = URLComponents(string: "/api/inquiries")!
        var query: [URLQueryItem] = [
            .init(name: "status", value: status),
            .init(name: "limit", value: "200"),
        ]
        if let search, !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            query.append(.init(name: "search", value: search))
        }
        comps.queryItems = query
        let response: InquiryListResponse = try await getJSON(path: comps.string ?? "/api/inquiries?status=open")
        return response.items
    }

    func updateInquiry(
        id: String,
        isRead: Bool? = nil,
        isStarred: Bool? = nil,
        status: String? = nil,
        priority: String? = nil,
        followUpDate: Date? = nil,
        internalNotes: String? = nil
    ) async throws {
        struct Body: Encodable {
            let isRead: Bool?
            let isStarred: Bool?
            let status: String?
            let priority: String?
            let followUpDate: String?
            let internalNotes: String?
        }
        let formatter = ISO8601DateFormatter()
        try await send(
            path: "/api/inquiries/\(Self.inquiryPathComponent(id))",
            method: "PATCH",
            body: Body(
                isRead: isRead,
                isStarred: isStarred,
                status: status,
                priority: priority,
                followUpDate: followUpDate.map(formatter.string),
                internalNotes: internalNotes
            )
        )
    }

    func replyToInquiry(id: String, subject: String?, body: String) async throws -> Submission {
        struct Body: Encodable { let subject: String?; let body: String }
        let response: InquiryReplyResponse = try await postJSON(
            path: "/api/inquiries/\(Self.inquiryPathComponent(id))/reply",
            body: Body(subject: subject, body: body)
        )
        return response.inquiry
    }

    /// Convert a request into a project. The backend links the submission to
    /// the new project (submissionId cascade) and seeds the worklog phases.
    /// Returns the new project id.
    @discardableResult
    func createProjectFromSubmission(_ s: Submission) async throws -> String {
        struct Body: Encodable {
            let title: String
            let clientName: String?
            let clientEmail: String?
            let clientPhone: String?
            let projectType: String?
            let eventDate: String?
            let location: String?
            let budget: Double?
            let servicePrice: Double?
            let submissionId: String
            let status: String
        }
        struct Resp: Decodable { let id: String? }
        let title = (s.name.map { "\($0)" } ?? "Nytt prosjekt")
            + (s.projectType.map { " — \($0)" } ?? "")
        let resp: Resp = try await postJSON(
            path: "/api/photographer/projects",
            body: Body(
                title: title,
                clientName: s.name,
                clientEmail: s.email,
                clientPhone: s.phone,
                projectType: s.projectType,
                eventDate: s.eventDate,
                location: s.location,
                budget: s.budget,
                servicePrice: s.budget,
                submissionId: s.id,
                status: "booked",
            ),
        )
        guard let id = resp.id else { throw DashboardError.decode("create from submission: no id") }
        return id
    }

    private static func inquiryPathComponent(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}
