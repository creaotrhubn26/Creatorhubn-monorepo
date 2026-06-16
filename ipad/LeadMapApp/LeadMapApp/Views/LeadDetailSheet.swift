// LeadDetailSheet.swift
//
// Sheet-presentert lead-detail. Vises når en pin tap-pes på kartet.
// SKELETON — flere seksjoner (BRREG, SSB, strategi) kommer i senere faser.

import SwiftUI

struct LeadDetailSheet: View {
    let lead: LeadModel
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var updating = false
    @State private var enrichment: EnrichmentModel?
    @State private var demographics: DemographicsModel?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    headerSection
                    metaSection
                    if let enrichment, enrichment.found, let company = enrichment.company {
                        brregSection(company: company, contacts: enrichment.contacts ?? [])
                    }
                    if let demographics, demographics.found {
                        ssbSection(demo: demographics)
                    }
                    statusButtons
                    actionGrid
                }
                .padding()
            }
            .navigationTitle(lead.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
            .task {
                await loadEnrichment()
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var headerSection: some View {
        HStack(alignment: .top, spacing: 14) {
            BrandKitMonogram(name: lead.name, accent: statusColor)
                .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 4) {
                Text(lead.name).font(.title3.bold())
                if let cat = lead.category {
                    Text(cat).foregroundStyle(.secondary).font(.subheadline)
                }
                HStack(spacing: 6) {
                    Circle().fill(statusColor).frame(width: 8, height: 8)
                    Text(lead.status.label)
                        .font(.caption.bold())
                        .foregroundStyle(statusColor)
                }
            }
            Spacer()
        }
    }

    private var metaSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let addr = lead.address {
                Label("\(addr)\(lead.city.map { ", \($0)" } ?? "")", systemImage: "mappin")
                    .font(.subheadline)
            }
            if let phone = lead.phone {
                Link(destination: URL(string: "tel:\(phone)")!) {
                    Label(phone, systemImage: "phone")
                }
            }
            if let email = lead.email {
                Link(destination: URL(string: "mailto:\(email)")!) {
                    Label(email, systemImage: "envelope")
                }
            }
            if let url = lead.websiteUrl, let link = URL(string: url) {
                Link(destination: link) {
                    Label(url, systemImage: "globe").lineLimit(1)
                }
            }
        }
        .font(.subheadline)
    }

    private func brregSection(company: EnrichmentCompany, contacts: [EnrichmentContact]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Firma (BRREG)", systemImage: "building.2")
                .font(.caption.bold())
                .foregroundStyle(.tint)
            HStack {
                Text(company.name).font(.subheadline.bold())
                Spacer()
                Text(company.status.label)
                    .font(.caption2.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(statusBadgeColor(company.status).opacity(0.2))
                    .foregroundStyle(statusBadgeColor(company.status))
                    .clipShape(Capsule())
            }
            if let employees = company.employees {
                Text("\(employees) ansatte · \(company.orgForm ?? "")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if !contacts.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(contacts.prefix(3), id: \.name) { c in
                        HStack {
                            Text(c.name).font(.caption)
                            Spacer()
                            Text(c.role).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(12)
        .background(Color.blue.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private func ssbSection(demo: DemographicsModel) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("BEFOLKNING \(demo.city ?? "")").font(.caption2.bold()).foregroundStyle(.secondary)
                if let pop = demo.population {
                    Text("\(pop, format: .number.grouping(.automatic))").font(.title3.bold())
                }
            }
            Spacer()
            if let pot = demo.marketPotential {
                VStack(alignment: .trailing, spacing: 2) {
                    Text("MARKEDS­POTENSIAL").font(.caption2.bold()).foregroundStyle(.secondary)
                    Text("\(pot)/100").font(.title3.bold()).foregroundStyle(.green)
                }
            }
        }
        .padding(12)
        .background(Color.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private var statusButtons: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("OPPDATER STATUS").font(.caption.bold()).foregroundStyle(.secondary)
            LazyVGrid(columns: Array(repeating: .init(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach([LeadStatus.return, .notPresent, .declined, .interested, .meetingBooked, .won]) { s in
                    Button {
                        Task { await update(to: s) }
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: iconForStatus(s)).font(.title3)
                            Text(s.label).font(.caption2)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 8)
                    }
                    .buttonStyle(.bordered)
                    .disabled(updating || s == lead.status)
                }
            }
        }
    }

    private var actionGrid: some View {
        LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 8) {
            Button { /* TODO: Visit log modal */ } label: {
                Label("Log Visit", systemImage: "doc.text")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            Button { /* TODO: Strategy sheet */ } label: {
                Label("Strategi", systemImage: "lightbulb")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            Button { /* TODO: Schedule meeting */ } label: {
                Label("Møte", systemImage: "calendar.badge.plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            Button { /* TODO: Send Message */ } label: {
                Label("Melding", systemImage: "message")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
    }

    // MARK: - Helpers

    private func loadEnrichment() async {
        guard let api = appState.api else { return }
        async let e = try? await api.fetchEnrichment(leadId: lead.id)
        async let d = try? await api.fetchDemographics(leadId: lead.id)
        self.enrichment = await e
        self.demographics = await d
    }

    private func update(to newStatus: LeadStatus) async {
        guard let api = appState.api else { return }
        updating = true
        do {
            try await api.updateStatus(leadId: lead.id, status: newStatus.rawValue)
            await appState.refreshAll()
        } catch {
            print("[LeadDetail] status update failed: \(error)")
        }
        updating = false
    }

    private var statusColor: Color {
        switch lead.status {
        case .interested, .won: return .green
        case .declined, .lost: return .red
        case .meetingBooked, .proposalSent: return .purple
        case .return: return .yellow
        default: return .blue
        }
    }

    private func statusBadgeColor(_ s: CompanyStatus) -> Color {
        switch s {
        case .active: return .green
        case .inLiquidation: return .yellow
        case .bankrupt: return .red
        }
    }

    private func iconForStatus(_ s: LeadStatus) -> String {
        switch s {
        case .return: return "arrow.clockwise"
        case .notPresent: return "minus.circle"
        case .declined: return "xmark.circle"
        case .interested: return "heart"
        case .meetingBooked: return "calendar"
        case .won: return "trophy"
        default: return "circle"
        }
    }
}
