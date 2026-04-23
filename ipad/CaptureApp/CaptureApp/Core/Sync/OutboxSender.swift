import Foundation

/// Outcome of one outbox-mutation send attempt. The worker uses this
/// to decide whether to retry:
///
///   * ``succeeded`` — row moves to succeeded, worker continues.
///   * ``failedTransient`` — network error, 5xx, 429. Mark failed and
///     retry with exponential backoff until attempts exhaust.
///   * ``failedPermanent`` — 400/404/422. The request is malformed or
///     references something that doesn't exist; no retry will fix it.
///     Mark failed with attempts := maxAttempts so the UI parks it
///     for manual resolution.
enum OutboxSendOutcome: Sendable {
    case succeeded
    case failedTransient(String)
    case failedPermanent(String)
}

/// Abstraction over "actually send this mutation to the backend".
/// The worker depends on this protocol, not on ``BackendClient``, so
/// tests can inject a mock sender that records calls without any
/// networking setup.
protocol OutboxSender: Sendable {
    func send(_ mutation: OutboxMutation) async -> OutboxSendOutcome
}
