// PortfolioModel.swift
//
// Modeller for prosjekt-portefølje-visning (GET /organizations/:id/portfolio).

import Foundation

struct PortfolioProject: Identifiable, Codable, Sendable {
    let projectId: String
    let projectName: String
    let projectStatus: String
    let projectType: String?
    let projectDescription: String?
    let createdAt: String

    let customerId: String?
    let customerName: String?
    let websiteUrl: String?
    let logoUrl: String?
    let leadStatus: String?
    let leadCategory: String?
    let aiOpportunityScore: Int?
    let claudeRankedAt: String?
    let tags: [String]?

    let needsCount: Int
    let signalsPositiveCount: Int
    let signalsNegativeCount: Int
    let lastScoutAt: String?

    var id: String { projectId }

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case projectName = "project_name"
        case projectStatus = "project_status"
        case projectType = "project_type"
        case projectDescription = "project_description"
        case createdAt = "created_at"
        case customerId = "customer_id"
        case customerName = "customer_name"
        case websiteUrl = "website_url"
        case logoUrl = "logo_url"
        case leadStatus = "lead_status"
        case leadCategory = "lead_category"
        case aiOpportunityScore = "ai_opportunity_score"
        case claudeRankedAt = "claude_ranked_at"
        case tags
        case needsCount = "needs_count"
        case signalsPositiveCount = "signals_positive_count"
        case signalsNegativeCount = "signals_negative_count"
        case lastScoutAt = "last_scout_at"
    }
}

struct PortfolioSummary: Codable, Sendable {
    let totalProjects: Int
    let avgScore: Int
    let totalNeeds: Int

    enum CodingKeys: String, CodingKey {
        case totalProjects = "total_projects"
        case avgScore = "avg_score"
        case totalNeeds = "total_needs"
    }
}

struct PortfolioAccess: Codable, Sendable {
    let viewAll: Bool
    let scope: String

    enum CodingKeys: String, CodingKey {
        case viewAll = "view_all"
        case scope
    }
}

struct PortfolioResponse: Codable, Sendable {
    let projects: [PortfolioProject]
    let summary: PortfolioSummary
    let access: PortfolioAccess?
}
