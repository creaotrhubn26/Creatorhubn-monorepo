// LeadgridLeadInboxView.swift
//
// Nye leads fra book-demo/kontakt-skjema m/ Claude-auto-research.
// Markedssjef ser HOT/WARM/COOL-tier + claude-summary + 'Godta + tildel'.

import SwiftUI

struct LeadgridLeadInboxView: View {
    let api: APIClient
    @State private var assignments: [MyAssignmentItem] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && assignments.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if assignments.isEmpty {
                ContentUnavailableView(
                    "Ingen tildelte leads",
                    systemImage: "tray",
                    description: Text("Du har ingen tildelte leads akkurat nå."),
                )
                .listRowBackground(Color.clear)
            } else {
                Section("Mine tildelte leads (\(assignments.count))") {
                    ForEach(assignments) { item in
                        assignmentRow(item)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Lead-inbox")
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            let resp = try await api.fetchMyAssignments()
            await MainActor.run {
                assignments = resp.items
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste: \(error.localizedDescription)"
                loading = false
            }
        }
    }

    @ViewBuilder
    private func assignmentRow(_ item: MyAssignmentItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                tierChip(item.leadCategory)
                statusChip(item.status)
                Spacer()
                if let score = item.aiOpportunityScore {
                    Text("Score: \(score)").font(.caption2).foregroundStyle(.secondary)
                }
            }
            Text(item.name)
                .font(.headline)
            if let proj = item.projectName, !proj.isEmpty {
                Text(proj)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let note = item.assignmentNote, !note.isEmpty {
                Text("\"\(note)\"")
                    .font(.callout)
                    .italic()
                    .foregroundStyle(.purple)
                    .lineLimit(2)
            }
            HStack(spacing: 12) {
                if item.repFirstOpenedAt != nil || item.teamLeaderFirstOpenedAt != nil {
                    Label("Sett", systemImage: "eye.fill")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.green.opacity(0.20), in: Capsule())
                        .foregroundStyle(.green)
                } else {
                    Label("Ikke sett", systemImage: "clock")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.orange.opacity(0.20), in: Capsule())
                        .foregroundStyle(.orange)
                }
                if let last = item.lastActionAt {
                    Text("Sist handling: \(formatRelative(last))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func tierChip(_ tier: String?) -> some View {
        switch tier {
        case "hot":
            Label("HOT", systemImage: "flame.fill")
                .font(.caption2.bold())
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.red.opacity(0.20), in: Capsule())
                .foregroundStyle(.red)
        case "warm":
            Label("WARM", systemImage: "thermometer.sun.fill")
                .font(.caption2.bold())
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.orange.opacity(0.20), in: Capsule())
                .foregroundStyle(.orange)
        case "cool":
            Label("COOL", systemImage: "snowflake")
                .font(.caption2.bold())
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.blue.opacity(0.20), in: Capsule())
                .foregroundStyle(.blue)
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private func statusChip(_ status: String) -> some View {
        if let s = LeadgridCrmStatus(rawValue: status) {
            Label(s.label, systemImage: s.systemIcon)
                .font(.caption2.bold())
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(s.color.opacity(0.20), in: Capsule())
                .foregroundStyle(s.color)
        } else {
            Text(status).font(.caption2)
        }
    }

    private func formatRelative(_ iso: String) -> String {
        let f1 = ISO8601DateFormatter()
        f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let d = f1.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return iso
        }
        let mins = Int(Date().timeIntervalSince(d) / 60)
        if mins < 60 { return "\(mins)m" }
        if mins < 24 * 60 { return "\(mins / 60)t" }
        return "\(mins / 1440)d"
    }
}
