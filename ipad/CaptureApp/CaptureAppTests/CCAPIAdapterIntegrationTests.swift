import XCTest
@testable import CaptureApp

/// Drives `CCAPIAdapter` against `FakeCanonCamera`. Exercises the full
/// start-up sequence (connect → enumerate → ready), auto-enqueue of
/// preview downloads, and the state-transition events the rest of the
/// app consumes.
final class CCAPIAdapterIntegrationTests: XCTestCase {
    private var camera: FakeCanonCamera!
    private var tempDir: URL!

    override func setUp() {
        super.setUp()
        camera = FakeCanonCamera()
        camera.install()
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("capture-ingest-tests-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        try? FileManager.default.removeItem(at: tempDir)
        camera = nil
        super.tearDown()
    }

    private func makeAdapter() throws -> CCAPIAdapter {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        return try CCAPIAdapter(
            baseURL: FakeCanonCamera.baseURL,
            adapterId: "test-adapter",
            client: client,
            downloadDirectory: tempDir
        )
    }

    /// Collect at least `count` events from `stream` or until `timeout` elapses.
    private func collect(
        _ stream: AsyncStream<IngestEvent>,
        count: Int,
        timeout: TimeInterval
    ) async -> [IngestEvent] {
        await withTaskGroup(of: [IngestEvent].self) { group in
            group.addTask {
                var events: [IngestEvent] = []
                for await event in stream {
                    events.append(event)
                    if events.count >= count { break }
                }
                return events
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(timeout))
                return []
            }
            let first = await group.next() ?? []
            group.cancelAll()
            return first
        }
    }

    func testStartupEmitsStateTransitionsAndDiscoversInitialAssets() async throws {
        let adapter = try makeAdapter()
        let events = adapter.events

        try await adapter.start()

        // Collect enough for: discovering, pairing, ready, 2 × assetDiscovered,
        // cardContentsEnumerated, then 2 × downloadCompleted.
        let collected = await collect(events, count: 8, timeout: 5)
        await adapter.stop()

        let stateChanges = collected.compactMap { event -> ConnectionState? in
            if case let .connectionStateChanged(state) = event { return state } else { return nil }
        }
        XCTAssertEqual(stateChanges.prefix(3).map(String.init(describing:)),
                       [ConnectionState.discovering, .pairing, .ready].map(String.init(describing:)))

        let discovered = collected.compactMap { event -> AssetDescriptor? in
            if case let .assetDiscovered(descriptor) = event { return descriptor } else { return nil }
        }
        XCTAssertEqual(Set(discovered.map(\.originalFilename)), ["IMG_0001.JPG", "IMG_0002.CR3"])

        let enumCount = collected.compactMap { event -> Int? in
            if case let .cardContentsEnumerated(count) = event { return count } else { return nil }
        }
        XCTAssertEqual(enumCount.first, 2)
    }

    func testAutoEnqueuedPreviewDownloadsProduceCompletedEvents() async throws {
        let adapter = try makeAdapter()
        let events = adapter.events
        try await adapter.start()

        let collected = await collect(events, count: 10, timeout: 5)
        await adapter.stop()

        let completed = collected.compactMap { event -> (UUID, DownloadKind, URL, String)? in
            if case let .downloadCompleted(id, kind, url, checksum) = event {
                return (id, kind, url, checksum)
            }
            return nil
        }
        XCTAssertEqual(completed.count, 2, "both initial assets should have preview downloads")
        for (_, kind, fileURL, checksum) in completed {
            XCTAssertEqual(kind, .preview)
            XCTAssertTrue(FileManager.default.fileExists(atPath: fileURL.path))
            XCTAssertEqual(checksum.count, 64)
        }
    }

    func testSimulatedCaptureFlowsThroughPolling() async throws {
        let adapter = try makeAdapter()
        try await adapter.start()

        // Scan the event stream until we see IMG_0003 (queued after a brief
        // delay so it lands in a polling cycle rather than the initial
        // enumeration). Bounded by a wall-clock deadline, so a stalled stream
        // fails fast instead of hanging the suite.
        let newURL = "/ccapi/ver100/contents/sd/100CANON/IMG_0003.JPG"
        let scan = Task<Bool, Never> { [events = adapter.events] in
            for await event in events {
                if case let .assetDiscovered(descriptor) = event,
                   descriptor.originalFilename == "IMG_0003.JPG" {
                    return true
                }
            }
            return false
        }

        try? await Task.sleep(for: .milliseconds(150))
        _ = camera.simulateCapture(filename: "IMG_0003.JPG")

        let found = await withTaskGroup(of: Bool.self) { group in
            group.addTask { await scan.value }
            group.addTask {
                try? await Task.sleep(for: .seconds(5))
                scan.cancel()
                return false
            }
            let first = await group.next() ?? false
            group.cancelAll()
            return first
        }

        await adapter.stop()
        XCTAssertTrue(found, "expected IMG_0003.JPG to surface via polling. url=\(newURL)")
    }
}
