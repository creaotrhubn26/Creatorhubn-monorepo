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

struct LeadPlacementResult: Decodable, Sendable {
    let attempted: Int
    let placed: Int
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

    func resolveLeadPlacement(projectId: String) async throws -> LeadPlacementResult {
        struct Body: Encodable { let project_id: String }
        let data = try await executeRaw(
            method: "POST",
            path: "/api/leadgrid/lead-placement/resolve",
            body: try JSONEncoder().encode(Body(project_id: projectId)))
        return try JSONDecoder().decode(LeadPlacementResult.self, from: data)
    }
}
