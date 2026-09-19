import Foundation
import GRDB

/// Thin read-only repository for the "I dag" tab. The surface is
/// deliberately small — a single ``load()`` that returns a full
/// snapshot of what the tab needs — because the photographer reads
/// this panel constantly but mutates nothing here. Mutations happen
/// on the Shoot or Admin tabs.
///
/// We scope everything to the signed-in photographer (``ownerUserId``)
/// so the iPad of a multi-photographer studio never mixes jobs
/// across accounts. Passing the user id explicitly rather than
/// reading it from a global auth store keeps the store trivial to
/// test.
struct TodayStore: Sendable {
    let database: AppDatabase

    // MARK: - Snapshot DTO

    /// Everything the "I dag" tab renders, computed in one query
    /// round so the view doesn't have to stitch together three
    /// independent fetches.
    struct Snapshot: Sendable, Equatable {
        /// Projects flagged active + whose eventDate falls today.
        /// These are the shoots the photographer is working on now.
        let todaysShoots: [Project]
        /// Projects with eventDate within the next 7 days,
        /// excluding today's. Sorted ascending. Shows the week ahead.
        let upcomingWeek: [Project]
        /// The most recent capture session for this owner — in-progress
        /// if `endsAt` is nil, otherwise "last ended at X".
        let mostRecentSession: Session?
        /// Most recent ``project.lastSyncedAt`` across all projects.
        /// Drives the sync-status chip at the top of the tab.
        let lastSyncAt: Date?
    }

    /// Refresh the local read model from the authenticated Capture project API.
    /// Existing detail-only fields are retained because the summary endpoint
    /// intentionally omits client email and the full metadata blob.
    func syncProjects(
        _ summaries: [BackendProjectSummary],
        ownerUserId: String,
        syncedAt: Date = Date()
    ) async throws {
        try await database.dbWriter.write { db in
            for summary in summaries {
                let existing = try Project.fetchOne(db, key: summary.id)
                let counters = summary.shotListSummary
                var project = Project(
                    id: summary.id,
                    ownerUserId: ownerUserId,
                    title: summary.title,
                    clientName: summary.clientName,
                    clientEmail: existing?.ownerUserId == ownerUserId ? existing?.clientEmail : nil,
                    eventDate: Self.parseBackendDate(summary.eventDate),
                    location: summary.location,
                    projectType: summary.projectType,
                    status: summary.status,
                    metadataJson: existing?.ownerUserId == ownerUserId ? existing?.metadataJson ?? "{}" : "{}",
                    totalShots: counters?.totalShots ?? 0,
                    completedShots: counters?.completedShots ?? 0,
                    mustHaveShots: counters?.mustHaveShots ?? 0,
                    completedMustHave: counters?.completedMustHave ?? 0,
                    updatedAt: Self.parseBackendDate(summary.updatedAt) ?? syncedAt,
                    lastSyncedAt: syncedAt,
                )
                try project.save(db)
            }
        }
    }

    /// One-call load. Uses a single GRDB read transaction so the
    /// three sub-queries see a consistent snapshot (not strictly
    /// necessary for this read-mostly surface, but cheap and
    /// future-proofs us against added complexity).
    func load(
        ownerUserId: String,
        now: Date = Date(),
    ) async throws -> Snapshot {
        try await database.dbWriter.read { db in
            let dayRange = Self.dayBounds(for: now)
            let weekEnd = Calendar.current.date(
                byAdding: .day,
                value: 7,
                to: dayRange.start,
            ) ?? dayRange.end

            // Active projects for this owner, fetched once and sliced
            // locally. We'd need dateRange WHERE-filters in SQLite if
            // the photographer had thousands of rows, but nobody has
            // more than ~20 active projects at a time.
            let active = try Project
                .filter(Column("ownerUserId") == ownerUserId)
                .filter(Column("status") == "active"
                    || Column("status") == "in_progress")
                .order(Column("eventDate").asc, Column("updatedAt").desc)
                .fetchAll(db)

            var todays: [Project] = []
            var upcoming: [Project] = []
            for project in active {
                guard let eventDate = project.eventDate else { continue }
                if eventDate >= dayRange.start && eventDate < dayRange.end {
                    todays.append(project)
                } else if eventDate >= dayRange.end && eventDate < weekEnd {
                    upcoming.append(project)
                }
                // Past-dated active projects are intentionally ignored
                // here — they show up in the history view, not "I dag".
            }

            // Most recent session for this owner. "Most recent" by
            // ``startsAt`` desc — session status alone doesn't
            // distinguish a freshly-paused session from one closed
            // three days ago.
            let session = try Session
                .filter(Column("ownerUserId") == ownerUserId)
                .order(Column("startsAt").desc)
                .fetchOne(db)

            // Last sync time across all projects — the one most
            // recently reconciled by the sync engine.
            let lastSync = try Project
                .filter(Column("ownerUserId") == ownerUserId)
                .order(Column("lastSyncedAt").desc)
                .select(Column("lastSyncedAt"))
                .limit(1)
                .fetchOne(db) as Date??

            return Snapshot(
                todaysShoots: todays,
                upcomingWeek: upcoming,
                mostRecentSession: session,
                lastSyncAt: lastSync ?? nil,
            )
        }
    }

    // MARK: - Day math

    /// Returns the [start, end) bounds of ``now``'s local day. Used
    /// for filtering ``eventDate`` to "today". Exposed at module
    /// scope so tests can pin a specific day and exercise the filter
    /// deterministically.
    static func dayBounds(for date: Date) -> (start: Date, end: Date) {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: date)
        let end = calendar.date(byAdding: .day, value: 1, to: start) ?? start
        return (start, end)
    }

    private static func parseBackendDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        if let date = isoFractional.date(from: raw) ?? isoPlain.date(from: raw) {
            return date
        }
        return dateOnly.date(from: raw)
    }

    private nonisolated(unsafe) static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private nonisolated(unsafe) static let isoPlain = ISO8601DateFormatter()

    private nonisolated(unsafe) static let dateOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
