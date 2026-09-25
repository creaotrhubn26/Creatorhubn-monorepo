// PlayerViewModel+Resume.swift
//
// «Fortsett der du slapp» (item 3): lagrer posisjonen og svarer på
// gjenoppta-hintet (ResumeHintBar.swift). Selve avgjørelsen av OM og HVOR det
// er verdt å hoppe til ligger i Core/PlaybackResumeStore.swift
// (PlaybackResumeDecision), brukt fra `start(poi:)` i PlayerViewModel.swift.
// Egen fil av samme grunn som +Playback.swift og +LiveActivity.swift.

import Foundation

extension PlayerViewModel {
    /// Lagrer nåværende posisjon: kalt ved pause, lukking, kapittelbytte og
    /// (via `persistPlaybackPositionForBackground()`) når appen går i
    /// bakgrunnen. Stille no-op uten et sted lastet.
    func saveResumePosition() {
        guard let poi else { return }
        resume.save(PlaybackResumePosition(poiId: poi.id, variantKind: variantKind, chapterIndex: chapterIndex, positionS: positionS, updatedAt: Date()))
    }

    /// Kalt fra ReiseguideApp når `scenePhase` slutter å være `.active`:
    /// appen kan bli drept i bakgrunnen uten en eksplisitt pause eller
    /// lukking av spilleren.
    func persistPlaybackPositionForBackground() {
        saveResumePosition()
    }

    /// «Start på nytt» på gjenoppta-hintet: samme sted og variant, kapittel 1, forfra.
    func restartFromBeginning() {
        resumeHint = nil
        chapterIndex = 0
        loadChapter(announce: false)
        play()
    }

    /// Brukeren lukker gjenoppta-hintet uten å velge noe: spiller videre der
    /// den allerede står (posisjonen er allerede satt av `start`).
    func dismissResumeHint() {
        resumeHint = nil
    }
}
