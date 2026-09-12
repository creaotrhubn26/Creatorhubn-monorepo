// RemindersBanner.swift
//
// Banner-overlay som vises øverst på MapScreen hvis totalStale > 0.
// Tap → åpne StaleLeadsList. Farge-koding: rød hvis 30+ dager, gul
// hvis 14+, blå hvis 7+.

import SwiftUI

struct RemindersBanner: View {
    @Environment(AppState.self) private var appState
    @State private var staleListShown = false

    var body: some View {
        if let reminders = appState.reminders,
           reminders.totalStale > 0 || !reminders.dueToday.isEmpty {
            content(for: reminders)
                .onTapGesture {
                    staleListShown = true
                }
                .sheet(isPresented: $staleListShown) {
                    StaleLeadsList()
                }
        }
    }

    @ViewBuilder
    private func content(for r: RemindersResponse) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "bell.badge.fill")
                .font(.title3)
                .foregroundStyle(severityColor(for: r))

            VStack(alignment: .leading, spacing: 2) {
                Text(r.totalStale > 0
                     ? "\(r.totalStale) leads venter på oppmerksomhet"
                     : "\(r.dueToday.count) follow-ups i dag")
                .font(.subheadline.bold())

                HStack(spacing: 6) {
                    if r.buckets.over30days > 0 {
                        bucketChip("\(r.buckets.over30days) over 30d", color: .red)
                    }
                    if r.buckets.over14days > 0 {
                        bucketChip("\(r.buckets.over14days) over 14d", color: .yellow)
                    }
                    if r.buckets.over7days > 0 {
                        bucketChip("\(r.buckets.over7days) over 7d", color: .blue)
                    }
                    if !r.dueToday.isEmpty {
                        bucketChip("\(r.dueToday.count) i dag", color: .green)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(severityColor(for: r).opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(severityColor(for: r).opacity(0.4), lineWidth: 1)
        )
        .padding(.horizontal, 12)
    }

    private func bucketChip(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.18))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private func severityColor(for r: RemindersResponse) -> Color {
        if r.buckets.over30days > 0 { return .red }
        if r.buckets.over14days > 0 { return .yellow }
        return .blue
    }
}
