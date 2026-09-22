// APIClient+LeadPlacement.swift
//
// Leads uten koordinater er usynlige på kartet — kartlaget filtrerer bort
// 0,0. Disse kallene teller dem og slår opp adressene på nytt.

import Foundation

struct LeadPlacementStatus: Decodable, Sendable {
    let unplacedCount: Int
    let resolvableCount: Int

    enum CodingKeys: String, CodingKey {
        case unplacedCount = "unplaced_count"
        case resolvableCount = "resolvable_count"
    }
}

/// Én adresse Kartverket mener kan stemme. Brukeren velger mellom disse når
/// oppslaget ikke er entydig.
struct LeadPlacementOption: Decodable, Sendable, Identifiable {
    let latitude: Double
    let longitude: Double
    let label: String
    let municipality: String?
    let postalCode: String?

    var id: String { "\(latitude),\(longitude)" }

    enum CodingKeys: String, CodingKey {
        case latitude, longitude, label, municipality
        case postalCode = "postal_code"
    }
}

struct AmbiguousLeadPlacement: Decodable, Sendable, Identifiable {
    let leadId: String
    let name: String
    let address: String?
    let options: [LeadPlacementOption]

    var id: String { leadId }

    enum CodingKeys: String, CodingKey {
        case name, address, options
        case leadId = "lead_id"
    }
}

struct LeadPlacementResult: Decodable, Sendable {
    let attempted: Int
    let placed: Int
    let reused: Int
    let ambiguous: [AmbiguousLeadPlacement]
    let unresolved: Int
    let remaining: Int
}

extension APIClient {
    func fetchLeadPlacementStatus(projectId: String) async throws -> LeadPlacementStatus {
        let encoded = projectId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? projectId
        let data = try await executeRaw(
            method: "GET",
            path: "/api/leadgrid/lead-placement?project_id=\(encoded)",
            body: nil)
        return try JSONDecoder().decode(LeadPlacementStatus.self, from: data)
    }

    func verifyLeadPlacement(
        projectId: String,
        leadId: String,
        option: LeadPlacementOption
    ) async throws {
        struct Body: Encodable {
            let project_id: String
            let lead_id: String
            let latitude: Double
            let longitude: Double
            let label: String
        }
        _ = try await executeRaw(
            method: "POST",
            path: "/api/leadgrid/lead-placement/verify",
            body: try JSONEncoder().encode(Body(
                project_id: projectId,
                lead_id: leadId,
                latitude: option.latitude,
                longitude: option.longitude,
                label: option.label)))
    }

    func resolveLeadPlacement(projectId: String) async throws -> LeadPlacementResult {
        struct Body: Encodable { let project_id: String }
        let data = try await executeRaw(
            method: "POST",
            path: "/api/leadgrid/lead-placement/resolve",
            body: try JSONEncoder().encode(Body(project_id: projectId)))
        return try JSONDecoder().decode(LeadPlacementResult.self, from: data)
    }
}
