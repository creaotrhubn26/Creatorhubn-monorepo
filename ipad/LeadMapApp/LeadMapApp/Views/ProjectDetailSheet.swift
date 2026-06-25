// ProjectDetailSheet.swift
//
// Full bottom-sheet med prosjekt-detaljer. Vises når brukeren tar opp
// MapProjectCard. Tilbyr seksjoner:
//   • Status (aktiv rute, leads totalt, momentum)
//   • Lead-liste (komprimert, sortert på Claude-rangering)
//   • Dagens rute (stop-by-stop)
//   • Team-aktivitet
//   • Neste handling
//
// Bruker presentationDetents([.medium, .large]) så brukeren kan sveipe
// mellom kompakt og full visning.

import SwiftUI

struct ProjectDetailSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    var onOpenLead: (LeadModel) -> Void
    var onStartRoute: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    summarySection
                    if appState.dayRoute != nil {
                        routeSection
                    }
                    nextActionSection
                    teamSection
                    leadsSection
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground).ignoresSafeArea())
            .navigationTitle(titleLine)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
    }

    private var titleLine: String {
        appState.activeProjectSummary?.project.name
            ?? appState.projects.first(where: { $0.id == appState.activeProjectId })?.name
            ?? "Alle leads"
    }

    // MARK: - Summary

    @ViewBuilder
    private var summarySection: some View {
        HStack(spacing: 12) {
            summaryTile(
                value: "\(appState.workloadLeads.count)",
                label: "Mine leads",
                tint: Color(red: 0.66, green: 0.32, blue: 0.99),
                icon: "person.3.fill"
            )
            summaryTile(
                value: "\(appState.dayRoute?.stops.count ?? 0)",
                label: "Stopp i rute",
                tint: Color(red: 0.30, green: 0.92, blue: 0.55),
                icon: "point.topleft.down.to.point.bottomright.curvepath"
            )
            summaryTile(
                value: "\(appState.metrics?.meetingsBooked ?? 0)",
                label: "Møter",
                tint: Color(red: 0.98, green: 0.79, blue: 0.30),
                icon: "calendar"
            )
        }
    }

    private func summaryTile(value: String, label: String, tint: Color, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: icon).foregroundStyle(tint)
                Spacer()
            }
            Text(value).font(.title2.bold())
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Route

    @ViewBuilder
    private var routeSection: some View {
        if let route = appState.dayRoute {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label("Dagens rute", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                        .font(.subheadline.bold())
                    Spacer()
                    Text("\(route.totalDriveSeconds / 60) min")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                }
                ForEach(route.stops) { stop in
                    HStack(spacing: 8) {
                        Text("\(stop.position)")
                            .font(.caption.bold())
                            .frame(width: 22, height: 22)
                            .background(Color.green.opacity(0.2), in: Circle())
                            .foregroundStyle(.green)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(stop.name ?? "Stopp \(stop.position)")
                                .font(.caption.bold())
                            if stop.driveSecondsFromPrevious > 0 {
                                Text("\(stop.driveSecondsFromPrevious / 60) min unna forrige")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                    }
                    .padding(.vertical, 2)
                }
            }
            .padding()
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Next action

    @ViewBuilder
    private var nextActionSection: some View {
        if let lead = nextLead {
            VStack(alignment: .leading, spacing: 6) {
                Label("Neste handling", systemImage: "sparkles")
                    .font(.caption.bold())
                    .foregroundStyle(.purple)
                Button {
                    if let model = appState.leads.first(where: { $0.id == lead.id }) {
                        dismiss()
                        onOpenLead(model)
                    }
                } label: {
                    HStack {
                        Text(lead.name).font(.subheadline.bold())
                        if let reason = lead.claudeRecommendationReason {
                            Text("·")
                            Text(reason).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(Color.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                Button {
                    dismiss()
                    onStartRoute()
                } label: {
                    HStack {
                        Image(systemName: "play.fill")
                        Text("Start rute fra her")
                    }
                    .font(.caption.bold())
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Color.purple, in: Capsule())
                    .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Team

    @ViewBuilder
    private var teamSection: some View {
        if !appState.memberLocations.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Label("Team i felt", systemImage: "person.2.fill").font(.subheadline.bold())
                ForEach(appState.memberLocations) { m in
                    HStack {
                        Circle()
                            .fill(Color(red: 0.30, green: 0.92, blue: 0.55))
                            .frame(width: 8, height: 8)
                        Text(m.displayName ?? m.role).font(.caption.bold())
                        Text(m.role).font(.caption2).foregroundStyle(.secondary)
                        Spacer()
                    }
                }
            }
            .padding()
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Leads

    @ViewBuilder
    private var leadsSection: some View {
        if !appState.workloadLeads.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Label("Topp prioritert", systemImage: "list.star").font(.subheadline.bold())
                ForEach(appState.workloadLeads.prefix(8)) { lead in
                    Button {
                        if let model = appState.leads.first(where: { $0.id == lead.id }) {
                            dismiss()
                            onOpenLead(model)
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Text("#\(lead.claudeRecommendationRank ?? 0)")
                                .font(.caption2.bold())
                                .frame(width: 28)
                                .foregroundStyle(.purple)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(lead.name).font(.caption.bold())
                                if let city = lead.city {
                                    Text(city).font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if let km = lead.distanceKm {
                                Text(formatKm(km)).font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                    Divider()
                }
            }
            .padding()
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private var nextLead: WorkloadLead? {
        appState.workloadLeads.first {
            ($0.claudeRecommendationRank ?? 9999) <= 5
        } ?? appState.workloadLeads.first
    }

    private func formatKm(_ km: Double) -> String {
        if km < 1 { return "\(Int(km * 1000)) m" }
        return String(format: "%.1f km", km)
    }
}
