import XCTest
@testable import CaptureApp

/// Live-hardware smoke tests. Only run when `CCAPI_LIVE_URL` is set in the
/// test process's environment (via `TEST_RUNNER_CCAPI_LIVE_URL=…` on the
/// `xcodebuild test` command line). Otherwise every test skips, so CI stays
/// green without a camera.
///
/// Exercises the full real stack: self-signed TLS trust, dict-shape
/// inventory decode, storage/contents/polling decode — all against the
/// camera that's currently on the Mac's Wi-Fi. Any decoder mismatch with a
/// specific firmware surfaces here before it reaches the app.
final class CCAPILiveSmokeTests: XCTestCase {
    private func liveBaseURL() throws -> URL {
        guard
            let raw = ProcessInfo.processInfo.environment["CCAPI_LIVE_URL"],
            let url = URL(string: raw)
        else {
            throw XCTSkip("CCAPI_LIVE_URL not set — skipping live hardware smoke test")
        }
        return url
    }

    private func makeClient(_ baseURL: URL) -> CCAPIClient {
        let session = CCAPIClient.makeInsecureSession(trustingHostOf: baseURL)
        return CCAPIClient(baseURL: baseURL, session: session)
    }

    func testConnectAgainstLiveCamera() async throws {
        let baseURL = try liveBaseURL()
        let client = makeClient(baseURL)
        let inventory = try await client.connect()
        XCTAssertFalse(inventory.versions.isEmpty, "inventory should expose at least one version")
        XCTAssertTrue(
            inventory.supports(path: "/ccapi/ver110/event/polling"),
            "R6 mkII exposes polling at ver110 — decoder should surface it"
        )
    }

    func testDeviceInformationAgainstLiveCamera() async throws {
        let baseURL = try liveBaseURL()
        let client = makeClient(baseURL)
        _ = try await client.connect()
        let info = try await client.deviceInformation()
        XCTAssertFalse(info.manufacturer.isEmpty)
        XCTAssertFalse(info.productname.isEmpty)
        XCTAssertFalse(info.serialnumber.isEmpty)
        print("LIVE · device: \(info.manufacturer) \(info.productname) fw=\(info.firmwareversion ?? "n/a") sn=\(info.serialnumber)")
    }

    func testListStoragesAgainstLiveCamera() async throws {
        let baseURL = try liveBaseURL()
        let client = makeClient(baseURL)
        _ = try await client.connect()
        let storages = try await client.listStorages()
        XCTAssertFalse(storages.isEmpty, "expected at least one storage card")
        for storage in storages {
            XCTAssertFalse(storage.name.isEmpty)
            XCTAssertTrue(storage.path.hasPrefix("/ccapi/"), "storage path should be CCAPI-anchored: \(storage.path)")
            print("LIVE · storage: \(storage.name) at \(storage.path) — \(storage.contentsnumber ?? -1) files")
        }
    }

    func testPollEventsAgainstLiveCamera() async throws {
        let baseURL = try liveBaseURL()
        let client = makeClient(baseURL)
        _ = try await client.connect()
        // Polling is stateful. First call may return a full snapshot; we just
        // need it to decode cleanly (proves CCAPIPollingResponse tolerates
        // whatever fields the camera sends right now).
        let response = try await client.pollEvents()
        print("LIVE · polling: addedcontents=\(response.addedcontents?.count ?? 0) totalContents=\(response.totalContentsCount ?? -1)")
    }

    func testPaginatedContentsWalkAgainstLiveCamera() async throws {
        let baseURL = try liveBaseURL()
        let client = makeClient(baseURL)
        _ = try await client.connect()
        let storages = try await client.listStorages()
        guard let storage = storages.first else {
            XCTFail("no storage on camera; cannot test pagination")
            return
        }
        let directories = try await client.listDirectories(storagePath: storage.path)
        guard let firstDir = directories.first else {
            XCTFail("no DCIM-style directory on card")
            return
        }
        let meta = try await client.listContentsNumber(directoryPath: firstDir)
        XCTAssertGreaterThan(meta.contentsnumber, 0, "card should have at least one file")
        XCTAssertGreaterThanOrEqual(meta.pagenumber, 1)
        // Only walk the first 2 pages to keep the smoke test fast. Enough to
        // prove pagination works; full enumeration is a separate bench test.
        let first200 = try await client.listContents(directoryPath: firstDir, maxPages: 2)
        XCTAssertLessThanOrEqual(first200.count, 200)
        XCTAssertEqual(Set(first200).count, first200.count, "pages should not repeat URLs")
        print("LIVE · pagination: dir=\(firstDir) total=\(meta.contentsnumber) pages=\(meta.pagenumber) fetched=\(first200.count)")
        if let first = first200.first { print("LIVE · first path: \(first)") }
    }
}
