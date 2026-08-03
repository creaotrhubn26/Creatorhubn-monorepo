import Foundation
import CoreImage
import Vision

/// MOTIV-MASKE per bilde — svaret på «hvordan blir masken et system, ikke hardkodede
/// koordinater». To lag, best-tilgjengelig vinner:
///   1. ON-DEVICE (foretrukket): `VNGeneratePersonSegmentationRequest` (iOS Vision,
///      innebygd, gratis, ingen modell-nedlasting) → piksel-nøyaktig person-matte,
///      generalisert til ETHVERT bilde. Dette er «BiRefNet/U²-Net for mobil».
///   2. FALLBACK: myke ellipser fra detekterte ansikts-rekter (ingen personer funnet
///      / eldre OS) — grov, men robust.
///
/// (Server-«pro»-tier for levert retusj kan bruke BiRefNet fra R2 `ml-models`; her,
/// i sanntids-editoren, er Vision det riktige valget.)
enum SubjectMask {

    /// Hvit = motiv (person), svart = bakgrunn, skalert til `extent`. `nil` → ingen
    /// person funnet (kaller faller tilbake til ansikts-ellipser).
    static func personMatte(for image: CIImage, extent: CGRect) -> CIImage? {
        let request = VNGeneratePersonSegmentationRequest()
        request.qualityLevel = .balanced           // .accurate = bedre kant, tregere
        request.outputPixelFormat = kCVPixelFormatType_OneComponent8
        let handler = VNImageRequestHandler(ciImage: image, options: [:])
        do {
            try handler.perform([request])
        } catch { return nil }
        guard let obs = request.results?.first as? VNPixelBufferObservation else { return nil }
        let mask = CIImage(cvPixelBuffer: obs.pixelBuffer)
        // Vision-matten er i egen (mindre) oppløsning → skalér til bildets extent.
        let mx = extent.width / max(1, mask.extent.width)
        let my = extent.height / max(1, mask.extent.height)
        let scaled = mask.transformed(by: CGAffineTransform(scaleX: mx, y: my))
            .transformed(by: CGAffineTransform(translationX: extent.minX, y: extent.minY))
        // guard mot tom matte (ingen person → alt svart): krev litt hvitt.
        return scaled.cropped(to: extent)
    }
}
