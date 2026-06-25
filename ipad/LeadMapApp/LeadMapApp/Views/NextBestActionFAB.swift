// NextBestActionFAB.swift
//
// Flytende "Neste beste handling"-knapp som vises bottom-right på Kart-
// flaten. Trykk → bottom-sheet med NBA-detaljer + 3 store CTA-knapper
// (Naviger / Ring / Marker status).
//
// Data fra eksisterende Intelligence-engine:
//   • GET  /api/leadgrid/intelligence/recommendations?limit=1
//   • POST /api/leadgrid/intelligence/recommendations/:id/execute
//
// Hvis NBA-engine er tom (orgen har ikke Intelligence) → fall-back på
// Claude-toppen i workloadLeads (claudeRecommendationRank=1).

import SwiftUI

struct NextBestActionFAB: View {
    @Environment(AppState.self) private var appState
    @State private var topNBA: LeadgridNBARecommendation?
    @State private var fallbackLead: WorkloadLead?
    @State private var loading = true
    @State private var presentSheet = false

    var onOpenLead: (String) -> Void

    var body: some View {
        Button {
            presentSheet = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Neste beste handling")
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                    Text(summaryLine)
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(
                LinearGradient(
                    colors: [
                        Color(red: 0.66, green: 0.32, blue: 0.99),
                        Color(red: 0.43, green: 0.20, blue: 0.78)
                    ],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ),
                in: Capsule()
            )
            .shadow(color: Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0.55),
                    radius: 10, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .opacity(hasRecommendation ? 1 : 0)
        .task { await load() }
        .sheet(isPresented: $presentSheet) {
            NextBestActionSheet(
                nba: topNBA,
                fallback: fallbackLead,
                onOpenLead: { id in
                    presentSheet = false
                    onOpenLead(id)
                },
                onExecuted: {
                    Task { await load() }
                }
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
    }

    private var hasRecommendation: Bool {
        topNBA != nil || fallbackLead != nil
    }

    private var summaryLine: String {
        if let nba = topNBA {
            let parts = [nba.leadName ?? "Lead", actionLabel(for: nba.actionType)].compactMap { $0 }
            return parts.joined(separator: " · ")
        }
        if let lead = fallbackLead {
            let score = lead.aiOpportunityScore.map { "Score \($0)" } ?? "Topp prioritert"
            return "\(lead.name) · \(score)"
        }
        if loading { return "Laster …" }
        return "Ingen aktuelle nå"
    }

    private func actionLabel(for type: String) -> String {
        switch type.lowercased() {
        case "call": return "Ring"
        case "email": return "Send e-post"
        case "visit": return "Besøk"
        case "meeting": return "Book møte"
        case "follow_up", "followup": return "Følg opp"
        default: return type.capitalized
        }
    }

    @MainActor
    private func load() async {
        loading = true
        defer { loading = false }
        guard let api = appState.api else { return }
        // Prøv NBA-engine først (PR #855)
        do {
            let list = try await api.fetchNBARecommendations(priority: nil, limit: 5)
            // Velg første som ikke er dismissed/executed.
            let candidate = list.first(where: { rec in
                rec.status == "pending" || rec.status == "accepted"
            }) ?? list.first
            self.topNBA = candidate
        } catch {
            self.topNBA = nil
        }
        // Fall-back: Claude-rangert workload-lead
        self.fallbackLead = appState.workloadLeads.first {
            ($0.claudeRecommendationRank ?? 9999) <= 5
        } ?? appState.workloadLeads.first
    }
}

// MARK: - Bottom Sheet

struct NextBestActionSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    let nba: LeadgridNBARecommendation?
    let fallback: WorkloadLead?
    var onOpenLead: (String) -> Void
    var onExecuted: () -> Void

    @State private var executing = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                header
                reasonCard
                quickActionGrid
                Spacer()
            }
            .padding()
            .background(Color(.systemGroupedBackground).ignoresSafeArea())
            .navigationTitle("Neste beste handling")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles").foregroundStyle(.purple)
                Text(headerTitle).font(.title3.bold())
                Spacer()
                if let confidence {
                    Text("Score \(confidence)")
                        .font(.caption.bold())
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.purple.opacity(0.15), in: Capsule())
                        .foregroundStyle(.purple)
                }
            }
            if let addr = headerAddress {
                Text(addr)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var reasonCard: some View {
        if let reason {
            Text(reason)
                .font(.subheadline)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color.purple).frame(width: 3)
                }
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    @ViewBuilder
    private var quickActionGrid: some View {
        let columns = [GridItem(.flexible()), GridItem(.flexible())]
        LazyVGrid(columns: columns, spacing: 10) {
            if let mapsURL {
                actionButton(label: "Start navigasjon", icon: "location.fill", tint: .purple) {
                    UIApplication.shared.open(mapsURL)
                }
            }
            if let phoneURL {
                actionButton(label: "Ring", icon: "phone.fill", tint: .green) {
                    UIApplication.shared.open(phoneURL)
                }
            }
            actionButton(label: "Åpne lead", icon: "person.crop.circle", tint: .blue) {
                onOpenLead(leadId)
            }
            if let id = nba?.id {
                actionButton(
                    label: executing ? "Markerer …" : "Marker som utført",
                    icon: "checkmark.circle.fill",
                    tint: Color(red: 0.30, green: 0.92, blue: 0.55)
                ) {
                    Task { await execute(id: id) }
                }
                .disabled(executing)
            }
        }
    }

    private func actionButton(
        label: String,
        icon: String,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon).font(.title3)
                Text(label).font(.caption.bold())
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
            .foregroundStyle(tint)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Computed accessors (NBA vs fallback)

    private var headerTitle: String {
        nba?.leadName ?? fallback?.name ?? "Ingen aktive forslag"
    }

    private var headerAddress: String? {
        if let f = fallback {
            return [f.address, f.city].compactMap { $0 }.joined(separator: ", ")
        }
        return nil
    }

    private var reason: String? {
        nba?.reason ?? fallback?.claudeRecommendationReason
    }

    private var confidence: Int? {
        if let c = nba?.confidence { return Int(c * 100) }
        return fallback?.aiOpportunityScore
    }

    private var leadId: String {
        nba?.leadId ?? fallback?.id ?? ""
    }

    private var phoneURL: URL? {
        let phone = fallback?.phone
        guard let phone, !phone.isEmpty else { return nil }
        return URL(string: "tel:\(phone.replacingOccurrences(of: " ", with: ""))")
    }

    private var mapsURL: URL? {
        fallback?.appleMapsNavigateURL
    }

    @MainActor
    private func execute(id: String) async {
        guard let api = appState.api else { return }
        executing = true
        defer { executing = false }
        _ = try? await api.executeRecommendation(id, outcome: "completed", notes: nil)
        onExecuted()
        dismiss()
    }
}
