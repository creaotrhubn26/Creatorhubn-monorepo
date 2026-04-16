import Foundation
import GRDB

extension AppDatabase {
    static let migrator: DatabaseMigrator = {
        var migrator = DatabaseMigrator()
        migrator.registerMigration("v1_capture_core") { db in
            try db.create(table: "session") { t in
                t.primaryKey("id", .text)
                t.column("name", .text).notNull()
                t.column("clientId", .text)
                t.column("startsAt", .datetime).notNull()
                t.column("endsAt", .datetime)
                t.column("status", .text).notNull().defaults(to: "active")
                t.column("ownerUserId", .text).notNull()
                t.column("createdAt", .datetime).notNull()
                t.column("updatedAt", .datetime).notNull()
            }
            try db.create(indexOn: "session", columns: ["ownerUserId"])

            try db.create(table: "asset") { t in
                t.primaryKey("id", .text)
                t.column("sessionId", .text).notNull()
                    .references("session", onDelete: .cascade)
                t.column("originalFilename", .text).notNull()
                t.column("captureTime", .datetime).notNull()

                t.column("previewKey", .text)
                t.column("fullKey", .text)
                t.column("rawKey", .text)
                t.column("checksumSha256", .text)
                t.column("mime", .text).notNull()
                t.column("sizeBytes", .integer)

                t.column("state", .text).notNull().defaults(to: "anticipated")
                t.column("signals", .text).notNull().defaults(to: "{}")

                t.column("rating", .integer).notNull().defaults(to: 0)
                t.column("colorLabel", .text)
                t.column("flaggedForClient", .boolean).notNull().defaults(to: false)
                t.column("rejected", .boolean).notNull().defaults(to: false)

                t.column("createdAt", .datetime).notNull()
                t.column("updatedAt", .datetime).notNull()
            }
            try db.create(indexOn: "asset", columns: ["sessionId", "captureTime"])
            try db.create(indexOn: "asset", columns: ["state"])

            try db.create(table: "review") { t in
                t.primaryKey("id", .text)
                t.column("assetId", .text).notNull()
                    .references("asset", onDelete: .cascade)
                t.column("reviewerId", .text).notNull()
                t.column("reviewerType", .text).notNull()
                t.column("heart", .boolean)
                t.column("rating", .integer)
                t.column("comment", .text)
                t.column("createdAt", .datetime).notNull()
            }
            try db.create(indexOn: "review", columns: ["assetId"])

            try db.create(table: "event") { t in
                t.primaryKey("id", .text)
                t.column("sessionId", .text).notNull()
                    .references("session", onDelete: .cascade)
                t.column("assetId", .text)
                    .references("asset", onDelete: .cascade)
                t.column("actorId", .text).notNull()
                t.column("eventType", .text).notNull()
                t.column("metadata", .text).notNull().defaults(to: "{}")
                t.column("createdAt", .datetime).notNull()
            }
            try db.create(indexOn: "event", columns: ["sessionId", "createdAt"])
            try db.create(indexOn: "event", columns: ["assetId"])
        }
        return migrator
    }()
}

// MARK: - Table names + Codable strategies

extension Session: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "session" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
}

extension Asset: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "asset" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
}

extension Review: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "review" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
}

extension CaptureEvent: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "event" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
}

// MARK: - JSON-backed columns

extension AssetSignals: DatabaseValueConvertible {
    public var databaseValue: DatabaseValue {
        guard
            let data = try? JSONEncoder().encode(self),
            let json = String(data: data, encoding: .utf8)
        else {
            return "{}".databaseValue
        }
        return json.databaseValue
    }

    public static func fromDatabaseValue(_ dbValue: DatabaseValue) -> AssetSignals? {
        guard
            let string = String.fromDatabaseValue(dbValue),
            let data = string.data(using: .utf8)
        else {
            return nil
        }
        return try? JSONDecoder().decode(AssetSignals.self, from: data)
    }
}

extension Dictionary: DatabaseValueConvertible where Key == String, Value == String {
    public var databaseValue: DatabaseValue {
        guard
            let data = try? JSONEncoder().encode(self),
            let json = String(data: data, encoding: .utf8)
        else {
            return "{}".databaseValue
        }
        return json.databaseValue
    }

    public static func fromDatabaseValue(_ dbValue: DatabaseValue) -> [String: String]? {
        guard
            let string = String.fromDatabaseValue(dbValue),
            let data = string.data(using: .utf8)
        else {
            return nil
        }
        return try? JSONDecoder().decode([String: String].self, from: data)
    }
}
