import XCTest
import UIKit
import CoreImage
@testable import CaptureApp

/// Dekker film-korn-finishen + at film-presetsene har research-forankrede,
/// distinkte karakteristikker.
final class FilmPresetsTests: XCTestCase {

    private func makeImage(_ side: CGFloat = 128) -> CIImage {
        let r = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        let ui = r.image { ctx in
            UIColor(white: 0.5, alpha: 1).setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
        }
        return CIImage(image: ui)!
    }

    private func meanLuma(_ ci: CIImage) -> Double {
        let ctx = CIContext(options: [.useSoftwareRenderer: true])
        let cg = ctx.createCGImage(ci, from: ci.extent)!
        let w = 32, h = 32
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let cs = CGColorSpaceCreateDeviceRGB()
        CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                  space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            .draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) { sum += Double(px[i]) }
        return sum / Double(px.count / 4) / 255.0
    }

    // MARK: - Film-korn

    func testGrainOffIsNoOp() {
        var r = MagicRecipe.neutral; r.filmGrain = 0
        let img = makeImage()
        let out = FilmGrainFilter.apply(recipe: r, to: img)
        // Korn av → uendret gjennomsnitt (og samme objekt-oppførsel).
        XCTAssertEqual(meanLuma(out), meanLuma(img), accuracy: 0.002)
    }

    func testGrainAddsTextureButPreservesMeanExposure() {
        var r = MagicRecipe.neutral; r.filmGrain = 0.5
        let img = makeImage()
        let out = FilmGrainFilter.apply(recipe: r, to: img)
        // Soft-light rundt 0.5-grått holder gjennomsnittlig eksponering ~uendret…
        XCTAssertEqual(meanLuma(out), 0.5, accuracy: 0.05)
        // …men innfører variasjon (korn) — std > 0 over en flat flate.
        let ctx = CIContext(options: [.useSoftwareRenderer: true])
        let cg = ctx.createCGImage(out, from: out.extent)!
        // Mål på NATIVE oppløsning (1:1) så kornet ikke midles bort.
        let w = cg.width, h = cg.height
        var px = [UInt8](repeating: 0, count: w * h * 4)
        CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            .draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var vals: [Double] = []
        for i in stride(from: 0, to: px.count, by: 4) { vals.append(Double(px[i]) / 255) }
        let m = vals.reduce(0, +) / Double(vals.count)
        let variance = vals.reduce(0) { $0 + ($1 - m) * ($1 - m) } / Double(vals.count)
        XCTAssertGreaterThan(variance, 0.0001, "korn innførte ingen tekstur på flat flate")
    }

    // MARK: - Preset-karakteristikker (research-forankret)

    func testPortraCleanIsWarmMutedWithSkinGuardAndGrain() {
        let p = MagicRecipe.portraClean
        XCTAssertGreaterThan(p.warmth, 0, "Portra er svakt varm")
        XCTAssertLessThanOrEqual(p.saturation, 0, "film: dempet metning")
        XCTAssertGreaterThan(p.vibrance, 0, "vibrance beskytter hud")
        XCTAssertGreaterThan(p.shadowLift, 0.2, "myk skygge-løft")
        XCTAssertGreaterThan(p.skinGuard, 0)
        XCTAssertGreaterThan(p.filmGrain, 0)
    }

    func testReceptionWarmTamesSkinAndGatesAutoEnhance() {
        let p = MagicRecipe.receptionWarm
        XCTAssertFalse(p.autoEnhance, "leverte fest-bilder skal ikke re-prosesseres")
        XCTAssertGreaterThan(p.skinGuard, 0.7, "hard hud-guard under tungsten")
        XCTAssertGreaterThan(p.highlightRecovery, 0.4, "beskytt levende lys/practicals")
        XCTAssertLessThan(p.saturation, 0)
    }

    func testBrightAiryIsLiftedFlatCoolMuted() {
        let p = MagicRecipe.brightAiry
        XCTAssertGreaterThan(p.shadowLift, 0.3, "sterkt løft = luftig/pastell")
        XCTAssertLessThanOrEqual(p.contrast, 0, "flat/lav kontrast")
        XCTAssertLessThan(p.warmth, 0, "kjølig-nøytral (Fuji-linjen)")
        XCTAssertLessThan(p.saturation, -0.1, "dempede pasteller")
    }

    func testFilmPresetsRoundTripCodable() throws {
        for p in [MagicRecipe.portraClean, .receptionWarm, .brightAiry] {
            let dec = try JSONDecoder().decode(MagicRecipe.self, from: JSONEncoder().encode(p))
            XCTAssertEqual(dec.filmGrain, p.filmGrain, accuracy: 1e-9)
            XCTAssertEqual(dec.skinGuard, p.skinGuard, accuracy: 1e-9)
        }
    }
}
