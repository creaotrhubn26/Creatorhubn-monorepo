import Foundation
import GRDB

/// Read + mutate surface for contracts on the iPad. Mirrors the
/// offline-first pattern used everywhere else in CreatorHub One:
/// every signature write updates the local row *and* appends a
/// queued ``OutboxMutation`` in a single GRDB transaction, so the
/// two can never disagree.
///
/// Signatures themselves live on the filesystem (``SignatureStorage``)
/// rather than inline in SQLite — PKDrawing + PNG bytes together
/// are ~30-100 kB and would make every contract row read slower. We
/// store only the opaque ref string (``contract.signatureDataRef``)
/// on the row.
///
/// Network side: applying a signature queues a POST to
/// ``/api/contracts/:id/google-esignature`` with the rendered PNG
/// base64-encoded. The backend already exists (I saw it in the
/// UniversalContractHub wiring) and also handles Drive write-back
/// when configured.
struct ContractStore: Sendable {
    let database: AppDatabase
    let outbox: Outbox
    let signatureStorage: SignatureStorage

    // MARK: - Reads

    func load(
        contractId: String,
        ownerUserId: String,
    ) async throws -> Contract? {
        try await database.dbWriter.read { db in
            try Contract
                .filter(Column("id") == contractId)
                .filter(Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
        }
    }

    /// All contracts for the owner, optionally scoped to a project.
    /// Sorted updatedAt desc so the most-recently-touched contract
    /// appears first — usually what the photographer wants to sign.
    func list(
        ownerUserId: String,
        projectId: String? = nil,
    ) async throws -> [Contract] {
        try await database.dbWriter.read { db in
            var request = Contract
                .filter(Column("ownerUserId") == ownerUserId)
                .order(Column("updatedAt").desc)
            if let projectId {
                request = request.filter(Column("projectId") == projectId)
            }
            return try request.fetchAll(db)
        }
    }

    // MARK: - Signature

    /// Apply a ``SignatureCapture`` to a contract: persist the PNG
    /// + drawing to the signatures directory, update the local row
    /// with the new ref + status + signedAt, and queue the backend
    /// POST. All three steps are serialised so the outcome is
    /// "signed locally + queued for sync" or "nothing changed" —
    /// never half-done.
    ///
    /// If the contract already has a prior signature the old files
    /// are deleted after the new ref is committed. That's done
    /// outside the transaction because file deletion isn't
    /// atomic with a SQLite commit; the tiny risk is that a crash
    /// between "new ref written" and "old files deleted" leaves
    /// stray disk use. Sweep on boot handles that.
    @discardableResult
    func applySignature(
        contractId: String,
        ownerUserId: String,
        capture: SignatureCapture,
    ) async throws -> Contract {
        guard !capture.isEmpty else {
            throw ContractStoreError.emptySignature
        }

        // Persist the signature to disk first; if that fails there's
        // no point touching the DB.
        guard let newRef = try signatureStorage.save(capture) else {
            throw ContractStoreError.emptySignature
        }

        let pngBase64 = capture.pngData.base64EncodedString()

        // Return the old-ref alongside the updated contract so the
        // writer closure doesn't mutate a captured outer var
        // (Swift 6 strict-concurrency rejects that in @Sendable
        // closures).
        let result = try await database.dbWriter.write { db -> (Contract, String?) in
            guard var contract = try Contract
                .filter(Column("id") == contractId)
                .filter(Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
            else {
                throw ContractStoreError.notFound
            }
            let oldRef = contract.signatureDataRef
            contract.signatureDataRef = newRef
            contract.status = .signed
            contract.signedAt = Date()
            contract.updatedAt = Date()
            try contract.update(db)

            try outbox.enqueueInTransaction(
                db,
                endpoint: "/api/contracts/\(contractId)/google-esignature",
                method: .post,
                body: SignatureUploadBody(
                    signedAt: contract.signedAt ?? Date(),
                    signaturePngBase64: pngBase64,
                ),
                entityTable: "contract",
                entityId: contractId,
            )
            return (contract, oldRef)
        }

        let (updated, oldRefToDelete) = result
        // Best-effort cleanup of the prior signature file. Swallowing
        // the error is intentional — the contract row is already
        // signed; a stale directory will be cleaned by the next
        // sweep rather than rolled back.
        if let oldRef = oldRefToDelete, oldRef != newRef {
            try? signatureStorage.delete(ref: oldRef)
        }
        return updated
    }

    /// Remove the signature and revert the contract to draft. Used
    /// when the client rejects a version; the photographer can
    /// re-sign the corrected copy later.
    func clearSignature(
        contractId: String,
        ownerUserId: String,
    ) async throws -> Contract {
        let result = try await database.dbWriter.write { db -> (Contract, String?) in
            guard var contract = try Contract
                .filter(Column("id") == contractId)
                .filter(Column("ownerUserId") == ownerUserId)
                .fetchOne(db)
            else {
                throw ContractStoreError.notFound
            }
            let oldRef = contract.signatureDataRef
            contract.signatureDataRef = nil
            contract.status = .draft
            contract.signedAt = nil
            contract.updatedAt = Date()
            try contract.update(db)

            try outbox.enqueueInTransaction(
                db,
                endpoint: "/api/contracts/\(contractId)/google-esignature",
                method: .delete,
                body: Optional<SignatureUploadBody>.none,
                entityTable: "contract",
                entityId: contractId,
            )
            return (contract, oldRef)
        }
        let (updated, oldRef) = result
        if let ref = oldRef {
            try? signatureStorage.delete(ref: ref)
        }
        return updated
    }
}

enum ContractStoreError: Error, Equatable, CustomStringConvertible {
    case notFound
    case emptySignature

    var description: String {
        switch self {
        case .notFound:
            return "Kontrakten finnes ikke."
        case .emptySignature:
            return "Signaturen er tom — tegn noe først."
        }
    }
}

/// POST body for the signature upload endpoint. PNG base64 is sent
/// inline; the backend stores it against the contract row and
/// (when configured) writes the signed PDF back to Drive.
private struct SignatureUploadBody: Encodable {
    let signedAt: Date
    let signaturePngBase64: String
}
