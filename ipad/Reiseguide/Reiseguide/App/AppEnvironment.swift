// AppEnvironment.swift
//
// Ett felles objekt-sett som deles via SwiftUI Environment: innstillinger,
// området (innhold), posisjon, besøksloggen (og speilingen av den til
// serveren) og avspilleren. Opprettes én gang i ReiseguideApp. `pendingPoi` er «åpne dette stedet» fra deep link eller
// «liknende i nærheten»; RootTabView utfører navigasjonen.

import Observation
import SwiftUI

@MainActor
@Observable
final class AppEnvironment {
    let settings: AppSettings
    let api: GuideAPIClient
    let store: AreaStore
    let location: LocationService
    let visits: VisitLogStore
    let visitSync: VisitSync
    let player: PlayerViewModel

    /// Sted som skal åpnes i Utforsk-stacken: id eller slug (deep link).
    var pendingPoi: PendingPoi?

    enum PendingPoi: Equatable {
        case id(String)
        case slug(String)
    }

    init(
        settings: AppSettings = AppSettings(),
        api: GuideAPIClient = GuideAPIClient(),
        store: AreaStore? = nil,
        location: LocationService = LocationService(),
        visits: VisitLogStore = VisitLogStore()
    ) {
        self.settings = settings
        self.api = api
        self.store = store ?? AreaStore(api: api)
        self.location = location
        self.visits = visits
        self.visitSync = VisitSync(settings: settings, visits: visits, transport: api)
        self.player = PlayerViewModel(settings: settings, visits: visits)
    }

    func open(poi: GuidePOI) {
        pendingPoi = .id(poi.id)
    }

    /// senseaidexplore://poi/{slug}?lang=nb fra delingssiden.
    func handle(url: URL) {
        guard case let .poi(slug, lang) = DeepLink.parse(url) else { return }
        if let lang, settings.guideLanguage != lang {
            settings.guideLanguage = lang
        }
        pendingPoi = .slug(slug)
    }

    /// Finner POI-en bak `pendingPoi` når området er lastet; nil til da.
    func resolvePendingPoi() -> GuidePOI? {
        switch pendingPoi {
        case let .id(id): return store.poi(id: id)
        case let .slug(slug): return store.pois.first { $0.slug == slug }
        case nil: return nil
        }
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
