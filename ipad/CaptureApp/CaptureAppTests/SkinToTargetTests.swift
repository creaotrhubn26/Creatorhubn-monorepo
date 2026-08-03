import XCTest
@testable import CaptureApp

/// Fase 2 — hud-mot-linjen (hue-nudge + chroma-guard).
final class SkinToTargetTests: XCTestCase {

    private func hueDeg(_ a: Double, _ b: Double) -> Double { atan2(b, a) * 180 / .pi }

    // MARK: - Korreksjon

    func testOnTargetSkinIsNearIdentity() {
        // hue = 45° (a=b), chroma 21 (i båndet) → nesten ingen endring.
        let c = SkinToTarget.correction(a: 15, b: 15)
        XCTAssertEqual(c.rotationRadians, 0, accuracy: 1e-9)
        XCTAssertEqual(c.chromaScale, 1, accuracy: 1e-6)
    }

    func testTooOrangeRotatesTowardTarget() {
        // hue ≈ 14° (< 45) → positiv rotasjon, og påført skal hue-en ØKE mot 45.
        let a = 20.0, b = 5.0
        let c = SkinToTarget.correction(a: a, b: b)
        XCTAssertGreaterThan(c.rotationRadians, 0)
        let (na, nb) = SkinToTarget.applied(a: a, b: b, c)
        XCTAssertGreaterThan(hueDeg(na, nb), hueDeg(a, b), "hue skal flytte mot linja")
        XCTAssertLessThanOrEqual(hueDeg(na, nb), 45.0, "men ikke forbi målet")
    }

    func testTooMagentaRotatesNegative() {
        // hue ≈ 76° (> 45) → negativ rotasjon.
        let c = SkinToTarget.correction(a: 5, b: 20)
        XCTAssertLessThan(c.rotationRadians, 0)
        let (na, nb) = SkinToTarget.applied(a: 5, b: 20, c)
        XCTAssertLessThan(hueDeg(na, nb), hueDeg(5, 20))
    }

    func testRotationIsClampedAndDamped() {
        // Hue langt unna (a=25,b=0 → 0°, 45° unna) → klemt til 8·0.7 = 5.6°.
        let c = SkinToTarget.correction(a: 25, b: 0, targetHueDegrees: 45,
                                        maxRotationDegrees: 8, damping: 0.7)
        XCTAssertEqual(c.rotationRadians * 180 / .pi, 5.6, accuracy: 0.01)
    }

    func testLowChromaIsIdentity() {
        // For grå til å ha pålitelig hue → ingen rotasjon (unngå å farge nøytralt).
        XCTAssertEqual(SkinToTarget.correction(a: 1, b: 1), .identity)
    }

    func testHighChromaDesaturates() {
        // Chroma 42 (> 26) → skala < 1 (dra inn mot naturlig bånd).
        let c = SkinToTarget.correction(a: 30, b: 30, chromaRange: 12...26)
        XCTAssertLessThan(c.chromaScale, 1.0)
    }

    func testFaintButValidChromaBoosts() {
        // Chroma 5 (over minChroma 3, men under båndet) → skala > 1.
        let c = SkinToTarget.correction(a: 5, b: 0, chromaRange: 12...26, minChroma: 3)
        XCTAssertGreaterThan(c.chromaScale, 1.0)
    }

    // MARK: - Påføring (per-piksel matte)

    func testAppliedRotationIsCorrect() {
        // +90° rotasjon, skala 1: (1,0) → (0,1).
        let c = SkinToTarget.Correction(rotationRadians: .pi / 2, chromaScale: 1)
        let (a, b) = SkinToTarget.applied(a: 1, b: 0, c)
        XCTAssertEqual(a, 0, accuracy: 1e-9)
        XCTAssertEqual(b, 1, accuracy: 1e-9)
    }

    func testAppliedScalePreservesHueChangesChroma() {
        let c = SkinToTarget.Correction(rotationRadians: 0, chromaScale: 0.5)
        let (a, b) = SkinToTarget.applied(a: 10, b: 10, c)
        XCTAssertEqual(a, 5, accuracy: 1e-9)
        XCTAssertEqual(b, 5, accuracy: 1e-9)
        XCTAssertEqual(hueDeg(a, b), hueDeg(10, 10), accuracy: 1e-9)  // hue uendret
    }

    func testIdentityAppliedIsNoOp() {
        let (a, b) = SkinToTarget.applied(a: 7, b: -3, .identity)
        XCTAssertEqual(a, 7, accuracy: 1e-9)
        XCTAssertEqual(b, -3, accuracy: 1e-9)
    }
}
