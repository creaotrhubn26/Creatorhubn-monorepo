import XCTest
@testable import CaptureApp

/// P2 (E4) — capture-edit-policy: arv fra forrige bilde / fast preset, auto-påført
/// når nye bilder lander, IDEMPOTENT (aldri over en manuell edit). Ren logikk.
final class CaptureEditPolicyTests: XCTestCase {

    private func edit(_ contrast: Double, ev: Double = 0, crop: CGRect? = nil) -> RedigeringEditStore.EditState {
        var r = MagicRecipe.neutral; r.contrast = contrast
        return .init(recipe: r, exposureEV: ev, crop: crop)
    }

    // MARK: - .none

    func testNonePolicyAppliesNothing() {
        XCTAssertNil(CaptureEditPolicyEngine.editToApply(
            policy: .none, existingEdit: nil, previousEdit: edit(0.5), presetLookup: { _ in nil }))
    }

    // MARK: - .syncPrevious

    func testSyncPreviousInheritsRecipeAndExposureNotCrop() throws {
        let prev = edit(0.7, ev: 0.5, crop: CGRect(x: 0.1, y: 0.1, width: 0.5, height: 0.5))
        let applied = try XCTUnwrap(CaptureEditPolicyEngine.editToApply(
            policy: .syncPrevious, existingEdit: nil, previousEdit: prev, presetLookup: { _ in nil }))
        XCTAssertEqual(applied.recipe.contrast, 0.7, accuracy: 0.0001)
        XCTAssertEqual(applied.exposureEV, 0.5, accuracy: 0.0001)
        XCTAssertNil(applied.crop, "crop er per-bilde og skal ikke arves")
    }

    func testSyncPreviousWithNoPreviousAppliesNothing() {
        XCTAssertNil(CaptureEditPolicyEngine.editToApply(
            policy: .syncPrevious, existingEdit: nil, previousEdit: nil, presetLookup: { _ in nil }))
    }

    // MARK: - .preset

    func testPresetAppliesLookedUpRecipe() throws {
        var presetRecipe = MagicRecipe.neutral; presetRecipe.saturation = 0.3
        let applied = try XCTUnwrap(CaptureEditPolicyEngine.editToApply(
            policy: .preset("Bryllup"), existingEdit: nil, previousEdit: nil,
            presetLookup: { $0 == "Bryllup" ? presetRecipe : nil }))
        XCTAssertEqual(applied.recipe.saturation, 0.3, accuracy: 0.0001)
        XCTAssertEqual(applied.exposureEV, 0)
    }

    func testUnknownPresetAppliesNothing() {
        XCTAssertNil(CaptureEditPolicyEngine.editToApply(
            policy: .preset("Finnes ikke"), existingEdit: nil, previousEdit: nil, presetLookup: { _ in nil }))
    }

    // MARK: - Idempotens (reconnect overskriver ikke)

    func testExistingManualEditIsNeverClobbered() {
        let manual = edit(0.9, ev: 1.0)
        // Selv med aktiv policy + tilgjengelig forrige/preset skal manuell edit stå.
        XCTAssertNil(CaptureEditPolicyEngine.editToApply(
            policy: .syncPrevious, existingEdit: manual, previousEdit: edit(0.2), presetLookup: { _ in nil }))
        XCTAssertNil(CaptureEditPolicyEngine.editToApply(
            policy: .preset("X"), existingEdit: manual, previousEdit: nil, presetLookup: { _ in MagicRecipe.neutral }))
    }

    // MARK: - Persistering per sesjon (overlever restart)

    func testPolicyStoreRoundTripsPerSession() {
        let sid = UUID()
        XCTAssertEqual(CaptureEditPolicyStore.load(sid), .none, "ukjent økt → .none default")
        CaptureEditPolicyStore.save(sid, .syncPrevious)
        XCTAssertEqual(CaptureEditPolicyStore.load(sid), .syncPrevious)
        CaptureEditPolicyStore.save(sid, .preset("Bryllup"))
        XCTAssertEqual(CaptureEditPolicyStore.load(sid), .preset("Bryllup"))
        // Isolert per sesjon.
        XCTAssertEqual(CaptureEditPolicyStore.load(UUID()), .none)
        UserDefaults.standard.removeObject(forKey: "creatorhub.capture.editpolicy.\(sid.uuidString)")
    }

    func testPolicyCodableRoundTrip() throws {
        for policy: CaptureEditPolicy in [.none, .syncPrevious, .preset("Portra")] {
            let data = try JSONEncoder().encode(policy)
            XCTAssertEqual(try JSONDecoder().decode(CaptureEditPolicy.self, from: data), policy)
        }
    }
}
