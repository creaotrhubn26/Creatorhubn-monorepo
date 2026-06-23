// LeadgridPipelineKanbanView.swift
//
// Horisontal kanban over 8 pipeline-stages fra mig 313 — new, first_contact,
// qualified, meeting, proposal, negotiation, won, lost. Hver kolonne viser
// antall leads + sum forventet verdi + sorterte lead-kort.
//
// PR #855 har ikke et /pipeline-endepunkt — for nå deriver vi unike leads fra
// NBA-recommendations + fetchLeadIntelligence per lead. Drag-and-drop er
// utelatt (krever PATCH /pipeline-stage som ikke finnes ennå); tap kort →
// sheet m/ lead-info (stage-picker kan kobles på senere).

import SwiftUI

struct LeadgridPipelineKanbanView: View {
    let api: APIClient
    @State private var leads: [LeadIntelligenceLead] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var selected: LeadIntelligenceLead?

    private let stages: [(key: String, label: String, color: Color)] = [
        ("new",           "Ny",            .gray),
        ("first_contact", "Først-kontakt", .blue),
        ("qualified",     "Kvalifisert",   .indigo),
        ("meeting",       "Møte",          .purple),
        ("proposal",      "Tilbud",        .orange),
        ("negotiation",   "Forhandling",   .yellow),
        ("won",           "Vunnet",        .green),
        ("lost",          "Tapt",          .red),
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: true) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(stages, id: \.key) { stage in
                    column(for: stage)
                }
            }
            .padding()
        }
        .navigationTitle("Pipeline")
        .task { await load() }
        .refreshable { await load() }
        .onReceive(NotificationCenter.default.publisher(for: .leadgridRealtimeEvent)) { notif in
            guard let info = notif.userInfo as? [String: String],
                  let type = info["type"] else { return }
            if type == "lead.scored" || type == "nba.updated" {
                Task { await load() }
            }
        }
        .overlay {
            if loading && leads.isEmpty {
                ProgressView().controlSize(.large)
            }
            if let errorText, leads.isEmpty {
                ContentUnavailableView(
                    "Kunne ikke laste pipeline",
                    systemImage: "exclamationmark.triangle",
                    description: Text(errorText))
            }
        }
        .sheet(item: $selected) { lead in
            NavigationStack {
                ScrollView {
                    LeadgridIntelligencePanel(api: api, leadId: lead.id)
                        .padding()
                }
                .navigationTitle(lead.name)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Lukk") { selected = nil }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func column(for stage: (key: String, label: String, color: Color)) -> some View {
        let inStage = leads.filter { $0.pipelineStage == stage.key }
        let totalEV = inStage.compactMap { $0.expectedValue }.reduce(0, +)

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle().fill(stage.color).frame(width: 10, height: 10)
                Text(stage.label).font(.headline)
                Spacer()
                Text("\(inStage.count)")
                    .font(.caption.bold())
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(stage.color.opacity(0.2), in: Capsule())
                    .foregroundStyle(stage.color)
            }
            if totalEV > 0 {
                Text("\(Int(totalEV)) kr forventet")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(inStage.sorted(by: { ($0.followUpPriority ?? 0) > ($1.followUpPriority ?? 0) })) { lead in
                        Button {
                            selected = lead
                        } label: {
                            card(lead, accent: stage.color)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .frame(width: 280)
        .padding(10)
        .background(stage.color.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func card(_ lead: LeadIntelligenceLead, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(lead.name).font(.subheadline.bold()).lineLimit(2)
            HStack(spacing: 4) {
                if let temp = lead.leadTemperature {
                    Text(temp.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(tempColor(temp).opacity(0.2), in: Capsule())
                        .foregroundStyle(tempColor(temp))
                }
                if let score = lead.leadScore {
                    Text("\(score)").font(.caption2.bold()).foregroundStyle(.secondary)
                }
                Spacer()
                if let ev = lead.expectedValue, ev > 0 {
                    Text("\(Int(ev/1000))k").font(.caption2.bold()).foregroundStyle(.green)
                }
            }
            if let nba = lead.nextBestAction {
                Text(nba.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.caption2)
                    .foregroundStyle(.purple)
                    .lineLimit(1)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(accent.opacity(0.3), lineWidth: 1))
    }

    private func tempColor(_ t: String) -> Color {
        switch t {
        case "ready": return .purple
        case "hot":   return .red
        case "warm":  return .orange
        case "cold":  return .blue
        default:      return .gray
        }
    }

    @MainActor
    private func load() async {
        loading = true; errorText = nil
        // Fallback: hent alle recommendations + deriver unike leads via
        // fetchLeadIntelligence. Backend bør på sikt eksponere et eget
        // /api/leadgrid/intelligence/pipeline?org=X-endepunkt.
        do {
            let recs = try await api.fetchNBARecommendations(limit: 200)
            var seenIds = Set<String>()
            var uniqueLeads: [LeadIntelligenceLead] = []
            for r in recs where !seenIds.contains(r.leadId) {
                seenIds.insert(r.leadId)
                do {
                    let intel = try await api.fetchLeadIntelligence(leadId: r.leadId)
                    uniqueLeads.append(intel.lead)
                } catch {
                    // hopp over leads vi ikke får tak i; ikke fail hele kanban
                }
            }
            leads = uniqueLeads
        } catch {
            errorText = "Kunne ikke laste: \(error.localizedDescription)"
        }
        loading = false
    }
}
