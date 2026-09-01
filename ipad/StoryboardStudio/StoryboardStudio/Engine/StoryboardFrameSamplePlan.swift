import Foundation

enum StoryboardFrameSamplePlanError: Error, Sendable, Equatable {
    case invalidShotDuration
    case invalidProjectFrameRate
    case inexactShotDuration(timelineTimescale: Int32)
    case inexactShotStart(timelineTimescale: Int32)
    case inexactProjectFrameDuration(timelineTimescale: Int32)
    case sampleCountExceedsLimit(Int64)
    case arithmeticOverflow
}

/// One exact project-frame presentation sample. localTime is shot-relative;
/// presentationTime includes shotStart and is suitable for AVFoundation PTS.
struct StoryboardFrameSample: Sendable, Equatable {
    let index: Int64
    let localTime: MediaTime
    let presentationTime: MediaTime
}

/// Immutable frame grid shared by interactive playback and export.
///
/// Samples use the half-open interval [0, shotDuration). This prevents the last
/// frame of one shot and the first frame of the next shot from claiming the same
/// PTS. A scrubber may still evaluate the explicit shotDuration endpoint
/// directly to inspect the authored end pose.
struct StoryboardFrameSamplePlan: Sendable, Equatable {
    static let maximumSampleCount: Int64 = 40_000

    let shotDuration: MediaTime
    let shotStart: MediaTime
    let shotEnd: MediaTime
    let projectFrameRate: MediaTime
    let timelineTimescale: Int32
    /// Exact integer number of timeline ticks per project frame.
    let frameDurationValue: Int64
    let samples: [StoryboardFrameSample]

    static func make(
        shotDuration: MediaTime,
        timing: StoryboardTiming,
        shotStart: MediaTime = .zero
    ) throws -> StoryboardFrameSamplePlan {
        guard shotDuration > .zero else {
            throw StoryboardFrameSamplePlanError.invalidShotDuration
        }
        let frameRate = timing.projectFrameRate
        guard frameRate > .zero,
              frameRate.value <= Int64(Int32.max) else {
            throw StoryboardFrameSamplePlanError.invalidProjectFrameRate
        }

        let durationValue: Int64
        do {
            durationValue = try shotDuration.scaledValueExactly(
                to: timing.timelineTimescale
            )
        } catch {
            throw StoryboardFrameSamplePlanError.inexactShotDuration(
                timelineTimescale: timing.timelineTimescale
            )
        }
        let startValue: Int64
        do {
            startValue = try shotStart.scaledValueExactly(
                to: timing.timelineTimescale
            )
        } catch {
            throw StoryboardFrameSamplePlanError.inexactShotStart(
                timelineTimescale: timing.timelineTimescale
            )
        }

        let frameDuration: MediaTime
        do {
            frameDuration = try MediaTime(
                value: Int64(frameRate.timescale),
                timescale: Int32(frameRate.value)
            )
        } catch {
            throw StoryboardFrameSamplePlanError.invalidProjectFrameRate
        }
        let frameDurationValue: Int64
        do {
            frameDurationValue = try frameDuration.scaledValueExactly(
                to: timing.timelineTimescale
            )
        } catch {
            throw StoryboardFrameSamplePlanError
                .inexactProjectFrameDuration(
                    timelineTimescale: timing.timelineTimescale
                )
        }
        guard frameDurationValue > 0 else {
            throw StoryboardFrameSamplePlanError.invalidProjectFrameRate
        }

        let wholeFrames = durationValue / frameDurationValue
        let sampleCount = wholeFrames
            + (durationValue % frameDurationValue == 0 ? 0 : 1)
        guard sampleCount > 0 else {
            throw StoryboardFrameSamplePlanError.invalidShotDuration
        }
        guard sampleCount <= maximumSampleCount else {
            throw StoryboardFrameSamplePlanError.sampleCountExceedsLimit(
                sampleCount
            )
        }

        let endResult = startValue.addingReportingOverflow(durationValue)
        guard !endResult.overflow else {
            throw StoryboardFrameSamplePlanError.arithmeticOverflow
        }

        let shotEnd = try MediaTime(
            value: endResult.partialValue,
            timescale: timing.timelineTimescale
        )
        var samples: [StoryboardFrameSample] = []
        samples.reserveCapacity(Int(sampleCount))
        for index in 0..<sampleCount {
            let localResult = index.multipliedReportingOverflow(
                by: frameDurationValue
            )
            guard !localResult.overflow,
                  localResult.partialValue < durationValue else {
                throw StoryboardFrameSamplePlanError.arithmeticOverflow
            }
            let presentationResult = startValue.addingReportingOverflow(
                localResult.partialValue
            )
            guard !presentationResult.overflow else {
                throw StoryboardFrameSamplePlanError.arithmeticOverflow
            }
            samples.append(StoryboardFrameSample(
                index: index,
                localTime: try MediaTime(
                    value: localResult.partialValue,
                    timescale: timing.timelineTimescale
                ),
                presentationTime: try MediaTime(
                    value: presentationResult.partialValue,
                    timescale: timing.timelineTimescale
                )
            ))
        }

        return StoryboardFrameSamplePlan(
            shotDuration: shotDuration,
            shotStart: shotStart,
            shotEnd: shotEnd,
            projectFrameRate: frameRate,
            timelineTimescale: timing.timelineTimescale,
            frameDurationValue: frameDurationValue,
            samples: samples
        )
    }

    /// Quantizes an arbitrary shot-local scrub/playback time down to the exact
    /// project-frame grid without using Double seconds.
    func sample(
        atOrBeforeLocalTime time: MediaTime
    ) -> StoryboardFrameSample? {
        guard !samples.isEmpty else { return nil }
        let clamped = time.clamped(to: .zero...shotDuration)
        guard let requestedValue = try? clamped.scaledValue(
            to: timelineTimescale,
            rounding: .towardZero
        ) else { return nil }
        let index = min(
            Int64(samples.count - 1),
            requestedValue / frameDurationValue
        )
        guard index >= 0 else { return samples.first }
        return samples[Int(index)]
    }
}
