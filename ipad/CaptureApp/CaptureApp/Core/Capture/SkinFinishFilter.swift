import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

/// Ordentlig hud-finish (mot «blek, flat, livløs» retusj). Innen ansikts-masken:
/// gir huden VARME + VIBRANCE (liv, ikke pale) + LOKAL KONTRAST (dimensjon) og en
/// LETT frekvens-separert utjevning (jevn tone, BEHOLD porer/tekstur — ikke bare
/// blur som flater ut). Erstatter den rene blur-utjevningen.
enum SkinFinishFilter {
    static func apply(to image: CIImage, warmth: Double = 0.12, vibrance: Double = 0.18,
                      dimension: Double = 0.10, smooth: Double = 0.25) -> CIImage {
        let extent = image.extent
        guard extent.width >= 4, extent.height >= 4,
              let faceRect = detectFaceRect(in: image, extent: extent) else { return image }

        var skin = image

        // 1) Varme + vibrance → levende, varm hud (ikke pale/grå).
        if warmth != 0 {
            let t = CIFilter.temperatureAndTint()
            t.inputImage = skin
            t.neutral = CIVector(x: 6500, y: 0)
            t.targetNeutral = CIVector(x: 6500 + CGFloat(warmth) * 700, y: 0)
            skin = t.outputImage ?? skin
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

        guard let mask = faceMask(extent: extent, faceRect: faceRect) else { return image }
        let blend = CIFilter.blendWithMask()
        blend.inputImage = skin
        blend.backgroundImage = image
        blend.maskImage = mask
        return blend.outputImage?.cropped(to: extent) ?? image
    }

    private static func detectFaceRect(in image: CIImage, extent: CGRect) -> CGRect? {
        let det = CIDetector(ofType: CIDetectorTypeFace, context: nil,
                             options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
        let faces = (det?.features(in: image) ?? []).compactMap { $0 as? CIFaceFeature }
        guard let biggest = faces.max(by: { $0.bounds.width * $0.bounds.height < $1.bounds.width * $1.bounds.height })
        else { return nil }
        return biggest.bounds.intersection(extent)
    }

    private static func faceMask(extent: CGRect, faceRect: CGRect) -> CIImage? {
        let black = CIImage(color: CIColor(red: 0, green: 0, blue: 0)).cropped(to: extent)
        let g = CIFilter.radialGradient()
        g.center = CGPoint(x: faceRect.midX, y: faceRect.midY)
        g.radius0 = Float(min(faceRect.width, faceRect.height) * 0.45)
        g.radius1 = Float(max(faceRect.width, faceRect.height) * 0.7)
        g.color0 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
        g.color1 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        guard let grad = g.outputImage?.cropped(to: extent) else { return nil }
        let comp = CIFilter.sourceOverCompositing()
        comp.inputImage = grad
        comp.backgroundImage = black
        return comp.outputImage?.cropped(to: extent)
    }
}
