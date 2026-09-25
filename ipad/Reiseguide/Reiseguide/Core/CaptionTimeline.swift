// CaptionTimeline.swift
//
// Tekstingstidslinjen avspilleren viser (5.16): cues fra backend (Soniox-
// ordtider) når de finnes. Uten cues (steg 2 ikke kjørt) deles manuset i
// setninger fordelt jevnt over varigheten, så tekstingsvisningen kan prøves
// før lyden finnes. Merket `isEstimated`. Egen fil (flyttet ut av
// PlayerViewModel.swift, som nærmet seg SwiftLint sin file_length-grense):
// ren logikk uten avhengighet til PlayerViewModel eller Observation.

import Foundation

struct CaptionSegment: Sendable, Equatable {
    let startS: Double
    let endS: Double
    let text: String
}

enum CaptionTimeline {
    /// Bygger tidslinje fra ekte cues, ellers fra manuset (jevnt fordelt).
    static func build(chapter: GuideChapter) -> (segments: [CaptionSegment], isEstimated: Bool) {
        let real = (chapter.captions?.cues ?? []).compactMap { cue -> CaptionSegment? in
            guard let start = cue.startS, let end = cue.endS, let text = cue.text, end > start, !text.isEmpty else { return nil }
            return CaptionSegment(startS: start, endS: end, text: text)
        }
        if !real.isEmpty { return (real.sorted { $0.startS < $1.startS }, false) }
        return (estimate(text: chapter.scriptText, durationS: chapter.playbackDurationS), true)
    }

    static func estimate(text: String, durationS: Double) -> [CaptionSegment] {
        let sentences = splitSentences(text)
        guard !sentences.isEmpty, durationS > 0 else { return [] }
        let totalChars = Double(sentences.reduce(0) { $0 + $1.count })
        var cursor = 0.0
        return sentences.map { sentence in
            let share = totalChars > 0 ? Double(sentence.count) / totalChars : 1 / Double(sentences.count)
            let start = cursor
            cursor += durationS * share
            return CaptionSegment(startS: start, endS: cursor, text: sentence)
        }
    }

    static func splitSentences(_ text: String) -> [String] {
        var result: [String] = []
        var current = ""
        for character in text {
            current.append(character)
            if ".!?".contains(character) {
                let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { result.append(trimmed) }
                current = ""
            }
        }
        let rest = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rest.isEmpty { result.append(rest) }
        return result
    }

    static func segment(at seconds: Double, in segments: [CaptionSegment]) -> CaptionSegment? {
        segments.first { seconds >= $0.startS && seconds < $0.endS }
    }
}
