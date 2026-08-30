import XCTest
@testable import StoryboardStudio

final class CameraMotionTrackTests: XCTestCase {
    private let duration = try! MediaTime(value: 4, timescale: 1)

    func testNormalizationSortsAndCanonicalizesWithoutDuplicatingTZero() throws {
        let track = CameraMotionTrack(
            presetId: " push-in ",
            keyframes: [
                CameraMotionKeyframe(
                    id: " end ",
                    time: try MediaTime(value: 4, timescale: 1),
                    pose: CameraPose2D(
                        centerX: 2,
                        centerY: -1,
                        zoom: 32,
                        rollDegrees: 540,
                        focusAnchorX: 1.2,
                        focusAnchorY: -0.2
                    )
                ),
                CameraMotionKeyframe(
                    id: "middle",
                    time: try MediaTime(value: 48, timescale: 24),
                    pose: CameraPose2D(zoom: 2)
                ),
            ]
        )

        let normalized = try track.normalized(for: duration)
        XCTAssertEqual(normalized.presetId, "push-in")
        XCTAssertEqual(normalized.keyframes.map(\.id), ["middle", "end"])
        XCTAssertEqual(
            normalized.keyframes.map(\.time),
            [
                try MediaTime(value: 2, timescale: 1),
                try MediaTime(value: 4, timescale: 1),
            ]
        )
        let end = try XCTUnwrap(normalized.keyframes.last?.pose)
        XCTAssertEqual(end.centerX, 1)
        XCTAssertEqual(end.centerY, 0)
        XCTAssertEqual(end.zoom, ShotFramingState.maximumZoom)
        XCTAssertEqual(end.rollDegrees, 180)
        XCTAssertEqual(end.focusAnchorX, 1)
        XCTAssertEqual(end.focusAnchorY, 0)
    }

    func testValidationRejectsAmbiguousOrInvalidKeyframes() throws {
        let first = CameraMotionKeyframe(
            id: "same",
            time: try MediaTime(value: 1, timescale: 1),
            pose: CameraPose2D()
        )
        let duplicateID = CameraMotionTrack(keyframes: [
            first,
            CameraMotionKeyframe(
                id: "same",
                time: try MediaTime(value: 2, timescale: 1),
                pose: CameraPose2D()
            ),
        ])
        XCTAssertThrowsError(try duplicateID.normalized(for: duration)) {
            XCTAssertEqual(
                $0 as? CameraMotionTrackValidationError,
                .duplicateKeyframeID("same")
            )
        }

        let duplicateTime = CameraMotionTrack(keyframes: [
            first,
            CameraMotionKeyframe(
                id: "other",
                time: try MediaTime(value: 24, timescale: 24),
                pose: CameraPose2D()
            ),
        ])
        XCTAssertThrowsError(try duplicateTime.normalized(for: duration))

        let atZero = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "zero",
                time: .zero,
                pose: CameraPose2D()
            ),
        ])
        XCTAssertThrowsError(try atZero.normalized(for: duration))

        let nonFinite = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "bad",
                time: try MediaTime(value: 1, timescale: 1),
                pose: CameraPose2D(centerX: .nan)
            ),
        ])
        XCTAssertThrowsError(try nonFinite.normalized(for: duration))
    }

    func testV1LimitsAndFutureVersionFailClosed() throws {
        XCTAssertThrowsError(
            try CameraMotionTrack(version: 2).normalized(for: duration)
        )
        XCTAssertThrowsError(
            try CameraMotionTrack().normalized(
                for: MediaTime(value: 601, timescale: 1)
            )
        )

        let keyframes = try (1...65).map { index in
            CameraMotionKeyframe(
                id: "k\(index)",
                time: try MediaTime(value: Int64(index), timescale: 100),
                pose: CameraPose2D()
            )
        }
        XCTAssertThrowsError(
            try CameraMotionTrack(keyframes: keyframes)
                .normalized(for: duration)
        )
    }

    func testIdentifierLimitsMatchBackendUTF16Boundaries() throws {
        let maximumUTF16ID = String(repeating: "😀", count: 64)
        XCTAssertEqual(maximumUTF16ID.utf16.count, 128)
        let accepted = CameraMotionTrack(
            presetId: maximumUTF16ID,
            keyframes: [CameraMotionKeyframe(
                id: maximumUTF16ID,
                time: try MediaTime(value: 1, timescale: 1),
                pose: CameraPose2D()
            )]
        )
        XCTAssertNoThrow(try accepted.normalized(for: duration))

        let oversizedID = maximumUTF16ID + "a"
        XCTAssertThrowsError(
            try CameraMotionTrack(keyframes: [CameraMotionKeyframe(
                id: oversizedID,
                time: try MediaTime(value: 1, timescale: 1),
                pose: CameraPose2D()
            )]).normalized(for: duration)
        ) {
            XCTAssertEqual(
                $0 as? CameraMotionTrackValidationError,
                .keyframeIDTooLong(
                    id: oversizedID,
                    maximumUTF16Length: 128
                )
            )
        }

        let oversizedPreset = maximumUTF16ID + "a"
        XCTAssertThrowsError(
            try CameraMotionTrack(presetId: oversizedPreset)
                .normalized(for: duration)
        ) {
            XCTAssertEqual(
                $0 as? CameraMotionTrackValidationError,
                .presetIDTooLong(maximumUTF16Length: 128)
            )
        }
    }

    func testKeyframeTimescaleMatchesBackendBoundary() throws {
        let acceptedTime = try MediaTime(value: 1, timescale: 1_000_000)
        XCTAssertNoThrow(
            try CameraMotionTrack(keyframes: [CameraMotionKeyframe(
                id: "accepted",
                time: acceptedTime,
                pose: CameraPose2D()
            )]).normalized(for: duration)
        )

        let rejectedTime = try MediaTime(value: 1, timescale: 1_000_001)
        XCTAssertThrowsError(
            try CameraMotionTrack(keyframes: [CameraMotionKeyframe(
                id: "rejected",
                time: rejectedTime,
                pose: CameraPose2D()
            )]).normalized(for: duration)
        ) {
            XCTAssertEqual(
                $0 as? CameraMotionTrackValidationError,
                .keyframeTimescaleExceedsLimit(
                    id: "rejected",
                    timescale: 1_000_001,
                    maximumTimescale: 1_000_000
                )
            )
        }
    }

    func testRenderFingerprintExcludesEditorOnlyIdentity() throws {
        let left = CameraMotionTrack(
            presetId: "push-in",
            keyframes: [CameraMotionKeyframe(
                id: "left-id",
                time: duration,
                pose: CameraPose2D(centerX: 0.6, zoom: 2)
            )]
        )
        let right = CameraMotionTrack(
            presetId: "custom",
            keyframes: [CameraMotionKeyframe(
                id: "right-id",
                time: duration,
                pose: CameraPose2D(centerX: 0.6, zoom: 2)
            )]
        )

        XCTAssertEqual(
            try left.canonicalRenderData(for: duration),
            try right.canonicalRenderData(for: duration)
        )
        XCTAssertEqual(
            try left.canonicalRenderFingerprint(for: duration),
            try right.canonicalRenderFingerprint(for: duration)
        )
    }
    func testRenderFingerprintMatchesBackendCanonicalFixture() throws {
        let fixtureDuration = try MediaTime(value: 2, timescale: 1)
        let fixtureTrack = CameraMotionTrack(
            enabled: true,
            mode: .keyframed,
            presetId: "push-in",
            keyframes: [CameraMotionKeyframe(
                id: "kf-1",
                time: try MediaTime(value: 1, timescale: 1),
                pose: CameraPose2D(
                    centerX: 0.5,
                    centerY: 0.5,
                    zoom: 1.2,
                    rollDegrees: 0
                ),
                easingFromPrevious: CameraMotionEasing(kind: .easeInOut)
            )]
        )

        XCTAssertEqual(
            try fixtureTrack.canonicalRenderFingerprint(
                for: fixtureDuration
            ),
            "sha256:f52928b60fda1c63d0c916728a99da8635c4e09f2d081d5b2b2ad0620f800469"
        )
    }

    func testRenderFingerprintCanonicalizesNegativeZeroAcrossRuntimes()
        throws
    {
        let fixtureDuration = try MediaTime(value: 2, timescale: 1)
        func track(zero: Double) throws -> CameraMotionTrack {
            CameraMotionTrack(keyframes: [CameraMotionKeyframe(
                id: "negative-zero",
                time: try MediaTime(value: 1, timescale: 1),
                pose: CameraPose2D(
                    centerX: zero,
                    centerY: zero,
                    zoom: 1,
                    rollDegrees: zero,
                    focusAnchorX: zero,
                    focusAnchorY: zero
                )
            )])
        }

        XCTAssertEqual(
            try track(zero: -0.0).canonicalRenderFingerprint(
                for: fixtureDuration
            ),
            try track(zero: 0.0).canonicalRenderFingerprint(
                for: fixtureDuration
            ),
            "Swift and JavaScript must canonicalize IEEE-754 negative zero identically"
        )
    }

    func testStartIsImplicitAndEndUpsertIsDeterministic() throws {
        let initial = ShotFramingState(
            centerX: 0.2,
            centerY: 0.4,
            zoom: 1.25,
            rollDegrees: 4
        )
        let start = try CameraMotionTrack().startPose(
            initialFraming: initial
        )
        XCTAssertEqual(start, try CameraPose2D(
            centerX: 0.2,
            centerY: 0.4,
            zoom: 1.25,
            rollDegrees: 4
        ).normalized())

        let requestedEnd = CameraPose2D(
            centerX: 0.8,
            centerY: 0.6,
            zoom: 3,
            rollDegrees: -8,
            focusAnchorX: 0.7,
            focusAnchorY: 0.3
        )
        let easing = CameraMotionEasing(kind: .easeInOut)
        let inserted = try CameraMotionTrack(enabled: false)
            .upsertingEndPose(
                requestedEnd,
                for: duration,
                easingFromPrevious: easing
            )

        XCTAssertTrue(inserted.enabled)
        XCTAssertEqual(inserted.keyframes.count, 1)
        XCTAssertEqual(inserted.keyframes[0].id, "camera-end")
        XCTAssertEqual(inserted.keyframes[0].time, duration)
        XCTAssertEqual(inserted.keyframes[0].easingFromPrevious, easing)
        XCTAssertFalse(inserted.keyframes.contains { $0.time == .zero })
        XCTAssertEqual(
            try inserted.endPose(
                initialFraming: initial,
                for: duration
            ),
            try requestedEnd.normalized()
        )

        let replacement = CameraPose2D(centerX: 0.65, zoom: 2)
        let updated = try inserted.upsertingEndPose(
            replacement,
            for: duration
        )
        XCTAssertEqual(updated.keyframes.count, 1)
        XCTAssertEqual(updated.keyframes[0].id, "camera-end")
        XCTAssertEqual(updated.keyframes[0].easingFromPrevious, easing)
        XCTAssertEqual(updated.keyframes[0].pose, try replacement.normalized())
    }

    func testEndUpsertPreservesIntermediateKeysAndAvoidsIDCollision() throws {
        let track = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "camera-end",
                time: try MediaTime(value: 2, timescale: 1),
                pose: CameraPose2D(centerX: 0.4)
            ),
        ])

        let updated = try track.upsertingEndPose(
            CameraPose2D(centerX: 0.9, zoom: 2),
            for: duration
        )

        XCTAssertEqual(updated.keyframes.map(\.id), [
            "camera-end",
            "camera-end-2",
        ])
        XCTAssertEqual(updated.keyframes.map(\.time), [
            try MediaTime(value: 2, timescale: 1),
            duration,
        ])
    }

    func testProportionalRetimeIsExactAndReversible() throws {
        let original = CameraMotionTrack(
            mode: .performed,
            presetId: "performed-move",
            keyframes: [
                CameraMotionKeyframe(
                    id: "quarter",
                    time: try MediaTime(value: 1, timescale: 1),
                    pose: CameraPose2D(centerX: 0.3)
                ),
                CameraMotionKeyframe(
                    id: "middle",
                    time: try MediaTime(value: 5, timescale: 2),
                    pose: CameraPose2D(centerX: 0.6),
                    easingFromPrevious: CameraMotionEasing(kind: .easeOut)
                ),
                CameraMotionKeyframe(
                    id: "end",
                    time: duration,
                    pose: CameraPose2D(centerX: 0.9)
                ),
            ]
        )
        let shorter = try MediaTime(value: 3, timescale: 2)

        let retimed = try original.retimedProportionally(
            from: duration,
            to: shorter
        )

        XCTAssertEqual(retimed.keyframes.map(\.time), [
            try MediaTime(value: 3, timescale: 8),
            try MediaTime(value: 15, timescale: 16),
            shorter,
        ])
        XCTAssertEqual(retimed.keyframes.map(\.id), [
            "quarter", "middle", "end",
        ])
        XCTAssertEqual(retimed.mode, .performed)
        XCTAssertEqual(retimed.presetId, "performed-move")
        XCTAssertFalse(retimed.keyframes.contains { $0.time == .zero })
        XCTAssertEqual(
            try retimed.retimedProportionally(
                from: shorter,
                to: duration
            ),
            try original.normalized(for: duration)
        )
    }
}
