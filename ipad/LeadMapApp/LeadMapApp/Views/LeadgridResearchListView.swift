// LeadgridResearchListView.swift
//
// Dedikert inngang fra LeadgridHubView ("Research"-seksjonen). Lister
// markedssjefens tildelte kunder slik at man kan tappe rett inn i
// LeadgridResearchView for å kjøre/se AI-research.
//
// Vi gjenbruker fetchMyAssignments fra LeadgridLeadInboxView slik at
// listen alltid speiler det som faktisk er ens portefølje.

import SwiftUI

struct LeadgridResearchListView: View {
    let api: APIClient

    @State private var assignments: [MyAssignmentItem] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var selected: ResearchTarget?

    private struct ResearchTarget: Identifiable {
        let id: String
        let name: String
    }

    var body: some View {
        List {
            Section {
                Label(
                    "Trykk på en kunde for å kjøre AI-research med Claude — SWOT, beslutningstakere, foreslått første-touch.",
                    systemImage: "info.circle"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            if loading && assignments.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if assignments.isEmpty {
                ContentUnavailableView(
                    "Ingen tildelte kunder",
                    systemImage: "tray",
                    description: Text("Du har ingen tildelte kunder å kjøre research på.")
                )
                .listRowBackground(Color.clear)
            } else {
                Section("Mine kunder (\(assignments.count))") {
                    ForEach(assignments) { item in
                        Button {
                            selected = ResearchTarget(id: item.id, name: item.name)
                        } label: {
                            row(item)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red) }
            }
        }
        .navigationTitle("AI-research")
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $selected) { target in
            LeadgridResearchView(
                leadId: target.id,
                leadName: target.name,
                api: api
            )
        }
    }

    @ViewBuilder
    private func row(_ item: MyAssignmentItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "sparkles.rectangle.stack")
                .foregroundStyle(.purple)
                .font(.title3)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.headline)
                HStack(spacing: 6) {
                    if let cat = item.leadCategory, !cat.isEmpty {
                        tierChip(cat)
                    }
                    Text(item.status)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if let score = item.aiOpportunityScore {
                        Text("Score \(score)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }

    private func tierMeta(_ tier: String) -> (text: String, color: Color) {
        switch tier {
        case "hot":  return ("HOT", .red)
        case "warm": return ("WARM", .orange)
        case "cool": return ("COOL", .blue)
        default:     return (tier.uppercased(), .gray)
        }
    }

    @ViewBuilder
    private func tierChip(_ tier: String) -> some View {
        let meta = tierMeta(tier)
        Text(meta.text)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(meta.color.opacity(0.20), in: Capsule())
            .foregroundStyle(meta.color)
    }

    @MainActor
    private func load() async {
        do {
            let resp = try await api.fetchMyAssignments()
            assignments = resp.items
            loading = false
        } catch {
            errorText = "Kunne ikke laste: \(error.localizedDescription)"
            loading = false
        }
    }
}
