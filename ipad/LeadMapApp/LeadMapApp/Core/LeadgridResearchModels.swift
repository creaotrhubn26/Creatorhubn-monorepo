// LeadgridResearchModels.swift
//
// Native Leadgrid Research-modeller. Speilet 1:1 mot backend's
// LeadgridResearch-shape (se backend/server/leadgrid-research-routes.ts).
//
// JSONDecoder er konfigurert med .convertFromSnakeCase i APIClient, så
// camelCase-felter her matcher snake_case fra DB; for nyere kanonisk
// camelCase-respons (fra Claude-parser) matcher de direkte.

import Foundation

enum FirstTouchChannel: String, Codable, Hashable, CaseIterable {
    case email
    case linkedin
    case phone
    case inPerson = "in_person"

    var label: String {
        switch self {
        case .email: return "E-post"
        case .linkedin: return "LinkedIn"
        case .phone: return "Telefon"
        case .inPerson: return "Personlig møte"
        }
    }

    var systemIcon: String {
        switch self {
        case .email: return "envelope.fill"
        case .linkedin: return "person.crop.rectangle.stack.fill"
        case .phone: return "phone.fill"
        case .inPerson: return "figure.wave"
        }
    }
}

struct LeadgridResearchSWOT: Codable, Hashable {
    let strengths: [String]
    let weaknesses: [String]
    let opportunities: [String]
    let threats: [String]
}

struct LeadgridResearchDecisionMaker: Codable, Hashable, Identifiable {
    /// Lokal stabil id — bygges fra role+title slik at SwiftUI-lists ikke
    /// gjenbruker celle-state ved re-decode. Backend sender ingen id.
    var id: String { "\(role)|\(title ?? "")" }

    let role: String          // f.eks. "Markedssjef"
    let title: String?        // norsk tittel fra BRREG hvis kjent
    let why: String           // hvorfor denne rollen er rett inngang

    enum CodingKeys: String, CodingKey {
        case role
        case title
        case why
    }
}

struct LeadgridResearchFirstTouch: Codable, Hashable {
    let channel: FirstTouchChannel
    let subject: String?
    let body: String
}

struct LeadgridResearch: Codable, Hashable {
    let swot: LeadgridResearchSWOT
    let decisionMakers: [LeadgridResearchDecisionMaker]
    let firstTouch: LeadgridResearchFirstTouch
    let category: String?
    let risk: String?
    /// 1-10 fra Claude.
    let opportunityScore: Int?
    /// ISO8601-streng. Vi tolker som Date i view-laget hvis ønskelig.
    let generatedAt: String?

    /// Convenience — opportunity-color brukes i headeren.
    var opportunityColor: OpportunityTier {
        guard let score = opportunityScore else { return .unknown }
        switch score {
        case 8...10: return .hot
        case 5...7: return .warm
        case 1...4: return .cool
        default: return .unknown
        }
    }
}

enum OpportunityTier {
    case hot
    case warm
    case cool
    case unknown

    var label: String {
        switch self {
        case .hot: return "Høy"
        case .warm: return "Middels"
        case .cool: return "Lav"
        case .unknown: return "Ukjent"
        }
    }
}

// MARK: - Response envelopes

struct LeadgridResearchEnvelope: Decodable {
    let research: LeadgridResearch
}
