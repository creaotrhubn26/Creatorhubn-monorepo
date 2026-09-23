// PlayerViewModel.swift
//
// Tilstand for avspilleren: valgt severdighet, variant (fortelling eller
// synstolking), kapittel, posisjon, hastighet og teksting. Kapittelbytte skjer
// automatisk. Synstolking spilles I STEDET FOR fortellingen når brukeren velger
// den (6.4), og synstolkingskortet viser teksten til det som spilles nå.
//
// Teksting: cues fra backend (Soniox-ordtider) når de finnes. Uten cues (steg 2
// ikke kjørt) deles manuset i setninger fordelt jevnt over varigheten, så
// tekstingsvisningen kan prøves før lyden finnes. Merket `isEstimated`.
//
// Besøk («etter besøket», 18.09.2026): start(poi:) logger besøket i
// VisitLogStore; når siste kapittel er ferdig, eller brukeren trykker
// «Avslutt besøket», merkes det fullført og `finishedVisit` settes så
// avspilleren kan vise quiz, vurdering, tips og deling.

import Foundation
import Observation

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

@MainActor
@Observable
final class PlayerViewModel {
    static let rates: [Double] = [0.8, 1, 1.25, 1.5]

    private(set) var poi: GuidePOI?
    private(set) var variantKind: VariantKind = .narration
    private(set) var chapterIndex = 0
    private(set) var positionS: Double = 0
    private(set) var isPlaying = false
    private(set) var captionSegments: [CaptionSegment] = []
    private(set) var captionsAreEstimated = false
    /// Kapittelbytte annonseres én gang (8.4, punkt 6); visningen nullstiller.
    var pendingChapterAnnouncement: String?
    var isPresented = false
    var audioDescriptionExpanded = false

    /// Besøket som nettopp ble fullført; avspilleren viser etter-besøket-arket.
    var finishedVisit: FinishedVisit?
    /// Loggoppføringen for det som spilles nå.
    private(set) var currentVisitId: String?

    struct FinishedVisit: Identifiable, Equatable {
        let entryId: String
        let poi: GuidePOI
        var id: String { entryId }
    }

    @ObservationIgnored private let engine = AudioEngine()
    @ObservationIgnored private let settings: AppSettings
    @ObservationIgnored private let visits: VisitLogStore
    @ObservationIgnored private var ticker: Task<Void, Never>?

    init(settings: AppSettings, visits: VisitLogStore) {
        self.settings = settings
        self.visits = visits
        engine.onRemotePlay = { [weak self] in self?.play() }
        engine.onRemotePause = { [weak self] in self?.pause() }
        engine.onRemoteSkip = { [weak self] delta in self?.skip(by: delta) }
    }

    var hasContent: Bool { poi != nil }

    var variant: GuideVariant? {
        guard let poi else { return nil }
        switch variantKind {
        case .narration: return poi.variants.narration ?? poi.variants.audioDescription
        case .audioDescription: return poi.variants.audioDescription ?? poi.variants.narration
        }
    }

    var chapter: GuideChapter? {
        guard let variant, variant.chapters.indices.contains(chapterIndex) else { return nil }
        return variant.chapters[chapterIndex]
    }

    var durationS: Double { chapter?.playbackDurationS ?? 0 }
    var rate: Double { settings.playbackRate }
    var captionsEnabled: Bool { settings.captionsEnabled }
    var isSimulated: Bool { engine.isSimulated }

    var currentCaption: String? {
        CaptionTimeline.segment(at: positionS, in: captionSegments)?.text
    }

    /// Teksten synstolkingskortet viser: synstolkingen for gjeldende kapittel,
    /// uansett hvilken variant som spilles.
    var audioDescriptionText: String? {
        guard let poi, let ad = poi.variants.audioDescription else { return nil }
        let chapterNo = chapter?.no ?? 1
        return (ad.chapters.first { $0.no == chapterNo } ?? ad.chapters.first)?.scriptText
    }

    var audioDescriptionImageUrl: String? {
        guard let poi, let ad = poi.variants.audioDescription else { return chapter?.imageUrl ?? poi?.heroImageUrl }
        let chapterNo = chapter?.no ?? 1
        return (ad.chapters.first { $0.no == chapterNo } ?? ad.chapters.first)?.imageUrl ?? poi.heroImageUrl
    }

    // MARK: - Handlinger

    func start(poi: GuidePOI, kind: VariantKind = .narration) {
        self.poi = poi
        variantKind = kind
        chapterIndex = 0
        audioDescriptionExpanded = false
        finishedVisit = nil
        currentVisitId = visits.recordStart(poi: poi).id
        isPresented = true
        loadChapter(announce: false)
        play()
    }

    /// «Avslutt besøket»: stopper, merker besøket fullført og åpner etter-besøket.
    func finishVisit() {
        guard let poi else { return }
        pause()
        let entryId = currentVisitId ?? visits.recordStart(poi: poi).id
        currentVisitId = entryId
        visits.markCompleted(entryId: entryId)
        finishedVisit = FinishedVisit(entryId: entryId, poi: poi)
        endLiveActivity()
    }

    func selectVariant(_ kind: VariantKind) {
        guard kind != variantKind else { return }
        let wasPlaying = isPlaying
        let chapterNo = chapter?.no
        variantKind = kind
        if let variant, let index = variant.chapters.firstIndex(where: { $0.no == chapterNo }) {
            chapterIndex = index
        } else {
            chapterIndex = 0
        }
        loadChapter(announce: false)
        if wasPlaying { play() }
    }

    func play() {
        guard chapter != nil else { return }
        engine.play()
        isPlaying = true
        startTicker()
        startOrUpdateLiveActivity(isPlaying: true)
    }

    func pause() {
        engine.pause()
        isPlaying = false
        stopTicker()
        startOrUpdateLiveActivity(isPlaying: false)
    }

    func togglePlayPause() {
        if isPlaying { pause() } else { play() }
    }

    func skip(by seconds: Double) {
        seek(to: positionS + seconds)
    }

    func seek(to seconds: Double) {
        let clamped = min(max(0, seconds), durationS)
        engine.seek(to: clamped)
        positionS = clamped
    }

    func cycleRate() {
        let current = settings.playbackRate
        let next = Self.rates.first { $0 > current + 0.001 } ?? Self.rates[0]
        settings.playbackRate = next
        engine.setRate(next)
    }

    func toggleCaptions() {
        settings.captionsEnabled.toggle()
    }

    func nextChapter() {
        guard let variant, chapterIndex + 1 < variant.chapters.count else {
            pause()
            positionS = durationS
            // Siste kapittel i fortellingen er slutten på besøket; synstolking
            // alene avslutter ikke, den kan høres midt i.
            if variantKind == .narration || poi?.variants.narration == nil {
                finishVisit()
            }
            return
        }
        chapterIndex += 1
        loadChapter(announce: true)
        play()
    }

    func previousChapter() {
        guard chapterIndex > 0 else {
            seek(to: 0)
            return
        }
        chapterIndex -= 1
        loadChapter(announce: true)
        play()
    }

    func close() {
        isPresented = false
    }

    func stopAndClear() {
        pause()
        engine.stop()
        poi = nil
        finishedVisit = nil
        currentVisitId = nil
        isPresented = false
        endLiveActivity()
    }

    // MARK: - Privat

    private func loadChapter(announce: Bool) {
        guard let poi, let chapter else { return }
        positionS = 0
        let timeline = CaptionTimeline.build(chapter: chapter)
        captionSegments = timeline.segments
        captionsAreEstimated = timeline.isEstimated
        let url = chapter.audio.flatMap { URL(string: $0.url) }
        engine.load(
            url: url,
            durationS: chapter.playbackDurationS,
            nowPlaying: AudioEngine.NowPlaying(title: poi.title, chapterTitle: chapter.title, durationS: chapter.playbackDurationS)
        )
        engine.setRate(settings.playbackRate)
        if announce, let title = chapter.title {
            pendingChapterAnnouncement = title
        }
        startOrUpdateLiveActivity(isPlaying: isPlaying)
    }

    private func startTicker() {
        stopTicker()
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                guard let self, !Task.isCancelled else { return }
                self.onTick()
            }
        }
    }

    private func stopTicker() {
        ticker?.cancel()
        ticker = nil
    }

    private func onTick() {
        let finished = engine.tick()
        positionS = min(engine.currentPositionS, durationS)
        updateLiveActivityDistanceIfNeeded()
        if finished { nextChapter() }
    }

    // MARK: - Live Activity (pakke 2, item 6)
    //
    // Låseskjerm + Dynamic Island. Selve implementasjonen (start/oppdater/
    // avslutt, avstand-throttling) ligger i PlayerActivityManager — her er
    // det bare korte kall fra de fire livssyklus-punktene spesifikasjonen
    // nevner: start, kapittelbytte, spill/pause, avslutt/stopp.

    private func startOrUpdateLiveActivity(isPlaying: Bool) {
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 16.1, *) {
            guard let poi, let chapter else { return }
            let chapterCount = variant?.chapters.count ?? 1
            if PlayerActivityManager.shared.isRunning {
                PlayerActivityManager.shared.updatePlayback(
                    poi: poi, chapter: chapter, chapterCount: chapterCount,
                    positionS: positionS, durationS: durationS, isPlaying: isPlaying
                )
            } else {
                PlayerActivityManager.shared.start(
                    poi: poi, chapter: chapter, chapterCount: chapterCount,
                    positionS: positionS, durationS: durationS, isPlaying: isPlaying
                )
            }
        }
        #endif
    }

    private func updateLiveActivityDistanceIfNeeded() {
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 16.1, *) {
            guard let poi, let chapter else { return }
            let chapterCount = variant?.chapters.count ?? 1
            PlayerActivityManager.shared.updateDistanceIfNeeded(
                currentPoiId: poi.id, poi: poi, chapter: chapter, chapterCount: chapterCount,
                positionS: positionS, durationS: durationS, isPlaying: isPlaying
            )
        }
        #endif
    }

    private func endLiveActivity() {
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 16.1, *) {
            PlayerActivityManager.shared.end()
        }
        #endif
    }
}
