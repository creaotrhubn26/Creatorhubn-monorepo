// LeadgridRouteModels.swift
//
// Modeller for Route Planner UI (/api/leadgrid/routes/*). Backend i PR #856 +
// #870 leverer plan-respons + detalj + stopp-oppdatering. JSON er snake_case;
// APIClient-decoderen bruker .convertFromSnakeCase, så Swift-properties er
// camelCase.

import Foundation

struct LeadgridRoute: Codable, Hashable, Sendable {
    let id: String
    let name: String?
    let plannedDate: String?
    let status: String?  // 'draft' | 'active' | 'completed' | 'cancelled'
    let startLat: Double?
    let startLng: Double?
    let totalDistanceMeters: Int?
    let totalDriveSeconds: Int?
    let expectedRouteValue: Double?
    let matrixSource: String?  // 'google' | 'estimate'
}

struct LeadgridRouteStop: Codable, Hashable, Identifiable, Sendable {
    /// Backend-generert stopp-ID (UUID fra route_stops-tabellen). Optional fordi
    /// /plan-respons KAN være tom for stop-IDs i fremtidige varianter.
    let stopId: String?
    let position: Int
    let leadId: String?
    let name: String?
    let latitude: Double?
    let longitude: Double?
    let status: String?
    let outcome: String?
    let notes: String?
    let distanceFromPreviousMeters: Int?
    let driveSecondsFromPrevious: Int?
    let arrivedAt: String?
    let completedAt: String?

    /// Stabil Identifiable.id (ForEach + .sheet(item:)) — bruker stopId hvis
    /// satt, ellers position+leadId så hver rad fortsatt er unik i listen.
    var id: String { stopId ?? "\(position)-\(leadId ?? "n/a")" }

    // NB: CodingKeys overstyrer .convertFromSnakeCase, så snake_case må mappes
    // eksplisitt her.
    private enum CodingKeys: String, CodingKey {
        case stopId = "id"
        case position
        case leadId = "lead_id"
        case name
        case latitude
        case longitude
        case status
        case outcome
        case notes
        case distanceFromPreviousMeters = "distance_from_previous_meters"
        case driveSecondsFromPrevious = "drive_seconds_from_previous"
        case arrivedAt = "arrived_at"
        case completedAt = "completed_at"
    }
}

struct LeadgridRoutePlanResponse: Codable, Sendable {
    let route: LeadgridRouteDetail?
    let message: String?
}

struct LeadgridRouteDetail: Codable, Sendable {
    let id: String
    let name: String?
    let totalDistanceMeters: Int?
    let totalDriveSeconds: Int?
    let expectedRouteValue: Double?
    let matrixSource: String?
    let stops: [LeadgridRouteStop]
}

struct LeadgridRouteFullResponse: Codable, Sendable {
    let route: LeadgridRoute
    let stops: [LeadgridRouteStop]
}
