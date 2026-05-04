import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import CoreGraphics
import Vision

/// Phase 7D — Teeth whitening, masked to the mouth-opening polygon
/// returned by `VNDetectFaceLandmarksRequest.innerLips`.
///
/// **Algorithm** (mirrors the canonical Photoshop technique
/// documented across Adobe / Phlearn / SLR Lounge / Digital Trends
/// tutorials, 2026 industry consensus):
///   1. Detect face landmarks → `innerLips` polygon (the mouth
///      opening, where teeth show).
///   2. Render the polygon into a CGContext as a soft mask
///      (Gaussian-feathered edge so the correction blends rather
///      than cliffs at the lip border).
///   3. Inside the masked region:
///      a. Temperature shift toward cool (~−800 K at amount=1.0) —
///         neutralises the yellow tint without going neon-white.
///      b. Saturation drop (~×0.80 at amount=1.0) — kills residual
///         yellow saturation that the temperature shift leaves.
///      c. Mild luminance lift (~+0.04 brightness at amount=1.0) —
///         just enough sparkle, not "TV-anchor white".
///   4. Composite back into the original via `CIBlendWithMask`.
///
/// The recipe sticks to the industry rule: **never push past
/// teethWhiten = 0.40 unless you specifically want the unrealistic
/// look**. Adobe's own tutorial says "the goal is not to make teeth
/// pure white. The goal is to create natural brightness that
/// enhances the smile while preserving realistic texture, soft
/// shadows, and depth." Our default portrait preset uses 0.20.
///
/// **No-op when:** no faces detected, or no `innerLips` landmark
/// available (rare — Vision returns it on most faces with visible
/// mouths). Closed-mouth subjects have a degenerate inner-lips
/// polygon (very thin); the mask is small but the effect on a
/// small region is also tiny, so we don't special-case it.
enum TeethWhiteningFilter {

    /// Apply teeth-whitening to the image if `recipe.teethWhiten > 0`.
    /// Returns the input unchanged when detection fails — never
    /// applies the cool-shift to the whole face.
    static func apply(recipe: MagicRecipe, to image: CIImage) -> CIImage {
        guard recipe.teethWhiten > 0 else { return image }

        let mouths = detectMouths(in: image)
        guard !mouths.isEmpty,
              let mask = makeMask(in: image, mouths: mouths)
        else { return image }

        let amount = recipe.teethWhiten

        // 1. Cool the white point — pulls yellow back toward neutral.
        //    Pre-cool by ~800 K at amount 1.0; the larger the recipe
        //    value, the further from "warm tooth enamel" the output
        //    drifts. CITemperatureAndTint operates on the whole image;
        //    the mask limits where it actually applies.
        let temp = CIFilter.temperatureAndTint()
        temp.inputImage = image
        temp.neutral = CIVector(x: 6500, y: 0)
        temp.targetNeutral = CIVector(x: 6500 - 800 * amount, y: 0)
        guard let cooled = temp.outputImage else { return image }

        // 2. Saturation drop on the cooled output. The temperature
        //    shift took care of most of the yellow, but a cool image
        //    can still have residual saturation that reads as "tinted"
        //    — squeezing it out gets us toward neutral white.
        let satFilter = CIFilter.colorControls()
        satFilter.inputImage = cooled
        satFilter.saturation = Float(1.0 - 0.20 * amount)
        satFilter.contrast = 1.0
        satFilter.brightness = 0
        guard let desat = satFilter.outputImage else { return image }

        // 3. Mild luminance lift. Industry rule: 0.04 at full strength
        //    is the sweet spot for "the smile pops" without blowing
        //    enamel highlights. Going past 0.08 starts looking
        //    flashlit even at moderate slider values.
        let bright = CIFilter.colorControls()
        bright.inputImage = desat
        bright.brightness = Float(0.04 * amount)
        bright.contrast = 1.0
        bright.saturation = 1.0
        guard let lifted = bright.outputImage else { return image }

        // 4. Composite back into original via the soft polygon mask.
        let blend = CIFilter.blendWithMask()
        blend.inputImage = lifted
        blend.backgroundImage = image
        blend.maskImage = mask
        return blend.outputImage?.cropped(to: image.extent) ?? image
    }

    // MARK: - Detection

    /// Returns one `innerLips` polygon per detected face. Polygon
    /// points are mapped from Vision's normalised face-bounding-box
    /// coordinates back into image-space pixel coordinates. Empty
    /// when detection fails or no faces are seen.
    static func detectMouths(in image: CIImage) -> [[CGPoint]] {
        let request = VNDetectFaceLandmarksRequest()
        let handler = VNImageRequestHandler(ciImage: image, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return []
        }
        let extent = image.extent
        return (request.results ?? []).compactMap { obs in
            guard let inner = obs.landmarks?.innerLips else { return nil }
            // Vision returns landmarks normalised to the face bounding
            // box (0…1 within the face rect). Map them back to the
            // full image's pixel coordinate space.
            let faceRect = obs.boundingBox  // normalised image-space
            let faceX = faceRect.origin.x * extent.width
            let faceY = faceRect.origin.y * extent.height
            let faceW = faceRect.size.width * extent.width
            let faceH = faceRect.size.height * extent.height
            let normalised = inner.normalizedPoints
            return normalised.map { p in
                CGPoint(
                    x: faceX + CGFloat(p.x) * faceW,
                    y: faceY + CGFloat(p.y) * faceH,
                )
            }
        }
    }

    // MARK: - Mask

    /// Render a soft-edge mask covering all detected mouth polygons.
    /// We draw filled white polygons into a CGContext, then convert
    /// to CIImage and blur for the feathered edge. Blur radius scales
    /// with image dimension so previews and full-res both produce
    /// proportionally-feathered masks (roughly 0.4% of the long edge,
    /// ≈30 px on an 8192-wide R5 frame — small enough that the mask
    /// follows the lip border tightly, large enough that the
    /// transition isn't visible as a hard ring).
    static func makeMask(
        in image: CIImage,
        mouths: [[CGPoint]],
    ) -> CIImage? {
        let extent = image.extent
        let w = Int(extent.width)
        let h = Int(extent.height)
        guard w > 0, h > 0 else { return nil }

        let cs = CGColorSpaceCreateDeviceGray()
        guard let context = CGContext(
            data: nil, width: w, height: h, bitsPerComponent: 8,
            bytesPerRow: 0, space: cs,
            bitmapInfo: CGImageAlphaInfo.none.rawValue,
        ) else { return nil }

        // Black background, white-fill polygon = standard alpha-style
        // mask convention CIBlendWithMask reads.
        context.setFillColor(CGColor(gray: 0, alpha: 1))
        context.fill(CGRect(origin: .zero, size: CGSize(width: w, height: h)))
        context.setFillColor(CGColor(gray: 1, alpha: 1))

        for polygon in mouths where polygon.count >= 3 {
            context.beginPath()
            context.move(to: polygon[0])
            for i in 1..<polygon.count {
                context.addLine(to: polygon[i])
            }
            context.closePath()
            context.fillPath()
        }

        guard let cg = context.makeImage() else { return nil }

        // Soft feather so the correction doesn't terminate at a hard
        // pixel edge. ~0.4% of long edge tested as the sweet spot
        // between "can see the mask edge" and "bleed onto lip skin".
        let dim = max(extent.width, extent.height)
        let blurRadius = Float(dim * 0.004)
        let blur = CIFilter.gaussianBlur()
        blur.inputImage = CIImage(cgImage: cg)
        blur.radius = blurRadius
        return blur.outputImage?.cropped(to: extent)
    }
}
