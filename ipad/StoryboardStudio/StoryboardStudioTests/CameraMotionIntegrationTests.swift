import Foundation
import XCTest
@testable import StoryboardStudio

@MainActor
final class CameraMotionIntegrationTests: XCTestCase {
    private let duration = try! MediaTime(value: 2, timescale: 1)

    func testTrackCodingClassifiesValidInvalidFutureAndOversizedPayloads()
        throws
    {
        let track = makeTrack()
        let object = try CameraMotionTrackCoding.object(
            track,
            shotDuration: duration
        )

        let valid = CameraMotionTrackCoding.decode(
            object,
            isPresent: true,
            shotDuration: duration
        )
        XCTAssertEqual(valid.state, .valid)
        XCTAssertEqual(
            valid.track,
            try track.normalized(for: duration)
        )
        XCTAssertNotNil(valid.rawJSON)

        var invalid = object
        invalid["keyframes"] = [
            keyframeObject(id: "duplicate", timeValue: 1),
            keyframeObject(id: "duplicate", timeValue: 2),
        ]
        let malformed = CameraMotionTrackCoding.decode(
            invalid,
            isPresent: true,
            shotDuration: duration
        )
        XCTAssertEqual(malformed.state, .invalid)
        XCTAssertNil(malformed.track)
        XCTAssertNotNil(malformed.rawJSON)

        var future = object
        future["version"] = CameraMotionTrack.schemaVersion + 1
        let upgrade = CameraMotionTrackCoding.decode(
            future,
            isPresent: true,
            shotDuration: duration
        )
        XCTAssertEqual(upgrade.state, .upgradeRequired)
        XCTAssertNil(upgrade.track)
        XCTAssertNotNil(upgrade.rawJSON)

        var oversized = object
        oversized["ignoredPadding"] = String(
            repeating: "x",
            count: CameraMotionTrackCoding.maximumPayloadBytes
        )
        let bounded = CameraMotionTrackCoding.decode(
            oversized,
            isPresent: true,
            shotDuration: duration
        )
        XCTAssertEqual(bounded.state, .invalid)
        XCTAssertNil(bounded.track)
        XCTAssertNil(
            bounded.rawJSON,
            "Rejected oversized input must not be retained as recoverable JSON"
        )
    }

    func testCameraMotionPatchWireRequestSuccessAndRevisionConflict() throws {
        let track = makeTrack()
        let request = try FrameCameraMotionPatchRequest(
            manuscriptId: "manuscript-a",
            sceneId: "scene-a",
            frameId: "frame-a",
            cameraMotionTrack: track,
            expectedMotionRevision: 7,
            shotDuration: duration
        )
        let body = try FrameCameraMotionPatchWire.requestBody(request)

        XCTAssertEqual(body["manuscriptId"] as? String, "manuscript-a")
        XCTAssertEqual(body["sceneId"] as? String, "scene-a")
        XCTAssertEqual(body["frameId"] as? String, "frame-a")
        XCTAssertEqual(body["expectedMotionRevision"] as? Int, 7)
        XCTAssertNil(body["shotDuration"])
        let requestTrack = CameraMotionTrackCoding.decode(
            body["cameraMotionTrack"],
            isPresent: body.keys.contains("cameraMotionTrack"),
            shotDuration: duration
        )
        XCTAssertEqual(requestTrack.state, .valid)
        XCTAssertEqual(
            requestTrack.track,
            try track.normalized(for: duration)
        )

        let wireTrack = try CameraMotionTrackCoding.object(
            track,
            shotDuration: duration
        )
        let successData = try JSONSerialization.data(withJSONObject: [
            "cameraMotionTrack": wireTrack,
            "cameraMotionRevision": 8,
            "cameraMotionUpdatedAt": "2026-08-30T10:00:00.000Z",
            "cameraMotionFingerprint": "sha256:motion",
            "cameraMotionBaseFramingFingerprint": "sha256:base",
            "cameraMotionStatus": "valid",
            "changed": true,
            "updatedAt": "2026-08-30T10:00:01.000Z",
            "sourceUpdatedAt": "2026-08-30T09:59:00.000Z",
        ] as [String: Any])
        let response = try FrameCameraMotionPatchWire.decodeResponse(
            data: successData,
            statusCode: 200,
            shotDuration: duration
        )

        XCTAssertEqual(
            response.cameraMotionTrack,
            try track.normalized(for: duration)
        )
        XCTAssertEqual(response.cameraMotionRevision, 8)
        XCTAssertEqual(response.cameraMotionStatus, "valid")
        XCTAssertTrue(response.changed)
        XCTAssertEqual(response.cameraMotionFingerprint, "sha256:motion")
        XCTAssertEqual(
            response.cameraMotionBaseFramingFingerprint,
            "sha256:base"
        )

        let conflictData = try JSONSerialization.data(withJSONObject: [
            "error": "camera_motion_revision_conflict",
            "currentCameraMotionTrack": wireTrack,
            "currentCameraMotionRevision": 9,
            "currentCameraMotionStatus": "valid",
            "currentCameraMotionFingerprint": "sha256:server-motion",
            "currentCameraMotionBaseFramingFingerprint": "sha256:server-base",
        ] as [String: Any])
        XCTAssertThrowsError(try FrameCameraMotionPatchWire.decodeResponse(
            data: conflictData,
            statusCode: 409,
            shotDuration: duration
        )) { error in
            guard case .revisionConflict(let state) =
                    error as? FrameCameraMotionPatchError else {
                return XCTFail("Expected typed revision conflict, got \(error)")
            }
            XCTAssertEqual(state?.cameraMotionRevision, 9)
            XCTAssertEqual(state?.cameraMotionStatus, "valid")
            XCTAssertEqual(
                state?.cameraMotionTrack,
                try? track.normalized(for: duration)
            )
            XCTAssertEqual(
                state?.cameraMotionFingerprint,
                "sha256:server-motion"
            )
        }
    }

    func testProjectionInheritsPersistedValidCameraMotion() throws {
        let track = makeTrack()
        var frame = makeFrame()
        frame.cameraMotionTrack = track
        frame.cameraMotionRevision = 4
        frame.cameraMotionStatus = "valid"
        frame.cameraMotionReadState = .valid

        let document = try FrameDocumentProjection.make(frame: frame)

        XCTAssertEqual(
            document.cameraMotionTrack,
            try track.normalized(for: duration)
        )
        let staticDocument = try FrameDocumentProjection.make(
            frame: makeFrame()
        )
        XCTAssertNotEqual(
            document.documentIdentity,
            staticDocument.documentIdentity,
            "Persisted renderable motion must participate in document identity"
        )
    }

    func testNonzeroCoordinatorSessionUsesEvaluatedMotionIdentity() throws {
        let track = makeTrack()
        var frame = makeFrame()
        frame.cameraMotionTrack = track
        frame.cameraMotionRevision = 4
        frame.cameraMotionStatus = "valid"
        frame.cameraMotionReadState = .valid
        let time = try MediaTime(value: 1, timescale: 1)

        let snapshot = try FrameRenderCoordinator.snapshot(
            for: frame,
            at: time
        )
        let session = try FrameRenderCoordinator.evaluatedSession(
            for: frame,
            at: time
        )

        XCTAssertEqual(snapshot.time, time)
        XCTAssertEqual(session.framing, snapshot.presentationFraming)
        XCTAssertEqual(session.framing.centerX, 0.6, accuracy: 0.000_001)
        XCTAssertEqual(
            session.framing.zoom,
            sqrt(2),
            accuracy: 0.000_001
        )
    }

    func testWholeTrackCoverageBlocksInvalidAndUnsupportedViewportMotion()
        throws
    {
        var invalid = makeFrame()
        invalid.cameraMotionReadState = .invalid
        invalid.cameraMotionStatus = "invalid"
        invalid.cameraMotionRawJSON = #"{"version":1,"bad":true}"#

        let invalidReport = FrameRenderCoordinator.motionCoverageReport(
            frame: invalid
        )
        XCTAssertEqual(invalidReport.classification, .blocking)
        XCTAssertEqual(invalidReport.blockingCodes, [.invalidMotionTrack])
        XCTAssertFalse(FrameRenderCoordinator.canPlayCameraMotion(
            frame: invalid
        ))

        let initial = ShotFramingState(
            centerX: 0.5,
            centerY: 0.5,
            zoom: 2,
            aspectRatio: 16.0 / 9.0
        )
        let endpoint = CameraPose2D(
            centerX: 0.7,
            centerY: 0.5,
            zoom: 2
        )
        let viewportTrack = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "pan-right",
                time: duration,
                pose: endpoint
            ),
        ])
        var viewport = makeFrame(imageUrl: "/generated/viewport.png")
        viewport.imageSource = "ai-color-approved"
        viewport.shotFraming = initial
        viewport.aiRasterPlacementFraming = initial
        viewport.aiSourceFramingFingerprint = initial.canonicalFingerprint
        viewport.cameraMotionTrack = viewportTrack
        viewport.cameraMotionRevision = 1
        viewport.cameraMotionStatus = "valid"
        viewport.cameraMotionReadState = .valid

        let viewportReport = FrameRenderCoordinator.motionCoverageReport(
            frame: viewport
        )
        XCTAssertEqual(viewportReport.classification, .blocking)
        XCTAssertTrue(
            viewportReport.blockingCodes.contains(.motionPlateRequired)
        )
        XCTAssertGreaterThan(viewportReport.evaluatedSampleCount, 2)
        XCTAssertTrue(viewportReport.evaluatedTimes.contains(duration))
        XCTAssertFalse(FrameRenderCoordinator.canPlayCameraMotion(
            frame: viewport
        ))
    }
    func testPendingCameraMotionStoreRoundTripsExplicitDeletionAndCompareAndClear()
        throws
    {
        let frameID = "pending-camera-motion-\(UUID().uuidString)"
        let baseTrack = makeTrack()
        let baseFraming = ShotFramingState(
            centerX: 0.5,
            centerY: 0.5,
            zoom: 1,
            aspectRatio: 16.0 / 9.0
        )
        let requestedFraming = ShotFramingState(
            centerX: 0.55,
            centerY: 0.45,
            zoom: 1.25,
            aspectRatio: 16.0 / 9.0
        )
        let mutation = PendingCameraMotionMutation(
            manuscriptId: "manuscript-store-test",
            sceneId: "scene-store-test",
            frameId: frameID,
            shotDuration: duration,
            initialFraming: requestedFraming,
            motionTrack: nil,
            expectedMotionRevision: 12,
            baseMotionTrack: baseTrack,
            baseMotionFingerprint: "sha256:base-motion",
            baseMotionStatus: "valid",
            localRevision: 37,
            strokesJSON: "[]",
            thumbnailDataURL: "data:image/png;base64,AA==",
            layerState: .standard,
            baseUpdatedAt: "2026-08-30T12:00:00.000Z",
            baseStrokesJSON: "[]",
            baseLayerState: .standard,
            baseShotFraming: baseFraming,
            savedAt: Date(timeIntervalSinceReferenceDate: 123_456)
        )
        defer {
            if let stored = PendingCameraMotionStore.load(frameId: frameID) {
                _ = PendingCameraMotionStore.clear(ifUnchangedFrom: stored)
            }
        }

        XCTAssertTrue(PendingCameraMotionStore.save(mutation))
        let roundTripped = try XCTUnwrap(
            PendingCameraMotionStore.load(frameId: frameID)
        )
        XCTAssertEqual(roundTripped, mutation)
        XCTAssertEqual(roundTripped.version, 7)
        XCTAssertNil(
            roundTripped.motionTrack,
            "A present WAL with nil motion is the explicit Static/delete intent"
        )
        XCTAssertEqual(roundTripped.baseMotionTrack, baseTrack)
        XCTAssertTrue(roundTripped.changesInitialFraming)

        var replacement = mutation
        replacement.localRevision += 1
        replacement.savedAt = mutation.savedAt.addingTimeInterval(1)
        XCTAssertTrue(PendingCameraMotionStore.save(replacement))
        XCTAssertFalse(
            PendingCameraMotionStore.clear(ifUnchangedFrom: mutation),
            "A stale completion must not clear a newer WAL for the same frame"
        )
        XCTAssertEqual(
            PendingCameraMotionStore.load(frameId: frameID),
            replacement
        )
        XCTAssertTrue(PendingCameraMotionStore.clear(
            ifUnchangedFrom: replacement
        ))
        XCTAssertNil(PendingCameraMotionStore.load(frameId: frameID))
    }

    func testQueuedUndoRebasesOntoAcknowledgedSameClientMutation() throws {
        let baseFraming = ShotFramingState(aspectRatio: 16.0 / 9.0)
        let movedFraming = ShotFramingState(
            centerX: 0.56, centerY: 0.46, zoom: 1.3,
            aspectRatio: 16.0 / 9.0, mode: .manual)
        let baseTrack = makeTrack()
        var committedTrack = baseTrack
        committedTrack.presetId = "performed-a"
        let acknowledged = makePendingMutation(
            frameID: "same-client-rebase",
            initialFraming: movedFraming,
            motionTrack: committedTrack,
            baseFraming: baseFraming,
            baseTrack: baseTrack,
            localRevision: 10,
            savedAt: Date(timeIntervalSinceReferenceDate: 100))
        let queuedUndo = makePendingMutation(
            frameID: acknowledged.frameId,
            initialFraming: baseFraming,
            motionTrack: baseTrack,
            baseFraming: baseFraming,
            baseTrack: baseTrack,
            localRevision: 11,
            savedAt: Date(timeIntervalSinceReferenceDate: 101))
        let authoritative = PendingCameraMotionAuthoritativeBase(
            motionTrack: committedTrack,
            motionRevision: 13,
            motionFingerprint: "sha256:acknowledged-motion",
            motionStatus: "valid",
            frameUpdatedAt: "frame-v2",
            sourceUpdatedAt: "source-v2",
            shotFraming: movedFraming,
            sourceSnapshot: .init(
                strokesJSON: "[]",
                layerState: .standard,
                shotFraming: movedFraming,
                sourceUpdatedAt: "source-v2"))

        guard case .rebased(let rebased) =
            PendingCameraMotionStore.rebaseDecision(
                acknowledged: acknowledged,
                queued: queuedUndo,
                onto: authoritative)
        else {
            return XCTFail("The same-client undo must be rebased")
        }
        XCTAssertEqual(rebased.motionTrack, queuedUndo.motionTrack)
        XCTAssertEqual(rebased.initialFraming, queuedUndo.initialFraming)
        XCTAssertEqual(rebased.expectedMotionRevision, 13)
        XCTAssertEqual(rebased.baseMotionTrack, committedTrack)
        XCTAssertEqual(
            rebased.baseMotionFingerprint,
            "sha256:acknowledged-motion")
        XCTAssertEqual(rebased.baseUpdatedAt, "frame-v2")
        XCTAssertEqual(rebased.baseSourceUpdatedAt, "source-v2")
        XCTAssertEqual(rebased.baseShotFraming, movedFraming)
        XCTAssertEqual(rebased.localRevision, queuedUndo.localRevision)
        XCTAssertEqual(rebased.savedAt, queuedUndo.savedAt)
    }

    func testQueuedMutationWithMismatchedBaseFailsClosed() {
        let framing = ShotFramingState.standard
        let baseTrack = makeTrack()
        let acknowledged = makePendingMutation(
            frameID: "remote-base-conflict",
            initialFraming: framing,
            motionTrack: nil,
            baseFraming: framing,
            baseTrack: baseTrack,
            localRevision: 4,
            savedAt: Date(timeIntervalSinceReferenceDate: 200))
        var unknown = acknowledged
        unknown.savedAt = acknowledged.savedAt.addingTimeInterval(1)
        unknown.localRevision += 1
        unknown.baseMotionFingerprint = "sha256:remote-base"
        let authoritative = PendingCameraMotionAuthoritativeBase(
            motionTrack: nil,
            motionRevision: 8,
            motionFingerprint: nil,
            motionStatus: "valid",
            frameUpdatedAt: "frame-v2",
            sourceUpdatedAt: "source-v1",
            shotFraming: framing,
            sourceSnapshot: nil)

        XCTAssertEqual(
            PendingCameraMotionStore.rebaseDecision(
                acknowledged: acknowledged,
                queued: unknown,
                onto: authoritative),
            .conflict)

        var sameClientShape = acknowledged
        sameClientShape.localRevision += 1
        sameClientShape.savedAt =
            acknowledged.savedAt.addingTimeInterval(1)
        var remoteSourceChanged = authoritative
        remoteSourceChanged.sourceUpdatedAt = "source-v2"
        XCTAssertEqual(PendingCameraMotionStore.rebaseDecision(
            acknowledged: acknowledged,
            queued: sameClientShape,
            onto: remoteSourceChanged), .conflict,
            "A remote source token change is never a same-client rebase")
    }

    func testLegacyNilSourceTokenIsNotAutomaticRebaseProof() {
        let framing = ShotFramingState.standard
        let acknowledged = makePendingMutation(
            frameID: "legacy-source-token",
            initialFraming: framing,
            motionTrack: makeTrack(),
            baseFraming: framing,
            baseTrack: nil,
            baseSourceUpdatedAt: nil,
            localRevision: 1,
            savedAt: Date(timeIntervalSinceReferenceDate: 300))
        var queued = acknowledged
        queued.motionTrack = nil
        queued.localRevision += 1
        queued.savedAt = acknowledged.savedAt.addingTimeInterval(1)
        let authoritative = PendingCameraMotionAuthoritativeBase(
            motionTrack: acknowledged.motionTrack,
            motionRevision: 1,
            motionFingerprint: "sha256:motion-v1",
            motionStatus: "valid",
            frameUpdatedAt: "frame-v2",
            sourceUpdatedAt: nil,
            shotFraming: framing,
            sourceSnapshot: nil)

        XCTAssertEqual(
            PendingCameraMotionStore.rebaseDecision(
                acknowledged: acknowledged,
                queued: queued,
                onto: authoritative),
            .conflict)
    }

    func testRebasedWALSurvivesAsExactAppRetryRecord() throws {
        let frameID = "rebased-app-retry-\(UUID().uuidString)"
        let baseFraming = ShotFramingState.standard
        let movedFraming = ShotFramingState(
            centerX: 0.6, zoom: 1.25, mode: .manual)
        let acknowledged = makePendingMutation(
            frameID: frameID,
            initialFraming: movedFraming,
            motionTrack: makeTrack(),
            baseFraming: baseFraming,
            baseTrack: nil,
            localRevision: 20,
            savedAt: Date(timeIntervalSinceReferenceDate: 400))
        var queued = acknowledged
        queued.initialFraming = baseFraming
        queued.motionTrack = nil
        queued.localRevision += 1
        queued.savedAt = acknowledged.savedAt.addingTimeInterval(1)
        let authoritative = PendingCameraMotionAuthoritativeBase(
            motionTrack: acknowledged.motionTrack,
            motionRevision: 1,
            motionFingerprint: "sha256:motion-v1",
            motionStatus: "valid",
            frameUpdatedAt: "frame-v2",
            sourceUpdatedAt: "source-v2",
            shotFraming: movedFraming,
            sourceSnapshot: .init(
                strokesJSON: "[]", layerState: .standard,
                shotFraming: movedFraming,
                sourceUpdatedAt: "source-v2"))
        defer {
            if let stored = PendingCameraMotionStore.load(frameId: frameID) {
                _ = PendingCameraMotionStore.clear(ifUnchangedFrom: stored)
            }
        }
        XCTAssertTrue(PendingCameraMotionStore.save(queued))
        guard case .rebased(let rebased) =
            PendingCameraMotionStore.rebaseDecision(
                acknowledged: acknowledged, queued: queued,
                onto: authoritative)
        else { return XCTFail("Expected a same-client rebase") }

        XCTAssertTrue(PendingCameraMotionStore.compareAndReplace(
            queued, with: rebased))
        let relaunched = try XCTUnwrap(
            PendingCameraMotionStore.load(frameId: frameID))
        XCTAssertEqual(relaunched, rebased)
        XCTAssertNil(relaunched.motionTrack)
        XCTAssertEqual(relaunched.expectedMotionRevision, 1)
        XCTAssertEqual(relaunched.baseMotionTrack, acknowledged.motionTrack)
        XCTAssertEqual(relaunched.baseSourceUpdatedAt, "source-v2")
    }

    func testCameraMotionCompareAndReplaceNeverOverwritesThirdWAL() throws {
        let frameID = "camera-cas-third-\(UUID().uuidString)"
        let framing = ShotFramingState.standard
        let expected = makePendingMutation(
            frameID: frameID,
            initialFraming: framing,
            motionTrack: makeTrack(),
            baseFraming: framing,
            baseTrack: nil,
            localRevision: 1,
            savedAt: Date(timeIntervalSinceReferenceDate: 500))
        var replacement = expected
        replacement.expectedMotionRevision = 1
        replacement.baseMotionTrack = expected.motionTrack
        replacement.localRevision = 2
        replacement.savedAt = expected.savedAt.addingTimeInterval(1)
        var third = expected
        third.motionTrack = nil
        third.localRevision = 3
        third.savedAt = expected.savedAt.addingTimeInterval(2)
        defer {
            if let stored = PendingCameraMotionStore.load(frameId: frameID) {
                _ = PendingCameraMotionStore.clear(ifUnchangedFrom: stored)
            }
        }

        XCTAssertTrue(PendingCameraMotionStore.save(expected))
        XCTAssertTrue(PendingCameraMotionStore.save(third))
        XCTAssertFalse(PendingCameraMotionStore.compareAndReplace(
            expected, with: replacement))
        XCTAssertEqual(
            PendingCameraMotionStore.load(frameId: frameID),
            third)
    }

    func testFramingHistoryRebindsKnownV1ButPreservesOpaqueDrafts() {
        let track = makeTrack()
        XCTAssertTrue(CameraMotionHistorySyncPolicy.requiresMotionRebind(
            framingChanged: true,
            currentTrack: track,
            authoritativeTrack: track,
            readState: .valid),
            "A known v1 track may be rebound through needsRebase")
        XCTAssertFalse(CameraMotionHistorySyncPolicy.requiresMotionRebind(
            framingChanged: true,
            currentTrack: track,
            authoritativeTrack: track,
            readState: .upgradeRequired),
            "A future envelope remains opaque even if a stray track exists")
        XCTAssertFalse(CameraMotionHistorySyncPolicy.requiresMotionRebind(
            framingChanged: true,
            currentTrack: track,
            authoritativeTrack: track,
            readState: .invalid),
            "Invalid raw motion must remain recoverable")
        XCTAssertFalse(CameraMotionHistorySyncPolicy.requiresMotionRebind(
            framingChanged: true,
            currentTrack: nil,
            authoritativeTrack: nil,
            readState: .upgradeRequired),
            "Future raw nil must never be rewritten as Static")
        XCTAssertFalse(CameraMotionHistorySyncPolicy.requiresMotionRebind(
            framingChanged: true,
            currentTrack: nil,
            authoritativeTrack: nil,
            readState: .none),
            "A genuinely static shot needs no motion mutation")
    }

    private func makePendingMutation(
        frameID: String,
        initialFraming: ShotFramingState,
        motionTrack: CameraMotionTrack?,
        baseFraming: ShotFramingState,
        baseTrack: CameraMotionTrack?,
        baseSourceUpdatedAt: String? = "source-v1",
        localRevision: Int,
        savedAt: Date
    ) -> PendingCameraMotionMutation {
        PendingCameraMotionMutation(
            manuscriptId: "manuscript-rebase",
            sceneId: "scene-rebase",
            frameId: frameID,
            shotDuration: duration,
            initialFraming: initialFraming,
            motionTrack: motionTrack,
            expectedMotionRevision: 7,
            baseMotionTrack: baseTrack,
            baseMotionFingerprint: "sha256:base-motion",
            baseMotionStatus: "valid",
            localRevision: localRevision,
            strokesJSON: "[]",
            thumbnailDataURL: nil,
            layerState: .standard,
            baseUpdatedAt: "frame-v1",
            baseSourceUpdatedAt: baseSourceUpdatedAt,
            baseStrokesJSON: "[]",
            baseLayerState: .standard,
            baseShotFraming: baseFraming,
            savedAt: savedAt)
    }

    private func makeTrack() -> CameraMotionTrack {
        CameraMotionTrack(
            presetId: "pan-right",
            keyframes: [CameraMotionKeyframe(
                id: "end",
                time: duration,
                pose: CameraPose2D(centerX: 0.7, zoom: 2),
                easingFromPrevious: CameraMotionEasing(kind: .linear)
            )]
        )
    }

    private func keyframeObject(
        id: String,
        timeValue: Int64
    ) -> [String: Any] {
        [
            "id": id,
            "time": ["value": timeValue, "timescale": 1],
            "pose": [
                "centerX": 0.5,
                "centerY": 0.5,
                "zoom": 1,
                "rollDegrees": 0,
            ],
            "easingFromPrevious": ["kind": "linear"],
        ]
    }

    private func makeFrame(
        imageUrl: String? = nil
    ) -> FrameSummary {
        var frame = FrameSummary(
            id: "camera-motion-frame",
            shotNumber: "1A",
            detail: "",
            strokesJSON: nil,
            description: "",
            notes: nil,
            shotType: nil,
            lensMm: nil,
            movement: nil,
            durationSec: 2,
            transition: nil,
            focusDepth: nil,
            timeOfDay: nil,
            weather: nil,
            beatTag: nil,
            tags: [],
            thumbnailDataURL: nil,
            drawingWidth: 1_920,
            drawingHeight: 1_080,
            frameStatus: nil,
            comments: [],
            updatedAt: nil,
            underlayDataURL: nil,
            underlayOpacity: nil,
            perspectiveMode: nil,
            vanishingPoints: nil,
            voiceoverDataURL: nil,
            imageUrl: imageUrl,
            reviewPriority: nil,
            reviewDueAt: nil,
            reviewApprovedBy: nil,
            reviewApprovedAt: nil,
            reviewStarred: nil,
            reviewAssignee: nil,
            reviewColorLabel: nil,
            reviewSnoozedUntil: nil,
            shotFraming: ShotFramingState(
                centerX: 0.5,
                centerY: 0.5,
                zoom: 1,
                aspectRatio: 16.0 / 9.0
            )
        )
        frame.shotDuration = duration
        frame.storyboardTiming = .legacyDefault
        return frame
    }
}
