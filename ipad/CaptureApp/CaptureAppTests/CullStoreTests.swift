import XCTest
@testable import CaptureApp

/// Tests for the Live Cull commit store. All run against an
/// in-memory GRDB. We verify:
///   - Decision → asset-field mapping is correct for every case.
///   - Ownership gate: another photographer's asset is invisible.
///   - Each commit produces exactly one PATCH outbox row.
///   - ``assets`` + ``totalAssets`` + ``decidedAssets`` agree with
///     the rows written through commits.
///   - undecidedOnly filter hides flagged/rejected/rated frames.
final class CullStoreTests: XCTestCase {
    private let owner = "photographer-1"
    private let other = "photographer-2"

    private func makeStack() async throws -> (CullStore, Outbox, AppDatabase, UUID) {
        let db = try AppDatabase.inMemory()
        let outbox = Outbox(database: db)
        let store = CullStore(database: db, outbox: outbox)

        // Seed a session owned by ``owner``.
        let sessionId = UUID()
        let session = Session(
            id: sessionId,
            name: "Bryllup",
            clientId: nil,
            startsAt: Date(),
            endsAt: nil,
            status: .active,
            ownerUserId: owner,
            createdAt: Date(),
            updatedAt: Date(),
        )
        try await db.dbWriter.write { db in
            try session.insert(db)
        }
        return (store, outbox, db, sessionId)
    }

    private func seedAsset(
        _ db: AppDatabase,
        sessionId: UUID,
        id: UUID = UUID(),
        filename: String = "IMG.CR3",
        captureTime: Date = Date(),
        rating: Int = 0,
        flagged: Bool = false,
        rejected: Bool = false,
    ) async throws -> Asset {
        let asset = Asset(
            id: id,
            sessionId: sessionId,
            originalFilename: filename,
            captureTime: captureTime,
            previewKey: nil,
            fullKey: nil,
            rawKey: nil,
            enhancedKey: nil,
            checksumSha256: nil,
            mime: "image/jpeg",
            sizeBytes: nil,
            state: .anticipated,
            signals: AssetSignals(),
            rating: rating,
            colorLabel: nil,
            flaggedForClient: flagged,
            rejected: rejected,
            createdAt: Date(),
            updatedAt: Date(),
        )
        try await db.dbWriter.write { db in
            try asset.insert(db)
        }
        return asset
    }

    // MARK: - Decision mapping (pure)

    func testHeroSetsRating5AndFlags() {
        var asset = makeBlankAsset()
        CullStore.apply(.hero, toAsset: &asset)
        XCTAssertEqual(asset.rating, 5)
        XCTAssertTrue(asset.flaggedForClient)
        XCTAssertFalse(asset.rejected)
    }

    func testKeepSetsRating4Only() {
        var asset = makeBlankAsset()
        CullStore.apply(.keep, toAsset: &asset)
        XCTAssertEqual(asset.rating, 4)
        XCTAssertFalse(asset.flaggedForClient)
        XCTAssertFalse(asset.rejected)
    }

    func testWeakSetsRating2() {
        var asset = makeBlankAsset()
        CullStore.apply(.weak, toAsset: &asset)
        XCTAssertEqual(asset.rating, 2)
        XCTAssertFalse(asset.flaggedForClient)
        XCTAssertFalse(asset.rejected)
    }

    func testRejectZeroesRatingAndRejects() {
        var asset = makeBlankAsset()
        asset.flaggedForClient = true    // prior state — should clear
        CullStore.apply(.reject, toAsset: &asset)
        XCTAssertEqual(asset.rating, 0)
        XCTAssertFalse(asset.flaggedForClient,
            "reject must also un-flag a previously hero'd frame")
        XCTAssertTrue(asset.rejected)
    }

    func testHeroClearsPriorReject() {
        // Photographer rejects a frame, changes their mind, and
        // swipes hero. The commit must clear the rejected flag, not
        // leave it in a "rejected-and-flagged" limbo state.
        var asset = makeBlankAsset()
        asset.rejected = true
        CullStore.apply(.hero, toAsset: &asset)
        XCTAssertFalse(asset.rejected)
        XCTAssertTrue(asset.flaggedForClient)
    }

    // MARK: - End-to-end commit

    func testApplyWritesAssetAndEnqueuesPATCH() async throws {
        let (store, outbox, db, sessionId) = try await makeStack()
        let asset = try await seedAsset(db, sessionId: sessionId)

        let updated = try await store.apply(
            .hero,
            to: asset.id,
            ownerUserId: owner,
        )
        XCTAssertEqual(updated?.rating, 5)
        XCTAssertEqual(updated?.flaggedForClient, true)

        let pending = try await outbox.nextPending()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending[0].method, .patch)
        XCTAssertEqual(
            pending[0].endpoint,
            "/api/capture/assets/\(asset.id.uuidString.lowercased())",
        )
        XCTAssertEqual(pending[0].entityTable, "asset")
    }

    func testApplyRespectsOwnershipAndReturnsNilForOtherOwner() async throws {
        let (store, _, db, sessionId) = try await makeStack()
        let asset = try await seedAsset(db, sessionId: sessionId)

        let result = try await store.apply(
            .reject,
            to: asset.id,
            ownerUserId: other,       // different photographer
        )
        XCTAssertNil(result, "cross-owner mutation must be refused")

        // And the row stayed untouched.
        let refetched = try await db.dbWriter.read { db in
            try Asset.fetchOne(db, key: asset.id.uuidString.uppercased())
        }
        XCTAssertEqual(refetched?.rating, 0)
        XCTAssertEqual(refetched?.rejected, false)
    }

    // MARK: - List + count queries

    func testAssetsReturnsCaptureTimeAscending() async throws {
        let (store, _, db, sessionId) = try await makeStack()
        let now = Date()
        let first = try await seedAsset(
            db, sessionId: sessionId, filename: "A.CR3",
            captureTime: now.addingTimeInterval(-60),
        )
        _ = try await seedAsset(
            db, sessionId: sessionId, filename: "B.CR3",
            captureTime: now,
        )
        let last = try await seedAsset(
            db, sessionId: sessionId, filename: "C.CR3",
            captureTime: now.addingTimeInterval(60),
        )

        let list = try await store.assets(
            sessionId: sessionId,
            ownerUserId: owner,
        )
        XCTAssertEqual(list.first?.id, first.id)
        XCTAssertEqual(list.last?.id, last.id)
    }

    func testUndecidedOnlyFiltersOutDecidedFrames() async throws {
        let (store, _, db, sessionId) = try await makeStack()
        _ = try await seedAsset(db, sessionId: sessionId, filename: "plain.CR3")
        _ = try await seedAsset(db, sessionId: sessionId, filename: "flagged.CR3",
                                flagged: true)
        _ = try await seedAsset(db, sessionId: sessionId, filename: "rejected.CR3",
                                rejected: true)
        _ = try await seedAsset(db, sessionId: sessionId, filename: "rated.CR3",
                                rating: 3)

        let all = try await store.assets(
            sessionId: sessionId, ownerUserId: owner, undecidedOnly: false,
        )
        XCTAssertEqual(all.count, 4)

        let pending = try await store.assets(
            sessionId: sessionId, ownerUserId: owner, undecidedOnly: true,
        )
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending[0].originalFilename, "plain.CR3")
    }

    func testCountersMatchCommits() async throws {
        let (store, _, db, sessionId) = try await makeStack()
        let a = try await seedAsset(db, sessionId: sessionId)
        _ = try await seedAsset(db, sessionId: sessionId)
        _ = try await seedAsset(db, sessionId: sessionId)

        // Before any commits: 3 undecided.
        var total = try await store.totalAssets(sessionId: sessionId, ownerUserId: owner)
        var decided = try await store.decidedAssets(sessionId: sessionId, ownerUserId: owner)
        XCTAssertEqual(total, 3)
        XCTAssertEqual(decided, 0)

        // After one commit: 1 decided.
        try await store.apply(.hero, to: a.id, ownerUserId: owner)
        total = try await store.totalAssets(sessionId: sessionId, ownerUserId: owner)
        decided = try await store.decidedAssets(sessionId: sessionId, ownerUserId: owner)
        XCTAssertEqual(total, 3)
        XCTAssertEqual(decided, 1)
    }

    // MARK: - Helpers

    private func makeBlankAsset() -> Asset {
        Asset(
            id: UUID(),
            sessionId: UUID(),
            originalFilename: "IMG.CR3",
            captureTime: Date(),
            previewKey: nil,
            fullKey: nil,
            rawKey: nil,
            enhancedKey: nil,
            checksumSha256: nil,
            mime: "image/jpeg",
            sizeBytes: nil,
            state: .anticipated,
            signals: AssetSignals(),
            rating: 0,
            colorLabel: nil,
            flaggedForClient: false,
            rejected: false,
            createdAt: Date(),
            updatedAt: Date(),
        )
    }
}
