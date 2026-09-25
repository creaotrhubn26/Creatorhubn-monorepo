// ArrivalNotificationService.swift
//
// Lokal varsling ved ankomst i bakgrunnen (pakke 2, item 2, Daniel-godkjent):
// «Du er ved <sted>» med en «Spill av»-handling. Opt-in, av som standard
// (AppSettings.arrivalNotificationsEnabled), og krever «Alltid»-posisjon
// (LocationService.requestAlwaysAuthorization) — se
// Features/Settings/ArrivalNotificationsSettingsSection.swift for det
// to-stegs samtykket (forklarende ark i appen FØR systemprompten).
//
// Viktig grense (planens risikonotat): en bakgrunnsprosess kan ikke
// pålitelig starte AVSpeechSynthesizer/avspilling uten at brukeren har
// samhandlet — appen lover ALDRI automatisk opplesning fra kald bakgrunn i
// tekstene her. «Spill av»-handlingen henter appen fram (`.foreground`);
// avspillingen starter når `AppDelegate`/scene-tap faktisk kjører
// `player.start(poi:)` derfra, ikke før.

import Foundation
import UserNotifications

@MainActor
final class ArrivalNotificationService {
    static let categoryId = "reiseguide.arrival"
    static let playActionId = "reiseguide.arrival.play"
    /// Nøkkelen i varselets `userInfo` som peker til stedet «Spill av» skal starte.
    static let poiIdUserInfoKey = "poiId"

    private let center: UNUserNotificationCenter

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    /// Ber om varslingstillatelse. Kalles først i den to-stegs samtykke-
    /// flyten (etter at brukeren har sagt ja til forklaringsarket), før
    /// `LocationService.requestAlwaysAuthorization()`.
    func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
    }

    /// Registrerer «Spill av»-handlingen. Trygt å kalle flere ganger (f.eks.
    /// ved språkbytte) — setter bare kategorien på nytt.
    func registerCategory(uiLanguage: String) {
        let playAction = UNNotificationAction(
            identifier: Self.playActionId,
            title: L10n.string("notification.action.play", lang: uiLanguage),
            options: [.foreground]
        )
        let category = UNNotificationCategory(
            identifier: Self.categoryId,
            actions: [playAction],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([category])
    }

    /// Planlegger varselet med én gang (trigger: nil) — selve utløsningen
    /// skjer allerede idet CLCircularRegion-en fyrer (LocationService).
    func scheduleArrivalNotification(poi: GuidePOI, uiLanguage: String) {
        let content = UNMutableNotificationContent()
        content.title = L10n.string("notification.arrival.title", lang: uiLanguage)
        content.body = L10n.string("notification.arrival.body", lang: uiLanguage).replacingOccurrences(of: "%@", with: poi.title)
        content.categoryIdentifier = Self.categoryId
        content.sound = .default
        content.userInfo = [Self.poiIdUserInfoKey: poi.id]
        let request = UNNotificationRequest(identifier: "\(Self.categoryId).\(poi.id)", content: content, trigger: nil)
        center.add(request)
    }
}
