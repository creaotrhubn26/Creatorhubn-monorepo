// WalkingETA.swift
//
// Gangtid til severdigheter i kartlisten og på markørene (pakke 2, item 4):
// et avstandsbasert estimat med én gang (Geo.distanceM × antatt gangfart),
// erstattet av et nøyaktig MKDirections-svar når batchen i
// Features/Map/WalkingETABatch.swift har rukket å hente det for de nærmeste
// stedene. Ren logikk her — ingen MapKit — så alt kan enhetstestes.
// Strengoppslag sendes inn som closures (samme mønster som
// Features/Map/MapAccessibility.swift), så tekstene kan testes uten bundle.

import Foundation

/// Gangtid til ett sted.
struct WalkingETA: Sendable, Equatable {
    let minutes: Int
    /// Sann når tallet er luftlinje × antatt gangfart, ikke et ekte
    /// MKDirections-svar — VoiceOver og listen skal si fra om dette.
    let isEstimate: Bool
}

enum WalkingETAEstimate {
    /// Antatt gangfart i m/s, litt under normal gangfart (~1,4 m/s) så
    /// estimatet ikke er optimistisk (bakker, lyskryss, brostein).
    static let assumedSpeedMPerS: Double = 1.3

    /// Avstandsbasert fallback: brukes til svaret fra MKDirections kommer,
    /// eller når det aldri kommer (ingen nett, ingen rute, Apples throttling).
    static func minutes(distanceM: Double) -> Int {
        WalkingRoute.wholeMinutes(seconds: distanceM / assumedSpeedMPerS)
    }
}

/// Nøkkelen en gangtid caches under: sted og origo avrundet til nærmeste
/// `bucketSizeM`, så små bevegelser (under samme terskel som
/// WalkingRouteThrottle bruker for valgt-sted-ruta) gjenbruker samme svar.
struct WalkingETACacheKey: Sendable, Equatable, Hashable {
    let poiId: String
    let originLatBucket: Int
    let originLngBucket: Int

    init(poiId: String, origin: Coordinate, bucketSizeM: Double = WalkingRouteThrottle.minimumMoveM) {
        self.poiId = poiId
        let metersPerDegreeLat = 111_320.0
        // Lengdegrad-meter krymper mot polene; origo er alltid innenfor
        // rimelige breddegrader for appens områder, men clamp for sikkerhets skyld.
        let metersPerDegreeLng = 111_320.0 * max(cos(origin.lat * .pi / 180), 0.01)
        originLatBucket = Int((origin.lat * metersPerDegreeLat / bucketSizeM).rounded())
        originLngBucket = Int((origin.lng * metersPerDegreeLng / bucketSizeM).rounded())
    }
}

enum WalkingETASelection {
    /// De nærmeste `limit` stedene som mangler et cachet svar for denne
    /// origo-bucketen. Batchen henter bare disse, ikke hele den filtrerte
    /// listen — MKDirections skal ikke spørres for steder langt unna eller
    /// utenfor skjermen.
    static func poisNeedingRequest(
        sortedByDistance: [(poi: GuidePOI, distanceM: Double?)],
        origin: Coordinate,
        cachedKeys: Set<WalkingETACacheKey>,
        limit: Int = 8
    ) -> [GuidePOI] {
        var result: [GuidePOI] = []
        for item in sortedByDistance {
            guard result.count < limit else { break }
            let key = WalkingETACacheKey(poiId: item.poi.id, origin: origin)
            guard !cachedKeys.contains(key) else { continue }
            result.append(item.poi)
        }
        return result
    }
}

/// Tekstene listen/kartet viser og sier, med og uten «estimat» (map.eta.*
/// nøkler i Localizable.xcstrings). `localize` og `formatMinutes` sendes inn
/// slik at teksten kan enhetstestes uten en bundle (samme mønster som
/// MapAccessibilitySummary.text(localize:formatDistance:)).
enum WalkingETAText {
    /// Kort tekst til visning: «6 min å gå» eller «6 min å gå (anslag)».
    static func visible(_ eta: WalkingETA, localize: (String) -> String, formatMinutes: (Int) -> String) -> String {
        let key = eta.isEstimate ? "map.eta.walkingEstimate" : "map.eta.walking"
        return localize(key).replacingOccurrences(of: "%@", with: formatMinutes(eta.minutes))
    }

    /// VoiceOver-tekst: «6 minutter å gå» eller «cirka 6 minutter å gå, anslag».
    static func spoken(_ eta: WalkingETA, localize: (String) -> String, formatMinutesSpoken: (Int) -> String) -> String {
        let key = eta.isEstimate ? "map.eta.walkingEstimateSpoken" : "map.eta.walkingSpoken"
        return localize(key).replacingOccurrences(of: "%@", with: formatMinutesSpoken(eta.minutes))
    }
}
