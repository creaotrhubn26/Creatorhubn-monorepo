import XCTest
@testable import StoryboardStudio

final class MediaTimeTests: XCTestCase {
    func testEquivalentValuesNormalizeAndEncodeIdentically() throws {
        let reduced = try MediaTime(value: 48, timescale: 24)
        XCTAssertEqual(reduced, try MediaTime(value: 2, timescale: 1))

        let decoded = try JSONDecoder().decode(
            MediaTime.self,
            from: Data(#"{"value":96,"timescale":48}"#.utf8)
        )
        XCTAssertEqual(decoded, reduced)

        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(
                with: JSONEncoder().encode(decoded)
            ) as? [String: Any]
        )
        XCTAssertEqual(object["value"] as? Int, 2)
        XCTAssertEqual(object["timescale"] as? Int, 1)
    }

    func testInvalidAndLegacyInputsFailOrRoundExplicitly() throws {
        XCTAssertThrowsError(try MediaTime(value: 1, timescale: 0))
        XCTAssertThrowsError(try MediaTime(value: -1, timescale: 24))
        XCTAssertThrowsError(try MediaTime(seconds: .nan))

        XCTAssertEqual(
            try MediaTime(seconds: 2.500_8).scaledValue(
                to: 600,
                rounding: .nearestAwayFromZero
            ),
            1_500
        )
    }

    func testComparisonDoesNotOverflowAtInt64Boundary() throws {
        let lower = try MediaTime(
            value: Int64.max - 1,
            timescale: Int32.max
        )
        let upper = try MediaTime(
            value: Int64.max,
            timescale: Int32.max
        )
        XCTAssertLessThan(lower, upper)
        XCTAssertGreaterThan(upper, lower)
    }

    func testTimescaleConversionUsesNamedRoundingPolicy() throws {
        let quarter = try MediaTime(value: 1, timescale: 4)
        XCTAssertEqual(
            try quarter.scaledValue(to: 2, rounding: .towardZero),
            0
        )
        XCTAssertEqual(
            try quarter.scaledValue(to: 2, rounding: .nearestAwayFromZero),
            1
        )
        XCTAssertEqual(
            try quarter.scaledValue(to: 2, rounding: .awayFromZero),
            1
        )
    }

    func testStoryboardTimingHasDeterministicLegacyDefault() throws {
        XCTAssertEqual(
            StoryboardTiming.legacyDefault.projectFrameRate,
            try MediaTime(value: 25, timescale: 1)
        )
        XCTAssertEqual(
            StoryboardTiming.legacyDefault.timelineTimescale,
            600
        )

        let future = Data(#"{"version":2,"projectFrameRate":{"value":25,"timescale":1},"timelineTimescale":600}"#.utf8)
        XCTAssertThrowsError(
            try JSONDecoder().decode(StoryboardTiming.self, from: future)
        )
    }

    func testDictionaryBridgeCanonicalizesAndRejectsMalformedTime() throws {
        let decoded = try XCTUnwrap(MediaTimeCoding.decode([
            "value": NSNumber(value: 96),
            "timescale": "48",
        ]))
        XCTAssertEqual(decoded, try MediaTime(value: 2, timescale: 1))
        XCTAssertEqual(MediaTimeCoding.object(decoded)["value"] as? Int64, 2)
        XCTAssertNil(MediaTimeCoding.decode([
            "value": 1,
            "timescale": 0,
        ]))
        XCTAssertNil(MediaTimeCoding.decode([
            "value": 1.5,
            "timescale": 600,
        ]))
    }

    func testLegacyDurationBridgeUsesDeterministicSixHundredTimescale() throws {
        let duration = try XCTUnwrap(
            MediaTimeCoding.decodeLegacySeconds("2.5008")
        )
        XCTAssertEqual(duration, try MediaTime(value: 5, timescale: 2))
        XCTAssertNil(MediaTimeCoding.decodeLegacySeconds(Double.nan))
        XCTAssertNil(MediaTimeCoding.decodeLegacySeconds(-1))
    }

    func testDurationPatchRequestDualWritesCanonicalAndBothLegacyAliases() throws {
        let request = try FrameDurationPatchRequest(
            manuscriptId: "manuscript-1",
            sceneId: "scene-1",
            frameId: "frame-1",
            shotDuration: MediaTime(value: 72, timescale: 24),
            expectedDurationRevision: 7)
        let body = FrameDurationPatchWire.requestBody(request)

        XCTAssertTrue(JSONSerialization.isValidJSONObject(body))
        XCTAssertEqual(body["manuscriptId"] as? String, "manuscript-1")
        XCTAssertEqual(body["sceneId"] as? String, "scene-1")
        XCTAssertEqual(body["frameId"] as? String, "frame-1")
        XCTAssertEqual(
            MediaTimeCoding.decode(body["shotDuration"]),
            try MediaTime(value: 3, timescale: 1))
        XCTAssertEqual(body["duration"] as? Double, 3)
        XCTAssertEqual(body["durationSec"] as? Double, 3)
        XCTAssertEqual(body["expectedDurationRevision"] as? Int, 7)
        XCTAssertNil(body["durationRevision"])
    }

    func testDurationPatchSuccessDecodesTypedCanonicalResponse() throws {
        let data = Data(#"""
        {
          "shotDuration":{"value":75,"timescale":25},
          "durationRevision":8,
          "duration":3,
          "durationSec":3,
          "changed":true,
          "updatedAt":"2026-08-30T10:00:00.000Z",
          "sourceUpdatedAt":"2026-08-29T09:00:00.000Z"
        }
        """#.utf8)

        let response = try FrameDurationPatchWire.decodeResponse(
            data: data, statusCode: 200)

        XCTAssertEqual(
            response.shotDuration,
            try MediaTime(value: 3, timescale: 1))
        XCTAssertEqual(response.durationRevision, 8)
        XCTAssertEqual(response.duration, 3)
        XCTAssertEqual(response.durationSec, 3)
        XCTAssertTrue(response.changed)
        XCTAssertEqual(
            response.sourceUpdatedAt,
            "2026-08-29T09:00:00.000Z")

        // JSONSerialization bridges the numeric literal 1 through NSNumber;
        // it must not be mistaken for CFBoolean true at the strict boundary.
        let oneSecond = try FrameDurationPatchWire.decodeResponse(
            data: Data(#"""
            {
              "shotDuration":{"value":1,"timescale":1},
              "durationRevision":1,
              "duration":1,
              "durationSec":1,
              "changed":true,
              "updatedAt":"2026-08-30T10:00:01.000Z"
            }
            """#.utf8),
            statusCode: 200)
        XCTAssertEqual(
            oneSecond.shotDuration,
            try MediaTime(value: 1, timescale: 1))
        XCTAssertEqual(oneSecond.durationRevision, 1)
    }

    func testDurationPatchDecodesCompleteValidRetimedMotionSidecar() throws {
        let duration = try MediaTime(value: 4, timescale: 1)
        let endpoint = try CameraPose2D(
            centerX: 0.72,
            centerY: 0.38,
            zoom: 1.8,
            rollDegrees: 3,
            focusAnchorX: 0.61,
            focusAnchorY: 0.42
        ).normalized()
        let track = try CameraMotionTrack(
            presetId: "dolly-in",
            keyframes: [
                CameraMotionKeyframe(
                    id: "middle",
                    time: MediaTime(value: 2, timescale: 1),
                    pose: CameraPose2D(
                        centerX: 0.58,
                        centerY: 0.46,
                        zoom: 1.3
                    ),
                    easingFromPrevious: CameraMotionEasing(
                        kind: .easeInOut
                    )
                ),
                CameraMotionKeyframe(
                    id: "end",
                    time: duration,
                    pose: endpoint,
                    easingFromPrevious: CameraMotionEasing(
                        kind: .easeOut
                    )
                ),
            ]
        ).normalized(for: duration)
        var payload = durationPatchSuccessPayload(duration: duration)
        payload["cameraMotionTrack"] = try CameraMotionTrackCoding.object(
            track,
            shotDuration: duration
        )
        payload["cameraMotionRevision"] = 13
        payload["cameraMotionUpdatedAt"] = "2026-08-30T10:00:02.000Z"
        payload["cameraMotionFingerprint"] = "sha256:retimed-motion"
        payload["cameraMotionBaseFramingFingerprint"] = "sha256:base"
        payload["cameraMotionStatus"] = "valid"

        let response = try FrameDurationPatchWire.decodeResponse(
            data: JSONSerialization.data(
                withJSONObject: payload,
                options: [.sortedKeys]
            ),
            statusCode: 200
        )
        let sidecar = try XCTUnwrap(response.cameraMotion)

        XCTAssertEqual(response.shotDuration, duration)
        XCTAssertEqual(sidecar.track, track)
        XCTAssertEqual(sidecar.track?.keyframes.last?.time, duration)
        XCTAssertEqual(sidecar.track?.keyframes.last?.pose, endpoint)
        XCTAssertEqual(sidecar.revision, 13)
        XCTAssertEqual(
            sidecar.updatedAt,
            "2026-08-30T10:00:02.000Z"
        )
        XCTAssertEqual(sidecar.fingerprint, "sha256:retimed-motion")
        XCTAssertEqual(sidecar.baseFramingFingerprint, "sha256:base")
        XCTAssertEqual(sidecar.status, "valid")
        XCTAssertEqual(sidecar.readState, .valid)
        XCTAssertNotNil(sidecar.rawJSON)
    }

    func testDurationPatchPreservesFutureAndInvalidMotionSidecarsAsRaw()
        throws
    {
        let duration = try MediaTime(value: 4, timescale: 1)
        let track = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "end",
                time: duration,
                pose: CameraPose2D(centerX: 0.7, zoom: 1.6)
            ),
        ])
        let validObject = try CameraMotionTrackCoding.object(
            track,
            shotDuration: duration
        )

        var futureObject = validObject
        futureObject["version"] = CameraMotionTrack.schemaVersion + 1
        futureObject["futureSpline"] = "preserve-me"

        var invalidObject = validObject
        var invalidKeyframes = try XCTUnwrap(
            invalidObject["keyframes"] as? [[String: Any]]
        )
        invalidKeyframes[0]["time"] = ["value": 5, "timescale": 1]
        invalidObject["keyframes"] = invalidKeyframes

        let cases: [(
            name: String,
            object: [String: Any],
            state: FrameCameraMotionReadState,
            version: Int,
            sentinel: String?
        )] = [
            (
                "future",
                futureObject,
                .upgradeRequired,
                CameraMotionTrack.schemaVersion + 1,
                "preserve-me"
            ),
            (
                "invalid",
                invalidObject,
                .invalid,
                CameraMotionTrack.schemaVersion,
                nil
            ),
        ]

        for item in cases {
            var payload = durationPatchSuccessPayload(duration: duration)
            payload["cameraMotionTrack"] = item.object
            payload["cameraMotionRevision"] = 14
            payload["cameraMotionUpdatedAt"] =
                "2026-08-30T10:00:03.000Z"
            payload["cameraMotionFingerprint"] = NSNull()
            payload["cameraMotionBaseFramingFingerprint"] = "sha256:base"
            payload["cameraMotionStatus"] = "invalid"

            let response = try FrameDurationPatchWire.decodeResponse(
                data: JSONSerialization.data(
                    withJSONObject: payload,
                    options: [.sortedKeys]
                ),
                statusCode: 200
            )
            let sidecar = try XCTUnwrap(
                response.cameraMotion,
                "Missing sidecar for \(item.name) payload"
            )
            let rawJSON = try XCTUnwrap(
                sidecar.rawJSON,
                "Missing recoverable raw JSON for \(item.name) payload"
            )
            let preserved = try XCTUnwrap(
                JSONSerialization.jsonObject(with: Data(rawJSON.utf8))
                    as? [String: Any]
            )

            XCTAssertNil(sidecar.track, item.name)
            XCTAssertEqual(sidecar.revision, 14, item.name)
            XCTAssertEqual(sidecar.status, "invalid", item.name)
            XCTAssertEqual(sidecar.readState, item.state, item.name)
            XCTAssertEqual(preserved["version"] as? Int, item.version)
            XCTAssertEqual(
                preserved["futureSpline"] as? String,
                item.sentinel,
                item.name
            )
        }
    }

    func testDurationPatchRejectsEveryPartialMotionSidecar() throws {
        let duration = try MediaTime(value: 4, timescale: 1)
        let track = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "end",
                time: duration,
                pose: CameraPose2D(centerX: 0.7, zoom: 1.6)
            ),
        ])
        let trackObject = try CameraMotionTrackCoding.object(
            track,
            shotDuration: duration
        )
        let completeSidecar: [String: Any] = [
            "cameraMotionTrack": trackObject,
            "cameraMotionRevision": 15,
            "cameraMotionUpdatedAt": "2026-08-30T10:00:04.000Z",
            "cameraMotionFingerprint": "sha256:motion",
            "cameraMotionBaseFramingFingerprint": "sha256:base",
            "cameraMotionStatus": "valid",
        ]

        for missingKey in completeSidecar.keys.sorted() {
            var payload = durationPatchSuccessPayload(duration: duration)
            for (key, value) in completeSidecar where key != missingKey {
                payload[key] = value
            }
            let data = try JSONSerialization.data(
                withJSONObject: payload,
                options: [.sortedKeys]
            )

            XCTAssertThrowsError(
                try FrameDurationPatchWire.decodeResponse(
                    data: data,
                    statusCode: 200
                ),
                "A sidecar missing \(missingKey) must fail closed"
            ) { error in
                guard case .malformedResponse =
                        error as? FrameDurationPatchError else {
                    return XCTFail(
                        "Expected malformedResponse for missing "
                            + "\(missingKey), got \(error)"
                    )
                }
            }
        }
    }

    private func durationPatchSuccessPayload(
        duration: MediaTime
    ) -> [String: Any] {
        [
            "shotDuration": MediaTimeCoding.object(duration),
            "durationRevision": 9,
            "duration": duration.seconds,
            "durationSec": duration.seconds,
            "changed": true,
            "updatedAt": "2026-08-30T10:00:01.000Z",
        ]
    }

    func testDurationPatchDecodesAllTypedConflictResponses() throws {
        let current = try MediaTime(value: 2, timescale: 1)
        let conflicts: [(String, FrameDurationPatchError)] = [
            (
                #"{"error":"duration_mismatch"}"#,
                .durationMismatch
            ),
            (
                #"{"error":"client_upgrade_required","currentShotDuration":{"value":2,"timescale":1},"currentDurationRevision":5}"#,
                .clientUpgradeRequired(
                    currentShotDuration: current,
                    currentDurationRevision: 5)
            ),
            (
                #"{"error":"duration_revision_conflict","currentShotDuration":{"value":48,"timescale":24},"currentDurationRevision":7}"#,
                .durationRevisionConflict(
                    currentShotDuration: current,
                    currentDurationRevision: 7)
            ),
        ]

        for (json, expected) in conflicts {
            XCTAssertThrowsError(
                try FrameDurationPatchWire.decodeResponse(
                    data: Data(json.utf8), statusCode: 409)
            ) { error in
                XCTAssertEqual(error as? FrameDurationPatchError, expected)
            }
        }
    }

    func testDurationPatchRejectsInternallyDivergentSuccess() {
        let data = Data(#"""
        {
          "shotDuration":{"value":2,"timescale":1},
          "durationRevision":3,
          "duration":2,
          "durationSec":3,
          "changed":true,
          "updatedAt":"2026-08-30T10:00:00.000Z"
        }
        """#.utf8)

        XCTAssertThrowsError(
            try FrameDurationPatchWire.decodeResponse(
                data: data, statusCode: 200)
        ) { error in
            guard case .malformedResponse =
                    error as? FrameDurationPatchError else {
                return XCTFail("Expected typed malformedResponse, got \(error)")
            }
        }
    }

    @MainActor
    func testBoardDurationMutationUpdatesLocalSampleSynchronously() throws {
        let board = BoardState(
            manuscript: StoryboardSampleProject.manuscript,
            sampleScenes: StoryboardSampleProject.scenes)

        board.setActiveFrameDuration(seconds: 3.000_8)

        let frame = try XCTUnwrap(board.frame)
        XCTAssertEqual(
            frame.shotDuration,
            try MediaTime(value: 3, timescale: 1))
        XCTAssertEqual(frame.durationSec, 3)
        XCTAssertNil(board.syncStatus)
    }

    func testExactTimelineConversionRejectsDrift() throws {
        XCTAssertEqual(
            try MediaTime(value: 3, timescale: 2)
                .scaledValueExactly(to: 600),
            900)

        let ntscFrame = try MediaTime(value: 1_001, timescale: 24_000)
        XCTAssertThrowsError(try ntscFrame.scaledValueExactly(to: 600)) {
            XCTAssertEqual(
                $0 as? MediaTimeError,
                .inexactConversion(targetTimescale: 600))
        }
        XCTAssertEqual(
            try ntscFrame.scaledValueExactly(to: 24_000),
            1_001)
    }

    func testProjectTimingRequiresExactFrameDurationTimebase() throws {
        let ntscRate = try MediaTime(value: 24_000, timescale: 1_001)
        XCTAssertThrowsError(try StoryboardTiming(
            projectFrameRate: ntscRate, timelineTimescale: 600)) {
            XCTAssertEqual(
                $0 as? StoryboardTimingError,
                .inexactProjectFrameDuration(600))
        }
        XCTAssertEqual(
            try StoryboardTiming(
                projectFrameRate: ntscRate,
                timelineTimescale: 24_000).timelineTimescale,
            24_000)
    }

    func testManuscriptTimingMissingMigratesButPresentInvalidFailsClosed() throws {
        let summaries = try RoleRoomAPIClient.summarizeManuscripts([
            ["id": "legacy", "title": "Legacy"],
            [
                "id": "exact",
                "title": "Exact",
                "storyboardTiming": [
                    "version": 1,
                    "projectFrameRate": ["value": 24, "timescale": 1],
                    "timelineTimescale": 600,
                ],
            ],
        ])
        XCTAssertEqual(summaries[0].storyboardTiming, .legacyDefault)
        XCTAssertEqual(
            summaries[1].storyboardTiming.projectFrameRate,
            try MediaTime(value: 24, timescale: 1))

        for invalid in [
            [
                "version": 2,
                "projectFrameRate": ["value": 25, "timescale": 1],
                "timelineTimescale": 600,
            ] as [String: Any],
            [
                "projectFrameRate": ["value": 25, "timescale": 1],
                "timelineTimescale": 600,
            ],
        ] {
            XCTAssertThrowsError(try RoleRoomAPIClient.summarizeManuscripts([
                ["id": "valid-first", "title": "Valid"],
                [
                    "id": "invalid",
                    "title": "Invalid",
                    "storyboardTiming": invalid,
                ],
            ]))
        }
    }

    func testProjectTimingPropagatesToEveryFrame() throws {
        let timing = try StoryboardTiming(
            projectFrameRate: MediaTime(value: 24, timescale: 1),
            timelineTimescale: 600)
        let scenes = RoleRoomAPIClient.applyingStoryboardTiming(
            timing, to: StoryboardSampleProject.scenes)
        XCTAssertFalse(scenes.isEmpty)
        XCTAssertTrue(scenes.flatMap(\.frames).allSatisfy {
            $0.storyboardTiming == timing
        })
    }

    func testAnimaticTimelineUsesExactTicksAndExactNShotSum() throws {
        let plan = try AnimaticTimelinePlanner.make(
            durations: [
                MediaTime(value: 3, timescale: 2),
                MediaTime(value: 2, timescale: 3),
                MediaTime(value: 7, timescale: 10),
            ],
            timing: .legacyDefault)
        XCTAssertEqual(plan.entries.map(\.startValue), [0, 900, 1_300])
        XCTAssertEqual(plan.entries.map(\.durationValue), [900, 400, 420])
        XCTAssertEqual(plan.totalValue, 1_720)

        let ntscFrame = try MediaTime(value: 1_001, timescale: 24_000)
        XCTAssertThrowsError(try AnimaticTimelinePlanner.make(
            durations: [ntscFrame], timing: .legacyDefault)) {
            XCTAssertEqual(
                $0 as? AnimaticTimelineError,
                .inexactDuration(frameIndex: 0, timelineTimescale: 600))
        }
        let ntscTiming = try StoryboardTiming(
            projectFrameRate: MediaTime(value: 24_000, timescale: 1_001),
            timelineTimescale: 24_000)
        XCTAssertEqual(
            try AnimaticTimelinePlanner.make(
                durations: [ntscFrame], timing: ntscTiming).totalValue,
            1_001)
    }

    func testAnimaticContentPolicySlatesOnlyIntentionallyEmptyFrames() {
        var drawn = StoryboardSampleProject.scenes[0].frames[0]
        XCTAssertTrue(AnimaticFrameContentPolicy.declaresVisualContent(drawn))
        XCTAssertFalse(AnimaticFrameContentPolicy.acceptsRenderAvailability(
            frames: [drawn], rendered: [false]))

        drawn.strokesJSON = "[]"
        XCTAssertFalse(AnimaticFrameContentPolicy.declaresVisualContent(drawn))
        XCTAssertTrue(AnimaticFrameContentPolicy.acceptsRenderAvailability(
            frames: [drawn], rendered: [false]))

        drawn.strokesJSON = "not-json"
        XCTAssertTrue(AnimaticFrameContentPolicy.declaresVisualContent(drawn))
        XCTAssertFalse(AnimaticFrameContentPolicy.acceptsRenderAvailability(
            frames: [drawn], rendered: [false]))
    }

    func testPersistedVoiceoverDecoderFailsClosed() throws {
        let payload = Data([0, 1, 2, 3, 254, 255])
        let dataURL = "data:audio/m4a;base64," + payload.base64EncodedString()
        XCTAssertEqual(
            try VoiceoverStore.persistedAudioData(from: dataURL),
            payload)

        XCTAssertThrowsError(try VoiceoverStore.persistedAudioData(
            from: "data:image/png;base64,AA=="))
        XCTAssertThrowsError(try VoiceoverStore.persistedAudioData(
            from: "data:audio/m4a;base64,%%%"))
        XCTAssertThrowsError(try VoiceoverStore.persistedAudioData(
            from: "data:audio/m4a;base64,"))
    }

    func testFrameTimingWireRejectsInvalidCanonicalAliasesAndRevision() throws {
        let canonical = try FrameTimingWire.decode([
            "shotDuration": ["value": 3, "timescale": 2],
            "duration": 1.5,
            "durationSec": 1.5,
            "durationRevision": 2,
        ])
        XCTAssertEqual(
            canonical.shotDuration,
            try MediaTime(value: 3, timescale: 2))
        XCTAssertEqual(canonical.durationRevision, 2)

        let legacy = try FrameTimingWire.decode(["duration": 2.5])
        XCTAssertNil(legacy.shotDuration)
        XCTAssertEqual(
            legacy.effectiveDuration,
            try MediaTime(value: 5, timescale: 2))

        let invalidFrames: [[String: Any]] = [
            ["shotDuration": NSNull(), "duration": 2],
            [
                "shotDuration": ["value": 2, "timescale": 1],
                "duration": 3,
            ],
            ["duration": 2, "durationSec": 3],
            ["duration": true],
            [
                "shotDuration": ["value": 2, "timescale": 1],
                "durationRevision": true,
            ],
            [
                "shotDuration": ["value": 2, "timescale": 1],
                "durationRevision": -1,
            ],
        ]
        for frame in invalidFrames {
            XCTAssertThrowsError(try FrameTimingWire.decode(frame))
        }
        XCTAssertNil(MediaTimeCoding.decode([
            "value": true, "timescale": 600,
        ]))
        XCTAssertNil(MediaTimeCoding.decodeLegacySeconds(true))
    }

    func testSceneFallbackIsTransportOnly() {
        XCTAssertTrue(SceneFetchFallbackPolicy.permitsOfflineFallback(
            for: URLError(.notConnectedToInternet)))
        XCTAssertFalse(SceneFetchFallbackPolicy.permitsOfflineFallback(
            for: SyncError.unauthenticated))
        XCTAssertFalse(SceneFetchFallbackPolicy.permitsOfflineFallback(
            for: SyncError.http(500)))
        XCTAssertFalse(SceneFetchFallbackPolicy.permitsOfflineFallback(
            for: SyncError.malformed("storyboardTiming")))
    }

    func testDurationResponseAdoptsServerUnlessLaterTargetExists() throws {
        XCTAssertTrue(FrameDurationResponseAdoptionPolicy
            .shouldApplyAuthoritativeResponse(newerPendingTarget: nil))
        XCTAssertFalse(FrameDurationResponseAdoptionPolicy
            .shouldApplyAuthoritativeResponse(
                newerPendingTarget: try MediaTime(value: 4, timescale: 1)))
    }

    @MainActor
    func testDurationChangeInvalidatesVideoImmediately() throws {
        let fingerprint = String(repeating: "a", count: 64)
        var paintover = StoryboardPaintoverState()
        paintover.colorFingerprint = fingerprint
        paintover.atmosphereFingerprint = fingerprint
        var scene = StoryboardSampleProject.scenes[0]
        var frame = scene.frames[0]
        let framing = (frame.shotFraming ?? ShotFramingState(
            shotSize: frame.shotType,
            angle: frame.angle,
            lensMm: frame.lensMm,
            aspectRatio: frame.drawingWidth / frame.drawingHeight)).normalized()
        frame.aiPaintoverState = paintover
        frame.aiVideoURL = "https://example.com/video.mp4"
        frame.aiVideoStatus = "completed"
        frame.aiVideoSourceFramingFingerprint = framing.canonicalFingerprint
        frame.aiSourceRevision = 3
        frame.aiVideoSourceRevision = 3
        frame.sourceUpdatedAt = "source-v3"
        frame.aiVideoSourceUpdatedAt = "source-v3"
        frame.aiVideoSourceBaseVersionId = UUID().uuidString
        frame.aiVideoSourceStage = "color"
        frame.aiVideoSourceFrameUpdatedAt = "frame-v3"
        frame.aiVideoSourceColorRevision = 0
        frame.aiVideoSourceAtmosphereRevision = 0
        frame.aiVideoSourceColorFingerprint = fingerprint
        frame.aiVideoSourceAtmosphereFingerprint = fingerprint
        frame.aiVideoSourceColorHasContent = false
        frame.aiVideoSourceAtmosphereHasContent = false
        frame.aiVideoSourceCompositeFingerprint = fingerprint
        XCTAssertTrue(StoryboardVideoPlaybackPolicy.sourceIdentityMatches(frame))

        scene.frames[0] = frame
        let board = BoardState(
            manuscript: StoryboardSampleProject.manuscript,
            sampleScenes: [scene])
        board.setActiveFrameDuration(seconds: 4)

        let changed = try XCTUnwrap(board.frame)
        XCTAssertEqual(changed.aiPaintoverState?.videoStale, true)
        XCTAssertFalse(StoryboardVideoPlaybackPolicy.sourceIdentityMatches(changed))
        XCTAssertNil(StoryboardVideoPlaybackPolicy.currentURL(changed))
        XCTAssertEqual(
            FrameDurationVideoInvalidationPolicy.afterDurationChange(
                paintover, changed: false),
            paintover)
    }

    func testFrameSamplePlanUsesExactHalfOpenProjectGrid() throws {
        let plan = try StoryboardFrameSamplePlan.make(
            shotDuration: MediaTime(value: 3, timescale: 2),
            timing: .legacyDefault,
            shotStart: MediaTime(value: 2, timescale: 1)
        )

        XCTAssertEqual(plan.timelineTimescale, 600)
        XCTAssertEqual(plan.projectFrameRate, try MediaTime(
            value: 25,
            timescale: 1
        ))
        XCTAssertEqual(plan.frameDurationValue, 24)
        XCTAssertEqual(plan.samples.count, 38)
        XCTAssertEqual(plan.samples.first, StoryboardFrameSample(
            index: 0,
            localTime: .zero,
            presentationTime: try MediaTime(value: 2, timescale: 1)
        ))
        XCTAssertEqual(plan.samples.last, StoryboardFrameSample(
            index: 37,
            localTime: try MediaTime(value: 37, timescale: 25),
            presentationTime: try MediaTime(value: 87, timescale: 25)
        ))
        XCTAssertEqual(
            plan.shotEnd,
            try MediaTime(value: 7, timescale: 2)
        )
        XCTAssertTrue(plan.samples.allSatisfy {
            $0.localTime < plan.shotDuration
        })
        XCTAssertEqual(
            Set(plan.samples.map(\.presentationTime)).count,
            plan.samples.count
        )

        XCTAssertEqual(
            plan.sample(
                atOrBeforeLocalTime: try MediaTime(
                    value: 149,
                    timescale: 100
                )
            )?.localTime,
            try MediaTime(value: 37, timescale: 25)
        )
        // Explicit shot end belongs to the scrubber/evaluator. Playback/export
        // quantizes it to the last sample in the half-open shot interval.
        XCTAssertEqual(
            plan.sample(atOrBeforeLocalTime: plan.shotDuration),
            plan.samples.last
        )
    }

    func testFrameSamplePlanSupportsExactNTSCGridWithoutDrift() throws {
        let timing = try StoryboardTiming(
            projectFrameRate: MediaTime(
                value: 24_000,
                timescale: 1_001
            ),
            timelineTimescale: 24_000
        )
        let frameDuration = try MediaTime(
            value: 1_001,
            timescale: 24_000
        )
        let duration = try MediaTime(value: 1_001, timescale: 1_000)
        let plan = try StoryboardFrameSamplePlan.make(
            shotDuration: duration,
            timing: timing,
            shotStart: frameDuration
        )

        XCTAssertEqual(plan.frameDurationValue, 1_001)
        XCTAssertEqual(plan.samples.count, 24)
        XCTAssertEqual(plan.samples[1].localTime, frameDuration)
        XCTAssertEqual(
            plan.samples.last?.localTime,
            try MediaTime(value: 23_023, timescale: 24_000)
        )
        XCTAssertEqual(
            plan.samples.last?.presentationTime,
            duration
        )
        XCTAssertEqual(
            plan.shotEnd,
            try MediaTime(value: 25_025, timescale: 24_000)
        )
    }

    func testFrameSamplePlanRejectsInexactTimelineValues() throws {
        XCTAssertThrowsError(try StoryboardFrameSamplePlan.make(
            shotDuration: MediaTime(value: 1, timescale: 1_001),
            timing: .legacyDefault
        )) {
            XCTAssertEqual(
                $0 as? StoryboardFrameSamplePlanError,
                .inexactShotDuration(timelineTimescale: 600)
            )
        }
    }
}
