import AVFoundation
import MediaPlayer
import UIKit

/// Lar de fysiske volumknappene utløse klappen — som en kamerautløser.
///
/// Teknikk (samme som shutter-apper):
/// 1. En nesten-lydløs loop spilles, så systemet «eier» volumknappene og vi
///    får hendelser uten at medievolumet er knyttet til synlig avspilling.
/// 2. `AVAudioSession.outputVolume` polses ~60 ganger i sekundet.
/// 3. Ved endring utløses `onVolumePress` og systemvolumet gjenopprettes
///    umiddelbart via en usynlig `MPVolumeView`-slider — ingen hørbar endring,
///    ingen volum-HUD.
///
/// Hele monitoren kjører på MainActor, og responsen er < ~100 ms.
@MainActor
final class VolumeButtonMonitor {
    private var silentPlayer: AVAudioPlayer?
    private var slider: UISlider?
    private var pollTask: Task<Void, Never>?
    private var lastVolume: Float = 0
    private var restoreUntil: Date = .distantPast

    /// Kalles ved hvert volumknappetrykk (opp eller ned).
    var onVolumePress: (() -> Void)?

    func start() {
        guard pollTask == nil else { return }
        startSilentLoop()
        installVolumeView()
        lastVolume = AVAudioSession.sharedInstance().outputVolume

        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                self?.poll()
                try? await Task.sleep(for: .milliseconds(16))
            }
        }
    }

    func stop() {
        pollTask?.cancel()
        pollTask = nil
        silentPlayer?.stop()
    }

    private func poll() {
        // I gjenopprettings-vinduet ignorerer vi vår egen volumendring.
        guard Date() >= restoreUntil else { return }

        let current = AVAudioSession.sharedInstance().outputVolume
        let delta = current - lastVolume
        guard abs(delta) > 0.005 else { return }

        let previous = lastVolume
        lastVolume = previous   // behold baseline

        onVolumePress?()

        // Gjenopprett systemvolumet umiddelbart.
        slider?.value = previous
        restoreUntil = Date().addingTimeInterval(0.35)
    }

    private func startSilentLoop() {
        guard let url = Self.makeSilentWAV() else { return }
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.numberOfLoops = -1
            player.volume = 0.03
            player.prepareToPlay()
            player.play()
            silentPlayer = player
        } catch {
            print("[Clapper] kunne ikke starte lydløs loop: \(error)")
        }
    }

    private func installVolumeView() {
        let view = MPVolumeView(frame: CGRect(x: -200, y: -200, width: 1, height: 1))
        view.isHidden = true
        if let window = Self.keyWindow {
            window.addSubview(view)
            slider = view.subviews.compactMap { $0 as? UISlider }.first
        }
    }

    private static var keyWindow: UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }

    /// Genererer en 1 s nesten-lydløs WAV som loopes (bare nok signal til at
    /// systemet behandler knappene som medievolum).
    private static func makeSilentWAV() -> URL? {
        let sampleRate = 44_100
        let numSamples = sampleRate * 1
        let dataSize = numSamples * 2

        var data = Data()
        func append(_ s: String) { data.append(contentsOf: s.data(using: .ascii) ?? Data()) }
        func le16(_ value: UInt16) { var v = value.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }
        func le32(_ value: UInt32) { var v = value.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }

        append("RIFF"); le32(UInt32(36 + dataSize)); append("WAVE")
        append("fmt "); le32(16); le16(1); le16(1); le32(UInt32(sampleRate))
        le32(UInt32(sampleRate * 2)); le16(2); le16(16)
        append("data"); le32(UInt32(dataSize))

        for i in 0..<numSamples {
            let v = Int16((sin(2 * .pi * 30 * Double(i) / Double(sampleRate)) * 4).rounded())
            var little = v.littleEndian
            withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
        }

        let url = FileManager.default.temporaryDirectory.appendingPathComponent("clapper-silent.wav")
        do {
            try data.write(to: url)
            return url
        } catch {
            return nil
        }
    }
}
