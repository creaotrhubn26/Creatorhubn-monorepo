import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit

/// «AI-endringer»-overlay: viser HVOR og HVOR MYE redigeringen endret bildet ved
/// å regne pikselforskjellen (Før vs Etter) og male den som en varm heatmap
/// (uendret = gjennomsiktig, mye endret = oransje). Bygger tillit — fotografen
/// ser nøyaktig hva som ble rørt, i stedet for å gjette.
enum DiffHeatmap {
    /// Returnerer en overlay-UIImage (oransje med alfa ∝ endring), eller nil.
    static func overlay(before: UIImage, after: UIImage, gain: Double = 3.0) -> UIImage? {
        guard let bCg = before.cgImage, let aCg = after.cgImage else { return nil }
        let b = CIImage(cgImage: bCg)
        // Skaler «Etter» til «Før» sin extent så pikslene stemmer.
        var a = CIImage(cgImage: aCg)
        if a.extent.size != b.extent.size, a.extent.width > 0, a.extent.height > 0 {
            a = a.transformed(by: CGAffineTransform(
                scaleX: b.extent.width / a.extent.width, y: b.extent.height / a.extent.height))
        }
        let extent = b.extent

        // |Etter − Før| per kanal.
        let diff = CIFilter.differenceBlendMode()
        diff.inputImage = a.cropped(to: extent)
        diff.backgroundImage = b
        guard let d = diff.outputImage?.cropped(to: extent) else { return nil }

        // Magnitude (desaturert) → oransje konstant + alfa ∝ magnitude·gain.
        let g = Float(gain)
        let m = CIFilter.colorMatrix()
        m.inputImage = d
        m.rVector = CIVector(x: 0, y: 0, z: 0, w: 0)
        m.gVector = CIVector(x: 0, y: 0, z: 0, w: 0)
        m.bVector = CIVector(x: 0, y: 0, z: 0, w: 0)
        m.aVector = CIVector(x: CGFloat(0.30 * g), y: CGFloat(0.59 * g), z: CGFloat(0.11 * g), w: 0)
        m.biasVector = CIVector(x: 0.98, y: 0.55, z: 0.12, w: 0)   // oransje
        guard let heat = m.outputImage?.cropped(to: extent) else { return nil }

        let ctx = CIContext(options: [.useSoftwareRenderer: false])
        guard let cg = ctx.createCGImage(heat, from: extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
