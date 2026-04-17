import XCTest
@testable import CaptureApp

/// Unit tests for `BackendClient` using `MockURLProtocol`. We verify the
/// encoded request payload + HTTP verb + error mapping without standing
/// up a real backend. Upload PUT ETag extraction and handoff filter
/// encoding are the most fragile bits so they get focused coverage.
final class BackendClientTests: XCTestCase {
    private var session: URLSession!
    private let baseURL = URL(string: "https://backend.local")!

    override func setUp() {
        super.setUp()
        session = MockURLProtocol.makeSession()
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        session = nil
        super.tearDown()
    }

    private func makeClient() -> BackendClient {
        BackendClient(baseURL: baseURL, session: session, authHeaders: ["x-user-id": "owner-1"])
    }

    // MARK: - Sessions

    func testCreateSessionPostsJSONAndDecodesResponse() async throws {
        let captured = Box<URLRequest>()
        MockURLProtocol.handler = { request in
            captured.value = request
            let body = """
            {"id":"c4f5d4f4-58f9-41c8-a6b8-a3c3ae8a5db6","name":"Shoot","status":"active","ownerUserId":"owner-1","createdAt":"2026-04-17T10:00:00Z"}
            """
            return MockURLProtocol.jsonResponse(for: request.url!, body: body)
        }
        let client = makeClient()
        let session = try await client.createSession(
            .init(name: "Shoot", clientId: nil, startsAt: Date(timeIntervalSince1970: 0))
        )
        XCTAssertEqual(session.id, "c4f5d4f4-58f9-41c8-a6b8-a3c3ae8a5db6")
        XCTAssertEqual(captured.value?.httpMethod, "POST")
        XCTAssertEqual(captured.value?.value(forHTTPHeaderField: "x-user-id"), "owner-1")
        XCTAssertEqual(captured.value?.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertEqual(captured.value?.url?.path, "/api/capture/sessions")
    }

    func testCreateSessionBodyUsesISO8601WithFractionalSeconds() async throws {
        let capturedBody = Box<Data>()
        MockURLProtocol.handler = { request in
            capturedBody.value = request.httpBodyStreamData() ?? request.httpBody
            return MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"id":"00000000-0000-0000-0000-000000000000","name":"x","status":"active","ownerUserId":"owner-1","createdAt":"2026-04-17T10:00:00Z"}"#
            )
        }
        let client = makeClient()
        _ = try await client.createSession(
            .init(name: "x", clientId: nil, startsAt: Date(timeIntervalSince1970: 1_713_350_400))
        )
        let json = try JSONSerialization.jsonObject(
            with: try XCTUnwrap(capturedBody.value)
        ) as? [String: Any]
        XCTAssertEqual(json?["name"] as? String, "x")
        let startsAt = json?["startsAt"] as? String ?? ""
        XCTAssertTrue(startsAt.contains("2024-04-17"), "got \(startsAt)")  // ISO-8601
        XCTAssertTrue(startsAt.contains("."), "expected fractional seconds, got \(startsAt)")
    }

    // MARK: - Upload flow

    func testStartUploadDecodesPlan() async throws {
        MockURLProtocol.handler = { request in
            MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"bucket":"capture","key":"owner/asset/preview","uploadId":"u1","partSize":5000000,"partCount":1,"signedUrlTtlSeconds":900,"partUrlBatchMax":25}"#
            )
        }
        let client = makeClient()
        let plan = try await client.startUpload(
            assetId: UUID(),
            body: .init(kind: .preview, sizeBytes: 1024, mime: "image/jpeg", preferredPartSize: nil)
        )
        XCTAssertEqual(plan.uploadId, "u1")
        XCTAssertEqual(plan.partCount, 1)
        XCTAssertEqual(plan.partSize, 5_000_000)
    }

    func testPutPartReturnsEtag() async throws {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: ["ETag": "\"abc123\""]
            )!
            return (response, Data())
        }
        let client = makeClient()
        let etag = try await client.putPart(
            url: URL(string: "https://r2.example.com/part-1")!,
            bytes: Data("payload".utf8)
        )
        XCTAssertEqual(etag, "\"abc123\"")
    }

    func testPutPartThrowsWhenEtagMissing() async throws {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [:]
            )!
            return (response, Data())
        }
        let client = makeClient()
        do {
            _ = try await client.putPart(
                url: URL(string: "https://r2.example.com/part-1")!,
                bytes: Data("payload".utf8)
            )
            XCTFail("expected decode error")
        } catch BackendError.decode {
            // expected
        }
    }

    // MARK: - Handoff filter encoding

    func testHandoffFilterEncodesIdsKind() async throws {
        let assetId = UUID()
        let capturedBody = Box<Data>()
        MockURLProtocol.handler = { request in
            capturedBody.value = request.httpBodyStreamData() ?? request.httpBody
            return MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"handoffId":"h1","requestedCount":1,"submittedCount":1,"jobs":[]}"#
            )
        }
        let client = makeClient()
        _ = try await client.handoff(
            sessionId: UUID(),
            body: .init(preset: .portrait, filter: .ids([assetId]), preferredSource: .full)
        )
        let json = try JSONSerialization.jsonObject(
            with: try XCTUnwrap(capturedBody.value)
        ) as? [String: Any]
        let filter = json?["filter"] as? [String: Any]
        XCTAssertEqual(filter?["kind"] as? String, "ids")
        XCTAssertEqual((filter?["assetIds"] as? [String])?.first, assetId.uuidString.lowercased())
        XCTAssertEqual(json?["preset"] as? String, "portrait")
    }

    func testHandoffFilterEncodesFlaggedKind() async throws {
        let capturedBody = Box<Data>()
        MockURLProtocol.handler = { request in
            capturedBody.value = request.httpBodyStreamData() ?? request.httpBody
            return MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"handoffId":"h1","requestedCount":0,"submittedCount":0,"jobs":[]}"#
            )
        }
        let client = makeClient()
        _ = try await client.handoff(
            sessionId: UUID(),
            body: .init(preset: nil, filter: .flagged, preferredSource: nil)
        )
        let json = try JSONSerialization.jsonObject(
            with: try XCTUnwrap(capturedBody.value)
        ) as? [String: Any]
        let filter = json?["filter"] as? [String: Any]
        XCTAssertEqual(filter?["kind"] as? String, "flagged")
        XCTAssertNil(filter?["assetIds"])
    }

    func testHandoffFilterEncodesRatingKind() async throws {
        let capturedBody = Box<Data>()
        MockURLProtocol.handler = { request in
            capturedBody.value = request.httpBodyStreamData() ?? request.httpBody
            return MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"handoffId":"h1","requestedCount":0,"submittedCount":0,"jobs":[]}"#
            )
        }
        let client = makeClient()
        _ = try await client.handoff(
            sessionId: UUID(),
            body: .init(preset: nil, filter: .ratingAtLeast(4), preferredSource: nil)
        )
        let json = try JSONSerialization.jsonObject(
            with: try XCTUnwrap(capturedBody.value)
        ) as? [String: Any]
        let filter = json?["filter"] as? [String: Any]
        XCTAssertEqual(filter?["kind"] as? String, "rating_at_least")
        XCTAssertEqual(filter?["rating"] as? Int, 4)
    }

    // MARK: - Error mapping

    func testUnauthorizedMapsTo401Error() async throws {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: "HTTP/1.1", headerFields: nil)!
            return (response, Data("{\"error\":\"unauthorized\"}".utf8))
        }
        let client = makeClient()
        do {
            _ = try await client.createSession(.init(name: "x", clientId: nil, startsAt: Date()))
            XCTFail("expected unauthorized")
        } catch BackendError.unauthorized {
            // expected
        }
    }

    func testNotFoundMapsTo404Error() async throws {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!
            return (response, Data())
        }
        let client = makeClient()
        do {
            _ = try await client.handoff(sessionId: UUID(), body: .init(preset: nil, filter: .flagged, preferredSource: nil))
            XCTFail("expected notFound")
        } catch BackendError.notFound {
            // expected
        }
    }

    func testServerErrorSurfacesStatusAndBody() async throws {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: "HTTP/1.1", headerFields: nil)!
            return (response, Data("boom".utf8))
        }
        let client = makeClient()
        do {
            _ = try await client.createSession(.init(name: "x", clientId: nil, startsAt: Date()))
            XCTFail("expected httpStatus")
        } catch let BackendError.httpStatus(code, body) {
            XCTAssertEqual(code, 500)
            XCTAssertEqual(body, "boom")
        }
    }
}

/// Sendable reference holder so closures can "return" values to the test
/// under Swift 6 strict concurrency without violating capture semantics.
private final class Box<T>: @unchecked Sendable {
    var value: T?
}

// MARK: - URLRequest body stream helper

private extension URLRequest {
    /// URLSession with URLProtocol rehydrates the request and Content-Length,
    /// but may move the body into `httpBodyStream`. Drain if needed so tests
    /// can inspect whichever path the stack took.
    func httpBodyStreamData() -> Data? {
        guard let stream = httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buf = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let read = stream.read(&buf, maxLength: buf.count)
            if read <= 0 { break }
            data.append(buf, count: read)
        }
        return data
    }
}
