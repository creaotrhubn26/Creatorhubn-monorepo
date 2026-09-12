// CompetitorModel.swift

import Foundation

enum ThreatLevel: String, Codable {
    case near, medium, far
}

struct CompetitorModel: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let domain: String
    let category: String?
    let positioning: String?
    let primaryOffer: String?
    let latitude: Double?
    let longitude: Double?
    let address: String?
    let phone: String?
    let rating: Double?
    let isManualAddition: Bool
    let threatLevel: ThreatLevel?
    let threatScore: Int?
    let claudeThreatSummary: String?
    let claudeWhatToWorryAbout: String?
    let claudeWhatToIgnore: String?
    let claudeAssessedAt: Date?
    let priorityRank: Int?
    let createdAt: Date
}
