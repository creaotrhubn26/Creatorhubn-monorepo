import Foundation

/// An inbound client request (from `/api/submissions`) — the entry point of the
/// request→project→… loop. The photographer turns one into a project, which
/// links the submission to the new project (`submissionId` cascade).
struct Submission: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    var name: String?
    var email: String?
    var phone: String?
    var projectType: String?
    var eventDate: String?
    var location: String?
    var budget: Double?
    var status: String?
    var message: String?
    var submittedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, name, email, phone, projectType, eventDate, location, budget
        case status, message, notes, description, submittedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let s = try? c.decode(String.self, forKey: .id) { id = s }
        else if let n = try? c.decode(Int.self, forKey: .id) { id = String(n) }
        else { id = UUID().uuidString }
        name = c.firstString([.name])
        email = c.firstString([.email])
        phone = c.firstString([.phone])
        projectType = c.firstString([.projectType])
        eventDate = c.firstString([.eventDate])
        location = c.firstString([.location])
        budget = c.firstDouble([.budget])
        status = c.firstString([.status])
        message = c.firstString([.message, .notes, .description])
        submittedAt = c.firstString([.submittedAt])
    }

    var isNew: Bool { (status ?? "new").lowercased() == "new" }
}
