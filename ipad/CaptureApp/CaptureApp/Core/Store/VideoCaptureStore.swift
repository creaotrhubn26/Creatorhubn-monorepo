import Foundation
import GRDB

struct VideoCaptureStore: Sendable {
    let database: AppDatabase

    func save(_ asset: VideoCaptureAsset) async throws {
        try await database.dbWriter.write { db in try asset.save(db) }
    }

    func asset(id: String, ownerUserId: String) async throws -> VideoCaptureAsset? {
        try await database.dbWriter.read { db in
            try VideoCaptureAsset
                .filter(Column("id") == id && Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
        }
    }

    func list(ownerUserId: String, projectId: String? = nil) async throws -> [VideoCaptureAsset] {
        try await database.dbWriter.read { db in
            var request = VideoCaptureAsset
                .filter(Column("ownerUserId") == ownerUserId)
            if let projectId { request = request.filter(Column("projectId") == projectId) }
            return try request.order(Column("recordedAt").desc).fetchAll(db)
        }
    }

    func pending(ownerUserId: String) async throws -> [VideoCaptureAsset] {
        try await database.dbWriter.read { db in
            try VideoCaptureAsset
                .filter(Column("ownerUserId") == ownerUserId)
                .filter(["local", "hashing", "uploading", "verifying", "failed"].contains(Column("captureState")))
                .order(Column("recordedAt"))
                .fetchAll(db)
        }
    }

    func nextTakeNumber(ownerUserId: String, projectId: String, slate: String?) async throws -> Int {
        try await database.dbWriter.read { db in
            let value = try Int.fetchOne(
                db,
                sql: """
                    SELECT COALESCE(MAX(takeNumber), 0) + 1
                      FROM videoCaptureAsset
                     WHERE ownerUserId = ? AND projectId = ?
                       AND COALESCE(slate, '') = COALESCE(?, '')
                    """,
                arguments: [ownerUserId, projectId, slate]
            )
            return value ?? 1
        }
    }

    func updateState(
        id: String,
        ownerUserId: String,
        state: VideoCaptureAsset.CaptureState,
        checksumSha256: String? = nil,
        uploadObjectId: String? = nil,
        streamUid: String? = nil,
        streamState: String? = nil,
        error: String? = nil
    ) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try VideoCaptureAsset
                .filter(Column("id") == id && Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
            else { return }
            asset.captureState = state
            if let checksumSha256 { asset.checksumSha256 = checksumSha256 }
            if let uploadObjectId { asset.uploadObjectId = uploadObjectId }
            if let streamUid { asset.streamUid = streamUid }
            if let streamState { asset.streamState = streamState }
            asset.lastError = error
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    @discardableResult
    func updateTakeMetadata(
        id: String,
        ownerUserId: String,
        status: VideoCaptureAsset.TakeStatus,
        circled: Bool,
        continuityNotes: String?,
        performanceNotes: String?,
        technicalNotes: String?
    ) async throws -> VideoCaptureAsset? {
        try await database.dbWriter.write { db in
            guard var asset = try VideoCaptureAsset
                .filter(Column("id") == id && Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
            else { return nil }
            asset.takeStatus = status
            asset.circled = circled
            asset.continuityNotes = continuityNotes
            asset.performanceNotes = performanceNotes
            asset.technicalNotes = technicalNotes
            asset.takeMetadataDirty = true
            asset.updatedAt = Date()
            try asset.update(db)
            return asset
        }
    }

    func markTakeMetadataSynced(id: String, ownerUserId: String) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try VideoCaptureAsset
                .filter(Column("id") == id && Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
            else { return }
            asset.takeMetadataDirty = false
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    func pendingTakeMetadata(ownerUserId: String) async throws -> [VideoCaptureAsset] {
        try await database.dbWriter.read { db in
            try VideoCaptureAsset
                .filter(Column("ownerUserId") == ownerUserId && Column("takeMetadataDirty") == true)
                .order(Column("updatedAt"))
                .fetchAll(db)
        }
    }
}
