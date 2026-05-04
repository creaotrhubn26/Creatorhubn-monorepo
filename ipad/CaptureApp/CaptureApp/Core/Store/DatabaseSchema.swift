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
        migrator.registerMigration("v2_asset_enhanced") { db in
            try db.alter(table: "asset") { t in
                t.add(column: "enhancedKey", .text)
            }
        }

        // ── v3: CreatorHub One foundation ───────────────────────────────
        //
        // Local mirrors of the backend tables the iPad reads/writes when
        // running offline. These are slim copies — just the fields the
        // iPad actually renders — rather than full replicas of the Postgres
        // schema. When connectivity returns, the sync engine reconciles
        // against the backend using ``updatedAt`` and the ``outbox`` of
        // pending mutations.
        //
        // Naming: singular table names to match existing convention
        // (session / asset / review / event). Foreign keys point at the
        // iPad-local ids; the backend ids (which may equal the local ids
        // once sync completes) are stored as plain text columns so we
        // can join across the wire.
        migrator.registerMigration("v3_creatorhub_one_foundation") { db in
            // PROJECT — slim mirror of ``projects`` table. Populated from
            // GET /api/capture/projects + /projects/:id. Drives the
            // "I dag" dashboard, the context panel, and the project
            // picker on the shoot tab.
            try db.create(table: "project") { t in
                t.primaryKey("id", .text)
                t.column("ownerUserId", .text).notNull()
                t.column("title", .text).notNull()
                t.column("clientName", .text)
                t.column("clientEmail", .text)
                t.column("eventDate", .datetime)   // ISO string on the wire
                t.column("location", .text)
                t.column("projectType", .text)
                t.column("status", .text).notNull().defaults(to: "active")
                // Full metadata blob so we can render contract terms,
                // pinterest mood links, special requests etc. without
                // a round-trip for every field.
                t.column("metadataJson", .text).notNull().defaults(to: "{}")
                // Shot list summary counters. The actual shots array
                // lives in the shot_list table so filtering doesn't
                // require decoding the full JSON.
                t.column("totalShots", .integer).notNull().defaults(to: 0)
                t.column("completedShots", .integer).notNull().defaults(to: 0)
                t.column("mustHaveShots", .integer).notNull().defaults(to: 0)
                t.column("completedMustHave", .integer).notNull().defaults(to: 0)
                t.column("updatedAt", .datetime).notNull()
                t.column("lastSyncedAt", .datetime)
            }
            try db.create(indexOn: "project", columns: ["ownerUserId", "eventDate"])
            try db.create(indexOn: "project", columns: ["status"])

            // SHOT_LIST — per-project list of planned shots. The shots
            // array is stored as TEXT holding JSON so it matches the
            // server's JSONB shape; application-level structs decode it.
            try db.create(table: "shotList") { t in
                t.primaryKey("id", .text)
                t.column("ownerUserId", .text).notNull()
                t.column("projectId", .text).notNull()
                    .references("project", onDelete: .cascade)
                t.column("listName", .text).notNull()
                t.column("eventType", .text).notNull()
                t.column("shotsJson", .text).notNull().defaults(to: "[]")
                t.column("updatedAt", .datetime).notNull()
                t.column("lastSyncedAt", .datetime)
            }
            try db.create(indexOn: "shotList", columns: ["projectId"])

            // CONTRACT — slim mirror of ``contracts`` needed for the
            // Apple Pencil signing flow and the context panel ("backup
            // photographer approved ✓"). pdfLocalPath points to a
            // locally cached PDF we render in PDFKit; pdfDriveFileId is
            // the canonical Drive file so signing can write back to the
            // same canonical location.
            try db.create(table: "contract") { t in
                t.primaryKey("id", .text)
                t.column("ownerUserId", .text).notNull()
                t.column("projectId", .text)
                    .references("project", onDelete: .setNull)
                t.column("clientName", .text).notNull()
                t.column("clientEmail", .text)
                t.column("status", .text).notNull()   // draft | sent | signed | expired
                t.column("termsJson", .text).notNull().defaults(to: "{}")
                t.column("pdfLocalPath", .text)
                t.column("pdfDriveFileId", .text)
                t.column("signatureDataRef", .text)   // opaque reference to PKDrawing archive
                t.column("signedAt", .datetime)
                t.column("updatedAt", .datetime).notNull()
                t.column("lastSyncedAt", .datetime)
            }
            try db.create(indexOn: "contract", columns: ["projectId"])
            try db.create(indexOn: "contract", columns: ["status"])

            // CLIENT_GALLERY — the photographer-POV mirror of
            // photographer_client_galleries, populated so the gallery
            // viewer tab works offline. accessToken is kept because the
            // photographer often shares the shareable URL from the iPad.
            try db.create(table: "clientGallery") { t in
                t.primaryKey("id", .text)
                t.column("ownerUserId", .text).notNull()
                t.column("projectId", .text)
                    .references("project", onDelete: .setNull)
                t.column("captureSessionId", .text)
                    .references("session", onDelete: .setNull)
                t.column("clientName", .text).notNull()
                t.column("clientEmail", .text).notNull()
                t.column("projectTitle", .text).notNull()
                t.column("accessToken", .text).notNull()
                t.column("shareUrl", .text)
                t.column("status", .text).notNull().defaults(to: "active")
                t.column("totalImages", .integer).notNull().defaults(to: 0)
                t.column("heartedImages", .integer).notNull().defaults(to: 0)
                t.column("commentedImages", .integer).notNull().defaults(to: 0)
                t.column("selectionStatus", .text)
                t.column("createdAt", .datetime).notNull()
                t.column("updatedAt", .datetime).notNull()
                t.column("lastSyncedAt", .datetime)
            }
            try db.create(indexOn: "clientGallery", columns: ["projectId"])
            try db.create(indexOn: "clientGallery", columns: ["captureSessionId"])

            // CULL_SUGGESTION_CACHE — cached /cull-suggestions response
            // per session and strictness level. Short TTL (15 min) so
            // revisiting the culling tab on the iPad doesn't re-spend
            // Claude tokens for every browse. invalidatedAt is NULL
            // until an asset mutation bumps it (rating change, flag
            // toggle, etc.).
            try db.create(table: "cullSuggestion") { t in
                t.primaryKey("id", .text)
                t.column("sessionId", .text).notNull()
                    .references("session", onDelete: .cascade)
                t.column("strictness", .text).notNull()   // conservative | balanced | aggressive
                t.column("bucketsJson", .text).notNull()  // full CullingSummary serialised
                t.column("fetchedAt", .datetime).notNull()
                t.column("invalidatedAt", .datetime)
            }
            try db.create(indexOn: "cullSuggestion", columns: ["sessionId", "strictness"])

            // OUTBOX_MUTATION — queued mutations that must sync back
            // to the backend. Every iPad-originated write is appended
            // here atomically with the local row update, and the sync
            // worker drains the queue when connectivity returns.
            //
            // Idempotency: clientMutationId is a client-generated UUID
            // passed as a header (X-Client-Mutation-Id) so the backend
            // can dedupe retries. We mark rows as ``syncing`` while a
            // flush is in flight, ``succeeded`` on 2xx, or ``failed``
            // (with a retry count) on network error. A row with
            // ``failed`` count >= 5 is parked and surfaced to the UI.
            try db.create(table: "outboxMutation") { t in
                t.autoIncrementedPrimaryKey("id")
                t.column("clientMutationId", .text).notNull().unique()
                t.column("endpoint", .text).notNull()        // e.g. "PATCH /api/capture/assets/:id"
                t.column("method", .text).notNull()          // GET|POST|PATCH|DELETE
                t.column("bodyJson", .text)
                t.column("entityTable", .text)               // local table the row belongs to
                t.column("entityId", .text)                  // row id we patched locally
                t.column("status", .text).notNull().defaults(to: "pending")
                t.column("attemptCount", .integer).notNull().defaults(to: 0)
                t.column("lastError", .text)
                t.column("createdAt", .datetime).notNull()
                t.column("updatedAt", .datetime).notNull()
            }
            try db.create(indexOn: "outboxMutation", columns: ["status", "createdAt"])
            try db.create(indexOn: "outboxMutation", columns: ["entityTable", "entityId"])
        }
        migrator.registerMigration("v4_asset_voice_memo") { db in
            // Per-asset voice memo recorded by the photographer mid-shoot
            // ("client wants this", "16:9 crop", "skin retouch needed").
            // Stored as a local file path; the file itself lives at
            // `<sessionDownloadDir>/voice-memos/<assetId>.m4a`. nil =
            // no memo. Cleared on disconnect along with the rest of the
            // session's tempDir, so memos are intentionally session-local
            // (not synced to backend yet — Phase 3).
            try db.alter(table: "asset") { t in
                t.add(column: "voiceMemoKey", .text)
            }
        }
        migrator.registerMigration("v5_asset_server_enhanced") { db in
            // Phase 5.4 — server-side AI enhancement key. After deliver,
            // the iPad asks the backend's photo-enhancer service to
            // process the picks; when a job completes we download the
            // resulting JPEG and stash its local path here. Distinct
            // from `enhancedKey` (in-app Magic / WYSIWYG RAW preview)
            // so the comparison-slider chip can toggle between them.
            // nil = enhancement not requested or not yet complete.
            try db.alter(table: "asset") { t in
                t.add(column: "serverEnhancedKey", .text)
            }
        }

        return migrator
    }()
}

// MARK: - Table names + Codable strategies

extension Session: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "session" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
    static func databaseUUIDEncodingStrategy(for column: String) -> DatabaseUUIDEncodingStrategy { .uppercaseString }
}

extension Asset: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "asset" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
    static func databaseUUIDEncodingStrategy(for column: String) -> DatabaseUUIDEncodingStrategy { .uppercaseString }
}

extension Review: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "review" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
    static func databaseUUIDEncodingStrategy(for column: String) -> DatabaseUUIDEncodingStrategy { .uppercaseString }
}

extension CaptureEvent: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "event" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
    static func databaseUUIDEncodingStrategy(for column: String) -> DatabaseUUIDEncodingStrategy { .uppercaseString }
}

// ── CreatorHub One v3 mirrors ───────────────────────────────────────

extension Project: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "project" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
}

extension ShotList: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "shotList" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
}

extension Contract: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "contract" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
}

extension ClientGallery: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "clientGallery" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
    static func databaseUUIDEncodingStrategy(for column: String) -> DatabaseUUIDEncodingStrategy { .uppercaseString }
}

extension CullSuggestionCache: FetchableRecord, PersistableRecord {
    static var databaseTableName: String { "cullSuggestion" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
    static func databaseUUIDEncodingStrategy(for column: String) -> DatabaseUUIDEncodingStrategy { .uppercaseString }
}

extension OutboxMutation: FetchableRecord, MutablePersistableRecord {
    static var databaseTableName: String { "outboxMutation" }
    static let databaseDateDecodingStrategy: DatabaseDateDecodingStrategy = .iso8601
    static let databaseDateEncodingStrategy: DatabaseDateEncodingStrategy = .iso8601
    mutating func didInsert(_ inserted: InsertionSuccess) {
        id = inserted.rowID
    }
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

extension Dictionary: DatabaseValueConvertible, StatementBinding, SQLExpressible where Key == String, Value == String {
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
