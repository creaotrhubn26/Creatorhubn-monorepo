import Foundation

struct Asset: Identifiable, Hashable, Sendable, Codable {
    let id: UUID
    let sessionId: UUID
    let originalFilename: String
    let captureTime: Date

    var previewKey: String?
    var fullKey: String?
    var rawKey: String?
    var checksumSha256: String?
    var mime: String
    var sizeBytes: Int64?

    var state: AssetState
    var signals: AssetSignals

    var rating: Int
    var colorLabel: ColorLabel?
    var flaggedForClient: Bool
    var rejected: Bool

    let createdAt: Date
    var updatedAt: Date
}

enum ColorLabel: String, Sendable, Codable, CaseIterable {
    case red, orange, yellow, green, blue, purple, pink, gray
}

struct AssetSignals: Hashable, Sendable, Codable {
    var sharpness: Double?
    var eyesOpen: Bool?
    var faceCount: Int?
    var duplicateGroupId: UUID?

    static let empty = AssetSignals()
}
