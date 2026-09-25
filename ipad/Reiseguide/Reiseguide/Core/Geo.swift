// Geo.swift
//
// Avstand og nærmeste-sortering som ren logikk, uten CoreLocation-avhengighet
// i signaturene, så det kan enhetstestes med syntetiske punkter. PoiEngine
// (radius, prioritet, hysterese, POC-skisse «Posisjon og avspilling») bygger
// videre på dette i steg 4.

import Foundation

enum Geo {
    private static let earthRadiusM: Double = 6_371_000

    /// Haversine-avstand i meter.
    static func distanceM(from a: Coordinate, to b: Coordinate) -> Double {
        let lat1 = a.lat * .pi / 180
        let lat2 = b.lat * .pi / 180
        let dLat = (b.lat - a.lat) * .pi / 180
        let dLng = (b.lng - a.lng) * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * earthRadiusM * asin(min(1, sqrt(h)))
    }

    /// Kompassretning fra a til b i grader (0 = nord, 90 = øst).
    static func bearingDegrees(from a: Coordinate, to b: Coordinate) -> Double {
        let lat1 = a.lat * .pi / 180
        let lat2 = b.lat * .pi / 180
        let dLng = (b.lng - a.lng) * .pi / 180
        let y = sin(dLng) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLng)
        let degrees = atan2(y, x) * 180 / .pi
        return (degrees + 360).truncatingRemainder(dividingBy: 360)
    }

    /// Sorterer severdigheter etter avstand fra et punkt; uten punkt beholdes
    /// backendens rekkefølge (sort_order).
    static func sortedByDistance(_ pois: [GuidePOI], from origin: Coordinate?) -> [(poi: GuidePOI, distanceM: Double?)] {
        guard let origin else { return pois.map { ($0, nil) } }
        return pois
            .map { ($0, Optional(distanceM(from: origin, to: $0.coordinate))) }
            .sorted { ($0.1 ?? .infinity) < ($1.1 ?? .infinity) }
    }

    /// Flat lokal projeksjon (meter øst/nord) rundt `origin`, god nok på
    /// fotgjengerskala (noen hundre meter). Brukt av `distanceToSegmentM`
    /// (turn-by-turn, pakke 2 item 1) — ikke egnet for lange avstander.
    private static func localOffsetM(from origin: Coordinate, to point: Coordinate) -> (eastM: Double, northM: Double) {
        let metersPerDegreeLat = 111_320.0
        let metersPerDegreeLng = 111_320.0 * cos(origin.lat * .pi / 180)
        return ((point.lng - origin.lng) * metersPerDegreeLng, (point.lat - origin.lat) * metersPerDegreeLat)
    }

    /// Korteste avstand fra `point` til linjestykket `segmentStart`–`segmentEnd`,
    /// i meter. Brukes til av-rute-deteksjon i veiviserens turn-by-turn-modus
    /// (pakke 2, item 1): stor avstand til nærmeste del av ruta betyr brukeren
    /// har forlatt den planlagte gangruta.
    static func distanceToSegmentM(point: Coordinate, segmentStart: Coordinate, segmentEnd: Coordinate) -> Double {
        let p = localOffsetM(from: segmentStart, to: point)
        let b = localOffsetM(from: segmentStart, to: segmentEnd)
        let segmentLengthSq = b.eastM * b.eastM + b.northM * b.northM
        let t = segmentLengthSq > 0 ? max(0, min(1, (p.eastM * b.eastM + p.northM * b.northM) / segmentLengthSq)) : 0
        let closestEastM = b.eastM * t
        let closestNorthM = b.northM * t
        let dx = p.eastM - closestEastM
        let dy = p.northM - closestNorthM
        return sqrt(dx * dx + dy * dy)
    }
}
