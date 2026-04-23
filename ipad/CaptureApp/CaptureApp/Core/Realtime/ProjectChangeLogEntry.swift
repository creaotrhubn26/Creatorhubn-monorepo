import Foundation

/// One row from the backend ``project_change_log`` table. Mirrors
/// the ``ProjectChangeLogEntry`` TypeScript interface. Used by the
/// iPad Context panel's timeline + future push-notification bodies.
///
/// ``kind`` is intentionally the same discriminator as
/// ``UserEvent.kind`` on the realtime channel, so both streams can
/// feed the same view without a translation layer.
struct ProjectChangeLogEntry: Equatable, Identifiable, Sendable {
    let id: String
    let projectId: String
    let kind: Kind
    let actorKind: ActorKind
    let actorLabel: String?
    let payload: [String: AnyCodableValue]
    let createdAt: Date

    enum Kind: String, Sendable {
        case assetHearted = "asset.hearted"
        case assetCommented = "asset.commented"
        case quoteSigned = "quote.signed"
        case contractSigned = "contract.signed"
    }

    enum ActorKind: String, Sendable {
        case client
        case photographer
    }

    /// Type-erased JSON value for the free-form ``payload``. We
    /// don't bake every possible shape in here because the set of
    /// event kinds grows; a small Codable enum keeps lookups safe
    /// without lose-history.
    enum AnyCodableValue: Equatable, Sendable {
        case string(String)
        case int(Int)
        case double(Double)
        case bool(Bool)
        case null
    }

    /// Decode a single entry from the JSON body returned by
    /// ``GET /api/projects/:id/change-log``. Entries with unknown
    /// ``kind`` or ``actorKind`` return nil — older iPad builds
    /// shouldn't render garbled rows when the backend gains new
    /// event kinds.
    static func decode(dict raw: [String: Any]) -> ProjectChangeLogEntry? {
        guard let id = raw["id"] as? String, !id.isEmpty,
              let projectId = raw["projectId"] as? String, !projectId.isEmpty,
              let kindRaw = raw["kind"] as? String,
              let kind = Kind(rawValue: kindRaw),
              let actorRaw = raw["actorKind"] as? String,
              let actor = ActorKind(rawValue: actorRaw),
              let createdAt = decodeDate(raw["createdAt"])
        else { return nil }
        let actorLabel = (raw["actorLabel"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        var payload: [String: AnyCodableValue] = [:]
        if let rawPayload = raw["payload"] as? [String: Any] {
            for (k, v) in rawPayload {
                payload[k] = normalize(v)
            }
        }
        return ProjectChangeLogEntry(
            id: id,
            projectId: projectId,
            kind: kind,
            actorKind: actor,
            actorLabel: actorLabel,
            payload: payload,
            createdAt: createdAt,
        )
    }

    static func decode(listJSON data: Data) -> [ProjectChangeLogEntry] {
        guard let obj = try? JSONSerialization.jsonObject(with: data, options: []),
              let root = obj as? [String: Any],
              let entries = root["entries"] as? [[String: Any]]
        else { return [] }
        return entries.compactMap { decode(dict: $0) }
    }

    private static func decodeDate(_ raw: Any?) -> Date? {
        guard let s = raw as? String, !s.isEmpty else { return nil }
        return iso8601Fractional.date(from: s) ?? iso8601Plain.date(from: s)
    }

    // nonisolated(unsafe): ISO8601DateFormatter is thread-safe for
    // read-only ``date(from:)`` after configuration, but isn't
    // marked Sendable. Swift 6 strict-concurrency requires the
    // annotation. Safe because we never mutate after init.
    private nonisolated(unsafe) static let iso8601Fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private nonisolated(unsafe) static let iso8601Plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static func normalize(_ value: Any) -> AnyCodableValue {
        if value is NSNull { return .null }
        switch value {
        case let s as String: return .string(s)
        case let b as Bool: return .bool(b)
        case let n as NSNumber:
            // NSNumber is ambiguous; prefer Int when it round-trips.
            if CFNumberIsFloatType(n) { return .double(n.doubleValue) }
            return .int(n.intValue)
        default: return .null
        }
    }
}

/// One-line summary for UI. Pure, mirrors the server-side
/// ``humanizeChangeLogEntry`` so notification text matches what the
/// timeline shows when the iPad syncs back online.
///
/// Exposed separately so tests pin the exact phrasing the client
/// reads — rewording on the iPad side while the backend version
/// stays old would create two different messages for the same event
/// depending on whether the iPad had fresh network.
enum ProjectChangeLogHumanizer {
    static func humanize(_ entry: ProjectChangeLogEntry) -> String {
        let actor = entry.actorLabel?.trimmingCharacters(in: .whitespaces).nonEmpty
            ?? fallbackActor(entry.actorKind)
        switch entry.kind {
        case .assetHearted:
            let hearted: Bool = {
                if case let .bool(b) = entry.payload["hearted"] { return b }
                return true
            }()
            return hearted
                ? "\(actor) hjertet et bilde"
                : "\(actor) fjernet hjerte fra et bilde"
        case .assetCommented:
            let preview: String = {
                if case let .string(s) = entry.payload["preview"] {
                    return s.trimmingCharacters(in: .whitespaces)
                }
                return ""
            }()
            if preview.isEmpty {
                return "\(actor) la igjen en kommentar"
            }
            return "\(actor) kommenterte: \"\(truncate(preview, max: 80))\""
        case .quoteSigned:
            return "\(actor) signerte tilbudet"
        case .contractSigned:
            return "\(actor) signerte kontrakten"
        }
    }

    private static func fallbackActor(_ kind: ProjectChangeLogEntry.ActorKind) -> String {
        kind == .client ? "Klienten" : "Fotografen"
    }

    private static func truncate(_ s: String, max: Int) -> String {
        guard s.count > max else { return s }
        let slice = s.prefix(max - 1).trimmingCharacters(in: .whitespaces)
        return slice + "…"
    }
}

private extension String {
    /// Trimmed-empty sugar: returns self if non-empty after trim, else nil.
    var nonEmpty: String? {
        let t = trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? nil : t
    }
}
