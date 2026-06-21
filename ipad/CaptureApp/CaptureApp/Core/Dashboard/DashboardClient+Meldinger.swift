import Foundation

/// Native "Meldinger" (client inbox/chat) endpoints, layered onto
/// ``DashboardClient`` so they share the same actor isolation, Bearer auth
/// and tolerant error mapping as the rest of the dashboard surface.
///
/// Talks to the Express `/api/communication/*` routes:
///   GET  /api/communication/conversations        — inbox
///   GET  /api/communication/messages/:channelId  — a thread
///   POST /api/communication/messages             — send
extension DashboardClient {
    /// Inbox — every conversation the photographer participates in.
    func listConversations() async throws -> [Conversation] {
        var path = "/api/communication/conversations?limit=50"
        if let userId, !userId.isEmpty {
            let encoded = userId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? userId
            path += "&userId=\(encoded)"
        }
        let resp: ConversationListResponse = try await getJSON(path: path)
        return resp.conversations
    }

    /// All messages in a thread, oldest → newest. `fromMe` is resolved
    /// client-side by matching the sender against the signed-in user id when
    /// the backend doesn't flag it directly.
    func messages(channelId: String) async throws -> [ChatMessage] {
        let encoded = channelId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? channelId
        let resp: ChatMessagesResponse = try await getJSON(path: "/api/communication/messages/\(encoded)")
        guard let me = userId, !me.isEmpty else { return resp.messages }
        return resp.messages.map { msg in
            guard !msg.fromMe else { return msg }
            var copy = msg
            if let sender = msg.senderEmail, sender.caseInsensitiveCompare(me) == .orderedSame {
                copy.fromMe = true
            }
            return copy
        }
    }

    /// Send a message into a thread. Posts to `/api/communication/messages`
    /// first (the canonical route); the body carries the field names every
    /// variant of the backend handler accepts (`channelId`/`conversationId`
    /// + `text`/`content`) so a single rename can't drop the send.
    func sendMessage(channelId: String, text: String) async throws {
        struct Body: Encodable {
            let channelId: String
            let conversationId: String
            let text: String
            let content: String
            let userId: String?
        }
        let body = Body(
            channelId: channelId,
            conversationId: channelId,
            text: text,
            content: text,
            userId: userId,
        )
        try await send(path: "/api/communication/messages", method: "POST", body: body)
    }
}
