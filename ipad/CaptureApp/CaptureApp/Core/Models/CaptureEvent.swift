import Foundation

struct CaptureEvent: Identifiable, Hashable, Sendable, Codable {
    enum EventType: String, Sendable, Codable, CaseIterable {
        case captured
        case previewReady = "preview_ready"
        case fullReady = "full_ready"
        case rawReady = "raw_ready"
        case rated
        case colorLabelled = "color_labelled"
        case flagged
        case rejected
        case commented
        case hearted
        case uploaded
        case verified
        case failed
        case sessionOpened = "session_opened"
        case sessionClosed = "session_closed"
        case handoffTriggered = "handoff_triggered"
    }

    let id: UUID
    let sessionId: UUID
    let assetId: UUID?
    let actorId: String
    let eventType: EventType
    var metadata: [String: String]
    let createdAt: Date
}
