import XCTest
@testable import CaptureApp

/// End-to-end verification that a `CameraSession` built on top of a
/// `CCAPIAdapter` persists discovered + downloaded assets into `SessionStore`
/// with the correct state transitions.
final class CameraSessionPipelineTests: XCTestCase {
    private var camera: FakeCanonCamera!
    private var tempDir: URL!

    override func setUp() {
        super.setUp()
        camera = FakeCanonCamera()
        camera.install()
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("pipeline-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        try? FileManager.default.removeItem(at: tempDir)
        camera = nil
        super.tearDown()
    }

    func testFakeCameraDrivesAssetsIntoSessionStoreWithPreviewReady() async throws {
        let store = SessionStore(database: try AppDatabase.inMemory())
        let session = try await store.createSession(
            name: "Pipeline shoot",
            clientId: nil,
            ownerUserId: "owner-1"
        )

        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        let adapter = try CCAPIAdapter(
            baseURL: FakeCanonCamera.baseURL,
            adapterId: "pipeline-test",
            client: client,
            downloadDirectory: tempDir
        )

        let cameraSession = CameraSession(
            sessionId: session.id,
            actorUserId: "owner-1",
            adapter: adapter,
            store: store
        )

        try await cameraSession.start()

        // Poll the store for a few seconds until both assets reach previewReady.
        var assets: [Asset] = []
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            assets = try await store.listAssets(sessionId: session.id)
            if assets.count == 2 && assets.allSatisfy({ $0.state == .previewReady }) {
                break
            }
            try? await Task.sleep(for: .milliseconds(50))
        }

        await cameraSession.stop()

        XCTAssertEqual(assets.count, 2, "expected both initial CCAPI assets to be persisted")
        XCTAssertTrue(
            assets.allSatisfy { $0.state == .previewReady },
            "all assets should transition to previewReady: \(assets.map { ($0.originalFilename, $0.state) })"
        )
        XCTAssertTrue(
            assets.allSatisfy { $0.previewKey != nil },
            "previewKey should point at the downloaded file"
        )
        XCTAssertTrue(
            assets.allSatisfy { ($0.checksumSha256?.count ?? 0) == 64 },
            "sha256 hex should be 64 chars"
        )

        // Event log must have ordered entries for each asset.
        let events = try await store.listEvents(sessionId: session.id)
        let capturedCount = events.filter { $0.eventType == .captured }.count
        let previewReadyCount = events.filter { $0.eventType == .previewReady }.count
        XCTAssertEqual(capturedCount, 2)
        XCTAssertEqual(previewReadyCount, 2)
    }

    func testLiveCapturedAssetFlowsIntoStore() async throws {
        let store = SessionStore(database: try AppDatabase.inMemory())
        let session = try await store.createSession(
            name: "Live shoot",
            clientId: nil,
            ownerUserId: "owner-1"
        )

        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        let adapter = try CCAPIAdapter(
            baseURL: FakeCanonCamera.baseURL,
            adapterId: "pipeline-live",
            client: client,
            downloadDirectory: tempDir
        )
        let cameraSession = CameraSession(
            sessionId: session.id,
            actorUserId: "owner-1",
            adapter: adapter,
            store: store
        )

        try await cameraSession.start()
        // Let the initial enumeration settle.
        try? await Task.sleep(for: .milliseconds(200))

        _ = camera.simulateCapture(filename: "IMG_LIVE_001.JPG")

        var assets: [Asset] = []
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            assets = try await store.listAssets(sessionId: session.id)
            if assets.contains(where: { $0.originalFilename == "IMG_LIVE_001.JPG" && $0.state == .previewReady }) {
                break
            }
            try? await Task.sleep(for: .milliseconds(50))
        }

        await cameraSession.stop()

        let live = assets.first { $0.originalFilename == "IMG_LIVE_001.JPG" }
        XCTAssertNotNil(live, "IMG_LIVE_001.JPG should be persisted via polling+download")
        XCTAssertEqual(live?.state, .previewReady)
    }
}
