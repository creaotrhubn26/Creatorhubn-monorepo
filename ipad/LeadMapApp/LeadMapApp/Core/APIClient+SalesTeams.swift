// APIClient+SalesTeams.swift
//
// Sync-API for team-strukturen (LeadgridSalesTeamStore) og lead-
// tildelinger (AssignToTeamMemberSheet) — backend-pakken som erstatter
// enhets-lokal UserDefaults. Forutsetter mig 0361 + ruter i
// leadgrid-sales-teams-routes.ts.
//
// Endepunkter:
//   GET    /api/leadgrid/sales-teams
//   PUT    /api/leadgrid/sales-teams/:id       (upsert, klient-generert id)
//   DELETE /api/leadgrid/sales-teams/:id
//   POST   /api/leadgrid/lead-assignments
//
// JSON er snake_case begge veier — `LeadgridSalesTeam` brukes direkte
// som Codable-payload via _sharedEncoder/-Decoder (convertTo/FromSnakeCase).

import Foundation

// MARK: - Envelopes

struct SalesTeamsListResponse: Decodable {
    let teams: [LeadgridSalesTeam]
}

/// Payload for `POST /lead-assignments`. Feltnavn encodes til snake_case
/// (lead_name, assignee_user_id, …) som matcher backend-ruten.
struct LeadAssignmentPayload: Encodable {
    let leadId: String?
    let leadName: String
    let leadLat: Double?
    let leadLng: Double?
    let assigneeUserId: String
    let assigneeRole: String   // seller | promoter | manager
    let priority: String       // normal | high | urgent
    let message: String
}

// MARK: - API

extension APIClient {
    /// Alle team i org-en, sortert på navn (backend sorterer).
    func fetchSalesTeams() async throws -> [LeadgridSalesTeam] {
        let resp: SalesTeamsListResponse = try await _get("/api/leadgrid/sales-teams")
        return resp.teams
    }

    /// Opprett/oppdater team. Backend upserter på (org, id) så kall-siden
    /// kan bruke samme metode for begge.
    func upsertSalesTeam(_ team: LeadgridSalesTeam) async throws {
        let payload = try Self._sharedEncoder.encode(team)
        _ = try await _request(
            "/api/leadgrid/sales-teams/\(team.id)",
            method: "PUT",
            body: payload
        )
    }

    func deleteSalesTeam(id: String) async throws {
        try await _delete("/api/leadgrid/sales-teams/\(id)")
    }

    /// Send «Reis dit»-oppdrag. Backend oppretter raden + in-app varsel
    /// til mottakeren.
    func createLeadAssignment(_ payload: LeadAssignmentPayload) async throws {
        try await _post("/api/leadgrid/lead-assignments", body: payload)
    }
}

// MARK: - Aktivitetsfeed (2026-07-04)

/// Én hendelse i org-ens aktivitetsfeed (crm_lead_activities m/ joins).
struct ActivityFeedItemDTO: Decodable, Identifiable, Hashable {
    let id: String
    let activityType: String
    let description: String
    let newValue: String?
    let userName: String
    let leadName: String
    let createdAt: String?
}

struct ActivityFeedResponse: Decodable {
    let activities: [ActivityFeedItemDTO]
}

extension APIClient {
    /// Org-ens siste aktiviteter (tilbud/besøk/status-endringer) —
    /// Team-fanens «Siste aktivitet»-kort.
    func fetchActivityFeed(limit: Int = 25) async throws -> [ActivityFeedItemDTO] {
        let resp: ActivityFeedResponse = try await _get("/api/leadgrid/activity-feed?limit=\(limit)")
        return resp.activities
    }
}
