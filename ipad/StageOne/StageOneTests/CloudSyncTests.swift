import XCTest
@testable import StageOne

final class CloudSyncTests: XCTestCase {
    func testShouldPullDecision() {
        let now = Date()
        // ingen remote → aldri pull
        XCTAssertFalse(CloudSync.shouldPull(remoteUpdated: nil, localSaved: now))
        // remote finnes, ingen lokal → pull
        XCTAssertTrue(CloudSync.shouldPull(remoteUpdated: now, localSaved: nil))
        // remote klart nyere → pull
        XCTAssertTrue(CloudSync.shouldPull(remoteUpdated: now, localSaved: now.addingTimeInterval(-10)))
        // remote eldre eller ~samtidig (innenfor 2s-slingring) → ikke pull
        XCTAssertFalse(CloudSync.shouldPull(remoteUpdated: now.addingTimeInterval(-10), localSaved: now))
        XCTAssertFalse(CloudSync.shouldPull(remoteUpdated: now.addingTimeInterval(1), localSaved: now))
    }

    func testRequestBuilder() {
        let req = CloudAPI.request(baseURLString: "https://example.com",
                                   path: "/api/stageone/scenes/default",
                                   method: "PUT", token: "tok123", body: Data("{}".utf8))
        XCTAssertEqual(req.url?.absoluteString, "https://example.com/api/stageone/scenes/default")
        XCTAssertEqual(req.httpMethod, "PUT")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer tok123")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Content-Type"), "application/json")
        let anon = CloudAPI.request(baseURLString: "https://example.com", path: "/x",
                                    method: "GET", token: nil, body: nil)
        XCTAssertNil(anon.value(forHTTPHeaderField: "Authorization"))
    }

    func testDateParsing() {
        XCTAssertNotNil(CloudAPI.parseDate("2026-08-07T12:00:00.123Z"))
        XCTAssertNotNil(CloudAPI.parseDate("2026-08-07T12:00:00Z"))
        XCTAssertNil(CloudAPI.parseDate("ikke-en-dato"))
    }

    func testSceneDataSurvivesCloudEncoding() throws {
        // PUT-body-formen { name, data } → data dekoder tilbake til identisk scene
        struct Body: Codable { let name: String; let data: SceneData }
        let scene = DefaultScene.make()
        let encoded = try JSONEncoder().encode(Body(name: "Test", data: scene))
        let decoded = try JSONDecoder().decode(Body.self, from: encoded)
        XCTAssertEqual(decoded.data, scene)
    }

    func testAuthStoreRoundtrip() {
        AuthStore.saveSession(token: "test-token-123", email: "test@example.com")
        XCTAssertEqual(AuthStore.token, "test-token-123")
        XCTAssertEqual(AuthStore.email, "test@example.com")
        AuthStore.clear()
        XCTAssertNil(AuthStore.token)
        XCTAssertNil(AuthStore.email)
    }
}
