import CryptoKit
import Foundation
import GRDB

enum CardImportProfileScope: String, Codable, CaseIterable, Identifiable, Sendable {
    case card
    case project

    var id: String { rawValue }
    var title: String { self == .card ? "Denne korttypen" : "Dette prosjektet" }
}

struct CardImportProfile: Identifiable, Sendable, Equatable {
    let id: UUID
    let ownerUserId: String
    var name: String
    var scope: CardImportProfileScope
    var scopeKey: String
    var mediaKinds: Set<CardImportMediaKind>
    var fileExtensions: Set<String>
    var includedFolders: Set<String>
    var includeProxies: Bool
    var storagePolicy: Asset.StoragePolicy
    let createdAt: Date
    var updatedAt: Date

    static func cardScopeKey(capacity: Int64?, items: [CardImportManifestItem]) -> String {
        let formats = Set(items.map(\.fileExtension)).sorted().joined(separator: ",")
        let kinds = Set(items.map { $0.mediaKind.rawValue }).sorted().joined(separator: ",")
        let seed = "v1|\(capacity ?? -1)|\(formats)|\(kinds)"
        return SHA256.hash(data: Data(seed.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    static func projectScopeKey(_ projectId: String) -> String { projectId }

    func includes(_ item: CardImportManifestItem) -> Bool {
        guard item.inspection.state != .unreadable else { return false }
        guard includeProxies || !item.inspection.isProxy else { return false }
        guard mediaKinds.isEmpty || mediaKinds.contains(item.mediaKind) else { return false }
        guard fileExtensions.isEmpty || fileExtensions.contains(item.fileExtension.lowercased()) else { return false }
        let folder = (item.sourceRelativePath as NSString).deletingLastPathComponent
        return includedFolders.isEmpty || includedFolders.contains(folder)
    }
}

actor CardImportProfileStore {
    private let database: AppDatabase
    private let encoder = JSONEncoder()

    init(database: AppDatabase) {
        self.database = database
    }

    func applicable(
        ownerUserIds: [String],
        cardScopeKey: String,
        projectId: String?
    ) async throws -> [CardImportProfile] {
        guard !ownerUserIds.isEmpty else { return [] }
        let owners = Array(repeating: "?", count: ownerUserIds.count).joined(separator: ",")
        let scopePredicate = projectId == nil
            ? "(scope = 'card' AND scopeKey = ?)"
            : "((scope = 'card' AND scopeKey = ?) OR (scope = 'project' AND scopeKey = ?))"
        let values = ownerUserIds + [cardScopeKey] + [projectId].compactMap { $0 }
        return try await database.dbWriter.read { db in
            try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM cardImportProfile
                     WHERE ownerUserId IN (\(owners)) AND \(scopePredicate)
                     ORDER BY updatedAt DESC, name COLLATE NOCASE
                    """,
                arguments: StatementArguments(values)
            ).compactMap(Self.decode)
        }
    }

    func save(_ profile: CardImportProfile) async throws {
        let kinds = try json(profile.mediaKinds.map(\.rawValue).sorted())
        let extensions = try json(profile.fileExtensions.sorted())
        let folders = try json(profile.includedFolders.sorted())
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    INSERT INTO cardImportProfile
                      (id, ownerUserId, name, scope, scopeKey, mediaKindsJson,
                       extensionsJson, includedFoldersJson, includeProxies,
                       storagePolicy, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(ownerUserId, scope, scopeKey, name) DO UPDATE SET
                      mediaKindsJson = excluded.mediaKindsJson,
                      extensionsJson = excluded.extensionsJson,
                      includedFoldersJson = excluded.includedFoldersJson,
                      includeProxies = excluded.includeProxies,
                      storagePolicy = excluded.storagePolicy,
                      updatedAt = excluded.updatedAt
                    """,
                arguments: [
                    profile.id.uuidString.lowercased(), profile.ownerUserId,
                    profile.name, profile.scope.rawValue, profile.scopeKey,
                    kinds, extensions, folders, profile.includeProxies,
                    profile.storagePolicy.rawValue, profile.createdAt, profile.updatedAt
                ]
            )
        }
    }

    func delete(id: UUID, ownerUserId: String) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: "DELETE FROM cardImportProfile WHERE id = ? AND ownerUserId = ?",
                arguments: [id.uuidString.lowercased(), ownerUserId]
            )
        }
    }

    private func json(_ values: [String]) throws -> String {
        String(data: try encoder.encode(values), encoding: .utf8) ?? "[]"
    }

    private static func decode(_ row: Row) -> CardImportProfile? {
        guard let id = UUID(uuidString: row["id"]),
              let scope = CardImportProfileScope(rawValue: row["scope"]),
              let policy = Asset.StoragePolicy(rawValue: row["storagePolicy"])
        else { return nil }
        let decoder = JSONDecoder()
        func strings(_ column: String) -> [String] {
            let raw: String = row[column]
            return (try? decoder.decode([String].self, from: Data(raw.utf8))) ?? []
        }
        return CardImportProfile(
            id: id,
            ownerUserId: row["ownerUserId"],
            name: row["name"],
            scope: scope,
            scopeKey: row["scopeKey"],
            mediaKinds: Set(strings("mediaKindsJson").compactMap(CardImportMediaKind.init(rawValue:))),
            fileExtensions: Set(strings("extensionsJson")),
            includedFolders: Set(strings("includedFoldersJson")),
            includeProxies: row["includeProxies"],
            storagePolicy: policy,
            createdAt: row["createdAt"],
            updatedAt: row["updatedAt"]
        )
    }
}
