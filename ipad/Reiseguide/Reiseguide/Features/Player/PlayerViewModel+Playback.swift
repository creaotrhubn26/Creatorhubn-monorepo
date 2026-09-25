// PlayerViewModel+Playback.swift
//
// Kapittellasting og tikkeren som driver fremdrift, spørsmål underveis og
// automatisk kapittelbytte. Egen fil (flyttet ut av PlayerViewModel.swift,
// som nærmet seg SwiftLint sin file_length/type_body_length-grense).

import Foundation

extension PlayerViewModel {
    func loadChapter(announce: Bool) {
        guard let poi, let chapter else { return }
        positionS = 0
        let timeline = CaptionTimeline.build(chapter: chapter)
        captionSegments = timeline.segments
        captionsAreEstimated = timeline.isEstimated
        prompts.load(chapter: chapter)
        let url = chapter.audio.flatMap { URL(string: $0.url) }
        let speech = url != nil ? nil : SpeechScript.make(
            chapter: chapter,
            segments: timeline.segments,
            language: variant?.lang ?? settings.guideLanguage,
            announceTitle: announce,
            uiLanguage: settings.uiLanguage
        )
        engine.load(
            url: url,
            durationS: chapter.playbackDurationS,
            nowPlaying: AudioEngine.NowPlaying(title: poi.title, chapterTitle: chapter.title, durationS: chapter.playbackDurationS),
            speech: speech
        )
        engine.setRate(settings.playbackRate)
        if announce, let title = chapter.title, !engine.isReadByPhone {
            pendingChapterAnnouncement = title
        }
        startOrUpdateLiveActivity(isPlaying: isPlaying)
    }

    func startTicker() {
        stopTicker()
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                guard let self, !Task.isCancelled else { return }
                self.onTick()
            }
        }
    }

    func stopTicker() {
        ticker?.cancel()
        ticker = nil
    }

    private func onTick() {
        let finished = engine.tick()
        positionS = min(engine.currentPositionS, durationS)
        updateLiveActivityDistanceIfNeeded()
        if prompts.advance(to: positionS, segments: captionSegments, enabled: settings.inNarrationPromptsEnabled) {
            pause(fade: true)
            return
        }
        if finished { nextChapter() }
    }

    /// Hopper til et valgt kapittel fra kapittellisten (item 4). Ugyldig
    /// indeks ignoreres stille (listen viser bare gyldige rader).
    func jump(toChapter index: Int) {
        guard let variant, variant.chapters.indices.contains(index), index != chapterIndex else { return }
        chapterIndex = index
        loadChapter(announce: true)
        play()
    }
}
