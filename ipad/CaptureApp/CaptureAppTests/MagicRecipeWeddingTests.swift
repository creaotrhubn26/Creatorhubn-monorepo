import XCTest
import UIKit
@testable import CaptureApp

/// Dekker det nye «Bryllup»-presetet + auto-enhance-gaten.
final class MagicRecipeWeddingTests: XCTestCase {

    /// Bryllup-presetet er korrigerende: kjøler (negativ varme), gjenoppretter
    /// høylys, demper metning, og slår AV auto-enhance (skal ikke re-prosessere
    /// leverte bilder). De andre presetsene beholder auto-enhance som standard.
    func testWeddingPresetIsCorrectiveAndGatesAutoEnhance() {
        let w = MagicRecipe.wedding
        XCTAssertFalse(w.autoEnhance, "bryllup skal ikke auto-enhance leverte bilder")
        XCTAssertLessThan(w.warmth, 0, "bryllup skal KJØLE tungsten-varme, ikke addere")
        XCTAssertGreaterThan(w.highlightRecovery, 0.3, "bryllup skal gjenopprette høylys")
        XCTAssertLessThanOrEqual(w.saturation, 0, "bryllup skal ikke øke global metning (temmer oransje hud)")
        XCTAssertGreaterThan(w.vibrance, 0, "bryllup bruker vibrance som beskytter hud")
        // Standard-oppførsel bevart for fangst-presets.
        XCTAssertTrue(MagicRecipe.portrait.autoEnhance)
        XCTAssertTrue(MagicRecipe.neutral.autoEnhance)
    }

    /// REGRESJON: `merging(baseline:)` MÅ videreføre autoEnhance/skinGuard/
    /// filmGrain. De manglet i memberwise-rekonstruksjonen → ble stille nullstilt
    /// (true/0/0) ved HVER render (merging kalles ubetinget i begge pipelines), så
    /// Bryllup-presetets `autoEnhance:false` + skinGuard + filmGrain forsvant helt.
    func testMergingPreservesAutoEnhanceSkinGuardAndFilmGrain() {
        var recipe = MagicRecipe.wedding
        recipe.skinGuard = 0.7
        recipe.filmGrain = 0.15
        XCTAssertFalse(recipe.autoEnhance)
        // Merge mot en tom baseline (som subjectType `.none` gir i pipelinen).
        let merged = recipe.merging(baseline: MagicRecipe())
        XCTAssertFalse(merged.autoEnhance, "merging nullstilte autoEnhance til true")
        XCTAssertEqual(merged.skinGuard, 0.7, accuracy: 0.0001, "merging nullstilte skinGuard")
        XCTAssertEqual(merged.filmGrain, 0.15, accuracy: 0.0001, "merging nullstilte filmGrain")
        // Baseline som VIL auto-enhance overstyrer ikke recipens «av».
        var wantsEnhance = MagicRecipe(); wantsEnhance.autoEnhance = true
        XCTAssertFalse(recipe.merging(baseline: wantsEnhance).autoEnhance,
                       "recipens autoEnhance:false skal vinne over baseline")
    }

    /// autoEnhance runder trippen gjennom Codable (persistert edit-state).
    func testAutoEnhanceRoundTripsThroughCodable() throws {
        let enc = try JSONEncoder().encode(MagicRecipe.wedding)
        let dec = try JSONDecoder().decode(MagicRecipe.self, from: enc)
        XCTAssertFalse(dec.autoEnhance)
        // Gamle recipes uten feltet dekoder til true (bakoverkompat).
        let legacy = "{\"warmth\":0,\"shadowLift\":0,\"contrast\":0,\"saturation\":0}"
        let old = try JSONDecoder().decode(MagicRecipe.self, from: Data(legacy.utf8))
        XCTAssertTrue(old.autoEnhance, "manglende autoEnhance skal falle til true")
    }

    /// Begge grenene av auto-enhance-gaten rendrer et gyldig bilde (koden
    /// forgrener på flagget uten å krasje). Merk: Apples scene-`.enhance` er en
    /// no-op på et innholdsløst synteten (ingen ansikter/scene), så den VISUELLE
    /// forskjellen er verifisert live på ekte foto, ikke via pixel-diff her.
    func testAutoEnhanceGateRendersBothBranches() throws {
        let img = makeImage()
        let jpeg = try XCTUnwrap(img.jpegData(compressionQuality: 0.95))
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("redig_gate.jpg")
        try jpeg.write(to: tmp); defer { try? FileManager.default.removeItem(at: tmp) }
        var on = MagicRecipe.neutral; on.autoEnhance = true
        var off = MagicRecipe.neutral; off.autoEnhance = false
        let rOn = try XCTUnwrap(MagicPipeline.renderPreview(source: tmp.path, recipe: on)?.cgImage)
        let rOff = try XCTUnwrap(MagicPipeline.renderPreview(source: tmp.path, recipe: off)?.cgImage)
        XCTAssertGreaterThan(Self.meanLuma(rOn), 0.02, "enhance=på rendret svart")
        XCTAssertGreaterThan(Self.meanLuma(rOff), 0.02, "enhance=av rendret svart")
    }

    private func makeImage(_ side: CGFloat = 256) -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { ctx in
            let cs = CGColorSpaceCreateDeviceRGB()
            let grad = CGGradient(colorsSpace: cs, colors: [
                UIColor(red: 0.6, green: 0.35, blue: 0.15, alpha: 1).cgColor,
                UIColor(white: 0.9, alpha: 1).cgColor] as CFArray, locations: [0, 1])!
            ctx.cgContext.drawLinearGradient(grad, start: .zero, end: CGPoint(x: side, y: side), options: [])
            UIColor(red: 0.8, green: 0.5, blue: 0.35, alpha: 1).setFill()
            ctx.cgContext.fill(CGRect(x: side * 0.3, y: side * 0.3, width: side * 0.4, height: side * 0.4))
        }
    }

    /// `isNeutral` MÅ bli false så snart EN akse er rørt — ellers merger
    /// RAWExportPipeline inn Picture Style-baselinen oppå fotografens valg.
    /// skinGuard + filmGrain manglet i sjekken; denne fanger «nytt felt, glemt
    /// isNeutral» permanent (sett hver akse enkeltvis, assert IKKE nøytral).
    func testIsNeutralIsFalseForEachSingleAxis() {
        XCTAssertTrue(MagicRecipe().isNeutral, "en urørt recipe skal være nøytral")
        var mutators: [(String, (inout MagicRecipe) -> Void)] = [
            ("warmth", { $0.warmth = 0.2 }), ("skinHighFreq", { $0.skinHighFreq = 0.2 }),
            ("skinLowFreq", { $0.skinLowFreq = 0.2 }), ("skinSmooth", { $0.skinSmooth = 0.2 }),
            ("shadowLift", { $0.shadowLift = 0.2 }), ("contrast", { $0.contrast = 0.2 }),
            ("saturation", { $0.saturation = 0.2 }), ("highlightRecovery", { $0.highlightRecovery = 0.2 }),
            ("vibrance", { $0.vibrance = 0.2 }), ("texture", { $0.texture = 0.2 }),
            ("dehaze", { $0.dehaze = 0.2 }), ("eyeSharpen", { $0.eyeSharpen = 0.2 }),
            ("eyeCatchlight", { $0.eyeCatchlight = 0.2 }), ("autoStraighten", { $0.autoStraighten = true }),
            ("teethWhiten", { $0.teethWhiten = 0.2 }), ("skinUnify", { $0.skinUnify = 0.2 }),
            ("skinGuard", { $0.skinGuard = 0.2 }), ("filmGrain", { $0.filmGrain = 0.2 }),
        ]
        for (name, mutate) in mutators {
            var r = MagicRecipe()
            mutate(&r)
            XCTAssertFalse(r.isNeutral, "isNeutral skal være false når \(name) er satt")
        }
    }

    private static func meanLuma(_ cg: CGImage) -> Double {
        let w = 32, h = 32
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let cs = CGColorSpaceCreateDeviceRGB()
        CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                  space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)?
            .draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) {
            sum += 0.299 * Double(px[i]) + 0.587 * Double(px[i + 1]) + 0.114 * Double(px[i + 2])
        }
        return sum / Double(px.count / 4) / 255.0
    }
}
