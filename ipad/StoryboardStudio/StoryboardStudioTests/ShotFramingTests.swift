import XCTest
@testable import StoryboardStudio

final class ShotFramingTests: XCTestCase {
    private let fullHD = ShotFramingSize(width: 1_920, height: 1_080)

    func testLegacyAndEmptyJSONDecodeToSafeCanonicalState() throws {
        let empty = try JSONDecoder().decode(
            ShotFramingState.self,
            from: Data("{}".utf8)
        )
        XCTAssertEqual(empty, .standard)

        let legacyJSON = #"""
        {
            "shotType":"CU",
            "angle":"Low",
            "lensMm":85.0,
            "scale":2.5,
            "rotationDegrees":450,
            "focusAnchorX":0.8,
            "mode":"future-mode",
            "revision":-2
        }
        """#
        let legacy = try JSONDecoder().decode(
            ShotFramingState.self,
            from: Data(legacyJSON.utf8)
        )
        XCTAssertEqual(legacy.version, ShotFramingState.schemaVersion)
        XCTAssertEqual(legacy.shotSize, "CU")
        XCTAssertEqual(legacy.angle, "Low")
        XCTAssertEqual(legacy.lensMm, 85)
        XCTAssertEqual(legacy.centerX, 0.5)
        XCTAssertEqual(legacy.centerY, 0.5)
        XCTAssertEqual(legacy.zoom, 2.5)
        XCTAssertEqual(legacy.rollDegrees, 90)
        XCTAssertNil(legacy.focusAnchor, "a partial focus pair must never leak into geometry")
        XCTAssertEqual(legacy.mode, .automatic)
        XCTAssertEqual(legacy.revision, 0)
    }

    func testCanonicalJSONRoundtripCarriesIntentAndNoLegacyAliases() throws {
        let state = ShotFramingState(
            shotSize: " MCU ",
            angle: " Eye level ",
            lensMm: 50,
            centerX: 0.42,
            centerY: 0.61,
            zoom: 2.2,
            rollDegrees: -7,
            aspectRatio: 2.39,
            focusAnchorX: 0.4,
            focusAnchorY: 0.3,
            mode: .manual,
            intentFingerprint: " shot-intent-v3 ",
            revision: 8
        )
        let object = try XCTUnwrap(ShotFramingStateCoding.object(state) as? [String: Any])
        XCTAssertEqual(object["shotSize"] as? String, "MCU")
        XCTAssertEqual(object["angle"] as? String, "Eye level")
        XCTAssertEqual(object["lensMm"] as? Int, 50)
        XCTAssertNil(object["scale"])
        XCTAssertNil(object["rotationDegrees"])
        XCTAssertNil(object["shotType"])
        XCTAssertEqual(ShotFramingStateCoding.decode(object), state)
        XCTAssertNil(ShotFramingStateCoding.decode(["not", "an", "object"]))
    }

    func testStateNormalizationRejectsNonFiniteAndOutOfRangeValues() {
        let state = ShotFramingState(
            shotSize: "  ",
            angle: "\n",
            lensMm: 0,
            centerX: -.infinity,
            centerY: 4,
            zoom: .nan,
            rollDegrees: 725,
            aspectRatio: -.infinity,
            focusAnchorX: 1.4,
            focusAnchorY: -0.2,
            revision: -4
        )
        XCTAssertNil(state.shotSize)
        XCTAssertNil(state.angle)
        XCTAssertNil(state.lensMm)
        XCTAssertEqual(state.centerX, 0.5)
        XCTAssertEqual(state.centerY, 1)
        XCTAssertEqual(state.zoom, 1)
        XCTAssertEqual(state.rollDegrees, 5)
        XCTAssertEqual(state.aspectRatio, 16.0 / 9.0)
        XCTAssertEqual(state.focusAnchor, ShotFramingPoint(x: 1, y: 0))
        XCTAssertEqual(state.revision, 0)
    }

    func testCoordinateMappingIsExactlyInvertibleWithPanZoomAndRoll() throws {
        let state = ShotFramingState(
            centerX: 0.42,
            centerY: 0.58,
            zoom: 2.3,
            rollDegrees: 17,
            aspectRatio: 2
        )
        let geometry = try XCTUnwrap(ShotFramingGeometry(
            sourceSize: ShotFramingSize(width: 2_000, height: 1_000),
            viewportSize: ShotFramingSize(width: 1_200, height: 600),
            state: state
        ))
        let source = ShotFramingPoint(x: 1_237.5, y: 317.25)
        let viewport = geometry.viewportPoint(fromSourcePoint: source)
        let roundtrip = geometry.sourcePoint(fromViewportPoint: viewport)
        XCTAssertEqual(roundtrip.x, source.x, accuracy: 0.000_000_1)
        XCTAssertEqual(roundtrip.y, source.y, accuracy: 0.000_000_1)

        let normalized = ShotFramingPoint(x: 0.71, y: 0.28)
        let viewportNormalized = geometry.viewportNormalizedPoint(
            fromSourceNormalizedPoint: normalized
        )
        let normalizedRoundtrip = geometry.sourceNormalizedPoint(
            fromViewportNormalizedPoint: viewportNormalized
        )
        XCTAssertEqual(normalizedRoundtrip.x, normalized.x, accuracy: 0.000_000_1)
        XCTAssertEqual(normalizedRoundtrip.y, normalized.y, accuracy: 0.000_000_1)
    }

    func testCombinedPanPinchAndRollUseOneDeterministicBaselineState() throws {
        let baseline = ShotFramingState(
            shotSize: "MS",
            angle: "Eye level",
            lensMm: 50,
            centerX: 0.5,
            centerY: 0.5,
            zoom: 2,
            rollDegrees: 0,
            mode: .automatic,
            intentFingerprint: "baseline-intent",
            revision: 7
        )
        let source = fullHD
        let viewport = ShotFramingSize(width: 1_200, height: 675)
        let pan = ShotFramingSize(width: 120, height: -54)

        let combined = ShotFramingInteraction.state(
            baseline: baseline,
            panTranslation: pan,
            magnification: 1.25,
            rotationDegrees: 12,
            sourceSize: source,
            viewportSize: viewport
        )

        typealias GestureCallback = (
            pan: ShotFramingSize?, magnification: Double?, rotation: Double?
        )
        func stateAfterCallbacks(
            _ callbacks: [GestureCallback]
        ) -> ShotFramingState {
            var currentPan = ShotFramingSize(width: 0, height: 0)
            var currentMagnification = 1.0
            var currentRotation = 0.0
            var latest = baseline
            for callback in callbacks {
                if let value = callback.pan { currentPan = value }
                if let value = callback.magnification {
                    currentMagnification = value
                }
                if let value = callback.rotation { currentRotation = value }
                // This mirrors the UI transaction contract: every callback
                // publishes one complete state from one immutable baseline.
                latest = ShotFramingInteraction.state(
                    baseline: baseline,
                    panTranslation: currentPan,
                    magnification: currentMagnification,
                    rotationDegrees: currentRotation,
                    sourceSize: source,
                    viewportSize: viewport
                )
            }
            return latest
        }

        let panThenPinchThenRoll = stateAfterCallbacks([
            (pan: pan, magnification: nil, rotation: nil),
            (pan: nil, magnification: 1.25, rotation: nil),
            (pan: nil, magnification: nil, rotation: 12),
        ])
        let rollThenPinchThenPan = stateAfterCallbacks([
            (pan: nil, magnification: nil, rotation: 12),
            (pan: nil, magnification: 1.25, rotation: nil),
            (pan: pan, magnification: nil, rotation: nil),
        ])

        XCTAssertEqual(combined, panThenPinchThenRoll)
        XCTAssertEqual(combined, rollThenPinchThenPan)
        XCTAssertEqual(combined.centerX, 0.45, accuracy: 0.000_000_1)
        XCTAssertEqual(combined.centerY, 0.54, accuracy: 0.000_000_1)
        XCTAssertEqual(combined.zoom, 2.5, accuracy: 0.000_000_1)
        XCTAssertEqual(combined.rollDegrees, 12, accuracy: 0.000_000_1)
        XCTAssertEqual(combined.mode, .manual)
        XCTAssertEqual(combined.shotSize, baseline.shotSize)
        XCTAssertEqual(combined.angle, baseline.angle)
        XCTAssertEqual(combined.lensMm, baseline.lensMm)
        XCTAssertEqual(combined.intentFingerprint, baseline.intentFingerprint)
        XCTAssertEqual(combined.revision, baseline.revision)
    }

    func testCinematic239ViewportPixelMappingRoundtripsSourceEdges() throws {
        let viewport = ShotFramingSize(width: 2_390, height: 1_000)
        let state = ShotFramingState(
            centerX: 0.44,
            centerY: 0.57,
            zoom: 1.9,
            rollDegrees: -11,
            aspectRatio: 2.39,
            mode: .manual
        )
        let geometry = try XCTUnwrap(ShotFramingGeometry(
            sourceSize: fullHD,
            viewportSize: viewport,
            state: state
        ))
        let sourceCenter = ShotFramingPoint(
            x: state.centerX * fullHD.width,
            y: state.centerY * fullHD.height
        )
        XCTAssertEqual(
            geometry.viewportPoint(fromSourcePoint: sourceCenter),
            ShotFramingPoint(x: viewport.width / 2, y: viewport.height / 2)
        )

        let sourcePixels: [(String, ShotFramingPoint)] = [
            ("top-left", ShotFramingPoint(x: 0, y: 0)),
            ("top-right", ShotFramingPoint(x: fullHD.width, y: 0)),
            ("bottom-right", ShotFramingPoint(x: fullHD.width, y: fullHD.height)),
            ("bottom-left", ShotFramingPoint(x: 0, y: fullHD.height)),
            ("subpixel", ShotFramingPoint(x: 1_919.5, y: 1_079.25)),
        ]
        for (label, sourcePoint) in sourcePixels {
            let viewportPoint = geometry.viewportPoint(fromSourcePoint: sourcePoint)
            let roundtrip = geometry.sourcePoint(fromViewportPoint: viewportPoint)
            XCTAssertEqual(roundtrip.x, sourcePoint.x, accuracy: 0.000_000_1, label)
            XCTAssertEqual(roundtrip.y, sourcePoint.y, accuracy: 0.000_000_1, label)
        }
    }

    func testVerticalViewportRoundtripsNormalizedAndViewportCornerGeometry() throws {
        let viewport = ShotFramingSize(width: 1_080, height: 1_920)
        let geometry = try XCTUnwrap(ShotFramingGeometry(
            sourceSize: fullHD,
            viewportSize: viewport,
            state: ShotFramingState(
                centerX: 0.51,
                centerY: 0.49,
                zoom: 1.4,
                rollDegrees: -9,
                aspectRatio: 9.0 / 16.0,
                mode: .manual
            )
        ))
        let viewportCorners = [
            ShotFramingPoint(x: 0, y: 0),
            ShotFramingPoint(x: viewport.width, y: 0),
            ShotFramingPoint(x: viewport.width, y: viewport.height),
            ShotFramingPoint(x: 0, y: viewport.height),
        ]
        XCTAssertEqual(geometry.visibleSourcePolygon.count, viewportCorners.count)
        for (sourcePoint, expectedViewportPoint) in zip(
            geometry.visibleSourcePolygon,
            viewportCorners
        ) {
            let roundtrip = geometry.viewportPoint(fromSourcePoint: sourcePoint)
            XCTAssertEqual(
                roundtrip.x,
                expectedViewportPoint.x,
                accuracy: 0.000_000_1
            )
            XCTAssertEqual(
                roundtrip.y,
                expectedViewportPoint.y,
                accuracy: 0.000_000_1
            )
        }

        let normalizedEdges = [
            ShotFramingPoint(x: 0, y: 0),
            ShotFramingPoint(x: 1, y: 0),
            ShotFramingPoint(x: 1, y: 1),
            ShotFramingPoint(x: 0, y: 1),
            ShotFramingPoint(x: 0.333_333, y: 0.666_667),
        ]
        for sourcePoint in normalizedEdges {
            let viewportPoint = geometry.viewportNormalizedPoint(
                fromSourceNormalizedPoint: sourcePoint
            )
            let roundtrip = geometry.sourceNormalizedPoint(
                fromViewportNormalizedPoint: viewportPoint
            )
            XCTAssertEqual(roundtrip.x, sourcePoint.x, accuracy: 0.000_000_1)
            XCTAssertEqual(roundtrip.y, sourcePoint.y, accuracy: 0.000_000_1)
        }
    }

    func testRepeatedCinematicShotSuggestionIsIdempotent() {
        let viewport = ShotFramingSize(width: 2_390, height: 1_000)
        let subject = ShotFramingRect(
            minX: 0.34,
            minY: 0.08,
            width: 0.28,
            height: 0.84
        )
        let focus = ShotFramingPoint(x: 0.48, y: 0.24)
        let baseline = ShotFramingState(
            angle: "Eye level",
            lensMm: 85,
            rollDegrees: 0,
            aspectRatio: viewport.aspectRatio,
            mode: .automatic
        )
        let first = ShotFramingGeometry.suggestedState(
            for: .closeUp,
            currentState: baseline,
            sourceSize: fullHD,
            viewportSize: viewport,
            fullSubjectBounds: subject,
            focusAnchor: focus
        )
        let repeated = ShotFramingGeometry.suggestedState(
            for: .closeUp,
            currentState: first,
            sourceSize: fullHD,
            viewportSize: viewport,
            fullSubjectBounds: subject,
            focusAnchor: focus
        )

        XCTAssertEqual(repeated, first)
        XCTAssertEqual(repeated.shotSize, "CU")
        XCTAssertEqual(repeated.lensMm, 85)
        XCTAssertEqual(repeated.aspectRatio, 2.39, accuracy: 0.000_000_1)
    }

    func testDutchAngleCoverageIsExactAndRepairAddsOnlyRequiredOverscan() throws {
        let raw = ShotFramingState(rollDegrees: 20)
        let geometry = try XCTUnwrap(ShotFramingGeometry(
            sourceSize: fullHD,
            viewportSize: fullHD,
            state: raw
        ))
        XCTAssertLessThan(geometry.coveredViewportFraction, 0.9)
        XCTAssertGreaterThan(geometry.minimumZoomForFullCoverage, 1)

        let repaired = geometry.stateEnsuringFullCoverage()
        let repairedGeometry = try XCTUnwrap(ShotFramingGeometry(
            sourceSize: fullHD,
            viewportSize: fullHD,
            state: repaired
        ))
        XCTAssertEqual(
            repaired.zoom,
            geometry.minimumZoomForFullCoverage,
            accuracy: 0.000_000_1
        )
        XCTAssertEqual(repairedGeometry.coveredViewportFraction, 1, accuracy: 0.000_001)
    }

    func testShotSizePresetsProduceProgressiveFocusAwareFraming() throws {
        let subject = ShotFramingRect(
            minX: 0.40,
            minY: 0.10,
            width: 0.20,
            height: 0.80
        )
        let wide = ShotFramingGeometry.suggestedState(
            for: .wide,
            currentState: .standard,
            sourceSize: fullHD,
            viewportSize: fullHD,
            fullSubjectBounds: subject
        )
        let closeUp = ShotFramingGeometry.suggestedState(
            for: .closeUp,
            currentState: .standard,
            sourceSize: fullHD,
            viewportSize: fullHD,
            fullSubjectBounds: subject
        )
        XCTAssertEqual(wide.shotSize, "WS")
        XCTAssertEqual(closeUp.shotSize, "CU")
        XCTAssertGreaterThan(closeUp.zoom, wide.zoom)
        XCTAssertEqual(closeUp.mode, .automatic)

        let closeUpGeometry = try XCTUnwrap(ShotFramingGeometry(
            sourceSize: fullHD,
            viewportSize: fullHD,
            state: closeUp
        ))
        let focus = try XCTUnwrap(closeUp.focusAnchor)
        let viewportFocus = closeUpGeometry.viewportNormalizedPoint(
            fromSourceNormalizedPoint: focus
        )
        XCTAssertEqual(viewportFocus.x, 0.5, accuracy: 0.000_001)
        XCTAssertEqual(viewportFocus.y, 0.39, accuracy: 0.000_001)
    }

    func testCloseUpCannotCollapseToIdentityForBroadDetectedBounds() {
        let broadSubject = ShotFramingRect(
            minX: 0.02, minY: 0.02, width: 0.96, height: 0.96
        )
        let closeUp = ShotFramingGeometry.suggestedState(
            for: .closeUp,
            currentState: .standard,
            sourceSize: fullHD,
            viewportSize: fullHD,
            fullSubjectBounds: broadSubject
        )
        let extremeCloseUp = ShotFramingGeometry.suggestedState(
            for: .extremeCloseUp,
            currentState: .standard,
            sourceSize: fullHD,
            viewportSize: fullHD,
            fullSubjectBounds: broadSubject
        )

        XCTAssertGreaterThanOrEqual(closeUp.zoom, 2.25)
        XCTAssertGreaterThan(extremeCloseUp.zoom, closeUp.zoom)
    }

    func testShotSizeParserAcceptsProductionAndHumanLabels() {
        XCTAssertEqual(ShotSize(metadataValue: "extreme-wide-shot"), .extremeWide)
        XCTAssertEqual(ShotSize(metadataValue: "Medium Close Up"), .mediumCloseUp)
        XCTAssertEqual(ShotSize(metadataValue: "over_the_shoulder"), .overTheShoulder)
        XCTAssertEqual(ShotSize(metadataValue: "point of view"), .pointOfView)
        XCTAssertNil(ShotSize(metadataValue: "aerial insert"))
    }

    func testQualityValidationDistinguishesWarningsFromBlockingErrors() {
        let identity = ShotFramingQualityValidator.validate(
            state: .standard,
            sourceSize: fullHD,
            outputSize: fullHD
        )
        XCTAssertTrue(identity.isAcceptable)
        XCTAssertFalse(identity.hasWarnings)
        XCTAssertEqual(identity.coverageFraction, 1, accuracy: 0.000_001)
        XCTAssertEqual(identity.sourcePixelsPerOutputPixel, 1, accuracy: 0.000_001)

        let moderateCrop = ShotFramingQualityValidator.validate(
            state: ShotFramingState(zoom: 1.5),
            sourceSize: fullHD,
            outputSize: fullHD
        )
        XCTAssertTrue(moderateCrop.isAcceptable)
        XCTAssertTrue(moderateCrop.issues.contains {
            $0.code == .insufficientResolution && $0.severity == .warning
        })

        let excessiveCrop = ShotFramingQualityValidator.validate(
            state: ShotFramingState(zoom: 3),
            sourceSize: fullHD,
            outputSize: fullHD
        )
        XCTAssertFalse(excessiveCrop.isAcceptable)
        XCTAssertTrue(excessiveCrop.issues.contains {
            $0.code == .excessiveUpscale && $0.severity == .error
        })

        let exposedCorners = ShotFramingQualityValidator.validate(
            state: ShotFramingState(rollDegrees: 20),
            sourceSize: fullHD,
            outputSize: fullHD
        )
        XCTAssertFalse(exposedCorners.isAcceptable)
        XCTAssertTrue(exposedCorners.issues.contains { $0.code == .uncoveredViewport })
    }

    func testQualityValidationProtectsFocusAndCriticalContent() {
        let state = ShotFramingState(
            focusAnchorX: 0.99,
            focusAnchorY: 0.5
        )
        let report = ShotFramingQualityValidator.validate(
            state: state,
            sourceSize: fullHD,
            outputSize: fullHD,
            protectedSourceBounds: ShotFramingRect(
                minX: 0.01,
                minY: 0.40,
                width: 0.12,
                height: 0.20
            )
        )
        XCTAssertTrue(report.issues.contains { $0.code == .focusOutsideSafeArea })
        XCTAssertTrue(report.issues.contains { $0.code == .protectedContentClipped })
        XCTAssertFalse(report.isAcceptable)
    }

    func testInvalidDimensionsReturnDeterministicBlockingReport() {
        let report = ShotFramingQualityValidator.validate(
            state: .standard,
            sourceSize: ShotFramingSize(width: 0, height: 1_080),
            outputSize: fullHD
        )
        XCTAssertEqual(report.coverageFraction, 0)
        XCTAssertEqual(report.sourcePixelsPerOutputPixel, 0)
        XCTAssertEqual(
            report.issues,
            [ShotFramingQualityIssue(code: .invalidDimensions, severity: .error)]
        )
        XCTAssertFalse(report.isAcceptable)
    }

    @MainActor
    func testCanvasUndoRestoresCameraTogetherWithDrawingDocument() {
        let state = CanvasState()
        state.beginHistory(frameId: "framing-history-\(UUID().uuidString)",
                           layerState: .standard, shotFraming: .standard)
        state.captureUndo("Endre utsnitt")
        state.shotFraming = ShotFramingState(
            shotSize: "CU", centerX: 0.64, centerY: 0.42,
            zoom: 3, rollDegrees: 8, mode: .manual, revision: 1)
        state.revision += 1

        state.undo()

        XCTAssertEqual(state.shotFraming, .standard)
        state.redo()
        XCTAssertEqual(state.shotFraming.shotSize, "CU")
        XCTAssertEqual(state.shotFraming.zoom, 3)
        XCTAssertEqual(state.shotFraming.rollDegrees, 8)
    }

    @MainActor
    func testLocalSampleBoardAppliesFramingWithoutNetworkMutation() {
        let board = BoardState(
            manuscript: StoryboardSampleProject.manuscript,
            sampleScenes: StoryboardSampleProject.scenes)
        let closeUp = ShotFramingState(
            shotSize: "CU", angle: "Dutch", lensMm: 85,
            centerX: 0.6, centerY: 0.4, zoom: 3,
            rollDegrees: 8, mode: .automatic, revision: 1)

        board.applyShotFramingLocally(closeUp)

        XCTAssertEqual(board.frame?.shotType, "CU")
        XCTAssertEqual(board.frame?.angle, "Dutch")
        XCTAssertEqual(board.frame?.lensMm, 85)
        XCTAssertEqual(board.frame?.shotFraming, closeUp)
        // A local Pencil-only frame has no generated output to invalidate.
        // Frames with an AI storyboard/fingerprint are gated stale instead.
        XCTAssertEqual(board.frame?.aiOutputStale, false)
    }

    @MainActor
    func testAIContextCarriesCanonicalAppliedFraming() throws {
        let scene = try XCTUnwrap(StoryboardSampleProject.scenes.first)
        var frame = try XCTUnwrap(scene.frames.first)
        frame.shotFraming = ShotFramingState(
            shotSize: "MCU", angle: "Eye level", lensMm: 50,
            centerX: 0.44, centerY: 0.36, zoom: 2.2,
            mode: .manual, revision: 4)

        let context = RoleRoomAPIClient.storyboardShotContext(
            manuscript: StoryboardSampleProject.manuscript,
            scene: scene, frame: frame)
        let shot = try XCTUnwrap(context["shot"] as? [String: any Sendable])
        let framing = try XCTUnwrap(
            shot["shotFraming"] as? [String: any Sendable])

        XCTAssertEqual(framing["shotSize"] as? String, "MCU")
        XCTAssertEqual(framing["zoom"] as? Double, 2.2)
        XCTAssertEqual(framing["revision"] as? Int, 4)
    }

    func testPendingDocumentRoundtripPreservesOfflineFramingAndRevision() throws {
        let expected = ShotFramingState(
            shotSize: "OTS", angle: "Dutch", lensMm: 35,
            centerX: 0.62, centerY: 0.45, zoom: 1.9,
            rollDegrees: 8, mode: .manual, revision: 7)
        let baseFraming = ShotFramingState(
            shotSize: "MS", centerX: 0.5, centerY: 0.5,
            zoom: 1.2, mode: .automatic, revision: 3)
        var baseLayers = BoardLayerState.standard
        baseLayers.hidden.insert("Notes")
        let pending = PendingStoryboardDocument(
            strokesJSON: "[]", layerState: .standard,
            shotFraming: expected, localRevision: 42,
            thumbnailDataURL: "data:image/jpeg;base64,AA==",
            baseUpdatedAt: "2026-08-29T10:00:00Z",
            baseStrokesJSON: #"[{"id":"base"}]"#,
            baseLayerState: baseLayers,
            baseShotFraming: baseFraming)

        let data = try JSONEncoder().encode(pending)
        let decoded = try JSONDecoder().decode(PendingStoryboardDocument.self,
                                                from: data)

        XCTAssertEqual(decoded.version, PendingStoryboardDocument.schemaVersion)
        XCTAssertEqual(decoded.shotFraming, expected)
        XCTAssertEqual(decoded.localRevision, 42)
        XCTAssertEqual(decoded.baseUpdatedAt, "2026-08-29T10:00:00Z")
        XCTAssertEqual(decoded.baseStrokesJSON, #"[{"id":"base"}]"#)
        XCTAssertEqual(decoded.baseLayerState, baseLayers)
        XCTAssertEqual(decoded.baseShotFraming, baseFraming)
    }

    func testFramePatchRequestCarriesCameraAndLayerMergeBases() throws {
        var baseLayers = BoardLayerState.standard
        baseLayers.activeLayer = "Color"
        let baseFraming = ShotFramingState(
            shotSize: "MCU", angle: "Eye level", lensMm: 50,
            centerX: 0.45, centerY: 0.5, zoom: 2,
            mode: .manual, revision: 4)

        let body = RoleRoomAPIClient.framePatchRequestBody(
            manuscriptId: "manuscript",
            sceneId: "scene",
            frameId: "frame",
            fields: ["drawingData": ["strokes": "[]"]],
            baseUpdatedAt: "2026-08-29T10:00:00Z",
            baseStrokesJSON: "[]",
            baseLayerState: baseLayers,
            baseShotFraming: baseFraming)

        XCTAssertTrue(JSONSerialization.isValidJSONObject(body))
        XCTAssertEqual(BoardLayerStateCoding.decode(body["baseLayerState"]),
                       baseLayers)
        XCTAssertEqual(ShotFramingStateCoding.decode(body["baseShotFraming"]),
                       baseFraming.normalized())
    }

    func testSaveCompletionClearsOnlyTheConfirmedCurrentSnapshot() {
        let snapshot = makeSaveSnapshot(revision: 8, strokesJSON: #"[{"id":"old"}]"#)
        let matchingWAL = PendingStoryboardDocument(
            strokesJSON: snapshot.strokesJSON,
            layerState: snapshot.layerState,
            shotFraming: snapshot.shotFraming,
            localRevision: snapshot.revision,
            baseUpdatedAt: snapshot.baseUpdatedAt,
            baseStrokesJSON: snapshot.baseStrokesJSON,
            baseLayerState: snapshot.baseLayerState,
            baseShotFraming: snapshot.baseShotFraming)

        let plan = FrameSaveRacePolicy.completionPlan(
            snapshot: snapshot,
            loadedFrameId: snapshot.frameId,
            currentRevision: snapshot.revision,
            pendingDocument: matchingWAL)

        XCTAssertEqual(plan, FrameSaveCompletionPlan(
            updateActiveBaselines: true,
            clearPendingDocument: true,
            scheduleLatestActiveSave: false))
    }

    func testSaveCompletionKeepsNewerWALAndSchedulesLatestRevision() {
        let snapshot = makeSaveSnapshot(revision: 8, strokesJSON: #"[{"id":"old"}]"#)
        let newerWAL = PendingStoryboardDocument(
            strokesJSON: #"[{"id":"old"},{"id":"new"}]"#,
            layerState: snapshot.layerState,
            shotFraming: ShotFramingState(
                shotSize: "CU", centerX: 0.6, zoom: 2.5,
                mode: .manual, revision: 9),
            localRevision: 9)

        let plan = FrameSaveRacePolicy.completionPlan(
            snapshot: snapshot,
            loadedFrameId: snapshot.frameId,
            currentRevision: 9,
            pendingDocument: newerWAL)

        XCTAssertEqual(plan, FrameSaveCompletionPlan(
            updateActiveBaselines: true,
            clearPendingDocument: false,
            scheduleLatestActiveSave: true))
    }

    func testSaveCompletionForInactiveFrameNeverMutatesActiveBaselines() {
        let snapshot = makeSaveSnapshot(revision: 8, strokesJSON: "[]")
        let matchingWAL = PendingStoryboardDocument(
            strokesJSON: snapshot.strokesJSON,
            layerState: snapshot.layerState,
            shotFraming: snapshot.shotFraming,
            localRevision: snapshot.revision,
            baseUpdatedAt: snapshot.baseUpdatedAt,
            baseStrokesJSON: snapshot.baseStrokesJSON,
            baseLayerState: snapshot.baseLayerState,
            baseShotFraming: snapshot.baseShotFraming)

        let plan = FrameSaveRacePolicy.completionPlan(
            snapshot: snapshot,
            loadedFrameId: "another-frame",
            currentRevision: 101,
            pendingDocument: matchingWAL)

        XCTAssertFalse(plan.updateActiveBaselines)
        XCTAssertTrue(plan.clearPendingDocument)
        XCTAssertFalse(plan.scheduleLatestActiveSave)
    }

    func testSaveCompletionKeepsWALWhenCameraOrLayerBaseChanged() {
        let snapshot = makeSaveSnapshot(revision: 8, strokesJSON: "[]")
        var differentCameraBase = snapshot.baseShotFraming ?? .standard
        differentCameraBase.centerX = 0.7
        var differentLayerBase = snapshot.baseLayerState ?? .standard
        differentLayerBase.hidden.insert("Notes")

        for pending in [
            PendingStoryboardDocument(
                strokesJSON: snapshot.strokesJSON,
                layerState: snapshot.layerState,
                shotFraming: snapshot.shotFraming,
                localRevision: snapshot.revision,
                baseUpdatedAt: snapshot.baseUpdatedAt,
                baseStrokesJSON: snapshot.baseStrokesJSON,
                baseLayerState: snapshot.baseLayerState,
                baseShotFraming: differentCameraBase),
            PendingStoryboardDocument(
                strokesJSON: snapshot.strokesJSON,
                layerState: snapshot.layerState,
                shotFraming: snapshot.shotFraming,
                localRevision: snapshot.revision,
                baseUpdatedAt: snapshot.baseUpdatedAt,
                baseStrokesJSON: snapshot.baseStrokesJSON,
                baseLayerState: differentLayerBase,
                baseShotFraming: snapshot.baseShotFraming),
        ] {
            let plan = FrameSaveRacePolicy.completionPlan(
                snapshot: snapshot,
                loadedFrameId: snapshot.frameId,
                currentRevision: snapshot.revision,
                pendingDocument: pending)
            XCTAssertFalse(plan.clearPendingDocument)
            XCTAssertTrue(plan.scheduleLatestActiveSave)
        }
    }

    func testPendingStoreCompareAndClearCannotDeleteNewerWAL() throws {
        let frameId = "save-race-\(UUID().uuidString)"
        defer { PendingStrokeStore.clear(frameId: frameId) }

        PendingStrokeStore.save(
            #"[{"id":"old"}]"#, frameId: frameId,
            layerState: .standard, shotFraming: .standard,
            localRevision: 1)
        let oldWAL = try XCTUnwrap(PendingStrokeStore.loadDocument(frameId: frameId))
        PendingStrokeStore.save(
            #"[{"id":"new"}]"#, frameId: frameId,
            layerState: .standard, shotFraming: .standard,
            localRevision: 2)

        XCTAssertFalse(PendingStrokeStore.clear(
            frameId: frameId, ifUnchangedFrom: oldWAL))
        let newerWAL = try XCTUnwrap(PendingStrokeStore.loadDocument(frameId: frameId))
        XCTAssertEqual(newerWAL.localRevision, 2)
        XCTAssertEqual(newerWAL.strokesJSON, #"[{"id":"new"}]"#)
        XCTAssertTrue(PendingStrokeStore.clear(
            frameId: frameId, ifUnchangedFrom: newerWAL))
        XCTAssertNil(PendingStrokeStore.loadDocument(frameId: frameId))
    }

    func testAIImageOperationContextFingerprintIsCanonical() throws {
        let first: [String: any Sendable] = [
            "shot": ["number": "1A", "lens": 50] as [String: any Sendable],
            "style": "story-pencil",
        ]
        let reordered: [String: any Sendable] = [
            "style": "story-pencil",
            "shot": ["lens": 50, "number": "1A"] as [String: any Sendable],
        ]
        XCTAssertEqual(
            try AIImageGenerationOperationIdentity.contextFingerprint(first),
            try AIImageGenerationOperationIdentity.contextFingerprint(reordered))
    }

    @MainActor
    func testAIImageOperationKeySurvivesRetryAndCompareAndClear() throws {
        let identity = AIImageGenerationOperationIdentity(
            projectId: "project-\(UUID().uuidString)",
            storyboardId: "storyboard", frameId: "frame", stage: "color",
            sourceRevision: 7, sourceUpdatedAt: "source-token",
            framingFingerprint: "framing-a", requestFingerprint: "request-a",
            paintoverCompositeFingerprint: nil)
        let first = try AIImageGenerationOperationStore.operationKey(for: identity)
        defer {
            _ = AIImageGenerationOperationStore.clear(
                identity, ifOperationKeyMatches: first)
        }

        XCTAssertEqual(
            try AIImageGenerationOperationStore.operationKey(for: identity), first,
            "A retry/relaunch of the same source operation must reuse its paid key")
        XCTAssertFalse(AIImageGenerationOperationStore.clear(
            identity, ifOperationKeyMatches: "ios-newer-operation"))
        XCTAssertEqual(
            try AIImageGenerationOperationStore.operationKey(for: identity), first,
            "An older completion must not clear a different operation key")
        XCTAssertTrue(AIImageGenerationOperationStore.clear(
            identity, ifOperationKeyMatches: first))
        let nextExplicitOperation = try AIImageGenerationOperationStore
            .operationKey(for: identity)
        XCTAssertNotEqual(nextExplicitOperation, first)
        _ = AIImageGenerationOperationStore.clear(
            identity, ifOperationKeyMatches: nextExplicitOperation)
    }

    @MainActor
    func testAIImageOperationStorePrunesRecordsOlderThanThirtyDays() throws {
        let prefix = UUID().uuidString
        let baselineCount = AIImageGenerationOperationStore.retainedOperationCount
        let expiredDate = Date().addingTimeInterval(-31 * 24 * 60 * 60)
        var operations: [(AIImageGenerationOperationIdentity, String)] = []
        for index in 0..<4 {
            let identity = AIImageGenerationOperationIdentity(
                projectId: "cleanup-\(prefix)", storyboardId: "storyboard",
                frameId: "frame-\(index)", stage: "color",
                sourceRevision: index, sourceUpdatedAt: "source-\(index)",
                framingFingerprint: "framing-\(index)",
                requestFingerprint: "request-\(index)",
                paintoverCompositeFingerprint: nil)
            operations.append((
                identity,
                try AIImageGenerationOperationStore.operationKey(
                    for: identity, now: expiredDate)))
        }
        XCTAssertGreaterThanOrEqual(
            AIImageGenerationOperationStore.retainedOperationCount,
            baselineCount + operations.count)
        let current = AIImageGenerationOperationIdentity(
            projectId: "cleanup-\(prefix)", storyboardId: "storyboard",
            frameId: "current", stage: "color", sourceRevision: 99,
            sourceUpdatedAt: "current-source",
            framingFingerprint: "current-framing",
            requestFingerprint: "current-request",
            paintoverCompositeFingerprint: nil)
        let currentKey = try AIImageGenerationOperationStore.operationKey(for: current)
        XCTAssertLessThanOrEqual(
            AIImageGenerationOperationStore.retainedOperationCount,
            baselineCount + 1)
        for (identity, key) in operations {
            _ = AIImageGenerationOperationStore.clear(
                identity, ifOperationKeyMatches: key)
        }
        _ = AIImageGenerationOperationStore.clear(
            current, ifOperationKeyMatches: currentKey)
    }

    func testAIImageOperationClearsOnlyForKnownTerminalServerResponse() {
        XCTAssertTrue(AIImageGenerationOperationRetentionPolicy
            .shouldClearAfterTerminalResponse(SyncError.serverResponse(
                code: "generation_attempt_failed", message: "failed")))
        XCTAssertTrue(AIImageGenerationOperationRetentionPolicy
            .shouldClearAfterTerminalResponse(SyncError.serverResponse(
                code: "idempotency_key_reused", message: "mismatch")))
        XCTAssertTrue(AIImageGenerationOperationRetentionPolicy
            .shouldClearAfterTerminalResponse(SyncError.serverResponse(
                code: "idempotency_payload_changed", message: "mismatch")))
        XCTAssertFalse(AIImageGenerationOperationRetentionPolicy
            .shouldClearAfterTerminalResponse(SyncError.serverResponse(
                code: "image_stage_generation_failed",
                message: "candidate outcome is unknown")))
        XCTAssertFalse(AIImageGenerationOperationRetentionPolicy
            .shouldClearAfterTerminalResponse(SyncError.generationInProgress))
        XCTAssertFalse(AIImageGenerationOperationRetentionPolicy
            .shouldClearAfterTerminalResponse(SyncError.malformed(
                "successful response with unknown outcome")))
        XCTAssertFalse(AIImageGenerationOperationRetentionPolicy
            .shouldClearAfterTerminalResponse(CancellationError()))
    }

    func testVideoCompletionRequiresServerSourceAdoption() {
        func summary(status: String = "completed", sourceCurrent: Bool?)
            -> StoryboardAIJobSummary {
            StoryboardAIJobSummary(
                jobId: "job", status: status, estimatedCostUsd: nil,
                outputURL: "https://example.invalid/video.mp4", error: nil,
                sourceCurrent: sourceCurrent)
        }
        XCTAssertTrue(StoryboardAIVideoCompletionPolicy.serverAdopted(
            summary(sourceCurrent: true)))
        XCTAssertFalse(StoryboardAIVideoCompletionPolicy.serverAdopted(
            summary(sourceCurrent: false)))
        XCTAssertFalse(StoryboardAIVideoCompletionPolicy.serverAdopted(
            summary(sourceCurrent: nil)))
        XCTAssertFalse(StoryboardAIVideoCompletionPolicy.serverAdopted(
            summary(status: "running", sourceCurrent: true)))
    }

    func testRefreshedVideoURLRequiresExactReloadedIdentity() {
        let identity = StoryboardAIVideoRefreshIdentity(
            sceneId: "scene", frameId: "frame",
            storyboardId: "storyboard", jobId: "job")
        func canApply(
            sceneId: String = "scene", frameId: String = "frame",
            storyboardId: String? = "storyboard", jobId: String? = "job",
            sourceMatches: Bool = true
        ) -> Bool {
            StoryboardAIVideoRefreshPolicy.canApply(
                identity, sceneId: sceneId, frameId: frameId,
                storyboardId: storyboardId, jobId: jobId,
                sourceIdentityMatches: sourceMatches)
        }
        XCTAssertTrue(canApply())
        XCTAssertFalse(canApply(sceneId: "other-scene"))
        XCTAssertFalse(canApply(frameId: "other-frame"))
        XCTAssertFalse(canApply(storyboardId: "other-storyboard"))
        XCTAssertFalse(canApply(jobId: "newer-job"))
        XCTAssertFalse(canApply(sourceMatches: false))
    }

    func testVideoPlaybackRequiresCompleteExactSourceIdentity() {
        let colorFingerprint = String(repeating: "a", count: 64)
        let atmosphereFingerprint = String(repeating: "b", count: 64)
        let currentPaintoverState = StoryboardPaintoverState(
            colorRevision: 3,
            atmosphereRevision: 5,
            colorFingerprint: colorFingerprint,
            atmosphereFingerprint: atmosphereFingerprint,
            colorHasContent: true,
            atmosphereHasContent: true,
            atmosphereStale: false,
            videoStale: false)
        func matches(
            status: String? = "completed", stale: Bool = false,
            videoFraming: String? = "framing", currentFraming: String = "framing",
            videoRevision: Int? = 4, sourceRevision: Int? = 4,
            videoToken: String? = "source-token", sourceToken: String? = "source-token",
            paintoverState: StoryboardPaintoverState? = currentPaintoverState,
            colorRevision: Int? = 3,
            atmosphereRevision: Int? = 5,
            colorHasContent: Bool? = true,
            atmosphereHasContent: Bool? = true,
            compositeFingerprint: String? = String(repeating: "c", count: 64)
        ) -> Bool {
            StoryboardVideoPlaybackPolicy.sourceIdentityMatches(
                videoStatus: status, isOutputStale: stale,
                videoFraming: videoFraming, currentFraming: currentFraming,
                videoRevision: videoRevision, sourceRevision: sourceRevision,
                videoSourceUpdatedAt: videoToken, sourceUpdatedAt: sourceToken,
                paintoverState: paintoverState,
                videoBaseVersionId: "11111111-1111-1111-1111-111111111111",
                videoStage: "atmosphere",
                videoFrameUpdatedAt: "frame-token-before-submit",
                videoColorRevision: colorRevision,
                videoAtmosphereRevision: atmosphereRevision,
                videoColorFingerprint: colorFingerprint,
                videoAtmosphereFingerprint: atmosphereFingerprint,
                videoColorHasContent: colorHasContent,
                videoAtmosphereHasContent: atmosphereHasContent,
                videoCompositeFingerprint: compositeFingerprint)
        }
        XCTAssertTrue(matches())
        XCTAssertFalse(matches(status: "running"))
        XCTAssertFalse(matches(stale: true))
        XCTAssertFalse(matches(videoFraming: nil))
        XCTAssertFalse(matches(currentFraming: "reframed"))
        XCTAssertFalse(matches(videoRevision: nil))
        XCTAssertFalse(matches(sourceRevision: nil))
        XCTAssertFalse(matches(videoToken: nil))
        XCTAssertFalse(matches(sourceToken: nil))
        XCTAssertFalse(matches(paintoverState: nil))
        XCTAssertFalse(matches(colorRevision: 2))
        XCTAssertFalse(matches(atmosphereRevision: 4))
        XCTAssertFalse(matches(colorHasContent: false))
        XCTAssertFalse(matches(atmosphereHasContent: false))
        XCTAssertFalse(matches(compositeFingerprint: "not-a-sha256"))

        var serverStale = currentPaintoverState
        serverStale.videoStale = true
        XCTAssertFalse(matches(paintoverState: serverStale),
                       "Server-owned videoStale must fail closed")
        var staleAtmosphere = currentPaintoverState
        staleAtmosphere.atmosphereStale = true
        XCTAssertFalse(matches(paintoverState: staleAtmosphere),
                       "An Atmosphere video cannot play from a stale stage")

        let localEdit = StoryboardPaintoverChangeSet(
            pencilChanged: false, colorChanged: false,
            atmosphereChanged: true)
        XCTAssertFalse(matches(
            paintoverState: currentPaintoverState.applying(localEdit)),
            "A local paintover edit must block playback before autosync")
    }

    func testFetchedAIVersionMustMatchAuthoritativeSourceRevision() {
        XCTAssertTrue(AIImageVersionRevisionPolicy.matches(
            candidateSourceRevision: 12,
            authoritativeSourceRevision: 12,
            generatedDocumentRevision: nil,
            currentDocumentRevision: 8,
            loadedDocumentRevision: 8,
            isApproved: true,
            frameIsStale: false))
        XCTAssertFalse(AIImageVersionRevisionPolicy.matches(
            candidateSourceRevision: 11,
            authoritativeSourceRevision: 12,
            generatedDocumentRevision: nil,
            currentDocumentRevision: 8,
            loadedDocumentRevision: 8,
            isApproved: true,
            frameIsStale: false))
    }

    func testOldFetchedCandidateCannotReappearAfterAutosync() {
        XCTAssertFalse(AIImageVersionRevisionPolicy.matches(
            candidateSourceRevision: 4,
            authoritativeSourceRevision: 5,
            generatedDocumentRevision: nil,
            currentDocumentRevision: 19,
            loadedDocumentRevision: 19,
            isApproved: false,
            frameIsStale: true))
    }

    func testLegacyRevisionEscapeHatchIsApprovedAndCleanOnly() {
        XCTAssertTrue(AIImageVersionRevisionPolicy.matches(
            candidateSourceRevision: nil,
            authoritativeSourceRevision: nil,
            generatedDocumentRevision: nil,
            currentDocumentRevision: 3,
            loadedDocumentRevision: 3,
            isApproved: true,
            frameIsStale: false))
        XCTAssertFalse(AIImageVersionRevisionPolicy.matches(
            candidateSourceRevision: nil,
            authoritativeSourceRevision: nil,
            generatedDocumentRevision: nil,
            currentDocumentRevision: 3,
            loadedDocumentRevision: 3,
            isApproved: false,
            frameIsStale: false))
        XCTAssertFalse(AIImageVersionRevisionPolicy.matches(
            candidateSourceRevision: nil,
            authoritativeSourceRevision: nil,
            generatedDocumentRevision: nil,
            currentDocumentRevision: 4,
            loadedDocumentRevision: 3,
            isApproved: true,
            frameIsStale: false))
    }

    func testPortraitDutchAnnotationMetricsMatchLiveAndExportGeometry() throws {
        let framing = ShotFramingState(
            shotSize: "CU", angle: "Dutch", lensMm: 85,
            centerX: 0.48, centerY: 0.52, zoom: 1.35,
            rollDegrees: 12, aspectRatio: 9.0 / 16.0,
            mode: .manual)
        let liveGeometry = try XCTUnwrap(ShotFramingGeometry(
            sourceSize: fullHD,
            viewportSize: ShotFramingSize(width: 540, height: 960),
            state: framing))
        let exportGeometry = try XCTUnwrap(ShotFramingGeometry(
            sourceSize: fullHD,
            viewportSize: ShotFramingSize(width: 1_080, height: 1_920),
            state: framing))

        let live = StoryboardAnnotationLayoutMetrics.resolve(
            style: "bubble", sourceScale: liveGeometry.sourceScale)
        let export = StoryboardAnnotationLayoutMetrics.resolve(
            style: "bubble", sourceScale: exportGeometry.sourceScale)

        // Export is exactly 2x the live viewport, so every camera-dependent
        // metric scales by 2 (unless the shared 12 pt legibility floor wins).
        XCTAssertEqual(export.displayScale, live.displayScale * 2, accuracy: 0.000_001)
        XCTAssertEqual(export.fontSize, live.fontSize * 2, accuracy: 0.000_001)
        XCTAssertEqual(export.padding, live.padding * 2, accuracy: 0.000_001)
        XCTAssertEqual(export.cornerRadius, live.cornerRadius * 2, accuracy: 0.000_001)
        XCTAssertEqual(export.lineWidth, live.lineWidth * 2, accuracy: 0.000_001)
        XCTAssertEqual(export.tailLength, live.tailLength * 2, accuracy: 0.000_001)

        let incorrectWidthOnlyScale = 540.0 / fullHD.width
        XCTAssertGreaterThan(live.displayScale, incorrectWidthOnlyScale * 4,
            "9:16 must use aspect-fill height, not the old width-only scale")
    }

    func testFrozenPlateAffineMatchesShotFramingGeometryExactly() throws {
        let viewport = ShotFramingSize(width: 960, height: 540)
        let framing = ShotFramingState(
            centerX: 0.62,
            centerY: 0.43,
            zoom: 2.4,
            rollDegrees: 17,
            aspectRatio: 16.0 / 9.0,
            mode: .manual)
        let geometry = try XCTUnwrap(ShotFramingGeometry(
            sourceSize: fullHD,
            viewportSize: viewport,
            state: framing))
        let affine = try XCTUnwrap(CameraMotionPreviewAffineTransform(
            sourceSize: fullHD,
            viewportSize: viewport,
            framing: framing))

        XCTAssertEqual(affine.scale, geometry.sourceScale, accuracy: 0.000_001)
        XCTAssertEqual(
            affine.rotationDegrees,
            geometry.state.rollDegrees,
            accuracy: 0.000_001)
        let sourcePoints = [
            ShotFramingPoint(x: 0, y: 0),
            ShotFramingPoint(x: fullHD.width, y: 0),
            ShotFramingPoint(x: fullHD.width, y: fullHD.height),
            ShotFramingPoint(x: 0, y: fullHD.height),
            ShotFramingPoint(x: 933.25, y: 411.75),
        ]
        for sourcePoint in sourcePoints {
            let expected = geometry.viewportPoint(
                fromSourcePoint: sourcePoint)
            let actual = affine.viewportPoint(
                fromSourcePoint: sourcePoint)
            XCTAssertEqual(actual.x, expected.x, accuracy: 0.000_001)
            XCTAssertEqual(actual.y, expected.y, accuracy: 0.000_001)
        }
    }

    func testCameraPreviewSnapshotChangesAffineWithoutChangingPlateKey() throws {
        let key = CameraMotionPreviewPlateKey(
            frameID: "frame-1",
            localDocumentRevision: 42,
            sourceUpdatedAt: "source-v4",
            rasterIdentity: "raster-v3",
            sourceSize: fullHD,
            strokeCount: 17)
        let viewport = ShotFramingSize(width: 800, height: 450)
        let first = try XCTUnwrap(CameraMotionPreviewSnapshot(
            plateKey: key,
            sourceSize: fullHD,
            viewportSize: viewport,
            framing: .standard))
        let moved = try XCTUnwrap(CameraMotionPreviewSnapshot(
            plateKey: key,
            sourceSize: fullHD,
            viewportSize: viewport,
            framing: ShotFramingState(
                centerX: 0.7, centerY: 0.4, zoom: 2,
                rollDegrees: -8, mode: .manual)))

        XCTAssertEqual(first.plateKey, moved.plateKey)
        XCTAssertNotEqual(first.affine, moved.affine)
        let nextRevision = CameraMotionPreviewPlateKey(
            frameID: "frame-1",
            localDocumentRevision: 43,
            sourceUpdatedAt: "source-v4",
            rasterIdentity: "raster-v3",
            sourceSize: fullHD,
            strokeCount: 17)
        XCTAssertNotEqual(key, nextRevision)
    }

    private func makeSaveSnapshot(
        revision: Int,
        strokesJSON: String
    ) -> ActiveFrameSaveSnapshot {
        ActiveFrameSaveSnapshot(
            manuscriptId: "manuscript",
            sceneId: "scene",
            frameId: "frame",
            revision: revision,
            strokesJSON: strokesJSON,
            thumbnailDataURL: "data:image/jpeg;base64,AA==",
            layerState: .standard,
            shotFraming: ShotFramingState(
                shotSize: "MS", centerX: 0.5, centerY: 0.5,
                zoom: 1.4, mode: .automatic, revision: revision),
            baseUpdatedAt: "2026-08-29T10:00:00Z",
            baseStrokesJSON: "[]",
            baseLayerState: .standard,
            baseShotFraming: .standard)
    }
}
