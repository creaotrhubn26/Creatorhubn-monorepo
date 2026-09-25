// ChapterPrompts.swift
//
// «Spørsmål underveis» (pakke 3, migrasjon 0662_reiseguide_chapter_prompts.sql):
// korte innslag som dukker opp midt i et kapittel av fortellingen.
//   - look  = «Se opp: …»-kort med haptikk og annonsering; avspillingen fortsetter,
//             kortet står til brukeren lukker det eller kapittelet byttes.
//   - guess = gjettespørsmål; fortellingen pauser, brukeren velger et svar, får
//             fasit og trykker «Fortsett». Pausen skjer IKKE i det atFraction
//             passeres (det kuttet lyden brått midt i en setning), men ved
//             slutten av tekstingssegmentet som er i gang, se
//             ChapterPromptPauseTiming.
// Backend gir posisjonen som andel av kapittelet (atFraction, 0 ≤ x < 1) fordi
// ekte lydlengder ikke finnes ennå; tidspunktet er atFraction × varigheten.
//
// ChapterPromptTracker er ren logikk (enhetstestet): et innslag vises når
// AVSPILLINGEN passerer tidspunktet, ikke når brukeren spoler forbi, og hvert
// innslag vises bare én gang per avspilling av stedet.

import Foundation
import Observation

enum ChapterPromptKind: String, Sendable {
    case look
    case guess
}

/// Ett innslag fra backend. `kind` dekodes som tekst så en ukjent type fra en
/// nyere backend hoppes over i stedet for å velte dekodingen av hele området.
struct ChapterPrompt: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let kind: String
    let atFraction: Double
    let text: String
    let options: [String]?
    let answerIndex: Int?
    let revealText: String?

    var promptKind: ChapterPromptKind? { ChapterPromptKind(rawValue: kind) }

    /// Kjent type, posisjon i [0, 1), tekst, og for guess 2–4 alternativer med gyldig fasit.
    var isValid: Bool {
        guard atFraction >= 0, atFraction < 1,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        switch promptKind {
        case .some(.look):
            return true
        case .some(.guess):
            guard let options, let answerIndex else { return false }
            return (2 ... 4).contains(options.count) && options.indices.contains(answerIndex)
        case .none:
            return false
        }
    }

    /// Riktig alternativ for guess; nil for look.
    var correctOption: String? {
        guard let options, let answerIndex, options.indices.contains(answerIndex) else { return nil }
        return options[answerIndex]
    }

    func triggerTimeS(durationS: Double) -> Double {
        atFraction * max(0, durationS)
    }
}

extension GuideChapter {
    /// Innslagene i kapittelet; tom når backend (eller en eldre cache) ikke har noen.
    var promptList: [ChapterPrompt] { prompts ?? [] }
}

/// Ren tidslogikk for innslagene i ett kapittel.
struct ChapterPromptTracker: Equatable, Sendable {
    /// Et hopp større enn dette mellom to tikk er spoling, ikke avspilling
    /// (tikk hvert 250 ms i opptil 1,5× gir 0,375 s).
    static let maxPlaybackStepS: Double = 2

    private(set) var prompts: [ChapterPrompt] = []
    private(set) var durationS: Double = 0
    /// Starter under null så et innslag på atFraction 0 vises ved første tikk.
    private(set) var lastPositionS: Double = -1
    /// Innslag som allerede er vist i denne avspillingen av stedet.
    private(set) var shownIds: Set<String> = []

    /// Nytt kapittel: gyldige innslag sortert på tidspunkt.
    mutating func load(prompts: [ChapterPrompt], durationS: Double) {
        self.prompts = prompts.filter(\.isValid).sorted { $0.atFraction < $1.atFraction }
        self.durationS = max(0, durationS)
        lastPositionS = -1
    }

    /// Nytt sted: glem hva som er vist.
    mutating func resetSession() {
        prompts = []
        durationS = 0
        lastPositionS = -1
        shownIds = []
    }

    /// Spoling flytter bare utgangspunktet; ingenting vises av å spole forbi.
    mutating func seek(to positionS: Double) {
        lastPositionS = positionS
    }

    /// Kalles ved hvert tikk under avspilling. Returnerer innslaget som ble
    /// passert siden forrige tikk, om noe. Passeres flere på én gang, vises det
    /// første nå og resten ved neste tikk.
    mutating func advance(to positionS: Double) -> ChapterPrompt? {
        let previous = lastPositionS
        guard positionS > previous, positionS - max(previous, 0) <= Self.maxPlaybackStepS else {
            lastPositionS = positionS
            return nil
        }
        let hit = prompts.first { prompt in
            let time = prompt.triggerTimeS(durationS: durationS)
            return !shownIds.contains(prompt.id) && time > previous && time <= positionS
        }
        guard let hit else {
            lastPositionS = positionS
            return nil
        }
        shownIds.insert(hit.id)
        lastPositionS = hit.triggerTimeS(durationS: durationS)
        return hit
    }
}

/// Ren tidslogikk for NÅR avspillingen skal pause etter et gjettespørsmål.
/// Eieren rapporterte at lyden stoppet brått midt i en setning fordi pausen
/// skjedde nøyaktig på `atFraction × varigheten`. I stedet ventes det til
/// setningen som er i gang er ferdig (tekstingssegmentet som dekker
/// tidspunktet innslaget ble passert), med et tak så en unormalt lang eller
/// manglende tekstingsdata aldri utsetter pausen for lenge.
enum ChapterPromptPauseTiming {
    /// Maks ventetid utover trigger-tidspunktet, selv om segmentet er lengre
    /// (manglende/feil tekstingsdata skal ikke stoppe avspillingen i evigheter).
    static let maxWaitS: Double = 8

    /// Tidspunktet avspillingen skal pause: slutten på tekstingssegmentet som
    /// dekker `triggeredAtS`, maks `maxWaitS` unna. Uten et dekkende segment
    /// pauses det med det samme (`triggeredAtS`).
    static func pauseTimeS(triggeredAtS: Double, segments: [CaptionSegment]) -> Double {
        guard let segment = CaptionTimeline.segment(at: triggeredAtS, in: segments) else {
            return triggeredAtS
        }
        return min(segment.endS, triggeredAtS + maxWaitS)
    }
}

/// Tilstanden avspilleren viser: hvilket innslag som står fremme og hva
/// brukeren har svart. Eies av PlayerViewModel (`prompts`).
@MainActor
@Observable
final class ChapterPromptController {
    private(set) var active: ChapterPrompt?
    /// Alternativet brukeren valgte på et gjettespørsmål; nil til det er besvart.
    private(set) var chosenIndex: Int?
    /// Antall innslag vist i denne avspillingen (tester og feilsøking).
    private(set) var presentationCount = 0

    @ObservationIgnored private var tracker = ChapterPromptTracker()
    /// Et gjettespørsmål som er passert, men venter til setningen som er i
    /// gang er ferdig, før kortet vises og avspillingen faktisk pauses.
    @ObservationIgnored private var pendingGuess: ChapterPrompt?
    @ObservationIgnored private var pendingPauseAtS: Double?

    /// Nytt sted i avspilleren.
    func resetSession() {
        tracker.resetSession()
        presentationCount = 0
        cancelPending()
        dismiss()
    }

    /// Nytt kapittel (eller variant): kortet forsvinner og tidslinjen byttes.
    func load(chapter: GuideChapter?) {
        tracker.load(prompts: chapter?.promptList ?? [], durationS: chapter?.playbackDurationS ?? 0)
        cancelPending()
        dismiss()
    }

    /// Spoling/hopping kansellerer en eventuell utsatt pause: den hørte til
    /// tidspunktet brukeren nettopp forlot.
    func seek(to positionS: Double) {
        tracker.seek(to: positionS)
        cancelPending()
    }

    /// Kalles ved hvert tikk. Returnerer true når avspillingen skal pause NÅ.
    /// Et gjettespørsmål pauser ikke i det øyeblikket det passeres — kortet
    /// vises og pausen skjer først ved `ChapterPromptPauseTiming.pauseTimeS`,
    /// så kortet og stillheten kommer samtidig (8.4). Med innstillingen av
    /// går tidslinjen videre uten å vise noe, så ingenting hoper seg opp om
    /// den slås på igjen.
    func advance(to positionS: Double, segments: [CaptionSegment], enabled: Bool) -> Bool {
        if pendingGuess != nil {
            // Hold tidslinjen i takt uten å plukke opp nye innslag mens vi
            // venter på at setningen som var i gang skal bli ferdig.
            tracker.seek(to: positionS)
            guard let pendingPauseAtS, positionS >= pendingPauseAtS else { return false }
            firePendingGuess()
            return true
        }
        let hit = tracker.advance(to: positionS)
        guard enabled, let hit else { return false }
        guard hit.promptKind == .guess else {
            active = hit
            chosenIndex = nil
            presentationCount += 1
            return false
        }
        pendingGuess = hit
        let pauseAtS = min(ChapterPromptPauseTiming.pauseTimeS(triggeredAtS: positionS, segments: segments), tracker.durationS)
        guard pauseAtS > positionS else {
            firePendingGuess()
            return true
        }
        pendingPauseAtS = pauseAtS
        return false
    }

    func choose(_ index: Int) {
        guard let active, active.promptKind == .guess, chosenIndex == nil,
              active.options?.indices.contains(index) == true else { return }
        chosenIndex = index
    }

    func dismiss() {
        active = nil
        chosenIndex = nil
    }

    private func firePendingGuess() {
        guard let pendingGuess else { return }
        active = pendingGuess
        chosenIndex = nil
        presentationCount += 1
        cancelPending()
    }

    private func cancelPending() {
        pendingGuess = nil
        pendingPauseAtS = nil
    }
}
