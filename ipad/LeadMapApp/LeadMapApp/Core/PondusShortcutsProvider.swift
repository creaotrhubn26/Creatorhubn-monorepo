// PondusShortcutsProvider.swift
//
// AppShortcutsProvider gjør at Pondus-intents vises i Shortcuts-appen
// automatisk (uten at brukeren må trykke «Legg til»). Systemet indekserer
// også fraser slik at Siri kan matche dem uten manuell shortcut-setup.
//
// Norske fraser: Siri støtter norske utsagn på iOS 17+ hvis brukerens
// enhet er satt til bokmål. Systemet velger nærmeste match på tvers
// av alle enabled locales.

import AppIntents

@available(iOS 17.0, *)
struct PondusShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        // 4 pre-defined shortcuts.
        AppShortcut(
            intent: OpenPondusIntent(),
            phrases: [
                "Åpne pondus i \(.applicationName)",
                "Vis pondus-maler i \(.applicationName)",
                "Vis pondus i \(.applicationName)",
            ],
            shortTitle: "Åpne Pondus",
            systemImageName: "book.pages.fill"
        )
        AppShortcut(
            intent: ActivatePondusIntent(),
            phrases: [
                "Aktiver pondus i \(.applicationName)",
                "Bruk pondus-mal i \(.applicationName)",
                "Start pondus i \(.applicationName)",
            ],
            shortTitle: "Aktiver Pondus",
            systemImageName: "play.circle.fill"
        )
        AppShortcut(
            intent: NextPondusStepIntent(),
            phrases: [
                "Neste pondus-steg i \(.applicationName)",
                "Neste steg i \(.applicationName)",
            ],
            shortTitle: "Neste pondus-steg",
            systemImageName: "arrow.right.circle.fill"
        )
        AppShortcut(
            intent: PondusScoreIntent(),
            phrases: [
                "Hva er pondus-scoren i \(.applicationName)",
                "Pondus-score i \(.applicationName)",
                "Les pondus-score i \(.applicationName)",
            ],
            shortTitle: "Pondus-score",
            systemImageName: "chart.bar.fill"
        )
    }
}
