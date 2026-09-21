import Foundation
import XCTest
@testable import CaptureApp

final class CardImportManifestTests: XCTestCase {
    func testManifestPersistsSelectionProgressAndResumeState() async throws {
        let database = try AppDatabase.inMemory()
        let store = CardImportManifestStore(database: database)
        let run = makeRun()
        let first = makeItem(runId: run.id, id: "first", filename: "A001.CR3", size: 1_000)
        let second = makeItem(runId: run.id, id: "second", filename: "A002.CR3", size: 2_000)

        try await store.prepare(run: run, items: [first, second])
        try await store.setSelection(runId: run.id, selectedIds: [first.id])
        try await store.updateItem(
            id: first.id,
            status: .localVerified,
            copiedBytes: first.sizeBytes,
            checksum: String(repeating: "a", count: 64),
            localPath: "/managed/A001.CR3",
            photoAssetId: UUID().uuidString.lowercased()
        )
        try await store.updateRun(
            id: run.id,
            status: .paused,
            locallyVerifiedAt: Date(timeIntervalSince1970: 1_800_000_000),
            manifestSha256: String(repeating: "b", count: 64)
        )

        let unfinished = try await store.latestUnfinished(ownerUserIds: [run.ownerUserId])
        let restoredRun = try XCTUnwrap(unfinished)
        let restoredItems = try await store.items(runId: run.id)
        XCTAssertEqual(restoredRun.id, run.id)
        XCTAssertEqual(restoredRun.status, .paused)
        XCTAssertEqual(restoredRun.totalFiles, 1)
        XCTAssertEqual(restoredRun.totalBytes, first.sizeBytes)
        XCTAssertEqual(restoredRun.copiedBytes, first.sizeBytes)
        XCTAssertEqual(restoredRun.completedFiles, 1)
        XCTAssertEqual(restoredItems.first(where: { $0.id == first.id })?.status, .localVerified)
        XCTAssertEqual(restoredItems.first(where: { $0.id == second.id })?.status, .skipped)
        XCTAssertEqual(restoredItems.first(where: { $0.id == second.id })?.selected, false)
    }

    func testCompletedReceiptRemainsAvailableAfterRunFinishes() async throws {
        let database = try AppDatabase.inMemory()
        let store = CardImportManifestStore(database: database)
        let run = makeRun()
        let item = makeItem(runId: run.id, id: "video", filename: "C001.MOV", size: 4_096, kind: .video)
        try await store.prepare(run: run, items: [item])
        try await store.updateItem(
            id: item.id,
            status: .cloudVerified,
            copiedBytes: item.sizeBytes,
            checksum: String(repeating: "c", count: 64),
            videoAssetId: UUID().uuidString.lowercased()
        )
        let verifiedAt = Date(timeIntervalSince1970: 1_800_000_100)
        try await store.updateRun(
            id: run.id,
            status: .completed,
            locallyVerifiedAt: verifiedAt,
            cloudVerifiedAt: verifiedAt,
            completedAt: verifiedAt,
            manifestSha256: String(repeating: "d", count: 64)
        )

        let unfinished = try await store.latestUnfinished(ownerUserIds: [run.ownerUserId])
        XCTAssertNil(unfinished)
        let receipts = try await store.recentReceipts(ownerUserIds: [run.ownerUserId])
        XCTAssertEqual(receipts.map(\.id), [run.id])
        XCTAssertEqual(receipts.first?.totalFiles, 1)
        XCTAssertEqual(receipts.first?.cloudVerifiedAt, verifiedAt)
        XCTAssertEqual(receipts.first?.manifestSha256, String(repeating: "d", count: 64))
    }

    func testManifestDigestIsDeterministicAndExcludesSkippedFiles() {
        let runId = UUID()
        var first = makeItem(runId: runId, id: "one", filename: "one.jpg", size: 10)
        first.status = .localVerified
        first.checksumSha256 = String(repeating: "1", count: 64)
        var second = makeItem(runId: runId, id: "two", filename: "two.jpg", size: 20)
        second.status = .localVerified
        second.checksumSha256 = String(repeating: "2", count: 64)
        var skipped = makeItem(runId: runId, id: "skip", filename: "skip.jpg", size: 30)
        skipped.selected = false
        skipped.status = .skipped
        skipped.checksumSha256 = String(repeating: "3", count: 64)

        XCTAssertEqual(
            CardImportManifestBuilder.manifestDigest(items: [first, second, skipped]),
            CardImportManifestBuilder.manifestDigest(items: [second, first])
        )
    }

    func testResumeFindsInsertedCardEvenWhenAnotherRunWasUpdatedLater() async throws {
        let database = try AppDatabase.inMemory()
        let store = CardImportManifestStore(database: database)
        let cardA = makeRun(cardIdentifier: "card-a", updatedAt: Date(timeIntervalSince1970: 10))
        let cardB = makeRun(cardIdentifier: "card-b", updatedAt: Date(timeIntervalSince1970: 20))
        try await store.prepare(
            run: cardA,
            items: [makeItem(runId: cardA.id, id: "a", filename: "A.CR3", size: 100)]
        )
        try await store.prepare(
            run: cardB,
            items: [makeItem(runId: cardB.id, id: "b", filename: "B.CR3", size: 100)]
        )

        let matched = try await store.latestUnfinished(
            ownerUserIds: ["owner"],
            cardIdentifier: "card-a"
        )

        XCTAssertEqual(matched?.id, cardA.id)
    }

    func testResumeCanMatchFilesWhenProviderChangesCardIdentity() async throws {
        let database = try AppDatabase.inMemory()
        let store = CardImportManifestStore(database: database)
        let run = makeRun(cardIdentifier: "provider-identity-a")
        let item = makeItem(runId: run.id, id: "same", filename: "A001.CR3", size: 100)
        try await store.prepare(run: run, items: [item])

        let matched = try await store.bestUnfinishedMatch(
            ownerUserIds: [run.ownerUserId],
            sourceFingerprints: Set([item.sourceFingerprint])
        )

        XCTAssertEqual(matched?.id, run.id)
    }

    func testInterruptedPartialFilesAreCleanedOnlyInsideManagedSession() throws {
        let sessionId = UUID()
        let folder = try CardImportService.photoStorageDirectory(sessionId: sessionId)
        defer {
            if let root = try? CardImportService.storageDirectory(sessionId: sessionId) {
                try? FileManager.default.removeItem(at: root)
            }
        }
        let partial = folder.appendingPathComponent("clip.mov.partial")
        let completed = folder.appendingPathComponent("photo.jpg")
        try Data("partial".utf8).write(to: partial)
        try Data("complete".utf8).write(to: completed)

        try CardImportService.cleanupInterruptedCopies(sessionId: sessionId)

        XCTAssertFalse(FileManager.default.fileExists(atPath: partial.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: completed.path))
    }

    func testImportProfilesPersistAndApplyCardAndProjectScopes() async throws {
        let database = try AppDatabase.inMemory()
        let store = CardImportProfileStore(database: database)
        let runId = UUID()
        var item = makeItem(runId: runId, id: "video", filename: "A001.MOV", size: 1_024, kind: .video)
        item.inspection.proxyState = .originalWithProxy
        let cardKey = CardImportProfile.cardScopeKey(capacity: 128_000, items: [item])
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let cardProfile = CardImportProfile(
            id: UUID(), ownerUserId: "owner", name: "Originaler",
            scope: .card, scopeKey: cardKey, mediaKinds: [.video],
            fileExtensions: ["mov"], includedFolders: ["DCIM"],
            includeProxies: false, storagePolicy: .keepLocalAndCloud,
            createdAt: now, updatedAt: now
        )
        let projectProfile = CardImportProfile(
            id: UUID(), ownerUserId: "owner", name: "Prosjekt",
            scope: .project, scopeKey: "project-1", mediaKinds: [.video],
            fileExtensions: ["mov"], includedFolders: [], includeProxies: true,
            storagePolicy: .creatorHubOnly, createdAt: now, updatedAt: now
        )
        try await store.save(cardProfile)
        try await store.save(projectProfile)

        let profiles = try await store.applicable(
            ownerUserIds: ["owner"], cardScopeKey: cardKey, projectId: "project-1"
        )

        XCTAssertEqual(Set(profiles.map(\.id)), Set([cardProfile.id, projectProfile.id]))
        XCTAssertTrue(cardProfile.includes(item))
        var proxy = item
        proxy.inspection.proxyState = .proxy
        XCTAssertFalse(cardProfile.includes(proxy))
        XCTAssertTrue(projectProfile.includes(proxy))
    }

    private func makeRun(
        cardIdentifier: String = "card-v2",
        updatedAt: Date = Date(timeIntervalSince1970: 1_800_000_000)
    ) -> CardImportRun {
        let now = updatedAt
        return CardImportRun(
            id: UUID(), ownerUserId: "owner", sessionId: nil,
            projectId: "project", projectTitle: "Film", cardIdentifier: cardIdentifier,
            cardName: "CANON", plannedCardLabel: "A", cardCapacityBytes: 128_000,
            cardAvailableBytes: 64_000, sourceBookmark: nil, sourceDisplayPath: "CANON",
            storagePolicy: .keepLocalAndCloud, status: .ready, totalFiles: 0,
            totalBytes: 0, copiedBytes: 0, completedFiles: 0, duplicateFiles: 0,
            failedFiles: 0, manifestSha256: nil, locallyVerifiedAt: nil,
            cloudVerifiedAt: nil, completedAt: nil, createdAt: now, updatedAt: now
        )
    }

    private func makeItem(
        runId: UUID,
        id: String,
        filename: String,
        size: Int64,
        kind: CardImportMediaKind = .raw
    ) -> CardImportManifestItem {
        CardImportManifestItem(
            id: id, runId: runId, sourceRelativePath: "DCIM/\(filename)",
            sourceFingerprint: "fingerprint-\(id)", mediaKind: kind,
            filename: filename, fileExtension: (filename as NSString).pathExtension.lowercased(),
            sizeBytes: size, recordedAt: Date(timeIntervalSince1970: 1_800_000_000),
            inspection: .limited,
            selected: true, status: .waiting, copiedBytes: 0, checksumSha256: nil,
            localPath: nil, photoAssetId: nil, videoAssetId: nil,
            audioAssetId: nil, lastError: nil
        )
    }
}
