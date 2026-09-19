import Foundation
import GRDB

/// Durable, non-secret state required to continue a CreatorHub S3 multipart
/// upload after process termination. Presigned URLs and auth headers are never
/// written to disk; fresh part URLs are requested on every retry.
actor PersistentUploadStore {
    struct BackendContext: Sendable, Equatable {
        let backendSessionId: UUID
        let backendAssetId: UUID
    }

    struct Part: Codable, Sendable, Equatable {
        let partNumber: Int
        let etag: String
    }

    struct Checkpoint: Sendable, Equatable {
        let id: String
        let localAssetId: UUID
        let backendAssetId: UUID
        let backendSessionId: UUID
        let kind: BackendUploadKind
        let localPath: String
        let mime: String
        let sizeBytes: Int64
        let checksumSha256: String
        let uploadId: String?
        let objectKey: String?
        let partSize: Int64?
        let partCount: Int?
        let partUrlBatchMax: Int?
        let completedParts: [Part]
        let status: String

        var hasUsablePlan: Bool {
            uploadId?.isEmpty == false
                && objectKey?.isEmpty == false
                && (partSize ?? 0) > 0
                && (partCount ?? 0) > 0
                && (partUrlBatchMax ?? 0) > 0
        }
    }

    private let database: AppDatabase
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(database: AppDatabase) {
        self.database = database
    }

    nonisolated static func key(localAssetId: UUID, kind: BackendUploadKind) -> String {
        "\(localAssetId.uuidString.lowercased()):\(kind.rawValue)"
    }

    func backendContext(for localAssetId: UUID) async throws -> BackendContext? {
        let local = localAssetId.uuidString.lowercased()
        return try await database.dbWriter.read { db in
            guard let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT backendSessionId, backendAssetId
                      FROM multipartUploadCheckpoint
                     WHERE localAssetId = ?
                     ORDER BY updatedAt DESC
                     LIMIT 1
                    """,
                arguments: [local],
            ),
            let sessionId = UUID(uuidString: row["backendSessionId"]),
            let assetId = UUID(uuidString: row["backendAssetId"])
            else { return nil }
            return BackendContext(backendSessionId: sessionId, backendAssetId: assetId)
        }
    }

    /// Prepare the stable local↔backend mapping. If the bytes at a reused
    /// local id changed, discard its stale multipart plan before continuing.
    func prepare(
        localAssetId: UUID,
        backendAssetId: UUID,
        backendSessionId: UUID,
        kind: BackendUploadKind,
        localPath: String,
        mime: String,
        sizeBytes: Int64,
        checksumSha256: String,
    ) async throws -> Checkpoint {
        let id = Self.key(localAssetId: localAssetId, kind: kind)
        let now = Date()
        try await database.dbWriter.write { db in
            if let existing = try Row.fetchOne(
                db,
                sql: "SELECT localPath, sizeBytes, checksumSha256 FROM multipartUploadCheckpoint WHERE id = ?",
                arguments: [id],
            ) {
                let sameFile = (existing["localPath"] as String) == localPath
                    && (existing["sizeBytes"] as Int64) == sizeBytes
                    && (existing["checksumSha256"] as String) == checksumSha256
                if sameFile { return }
                try db.execute(sql: "DELETE FROM multipartUploadCheckpoint WHERE id = ?", arguments: [id])
            }
            try db.execute(
                sql: """
                    INSERT INTO multipartUploadCheckpoint
                      (id, localAssetId, backendAssetId, backendSessionId, kind,
                       localPath, mime, sizeBytes, checksumSha256,
                       completedPartsJson, status, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'registered', ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      backendAssetId = excluded.backendAssetId,
                      backendSessionId = excluded.backendSessionId,
                      updatedAt = excluded.updatedAt
                    """,
                arguments: [
                    id,
                    localAssetId.uuidString.lowercased(),
                    backendAssetId.uuidString.lowercased(),
                    backendSessionId.uuidString.lowercased(),
                    kind.rawValue,
                    localPath,
                    mime,
                    sizeBytes,
                    checksumSha256,
                    now,
                    now
                ]
            )
        }
        guard let checkpoint = try await checkpoint(localAssetId: localAssetId, kind: kind) else {
            throw CocoaError(.fileReadUnknown)
        }
        return checkpoint
    }

    func checkpoint(localAssetId: UUID, kind: BackendUploadKind) async throws -> Checkpoint? {
        let id = Self.key(localAssetId: localAssetId, kind: kind)
        let decoder = self.decoder
        return try await database.dbWriter.read { db in
            guard let row = try Row.fetchOne(
                db,
                sql: "SELECT * FROM multipartUploadCheckpoint WHERE id = ?",
                arguments: [id],
            ) else { return nil }
            return try Self.decode(row: row, decoder: decoder)
        }
    }

    func savePlan(
        localAssetId: UUID,
        kind: BackendUploadKind,
        plan: BackendUploadPlan,
    ) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    UPDATE multipartUploadCheckpoint
                       SET uploadId = ?, objectKey = ?, partSize = ?, partCount = ?,
                           partUrlBatchMax = ?, completedPartsJson = '[]',
                           status = 'uploading', updatedAt = ?
                     WHERE id = ?
                    """,
                arguments: [
                    plan.uploadId,
                    plan.key,
                    plan.partSize,
                    plan.partCount,
                    max(1, plan.partUrlBatchMax),
                    Date(),
                    Self.key(localAssetId: localAssetId, kind: kind)
                ]
            )
        }
    }

    func savePart(
        localAssetId: UUID,
        kind: BackendUploadKind,
        part: Part,
    ) async throws {
        let id = Self.key(localAssetId: localAssetId, kind: kind)
        let encoder = self.encoder
        let decoder = self.decoder
        try await database.dbWriter.write { db in
            guard let row = try Row.fetchOne(
                db,
                sql: "SELECT completedPartsJson FROM multipartUploadCheckpoint WHERE id = ?",
                arguments: [id],
            ) else { return }
            let json: String = row["completedPartsJson"]
            var parts = (try? decoder.decode([Part].self, from: Data(json.utf8))) ?? []
            parts.removeAll { $0.partNumber == part.partNumber }
            parts.append(part)
            parts.sort { $0.partNumber < $1.partNumber }
            guard let encoded = String(bytes: try encoder.encode(parts), encoding: .utf8) else {
                throw CocoaError(.fileWriteInapplicableStringEncoding)
            }
            try db.execute(
                sql: "UPDATE multipartUploadCheckpoint SET completedPartsJson = ?, updatedAt = ? WHERE id = ?",
                arguments: [encoded, Date(), id],
            )
        }
    }

    func resetPlan(localAssetId: UUID, kind: BackendUploadKind) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    UPDATE multipartUploadCheckpoint
                       SET uploadId = NULL, objectKey = NULL, partSize = NULL,
                           partCount = NULL, partUrlBatchMax = NULL,
                           completedPartsJson = '[]', status = 'registered', updatedAt = ?
                     WHERE id = ?
                    """,
                arguments: [Date(), Self.key(localAssetId: localAssetId, kind: kind)],
            )
        }
    }

    func markCompleted(localAssetId: UUID, kind: BackendUploadKind) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: "UPDATE multipartUploadCheckpoint SET status = 'completed', updatedAt = ? WHERE id = ?",
                arguments: [Date(), Self.key(localAssetId: localAssetId, kind: kind)],
            )
        }
    }

    private nonisolated static func decode(row: Row, decoder: JSONDecoder) throws -> Checkpoint? {
        guard
            let localAssetId = UUID(uuidString: row["localAssetId"]),
            let backendAssetId = UUID(uuidString: row["backendAssetId"]),
            let backendSessionId = UUID(uuidString: row["backendSessionId"]),
            let kind = BackendUploadKind(rawValue: row["kind"])
        else { return nil }
        let partsJSON: String = row["completedPartsJson"]
        let parts = (try? decoder.decode([Part].self, from: Data(partsJSON.utf8))) ?? []
        return Checkpoint(
            id: row["id"],
            localAssetId: localAssetId,
            backendAssetId: backendAssetId,
            backendSessionId: backendSessionId,
            kind: kind,
            localPath: row["localPath"],
            mime: row["mime"],
            sizeBytes: row["sizeBytes"],
            checksumSha256: row["checksumSha256"],
            uploadId: row["uploadId"],
            objectKey: row["objectKey"],
            partSize: row["partSize"],
            partCount: row["partCount"],
            partUrlBatchMax: row["partUrlBatchMax"],
            completedParts: parts,
            status: row["status"],
        )
    }
}

/// Persists the card-import intent before networking starts so the UI can
/// reconstruct the exact project and copied local files after relaunch.
actor CardBackupJobStore {
    struct Job: Sendable, Equatable {
        let id: UUID
        let ownerUserId: String
        let sessionName: String
        let sessionStartedAt: Date
        let projectId: String
        let projectTitle: String
        let items: [DeliveryService.CardBackupItem]
        let assetCount: Int
        let duplicateCount: Int
    }

    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    func save(_ job: Job) async throws {
        guard let itemsJSON = String(
            bytes: try JSONEncoder().encode(job.items),
            encoding: .utf8
        ) else {
            throw CocoaError(.fileWriteInapplicableStringEncoding)
        }
        let now = Date()
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    INSERT INTO cardBackupJob
                      (id, ownerUserId, sessionName, sessionStartedAt, projectId,
                       projectTitle, itemsJson, assetCount, duplicateCount,
                       status, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      sessionName = excluded.sessionName,
                      projectId = excluded.projectId,
                      projectTitle = excluded.projectTitle,
                      itemsJson = excluded.itemsJson,
                      assetCount = excluded.assetCount,
                      duplicateCount = excluded.duplicateCount,
                      status = 'pending',
                      updatedAt = excluded.updatedAt
                    """,
                arguments: [
                    job.id.uuidString.lowercased(),
                    job.ownerUserId,
                    job.sessionName,
                    job.sessionStartedAt,
                    job.projectId,
                    job.projectTitle,
                    itemsJSON,
                    job.assetCount,
                    job.duplicateCount,
                    now,
                    now
                ]
            )
        }
    }

    func latestPending(ownerUserId: String) async throws -> Job? {
        try await database.dbWriter.read { db in
            guard let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT * FROM cardBackupJob
                     WHERE ownerUserId = ? AND status = 'pending'
                     ORDER BY updatedAt DESC
                     LIMIT 1
                    """,
                arguments: [ownerUserId],
            ),
            let id = UUID(uuidString: row["id"])
            else { return nil }
            let itemsJSON: String = row["itemsJson"]
            let items = try JSONDecoder().decode(
                [DeliveryService.CardBackupItem].self,
                from: Data(itemsJSON.utf8),
            )
            return Job(
                id: id,
                ownerUserId: row["ownerUserId"],
                sessionName: row["sessionName"],
                sessionStartedAt: row["sessionStartedAt"],
                projectId: row["projectId"],
                projectTitle: row["projectTitle"],
                items: items,
                assetCount: row["assetCount"],
                duplicateCount: row["duplicateCount"],
            )
        }
    }

    func delete(id: UUID) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: "DELETE FROM cardBackupJob WHERE id = ?",
                arguments: [id.uuidString.lowercased()],
            )
        }
    }
}
