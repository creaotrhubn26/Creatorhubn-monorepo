import Foundation

/// Gmail/email channel endpoints, layered onto ``DashboardClient`` so they
/// share the same actor isolation, Bearer auth and tolerant error mapping as
/// the rest of the dashboard surface.
///
/// Talks to the Express `/api/communication/email/*` routes:
///   GET  /api/communication/email/threads?limit=30[&search=]  — inbox
///   GET  /api/communication/email/messages?threadId=:id        — a thread
///   POST /api/communication/email/reply                        — reply
///   POST /api/communication/email/send                         — new mail
extension DashboardClient {
    /// Inbox — recent email threads, optionally filtered by `search`.
    func listEmailThreads(search: String?) async throws -> [GmailThread] {
        var path = "/api/communication/email/threads?limit=30"
        if let search, !search.trimmingCharacters(in: .whitespaces).isEmpty {
            let encoded = search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? search
            path += "&search=\(encoded)"
        }
        let resp: GmailThreadListResponse = try await getJSON(path: path)
        return resp.threads
    }

    /// All messages in a Gmail thread.
    func emailThreadMessages(threadId: String) async throws -> [GmailMessage] {
        let encoded = threadId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? threadId
        let resp: GmailMessageListResponse = try await getJSON(
            path: "/api/communication/email/messages?threadId=\(encoded)",
        )
        return resp.messages
    }

    /// Reply into an existing thread.
    func replyEmail(threadId: String, message: String) async throws {
        struct Body: Encodable {
            let threadId: String
            let message: String
        }
        try await send(
            path: "/api/communication/email/reply",
            method: "POST",
            body: Body(threadId: threadId, message: message),
        )
    }

    /// Compose + send a brand-new email.
    func sendEmail(to: String, subject: String, message: String) async throws {
        struct Body: Encodable {
            let to: String
            let subject: String
            let message: String
        }
        try await send(
            path: "/api/communication/email/send",
            method: "POST",
            body: Body(to: to, subject: subject, message: message),
        )
    }
}
