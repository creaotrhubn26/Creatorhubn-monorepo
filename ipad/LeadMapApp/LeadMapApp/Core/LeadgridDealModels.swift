// LeadgridDealModels.swift
//
// Codable-modeller for Leadgrid Deal Management (#154/#155, mig 0349).
//
// Backend-endepunkter:
//   GET   /api/leadgrid/deals/forecast           → DealForecastResponse
//   GET   /api/leadgrid/deals/by-month           → { byMonth: [PeriodBucket] }
//   GET   /api/leadgrid/deals/at-risk            → DealsAtRiskResponse
//   GET   /api/leadgrid/leads/:id/deal           → DealResponse
//   PATCH /api/leadgrid/leads/:id/deal           → DealResponse
//   GET   /api/leadgrid/leads/:id/deal-history   → DealHistoryResponse
//
// Decoder bruker .convertFromSnakeCase, så server-fields i snake_case
// blir camelCase her.

import Foundation

struct LeadgridDeal: Codable, Hashable {
    let dealProbability: Int?
    let dealProbabilityOverridden: Bool
    let expectedCloseDate: String?
    let dealAmount: Double?
    let dealCurrency: String?
    let pipelineStage: String?
    let dealStageChangedAt: String?
}

struct LeadgridDealResponse: Codable {
    let deal: LeadgridDeal
}

struct LeadgridDealForecastSummary: Codable, Hashable {
    let organizationId: String?
    let totalWeightedValue: Double
    let totalPipelineValue: Double
    let dealsCount: Int
    let averageProbability: Double
    let currency: String
}

struct LeadgridDealPeriodBucket: Codable, Hashable, Identifiable {
    let period: String
    let periodLabel: String
    let weightedValue: Double
    let totalValue: Double
    let dealsCount: Int
    let averageProbability: Double
    var id: String { period }
}

struct LeadgridDealForecast: Codable, Hashable {
    let summary: LeadgridDealForecastSummary
    let byMonth: [LeadgridDealPeriodBucket]
    let byQuarter: [LeadgridDealPeriodBucket]
}

struct LeadgridDealForecastResponse: Codable {
    let forecast: LeadgridDealForecast
}

struct LeadgridDealByMonthResponse: Codable {
    let byMonth: [LeadgridDealPeriodBucket]
}

struct LeadgridDealAtRisk: Codable, Hashable, Identifiable {
    let leadId: String
    let name: String?
    let pipelineStage: String
    let dealAmount: Double
    let dealProbability: Int
    let weightedValue: Double
    let expectedCloseDate: String
    let daysOverdue: Int
    let ownerUserId: String
    var id: String { leadId }
}

struct LeadgridDealsAtRiskResponse: Codable {
    let deals: [LeadgridDealAtRisk]
}

struct LeadgridDealStageChange: Codable, Hashable, Identifiable {
    let id: String
    let customerId: String
    let fromStage: String?
    let toStage: String
    let changedBy: String
    let changedAt: String
    let probabilityBefore: Int?
    let probabilityAfter: Int?
    let amountBefore: Double?
    let amountAfter: Double?
    let durationInPreviousStageMinutes: Int?
    let notes: String?
}

struct LeadgridDealHistoryResponse: Codable {
    let history: [LeadgridDealStageChange]
}

// MARK: - Pipeline-stage-display

enum LeadgridStage: String, CaseIterable, Hashable {
    case new
    case firstContact = "first_contact"
    case qualified
    case meeting
    case proposal
    case negotiation
    case won
    case lost

    var displayName: String {
        switch self {
        case .new: return "Ny"
        case .firstContact: return "Første kontakt"
        case .qualified: return "Kvalifisert"
        case .meeting: return "Møte"
        case .proposal: return "Tilbud"
        case .negotiation: return "Forhandling"
        case .won: return "Vunnet"
        case .lost: return "Tapt"
        }
    }

    /// Default-probability for stage (matcher backend leadgrid-deal-defaults.ts)
    var defaultProbability: Int {
        switch self {
        case .new: return 10
        case .firstContact: return 20
        case .qualified: return 35
        case .meeting: return 50
        case .proposal: return 65
        case .negotiation: return 80
        case .won: return 100
        case .lost: return 0
        }
    }
}
