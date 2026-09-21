import Foundation
import XCTest
@testable import CaptureApp

final class PhotoStorageSafetyTests: XCTestCase {
    func testVerifiedCloudOnlyReleaseDeletesOriginalsButKeepsPreview() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("photo-retention-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let preview = root.appendingPathComponent("preview.jpg")
        let full = root.appendingPathComponent("full.jpg")
        let raw = root.appendingPathComponent("original.cr3")
        try Data("preview".utf8).write(to: preview)
        try Data("full".utf8).write(to: full)
        try Data("raw".utf8).write(to: raw)

        let asset = makeAsset(
            preview: preview.path,
            full: full.path,
            raw: raw.path,
            cloudState: .secured
        )
        let released = try PhotoLocalOriginalRetention.releaseVerifiedOriginals(
            for: asset,
            managedRoot: root
        )

        XCTAssertEqual(released, Set([full.path, raw.path]))
        XCTAssertTrue(FileManager.default.fileExists(atPath: preview.path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: full.path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: raw.path))
    }

    func testUnverifiedUploadNeverDeletesOriginal() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("photo-unverified-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let full = root.appendingPathComponent("full.jpg")
        try Data("full".utf8).write(to: full)

        let asset = makeAsset(preview: nil, full: full.path, raw: nil, cloudState: .uploading)
        XCTAssertThrowsError(
            try PhotoLocalOriginalRetention.releaseVerifiedOriginals(for: asset, managedRoot: root)
        ) { error in
            XCTAssertEqual(error as? PhotoLocalOriginalRetention.Failure, .uploadNotVerified)
        }
        XCTAssertTrue(FileManager.default.fileExists(atPath: full.path))
    }

    func testOutsideManagedRootRejectsWholeReleaseBeforeDeletingAnything() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("photo-managed-\(UUID().uuidString)", isDirectory: true)
        let outsideRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("photo-unmanaged-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: outsideRoot, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: root)
            try? FileManager.default.removeItem(at: outsideRoot)
        }
        let inside = root.appendingPathComponent("full.jpg")
        let outside = outsideRoot.appendingPathComponent("original.cr3")
        try Data("inside".utf8).write(to: inside)
        try Data("outside".utf8).write(to: outside)

        let asset = makeAsset(
            preview: nil,
            full: inside.path,
            raw: outside.path,
            cloudState: .secured
        )
        XCTAssertThrowsError(
            try PhotoLocalOriginalRetention.releaseVerifiedOriginals(for: asset, managedRoot: root)
        ) { error in
            XCTAssertEqual(error as? PhotoLocalOriginalRetention.Failure, .unmanagedFile)
        }
        XCTAssertTrue(FileManager.default.fileExists(atPath: inside.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: outside.path))
    }

    func testSessionStorePersistsPerPhotoPolicyAndVerifiedState() async throws {
        let store = SessionStore(database: try AppDatabase.inMemory())
        let session = try await store.createSession(
            name: "Storage policy",
            clientId: nil,
            ownerUserId: "owner"
        )
        let id = UUID()
        _ = try await store.createAsset(
            sessionId: session.id,
            descriptor: AssetDescriptor(
                id: id,
                originalFilename: "IMG_0001.JPG",
                captureTime: Date(),
                mime: "image/jpeg",
                sizeBytes: 123
            ),
            storagePolicy: .creatorHubOnly
        )
        let backendId = UUID()
        let verifiedAt = Date()
        try await store.updateAssetCloudState(
            id: id,
            state: .secured,
            backendAssetId: backendId,
            verifiedAt: verifiedAt
        )

        let fetched = try await store.fetchAsset(id: id)
        let stored = try XCTUnwrap(fetched)
        XCTAssertEqual(stored.storagePolicy, .creatorHubOnly)
        XCTAssertEqual(stored.cloudState, .secured)
        XCTAssertEqual(stored.backendAssetId, backendId)
        XCTAssertNotNil(stored.cloudVerifiedAt)
    }

    func testAutomaticPurgeOnlyAllowsVerifiedCreatorHubOnlyPhotos() async throws {
        let store = SessionStore(database: try AppDatabase.inMemory())

        let localSession = try await store.createSession(
            name: "Local", clientId: nil, ownerUserId: "owner"
        )
        _ = try await store.createAsset(
            sessionId: localSession.id,
            descriptor: descriptor(named: "local.JPG"),
            storagePolicy: .localOnly
        )
        let mayPurgeLocal = try await store.canAutomaticallyPurgeSession(id: localSession.id)
        XCTAssertFalse(mayPurgeLocal)

        let retainedSession = try await store.createSession(
            name: "Local and cloud", clientId: nil, ownerUserId: "owner"
        )
        let retained = try await store.createAsset(
            sessionId: retainedSession.id,
            descriptor: descriptor(named: "retained.JPG"),
            storagePolicy: .keepLocalAndCloud
        )
        try await store.updateAssetCloudState(id: retained.id, state: .secured, verifiedAt: .now)
        let mayPurgeRetained = try await store.canAutomaticallyPurgeSession(id: retainedSession.id)
        XCTAssertFalse(mayPurgeRetained)

        let pendingSession = try await store.createSession(
            name: "Pending cloud", clientId: nil, ownerUserId: "owner"
        )
        _ = try await store.createAsset(
            sessionId: pendingSession.id,
            descriptor: descriptor(named: "pending.JPG"),
            storagePolicy: .creatorHubOnly
        )
        let mayPurgePending = try await store.canAutomaticallyPurgeSession(id: pendingSession.id)
        XCTAssertFalse(mayPurgePending)

        let securedSession = try await store.createSession(
            name: "Secured cloud", clientId: nil, ownerUserId: "owner"
        )
        let secured = try await store.createAsset(
            sessionId: securedSession.id,
            descriptor: descriptor(named: "secured.JPG"),
            storagePolicy: .creatorHubOnly
        )
        try await store.updateAssetCloudState(id: secured.id, state: .secured, verifiedAt: .now)
        let mayPurgeSecured = try await store.canAutomaticallyPurgeSession(id: securedSession.id)
        XCTAssertTrue(mayPurgeSecured)
    }

    private func descriptor(named filename: String) -> AssetDescriptor {
        AssetDescriptor(
            id: UUID(),
            originalFilename: filename,
            captureTime: .now,
            mime: "image/jpeg",
            sizeBytes: 123
        )
    }

    private func makeAsset(
        preview: String?,
        full: String?,
        raw: String?,
        cloudState: Asset.CloudState
    ) -> Asset {
        let now = Date()
        return Asset(
            id: UUID(),
            sessionId: UUID(),
            originalFilename: "IMG_0001.CR3",
            captureTime: now,
            previewKey: preview,
            fullKey: full,
            rawKey: raw,
            enhancedKey: nil,
            voiceMemoKey: nil,
            serverEnhancedKey: nil,
            autoCleanedKey: nil,
            autoCleanedDetectionCount: nil,
            pendingDetections: nil,
            checksumSha256: nil,
            mime: "image/x-canon-cr3",
            sizeBytes: nil,
            storagePolicy: .creatorHubOnly,
            cloudState: cloudState,
            state: .rawReady,
            signals: .empty,
            rating: 0,
            colorLabel: nil,
            flaggedForClient: false,
            rejected: false,
            createdAt: now,
            updatedAt: now
        )
    }
}
