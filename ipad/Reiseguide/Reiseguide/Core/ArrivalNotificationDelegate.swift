// ArrivalNotificationDelegate.swift
//
// Håndterer «Spill av»-handlingen på bakgrunnsvarselet (pakke 2, item 2):
// leser stedets id fra varselets userInfo og starter avspilling via
// ReiseguideIntentBridge — samme bro App Intents (pakke 2, item 6) bruker
// for å nå AppEnvironment fra en kontekst uten SwiftUI-miljø.
//
// Se ArrivalNotificationService.swift for hvorfor dette ALDRI garanterer
// avspilling fra en drept/kald app: dette kjører bare når systemet faktisk
// har startet/vekket appen og levert svaret hit.

import Foundation
import UserNotifications

@MainActor
final class ArrivalNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = ArrivalNotificationDelegate()

    override private init() { super.init() }

    /// Vis varselet selv om appen skulle være i forgrunnen når det leveres.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let isPlayAction = response.actionIdentifier == ArrivalNotificationService.playActionId
            || response.actionIdentifier == UNNotificationDefaultActionIdentifier
        let poiId = response.notification.request.content.userInfo[ArrivalNotificationService.poiIdUserInfoKey] as? String
        // Kvitteres med en gang: completion-handleren er ikke Sendable og kan
        // ikke tas med inn på hovedaktøren i Swift 6. Avspillingen starter
        // rett etterpå på hovedaktøren.
        completionHandler()
        guard isPlayAction, let poiId else { return }
        Task { @MainActor in
            ReiseguideIntentBridge.shared.environment?.playFromNotification(poiId: poiId)
        }
    }
}
