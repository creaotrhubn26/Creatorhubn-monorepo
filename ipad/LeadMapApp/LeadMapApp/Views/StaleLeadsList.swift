// StaleLeadsList.swift
//
// Full liste over stille leads sortert eldst først. Tap → åpne
// lead-detail-sheet så brukeren kan logge en oppfølging eller
// markere som tapt.

import SwiftUI

struct StaleLeadsList: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var selectedLead: LeadModel?

    var body: some View {
        NavigationStack {
            Group {
                if let stale = appState.reminders?.staleLeads, !stale.isEmpty {
                    List(stale) { sl in
                        StaleLeadRow(stale: sl)
                            .contentShape(Rectangle())
                            .onTapGesture { openLead(id: sl.id) }
                    }
                    .listStyle(.insetGrouped)
                } else {
                    ContentUnavailableView(
                        "Ingen stille leads",
                        systemImage: "checkmark.circle",
                        description: Text("Bra jobbet! Alle leads har fått oppmerksomhet de siste 7 dagene.")
                    )
                }
            }
            .navigationTitle("Stille leads")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
            .refreshable {
                await appState.refreshAll()
            }
        }
        .sheet(item: $selectedLead) { lead in
            LeadDetailSheet(lead: lead)
        }
    }

    private func openLead(id: String) {
        if let lead = appState.leads.first(where: { $0.id == id }) {
            selectedLead = lead
        }
    }
}

private struct StaleLeadRow: View {
    let stale: StaleLead

    private var daysColor: Color {
        if stale.daysSilent >= 30 { return .red }
        if stale.daysSilent >= 14 { return .yellow }
        return .blue
    }

    var body: some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(daysColor)
                .frame(width: 3)
                .clipShape(Capsule())

            VStack(alignment: .leading, spacing: 2) {
                Text(stale.name).font(.subheadline.bold())
                HStack(spacing: 8) {
                    Text(stale.status.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if let city = stale.city {
                        Text("·").foregroundStyle(.secondary)
                        Text(city).font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            Text("\(stale.daysSilent)d")
                .font(.callout.bold().monospacedDigit())
                .foregroundStyle(daysColor)
        }
        .padding(.vertical, 4)
    }
}
