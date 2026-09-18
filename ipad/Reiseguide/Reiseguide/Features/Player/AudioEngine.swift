// AudioEngine.swift
//
// Lydlaget under avspilleren. To moduser:
//   - Ekte lyd (kapittelet har audio.url): AVPlayer over AVAudioSession
//     .playback UTEN mixWithOthers, så appen eier lydstrømmen og VoiceOver
//     dukker automatisk (UI-spesifikasjon 8.4, punkt 3). Spiller videre med
//     skjermen låst (UIBackgroundModes: audio).
//   - Simulert tidslinje (ingen lydfil ennå, steg 2 leverer TTS): en klokke
//     som går i valgt hastighet over kapittelets anslåtte varighet, så
//     teksting, fremdrift og kapittelbytte kan prøves før lyden finnes.
// Låseskjerm og Kontrollsenter får de samme kontrollene via
// MPRemoteCommandCenter / MPNowPlayingInfoCenter (8.4, punkt 8).

import AVFoundation
import Foundation
import MediaPlayer

@MainActor
final class AudioEngine {
    struct NowPlaying: Sendable {
        let title: String
        let chapterTitle: String?
        let durationS: Double
    }

    private var player: AVPlayer?
    private var simulatedPositionS: Double = 0
    private var lastTickAt: Date?
    private(set) var rate: Double = 1
    private(set) var isPlaying = false
    private var durationS: Double = 60
    private var interruptionObserver: NSObjectProtocol?

    /// Kalles av PlayerViewModel når låseskjermen ber om noe.
    var onRemotePlay: (() -> Void)?
    var onRemotePause: (() -> Void)?
    var onRemoteSkip: ((Double) -> Void)?

    init() {
        configureRemoteCommands()
        observeInterruptions()
    }

    var currentPositionS: Double {
        if let player {
            let seconds = player.currentTime().seconds
            return seconds.isFinite ? seconds : 0
        }
        return simulatedPositionS
    }

    var isSimulated: Bool { player == nil }

    /// Laster et kapittel. `url` nil = simulert tidslinje.
    func load(url: URL?, durationS: Double, nowPlaying: NowPlaying) {
        stopInternal()
        self.durationS = max(1, durationS)
        simulatedPositionS = 0
        if let url {
            let item = AVPlayerItem(url: url)
            let player = AVPlayer(playerItem: item)
            player.automaticallyWaitsToMinimizeStalling = true
            self.player = player
        }
        updateNowPlaying(nowPlaying)
    }

    func play() {
        activateSession()
        isPlaying = true
        if let player {
            player.rate = Float(rate)
        } else {
            lastTickAt = Date()
        }
        updatePlaybackState()
    }

    func pause() {
        isPlaying = false
        player?.pause()
        lastTickAt = nil
        updatePlaybackState()
    }

    func setRate(_ newRate: Double) {
        rate = newRate
        if isPlaying, let player { player.rate = Float(newRate) }
        updatePlaybackState()
    }

    func seek(to seconds: Double) {
        let clamped = min(max(0, seconds), durationS)
        if let player {
            player.seek(to: CMTime(seconds: clamped, preferredTimescale: 600))
        } else {
            simulatedPositionS = clamped
            lastTickAt = isPlaying ? Date() : nil
        }
        updatePlaybackState()
    }

    /// Kalles fra en MainActor-ticker; returnerer true når kapittelet er ferdig.
    func tick() -> Bool {
        guard isPlaying else { return false }
        if player == nil, let last = lastTickAt {
            let now = Date()
            simulatedPositionS += now.timeIntervalSince(last) * rate
            lastTickAt = now
        }
        if currentPositionS >= durationS - 0.05 {
            return true
        }
        return false
    }

    func stop() {
        stopInternal()
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: - Privat

    private func stopInternal() {
        isPlaying = false
        player?.pause()
        player = nil
        lastTickAt = nil
        simulatedPositionS = 0
    }

    private func activateSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            // Ikke .mixWithOthers: appen eier lydstrømmen (8.4, punkt 3).
            try session.setCategory(.playback, mode: .spokenAudio, options: [])
            try session.setActive(true)
        } catch {
            // Simulert tidslinje fungerer uten sesjon.
        }
    }

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.onRemotePlay?() }
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.onRemotePause?() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if self.isPlaying { self.onRemotePause?() } else { self.onRemotePlay?() }
            }
            return .success
        }
        center.skipForwardCommand.preferredIntervals = [15]
        center.skipForwardCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.onRemoteSkip?(15) }
            return .success
        }
        center.skipBackwardCommand.preferredIntervals = [15]
        center.skipBackwardCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.onRemoteSkip?(-15) }
            return .success
        }
    }

    /// Innkommende telefon eller annen lyd: pause, gjenoppta når avbruddet er over (6.4).
    private func observeInterruptions() {
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            let shouldResume: Bool = {
                guard let optionsRaw = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt else { return false }
                return AVAudioSession.InterruptionOptions(rawValue: optionsRaw).contains(.shouldResume)
            }()
            Task { @MainActor in
                guard let self else { return }
                switch type {
                case .began:
                    self.onRemotePause?()
                case .ended:
                    if shouldResume { self.onRemotePlay?() }
                @unknown default:
                    break
                }
            }
        }
    }

    private func updateNowPlaying(_ info: NowPlaying) {
        var nowPlaying: [String: Any] = [
            MPMediaItemPropertyTitle: info.title,
            MPMediaItemPropertyPlaybackDuration: info.durationS,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: 0,
            MPNowPlayingInfoPropertyPlaybackRate: 0,
        ]
        if let chapter = info.chapterTitle {
            nowPlaying[MPMediaItemPropertyArtist] = chapter
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlaying
    }

    private func updatePlaybackState() {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentPositionS
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? rate : 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
}
