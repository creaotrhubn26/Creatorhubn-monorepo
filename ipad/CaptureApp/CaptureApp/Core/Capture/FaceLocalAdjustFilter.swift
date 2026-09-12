import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

/// Lokal, per-ansikt-justering (trykk-på-ansikt): bruker LYS + VARME kun i det
/// valgte ansiktets myke maske. Lar fotografen løfte/varme ett ansikt uten å
/// røre resten — kjernen i lokal retusj.
enum FaceLocalAdjustFilter {
    struct Adjust: Equatable, Codable, Sendable {
        var brightness: Double = 0   // −1…1 → ±1 EV
        var warmth: Double = 0       // −1…1 → ±900K
        var isActive: Bool { abs(brightness) > 0.01 || abs(warmth) > 0.01 }
    }

    /// `faces`: (ansikts-rekt i BILDE-piksler, justering). Uvirksomme hoppes over.
    static func apply(to image: CIImage, faces: [(rect: CGRect, adj: Adjust)]) -> CIImage {
        let extent = image.extent
        var out = image
        for (rect, adj) in faces where adj.isActive {
            var corrected = out
            if abs(adj.brightness) > 0.01 {
                let e = CIFilter.exposureAdjust()
                e.inputImage = corrected
                e.ev = Float(adj.brightness)
                corrected = e.outputImage ?? corrected
            }
            if abs(adj.warmth) > 0.01 {
                let t = CIFilter.temperatureAndTint()
                t.inputImage = corrected
                t.neutral = CIVector(x: 6500, y: 0)
                t.targetNeutral = CIVector(x: 6500 + CGFloat(adj.warmth) * 900, y: 0)
                corrected = t.outputImage ?? corrected
            }
            guard let mask = faceMask(extent: extent, faceRect: rect) else { continue }
            let blend = CIFilter.blendWithMask()
            blend.inputImage = corrected
            blend.backgroundImage = out
            blend.maskImage = mask
            out = blend.outputImage?.cropped(to: extent) ?? out
        }
        return out
    }

    private static func faceMask(extent: CGRect, faceRect: CGRect) -> CIImage? {
        let black = CIImage(color: CIColor(red: 0, green: 0, blue: 0)).cropped(to: extent)
        let g = CIFilter.radialGradient()
        g.center = CGPoint(x: faceRect.midX, y: faceRect.midY)
        g.radius0 = Float(min(faceRect.width, faceRect.height) * 0.55)
        g.radius1 = Float(max(faceRect.width, faceRect.height) * 0.95)
        g.color0 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
        g.color1 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        guard let grad = g.outputImage?.cropped(to: extent) else { return nil }
        let comp = CIFilter.sourceOverCompositing()
        comp.inputImage = grad
        comp.backgroundImage = black
        return comp.outputImage?.cropped(to: extent)
    }
}
