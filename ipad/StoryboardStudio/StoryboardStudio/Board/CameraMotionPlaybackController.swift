import Combine
import QuartzCore
import UIKit

/// Display-clock adapter for editor preview only. It emits rational document
/// times; CameraMotionEditorModel then quantizes every tick to the same exact
/// frame plan used by export.
@MainActor
final class CameraMotionPlaybackController: NSObject, ObservableObject {
    @Published private(set) var isPlaying = false

    private var displayLink: CADisplayLink?
    private var playbackStartTimestamp: CFTimeInterval?
    private var startValue: Int64 = 0
    private var endValue: Int64 = 0
    private var timelineTimescale: Int32 = 600
    private var onTick: ((MediaTime) -> Void)?
    private var onCompletion: (() -> Void)?

    func play(
        from startTime: MediaTime,
        through endTime: MediaTime,
        timelineTimescale: Int32,
        onTick: @escaping (MediaTime) -> Void,
        onCompletion: @escaping () -> Void = {}
    ) {
        stop()
        guard timelineTimescale > 0,
              endTime > startTime,
              let startValue = try? startTime.scaledValueExactly(
                to: timelineTimescale
              ),
              let endValue = try? endTime.scaledValueExactly(
                to: timelineTimescale
              ) else {
            onTick(endTime)
            onCompletion()
            return
        }

        self.startValue = startValue
        self.endValue = endValue
        self.timelineTimescale = timelineTimescale
        self.onTick = onTick
        self.onCompletion = onCompletion
        playbackStartTimestamp = nil
        isPlaying = true
        onTick(startTime)

        let link = CADisplayLink(
            target: self,
            selector: #selector(displayLinkDidFire(_:))
        )
        if #available(iOS 15.0, *) {
            link.preferredFrameRateRange = CAFrameRateRange(
                minimum: 24,
                maximum: 120,
                preferred: 60
            )
        }
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
        playbackStartTimestamp = nil
        onTick = nil
        onCompletion = nil
        isPlaying = false
    }

    @objc
    private func displayLinkDidFire(_ link: CADisplayLink) {
        guard isPlaying else { return }
        if playbackStartTimestamp == nil {
            playbackStartTimestamp = link.timestamp
        }
        guard let playbackStartTimestamp else { return }

        let elapsed = max(0, link.timestamp - playbackStartTimestamp)
        let elapsedTicksDouble = floor(
            elapsed * Double(timelineTimescale)
        )
        guard elapsedTicksDouble.isFinite,
              elapsedTicksDouble <= Double(Int64.max) else {
            finish()
            return
        }
        let addition = startValue.addingReportingOverflow(
            Int64(elapsedTicksDouble)
        )
        guard !addition.overflow else {
            finish()
            return
        }
        let value = min(endValue, addition.partialValue)
        guard let time = try? MediaTime(
            value: value,
            timescale: timelineTimescale
        ) else {
            finish()
            return
        }
        onTick?(time)
        if value >= endValue {
            finish(emitEndpoint: false)
        }
    }

    private func finish(emitEndpoint: Bool = true) {
        let tick = onTick
        let completion = onCompletion
        if emitEndpoint, let end = try? MediaTime(
            value: endValue,
            timescale: timelineTimescale
        ) {
            tick?(end)
        }
        stop()
        completion?()
    }
}
