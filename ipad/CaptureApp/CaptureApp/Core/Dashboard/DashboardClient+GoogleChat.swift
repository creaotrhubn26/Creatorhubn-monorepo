import Foundation

/// Google Chat channel endpoints, layered onto ``DashboardClient`` so they
/// share the same actor isolation, Bearer auth and tolerant error mapping as
/// the rest of the dashboard surface.
///
/// Talks to the Express `/api/google/chat/*` routes:
///   GET  /api/google/chat/spaces            — joined spaces
///   GET  /api/google/chat/messages?space=:id — a space's messages
///   POST /api/google/chat/send               — send
extension DashboardClient {
    /// All Google Chat spaces the connected account belongs to.
    func listGoogleChatSpaces() async throws -> [GoogleChatSpace] {
        let resp: GoogleChatSpaceListResponse = try await getJSON(path: "/api/google/chat/spaces")
        return resp.spaces
    }

    /// All messages in a space, oldest → newest.
    func googleChatMessages(space: String) async throws -> [GoogleChatMsg] {
        let encoded = space.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? space
        let resp: GoogleChatMessageListResponse = try await getJSON(
            path: "/api/google/chat/messages?space=\(encoded)",
        )
        return resp.messages
    }

    /// Send a message into a space.
    func sendGoogleChat(space: String, message: String) async throws {
        struct Body: Encodable {
            let space: String
            let message: String
        }
        try await send(
            path: "/api/google/chat/send",
            method: "POST",
            body: Body(space: space, message: message),
        )
    }
}
