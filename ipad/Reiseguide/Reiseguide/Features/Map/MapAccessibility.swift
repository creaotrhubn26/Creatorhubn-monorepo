// MapAccessibility.swift
//
// Ren logikk for kartets markører og VoiceOver:
//   - MapTourMarkers: besøkt (fullført i besøksloggen, samme som
//     turfremdriften) og «neste stopp» (VeiviserTarget.resolve(.nextStop),
//     samme mål som veiviseren peker mot).
//   - MapViewMode: kart eller liste; uten lagret valg vises listen når
//     VoiceOver kjører (UU-krav 8.5).
//   - MapAccessibilitySummary: oppsummeringen VoiceOver leser for kartet,
//     «3 steder innen 500 m. Nærmeste: Christiania torv, 120 m nordøst.»
// Strengoppslag sendes inn som closure, så tekstene kan testes uten bundle.

import Foundation

struct MapMarkerStatus: Sendable, Equatable {
    let isVisited: Bool
    let isNextStop: Bool

    /// «Christiania torv, 120 m, neste stopp».
    func accessibilityLabel(title: String, distanceText: String?, localize: (String) -> String) -> String {
        var parts = [title]
        if let distanceText { parts.append(distanceText) }
        if isVisited { parts.append(localize("map.marker.visited")) }
        if isNextStop { parts.append(localize("map.marker.nextStop")) }
        return parts.joined(separator: ", ")
    }
}

struct MapTourMarkers: Sendable, Equatable {
    let completedIds: Set<String>
    let nextStopId: String?

    /// `excludingId` er stedet som spilles nå, som i veiviseren.
    init(pois: [GuidePOI], completedIds: Set<String>, visitedIds: Set<String>, excludingId: String? = nil) {
        self.completedIds = completedIds
        nextStopId = VeiviserTarget.resolve(.nextStop, pois: pois, visitedIds: visitedIds, excludingId: excludingId)?.id
    }

    func status(for poiId: String) -> MapMarkerStatus {
        MapMarkerStatus(isVisited: completedIds.contains(poiId), isNextStop: poiId == nextStopId)
    }
}

enum MapViewMode {
    /// Brukerens lagrede valg vinner; uten valg er listen standard med VoiceOver.
    static func showsList(storedChoice: Bool?, voiceOverRunning: Bool) -> Bool {
        storedChoice ?? voiceOverRunning
    }
}

struct MapAccessibilitySummary: Sendable, Equatable {
    struct Nearest: Sendable, Equatable {
        let title: String
        let distanceM: Double
        /// Nøkkel i Localizable.xcstrings (`veiviser.compass.*`).
        let compassWordKey: String
    }

    static let defaultRadiusM: Double = 500

    let totalCount: Int
    let radiusM: Double
    /// Nil uten posisjon.
    let countWithinRadius: Int?
    let nearest: Nearest?

    static func make(pois: [GuidePOI], origin: Coordinate?, radiusM: Double = defaultRadiusM) -> MapAccessibilitySummary {
        guard let origin else {
            return MapAccessibilitySummary(totalCount: pois.count, radiusM: radiusM, countWithinRadius: nil, nearest: nil)
        }
        let sorted = Geo.sortedByDistance(pois, from: origin)
        let within = sorted.filter { ($0.distanceM ?? .infinity) <= radiusM }.count
        let nearest = sorted.first.map { item in
            Nearest(
                title: item.poi.title,
                distanceM: item.distanceM ?? 0,
                compassWordKey: CompassDirection.compassWordKey(bearingDegrees: Geo.bearingDegrees(from: origin, to: item.poi.coordinate))
            )
        }
        return MapAccessibilitySummary(totalCount: pois.count, radiusM: radiusM, countWithinRadius: within, nearest: nearest)
    }

    func text(localize: (String) -> String, formatDistance: (Double) -> String) -> String {
        guard let countWithinRadius else {
            return localize("map.summary.noLocation").replacingOccurrences(of: "%@", with: "\(totalCount)")
        }
        let radius = formatDistance(radiusM)
        var text: String
        switch countWithinRadius {
        case 0:
            text = localize("map.summary.none").replacingOccurrences(of: "%@", with: radius)
        case 1:
            text = localize("map.summary.one").replacingOccurrences(of: "%@", with: radius)
        default:
            text = localize("map.summary.many")
                .replacingOccurrences(of: "%1$@", with: "\(countWithinRadius)")
                .replacingOccurrences(of: "%2$@", with: radius)
        }
        if let nearest {
            let direction = localize(nearest.compassWordKey).lowercased()
            text += " " + localize("map.summary.nearest")
                .replacingOccurrences(of: "%1$@", with: nearest.title)
                .replacingOccurrences(of: "%2$@", with: formatDistance(nearest.distanceM))
                .replacingOccurrences(of: "%3$@", with: direction)
        }
        return text
    }
}
