import XCTest
import UIKit
import CoreImage
@testable import CaptureApp

final class LearnedStyleTests: XCTestCase {

    private func makeCG(_ gray: CGFloat, _ side: Int = 32) -> CGImage {
        UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { ctx in
            UIColor(white: gray, alpha: 1).setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
        }.cgImage!
    }

    /// LUT som SNUR (256−x) → påføring skal invertere → målbar pikselendring.
    private func invertLut() -> [[Int]] {
        let curve = (0..<256).map { 255 - $0 }
        return [curve, curve, curve]
    }
    private func identityLut() -> [[Int]] {
        let curve = Array(0..<256)
        return [curve, curve, curve]
    }

    private func scene(feat: [Double], lut: [[Int]], ab: [Double] = [0, 0]) -> LearnedStyleProfile.Scene {
        .init(feat: feat, lut: lut, ab: ab, labStd: [1, 1, 1], weight: 1)
    }

    // MARK: - Codable

    func testProfileDecodesFromJSON() throws {
        let json = """
        {"version":1,"scenes":[{"feat":[0,0,0,0,0,0,0,0,0.5,0.2,0.1,0.1],
        "lut":[[0,1],[0,1],[0,1]],"ab":[1.5,-0.5],"labStd":[1,1,1],"weight":3}]}
        """
        let p = try JSONDecoder().decode(LearnedStyleProfile.self, from: Data(json.utf8))
        XCTAssertEqual(p.version, 1)
        XCTAssertEqual(p.allStyles.count, 1, "v1 → én «Min stil»")
        XCTAssertEqual(p.allStyles[0].scenes.count, 1)
        XCTAssertEqual(p.allStyles[0].scenes[0].ab, [1.5, -0.5])
        XCTAssertEqual(p.allStyles[0].scenes[0].weight, 3)
    }

    func testMultiStyleV2Decodes() throws {
        let json = """
        {"version":2,"styles":[
          {"name":"Varm & ren","scenes":[{"feat":[0,0,0,0,0,0,0,0,0.5,0.2,0.3,0.1],"lut":[[0,1],[0,1],[0,1]],"ab":[3,0],"labStd":[1,1,1],"weight":9}]},
          {"name":"Kjølig & ren","scenes":[{"feat":[0,0,0,0,0,0,0,0,0.5,0.2,-0.3,0.1],"lut":[[0,1],[0,1],[0,1]],"ab":[-3,0],"labStd":[1,1,1],"weight":4}]}
        ]}
        """
        let p = try JSONDecoder().decode(LearnedStyleProfile.self, from: Data(json.utf8))
        XCTAssertEqual(p.version, 2)
        XCTAssertEqual(p.allStyles.map(\.name), ["Varm & ren", "Kjølig & ren"])
    }

    // MARK: - Features

    func testFeaturesAre12DimAndDeterministic() {
        let cg = makeCG(0.5)
        let f1 = LearnedStyle.features(of: cg)
        let f2 = LearnedStyle.features(of: cg)
        XCTAssertEqual(f1.count, 12)
        XCTAssertEqual(f1, f2, "features skal være deterministiske")
        // Midtgrå → luma-snitt ~0.5 (feature-indeks 8 = L/255, OpenCV L≈middels).
        XCTAssertGreaterThan(f1[8], 0.3)
        XCTAssertLessThan(f1[8], 0.7)
    }

    func testBrighterImageHasHigherLumaFeature() {
        let dark = LearnedStyle.features(of: makeCG(0.2))
        let bright = LearnedStyle.features(of: makeCG(0.8))
        XCTAssertGreaterThan(bright[8], dark[8])
    }

    // MARK: - k-NN blend

    func testBlendPicksNearestSceneByFeatures() {
        let near = scene(feat: [Double](repeating: 0, count: 8) + [0.8, 0.2, 0.1, 0.1], lut: invertLut())
        let far = scene(feat: [Double](repeating: 0, count: 8) + [0.1, 0.2, 0.1, 0.1], lut: identityLut())
        let f = [Double](repeating: 0, count: 8) + [0.8, 0.2, 0.1, 0.1]  // = near
        let blended = LearnedStyle.blend(features: f, scenes: [near, far], k: 1)
        XCTAssertNotNil(blended)
        // k=1 → nærmeste (invert-LUT): lut[0][255] skal være ~0 (invertert).
        XCTAssertLessThan(blended!.lut[0][255], 10)
        XCTAssertGreaterThan(blended!.lut[0][0], 245)
    }

    func testBlendReturnsLabStd() {
        let s = scene(feat: [Double](repeating: 0.1, count: 12), lut: identityLut())
        let b = LearnedStyle.blend(features: [Double](repeating: 0.1, count: 12), scenes: [s], k: 1)
        XCTAssertEqual(b?.labStd.count, 3)
    }

    // MARK: - Auto-velg

    func testAutoSelectPicksClosestStyleByLight() {
        // To stiler: én matcher lyst bilde (feat[8]=0.8), én mørkt (0.2).
        let brightStyle = LearnedStyleProfile.Style(name: "Lys", scenes: [
            scene(feat: [Double](repeating: 0, count: 8) + [0.8, 0.2, 0.1, 0.1], lut: identityLut())])
        let darkStyle = LearnedStyleProfile.Style(name: "Mørk", scenes: [
            scene(feat: [Double](repeating: 0, count: 8) + [0.2, 0.2, 0.1, 0.1], lut: identityLut())])
        let fBright = [Double](repeating: 0, count: 8) + [0.78, 0.2, 0.1, 0.1]
        let idx = LearnedStyle.autoSelectStyleIndex(features: fBright, styles: [brightStyle, darkStyle])
        XCTAssertEqual(idx, 0, "auto skal velge den lyse stilen for et lyst bilde")
    }

    // MARK: - Apply

    func testApplyLutChangesPixels() throws {
        let inv = [scene(feat: [Double](repeating: 0.1, count: 12), lut: invertLut())]
        let base = CIImage(cgImage: makeCG(0.8, 64))   // lys
        let out = LearnedStyle.apply(scenes: inv, to: base, k: 1)
        // Invert-LUT på et lyst bilde → resultatet skal bli MØRKT.
        XCTAssertLessThan(meanLuma(out), 0.5, "invert-LUT gjorde ikke lyst→mørkt")
    }

    func testExposureGuardCapsOverBrightening() throws {
        // LUT som mapper ALT til nesten hvitt (~0.92) → uten vakt ville et
        // midtgrått bilde blitt utblåst. Eksponerings-vakten skal trekke tilbake.
        let brightCurve = [Int](repeating: 235, count: 256)
        let bright = [scene(feat: [Double](repeating: 0.1, count: 12),
                            lut: [brightCurve, brightCurve, brightCurve])]
        let base = CIImage(cgImage: makeCG(0.5, 64))
        let out = LearnedStyle.apply(scenes: bright, to: base, k: 1)
        // Uten vakt ~0.92; med vakt skal den holdes tydelig under utblåsning.
        XCTAssertLessThan(meanLuma(out), 0.82, "eksponerings-vakten hindret ikke overløft")
        XCTAssertGreaterThan(meanLuma(out), meanLuma(base) - 0.05, "vakten dro for mye ned")
    }

    func testEmptyProfileIsNoOp() {
        let base = CIImage(cgImage: makeCG(0.5))
        let out = LearnedStyle.apply(scenes: [], to: base, k: 5)
        XCTAssertEqual(meanLuma(out), meanLuma(base), accuracy: 0.02)
    }

    private func meanLuma(_ ci: CIImage) -> Double {
        let ctx = CIContext(options: [.useSoftwareRenderer: true])
        let cg = ctx.createCGImage(ci, from: ci.extent)!
        let w = 16, h = 16
        var px = [UInt8](repeating: 0, count: w * h * 4)
        CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            .draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) { sum += Double(px[i]) }
        return sum / Double(px.count / 4) / 255.0
    }
}
