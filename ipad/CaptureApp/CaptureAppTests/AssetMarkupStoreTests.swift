import XCTest
@testable import CaptureApp

/// Tests for ``AssetMarkupStore`` + ``MarkupStorage``. Run against
/// in-memory GRDB + temp-dir markup storage so nothing touches the
/// real app sandbox. Verifies:
///   - Round-trip save + load preserves drawing bytes, PNG, canvas
///     size, ink bounds, timestamp.
///   - Saving attaches the ref to ``asset.signals.markupRef`` and
///     enqueues a PUT to /api/capture/assets/:id/signals.
///   - Empty capture throws ``.emptyMarkup`` and no disk writes
///     happen.
///   - Re-saving deletes the prior markup file (no stale disk use).
///   - Cross-owner save/load/clear refuses without leaking data.
///   - Clearing a markup reverts signals.markupRef to nil + enqueues
///     the PUT + deletes the file.
final class AssetMarkupStoreTests: XCTestCase {
    private let owner = "photographer-1"
    private let other = "photographer-2"
    private var tempDir: URL!

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("markup-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(
            at: tempDir, withIntermediateDirectories: true,
        )
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tempDir)
    }

    private func makeStack() async throws -> (
        AssetMarkupStore, Outbox, AppDatabase, MarkupStorage, UUID
    ) {
        let db = try AppDatabase.inMemory()
        let outbox = Outbox(database: db)
        let storage = MarkupStorage(rootDirectory: tempDir)
        let store = AssetMarkupStore(
            database: db,
            outbox: outbox,
            markupStorage: storage,
        )

        // Seed session owned by ``owner`` + one asset.
        let sessionId = UUID()
        let assetId = UUID()
        let session = Session(
            id: sessionId, name: "Bryllup", clientId: nil,
            startsAt: Date(), endsAt: nil, status: .active,
            ownerUserId: owner,
            createdAt: Date(), updatedAt: Date(),
        )
        let asset = Asset(
            id: assetId, sessionId: sessionId,
            originalFilename: "IMG.CR3", captureTime: Date(),
            previewKey: nil, fullKey: nil, rawKey: nil, enhancedKey: nil,
            checksumSha256: nil, mime: "image/jpeg", sizeBytes: nil,
            state: .anticipated, signals: AssetSignals(),
            rating: 0, colorLabel: nil,
            flaggedForClient: false, rejected: false,
            createdAt: Date(), updatedAt: Date(),
        )
        try await db.dbWriter.write { db in
            try session.insert(db)
            try asset.insert(db)
        }
        return (store, outbox, db, storage, assetId)
    }

    private func makeCapture(
        drawing: Data = Data(repeating: 0x33, count: 64),
        png: Data = Data(repeating: 0x44, count: 256),
    ) -> MarkupCapture {
        MarkupCapture(
            drawingData: drawing,
            overlayPNG: png,
            canvasSize: CGSize(width: 1024, height: 768),
            inkBounds: CGRect(x: 100, y: 200, width: 300, height: 200),
            capturedAt: Date(timeIntervalSince1970: 1_700_000_000),
        )
    }

    // MARK: - Storage round-trip

    func testStorageRoundTripPreservesAllFields() throws {
        let storage = MarkupStorage(rootDirectory: tempDir)
        let capture = makeCapture()
        let ref = try storage.save(capture)
        XCTAssertNotNil(ref)
        let loaded = try XCTUnwrap(try storage.load(ref: ref!))
        XCTAssertEqual(loaded.drawingData, capture.drawingData)
        XCTAssertEqual(loaded.overlayPNG, capture.overlayPNG)
        XCTAssertEqual(loaded.canvasSize.width, capture.canvasSize.width, accuracy: 0.01)
        XCTAssertEqual(loaded.inkBounds.width, capture.inkBounds.width, accuracy: 0.01)
        XCTAssertEqual(
            loaded.capturedAt.timeIntervalSince1970,
            capture.capturedAt.timeIntervalSince1970,
            accuracy: 0.01,
        )
    }

    func testEmptyCaptureSavesNothing() throws {
        let storage = MarkupStorage(rootDirectory: tempDir)
        let empty = MarkupCapture(
            drawingData: Data(), overlayPNG: Data(),
            canvasSize: .zero, inkBounds: .zero,
            capturedAt: Date(),
        )
        let ref = try storage.save(empty)
        XCTAssertNil(ref)
        let contents = try FileManager.default.contentsOfDirectory(
            at: tempDir, includingPropertiesForKeys: nil,
        )
        XCTAssertTrue(contents.isEmpty)
    }

    // MARK: - Store: save

    func testSaveAttachesRefToSignalsAndEnqueuesPut() async throws {
        let (store, outbox, db, storage, assetId) = try await makeStack()
        let capture = makeCapture()

        let updated = try await store.save(
            assetId: assetId,
            ownerUserId: owner,
            capture: capture,
        )
        XCTAssertNotNil(updated.signals.markupRef)

        // File exists on disk.
        let pngURL = storage.pngURL(forRef: updated.signals.markupRef!)
        XCTAssertNotNil(pngURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: pngURL!.path))

        // DB row reflects the signals change.
        let refetched = try await db.dbWriter.read { db in
            try Asset.fetchOne(db, key: assetId.uuidString.uppercased())
        }
        XCTAssertEqual(refetched?.signals.markupRef, updated.signals.markupRef)

        // Exactly one PUT in the outbox.
        let pending = try await outbox.nextPending()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending[0].method, .put)
        XCTAssertTrue(pending[0].endpoint.hasSuffix("/signals"))
    }

    func testEmptyCaptureThrowsAndWritesNothing() async throws {
        let (store, outbox, _, _, assetId) = try await makeStack()
        let empty = MarkupCapture(
            drawingData: Data(), overlayPNG: Data(),
            canvasSize: .zero, inkBounds: .zero,
            capturedAt: Date(),
        )
        do {
            _ = try await store.save(
                assetId: assetId, ownerUserId: owner, capture: empty,
            )
            XCTFail("empty capture should throw")
        } catch AssetMarkupStoreError.emptyMarkup {
            // good
        }
        let pending = try await outbox.nextPending()
        XCTAssertTrue(pending.isEmpty,
            "empty markup must not enqueue a spurious PUT")
    }

    func testReSaveDeletesPriorFile() async throws {
        let (store, _, _, storage, assetId) = try await makeStack()
        let first = try await store.save(
            assetId: assetId, ownerUserId: owner, capture: makeCapture(),
        )
        let firstRef = first.signals.markupRef!

        let second = try await store.save(
            assetId: assetId, ownerUserId: owner,
            capture: makeCapture(drawing: Data(repeating: 0x55, count: 64)),
        )
        let secondRef = second.signals.markupRef!
        XCTAssertNotEqual(firstRef, secondRef)
        XCTAssertNil(storage.pngURL(forRef: firstRef),
            "previous markup file must be deleted on re-save")
        XCTAssertNotNil(storage.pngURL(forRef: secondRef))
    }

    func testSaveRefusesCrossOwner() async throws {
        let (store, outbox, _, _, assetId) = try await makeStack()
        do {
            _ = try await store.save(
                assetId: assetId,
                ownerUserId: other,
                capture: makeCapture(),
            )
            XCTFail("cross-owner save should throw notFound")
        } catch AssetMarkupStoreError.notFound {
            // good
        }
        let pending = try await outbox.nextPending()
        XCTAssertTrue(pending.isEmpty)
    }

    // MARK: - Store: clear

    func testClearRevertsSignalsAndEnqueuesPut() async throws {
        let (store, outbox, db, storage, assetId) = try await makeStack()
        let saved = try await store.save(
            assetId: assetId, ownerUserId: owner, capture: makeCapture(),
        )
        let ref = saved.signals.markupRef!

        // Drain the initial PUT so we can count the clear PUT alone.
        let first = try await outbox.nextPending()
        try await outbox.markSucceeded(first[0])

        let cleared = try await store.clear(
            assetId: assetId, ownerUserId: owner,
        )
        XCTAssertNil(cleared.signals.markupRef)
        XCTAssertNil(storage.pngURL(forRef: ref),
            "clear must delete the markup file on disk")

        let refetched = try await db.dbWriter.read { db in
            try Asset.fetchOne(db, key: assetId.uuidString.uppercased())
        }
        XCTAssertNil(refetched?.signals.markupRef)

        let pending = try await outbox.nextPending()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending[0].method, .put)
    }

    // MARK: - Store: load

    func testLoadReturnsNilWhenNoMarkup() async throws {
        let (store, _, _, _, assetId) = try await makeStack()
        let loaded = try await store.load(assetId: assetId, ownerUserId: owner)
        XCTAssertNil(loaded)
    }

    func testLoadReturnsSavedMarkup() async throws {
        let (store, _, _, _, assetId) = try await makeStack()
        _ = try await store.save(
            assetId: assetId, ownerUserId: owner, capture: makeCapture(),
        )
        let loaded = try await store.load(assetId: assetId, ownerUserId: owner)
        XCTAssertNotNil(loaded)
    }

    func testLoadRefusesCrossOwner() async throws {
        let (store, _, _, _, assetId) = try await makeStack()
        _ = try await store.save(
            assetId: assetId, ownerUserId: owner, capture: makeCapture(),
        )
        let loaded = try await store.load(assetId: assetId, ownerUserId: other)
        XCTAssertNil(loaded,
            "another photographer must not see the markup layer")
    }
}
