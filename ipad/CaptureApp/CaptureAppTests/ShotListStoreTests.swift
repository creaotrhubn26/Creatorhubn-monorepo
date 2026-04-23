import XCTest
@testable import CaptureApp

/// Tests for the iPad shot-list mutation store. Verifies:
///   - Local row updates + outbox enqueue happen atomically so
///     crash-between-steps can never leave them out of sync.
///   - Every mutation produces exactly one POST row in the outbox
///     (backend endpoint is array-based — per-shot writes would be
///     wasteful).
///   - Toggle / notes / ink / add / remove all preserve the other
///     shots' state.
///   - Ink size cap rejects 3MB+ base64 blobs rather than silently
///     accepting garbage.
///   - Reload after mutation reflects the new state.
final class ShotListStoreTests: XCTestCase {
    private let owner = "photographer-1"
    private let projectId = "proj-1"

    private func makeStack() async throws -> (ShotListStore, Outbox, AppDatabase) {
        let db = try AppDatabase.inMemory()
        let outbox = Outbox(database: db)
        let store = ShotListStore(database: db, outbox: outbox)

        // Seed a project so shot_list's FK resolves.
        let project = Project(
            id: projectId,
            ownerUserId: owner,
            title: "Bryllup",
            clientName: nil, clientEmail: nil, eventDate: nil, location: nil,
            projectType: nil, status: "active",
            metadataJson: "{}",
            totalShots: 0, completedShots: 0,
            mustHaveShots: 0, completedMustHave: 0,
            updatedAt: Date(), lastSyncedAt: nil,
        )
        try await db.dbWriter.write { db in
            try project.insert(db)
        }
        return (store, outbox, db)
    }

    // MARK: - Empty list + createEmpty

    func testLoadReturnsNilWhenNoListYet() async throws {
        let (store, _, _) = try await makeStack()
        let list = try await store.load(projectId: projectId, ownerUserId: owner)
        XCTAssertNil(list)
    }

    func testCreateEmptyEnqueuesPOST() async throws {
        let (store, outbox, _) = try await makeStack()
        let list = try await store.createEmpty(
            projectId: projectId,
            ownerUserId: owner,
            listName: "Day 1",
            eventType: "wedding",
        )

        XCTAssertEqual(list.listName, "Day 1")
        XCTAssertTrue(list.shots.isEmpty)

        let pending = try await outbox.nextPending()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending[0].method, .post)
        XCTAssertEqual(pending[0].endpoint, "/api/projects/\(projectId)/shot-list")
        XCTAssertEqual(pending[0].entityTable, "shotList")
        XCTAssertEqual(pending[0].entityId, list.id)
    }

    // MARK: - Shot mutations

    func testAddShotAppendsAndEnqueuesPOST() async throws {
        let (store, outbox, _) = try await makeStack()
        let list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        _ = try await store.addShot(to: list, scene: "First kiss", priority: "must-have")
        _ = try await store.addShot(to: list, scene: "Group photo", priority: "high")

        let reloaded = try await store.load(projectId: projectId, ownerUserId: owner)
        let scenes = reloaded?.shots.map(\.scene) ?? []
        XCTAssertEqual(scenes, ["First kiss", "Group photo"])

        // Each mutation enqueues one POST; combined with the initial
        // createEmpty we expect 3 rows total.
        let pending = try await outbox.nextPending()
        XCTAssertEqual(pending.count, 3)
        XCTAssertTrue(pending.allSatisfy { $0.method == .post })
    }

    func testToggleCompletionFlipsJustTheTargetedShot() async throws {
        let (store, _, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        let s1 = try await store.addShot(to: list, scene: "S1")
        let s2 = try await store.addShot(to: list, scene: "S2")

        // Reload — addShot mutated the DB but our local ``list`` is
        // stale. Real callers would pass the fresh row.
        list = try await store.load(projectId: projectId, ownerUserId: owner)!

        try await store.toggleCompletion(shotId: s1.id, in: list)
        let after = try await store.load(projectId: projectId, ownerUserId: owner)!
        let byId = Dictionary(uniqueKeysWithValues: after.shots.map { ($0.id, $0) })
        XCTAssertEqual(byId[s1.id]?.isCompleted, true)
        XCTAssertNotEqual(byId[s2.id]?.isCompleted, true,
            "toggle must not flip other shots")
    }

    func testToggleCompletionLinksAssetWhenProvided() async throws {
        let (store, _, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        let s1 = try await store.addShot(to: list, scene: "First kiss")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!

        try await store.toggleCompletion(
            shotId: s1.id,
            in: list,
            capturedAssetId: "asset-abc",
        )
        let refetched = try await store.load(projectId: projectId, ownerUserId: owner)!
        let updated = refetched.shots.first { $0.id == s1.id }
        XCTAssertEqual(updated?.isCompleted, true)
        XCTAssertEqual(updated?.capturedAssetId, "asset-abc")
    }

    func testToggleCompletionUnlinksAssetWhenToggledOff() async throws {
        let (store, _, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        let s1 = try await store.addShot(to: list, scene: "First kiss")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!

        try await store.toggleCompletion(
            shotId: s1.id, in: list,
            capturedAssetId: "asset-abc",
        )
        list = try await store.load(projectId: projectId, ownerUserId: owner)!
        try await store.toggleCompletion(shotId: s1.id, in: list)

        let final = try await store.load(projectId: projectId, ownerUserId: owner)!
        let updated = final.shots.first { $0.id == s1.id }
        XCTAssertEqual(updated?.isCompleted, false)
        XCTAssertNil(updated?.capturedAssetId,
            "toggling off must clear the captured asset link")
    }

    // MARK: - Notes

    func testUpdateNotesPersists() async throws {
        let (store, _, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        let s1 = try await store.addShot(to: list, scene: "First kiss")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!

        try await store.updateNotes(shotId: s1.id, in: list, notes: "Wide 24mm")
        let reloaded = try await store.load(projectId: projectId, ownerUserId: owner)!
        XCTAssertEqual(reloaded.shots.first?.notes, "Wide 24mm")
    }

    func testUpdateNotesWithEmptyStringClearsTheField() async throws {
        let (store, _, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        let s1 = try await store.addShot(to: list, scene: "First kiss")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!
        try await store.updateNotes(shotId: s1.id, in: list, notes: "something")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!

        try await store.updateNotes(shotId: s1.id, in: list, notes: "")
        let reloaded = try await store.load(projectId: projectId, ownerUserId: owner)!
        XCTAssertNil(reloaded.shots.first?.notes,
            "empty string notes clear the field (don't round-trip \"\")")
    }

    // MARK: - Ink

    func testSaveInkPersistsBase64() async throws {
        let (store, _, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        let s1 = try await store.addShot(to: list, scene: "First kiss")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!

        let fakeInk = Data(repeating: 0x42, count: 128).base64EncodedString()
        try await store.saveInk(shotId: s1.id, in: list, base64Ink: fakeInk)

        let reloaded = try await store.load(projectId: projectId, ownerUserId: owner)!
        XCTAssertEqual(reloaded.shots.first?.inkData, fakeInk)
    }

    func testSaveInkNilClearsTheDrawing() async throws {
        let (store, _, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        let s1 = try await store.addShot(to: list, scene: "S")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!

        try await store.saveInk(shotId: s1.id, in: list,
                                base64Ink: "AAAA")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!
        XCTAssertNotNil(list.shots.first?.inkData)

        try await store.saveInk(shotId: s1.id, in: list, base64Ink: nil)
        let final = try await store.load(projectId: projectId, ownerUserId: owner)!
        XCTAssertNil(final.shots.first?.inkData)
    }

    func testSaveInkRejectsGiantBlob() async throws {
        let (store, _, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        let s1 = try await store.addShot(to: list, scene: "S")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!

        // 3MB base64 string — beyond the 2.8MB cap.
        let huge = String(repeating: "A", count: 3_000_000)
        do {
            try await store.saveInk(shotId: s1.id, in: list, base64Ink: huge)
            XCTFail("huge ink blob should have been rejected")
        } catch let error as ShotListStoreError {
            guard case .inkTooLarge = error else {
                XCTFail("wrong error type: \(error)")
                return
            }
        }

        // And the local row stayed untouched.
        let reloaded = try await store.load(projectId: projectId, ownerUserId: owner)!
        XCTAssertNil(reloaded.shots.first?.inkData)
    }

    // MARK: - Remove

    func testRemoveShotLeavesOthersIntact() async throws {
        let (store, _, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        let a = try await store.addShot(to: list, scene: "A")
        _ = try await store.addShot(to: list, scene: "B")
        let c = try await store.addShot(to: list, scene: "C")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!

        try await store.removeShot(shotId: a.id, in: list)
        let reloaded = try await store.load(projectId: projectId, ownerUserId: owner)!
        let remaining = reloaded.shots.map(\.id)
        XCTAssertFalse(remaining.contains(a.id))
        XCTAssertTrue(remaining.contains(c.id))
    }

    // MARK: - Atomicity

    func testEveryMutationProducesExactlyOneOutboxRow() async throws {
        let (store, outbox, _) = try await makeStack()
        var list = try await store.createEmpty(projectId: projectId, ownerUserId: owner)
        _ = try await store.addShot(to: list, scene: "A")
        _ = try await store.addShot(to: list, scene: "B")
        list = try await store.load(projectId: projectId, ownerUserId: owner)!
        try await store.toggleCompletion(shotId: list.shots[0].id, in: list)
        list = try await store.load(projectId: projectId, ownerUserId: owner)!
        try await store.updateNotes(shotId: list.shots[1].id, in: list, notes: "x")

        let pending = try await outbox.nextPending()
        // 1 create + 2 add + 1 toggle + 1 notes = 5 rows.
        XCTAssertEqual(pending.count, 5,
            "each mutation enqueues exactly one POST (endpoint is array-based)")
    }
}
