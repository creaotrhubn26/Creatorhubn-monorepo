import Foundation
import GRDB

struct ProductionAudioStore: Sendable {
    let database: AppDatabase

    func save(_ asset: ProductionAudioAsset) async throws {
        try await database.dbWriter.write { db in try asset.save(db) }
    }

    func asset(id: String, ownerUserId: String) async throws -> ProductionAudioAsset? {
        try await database.dbWriter.read { db in
            try ProductionAudioAsset
                .filter(Column("id") == id && Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
        }
    }

    func assignProject(id: String, ownerUserId: String, projectId: String) async throws {
        let trimmed = projectId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        try await database.dbWriter.write { db in
            guard var asset = try ProductionAudioAsset
                .filter(Column("id") == id && Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
            else { return }
            asset.projectId = trimmed
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    func updateState(
        id: String,
        ownerUserId: String,
        state: ProductionAudioAsset.CaptureState,
        checksumSha256: String? = nil,
        uploadObjectId: String? = nil,
        error: String? = nil
    ) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try ProductionAudioAsset
                .filter(Column("id") == id && Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
            else { return }
            asset.captureState = state
            if let checksumSha256 { asset.checksumSha256 = checksumSha256 }
            if let uploadObjectId { asset.uploadObjectId = uploadObjectId }
            asset.lastError = error
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }
}
