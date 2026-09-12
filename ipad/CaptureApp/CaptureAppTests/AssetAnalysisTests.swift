import XCTest
import CoreGraphics
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

    // MARK: - Helper

    private func makeAnalysis(faces: [FaceAnalysis]) -> AssetAnalysis {
        AssetAnalysis(version: AssetAnalysis.currentVersion,
                      medianLuma: 0.5, p5Luma: 0.1, p95Luma: 0.9,
                      highlightClip: 0.01, shadowClip: 0.0,
                      subjectHighlightClip: 0.03,
                      globalSharpness: 0.002, subjectSharpness: 0.0025,
                      skinCast: .neutral, faces: faces, sceneFeature: [0, 1, 2])
    }
}
