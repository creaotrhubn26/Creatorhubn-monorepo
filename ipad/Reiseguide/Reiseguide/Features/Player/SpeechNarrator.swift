// SpeechNarrator.swift
//
// Opplesning på telefonen når kapittelet ikke har lydfil ennå (Soniox-
// pipelinen har ikke kjørt). Godkjent av Daniel som midlertidig løsning til
// ekte lyd finnes. AudioEngine eier én instans og ruter spill/pause/spol/
// hastighet hit når `load(url:)` får nil og manuset har tekst.
//
//   - Spill/pause/gjenoppta = speak / pauseSpeaking(at: .word) / continueSpeaking.
//   - Spoling (±15 s, fremdriftslinjen): stopper og starter på nytt fra
//     setningen som dekker måltiden (SpeechTimeline.startOffset). Omstart
//     skjer etter et kort opphold, så dra i fremdriftslinjen ikke gir en
//     storm av speak-kall.
//   - Posisjon: `willSpeakRangeOfSpeechString` → tegnposisjon → tid på
//     tidslinjen, så fremdrift og teksting følger det som faktisk leses.
//   - Ferdig: `didFinish` for gjeldende ytring → `isFinished`, og
//     AudioEngine.tick() melder kapittelet ferdig som før.
//   - Lydsesjonen: synthesizeren bruker appens sesjon (.playback,
//     .spokenAudio) som AudioEngine aktiverer, så opplesningen fortsetter
//     med skjermen låst og lydløs-bryteren på.
//   - VoiceOver: `prefersAssistiveTechnologySettings` lar VoiceOvers stemme og
//     tempo vinne når VoiceOver kjører.
//   - Stille stemme: starter ikke opplesningen innen `silenceTimeout` (en
//     forbedret stemme kan stå i listen uten at lyden er lastet ned), prøver
//     vi én gang til med systemets standardstemme for språket.
//
// Swift 6: delegatkallene er nonisolated. Vi tar bare ut Sendable-verdier
// (ObjectIdentifier, Int) og hopper til MainActor, samme mønster som
// LocationService.

import AVFoundation
import Foundation
import UIKit

/// Det AudioEngine trenger for å lese opp et kapittel.
struct SpeechScript: Sendable {
    let timeline: SpeechTimeline
    /// Innholdsspråket (variantens `lang`), f.eks. «nb» eller «en».
    let language: String
    /// Kapitteltittel som leses før teksten ved kapittelbytte når VoiceOver
    /// kjører, i stedet for en annonsering som ville snakket over opplesningen.
    let leadIn: String?

    /// Nil når manuset er tomt (da brukes den stille, simulerte tidslinjen).
    @MainActor
    static func make(
        chapter: GuideChapter,
        segments: [CaptionSegment],
        language: String,
        announceTitle: Bool,
        uiLanguage: String
    ) -> SpeechScript? {
        guard let timeline = SpeechTimeline.make(
            segments: segments,
            scriptText: chapter.scriptText,
            durationS: chapter.playbackDurationS
        ) else { return nil }
        var leadIn: String?
        if announceTitle, UIAccessibility.isVoiceOverRunning, let title = chapter.title {
            leadIn = L10n.string("player.newChapter", lang: uiLanguage).replacingOccurrences(of: "%@", with: title)
        }
        return SpeechScript(timeline: timeline, language: language, leadIn: leadIn)
    }
}

@MainActor
final class SpeechNarrator: NSObject {
    private enum State {
        case idle
        case restartPending
        case speaking
        case paused
    }

    private static let restartDelay: Duration = .milliseconds(180)
    private static let silenceTimeout: Duration = .seconds(3)

    private let synthesizer = AVSpeechSynthesizer()
    private var script: SpeechScript?
    private var voice: AVSpeechSynthesisVoice?
    private var state: State = .idle
    private var rate: Double = 1
    /// Ytringen vi følger; kall fra andre (avbrutte) ytringer ignoreres.
    private var currentUtterance: AVSpeechUtterance?
    private var runBaseOffset = 0
    /// Siste tegnposisjon som er lest opp (absolutt i `timeline.text`).
    private var spokenOffset = 0
    private var pendingLeadIn: String?
    private var restartTask: Task<Void, Never>?
    private var silenceTask: Task<Void, Never>?
    /// Satt når synthesizeren faktisk har begynt å lese i gjeldende kjøring.
    private var hasStartedRun = false
    private var usesFallbackVoice = false

    private(set) var positionS: Double = 0
    private(set) var isFinished = false

    override init() {
        super.init()
        synthesizer.delegate = self
        synthesizer.usesApplicationAudioSession = true
    }

    func load(_ script: SpeechScript, rate: Double) {
        stop()
        self.script = script
        self.rate = rate
        pendingLeadIn = script.leadIn
        voice = Self.bestVoice(for: script.language)
        usesFallbackVoice = false
    }

    func play() {
        guard let script, !isFinished else { return }
        switch state {
        case .speaking, .restartPending:
            return
        case .paused:
            if synthesizer.continueSpeaking() {
                state = .speaking
            } else {
                startRun(from: spokenOffset, in: script)
            }
        case .idle:
            startRun(from: spokenOffset, in: script)
        }
    }

    func pause() {
        restartTask?.cancel()
        restartTask = nil
        switch state {
        case .speaking:
            if synthesizer.pauseSpeaking(at: .word) {
                state = .paused
            } else {
                halt()
            }
        case .restartPending:
            state = .idle
        case .idle, .paused:
            break
        }
    }

    func seek(to seconds: Double) {
        guard let script else { return }
        let offset = script.timeline.startOffset(atTime: seconds)
        let wasSpeaking = state == .speaking || state == .restartPending
        halt()
        pendingLeadIn = nil
        spokenOffset = offset
        positionS = script.timeline.time(atOffset: offset)
        isFinished = offset >= script.timeline.length
        if wasSpeaking, !isFinished { scheduleRestart() }
    }

    /// Ny hastighet gjelder fra neste ytring; midt i en ytring startes det
    /// på nytt fra ordet som leses nå.
    func setRate(_ newRate: Double) {
        guard abs(newRate - rate) > 0.001 else { return }
        rate = newRate
        switch state {
        case .speaking, .restartPending:
            halt()
            scheduleRestart()
        case .paused:
            // Pauset ytring har gammel hastighet; start på nytt ved neste play().
            halt()
        case .idle:
            break
        }
    }

    func stop() {
        halt()
        script = nil
        pendingLeadIn = nil
        spokenOffset = 0
        positionS = 0
        isFinished = false
    }

    // MARK: - Privat

    /// Stopper opplesningen umiddelbart; posisjonen beholdes.
    private func halt() {
        restartTask?.cancel()
        restartTask = nil
        silenceTask?.cancel()
        silenceTask = nil
        currentUtterance = nil
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        state = .idle
    }

    private func scheduleRestart() {
        state = .restartPending
        restartTask = Task { [weak self] in
            try? await Task.sleep(for: Self.restartDelay)
            guard let self, !Task.isCancelled, self.state == .restartPending, let script = self.script else { return }
            self.startRun(from: self.spokenOffset, in: script)
        }
    }

    private func startRun(from offset: Int, in script: SpeechScript) {
        restartTask = nil
        guard offset < script.timeline.length else {
            markFinished(script)
            return
        }
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        if let leadIn = pendingLeadIn {
            pendingLeadIn = nil
            synthesizer.speak(makeUtterance(leadIn))
        }
        let utterance = makeUtterance(script.timeline.text(from: offset))
        runBaseOffset = offset
        spokenOffset = offset
        currentUtterance = utterance
        state = .speaking
        hasStartedRun = false
        synthesizer.speak(utterance)
        watchForSilence(utterance)
    }

    private func watchForSilence(_ utterance: AVSpeechUtterance) {
        silenceTask?.cancel()
        guard !usesFallbackVoice else { return }
        let utteranceID = ObjectIdentifier(utterance)
        silenceTask = Task { [weak self] in
            try? await Task.sleep(for: Self.silenceTimeout)
            guard let self, !Task.isCancelled, self.state == .speaking, !self.hasStartedRun,
                  let current = self.currentUtterance, ObjectIdentifier(current) == utteranceID,
                  let script = self.script else { return }
            self.usesFallbackVoice = true
            self.voice = AVSpeechSynthesisVoice(language: SpeechVoicePicker.fallbackLanguageCode(for: script.language))
            self.startRun(from: self.spokenOffset, in: script)
        }
    }

    private func makeUtterance(_ text: String) -> AVSpeechUtterance {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        utterance.rate = SpeechRateMapping.utteranceRate(forPlaybackRate: rate)
        utterance.preUtteranceDelay = 0
        utterance.postUtteranceDelay = 0
        utterance.prefersAssistiveTechnologySettings = true
        return utterance
    }

    private func markFinished(_ script: SpeechScript) {
        currentUtterance = nil
        state = .idle
        spokenOffset = script.timeline.length
        positionS = script.timeline.durationS
        isFinished = true
    }

    fileprivate func didStartSpeaking() {
        hasStartedRun = true
    }

    fileprivate func didReach(location: Int, in utteranceID: ObjectIdentifier) {
        hasStartedRun = true
        guard let script, let currentUtterance, ObjectIdentifier(currentUtterance) == utteranceID else { return }
        spokenOffset = min(runBaseOffset + location, script.timeline.length)
        positionS = script.timeline.time(atOffset: spokenOffset)
    }

    fileprivate func didFinish(_ utteranceID: ObjectIdentifier) {
        guard let script, let currentUtterance, ObjectIdentifier(currentUtterance) == utteranceID else { return }
        markFinished(script)
    }

    private static func bestVoice(for language: String) -> AVSpeechSynthesisVoice? {
        let voices = AVSpeechSynthesisVoice.speechVoices()
        let candidates = voices.map { voice in
            SpeechVoiceCandidate(
                identifier: voice.identifier,
                language: voice.language,
                quality: quality(of: voice),
                isExcluded: voice.voiceTraits.contains(.isNoveltyVoice) || voice.voiceTraits.contains(.isPersonalVoice)
            )
        }
        if let picked = SpeechVoicePicker.pick(from: candidates, language: language),
           let voice = AVSpeechSynthesisVoice(identifier: picked.identifier) {
            return voice
        }
        return AVSpeechSynthesisVoice(language: SpeechVoicePicker.fallbackLanguageCode(for: language))
    }

    private static func quality(of voice: AVSpeechSynthesisVoice) -> SpeechVoiceCandidate.Quality {
        switch voice.quality {
        case .premium: return .premium
        case .enhanced: return .enhanced
        case .default: return .standard
        @unknown default: return .standard
        }
    }
}

extension SpeechNarrator: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        Task { @MainActor in self.didStartSpeaking() }
    }

    nonisolated func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        willSpeakRangeOfSpeechString characterRange: NSRange,
        utterance: AVSpeechUtterance
    ) {
        let utteranceID = ObjectIdentifier(utterance)
        let location = characterRange.location
        Task { @MainActor in self.didReach(location: location, in: utteranceID) }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let utteranceID = ObjectIdentifier(utterance)
        Task { @MainActor in self.didFinish(utteranceID) }
    }
}
