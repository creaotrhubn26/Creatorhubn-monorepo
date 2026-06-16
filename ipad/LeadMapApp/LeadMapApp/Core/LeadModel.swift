// LeadModel.swift
//
// Codable som matcher backend MapLead-typen (frontend/client TypeScript-
// versjonen). Backend bruker snake_case → JSONDecoder konfigurert med
// .convertFromSnakeCase, så vi skriver felt-navn i camelCase her.

import Foundation

enum LeadStatus: String, Codable, CaseIterable, Identifiable {
    case unvisited
    case visited
    case `return`
    case notPresent = "not_present"
    case declined
    case interested
    case meetingBooked = "meeting_booked"
    case proposalSent = "proposal_sent"
    case won
    case lost
    case doNotContact = "do_not_contact"

    public var id: String { rawValue }

    var label: String {
        switch self {
        case .unvisited: return "Unvisited"
        case .visited: return "Visited"
        case .return: return "Return"
        case .notPresent: return "Not present"
        case .declined: return "Declined"
        case .interested: return "Interested"
        case .meetingBooked: return "Meeting booked"
        case .proposalSent: return "Proposal sent"
        case .won: return "Won"
        case .lost: return "Lost"
        case .doNotContact: return "Do not contact"
        }
    }
}

struct LeadModel: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let company: String?
    let category: String?
    let status: LeadStatus
    let address: String?
    let postalCode: String?
    let city: String?
    let country: String?
    let latitude: Double
    let longitude: Double
    let phone: String?
    let email: String?
    let websiteUrl: String?
    let instagramUrl: String?
    let linkedinUrl: String?
    let googleRating: Double?
    let googlePlaceId: String?
    let aiOpportunityScore: Int?
    let estimatedValue: Double?
    let leadSource: String?
    let assignedUserId: String?
    let assignedUserName: String?
    let assignedUserEmail: String?
    let projectId: String?
    let lastVisitAt: Date?
    let nextFollowUpAt: Date?
    let nextAction: String?
    let tags: [String]?
    let notes: String?
    let createdAt: Date
    let updatedAt: Date
}
