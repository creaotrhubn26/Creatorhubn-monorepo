// PondusAppIntents.swift
//
// App Intents (Siri Shortcuts + Spotlight + Shortcut-app) for Pondus.
// Bruker AppIntent-protokollen (iOS 16+, deployment-target er iOS 17).
//
// Ved «Pondus overalt — trinn 1» eksponerer vi 4 intents:
//   1) OpenPondusIntent          — «Åpne pondus»
//   2) ActivatePondusIntent      — «Aktiver pondus <mal>»
//   3) NextPondusStepIntent      — «Neste pondus-steg»
//   4) PondusScoreIntent         — «Hva er pondus-scoren»
//
// Deep-link-strategi (trinn 2, 2026-07-01):
//   Intent-perform kaller `AppStateBridge.shared.navigateToPondus(...)`
//   som setter deep-link på delt AppState. LeadbookView-observer plukker
//   opp deep-linken og bytter til Pondus-fanen. Fungerer BÅDE ved varm-
//   og kald-start (bridge buffrer om AppState ikke er registrert enda).
//
// PondusScoreIntent leser live fra `AppState.pondusStore` — ingen
// UserDefaults-cache-drift.

import AppIntents
import Foundation
import SwiftUI

// MARK: - Aktivt intent state (bare stegteller — mal-id kommer fra AppState)

/// Vi tracker kun stegteller i UserDefaults. Aktiv mal-id + score leses
/// direkte fra live `AppState.pondusStore` slik at Intent alltid ser
/// samme data som Leadbook-fanen.
@MainActor
final class PondusIntentState {
    static let shared = PondusIntentState()

    private let stepIndexKey = "leadgrid.pondus.intent.stepIndex"
    private let activeIdKey = "leadgrid.pondus.intent.activeId"

    /// Lagres av `ActivatePondusIntent` etter matching, brukes av
    /// `NextPondusStepIntent` for å vite hvilken mal steget refererer til.
    /// Fungerer selv om AppState-instansen er død (Intent-only path).
    var activeTemplateId: String? {
        get { UserDefaults.standard.string(forKey: activeIdKey) }
        set {
            if let v = newValue { UserDefaults.standard.set(v, forKey: activeIdKey) }
            else { UserDefaults.standard.removeObject(forKey: activeIdKey) }
        }
    }

    var currentStepIndex: Int {
        get { UserDefaults.standard.integer(forKey: stepIndexKey) }
        set { UserDefaults.standard.set(newValue, forKey: stepIndexKey) }
    }
}

// MARK: - 1) OpenPondusIntent

/// Åpne Leadgrid og navigér til Leadbook > Pondus.
@available(iOS 17.0, *)
struct OpenPondusIntent: AppIntent {
    static let title: LocalizedStringResource = "Åpne Pondus"
    static let description = IntentDescription(
        "Åpner Leadgrid og viser dine pondus-maler i Leadbook."
    )
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppStateBridge.shared.navigateToPondus()
        return .result()
    }
}

// MARK: - 2) ActivatePondusIntent (parameter: templateName)

@available(iOS 17.0, *)
struct ActivatePondusIntent: AppIntent {
    static let title: LocalizedStringResource = "Aktiver pondus-mal"
    static let description = IntentDescription(
        "Åpner en spesifikk pondus-mal etter navn eller id."
    )
    static let openAppWhenRun: Bool = true

    @Parameter(title: "Mal-navn eller id")
    var templateName: String

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Prøv å matche mot live PondusStore (via AppStateBridge). Match
        // på id ELLER localizedCaseInsensitive-contains på navn.
        let query = templateName.trimmingCharacters(in: .whitespacesAndNewlines)
        let live = AppStateBridge.shared.appState?.pondusStore.templates ?? []

        let match = live.first(where: { dto in
            let idString = dto.id.uuidString.lowercased()
            if idString == query.lowercased() { return true }
            if dto.name.localizedCaseInsensitiveContains(query) { return true }
            return false
        })

        // Nullstill stegteller på ny aktivering (både ved match og bomskudd).
        PondusIntentState.shared.currentStepIndex = 0

        if let match {
            let idStr = match.id.uuidString.lowercased()
            PondusIntentState.shared.activeTemplateId = idStr
            // Send BÅDE id og navn så LeadbookView-observer kan bruke det
            // som treffes først.
            AppStateBridge.shared.navigateToPondus(
                templateId: idStr,
                templateName: match.name
            )
            // Cache score for `PondusScoreIntent` (rask svartid uten å
            // vente på AppState-lookup ved neste kall).
            UserDefaults.standard.set(match.score, forKey: "leadgrid.pondus.intent.activeScore")
            return .result(dialog: IntentDialog("Åpner pondus-mal \"\(match.name)\" (score \(match.score))."))
        } else {
            // Ingen match — åpne likevel Pondus-fanen med søkestrengen så
            // LeadbookView kan tekst-matche i sitt eget fallback-lag hvis
            // maler landet etter intent kjørte (race på cold-start).
            AppStateBridge.shared.navigateToPondus(templateName: query)
            return .result(dialog: IntentDialog("Fant ikke pondus-mal som matcher \"\(query)\". Åpner Pondus-fanen."))
        }
    }
}

// MARK: - 3) NextPondusStepIntent

@available(iOS 17.0, *)
struct NextPondusStepIntent: AppIntent {
    static let title: LocalizedStringResource = "Neste pondus-steg"
    static let description = IntentDescription(
        "Går til neste steg i den aktive pondus-malen."
    )
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let current = PondusIntentState.shared.currentStepIndex
        let next = current + 1
        PondusIntentState.shared.currentStepIndex = next

        // Send til AppState via bridge for at Leadbook-viewet kan reagere.
        // Vi bruker det aktive template-id-et lagret ved siste
        // ActivatePondusIntent — så neste steg fungerer selv etter
        // en re-launch.
        let activeId = PondusIntentState.shared.activeTemplateId
        AppStateBridge.shared.navigateToPondus(templateId: activeId)
        // Poste steg-info separat så LeadbookView vet steget skal endres.
        // Bruk gammel NotificationCenter for stegteller siden det bare er
        // en UI-hint, ikke navigasjons-krav.
        NotificationCenter.default.post(
            name: .pondusStepAdvance,
            object: nil,
            userInfo: ["nextStep": next]
        )
        return .result(dialog: IntentDialog("Går til steg \(next + 1)."))
    }
}

// MARK: - 4) PondusScoreIntent

@available(iOS 17.0, *)
struct PondusScoreIntent: AppIntent {
    static let title: LocalizedStringResource = "Pondus-score"
    static let description = IntentDescription(
        "Leser opp scoren for den aktive pondus-malen."
    )
    static let openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Live-lookup mot AppState.pondusStore — ingen UserDefaults-drift.
        let bridge = AppStateBridge.shared
        let activeId = PondusIntentState.shared.activeTemplateId

        if let state = bridge.appState, let activeId {
            if let match = state.pondusStore.templates.first(where: {
                $0.id.uuidString.lowercased() == activeId
            }) {
                return .result(dialog: IntentDialog(
                    "Aktiv pondus-mal \"\(match.name)\" har score \(match.score)."
                ))
            }
        }

        // Fallback: cached score fra siste ActivatePondusIntent-run. Dekker
        // scenariet der appen ikke er i minnet enda (Intent kjører før
        // AppState fikk lastet templates).
        let cached = UserDefaults.standard.integer(forKey: "leadgrid.pondus.intent.activeScore")
        if cached > 0 {
            return .result(dialog: IntentDialog("Aktiv pondus-mal har score \(cached) (cachet)."))
        }
        return .result(dialog: IntentDialog(
            "Ingen aktiv pondus-mal enda. Åpne Leadgrid og velg en mal først."
        ))
    }
}

// MARK: - NotificationCenter events

extension Notification.Name {
    /// Emitted av NextPondusStepIntent for å be Leadbook om å advance stegteller.
    /// userInfo: ["nextStep": Int]
    static let pondusStepAdvance =
        Notification.Name("LeadMapApp.pondusStepAdvance")
}
