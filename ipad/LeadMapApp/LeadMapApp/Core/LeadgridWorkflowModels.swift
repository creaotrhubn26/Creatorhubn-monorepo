// LeadgridWorkflowModels.swift
//
// Codable-modeller for Smart Workflow Builder (#203, mig 0349).
//
// Backend-endepunkter:
//   GET    /api/leadgrid/workflows                    → LeadgridWorkflowsResponse
//   GET    /api/leadgrid/workflows/templates          → LeadgridWorkflowTemplatesResponse
//   GET    /api/leadgrid/workflows/:id                → LeadgridWorkflowDetailResponse
//   POST   /api/leadgrid/workflows                    → { id, status }
//   PATCH  /api/leadgrid/workflows/:id                → { ok }
//   DELETE /api/leadgrid/workflows/:id                → { ok }
//   POST   /api/leadgrid/workflows/:id/test           → { result }
//   POST   /api/leadgrid/workflows/:id/execute        → { ok, queued }
//   GET    /api/leadgrid/workflows/:id/executions     → LeadgridWorkflowExecutionsResponse

import Foundation

struct LeadgridWorkflow: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let isActive: Bool
    let triggerType: String
    let executionCount: Int
    let lastExecutedAt: String?
    let lastErrorAt: String?
    let lastErrorMessage: String?
    let templateKey: String?
    let createdBy: String
    let createdAt: String
    let updatedAt: String

    // Trigger-config, conditions, actions er JSONB. Vi dekoder dem som
    // raw AnyCodable for å bevare data; UI viser dem via .triggerType o.l.
    // (AnyCodable lever i NotificationModel.swift, kun Decodable.)
    let triggerConfig: AnyCodable?
    let conditions: AnyCodable?
    let actions: AnyCodable?
}

extension LeadgridWorkflow: Hashable {
    static func == (lhs: LeadgridWorkflow, rhs: LeadgridWorkflow) -> Bool {
        lhs.id == rhs.id
            && lhs.updatedAt == rhs.updatedAt
            && lhs.isActive == rhs.isActive
            && lhs.executionCount == rhs.executionCount
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(updatedAt)
    }
}

struct LeadgridWorkflowsResponse: Decodable {
    let workflows: [LeadgridWorkflow]
    let total: Int?
}

struct LeadgridWorkflowDetailResponse: Decodable {
    let workflow: LeadgridWorkflow
}

struct LeadgridWorkflowTemplate: Codable, Hashable, Identifiable {
    let key: String
    let name: String
    let description: String
    let category: String
    let trigger: LeadgridWorkflowTriggerSummary
    let actions: [LeadgridWorkflowActionSummary]
    var id: String { key }
}

struct LeadgridWorkflowTriggerSummary: Codable, Hashable {
    let type: String
    let to: String?
    let priority: String?
    let min: Double?
    let max: Double?
    let from: String?
    // mig 0350 — nye trigger-config-felt
    let emailId: String?
    let linkUrlPattern: String?
    let meetingType: String?
    let proposalId: String?
    let provider: String?
}

struct LeadgridWorkflowActionSummary: Codable, Hashable {
    let type: String
    let templateId: String?
    let stage: String?
    let tag: String?
    let title: String?
    let channel: String?
    let messageTemplate: String?
    let durationMinutes: Int?
    let saveToNotes: Bool?
    let userId: String?
    let status: String?
    // mig 0350 — nye action-felt
    let when: String?
    let notes: String?
    let meetingType: String?
    let destinationId: String?
    let payloadTemplate: String?
    let recipient: String?
    let body: String?
    let reason: String?
}

struct LeadgridWorkflowTemplatesResponse: Codable {
    let templates: [LeadgridWorkflowTemplate]
}

struct LeadgridWorkflowExecution: Decodable, Identifiable, Sendable {
    let id: String
    let leadId: String?
    let status: String
    let errorMessage: String?
    let startedAt: String
    let finishedAt: String?
    let durationMs: Int?
    let actionsExecuted: [LeadgridWorkflowActionResult]
    let triggerEvent: AnyCodable?
}

extension LeadgridWorkflowExecution: Hashable {
    static func == (lhs: LeadgridWorkflowExecution, rhs: LeadgridWorkflowExecution) -> Bool {
        lhs.id == rhs.id && lhs.status == rhs.status
    }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct LeadgridWorkflowActionResult: Codable, Hashable {
    let index: Int
    let type: String
    let status: String
    let message: String?
    let durationMs: Int?
}

struct LeadgridWorkflowExecutionsResponse: Decodable {
    let executions: [LeadgridWorkflowExecution]
}

struct LeadgridWorkflowCreatedResponse: Decodable {
    let id: String
    let status: String?
}

/// Returneres av POST /api/leadgrid/workflows/:id/execute (bulk-utvidet).
struct LeadgridWorkflowExecuteResponse: Decodable, Sendable {
    let executionId: String?
    let status: String?
    let totalLeads: Int?
    let triggeredAt: String?
    let leadIds: [String]?
    let ok: Bool?
    let queued: Bool?
}

// AnyCodable er allerede definert i NotificationModel.swift som Decodable +
// Sendable. Vi gjenbruker den her.
