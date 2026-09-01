import XCTest
@testable import StoryboardStudio

final class CameraMotionPerformRecorderTests: XCTestCase {
    private let timing = StoryboardTiming.legacyDefault
    private let duration = try! MediaTime(value: 4, timescale: 1)
    private let initialPose = try! CameraPose2D(
        centerX: 0.4,
        centerY: 0.45,
        zoom: 1.2,
        rollDegrees: 2
    ).normalized()

    func testConfigurationIsVersionedCodableAndValidationFailsClosed()
        throws
    {
        let configuration = CameraMotionPerformConfiguration.locked1080pV1
        XCTAssertEqual(configuration.version, 1)
        XCTAssertEqual(configuration.algorithmVersion, 1)
        XCTAssertEqual(
            try JSONDecoder().decode(
                CameraMotionPerformConfiguration.self,
                from: JSONEncoder().encode(configuration)
            ),
            configuration
        )

        XCTAssertThrowsError(try makeRecorder(configuration:
            CameraMotionPerformConfiguration(
                version: 2,
                referenceViewportSize: configuration.referenceViewportSize,
                maximumScreenSpaceErrorPixels: 2,
                maximumKeyframes: 64
            )
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .unsupportedConfigurationVersion(2)
            )
        }
        XCTAssertThrowsError(try makeRecorder(configuration:
            CameraMotionPerformConfiguration(
                algorithmVersion: 2,
                referenceViewportSize: configuration.referenceViewportSize,
                maximumScreenSpaceErrorPixels: 2,
                maximumKeyframes: 64
            )
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .unsupportedAlgorithmVersion(2)
            )
        }
        XCTAssertThrowsError(try makeRecorder(configuration:
            CameraMotionPerformConfiguration(
                referenceViewportSize: ShotFramingSize(width: 0, height: 1_080),
                maximumScreenSpaceErrorPixels: 2,
                maximumKeyframes: 64
            )
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .invalidReferenceViewport
            )
        }
        XCTAssertThrowsError(try makeRecorder(configuration:
            CameraMotionPerformConfiguration(
                referenceViewportSize: configuration.referenceViewportSize,
                maximumScreenSpaceErrorPixels: .nan,
                maximumKeyframes: 64
            )
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .invalidErrorBudget
            )
        }
        XCTAssertThrowsError(try makeRecorder(configuration:
            CameraMotionPerformConfiguration(
                referenceViewportSize: configuration.referenceViewportSize,
                maximumScreenSpaceErrorPixels: 2,
                maximumKeyframes: 65
            )
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .invalidMaximumKeyframes(65)
            )
        }
        XCTAssertThrowsError(try CameraMotionPerformRecorder(
            initialPose: CameraPose2D(centerX: .nan),
            shotDuration: duration,
            timing: timing
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .invalidInitialPose(.nonFinite(field: "centerX"))
            )
        }
    }

    func testRecorderLifecycleOrderingFiniteBoundaryAndCancellation()
        throws
    {
        var recorder = try makeRecorder()
        XCTAssertEqual(recorder.state, .ready)
        XCTAssertNil(recorder.result)

        XCTAssertThrowsError(try recorder.append(
            CameraMotionPerformSample(
                time: .zero,
                pose: initialPose
            )
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .invalidState(expected: .recording, actual: .ready)
            )
        }

        try recorder.start()
        XCTAssertEqual(recorder.state, .recording)
        XCTAssertThrowsError(try recorder.start()) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .invalidState(expected: .ready, actual: .recording)
            )
        }

        let later = try MediaTime(value: 2, timescale: 25)
        try recorder.append(CameraMotionPerformSample(
            time: later,
            pose: CameraPose2D(centerX: 0.55, zoom: 1.3)
        ))
        XCTAssertThrowsError(try recorder.append(
            CameraMotionPerformSample(
                time: try MediaTime(value: 1, timescale: 25),
                pose: CameraPose2D(centerX: 0.6)
            )
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .samplesOutOfOrder(
                    previous: later,
                    next: try! MediaTime(value: 1, timescale: 25)
                )
            )
        }
        let outside = try MediaTime(value: 101, timescale: 25)
        XCTAssertThrowsError(try recorder.append(
            CameraMotionPerformSample(
                time: outside,
                pose: CameraPose2D(centerX: 0.6)
            )
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .sampleAfterShotDuration(outside)
            )
        }
        XCTAssertThrowsError(try recorder.append(
            CameraMotionPerformSample(
                time: try MediaTime(value: 3, timescale: 25),
                pose: CameraPose2D(zoom: .infinity)
            )
        )) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .invalidSamplePose(.nonFinite(field: "zoom"))
            )
        }

        recorder.cancel()
        XCTAssertEqual(recorder.state, .cancelled)
        XCTAssertNil(recorder.result)
        XCTAssertThrowsError(try recorder.start()) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .invalidState(expected: .ready, actual: .cancelled)
            )
        }
    }

    func testNoOpFailsTypedAndImmediateTZeroMoveUsesFirstPositiveFrame()
        throws
    {
        var recorder = try makeRecorder()
        try recorder.start()

        XCTAssertThrowsError(try recorder.stop()) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .noMeaningfulMotion
            )
        }
        XCTAssertEqual(recorder.state, .recording)
        XCTAssertNil(recorder.result)

        try recorder.append(CameraMotionPerformSample(
            time: .zero,
            pose: initialPose
        ))
        XCTAssertThrowsError(try recorder.stop()) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .noMeaningfulMotion
            )
        }

        let moved = try CameraPose2D(
            centerX: 0.62,
            centerY: 0.52,
            zoom: 1.5,
            rollDegrees: 5
        ).normalized()
        try recorder.append(CameraMotionPerformSample(
            time: .zero,
            pose: moved
        ))
        let result = try recorder.stop()

        XCTAssertEqual(recorder.state, .completed)
        XCTAssertEqual(recorder.result, result)
        XCTAssertEqual(result.track.mode, .performed)
        XCTAssertTrue(result.track.enabled)
        XCTAssertEqual(result.track.presetId, "perform-v1")
        XCTAssertEqual(
            result.track.keyframes.first?.time,
            try MediaTime(value: 1, timescale: 25)
        )
        XCTAssertEqual(result.track.keyframes.first?.pose, moved)
        XCTAssertEqual(result.track.keyframes.last?.time, duration)
        XCTAssertEqual(
            result.track.keyframes.last?.easingFromPrevious.kind,
            .hold
        )
        XCTAssertFalse(result.track.keyframes.contains { $0.time == .zero })

        let plan = try evaluationPlan(for: result.track)
        XCTAssertEqual(plan.pose(at: .zero), initialPose)
        XCTAssertEqual(
            plan.pose(at: try MediaTime(value: 1, timescale: 25)),
            moved
        )
    }

    func testTZeroLastWriterWinsWhenGestureReturnsToInitialPose() throws {
        var recorder = try makeRecorder()
        try recorder.start()
        try recorder.append(CameraMotionPerformSample(
            time: .zero,
            pose: CameraPose2D(centerX: 0.7, zoom: 1.8)
        ))
        try recorder.append(CameraMotionPerformSample(
            time: .zero,
            pose: initialPose
        ))

        XCTAssertThrowsError(try recorder.stop()) {
            XCTAssertEqual(
                $0 as? CameraMotionPerformError,
                .noMeaningfulMotion
            )
        }
    }

    func testSameFrameUsesLastSampleAndNormalizesFinitePose() throws {
        var recorder = try makeRecorder()
        try recorder.start()

        try recorder.append(CameraMotionPerformSample(
            time: try MediaTime(value: 13, timescale: 500),
            pose: CameraPose2D(centerX: 0.55, zoom: 1.4)
        ))
        try recorder.append(CameraMotionPerformSample(
            time: try MediaTime(value: 17, timescale: 500),
            pose: CameraPose2D(
                centerX: 4,
                centerY: -3,
                zoom: 99,
                rollDegrees: 540,
                focusAnchorX: 4,
                focusAnchorY: -2
            )
        ))
        let result = try recorder.stop()
        let first = try XCTUnwrap(result.track.keyframes.first)

        XCTAssertEqual(first.time, try MediaTime(value: 1, timescale: 25))
        XCTAssertEqual(first.pose.centerX, 1)
        XCTAssertEqual(first.pose.centerY, 0)
        XCTAssertEqual(first.pose.zoom, ShotFramingState.maximumZoom)
        XCTAssertEqual(first.pose.rollDegrees, 180)
        XCTAssertEqual(first.pose.focusAnchorX, 1)
        XCTAssertEqual(first.pose.focusAnchorY, 0)
        XCTAssertEqual(result.sourceSampleCount, 2)
        XCTAssertEqual(result.quantizedSampleCount, 3)
    }

    func testLinearPerformanceReducesToExactEndpointDeterministically()
        throws
    {
        let samples = try (1...100).map { frame -> CameraMotionPerformSample in
            let progress = Double(frame) / 100
            return CameraMotionPerformSample(
                time: try MediaTime(value: Int64(frame), timescale: 25),
                pose: CameraPose2D(
                    centerX: initialPose.centerX + 0.2 * progress,
                    centerY: initialPose.centerY - 0.1 * progress,
                    zoom: exp(
                        log(initialPose.zoom)
                            + (log(2.4) - log(initialPose.zoom)) * progress
                    ),
                    rollDegrees: initialPose.rollDegrees + 10 * progress
                )
            )
        }

        let first = try record(samples)
        let second = try record(samples)

        XCTAssertEqual(first, second)
        XCTAssertEqual(first.fingerprint, second.fingerprint)
        XCTAssertEqual(first.track.mode, .performed)
        XCTAssertEqual(first.track.keyframes.count, 1)
        XCTAssertEqual(first.track.keyframes[0].time, duration)
        XCTAssertEqual(
            first.track.keyframes[0].easingFromPrevious.kind,
            .linear
        )
        XCTAssertEqual(first.sourceSampleCount, 100)
        XCTAssertEqual(first.quantizedSampleCount, 101)
        XCTAssertLessThanOrEqual(
            first.maximumScreenSpaceErrorPixels,
            2.000_001
        )
    }

    func testEarlyStopPersistsHoldAtExactEndAndEvaluatorDoesNotDrift()
        throws
    {
        let moved = try CameraPose2D(
            centerX: 0.72,
            centerY: 0.36,
            zoom: 2.1,
            rollDegrees: -7
        ).normalized()
        let result = try record([
            CameraMotionPerformSample(
                time: try MediaTime(value: 1, timescale: 1),
                pose: moved
            ),
        ])

        XCTAssertEqual(
            result.track.keyframes.map { $0.time },
            [
                try MediaTime(value: 1, timescale: 1),
                duration,
            ]
        )
        XCTAssertEqual(
            result.track.keyframes.map { $0.easingFromPrevious.kind },
            [.linear, .hold]
        )

        let plan = try evaluationPlan(for: result.track)
        XCTAssertEqual(
            plan.pose(at: try MediaTime(value: 1, timescale: 1)),
            moved
        )
        XCTAssertEqual(
            plan.pose(at: try MediaTime(value: 5, timescale: 2)),
            moved
        )
        XCTAssertEqual(plan.pose(at: duration), moved)
    }

    func testLocked1080pNonlinearFixtureStaysWithinTwoPixels()
        throws
    {
        let fixtureDuration = try MediaTime(value: 2, timescale: 1)
        var samples: [CameraMotionPerformSample] = []
        for frame in 1...50 {
            let progress = Double(frame) / 50
            samples.append(CameraMotionPerformSample(
                time: try MediaTime(
                    value: Int64(frame),
                    timescale: 25
                ),
                pose: CameraPose2D(
                    centerX: initialPose.centerX
                        + 0.12 * sin(progress * 2 * .pi),
                    centerY: initialPose.centerY
                        + 0.08 * progress * progress,
                    zoom: exp(
                        log(initialPose.zoom)
                            + (log(2.0) - log(initialPose.zoom)) * progress
                    ),
                    rollDegrees: initialPose.rollDegrees
                        + 8 * sin(progress * .pi)
                )
            ))
        }

        let result = try record(samples, shotDuration: fixtureDuration)
        XCTAssertLessThanOrEqual(
            result.maximumScreenSpaceErrorPixels,
            2.000_001
        )
        XCTAssertLessThanOrEqual(result.track.keyframes.count, 64)
        XCTAssertTrue(strictlyIncreasing(
            result.track.keyframes.map { $0.time }
        ))
        XCTAssertFalse(result.track.keyframes.contains { $0.time == .zero })
        XCTAssertEqual(
            result.track.keyframes.last?.time,
            fixtureDuration
        )

        let plan = try evaluationPlan(
            for: result.track,
            shotDuration: fixtureDuration
        )
        var independentlyMeasured = 0.0
        for sample in samples {
            independentlyMeasured = max(
                independentlyMeasured,
                CameraMotionPerformScreenSpace.errorPixels(
                    plan.pose(at: sample.time),
                    try sample.pose.normalized(),
                    viewportSize: ShotFramingSize(
                        width: 1_920,
                        height: 1_080
                    )
                )
            )
        }
        XCTAssertLessThanOrEqual(independentlyMeasured, 2.000_001)
        XCTAssertEqual(
            independentlyMeasured,
            result.maximumScreenSpaceErrorPixels,
            accuracy: 0.000_001
        )
    }

    func testFocusPresenceTransitionsOnlyAtExactQuantizedKey() throws {
        let keyTime = try MediaTime(value: 5, timescale: 25)
        let focused = try CameraPose2D(
            centerX: 0.55,
            centerY: 0.48,
            zoom: 1.3,
            focusAnchorX: 0.7,
            focusAnchorY: 0.3
        ).normalized()
        let added = try record([
            CameraMotionPerformSample(time: keyTime, pose: focused),
        ])
        let addedPlan = try evaluationPlan(for: added.track)

        XCTAssertNil(
            addedPlan.pose(
                at: try MediaTime(value: 4, timescale: 25)
            ).focusAnchor
        )
        XCTAssertEqual(
            addedPlan.pose(at: keyTime).focusAnchor,
            ShotFramingPoint(x: 0.7, y: 0.3)
        )
        XCTAssertEqual(
            addedPlan.pose(
                at: try MediaTime(value: 3, timescale: 1)
            ).focusAnchor,
            ShotFramingPoint(x: 0.7, y: 0.3)
        )

        let focusedInitial = try CameraPose2D(
            centerX: 0.4,
            centerY: 0.45,
            zoom: 1.2,
            rollDegrees: 2,
            focusAnchorX: 0.4,
            focusAnchorY: 0.6
        ).normalized()
        let removedPose = try CameraPose2D(
            centerX: 0.55,
            centerY: 0.48,
            zoom: 1.3
        ).normalized()
        let removed = try record(
            [CameraMotionPerformSample(
                time: keyTime,
                pose: removedPose
            )],
            initialPose: focusedInitial
        )
        let removedPlan = try evaluationPlan(
            for: removed.track,
            initialPose: focusedInitial
        )
        XCTAssertEqual(
            removedPlan.pose(
                at: try MediaTime(value: 4, timescale: 25)
            ).focusAnchor,
            ShotFramingPoint(x: 0.4, y: 0.6)
        )
        XCTAssertNil(removedPlan.pose(at: keyTime).focusAnchor)
    }

    func testNTSCQuantizationUsesExactProjectFrameRationals() throws {
        let ntsc = try StoryboardTiming(
            projectFrameRate: MediaTime(
                value: 24_000,
                timescale: 1_001
            ),
            timelineTimescale: 24_000
        )
        let ntscDuration = try MediaTime(
            value: 1_001,
            timescale: 500
        )
        let lastPose = CameraPose2D(centerX: 0.7, zoom: 1.7)
        let result = try record(
            [
                CameraMotionPerformSample(
                    time: try MediaTime(value: 1, timescale: 50),
                    pose: CameraPose2D(centerX: 0.6, zoom: 1.5)
                ),
                CameraMotionPerformSample(
                    time: try MediaTime(value: 3, timescale: 50),
                    pose: lastPose
                ),
            ],
            shotDuration: ntscDuration,
            timing: ntsc
        )

        XCTAssertEqual(
            result.track.keyframes.first?.time,
            try MediaTime(value: 1_001, timescale: 24_000)
        )
        XCTAssertEqual(
            result.track.keyframes.first?.pose,
            try lastPose.normalized()
        )
        XCTAssertEqual(result.track.keyframes.last?.time, ntscDuration)
        XCTAssertTrue(strictlyIncreasing(
            result.track.keyframes.map { $0.time }
        ))
        for keyframe in result.track.keyframes {
            XCTAssertNoThrow(
                try keyframe.time.scaledValueExactly(to: 24_000)
            )
        }
    }

    func testComplexTrajectoryFailsWhenSixtyFourKeysCannotMeetBudget()
        throws
    {
        var recorder = try makeRecorder()
        try recorder.start()
        for frame in 1...100 {
            try recorder.append(CameraMotionPerformSample(
                time: try MediaTime(
                    value: Int64(frame),
                    timescale: 25
                ),
                pose: CameraPose2D(
                    centerX: frame.isMultiple(of: 2) ? 0.2 : 0.8,
                    centerY: 0.5,
                    zoom: 1.2
                )
            ))
        }

        XCTAssertThrowsError(try recorder.stop()) { error in
            guard case let CameraMotionPerformError
                .keyframeLimitCannotMeetErrorBudget(
                    requiredKeyframes,
                    maximumKeyframes,
                    maximumErrorPixels
                ) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
            XCTAssertGreaterThan(requiredKeyframes, 64)
            XCTAssertEqual(maximumKeyframes, 64)
            XCTAssertEqual(maximumErrorPixels, 2)
        }
        XCTAssertEqual(recorder.state, .recording)
        XCTAssertNil(recorder.result)
    }

    func testSeededTrajectoriesAreDeterministicBoundedAndAccurate()
        throws
    {
        let propertyDuration = try MediaTime(value: 1, timescale: 1)
        for seed in UInt64(1)...UInt64(8) {
            var generator = DeterministicGenerator(seed: seed)
            var samples: [CameraMotionPerformSample] = []
            for frame in 1...25 {
                samples.append(CameraMotionPerformSample(
                    time: try MediaTime(
                        value: Int64(frame),
                        timescale: 25
                    ),
                    pose: CameraPose2D(
                        centerX: 0.3 + 0.4 * generator.nextUnit(),
                        centerY: 0.35 + 0.3 * generator.nextUnit(),
                        zoom: 1.05 + 1.5 * generator.nextUnit(),
                        rollDegrees: -12 + 24 * generator.nextUnit()
                    )
                ))
            }

            let first = try record(
                samples,
                shotDuration: propertyDuration
            )
            let second = try record(
                samples,
                shotDuration: propertyDuration
            )
            XCTAssertEqual(first, second, "seed \(seed)")
            XCTAssertEqual(first.track.mode, .performed, "seed \(seed)")
            XCTAssertLessThanOrEqual(
                first.track.keyframes.count,
                64,
                "seed \(seed)"
            )
            XCTAssertTrue(
                strictlyIncreasing(first.track.keyframes.map { $0.time }),
                "seed \(seed)"
            )
            XCTAssertFalse(
                first.track.keyframes.contains { $0.time == .zero },
                "seed \(seed)"
            )
            XCTAssertEqual(
                first.track.keyframes.last?.time,
                propertyDuration,
                "seed \(seed)"
            )
            XCTAssertLessThanOrEqual(
                first.maximumScreenSpaceErrorPixels,
                2.000_001,
                "seed \(seed)"
            )
        }
    }

    private func makeRecorder(
        initialPose: CameraPose2D? = nil,
        shotDuration: MediaTime? = nil,
        timing: StoryboardTiming? = nil,
        configuration: CameraMotionPerformConfiguration = .locked1080pV1
    ) throws -> CameraMotionPerformRecorder {
        try CameraMotionPerformRecorder(
            initialPose: initialPose ?? self.initialPose,
            shotDuration: shotDuration ?? duration,
            timing: timing ?? self.timing,
            configuration: configuration
        )
    }

    private func record(
        _ samples: [CameraMotionPerformSample],
        initialPose: CameraPose2D? = nil,
        shotDuration: MediaTime? = nil,
        timing: StoryboardTiming? = nil
    ) throws -> CameraMotionPerformResult {
        var recorder = try makeRecorder(
            initialPose: initialPose,
            shotDuration: shotDuration,
            timing: timing
        )
        try recorder.start()
        for sample in samples {
            try recorder.append(sample)
        }
        return try recorder.stop()
    }

    private func evaluationPlan(
        for track: CameraMotionTrack,
        initialPose: CameraPose2D? = nil,
        shotDuration: MediaTime? = nil
    ) throws -> CameraMotionEvaluationPlan {
        let pose = initialPose ?? self.initialPose
        return try CameraMotionEvaluationPlan(
            initialFraming: ShotFramingState(
                centerX: pose.centerX,
                centerY: pose.centerY,
                zoom: pose.zoom,
                rollDegrees: pose.rollDegrees,
                aspectRatio: 16.0 / 9.0,
                focusAnchorX: pose.focusAnchorX,
                focusAnchorY: pose.focusAnchorY,
                mode: .manual
            ),
            track: track,
            shotDuration: shotDuration ?? duration
        )
    }

    private func strictlyIncreasing(_ values: [MediaTime]) -> Bool {
        guard values.count > 1 else { return true }
        return zip(values, values.dropFirst()).allSatisfy(<)
    }

    private struct DeterministicGenerator {
        private var state: UInt64

        init(seed: UInt64) {
            state = seed
        }

        mutating func nextUnit() -> Double {
            state = state &* 6_364_136_223_846_793_005
                &+ 1_442_695_040_888_963_407
            return Double(state >> 11)
                / Double(UInt64(1) << 53)
        }
    }
}
