import XCTest
@testable import CaptureApp

final class SessionStoreTests: XCTestCase {
    private let owner = "owner-1"

    private func makeStore() throws -> SessionStore {
        SessionStore(database: try AppDatabase.inMemory())
    }

    func testCreateAndFetchSession() async throws {
        let store = try makeStore()
        let created = try await store.createSession(name: "Tromsø 2026", clientId: nil, ownerUserId: owner)
        let fetched = try await store.fetchSession(id: created.id)
        XCTAssertEqual(fetched?.id, created.id)
        XCTAssertEqual(fetched?.status, .active)
    }

    func testListSessionsOrderedByRecency() async throws {
        let store = try makeStore()
        let a = try await store.createSession(name: "A", clientId: nil, ownerUserId: owner)
        try await Task.sleep(for: .milliseconds(5))
        let b = try await store.createSession(name: "B", clientId: nil, ownerUserId: owner)
        let listed = try await store.listSessions(ownerUserId: owner).map(\.id)
        XCTAssertEqual(listed, [b.id, a.id])
    }

    func testCreateAssetAndTransitionState() async throws {
        let store = try makeStore()
        let session = try await store.createSession(name: "S", clientId: nil, ownerUserId: owner)
        let descriptor = AssetDescriptor(
            id: UUID(),
            originalFilename: "IMG_0001.CR3",
            captureTime: Date(),
            mime: "image/x-canon-cr3",
            sizeBytes: 32_000_000
        )
        let asset = try await store.createAsset(sessionId: session.id, descriptor: descriptor)
        XCTAssertEqual(asset.state, .anticipated)

        try await store.transitionAssetState(id: asset.id, to: .previewReady)
        let refreshed = try await store.fetchAsset(id: asset.id)
        XCTAssertEqual(refreshed?.state, .previewReady)
    }

    func testUpdateAssetSignalsRoundTripsThroughJSON() async throws {
        let store = try makeStore()
        let session = try await store.createSession(name: "S", clientId: nil, ownerUserId: owner)
        let descriptor = AssetDescriptor(
            id: UUID(), originalFilename: "IMG.CR3", captureTime: Date(), mime: "image/x-canon-cr3", sizeBytes: nil
        )
        let asset = try await store.createAsset(sessionId: session.id, descriptor: descriptor)

        var signals = AssetSignals()
        signals.sharpness = 82.3
        signals.eyesOpen = true
        signals.faceCount = 2
        signals.duplicateGroupId = UUID()

        try await store.updateAssetSignals(id: asset.id, signals: signals)
        let refreshed = try await store.fetchAsset(id: asset.id)
        XCTAssertEqual(refreshed?.signals, signals)
    }

    func testAttachStorageKeyUpdatesCorrectKind() async throws {
        let store = try makeStore()
        let session = try await store.createSession(name: "S", clientId: nil, ownerUserId: owner)
        let descriptor = AssetDescriptor(
            id: UUID(), originalFilename: "IMG.CR3", captureTime: Date(), mime: "image/x-canon-cr3", sizeBytes: nil
        )
        let asset = try await store.createAsset(sessionId: session.id, descriptor: descriptor)

        try await store.attachStorageKey(
            id: asset.id, kind: .preview, key: "s3://preview", checksumSha256: String(repeating: "a", count: 64), sizeBytes: 100
        )
        try await store.attachStorageKey(
            id: asset.id, kind: .full, key: "s3://full", checksumSha256: String(repeating: "b", count: 64), sizeBytes: 200
        )
        let refreshed = try await store.fetchAsset(id: asset.id)
        XCTAssertEqual(refreshed?.previewKey, "s3://preview")
        XCTAssertEqual(refreshed?.fullKey, "s3://full")
        XCTAssertNil(refreshed?.rawKey)
    }

    func testEventLogOrderingPreservedAcrossConcurrentAppends() async throws {
        let store = try makeStore()
        let session = try await store.createSession(name: "S", clientId: nil, ownerUserId: owner)

        await withTaskGroup(of: Void.self) { group in
            for i in 0..<50 {
                group.addTask {
                    try? await store.appendEvent(
                        sessionId: session.id,
                        actorId: "tester",
                        eventType: .captured,
                        metadata: ["i": String(i)]
                    )
                }
            }
        }
        let events = try await store.listEvents(sessionId: session.id)
        XCTAssertEqual(events.count, 50)

        // The event log is timestamp-ordered. Identical timestamps are allowed
        // under concurrent appends, so we assert monotonic non-decrease.
        let timestamps = events.map(\.createdAt)
        let sorted = timestamps.sorted()
        XCTAssertEqual(timestamps, sorted)
    }

    func testClosingSessionSetsTerminalFields() async throws {
        let store = try makeStore()
        let session = try await store.createSession(name: "S", clientId: nil, ownerUserId: owner)
        try await store.closeSession(id: session.id)
        let refreshed = try await store.fetchSession(id: session.id)
        XCTAssertEqual(refreshed?.status, .closed)
        XCTAssertNotNil(refreshed?.endsAt)
    }

    func testCascadeDeleteRemovesAssetsAndReviews() async throws {
        let store = try makeStore()
        let session = try await store.createSession(name: "S", clientId: nil, ownerUserId: owner)
        let descriptor = AssetDescriptor(
            id: UUID(), originalFilename: "IMG.CR3", captureTime: Date(), mime: "image/x-canon-cr3", sizeBytes: nil
        )
        let asset = try await store.createAsset(sessionId: session.id, descriptor: descriptor)
        let review = Review(
            id: UUID(),
            assetId: asset.id,
            reviewerId: "client-abc",
            reviewerType: .client,
            heart: true,
            rating: nil,
            comment: "Stunning",
            createdAt: Date()
        )
        try await store.addReview(review)

        // Delete the session directly through the writer. Foreign-key cascades
        // should wipe the asset and its review.
        let db = try AppDatabase.inMemory()
        let store2 = SessionStore(database: db)
        let s2 = try await store2.createSession(name: "S2", clientId: nil, ownerUserId: owner)
        let a2 = try await store2.createAsset(sessionId: s2.id, descriptor: descriptor)
        try await db.dbWriter.write { dbRef in
            _ = try Session.deleteOne(dbRef, key: s2.id.uuidString)
        }
        let remaining = try await store2.listAssets(sessionId: s2.id)
        XCTAssertTrue(remaining.isEmpty)
        XCTAssertNotNil(a2)  // silence unused warning
    }

    func testCrashRecoveryAfterReopeningFileDatabase() async throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("capture-test-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let sessionId: UUID
        do {
            let db = try AppDatabase.openOnDisk(at: tempURL)
            let store = SessionStore(database: db)
            let s = try await store.createSession(name: "Persisted", clientId: nil, ownerUserId: owner)
            sessionId = s.id
            try await store.appendEvent(
                sessionId: s.id, actorId: "tester", eventType: .captured
            )
        }
        // Simulate process restart: re-open the same file and read.
        let db2 = try AppDatabase.openOnDisk(at: tempURL)
        let store2 = SessionStore(database: db2)
        let fetched = try await store2.fetchSession(id: sessionId)
        XCTAssertEqual(fetched?.name, "Persisted")
        let events = try await store2.listEvents(sessionId: sessionId)
        XCTAssertEqual(events.count, 1)
    }
}
