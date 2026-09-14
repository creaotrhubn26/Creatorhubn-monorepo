import XCTest
@testable import CaptureApp

/// Verifies the native Capture → Photo Enhancer storage contract. These tests
/// intentionally assert the provider and endpoint so a future refactor cannot
/// silently route photographer assets back through R2 or Role Room B2.
final class PhotoEnhancerClientTests: XCTestCase {
    private var session: URLSession!
    private let baseURL = URL(string: "https://backend.local/api/photo-enhancer/")!

    override func setUp() {
        super.setUp()
        session = MockURLProtocol.makeSession()
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        session = nil
        super.tearDown()
    }

    private func makeClient() -> PhotoEnhancerClient {
        PhotoEnhancerClient(
            baseURL: baseURL,
            authHeaders: ["Authorization": "Bearer capture-session"],
            session: session
        )
    }

    func testPresignUsesAuthenticatedCreatorHubS3EndpointAndProject() async throws {
        let captured = EnhancerRequestBox()
        MockURLProtocol.handler = { request in
            captured.request = request
            return MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"success":true,"storage":"creatorhub_s3","bucket":"creatorhub-private","key":"organizations/personal-owner/users/owner/projects/project-1/photo-room/enhancer/sources/source/original.cr3","uploadUrl":"https://s3.example/upload"}"#
            )
        }

        let target = try await makeClient().creatorHubPresign(
            fileName: "IMG_0001.CR3",
            contentType: "image/x-canon-cr3",
            projectId: "project-1"
        )

        XCTAssertEqual(target.storage, "creatorhub_s3")
        XCTAssertEqual(target.bucket, "creatorhub-private")
        XCTAssertEqual(captured.request?.url?.path, "/api/photo-enhancer/uploads/creatorhub-presign")
        XCTAssertEqual(captured.request?.value(forHTTPHeaderField: "Authorization"), "Bearer capture-session")
        let json = try JSONSerialization.jsonObject(
            with: try XCTUnwrap(captured.request?.enhancerBodyData() ?? captured.request?.httpBody)
        ) as? [String: Any]
        XCTAssertEqual(json?["projectId"] as? String, "project-1")
    }

    func testQueuedJobDeclaresCreatorHubS3Source() async throws {
        let captured = EnhancerRequestBox()
        MockURLProtocol.handler = { request in
            captured.request = request
            return MockURLProtocol.jsonResponse(
                for: request.url!,
                body: #"{"success":true,"job":{"id":"job-1"}}"#,
                status: 202
            )
        }

        let jobId = try await makeClient().createEnhanceJob(
            bucket: "creatorhub-private",
            key: "organizations/personal-owner/users/owner/projects/project-1/photo-room/enhancer/sources/source/original.cr3",
            fileName: "IMG_0001.CR3",
            mime: "image/x-canon-cr3",
            size: 1_024,
            preset: "auto",
            settings: EnhanceSettings(),
            projectId: "project-1"
        )

        XCTAssertEqual(jobId, "job-1")
        XCTAssertEqual(captured.request?.url?.path, "/api/photo-enhancer/jobs")
        let json = try JSONSerialization.jsonObject(
            with: try XCTUnwrap(captured.request?.enhancerBodyData() ?? captured.request?.httpBody)
        ) as? [String: Any]
        let source = json?["source"] as? [String: Any]
        XCTAssertEqual(source?["storage"] as? String, "creatorhub_s3")
        XCTAssertEqual(source?["bucket"] as? String, "creatorhub-private")
        XCTAssertEqual(json?["projectId"] as? String, "project-1")
    }
}

private final class EnhancerRequestBox: @unchecked Sendable {
    var request: URLRequest?
}

private extension URLRequest {
    func enhancerBodyData() -> Data? {
        guard let stream = httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4_096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
