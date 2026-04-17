import XCTest
@testable import CaptureApp

/// Verifies `CCAPIClient.listContents(directoryPath:)` handles Canon's
/// 100-items-per-page scheme: we must first call `?kind=number` for totals,
/// then loop `?kind=list&page=N` and concatenate. A directory with 2113
/// files (real R6 mkII card) requires 22 paginated GETs.
final class CCAPIPaginationTests: XCTestCase {
    private var camera: FakeCanonCamera!

    override func tearDown() {
        MockURLProtocol.handler = nil
        camera = nil
        super.tearDown()
    }

    private func makeClient() -> CCAPIClient {
        CCAPIClient(baseURL: FakeCanonCamera.baseURL, session: camera.makeSession())
    }

    func testListContentsNumberReturnsTotalsAndPageCount() async throws {
        camera = FakeCanonCamera(initialAssetCount: 250)
        camera.install()
        let client = makeClient()
        _ = try await client.connect()
        let meta = try await client.listContentsNumber(
            directoryPath: "/ccapi/ver120/contents/sd/100CANON"
        )
        XCTAssertEqual(meta.contentsnumber, 250)
        XCTAssertEqual(meta.pagenumber, 3) // ceil(250/100) = 3
    }

    func testListContentsConcatenatesAllPagesInOrder() async throws {
        camera = FakeCanonCamera(initialAssetCount: 250)
        camera.install()
        let client = makeClient()
        _ = try await client.connect()
        let all = try await client.listContents(
            directoryPath: "/ccapi/ver120/contents/sd/100CANON"
        )
        XCTAssertEqual(all.count, 250)
        // First + last should be the expected canonicalised filenames.
        XCTAssertTrue(all.first?.hasSuffix("IMG_0001.JPG") == true, "got \(all.first ?? "nil")")
        XCTAssertTrue(all.last?.hasSuffix("IMG_0250.JPG") == true, "got \(all.last ?? "nil")")
        XCTAssertEqual(Set(all).count, 250, "expected every file unique; got duplicates")
    }

    func testListContentsHonoursMaxPagesCap() async throws {
        camera = FakeCanonCamera(initialAssetCount: 250)
        camera.install()
        let client = makeClient()
        _ = try await client.connect()
        let firstPage = try await client.listContents(
            directoryPath: "/ccapi/ver120/contents/sd/100CANON",
            maxPages: 1
        )
        XCTAssertEqual(firstPage.count, 100)
        XCTAssertTrue(firstPage.first?.hasSuffix("IMG_0001.JPG") == true)
        XCTAssertTrue(firstPage.last?.hasSuffix("IMG_0100.JPG") == true)
    }

    func testListContentsEmptyDirectoryReturnsEmpty() async throws {
        camera = FakeCanonCamera(initialAssetCount: 0)
        camera.install()
        let client = makeClient()
        _ = try await client.connect()
        let all = try await client.listContents(
            directoryPath: "/ccapi/ver120/contents/sd/100CANON"
        )
        XCTAssertEqual(all, [])
    }
}
