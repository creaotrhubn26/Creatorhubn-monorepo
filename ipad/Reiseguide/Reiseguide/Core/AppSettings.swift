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

import Foundation
import Observation

@MainActor
@Observable
final class AppSettings {
    /// Språk appen kan vise UI på. Innholdsspråk styres av hva backend har.
    static let uiLanguages: [String] = ["nb", "en"]

    private enum Key {
        static let guideLanguage = "reiseguide.guideLanguage"
        static let captionsEnabled = "reiseguide.captionsEnabled"
        static let unlockedAreaIds = "reiseguide.unlockedAreaIds"
        static let favoritePoiIds = "reiseguide.favoritePoiIds"
        static let playbackRate = "reiseguide.playbackRate"
        static let deviceId = "reiseguide.deviceId"
        static let syncVisits = "reiseguide.syncVisitsToServer"
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
