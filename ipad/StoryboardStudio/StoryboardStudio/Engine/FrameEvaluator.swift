import CryptoKit
import Foundation

/// Prevalidated, immutable input for display ticks and export frames. Track
/// sorting and validation happen once when the plan is created, never in the
/// render loop.
struct CameraMotionEvaluationPlan: Sendable {
    let initialFraming: ShotFramingState
    let shotDuration: MediaTime
    let normalizedTrack: CameraMotionTrack?

    init(
        initialFraming: ShotFramingState,
        track: CameraMotionTrack?,
        shotDuration: MediaTime
    ) throws {
        try CameraMotionTrack.validate(shotDuration: shotDuration)
        self.initialFraming = initialFraming.normalized()
        self.shotDuration = shotDuration
        normalizedTrack = try track?.normalized(for: shotDuration)
    }

    func pose(at requestedTime: MediaTime) -> CameraPose2D {
        let initialPose = CameraPose2D(shotFraming: initialFraming)
        guard let track = normalizedTrack,
              track.enabled,
              !track.keyframes.isEmpty else {
            return initialPose
        }

        let time = requestedTime.clamped(to: .zero...shotDuration)
        let keyframes = track.keyframes
        let rightIndex = Self.lowerBound(for: time, in: keyframes)

        if rightIndex < keyframes.count,
           keyframes[rightIndex].time == time {
            return keyframes[rightIndex].pose
        }
        guard rightIndex < keyframes.count else {
            return keyframes[keyframes.count - 1].pose
        }

        let right = keyframes[rightIndex]
        let leftTime: MediaTime
        let leftPose: CameraPose2D
        if rightIndex == 0 {
            leftTime = .zero
            leftPose = initialPose
        } else {
            let left = keyframes[rightIndex - 1]
            leftTime = left.time
            leftPose = left.pose
        }

        // Preserve the canonical start/left endpoint exactly. Optional fields
        // such as focusAnchor must not appear before their authored keyframe.
        if time == leftTime { return leftPose }

        if right.easingFromPrevious.kind == .hold {
            return leftPose
        }

        let segmentDuration = right.time.seconds - leftTime.seconds
        guard segmentDuration > 0 else { return right.pose }
        let linearProgress = min(
            1,
            max(0, (time.seconds - leftTime.seconds) / segmentDuration)
        )
        let progress = Self.eased(
            linearProgress,
            kind: right.easingFromPrevious.kind
        )
        return Self.interpolate(from: leftPose, to: right.pose, at: progress)
    }

    func framing(at time: MediaTime) -> ShotFramingState {
        let pose = pose(at: time)
        var result = initialFraming
        result.centerX = pose.centerX
        result.centerY = pose.centerY
        result.zoom = pose.zoom
        result.rollDegrees = pose.rollDegrees
        result.focusAnchorX = pose.focusAnchorX
        result.focusAnchorY = pose.focusAnchorY
        result.normalize()
        return result
    }

    private static func lowerBound(
        for time: MediaTime,
        in keyframes: [CameraMotionKeyframe]
    ) -> Int {
        var lower = 0
        var upper = keyframes.count
        while lower < upper {
            let middle = lower + (upper - lower) / 2
            if keyframes[middle].time < time {
                lower = middle + 1
            } else {
                upper = middle
            }
        }
        return lower
    }

    private static func eased(
        _ progress: Double,
        kind: CameraMotionEasingKind
    ) -> Double {
        switch kind {
        case .linear:
            return progress
        case .easeIn:
            return progress * progress
        case .easeOut:
            let inverse = 1 - progress
            return 1 - inverse * inverse
        case .easeInOut:
            return progress * progress * (3 - 2 * progress)
        case .hold:
            return 0
        }
    }

    private static func interpolate(
        from left: CameraPose2D,
        to right: CameraPose2D,
        at progress: Double
    ) -> CameraPose2D {
        if progress <= 0 { return left }
        if progress >= 1 { return right }

        func linear(_ lhs: Double, _ rhs: Double) -> Double {
            lhs + (rhs - lhs) * progress
        }

        let rollDelta = CameraPose2D.normalizedDegrees(
            right.rollDegrees - left.rollDegrees
        )
        let focusX: Double?
        let focusY: Double?
        switch (
            left.focusAnchorX,
            left.focusAnchorY,
            right.focusAnchorX,
            right.focusAnchorY
        ) {
        case let (leftX?, leftY?, rightX?, rightY?):
            focusX = linear(leftX, rightX)
            focusY = linear(leftY, rightY)
        case (let leftX?, let leftY?, nil, nil):
            focusX = leftX
            focusY = leftY
        case (nil, nil, _?, _?):
            // Focus-anchor presence is discrete. Hold the left state through
            // the segment and adopt the right anchor only at its exact key.
            focusX = nil
            focusY = nil
        default:
            // Plans only contain normalized poses, so partial pairs cannot
            // reach this branch. Fail closed to no anchor if that changes.
            focusX = nil
            focusY = nil
        }

        return CameraPose2D(
            centerX: linear(left.centerX, right.centerX),
            centerY: linear(left.centerY, right.centerY),
            zoom: exp(linear(log(left.zoom), log(right.zoom))),
            rollDegrees: CameraPose2D.normalizedDegrees(
                left.rollDegrees + rollDelta * progress
            ),
            focusAnchorX: focusX,
            focusAnchorY: focusY
        )
    }
}

/// Pure document-time evaluator. It owns no clock, renderer, cache, network or
/// editor state; callers may therefore use the same result for live preview,
/// thumbnails and export.
enum FrameEvaluator {
    static func evaluate(
        document: FrameDocument,
        at requestedTime: MediaTime
    ) throws -> FrameRenderSnapshot {
        let time = requestedTime.clamped(to: .zero...document.shotDuration)
        let plan = try CameraMotionEvaluationPlan(
            initialFraming: document.initialFraming,
            track: document.cameraMotionTrack,
            shotDuration: document.shotDuration)
        let presentationFraming = plan.framing(at: time).normalized()

        var warnings: [FrameRenderWarning] = []
        if requestedTime != time {
            warnings.append(FrameRenderWarning(
                code: .requestedTimeClamped,
                severity: .info,
                field: "time",
                time: requestedTime))
        }

        let rasterPlacement = (
            document.rasterPlacementFraming ?? document.initialFraming
        ).normalized()
        if document.rasterSourceIdentity?.coordinateSpace == .viewport {
            if document.rasterPlacementFraming == nil {
                warnings.append(FrameRenderWarning(
                    code: .viewportRasterPlacementMissing,
                    severity: .blocking,
                    field: "rasterPlacementFraming",
                    time: time))
            } else if rasterPlacement.canonicalFingerprint
                        != presentationFraming.canonicalFingerprint {
                // The evaluator never guesses or stretches missing pixels. A
                // versioned CoveragePolicy will later decide whether the
                // viewport raster's motion plate actually covers this window.
                warnings.append(FrameRenderWarning(
                    code: .viewportRasterCoverageUnverified,
                    severity: .warning,
                    field: "presentationFraming",
                    time: time))
            }
        }

        let visibleStrokeIDs = visibleStrokeIDs(in: document)
        let semanticFingerprint = try semanticFingerprint(
            frameID: document.frameID,
            time: time,
            documentIdentity: document.documentIdentity,
            localDocumentRevision: document.localDocumentRevision,
            aiSourceRevision: document.aiSourceRevision,
            layerState: document.layerState,
            presentationFraming: presentationFraming,
            rasterPlacementFraming: rasterPlacement,
            visibleStrokeIDs: visibleStrokeIDs,
            rasterSourceIdentity: document.rasterSourceIdentity,
            warnings: warnings)

        return FrameRenderSnapshot(
            frameID: document.frameID,
            time: time,
            documentIdentity: document.documentIdentity,
            localDocumentRevision: document.localDocumentRevision,
            aiSourceRevision: document.aiSourceRevision,
            layerState: document.layerState,
            presentationFraming: presentationFraming,
            rasterPlacementFraming: rasterPlacement,
            visibleStrokeIDs: visibleStrokeIDs,
            rasterSourceIdentity: document.rasterSourceIdentity,
            warnings: warnings,
            semanticFingerprint: semanticFingerprint)
    }

    private static func visibleStrokeIDs(
        in document: FrameDocument
    ) -> [String] {
        document.strokeReferences.enumerated()
            .filter { !document.layerState.hidden.contains($0.element.layer) }
            .sorted { lhs, rhs in
                let leftLayer = BoardLayers.index(
                    of: lhs.element.layer,
                    in: document.layerState.order)
                let rightLayer = BoardLayers.index(
                    of: rhs.element.layer,
                    in: document.layerState.order)
                return leftLayer == rightLayer
                    ? lhs.offset < rhs.offset
                    : leftLayer < rightLayer
            }
            .map { $0.element.id }
    }

    private static func semanticFingerprint(
        frameID: String,
        time: MediaTime,
        documentIdentity: String,
        localDocumentRevision: Int,
        aiSourceRevision: Int?,
        layerState: BoardLayerState,
        presentationFraming: ShotFramingState,
        rasterPlacementFraming: ShotFramingState,
        visibleStrokeIDs: [String],
        rasterSourceIdentity: RasterSourceIdentity?,
        warnings: [FrameRenderWarning]
    ) throws -> String {
        let payload = FrameRenderSemanticPayload(
            version: 1,
            frameID: frameID,
            time: time,
            documentIdentity: documentIdentity,
            localDocumentRevision: localDocumentRevision,
            aiSourceRevision: aiSourceRevision,
            layerState: CanonicalLayerState(layerState),
            presentationFraming: CanonicalFraming(presentationFraming),
            rasterPlacementFraming: CanonicalFraming(
                rasterPlacementFraming),
            visibleStrokeIDs: visibleStrokeIDs,
            rasterSourceIdentity: rasterSourceIdentity,
            warnings: warnings)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(payload)
        let digest = SHA256.hash(data: data)
        return "sha256:" + digest.map {
            String(format: "%02x", $0)
        }.joined()
    }
}

private struct FrameRenderSemanticPayload: Encodable {
    let version: Int
    let frameID: String
    let time: MediaTime
    let documentIdentity: String
    let localDocumentRevision: Int
    let aiSourceRevision: Int?
    let layerState: CanonicalLayerState
    let presentationFraming: CanonicalFraming
    let rasterPlacementFraming: CanonicalFraming
    let visibleStrokeIDs: [String]
    let rasterSourceIdentity: RasterSourceIdentity?
    let warnings: [FrameRenderWarning]
}

/// Locks render-affecting layer semantics while excluding editor-only lock and
/// active-selection state. Explicit defaults and omitted defaults hash alike.
private struct CanonicalLayerState: Encodable {
    struct Opacity: Encodable {
        let layer: String
        let value: Double
    }

    struct BlendMode: Encodable {
        let layer: String
        let value: BoardLayerBlendMode
    }

    let version: Int
    let order: [String]
    let hidden: [String]
    let opacity: [Opacity]
    let blendModes: [BlendMode]

    init(_ state: BoardLayerState) {
        var normalized = state
        normalized.normalize()
        version = BoardLayerState.schemaVersion
        order = normalized.order
        hidden = normalized.hidden.sorted()
        opacity = normalized.opacity
            .filter { $0.value != 1 }
            .map { Opacity(layer: $0.key, value: Self.number($0.value)) }
            .sorted { $0.layer < $1.layer }
        blendModes = normalized.blendModes
            .filter { $0.value != .normal }
            .map { BlendMode(layer: $0.key, value: $0.value) }
            .sorted { $0.layer < $1.layer }
    }

    private static func number(_ value: Double) -> Double {
        value == 0 ? 0 : value
    }
}

/// Canonical pixel/production framing identity. Revision and the cached intent
/// fingerprint are editor bookkeeping and intentionally do not affect semantic
/// render identity.
private struct CanonicalFraming: Encodable {
    let version: Int
    let shotSize: String?
    let angle: String?
    let lensMm: Int?
    let centerX: Double
    let centerY: Double
    let zoom: Double
    let rollDegrees: Double
    let aspectRatio: Double
    let focusAnchorX: Double?
    let focusAnchorY: Double?
    let mode: ShotFramingMode

    init(_ framing: ShotFramingState) {
        let state = framing.normalized()
        version = ShotFramingState.schemaVersion
        shotSize = state.shotSize
        angle = state.angle
        lensMm = state.lensMm
        centerX = Self.number(state.centerX)
        centerY = Self.number(state.centerY)
        zoom = Self.number(state.zoom)
        rollDegrees = Self.number(state.rollDegrees)
        aspectRatio = Self.number(state.aspectRatio)
        focusAnchorX = state.focusAnchorX.map(Self.number)
        focusAnchorY = state.focusAnchorY.map(Self.number)
        mode = state.mode
    }

    private static func number(_ value: Double) -> Double {
        value == 0 ? 0 : value
    }
}
