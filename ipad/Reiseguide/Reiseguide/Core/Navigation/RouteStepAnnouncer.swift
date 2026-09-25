// RouteStepAnnouncer.swift
//
// Tale og haptikk for turn-by-turn i veiviseren (pakke 2, item 1): egen fil
// (ikke inne i VeiviserViewModel) fordi den brukes fra dens
// route-progress-oppdatering, men speak-gatingen speiler nøyaktig samme
// regel som resten av veiviseren (VeiviserViewModel.swift) — VoiceOver-
// annonsering når VoiceOver kjører, ellers AVSpeechSynthesizer i UI-språket,
// og aldri over fortellingen (`!player.isPlaying`).

import AVFoundation
import Foundation
import SwiftUI
import UIKit

@MainActor
final class RouteStepAnnouncer {
    private let settings: AppSettings
    private let player: PlayerViewModel
    private let synthesizer = AVSpeechSynthesizer()

    init(settings: AppSettings, player: PlayerViewModel) {
        self.settings = settings
        self.player = player
    }

    /// Manøverteksten for et nytt steg («Sving til venstre inn på …»).
    func announceStep(_ instructions: String) {
        speakIfAllowed(instructions)
    }

    /// «Du er utenfor ruta, beregner ny rute» — sagt når OffRouteRerouteGate
    /// har sett nok påfølgende av-rute-avlesninger.
    func announceOffRoute() {
        speakIfAllowed(L10n.string("veiviser.offRoute", lang: settings.uiLanguage))
    }

    /// Lett dult ved hvert stegbytte, som pekingen mot målet ellers i veiviseren.
    func hapticTurn() {
        Haptics.lightTick(enabled: settings.hapticsEnabled)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }

    private func speakIfAllowed(_ text: String) {
        guard settings.speakDirectionsEnabled, !player.isPlaying, !text.isEmpty else { return }
        if UIAccessibility.isVoiceOverRunning {
            AccessibilityNotification.Announcement(text).post()
        } else {
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = AVSpeechSynthesisVoice(language: settings.uiLanguage == "en" ? "en-US" : "nb-NO")
            // Uten aktiv .playback-sesjon demper lydløs-bryteren talen helt.
            AudioEngine.activatePlaybackSession()
            synthesizer.speak(utterance)
        }
    }
}
