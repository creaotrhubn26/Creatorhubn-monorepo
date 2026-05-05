import Foundation
import GRDB

actor SessionStore {
    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    // MARK: - Sessions

    func createSession(
        name: String,
        clientId: UUID?,
        ownerUserId: String,
        startsAt: Date = .now
    ) async throws -> Session {
        let now = Date()
        let session = Session(
            id: UUID(),
            name: name,
            clientId: clientId,
            startsAt: startsAt,
            endsAt: nil,
            status: .active,
            ownerUserId: ownerUserId,
            createdAt: now,
            updatedAt: now
        )
        try await database.dbWriter.write { db in
            try session.insert(db)
        }
        return session
    }

    func fetchSession(id: UUID) async throws -> Session? {
        try await database.dbWriter.read { db in
            try Session.fetchOne(db, key: id.uuidString.uppercased())
        }
    }

    func listSessions(ownerUserId: String) async throws -> [Session] {
        try await database.dbWriter.read { db in
            try Session
                .filter(Column("ownerUserId") == ownerUserId)
                .order(Column("createdAt").desc)
                .fetchAll(db)
        }
    }

    func closeSession(id: UUID) async throws {
        try await database.dbWriter.write { db in
            guard var session = try Session.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            session.status = .closed
            session.endsAt = Date()
            session.updatedAt = Date()
            try session.update(db)
        }
    }

    /// Rename a session in place. Leaves everything else untouched.
    func renameSession(id: UUID, name: String) async throws {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        try await database.dbWriter.write { db in
            guard var session = try Session.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            session.name = trimmed
            session.updatedAt = Date()
            try session.update(db)
        }
    }

    // MARK: - Assets

    func createAsset(
        sessionId: UUID,
        descriptor: AssetDescriptor,
        initialState: AssetState = .anticipated
    ) async throws -> Asset {
        let now = Date()
        let asset = Asset(
            id: descriptor.id,
            sessionId: sessionId,
            originalFilename: descriptor.originalFilename,
            captureTime: descriptor.captureTime,
            previewKey: nil,
            fullKey: nil,
            rawKey: nil,
            voiceMemoKey: nil,
            serverEnhancedKey: nil,
            autoCleanedKey: nil,
            autoCleanedDetectionCount: nil,
            checksumSha256: nil,
            mime: descriptor.mime,
            sizeBytes: descriptor.sizeBytes,
            state: initialState,
            signals: .empty,
            rating: 0,
            colorLabel: nil,
            flaggedForClient: false,
            rejected: false,
            createdAt: now,
            updatedAt: now
        )
        try await database.dbWriter.write { db in
            try asset.insert(db)
        }
        return asset
    }

    func transitionAssetState(id: UUID, to newState: AssetState) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try Asset.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            asset.state = newState
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    func updateAssetLabels(
        id: UUID,
        rating: Int? = nil,
        colorLabel: ColorLabel?? = nil,
        flaggedForClient: Bool? = nil,
        rejected: Bool? = nil
    ) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try Asset.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            if let rating { asset.rating = rating }
            if let colorLabel { asset.colorLabel = colorLabel }
            if let flaggedForClient { asset.flaggedForClient = flaggedForClient }
            if let rejected { asset.rejected = rejected }
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    func updateAssetSignals(id: UUID, signals: AssetSignals) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try Asset.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            asset.signals = signals
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    func attachStorageKey(
        id: UUID,
        kind: DownloadKind,
        key: String,
        checksumSha256: String,
        sizeBytes: Int64
    ) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try Asset.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            switch kind {
            case .preview: asset.previewKey = key
            case .full:    asset.fullKey = key
            case .raw:     asset.rawKey = key
            }
            asset.checksumSha256 = checksumSha256
            asset.sizeBytes = sizeBytes
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    /// Attach a local file path pointing at the photo-enhancer result.
    /// In production this lands when backend receives a completion
    /// notification and the enhanced bytes are pulled back to the iPad.
    /// In demo mode the in-process enhancer simulator writes it directly.
    func attachEnhancedKey(id: UUID, key: String) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try Asset.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            asset.enhancedKey = key
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    /// Attach (or clear, by passing nil) the local voice-memo file path.
    /// Pure DB-side write; the actual m4a file is created/deleted by
    /// ``VoiceMemoService``. Updating `updatedAt` triggers the assets
    /// stream so any UI binding to the asset re-renders to show the
    /// memo affordance change.
    func attachVoiceMemoKey(id: UUID, key: String?) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try Asset.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            asset.voiceMemoKey = key
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    /// Phase 5.4 — attach the local path to a server-side AI-enhanced
    /// JPEG once the photo-enhancer job completes + the bytes have
    /// been downloaded back to the iPad. Distinct from
    /// `attachEnhancedKey` (in-app Magic preview) so the comparison
    /// slider can offer both alongside the camera-baked original.
    /// Pass nil to clear (job failed, photographer revoked, etc).
    func attachServerEnhancedKey(id: UUID, key: String?) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try Asset.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            asset.serverEnhancedKey = key
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    /// Slice 4 — attach the auto-clean variant. Called by
    /// AutoCleanService once the inpaint round-trip completes. Pass
    /// nil for `key` when the detection pass found nothing worth
    /// removing — `detectionCount = 0` lets the UI distinguish "ran,
    /// nothing to do" from "didn't run yet".
    func attachAutoCleanedKey(id: UUID, key: String?, detectionCount: Int) async throws {
        try await database.dbWriter.write { db in
            guard var asset = try Asset.fetchOne(db, key: id.uuidString.uppercased()) else { return }
            asset.autoCleanedKey = key
            asset.autoCleanedDetectionCount = detectionCount
            asset.updatedAt = Date()
            try asset.update(db)
        }
    }

    func fetchAsset(id: UUID) async throws -> Asset? {
        try await database.dbWriter.read { db in
            try Asset.fetchOne(db, key: id.uuidString.uppercased())
        }
    }

    func listAssets(sessionId: UUID) async throws -> [Asset] {
        try await database.dbWriter.read { db in
            try Asset
                .filter(Column("sessionId") == sessionId.uuidString.uppercased())
                .order(Column("captureTime").asc)
                .fetchAll(db)
        }
    }

    // MARK: - Events (append-only)

    func appendEvent(
        sessionId: UUID,
        assetId: UUID? = nil,
        actorId: String,
        eventType: CaptureEvent.EventType,
        metadata: [String: String] = [:]
    ) async throws {
        let event = CaptureEvent(
            id: UUID(),
            sessionId: sessionId,
            assetId: assetId,
            actorId: actorId,
            eventType: eventType,
            metadata: metadata,
            createdAt: Date()
        )
        try await database.dbWriter.write { db in
            try event.insert(db)
        }
    }

    func listEvents(sessionId: UUID, limit: Int? = nil) async throws -> [CaptureEvent] {
        try await database.dbWriter.read { db in
            var request = CaptureEvent
                .filter(Column("sessionId") == sessionId.uuidString.uppercased())
                .order(Column("createdAt").asc)
            if let limit {
                request = request.limit(limit)
            }
            return try request.fetchAll(db)
        }
    }

    // MARK: - Reviews

    func addReview(_ review: Review) async throws {
        try await database.dbWriter.write { db in
            try review.insert(db)
        }
    }

    func listReviews(assetId: UUID) async throws -> [Review] {
        try await database.dbWriter.read { db in
            try Review
                .filter(Column("assetId") == assetId.uuidString.uppercased())
                .order(Column("createdAt").asc)
                .fetchAll(db)
        }
    }

    // MARK: - Observation

    nonisolated func sessionsStream(ownerUserId: String) -> AsyncStream<[Session]> {
        let writer = database.dbWriter
        return AsyncStream { continuation in
            let observation = ValueObservation.tracking { db in
                try Session
                    .filter(Column("ownerUserId") == ownerUserId)
                    .order(Column("createdAt").desc)
                    .fetchAll(db)
            }
            let cancellable = observation.start(
                in: writer,
                onError: { _ in continuation.finish() },
                onChange: { continuation.yield($0) }
            )
            continuation.onTermination = { _ in cancellable.cancel() }
        }
    }

    nonisolated func assetsStream(sessionId: UUID) -> AsyncStream<[Asset]> {
        let writer = database.dbWriter
        return AsyncStream { continuation in
            let observation = ValueObservation.tracking { db in
                try Asset
                    .filter(Column("sessionId") == sessionId.uuidString.uppercased())
                    .order(Column("captureTime").asc)
                    .fetchAll(db)
            }
            let cancellable = observation.start(
                in: writer,
                onError: { _ in continuation.finish() },
                onChange: { continuation.yield($0) }
            )
            continuation.onTermination = { _ in cancellable.cancel() }
        }
    }
}
