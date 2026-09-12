import XCTest
@testable import CaptureApp

/// P3 (E3) — «bilder igjen»-estimatet kalibrerer seg selv fra fallet i ledig
/// kort-plass per nytt bilde. Ren logikk.
final class ShotsRemainingEstimatorTests: XCTestCase {

    func testUncalibratedReturnsNil() {
        var est = ShotsRemainingEstimator()
        // Første snapshot gir ingen delta → ikke kalibrert.
        est.update(freeSpaceBytes: 100_000_000, totalContentsCount: 10)
        XCTAssertNil(est.bytesPerShot)
        XCTAssertNil(est.estimate(freeSpaceBytes: 100_000_000))
    }

    func testCalibratesFromFreeSpaceDrop() {
        var est = ShotsRemainingEstimator()
        est.update(freeSpaceBytes: 100_000_000, totalContentsCount: 10)
        // 2 nye bilder brukte 50 MB → 25 MB/skudd.
        est.update(freeSpaceBytes: 50_000_000, totalContentsCount: 12)
        XCTAssertEqual(est.bytesPerShot ?? 0, 25_000_000, accuracy: 1)
        // 50 MB igjen / 25 MB per skudd = 2 bilder.
        XCTAssertEqual(est.estimate(freeSpaceBytes: 50_000_000), 2)
    }

    func testEmaSmoothsAcrossShots() {
        var est = ShotsRemainingEstimator()
        est.update(freeSpaceBytes: 100_000_000, totalContentsCount: 0)
        est.update(freeSpaceBytes: 80_000_000, totalContentsCount: 1)   // 20 MB/skudd
        let first = est.bytesPerShot ?? 0
        XCTAssertEqual(first, 20_000_000, accuracy: 1)
        est.update(freeSpaceBytes: 40_000_000, totalContentsCount: 2)   // 40 MB/skudd
        // EMA: 0.7*20 + 0.3*40 = 26 MB.
        XCTAssertEqual(est.bytesPerShot ?? 0, 26_000_000, accuracy: 1)
    }

    func testIgnoresSnapshotsWithoutNewContent() {
        var est = ShotsRemainingEstimator()
        est.update(freeSpaceBytes: 100_000_000, totalContentsCount: 5)
        // Ledig plass falt, men count UENDRET (f.eks. kort-refetch) → ignorer.
        est.update(freeSpaceBytes: 90_000_000, totalContentsCount: 5)
        XCTAssertNil(est.bytesPerShot, "skal ikke kalibrere uten nytt bilde")
    }

    func testIgnoresNilTelemetry() {
        var est = ShotsRemainingEstimator()
        est.update(freeSpaceBytes: nil, totalContentsCount: nil)
        est.update(freeSpaceBytes: 100_000_000, totalContentsCount: nil)
        XCTAssertNil(est.bytesPerShot)
    }
}
