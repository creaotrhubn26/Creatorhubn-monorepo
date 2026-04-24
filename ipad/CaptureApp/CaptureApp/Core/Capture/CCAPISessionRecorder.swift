import Foundation

/// Records every CCAPI HTTP round-trip to a JSONL file for later
/// replay against a non-Canon adapter (Sony / Fuji / Nikon). Opt-in
/// per session — toggled via the ``--record-session`` launch argument
/// or from a debug surface.
///
/// The log is deliberately kept at the HTTP level (method, path, body,
/// status, response JSON) rather than at the typed-method level, so a
/// future adapter can be validated by *replaying the HTTP transcript*:
/// feed the same recorded responses to a mock URLSession, run the new
/// adapter against it, assert that it issues equivalent requests + ends
/// up in equivalent state.
///
/// Privacy: we record paths + bodies + raw JSON responses. This DOES
/// include camera serial + owner-name (from `/ccapi/ver100/deviceinformation`)
/// and captured-file paths (but never image bytes). Users are asked to
/// opt in explicitly before a session begins, and logs land in
/// ``Documents/CreatorHubSessions/`` so they're visible in the Files app
/// and can be inspected / pruned before sharing.
actor CCAPISessionRecorder {
    static let shared = CCAPISessionRecorder()

    private(set) var isActive: Bool = false

    /// URL of the currently-writing JSONL file. Nil when idle.
    private(set) var currentFileURL: URL?

    private var fileHandle: FileHandle?
    private var sessionStartedAt: Date?

    /// Monotonically-increasing sequence number across events in the
    /// current session — replay-driver uses it to detect log gaps.
    private var sequence: Int = 0

    // MARK: - Lifecycle

    /// Start a new recording. Returns the URL of the file that will be
    /// written to. Throws if writing fails (disk full, no Documents
    /// access, etc.).
    @discardableResult
    func start(label: String? = nil) throws -> URL {
        try stopLocked()

        let documents = try FileManager.default.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true,
        )
        let dir = documents.appendingPathComponent("CreatorHubSessions", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let timestamp = ISO8601DateFormatter().string(from: Date())
            .replacingOccurrences(of: ":", with: "-")
        let base = label.map { "\(timestamp)-\($0)" } ?? timestamp
        let file = dir.appendingPathComponent("\(base).jsonl")

        FileManager.default.createFile(atPath: file.path, contents: nil)
        let handle = try FileHandle(forWritingTo: file)

        self.fileHandle = handle
        self.currentFileURL = file
        self.sessionStartedAt = Date()
        self.sequence = 0
        self.isActive = true

        // Write a session-preamble line with device + app context. Helps
        // replay-side figure out what iOS version + app build produced
        // this log.
        let preamble = SessionPreamble(
            startedAt: ISO8601DateFormatter().string(from: Date()),
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
            appBuild: Bundle.main.infoDictionary?["CFBundleVersion"] as? String,
            label: label,
        )
        try writeLine(preamble)

        return file
    }

    /// Stop recording and flush the file. Returns the file URL for the
    /// caller's convenience (e.g. to present a share sheet).
    @discardableResult
    func stop() -> URL? {
        try? stopLocked()
        return nil // URL is nil after stop — caller should stash it earlier.
    }

    private func stopLocked() throws {
        if let handle = fileHandle {
            try? handle.synchronize()
            try? handle.close()
        }
        fileHandle = nil
        sessionStartedAt = nil
        isActive = false
        // Keep currentFileURL set until next start() so callers can still
        // read it after stop — matches the Meta/Stripe playwright-state
        // contract elsewhere in the tree.
    }

    // MARK: - Recording entry points

    /// Record a request/response pair. Call after the HTTP round-trip
    /// completes. ``durationMs`` is wall-clock from request start to
    /// response received — replay can use it to pace responses.
    func recordHTTP(
        method: String,
        relativePath: String,
        requestBody: Data?,
        statusCode: Int,
        responseBody: Data?,
        durationMs: Double,
    ) {
        guard isActive else { return }
        let entry = HTTPEntry(
            kind: .http,
            seq: nextSeq(),
            dt: secondsSinceStart(),
            at: ISO8601DateFormatter().string(from: Date()),
            method: method,
            path: relativePath,
            request: requestBody.map(decodeJSONOrTruncate),
            status: statusCode,
            response: responseBody.map(decodeJSONOrTruncate),
            durationMs: durationMs,
        )
        try? writeLine(entry)
    }

    /// Record an error encountered during a request. Replay-drivers
    /// inject the same error shape at the corresponding sequence point.
    func recordError(
        method: String,
        relativePath: String,
        error: String,
    ) {
        guard isActive else { return }
        let entry = ErrorEntry(
            kind: .error,
            seq: nextSeq(),
            dt: secondsSinceStart(),
            at: ISO8601DateFormatter().string(from: Date()),
            method: method,
            path: relativePath,
            error: error,
        )
        try? writeLine(entry)
    }

    /// Record a narrative event — "session connected", "photographer
    /// triggered shutter", "user disconnected" — so the replay context
    /// makes sense without having to reverse-engineer from HTTP.
    func recordEvent(_ name: String, note: String? = nil) {
        guard isActive else { return }
        let entry = NarrativeEntry(
            kind: .event,
            seq: nextSeq(),
            dt: secondsSinceStart(),
            at: ISO8601DateFormatter().string(from: Date()),
            name: name,
            note: note,
        )
        try? writeLine(entry)
    }

    // MARK: - Internal helpers

    private func nextSeq() -> Int { sequence += 1; return sequence }

    private func secondsSinceStart() -> Double {
        guard let start = sessionStartedAt else { return 0 }
        return Date().timeIntervalSince(start)
    }

    private func writeLine<T: Encodable>(_ entry: T) throws {
        guard let handle = fileHandle else { return }
        let encoder = JSONEncoder()
        // Compact one-entry-per-line is the whole point of JSONL —
        // pretty-printing would break the line-split parsing on the
        // replay side.
        encoder.outputFormatting = []
        var data = try encoder.encode(entry)
        data.append(0x0A) // newline
        try handle.write(contentsOf: data)
    }

    /// If the body is valid JSON, decode to a generic structure so it
    /// pretty-prints in the JSONL file. If not, truncate to the first
    /// 1 KB and wrap as a string — keeps log sizes sane on long
    /// live-view fetches that return non-JSON blobs.
    private func decodeJSONOrTruncate(_ data: Data) -> LoggedBody {
        // Empty → explicit null
        guard !data.isEmpty else { return .empty }
        // Try JSON
        if let obj = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]),
           JSONSerialization.isValidJSONObject(obj) || obj is String || obj is NSNumber {
            // Re-encode via Encodable path so the outer `writeLine`
            // serialisation sees the structure, not Data.
            return .json(AnyCodable(obj))
        }
        let clamped = data.prefix(1024)
        let text = String(data: clamped, encoding: .utf8) ?? "<\(data.count) bytes binary>"
        return .text(text + (data.count > clamped.count ? "…(truncated)" : ""))
    }
}

// MARK: - JSONL entry types

/// Every line in the JSONL file decodes to one of these shapes.
/// ``kind`` is the discriminator for replay-side routing.
private enum EntryKind: String, Codable {
    case preamble, http, error, event
}

private struct SessionPreamble: Encodable {
    let kind: EntryKind = .preamble
    let startedAt: String
    let appVersion: String?
    let appBuild: String?
    let label: String?
}

private struct HTTPEntry: Encodable {
    let kind: EntryKind
    let seq: Int
    let dt: Double
    let at: String
    let method: String
    let path: String
    let request: LoggedBody?
    let status: Int
    let response: LoggedBody?
    let durationMs: Double
}

private struct ErrorEntry: Encodable {
    let kind: EntryKind
    let seq: Int
    let dt: Double
    let at: String
    let method: String
    let path: String
    let error: String
}

private struct NarrativeEntry: Encodable {
    let kind: EntryKind
    let seq: Int
    let dt: Double
    let at: String
    let name: String
    let note: String?
}

/// Discriminated union for request/response bodies so JSONL consumers
/// can distinguish "valid JSON" from "opaque blob we truncated".
private enum LoggedBody: Encodable {
    case empty
    case json(AnyCodable)
    case text(String)

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .empty:           try container.encodeNil()
        case .json(let value): try container.encode(value)
        case .text(let value): try container.encode(value)
        }
    }
}

/// Minimal Any-coding shim — good enough to write JSON back out after
/// we decoded it via JSONSerialization. Not general-purpose; purpose-
/// built for ``LoggedBody.json``.
private struct AnyCodable: Encodable {
    let value: Any
    init(_ value: Any) { self.value = value }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case is NSNull: try container.encodeNil()
        case let bool as Bool:         try container.encode(bool)
        case let int as Int:           try container.encode(int)
        case let double as Double:     try container.encode(double)
        case let string as String:     try container.encode(string)
        case let array as [Any]:       try container.encode(array.map(AnyCodable.init))
        case let dict as [String: Any]:
            var d = encoder.container(keyedBy: StringKey.self)
            for (k, v) in dict {
                try d.encode(AnyCodable(v), forKey: StringKey(stringValue: k)!)
            }
        default:
            try container.encode(String(describing: value))
        }
    }
    private struct StringKey: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { nil }
    }
}
