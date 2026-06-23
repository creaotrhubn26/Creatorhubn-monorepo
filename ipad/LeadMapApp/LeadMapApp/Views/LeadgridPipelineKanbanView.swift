// LeadgridPipelineKanbanView.swift
//
// Horisontal kanban over 8 pipeline-stages fra mig 313 — new, first_contact,
// qualified, meeting, proposal, negotiation, won, lost. Hver kolonne viser
// antall leads + sum forventet verdi + sorterte lead-kort.
//
// PR #855 har ikke et /pipeline-endepunkt — for nå deriver vi unike leads fra
// NBA-recommendations + fetchLeadIntelligence per lead.
//
// PR #882 + denne: drag-and-drop er nå live via PATCH
// /api/leadgrid/intelligence/leads/:id/pipeline-stage. Optimistisk UI-update
// med revert + alert hvis backend feiler.

import SwiftUI
import UniformTypeIdentifiers

// Transferable payload for drag-and-drop mellom kolonner.
struct LeadDragPayload: Codable, Transferable {
    let leadId: String
    let currentStage: String

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .data)
    }
}

struct LeadgridPipelineKanbanView: View {
    let api: APIClient
    @State private var leads: [LeadIntelligenceLead] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var selected: LeadIntelligenceLead?
    @State private var droppingTarget: String?
    @State private var moveError: String?

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
        .alert("Feil", isPresented: Binding(
            get: { moveError != nil },
            set: { if !$0 { moveError = nil } }
        )) {
            Button("OK") { moveError = nil }
        } message: {
            if let err = moveError { Text(err) }
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
                        .draggable(LeadDragPayload(leadId: lead.id, currentStage: lead.pipelineStage))
                    }
                }
            }
        }
        .frame(width: 280)
        .padding(10)
        .background(
            stage.color.opacity(droppingTarget == stage.key ? 0.20 : 0.05),
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay(
            droppingTarget == stage.key
                ? RoundedRectangle(cornerRadius: 12).strokeBorder(stage.color, lineWidth: 2)
                : nil
        )
        .dropDestination(for: LeadDragPayload.self) { payloads, _ in
            guard let payload = payloads.first else { return false }
            if payload.currentStage == stage.key { return false }
            Task {
                await moveLead(payload.leadId, to: stage.key, oldStage: payload.currentStage)
            }
            return true
        } isTargeted: { targeted in
            droppingTarget = targeted ? stage.key : nil
        }
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

    // Optimistisk flytte-funksjon: oppdater UI med en gang, deretter PATCH til
    // backend. Revert + vis alert hvis serveren feiler.
    @MainActor
    private func moveLead(_ leadId: String, to newStage: String, oldStage: String) async {
        guard let idx = leads.firstIndex(where: { $0.id == leadId }) else { return }
        let original = leads[idx]
        leads[idx] = original.with(pipelineStage: newStage)

        do {
            _ = try await api.updateLeadPipelineStage(leadId: leadId, stage: newStage)
        } catch {
            moveError = "Kunne ikke flytte: \(error.localizedDescription)"
            if let revertIdx = leads.firstIndex(where: { $0.id == leadId }) {
                leads[revertIdx] = leads[revertIdx].with(pipelineStage: oldStage)
            }
        }
    }
}

// MARK: - Lokal helper for å rebygge LeadIntelligenceLead m/ ny stage.
// Modellen har bare `let`-felter; tilbyr derfor en eksplisitt copy-with.
private extension LeadIntelligenceLead {
    func with(pipelineStage newStage: String) -> LeadIntelligenceLead {
        LeadIntelligenceLead(
            id: id,
            name: name,
            pipelineStage: newStage,
            leadStatus: leadStatus,
            leadScore: leadScore,
            leadTemperature: leadTemperature,
            conversionProbability: conversionProbability,
            expectedValue: expectedValue,
            followUpPriority: followUpPriority,
            nextBestAction: nextBestAction,
            nextBestActionReason: nextBestActionReason,
            nextBestActionChannel: nextBestActionChannel,
            nextBestActionConfidence: nextBestActionConfidence,
            lastContactedAt: lastContactedAt,
            nextFollowUpAt: nextFollowUpAt,
            assignedUserId: assignedUserId,
            latitude: latitude,
            longitude: longitude,
            phone: phone,
            email: email,
            website: website,
            city: city
        )
    }
}
