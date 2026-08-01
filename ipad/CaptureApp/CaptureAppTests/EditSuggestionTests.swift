import XCTest
import CoreGraphics
@testable import CaptureApp

/// Dekker den data-drevne auto-forslags-motoren (AssetAnalysis → recipe-deltaer).
/// Ren logikk — pinner utløsere, deltaene og at gjentatt bruk ikke overskyter.
final class EditSuggestionTests: XCTestCase {

    // MARK: - Utløsere

    func testCleanImageSuggestsNothing() {
        let a = analysis()   // nøytral, ingen problemer
        XCTAssertTrue(EditSuggestionEngine.suggestions(for: a).isEmpty)
    }

    func testSubjectClipSuggestsHighlightRecovery() {
        let a = analysis(subjectClip: EditSuggestionEngine.subjectClipThreshold + 0.05)
        XCTAssertTrue(EditSuggestionEngine.suggestions(for: a).contains(.recoverSubjectHighlights))
    }

    func testBacklitFaceSuggestsShadowLift() {
        // Ansikt markant mørkere enn median → motlys.
        let a = analysis(medianLuma: 0.7,
                         faces: [face(luma: 0.7 - EditSuggestionEngine.backlitFaceGap - 0.1)])
        XCTAssertTrue(EditSuggestionEngine.suggestions(for: a).contains(.liftBacklitFace))
    }

    func testEvenlyLitFaceDoesNotSuggestLift() {
        let a = analysis(medianLuma: 0.5, faces: [face(luma: 0.52)])
        XCTAssertFalse(EditSuggestionEngine.suggestions(for: a).contains(.liftBacklitFace))
    }

    func testSkinCastSuggestsWhiteBalance() {
        XCTAssertTrue(EditSuggestionEngine.suggestions(for: analysis(cast: .tooWarm)).contains(.coolWarmSkin))
        XCTAssertTrue(EditSuggestionEngine.suggestions(for: analysis(cast: .tooCool)).contains(.warmCoolSkin))
        XCTAssertTrue(EditSuggestionEngine.suggestions(for: analysis(cast: .tooGreen)).contains(.correctGreenSkin))
    }

    func testFlatImageSuggestsContrast() {
        // Lav dynamisk spredning (P95−P5 under terskel).
        let a = analysis(p5: 0.45, p95: 0.45 + EditSuggestionEngine.flatSpread - 0.05)
        XCTAssertTrue(EditSuggestionEngine.suggestions(for: a).contains(.addContrast))
    }

    // MARK: - Recipe-deltaer

    func testDeltasMoveTheRightAxis() {
        var r = MagicRecipe.neutral
        EditSuggestion.recoverSubjectHighlights.apply(to: &r)
        XCTAssertGreaterThanOrEqual(r.highlightRecovery, 0.5)
        EditSuggestion.liftBacklitFace.apply(to: &r)
        XCTAssertGreaterThanOrEqual(r.shadowLift, 0.4)
        EditSuggestion.coolWarmSkin.apply(to: &r)
        XCTAssertLessThan(r.warmth, 0)
        EditSuggestion.addContrast.apply(to: &r)
        XCTAssertGreaterThanOrEqual(r.contrast, 0.25)
    }

    func testDeltasAreIdempotentAndClamped() {
        var r = MagicRecipe.neutral
        for _ in 0..<5 {
            EditSuggestion.coolWarmSkin.apply(to: &r)
            EditSuggestion.warmCoolSkin.apply(to: &r)
        }
        XCTAssertGreaterThanOrEqual(r.warmth, -1)
        XCTAssertLessThanOrEqual(r.warmth, 1)
        // recoverSubjectHighlights bruker max → gjentatt bruk overskyter ikke.
        var r2 = MagicRecipe.neutral; r2.highlightRecovery = 0.8
        EditSuggestion.recoverSubjectHighlights.apply(to: &r2)
        XCTAssertEqual(r2.highlightRecovery, 0.8, accuracy: 0.0001, "skulle ikke SENKE et høyere valg")
    }

    // MARK: - Helpers

    private func face(luma: Double) -> FaceAnalysis {
        FaceAnalysis(rect: CGRect(x: 0, y: 0, width: 0.3, height: 0.3), sizeFraction: 0.2,
                     luma: luma, eyesOpen: true, captureQuality: 0.8, sharpness: 0.003, skinCast: .neutral)
    }

    private func analysis(medianLuma: Double = 0.5, p5: Double = 0.1, p95: Double = 0.9,
                          subjectClip: Double? = nil,
                          cast: ImageAnalysis.SkinReading.Cast? = nil,
                          faces: [FaceAnalysis] = []) -> AssetAnalysis {
        AssetAnalysis(version: AssetAnalysis.currentVersion,
                      medianLuma: medianLuma, p5Luma: p5, p95Luma: p95,
                      highlightClip: 0, shadowClip: 0,
                      subjectHighlightClip: subjectClip,
                      globalSharpness: 0.003, subjectSharpness: nil,
                      skinCast: cast, faces: faces, sceneFeature: [])
    }
}
