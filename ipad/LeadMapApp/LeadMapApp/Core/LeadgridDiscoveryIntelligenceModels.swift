import Foundation

enum DiscoveryMarketingReportStatus: String, Codable, Sendable {
    case generating
    case ready
    case insufficientEvidence = "insufficient_evidence"
    case failed
}

struct DiscoveryMarketingEvidence: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let kind: String
    let candidateId: String?
    let candidateName: String?
    let label: String
    let value: String
    let source: String
    let sourceURI: String?
    let sourceReference: String?

    enum CodingKeys: String, CodingKey {
        case id, kind, label, value, source
        case candidateId = "candidate_id"
        case candidateName = "candidate_name"
        case sourceURI = "source_uri"
        case sourceReference = "source_ref"
    }
}

struct DiscoveryMarketingExperiment: Codable, Hashable, Sendable {
    let hypothesis: String
    let action: String
    let metric: String
    let successCriterion: String
    let durationDays: Int

    enum CodingKeys: String, CodingKey {
        case hypothesis, action, metric
        case successCriterion = "success_criterion"
        case durationDays = "duration_days"
    }
}

struct DiscoveryMarketingInsight: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let category: String
    let claimType: String
    var title: String
    var finding: String
    var relevance: String
    let confidence: Double
    let evidenceCoverage: Double
    let evidenceReferences: [String]
    let counterEvidence: [String]
    var recommendedAction: String
    let experiment: DiscoveryMarketingExperiment?
    var reviewStatus: String
    var reviewedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, category, title, finding, relevance, confidence, experiment
        case claimType = "claim_type"
        case evidenceCoverage = "evidence_coverage"
        case evidenceReferences = "evidence_refs"
        case counterEvidence = "counter_evidence"
        case recommendedAction = "recommended_action"
        case reviewStatus = "review_status"
        case reviewedAt = "reviewed_at"
    }
}

struct DiscoveryMarketingReport: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let runId: String
    let skillKey: String
    let skillVersion: String
    let status: DiscoveryMarketingReportStatus
    let executiveSummary: String?
    let evidenceCoverage: Double
    let overallConfidence: Double
    let sourceCount: Int
    let evidenceCatalog: [DiscoveryMarketingEvidence]
    let conflicts: [String]
    let gaps: [String]
    let provider: String?
    let model: String?
    let errorCode: String?
    let errorMessage: String?
    var insights: [DiscoveryMarketingInsight]
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, status, conflicts, gaps, provider, model, insights
        case runId = "run_id"
        case skillKey = "skill_key"
        case skillVersion = "skill_version"
        case executiveSummary = "executive_summary"
        case evidenceCoverage = "evidence_coverage"
        case overallConfidence = "overall_confidence"
        case sourceCount = "source_count"
        case evidenceCatalog = "evidence_catalog"
        case errorCode = "error_code"
        case errorMessage = "error_message"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct DiscoveryMarketingInsightCorrection: Codable, Sendable {
    let title: String?
    let finding: String?
    let relevance: String?
    let recommendedAction: String?

    enum CodingKeys: String, CodingKey {
        case title, finding, relevance
        case recommendedAction = "recommended_action"
    }
}

struct DiscoveryMarketingFeedbackRequest: Codable, Sendable {
    let decision: String
    let reasonCode: String?
    let note: String?
    let correction: DiscoveryMarketingInsightCorrection?

    enum CodingKeys: String, CodingKey {
        case decision, note, correction
        case reasonCode = "reason_code"
    }
}
