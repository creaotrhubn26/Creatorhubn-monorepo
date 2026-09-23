// ProximityMonitor.swift
//
// Ren logikk for «Du er framme» (SenseAid Explore pakke 1, punkt 1): finner
// severdigheten brukeren har nådd ut fra `triggerRadiusM`, krever to
// påfølgende posisjoner innenfor radiusen før den «armeres» (så et enkelt
// GPS-hopp ikke utløser et varsel), og forlater sonen først når brukeren er
// utenfor `hysteresisFactor` × radiusen (så varselet ikke blinker av og på
// ved kanten). Varsler høyst én gang per sted per appøkt.
//
// Ingen avhengighet til CoreLocation eller UI her, så algoritmen kan
// enhetstestes med syntetiske GPS-spor (se ProximityMonitorTests). Kalleren
// (ArrivalCoordinator) står for haptikk, annonsering og kortet.

import Foundation

struct ProximityMonitor: Sendable {
    /// Antall påfølgende posisjoner innenfor radiusen som kreves før et sted regnes som nådd.
    static let requiredConsecutiveFixes = 2
    /// Sonen forlates først når brukeren er utenfor denne faktoren ganger `triggerRadiusM`.
    static let hysteresisFactor = 1.5

    /// Stedet brukeren for øyeblikket regnes som «ved» (innenfor hysteresesonen).
    private(set) var dockedPoiId: String?
    /// Steder som allerede har utløst et framme-varsel denne appøkten.
    private(set) var arrivedPoiIds: Set<String> = []

    private var pendingCandidateId: String?
    private var pendingConsecutiveCount = 0

    init() {}

    /// Oppdaterer med en ny posisjon. Returnerer id-en til stedet brukeren
    /// nettopp ankom (skal varsles om), eller nil hvis ingenting nytt skjedde.
    /// Kalleren avgjør selv om noe skal vises (f.eks. hoppe over hvis stedet
    /// allerede spilles).
    @discardableResult
    mutating func update(coordinate: Coordinate, pois: [GuidePOI]) -> String? {
        if let dockedPoiId, let poi = pois.first(where: { $0.id == dockedPoiId }) {
            let distanceM = Geo.distanceM(from: coordinate, to: poi.coordinate)
            if distanceM <= Double(poi.triggerRadiusM) * Self.hysteresisFactor {
                // Fortsatt innenfor hysteresesonen: forbli der, ingenting nytt.
                return nil
            }
            self.dockedPoiId = nil
        }

        guard let candidateId = nearestWithinRadius(coordinate: coordinate, pois: pois) else {
            pendingCandidateId = nil
            pendingConsecutiveCount = 0
            return nil
        }

        if candidateId == pendingCandidateId {
            pendingConsecutiveCount += 1
        } else {
            pendingCandidateId = candidateId
            pendingConsecutiveCount = 1
        }

        guard pendingConsecutiveCount >= Self.requiredConsecutiveFixes else { return nil }

        dockedPoiId = candidateId
        pendingCandidateId = nil
        pendingConsecutiveCount = 0

        guard !arrivedPoiIds.contains(candidateId) else { return nil }
        arrivedPoiIds.insert(candidateId)
        return candidateId
    }

    /// Severdigheten hvis triggerRadiusM inneholder posisjonen: høyest
    /// prioritet vinner, deretter nærmest.
    private func nearestWithinRadius(coordinate: Coordinate, pois: [GuidePOI]) -> String? {
        pois
            .compactMap { poi -> (id: String, priority: Int, distanceM: Double)? in
                let distanceM = Geo.distanceM(from: coordinate, to: poi.coordinate)
                guard distanceM <= Double(poi.triggerRadiusM) else { return nil }
                return (poi.id, poi.priority, distanceM)
            }
            .sorted { lhs, rhs in
                if lhs.priority != rhs.priority { return lhs.priority > rhs.priority }
                return lhs.distanceM < rhs.distanceM
            }
            .first?.id
    }
}
