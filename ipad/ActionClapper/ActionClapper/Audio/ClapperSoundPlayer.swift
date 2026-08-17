import AVFoundation
import Foundation

/// Spiller den ekte klaffelyden (`Resources/clap.wav`) umiddelbart i
/// nedslagsøyeblikket — ingen buffer-forsinkelse.
///
/// Lydfilen mangler (f.eks. utenfor repoet) genereres en tilsvarende
/// klaffelyd i minnet og skrives til en midlertidig WAV som spilles.
///
/// Lydsesjonen settes til `.playback` slik at klaffen HØRES selv om
/// lydløs-bryteren er på — akkurat det man trenger på sett.
@MainActor
final class ClapperSoundPlayer {
    private var variantPlayers: [AVAudioPlayer] = []

    init() {
        configureSession()
        // Tre klaffelyd-varianter (nært/medium/stort rom) som randomiseres.
        var urls = ["clap-close", "clap-room", "clap-hall"]
            .compactMap { Bundle.main.url(forResource: $0, withExtension: "wav") }
        if urls.isEmpty {
            urls = [Self.writeSynthesizedClap()].compactMap { $0 }
        }
        variantPlayers = urls.compactMap { try? AVAudioPlayer(contentsOf: $0) }
        variantPlayers.forEach { $0.prepareToPlay() }
    }

    private func configureSession() {
        #if os(iOS)
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .default,
                options: [.mixWithOthers]   // blander med evt. kamera-monitor-lyd
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("[Clapper] lydsesjon-feil: \(error)")
        }
        #endif
    }

    /// Umiddelbar avspilling av en tilfeldig variant — stopper og starter på
    /// nytt for null ventetid selv ved raske gjentatte klapp.
    func play(strength: Float = 0.9) {
        guard let player = variantPlayers.randomElement() else { return }
        player.volume = min(max(strength, 0), 1)
        player.stop()
        player.currentTime = 0
        player.play()
    }

    // MARK: - Fallback: syntese → WAV

    private static func writeSynthesizedClap() -> URL? {
        let sampleRate = 48_000.0
        let duration = 0.4
        let n = Int(sampleRate * duration)
        var samples = [Double](repeating: 0, count: n)

        // Hoved-crack: lavpasset støy med rask demping (~60 ms).
        var prev = 0.0
        for i in 0..<n {
            let t = Double(i) / sampleRate
            if t < 0.06 {
                let x = Double.random(in: -1...1) * exp(-t * 70)
                prev = 0.25 * x + 0.75 * prev
                samples[i] += prev
            }
        }

        // Sekundær knock (dobbeltsmell) ~45 ms senere.
        prev = 0.0
        for i in 0..<n {
            let t = Double(i) / sampleRate
            let t2 = t - 0.045
            if t2 >= 0, t2 < 0.05 {
                let x = Double.random(in: -1...1) * exp(-t2 * 90)
                prev = 0.3 * x + 0.7 * prev
                samples[i] += prev * 0.6
            }
        }

        // Tre-resonans + lav thump.
        for i in 0..<n {
            let t = Double(i) / sampleRate
            samples[i] += sin(2 * .pi * 160 * t) * exp(-t * 30) * 0.5
            samples[i] += sin(2 * .pi * 205 * t) * exp(-t * 22) * 0.3
            samples[i] += sin(2 * .pi * 78 * t) * exp(-t * 10) * 0.35
        }

        // Tidlige refleksjoner (lite rom).
        func transient(_ t: Double) -> Double {
            var v = 0.0
            if t < 0.06 { v += exp(-t * 70) }
            let t2 = t - 0.045
            if t2 >= 0, t2 < 0.05 { v += exp(-t2 * 90) * 0.6 }
            return v
        }
        let reflections: [(Double, Double)] = [
            (0.010, 0.5), (0.019, 0.38), (0.030, 0.28),
            (0.044, 0.20), (0.061, 0.14), (0.081, 0.10)
        ]
        for i in 0..<n {
            let t = Double(i) / sampleRate
            for (d, a) in reflections {
                let tr = t - d
                if tr >= 0 { samples[i] += transient(tr) * a * 0.5 }
            }
        }

        let peak = samples.map { abs($0) }.max() ?? 1.0
        let gain = 0.95 / peak

        var data = Data()
        func append(_ s: String) { data.append(contentsOf: s.data(using: .ascii) ?? Data()) }
        func le16(_ value: UInt16) { var v = value.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }
        func le32(_ value: UInt32) { var v = value.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }

        append("RIFF"); le32(UInt32(36 + n * 2)); append("WAVE")
        append("fmt "); le32(16); le16(1); le16(1); le32(UInt32(sampleRate))
        le32(UInt32(sampleRate * 2)); le16(2); le16(16)
        append("data"); le32(UInt32(n * 2))

        for sample in samples {
            let v = Int16(max(-1, min(1, sample * gain)) * 32767)
            var little = v.littleEndian
            withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
        }

        let url = FileManager.default.temporaryDirectory.appendingPathComponent("clapper-synth.wav")
        do {
            try data.write(to: url)
            return url
        } catch {
            return nil
        }
    }
}
