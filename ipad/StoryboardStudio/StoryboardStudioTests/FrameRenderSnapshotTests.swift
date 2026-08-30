import XCTest
@testable import StoryboardStudio

final class FrameRenderSnapshotTests: XCTestCase {
    private let duration = try! MediaTime(value: 4, timescale: 1)

    private func document(
        initialFraming: ShotFramingState = .standard,
        track: CameraMotionTrack? = nil,
        layerState: BoardLayerState = .standard,
        raster: RasterSourceIdentity? = nil,
        rasterPlacement: ShotFramingState? = nil
    ) throws -> FrameDocument {
        try FrameDocument(
            frameID: "frame-a",
            documentIdentity: "document-sha256:a",
            localDocumentRevision: 4,
            aiSourceRevision: 9,
            shotDuration: duration,
            initialFraming: initialFraming,
            cameraMotionTrack: track,
            layerState: layerState,
            strokeReferences: [
                FrameStrokeReference(id: "drawing-1", layer: "Drawing"),
                FrameStrokeReference(id: "color-1", layer: "Color"),
                FrameStrokeReference(id: "notes-1", layer: "Notes"),
            ],
            rasterSourceIdentity: raster,
            rasterPlacementFraming: rasterPlacement)
    }

    func testLegacyStaticDocumentPreservesTZeroFramingAndVisibility() throws {
        let initial = ShotFramingState(
            shotSize: "CU", angle: "Dutch", lensMm: 85,
            centerX: 0.42, centerY: 0.61, zoom: 2.4,
            rollDegrees: 8, aspectRatio: 2.39,
            mode: .manual, revision: 12)
        var layers = BoardLayerState.standard
        layers.hidden = ["Color"]
        let document = try document(
            initialFraming: initial,
            layerState: layers)

        let atZero = try FrameEvaluator.evaluate(
            document: document, at: .zero)
        let later = try FrameEvaluator.evaluate(
            document: document,
            at: try MediaTime(value: 3, timescale: 1))

        XCTAssertEqual(atZero.presentationFraming, initial.normalized())
        XCTAssertEqual(later.presentationFraming, initial.normalized())
        XCTAssertEqual(atZero.rasterPlacementFraming, initial.normalized())
        XCTAssertEqual(atZero.visibleStrokeIDs, ["drawing-1", "notes-1"])
        XCTAssertTrue(atZero.warnings.isEmpty)
        XCTAssertFalse(atZero.hasBlockingWarnings)
        XCTAssertTrue(atZero.semanticFingerprint.hasPrefix("sha256:"))
        XCTAssertEqual(atZero.semanticFingerprint.count, 71)
        XCTAssertEqual(
            atZero.semanticFingerprint,
            "sha256:37761e6c49cccd81a996cd6d8a320b92adb2287e39f1aada60c852ecb25bf20d")
    }

    func testMotionChangesOnlyPresentationAndKeepsViewportRasterPlacementFrozen() throws {
        let initial = ShotFramingState(
            shotSize: "MS", lensMm: 35,
            centerX: 0.2, centerY: 0.4, zoom: 1,
            aspectRatio: 16.0 / 9.0, mode: .manual)
        let track = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "end", time: duration,
                pose: CameraPose2D(
                    centerX: 0.8, centerY: 0.6,
                    zoom: 4, rollDegrees: 10)),
        ])
        let raster = RasterSourceIdentity(
            id: "approved-atmosphere:9",
            revision: 9,
            coordinateSpace: .viewport)
        let document = try document(
            initialFraming: initial,
            track: track,
            raster: raster,
            rasterPlacement: initial)

        let start = try FrameEvaluator.evaluate(document: document, at: .zero)
        let middle = try FrameEvaluator.evaluate(
            document: document,
            at: try MediaTime(value: 2, timescale: 1))

        XCTAssertEqual(start.presentationFraming, initial.normalized())
        XCTAssertEqual(start.rasterPlacementFraming, initial.normalized())
        XCTAssertTrue(start.warnings.isEmpty)
        XCTAssertEqual(middle.presentationFraming.centerX, 0.5, accuracy: 0.000_001)
        XCTAssertEqual(middle.presentationFraming.centerY, 0.5, accuracy: 0.000_001)
        XCTAssertEqual(middle.presentationFraming.zoom, 2, accuracy: 0.000_001)
        XCTAssertEqual(middle.rasterPlacementFraming, initial.normalized())
        XCTAssertEqual(middle.warnings, [FrameRenderWarning(
            code: .viewportRasterCoverageUnverified,
            severity: .warning,
            field: "presentationFraming",
            time: try MediaTime(value: 2, timescale: 1))])
        XCTAssertFalse(middle.hasBlockingWarnings)
    }

    func testViewportRasterWithoutPlacementReturnsBlockingWarning() throws {
        let document = try document(raster: RasterSourceIdentity(
            id: "legacy-ai-raster",
            coordinateSpace: .viewport))

        let snapshot = try FrameEvaluator.evaluate(
            document: document, at: .zero)

        XCTAssertEqual(snapshot.rasterPlacementFraming, .standard)
        XCTAssertEqual(snapshot.warnings, [FrameRenderWarning(
            code: .viewportRasterPlacementMissing,
            severity: .blocking,
            field: "rasterPlacementFraming",
            time: .zero)])
        XCTAssertTrue(snapshot.hasBlockingWarnings)
    }

    func testRequestedTimeIsClampedWithStructuredInfo() throws {
        let document = try document()
        let requested = try MediaTime(value: 7, timescale: 1)

        let snapshot = try FrameEvaluator.evaluate(
            document: document, at: requested)

        XCTAssertEqual(snapshot.time, duration)
        XCTAssertEqual(snapshot.warnings, [FrameRenderWarning(
            code: .requestedTimeClamped,
            severity: .info,
            field: "time",
            time: requested)])
    }

    func testFingerprintIgnoresEditorOnlyMotionAndLayerIdentity() throws {
        let endpoint = CameraPose2D(centerX: 0.7, zoom: 2)
        let leftTrack = CameraMotionTrack(
            presetId: "push-in",
            keyframes: [CameraMotionKeyframe(
                id: "editor-left", time: duration, pose: endpoint)])
        let rightTrack = CameraMotionTrack(
            presetId: "custom",
            keyframes: [CameraMotionKeyframe(
                id: "editor-right", time: duration, pose: endpoint)])
        var leftLayers = BoardLayerState.standard
        leftLayers.locked = ["Drawing"]
        leftLayers.activeLayer = "Drawing"
        var rightLayers = BoardLayerState.standard
        rightLayers.opacity["Drawing"] = 1
        rightLayers.blendModes["Drawing"] = .normal
        rightLayers.activeLayer = "Color"
        let time = try MediaTime(value: 2, timescale: 1)

        let left = try FrameEvaluator.evaluate(
            document: document(track: leftTrack, layerState: leftLayers),
            at: time)
        let right = try FrameEvaluator.evaluate(
            document: document(track: rightTrack, layerState: rightLayers),
            at: time)

        XCTAssertEqual(left.presentationFraming, right.presentationFraming)
        XCTAssertEqual(left.visibleStrokeIDs, right.visibleStrokeIDs)
        XCTAssertEqual(left.semanticFingerprint, right.semanticFingerprint)
    }

    func testFingerprintChangesWhenRenderSemanticsChange() throws {
        let baseline = try FrameEvaluator.evaluate(
            document: document(), at: .zero)
        var hiddenLayers = BoardLayerState.standard
        hiddenLayers.hidden = ["Drawing"]
        let hidden = try FrameEvaluator.evaluate(
            document: document(layerState: hiddenLayers), at: .zero)

        XCTAssertNotEqual(baseline.visibleStrokeIDs, hidden.visibleStrokeIDs)
        XCTAssertNotEqual(
            baseline.semanticFingerprint,
            hidden.semanticFingerprint)
    }
}
