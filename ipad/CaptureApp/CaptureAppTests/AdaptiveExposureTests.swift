import XCTest
import UIKit
import CoreImage
@testable import CaptureApp

/// Fase 0 — motiv-vektet, høylys-trygg eksponerings-normalisering.
final class AdaptiveExposureTests: XCTestCase {

    // MARK: - EV-regning (lineært lys)

    func testDarkImageGetsPositiveEV() {
        // current 0.09, key 0.18 → gain 2 → +1.0 EV (p95 lavt, ingen kapping).
        let ev = AdaptiveExposure.evOffset(currentLuma: 0.09, p95Luma: 0.2, targetKey: 0.18)
        XCTAssertEqual(ev, 1.0, accuracy: 0.05)
    }

    func testBrightImageGetsNegativeEV() {
        // current 0.36 → gain 0.5 → −1.0 EV.
        let ev = AdaptiveExposure.evOffset(currentLuma: 0.36, p95Luma: 0.9, targetKey: 0.18)
        XCTAssertEqual(ev, -1.0, accuracy: 0.05)
    }

    func testOnTargetGivesZeroEV() {
        let ev = AdaptiveExposure.evOffset(currentLuma: 0.18, p95Luma: 0.5, targetKey: 0.18)
        XCTAssertEqual(ev, 0, accuracy: 0.02)
    }

    func testHighlightCeilingCapsTheLift() {
        // Mørkt motiv (0.09) VILLE gitt +1 EV, men P95 er alt høy (0.85) → oppløft
        // kappes så P95 ikke blåser over 0.90 (gain ≤ 0.90/0.85 ≈ 1.06 → EV ≈ 0.08).
        let ev = AdaptiveExposure.evOffset(currentLuma: 0.09, p95Luma: 0.85,
                                           targetKey: 0.18, highlightCeil: 0.90)
        XCTAssertLessThan(ev, 0.15, "høylys-vern skal kappe oppløftet kraftig")
        XCTAssertGreaterThanOrEqual(ev, 0, "men aldri gjøre det mørkere pga. vernet")
    }

    func testDarkeningIgnoresHighlightCeiling() {
        // Overeksponert (0.5) med høy P95 → skal fortsatt få negativ EV (nedjustering
        // reduserer høylys, så vernet blokkerer ikke).
        let ev = AdaptiveExposure.evOffset(currentLuma: 0.5, p95Luma: 0.98,
                                           targetKey: 0.18, highlightCeil: 0.90)
        XCTAssertLessThan(ev, -0.5)
    }

    func testEVIsClampedToMax() {
        // Ekstremt mørkt (0.02) → gain 9 → +3.17 EV → klemt til maxEV.
        let ev = AdaptiveExposure.evOffset(currentLuma: 0.02, p95Luma: 0.1,
                                           targetKey: 0.18, maxEV: 1.5)
        XCTAssertEqual(ev, 1.5, accuracy: 1e-6)
    }

    // MARK: - Motiv-vekting

    func testSubjectWeightPullsTowardSubject() {
        // Scene lys (0.5), motiv mørkt (0.1), vekt 0.75 → mål nær motivet.
        let t = AdaptiveExposure.exposureTargetLuma(scene: 0.5, subject: 0.1, subjectWeight: 0.75)
        XCTAssertEqual(t, 0.5 * 0.25 + 0.1 * 0.75, accuracy: 1e-9)
        XCTAssertLessThan(t, 0.3, "skal domineres av motivet")
    }

    func testNoSubjectUsesScene() {
        XCTAssertEqual(AdaptiveExposure.exposureTargetLuma(scene: 0.42, subject: nil), 0.42)
    }

    func testBacklitSubjectDrivesPositiveEVFromSRGB() {
        // Motlys: scene lys (sRGB 0.7) men ansiktet mørkt (sRGB 0.25) → motiv-vektet
        // → skal gi POSITIV EV (eksponer for bruden, ikke himmelen).
        let ev = AdaptiveExposure.evOffsetFromSRGB(sceneMedian: 0.7, subjectLuma: 0.25, p95: 0.75)
        XCTAssertGreaterThan(ev, 0.2, "motlyst motiv skal løftes")
    }

    // MARK: - Linearisering + påføring

    func testLinearizeKnownValues() {
        XCTAssertEqual(AdaptiveExposure.linearize(0), 0, accuracy: 1e-6)
        XCTAssertEqual(AdaptiveExposure.linearize(1), 1, accuracy: 1e-6)
        XCTAssertEqual(AdaptiveExposure.linearize(0.5), 0.214, accuracy: 0.005)
    }

    func testApplyPositiveEVBrightens() {
        let cg = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32)).image { ctx in
            UIColor(white: 0.3, alpha: 1).setFill(); ctx.fill(CGRect(x: 0, y: 0, width: 32, height: 32))
        }.cgImage!
        let before = meanLuma(CIImage(cgImage: cg))
        let after = meanLuma(AdaptiveExposure.apply(CIImage(cgImage: cg), ev: 1.0))
        XCTAssertGreaterThan(after, before + 0.1, "+1 EV skal lysne tydelig")
    }

    func testApplyZeroEVIsNoOp() {
        let ci = CIImage(cgImage: UIGraphicsImageRenderer(size: CGSize(width: 16, height: 16)).image { c in
            UIColor(white: 0.4, alpha: 1).setFill(); c.fill(CGRect(x: 0, y: 0, width: 16, height: 16))
        }.cgImage!)
        XCTAssertEqual(meanLuma(AdaptiveExposure.apply(ci, ev: 0)), meanLuma(ci), accuracy: 0.01)
    }

    private func meanLuma(_ ci: CIImage) -> Double {
        let ctx = CIContext(options: [.useSoftwareRenderer: true])
        let cg = ctx.createCGImage(ci, from: ci.extent)!
        let w = 8, h = 8
        var px = [UInt8](repeating: 0, count: w * h * 4)
        CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            .draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) {
            sum += 0.299 * Double(px[i]) + 0.587 * Double(px[i + 1]) + 0.114 * Double(px[i + 2])
        }
        return sum / Double(w * h) / 255
    }
}
