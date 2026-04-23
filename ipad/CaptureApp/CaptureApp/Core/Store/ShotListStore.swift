import Foundation
import GRDB

/// Read + mutate surface for a project's shot list. Every mutation
/// follows the offline-first pattern:
///
///   1. Update the local GRDB row inside a write transaction.
///   2. Append a queued ``OutboxMutation`` inside the *same*
///      transaction so local state and pending sync can never
///      disagree.
///
/// If the app crashes between steps 1 and 2, GRDB rolls the whole
/// thing back — the photographer's local view stays consistent with
/// what the sync worker will eventually push.
///
/// The backend contract (``POST /api/projects/:projectId/shot-list``)
/// takes the *full* shots array. So every per-shot mutation rewrites
/// the whole list client-side and queues a single PATCH — not
/// because that's optimal over the wire, but because the server's
/// upsert endpoint is idempotent on the full array and the round-
/// trip cost is negligible for typical shot lists (20-60 items).
struct ShotListStore: Sendable {
    let database: AppDatabase
    let outbox: Outbox

    // MARK: - Reads

    /// Load the shot list for a project — one row, or nil when the
    /// project has no list yet (photographer hasn't planned yet).
    func load(
        projectId: String,
        ownerUserId: String,
    ) async throws -> ShotList? {
        try await database.dbWriter.read { db in
            try ShotList
                .filter(Column("ownerUserId") == ownerUserId)
                .filter(Column("projectId") == projectId)
                .fetchOne(db)
        }
    }

    /// Create an empty shot list for a project so the photographer
    /// can start adding items. Also queues a POST so the server
    /// mirror comes into existence. Returns the created row.
    @discardableResult
    func createEmpty(
        projectId: String,
        ownerUserId: String,
        listName: String = "Primary shot list",
        eventType: String = "photo_session",
    ) async throws -> ShotList {
        let row = ShotList(
            id: UUID().uuidString.lowercased(),
            ownerUserId: ownerUserId,
            projectId: projectId,
            listName: listName,
            eventType: eventType,
            shotsJson: "[]",
            updatedAt: Date(),
            lastSyncedAt: nil,
        )
        try await database.dbWriter.write { db in
            try row.insert(db)
            try outbox.enqueueInTransaction(
                db,
                endpoint: "/api/projects/\(projectId)/shot-list",
                method: .post,
                body: OutboxShotListPayload(
                    shots: [],
                    listName: listName,
                    eventType: eventType,
                ),
                entityTable: "shotList",
                entityId: row.id,
            )
        }
        return row
    }

    // MARK: - Mutations

    /// Toggle ``isCompleted`` on a single shot and optionally link an
    /// asset that fulfilled it. The whole list is rewritten locally +
    /// queued because the backend endpoint is array-based.
    func toggleCompletion(
        shotId: String,
        in list: ShotList,
        capturedAssetId: String? = nil,
    ) async throws {
        try await mutate(list) { shots in
            for i in shots.indices where shots[i].id == shotId {
                let becomes = !(shots[i].isCompleted ?? false)
                shots[i].isCompleted = becomes
                if becomes {
                    shots[i].capturedAssetId = capturedAssetId ?? shots[i].capturedAssetId
                } else {
                    shots[i].capturedAssetId = nil
                }
            }
        }
    }

    /// Replace the ``notes`` text on a shot — used by the Pencil
    /// detail view when the photographer types a short caption.
    func updateNotes(
        shotId: String,
        in list: ShotList,
        notes: String,
    ) async throws {
        try await mutate(list) { shots in
            for i in shots.indices where shots[i].id == shotId {
                shots[i].notes = notes.isEmpty ? nil : notes
            }
        }
    }

    /// Save Apple Pencil ink (base64 PKDrawing) onto a shot. ``nil``
    /// clears the drawing. Upper-bound at ~2MB raw bytes to protect
    /// the JSON payload — anything larger is almost certainly a bug
    /// and we want to fail loud rather than ship a half-meg doodle
    /// through every future sync.
    func saveInk(
        shotId: String,
        in list: ShotList,
        base64Ink: String?,
    ) async throws {
        if let ink = base64Ink, ink.count > 2_800_000 {
            throw ShotListStoreError.inkTooLarge(bytes: ink.count)
        }
        try await mutate(list) { shots in
            for i in shots.indices where shots[i].id == shotId {
                shots[i].inkData = base64Ink
            }
        }
    }

    /// Add a new shot to the end of the list — typical mid-shoot
    /// pattern where the photographer realises they need a frame
    /// that wasn't planned. Auto-generates a fresh id so callers
    /// don't have to.
    @discardableResult
    func addShot(
        to list: ShotList,
        scene: String,
        priority: String? = nil,
    ) async throws -> ShotListItem {
        let newShot = ShotListItem(
            id: UUID().uuidString.lowercased(),
            scene: scene,
            description: nil,
            estimatedDuration: nil,
            priority: priority,
            shotType: nil,
            locationName: nil,
            notes: nil,
            scouted: nil,
            isCompleted: false,
            capturedAssetId: nil,
            inkData: nil,
        )
        try await mutate(list) { shots in
            shots.append(newShot)
        }
        return newShot
    }

    /// Delete a shot from the list — used when the photographer
    /// decides a planned shot isn't happening.
    func removeShot(
        shotId: String,
        in list: ShotList,
    ) async throws {
        try await mutate(list) { shots in
            shots.removeAll { $0.id == shotId }
        }
    }

    // MARK: - Internal

    private func mutate(
        _ list: ShotList,
        _ transform: @Sendable (inout [ShotListItem]) -> Void,
    ) async throws {
        // Re-fetch inside the transaction so back-to-back mutations
        // don't stomp on each other. The caller's ``list`` snapshot
        // is used only for ``id`` — the authoritative state comes
        // from the row we just locked for write. Without this, two
        // ``addShot`` calls in a row would both use the same stale
        // baseline and the second would overwrite the first.
        let listId = list.id
        try await database.dbWriter.write { db in
            guard var current = try ShotList.fetchOne(db, key: listId) else {
                throw ShotListStoreError.listDisappeared(id: listId)
            }
            var shots = current.shots
            transform(&shots)
            current.shots = shots
            current.updatedAt = Date()
            try current.update(db)
            try outbox.enqueueInTransaction(
                db,
                endpoint: "/api/projects/\(current.projectId)/shot-list",
                method: .post,
                body: OutboxShotListPayload(
                    shots: shots,
                    listName: current.listName,
                    eventType: current.eventType,
                ),
                entityTable: "shotList",
                entityId: current.id,
            )
        }
    }
}

enum ShotListStoreError: Error, CustomStringConvertible, Equatable {
    case inkTooLarge(bytes: Int)
    case listDisappeared(id: String)
    var description: String {
        switch self {
        case let .listDisappeared(id):
            return "Shot-listen (\(id)) ble slettet mens vi forsøkte å endre den."
        case let .inkTooLarge(bytes):
            return "Apple Pencil-tegningen er for stor (\(bytes) bytes) — maks 2.8MB."
        }
    }
}

/// Shape of the body we send to ``POST /api/projects/:id/shot-list``.
/// Private to this file because nobody else should be sending this
/// payload — all writes go through ``ShotListStore``.
private struct OutboxShotListPayload: Encodable {
    let shots: [ShotListItem]
    let listName: String
    let eventType: String
}
