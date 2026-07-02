// RouteModels.swift
//
// Codable DTO-er for /api/leadgrid/routes/* — MeMapPin tap-actions +
// route-adherence-dashboard (pakke 2026-07-02).
//
// Backend-skjema: backend/migrations/0358_leadgrid_routes_adherence.sql
// Endpoints:      backend/server/routes-adherence-routes.ts
//
// Alle timestamp-felter holdes som `String?` (matcher salgsledelse-
// mønster) siden PG `::text`-cast av TIMESTAMPTZ ikke lar seg parse
// direkte av ISO8601DateFormatter. Views formaterer via LeadgridDate.

import Foundation
import CoreLocation

// ============================================================
// MARK: - Position sample (iPad → backend batch)
// ============================================================

/// Én position-sample som klienten batcher opp og flusher hvert 30s
/// (eller ved 30 samples). `sampledAt` er CLLocation.timestamp — brukes
/// til idempotent dedup på backend (unique-index).
struct PositionSampleDTO: Codable, Hashable, Sendable {
    let lat: Double
    let lon: Double
    let speed: Double?
    let heading: Double?
    /// ISO8601-streng (klienten koder via ISO8601DateFormatter m/
    /// .withFractionalSeconds).
    let sampledAt: String

    init(coordinate: CLLocationCoordinate2D, speed: Double?, heading: Double?, at date: Date) {
        self.lat = coordinate.latitude
        self.lon = coordinate.longitude
        self.speed = speed
        self.heading = heading
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        self.sampledAt = f.string(from: date)
    }
}

/// Envelope: `{ samples: [...] }`.
struct PositionSamplesBatchPayload: Encodable, Sendable {
    let samples: [PositionSampleDTO]
}

/// Response: `{ inserted: N }`.
struct PositionSamplesBatchResponse: Decodable, Sendable {
    let inserted: Int
}

// ============================================================
// MARK: - Route assignment + stops + visits
// ============================================================

/// Én stopp i planlagt rute. `plannedArrivalTime` er HH:MM (klient-tolket
/// med route_date som base).
struct RouteStopDTO: Codable, Hashable, Identifiable, Sendable {
    let leadId: String
    let latitude: Double
    let longitude: Double
    let orderIndex: Int
    let plannedArrivalTime: String?
    let plannedDurationMin: Int?
    let notes: String?

    var id: String { leadId }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    enum CodingKeys: String, CodingKey {
        case leadId = "lead_id"
        case latitude
        case longitude
        case orderIndex = "order_index"
        case plannedArrivalTime = "planned_arrival_time"
        case plannedDurationMin = "planned_duration_min"
        case notes
    }
}

/// Planlagt daglig rute — hentes via `/my-route`.
struct RouteAssignmentDTO: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let orgId: UUID?
    let userId: String
    let routeDate: String   // YYYY-MM-DD
    let name: String
    let stops: [RouteStopDTO]
    let totalStops: Int
    let status: String      // planned / active / completed / skipped
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case orgId = "org_id"
        case userId = "user_id"
        case routeDate = "route_date"
        case name
        case stops
        case totalStops = "total_stops"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Faktisk besøk-log per stopp. `wasOnRoute = deviationFromPlannedM < 200`.
struct RouteVisitDTO: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let stopLeadId: String
    let arrivedAt: String?
    let leftAt: String?
    let actualLatitude: Double?
    let actualLongitude: Double?
    let deviationFromPlannedM: Int?
    let wasOnRoute: Bool
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id
        case stopLeadId = "stop_lead_id"
        case arrivedAt = "arrived_at"
        case leftAt = "left_at"
        case actualLatitude = "actual_latitude"
        case actualLongitude = "actual_longitude"
        case deviationFromPlannedM = "deviation_from_planned_m"
        case wasOnRoute = "was_on_route"
        case notes
    }
}

/// Progressstats for dagens rute.
struct RouteProgressDTO: Codable, Hashable, Sendable {
    let completed: Int
    let remaining: Int
    let onRoutePct: Int
    let avgDeviationM: Int

    enum CodingKeys: String, CodingKey {
        case completed
        case remaining
        case onRoutePct = "on_route_pct"
        case avgDeviationM = "avg_deviation_m"
    }
}

/// Full response fra `/my-route`.
struct MyRouteResponse: Decodable, Sendable {
    let assignment: RouteAssignmentDTO?
    let visits: [RouteVisitDTO]
    let progress: RouteProgressDTO
    let nextStop: RouteStopDTO?
    let etaNextMin: Int?

    enum CodingKeys: String, CodingKey {
        case assignment
        case visits
        case progress
        case nextStop = "next_stop"
        case etaNextMin = "eta_next_min"
    }
}

// ============================================================
// MARK: - Team-nearby
// ============================================================

/// Ett team-medlem i nærheten m/ siste kjent posisjon.
struct NearbyTeamMemberDTO: Codable, Hashable, Identifiable, Sendable {
    let userId: String
    let name: String
    let email: String?
    let role: String?
    let latitude: Double
    let longitude: Double
    let distanceM: Int
    let lastSeenAt: String?
    let status: String     // moving / idle
    let speedMps: Double?

    var id: String { userId }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case name
        case email
        case role
        case latitude
        case longitude
        case distanceM = "distance_m"
        case lastSeenAt = "last_seen_at"
        case status
        case speedMps = "speed_mps"
    }
}

struct NearbyTeamResponse: Decodable, Sendable {
    let members: [NearbyTeamMemberDTO]
}

// ============================================================
// MARK: - Adherence report
// ============================================================

/// Én daglig row i adherence-rapporten.
struct AdherenceDailyRow: Codable, Hashable, Identifiable, Sendable {
    let assignmentId: UUID
    let routeDate: String
    let name: String
    let totalStops: Int
    let completedStops: Int
    let avgDeviationM: Int
    let onRoutePct: Int
    let avgTimeAtStopMin: Int

    var id: UUID { assignmentId }

    enum CodingKeys: String, CodingKey {
        case assignmentId = "assignment_id"
        case routeDate = "route_date"
        case name
        case totalStops = "total_stops"
        case completedStops = "completed_stops"
        case avgDeviationM = "avg_deviation_m"
        case onRoutePct = "on_route_pct"
        case avgTimeAtStopMin = "avg_time_at_stop_min"
    }
}

/// Summary aggregat over hele perioden.
struct AdherenceSummary: Codable, Hashable, Sendable {
    let avgOnRoutePct: Int
    let avgDeviationM: Int
    let completedStopsPct: Int

    enum CodingKeys: String, CodingKey {
        case avgOnRoutePct = "avg_on_route_pct"
        case avgDeviationM = "avg_deviation_m"
        case completedStopsPct = "completed_stops_pct"
    }
}

/// Full rapport-svar (`/adherence-report`).
struct RouteAdherenceReportDTO: Decodable, Sendable {
    let userId: String
    let from: String
    let to: String
    let days: Int
    let summary: AdherenceSummary
    let daily: [AdherenceDailyRow]

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case from
        case to
        case days
        case summary
        case daily
    }
}

/// Én rad i team-summary — én bruker per rad.
struct TeamAdherenceMemberRow: Codable, Hashable, Identifiable, Sendable {
    let userId: String
    let name: String?
    let email: String?
    let role: String?
    let assignments: Int
    let totalStops: Int
    let completedStops: Int
    let avgDeviationM: Int
    let onRoutePct: Int

    var id: String { userId }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case name
        case email
        case role
        case assignments
        case totalStops = "total_stops"
        case completedStops = "completed_stops"
        case avgDeviationM = "avg_deviation_m"
        case onRoutePct = "on_route_pct"
    }
}

struct TeamAdherenceSummary: Codable, Hashable, Sendable {
    let memberCount: Int
    let avgOnRoutePct: Int
    let avgDeviationM: Int
    let completedStopsPct: Int

    enum CodingKeys: String, CodingKey {
        case memberCount = "member_count"
        case avgOnRoutePct = "avg_on_route_pct"
        case avgDeviationM = "avg_deviation_m"
        case completedStopsPct = "completed_stops_pct"
    }
}

struct TeamAdherenceReportDTO: Decodable, Sendable {
    let date: String
    let members: [TeamAdherenceMemberRow]
    let summary: TeamAdherenceSummary
}

// ============================================================
// MARK: - Create-lead-at-position response
// ============================================================

/// Svar fra POST /leads/at-position — nytt lead prefilled fra Places.
/// Alle felter untatt `leadId` er optional så decode ikke krasjer hvis
/// backend endrer form eller Places-oppslag returnerer null-felter.
/// Fant 2026-07-02: «The data couldn't be read because it is missing»
/// oppsto når `name` var null i JSON-svaret (Places-fallback).
struct CreatedLeadAtPositionDTO: Decodable, Sendable, Identifiable, Hashable {
    let leadId: String
    let name: String?
    let address: String?
    let googlePlaceId: String?
    let latitude: Double?
    let longitude: Double?
    let orgId: String?

    var id: String { leadId }

    /// Trygg visning — bruker navn hvis vi har det, ellers koordinat-fallback.
    var displayName: String {
        if let n = name, !n.isEmpty { return n }
        if let lat = latitude, let lon = longitude {
            return String(format: "Nytt lead (%.4f, %.4f)", lat, lon)
        }
        return "Nytt lead"
    }

    enum CodingKeys: String, CodingKey {
        case leadId = "lead_id"
        case name
        case address
        case googlePlaceId = "google_place_id"
        case latitude
        case longitude
        case orgId = "org_id"
    }
}

/// Wrapper for CLLocationCoordinate2D som er Identifiable for sheet(item:).
struct MePinCoordWrapper: Identifiable, Hashable, Sendable {
    let id = UUID()
    let latitude: Double
    let longitude: Double

    init(coordinate: CLLocationCoordinate2D) {
        self.latitude = coordinate.latitude
        self.longitude = coordinate.longitude
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

// ============================================================
// MARK: - Create-assignment payload (salgssjef+)
// ============================================================

struct CreateRouteStopPayload: Encodable, Hashable, Sendable {
    let leadId: String
    let latitude: Double
    let longitude: Double
    let orderIndex: Int
    let plannedArrivalTime: String?
    let plannedDurationMin: Int?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case leadId = "lead_id"
        case latitude
        case longitude
        case orderIndex = "order_index"
        case plannedArrivalTime = "planned_arrival_time"
        case plannedDurationMin = "planned_duration_min"
        case notes
    }
}

struct CreateRouteAssignmentPayload: Encodable, Sendable {
    let userId: String
    let routeDate: String
    let name: String
    let stops: [CreateRouteStopPayload]

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case routeDate = "route_date"
        case name
        case stops
    }
}

struct UpdateRouteAssignmentPayload: Encodable, Sendable {
    let status: String?
    let name: String?
    let stops: [CreateRouteStopPayload]?
}

struct LogRouteVisitPayload: Encodable, Sendable {
    let stopLeadId: String
    let actualLat: Double
    let actualLon: Double
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case stopLeadId = "stop_lead_id"
        case actualLat = "actual_lat"
        case actualLon = "actual_lon"
        case notes
    }
}

struct CreateLeadAtPositionPayload: Encodable, Sendable {
    let lat: Double
    let lon: Double
    let orgId: String?

    enum CodingKeys: String, CodingKey {
        case lat
        case lon
        case orgId = "org_id"
    }
}
