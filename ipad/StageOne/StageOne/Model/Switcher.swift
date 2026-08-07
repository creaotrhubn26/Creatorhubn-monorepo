import Foundation
import Observation

/// Multicam-switcher: program (ON AIR) + preview (NEXT), CUT og AUTO-krysstoning.
/// Sesjonstilstand — persisteres ikke.
@Observable @MainActor
final class Switcher {
    var programId: String?
    var previewId: String?
    var isAutoTransitioning = false
    var autoProgress: Double = 0
    @ObservationIgnored private var autoTask: Task<Void, Never>?

    /// Sørger for gyldige valg mot scenens kamera-noder (kalles ved visning + scene-endring).
    func ensureValid(in scene: SceneData) {
        let cams = scene.nodes.filter { $0.kind == .camera && $0.enabled }.map(\.id)
        if let p = programId, !cams.contains(p) { programId = nil }
        if let p = previewId, !cams.contains(p) { previewId = nil }
        if programId == nil { programId = cams.first }
        if previewId == nil || previewId == programId {
            previewId = cams.first { $0 != programId } ?? programId
        }
    }

    func cut() {
        guard !isAutoTransitioning else { return }
        swap(&programId, &previewId)
    }

    func setPreview(_ id: String) {
        guard !isAutoTransitioning, id != programId else { return }
        previewId = id
    }

    func auto(duration: Double = 0.8) {
        guard !isAutoTransitioning, previewId != nil, previewId != programId else { return }
        isAutoTransitioning = true
        autoProgress = 0
        autoTask = Task { [weak self] in
            let steps = 30
            for step in 1...steps {
                guard let self, !Task.isCancelled else { return }
                try? await Task.sleep(for: .milliseconds(Int(duration * 1000) / steps))
                self.autoProgress = Double(step) / Double(steps)
            }
            guard let self, !Task.isCancelled else { return }
            swap(&self.programId, &self.previewId)
            self.autoProgress = 0
            self.isAutoTransitioning = false
        }
    }
}
