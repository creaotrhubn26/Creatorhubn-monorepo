import CryptoKit
import Foundation

enum FrameDocumentProjectionError: Error, Sendable, Equatable {
    case malformedStrokes
    case identityEncodingFailed
}

/// Adapts the mutable compatibility DTO into the immutable render contract.
/// The projection is also used for active-canvas and WAL overlays, which makes
/// the source of a frame irrelevant to the evaluator at t=0.
enum FrameDocumentProjection {
    /// Exact raster source used by one render request. Explicit overrides never
    /// inherit stale AI provenance from the compatibility frame.
    struct EffectiveRasterSource: Sendable, Equatable {
        let imageURL: String?
        let sourceRevision: Int?
        let isViewportEncoded: Bool
        let inheritsFrameProvenance: Bool

        var includesFrameImage: Bool { imageURL != nil }

        /// Stable decoded-pixel/cache identity. Swift's randomized hashValue
        /// must never decide whether two approved/override rasters can share
        /// a source-space reconstruction.
        var stableIdentity: String? {
            guard let imageURL else { return nil }
            let payload = [
                sourceRevision.map(String.init) ?? "legacy",
                isViewportEncoded ? "viewport" : "source",
                imageURL,
            ].joined(separator: "\u{1F}")
            return "sha256:" + SHA256.hash(data: Data(payload.utf8)).map {
                String(format: "%02x", $0)
            }.joined()
        }

        static let excluded = EffectiveRasterSource(
            imageURL: nil,
            sourceRevision: nil,
            isViewportEncoded: false,
            inheritsFrameProvenance: false)
    }

    static func effectiveRasterSource(
        for frame: FrameSummary,
        includeFrameImage: Bool = true,
        frameImageURLOverride: String? = nil,
        frameImageIsViewportEncodedOverride: Bool? = nil
    ) -> EffectiveRasterSource {
        guard includeFrameImage else { return .excluded }
        let overrideURL = normalizedRasterURL(frameImageURLOverride)
        guard let imageURL = overrideURL ?? normalizedRasterURL(frame.imageUrl)
        else { return .excluded }

        let hasExplicitURL = overrideURL != nil
        let hasExplicitCoordinateSpace =
            frameImageIsViewportEncodedOverride != nil
        let isExplicitOverride =
            hasExplicitURL || hasExplicitCoordinateSpace
        let isViewportEncoded =
            frameImageIsViewportEncodedOverride
                ?? (hasExplicitURL ? false : frameRasterIsViewportBound(frame))
        if !isExplicitOverride,
           isViewportEncoded,
           frame.aiOutputStale,
           frame.aiOutputStaleReason != "shot-framing-changed" {
            // A source-document mutation invalidates the pixels themselves.
            // Camera-only staleness may still pass CoveragePolicy against the
            // archived placement, but no other stale AI raster enters t=0.
            return .excluded
        }
        return EffectiveRasterSource(
            imageURL: imageURL,
            sourceRevision: isExplicitOverride ? nil : frame.aiSourceRevision,
            isViewportEncoded: isViewportEncoded,
            inheritsFrameProvenance: !isExplicitOverride)
    }

    static func normalizedRasterURL(_ rawURL: String?) -> String? {
        let normalized = rawURL?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized?.isEmpty == false ? normalized : nil
    }

    static func make(
        frame: FrameSummary,
        strokesOverride: [PencilStroke]? = nil,
        layerStateOverride: BoardLayerState? = nil,
        framingOverride: ShotFramingState? = nil,
        cameraMotionTrack: CameraMotionTrack? = nil,
        localDocumentRevision: Int = 0,
        effectiveRasterSource: EffectiveRasterSource? = nil
    ) throws -> FrameDocument {
        let strokes: [PencilStroke]
        if let strokesOverride {
            strokes = strokesOverride
        } else if let json = frame.strokesJSON {
            guard let decoded = try? StrokeSerialization.decodeFromWebJSON(json)
            else { throw FrameDocumentProjectionError.malformedStrokes }
            strokes = decoded
        } else {
            strokes = []
        }

        let rasterSource = effectiveRasterSource
            ?? Self.effectiveRasterSource(for: frame)
        var layers = layerStateOverride ?? frame.layerState ?? .standard
        layers.normalize()
        if rasterSource.isViewportEncoded {
            // Approved viewport pixels already contain the authored Drawing
            // layer. Suppress it in the immutable document as well as in the
            // GPU compositor so visible IDs and semantic hashes describe the
            // pixels that will actually be rendered.
            layers.hidden.insert("Drawing")
        }
        let framing = (framingOverride ?? frame.shotFraming ?? ShotFramingState(
            shotSize: frame.shotType,
            angle: frame.angle,
            lensMm: frame.lensMm,
            aspectRatio: frame.drawingWidth / max(1, frame.drawingHeight)
        )).normalized()
        let effectiveMotionTrack =
            cameraMotionTrack ?? frame.renderableCameraMotionTrack
        let rasterProjection = rasterProjection(
            for: frame,
            framing: framing,
            source: rasterSource)
        let identity = try documentIdentity(
            frameID: frame.id,
            duration: frame.effectiveShotDuration,
            framing: framing,
            track: effectiveMotionTrack,
            layers: layers,
            strokes: strokes,
            rasterIdentity: rasterProjection.identity,
            rasterPlacement: rasterProjection.placement)

        return try FrameDocument(
            frameID: frame.id,
            documentIdentity: identity,
            localDocumentRevision: localDocumentRevision,
            aiSourceRevision: rasterSource.sourceRevision,
            shotDuration: frame.effectiveShotDuration,
            initialFraming: framing,
            cameraMotionTrack: effectiveMotionTrack,
            layerState: layers,
            strokeReferences: strokes.map {
                FrameStrokeReference(
                    id: $0.id,
                    layer: $0.boardLayer ?? "Drawing")
            },
            rasterSourceIdentity: rasterProjection.identity,
            rasterPlacementFraming: rasterProjection.placement)
    }

    private static func rasterProjection(
        for frame: FrameSummary,
        framing: ShotFramingState,
        source: EffectiveRasterSource
    ) -> (identity: RasterSourceIdentity?, placement: ShotFramingState?) {
        guard let rawURL = source.imageURL else { return (nil, nil) }
        let coordinateSpace: RasterSourceCoordinateSpace =
            source.isViewportEncoded
            ? .viewport : .sourceSpace
        let identity = RasterSourceIdentity(
            id: digest(Data(rawURL.utf8)),
            revision: source.sourceRevision,
            coordinateSpace: coordinateSpace)

        guard source.isViewportEncoded else { return (identity, framing) }
        guard source.inheritsFrameProvenance else {
            // An explicit viewport render is authored at the exact frozen
            // framing supplied to this projection.
            return (identity, framing)
        }
        if let archived = frame.aiRasterPlacementFraming {
            return (identity, archived.normalized())
        }
        // Legacy approvals only stored a fingerprint. Reconstructing the full
        // transform is safe exactly while that fingerprint still identifies
        // the current canonical t=0 framing.
        if frame.aiSourceFramingFingerprint == framing.canonicalFingerprint {
            return (identity, framing)
        }
        return (identity, nil)
    }

    private static func frameRasterIsViewportBound(
        _ frame: FrameSummary
    ) -> Bool {
        let source = frame.imageSource?.lowercased() ?? ""
        let explicitlyImported = [
            "imported", "uploaded", "captured", "drawn", "placeholder",
        ].contains(source)
        let explicitlyAI = source.hasPrefix("ai-")
            || ["ai", "generated", "ai-generated"].contains(source)
        return !explicitlyImported
            && (explicitlyAI
                || (frame.aiStoryboardId != nil
                    && frame.aiSourceFramingFingerprint != nil))
    }

    private struct IdentityPayload: Encodable {
        let version: Int
        let frameID: String
        let duration: MediaTime
        let framingFingerprint: String
        let motionFingerprint: String?
        let layerOrder: [String]
        let hiddenLayers: [String]
        let layerOpacity: [String: Double]
        let layerBlendModes: [String: String]
        let strokesDigest: String
        let rasterIdentity: RasterSourceIdentity?
        let rasterPlacementFingerprint: String?
    }

    private static func documentIdentity(
        frameID: String,
        duration: MediaTime,
        framing: ShotFramingState,
        track: CameraMotionTrack?,
        layers: BoardLayerState,
        strokes: [PencilStroke],
        rasterIdentity: RasterSourceIdentity?,
        rasterPlacement: ShotFramingState?
    ) throws -> String {
        var normalizedLayers = layers
        normalizedLayers.normalize()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        guard let strokeData = try? encoder.encode(strokes) else {
            throw FrameDocumentProjectionError.identityEncodingFailed
        }
        let payload = IdentityPayload(
            version: 1,
            frameID: frameID,
            duration: duration,
            framingFingerprint: framing.canonicalFingerprint,
            motionFingerprint: try track?.canonicalRenderFingerprint(
                for: duration),
            layerOrder: normalizedLayers.order,
            hiddenLayers: normalizedLayers.hidden.sorted(),
            layerOpacity: normalizedLayers.opacity,
            layerBlendModes: normalizedLayers.blendModes.mapValues(\.rawValue),
            strokesDigest: digest(strokeData),
            rasterIdentity: rasterIdentity,
            rasterPlacementFingerprint:
                rasterPlacement?.canonicalFingerprint)
        guard let payloadData = try? encoder.encode(payload) else {
            throw FrameDocumentProjectionError.identityEncodingFailed
        }
        return digest(payloadData)
    }

    private static func digest(_ data: Data) -> String {
        "sha256:" + SHA256.hash(data: data).map {
            String(format: "%02x", $0)
        }.joined()
    }
}
