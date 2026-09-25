import XCTest
import GRDB
@testable import CaptureApp

final class TimesheetStoreTests: XCTestCase {
    private let owner = "employee-1"

    private func makePeriod(ownerUserId: String = "employee-1") -> LocalTimesheetPeriod {
        LocalTimesheetPeriod(
            id: "11111111-1111-4111-8111-111111111111",
            ownerUserId: ownerUserId,
            projectId: "project-1",
            projectTitle: "Bryllup",
            participantId: "22222222-2222-4222-8222-222222222222",
            periodStart: "2026-09-21",
            periodEnd: "2026-09-27",
            status: "draft",
            totalMinutes: 0,
            billableMinutes: 0,
            entryCount: 0,
            reviewerNote: nil,
            settlementAmount: nil,
            settlementCurrency: nil,
            lastSyncedAt: Date()
        )
    }

    private func makeStore() async throws -> (TimesheetStore, AppDatabase, LocalTimesheetPeriod) {
        let database = try AppDatabase.inMemory()
        let period = makePeriod()
        try await database.dbWriter.write { db in try period.insert(db) }
        return (TimesheetStore(database: database, ownerUserId: owner), database, period)
    }

    func testMigrationCreatesNativeTimesheetTables() async throws {
        let database = try AppDatabase.inMemory()
        let tables = try await database.dbWriter.read { db in
            try ["timesheetPeriod", "timesheetEntry", "activeTimesheetTimer"].map {
                try db.tableExists($0)
            }
        }
        XCTAssertEqual(tables, [true, true, true])
    }

    func testActiveTimerSurvivesStoreRestart() async throws {
        let (store, database, period) = try await makeStore()
        try await store.startTimer(period: period, activity: "Opptak", note: "Kamera B")

        let reopened = TimesheetStore(database: database, ownerUserId: owner)
        let timer = try await reopened.activeTimer()
        XCTAssertEqual(timer?.projectId, period.projectId)
        XCTAssertEqual(timer?.activity, "Opptak")
        XCTAssertEqual(timer?.note, "Kamera B")
    }

    func testStoppingTimerAtomicallyQueuesEntryAndClearsTimer() async throws {
        let (store, database, period) = try await makeStore()
        try await store.startTimer(period: period, activity: "Rigging", note: nil)
        let entry = try await store.stopTimer()

        let timer = try await store.activeTimer()
        XCTAssertNil(timer)
        XCTAssertEqual(entry.syncState, .pending)
        XCTAssertEqual(entry.source, "timer")
        XCTAssertGreaterThanOrEqual(entry.durationMinutes, 1)

        let queued = try await database.dbWriter.read { db in
            try OutboxMutation
                .filter(Column("entityTable") == "timesheetEntry")
                .filter(Column("entityId") == entry.idempotencyKey)
                .fetchOne(db)
        }
        XCTAssertEqual(queued?.status, .pending)
        XCTAssertEqual(
            queued?.endpoint,
            "/api/projects/project-1/timesheets/11111111-1111-4111-8111-111111111111/entries"
        )
    }

    func testManualEntryIsDurableAndQueuedOnce() async throws {
        let (store, database, period) = try await makeStore()
        let entry = try await store.addManual(
            period: period,
            workDate: "2026-09-25",
            activity: "Assistentarbeid",
            note: "Lys",
            durationMinutes: 120,
            breakMinutes: 15,
            billable: true
        )
        let entries = try await store.entries(periodId: period.id)
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries.first?.idempotencyKey, entry.idempotencyKey)
        XCTAssertEqual(entries.first?.activity, entry.activity)
        XCTAssertEqual(entries.first?.note, entry.note)
        XCTAssertEqual(entries.first?.netMinutes, 105)

        let queuedCount = try await database.dbWriter.read { db in
            try OutboxMutation
                .filter(Column("entityId") == entry.idempotencyKey)
                .fetchCount(db)
        }
        XCTAssertEqual(queuedCount, 1)
    }

    func testOnlyOneTimerCanRunPerSignedInAccount() async throws {
        let (store, _, period) = try await makeStore()
        try await store.startTimer(period: period, activity: "Opptak", note: nil)
        do {
            try await store.startTimer(period: period, activity: "Reise", note: nil)
            XCTFail("A second timer should be rejected")
        } catch let error as TimesheetStore.StoreError {
            guard case .timerAlreadyRunning = error else {
                return XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testCachedTimesheetsAreAccountScoped() async throws {
        let (store, database, _) = try await makeStore()
        let other = TimesheetStore(database: database, ownerUserId: "employee-2")
        let ownPeriods = try await store.periods()
        let otherPeriods = try await other.periods()
        let otherTimer = try await other.activeTimer()
        XCTAssertEqual(ownPeriods.count, 1)
        XCTAssertTrue(otherPeriods.isEmpty)
        XCTAssertNil(otherTimer)
    }
}
