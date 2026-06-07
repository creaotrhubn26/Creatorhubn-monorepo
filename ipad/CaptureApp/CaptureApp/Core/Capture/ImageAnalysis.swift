import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit
import Vision

/// On-set coaching overlays: histogram, clipping warnings, and skin-tone
/// reading. Runs off-main against the current preview JPEG so the hero
/// HUD updates live without blocking the UI. Every method handles filter
/// / Vision failures gracefully — a bad frame drops back to `nil` results
/// instead of propagating errors.
struct ImageAnalysis: Sendable, Equatable {
    /// RGB histogram bins, length 64 each. Values normalised 0…1 so a
    /// view can plot them without worrying about image size.
    var red: [Double]
    var green: [Double]
    var blue: [Double]

    /// Fraction of pixels at the extremes.
    var highlightClipping: Double   // pixels with any channel >= 0.98
    var shadowClipping: Double      // pixels with all channels <= 0.02

    /// Skin reading, nil when no face was detected.
    var skin: SkinReading?

    struct SkinReading: Sendable, Equatable {
        var sampleColor: CGColor   // average skin RGB
        /// Classification of the dominant cast on the face. `.neutral`
        /// means we're inside the professional skin-tone range.
        var cast: Cast

        enum Cast: String, Sendable, CaseIterable {
            case neutral, tooWarm, tooCool, tooGreen, tooMagenta
        }
    }

    static let empty = ImageAnalysis(red: [], green: [], blue: [], highlightClipping: 0, shadowClipping: 0, skin: nil)
}

/// Background worker that produces `ImageAnalysis` from preview files.
/// Callers submit `analyze(imageURL:)`; the actor serialises work per
/// instance, cancels superseded calls, and caches the most recent result
/// so a view reappearing doesn't re-run the pipeline unnecessarily.
actor ImageAnalyser {
    private var cache: [URL: ImageAnalysis] = [:]

    func analyze(imageURL: URL) async -> ImageAnalysis? {
        if let cached = cache[imageURL] { return cached }
        let result = await Task.detached(priority: .userInitiated) {
            Self.run(imageURL: imageURL)
        }.value
        if let result { cache[imageURL] = result }
        return result
    }

    func invalidate(imageURL: URL) {
        cache.removeValue(forKey: imageURL)
    }

    nonisolated private static func run(imageURL: URL) -> ImageAnalysis? {
        guard let data = try? Data(contentsOf: imageURL),
              let ciImage = CIImage(data: data)
        else { return nil }
        let extent = ciImage.extent
        guard extent.width > 0, extent.height > 0 else { return nil }
        let ctx = CIContext(options: [.useSoftwareRenderer: false])

        let histogram = computeHistogram(ciImage: ciImage, extent: extent, ctx: ctx)
        let clipping = computeClipping(ciImage: ciImage, extent: extent, ctx: ctx)
        let skin = computeSkin(ciImage: ciImage, extent: extent, ctx: ctx)

        return ImageAnalysis(
            red: histogram.r,
            green: histogram.g,
            blue: histogram.b,
            highlightClipping: clipping.highlight,
            shadowClipping: clipping.shadow,
            skin: skin
        )
    }

    // MARK: - Histogram

    nonisolated private static func computeHistogram(
        ciImage: CIImage, extent: CGRect, ctx: CIContext
    ) -> (r: [Double], g: [Double], b: [Double]) {
        let binCount = 64
        guard let filter = CIFilter(name: "CIAreaHistogram") else {
            return (Array(repeating: 0, count: binCount),
                    Array(repeating: 0, count: binCount),
                    Array(repeating: 0, count: binCount))
        }
        filter.setValue(ciImage, forKey: kCIInputImageKey)
        filter.setValue(CIVector(cgRect: extent), forKey: "inputExtent")
        filter.setValue(binCount, forKey: "inputCount")
        filter.setValue(1.0, forKey: "inputScale")
        guard let output = filter.outputImage else {
            return (Array(repeating: 0, count: binCount),
                    Array(repeating: 0, count: binCount),
                    Array(repeating: 0, count: binCount))
        }
        var buffer = [Float](repeating: 0, count: binCount * 4)
        ctx.render(
            output,
            toBitmap: &buffer,
            rowBytes: binCount * 4 * MemoryLayout<Float>.size,
            bounds: CGRect(x: 0, y: 0, width: binCount, height: 1),
            format: .RGBAf,
            colorSpace: nil
        )
        var r = [Double](repeating: 0, count: binCount)
        var g = [Double](repeating: 0, count: binCount)
        var b = [Double](repeating: 0, count: binCount)
        for i in 0..<binCount {
            r[i] = Double(buffer[i * 4])
            g[i] = Double(buffer[i * 4 + 1])
            b[i] = Double(buffer[i * 4 + 2])
        }
        let rMax = max(r.max() ?? 1, 0.0001)
        let gMax = max(g.max() ?? 1, 0.0001)
        let bMax = max(b.max() ?? 1, 0.0001)
        return (r.map { $0 / rMax }, g.map { $0 / gMax }, b.map { $0 / bMax })
    }

    // MARK: - Clipping

    nonisolated private static func computeClipping(
        ciImage: CIImage, extent: CGRect, ctx: CIContext
    ) -> (highlight: Double, shadow: Double) {
        // Threshold filters: keep pixels ≥ 0.98 brightness as white, rest
        // black → CIAreaAverage gives us fraction of clipped pixels.
        guard
            let highlightMask = makeClippingMask(ciImage: ciImage, extent: extent, isHighlight: true),
            let shadowMask = makeClippingMask(ciImage: ciImage, extent: extent, isHighlight: false)
        else { return (0, 0) }
        let highlight = averageBrightness(of: highlightMask, extent: extent, ctx: ctx)
        let shadow = averageBrightness(of: shadowMask, extent: extent, ctx: ctx)
        return (highlight, shadow)
    }

    nonisolated private static func makeClippingMask(
        ciImage: CIImage, extent: CGRect, isHighlight: Bool
    ) -> CIImage? {
        // CIColorMatrix followed by CIColorClamp to isolate extreme pixels.
        // Simpler: use CIColorControls brightness then clamp.
        // Use CIColorClamp with min/max vectors to create binary mask.
        guard let clamp = CIFilter(name: "CIColorClamp") else { return nil }
        clamp.setValue(ciImage, forKey: kCIInputImageKey)
        if isHighlight {
            clamp.setValue(CIVector(x: 0.98, y: 0.98, z: 0.98, w: 0), forKey: "inputMinComponents")
            clamp.setValue(CIVector(x: 1, y: 1, z: 1, w: 1), forKey: "inputMaxComponents")
        } else {
            clamp.setValue(CIVector(x: 0, y: 0, z: 0, w: 0), forKey: "inputMinComponents")
            clamp.setValue(CIVector(x: 0.02, y: 0.02, z: 0.02, w: 1), forKey: "inputMaxComponents")
        }
        guard let clamped = clamp.outputImage else { return nil }

        // Binarise: pixels that hit the min (highlight) or max (shadow)
        // end of the clamp become white, rest black.
        guard let matrix = CIFilter(name: "CIColorMatrix") else { return clamped }
        matrix.setValue(clamped, forKey: kCIInputImageKey)
        if isHighlight {
            // Amplify values near 0.98 so clipped pixels saturate to 1.
            matrix.setValue(CIVector(x: 50, y: 0, z: 0, w: 0), forKey: "inputRVector")
            matrix.setValue(CIVector(x: 0, y: 50, z: 0, w: 0), forKey: "inputGVector")
            matrix.setValue(CIVector(x: 0, y: 0, z: 50, w: 0), forKey: "inputBVector")
            matrix.setValue(CIVector(x: -49, y: -49, z: -49, w: 0), forKey: "inputBiasVector")
        } else {
            // Invert so darkest pixels become white.
            matrix.setValue(CIVector(x: -50, y: 0, z: 0, w: 0), forKey: "inputRVector")
            matrix.setValue(CIVector(x: 0, y: -50, z: 0, w: 0), forKey: "inputGVector")
            matrix.setValue(CIVector(x: 0, y: 0, z: -50, w: 0), forKey: "inputBVector")
            matrix.setValue(CIVector(x: 1, y: 1, z: 1, w: 0), forKey: "inputBiasVector")
        }
        return matrix.outputImage
    }

    nonisolated private static func averageBrightness(
        of ciImage: CIImage, extent: CGRect, ctx: CIContext
    ) -> Double {
        guard let filter = CIFilter(name: "CIAreaAverage") else { return 0 }
        filter.setValue(ciImage, forKey: kCIInputImageKey)
        filter.setValue(CIVector(cgRect: extent), forKey: "inputExtent")
        guard let output = filter.outputImage else { return 0 }
        var buffer = [UInt8](repeating: 0, count: 4)
        ctx.render(
            output,
            toBitmap: &buffer,
            rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8,
            colorSpace: nil
        )
        return (Double(buffer[0]) + Double(buffer[1]) + Double(buffer[2])) / 3.0 / 255.0
    }

    // MARK: - Skin tone

    nonisolated private static func computeSkin(
        ciImage: CIImage, extent: CGRect, ctx: CIContext
    ) -> ImageAnalysis.SkinReading? {
        guard let cgImage = ctx.createCGImage(ciImage, from: extent) else { return nil }
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        let request = VNDetectFaceRectanglesRequest()
        do { try handler.perform([request]) } catch { return nil }
        guard let face = (request.results ?? []).first(where: { $0.confidence >= 0.6 }) else {
            return nil
        }
        // Inset the face box 15 % so we sample cheek/forehead area, not
        // hair or jawline.
        let bbox = face.boundingBox.insetBy(dx: face.boundingBox.width * 0.15,
                                             dy: face.boundingBox.height * 0.15)
        let faceRect = CGRect(
            x: bbox.origin.x * extent.width,
            y: bbox.origin.y * extent.height,
            width: bbox.width * extent.width,
            height: bbox.height * extent.height
        )
        guard faceRect.width > 1, faceRect.height > 1 else { return nil }

        guard let avg = CIFilter(name: "CIAreaAverage") else { return nil }
        avg.setValue(ciImage, forKey: kCIInputImageKey)
        avg.setValue(CIVector(cgRect: faceRect), forKey: "inputExtent")
        guard let avgOut = avg.outputImage else { return nil }
        var rgba = [UInt8](repeating: 0, count: 4)
        ctx.render(
            avgOut,
            toBitmap: &rgba,
            rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8,
            colorSpace: CGColorSpace(name: CGColorSpace.sRGB)
        )
        let r = Double(rgba[0]) / 255.0
        let g = Double(rgba[1]) / 255.0
        let b = Double(rgba[2]) / 255.0
        let cast = classifyCast(r: r, g: g, b: b)
        let color = CGColor(
            colorSpace: CGColorSpaceCreateDeviceRGB(),
            components: [CGFloat(r), CGFloat(g), CGFloat(b), 1]
        ) ?? CGColor(gray: 0.5, alpha: 1)
        return ImageAnalysis.SkinReading(sampleColor: color, cast: cast)
    }

    /// Rough classification in sRGB ratios. Good enough to flag WB casts
    /// without a full Lab conversion — professional skin in neutral light
    /// sits roughly at R ≥ G > B with R/B within [1.15, 1.45].
    nonisolated private static func classifyCast(r: Double, g: Double, b: Double) -> ImageAnalysis.SkinReading.Cast {
        guard r > 0.1, g > 0.1, b > 0.1 else { return .neutral }
        let rb = r / max(b, 0.001)
        let rg = r / max(g, 0.001)
        if rb > 1.6 { return .tooWarm }   // orange/amber cast
        if rb < 1.1 { return .tooCool }   // blue cast
        if rg < 0.95 { return .tooGreen }  // green cast (fluorescent)
        if rg > 1.25 { return .tooMagenta } // magenta cast
        return .neutral
    }
}
