import SwiftUI
import UIKit

/// "I dag" — the first tab the photographer sees on app open.
/// Purpose: answer "what am I shooting right now and what's next?"
/// in a single glance. Not a full dashboard — one scannable card
/// stack.
///
/// Content stack, top to bottom:
///   1. Sync-status chip (connected / synced X min ago / offline)
///   2. Today's shoots — full-width cards, one per active job
///      with eventDate today.
///   3. Upcoming this week — compact rows for the next 7 days.
///   4. Recent session — if the photographer was in the middle of
///      a shoot when the app last closed, this row brings them
///      right back to it.
///
/// Data comes from ``TodayStore`` which reads the v3 ``project`` and
/// ``session`` tables. When no local data exists (fresh install or
/// post-migration), the empty state asks the photographer to pull
/// from CreatorHub. The actual pull will be wired when the sync
/// engine gets its URLSession-backed sender (task #47).
struct TodayView: View {
    @State private var snapshot: TodayStore.Snapshot?
    @State private var loadError: String?
    @State private var isLoading = false

    /// The signed-in photographer. For now we hard-code a dev owner
    /// so the tab is runnable in simulator immediately; the real
    /// wiring plugs in the value from the auth service once that
    /// bridge lands (task #47).
    var ownerUserId: String = "dev-owner"

    private var store: TodayStore? {
        do {
            let url = try AppDatabase.defaultDiskURL()
            let db = try AppDatabase.openOnDisk(at: url)
            return TodayStore(database: db)
        } catch {
            return nil
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    syncStatusRow
                    todaysSection
                    upcomingSection
                    recentSessionSection
                }
                .padding(20)
            }
            .navigationTitle("I dag")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Task { await load() }
                    } label: {
                        if isLoading {
                            ProgressView()
                        } else {
                            Label("Last inn på nytt", systemImage: "arrow.clockwise")
                        }
                    }
                    .disabled(isLoading)
                }
            }
            .task { await load() }
        }
    }

    // MARK: - Sections

    private var syncStatusRow: some View {
        HStack(spacing: 8) {
            if let lastSync = snapshot?.lastSyncAt {
                Circle()
                    .fill(.green)
                    .frame(width: 8, height: 8)
                Text("Synkronisert \(Self.relativeTime(lastSync))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Circle()
                    .fill(.orange)
                    .frame(width: 8, height: 8)
                Text("Ingen sync ennå — dra for å hente fra CreatorHub")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    private var todaysSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Dagens shoots", systemImage: "camera.aperture")

            if let error = loadError {
                errorCard(error)
            } else if let shoots = snapshot?.todaysShoots, !shoots.isEmpty {
                ForEach(shoots, id: \.id) { project in
                    NavigationLink {
                        ShotListView(
                            projectId: project.id,
                            ownerUserId: ownerUserId,
                        )
                    } label: {
                        TodayProjectCard(project: project)
                    }
                    .buttonStyle(.plain)
                }
            } else if snapshot != nil {
                emptyState(
                    icon: "sun.max",
                    title: "Ingen jobber i dag",
                    detail: "Nyt pausen ☕",
                )
            } else {
                ProgressView().frame(maxWidth: .infinity, alignment: .center)
            }
        }
    }

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Denne uken", systemImage: "calendar")

            if let upcoming = snapshot?.upcomingWeek, !upcoming.isEmpty {
                ForEach(upcoming, id: \.id) { project in
                    UpcomingRow(project: project)
                        .padding(.vertical, 6)
                    Divider()
                }
            } else if snapshot != nil {
                emptyState(
                    icon: "calendar.badge.plus",
                    title: "Ingenting booket de neste 7 dagene",
                    detail: nil,
                )
            }
        }
    }

    @ViewBuilder
    private var recentSessionSection: some View {
        if let session = snapshot?.mostRecentSession {
            VStack(alignment: .leading, spacing: 12) {
                sectionHeader("Sist aktive shoot", systemImage: "clock.arrow.circlepath")
                NavigationLink {
                    LiveCullView(
                        sessionId: session.id,
                        ownerUserId: ownerUserId,
                    )
                } label: {
                    RecentSessionCard(session: session)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Helpers

    private func sectionHeader(_ title: String, systemImage: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .foregroundStyle(.secondary)
            Text(title)
                .font(.title3.weight(.semibold))
        }
    }

    private func errorCard(_ error: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Kunne ikke laste", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(error)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.red.opacity(0.08)))
    }

    private func emptyState(icon: String, title: String, detail: String?) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(.tertiary)
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if let detail {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
        )
    }

    private func load() async {
        guard let store else {
            loadError = "Database ikke tilgjengelig"
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            snapshot = try await store.load(ownerUserId: ownerUserId)
            loadError = nil
        } catch {
            loadError = String(describing: error)
        }
    }

    /// Human-readable "2 min ago" / "4 h ago" / "yesterday". Used for
    /// the sync-status chip; the same formatter is used in multiple
    /// surfaces so it lives here as a static utility.
    static func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        formatter.locale = Locale(identifier: "nb_NO")
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Cards

private struct TodayProjectCard: View {
    let project: Project

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.title)
                        .font(.headline)
                    if let client = project.clientName {
                        Text(client)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if let date = project.eventDate {
                    Text(date.formatted(.dateTime.hour().minute()))
                        .font(.title3.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }

            if let location = project.location {
                Label(location, systemImage: "mappin.and.ellipse")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Shot list progress bar — the only real action-item the
            // photographer needs to glance at: how many must-haves
            // are still outstanding. Driven by the denormalised
            // counters populated by the sync engine.
            if project.mustHaveShots > 0 {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Must-have shots")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text("\(project.completedMustHave)/\(project.mustHaveShots)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    ProgressView(
                        value: Double(project.completedMustHave),
                        total: Double(max(1, project.mustHaveShots)),
                    )
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(uiColor: .secondarySystemBackground))
                .shadow(color: .black.opacity(0.06), radius: 6, y: 3)
        )
    }
}

private struct UpcomingRow: View {
    let project: Project

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                if let date = project.eventDate {
                    Text(date.formatted(.dateTime.weekday(.abbreviated)))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(date.formatted(.dateTime.day().month(.abbreviated)))
                        .font(.subheadline.bold())
                }
            }
            .frame(width: 60, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(project.title)
                    .font(.subheadline)
                if let client = project.clientName {
                    Text(client)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
    }
}

private struct RecentSessionCard: View {
    let session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(session.name)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                SessionStatusChip(status: session.status)
            }
            HStack(spacing: 8) {
                Image(systemName: "clock")
                    .foregroundStyle(.secondary)
                Text(session.startsAt.formatted(.relative(presentation: .named)))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.primary.opacity(0.04))
        )
    }
}

private struct SessionStatusChip: View {
    let status: Session.Status
    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.vertical, 3)
            .padding(.horizontal, 8)
            .background(Capsule().fill(color.opacity(0.15)))
            .foregroundStyle(color)
    }
    private var label: String {
        switch status {
        case .active: return "Pågår"
        case .paused: return "Pauset"
        case .closed: return "Avsluttet"
        }
    }
    private var color: Color {
        switch status {
        case .active: return .green
        case .paused: return .orange
        case .closed: return .secondary
        }
    }
}
