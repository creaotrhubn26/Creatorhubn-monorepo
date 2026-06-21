import Foundation

/// An inbound client request (from `/api/submissions`) — the entry point of the
/// request→project→… loop. Carries the full inquiry detail a client submits, so
/// the photographer can read everything before turning it into a project (which
/// links the submission via the `submissionId` cascade).
struct Submission: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    var name: String?
    var email: String?
    var phone: String?
    var company: String?
    var projectType: String?
    var eventDate: String?
    var location: String?
    var budget: Double?
    var description: String?
    var specialRequests: String?
    var contactPreference: String?
    var timeframe: String?
    var referralSource: String?
    var priority: String?
    var clientNotes: String?
    var status: String?
    var quoteSent: Bool
    var quoteAmount: Double?
    var contractSent: Bool
    var depositReceived: Bool
    var isStarred: Bool
    var submittedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, name, email, phone, company, projectType, eventDate, location, budget
        case description, message, notes, specialRequests, contactPreference, timeframe
        case referralSource, priority, clientNotes, status
        case quoteSent, quoteAmount, contractSent, depositReceived, isStarred, submittedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let s = try? c.decode(String.self, forKey: .id) { id = s }
        else if let n = try? c.decode(Int.self, forKey: .id) { id = String(n) }
        else { id = UUID().uuidString }
        name = c.firstString([.name])
        email = c.firstString([.email])
        phone = c.firstString([.phone])
        company = c.firstString([.company])
        projectType = c.firstString([.projectType])
        eventDate = c.firstString([.eventDate])
        location = c.firstString([.location])
        budget = c.firstDouble([.budget])
        description = c.firstString([.description, .message, .notes])
        specialRequests = c.firstString([.specialRequests])
        contactPreference = c.firstString([.contactPreference])
        timeframe = c.firstString([.timeframe])
        referralSource = c.firstString([.referralSource])
        priority = c.firstString([.priority])
        clientNotes = c.firstString([.clientNotes])
        status = c.firstString([.status])
        quoteSent = c.firstBool([.quoteSent]) ?? false
        quoteAmount = c.firstDouble([.quoteAmount])
        contractSent = c.firstBool([.contractSent]) ?? false
        depositReceived = c.firstBool([.depositReceived]) ?? false
        isStarred = c.firstBool([.isStarred]) ?? false
        submittedAt = c.firstString([.submittedAt])
    }

    var isNew: Bool { (status ?? "new").lowercased() == "new" }
}
