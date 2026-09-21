import Foundation
import XCTest
@testable import CaptureApp

final class BackgroundMultipartUploaderTests: XCTestCase {
    private final class RequestRecorder: @unchecked Sendable {
        private let lock = NSLock()
        private var bodies: [Data] = []

        func append(_ data: Data) {
            lock.lock()
            bodies.append(data)
            lock.unlock()
        }

        func snapshot() -> [Data] {
            lock.lock()
            defer { lock.unlock() }
            return bodies
        }
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    func testCopyRangeCreatesExactFileSlice() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("background-part-slice-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appendingPathComponent("source.raw")
        let destination = directory.appendingPathComponent("parts/part-2")
        try Data("0123456789".utf8).write(to: source)

        try BackgroundMultipartUploader.copyRange(
            from: source,
            offset: 3,
            length: 4,
            to: destination
        )

        XCTAssertEqual(try Data(contentsOf: destination), Data("3456".utf8))
    }

    func testReceiptPreventsDuplicatePutUntilSQLiteAcknowledgesPart() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("background-part-receipt-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appendingPathComponent("source.raw")
        try Data("abcdefghij".utf8).write(to: source)

        let recorder = RequestRecorder()
        MockURLProtocol.handler = { request in
            recorder.append(Self.bodyData(from: request) ?? Data())
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: ["ETag": "part-etag"],
            )!
            return (response, Data())
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let uploader = BackgroundMultipartUploader(
            configuration: configuration,
            rootDirectory: directory.appendingPathComponent("state", isDirectory: true)
        )
        let destination = URL(string: "https://s3.example/upload-part")!

        let first = try await uploader.uploadPart(
            sourceFile: source,
            offset: 2,
            length: 5,
            destination: destination,
            checkpointId: "asset:raw",
            partNumber: 1
        )
        let fromReceipt = try await uploader.uploadPart(
            sourceFile: source,
            offset: 2,
            length: 5,
            destination: destination,
            checkpointId: "asset:raw",
            partNumber: 1
        )

        XCTAssertEqual(first, "part-etag")
        XCTAssertEqual(fromReceipt, "part-etag")
        XCTAssertEqual(recorder.snapshot(), [Data("cdefg".utf8)])

        await uploader.acknowledgePart(checkpointId: "asset:raw", partNumber: 1)
        _ = try await uploader.uploadPart(
            sourceFile: source,
            offset: 2,
            length: 5,
            destination: destination,
            checkpointId: "asset:raw",
            partNumber: 1
        )
        XCTAssertEqual(recorder.snapshot().count, 2)
    }

    private static func bodyData(from request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var result = Data()
        var buffer = [UInt8](repeating: 0, count: 4_096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else { break }
            result.append(buffer, count: count)
        }
        return result
    }
}
