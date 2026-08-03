import XCTest
@testable import CaptureApp

/// Fase 2 Lag 1 — CAT02 kromatisk adaptasjon (illuminant-normalisering til D65).
final class ChromaticAdaptationTests: XCTestCase {

    private func assertXYZ(_ a: ChromaticAdaptation.XYZ, _ b: ChromaticAdaptation.XYZ,
                           _ acc: Double, _ msg: String = "") {
        XCTAssertEqual(a.X, b.X, accuracy: acc, msg)
        XCTAssertEqual(a.Y, b.Y, accuracy: acc, msg)
        XCTAssertEqual(a.Z, b.Z, accuracy: acc, msg)
    }

    func testD65ToD65IsIdentity() {
        let m = ChromaticAdaptation.adaptationMatrix(from: ChromaticAdaptation.d65,
                                                     to: ChromaticAdaptation.d65)
        let id: [Double] = [1, 0, 0, 0, 1, 0, 0, 0, 1]
        for i in 0..<9 { XCTAssertEqual(m[i], id[i], accuracy: 1e-6) }
    }

    func testAdaptingSourceWhiteYieldsDestWhite() {
        // Definisjonen: adapter kilde-hvitpunktet → mål-hvitpunktet. En perfekt grå
        // (som reflekterer illuminanten) under tungsten skal bli D65-nøytral.
        let tungsten = ChromaticAdaptation.whitePoint(fromCCT: 3200)
        let adapted = ChromaticAdaptation.adaptToD65(tungsten, sourceCCT: 3200)
        assertXYZ(adapted, ChromaticAdaptation.d65, 1e-4, "grå under tungsten → D65-nøytral")
    }

    func testCCT6504IsNearD65() {
        // Kim-approksimasjonen treffer DAGSLYS-locus ved 6504 K — nær D65, men ikke
        // eksakt (D65s SPD ligger litt over locus i y). Løsere toleranse på det.
        let wp = ChromaticAdaptation.whitePoint(fromCCT: 6504)
        assertXYZ(wp, ChromaticAdaptation.d65, 0.05, "~6504 K ≈ D65 (daglys-locus)")
    }

    func testTungstenIsWarmerThanD65() {
        // Varmt lys: mer rødt/mindre blått → høyere X/Z enn D65.
        let t = ChromaticAdaptation.whitePoint(fromCCT: 3200)
        XCTAssertGreaterThan(t.X / t.Z, ChromaticAdaptation.d65.X / ChromaticAdaptation.d65.Z)
    }

    func testShadeIsCoolerThanD65() {
        // Kjølig skygge (~8000 K): mer blått → lavere X/Z.
        let s = ChromaticAdaptation.whitePoint(fromCCT: 8000)
        XCTAssertLessThan(s.X / s.Z, ChromaticAdaptation.d65.X / ChromaticAdaptation.d65.Z)
    }

    func testWarmColorAdaptedCoolsDown() {
        // En varm-lys farge (samme kromatisitet som tungsten-hvit, litt mørkere)
        // adaptert til D65 skal få LAVERE X/Z (kjøligere) enn før.
        let t = ChromaticAdaptation.whitePoint(fromCCT: 3200)
        let warm: ChromaticAdaptation.XYZ = (t.X * 0.5, 0.5, t.Z * 0.5)
        let cooled = ChromaticAdaptation.adaptToD65(warm, sourceCCT: 3200)
        XCTAssertLessThan(cooled.X / cooled.Z, warm.X / warm.Z)
    }

    func testCCTClampsGracefully() {
        // Utenfor gyldig område → ingen NaN/crash (klemt).
        let lo = ChromaticAdaptation.whitePoint(fromCCT: 500)
        let hi = ChromaticAdaptation.whitePoint(fromCCT: 40000)
        XCTAssertTrue(lo.X.isFinite && lo.Z.isFinite && hi.X.isFinite && hi.Z.isFinite)
    }
}
