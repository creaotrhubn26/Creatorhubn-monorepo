// AirportCatalog.swift — flere flyplasser med egne rullebaner og
// spottepunkter. OSL beholdes fra OSLData; her legges resten til.
// Entusiaster reiser (jf. Arrangementer-fanen), så appen må dekke mer
// enn Gardermoen.

import Foundation
import CoreLocation

struct AirportEntry: Identifiable, Sendable {
    var id: String { airport.icao }
    let airport: Airport
    let spots: [SpottingLocation]
}

enum AirportCatalog {
    /// Alle støttede flyplasser. OSL først (default).
    static let all: [AirportEntry] = [
        AirportEntry(airport: OSLData.airport, spots: OSLData.spottingLocations),
        bergen,
        trondheim,
        stavanger,
        tromso,
    ]

    static func entry(icao: String) -> AirportEntry {
        all.first { $0.airport.icao == icao } ?? all[0]
    }

    // ── Bergen Flesland (ENBR/BGO) ───────────────────────────────────
    private static let bergen = AirportEntry(
        airport: Airport(
            icao: "ENBR", iata: "BGO", name: "Bergen Flesland",
            coordinate: CLLocationCoordinate2D(latitude: 60.2934, longitude: 5.2181),
            runways: [
                Runway(
                    id: "17", headingDeg: 173, reciprocal: "35", lengthM: 2990,
                    thresholdA: CLLocationCoordinate2D(latitude: 60.3060, longitude: 5.2150),
                    thresholdB: CLLocationCoordinate2D(latitude: 60.2790, longitude: 5.2210)
                ),
            ]
        ),
        spots: [
            SpottingLocation(
                id: "bgo-lilandsvegen", name: "Lilandsvegen",
                coordinate: CLLocationCoordinate2D(latitude: 60.2760, longitude: 5.2270),
                description: "Sørenden av bane 17/35 med lav passering av ankomster fra sør.",
                rating: 4.3, bestFor: ["RWY 17 arrivals", "ettermiddag", "100–400 mm"],
                focalRange: 100...400, runwayIds: ["17"], arrivals: true, departures: false,
                sunNotes: "Ettermiddagssol fra vest gir fint sidelys.",
                parking: "Langs veien.", walkMinutes: 4, restrictions: nil,
                shootingDirectionDeg: 90
            ),
        ]
    )

    // ── Trondheim Værnes (ENVA/TRD) ──────────────────────────────────
    private static let trondheim = AirportEntry(
        airport: Airport(
            icao: "ENVA", iata: "TRD", name: "Trondheim Værnes",
            coordinate: CLLocationCoordinate2D(latitude: 63.4578, longitude: 10.9240),
            runways: [
                Runway(
                    id: "09", headingDeg: 87, reciprocal: "27", lengthM: 2999,
                    thresholdA: CLLocationCoordinate2D(latitude: 63.4580, longitude: 10.8900),
                    thresholdB: CLLocationCoordinate2D(latitude: 63.4575, longitude: 10.9560)
                ),
            ]
        ),
        spots: [
            SpottingLocation(
                id: "trd-langoyneset", name: "Langøyneset",
                coordinate: CLLocationCoordinate2D(latitude: 63.4560, longitude: 10.9620),
                description: "Østenden med fjord i bakgrunnen. Ankomster på 27 passerer lavt.",
                rating: 4.4, bestFor: ["RWY 27 arrivals", "fjordbakgrunn", "70–300 mm"],
                focalRange: 70...300, runwayIds: ["09"], arrivals: true, departures: true,
                sunNotes: "Morgen gir frontlys mot vest.",
                parking: "Grusplass.", walkMinutes: 6, restrictions: nil,
                shootingDirectionDeg: 270
            ),
        ]
    )

    // ── Stavanger Sola (ENZV/SVG) ────────────────────────────────────
    private static let stavanger = AirportEntry(
        airport: Airport(
            icao: "ENZV", iata: "SVG", name: "Stavanger Sola",
            coordinate: CLLocationCoordinate2D(latitude: 58.8767, longitude: 5.6378),
            runways: [
                Runway(
                    id: "18", headingDeg: 182, reciprocal: "36", lengthM: 2556,
                    thresholdA: CLLocationCoordinate2D(latitude: 58.8880, longitude: 5.6330),
                    thresholdB: CLLocationCoordinate2D(latitude: 58.8650, longitude: 5.6390)
                ),
            ]
        ),
        spots: [
            SpottingLocation(
                id: "svg-solastranden", name: "Solastranden",
                coordinate: CLLocationCoordinate2D(latitude: 58.8630, longitude: 5.6180),
                description: "Strand rett sør for banen. Lave ankomster over sanden — ikonisk.",
                rating: 4.7, bestFor: ["RWY 18 arrivals", "strand", "50–300 mm"],
                focalRange: 50...300, runwayIds: ["18"], arrivals: true, departures: false,
                sunNotes: "Kveldssol fra vest gir gyllen strand.",
                parking: "Strandparkering.", walkMinutes: 5, restrictions: nil,
                shootingDirectionDeg: 45
            ),
        ]
    )

    // ── Tromsø Langnes (ENTC/TOS) ────────────────────────────────────
    private static let tromso = AirportEntry(
        airport: Airport(
            icao: "ENTC", iata: "TOS", name: "Tromsø Langnes",
            coordinate: CLLocationCoordinate2D(latitude: 69.6833, longitude: 18.9189),
            runways: [
                Runway(
                    id: "18", headingDeg: 182, reciprocal: "36", lengthM: 2447,
                    thresholdA: CLLocationCoordinate2D(latitude: 69.6940, longitude: 18.9150),
                    thresholdB: CLLocationCoordinate2D(latitude: 69.6730, longitude: 18.9220)
                ),
            ]
        ),
        spots: [
            SpottingLocation(
                id: "tos-langnesodden", name: "Langnesodden",
                coordinate: CLLocationCoordinate2D(latitude: 69.6710, longitude: 18.9280),
                description: "Sørenden med fjell og fjord. Vinterlys og nordlys-sesong gir unike bilder.",
                rating: 4.6, bestFor: ["RWY 18 arrivals", "fjell", "vinter", "70–300 mm"],
                focalRange: 70...300, runwayIds: ["18"], arrivals: true, departures: true,
                sunNotes: "Lavt vinterlys hele dagen; midnattssol om sommeren.",
                parking: "Ved veien.", walkMinutes: 8, restrictions: nil,
                shootingDirectionDeg: 0
            ),
        ]
    )
}
