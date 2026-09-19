import CryptoKit
import Foundation
import XCTest
@testable import CaptureApp

final class DeliveryServiceTests: XCTestCase {
    private actor ExpiredThenSuccessfulPartUploader: MultipartPartUploading {
        private var uploadAttempts = 0

        func uploadPart(
            sourceFile: URL,
            offset: Int64,
            length: Int64,
            destination: URL,
            checkpointId: String,
            partNumber: Int
        ) async throws -> String {
            uploadAttempts += 1
            if uploadAttempts == 1 {
                throw BackgroundMultipartUploader.UploadError.httpStatus(404)
            }
            return "replacement-etag"
        }

        func acknowledgePart(checkpointId: String, partNumber: Int) async {}

        func attemptCount() -> Int { uploadAttempts }
    }

    private final class Recorder: @unchecked Sendable {
        private let lock = NSLock()
        private var requests: [(method: String, path: String, body: Data?)] = []
        private var didFailPartTwo = false

        func append(_ request: URLRequest, body: Data?) {
            lock.lock()
            requests.append((request.httpMethod ?? "", request.url?.path ?? "", body))
            lock.unlock()
        }

        func snapshot() -> [(method: String, path: String, body: Data?)] {
            lock.lock()
            defer { lock.unlock() }
            return requests
        }

        func consumePartTwoFailure() -> Bool {
            lock.lock()
            defer { lock.unlock() }
            guard !didFailPartTwo else { return false }
            didFailPartTwo = true
            return true
        }
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    func testCardBackupUploadsBothJPEGAndRAWOnOneAssetAfterProjectLink() async throws {
        let sessionId = "00000000-0000-4000-8000-000000000010"
        let assetId = "00000000-0000-4000-8000-000000000020"
        let recorder = Recorder()
        let session = MockURLProtocol.makeSession()
        MockURLProtocol.handler = { request in
            let requestBody = request.capturedBodyData()
            recorder.append(request, body: requestBody)
            let path = request.url!.path

            if request.httpMethod == "PUT" {
                let response = HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1",
                    headerFields: ["ETag": "etag-\(request.url!.lastPathComponent)"],
                )!
                return (response, Data())
            }
            if path == "/api/capture/sessions" {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"\(sessionId)","name":"Card","status":"active","ownerUserId":"owner","createdAt":"2026-09-19T10:00:00Z","startsAt":null,"endsAt":null}
                """, status: 201)
            }
            if path.hasSuffix("/project") {
                return MockURLProtocol.binaryResponse(for: request.url!, body: Data(), status: 204)
            }
            if path.hasSuffix("/assets") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"\(assetId)","sessionId":"\(sessionId)","originalFilename":"IMG_1.JPG","mime":"image/jpeg","sizeBytes":5,"previewKey":null,"fullKey":null,"rawKey":null,"state":"registered","checksumSha256":null,"previewUrl":null,"rating":null,"flaggedForClient":null,"rejected":null}
                """, status: 201)
            }
            if path.hasSuffix("/upload/start") {
                let json = try JSONSerialization.jsonObject(with: requestBody ?? Data()) as! [String: Any]
                let kind = json["kind"] as! String
                let size = json["sizeBytes"] as! Int
                let count = Int(ceil(Double(size) / 3.0))
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"bucket":"creatorhub-private","key":"k/\(kind)","uploadId":"upload-\(kind)","partSize":3,"partCount":\(count),"signedUrlTtlSeconds":900,"partUrlBatchMax":2}
                """)
            }
            if path.hasSuffix("/upload/parts") {
                let json = try JSONSerialization.jsonObject(with: requestBody ?? Data()) as! [String: Any]
                let numbers = json["partNumbers"] as! [Int]
                let parts = numbers.map { ["partNumber": $0, "url": "https://s3.example/part-\($0)-\(UUID().uuidString)"] as [String: Any] }
                let body = try JSONSerialization.data(withJSONObject: ["parts": parts, "expiresInSeconds": 900])
                return MockURLProtocol.jsonResponse(for: request.url!, body: String(decoding: body, as: UTF8.self))
            }
            if path.hasSuffix("/upload/complete") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"\(assetId)","sessionId":"\(sessionId)","originalFilename":"IMG_1.JPG","mime":"image/jpeg","sizeBytes":5,"previewKey":null,"fullKey":"full","rawKey":"raw","state":"ready","checksumSha256":null,"previewUrl":null,"rating":null,"flaggedForClient":null,"rejected":null}
                """)
            }
            if path.hasSuffix("/client-tokens") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"token-id","token":"secret","clientLabel":null,"expiresAt":"2026-09-20T10:00:00Z","hasPin":false}
                """, status: 201)
            }
            throw URLError(.badServerResponse)
        }

        let temp = FileManager.default.temporaryDirectory
            .appendingPathComponent("delivery-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: temp) }
        let jpeg = temp.appendingPathComponent("IMG_1.JPG")
        let raw = temp.appendingPathComponent("IMG_1.CR3")
        try Data("abcde".utf8).write(to: jpeg)
        try Data("1234567".utf8).write(to: raw)

        let localId = UUID()
        let backend = BackendClient(
            baseURL: URL(string: "https://creatorhub.example")!,
            session: session,
            authHeaders: ["Authorization": "Bearer token"],
        )
        let delivery = DeliveryService(backend: backend)
        let result = try await delivery.backupCard(
            sessionName: "Card",
            sessionStartedAt: Date(),
            items: [
                .init(localId: localId, originalFilename: "IMG_1.JPG", captureTime: Date(), mime: "image/jpeg", path: jpeg.path, kind: .full),
                .init(localId: localId, originalFilename: "IMG_1.CR3", captureTime: Date(), mime: "image/x-canon-cr3", path: raw.path, kind: .raw),
            ],
            projectId: "project-creatorhub",
        )

        XCTAssertEqual(result.uploadedCount, 2)
        let requests = recorder.snapshot()
        XCTAssertEqual(requests.filter { $0.path.hasSuffix("/assets") }.count, 1)
        XCTAssertEqual(requests.filter { $0.path.hasSuffix("/upload/start") }.count, 2)
        let linkIndex = try XCTUnwrap(requests.firstIndex { $0.path.hasSuffix("/project") })
        let uploadIndex = try XCTUnwrap(requests.firstIndex { $0.path.hasSuffix("/upload/start") })
        XCTAssertLessThan(linkIndex, uploadIndex, "project link must precede S3 key allocation")

        let completeBodies = requests
            .filter { $0.path.hasSuffix("/upload/complete") }
            .compactMap(\.body)
            .compactMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        XCTAssertEqual(Set(completeBodies.compactMap { $0["kind"] as? String }), Set(["full", "raw"]))
        let expectedChecksums = Set([Data("abcde".utf8), Data("1234567".utf8)].map {
            SHA256.hash(data: $0).map { String(format: "%02x", $0) }.joined()
        })
        XCTAssertEqual(Set(completeBodies.compactMap { $0["checksumSha256"] as? String }), expectedChecksums)
    }

    func testCardBackupResumesPersistedMultipartAfterNewServiceInstance() async throws {
        let backendSessionId = "00000000-0000-4000-8000-000000000110"
        let backendAssetId = "00000000-0000-4000-8000-000000000120"
        let recorder = Recorder()
        let session = MockURLProtocol.makeSession()
        MockURLProtocol.handler = { request in
            let body = request.capturedBodyData()
            recorder.append(request, body: body)
            let path = request.url!.path

            if request.httpMethod == "PUT" {
                if path == "/resume-part-2", recorder.consumePartTwoFailure() {
                    throw URLError(.networkConnectionLost)
                }
                let response = HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1",
                    headerFields: ["ETag": "etag-\(request.url!.lastPathComponent)"],
                )!
                return (response, Data())
            }
            if path == "/api/capture/sessions" {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"\(backendSessionId)","name":"Restart","status":"active","ownerUserId":"owner","createdAt":"2026-09-19T10:00:00Z","startsAt":null,"endsAt":null}
                """, status: 201)
            }
            if path.hasSuffix("/project") {
                return MockURLProtocol.binaryResponse(for: request.url!, body: Data(), status: 204)
            }
            if path.hasSuffix("/assets") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"\(backendAssetId)","sessionId":"\(backendSessionId)","originalFilename":"IMG_2.CR3","mime":"image/x-canon-cr3","sizeBytes":7,"previewKey":null,"fullKey":null,"rawKey":null,"state":"registered","checksumSha256":null,"previewUrl":null,"rating":null,"flaggedForClient":null,"rejected":null}
                """, status: 201)
            }
            if path.hasSuffix("/upload/start") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"bucket":"creatorhub-private","key":"resume/raw","uploadId":"upload-restart","partSize":3,"partCount":3,"signedUrlTtlSeconds":900,"partUrlBatchMax":3}
                """)
            }
            if path.hasSuffix("/upload/parts") {
                let json = try JSONSerialization.jsonObject(with: body ?? Data()) as! [String: Any]
                let numbers = json["partNumbers"] as! [Int]
                let parts = numbers.map {
                    ["partNumber": $0, "url": "https://s3.example/resume-part-\($0)"] as [String: Any]
                }
                let encoded = try JSONSerialization.data(withJSONObject: ["parts": parts, "expiresInSeconds": 900])
                return MockURLProtocol.jsonResponse(
                    for: request.url!,
                    body: String(decoding: encoded, as: UTF8.self),
                )
            }
            if path.hasSuffix("/upload/complete") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"\(backendAssetId)","sessionId":"\(backendSessionId)","originalFilename":"IMG_2.CR3","mime":"image/x-canon-cr3","sizeBytes":7,"previewKey":null,"fullKey":null,"rawKey":"resume/raw","state":"ready","checksumSha256":null,"previewUrl":null,"rating":null,"flaggedForClient":null,"rejected":null}
                """)
            }
            if path.hasSuffix("/client-tokens") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"token-id","token":"secret","clientLabel":null,"expiresAt":"2026-09-20T10:00:00Z","hasPin":false}
                """, status: 201)
            }
            throw URLError(.badServerResponse)
        }

        let temp = FileManager.default.temporaryDirectory
            .appendingPathComponent("delivery-resume-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: temp) }
        let raw = temp.appendingPathComponent("IMG_2.CR3")
        try Data("1234567".utf8).write(to: raw)

        let database = try AppDatabase.inMemory()
        let store = PersistentUploadStore(database: database)
        let localId = UUID()
        let item = DeliveryService.CardBackupItem(
            localId: localId,
            originalFilename: "IMG_2.CR3",
            captureTime: Date(),
            mime: "image/x-canon-cr3",
            path: raw.path,
            kind: .raw,
        )
        let backend = BackendClient(
            baseURL: URL(string: "https://creatorhub.example")!,
            session: session,
            authHeaders: ["Authorization": "Bearer token"],
        )

        do {
            _ = try await DeliveryService(backend: backend, uploadStore: store).backupCard(
                sessionName: "Restart",
                sessionStartedAt: Date(),
                items: [item],
                projectId: "project-creatorhub",
            )
            XCTFail("first attempt should stop on the simulated network loss")
        } catch {
            // Expected: part 1 is durable, part 2 failed.
        }

        let interrupted = try await store.checkpoint(localAssetId: localId, kind: .raw)
        XCTAssertEqual(interrupted?.uploadId, "upload-restart")
        XCTAssertEqual(interrupted?.completedParts.map(\.partNumber), [1])

        // A fresh actor models a full process relaunch. It must recover the
        // backend ids and continue at part 2 from the same SQLite database.
        let result = try await DeliveryService(backend: backend, uploadStore: store).backupCard(
            sessionName: "Restart",
            sessionStartedAt: Date(),
            items: [item],
            projectId: "project-creatorhub",
        )
        XCTAssertEqual(result.uploadedCount, 1)

        let requests = recorder.snapshot()
        XCTAssertEqual(requests.filter { $0.path == "/api/capture/sessions" }.count, 1)
        XCTAssertEqual(requests.filter { $0.path.hasSuffix("/assets") }.count, 1)
        XCTAssertEqual(requests.filter { $0.path.hasSuffix("/upload/start") }.count, 1)
        XCTAssertEqual(requests.filter { $0.path == "/resume-part-1" }.count, 1)
        XCTAssertEqual(requests.filter { $0.path == "/resume-part-2" }.count, 2)
        XCTAssertEqual(requests.filter { $0.path == "/resume-part-3" }.count, 1)
        XCTAssertEqual(requests.filter { $0.path.hasSuffix("/upload/complete") }.count, 1)
        let completedCheckpoint = try await store.checkpoint(localAssetId: localId, kind: .raw)
        XCTAssertEqual(completedCheckpoint?.status, "completed")
    }

    func testCardBackupReplacesExpiredBackgroundMultipartUpload() async throws {
        let backendSessionId = UUID(uuidString: "00000000-0000-4000-8000-000000000210")!
        let backendAssetId = UUID(uuidString: "00000000-0000-4000-8000-000000000220")!
        let recorder = Recorder()
        let session = MockURLProtocol.makeSession()
        MockURLProtocol.handler = { request in
            let body = request.capturedBodyData()
            recorder.append(request, body: body)
            let path = request.url!.path

            if path.hasSuffix("/upload/start") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"bucket":"creatorhub-private","key":"replacement/raw","uploadId":"replacement-upload","partSize":3,"partCount":1,"signedUrlTtlSeconds":900,"partUrlBatchMax":1}
                """)
            }
            if path.hasSuffix("/upload/parts") {
                let requestJSON = try JSONSerialization.jsonObject(with: body ?? Data()) as! [String: Any]
                let uploadId = requestJSON["uploadId"] as! String
                let signedURL = uploadId == "stale-upload"
                    ? "https://s3.example/stale-part-1"
                    : "https://s3.example/replacement-part-1"
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"parts":[{"partNumber":1,"url":"\(signedURL)"}],"expiresInSeconds":900}
                """)
            }
            if path.hasSuffix("/upload/complete") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"\(backendAssetId.uuidString.lowercased())","sessionId":"\(backendSessionId.uuidString.lowercased())","originalFilename":"IMG_4.CR3","mime":"image/x-canon-cr3","sizeBytes":3,"previewKey":null,"fullKey":null,"rawKey":"replacement/raw","state":"ready","checksumSha256":null,"previewUrl":null,"rating":null,"flaggedForClient":null,"rejected":null}
                """)
            }
            if path.hasSuffix("/client-tokens") {
                return MockURLProtocol.jsonResponse(for: request.url!, body: """
                {"id":"token-id","token":"secret","clientLabel":null,"expiresAt":"2026-09-20T10:00:00Z","hasPin":false}
                """, status: 201)
            }
            throw URLError(.badServerResponse)
        }

        let temp = FileManager.default.temporaryDirectory
            .appendingPathComponent("delivery-expired-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: temp) }
        let raw = temp.appendingPathComponent("IMG_4.CR3")
        let bytes = Data("raw".utf8)
        try bytes.write(to: raw)
        let checksum = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()

        let database = try AppDatabase.inMemory()
        let store = PersistentUploadStore(database: database)
        let localId = UUID()
        _ = try await store.prepare(
            localAssetId: localId,
            backendAssetId: backendAssetId,
            backendSessionId: backendSessionId,
            kind: .raw,
            localPath: raw.path,
            mime: "image/x-canon-cr3",
            sizeBytes: Int64(bytes.count),
            checksumSha256: checksum
        )
        try await store.savePlan(
            localAssetId: localId,
            kind: .raw,
            plan: BackendUploadPlan(
                bucket: "creatorhub-private",
                key: "stale/raw",
                uploadId: "stale-upload",
                partSize: 3,
                partCount: 1,
                signedUrlTtlSeconds: 900,
                partUrlBatchMax: 1
            )
        )

        let backend = BackendClient(
            baseURL: URL(string: "https://creatorhub.example")!,
            session: session,
            authHeaders: ["Authorization": "Bearer token"]
        )
        let uploader = ExpiredThenSuccessfulPartUploader()
        let delivery = DeliveryService(
            backend: backend,
            uploadStore: store,
            partUploader: uploader
        )
        let result = try await delivery.backupCard(
            sessionName: "Resume expired",
            sessionStartedAt: Date(),
            items: [
                .init(
                    localId: localId,
                    originalFilename: "IMG_4.CR3",
                    captureTime: Date(),
                    mime: "image/x-canon-cr3",
                    path: raw.path,
                    kind: .raw
                )
            ],
            projectId: nil
        )

        let requests = recorder.snapshot()
        let signBodies = requests
            .filter { $0.path.hasSuffix("/upload/parts") }
            .compactMap(\.body)
            .compactMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        let signedUploadIds = signBodies.compactMap { $0["uploadId"] as? String }
        let uploadAttempts = await uploader.attemptCount()
        let checkpoint = try await store.checkpoint(localAssetId: localId, kind: .raw)

        XCTAssertEqual(result.uploadedCount, 1)
        XCTAssertEqual(signedUploadIds, ["stale-upload", "replacement-upload"])
        XCTAssertEqual(requests.filter { $0.path.hasSuffix("/upload/start") }.count, 1)
        XCTAssertEqual(requests.filter { $0.path.hasSuffix("/upload/complete") }.count, 1)
        XCTAssertEqual(uploadAttempts, 2)
        XCTAssertEqual(checkpoint?.uploadId, "replacement-upload")
        XCTAssertEqual(checkpoint?.status, "completed")
    }

    func testCardBackupJobRoundTripsAndDeletes() async throws {
        let database = try AppDatabase.inMemory()
        let store = CardBackupJobStore(database: database)
        let jobId = UUID()
        let item = DeliveryService.CardBackupItem(
            localId: UUID(),
            originalFilename: "IMG_3.JPG",
            captureTime: Date(timeIntervalSince1970: 123),
            mime: "image/jpeg",
            path: "/tmp/IMG_3.JPG",
            kind: .full,
        )
        let expected = CardBackupJobStore.Job(
            id: jobId,
            ownerUserId: "owner-1",
            sessionName: "Kort-import",
            sessionStartedAt: Date(timeIntervalSince1970: 456),
            projectId: "project-1",
            projectTitle: "Bryllup",
            items: [item],
            assetCount: 1,
            duplicateCount: 2,
        )
        try await store.save(expected)
        let restored = try await store.latestPending(ownerUserId: "owner-1")
        let otherOwner = try await store.latestPending(ownerUserId: "other-owner")
        XCTAssertEqual(restored, expected)
        XCTAssertNil(otherOwner)
        try await store.delete(id: jobId)
        let deleted = try await store.latestPending(ownerUserId: "owner-1")
        XCTAssertNil(deleted)
    }
}

private extension URLRequest {
    func capturedBodyData() -> Data? {
        if let httpBody { return httpBody }
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
