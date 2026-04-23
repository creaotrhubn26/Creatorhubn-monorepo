import XCTest
@testable import CaptureApp

/// Tests for ``DriveResponseParser``. Drive's API is stable but its
/// JSON shape varies subtly by endpoint (``size`` is a string for
/// some files, an int for others; ``Range`` headers may be absent
/// after a 308), so the parser needs to tolerate each documented
/// shape without crashing.
final class DriveResponseParserTests: XCTestCase {

    // MARK: - parseFile

    func testParsesAllFields() throws {
        let json = """
        {"id":"abc","name":"raw.cr3","mimeType":"image/x-canon-cr3","size":"42000000","webViewLink":"https://drive.google.com/x"}
        """.data(using: .utf8)!
        let file = try XCTUnwrap(DriveResponseParser.parseFile(json))
        XCTAssertEqual(file.id, "abc")
        XCTAssertEqual(file.name, "raw.cr3")
        XCTAssertEqual(file.mimeType, "image/x-canon-cr3")
        XCTAssertEqual(file.size, 42_000_000)
        XCTAssertEqual(file.webViewLink?.absoluteString, "https://drive.google.com/x")
    }

    func testParsesSizeAsNumber() throws {
        // Older Drive responses return size as a number. Drive now
        // returns a string, but we keep tolerance so a rollback
        // doesn't break us.
        let json = """
        {"id":"a","name":"n","mimeType":"image/jpeg","size":1234}
        """.data(using: .utf8)!
        let file = try XCTUnwrap(DriveResponseParser.parseFile(json))
        XCTAssertEqual(file.size, 1234)
    }

    func testNilSizeForFolders() throws {
        let json = """
        {"id":"a","name":"n","mimeType":"application/vnd.google-apps.folder"}
        """.data(using: .utf8)!
        let file = try XCTUnwrap(DriveResponseParser.parseFile(json))
        XCTAssertNil(file.size)
        XCTAssertTrue(file.isFolder)
    }

    func testReturnsNilOnMalformedJSON() {
        XCTAssertNil(DriveResponseParser.parseFile(Data("not-json".utf8)))
    }

    func testReturnsNilWhenRequiredFieldMissing() {
        let missingId = #"{"name":"x","mimeType":"image/jpeg"}"#.data(using: .utf8)!
        XCTAssertNil(DriveResponseParser.parseFile(missingId))
        let missingMime = #"{"id":"x","name":"x"}"#.data(using: .utf8)!
        XCTAssertNil(DriveResponseParser.parseFile(missingMime))
    }

    // MARK: - parseFileList

    func testParsesFileList() {
        let json = """
        {"files":[
          {"id":"a","name":"x","mimeType":"image/jpeg","size":"1"},
          {"id":"b","name":"y","mimeType":"image/jpeg","size":"2"}
        ]}
        """.data(using: .utf8)!
        let files = DriveResponseParser.parseFileList(json)
        XCTAssertEqual(files.count, 2)
        XCTAssertEqual(files[0].id, "a")
        XCTAssertEqual(files[1].id, "b")
    }

    func testEmptyFileListReturnsEmpty() {
        let json = Data(#"{"files":[]}"#.utf8)
        XCTAssertEqual(DriveResponseParser.parseFileList(json).count, 0)
    }

    func testMissingFilesKeyReturnsEmpty() {
        let json = Data("{}".utf8)
        XCTAssertEqual(DriveResponseParser.parseFileList(json).count, 0)
    }

    func testSkipsMalformedEntriesInList() {
        let json = """
        {"files":[
          {"id":"a","name":"ok","mimeType":"image/jpeg"},
          {"name":"broken-no-id","mimeType":"image/jpeg"}
        ]}
        """.data(using: .utf8)!
        let files = DriveResponseParser.parseFileList(json)
        XCTAssertEqual(files.count, 1)
        XCTAssertEqual(files[0].id, "a")
    }

    // MARK: - Session URL

    func testParsesResumableSessionURLFromLocationHeader() throws {
        let response = HTTPURLResponse(
            url: URL(string: "https://www.googleapis.com/upload/drive/v3/files")!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Location": "https://upload.example/s/xyz"],
        )!
        let url = DriveResponseParser.parseResumableSessionURL(from: response)
        XCTAssertEqual(url?.absoluteString, "https://upload.example/s/xyz")
    }

    func testParsesSessionURLFromLowercaseHeader() throws {
        // Some URLSession backends lowercase the header keys when
        // building the HTTPURLResponse — the parser must tolerate it.
        let response = HTTPURLResponse(
            url: URL(string: "https://www.googleapis.com/upload/drive/v3/files")!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["location": "https://upload.example/s/xyz"],
        )!
        XCTAssertNotNil(DriveResponseParser.parseResumableSessionURL(from: response))
    }

    func testReturnsNilWhenLocationHeaderMissing() throws {
        let response = HTTPURLResponse(
            url: URL(string: "https://x")!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: [:],
        )!
        XCTAssertNil(DriveResponseParser.parseResumableSessionURL(from: response))
    }

    // MARK: - Chunk progress

    func testParsesChunkProgressFromRangeHeader() {
        let response = HTTPURLResponse(
            url: URL(string: "https://upload.example")!,
            statusCode: 308,
            httpVersion: nil,
            headerFields: ["Range": "bytes=0-1048575"],
        )!
        let progress = DriveResponseParser.parseChunkProgress(from: response)
        XCTAssertEqual(progress.lastByteReceived, 1_048_575)
        XCTAssertEqual(progress.nextByteToSend, 1_048_576)
    }

    func testProgressLowercaseHeaderIsAccepted() {
        let response = HTTPURLResponse(
            url: URL(string: "https://upload.example")!,
            statusCode: 308,
            httpVersion: nil,
            headerFields: ["range": "bytes=0-2097151"],
        )!
        XCTAssertEqual(
            DriveResponseParser.parseChunkProgress(from: response).lastByteReceived,
            2_097_151,
        )
    }

    func testProgressMissingRangeMeansNoBytesReceived() {
        // Drive returns 308 with no Range when it hasn't accepted
        // anything yet. We treat that as "resume from byte 0".
        let response = HTTPURLResponse(
            url: URL(string: "https://upload.example")!,
            statusCode: 308,
            httpVersion: nil,
            headerFields: [:],
        )!
        let progress = DriveResponseParser.parseChunkProgress(from: response)
        XCTAssertEqual(progress.lastByteReceived, -1)
        XCTAssertEqual(progress.nextByteToSend, 0,
            "lastByteReceived + 1 must be 0 so the client restarts at the top")
    }

    func testProgressMalformedRangeFallsBackToZero() {
        let response = HTTPURLResponse(
            url: URL(string: "https://upload.example")!,
            statusCode: 308,
            httpVersion: nil,
            headerFields: ["Range": "bytes=oops"],
        )!
        XCTAssertEqual(
            DriveResponseParser.parseChunkProgress(from: response).nextByteToSend,
            0,
        )
    }

    // MARK: - Error message

    func testParsesErrorMessage() {
        let json = #"{"error":{"code":401,"message":"Invalid Credentials","errors":[]}}"#
            .data(using: .utf8)!
        XCTAssertEqual(
            DriveResponseParser.parseErrorMessage(json),
            "Invalid Credentials",
        )
    }

    func testReturnsNilForNonErrorPayload() {
        let json = #"{"id":"x"}"#.data(using: .utf8)!
        XCTAssertNil(DriveResponseParser.parseErrorMessage(json))
    }

    func testReturnsNilForEmptyErrorMessage() {
        let json = #"{"error":{"message":""}}"#.data(using: .utf8)!
        XCTAssertNil(DriveResponseParser.parseErrorMessage(json))
    }

    // MARK: - Credentials

    func testCredentialsNotExpiredWhenFuture() {
        let now = Date()
        let creds = DriveCredentials(
            accessToken: "t",
            refreshToken: "r",
            expiresAt: now.addingTimeInterval(3600),
            scopes: ["drive.file"],
        )
        XCTAssertFalse(creds.isExpired(now: now))
    }

    func testCredentialsExpiredWithinSafetyMargin() {
        let now = Date()
        // 30 seconds remain but the 60-second safety margin trips it.
        let creds = DriveCredentials(
            accessToken: "t",
            refreshToken: "r",
            expiresAt: now.addingTimeInterval(30),
            scopes: [],
        )
        XCTAssertTrue(creds.isExpired(now: now),
            "must treat imminent expiry as expired so in-flight requests don't race a 401")
    }

    func testCredentialsExpiredWhenDateInPast() {
        let now = Date()
        let creds = DriveCredentials(
            accessToken: "t",
            refreshToken: "r",
            expiresAt: now.addingTimeInterval(-1),
            scopes: [],
        )
        XCTAssertTrue(creds.isExpired(now: now))
    }
}
