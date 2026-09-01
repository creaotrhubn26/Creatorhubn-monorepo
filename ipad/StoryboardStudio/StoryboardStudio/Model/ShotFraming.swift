import Foundation

/// A point in either normalized (0...1) or pixel coordinates. Call-site names
/// identify the coordinate space; keeping the value Foundation-only makes the
/// framing math usable by the Metal renderer, exports and tests alike.
struct ShotFramingPoint: Codable, Sendable, Equatable {
    var x: Double
    var y: Double

    static let center = ShotFramingPoint(x: 0.5, y: 0.5)

    var isFinite: Bool { x.isFinite && y.isFinite }
}

struct ShotFramingSize: Codable, Sendable, Equatable {
    var width: Double
    var height: Double

    var isValid: Bool {
        width.isFinite && height.isFinite && width > 0 && height > 0
    }

    var aspectRatio: Double { width / height }
}

/// Normalized source-texture window used when an imported or generated image
/// does not match the document canvas. The policy is always centered
/// aspect-fill: crop excess pixels, never apply non-uniform scaling.
struct StoryboardImageUVTransform: Sendable, Equatable {
    var offsetX: Double
    var offsetY: Double
    var scaleX: Double
    var scaleY: Double

    static let identity = StoryboardImageUVTransform(
        offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1)
}

enum StoryboardImageAspectPolicy {
    static func aspectFillUVTransform(
        sourceSize: ShotFramingSize,
        destinationSize: ShotFramingSize
    ) -> StoryboardImageUVTransform? {
        guard sourceSize.isValid, destinationSize.isValid else { return nil }
        let sourceAspect = sourceSize.aspectRatio
        let destinationAspect = destinationSize.aspectRatio
        guard sourceAspect.isFinite, destinationAspect.isFinite,
              sourceAspect > 0, destinationAspect > 0 else { return nil }

        if abs(sourceAspect - destinationAspect) < 0.000_001 {
            return .identity
        }
        if sourceAspect > destinationAspect {
            let visibleWidth = destinationAspect / sourceAspect
            return StoryboardImageUVTransform(
                offsetX: (1 - visibleWidth) / 2,
                offsetY: 0,
                scaleX: visibleWidth,
                scaleY: 1)
        }
        let visibleHeight = sourceAspect / destinationAspect
        return StoryboardImageUVTransform(
            offsetX: 0,
            offsetY: (1 - visibleHeight) / 2,
            scaleX: 1,
            scaleY: visibleHeight)
    }
}

/// Shared live/export metrics for text notes and speech bubbles. The camera's
/// true aspect-fill source scale is the single authority, so 9:16, CinemaScope
/// and Dutch-angle previews retain the same typography as PNG/PDF output.
struct StoryboardAnnotationLayoutMetrics: Sendable, Equatable {
    var displayScale: Double
    var fontSize: Double
    var padding: Double
    var cornerRadius: Double
    var lineWidth: Double
    var tailLength: Double

    static func resolve(style: String?, sourceScale: Double) -> Self {
        let scale = sourceScale.isFinite && sourceScale > 0 ? sourceScale : 1
        let decorated = style == "note" || style == "bubble"
        return StoryboardAnnotationLayoutMetrics(
            displayScale: scale,
            fontSize: max(12, (style == nil ? 40 : 30) * scale),
            padding: decorated ? 10 * scale : 0,
            cornerRadius: style == "bubble" ? 10 * scale
                : style == "note" ? 2 * scale : 0,
            lineWidth: style == "bubble" ? 2 * scale : 0,
            tailLength: style == "bubble" ? 14 * scale : 0)
    }
}

struct ShotFramingRect: Codable, Sendable, Equatable {
    var minX: Double
    var minY: Double
    var width: Double
    var height: Double

    var maxX: Double { minX + width }
    var maxY: Double { minY + height }
    var midX: Double { minX + width / 2 }
    var midY: Double { minY + height / 2 }
    var isFinite: Bool {
        minX.isFinite && minY.isFinite && width.isFinite && height.isFinite
    }
    var isEmpty: Bool { !isFinite || width <= 0 || height <= 0 }

    var standardized: ShotFramingRect {
        ShotFramingRect(
            minX: min(minX, maxX),
            minY: min(minY, maxY),
            width: abs(width),
            height: abs(height)
        )
    }

    var corners: [ShotFramingPoint] {
        let rect = standardized
        return [
            ShotFramingPoint(x: rect.minX, y: rect.minY),
            ShotFramingPoint(x: rect.maxX, y: rect.minY),
            ShotFramingPoint(x: rect.maxX, y: rect.maxY),
            ShotFramingPoint(x: rect.minX, y: rect.maxY),
        ]
    }

    func contains(_ point: ShotFramingPoint) -> Bool {
        let rect = standardized
        return point.x >= rect.minX && point.x <= rect.maxX
            && point.y >= rect.minY && point.y <= rect.maxY
    }

    func clampedToUnitSquare() -> ShotFramingRect {
        let rect = standardized
        let left = min(1, max(0, rect.minX))
        let top = min(1, max(0, rect.minY))
        let right = min(1, max(0, rect.maxX))
        let bottom = min(1, max(0, rect.maxY))
        return ShotFramingRect(
            minX: left,
            minY: top,
            width: max(0, right - left),
            height: max(0, bottom - top)
        )
    }
}

enum ShotFramingMode: String, Codable, Sendable, CaseIterable {
    case automatic
    case manual
    case recomposed
}

/// Canonical, non-destructive camera state persisted as a frame's
/// `shotFraming` object. The intent snapshot is deliberately stored together
/// with the transform so undo/sync cannot leave a CU label on a WS viewport.
struct ShotFramingState: Codable, Sendable, Equatable {
    static let schemaVersion = 1
    static let defaultAspectRatio = 16.0 / 9.0
    static let minimumZoom = 1.0
    static let maximumZoom = 16.0

    var version: Int
    var shotSize: String?
    var angle: String?
    var lensMm: Int?
    var centerX: Double
    var centerY: Double
    var zoom: Double
    var rollDegrees: Double
    var aspectRatio: Double
    var focusAnchorX: Double?
    var focusAnchorY: Double?
    var mode: ShotFramingMode
    var intentFingerprint: String?
    var revision: Int

    init(
        version: Int = Self.schemaVersion,
        shotSize: String? = nil,
        angle: String? = nil,
        lensMm: Int? = nil,
        centerX: Double = 0.5,
        centerY: Double = 0.5,
        zoom: Double = 1,
        rollDegrees: Double = 0,
        aspectRatio: Double = Self.defaultAspectRatio,
        focusAnchorX: Double? = nil,
        focusAnchorY: Double? = nil,
        mode: ShotFramingMode = .automatic,
        intentFingerprint: String? = nil,
        revision: Int = 0
    ) {
        self.version = version
        self.shotSize = shotSize
        self.angle = angle
        self.lensMm = lensMm
        self.centerX = centerX
        self.centerY = centerY
        self.zoom = zoom
        self.rollDegrees = rollDegrees
        self.aspectRatio = aspectRatio
        self.focusAnchorX = focusAnchorX
        self.focusAnchorY = focusAnchorY
        self.mode = mode
        self.intentFingerprint = intentFingerprint
        self.revision = revision
        normalize()
    }

    static var standard: ShotFramingState { ShotFramingState() }

    var center: ShotFramingPoint {
        get { ShotFramingPoint(x: centerX, y: centerY) }
        set {
            centerX = newValue.x
            centerY = newValue.y
            normalize()
        }
    }

    var focusAnchor: ShotFramingPoint? {
        get {
            guard let focusAnchorX, let focusAnchorY else { return nil }
            return ShotFramingPoint(x: focusAnchorX, y: focusAnchorY)
        }
        set {
            focusAnchorX = newValue?.x
            focusAnchorY = newValue?.y
            normalize()
        }
    }

    mutating func normalize() {
        version = Self.schemaVersion
        shotSize = Self.clean(shotSize)
        angle = Self.clean(angle)
        lensMm = lensMm.flatMap { $0 > 0 ? $0 : nil }
        centerX = Self.clamp(centerX, fallback: 0.5, lower: 0, upper: 1)
        centerY = Self.clamp(centerY, fallback: 0.5, lower: 0, upper: 1)
        zoom = Self.clamp(
            zoom,
            fallback: Self.minimumZoom,
            lower: Self.minimumZoom,
            upper: Self.maximumZoom
        )
        rollDegrees = Self.normalizedDegrees(rollDegrees)
        aspectRatio = Self.clamp(
            aspectRatio,
            fallback: Self.defaultAspectRatio,
            lower: 0.1,
            upper: 10
        )

        if let x = focusAnchorX, let y = focusAnchorY, x.isFinite, y.isFinite {
            focusAnchorX = Self.canonicalZero(min(1, max(0, x)))
            focusAnchorY = Self.canonicalZero(min(1, max(0, y)))
        } else {
            focusAnchorX = nil
            focusAnchorY = nil
        }

        intentFingerprint = Self.clean(intentFingerprint)
        revision = max(0, revision)
    }

    func normalized() -> ShotFramingState {
        var copy = self
        copy.normalize()
        return copy
    }

    private static func clean(_ value: String?) -> String? {
        let cleaned = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned?.isEmpty == false ? cleaned : nil
    }

    private static func clamp(
        _ value: Double,
        fallback: Double,
        lower: Double,
        upper: Double
    ) -> Double {
        guard value.isFinite else { return fallback }
        return canonicalZero(min(upper, max(lower, value)))
    }

    private static func canonicalZero(_ value: Double) -> Double {
        value == 0 ? 0 : value
    }

    private static func normalizedDegrees(_ value: Double) -> Double {
        guard value.isFinite else { return 0 }
        var result = value.truncatingRemainder(dividingBy: 360)
        if result <= -180 { result += 360 }
        if result > 180 { result -= 360 }
        return canonicalZero(result)
    }

    private static func roundedInt(_ value: Double) -> Int? {
        guard value.isFinite,
              value >= Double(Int.min),
              value <= Double(Int.max)
        else { return nil }
        return Int(value.rounded())
    }

    private static func flooredInt(_ value: Double) -> Int? {
        guard value.isFinite,
              value >= Double(Int.min),
              value <= Double(Int.max)
        else { return nil }
        return Int(value.rounded(.down))
    }

    private enum CodingKeys: String, CodingKey {
        case version
        case shotSize
        case shotType
        case angle
        case lensMm
        case centerX
        case centerY
        case zoom
        case scale
        case rollDegrees
        case rotationDegrees
        case aspectRatio
        case focusAnchorX
        case focusAnchorY
        case mode
        case intentFingerprint
        case revision
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedMode = (try? container.decode(String.self, forKey: .mode))
            .flatMap(ShotFramingMode.init(rawValue:)) ?? .automatic
        let decodedLens = (try? container.decode(Int.self, forKey: .lensMm))
            ?? (try? container.decode(Double.self, forKey: .lensMm))
                .flatMap(Self.roundedInt)
        let decodedRevision = (try? container.decode(Int.self, forKey: .revision))
            ?? (try? container.decode(Double.self, forKey: .revision))
                .flatMap(Self.flooredInt)

        self.init(
            version: (try? container.decode(Int.self, forKey: .version)) ?? 0,
            shotSize: (try? container.decode(String.self, forKey: .shotSize))
                ?? (try? container.decode(String.self, forKey: .shotType)),
            angle: try? container.decode(String.self, forKey: .angle),
            lensMm: decodedLens,
            centerX: (try? container.decode(Double.self, forKey: .centerX)) ?? 0.5,
            centerY: (try? container.decode(Double.self, forKey: .centerY)) ?? 0.5,
            zoom: (try? container.decode(Double.self, forKey: .zoom))
                ?? (try? container.decode(Double.self, forKey: .scale))
                ?? 1,
            rollDegrees: (try? container.decode(Double.self, forKey: .rollDegrees))
                ?? (try? container.decode(Double.self, forKey: .rotationDegrees))
                ?? 0,
            aspectRatio: (try? container.decode(Double.self, forKey: .aspectRatio))
                ?? Self.defaultAspectRatio,
            focusAnchorX: try? container.decode(Double.self, forKey: .focusAnchorX),
            focusAnchorY: try? container.decode(Double.self, forKey: .focusAnchorY),
            mode: decodedMode,
            intentFingerprint: try? container.decode(String.self, forKey: .intentFingerprint),
            revision: decodedRevision ?? 0
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(Self.schemaVersion, forKey: .version)
        try container.encodeIfPresent(shotSize, forKey: .shotSize)
        try container.encodeIfPresent(angle, forKey: .angle)
        try container.encodeIfPresent(lensMm, forKey: .lensMm)
        try container.encode(centerX, forKey: .centerX)
        try container.encode(centerY, forKey: .centerY)
        try container.encode(zoom, forKey: .zoom)
        try container.encode(rollDegrees, forKey: .rollDegrees)
        try container.encode(aspectRatio, forKey: .aspectRatio)
        try container.encodeIfPresent(focusAnchorX, forKey: .focusAnchorX)
        try container.encodeIfPresent(focusAnchorY, forKey: .focusAnchorY)
        try container.encode(mode, forKey: .mode)
        try container.encodeIfPresent(intentFingerprint, forKey: .intentFingerprint)
        try container.encode(revision, forKey: .revision)
    }
}

/// Bridge for the untyped Role Room JSON payload. It mirrors the layer-state
/// helper and deliberately refuses arrays/scalars so malformed server data can
/// never replace a valid local framing state.
enum ShotFramingStateCoding {
    static func object(_ state: ShotFramingState) -> Any? {
        guard let data = try? JSONEncoder().encode(state) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    static func decode(_ object: Any?) -> ShotFramingState? {
        guard let dictionary = object as? [String: Any],
              JSONSerialization.isValidJSONObject(dictionary),
              let data = try? JSONSerialization.data(withJSONObject: dictionary),
              let decoded = try? JSONDecoder().decode(ShotFramingState.self, from: data)
        else { return nil }
        return decoded.normalized()
    }

    /// Strict-concurrency-safe equivalent used by native frame PATCH calls.
    /// Keeping every leaf Sendable avoids passing Foundation's untyped `Any`
    /// through an actor boundary.
    static func sendableObject(_ state: ShotFramingState) -> [String: any Sendable] {
        let state = state.normalized()
        var object: [String: any Sendable] = [
            "version": state.version,
            "centerX": state.centerX,
            "centerY": state.centerY,
            "zoom": state.zoom,
            "rollDegrees": state.rollDegrees,
            "aspectRatio": state.aspectRatio,
            "mode": state.mode.rawValue,
            "revision": state.revision,
        ]
        if let value = state.shotSize { object["shotSize"] = value }
        if let value = state.angle { object["angle"] = value }
        if let value = state.lensMm { object["lensMm"] = value }
        if let value = state.focusAnchorX { object["focusAnchorX"] = value }
        if let value = state.focusAnchorY { object["focusAnchorY"] = value }
        if let value = state.intentFingerprint { object["intentFingerprint"] = value }
        return object
    }
}

extension ShotFramingState {
    var canonicalFingerprint: String {
        let state = normalized()
        return [
            "framing-v1", state.shotSize ?? "", state.angle ?? "",
            state.lensMm.map(String.init) ?? "",
            String(format: "%.6f", state.centerX),
            String(format: "%.6f", state.centerY),
            String(format: "%.6f", state.zoom),
            String(format: "%.4f", state.rollDegrees),
            String(format: "%.6f", state.aspectRatio),
        ].joined(separator: "|")
    }
}

enum ShotSize: String, Codable, Sendable, CaseIterable {
    case extremeWide = "EWS"
    case wide = "WS"
    case medium = "MS"
    case mediumCloseUp = "MCU"
    case closeUp = "CU"
    case extremeCloseUp = "ECU"
    case overTheShoulder = "OTS"
    case pointOfView = "POV"

    init?(metadataValue: String?) {
        guard let metadataValue else { return nil }
        let value = metadataValue
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .uppercased()
        switch value {
        case "EWS", "XWS", "EXTREME WIDE", "EXTREME WIDE SHOT": self = .extremeWide
        case "WS", "WIDE", "WIDE SHOT", "FULL", "FULL SHOT": self = .wide
        case "MS", "MEDIUM", "MEDIUM SHOT": self = .medium
        case "MCU", "MEDIUM CLOSE UP", "MEDIUM CLOSEUP": self = .mediumCloseUp
        case "CU", "CLOSE UP", "CLOSEUP", "CLOSE UP SHOT": self = .closeUp
        case "ECU", "EXTREME CLOSE UP", "EXTREME CLOSEUP": self = .extremeCloseUp
        case "OTS", "OVER THE SHOULDER", "OVER SHOULDER": self = .overTheShoulder
        case "POV", "POINT OF VIEW": self = .pointOfView
        default: return nil
        }
    }
}

struct ShotSizeFramingPreset: Sendable, Equatable {
    let fallbackZoom: Double
    /// A shot-size command must have a visible framing effect even when the
    /// detected subject bounds are broad (for example a background stroke or
    /// a group). This floor expresses the editorial intent independently of
    /// subject-detection confidence.
    let minimumIntentZoom: Double
    let targetSubjectHeight: Double
    let maximumSubjectWidth: Double
    let subjectAnchorY: Double
    let viewportAnchor: ShotFramingPoint
}

enum ShotFramingPresetCatalog {
    static func preset(for shotSize: ShotSize) -> ShotSizeFramingPreset {
        switch shotSize {
        case .extremeWide:
            return ShotSizeFramingPreset(
                fallbackZoom: 1, minimumIntentZoom: 1,
                targetSubjectHeight: 0.28,
                maximumSubjectWidth: 0.35, subjectAnchorY: 0.50,
                viewportAnchor: ShotFramingPoint(x: 0.5, y: 0.54))
        case .wide:
            return ShotSizeFramingPreset(
                fallbackZoom: 1.15, minimumIntentZoom: 1.05,
                targetSubjectHeight: 0.78,
                maximumSubjectWidth: 0.55, subjectAnchorY: 0.48,
                viewportAnchor: ShotFramingPoint(x: 0.5, y: 0.50))
        case .medium:
            return ShotSizeFramingPreset(
                fallbackZoom: 1.7, minimumIntentZoom: 1.35,
                targetSubjectHeight: 1.25,
                maximumSubjectWidth: 0.68, subjectAnchorY: 0.38,
                viewportAnchor: ShotFramingPoint(x: 0.5, y: 0.43))
        case .mediumCloseUp:
            return ShotSizeFramingPreset(
                fallbackZoom: 2.15, minimumIntentZoom: 1.75,
                targetSubjectHeight: 1.65,
                maximumSubjectWidth: 0.72, subjectAnchorY: 0.30,
                viewportAnchor: ShotFramingPoint(x: 0.5, y: 0.40))
        case .closeUp:
            return ShotSizeFramingPreset(
                fallbackZoom: 3, minimumIntentZoom: 2.25,
                targetSubjectHeight: 2.35,
                maximumSubjectWidth: 0.78, subjectAnchorY: 0.22,
                viewportAnchor: ShotFramingPoint(x: 0.5, y: 0.39))
        case .extremeCloseUp:
            return ShotSizeFramingPreset(
                fallbackZoom: 4.5, minimumIntentZoom: 3.25,
                targetSubjectHeight: 4,
                maximumSubjectWidth: 0.90, subjectAnchorY: 0.16,
                viewportAnchor: ShotFramingPoint(x: 0.5, y: 0.47))
        case .overTheShoulder:
            return ShotSizeFramingPreset(
                fallbackZoom: 1.9, minimumIntentZoom: 1.55,
                targetSubjectHeight: 1.55,
                maximumSubjectWidth: 0.72, subjectAnchorY: 0.30,
                viewportAnchor: ShotFramingPoint(x: 0.62, y: 0.41))
        case .pointOfView:
            return ShotSizeFramingPreset(
                fallbackZoom: 1.35, minimumIntentZoom: 1.15,
                targetSubjectHeight: 1,
                maximumSubjectWidth: 0.78, subjectAnchorY: 0.50,
                viewportAnchor: .center)
        }
    }
}

/// Exact affine mapping between immutable source artwork and the camera
/// viewport. Positive roll rotates clockwise in the app's top-left/y-down
/// coordinate system.
struct ShotFramingGeometry: Sendable, Equatable {
    let sourceSize: ShotFramingSize
    let viewportSize: ShotFramingSize
    let state: ShotFramingState

    init?(
        sourceSize: ShotFramingSize,
        viewportSize: ShotFramingSize,
        state: ShotFramingState
    ) {
        guard sourceSize.isValid, viewportSize.isValid else { return nil }
        self.sourceSize = sourceSize
        self.viewportSize = viewportSize
        self.state = state.normalized()
    }

    /// Pixels in the viewport per source pixel, before rotation.
    var sourceScale: Double {
        let aspectFillScale = max(
            viewportSize.width / sourceSize.width,
            viewportSize.height / sourceSize.height
        )
        return aspectFillScale * state.zoom
    }

    var minimumZoomForFullCoverage: Double {
        let radians = state.rollDegrees * .pi / 180
        let absoluteCosine = abs(cos(radians))
        let absoluteSine = abs(sin(radians))
        let aspectFillScale = max(
            viewportSize.width / sourceSize.width,
            viewportSize.height / sourceSize.height
        )
        let widthRequirement = (
            absoluteCosine * viewportSize.width + absoluteSine * viewportSize.height
        ) / (aspectFillScale * sourceSize.width)
        let heightRequirement = (
            absoluteSine * viewportSize.width + absoluteCosine * viewportSize.height
        ) / (aspectFillScale * sourceSize.height)
        return min(
            ShotFramingState.maximumZoom,
            max(ShotFramingState.minimumZoom, widthRequirement, heightRequirement)
        )
    }

    func viewportPoint(fromSourcePoint point: ShotFramingPoint) -> ShotFramingPoint {
        let center = sourceCenterPixels
        let translatedX = point.x - center.x
        let translatedY = point.y - center.y
        let rotated = Self.rotate(
            x: translatedX,
            y: translatedY,
            degrees: state.rollDegrees
        )
        return ShotFramingPoint(
            x: viewportSize.width / 2 + rotated.x * sourceScale,
            y: viewportSize.height / 2 + rotated.y * sourceScale
        )
    }

    func sourcePoint(fromViewportPoint point: ShotFramingPoint) -> ShotFramingPoint {
        let translatedX = (point.x - viewportSize.width / 2) / sourceScale
        let translatedY = (point.y - viewportSize.height / 2) / sourceScale
        let unrotated = Self.rotate(
            x: translatedX,
            y: translatedY,
            degrees: -state.rollDegrees
        )
        let center = sourceCenterPixels
        return ShotFramingPoint(x: center.x + unrotated.x, y: center.y + unrotated.y)
    }

    func viewportNormalizedPoint(
        fromSourceNormalizedPoint point: ShotFramingPoint
    ) -> ShotFramingPoint {
        let pixels = viewportPoint(fromSourcePoint: ShotFramingPoint(
            x: point.x * sourceSize.width,
            y: point.y * sourceSize.height
        ))
        return ShotFramingPoint(
            x: pixels.x / viewportSize.width,
            y: pixels.y / viewportSize.height
        )
    }

    func sourceNormalizedPoint(
        fromViewportNormalizedPoint point: ShotFramingPoint
    ) -> ShotFramingPoint {
        let pixels = sourcePoint(fromViewportPoint: ShotFramingPoint(
            x: point.x * viewportSize.width,
            y: point.y * viewportSize.height
        ))
        return ShotFramingPoint(
            x: pixels.x / sourceSize.width,
            y: pixels.y / sourceSize.height
        )
    }

    var visibleSourcePolygon: [ShotFramingPoint] {
        [
            ShotFramingPoint(x: 0, y: 0),
            ShotFramingPoint(x: viewportSize.width, y: 0),
            ShotFramingPoint(x: viewportSize.width, y: viewportSize.height),
            ShotFramingPoint(x: 0, y: viewportSize.height),
        ].map(sourcePoint(fromViewportPoint:))
    }

    var visibleSourceBounds: ShotFramingRect {
        let polygon = visibleSourcePolygon
        let minX = polygon.map(\.x).min() ?? 0
        let minY = polygon.map(\.y).min() ?? 0
        let maxX = polygon.map(\.x).max() ?? 0
        let maxY = polygon.map(\.y).max() ?? 0
        return ShotFramingRect(
            minX: minX,
            minY: minY,
            width: maxX - minX,
            height: maxY - minY
        )
    }

    /// Fraction of the output viewport that has source artwork behind it.
    /// Polygon clipping keeps this exact for Dutch angles as well as crops.
    var coveredViewportFraction: Double {
        let polygon = visibleSourcePolygon
        let visibleArea = Self.polygonArea(polygon)
        guard visibleArea > 0 else { return 0 }
        let clipped = Self.clip(
            polygon: polygon,
            to: ShotFramingRect(
                minX: 0,
                minY: 0,
                width: sourceSize.width,
                height: sourceSize.height
            )
        )
        return min(1, max(0, Self.polygonArea(clipped) / visibleArea))
    }

    /// Raises zoom enough to avoid exposed canvas corners and then constrains
    /// the camera center. Original artwork is never modified.
    func stateEnsuringFullCoverage() -> ShotFramingState {
        var result = state
        result.zoom = max(result.zoom, minimumZoomForFullCoverage)
        result.normalize()
        guard let expanded = ShotFramingGeometry(
            sourceSize: sourceSize,
            viewportSize: viewportSize,
            state: result
        ) else { return result }
        return expanded.stateClampedToSource()
    }

    func stateClampedToSource() -> ShotFramingState {
        var result = state
        let center = sourceCenterPixels
        let offsets = visibleSourcePolygon.map {
            ShotFramingPoint(x: $0.x - center.x, y: $0.y - center.y)
        }
        guard let minimumX = offsets.map(\.x).min(),
              let maximumX = offsets.map(\.x).max(),
              let minimumY = offsets.map(\.y).min(),
              let maximumY = offsets.map(\.y).max()
        else { return result }

        let lowerX = -minimumX
        let upperX = sourceSize.width - maximumX
        let lowerY = -minimumY
        let upperY = sourceSize.height - maximumY
        let clampedX = lowerX <= upperX
            ? min(upperX, max(lowerX, center.x)) : sourceSize.width / 2
        let clampedY = lowerY <= upperY
            ? min(upperY, max(lowerY, center.y)) : sourceSize.height / 2
        result.centerX = clampedX / sourceSize.width
        result.centerY = clampedY / sourceSize.height
        result.normalize()
        return result
    }

    static func suggestedState(
        for shotSize: ShotSize,
        currentState: ShotFramingState,
        sourceSize: ShotFramingSize,
        viewportSize: ShotFramingSize,
        fullSubjectBounds: ShotFramingRect? = nil,
        focusAnchor: ShotFramingPoint? = nil
    ) -> ShotFramingState {
        guard sourceSize.isValid, viewportSize.isValid else {
            var fallback = currentState.normalized()
            fallback.shotSize = shotSize.rawValue
            return fallback
        }

        let preset = ShotFramingPresetCatalog.preset(for: shotSize)
        var result = currentState.normalized()
        result.shotSize = shotSize.rawValue
        result.aspectRatio = viewportSize.aspectRatio
        result.mode = .automatic

        let subject = fullSubjectBounds?.clampedToUnitSquare()
        if let subject, !subject.isEmpty {
            let aspectFillScale = max(
                viewportSize.width / sourceSize.width,
                viewportSize.height / sourceSize.height
            )
            let zoomForHeight = preset.targetSubjectHeight * viewportSize.height
                / (subject.height * sourceSize.height * aspectFillScale)
            let zoomForWidth = preset.maximumSubjectWidth * viewportSize.width
                / (subject.width * sourceSize.width * aspectFillScale)
            result.zoom = max(
                preset.minimumIntentZoom,
                min(zoomForHeight, zoomForWidth)
            )
        } else {
            result.zoom = preset.fallbackZoom
        }
        result.normalize()

        let resolvedFocus: ShotFramingPoint
        if let focusAnchor, focusAnchor.isFinite {
            resolvedFocus = ShotFramingPoint(
                x: min(1, max(0, focusAnchor.x)),
                y: min(1, max(0, focusAnchor.y))
            )
        } else if let existing = result.focusAnchor {
            resolvedFocus = existing
        } else if let subject, !subject.isEmpty {
            resolvedFocus = ShotFramingPoint(
                x: subject.midX,
                y: subject.minY + subject.height * preset.subjectAnchorY
            )
        } else {
            resolvedFocus = .center
        }
        result.focusAnchor = resolvedFocus

        guard let initialGeometry = ShotFramingGeometry(
            sourceSize: sourceSize,
            viewportSize: viewportSize,
            state: result
        ) else { return result }

        let targetOffset = ShotFramingPoint(
            x: (preset.viewportAnchor.x - 0.5) * viewportSize.width
                / initialGeometry.sourceScale,
            y: (preset.viewportAnchor.y - 0.5) * viewportSize.height
                / initialGeometry.sourceScale
        )
        let sourceOffset = Self.rotate(
            x: targetOffset.x,
            y: targetOffset.y,
            degrees: -result.rollDegrees
        )
        result.centerX = resolvedFocus.x - sourceOffset.x / sourceSize.width
        result.centerY = resolvedFocus.y - sourceOffset.y / sourceSize.height
        result.normalize()

        guard let positionedGeometry = ShotFramingGeometry(
            sourceSize: sourceSize,
            viewportSize: viewportSize,
            state: result
        ) else { return result }
        return positionedGeometry.stateEnsuringFullCoverage()
    }

    private var sourceCenterPixels: ShotFramingPoint {
        ShotFramingPoint(
            x: state.centerX * sourceSize.width,
            y: state.centerY * sourceSize.height
        )
    }

    private static func rotate(
        x: Double,
        y: Double,
        degrees: Double
    ) -> ShotFramingPoint {
        let radians = degrees * .pi / 180
        let cosine = cos(radians)
        let sine = sin(radians)
        return ShotFramingPoint(
            x: x * cosine - y * sine,
            y: x * sine + y * cosine
        )
    }

    private static func polygonArea(_ polygon: [ShotFramingPoint]) -> Double {
        guard polygon.count >= 3 else { return 0 }
        var twiceArea = 0.0
        for index in polygon.indices {
            let next = polygon[(index + 1) % polygon.count]
            twiceArea += polygon[index].x * next.y - next.x * polygon[index].y
        }
        return abs(twiceArea) / 2
    }

    private static func clip(
        polygon: [ShotFramingPoint],
        to rect: ShotFramingRect
    ) -> [ShotFramingPoint] {
        var result = polygon
        result = clip(
            result,
            inside: { $0.x >= rect.minX },
            intersection: { start, end in intersection(start, end, x: rect.minX) }
        )
        result = clip(
            result,
            inside: { $0.x <= rect.maxX },
            intersection: { start, end in intersection(start, end, x: rect.maxX) }
        )
        result = clip(
            result,
            inside: { $0.y >= rect.minY },
            intersection: { start, end in intersection(start, end, y: rect.minY) }
        )
        result = clip(
            result,
            inside: { $0.y <= rect.maxY },
            intersection: { start, end in intersection(start, end, y: rect.maxY) }
        )
        return result
    }

    private static func clip(
        _ polygon: [ShotFramingPoint],
        inside: (ShotFramingPoint) -> Bool,
        intersection: (ShotFramingPoint, ShotFramingPoint) -> ShotFramingPoint
    ) -> [ShotFramingPoint] {
        guard !polygon.isEmpty else { return [] }
        var output: [ShotFramingPoint] = []
        var previous = polygon[polygon.count - 1]
        var previousInside = inside(previous)
        for current in polygon {
            let currentInside = inside(current)
            if currentInside {
                if !previousInside { output.append(intersection(previous, current)) }
                output.append(current)
            } else if previousInside {
                output.append(intersection(previous, current))
            }
            previous = current
            previousInside = currentInside
        }
        return output
    }

    private static func intersection(
        _ start: ShotFramingPoint,
        _ end: ShotFramingPoint,
        x: Double
    ) -> ShotFramingPoint {
        let delta = end.x - start.x
        guard abs(delta) > .ulpOfOne else {
            return ShotFramingPoint(x: x, y: start.y)
        }
        let progress = (x - start.x) / delta
        return ShotFramingPoint(x: x, y: start.y + (end.y - start.y) * progress)
    }

    private static func intersection(
        _ start: ShotFramingPoint,
        _ end: ShotFramingPoint,
        y: Double
    ) -> ShotFramingPoint {
        let delta = end.y - start.y
        guard abs(delta) > .ulpOfOne else {
            return ShotFramingPoint(x: start.x, y: y)
        }
        let progress = (y - start.y) / delta
        return ShotFramingPoint(x: start.x + (end.x - start.x) * progress, y: y)
    }
}

/// Stable identity for the expensive, full-source preview plate. Camera
/// framing is intentionally absent: pan/zoom/roll only changes the affine
/// presentation below and must never trigger another Metal composition.
struct CameraMotionPreviewPlateKey: Sendable, Equatable, Hashable {
    var frameID: String
    var localDocumentRevision: Int
    var sourceUpdatedAt: String?
    var rasterIdentity: String?
    var sourceWidth: Int
    var sourceHeight: Int
    var strokeCount: Int

    init(
        frameID: String,
        localDocumentRevision: Int,
        sourceUpdatedAt: String?,
        rasterIdentity: String?,
        sourceSize: ShotFramingSize,
        strokeCount: Int
    ) {
        self.frameID = frameID
        self.localDocumentRevision = localDocumentRevision
        self.sourceUpdatedAt = sourceUpdatedAt
        self.rasterIdentity = rasterIdentity
        let maximumExactInteger = 9_007_199_254_740_991.0
        sourceWidth = sourceSize.width.isFinite
            ? Int(min(maximumExactInteger, max(0, sourceSize.width)).rounded())
            : 0
        sourceHeight = sourceSize.height.isFinite
            ? Int(min(maximumExactInteger, max(0, sourceSize.height)).rounded())
            : 0
        self.strokeCount = strokeCount
    }
}

/// Exact SwiftUI presentation values for one frozen source plate. The image
/// view is laid out at source dimensions, scaled/rotated around its midpoint,
/// then positioned at `imageCenterInViewport`.
struct CameraMotionPreviewAffineTransform: Sendable, Equatable {
    var sourceSize: ShotFramingSize
    var viewportSize: ShotFramingSize
    var scale: Double
    var rotationDegrees: Double
    var imageCenterInViewport: ShotFramingPoint

    init?(
        sourceSize: ShotFramingSize,
        viewportSize: ShotFramingSize,
        framing: ShotFramingState
    ) {
        guard let geometry = ShotFramingGeometry(
            sourceSize: sourceSize,
            viewportSize: viewportSize,
            state: framing
        ) else { return nil }
        self.sourceSize = sourceSize
        self.viewportSize = viewportSize
        scale = geometry.sourceScale
        rotationDegrees = geometry.state.rollDegrees
        imageCenterInViewport = geometry.viewportPoint(
            fromSourcePoint: ShotFramingPoint(
                x: sourceSize.width / 2,
                y: sourceSize.height / 2
            )
        )
    }

    func viewportPoint(
        fromSourcePoint point: ShotFramingPoint
    ) -> ShotFramingPoint {
        let translatedX = (point.x - sourceSize.width / 2) * scale
        let translatedY = (point.y - sourceSize.height / 2) * scale
        let radians = rotationDegrees * .pi / 180
        let cosine = cos(radians)
        let sine = sin(radians)
        return ShotFramingPoint(
            x: imageCenterInViewport.x
                + translatedX * cosine - translatedY * sine,
            y: imageCenterInViewport.y
                + translatedX * sine + translatedY * cosine
        )
    }
}

/// Snapshot semantics used by both the SwiftUI surface and pure tests: a
/// framing tick changes only `affine`; the immutable plate key remains equal.
struct CameraMotionPreviewSnapshot: Sendable, Equatable {
    var plateKey: CameraMotionPreviewPlateKey
    var affine: CameraMotionPreviewAffineTransform

    init?(
        plateKey: CameraMotionPreviewPlateKey,
        sourceSize: ShotFramingSize,
        viewportSize: ShotFramingSize,
        framing: ShotFramingState
    ) {
        guard let affine = CameraMotionPreviewAffineTransform(
            sourceSize: sourceSize,
            viewportSize: viewportSize,
            framing: framing
        ) else { return nil }
        self.plateKey = plateKey
        self.affine = affine
    }
}

/// Pure composition used by the simultaneous manual camera gestures. Every
/// callback derives from one immutable baseline and all current deltas, so a
/// pinch can never overwrite a rotation/pan callback (or create three undos).
enum ShotFramingInteraction {
    static func state(
        baseline: ShotFramingState,
        panTranslation: ShotFramingSize,
        magnification: Double,
        rotationDegrees: Double,
        sourceSize: ShotFramingSize,
        viewportSize: ShotFramingSize
    ) -> ShotFramingState {
        guard let baselineGeometry = ShotFramingGeometry(
            sourceSize: sourceSize, viewportSize: viewportSize,
            state: baseline) else { return baseline.normalized() }
        let viewportCenter = ShotFramingPoint(
            x: viewportSize.width / 2, y: viewportSize.height / 2)
        let sourceCenter = baselineGeometry.sourcePoint(
            fromViewportPoint: viewportCenter)
        let translatedSource = baselineGeometry.sourcePoint(
            fromViewportPoint: ShotFramingPoint(
                x: viewportCenter.x + panTranslation.width,
                y: viewportCenter.y + panTranslation.height))
        var result = baseline
        result.centerX -= (translatedSource.x - sourceCenter.x) / sourceSize.width
        result.centerY -= (translatedSource.y - sourceCenter.y) / sourceSize.height
        result.zoom = baseline.zoom * max(0.01, magnification)
        result.rollDegrees = baseline.rollDegrees + rotationDegrees
        result.mode = .manual
        guard let composed = ShotFramingGeometry(
            sourceSize: sourceSize, viewportSize: viewportSize,
            state: result) else { return result.normalized() }
        return composed.stateEnsuringFullCoverage()
    }
}

enum ShotFramingQualitySeverity: String, Codable, Sendable, Comparable {
    case warning
    case error

    static func < (
        lhs: ShotFramingQualitySeverity,
        rhs: ShotFramingQualitySeverity
    ) -> Bool {
        lhs == .warning && rhs == .error
    }
}

enum ShotFramingQualityIssueCode: String, Codable, Sendable {
    case invalidDimensions
    case aspectRatioMismatch
    case uncoveredViewport
    case insufficientResolution
    case excessiveUpscale
    case focusOutsideSafeArea
    case protectedContentClipped
}

struct ShotFramingQualityIssue: Codable, Sendable, Equatable {
    var code: ShotFramingQualityIssueCode
    var severity: ShotFramingQualitySeverity
}

struct ShotFramingQualityPolicy: Sendable, Equatable {
    var minimumCoverageFraction: Double = 0.999
    var minimumSourcePixelsPerOutputPixel: Double = 1
    var maximumUpscaleFactor: Double = 2
    var safeAreaInset: Double = 0.05
    var aspectRatioTolerance: Double = 0.01

    static let production = ShotFramingQualityPolicy()
}

struct ShotFramingQualityReport: Sendable, Equatable {
    var coverageFraction: Double
    var sourcePixelsPerOutputPixel: Double
    var issues: [ShotFramingQualityIssue]

    var isAcceptable: Bool { !issues.contains { $0.severity == .error } }
    var hasWarnings: Bool { issues.contains { $0.severity == .warning } }
}

enum ShotFramingQualityValidator {
    static func validate(
        state: ShotFramingState,
        sourceSize: ShotFramingSize,
        outputSize: ShotFramingSize,
        protectedSourceBounds: ShotFramingRect? = nil,
        policy: ShotFramingQualityPolicy = .production
    ) -> ShotFramingQualityReport {
        guard let geometry = ShotFramingGeometry(
            sourceSize: sourceSize,
            viewportSize: outputSize,
            state: state
        ) else {
            return ShotFramingQualityReport(
                coverageFraction: 0,
                sourcePixelsPerOutputPixel: 0,
                issues: [ShotFramingQualityIssue(
                    code: .invalidDimensions,
                    severity: .error
                )]
            )
        }

        let normalizedPolicy = normalized(policy)
        let normalizedState = state.normalized()
        let coverage = geometry.coveredViewportFraction
        let sourcePixelsPerOutputPixel = 1 / geometry.sourceScale
        var issues: [ShotFramingQualityIssue] = []

        let aspectDifference = abs(outputSize.aspectRatio - normalizedState.aspectRatio)
            / normalizedState.aspectRatio
        if aspectDifference > normalizedPolicy.aspectRatioTolerance {
            issues.append(ShotFramingQualityIssue(
                code: .aspectRatioMismatch,
                severity: .warning
            ))
        }

        if coverage < normalizedPolicy.minimumCoverageFraction {
            issues.append(ShotFramingQualityIssue(
                code: .uncoveredViewport,
                severity: .error
            ))
        }

        if sourcePixelsPerOutputPixel < normalizedPolicy.minimumSourcePixelsPerOutputPixel {
            let upscaleFactor = 1 / sourcePixelsPerOutputPixel
            let isExcessive = upscaleFactor > normalizedPolicy.maximumUpscaleFactor
            issues.append(ShotFramingQualityIssue(
                code: isExcessive ? .excessiveUpscale : .insufficientResolution,
                severity: isExcessive ? .error : .warning
            ))
        }

        let inset = normalizedPolicy.safeAreaInset
        let safeArea = ShotFramingRect(
            minX: inset,
            minY: inset,
            width: 1 - inset * 2,
            height: 1 - inset * 2
        )
        if let focus = normalizedState.focusAnchor {
            let viewportFocus = geometry.viewportNormalizedPoint(
                fromSourceNormalizedPoint: focus
            )
            if !safeArea.contains(viewportFocus) {
                issues.append(ShotFramingQualityIssue(
                    code: .focusOutsideSafeArea,
                    severity: .warning
                ))
            }
        }

        if let bounds = protectedSourceBounds?.clampedToUnitSquare(), !bounds.isEmpty {
            let protectedCorners = bounds.corners.map {
                geometry.viewportNormalizedPoint(fromSourceNormalizedPoint: $0)
            }
            if protectedCorners.contains(where: { !safeArea.contains($0) }) {
                issues.append(ShotFramingQualityIssue(
                    code: .protectedContentClipped,
                    severity: .error
                ))
            }
        }

        return ShotFramingQualityReport(
            coverageFraction: coverage,
            sourcePixelsPerOutputPixel: sourcePixelsPerOutputPixel,
            issues: issues
        )
    }

    private static func normalized(
        _ policy: ShotFramingQualityPolicy
    ) -> ShotFramingQualityPolicy {
        var result = policy
        result.minimumCoverageFraction = result.minimumCoverageFraction.isFinite
            ? min(1, max(0, result.minimumCoverageFraction)) : 0.999
        result.minimumSourcePixelsPerOutputPixel =
            result.minimumSourcePixelsPerOutputPixel.isFinite
            ? max(.leastNonzeroMagnitude, result.minimumSourcePixelsPerOutputPixel) : 1
        result.maximumUpscaleFactor = result.maximumUpscaleFactor.isFinite
            ? max(1, result.maximumUpscaleFactor) : 2
        result.safeAreaInset = result.safeAreaInset.isFinite
            ? min(0.49, max(0, result.safeAreaInset)) : 0.05
        result.aspectRatioTolerance = result.aspectRatioTolerance.isFinite
            ? max(0, result.aspectRatioTolerance) : 0.01
        return result
    }
}
