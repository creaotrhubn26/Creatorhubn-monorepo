import Foundation
import GRDB

/// Swipe decisions the photographer makes on each asset during Live
/// Cull. Mapped to backend fields on commit:
///
///   hero   → rating 5, flaggedForClient true  — absolute best,
///            client sees these first.
///   keep   → rating 4                         — normal working shot.
///   weak   → rating 2                         — soft reject, maybe.
///   reject → rating 0, rejected true          — hard reject, delete.
///
/// Kept as a separate enum (not just rating) so the UI can present
/// direction-specific affordances (hero-colour, reject-colour) and
/// the commit logic is a single switch — no scattered magic numbers
/// for "rating >= 5 means flag".
enum CullDecision: String, Sendable, CaseIterable {
    case hero
    case keep
    case weak
    case reject
}

/// Read + commit surface for Live Cull. Mirrors the offline-first
/// pattern used across CreatorHub One: every decision writes to the
/// local ``asset`` row *and* enqueues the PATCH to
/// ``/api/capture/assets/:id`` inside the same GRDB transaction, so
/// the two can never disagree.
///
/// The iPad's Live Cull surface streams through assets in
/// capture-time order. Committed decisions stay on the asset row
/// (``rating`` / ``rejected`` / ``flaggedForClient``) which the
/// backend culling service already reads — so the web review
/// surface, the iPad culling view, and the showcase bridge all see
/// the same truth.
struct CullStore: Sendable {
    let database: AppDatabase
    let outbox: Outbox

    // MARK: - Reads

    /// All assets for a session ordered by capture time. The Live
    /// Cull view streams through these left to right. Pass
    /// ``undecidedOnly`` = true to hide frames the photographer has
    /// already rated — useful when resuming a cull session.
    func assets(
        sessionId: UUID,
        ownerUserId: String,
        undecidedOnly: Bool = false,
    ) async throws -> [Asset] {
        try await database.dbWriter.read { db in
            // Ownership gate: asset's session must belong to the
            // photographer. We fetch the session's ownerUserId by
            // join. When undecidedOnly is set, we also filter out
            // flagged/rejected/rated frames.
            let sql: String
            var args: [DatabaseValueConvertible?] = [
                sessionId.uuidString.uppercased(),
                ownerUserId
            ]
            if undecidedOnly {
                sql = """
                SELECT asset.*
                FROM asset
                JOIN session ON session.id = asset.sessionId
                WHERE asset.sessionId = ?
                  AND session.ownerUserId = ?
                  AND asset.rating = 0
                  AND asset.flaggedForClient = 0
                  AND asset.rejected = 0
                ORDER BY asset.captureTime ASC
                """
            } else {
                sql = """
                SELECT asset.*
                FROM asset
                JOIN session ON session.id = asset.sessionId
                WHERE asset.sessionId = ?
                  AND session.ownerUserId = ?
                ORDER BY asset.captureTime ASC
                """
            }
            return try Asset.fetchAll(db, sql: sql, arguments: StatementArguments(args)!)
        }
    }

    /// Quick count for the progress chip at the top of Live Cull.
    /// Fast — no decoding, just a COUNT query.
    func totalAssets(
        sessionId: UUID,
        ownerUserId: String,
    ) async throws -> Int {
        try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: """
                SELECT COUNT(*) FROM asset
                JOIN session ON session.id = asset.sessionId
                WHERE asset.sessionId = ? AND session.ownerUserId = ?
                """,
                arguments: [
                    sessionId.uuidString.uppercased(),
                    ownerUserId
                ],
            ) ?? 0
        }
    }

    func decidedAssets(
        sessionId: UUID,
        ownerUserId: String,
    ) async throws -> Int {
        try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: """
                SELECT COUNT(*) FROM asset
                JOIN session ON session.id = asset.sessionId
                WHERE asset.sessionId = ?
                  AND session.ownerUserId = ?
                  AND (asset.rating != 0 OR asset.flaggedForClient = 1 OR asset.rejected = 1)
                """,
                arguments: [
                    sessionId.uuidString.uppercased(),
                    ownerUserId
                ],
            ) ?? 0
        }
    }

    // MARK: - Commit

    /// Write the decision to the asset row and enqueue the backend
    /// PATCH atomically. Returns the updated asset so the UI can
    /// immediately reflect the new state without a re-fetch.
    @discardableResult
    func apply(
        _ decision: CullDecision,
        to assetId: UUID,
        ownerUserId: String,
    ) async throws -> Asset? {
        try await database.dbWriter.write { db in
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
                return nil
            }

            Self.apply(decision, toAsset: &asset)
            asset.updatedAt = Date()
            try asset.update(db)

            try outbox.enqueueInTransaction(
                db,
                endpoint: "/api/capture/assets/\(assetId.uuidString.lowercased())",
                method: .patch,
                body: CullPatchBody(
                    rating: asset.rating,
                    flaggedForClient: asset.flaggedForClient,
                    rejected: asset.rejected,
                ),
                entityTable: "asset",
                entityId: assetId.uuidString.uppercased(),
            )
            return asset
        }
    }

    /// Pure mapping from ``CullDecision`` onto the three backend
    /// fields. Extracted so tests can pin the invariants (hero
    /// always flags, reject always rejects) without needing a
    /// database.
    static func apply(_ decision: CullDecision, toAsset asset: inout Asset) {
        switch decision {
        case .hero:
            asset.rating = 5
            asset.flaggedForClient = true
            asset.rejected = false
        case .keep:
            asset.rating = 4
            asset.flaggedForClient = false
            asset.rejected = false
        case .weak:
            asset.rating = 2
            asset.flaggedForClient = false
            asset.rejected = false
        case .reject:
            asset.rating = 0
            asset.flaggedForClient = false
            asset.rejected = true
        }
    }
}

/// Body shape for ``PATCH /api/capture/assets/:id``. Private — only
/// ``CullStore`` should be sending this payload.
private struct CullPatchBody: Encodable {
    let rating: Int
    let flaggedForClient: Bool
    let rejected: Bool
}
