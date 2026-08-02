import XCTest
@testable import CaptureApp

/// Blits-støtte: «Lys endret»-delta, techLine-visning, Sync-forrige-vern og
/// Kvalitetssjekk-flagget «blits traff ikke». Ren logikk.
final class FlashTests: XCTestCase {

    // MARK: - ExifInfo.lightChanged

    func testLightChangedWhenFiredFlips() {
        XCTAssertTrue(ExifInfo.lightChanged(previousFired: false, previousComp: 0,
                                            currentFired: true, currentComp: 0))
        XCTAssertTrue(ExifInfo.lightChanged(previousFired: true, previousComp: nil,
                                            currentFired: false, currentComp: nil))
    }

    func testLightChangedWhenCompensationMovesOverThreshold() {
        XCTAssertTrue(ExifInfo.lightChanged(previousFired: true, previousComp: 0.0,
                                            currentFired: true, currentComp: 0.5))
        XCTAssertFalse(ExifInfo.lightChanged(previousFired: true, previousComp: 0.0,
                                             currentFired: true, currentComp: 0.2))
    }

    func testLightUnchangedWhenSame() {
        XCTAssertFalse(ExifInfo.lightChanged(previousFired: true, previousComp: 0.3,
                                             currentFired: true, currentComp: 0.3))
        XCTAssertFalse(ExifInfo.lightChanged(previousFired: nil, previousComp: nil,
                                             currentFired: nil, currentComp: nil))
    }

    // MARK: - techLine

    func testTechLineShowsFlashWithCompensation() {
        var info = ExifInfo()
        info.iso = 400; info.flashFired = true; info.flashCompensation = 0.3
        XCTAssertTrue(info.techLine.contains("⚡︎+0.3"), info.techLine)
    }

    func testTechLineShowsBareFlashWhenNoCompensation() {
        var info = ExifInfo()
        info.fNumber = 2.8; info.flashFired = true
        XCTAssertTrue(info.techLine.contains("⚡︎"), info.techLine)
    }

    func testTechLineOmitsFlashWhenNotFired() {
        var info = ExifInfo()
        info.iso = 100; info.flashFired = false; info.flashCompensation = 0.5
        XCTAssertFalse(info.techLine.contains("⚡︎"), info.techLine)
    }

    // MARK: - Sync-forrige-vern

    func testSyncPreviousSkipsInheritanceWhenLightChanged() {
        var r = MagicRecipe.neutral; r.contrast = 0.7
        let prev = RedigeringEditStore.EditState(recipe: r, exposureEV: 0.5, crop: nil)
        // Lyset uendret → arver.
        XCTAssertNotNil(CaptureEditPolicyEngine.editToApply(
            policy: .syncPrevious, existingEdit: nil, previousEdit: prev,
            lightChanged: false, presetLookup: { _ in nil }))
        // Lyset endret → arver IKKE (recipen var tunet for annet lys).
        XCTAssertNil(CaptureEditPolicyEngine.editToApply(
            policy: .syncPrevious, existingEdit: nil, previousEdit: prev,
            lightChanged: true, presetLookup: { _ in nil }))
    }

    // MARK: - Kvalitetssjekk «blits traff ikke»

    func testFlashMissedFlaggedWhenFiredNoReturnDarkFace() {
        let dark = AssetAnalysis(version: AssetAnalysis.currentVersion,
                                 medianLuma: 0.5, p5Luma: 0.1, p95Luma: 0.9,
                                 highlightClip: 0, shadowClip: 0, subjectHighlightClip: nil,
                                 globalSharpness: 0.003, subjectSharpness: nil, skinCast: .neutral,
                                 faces: [FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.2,
                                                      eyesOpen: true, captureQuality: 0.8,
                                                      sharpness: 0.003, skinCast: .neutral)],
                                 sceneFeature: [])
        let issues = QualityCheckService.evaluate(dark, flashFired: true, flashReturnDetected: false)
        XCTAssertTrue(issues.contains(.flashMissed))
        // Med retur detektert (lyset traff) → intet flagg.
        XCTAssertFalse(QualityCheckService.evaluate(dark, flashFired: true, flashReturnDetected: true)
            .contains(.flashMissed))
        // Uten blits → intet flagg.
        XCTAssertFalse(QualityCheckService.evaluate(dark).contains(.flashMissed))
    }

    func testFlashNotMissedWhenFaceBrightEnough() {
        let bright = AssetAnalysis(version: AssetAnalysis.currentVersion,
                                   medianLuma: 0.5, p5Luma: 0.1, p95Luma: 0.9,
                                   highlightClip: 0, shadowClip: 0, subjectHighlightClip: nil,
                                   globalSharpness: 0.003, subjectSharpness: nil, skinCast: .neutral,
                                   faces: [FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.55,
                                                        eyesOpen: true, captureQuality: 0.8,
                                                        sharpness: 0.003, skinCast: .neutral)],
                                   sceneFeature: [])
        XCTAssertFalse(QualityCheckService.evaluate(bright, flashFired: true, flashReturnDetected: false)
            .contains(.flashMissed))
    }
}
