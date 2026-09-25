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
//
// Spørsmål underveis (pakke 3): `prompts` følger kapittel og posisjon; et
// gjettespørsmål pauser avspillingen (logikken i Core/ChapterPrompts.swift).
//
// Uten lydfil leses manuset opp av telefonen (SpeechNarrator via AudioEngine).
// Da annonseres ikke kapittelbytte (det ville snakket over opplesningen);
// med VoiceOver leses kapitteltittelen i stedet før teksten.
//
// Avspiller-redesignet (23.09.2026), to punkter i denne fila (2, 4 og 5 er
// stort sett View-laget — se PlayerView.swift, EndOfVisitCard.swift,
// PlayerChapterList.swift, Cards.swift):
//   1. «Rolig slutt på besøket»: fortellingens naturlige slutt merker besøket
//      fullført og avslutter Live Activity som før, men åpner IKKE
//      etter-besøket med det samme — `narrationEndedVisit` viser i stedet et
//      avslutningskort i spilleren (EndOfVisitCard.swift). Den eksplisitte
//      «Avslutt besøket»-knappen bruker fortsatt `finishVisit()` og åpner
//      arket direkte, som før.
//   3. «Fortsett der du slapp»: posisjonen lagres (PlayerViewModel+Resume.swift)
//      i PlaybackResumeStore (Core) ved pause, lukking, kapittelbytte og
//      bakgrunn; `start(poi:)` gjenopptar den om den er verdt å tilby
//      (PlaybackResumeDecision).
// Live Activity-koden (punkt 6, pakke 2) er flyttet til
// PlayerViewModel+LiveActivity.swift; kapittellasting/tikkeren til
// +Playback.swift; CaptionSegment/CaptionTimeline til Core/CaptionTimeline.swift
// — for å holde denne fila under SwiftLint sin file_length/type_body_length-grense.

import Foundation
import Observation

@MainActor
@Observable
final class PlayerViewModel {
    static let rates: [Double] = [0.8, 1, 1.25, 1.5]

    // Disse har bare intern (modulvid) skrivetilgang, ikke `private`: noen
    // features er delt ut i egne filer (PlayerViewModel+Playback.swift,
    // +Resume.swift, EndOfVisitCard.swift, ResumeHintBar.swift,
    // PlayerChapterList.swift) for å holde denne fila under SwiftLint sin
    // file_length/type_body_length-grense. Utsiden (View-laget) skal
    // fortsatt bare bruke handlingene under, ikke sette disse direkte.
    var poi: GuidePOI?
    var variantKind: VariantKind = .narration
    var chapterIndex = 0
    var positionS: Double = 0
    private(set) var isPlaying = false
    var captionSegments: [CaptionSegment] = []
    var captionsAreEstimated = false
    /// Kapittelbytte annonseres én gang (8.4, punkt 6); visningen nullstiller.
    var pendingChapterAnnouncement: String?
    var isPresented = false
    var audioDescriptionExpanded = false

    /// Besøket som nettopp ble fullført via «Avslutt besøket»; avspilleren
    /// åpner etter-besøket-arket med det samme.
    var finishedVisit: FinishedVisit?
    /// Fortellingen tok slutt av seg selv (item 1, «Rolig slutt på besøket»):
    /// besøket er allerede merket fullført, men i stedet for å åpne arket med
    /// det samme viser spilleren et avslutningskort brukeren selv velger fra
    /// (EndOfVisitCard.swift).
    var narrationEndedVisit: FinishedVisit?
    /// Annonseres én gang når avslutningskortet vises (samme mønster som
    /// `pendingChapterAnnouncement`).
    var pendingVisitEndedAnnouncement: String?
    /// Loggoppføringen for det som spilles nå.
    var currentVisitId: String?
    /// Spørsmål underveis for kapittelet som spilles.
    let prompts = ChapterPromptController()

    /// «Fortsetter fra …» (item 3): vises når `start(poi:)` hopper til en
    /// lagret posisjon. Nil til det skjer, eller etter at kortet er lukket.
    var resumeHint: ResumeHint?

    struct FinishedVisit: Identifiable, Equatable {
        let entryId: String
        let poi: GuidePOI
        var id: String { entryId }
    }

    struct ResumeHint: Equatable {
        /// Posisjonen slik den var lagret (til visningen: «Fortsetter fra 2:14»).
        let savedPositionS: Double
    }

    @ObservationIgnored let engine = AudioEngine()
    @ObservationIgnored let settings: AppSettings
    @ObservationIgnored let visits: VisitLogStore
    @ObservationIgnored let resume: PlaybackResumeStore
    @ObservationIgnored var ticker: Task<Void, Never>?

    init(settings: AppSettings, visits: VisitLogStore, resume: PlaybackResumeStore = PlaybackResumeStore()) {
        self.settings = settings
        self.visits = visits
        self.resume = resume
        engine.onRemotePlay = { [weak self] in self?.play() }
        engine.onRemotePause = { [weak self] in self?.pause() }
        engine.onRemoteSkip = { [weak self] delta in self?.skip(by: delta) }
    }

    var hasContent: Bool { poi != nil }

    var variant: GuideVariant? {
        guard let poi else { return nil }
        return Self.variant(kind: variantKind, poi: poi)
    }

    /// Antall kapitler er over 1: kapittellisten og forrige/neste-knappene
    /// (item 4) vises bare da.
    var hasMultipleChapters: Bool { (variant?.chapters.count ?? 0) > 1 }

    var chapter: GuideChapter? {
        guard let variant, variant.chapters.indices.contains(chapterIndex) else { return nil }
        return variant.chapters[chapterIndex]
    }

    /// Samme regel som `variant`, men for en vilkårlig variant: brukt av
    /// `start(poi:)` til å sjekke en lagret gjenoppta-posisjon uten å bytte
    /// `variantKind` før vi vet om posisjonen faktisk er verdt å bruke.
    private static func variant(kind: VariantKind, poi: GuidePOI) -> GuideVariant? {
        switch kind {
        case .narration: return poi.variants.narration ?? poi.variants.audioDescription
        case .audioDescription: return poi.variants.audioDescription ?? poi.variants.narration
        }
    }

    var durationS: Double { chapter?.playbackDurationS ?? 0 }
    var rate: Double { settings.playbackRate }
    var captionsEnabled: Bool { settings.captionsEnabled }
    var isSimulated: Bool { engine.isSimulated }
    /// Kapittelet leses opp av telefonen fordi lydfilen ikke finnes ennå.
    var isReadByPhone: Bool { engine.isReadByPhone }
    /// Telefonen leser høyt akkurat nå; ingen annonseringer da.
    var isReadingAloud: Bool { isPlaying && engine.isReadByPhone }

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
        audioDescriptionExpanded = false
        finishedVisit = nil
        narrationEndedVisit = nil
        resumeHint = nil
        currentVisitId = visits.recordStart(poi: poi).id
        isPresented = true
        prompts.resetSession()

        // «Fortsett der du slapp» (item 3): en lagret posisjon som fortsatt
        // er meningsfull vinner over `kind`-parameteren (samme sted, kalt fra
        // detaljsiden, kartet, framme-varselet osv. — alle skal fortsette).
        if let resumed = PlaybackResumeDecision.resolve(saved: resume.position(for: poi.id), poi: poi) {
            variantKind = resumed.variantKind
            chapterIndex = resumed.chapterIndex
            loadChapter(announce: false)
            seek(to: resumed.startPositionS)
            resumeHint = ResumeHint(savedPositionS: resumed.savedPositionS)
        } else {
            variantKind = kind
            chapterIndex = 0
            loadChapter(announce: false)
        }
        play()
    }

    /// «Avslutt besøket»: stopper, merker besøket fullført og åpner etter-besøket.
    func finishVisit() {
        guard let poi else { return }
        pause()
        narrationEndedVisit = nil
        let entryId = currentVisitId ?? visits.recordStart(poi: poi).id
        currentVisitId = entryId
        visits.markCompleted(entryId: entryId)
        resume.clear(poiId: poi.id)
        finishedVisit = FinishedVisit(entryId: entryId, poi: poi)
        endLiveActivity()
    }

    /// Fortellingen tok slutt av seg selv (item 1, «Rolig slutt på besøket»):
    /// besøket merkes fullført og Live Activity avsluttes akkurat som
    /// «Avslutt besøket», men etter-besøket-arket åpnes IKKE med det samme —
    /// `narrationEndedVisit` viser et avslutningskort i spilleren i stedet
    /// (EndOfVisitCard.swift), og brukeren velger selv veien videre.
    private func completeNarrationEnd() {
        guard let poi else { return }
        let entryId = currentVisitId ?? visits.recordStart(poi: poi).id
        currentVisitId = entryId
        visits.markCompleted(entryId: entryId)
        resume.clear(poiId: poi.id)
        endLiveActivity()
        narrationEndedVisit = FinishedVisit(entryId: entryId, poi: poi)
        pendingVisitEndedAnnouncement = L10n.string("player.visitEnded.announcement", lang: settings.uiLanguage)
            .replacingOccurrences(of: "%@", with: poi.title)
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

    /// `fade`: gjettespørsmål (pakke 3-oppfølging) toner ekte lydfil kort ut i
    /// stedet for å kutte den brått; opplesning pauses som vanlig (den er
    /// allerede ved et ordskille når det kalles, se ChapterPromptPauseTiming).
    func pause(fade: Bool = false) {
        engine.pause(fade: fade)
        isPlaying = false
        stopTicker()
        startOrUpdateLiveActivity(isPlaying: false)
        saveResumePosition()
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
        prompts.seek(to: clamped)
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
                completeNarrationEnd()
            }
            return
        }
        chapterIndex += 1
        loadChapter(announce: true)
        saveResumePosition()
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
        saveResumePosition()
        isPresented = false
    }

    func stopAndClear() {
        pause()
        engine.stop()
        poi = nil
        finishedVisit = nil
        narrationEndedVisit = nil
        resumeHint = nil
        currentVisitId = nil
        isPresented = false
        endLiveActivity()
    }
}
