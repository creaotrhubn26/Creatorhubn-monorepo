import Foundation

struct Review: Identifiable, Hashable, Sendable, Codable {
    enum ReviewerType: String, Sendable, Codable {
        case photographer
        case client
        case assistant
    }

    let id: UUID
    let assetId: UUID
    let reviewerId: String
    let reviewerType: ReviewerType
    var heart: Bool?
    var rating: Int?
    var comment: String?
    let createdAt: Date
}
