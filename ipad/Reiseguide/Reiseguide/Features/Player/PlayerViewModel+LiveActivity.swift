// PlayerViewModel+LiveActivity.swift
//
// Live Activity (pakke 2, item 6): låseskjerm + Dynamic Island. Selve
// implementasjonen (start/oppdater/avslutt, avstand-throttling) ligger i
// PlayerActivityManager — her er det bare korte kall fra de fire
// livssyklus-punktene spesifikasjonen nevner: start, kapittelbytte,
// spill/pause, avslutt/stopp. Egen fil (flyttet ut av PlayerViewModel.swift,
// som nærmet seg SwiftLint sin file_length-grense): leser bare eksisterende
// tilstand (poi, chapter, variant, positionS, durationS), skriver ingenting.

import Foundation

extension PlayerViewModel {
    func startOrUpdateLiveActivity(isPlaying: Bool) {
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 16.1, *) {
            guard let snapshot = liveActivitySnapshot(isPlaying: isPlaying) else { return }
            PlayerActivityManager.shared.sync(snapshot)
        }
        #endif
    }

    func updateLiveActivityDistanceIfNeeded() {
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 16.1, *) {
            guard let snapshot = liveActivitySnapshot(isPlaying: isPlaying) else { return }
            PlayerActivityManager.shared.updateDistanceIfNeeded(snapshot)
        }
        #endif
    }

    #if !targetEnvironment(macCatalyst)
    private func liveActivitySnapshot(isPlaying: Bool) -> PlayerActivitySnapshot? {
        guard let poi, let chapter else { return nil }
        return PlayerActivitySnapshot(
            poi: poi,
            chapter: chapter,
            chapterCount: variant?.chapters.count ?? 1,
            positionS: positionS,
            durationS: durationS,
            isPlaying: isPlaying
        )
    }
    #endif

    func endLiveActivity() {
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 16.1, *) {
            PlayerActivityManager.shared.end()
        }
        #endif
    }
}
