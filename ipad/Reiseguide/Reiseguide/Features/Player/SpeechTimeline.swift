// SpeechTimeline.swift
//
// Ren logikk for opplesning på telefonen (AVSpeechSynthesizer) når et kapittel
// ikke har lydfil ennå. Ingen UI, ingen synthesizer — alt her testes i
// ReiseguideTests/SpeechFallbackTests.swift.
//
//   - SpeechTimeline: teksten som leses opp er tekstingssegmentene skjøtt
//     sammen, så tekstingen som vises alltid er setningen som leses. Hvert
//     segment har både tegn-intervall (UTF-16, samme enhet som NSRange i
//     `willSpeakRangeOfSpeechString`) og tidsintervall. Tid ↔ tegn går via
//     segmentgrensene, og lineært på tegn innenfor et segment.
//   - SpeechRateMapping: appens hastighet (0,8×–1,5×) → AVSpeechUtterance.rate.
//   - SpeechVoicePicker: beste stemme for innholdsspråket (premium > forbedret
//     > standard), uten novelty- og personlige stemmer.

import AVFoundation
import Foundation

struct SpeechTimeline: Sendable, Equatable {
    /// Ett segment (setning eller cue) i den opplest teksten.
    struct Span: Sendable, Equatable {
        let startOffset: Int
        let endOffset: Int
        let startS: Double
        let endS: Double
    }

    /// Teksten som gis til synthesizeren (segmentene skilt med mellomrom).
    let text: String
    let spans: [Span]
    let durationS: Double
    /// Lengde i UTF-16-enheter (NSString/NSRange).
    let length: Int

    /// Nil når det ikke finnes noe å lese opp.
    init?(segments: [CaptionSegment], durationS: Double) {
        var text = ""
        var spans: [Span] = []
        var cursor = 0
        for segment in segments.sorted(by: { $0.startS < $1.startS }) {
            let piece = segment.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !piece.isEmpty else { continue }
            if !spans.isEmpty {
                text += " "
                cursor += 1
            }
            let start = cursor
            text += piece
            cursor += piece.utf16.count
            spans.append(Span(startOffset: start, endOffset: cursor, startS: segment.startS, endS: segment.endS))
        }
        guard !spans.isEmpty else { return nil }
        self.text = text
        self.spans = spans
        self.length = cursor
        self.durationS = max(durationS, spans.last?.endS ?? 0)
    }

    /// Tidslinje for et kapittel uten lydfil: tekstingssegmentene hvis de
    /// finnes, ellers setninger anslått fra manuset over varigheten.
    static func make(segments: [CaptionSegment], scriptText: String, durationS: Double) -> SpeechTimeline? {
        if let timeline = SpeechTimeline(segments: segments, durationS: durationS) { return timeline }
        let estimated = CaptionTimeline.estimate(text: scriptText, durationS: max(1, durationS))
        return SpeechTimeline(segments: estimated, durationS: max(1, durationS))
    }

    /// Tegnposisjonen opplesningen skal starte fra ved spoling: starten på
    /// setningen som dekker `seconds` (eller neste setning i et opphold).
    /// `length` betyr at kapittelet er ferdig.
    func startOffset(atTime seconds: Double) -> Int {
        if seconds >= durationS - 0.05 { return length }
        let target = max(0, seconds)
        return spans.first { target < $0.endS }?.startOffset ?? length
    }

    /// Tidspunktet på tidslinjen for en tegnposisjon i `text`.
    func time(atOffset offset: Int) -> Double {
        if offset >= length { return durationS }
        guard let span = spans.last(where: { $0.startOffset <= offset }) else {
            return spans.first?.startS ?? 0
        }
        let chars = max(1, span.endOffset - span.startOffset)
        let fraction = min(1, max(0, Double(offset - span.startOffset) / Double(chars)))
        return span.startS + (span.endS - span.startS) * fraction
    }

    /// Resten av teksten fra en tegnposisjon (UTF-16).
    func text(from offset: Int) -> String {
        let clamped = min(max(0, offset), length)
        return (text as NSString).substring(from: clamped)
    }
}

enum SpeechRateMapping {
    /// Hvor mye AVSpeechUtterance.rate endres per 1× i avspillingshastighet.
    /// Skalaen er ikke lineær i ord per minutt; 0,25 gir 0,8× ≈ 0,45 og
    /// 1,5× ≈ 0,625, som høres naturlig ut rundt standardhastigheten 0,5.
    static let slope: Float = 0.25

    static func utteranceRate(forPlaybackRate playbackRate: Double) -> Float {
        let mapped = AVSpeechUtteranceDefaultSpeechRate + Float(playbackRate - 1) * slope
        return min(AVSpeechUtteranceMaximumSpeechRate, max(AVSpeechUtteranceMinimumSpeechRate, mapped))
    }
}

/// Stemmebeskrivelse uten AVFoundation-objektet, så valget kan testes.
struct SpeechVoiceCandidate: Sendable, Equatable {
    enum Quality: Int, Sendable, Comparable {
        case standard = 1
        case enhanced = 2
        case premium = 3

        static func < (lhs: Quality, rhs: Quality) -> Bool { lhs.rawValue < rhs.rawValue }
    }

    let identifier: String
    let language: String
    let quality: Quality
    /// Novelty- og personlige stemmer skal aldri lese fortellingen.
    let isExcluded: Bool
}

enum SpeechVoicePicker {
    /// BCP-47-koder i foretrukket rekkefølge for et innholdsspråk.
    static func preferredLanguages(for language: String) -> [String] {
        let base = baseCode(language)
        var result: [String] = language.contains("-") ? [language] : []
        switch base {
        case "nb", "no", "nn": result += ["nb-NO", "no-NO", "nn-NO"]
        case "en": result += ["en-US", "en-GB"]
        case "da": result += ["da-DK"]
        default: break
        }
        return result.reduce(into: [String]()) { list, code in
            if !list.contains(code) { list.append(code) }
        }
    }

    /// Beste stemme: høyest kvalitet først, deretter foretrukket region.
    /// Nil når ingen stemme passer språket (synthesizeren bruker da standard).
    static func pick(from voices: [SpeechVoiceCandidate], language: String) -> SpeechVoiceCandidate? {
        let preferred = preferredLanguages(for: language)
        let family = languageFamily(for: language)
        let ranked = voices.compactMap { voice -> (voice: SpeechVoiceCandidate, regionRank: Int)? in
            guard !voice.isExcluded else { return nil }
            if let index = preferred.firstIndex(where: { $0.caseInsensitiveCompare(voice.language) == .orderedSame }) {
                return (voice: voice, regionRank: index)
            }
            if family.contains(baseCode(voice.language)) { return (voice: voice, regionRank: preferred.count) }
            return nil
        }
        return ranked.min { lhs, rhs in
            if lhs.voice.quality != rhs.voice.quality { return lhs.voice.quality > rhs.voice.quality }
            return lhs.regionRank < rhs.regionRank
        }?.voice
    }

    /// Kode for `AVSpeechSynthesisVoice(language:)` når ingen stemme ble valgt.
    static func fallbackLanguageCode(for language: String) -> String {
        preferredLanguages(for: language).first ?? language
    }

    private static func baseCode(_ code: String) -> String {
        String(code.split(separator: "-").first ?? Substring(code)).lowercased()
    }

    private static func languageFamily(for language: String) -> Set<String> {
        let base = baseCode(language)
        return ["nb", "no", "nn"].contains(base) ? ["nb", "no", "nn"] : [base]
    }
}
