import Foundation

/// DTOs for the native Gmail/email channel of the multi-channel chat surface.
/// These mirror the JSON the Express backend returns for
/// `/api/communication/email/*`.
///
/// Decoding is *deliberately very tolerant* — Gmail thread items often arrive
/// as a nested Gmail API structure (snippet under `snippet`, subject buried in
/// headers, counterpart under varied keys) so a single missing or renamed field
/// must never fail the whole list. Every field is optional and decoded with
/// `try?` / `decodeIfPresent`, with sensible fallbacks. Counts/booleans default
/// to 0/false. Dates stay raw ISO strings — render via ``DashboardDate``.
///
/// All types are `Sendable` so they cross the actor boundary from
/// ``DashboardClient`` into `@MainActor` view models cleanly.

// MARK: - Gmail thread

struct GmailThread: Sendable, Identifiable, Hashable {
    /// Stable id — derived from `id`, else `threadId`.
    let id: String
    var threadId: String?
    var subject: String?
    var snippet: String?
    var counterpartName: String?
    var counterpartEmail: String?
    var timestamp: String?
    var unreadCount: Int
    var hasAttachments: Bool
    /// "inbound" / "outbound" when the backend tags it.
    var direction: String?
}

extension GmailThread: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, threadId, thread_id
        case subject
        case snippet, preview, body
        case counterpartName, counterpart_name, fromName, from_name, senderName
        case counterpartEmail, counterpart_email, fromEmail, from_email, senderEmail, from
        case timestamp, createdAt, created_at, date, internalDate
        case unreadCount, unread_count, unread
        case hasAttachments, has_attachments, attachments
        case direction
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        let tid = c.firstString([.threadId, .thread_id])
        threadId = tid
        id = c.firstString([.id]) ?? tid ?? UUID().uuidString
        subject = c.firstString([.subject])
        snippet = c.firstString([.snippet, .preview, .body])
        counterpartName = c.firstString([.counterpartName, .counterpart_name, .fromName, .from_name, .senderName])
        counterpartEmail = c.firstString([.counterpartEmail, .counterpart_email, .fromEmail, .from_email, .senderEmail, .from])
        timestamp = c.firstString([.timestamp, .createdAt, .created_at, .date, .internalDate])
        unreadCount = c.firstInt([.unreadCount, .unread_count, .unread]) ?? 0

        if let b = try? c.decodeIfPresent(Bool.self, forKey: .hasAttachments) {
            hasAttachments = b
        } else if let b = try? c.decodeIfPresent(Bool.self, forKey: .has_attachments) {
            hasAttachments = b
        } else if let arr = try? c.decodeIfPresent([JSONValueIgnored].self, forKey: .attachments) {
            hasAttachments = !arr.isEmpty
        } else {
            hasAttachments = false
        }

        direction = try? c.decodeIfPresent(String.self, forKey: .direction)
    }
}

/// Placeholder used only to test array-presence/length without decoding the
/// element shape (Gmail attachment objects vary widely).
private struct JSONValueIgnored: Decodable {}

struct GmailThreadListResponse: Decodable, Sendable {
    let threads: [GmailThread]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        threads = (try? c.decodeIfPresent([GmailThread].self, forKey: .threads)) ?? []
    }

    private enum CodingKeys: String, CodingKey { case threads }
}

// MARK: - Gmail message

struct GmailMessage: Sendable, Identifiable, Hashable {
    let id: String
    var senderName: String?
    var senderEmail: String?
    var subject: String?
    /// Body — accepts `content`, `body`, `text` *or* `snippet`.
    var content: String?
    var timestamp: String?
    var direction: String?
}

extension GmailMessage: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, messageId, message_id
        case senderName, sender_name, fromName, from_name
        case senderEmail, sender_email, fromEmail, from_email, from
        case subject
        case content, body, text, snippet
        case timestamp, createdAt, created_at, date, internalDate
        case direction
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        id = c.firstString([.id, .messageId, .message_id]) ?? UUID().uuidString
        senderName = c.firstString([.senderName, .sender_name, .fromName, .from_name])
        senderEmail = c.firstString([.senderEmail, .sender_email, .fromEmail, .from_email, .from])
        subject = c.firstString([.subject])
        content = c.firstString([.content, .body, .text, .snippet])
        timestamp = c.firstString([.timestamp, .createdAt, .created_at, .date, .internalDate])
        direction = c.firstString([.direction])
    }
}

struct GmailMessageListResponse: Decodable, Sendable {
    let messages: [GmailMessage]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        messages = (try? c.decodeIfPresent([GmailMessage].self, forKey: .messages)) ?? []
    }

    private enum CodingKeys: String, CodingKey { case messages }
}
