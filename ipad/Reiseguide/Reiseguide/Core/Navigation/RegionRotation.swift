// RegionRotation.swift
//
// Ren logikk for bakgrunnsvarselet (pakke 2, item 2): CLLocationManager kan
// bare overvåke 20 CLCircularRegion samtidig, så vi overvåker de nærmeste 20
// severdighetene og bytter settet ut når brukeren har beveget seg nok til at
// det sannsynligvis er endret. Ingen CoreLocation her, så utvalget kan
// enhetstestes; selve start/stopMonitoring-kallene ligger i
// Core/LocationService.swift.

import Foundation

enum RegionRotation {
    /// Apples grense for samtidig CLCircularRegion-overvåking.
    static let maxMonitoredRegions = 20
    /// Ny beregning bare når brukeren har flyttet seg mer enn dette —
    /// regionoppsett (start/stopMonitoring) er dyrere enn et rutekall.
    static let minimumMoveM: Double = 500

    /// De nærmeste `limit` stedene fra `origin` — settet som skal overvåkes akkurat nå.
    static func nearestPois(_ pois: [GuidePOI], from origin: Coordinate, limit: Int = maxMonitoredRegions) -> [GuidePOI] {
        Array(Geo.sortedByDistance(pois, from: origin).prefix(limit).map(\.poi))
    }

    /// Om regionsettet bør regnes ut på nytt: alltid første gang, ellers
    /// bare når origo har flyttet seg over `minimumMoveM`.
    static func shouldRecompute(previousOrigin: Coordinate?, newOrigin: Coordinate, minimumMoveM: Double = Self.minimumMoveM) -> Bool {
        guard let previousOrigin else { return true }
        return Geo.distanceM(from: previousOrigin, to: newOrigin) > minimumMoveM
    }
}
