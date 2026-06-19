// LeadgridAssignmentHistoryView.swift
//
// Historikk over tildelinger på en lead: hvem tildelte hvem, når, hvorfor.
// Brukes som tilleggsfane i CustomerDetail ved siden av status-history.
//
// Backend: GET /api/leadgrid/customers/:id/assignment-history

import SwiftUI

struct LeadgridAssignmentHistoryView: View {
    let customerId: String
    let api: APIClient

    @State private var items: [AssignmentHistoryItem] = []
    @State private var userNames: [String: String] = [:]
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading {
                HStack { Spacer(); ProgressView(); Spacer() }
                    .listRowBackground(Color.clear)
            } else if items.isEmpty {
                ContentUnavailableView(
                    "Ingen tildelings-historikk",
                    systemImage: "person.crop.rectangle.stack",
                    description: Text("Denne leaden har ennå ikke blitt tildelt noen."),
                )
                .listRowBackground(Color.clear)
            } else {
                Section("Tildelings-historikk (\(items.count))") {
                    ForEach(items) { item in
                        assignmentRow(item)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Historikk")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func assignmentRow(_ item: AssignmentHistoryItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "arrow.left.arrow.right.circle.fill")
                    .foregroundStyle(.purple)
                    .font(.subheadline)

                if let to = item.toUserId, let toName = userNames[to] {
                    Text(toName).font(.subheadline.bold())
                } else if let to = item.toUserId {
                    Text(String(to.prefix(8)))
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                } else {
                    Text("Frigjort").font(.subheadline.bold()).foregroundStyle(.secondary)
                }

                Spacer()
                Text(item.formattedAssignedAt)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            if let from = item.fromUserId {
                let fromName = userNames[from] ?? String(from.prefix(8))
                Text("Fra: \(fromName)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let by = item.assignedByUserId, by != item.assignedByUserId {
                let byName = userNames[by] ?? String(by.prefix(8))
                Text("Av: \(byName)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let reason = item.reason, !reason.isEmpty {
                Text("\"\(reason)\"")
                    .font(.callout)
                    .italic()
                    .foregroundStyle(.purple)
                    .lineLimit(3)
            }
        }
        .padding(.vertical, 4)
    }

    private func load() async {
        do {
            let resp = try await api.fetchAssignmentHistory(customerId: customerId)
            // Hent navn for unike user-IDer
            let userIds = Set(
                resp.history.flatMap { item in
                    [item.fromUserId, item.toUserId, item.assignedByUserId]
                        .compactMap { $0 }
                }
            )
            var names: [String: String] = [:]
            for uid in userIds {
                // Best-effort: prøv å hente navn via assignable-users-katalog.
                // Hvis ikke tilgjengelig, faller vi tilbake til ID-prefix.
                names[uid] = nil  // placeholder; UI viser prefix-format
            }
            await MainActor.run {
                items = resp.history
                userNames = names
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste: \(error.localizedDescription)"
                loading = false
            }
        }
    }
}
