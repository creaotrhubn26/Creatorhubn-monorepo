import Foundation
import CryptoKit

/// `IngestAdapter` backed by Canon's Camera Control API. Wraps `CCAPIClient`,
/// turns its polling responses + content URLs into the generic ingest events
/// that the rest of the app consumes.
///
/// Responsibilities:
///   • Connect (`GET /ccapi`), enumerate card contents, emit `assetDiscovered`
///     for each known file on startup.
///   • Long-poll `/event/polling?continue=on`. For every URL in
///     `addedcontents` emit another `assetDiscovered`.
///   • Maintain a priority queue of pending downloads. A serial worker
///     task drains it preview-first, then full, then raw.
///   • Surface connection-state transitions on every success/failure.
actor CCAPIAdapter: IngestAdapter {
    let adapterId: String

    nonisolated let events: AsyncStream<IngestEvent>
    private let continuation: AsyncStream<IngestEvent>.Continuation

    private let baseURL: URL
    private let client: CCAPIClient
    private let fileManager: FileManager
    private let downloadDirectory: URL
    private let enumerateOnStart: Bool

    private var pollingTask: Task<Void, Never>?
    private var downloadTask: Task<Void, Never>?

    /// Assets we've seen and announced. Keyed by stable UUID derived from the
    /// CCAPI content URL.
    private var knownAssets: [UUID: KnownAsset] = [:]

    /// Pending downloads, highest priority first.
    private var queue: [Pending] = []
    private var awaitingWork: CheckedContinuation<Void, Never>?

    private var connectionState: ConnectionState = .disconnected

    init(
        baseURL: URL,
        adapterId: String? = nil,
        client: CCAPIClient? = nil,
        downloadDirectory: URL? = nil,
        fileManager: FileManager = .default,
        enumerateOnStart: Bool = true,
    ) throws {
        self.adapterId = adapterId ?? "ccapi:\(baseURL.host ?? UUID().uuidString)"
        self.baseURL = baseURL
        self.client = client ?? CCAPIClient(baseURL: baseURL)
        self.fileManager = fileManager
        self.enumerateOnStart = enumerateOnStart

        let (stream, cont) = AsyncStream<IngestEvent>.makeStream(bufferingPolicy: .unbounded)
        self.events = stream
        self.continuation = cont

        let dir = downloadDirectory ?? fileManager.temporaryDirectory
            .appendingPathComponent("capture-ingest", isDirectory: true)
            .appendingPathComponent(self.adapterId, isDirectory: true)
        try fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        self.downloadDirectory = dir
    }

    deinit {
        continuation.finish()
    }

    // MARK: - IngestAdapter

    func start() async throws {
        guard pollingTask == nil else { return }
        try await transition(to: .discovering)
        do {
            _ = try await client.connect()
        } catch {
            try await transition(to: .error(String(describing: error)))
            throw error
        }
        try await transition(to: .pairing)
        if enumerateOnStart {
            try await enumerateAllContent()
        }
        try await transition(to: .ready)

        pollingTask = Task { [weak self] in
            await self?.runPollingLoop()
        }
        downloadTask = Task { [weak self] in
            await self?.runDownloadLoop()
        }
    }

    func stop() async {
        pollingTask?.cancel()
        downloadTask?.cancel()
        pollingTask = nil
        downloadTask = nil
        awaitingWork?.resume()
        awaitingWork = nil
        try? await transition(to: .disconnected)
    }

    func fetch(assetId: UUID, priority: IngestPriority) async throws {
        guard let known = knownAssets[assetId] else {
            throw IngestError.unsupportedFile("unknown asset id")
        }
        enqueue(
            Pending(
                assetId: assetId,
                contentURL: known.contentURL,
                kind: kind(for: priority),
                priority: priority,
            ),
        )
    }

    // MARK: - Connection state

    private func transition(to newState: ConnectionState) async throws {
        if connectionState == newState { return }
        connectionState = newState
        continuation.yield(.connectionStateChanged(newState))
    }

    // MARK: - Enumeration

    private func enumerateAllContent() async throws {
        let storages = try await client.listStorages()
        var total = 0
        for storage in storages {
            let directories = try await client.listDirectories(storagePath: storage.path)
            for dir in directories {
                let contents = try await client.listContents(directoryPath: dir)
                for url in contents {
                    register(contentURL: url)
                    total += 1
                }
            }
        }
        continuation.yield(.cardContentsEnumerated(assetCount: total))
    }

    // MARK: - Polling

    /// Polling interval between short-poll calls. Short enough that a new
    /// capture surfaces within ~1s, long enough that we don't thrash the
    /// camera's HTTP stack on a body that has nothing new to report.
    private static let pollInterval = Duration.milliseconds(500)

    private func runPollingLoop() async {
        var reconnectAttempt = 0
        while !Task.isCancelled {
            do {
                // Short poll + interval. We verified on R6 mkII fw 1.6.0 that
                // `?continue=on` long-polling does not reliably surface
                // `addedcontents` through URLSession's HTTP 100 Continue
                // handling; short polling is the robust path until we
                // switch to the event/monitoring SSE-style stream.
                let payload = try await client.pollEvents()
                reconnectAttempt = 0
                if let added = payload.addedcontents {
                    for url in added {
                        register(contentURL: url)
                    }
                }
                let telemetry = CameraTelemetry(
                    batteryLevel: payload.batteryLevel,
                    apertureValue: payload.apertureValue,
                    shutterSpeed: payload.shutterSpeed,
                    isoValue: payload.isoValue,
                    lensName: payload.lensName,
                    freeSpaceBytes: payload.freeSpaceBytes,
                    totalContentsCount: payload.totalContentsCount
                )
                if !telemetry.isEmpty {
                    continuation.yield(.telemetryUpdated(telemetry))
                }
                try? await Task.sleep(for: Self.pollInterval)
            } catch CCAPIError.timedOut {
                continue
            } catch {
                reconnectAttempt += 1
                try? await transition(to: .reconnecting(attempt: reconnectAttempt))
                let backoff = min(pow(2.0, Double(reconnectAttempt)), 30.0)
                try? await Task.sleep(for: .seconds(backoff))
                do {
                    _ = try await client.connect()
                    try await transition(to: .ready)
                } catch {
                    continue
                }
            }
        }
    }

    private func register(contentURL rawURL: String) {
        let assetId = Self.deterministicUUID(for: rawURL)
        guard knownAssets[assetId] == nil else { return }
        // Polling payloads expose content URLs as paths (e.g.
        // "/ccapi/ver120/contents/card1/100CANON/IMG_0001.JPG"). Resolve
        // against the camera's baseURL so the stored URL is absolute and
        // URLSession can actually GET it in production.
        guard let url = URL(string: rawURL, relativeTo: baseURL)?.absoluteURL else { return }

        let descriptor = AssetDescriptor(
            id: assetId,
            originalFilename: url.lastPathComponent,
            captureTime: Date(),
            mime: Self.mimeType(for: url.pathExtension),
            sizeBytes: nil,
        )
        knownAssets[assetId] = KnownAsset(contentURL: url, descriptor: descriptor)
        continuation.yield(.assetDiscovered(descriptor))

        // Auto-enqueue a preview for every new shot. Full + RAW are opt-in
        // via explicit fetch(assetId:priority:) from the caller.
        enqueue(
            Pending(
                assetId: assetId,
                contentURL: url,
                kind: .preview,
                priority: .preview,
            ),
        )
    }

    // MARK: - Download queue

    private struct Pending: Sendable {
        let assetId: UUID
        let contentURL: URL
        let kind: DownloadKind
        let priority: IngestPriority
    }

    private func enqueue(_ item: Pending) {
        if queue.contains(where: { $0.assetId == item.assetId && $0.kind == item.kind }) {
            return
        }
        queue.append(item)
        queue.sort { $0.priority < $1.priority }
        awaitingWork?.resume()
        awaitingWork = nil
    }

    private func runDownloadLoop() async {
        while !Task.isCancelled {
            guard let next = dequeue() else {
                await awaitForWork()
                continue
            }
            await performDownload(next)
        }
    }

    private func dequeue() -> Pending? {
        guard !queue.isEmpty else { return nil }
        return queue.removeFirst()
    }

    private func awaitForWork() async {
        if !queue.isEmpty { return }
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            awaitingWork = cont
        }
    }

    private func performDownload(_ item: Pending) async {
        let destination = downloadDirectory
            .appendingPathComponent("\(item.assetId.uuidString)-\(item.kind.rawValue)")
        do {
            // TODO: support HTTP Range-based resume when spec is verified.
            let sourceURL = Self.downloadURL(for: item)
            let (data, totalBytes) = try await client.downloadContent(
                contentURL: sourceURL,
                range: nil,
            )
            try data.write(to: destination, options: .atomic)
            let checksum = Self.sha256Hex(data)
            continuation.yield(
                .downloadCompleted(
                    assetId: item.assetId,
                    kind: item.kind,
                    fileURL: destination,
                    checksumSha256: checksum,
                ),
            )
            if totalBytes > 0 {
                continuation.yield(
                    .downloadProgress(
                        assetId: item.assetId,
                        bytesDownloaded: Int64(data.count),
                        totalBytes: totalBytes,
                    ),
                )
            }
        } catch let ccapi as CCAPIError {
            continuation.yield(
                .downloadFailed(
                    assetId: item.assetId,
                    kind: item.kind,
                    error: .transportFailed(String(describing: ccapi)),
                ),
            )
        } catch {
            continuation.yield(
                .downloadFailed(
                    assetId: item.assetId,
                    kind: item.kind,
                    error: .transportFailed(String(describing: error)),
                ),
            )
        }
    }

    // MARK: - Helpers

    private func kind(for priority: IngestPriority) -> DownloadKind {
        switch priority {
        case .preview: return .preview
        case .full:    return .full
        case .raw:     return .raw
        }
    }

    /// Per-kind query parameter that tells the camera which representation
    /// of the file to return. Canon CCAPI v1.4.0 §4.7.5:
    ///   - main (default) — full-resolution original (30+ MB for CR3)
    ///   - display        — screen-size JPEG (~1920px, **JPEG-format only**;
    ///                      returns 400 on CR3 and other RAW files)
    ///   - thumbnail      — small thumbnail (~300px, works on every format)
    /// We treat `.preview` as `thumbnail` because MVP cameras often shoot
    /// RAW-only or RAW+JPEG and we need a kind that's guaranteed to work.
    /// Switch to `display` later when we know the asset is a JPEG.
    private static func downloadURL(for item: Pending) -> URL {
        guard item.kind == .preview,
              var components = URLComponents(url: item.contentURL, resolvingAgainstBaseURL: false)
        else { return item.contentURL }
        var queryItems = components.queryItems ?? []
        queryItems.append(URLQueryItem(name: "kind", value: "thumbnail"))
        components.queryItems = queryItems
        return components.url ?? item.contentURL
    }

    /// UUID v5-style derivation from a content URL, so the same URL always
    /// maps to the same asset id across reconnects and app restarts.
    static func deterministicUUID(for url: String) -> UUID {
        let hash = SHA256.hash(data: Data(url.utf8))
        var bytes = Array(hash.prefix(16))
        bytes[6] = (bytes[6] & 0x0F) | 0x50
        bytes[8] = (bytes[8] & 0x3F) | 0x80
        return UUID(uuid: (
            bytes[0], bytes[1], bytes[2], bytes[3],
            bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9], bytes[10], bytes[11],
            bytes[12], bytes[13], bytes[14], bytes[15]
        ))
    }

    private static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private static func mimeType(for pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "jpg", "jpeg": return "image/jpeg"
        case "heic":        return "image/heic"
        case "cr3":         return "image/x-canon-cr3"
        case "cr2":         return "image/x-canon-cr2"
        case "mp4":         return "video/mp4"
        case "mov":         return "video/quicktime"
        default:            return "application/octet-stream"
        }
    }

    private struct KnownAsset {
        let contentURL: URL
        let descriptor: AssetDescriptor
    }
}
