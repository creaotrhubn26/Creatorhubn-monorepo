import Foundation
import Testing
@testable import CaptureApp

struct VideoCaptureStoreTests {
    @Test func persistsProjectScopedTakesAndFindsPendingUploads() async throws {
        let store = try VideoCaptureStore(database: .inMemory())
        let first = sample(id: "a", projectId: "project-a", take: 1, state: .local)
        let second = sample(id: "b", projectId: "project-a", take: 2, state: .ready)
        let other = sample(id: "c", projectId: "project-b", take: 1, state: .failed)
        try await store.save(first)
        try await store.save(second)
        try await store.save(other)

        let projectAssets = try await store.list(ownerUserId: "owner", projectId: "project-a")
        #expect(Set(projectAssets.map(\.id)) == Set(["a", "b"]))
        let pending = try await store.pending(ownerUserId: "owner")
        #expect(Set(pending.map(\.id)) == Set(["a", "c"]))
        #expect(try await store.nextTakeNumber(
            ownerUserId: "owner", projectId: "project-a", slate: "A001"
        ) == 3)
    }

    @Test func stateUpdatesKeepTheOriginalLocalFileReference() async throws {
        let store = try VideoCaptureStore(database: .inMemory())
        let asset = sample(id: "asset", projectId: "project", take: 1, state: .local)
        try await store.save(asset)
        try await store.updateState(
            id: asset.id,
            ownerUserId: asset.ownerUserId,
            state: .uploading,
            checksumSha256: String(repeating: "a", count: 64),
            uploadObjectId: "object-id"
        )
        let updated = try #require(await store.asset(id: asset.id, ownerUserId: asset.ownerUserId))
        #expect(updated.localPath == asset.localPath)
        #expect(updated.captureState == .uploading)
        #expect(updated.uploadObjectId == "object-id")
    }

    @Test func takeBoardPersistsOfflineAndClearsDirtyFlagAfterSync() async throws {
        let store = try VideoCaptureStore(database: .inMemory())
        let asset = sample(id: "take", projectId: "project", take: 3, state: .ready)
        try await store.save(asset)

        let edited = try #require(await store.updateTakeMetadata(
            id: asset.id,
            ownerUserId: asset.ownerUserId,
            status: .good,
            circled: true,
            continuityNotes: "Glass in left hand",
            performanceNotes: nil,
            technicalNotes: "Clean focus"
        ))
        #expect(edited.takeStatus == .good)
        #expect(edited.circled)
        #expect(edited.continuityNotes == "Glass in left hand")
        #expect(edited.performanceNotes == nil)
        #expect(edited.technicalNotes == "Clean focus")
        #expect(edited.takeMetadataDirty)
        #expect(try await store.pendingTakeMetadata(ownerUserId: "owner").map(\.id) == [asset.id])

        try await store.markTakeMetadataSynced(id: asset.id, ownerUserId: asset.ownerUserId)
        let synced = try #require(await store.asset(id: asset.id, ownerUserId: asset.ownerUserId))
        #expect(!synced.takeMetadataDirty)
        #expect(try await store.pendingTakeMetadata(ownerUserId: "owner").isEmpty)
    }

    private func sample(
        id: String,
        projectId: String,
        take: Int,
        state: VideoCaptureAsset.CaptureState
    ) -> VideoCaptureAsset {
        let date = Date(timeIntervalSince1970: Double(take))
        return VideoCaptureAsset(
            id: id, ownerUserId: "owner", projectId: projectId,
            localPath: "/tmp/\(id).mov", fileName: "\(id).mov",
            contentType: "video/quicktime", sizeBytes: 1024,
            checksumSha256: nil, sourceType: .uvc, cameraName: "UVC",
            durationMs: 1000, frameRate: 25, width: 1920, height: 1080,
            recordedAt: date, captureState: state, streamState: "pending",
            uploadObjectId: nil, streamUid: nil, lastError: nil,
            sceneId: "1", shotId: "1A", slate: "A001", takeNumber: take,
            takeStatus: .unrated, circled: false, createdAt: date, updatedAt: date
        )
    }
}
