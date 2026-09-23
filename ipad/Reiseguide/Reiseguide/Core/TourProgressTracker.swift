// TourProgressTracker.swift
//
// Viser feiringen når siste sted i et område er fullført (SenseAid Explore
// pakke 1, punkt 3). Kalles fra en liten hook i RootTabView hver gang
// besøksloggen endrer seg. Tellingen selv er ren logikk i TourProgress.swift;
// her holdes bare hvilke områder som allerede har fått feiringen denne
// appøkten, så den ikke dukker opp igjen (f.eks. når brukeren vurderer et
// besøk etter at touren allerede er fullført).

import Foundation
import Observation

@MainActor
@Observable
final class TourProgressTracker {
    /// Området feiringen gjelder, hvis den skal vises nå. Ikke `private(set)`:
    /// RootTabView binder den to-veis til `.sheet(item:)` med `Bindable`,
    /// samme mønster som PlayerViewModel.finishedVisit/isPresented.
    var celebration: GuideArea?

    @ObservationIgnored private var celebratedAreaIds: Set<String> = []

    init() {}

    /// Kalles når besøksloggen eller stedene endrer seg.
    func evaluate(area: GuideArea?, pois: [GuidePOI], completedPoiIds: Set<String>) {
        guard let area else { return }
        let progress = TourProgress.compute(pois: pois, completedPoiIds: completedPoiIds)
        guard progress.isComplete else { return }
        guard !celebratedAreaIds.contains(area.id) else { return }
        celebratedAreaIds.insert(area.id)
        celebration = area
    }

    func dismissCelebration() {
        celebration = nil
    }
}
