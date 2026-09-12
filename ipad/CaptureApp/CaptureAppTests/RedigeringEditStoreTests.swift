import XCTest
@testable import CaptureApp

/// Locks in the crash-safe persistence of Redigering edits + cull selections.
final class RedigeringEditStoreTests: XCTestCase {

    func testEditStateRoundTrips() throws {
        let id = UUID()
        var recipe = MagicRecipe.product
        recipe.contrast = 0.42
        let state = RedigeringEditStore.EditState(
            recipe: recipe, exposureEV: 1.25, crop: CGRect(x: 0.1, y: 0.2, width: 0.5, height: 0.5))
        RedigeringEditStore.save(id, state)
        defer { UserDefaults.standard.removeObject(forKey: "creatorhub.redigering.edit.\(id.uuidString)") }

        let loaded = try XCTUnwrap(RedigeringEditStore.load(id))
        XCTAssertEqual(loaded.exposureEV, 1.25, accuracy: 0.0001)
        XCTAssertEqual(loaded.recipe.contrast, 0.42, accuracy: 0.0001)
        XCTAssertEqual(loaded.crop, CGRect(x: 0.1, y: 0.2, width: 0.5, height: 0.5))
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
}
