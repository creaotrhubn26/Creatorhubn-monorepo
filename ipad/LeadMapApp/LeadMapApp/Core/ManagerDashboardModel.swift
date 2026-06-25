// ManagerDashboardModel.swift
//
// Modeller for leder-dashboard for sone-ytelse
// (/api/leadgrid/territories/dashboard). snake_case → camelCase via
// .convertFromSnakeCase i APIClient.

import Foundation
import CoreLocation

struct SellerBreaches: Decodable, Sendable {
    let leadAccess: Int
    let gps: Int
    let visit: Int
    let total: Int
}

struct SellerVisitStats: Decodable, Sendable {
    let total: Int
    let inGrid: Int
    let outOfGrid: Int
}

struct SellerLeadStats: Decodable, Sendable {
    let total: Int
    let inGrid: Int
    let outOfGrid: Int
}

struct SellerLive: Decodable, Sendable {
    let lat: Double
    let lng: Double
    let currentlyOutOfGrid: Bool

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

struct SellerStats: Identifiable, Decodable, Sendable {
    let userId: String
    let displayName: String?
    let role: String?
    let teamName: String?
    let hasGrid: Bool
    let breaches: SellerBreaches
    let visits: SellerVisitStats
    let leads: SellerLeadStats
    let live: SellerLive?
    var id: String { userId }
}

struct TerritoryDashboardResponse: Decodable, Sendable {
    let period: String
    let sellers: [SellerStats]
}
