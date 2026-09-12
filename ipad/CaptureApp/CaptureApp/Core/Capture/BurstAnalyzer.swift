import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import Vision

/// Phase 8B — Quality scoring for burst frames.
///
/// **Strategy:** combine two signals so we score both portrait and
/// non-portrait subjects with the same API:
///
///   1. **Face quality** (VNDetectFaceCaptureQualityRequest, iOS 13+)
///      — Apple's ML-trained metric for "is this a good capture of
///      this face": penalises closed eyes, motion blur on the face,
///      facial occlusion, strong shadows. Returns 0…1 per face.
///      We use the highest-scoring face as the frame score.
///
///   2. **Sharpness fallback** (Laplacian variance, manual) — when
///      no faces are detected (food, landscape, product), or when
///      face quality is unavailable, score by edge sharpness via
///      Laplacian-of-luminance variance. Higher variance = sharper
///      frame. Normalised to 0…1 against an empirical reference
///      threshold (0.05 = soft / motion-blurred, 0.50 = tack-sharp
///      tested against R5 on tripod).
///
/// **What we're scoring FOR:** "of these 3-50 burst frames, which
/// 3 should the photographer keep?" Not "is this objectively good
/// art" — face capture quality + sharpness are the unambiguous
/// "no-brainer reject" signals (closed eyes, motion blur). Style /
/// composition stays manual.
///
/// **No-op when image cannot be loaded** — returns nil; caller
/// treats nil as "skip from picks ranking".
@MainActor
enum BurstAnalyzer {

    /// Score a single image. Returns 0…1 (higher = better) or nil if
    /// the image couldn't be loaded.
    static func score(imagePath: String) async -> Double? {
        guard let ci = loadCIImage(at: imagePath) else { return nil }

        // Run face quality on a downsample for speed — Vision works
        // fine at 1024 px, doesn't gain meaningful accuracy from
        // full-res.
        let downsampled = downsample(ci, longEdge: 1024)
        let faceScore = await faceCaptureQuality(in: downsampled)
        if let f = faceScore {
            return f
        }

        // No faces — fall back to sharpness. Laplacian variance is
        // cheap on the 1024-px downsample.
        return sharpnessScore(in: downsampled)
    }

    // MARK: - Face quality

    private static func faceCaptureQuality(in image: CIImage) async -> Double? {
        let request = VNDetectFaceCaptureQualityRequest()
        request.revision = VNDetectFaceCaptureQualityRequestRevision2
        let handler = VNImageRequestHandler(ciImage: image, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return nil
        }
        guard let faces = request.results, !faces.isEmpty else { return nil }
        // Best of all detected faces. Multi-subject portraits (group
        // shots) score by the strongest face — closing eyes on a
        // background extra is fine, closing eyes on the bride is not.
        let best = faces
            .compactMap { $0.faceCaptureQuality.map(Double.init) }
            .max()
        return best
    }

    // MARK: - Sharpness fallback

    /// Laplacian variance of the luminance channel, normalised to 0…1.
    /// Higher = sharper (more high-frequency detail). Empirical
    /// reference threshold of 0.5 maps to "tack-sharp on R5 tripod".
    /// Below 0.05 reads as "noticeably soft / motion-blurred".
    private static func sharpnessScore(in image: CIImage) -> Double {
        // Convert to luminance via CIPhotoEffectMono (preserves levels
        // unlike grayscale conversion through saturation drop).
        let mono = CIFilter.photoEffectMono()
        mono.inputImage = image
        let lum = mono.outputImage ?? image

        // 3×3 Laplacian kernel: high-pass filter that emphasises
        // edges. Variance of the result correlates strongly with
        // image sharpness (well-known computer-vision proxy).
        let kernel: [CGFloat] = [
            0, -1, 0,
           -1, 4, -1,
            0, -1, 0
        ]
        let convolution = CIFilter.convolution3X3()
        convolution.inputImage = lum
        convolution.weights = CIVector(values: kernel, count: 9)
        convolution.bias = 0
        guard let edges = convolution.outputImage else { return 0 }

        // Variance via CIAreaAverage on the squared image. The mean of
        // the squared values minus the squared mean gives variance —
        // for a high-pass filter mean is ~0, so squared-mean is ~variance.
        let squared = CIFilter.colorMatrix()
        squared.inputImage = edges
        // bias tweaks each channel; we want pixel × pixel for variance,
        // approximated via CIMultiplyCompositing of the image with itself.
        let mult = CIFilter.multiplyCompositing()
        mult.inputImage = edges
        mult.backgroundImage = edges
        guard let squaredImage = mult.outputImage else { return 0 }

        let avg = CIFilter.areaAverage()
        avg.inputImage = squaredImage
        avg.extent = squaredImage.extent
        guard let avgImage = avg.outputImage else { return 0 }

        // Read 1×1 averaged pixel
        var bytes = [UInt8](repeating: 0, count: 4)
        let ctx = CIContext(options: [.useSoftwareRenderer: false])
        ctx.render(
            avgImage,
            toBitmap: &bytes, rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8,
            colorSpace: CGColorSpace(name: CGColorSpace.sRGB),
        )
        // R+G+B luminance proxy in 0…255 range
        let lumByte = (Double(bytes[0]) + Double(bytes[1]) + Double(bytes[2])) / 3.0 / 255.0
        // Normalise: 0.5 = tack-sharp reference, clamp to 0…1
        return min(1.0, lumByte * 2.0)
    }

    // MARK: - Helpers

    private static func loadCIImage(at path: String) -> CIImage? {
        let url = URL(fileURLWithPath: path)
        return CIImage(contentsOf: url)
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

/// Phase 8B — Pick the top N from a scored burst group.
/// Deterministic: stable by (score desc, captureTime asc) so
/// repeated runs produce the same picks.
enum BurstPicker {

    /// Default picks per burst — 3 is the industry rule of thumb
    /// ("give me the best one, the second best, and one wide for
    /// safety"). Configurable so dance-vertical or sports work
    /// can dial up.
    static let defaultPicksPerBurst = 3

    struct Scored: Equatable {
        let assetId: UUID
        let captureTime: Date
        let score: Double?
    }

    /// Return the top-N asset IDs. Ties broken by earlier capture
    /// time (the photographer's first attempt wins on equal score).
    /// Assets with nil score sort to the bottom.
    static func topPicks(
        from scored: [Scored],
        count: Int = defaultPicksPerBurst,
    ) -> Set<UUID> {
        guard count > 0 else { return [] }
        let ranked = scored.sorted { lhs, rhs in
            switch (lhs.score, rhs.score) {
            case let (l?, r?):
                if l != r { return l > r }
                return lhs.captureTime < rhs.captureTime
            case (.some, .none): return true
            case (.none, .some): return false
            case (.none, .none): return lhs.captureTime < rhs.captureTime
            }
        }
        return Set(ranked.prefix(count).map { $0.assetId })
    }
}
