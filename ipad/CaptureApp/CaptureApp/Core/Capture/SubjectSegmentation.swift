import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit
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

    /// Farget motiv-overlay (motiv tonet, bakgrunn gjennomsiktig) til å vise
    /// HVA som segmenteres/behandles lokalt — «synlig maske-overlay». UIImage
    /// med alfa; legges oppå sammenlignings-bildet med lav opasitet.
    static func subjectOverlay(for cgImage: CGImage, extent: CGRect,
                               color: CIColor = CIColor(red: 0.2, green: 0.85, blue: 0.5)) -> UIImage? {
        guard let mask = personMask(for: cgImage, extent: extent) else { return nil }
        let tint = CIImage(color: color).cropped(to: extent)
        let clear = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0)).cropped(to: extent)
        let blend = CIFilter.blendWithMask()
        blend.inputImage = tint
        blend.backgroundImage = clear
        blend.maskImage = mask
        guard let out = blend.outputImage else { return nil }
        let ctx = CIContext(options: [.useSoftwareRenderer: false])
        guard let cg = ctx.createCGImage(out, from: extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

/// Deterministic colour-artifact cleanup. The masks are calculated from each
/// pixel and, for defringing, multiplied by a luminance-edge map. This keeps
/// genuine purple clothing/flowers intact away from high-contrast edges.
enum ColorArtifactFilter {
    private static let defringeKernel = CIColorKernel(source: """
        kernel vec4 creatorHubDefringe(__sample source, __sample localMean, float amount) {
            float hi = max(source.r, max(source.g, source.b));
            float lo = min(source.r, min(source.g, source.b));
            float chroma = hi - lo;
            float purpleExcess = min(source.r, source.b) - source.g;
            float purple = smoothstep(0.006, 0.09, purpleExcess)
                         * smoothstep(0.012, 0.18, chroma);
            float localDelta = distance(source.rgb, localMean.rgb);
            float edgeMask = smoothstep(0.025, 0.18, localDelta);
            float mask = clamp(purple * edgeMask * amount, 0.0, 1.0);
            float luma = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
            vec3 neutralised = mix(source.rgb, vec3(luma), 0.92);
            return vec4(mix(source.rgb, neutralised, mask), source.a);
        }
        """)

    private static let greenKernel = CIColorKernel(source: """
        kernel vec4 creatorHubGreenControl(__sample source, float amount) {
            float hiOther = max(source.r, source.b);
            float lo = min(source.r, min(source.g, source.b));
            float chroma = max(source.r, max(source.g, source.b)) - lo;
            float greenDominance = source.g - hiOther;
            float foliage = smoothstep(0.025, 0.20, greenDominance)
                          * smoothstep(0.07, 0.42, chroma);
            float luma = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
            float strength = clamp(foliage * amount * 0.60, 0.0, 0.60);
            return vec4(mix(source.rgb, vec3(luma), strength), source.a);
        }
        """)

    static func applyDefringe(amount: Double, to image: CIImage) -> CIImage {
        let strength = max(0, min(1, amount))
        guard strength > 0, let kernel = defringeKernel else { return image }
        // Real longitudinal/chromatic fringes are commonly 1–4 px wide at the
        // preview scale. Compare with a local mean so the full coloured fringe
        // is covered, while broad genuine purple surfaces have no local delta.
        let localMean = image
            .clampedToExtent()
            .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 3.0])
            .cropped(to: image.extent)
        return kernel.apply(
            extent: image.extent,
            arguments: [image, localMean, Float(strength)]
        )?.cropped(to: image.extent) ?? image
    }

    static func applyGreenControl(amount: Double, to image: CIImage) -> CIImage {
        let strength = max(0, min(1, amount))
        guard strength > 0, let kernel = greenKernel else { return image }
        return kernel.apply(
            extent: image.extent,
            arguments: [image, Float(strength)]
        )?.cropped(to: image.extent) ?? image
    }
}

/// Creates depth without synthetic blur or generated pixels. The original
/// person is blended over a subtly darker and calmer version of the original
/// background. If Vision cannot find a person, the operation is a no-op.
enum SubjectSeparationFilter {
    static func apply(amount: Double, to image: CIImage) -> CIImage {
        apply(amount: amount, subject: image, background: image)
    }

    static func apply(
        amount: Double,
        subject subjectSource: CIImage,
        background backgroundSource: CIImage
    ) -> CIImage {
        let strength = max(0, min(1, amount))
        guard strength > 0,
              subjectSource.extent.width > 0,
              subjectSource.extent.height > 0
        else { return backgroundSource }

        let extent = subjectSource.extent
        let longest = max(extent.width, extent.height)
        let scale = min(1, 1024 / longest)
        let normalized = subjectSource
            .transformed(by: CGAffineTransform(
                translationX: -extent.minX,
                y: -extent.minY
            ))
            .transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let context = CIContext(options: [.useSoftwareRenderer: false])
        guard let analysisCG = context.createCGImage(normalized, from: normalized.extent),
              let personMask = SubjectSegmentation.personMask(
                for: analysisCG,
                extent: extent
              ),
              maskCoverage(personMask, extent: extent, context: context) > 0.005
        else { return backgroundSource }

        let exposure = CIFilter.exposureAdjust()
        exposure.inputImage = backgroundSource
        exposure.ev = Float(-0.30 * strength)
        var background = exposure.outputImage ?? backgroundSource

        let colour = CIFilter.colorControls()
        colour.inputImage = background
        colour.saturation = Float(1 - 0.12 * strength)
        colour.contrast = Float(1 + 0.035 * strength)
        colour.brightness = 0
        background = colour.outputImage ?? background

        let softenedMask = personMask
            .clampedToExtent()
            .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 5.0])
            .cropped(to: extent)

        let subjectExposure = CIFilter.exposureAdjust()
        subjectExposure.inputImage = subjectSource
        subjectExposure.ev = Float(0.15 * strength)
        let liftedSubject = subjectExposure.outputImage ?? subjectSource
        let blend = CIFilter.blendWithMask()
        blend.inputImage = liftedSubject
        blend.backgroundImage = background
        blend.maskImage = softenedMask
        return blend.outputImage?.cropped(to: extent) ?? backgroundSource
    }

    private static func maskCoverage(
        _ mask: CIImage,
        extent: CGRect,
        context: CIContext
    ) -> Double {
        let average = CIFilter.areaAverage()
        average.inputImage = mask
        average.extent = extent
        guard let output = average.outputImage else { return 0 }
        var pixel = [Float](repeating: 0, count: 4)
        context.render(
            output,
            toBitmap: &pixel,
            rowBytes: 4 * MemoryLayout<Float>.size,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBAf,
            colorSpace: nil
        )
        return Double(pixel[0])
    }
}
