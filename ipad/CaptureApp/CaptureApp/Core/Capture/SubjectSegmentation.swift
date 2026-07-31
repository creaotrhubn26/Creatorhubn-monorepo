import Foundation
import CoreImage
import Vision

/// On-device person-/motiv-segmentering (Vision `VNGeneratePersonSegmentation`).
/// Gir en maske (person = hvit, bakgrunn = svart) skalert til bildets extent —
/// grunnlaget for LOKAL, per-region-korreksjon (behandle motiv og bakgrunn
/// uavhengig) i stedet for én global justering.
enum SubjectSegmentation {

    /// Person-maske som CIImage (hvit på person), skalert til `extent`. Nil når
    /// ingen person finnes eller Vision feiler.
    static func personMask(for cgImage: CGImage, extent: CGRect) -> CIImage? {
        let req = VNGeneratePersonSegmentationRequest()
        req.qualityLevel = .balanced           // balanse kvalitet/fart for preview
        req.outputPixelFormat = kCVPixelFormatType_OneComponent8
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        guard (try? handler.perform([req])) != nil,
              let mask = req.results?.first?.pixelBuffer else { return nil }
        let maskCI = CIImage(cvPixelBuffer: mask)
        guard maskCI.extent.width > 0, maskCI.extent.height > 0 else { return nil }
        let sx = extent.width / maskCI.extent.width
        let sy = extent.height / maskCI.extent.height
        return maskCI
            .transformed(by: CGAffineTransform(scaleX: sx, y: sy))
            .cropped(to: extent)
    }
}
