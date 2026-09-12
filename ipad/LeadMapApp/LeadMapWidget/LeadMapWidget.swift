// LeadMapWidget.swift
//
// WidgetKit configuration. Provider leser snapshot fra delt App Group;
// view varierer per familie (small/medium/large).
//
// Snapshot oppdateres av hovedappen etter hver refreshAll
// (WidgetCenter.shared.reloadAllTimelines).

import SwiftUI
import WidgetKit

struct LeadMapWidget: Widget {
    let kind: String = "LeadMapWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SnapshotProvider()) { entry in
            LeadMapWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Lead Map")
        .description("Møter i dag og stille leads som venter på oppfølging.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Entry + Provider

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct SnapshotProvider: TimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry {
        SnapshotEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        let snap = WidgetSnapshotStore.read() ?? .empty
        completion(SnapshotEntry(date: Date(), snapshot: snap))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let snap = WidgetSnapshotStore.read() ?? .empty
        let entry = SnapshotEntry(date: Date(), snapshot: snap)
        // Re-poll filen hver 15 minutt selv om appen ikke har triggret reload
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

// MARK: - Views

struct LeadMapWidgetView: View {
    let entry: SnapshotEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .systemSmall: smallView
        case .systemMedium: mediumView
        case .systemLarge: largeView
        default: smallView
        }
    }

    // MARK: Small

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: "bell.badge.fill")
                    .font(.caption2)
                    .foregroundStyle(severityColor)
                Text(projectLabel)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text("\(totalStale)")
                .font(.system(size: 38, weight: .heavy))
                .foregroundStyle(severityColor)
            Text("stille leads")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            Spacer()
            HStack(spacing: 4) {
                miniBadge("\(entry.snapshot.followUpsDue)", icon: "clock", color: .yellow)
                miniBadge("\(entry.snapshot.meetingsBooked)", icon: "calendar", color: .purple)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    // MARK: Medium

    private var mediumView: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "folder.fill")
                        .font(.caption2)
                        .foregroundStyle(.purple)
                    Text(projectLabel)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text("\(totalStale)")
                    .font(.system(size: 34, weight: .heavy))
                    .foregroundStyle(severityColor)
                Text("stille leads")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.secondary)
                bucketsLine
            }
            .frame(maxHeight: .infinity, alignment: .topLeading)

            Divider()

            VStack(alignment: .leading, spacing: 4) {
                Text("I DAG")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.secondary)
                if entry.snapshot.dueToday.isEmpty {
                    Text("Ingen møter")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                } else {
                    ForEach(Array(entry.snapshot.dueToday.prefix(3).enumerated()), id: \.offset) { _, d in
                        dueRow(d)
                    }
                }
                Spacer()
            }
            .frame(maxHeight: .infinity, alignment: .topLeading)
        }
    }

    // MARK: Large

    private var largeView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "folder.fill")
                    .foregroundStyle(.purple)
                Text(projectLabel)
                    .font(.subheadline.bold())
                Spacer()
                Text("\(entry.snapshot.totalLeads) leads")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 8) {
                bigKpiTile("\(entry.snapshot.followUpsDue)", "Follow-ups", color: .yellow)
                bigKpiTile("\(entry.snapshot.meetingsBooked)", "Møter", color: .purple)
                bigKpiTile("\(totalStale)", "Stille", color: severityColor)
            }
            Divider()
            VStack(alignment: .leading, spacing: 6) {
                Text("KOMMENDE I DAG")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)
                if entry.snapshot.dueToday.isEmpty {
                    Text("Ingen møter eller follow-ups planlagt")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                } else {
                    ForEach(Array(entry.snapshot.dueToday.prefix(5).enumerated()), id: \.offset) { _, d in
                        dueRow(d)
                            .padding(.vertical, 2)
                    }
                }
            }
            Spacer()
        }
    }

    // MARK: - Helpers

    private var projectLabel: String {
        entry.snapshot.activeProjectName ?? "Alle leads"
    }
    private var totalStale: Int {
        entry.snapshot.staleOver30 + entry.snapshot.staleOver14 + entry.snapshot.staleOver7
    }
    private var severityColor: Color {
        if entry.snapshot.staleOver30 > 0 { return .red }
        if entry.snapshot.staleOver14 > 0 { return .yellow }
        if entry.snapshot.staleOver7 > 0 { return .blue }
        return .green
    }

    private var bucketsLine: some View {
        HStack(spacing: 4) {
            if entry.snapshot.staleOver30 > 0 {
                miniBadge("\(entry.snapshot.staleOver30)", icon: "exclamationmark.triangle", color: .red)
            }
            if entry.snapshot.staleOver14 > 0 {
                miniBadge("\(entry.snapshot.staleOver14)", icon: "circle", color: .yellow)
            }
            if entry.snapshot.staleOver7 > 0 {
                miniBadge("\(entry.snapshot.staleOver7)", icon: "circle", color: .blue)
            }
        }
    }

    private func miniBadge(_ text: String, icon: String, color: Color) -> some View {
        HStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 8, weight: .bold))
            Text(text).font(.system(size: 10, weight: .bold))
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 2)
        .background(color.opacity(0.18), in: Capsule())
        .foregroundStyle(color)
    }

    private func dueRow(_ d: WidgetSnapshot.DueItem) -> some View {
        HStack(spacing: 6) {
            if let dt = d.datetime {
                Text(dt, format: .dateTime.hour().minute())
                    .font(.system(size: 11, weight: .bold).monospacedDigit())
                    .foregroundStyle(.purple)
                    .frame(width: 38, alignment: .leading)
            }
            Text(d.leadName)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)
            Spacer()
        }
    }

    private func bigKpiTile(_ value: String, _ label: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }
}
