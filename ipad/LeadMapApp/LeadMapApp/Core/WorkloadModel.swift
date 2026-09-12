// WorkloadModel.swift
//
// Min dag — workload + kvote-progresjon. Speilet fra
// /me/workload + /me/quota (PR #616).

import Foundation

struct WorkloadLead: Identifiable, Decodable {
    let id: String
    let name: String
    let leadCategory: String?
    let leadStatus: String
    let address: String?
    let city: String?
    let latitude: Double?
    let longitude: Double?
    let phone: String?
    let email: String?
    let websiteUrl: String?
    let logoUrl: String?
    let aiOpportunityScore: Int?
    let claudeRecommendationRank: Int?
    let claudeRecommendationReason: String?
    let nextFollowUpAt: String?
    let lastContactedAt: String?
    let assignedAt: String?
    let distanceKm: Double?

    var isOverdue: Bool {
        guard let s = nextFollowUpAt,
              let date = ISO8601DateFormatter().date(from: s) else { return false }
        return date < Date()
    }

    var coordinate: (lat: Double, lng: Double)? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return (lat, lng)
    }

    var googleMapsNavigateURL: URL? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(lat),\(lng)&travelmode=driving")
    }

    var appleMapsNavigateURL: URL? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return URL(string: "https://maps.apple.com/?daddr=\(lat),\(lng)&dirflg=d")
    }
}

struct WorkloadResponse: Decodable {
    let leads: [WorkloadLead]
    let totalAssigned: Int
    let organizationId: String?
    let sortedByDistance: Bool
}

struct QuotaProgress: Decodable {
    let yearMonth: String
    let targetNok: Double
    let achievedNok: Double
    let remainingNok: Double
    let progressPct: Double?
    let projectedNok: Double
    let wonCount: Int
    let meetingsBooked: Int
    let commissionEarnedNok: Double

    var hasTarget: Bool { targetNok > 0 }

    /// On track hvis projeksjon ≥ target
    var isOnTrack: Bool { projectedNok >= targetNok && targetNok > 0 }
}
