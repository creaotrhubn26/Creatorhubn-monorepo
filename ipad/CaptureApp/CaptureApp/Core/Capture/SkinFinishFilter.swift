import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

/// Core Image's `targetNeutral` temperature direction is the inverse of a
/// photographic warmth slider: lowering the target Kelvin value warms the
/// rendered pixels, while raising it cools them. Keep that translation in one
/// place so every editor surface follows the user-facing convention
/// (positive = warmer, negative = cooler).
enum PhotographicTemperatureFilter {
    static func apply(
        to image: CIImage,
        warmth: Double,
        kelvinScale: Double
    ) -> CIImage {
        guard abs(warmth) > 0.0001 else { return image }
        let filter = CIFilter.temperatureAndTint()
        filter.inputImage = image
        filter.neutral = CIVector(x: 6500, y: 0)
        filter.targetNeutral = CIVector(
            x: 6500 - CGFloat(warmth * kelvinScale),
            y: 0
        )
        return filter.outputImage ?? image
    }
}

/// Ordentlig hud-finish (mot «blek, flat, livløs» retusj). Innen ansikts-masken:
/// gir huden VARME + VIBRANCE (liv, ikke pale) + LOKAL KONTRAST (dimensjon) og en
/// LETT frekvens-separert utjevning (jevn tone, BEHOLD porer/tekstur — ikke bare
/// blur som flater ut). Erstatter den rene blur-utjevningen.
enum SkinFinishFilter {
    /// Skin-masked frequency separation used by both JPEG preview and RAW
    /// export. The old implementation applied noise reduction, structure and
    /// pore sharpening to the *entire frame*, which softened hair/fabric and
    /// sharpened backgrounds. A portrait control must only touch detected skin.
    static func applyFrequencySeparation(
        recipe: MagicRecipe,
        to image: CIImage,
        faceRects suppliedFaceRects: [CGRect]? = nil
    ) -> CIImage {
        let low = recipe.skinLowFreq + max(0, recipe.skinSmooth)
        let high = recipe.skinHighFreq
        guard abs(low) > 0.0001 || abs(high) > 0.0001 else { return image }

        let extent = image.extent
        let detectedFaces = suppliedFaceRects == nil
            ? detectFaces(in: image, extent: extent)
            : []
        let faceRects = suppliedFaceRects ?? detectedFaces.map(\.rect)
        guard !faceRects.isEmpty,
              var mask = unionFaceMask(extent: extent, faceRects: faceRects) else { return image }
        if !detectedFaces.isEmpty {
            // Eyes, brows and lips carry identity. Keep them out of the skin
            // smoothing mask instead of blurring the entire face oval and
            // trying to sharpen them back afterwards.
            mask = protectFeatures(
                in: mask,
                faces: detectedFaces,
                extent: extent,
                strength: recipe.makeupProtection
            )
        }

        var current = image
        if low > 0 {
            // A small median pass reduces isolated spots without spreading their
            // colour into neighbouring skin. It is deliberately subtle: this is
            // cleanup, not generative reconstruction or identity alteration.
            let median = CIFilter.median()
            median.inputImage = current
            if let cleaned = median.outputImage?.cropped(to: extent) {
                let spotMix = CIFilter.dissolveTransition()
                spotMix.inputImage = current
                spotMix.targetImage = cleaned
                spotMix.time = Float(0.05 + min(1, low) * 0.09)
                if let filtered = spotMix.outputImage?.cropped(to: extent) {
                    current = blend(filtered, over: current, mask: mask, extent: extent)
                }
            }

            // Average broad colour/tonal variation, then blend only a restrained
            // fraction back. The separate high-frequency pass below keeps pores
            // and fine detail.
            let blur = CIFilter.gaussianBlur()
            blur.inputImage = current.clampedToExtent()
            let dimension = min(extent.width, extent.height)
            blur.radius = Float(0.8 + min(10, dimension * 0.003) * min(1, low))
            if let softened = blur.outputImage?.cropped(to: extent) {
                let dissolve = CIFilter.dissolveTransition()
                dissolve.inputImage = current
                dissolve.targetImage = softened
                dissolve.time = Float(0.12 + min(1, low) * 0.18)
                if let filtered = dissolve.outputImage?.cropped(to: extent) {
                    current = blend(filtered, over: current, mask: mask, extent: extent)
                }
            }

            // Tone evening can remove cheek and forehead modelling. Restore a
            // restrained amount of broad local contrast inside the same skin
            // mask so the face retains depth instead of becoming flat/plastic.
            let structure = CIFilter.unsharpMask()
            structure.inputImage = current
            structure.radius = Float(max(3, min(14, dimension * 0.006)))
            structure.intensity = Float(0.025 + min(1, low) * 0.07)
            if let dimensional = structure.outputImage?.cropped(to: extent) {
                current = blend(dimensional, over: current, mask: mask, extent: extent)
            }
        } else if low < 0 {
            // Negative low frequency restores broad facial structure, masked so
            // clothing and the background do not gain contrast.
            let structure = CIFilter.colorControls()
            structure.inputImage = current
            structure.contrast = 1 + Float(-low) * 0.12
            structure.saturation = 1
            structure.brightness = 0
            if let filtered = structure.outputImage?.cropped(to: extent) {
                current = blend(filtered, over: current, mask: mask, extent: extent)
            }
        }

        if high > 0 {
            let detail = CIFilter.unsharpMask()
            detail.inputImage = current
            detail.radius = 1.35
            detail.intensity = Float(high) * 0.38
            if let filtered = detail.outputImage?.cropped(to: extent) {
                current = blend(filtered, over: current, mask: mask, extent: extent)
            }
        } else if high < 0 {
            let soften = CIFilter.gaussianBlur()
            soften.inputImage = current.clampedToExtent()
            soften.radius = 0.75 + Float(-high) * 1.5
            if let filtered = soften.outputImage?.cropped(to: extent) {
                current = blend(filtered, over: current, mask: mask, extent: extent)
            }
        }
        return current.cropped(to: extent)
    }

    /// Selective portrait finishing that stays separate from broad frequency
    /// separation. Each operation uses the same detected face geometry and
    /// feature protection, so preview and full-resolution RAW export agree.
    /// The operations are intentionally bounded: identity, face shape, eyes,
    /// brows and lips are never warped or regenerated.
    static func applyPortraitRetouch(recipe: MagicRecipe, to image: CIImage) -> CIImage {
        let active = recipe.blemishCleanup > 0.0001
            || recipe.skinDiscoloration > 0.0001
            || recipe.dodgeBurn > 0.0001
            || recipe.shineControl > 0.0001
            || recipe.underEyeLift > 0.0001
        guard active else { return image }

        let extent = image.extent
        let faces = detectFaces(in: image, extent: extent)
        guard !faces.isEmpty,
              let rawSkinMask = unionFaceMask(extent: extent, faceRects: faces.map(\.rect)) else {
            return image
        }
        let skinMask = protectFeatures(
            in: rawSkinMask,
            faces: faces,
            extent: extent,
            strength: recipe.makeupProtection
        )
        var current = image

        if recipe.blemishCleanup > 0 {
            current = applySelectiveBlemishCleanup(
                amount: recipe.blemishCleanup,
                to: current,
                skinMask: skinMask,
                extent: extent,
                preserveIdentityMarks: recipe.preserveIdentityMarks
            )
        }

        if recipe.skinDiscoloration > 0 {
            current = applyDiscolorationCorrection(
                amount: recipe.skinDiscoloration,
                to: current,
                skinMask: skinMask,
                extent: extent
            )
        }

        if recipe.dodgeBurn > 0 {
            // A restrained S-curve inversion evens local illumination: lift deep
            // facial shadows and soften hot mid-highlights without moving black
            // or white points. Masking prevents a global "flat" grade.
            let amount = max(0, min(1, recipe.dodgeBurn))
            let tone = CIFilter.toneCurve()
            tone.inputImage = current
            tone.point0 = CGPoint(x: 0, y: 0)
            tone.point1 = CGPoint(x: 0.22, y: 0.22 + 0.035 * amount)
            tone.point2 = CGPoint(x: 0.50, y: 0.50)
            tone.point3 = CGPoint(x: 0.78, y: 0.78 - 0.030 * amount)
            tone.point4 = CGPoint(x: 1, y: 1)
            if let balanced = tone.outputImage?.cropped(to: extent) {
                current = blend(balanced, over: current, mask: skinMask, extent: extent)
            }
        }

        if recipe.shineControl > 0 {
            let amount = max(0, min(1, recipe.shineControl))
            let tone = CIFilter.toneCurve()
            tone.inputImage = current
            tone.point0 = CGPoint(x: 0, y: 0)
            tone.point1 = CGPoint(x: 0.45, y: 0.45)
            tone.point2 = CGPoint(x: 0.72, y: 0.72)
            tone.point3 = CGPoint(x: 0.90, y: 0.90 - 0.055 * amount)
            tone.point4 = CGPoint(x: 1, y: 1 - 0.025 * amount)
            if let tamed = tone.outputImage?.cropped(to: extent) {
                // Luminance-select the upper facial range so matte skin does not
                // darken. CIColorThreshold is optional; older hosts use the soft
                // monochrome contrast mask below.
                let highlightMask = upperLumaMask(from: current, extent: extent)
                let combined = multiplyMasks(skinMask, highlightMask, extent: extent)
                current = blend(tamed, over: current, mask: combined, extent: extent)
            }
        }

        if recipe.underEyeLift > 0,
           let underEyes = unionUnderEyeMask(extent: extent, faces: faces) {
            let lift = CIFilter.exposureAdjust()
            lift.inputImage = current
            lift.ev = Float(max(0, min(1, recipe.underEyeLift)) * 0.16)
            if let lifted = lift.outputImage?.cropped(to: extent) {
                current = blend(lifted, over: current, mask: underEyes, extent: extent)
            }
        }

        return current.cropped(to: extent)
    }

    /// Transparent cyan/orange map for the editor's "what is retouched" view.
    /// Cyan = facial skin operations, orange = dedicated under-eye lift.
    static func retouchMap(recipe: MagicRecipe, to image: CIImage) -> CIImage? {
        let extent = image.extent
        let faces = detectFaces(in: image, extent: extent)
        guard !faces.isEmpty,
              let raw = unionFaceMask(extent: extent, faceRects: faces.map(\.rect)) else { return nil }
        let skin = protectFeatures(
            in: raw,
            faces: faces,
            extent: extent,
            strength: recipe.makeupProtection
        )
        let clear = CIImage(color: .clear).cropped(to: extent)
        let cyan = CIImage(color: CIColor(red: 0.05, green: 0.78, blue: 0.92, alpha: 0.78)).cropped(to: extent)
        let skinBlend = CIFilter.blendWithMask()
        skinBlend.inputImage = cyan
        skinBlend.backgroundImage = clear
        skinBlend.maskImage = skin
        var overlay = skinBlend.outputImage?.cropped(to: extent) ?? clear
        if recipe.underEyeLift > 0,
           let underEyes = unionUnderEyeMask(extent: extent, faces: faces) {
            let orange = CIImage(color: CIColor(red: 1, green: 0.48, blue: 0.08, alpha: 0.92)).cropped(to: extent)
            let eyeBlend = CIFilter.blendWithMask()
            eyeBlend.inputImage = orange
            eyeBlend.backgroundImage = overlay
            eyeBlend.maskImage = underEyes
            overlay = eyeBlend.outputImage?.cropped(to: extent) ?? overlay
        }
        return overlay
    }

    private static func applySelectiveBlemishCleanup(
        amount: Double,
        to image: CIImage,
        skinMask: CIImage,
        extent: CGRect,
        preserveIdentityMarks: Bool
    ) -> CIImage {
        let median = CIFilter.median()
        median.inputImage = image
        guard let repaired = median.outputImage?.cropped(to: extent) else { return image }

        // Difference-to-local-median isolates small outliers instead of wiping
        // every pore. High contrast turns the difference into a soft selection.
        let difference = CIFilter.differenceBlendMode()
        difference.inputImage = image
        difference.backgroundImage = repaired
        guard let diff = difference.outputImage?.cropped(to: extent) else { return image }
        let mono = CIFilter.colorMonochrome()
        mono.inputImage = diff
        mono.color = CIColor(red: 1, green: 1, blue: 1)
        mono.intensity = 1
        let contrast = CIFilter.colorControls()
        contrast.inputImage = mono.outputImage
        contrast.saturation = 0
        // Identity-safe mode needs stronger evidence before a pixel is treated
        // as temporary. It intentionally leaves some stable dark marks behind;
        // disabling the policy is an explicit photographer decision.
        contrast.contrast = Float(
            (preserveIdentityMarks ? 6.5 : 4.0)
                + max(0, min(1, amount)) * (preserveIdentityMarks ? 4.0 : 6.0)
        )
        contrast.brightness = preserveIdentityMarks ? -0.16 : -0.08
        guard let anomaly = contrast.outputImage?.cropped(to: extent) else { return image }
        let selectiveMask = multiplyMasks(skinMask, anomaly, extent: extent)

        let dissolve = CIFilter.dissolveTransition()
        dissolve.inputImage = image
        dissolve.targetImage = repaired
        let clampedAmount = max(0, min(1, amount))
        let maximumMix = preserveIdentityMarks ? 0.72 : 1.0
        // A soft response gives Natural enough visible cleanup while retaining
        // a true zero point and never feeding an invalid >1 transition value.
        dissolve.time = Float(pow(clampedAmount, 0.65) * maximumMix)
        guard let cleaned = dissolve.outputImage?.cropped(to: extent) else { return image }
        return blend(cleaned, over: image, mask: selectiveMask, extent: extent)
    }

    /// Smooths only colour variation, not luminance detail. `CIColorBlendMode`
    /// takes hue/saturation from a broad local average while retaining the
    /// original image's luminosity, so pores, freckles and facial modelling
    /// survive. The protected facial-feature mask keeps lips, eyes and brows out.
    static func applyDiscolorationCorrection(
        amount: Double,
        to image: CIImage,
        skinMask: CIImage,
        extent: CGRect
    ) -> CIImage {
        let clamped = max(0, min(1, amount))
        guard clamped > 0.0001 else { return image }
        let dimension = min(extent.width, extent.height)
        let blur = CIFilter.gaussianBlur()
        blur.inputImage = image.clampedToExtent()
        blur.radius = Float(max(5, min(36, dimension * 0.006)))
        guard let localColour = blur.outputImage?.cropped(to: extent) else { return image }

        let colourEvened = localColour.applyingFilter(
            "CIColorBlendMode",
            parameters: [kCIInputBackgroundImageKey: image]
        ).cropped(to: extent)

        let dissolve = CIFilter.dissolveTransition()
        dissolve.inputImage = image
        dissolve.targetImage = colourEvened
        dissolve.time = Float(pow(clamped, 0.72) * 0.70)
        guard let corrected = dissolve.outputImage?.cropped(to: extent) else { return image }
        return blend(corrected, over: image, mask: skinMask, extent: extent)
    }

    private static func upperLumaMask(from image: CIImage, extent: CGRect) -> CIImage {
        let mono = image.applyingFilter("CIPhotoEffectMono")
        let controls = CIFilter.colorControls()
        controls.inputImage = mono
        controls.saturation = 0
        controls.contrast = 4.5
        controls.brightness = -0.31
        return (controls.outputImage ?? mono).cropped(to: extent)
    }

    private static func multiplyMasks(_ a: CIImage, _ b: CIImage, extent: CGRect) -> CIImage {
        let multiply = CIFilter.multiplyCompositing()
        multiply.inputImage = a
        multiply.backgroundImage = b
        return multiply.outputImage?.cropped(to: extent) ?? a
    }

    private static func unionUnderEyeMask(extent: CGRect, faces: [DetectedFace]) -> CIImage? {
        var result: CIImage?
        for face in faces {
            let fallbackY = face.rect.midY + face.rect.height * 0.10
            let points = [
                face.leftEye ?? CGPoint(x: face.rect.minX + face.rect.width * 0.34, y: fallbackY),
                face.rightEye ?? CGPoint(x: face.rect.minX + face.rect.width * 0.66, y: fallbackY),
            ]
            for eye in points {
                let gradient = CIFilter.radialGradient()
                gradient.center = .zero
                gradient.radius0 = 0.55
                gradient.radius1 = 1
                gradient.color0 = CIColor(red: 1, green: 1, blue: 1)
                gradient.color1 = CIColor(red: 0, green: 0, blue: 0)
                // CI origin is lower-left: beneath the eye is a negative y offset.
                let transform = CGAffineTransform(
                    a: max(2, face.rect.width * 0.13), b: 0,
                    c: 0, d: max(2, face.rect.height * 0.055),
                    tx: eye.x, ty: eye.y - face.rect.height * 0.075
                )
                guard let mask = gradient.outputImage?.transformed(by: transform).cropped(to: extent) else { continue }
                if let existing = result {
                    let maximum = CIFilter.maximumCompositing()
                    maximum.inputImage = mask
                    maximum.backgroundImage = existing
                    result = maximum.outputImage?.cropped(to: extent) ?? existing
                } else {
                    result = mask
                }
            }
        }
        return result
    }

    static func apply(to image: CIImage, warmth: Double = 0.12, vibrance: Double = 0.18,
                      dimension: Double = 0.10, smooth: Double = 0.25,
                      faces: [CGRect]? = nil) -> CIImage {
        let extent = image.extent
        guard extent.width >= 4, extent.height >= 4 else { return image }
        // ALLE ansikter (ikke bare største) — på gruppebilder skal forloverne få
        // samme finish som brudeparet. #5: bruk delte rekter når gitt.
        let faceRects = faces ?? detectFaceRects(in: image, extent: extent)
        guard !faceRects.isEmpty else { return image }

        var skin = image

        // 1) Varme + vibrance → levende, varm hud (ikke pale/grå).
        if warmth != 0 {
            skin = PhotographicTemperatureFilter.apply(
                to: skin,
                warmth: warmth,
                kelvinScale: 700
            )
        }
        if vibrance != 0 {
            let v = CIFilter.vibrance()
            v.inputImage = skin
            v.amount = Float(vibrance)
            skin = v.outputImage ?? skin
        }
        // 2) Lokal kontrast → dimensjon (ikke flatt) via unsharp med stor radius.
        if dimension != 0 {
            let u = CIFilter.unsharpMask()
            u.inputImage = skin
            u.radius = 6.0
            u.intensity = Float(dimension)
            skin = u.outputImage ?? skin
        }
        // 3) Frekvens-separert utjevning: jevn LAV-frekvens tone, men legg HØY-
        //    frekvens (porer/tekstur) tilbake så det ikke blir plast.
        if smooth > 0 {
            let r = Float(max(1.5, min(extent.width, extent.height) * 0.008))
            let blur = CIFilter.gaussianBlur()
            blur.inputImage = skin.clampedToExtent()
            blur.radius = r
            if let low = blur.outputImage?.cropped(to: extent) {
                // Bland inn den utjevnede tonen, men behold noe tekstur (amount<1).
                let mix = CIFilter.dissolveTransition()
                mix.inputImage = skin
                mix.targetImage = low
                mix.time = Float(min(0.6, smooth))
                skin = mix.outputImage?.cropped(to: extent) ?? skin
                // Legg tilbake litt mikro-tekstur.
                let sharp = CIFilter.unsharpMask()
                sharp.inputImage = skin
                sharp.radius = 1.2
                sharp.intensity = 0.25
                skin = sharp.outputImage ?? skin
            }
        }

        guard let mask = unionFaceMask(extent: extent, faceRects: faceRects) else { return image }
        let blend = CIFilter.blendWithMask()
        blend.inputImage = skin
        blend.backgroundImage = image
        blend.maskImage = mask
        return blend.outputImage?.cropped(to: extent) ?? image
    }

    private static func detectFaceRects(in image: CIImage, extent: CGRect) -> [CGRect] {
        let det = CIDetector(ofType: CIDetectorTypeFace, context: nil,
                             options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
        return (det?.features(in: image) ?? [])
            .compactMap { ($0 as? CIFaceFeature)?.bounds.intersection(extent) }
            .filter { $0.width > 2 && $0.height > 2 }
    }

    private struct DetectedFace {
        let rect: CGRect
        let leftEye: CGPoint?
        let rightEye: CGPoint?
        let mouth: CGPoint?
    }

    private static func detectFaces(in image: CIImage, extent: CGRect) -> [DetectedFace] {
        let detector = CIDetector(
            ofType: CIDetectorTypeFace,
            context: nil,
            options: [CIDetectorAccuracy: CIDetectorAccuracyHigh]
        )
        return (detector?.features(in: image) ?? []).compactMap { feature in
            guard let face = feature as? CIFaceFeature else { return nil }
            let rect = face.bounds.intersection(extent)
            guard rect.width > 2, rect.height > 2 else { return nil }
            return DetectedFace(
                rect: rect,
                leftEye: face.hasLeftEyePosition ? face.leftEyePosition : nil,
                rightEye: face.hasRightEyePosition ? face.rightEyePosition : nil,
                mouth: face.hasMouthPosition ? face.mouthPosition : nil
            )
        }
    }

    /// Union av alle ansikters myke masker (lighten = maks) → hvit på hvert ansikt.
    private static func unionFaceMask(extent: CGRect, faceRects: [CGRect]) -> CIImage? {
        var mask: CIImage?
        for faceRect in faceRects {
            guard let g = faceGradient(extent: extent, faceRect: faceRect) else { continue }
            guard let existing = mask else {
                mask = g
                continue
            }
            // Pixel-wise maximum forms a true union of white mask regions.
            // CILightenBlendMode with an opaque black backing proved renderer-
            // dependent and could collapse the mask to black in tests.
            let maximum = CIFilter.maximumCompositing()
            maximum.inputImage = g
            maximum.backgroundImage = existing
            mask = maximum.outputImage?.cropped(to: extent) ?? existing
        }
        return mask?.cropped(to: extent)
    }

    private static func faceGradient(extent: CGRect, faceRect: CGRect) -> CIImage? {
        // Elliptical face mask (not the old circular gradient that bled into
        // hair/background on narrow faces). Centre is nudged slightly down from
        // the hairline; soft falloff keeps the retouch invisible at the edge.
        let g = CIFilter.radialGradient()
        g.center = .zero
        g.radius0 = 0.72
        g.radius1 = 1
        g.color0 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
        g.color1 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        let transform = CGAffineTransform(
            a: max(1, faceRect.width * 0.48), b: 0,
            c: 0, d: max(1, faceRect.height * 0.58),
            tx: faceRect.midX,
            ty: faceRect.midY - faceRect.height * 0.03
        )
        return g.outputImage?.transformed(by: transform).cropped(to: extent)
    }

    private static func protectFeatures(
        in skinMask: CIImage,
        faces: [DetectedFace],
        extent: CGRect,
        strength: Double = 0.75
    ) -> CIImage {
        var mask = skinMask
        let expansion = 0.85 + CGFloat(max(0, min(1, strength))) * 0.45
        for face in faces {
            let eyeRadius = face.rect.width * 0.10 * expansion
            let mouthRadius = face.rect.width * 0.14 * expansion
            for feature in [
                face.leftEye.map { ($0, eyeRadius) },
                face.rightEye.map { ($0, eyeRadius) },
                face.mouth.map { ($0, mouthRadius) },
            ].compactMap({ $0 }) {
                guard let protection = featureProtectionMask(
                    extent: extent,
                    center: feature.0,
                    radius: feature.1
                ) else { continue }
                let multiply = CIFilter.multiplyCompositing()
                multiply.inputImage = mask
                multiply.backgroundImage = protection
                mask = multiply.outputImage?.cropped(to: extent) ?? mask
            }
        }
        return mask
    }

    /// White keeps skin retouch, black protects the facial feature, and the
    /// feathered ring avoids visible seams around eyes, brows and lips.
    private static func featureProtectionMask(
        extent: CGRect,
        center: CGPoint,
        radius: CGFloat
    ) -> CIImage? {
        let gradient = CIFilter.radialGradient()
        gradient.center = center
        gradient.radius0 = Float(radius * 0.55)
        gradient.radius1 = Float(radius)
        gradient.color0 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        gradient.color1 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
        return gradient.outputImage?.cropped(to: extent)
    }

    private static func blend(
        _ filtered: CIImage,
        over original: CIImage,
        mask: CIImage,
        extent: CGRect
    ) -> CIImage {
        let blend = CIFilter.blendWithMask()
        blend.inputImage = filtered
        blend.backgroundImage = original
        blend.maskImage = mask
        return blend.outputImage?.cropped(to: extent) ?? original
    }
}
