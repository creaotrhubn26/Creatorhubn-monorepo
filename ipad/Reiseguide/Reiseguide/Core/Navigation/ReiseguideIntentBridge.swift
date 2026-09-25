// ReiseguideIntentBridge.swift
//
// Bro mellom App Intents (Siri/Snarveier/handlingsknappen, pakke 2 item 6)
// og AppEnvironment: `perform()` på et intent kjører i sin egen, kortlivede
// kontekst uten SwiftUI `@Environment`-tilgang, akkurat som i LeadMapApp
// (Core/AppStateBridge.swift, som dette mønsteret er hentet direkte fra).
// Svak referanse: AppEnvironment eies av ReiseguideApp sin @State og lever
// hele prosessens levetid, men weak er riktigere prinsipielt.

import Foundation

@MainActor
final class ReiseguideIntentBridge {
    static let shared = ReiseguideIntentBridge()

    private init() {}

    weak var environment: AppEnvironment?

    /// Kalles fra `ReiseguideApp.init()`, før scenen vises — så et intent med
    /// `openAppWhenRun: true` alltid finner en registrert AppEnvironment,
    /// selv ved kald oppstart (samme rekkefølge-garanti som AppStateBridge).
    func register(_ environment: AppEnvironment) {
        self.environment = environment
    }
}
