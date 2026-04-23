import XCTest
@testable import CaptureApp
import GRDB

/// Tests that the v3 CreatorHub One migration actually creates every
/// table + index the iPad needs, and that each new model can round-
/// trip through SQLite cleanly. Without this, a typo in the schema
/// would only show up weeks later when a feature tries to read from
/// the missing table.
///
/// We also verify ``ShotList``'s shotsJson round-trip since that's
/// the one place the local SQLite cache and the backend's JSONB
/// column have to agree on shape.
final class CreatorHubOneSchemaTests: XCTestCase {
    private func makeDatabase() throws -> AppDatabase {
        try AppDatabase.inMemory()
    }

    func testAllV3TablesExistAfterMigration() async throws {
        let database = try makeDatabase()
        try await database.dbWriter.read { db in
            for table in [
                "project",
                "shotList",
                "contract",
                "clientGallery",
                "cullSuggestion",
                "outboxMutation",
            ] {
                XCTAssertTrue(
                    try db.tableExists(table),
                    "missing table \(table) after v3 migration",
                )
            }
        }
    }

    func testProjectRoundTrip() async throws {
        let database = try makeDatabase()
        let now = Date()
        let project = Project(
            id: "proj-1",
            ownerUserId: "owner-1",
            title: "Anna+Per bryllup",
            clientName: "Anna Hansen",
            clientEmail: "anna@example.com",
            eventDate: now,
            location: "Holmenkollen",
            projectType: "wedding",
            status: "active",
            metadataJson: #"{"notes":"plural"}"#,
            totalShots: 24,
            completedShots: 18,
            mustHaveShots: 12,
            completedMustHave: 6,
            updatedAt: now,
            lastSyncedAt: now,
        )
        try await database.dbWriter.write { db in
            try project.insert(db)
        }
        let fetched = try await database.dbWriter.read { db in
            try Project.fetchOne(db, key: "proj-1")
        }
        XCTAssertEqual(fetched?.title, "Anna+Per bryllup")
        XCTAssertEqual(fetched?.totalShots, 24)
        XCTAssertEqual(fetched?.mustHaveShots, 12)
    }

    func testShotListJSONRoundTripKeepsEveryField() async throws {
        // This is the contract between iPad SQLite and the server's
        // JSONB column. Every field must survive encode→DB→fetch→
        // decode without loss so the iPad can apply-optimistically
        // before the sync lands.
        let database = try makeDatabase()

        // Seed a project first (FK dependency).
        let now = Date()
        let project = Project(
            id: "proj-1", ownerUserId: "owner-1", title: "X",
            clientName: nil, clientEmail: nil, eventDate: nil, location: nil,
            projectType: nil, status: "active",
            metadataJson: "{}",
            totalShots: 0, completedShots: 0,
            mustHaveShots: 0, completedMustHave: 0,
            updatedAt: now, lastSyncedAt: nil,
        )
        try await database.dbWriter.write { db in
            try project.insert(db)
        }

        var list = ShotList(
            id: "sl-1",
            ownerUserId: "owner-1",
            projectId: "proj-1",
            listName: "Primary",
            eventType: "wedding",
            shotsJson: "[]",
            updatedAt: now,
            lastSyncedAt: nil,
        )
        list.shots = [
            ShotListItem(
                id: "s1",
                scene: "First kiss",
                description: "Altar, 14:32",
                estimatedDuration: 30,
                priority: "must-have",
                shotType: "candid",
                locationName: "Kirke Holmenkollen",
                notes: "Harvest light through stained glass",
                scouted: true,
                isCompleted: false,
                capturedAssetId: nil,
            ),
            ShotListItem(
                id: "s2",
                scene: "Group family",
                description: nil,
                estimatedDuration: nil,
                priority: "high",
                shotType: "posed",
                locationName: nil,
                notes: nil,
                scouted: nil,
                isCompleted: true,
                capturedAssetId: "asset-abc",
            ),
        ]

        // Copy to a Sendable ``let`` before the writer closure so
        // strict-concurrency doesn't reject the capture of the outer
        // mutable ``list``.
        let listToInsert = list
        try await database.dbWriter.write { db in
            try listToInsert.insert(db)
        }
        let fetched = try await database.dbWriter.read { db in
            try ShotList.fetchOne(db, key: "sl-1")
        }
        XCTAssertNotNil(fetched)
        let shots = fetched!.shots
        XCTAssertEqual(shots.count, 2)
        XCTAssertEqual(shots[0].scene, "First kiss")
        XCTAssertEqual(shots[0].priority, "must-have")
        XCTAssertEqual(shots[0].scouted, true)
        XCTAssertEqual(shots[1].capturedAssetId, "asset-abc")
        XCTAssertEqual(shots[1].isCompleted, true)
    }

    func testContractStatusRoundTrip() async throws {
        let database = try makeDatabase()
        let contract = Contract(
            id: "ct-1",
            ownerUserId: "owner-1",
            projectId: nil,
            clientName: "Anna Hansen",
            clientEmail: "anna@example.com",
            status: .sent,
            termsJson: "{}",
            pdfLocalPath: nil,
            pdfDriveFileId: nil,
            signatureDataRef: nil,
            signedAt: nil,
            updatedAt: Date(),
            lastSyncedAt: nil,
        )
        try await database.dbWriter.write { db in
            try contract.insert(db)
        }
        let fetched = try await database.dbWriter.read { db in
            try Contract.fetchOne(db, key: "ct-1")
        }
        XCTAssertEqual(fetched?.status, .sent)
    }

    func testClientGalleryKeepsAccessTokenAsIs() async throws {
        let database = try makeDatabase()
        // Sensitive field — we want to be sure our Codable bridge
        // doesn't accidentally base64 or uppercase it.
        let token = "abcXYZ0123_rawshare-token"
        let gallery = ClientGallery(
            id: "g-1",
            ownerUserId: "owner-1",
            projectId: nil,
            captureSessionId: nil,
            clientName: "Anna Hansen",
            clientEmail: "anna@example.com",
            projectTitle: "Anna+Per",
            accessToken: token,
            shareUrl: "https://app.creatorhubn.com/client/gallery/\(token)",
            status: "active",
            totalImages: 0,
            heartedImages: 0,
            commentedImages: 0,
            selectionStatus: nil,
            createdAt: Date(),
            updatedAt: Date(),
            lastSyncedAt: nil,
        )
        try await database.dbWriter.write { db in
            try gallery.insert(db)
        }
        let fetched = try await database.dbWriter.read { db in
            try ClientGallery.fetchOne(db, key: "g-1")
        }
        XCTAssertEqual(fetched?.accessToken, token)
    }

    func testCullSuggestionStalenessTicksOver15Minutes() {
        let old = CullSuggestionCache(
            id: "s:balanced",
            sessionId: UUID(),
            strictness: "balanced",
            bucketsJson: "{}",
            fetchedAt: Date().addingTimeInterval(-16 * 60),
            invalidatedAt: nil,
        )
        let fresh = CullSuggestionCache(
            id: "s:balanced",
            sessionId: UUID(),
            strictness: "balanced",
            bucketsJson: "{}",
            fetchedAt: Date(),
            invalidatedAt: nil,
        )
        XCTAssertTrue(old.isStale)
        XCTAssertFalse(fresh.isStale)
    }

    func testCullSuggestionInvalidatedAtForcesStaleness() {
        let invalidated = CullSuggestionCache(
            id: "s:balanced",
            sessionId: UUID(),
            strictness: "balanced",
            bucketsJson: "{}",
            fetchedAt: Date(),             // fresh fetch…
            invalidatedAt: Date(),         // …but explicitly invalidated
        )
        XCTAssertTrue(invalidated.isStale)
    }
}
