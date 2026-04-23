import XCTest
@testable import CaptureApp

/// Tests for the "I dag" data store. All run against an in-memory
/// GRDB so there's no filesystem coupling — seed rows, load snapshot,
/// assert the snapshot contains the right slices.
///
/// What we verify:
///   - Only projects owned by the signed-in user appear (no cross-
///     user leakage on shared iPads).
///   - Only ``active`` / ``in_progress`` projects are considered;
///     drafts and completed don't show up.
///   - Today / upcoming-week bucketing respects the calendar-day
///     boundary, not a naive 24h window — a shoot booked for 23:30
///     tonight is "today", not "tomorrow".
///   - Past-dated active projects are ignored (they belong in
///     history, not "I dag").
///   - mostRecentSession picks the ``startsAt`` desc winner, not
///     some other ordering.
///   - lastSyncAt surfaces the most recent ``project.lastSyncedAt``,
///     nil when nothing's ever synced.
///   - Empty database returns all-empty arrays + nil scalars, not
///     a thrown error.
final class TodayStoreTests: XCTestCase {

    // MARK: - Fixtures

    private let owner = "photographer-1"
    private let other = "photographer-2"

    private func makeDatabase() throws -> AppDatabase {
        try AppDatabase.inMemory()
    }

    private func insertProject(
        _ db: AppDatabase,
        id: String,
        owner: String,
        status: String,
        eventDate: Date?,
        title: String = "Bryllup",
        mustHave: Int = 0,
        completedMustHave: Int = 0,
        lastSyncedAt: Date? = nil,
    ) async throws {
        let project = Project(
            id: id,
            ownerUserId: owner,
            title: title,
            clientName: nil,
            clientEmail: nil,
            eventDate: eventDate,
            location: nil,
            projectType: nil,
            status: status,
            metadataJson: "{}",
            totalShots: 0,
            completedShots: 0,
            mustHaveShots: mustHave,
            completedMustHave: completedMustHave,
            updatedAt: Date(),
            lastSyncedAt: lastSyncedAt,
        )
        try await db.dbWriter.write { db in
            try project.insert(db)
        }
    }

    private func insertSession(
        _ db: AppDatabase,
        id: UUID = UUID(),
        owner: String,
        startsAt: Date,
        name: String = "Session",
    ) async throws {
        let session = Session(
            id: id,
            name: name,
            clientId: nil,
            startsAt: startsAt,
            endsAt: nil,
            status: .active,
            ownerUserId: owner,
            createdAt: startsAt,
            updatedAt: startsAt,
        )
        try await db.dbWriter.write { db in
            try session.insert(db)
        }
    }

    // MARK: - Empty database

    func testEmptyDatabaseReturnsAllEmpty() async throws {
        let db = try makeDatabase()
        let store = TodayStore(database: db)
        let snap = try await store.load(ownerUserId: owner)
        XCTAssertTrue(snap.todaysShoots.isEmpty)
        XCTAssertTrue(snap.upcomingWeek.isEmpty)
        XCTAssertNil(snap.mostRecentSession)
        XCTAssertNil(snap.lastSyncAt)
    }

    // MARK: - Today filter

    func testTodayBucketsAnyTimeOnCurrentCalendarDay() async throws {
        let db = try makeDatabase()
        let today = Date()
        let startOfDay = TodayStore.dayBounds(for: today).start
        let almostMidnight = startOfDay.addingTimeInterval(23 * 60 * 60 + 55 * 60)

        try await insertProject(db, id: "p1", owner: owner,
                                status: "active",
                                eventDate: almostMidnight,
                                title: "Late-ceremony")
        let store = TodayStore(database: db)
        let snap = try await store.load(ownerUserId: owner, now: today)

        XCTAssertEqual(snap.todaysShoots.map(\.id), ["p1"],
            "23:55 today must bucket as today, not tomorrow")
    }

    func testPastActiveProjectsExcludedFromToday() async throws {
        let db = try makeDatabase()
        let yesterday = Date().addingTimeInterval(-24 * 60 * 60)
        try await insertProject(db, id: "past", owner: owner,
                                status: "active",
                                eventDate: yesterday)
        let store = TodayStore(database: db)
        let snap = try await store.load(ownerUserId: owner)
        XCTAssertTrue(snap.todaysShoots.isEmpty,
            "past-dated projects belong in history, not I dag")
        XCTAssertTrue(snap.upcomingWeek.isEmpty)
    }

    // MARK: - Upcoming week

    func testUpcomingBucketsNextSevenDaysAscending() async throws {
        let db = try makeDatabase()
        let today = Date()
        let in3Days = today.addingTimeInterval(3 * 24 * 60 * 60)
        let in5Days = today.addingTimeInterval(5 * 24 * 60 * 60)
        let in9Days = today.addingTimeInterval(9 * 24 * 60 * 60)
        try await insertProject(db, id: "far", owner: owner, status: "active",
                                eventDate: in9Days, title: "Far")
        try await insertProject(db, id: "close", owner: owner, status: "active",
                                eventDate: in3Days, title: "Close")
        try await insertProject(db, id: "mid", owner: owner, status: "active",
                                eventDate: in5Days, title: "Mid")

        let store = TodayStore(database: db)
        let snap = try await store.load(ownerUserId: owner, now: today)

        XCTAssertEqual(snap.upcomingWeek.map(\.id), ["close", "mid"],
            "week view excludes day-9 entries and sorts ascending")
    }

    // MARK: - Ownership + status filter

    func testOtherOwnersAreInvisible() async throws {
        let db = try makeDatabase()
        let today = Date()
        try await insertProject(db, id: "mine", owner: owner,
                                status: "active", eventDate: today)
        try await insertProject(db, id: "theirs", owner: other,
                                status: "active", eventDate: today)
        let snap = try await TodayStore(database: db).load(ownerUserId: owner, now: today)
        XCTAssertEqual(snap.todaysShoots.map(\.id), ["mine"])
    }

    func testNonActiveStatusesIgnored() async throws {
        let db = try makeDatabase()
        let today = Date()
        try await insertProject(db, id: "draft", owner: owner,
                                status: "draft", eventDate: today)
        try await insertProject(db, id: "completed", owner: owner,
                                status: "completed", eventDate: today)
        try await insertProject(db, id: "ok", owner: owner,
                                status: "active", eventDate: today)
        let snap = try await TodayStore(database: db).load(ownerUserId: owner, now: today)
        XCTAssertEqual(snap.todaysShoots.map(\.id), ["ok"])
    }

    func testInProgressAndActiveBothShowUp() async throws {
        let db = try makeDatabase()
        let today = Date()
        try await insertProject(db, id: "a", owner: owner,
                                status: "active", eventDate: today, title: "Active")
        try await insertProject(db, id: "b", owner: owner,
                                status: "in_progress", eventDate: today, title: "In progress")
        let snap = try await TodayStore(database: db).load(ownerUserId: owner, now: today)
        XCTAssertEqual(Set(snap.todaysShoots.map(\.id)), ["a", "b"])
    }

    // MARK: - Recent session

    func testMostRecentSessionPicksStartsAtDescWinner() async throws {
        let db = try makeDatabase()
        let owner = self.owner
        try await insertSession(db, owner: owner,
                                startsAt: Date().addingTimeInterval(-2 * 3600),
                                name: "Older")
        try await insertSession(db, owner: owner,
                                startsAt: Date().addingTimeInterval(-30 * 60),
                                name: "Newer")

        let snap = try await TodayStore(database: db).load(ownerUserId: owner)
        XCTAssertEqual(snap.mostRecentSession?.name, "Newer")
    }

    func testMostRecentSessionScopedToOwner() async throws {
        let db = try makeDatabase()
        try await insertSession(db, owner: other,
                                startsAt: Date(),
                                name: "Other photographer's session")
        let snap = try await TodayStore(database: db).load(ownerUserId: owner)
        XCTAssertNil(snap.mostRecentSession,
            "sessions from other owners must not leak to our I dag")
    }

    // MARK: - Last sync

    func testLastSyncSurfacesMostRecentProjectSync() async throws {
        let db = try makeDatabase()
        let today = Date()
        let oneHourAgo = today.addingTimeInterval(-3600)
        let tenMinAgo = today.addingTimeInterval(-10 * 60)

        try await insertProject(db, id: "old", owner: owner, status: "active",
                                eventDate: today, lastSyncedAt: oneHourAgo)
        try await insertProject(db, id: "new", owner: owner, status: "active",
                                eventDate: today, lastSyncedAt: tenMinAgo)

        let snap = try await TodayStore(database: db).load(ownerUserId: owner, now: today)
        XCTAssertNotNil(snap.lastSyncAt)
        if let last = snap.lastSyncAt {
            XCTAssertEqual(
                last.timeIntervalSince1970,
                tenMinAgo.timeIntervalSince1970,
                accuracy: 1,
                "lastSyncAt must be the freshest, not the oldest",
            )
        }
    }

    func testLastSyncNilWhenNoProjectEverSynced() async throws {
        let db = try makeDatabase()
        try await insertProject(db, id: "fresh", owner: owner, status: "active",
                                eventDate: Date(), lastSyncedAt: nil)
        let snap = try await TodayStore(database: db).load(ownerUserId: owner)
        XCTAssertNil(snap.lastSyncAt)
    }

    // MARK: - Day bounds math

    func testDayBoundsAreExactly24Hours() {
        let d = Date()
        let bounds = TodayStore.dayBounds(for: d)
        let diff = bounds.end.timeIntervalSince(bounds.start)
        // Be tolerant to DST transitions — a spring-forward day is
        // 23h, fall-back is 25h. For a non-DST day the diff is 86400.
        XCTAssertGreaterThanOrEqual(diff, 23 * 3600)
        XCTAssertLessThanOrEqual(diff, 25 * 3600)
    }

    func testDayBoundsStartIsStartOfDay() {
        let anyTime = Date()
        let bounds = TodayStore.dayBounds(for: anyTime)
        let components = Calendar.current.dateComponents([.hour, .minute, .second], from: bounds.start)
        XCTAssertEqual(components.hour, 0)
        XCTAssertEqual(components.minute, 0)
        XCTAssertEqual(components.second, 0)
    }
}
