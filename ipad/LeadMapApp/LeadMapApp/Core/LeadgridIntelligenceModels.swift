// LeadgridIntelligenceModels.swift
//
// Modeller for Leadgrid Intelligence Engine (PR #855):
// — Lead-scoring (categoryFit, digitalNeed, ...) + 0-100 lead_score
// — Pipeline-stages (new → first_contact → ... → won/lost)
// — Next-Best-Action (NBA) anbefalinger m/ prioritet, kanal, reason, etc.
// — Følg-opp-kø, score-history
//
// Backend: /api/leadgrid/intelligence/*
// Decoder bruker .convertFromSnakeCase, så snake_case fra backend mappes
// automatisk til camelCase her.

import Foundation

// MARK: - NBA Recommendation

struct LeadgridNBARecommendation: Codable, Hashable, Identifiable {
    let id: String
    let leadId: String
    let leadName: String?
    let actionType: String
    let channel: String?
    let priority: String          // urgent / high / normal / low
    let reason: String
    let bestContactTime: BestContactTime?
    let suggestedMessage: String?
    let confidence: Double?
    let expectedImpact: String?
    let status: String            // pending / accepted / executed / dismissed / expired
    let createdAt: String?
    let expiresAt: String?
}

struct BestContactTime: Codable, Hashable {
    let weekday: String?
    let hourFrom: Int?
    let hourTo: Int?
}

// MARK: - Intelligence for a single lead

struct LeadgridIntelligenceForLead: Codable {
    let lead: LeadIntelligenceLead
    let facets: ScoringFacets
    let recommendation: LeadgridNBARecommendation?
    let scoredAt: String?
}

struct LeadIntelligenceLead: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let pipelineStage: String
    let leadStatus: String?
    let leadScore: Int?
    let leadTemperature: String?     // cold / warm / hot / ready
    let conversionProbability: Double?
    let expectedValue: Double?
    let followUpPriority: Int?
    let nextBestAction: String?
    let nextBestActionReason: String?
    let nextBestActionChannel: String?
    let nextBestActionConfidence: Double?
    let lastContactedAt: String?
    let nextFollowUpAt: String?
    let assignedUserId: String?
    let latitude: Double?
    let longitude: Double?
    let phone: String?
    let email: String?
    let website: String?
    let city: String?
}

struct ScoringFacets: Codable, Hashable {
    let categoryFit: Double?
    let digitalNeed: Double?
    let budgetPotential: Double?
    let engagement: Double?
    let timing: Double?
    let locationFit: Double?
}

// MARK: - Score history

struct LeadgridScoreHistoryEntry: Codable, Hashable, Identifiable {
    let id: String
    let leadScore: Int
    let leadTemperature: String?
    let pipelineStage: String
    let computedAt: String
    let triggeredBy: String?
    let reason: String?
}

// MARK: - Follow-up-kø

struct LeadgridFollowUpItem: Codable, Hashable, Identifiable {
    let id: String
    let leadId: String
    let leadName: String
    let actionType: String
    let channel: String?
    let priority: String
    let reason: String
    let leadTemperature: String?
    let leadScore: Int?
    let expectedValue: Double?
    let followUpPriority: Int?
    let nextFollowUpAt: String?
    let phone: String?
    let email: String?
}
