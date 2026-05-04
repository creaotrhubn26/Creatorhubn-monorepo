import XCTest
@testable import CaptureApp

/// Phase 8B — BurstGrouper + BurstPicker contract tests. Pure-
/// function logic so we can lock the grouping/picking contract
/// without Vision dependencies.
final class BurstGrouperTests: XCTestCase {

    private func epoch(_ s: TimeInterval) -> Date {
        Date(timeIntervalSince1970: s)
    }

    func testEmptyInputReturnsEmptyOutput() {
        XCTAssertEqual(BurstGrouper.group([]), [])
    }

    func testSingleShotIsNotABurst() {
        let id = UUID()
        let result = BurstGrouper.group([(id: id, captureTime: epoch(0))])
        XCTAssertEqual(result.count, 1)
        XCTAssertNil(result[0].burstGroupId)
    }

    func testTwoShotsAreNotABurstByDefault() {
        // 2 = pair, intentional double-tap. We require ≥3 shots.
        let a = UUID(), b = UUID()
        let result = BurstGrouper.group([
            (id: a, captureTime: epoch(0)),
            (id: b, captureTime: epoch(0.5)),
        ])
        XCTAssertNil(result[0].burstGroupId)
        XCTAssertNil(result[1].burstGroupId)
    }

    func testThreeShotsWithinGapBecomeOneBurst() {
        let a = UUID(), b = UUID(), c = UUID()
        let result = BurstGrouper.group([
            (id: a, captureTime: epoch(0.0)),
            (id: b, captureTime: epoch(0.2)),  // 200 ms gap = ~5 fps
            (id: c, captureTime: epoch(0.4)),
        ])
        let ids = result.compactMap { $0.burstGroupId }
        XCTAssertEqual(Set(ids).count, 1, "all three should share one burstId")
        XCTAssertEqual(ids.count, 3, "every shot in the cluster gets the id")
    }

    func testGapLargerThanThresholdSplitsIntoTwoClusters() {
        // Two bursts of 3 separated by 5 s (> default 3 s gap)
        let ids = (0..<6).map { _ in UUID() }
        let times: [Double] = [0.0, 0.2, 0.4, 5.4, 5.6, 5.8]
        let result = BurstGrouper.group(zip(ids, times).map {
            (id: $0.0, captureTime: epoch($0.1))
        })
        let burstIds = result.compactMap { $0.burstGroupId }
        XCTAssertEqual(burstIds.count, 6)
        let unique = Set(burstIds)
        XCTAssertEqual(unique.count, 2, "should split into exactly 2 bursts")
    }

    func testSubBurstPairAtClusterEndDoesNotPullPreviousIntoNonBurst() {
        // 4 shots, gap pattern: 0.2 / 0.2 / 5.0 — first cluster of 3 = burst,
        // last single = non-burst. Verify we don't lose the burst on the trailing single.
        let ids = (0..<4).map { _ in UUID() }
        let times: [Double] = [0.0, 0.2, 0.4, 5.4]
        let result = BurstGrouper.group(zip(ids, times).map {
            (id: $0.0, captureTime: epoch($0.1))
        })
        // First three should have a burstId, last should be nil
        XCTAssertNotNil(result[0].burstGroupId)
        XCTAssertNotNil(result[1].burstGroupId)
        XCTAssertNotNil(result[2].burstGroupId)
        XCTAssertNil(result[3].burstGroupId)
    }

    func testInputOrderIsPreservedInOutput() {
        // Input scrambled, output should match input order even though
        // the grouper sorts internally by captureTime.
        let a = UUID(), b = UUID(), c = UUID()
        let result = BurstGrouper.group([
            (id: c, captureTime: epoch(0.4)),
            (id: a, captureTime: epoch(0.0)),
            (id: b, captureTime: epoch(0.2)),
        ])
        XCTAssertEqual(result.map(\.assetId), [c, a, b])
    }

    func testCustomGapAndMinShotsAreHonoured() {
        // Override defaults: 1 s gap, min 2 shots → 2 close shots = burst
        let a = UUID(), b = UUID()
        let result = BurstGrouper.group(
            [
                (id: a, captureTime: epoch(0.0)),
                (id: b, captureTime: epoch(0.5)),
            ],
            gap: 1.0,
            minShots: 2,
        )
        XCTAssertNotNil(result[0].burstGroupId)
        XCTAssertNotNil(result[1].burstGroupId)
        XCTAssertEqual(result[0].burstGroupId, result[1].burstGroupId)
    }
}

final class BurstPickerTests: XCTestCase {

    private func epoch(_ s: TimeInterval) -> Date {
        Date(timeIntervalSince1970: s)
    }

    func testEmptyInputReturnsEmptySet() {
        XCTAssertEqual(BurstPicker.topPicks(from: []), [])
    }

    func testZeroCountReturnsEmptySet() {
        let id = UUID()
        let scored: [BurstPicker.Scored] = [
            .init(assetId: id, captureTime: epoch(0), score: 0.9),
        ]
        XCTAssertEqual(BurstPicker.topPicks(from: scored, count: 0), [])
    }

    func testHighestScoreWins() {
        let low = UUID(), high = UUID()
        let scored: [BurstPicker.Scored] = [
            .init(assetId: low, captureTime: epoch(0), score: 0.3),
            .init(assetId: high, captureTime: epoch(1), score: 0.9),
        ]
        let picks = BurstPicker.topPicks(from: scored, count: 1)
        XCTAssertEqual(picks, [high])
    }

    func testTiesBreakByEarlierCaptureTime() {
        let earlier = UUID(), later = UUID()
        let scored: [BurstPicker.Scored] = [
            .init(assetId: later, captureTime: epoch(1), score: 0.5),
            .init(assetId: earlier, captureTime: epoch(0), score: 0.5),
        ]
        let picks = BurstPicker.topPicks(from: scored, count: 1)
        XCTAssertEqual(picks, [earlier],
                       "first-attempt wins on tied score")
    }

    func testNilScoresSortToBottom() {
        let scored = UUID(), unscored = UUID()
        let scoredFrames: [BurstPicker.Scored] = [
            .init(assetId: unscored, captureTime: epoch(0), score: nil),
            .init(assetId: scored, captureTime: epoch(1), score: 0.4),
        ]
        let picks = BurstPicker.topPicks(from: scoredFrames, count: 1)
        XCTAssertEqual(picks, [scored])
    }

    func testTopThreeByDefault() {
        let ids = (0..<5).map { _ in UUID() }
        let scoredFrames = zip(ids, [0.1, 0.9, 0.5, 0.3, 0.7]).map { id, s in
            BurstPicker.Scored(assetId: id, captureTime: epoch(0), score: s)
        }
        let picks = BurstPicker.topPicks(from: scoredFrames)
        // Top 3 scores: 0.9, 0.7, 0.5 → ids[1], ids[4], ids[2]
        XCTAssertEqual(picks, Set([ids[1], ids[4], ids[2]]))
    }

    func testCountLargerThanInputReturnsAllAvailable() {
        let a = UUID(), b = UUID()
        let scored: [BurstPicker.Scored] = [
            .init(assetId: a, captureTime: epoch(0), score: 0.5),
            .init(assetId: b, captureTime: epoch(1), score: 0.6),
        ]
        let picks = BurstPicker.topPicks(from: scored, count: 10)
        XCTAssertEqual(picks, Set([a, b]))
    }
}
