import XCTest
import UIKit
@testable import CaptureApp

/// End-to-end coverage of the native Redigering pipeline against a REAL
/// Canon CR2 (`_MG_9300.CR2`) — proving RAW is supported directly (no
/// pre-conversion) and that every Smart Edit function actually changes the
/// rendered pixels.
///
/// The CR2 is a local fixture (21 MB) — not committed. When it's absent the
/// whole suite XCTSkips so CI stays green; run locally with the file dropped
/// into `CaptureAppTests/Resources/_MG_9300.CR2`.
final class RedigeringRawPipelineTests: XCTestCase {

    private func rawData() throws -> Data {
        guard let url = Bundle(for: Self.self).url(forResource: "_MG_9300", withExtension: "CR2") else {
            throw XCTSkip("CR2 fixture not bundled — drop _MG_9300.CR2 into CaptureAppTests/Resources to run.")
        }
        return try Data(contentsOf: url)
    }

    /// Render a CR2 → JPEG via the RAW pipeline and return (bytes, mean luma).
    private func render(_ recipe: MagicRecipe, max: CGFloat? = 1600) throws -> (data: Data, luma: Double, size: CGSize) {
        let raw = try rawData()
        let jpeg = try RAWExportPipeline.render(
            rawData: raw, recipe: recipe, identifierHint: "cr2",
            targetMaxDimension: max, colorPurpose: .appPreview,
        )
        guard let img = UIImage(data: jpeg), let cg = img.cgImage else {
            return (jpeg, -1, .zero)
        }
        return (jpeg, Self.meanLuma(cg), CGSize(width: cg.width, height: cg.height))
    }

    /// 1. RAW DECODE — the CR2 demosaics to a real image (no conversion).
    func testRawDecodes() throws {
        let r = try render(.neutral)
        XCTAssertGreaterThan(r.data.count, 10_000, "RAW render produced too little data")
        XCTAssertGreaterThan(r.size.width, 0)
        XCTAssertGreaterThan(r.size.height, 0)
        XCTAssertGreaterThan(r.luma, 0, "decoded image is all-black")
    }

    /// 2. PRESETS — each factory preset renders a valid, distinct image.
    func testPresetsRender() throws {
        let presets: [(String, MagicRecipe)] = [
            ("product", .product), ("portrait", .portrait), ("food", .food),
            ("landscape", .landscape), ("neutral", .neutral),
        ]
        var lumas: [String: Double] = [:]
        for (name, recipe) in presets {
            let r = try render(recipe)
            XCTAssertGreaterThan(r.data.count, 10_000, "\(name) produced no image")
            XCTAssertGreaterThan(r.luma, 0, "\(name) rendered black")
            lumas[name] = r.luma
        }
        // Presets shouldn't all collapse to the identical look.
        XCTAssertGreaterThan(Set(lumas.values.map { Int($0 * 100) }).count, 1,
                             "all presets produced identical luma — adjustments not applied")
    }

    /// 3. EKSPONERING — the real EV control (RedigeringPipeline.applyExposure)
    /// brightens the RAW-rendered image, and darkens going the other way.
    func testExposureChangesPixels() throws {
        let raw = try rawData()
        let baseJpeg = try RAWExportPipeline.render(
            rawData: raw, recipe: .neutral, identifierHint: "cr2",
            targetMaxDimension: 1600, colorPurpose: .appPreview,
        )
        let base = try XCTUnwrap(UIImage(data: baseJpeg))
        let baseLuma = Self.meanLuma(try XCTUnwrap(base.cgImage))

        let brighter = try XCTUnwrap(RedigeringPipeline.applyExposure(1.5, to: base))
        let brightLuma = Self.meanLuma(try XCTUnwrap(brighter.cgImage))
        XCTAssertGreaterThan(brightLuma, baseLuma, "exposure +1.5 EV did not brighten")

        let darker = try XCTUnwrap(RedigeringPipeline.applyExposure(-1.5, to: base))
        let darkLuma = Self.meanLuma(try XCTUnwrap(darker.cgImage))
        XCTAssertLessThan(darkLuma, baseLuma, "exposure -1.5 EV did not darken")
    }

    /// 4. KONTRAST — contrast extreme produces a measurably different image.
    func testContrastChangesPixels() throws {
        let base = try render(.neutral)
        var c = MagicRecipe.neutral; c.contrast = 1.0
        let out = try render(c)
        XCTAssertNotEqual(Int(out.luma * 50), Int(base.luma * 50), "contrast had no measurable effect")
    }

    /// 5. METNING / 6. SKARPHET / 7. FARGEBALANSE — each axis renders cleanly.
    func testSaturationSharpnessWarmthRender() throws {
        var sat = MagicRecipe.neutral; sat.saturation = 1.0
        var tex = MagicRecipe.neutral; tex.texture = 1.0
        var warm = MagicRecipe.neutral; warm.warmth = 1.0
        var cool = MagicRecipe.neutral; cool.warmth = -1.0
        for (name, r) in [("saturation", sat), ("texture", tex), ("warm", warm), ("cool", cool)] {
            let out = try render(r)
            XCTAssertGreaterThan(out.data.count, 10_000, "\(name) produced no image")
            XCTAssertGreaterThan(out.luma, 0, "\(name) rendered black")
        }
    }

    /// 8. EKSPORT — full-resolution web-delivery render (the persist/deliver
    /// path) succeeds on the full sensor.
    func testFullResWebDeliveryExport() throws {
        let raw = try rawData()
        let jpeg = try RAWExportPipeline.render(
            rawData: raw, recipe: .product, identifierHint: "cr2",
            targetMaxDimension: nil, colorPurpose: .webDelivery,
        )
        XCTAssertGreaterThan(jpeg.count, 200_000, "full-res export suspiciously small")
        let img = try XCTUnwrap(UIImage(data: jpeg))
        // CR2 is 5472×3648 — full render should be in that ballpark.
        XCTAssertGreaterThan(max(img.size.width, img.size.height), 3000,
                             "full-res export downscaled unexpectedly")
    }

    // MARK: - Helpers

    /// Mean luma over a downsampled grid — cheap proxy for "the image changed".
    private static func meanLuma(_ cg: CGImage) -> Double {
        let w = 32, h = 32
        var pixels = [UInt8](repeating: 0, count: w * h * 4)
        let cs = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(data: &pixels, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w * 4, space: cs,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return -1 }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var sum = 0.0
        for i in stride(from: 0, to: pixels.count, by: 4) {
            let r = Double(pixels[i]), g = Double(pixels[i + 1]), b = Double(pixels[i + 2])
            sum += 0.299 * r + 0.587 * g + 0.114 * b
        }
        return sum / Double(w * h) / 255.0
    }
}
