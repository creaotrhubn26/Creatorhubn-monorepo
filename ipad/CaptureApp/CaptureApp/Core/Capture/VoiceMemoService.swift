import Foundation
import AVFoundation

/// Per-asset voice memo recorder + player. Photographers use these to
/// dictate client instructions while shooting ("kunden vil ha denne",
/// "16:9 crop", "skin retouch needed") so the post-shoot retouch +
/// delivery flow can act on intent without relying on memory.
///
/// Storage layout: one m4a per asset under
/// `<sessionDownloadDirectory>/voice-memos/<assetId>.m4a`. The path is
/// mirrored onto `Asset.voiceMemoKey` via ``SessionStore`` so the assets
/// stream re-emits when a memo lands and the UI updates without polling.
///
/// Threading: `@MainActor` because AVAudioPlayer + AVAudioRecorder
/// callbacks land on the main run loop and we want the UI to react
/// in-step with start/stop without thread hopping. Recording itself
/// runs in AVAudioSession's background recorder thread.
///
/// Concurrency: only one recording session at a time. Starting a new
/// recording while one is active stops the previous one first.
/// Playback is also single-instance.
@MainActor
@Observable
final class VoiceMemoService {

    enum State: Equatable {
        case idle
        case recording(assetId: UUID, startedAt: Date)
        case playing(assetId: UUID)
    }

    /// Hard cap on per-memo length. Memos are pre-shoot intent, not
    /// long-form audio — 60 s avoids accidental drain (forgot-to-stop)
    /// and keeps disk usage bounded for a long session.
    static let maxRecordingDuration: TimeInterval = 60

    private(set) var state: State = .idle
    private let outputDirectory: URL

    private var recorder: AVAudioRecorder?
    private var player: AVAudioPlayer?
    private var autoStopTask: Task<Void, Never>?

    init(outputDirectory: URL) {
        self.outputDirectory = outputDirectory
        try? FileManager.default.createDirectory(
            at: outputDirectory,
            withIntermediateDirectories: true,
        )
    }

    /// Stable on-disk path for `assetId`'s voice memo. Stable across
    /// calls so callers can `FileManager.fileExists(atPath:)` to check
    /// without coordinating with the service.
    func memoURL(for assetId: UUID) -> URL {
        outputDirectory.appendingPathComponent("\(assetId.uuidString).m4a")
    }

    /// Begin recording for `assetId`. Returns immediately; recording
    /// runs until ``stopRecording()`` or the 60 s cap. The cap also
    /// fires `onComplete` so the caller can persist the memo path
    /// (`SessionStore.attachVoiceMemoKey`).
    /// - Parameter onComplete: invoked on the main actor when the
    ///   memo finishes (manual stop or cap reached). Receives the
    ///   resulting file URL on success, or `nil` on failure.
    func startRecording(
        assetId: UUID,
        onComplete: @MainActor @escaping (URL?) -> Void,
    ) {
        if case .recording = state { stopRecording() }
        if case .playing = state { stopPlayback() }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)
        } catch {
            onComplete(nil)
            return
        }

        let url = memoURL(for: assetId)
        try? FileManager.default.removeItem(at: url)

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue
        ]

        do {
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            guard recorder.record() else {
                onComplete(nil)
                return
            }
            self.recorder = recorder
            state = .recording(assetId: assetId, startedAt: Date())
            // Auto-stop after the cap. Cancellable so manual stop
            // (which transitions state to .idle and finalizes
            // synchronously) doesn't trigger a double-finalize.
            autoStopTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(Self.maxRecordingDuration))
                guard !Task.isCancelled else { return }
                await self?.finalize(assetId: assetId, onComplete: onComplete)
            }
        } catch {
            onComplete(nil)
        }
    }

    /// Stop the current recording and invoke `onComplete` from the
    /// caller's `startRecording` invocation. Safe to call when not
    /// recording — no-op.
    func stopRecording() {
        guard case .recording = state else { return }
        autoStopTask?.cancel()
        autoStopTask = nil
        recorder?.stop()
        recorder = nil
        state = .idle
    }

    private func finalize(
        assetId: UUID,
        onComplete: @MainActor @escaping (URL?) -> Void,
    ) async {
        recorder?.stop()
        let url = memoURL(for: assetId)
        let exists = FileManager.default.fileExists(atPath: url.path)
        recorder = nil
        state = .idle
        onComplete(exists ? url : nil)
    }

    /// Convenience: stop recording AND fire the completion handler the
    /// caller passed at start. Use this from UI when the user taps
    /// "stop" — keeps recording lifecycle one-shot.
    func stopRecordingAndFinalize(
        assetId: UUID,
        onComplete: @MainActor @escaping (URL?) -> Void,
    ) {
        guard case .recording = state else { return }
        autoStopTask?.cancel()
        autoStopTask = nil
        Task { await finalize(assetId: assetId, onComplete: onComplete) }
    }

    /// Play the memo for `assetId`. No-op if the memo file doesn't
    /// exist. Stops any in-flight playback or recording first.
    func startPlayback(assetId: UUID) {
        if case .recording = state { stopRecording() }
        if case .playing = state { stopPlayback() }

        let url = memoURL(for: assetId)
        guard FileManager.default.fileExists(atPath: url.path) else { return }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)
        } catch {
            return
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            guard player.play() else { return }
            self.player = player
            state = .playing(assetId: assetId)
            // Schedule transition to idle when the file finishes. The
            // delegate-based approach is cleaner but adds boilerplate
            // for one bool — a polled task is fine for ≤60 s clips.
            Task { [weak self] in
                let duration = player.duration
                try? await Task.sleep(for: .milliseconds(Int(duration * 1000) + 100))
                await MainActor.run {
                    if case .playing(let id) = self?.state, id == assetId {
                        self?.state = .idle
                        self?.player = nil
                    }
                }
            }
        } catch { }
    }

    func stopPlayback() {
        guard case .playing = state else { return }
        player?.stop()
        player = nil
        state = .idle
    }

    /// Delete the memo file. Caller is responsible for clearing the
    /// `voiceMemoKey` on the asset row via ``SessionStore``.
    func deleteMemo(for assetId: UUID) {
        let url = memoURL(for: assetId)
        try? FileManager.default.removeItem(at: url)
        if case .playing(let id) = state, id == assetId { stopPlayback() }
        if case .recording(let id, _) = state, id == assetId { stopRecording() }
    }

    /// Tear down all state — call from `LiveCaptureModel.disconnect`
    /// to guarantee no rogue recorder keeps the audio session live
    /// after the user disconnects.
    func reset() {
        autoStopTask?.cancel()
        autoStopTask = nil
        recorder?.stop()
        recorder = nil
        player?.stop()
        player = nil
        state = .idle
        try? AVAudioSession.sharedInstance().setActive(false)
    }
}
