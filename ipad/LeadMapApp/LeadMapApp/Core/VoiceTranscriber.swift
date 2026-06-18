// VoiceTranscriber.swift
//
// Speech-til-tekst for visit-notater. Bruker SFSpeechRecognizer (on-
// device hvis støttet på enheten) + AVAudioEngine for capture.
//
// Permissions kreves i Info.plist:
//   NSSpeechRecognitionUsageDescription
//   NSMicrophoneUsageDescription
//
// API:
//   let t = VoiceTranscriber()
//   try await t.requestPermissions()
//   try t.start { transcript in ... }
//   t.stop()
//
// Norsk lokalisering: bytter til nb_NO der det er støttet, ellers
// faller tilbake til standard.

import Foundation
import Speech
import AVFoundation

@MainActor
final class VoiceTranscriber: NSObject, ObservableObject {
    enum TranscriberError: Error, LocalizedError {
        case permissionDenied(String)
        case unavailable
        case sessionFailed(String)

        var errorDescription: String? {
            switch self {
            case .permissionDenied(let what):
                return "\(what)-tilgang nektet. Aktivér i Innstillinger."
            case .unavailable:
                return "Tale-gjenkjenning ikke tilgjengelig på denne enheten."
            case .sessionFailed(let msg):
                return "Lyd-session feilet: \(msg)"
            }
        }
    }

    @Published var isRecording = false
    @Published var transcript: String = ""
    @Published var error: String?

    private var recognizer: SFSpeechRecognizer?
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    override init() {
        super.init()
        // Foretrekk norsk hvis støttet
        if SFSpeechRecognizer.supportedLocales().contains(where: { $0.identifier == "nb_NO" }) {
            recognizer = SFSpeechRecognizer(locale: Locale(identifier: "nb_NO"))
        } else if SFSpeechRecognizer.supportedLocales().contains(where: { $0.identifier == "no_NO" }) {
            recognizer = SFSpeechRecognizer(locale: Locale(identifier: "no_NO"))
        } else {
            recognizer = SFSpeechRecognizer()
        }
    }

    /// Be om permission for Speech + Mic. Kaster TranscriberError ved avslag.
    func requestPermissions() async throws {
        // Speech recognition
        let speechStatus = await withCheckedContinuation { (cont: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status)
            }
        }
        switch speechStatus {
        case .authorized: break
        case .denied, .restricted, .notDetermined:
            throw TranscriberError.permissionDenied("Tale-gjenkjenning")
        @unknown default:
            throw TranscriberError.permissionDenied("Tale-gjenkjenning")
        }

        // Mikrofon
        let micGranted: Bool = await withCheckedContinuation { cont in
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
        if !micGranted {
            throw TranscriberError.permissionDenied("Mikrofon")
        }
    }

    /// Start transkripsjon. Kaller `onUpdate` med oppdatert transcript
    /// for hver del-erkjennelse.
    func start(onUpdate: @escaping @Sendable (String) -> Void) throws {
        if isRecording { return }
        guard let recognizer, recognizer.isAvailable else {
            throw TranscriberError.unavailable
        }
        // Reset
        transcript = ""

        // Audio session
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            throw TranscriberError.sessionFailed(error.localizedDescription)
        }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        if #available(iOS 16.0, *) {
            req.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
        }
        self.request = req

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            req.append(buffer)
        }

        task = recognizer.recognitionTask(with: req) { [weak self] result, err in
            guard let self else { return }
            Task { @MainActor in
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                    onUpdate(self.transcript)
                }
                if err != nil || (result?.isFinal ?? false) {
                    self.cleanup()
                }
            }
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
            isRecording = true
        } catch {
            throw TranscriberError.sessionFailed(error.localizedDescription)
        }
    }

    func stop() {
        guard isRecording else { return }
        request?.endAudio()
        cleanup()
    }

    private func cleanup() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request = nil
        task?.cancel()
        task = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
