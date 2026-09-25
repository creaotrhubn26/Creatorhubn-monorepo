// ReiseguideShortcuts.swift
//
// AppShortcutsProvider (pakke 2, item 6): gjør «Spill nærmeste» synlig i
// Snarveier-appen uten at brukeren må sette opp noe selv, og lar Siri og
// handlingsknappen matche frasene direkte. Samme mønster som
// ipad/LeadMapApp/LeadMapApp/Core/PondusShortcutsProvider.swift.

import AppIntents

@available(iOS 17.0, *)
struct ReiseguideShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PlayNearestPOIIntent(),
            phrases: [
                "Spill nærmeste i \(.applicationName)",
                "Spill av nærmeste sted i \(.applicationName)",
                "Play nearest in \(.applicationName)"
            ],
            shortTitle: "Spill nærmeste",
            systemImageName: "location.fill.viewfinder"
        )
    }
}
