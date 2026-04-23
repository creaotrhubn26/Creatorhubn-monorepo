import XCTest
@testable import CaptureApp

/// Tests for file-backed ``SignatureStorage``. Uses a per-test
/// temporary directory so the real ``Documents/signatures/`` is
/// never touched. Verifies:
///   - save → load round-trip preserves bytes + bounds + timestamp.
///   - Saving an empty capture returns nil and writes no files.
///   - delete removes the directory and is idempotent.
///   - load on a missing ref returns nil (not throw).
///   - Refs are unique across saves so two signatures don't collide.
///   - pngURL(forRef:) returns the on-disk URL only when the file
///     actually exists.
final class SignatureStorageTests: XCTestCase {
    private var tempDir: URL!
    private var storage: SignatureStorage!

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("signature-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(
            at: tempDir, withIntermediateDirectories: true,
        )
        storage = SignatureStorage(rootDirectory: tempDir)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tempDir)
    }

    // MARK: - Helpers

    private func makeCapture(
        drawing: Data = Data(repeating: 0x7f, count: 64),
        png: Data = Data(repeating: 0x88, count: 256),
        bounds: CGRect = CGRect(x: 10, y: 20, width: 200, height: 60),
        capturedAt: Date = Date(timeIntervalSince1970: 1_700_000_000),
    ) -> SignatureCapture {
        SignatureCapture(
            drawingData: drawing,
            pngData: png,
            bounds: bounds,
            capturedAt: capturedAt,
        )
    }

    // MARK: - Round-trip

    func testSaveThenLoadPreservesEverything() throws {
        let capture = makeCapture()
        let ref = try storage.save(capture)
        XCTAssertNotNil(ref)
        let loaded = try XCTUnwrap(try storage.load(ref: ref!))
        XCTAssertEqual(loaded.drawingData, capture.drawingData)
        XCTAssertEqual(loaded.pngData, capture.pngData)
        XCTAssertEqual(loaded.bounds.width, capture.bounds.width, accuracy: 0.001)
        XCTAssertEqual(loaded.bounds.height, capture.bounds.height, accuracy: 0.001)
        XCTAssertEqual(
            loaded.capturedAt.timeIntervalSince1970,
            capture.capturedAt.timeIntervalSince1970,
            accuracy: 0.001,
        )
    }

    // MARK: - Empty capture

    func testSavingEmptyCaptureReturnsNilAndWritesNothing() throws {
        let empty = SignatureCapture(
            drawingData: Data(),
            pngData: Data(),
            bounds: .zero,
            capturedAt: Date(),
        )
        let ref = try storage.save(empty)
        XCTAssertNil(ref)

        let contents = try FileManager.default.contentsOfDirectory(
            at: tempDir, includingPropertiesForKeys: nil,
        )
        XCTAssertTrue(contents.isEmpty,
            "empty capture must not leave any files on disk")
    }

    // MARK: - Delete

    func testDeleteRemovesFilesIdempotently() throws {
        let ref = try storage.save(makeCapture())!
        try storage.delete(ref: ref)
        // Second call must not throw even though the directory is gone.
        try storage.delete(ref: ref)
        let after = try storage.load(ref: ref)
        XCTAssertNil(after, "deleted signatures must be invisible to load")
    }

    func testDeleteUnknownRefDoesNotThrow() throws {
        try storage.delete(ref: "never-saved")
    }

    // MARK: - Load errors

    func testLoadUnknownRefReturnsNil() throws {
        XCTAssertNil(try storage.load(ref: "does-not-exist"))
    }

    // MARK: - Uniqueness

    func testRefsAreUniqueAcrossSaves() throws {
        let refs = try (0..<5).map { _ in try storage.save(makeCapture())! }
        XCTAssertEqual(Set(refs).count, refs.count,
            "each save must generate a fresh ref so two signatures don't collide")
    }

    // MARK: - pngURL

    func testPngUrlReturnsNilWhenRefMissing() {
        XCTAssertNil(storage.pngURL(forRef: "nope"))
    }

    func testPngUrlReturnsUrlWhenRefSaved() throws {
        let ref = try storage.save(makeCapture())!
        let url = storage.pngURL(forRef: ref)
        XCTAssertNotNil(url)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url!.path))
    }
}
