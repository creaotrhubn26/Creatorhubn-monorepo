import Foundation
import GRDB

/// Outbox for queued mutations that must sync back to the CreatorHub
/// backend. This is the centrepiece of CreatorHub One's offline-first
/// design: every iPad-originated write — cull decision, shot
/// completion, contract signature, etc. — is appended here *atomically*
/// with the local row update inside a single GRDB transaction.
///
/// ``OutboxWorker`` (separate class) drains the queue when
/// connectivity returns. This file owns only the enqueue + state-
/// transition surface; the worker is a concern of its own.
///
/// Why a separate queue (rather than "just retry the request"):
///   * The iPad may accumulate dozens of mutations across an hours-
///     long shoot with spotty connectivity. We need one durable store
///     for the full backlog.
///   * The worker must serialise flush order so a later decision
///     doesn't overwrite an earlier one that hasn't landed yet.
///   * Idempotency tokens (``clientMutationId``) must survive app
///     restarts, which rules out in-memory queues.
actor Outbox {
    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    /// Append a new mutation to the queue. Generates a fresh
    /// idempotency token. Callers normally don't use this directly —
    /// they call ``enqueueInTransaction(_:mutation:)`` from within
    /// the same transaction that performed the local row update, so
    /// the local state and queued sync can never disagree.
    @discardableResult
    func enqueue(
        endpoint: String,
        method: OutboxMutation.Method,
        body: Encodable? = nil,
        entityTable: String? = nil,
        entityId: String? = nil,
    ) async throws -> OutboxMutation {
        let bodyJson = try Self.encodeBody(body)
        let now = Date()
        let draft = OutboxMutation(
            id: nil,
            clientMutationId: UUID().uuidString,
            endpoint: endpoint,
            method: method,
            bodyJson: bodyJson,
            entityTable: entityTable,
            entityId: entityId,
            status: .pending,
            attemptCount: 0,
            lastError: nil,
            createdAt: now,
            updatedAt: now,
        )
        // Build the mutation inside the writer so ``insert(db)``
        // can stamp the row id without mutating an outer ``var``
        // (Swift 6 strict-concurrency rejects captured-var writes
        // from @Sendable closures).
        return try await database.dbWriter.write { db in
            var mutation = draft
            try mutation.insert(db)
            return mutation
        }
    }

    /// Append a mutation inside an existing writer transaction, used
    /// when the caller is updating a local row and wants the queued
    /// sync to be indivisibly bound to that update. Example:
    ///
    ///     try await database.dbWriter.write { db in
    ///         try asset.update(db)
    ///         try await outbox.enqueueInTransaction(db, mutation: m)
    ///     }
    ///
    /// The "async inside closure" lie is the reason this helper takes
    /// a ``Database`` handle instead — the real enqueue just inserts
    /// a pre-built ``OutboxMutation`` synchronously.
    ///
    /// ``nonisolated``: this helper touches no actor state — every
    /// operation goes through the caller-supplied ``Database``
    /// handle. Marking it nonisolated lets callers invoke it from
    /// inside ``dbWriter.write { db in ... }`` blocks without hop-
    /// ping to the actor, which is required under Swift 6 strict
    /// concurrency because the write closure is ``@Sendable``.
    nonisolated func enqueueInTransaction(
        _ db: Database,
        endpoint: String,
        method: OutboxMutation.Method,
        body: Encodable? = nil,
        entityTable: String? = nil,
        entityId: String? = nil,
    ) throws {
        var mutation = OutboxMutation(
            id: nil,
            clientMutationId: UUID().uuidString,
            endpoint: endpoint,
            method: method,
            bodyJson: try Self.encodeBody(body),
            entityTable: entityTable,
            entityId: entityId,
            status: .pending,
            attemptCount: 0,
            lastError: nil,
            createdAt: Date(),
            updatedAt: Date(),
        )
        try mutation.insert(db)
    }

    /// Fetch up to ``limit`` pending mutations in FIFO order. The
    /// worker claims batches by calling this + ``markSyncing``.
    func nextPending(limit: Int = 25) async throws -> [OutboxMutation] {
        try await database.dbWriter.read { db in
            try OutboxMutation
                .filter(Column("status") == OutboxMutation.Status.pending.rawValue)
                .order(Column("createdAt").asc, Column("id").asc)
                .limit(limit)
                .fetchAll(db)
        }
    }

    /// Transition mutations to ``syncing`` — the worker does this in
    /// a single transaction before sending them over the wire, so a
    /// concurrent actor invocation (unlikely but possible) can't
    /// re-send the same row.
    func markSyncing(_ mutations: [OutboxMutation]) async throws {
        guard !mutations.isEmpty else { return }
        try await database.dbWriter.write { db in
            for var m in mutations {
                m.status = .syncing
                m.updatedAt = Date()
                try m.update(db)
            }
        }
    }

    /// Move a mutation to ``succeeded`` after a 2xx response. Rows
    /// that have succeeded are kept for 24h in case the UI wants to
    /// show a "sync log" and then pruned by ``sweep()``.
    func markSucceeded(_ mutation: OutboxMutation) async throws {
        try await database.dbWriter.write { db in
            var m = mutation
            m.status = .succeeded
            m.attemptCount += 1
            m.lastError = nil
            m.updatedAt = Date()
            try m.update(db)
        }
    }

    /// Move a mutation to ``failed`` on a transport error. If retries
    /// remain the worker will re-flip it back to ``pending``; if
    /// ``attemptCount`` reaches ``maxAttempts`` it stays ``failed``
    /// and the UI surfaces it as needing manual resolution.
    func markFailed(_ mutation: OutboxMutation, error: String) async throws {
        // Increment attemptCount via SQL so repeated calls with a
        // stale ``mutation`` snapshot still advance the DB row — the
        // counter is "how many times has this row been tried" and
        // must be monotonic regardless of what the caller last
        // observed. Using the snapshot's value would cap the DB at
        // attemptCount=1 whenever a caller forgets to re-read.
        let trimmedError = String(error.prefix(2000))
        let clientMutationId = mutation.clientMutationId
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                UPDATE outboxMutation
                SET status = ?, attemptCount = attemptCount + 1,
                    lastError = ?, updatedAt = ?
                WHERE clientMutationId = ?
                """,
                arguments: [
                    OutboxMutation.Status.failed.rawValue,
                    trimmedError,
                    Date(),
                    clientMutationId,
                ],
            )
        }
    }

    /// Reset a retry-eligible failed mutation to pending. The worker
    /// calls this with a backoff delay between attempts so we don't
    /// hammer a degraded backend.
    func requeue(_ mutation: OutboxMutation) async throws {
        guard mutation.attemptCount < OutboxMutation.maxAttempts else { return }
        try await database.dbWriter.write { db in
            var m = mutation
            m.status = .pending
            m.lastError = nil
            m.updatedAt = Date()
            try m.update(db)
        }
    }

    /// Count of mutations awaiting sync — drives the UI banner ("3
    /// endringer venter sync").
    func pendingCount() async throws -> Int {
        try await database.dbWriter.read { db in
            try OutboxMutation
                .filter(Column("status") == OutboxMutation.Status.pending.rawValue
                    || Column("status") == OutboxMutation.Status.syncing.rawValue)
                .fetchCount(db)
        }
    }

    /// Count of mutations that gave up — drives the "manual review
    /// needed" UI and the App Store review checkpoint: any deployed
    /// build with non-zero stuck outbox rows in telemetry triggers a
    /// bug report.
    func failedCount() async throws -> Int {
        try await database.dbWriter.read { db in
            try OutboxMutation
                .filter(Column("status") == OutboxMutation.Status.failed.rawValue
                    && Column("attemptCount") >= OutboxMutation.maxAttempts)
                .fetchCount(db)
        }
    }

    /// Failed rows that still have retries left. The ``OutboxWorker``
    /// reads this on every tick and requeues rows whose backoff delay
    /// has elapsed.
    func failedRetryable() async throws -> [OutboxMutation] {
        try await database.dbWriter.read { db in
            try OutboxMutation
                .filter(Column("status") == OutboxMutation.Status.failed.rawValue
                    && Column("attemptCount") < OutboxMutation.maxAttempts)
                .order(Column("updatedAt").asc)
                .fetchAll(db)
        }
    }

    /// Prune succeeded rows older than 24h. Called from a background
    /// timer; pure maintenance, never on the hot path.
    func sweep() async throws {
        let cutoff = Date().addingTimeInterval(-24 * 60 * 60)
        try await database.dbWriter.write { db in
            try OutboxMutation
                .filter(Column("status") == OutboxMutation.Status.succeeded.rawValue
                    && Column("updatedAt") < cutoff)
                .deleteAll(db)
        }
    }

    // MARK: - Internals

    private static func encodeBody(_ body: Encodable?) throws -> String? {
        guard let body else { return nil }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let anyBody = AnyEncodable(body)
        let data = try encoder.encode(anyBody)
        return String(data: data, encoding: .utf8)
    }
}

/// Type-erasing wrapper so ``Outbox.enqueue`` can accept any
/// ``Encodable`` without forcing callers into generic functions.
private struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void
    init<T: Encodable>(_ value: T) {
        self.encode = { try value.encode(to: $0) }
    }
    func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}
