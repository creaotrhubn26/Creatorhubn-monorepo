// LeadgridForecastingModels.swift
//
// Modeller for Leadgrid Forecasting (PR #885, mig 323).
// Predikert revenue for konfigurert horisont (default 90d) m/ p10/p50/p90-bånd,
// Claude-reasoning + contributing factors.
//
// Backend: GET  /api/leadgrid/forecasting/pipeline?horizon=N
//          POST /api/leadgrid/forecasting/pipeline/refresh  (body: { horizon })
//
// Decoder bruker .convertFromSnakeCase — snake_case fra backend mappes
// automatisk til camelCase her.

import Foundation

struct LeadgridForecast: Codable, Hashable {
    let organizationId: String
    let horizonDays: Int
    let predictedRevenueLow: Double
    let predictedRevenueMid: Double
    let predictedRevenueHigh: Double
    let predictedWonDeals: Int
    let predictedAvgCycleDays: Double
    let confidence: Double
    let reasoning: String
    let contributingFactors: [ContributingFactor]
    let activePipelineValue: Double
    let activeDeals: Int
    let computedAt: String?

    struct ContributingFactor: Codable, Hashable {
        let factor: String
        let weight: Double
        let direction: String  // "positive" | "negative"
    }
}

struct LeadgridForecastResponse: Codable {
    let forecast: LeadgridForecast
}
