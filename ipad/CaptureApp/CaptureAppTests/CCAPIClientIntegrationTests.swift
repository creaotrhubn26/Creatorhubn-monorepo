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
        XCTAssertEqual(inventory.versions.count, 1)
        XCTAssertTrue(inventory.supports(path: "/ccapi/ver100/devicestatus/storage"))
        let connected = await client.isConnected
        XCTAssertTrue(connected)
    }

    func testListStoragesAfterConnect() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()
        let storages = try await client.listStorages()
        XCTAssertEqual(storages.count, 1)
        XCTAssertEqual(storages.first?.name, "sd")
        XCTAssertEqual(storages.first?.url, "/ccapi/ver100/contents/sd")
    }

    func testListContentsWalksFromStorageToFiles() async throws {
        let client = CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
        _ = try await client.connect()
        let storages = try await client.listStorages()
        let directories = try await client.listDirectories(storagePath: storages[0].url)
        XCTAssertEqual(directories, ["/ccapi/ver100/contents/sd/100CANON"])
        let contents = try await client.listContents(directoryPath: directories[0])
        XCTAssertEqual(contents.sorted(), [
            "/ccapi/ver100/contents/sd/100CANON/IMG_0001.JPG",
            "/ccapi/ver100/contents/sd/100CANON/IMG_0002.CR3",
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
