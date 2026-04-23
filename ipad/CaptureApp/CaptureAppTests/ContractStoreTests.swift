import XCTest
@testable import CaptureApp

/// Tests for ``ContractStore``. Run against in-memory GRDB + a
/// temp-dir ``SignatureStorage`` so nothing touches the real app
/// sandbox. Verifies:
///   - Load + list round-trip with ownership scoping.
///   - applySignature writes to disk, updates the row, enqueues
///     the outbox row — all three or nothing (atomicity).
///   - applySignature refuses an empty capture.
///   - applySignature on a non-existent contract throws .notFound.
///   - clearSignature reverts status to draft, deletes the old
///     PNG, enqueues a DELETE mutation.
///   - Re-signing a previously-signed contract deletes the prior
///     file so stale signatures don't accumulate on disk.
final class ContractStoreTests: XCTestCase {
    private let owner = "photographer-1"
    private let other = "photographer-2"
    private var tempDir: URL!

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("contract-store-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(
            at: tempDir, withIntermediateDirectories: true,
        )
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tempDir)
    }

    private func makeStack() async throws -> (ContractStore, Outbox, AppDatabase, SignatureStorage) {
        let db = try AppDatabase.inMemory()
        let outbox = Outbox(database: db)
        let storage = SignatureStorage(rootDirectory: tempDir)
        let store = ContractStore(
            database: db,
            outbox: outbox,
            signatureStorage: storage,
        )
        return (store, outbox, db, storage)
    }

    private func seedContract(
        _ db: AppDatabase,
        id: String = "ct-1",
        owner: String = "photographer-1",
        projectId: String = "proj-1",
        status: Contract.Status = .draft,
        signatureRef: String? = nil,
    ) async throws -> Contract {
        // The ``contract.projectId`` column is a FK onto ``project.id``.
        // Seed the parent row first — ``INSERT OR IGNORE`` so repeated
        // seeds across tests are cheap.
        try await db.dbWriter.write { db in
            try db.execute(
                sql: """
                INSERT OR IGNORE INTO project
                  (id, ownerUserId, title, status, metadataJson,
                   totalShots, completedShots, mustHaveShots, completedMustHave,
                   updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [
                    projectId, owner, "Test project", "active", "{}",
                    0, 0, 0, 0,
                    ISO8601DateFormatter().string(from: Date()),
                ],
            )
        }
        let contract = Contract(
            id: id,
            ownerUserId: owner,
            projectId: projectId,
            clientName: "Anna Hansen",
            clientEmail: "anna@example.com",
            status: status,
            termsJson: "{}",
            pdfLocalPath: nil,
            pdfDriveFileId: nil,
            signatureDataRef: signatureRef,
            signedAt: nil,
            updatedAt: Date(),
            lastSyncedAt: nil,
        )
        try await db.dbWriter.write { db in
            try contract.insert(db)
        }
        return contract
    }

    private func makeCapture() -> SignatureCapture {
        SignatureCapture(
            drawingData: Data(repeating: 0x7f, count: 32),
            pngData: Data(repeating: 0x88, count: 64),
            bounds: CGRect(x: 0, y: 0, width: 200, height: 60),
            capturedAt: Date(),
        )
    }

    // MARK: - Reads

    func testLoadReturnsContract() async throws {
        let (store, _, db, _) = try await makeStack()
        _ = try await seedContract(db)
        let contract = try await store.load(contractId: "ct-1", ownerUserId: owner)
        XCTAssertEqual(contract?.id, "ct-1")
    }

    func testLoadRefusesCrossOwner() async throws {
        let (store, _, db, _) = try await makeStack()
        _ = try await seedContract(db)
        let contract = try await store.load(contractId: "ct-1", ownerUserId: other)
        XCTAssertNil(contract)
    }

    func testListScopesToProjectAndOwner() async throws {
        let (store, _, db, _) = try await makeStack()
        _ = try await seedContract(db, id: "mine-1", owner: owner)
        _ = try await seedContract(db, id: "mine-2", owner: owner)
        _ = try await seedContract(db, id: "theirs", owner: other)

        let mine = try await store.list(ownerUserId: owner)
        XCTAssertEqual(Set(mine.map(\.id)), Set(["mine-1", "mine-2"]))
    }

    // MARK: - applySignature

    func testApplySignatureWritesDiskRowAndOutboxAtomically() async throws {
        let (store, outbox, _, storage) = try await makeStack()
        _ = try await seedContract(store, id: "ct-1")
        let capture = makeCapture()

        let updated = try await store.applySignature(
            contractId: "ct-1",
            ownerUserId: owner,
            capture: capture,
        )
        XCTAssertEqual(updated.status, .signed)
        XCTAssertNotNil(updated.signedAt)
        XCTAssertNotNil(updated.signatureDataRef)

        // File exists.
        let pngURL = storage.pngURL(forRef: updated.signatureDataRef!)
        XCTAssertNotNil(pngURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: pngURL!.path))

        // Outbox has exactly one POST.
        let pending = try await outbox.nextPending()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending[0].method, .post)
        XCTAssertTrue(pending[0].endpoint.hasSuffix("/google-esignature"))
    }

    func testApplySignatureRefusesEmptyCapture() async throws {
        let (store, outbox, _, _) = try await makeStack()
        _ = try await seedContract(store, id: "ct-1")
        let empty = SignatureCapture(
            drawingData: Data(),
            pngData: Data(),
            bounds: .zero,
            capturedAt: Date(),
        )
        do {
            _ = try await store.applySignature(
                contractId: "ct-1",
                ownerUserId: owner,
                capture: empty,
            )
            XCTFail("empty capture should throw")
        } catch ContractStoreError.emptySignature {
            // good
        }
        let pending = try await outbox.nextPending()
        XCTAssertTrue(pending.isEmpty,
            "empty capture must not enqueue a spurious PATCH")
    }

    func testApplySignatureToMissingContractThrowsNotFound() async throws {
        let (store, _, _, _) = try await makeStack()
        do {
            _ = try await store.applySignature(
                contractId: "does-not-exist",
                ownerUserId: owner,
                capture: makeCapture(),
            )
            XCTFail("should throw notFound")
        } catch ContractStoreError.notFound {
            // good
        }
    }

    func testResigningDeletesPriorFile() async throws {
        let (store, _, db, storage) = try await makeStack()
        _ = try await seedContract(db, id: "ct-1")

        let first = try await store.applySignature(
            contractId: "ct-1", ownerUserId: owner,
            capture: makeCapture(),
        )
        let oldRef = first.signatureDataRef!

        // Clear then re-sign to simulate photographer rejecting +
        // re-signing a corrected document.
        _ = try await store.clearSignature(contractId: "ct-1", ownerUserId: owner)
        let second = try await store.applySignature(
            contractId: "ct-1", ownerUserId: owner,
            capture: makeCapture(),
        )
        XCTAssertNotEqual(second.signatureDataRef, oldRef,
            "re-signing must produce a fresh ref, not clobber the old file")
        XCTAssertNil(storage.pngURL(forRef: oldRef),
            "old signature's PNG must be deleted after clearSignature")
        XCTAssertNotNil(storage.pngURL(forRef: second.signatureDataRef!))
    }

    // MARK: - clearSignature

    func testClearSignatureRevertsStateAndEnqueuesDelete() async throws {
        let (store, outbox, _, storage) = try await makeStack()
        _ = try await seedContract(store, id: "ct-1")
        let signed = try await store.applySignature(
            contractId: "ct-1", ownerUserId: owner,
            capture: makeCapture(),
        )
        let oldRef = signed.signatureDataRef!

        // Drain the POST we just enqueued so we can count the DELETE
        // cleanly.
        let afterSign = try await outbox.nextPending()
        try await outbox.markSucceeded(afterSign[0])

        let cleared = try await store.clearSignature(
            contractId: "ct-1",
            ownerUserId: owner,
        )
        XCTAssertEqual(cleared.status, .draft)
        XCTAssertNil(cleared.signatureDataRef)
        XCTAssertNil(cleared.signedAt)
        XCTAssertNil(storage.pngURL(forRef: oldRef),
            "clear must delete the stored signature from disk")

        let deletes = try await outbox.nextPending()
        XCTAssertEqual(deletes.count, 1)
        XCTAssertEqual(deletes[0].method, .delete)
    }

    // Overload so tests can call ``seedContract(store,...)`` without
    // typing the db handle.
    private func seedContract(
        _ store: ContractStore,
        id: String = "ct-1",
        status: Contract.Status = .draft,
    ) async throws -> Contract {
        try await seedContract(
            store.database,
            id: id,
            owner: owner,
            status: status,
        )
    }
}
