// CaptureAppIntents.swift
//
// Gratis App Intents + App Shortcuts → Siri, Spotlight og Snarveier-appen.
// «Nytt notat i CreatorHub One» oppretter et felt-notat uten å åpne appen
// manuelt. App Shortcuts donerer automatisk til Spotlight.

import AppIntents

@available(iOS 16.0, *)
struct NewNoteIntent: AppIntent {
    static let title: LocalizedStringResource = "Nytt notat"
    static let description = IntentDescription("Lag et raskt felt-notat i CreatorHub One.")
    static let openAppWhenRun: Bool = false

    @Parameter(title: "Notat")
    var text: String

    static var parameterSummary: some ParameterSummary {
        Summary("Lag notatet \(\.$text)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .result(dialog: "Notatet var tomt.")
        }
        _ = NotesStore.shared.quickAdd(trimmed)
        return .result(dialog: "Notat lagret.")
    }
}

@available(iOS 16.0, *)
struct CaptureAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NewNoteIntent(),
            phrases: [
                "Nytt notat i \(.applicationName)",
                "Lag et notat i \(.applicationName)"
            ],
            shortTitle: "Nytt notat",
            systemImageName: "note.text"
        )
    }
}
