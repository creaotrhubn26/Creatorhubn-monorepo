import CryptoKit
import XCTest
@testable import StoryboardStudio

final class CoveragePolicyTests: XCTestCase {
    private struct FixtureRoot: Decodable {
        let fixtureVersion: Int
        let policyVersion: Int
        let cases: [FixtureCase]
    }

    private struct FixtureCase: Decodable {
        let id: String
        let input: StoryboardCoverageInput
        let expected: ExpectedReport
    }

    private struct ExpectedReport: Decodable {
        let classification: StoryboardCoverageClassification
        let blockingCodes: [StoryboardCoverageIssueCode]
        let warningCodes: [StoryboardCoverageIssueCode]
        let infoCodes: [StoryboardCoverageIssueCode]
        let minimumCoverageFraction: Double
        let evaluatedSampleCount: Int
        let evaluatedTimesFingerprint: String
    }

    func testSharedTypeScriptFixturesHaveExactSwiftParity() throws {
        let fixture = try loadFixture()
        XCTAssertEqual(fixture.fixtureVersion, 1)
        XCTAssertEqual(fixture.policyVersion, CoveragePolicyV1.version)

        for testCase in fixture.cases {
            let report = CoveragePolicyV1.evaluate(testCase.input)
            let expected = testCase.expected
            XCTAssertEqual(
                report.classification,
                expected.classification,
                testCase.id)
            XCTAssertEqual(report.blockingCodes, expected.blockingCodes, testCase.id)
            XCTAssertEqual(report.warningCodes, expected.warningCodes, testCase.id)
            XCTAssertEqual(report.infoCodes, expected.infoCodes, testCase.id)
            XCTAssertEqual(
                report.minimumCoverageFraction,
                expected.minimumCoverageFraction,
                accuracy: 0.000_000_001,
                testCase.id)
            XCTAssertEqual(
                report.evaluatedSampleCount,
                expected.evaluatedSampleCount,
                testCase.id)
            XCTAssertEqual(
                timesFingerprint(report.evaluatedTimes),
                expected.evaluatedTimesFingerprint,
                testCase.id)
            XCTAssertEqual(report.evaluatedTimes.first, .zero, testCase.id)

            let expectedSeverities =
                expected.blockingCodes.map { ($0, StoryboardCoverageSeverity.blocking) }
                + expected.warningCodes.map { ($0, StoryboardCoverageSeverity.warning) }
                + expected.infoCodes.map { ($0, StoryboardCoverageSeverity.info) }
            XCTAssertEqual(
                report.issues.map {
                    "\($0.code.rawValue):\($0.severity.rawValue)"
                },
                expectedSeverities.map {
                    "\($0.0.rawValue):\($0.1.rawValue)"
                },
                testCase.id)
            XCTAssertEqual(
                report,
                CoveragePolicyV1.evaluate(testCase.input),
                "Coverage evaluation must be deterministic: \(testCase.id)")
        }
    }

    func testMotionFixtureContainsTZeroExportPTSAndExactKeyframe() throws {
        let fixture = try loadFixture()
        let testCase = try XCTUnwrap(fixture.cases.first {
            $0.id == "simple-push-in-samples-t0-export-pts-and-keyframe"
        })
        let report = CoveragePolicyV1.evaluate(testCase.input)

        XCTAssertTrue(report.evaluatedTimes.contains(.zero))
        XCTAssertTrue(report.evaluatedTimes.contains(
            try MediaTime(value: 1, timescale: 25)))
        XCTAssertTrue(report.evaluatedTimes.contains(
            try MediaTime(value: 2, timescale: 1)))
        XCTAssertEqual(
            timesFingerprint(report.evaluatedTimes),
            testCase.expected.evaluatedTimesFingerprint)
    }

    func testPolicyFailsClosedBeforeSamplingInvalidInput() throws {
        let unsupported = StoryboardCoverageInput(
            policyVersion: 2,
            sourceSize: ShotFramingSize(width: 1_920, height: 1_080),
            outputSize: ShotFramingSize(width: 1_920, height: 1_080))
        XCTAssertEqual(
            CoveragePolicyV1.evaluate(unsupported).blockingCodes,
            [.unsupportedPolicyVersion])

        let invalidDimensions = StoryboardCoverageInput(
            sourceSize: ShotFramingSize(width: 0, height: 1_080),
            outputSize: ShotFramingSize(width: 1_920, height: 1_080))
        XCTAssertEqual(
            CoveragePolicyV1.evaluate(invalidDimensions).blockingCodes,
            [.invalidDimensions])

        let invalidMotion = StoryboardCoverageInput(
            sourceSize: ShotFramingSize(width: 1_920, height: 1_080),
            outputSize: ShotFramingSize(width: 1_920, height: 1_080),
            shotDuration: try MediaTime(value: 2, timescale: 1),
            motionTrack: CameraMotionTrack(keyframes: [
                CameraMotionKeyframe(
                    id: "after-duration",
                    time: try MediaTime(value: 3, timescale: 1),
                    pose: CameraPose2D()),
            ]))
        XCTAssertEqual(
            CoveragePolicyV1.evaluate(invalidMotion).blockingCodes,
            [.invalidMotionTrack])
    }

    func testDisabledTrackAllowsDraftDurationBeyondEffectiveMotionLimit() throws {
        let input = StoryboardCoverageInput(
            sourceSize: ShotFramingSize(width: 1_920, height: 1_080),
            outputSize: ShotFramingSize(width: 1_920, height: 1_080),
            shotDuration: try MediaTime(value: 601, timescale: 1),
            motionTrack: CameraMotionTrack(
                enabled: false,
                keyframes: [
                    CameraMotionKeyframe(
                        id: "long-draft",
                        time: try MediaTime(value: 601, timescale: 1),
                        pose: CameraPose2D(zoom: 2)),
                ]))

        let report = CoveragePolicyV1.evaluate(input)

        XCTAssertEqual(report.classification, .valid)
        XCTAssertEqual(report.blockingCodes, [])
        XCTAssertEqual(report.evaluatedTimes, [.zero])
        XCTAssertEqual(report.evaluatedSampleCount, 1)
        XCTAssertEqual(report, CoveragePolicyV1.evaluate(input))
    }

    func testNonFiniteInitialFramingFailsClosedBeforeNormalization() {
        var framing = ShotFramingState.standard
        framing.centerX = .nan
        let input = StoryboardCoverageInput(
            sourceSize: ShotFramingSize(width: 1_920, height: 1_080),
            outputSize: ShotFramingSize(width: 1_920, height: 1_080),
            initialFraming: framing)

        let report = CoveragePolicyV1.evaluate(input)

        XCTAssertEqual(report.classification, .blocking)
        XCTAssertEqual(report.blockingCodes, [.invalidFraming])
        XCTAssertEqual(report.evaluatedSampleCount, 0)
        XCTAssertEqual(report, CoveragePolicyV1.evaluate(input))
    }

    func testNegativeCriticalSubjectBoundsFailClosedBeforeStandardization() {
        let input = StoryboardCoverageInput(
            sourceSize: ShotFramingSize(width: 1_920, height: 1_080),
            outputSize: ShotFramingSize(width: 1_920, height: 1_080),
            criticalSubjectBounds: ShotFramingRect(
                minX: 0.75,
                minY: 0.25,
                width: -0.5,
                height: 0.5))

        let report = CoveragePolicyV1.evaluate(input)

        XCTAssertEqual(report.classification, .blocking)
        XCTAssertEqual(report.blockingCodes, [.invalidFraming])
        XCTAssertEqual(report.evaluatedSampleCount, 0)
        XCTAssertEqual(report, CoveragePolicyV1.evaluate(input))
    }

    private func loadFixture() throws -> FixtureRoot {
        let url = try XCTUnwrap(Bundle(for: CoveragePolicyTests.self).url(
            forResource: "storyboard-coverage-policy-v1",
            withExtension: "json"))
        return try JSONDecoder().decode(
            FixtureRoot.self,
            from: Data(contentsOf: url))
    }

    private func timesFingerprint(_ times: [MediaTime]) -> String {
        let canonical = times.map {
            "\($0.value)/\($0.timescale)"
        }.joined(separator: ",")
        let digest = SHA256.hash(data: Data(canonical.utf8))
        return "sha256:" + digest.map {
            String(format: "%02x", $0)
        }.joined()
    }
}
