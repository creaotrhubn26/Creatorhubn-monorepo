// APIClient+Proposals.swift
//
// Tilbudssending (funn #7, produktrevisjonen 2026-07-03) — API-binding
// mot leadgrid-proposals-routes.ts (mig 0363):
//
//   POST  /api/leadgrid/leads/:id/proposals   → opprett + send e-post
//   GET   /api/leadgrid/leads/:id/proposals   → historikk per lead
//   PATCH /api/leadgrid/proposals/:id         → accepted/rejected
//
// JSON snake_case begge veier via _sharedEncoder/-Decoder.

import Foundation

// MARK: - Payloads

struct ProposalLinePayload: Codable, Hashable {
    var description: String
    var amountNok: Double
}

struct CreateProposalPayload: Encodable {
    let title: String
    let message: String
    let lines: [ProposalLinePayload]
    let validUntil: String?   // "YYYY-MM-DD"
    let toEmail: String?      // override når leaden mangler e-post
}

// MARK: - DTO

struct ProposalDTO: Decodable, Identifiable, Hashable {
    let id: String
    let leadId: String
    let title: String
    let message: String
    let totalAmountNok: Double
    let status: String        // sent | opened | accepted | rejected | expired
    let sentToEmail: String
    let openedAt: String?
    let createdAt: String?
}

struct ProposalsListResponse: Decodable {
    let proposals: [ProposalDTO]
}

struct CreateProposalResponse: Decodable {
    let proposal: ProposalDTO
    let emailSent: Bool
    let emailProvider: String?
    let emailError: String?
}

// MARK: - API

extension APIClient {
    /// Opprett tilbud + send e-post m/ «Se tilbudet»-lenke til leaden.
    func createProposal(
        leadId: String,
        _ payload: CreateProposalPayload
    ) async throws -> CreateProposalResponse {
        try await _post("/api/leadgrid/leads/\(leadId)/proposals", body: payload)
    }

    /// Tilbudshistorikk for en lead.
    func fetchProposals(leadId: String) async throws -> [ProposalDTO] {
        let resp: ProposalsListResponse = try await _get("/api/leadgrid/leads/\(leadId)/proposals")
        return resp.proposals
    }

    /// Marker utfall (accepted/rejected) på et tilbud.
    func updateProposalStatus(id: String, status: String) async throws {
        try await _patch("/api/leadgrid/proposals/\(id)", body: ["status": status])
    }
}
