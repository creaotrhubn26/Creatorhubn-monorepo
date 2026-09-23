import XCTest
@testable import CaptureApp

/// Fase 1 — guided filter (kant-bevarende maske-fjæring).
final class GuidedFilterTests: XCTestCase {

    /// Bygg et vertikalt STEG: venstre `w/2` kolonner = `lo`, høyre = `hi`.
    private func step(w: Int, h: Int, lo: Float, hi: Float) -> [Float] {
        var a = [Float](repeating: 0, count: w * h)
        for y in 0..<h { for x in 0..<w { a[y * w + x] = x < w / 2 ? lo : hi } }
        return a
    }

    // MARK: - Box-filter

    func testBoxFilterWindowMeans() {
        // 4×1: [0,0,1,1], radius 1 → kant-klemte vindus-middel.
        let out = GuidedFilter.boxFilter([0, 0, 1, 1], width: 4, height: 1, radius: 1)
        XCTAssertEqual(out[0], 0.0, accuracy: 1e-5)          // mean(0,0)
        XCTAssertEqual(out[1], 1.0 / 3, accuracy: 1e-5)      // mean(0,0,1)
        XCTAssertEqual(out[2], 2.0 / 3, accuracy: 1e-5)      // mean(0,1,1)
        XCTAssertEqual(out[3], 1.0, accuracy: 1e-5)          // mean(1,1)
    }

    func testBoxFilterConstantIsUnchanged() {
        let c = [Float](repeating: 0.42, count: 25)
        let out = GuidedFilter.boxFilter(c, width: 5, height: 5, radius: 2)
        for v in out { XCTAssertEqual(v, 0.42, accuracy: 1e-5) }
    }

    // MARK: - Guided filter-egenskaper

    func testConstantGuideDoubleSmoothsInput() {
        // Flat guide → a=0, b=meanP → q = box(b) = box(box(p)) (dobbelt box-glatting;
        // ingen guide-struktur når guiden er konstant).
        let w = 8, h = 8
        let guide = [Float](repeating: 0.5, count: w * h)
        let p = step(w: w, h: h, lo: 0, hi: 1)
        let q = GuidedFilter.filter(guide: guide, input: p, width: w, height: h, radius: 2, epsilon: 1e-4)
        let box1 = GuidedFilter.boxFilter(p, width: w, height: h, radius: 2)
        let box2 = GuidedFilter.boxFilter(box1, width: w, height: h, radius: 2)
        for i in 0..<(w * h) { XCTAssertEqual(q[i], box2[i], accuracy: 1e-4) }
    }

    func testEdgePreservedWithSmallEpsilon() {
        // guide = input = rent steg (0.2|0.8). Liten ε → steget BEVARES skarpt
        // (q ≈ guide), i motsetning til en box-blur.
        let w = 16, h = 16
        let s = step(w: w, h: h, lo: 0.2, hi: 0.8)
        let q = GuidedFilter.filter(guide: s, input: s, width: w, height: h, radius: 3, epsilon: 1e-4)
        let leftBoundary = q[8 * w + 7]   // siste venstre-kolonne
        let rightBoundary = q[8 * w + 8]  // første høyre-kolonne
        XCTAssertEqual(leftBoundary, 0.2, accuracy: 0.03)
        XCTAssertEqual(rightBoundary, 0.8, accuracy: 0.03)
        XCTAssertGreaterThan(rightBoundary - leftBoundary, 0.5, "steget skal holde seg skarpt")
    }

    func testLargeEpsilonSmearsLikeBoxBlur() {
        // Stor ε → a≈0 → q ≈ box(p): steget SMØRES ut ved grensa.
        let w = 16, h = 16
        let s = step(w: w, h: h, lo: 0.2, hi: 0.8)
        let q = GuidedFilter.filter(guide: s, input: s, width: w, height: h, radius: 3, epsilon: 1000)
        let stepMag = q[8 * w + 8] - q[8 * w + 7]
        XCTAssertLessThan(stepMag, 0.2, "stor ε skal smøre kanten (som box-blur)")
    }

    func testGuidedBeatsBoxAtEdge() {
        // Direkte: guided bevarer steget MYE bedre enn ren box-blur ved grensa.
        let w = 16, h = 16
        let s = step(w: w, h: h, lo: 0.2, hi: 0.8)
        let guided = GuidedFilter.filter(guide: s, input: s, width: w, height: h, radius: 3, epsilon: 1e-4)
        let box = GuidedFilter.boxFilter(s, width: w, height: h, radius: 3)
        let guidedMag = guided[8 * w + 8] - guided[8 * w + 7]
        let boxMag = box[8 * w + 8] - box[8 * w + 7]
        XCTAssertGreaterThan(guidedMag, boxMag + 0.3)
    }

    // MARK: - Vern

    func testDegenerateInputsReturnInput() {
        XCTAssertEqual(GuidedFilter.filter(guide: [], input: [], width: 0, height: 0, radius: 1, epsilon: 1e-4), [])
        let p: [Float] = [1, 2, 3]
        // Feil størrelse → returner input uendret (feiler grasiøst).
        XCTAssertEqual(GuidedFilter.filter(guide: [0, 0], input: p, width: 3, height: 1, radius: 1, epsilon: 1e-4), p)
    }
}
