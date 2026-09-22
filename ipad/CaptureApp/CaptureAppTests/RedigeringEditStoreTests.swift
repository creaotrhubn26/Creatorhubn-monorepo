import XCTest
@testable import CaptureApp

/// Locks in the crash-safe persistence of Redigering edits + cull selections.
final class RedigeringEditStoreTests: XCTestCase {

    func testEditStateRoundTrips() throws {
        let id = UUID()
        var recipe = MagicRecipe.product
        recipe.contrast = 0.42
        recipe.tint = -0.18
        let faceEdit = FaceLocalAdjustFilter.Entry(
            normalizedRect: CGRect(x: 0.2, y: 0.3, width: 0.25, height: 0.3),
            adjustment: .init(brightness: 0.2, warmth: -0.1)
        )
        let state = RedigeringEditStore.EditState(
            recipe: recipe,
            exposureEV: 1.25,
            crop: CGRect(x: 0.1, y: 0.2, width: 0.5, height: 0.5),
            faceEdits: [faceEdit],
            reflectionRemoval: true,
            cameraColorProfileID: .creatorHubPortrait,
            protectedRegions: [CGRect(x: 0.1, y: 0.1, width: 0.2, height: 0.2)],
            auditTrail: [.init(source: "test", summary: "Testendring")]
        )
        RedigeringEditStore.save(id, state)
        defer { UserDefaults.standard.removeObject(forKey: "creatorhub.redigering.edit.\(id.uuidString)") }

        let loaded = try XCTUnwrap(RedigeringEditStore.load(id))
        XCTAssertEqual(loaded.exposureEV, 1.25, accuracy: 0.0001)
        XCTAssertEqual(loaded.recipe.contrast, 0.42, accuracy: 0.0001)
        XCTAssertEqual(loaded.recipe.tint, -0.18, accuracy: 0.0001)
        XCTAssertEqual(loaded.crop, CGRect(x: 0.1, y: 0.2, width: 0.5, height: 0.5))
        XCTAssertEqual(loaded.faceEdits, [faceEdit])
        XCTAssertEqual(loaded.reflectionRemoval, true)
        XCTAssertEqual(loaded.cameraColorProfileID, .creatorHubPortrait)
        XCTAssertEqual(loaded.protectedRegions?.count, 1)
        XCTAssertEqual(loaded.auditTrail?.first?.summary, "Testendring")
        XCTAssertEqual(loaded.version, 5)
    }

    func testV3EditStateWithoutCameraProfileStillDecodes() throws {
        let old = RedigeringEditStore.EditState(
            recipe: .neutral,
            exposureEV: 0,
            crop: nil,
            version: 3
        )
        let encoded = try JSONEncoder().encode(old)
        var object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encoded) as? [String: Any]
        )
        object.removeValue(forKey: "cameraColorProfileID")
        object.removeValue(forKey: "protectedRegions")
        object.removeValue(forKey: "auditTrail")
        let legacyData = try JSONSerialization.data(withJSONObject: object)
        let decoded = try JSONDecoder().decode(
            RedigeringEditStore.EditState.self,
            from: legacyData
        )
        XCTAssertNil(decoded.cameraColorProfileID)
        XCTAssertEqual(decoded.version, 3)
    }

    func testCameraProfileCatalogUsesExactModelMatching() {
        XCTAssertEqual(
            CameraColorProfileCatalog.cameraFamily(for: "Canon EOS R5"),
            .canonEOSR5
        )
        XCTAssertEqual(
            CameraColorProfileCatalog.cameraFamily(for: "Canon EOS R6m2"),
            .canonEOSR6MarkII
        )
        XCTAssertEqual(
            CameraColorProfileCatalog.cameraFamily(for: "Canon EOS R6 Mark II"),
            .canonEOSR6MarkII
        )
        XCTAssertNil(CameraColorProfileCatalog.cameraFamily(for: "Canon EOS R8"))
        XCTAssertNil(CameraColorProfileCatalog.cameraFamily(for: "Canon EOS R5 Mark II"))
    }

    func testCameraMatchingRequiresRawAndSupportedBody() {
        XCTAssertEqual(
            CameraColorProfileCatalog.profiles(cameraModel: "Canon EOS R5", hasRaw: true).count,
            6
        )
        XCTAssertEqual(
            CameraColorProfileCatalog.profiles(cameraModel: "Canon EOS R5", hasRaw: false).map(\.id),
            [.appleEmbedded]
        )
        XCTAssertEqual(
            CameraColorProfileCatalog.profiles(cameraModel: "Unknown Camera", hasRaw: true).map(\.id),
            [.appleEmbedded]
        )
    }

    func testAppleProfileIsNoOpAndPortraitDoesNotAddWarmCast() {
        let input = MagicRecipe.neutral
        let embedded = CameraColorProfileCatalog.effectiveRecipe(
            userRecipe: input,
            profileID: .appleEmbedded,
            cameraModel: "Canon EOS R5",
            hasRaw: true
        )
        XCTAssertEqual(embedded, input)

        let portrait = CameraColorProfileCatalog.effectiveRecipe(
            userRecipe: input,
            profileID: .creatorHubPortrait,
            cameraModel: "Canon EOS R5",
            hasRaw: true
        )
        XCTAssertLessThan(portrait.warmth, input.warmth)
        XCTAssertGreaterThan(portrait.vibrance, input.vibrance)
        XCTAssertFalse(portrait.autoEnhance)
    }

    func testRawIdentifierHintsNormalizeToUTI() {
        XCTAssertEqual(
            RAWExportPipeline.normalizedIdentifierHint("cr3"),
            "com.canon.cr3-raw-image"
        )
        XCTAssertEqual(
            RAWExportPipeline.normalizedIdentifierHint("CR2"),
            "com.canon.cr2-raw-image"
        )
        XCTAssertEqual(
            RAWExportPipeline.normalizedIdentifierHint("com.canon.cr3-raw-image"),
            "com.canon.cr3-raw-image"
        )
        XCTAssertNil(RAWExportPipeline.normalizedIdentifierHint("not a file type"))
    }

    func testMissingEditStateIsNil() {
        XCTAssertNil(RedigeringEditStore.load(UUID()))
    }

    func testKeptSetRoundTrips() {
        let session = UUID()
        let kept: Set<UUID> = [UUID(), UUID(), UUID()]
        RedigeringEditStore.saveKept(session, kept)
        defer { UserDefaults.standard.removeObject(forKey: "creatorhub.redigering.cull.\(session.uuidString)") }

        XCTAssertEqual(RedigeringEditStore.loadKept(session), kept)
    }

    func testEmptyKeptSetLoadsNilSoDefaultSeedingApplies() {
        // Saving an empty set must read back as nil so load() falls through to
        // rating-derived seeding rather than "everything dropped".
        let session = UUID()
        RedigeringEditStore.saveKept(session, [])
        defer { UserDefaults.standard.removeObject(forKey: "creatorhub.redigering.cull.\(session.uuidString)") }
        XCTAssertNil(RedigeringEditStore.loadKept(session))
    }

    func testSceneReferenceAndBatchCheckpointRoundTrip() throws {
        let session = UUID()
        let reference = UUID()
        let pending = UUID()
        RedigeringEditStore.saveSceneLockReference(reference, sessionId: session)
        XCTAssertEqual(RedigeringEditStore.loadSceneLockReference(session), reference)

        let checkpoint = RedigeringEditStore.BatchCheckpoint(
            mode: .sceneLock,
            pendingIds: [pending],
            completedIds: [reference],
            failedIds: [],
            startedAt: .now,
            updatedAt: .now
        )
        RedigeringEditStore.saveBatch(checkpoint, sessionId: session)
        XCTAssertEqual(RedigeringEditStore.loadBatch(session), checkpoint)

        RedigeringEditStore.removeBatch(session)
        RedigeringEditStore.saveSceneLockReference(nil, sessionId: session)
        XCTAssertNil(RedigeringEditStore.loadBatch(session))
        XCTAssertNil(RedigeringEditStore.loadSceneLockReference(session))
    }
}
