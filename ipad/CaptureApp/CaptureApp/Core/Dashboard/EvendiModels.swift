import Foundation

// DTOs for the native Evendi channel (wedding-vendor ↔ couple messaging) of
// the multi-channel chat surface. These mirror the JSON the Express backend
// returns for `/api/evendi/conversations/*`.
//
// Decoding is *deliberately very tolerant* — Evendi rows come straight off
// Postgres in snake_case (`couple_name`, `last_message_at`,
// `vendor_unread_count`, `sender_type`) but a camelCase variant may also
// appear. Every field is optional and decoded with `try?` / `decodeIfPresent`
// with both-case fallbacks. Dates stay raw ISO strings — render via
// ``DashboardDate``.
//
// All types are `Sendable` so they cross the actor boundary from
// ``DashboardClient`` into `@MainActor` view models cleanly.

// MARK: - Evendi conversation

struct EvendiConversation: Sendable, Identifiable, Hashable {
    let id: String
    var coupleName: String?
    var lastMessage: String?
    var lastMessageAt: String?
    var vendorUnreadCount: Int?
}

extension EvendiConversation: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id
        case coupleName, couple_name
        case lastMessage, last_message
        case lastMessageAt, last_message_at
        case vendorUnreadCount, vendor_unread_count
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        id = c.firstString([.id]) ?? UUID().uuidString
        coupleName = c.firstString([.coupleName, .couple_name])
        lastMessage = c.firstString([.lastMessage, .last_message])
        lastMessageAt = c.firstString([.lastMessageAt, .last_message_at])
        vendorUnreadCount = c.firstInt([.vendorUnreadCount, .vendor_unread_count])
    }
}

struct EvendiConversationListResponse: Decodable, Sendable {
    let conversations: [EvendiConversation]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        conversations = (try? c.decodeIfPresent([EvendiConversation].self, forKey: .conversations)) ?? []
    }

    private enum CodingKeys: String, CodingKey { case conversations }
}

// MARK: - Evendi message

struct EvendiMessage: Sendable, Identifiable, Hashable {
    let id: String
    var body: String?
    var createdAt: String?
    /// "vendor" | "couple".
    var senderType: String?
}

extension EvendiMessage: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id
        case body, content, text, message
        case createdAt, created_at
        case senderType, sender_type
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        id = c.firstString([.id]) ?? UUID().uuidString
        body = c.firstString([.body, .content, .text, .message])
        createdAt = c.firstString([.createdAt, .created_at])
        senderType = c.firstString([.senderType, .sender_type])
    }
}

struct EvendiMessageListResponse: Decodable, Sendable {
    let messages: [EvendiMessage]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        messages = (try? c.decodeIfPresent([EvendiMessage].self, forKey: .messages)) ?? []
    }

    private enum CodingKeys: String, CodingKey { case messages }
}
