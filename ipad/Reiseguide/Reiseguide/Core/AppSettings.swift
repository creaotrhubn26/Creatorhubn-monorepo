// AppSettings.swift
//
// Brukervalg som skal overleve omstart, lagret i UserDefaults:
//   - guideLanguage: språk for både UI og fortelling (UI-spesifikasjon 8.7:
//     UI-språket følger språkvelgeren, ikke bare systemspråket).
//   - captionsEnabled: teksting i avspilleren, standard PÅ (beslutning 18.09.2026).
//   - unlockedAreaIds: mock-paywall, låst/ulåst per område lagret lokalt.
//   - favoritePoiIds: «Mine steder».
//   - playbackRate: 0,8 / 1 / 1,25 / 1,5.

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

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        guideLanguage = defaults.string(forKey: Key.guideLanguage) ?? Self.preferredInitialLanguage()
        captionsEnabled = defaults.object(forKey: Key.captionsEnabled) as? Bool ?? true
        unlockedAreaIds = Set(defaults.stringArray(forKey: Key.unlockedAreaIds) ?? [])
        favoritePoiIds = Set(defaults.stringArray(forKey: Key.favoritePoiIds) ?? [])
        let storedRate = defaults.double(forKey: Key.playbackRate)
        playbackRate = storedRate > 0 ? storedRate : 1
    }

    /// UI-språket appen faktisk kan vise: valgt språk hvis vi har strenger for
    /// det, ellers engelsk (en tysk turist får engelsk UI og tysk fortelling
    /// når backend har den).
    var uiLanguage: String {
        Self.uiLanguages.contains(guideLanguage) ? guideLanguage : "en"
    }

    var locale: Locale { Locale(identifier: guideLanguage) }

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
