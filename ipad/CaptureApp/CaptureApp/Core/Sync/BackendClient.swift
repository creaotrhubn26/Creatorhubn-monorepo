import Foundation

/// HTTP client for the CreatorHub capture backend. Wraps the REST surface
/// the iPad needs for the sync + handoff track (`POST /sessions`,
/// register asset, start/sign/complete multipart uploads, trigger
/// enhancer handoff). Auth is passed as opaque headers so callers can
/// swap between session cookies and bearer tokens without touching
/// the client.
///
/// All decode errors are mapped to `BackendError.decode` so callers
/// can retry / surface a readable message; HTTP failures are surfaced
/// as `BackendError.httpStatus`.
actor BackendClient {
    private let baseURL: URL
    private let session: URLSession
    private var authHeaders: [String: String]

    init(
        baseURL: URL,
        session: URLSession = .shared,
        authHeaders: [String: String] = [:],
    ) {
        self.baseURL = baseURL
        self.session = session
        self.authHeaders = authHeaders
    }

    func setAuthHeaders(_ headers: [String: String]) {
        self.authHeaders = headers
    }

    // MARK: - Sessions

    func createSession(_ body: BackendCreateSessionRequest) async throws -> BackendSession {
        try await postJSON(path: "/api/capture/sessions", body: body)
    }

    // MARK: - Assets

    func registerAsset(
        sessionId: UUID,
        body: BackendRegisterAssetRequest,
    ) async throws -> BackendAsset {
        try await postJSON(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/assets",
            body: body,
        )
    }

    // MARK: - Multipart upload

    func startUpload(
        assetId: UUID,
        body: BackendUploadStartRequest,
    ) async throws -> BackendUploadPlan {
        try await postJSON(
            path: "/api/capture/assets/\(assetId.uuidString.lowercased())/upload/start",
            body: body,
        )
    }

    func signPartURLs(
        assetId: UUID,
        body: BackendSignPartsRequest,
    ) async throws -> BackendSignedParts {
        try await postJSON(
            path: "/api/capture/assets/\(assetId.uuidString.lowercased())/upload/parts",
            body: body,
        )
    }

    func completeUpload(
        assetId: UUID,
        body: BackendUploadCompleteRequest,
    ) async throws -> BackendAsset {
        try await postJSON(
            path: "/api/capture/assets/\(assetId.uuidString.lowercased())/upload/complete",
            body: body,
        )
    }

    /// PUT a single part's bytes to a presigned R2 URL and return the ETag
    /// that S3/R2 sends back — required when calling completeUpload.
    func putPart(url: URL, bytes: Data) async throws -> String {
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.httpBody = bytes
        let (_, response) = try await data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BackendError.transport("not HTTPURLResponse")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw BackendError.httpStatus(http.statusCode, body: nil)
        }
        guard let etag = http.value(forHTTPHeaderField: "ETag")
                         ?? http.value(forHTTPHeaderField: "Etag") else {
            throw BackendError.decode("missing ETag on R2 part response")
        }
        return etag
    }

    // MARK: - Handoff

    func handoff(
        sessionId: UUID,
        body: BackendHandoffRequest,
    ) async throws -> BackendHandoffResult {
        try await postJSON(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/handoff",
            body: body,
        )
    }

    // MARK: - Internals

    private func postJSON<RequestBody: Encodable, Response: Decodable>(
        path: String,
        body: RequestBody,
    ) async throws -> Response {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in authHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .useDefaultKeys
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await self.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BackendError.transport("not HTTPURLResponse")
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw BackendError.unauthorized
        }
        if http.statusCode == 404 {
            throw BackendError.notFound
        }
        guard (200..<300).contains(http.statusCode) else {
            throw BackendError.httpStatus(http.statusCode, body: String(data: data, encoding: .utf8))
        }
        do {
            let decoder = JSONDecoder()
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw BackendError.decode(String(describing: error))
        }
    }

    private func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let urlError as URLError {
            throw BackendError.transport(String(describing: urlError.code))
        }
    }
}
