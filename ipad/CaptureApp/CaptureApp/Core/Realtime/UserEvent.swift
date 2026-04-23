import Foundation

/// Decoded realtime events the backend pushes over the user-scoped
/// WebSocket at ``/api/ipad/ws/events``. The backend emits a
/// discriminated union on ``kind``; decoding here keeps the contract
/// narrow so a UI observer can exhaustively switch without stringly
/// matching.
///
/// Unknown kinds decode to ``.unknown`` rather than failing. That
/// lets older iPad builds stay connected when the backend adds a
/// new event kind — the frame is simply ignored.
enum UserEvent: Equatable {
    case assetHearted(AssetHearted)
    case assetCommented(AssetCommented)
    case quoteSigned(Signed)
    case contractSigned(Signed)
    case unknown(kind: String)

    struct AssetHearted: Equatable {
        let assetId: String
        let sessionId: String
        let clientName: String?
        let hearted: Bool
        let timestamp: Date
    }

    struct AssetCommented: Equatable {
        let assetId: String
        let sessionId: String
        let clientName: String?
        let preview: String
        let timestamp: Date
    }

    struct Signed: Equatable {
        /// ``quoteId`` or ``contractId`` — the backend uses a
        /// kind-specific field, but at the iPad side we treat them
        /// uniformly as "a document got signed".
        let documentId: String
        let clientName: String?
        let signerKind: SignerKind
        let timestamp: Date
    }

    enum SignerKind: String, Equatable {
        case client
        case photographer
    }

    /// Decode the on-the-wire frame:
    ///   { type: "user_event", event: { kind, ... }, serverTime }
    /// Returns nil for malformed frames or non-user-event types.
    /// The ``connection_established`` frame is intentionally filtered
    /// out here — it's useful for logging but not a user event.
    static func decode(frame: Any) -> UserEvent? {
        guard let dict = frame as? [String: Any] else { return nil }
        guard (dict["type"] as? String) == "user_event" else { return nil }
        guard let event = dict["event"] as? [String: Any] else { return nil }
        guard let kind = event["kind"] as? String, !kind.isEmpty else { return nil }
        switch kind {
        case "asset.hearted":
            guard let a = event["assetId"] as? String, !a.isEmpty,
                  let s = event["sessionId"] as? String, !s.isEmpty,
                  let hearted = event["hearted"] as? Bool,
                  let ts = decodeTimestamp(event["timestamp"])
            else { return nil }
            return .assetHearted(.init(
                assetId: a,
                sessionId: s,
                clientName: (event["clientName"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                hearted: hearted,
                timestamp: ts,
            ))
        case "asset.commented":
            guard let a = event["assetId"] as? String, !a.isEmpty,
                  let s = event["sessionId"] as? String, !s.isEmpty,
                  let preview = event["preview"] as? String,
                  let ts = decodeTimestamp(event["timestamp"])
            else { return nil }
            return .assetCommented(.init(
                assetId: a,
                sessionId: s,
                clientName: (event["clientName"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                preview: preview,
                timestamp: ts,
            ))
        case "quote.signed":
            guard let id = event["quoteId"] as? String, !id.isEmpty,
                  let signer = decodeSignerKind(event["signerKind"]),
                  let ts = decodeTimestamp(event["timestamp"])
            else { return nil }
            return .quoteSigned(.init(
                documentId: id,
                clientName: (event["clientName"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                signerKind: signer,
                timestamp: ts,
            ))
        case "contract.signed":
            guard let id = event["contractId"] as? String, !id.isEmpty,
                  let signer = decodeSignerKind(event["signerKind"]),
                  let ts = decodeTimestamp(event["timestamp"])
            else { return nil }
            return .contractSigned(.init(
                documentId: id,
                clientName: (event["clientName"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                signerKind: signer,
                timestamp: ts,
            ))
        default:
            return .unknown(kind: kind)
        }
    }

    /// Decode JSON text directly. Swallows JSON errors so the caller
    /// doesn't have to wrap every read in a try.
    static func decode(jsonText: String) -> UserEvent? {
        guard let data = jsonText.data(using: .utf8) else { return nil }
        let object: Any
        do {
            object = try JSONSerialization.jsonObject(with: data, options: [])
        } catch {
            return nil
        }
        return decode(frame: object)
    }

    // MARK: - Private helpers

    private static func decodeTimestamp(_ raw: Any?) -> Date? {
        guard let s = raw as? String, !s.isEmpty else { return nil }
        return iso8601Formatter.date(from: s)
            ?? iso8601PlainFormatter.date(from: s)
    }

    private static func decodeSignerKind(_ raw: Any?) -> SignerKind? {
        guard let s = raw as? String else { return nil }
        return SignerKind(rawValue: s)
    }

    /// Two formatters: one permissive of fractional seconds, one
    /// for the plain ``YYYY-MM-DDTHH:MM:SSZ`` shape Node emits from
    /// ``new Date().toISOString()``. Reusing a single formatter per
    /// variant avoids per-message allocation.
    ///
    /// ``nonisolated(unsafe)``: ISO8601DateFormatter is documented
    /// thread-safe for ``date(from:)`` reads after initial setup,
    /// but isn't marked ``Sendable``. Swift 6 strict-concurrency
    /// mode forces the annotation — safe here because we never
    /// mutate the formatter after the closure that constructs it.
    private nonisolated(unsafe) static let iso8601Formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private nonisolated(unsafe) static let iso8601PlainFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
