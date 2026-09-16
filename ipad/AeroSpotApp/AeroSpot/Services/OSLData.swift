// OSLData.swift — kuratert statisk metadata for demo-flyplassen
// Oslo Gardermoen (OSL/ENGM). Speiler web-versjonens data/osl.ts.

import Foundation
import CoreLocation

enum OSLData {
    static let airport = Airport(
        icao: "ENGM",
        iata: "OSL",
        name: "Oslo Gardermoen",
        coordinate: CLLocationCoordinate2D(latitude: 60.1976, longitude: 11.1004),
        runways: [
            Runway(
                id: "01L", headingDeg: 13, reciprocal: "19R", lengthM: 3600,
                thresholdA: CLLocationCoordinate2D(latitude: 60.1756, longitude: 11.0730),
                thresholdB: CLLocationCoordinate2D(latitude: 60.2079, longitude: 11.0806)
            ),
            Runway(
                id: "01R", headingDeg: 13, reciprocal: "19L", lengthM: 2950,
                thresholdA: CLLocationCoordinate2D(latitude: 60.1822, longitude: 11.1113),
                thresholdB: CLLocationCoordinate2D(latitude: 60.2088, longitude: 11.1176)
            ),
        ]
    )

    static func corridor(
        threshold: CLLocationCoordinate2D, courseDeg: Double
    ) -> [CLLocationCoordinate2D] {
        // Flyene nærmer seg FRA (course + 180). Kilen åpner utover derfra.
        let approachFrom = (courseDeg + 180).truncatingRemainder(dividingBy: 360)
        let lengthKm = 14.0
        let halfWidthKm = 1.6
        let apex = threshold
        let farCenter = project(apex, bearingDeg: approachFrom, distanceKm: lengthKm)
        let left = project(farCenter, bearingDeg: approachFrom - 90, distanceKm: halfWidthKm)
        let right = project(farCenter, bearingDeg: approachFrom + 90, distanceKm: halfWidthKm)
        return [apex, left, right]
    }

    /// Flytt et punkt `distanceKm` langs `bearingDeg`.
    static func project(
        _ from: CLLocationCoordinate2D, bearingDeg: Double, distanceKm: Double
    ) -> CLLocationCoordinate2D {
        let rad = bearingDeg * .pi / 180
        let dLat = distanceKm / 111.0 * cos(rad)
        let dLng = distanceKm / (111.0 * cos(from.latitude * .pi / 180)) * sin(rad)
        return CLLocationCoordinate2D(latitude: from.latitude + dLat, longitude: from.longitude + dLng)
    }

    static let spottingLocations: [SpottingLocation] = [
        SpottingLocation(
            id: "osl-vollen", name: "Vollen",
            coordinate: CLLocationCoordinate2D(latitude: 60.1690, longitude: 11.0655),
            description: "Klassikeren for 01L-ankomster. Flyene passerer lavt rett over, og du står med solen i ryggen på morgenen.",
            rating: 4.8,
            bestFor: ["RWY 01L arrivals", "morgen", "100–400 mm"],
            focalRange: 100...400,
            runwayIds: ["01L"], arrivals: true, departures: false,
            sunNotes: "Sidebelysning fra sørøst på morgenen, motlys sen kveld.",
            parking: "Gratis parkering langs veien, 200 m unna.",
            walkMinutes: 3, restrictions: nil, shootingDirectionDeg: 45
        ),
        SpottingLocation(
            id: "osl-kirkegarden", name: "Gardermoen kirke",
            coordinate: CLLocationCoordinate2D(latitude: 60.2145, longitude: 11.0780),
            description: "Nordenden av 01L/19R. Perfekt for 19R-ankomster og 01L-avganger med rotasjon rett foran deg.",
            rating: 4.5,
            bestFor: ["RWY 19R arrivals", "RWY 01L departures", "ettermiddag", "200–500 mm"],
            focalRange: 200...500,
            runwayIds: ["01L"], arrivals: true, departures: true,
            sunNotes: "Best lys på ettermiddag/kveld med sol fra vest.",
            parking: "Parkering ved kirken.",
            walkMinutes: 5, restrictions: nil, shootingDirectionDeg: 135
        ),
        SpottingLocation(
            id: "osl-east-mound", name: "Østre voll",
            coordinate: CLLocationCoordinate2D(latitude: 60.1935, longitude: 11.1265),
            description: "Forhøyning øst for 01R med oversikt over taxiway og terminal. Fin for spesial-liveries.",
            rating: 4.2,
            bestFor: ["RWY 01R", "taxiway", "formiddag", "70–300 mm"],
            focalRange: 70...300,
            runwayIds: ["01R"], arrivals: true, departures: true,
            sunNotes: "Sol bakfra på formiddagen — god frontbelysning mot vest.",
            parking: "Begrenset — bruk pendlerparkering.",
            walkMinutes: 10,
            restrictions: "Ikke gå innenfor gjerdet. Respekter skilting.",
            shootingDirectionDeg: 270
        ),
        SpottingLocation(
            id: "osl-approach-south", name: "Sørlige innflyving",
            coordinate: CLLocationCoordinate2D(latitude: 60.1520, longitude: 11.0680),
            description: "Under glideslope for 01L, ca. 2,5 km fra terskel. Flyene i ~800 ft — store undersidebilder.",
            rating: 4.0,
            bestFor: ["RWY 01L arrivals", "underside", "24–105 mm"],
            focalRange: 24...105,
            runwayIds: ["01L"], arrivals: true, departures: false,
            sunNotes: "Fungerer i alt lys — flyet er over deg.",
            parking: "Landbruksvei — parker hensynsfullt.",
            walkMinutes: 2, restrictions: nil, shootingDirectionDeg: 0
        ),
    ]
}
