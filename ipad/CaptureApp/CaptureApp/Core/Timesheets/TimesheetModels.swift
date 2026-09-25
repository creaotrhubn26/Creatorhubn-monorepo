import Foundation

enum TimesheetSyncState: String, Codable, Sendable {
    case synced
    case pending
    case failed
}

struct CaptureTimesheetSettlement: Codable, Sendable, Equatable {
    let id: String
    let totalMinutes: Int
    let hourlyRate: Double
    let amount: Double
    let currency: String
    let agreementStatus: String
    let splitSheetId: String
}

struct CaptureTimesheetPeriod: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let organizationId: String
    let projectId: String
    let participantId: String
    let employeeUserId: String
    let employeeName: String?
    let employeeEmail: String?
    let periodStart: String
    let periodEnd: String
    let status: String
    let version: Int
    let employeeNote: String?
    let reviewerNote: String?
    let totalMinutes: Int
    let billableMinutes: Int
    let entryCount: Int
    let submittedAt: String?
    let reviewedAt: String?
    let lockedAt: String?
    let settlement: CaptureTimesheetSettlement?
    let createdAt: String?
    let updatedAt: String?
}

struct CaptureTimeEntry: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let periodId: String
    let idempotencyKey: String
    let workDate: String
    let activity: String
    let description: String?
    let taskId: String?
    let startedAt: String?
    let endedAt: String?
    let durationMinutes: Int
    let breakMinutes: Int
    let netMinutes: Int
    let billable: Bool
    let source: String
    let version: Int
    let createdAt: String?
    let updatedAt: String?
}

struct CaptureTimesheetListResponse: Decodable, Sendable {
    struct Access: Decodable, Sendable { let canReview: Bool; let role: String; let userId: String }
    let periods: [CaptureTimesheetPeriod]
    let access: Access
}

struct CaptureTimesheetDetailResponse: Decodable, Sendable {
    struct Access: Decodable, Sendable { let canReview: Bool; let role: String }
    let period: CaptureTimesheetPeriod
    let entries: [CaptureTimeEntry]
    let access: Access
}

struct CaptureCurrentPeriodResponse: Decodable, Sendable {
    let period: CaptureTimesheetPeriod
    let participantId: String
}

struct LocalTimesheetPeriod: Codable, Sendable, Identifiable, Equatable {
    var id: String
    var ownerUserId: String
    var projectId: String
    var projectTitle: String
    var participantId: String
    var periodStart: String
    var periodEnd: String
    var status: String
    var totalMinutes: Int
    var billableMinutes: Int
    var entryCount: Int
    var reviewerNote: String?
    var settlementAmount: Double?
    var settlementCurrency: String?
    var lastSyncedAt: Date
}

struct LocalTimesheetEntry: Codable, Sendable, Identifiable, Equatable {
    var id: String { idempotencyKey }
    var idempotencyKey: String
    var serverId: String?
    var ownerUserId: String
    var periodId: String
    var projectId: String
    var workDate: String
    var activity: String
    var note: String?
    var startedAt: Date?
    var endedAt: Date?
    var durationMinutes: Int
    var breakMinutes: Int
    var billable: Bool
    var source: String
    var version: Int
    var syncState: TimesheetSyncState
    var lastError: String?
    var createdAt: Date
    var updatedAt: Date

    var netMinutes: Int { max(0, durationMinutes - breakMinutes) }
}

struct ActiveTimesheetTimer: Codable, Sendable, Identifiable, Equatable {
    var id: String { ownerUserId }
    var ownerUserId: String
    var projectId: String
    var projectTitle: String
    var periodId: String
    var activity: String
    var note: String?
    var startedAt: Date
    var updatedAt: Date
}

struct CaptureTimeEntryRequest: Encodable, Sendable {
    let idempotencyKey: String
    let workDate: String
    let activity: String
    let description: String?
    let taskId: String?
    let startedAt: String?
    let endedAt: String?
    let durationMinutes: Int
    let breakMinutes: Int
    let billable: Bool
    let source: String
}
