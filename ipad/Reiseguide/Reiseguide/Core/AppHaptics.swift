// AppHaptics.swift
//
// Haptikk gjennom hele appen (SenseAid Explore pakke 1, punkt 2): stjerne-
// valg, quiz-svar, favoritt, kapittelbytte i avspilleren og framme-varselet
// bruker alle SwiftUI sin `.sensoryFeedback` (iOS 17), og alle går via denne
// ene funksjonen. Bryteren «Vibrasjon» (AppSettings.hapticsEnabled, på som
// standard) styrer dem samlet: når den er av returnerer funksjonen nil, som
// `.sensoryFeedback` tolker som «ingen haptikk denne gangen».

import SwiftUI

enum AppHaptics {
    static func feedback(_ feedback: SensoryFeedback, enabled: Bool) -> SensoryFeedback? {
        enabled ? feedback : nil
    }
}
