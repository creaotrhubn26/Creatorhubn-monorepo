import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

/// Lett, ansikts-maskert hud-utjevning — jevner ut flekker/ujevn tone UTEN å
/// viske ut porer (research: for mye lav-frekvens-blur = plast). Liten radius +
/// lav opasitet, kun i ansikts-/hals-området. Brukes som finishing i
/// ``LearnedStyle`` (den lærte banen har ellers ingen hud-retusj).
enum SkinSmoothFilter {
    /// `amount` 0…1 — hvor mye av den utjevnede versjonen som blandes inn.
    static func apply(amount: Double, to image: CIImage) -> CIImage {
        guard amount > 0 else { return image }
        let extent = image.extent
        guard extent.width >= 4, extent.height >= 4,
              let faceRect = detectFaceRect(in: image, extent: extent) else { return image }

        // Liten radius relativt til ansiktet: jevner flekker, beholder trekk.
        let radius = Float(max(1.0, min(faceRect.width, faceRect.height) * 0.02))
        let blur = CIFilter.gaussianBlur()
        blur.inputImage = image.clampedToExtent()
        blur.radius = radius
        guard let blurred = blur.outputImage?.cropped(to: extent) else { return image }

        guard let mask = faceMask(extent: extent, faceRect: faceRect, opacity: CGFloat(min(0.9, amount)))
        else { return image }
        let blend = CIFilter.blendWithMask()
        blend.inputImage = blurred
        blend.backgroundImage = image
        blend.maskImage = mask
        return blend.outputImage?.cropped(to: extent) ?? image
    }

    private static func detectFaceRect(in image: CIImage, extent: CGRect) -> CGRect? {
        let detector = CIDetector(
            ofType: CIDetectorTypeFace, context: nil,
            options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
        let faces = (detector?.features(in: image) ?? []).compactMap { $0 as? CIFaceFeature }
        guard let biggest = faces.max(by: { $0.bounds.width * $0.bounds.height < $1.bounds.width * $1.bounds.height })
        else { return nil }
        return biggest.bounds.intersection(extent)
    }

    /// Myk ansikts-oval (gradient hvit→svart), skalert til `opacity`.
    private static func faceMask(extent: CGRect, faceRect: CGRect, opacity: CGFloat) -> CIImage? {
        let black = CIImage(color: CIColor(red: 0, green: 0, blue: 0)).cropped(to: extent)
        let g = CIFilter.radialGradient()
        g.center = CGPoint(x: faceRect.midX, y: faceRect.midY)
        g.radius0 = Float(min(faceRect.width, faceRect.height) * 0.35)
        g.radius1 = Float(max(faceRect.width, faceRect.height) * 0.6)
        g.color0 = CIColor(red: opacity, green: opacity, blue: opacity, alpha: 1)
        g.color1 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        guard let grad = g.outputImage?.cropped(to: extent) else { return nil }
        let comp = CIFilter.sourceOverCompositing()
        comp.inputImage = grad
        comp.backgroundImage = black
        return comp.outputImage?.cropped(to: extent)
    }
}
