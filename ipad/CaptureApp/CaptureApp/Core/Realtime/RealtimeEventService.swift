import Foundation

/// Owns the user-scoped WebSocket connection to the backend at
/// ``/api/ipad/ws/events?token=<bearer>`` and dispatches decoded
/// ``UserEvent``s to subscribers.
///
/// Why an actor:
///   * Mutation of the socket task + reconnect state must be
///     serialized across ``start``/``stop``/``send`` calls.
///   * The observer list needs safe concurrent append.
///
/// Reconnect policy: exponential backoff identical to
/// ``OutboxWorker`` (1s → 2s → 5s → 15s → 60s, clamped to 60s after
/// 5 failures). On success the counter resets so a later flaky Wi-Fi
/// event starts fresh instead of jumping to a 60-second delay.
///
/// Tests drive the backoff table directly via
/// ``RealtimeBackoff.delay(forFailures:)``; the live socket is kept
/// thin + boring so integration behaviour stays in
/// URLSessionWebSocketTask rather than our code.
actor RealtimeEventService {

    /// Subscriber closure: called on the cooperative thread the
    /// actor runs on (main? depends on caller). Callers should hop
    /// to @MainActor inside the closure if they're updating UI.
    /// `@Sendable` so subscribers can capture `Sendable`-bound state
    /// (typical SwiftUI use is `[weak self] event in Task { @MainActor in … }`).
    typealias Observer = @Sendable (UserEvent) -> Void

    enum Status: Equatable {
        case idle
        case connecting
        case connected
        case reconnecting(afterFailures: Int)
    }

    private let session: URLSession
    private var observers: [UUID: Observer] = [:]
    private var task: URLSessionWebSocketTask?
    private var reconnectTask: Task<Void, Never>?
    private var failureCount = 0
    private(set) var status: Status = .idle
    /// Monotonically-increasing token. Incremented on every start()
    /// so stale async loops from a prior socket can no-op when they
    /// discover they've been superseded.
    private var generation: UInt = 0

    init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Public API

    func addObserver(_ observer: @escaping Observer) -> UUID {
        let id = UUID()
        observers[id] = observer
        return id
    }

    func removeObserver(_ id: UUID) {
        observers.removeValue(forKey: id)
    }

    /// Open (or re-open) the WebSocket. Safe to call repeatedly —
    /// a live connection is torn down first so the caller doesn't
    /// have to track connection state.
    func start(url: URL, bearerToken: String) {
        stopInternal()
        generation &+= 1
        let myGeneration = generation
        failureCount = 0
        let connectURL = appendToken(to: url, token: bearerToken)
        var request = URLRequest(url: connectURL)
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        let socketTask = session.webSocketTask(with: request)
        self.task = socketTask
        status = .connecting
        socketTask.resume()
        runReceiveLoop(task: socketTask, generation: myGeneration)
    }

    func stop() {
        stopInternal()
        status = .idle
    }

    // MARK: - Internals

    private func stopInternal() {
        reconnectTask?.cancel()
        reconnectTask = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func appendToken(to url: URL, token: String) -> URL {
        var components = URLComponents(url: url, resolvingAgainstBaseURL: true)
            ?? URLComponents()
        var items = components.queryItems ?? []
        items.append(URLQueryItem(name: "token", value: token))
        components.queryItems = items
        return components.url ?? url
    }

    private func runReceiveLoop(
        task: URLSessionWebSocketTask,
        generation: UInt,
    ) {
        Task { [weak self] in
            guard let self else { return }
            while await self.stillActive(generation: generation) {
                do {
                    let message = try await task.receive()
                    await self.handle(message: message, generation: generation)
                } catch {
                    await self.handleReceiveFailure(generation: generation)
                    return
                }
            }
        }
    }

    private func stillActive(generation: UInt) -> Bool {
        self.generation == generation && task != nil
    }

    private func handle(
        message: URLSessionWebSocketTask.Message,
        generation: UInt,
    ) {
        guard stillActive(generation: generation) else { return }
        // Reset failure count the first time a server frame arrives
        // — we treat any frame as proof the socket is healthy.
        if failureCount > 0 {
            failureCount = 0
        }
        status = .connected
        let text: String?
        switch message {
        case .string(let s):
            text = s
        case .data(let d):
            text = String(data: d, encoding: .utf8)
        @unknown default:
            text = nil
        }
        if let text, let event = UserEvent.decode(jsonText: text) {
            for observer in observers.values {
                observer(event)
            }
        }
    }

    private func handleReceiveFailure(generation: UInt) {
        guard stillActive(generation: generation) else { return }
        failureCount += 1
        status = .reconnecting(afterFailures: failureCount)
        let delay = RealtimeBackoff.delay(forFailures: failureCount)
        // Schedule reconnect via the caller re-calling start() — the
        // service doesn't hold onto the URL/token to avoid stashing
        // credentials across a sign-out. Subscribers observe the
        // ``.reconnecting`` status and kick start() with the fresh
        // session credentials.
        reconnectTask = Task { [weak self, delay] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            await self?.notifyReconnectReady()
        }
    }

    private func notifyReconnectReady() {
        // Emit a synthetic unknown event so observers can re-drive
        // ``start`` — keeps the credential-free surface of this
        // actor intact.
        let synthetic = UserEvent.unknown(kind: "__reconnect_ready__")
        for observer in observers.values {
            observer(synthetic)
        }
    }
}

/// Pure function exposed for testing. Mirrors ``OutboxWorker`` so
/// both sync channels degrade predictably under the same flaky-
/// network conditions.
enum RealtimeBackoff {
    /// Returns the delay in seconds before the caller should re-open
    /// the WebSocket. ``failures`` is 1-indexed — the first failure
    /// waits 1 second.
    static func delay(forFailures failures: Int) -> TimeInterval {
        switch max(1, failures) {
        case 1: return 1
        case 2: return 2
        case 3: return 5
        case 4: return 15
        default: return 60
        }
    }
}
