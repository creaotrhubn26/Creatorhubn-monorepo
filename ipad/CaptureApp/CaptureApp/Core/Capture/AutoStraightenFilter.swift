import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import Vision

/// Phase 7C — auto-straighten / horizon levelling.
///
/// Vision's `VNDetectHorizonRequest` (iOS 11+, ML-backed) returns the
/// rotation angle needed to level a tilted horizon. We feed it a
/// downsampled copy (1024 px long edge) for speed — detection is
/// scale-invariant within reason, and on a 8192×5464 full-frame the
/// difference between detecting on 1024 vs 8192 is sub-tenth of a
/// degree but ~50× faster. The detected angle then drives `CIStraighten
/// Filter`, which is Apple's built-in straighten + auto-crop combo
/// (rotates the source image by the specified angle, then scales and
/// crops the result to fit within the original extent — no black
/// corners to clean up afterwards).
///
/// Detection failure modes:
///   • No clear horizon (close-up portrait, food, product studio) →
///     `VNDetectHorizonRequest.results` is empty, we no-op.
///   • Confidence below threshold (we use ≥0.5) → no-op rather than
///     applying a guess.
///   • Detected angle |θ| > 15° → almost certainly mis-detection
///     (a wedge, table edge, etc. mistaken for horizon), no-op.
/// Net effect: when auto-straighten is on but detection isn't
/// confident, the image passes through unchanged. Photographer can
/// still drive `straightenAngle` manually.
enum AutoStraightenFilter {

    /// Maximum detected/manual angle we'll apply, in radians.
    /// 15° = 0.2618 rad. Beyond this a "horizon" detection is almost
    /// always a misdetection on a structural line (table edge, wedge
    /// of light); manual correction beyond 15° is also unusual outside
    /// of dutch-tilt creative work, which the photographer will do in
    /// the regular crop tool, not via straighten.
    static let maxAngle: CGFloat = 0.2618

    /// Apply auto-straighten and/or manual angle to the image.
    /// Resolution order:
    ///   1. If `recipe.autoStraighten` is true, run detection. If
    ///      detection succeeds (confident + within bounds), use that
    ///      angle and ignore manual.
    ///   2. Else if `recipe.straightenAngle` is non-zero, use it.
    ///   3. Else return input unchanged.
    /// Detection is intentionally synchronous on the calling thread —
    /// it's already fast on the downsampled 1024-px input (~50ms on
    /// M-series iPad) and the pipeline runs on a render queue, not
    /// the main thread.
    static func apply(recipe: MagicRecipe, to image: CIImage) -> CIImage {
        let angle = resolveAngle(recipe: recipe, in: image)
        guard let angle, abs(angle) > 0.001 else { return image }

        let straighten = CIFilter.straighten()
        straighten.inputImage = image
        straighten.angle = Float(angle)
        return straighten.outputImage ?? image
    }

    /// Returns the angle (radians) we should apply, or nil for no-op.
    /// Public so render-tests can observe what auto-detection produced
    /// without re-running it.
    static func resolveAngle(recipe: MagicRecipe, in image: CIImage) -> CGFloat? {
        if recipe.autoStraighten {
            if let detected = detectHorizonAngle(in: image),
               abs(detected) <= maxAngle {
                // Vision returns the angle the horizon is tilted at;
                // CIStraightenFilter rotates by the supplied angle to
                // level it. Empirically, signs match — pass through
                // directly. (If your render comes out tilting the
                // wrong way after a Vision API change, negate here.)
                return detected
            }
            // Auto requested but detection failed/confidence-rejected;
            // fall through to manual override if provided.
        }
        if abs(recipe.straightenAngle) > 0.001,
           abs(recipe.straightenAngle) <= maxAngle {
            return CGFloat(recipe.straightenAngle)
        }
        return nil
    }

    // MARK: - Detection

    private static func detectHorizonAngle(in image: CIImage) -> CGFloat? {
        // Downsample for detection — Vision is happy with ~1024 px on
        // the long edge, and detection runtime drops by ~50× vs full
        // 8192. Use Lanczos for clean downscale (preserves the linear
        // structures the horizon detector keys on).
        let downsampled = downsample(image, longEdge: 1024)

        let request = VNDetectHorizonRequest()
        let handler = VNImageRequestHandler(ciImage: downsampled, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return nil
        }
        guard let result = request.results?.first else { return nil }
        // Vision returns confidence on most observations but
        // VNHorizonObservation specifically does not surface one as
        // of iOS 26. We rely on the magnitude bound (`maxAngle`) and
        // the no-result short-circuit above to filter mis-detections.
        let angle = result.angle
        guard angle.isFinite else { return nil }
        return angle
    }

    private static func downsample(_ image: CIImage, longEdge: CGFloat) -> CIImage {
        let extent = image.extent
        let long = max(extent.width, extent.height)
        guard long > longEdge else { return image }
        let scale = longEdge / long
        let lanczos = CIFilter.lanczosScaleTransform()
        lanczos.inputImage = image
        lanczos.scale = Float(scale)
        lanczos.aspectRatio = 1
        return lanczos.outputImage ?? image
    }
}
