import XCTest
@testable import StoryboardStudio

final class FrameDocumentProjectionTests: XCTestCase {
    func testServerCanvasAndWALInputsProduceSameTZeroDocument() throws {
        let stroke = PencilStroke(
            id: "stroke-a",
            points: [],
            inputType: "pencil",
            color: "#111111",
            width: 4,
            opacity: 0.8,
            boardLayer: "Drawing")
        var frame = makeFrame(strokes: [stroke])
        frame.shotDuration = try MediaTime(value: 48, timescale: 24)

        let server = try FrameDocumentProjection.make(frame: frame)
        let active = try FrameDocumentProjection.make(
            frame: frame,
            strokesOverride: [stroke],
            layerStateOverride: frame.layerState,
            framingOverride: frame.shotFraming)

        XCTAssertEqual(server.documentIdentity, active.documentIdentity)
        XCTAssertEqual(server.shotDuration, try MediaTime(value: 2, timescale: 1))
        XCTAssertEqual(server.initialFraming, active.initialFraming)
    }

    func testJSONKeyOrderDoesNotChangeDocumentIdentity() throws {
        let left = "[{\"id\":\"a\",\"points\":[],\"inputType\":\"pencil\",\"color\":\"#000000\",\"width\":3,\"opacity\":1}]"
        let right = "[{\"opacity\":1,\"width\":3,\"color\":\"#000000\",\"inputType\":\"pencil\",\"points\":[],\"id\":\"a\"}]"
        var first = makeFrame(strokes: [])
        var second = first
        first.strokesJSON = left
        second.strokesJSON = right

        XCTAssertEqual(
            try FrameDocumentProjection.make(frame: first).documentIdentity,
            try FrameDocumentProjection.make(frame: second).documentIdentity)
    }

    func testStaleViewportRasterNeverAdoptsCurrentFramingAsPlacement() throws {
        var frame = makeFrame(
            strokes: [],
            imageUrl: "/generated/color.png")
        frame.imageSource = "ai-color-approved"
        frame.aiStoryboardId = "storyboard-a"
        frame.aiSourceFramingFingerprint = "sha256:stale"

        let document = try FrameDocumentProjection.make(frame: frame)

        XCTAssertEqual(
            document.rasterSourceIdentity?.coordinateSpace,
            .viewport)
        XCTAssertNil(document.rasterPlacementFraming)
    }

    func testExcludedFrameImageHasNoRasterOrAIIdentity() throws {
        var frame = makeFrame(
            strokes: [],
            imageUrl: "/generated/old-ai.png")
        frame.imageSource = "ai-color-approved"
        frame.aiSourceRevision = 12
        frame.aiStoryboardId = "storyboard-a"
        frame.aiSourceFramingFingerprint =
            frame.shotFraming?.canonicalFingerprint
        let source = FrameDocumentProjection.effectiveRasterSource(
            for: frame,
            includeFrameImage: false)

        let document = try FrameDocumentProjection.make(
            frame: frame,
            effectiveRasterSource: source)

        XCTAssertFalse(source.includesFrameImage)
        XCTAssertNil(document.rasterSourceIdentity)
        XCTAssertNil(document.rasterPlacementFraming)
        XCTAssertNil(document.aiSourceRevision)
    }

    func testSourceDocumentStaleAIRasterIsExcludedFromTZero() throws {
        var frame = makeFrame(
            strokes: [],
            imageUrl: "/generated/stale-color.png")
        frame.imageSource = "ai-color-approved"
        frame.aiSourceRevision = 12
        frame.aiStoryboardId = "storyboard-a"
        frame.aiSourceFramingFingerprint =
            frame.shotFraming?.canonicalFingerprint
        frame.aiOutputStale = true
        frame.aiOutputStaleReason = "source-document-changed"

        let source = FrameDocumentProjection.effectiveRasterSource(for: frame)
        let document = try FrameDocumentProjection.make(
            frame: frame,
            effectiveRasterSource: source)

        XCTAssertEqual(source, .excluded)
        XCTAssertNil(document.rasterSourceIdentity)
        XCTAssertFalse(document.layerState.hidden.contains("Drawing"))
    }

    func testCameraOnlyStaleAIRasterRemainsCoverageGated() throws {
        var frame = makeFrame(
            strokes: [],
            imageUrl: "/generated/camera-stale-color.png")
        frame.imageSource = "ai-color-approved"
        frame.aiSourceRevision = 12
        frame.aiStoryboardId = "storyboard-a"
        frame.aiRasterPlacementFraming = frame.shotFraming
        frame.aiSourceFramingFingerprint =
            frame.shotFraming?.canonicalFingerprint
        frame.aiOutputStale = true
        frame.aiOutputStaleReason = "shot-framing-changed"

        let source = FrameDocumentProjection.effectiveRasterSource(for: frame)
        let document = try FrameDocumentProjection.make(
            frame: frame,
            effectiveRasterSource: source)

        XCTAssertTrue(source.includesFrameImage)
        XCTAssertEqual(
            document.rasterSourceIdentity?.coordinateSpace,
            .viewport)
        XCTAssertTrue(document.layerState.hidden.contains("Drawing"))
    }

    func testExplicitSourceSpaceOverrideDoesNotInheritOldAIIdentity() throws {
        var frame = makeFrame(
            strokes: [],
            imageUrl: "/generated/old-ai.png")
        frame.imageSource = "ai-color-approved"
        frame.aiSourceRevision = 12
        frame.aiStoryboardId = "storyboard-a"
        frame.aiSourceFramingFingerprint =
            frame.shotFraming?.canonicalFingerprint
        let inherited = try FrameDocumentProjection.make(frame: frame)
        let source = FrameDocumentProjection.effectiveRasterSource(
            for: frame,
            frameImageURLOverride: "/imports/new-pencil.png",
            frameImageIsViewportEncodedOverride: false)

        let overridden = try FrameDocumentProjection.make(
            frame: frame,
            effectiveRasterSource: source)

        XCTAssertEqual(
            overridden.rasterSourceIdentity?.coordinateSpace,
            .sourceSpace)
        XCTAssertNil(overridden.rasterSourceIdentity?.revision)
        XCTAssertNil(overridden.aiSourceRevision)
        XCTAssertNotEqual(
            overridden.rasterSourceIdentity,
            inherited.rasterSourceIdentity)
    }

    func testExplicitViewportOverrideBindsToFrozenFraming() throws {
        var frame = makeFrame(
            strokes: [],
            imageUrl: "/generated/old-ai.png")
        frame.imageSource = "ai-color-approved"
        frame.aiSourceRevision = 12
        let frozenFraming = ShotFramingState(
            centerX: 0.62,
            centerY: 0.41,
            zoom: 2.2,
            aspectRatio: 2.39)
        let source = FrameDocumentProjection.effectiveRasterSource(
            for: frame,
            frameImageURLOverride: "/generated/new-viewport.png",
            frameImageIsViewportEncodedOverride: true)

        let document = try FrameDocumentProjection.make(
            frame: frame,
            framingOverride: frozenFraming,
            effectiveRasterSource: source)

        XCTAssertEqual(
            document.rasterSourceIdentity?.coordinateSpace,
            .viewport)
        XCTAssertNil(document.rasterSourceIdentity?.revision)
        XCTAssertEqual(
            document.rasterPlacementFraming,
            frozenFraming.normalized())
    }

    func testViewportRasterSuppressesDrawingInImmutableSnapshot() throws {
        let drawing = PencilStroke(
            id: "drawing-stroke",
            points: [],
            inputType: "pencil",
            color: "#111111",
            width: 4,
            opacity: 1,
            boardLayer: "Drawing")
        let review = PencilStroke(
            id: "review-stroke",
            points: [],
            inputType: "pencil",
            color: "#cc0000",
            width: 4,
            opacity: 1,
            boardLayer: "Review")
        var frame = makeFrame(
            strokes: [drawing, review],
            imageUrl: "/generated/approved-viewport.png")
        frame.imageSource = "ai-color-approved"
        frame.aiRasterPlacementFraming = frame.shotFraming

        let document = try FrameDocumentProjection.make(frame: frame)
        let snapshot = try FrameEvaluator.evaluate(
            document: document,
            at: .zero)

        XCTAssertTrue(document.layerState.hidden.contains("Drawing"))
        XCTAssertEqual(snapshot.visibleStrokeIDs, ["review-stroke"])
        let pencilOnly = try FrameDocumentProjection.make(
            frame: frame,
            effectiveRasterSource: .excluded)
        XCTAssertFalse(pencilOnly.layerState.hidden.contains("Drawing"))
        XCTAssertNotEqual(
            document.documentIdentity,
            pencilOnly.documentIdentity)
    }

    @MainActor
    func testDirectSourceRasterFallbackRequiresIdentityCamera() throws {
        var frame = makeFrame(
            strokes: [],
            imageUrl: "/imports/source-art.png")
        frame.imageSource = "imported"
        frame.shotFraming = ShotFramingState(
            centerX: 0.5,
            centerY: 0.5,
            zoom: 1,
            rollDegrees: 0,
            aspectRatio: 16.0 / 9.0)

        XCTAssertTrue(FrameRenderCoordinator.allowsDirectRasterFallback(
            for: frame))

        frame.shotFraming = ShotFramingState(
            centerX: 0.5,
            centerY: 0.5,
            zoom: 2,
            rollDegrees: 0,
            aspectRatio: 16.0 / 9.0)
        XCTAssertFalse(FrameRenderCoordinator.allowsDirectRasterFallback(
            for: frame))

        frame.shotFraming = ShotFramingState(
            centerX: 0.5,
            centerY: 0.5,
            zoom: 1,
            rollDegrees: 0,
            aspectRatio: 1)
        XCTAssertFalse(FrameRenderCoordinator.allowsDirectRasterFallback(
            for: frame))

        let noRaster = makeFrame(strokes: [])
        XCTAssertFalse(FrameRenderCoordinator.allowsDirectRasterFallback(
            for: noRaster))
    }

    @MainActor
    func testCoordinatorUsesTheSameTZeroSnapshotAsDirectEvaluation() throws {
        let frame = makeFrame(strokes: [])
        let document = try FrameDocumentProjection.make(frame: frame)
        let direct = try FrameEvaluator.evaluate(
            document: document,
            at: .zero)
        let coordinated = try FrameRenderCoordinator.snapshot(
            for: frame,
            at: .zero)

        XCTAssertEqual(coordinated, direct)
        XCTAssertEqual(
            coordinated.presentationFraming,
            frame.shotFraming?.normalized())
    }

    private func makeFrame(
        strokes: [PencilStroke],
        imageUrl: String? = nil
    ) -> FrameSummary {
        let framing = ShotFramingState(
            centerX: 0.5,
            centerY: 0.5,
            zoom: 1.25,
            aspectRatio: 16.0 / 9.0)
        return FrameSummary(
            id: "frame-a", shotNumber: "1A", detail: "",
            strokesJSON: try? StrokeSerialization.encodeToWebJSON(strokes),
            description: "", notes: nil, shotType: nil, lensMm: nil,
            movement: nil, durationSec: 2, transition: nil,
            focusDepth: nil, timeOfDay: nil, weather: nil, beatTag: nil,
            tags: [], thumbnailDataURL: nil,
            drawingWidth: 1920, drawingHeight: 1080,
            frameStatus: nil, comments: [], updatedAt: nil,
            underlayDataURL: nil, underlayOpacity: nil,
            perspectiveMode: nil, vanishingPoints: nil,
            voiceoverDataURL: nil, imageUrl: imageUrl,
            reviewPriority: nil, reviewDueAt: nil,
            reviewApprovedBy: nil, reviewApprovedAt: nil,
            reviewStarred: nil, reviewAssignee: nil,
            reviewColorLabel: nil, reviewSnoozedUntil: nil,
            shotFraming: framing)
    }
}
