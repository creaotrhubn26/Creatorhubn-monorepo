import XCTest
@testable import CaptureApp

/// Pure tests for the realtime reconnect-backoff table. Mirrors the
/// ``OutboxWorker`` ladder so flaky-network behaviour is predictable
/// across both sync channels:
///   1st failure → 1s
///   2nd → 2s
///   3rd → 5s
///   4th → 15s
///   5th+ → 60s (clamped)
///
/// The table is tiny by design — more sophisticated schemes (token
/// bucket, jittered exponential) add state the iPad doesn't need.
/// Locking it in a test also means a refactor can't accidentally
/// reshape the curve into something that hammers the server.
final class RealtimeBackoffTests: XCTestCase {

    func testFirstFailureIsOneSecond() {
        XCTAssertEqual(RealtimeBackoff.delay(forFailures: 1), 1)
    }

    func testSecondFailureIsTwoSeconds() {
        XCTAssertEqual(RealtimeBackoff.delay(forFailures: 2), 2)
    }

    func testThirdFailureIsFiveSeconds() {
        XCTAssertEqual(RealtimeBackoff.delay(forFailures: 3), 5)
    }

    func testFourthFailureIsFifteenSeconds() {
        XCTAssertEqual(RealtimeBackoff.delay(forFailures: 4), 15)
    }

    func testFifthFailureIsSixtySeconds() {
        XCTAssertEqual(RealtimeBackoff.delay(forFailures: 5), 60)
    }

    func testClampsAtSixtySecondsForLargeFailureCounts() {
        XCTAssertEqual(RealtimeBackoff.delay(forFailures: 10), 60)
        XCTAssertEqual(RealtimeBackoff.delay(forFailures: 1_000), 60,
            "extreme failure counts must clamp so the iPad doesn't wait an hour between retries")
    }

    func testZeroAndNegativeFailuresTreatedAsFirstFailure() {
        // Defensive: a caller that hits handleReceiveFailure before
        // failureCount was incremented shouldn't get a zero-delay
        // reconnect storm.
        XCTAssertEqual(RealtimeBackoff.delay(forFailures: 0), 1)
        XCTAssertEqual(RealtimeBackoff.delay(forFailures: -3), 1)
    }

    func testCurveIsStrictlyMonotonicUpToSteady() {
        // Each tier should be ≥ the previous so repeated failures
        // back off, never get more aggressive.
        let seq = [1, 2, 3, 4, 5].map { RealtimeBackoff.delay(forFailures: $0) }
        for i in 1..<seq.count {
            XCTAssertGreaterThanOrEqual(seq[i], seq[i - 1],
                "backoff[\(i)] = \(seq[i]) must not be less than backoff[\(i - 1)] = \(seq[i - 1])")
        }
    }
}
