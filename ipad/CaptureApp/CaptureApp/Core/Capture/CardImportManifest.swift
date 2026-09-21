import CryptoKit
import Foundation
import GRDB

enum CardImportMediaKind: String, Codable, CaseIterable, Sendable {
    case photo
    case raw
    case video
    case audio

    var title: String {
        switch self {
        case .photo: "Foto"
        case .raw: "RAW"
        case .video: "Video"
        case .audio: "Lyd"
        }
    }
}

enum CardImportItemStatus: String, Codable, Sendable {
    case waiting
    case copying
    case localVerified
    case duplicate
    case uploading
    case cloudVerified
    case failed
    case skipped

    var isLocallyTerminal: Bool {
        switch self {
        case .localVerified, .duplicate, .uploading, .cloudVerified, .skipped: true
        case .waiting, .copying, .failed: false
        }
    }
}

enum CardImportRunStatus: String, Codable, Sendable {
    case ready
    case importing
    case localVerified
    case uploading
    case cloudVerified
    case completed
    case paused

    var isUnfinished: Bool { self != .completed }
}

struct CardImportManifestItem: Identifiable, Sendable, Equatable {
    let id: String
    let runId: UUID
    let sourceRelativePath: String
    let sourceFingerprint: String
    let mediaKind: CardImportMediaKind
    let filename: String
    let fileExtension: String
    let sizeBytes: Int64
    let recordedAt: Date
    var inspection: CardMediaInspection
    var selected: Bool
    var status: CardImportItemStatus
    var copiedBytes: Int64
    var checksumSha256: String?
    var localPath: String?
    var photoAssetId: String?
    var videoAssetId: String?
    var audioAssetId: String?
    var lastError: String?

    var progress: Double {
        guard sizeBytes > 0 else { return status.isLocallyTerminal ? 1 : 0 }
        return min(1, Double(copiedBytes) / Double(sizeBytes))
    }
}

struct CardImportRun: Sendable, Equatable {
    let id: UUID
    let ownerUserId: String
    var sessionId: UUID?
    var projectId: String?
    var projectTitle: String?
    let cardIdentifier: String
    let cardName: String
    var plannedCardLabel: String?
    let cardCapacityBytes: Int64?
    let cardAvailableBytes: Int64?
    let sourceBookmark: Data?
    let sourceDisplayPath: String?
    var storagePolicy: Asset.StoragePolicy
    var status: CardImportRunStatus
    var totalFiles: Int
    var totalBytes: Int64
    var copiedBytes: Int64
    var completedFiles: Int
    var duplicateFiles: Int
    var failedFiles: Int
    var manifestSha256: String?
    var locallyVerifiedAt: Date?
    var cloudVerifiedAt: Date?
    var completedAt: Date?
    let createdAt: Date
    var updatedAt: Date
}

struct CardImportReceipt: Sendable, Equatable, Identifiable {
    let id: UUID
    let cardName: String
    let projectTitle: String?
    let totalFiles: Int
    let totalBytes: Int64
    let duplicateFiles: Int
    let failedFiles: Int
    let storagePolicy: Asset.StoragePolicy
    let manifestSha256: String?
    let locallyVerifiedAt: Date?
    let cloudVerifiedAt: Date?
    let completedAt: Date?
}

enum CardImportManifestBuilder {
    static func makeItems(
        runId: UUID,
        scan: CardScanResult,
        pickedURLs: [URL]
    ) -> [CardImportManifestItem] {
        var result: [CardImportManifestItem] = []
        for file in scan.photos {
            result.append(item(
                runId: runId,
                url: file.url,
                roots: pickedURLs,
                filename: file.filename,
                ext: file.ext,
                size: file.sizeBytes,
                date: file.captureTime,
                kind: file.isRaw ? .raw : .photo,
                inspection: file.inspection
            ))
        }
        for file in scan.videos {
            result.append(item(
                runId: runId,
                url: file.url,
                roots: pickedURLs,
                filename: file.filename,
                ext: file.ext,
                size: file.sizeBytes,
                date: file.recordedAt,
                kind: .video,
                inspection: file.inspection
            ))
        }
        for file in scan.audios {
            result.append(item(
                runId: runId,
                url: file.url,
                roots: pickedURLs,
                filename: file.filename,
                ext: file.ext,
                size: file.sizeBytes,
                date: file.recordedAt,
                kind: .audio,
                inspection: file.inspection
            ))
        }
        return result.sorted {
            if $0.recordedAt == $1.recordedAt { return $0.filename < $1.filename }
            return $0.recordedAt < $1.recordedAt
        }
    }

    static func manifestDigest(items: [CardImportManifestItem]) -> String? {
        let checksums = items
            .filter { $0.selected && [.localVerified, .uploading, .cloudVerified].contains($0.status) }
            .compactMap(\.checksumSha256)
            .sorted()
        guard !checksums.isEmpty else { return nil }
        return sha256(checksums.joined(separator: "\n"))
    }

    private static func item(
        runId: UUID,
        url: URL,
        roots: [URL],
        filename: String,
        ext: String,
        size: Int64,
        date: Date,
        kind: CardImportMediaKind,
        inspection: CardMediaInspection
    ) -> CardImportManifestItem {
        let relativePath = relativePath(for: url, roots: roots)
        // The immediate source folder stays stable whether the user selects
        // the card root, DCIM, one camera folder, or the file itself. Using it
        // avoids both root-relative mismatches and filename rollover clashes.
        let sourceFolder = url.deletingLastPathComponent().lastPathComponent.lowercased()
        let fingerprint = sha256(
            "v2|\(sourceFolder)|\(filename.lowercased())|\(size)|\(Int64(date.timeIntervalSince1970))|\(kind.rawValue)"
        )
        return CardImportManifestItem(
            id: sha256("\(runId.uuidString.lowercased())|\(fingerprint)"),
            runId: runId,
            sourceRelativePath: relativePath,
            sourceFingerprint: fingerprint,
            mediaKind: kind,
            filename: filename,
            fileExtension: ext,
            sizeBytes: size,
            recordedAt: date,
            inspection: inspection,
            selected: inspection.state != .unreadable && !inspection.isProxy,
            status: inspection.state == .unreadable || inspection.isProxy ? .skipped : .waiting,
            copiedBytes: 0,
            checksumSha256: nil,
            localPath: nil,
            photoAssetId: nil,
            videoAssetId: nil,
            audioAssetId: nil,
            lastError: nil
        )
    }

    static func relativePath(for file: URL, roots: [URL]) -> String {
        let filePath = file.standardizedFileURL.path
        for root in roots {
            let base = (root.hasDirectoryPath ? root : root.deletingLastPathComponent())
                .standardizedFileURL.path
            let prefix = base.hasSuffix("/") ? base : "\(base)/"
            if filePath.hasPrefix(prefix) {
                return String(filePath.dropFirst(prefix.count))
            }
        }
        return file.lastPathComponent
    }

    private static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// Best-effort persistence of document-picker grants. iPadOS may invalidate a
/// bookmark after removal or reboot; callers must always handle resolution
/// failure by asking the user to select the same card again.
enum CardSourceBookmark {
    static func archive(_ urls: [URL]) -> Data? {
        let bookmarks = urls.compactMap {
            try? $0.bookmarkData(options: [.minimalBookmark], includingResourceValuesForKeys: nil, relativeTo: nil)
        }
        guard !bookmarks.isEmpty else { return nil }
        return try? PropertyListEncoder().encode(bookmarks)
    }

    static func resolve(_ data: Data) -> [URL] {
        guard let bookmarks = try? PropertyListDecoder().decode([Data].self, from: data) else { return [] }
        return bookmarks.compactMap { bookmark in
            var stale = false
            return try? URL(
                resolvingBookmarkData: bookmark,
                options: [.withoutUI],
                relativeTo: nil,
                bookmarkDataIsStale: &stale
            )
        }
    }
}

actor CardImportManifestStore {
    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    func prepare(run: CardImportRun, items: [CardImportManifestItem]) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    INSERT INTO cardImportRun
                      (id, ownerUserId, sessionId, projectId, projectTitle,
                       cardIdentifier, cardName, plannedCardLabel,
                       cardCapacityBytes, cardAvailableBytes, sourceBookmark,
                       sourceDisplayPath, storagePolicy, status, totalFiles,
                       totalBytes, copiedBytes, completedFiles, duplicateFiles,
                       failedFiles, manifestSha256, locallyVerifiedAt,
                       cloudVerifiedAt, completedAt, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      sessionId = excluded.sessionId,
                      projectId = excluded.projectId,
                      projectTitle = excluded.projectTitle,
                      plannedCardLabel = excluded.plannedCardLabel,
                      storagePolicy = excluded.storagePolicy,
                      status = excluded.status,
                      totalFiles = excluded.totalFiles,
                      totalBytes = excluded.totalBytes,
                      updatedAt = excluded.updatedAt
                    """,
                arguments: Self.runArguments(run)
            )
            for item in items {
                try Self.upsert(item, in: db)
            }
        }
    }

    func latestUnfinished(
        ownerUserIds: [String],
        cardIdentifier: String? = nil
    ) async throws -> CardImportRun? {
        guard !ownerUserIds.isEmpty else { return nil }
        let placeholders = Array(repeating: "?", count: ownerUserIds.count).joined(separator: ",")
        let cardClause = cardIdentifier == nil ? "" : " AND cardIdentifier = ?"
        let values = ownerUserIds + [cardIdentifier].compactMap { $0 }
        return try await database.dbWriter.read { db in
            guard let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT * FROM cardImportRun
                     WHERE ownerUserId IN (\(placeholders)) AND status != 'completed'\(cardClause)
                     ORDER BY updatedAt DESC LIMIT 1
                    """,
                arguments: StatementArguments(values)
            ) else { return nil }
            return Self.decodeRun(row)
        }
    }

    func bestUnfinishedMatch(
        ownerUserIds: [String],
        sourceFingerprints: Set<String>
    ) async throws -> CardImportRun? {
        guard !ownerUserIds.isEmpty, !sourceFingerprints.isEmpty else { return nil }
        let ownerPlaceholders = Array(repeating: "?", count: ownerUserIds.count).joined(separator: ",")
        let fingerprintPlaceholders = Array(repeating: "?", count: sourceFingerprints.count).joined(separator: ",")
        let values = ownerUserIds + sourceFingerprints.sorted()
        return try await database.dbWriter.read { db in
            guard let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT r.*, COUNT(*) AS matchingFiles
                      FROM cardImportRun r
                      JOIN cardImportManifestItem i ON i.runId = r.id
                     WHERE r.ownerUserId IN (\(ownerPlaceholders))
                       AND r.status != 'completed'
                       AND i.sourceFingerprint IN (\(fingerprintPlaceholders))
                     GROUP BY r.id
                     ORDER BY matchingFiles DESC, r.updatedAt DESC
                     LIMIT 1
                    """,
                arguments: StatementArguments(values)
            ) else { return nil }
            return Self.decodeRun(row)
        }
    }

    func run(sessionId: UUID) async throws -> CardImportRun? {
        try await database.dbWriter.read { db in
            guard let row = try Row.fetchOne(
                db,
                sql: "SELECT * FROM cardImportRun WHERE sessionId = ? ORDER BY updatedAt DESC LIMIT 1",
                arguments: [sessionId.uuidString.lowercased()]
            ) else { return nil }
            return Self.decodeRun(row)
        }
    }

    func items(runId: UUID) async throws -> [CardImportManifestItem] {
        try await database.dbWriter.read { db in
            try Row.fetchAll(
                db,
                sql: "SELECT * FROM cardImportManifestItem WHERE runId = ? ORDER BY recordedAt, filename",
                arguments: [runId.uuidString.lowercased()]
            ).compactMap(Self.decodeItem)
        }
    }

    func setSelection(runId: UUID, selectedIds: Set<String>) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: "UPDATE cardImportManifestItem SET selected = 0, status = CASE WHEN status = 'waiting' THEN 'skipped' ELSE status END, updatedAt = ? WHERE runId = ?",
                arguments: [Date(), runId.uuidString.lowercased()]
            )
            guard !selectedIds.isEmpty else { return }
            let placeholders = Array(repeating: "?", count: selectedIds.count).joined(separator: ",")
            var arguments: [(any DatabaseValueConvertible)?] = [Date(), runId.uuidString.lowercased()]
            for id in selectedIds { arguments.append(id) }
            try db.execute(
                sql: "UPDATE cardImportManifestItem SET selected = 1, status = CASE WHEN status = 'skipped' THEN 'waiting' ELSE status END, updatedAt = ? WHERE runId = ? AND id IN (\(placeholders))",
                arguments: StatementArguments(arguments)
            )
            try Self.refreshAggregate(runId: runId, in: db)
        }
    }

    func updateRun(
        id: UUID,
        status: CardImportRunStatus,
        sessionId: UUID? = nil,
        projectId: String? = nil,
        projectTitle: String? = nil,
        plannedCardLabel: String? = nil,
        storagePolicy: Asset.StoragePolicy? = nil,
        locallyVerifiedAt: Date? = nil,
        cloudVerifiedAt: Date? = nil,
        completedAt: Date? = nil,
        manifestSha256: String? = nil
    ) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    UPDATE cardImportRun SET status = ?,
                      sessionId = COALESCE(?, sessionId), projectId = COALESCE(?, projectId),
                      projectTitle = COALESCE(?, projectTitle),
                      plannedCardLabel = COALESCE(?, plannedCardLabel),
                      storagePolicy = COALESCE(?, storagePolicy),
                      locallyVerifiedAt = COALESCE(?, locallyVerifiedAt),
                      cloudVerifiedAt = COALESCE(?, cloudVerifiedAt),
                      completedAt = COALESCE(?, completedAt),
                      manifestSha256 = COALESCE(?, manifestSha256), updatedAt = ?
                    WHERE id = ?
                    """,
                arguments: [
                    status.rawValue, sessionId?.uuidString.lowercased(), projectId,
                    projectTitle, plannedCardLabel, storagePolicy?.rawValue,
                    locallyVerifiedAt, cloudVerifiedAt, completedAt, manifestSha256,
                    Date(), id.uuidString.lowercased()
                ]
            )
            try Self.refreshAggregate(runId: id, in: db)
        }
    }

    func updateItem(
        id: String,
        status: CardImportItemStatus,
        copiedBytes: Int64? = nil,
        checksum: String? = nil,
        localPath: String? = nil,
        photoAssetId: String? = nil,
        videoAssetId: String? = nil,
        audioAssetId: String? = nil,
        error: String? = nil
    ) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    UPDATE cardImportManifestItem SET status = ?,
                      copiedBytes = COALESCE(?, copiedBytes),
                      checksumSha256 = COALESCE(?, checksumSha256),
                      localPath = COALESCE(?, localPath),
                      photoAssetId = COALESCE(?, photoAssetId),
                      videoAssetId = COALESCE(?, videoAssetId),
                      audioAssetId = COALESCE(?, audioAssetId),
                      lastError = ?, updatedAt = ? WHERE id = ?
                    """,
                arguments: [
                    status.rawValue, copiedBytes, checksum, localPath,
                    photoAssetId, videoAssetId, audioAssetId, error, Date(), id
                ]
            )
            if let runIdString = try String.fetchOne(
                db,
                sql: "SELECT runId FROM cardImportManifestItem WHERE id = ?",
                arguments: [id]
            ), let runId = UUID(uuidString: runIdString) {
                try Self.refreshAggregate(runId: runId, in: db)
            }
        }
    }

    func updateItemsForAsset(
        photoAssetId: String? = nil,
        videoAssetId: String? = nil,
        audioAssetId: String? = nil,
        status: CardImportItemStatus
    ) async throws {
        let clauses = [
            photoAssetId.map { ("photoAssetId", $0) },
            videoAssetId.map { ("videoAssetId", $0) },
            audioAssetId.map { ("audioAssetId", $0) }
        ].compactMap { $0 }
        guard let (column, value) = clauses.first else { return }
        try await database.dbWriter.write { db in
            let runIds = try String.fetchAll(
                db,
                sql: "SELECT DISTINCT runId FROM cardImportManifestItem WHERE \(column) = ?",
                arguments: [value]
            )
            try db.execute(
                sql: "UPDATE cardImportManifestItem SET status = ?, updatedAt = ? WHERE \(column) = ?",
                arguments: [status.rawValue, Date(), value]
            )
            for value in runIds {
                if let runId = UUID(uuidString: value) { try Self.refreshAggregate(runId: runId, in: db) }
            }
        }
    }

    func receipt(id: UUID) async throws -> CardImportReceipt? {
        try await database.dbWriter.read { db in
            guard let row = try Row.fetchOne(
                db,
                sql: "SELECT * FROM cardImportRun WHERE id = ?",
                arguments: [id.uuidString.lowercased()]
            ), let run = Self.decodeRun(row) else { return nil }
            return CardImportReceipt(
                id: run.id,
                cardName: run.cardName,
                projectTitle: run.projectTitle,
                totalFiles: run.totalFiles,
                totalBytes: run.totalBytes,
                duplicateFiles: run.duplicateFiles,
                failedFiles: run.failedFiles,
                storagePolicy: run.storagePolicy,
                manifestSha256: run.manifestSha256,
                locallyVerifiedAt: run.locallyVerifiedAt,
                cloudVerifiedAt: run.cloudVerifiedAt,
                completedAt: run.completedAt
            )
        }
    }

    func recentReceipts(ownerUserIds: [String], limit: Int = 5) async throws -> [CardImportReceipt] {
        guard !ownerUserIds.isEmpty, limit > 0 else { return [] }
        let placeholders = Array(repeating: "?", count: ownerUserIds.count).joined(separator: ",")
        return try await database.dbWriter.read { db in
            var values: [(any DatabaseValueConvertible)?] = []
            for ownerUserId in ownerUserIds { values.append(ownerUserId) }
            values.append(limit)
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM cardImportRun
                     WHERE ownerUserId IN (\(placeholders))
                       AND locallyVerifiedAt IS NOT NULL
                     ORDER BY COALESCE(completedAt, locallyVerifiedAt) DESC
                     LIMIT ?
                    """,
                arguments: StatementArguments(values)
            )
            return rows.compactMap { row -> CardImportReceipt? in
                guard let run = Self.decodeRun(row) else { return nil }
                return Self.makeReceipt(run)
            }
        }
    }

    private static func upsert(_ item: CardImportManifestItem, in db: Database) throws {
        try db.execute(
            sql: """
                INSERT INTO cardImportManifestItem
                  (id, runId, sourceRelativePath, sourceFingerprint, mediaKind,
                   filename, fileExtension, sizeBytes, recordedAt, inspectionJson, selected,
                   status, copiedBytes, checksumSha256, localPath, photoAssetId,
                   videoAssetId, audioAssetId, lastError, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  inspectionJson = excluded.inspectionJson,
                  selected = excluded.selected,
                  status = excluded.status,
                  copiedBytes = excluded.copiedBytes,
                  lastError = excluded.lastError,
                  updatedAt = excluded.updatedAt
                """,
            arguments: [
                item.id, item.runId.uuidString.lowercased(), item.sourceRelativePath,
                item.sourceFingerprint, item.mediaKind.rawValue, item.filename,
                item.fileExtension, item.sizeBytes, item.recordedAt,
                Self.encodeInspection(item.inspection), item.selected,
                item.status.rawValue, item.copiedBytes, item.checksumSha256,
                item.localPath, item.photoAssetId, item.videoAssetId,
                item.audioAssetId, item.lastError, Date()
            ]
        )
    }

    private static func makeReceipt(_ run: CardImportRun) -> CardImportReceipt {
        CardImportReceipt(
            id: run.id,
            cardName: run.cardName,
            projectTitle: run.projectTitle,
            totalFiles: run.totalFiles,
            totalBytes: run.totalBytes,
            duplicateFiles: run.duplicateFiles,
            failedFiles: run.failedFiles,
            storagePolicy: run.storagePolicy,
            manifestSha256: run.manifestSha256,
            locallyVerifiedAt: run.locallyVerifiedAt,
            cloudVerifiedAt: run.cloudVerifiedAt,
            completedAt: run.completedAt
        )
    }

    private static func refreshAggregate(runId: UUID, in db: Database) throws {
        let row = try Row.fetchOne(
            db,
            sql: """
                SELECT COUNT(*) FILTER (WHERE selected = 1) AS totalFiles,
                       COALESCE(SUM(sizeBytes) FILTER (WHERE selected = 1), 0) AS totalBytes,
                       COALESCE(SUM(MIN(copiedBytes, sizeBytes)) FILTER (WHERE selected = 1), 0) AS copiedBytes,
                       COUNT(*) FILTER (WHERE selected = 1 AND status IN ('localVerified','uploading','cloudVerified')) AS completedFiles,
                       COUNT(*) FILTER (WHERE selected = 1 AND status = 'duplicate') AS duplicateFiles,
                       COUNT(*) FILTER (WHERE selected = 1 AND status = 'failed') AS failedFiles
                  FROM cardImportManifestItem WHERE runId = ?
                """,
            arguments: [runId.uuidString.lowercased()]
        )
        guard let row else { return }
        try db.execute(
            sql: """
                UPDATE cardImportRun SET totalFiles = ?, totalBytes = ?, copiedBytes = ?,
                  completedFiles = ?, duplicateFiles = ?, failedFiles = ?, updatedAt = ? WHERE id = ?
                """,
            arguments: [
                row["totalFiles"] as Int, row["totalBytes"] as Int64,
                row["copiedBytes"] as Int64, row["completedFiles"] as Int,
                row["duplicateFiles"] as Int, row["failedFiles"] as Int,
                Date(), runId.uuidString.lowercased()
            ]
        )
    }

    private static func runArguments(_ run: CardImportRun) -> StatementArguments {
        let values: [(any DatabaseValueConvertible)?] = [
            run.id.uuidString.lowercased(), run.ownerUserId,
            run.sessionId?.uuidString.lowercased(), run.projectId, run.projectTitle,
            run.cardIdentifier, run.cardName, run.plannedCardLabel,
            run.cardCapacityBytes, run.cardAvailableBytes, run.sourceBookmark,
            run.sourceDisplayPath, run.storagePolicy.rawValue, run.status.rawValue,
            run.totalFiles, run.totalBytes, run.copiedBytes, run.completedFiles,
            run.duplicateFiles, run.failedFiles, run.manifestSha256,
            run.locallyVerifiedAt, run.cloudVerifiedAt, run.completedAt,
            run.createdAt, run.updatedAt
        ]
        return StatementArguments(values)
    }

    private static func decodeRun(_ row: Row) -> CardImportRun? {
        guard let id = UUID(uuidString: row["id"]),
              let policy = Asset.StoragePolicy(rawValue: row["storagePolicy"]),
              let status = CardImportRunStatus(rawValue: row["status"])
        else { return nil }
        let rawSessionId: String? = row["sessionId"]
        return CardImportRun(
            id: id,
            ownerUserId: row["ownerUserId"],
            sessionId: rawSessionId.flatMap(UUID.init(uuidString:)),
            projectId: row["projectId"], projectTitle: row["projectTitle"],
            cardIdentifier: row["cardIdentifier"], cardName: row["cardName"],
            plannedCardLabel: row["plannedCardLabel"],
            cardCapacityBytes: row["cardCapacityBytes"], cardAvailableBytes: row["cardAvailableBytes"],
            sourceBookmark: row["sourceBookmark"], sourceDisplayPath: row["sourceDisplayPath"],
            storagePolicy: policy, status: status, totalFiles: row["totalFiles"],
            totalBytes: row["totalBytes"], copiedBytes: row["copiedBytes"],
            completedFiles: row["completedFiles"], duplicateFiles: row["duplicateFiles"],
            failedFiles: row["failedFiles"], manifestSha256: row["manifestSha256"],
            locallyVerifiedAt: row["locallyVerifiedAt"], cloudVerifiedAt: row["cloudVerifiedAt"],
            completedAt: row["completedAt"], createdAt: row["createdAt"], updatedAt: row["updatedAt"]
        )
    }

    private static func decodeItem(_ row: Row) -> CardImportManifestItem? {
        guard let runId = UUID(uuidString: row["runId"]),
              let kind = CardImportMediaKind(rawValue: row["mediaKind"]),
              let status = CardImportItemStatus(rawValue: row["status"])
        else { return nil }
        return CardImportManifestItem(
            id: row["id"], runId: runId,
            sourceRelativePath: row["sourceRelativePath"], sourceFingerprint: row["sourceFingerprint"],
            mediaKind: kind, filename: row["filename"], fileExtension: row["fileExtension"],
            sizeBytes: row["sizeBytes"], recordedAt: row["recordedAt"],
            inspection: Self.decodeInspection(row["inspectionJson"]), selected: row["selected"],
            status: status, copiedBytes: row["copiedBytes"], checksumSha256: row["checksumSha256"],
            localPath: row["localPath"], photoAssetId: row["photoAssetId"],
            videoAssetId: row["videoAssetId"], audioAssetId: row["audioAssetId"],
            lastError: row["lastError"]
        )
    }

    private static func encodeInspection(_ inspection: CardMediaInspection) -> String {
        let encoder = JSONEncoder()
        return String(data: (try? encoder.encode(inspection)) ?? Data("{}".utf8), encoding: .utf8) ?? "{}"
    }

    private static func decodeInspection(_ value: String?) -> CardMediaInspection {
        guard let value,
              let data = value.data(using: .utf8),
              let inspection = try? JSONDecoder().decode(CardMediaInspection.self, from: data)
        else { return .limited }
        return inspection
    }
}
