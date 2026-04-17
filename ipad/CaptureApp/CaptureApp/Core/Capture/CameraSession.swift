import Foundation

/// Owns one physical camera connection and translates `IngestAdapter`
/// events into persisted state via `SessionStore`. The design-doc state
/// machine (§5.2, §8) lives here:
///
///     Disconnected → Discovering → Pairing → Ready → Shooting
///                                                 ↓
///     Error ←── Reconnecting ←── (adapter fails) ─┘
///                                                 ↓
///     Downloading (fires alongside Ready/Shooting)
///
/// `CameraSession` is the top-level object the UI listens to. It never
/// talks to the network directly — all I/O goes through the adapter.
actor CameraSession {
    enum State: Sendable, Equatable {
        case disconnected
        case discovering
        case pairing
        case ready
        case shooting
        case reconnecting(attempt: Int)
        case error(String)
    }

    private let adapter: any IngestAdapter
    private let store: SessionStore
    private let sessionId: UUID
    private let actorUserId: String

    private var pumpTask: Task<Void, Never>?
    private(set) var state: State = .disconnected

    nonisolated let stateChanges: AsyncStream<State>
    nonisolated let telemetryUpdates: AsyncStream<CameraTelemetry>
    private let stateContinuation: AsyncStream<State>.Continuation
    private let telemetryContinuation: AsyncStream<CameraTelemetry>.Continuation

    init(
        sessionId: UUID,
        actorUserId: String,
        adapter: any IngestAdapter,
        store: SessionStore,
    ) {
        self.sessionId = sessionId
        self.actorUserId = actorUserId
        self.adapter = adapter
        self.store = store
        let (stream, cont) = AsyncStream<State>.makeStream(bufferingPolicy: .unbounded)
        self.stateChanges = stream
        self.stateContinuation = cont
        let (telemetryStream, telemetryCont) = AsyncStream<CameraTelemetry>
            .makeStream(bufferingPolicy: .bufferingNewest(1))
        self.telemetryUpdates = telemetryStream
        self.telemetryContinuation = telemetryCont
    }

    deinit {
        stateContinuation.finish()
        telemetryContinuation.finish()
    }

    func start() async throws {
        guard pumpTask == nil else { return }
        pumpTask = Task { [weak self] in
            await self?.pumpAdapterEvents()
        }
        try await adapter.start()
    }

    func stop() async {
        pumpTask?.cancel()
        pumpTask = nil
        await adapter.stop()
        setState(.disconnected)
    }

    // MARK: - Event pump

    private func pumpAdapterEvents() async {
        for await event in adapter.events {
            if Task.isCancelled { break }
            await handle(event)
        }
    }

    private func handle(_ event: IngestEvent) async {
        switch event {
        case let .connectionStateChanged(connection):
            setState(mapConnection(connection))

        case let .assetDiscovered(descriptor):
            do {
                _ = try await store.createAsset(
                    sessionId: sessionId,
                    descriptor: descriptor,
                    initialState: .previewPending,
                )
                try await store.appendEvent(
                    sessionId: sessionId,
                    assetId: descriptor.id,
                    actorId: actorUserId,
                    eventType: .captured,
                )
                setState(.shooting)
            } catch {
                try? await store.appendEvent(
                    sessionId: sessionId,
                    assetId: descriptor.id,
                    actorId: actorUserId,
                    eventType: .failed,
                    metadata: ["reason": "create_asset_failed", "error": String(describing: error)],
                )
            }

        case let .downloadCompleted(assetId, kind, fileURL, checksum):
            let newState: AssetState = switch kind {
            case .preview: .previewReady
            case .full:    .fullReady
            case .raw:     .rawReady
            }
            let eventType: CaptureEvent.EventType = switch kind {
            case .preview: .previewReady
            case .full:    .fullReady
            case .raw:     .rawReady
            }
            try? await store.transitionAssetState(id: assetId, to: newState)
            try? await store.attachStorageKey(
                id: assetId,
                kind: kind,
                key: fileURL.path,
                checksumSha256: checksum,
                sizeBytes: (try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int64) ?? 0,
            )
            try? await store.appendEvent(
                sessionId: sessionId,
                assetId: assetId,
                actorId: actorUserId,
                eventType: eventType,
            )

        case let .downloadFailed(assetId, kind, error):
            try? await store.transitionAssetState(id: assetId, to: .failedTransient)
            try? await store.appendEvent(
                sessionId: sessionId,
                assetId: assetId,
                actorId: actorUserId,
                eventType: .failed,
                metadata: ["kind": kind.rawValue, "error": String(describing: error)],
            )

        case .downloadProgress:
            // Progress is UI-only; not persisted to the event log.
            break

        case let .telemetryUpdated(telemetry):
            // Forward verbatim; consumers accumulate (partial diffs).
            telemetryContinuation.yield(telemetry)

        case let .cardContentsEnumerated(count):
            try? await store.appendEvent(
                sessionId: sessionId,
                actorId: actorUserId,
                eventType: .sessionOpened,
                metadata: ["initial_card_contents": String(count)],
            )
        }
    }

    private func mapConnection(_ connection: ConnectionState) -> State {
        switch connection {
        case .disconnected:             return .disconnected
        case .discovering:              return .discovering
        case .pairing:                  return .pairing
        case .ready:                    return .ready
        case let .reconnecting(attempt): return .reconnecting(attempt: attempt)
        case let .error(message):       return .error(message)
        }
    }

    private func setState(_ next: State) {
        guard state != next else { return }
        state = next
        stateContinuation.yield(next)
    }
}
