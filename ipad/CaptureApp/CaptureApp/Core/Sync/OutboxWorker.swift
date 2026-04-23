import Foundation

/// Drains the ``Outbox`` by dispatching pending mutations to the
/// backend via an injected ``OutboxSender``. Runs as a periodic
/// poll-loop — every ``pollInterval`` seconds it:
///
///   1. Requeues any ``failed`` row whose backoff delay has elapsed.
///   2. Claims all ``pending`` rows via ``markSyncing``.
///   3. Sends each one through the sender.
///   4. Records the outcome back onto the row.
///
/// The poll loop is intentionally simple — no websocket push, no
/// fancy scheduling. A 5s tick is cheap (SQLite reads are ~100µs)
/// and makes the retry timing deterministic enough to reason about.
/// When the network comes back after an offline stretch, the worst
/// case is a 5s delay before the queue starts draining.
///
/// Backoff schedule (per-row attempt count):
///   attempt 0 → 1s
///   attempt 1 → 2s
///   attempt 2 → 5s
///   attempt 3 → 15s
///   attempt 4 → 60s
///
/// Total wall-clock cost for a fully stuck row: ~83s. Photographers
/// often reconnect within that window between location and the car;
/// longer outages are the "sit at home editing" case where nothing's
/// time-critical anyway.
actor OutboxWorker {
    private let outbox: Outbox
    private let sender: OutboxSender
    private let clock: @Sendable () -> Date
    /// ``nonisolated`` so the polling ``Task`` can read it without
    /// hopping back onto the actor just to learn the interval.
    nonisolated let pollInterval: TimeInterval
    private var runningTask: Task<Void, Never>?

    /// ``pollInterval`` defaults to 5s; tests pass 0 to drain
    /// immediately.
    init(
        outbox: Outbox,
        sender: OutboxSender,
        clock: @escaping @Sendable () -> Date = { Date() },
        pollInterval: TimeInterval = 5,
    ) {
        self.outbox = outbox
        self.sender = sender
        self.clock = clock
        self.pollInterval = pollInterval
    }

    /// Start the poll loop. Idempotent — calling start twice is a
    /// no-op (returns without spawning a second task).
    func start() {
        guard runningTask == nil else { return }
        let interval = pollInterval
        runningTask = Task { [self] in
            while !Task.isCancelled {
                _ = await self.drainOnce()
                try? await Task.sleep(for: .seconds(interval))
            }
        }
    }

    func stop() {
        runningTask?.cancel()
        runningTask = nil
    }

    /// One drain cycle. Public so ``FoundationDebugView`` can trigger
    /// it manually and tests can call it deterministically.
    ///
    /// Returns the number of mutations the worker actually attempted
    /// to send (pending rows it claimed). Failed-retry rows that were
    /// requeued but not yet due don't count — they remain in the
    /// failed bucket until their delay elapses.
    @discardableResult
    func drainOnce() async -> Int {
        await requeueReadyFailedRows()

        // Claim a bounded batch so one bad drain can't lock the actor
        // for seconds sending 1000 requests serially.
        let batch: [OutboxMutation]
        do {
            batch = try await outbox.nextPending(limit: 25)
            guard !batch.isEmpty else { return 0 }
            try await outbox.markSyncing(batch)
        } catch {
            return 0
        }

        for mutation in batch {
            let outcome = await sender.send(mutation)
            switch outcome {
            case .succeeded:
                try? await outbox.markSucceeded(mutation)

            case let .failedTransient(reason):
                try? await outbox.markFailed(mutation, error: reason)

            case let .failedPermanent(reason):
                // Permanently-failed rows skip the retry ladder by
                // burning all remaining attempts in a single step.
                // The photographer has to resolve them manually.
                var burning = mutation
                while burning.attemptCount < OutboxMutation.maxAttempts {
                    try? await outbox.markFailed(burning, error: reason)
                    burning.attemptCount += 1
                }
            }
        }
        return batch.count
    }

    /// Promote any ``failed`` row whose backoff delay has elapsed
    /// back to ``pending`` so the next drain picks it up. Rows that
    /// have reached ``maxAttempts`` never get promoted — they stay
    /// failed until the UI or a background job cleans them up.
    private func requeueReadyFailedRows() async {
        let now = clock()
        let failed: [OutboxMutation]
        do {
            failed = try await readFailedRetryable()
        } catch {
            return
        }
        for row in failed {
            let delay = OutboxWorker.backoff(forAttempts: row.attemptCount)
            let readyAt = row.updatedAt.addingTimeInterval(delay)
            if now >= readyAt {
                try? await outbox.requeue(row)
            }
        }
    }

    /// Read the failed-but-retryable rows (attempts < maxAttempts).
    /// Implemented in the worker rather than on Outbox because it's
    /// tied to the retry ladder, not the data shape.
    private func readFailedRetryable() async throws -> [OutboxMutation] {
        // Reuse the outbox actor's read path via a small indirection
        // to keep DB writes serialised through it.
        try await outbox.failedRetryable()
    }

    /// Backoff ladder. Table-driven so the retry timing is obvious
    /// from the code and easy to tune.
    static func backoff(forAttempts attempts: Int) -> TimeInterval {
        switch attempts {
        case 0: return 1
        case 1: return 2
        case 2: return 5
        case 3: return 15
        case 4: return 60
        default: return 60
        }
    }
}
