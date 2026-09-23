// WalkingRoute.swift
//
// Ren logikk for rutene på kartet: turruta (områdets steder i sortOrder),
// gangruta til valgt sted fra MKDirections, luftlinje som reserve når
// posisjon mangler eller kallet feiler, og throttlingen av rutekall (nytt
// kall bare når valget endres eller brukeren har flyttet seg mer enn 50 m).
// Ingen MapKit/Observation her, så alt kan enhetstestes med tall alene;
// selve kallet ligger i WalkingRouteService.swift.

import CoreLocation
import Foundation

/// Gangrute fra MKDirections, trukket ut til Sendable-verdier med én gang
/// (MKRoute er ikke Sendable) så den trygt kan ligge i kartets tilstand.
struct WalkingRoute: Sendable, Equatable {
    let poiId: String
    let coordinates: [Coordinate]
    let expectedTravelTimeS: Double
    let distanceM: Double

    var walkingMinutes: Int { Self.wholeMinutes(seconds: expectedTravelTimeS) }

    /// Hele minutter, minst 1 («0 min» hjelper ingen).
    static func wholeMinutes(seconds: Double) -> Int { max(1, Int((seconds / 60).rounded())) }
}

/// Hva et rutekall ble bedt om: sted og startpunkt.
struct WalkingRouteRequestKey: Sendable, Equatable {
    let poiId: String
    let origin: Coordinate
}

enum WalkingRouteThrottle {
    /// Ny rute til samme sted først når brukeren har flyttet seg mer enn dette.
    static let minimumMoveM: Double = 50

    /// Nytt kall når det ikke finnes et forrige, når valgt sted er byttet,
    /// eller når startpunktet har flyttet seg mer enn `minimumMoveM`.
    static func shouldRequest(previous: WalkingRouteRequestKey?, next: WalkingRouteRequestKey) -> Bool {
        guard let previous else { return true }
        if previous.poiId != next.poiId { return true }
        return Geo.distanceM(from: previous.origin, to: next.origin) > minimumMoveM
    }
}

/// Linja kartet tegner til valgt sted, med avstanden kortet viser.
struct MapRouteLine: Sendable, Equatable {
    let coordinates: [Coordinate]
    let distanceM: Double
    /// Gangtid i sekunder; nil når dette er luftlinje (reserve).
    let walkingTimeS: Double?

    var isWalkingRoute: Bool { walkingTimeS != nil }

    /// Gangruta hvis den gjelder valgt sted, ellers rett linje fra
    /// posisjonen. Nil uten valgt sted eller uten posisjon.
    static func resolve(poi: GuidePOI?, origin: Coordinate?, route: WalkingRoute?) -> MapRouteLine? {
        guard let poi, let origin else { return nil }
        if let route, route.poiId == poi.id, route.coordinates.count > 1 {
            return MapRouteLine(coordinates: route.coordinates, distanceM: route.distanceM, walkingTimeS: route.expectedTravelTimeS)
        }
        return MapRouteLine(
            coordinates: [origin, poi.coordinate],
            distanceM: Geo.distanceM(from: origin, to: poi.coordinate),
            walkingTimeS: nil
        )
    }
}

enum TourRoute {
    /// Koordinatene i turrekkefølge (sortOrder); tom når det er under to steder.
    static func coordinates(_ pois: [GuidePOI]) -> [Coordinate] {
        let ordered = TourProgress.orderedRoute(pois).map(\.coordinate)
        return ordered.count > 1 ? ordered : []
    }
}

extension Coordinate {
    var clCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}
