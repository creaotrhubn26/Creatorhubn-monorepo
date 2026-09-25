// AppSettings.swift
//
// Brukervalg som skal overleve omstart, lagret i UserDefaults:
//   - guideLanguage: språk for både UI og fortelling (UI-spesifikasjon 8.7:
//     UI-språket følger språkvelgeren, ikke bare systemspråket).
//   - captionsEnabled: teksting i avspilleren, standard PÅ (beslutning 18.09.2026).
//   - unlockedAreaIds: mock-paywall, låst/ulåst per område lagret lokalt.
//   - favoritePoiIds: «Mine steder».
//   - playbackRate: 0,8 / 1 / 1,25 / 1,5.
//   - deviceId: anonym, tilfeldig ID laget første gang appen kjører; brukes
//     bare til å knytte stjerner og (med samtykke) besøksloggen til én enhet
//     (ingen konto). Byttes ut når brukeren sletter dataene sine på serveren.
//   - syncVisitsToServer: samtykke til å lagre besøksloggen på serveren,
//     standard AV (GDPR: samtykke er et aktivt valg). Se Core/VisitSync.swift.
//   - hapticsEnabled: «Vibrasjon», styrer alle .sensoryFeedback-kall i appen
//     (Core/AppHaptics.swift), standard PÅ.
//   - autoStartOnArrival: «Start automatisk når jeg er framme», starter
//     avspilling uten trykk når brukeren ankommer et sted og ingenting
//     spiller fra før (Core/ArrivalCoordinator.swift), standard AV.
//   - inNarrationPromptsEnabled: «Spørsmål underveis», standard PÅ (pakke 3).
//   - mapShowsList: kart eller liste i kartvisningen (UU-krav 8.5). Nil til
//     brukeren har valgt; da er listen standard når VoiceOver kjører
//     (Features/Map/MapAccessibility.swift, MapViewMode).
//   - selectedAreaSlug: området brukeren selv har valgt (Lørenskog,
//     Nesoddtangen, Oslo …). Nil til brukeren har valgt; da velges nærmeste
//     område eller Oslo (Core/AreaSelection.swift).

import Foundation
import Observation
import UIKit

@MainActor
@Observable
final class AppSettings {
    /// Språk appen kan vise UI på (Localizable.xcstrings har alle tre).
    /// Innholdsspråk styres av hva backend har.
    static let uiLanguages: [String] = ["nb", "en", "da"]

    private enum Key {
        static let guideLanguage = "reiseguide.guideLanguage"
        static let captionsEnabled = "reiseguide.captionsEnabled"
        static let unlockedAreaIds = "reiseguide.unlockedAreaIds"
        static let favoritePoiIds = "reiseguide.favoritePoiIds"
        static let playbackRate = "reiseguide.playbackRate"
        static let deviceId = "reiseguide.deviceId"
        static let syncVisits = "reiseguide.syncVisitsToServer"
        static let hapticsEnabled = "reiseguide.hapticsEnabled"
        static let autoStartOnArrival = "reiseguide.autoStartOnArrival"
        static let speakDirections = "reiseguide.speakDirectionsEnabled"
        static let inNarrationPrompts = "reiseguide.inNarrationPromptsEnabled"
        static let mapShowsList = "reiseguide.mapShowsList"
        static let selectedAreaSlug = "reiseguide.selectedAreaSlug"
        static let activeTourAreaSlug = "reiseguide.activeTourAreaSlug"
        static let tourModeAutoPlayOnArrival = "reiseguide.tourModeAutoPlayOnArrival"
        static let arrivalNotificationsEnabled = "reiseguide.arrivalNotificationsEnabled"
    }

    private let defaults: UserDefaults

    var guideLanguage: String {
        didSet { defaults.set(guideLanguage, forKey: Key.guideLanguage) }
    }

    var captionsEnabled: Bool {
        didSet { defaults.set(captionsEnabled, forKey: Key.captionsEnabled) }
    }

    var unlockedAreaIds: Set<String> {
        didSet { defaults.set(Array(unlockedAreaIds).sorted(), forKey: Key.unlockedAreaIds) }
    }

    var favoritePoiIds: Set<String> {
        didSet { defaults.set(Array(favoritePoiIds).sorted(), forKey: Key.favoritePoiIds) }
    }

    var playbackRate: Double {
        didSet { defaults.set(playbackRate, forKey: Key.playbackRate) }
    }

    /// Samtykke til å lagre besøksloggen på serveren (av som standard).
    var syncVisitsToServer: Bool {
        didSet { defaults.set(syncVisitsToServer, forKey: Key.syncVisits) }
    }

    /// «Vibrasjon»: styrer alle haptiske tilbakemeldinger (på som standard).
    var hapticsEnabled: Bool {
        didSet { defaults.set(hapticsEnabled, forKey: Key.hapticsEnabled) }
    }

    /// «Start automatisk når jeg er framme» (av som standard).
    var autoStartOnArrival: Bool {
        didSet { defaults.set(autoStartOnArrival, forKey: Key.autoStartOnArrival) }
    }

    /// «Les opp retningen» i veiviseren (pakke 2, item 5). Standard PÅ hvis
    /// VoiceOver kjørte da appen startet første gang, ellers AV — deretter
    /// et vanlig lagret valg som ikke endres av at VoiceOver skrus av/på.
    var speakDirectionsEnabled: Bool {
        didSet { defaults.set(speakDirectionsEnabled, forKey: Key.speakDirections) }
    }

    /// «Spørsmål underveis» i fortellingen (Core/ChapterPrompts.swift).
    var inNarrationPromptsEnabled: Bool {
        didSet { defaults.set(inNarrationPromptsEnabled, forKey: Key.inNarrationPrompts) }
    }

    /// Kart (false) eller liste (true); nil = ikke valgt ennå.
    var mapShowsList: Bool? {
        didSet {
            if let mapShowsList {
                defaults.set(mapShowsList, forKey: Key.mapShowsList)
            } else {
                defaults.removeObject(forKey: Key.mapShowsList)
            }
        }
    }

    /// Området brukeren selv har valgt; nil = ikke valgt ennå (AreaSelection).
    var selectedAreaSlug: String? {
        didSet {
            if let selectedAreaSlug {
                defaults.set(selectedAreaSlug, forKey: Key.selectedAreaSlug)
            } else {
                defaults.removeObject(forKey: Key.selectedAreaSlug)
            }
        }
    }

    /// Tur-modus (pakke 2, item 3): området en aktiv tur gjelder, så
    /// «Fortsett turen» overlever at appen dør i bakgrunnen. Nil = ingen
    /// aktiv tur (TourModeController.isActive).
    var activeTourAreaSlug: String? {
        didSet {
            if let activeTourAreaSlug {
                defaults.set(activeTourAreaSlug, forKey: Key.activeTourAreaSlug)
            } else {
                defaults.removeObject(forKey: Key.activeTourAreaSlug)
            }
        }
    }

    /// «Spill av automatisk ved ankomst under en tur» — av som standard,
    /// egen bryter fra `autoStartOnArrival` fordi den bare gjelder når
    /// brukeren aktivt har startet en tur (mer forventet automatikk der).
    var tourModeAutoPlayOnArrival: Bool {
        didSet { defaults.set(tourModeAutoPlayOnArrival, forKey: Key.tourModeAutoPlayOnArrival) }
    }

    /// Bakgrunnsvarsel ved ankomst (pakke 2, item 2) — av som standard,
    /// krever eksplisitt samtykke før «Alltid»-posisjon bes om (to-stegs
    /// samtykke, se Features/Settings/ArrivalNotificationsSettingsSection.swift).
    var arrivalNotificationsEnabled: Bool {
        didSet { defaults.set(arrivalNotificationsEnabled, forKey: Key.arrivalNotificationsEnabled) }
    }

    /// Anonym enhets-ID (UUID). Lages og lagres ved første kjøring.
    private(set) var deviceId: String {
        didSet { defaults.set(deviceId, forKey: Key.deviceId) }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        guideLanguage = defaults.string(forKey: Key.guideLanguage) ?? Self.preferredInitialLanguage()
        captionsEnabled = defaults.object(forKey: Key.captionsEnabled) as? Bool ?? true
        unlockedAreaIds = Set(defaults.stringArray(forKey: Key.unlockedAreaIds) ?? [])
        favoritePoiIds = Set(defaults.stringArray(forKey: Key.favoritePoiIds) ?? [])
        let storedRate = defaults.double(forKey: Key.playbackRate)
        playbackRate = storedRate > 0 ? storedRate : 1
        syncVisitsToServer = defaults.bool(forKey: Key.syncVisits)
        hapticsEnabled = defaults.object(forKey: Key.hapticsEnabled) as? Bool ?? true
        autoStartOnArrival = defaults.bool(forKey: Key.autoStartOnArrival)
        speakDirectionsEnabled = defaults.object(forKey: Key.speakDirections) as? Bool ?? UIAccessibility.isVoiceOverRunning
        inNarrationPromptsEnabled = defaults.object(forKey: Key.inNarrationPrompts) as? Bool ?? true
        mapShowsList = defaults.object(forKey: Key.mapShowsList) as? Bool
        selectedAreaSlug = defaults.string(forKey: Key.selectedAreaSlug).flatMap { $0.isEmpty ? nil : $0 }
        activeTourAreaSlug = defaults.string(forKey: Key.activeTourAreaSlug).flatMap { $0.isEmpty ? nil : $0 }
        tourModeAutoPlayOnArrival = defaults.bool(forKey: Key.tourModeAutoPlayOnArrival)
        arrivalNotificationsEnabled = defaults.bool(forKey: Key.arrivalNotificationsEnabled)
        if let stored = defaults.string(forKey: Key.deviceId), !stored.isEmpty {
            deviceId = stored
        } else {
            let fresh = UUID().uuidString.lowercased()
            defaults.set(fresh, forKey: Key.deviceId)
            deviceId = fresh
        }
    }

    /// UI-språket appen faktisk kan vise: valgt språk hvis vi har strenger for
    /// det, ellers engelsk (en tysk turist får engelsk UI og tysk fortelling
    /// når backend har den).
    var uiLanguage: String {
        Self.uiLanguages.contains(guideLanguage) ? guideLanguage : "en"
    }

    var locale: Locale { Locale(identifier: guideLanguage) }

    /// Ny tilfeldig enhets-ID etter at dataene på serveren er slettet, så
    /// ingenting nytt kan kobles til det som var.
    func resetDeviceId() {
        deviceId = UUID().uuidString.lowercased()
    }

    func isUnlocked(areaId: String) -> Bool { unlockedAreaIds.contains(areaId) }

    func unlock(areaId: String) { unlockedAreaIds.insert(areaId) }

    func lock(areaId: String) { unlockedAreaIds.remove(areaId) }

    func isFavorite(poiId: String) -> Bool { favoritePoiIds.contains(poiId) }

    func toggleFavorite(poiId: String) {
        if favoritePoiIds.contains(poiId) {
            favoritePoiIds.remove(poiId)
        } else {
            favoritePoiIds.insert(poiId)
        }
    }

    /// Enhetens språk hvis appen støtter det, ellers norsk (demo-området er i Oslo).
    private static func preferredInitialLanguage() -> String {
        for preferred in Locale.preferredLanguages {
            let code = Locale(identifier: preferred).language.languageCode?.identifier ?? preferred
            if uiLanguages.contains(code) { return code }
            if code == "no" || code == "nn" { return "nb" }
        }
        return "nb"
    }
}
