// APIClient+LeadgridCockpit.swift
//
// Salgssjef-cockpit-persistering (mig 0406, backend leadgrid-cockpit-routes.ts):
//   1. Godkjenningskø (deals/rabatter)  → /api/leadgrid/approvals/*
//   2. Coaching 1-til-1                  → /api/leadgrid/coaching/*
// Erstatter ApprovalMockData / CoachingMockData med ekte, persistert data.
//
// 🔑 Backend-DTO er allerede camelCase → egen plain JSONDecoder/-Encoder UTEN
// key-strategi via `_request` direkte (samme mønster som APIClient+LeadgridMileage;
// de delte _get/_post ville rørt snake_case-konvertering på request-body).

import Foundation

struct LeadgridApproval: Decodable, Identifiable, Hashable {
    let id: Int
    let kind: String            // deal | discount | special
    let title: String
    let sellerName: String?
    let customerName: String?
    let amountNok: Double
    let rationale: String?
    let status: String          // pending | approved | rejected
    let comment: String?
    let createdAt: String?
}

struct LeadgridCoachingSession: Decodable, Identifiable, Hashable {
    let id: Int
    let memberUserId: String?
    let memberName: String
    let scheduledAt: String?
    let focus: String?
    let status: String          // scheduled | done | cancelled
    let createdAt: String?
}

private struct LeadgridApprovalsResponse: Decodable {
    let approvals: [LeadgridApproval]
}
private struct LeadgridCoachingResponse: Decodable {
    let sessions: [LeadgridCoachingSession]
}

extension APIClient {
    private static let _lgCockpitDecoder = JSONDecoder()
    private static let _lgCockpitEncoder = JSONEncoder()

    // ── Godkjenningskø ─────────────────────────────────────────────────
    func fetchLeadgridApprovalsPending() async throws -> [LeadgridApproval] {
        let data = try await _request("/api/leadgrid/approvals/pending", method: "GET")
        return try Self._lgCockpitDecoder.decode(LeadgridApprovalsResponse.self, from: data).approvals
    }

    private struct _CommentBody: Encodable { let comment: String }

    /// Godkjenn (approve=true) eller avslå (false). Valgfri kommentar.
    func decideLeadgridApproval(id: Int, approve: Bool, comment: String?) async throws {
        let path = "/api/leadgrid/approvals/\(id)/\(approve ? "approve" : "reject")"
        if let comment, !comment.isEmpty {
            let body = try Self._lgCockpitEncoder.encode(_CommentBody(comment: comment))
            _ = try await _request(path, method: "POST", body: body)
        } else {
            _ = try await _request(path, method: "POST")
        }
    }

    /// Legg til kommentar uten å avgjøre.
    func commentLeadgridApproval(id: Int, comment: String) async throws {
        let body = try Self._lgCockpitEncoder.encode(_CommentBody(comment: comment))
        _ = try await _request("/api/leadgrid/approvals/\(id)/comment", method: "POST", body: body)
    }

    // ── Coaching 1-til-1 ───────────────────────────────────────────────
    func fetchLeadgridCoachingSessions() async throws -> [LeadgridCoachingSession] {
        let data = try await _request("/api/leadgrid/coaching/sessions", method: "GET")
        return try Self._lgCockpitDecoder.decode(LeadgridCoachingResponse.self, from: data).sessions
    }

    private struct _NewCoachingBody: Encodable {
        let memberName: String
        let memberUserId: String?
        let scheduledAt: String
        let focus: String?
    }

    /// Planlegg ny 1-til-1.
    func createLeadgridCoachingSession(
        memberName: String,
        memberUserId: String?,
        scheduledAt: Date,
        focus: String?,
    ) async throws {
        let iso = ISO8601DateFormatter().string(from: scheduledAt)
        let body = try Self._lgCockpitEncoder.encode(_NewCoachingBody(
            memberName: memberName, memberUserId: memberUserId, scheduledAt: iso, focus: focus,
        ))
        _ = try await _request("/api/leadgrid/coaching/sessions", method: "POST", body: body)
    }
}
