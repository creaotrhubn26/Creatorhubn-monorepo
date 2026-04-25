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

    init(backend: BackendClient) {
        self.backend = backend
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
        /// part-size buffer.
        let previewPath: String
        /// Optional linkage back to the project's shot list. When both
        /// are set and the upload completes, we POST to
        /// /api/projects/:projectId/shots/:shotId/link-asset so the
        /// web side of the shot list flips to "completed" in real time.
        /// Phase 2B Lag D follow-up.
        var projectId: String? = nil
        var shotId: String? = nil
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

    private func uploadOne(pick: DeliverableAsset, sessionId: UUID) async throws -> UUID {
        let data = try Data(contentsOf: URL(fileURLWithPath: pick.previewPath))
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
                print("[DeliveryService] linkShotToAsset failed: \(error)")
            }
        }

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
