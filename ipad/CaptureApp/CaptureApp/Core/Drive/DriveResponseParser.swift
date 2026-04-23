import Foundation

/// Pure Drive-v3 response parser. Paired with ``DriveRequestBuilder``
/// so the two-halves of every Drive call are testable without
/// mocking URLSession.
///
/// Parser contract:
///   * Returns typed structs on a successful decode.
///   * Returns nil rather than throwing when the payload is missing
///     expected fields. Call sites decide whether that's a retry or
///     a hard failure based on the HTTP status.
///   * Never logs — logging is the caller's concern.
enum DriveResponseParser {

    // MARK: - Metadata

    /// Parse a single Drive file metadata payload:
    ///   { id, name, mimeType, size?, webViewLink? }
    /// ``size`` is a string in Drive's JSON (Drive serialises int64
    /// as a decimal string to avoid JS precision loss). We tolerate
    /// both the string and numeric shape so a future Drive refactor
    /// doesn't break us.
    static func parseFile(_ data: Data) -> DriveFile? {
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let dict = object as? [String: Any]
        else { return nil }
        return parseFile(dict: dict)
    }

    static func parseFile(dict: [String: Any]) -> DriveFile? {
        guard let id = dict["id"] as? String, !id.isEmpty,
              let name = dict["name"] as? String,
              let mime = dict["mimeType"] as? String
        else { return nil }
        let size: Int64? = {
            if let s = dict["size"] as? String { return Int64(s) }
            if let n = dict["size"] as? NSNumber { return n.int64Value }
            return nil
        }()
        let link: URL? = {
            if let s = dict["webViewLink"] as? String, !s.isEmpty {
                return URL(string: s)
            }
            return nil
        }()
        return DriveFile(id: id, name: name, mimeType: mime, size: size, webViewLink: link)
    }

    /// Parse a search response: { files: [ { ... } ] }. Returns an
    /// empty array on malformed input rather than nil so the caller
    /// can treat "no hits" and "garbled response" identically (Drive
    /// never returns a partial list — it's all-or-nothing).
    static func parseFileList(_ data: Data) -> [DriveFile] {
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let dict = object as? [String: Any],
              let files = dict["files"] as? [[String: Any]]
        else { return [] }
        return files.compactMap { parseFile(dict: $0) }
    }

    // MARK: - Resumable session

    /// Extract the session URL from the initial resumable-upload
    /// response. Drive returns 200 OK with a ``Location`` header;
    /// subsequent chunks go to that URL. Header lookup is
    /// case-insensitive because URLSession can normalise header
    /// casing differently across iOS versions.
    static func parseResumableSessionURL(
        from response: HTTPURLResponse,
    ) -> URL? {
        let candidate = headerValue(response: response, name: "Location")
            ?? headerValue(response: response, name: "location")
            ?? headerValue(response: response, name: "X-GUploader-UploadID").map { _ in nil as String? ?? nil } ?? nil
        guard let value = candidate, !value.isEmpty else { return nil }
        return URL(string: value)
    }

    /// Parse a 308-Resume-Incomplete response's ``Range`` header to
    /// figure out how many bytes Drive already has. The header shape
    /// is ``bytes=0-<last>`` where ``last`` is the inclusive index
    /// of the final received byte. Drive may also omit the header
    /// entirely if no bytes were received — in that case we return
    /// nextByte = 0 so the client restarts from the top.
    static func parseChunkProgress(
        from response: HTTPURLResponse,
    ) -> DriveChunkProgress {
        guard let raw =
            headerValue(response: response, name: "Range")
            ?? headerValue(response: response, name: "range")
        else {
            // Drive confirmed nothing yet — client should send from 0.
            return DriveChunkProgress(lastByteReceived: -1)
        }
        // ``bytes=0-<last>`` — strip prefix, split on dash.
        let stripped = raw
            .replacingOccurrences(of: "bytes=", with: "")
            .trimmingCharacters(in: .whitespaces)
        let parts = stripped.split(separator: "-")
        guard parts.count == 2, let last = Int64(parts[1]) else {
            return DriveChunkProgress(lastByteReceived: -1)
        }
        return DriveChunkProgress(lastByteReceived: last)
    }

    // MARK: - Error

    /// Drive errors are shaped as
    /// ``{ "error": { "code": 401, "message": "...", "errors": [...] } }``
    /// — pull the message so the call site can surface it.
    static func parseErrorMessage(_ data: Data) -> String? {
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let dict = object as? [String: Any],
              let error = dict["error"] as? [String: Any],
              let message = error["message"] as? String, !message.isEmpty
        else { return nil }
        return message
    }

    // MARK: - Private

    private static func headerValue(response: HTTPURLResponse, name: String) -> String? {
        // iOS 13+: value(forHTTPHeaderField:) is case-insensitive.
        // Double-check by also walking allHeaderFields for exact
        // matches so an old iOS that didn't normalise can't leave
        // us dropping a header silently.
        if let direct = response.value(forHTTPHeaderField: name), !direct.isEmpty {
            return direct
        }
        for (key, value) in response.allHeaderFields {
            if let keyString = key as? String,
               keyString.caseInsensitiveCompare(name) == .orderedSame,
               let valueString = value as? String
            {
                return valueString
            }
        }
        return nil
    }
}
