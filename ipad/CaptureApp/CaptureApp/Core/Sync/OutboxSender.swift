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

/// Production sender for durable offline mutations. It accepts only relative
/// CreatorHub API paths, preventing a poisoned local row from exfiltrating the
/// bearer to another host. The stable client mutation id is forwarded on every
/// retry so backend endpoints can deduplicate where supported.
actor HTTPOutboxSender: OutboxSender {
    private let baseURL: URL
    private let bearer: String
    private let session: URLSession

    init(baseURL: URL, bearer: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.bearer = bearer
        self.session = session
    }

    func send(_ mutation: OutboxMutation) async -> OutboxSendOutcome {
        guard let url = safeURL(for: mutation.endpoint) else {
            return .failedPermanent("Unsafe or invalid outbox endpoint")
        }

        var request = URLRequest(url: url)
        request.httpMethod = mutation.method.rawValue
        request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(mutation.clientMutationId, forHTTPHeaderField: "X-Client-Mutation-Id")
        if let bodyJson = mutation.bodyJson {
            guard let body = bodyJson.data(using: .utf8),
                  (try? JSONSerialization.jsonObject(with: body)) != nil
            else {
                return .failedPermanent("Outbox body is not valid JSON")
            }
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                return .failedTransient("Backend returned a non-HTTP response")
            }
            if (200..<300).contains(http.statusCode) { return .succeeded }

            let detail = String(data: data.prefix(1_000), encoding: .utf8) ?? ""
            let reason = "HTTP \(http.statusCode)\(detail.isEmpty ? "" : ": \(detail)")"
            switch http.statusCode {
            case 408, 425, 429, 500...599:
                return .failedTransient(reason)
            default:
                return .failedPermanent(reason)
            }
        } catch is CancellationError {
            return .failedTransient("Request cancelled")
        } catch {
            return .failedTransient(error.localizedDescription)
        }
    }

    private func safeURL(for endpoint: String) -> URL? {
        guard endpoint.hasPrefix("/api/"),
              let components = URLComponents(string: endpoint),
              components.scheme == nil,
              components.host == nil,
              components.user == nil,
              components.password == nil,
              !endpoint.contains("\\")
        else { return nil }

        let url = URL(string: endpoint, relativeTo: baseURL)?.absoluteURL
        guard let url,
              url.scheme == baseURL.scheme,
              url.host == baseURL.host,
              url.port == baseURL.port
        else { return nil }
        return url
    }
}

/// Owns the one production worker for the app process. Sign-in replaces its
/// credentials; sign-out stops it. Reopening the same SQLite pool is safe and
/// lets every feature continue using its existing lightweight store objects.
actor CaptureSyncCoordinator {
    static let shared = CaptureSyncCoordinator()

    private var worker: OutboxWorker?
    private var identity: String?

    func start(session stored: SignInService.StoredSession) async {
        let nextIdentity = "\(stored.backendBaseURL.absoluteString)|\(stored.userId)"
        if identity == nextIdentity, worker != nil { return }
        await stop()

        do {
            let database = try AppDatabase.openOnDisk(at: AppDatabase.defaultDiskURL())
            let outbox = Outbox(database: database, ownerUserId: stored.userId)
            try await outbox.recoverInterruptedSyncs()
            let sender = HTTPOutboxSender(
                baseURL: stored.backendBaseURL,
                bearer: stored.bearer,
            )
            let nextWorker = OutboxWorker(outbox: outbox, sender: sender)
            worker = nextWorker
            identity = nextIdentity
            await nextWorker.start()
        } catch {
            AppLog.sync.error("[CaptureSyncCoordinator] Could not start outbox: \(error.localizedDescription, privacy: .public)")
        }
    }

    func stop() async {
        if let worker { await worker.stop() }
        worker = nil
        identity = nil
    }
}
