// OnboardingPlaybookModel.swift
//
// Modeller for selv-onboarding + focus-requests + playbooks +
// deliverables. Speiler backend-routene (mig 0308-0310).

import Foundation

// MARK: - Auto-onboard

struct AutoOnboardResponse: Codable, Sendable {
    let auditId: String
    let status: String
    let message: String?

    enum CodingKeys: String, CodingKey {
        case auditId = "audit_id"
        case status, message
    }
}

struct AutoOnboardAudit: Codable, Sendable {
    let id: String
    let status: String
    let websiteUrl: String?
    let contactEmail: String?
    let contactName: String?
    let projectId: String?
    let customerId: String?
    let brregOrgNumber: String?
    let brregName: String?
    let logoUrl: String?
    let needsCount: Int?
    let signalsCount: Int?
    let compositeScore: Int?
    let clientToken: String?
    let errorMessage: String?
    let startedAt: String
    let finishedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case websiteUrl = "website_url"
        case contactEmail = "contact_email"
        case contactName = "contact_name"
        case projectId = "project_id"
        case customerId = "customer_id"
        case brregOrgNumber = "brreg_org_number"
        case brregName = "brreg_name"
        case logoUrl = "logo_url"
        case needsCount = "needs_count"
        case signalsCount = "signals_count"
        case compositeScore = "composite_score"
        case clientToken = "client_token"
        case errorMessage = "error_message"
        case startedAt = "started_at"
        case finishedAt = "finished_at"
    }

    var isTerminal: Bool {
        status == "completed" || status == "failed" || status == "duplicate"
    }
}

struct AutoOnboardStatusResponse: Codable, Sendable {
    let audit: AutoOnboardAudit
}

// MARK: - Focus requests

struct FocusRequestRow: Identifiable, Codable, Sendable {
    let id: String
    let projectId: String
    let customerId: String
    let needType: String
    let clientNote: String?
    let status: String
    let requestedAt: String
    let assignedUserId: String?
    let customerName: String?
    let customerLogo: String?
    let websiteUrl: String?
    let leadCategory: String?
    let projectName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case customerId = "customer_id"
        case needType = "need_type"
        case clientNote = "client_note"
        case status
        case requestedAt = "requested_at"
        case assignedUserId = "assigned_user_id"
        case customerName = "customer_name"
        case customerLogo = "customer_logo"
        case websiteUrl = "website_url"
        case leadCategory = "lead_category"
        case projectName = "project_name"
    }

    var displayNeedLabel: String {
        needType.replacingOccurrences(of: "needs_", with: "")
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }
}

struct FocusRequestsResponse: Codable, Sendable {
    let focusRequests: [FocusRequestRow]

    enum CodingKeys: String, CodingKey {
        case focusRequests = "focus_requests"
    }
}

// MARK: - Playbooks + Deliverables

struct PlaybookStep: Codable, Hashable, Sendable {
    let step: Int
    let title: String
    let instructions: String
    let estimatedMinutes: Int
    let needsClientInput: Bool
    let actionType: String

    enum CodingKeys: String, CodingKey {
        case step, title, instructions
        case estimatedMinutes = "estimated_minutes"
        case needsClientInput = "needs_client_input"
        case actionType = "action_type"
    }
}

struct PlaybookRequirement: Codable, Hashable, Sendable {
    let title: String
    let description: String
    let type: String
}

struct PlaybookVerification: Codable, Hashable, Sendable {
    let title: String
    let how: String
    let automated: Bool?
}

struct StartDeliveryResponse: Codable, Sendable {
    let deliverableId: String
    let playbookId: String
    let stepsCount: Int
    let requirementsCount: Int
    let message: String

    enum CodingKeys: String, CodingKey {
        case deliverableId = "deliverable_id"
        case playbookId = "playbook_id"
        case stepsCount = "steps_count"
        case requirementsCount = "requirements_count"
        case message
    }
}

struct DeliverableStepProgress: Codable, Hashable, Sendable {
    let step: Int
    var status: String           // pending | in_progress | done | blocked
    var notes: String?
    var completedAt: String?
    var completedBy: String?

    enum CodingKeys: String, CodingKey {
        case step, status, notes
        case completedAt = "completed_at"
        case completedBy = "completed_by"
    }
}

struct DeliverableRequirementProgress: Codable, Hashable, Sendable {
    var title: String
    var received: Bool
    var receivedAt: String?

    enum CodingKeys: String, CodingKey {
        case title, received
        case receivedAt = "received_at"
    }
}

struct DeliverableProgress: Codable, Sendable {
    let steps: [DeliverableStepProgress]?
    let requirements: [DeliverableRequirementProgress]?
}

struct DeliverableDetail: Codable, Sendable {
    let id: String
    let projectId: String
    let title: String?
    let status: String
    let clientSummary: String?
    let relatedNeedType: String?
    let progressData: DeliverableProgress?
    let targetDate: String?
    let startedAt: String?
    let completedAt: String?
    let playbookTitle: String?
    let playbookSteps: [PlaybookStep]?
    let playbookRequirements: [PlaybookRequirement]?
    let playbookVerification: [PlaybookVerification]?
    let playbookMinutes: Int?
    let playbookDifficulty: String?

    enum CodingKeys: String, CodingKey {
        case id, status, title
        case projectId = "project_id"
        case clientSummary = "client_summary"
        case relatedNeedType = "related_need_type"
        case progressData = "progress_data"
        case targetDate = "target_date"
        case startedAt = "started_at"
        case completedAt = "completed_at"
        case playbookTitle = "playbook_title"
        case playbookSteps = "playbook_steps"
        case playbookRequirements = "playbook_requirements"
        case playbookVerification = "playbook_verification"
        case playbookMinutes = "playbook_minutes"
        case playbookDifficulty = "playbook_difficulty"
    }
}

struct DeliverableResponse: Codable, Sendable {
    let deliverable: DeliverableDetail
}
