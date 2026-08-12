import Foundation

/// Bildehastighet for timecode.
enum FrameRate: String, CaseIterable, Identifiable {
    case fps24 = "24"
    case fps25 = "25"
    case fps30 = "30"
    case fps50 = "50"
    case fps60 = "60"

    var id: String { rawValue }
    var fps: Int { Int(rawValue) ?? 25 }
}

/// Kilde for timecode-en.
enum TimecodeMode: String, CaseIterable, Identifiable {
    case wallClock = "Wall"
    case freeRun = "Free"

    var id: String { rawValue }
}

/// Timecode-generator: HH:MM:SS:FF.
///
/// - `.wallClock`: løper med døgnet (f.eks. 19:24:37:08), som en ekte filmklaff.
/// - `.freeRun`: teller opp fra 00:00:00:00 fra et referansepunkt
///   (`resetFreeRun()`), nyttig når man kjører egen klaffetid.
struct TimecodeEngine: Sendable {
    var frameRate: FrameRate = .fps25

    func string(
        at date: Date = .now,
        mode: TimecodeMode,
        freeRunReference: Date,
        calendar: Calendar = .current
    ) -> String {
        switch mode {
        case .wallClock:
            let c = calendar.dateComponents([.hour, .minute, .second, .nanosecond], from: date)
            let hour = c.hour ?? 0
            let minute = c.minute ?? 0
            let second = c.second ?? 0
            let nanos = Double(c.nanosecond ?? 0) / 1_000_000_000
            let totalSeconds = Double(hour * 3600 + minute * 60 + second) + nanos
            let frames = Int((totalSeconds * Double(frameRate.fps)).rounded(.down)) % frameRate.fps
            return String(format: "%02d:%02d:%02d:%02d", hour, minute, second, frames)

        case .freeRun:
            let elapsed = max(0, date.timeIntervalSince(freeRunReference))
            let totalFrames = Int((elapsed * Double(frameRate.fps)).rounded(.down))
            let frames = totalFrames % frameRate.fps
            let totalSeconds = totalFrames / frameRate.fps
            let hour = totalSeconds / 3600
            let minute = (totalSeconds % 3600) / 60
            let second = totalSeconds % 60
            return String(format: "%02d:%02d:%02d:%02d", hour, minute, second, frames)
        }
    }
}
