// TourProgress.swift
//
// Ren logikk for turprogresjonen (SenseAid Explore pakke 1, punkt 3): ruten
// er området sine severdigheter i `sortOrder`, besøkt er fullførte besøk i
// VisitLogStore for de samme stedene. Ingen avhengighet til UI eller
// Observation her, så tellingen kan enhetstestes direkte (se
// TourProgressTests). TourProgressTracker (samme mappe) bruker dette til å
// vise ringen og feiringen når touren er fullført.

import Foundation

struct TourProgress: Sendable, Equatable {
    let visitedCount: Int
    let total: Int

    var isComplete: Bool { total > 0 && visitedCount >= total }
    var fraction: Double { total > 0 ? Double(visitedCount) / Double(total) : 0 }

    /// Teller hvor mange av `pois` som har en fullført oppføring i `completedPoiIds`.
    static func compute(pois: [GuidePOI], completedPoiIds: Set<String>) -> TourProgress {
        let routeIds = Set(pois.map(\.id))
        let visited = routeIds.intersection(completedPoiIds).count
        return TourProgress(visitedCount: visited, total: pois.count)
    }

    /// Ruten i rekkefølgen den er ment å gås: severdighetene sortert etter `sortOrder`.
    static func orderedRoute(_ pois: [GuidePOI]) -> [GuidePOI] {
        pois.sorted { $0.sortOrder < $1.sortOrder }
    }
}
