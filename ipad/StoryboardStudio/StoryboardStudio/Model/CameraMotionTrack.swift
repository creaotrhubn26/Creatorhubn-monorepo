import CryptoKit
import Foundation

enum CameraPose2DValidationError: Error, Sendable, Equatable {
    case nonFinite(field: String)
    case incompleteFocusAnchor
}

/// A viewport pose after t=0. Shot size, aspect ratio, physical angle and lens
/// remain shot-level metadata and are intentionally not interpolated in v1.
struct CameraPose2D: Codable, Sendable, Equatable {
    var centerX: Double
    var centerY: Double
    var zoom: Double
    var rollDegrees: Double
    var focusAnchorX: Double?
    var focusAnchorY: Double?

    init(
        centerX: Double = 0.5,
        centerY: Double = 0.5,
        zoom: Double = 1,
        rollDegrees: Double = 0,
        focusAnchorX: Double? = nil,
        focusAnchorY: Double? = nil
    ) {
        self.centerX = centerX
        self.centerY = centerY
        self.zoom = zoom
        self.rollDegrees = rollDegrees
        self.focusAnchorX = focusAnchorX
        self.focusAnchorY = focusAnchorY
    }

    init(shotFraming: ShotFramingState) {
        let framing = shotFraming.normalized()
        self.init(
            centerX: framing.centerX,
            centerY: framing.centerY,
            zoom: framing.zoom,
            rollDegrees: framing.rollDegrees,
            focusAnchorX: framing.focusAnchorX,
            focusAnchorY: framing.focusAnchorY
        )
    }

    var focusAnchor: ShotFramingPoint? {
        guard let focusAnchorX, let focusAnchorY else { return nil }
        return ShotFramingPoint(x: focusAnchorX, y: focusAnchorY)
    }

    func normalized() throws -> CameraPose2D {
        guard centerX.isFinite else {
            throw CameraPose2DValidationError.nonFinite(field: "centerX")
        }
        guard centerY.isFinite else {
            throw CameraPose2DValidationError.nonFinite(field: "centerY")
        }
        guard zoom.isFinite else {
            throw CameraPose2DValidationError.nonFinite(field: "zoom")
        }
        guard rollDegrees.isFinite else {
            throw CameraPose2DValidationError.nonFinite(field: "rollDegrees")
        }
        guard (focusAnchorX == nil) == (focusAnchorY == nil) else {
            throw CameraPose2DValidationError.incompleteFocusAnchor
        }
        if let focusAnchorX, !focusAnchorX.isFinite {
            throw CameraPose2DValidationError.nonFinite(
                field: "focusAnchorX"
            )
        }
        if let focusAnchorY, !focusAnchorY.isFinite {
            throw CameraPose2DValidationError.nonFinite(
                field: "focusAnchorY"
            )
        }

        return CameraPose2D(
            centerX: Self.canonicalizedZero(min(1, max(0, centerX))),
            centerY: Self.canonicalizedZero(min(1, max(0, centerY))),
            zoom: min(
                ShotFramingState.maximumZoom,
                max(ShotFramingState.minimumZoom, zoom)
            ),
            rollDegrees: Self.normalizedDegrees(rollDegrees),
            focusAnchorX: focusAnchorX.map {
                Self.canonicalizedZero(min(1, max(0, $0)))
            },
            focusAnchorY: focusAnchorY.map {
                Self.canonicalizedZero(min(1, max(0, $0)))
            }
        )
    }

    func applying(to shotFraming: ShotFramingState) throws -> ShotFramingState {
        let pose = try normalized()
        var result = shotFraming.normalized()
        result.centerX = pose.centerX
        result.centerY = pose.centerY
        result.zoom = pose.zoom
        result.rollDegrees = pose.rollDegrees
        result.focusAnchorX = pose.focusAnchorX
        result.focusAnchorY = pose.focusAnchorY
        result.normalize()
        return result
    }

    static func canonicalizedZero(_ value: Double) -> Double {
        value == 0 ? 0 : value
    }

    static func normalizedDegrees(_ value: Double) -> Double {
        var result = value.truncatingRemainder(dividingBy: 360)
        if result <= -180 { result += 360 }
        if result > 180 { result -= 360 }
        return result == 0 ? 0 : result
    }
}

enum CameraMotionMode: String, Codable, Sendable, CaseIterable {
    case keyframed
    case performed
}

enum CameraMotionEasingKind: String, Codable, Sendable, CaseIterable {
    case linear
    case easeIn
    case easeOut
    case easeInOut
    case hold
}

struct CameraMotionEasing: Codable, Sendable, Equatable {
    var kind: CameraMotionEasingKind

    static let linear = CameraMotionEasing(kind: .linear)
}

struct CameraMotionKeyframe: Codable, Sendable, Equatable, Identifiable {
    var id: String
    var time: MediaTime
    var pose: CameraPose2D
    var easingFromPrevious: CameraMotionEasing

    init(
        id: String,
        time: MediaTime,
        pose: CameraPose2D,
        easingFromPrevious: CameraMotionEasing = .linear
    ) {
        self.id = id
        self.time = time
        self.pose = pose
        self.easingFromPrevious = easingFromPrevious
    }
}

enum CameraMotionTrackValidationError: Error, Sendable, Equatable {
    case unsupportedVersion(Int)
    case invalidShotDuration
    case shotDurationExceedsLimit
    case tooManyKeyframes(Int)
    case emptyKeyframeID(index: Int)
    case keyframeIDTooLong(id: String, maximumUTF16Length: Int)
    case presetIDTooLong(maximumUTF16Length: Int)
    case keyframeTimescaleExceedsLimit(
        id: String,
        timescale: Int32,
        maximumTimescale: Int32
    )
    case duplicateKeyframeID(String)
    case keyframeAtOrBeforeZero(String)
    case keyframeAfterShotDuration(String)
    case duplicateKeyframeTime(MediaTime)
    case retimedKeyframeTimeUnrepresentable(String)
    case invalidPose(
        keyframeID: String,
        reason: CameraPose2DValidationError
    )
}

struct CameraMotionTrack: Codable, Sendable, Equatable {
    static let schemaVersion = 1
    static let maximumKeyframeCount = 64
    /// JavaScript validates String.length, which counts UTF-16 code units.
    /// Using utf16.count here keeps emoji/non-BMP identifiers contract-exact.
    static let maximumKeyframeIdentifierUTF16Length = 128
    static let maximumPresetIdentifierUTF16Length = 128
    static let maximumKeyframeTimeTimescale: Int32 = 1_000_000
    static let maximumDurationSeconds: Int64 = 600

    var version: Int
    var enabled: Bool
    var mode: CameraMotionMode
    var presetId: String?
    var keyframes: [CameraMotionKeyframe]

    init(
        version: Int = Self.schemaVersion,
        enabled: Bool = true,
        mode: CameraMotionMode = .keyframed,
        presetId: String? = nil,
        keyframes: [CameraMotionKeyframe] = []
    ) {
        self.version = version
        self.enabled = enabled
        self.mode = mode
        self.presetId = presetId
        self.keyframes = keyframes
    }

    func normalized(for shotDuration: MediaTime) throws -> CameraMotionTrack {
        try Self.validate(shotDuration: shotDuration)
        guard version == Self.schemaVersion else {
            throw CameraMotionTrackValidationError.unsupportedVersion(version)
        }
        guard keyframes.count <= Self.maximumKeyframeCount else {
            throw CameraMotionTrackValidationError.tooManyKeyframes(
                keyframes.count
            )
        }

        let cleanedPreset = presetId?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let cleanedPreset,
           cleanedPreset.utf16.count
            > Self.maximumPresetIdentifierUTF16Length {
            throw CameraMotionTrackValidationError.presetIDTooLong(
                maximumUTF16Length:
                    Self.maximumPresetIdentifierUTF16Length
            )
        }

        var normalizedKeyframes: [CameraMotionKeyframe] = []
        normalizedKeyframes.reserveCapacity(keyframes.count)
        var ids = Set<String>()
        var times = Set<MediaTime>()

        for (index, keyframe) in keyframes.enumerated() {
            let id = keyframe.id.trimmingCharacters(
                in: .whitespacesAndNewlines
            )
            guard !id.isEmpty else {
                throw CameraMotionTrackValidationError.emptyKeyframeID(
                    index: index
                )
            }
            guard id.utf16.count
                    <= Self.maximumKeyframeIdentifierUTF16Length else {
                throw CameraMotionTrackValidationError.keyframeIDTooLong(
                    id: id,
                    maximumUTF16Length:
                        Self.maximumKeyframeIdentifierUTF16Length
                )
            }
            guard ids.insert(id).inserted else {
                throw CameraMotionTrackValidationError.duplicateKeyframeID(id)
            }
            guard keyframe.time.timescale
                    <= Self.maximumKeyframeTimeTimescale else {
                throw CameraMotionTrackValidationError
                    .keyframeTimescaleExceedsLimit(
                        id: id,
                        timescale: keyframe.time.timescale,
                        maximumTimescale:
                            Self.maximumKeyframeTimeTimescale
                    )
            }
            guard keyframe.time > .zero else {
                throw CameraMotionTrackValidationError
                    .keyframeAtOrBeforeZero(id)
            }
            guard keyframe.time <= shotDuration else {
                throw CameraMotionTrackValidationError
                    .keyframeAfterShotDuration(id)
            }
            guard times.insert(keyframe.time).inserted else {
                throw CameraMotionTrackValidationError
                    .duplicateKeyframeTime(keyframe.time)
            }

            let pose: CameraPose2D
            do {
                pose = try keyframe.pose.normalized()
            } catch let error as CameraPose2DValidationError {
                throw CameraMotionTrackValidationError.invalidPose(
                    keyframeID: id,
                    reason: error
                )
            }
            normalizedKeyframes.append(CameraMotionKeyframe(
                id: id,
                time: keyframe.time,
                pose: pose,
                easingFromPrevious: keyframe.easingFromPrevious
            ))
        }

        normalizedKeyframes.sort { $0.time < $1.time }

        return CameraMotionTrack(
            version: Self.schemaVersion,
            enabled: enabled,
            mode: mode,
            presetId: cleanedPreset?.isEmpty == false ? cleanedPreset : nil,
            keyframes: normalizedKeyframes
        )
    }

    /// The canonical t=0 pose is owned by shotFraming, never duplicated as a
    /// motion keyframe. Keeping this as a computed value prevents the start of
    /// a move from drifting away from the still-frame render contract.
    func startPose(
        initialFraming: ShotFramingState
    ) throws -> CameraPose2D {
        try CameraPose2D(shotFraming: initialFraming).normalized()
    }

    /// Returns the evaluated pose at shot end. A disabled/empty track is
    /// static; otherwise the final authored keyframe persists through the end.
    func endPose(
        initialFraming: ShotFramingState,
        for shotDuration: MediaTime
    ) throws -> CameraPose2D {
        let start = try startPose(initialFraming: initialFraming)
        let track = try normalized(for: shotDuration)
        guard track.enabled, let last = track.keyframes.last else {
            return start
        }
        return last.pose
    }

    /// Creates or updates the single exact shot-end keyframe. Existing
    /// intermediate keys and an existing endpoint's editor identity/easing are
    /// preserved. A newly authored endpoint activates the track because the
    /// edit itself is an explicit motion intent.
    func upsertingEndPose(
        _ pose: CameraPose2D,
        for shotDuration: MediaTime,
        easingFromPrevious: CameraMotionEasing? = nil
    ) throws -> CameraMotionTrack {
        var track = try normalized(for: shotDuration)
        let pose = try pose.normalized()

        if let endpointIndex = track.keyframes.firstIndex(where: {
            $0.time == shotDuration
        }) {
            track.keyframes[endpointIndex].pose = pose
            if let easingFromPrevious {
                track.keyframes[endpointIndex].easingFromPrevious =
                    easingFromPrevious
            }
        } else {
            guard track.keyframes.count < Self.maximumKeyframeCount else {
                throw CameraMotionTrackValidationError.tooManyKeyframes(
                    track.keyframes.count + 1
                )
            }
            track.keyframes.append(CameraMotionKeyframe(
                id: track.availableEndKeyframeID(),
                time: shotDuration,
                pose: pose,
                easingFromPrevious: easingFromPrevious ?? .linear
            ))
        }
        track.enabled = true
        return try track.normalized(for: shotDuration)
    }

    /// Stretches or compresses every authored key proportionally when a shot's
    /// duration changes. The rational multiplication is reduced before any
    /// integer products are formed and never rounds to a timeline grid. If the
    /// exact result cannot be represented by MediaTime, the edit fails closed.
    func retimedProportionally(
        from oldDuration: MediaTime,
        to newDuration: MediaTime
    ) throws -> CameraMotionTrack {
        try Self.validate(shotDuration: oldDuration)
        try Self.validate(shotDuration: newDuration)
        let track = try normalized(for: oldDuration)
        let keyframes = try track.keyframes.map { keyframe in
            CameraMotionKeyframe(
                id: keyframe.id,
                time: try Self.proportionalTime(
                    keyframe.time,
                    from: oldDuration,
                    to: newDuration,
                    keyframeID: keyframe.id
                ),
                pose: keyframe.pose,
                easingFromPrevious: keyframe.easingFromPrevious
            )
        }
        return try CameraMotionTrack(
            version: track.version,
            enabled: track.enabled,
            mode: track.mode,
            presetId: track.presetId,
            keyframes: keyframes
        ).normalized(for: newDuration)
    }

    /// Canonical render identity excludes editor-only keyframe IDs and preset
    /// labels, while retaining every value that can affect evaluated pixels.
    func canonicalRenderData(for shotDuration: MediaTime) throws -> Data {
        let track = try normalized(for: shotDuration)
        let payload = CameraMotionRenderIdentity(
            version: track.version,
            enabled: track.enabled,
            mode: track.mode,
            shotDuration: shotDuration,
            keyframes: track.keyframes.map {
                CameraMotionRenderKeyframe(
                    time: $0.time,
                    pose: $0.pose,
                    easingFromPrevious: $0.easingFromPrevious
                )
            }
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(payload)
    }

    func canonicalRenderFingerprint(
        for shotDuration: MediaTime
    ) throws -> String {
        let digest = SHA256.hash(
            data: try canonicalRenderData(for: shotDuration)
        )
        return "sha256:" + digest.map {
            String(format: "%02x", $0)
        }.joined()
    }

    static func validate(shotDuration: MediaTime) throws {
        guard shotDuration > .zero else {
            throw CameraMotionTrackValidationError.invalidShotDuration
        }
        let maximum = try MediaTime(
            value: maximumDurationSeconds,
            timescale: 1
        )
        guard shotDuration <= maximum else {
            throw CameraMotionTrackValidationError.shotDurationExceedsLimit
        }
    }

    private func availableEndKeyframeID() -> String {
        let existing = Set(keyframes.map(\.id))
        let base = "camera-end"
        guard existing.contains(base) else { return base }
        var suffix = 2
        while existing.contains("\(base)-\(suffix)") { suffix += 1 }
        return "\(base)-\(suffix)"
    }

    private static func proportionalTime(
        _ time: MediaTime,
        from oldDuration: MediaTime,
        to newDuration: MediaTime,
        keyframeID: String
    ) throws -> MediaTime {
        var numerator = [
            UInt64(time.value),
            UInt64(newDuration.value),
            UInt64(oldDuration.timescale),
        ]
        var denominator = [
            UInt64(time.timescale),
            UInt64(newDuration.timescale),
            UInt64(oldDuration.value),
        ]

        // Cross-reduce factor-by-factor so normal production values never form
        // the much larger unreduced triple products.
        for numeratorIndex in numerator.indices {
            for denominatorIndex in denominator.indices {
                let divisor = greatestCommonDivisor(
                    numerator[numeratorIndex],
                    denominator[denominatorIndex]
                )
                numerator[numeratorIndex] /= divisor
                denominator[denominatorIndex] /= divisor
            }
        }

        guard let value = checkedProduct(numerator),
              let timescale = checkedProduct(denominator),
              value <= UInt64(Int64.max),
              timescale > 0,
              timescale <= UInt64(Int32.max)
        else {
            throw CameraMotionTrackValidationError
                .retimedKeyframeTimeUnrepresentable(keyframeID)
        }
        return try MediaTime(
            value: Int64(value),
            timescale: Int32(timescale)
        )
    }

    private static func checkedProduct(_ factors: [UInt64]) -> UInt64? {
        var product: UInt64 = 1
        for factor in factors {
            let result = product.multipliedReportingOverflow(by: factor)
            guard !result.overflow else { return nil }
            product = result.partialValue
        }
        return product
    }

    private static func greatestCommonDivisor(
        _ lhs: UInt64,
        _ rhs: UInt64
    ) -> UInt64 {
        var left = lhs
        var right = rhs
        while right != 0 {
            let remainder = left % right
            left = right
            right = remainder
        }
        return max(1, left)
    }
}

private struct CameraMotionRenderIdentity: Codable {
    let version: Int
    let enabled: Bool
    let mode: CameraMotionMode
    let shotDuration: MediaTime
    let keyframes: [CameraMotionRenderKeyframe]
}

private struct CameraMotionRenderKeyframe: Codable {
    let time: MediaTime
    let pose: CameraPose2D
    let easingFromPrevious: CameraMotionEasing
}
