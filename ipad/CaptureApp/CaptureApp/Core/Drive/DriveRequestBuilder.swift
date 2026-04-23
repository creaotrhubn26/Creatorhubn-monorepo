import Foundation

/// Pure URLRequest builders for the Google Drive v3 REST API. Every
/// method returns a ready-to-execute request without touching the
/// network — lets us unit-test the URL shapes + header contract
/// without mocking URLSession.
///
/// Endpoints we hit:
///   * GET /drive/v3/files — list folder contents, search for a
///     named folder by parent + name.
///   * POST /drive/v3/files — create a folder.
///   * POST /upload/drive/v3/files?uploadType=resumable —
///     initiates a resumable upload; response Location header is
///     the URL for subsequent PUT chunks.
///   * PUT <session URL> — append a chunk (Content-Range header
///     identifies the byte slice being sent).
///   * POST /upload/drive/v3/files?uploadType=multipart — small
///     inline upload (≤5 MB). Used for JPEG previews where latency
///     dominates over throughput.
enum DriveRequestBuilder {

    /// Override for tests so we can assert the full URL + redirect
    /// against a fixed base. Production use should stick with the
    /// defaults.
    struct Endpoints {
        var metadata: URL
        var upload: URL

        static let production = Endpoints(
            metadata: URL(string: "https://www.googleapis.com/drive/v3")!,
            upload: URL(string: "https://www.googleapis.com/upload/drive/v3")!,
        )
    }

    // MARK: - Folder ops

    /// Search for a folder by exact name under a parent. Returns a
    /// request that yields a list with 0 or 1 items — we key folder
    /// identity on (parent, name) so re-runs are idempotent.
    ///
    /// Drive's search syntax escapes `'` as `\\'`. We lean on a
    /// dedicated escaper so callers with apostrophes in project
    /// names ("Bea's bryllup") don't create a query-injection hole.
    static func findFolder(
        parentId: String,
        name: String,
        accessToken: String,
        endpoints: Endpoints = .production,
    ) -> URLRequest {
        let query =
            "'\(escapeQueryLiteral(parentId))' in parents and " +
            "name = '\(escapeQueryLiteral(name))' and " +
            "mimeType = '\(DriveFile.folderMimeType)' and trashed = false"
        var components = URLComponents(
            url: endpoints.metadata.appendingPathComponent("files"),
            resolvingAgainstBaseURL: true,
        )!
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "fields", value: "files(id,name,mimeType,size,webViewLink)"),
            URLQueryItem(name: "pageSize", value: "1"),
            // Required for shared-drive-aware querying; Drive returns
            // an empty list instead of a 400 otherwise.
            URLQueryItem(name: "supportsAllDrives", value: "true"),
            URLQueryItem(name: "includeItemsFromAllDrives", value: "true"),
        ]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        return request
    }

    /// Create a folder under ``parentId`` with the given name.
    static func createFolder(
        parentId: String,
        name: String,
        accessToken: String,
        endpoints: Endpoints = .production,
    ) -> URLRequest {
        let body: [String: Any] = [
            "name": name,
            "mimeType": DriveFile.folderMimeType,
            "parents": [parentId],
        ]
        var components = URLComponents(
            url: endpoints.metadata.appendingPathComponent("files"),
            resolvingAgainstBaseURL: true,
        )!
        components.queryItems = [
            URLQueryItem(name: "fields", value: "id,name,mimeType,size,webViewLink"),
            URLQueryItem(name: "supportsAllDrives", value: "true"),
        ]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return request
    }

    // MARK: - Uploads

    /// Kick off a resumable upload. Drive returns a 200 with a
    /// ``Location`` header; the adapter wraps that URL as a
    /// ``DriveResumableSession``.
    ///
    /// Content-Length MUST be the metadata JSON size. The first PUT
    /// then carries the actual bytes. We also set
    /// ``X-Upload-Content-Length`` so Drive pre-allocates correctly
    /// — without it Drive still accepts but chunks get a 503 on
    /// some backends.
    static func startResumableUpload(
        parentId: String,
        name: String,
        mimeType: String,
        totalBytes: Int64,
        accessToken: String,
        endpoints: Endpoints = .production,
    ) -> URLRequest {
        let body: [String: Any] = [
            "name": name,
            "mimeType": mimeType,
            "parents": [parentId],
        ]
        var components = URLComponents(
            url: endpoints.upload.appendingPathComponent("files"),
            resolvingAgainstBaseURL: true,
        )!
        components.queryItems = [
            URLQueryItem(name: "uploadType", value: "resumable"),
            URLQueryItem(name: "supportsAllDrives", value: "true"),
            URLQueryItem(name: "fields", value: "id,name,mimeType,size,webViewLink"),
        ]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json; charset=UTF-8", forHTTPHeaderField: "Content-Type")
        request.setValue(mimeType, forHTTPHeaderField: "X-Upload-Content-Type")
        request.setValue(String(totalBytes), forHTTPHeaderField: "X-Upload-Content-Length")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return request
    }

    /// Append a chunk to an in-flight resumable upload. ``range`` is
    /// the half-open byte slice in the original file the chunk
    /// covers, ``totalBytes`` is the final file size — both are
    /// required so Drive can reassemble and validate at commit time.
    ///
    /// Drive expects inclusive Content-Range: ``bytes START-END/TOTAL``.
    /// A chunk of 0..<N becomes ``bytes 0-(N-1)/TOTAL``.
    static func appendChunk(
        sessionURL: URL,
        startByte: Int64,
        chunkLength: Int64,
        totalBytes: Int64,
        mimeType: String,
    ) -> URLRequest {
        let endByte = startByte + chunkLength - 1
        let contentRange = "bytes \(startByte)-\(endByte)/\(totalBytes)"
        var request = URLRequest(url: sessionURL)
        request.httpMethod = "PUT"
        request.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        request.setValue(String(chunkLength), forHTTPHeaderField: "Content-Length")
        request.setValue(contentRange, forHTTPHeaderField: "Content-Range")
        return request
    }

    /// Query how many bytes Drive already has for a paused resumable
    /// upload. Use when retrying after a crash or network drop —
    /// Drive responds 308 with ``Range: bytes=0-<last>`` and we
    /// resume at ``last + 1``.
    static func queryResumableStatus(
        sessionURL: URL,
        totalBytes: Int64,
        mimeType: String,
    ) -> URLRequest {
        var request = URLRequest(url: sessionURL)
        request.httpMethod = "PUT"
        request.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        // Zero-length body + ``bytes */TOTAL`` means "status query".
        request.setValue("0", forHTTPHeaderField: "Content-Length")
        request.setValue("bytes */\(totalBytes)", forHTTPHeaderField: "Content-Range")
        return request
    }

    // MARK: - Search helpers

    /// Escape single quotes so a folder name containing ``'`` doesn't
    /// break the Drive search query. Drive's escape convention is
    /// ``\\'`` (backslash + single quote). Pure so tests pin it.
    static func escapeQueryLiteral(_ raw: String) -> String {
        raw.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
    }

    // MARK: - Chunk sizing

    /// Drive requires resumable-upload chunks to be multiples of
    /// 256 KiB (except the final chunk). We default to 16 MiB — a
    /// good iPad LTE balance: big enough to amortise per-request
    /// overhead, small enough that one drop doesn't lose 50 MB of
    /// work.
    static let preferredChunkBytes: Int64 = 16 * 1024 * 1024

    /// Round ``preferredChunkBytes`` down to the nearest 256 KiB. Pure.
    static func alignedChunkSize(preferred: Int64 = preferredChunkBytes) -> Int64 {
        let block: Int64 = 256 * 1024
        return max(block, (preferred / block) * block)
    }
}
