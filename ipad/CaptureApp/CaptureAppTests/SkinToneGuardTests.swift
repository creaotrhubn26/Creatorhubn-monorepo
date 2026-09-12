import XCTest
import CoreGraphics
@testable import CaptureApp

/// Dekker den rene hud-tone-matematikken (sRGB→Lab a* + korreksjons-bias).
/// Prinsipp fra research: a*≈10–11 er den etnisitets-invariante hud-rødheten;
/// bevar L*/b*, korriger kun rød↔grønn-aksen; fiks både grønn og oransje.
final class SkinToneGuardTests: XCTestCase {

    // MARK: - a* fra kjente hud-RGB

    func testNaturalMidSkinHasHealthyAStar() {
        // Klassisk naturlig hud RGB(232,190,172) → a* skal ligge i sunt bånd ~10–20.
        let a = SkinToneMath.aStar(r: 232 / 255, g: 190 / 255, b: 172 / 255)
        XCTAssertGreaterThan(a, 6)
        XCTAssertLessThan(a, 24)
    }

    func testNeutralGrayHasNearZeroAStar() {
        let a = SkinToneMath.aStar(r: 0.5, g: 0.5, b: 0.5)
        XCTAssertEqual(a, 0, accuracy: 0.5)
    }

    func testGreenishSkinHasLowerAStarThanReddish() {
        // Grønn/gjørmete hud (G hevet) skal måle LAVERE a* enn en rødere variant.
        let greenish = SkinToneMath.aStar(r: 190 / 255, g: 200 / 255, b: 172 / 255)
        let reddish = SkinToneMath.aStar(r: 210 / 255, g: 180 / 255, b: 172 / 255)
        XCTAssertLessThan(greenish, reddish)
    }

    // MARK: - Korreksjons-bias (begge feilmodusene fra ÉN formel)

    func testGreenMuddySkinGetsPositiveBias() {
        // a* under målet (grønn) → positiv bias (hev rød, senk grønn).
        let bias = SkinToneMath.redGreenBias(aStar: 2, intensity: 0.7)
        XCTAssertGreaterThan(bias, 0)
    }

    func testOrangeSkinGetsNegativeBias() {
        // a* over målet (oransje/solbrent) → negativ bias (senk rød).
        let bias = SkinToneMath.redGreenBias(aStar: 25, intensity: 0.7)
        XCTAssertLessThan(bias, 0)
    }

    func testOnTargetSkinGetsNegligibleBias() {
        let bias = SkinToneMath.redGreenBias(aStar: SkinToneMath.targetA, intensity: 1.0)
        XCTAssertEqual(bias, 0, accuracy: 0.0005)
    }

    func testBiasIsClampedGentle() {
        // Ekstremt avvik skal fortsatt klemmes til den dempede maks-nudgen.
        let extreme = SkinToneMath.redGreenBias(aStar: -80, intensity: 1.0)
        XCTAssertLessThanOrEqual(abs(extreme), SkinToneMath.maxBias + 1e-9)
        XCTAssertEqual(extreme, SkinToneMath.maxBias, accuracy: 1e-9)
    }

    func testIntensityScalesBias() {
        let full = SkinToneMath.redGreenBias(aStar: 4, intensity: 1.0)
        let half = SkinToneMath.redGreenBias(aStar: 4, intensity: 0.5)
        XCTAssertEqual(half, full * 0.5, accuracy: 1e-6)
        XCTAssertEqual(SkinToneMath.redGreenBias(aStar: 4, intensity: 0), 0, accuracy: 1e-9)
    }

    // MARK: - Preset-wiring

    func testWeddingAndPortraitEnableSkinGuard() {
        XCTAssertGreaterThan(MagicRecipe.wedding.skinGuard, 0)
        XCTAssertGreaterThan(MagicRecipe.portrait.skinGuard, 0)
        // Ikke-menneske-presets lar den være av.
        XCTAssertEqual(MagicRecipe.product.skinGuard, 0)
        XCTAssertEqual(MagicRecipe.landscape.skinGuard, 0)
    }

    func testSkinGuardRoundTripsThroughCodable() throws {
        let enc = try JSONEncoder().encode(MagicRecipe.wedding)
        let dec = try JSONDecoder().decode(MagicRecipe.self, from: enc)
        XCTAssertEqual(dec.skinGuard, MagicRecipe.wedding.skinGuard, accuracy: 1e-9)
        // Gamle recipes uten feltet → 0.
        let legacy = "{\"warmth\":0,\"shadowLift\":0,\"contrast\":0,\"saturation\":0}"
        let old = try JSONDecoder().decode(MagicRecipe.self, from: Data(legacy.utf8))
        XCTAssertEqual(old.skinGuard, 0)
    }
}
