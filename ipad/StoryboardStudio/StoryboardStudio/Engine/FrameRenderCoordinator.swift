import Foundation
import OSLog
import SwiftUI
import UIKit

/// Device-tiered caps for the two expensive offscreen phases: the editable
/// RGBA source texture and the CPU-visible thumbnail readback. Pixel caps are
/// primary because a dimension-only 8192 limit still permits a 256 MiB square
/// texture before base textures, command buffers or image encoding are counted.
struct FrameRenderMemoryPolicy: Sendable, Equatable {
    let maximumTextureDimension: Double
    let maximumSourcePixelCount: Double
    let maximumReadbackPixelCount: Double

    static var current: FrameRenderMemoryPolicy {
        adaptive(physicalMemoryBytes: ProcessInfo.processInfo.physicalMemory)
    }

    static func adaptive(
        physicalMemoryBytes: UInt64
    ) -> FrameRenderMemoryPolicy {
        let gibibyte = UInt64(1_024 * 1_024 * 1_024)
        if physicalMemoryBytes <= 4 * gibibyte {
            return FrameRenderMemoryPolicy(
                maximumTextureDimension: 4_096,
                maximumSourcePixelCount: 8_000_000,
                maximumReadbackPixelCount: 4_000_000
            )
        }
        if physicalMemoryBytes <= 8 * gibibyte {
            return FrameRenderMemoryPolicy(
                maximumTextureDimension: 6_144,
                maximumSourcePixelCount: 12_000_000,
                maximumReadbackPixelCount: 6_000_000
            )
        }
        return FrameRenderMemoryPolicy(
            maximumTextureDimension: 8_192,
            maximumSourcePixelCount: 16_000_000,
            maximumReadbackPixelCount: 8_000_000
        )
    }

    func sourceRenderSize(
        sourceWidth: Double,
        sourceHeight: Double,
        requiredScale: Double,
        maximumTextureDimension overrideDimension: Double? = nil,
        maximumPixelCount overridePixels: Double? = nil
    ) -> ShotFramingSize? {
        guard sourceWidth.isFinite, sourceWidth > 0,
              sourceHeight.isFinite, sourceHeight > 0,
              requiredScale.isFinite, requiredScale > 0 else { return nil }
        let dimensionLimit = max(
            1, overrideDimension ?? maximumTextureDimension)
        let pixelLimit = max(
            1, overridePixels ?? maximumSourcePixelCount)
        let pixelScale = sqrt(pixelLimit / (sourceWidth * sourceHeight))
        let scale = min(
            requiredScale,
            dimensionLimit / sourceWidth,
            dimensionLimit / sourceHeight,
            pixelScale
        )
        guard scale.isFinite, scale > 0 else { return nil }
        return ShotFramingSize(
            width: max(1, floor(sourceWidth * scale)),
            height: max(1, floor(sourceHeight * scale))
        )
    }

    func readbackSize(
        sourceWidth: Int,
        sourceHeight: Int,
        maximumWidth: Double,
        aspectRatio: Double
    ) -> ShotFramingSize? {
        guard sourceWidth > 0, sourceHeight > 0,
              maximumWidth.isFinite, maximumWidth > 0,
              aspectRatio.isFinite, aspectRatio > 0 else { return nil }
        let requestedWidth = min(
            maximumWidth,
            Double(sourceWidth),
            maximumTextureDimension
        )
        let requestedHeight = requestedWidth / aspectRatio
        guard requestedHeight.isFinite, requestedHeight > 0 else { return nil }
        let dimensionScale = min(
            1,
            maximumTextureDimension / max(requestedWidth, requestedHeight)
        )
        let requestedPixels = requestedWidth * requestedHeight
        let pixelScale = requestedPixels > maximumReadbackPixelCount
            ? sqrt(maximumReadbackPixelCount / requestedPixels)
            : 1
        let scale = min(dimensionScale, pixelScale)
        return ShotFramingSize(
            width: max(1, floor(requestedWidth * scale)),
            height: max(1, floor(requestedHeight * scale))
        )
    }
}

// Delt offscreen-motor: re-rendrer frames fra strokesJSON i full oppløsning
// (PDF/PNG-eksport og penselforhåndsvisning) — 280px-thumbs er kun for
// scenelister. Én instans gjenbrukes; canvas resizes per kall.
@MainActor
enum FrameRenderService {
    static let renderer = MetalStrokeRenderer()

    /// Rendrer frame-tegningen offscreen ved gitt bredde (aspekt fra
    /// drawingWidth/Height). Tekst-annotasjoner («PUSH IN») tegnes inn med
    /// CoreText (Metal tegner ikke tekst); underlaget kan tas med for
    /// review-utgaver. nil → ingen strøk / motor utilgjengelig.
    static func image(for frame: FrameSummary, maxWidth: CGFloat,
                      includeUnderlay: Bool = false,
                      includeReviewLayer: Bool = false,
                      includeProductionOverlay: Bool = false,
                      strokesOverride: [PencilStroke]? = nil,
                      includedBoardLayers: Set<String>? = nil,
                      includeFrameImage: Bool = true,
                      includeAnnotations: Bool = true,
                      framingOverride: ShotFramingState? = nil,
                      rasterPlacementFramingOverride: ShotFramingState? = nil,
                      frameImageURLOverride: String? = nil,
                      frameImageIsViewportEncodedOverride: Bool? = nil,
                      rasterSourceIdentityOverride: String? = nil) -> UIImage? {
        guard let renderer else { return nil }
        let strokes: [PencilStroke]
        if let strokesOverride {
            strokes = strokesOverride
        } else if let json = frame.strokesJSON,
                  let decoded = try? StrokeSerialization.decodeFromWebJSON(json) {
            strokes = decoded
        } else {
            strokes = []
        }
        let frameImageURL = frameImageURLOverride ?? frame.imageUrl
        let effectiveRasterSource =
            FrameDocumentProjection.effectiveRasterSource(
                for: frame,
                includeFrameImage: includeFrameImage,
                frameImageURLOverride: frameImageURLOverride,
                frameImageIsViewportEncodedOverride:
                    frameImageIsViewportEncodedOverride)
        let rasterSourceIdentity = rasterSourceIdentityOverride
            ?? effectiveRasterSource.stableIdentity
        let viewportRaster = includeFrameImage
            && (frameImageIsViewportEncodedOverride
                ?? StoryboardFrameImagePolicy.usesViewportCoordinates(frame))
        let isAIViewportEncoded = frameImageIsViewportEncodedOverride
            ?? StoryboardFrameImagePolicy.isAIViewportEncoded(frame)
        // Redlines (lag «Review») er reviewer-markeringer — aldri i
        // PDF/PNG/animatic-leveranser, kun i review-flaten.
        let layerState = frame.layerState ?? .standard
        let drawable = strokes.enumerated().filter {
            let stroke = $0.element
            let layer = stroke.boardLayer ?? "Drawing"
            return (includedBoardLayers?.contains(layer) ?? true)
                && stroke.textAnnotation == nil
                && !layerState.hidden.contains(layer)
                && !(viewportRaster && layer == "Drawing")
                && (includeReviewLayer || layer != "Review")
                && (includeProductionOverlay
                    || stroke.stampInstance?.renderLayer != .productionOverlay)
        }.sorted {
            let lhs = BoardLayers.index(of: $0.element.boardLayer, in: layerState.order)
            let rhs = BoardLayers.index(of: $1.element.boardLayer, in: layerState.order)
            return lhs == rhs ? $0.offset < $1.offset : lhs < rhs
        }.map { entry -> PencilStroke in
            var stroke = entry.element
            let opacity = layerState.opacity[stroke.boardLayer ?? "Drawing"] ?? 1
            stroke.opacity *= opacity
            stroke.brush?.opacity *= opacity
            return stroke
        }
        let frameImage: UIImage?
        if includeFrameImage {
            frameImage = frameImageURLOverride == nil
                ? FrameImageCache.image(for: frame)
                : FrameImageCache.image(for: frameImageURL)
        } else {
            frameImage = nil
        }
        // A document that only contains a review/production overlay still has a
        // valid clean export: the result is an empty paper frame, not `nil`.
        // This distinction matters to PDF/animatic exporters, which must keep
        // shot timing and pagination even when every helper layer is excluded.
        guard (!includeFrameImage || frameImageURL == nil || frameImage != nil),
              frame.drawingWidth > 0,
              !drawable.isEmpty || frameImage != nil || !strokes.isEmpty else { return nil }
        let framing = (framingOverride ?? frame.shotFraming ?? ShotFramingState(
            shotSize: frame.shotType, angle: frame.angle, lensMm: frame.lensMm,
            aspectRatio: frame.drawingWidth / max(1, frame.drawingHeight)
        )).normalized()
        let base: UIImage
        if isAIViewportEncoded, !viewportRaster {
            // The raster belongs to an archived camera transform. Render the
            // editable Pencil source until that viewport is regenerated.
            let sourceSize = vectorSourceRenderSize(
                frame: frame, outputWidth: maxWidth, framing: framing)
            let scale = sourceSize.width / frame.drawingWidth
            renderer.setViewportPreview(cgImage: nil)
            renderer.setEditableBase(cgImage: nil)
            renderer.resizeCanvas(width: Int(sourceSize.width.rounded()),
                                  height: Int(sourceSize.height.rounded()))
            renderer.rebuild(strokes: drawable, scale: scale,
                             layerBlendModes: layerState.blendModes)
            guard let dataURL = renderer.thumbnailDataURL(
                maxWidth: maxWidth, framing: framing),
                  let rendered = decodeDataURL(dataURL) else { return nil }
            base = rendered
        } else {
            // Render the immutable source at crop-aware resolution first,
            // then apply the camera window while downsampling. Device-tiered
            // dimension and pixel caps bound the RGBA working set; Inspector
            // quality still reports any residual close-up limitation.
            let sourceSize = vectorSourceRenderSize(
                frame: frame, outputWidth: maxWidth, framing: framing)
            let scale = sourceSize.width / frame.drawingWidth
            renderer.setViewportPreview(cgImage: nil)
            let editableImage: UIImage?
            if viewportRaster, let frameImage {
                guard let rasterSourceIdentity else { return nil }
                editableImage = StoryboardViewportRasterMapper.sourceSpaceImage(
                    viewportImage: frameImage,
                    frame: frame,
                    framing: rasterPlacementFramingOverride ?? framing,
                    rasterSourceIdentity: rasterSourceIdentity)
            } else {
                editableImage = frameImage
            }
            let memoryPolicy = FrameRenderMemoryPolicy.current
            renderer.setEditableBase(
                cgImage: editableImage?.cgImage,
                maximumDimension: Int(memoryPolicy.maximumTextureDimension),
                maximumPixelCount: Int(memoryPolicy.maximumSourcePixelCount)
            )
            renderer.resizeCanvas(width: Int(sourceSize.width.rounded()),
                                  height: Int(sourceSize.height.rounded()))
            renderer.rebuild(strokes: drawable, scale: scale,
                             layerBlendModes: layerState.blendModes)
            guard let dataURL = renderer.thumbnailDataURL(
                maxWidth: maxWidth, framing: framing),
                  let rendered = decodeDataURL(dataURL) else { return nil }
            base = rendered
        }

        let annotations = includeAnnotations ? strokes.filter {
            let layer = $0.boardLayer ?? "Drawing"
            return ($0.textAnnotation ?? "").isEmpty == false
                && (includedBoardLayers?.contains(layer) ?? true)
                && !layerState.hidden.contains(layer)
                && !(viewportRaster && layer == "Drawing")
                && (includeReviewLayer || layer != "Review")
                && (includeProductionOverlay
                    || $0.stampInstance?.renderLayer != .productionOverlay)
        } : []
        let underlayImage = includeUnderlay ? frame.underlayDataURL.flatMap(decodeDataURL) : nil
        guard underlayImage != nil || !annotations.isEmpty else { return base }
        let size = base.size
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let outputGeometry = ShotFramingGeometry(
            sourceSize: ShotFramingSize(width: frame.drawingWidth,
                                        height: frame.drawingHeight),
            viewportSize: ShotFramingSize(width: size.width, height: size.height),
            state: framing
        )
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            if let underlay = underlayImage {
                let cg = context.cgContext
                cg.saveGState()
                cg.translateBy(x: size.width / 2, y: size.height / 2)
                cg.rotate(by: CGFloat(framing.rollDegrees * .pi / 180))
                let framingScale = max(
                    size.width / CGFloat(frame.drawingWidth),
                    size.height / CGFloat(frame.drawingHeight)
                ) * CGFloat(framing.zoom)
                cg.scaleBy(x: framingScale, y: framingScale)
                cg.translateBy(x: -CGFloat(framing.centerX * frame.drawingWidth),
                               y: -CGFloat(framing.centerY * frame.drawingHeight))
                underlay.draw(in: CGRect(
                    x: 0, y: 0, width: frame.drawingWidth,
                    height: frame.drawingHeight), blendMode: .normal,
                    alpha: CGFloat(frame.underlayOpacity ?? 0.4))
                cg.restoreGState()
            }
            // Multiply: hvitt papir slipper bildet/underlaget gjennom, grafitt biter.
            base.draw(in: CGRect(origin: .zero, size: size),
                      blendMode: .multiply, alpha: 1)
            for stroke in annotations {
                guard let point = stroke.points.first else { continue }
                let style = stroke.annotationStyle
                let text = style == nil
                    ? (stroke.textAnnotation ?? "").uppercased()
                    : (stroke.textAnnotation ?? "")
                let displayScale = outputGeometry?.sourceScale
                    ?? (size.width / frame.drawingWidth)
                let metrics = StoryboardAnnotationLayoutMetrics.resolve(
                    style: style, sourceScale: displayScale)
                let fontSize = CGFloat(metrics.fontSize)
                let attributes: [NSAttributedString.Key: Any] = [
                    .font: UIFont(name: BoardBrand.handwriting, size: fontSize)
                        ?? UIFont.systemFont(ofSize: fontSize),
                    .foregroundColor: style == "note"
                        ? UIColor(red: 0.25, green: 0.22, blue: 0.15, alpha: 1)
                        : UIColor(Color(hex: stroke.color) ?? BoardBrand.accent),
                ]
                let textSize = (text as NSString).size(withAttributes: attributes)
                let mapped = outputGeometry?.viewportPoint(
                    fromSourcePoint: ShotFramingPoint(x: point.x, y: point.y)
                ) ?? ShotFramingPoint(x: point.x * displayScale,
                                      y: point.y * displayScale)
                // Live annotations are children of the camera window: their
                // anchor, scale and glyph orientation all follow crop/roll.
                // Draw in a local, rotated coordinate system so PNG/PDF and
                // the Metal-backed editor cannot diverge on Dutch angles.
                let cg = context.cgContext
                cg.saveGState()
                cg.translateBy(x: mapped.x, y: mapped.y)
                cg.rotate(by: CGFloat(framing.rollDegrees * .pi / 180))
                let origin = CGPoint(x: -textSize.width / 2,
                                     y: -textSize.height / 2)
                // Post-it / snakkeboble: bakgrunnsform bak teksten.
                if style == "note" || style == "bubble" {
                    let pad = CGFloat(metrics.padding)
                    let box = CGRect(x: origin.x - pad, y: origin.y - pad,
                                     width: textSize.width + pad * 2,
                                     height: textSize.height + pad * 2)
                    let path = UIBezierPath(roundedRect: box,
                                            cornerRadius: CGFloat(metrics.cornerRadius))
                    if style == "note" {
                        UIColor(red: 0.96, green: 0.91, blue: 0.75, alpha: 0.95).setFill()
                        path.fill()
                    } else {
                        UIColor.white.setFill()
                        path.fill()
                        UIColor(Color(hex: stroke.color) ?? BoardBrand.accent).setStroke()
                        path.lineWidth = CGFloat(metrics.lineWidth)
                        path.stroke()
                        // Hale nederst til venstre
                        let tail = UIBezierPath()
                        tail.move(to: CGPoint(x: box.minX + box.width * 0.22, y: box.maxY))
                        tail.addLine(to: CGPoint(x: box.minX + box.width * 0.14,
                                                 y: box.maxY
                                                    + CGFloat(metrics.tailLength)))
                        tail.addLine(to: CGPoint(x: box.minX + box.width * 0.34, y: box.maxY))
                        UIColor.white.setFill()
                        tail.fill()
                    }
                }
                (text as NSString).draw(at: origin, withAttributes: attributes)
                cg.restoreGState()
            }
        }
    }

    /// Actual source texture used for a vector-backed export. Keeping this
    /// calculation public to the board lets quality validation report the
    /// real cap instead of inventing infinite Pencil resolution.
    static func vectorSourceRenderSize(
        frame: FrameSummary,
        outputWidth: CGFloat,
        framing: ShotFramingState,
        maximumTextureDimension: CGFloat? = nil,
        maximumPixelCount: Double? = nil
    ) -> ShotFramingSize {
        let policy = FrameRenderMemoryPolicy.current
        let sourceWidth = frame.drawingWidth.isFinite
            ? max(1, frame.drawingWidth) : 1
        let sourceHeight = frame.drawingHeight.isFinite
            ? max(1, frame.drawingHeight) : 1
        let safeOutputWidth = outputWidth.isFinite
            ? max(1, Double(outputWidth)) : 1
        let outputHeight = safeOutputWidth / max(0.1, framing.aspectRatio)
        let requiredScale = max(
            safeOutputWidth / sourceWidth,
            outputHeight / sourceHeight
        ) * max(1, framing.zoom)
        return policy.sourceRenderSize(
            sourceWidth: sourceWidth,
            sourceHeight: sourceHeight,
            requiredScale: requiredScale,
            maximumTextureDimension:
                maximumTextureDimension.map(Double.init),
            maximumPixelCount: maximumPixelCount
        ) ?? ShotFramingSize(width: 1, height: 1)
    }


    /// Fryser det valgte produksjonssteget til en tapsfri leverandørkilde.
    /// Referanseunderlag, onion skin, review, dialog, noter, kamera-overlays
    /// og produksjonsrigg-stamps er utelatt med vilje.
    static func animationSourceDataURL(
        for frame: FrameSummary,
        visibleStrokes: [PencilStroke],
        stage: StoryboardAnimationSourceStage,
        overlayLayers: Set<String>? = nil,
        frameImageURLOverride: String? = nil,
        frameImageIsViewportEncodedOverride: Bool? = nil,
        maxWidth: CGFloat = 1_920
    ) -> String? {
        guard let image = FrameRenderCoordinator.image(
            for: frame, maxWidth: maxWidth,
            strokesOverride: visibleStrokes,
            includedBoardLayers: overlayLayers ?? stage.includedBoardLayers,
            includeAnnotations: false,
            frameImageURLOverride: frameImageURLOverride,
            frameImageIsViewportEncodedOverride:
                frameImageIsViewportEncodedOverride
        ), let png = image.pngData() else { return nil }
        return "data:image/png;base64," + png.base64EncodedString()
    }

    /// Fryser den håndtegnede Drawing-flaten i kildekoordinater. Et eksplisitt
    /// importert Pencil-raster kan komponeres inn; AI-genererte rastere,
    /// fargelag, atmosfære og produksjonsoverlays holdes alltid utenfor.
    static func pencilSourceDataURL(
        for frame: FrameSummary,
        visibleStrokes: [PencilStroke],
        includeImportedFrameImage: Bool = false,
        maxWidth: CGFloat = 1_920
    ) -> String? {
        let sourceFraming = includeImportedFrameImage
            ? ShotFramingState(
                aspectRatio: frame.drawingWidth / max(1, frame.drawingHeight))
            : nil
        guard let image = FrameRenderCoordinator.image(
            for: frame, maxWidth: maxWidth,
            framingOverride: sourceFraming,
            strokesOverride: visibleStrokes,
            includedBoardLayers: ["Drawing"],
            includeFrameImage: includeImportedFrameImage,
            includeAnnotations: false
        ), let png = image.pngData() else { return nil }
        return "data:image/png;base64," + png.base64EncodedString()
    }

    /// PNG-fil i temp for deling (shot-menyens «Eksporter PNG»).
    static func exportPNG(frame: FrameSummary, projectTitle: String) -> URL? {
        guard let image = FrameRenderCoordinator.image(
            for: frame, maxWidth: 1920),
              let png = image.pngData() else { return nil }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(projectTitle.replacingOccurrences(of: "/", with: "-")) \(frame.shotNumber).png")
        do {
            try png.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }
}

/// A stable main-actor render boundary for one immutable frame value.
///
/// The session deliberately owns no editor state. Snapshot sessions freeze
/// evaluated presentation, raster placement, layer visibility and stroke
/// identity without changing the legacy FrameRenderService API.
@MainActor
struct FrameRenderSession {
    let frame: FrameSummary
    let framing: ShotFramingState
    private let rasterPlacementFraming: ShotFramingState
    private let frozenStrokes: [PencilStroke]
    private let effectiveRasterSource:
        FrameDocumentProjection.EffectiveRasterSource
    private let rasterSourceIdentity: String?
    private let snapshotHasBlockingWarnings: Bool

    init?(
        frame: FrameSummary,
        snapshot: FrameRenderSnapshot,
        frozenStrokes: [PencilStroke],
        initialFramingOverride: ShotFramingState?,
        effectiveRasterSource:
            FrameDocumentProjection.EffectiveRasterSource
    ) {
        guard frame.id == snapshot.frameID else { return nil }
        if effectiveRasterSource.inheritsFrameProvenance {
            guard effectiveRasterSource.imageURL
                    == FrameDocumentProjection.normalizedRasterURL(
                        frame.imageUrl),
                  effectiveRasterSource.sourceRevision == frame.aiSourceRevision
            else { return nil }
        }
        guard let projected = try? FrameDocumentProjection.make(
            frame: frame,
            strokesOverride: frozenStrokes,
            layerStateOverride: snapshot.layerState,
            framingOverride: initialFramingOverride,
            localDocumentRevision: snapshot.localDocumentRevision,
            effectiveRasterSource: effectiveRasterSource),
              projected.documentIdentity == snapshot.documentIdentity,
              projected.localDocumentRevision
                == snapshot.localDocumentRevision,
              projected.aiSourceRevision == snapshot.aiSourceRevision,
              projected.rasterSourceIdentity
                == snapshot.rasterSourceIdentity
        else { return nil }

        var frozenFrame = frame
        frozenFrame.layerState = snapshot.layerState
        self.frame = frozenFrame
        framing = snapshot.presentationFraming
        rasterPlacementFraming = snapshot.rasterPlacementFraming
        self.frozenStrokes = frozenStrokes
        self.effectiveRasterSource = effectiveRasterSource
        rasterSourceIdentity = effectiveRasterSource.stableIdentity
        snapshotHasBlockingWarnings = snapshot.hasBlockingWarnings
    }

    func image(
        maxWidth: CGFloat,
        includeUnderlay: Bool = false,
        includeReviewLayer: Bool = false,
        includeProductionOverlay: Bool = false,
        strokesOverride: [PencilStroke]? = nil,
        includedBoardLayers: Set<String>? = nil,
        includeFrameImage: Bool? = nil,
        includeAnnotations: Bool = true,
        frameImageURLOverride: String? = nil,
        frameImageIsViewportEncodedOverride: Bool? = nil
    ) -> UIImage? {
        guard !snapshotHasBlockingWarnings,
              strokesOverride == nil
        else { return nil }
        if let includeFrameImage,
           includeFrameImage != effectiveRasterSource.includesFrameImage {
            return nil
        }
        if let frameImageURLOverride,
           FrameDocumentProjection.normalizedRasterURL(
                frameImageURLOverride) != effectiveRasterSource.imageURL {
            return nil
        }
        if let frameImageIsViewportEncodedOverride,
           frameImageIsViewportEncodedOverride
                != effectiveRasterSource.isViewportEncoded {
            return nil
        }

        return FrameRenderService.image(
            for: frame,
            maxWidth: maxWidth,
            includeUnderlay: includeUnderlay,
            includeReviewLayer: includeReviewLayer,
            includeProductionOverlay: includeProductionOverlay,
            strokesOverride: frozenStrokes,
            includedBoardLayers: includedBoardLayers,
            includeFrameImage: effectiveRasterSource.includesFrameImage,
            includeAnnotations: includeAnnotations,
            framingOverride: framing,
            rasterPlacementFramingOverride: rasterPlacementFraming,
            frameImageURLOverride:
                effectiveRasterSource.inheritsFrameProvenance
                    ? nil : effectiveRasterSource.imageURL,
            frameImageIsViewportEncodedOverride:
                effectiveRasterSource.isViewportEncoded,
            rasterSourceIdentityOverride:
                rasterSourceIdentity
        )
    }
}

/// Creates frame-scoped render sessions from either the compatibility frame or
/// an evaluated immutable snapshot plus its heavy render source.
@MainActor
enum FrameRenderCoordinator {
    private static let signposter = OSSignposter(
        subsystem: "com.creatorhubn.StoryboardStudio",
        category: "FrameRender")

    private static func frozenStrokes(
        for frame: FrameSummary,
        override: [PencilStroke]?
    ) throws -> [PencilStroke] {
        if let override { return override }
        guard let json = frame.strokesJSON else { return [] }
        guard let decoded = try? StrokeSerialization.decodeFromWebJSON(json)
        else { throw FrameDocumentProjectionError.malformedStrokes }
        return decoded
    }

    private static func evaluateSnapshot(
        for frame: FrameSummary,
        at time: MediaTime,
        frozenStrokes: [PencilStroke]?,
        layerStateOverride: BoardLayerState?,
        framingOverride: ShotFramingState?,
        localDocumentRevision: Int,
        effectiveRasterSource:
            FrameDocumentProjection.EffectiveRasterSource
    ) throws -> FrameRenderSnapshot {
        let state = signposter.beginInterval("EvaluateFrame")
        defer { signposter.endInterval("EvaluateFrame", state) }
        let document = try FrameDocumentProjection.make(
            frame: frame,
            strokesOverride: frozenStrokes,
            layerStateOverride: layerStateOverride,
            framingOverride: framingOverride,
            localDocumentRevision: localDocumentRevision,
            effectiveRasterSource: effectiveRasterSource)
        return try FrameEvaluator.evaluate(document: document, at: time)
    }

    /// Canonical entry used by every render target. Projection and evaluation
    /// are measured separately from GPU work so regressions can be attributed
    /// without putting logging or clocks inside FrameEvaluator.
    static func snapshot(
        for frame: FrameSummary,
        at time: MediaTime = .zero,
        strokesOverride: [PencilStroke]? = nil,
        layerStateOverride: BoardLayerState? = nil,
        framingOverride: ShotFramingState? = nil,
        includeFrameImage: Bool = true,
        frameImageURLOverride: String? = nil,
        frameImageIsViewportEncodedOverride: Bool? = nil,
        localDocumentRevision: Int = 0
    ) throws -> FrameRenderSnapshot {
        let effectiveRasterSource =
            FrameDocumentProjection.effectiveRasterSource(
                for: frame,
                includeFrameImage: includeFrameImage,
                frameImageURLOverride: frameImageURLOverride,
                frameImageIsViewportEncodedOverride:
                    frameImageIsViewportEncodedOverride)
        return try evaluateSnapshot(
            for: frame,
            at: time,
            frozenStrokes: strokesOverride,
            layerStateOverride: layerStateOverride,
            framingOverride: framingOverride,
            localDocumentRevision: localDocumentRevision,
            effectiveRasterSource: effectiveRasterSource)
    }

    static func evaluatedSession(
        for frame: FrameSummary,
        at time: MediaTime = .zero,
        strokesOverride: [PencilStroke]? = nil,
        layerStateOverride: BoardLayerState? = nil,
        framingOverride: ShotFramingState? = nil,
        includeFrameImage: Bool = true,
        frameImageURLOverride: String? = nil,
        frameImageIsViewportEncodedOverride: Bool? = nil,
        localDocumentRevision: Int = 0
    ) throws -> FrameRenderSession {
        let preparedStrokes = try frozenStrokes(
            for: frame,
            override: strokesOverride)
        let effectiveRasterSource =
            FrameDocumentProjection.effectiveRasterSource(
                for: frame,
                includeFrameImage: includeFrameImage,
                frameImageURLOverride: frameImageURLOverride,
                frameImageIsViewportEncodedOverride:
                    frameImageIsViewportEncodedOverride)
        let snapshot = try evaluateSnapshot(
            for: frame,
            at: time,
            frozenStrokes: preparedStrokes,
            layerStateOverride: layerStateOverride,
            framingOverride: framingOverride,
            localDocumentRevision: localDocumentRevision,
            effectiveRasterSource: effectiveRasterSource)
        guard let session = FrameRenderSession(
            frame: frame,
            snapshot: snapshot,
            frozenStrokes: preparedStrokes,
            initialFramingOverride: framingOverride,
            effectiveRasterSource: effectiveRasterSource)
        else {
            throw FrameRenderCoordinatorError.frameIdentityMismatch
        }
        return session
    }

    static func image(
        for frame: FrameSummary,
        maxWidth: CGFloat,
        at time: MediaTime = .zero,
        framingOverride: ShotFramingState? = nil,
        includeUnderlay: Bool = false,
        includeReviewLayer: Bool = false,
        includeProductionOverlay: Bool = false,
        strokesOverride: [PencilStroke]? = nil,
        layerStateOverride: BoardLayerState? = nil,
        includedBoardLayers: Set<String>? = nil,
        includeFrameImage: Bool = true,
        includeAnnotations: Bool = true,
        frameImageURLOverride: String? = nil,
        frameImageIsViewportEncodedOverride: Bool? = nil,
        localDocumentRevision: Int = 0,
        legacyThumbnailFallback: Bool = false
    ) -> UIImage? {
        let state = signposter.beginInterval("RenderFrameImage")
        defer { signposter.endInterval("RenderFrameImage", state) }

        // Decode the heavy stroke payload exactly once at the render boundary.
        // The same value feeds projection/identity and the frozen session, so
        // neither path can observe a different mutable compatibility DTO.
        let preparedStrokes: [PencilStroke]
        do {
            preparedStrokes = try frozenStrokes(
                for: frame,
                override: strokesOverride)
        } catch {
            // Without a valid projection there is no trustworthy camera
            // transform against which a stored poster can be verified.
            return nil
        }
        let effectiveRasterSource =
            FrameDocumentProjection.effectiveRasterSource(
                for: frame,
                includeFrameImage: includeFrameImage,
                frameImageURLOverride: frameImageURLOverride,
                frameImageIsViewportEncodedOverride:
                    frameImageIsViewportEncodedOverride)
        let snapshot: FrameRenderSnapshot
        do {
            snapshot = try evaluateSnapshot(
                for: frame,
                at: time,
                frozenStrokes: preparedStrokes,
                layerStateOverride: layerStateOverride,
                framingOverride: framingOverride,
                localDocumentRevision: localDocumentRevision,
                effectiveRasterSource: effectiveRasterSource)
        } catch {
            // Fail closed: a raw poster must never bypass an unevaluated
            // camera transform, even on legacy review/onion surfaces.
            return nil
        }
        guard let session = FrameRenderSession(
            frame: frame,
            snapshot: snapshot,
            frozenStrokes: preparedStrokes,
            initialFramingOverride: framingOverride,
            effectiveRasterSource: effectiveRasterSource)
        else { return nil }
        guard canRender(frame: frame, snapshot: snapshot) else { return nil }
        if let image = session.image(
            maxWidth: maxWidth,
            includeUnderlay: includeUnderlay,
            includeReviewLayer: includeReviewLayer,
            includeProductionOverlay: includeProductionOverlay,
            includedBoardLayers: includedBoardLayers,
            includeAnnotations: includeAnnotations) {
            return image
        }
        // A thumbnail has neither source revision nor an immutable raster
        // identity. It may be shown by an explicitly preview-only policy, but
        // must never escape this coordinator as if it were a t=0 render.
        _ = legacyThumbnailFallback
        return nil
    }

    /// An exact cached source raster may bypass the compositor in UI previews.
    /// Viewport pixels are safe only for their exact authored placement;
    /// source-space pixels require a true identity camera and exact aspect.
    static func allowsDirectRasterFallback(
        for frame: FrameSummary,
        at time: MediaTime = .zero
    ) -> Bool {
        guard let snapshot = try? snapshot(for: frame, at: time),
              canRender(frame: frame, snapshot: snapshot) else { return false }
        return allowsDirectRasterFallback(
            for: frame,
            snapshot: snapshot)
    }

    private static func allowsDirectRasterFallback(
        for frame: FrameSummary,
        snapshot: FrameRenderSnapshot
    ) -> Bool {
        guard !snapshot.hasBlockingWarnings,
              snapshot.visibleStrokeIDs.isEmpty,
              let rasterSource = snapshot.rasterSourceIdentity
        else { return false }

        if rasterSource.coordinateSpace == .viewport {
            return snapshot.presentationFraming.canonicalFingerprint
                == snapshot.rasterPlacementFraming.canonicalFingerprint
        }

        let framing = snapshot.presentationFraming.normalized()
        guard frame.drawingWidth.isFinite,
              frame.drawingHeight.isFinite,
              frame.drawingWidth > 0,
              frame.drawingHeight > 0
        else { return false }
        let sourceAspectRatio = frame.drawingWidth / frame.drawingHeight
        return framing.centerX == 0.5
            && framing.centerY == 0.5
            && framing.zoom == 1
            && framing.rollDegrees == 0
            && framing.aspectRatio == sourceAspectRatio
    }

    /// Applies the same versioned coverage gate to live presentation, stored
    /// video, thumbnails and exports. The evaluator remains pure and
    /// inspectable; the coordinator owns the policy decision to render.
    static func coverageReport(
        frame: FrameSummary,
        snapshot: FrameRenderSnapshot
    ) -> StoryboardCoverageReport {
        let sourceWidth = frame.drawingWidth
        let sourceHeight = frame.drawingHeight
        let outputWidth = sourceWidth
        let outputHeight = outputWidth
            / snapshot.presentationFraming.aspectRatio
        let assetKind: StoryboardCoverageAsset.Kind =
            snapshot.rasterSourceIdentity?.coordinateSpace == .viewport
                ? .viewportRaster : .sourceSpace
        return CoveragePolicyV1.evaluate(StoryboardCoverageInput(
            sourceSize: ShotFramingSize(
                width: sourceWidth, height: sourceHeight),
            outputSize: ShotFramingSize(
                width: outputWidth, height: outputHeight),
            initialFraming: snapshot.presentationFraming,
            asset: StoryboardCoverageAsset(
                kind: assetKind,
                rasterPlacementFraming: assetKind == .viewportRaster
                    ? snapshot.rasterPlacementFraming : nil),
            shotDuration: frame.effectiveShotDuration,
            projectFrameRate: frame.storyboardTiming.projectFrameRate,
            motionTrack: nil,
            criticalSubjectBounds: nil))
    }

    /// Whole-shot gate used before playback, generation and animatic export.
    /// Per-tick coverage remains useful for a static editing surface, but it
    /// cannot prove that every sampled viewport is supported by the source.
    static func motionCoverageReport(
        frame: FrameSummary
    ) -> StoryboardCoverageReport {
        let initial = (frame.shotFraming ?? ShotFramingState(
            shotSize: frame.shotType,
            angle: frame.angle,
            lensMm: frame.lensMm,
            aspectRatio: frame.drawingWidth / max(1, frame.drawingHeight)
        )).normalized()
        let outputHeight = frame.drawingWidth / initial.aspectRatio
        let source = FrameDocumentProjection.effectiveRasterSource(for: frame)
        let track: CameraMotionTrack?
        if frame.hasBlockingCameraMotionDraft {
            // Deliberately feed an unsupported version to the shared policy:
            // invalid/future drafts stay recoverable but classify blocking.
            track = CameraMotionTrack(version: Int.max, enabled: true)
        } else {
            track = frame.renderableCameraMotionTrack
        }
        return CoveragePolicyV1.evaluate(StoryboardCoverageInput(
            sourceSize: ShotFramingSize(
                width: frame.drawingWidth, height: frame.drawingHeight),
            outputSize: ShotFramingSize(
                width: frame.drawingWidth, height: outputHeight),
            initialFraming: initial,
            asset: StoryboardCoverageAsset(
                kind: source.isViewportEncoded
                    ? .viewportRaster : .sourceSpace,
                rasterPlacementFraming: source.isViewportEncoded
                    ? frame.aiRasterPlacementFraming : nil),
            shotDuration: frame.effectiveShotDuration,
            projectFrameRate: frame.storyboardTiming.projectFrameRate,
            motionTrack: track,
            criticalSubjectBounds: nil))
    }

    static func canPlayCameraMotion(frame: FrameSummary) -> Bool {
        guard !frame.hasBlockingCameraMotionDraft else { return false }
        return motionCoverageReport(frame: frame).classification != .blocking
    }

    static func canRender(
        frame: FrameSummary,
        snapshot: FrameRenderSnapshot
    ) -> Bool {
        guard !snapshot.hasBlockingWarnings,
              snapshot.time == .zero || !frame.hasBlockingCameraMotionDraft
        else { return false }
        return coverageReport(frame: frame, snapshot: snapshot)
            .classification != .blocking
    }

}

enum FrameRenderCoordinatorError: Error, Sendable, Equatable {
    case frameIdentityMismatch
}
