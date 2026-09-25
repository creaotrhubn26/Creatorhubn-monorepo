// TourModeController.swift
//
// Tur-modus (pakke 2, item 3, Daniel-godkjent): «Start tur» → gå til neste
// stopp (veiviseren) → ankomst → spill av → neste, til alt er besøkt. Bygger
// videre på det som allerede finnes i stedet for å lage nye flyter:
// `TourProgress.nextStop(after:in:completedPoiIds:)` for hvilket sted som er
// neste, og `AppEnvironment.openVeiviser(to:)` for selve navigasjonen (samme
// vei som «Gå til neste stopp» i avslutningskortet/etter-besøket bruker).
//
// Viktig grense: touren navigerer ALDRI til neste stopp av seg selv når et
// besøk fullføres — det ville avbrutt «rolig slutt på besøket»
// (EndOfVisitCard) som bevisst lar brukeren puste ut før neste steg. Touren
// oppdaterer bare sin egen tilstand (`noteVisitCompletedIfNew`); brukeren
// går videre med den vanlige «Neste stopp»-knappen, som allerede finnes der.
// Det touren faktisk automatiserer, er kun avspilling ved ankomst
// (`tourModeAutoPlayOnArrival`, av som standard) — se ArrivalCoordinator.
//
// Persistens: `AppSettings.activeTourAreaSlug` overlever et relaunch, så
// `currentPoiId` peker på riktig neste stopp igjen uten at brukeren må velge
// «Start tur» på nytt (så lenge de fortsatt er i samme område).

import Foundation
import Observation

enum TourModeState: Sendable, Equatable {
    case idle
    /// På vei til stedet (veiviseren er åpen eller nettopp lukket dit).
    case walking(poiId: String)
    /// Ankommet, ikke startet avspilling ennå.
    case atStop(poiId: String)
    case playing(poiId: String)
    case completed
}

/// Hendelsene touren reagerer på. Skilt fra selve kontrolleren så
/// tilstandsovergangene kan enhetstestes uten Observation/AppSettings
/// (ReiseguideTests/TourModeControllerTests.swift).
enum TourModeEvent: Sendable, Equatable {
    case started(firstStopId: String?)
    case arrived(poiId: String)
    case playbackStarted(poiId: String)
    case visitCompleted(poiId: String)
    case ended
}

enum TourModeReducer {
    static func reduce(state: TourModeState, event: TourModeEvent) -> TourModeState {
        switch event {
        case let .started(firstStopId):
            guard let firstStopId else { return .completed }
            return .walking(poiId: firstStopId)
        case let .arrived(poiId):
            return .atStop(poiId: poiId)
        case let .playbackStarted(poiId):
            return .playing(poiId: poiId)
        case .visitCompleted:
            // Mellomtilstand: `noteVisitCompletedIfNew` følger opp med enten
            // `.started(next)` eller `.ended` med det samme.
            return .idle
        case .ended:
            return .idle
        }
    }
}

@MainActor
@Observable
final class TourModeController {
    private(set) var state: TourModeState = .idle
    /// Området touren gjelder; nil når ingen tur er aktiv.
    private(set) var activeAreaSlug: String?

    @ObservationIgnored private let settings: AppSettings
    /// Unngår å behandle samme fullførte besøk flere ganger når
    /// `visits.entries` endrer seg av andre grunner (stjerner, quiz).
    @ObservationIgnored private var lastCompletedPoiId: String?

    init(settings: AppSettings) {
        self.settings = settings
        activeAreaSlug = settings.activeTourAreaSlug
    }

    var isActive: Bool { activeAreaSlug != nil }

    /// Stedet UI-et skal vise/navigere til akkurat nå, uansett hvilken av de
    /// tre «underveis»-tilstandene touren er i.
    var currentPoiId: String? {
        switch state {
        case .idle, .completed: return nil
        case let .walking(id), let .atStop(id), let .playing(id): return id
        }
    }

    /// «Start tur»: finner første ikke-besøkte stedet i ruta og returnerer
    /// det til kalleren (AppEnvironment.startTour), som åpner veiviseren dit.
    /// Nil når alt allerede er besøkt — ingenting å starte.
    @discardableResult
    func start(areaSlug: String, route: [GuidePOI], completedPoiIds: Set<String>) -> GuidePOI? {
        let first = TourProgress.nextStop(after: nil, in: route, completedPoiIds: completedPoiIds)
        activeAreaSlug = areaSlug
        settings.activeTourAreaSlug = areaSlug
        lastCompletedPoiId = nil
        state = TourModeReducer.reduce(state: state, event: .started(firstStopId: first?.id))
        return first
    }

    func arrived(at poi: GuidePOI) {
        guard isActive else { return }
        state = TourModeReducer.reduce(state: state, event: .arrived(poiId: poi.id))
    }

    func playbackStarted(for poi: GuidePOI) {
        guard isActive else { return }
        state = TourModeReducer.reduce(state: state, event: .playbackStarted(poiId: poi.id))
    }

    /// Kalt når besøksloggen endrer seg (RootTabView/AppEnvironment). Bare
    /// bokføring — se filhodet for hvorfor den ikke navigerer selv.
    func noteVisitCompletedIfNew(poiId: String, route: [GuidePOI], completedPoiIds: Set<String>) {
        guard isActive, poiId != lastCompletedPoiId else { return }
        lastCompletedPoiId = poiId
        state = TourModeReducer.reduce(state: state, event: .visitCompleted(poiId: poiId))
        guard let next = TourProgress.nextStop(after: poiId, in: route, completedPoiIds: completedPoiIds) else {
            end()
            return
        }
        state = TourModeReducer.reduce(state: state, event: .started(firstStopId: next.id))
    }

    /// Brukeren byttet område mens en tur var aktiv i et annet: touren der gjelder ikke lenger.
    func endIfAreaChanged(to slug: String) {
        guard isActive, activeAreaSlug != slug else { return }
        end()
    }

    /// «Avslutt turen» eller alt er besøkt.
    func end() {
        activeAreaSlug = nil
        settings.activeTourAreaSlug = nil
        lastCompletedPoiId = nil
        state = TourModeReducer.reduce(state: state, event: .ended)
    }
}
