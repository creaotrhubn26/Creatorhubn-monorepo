// NotificationModel.swift
//
// Varsel-modeller speilet fra web PR #622.

import Foundation

struct NotificationEvent: Identifiable, Decodable, Sendable {
    let id: String
    let eventType: String
    let title: String
    let body: String
    let leadId: String?
    let visitId: String?
    let triggeredByUserId: String?
    let deepLink: String?
    let meta: [String: AnyCodable]?
    let emailSent: Bool
    let apnsSent: Bool
    let readAt: String?
    let createdAt: String

    var isUnread: Bool { readAt == nil }

    /// SF Symbol-navn for event-typen
    var iconName: String {
        switch eventType {
        case "lead_assigned": return "person.badge.plus.fill"
        case "lead_status_changed": return "arrow.triangle.2.circlepath"
        case "lead_won_on_team": return "trophy.fill"
        case "follow_up_due": return "calendar.badge.exclamationmark"
        case "approaching_lead": return "location.circle.fill"
        default: return "bell.fill"
        }
    }

    /// Hex-farge for type
    var colorHex: String {
        switch eventType {
        case "lead_assigned": return "c084fc"
        case "lead_status_changed": return "60a5fa"
        case "lead_won_on_team": return "34d399"
        case "follow_up_due": return "f87171"
        case "approaching_lead": return "fbbf24"
        default: return "9ca3af"
        }
    }
}

struct NotificationFeedResponse: Decodable, Sendable {
    let notifications: [NotificationEvent]
    let unreadCount: Int
}

/// Sendable type-erased wrapper for JSONB-meta. `value` er typed enum,
/// ikke Any — sikrer Sendable-konformitet i Swift 6.
struct AnyCodable: Decodable, Sendable {
    enum Value: Sendable {
        case bool(Bool)
        case int(Int)
        case double(Double)
        case string(String)
        case array([Value])
        case object([String: Value])
        case null
    }
    let value: Value

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self.value = .null
        } else if let b = try? container.decode(Bool.self) {
            self.value = .bool(b)
        } else if let i = try? container.decode(Int.self) {
            self.value = .int(i)
        } else if let d = try? container.decode(Double.self) {
            self.value = .double(d)
        } else if let s = try? container.decode(String.self) {
            self.value = .string(s)
        } else if let arr = try? container.decode([AnyCodable].self) {
            self.value = .array(arr.map(\.value))
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = .object(dict.mapValues(\.value))
        } else {
            self.value = .null
        }
    }
}
