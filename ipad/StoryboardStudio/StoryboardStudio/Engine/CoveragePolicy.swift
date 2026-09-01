import Foundation

enum StoryboardCoverageSeverity: String, Codable, Sendable, CaseIterable {
    case blocking
    case warning
    case info
}

enum StoryboardCoverageIssueCode: String, Codable, Sendable, CaseIterable {
    case unsupportedPolicyVersion = "unsupported_policy_version"
    case invalidDimensions = "invalid_dimensions"
    case invalidFraming = "invalid_framing"
    case invalidMotionTrack = "invalid_motion_track"
    case unsupportedProjectFrameRate = "unsupported_project_frame_rate"
    case coverageNonConvergent = "coverage_non_convergent"
    case emptyViewport = "empty_viewport"
    case uncoveredViewport = "uncovered_viewport"
    case criticalSubjectOutside = "critical_subject_outside"
    case motionPlateRequired = "motion_plate_required"
    case aspectRatioMismatch = "aspect_ratio_mismatch"
    case lowSourceResolution = "low_source_resolution"
    case largeEmptyCorners = "large_empty_corners"
    case focusNearCropEdge = "focus_near_crop_edge"
    case aggressiveDigitalZoom = "aggressive_digital_zoom"
    case providerMaySynthesizeOutsideSource =
        "provider_may_synthesize_outside_source"
}

enum StoryboardCoverageClassification: String, Codable, Sendable {
    case valid
    case warning
    case blocking
}

struct StoryboardCoverageIssue: Codable, Sendable, Equatable {
    let code: StoryboardCoverageIssueCode
    let severity: StoryboardCoverageSeverity
    let time: MediaTime?

    init(
        code: StoryboardCoverageIssueCode,
        severity: StoryboardCoverageSeverity,
        time: MediaTime? = nil
    ) {
        self.code = code
        self.severity = severity
        self.time = time
    }
}

struct StoryboardCoverageAsset: Codable, Sendable, Equatable {
    enum Kind: String, Codable, Sendable {
        case sourceSpace = "source_space"
        case viewportRaster = "viewport_raster"
    }

    let kind: Kind
    let rasterPlacementFraming: ShotFramingState?

    init(
        kind: Kind = .sourceSpace,
        rasterPlacementFraming: ShotFramingState? = nil
    ) {
        self.kind = kind
        self.rasterPlacementFraming = rasterPlacementFraming
    }
}

struct StoryboardCoverageInput: Codable, Sendable, Equatable {
    let policyVersion: Int
    let sourceSize: ShotFramingSize
    let outputSize: ShotFramingSize
    let initialFraming: ShotFramingState?
    let asset: StoryboardCoverageAsset?
    let shotDuration: MediaTime?
    let projectFrameRate: MediaTime?
    let motionTrack: CameraMotionTrack?
    let criticalSubjectBounds: ShotFramingRect?

    init(
        policyVersion: Int = CoveragePolicyV1.version,
        sourceSize: ShotFramingSize,
        outputSize: ShotFramingSize,
        initialFraming: ShotFramingState? = nil,
        asset: StoryboardCoverageAsset? = nil,
        shotDuration: MediaTime? = nil,
        projectFrameRate: MediaTime? = nil,
        motionTrack: CameraMotionTrack? = nil,
        criticalSubjectBounds: ShotFramingRect? = nil
    ) {
        self.policyVersion = policyVersion
        self.sourceSize = sourceSize
        self.outputSize = outputSize
        self.initialFraming = initialFraming
        self.asset = asset
        self.shotDuration = shotDuration
        self.projectFrameRate = projectFrameRate
        self.motionTrack = motionTrack
        self.criticalSubjectBounds = criticalSubjectBounds
    }
}

struct StoryboardCoverageReport: Sendable, Equatable {
    let policyVersion: Int
    let classification: StoryboardCoverageClassification
    let issues: [StoryboardCoverageIssue]
    let blockingCodes: [StoryboardCoverageIssueCode]
    let warningCodes: [StoryboardCoverageIssueCode]
    let infoCodes: [StoryboardCoverageIssueCode]
    let evaluatedSampleCount: Int
    let evaluatedTimes: [MediaTime]
    let minimumCoverageFraction: Double
    let minimumSourcePixelsPerOutputPixel: Double
    let sweptVisibleBounds: ShotFramingRect?
}

/// Versioned, deterministic coverage gate shared by live preview, export and
/// generation preflight. It never mutates a document: invalid tracks remain
/// recoverable drafts while the report blocks playback/export/generation.
enum CoveragePolicyV1 {
    static let version = 1
    static let containmentEpsilon = 0.000_001
    static let minimumCoverageFraction = 0.999
    static let largeEmptyCornerWarningFraction = 0.999_999
    static let minimumSourcePixelsPerOutputPixel = 1.0
    static let aggressiveDigitalZoom = 4.0
    static let focusSafeAreaInset = 0.05
    static let aspectRatioTolerance = 0.01
    static let maximumCurveErrorNormalized = 0.000_25
    static let maximumSubdivisionDepth = 8
    static let adaptiveTimeTimescale: Int32 = 1_000_000
    static let maximumTimeTimescale: Int32 = 1_000_000
    static let maximumDurationSeconds = 600.0
    static let maximumEvaluationSampleCount = 40_000

    private static let allowedProjectFrameRates: Set<MediaTime> = [
        try! MediaTime(value: 24, timescale: 1),
        try! MediaTime(value: 25, timescale: 1),
        try! MediaTime(value: 30, timescale: 1),
        try! MediaTime(value: 50, timescale: 1),
        try! MediaTime(value: 60, timescale: 1),
        try! MediaTime(value: 24_000, timescale: 1_001),
        try! MediaTime(value: 30_000, timescale: 1_001),
    ]

    private struct GeometrySample {
        let polygon: [ShotFramingPoint]
        let coverageFraction: Double
        let sourcePixelsPerOutputPixel: Double
        let focusInViewport: ShotFramingPoint?
    }

    private struct MotionSegment {
        let left: MediaTime
        let right: MediaTime
        let easing: CameraMotionEasingKind?
    }

    static func evaluate(_ input: StoryboardCoverageInput) -> StoryboardCoverageReport {
        guard input.policyVersion == version else {
            return emptyReport(.unsupportedPolicyVersion)
        }
        guard input.sourceSize.isValid, input.outputSize.isValid else {
            return emptyReport(.invalidDimensions)
        }

        let rawInitialFraming = input.initialFraming ?? .standard
        guard framingIsFinite(rawInitialFraming) else {
            return emptyReport(.invalidFraming)
        }
        let initialFraming = rawInitialFraming.normalized()
        let rawTrack = input.motionTrack
        let hasTrackKeyframes = rawTrack?.keyframes.isEmpty == false
        let hasEffectiveMotion = hasTrackKeyframes && rawTrack?.enabled == true
        let duration: MediaTime
        if hasTrackKeyframes {
            guard let inputDuration = input.shotDuration,
                  inputDuration > .zero,
                  inputDuration.timescale <= maximumTimeTimescale
            else { return emptyReport(.invalidMotionTrack) }
            guard !hasEffectiveMotion
                    || inputDuration.seconds <= maximumDurationSeconds
            else { return emptyReport(.invalidMotionTrack) }
            duration = inputDuration
        } else {
            duration = .zero
        }

        let normalizedTrack: CameraMotionTrack?
        if let rawTrack {
            if hasTrackKeyframes {
                if hasEffectiveMotion {
                    do {
                        normalizedTrack = try rawTrack.normalized(for: duration)
                    } catch {
                        return emptyReport(.invalidMotionTrack)
                    }
                } else {
                    guard let track = normalizedDisabledTrack(
                        rawTrack,
                        for: duration
                    ) else { return emptyReport(.invalidMotionTrack) }
                    normalizedTrack = track
                }
            } else {
                guard rawTrack.version == CameraMotionTrack.schemaVersion,
                      rawTrack.keyframes.count
                        <= CameraMotionTrack.maximumKeyframeCount
                else { return emptyReport(.invalidMotionTrack) }
                normalizedTrack = rawTrack
            }
        } else {
            normalizedTrack = nil
        }
        if let normalizedTrack,
           normalizedTrack.keyframes.contains(where: {
               $0.time.timescale > maximumTimeTimescale
           }) {
            return emptyReport(.invalidMotionTrack)
        }

        let projectFrameRate = input.projectFrameRate
            ?? StoryboardTiming.legacyDefault.projectFrameRate
        guard projectFrameRate > .zero,
              projectFrameRate.timescale <= maximumTimeTimescale,
              allowedProjectFrameRates.contains(projectFrameRate)
        else { return emptyReport(.unsupportedProjectFrameRate) }

        let criticalSubjectBounds: ShotFramingRect?
        if let rawBounds = input.criticalSubjectBounds {
            guard !rawBounds.isEmpty else {
                return emptyReport(.invalidFraming)
            }
            let normalized = rawBounds.clampedToUnitSquare()
            guard !normalized.isEmpty else {
                return emptyReport(.invalidFraming)
            }
            criticalSubjectBounds = normalized
        } else {
            criticalSubjectBounds = nil
        }

        let plan: CameraMotionEvaluationPlan?
        if hasEffectiveMotion {
            do {
                plan = try CameraMotionEvaluationPlan(
                    initialFraming: initialFraming,
                    track: normalizedTrack,
                    shotDuration: duration)
            } catch {
                return emptyReport(.invalidMotionTrack)
            }
        } else {
            plan = nil
        }

        func pose(at time: MediaTime) -> CameraPose2D {
            plan?.pose(at: time) ?? CameraPose2D(shotFraming: initialFraming)
        }
        func geometry(at time: MediaTime) -> GeometrySample? {
            Self.geometry(
                pose: pose(at: time),
                sourceSize: input.sourceSize,
                outputSize: input.outputSize)
        }

        var times: Set<MediaTime> = [.zero]
        if hasEffectiveMotion {
            guard addExportTimes(
                to: &times,
                duration: duration,
                frameRate: projectFrameRate)
            else { return emptyReport(.coverageNonConvergent) }
            normalizedTrack?.keyframes.forEach { times.insert($0.time) }
            guard addAdaptiveTimes(
                to: &times,
                segments: segments(
                    track: normalizedTrack,
                    duration: duration),
                geometry: geometry)
            else { return emptyReport(.coverageNonConvergent) }
        }
        let evaluatedTimes = times.sorted()

        var issues: [StoryboardCoverageIssueCode: StoryboardCoverageIssue] = [:]
        func addIssue(
            _ code: StoryboardCoverageIssueCode,
            severity: StoryboardCoverageSeverity,
            time: MediaTime? = nil
        ) {
            guard issues[code] == nil else { return }
            issues[code] = StoryboardCoverageIssue(
                code: code, severity: severity, time: time)
        }

        let aspectDifference = abs(
            input.outputSize.aspectRatio - initialFraming.aspectRatio
        ) / initialFraming.aspectRatio
        if aspectDifference > aspectRatioTolerance {
            addIssue(.aspectRatioMismatch, severity: .warning)
        }

        var minimumCoverage = 1.0
        var minimumResolution = Double.infinity
        var visiblePoints: [ShotFramingPoint] = []
        let subjectPolygon = criticalSubjectBounds.map(rectanglePolygon)
        for time in evaluatedTimes {
            guard let sample = geometry(at: time) else {
                return emptyReport(.emptyViewport)
            }
            visiblePoints.append(contentsOf: sample.polygon)
            minimumCoverage = min(minimumCoverage, sample.coverageFraction)
            minimumResolution = min(
                minimumResolution,
                sample.sourcePixelsPerOutputPixel)

            if sample.coverageFraction <= containmentEpsilon {
                addIssue(.emptyViewport, severity: .blocking, time: time)
            } else if sample.coverageFraction < minimumCoverageFraction {
                addIssue(.uncoveredViewport, severity: .blocking, time: time)
            } else if sample.coverageFraction
                        < largeEmptyCornerWarningFraction {
                addIssue(.largeEmptyCorners, severity: .warning, time: time)
            }
            if sample.sourcePixelsPerOutputPixel
                < minimumSourcePixelsPerOutputPixel {
                addIssue(.lowSourceResolution, severity: .warning, time: time)
            }
            if pose(at: time).zoom >= aggressiveDigitalZoom {
                addIssue(.aggressiveDigitalZoom, severity: .warning, time: time)
            }
            if let focus = sample.focusInViewport,
               focus.x < focusSafeAreaInset
                || focus.x > 1 - focusSafeAreaInset
                || focus.y < focusSafeAreaInset
                || focus.y > 1 - focusSafeAreaInset {
                addIssue(.focusNearCropEdge, severity: .warning, time: time)
            }
            if let subjectPolygon,
               !polygonsIntersect(
                    sample.polygon,
                    subjectPolygon,
                    epsilon: containmentEpsilon) {
                addIssue(.criticalSubjectOutside, severity: .blocking, time: time)
            }
        }

        let sweptHull = convexHull(visiblePoints)
        let asset = input.asset ?? StoryboardCoverageAsset()
        if asset.kind == .viewportRaster {
            guard let placement = asset.rasterPlacementFraming,
                  framingIsFinite(placement),
                  placement.aspectRatio > 0,
                  let available = Self.geometry(
                    pose: CameraPose2D(shotFraming: placement),
                    sourceSize: input.sourceSize,
                    outputSize: ShotFramingSize(
                        width: input.outputSize.width,
                        height: input.outputSize.width
                            / placement.aspectRatio))?.polygon
            else { return emptyReport(.invalidFraming) }
            if sweptHull.contains(where: {
                !point(
                    $0,
                    isInsideConvexPolygon: available,
                    epsilon: containmentEpsilon)
            }) {
                addIssue(.motionPlateRequired, severity: .blocking)
                addIssue(
                    .providerMaySynthesizeOutsideSource,
                    severity: .info)
            }
        }

        let sweptBounds: ShotFramingRect?
        if let minimumX = sweptHull.map(\.x).min(),
           let maximumX = sweptHull.map(\.x).max(),
           let minimumY = sweptHull.map(\.y).min(),
           let maximumY = sweptHull.map(\.y).max() {
            sweptBounds = ShotFramingRect(
                minX: roundMetric(minimumX),
                minY: roundMetric(minimumY),
                width: roundMetric(maximumX - minimumX),
                height: roundMetric(maximumY - minimumY))
        } else {
            sweptBounds = nil
        }

        let severityOrder: [StoryboardCoverageSeverity: Int] = [
            .blocking: 0, .warning: 1, .info: 2,
        ]
        let orderedIssues = issues.values.sorted {
            let leftSeverity = severityOrder[$0.severity] ?? 3
            let rightSeverity = severityOrder[$1.severity] ?? 3
            if leftSeverity != rightSeverity {
                return leftSeverity < rightSeverity
            }
            return $0.code.rawValue < $1.code.rawValue
        }
        let blockingCodes = orderedIssues
            .filter { $0.severity == .blocking }.map(\.code)
        let warningCodes = orderedIssues
            .filter { $0.severity == .warning }.map(\.code)
        let infoCodes = orderedIssues
            .filter { $0.severity == .info }.map(\.code)
        let classification: StoryboardCoverageClassification =
            !blockingCodes.isEmpty ? .blocking
            : !warningCodes.isEmpty ? .warning
            : .valid
        return StoryboardCoverageReport(
            policyVersion: version,
            classification: classification,
            issues: orderedIssues,
            blockingCodes: blockingCodes,
            warningCodes: warningCodes,
            infoCodes: infoCodes,
            evaluatedSampleCount: evaluatedTimes.count,
            evaluatedTimes: evaluatedTimes,
            minimumCoverageFraction: roundMetric(minimumCoverage),
            minimumSourcePixelsPerOutputPixel: roundMetric(minimumResolution),
            sweptVisibleBounds: sweptBounds)
    }

    private static func framingIsFinite(_ framing: ShotFramingState) -> Bool {
        let values = [
            framing.centerX, framing.centerY, framing.zoom,
            framing.rollDegrees, framing.aspectRatio,
        ] + [framing.focusAnchorX, framing.focusAnchorY].compactMap { $0 }
        return values.allSatisfy(\.isFinite)
    }

    /// Disabled tracks remain editable drafts, so their duration is not bound
    /// by the effective-motion limit. Their contents still fail closed using
    /// the same canonical validation as an enabled track.
    private static func normalizedDisabledTrack(
        _ track: CameraMotionTrack,
        for shotDuration: MediaTime
    ) -> CameraMotionTrack? {
        guard !track.enabled,
              shotDuration > .zero,
              track.version == CameraMotionTrack.schemaVersion,
              track.keyframes.count <= CameraMotionTrack.maximumKeyframeCount
        else { return nil }

        var normalizedKeyframes: [CameraMotionKeyframe] = []
        normalizedKeyframes.reserveCapacity(track.keyframes.count)
        var ids = Set<String>()
        var times = Set<MediaTime>()

        for keyframe in track.keyframes {
            let id = keyframe.id.trimmingCharacters(
                in: .whitespacesAndNewlines
            )
            guard !id.isEmpty,
                  ids.insert(id).inserted,
                  keyframe.time > .zero,
                  keyframe.time <= shotDuration,
                  times.insert(keyframe.time).inserted,
                  let pose = try? keyframe.pose.normalized()
            else { return nil }

            normalizedKeyframes.append(CameraMotionKeyframe(
                id: id,
                time: keyframe.time,
                pose: pose,
                easingFromPrevious: keyframe.easingFromPrevious
            ))
        }

        normalizedKeyframes.sort { $0.time < $1.time }
        let cleanedPreset = track.presetId?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return CameraMotionTrack(
            version: CameraMotionTrack.schemaVersion,
            enabled: false,
            mode: track.mode,
            presetId: cleanedPreset?.isEmpty == false ? cleanedPreset : nil,
            keyframes: normalizedKeyframes
        )
    }

    private static func geometry(
        pose: CameraPose2D,
        sourceSize: ShotFramingSize,
        outputSize: ShotFramingSize
    ) -> GeometrySample? {
        var framing = ShotFramingState(
            centerX: pose.centerX,
            centerY: pose.centerY,
            zoom: pose.zoom,
            rollDegrees: pose.rollDegrees,
            aspectRatio: outputSize.aspectRatio,
            focusAnchorX: pose.focusAnchorX,
            focusAnchorY: pose.focusAnchorY)
        framing.normalize()
        guard let geometry = ShotFramingGeometry(
            sourceSize: sourceSize,
            viewportSize: outputSize,
            state: framing),
              geometry.sourceScale.isFinite,
              geometry.sourceScale > 0
        else { return nil }
        let polygon = geometry.visibleSourcePolygon.map {
            ShotFramingPoint(
                x: $0.x / sourceSize.width,
                y: $0.y / sourceSize.height)
        }
        guard polygon.allSatisfy(\.isFinite) else { return nil }
        let focus = framing.focusAnchor.map {
            geometry.viewportNormalizedPoint(fromSourceNormalizedPoint: $0)
        }
        return GeometrySample(
            polygon: polygon,
            coverageFraction: geometry.coveredViewportFraction,
            sourcePixelsPerOutputPixel: 1 / geometry.sourceScale,
            focusInViewport: focus)
    }

    private static func addExportTimes(
        to times: inout Set<MediaTime>,
        duration: MediaTime,
        frameRate: MediaTime
    ) -> Bool {
        let numeratorResult = duration.value.multipliedReportingOverflow(
            by: frameRate.value)
        let denominatorResult = Int64(duration.timescale)
            .multipliedReportingOverflow(by: Int64(frameRate.timescale))
        guard !numeratorResult.overflow,
              !denominatorResult.overflow,
              denominatorResult.partialValue > 0,
              frameRate.value <= Int64(Int32.max)
        else { return false }
        let finalFrame = numeratorResult.partialValue
            / denominatorResult.partialValue
        guard finalFrame >= 0,
              finalFrame + 1 <= Int64(maximumEvaluationSampleCount)
        else { return false }
        for frameIndex in 0...finalFrame {
            let value = frameIndex.multipliedReportingOverflow(
                by: Int64(frameRate.timescale))
            guard !value.overflow,
                  let time = try? MediaTime(
                    value: value.partialValue,
                    timescale: Int32(frameRate.value))
            else { return false }
            times.insert(time)
        }
        times.insert(duration)
        return true
    }

    private static func segments(
        track: CameraMotionTrack?,
        duration: MediaTime
    ) -> [MotionSegment] {
        guard let track, track.enabled, !track.keyframes.isEmpty else {
            return []
        }
        var result: [MotionSegment] = []
        var left = MediaTime.zero
        for keyframe in track.keyframes {
            result.append(MotionSegment(
                left: left,
                right: keyframe.time,
                easing: keyframe.easingFromPrevious.kind))
            left = keyframe.time
        }
        if left < duration {
            result.append(MotionSegment(
                left: left, right: duration, easing: nil))
        }
        return result
    }

    private static func addAdaptiveTimes(
        to times: inout Set<MediaTime>,
        segments: [MotionSegment],
        geometry: (MediaTime) -> GeometrySample?
    ) -> Bool {
        struct PendingInterval {
            let left: MediaTime
            let right: MediaTime
            let depth: Int
        }

        for segment in segments {
            guard segment.easing != .hold, segment.easing != nil else {
                continue
            }
            var pending = [PendingInterval(
                left: segment.left, right: segment.right, depth: 0)]
            while let interval = pending.popLast() {
                guard let midpoint = midpoint(
                    interval.left,
                    interval.right),
                      midpoint > interval.left,
                      midpoint < interval.right
                else { return false }
                times.insert(midpoint)
                guard times.count <= maximumEvaluationSampleCount,
                      let leftGeometry = geometry(interval.left),
                      let midpointGeometry = geometry(midpoint),
                      let rightGeometry = geometry(interval.right)
                else { return false }
                let error = polygonMidpointDeviation(
                    leftGeometry.polygon,
                    midpointGeometry.polygon,
                    rightGeometry.polygon)
                if error <= maximumCurveErrorNormalized { continue }
                guard interval.depth < maximumSubdivisionDepth else {
                    return false
                }
                pending.append(PendingInterval(
                    left: midpoint,
                    right: interval.right,
                    depth: interval.depth + 1))
                pending.append(PendingInterval(
                    left: interval.left,
                    right: midpoint,
                    depth: interval.depth + 1))
            }
        }
        return true
    }

    private static func midpoint(
        _ left: MediaTime,
        _ right: MediaTime
    ) -> MediaTime? {
        let scaled = ((left.seconds + right.seconds) / 2)
            * Double(adaptiveTimeTimescale)
        guard scaled.isFinite,
              scaled >= 0,
              scaled <= Double(Int64.max)
        else { return nil }
        return try? MediaTime(
            value: Int64(scaled.rounded(.toNearestOrAwayFromZero)),
            timescale: adaptiveTimeTimescale)
    }

    private static func polygonMidpointDeviation(
        _ left: [ShotFramingPoint],
        _ midpoint: [ShotFramingPoint],
        _ right: [ShotFramingPoint]
    ) -> Double {
        guard left.count == midpoint.count, midpoint.count == right.count else {
            return .infinity
        }
        return midpoint.indices.reduce(0) { maximum, index in
            let expectedX = (left[index].x + right[index].x) / 2
            let expectedY = (left[index].y + right[index].y) / 2
            return max(
                maximum,
                hypot(
                    midpoint[index].x - expectedX,
                    midpoint[index].y - expectedY))
        }
    }

    private static func rectanglePolygon(
        _ rect: ShotFramingRect
    ) -> [ShotFramingPoint] {
        [
            ShotFramingPoint(x: rect.minX, y: rect.minY),
            ShotFramingPoint(x: rect.maxX, y: rect.minY),
            ShotFramingPoint(x: rect.maxX, y: rect.maxY),
            ShotFramingPoint(x: rect.minX, y: rect.maxY),
        ]
    }

    private static func cross(
        _ origin: ShotFramingPoint,
        _ left: ShotFramingPoint,
        _ right: ShotFramingPoint
    ) -> Double {
        (left.x - origin.x) * (right.y - origin.y)
            - (left.y - origin.y) * (right.x - origin.x)
    }

    private static func convexHull(
        _ points: [ShotFramingPoint]
    ) -> [ShotFramingPoint] {
        let sorted = points.sorted {
            $0.x == $1.x ? $0.y < $1.y : $0.x < $1.x
        }
        var unique: [ShotFramingPoint] = []
        for point in sorted where unique.last != point {
            unique.append(point)
        }
        guard unique.count > 2 else { return unique }

        var lower: [ShotFramingPoint] = []
        for point in unique {
            while lower.count >= 2,
                  cross(lower[lower.count - 2], lower[lower.count - 1], point)
                    <= 0 {
                lower.removeLast()
            }
            lower.append(point)
        }
        var upper: [ShotFramingPoint] = []
        for point in unique.reversed() {
            while upper.count >= 2,
                  cross(upper[upper.count - 2], upper[upper.count - 1], point)
                    <= 0 {
                upper.removeLast()
            }
            upper.append(point)
        }
        lower.removeLast()
        upper.removeLast()
        return lower + upper
    }

    private static func point(
        _ point: ShotFramingPoint,
        isInsideConvexPolygon polygon: [ShotFramingPoint],
        epsilon: Double
    ) -> Bool {
        guard polygon.count >= 3 else { return false }
        var orientation = 0
        for index in polygon.indices {
            let start = polygon[index]
            let end = polygon[(index + 1) % polygon.count]
            let value = cross(start, end, point)
            if abs(value) <= epsilon { continue }
            let current = value > 0 ? 1 : -1
            if orientation == 0 {
                orientation = current
            } else if current != orientation {
                return false
            }
        }
        return true
    }

    private static func polygonsIntersect(
        _ left: [ShotFramingPoint],
        _ right: [ShotFramingPoint],
        epsilon: Double
    ) -> Bool {
        for polygon in [left, right] {
            for index in polygon.indices {
                let start = polygon[index]
                let end = polygon[(index + 1) % polygon.count]
                let axis = ShotFramingPoint(
                    x: -(end.y - start.y),
                    y: end.x - start.x)
                func projection(
                    _ points: [ShotFramingPoint]
                ) -> ClosedRange<Double> {
                    let values = points.map { $0.x * axis.x + $0.y * axis.y }
                    return (values.min() ?? 0)...(values.max() ?? 0)
                }
                let leftProjection = projection(left)
                let rightProjection = projection(right)
                if leftProjection.upperBound
                    < rightProjection.lowerBound - epsilon
                    || rightProjection.upperBound
                        < leftProjection.lowerBound - epsilon {
                    return false
                }
            }
        }
        return true
    }

    private static func roundMetric(_ value: Double) -> Double {
        guard value.isFinite else { return 0 }
        return (value * 1_000_000_000).rounded() / 1_000_000_000
    }

    private static func emptyReport(
        _ code: StoryboardCoverageIssueCode
    ) -> StoryboardCoverageReport {
        StoryboardCoverageReport(
            policyVersion: version,
            classification: .blocking,
            issues: [StoryboardCoverageIssue(
                code: code, severity: .blocking)],
            blockingCodes: [code],
            warningCodes: [],
            infoCodes: [],
            evaluatedSampleCount: 0,
            evaluatedTimes: [],
            minimumCoverageFraction: 0,
            minimumSourcePixelsPerOutputPixel: 0,
            sweptVisibleBounds: nil)
    }
}
