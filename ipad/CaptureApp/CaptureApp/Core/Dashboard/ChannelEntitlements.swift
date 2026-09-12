import Foundation

/// Probes which external chat channels are reachable for the signed-in
/// photographer so the multi-channel inbox can show/hide channel tabs.
///
/// Each probe is independent and failure-tolerant: a channel that errors,
/// 404s or 401s is simply treated as unavailable rather than failing the whole
/// refresh. `@MainActor @Observable` so SwiftUI can observe the booleans
/// directly; the network work hops to the ``DashboardClient`` actor.
@MainActor
@Observable
final class ChannelAccess {
    var emailConnected: Bool = false
    var googleChatConnected: Bool = false
    var evendiAvailable: Bool = false

    init() {}

    /// Re-probe all channels. Each probe is isolated — one failing channel
    /// never affects the others.
    func refresh() async {
        guard let client = DashboardClient.make() else {
            emailConnected = false
            googleChatConnected = false
            evendiAvailable = false
            return
        }

        // Email / Gmail.
        do {
            emailConnected = try await client.emailStatus()
        } catch {
            emailConnected = false
        }

        // Google Chat.
        do {
            googleChatConnected = try await client.googleChatStatus()
        } catch {
            googleChatConnected = false
        }

        // Evendi has no status endpoint — probe by listing conversations.
        // notFound/unauthorized ⇒ the channel isn't provisioned for this user;
        // any other error (transport hiccup) we treat as unknown-but-present so
        // a transient blip doesn't hide an otherwise-available channel.
        do {
            _ = try await client.listEvendiConversations()
            evendiAvailable = true
        } catch DashboardError.notFound {
            evendiAvailable = false
        } catch DashboardError.unauthorized {
            evendiAvailable = false
        } catch {
            evendiAvailable = true
        }
    }
}

// MARK: - Status endpoints

/// Channel connection-status probes, layered onto ``DashboardClient``.
///
/// Talks to the Express routes:
///   GET /api/communication/email/status        — { connected: Bool }
///   GET /api/communication/google-chat/status   — { connected: Bool }
extension DashboardClient {
    /// `true` when a Gmail account is connected for this user.
    func emailStatus() async throws -> Bool {
        let resp: ChannelStatusResponse = try await getJSON(path: "/api/communication/email/status")
        return resp.connected
    }

    /// `true` when Google Chat is connected for this user.
    func googleChatStatus() async throws -> Bool {
        let resp: ChannelStatusResponse = try await getJSON(path: "/api/communication/google-chat/status")
        return resp.connected
    }
}

/// Tolerant `{ connected }` decode — accepts the boolean as a true bool, a
/// numeric 0/1, or a "true"/"false" string, and defaults to `false`.
struct ChannelStatusResponse: Decodable, Sendable {
    let connected: Bool

    private enum CodingKeys: String, CodingKey {
        case connected, isConnected, is_connected
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        connected = ChannelStatusResponse.decodeFlexibleBool(c, [.connected, .isConnected, .is_connected])
    }

    private static func decodeFlexibleBool(
        _ c: KeyedDecodingContainer<CodingKeys>,
        _ keys: [CodingKeys],
    ) -> Bool {
        for key in keys {
            if let b = try? c.decodeIfPresent(Bool.self, forKey: key) { return b }
            if let i = try? c.decodeIfPresent(Int.self, forKey: key) { return i != 0 }
            if let s = try? c.decodeIfPresent(String.self, forKey: key) {
                return s == "true" || s == "1" || s.lowercased() == "yes"
            }
        }
        return false
    }
}
