import XCTest
@testable import CaptureApp

/// Fase 2 — forbudssone (den harde grensen, generisk hud/mat).
final class ForbiddenZoneTests: XCTestCase {

    private func chroma(_ a: Double, _ b: Double) -> Double { (a * a + b * b).squareRoot() }
    private func hue(_ a: Double, _ b: Double) -> Double { atan2(b, a) * 180 / .pi }

    func testEmptyZoneIsNoOp() {
        let (a, b) = ForbiddenZone().clamp(a: 10, b: -10)
        XCTAssertEqual(a, 10, accuracy: 1e-9)
        XCTAssertEqual(b, -10, accuracy: 1e-9)
    }

    func testOutsideZoneUnchanged() {
        // Blå-sone (b negativ, ~−90°). Et rødt/varmt punkt (hue 0) er utenfor.
        let z = ForbiddenZone([(-135.0)...(-45.0)])
        XCTAssertFalse(z.contains(hueDeg: 0))
        let (a, b) = z.clamp(a: 12, b: 0)
        XCTAssertEqual(a, 12, accuracy: 1e-9)
        XCTAssertEqual(b, 0, accuracy: 1e-9)
    }

    func testInsideZoneClampsToNearestEdgePreservingChroma() {
        // hue −80° ligger i blå-sona; nærmeste kant er −45° (35° unna) vs −135° (55°).
        let z = ForbiddenZone([(-135.0)...(-45.0)])
        let a = 10 * cos(-80 * Double.pi / 180), b = 10 * sin(-80 * Double.pi / 180)
        XCTAssertTrue(z.contains(hueDeg: hue(a, b)))
        let (na, nb) = z.clamp(a: a, b: b)
        XCTAssertEqual(hue(na, nb), -45, accuracy: 0.4, "roter til nærmeste tillatte kant")
        XCTAssertEqual(chroma(na, nb), chroma(a, b), accuracy: 1e-6, "chroma bevart")
    }

    func testPicksTheGenuinelyNearestEdge() {
        // hue −120° → nærmere −135° (15°) enn −45° (75°).
        let z = ForbiddenZone([(-135.0)...(-45.0)])
        let a = 8 * cos(-120 * Double.pi / 180), b = 8 * sin(-120 * Double.pi / 180)
        let (na, nb) = z.clamp(a: a, b: b)
        XCTAssertEqual(hue(na, nb), -135, accuracy: 0.4)
    }

    func testWrapAroundZone() {
        // Sone som krysser ±180 (170…190 ≙ 170…180 ∪ −180…−170).
        let z = ForbiddenZone([170.0...190.0])
        XCTAssertTrue(z.contains(hueDeg: 178))
        XCTAssertTrue(z.contains(hueDeg: -175))   // wrap
        XCTAssertFalse(z.contains(hueDeg: 160))
        let a = 5 * cos(178 * Double.pi / 180), b = 5 * sin(178 * Double.pi / 180)
        let (na, nb) = z.clamp(a: a, b: b)
        XCTAssertEqual(chroma(na, nb), 5, accuracy: 1e-6)
        XCTAssertFalse(z.contains(hueDeg: hue(na, nb)), "skal være ute av sona etter klem")
    }

    func testZeroChromaIsSafe() {
        let (a, b) = ForbiddenZone([(-135.0)...(-45.0)]).clamp(a: 0, b: 0)
        XCTAssertEqual(a, 0, accuracy: 1e-9)
        XCTAssertEqual(b, 0, accuracy: 1e-9)
    }
}
