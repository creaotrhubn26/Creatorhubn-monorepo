import XCTest
@testable import CaptureApp

/// Tests for ``ChunkPlanner``. The planner is the math layer of the
/// RAW upload pipeline — an off-by-one error here would silently
/// corrupt every file > 1 chunk, so every edge case gets a case.
final class ChunkPlannerTests: XCTestCase {

    // MARK: - plan

    func testPlansExactMultiplesIntoEqualChunks() {
        let plan = ChunkPlanner.plan(totalBytes: 30, chunkSize: 10)
        XCTAssertEqual(plan.count, 3)
        XCTAssertEqual(plan[0], .init(startByte: 0, length: 10))
        XCTAssertEqual(plan[1], .init(startByte: 10, length: 10))
        XCTAssertEqual(plan[2], .init(startByte: 20, length: 10))
    }

    func testLastChunkShrinksToRemainder() {
        let plan = ChunkPlanner.plan(totalBytes: 25, chunkSize: 10)
        XCTAssertEqual(plan.count, 3)
        XCTAssertEqual(plan.last, .init(startByte: 20, length: 5),
            "final chunk covers only the remainder, not full chunkSize")
    }

    func testSingleChunkWhenSmallerThanChunkSize() {
        let plan = ChunkPlanner.plan(totalBytes: 3, chunkSize: 100)
        XCTAssertEqual(plan.count, 1)
        XCTAssertEqual(plan[0], .init(startByte: 0, length: 3))
    }

    func testZeroBytesYieldsEmptyPlan() {
        XCTAssertTrue(ChunkPlanner.plan(totalBytes: 0, chunkSize: 100).isEmpty)
    }

    func testZeroChunkSizeYieldsEmptyPlan() {
        XCTAssertTrue(ChunkPlanner.plan(totalBytes: 100, chunkSize: 0).isEmpty)
    }

    func testChunksAreContiguousAndNonOverlapping() {
        let total: Int64 = 1_234_567
        let plan = ChunkPlanner.plan(totalBytes: total, chunkSize: 10_000)
        // Each chunk starts where the previous ends.
        for i in 1..<plan.count {
            XCTAssertEqual(
                plan[i].startByte,
                plan[i - 1].startByte + plan[i - 1].length,
                "chunk \(i) start must equal chunk \(i-1) end",
            )
        }
        // Total coverage equals totalBytes.
        let sum = plan.map { $0.length }.reduce(0, +)
        XCTAssertEqual(sum, total)
    }

    func testEndByteInclusiveMatchesContentRangeExpectation() {
        let plan = ChunkPlanner.plan(totalBytes: 30, chunkSize: 10)
        XCTAssertEqual(plan[0].endByteInclusive, 9,
            "0..<10 → inclusive end is 9 — matches the Drive Content-Range contract")
        XCTAssertEqual(plan[2].endByteInclusive, 29)
    }

    // MARK: - planResume

    func testResumeFromZeroMatchesPlainPlan() {
        let planned = ChunkPlanner.plan(totalBytes: 30, chunkSize: 10)
        let resumed = ChunkPlanner.planResume(totalBytes: 30, startingAtByte: 0, chunkSize: 10)
        XCTAssertEqual(planned, resumed)
    }

    func testResumeFromChunkBoundarySkipsPriorChunks() {
        let resumed = ChunkPlanner.planResume(totalBytes: 30, startingAtByte: 20, chunkSize: 10)
        XCTAssertEqual(resumed.count, 1)
        XCTAssertEqual(resumed[0], .init(startByte: 20, length: 10))
    }

    func testResumeMidChunkStartsAtExactByte() {
        // Drive confirmed 15 bytes. The next chunk must start at 15
        // regardless of the original chunk-grid alignment — re-sending
        // bytes Drive already has would corrupt the upload.
        let resumed = ChunkPlanner.planResume(totalBytes: 30, startingAtByte: 15, chunkSize: 10)
        XCTAssertEqual(resumed[0].startByte, 15)
        XCTAssertEqual(resumed[0].length, 10)
        XCTAssertEqual(resumed[1].startByte, 25)
        XCTAssertEqual(resumed[1].length, 5)
    }

    func testResumePastEndYieldsEmptyPlan() {
        // Drive already has every byte — nothing left to do.
        XCTAssertTrue(
            ChunkPlanner.planResume(totalBytes: 30, startingAtByte: 30, chunkSize: 10).isEmpty,
        )
        XCTAssertTrue(
            ChunkPlanner.planResume(totalBytes: 30, startingAtByte: 99, chunkSize: 10).isEmpty,
        )
    }

    func testResumeFromNegativeTreatedAsZero() {
        // Defensive: a corrupt persisted offset must not cause a
        // reverse-seek bug.
        let resumed = ChunkPlanner.planResume(totalBytes: 30, startingAtByte: -5, chunkSize: 10)
        XCTAssertEqual(resumed.first?.startByte, 0)
    }

    // MARK: - totalChunkCount

    func testTotalChunkCountRoundsUp() {
        XCTAssertEqual(ChunkPlanner.totalChunkCount(totalBytes: 30, chunkSize: 10), 3)
        XCTAssertEqual(ChunkPlanner.totalChunkCount(totalBytes: 31, chunkSize: 10), 4,
            "one over a boundary still counts as a new chunk")
        XCTAssertEqual(ChunkPlanner.totalChunkCount(totalBytes: 1, chunkSize: 10), 1)
        XCTAssertEqual(ChunkPlanner.totalChunkCount(totalBytes: 0, chunkSize: 10), 0)
    }

    // MARK: - Retry policy

    func testRetryOnNetworkError() {
        XCTAssertTrue(RawUploadCoordinator.shouldRetry(
            error: .network("lost connection"),
        ))
    }

    func testRetryOn5xx() {
        XCTAssertTrue(RawUploadCoordinator.shouldRetry(
            error: .httpStatus(500, message: "internal"),
        ))
        XCTAssertTrue(RawUploadCoordinator.shouldRetry(
            error: .httpStatus(503, message: "unavailable"),
        ))
    }

    func testRetryOn408And429() {
        XCTAssertTrue(RawUploadCoordinator.shouldRetry(
            error: .httpStatus(408, message: "timeout"),
        ))
        XCTAssertTrue(RawUploadCoordinator.shouldRetry(
            error: .httpStatus(429, message: "rate limited"),
        ))
    }

    func testDoNotRetryOnPermanent4xx() {
        // 403 (insufficient scope), 404 (missing parent), 400 (bad
        // request) — retrying these just wastes time + quota.
        XCTAssertFalse(RawUploadCoordinator.shouldRetry(
            error: .httpStatus(400, message: "bad request"),
        ))
        XCTAssertFalse(RawUploadCoordinator.shouldRetry(
            error: .httpStatus(403, message: "forbidden"),
        ))
        XCTAssertFalse(RawUploadCoordinator.shouldRetry(
            error: .httpStatus(404, message: "not found"),
        ))
    }

    func testRetryOnUnauthorizedToTriggerTokenRefresh() {
        // 401 gets retried because the adapter's next
        // ``activeCredentials()`` call will refresh the token.
        XCTAssertTrue(RawUploadCoordinator.shouldRetry(
            error: .unauthorized(nil),
        ))
    }

    func testDoNotRetryOnMalformedDriveResponse() {
        // Drive sent garbage — retrying likely gets the same garbage.
        XCTAssertFalse(RawUploadCoordinator.shouldRetry(
            error: .malformedResponse,
        ))
        XCTAssertFalse(RawUploadCoordinator.shouldRetry(
            error: .missingSessionURL,
        ))
    }
}
