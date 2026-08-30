import XCTest
@testable import StoryboardStudio

final class FrameEvaluatorTests: XCTestCase {
    private let duration = try! MediaTime(value: 4, timescale: 1)

    func testMissingAndDisabledTracksPreserveTZeroFraming() throws {
        let framing = ShotFramingState(
            shotSize: "CU",
            angle: "Low",
            lensMm: 85,
            centerX: 0.4,
            centerY: 0.6,
            zoom: 2,
            rollDegrees: 8,
            aspectRatio: 2.39,
            mode: .manual,
            revision: 9
        )
        let requested = try MediaTime(value: 3, timescale: 1)

        let missing = try CameraMotionEvaluationPlan(
            initialFraming: framing,
            track: nil,
            shotDuration: duration
        )
        let disabled = try CameraMotionEvaluationPlan(
            initialFraming: framing,
            track: CameraMotionTrack(enabled: false, keyframes: [
                CameraMotionKeyframe(
                    id: "end",
                    time: duration,
                    pose: CameraPose2D(centerX: 1, zoom: 8)
                ),
            ]),
            shotDuration: duration
        )

        XCTAssertEqual(missing.framing(at: requested), framing.normalized())
        XCTAssertEqual(disabled.framing(at: requested), framing.normalized())
    }

    func testInterpolationUsesLogZoomAndShortestRollPath() throws {
        let framing = ShotFramingState(
            shotSize: "MCU",
            lensMm: 50,
            centerX: 0.2,
            centerY: 0.4,
            zoom: 1,
            rollDegrees: 179,
            aspectRatio: 16.0 / 9.0,
            focusAnchorX: 0.2,
            focusAnchorY: 0.3,
            revision: 7
        )
        let track = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "end",
                time: try MediaTime(value: 2, timescale: 1),
                pose: CameraPose2D(
                    centerX: 0.8,
                    centerY: 0.6,
                    zoom: 4,
                    rollDegrees: -179,
                    focusAnchorX: 0.6,
                    focusAnchorY: 0.7
                )
            ),
        ])
        let plan = try CameraMotionEvaluationPlan(
            initialFraming: framing,
            track: track,
            shotDuration: duration
        )
        let midpoint = plan.framing(
            at: try MediaTime(value: 1, timescale: 1)
        )

        XCTAssertEqual(midpoint.centerX, 0.5, accuracy: 0.000_000_1)
        XCTAssertEqual(midpoint.centerY, 0.5, accuracy: 0.000_000_1)
        XCTAssertEqual(midpoint.zoom, 2, accuracy: 0.000_000_1)
        XCTAssertEqual(midpoint.rollDegrees, 180, accuracy: 0.000_000_1)
        XCTAssertEqual(
            try XCTUnwrap(midpoint.focusAnchorX),
            0.4,
            accuracy: 0.000_000_1
        )
        XCTAssertEqual(
            try XCTUnwrap(midpoint.focusAnchorY),
            0.5,
            accuracy: 0.000_000_1
        )
        XCTAssertEqual(midpoint.shotSize, framing.shotSize)
        XCTAssertEqual(midpoint.lensMm, framing.lensMm)
        XCTAssertEqual(midpoint.aspectRatio, framing.aspectRatio)
        XCTAssertEqual(midpoint.revision, framing.revision)
    }

    func testHoldUsesLeftPoseUntilExactRightKeyframe() throws {
        let track = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "first",
                time: try MediaTime(value: 1, timescale: 1),
                pose: CameraPose2D(centerX: 0.25, zoom: 2)
            ),
            CameraMotionKeyframe(
                id: "held-target",
                time: try MediaTime(value: 3, timescale: 1),
                pose: CameraPose2D(centerX: 0.75, zoom: 4),
                easingFromPrevious: CameraMotionEasing(kind: .hold)
            ),
        ])
        let plan = try CameraMotionEvaluationPlan(
            initialFraming: .standard,
            track: track,
            shotDuration: duration
        )

        XCTAssertEqual(
            plan.pose(at: try MediaTime(value: 2, timescale: 1)).centerX,
            0.25
        )
        XCTAssertEqual(
            plan.pose(at: try MediaTime(value: 3, timescale: 1)).centerX,
            0.75
        )
    }

    func testTimeClampsAndLastPosePersists() throws {
        let finalPose = CameraPose2D(centerX: 0.7, centerY: 0.2, zoom: 3)
        let plan = try CameraMotionEvaluationPlan(
            initialFraming: .standard,
            track: CameraMotionTrack(keyframes: [
                CameraMotionKeyframe(
                    id: "finish",
                    time: try MediaTime(value: 2, timescale: 1),
                    pose: finalPose
                ),
            ]),
            shotDuration: duration
        )

        XCTAssertEqual(plan.pose(at: .zero), CameraPose2D(shotFraming: .standard))
        XCTAssertEqual(
            plan.pose(at: try MediaTime(value: 4, timescale: 1)),
            try finalPose.normalized()
        )
    }

    func testJSONKeyOrderDoesNotAffectNormalizationOrEvaluation() throws {
        let firstJSON = #"{"version":1,"enabled":true,"mode":"keyframed","keyframes":[{"id":"end","time":{"value":96,"timescale":24},"pose":{"centerX":0.6,"centerY":0.4,"zoom":2,"rollDegrees":0},"easingFromPrevious":{"kind":"easeInOut"}}]}"#
        let secondJSON = #"{"keyframes":[{"easingFromPrevious":{"kind":"easeInOut"},"pose":{"rollDegrees":0,"zoom":2,"centerY":0.4,"centerX":0.6},"time":{"timescale":1,"value":4},"id":"end"}],"mode":"keyframed","enabled":true,"version":1}"#
        let decoder = JSONDecoder()
        let first = try decoder.decode(
            CameraMotionTrack.self,
            from: Data(firstJSON.utf8)
        )
        let second = try decoder.decode(
            CameraMotionTrack.self,
            from: Data(secondJSON.utf8)
        )

        XCTAssertEqual(
            try first.canonicalRenderData(for: duration),
            try second.canonicalRenderData(for: duration)
        )
        let time = try MediaTime(value: 2, timescale: 1)
        XCTAssertEqual(
            try CameraMotionEvaluationPlan(
                initialFraming: .standard,
                track: first,
                shotDuration: duration
            ).framing(at: time),
            try CameraMotionEvaluationPlan(
                initialFraming: .standard,
                track: second,
                shotDuration: duration
            ).framing(at: time)
        )
    }

    func testFocusAnchorAppearsOnlyAtItsExactKeyframe() throws {
        let endpointTime = try MediaTime(value: 2, timescale: 1)
        let endpoint = CameraPose2D(
            centerX: 0.8,
            zoom: 2,
            focusAnchorX: 0.7,
            focusAnchorY: 0.3
        )
        let plan = try CameraMotionEvaluationPlan(
            initialFraming: .standard,
            track: CameraMotionTrack(keyframes: [
                CameraMotionKeyframe(
                    id: "focus",
                    time: endpointTime,
                    pose: endpoint
                ),
            ]),
            shotDuration: duration
        )

        XCTAssertNil(plan.pose(at: .zero).focusAnchor)
        XCTAssertNil(plan.pose(
            at: try MediaTime(value: 1_999, timescale: 1_000)
        ).focusAnchor)
        XCTAssertEqual(
            plan.pose(at: endpointTime).focusAnchor,
            ShotFramingPoint(x: 0.7, y: 0.3)
        )
    }

    func testFocusAnchorRemovalHoldsUntilExactKeyframe() throws {
        let initial = ShotFramingState(
            focusAnchorX: 0.25,
            focusAnchorY: 0.75
        )
        let endpointTime = try MediaTime(value: 2, timescale: 1)
        let plan = try CameraMotionEvaluationPlan(
            initialFraming: initial,
            track: CameraMotionTrack(keyframes: [
                CameraMotionKeyframe(
                    id: "remove-focus",
                    time: endpointTime,
                    pose: CameraPose2D(centerX: 0.6)
                ),
            ]),
            shotDuration: duration
        )

        XCTAssertEqual(
            plan.pose(at: try MediaTime(value: 1, timescale: 1)).focusAnchor,
            ShotFramingPoint(x: 0.25, y: 0.75)
        )
        XCTAssertNil(plan.pose(at: endpointTime).focusAnchor)
    }
}
