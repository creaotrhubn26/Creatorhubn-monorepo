// L10n.swift
//
// Strenger som ikke går gjennom SwiftUI Text (accessibilityLabel, formattering)
// må slås opp i riktig .lproj selv, siden UI-språket følger språkvelgeren og
// ikke systemspråket. SwiftUI Text følger `.environment(\.locale, …)` som
// settes i ReiseguideApp; denne hjelperen gjør det samme for vanlige String.

import Foundation

enum L10n {
    /// Slår opp en nøkkel i Localizable.xcstrings for gitt språk.
    static func string(_ key: String, lang: String) -> String {
        if let path = Bundle.main.path(forResource: lang, ofType: "lproj"),
           let bundle = Bundle(path: path) {
            let value = bundle.localizedString(forKey: key, value: nil, table: nil)
            if value != key { return value }
        }
        return Bundle.main.localizedString(forKey: key, value: nil, table: nil)
    }

    /// BCP-47-kode for opplesning med AVSpeechSynthesizer i UI-språket
    /// (veiviser og rutesteg): dansk UI får dansk stemme, engelsk amerikansk,
    /// alt annet norsk.
    static func speechLanguageCode(for uiLanguage: String) -> String {
        switch uiLanguage {
        case "en": return "en-US"
        case "da": return "da-DK"
        default: return "nb-NO"
        }
    }

    /// Navnet på et språk, på sitt eget språk («Norsk», «English», «Dansk»).
    static func languageName(_ code: String) -> String {
        Locale(identifier: code).localizedString(forLanguageCode: code)?.capitalized(with: Locale(identifier: code)) ?? code
    }

    /// «150 m» / «1,2 km» etter locale.
    static func distance(meters: Double, locale: Locale) -> String {
        let formatter = MeasurementFormatter()
        formatter.locale = locale
        formatter.unitOptions = .naturalScale
        formatter.numberFormatter.maximumFractionDigits = meters < 1_000 ? 0 : 1
        return formatter.string(from: Measurement(value: meters, unit: UnitLength.meters))
    }

    /// «02:17» for visning; VoiceOver får full tekst via `spokenDuration`.
    static func clock(seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded()))
        return String(format: "%02d:%02d", total / 60, total % 60)
    }

    /// «2 minutter 17 sekunder» (UI-spesifikasjon 8.4, punkt 5).
    static func spokenDuration(seconds: Double, locale: Locale) -> String {
        let formatter = DateComponentsFormatter()
        formatter.calendar = {
            var calendar = Calendar(identifier: .gregorian)
            calendar.locale = locale
            return calendar
        }()
        formatter.unitsStyle = .full
        formatter.allowedUnits = seconds >= 3_600 ? [.hour, .minute, .second] : [.minute, .second]
        formatter.zeroFormattingBehavior = .dropAll
        return formatter.string(from: max(0, seconds)) ?? clock(seconds: seconds)
    }

    /// Kort varighet for kort og faneinnhold: «20–30 min» eller «5 min».
    static func shortDuration(seconds: Double, locale: Locale) -> String {
        let minutes = max(1, Int((seconds / 60).rounded()))
        let formatter = DateComponentsFormatter()
        formatter.calendar = {
            var calendar = Calendar(identifier: .gregorian)
            calendar.locale = locale
            return calendar
        }()
        formatter.unitsStyle = .short
        formatter.allowedUnits = [.minute]
        return formatter.string(from: Double(minutes * 60)) ?? "\(minutes) min"
    }
}
