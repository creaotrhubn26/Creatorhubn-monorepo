import CoreHaptics
import UIKit

/// Fysisk nedslag i nøyaktig samme øyeblikk som klaffelyden.
///
/// Der enheten støtter det (Taptic Engine) spilles en skarp «crack» med kort
/// tre-etterklang — som en ekte klaff. Fallback er et heavy-impact.
@MainActor
final class HapticsManager {
    private var engine: CHHapticEngine?
    private let fallback = UIImpactFeedbackGenerator(style: .heavy)

    init() {
        prepareEngine()
        fallback.prepare()
    }

    private func prepareEngine() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        let engine = try? CHHapticEngine()
        self.engine = engine
        engine?.isAutoShutdownEnabled = true
        do {
            try engine?.start()
        } catch {
            print("[Clapper] kunne ikke starte haptisk motor: \(error)")
        }
    }

    /// Forbered rett før nedslaget (reduserer latens).
    func prepare() {
        fallback.prepare()
    }

    /// Skarp «crack»: hardt angrep + kort tre-etterklang.
    func impact() {
        if let engine {
            do {
                let sharp = CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0)
                    ],
                    relativeTime: 0
                )
                let wood = CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.45),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.25)
                    ],
                    relativeTime: 0.05
                )
                let pattern = try CHHapticPattern(events: [sharp, wood], parameters: [])
                let player = try engine.makePlayer(with: pattern)
                try player.start(atTime: CHHapticTimeImmediate)
                return
            } catch {
                // Fallback under.
            }
        }
        fallback.impactOccurred(intensity: 1.0)
    }
}
