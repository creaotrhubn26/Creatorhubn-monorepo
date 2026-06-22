// CoverageModel.swift
//
// Modeller for territorie-dekning (/api/leadgrid/territories/coverage).
// snake_case → camelCase via .convertFromSnakeCase i APIClient.

import Foundation
import CoreLocation

struct CoveragePerTerritory: Identifiable, Decodable, Sendable {
    let territoryId: String
    let name: String
    let assignedUserId: String?
    let leadCount: Int
    var id: String { territoryId }
}

struct CoverageOrphan: Identifiable, Decodable, Sendable {
    let id: String
    let name: String?
    let latitude: Double?
    let longitude: Double?

    var coordinate: CLLocationCoordinate2D? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

struct CoverageResult: Decodable, Sendable {
    let total: Int
    let covered: Int
    let orphans: Int
    let overlapping: Int
    let coveragePct: Double
    let perTerritory: [CoveragePerTerritory]
    let orphanLeads: [CoverageOrphan]
}

struct CoverageResponse: Decodable, Sendable {
    let coverage: CoverageResult?
}
