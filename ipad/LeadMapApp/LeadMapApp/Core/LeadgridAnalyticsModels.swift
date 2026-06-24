// LeadgridAnalyticsModels.swift
//
// Models for the Leadgrid Analytics API (PR #858 backend).
// Maps to GET /api/leadgrid/analytics/{overview, channels, sources,
// segments, territories, velocity-history, conversion-funnel}.
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
