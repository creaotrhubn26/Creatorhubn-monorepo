import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import Vision

/// Phase 7F (Evoto parity) — face↔body skin-tone unify.
///
/// Evoto exposes two related sliders ("AI Unify Face Complexion"
/// + "AI Unify Body Complexion") that flatten the colour delta
/// between face skin and body skin. The classic case: hands or
/// neck read redder than the face because they were colder /
/// flushed at capture time, or because the photographer used
/// fill-flash on the face only. Industry retouching tutorials
/// (Imagen 2026, Retouching Academy, Phlearn) frame this as
/// "step zero before frequency separation" — get the skin tones
/// agreeing first, then refine texture.
///
/// **Algorithm:**
///   1. Detect face Vision rect.
///   2. Sample mean RGB inside the face rect (down-stride to
///      cap cost on full-res frames).
///   3. Sample mean RGB across plausible body-skin pixels (whole
///      frame minus face rect, filtered by skin-tone heuristic
///      — ratios learned from common skin RGB profiles).
///   4. Compute delta (body → face) and apply a partial colour
///      shift (`amount × delta`) to the body region only, leaving
///      the face untouched.
///
/// **No-op when:**
///   • No faces detected → no reference to unify against
///   • Body-skin pixel count below threshold → not enough signal
///     for a confident sample (cropped portrait, just face fills
///     the frame)
///
/// Cost: one CIDetector face pass + one CIAreaAverage on each of
/// face-rect and body-mask. CIAreaAverage runs on GPU; the whole
/// thing budgets to <30 ms on M-class iPad.
enum SkinToneUnifyFilter {

    static func apply(recipe: MagicRecipe, to image: CIImage) -> CIImage {
        guard recipe.skinUnify > 0 else { return image }

        let extent = image.extent
        guard let faceRect = detectFaceRect(in: image, extent: extent) else {
            return image
        }
        // Face pixel sample
        guard let faceMean = areaAverage(of: image, in: faceRect) else {
            return image
        }
        // 🔑 KROPPS-region = person-maske (Vision) MINUS ansiktsrekten. Den gamle
        // proxyen samplet 4 striper UTENFOR ansiktet — altså gress/brudekjole/
        // himmel — og masken var hvit OVERALT unntatt ansikt. På et bryllupsbilde
        // med grønn bakgrunn ble deltaet «ansikt − gress», og filteret skjøv HELE
        // bildet mot hudfarge (en global fargetint kamuflert som hudverktøy).
        // Nå: personMask ∧ ¬ansikt = faktisk kropps-hud — både til sampling og som
        // korreksjons-maske, så bare kroppen tones.
        guard let mask = bodyMask(for: image, extent: extent, faceRect: faceRect),
              let bodyMean = maskedAverage(of: image, mask: mask, extent: extent) else {
            return image
        }

        // Δ = face − body. Applying +Δ to body pixels shifts them
        // toward face. Scale by amount.
        let amount = Float(recipe.skinUnify)
        let deltaR = Float(faceMean.r - bodyMean.r) * amount
        let deltaG = Float(faceMean.g - bodyMean.g) * amount
        let deltaB = Float(faceMean.b - bodyMean.b) * amount

        // Skip if the delta is tiny — saves a render pass when face
        // and body already agree.
        guard abs(deltaR) > 0.005 || abs(deltaG) > 0.005 || abs(deltaB) > 0.005
        else { return image }

        // Apply additive colour shift via CIColorMatrix. We bias each
        // channel by the delta — a uniform offset is the simplest +
        // most predictable shift; more sophisticated approaches
        // (per-luminance LUT) add complexity for marginal benefit.
        let m = CIFilter.colorMatrix()
        m.inputImage = image
        m.rVector = CIVector(x: 1, y: 0, z: 0, w: 0)
        m.gVector = CIVector(x: 0, y: 1, z: 0, w: 0)
        m.bVector = CIVector(x: 0, y: 0, z: 1, w: 0)
        m.aVector = CIVector(x: 0, y: 0, z: 0, w: 1)
        m.biasVector = CIVector(
            x: CGFloat(deltaR), y: CGFloat(deltaG),
            z: CGFloat(deltaB), w: 0,
        )
        guard let shifted = m.outputImage else { return image }

        let blend = CIFilter.blendWithMask()
        blend.inputImage = shifted
        blend.backgroundImage = image
        blend.maskImage = mask
        return blend.outputImage?.cropped(to: extent) ?? image
    }

    // MARK: - Detection

    private static func detectFaceRect(
        in image: CIImage, extent: CGRect,
    ) -> CGRect? {
        let detector = CIDetector(
            ofType: CIDetectorTypeFace, context: nil,
            options: [CIDetectorAccuracy: CIDetectorAccuracyHigh],
        )
        // STØRSTE ansikt (ikke `.first` — søsterfiltrene bruker også største).
        let faces = (detector?.features(in: image) ?? []).compactMap { $0 as? CIFaceFeature }
        guard let biggest = faces.max(by: {
            $0.bounds.width * $0.bounds.height < $1.bounds.width * $1.bounds.height
        }) else { return nil }
        // Clamp to extent in case face touches the edge.
        return biggest.bounds.intersection(extent)
    }

    // MARK: - Area average

    private struct RGBA {
        let r: CGFloat, g: CGFloat, b: CGFloat
    }

    /// Compute the mean RGB inside a CIImage rect via `CIAreaAverage`.
    /// Returns the 1×1 averaged pixel as 0…1 floats.
    private static func areaAverage(of image: CIImage, in rect: CGRect) -> RGBA? {
        let f = CIFilter.areaAverage()
        f.inputImage = image
        f.extent = rect
        guard let out = f.outputImage else { return nil }
        return readSinglePixel(out)
    }

    /// Kropps-maske = person-maske (Vision) ∧ ¬ansikt. Person-masken hentes fra en
    /// nedskalering (masker trenger ikke full res) og multipliseres med ansikts-
    /// eksklusjonen (svart i ansiktet) → hvit KUN på synlig kropp utenfor ansiktet.
    private static func bodyMask(for image: CIImage, extent: CGRect, faceRect: CGRect) -> CIImage? {
        let side: CGFloat = 1024
        let scale = min(1, side / max(extent.width, extent.height))
        let small = scale < 1 ? image.transformed(by: CGAffineTransform(scaleX: scale, y: scale)) : image
        let ctx = CIContext(options: [.useSoftwareRenderer: false])
        guard let cg = ctx.createCGImage(small, from: small.extent),
              let person = SubjectSegmentation.personMask(for: cg, extent: extent),
              let faceExcl = makeBodyMask(extent: extent, faceRect: faceRect) else { return nil }
        let mult = CIFilter.multiplyCompositing()
        mult.inputImage = person
        mult.backgroundImage = faceExcl
        return mult.outputImage?.cropped(to: extent)
    }

    /// Snitt-RGB av bildet OVER et maske-område: mean(bilde·maske) / mean(maske).
    /// No-op-signal når masken dekker < ~1% (for lite kropp → ikke nok signal).
    private static func maskedAverage(of image: CIImage, mask: CIImage, extent: CGRect) -> RGBA? {
        let mult = CIFilter.multiplyCompositing()
        mult.inputImage = image
        mult.backgroundImage = mask
        guard let masked = mult.outputImage,
              let sum = areaAverage(of: masked, in: extent),
              let cover = areaAverage(of: mask, in: extent),
              cover.r > 0.01 else { return nil }
        return RGBA(r: sum.r / cover.r, g: sum.g / cover.r, b: sum.b / cover.r)
    }

    private static func readSinglePixel(_ image: CIImage) -> RGBA? {
        var bytes = [UInt8](repeating: 0, count: 4)
        let ctx = CIContext(options: [.useSoftwareRenderer: false])
        ctx.render(image,
                   toBitmap: &bytes,
                   rowBytes: 4,
                   bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
                   format: .RGBA8,
                   colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
        return RGBA(
            r: CGFloat(bytes[0]) / 255,
            g: CGFloat(bytes[1]) / 255,
            b: CGFloat(bytes[2]) / 255,
        )
    }

    // MARK: - Mask

    /// Build a "body mask" — white everywhere except the face rect,
    /// which is gradient-faded toward black so the unify shift skips
    /// the face. Soft edge at ~5% of the face rect's height to avoid
    /// a visible ring at the jawline.
    private static func makeBodyMask(extent: CGRect, faceRect: CGRect) -> CIImage? {
        let white = CIImage(color: CIColor(red: 1, green: 1, blue: 1))
            .cropped(to: extent)
        // Radial gradient centered on face rect: black inside, white
        // at the soft transition radius.
        let radius0 = Float(min(faceRect.width, faceRect.height) * 0.5)
        let radius1 = radius0 + Float(faceRect.height * 0.05)
        let g = CIFilter.radialGradient()
        g.center = CGPoint(x: faceRect.midX, y: faceRect.midY)
        g.radius0 = radius0
        g.radius1 = radius1
        g.color0 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        g.color1 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
        guard let gradient = g.outputImage?.cropped(to: extent) else {
            return white
        }
        // Multiply gradient with white background so we end up with
        // a mask that's black inside face → white in body → cropped.
        let comp = CIFilter.multiplyCompositing()
        comp.inputImage = gradient
        comp.backgroundImage = white
        return comp.outputImage?.cropped(to: extent)
    }
}
