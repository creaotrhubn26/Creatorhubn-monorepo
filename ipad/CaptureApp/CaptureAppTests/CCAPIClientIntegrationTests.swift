import XCTest
@testable import CaptureApp

/// Drives `CCAPIClient` against `FakeCanonCamera` so the actual HTTP path,
/// JSON decoding, and version-picking are exercised end-to-end.
final class CCAPIClientIntegrationTests: XCTestCase {
    private var camera: FakeCanonCamera!

    override func setUp() {
        super.setUp()
        camera = FakeCanonCamera()
        camera.install()
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        camera = nil
        super.tearDown()
    }

    func testConnectFetchesInventory() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        let inventory = try await client.connect()
        XCTAssertEqual(inventory.versions.count, 2) // ver100 + ver110
        XCTAssertTrue(inventory.supports(path: "/ccapi/ver110/devicestatus/storage"))
        XCTAssertTrue(inventory.supports(path: "/ccapi/ver110/event/polling"))
        let connected = await client.isConnected
        XCTAssertTrue(connected)
    }

    func testListStoragesAfterConnect() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()
        let storages = try await client.listStorages()
        XCTAssertEqual(storages.count, 1)
        XCTAssertEqual(storages.first?.name, "sd")
        XCTAssertEqual(storages.first?.path, "/ccapi/ver120/contents/sd")
    }

    func testListContentsWalksFromStorageToFiles() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()
        let storages = try await client.listStorages()
        let directories = try await client.listDirectories(storagePath: storages[0].path)
        XCTAssertEqual(directories, ["/ccapi/ver120/contents/sd/100CANON"])
        let contents = try await client.listContents(directoryPath: directories[0])
        XCTAssertEqual(contents.sorted(), [
            "/ccapi/ver120/contents/sd/100CANON/IMG_0001.JPG",
            "/ccapi/ver120/contents/sd/100CANON/IMG_0002.JPG",
        ])
    }

    func testPollEventsReturnsAddedContents() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()
        let new = camera.simulateCapture(filename: "IMG_0003.JPG")
        let response = try await client.pollEvents()
        XCTAssertEqual(response.addedcontents, [new])
    }

    func testLongPollVersionMatchHandlesQueryString() async throws {
        // Regression: pickVersion used hasSuffix on a query-bearing base path,
        // which never matched any inventory entry. Long-poll must work.
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()
        let response = try await client.longPollEvents(timeout: 5)
        XCTAssertNil(response.addedcontents)
    }

    func testDirectLiveViewUsesAdvertisedEndpointsAndReturnsJPEG() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()

        try await client.startLiveView()
        let frame = try await client.liveViewFrame()
        await client.stopLiveView()

        XCTAssertGreaterThan(frame.count, 100)
        XCTAssertEqual(frame.first, 0xff)
        XCTAssertEqual(
            camera.seenRequests.filter { $0 == "/ccapi/ver100/shooting/liveview" }.count,
            2,
            "R6-style POST-only Live View must send both start and documented off payloads"
        )
        XCTAssertTrue(camera.seenRequests.contains("/ccapi/ver100/shooting/liveview/flip"))
        XCTAssertFalse(camera.seenRequests.contains("/ccapi/ver100/shooting/liveview/scroll"))
    }

    func testCapabilityGatedMovieRecordSettingsAndMediaImport() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()

        let capabilities = try await client.videoCapabilities()
        XCTAssertTrue(capabilities.canRecordMovie)
        XCTAssertEqual(capabilities.writableSettings, Set(CCAPIShootingSettingKey.allCases))

        var settings = try await client.videoShootingSettings()
        XCTAssertEqual(settings[.tv]?.value, "1/50")
        XCTAssertEqual(settings[.av]?.value, "f2.8")
        XCTAssertEqual(settings[.iso]?.ability, ["400", "800", "1600"])

        let confirmed = try await client.updateVideoShootingSetting(.iso, value: "1600")
        XCTAssertEqual(confirmed.value, "1600")
        settings = try await client.videoShootingSettings()
        XCTAssertEqual(settings[.iso]?.value, "1600")

        try await client.setMovieRecording(true)
        try await client.setMovieRecording(false)
        let event = try await client.pollEvents()
        let contentPath = try XCTUnwrap(event.addedcontents?.first { $0.hasSuffix(".MP4") })

        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("ccapi-video-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let fileURL = try await client.downloadContentToDirectory(
            contentPath: contentPath,
            directory: directory
        )
        XCTAssertEqual(fileURL.lastPathComponent, "MVI_0001.MP4")
        XCTAssertGreaterThan((try Data(contentsOf: fileURL)).count, 0)
        XCTAssertTrue(camera.seenRequests.contains("/ccapi/ver100/shooting/control/recbutton"))
    }

    func testSettingWriteRejectsValueOutsideCameraAbilityBeforePUT() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()

        do {
            _ = try await client.updateVideoShootingSetting(.iso, value: "102400")
            XCTFail("expected ability validation to reject the value")
        } catch CCAPIError.invalidResponse {
            // Expected: only the validation GET reaches the camera.
        }

        XCTAssertEqual(
            camera.seenRequests.filter { $0 == "/ccapi/ver100/shooting/settings/iso" }.count,
            1
        )
    }

    func testMediaImportRejectsCrossOriginCameraURL() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()

        do {
            _ = try await client.downloadContentToDirectory(
                contentPath: "https://example.invalid/private/MVI_0001.MP4",
                directory: FileManager.default.temporaryDirectory
            )
            XCTFail("expected a cross-origin content URL to be rejected")
        } catch CCAPIError.invalidResponse {
            // Expected before any network request is made.
        }
        XCTAssertFalse(camera.seenRawURLs.contains { $0.contains("example.invalid") })
    }

    /// P1-regresjon: `get(path:)` brukte `appendingPathComponent` som prosent-kodet
    /// «?» → «%3F», så et EKTE kamera aldri så `continue=on`. Assert på RÅ URL
    /// (absoluteString bevarer koding; `url.path` dekoder %3F og ville maskert det).
    func testLongPollUrlPreservesQueryEncoding() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()
        _ = try await client.longPollEvents(timeout: 5)
        let pollingURLs = camera.seenRawURLs.filter { $0.contains("event/polling") }
        XCTAssertFalse(pollingURLs.isEmpty, "long-poll-kallet ble aldri sendt")
        XCTAssertTrue(pollingURLs.contains { $0.contains("event/polling?continue=on") },
                      "query-strengen ble ikke bevart: \(pollingURLs)")
        XCTAssertFalse(pollingURLs.contains { $0.contains("%3F") },
                      "«?» ble prosent-kodet til %3F: \(pollingURLs)")
    }

    func testConnectThrowsOn503() async throws {
        // Override handler to return a 503 for /ccapi.
        MockURLProtocol.handler = { request in
            let url = request.url!
            let resp = HTTPURLResponse(url: url, statusCode: 503, httpVersion: "HTTP/1.1", headerFields: nil)!
            return (resp, Data())
        }
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        do {
            _ = try await client.connect()
            XCTFail("expected cameraBusy")
        } catch CCAPIError.cameraBusy {
            // expected
        }
    }

    func testCallingMethodsBeforeConnectThrowsNotDiscovered() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        do {
            _ = try await client.listStorages()
            XCTFail("expected notDiscovered")
        } catch CCAPIError.notDiscovered {
            // expected
        }
    }
}
