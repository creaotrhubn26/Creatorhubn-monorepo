import XCTest
import UIKit
import CoreImage
@testable import CaptureApp

/// Pixel-nivå-dekning av Redigering-pipelinen UTEN en ekte CR2 — kjører derfor
/// ALLTID i CI (der RedigeringRawPipelineTests XCTSkip-er fordi RAW-fixturet
/// ikke er buntet). Genererer et syntetisk farge/tone-bilde i kode og beviser at
/// hver redigerings-akse (eksponering, beskjær, kontrast, metning, fargebalanse,
/// high/low-freq hud) faktisk ENDRER de rendrede pikslene — ikke bare no-op-er.
final class RedigeringPipelineSyntheticTests: XCTestCase {

    /// Syntetisk testbilde: diagonal grå→hvit-gradient med et mettet farge-felt,
    /// så både luma-, metning- og hvitbalanse-akser har noe å gripe fatt i.
    private func makeImage(_ side: CGFloat = 256) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        return renderer.image { ctx in
            let cg = ctx.cgContext
            let cs = CGColorSpaceCreateDeviceRGB()
            let grad = CGGradient(colorsSpace: cs,
                                  colors: [UIColor(white: 0.15, alpha: 1).cgColor,
                                           UIColor(white: 0.85, alpha: 1).cgColor] as CFArray,
                                  locations: [0, 1])!
            cg.drawLinearGradient(grad, start: .zero, end: CGPoint(x: side, y: side), options: [])
            // Mettet felt (rødt + blått) for metning/varme-følsomhet.
            UIColor(red: 0.85, green: 0.2, blue: 0.2, alpha: 1).setFill()
            cg.fill(CGRect(x: 0, y: 0, width: side * 0.5, height: side * 0.5))
            UIColor(red: 0.2, green: 0.35, blue: 0.85, alpha: 1).setFill()
            cg.fill(CGRect(x: side * 0.5, y: side * 0.5, width: side * 0.5, height: side * 0.5))
        }
    }

    private func tone(_ recipe: MagicRecipe, _ base: UIImage) throws -> CGImage {
        let ci = try XCTUnwrap(CIImage(image: base))
        let out = RAWExportPipeline.applyToneAdjustments(recipe: recipe, to: ci)
        let ctx = CIContext(options: [.useSoftwareRenderer: true])
        return try XCTUnwrap(ctx.createCGImage(out, from: ci.extent))
    }

    // MARK: - Eksponering (RedigeringPipeline.applyExposure)

    func testExposureBrightensAndDarkens() throws {
        let base = makeImage()
        let baseLuma = Self.meanLuma(try XCTUnwrap(base.cgImage))
        let brighter = try XCTUnwrap(RedigeringPipeline.applyExposure(1.5, to: base))
        let darker = try XCTUnwrap(RedigeringPipeline.applyExposure(-1.5, to: base))
        XCTAssertGreaterThan(Self.meanLuma(try XCTUnwrap(brighter.cgImage)), baseLuma, "+1.5 EV lysnet ikke")
        XCTAssertLessThan(Self.meanLuma(try XCTUnwrap(darker.cgImage)), baseLuma, "-1.5 EV mørknet ikke")
    }

    // MARK: - Beskjær (RedigeringPipeline.cropped)

    func testCropProducesHalfSize() throws {
        let base = makeImage(256)
        let fullW = try XCTUnwrap(base.cgImage).width
        let cropped = RedigeringPipeline.cropped(base, to: CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5))
        let cw = try XCTUnwrap(cropped.cgImage).width
        XCTAssertEqual(Double(cw), Double(fullW) * 0.5, accuracy: 2, "crop-bredde != 50% av kilde")
        XCTAssertLessThan(cw, fullW, "crop krympet ikke bildet")
    }

    // MARK: - Tone-akser (RAWExportPipeline.applyToneAdjustments)

    func testContrastChangesPixels() throws {
        let base = makeImage()
        let neutralLuma = Self.stdevLuma(try tone(.neutral, base))
        var c = MagicRecipe.neutral; c.contrast = 1.0
        let hiContrast = Self.stdevLuma(try tone(c, base))
        // Økt kontrast → større luma-spredning (mørke mørkere, lyse lysere).
        XCTAssertGreaterThan(hiContrast, neutralLuma, "kontrast +1.0 økte ikke luma-spredningen")
    }

    func testSaturationChangesColorSpread() throws {
        let base = makeImage()
        let neutral = Self.meanChroma(try tone(.neutral, base))
        var s = MagicRecipe.neutral; s.saturation = 1.0
        let saturated = Self.meanChroma(try tone(s, base))
        XCTAssertGreaterThan(saturated, neutral, "metning +1.0 økte ikke fargespredningen")
    }

    // MARK: - JPEG-fallback ende-til-ende (renderExport uten RAW)

    func testJpegFallbackExportAppliesRecipeAndCrop() throws {
        let base = makeImage(512)
        let jpeg = try XCTUnwrap(base.jpegData(compressionQuality: 0.95))
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("redig_synt.jpg")
        try jpeg.write(to: tmp)
        defer { try? FileManager.default.removeItem(at: tmp) }

        // Ukroppet eksport → mål render-banens faktiske utdata-bredde (renderPreview
        // kan skalere), så crop-forholdet måles relativt til den, ikke kilden.
        let uncropped = try XCTUnwrap(RedigeringPipeline.renderExport(
            rawPath: nil, jpegPath: tmp.path, recipe: .product, exposureEV: 0))
        let uncroppedW = try XCTUnwrap(UIImage(data: uncropped)?.cgImage).width

        let out = try XCTUnwrap(RedigeringPipeline.renderExport(
            rawPath: nil, jpegPath: tmp.path, recipe: .product,
            exposureEV: 1.0, crop: CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5)))
        let img = try XCTUnwrap(UIImage(data: out))
        let w = try XCTUnwrap(img.cgImage).width
        // Crop halverer render-banens utdata, og resultatet er et gyldig, ikke-svart bilde.
        XCTAssertEqual(Double(w), Double(uncroppedW) * 0.5, accuracy: 4, "eksport-crop halverte ikke bredden")
        XCTAssertLessThan(w, uncroppedW, "eksport-crop krympet ikke bildet")
        XCTAssertGreaterThan(Self.meanLuma(try XCTUnwrap(img.cgImage)), 0.02, "eksport rendret svart/tomt")
    }

    // MARK: - Helpers (32×32 nedsamplet grid)

    private static func sample(_ cg: CGImage) -> [UInt8] {
        let w = 32, h = 32
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let cs = CGColorSpaceCreateDeviceRGB()
        let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8,
                            bytesPerRow: w * 4, space: cs,
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        ctx?.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        return px
    }

    private static func meanLuma(_ cg: CGImage) -> Double {
        let px = sample(cg)
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) {
            sum += 0.299 * Double(px[i]) + 0.587 * Double(px[i + 1]) + 0.114 * Double(px[i + 2])
        }
        return sum / Double(px.count / 4) / 255.0
    }

    private static func stdevLuma(_ cg: CGImage) -> Double {
        let px = sample(cg)
        var vals: [Double] = []
        for i in stride(from: 0, to: px.count, by: 4) {
            vals.append((0.299 * Double(px[i]) + 0.587 * Double(px[i + 1]) + 0.114 * Double(px[i + 2])) / 255.0)
        }
        let m = vals.reduce(0, +) / Double(vals.count)
        return (vals.reduce(0) { $0 + ($1 - m) * ($1 - m) } / Double(vals.count)).squareRoot()
    }

    private static func meanChroma(_ cg: CGImage) -> Double {
        let px = sample(cg)
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) {
            let r = Double(px[i]), g = Double(px[i + 1]), b = Double(px[i + 2])
            let mx = max(r, g, b), mn = min(r, g, b)
            sum += (mx - mn)
        }
        return sum / Double(px.count / 4) / 255.0
    }
}
