import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins

/// Ansikts-dodge — løfter ansikts-lysstyrke KUN når ansiktene måler for mørkt,
/// person-maskert (mykt) så bakgrunnen ikke røres. Speiler Post Agent-motorens
/// `gentle_face_dodge` on-device. Brukes som siste steg i ``LearnedStyle`` (og
/// kan gjenbrukes andre steder). No-op når ingen ansikter, eller ansiktene alt
/// er godt eksponert.
enum FaceDodgeFilter {
    /// Mål-median-luma for ansikt (0…1). ~0.41 ≈ 105/255 (samme som motoren).
    static let target: CGFloat = 0.41

    static func apply(to image: CIImage) -> CIImage {
        let extent = image.extent
        guard extent.width >= 2, extent.height >= 2,
              let faceRect = detectFaceRect(in: image, extent: extent),
              let luma = meanLuma(of: image, in: faceRect.insetBy(dx: faceRect.width * 0.15, dy: faceRect.height * 0.15))
        else { return image }
        // Alt godt eksponert (med liten margin) → ikke rør.
        guard luma < target - 0.02 else { return image }

        // Gamma-løft: out = in^gamma, gamma<1 lysner. Klemt dempet.
        let gamma = max(0.55, min(0.98, log(Double(target)) / log(Double(max(0.02, luma)))))
        let lift = CIFilter.gammaAdjust()
        lift.inputImage = image
        lift.power = Float(gamma)
        guard let lifted = lift.outputImage else { return image }

        // Myk ansikts-maske (radial: hvit inni ansikt → svart ute) så løftet kun
        // treffer ansikts-/hals-området.
        guard let mask = faceMask(extent: extent, faceRect: faceRect) else { return image }
        let blend = CIFilter.blendWithMask()
        blend.inputImage = lifted
        blend.backgroundImage = image
        blend.maskImage = mask
        return blend.outputImage?.cropped(to: extent) ?? image
    }

    private static func detectFaceRect(in image: CIImage, extent: CGRect) -> CGRect? {
        let detector = CIDetector(
            ofType: CIDetectorTypeFace, context: nil,
            options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
        // Velg det STØRSTE ansiktet (hovedmotivet).
        let faces = (detector?.features(in: image) ?? []).compactMap { $0 as? CIFaceFeature }
        guard let biggest = faces.max(by: { $0.bounds.width * $0.bounds.height < $1.bounds.width * $1.bounds.height })
        else { return nil }
        return biggest.bounds.intersection(extent)
    }

    private static func meanLuma(of image: CIImage, in rect: CGRect) -> CGFloat? {
        guard rect.width >= 2, rect.height >= 2 else { return nil }
        let f = CIFilter.areaAverage()
        f.inputImage = image
        f.extent = rect
        guard let out = f.outputImage else { return nil }
        var bytes = [UInt8](repeating: 0, count: 4)
        CIContext(options: [.useSoftwareRenderer: false]).render(
            out, toBitmap: &bytes, rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
        let r = CGFloat(bytes[0]) / 255, g = CGFloat(bytes[1]) / 255, b = CGFloat(bytes[2]) / 255
        return 0.299 * r + 0.587 * g + 0.114 * b
    }

    /// Hvit inni ansikt (+litt hals under), mykt mot svart ute.
    private static func faceMask(extent: CGRect, faceRect: CGRect) -> CIImage? {
        let black = CIImage(color: CIColor(red: 0, green: 0, blue: 0)).cropped(to: extent)
        let g = CIFilter.radialGradient()
        g.center = CGPoint(x: faceRect.midX, y: faceRect.midY - faceRect.height * 0.1)
        g.radius0 = Float(min(faceRect.width, faceRect.height) * 0.55)
        g.radius1 = Float(max(faceRect.width, faceRect.height) * 0.9)
        g.color0 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
        g.color1 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        guard let grad = g.outputImage?.cropped(to: extent) else { return nil }
        // Sørg for svart utenfor gradient-radius.
        let comp = CIFilter.sourceOverCompositing()
        comp.inputImage = grad
        comp.backgroundImage = black
        return comp.outputImage?.cropped(to: extent)
    }
}
