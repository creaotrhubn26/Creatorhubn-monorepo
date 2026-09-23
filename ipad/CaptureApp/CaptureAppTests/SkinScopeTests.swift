import XCTest
@testable import CaptureApp

/// Fase 2 — hud-vectorscope vaktpost (cast / spread / blandet-lys-deteksjon).
final class SkinScopeTests: XCTestCase {

    /// N hud-prøver samlet rundt `center` med litt (deterministisk) spredning.
    private func cloud(around center: Double, n: Int, jitter: Double = 1.5) -> [Double] {
        (0..<n).map { center + (Double($0 % 7) - 3) / 3 * jitter }
    }

    func testTooFewSamplesIsInsufficient() {
        let r = SkinScope.analyze(hues: cloud(around: 49, n: 100), wedgeCenterDeg: 49,
                                  wedgeHalfWidthDeg: 8, minSamples: 1500)
        XCTAssertEqual(r.status, .insufficient)
    }

    func testOnLineCloud() {
        let r = SkinScope.analyze(hues: cloud(around: 49, n: 2000), wedgeCenterDeg: 49,
                                  wedgeHalfWidthDeg: 8)
        XCTAssertEqual(r.status, .onLine)
        XCTAssertEqual(r.castDeg, 0, accuracy: 1.0)
        XCTAssertFalse(r.bimodal)
        XCTAssertEqual(r.fractionOutsideWedge, 0, accuracy: 0.01)
        XCTAssertLessThan(r.spreadDeg, 2.0)
    }

    func testWarmCastWithinWedgeIsTolerable() {
        // +5° varm, kile ±8 → innenfor (gyllen-time-toleranse).
        let r = SkinScope.analyze(hues: cloud(around: 54, n: 2000), wedgeCenterDeg: 49,
                                  wedgeHalfWidthDeg: 8)
        XCTAssertEqual(r.status, .tolerable)
        XCTAssertEqual(r.castDeg, 5, accuracy: 1.0)
        XCTAssertEqual(r.fractionOutsideWedge, 0, accuracy: 0.05)
    }

    func testStrongCastOutsideWedge() {
        // +16° → utenfor kilen → .cast + all hud utenfor.
        let r = SkinScope.analyze(hues: cloud(around: 65, n: 2000), wedgeCenterDeg: 49,
                                  wedgeHalfWidthDeg: 8)
        XCTAssertEqual(r.status, .cast)
        XCTAssertGreaterThan(r.castDeg, 12)
        XCTAssertEqual(r.fractionOutsideWedge, 1.0, accuracy: 0.05)
    }

    func testBimodalDetectsMixedLight() {
        // Halve ansiktet dagslys (nøytral, ~44°), halve tungsten (varm, ~64°) → to
        // klumper 20° fra hverandre = blandet lys.
        let mixed = cloud(around: 44, n: 1000) + cloud(around: 64, n: 1000)
        let r = SkinScope.analyze(hues: mixed, wedgeCenterDeg: 49, wedgeHalfWidthDeg: 8)
        XCTAssertTrue(r.bimodal, "to illuminanter på huden skal flagges som blandet lys")
        XCTAssertGreaterThan(r.spreadDeg, 8, "bimodal → stor spredning")
    }

    func testUnimodalIsNotBimodal() {
        let r = SkinScope.analyze(hues: cloud(around: 49, n: 2000, jitter: 3), wedgeCenterDeg: 49,
                                  wedgeHalfWidthDeg: 8)
        XCTAssertFalse(r.bimodal)
    }

    func testDeterministic() {
        let h = cloud(around: 52, n: 1800)
        XCTAssertEqual(SkinScope.analyze(hues: h, wedgeCenterDeg: 49, wedgeHalfWidthDeg: 8),
                       SkinScope.analyze(hues: h, wedgeCenterDeg: 49, wedgeHalfWidthDeg: 8))
    }
}
