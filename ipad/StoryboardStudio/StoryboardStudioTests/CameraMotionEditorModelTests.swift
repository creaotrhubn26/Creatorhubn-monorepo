import XCTest
@testable import StoryboardStudio

@MainActor
final class CameraMotionEditorModelTests: XCTestCase {
    func testTwentyFiveFPSUsesExactFrameScrubStepAndExplicitEndpoint() throws {
        let timing = try StoryboardTiming(
            projectFrameRate: MediaTime(value: 25, timescale: 1),
            timelineTimescale: 600
        )
        let duration = try MediaTime(value: 3, timescale: 2)
        let model = CameraMotionEditorModel(
            initialFraming: .standard,
            motionTrack: nil,
            shotDuration: duration,
            timing: timing
        )

        model.selectEndpoint(.start)
        XCTAssertEqual(model.editorFrameCount, 39)
        model.scrub(toProgress: 0.5)
        XCTAssertEqual(
            model.currentTime,
            try MediaTime(value: 18, timescale: 25)
        )
        XCTAssertEqual(model.currentFrameIndex, 18)

        model.stepFrame(by: 1)
        XCTAssertEqual(
            model.currentTime,
            try MediaTime(value: 19, timescale: 25)
        )
        XCTAssertEqual(model.currentFrameIndex, 19)

        model.scrub(toProgress: 1)
        XCTAssertEqual(model.currentTime, duration)
        XCTAssertEqual(model.currentFrameIndex, 38)
        model.stepFrame(by: -1)
        XCTAssertEqual(
            model.currentTime,
            try MediaTime(value: 37, timescale: 25)
        )
    }

    func testNTSCGridNeverRoundTripsThroughApproximateFrameSeconds() throws {
        let timing = try StoryboardTiming(
            projectFrameRate: MediaTime(value: 24_000, timescale: 1_001),
            timelineTimescale: 24_000
        )
        let duration = try MediaTime(value: 1_001, timescale: 500)
        let model = CameraMotionEditorModel(
            initialFraming: .standard,
            motionTrack: nil,
            shotDuration: duration,
            timing: timing
        )

        model.selectEndpoint(.start)
        XCTAssertEqual(model.editorFrameCount, 49)
        model.stepFrame(by: 1)
        XCTAssertEqual(
            model.currentTime,
            try MediaTime(value: 1_001, timescale: 24_000)
        )
        model.scrub(toProgress: 0.5)
        XCTAssertEqual(
            model.currentTime,
            try MediaTime(value: 24_024, timescale: 24_000)
        )
        XCTAssertEqual(model.currentFrameIndex, 24)
        model.scrub(toProgress: 1)
        XCTAssertEqual(model.currentTime, duration)
        XCTAssertEqual(model.currentFrameIndex, 48)
    }

    func testRepresentablePresetsProduceTruthfulStartAndEndPoses() throws {
        let timing = StoryboardTiming.legacyDefault
        let duration = try MediaTime(value: 4, timescale: 1)
        let initial = ShotFramingState(
            centerX: 0.5,
            centerY: 0.5,
            zoom: 1.2
        )

        for preset in CameraMotionEditorPreset.allCases where
            preset != .staticShot && preset != .custom {
            let model = CameraMotionEditorModel(
                initialFraming: initial,
                motionTrack: nil,
                shotDuration: duration,
                timing: timing
            )
            model.applyPreset(preset)
            let track = try XCTUnwrap(model.motionTrack)
            let start = try track.startPose(
                initialFraming: model.initialFraming
            )
            let end = try track.endPose(
                initialFraming: model.initialFraming,
                for: duration
            )

            XCTAssertNotEqual(start, end, "\(preset) must visibly move")
            XCTAssertEqual(track.presetId, preset.rawValue)
            XCTAssertEqual(track.keyframes.map(\.time), [duration])
            XCTAssertEqual(model.currentTime, duration)

            switch preset {
            case .pushIn:
                XCTAssertGreaterThan(end.zoom, start.zoom)
            case .pullOut:
                XCTAssertLessThan(end.zoom, start.zoom)
            case .panLeft:
                XCTAssertLessThan(end.centerX, start.centerX)
            case .panRight:
                XCTAssertGreaterThan(end.centerX, start.centerX)
            case .tiltUp:
                XCTAssertLessThan(end.centerY, start.centerY)
            case .tiltDown:
                XCTAssertGreaterThan(end.centerY, start.centerY)
            case .staticShot, .custom:
                XCTFail("Unexpected preset")
            }
        }
    }

    func testManualEndEditPreservesIntermediateKeyIdentityAndEasing() throws {
        let duration = try MediaTime(value: 4, timescale: 1)
        let middleTime = try MediaTime(value: 2, timescale: 1)
        let middle = CameraMotionKeyframe(
            id: "middle",
            time: middleTime,
            pose: CameraPose2D(centerX: 0.42, zoom: 1.4),
            easingFromPrevious: CameraMotionEasing(kind: .easeIn)
        )
        let end = CameraMotionKeyframe(
            id: "authored-end",
            time: duration,
            pose: CameraPose2D(centerX: 0.7, zoom: 2),
            easingFromPrevious: CameraMotionEasing(kind: .easeOut)
        )
        let model = CameraMotionEditorModel(
            initialFraming: .standard,
            motionTrack: CameraMotionTrack(keyframes: [middle, end]),
            shotDuration: duration,
            timing: .legacyDefault
        )

        model.setSelectedPose(CameraPose2D(centerX: 0.8, zoom: 2.5))
        model.setEasing(.easeInOut)
        let committed = try model.commit()
        let track = try XCTUnwrap(committed.motionTrack)

        XCTAssertEqual(track.keyframes.count, 2)
        XCTAssertEqual(track.keyframes[0], middle)
        XCTAssertEqual(track.keyframes[1].id, "authored-end")
        XCTAssertEqual(track.keyframes[1].time, duration)
        XCTAssertEqual(track.keyframes[1].pose.centerX, 0.8)
        XCTAssertEqual(track.keyframes[1].pose.zoom, 2.5)
        XCTAssertEqual(
            track.keyframes[1].easingFromPrevious.kind,
            .easeInOut
        )
        XCTAssertNil(track.presetId)
    }

    func testStartEditKeepsShotMetadataAndTrackWhileMovingTZero() throws {
        let duration = try MediaTime(value: 4, timescale: 1)
        let original = ShotFramingState(
            shotSize: "MCU",
            angle: "Low",
            lensMm: 50,
            centerX: 0.5,
            centerY: 0.5,
            zoom: 1.2,
            aspectRatio: 2.39,
            intentFingerprint: "intent-v1",
            revision: 7
        )
        let track = CameraMotionTrack(
            presetId: CameraMotionEditorPreset.panLeft.rawValue,
            keyframes: [
                CameraMotionKeyframe(
                    id: "end",
                    time: duration,
                    pose: CameraPose2D(centerX: 0.7, zoom: 2)
                ),
            ]
        )
        let model = CameraMotionEditorModel(
            initialFraming: original,
            motionTrack: track,
            shotDuration: duration,
            timing: .legacyDefault,
            selectedEndpoint: .start
        )

        model.setSelectedPose(CameraPose2D(
            centerX: 0.35,
            centerY: 0.45,
            zoom: 1.5,
            rollDegrees: 4
        ))
        let commit = try model.commit()

        XCTAssertEqual(commit.initialFraming.shotSize, "MCU")
        XCTAssertEqual(commit.initialFraming.angle, "Low")
        XCTAssertEqual(commit.initialFraming.lensMm, 50)
        XCTAssertEqual(commit.initialFraming.aspectRatio, 2.39)
        XCTAssertEqual(commit.initialFraming.intentFingerprint, "intent-v1")
        XCTAssertEqual(commit.initialFraming.revision, 7)
        XCTAssertEqual(commit.initialFraming.centerX, 0.35)
        XCTAssertEqual(commit.initialFraming.zoom, 1.5)
        XCTAssertEqual(commit.motionTrack?.keyframes, track.keyframes)
        XCTAssertNil(commit.motionTrack?.presetId)
        XCTAssertEqual(model.currentTime, .zero)
    }

    func testDraftDiscardAndStaticCommitAreTransactional() throws {
        let duration = try MediaTime(value: 4, timescale: 1)
        let existing = CameraMotionTrack(keyframes: [CameraMotionKeyframe(
            id: "end",
            time: duration,
            pose: CameraPose2D(zoom: 2)
        )])
        let model = CameraMotionEditorModel(
            initialFraming: .standard,
            motionTrack: existing,
            shotDuration: duration,
            timing: .legacyDefault
        )

        XCTAssertFalse(model.isDirty)
        model.applyPreset(.staticShot)
        XCTAssertTrue(model.isDirty)
        XCTAssertNil(try model.commit().motionTrack)

        model.discardChanges()
        XCTAssertFalse(model.isDirty)
        XCTAssertEqual(model.motionTrack, existing)
        XCTAssertEqual(model.currentTime, duration)
    }

    func testExternalBlockingValidationDisablesSaveAndCommitFailsClosed() throws {
        let duration = try MediaTime(value: 4, timescale: 1)
        let model = CameraMotionEditorModel(
            initialFraming: .standard,
            motionTrack: nil,
            shotDuration: duration,
            timing: .legacyDefault,
            validator: { _, _, _ in
                CameraMotionEditorValidation(
                    severity: .blocking,
                    title: "Plate coverage blocked",
                    detail: "The source plate cannot cover the requested viewport."
                )
            }
        )

        XCTAssertFalse(model.canSave)
        XCTAssertEqual(model.validation.title, "Plate coverage blocked")
        XCTAssertThrowsError(try model.commit()) { error in
            guard case CameraMotionEditorError.invalidDraft = error else {
                return XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testPerformRecordsFullShotReviewsCoverageAndCommitsPerformedTrack() throws {
        let duration = try MediaTime(value: 2, timescale: 1)
        var validatedModes: [CameraMotionMode?] = []
        let model = CameraMotionEditorModel(
            initialFraming: .standard,
            motionTrack: nil,
            shotDuration: duration,
            timing: .legacyDefault,
            validator: { _, track, _ in
                validatedModes.append(track?.mode)
                return .ready
            }
        )

        try model.beginPerform()
        XCTAssertEqual(model.performPhase, .recording)
        XCTAssertEqual(model.currentTime, .zero)
        XCTAssertFalse(model.canSave)

        model.advancePerformClock(
            to: try MediaTime(value: 1, timescale: 1)
        )
        var framing = model.presentationFraming
        framing.centerX = 0.64
        framing.centerY = 0.43
        framing.zoom = 1.35
        try model.recordPerformedFraming(framing)

        let result = try model.stopPerform()
        XCTAssertEqual(model.performPhase, .review)
        XCTAssertEqual(result.track.mode, .performed)
        XCTAssertEqual(model.motionTrack, result.track)
        XCTAssertLessThanOrEqual(
            result.track.keyframes.count,
            CameraMotionTrack.maximumKeyframeCount
        )
        XCTAssertEqual(result.track.keyframes.last?.time, duration)
        XCTAssertTrue(model.canSave)
        XCTAssertTrue(validatedModes.contains(.performed))

        let commit = try model.commit()
        XCTAssertEqual(commit.motionTrack?.mode, .performed)
        XCTAssertEqual(commit.motionTrack, result.track)
    }

    func testPerformRequiresExplicitReplacementAndCancelRestoresExactDraft() throws {
        let duration = try MediaTime(value: 3, timescale: 1)
        let initial = ShotFramingState(
            shotSize: "MCU",
            angle: "Low",
            lensMm: 50,
            centerX: 0.42,
            centerY: 0.55,
            zoom: 1.2,
            rollDegrees: 2,
            aspectRatio: 2.39,
            revision: 9
        )
        let existing = CameraMotionTrack(
            mode: .keyframed,
            presetId: CameraMotionEditorPreset.panRight.rawValue,
            keyframes: [CameraMotionKeyframe(
                id: "existing-end",
                time: duration,
                pose: CameraPose2D(centerX: 0.72, zoom: 1.3)
            )]
        )
        let model = CameraMotionEditorModel(
            initialFraming: initial,
            motionTrack: existing,
            shotDuration: duration,
            timing: .legacyDefault,
            selectedEndpoint: .start
        )

        XCTAssertThrowsError(try model.beginPerform()) { error in
            XCTAssertEqual(
                error as? CameraMotionEditorError,
                .performConfirmationRequired
            )
        }
        XCTAssertEqual(model.performPhase, .ready)
        XCTAssertEqual(model.motionTrack, existing)

        try model.beginPerform(replacingExisting: true)
        model.advancePerformClock(
            to: try MediaTime(value: 1, timescale: 1)
        )
        var performed = model.presentationFraming
        performed.centerX = 0.2
        performed.zoom = 1.8
        try model.recordPerformedFraming(performed)
        model.cancelPerform()

        XCTAssertEqual(model.performPhase, .ready)
        XCTAssertEqual(model.initialFraming, initial.normalized())
        XCTAssertEqual(model.motionTrack, existing)
        XCTAssertEqual(model.selectedEndpoint, .start)
        XCTAssertEqual(model.selectedPreset, .panRight)
        XCTAssertEqual(model.currentTime, .zero)
        XCTAssertNil(model.performResult)
        XCTAssertFalse(model.isDirty)
    }

    func testRetakeCancelRestoresPriorReviewAndEditorDiscardRestoresOriginal() throws {
        let duration = try MediaTime(value: 2, timescale: 1)
        let original = CameraMotionTrack(keyframes: [CameraMotionKeyframe(
            id: "original",
            time: duration,
            pose: CameraPose2D(centerX: 0.6, zoom: 1.2)
        )])
        let model = CameraMotionEditorModel(
            initialFraming: .standard,
            motionTrack: original,
            shotDuration: duration,
            timing: .legacyDefault
        )

        try model.beginPerform(replacingExisting: true)
        model.advancePerformClock(
            to: try MediaTime(value: 1, timescale: 1)
        )
        var firstFraming = model.presentationFraming
        firstFraming.centerX = 0.7
        firstFraming.zoom = 1.4
        try model.recordPerformedFraming(firstFraming)
        let firstResult = try model.stopPerform()

        try model.beginPerform(replacingExisting: true)
        model.advancePerformClock(
            to: try MediaTime(value: 1, timescale: 1)
        )
        var retakeFraming = model.presentationFraming
        retakeFraming.centerY = 0.2
        retakeFraming.zoom = 2
        try model.recordPerformedFraming(retakeFraming)
        model.cancelPerform()

        XCTAssertEqual(model.performPhase, .review)
        XCTAssertEqual(model.performResult, firstResult)
        XCTAssertEqual(model.motionTrack, firstResult.track)

        model.discardChanges()
        XCTAssertEqual(model.performPhase, .ready)
        XCTAssertNil(model.performResult)
        XCTAssertEqual(model.motionTrack, original)
        XCTAssertFalse(model.isDirty)
    }

    func testEmptyPerformFailsClosedAndRemainsCancellable() throws {
        let duration = try MediaTime(value: 2, timescale: 1)
        let model = CameraMotionEditorModel(
            initialFraming: .standard,
            motionTrack: nil,
            shotDuration: duration,
            timing: .legacyDefault
        )

        try model.beginPerform()
        XCTAssertThrowsError(try model.stopPerform()) { error in
            XCTAssertEqual(
                error as? CameraMotionPerformError,
                .noMeaningfulMotion
            )
        }
        XCTAssertEqual(model.performPhase, .recording)
        XCTAssertFalse(model.canSave)
        XCTAssertEqual(model.validation.severity, .blocking)

        model.cancelPerform()
        XCTAssertEqual(model.performPhase, .ready)
        XCTAssertNil(model.motionTrack)
        XCTAssertTrue(model.canSave)
    }

    func testPerformedCoverageValidationBlocksSaveImmediately() throws {
        let duration = try MediaTime(value: 2, timescale: 1)
        let model = CameraMotionEditorModel(
            initialFraming: .standard,
            motionTrack: nil,
            shotDuration: duration,
            timing: .legacyDefault,
            validator: { _, track, _ in
                guard track?.mode == .performed else { return .ready }
                return CameraMotionEditorValidation(
                    severity: .blocking,
                    title: "Move exceeds source coverage",
                    detail: "Camera path leaves the source plate"
                )
            }
        )

        try model.beginPerform()
        model.advancePerformClock(
            to: try MediaTime(value: 1, timescale: 1)
        )
        var framing = model.presentationFraming
        framing.centerX = 0.9
        framing.zoom = 1.8
        try model.recordPerformedFraming(framing)
        _ = try model.stopPerform()

        XCTAssertEqual(model.performPhase, .review)
        XCTAssertFalse(model.canSave)
        XCTAssertEqual(model.validation.title, "Move exceeds source coverage")
        XCTAssertThrowsError(try model.commit())
    }
}
