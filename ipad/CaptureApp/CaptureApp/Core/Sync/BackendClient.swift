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

    /// Page through the photographer's sessions. `limit` capped at 200 by
    /// the server; we don't enforce client-side so callers can rely on
    /// whatever the backend chooses.
    func listSessions(limit: Int = 50, offset: Int = 0) async throws -> BackendListSessionsResponse {
        try await getJSON(path: "/api/capture/sessions?limit=\(limit)&offset=\(offset)")
    }

    // MARK: - UniversalShowcase delivery (Phase 2B)

    /// Bridge a Capture session into a CreatorHub UniversalShowcase
    /// gallery — the URL the client receives points at the standard
    /// `/client/gallery/<accessToken>` viewer the photographer's
    /// regular delivery flow uses, so the iPad capture path lands in
    /// the same place as everything else.
    func deliverToShowcase(
        sessionId: UUID,
        body: BackendDeliverToShowcaseRequest,
    ) async throws -> BackendDeliverToShowcaseResponse {
        try await postJSON(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/deliver-to-showcase",
            body: body,
        )
    }

    // MARK: - Projects (UniversalDashboard, Phase 2B Lag D)

    func listProjects(limit: Int = 50) async throws -> BackendListProjectsResponse {
        try await getJSON(path: "/api/capture/projects?limit=\(limit)")
    }

    func fetchProject(projectId: String) async throws -> BackendProjectDetail {
        try await getJSON(path: "/api/capture/projects/\(projectId)")
    }

    func createMinimalProject(
        body: BackendCreateMinimalProjectRequest,
    ) async throws -> BackendCreatedProject {
        try await postJSON(path: "/api/capture/projects", body: body)
    }

    /// PATCH /sessions/:id/project — link or unlink a capture session to
    /// a project. Returns 204; we model that by decoding into a simple
    /// empty struct via an inline GET-style request to keep typing
    /// consistent. (Express returns no body so we just check the
    /// response code via the patchEmpty helper.)
    func linkSessionToProject(sessionId: UUID, projectId: String?) async throws {
        try await patchEmpty(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/project",
            body: BackendLinkSessionProjectRequest(projectId: projectId),
        )
    }

    /// Phase 2B Lag D: mark a shot in the project's shot list as
    /// captured by the just-uploaded asset. Pass `capturedAssetId: nil`
    /// to unlink. Fire-and-forget from the capture path — the backend
    /// recomputes completed / must-have counters server-side.
    func linkShotToAsset(
        projectId: String,
        shotId: String,
        capturedAssetId: UUID?,
    ) async throws -> BackendShotLinkResult {
        try await postJSON(
            path: "/api/projects/\(projectId)/shots/\(shotId)/link-asset",
            body: BackendLinkShotToAssetRequest(
                capturedAssetId: capturedAssetId?.uuidString.lowercased(),
            ),
        )
    }

    /// Phase 4: photographer-side review POST. Closes the toveis-comm
    /// loop — `LiveCaptureModel.sendPhotographerReply` posts here so
    /// the client-gallery web UI sees the photographer's reply land in
    /// real time via the same `client_review` WebSocket broadcast the
    /// client side uses. `assetId` is the backend asset id (not the
    /// local UUID); caller resolves via `idMap` from a prior delivery.
    func submitAssetReview(
        assetId: UUID,
        body: BackendCreateReviewRequest,
    ) async throws -> BackendCreatedReview {
        try await postJSON(
            path: "/api/capture/assets/\(assetId.uuidString.lowercased())/reviews",
            body: body,
        )
    }

    /// Phase 5.1 — voice-memo reply upload. Multipart body so audio
    /// bytes don't have to base64-encode (≈33% bloat). Server stores
    /// to R2, persists the key on the review row, and broadcasts the
    /// `client_review` WebSocket event with `audioKey` so other iPads
    /// + the web client gallery can stream the playback.
    func submitAssetVoiceReview(
        assetId: UUID,
        audioData: Data,
        audioMimeType: String,
        durationSeconds: Double,
    ) async throws -> BackendCreatedReview {
        let boundary = "boundary-\(UUID().uuidString)"
        let path = "/api/capture/assets/\(assetId.uuidString.lowercased())/reviews/audio"
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        for (name, value) in authHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }
        var body = Data()
        body.appendMultipartField(name: "duration", value: "\(durationSeconds)", boundary: boundary)
        body.appendMultipartFile(
            name: "audio",
            filename: "reply.m4a",
            mimeType: audioMimeType,
            fileData: audioData,
            boundary: boundary,
        )
        body.append("--\(boundary)--\r\n".data(using: .utf8) ?? Data())
        request.httpBody = body

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
            return try JSONDecoder().decode(BackendCreatedReview.self, from: data)
        } catch {
            throw BackendError.decode(String(describing: error))
        }
    }

    /// Phase 5.4 — kick off server-side AI enhancement for a list of
    /// already-delivered backend asset ids. Returns the photo-enhancer
    /// job mapping; caller polls `fetchEnhancementStatus` to discover
    /// when each job completes. Idempotent on the backend (same
    /// assetId enqueued twice in quick succession returns the existing
    /// jobId).
    func requestEnhancement(
        sessionId: UUID,
        body: BackendEnhancePicksRequest,
    ) async throws -> BackendEnhancePicksResponse {
        try await postJSON(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/enhance-picks",
            body: body,
        )
    }

    /// Phase 5.4 — poll all enhancement jobs queued for `sessionId`.
    /// Caller should compare against locally-tracked job state and
    /// download bytes for any jobs that just transitioned to "done".
    func fetchEnhancementStatus(
        sessionId: UUID,
    ) async throws -> BackendEnhancementStatusResponse {
        try await getJSON(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/enhance-status",
        )
    }

    /// Phase 5.3 — broadcast presence join/leave to peers in the same
    /// session via the WebSocket. Server-side `capture-presence-service`
    /// owns the in-memory roster + stale cleanup; we just nudge it
    /// when the iPad's lifecycle hits a definite transition (connect,
    /// disconnect). Periodic heartbeats are handled by the WebSocket
    /// ping/pong, not this endpoint, so we don't burn battery polling.
    func broadcastPresence(
        sessionId: UUID,
        joining: Bool,
        displayName: String?,
    ) async throws {
        struct Body: Encodable { let joining: Bool; let displayName: String? }
        let body = Body(joining: joining, displayName: displayName)
        let _: PresencePeersResponse = try await postJSON(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/presence",
            body: body,
        )
    }

    private struct PresencePeersResponse: Decodable, Sendable {
        let sessionId: String
        let peers: [PresencePeer]
        struct PresencePeer: Decodable, Sendable {
            let userId: String
            let displayName: String?
            let joinedAt: String
        }
    }

    /// Push a manual completion toggle from `ShotListPanel`. Distinct
    /// from `linkShotToAsset` because the photographer is ticking a shot
    /// done without tying it to a specific asset — and un-ticking must
    /// NOT drop any already-linked asset (server preserves it).
    func setShotCompletion(
        projectId: String,
        shotId: String,
        isCompleted: Bool,
    ) async throws {
        try await patchEmpty(
            path: "/api/capture/projects/\(projectId)/shots/\(shotId)",
            body: BackendSetShotCompletionRequest(isCompleted: isCompleted),
        )
    }

    // MARK: - Client tokens (Deliver flow)

    /// Mint a one-time-revealed client token scoped to a session. The
    /// returned `token` is the only chance to capture the secret —
    /// downstream calls only ever see the hash.
    func createClientToken(
        sessionId: UUID,
        body: BackendCreateClientTokenRequest,
    ) async throws -> BackendCreatedClientToken {
        try await postJSON(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/client-tokens",
            body: body,
        )
    }

    func listClientTokens(sessionId: UUID) async throws -> BackendListClientTokensResponse {
        try await getJSON(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/client-tokens"
        )
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

    /// Fetch every asset that's been registered against a capture
    /// session — rating, pick-state, and signed `previewUrl` included.
    /// Used by ``LiveSetDashboardModel`` to join captured thumbnails
    /// against the project's shot list.
    func listSessionAssets(
        sessionId: UUID,
        limit: Int = 500,
        offset: Int = 0,
    ) async throws -> [BackendAsset] {
        let response: BackendListSessionAssetsResponse = try await getJSON(
            path: "/api/capture/sessions/\(sessionId.uuidString.lowercased())/assets?limit=\(limit)&offset=\(offset)",
        )
        return response.assets
    }

    /// Run the Claude-backed Live Set coverage check. Backend lives at
    /// ``POST /api/live-set/ai/coverage-check``; the rest of the
    /// LiveSet AI suite (replan-day, continuity-check, end-of-day)
    /// will get sibling methods as Slice 2/3 unfolds.
    func checkLiveSetCoverage(
        request: CoverageCheckRequest,
    ) async throws -> CoverageCheckResult {
        try await postJSON(
            path: "/api/live-set/ai/coverage-check",
            body: request,
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

    // MARK: - Claude Vision analyse

    /// Forward a preview JPEG to the backend's Claude Vision analyser.
    /// Caller decides how to handle failure — typical use is "fall back
    /// to the on-device classifier silently" so the photographer never
    /// sees a network blip interrupt their tether session.
    func analyzeImage(
        assetId: UUID,
        imageBase64: String,
        mime: String,
    ) async throws -> BackendAnalyzeResponse {
        try await postJSON(
            path: "/api/capture/assets/\(assetId.uuidString.lowercased())/analyze",
            body: BackendAnalyzeRequest(imageBase64: imageBase64, mime: mime),
        )
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

    /// PATCH a JSON body, expect 2xx with no/ignored response. Used for
    /// idempotent link operations where the server returns 204.
    private func patchEmpty<RequestBody: Encodable>(
        path: String,
        body: RequestBody,
    ) async throws {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw BackendError.transport("invalid path \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in authHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await self.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BackendError.transport("not HTTPURLResponse")
        }
        if http.statusCode == 401 || http.statusCode == 403 { throw BackendError.unauthorized }
        if http.statusCode == 404 { throw BackendError.notFound }
        guard (200..<300).contains(http.statusCode) else {
            throw BackendError.httpStatus(http.statusCode, body: String(data: data, encoding: .utf8))
        }
    }

    private func getJSON<Response: Decodable>(path: String) async throws -> Response {
        // Path may carry a query string (?limit=…&offset=…) so we resolve
        // it via URL(string:relativeTo:) instead of appendingPathComponent,
        // which would percent-escape the '?' and break the request.
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw BackendError.transport("invalid path \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in authHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }
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
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw BackendError.decode(String(describing: error))
        }
    }

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

/// Phase 5.1 — multipart helpers for the voice-memo upload path.
/// Kept as Data extensions so other multipart-using callsites
/// (showcase delivery preview-PUT path uses different machinery) can
/// reuse without re-implementing.
private extension Data {
    mutating func appendMultipartField(name: String, value: String, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8) ?? Data())
        append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8) ?? Data())
        append(value.data(using: .utf8) ?? Data())
        append("\r\n".data(using: .utf8) ?? Data())
    }

    mutating func appendMultipartFile(
        name: String,
        filename: String,
        mimeType: String,
        fileData: Data,
        boundary: String,
    ) {
        append("--\(boundary)\r\n".data(using: .utf8) ?? Data())
        append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n"
            .data(using: .utf8) ?? Data())
        append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8) ?? Data())
        append(fileData)
        append("\r\n".data(using: .utf8) ?? Data())
    }
}
