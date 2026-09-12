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

    // MARK: - Helpers

    private func face(eyesOpen: Bool?, quality: Double?, sharpness: Double?) -> FaceAnalysis {
        FaceAnalysis(rect: CGRect(x: 0, y: 0, width: 0.3, height: 0.3), sizeFraction: 0.2,
                     luma: 0.5, eyesOpen: eyesOpen, captureQuality: quality,
                     sharpness: sharpness, skinCast: .neutral)
    }

    private func analysis(faces: [FaceAnalysis], globalSharpness: Double, subjectClip: Double?) -> AssetAnalysis {
        AssetAnalysis(version: AssetAnalysis.currentVersion,
                      medianLuma: 0.5, p5Luma: 0.1, p95Luma: 0.9,
                      highlightClip: 0.0, shadowClip: 0.0,
                      subjectHighlightClip: subjectClip,
                      globalSharpness: globalSharpness, subjectSharpness: nil,
                      skinCast: .neutral, faces: faces, sceneFeature: [])
    }
}
