import Foundation

// DTOs for the native Google Chat channel of the multi-channel chat surface.
// These mirror the JSON the Express backend returns for `/api/google/chat/*`.
//
// Decoding is *deliberately very tolerant* — Google Chat space items carry a
// resource `name`, a human `displayName`, and a nested `spaceDetails.description`,
// any of which may be missing. A single renamed/absent field must never fail
// the whole list, so every field is optional and decoded with `try?` /
// `decodeIfPresent` with fallbacks. Dates stay raw ISO strings — render via
// ``DashboardDate``.
//
// All types are `Sendable` so they cross the actor boundary from
// ``DashboardClient`` into `@MainActor` view models cleanly.

// MARK: - Google Chat space

struct GoogleChatSpace: Sendable, Identifiable, Hashable {
    /// Stable id — the space resource `name` (e.g. "spaces/AAAA").
    let id: String
    /// Human label — prefers `displayName`, falls back to the resource name.
    var name: String?
    var description: String?
    var memberCount: Int?
}

extension GoogleChatSpace: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, name, spaceId, space_id
        case displayName, display_name
        case description
        case spaceDetails, space_details
        case memberCount, member_count, membersCount
    }

    private struct SpaceDetails: Decodable {
        var description: String?
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        let resourceName = c.firstString([.name])
        id = c.firstString([.id, .spaceId, .space_id]) ?? resourceName ?? UUID().uuidString
        name = c.firstString([.displayName, .display_name]) ?? resourceName

        if let d = try? c.decodeIfPresent(String.self, forKey: .description) {
            description = d
        } else if let details = try? c.decodeIfPresent(SpaceDetails.self, forKey: .spaceDetails) {
            description = details.description
        } else if let details = try? c.decodeIfPresent(SpaceDetails.self, forKey: .space_details) {
            description = details.description
        } else {
            description = nil
        }

        memberCount = c.firstInt([.memberCount, .member_count, .membersCount])
    }
}

struct GoogleChatSpaceListResponse: Decodable, Sendable {
    let spaces: [GoogleChatSpace]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        spaces = (try? c.decodeIfPresent([GoogleChatSpace].self, forKey: .spaces)) ?? []
    }

    private enum CodingKeys: String, CodingKey { case spaces }
}

// MARK: - Google Chat message

struct GoogleChatMsg: Sendable, Identifiable, Hashable {
    let id: String
    var senderName: String?
    /// Body — accepts `content`, `text` *or* `body`.
    var content: String?
    var timestamp: String?
}

extension GoogleChatMsg: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, name
        case senderName, sender_name, sender
        case content, text, body
        case timestamp, createdAt, created_at, createTime, create_time
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        id = c.firstString([.id, .name]) ?? UUID().uuidString
        senderName = c.firstString([.senderName, .sender_name, .sender])
        content = c.firstString([.content, .text, .body])
        timestamp = c.firstString([.timestamp, .createdAt, .created_at, .createTime, .create_time])
    }
}

struct GoogleChatMessageListResponse: Decodable, Sendable {
    let messages: [GoogleChatMsg]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        messages = (try? c.decodeIfPresent([GoogleChatMsg].self, forKey: .messages)) ?? []
    }

    private enum CodingKeys: String, CodingKey { case messages }
}
