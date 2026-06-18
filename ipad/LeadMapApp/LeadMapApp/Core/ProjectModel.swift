// ProjectModel.swift — Lead Map prosjekt-kontekst

import Foundation

struct ProjectListItem: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let description: String?
    let status: String?
    let hasBrandKit: Bool
    let leadCount: Int
    let competitorCount: Int
}

struct ProjectBrandKitSummary: Codable, Hashable {
    let id: String
    let sourceUrl: String?
    let lastScannedAt: String?
    let positioningSummary: String?
    let tone: String?
    let targetAudience: String?
    let valueProposition: String?
    let logoUrl: String?
}

struct ProjectMarketScanSummary: Codable, Hashable {
    let id: String
    let name: String
    let marketQuery: String
    let status: String
    let confidence: String
    let completedAt: String?
}

struct ProjectLeadsSummary: Codable, Hashable {
    let total: Int
    let statusCounts: [String: Int]
}

struct ProjectInfo: Codable, Hashable {
    let id: String
    let name: String
    let description: String?
    let projectType: String?
    let genre: String?
    let status: String
}

struct ProjectSummary: Codable, Hashable {
    let project: ProjectInfo
    let brandKit: ProjectBrandKitSummary?
    let marketScan: ProjectMarketScanSummary?
    let leads: ProjectLeadsSummary
    let competitorCount: Int
}
