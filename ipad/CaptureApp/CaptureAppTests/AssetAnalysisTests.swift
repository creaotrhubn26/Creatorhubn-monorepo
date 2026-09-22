import XCTest
import CoreGraphics
import CoreImage
import UIKit
@testable import CaptureApp

/// Dekker de RENE avledningene i den samlede per-bilde-analysen — persentiler,
/// klipp-fraksjoner, cast-klassifisering, «ansikt-soft»-regelen og primært-ansikt.
/// (Vision-passet selv testes ikke her; det krever ekte bilder på enhet.)
final class AssetAnalysisTests: XCTestCase {

    // MARK: - Persentiler fra histogram

    func testPercentileFlatHistogramReturnsProportionalCut() {
        // Uniform fordeling over 256 bins → median ≈ 0.5, p5 ≈ 0.05, p95 ≈ 0.95.
        let hist = [Double](repeating: 1.0 / 256.0, count: 256)
        XCTAssertEqual(AssetAnalyzer.percentile(0.5, hist: hist), 0.5, accuracy: 0.02)
        XCTAssertEqual(AssetAnalyzer.percentile(0.05, hist: hist), 0.05, accuracy: 0.02)
        XCTAssertEqual(AssetAnalyzer.percentile(0.95, hist: hist), 0.95, accuracy: 0.02)
    }

    func testPercentileAllMassInDarkBinsIsLow() {
        // Alt lys i de mørkeste binene → median helt i bunn.
        var hist = [Double](repeating: 0, count: 256)
        hist[0] = 1.0
        XCTAssertEqual(AssetAnalyzer.percentile(0.5, hist: hist), 0.0, accuracy: 0.001)
    }

    func testPercentileEmptyHistogramIsZero() {
        XCTAssertEqual(AssetAnalyzer.percentile(0.5, hist: []), 0)
        XCTAssertEqual(AssetAnalyzer.percentile(0.5, hist: [1]), 0)
    }

    // MARK: - Klipp-fraksjoner

    func testClipFractionsCountTopAndBottomBins() {
        var hist = [Double](repeating: 0, count: 256)
        hist[255] = 0.1     // utbrent
        hist[0] = 0.2       // dødt-svart
        hist[128] = 0.7     // midttone
        let (hi, lo) = AssetAnalyzer.clipFractions(hist: hist)
        XCTAssertEqual(hi, 0.1, accuracy: 0.001)
        XCTAssertEqual(lo, 0.2, accuracy: 0.001)
    }

    func testClipFractionsWrongLengthIsZero() {
        let (hi, lo) = AssetAnalyzer.clipFractions(hist: [1, 2, 3])
        XCTAssertEqual(hi, 0)
        XCTAssertEqual(lo, 0)
    }

    func testSubjectHighlightGuardCatchesToneMappedNearWhite() throws {
        let extent = CGRect(x: 0, y: 0, width: 64, height: 64)
        let nearWhite = CIImage(color: CIColor(red: 0.98, green: 0.98, blue: 0.98))
            .cropped(to: extent)
        let fullSubject = CIImage(color: .white).cropped(to: extent)
        let risk = try XCTUnwrap(AssetAnalyzer.subjectClip(
            hiMaskSource: nearWhite,
            subject: fullSubject,
            extent: extent,
            ctx: CIContext(options: [.useSoftwareRenderer: true])
        ))
        XCTAssertGreaterThan(risk, 0.45)
    }

    // MARK: - Cast-klassifisering (samme regel som HUD)

    func testClassifyCastNeutralSkin() {
        // Profesjonell hud i nøytralt lys: R ≥ G > B, R/B ~1.3.
        XCTAssertEqual(AssetAnalyzer.classifyCast(r: 0.75, g: 0.6, b: 0.55), .neutral)
    }

    func testClassifyCastWarmAndCool() {
        XCTAssertEqual(AssetAnalyzer.classifyCast(r: 0.8, g: 0.5, b: 0.3), .tooWarm)
        XCTAssertEqual(AssetAnalyzer.classifyCast(r: 0.5, g: 0.55, b: 0.6), .tooCool)
    }

    func testClassifyCastNearBlackIsNeutral() {
        XCTAssertEqual(AssetAnalyzer.classifyCast(r: 0.05, g: 0.05, b: 0.05), .neutral)
    }

    // MARK: - «Ansikt er soft»-regelen

    func testFaceIsSoftWhenBelowSixtyPercentOfGlobal() {
        let face = FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.5,
                                eyesOpen: true, captureQuality: 0.8, sharpness: 0.001, skinCast: .neutral)
        // Skarpt ansikt på uskarp bakgrunn: ansiktets energi > global → IKKE soft.
        XCTAssertFalse(face.isSoft(globalSharpness: 0.001))
        // Ansikt markant under global (bommet fokus) → soft.
        XCTAssertTrue(face.isSoft(globalSharpness: 0.01))
    }

    func testFaceWithNilSharpnessIsNeverSoft() {
        let face = FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.5,
                                eyesOpen: true, captureQuality: nil, sharpness: nil, skinCast: nil)
        XCTAssertFalse(face.isSoft(globalSharpness: 0.05))
    }

    func testFamilyFocusAssessmentsMarkSmallerSoftFaceAndSortLeftToRight() {
        let rightSoft = FaceAnalysis(
            rect: CGRect(x: 0.72, y: 0.35, width: 0.12, height: 0.18),
            sizeFraction: 0.0216, luma: 0.5, eyesOpen: true,
            captureQuality: 0.8, sharpness: 0.0005, skinCast: .neutral
        )
        let leftSharp = FaceAnalysis(
            rect: CGRect(x: 0.08, y: 0.35, width: 0.20, height: 0.24),
            sizeFraction: 0.048, luma: 0.5, eyesOpen: true,
            captureQuality: 0.9, sharpness: 0.010, skinCast: .neutral
        )
        let middleSharp = FaceAnalysis(
            rect: CGRect(x: 0.42, y: 0.35, width: 0.14, height: 0.20),
            sizeFraction: 0.028, luma: 0.5, eyesOpen: true,
            captureQuality: 0.9, sharpness: 0.008, skinCast: .neutral
        )
        let a = makeAnalysis(faces: [rightSoft, leftSharp, middleSharp])
        let result = a.faceFocusAssessments

        XCTAssertEqual(result.map(\.sourceIndex), [1, 2, 0])
        XCTAssertEqual(result.map(\.personNumber), [1, 2, 3])
        XCTAssertEqual(result.map(\.state), [.sharp, .sharp, .soft])
        XCTAssertEqual(a.onSetFlag, .blurry)
    }

    func testGeneratedFamilyReferenceReportsSoftPersonOnPhysicalDevice() throws {
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("CreatorHubFamilyFocusQA-v2.png")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw XCTSkip("Copy CreatorHubFamilyFocusQA-v2.png into app Documents for the physical QA check.")
        }
        let analysis = try XCTUnwrap(AssetAnalyzer.run(imageURL: url))
        let assessments = analysis.faceFocusAssessments
        let sharp = assessments.filter { $0.state == .sharp }.count
        let soft = assessments.filter { $0.state == .soft }.count
        print("Family focus QA: faces=\(assessments.count) sharp=\(sharp) soft=\(soft) " +
              assessments.map {
                  let face = analysis.faces[$0.sourceIndex]
                  return "P\($0.personNumber)=sharp:\($0.sharpness ?? -1),size:\(face.sizeFraction),quality:\(face.captureQuality ?? -1)"
              }.joined(separator: " "))

        XCTAssertGreaterThanOrEqual(assessments.count, 5, "Vision må finne hele familien")
        XCTAssertGreaterThanOrEqual(sharp, 4, "De fire tilsiktet skarpe ansiktene må bestå")
        XCTAssertEqual(soft, 1, "Det ene optisk myke ansiktet må identifiseres")
    }

    // MARK: - Primært ansikt / avledninger

    func testPrimaryFaceIsLargestByArea() {
        let small = FaceAnalysis(rect: .zero, sizeFraction: 0.05, luma: 0.5,
                                 eyesOpen: true, captureQuality: nil, sharpness: nil, skinCast: nil)
        let big = FaceAnalysis(rect: .zero, sizeFraction: 0.30, luma: 0.5,
                               eyesOpen: false, captureQuality: nil, sharpness: nil, skinCast: nil)
        let a = makeAnalysis(faces: [small, big])
        XCTAssertEqual(a.primaryFace?.sizeFraction, 0.30)
        XCTAssertEqual(a.primaryFace?.eyesOpen, false)
        XCTAssertTrue(a.hasFaces)
    }

    func testNoFacesHasNilPrimary() {
        let a = makeAnalysis(faces: [])
        XCTAssertNil(a.primaryFace)
        XCTAssertFalse(a.hasFaces)
    }

    // MARK: - On-set-flagg (P5 — filmstrip)

    func testOnSetFlagBlurryForSoftFace() {
        let soft = FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.5, eyesOpen: true,
                                captureQuality: 0.8, sharpness: 0.0005, skinCast: .neutral)
        let a = makeAnalysis(faces: [soft])   // globalSharpness 0.002 → face soft
        XCTAssertEqual(a.onSetFlag, .blurry)
    }

    func testOnSetFlagLowQualityForWeakFace() {
        let weak = FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.5, eyesOpen: true,
                                captureQuality: 0.2, sharpness: 0.01, skinCast: .neutral)
        let a = makeAnalysis(faces: [weak])   // skarp nok, men lav quality
        XCTAssertEqual(a.onSetFlag, .lowFaceQuality)
    }

    func testOnSetFlagNilForCleanImage() {
        let good = FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.5, eyesOpen: true,
                                captureQuality: 0.9, sharpness: 0.01, skinCast: .neutral)
        XCTAssertNil(makeAnalysis(faces: [good]).onSetFlag)
    }

    func testOnSetFlagEyesClosedForClosedEyes() {
        // Lukkede øyne på et ellers skarpt, høy-kvalitets ansikt → .eyesClosed.
        let closed = FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.5, eyesOpen: false,
                                  captureQuality: 0.9, sharpness: 0.01, skinCast: .neutral)
        XCTAssertEqual(makeAnalysis(faces: [closed]).onSetFlag, .eyesClosed)
    }

    func testOnSetFlagEyesClosedBeatsBlurry() {
        // Både lukkede øyne OG soft fokus → øyne prioriteres (sterkest signal).
        let both = FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.5, eyesOpen: false,
                                captureQuality: 0.9, sharpness: 0.0005, skinCast: .neutral)
        XCTAssertEqual(makeAnalysis(faces: [both]).onSetFlag, .eyesClosed)
    }

    func testOnSetFlagNilWhenEyesOpennessUnknown() {
        // eyesOpen == nil (ingen landmarks) skal IKKE flagge lukkede øyne.
        let unknown = FaceAnalysis(rect: .zero, sizeFraction: 0.2, luma: 0.5, eyesOpen: nil,
                                   captureQuality: 0.9, sharpness: 0.01, skinCast: .neutral)
        XCTAssertNil(makeAnalysis(faces: [unknown]).onSetFlag)
    }

    // MARK: - Codable round-trip (persistering på signals)

    func testAnalysisRoundTripsThroughCodable() throws {
        let original = makeAnalysis(faces: [
            FaceAnalysis(rect: CGRect(x: 0.1, y: 0.2, width: 0.3, height: 0.4),
                         sizeFraction: 0.12, luma: 0.6, eyesOpen: true,
                         captureQuality: 0.7, sharpness: 0.003, skinCast: .tooWarm)
        ])
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AssetAnalysis.self, from: data)
        XCTAssertEqual(original, decoded)
    }

    // MARK: - Sanitering (non-finite → 0 før persistering)

    func testSanitizedReplacesNonFiniteValues() throws {
        let dirty = AssetAnalysis(
            version: AssetAnalysis.currentVersion,
            medianLuma: .nan, p5Luma: 0.1, p95Luma: .infinity,
            highlightClip: 0.01, shadowClip: -.infinity,
            subjectHighlightClip: .nan,
            globalSharpness: .infinity, subjectSharpness: .nan,
            skinCast: .neutral,
            faces: [FaceAnalysis(rect: .zero, sizeFraction: .nan, luma: .infinity,
                                 eyesOpen: true, captureQuality: .nan, sharpness: .infinity,
                                 skinCast: .neutral)],
            sceneFeature: [0, .nan, .infinity])
        let clean = dirty.sanitized()
        // Alle Double-felt skal nå være finite.
        XCTAssertTrue(clean.medianLuma.isFinite && clean.p95Luma.isFinite
                      && clean.shadowClip.isFinite && clean.globalSharpness.isFinite)
        XCTAssertEqual(clean.subjectHighlightClip, 0)
        XCTAssertEqual(clean.subjectSharpness, 0)
        XCTAssertEqual(clean.faces[0].sizeFraction, 0)
        XCTAssertEqual(clean.faces[0].luma, 0)
        XCTAssertEqual(clean.faces[0].captureQuality, 0)
        XCTAssertTrue(clean.sceneFeature.allSatisfy { $0.isFinite })
        // KRITISK: den saniterte MÅ nå kunne JSON-encodes (rå ville kastet →
        // hele signals-bloben ville kollapset til «{}»).
        XCTAssertNoThrow(try JSONEncoder().encode(clean))
        XCTAssertThrowsError(try JSONEncoder().encode(dirty),
                             "urenset non-finite skal kaste (beviser hvorfor sanitering trengs)")
    }

    // MARK: - Automatic edit validation

    func testEditValidationPlannerSkipsOnlyCurrentCompletedRevision() {
        let completed = EditValidation(
            state: .completed, attempts: 1, sourceRevision: "r1", metrics: nil,
            lastError: nil, updatedAt: Date()
        )
        XCTAssertFalse(EditValidationPlanner.shouldSchedule(
            existing: completed, revision: "r1", taskRunning: false
        ))
        XCTAssertTrue(EditValidationPlanner.shouldSchedule(
            existing: completed, revision: "r2", taskRunning: false
        ))
        XCTAssertFalse(EditValidationPlanner.shouldSchedule(
            existing: nil, revision: "r2", taskRunning: true
        ))
    }

    func testEditValidationMetricsRoundTrip() throws {
        let metrics = EditValidation.Metrics(
            alignmentMethod: .visionTranslation,
            alignmentConfidence: 0.92,
            validPixelFraction: 0.98,
            meanDeltaE: 3.1,
            p95DeltaE: 7.2,
            meanPixelDifference: 0.04,
            changedPixelFraction: 0.31,
            meanLumaDifference: 0.02,
            subjectMeanDeltaE: 2.2,
            skinMeanDeltaE: 1.1,
            backgroundMeanDeltaE: 4.3,
            highlightClipDelta: -0.01,
            shadowClipDelta: 0.005
        )
        let original = EditValidation(
            state: .completed, attempts: 2, sourceRevision: "revision",
            metrics: metrics, lastError: nil, updatedAt: Date(timeIntervalSince1970: 123)
        )
        let decoded = try JSONDecoder().decode(
            EditValidation.self,
            from: JSONEncoder().encode(original)
        )
        XCTAssertEqual(decoded, original)
    }

    func testPixelValidationIsNearZeroForIdenticalImages() throws {
        let image = try XCTUnwrap(solidImage(red: 0.25, green: 0.50, blue: 0.75).cgImage)
        let metrics = try EditValidationEngine.measure(before: image, after: image)
        XCTAssertEqual(metrics.meanDeltaE, 0, accuracy: 0.05)
        XCTAssertEqual(metrics.changedPixelFraction, 0, accuracy: 0.001)
        XCTAssertEqual(metrics.meanPixelDifference, 0, accuracy: 0.001)
    }

    func testPixelValidationReportsVisibleColourChange() throws {
        let before = try XCTUnwrap(solidImage(red: 0.20, green: 0.25, blue: 0.30).cgImage)
        let after = try XCTUnwrap(solidImage(red: 0.65, green: 0.30, blue: 0.20).cgImage)
        let metrics = try EditValidationEngine.measure(before: before, after: after)
        XCTAssertGreaterThan(metrics.meanDeltaE, 10)
        XCTAssertGreaterThan(metrics.changedPixelFraction, 0.95)
        XCTAssertGreaterThan(metrics.meanPixelDifference, 0.10)
    }

    func testPixelValidationRegistersTranslatedFrameBeforeMeasuring() throws {
        let original = registrationPattern()
        let shifted = UIGraphicsImageRenderer(size: original.size).image { _ in
            original.draw(at: CGPoint(x: 7, y: -5))
        }
        let metrics = try EditValidationEngine.measure(
            before: XCTUnwrap(original.cgImage),
            after: XCTUnwrap(shifted.cgImage)
        )
        XCTAssertNotEqual(metrics.alignmentMethod, .identity)
        XCTAssertGreaterThan(metrics.validPixelFraction, 0.85)
        XCTAssertLessThan(metrics.changedPixelFraction, 0.12)
    }

    func testRevisionChangesAfterAtomicReplacementWithSameByteCount() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let before = directory.appendingPathComponent("before.dat")
        let after = directory.appendingPathComponent("after.dat")
        try Data("aaaa".utf8).write(to: before, options: .atomic)
        try Data("bbbb".utf8).write(to: after, options: .atomic)
        let first = try XCTUnwrap(EditValidationRevision.make(
            beforePath: before.path, afterPath: after.path
        ))
        try Data("cccc".utf8).write(to: after, options: .atomic)
        let second = try XCTUnwrap(EditValidationRevision.make(
            beforePath: before.path, afterPath: after.path
        ))
        XCTAssertNotEqual(first, second)
    }

    // MARK: - Helper

    private func makeAnalysis(faces: [FaceAnalysis]) -> AssetAnalysis {
        AssetAnalysis(version: AssetAnalysis.currentVersion,
                      medianLuma: 0.5, p5Luma: 0.1, p95Luma: 0.9,
                      highlightClip: 0.01, shadowClip: 0.0,
                      subjectHighlightClip: 0.03,
                      globalSharpness: 0.002, subjectSharpness: 0.0025,
                      skinCast: .neutral, faces: faces, sceneFeature: [0, 1, 2])
    }

    private func solidImage(red: CGFloat, green: CGFloat, blue: CGFloat) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64))
        return renderer.image { context in
            UIColor(red: red, green: green, blue: blue, alpha: 1).setFill()
            context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
        }
    }

    private func registrationPattern() -> UIImage {
        let size = CGSize(width: 192, height: 144)
        return UIGraphicsImageRenderer(size: size).image { context in
            UIColor(white: 0.12, alpha: 1).setFill()
            context.fill(CGRect(origin: .zero, size: size))
            for row in 0..<9 {
                for column in 0..<12 {
                    let seed = (row * 37 + column * 61) % 255
                    UIColor(
                        red: CGFloat((seed * 17) % 255) / 255,
                        green: CGFloat((seed * 43 + 31) % 255) / 255,
                        blue: CGFloat((seed * 79 + 73) % 255) / 255,
                        alpha: 1
                    ).setFill()
                    let inset = CGFloat((row + column) % 4)
                    context.fill(CGRect(
                        x: CGFloat(column * 16) + inset,
                        y: CGFloat(row * 16) + inset,
                        width: 12 - inset,
                        height: 12 - inset
                    ))
                }
            }
        }
    }
}
