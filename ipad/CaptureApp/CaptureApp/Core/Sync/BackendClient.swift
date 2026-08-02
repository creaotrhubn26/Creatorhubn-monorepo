import Foundation
import NetworkingKit

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
    /// Røret. Timeout, feilmapping og retry-på-idempotente-kall ligger der;
    /// denne typen eier bare endepunktene. Se NetworkingKit.
    private let transport: HTTPTransport
    /// Beholdes fordi noen kall bygger absolutte URL-er (preview-lenker,
    /// render-endepunkter) framfor å gå gjennom transporten.
    private let baseURL: URL

    init(
        baseURL: URL,
        session: URLSession = .shared,
        authHeaders: [String: String] = [:],
    ) {
        self.baseURL = baseURL
        self.transport = HTTPTransport(
            baseURL: baseURL,
            session: session,
            authHeaders: authHeaders,
        )
    }

    func setAuthHeaders(_ headers: [String: String]) async {
        await transport.setAuthHeaders(headers)
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

    /// Client-requested revisions for a project (default: open ones). Drives the
    /// iPad "Revisjoner" inbox.
    func listRevisionRequests(projectId: String, status: String = "open") async throws -> [BackendRevisionRequest] {
        struct Response: Decodable { let revisions: [BackendRevisionRequest] }
        let response: Response = try await getJSON(
            path: "/api/capture/projects/\(projectId)/revision-requests?status=\(status)",
        )
        return response.revisions
    }

    /// Move a revision through open → in_progress → resolved.
    func setRevisionStatus(id: String, status: String) async throws {
        struct Body: Encodable { let status: String }
        struct Response: Decodable { let ok: Bool? }
        let _: Response = try await postJSON(
            path: "/api/capture/revision-requests/\(id)/status",
            body: Body(status: status),
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
        var request = await transport.makeRequest(path: path, method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
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

    /// Slice 4 — auto-detect stray studio equipment in a fresh shot.
    /// Sends the JPEG bytes to /api/photo-enhancer/detect-distractions
    /// (multipart) and decodes the detection list. Caller — the
    /// per-asset AutoCleanService — wraps the response into a list of
    /// bbox+type+confidence rows for the review sheet (or, in
    /// auto-stille mode, immediately fires `requestPhotoEnhancerInpaint`
    /// for the high-confidence ones).
    func detectDistractions(
        imageData: Data,
        imageMimeType: String,
    ) async throws -> BackendDistractionsResponse {
        let boundary = "boundary-\(UUID().uuidString)"
        var request = await transport.makeRequest(path: "/api/photo-enhancer/detect-distractions", method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.appendMultipartFile(
            name: "image",
            filename: "image.jpg",
            mimeType: imageMimeType,
            fileData: imageData,
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
        guard (200..<300).contains(http.statusCode) else {
            throw BackendError.httpStatus(http.statusCode, body: String(data: data, encoding: .utf8))
        }
        do {
            return try JSONDecoder().decode(BackendDistractionsResponse.self, from: data)
        } catch {
            throw BackendError.decode(String(describing: error))
        }
    }

    /// Slice 6 — upload the auto-cleaned JPEG for an asset to the
    /// capture R2 bucket. Backend records the key + detection count
    /// on the captureAssets row so the Showcase bridge can later
    /// surface the cleaned variant to the client gallery without a
    /// second upload at deliver time. Idempotent — re-upload of the
    /// same asset overwrites the R2 object in place at a deterministic
    /// key. Best-effort caller: AutoCleanService swallows errors so a
    /// failed upload doesn't break the surrounding shoot flow.
    func uploadCleanedVariant(
        sessionId: UUID,
        assetId: UUID,
        cleanedJpegData: Data,
        detectionCount: Int,
    ) async throws -> BackendCleanedVariantResponse {
        let boundary = "boundary-\(UUID().uuidString)"
        let path = "/api/capture/sessions/\(sessionId.uuidString.lowercased())/assets/\(assetId.uuidString.lowercased())/upload-cleaned-variant"
        var request = await transport.makeRequest(path: path, method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.appendMultipartFile(
            name: "cleaned",
            filename: "cleaned.jpg",
            mimeType: "image/jpeg",
            fileData: cleanedJpegData,
            boundary: boundary,
        )
        body.appendMultipartField(
            name: "detectionCount",
            value: String(detectionCount),
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
            return try JSONDecoder().decode(BackendCleanedVariantResponse.self, from: data)
        } catch {
            throw BackendError.decode(String(describing: error))
        }
    }

    /// Slice 4 — fire the inpaint executor with image + binary mask.
    /// AutoCleanService builds the mask client-side as a single PNG
    /// covering all confirmed detections; passing `skipPlanner=1`
    /// routes directly to the patch_clone executor with synthesised
    /// donors, sparing the Claude planner round-trip we already paid
    /// for in `detectDistractions`. Returns the inpainted JPEG bytes.
    func requestPhotoEnhancerInpaint(
        imageData: Data,
        imageMimeType: String,
        maskPngData: Data,
        intensity: Double = 1.0,
    ) async throws -> BackendInpaintResponse {
        let boundary = "boundary-\(UUID().uuidString)"
        var request = await transport.makeRequest(path: "/api/photo-enhancer/inpaint", method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.appendMultipartFile(
            name: "image",
            filename: "image.jpg",
            mimeType: imageMimeType,
            fileData: imageData,
            boundary: boundary,
        )
        body.appendMultipartFile(
            name: "mask",
            filename: "mask.png",
            mimeType: "image/png",
            fileData: maskPngData,
            boundary: boundary,
        )
        body.appendMultipartField(name: "intensity", value: String(format: "%.3f", intensity), boundary: boundary)
        body.appendMultipartField(name: "skipPlanner", value: "1", boundary: boundary)
        body.append("--\(boundary)--\r\n".data(using: .utf8) ?? Data())
        request.httpBody = body

        let (data, response) = try await self.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BackendError.transport("not HTTPURLResponse")
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw BackendError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            throw BackendError.httpStatus(http.statusCode, body: String(data: data, encoding: .utf8))
        }
        do {
            return try JSONDecoder().decode(BackendInpaintResponse.self, from: data)
        } catch {
            throw BackendError.decode(String(describing: error))
        }
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

    /// Bygg STABILE thumbnail-URL-er for shot-oppdaterings-kortet: de siste
    /// `limit` opplastede bildene i økta, som `…/assets/<id>/preview`-
    /// redirecter (aldri utløper — backend re-signerer R2 pr kall). Kun
    /// bilder som faktisk har en preview i skyen tas med.
    func shotThumbURLs(sessionId: UUID, limit: Int) async -> [String] {
        guard let assets = try? await listSessionAssets(sessionId: sessionId, limit: 500, offset: 0)
        else { return [] }
        return assets
            .filter { $0.previewUrl != nil }
            .suffix(limit)
            .map { baseURL.appendingPathComponent("/api/capture/assets/\($0.id)/preview").absoluteString }
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
    private func patchEmpty<RequestBody: Encodable & Sendable>(
        path: String,
        body: RequestBody,
    ) async throws {
        do { try await transport.patchIgnoringResponse(path, body: body) }
        catch let error as HTTPError { throw Self.asBackendError(error) }
    }

    private func getJSON<Response: Decodable & Sendable>(path: String) async throws -> Response {
        do { return try await transport.get(path) }
        catch let error as HTTPError { throw Self.asBackendError(error) }
    }

    /// Registrer denne enhetens APNs-token for push-varsler (kunde signerte,
    /// likte bilder, redigerer ferdig m.m. — også når appen er lukket).
    func registerCaptureDeviceToken(token: String) async throws {
        struct Body: Encodable { let deviceToken: String; let platform: String }
        struct Ack: Decodable { let ok: Bool? }
        let _: Ack = try await postJSON(
            path: "/api/capture/me/device-token",
            body: Body(deviceToken: token, platform: "ios"))
    }

    /// Post en melding i prosjektets team-chat (`project-<id>` i communication_
    /// channels — SAMME kanal som web-workspacens WorkspaceChatPanel). Brukes
    /// til team-varsler om shot-progresjon.
    func postProjectChatMessage(projectId: String, text: String) async throws {
        struct Body: Encodable {
            let channelId: String; let conversationId: String
            let content: String; let text: String
        }
        struct Ack: Decodable {}
        let channel = "project-\(projectId)"
        let _: Ack = try await postJSON(
            path: "/api/communication/messages",
            body: Body(channelId: channel, conversationId: channel, content: text, text: text))
    }

    /// Post/OPPDATER shot-oppdaterings-kortet i team-chatten. `clientMessageId`
    /// er stabil pr opptaksøkt → backend upserter (persistMessage 23505→update)
    /// slik at SAMME melding vokser in-place når flere bilder tas. `shotUpdate`
    /// er strukturert metadata (who/scenes/next/count/backup) som web + iPad
    /// rendrer som kort. `content` beholdes lesbar for varsler/fallback.
    func postProjectShotCard(
        projectId: String, clientMessageId: String, text: String,
        shotUpdate: [String: Any]
    ) async throws {
        let channel = "project-\(projectId)"
        let body: [String: Any] = [
            "id": clientMessageId,
            "channelId": channel,
            "conversationId": channel,
            "content": text,
            "text": text,
            "metadata": ["shotUpdate": shotUpdate]
        ]
        var request = await transport.makeRequest(path: "/api/communication/messages", method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await self.data(for: request)
    }

    /// Ett shot i POST-en til `/api/projects/:id/shot-list`. Fullt felt-sett så
    /// APPEND kan bevare eksisterende shots (fullført-status, koblet asset osv.)
    /// i stedet for å nulle dem.
    struct ShotListPostItem: Encodable, Sendable {
        let id: String
        let scene: String
        var description: String?
        var priority: String?
        var shotType: String?
        var locationName: String?
        var notes: String?
        var scouted: Bool?
        var isCompleted: Bool?
        var capturedAssetId: String?
        var capturedAssetBackendId: String?
        var completedBy: String?
    }

    /// #9 Lagre en shot-list til prosjektet (samme array-baserte endepunkt som
    /// auto-huk + web ShotlistTab leser). Endepunktet er array-erstattende, så
    /// APPEND gjøres ved å sende eksisterende items (fullt) + de nye.
    func postProjectShotList(
        projectId: String, items: [ShotListPostItem],
        listName: String = "Fra brief", eventType: String = "photo_session"
    ) async throws {
        struct Body: Encodable { let shots: [ShotListPostItem]; let listName: String; let eventType: String }
        struct Ack: Decodable {}
        let _: Ack = try await postJSON(
            path: "/api/projects/\(projectId)/shot-list",
            body: Body(shots: items, listName: listName, eventType: eventType))
    }

    /// Bygg en OFFENTLIG render-URL til Infographic-motoren (`GET /api/
    /// infographics/render.png`) — laster i AsyncImage/`<img>` uten auth.
    /// Gjenbruker Post Agents infographic-verktøy til å designe f.eks. en
    /// call-sheet fra shot-listen (tpl=timeline). `data` blir `window.__CFG__`.
    nonisolated func infographicRenderURL(
        tpl: String, width: Int, height: Int,
        data: [String: Any], accentHex: String?
    ) -> URL? {
        guard let json = try? JSONSerialization.data(withJSONObject: data) else { return nil }
        // `d` må være base64url-kodet JSON (backend: Buffer.from(d,'base64url')).
        let b64 = json.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        var c = URLComponents(
            url: baseURL.appendingPathComponent("/api/infographics/render.png"),
            resolvingAgainstBaseURL: false)
        var items: [URLQueryItem] = [
            .init(name: "tpl", value: tpl),
            .init(name: "w", value: String(width)),
            .init(name: "h", value: String(height)),
            .init(name: "d", value: b64)
        ]
        if let accentHex { items.append(.init(name: "accent", value: accentHex)) }
        c?.queryItems = items
        return c?.url
    }

    /// Stabil preview-URL for et backend-asset (thumbnail overalt). Offentlig
    /// redirect → laster i AsyncImage/`<img>` uten auth.
    nonisolated func assetPreviewURL(backendAssetId: String) -> URL? {
        baseURL.appendingPathComponent("/api/capture/assets/\(backendAssetId)/preview")
    }

    /// #9 Hent bryllups-timelinen for prosjektet og form den til en kompakt
    /// brief (dagsplan) FM kan lage shot-list fra. nil hvis ingen timeline.
    func fetchWeddingTimelineBrief(projectId: String) async -> String? {
        struct Event: Decodable {
            let title: String?; let time: String?; let description: String?; let location: String?
        }
        struct Timeline: Decodable { let title: String?; let coupleName: String?; let events: [Event]? }
        guard let tl: Timeline = try? await getJSON(path: "/api/wedding/timeline/project/\(projectId)"),
              let events = tl.events, !events.isEmpty else { return nil }
        let lines: [String] = events.compactMap { e in
            let title = (e.title ?? "").trimmingCharacters(in: .whitespaces)
            guard !title.isEmpty else { return nil }
            var s = ""
            if let t = e.time, !t.isEmpty { s += "\(t) " }
            s += title
            if let loc = e.location, !loc.isEmpty { s += " (\(loc))" }
            if let d = e.description, !d.isEmpty { s += " — \(d)" }
            return "- " + s
        }
        guard !lines.isEmpty else { return nil }
        let header = (tl.coupleName ?? tl.title).map { "Bryllup: \($0)." } ?? "Bryllup."
        return "\(header)\nDagsplan (fra bryllups-timeline):\n" + lines.joined(separator: "\n")
    }

    /// Les team-flagget for shot-list auto-huk (delt via projects.settings).
    /// Default PÅ hvis ukjent/feil.
    func fetchShotListAutoCheck(projectId: String) async -> Bool {
        var request = await transport.makeRequest(path: "/api/projects/\(projectId)/capture-settings", method: "GET")
        guard let (data, response) = try? await self.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return true }
        struct Resp: Decodable { let shotListAutoCheck: Bool? }
        return (try? JSONDecoder().decode(Resp.self, from: data))?.shotListAutoCheck ?? true
    }

    /// Skru auto-huk av/på for teamet. Eier-gated i backend → 403 kastes som
    /// `ShotAutoCheckError.notOwner` så UI kan vise «kun eier kan endre».
    func setShotListAutoCheck(projectId: String, enabled: Bool, updatedBy: String?) async throws {
        var request = await transport.makeRequest(path: "/api/projects/\(projectId)/capture-settings", method: "PUT")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        struct Body: Encodable { let shotListAutoCheck: Bool; let updatedBy: String? }
        request.httpBody = try JSONEncoder().encode(Body(shotListAutoCheck: enabled, updatedBy: updatedBy))
        let (_, response) = try await self.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ShotAutoCheckError.failed }
        if http.statusCode == 403 { throw ShotAutoCheckError.notOwner }
        guard (200..<300).contains(http.statusCode) else { throw ShotAutoCheckError.failed }
    }

    private func postJSON<RequestBody: Encodable & Sendable, Response: Decodable & Sendable>(
        path: String,
        body: RequestBody,
    ) async throws -> Response {
        do { return try await transport.post(path, body: body) }
        catch let error as HTTPError { throw Self.asBackendError(error) }
    }

    /// Rå forespørsel for kallene som ikke er JSON inn/JSON ut — multipart,
    /// signerte PUT-er.
    ///
    /// Bruker ``rawData`` og ikke ``send``, fordi kallstedene under gjør sin
    /// egen statusbehandling og trenger responsen. De arver fortsatt timeout
    /// og retry-stigen fra transporten.
    private func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await transport.rawData(for: request)
        } catch let error as HTTPError {
            throw Self.asBackendError(error)
        }
    }

    /// Oversetter transportens feil til appens vokabular.
    ///
    /// Uten dette ville `catch BackendError.unauthorized` i
    /// ``QuickTeaserService`` sluttet å matche — og det ville kompilert fint.
    /// Feiltypen er en del av klientens API, ikke en implementasjonsdetalj.
    private static func asBackendError(_ error: HTTPError) -> BackendError {
        switch error {
        case .unauthorized:               return .unauthorized
        case .notFound:                   return .notFound
        case let .httpStatus(code, body): return .httpStatus(code, body: body)
        case let .decode(message):        return .decode(message)
        case let .transport(message):     return .transport(message)
        case .notConfigured:              return .notConfigured
        }
    }
}

/// Feil fra shot-list auto-huk-styringen. `.notOwner` = backend 403
/// (kun prosjekteier kan endre for teamet).
enum ShotAutoCheckError: Error, Equatable {
    case notOwner
    case noBackend
    case failed
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
