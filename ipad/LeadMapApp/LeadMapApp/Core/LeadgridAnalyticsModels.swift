// LeadgridAnalyticsModels.swift
//
// Models for the Leadgrid Analytics API (PR #858 backend).
// Maps to GET /api/leadgrid/analytics/{overview, channels, sources,
// segments, territories, velocity-history, conversion-funnel, outcomes}.
//
// Used by LeadgridAnalyticsDashboardView (5 charts-driven sections).
//
// Decoder is configured with `convertFromSnakeCase`, so snake_case
// JSON fields are decoded as camelCase Swift properties.

import Foundation

// MARK: - Overview

struct LeadgridAnalyticsOverview: Codable, Hashable {
    let totalLeads: Int
    let activeLeads: Int
    let hotLeads: Int
    let readyLeads: Int
    let followUpsDueToday: Int
    let followUpsOverdue: Int
    let meetingsBooked: Int
    let proposalsSent: Int
    let wonDeals: Int
    let lostDeals: Int
    let conversionRate: Double
    let expectedRevenue: Double
    let closedRevenue: Double
    let pipelineVelocity: Double
    let averageDealValue: Double
    let averageCycleDays: Double
    let avgTimeToFirstContactHours: Double?
    let avgTimeToCloseDays: Double?
}

// MARK: - Channels (multi-channel attempts vs responses)

struct LeadgridChannelPerf: Codable, Hashable, Identifiable {
    let channel: String
    let attempts: Int
    let responses: Int
    let responseRate: Double
    var id: String { channel }
}

// MARK: - Sources (lead-source attribution)

struct LeadgridSourcePerf: Codable, Hashable, Identifiable {
    let source: String
    let totalLeads: Int
    let conversions: Int
    let conversionRate: Double
    let avgDealValue: Double
    let sourceQualityScore: Double
    var id: String { source }
}

// MARK: - Segments (category / city / pipeline_stage)

struct LeadgridSegmentPerf: Codable, Hashable, Identifiable {
    let segment: String
    let totalLeads: Int
    let hotLeads: Int
    let conversions: Int
    let conversionRate: Double
    let expectedValue: Double
    let avgScore: Double
    var id: String { segment }
}

// MARK: - Territories (geo-aggregated lead-performance)

struct LeadgridTerritoryPerf: Codable, Hashable, Identifiable {
    let city: String
    let totalLeads: Int
    let conversions: Int
    let conversionRate: Double
    let expectedValue: Double
    let avgScore: Double
    let hotLeadDensity: Double
    let meetingsBooked: Int
    var id: String { city }
}

// MARK: - Velocity history (time-series)

struct LeadgridVelocityPoint: Codable, Hashable, Identifiable {
    let date: String
    let activeDeals: Int
    let winRate: Double
    let avgDealValue: Double
    let velocity: Double
    var id: String { date }
}

// MARK: - Funnel stages

struct LeadgridFunnelStage: Codable, Hashable, Identifiable {
    let stage: String
    let count: Int
    let sumExpectedValue: Double
    var id: String { stage }
}

// MARK: - Closed-loop project outcomes

enum LeadgridOutcomeEventType: String, Codable, CaseIterable, Hashable {
    case pilotInvited = "pilot_invited"
    case meetingCompleted = "meeting_completed"
    case profilePublished = "profile_published"
    case inquiryReceived = "inquiry_received"
    case bookingConfirmed = "booking_confirmed"
    case attendanceConfirmed = "attendance_confirmed"

    var title: String {
        switch self {
        case .pilotInvited: return "Pilot invitert"
        case .meetingCompleted: return "Møte gjennomført"
        case .profilePublished: return "Profil publisert"
        case .inquiryReceived: return "Forespørsel mottatt"
        case .bookingConfirmed: return "Booking bekreftet"
        case .attendanceConfirmed: return "Faktisk oppmøte"
        }
    }
}

struct LeadgridOutcomePerformance: Codable, Hashable, Identifiable {
    let eventType: LeadgridOutcomeEventType
    let events: Int
    let uniqueLeads: Int
    let quantity: Int
    let valuesByCurrency: [LeadgridOutcomeCurrencyValue]
    let lastOccurredAt: String?

    var id: LeadgridOutcomeEventType { eventType }
    var hasActivity: Bool {
        events > 0 || uniqueLeads > 0 || quantity > 0
            || valuesByCurrency.contains(where: { $0.valueMinor > 0 })
    }
}

struct LeadgridOutcomeCurrencyValue: Codable, Hashable, Identifiable {
    let currency: String
    let valueMinor: Int
    var id: String { currency }
}

struct LeadgridOutcomeProfileStage: Codable, Hashable, Identifiable {
    let eventType: LeadgridOutcomeEventType
    let uniqueLeads: Int
    let conversionRate: Double

    var id: LeadgridOutcomeEventType { eventType }
}

struct LeadgridOutcomeProfileCohort: Codable, Hashable, Identifiable {
    let profileId: String
    let profileName: String
    let cohortLeads: Int
    let windowStartedAt: String
    let windowEndedAt: String
    let firstImportedAt: String
    let stages: [LeadgridOutcomeProfileStage]

    var id: String { profileId }
}

struct LeadgridOutcomeCohortDefinition: Codable, Hashable {
    let attributionModel: String
    let denominator: String
}

// MARK: - Response envelopes
//
// Each API endpoint returns a JSON object with a single named key
// (overview / channels / sources / segments / territories / history /
// funnel). These thin wrappers let `APIClient.get(...)` decode cleanly.

struct AnalyticsOverviewResponse: Codable {
    let overview: LeadgridAnalyticsOverview
}

struct AnalyticsChannelsResponse: Codable {
    let channels: [LeadgridChannelPerf]
}

struct AnalyticsSourcesResponse: Codable {
    let sources: [LeadgridSourcePerf]
}

struct AnalyticsSegmentsResponse: Codable {
    let segments: [LeadgridSegmentPerf]
}

struct AnalyticsTerritoriesResponse: Codable {
    let territories: [LeadgridTerritoryPerf]
}

struct AnalyticsVelocityResponse: Codable {
    let history: [LeadgridVelocityPoint]
}

struct AnalyticsFunnelResponse: Codable {
    let funnel: [LeadgridFunnelStage]
}

struct AnalyticsOutcomesResponse: Codable {
    let outcomes: [LeadgridOutcomePerformance]
    let profileCohorts: [LeadgridOutcomeProfileCohort]
    let cohortDefinition: LeadgridOutcomeCohortDefinition?

    private enum CodingKeys: String, CodingKey {
        case outcomes
        case profileCohorts
        case cohortDefinition
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        outcomes = try container.decode([LeadgridOutcomePerformance].self, forKey: .outcomes)
        profileCohorts = try container.decodeIfPresent(
            [LeadgridOutcomeProfileCohort].self,
            forKey: .profileCohorts
        ) ?? []
        cohortDefinition = try container.decodeIfPresent(
            LeadgridOutcomeCohortDefinition.self,
            forKey: .cohortDefinition
        )
    }

    init(
        outcomes: [LeadgridOutcomePerformance],
        profileCohorts: [LeadgridOutcomeProfileCohort] = [],
        cohortDefinition: LeadgridOutcomeCohortDefinition? = nil
    ) {
        self.outcomes = outcomes
        self.profileCohorts = profileCohorts
        self.cohortDefinition = cohortDefinition
    }
}
