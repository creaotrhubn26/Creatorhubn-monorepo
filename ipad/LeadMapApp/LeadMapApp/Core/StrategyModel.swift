// StrategyModel.swift — Claude outreach-strategi

import Foundation

enum OutreachChannel: String, Codable {
    case coldCall = "cold_call"
    case email
    case instagramDm = "instagram_dm"
    case linkedin
    case inPerson = "in_person"
    case socialProof = "social_proof"
    case sms
    case googleMyBusinessReview = "google_my_business_review"
}

struct OutreachStep: Codable, Hashable {
    let day: Int
    let channel: OutreachChannel
    let action: String
    let template: String
}

struct ChannelMix: Codable, Hashable {
    let channel: String
    let weight: Int
    let rationale: String
}

struct StrategyModel: Codable, Hashable {
    let leadName: String
    let primaryChannel: OutreachChannel
    let secondaryChannels: [OutreachChannel]
    let openingLine: String
    let bestTime: String
    let sequence: [OutreachStep]
    let rationale: String
    let confidence: String
    let generatedAt: String
}
