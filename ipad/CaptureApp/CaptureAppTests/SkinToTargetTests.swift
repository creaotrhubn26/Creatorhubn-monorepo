import XCTest
@testable import CaptureApp

/// Fase 2 — melanin-bevarende hud-cast-korreksjon.
final class SkinToTargetTests: XCTestCase {

    private let targetHue = 49.0
    private var u: (x: Double, y: Double) {
        let t = targetHue * Double.pi / 180; return (cos(t), sin(t))
    }
    /// Signert avstand ⊥ linja (casten). 0 = på linja.
    private func perp(_ a: Double, _ b: Double) -> Double { -a * u.y + b * u.x }
    /// Projeksjon LANGS linja (melanin-aksen).
    private func along(_ a: Double, _ b: Double) -> Double { a * u.x + b * u.y }

    /// Punkt med gitt melanin (langs) + cast (perp).
    private func point(along al: Double, perp pe: Double) -> (a: Double, b: Double) {
        (al * u.x + pe * (-u.y), al * u.y + pe * u.x)
    }

    // MARK: - Grunnleggende

    func testOnLineIsIdentity() {
        // På linja (perp=0) → ingenting å korrigere.
        let p = point(along: 25, perp: 0)
        let c = SkinToTarget.correction(measuredA: p.a, measuredB: p.b)
        XCTAssertEqual(c.da, 0, accuracy: 1e-6)
        XCTAssertEqual(c.db, 0, accuracy: 1e-6)
    }

    func testLowChromaIsIdentity() {
        XCTAssertEqual(SkinToTarget.correction(measuredA: 1, measuredB: 1), .identity)
    }

    func testCastIsReducedTowardLine() {
        // Melanin 25, cast +6 ⊥ linja. strength 0.5 → casten skal HALVERES.
        let p = point(along: 25, perp: 6)
        let c = SkinToTarget.correction(measuredA: p.a, measuredB: p.b, strength: 0.5)
        let (na, nb) = SkinToTarget.applied(a: p.a, b: p.b, c)
        XCTAssertEqual(perp(na, nb), 3.0, accuracy: 0.01, "cast skal halveres (halvveis mot linja)")
        XCTAssertLessThan(abs(perp(na, nb)), abs(perp(p.a, p.b)))
    }

    // MARK: - 🔒 Melanin-aksen bevares (kjerne-sikkerheten)

    func testMelaninAxisIsMathematicallyPreserved() {
        // For ET HVILKET SOM HELST cast-punkt skal endringen LANGS linja være ~0,
        // og langs-komponenten av det korrigerte punktet = originalens. Dvs.
        // systemet kan ALDRI lysne/mørkne/endre en persons faktiske hudtone.
        for (al, pe) in [(15.0, 8.0), (25.0, -5.0), (35.0, 10.0), (20.0, -12.0)] {
            let p = point(along: al, perp: pe)
            let c = SkinToTarget.correction(measuredA: p.a, measuredB: p.b, strength: 0.5)
            XCTAssertEqual(SkinToTarget.alongLineChange(c, targetHueDegrees: targetHue), 0, accuracy: 1e-9)
            let (na, nb) = SkinToTarget.applied(a: p.a, b: p.b, c)
            XCTAssertEqual(along(na, nb), along(p.a, p.b), accuracy: 1e-6, "melanin (langs linja) uendret")
        }
    }

    func testDarkSkinChromaNotReduced() {
        // Mørk/mettet hud (høy chroma 40) med en liten cast → korreksjonen skal IKKE
        // dra chroma ned (det ville vært å endre melanin). Chroma ≈ uendret.
        let p = point(along: 40, perp: 4)
        let c = SkinToTarget.correction(measuredA: p.a, measuredB: p.b, strength: 0.5)
        let (na, nb) = SkinToTarget.applied(a: p.a, b: p.b, c)
        let before = (p.a * p.a + p.b * p.b).squareRoot()
        let after = (na * na + nb * nb).squareRoot()
        // Chroma kan endres marginalt (perp-komponent), men langs-aksen (dominant) er låst.
        XCTAssertEqual(along(na, nb), along(p.a, p.b), accuracy: 1e-6)
        XCTAssertGreaterThan(after, before * 0.9, "chroma skal ikke kollapse")
    }

    // MARK: - Demping / klemming / determinisme

    func testMaxShiftClampsHugeCast() {
        let p = point(along: 20, perp: 40)   // enorm cast
        let c = SkinToTarget.correction(measuredA: p.a, measuredB: p.b, strength: 1.0, maxShift: 8)
        XCTAssertLessThanOrEqual((c.da * c.da + c.db * c.db).squareRoot(), 8.0 + 1e-6)
    }

    func testDeterministic() {
        let p = point(along: 22, perp: 7)
        let c1 = SkinToTarget.correction(measuredA: p.a, measuredB: p.b)
        let c2 = SkinToTarget.correction(measuredA: p.a, measuredB: p.b)
        XCTAssertEqual(c1, c2)
    }

    func testStrengthNeverOvershoots() {
        // strength ≤ 1 → aldri forbi linja (perp bytter ikke fortegn).
        let p = point(along: 25, perp: 6)
        let c = SkinToTarget.correction(measuredA: p.a, measuredB: p.b, strength: 1.0)
        let (na, nb) = SkinToTarget.applied(a: p.a, b: p.b, c)
        XCTAssertEqual(perp(na, nb), 0, accuracy: 0.01, "strength 1.0 lander PÅ linja, ikke forbi")
    }

    func testIdentityAppliedIsNoOp() {
        let (a, b) = SkinToTarget.applied(a: 7, b: -3, .identity)
        XCTAssertEqual(a, 7, accuracy: 1e-9)
        XCTAssertEqual(b, -3, accuracy: 1e-9)
    }
}
