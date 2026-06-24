import Foundation

extension DashboardClient {
    /// Inbound client requests for the photographer.
    func listSubmissions() async throws -> [Submission] {
        var comps = URLComponents(string: "/api/submissions")!
        comps.queryItems = [.init(name: "profession", value: "photographer")]
        return try await getJSON(path: comps.string ?? "/api/submissions")
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
}
