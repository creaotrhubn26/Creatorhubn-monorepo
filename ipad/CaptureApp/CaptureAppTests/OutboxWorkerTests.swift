import XCTest
@testable import CaptureApp

/// Tests for the ``OutboxWorker`` drain loop. We use a mock sender
/// so no networking is involved; all tests run against an in-memory
/// GRDB so nothing touches the filesystem.
///
/// What we verify:
///   - One drain attempts every pending row exactly once.
///   - Success marks rows succeeded.
///   - Transient failures mark failed + stay retryable until the
///     attempt cap.
///   - Permanent failures jump to ``failed`` with attempts =
///     maxAttempts so the retry ladder is skipped.
///   - Backoff delay is respected — failed rows don't get requeued
///     before their scheduled ready-at.
///   - After maxAttempts no further drain attempts happen.
///   - Empty queue drain returns zero.
///   - Start/stop lifecycle is idempotent.
final class OutboxWorkerTests: XCTestCase {

    // MARK: - Mock sender

    /// Plays back a queued script of outcomes. Records every mutation
    /// it was asked to send so tests can assert ordering.
    actor MockSender: OutboxSender {
        private var script: [OutboxSendOutcome]
        private(set) var received: [OutboxMutation] = []

        init(script: [OutboxSendOutcome]) {
            self.script = script
        }

        func send(_ mutation: OutboxMutation) async -> OutboxSendOutcome {
            received.append(mutation)
            // If script exhausts, return transient failure so the
            // worker doesn't silently treat absent script entries as
            // success (which would let bugs slip through).
            guard !script.isEmpty else {
                return .failedTransient("no script entry")
            }
            return script.removeFirst()
        }

        func snapshot() -> [OutboxMutation] { received }
    }

    // MARK: - Helpers

    private func makeStack(
        script: [OutboxSendOutcome],
        clock: @escaping @Sendable () -> Date = { Date() },
    ) async throws -> (Outbox, MockSender, OutboxWorker) {
        let db = try AppDatabase.inMemory()
        let outbox = Outbox(database: db)
        let sender = MockSender(script: script)
        // pollInterval = 60 so background poll doesn't kick in; we
        // only exercise drainOnce explicitly.
        let worker = OutboxWorker(
            outbox: outbox,
            sender: sender,
            clock: clock,
            pollInterval: 60,
        )
        return (outbox, sender, worker)
    }

    // MARK: - Success path

    func testDrainSendsEachPendingRowOnceAndMarksSucceeded() async throws {
        let (outbox, sender, worker) = try await makeStack(
            script: [.succeeded, .succeeded, .succeeded],
        )
        let a = try await outbox.enqueue(endpoint: "/a", method: .post)
        let b = try await outbox.enqueue(endpoint: "/b", method: .post)
        let c = try await outbox.enqueue(endpoint: "/c", method: .post)

        let attempted = await worker.drainOnce()
        XCTAssertEqual(attempted, 3)

        let received = await sender.snapshot()
        XCTAssertEqual(received.count, 3)
        XCTAssertEqual(Set(received.map(\.clientMutationId)),
                       Set([a.clientMutationId, b.clientMutationId, c.clientMutationId]))

        // After drain, nothing pending left.
        let pending = try await outbox.nextPending()
        XCTAssertTrue(pending.isEmpty)
    }

    func testEmptyQueueDrainReturnsZero() async throws {
        let (_, _, worker) = try await makeStack(script: [])
        let attempted = await worker.drainOnce()
        XCTAssertEqual(attempted, 0)
    }

    // MARK: - Transient failure

    func testTransientFailureMarksFailedButStaysRetryable() async throws {
        let (outbox, _, worker) = try await makeStack(
            script: [.failedTransient("timeout")],
        )
        let row = try await outbox.enqueue(endpoint: "/a", method: .post)

        _ = await worker.drainOnce()

        let retryable = try await outbox.failedRetryable()
        XCTAssertEqual(retryable.count, 1)
        XCTAssertEqual(retryable[0].clientMutationId, row.clientMutationId)
        XCTAssertEqual(retryable[0].attemptCount, 1)
        XCTAssertEqual(retryable[0].lastError, "timeout")

        // failedCount counts only exhausted rows — this one hasn't.
        let stuckCount = try await outbox.failedCount()
        XCTAssertEqual(stuckCount, 0)
    }

    func testTransientFailureAtMaxAttemptsIsStuck() async throws {
        // Script one attempt per max, all transient. Between attempts
        // we advance the clock so backoff lets the row be requeued.
        //
        // Baseline = ``Date()`` (real wall-clock now) because
        // ``Outbox`` writes rows with real ``Date()`` timestamps — a
        // fixed epoch would make every row look like a time-traveller
        // whose ``updatedAt`` is far in the future relative to the
        // mocked clock, and ``requeueReadyFailedRows`` would never
        // promote it.
        let baseline = Date()
        // ``MutableBox`` wraps the mutable clock state in a class so
        // the sync ``@Sendable`` closure can read it while the test
        // body mutates it. Tests run single-threaded, so this is
        // safe without locking.
        let nowBox = MutableBox(baseline)
        let clock: @Sendable () -> Date = { nowBox.value }
        let db = try AppDatabase.inMemory()
        let outbox = Outbox(database: db)
        let sender = MockSender(script: Array(
            repeating: OutboxSendOutcome.failedTransient("net"),
            count: OutboxMutation.maxAttempts,
        ))
        let worker = OutboxWorker(
            outbox: outbox,
            sender: sender,
            clock: clock,
            pollInterval: 60,
        )

        _ = try await outbox.enqueue(endpoint: "/a", method: .post)

        // Run drain + advance clock past the backoff each attempt.
        // After drain ``i``, the row's attemptCount is ``i + 1``, so
        // the next requeue consults ``backoff(i + 1)`` — not
        // ``backoff(i)``. An off-by-one here caused one of the
        // middle drains to see a not-yet-ready row and skip the
        // send, so the row ended at ``maxAttempts - 1`` instead of
        // reaching the stuck state.
        for attempt in 0..<OutboxMutation.maxAttempts {
            _ = await worker.drainOnce()
            let nextAttempts = attempt + 1
            let step = OutboxWorker.backoff(forAttempts: nextAttempts) + 0.1
            nowBox.value = nowBox.value.addingTimeInterval(step)
        }

        let stuckCount = try await outbox.failedCount()
        XCTAssertEqual(stuckCount, 1,
            "row should be stuck after reaching maxAttempts transient failures")

        // And a further drain doesn't re-attempt it.
        let attempted = await worker.drainOnce()
        XCTAssertEqual(attempted, 0,
            "stuck rows must never be re-sent on subsequent drains")
    }

    // MARK: - Permanent failure

    func testPermanentFailureBurnsAllRemainingAttempts() async throws {
        let (outbox, sender, worker) = try await makeStack(
            script: [.failedPermanent("422 invalid shape")],
        )
        _ = try await outbox.enqueue(endpoint: "/a", method: .post)

        _ = await worker.drainOnce()

        // Sender was called exactly once.
        let received = await sender.snapshot()
        XCTAssertEqual(received.count, 1)

        // Row is at maxAttempts immediately — no retries.
        let stuckCount = try await outbox.failedCount()
        XCTAssertEqual(stuckCount, 1)

        // Subsequent drain does nothing.
        _ = await worker.drainOnce()
        let afterCount = await sender.snapshot().count
        XCTAssertEqual(afterCount, 1,
            "permanent failures never get a second attempt")
    }

    // MARK: - Backoff respect

    func testFailedRowNotRequeuedBeforeBackoffElapses() async throws {
        // Clock is pinned so the first drain fails, and we only
        // advance by less than the backoff before the second drain.
        // The row must NOT be re-attempted on the second drain.
        // Baseline = ``Date()`` — see the rationale on the sibling
        // stuck-failure test.
        let baseline = Date()
        let nowBox = MutableBox(baseline)
        let clock: @Sendable () -> Date = { nowBox.value }

        let db = try AppDatabase.inMemory()
        let outbox = Outbox(database: db)
        let sender = MockSender(script: [
            .failedTransient("net"),
            .succeeded,
        ])
        let worker = OutboxWorker(
            outbox: outbox,
            sender: sender,
            clock: clock,
            pollInterval: 60,
        )

        _ = try await outbox.enqueue(endpoint: "/a", method: .post)

        _ = await worker.drainOnce()
        // Resolve actor-isolated reads before the XCTAssertEqual
        // autoclosure — await can't live inside that autoclosure.
        var snap = await sender.snapshot()
        XCTAssertEqual(snap.count, 1)

        // Advance 0.5s — less than the 1s backoff for attempts=1.
        nowBox.value = nowBox.value.addingTimeInterval(0.5)
        _ = await worker.drainOnce()
        snap = await sender.snapshot()
        XCTAssertEqual(snap.count, 1,
            "row was re-attempted before backoff elapsed")

        // Advance past the backoff. Now it should retry and succeed.
        nowBox.value = nowBox.value.addingTimeInterval(2.0)
        _ = await worker.drainOnce()
        snap = await sender.snapshot()
        XCTAssertEqual(snap.count, 2)

        let stuckCount = try await outbox.failedCount()
        XCTAssertEqual(stuckCount, 0,
            "successful retry should clear the stuck tally")
    }

    // MARK: - Backoff table

    func testBackoffTableMonotonicallyIncreasing() {
        // Photographers expect the delay between retries to grow, not
        // shrink — if the ladder was mis-ordered, failures on a
        // degraded backend would hammer it on the first retry instead
        // of backing off.
        let schedule = (0...5).map(OutboxWorker.backoff(forAttempts:))
        for i in 1..<schedule.count {
            XCTAssertGreaterThanOrEqual(schedule[i], schedule[i - 1],
                "backoff ladder must be monotonic non-decreasing")
        }
        XCTAssertEqual(schedule.last, 60,
            "cap at 60s so stuck rows don't stretch to infinity")
    }

    // MARK: - Lifecycle

    func testStartStopIsIdempotent() async throws {
        let (_, _, worker) = try await makeStack(script: [])
        await worker.start()
        await worker.start()   // must not spawn a second task
        await worker.stop()
        await worker.stop()    // must not crash
    }
}

/// Small reference-typed holder used to pass mutable test state
/// into ``@Sendable`` closures (the closure reads ``value``; the
/// test body mutates it). Tests run serially so concurrent mutation
/// isn't a concern — hence ``@unchecked Sendable``.
private final class MutableBox<Wrapped>: @unchecked Sendable {
    var value: Wrapped
    init(_ value: Wrapped) { self.value = value }
}
