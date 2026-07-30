import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

/// Lokal (luminans-maskert) høylys-recovery: komprimerer KUN de utblåste
/// områdene (hvit bluse, vindu, spekulære flater) og lar riktig-eksponerte
/// mellomtoner/hud være i fred. Løser «redd blusen mens huden holder varme» —
/// en global tonekurve ville også mørknet ansiktet.
enum HighlightRecoveryFilter {
    /// `strength` 0…1 — hvor hardt de utblåste flatene dras ned.
    static func apply(to image: CIImage, strength: Double = 0.6) -> CIImage {
        guard strength > 0 else { return image }
        let extent = image.extent

        // Luminans-maske: bratt rampe så bare svært lyse piksler (>~0.78) teller.
        let mono = CIFilter.colorControls()
        mono.inputImage = image
        mono.saturation = 0
        mono.brightness = 0
        mono.contrast = 1
        guard let gray = mono.outputImage else { return image }
        let ramp = CIFilter.toneCurve()
        ramp.inputImage = gray
        ramp.point0 = CGPoint(x: 0, y: 0)
        ramp.point1 = CGPoint(x: 0.72, y: 0)
        ramp.point2 = CGPoint(x: 0.82, y: 0.5)
        ramp.point3 = CGPoint(x: 0.92, y: 1)
        ramp.point4 = CGPoint(x: 1.0, y: 1)
        guard let mask = ramp.outputImage?.cropped(to: extent) else { return image }

        // Sterk høylys-kompresjon (kun der masken er hvit).
        let white = CGFloat(max(0.70, 0.90 - 0.20 * strength))
        let pull = CIFilter.toneCurve()
        pull.inputImage = image
        pull.point0 = CGPoint(x: 0, y: 0)
        pull.point1 = CGPoint(x: 0.5, y: 0.5)
        pull.point2 = CGPoint(x: 0.75, y: 0.72)
        pull.point3 = CGPoint(x: 0.9, y: 0.82)
        pull.point4 = CGPoint(x: 1.0, y: white)
        guard let pulled = pull.outputImage else { return image }

        let blend = CIFilter.blendWithMask()
        blend.inputImage = pulled          // komprimerte høylys
        blend.backgroundImage = image      // resten uendret
        blend.maskImage = mask
        return blend.outputImage?.cropped(to: extent) ?? image
    }
}
