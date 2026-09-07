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

enum LeadgridMomentumScopeError: LocalizedError, Equatable {
    case missingProjectID
    case responseProjectMismatch

    var errorDescription: String? {
        switch self {
        case .missingProjectID:
            return "Velg et kundeprosjekt før du åpner momentum."
        case .responseProjectMismatch:
            return "Momentum-svaret tilhører ikke det aktive kundeprosjektet."
        }
    }
}

struct LeadgridMomentum: Codable, Hashable {
    let organizationId: String
    let projectId: String
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
        // Granulære tellere (undersett av contacts) — Telefoner/E-poster/Besøk
        // i «Aktivitet i dag». Optional så decode ikke feiler mot eldre backend.
        let calls: Int?
        let emails: Int?
        let visits: Int?
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
    let projectId: String
    let momentum: LeadgridMomentum
}

struct LeadgridSalesGoal: Codable, Hashable {
    let organizationId: String
    let projectId: String
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
    let projectId: String
    let goal: LeadgridSalesGoal
}

// MARK: - Trend (PR #496)

struct LeadgridMomentumTrend: Codable, Hashable {
    let organizationId: String
    let projectId: String
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
