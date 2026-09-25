import Foundation
import GRDB

actor TimesheetStore {
    enum StoreError: LocalizedError {
        case timerAlreadyRunning
        case noActiveTimer
        case periodLocked
        case invalidDuration

        var errorDescription: String? {
            switch self {
            case .timerAlreadyRunning: return "En annen timer er allerede i gang."
            case .noActiveTimer: return "Fant ingen aktiv timer."
            case .periodLocked: return "Timelisten er sendt inn eller låst."
            case .invalidDuration: return "Varigheten må være minst ett minutt."
            }
        }
    }

    private let database: AppDatabase
    private let ownerUserId: String
    private let outbox: Outbox

    init(database: AppDatabase, ownerUserId: String) {
        self.database = database
        self.ownerUserId = ownerUserId
        self.outbox = Outbox(database: database, ownerUserId: ownerUserId)
    }

    func cache(
        project: BackendProjectSummary,
        detail: CaptureTimesheetDetailResponse
    ) async throws {
        let now = Date()
        let remotePeriod = detail.period
        let period = LocalTimesheetPeriod(
            id: remotePeriod.id,
            ownerUserId: ownerUserId,
            projectId: project.id,
            projectTitle: project.title,
            participantId: remotePeriod.participantId,
            periodStart: remotePeriod.periodStart,
            periodEnd: remotePeriod.periodEnd,
            status: remotePeriod.status,
            totalMinutes: remotePeriod.totalMinutes,
            billableMinutes: remotePeriod.billableMinutes,
            entryCount: remotePeriod.entryCount,
            reviewerNote: remotePeriod.reviewerNote,
            settlementAmount: remotePeriod.settlement?.amount,
            settlementCurrency: remotePeriod.settlement?.currency,
            lastSyncedAt: now
        )
        try await database.dbWriter.write { db in
            try period.save(db)
            for remote in detail.entries {
                let existing = try LocalTimesheetEntry.fetchOne(db, key: remote.idempotencyKey)
                let entry = LocalTimesheetEntry(
                    idempotencyKey: remote.idempotencyKey,
                    serverId: remote.id,
                    ownerUserId: self.ownerUserId,
                    periodId: remote.periodId,
                    projectId: project.id,
                    workDate: remote.workDate,
                    activity: remote.activity,
                    note: remote.description,
                    startedAt: remote.startedAt.flatMap(Self.parseDate),
                    endedAt: remote.endedAt.flatMap(Self.parseDate),
                    durationMinutes: remote.durationMinutes,
                    breakMinutes: remote.breakMinutes,
                    billable: remote.billable,
                    source: remote.source,
                    version: remote.version,
                    syncState: .synced,
                    lastError: nil,
                    createdAt: existing?.createdAt ?? remote.createdAt.flatMap(Self.parseDate) ?? now,
                    updatedAt: remote.updatedAt.flatMap(Self.parseDate) ?? now
                )
                try entry.save(db)
            }
        }
    }

    func cache(period remote: CaptureTimesheetPeriod, project: BackendProjectSummary) async throws {
        let local = LocalTimesheetPeriod(
            id: remote.id, ownerUserId: ownerUserId, projectId: project.id,
            projectTitle: project.title, participantId: remote.participantId,
            periodStart: remote.periodStart, periodEnd: remote.periodEnd,
            status: remote.status, totalMinutes: remote.totalMinutes,
            billableMinutes: remote.billableMinutes, entryCount: remote.entryCount,
            reviewerNote: remote.reviewerNote, settlementAmount: remote.settlement?.amount,
            settlementCurrency: remote.settlement?.currency, lastSyncedAt: Date()
        )
        try await database.dbWriter.write { db in try local.save(db) }
    }

    func periods() async throws -> [LocalTimesheetPeriod] {
        try await database.dbWriter.read { db in
            try LocalTimesheetPeriod
                .filter(Column("ownerUserId") == ownerUserId)
                .order(Column("periodStart").desc, Column("projectTitle"))
                .fetchAll(db)
        }
    }

    func entries(periodId: String) async throws -> [LocalTimesheetEntry] {
        try await database.dbWriter.read { db in
            var entries = try LocalTimesheetEntry
                .filter(Column("ownerUserId") == ownerUserId && Column("periodId") == periodId)
                .order(Column("workDate").desc, Column("createdAt").desc)
                .fetchAll(db)
            for index in entries.indices where entries[index].serverId == nil {
                if let mutation = try OutboxMutation
                    .filter(Column("ownerUserId") == ownerUserId)
                    .filter(Column("entityTable") == "timesheetEntry")
                    .filter(Column("entityId") == entries[index].idempotencyKey)
                    .order(Column("updatedAt").desc)
                    .fetchOne(db) {
                    switch mutation.status {
                    case .succeeded: entries[index].syncState = .synced
                    case .failed where mutation.attemptCount >= OutboxMutation.maxAttempts:
                        entries[index].syncState = .failed
                        entries[index].lastError = mutation.lastError
                    default: entries[index].syncState = .pending
                    }
                }
            }
            return entries
        }
    }

    func activeTimer() async throws -> ActiveTimesheetTimer? {
        try await database.dbWriter.read { db in
            try ActiveTimesheetTimer.fetchOne(db, key: ownerUserId)
        }
    }

    func startTimer(period: LocalTimesheetPeriod, activity: String, note: String?) async throws {
        guard ["draft", "rejected"].contains(period.status) else { throw StoreError.periodLocked }
        let cleanedActivity = activity.trimmingCharacters(in: .whitespacesAndNewlines)
        let now = Date()
        try await database.dbWriter.write { db in
            if try ActiveTimesheetTimer.fetchOne(db, key: ownerUserId) != nil {
                throw StoreError.timerAlreadyRunning
            }
            let timer = ActiveTimesheetTimer(
                ownerUserId: ownerUserId, projectId: period.projectId,
                projectTitle: period.projectTitle, periodId: period.id,
                activity: cleanedActivity.isEmpty ? "Arbeid" : cleanedActivity,
                note: Self.clean(note), startedAt: now, updatedAt: now
            )
            try timer.insert(db)
        }
    }

    @discardableResult
    func stopTimer(breakMinutes: Int = 0, endedAt: Date = Date()) async throws -> LocalTimesheetEntry {
        try await database.dbWriter.write { db in
            guard let timer = try ActiveTimesheetTimer.fetchOne(db, key: ownerUserId) else {
                throw StoreError.noActiveTimer
            }
            let duration = max(1, Int(ceil(endedAt.timeIntervalSince(timer.startedAt) / 60)))
            let safeBreak = max(0, min(breakMinutes, duration - 1))
            let idempotencyKey = UUID().uuidString.lowercased()
            let request = CaptureTimeEntryRequest(
                idempotencyKey: idempotencyKey,
                workDate: Self.day(timer.startedAt),
                activity: timer.activity,
                description: timer.note,
                taskId: nil,
                startedAt: Self.iso(timer.startedAt),
                endedAt: Self.iso(endedAt),
                durationMinutes: duration,
                breakMinutes: safeBreak,
                billable: true,
                source: "timer"
            )
            let entry = LocalTimesheetEntry(
                idempotencyKey: idempotencyKey, serverId: nil, ownerUserId: ownerUserId,
                periodId: timer.periodId, projectId: timer.projectId,
                workDate: request.workDate, activity: timer.activity, note: timer.note,
                startedAt: timer.startedAt, endedAt: endedAt,
                durationMinutes: duration, breakMinutes: safeBreak, billable: true,
                source: "timer", version: 1, syncState: .pending, lastError: nil,
                createdAt: endedAt, updatedAt: endedAt
            )
            try entry.insert(db)
            try outbox.enqueueInTransaction(
                db,
                endpoint: "/api/projects/\(Self.segment(timer.projectId))/timesheets/\(Self.segment(timer.periodId))/entries",
                method: .post,
                body: request,
                entityTable: "timesheetEntry",
                entityId: idempotencyKey
            )
            _ = try ActiveTimesheetTimer.deleteOne(db, key: ownerUserId)
            return entry
        }
    }

    @discardableResult
    func addManual(
        period: LocalTimesheetPeriod,
        workDate: String,
        activity: String,
        note: String?,
        durationMinutes: Int,
        breakMinutes: Int,
        billable: Bool
    ) async throws -> LocalTimesheetEntry {
        guard ["draft", "rejected"].contains(period.status) else { throw StoreError.periodLocked }
        guard durationMinutes > 0, breakMinutes >= 0, breakMinutes < durationMinutes else { throw StoreError.invalidDuration }
        let now = Date()
        let idempotencyKey = UUID().uuidString.lowercased()
        let request = CaptureTimeEntryRequest(
            idempotencyKey: idempotencyKey, workDate: workDate,
            activity: activity.trimmingCharacters(in: .whitespacesAndNewlines),
            description: Self.clean(note), taskId: nil, startedAt: nil, endedAt: nil,
            durationMinutes: durationMinutes, breakMinutes: breakMinutes,
            billable: billable, source: "manual"
        )
        let entry = LocalTimesheetEntry(
            idempotencyKey: idempotencyKey, serverId: nil, ownerUserId: ownerUserId,
            periodId: period.id, projectId: period.projectId, workDate: workDate,
            activity: request.activity.isEmpty ? "Arbeid" : request.activity,
            note: request.description, startedAt: nil, endedAt: nil,
            durationMinutes: durationMinutes, breakMinutes: breakMinutes,
            billable: billable, source: "manual", version: 1,
            syncState: .pending, lastError: nil, createdAt: now, updatedAt: now
        )
        try await database.dbWriter.write { db in
            try entry.insert(db)
            try outbox.enqueueInTransaction(
                db,
                endpoint: "/api/projects/\(Self.segment(period.projectId))/timesheets/\(Self.segment(period.id))/entries",
                method: .post,
                body: request,
                entityTable: "timesheetEntry",
                entityId: idempotencyKey
            )
        }
        return entry
    }

    func discardActiveTimer() async throws {
        try await database.dbWriter.write { db in
            _ = try ActiveTimesheetTimer.deleteOne(db, key: ownerUserId)
        }
    }

    private static func clean(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return nil }
        return trimmed
    }

    private static func iso(_ date: Date) -> String { ISO8601DateFormatter.capture.string(from: date) }

    private static func parseDate(_ value: String) -> Date? {
        ISO8601DateFormatter.capture.date(from: value)
    }

    private static func day(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func segment(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_.~"))
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}
