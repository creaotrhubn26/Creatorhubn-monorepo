import CryptoKit
import Foundation

/// Lazy mirror of a local capture session to the backend, run on
/// demand when the photographer hits "Deliver". Doesn't continuously
/// sync — keeps the live tether path completely local until the user
/// is ready to share.
///
/// Three concerns:
/// 1. Mirror the session row (one-shot `BackendClient.createSession`).
/// 2. Upload selected previews (multipart) and register their asset rows.
/// 3. Mint a client token scoped to the freshly-created backend session.
///
/// Failures bubble up as `DeliveryError` so the sheet can show "Backend
/// unreachable — keep tethered, try again" without losing local state.
actor DeliveryService {
    private let backend: BackendClient
    /// Phase 2C — when set, picks carrying a `renderRecipe` are demosaiced
    /// from the camera-original RAW (`?kind=main`) before upload, so the
    /// client gallery receives a true RAW-quality JPEG instead of the
    /// in-camera display preview. nil for callsites that only ever ship
    /// display JPEGs (sync flows, legacy delivery surfaces).
    private let rawExporter: RAWExportService?
    /// Maps local asset id → backend asset id for the session being
    /// delivered. Carried across retries so a partial failure doesn't
    /// double-upload assets that already landed.
    private var idMap: [UUID: UUID] = [:]
    /// Backend session id once the session row is mirrored. Read by the
    /// Live Set dashboard so it can fetch the captured-asset listing
    /// from /api/capture/sessions/:id/assets — nil before the first
    /// `deliver()` call (lazy creation), at which point the dashboard
    /// gracefully falls back to "all-shots-missing" rendering.
    private(set) var backendSessionId: UUID?

    /// Resolve the backend asset id for a locally-stored asset. nil
    /// when the asset hasn't been delivered yet (no row on the server
    /// to attach a review/comment to). Used by Phase 4 photographer
    /// reply flow so `submitAssetReview` knows where to post.
    func backendAssetId(forLocal localId: UUID) -> UUID? {
        idMap[localId]
    }

    init(backend: BackendClient, rawExporter: RAWExportService? = nil) {
        self.backend = backend
        self.rawExporter = rawExporter
    }

    /// Snapshot of an asset to upload — pulled from `SessionStore` and
    /// reduced to the fields delivery actually cares about.
    struct DeliverableAsset: Sendable {
        let localId: UUID
        let originalFilename: String
        let captureTime: Date
        let mime: String
        /// On-disk path to the preview JPEG. Multipart upload reads this
        /// directly so we don't hold the bytes in memory longer than the
        /// part-size buffer. Also acts as the fallback when RAW rendering
        /// is unavailable (JPEG-only shoots, render failure).
        let previewPath: String
        /// Phase 2C — recipe to apply to the camera-original RAW before
        /// upload. When set AND ``DeliveryService`` was built with a
        /// ``RAWExportService``, the asset's `rawKey` is demosaiced
        /// through ``RAWExportPipeline`` and the resulting JPEG is
        /// uploaded instead of `previewPath`. Falls back to `previewPath`
        /// when no RAW source exists or rendering fails — delivery
        /// silently degrades to "preview-quality" rather than failing.
        var renderRecipe: MagicRecipe?
        /// Phase 5 — output color space + ICC profile for the rendered
        /// JPEG. Default `.webDelivery` (sRGB) matches the universal
        /// gallery-upload case. Photographer can switch to
        /// `.wideGamutDelivery` (Display P3) for Apple-ecosystem
        /// clients OR `.printDelivery` (Adobe RGB) for photo-lab /
        /// RIP-software workflows. Has no effect when render falls
        /// back to `previewPath` (the camera-baked JPEG carries
        /// whatever profile Canon embedded).
        var colorPurpose: ColorManagement.Purpose = .webDelivery
        /// Dual RAW+JPG shoots — when set, RAW bytes are read from this
        /// asset's `rawKey` instead of the picked asset's. The output
        /// upload still carries `localId`'s filename and metadata. Use
        /// case: photographer picks the JPG row in the filmstrip but
        /// CCAPI exposed the CR3 sibling as a separate asset row.
        /// `nil` for pure-RAW or pure-JPG shoots.
        var rawSourceAssetId: UUID?
        /// Optional linkage back to the project's shot list. When both
        /// are set and the upload completes, we POST to
        /// /api/projects/:projectId/shots/:shotId/link-asset so the
        /// web side of the shot list flips to "completed" in real time.
        /// Phase 2B Lag D follow-up.
        var projectId: String?
        var shotId: String?
    }

    struct DeliveryResult: Sendable {
        let backendSessionId: UUID
        let uploadedCount: Int
        let token: BackendCreatedClientToken
    }

    enum DeliveryError: Error, Sendable, Equatable {
        case sessionMirrorFailed(String)
        case noUploadablePicks
        case uploadFailed(localAssetId: UUID, reason: String)
        case tokenMintFailed(String)
        case bridgeFailed(String)
    }

    /// End-to-end deliver-to-CreatorHub flow: mirror session, upload
    /// picks, bridge into a UniversalShowcase gallery. Returns the
    /// CreatorHub share URL that lives at `/client/gallery/<token>` —
    /// same surface the photographer's regular delivery flow uses, so
    /// the iPad doesn't introduce a parallel UX.
    struct ShowcaseDeliveryResult: Sendable {
        let backendSessionId: UUID
        let uploadedCount: Int
        let response: BackendDeliverToShowcaseResponse
    }

    func deliverToShowcase(
        sessionName: String,
        sessionStartedAt: Date,
        picks: [DeliverableAsset],
        clientName: String,
        clientEmail: String,
        projectTitle: String?,
        filter: BackendDeliverFilter,
    ) async throws -> ShowcaseDeliveryResult {
        // Reuse the existing mirror+upload pipeline so the backend has
        // a real session + assets to bridge from.
        let baseResult = try await deliver(
            sessionName: sessionName,
            sessionStartedAt: sessionStartedAt,
            picks: picks,
            // Pass nil clientLabel/pin so we don't also mint a Capture
            // client token — only the gallery is the goal here.
            clientLabel: nil,
            pin: nil,
            ttlMinutes: nil,
        )
        do {
            let response = try await backend.deliverToShowcase(
                sessionId: baseResult.backendSessionId,
                body: .init(
                    filter: filter,
                    clientName: clientName,
                    clientEmail: clientEmail,
                    projectTitle: projectTitle,
                ),
            )
            return ShowcaseDeliveryResult(
                backendSessionId: baseResult.backendSessionId,
                uploadedCount: baseResult.uploadedCount,
                response: response,
            )
        } catch {
            throw DeliveryError.bridgeFailed(String(describing: error))
        }
    }

    /// One-shot deliver: mirror session, upload picks, mint client token.
    /// Re-entrant — calling twice with the same picks is safe (idMap
    /// short-circuits assets we've already uploaded).
    func deliver(
        sessionName: String,
        sessionStartedAt: Date,
        picks: [DeliverableAsset],
        clientLabel: String?,
        pin: String?,
        ttlMinutes: Int?,
    ) async throws -> DeliveryResult {
        guard !picks.isEmpty else { throw DeliveryError.noUploadablePicks }

        let backendSession: UUID = try await {
            if let existing = backendSessionId { return existing }
            do {
                let row = try await backend.createSession(
                    .init(name: sessionName, clientId: nil, startsAt: sessionStartedAt)
                )
                guard let id = row.uuid else {
                    throw DeliveryError.sessionMirrorFailed("invalid session id from backend: \(row.id)")
                }
                self.backendSessionId = id
                return id
            } catch let DeliveryError.sessionMirrorFailed(msg) {
                throw DeliveryError.sessionMirrorFailed(msg)
            } catch {
                throw DeliveryError.sessionMirrorFailed(String(describing: error))
            }
        }()

        var uploaded = 0
        for pick in picks {
            if idMap[pick.localId] != nil {
                uploaded += 1
                continue
            }
            do {
                let backendAssetId = try await uploadOne(pick: pick, sessionId: backendSession)
                idMap[pick.localId] = backendAssetId
                uploaded += 1
            } catch {
                throw DeliveryError.uploadFailed(
                    localAssetId: pick.localId,
                    reason: String(describing: error)
                )
            }
        }

        do {
            let token = try await backend.createClientToken(
                sessionId: backendSession,
                body: .init(clientLabel: clientLabel, pin: pin, ttlMinutes: ttlMinutes)
            )
            return DeliveryResult(
                backendSessionId: backendSession,
                uploadedCount: uploaded,
                token: token,
            )
        } catch {
            throw DeliveryError.tokenMintFailed(String(describing: error))
        }
    }

    /// Resolve which on-disk file's bytes go up to R2 for this pick.
    /// Phase 2C: prefer RAW-rendered JPEG when both `renderRecipe` and a
    /// `RAWExportService` are present. Falls back to `previewPath` for
    /// JPEG-only shoots, render failure, or callsites that didn't opt in
    /// to RAW delivery — the upload always succeeds at preview quality
    /// even if the high-quality path is unavailable.
    private func resolveUploadPath(pick: DeliverableAsset) async -> String {
        guard let exporter = rawExporter, let recipe = pick.renderRecipe else {
            return pick.previewPath
        }
        do {
            let url = try await exporter.render(
                assetId: pick.localId,
                sourceAssetId: pick.rawSourceAssetId,
                recipe: recipe,
                colorPurpose: pick.colorPurpose,
            )
            return url.path
        } catch {
            AppLog.sync.error("[DeliveryService] RAW render fallback for \(String(describing: pick.localId), privacy: .public): \(error.localizedDescription, privacy: .public)")
            return pick.previewPath
        }
    }

    private func uploadOne(pick: DeliverableAsset, sessionId: UUID) async throws -> UUID {
        let uploadPath = await resolveUploadPath(pick: pick)
        let data = try Data(contentsOf: URL(fileURLWithPath: uploadPath))
        let asset = try await backend.registerAsset(
            sessionId: sessionId,
            body: .init(
                originalFilename: pick.originalFilename,
                captureTime: pick.captureTime,
                mime: pick.mime,
                sizeBytes: Int64(data.count),
            )
        )
        guard let assetUUID = UUID(uuidString: asset.id) else {
            throw NSError(domain: "DeliveryService", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "backend returned non-UUID asset id \(asset.id)"
            ])
        }

        let plan = try await backend.startUpload(
            assetId: assetUUID,
            body: .init(
                kind: .preview,
                sizeBytes: Int64(data.count),
                mime: pick.mime,
                preferredPartSize: nil,
            )
        )
        let parts = try splitIntoParts(data: data, partSize: plan.partSize, partCount: plan.partCount)
        let partNumbers = Array(1...parts.count)
        let signed = try await backend.signPartURLs(
            assetId: assetUUID,
            body: .init(uploadId: plan.uploadId, key: plan.key, partNumbers: partNumbers),
        )
        guard signed.parts.count == parts.count else {
            throw NSError(domain: "DeliveryService", code: -2, userInfo: [
                NSLocalizedDescriptionKey: "signed part count (\(signed.parts.count)) ≠ plan part count (\(parts.count))"
            ])
        }

        var completed: [BackendCompletedPart] = []
        completed.reserveCapacity(parts.count)
        // Sequential PUTs — each part is small (default 5 MB) so latency
        // is dominated by setup; parallelism would only matter for full /
        // RAW exports which are Phase 2C.
        for (i, part) in parts.enumerated() {
            let signedPart = signed.parts[i]
            guard let url = URL(string: signedPart.url) else {
                throw NSError(domain: "DeliveryService", code: -3, userInfo: [
                    NSLocalizedDescriptionKey: "invalid signed part url"
                ])
            }
            let etag = try await backend.putPart(url: url, bytes: part)
            completed.append(.init(partNumber: signedPart.partNumber, etag: etag))
        }

        let checksum = sha256Hex(of: data)
        _ = try await backend.completeUpload(
            assetId: assetUUID,
            body: .init(
                kind: .preview,
                uploadId: plan.uploadId,
                key: plan.key,
                parts: completed,
                checksumSha256: checksum,
                sizeBytes: Int64(data.count),
            )
        )

        // Phase 2B Lag D follow-up: if this upload satisfies a planned
        // shot from the project's shot list, flip that shot's
        // capturedAssetId + isCompleted on the backend so the web
        // ShotListManager shows progress in real time. Fire-and-forget —
        // the upload itself already succeeded; a link failure shouldn't
        // retry the bytes. We just log it so the sync flow stays silent.
        if let projectId = pick.projectId, let shotId = pick.shotId {
            do {
                _ = try await backend.linkShotToAsset(
                    projectId: projectId,
                    shotId: shotId,
                    capturedAssetId: assetUUID,
                )
            } catch {
                // Don't throw — the photo is delivered, only the planning
                // linkage is stale. Counter reconciliation is idempotent
                // so a later retry (or a manual mark-complete from the
                // web) will catch up.
                AppLog.sync.error("[DeliveryService] linkShotToAsset failed: \(error.localizedDescription, privacy: .public)")
            }
        }

        return assetUUID
    }

    // MARK: - Card backup (originals → B2)

    /// One ORIGINAL file from a memory card to back up to B2 — the RAW (.raw)
    /// and/or the JPEG (.full). Unlike ``DeliverableAsset`` (which ships a
    /// client preview), this carries the camera-original bytes so the card is
    /// safely archived, not just delivered.
    struct CardBackupItem: Sendable {
        let localId: UUID
        let originalFilename: String
        let captureTime: Date
        let mime: String
        let path: String
        let kind: BackendUploadKind
    }

    /// Back up original card files to B2 under a freshly-mirrored backend
    /// session, optionally linked to a project. Reuses the same chunked
    /// register→sign→put→complete path as ``deliver`` so the originals land in
    /// B2 exactly like delivered assets — only the bytes (originals, not
    /// previews) and the upload `kind` differ. `onProgress(done, total)` fires
    /// after each item so the UI can show a real progress bar.
    func backupCard(
        sessionName: String,
        sessionStartedAt: Date,
        items: [CardBackupItem],
        projectId: String?,
        onProgress: (@Sendable (Int, Int) -> Void)? = nil,
    ) async throws -> DeliveryResult {
        guard !items.isEmpty else { throw DeliveryError.noUploadablePicks }

        let backendSession: UUID = try await {
            if let existing = backendSessionId { return existing }
            do {
                let row = try await backend.createSession(
                    .init(name: sessionName, clientId: nil, startsAt: sessionStartedAt)
                )
                guard let id = row.uuid else {
                    throw DeliveryError.sessionMirrorFailed("invalid session id from backend: \(row.id)")
                }
                self.backendSessionId = id
                return id
            } catch let DeliveryError.sessionMirrorFailed(msg) {
                throw DeliveryError.sessionMirrorFailed(msg)
            } catch {
                throw DeliveryError.sessionMirrorFailed(String(describing: error))
            }
        }()

        if let projectId, !projectId.isEmpty {
            // Best-effort — the bytes are what matter; a link failure shouldn't
            // fail the backup. The web side reconciles on next sync.
            do {
                try await backend.linkSessionToProject(sessionId: backendSession, projectId: projectId)
            } catch {
                AppLog.sync.error("[DeliveryService] backupCard linkSessionToProject failed: \(error.localizedDescription, privacy: .public)")
            }
        }

        var uploaded = 0
        for (index, item) in items.enumerated() {
            if idMap[item.localId] == nil {
                let backendAssetId = try await uploadOriginal(item: item, sessionId: backendSession)
                idMap[item.localId] = backendAssetId
            }
            uploaded += 1
            onProgress?(index + 1, items.count)
        }

        do {
            let token = try await backend.createClientToken(
                sessionId: backendSession,
                body: .init(clientLabel: nil, pin: nil, ttlMinutes: nil)
            )
            return DeliveryResult(backendSessionId: backendSession, uploadedCount: uploaded, token: token)
        } catch {
            throw DeliveryError.tokenMintFailed(String(describing: error))
        }
    }

    private func uploadOriginal(item: CardBackupItem, sessionId: UUID) async throws -> UUID {
        let data = try Data(contentsOf: URL(fileURLWithPath: item.path))
        guard !data.isEmpty else {
            throw DeliveryError.uploadFailed(localAssetId: item.localId, reason: "empty file")
        }
        let asset = try await backend.registerAsset(
            sessionId: sessionId,
            body: .init(
                originalFilename: item.originalFilename,
                captureTime: item.captureTime,
                mime: item.mime,
                sizeBytes: Int64(data.count),
            )
        )
        guard let assetUUID = UUID(uuidString: asset.id) else {
            throw DeliveryError.uploadFailed(localAssetId: item.localId, reason: "backend returned non-UUID asset id \(asset.id)")
        }
        let plan = try await backend.startUpload(
            assetId: assetUUID,
            body: .init(kind: item.kind, sizeBytes: Int64(data.count), mime: item.mime, preferredPartSize: nil)
        )
        let parts = try splitIntoParts(data: data, partSize: plan.partSize, partCount: plan.partCount)
        guard !parts.isEmpty else {
            throw DeliveryError.uploadFailed(localAssetId: item.localId, reason: "no upload parts")
        }
        let partNumbers = Array(1...parts.count)
        let signed = try await backend.signPartURLs(
            assetId: assetUUID,
            body: .init(uploadId: plan.uploadId, key: plan.key, partNumbers: partNumbers),
        )
        guard signed.parts.count == parts.count else {
            throw DeliveryError.uploadFailed(localAssetId: item.localId, reason: "signed part count mismatch")
        }
        var completed: [BackendCompletedPart] = []
        completed.reserveCapacity(parts.count)
        for (i, part) in parts.enumerated() {
            let signedPart = signed.parts[i]
            guard let url = URL(string: signedPart.url) else {
                throw DeliveryError.uploadFailed(localAssetId: item.localId, reason: "invalid signed part url")
            }
            let etag = try await backend.putPart(url: url, bytes: part)
            completed.append(.init(partNumber: signedPart.partNumber, etag: etag))
        }
        _ = try await backend.completeUpload(
            assetId: assetUUID,
            body: .init(
                kind: item.kind,
                uploadId: plan.uploadId,
                key: plan.key,
                parts: completed,
                checksumSha256: sha256Hex(of: data),
                sizeBytes: Int64(data.count),
            )
        )
        return assetUUID
    }
}

private func splitIntoParts(data: Data, partSize: Int64, partCount: Int) throws -> [Data] {
    guard partCount > 0 else { return [] }
    let size = Int(partSize)
    guard size > 0 else {
        throw NSError(domain: "DeliveryService", code: -4, userInfo: [
            NSLocalizedDescriptionKey: "non-positive partSize"
        ])
    }
    var parts: [Data] = []
    parts.reserveCapacity(partCount)
    var offset = 0
    while offset < data.count {
        let end = min(offset + size, data.count)
        parts.append(data.subdata(in: offset..<end))
        offset = end
    }
    return parts
}

/// Lower-case hex SHA-256 of the full payload — the backend matches this
/// against R2's stored checksum during completeUpload.
private func sha256Hex(of data: Data) -> String {
    let digest = SHA256.hash(data: data)
    return digest.map { String(format: "%02x", $0) }.joined()
}
