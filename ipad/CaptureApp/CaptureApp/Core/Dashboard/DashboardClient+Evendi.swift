import Foundation

/// Evendi channel endpoints (wedding-vendor ↔ couple messaging), layered onto
/// ``DashboardClient`` so they share the same actor isolation, Bearer auth and
/// tolerant error mapping as the rest of the dashboard surface.
///
/// Talks to the Express `/api/evendi/conversations*` routes:
///   GET  /api/evendi/conversations                  — inbox
///   GET  /api/evendi/conversations/:id/messages     — a thread
///   POST /api/evendi/conversations/:id/messages     — send
extension DashboardClient {
    /// Inbox — every Evendi conversation for the connected vendor.
    func listEvendiConversations() async throws -> [EvendiConversation] {
        let resp: EvendiConversationListResponse = try await getJSON(path: "/api/evendi/conversations")
        return resp.conversations
    }

    /// All messages in an Evendi conversation, oldest → newest.
    func evendiMessages(conversationId: String) async throws -> [EvendiMessage] {
        let encoded = conversationId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? conversationId
        let resp: EvendiMessageListResponse = try await getJSON(
            path: "/api/evendi/conversations/\(encoded)/messages",
        )
        return resp.messages
    }

    /// Send a message into an Evendi conversation.
    func sendEvendi(conversationId: String, message: String) async throws {
        let encoded = conversationId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? conversationId
        struct Body: Encodable { let message: String }
        try await send(
            path: "/api/evendi/conversations/\(encoded)/messages",
            method: "POST",
            body: Body(message: message),
        )
    }
}
