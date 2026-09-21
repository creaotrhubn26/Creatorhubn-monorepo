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
    private let uploadStore: PersistentUploadStore?
    private let partUploader: (any MultipartPartUploading)?
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
    /// Completed local file variants for in-process retry. `idMap` alone is
    /// insufficient for RAW+JPEG pairs because both variants share one asset.
    private var uploadedVariants: Set<String> = []
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

    init(
        backend: BackendClient,
        rawExporter: RAWExportService? = nil,
        uploadStore: PersistentUploadStore? = nil,
        partUploader: (any MultipartPartUploading)? = nil,
    ) {
        self.backend = backend
        self.rawExporter = rawExporter
        self.uploadStore = uploadStore
        self.partUploader = partUploader
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
        case projectLinkFailed(String)
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
        sendEmail: Bool = false,
        emailBody: String? = nil,
        photographerName: String? = nil,
        projectId: String? = nil,
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
            projectId: projectId,
        )
        do {
            let response = try await backend.deliverToShowcase(
                sessionId: baseResult.backendSessionId,
                body: .init(
                    filter: filter,
                    clientName: clientName,
                    clientEmail: clientEmail,
                    projectTitle: projectTitle,
                    sendEmail: sendEmail,
                    emailBody: emailBody,
                    photographerName: photographerName,
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
        projectId: String? = nil,
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

        try await requireProjectLink(sessionId: backendSession, projectId: projectId)

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

    /// Resolve which on-disk file's bytes go to CreatorHub S3 for this pick.
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
        let sizeBytes = try fileSize(at: uploadPath)
        let assetUUID: UUID
        if let persisted = try await existingBackendAssetId(
            localAssetId: pick.localId,
            sessionId: sessionId,
        ) {
            assetUUID = persisted
        } else {
            assetUUID = try await registerBackendAsset(
                sessionId: sessionId,
                originalFilename: pick.originalFilename,
                captureTime: pick.captureTime,
                mime: pick.mime,
                sizeBytes: sizeBytes,
            )
        }

        try await uploadFile(
            localAssetId: pick.localId,
            backendSessionId: sessionId,
            assetId: assetUUID,
            path: uploadPath,
            kind: .preview,
            mime: pick.mime,
            sizeBytes: sizeBytes,
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

    // MARK: - Card backup (originals → CreatorHub S3)

    /// One ORIGINAL file from a memory card to back up to CreatorHub S3 — the RAW (.raw)
    /// and/or the JPEG (.full). Unlike ``DeliverableAsset`` (which ships a
    /// client preview), this carries the camera-original bytes so the card is
    /// safely archived, not just delivered.
    struct CardBackupItem: Codable, Sendable, Equatable {
        let localId: UUID
        let originalFilename: String
        let captureTime: Date
        let mime: String
        let path: String
        let kind: BackendUploadKind
    }

    /// Back up original card files to CreatorHub S3 under a freshly-mirrored backend
    /// session, optionally linked to a project. Reuses the same chunked
    /// register→sign→put→complete path as ``deliver`` so the originals land in
    /// S3 exactly like delivered assets — only the bytes (originals, not
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

        // Rehydrate the backend session and asset mapping from SQLite before
        // creating anything new. This is what turns a fresh DeliveryService
        // after app relaunch into a real resume instead of a duplicate upload.
        if backendSessionId == nil, let uploadStore {
            for item in items {
                if let context = try await uploadStore.backendContext(for: item.localId) {
                    backendSessionId = context.backendSessionId
                    idMap[item.localId] = context.backendAssetId
                    break
                }
            }
        }

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

        // The project link must exist before startUpload. The backend derives
        // the CreatorHub S3 object prefix from capture_sessions.project_id;
        // continuing after a failed link would archive into "unassigned" and
        // leave the gallery detached from the selected project.
        try await requireProjectLink(sessionId: backendSession, projectId: projectId)

        var uploaded = 0
        for (index, item) in items.enumerated() {
            let variantKey = "\(item.localId.uuidString.lowercased()):\(item.kind.rawValue)"
            if uploadedVariants.contains(variantKey) {
                uploaded += 1
                onProgress?(index + 1, items.count)
                continue
            }
            // RAW+JPEG pairs intentionally share one local/backend asset row,
            // but each file is a distinct S3 variant. Reuse the asset id while
            // always uploading the current variant; skipping on idMap here used
            // to silently drop the RAW half of every pair.
            let backendAssetId = try await uploadOriginal(
                item: item,
                sessionId: backendSession,
                existingAssetId: idMap[item.localId]
            )
            idMap[item.localId] = backendAssetId
            uploadedVariants.insert(variantKey)
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

    private func uploadOriginal(
        item: CardBackupItem,
        sessionId: UUID,
        existingAssetId: UUID?
    ) async throws -> UUID {
        let sizeBytes = try fileSize(at: item.path)
        let assetUUID: UUID
        if let existingAssetId {
            assetUUID = existingAssetId
        } else if let persisted = try await existingBackendAssetId(
            localAssetId: item.localId,
            sessionId: sessionId,
        ) {
            assetUUID = persisted
        } else {
            assetUUID = try await registerBackendAsset(
                sessionId: sessionId,
                originalFilename: item.originalFilename,
                captureTime: item.captureTime,
                mime: item.mime,
                sizeBytes: sizeBytes,
            )
        }

        try await uploadFile(
            localAssetId: item.localId,
            backendSessionId: sessionId,
            assetId: assetUUID,
            path: item.path,
            kind: item.kind,
            mime: item.mime,
            sizeBytes: sizeBytes,
        )
        return assetUUID
    }

    private func existingBackendAssetId(localAssetId: UUID, sessionId: UUID) async throws -> UUID? {
        guard let context = try await uploadStore?.backendContext(for: localAssetId),
              context.backendSessionId == sessionId
        else { return nil }
        return context.backendAssetId
    }

    private func registerBackendAsset(
        sessionId: UUID,
        originalFilename: String,
        captureTime: Date,
        mime: String,
        sizeBytes: Int64,
    ) async throws -> UUID {
        let asset = try await backend.registerAsset(
            sessionId: sessionId,
            body: .init(
                originalFilename: originalFilename,
                captureTime: captureTime,
                mime: mime,
                sizeBytes: sizeBytes,
            ),
        )
        guard let parsed = UUID(uuidString: asset.id) else {
            throw NSError(domain: "DeliveryService", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "backend returned non-UUID asset id \(asset.id)"
            ])
        }
        return parsed
    }

    private func requireProjectLink(sessionId: UUID, projectId: String?) async throws {
        guard let projectId = projectId?.trimmingCharacters(in: .whitespacesAndNewlines),
              !projectId.isEmpty
        else { return }
        do {
            try await backend.linkSessionToProject(sessionId: sessionId, projectId: projectId)
        } catch {
            throw DeliveryError.projectLinkFailed(String(describing: error))
        }
    }

    private func fileSize(at path: String) throws -> Int64 {
        let values = try URL(fileURLWithPath: path).resourceValues(forKeys: [.fileSizeKey])
        guard let fileSize = values.fileSize, fileSize > 0 else {
            throw NSError(domain: "DeliveryService", code: -4, userInfo: [
                NSLocalizedDescriptionKey: "empty or unreadable file at \(path)"
            ])
        }
        return Int64(fileSize)
    }

    /// Upload one file while retaining only a single multipart chunk in RAM.
    /// Signed URLs are requested in server-advertised batches, which also
    /// supports files whose multipart plan contains more than 100 parts.
    private func uploadFile(
        localAssetId: UUID,
        backendSessionId: UUID,
        assetId: UUID,
        path: String,
        kind: BackendUploadKind,
        mime: String,
        sizeBytes: Int64
    ) async throws {
        let checksum = try sha256(at: path)
        var checkpoint = try await uploadStore?.prepare(
            localAssetId: localAssetId,
            backendAssetId: assetId,
            backendSessionId: backendSessionId,
            kind: kind,
            localPath: path,
            mime: mime,
            sizeBytes: sizeBytes,
            checksumSha256: checksum,
        )
        if checkpoint?.status == "completed" { return }

        let resumedPlan = checkpoint?.hasUsablePlan == true
        var plan = try await resolvePlan(
            checkpoint: checkpoint,
            localAssetId: localAssetId,
            assetId: assetId,
            kind: kind,
            mime: mime,
            sizeBytes: sizeBytes,
        )
        checkpoint = try await uploadStore?.checkpoint(localAssetId: localAssetId, kind: kind)

        do {
            try await uploadPartsAndComplete(
                localAssetId: localAssetId,
                assetId: assetId,
                path: path,
                kind: kind,
                sizeBytes: sizeBytes,
                checksum: checksum,
                plan: plan,
                persistedParts: checkpoint?.completedParts ?? [],
            )
        } catch where resumedPlan && Self.isMissingMultipartUpload(error) {
            // S3 can expire/abort old multipart ids. Start one replacement
            // exactly once; all other failures retain the checkpoint for retry.
            try await uploadStore?.resetPlan(localAssetId: localAssetId, kind: kind)
            plan = try await resolvePlan(
                checkpoint: nil,
                localAssetId: localAssetId,
                assetId: assetId,
                kind: kind,
                mime: mime,
                sizeBytes: sizeBytes,
            )
            try await uploadPartsAndComplete(
                localAssetId: localAssetId,
                assetId: assetId,
                path: path,
                kind: kind,
                sizeBytes: sizeBytes,
                checksum: checksum,
                plan: plan,
                persistedParts: [],
            )
        }
    }

    private func resolvePlan(
        checkpoint: PersistentUploadStore.Checkpoint?,
        localAssetId: UUID,
        assetId: UUID,
        kind: BackendUploadKind,
        mime: String,
        sizeBytes: Int64,
    ) async throws -> BackendUploadPlan {
        if let checkpoint, checkpoint.hasUsablePlan {
            return BackendUploadPlan(
                bucket: "",
                key: checkpoint.objectKey!,
                uploadId: checkpoint.uploadId!,
                partSize: checkpoint.partSize!,
                partCount: checkpoint.partCount!,
                signedUrlTtlSeconds: 0,
                partUrlBatchMax: checkpoint.partUrlBatchMax!,
            )
        }
        let plan = try await backend.startUpload(
            assetId: assetId,
            body: .init(kind: kind, sizeBytes: sizeBytes, mime: mime, preferredPartSize: nil),
        )
        guard plan.partSize > 0, plan.partCount > 0 else {
            throw NSError(domain: "DeliveryService", code: -5, userInfo: [
                NSLocalizedDescriptionKey: "backend returned an invalid multipart plan"
            ])
        }
        try await uploadStore?.savePlan(localAssetId: localAssetId, kind: kind, plan: plan)
        return plan
    }

    private func uploadPartsAndComplete(
        localAssetId: UUID,
        assetId: UUID,
        path: String,
        kind: BackendUploadKind,
        sizeBytes: Int64,
        checksum: String,
        plan: BackendUploadPlan,
        persistedParts: [PersistentUploadStore.Part],
    ) async throws {
        var completed = Dictionary(uniqueKeysWithValues: persistedParts.map { ($0.partNumber, $0.etag) })
        let missing = (1...plan.partCount).filter { completed[$0] == nil }
        let batchSize = max(1, plan.partUrlBatchMax)

        for batchOffset in stride(from: 0, to: missing.count, by: batchSize) {
            let requestedNumbers = Array(missing[batchOffset..<min(missing.count, batchOffset + batchSize)])
            let signed = try await backend.signPartURLs(
                assetId: assetId,
                body: .init(uploadId: plan.uploadId, key: plan.key, partNumbers: requestedNumbers),
            )
            let signedParts = signed.parts.sorted { $0.partNumber < $1.partNumber }
            guard signedParts.map(\.partNumber) == requestedNumbers else {
                throw NSError(domain: "DeliveryService", code: -6, userInfo: [
                    NSLocalizedDescriptionKey: "signed multipart response did not match requested part numbers"
                ])
            }

            for signedPart in signedParts {
                let offset = Int64(signedPart.partNumber - 1) * plan.partSize
                let expectedLength = min(plan.partSize, sizeBytes - offset)
                guard expectedLength > 0, expectedLength <= Int64(Int.max) else {
                    throw NSError(domain: "DeliveryService", code: -7, userInfo: [
                        NSLocalizedDescriptionKey: "multipart plan exceeded the local file"
                    ])
                }
                guard let url = URL(string: signedPart.url) else {
                    throw NSError(domain: "DeliveryService", code: -8, userInfo: [
                        NSLocalizedDescriptionKey: "invalid signed part URL"
                    ])
                }
                let checkpointId = PersistentUploadStore.key(localAssetId: localAssetId, kind: kind)
                let etag: String
                if let partUploader {
                    etag = try await partUploader.uploadPart(
                        sourceFile: URL(fileURLWithPath: path),
                        offset: offset,
                        length: expectedLength,
                        destination: url,
                        checkpointId: checkpointId,
                        partNumber: signedPart.partNumber,
                    )
                } else {
                    let handle = try FileHandle(forReadingFrom: URL(fileURLWithPath: path))
                    defer { try? handle.close() }
                    try handle.seek(toOffset: UInt64(offset))
                    guard let bytes = try handle.read(upToCount: Int(expectedLength)),
                          bytes.count == Int(expectedLength)
                    else {
                        throw NSError(domain: "DeliveryService", code: -7, userInfo: [
                            NSLocalizedDescriptionKey: "file ended before multipart plan was complete"
                        ])
                    }
                    etag = try await backend.putPart(url: url, bytes: bytes)
                }
                completed[signedPart.partNumber] = etag
                try await uploadStore?.savePart(
                    localAssetId: localAssetId,
                    kind: kind,
                    part: .init(partNumber: signedPart.partNumber, etag: etag),
                )
                await partUploader?.acknowledgePart(
                    checkpointId: checkpointId,
                    partNumber: signedPart.partNumber,
                )
            }
        }

        guard completed.count == plan.partCount else {
            throw NSError(domain: "DeliveryService", code: -9, userInfo: [
                NSLocalizedDescriptionKey: "multipart checkpoint is incomplete"
            ])
        }
        let parts = completed
            .map { BackendCompletedPart(partNumber: $0.key, etag: $0.value) }
            .sorted { $0.partNumber < $1.partNumber }
        _ = try await backend.completeUpload(
            assetId: assetId,
            body: .init(
                kind: kind,
                uploadId: plan.uploadId,
                key: plan.key,
                parts: parts,
                checksumSha256: checksum,
                sizeBytes: sizeBytes,
            ),
        )
        try await uploadStore?.markCompleted(localAssetId: localAssetId, kind: kind)
    }

    private func sha256(at path: String) throws -> String {
        let handle = try FileHandle(forReadingFrom: URL(fileURLWithPath: path))
        defer { try? handle.close() }
        var hasher = SHA256()
        while true {
            let data = handle.readData(ofLength: 4 * 1024 * 1024)
            if data.isEmpty { break }
            hasher.update(data: data)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private static func isMissingMultipartUpload(_ error: any Error) -> Bool {
        if let backendError = error as? BackendError {
            switch backendError {
            case .notFound, .httpStatus(404, _): return true
            default: break
            }
        }
        if let uploadError = error as? BackgroundMultipartUploader.UploadError,
           case .httpStatus(404) = uploadError {
            return true
        }
        return false
    }
}
