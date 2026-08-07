import Foundation
import Observation

/// Spiller shot-sekvensen: holder posisjon i tid, sier hvilket kamera som er aktivt.
@Observable @MainActor
final class ShotPlayer {
    var isPlaying = false
    var elapsed: Double = 0
    private(set) var shots: [Shot] = []
    @ObservationIgnored private var driveTask: Task<Void, Never>?

    func load(shots: [Shot]) {
        self.shots = shots
        elapsed = min(elapsed, totalDuration)
    }

    var totalDuration: Double { shots.reduce(0) { $0 + $1.durationSec } }

    var currentShotIndex: Int? { Self.shotIndex(at: elapsed, in: shots) }

    /// Delt med ExportEngine: hvilket shot gjelder ved gitt tidspunkt.
    static func shotIndex(at elapsed: Double, in shots: [Shot]) -> Int? {
        guard !shots.isEmpty else { return nil }
        var t = 0.0
        for (i, shot) in shots.enumerated() {
            t += shot.durationSec
            if elapsed < t { return i }
        }
        return shots.count - 1
    }

    func currentCameraId(in scene: SceneData) -> String? {
        guard let i = currentShotIndex else { return nil }
        let id = shots[i].cameraNodeId
        return scene.node(id) != nil ? id : nil
    }

    func play() {
        guard !isPlaying, !shots.isEmpty else { return }
        if elapsed >= totalDuration { elapsed = 0 }
        isPlaying = true
        driveTask = Task { [weak self] in
            while let self, self.isPlaying, !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(33))
                self.tick(dt: 0.033)
            }
        }
    }

    func pause() {
        isPlaying = false
        driveTask?.cancel()
        driveTask = nil
    }

    func jump(toShotIndex index: Int) {
        guard shots.indices.contains(index) else { return }
        elapsed = shots.prefix(index).reduce(0) { $0 + $1.durationSec }
    }

    func tick(dt: Double) {
        guard isPlaying else { return }
        elapsed += dt
        if elapsed >= totalDuration {
            elapsed = totalDuration
            pause()
        }
    }

    var timecode: String {
        let s = Int(elapsed)
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}
