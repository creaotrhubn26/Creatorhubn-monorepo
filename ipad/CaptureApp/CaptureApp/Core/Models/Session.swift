import Foundation

struct Session: Identifiable, Hashable, Sendable, Codable {
    enum Status: String, Sendable, Codable, CaseIterable {
        case active
        case paused
        case closed
    }

    let id: UUID
    var name: String
    var clientId: UUID?
    var startsAt: Date
    var endsAt: Date?
    var status: Status
    let ownerUserId: String
    let createdAt: Date
    var updatedAt: Date
}
