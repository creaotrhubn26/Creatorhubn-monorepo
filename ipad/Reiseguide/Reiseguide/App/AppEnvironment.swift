// AppEnvironment.swift
//
// Ett felles objekt-sett som deles via SwiftUI Environment: innstillinger,
// området (innhold), posisjon og avspilleren. Opprettes én gang i ReiseguideApp.

import Observation
import SwiftUI

@MainActor
@Observable
final class AppEnvironment {
    let settings: AppSettings
    let store: AreaStore
    let location: LocationService
    let player: PlayerViewModel

    init(
        settings: AppSettings = AppSettings(),
        store: AreaStore = AreaStore(),
        location: LocationService = LocationService()
    ) {
        self.settings = settings
        self.store = store
        self.location = location
        self.player = PlayerViewModel(settings: settings)
    }

    /// Mock-paywall: første POI i området (free_preview) er alltid åpen.
    func isLocked(_ poi: GuidePOI) -> Bool {
        if poi.freePreview { return false }
        return !settings.isUnlocked(areaId: poi.areaId)
    }

    /// Kategorietikett på valgt språk; backend har allerede valgt riktig `label`,
    /// men vi faller til `labels` hvis språket byttes uten ny henting.
    func categoryLabel(_ id: String?) -> String? {
        guard let id, let category = store.categories.first(where: { $0.id == id }) else { return nil }
        return category.labels[settings.guideLanguage] ?? category.label
    }
}

/// Navigasjonsmål i Utforsk-stacken.
enum Route: Hashable {
    case map
    case poi(String)
}
