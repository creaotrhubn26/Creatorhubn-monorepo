// SpeechFallbackTests.swift
//
// Ren logikk for opplesning på telefonen (Features/Player/SpeechTimeline.swift):
// tid ↔ tegnposisjon, hastighet og stemmevalg. Selve AVSpeechSynthesizer
// testes ikke her.

import AVFoundation
import XCTest
@testable import Reiseguide

final class SpeechFallbackTests: XCTestCase {
    // MARK: - SpeechTimeline

    private func makeTimeline() throws -> SpeechTimeline {
        // «Første setning.» (15) + « » + «Andre!» (6) + « » + «Tredje?» (7)
        let segments = CaptionTimeline.estimate(text: "Første setning. Andre! Tredje?", durationS: 29)
        return try XCTUnwrap(SpeechTimeline(segments: segments, durationS: 29))
    }

    func testTimelineJoinsSegmentsWithUtf16Offsets() throws {
        let timeline = try makeTimeline()
        XCTAssertEqual(timeline.text, "Første setning. Andre! Tredje?")
        XCTAssertEqual(timeline.length, (timeline.text as NSString).length)
        XCTAssertEqual(timeline.spans.map(\.startOffset), [0, 16, 23])
        XCTAssertEqual(timeline.spans.map(\.endOffset), [15, 22, 30])
        XCTAssertEqual(timeline.spans.last?.endS ?? 0, 29, accuracy: 0.001)
    }

    func testSeekSnapsToStartOfSentenceAtTargetTime() throws {
        let timeline = try makeTimeline()
        let second = timeline.spans[1]
        XCTAssertEqual(timeline.startOffset(atTime: 0), 0)
        XCTAssertEqual(timeline.startOffset(atTime: -5), 0)
        XCTAssertEqual(timeline.startOffset(atTime: second.startS + 0.1), second.startOffset)
        XCTAssertEqual(timeline.startOffset(atTime: second.endS - 0.1), second.startOffset)
        XCTAssertEqual(timeline.startOffset(atTime: second.endS), timeline.spans[2].startOffset)
    }

    func testSeekToEndMeansFinished() throws {
        let timeline = try makeTimeline()
        XCTAssertEqual(timeline.startOffset(atTime: 29), timeline.length)
        XCTAssertEqual(timeline.startOffset(atTime: 100), timeline.length)
        XCTAssertEqual(timeline.time(atOffset: timeline.length), 29)
    }

    func testTimeAtOffsetInterpolatesWithinSentence() throws {
        let timeline = try makeTimeline()
        let first = timeline.spans[0]
        XCTAssertEqual(timeline.time(atOffset: 0), 0)
        XCTAssertEqual(timeline.time(atOffset: 8), first.endS * 8 / 15, accuracy: 0.001)
        // Starten på en setning gir setningens starttid, så tekstingen som
        // vises er setningen som leses.
        for span in timeline.spans {
            let t = timeline.time(atOffset: span.startOffset)
            XCTAssertEqual(t, span.startS, accuracy: 0.001)
            let caption = CaptionTimeline.segment(at: t, in: CaptionTimeline.estimate(text: timeline.text, durationS: 29))
            XCTAssertEqual(caption?.startS ?? -1, span.startS, accuracy: 0.001)
        }
    }

    func testTimeIsMonotonicOverOffsets() throws {
        let timeline = try makeTimeline()
        var last = -1.0
        for offset in 0 ... timeline.length {
            let t = timeline.time(atOffset: offset)
            XCTAssertGreaterThanOrEqual(t, last)
            last = t
        }
    }

    func testTextFromOffsetResumesAtSentence() throws {
        let timeline = try makeTimeline()
        XCTAssertEqual(timeline.text(from: timeline.spans[1].startOffset), "Andre! Tredje?")
        XCTAssertEqual(timeline.text(from: timeline.length), "")
    }

    func testRealCueTimesAreUsedAsSentenceBoundaries() throws {
        let cues = [
            CaptionSegment(startS: 10, endS: 20, text: "To."),
            CaptionSegment(startS: 0, endS: 4, text: "En."),
            CaptionSegment(startS: 4, endS: 5, text: "  ")
        ]
        let timeline = try XCTUnwrap(SpeechTimeline(segments: cues, durationS: 20))
        XCTAssertEqual(timeline.text, "En. To.")
        XCTAssertEqual(timeline.startOffset(atTime: 7), 4)
        XCTAssertEqual(timeline.time(atOffset: 4), 10, accuracy: 0.001)
    }

    func testEmptyScriptHasNoTimeline() {
        XCTAssertNil(SpeechTimeline(segments: [], durationS: 30))
        XCTAssertNil(SpeechTimeline.make(segments: [], scriptText: "   ", durationS: 30))
        XCTAssertNotNil(SpeechTimeline.make(segments: [], scriptText: "Hei.", durationS: 0))
    }

    // MARK: - Hastighet

    func testRateMappingKeepsNormalSpeedAndIsMonotonic() {
        XCTAssertEqual(SpeechRateMapping.utteranceRate(forPlaybackRate: 1), AVSpeechUtteranceDefaultSpeechRate)
        let mapped = [0.8, 1, 1.25, 1.5].map { SpeechRateMapping.utteranceRate(forPlaybackRate: $0) }
        XCTAssertEqual(mapped, mapped.sorted())
        XCTAssertLessThan(mapped[0], AVSpeechUtteranceDefaultSpeechRate)
        XCTAssertLessThanOrEqual(SpeechRateMapping.utteranceRate(forPlaybackRate: 10), AVSpeechUtteranceMaximumSpeechRate)
        XCTAssertGreaterThanOrEqual(SpeechRateMapping.utteranceRate(forPlaybackRate: -10), AVSpeechUtteranceMinimumSpeechRate)
    }

    // MARK: - Stemmevalg

    private func voice(_ id: String, _ lang: String, _ quality: SpeechVoiceCandidate.Quality, excluded: Bool = false) -> SpeechVoiceCandidate {
        SpeechVoiceCandidate(identifier: id, language: lang, quality: quality, isExcluded: excluded)
    }

    func testPicksHighestQualityNorwegianVoice() {
        let voices = [
            voice("sv", "sv-SE", .premium),
            voice("nora", "nb-NO", .standard),
            voice("nora-enh", "nb-NO", .enhanced),
            voice("novelty", "nb-NO", .premium, excluded: true)
        ]
        XCTAssertEqual(SpeechVoicePicker.pick(from: voices, language: "nb")?.identifier, "nora-enh")
    }

    func testEnglishPrefersUSAtEqualQualityButPremiumWins() {
        let equal = [voice("gb", "en-GB", .enhanced), voice("us", "en-US", .enhanced), voice("au", "en-AU", .enhanced)]
        XCTAssertEqual(SpeechVoicePicker.pick(from: equal, language: "en")?.identifier, "us")
        let premiumGB = [voice("gb", "en-GB", .premium), voice("us", "en-US", .standard)]
        XCTAssertEqual(SpeechVoicePicker.pick(from: premiumGB, language: "en")?.identifier, "gb")
        let onlyAU = [voice("au", "en-AU", .standard), voice("nb", "nb-NO", .premium)]
        XCTAssertEqual(SpeechVoicePicker.pick(from: onlyAU, language: "en")?.identifier, "au")
    }

    func testNoMatchingVoiceFallsBackToLanguageDefault() {
        XCTAssertNil(SpeechVoicePicker.pick(from: [voice("de", "de-DE", .premium)], language: "nb"))
        XCTAssertEqual(SpeechVoicePicker.fallbackLanguageCode(for: "nb"), "nb-NO")
        XCTAssertEqual(SpeechVoicePicker.fallbackLanguageCode(for: "en"), "en-US")
        XCTAssertEqual(SpeechVoicePicker.fallbackLanguageCode(for: "de"), "de")
        XCTAssertEqual(SpeechVoicePicker.pick(from: [voice("de", "de-DE", .standard)], language: "de")?.identifier, "de")
    }
}
