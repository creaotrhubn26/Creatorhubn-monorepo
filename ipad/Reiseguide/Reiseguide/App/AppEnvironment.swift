// AppEnvironment.swift
//
// Ett felles objekt-sett som deles via SwiftUI Environment: innstillinger,
// området (innhold), posisjon, besøksloggen (og speilingen av den til
// serveren) og avspilleren. Opprettes én gang i ReiseguideApp. `pendingPoi` er «åpne dette stedet» fra deep link eller
// «liknende i nærheten»; RootTabView utfører navigasjonen.
//
// `arrival` og `tourProgress` (SenseAid Explore pakke 1) er tynne
// orkestratorer rundt ren logikk i Core/ProximityMonitor.swift og
// Core/TourProgress.swift; RootTabView driver dem med små onChange-hooks når
// posisjonen eller besøksloggen endrer seg.
//
// Flere områder: `store` starter på brukerens valgte område (eller Oslo) så
// appen kan spille med én gang; `reconcileArea()` bytter til nærmeste område
// når områdelisten og posisjonen er kjent og brukeren ikke har valgt selv.
// `selectArea(_:)` er brukerens eget valg fra velgeren. Kart, liste,
// turprogresjon og paywall leser `store`, så de følger med automatisk;
// ArrivalCoordinator nullstilles eksplisitt.

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
    let arrival: ArrivalCoordinator
    let tourProgress: TourProgressTracker

    /// Sted som skal åpnes i Utforsk-stacken: id eller slug (deep link).
    var pendingPoi: PendingPoi?
    /// «Gå til neste stopp» fra avspilleren eller etter-besøket (avspiller-
    /// redesignet, punkt 2): spilleren er allerede lukket når dette settes;
    /// RootTabView bytter til Utforsk-fanen og pusher veiviseren dit.
    var pendingVeiviserTarget: VeiviserTarget?

    /// Posisjonen har allerede fått velge område denne økten; ikke bytt igjen
    /// under brukeren hvis de går videre.
    @ObservationIgnored private var didAutoSelectFromLocation = false

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
        self.store = store ?? AreaStore(
            api: api,
            areaSlug: AreaSelection.resolveSlug(storedSlug: settings.selectedAreaSlug, areas: [], location: nil)
        )
        self.location = location
        self.visits = visits
        self.visitSync = VisitSync(settings: settings, visits: visits, transport: api)
        self.player = PlayerViewModel(settings: settings, visits: visits)
        self.arrival = ArrivalCoordinator(settings: settings, store: self.store, player: self.player)
        self.tourProgress = TourProgressTracker()

        // Live Activity (pakke 2, item 6): kobler avspiller-manageren til de
        // andre butikkene så den kan vise avstand til neste stopp.
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 16.1, *) {
            PlayerActivityManager.shared.configure(location: self.location, store: self.store, visits: self.visits, settings: self.settings)
        }
        #endif
    }

    /// Kalles når posisjonen oppdateres (RootTabView).
    func evaluateArrival() {
        arrival.handleLocationUpdate(authorization: location.authorization, fix: location.fix)
    }

    /// Henter områdelisten ved oppstart og velger område (ReiseguideApp).
    func prepareAreas() async {
        await store.loadAreas()
        reconcileArea()
    }

    /// Velger område uten at brukeren har valgt selv: nærmeste når posisjonen
    /// er kjent, ellers Oslo; et lagret valg som backend har fjernet byttes ut.
    /// Kalles når områdelisten er hentet og når posisjonen oppdateres.
    func reconcileArea() {
        guard !store.areas.isEmpty else { return }
        let fix = location.fix?.coordinate
        if settings.selectedAreaSlug == nil {
            guard !didAutoSelectFromLocation else { return }
            if fix != nil { didAutoSelectFromLocation = true }
            // Ikke bytt område under en fortelling som allerede spiller.
            guard !player.hasContent else { return }
        }
        let slug = AreaSelection.resolveSlug(storedSlug: settings.selectedAreaSlug, areas: store.areas, location: fix)
        switchStore(to: slug)
    }

    /// Brukerens eget valg i områdevelgeren; huskes i AppSettings.
    func selectArea(_ area: GuideArea) {
        settings.selectedAreaSlug = area.slug
        switchStore(to: area.slug)
    }

    private func switchStore(to slug: String) {
        guard slug != store.slug else { return }
        store.select(slug: slug, lang: settings.guideLanguage)
        arrival.resetForNewArea()
    }

    /// Kalles når besøksloggen eller stedene endrer seg (RootTabView).
    func evaluateTourProgress() {
        tourProgress.evaluate(area: store.area, pois: store.pois, completedPoiIds: visits.completedPoiIds)
    }

    func open(poi: GuidePOI) {
        pendingPoi = .id(poi.id)
    }

    /// «Gå til neste stopp» (avspiller-redesignet, punkt 2): det
    /// ikke-fullførte stedet som kommer etter `poiId` i områdets rute, se
    /// `TourProgress.nextStop`. Brukt av både avslutningskortet i spilleren
    /// og «etter besøket»-arket, som begge kjenner sitt eget `poiId` uten å
    /// gå via `player.poi`.
    func nextStop(after poiId: String?) -> GuidePOI? {
        TourProgress.nextStop(after: poiId, in: TourProgress.orderedRoute(store.pois), completedPoiIds: visits.completedPoiIds)
    }

    /// Lukker spilleren (om den er åpen) og ber RootTabView pushe veiviseren
    /// mot `poi` på den aktive navigasjonsstacken.
    func openVeiviser(to poi: GuidePOI) {
        player.close()
        pendingVeiviserTarget = .poi(id: poi.id)
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
    /// Veiviseren (pakke 2, item 5): kompassretning til et valgt sted eller «neste sted».
    case veiviser(VeiviserTarget)
}
