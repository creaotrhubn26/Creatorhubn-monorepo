// TerritoryModel.swift
//
// Selger-grid (territorium). En grid kan være en kombinasjon av polygon
// (GeoJSON), administrative enheter (kommune/postnummer) og/eller en sirkel
// (senter + radius). På iPad gjør vi on-device geofence-sjekk mot polygon +
// sirkel (admin-enheter sjekkes server-side siden de krever lead-metadata).
//
// Gjenbruker AnnotationGeometry-dekoderen for GeoJSON. JSON-nøkler er
// snake_case; APIClient-decoderen bruker .convertFromSnakeCase.

import Foundation
import CoreLocation

struct Territory: Identifiable, Decodable, Sendable {
    let id: String
    let name: String
    let geometry: AnnotationGeometry?
    let municipalities: [String]?
    let postalCodes: [String]?
    let centerLat: Double?
    let centerLng: Double?
    let radiusM: Int?
    let assignedUserId: String?
    let priority: Int?
    let active: Bool?

    /// Ytre ring av polygonet (tom hvis ingen polygon).
    var polygonCoordinates: [CLLocationCoordinate2D] { geometry?.clCoordinates ?? [] }

    var hasPolygon: Bool { polygonCoordinates.count >= 3 }

    var center: CLLocationCoordinate2D? {
        guard let lat = centerLat, let lng = centerLng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    var hasCircle: Bool { center != nil && (radiusM ?? 0) > 0 }
}

struct TerritoriesResponse: Decodable, Sendable {
    let territories: [Territory]
}

struct CreateTerritoryResponse: Decodable, Sendable {
    let id: String
}

// MARK: - On-device geofence-matte

enum TerritoryGeo {
    /// Ray-casting point-in-polygon (samme algoritme som backend). Ringen
    /// er CLLocationCoordinate2D (lat,lng); vi regner i lng/lat-planet.
    static func pointInRing(_ p: CLLocationCoordinate2D, ring: [CLLocationCoordinate2D]) -> Bool {
        guard ring.count >= 3 else { return false }
        var inside = false
        var j = ring.count - 1
        for i in 0..<ring.count {
            let xi = ring[i].longitude, yi = ring[i].latitude
            let xj = ring[j].longitude, yj = ring[j].latitude
            let denom = (yj - yi) == 0 ? Double.leastNonzeroMagnitude : (yj - yi)
            let intersects = (yi > p.latitude) != (yj > p.latitude) &&
                (p.longitude < (xj - xi) * (p.latitude - yi) / denom + xi)
            if intersects { inside.toggle() }
            j = i
        }
        return inside
    }

    /// Er koordinaten innenfor territoriet (polygon ELLER sirkel)?
    static func isInside(_ coord: CLLocationCoordinate2D, territory t: Territory) -> Bool {
        if t.hasPolygon, pointInRing(coord, ring: t.polygonCoordinates) { return true }
        if let c = t.center, let r = t.radiusM {
            let here = CLLocation(latitude: coord.latitude, longitude: coord.longitude)
            let centre = CLLocation(latitude: c.latitude, longitude: c.longitude)
            if here.distance(from: centre) <= Double(r) { return true }
        }
        return false
    }

    static func isInsideAny(_ coord: CLLocationCoordinate2D, territories: [Territory]) -> Bool {
        territories.contains { isInside(coord, territory: $0) }
    }
}
