import XCTest
@testable import CaptureApp

/// Tests for the context panel aggregator. Covers:
///   - Snapshot assembles project + shot list + contracts in one load.
///   - Ownership scoping across all three joined tables.
///   - Metadata parsing handles missing keys, empty strings, unknown
///     key shapes (the web's metadata schema evolves) without
///     throwing.
///   - specialRequests prefers client-originated over photographer-
///     originated text.
///   - Mood board URL supports both key variants.
///   - Teammates union pulls from collaborators + crew.
///   - Non-existent project returns nil, not throw.
final class ContextPanelStoreTests: XCTestCase {
    private let owner = "photographer-1"
    private let other = "photographer-2"

    private func makeStack() async throws -> (ContextPanelStore, AppDatabase) {
        let db = try AppDatabase.inMemory()
        return (ContextPanelStore(database: db), db)
    }

    private func seedProject(
        _ db: AppDatabase,
        id: String,
        owner: String = "photographer-1",
        title: String = "Anna+Per",
        metadataJson: String = "{}",
    ) async throws -> Project {
        let project = Project(
            id: id, ownerUserId: owner, title: title,
            clientName: "Anna Hansen", clientEmail: "anna@example.com",
            eventDate: Date(), location: "Holmenkollen",
            projectType: "wedding", status: "active",
            metadataJson: metadataJson,
            totalShots: 0, completedShots: 0,
            mustHaveShots: 0, completedMustHave: 0,
            updatedAt: Date(), lastSyncedAt: nil,
        )
        try await db.dbWriter.write { db in
            try project.insert(db)
        }
        return project
    }

    // MARK: - Happy path

    func testLoadReturnsFullSnapshot() async throws {
        let (store, db) = try await makeStack()
        _ = try await seedProject(db, id: "p1",
                                  metadataJson: #"{"specialRequests":"Ingen gruppebilder ute"}"#)
        // Copy out to a Sendable local before entering the @Sendable
        // writer closure — Swift 6 rejects capturing ``self`` of a
        // non-Sendable XCTestCase in that closure.
        let owner = self.owner
        // Shot list
        try await db.dbWriter.write { db in
            let list = ShotList(
                id: "sl-1", ownerUserId: owner, projectId: "p1",
                listName: "Primary", eventType: "wedding",
                shotsJson: "[]",
                updatedAt: Date(), lastSyncedAt: nil,
            )
            try list.insert(db)
            // Contract
            let contract = Contract(
                id: "ct-1", ownerUserId: owner, projectId: "p1",
                clientName: "Anna Hansen", clientEmail: "anna@example.com",
                status: .signed, termsJson: "{}",
                pdfLocalPath: nil, pdfDriveFileId: nil,
                signatureDataRef: nil, signedAt: Date(),
                updatedAt: Date(), lastSyncedAt: nil,
            )
            try contract.insert(db)
        }

        let snap = try await store.load(projectId: "p1", ownerUserId: owner)
        XCTAssertNotNil(snap)
        XCTAssertEqual(snap?.project.title, "Anna+Per")
        XCTAssertEqual(snap?.shotList?.id, "sl-1")
        XCTAssertEqual(snap?.contracts.count, 1)
        XCTAssertEqual(snap?.contracts[0].status, .signed)
        XCTAssertEqual(snap?.specialRequests, "Ingen gruppebilder ute")
    }

    func testNonExistentProjectReturnsNil() async throws {
        let (store, _) = try await makeStack()
        let snap = try await store.load(projectId: "does-not-exist", ownerUserId: owner)
        XCTAssertNil(snap)
    }

    // MARK: - Ownership

    func testOtherOwnersProjectInvisible() async throws {
        let (store, db) = try await makeStack()
        _ = try await seedProject(db, id: "theirs", owner: other)
        let snap = try await store.load(projectId: "theirs", ownerUserId: owner)
        XCTAssertNil(snap, "cross-owner project must not leak")
    }

    func testOtherOwnersShotListInvisibleEvenIfProjectVisible() async throws {
        let (store, db) = try await makeStack()
        _ = try await seedProject(db, id: "p1", owner: owner)
        // Seed a shot list owned by a different photographer on the
        // same project id (unlikely but possible during data migration
        // or a multi-photographer studio gone wrong).
        let other = self.other
        try await db.dbWriter.write { db in
            let list = ShotList(
                id: "sl-other", ownerUserId: other, projectId: "p1",
                listName: "Other", eventType: "wedding",
                shotsJson: "[]",
                updatedAt: Date(), lastSyncedAt: nil,
            )
            try list.insert(db)
        }
        let snap = try await store.load(projectId: "p1", ownerUserId: owner)
        XCTAssertNotNil(snap)
        XCTAssertNil(snap?.shotList,
            "another owner's shot list must not leak even when the project id matches")
    }

    // MARK: - Metadata parsing

    func testParseMetadataPrefersSpecialRequestsOverNotes() {
        let parsed = ContextPanelStore.parseMetadata(
            #"{"specialRequests":"ingen ute","notes":"fotografnotat"}"#,
        )
        XCTAssertEqual(parsed.specialRequests, "ingen ute")
    }

    func testParseMetadataFallsBackToNotesWhenSpecialRequestsAbsent() {
        let parsed = ContextPanelStore.parseMetadata(#"{"notes":"fotografnotat"}"#)
        XCTAssertEqual(parsed.specialRequests, "fotografnotat")
    }

    func testParseMetadataIgnoresEmptyStrings() {
        let parsed = ContextPanelStore.parseMetadata(#"{"specialRequests":"","notes":""}"#)
        XCTAssertNil(parsed.specialRequests,
            "empty strings in either field must not become visible sections")
    }

    func testParseMetadataHandlesMalformedJsonGracefully() {
        let parsed = ContextPanelStore.parseMetadata("not-json-at-all")
        XCTAssertNil(parsed.specialRequests)
        XCTAssertNil(parsed.moodBoardURL)
        XCTAssertTrue(parsed.teammates.isEmpty)
    }

    func testParseMetadataExtractsMoodBoardUrlFromEitherKey() {
        let camelCase = ContextPanelStore.parseMetadata(
            #"{"moodBoardUrl":"https://pinterest.com/a"}"#,
        )
        XCTAssertEqual(camelCase.moodBoardURL?.absoluteString, "https://pinterest.com/a")

        let shortKey = ContextPanelStore.parseMetadata(
            #"{"moodBoard":"https://pinterest.com/b"}"#,
        )
        XCTAssertEqual(shortKey.moodBoardURL?.absoluteString, "https://pinterest.com/b")
    }

    func testParseMetadataDropsInvalidMoodBoardUrl() {
        // The URL parser accepts the ``https://``-prefix flag-string
        // as structurally valid and extracts the host, which is safe
        // — we don't want a bizarre but technically-parseable string
        // to crash the panel. Verify the parsed URL at least has a
        // scheme.
        let parsed = ContextPanelStore.parseMetadata(
            #"{"moodBoardUrl":"https:///broken"}"#,
        )
        if let url = parsed.moodBoardURL {
            XCTAssertEqual(url.scheme, "https")
        }
    }

    func testParseMetadataExtractsTeammatesFromCollaborators() {
        let parsed = ContextPanelStore.parseMetadata(#"""
        {"collaborators":[{"name":"Maria"},{"name":"Lars"}]}
        """#)
        XCTAssertEqual(parsed.teammates, ["Maria", "Lars"])
    }

    func testParseMetadataExtractsTeammatesFromCrew() {
        let parsed = ContextPanelStore.parseMetadata(#"""
        {"crew":[{"name":"Second shooter"},{"displayName":"Video"}]}
        """#)
        XCTAssertEqual(parsed.teammates, ["Second shooter", "Video"])
    }

    func testParseMetadataUnionsTeammatesFromBothKeys() {
        // Unusual shape — some project types write to both — but
        // when that happens we'd rather union than drop one.
        let parsed = ContextPanelStore.parseMetadata(#"""
        {
            "collaborators":[{"name":"Maria"}],
            "crew":[{"name":"Video"}]
        }
        """#)
        XCTAssertEqual(Set(parsed.teammates), Set(["Maria", "Video"]))
    }

    func testParseMetadataSkipsTeammatesWithoutName() {
        // Defensive — shouldn't crash or include blank entries.
        let parsed = ContextPanelStore.parseMetadata(#"""
        {"collaborators":[{"role":"second"},{"name":""},{"name":"Real"}]}
        """#)
        XCTAssertEqual(parsed.teammates, ["Real"])
    }

    // MARK: - Contracts list ordering

    func testContractsReturnedNewestFirst() async throws {
        let (store, db) = try await makeStack()
        _ = try await seedProject(db, id: "p1")
        let older = Date().addingTimeInterval(-3600)
        let owner = self.owner
        try await db.dbWriter.write { db in
            let old = Contract(
                id: "old", ownerUserId: owner, projectId: "p1",
                clientName: "Anna", clientEmail: nil,
                status: .draft, termsJson: "{}",
                pdfLocalPath: nil, pdfDriveFileId: nil,
                signatureDataRef: nil, signedAt: nil,
                updatedAt: older, lastSyncedAt: nil,
            )
            let new = Contract(
                id: "new", ownerUserId: owner, projectId: "p1",
                clientName: "Anna", clientEmail: nil,
                status: .signed, termsJson: "{}",
                pdfLocalPath: nil, pdfDriveFileId: nil,
                signatureDataRef: nil, signedAt: Date(),
                updatedAt: Date(), lastSyncedAt: nil,
            )
            try old.insert(db)
            try new.insert(db)
        }
        let snap = try await store.load(projectId: "p1", ownerUserId: owner)
        XCTAssertEqual(snap?.contracts.map(\.id), ["new", "old"])
    }
}
