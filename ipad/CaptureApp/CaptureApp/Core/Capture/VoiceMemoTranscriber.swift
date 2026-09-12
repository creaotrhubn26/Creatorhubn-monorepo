// VoiceMemoTranscriber.swift
//
// On-device transkribering (gratis) av de innspilte voice-memoene — som til nå
// bare har vært lyd. Bruker SFSpeechRecognizer med norsk locale og tvinger
// on-device når enheten støtter det (offline, personvern). Transkriptet kan
// mates videre til NotesIntelligence for oppsummering/oppgave-uttrekk.

import Foundation
import Speech

@MainActor
final class VoiceMemoTranscriber {
    enum TranscriptionError: Error {
        case notAuthorized
        case recognizerUnavailable
    }

    /// Transkriber en lydfil (m4a fra VoiceMemoService) → tekst.
    func transcribe(fileURL: URL, locale: Locale = Locale(identifier: "nb-NO")) async throws -> String {
        let status = await Self.requestAuthorization()
        guard status == .authorized else { throw TranscriptionError.notAuthorized }

        guard let recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer(),
              recognizer.isAvailable else {
            throw TranscriptionError.recognizerUnavailable
        }

        let request = SFSpeechURLRecognitionRequest(url: fileURL)
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
        request.shouldReportPartialResults = false

        let guardOnce = ResumeGuard()
        return try await withCheckedThrowingContinuation { continuation in
            recognizer.recognitionTask(with: request) { result, error in
                if let error {
                    if guardOnce.claim() { continuation.resume(throwing: error) }
                    return
                }
                if let result, result.isFinal {
                    let text = result.bestTranscription.formattedString
                    if guardOnce.claim() { continuation.resume(returning: text) }
                }
            }
        }
    }

    /// Er transkribering tilgjengelig (autorisert + recognizer klar)?
    static func isAvailable(locale: Locale = Locale(identifier: "nb-NO")) -> Bool {
        SFSpeechRecognizer.authorizationStatus() == .authorized
            && (SFSpeechRecognizer(locale: locale)?.isAvailable ?? false)
    }

    static func requestAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
    }
}

/// Sikrer at en checked-continuation resumes nøyaktig én gang (SFSpeech-callback
/// kommer fra en vilkårlig tråd og kan i teorien kalles flere ganger).
private final class ResumeGuard: @unchecked Sendable {
    private var claimed = false
    private let lock = NSLock()
    func claim() -> Bool {
        lock.lock(); defer { lock.unlock() }
        if claimed { return false }
        claimed = true
        return true
    }
}
