// WalkingRouteService.swift
//
// Liten @MainActor-hjelper rundt MKDirections (gangrute til valgt sted på
// kartet). Svaret gjøres om til Sendable-verdier (WalkingRoute) før det
// lagres, så ingen MapKit-objekter lever videre i SwiftUI-tilstanden.
// Throttlingen er ren logikk i WalkingRoute.swift: nytt kall bare når valgt
// sted endres eller posisjonen har flyttet seg mer enn 50 m. Feiler kallet
// (ingen rute, nett, Apples egen throttling) blir `route` stående som den
// var, og kartet faller tilbake til luftlinje (MapRouteLine.resolve).

import CoreLocation
import MapKit
import Observation

@MainActor
@Observable
final class WalkingRouteService {
    /// Siste vellykkede gangrute; nil når ingen er beregnet for valgt sted.
    private(set) var route: WalkingRoute?

    @ObservationIgnored private var lastRequest: WalkingRouteRequestKey?
    @ObservationIgnored private var task: Task<Void, Never>?

    init() {}

    /// Kalles når valgt sted eller posisjonen endrer seg.
    func update(poi: GuidePOI?, origin: Coordinate?) {
        guard let poi, let origin else {
            clear()
            return
        }
        let key = WalkingRouteRequestKey(poiId: poi.id, origin: origin)
        guard WalkingRouteThrottle.shouldRequest(previous: lastRequest, next: key) else { return }
        lastRequest = key
        if route?.poiId != poi.id { route = nil }
        task?.cancel()
        let destination = poi.coordinate
        task = Task { [weak self] in
            let result = await Self.calculate(from: origin, to: destination, poiId: key.poiId)
            guard !Task.isCancelled else { return }
            self?.apply(result, for: key)
        }
    }

    func clear() {
        task?.cancel()
        task = nil
        lastRequest = nil
        route = nil
    }

    private func apply(_ result: WalkingRoute?, for key: WalkingRouteRequestKey) {
        // Et eldre svar som kommer etter et nyere kall, forkastes.
        guard key == lastRequest, let result else { return }
        route = result
    }

    // nonisolated: MKDirections og svaret er ikke Sendable, så hele kallet
    // holdes utenfor MainActor, og bare den Sendable WalkingRoute krysser over.
    private nonisolated static func calculate(from origin: Coordinate, to destination: Coordinate, poiId: String) async -> WalkingRoute? {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: origin.clCoordinate))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination.clCoordinate))
        request.transportType = .walking
        request.requestsAlternateRoutes = false
        let directions = MKDirections(request: request)
        do {
            let response = try await directions.calculate()
            guard let route = response.routes.first else { return nil }
            return WalkingRoute(
                poiId: poiId,
                coordinates: coordinates(of: route.polyline),
                expectedTravelTimeS: route.expectedTravelTime,
                distanceM: route.distance
            )
        } catch {
            return nil
        }
    }

    private nonisolated static func coordinates(of polyline: MKPolyline) -> [Coordinate] {
        let count = polyline.pointCount
        guard count > 0 else { return [] }
        var buffer = [CLLocationCoordinate2D](repeating: kCLLocationCoordinate2DInvalid, count: count)
        polyline.getCoordinates(&buffer, range: NSRange(location: 0, length: count))
        return buffer.map { Coordinate(lat: $0.latitude, lng: $0.longitude) }
    }
}
