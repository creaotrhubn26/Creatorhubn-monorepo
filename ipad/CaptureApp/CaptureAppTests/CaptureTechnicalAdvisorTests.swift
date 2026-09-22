import XCTest
@testable import CaptureApp

final class CaptureTechnicalAdvisorTests: XCTestCase {
    func testMixedFamilyFocusRecommendsAlignmentAndStopsDown() throws {
        let analysis = makeAnalysis(sharpness: [0.010, 0.009, 0.0004])
        let exposure = CaptureExposureSnapshot(
            camera: "Canon EOS R6 Mark II", lens: "RF50mm F1.2 L USM",
            focalLengthMM: 50, aperture: 4, shutterSeconds: 1.0 / 250, iso: 400
        )
        let advice = try XCTUnwrap(CaptureTechnicalAdvisor().advice(
            assetId: UUID(), analysis: analysis, exposure: exposure
        ))

        XCTAssertEqual(advice.issue, .mixedGroupFocus)
        XCTAssertEqual(advice.softPersonNumbers, [3])
        XCTAssertEqual(advice.focusTargets(in: analysis).map(\.personNumber), [3])
        XCTAssertEqual(advice.recommendedAperture, 7.1)
        XCTAssertTrue(advice.primaryTip.contains("samme linje"))
        XCTAssertTrue(advice.settingsTip?.contains("ƒ/7.1") == true)
        XCTAssertEqual(advice.estimatedISO, 1_250)
    }

    func testAllSoftDoesNotBlameDepthOfField() throws {
        let analysis = makeAnalysis(sharpness: [0.0003, 0.0004, 0.0002])
        let exposure = CaptureExposureSnapshot(
            focalLengthMM: 85, aperture: 7.1, shutterSeconds: 1.0 / 60, iso: 400
        )
        let advice = try XCTUnwrap(CaptureTechnicalAdvisor().advice(
            assetId: UUID(), analysis: analysis, exposure: exposure
        ))

        XCTAssertEqual(advice.issue, .generalBlur)
        XCTAssertNil(advice.recommendedAperture)
        XCTAssertTrue(advice.shutterNeedsChange)
        XCTAssertTrue(advice.primaryTip.contains("fokuspunktet"))
    }

    func testNoSoftFacesProducesNoAdvice() {
        let analysis = makeAnalysis(sharpness: [0.010, 0.009, 0.008])
        XCTAssertNil(CaptureTechnicalAdvisor().advice(
            assetId: UUID(), analysis: analysis,
            exposure: CaptureExposureSnapshot(aperture: 4, iso: 400)
        ))
    }

    func testSharpFaceWithSoftEyesProducesEyeFocusAdvice() throws {
        var analysis = makeAnalysis(sharpness: [0.012])
        analysis.faces[0].leftEyeRect = CGRect(x: 0.04, y: 0.42, width: 0.03, height: 0.02)
        analysis.faces[0].rightEyeRect = CGRect(x: 0.09, y: 0.42, width: 0.03, height: 0.02)
        analysis.faces[0].leftEyeSharpness = 0.00025
        analysis.faces[0].rightEyeSharpness = 0.00030

        let advice = try XCTUnwrap(CaptureTechnicalAdvisor().advice(
            assetId: UUID(),
            analysis: analysis,
            exposure: CaptureExposureSnapshot(
                focalLengthMM: 85,
                aperture: 2,
                shutterSeconds: 1.0 / 250,
                iso: 400
            )
        ))

        XCTAssertEqual(analysis.faceFocusAssessments.map(\.state), [.sharp])
        XCTAssertEqual(analysis.eyeFocusAssessments.map(\.state), [.soft, .soft])
        XCTAssertEqual(advice.issue, .eyeFocus)
        XCTAssertEqual(advice.softPersonNumbers, [1])
        XCTAssertEqual(advice.eyeTargets(in: analysis).count, 2)
        XCTAssertNil(advice.recommendedAperture)
        XCTAssertTrue(advice.primaryTip.contains("AF-punktet"))
    }

    func testOneSharpEyeDoesNotWarnForIntentionalShallowDepth() {
        var analysis = makeAnalysis(sharpness: [0.012])
        analysis.faces[0].leftEyeRect = CGRect(x: 0.04, y: 0.42, width: 0.03, height: 0.02)
        analysis.faces[0].rightEyeRect = CGRect(x: 0.09, y: 0.42, width: 0.03, height: 0.02)
        analysis.faces[0].leftEyeSharpness = 0.00025
        analysis.faces[0].rightEyeSharpness = 0.012

        XCTAssertEqual(analysis.eyeFocusAssessments.map(\.state), [.soft, .sharp])
        XCTAssertTrue(analysis.criticalSoftEyeFocusAssessments.isEmpty)
        XCTAssertNil(CaptureTechnicalAdvisor().advice(
            assetId: UUID(),
            analysis: analysis,
            exposure: CaptureExposureSnapshot(aperture: 1.4, iso: 400)
        ))
    }

    func testGeneratedFamilyReferenceProducesPersonSpecificAdviceOnPhysicalDevice() throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("Vision-ansiktsdeteksjonen for denne referansen verifiseres på fysisk iPad.")
        #else
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("CreatorHubFamilyFocusQA-v2.png")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw XCTSkip("Familierammen ligger bare i Documents på fysisk QA-iPad.")
        }
        let analysis = try XCTUnwrap(AssetAnalyzer.run(imageURL: url))
        let advice = try XCTUnwrap(CaptureTechnicalAdvisor().advice(
            assetId: UUID(),
            analysis: analysis,
            exposure: CaptureExposureSnapshot(
                camera: "Canon EOS R6 Mark II", lens: "RF50mm F1.8 STM",
                focalLengthMM: 50, aperture: 4, shutterSeconds: 1.0 / 250, iso: 400
            )
        ))

        XCTAssertEqual(advice.issue, .mixedGroupFocus)
        XCTAssertEqual(advice.softPersonNumbers.count, 1)
        XCTAssertEqual(advice.recommendedAperture, 7.1)
        XCTAssertTrue(advice.title.contains("Person"))
        #endif
    }

    func testLearningStoreRecordsOnlyTechnicalOutcomeAndBuildsPrior() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = CaptureTechnicalLearningStore(
            fileURL: directory.appendingPathComponent("learning.json")
        )
        let sourceId = UUID()
        let resultId = UUID()
        let source = makeAnalysis(sharpness: [0.010, 0.009, 0.0004])
        let improved = makeAnalysis(sharpness: [0.010, 0.009, 0.008])
        let exposure = CaptureExposureSnapshot(
            camera: "Canon EOS R6 Mark II", lens: "RF50", focalLengthMM: 50,
            aperture: 4, shutterSeconds: 1.0 / 250, iso: 400
        )
        let advice = try XCTUnwrap(CaptureTechnicalAdvisor().advice(
            assetId: sourceId, analysis: source, exposure: exposure
        ))
        let started = Date(timeIntervalSince1970: 1_000)

        await store.beginTrial(
            advice: advice, action: .retryingAdvice,
            sourceCaptureTime: started, analysis: source
        )
        let outcome = await store.completeTrialIfNeeded(
            resultAssetId: resultId,
            captureTime: started.addingTimeInterval(5),
            analysis: improved
        )
        XCTAssertEqual(outcome?.result, .improved)

        let prior = await store.learningPrior(
            camera: "Canon EOS R6 Mark II", lens: "RF50", issue: .mixedGroupFocus
        )
        XCTAssertEqual(prior.sampleCount, 1)
        XCTAssertEqual(prior.improvementRate, 1)
        XCTAssertEqual(prior.preferredApertureStepCount, 5)

        let persisted = try String(contentsOf: directory.appendingPathComponent("learning.json"))
        XCTAssertFalse(persisted.contains("rect"))
        XCTAssertFalse(persisted.contains("image"))

        // Filen må kunne leses etter omstart; dato-strategien er del av den
        // faktiske persistenskontrakten, ikke bare en in-memory-test.
        let reloaded = CaptureTechnicalLearningStore(
            fileURL: directory.appendingPathComponent("learning.json")
        )
        let reloadedPrior = await reloaded.learningPrior(
            camera: "Canon EOS R6 Mark II", lens: "RF50", issue: .mixedGroupFocus
        )
        XCTAssertEqual(reloadedPrior.sampleCount, 1)
    }

    private func makeAnalysis(sharpness: [Double]) -> AssetAnalysis {
        let faces = sharpness.enumerated().map { index, value in
            FaceAnalysis(
                rect: CGRect(x: Double(index) * 0.2, y: 0.3, width: 0.15, height: 0.2),
                sizeFraction: 0.03, luma: 0.5, eyesOpen: true,
                captureQuality: 0.9, sharpness: value, skinCast: .neutral
            )
        }
        return AssetAnalysis(
            version: AssetAnalysis.currentVersion,
            medianLuma: 0.5, p5Luma: 0.1, p95Luma: 0.9,
            highlightClip: 0, shadowClip: 0, subjectHighlightClip: 0,
            globalSharpness: 0.002, subjectSharpness: 0.003,
            skinCast: .neutral, faces: faces, sceneFeature: []
        )
    }
}
