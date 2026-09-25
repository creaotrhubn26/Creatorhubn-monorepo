// RouteProgress.swift
//
// Ren logikk for turn-by-turn i veiviseren (pakke 2, item 1): hvilket steg i
// WalkingRoute.steps brukeren er på nå, avstand til neste manøver, og
// av-rute-deteksjon (korteste avstand til gjeldende stegs del av polylinjen,
// Geo.distanceToSegmentM). Ingen CoreLocation/MapKit her, så alt kan
// enhetstestes med syntetiske koordinater; selve talen og reroute-kallet
// ligger i RouteStepAnnouncer.swift og VeiviserViewModel.swift.

import Foundation

struct RouteStepProgress: Sendable, Equatable {
    let currentStepIndex: Int
    /// Avstand til der neste manøver skjer (slutten av gjeldende steg), i meter.
    let distanceToManeuverM: Double
    let isOffRoute: Bool
}

enum RouteProgress {
    /// Innenfor denne avstanden fra slutten av steget regnes manøveren som «gjort»: hopp til neste.
    static let arrivalRadiusM: Double = 15
    /// Over denne avstanden fra gjeldende stegs linje regnes brukeren som av ruta.
    static let offRouteThresholdM: Double = 30

    /// Oppdaterer stegindeksen ut fra posisjonen. `previousStepIndex` er
    /// forrige kjente steg — funksjonen går bare framover (aldri tilbake i
    /// ruta), så et kortvarig GPS-hopp bakover ikke hopper et steg tilbake.
    static func update(coordinate: Coordinate, steps: [WalkingRouteStep], previousStepIndex: Int) -> RouteStepProgress {
        guard !steps.isEmpty else {
            return RouteStepProgress(currentStepIndex: 0, distanceToManeuverM: 0, isOffRoute: false)
        }
        var stepIndex = min(max(0, previousStepIndex), steps.count - 1)

        while stepIndex < steps.count - 1, let end = steps[stepIndex].coordinates.last,
              Geo.distanceM(from: coordinate, to: end) <= arrivalRadiusM {
            stepIndex += 1
        }

        let distanceToManeuver = steps[stepIndex].coordinates.last.map { Geo.distanceM(from: coordinate, to: $0) } ?? 0
        return RouteStepProgress(
            currentStepIndex: stepIndex,
            distanceToManeuverM: distanceToManeuver,
            isOffRoute: isOffRoute(coordinate: coordinate, step: steps[stepIndex])
        )
    }

    private static func isOffRoute(coordinate: Coordinate, step: WalkingRouteStep) -> Bool {
        let coordinates = step.coordinates
        guard coordinates.count > 1 else { return false }
        var nearest = Double.greatestFiniteMagnitude
        for index in 0 ..< (coordinates.count - 1) {
            let distance = Geo.distanceToSegmentM(point: coordinate, segmentStart: coordinates[index], segmentEnd: coordinates[index + 1])
            nearest = min(nearest, distance)
        }
        return nearest > offRouteThresholdM
    }
}

/// Krever flere påfølgende av-rute-avlesninger før en ny rute bes om, samme
/// idé som ProximityMonitor sin armering — én enkelt dårlig GPS-avlesning
/// skal ikke trigge en unødvendig MKDirections-omberegning.
struct OffRouteRerouteGate: Sendable, Equatable {
    static let requiredConsecutiveFixes = 3

    private(set) var consecutiveOffRouteCount = 0

    /// Returnerer true (og nullstiller telleren) når terskelen nås denne
    /// gangen — kalleren skal da be WalkingRouteService om ny rute.
    @discardableResult
    mutating func update(isOffRoute: Bool) -> Bool {
        guard isOffRoute else {
            consecutiveOffRouteCount = 0
            return false
        }
        consecutiveOffRouteCount += 1
        guard consecutiveOffRouteCount >= Self.requiredConsecutiveFixes else { return false }
        consecutiveOffRouteCount = 0
        return true
    }
}
