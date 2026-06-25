// AudioRecorder.swift
//
// Native iOS voice-memo recorder for Leadgrid Meeting Notes.
// Bruker AVAudioRecorder m/ AAC 16kHz mono (komfortabel for tale + lav størrelse
// for base64-upload til Whisper). Designet for å være en uavhengig komponent —
// VoiceTranscriber (Apple Speech) håndterer live-diktering; denne håndterer
// råopptak til fil for backend-prosessering (Whisper + Claude action items).

import Foundation
import AVFoundation
import Observation

@MainActor
@Observable
final class AudioRecorder: NSObject, AVAudioRecorderDelegate {
    private(set) var isRecording = false
    private(set) var currentDuration: TimeInterval = 0
    private(set) var permissionGranted = false
    private(set) var errorMessage: String?

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var recordingURL: URL?

    func requestPermission() async {
        let granted: Bool = await withCheckedContinuation { cont in
            if #available(iOS 17.0, *) {
                AVAudioApplication.requestRecordPermission { granted in
                    cont.resume(returning: granted)
                }
            } else {
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    cont.resume(returning: granted)
                }
            }
        }
        self.permissionGranted = granted
    }

    func startRecording() async -> Bool {
        if !permissionGranted { await requestPermission() }
        if !permissionGranted {
            errorMessage = "Mikrofon-tilgang kreves for voice memo"
            return false
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.allowBluetooth])
            try session.setActive(true)

            let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let url = docs.appendingPathComponent("leadgrid-memo-\(UUID().uuidString).m4a")
            self.recordingURL = url

            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 16_000,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
            ]
            let r = try AVAudioRecorder(url: url, settings: settings)
            r.delegate = self
            r.prepareToRecord()
            r.record()
            self.recorder = r
            self.isRecording = true
            self.currentDuration = 0
            startTimer()
            errorMessage = nil
            return true
        } catch {
            errorMessage = "Kunne ikke starte: \(error.localizedDescription)"
            return false
        }
    }

    func stopRecording() -> (data: Data, duration: TimeInterval)? {
        guard let r = recorder, let url = recordingURL else { return nil }
        let duration = r.currentTime
        r.stop()
        recorder = nil
        timer?.invalidate()
        timer = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        guard let data = try? Data(contentsOf: url) else { return nil }
        // Slett lokal fil — den er allerede i memory + uploadet
        try? FileManager.default.removeItem(at: url)
        recordingURL = nil
        return (data, duration)
    }

    func cancelRecording() {
        recorder?.stop()
        recorder = nil
        timer?.invalidate()
        timer = nil
        isRecording = false
        if let url = recordingURL {
            try? FileManager.default.removeItem(at: url)
        }
        recordingURL = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.currentDuration = self?.recorder?.currentTime ?? 0
            }
        }
    }

    // MARK: - AVAudioRecorderDelegate
    nonisolated func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        Task { @MainActor in
            self.errorMessage = "Encoding-feil: \(error?.localizedDescription ?? "ukjent")"
        }
    }
}
