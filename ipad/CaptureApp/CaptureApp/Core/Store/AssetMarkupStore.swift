import Foundation
import GRDB

/// Read + mutate markup layers on capture assets. Markups are
/// photographer notes drawn with Apple Pencil on top of a preview
/// during Live Cull: crop hints, "remove background person",
/// retouch-arrow pointing at a blemish. The web editor reads these
/// back when running the full retouch pass.
///
/// Persistence is split: the PKDrawing + PNG bytes live on disk
/// (``MarkupStorage``) and the asset row carries only an opaque
/// ``signals.markupRef`` string. That keeps the ``asset`` row small
/// + fast to read, avoids SQLite LOB overhead, and lets us sweep
/// orphaned markup directories with a filesystem walk.
///
/// Like ``ContractStore``, every write is atomic: save the file,
/// then update the row + enqueue the backend PATCH inside one GRDB
/// transaction. Failing halfway rolls back the DB so the file stays
/// but the local row still points at the old ref — next sweep
/// cleans up.
struct AssetMarkupStore: Sendable {
    let database: AppDatabase
    let outbox: Outbox
    let markupStorage: MarkupStorage

    // MARK: - Reads

    /// Load the markup for a single asset. Returns nil when the
    /// asset has no markup, or when the row belongs to another
    /// photographer.
    func load(
        assetId: UUID,
        ownerUserId: String,
    ) async throws -> MarkupCapture? {
        let row = try await database.dbWriter.read { db in
            try Asset.fetchOne(
                db,
                sql: """
                SELECT asset.*
                FROM asset
                JOIN session ON session.id = asset.sessionId
                WHERE asset.id = ?
                  AND session.ownerUserId = ?
                """,
                arguments: [
                    assetId.uuidString.uppercased(),
                    ownerUserId
                ],
            )
        }
        guard let ref = row?.signals.markupRef else { return nil }
        return try markupStorage.load(ref: ref)
    }

    // MARK: - Mutations

    /// Save a markup layer to disk, stamp the new ref onto
    /// ``asset.signals.markupRef``, enqueue a PATCH to
    /// ``/api/capture/assets/:id/signals`` so the web editor can
    /// read it when running the retouch pass. Deletes the prior
    /// markup file after the row is updated — best-effort, next
    /// sweep picks up anything we missed.
    @discardableResult
    func save(
        assetId: UUID,
        ownerUserId: String,
        capture: MarkupCapture,
    ) async throws -> Asset {
        guard !capture.isEmpty else {
            throw AssetMarkupStoreError.emptyMarkup
        }
        guard let newRef = try markupStorage.save(capture) else {
            throw AssetMarkupStoreError.emptyMarkup
        }

        // Return the old-ref alongside the updated asset so the
        // writer closure stays free of captured-var mutation
        // (Swift 6 strict-concurrency rejects outer-var writes from
        // @Sendable closures).
        let result = try await database.dbWriter.write { db -> (Asset, String?) in
            guard var asset = try Asset.fetchOne(
                db,
                sql: """
                SELECT asset.*
                FROM asset
                JOIN session ON session.id = asset.sessionId
                WHERE asset.id = ?
                  AND session.ownerUserId = ?
                """,
                arguments: [
                    assetId.uuidString.uppercased(),
                    ownerUserId
                ],
            ) else {
                throw AssetMarkupStoreError.notFound
            }
            let oldRef = asset.signals.markupRef

            var signals = asset.signals
            signals.markupRef = newRef
            asset.signals = signals
            asset.updatedAt = Date()
            try asset.update(db)

            // Backend contract: PUT /api/capture/assets/:id/signals
            // takes the full updated signals blob. Mirrors the
            // pattern we already use for updateAssetSignals in the
            // existing capture flow.
            try outbox.enqueueInTransaction(
                db,
                endpoint: "/api/capture/assets/\(assetId.uuidString.lowercased())/signals",
                method: .put,
                body: signals,
                entityTable: "asset",
                entityId: assetId.uuidString.uppercased(),
            )
            return (asset, oldRef)
        }

        let (updated, oldRefToDelete) = result
        if let oldRef = oldRefToDelete, oldRef != newRef {
            try? markupStorage.delete(ref: oldRef)
        }
        return updated
    }

    /// Clear the markup from an asset. Reverts
    /// ``signals.markupRef`` to nil, enqueues the PUT so the server
    /// follows, deletes the local file.
    func clear(
        assetId: UUID,
        ownerUserId: String,
    ) async throws -> Asset {
        let result = try await database.dbWriter.write { db -> (Asset, String?) in
            guard var asset = try Asset.fetchOne(
                db,
                sql: """
                SELECT asset.*
                FROM asset
                JOIN session ON session.id = asset.sessionId
                WHERE asset.id = ?
                  AND session.ownerUserId = ?
                """,
                arguments: [
                    assetId.uuidString.uppercased(),
                    ownerUserId
                ],
            ) else {
                throw AssetMarkupStoreError.notFound
            }
            let oldRef = asset.signals.markupRef

            var signals = asset.signals
            signals.markupRef = nil
            asset.signals = signals
            asset.updatedAt = Date()
            try asset.update(db)

            try outbox.enqueueInTransaction(
                db,
                endpoint: "/api/capture/assets/\(assetId.uuidString.lowercased())/signals",
                method: .put,
                body: signals,
                entityTable: "asset",
                entityId: assetId.uuidString.uppercased(),
            )
            return (asset, oldRef)
        }
        let (updated, oldRef) = result
        if let ref = oldRef {
            try? markupStorage.delete(ref: ref)
        }
        return updated
    }
}

enum AssetMarkupStoreError: Error, Equatable, CustomStringConvertible {
    case emptyMarkup
    case notFound

    var description: String {
        switch self {
        case .emptyMarkup: return "Tegningen er tom — ingenting å lagre."
        case .notFound:    return "Bildet finnes ikke (eller tilhører en annen fotograf)."
        }
    }
}
