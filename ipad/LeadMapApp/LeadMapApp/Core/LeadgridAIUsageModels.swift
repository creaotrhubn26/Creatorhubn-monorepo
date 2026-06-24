// LeadgridAIUsageModels.swift
//
// Modeller for /api/leadgrid/ai-usage/summary og /history (PR #871).
// Backend gate: billing.view_ai_usage (admin/salgssjef).
//
// Backend bruker snake_case; APIClient.decoder har convertFromSnakeCase
// så camelCase her mappes automatisk:
//   total_calls          -> totalCalls
//   total_input_tokens   -> totalInputTokens
//   total_output_tokens  -> totalOutputTokens
//   total_audio_seconds  -> totalAudioSeconds
//   total_cost_usd       -> totalCostUsd
//   cost_usd             -> costUsd
//   organization_id      -> organizationId
//   since_days           -> sinceDays

import Foundation

struct LeadgridAIUsageProvider: Codable, Hashable, Identifiable {
    let provider: String
    let totalCalls: Int
    let totalInputTokens: Int?
    let totalOutputTokens: Int?
    let totalAudioSeconds: Double?
    let totalCostUsd: Double
    var id: String { provider }
}

struct LeadgridAIUsageSummary: Codable, Hashable {
    let organizationId: String
    let sinceDays: Int
    let providers: [LeadgridAIUsageProvider]
    let totalCalls: Int
    let totalCostUsd: Double
}

struct LeadgridAIUsageHistoryPoint: Codable, Hashable, Identifiable {
    let date: String
    let provider: String
    let totalCalls: Int
    let costUsd: Double
    var id: String { "\(date)-\(provider)" }
}

struct LeadgridAIUsageHistory: Codable, Hashable {
    let organizationId: String
    let history: [LeadgridAIUsageHistoryPoint]
}
