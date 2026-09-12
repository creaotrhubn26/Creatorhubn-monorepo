// RouteModel.swift
//
// Modeller for "Smart dagsrute" (/api/leadgrid/routes/plan). JSON er
// snake_case; APIClient-decoderen bruker .convertFromSnakeCase.

import Foundation
import CoreLocation

struct DayRouteStop: Identifiable, Decodable, Sendable {
    let position: Int
    let leadId: String
    let name: String?
    let latitude: Double?
    let longitude: Double?
    let driveSecondsFromPrevious: Int
    var id: String { leadId }

    var coordinate: CLLocationCoordinate2D? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

struct DayRoute: Decodable, Sendable {
    let id: String
    let name: String
    let totalDistanceMeters: Int
    let totalDriveSeconds: Int
    let expectedRouteValue: Double
    let matrixSource: String
    let stops: [DayRouteStop]
}

struct DayRoutePlanResponse: Decodable, Sendable {
    let route: DayRoute?
    let message: String?
}

enum RouteMapLink {
    /// Apple Maps multi-stopp URL (native). Start = origin, stoppene i rekkefølge.
    static func appleMaps(stops: [DayRouteStop], origin: CLLocationCoordinate2D?) -> URL? {
        let pts = stops.compactMap { $0.coordinate }
        guard !pts.isEmpty else { return nil }
        var comps = URLComponents(string: "https://maps.apple.com/")
        var items: [URLQueryItem] = [URLQueryItem(name: "dirflg", value: "d")]
        if let o = origin {
            items.append(URLQueryItem(name: "saddr", value: "\(o.latitude),\(o.longitude)"))
        }
        // Apple Maps tar én destinasjon; vi peker på siste stopp. (Mellomstopp
        // vises i app-ens egen liste.)
        if let dest = pts.last {
            items.append(URLQueryItem(name: "daddr", value: "\(dest.latitude),\(dest.longitude)"))
        }
        comps?.queryItems = items
        return comps?.url
    }
}
