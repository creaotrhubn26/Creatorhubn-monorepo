// AppStateBridge.swift
//
// Cross-context shim som lar App Intents (Siri Shortcuts / Spotlight),
// Watch-connectivity-events og andre ikke-SwiftUI-verdener nå AppState.
//
// Problemet: App Intents kjører i sin egen kortlivede kontekst — de kan
// ikke lese SwiftUI `@Environment(AppState.self)` direkte. Og ved
// `openAppWhenRun: true` kjører `perform()` FØR SwiftUI-scenen er ferdig
// bootstrap-et, så en løs NotificationCenter-post kan gå tapt hvis ingen
// har rukket å registrere seg som observer enda.
//
// Løsning: en singleton `AppStateBridge` som holder en svak referanse
// til den aktive `AppState`. Både `AppState`-init (som setter seg selv
// i bridget) og App Intent-perform-metoder kan trygge seg på at bridget
// alltid har siste kjente AppState.
//
// Cold-start-flyten:
//   1. Bruker sier «Siri, aktiver pondus første kontakt»
//   2. App er ikke i minnet. iOS launcher LeadMapApp med Scene-init først.
//   3. LeadMapApp.@main sin `body`-init lager AppState + registrerer i bridget.
//   4. iOS kaller `ActivatePondusIntent.perform()` etter Scene-init.
//   5. Intent bruker `AppStateBridge.shared.navigateToPondus(...)` → setter
//      `deepLinkPondusTemplateName` på AppState.
//   6. LeadbookView-observer plukker opp deep-linken i sin `.task` /
//      `.onChange(of:)` og bytter til Pondus-fanen.
//
// Warm-start-flyten (app allerede kjører):
//   Samme, bare uten steg 2-3.

import Foundation

/// Broker mellom ikke-SwiftUI-kontekster (App Intents, WatchConnectivity)
/// og hoved-`AppState`. Singleton — ett bridg per prosess.
@MainActor
final class AppStateBridge {
    static let shared = AppStateBridge()

    /// Svak referanse så vi ikke holder AppState kunstig i live. AppState
    /// eies av `LeadMapApp.@State` og lever hele prosessens levetid, så
    /// weak vs. strong har praktisk sett ingen forskjell — men weak er
    /// riktigere pga. potensielt scene-switch-scenario på Vision Pro.
    weak var appState: AppState?

    /// Registrer AppState-instansen. Kalles fra `LeadMapApp.@main.init`.
    func register(_ state: AppState) {
        self.appState = state
    }

    // MARK: - Pondus deep-link

    /// Åpne Leadbook > Pondus. Om `templateId` er satt, prøv å auto-velge
    /// den malen. `templateName` er alternativ mote for match-by-navn
    /// (Siri: «Aktiver pondus første kontakt»).
    ///
    /// Trygg å kalle fra:
    ///   - App Intent `.perform()` (både varmt og kaldt oppstart)
    ///   - WatchConnectivity-mottakeren (PondusWatchSync)
    ///   - PhoneSession-delegat-callbacks
    ///
    /// Fungerer selv om AppState ikke er registrert enda — vi buffrer da
    /// deep-linken i en «pending»-slot og deployer den så snart AppState
    /// registrerer seg. Dette dekker cold-start-scenariet der Intent-
    /// perform kjører før @State-init.
    func navigateToPondus(
        templateId: String? = nil,
        templateName: String? = nil,
        stepIndex: Int? = nil
    ) {
        if let state = appState {
            state.setPondusDeepLink(
                templateId: templateId,
                templateName: templateName,
                stepIndex: stepIndex
            )
        } else {
            // Buffer inntil AppState registrerer seg. `pendingPondusDeepLink`
            // konsumeres i `register(_:)` nedenfor.
            pendingPondusDeepLink = (templateId, templateName, stepIndex, Date())
        }
    }

    /// Klar deep-link etter at LeadbookView har konsumert den.
    func clearPondusDeepLink() {
        appState?.clearPondusDeepLink()
    }

    // MARK: - Notification-tap (cold-start-support)

    /// Et varsel-tap ber om å åpne varsel-inboksen (+ evt. deep-linke til
    /// en lead). Buffres hvis AppState ikke er klar enda (cold-start-tap
    /// fyrer før en header monteres) og deployes i `register(_:)`.
    func handleNotificationTap(_ payload: [String: String]) {
        if appState != nil {
            appState?.pendingNotificationTap = payload
        } else {
            pendingNotificationTap = (payload, Date())
        }
    }
    private var pendingNotificationTap: (payload: [String: String], at: Date)?

    // MARK: - Pending buffer (cold-start-support)

    private var pendingPondusDeepLink: (
        templateId: String?, templateName: String?, stepIndex: Int?, at: Date
    )?

    /// Kalles av `LeadMapApp.@main.init` etter at AppState er laget. Hvis
    /// vi har en buffret deep-link fra en intent-perform som kjørte før
    /// SwiftUI-scenen kom opp, deployer vi den nå.
    func flushPendingDeepLinks() {
        guard let state = appState else { return }
        if let pending = pendingPondusDeepLink {
            // Skip stale pending (>60s gammel) — sannsynlig at en tidligere
            // Intent kjørte men brukeren nå åpner appen manuelt.
            if Date().timeIntervalSince(pending.at) < 60 {
                state.setPondusDeepLink(
                    templateId: pending.templateId,
                    templateName: pending.templateName,
                    stepIndex: pending.stepIndex
                )
            }
            pendingPondusDeepLink = nil
        }
        if let tap = pendingNotificationTap {
            if Date().timeIntervalSince(tap.at) < 60 {
                state.pendingNotificationTap = tap.payload
            }
            pendingNotificationTap = nil
        }
    }
}
