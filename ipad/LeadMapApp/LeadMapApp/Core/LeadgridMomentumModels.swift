// LeadgridMomentumModels.swift
//
// Codable-modeller for Leadgrid Momentum Engine (Daniels system for
// daglig salgs-tempo). Backend-endepunkter:
//   - GET  /api/leadgrid/momentum/today  → LeadgridMomentumResponse
//   - GET  /api/leadgrid/momentum/goal   → LeadgridSalesGoalResponse
//   - POST /api/leadgrid/momentum/goal   → LeadgridSalesGoalResponse
//
// Brukes av LeadgridMomentumCard og LeadgridSetGoalSheet på Min dag.

import Foundation

struct LeadgridMomentum: Codable, Hashable {
    let organizationId: String
    let date: String
    let score: Double
    let breakdown: Breakdown
    let todayActivity: TodayActivity
    let overdueNbas: Int
    let trend: String  // "rising" | "stable" | "falling"
    let nextBestActions: [NextBestAction]
    let reasoning: String

    struct Breakdown: Codable, Hashable {
        let activityScore: Double
        let velocityScore: Double
        let decayScore: Double
        let overduePenalty: Double
    }

    struct TodayActivity: Codable, Hashable {
        let contacts: Int
        let contactsTarget: Int
        let followups: Int
        let followupsTarget: Int
        let meetings: Int
        let meetingsTarget: Int
        let pipelineMoves: Int
        let pipelineMovesTarget: Int
    }

    struct NextBestAction: Codable, Hashable, Identifiable {
        let type: String
        let label: String
        let urgency: String
        let count: Int?
        var id: String { type + label }
    }
}

struct LeadgridMomentumResponse: Codable {
    let momentum: LeadgridMomentum
}

struct LeadgridSalesGoal: Codable, Hashable {
    let organizationId: String
    let yearMonth: String
    let revenueTarget: Double?
    let dealsTarget: Int?
    let meetingsTarget: Int?
    let proposalsTarget: Int?
    let dailyContactsTarget: Int
    let dailyFollowupsTarget: Int
    let dailyMeetingsTarget: Int
    let dailyPipelineMovesTarget: Int
    let monthlyLeadsNeeded: Int?
}

struct LeadgridSalesGoalResponse: Codable {
    let goal: LeadgridSalesGoal
}

// MARK: - Trend (PR #496)

struct LeadgridMomentumTrend: Codable, Hashable {
    let organizationId: String
    let days: Int
    let points: [TrendPoint]
    let avg: Double
    let best: Double
    let worst: Double
    let directionChange: Double  // siste minus første score
}

struct TrendPoint: Codable, Hashable, Identifiable {
    let date: String
    let score: Double
    let activityScore: Double?
    let velocityScore: Double?
    let decayScore: Double?
    let overduePenalty: Double?
    let contacts: Int?
    let followups: Int?
    let meetings: Int?
    let pipelineMoves: Int?
    var id: String { date }
}

struct LeadgridMomentumTrendResponse: Codable {
    let trend: LeadgridMomentumTrend
}
