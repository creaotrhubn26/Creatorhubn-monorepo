import XCTest
import UIKit
@testable import CaptureApp

/// dHash + Hamming-avstand for nesten-duplikat-culling i filmstripen.
final class PerceptualHashTests: XCTestCase {

    // MARK: - Hamming

    func testHammingDistanceOfIdenticalIsZero() {
        XCTAssertEqual(PerceptualHash.hammingDistance(0xDEAD_BEEF, 0xDEAD_BEEF), 0)
    }

    func testHammingDistanceCountsDifferingBits() {
        // 0b1010 vs 0b0101 → alle 4 lave bit ulike.
        XCTAssertEqual(PerceptualHash.hammingDistance(0b1010, 0b0101), 4)
        XCTAssertEqual(PerceptualHash.hammingDistance(0, UInt64.max), 64)
        XCTAssertEqual(PerceptualHash.hammingDistance(0b1, 0b0), 1)
    }

    func testIsDuplicateHonoursThreshold() {
        // Nøyaktig terskel-mange bit ulike → fortsatt duplikat (≤).
        let a: UInt64 = 0
        let b: UInt64 = (1 << PerceptualHash.duplicateThreshold) - 1   // terskel bit satt
        XCTAssertEqual(PerceptualHash.hammingDistance(a, b), PerceptualHash.duplicateThreshold)
        XCTAssertTrue(PerceptualHash.isDuplicate(a, b))
        // Ett bit over terskel → ikke lenger duplikat.
        let c: UInt64 = (1 << (PerceptualHash.duplicateThreshold + 1)) - 1
        XCTAssertEqual(PerceptualHash.hammingDistance(a, c), PerceptualHash.duplicateThreshold + 1)
        XCTAssertFalse(PerceptualHash.isDuplicate(a, c))
    }

    // MARK: - dHash på ekte bilder

    /// Horisontal gråtone-rampe. `reversed=false` = mørk→lys venstre→høyre (hver
    /// piksel MØRKERE enn nabo til høyre → dHash alle bit 0). `reversed=true` =
    /// lys→mørk (hver piksel LYSERE enn høyre nabo → alle bit 1). Gir to bilder
    /// med maksimal Hamming-avstand — en robust «tydelig forskjellig»-referanse.
    private func gradient(reversed: Bool, side: Int = 128) -> CGImage {
        UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { ctx in
            for x in 0..<side {
                let t = CGFloat(x) / CGFloat(side - 1)
                let g = reversed ? 1 - t : t
                UIColor(white: g, alpha: 1).setFill()
                ctx.fill(CGRect(x: x, y: 0, width: 1, height: side))
            }
        }.cgImage!
    }

    func testDHashIsDeterministic() {
        let img = gradient(reversed: true)
        XCTAssertEqual(PerceptualHash.dHash(img), PerceptualHash.dHash(img))
    }

    func testIdenticalImagesAreDuplicates() {
        let a = PerceptualHash.dHash(gradient(reversed: true))
        let b = PerceptualHash.dHash(gradient(reversed: true))
        XCTAssertTrue(PerceptualHash.isDuplicate(a, b))
    }

    func testSlightScaleChangeStaysDuplicate() {
        // Samme motiv i to oppløsninger → dHash er robust (nesten-duplikat).
        let a = PerceptualHash.dHash(gradient(reversed: true, side: 128))
        let b = PerceptualHash.dHash(gradient(reversed: true, side: 200))
        XCTAssertTrue(PerceptualHash.isDuplicate(a, b),
                      "samme motiv i ulik skala skal være nesten-duplikat")
    }

    func testDifferentImagesAreNotDuplicates() {
        // Motsatt-rettede ramper → maksimalt ulike hasher (Hamming ~64).
        let ltr = PerceptualHash.dHash(gradient(reversed: false))
        let rtl = PerceptualHash.dHash(gradient(reversed: true))
        XCTAssertFalse(PerceptualHash.isDuplicate(ltr, rtl),
                       "motsatte lys-ramper skal ikke være duplikater")
        XCTAssertGreaterThan(PerceptualHash.hammingDistance(ltr, rtl), 40)
    }
}
