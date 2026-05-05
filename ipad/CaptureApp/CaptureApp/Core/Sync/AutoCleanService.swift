import Foundation
import UIKit

/// Slice 4 — auto-clean orchestration.
///
/// For each freshly-arrived asset (when the photographer has the
/// "Auto-rens utstyr"-toggle on), this service:
///
///   1. Reads the local preview JPEG off disk.
///   2. Calls /api/photo-enhancer/detect-distractions with that JPEG.
///      Claude returns a list of stray studio equipment (cables,
///      stands, flash heads) with bbox-es + confidence.
///   3. If 0 detections, attaches the result with `detectionCount = 0`
///      and stops — that's a clean shot, no work needed.
///   4. Builds a binary PNG mask client-side covering every detection.
///   5. Calls /api/photo-enhancer/inpaint with image + mask. The
///      `skipPlanner=1` flag routes directly to the patch_clone
///      executor with synthesised donors — sparing the Claude planner
///      round-trip we already paid for in step 2.
///   6. Decodes the base64 JPEG response, writes it to disk, and
///      attaches the local path via `SessionStore.attachAutoCleanedKey`.
///
/// Best-effort: any failure (no network, server 5xx, decode error)
/// just logs and exits without touching the asset. The viewer falls
/// back to the original `previewKey` when `autoCleanedKey` is nil.
///
/// Why this is a service (not inline in LiveCaptureModel): the Capture
/// path needs to fire-and-forget per-asset work without blocking the
/// next CCAPI shot delivery, and the iPad Capture-Showcase bridge will
/// piggyback on the same machinery in Slice 5 when we wire the
/// cleaned variant through to the web gallery.

/// Narrow backend surface AutoCleanService depends on. Defined as a
/// protocol so tests can inject an in-memory stand-in without
/// subclassing BackendClient (which is an actor and can't be subclassed
/// under Swift 6). Mirrors the QuickTeaserBackend pattern.
protocol AutoCleanBackend: Sendable {
    func detectDistractions(
        imageData: Data,
        imageMimeType: String,
    ) async throws -> BackendDistractionsResponse

    func requestPhotoEnhancerInpaint(
        imageData: Data,
        imageMimeType: String,
        maskPngData: Data,
        intensity: Double,
    ) async throws -> BackendInpaintResponse

    /// Slice 6 — push the cleaned JPEG up to the capture R2 bucket so
    /// the Showcase bridge can later surface it to the client gallery.
    /// Best-effort from the service's perspective — a failure here
    /// just means the cleaned variant stays iPad-local, the gallery
    /// shows the original. The server records the deterministic R2
    /// key on the captureAssets row.
    func uploadCleanedVariant(
        sessionId: UUID,
        assetId: UUID,
        cleanedJpegData: Data,
        detectionCount: Int,
    ) async throws -> BackendCleanedVariantResponse
}

extension BackendClient: AutoCleanBackend {}

/// Slice 7 — three-mode picker that drives AutoCleanService behaviour.
/// `.off` means no detect runs at all. `.review` runs detect and stashes
/// findings on Asset.pendingDetections so the photographer can confirm
/// per-detection in DetectionReviewSheet. `.autoClean` runs the full
/// detect+inpaint pipeline silently (Slice 4 behaviour).
enum AutoCleanMode: String, CaseIterable, Sendable, Codable {
    case off
    case review
    case autoClean
}

struct AutoCleanService: Sendable {
    let store: SessionStore
    let backend: any AutoCleanBackend

    /// Run detect for a single asset, then either inpaint silently
    /// (mode .autoClean) or stash findings for photographer review
    /// (mode .review). Caller hands us the asset (with previewKey
    /// populated), a session-scoped download directory, and the
    /// current mode. Errors logged + swallowed so a flaky network
    /// call never breaks the surrounding shoot flow.
    ///
    /// `.off` is treated as "no-op" but the dispatcher in
    /// LiveCaptureModel guards against the call upstream — accepting
    /// it here too keeps the contract simple.
    func processAsset(_ asset: Asset, downloadDir: URL, mode: AutoCleanMode) async {
        if mode == .off { return }

        guard let previewKey = asset.previewKey else {
            return
        }
        let previewURL = URL(fileURLWithPath: previewKey)
        guard let imageData = try? Data(contentsOf: previewURL) else {
            return
        }

        let detections: [BackendDistraction]
        do {
            let resp = try await backend.detectDistractions(
                imageData: imageData,
                imageMimeType: asset.mime,
            )
            detections = resp.detections
        } catch {
            #if DEBUG
            print("[AutoCleanService] detect failed for asset \(asset.id): \(error)")
            #endif
            return
        }

        if detections.isEmpty {
            // Pass ran, found nothing. Mark as such so the UI can
            // distinguish "ran clean" from "didn't run". Same for
            // both modes — review-mode also wants to surface "we
            // looked, nothing to flag".
            try? await store.attachAutoCleanedKey(
                id: asset.id, key: nil, detectionCount: 0,
            )
            return
        }

        // Slice 7 review mode: stash detections, stop. The photographer
        // commits via processConfirmedDetections (called from
        // DetectionReviewSheet) which then runs the inpaint with the
        // chosen subset.
        if mode == .review {
            let pending = PendingDetectionsList(
                detections: detections.map { d in
                    PendingDetection(
                        id: d.id,
                        type: d.type,
                        bbox: PendingBbox(x: d.bbox.x, y: d.bbox.y, w: d.bbox.w, h: d.bbox.h),
                        confidence: d.confidence,
                        description: d.description,
                    )
                }
            )
            try? await store.attachPendingDetections(id: asset.id, list: pending)
            return
        }

        // Auto-clean mode (Slice 4 behaviour): all detections become a
        // single mask, run inpaint, save + upload.
        await runInpaintAndPersist(
            asset: asset,
            imageData: imageData,
            detectionsForMask: detections.map { $0.bbox },
            detectionCount: detections.count,
            downloadDir: downloadDir,
        )
    }

    /// Slice 7 — called from DetectionReviewSheet after the
    /// photographer ticks which pending detections to actually remove.
    /// Runs inpaint with just the chosen subset, persists the cleaned
    /// variant, clears pendingDetections regardless of outcome (review
    /// is committed even if no detections were selected — that's how
    /// the photographer dismisses without inpainting).
    func processConfirmedDetections(
        asset: Asset,
        selectedDetectionIds: Set<String>,
        downloadDir: URL,
    ) async {
        // Always clear pending — committed reviews don't reappear.
        defer {
            Task { try? await self.store.attachPendingDetections(id: asset.id, list: nil) }
        }

        guard let pending = asset.pendingDetections, !pending.isEmpty else {
            return
        }
        let selected = pending.detections.filter { selectedDetectionIds.contains($0.id) }
        if selected.isEmpty {
            // Photographer dismissed everything — record as "ran clean
            // 0 removed" so the badge state is consistent with "we
            // looked, nothing was kept".
            try? await store.attachAutoCleanedKey(
                id: asset.id, key: nil, detectionCount: 0,
            )
            return
        }

        guard let previewKey = asset.previewKey,
              let imageData = try? Data(contentsOf: URL(fileURLWithPath: previewKey))
        else { return }

        await runInpaintAndPersist(
            asset: asset,
            imageData: imageData,
            detectionsForMask: selected.map {
                BackendBbox(x: $0.bbox.x, y: $0.bbox.y, w: $0.bbox.w, h: $0.bbox.h)
            },
            detectionCount: selected.count,
            downloadDir: downloadDir,
        )
    }

    /// Shared inner: build mask, call inpaint, save + upload. Used by
    /// both auto-clean mode (all detections) and review-confirm mode
    /// (subset). Best-effort — failures are logged + swallowed so the
    /// asset just keeps its pre-inpaint state.
    private func runInpaintAndPersist(
        asset: Asset,
        imageData: Data,
        detectionsForMask: [BackendBbox],
        detectionCount: Int,
        downloadDir: URL,
    ) async {
        // Build a binary PNG mask covering every selected bbox.
        guard let imageDimensions = imageDimensions(of: imageData) else {
            return
        }
        guard let maskPng = buildMaskPng(
            dimensions: imageDimensions,
            bboxes: detectionsForMask,
        ) else {
            return
        }

        let inpaintResponse: BackendInpaintResponse
        do {
            inpaintResponse = try await backend.requestPhotoEnhancerInpaint(
                imageData: imageData,
                imageMimeType: asset.mime,
                maskPngData: maskPng,
                intensity: 1.0,
            )
        } catch {
            #if DEBUG
            print("[AutoCleanService] inpaint failed for asset \(asset.id): \(error)")
            #endif
            return
        }

        guard let cleanedBytes = Data(base64Encoded: inpaintResponse.imageBase64) else {
            return
        }

        // Persist alongside the other variants. One file per asset id
        // — re-running auto-clean overwrites in place, which matches
        // the photographer's mental model (only one cleaned version
        // per shot).
        let cleanedDir = downloadDir.appendingPathComponent("autoclean", isDirectory: true)
        try? FileManager.default.createDirectory(at: cleanedDir, withIntermediateDirectories: true)
        let dest = cleanedDir.appendingPathComponent("\(asset.id.uuidString).jpg")
        do {
            try cleanedBytes.write(to: dest, options: .atomic)
        } catch {
            #if DEBUG
            print("[AutoCleanService] failed to persist cleaned JPEG for \(asset.id): \(error)")
            #endif
            return
        }

        try? await store.attachAutoCleanedKey(
            id: asset.id, key: dest.path, detectionCount: detectionCount,
        )

        // Slice 6 — push the cleaned bytes up to R2 so it's available
        // when the photographer hits Deliver. Fire-and-forget at this
        // layer: we already have the local copy attached, and the
        // bridge's pickAssetsFromCaptureSession defaults to "skip
        // cleaned variant" when captureAssets.auto_cleaned_key is
        // null. So a failed upload simply means the gallery surfaces
        // only the original — degraded, not broken.
        do {
            _ = try await backend.uploadCleanedVariant(
                sessionId: asset.sessionId,
                assetId: asset.id,
                cleanedJpegData: cleanedBytes,
                detectionCount: detectionCount,
            )
        } catch {
            #if DEBUG
            print("[AutoCleanService] cleaned-variant upload failed for \(asset.id): \(error)")
            #endif
        }
    }

    // MARK: - Helpers

    private func imageDimensions(of data: Data) -> (width: Int, height: Int)? {
        guard let image = UIImage(data: data) else { return nil }
        let cg = image.cgImage
        let w = cg?.width ?? Int(image.size.width)
        let h = cg?.height ?? Int(image.size.height)
        guard w > 0, h > 0 else { return nil }
        return (w, h)
    }

    /// Build a single-channel-style mask: solid black canvas with a
    /// white rectangle per detection bbox. Encoded as PNG (greyscale
    /// works fine — sharp on the server reads it as a binary mask).
    /// We render via UIGraphicsImageRenderer at 1.0 scale so pixel
    /// coordinates match server-side bbox coordinates exactly — no
    /// scale-factor surprises that would shift the mask off the
    /// objects.
    private func buildMaskPng(
        dimensions: (width: Int, height: Int),
        bboxes: [BackendBbox],
    ) -> Data? {
        let size = CGSize(width: dimensions.width, height: dimensions.height)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1.0
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let image = renderer.image { _ in
            UIColor.black.setFill()
            UIBezierPath(rect: CGRect(origin: .zero, size: size)).fill()
            UIColor.white.setFill()
            for b in bboxes {
                let rect = CGRect(x: b.x, y: b.y, width: b.w, height: b.h)
                UIBezierPath(rect: rect).fill()
            }
        }
        return image.pngData()
    }
}
