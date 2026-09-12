import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

/// Phase 7B (Evoto parity) — eye-region sharpen + catch-light boost
/// applied through a soft radial-gradient mask centred on each detected
/// eye. Detection runs through `CIDetector` (face landmarks come for
/// free, no Vision-framework integration needed). When detection fails
/// — closed eyes, deep shadow, extreme angle — the function returns
/// the input unchanged rather than guessing where the eyes are.
///
/// Mask geometry scales with image dimension (8% / 1.8% of long edge
/// for outer / inner radii), so a 5000-px preview and an 8192-px R5
/// frame both end up with proportionally matched eye regions instead
/// of "huge spotlight" or "pinhole" mask artefacts. The same mask is
/// reused for both effects when both axes fire — one detection pass
/// covers the whole bilde.
enum EyeEffectFilter {

    /// Apply both eye axes to `image` if either is non-zero, otherwise
    /// short-circuit. Returns the input unchanged when no faces are
    /// detected so the rest of the pipeline can rely on a non-nil
    /// CIImage.
    static func apply(
        recipe: MagicRecipe,
        to image: CIImage,
        ciContext: CIContext? = nil,
    ) -> CIImage {
        guard recipe.eyeSharpen > 0 || recipe.eyeCatchlight > 0 else {
            return image
        }
        let eyes = detectEyes(in: image)
        guard !eyes.isEmpty else { return image }
        guard let mask = makeMask(in: image, eyes: eyes) else { return image }

        var current = image

        if recipe.eyeSharpen > 0 {
            let sharpen = CIFilter.unsharpMask()
            sharpen.inputImage = current
            sharpen.radius = 2.5
            sharpen.intensity = Float(recipe.eyeSharpen) * 0.8
            if let sharpened = sharpen.outputImage {
                let blend = CIFilter.blendWithMask()
                blend.inputImage = sharpened
                blend.backgroundImage = current
                blend.maskImage = mask
                current = blend.outputImage?.cropped(to: image.extent) ?? current
            }
        }

        if recipe.eyeCatchlight > 0 {
            let boost = CIFilter.exposureAdjust()
            boost.inputImage = current
            boost.ev = Float(recipe.eyeCatchlight) * 0.4   // up to ~+0.4 EV inside eye region
            if let boosted = boost.outputImage {
                let blend = CIFilter.blendWithMask()
                blend.inputImage = boosted
                blend.backgroundImage = current
                blend.maskImage = mask
                current = blend.outputImage?.cropped(to: image.extent) ?? current
            }
        }

        return current
    }

    // MARK: - Detection

    /// Returns one (left, right) tuple per detected face that has both
    /// eye landmarks set. `CIDetector` returns image-space coordinates
    /// matching the input CIImage's `extent` — no transforms needed
    /// before feeding them into a `CIRadialGradient`.
    static func detectEyes(in image: CIImage) -> [(left: CGPoint, right: CGPoint)] {
        let detector = CIDetector(
            ofType: CIDetectorTypeFace,
            context: nil,
            options: [
                CIDetectorAccuracy: CIDetectorAccuracyHigh,
                CIDetectorImageOrientation: 1  // CGImagePropertyOrientation.up
            ],
        )
        let features = detector?.features(in: image) ?? []
        return features.compactMap { f in
            guard let face = f as? CIFaceFeature,
                  face.hasLeftEyePosition,
                  face.hasRightEyePosition else { return nil }
            return (face.leftEyePosition, face.rightEyePosition)
        }
    }

    // MARK: - Mask

    /// Build a single white-on-black mask covering all detected eyes.
    /// Each eye gets a radial gradient (inner = full white, outer =
    /// black) and we composite them with `CIAdditionCompositing` so
    /// overlapping eyes brighten rather than clip.
    static func makeMask(
        in image: CIImage,
        eyes: [(left: CGPoint, right: CGPoint)],
    ) -> CIImage? {
        let extent = image.extent
        let dim = max(extent.width, extent.height)
        // Radii calibrated against R5 portraits (8192 long edge): inner
        // ≈98 px = full sharpen, outer ≈205 px = falloff to zero. Scale
        // by long-edge so previews and full-res both land right.
        let innerRadius = Float(dim * 0.012)
        let outerRadius = Float(dim * 0.025)

        let black = CIImage(color: CIColor(red: 0, green: 0, blue: 0))
            .cropped(to: extent)
        var mask: CIImage = black

        for (left, right) in eyes {
            for centre in [left, right] {
                let g = CIFilter.radialGradient()
                g.center = centre
                g.radius0 = innerRadius
                g.radius1 = outerRadius
                g.color0 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
                g.color1 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
                guard let gradient = g.outputImage?.cropped(to: extent) else {
                    continue
                }
                let comp = CIFilter.additionCompositing()
                comp.inputImage = gradient
                comp.backgroundImage = mask
                if let combined = comp.outputImage?.cropped(to: extent) {
                    mask = combined
                }
            }
        }
        return mask
    }
}
