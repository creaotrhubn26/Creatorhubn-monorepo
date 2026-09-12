import XCTest
import UIKit
import CoreImage
@testable import CaptureApp

/// Fase 0 — WB-nøytralisering (illuminant-estimat + eksponerings-bevarende gains).
final class AdaptiveWhiteBalanceTests: XCTestCase {

    private func solid(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ side: Int = 32) -> CGImage {
        UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { ctx in
            UIColor(red: r, green: g, blue: b, alpha: 1).setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
        }.cgImage!
    }

    /// Snitt-RGB (0…1) av et CIImage — for å måle at nøytralisering faktisk skjer.
    private func meanRGB(_ ci: CIImage) -> (r: Double, g: Double, b: Double) {
        let ctx = CIContext(options: [.useSoftwareRenderer: true])
        let cg = ctx.createCGImage(ci, from: ci.extent)!
        let w = 8, h = 8
        var px = [UInt8](repeating: 0, count: w * h * 4)
        CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            .draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var sr = 0.0, sg = 0.0, sb = 0.0
        for i in stride(from: 0, to: px.count, by: 4) {
            sr += Double(px[i]); sg += Double(px[i + 1]); sb += Double(px[i + 2])
        }
        let n = Double(w * h) * 255
        return (sr / n, sg / n, sb / n)
    }

    // MARK: - Estimat

    func testNeutralGrayGivesIdentityGains() {
        let g = AdaptiveWhiteBalance.estimateGains(solid(0.5, 0.5, 0.5))
        XCTAssertEqual(g.r, 1, accuracy: 0.04)
        XCTAssertEqual(g.g, 1, accuracy: 0.001)
        XCTAssertEqual(g.b, 1, accuracy: 0.04)
    }

    func testWarmCastGainsCoolItDown() {
        // Varm grå (R>G>B) → gain_r<1, gain_b>1 (trekker mot nøytral), grønn = 1.
        // (Gains er i LINEÆRT lys, så eksakt verdi ≠ sRGB-forholdet — vi sjekker
        // retning; `testApplyNeutralizesWarmImage` verifiserer at det faktisk nøytraliserer.)
        let g = AdaptiveWhiteBalance.estimateGains(solid(0.6, 0.5, 0.4))
        XCTAssertLessThan(g.r, 1.0)
        XCTAssertGreaterThan(g.b, 1.0)
        XCTAssertEqual(g.g, 1, accuracy: 0.001)
    }

    func testCoolCastGainsWarmItUp() {
        let g = AdaptiveWhiteBalance.estimateGains(solid(0.4, 0.5, 0.6))
        XCTAssertGreaterThan(g.r, 1.0)
        XCTAssertLessThan(g.b, 1.0)
    }

    func testGainsAreClampedOnDegenerateInput() {
        // Nær-monokrom blå → uten klemming ville r-gain eksplodert.
        let g = AdaptiveWhiteBalance.estimateGains(solid(0.02, 0.05, 0.9), clampRatio: 3)
        XCTAssertLessThanOrEqual(g.r, 3.0)
        XCTAssertGreaterThanOrEqual(g.b, 1.0 / 3.0)
    }

    // MARK: - Påføring nøytraliserer faktisk

    func testApplyNeutralizesWarmImage() {
        let cg = solid(0.6, 0.5, 0.4, 64)
        let gains = AdaptiveWhiteBalance.estimateGains(cg)
        let before = meanRGB(CIImage(cgImage: cg))
        let after = meanRGB(AdaptiveWhiteBalance.apply(CIImage(cgImage: cg), gains: gains))
        // Før: tydelig varmt spenn (r−b stort). Etter: kanalene skal være ~like.
        XCTAssertGreaterThan(before.r - before.b, 0.12, "input skal være tydelig varmt")
        XCTAssertLessThan(abs(after.r - after.b), 0.04, "etter WB skal r≈b (nøytralt)")
        XCTAssertLessThan(abs(after.r - after.g), 0.04)
    }

    func testApplyIdentityIsNoOp() {
        let ci = CIImage(cgImage: solid(0.5, 0.3, 0.7))
        let out = AdaptiveWhiteBalance.apply(ci, gains: .identity)
        let a = meanRGB(ci), b = meanRGB(out)
        XCTAssertEqual(a.r, b.r, accuracy: 0.01)
        XCTAssertEqual(a.g, b.g, accuracy: 0.01)
        XCTAssertEqual(a.b, b.b, accuracy: 0.01)
    }

    // MARK: - Ansikts-forankring

    func testFaceAnchorBlendsTowardFaceGains() {
        let global = AdaptiveWhiteBalance.Gains(r: 0.8, g: 1, b: 1.2)
        let face = AdaptiveWhiteBalance.Gains(r: 1.2, g: 1, b: 0.8)
        let mixed = AdaptiveWhiteBalance.anchoredToFace(global: global, faceGains: face, weight: 0.5)
        XCTAssertEqual(mixed.r, 1.0, accuracy: 1e-9)   // 0.8·0.5 + 1.2·0.5
        XCTAssertEqual(mixed.b, 1.0, accuracy: 1e-9)
    }

    func testFaceAnchorNilKeepsGlobal() {
        let global = AdaptiveWhiteBalance.Gains(r: 0.8, g: 1, b: 1.2)
        XCTAssertEqual(AdaptiveWhiteBalance.anchoredToFace(global: global, faceGains: nil), global)
    }
}
