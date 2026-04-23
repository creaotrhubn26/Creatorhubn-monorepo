import XCTest
@testable import CaptureApp

/// Locks the URL + header shape of every Drive request we emit. A
/// regression here would break cloud uploads silently (Drive returns
/// the same 400 for several unrelated shape errors), so catching it
/// in unit tests is cheaper than debugging in production.
final class DriveRequestBuilderTests: XCTestCase {

    // MARK: - Folder find

    func testFindFolderHitsCorrectEndpointWithFilters() {
        let request = DriveRequestBuilder.findFolder(
            parentId: "parent-1",
            name: "Bryllup Olav",
            accessToken: "tok-1",
        )
        let url = request.url!
        XCTAssertEqual(url.host, "www.googleapis.com")
        XCTAssertEqual(url.path, "/drive/v3/files")
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        let q = components.queryItems!.first(where: { $0.name == "q" })!.value!
        XCTAssertTrue(q.contains("'parent-1' in parents"))
        XCTAssertTrue(q.contains("name = 'Bryllup Olav'"))
        XCTAssertTrue(q.contains("mimeType = 'application/vnd.google-apps.folder'"))
        XCTAssertTrue(q.contains("trashed = false"))
        XCTAssertEqual(
            components.queryItems?.first(where: { $0.name == "pageSize" })?.value,
            "1",
        )
        XCTAssertEqual(
            components.queryItems?.first(where: { $0.name == "supportsAllDrives" })?.value,
            "true",
        )
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Authorization"),
            "Bearer tok-1",
        )
        XCTAssertEqual(request.httpMethod, "GET")
    }

    func testFindFolderEscapesApostrophes() {
        let request = DriveRequestBuilder.findFolder(
            parentId: "p",
            name: "Bea's bryllup",
            accessToken: "t",
        )
        let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
        let q = components.queryItems!.first(where: { $0.name == "q" })!.value!
        // URLQueryItem percent-encodes on emit — the underlying string
        // must already carry the \\' escape. Decode back and check.
        XCTAssertTrue(q.contains(#"name = 'Bea\'s bryllup'"#),
            "raw apostrophe would break the Drive query — must be escaped as \\'")
    }

    func testQueryEscaperHandlesBackslashesFirst() {
        // Backslash must be escaped before apostrophes, otherwise
        // ``a\'b`` → ``a\\\'b`` and Drive parses it wrong.
        XCTAssertEqual(
            DriveRequestBuilder.escapeQueryLiteral(#"a\b'c"#),
            #"a\\b\'c"#,
        )
    }

    // MARK: - Folder create

    func testCreateFolderSendsJSONBodyAndFolderMime() throws {
        let request = DriveRequestBuilder.createFolder(
            parentId: "p",
            name: "Nytt prosjekt",
            accessToken: "t",
        )
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer t")
        let body = try XCTUnwrap(request.httpBody)
        let json = try JSONSerialization.jsonObject(with: body) as! [String: Any]
        XCTAssertEqual(json["name"] as? String, "Nytt prosjekt")
        XCTAssertEqual(json["mimeType"] as? String, "application/vnd.google-apps.folder")
        XCTAssertEqual((json["parents"] as? [String]), ["p"])
    }

    // MARK: - Resumable upload

    func testStartResumableUploadSetsUploadContentLength() {
        let request = DriveRequestBuilder.startResumableUpload(
            parentId: "p",
            name: "raw.cr3",
            mimeType: "image/x-canon-cr3",
            totalBytes: 42_000_000,
            accessToken: "t",
        )
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.host, "www.googleapis.com")
        XCTAssertEqual(request.url?.path, "/upload/drive/v3/files")
        let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
        XCTAssertEqual(
            components.queryItems?.first(where: { $0.name == "uploadType" })?.value,
            "resumable",
        )
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "X-Upload-Content-Type"),
            "image/x-canon-cr3",
        )
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "X-Upload-Content-Length"),
            "42000000",
        )
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Content-Type"),
            "application/json; charset=UTF-8",
        )
    }

    func testAppendChunkContentRangeIsInclusive() {
        // A 1_048_576-byte chunk starting at byte 0 becomes
        // ``bytes 0-1048575/TOTAL``. The off-by-one mistake here
        // silently corrupts every upload > 1 chunk.
        let req = DriveRequestBuilder.appendChunk(
            sessionURL: URL(string: "https://upload.example/sess/abc")!,
            startByte: 0,
            chunkLength: 1_048_576,
            totalBytes: 50_000_000,
            mimeType: "image/x-canon-cr3",
        )
        XCTAssertEqual(req.httpMethod, "PUT")
        XCTAssertEqual(
            req.value(forHTTPHeaderField: "Content-Range"),
            "bytes 0-1048575/50000000",
        )
        XCTAssertEqual(req.value(forHTTPHeaderField: "Content-Length"), "1048576")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Content-Type"), "image/x-canon-cr3")
    }

    func testAppendChunkForLaterChunkComputesRangeFromOffset() {
        let req = DriveRequestBuilder.appendChunk(
            sessionURL: URL(string: "https://upload.example/sess/abc")!,
            startByte: 1_048_576,
            chunkLength: 1_048_576,
            totalBytes: 50_000_000,
            mimeType: "image/x-canon-cr3",
        )
        XCTAssertEqual(
            req.value(forHTTPHeaderField: "Content-Range"),
            "bytes 1048576-2097151/50000000",
        )
    }

    func testQueryResumableStatusRequestUsesBytesStarTotal() {
        let req = DriveRequestBuilder.queryResumableStatus(
            sessionURL: URL(string: "https://upload.example/sess/abc")!,
            totalBytes: 50_000_000,
            mimeType: "image/x-canon-cr3",
        )
        XCTAssertEqual(req.httpMethod, "PUT")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Content-Length"), "0")
        XCTAssertEqual(
            req.value(forHTTPHeaderField: "Content-Range"),
            "bytes */50000000",
        )
    }

    // MARK: - Chunk sizing

    func testAlignedChunkSizeRoundsDownTo256KiBBoundary() {
        let block: Int64 = 256 * 1024
        // Input exactly on a boundary stays put.
        XCTAssertEqual(DriveRequestBuilder.alignedChunkSize(preferred: block * 64), block * 64)
        // Input slightly over a boundary rounds down.
        XCTAssertEqual(
            DriveRequestBuilder.alignedChunkSize(preferred: block * 64 + 1),
            block * 64,
        )
        // Tiny inputs still return the block size minimum.
        XCTAssertEqual(
            DriveRequestBuilder.alignedChunkSize(preferred: 1),
            block,
        )
    }

    func testDefaultPreferredChunkSizeIsSixteenMiB() {
        XCTAssertEqual(DriveRequestBuilder.preferredChunkBytes, 16 * 1024 * 1024)
    }
}
