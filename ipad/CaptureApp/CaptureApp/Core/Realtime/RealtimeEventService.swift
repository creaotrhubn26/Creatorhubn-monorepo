import Foundation

/// Owns the user-scoped WebSocket connection to the backend. Every connection
/// first mints a short-lived, single-use ticket over authenticated HTTPS; the
/// durable bearer is never stored by this service or placed in a WebSocket URL.
actor RealtimeEventService {

    typealias Observer = @Sendable (UserEvent) -> Void
    typealias TicketProvider = @Sendable () async throws -> BackendRealtimeTicket

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
    private var websocketBaseURL: URL?
    private var ticketProvider: TicketProvider?
    private var failureCount = 0
    private(set) var status: Status = .idle
    private var generation: UInt = 0

    init(session: URLSession = .shared) {
        self.session = session
    }

    func addObserver(_ observer: @escaping Observer) -> UUID {
        let id = UUID()
        observers[id] = observer
        return id
    }

    func removeObserver(_ id: UUID) {
        observers.removeValue(forKey: id)
    }

    func start(url: URL, ticketProvider: @escaping TicketProvider) async {
        stopInternal(clearCredentials: true)
        generation &+= 1
        let currentGeneration = generation
        websocketBaseURL = url
        self.ticketProvider = ticketProvider
        failureCount = 0
        status = .connecting
        await openSocket(generation: currentGeneration)
    }

    func stop() {
        stopInternal(clearCredentials: true)
        generation &+= 1
        status = .idle
    }

    private func stopInternal(clearCredentials: Bool) {
        reconnectTask?.cancel()
        reconnectTask = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        if clearCredentials {
            websocketBaseURL = nil
            ticketProvider = nil
        }
    }

    private func openSocket(generation: UInt) async {
        guard self.generation == generation,
              let websocketBaseURL,
              let ticketProvider
        else { return }
        do {
            let ticket = try await ticketProvider()
            guard self.generation == generation,
                  ticket.protocolVersion == 1,
                  !ticket.ticket.isEmpty
            else {
                scheduleReconnect(generation: generation)
                return
            }
            let connectURL = RealtimeWebSocketURL.ticketed(websocketBaseURL, ticket: ticket.ticket)
            let socketTask = session.webSocketTask(with: URLRequest(url: connectURL))
            task = socketTask
            status = failureCount == 0
                ? .connecting
                : .reconnecting(afterFailures: failureCount)
            socketTask.resume()
            runReceiveLoop(task: socketTask, generation: generation)
        } catch {
            scheduleReconnect(generation: generation)
        }
    }

    private func runReceiveLoop(task: URLSessionWebSocketTask, generation: UInt) {
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

    private func handle(message: URLSessionWebSocketTask.Message, generation: UInt) {
        guard stillActive(generation: generation) else { return }
        if failureCount > 0 {
            failureCount = 0
        }
        status = .connected
        let text: String?
        switch message {
        case .string(let value): text = value
        case .data(let data): text = String(data: data, encoding: .utf8)
        @unknown default: text = nil
        }
        if let text, let event = UserEvent.decode(jsonText: text) {
            for observer in observers.values { observer(event) }
        }
    }

    private func handleReceiveFailure(generation: UInt) {
        guard stillActive(generation: generation) else { return }
        task = nil
        scheduleReconnect(generation: generation)
    }

    private func scheduleReconnect(generation: UInt) {
        guard self.generation == generation,
              websocketBaseURL != nil,
              ticketProvider != nil,
              reconnectTask == nil
        else { return }
        failureCount += 1
        status = .reconnecting(afterFailures: failureCount)
        let delay = RealtimeBackoff.delay(forFailures: failureCount)
        reconnectTask = Task { [weak self, delay] in
            do {
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            } catch {
                return
            }
            guard let self else { return }
            await self.reconnectAfterDelay(generation: generation)
        }
    }

    private func reconnectAfterDelay(generation: UInt) async {
        guard self.generation == generation else { return }
        reconnectTask = nil
        await openSocket(generation: generation)
    }
}

enum RealtimeWebSocketURL {
    static func ticketed(_ baseURL: URL, ticket: String) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: true)
            ?? URLComponents()
        if components.scheme == "https" {
            components.scheme = "wss"
        } else if components.scheme == "http" {
            components.scheme = "ws"
        }
        var items = (components.queryItems ?? []).filter {
            $0.name != "token" && $0.name != "ticket"
        }
        items.append(URLQueryItem(name: "ticket", value: ticket))
        components.queryItems = items
        return components.url ?? baseURL
    }
}

enum RealtimeBackoff {
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
