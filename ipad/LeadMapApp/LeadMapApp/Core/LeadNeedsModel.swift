// LeadNeedsModel.swift
//
// Modeller for needs/signals/scores fra Lead Scout-service (backend
// crm_customer_needs / signals / scores). Brukes av LeadNeedsView
// på lead-detail.

import Foundation

struct LeadNeedRow: Identifiable, Codable, Sendable {
    let id: String
    let needType: String
    let priority: Int
    let claudeConfidence: Int?
    let evidence: String?
    let evidenceUrl: String?
    let status: String           // detected | accepted | dismissed | resolved
    let detectedAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case needType = "need_type"
        case priority
        case claudeConfidence = "claude_confidence"
        case evidence
        case evidenceUrl = "evidence_url"
        case status
        case detectedAt = "detected_at"
        case updatedAt = "updated_at"
    }

    /// Brukervennlig label uten "needs_"-prefix
    var displayLabel: String {
        let raw = needType.hasPrefix("needs_") ? String(needType.dropFirst("needs_".count)) : needType
        return raw.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

struct LeadSignalRow: Identifiable, Codable, Sendable {
    let id: String
    let signalType: String
    let polarity: String         // positive | negative | neutral
    let rawValue: String?
    let source: String
    let detectedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case signalType = "signal_type"
        case polarity
        case rawValue = "raw_value"
        case source
        case detectedAt = "detected_at"
    }

    var isPositive: Bool { polarity == "positive" }
    var isNegative: Bool { polarity == "negative" }

    var displayLabel: String {
        signalType.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

struct LeadScoreRow: Identifiable, Codable, Sendable {
    let id: String
    let dimension: String
    let rawValue: String?
    let normalized0_100: Int
    let weight: String
    let contribution: String?
    let source: String?
    let computedAt: String

    enum CodingKeys: String, CodingKey {
        case id, dimension, weight, source
        case rawValue = "raw_value"
        case normalized0_100 = "normalized_0_100"
        case contribution
        case computedAt = "computed_at"
    }

    var displayLabel: String {
        dimension.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

struct LeadScoutLastRun: Codable, Sendable {
    let id: String
    let status: String
    let startedAt: String
    let finishedAt: String?
    let needsFound: Int
    let signalsFound: Int
    let scoresComputed: Int
    let errorMessage: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case startedAt = "started_at"
        case finishedAt = "finished_at"
        case needsFound = "needs_found"
        case signalsFound = "signals_found"
        case scoresComputed = "scores_computed"
        case errorMessage = "error_message"
    }
}

struct LeadNeedsOverviewResponse: Codable, Sendable {
    let needs: [LeadNeedRow]
    let signals: [LeadSignalRow]
    let scores: [LeadScoreRow]
    let compositeScore: Int
    let lastRun: LeadScoutLastRun?

    enum CodingKeys: String, CodingKey {
        case needs, signals, scores
        case compositeScore = "composite_score"
        case lastRun = "last_run"
    }
}

struct LeadScoutResult: Codable, Sendable {
    let scoutRunId: String
    let needsCount: Int
    let signalsCount: Int
    let scoresCount: Int
    let compositeScore: Int

    enum CodingKeys: String, CodingKey {
        case scoutRunId = "scout_run_id"
        case needsCount = "needs_count"
        case signalsCount = "signals_count"
        case scoresCount = "scores_count"
        case compositeScore = "composite_score"
    }
}
