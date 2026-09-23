// ArrivalCoordinator.swift
//
// Orkestrerer «Du er framme» (SenseAid Explore pakke 1, punkt 1) rundt
// ProximityMonitor: kalles fra en liten hook i RootTabView hver gang
// posisjonen oppdateres, mens brukeren har gitt posisjonstillatelse og
// oppdateringer kjører (ingen ny bakgrunnsposisjon eller nytt samtykke).
// Viser et bunnkort («Spill av» / «Ikke nå» / «Bytt til …») som blir
// liggende til brukeren avviser det eller forlater sonen, eller starter
// avspilling automatisk hvis «Start automatisk når jeg er framme» er på og
// ingenting spiller. Hopper alltid over stedet som allerede spilles.

import Foundation
import Observation

/// Kortet ArrivalCoordinator viser: stedet som ble nådd, og hva som eventuelt spilte fra før.
struct ArrivalCard: Identifiable, Equatable {
    let poi: GuidePOI
    /// Stedet som spilte da kortet dukket opp; nil hvis ingenting spilte («Spill av» vises da, ellers «Bytt til …»).
    let previouslyPlaying: GuidePOI?

    var id: String { poi.id }
}

@MainActor
@Observable
final class ArrivalCoordinator {
    /// Kortet som vises nå, hvis noe.
    private(set) var card: ArrivalCard?

    /// Stedet som nettopp ble nådd: trigger for annonsering og haptikk i
    /// RootTabView (samme mønster som PlayerViewModel.pendingChapterAnnouncement).
    /// Nullstilles av visningen etter at den har lest av den.
    var pendingAnnouncement: GuidePOI?

    @ObservationIgnored private var monitor = ProximityMonitor()
    @ObservationIgnored private let settings: AppSettings
    @ObservationIgnored private let store: AreaStore
    @ObservationIgnored private let player: PlayerViewModel

    init(settings: AppSettings, store: AreaStore, player: PlayerViewModel) {
        self.settings = settings
        self.store = store
        self.player = player
    }

    /// Kalles når `LocationService.fix` endrer seg.
    func handleLocationUpdate(authorization: LocationService.Authorization, fix: LocationFix?) {
        guard authorization == .authorized, let fix else { return }

        let arrivedId = monitor.update(coordinate: fix.coordinate, pois: store.pois)

        // Brukeren forlot sonen kortet gjelder: la kortet følge med ut.
        if let card, monitor.dockedPoiId != card.poi.id {
            self.card = nil
        }

        guard let arrivedId, let poi = store.poi(id: arrivedId) else { return }
        // Allerede det som spilles: ikke forstyrr.
        guard poi.id != player.poi?.id else { return }

        let previouslyPlaying = player.poi
        pendingAnnouncement = poi

        if settings.autoStartOnArrival, !player.hasContent {
            player.start(poi: poi)
        } else {
            card = ArrivalCard(poi: poi, previouslyPlaying: previouslyPlaying)
        }
    }

    /// «Ikke nå»: kortet lukkes, men stedet er fortsatt «nådd» denne økten (varsles ikke igjen).
    func dismissCard() {
        card = nil
    }

    /// «Spill av» eller «Bytt til …»: begge starter opplevelsen på det ankomne stedet.
    func playCardPoi() {
        guard let poi = card?.poi else { return }
        card = nil
        player.start(poi: poi)
    }
}
