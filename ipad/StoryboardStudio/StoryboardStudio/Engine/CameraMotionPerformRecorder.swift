import Foundation

struct CameraMotionPerformSample: Sendable, Equatable {
    let time: MediaTime
    let pose: CameraPose2D

    init(time: MediaTime, pose: CameraPose2D) {
        self.time = time
        self.pose = pose
    }
}

struct CameraMotionPerformConfiguration: Codable, Sendable, Equatable {
    static let schemaVersion = 1
    static let currentAlgorithmVersion = 1

    static let locked1080pV1 = CameraMotionPerformConfiguration(
        referenceViewportSize: ShotFramingSize(width: 1_920, height: 1_080),
        maximumScreenSpaceErrorPixels: 2,
        maximumKeyframes: CameraMotionTrack.maximumKeyframeCount
    )

    let version: Int
    let algorithmVersion: Int
    let referenceViewportSize: ShotFramingSize
    let maximumScreenSpaceErrorPixels: Double
    let maximumKeyframes: Int

    init(
        version: Int = Self.schemaVersion,
        algorithmVersion: Int = Self.currentAlgorithmVersion,
        referenceViewportSize: ShotFramingSize,
        maximumScreenSpaceErrorPixels: Double,
        maximumKeyframes: Int
    ) {
        self.version = version
        self.algorithmVersion = algorithmVersion
        self.referenceViewportSize = referenceViewportSize
        self.maximumScreenSpaceErrorPixels =
            maximumScreenSpaceErrorPixels
        self.maximumKeyframes = maximumKeyframes
    }
}

enum CameraMotionPerformRecorderState: String, Sendable, Equatable {
    case ready
    case recording
    case completed
    case cancelled
}

enum CameraMotionPerformError: Error, Sendable, Equatable {
    case unsupportedConfigurationVersion(Int)
    case unsupportedAlgorithmVersion(Int)
    case invalidReferenceViewport
    case invalidErrorBudget
    case invalidMaximumKeyframes(Int)
    case invalidShotDuration(CameraMotionTrackValidationError)
    case invalidFrameGrid(StoryboardFrameSamplePlanError)
    case invalidInitialPose(CameraPose2DValidationError)
    case invalidSamplePose(CameraPose2DValidationError)
    case noMeaningfulMotion
    case invalidState(
        expected: CameraMotionPerformRecorderState,
        actual: CameraMotionPerformRecorderState
    )
    case sampleAfterShotDuration(MediaTime)
    case samplesOutOfOrder(previous: MediaTime, next: MediaTime)
    case arithmeticOverflow
    case keyframeLimitCannotMeetErrorBudget(
        requiredKeyframes: Int,
        maximumKeyframes: Int,
        maximumErrorPixels: Double
    )
    case outputExceedsErrorBudget(
        measuredPixels: Double,
        maximumPixels: Double
    )
    case outputTrackInvalid(CameraMotionTrackValidationError)
    case outputFingerprintFailed
}

extension CameraMotionPerformError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .unsupportedConfigurationVersion:
            "The camera performance configuration is newer than this app."
        case .unsupportedAlgorithmVersion:
            "The camera performance algorithm is not supported."
        case .invalidReferenceViewport:
            "The camera performance viewport is invalid."
        case .invalidErrorBudget:
            "The camera performance error budget is invalid."
        case .invalidMaximumKeyframes:
            "The camera performance keyframe limit is invalid."
        case .invalidShotDuration:
            "The shot duration cannot be recorded."
        case .invalidFrameGrid:
            "The project frame grid cannot represent this performance."
        case .invalidInitialPose:
            "The initial camera pose is invalid."
        case .invalidSamplePose:
            "A recorded camera pose is invalid."
        case .noMeaningfulMotion:
            "Move the camera before completing the performance."
        case .invalidState:
            "The camera recorder is not in the required state."
        case .sampleAfterShotDuration:
            "A camera sample is outside the shot."
        case .samplesOutOfOrder:
            "Camera samples must be appended in timestamp order."
        case .arithmeticOverflow:
            "The camera performance exceeded the supported time range."
        case .keyframeLimitCannotMeetErrorBudget:
            "The performed move is too complex for the v1 keyframe limit."
        case .outputExceedsErrorBudget:
            "The reduced camera move is not accurate enough."
        case .outputTrackInvalid:
            "The reduced camera move is invalid."
        case .outputFingerprintFailed:
            "The camera move could not be fingerprinted."
        }
    }
}

struct CameraMotionPerformResult: Sendable, Equatable {
    let track: CameraMotionTrack
    let fingerprint: String
    let sourceSampleCount: Int
    let quantizedSampleCount: Int
    let maximumScreenSpaceErrorPixels: Double
    let configuration: CameraMotionPerformConfiguration
}

/// Transaction-local recorder for a whole-shot performed camera move.
///
/// Input timestamps are shot-local MediaTime values supplied by the playback
/// clock, never wall-clock values. The recorder owns the immutable t=0 pose.
/// Multiple input samples may land on one project frame; the last appended
/// sample wins deterministically. stop() extends the last pose to the exact
/// shot endpoint with hold easing when recording stopped early.
struct CameraMotionPerformRecorder: Sendable {
    private let initialPose: CameraPose2D
    private let shotDuration: MediaTime
    private let timing: StoryboardTiming
    private let configuration: CameraMotionPerformConfiguration
    private let samplePlan: StoryboardFrameSamplePlan
    private var rawSamples: [CameraMotionPerformSample] = []

    private(set) var state: CameraMotionPerformRecorderState = .ready
    private(set) var result: CameraMotionPerformResult?

    init(
        initialPose: CameraPose2D,
        shotDuration: MediaTime,
        timing: StoryboardTiming,
        configuration: CameraMotionPerformConfiguration = .locked1080pV1
    ) throws {
        try Self.validate(configuration)
        do {
            try CameraMotionTrack.validate(shotDuration: shotDuration)
        } catch let error as CameraMotionTrackValidationError {
            throw CameraMotionPerformError.invalidShotDuration(error)
        }
        let normalizedPose: CameraPose2D
        do {
            normalizedPose = try initialPose.normalized()
        } catch let error as CameraPose2DValidationError {
            throw CameraMotionPerformError.invalidInitialPose(error)
        }
        let plan: StoryboardFrameSamplePlan
        do {
            plan = try StoryboardFrameSamplePlan.make(
                shotDuration: shotDuration,
                timing: timing
            )
        } catch let error as StoryboardFrameSamplePlanError {
            throw CameraMotionPerformError.invalidFrameGrid(error)
        }

        self.initialPose = normalizedPose
        self.shotDuration = shotDuration
        self.timing = timing
        self.configuration = configuration
        self.samplePlan = plan
    }

    mutating func start() throws {
        guard state == .ready else {
            throw CameraMotionPerformError.invalidState(
                expected: .ready,
                actual: state
            )
        }
        rawSamples.removeAll(keepingCapacity: true)
        result = nil
        state = .recording
    }

    mutating func append(_ sample: CameraMotionPerformSample) throws {
        guard state == .recording else {
            throw CameraMotionPerformError.invalidState(
                expected: .recording,
                actual: state
            )
        }
        guard sample.time <= shotDuration else {
            throw CameraMotionPerformError.sampleAfterShotDuration(
                sample.time
            )
        }
        if let previous = rawSamples.last?.time, sample.time < previous {
            throw CameraMotionPerformError.samplesOutOfOrder(
                previous: previous,
                next: sample.time
            )
        }

        let pose: CameraPose2D
        do {
            pose = try sample.pose.normalized()
        } catch let error as CameraPose2DValidationError {
            throw CameraMotionPerformError.invalidSamplePose(error)
        }
        rawSamples.append(CameraMotionPerformSample(
            time: sample.time,
            pose: pose
        ))
    }

    mutating func stop() throws -> CameraMotionPerformResult {
        guard state == .recording else {
            throw CameraMotionPerformError.invalidState(
                expected: .recording,
                actual: state
            )
        }

        let compiled = try CameraMotionPerformPipeline.compile(
            rawSamples: rawSamples,
            initialPose: initialPose,
            shotDuration: shotDuration,
            timing: timing,
            samplePlan: samplePlan,
            configuration: configuration
        )
        result = compiled
        state = .completed
        return compiled
    }

    mutating func cancel() {
        rawSamples.removeAll(keepingCapacity: false)
        result = nil
        state = .cancelled
    }

    private static func validate(
        _ configuration: CameraMotionPerformConfiguration
    ) throws {
        guard configuration.version
                == CameraMotionPerformConfiguration.schemaVersion else {
            throw CameraMotionPerformError
                .unsupportedConfigurationVersion(configuration.version)
        }
        guard configuration.algorithmVersion
                == CameraMotionPerformConfiguration
                    .currentAlgorithmVersion else {
            throw CameraMotionPerformError
                .unsupportedAlgorithmVersion(
                    configuration.algorithmVersion
                )
        }
        guard configuration.referenceViewportSize.isValid else {
            throw CameraMotionPerformError.invalidReferenceViewport
        }
        let budget = configuration.maximumScreenSpaceErrorPixels
        guard budget.isFinite, budget > 0 else {
            throw CameraMotionPerformError.invalidErrorBudget
        }
        guard configuration.maximumKeyframes > 0,
              configuration.maximumKeyframes
                <= CameraMotionTrack.maximumKeyframeCount else {
            throw CameraMotionPerformError.invalidMaximumKeyframes(
                configuration.maximumKeyframes
            )
        }
    }
}

private struct CameraMotionPerformFilteredSequence {
    var approximationSamples: [CameraMotionPerformSample]
    let referenceSamples: [CameraMotionPerformSample]
    let mandatoryIndices: [Int]
    let usesSyntheticHoldEndpoint: Bool
    let sourceSampleCount: Int
}

enum CameraMotionPerformFilter {
    /// V1 is a bounded, deterministic three-point filter. Normalization,
    /// frame quantization and same-frame last-writer-wins are part of the
    /// algorithm contract. Smoothing is capped to one quarter of the total
    /// screen-space error budget and may be disabled by the pipeline fallback.
    fileprivate static func process(
        rawSamples: [CameraMotionPerformSample],
        initialPose: CameraPose2D,
        shotDuration: MediaTime,
        samplePlan: StoryboardFrameSamplePlan,
        configuration: CameraMotionPerformConfiguration,
        smoothingEnabled: Bool
    ) throws -> CameraMotionPerformFilteredSequence {
        var buckets: [MediaTime: CameraPose2D] = [:]
        buckets.reserveCapacity(rawSamples.count)
        var remappedTZero = false
        for sample in rawSamples {
            var quantized = try quantizedTime(
                sample.time,
                shotDuration: shotDuration,
                samplePlan: samplePlan
            )
            // The initial pose is immutable and owns t=0. Preserve an
            // immediate, non-identical gesture callback by moving it to the
            // first positive project frame; exact/no-op t=0 callbacks remain
            // ignored. Iterating in append order preserves last-writer-wins.
            if quantized == .zero,
               sample.pose != initialPose || remappedTZero {
                quantized = samplePlan.samples.dropFirst().first?.localTime
                    ?? shotDuration
                remappedTZero = true
            }
            buckets[quantized] = sample.pose
        }

        buckets.removeValue(forKey: .zero)
        let orderedTimes = buckets.keys.sorted()
        var approximation = [
            CameraMotionPerformSample(time: .zero, pose: initialPose),
        ]
        var reference = [
            CameraMotionPerformSample(time: .zero, pose: initialPose),
        ]
        approximation.reserveCapacity(orderedTimes.count + 2)
        reference.reserveCapacity(orderedTimes.count + 2)
        for time in orderedTimes {
            guard let pose = buckets[time] else { continue }
            let sample = CameraMotionPerformSample(time: time, pose: pose)
            approximation.append(sample)
            reference.append(sample)
        }

        let hasActualEndpoint = approximation.last?.time == shotDuration
        let usesSyntheticHoldEndpoint = !hasActualEndpoint
        var holdStartIndex: Int?
        if usesSyntheticHoldEndpoint {
            holdStartIndex = approximation.count - 1
            let lastPose = approximation.last?.pose ?? initialPose
            let endpoint = CameraMotionPerformSample(
                time: shotDuration,
                pose: lastPose
            )
            approximation.append(endpoint)
            reference.append(endpoint)
        }

        guard reference.dropFirst().contains(where: {
            $0.pose != initialPose
        }) else {
            throw CameraMotionPerformError.noMeaningfulMotion
        }

        var mandatory = [0, approximation.count - 1]
        if let holdStartIndex, holdStartIndex > 0 {
            mandatory.append(holdStartIndex)
        }
        mandatory = Array(Set(mandatory)).sorted()

        if smoothingEnabled, approximation.count > 2 {
            approximation = try smoothed(
                approximation,
                mandatoryIndices: Set(mandatory),
                configuration: configuration
            )
        }
        return CameraMotionPerformFilteredSequence(
            approximationSamples: approximation,
            referenceSamples: reference,
            mandatoryIndices: mandatory,
            usesSyntheticHoldEndpoint: usesSyntheticHoldEndpoint,
            sourceSampleCount: rawSamples.count
        )
    }

    private static func quantizedTime(
        _ time: MediaTime,
        shotDuration: MediaTime,
        samplePlan: StoryboardFrameSamplePlan
    ) throws -> MediaTime {
        if time >= shotDuration { return shotDuration }
        let ticks: Int64
        do {
            ticks = try time.scaledValue(
                to: samplePlan.timelineTimescale,
                rounding: .nearestAwayFromZero
            )
        } catch {
            throw CameraMotionPerformError.arithmeticOverflow
        }
        let frameTicks = samplePlan.frameDurationValue
        let lowerIndex = ticks / frameTicks
        let remainder = ticks % frameTicks
        var nearestIndex = lowerIndex
        if remainder != 0, remainder >= frameTicks - remainder {
            let increment = nearestIndex.addingReportingOverflow(1)
            guard !increment.overflow else {
                throw CameraMotionPerformError.arithmeticOverflow
            }
            nearestIndex = increment.partialValue
        }
        let product = nearestIndex.multipliedReportingOverflow(
            by: frameTicks
        )
        guard !product.overflow else {
            throw CameraMotionPerformError.arithmeticOverflow
        }
        let durationTicks: Int64
        do {
            durationTicks = try shotDuration.scaledValueExactly(
                to: samplePlan.timelineTimescale
            )
        } catch {
            throw CameraMotionPerformError.arithmeticOverflow
        }
        let value = min(durationTicks, product.partialValue)
        do {
            return try MediaTime(
                value: value,
                timescale: samplePlan.timelineTimescale
            )
        } catch {
            throw CameraMotionPerformError.arithmeticOverflow
        }
    }

    private static func smoothed(
        _ samples: [CameraMotionPerformSample],
        mandatoryIndices: Set<Int>,
        configuration: CameraMotionPerformConfiguration
    ) throws -> [CameraMotionPerformSample] {
        let smoothingBudget = min(
            0.5,
            configuration.maximumScreenSpaceErrorPixels * 0.25
        )
        guard smoothingBudget > 0 else { return samples }

        var output = samples
        for index in 1..<(samples.count - 1) {
            guard !mandatoryIndices.contains(index) else { continue }
            let previous = samples[index - 1]
            let current = samples[index]
            let next = samples[index + 1]
            guard CameraMotionPerformMath.hasCompatibleFocus(
                previous.pose,
                current.pose,
                next.pose
            ) else { continue }

            let span = next.time.seconds - previous.time.seconds
            guard span > 0 else { continue }
            let progress = min(
                1,
                max(0, (current.time.seconds - previous.time.seconds) / span)
            )
            let predicted = try CameraMotionPerformMath.interpolate(
                from: previous.pose,
                to: next.pose,
                progress: progress
            )
            var lower = 0.0
            var upper = 0.25
            for _ in 0..<24 {
                let candidateStrength = (lower + upper) / 2
                let candidate = try CameraMotionPerformMath.interpolate(
                    from: current.pose,
                    to: predicted,
                    progress: candidateStrength
                )
                let error = CameraMotionPerformScreenSpace.errorPixels(
                    candidate,
                    current.pose,
                    viewportSize:
                        configuration.referenceViewportSize
                )
                if error <= smoothingBudget {
                    lower = candidateStrength
                } else {
                    upper = candidateStrength
                }
            }
            guard lower > 0 else { continue }
            let candidate = try CameraMotionPerformMath.canonicalized(
                CameraMotionPerformMath.interpolate(
                    from: current.pose,
                    to: predicted,
                    progress: lower
                )
            )
            let error = CameraMotionPerformScreenSpace.errorPixels(
                candidate,
                current.pose,
                viewportSize: configuration.referenceViewportSize
            )
            if error <= smoothingBudget + 0.000_001 {
                output[index] = CameraMotionPerformSample(
                    time: current.time,
                    pose: candidate
                )
            }
        }
        return output
    }
}

enum CameraMotionPerformReducer {
    fileprivate static func reduce(
        _ sequence: CameraMotionPerformFilteredSequence,
        initialPose: CameraPose2D,
        shotDuration: MediaTime,
        configuration: CameraMotionPerformConfiguration,
        reductionErrorPixels: Double
    ) throws -> CameraMotionPerformResult {
        let samples = sequence.approximationSamples
        guard samples.count >= 2,
              samples.first?.time == .zero,
              samples.last?.time == shotDuration else {
            throw CameraMotionPerformError.arithmeticOverflow
        }

        var selected = Array(repeating: false, count: samples.count)
        for index in sequence.mandatoryIndices {
            selected[index] = true
        }
        let boundaries = sequence.mandatoryIndices.sorted()
        for pairIndex in 0..<(boundaries.count - 1) {
            try selectSegment(
                from: boundaries[pairIndex],
                through: boundaries[pairIndex + 1],
                samples: samples,
                selected: &selected,
                maximumErrorPixels: reductionErrorPixels,
                viewportSize: configuration.referenceViewportSize
            )
        }

        let selectedIndices = selected.indices.filter { selected[$0] }
        let requiredKeyframes = selectedIndices.filter { $0 > 0 }.count
        guard requiredKeyframes <= configuration.maximumKeyframes else {
            throw CameraMotionPerformError
                .keyframeLimitCannotMeetErrorBudget(
                    requiredKeyframes: requiredKeyframes,
                    maximumKeyframes: configuration.maximumKeyframes,
                    maximumErrorPixels:
                        configuration.maximumScreenSpaceErrorPixels
                )
        }

        let keyframes = selectedIndices.filter { $0 > 0 }.enumerated().map {
            ordinal, sampleIndex in
            let sample = samples[sampleIndex]
            let isSyntheticEndpoint =
                sequence.usesSyntheticHoldEndpoint
                && sampleIndex == samples.count - 1
            return CameraMotionKeyframe(
                id: "perform-v1-\(ordinal + 1)",
                time: sample.time,
                pose: sample.pose,
                easingFromPrevious: CameraMotionEasing(
                    kind: isSyntheticEndpoint ? .hold : .linear
                )
            )
        }

        let track: CameraMotionTrack
        do {
            track = try CameraMotionTrack(
                enabled: true,
                mode: .performed,
                presetId: "perform-v1",
                keyframes: keyframes
            ).normalized(for: shotDuration)
        } catch let error as CameraMotionTrackValidationError {
            throw CameraMotionPerformError.outputTrackInvalid(error)
        }

        let maximumError = try measuredError(
            track: track,
            initialPose: initialPose,
            shotDuration: shotDuration,
            referenceSamples: sequence.referenceSamples,
            viewportSize: configuration.referenceViewportSize
        )
        guard maximumError
                <= configuration.maximumScreenSpaceErrorPixels
                    + 0.000_001 else {
            throw CameraMotionPerformError.outputExceedsErrorBudget(
                measuredPixels: maximumError,
                maximumPixels:
                    configuration.maximumScreenSpaceErrorPixels
            )
        }

        let fingerprint: String
        do {
            fingerprint = try track.canonicalRenderFingerprint(
                for: shotDuration
            )
        } catch {
            throw CameraMotionPerformError.outputFingerprintFailed
        }
        return CameraMotionPerformResult(
            track: track,
            fingerprint: fingerprint,
            sourceSampleCount: sequence.sourceSampleCount,
            quantizedSampleCount: sequence.referenceSamples.count,
            maximumScreenSpaceErrorPixels: maximumError,
            configuration: configuration
        )
    }

    private static func selectSegment(
        from start: Int,
        through end: Int,
        samples: [CameraMotionPerformSample],
        selected: inout [Bool],
        maximumErrorPixels: Double,
        viewportSize: ShotFramingSize
    ) throws {
        guard end > start + 1 else { return }
        var stack: [(Int, Int)] = [(start, end)]
        while let segment = stack.popLast() {
            guard segment.1 > segment.0 + 1 else { continue }
            let left = samples[segment.0]
            let right = samples[segment.1]
            let duration = right.time.seconds - left.time.seconds
            guard duration > 0 else {
                throw CameraMotionPerformError.arithmeticOverflow
            }

            var worstIndex: Int?
            var worstError = -Double.infinity
            for index in (segment.0 + 1)..<segment.1 {
                let progress = min(
                    1,
                    max(
                        0,
                        (samples[index].time.seconds - left.time.seconds)
                            / duration
                    )
                )
                let predicted = try CameraMotionPerformMath.interpolate(
                    from: left.pose,
                    to: right.pose,
                    progress: progress
                )
                let error = CameraMotionPerformScreenSpace.errorPixels(
                    predicted,
                    samples[index].pose,
                    viewportSize: viewportSize
                )
                if error > worstError {
                    worstError = error
                    worstIndex = index
                }
            }
            guard worstError > maximumErrorPixels,
                  let split = worstIndex else { continue }
            selected[split] = true
            // Push right first so equal-error ties remain earliest-first.
            stack.append((split, segment.1))
            stack.append((segment.0, split))
        }
    }

    private static func measuredError(
        track: CameraMotionTrack,
        initialPose: CameraPose2D,
        shotDuration: MediaTime,
        referenceSamples: [CameraMotionPerformSample],
        viewportSize: ShotFramingSize
    ) throws -> Double {
        let base = ShotFramingState(
            centerX: initialPose.centerX,
            centerY: initialPose.centerY,
            zoom: initialPose.zoom,
            rollDegrees: initialPose.rollDegrees,
            aspectRatio: viewportSize.aspectRatio,
            focusAnchorX: initialPose.focusAnchorX,
            focusAnchorY: initialPose.focusAnchorY,
            mode: .manual
        )
        let plan = try CameraMotionEvaluationPlan(
            initialFraming: base,
            track: track,
            shotDuration: shotDuration
        )
        var maximum = 0.0
        for sample in referenceSamples {
            maximum = max(
                maximum,
                CameraMotionPerformScreenSpace.errorPixels(
                    plan.pose(at: sample.time),
                    sample.pose,
                    viewportSize: viewportSize
                )
            )
        }
        return maximum
    }
}

private enum CameraMotionPerformPipeline {
    static func compile(
        rawSamples: [CameraMotionPerformSample],
        initialPose: CameraPose2D,
        shotDuration: MediaTime,
        timing: StoryboardTiming,
        samplePlan: StoryboardFrameSamplePlan,
        configuration: CameraMotionPerformConfiguration
    ) throws -> CameraMotionPerformResult {
        _ = timing
        let smoothingBudget = min(
            0.5,
            configuration.maximumScreenSpaceErrorPixels * 0.25
        )
        let smoothed = try CameraMotionPerformFilter.process(
            rawSamples: rawSamples,
            initialPose: initialPose,
            shotDuration: shotDuration,
            samplePlan: samplePlan,
            configuration: configuration,
            smoothingEnabled: true
        )
        do {
            return try CameraMotionPerformReducer.reduce(
                smoothed,
                initialPose: initialPose,
                shotDuration: shotDuration,
                configuration: configuration,
                reductionErrorPixels:
                    configuration.maximumScreenSpaceErrorPixels
                        - smoothingBudget
            )
        } catch let error as CameraMotionPerformError {
            switch error {
            case .keyframeLimitCannotMeetErrorBudget,
                 .outputExceedsErrorBudget:
                break
            default:
                throw error
            }
        }

        // Smoothing is never allowed to make an otherwise representable move
        // fail. V1 deterministically retries the normalized frame samples with
        // the full error budget before returning a fail-closed result.
        let identity = try CameraMotionPerformFilter.process(
            rawSamples: rawSamples,
            initialPose: initialPose,
            shotDuration: shotDuration,
            samplePlan: samplePlan,
            configuration: configuration,
            smoothingEnabled: false
        )
        return try CameraMotionPerformReducer.reduce(
            identity,
            initialPose: initialPose,
            shotDuration: shotDuration,
            configuration: configuration,
            reductionErrorPixels:
                configuration.maximumScreenSpaceErrorPixels
        )
    }
}

enum CameraMotionPerformScreenSpace {
    static func errorPixels(
        _ lhs: CameraPose2D,
        _ rhs: CameraPose2D,
        viewportSize: ShotFramingSize
    ) -> Double {
        guard viewportSize.isValid else { return .infinity }
        let sourceSize = viewportSize
        let base = ShotFramingState(
            aspectRatio: viewportSize.aspectRatio,
            mode: .manual
        )
        guard let leftState = try? lhs.applying(to: base),
              let rightState = try? rhs.applying(to: base),
              let leftGeometry = ShotFramingGeometry(
                sourceSize: sourceSize,
                viewportSize: viewportSize,
                state: leftState
              ),
              let rightGeometry = ShotFramingGeometry(
                sourceSize: sourceSize,
                viewportSize: viewportSize,
                state: rightState
              ) else { return .infinity }

        let sourcePoints = [
            ShotFramingPoint(x: 0, y: 0),
            ShotFramingPoint(x: sourceSize.width, y: 0),
            ShotFramingPoint(
                x: sourceSize.width,
                y: sourceSize.height
            ),
            ShotFramingPoint(x: 0, y: sourceSize.height),
        ]
        var maximum = 0.0
        for point in sourcePoints {
            let left = leftGeometry.viewportPoint(
                fromSourcePoint: point
            )
            let right = rightGeometry.viewportPoint(
                fromSourcePoint: point
            )
            maximum = max(
                maximum,
                hypot(left.x - right.x, left.y - right.y)
            )
        }

        switch (
            lhs.focusAnchorX,
            lhs.focusAnchorY,
            rhs.focusAnchorX,
            rhs.focusAnchorY
        ) {
        case (nil, nil, nil, nil):
            break
        case let (leftX?, leftY?, rightX?, rightY?):
            maximum = max(
                maximum,
                hypot(
                    (leftX - rightX) * viewportSize.width,
                    (leftY - rightY) * viewportSize.height
                )
            )
        default:
            return .infinity
        }
        return maximum.isFinite ? maximum : .infinity
    }
}

private enum CameraMotionPerformMath {
    static func interpolate(
        from left: CameraPose2D,
        to right: CameraPose2D,
        progress requestedProgress: Double
    ) throws -> CameraPose2D {
        let progress = min(1, max(0, requestedProgress))
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
            focusX = nil
            focusY = nil
        default:
            focusX = nil
            focusY = nil
        }

        return try CameraPose2D(
            centerX: linear(left.centerX, right.centerX),
            centerY: linear(left.centerY, right.centerY),
            zoom: exp(linear(log(left.zoom), log(right.zoom))),
            rollDegrees: CameraPose2D.normalizedDegrees(
                left.rollDegrees + rollDelta * progress
            ),
            focusAnchorX: focusX,
            focusAnchorY: focusY
        ).normalized()
    }

    static func hasCompatibleFocus(
        _ first: CameraPose2D,
        _ second: CameraPose2D,
        _ third: CameraPose2D
    ) -> Bool {
        let values = [first, second, third].map {
            ($0.focusAnchorX != nil, $0.focusAnchorY != nil)
        }
        return values.allSatisfy { $0 == values[0] }
    }

    static func canonicalized(
        _ pose: CameraPose2D
    ) throws -> CameraPose2D {
        func value(_ input: Double) -> Double {
            let scale = 1_000_000_000.0
            let rounded = (input * scale).rounded() / scale
            return rounded == 0 ? 0 : rounded
        }
        return try CameraPose2D(
            centerX: value(pose.centerX),
            centerY: value(pose.centerY),
            zoom: value(pose.zoom),
            rollDegrees: value(pose.rollDegrees),
            focusAnchorX: pose.focusAnchorX.map(value),
            focusAnchorY: pose.focusAnchorY.map(value)
        ).normalized()
    }
}
