// VeiviserViewModel.swift
//
// Tilstand for veiviseren (kompassguiden, pakke 2 item 5, Daniel-godkjent
// 18.09.2026): retning og avstand til et valgt sted eller «neste sted» i
// ruten. Ren matte ligger i CompassDirection.swift og VeiviserTarget.swift;
// denne fila kobler den til posisjon/retning fra LocationService, tale
// (announcements når VoiceOver kjører, ellers AVSpeechSynthesizer i UI-
// språket) og lett haptikk.
//
// Snakker aldri over fortellingen: all tale hopper over mens spilleren
// spiller (`player.isPlaying`). Rate-limitert: ny tale bare ved endret
// klokkeretning/kompassord, 20 m bevegelse, eller minst hvert 15. sekund.

import AVFoundation
import Foundation
import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class VeiviserViewModel {
    /// Innenfor denne vinkelen fra målet regnes telefonen som «pekt mot» (lett haptikk).
    private static let pointingToleranceDegrees: Double = 15
    /// Tale gjentas automatisk minst så ofte selv om ingenting annet er endret.
    private static let heartbeatInterval: TimeInterval = 15
    private static let distanceRepeatThresholdM: Double = 20
    private static let tickInterval: Duration = .milliseconds(400)

    let target: VeiviserTarget

    private(set) var poi: GuidePOI?
    private(set) var distanceM: Double?
    private(set) var relativeAngleDeg: Double?
    private(set) var clockBucket: Int?
    /// Kompassord-nøkkel (Localizable.xcstrings) når retningssensoren mangler.
    private(set) var compassWordKey: String?
    private(set) var hasArrived = false
    private(set) var isHeadingAvailable = false

    /// Kun for enhetstester/inspeksjon av hva som faktisk ble sagt.
    private(set) var lastSpokenText: String?

    @ObservationIgnored private let store: AreaStore
    @ObservationIgnored private let location: LocationService
    @ObservationIgnored private let visits: VisitLogStore
    @ObservationIgnored private let settings: AppSettings
    @ObservationIgnored private let player: PlayerViewModel
    @ObservationIgnored private let synthesizer = AVSpeechSynthesizer()
    @ObservationIgnored private var ticker: Task<Void, Never>?

    @ObservationIgnored private var lastSpokenDirectionKey: String?
    @ObservationIgnored private var lastSpokenDistanceM: Double?
    @ObservationIgnored private var lastSpokenAt: Date?
    @ObservationIgnored private var wasPointingAtTarget = false
    @ObservationIgnored private var arrivalAnnounced = false

    init(
        target: VeiviserTarget,
        store: AreaStore,
        location: LocationService,
        visits: VisitLogStore,
        settings: AppSettings,
        player: PlayerViewModel
    ) {
        self.target = target
        self.store = store
        self.location = location
        self.visits = visits
        self.settings = settings
        self.player = player
    }

    func start() {
        location.requestAndStart()
        location.startUpdatingHeading()
        refresh()
        startTicker()
    }

    func stop() {
        location.stopUpdatingHeading()
        stopTicker()
        synthesizer.stopSpeaking(at: .immediate)
    }

    /// «Gjenta retning»: knapp/tilgjengelighetshandling. Hopper over mens
    /// fortellingen spiller, akkurat som den automatiske talen — vi snakker
    /// aldri over fortellingen, heller ikke på forespørsel.
    func repeatDirection() {
        guard !player.isPlaying else { return }
        lastSpokenAt = nil
        lastSpokenDirectionKey = nil
        lastSpokenDistanceM = nil
        speakIfDue()
    }

    // MARK: - Privat

    private func startTicker() {
        stopTicker()
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: Self.tickInterval)
                guard let self, !Task.isCancelled else { return }
                self.refresh()
            }
        }
    }

    private func stopTicker() {
        ticker?.cancel()
        ticker = nil
    }

    private func refresh() {
        let resolved = VeiviserTarget.resolve(target, pois: store.pois, visitedIds: visits.visitedPoiIds, excludingId: player.poi?.id)
        poi = resolved

        guard let resolved, let fix = location.fix else {
            distanceM = nil
            relativeAngleDeg = nil
            clockBucket = nil
            compassWordKey = nil
            return
        }

        let distance = Geo.distanceM(from: fix.coordinate, to: resolved.coordinate)
        let bearing = Geo.bearingDegrees(from: fix.coordinate, to: resolved.coordinate)
        distanceM = distance

        if let heading = location.heading {
            isHeadingAvailable = true
            let relative = CompassDirection.relativeAngleDegrees(bearingDegrees: bearing, headingDegrees: heading)
            relativeAngleDeg = relative
            clockBucket = CompassDirection.clockBucket(relativeAngleDegrees: relative)
            compassWordKey = nil
            handlePointing(relativeAngle: relative)
        } else {
            isHeadingAvailable = false
            relativeAngleDeg = nil
            clockBucket = nil
            compassWordKey = CompassDirection.compassWordKey(bearingDegrees: bearing)
            wasPointingAtTarget = false
        }

        updateArrival(distanceM: distance, poi: resolved)
        if !hasArrived {
            speakIfDue()
        }
    }

    private func handlePointing(relativeAngle: Double) {
        let pointing = CompassDirection.isPointingAtTarget(relativeAngleDegrees: relativeAngle, toleranceDegrees: Self.pointingToleranceDegrees)
        if pointing, !wasPointingAtTarget {
            Haptics.lightTick(enabled: settings.hapticsEnabled)
        }
        wasPointingAtTarget = pointing
    }

    private func updateArrival(distanceM: Double, poi: GuidePOI) {
        let arrived = distanceM <= Double(poi.triggerRadiusM)
        if arrived, !hasArrived {
            hasArrived = true
            announceArrival(poi: poi)
        } else if !arrived {
            hasArrived = false
            arrivalAnnounced = false
        }
    }

    private func announceArrival(poi: GuidePOI) {
        guard !arrivalAnnounced else { return }
        arrivalAnnounced = true
        // Framme-varselet (ArrivalCoordinator) gir allerede vibrasjon, kort og
        // VoiceOver-kunngjøring. Veiviseren sier det bare høyt når VoiceOver er
        // av, så ingen hører «framme» to ganger.
        guard settings.speakDirectionsEnabled, !player.isPlaying, !UIAccessibility.isVoiceOverRunning else { return }
        let text = L10n.string("veiviser.arrived", lang: settings.uiLanguage).replacingOccurrences(of: "%@", with: poi.title)
        speak(text)
    }

    private func speakIfDue() {
        guard settings.speakDirectionsEnabled, !player.isPlaying else { return }
        guard let distanceM else { return }
        let directionKey = clockBucket.map { "clock:\($0)" } ?? compassWordKey.map { "word:\($0)" }
        guard let directionKey else { return }

        let directionChanged = directionKey != lastSpokenDirectionKey
        let movedEnough = lastSpokenDistanceM.map { abs($0 - distanceM) >= Self.distanceRepeatThresholdM } ?? true
        let timedOut = lastSpokenAt.map { Date().timeIntervalSince($0) >= Self.heartbeatInterval } ?? true
        let neverSpoken = lastSpokenAt == nil

        guard neverSpoken || directionChanged || movedEnough || timedOut else { return }

        lastSpokenDirectionKey = directionKey
        lastSpokenDistanceM = distanceM
        lastSpokenAt = Date()
        speak(phrase(distanceM: distanceM))
    }

    private func phrase(distanceM: Double) -> String {
        let lang = settings.uiLanguage
        let distanceText = L10n.distance(meters: distanceM, locale: settings.locale)
        if let clockBucket {
            return L10n.string("veiviser.clockPhrase", lang: lang)
                .replacingOccurrences(of: "%1$@", with: "\(clockBucket)")
                .replacingOccurrences(of: "%2$@", with: distanceText)
        }
        if let compassWordKey {
            let word = L10n.string(compassWordKey, lang: lang)
            return L10n.string("veiviser.compassPhrase", lang: lang)
                .replacingOccurrences(of: "%1$@", with: word)
                .replacingOccurrences(of: "%2$@", with: distanceText)
        }
        return distanceText
    }

    private func speak(_ text: String) {
        guard !text.isEmpty else { return }
        lastSpokenText = text
        if UIAccessibility.isVoiceOverRunning {
            AccessibilityNotification.Announcement(text).post()
        } else {
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = AVSpeechSynthesisVoice(language: Self.bcp47(for: settings.uiLanguage))
            synthesizer.speak(utterance)
        }
    }

    private static func bcp47(for uiLanguage: String) -> String {
        uiLanguage == "en" ? "en-US" : "nb-NO"
    }
}
