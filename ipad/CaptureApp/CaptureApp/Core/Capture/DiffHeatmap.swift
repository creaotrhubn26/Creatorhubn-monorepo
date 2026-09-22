import CoreGraphics
import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import UIKit
import Vision

/// Persistent state for the automatic before/after quality-control pass.
/// Stored inside `AssetSignals`, so unfinished work survives app restarts.
struct EditValidation: Codable, Hashable, Sendable {
    enum State: String, Codable, Hashable, Sendable {
        case pending, running, completed, failed
    }

    struct Metrics: Codable, Hashable, Sendable {
        enum AlignmentMethod: String, Codable, Hashable, Sendable {
            case identity
            case visionTranslation = "vision_translation"
            case visionHomography = "vision_homography"
        }

        var alignmentMethod: AlignmentMethod
        var alignmentConfidence: Double
        var validPixelFraction: Double
        var meanDeltaE: Double
        var p95DeltaE: Double
        var meanPixelDifference: Double
        var changedPixelFraction: Double
        var meanLumaDifference: Double
        var subjectMeanDeltaE: Double?
        var skinMeanDeltaE: Double?
        var backgroundMeanDeltaE: Double?
        var highlightClipDelta: Double
        var shadowClipDelta: Double
    }

    var state: State
    var attempts: Int
    var sourceRevision: String
    var metrics: Metrics?
    var lastError: String?
    var updatedAt: Date
}

enum EditValidationRevision {
    static func make(beforePath: String, afterPath: String) -> String? {
        guard let before = fingerprint(beforePath), let after = fingerprint(afterPath) else { return nil }
        return "\(before)|\(after)"
    }

    private static func fingerprint(_ path: String) -> String? {
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: path),
              let size = attributes[.size] as? NSNumber
        else { return nil }
        let modified = (attributes[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        // Atomic rewrites can preserve path and byte count and may occur inside
        // one filesystem timestamp tick. The inode changes on atomic replace,
        // closing that otherwise silent stale-QC window.
        let fileNumber = (attributes[.systemFileNumber] as? NSNumber)?.uint64Value ?? 0
        return "\(path)#\(size.int64Value)#\(Int64(modified * 1_000))#\(fileNumber)"
    }
}

enum EditValidationPlanner {
    static func shouldSchedule(
        existing: EditValidation?,
        revision: String,
        taskRunning: Bool
    ) -> Bool {
        guard !taskRunning else { return false }
        return existing?.state != .completed || existing?.sourceRevision != revision
    }
}

/// Serial execution bounds memory and heat during long bursts.
actor EditValidationService {
    func validate(beforeURL: URL, afterURL: URL) async throws -> EditValidation.Metrics {
        try await Task.detached(priority: .utility) {
            guard let before = UIImage(contentsOfFile: beforeURL.path)?.normalizedCGImage(),
                  let after = UIImage(contentsOfFile: afterURL.path)?.normalizedCGImage()
            else { throw EditValidationError.unreadableImage }
            return try EditValidationEngine.measure(before: before, after: after)
        }.value
    }
}

enum EditValidationError: LocalizedError {
    case unreadableImage
    case renderFailed
    case insufficientOverlap

    var errorDescription: String? {
        switch self {
        case .unreadableImage: "Kunne ikke lese før-/etterbildet."
        case .renderFailed: "Kunne ikke rendre pikselanalysen."
        case .insufficientOverlap: "Bildene overlapper ikke nok til en trygg sammenligning."
        }
    }
}

/// Native feature registration plus deterministic pixel analysis. Vision's
/// homography/translation requests provide the SIFT use-case without shipping
/// a large OpenCV runtime. Identity remains a candidate for same-source edits.
enum EditValidationEngine {
    private struct Candidate {
        let image: CIImage
        let method: EditValidation.Metrics.AlignmentMethod
        let visionConfidence: Double
    }

    private struct PixelStats {
        var metrics: EditValidation.Metrics
        var residual: Double
    }

    static func measure(before: CGImage, after: CGImage) throws -> EditValidation.Metrics {
        let size = analysisSize(width: before.width, height: before.height)
        guard let reference = redraw(before, size: size),
              let floating = redraw(after, size: size)
        else { throw EditValidationError.renderFailed }

        let referenceCI = CIImage(cgImage: reference)
        let floatingCI = CIImage(cgImage: floating)
        var candidates = [Candidate(image: floatingCI, method: .identity, visionConfidence: 1)]
        candidates.append(contentsOf: visionCandidates(reference: reference, floating: floating))

        var best: PixelStats?
        for candidate in candidates {
            guard let measured = pixelStats(
                before: referenceCI,
                after: candidate.image,
                referenceCG: reference,
                method: candidate.method,
                confidence: candidate.visionConfidence,
                size: size
            ) else { continue }
            if candidate.method != .identity, measured.metrics.validPixelFraction < 0.85 { continue }
            if best == nil || measured.residual < best!.residual { best = measured }
        }
        guard let best, best.metrics.validPixelFraction >= 0.70 else {
            throw EditValidationError.insufficientOverlap
        }
        return best.metrics
    }

    static func alignedImages(before: CGImage, after: CGImage) -> (CIImage, CIImage, CGRect)? {
        let size = analysisSize(width: before.width, height: before.height)
        guard let reference = redraw(before, size: size),
              let floating = redraw(after, size: size)
        else { return nil }
        let referenceCI = CIImage(cgImage: reference)
        let floatingCI = CIImage(cgImage: floating)
        var candidates = [Candidate(image: floatingCI, method: .identity, visionConfidence: 1)]
        candidates.append(contentsOf: visionCandidates(reference: reference, floating: floating))
        var selected = candidates[0]
        var selectedResidual = quickResidual(referenceCI, floatingCI, extent: referenceCI.extent)
        for candidate in candidates.dropFirst() {
            let residual = quickResidual(referenceCI, candidate.image, extent: referenceCI.extent)
            if residual < selectedResidual {
                selected = candidate
                selectedResidual = residual
            }
        }
        return (referenceCI, selected.image, referenceCI.extent)
    }

    private static func visionCandidates(reference: CGImage, floating: CGImage) -> [Candidate] {
        var output: [Candidate] = []
        let handler = VNImageRequestHandler(cgImage: reference, options: [:])

        let homography = VNHomographicImageRegistrationRequest(targetedCGImage: floating, options: [:])
        if (try? handler.perform([homography])) != nil,
           let observation = homography.results?.first,
           let warped = perspectiveWarp(CIImage(cgImage: floating), matrix: observation.warpTransform) {
            output.append(Candidate(image: warped, method: .visionHomography,
                                    visionConfidence: Double(observation.confidence)))
        }

        let translation = VNTranslationalImageRegistrationRequest(targetedCGImage: floating, options: [:])
        if (try? handler.perform([translation])) != nil,
           let observation = translation.results?.first {
            output.append(Candidate(
                image: CIImage(cgImage: floating).transformed(by: observation.alignmentTransform),
                method: .visionTranslation,
                visionConfidence: Double(observation.confidence)
            ))
        }
        return output
    }

    private static func perspectiveWarp(_ image: CIImage, matrix: simd_float3x3) -> CIImage? {
        func project(_ point: CGPoint) -> CGPoint? {
            let vector = matrix * SIMD3(Float(point.x), Float(point.y), 1)
            guard vector.z.isFinite, abs(vector.z) > 0.000_001 else { return nil }
            let point = CGPoint(x: CGFloat(vector.x / vector.z), y: CGFloat(vector.y / vector.z))
            return point.x.isFinite && point.y.isFinite ? point : nil
        }
        let extent = image.extent
        guard let topLeft = project(CGPoint(x: extent.minX, y: extent.maxY)),
              let topRight = project(CGPoint(x: extent.maxX, y: extent.maxY)),
              let bottomLeft = project(CGPoint(x: extent.minX, y: extent.minY)),
              let bottomRight = project(CGPoint(x: extent.maxX, y: extent.minY))
        else { return nil }
        let limit = max(extent.width, extent.height) * 4
        guard [topLeft, topRight, bottomLeft, bottomRight]
            .allSatisfy({ abs($0.x) <= limit && abs($0.y) <= limit })
        else { return nil }
        let filter = CIFilter.perspectiveTransform()
        filter.inputImage = image
        filter.topLeft = topLeft
        filter.topRight = topRight
        filter.bottomLeft = bottomLeft
        filter.bottomRight = bottomRight
        return filter.outputImage
    }

    private static func pixelStats(
        before: CIImage,
        after: CIImage,
        referenceCG: CGImage,
        method: EditValidation.Metrics.AlignmentMethod,
        confidence: Double,
        size: CGSize
    ) -> PixelStats? {
        let width = Int(size.width), height = Int(size.height), count = width * height
        guard count > 0 else { return nil }
        let extent = CGRect(origin: .zero, size: size)
        let context = ImageAnalyser.sharedContext
        var beforeBytes = [UInt8](repeating: 0, count: count * 4)
        var afterBytes = [UInt8](repeating: 0, count: count * 4)
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)
        context.render(before.cropped(to: extent), toBitmap: &beforeBytes, rowBytes: width * 4,
                       bounds: extent, format: .RGBA8, colorSpace: colorSpace)
        context.render(after.cropped(to: extent), toBitmap: &afterBytes, rowBytes: width * 4,
                       bounds: extent, format: .RGBA8, colorSpace: colorSpace)

        var subjectMask: [UInt8]?
        if let mask = SubjectSegmentation.personMask(for: referenceCG, extent: extent) {
            var bytes = [UInt8](repeating: 0, count: count)
            context.render(mask.cropped(to: extent), toBitmap: &bytes, rowBytes: width,
                           bounds: extent, format: .L8, colorSpace: nil)
            subjectMask = bytes
        }
        let faceRects = detectFaceRects(referenceCG)

        var deltas: [Double] = []
        deltas.reserveCapacity(count)
        var rgbSum = 0.0, lumaSum = 0.0
        var changed = 0, valid = 0
        var subject = RegionAccumulator(), skin = RegionAccumulator(), background = RegionAccumulator()
        var beforeHighlights = 0, afterHighlights = 0, beforeShadows = 0, afterShadows = 0

        for index in 0..<count {
            let offset = index * 4
            guard beforeBytes[offset + 3] > 245, afterBytes[offset + 3] > 245 else { continue }
            valid += 1
            let br = Double(beforeBytes[offset]) / 255
            let bg = Double(beforeBytes[offset + 1]) / 255
            let bb = Double(beforeBytes[offset + 2]) / 255
            let ar = Double(afterBytes[offset]) / 255
            let ag = Double(afterBytes[offset + 1]) / 255
            let ab = Double(afterBytes[offset + 2]) / 255
            let dr = ar - br, dg = ag - bg, db = ab - bb
            let rgb = sqrt((dr * dr + dg * dg + db * db) / 3)
            let deltaE = labDistance((br, bg, bb), (ar, ag, ab))
            let beforeLuma = 0.2126 * br + 0.7152 * bg + 0.0722 * bb
            let afterLuma = 0.2126 * ar + 0.7152 * ag + 0.0722 * ab
            rgbSum += rgb
            lumaSum += abs(afterLuma - beforeLuma)
            deltas.append(deltaE)
            if deltaE >= 2.3 { changed += 1 }
            if beforeLuma >= 0.98 { beforeHighlights += 1 }
            if afterLuma >= 0.98 { afterHighlights += 1 }
            if beforeLuma <= 0.02 { beforeShadows += 1 }
            if afterLuma <= 0.02 { afterShadows += 1 }

            let x = index % width, y = index / width
            let normalized = CGPoint(x: (CGFloat(x) + 0.5) / CGFloat(width),
                                     y: 1 - (CGFloat(y) + 0.5) / CGFloat(height))
            let isSkin = faceRects.contains {
                $0.insetBy(dx: $0.width * 0.18, dy: $0.height * 0.18).contains(normalized)
            }
            let isSubject = (subjectMask?[index] ?? 0) >= 128
            if isSkin { skin.add(deltaE) }
            if isSubject { subject.add(deltaE) } else { background.add(deltaE) }
        }
        guard valid > 0 else { return nil }
        deltas.sort()
        let n = Double(valid)
        let meanDelta = deltas.reduce(0, +) / n
        let p95 = deltas[min(deltas.count - 1, Int(Double(deltas.count - 1) * 0.95))]
        let validFraction = n / Double(count)
        let registrationConfidence = method == .identity
            ? 1
            : max(0, min(1, confidence)) * validFraction
        let metrics = EditValidation.Metrics(
            alignmentMethod: method,
            alignmentConfidence: registrationConfidence,
            validPixelFraction: validFraction,
            meanDeltaE: meanDelta,
            p95DeltaE: p95,
            meanPixelDifference: rgbSum / n,
            changedPixelFraction: Double(changed) / n,
            meanLumaDifference: lumaSum / n,
            subjectMeanDeltaE: subject.mean,
            skinMeanDeltaE: skin.mean,
            backgroundMeanDeltaE: background.mean,
            highlightClipDelta: Double(afterHighlights - beforeHighlights) / n,
            shadowClipDelta: Double(afterShadows - beforeShadows) / n
        )
        return PixelStats(metrics: metrics, residual: meanDelta + metrics.meanLumaDifference * 15)
    }

    private struct RegionAccumulator {
        var total = 0.0
        var count = 0
        mutating func add(_ value: Double) { total += value; count += 1 }
        var mean: Double? { count == 0 ? nil : total / Double(count) }
    }

    private static func detectFaceRects(_ image: CGImage) -> [CGRect] {
        let request = VNDetectFaceRectanglesRequest()
        try? VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        return (request.results ?? []).filter { $0.confidence >= 0.5 }.map(\.boundingBox)
    }

    private static func quickResidual(_ before: CIImage, _ after: CIImage, extent: CGRect) -> Double {
        let difference = CIFilter.differenceBlendMode()
        difference.inputImage = before
        difference.backgroundImage = after
        guard let output = difference.outputImage?.cropped(to: extent),
              let average = CIFilter(name: "CIAreaAverage")
        else { return .greatestFiniteMagnitude }
        average.setValue(output, forKey: kCIInputImageKey)
        average.setValue(CIVector(cgRect: extent), forKey: "inputExtent")
        guard let pixel = average.outputImage else { return .greatestFiniteMagnitude }
        var values = [Float](repeating: 0, count: 4)
        ImageAnalyser.sharedContext.render(pixel, toBitmap: &values,
            rowBytes: 4 * MemoryLayout<Float>.size,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBAf, colorSpace: nil)
        return Double(values[0] + values[1] + values[2]) / 3
    }

    private static func analysisSize(width: Int, height: Int) -> CGSize {
        let cap = 768.0
        let scale = min(1, cap / Double(max(width, height)))
        return CGSize(width: max(1, (Double(width) * scale).rounded()),
                      height: max(1, (Double(height) * scale).rounded()))
    }

    private static func redraw(_ image: CGImage, size: CGSize) -> CGImage? {
        let width = Int(size.width), height = Int(size.height)
        guard let context = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8,
            bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(origin: .zero, size: size))
        return context.makeImage()
    }

    private static func labDistance(_ lhs: (Double, Double, Double), _ rhs: (Double, Double, Double)) -> Double {
        let a = rgbToLab(lhs), b = rgbToLab(rhs)
        let dl = a.0 - b.0, da = a.1 - b.1, db = a.2 - b.2
        return sqrt(dl * dl + da * da + db * db)
    }

    private static func rgbToLab(_ rgb: (Double, Double, Double)) -> (Double, Double, Double) {
        func linear(_ c: Double) -> Double { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        let r = linear(rgb.0), g = linear(rgb.1), b = linear(rgb.2)
        let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
        let y = r * 0.2126 + g * 0.7152 + b * 0.0722
        let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
        func f(_ t: Double) -> Double { t > 0.008856 ? pow(t, 1 / 3) : 7.787 * t + 16 / 116 }
        let fx = f(x), fy = f(y), fz = f(z)
        return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
    }
}

/// Heatmap uses the exact same registered pair as the persisted QC pass.
enum DiffHeatmap {
    static func overlay(before: UIImage, after: UIImage, gain: Double = 3.0) -> UIImage? {
        guard let beforeCG = before.normalizedCGImage(),
              let afterCG = after.normalizedCGImage(),
              let (reference, aligned, extent) = EditValidationEngine.alignedImages(
                before: beforeCG, after: afterCG
              )
        else { return nil }
        let difference = CIFilter.differenceBlendMode()
        difference.inputImage = aligned.cropped(to: extent)
        difference.backgroundImage = reference
        guard let diff = difference.outputImage?.cropped(to: extent) else { return nil }
        let matrix = CIFilter.colorMatrix()
        matrix.inputImage = diff
        let zero = CIVector(x: 0, y: 0, z: 0, w: 0)
        matrix.rVector = zero
        matrix.gVector = zero
        matrix.bVector = zero
        let g = CGFloat(gain)
        matrix.aVector = CIVector(x: 0.30 * g, y: 0.59 * g, z: 0.11 * g, w: 0)
        matrix.biasVector = CIVector(x: 0.98, y: 0.55, z: 0.12, w: 0)
        guard let heat = matrix.outputImage?.cropped(to: extent),
              let cg = ImageAnalyser.sharedContext.createCGImage(heat, from: extent)
        else { return nil }
        return UIImage(cgImage: cg)
    }
}

private extension UIImage {
    func normalizedCGImage() -> CGImage? {
        if imageOrientation == .up, let cgImage { return cgImage }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = false
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }.cgImage
    }
}
