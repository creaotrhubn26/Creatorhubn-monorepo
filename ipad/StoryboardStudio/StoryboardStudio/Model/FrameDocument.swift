import Foundation

/// Lightweight reference to a persisted stroke. The render session owns the
/// heavy stroke samples; the evaluator only needs stable identity and layer
/// membership to produce an immutable snapshot for a presentation tick.
struct FrameStrokeReference: Codable, Sendable, Equatable {
    let id: String
    let layer: String

    init(id: String, layer: String = "Drawing") {
        self.id = id
        self.layer = layer
    }
}

enum RasterSourceCoordinateSpace: String, Codable, Sendable, Equatable {
    /// Pixels belong to the complete drawing/source canvas and may be viewed
    /// through any valid local camera window.
    case sourceSpace
    /// Pixels were generated for one frozen viewport and must retain that
    /// placement separately from the presentation camera.
    case viewport
}

/// Stable identity for an optional raster consumed by a frame render session.
/// It deliberately carries no URL or decoded pixels: network and image I/O are
/// outside the deterministic evaluator boundary.
struct RasterSourceIdentity: Codable, Sendable, Equatable {
    let id: String
    let revision: Int?
    let coordinateSpace: RasterSourceCoordinateSpace

    init(
        id: String,
        revision: Int? = nil,
        coordinateSpace: RasterSourceCoordinateSpace
    ) {
        self.id = id
        self.revision = revision
        self.coordinateSpace = coordinateSpace
    }
}

enum FrameDocumentValidationError: Error, Sendable, Equatable {
    case unsupportedVersion(Int)
    case emptyFrameID
    case emptyDocumentIdentity
    case negativeLocalDocumentRevision(Int)
    case negativeAISourceRevision(Int)
    case emptyStrokeID(index: Int)
    case duplicateStrokeID(String)
    case emptyRasterSourceID
    case negativeRasterSourceRevision(Int)
    case invalidCameraMotionTrack(CameraMotionTrackValidationError)
}

/// Frozen, render-relevant projection of one storyboard frame. This type is
/// intentionally independent of FrameSummary, CanvasState, UIKit and storage;
/// adapters create it at the edge and the evaluator consumes it by value.
struct FrameDocument: Sendable, Equatable {
    static let schemaVersion = 1

    let version: Int
    let frameID: String
    let documentIdentity: String
    let localDocumentRevision: Int
    let aiSourceRevision: Int?
    let shotDuration: MediaTime
    let initialFraming: ShotFramingState
    let cameraMotionTrack: CameraMotionTrack?
    let layerState: BoardLayerState
    let strokeReferences: [FrameStrokeReference]
    let rasterSourceIdentity: RasterSourceIdentity?
    let rasterPlacementFraming: ShotFramingState?

    init(
        version: Int = Self.schemaVersion,
        frameID: String,
        documentIdentity: String,
        localDocumentRevision: Int,
        aiSourceRevision: Int? = nil,
        shotDuration: MediaTime,
        initialFraming: ShotFramingState,
        cameraMotionTrack: CameraMotionTrack? = nil,
        layerState: BoardLayerState = .standard,
        strokeReferences: [FrameStrokeReference] = [],
        rasterSourceIdentity: RasterSourceIdentity? = nil,
        rasterPlacementFraming: ShotFramingState? = nil
    ) throws {
        guard version == Self.schemaVersion else {
            throw FrameDocumentValidationError.unsupportedVersion(version)
        }
        let normalizedFrameID = frameID.trimmingCharacters(
            in: .whitespacesAndNewlines)
        guard !normalizedFrameID.isEmpty else {
            throw FrameDocumentValidationError.emptyFrameID
        }
        let normalizedDocumentIdentity = documentIdentity.trimmingCharacters(
            in: .whitespacesAndNewlines)
        guard !normalizedDocumentIdentity.isEmpty else {
            throw FrameDocumentValidationError.emptyDocumentIdentity
        }
        guard localDocumentRevision >= 0 else {
            throw FrameDocumentValidationError.negativeLocalDocumentRevision(
                localDocumentRevision)
        }
        if let aiSourceRevision, aiSourceRevision < 0 {
            throw FrameDocumentValidationError.negativeAISourceRevision(
                aiSourceRevision)
        }

        try CameraMotionTrack.validate(shotDuration: shotDuration)
        let normalizedTrack: CameraMotionTrack?
        do {
            normalizedTrack = try cameraMotionTrack?.normalized(
                for: shotDuration)
        } catch let error as CameraMotionTrackValidationError {
            throw FrameDocumentValidationError.invalidCameraMotionTrack(error)
        }

        var strokeIDs = Set<String>()
        let normalizedStrokeReferences = try strokeReferences.enumerated().map {
            index, reference in
            let id = reference.id.trimmingCharacters(
                in: .whitespacesAndNewlines)
            guard !id.isEmpty else {
                throw FrameDocumentValidationError.emptyStrokeID(index: index)
            }
            guard strokeIDs.insert(id).inserted else {
                throw FrameDocumentValidationError.duplicateStrokeID(id)
            }
            let layer = reference.layer.trimmingCharacters(
                in: .whitespacesAndNewlines)
            return FrameStrokeReference(
                id: id,
                layer: layer.isEmpty ? "Drawing" : layer)
        }

        let normalizedRasterSource: RasterSourceIdentity?
        if let rasterSourceIdentity {
            let id = rasterSourceIdentity.id.trimmingCharacters(
                in: .whitespacesAndNewlines)
            guard !id.isEmpty else {
                throw FrameDocumentValidationError.emptyRasterSourceID
            }
            if let revision = rasterSourceIdentity.revision, revision < 0 {
                throw FrameDocumentValidationError
                    .negativeRasterSourceRevision(revision)
            }
            normalizedRasterSource = RasterSourceIdentity(
                id: id,
                revision: rasterSourceIdentity.revision,
                coordinateSpace: rasterSourceIdentity.coordinateSpace)
        } else {
            normalizedRasterSource = nil
        }

        var normalizedLayers = layerState
        normalizedLayers.normalize()

        self.version = Self.schemaVersion
        self.frameID = normalizedFrameID
        self.documentIdentity = normalizedDocumentIdentity
        self.localDocumentRevision = localDocumentRevision
        self.aiSourceRevision = aiSourceRevision
        self.shotDuration = shotDuration
        self.initialFraming = initialFraming.normalized()
        self.cameraMotionTrack = normalizedTrack
        self.layerState = normalizedLayers
        self.strokeReferences = normalizedStrokeReferences
        self.rasterSourceIdentity = normalizedRasterSource
        self.rasterPlacementFraming = rasterPlacementFraming?.normalized()
    }
}

enum FrameRenderWarningSeverity: String, Codable, Sendable, Equatable {
    case info
    case warning
    case blocking
}

enum FrameRenderWarningCode: String, Codable, Sendable, Equatable {
    /// The caller requested a time after shot end; evaluation used shot end.
    case requestedTimeClamped
    /// A viewport-bound raster cannot be reconstructed without its authored
    /// camera placement. The snapshot remains inspectable but must not render.
    case viewportRasterPlacementMissing
    /// Presentation has moved away from a viewport-bound raster's authored
    /// placement. A later CoveragePolicy decides whether pixels are sufficient.
    case viewportRasterCoverageUnverified
}

/// Localizable presentation text is intentionally not embedded here. Code,
/// severity, field and rational time form a stable machine-readable contract.
struct FrameRenderWarning: Codable, Sendable, Equatable {
    let code: FrameRenderWarningCode
    let severity: FrameRenderWarningSeverity
    let field: String?
    let time: MediaTime?

    init(
        code: FrameRenderWarningCode,
        severity: FrameRenderWarningSeverity,
        field: String? = nil,
        time: MediaTime? = nil
    ) {
        self.code = code
        self.severity = severity
        self.field = field
        self.time = time
    }
}

/// Complete immutable output from evaluating a frame at one rational time.
/// Render targets consume this value; they never read mutable editor state.
struct FrameRenderSnapshot: Sendable, Equatable {
    let frameID: String
    let time: MediaTime
    let documentIdentity: String
    let localDocumentRevision: Int
    let aiSourceRevision: Int?
    let layerState: BoardLayerState
    let presentationFraming: ShotFramingState
    let rasterPlacementFraming: ShotFramingState
    let visibleStrokeIDs: [String]
    let rasterSourceIdentity: RasterSourceIdentity?
    let warnings: [FrameRenderWarning]
    let semanticFingerprint: String

    var hasBlockingWarnings: Bool {
        warnings.contains { $0.severity == .blocking }
    }
}
