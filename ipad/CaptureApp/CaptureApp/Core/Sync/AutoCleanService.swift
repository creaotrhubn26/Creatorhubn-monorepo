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
}

extension BackendClient: AutoCleanBackend {}

struct AutoCleanService: Sendable {
    let store: SessionStore
    let backend: any AutoCleanBackend

    /// Run the full detect+inpaint round-trip for a single asset.
    /// Caller hands us the asset (with previewKey populated) and a
    /// session-scoped directory to write the cleaned JPEG into.
    /// Errors are logged + swallowed so a flaky network call never
    /// breaks the surrounding shoot flow.
    func processAsset(_ asset: Asset, downloadDir: URL) async {
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
            // distinguish "ran clean" from "didn't run".
            try? await store.attachAutoCleanedKey(
                id: asset.id, key: nil, detectionCount: 0,
            )
            return
        }

        // Build a binary PNG mask covering every detection.
        guard let imageDimensions = imageDimensions(of: imageData) else {
            return
        }
        guard let maskPng = buildMaskPng(
            dimensions: imageDimensions,
            bboxes: detections.map { $0.bbox },
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
            id: asset.id, key: dest.path, detectionCount: detections.count,
        )
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
