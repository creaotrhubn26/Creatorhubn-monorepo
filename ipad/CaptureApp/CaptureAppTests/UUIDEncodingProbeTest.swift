import XCTest
import GRDB
@testable import CaptureApp

/// Probe: what does the ``Session.databaseUUIDEncodingStrategy``
/// actually do to the stored UUID values? Isolated so we can see
/// the raw column values and narrow down whether the encoding
/// strategy is reaching the insert path.
final class UUIDEncodingProbeTest: XCTestCase {
    func testSessionIdStoredAsUppercaseString() async throws {
        let db = try AppDatabase.inMemory()
        let uuid = UUID()
        let session = Session(
            id: uuid,
            name: "probe",
            clientId: nil,
            startsAt: Date(),
            endsAt: nil,
            status: .active,
            ownerUserId: "o-1",
            createdAt: Date(),
            updatedAt: Date(),
        )
        try await db.dbWriter.write { db in
            try session.insert(db)
        }
        let raw: String? = try await db.dbWriter.read { db in
            try String.fetchOne(db, sql: "SELECT id FROM session LIMIT 1")
        }
        XCTAssertEqual(raw, uuid.uuidString.uppercased(),
            "Session.id must be persisted as uppercase string")
    }

    func testAssetSessionIdStoredAsUppercaseString() async throws {
        let db = try AppDatabase.inMemory()
        let sessionId = UUID()
        let assetId = UUID()
        let session = Session(
            id: sessionId,
            name: "probe",
            clientId: nil,
            startsAt: Date(),
            endsAt: nil,
            status: .active,
            ownerUserId: "o-1",
            createdAt: Date(),
            updatedAt: Date(),
        )
        let asset = Asset(
            id: assetId,
            sessionId: sessionId,
            originalFilename: "p.jpg",
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
        try await db.dbWriter.write { db in
            try session.insert(db)
            try asset.insert(db)
        }
        let rawSessionId: String? = try await db.dbWriter.read { db in
            try String.fetchOne(db, sql: "SELECT sessionId FROM asset LIMIT 1")
        }
        XCTAssertEqual(rawSessionId, sessionId.uuidString.uppercased(),
            "Asset.sessionId foreign key must also persist as uppercase")
    }
}
