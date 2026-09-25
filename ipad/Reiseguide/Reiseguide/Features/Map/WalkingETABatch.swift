// WalkingETABatch.swift
//
// Henter ekte gangtid (pakke 2, item 4) for de nærmeste stedene med
// MKDirections.calculateETA, begrenset til `maxConcurrent` samtidige kall og
// en in-memory-cache (WalkingETACacheKey) så samme sted+origo ikke spørres om
// på nytt. Feiler et kall, eller til svaret kommer, faller
// WalkingETA.eta(for:distanceM:) tilbake til avstandsestimatet
// (WalkingETAEstimate) — kartet og listen merker det tydelig som «anslag».
//
// nonisolated: selve MKDirections-kallet (og responsen) holdes utenfor
// MainActor og krysser bare over som Sendable-verdier, som WalkingRouteService.

import CoreLocation
import MapKit
import Observation

@MainActor
@Observable
final class WalkingETABatch {
    /// Maks samtidige MKDirections-kall (Risiko i planen: unngå
    /// throttling-storm ved raske område-/filterbytter).
    private static let maxConcurrent = 3

    /// Ekte gangtid per sted-id; mangler mens den ventes på eller ikke er spurt om ennå.
    private(set) var etas: [String: WalkingETA] = [:]

    @ObservationIgnored private var cache: [WalkingETACacheKey: WalkingETA] = [:]
    @ObservationIgnored private var inFlight: Set<WalkingETACacheKey> = []
    @ObservationIgnored private var task: Task<Void, Never>?

    init() {}

    /// Gangtid til `poi`: ekte hvis den er hentet, ellers
    /// avstandsestimatet. Nil uten avstand (ingen posisjon ennå).
    func eta(for poi: GuidePOI, distanceM: Double?) -> WalkingETA? {
        if let real = etas[poi.id] { return real }
        guard let distanceM else { return nil }
        return WalkingETA(minutes: WalkingETAEstimate.minutes(distanceM: distanceM), isEstimate: true)
    }

    /// Kalles når den avstandssorterte listen eller posisjonen endrer seg:
    /// ber om ekte gangtid for de nærmeste stedene som mangler et cachet
    /// svar for denne origo-bucketen.
    func update(sortedByDistance: [(poi: GuidePOI, distanceM: Double?)], origin: Coordinate?) {
        task?.cancel()
        guard let origin else { return }
        let candidates = WalkingETASelection.poisNeedingRequest(
            sortedByDistance: sortedByDistance,
            origin: origin,
            cachedKeys: Set(cache.keys)
        )
        guard !candidates.isEmpty else { return }
        task = Task { [weak self] in
            await self?.requestBatch(candidates, origin: origin)
        }
    }

    /// Nytt område/filter uten overlappende steder: gamle svar er ikke feil,
    /// men er ikke lenger nyttige å holde på — enkel rydding, ikke påkrevd
    /// for korrekthet (cache er nøkkel-adressert per sted+origo uansett).
    func clear() {
        task?.cancel()
        task = nil
        etas = [:]
        cache = [:]
        inFlight = []
    }

    private func requestBatch(_ pois: [GuidePOI], origin: Coordinate) async {
        let requests = pois.map { poi in
            ETARequest(poiId: poi.id, coordinate: poi.coordinate, key: WalkingETACacheKey(poiId: poi.id, origin: origin))
        }
        for request in requests { inFlight.insert(request.key) }

        let results = await withTaskGroup(of: ETAResult.self, returning: [ETAResult].self) { group in
            var iterator = requests.makeIterator()
            var collected: [ETAResult] = []
            for _ in 0 ..< Self.maxConcurrent {
                guard let next = iterator.next() else { break }
                group.addTask {
                    let minutes = await Self.calculateMinutes(from: origin, to: next.coordinate)
                    return ETAResult(poiId: next.poiId, key: next.key, minutes: minutes)
                }
            }
            while let result = await group.next() {
                collected.append(result)
                guard let next = iterator.next() else { continue }
                group.addTask {
                    let minutes = await Self.calculateMinutes(from: origin, to: next.coordinate)
                    return ETAResult(poiId: next.poiId, key: next.key, minutes: minutes)
                }
            }
            return collected
        }

        for request in requests { inFlight.remove(request.key) }
        guard !Task.isCancelled else { return }
        for result in results {
            guard let minutes = result.minutes else { continue }
            let eta = WalkingETA(minutes: minutes, isEstimate: false)
            cache[result.key] = eta
            etas[result.poiId] = eta
        }
    }

    /// Ett kall som skal gjøres — en liten Sendable-struct i stedet for en
    /// tuppel (SwiftLint: `large_tuple` tillater bare 2 medlemmer).
    private struct ETARequest: Sendable {
        let poiId: String
        let coordinate: Coordinate
        let key: WalkingETACacheKey
    }

    private struct ETAResult: Sendable {
        let poiId: String
        let key: WalkingETACacheKey
        let minutes: Int?
    }

    nonisolated private static func calculateMinutes(from origin: Coordinate, to destination: Coordinate) async -> Int? {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: origin.clCoordinate))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination.clCoordinate))
        request.transportType = .walking
        let directions = MKDirections(request: request)
        do {
            let response = try await directions.calculateETA()
            return WalkingRoute.wholeMinutes(seconds: response.expectedTravelTime)
        } catch {
            return nil
        }
    }
}
