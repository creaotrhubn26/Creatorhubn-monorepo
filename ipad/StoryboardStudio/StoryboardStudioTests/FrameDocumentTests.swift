import XCTest
@testable import StoryboardStudio

final class FrameDocumentTests: XCTestCase {
    private let duration = try! MediaTime(value: 4, timescale: 1)

    func testInitializationProducesCanonicalImmutableProjection() throws {
        var layers = BoardLayerState.standard
        layers.hidden = ["Notes", "Unknown"]
        let track = CameraMotionTrack(
            presetId: " push-in ",
            keyframes: [
                CameraMotionKeyframe(
                    id: " end ",
                    time: duration,
                    pose: CameraPose2D(centerX: 0.6, zoom: 2)),
                CameraMotionKeyframe(
                    id: " middle ",
                    time: try MediaTime(value: 2, timescale: 1),
                    pose: CameraPose2D(centerX: 0.55, zoom: 1.5)),
            ])

        let document = try FrameDocument(
            frameID: " frame-a ",
            documentIdentity: " source:7 ",
            localDocumentRevision: 3,
            aiSourceRevision: 7,
            shotDuration: duration,
            initialFraming: ShotFramingState(centerX: 2, zoom: 40),
            cameraMotionTrack: track,
            layerState: layers,
            strokeReferences: [
                FrameStrokeReference(id: " pencil ", layer: " "),
                FrameStrokeReference(id: " note ", layer: "Notes"),
            ],
            rasterSourceIdentity: RasterSourceIdentity(
                id: " raster:7 ", revision: 7, coordinateSpace: .viewport),
            rasterPlacementFraming: .standard)

        XCTAssertEqual(document.version, FrameDocument.schemaVersion)
        XCTAssertEqual(document.frameID, "frame-a")
        XCTAssertEqual(document.documentIdentity, "source:7")
        XCTAssertEqual(document.initialFraming.centerX, 1)
        XCTAssertEqual(document.initialFraming.zoom, ShotFramingState.maximumZoom)
        XCTAssertEqual(document.cameraMotionTrack?.presetId, "push-in")
        XCTAssertEqual(
            document.cameraMotionTrack?.keyframes.map(\.id),
            ["middle", "end"])
        XCTAssertEqual(document.strokeReferences, [
            FrameStrokeReference(id: "pencil", layer: "Drawing"),
            FrameStrokeReference(id: "note", layer: "Notes"),
        ])
        XCTAssertEqual(document.layerState.hidden, ["Notes"])
        XCTAssertEqual(document.rasterSourceIdentity?.id, "raster:7")
    }

    func testInitializationRejectsIdentityAndRevisionAmbiguity() throws {
        XCTAssertThrowsError(try FrameDocument(
            frameID: " ", documentIdentity: "source", localDocumentRevision: 0,
            shotDuration: duration, initialFraming: .standard)) {
            XCTAssertEqual(
                $0 as? FrameDocumentValidationError,
                .emptyFrameID)
        }
        XCTAssertThrowsError(try FrameDocument(
            frameID: "frame", documentIdentity: "source",
            localDocumentRevision: -1,
            shotDuration: duration, initialFraming: .standard)) {
            XCTAssertEqual(
                $0 as? FrameDocumentValidationError,
                .negativeLocalDocumentRevision(-1))
        }
        XCTAssertThrowsError(try FrameDocument(
            frameID: "frame", documentIdentity: "source",
            localDocumentRevision: 0,
            shotDuration: duration, initialFraming: .standard,
            strokeReferences: [
                FrameStrokeReference(id: "same", layer: "Drawing"),
                FrameStrokeReference(id: " same ", layer: "Color"),
            ])) {
            XCTAssertEqual(
                $0 as? FrameDocumentValidationError,
                .duplicateStrokeID("same"))
        }
    }

    func testInitializationRejectsInvalidMotionTrack() throws {
        let invalidTrack = CameraMotionTrack(keyframes: [
            CameraMotionKeyframe(
                id: "zero", time: .zero, pose: CameraPose2D()),
        ])

        XCTAssertThrowsError(try FrameDocument(
            frameID: "frame", documentIdentity: "source",
            localDocumentRevision: 0,
            shotDuration: duration,
            initialFraming: .standard,
            cameraMotionTrack: invalidTrack)) {
            XCTAssertEqual(
                $0 as? FrameDocumentValidationError,
                .invalidCameraMotionTrack(.keyframeAtOrBeforeZero("zero")))
        }
    }
}
