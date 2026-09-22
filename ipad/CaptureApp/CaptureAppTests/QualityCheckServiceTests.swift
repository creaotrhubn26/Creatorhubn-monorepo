import XCTest
import CoreGraphics
@testable import CaptureApp

/// Dekker Kvalitetssjekk-oversettelsen fra `AssetAnalysis` → leveranse-blokkere.
/// Ren logikk (ingen Vision) — pinner tersklene og alvorlighets-sorteringen.
final class QualityCheckServiceTests: XCTestCase {

    // MARK: - Enkeltakse-funn

    func testCleanImageHasNoIssues() {
        let a = analysis(faces: [face(eyesOpen: true, quality: 0.9, sharpness: 0.003)],
                         globalSharpness: 0.003, subjectClip: 0.0)
        XCTAssertTrue(QualityCheckService.evaluate(a).isEmpty)
    }

    func testClosedEyesFlaggedAsBlocker() {
        let a = analysis(faces: [face(eyesOpen: false, quality: 0.9, sharpness: 0.003)],
                         globalSharpness: 0.003, subjectClip: 0.0)
        let issues = QualityCheckService.evaluate(a)
        XCTAssertEqual(issues, [.eyesClosed])
        XCTAssertEqual(issues.first?.severity, .blocker)
    }

    func testSoftFaceFlagged() {
        // Ansikts-skarphet langt under global → bommet fokus.
        let a = analysis(faces: [face(eyesOpen: true, quality: 0.9, sharpness: 0.0005)],
                         globalSharpness: 0.01, subjectClip: 0.0)
        XCTAssertTrue(QualityCheckService.evaluate(a).contains(.faceSoft))
    }

    func testSharpFaceOnBlurryBackgroundIsNotSoft() {
        // Ansiktet skarpere enn global (vakker bokeh) → INGEN faceSoft.
        let a = analysis(faces: [face(eyesOpen: true, quality: 0.9, sharpness: 0.02)],
                         globalSharpness: 0.005, subjectClip: 0.0)
        XCTAssertFalse(QualityCheckService.evaluate(a).contains(.faceSoft))
    }

    func testSoftSecondaryFamilyMemberIsBlockerEvenWhenLargestFaceIsSharp() {
        let largeSharp = FaceAnalysis(
            rect: CGRect(x: 0.05, y: 0.2, width: 0.3, height: 0.4),
            sizeFraction: 0.12, luma: 0.5, eyesOpen: true,
            captureQuality: 0.9, sharpness: 0.01, skinCast: .neutral
        )
        let smallSoft = FaceAnalysis(
            rect: CGRect(x: 0.7, y: 0.3, width: 0.1, height: 0.14),
            sizeFraction: 0.014, luma: 0.5, eyesOpen: true,
            captureQuality: 0.9, sharpness: 0.0005, skinCast: .neutral
        )
        let a = analysis(faces: [largeSharp, smallSoft], globalSharpness: 0.003, subjectClip: 0)

        XCTAssertEqual(a.primaryFace, largeSharp, "Testen må bevise at problemet ikke er hovedansiktet")
        XCTAssertTrue(QualityCheckService.evaluate(a).contains(.faceSoft))
        XCTAssertEqual(a.onSetFlag, .blurry)
    }

    func testSubjectClipFlaggedAboveThreshold() {
        let over = analysis(faces: [], globalSharpness: 0.003,
                            subjectClip: QualityCheckService.subjectClipThreshold + 0.01)
        XCTAssertTrue(QualityCheckService.evaluate(over).contains(.subjectClipped))
        let under = analysis(faces: [], globalSharpness: 0.003,
                             subjectClip: QualityCheckService.subjectClipThreshold - 0.005)
        XCTAssertFalse(QualityCheckService.evaluate(under).contains(.subjectClipped))
    }

    func testLowFaceQualityIsWarningNotBlocker() {
        let a = analysis(faces: [face(eyesOpen: true, quality: 0.2, sharpness: 0.003)],
                         globalSharpness: 0.003, subjectClip: 0.0)
        let issues = QualityCheckService.evaluate(a)
        XCTAssertEqual(issues, [.lowFaceQuality])
        XCTAssertEqual(issues.first?.severity, .warning)
    }

    // MARK: - Finding-sammensetning

    func testFindingWorstSeverityPrefersBlocker() {
        let f = QualityFinding(assetId: UUID(), issues: [.lowFaceQuality, .eyesClosed])
        XCTAssertEqual(f.worstSeverity, .blocker)
        XCTAssertTrue(f.hasBlocker)
    }

    func testFindingWarningOnlyIsNotBlocker() {
        let f = QualityFinding(assetId: UUID(), issues: [.lowFaceQuality])
        XCTAssertFalse(f.hasBlocker)
    }

    func testMultipleIssuesOnOneImage() {
        let a = analysis(faces: [face(eyesOpen: false, quality: 0.2, sharpness: 0.0005)],
                         globalSharpness: 0.01,
                         subjectClip: QualityCheckService.subjectClipThreshold + 0.02)
        let issues = Set(QualityCheckService.evaluate(a))
        XCTAssertTrue(issues.isSuperset(of: [.eyesClosed, .faceSoft, .lowFaceQuality, .subjectClipped]))
    }

    func testEditQCFlagsSkinShiftAndNewHighlightClipping() {
        let a = analysis(faces: [], globalSharpness: 0.003, subjectClip: 0)
        let metrics = EditValidation.Metrics(
            alignmentMethod: .identity, alignmentConfidence: 1, validPixelFraction: 1,
            meanDeltaE: 5, p95DeltaE: 10, meanPixelDifference: 0.05,
            changedPixelFraction: 0.2, meanLumaDifference: 0.01,
            subjectMeanDeltaE: 4, skinMeanDeltaE: 13, backgroundMeanDeltaE: 3,
            highlightClipDelta: 0.02, shadowClipDelta: 0
        )
        let validation = EditValidation(
            state: .completed, attempts: 1, sourceRevision: "x", metrics: metrics,
            lastError: nil, updatedAt: .now
        )
        let issues = QualityCheckService.evaluate(a, editValidation: validation)
        XCTAssertTrue(issues.contains(.skinToneShift))
        XCTAssertTrue(issues.contains(.newHighlightClipping))
        XCTAssertEqual(QualityIssue.newHighlightClipping.severity, .blocker)
    }

    func testFailedOrUncertainEditQCBecomesReviewWarning() {
        let a = analysis(faces: [], globalSharpness: 0.003, subjectClip: 0)
        let failed = EditValidation(
            state: .failed, attempts: 3, sourceRevision: "x", metrics: nil,
            lastError: "failed", updatedAt: .now
        )
        XCTAssertEqual(QualityCheckService.evaluate(a, editValidation: failed), [.editValidationFailed])

        let metrics = EditValidation.Metrics(
            alignmentMethod: .visionHomography, alignmentConfidence: 0.2, validPixelFraction: 0.75,
            meanDeltaE: 2, p95DeltaE: 4, meanPixelDifference: 0.01,
            changedPixelFraction: 0.1, meanLumaDifference: 0,
            subjectMeanDeltaE: nil, skinMeanDeltaE: nil, backgroundMeanDeltaE: nil,
            highlightClipDelta: 0, shadowClipDelta: 0
        )
        let uncertain = EditValidation(
            state: .completed, attempts: 1, sourceRevision: "y", metrics: metrics,
            lastError: nil, updatedAt: .now
        )
        XCTAssertTrue(QualityCheckService.evaluate(a, editValidation: uncertain).contains(.alignmentUncertain))
    }

    func testSceneLockMovesExposureTowardReferenceWithinSafetyBound() {
        let reference = analysis(faces: [], globalSharpness: 0.003, subjectClip: 0, medianLuma: 0.55)
        let target = analysis(faces: [], globalSharpness: 0.003, subjectClip: 0, medianLuma: 0.20)
        let result = SceneConsistencyAdvisor.match(
            referenceRecipe: .neutral,
            referenceExposureEV: 0,
            reference: reference,
            target: target
        )
        XCTAssertGreaterThan(result.exposureEV, 0)
        XCTAssertLessThanOrEqual(result.exposureEV, 0.75)
    }

    // MARK: - Helpers

    private func face(eyesOpen: Bool?, quality: Double?, sharpness: Double?) -> FaceAnalysis {
        FaceAnalysis(rect: CGRect(x: 0, y: 0, width: 0.3, height: 0.3), sizeFraction: 0.2,
                     luma: 0.5, eyesOpen: eyesOpen, captureQuality: quality,
                     sharpness: sharpness, skinCast: .neutral)
    }

    private func analysis(
        faces: [FaceAnalysis],
        globalSharpness: Double,
        subjectClip: Double?,
        medianLuma: Double = 0.5
    ) -> AssetAnalysis {
        AssetAnalysis(version: AssetAnalysis.currentVersion,
                      medianLuma: medianLuma, p5Luma: 0.1, p95Luma: 0.9,
                      highlightClip: 0.0, shadowClip: 0.0,
                      subjectHighlightClip: subjectClip,
                      globalSharpness: globalSharpness, subjectSharpness: nil,
                      skinCast: .neutral, faces: faces, sceneFeature: [])
    }
}
