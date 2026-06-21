import Foundation

/// DTOs for the native "Meldinger" (client inbox/chat) surface. These mirror
/// the JSON the Express backend returns for `/api/communication/*`.
///
/// Decoding here is *deliberately very tolerant* — the communication
/// endpoints return varied shapes depending on the conversation provider
/// (internal chat / Google Chat / Gmail / Evendi), the last-message column
/// is sometimes a nested object and sometimes a flat string, and message
/// bodies come back under `text`, `body` *or* `content`. A single missing or
/// renamed field must never fail the whole list, so every field is optional
/// and decoded with `try?` / `decodeIfPresent`, with sensible fallbacks.
///
/// Dates stay raw ISO strings (Postgres timestamps carry microseconds +
/// offset that a strict ISO8601 decoder rejects) — render via ``DashboardDate``.
///
/// All types are `Sendable` so they cross the actor boundary from
/// ``DashboardClient`` into `@MainActor` view models cleanly.

// MARK: - Conversation

struct Conversation: Sendable, Identifiable, Hashable {
    /// Stable id — derived from `channelId` when present, else `id`.
    let id: String
    var channelId: String?
    /// Display name — client/space name.
    var name: String?
    /// Last message preview text (flattened from a string *or* a nested
    /// `{ content/text, timestamp }` object).
    var lastMessage: String?
    /// Conversation provider/type (internal-chat / google-chat / gmail …).
    var provider: String?
    var customerName: String?
    var updatedAt: String?
}

extension Conversation: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, channelId, name
        case lastMessage
        case provider, type
        case customerName, clientName
        case updatedAt, createdAt
    }

    /// Tolerant nested `lastMessage` shapes the backend may emit.
    private struct LastMessageObject: Decodable {
        var content: String?
        var text: String?
        var body: String?
        var message: String?
        var timestamp: String?

        var preview: String? { content ?? text ?? body ?? message }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        // id: prefer channelId, fall back to id (one of them must exist).
        let channel = try? c.decodeIfPresent(String.self, forKey: .channelId)
        let rawId = try? c.decodeIfPresent(String.self, forKey: .id)
        channelId = channel
        id = channel ?? rawId ?? UUID().uuidString

        name = (try? c.decodeIfPresent(String.self, forKey: .name))
            ?? (try? c.decodeIfPresent(String.self, forKey: .clientName)).flatMap { $0 }

        // lastMessage may be a plain string or a nested object — try both.
        if let str = try? c.decodeIfPresent(String.self, forKey: .lastMessage) {
            lastMessage = str
        } else if let obj = try? c.decodeIfPresent(LastMessageObject.self, forKey: .lastMessage) {
            lastMessage = obj.preview
        } else {
            lastMessage = nil
        }

        provider = (try? c.decodeIfPresent(String.self, forKey: .provider))
            ?? (try? c.decodeIfPresent(String.self, forKey: .type)).flatMap { $0 }

        customerName = (try? c.decodeIfPresent(String.self, forKey: .customerName))
            ?? (try? c.decodeIfPresent(String.self, forKey: .clientName)).flatMap { $0 }

        updatedAt = (try? c.decodeIfPresent(String.self, forKey: .updatedAt))
            ?? (try? c.decodeIfPresent(String.self, forKey: .createdAt)).flatMap { $0 }
    }
}

struct ConversationListResponse: Decodable, Sendable {
    let conversations: [Conversation]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        conversations = (try? c.decodeIfPresent([Conversation].self, forKey: .conversations)) ?? []
    }

    private enum CodingKeys: String, CodingKey { case conversations }
}

// MARK: - Chat message

struct ChatMessage: Sendable, Identifiable, Hashable {
    let id: String
    /// Body — accepts `text`, `body` *or* `content`.
    var text: String?
    var senderName: String?
    var senderEmail: String?
    /// Raw ISO timestamp — accepts `timestamp` *or* `createdAt`.
    var timestamp: String?
    /// True when authored by the signed-in photographer (computed by the
    /// client from `senderId` ↔ userId, but the backend may also send it).
    var fromMe: Bool
    /// Attachments — top-level `attachments` or nested under `metadata`.
    var attachments: [MessageAttachment] = []
}

extension ChatMessage: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id
        case text, body, content
        case senderName, senderEmail, senderId
        case timestamp, createdAt
        case fromMe, isMine
        case attachments, metadata
    }

    private struct MetadataBox: Decodable { var attachments: [MessageAttachment]? }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        id = (try? c.decodeIfPresent(String.self, forKey: .id)).flatMap { $0 } ?? UUID().uuidString

        text = (try? c.decodeIfPresent(String.self, forKey: .text))
            ?? (try? c.decodeIfPresent(String.self, forKey: .body)).flatMap { $0 }
            ?? (try? c.decodeIfPresent(String.self, forKey: .content)).flatMap { $0 }

        senderName = (try? c.decodeIfPresent(String.self, forKey: .senderName)).flatMap { $0 }
        senderEmail = (try? c.decodeIfPresent(String.self, forKey: .senderEmail))
            ?? (try? c.decodeIfPresent(String.self, forKey: .senderId)).flatMap { $0 }

        timestamp = (try? c.decodeIfPresent(String.self, forKey: .timestamp))
            ?? (try? c.decodeIfPresent(String.self, forKey: .createdAt)).flatMap { $0 }

        fromMe = (try? c.decodeIfPresent(Bool.self, forKey: .fromMe))
            ?? (try? c.decodeIfPresent(Bool.self, forKey: .isMine)).flatMap { $0 }
            ?? false

        if let top = try? c.decodeIfPresent([MessageAttachment].self, forKey: .attachments) {
            attachments = top
        } else if let meta = try? c.decodeIfPresent(MetadataBox.self, forKey: .metadata), let list = meta.attachments {
            attachments = list
        } else {
            attachments = []
        }
    }
}

struct ChatMessagesResponse: Decodable, Sendable {
    let channelId: String?
    let messages: [ChatMessage]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        channelId = try? c.decodeIfPresent(String.self, forKey: .channelId)
        messages = (try? c.decodeIfPresent([ChatMessage].self, forKey: .messages)) ?? []
    }

    private enum CodingKeys: String, CodingKey { case channelId, messages }
}
