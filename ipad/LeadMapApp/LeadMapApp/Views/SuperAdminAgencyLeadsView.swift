// SuperAdminAgencyLeadsView.swift
//
// B2B Leadgrid-pipeline: markedssjefer i andre org-er som er prospekter
// for Leadgrid. Inbox m/ filter på status + tap for å åpne detail-sheet.
//
// Backend: GET /api/admin-room/agency-leads?status=...

import SwiftUI

struct SuperAdminAgencyLeadsView: View {
    let api: APIClient

    @State private var leads: [AgencyLead] = []
    @State private var loading = true
    @State private var selectedStatus: String? = nil
    @State private var selectedLeadId: String?
    @State private var errorText: String?

    private let statuses: [(label: String, key: String?, color: Color)] = [
        ("Alle", nil, .secondary),
        ("Nye", "new", .green),
        ("Kontaktet", "contacted", .blue),
        ("Demo booket", "demo_booked", .purple),
        ("Trial", "trial", .orange),
        ("Kunde", "customer", .pink),
    ]

    var body: some View {
        List {
            // Status-filter
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(statuses, id: \.label) { s in
                            Button {
                                selectedStatus = s.key
                                Task { await load() }
                            } label: {
                                Text(s.label)
                                    .font(.caption.bold())
                                    .padding(.horizontal, 12).padding(.vertical, 6)
                                    .background(
                                        selectedStatus == s.key
                                            ? s.color.opacity(0.30)
                                            : Color.secondary.opacity(0.10),
                                        in: Capsule(),
                                    )
                                    .foregroundStyle(
                                        selectedStatus == s.key ? s.color : .primary,
                                    )
                            }
                        }
                    }
                }
                .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
            }

            if loading && leads.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if leads.isEmpty {
                Section {
                    ContentUnavailableView(
                        "Ingen leads",
                        systemImage: "tray",
                        description: Text("Ingen markedssjef-leads med dette filteret ennå."),
                    )
                }
            } else {
                Section("Leads (\(leads.count))") {
                    ForEach(leads) { lead in
                        Button {
                            selectedLeadId = lead.id
                        } label: {
                            leadRow(lead)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Markedssjef-leads")
        .superAdminBackdrop(.b2bFunnel)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: Binding(
            get: { selectedLeadId.map { IdWrap(id: $0) } },
            set: { selectedLeadId = $0?.id }
        )) { wrap in
            SuperAdminAgencyLeadDetailView(leadId: wrap.id, api: api) {
                Task { await load() }
            }
        }
    }

    private struct IdWrap: Identifiable { let id: String }

    @ViewBuilder
    private func leadRow(_ lead: AgencyLead) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                statusChip(lead.status)
                if let segment = lead.segment {
                    Text(segment).font(.caption2)
                        .padding(.horizontal, 6).padding(.vertical, 1)
                        .background(Color.secondary.opacity(0.15), in: Capsule())
                }
                Spacer()
                Text(lead.formattedCreatedAt).font(.caption2).foregroundStyle(.secondary)
            }
            Text(lead.agencyName).font(.headline)
            Text("\(lead.contactName) · \(lead.email)")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            if let useCase = lead.useCase, !useCase.isEmpty {
                Text(useCase).font(.caption).foregroundStyle(.purple).lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func statusChip(_ status: String) -> some View {
        let (label, color): (String, Color) = {
            switch status {
            case "new": return ("NY", .green)
            case "contacted": return ("KONTAKTET", .blue)
            case "demo_booked": return ("DEMO", .purple)
            case "trial": return ("TRIAL", .orange)
            case "customer": return ("KUNDE", .pink)
            case "disqualified": return ("DQ", .red)
            case "archived": return ("ARKIV", .secondary)
            default: return (status.uppercased(), .secondary)
            }
        }()
        Text(label)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        await MainActor.run { loading = true }
        do {
            let resp = try await api.fetchAgencyLeads(status: selectedStatus)
            await MainActor.run {
                leads = resp.leads
                loading = false
                errorText = nil
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }
}

// ============================================================
// MARK: - Lead detalj-sheet
// ============================================================

struct SuperAdminAgencyLeadDetailView: View {
    let leadId: String
    let api: APIClient
    let onMutate: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var lead: AgencyLead?
    @State private var loading = true
    @State private var actionBusy = false
    @State private var snackbar: String?

    var body: some View {
        NavigationStack {
            List {
                if loading {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else if let lead {
                    Section("Bedrift") {
                        kvRow("Navn", lead.agencyName)
                        if let n = lead.orgNumber { kvRow("Org.nr", n) }
                        if let w = lead.website {
                            if let url = URL(string: w) {
                                Link(destination: url) {
                                    Label(w, systemImage: "arrow.up.right.square")
                                        .font(.callout)
                                }
                            }
                        }
                        if let t = lead.teamSize { kvRow("Team", t) }
                    }

                    Section("Kontakt") {
                        kvRow("Navn", lead.contactName)
                        if let t = lead.contactTitle { kvRow("Tittel", t) }
                        kvRow("E-post", lead.email)
                        if let p = lead.phone { kvRow("Telefon", p) }
                    }

                    if lead.useCase != nil || lead.message != nil {
                        Section("Behov / melding") {
                            if let useCase = lead.useCase, !useCase.isEmpty {
                                Text(useCase).font(.callout)
                            }
                            if let msg = lead.message, !msg.isEmpty {
                                Text("\"\(msg)\"").font(.callout).italic().foregroundStyle(.purple)
                            }
                        }
                    }

                    Section("Status") {
                        ForEach(["new", "contacted", "demo_booked", "trial", "customer", "disqualified", "archived"], id: \.self) { st in
                            Button {
                                Task { await setStatus(st) }
                            } label: {
                                HStack {
                                    Text(statusLabel(st))
                                    Spacer()
                                    if lead.status == st {
                                        Image(systemName: "checkmark").foregroundStyle(.purple)
                                    }
                                }
                            }
                            .disabled(actionBusy)
                        }
                    }

                    if lead.status != "customer" {
                        Section("Konvertering") {
                            Button {
                                Task { await convertToCustomer(persona: "content_producer") }
                            } label: {
                                Label("Send onboarding-lenke (Innholdsprodusent)",
                                       systemImage: "envelope.arrow.triangle.branch.fill")
                            }
                            .disabled(actionBusy)

                            Button {
                                Task { await convertToCustomer(persona: "production_team") }
                            } label: {
                                Label("Send onboarding-lenke (Produksjonsteam)",
                                       systemImage: "envelope.arrow.triangle.branch.fill")
                            }
                            .disabled(actionBusy)
                        }
                    }

                    if let utm = lead.utmSource {
                        Section("Attribusjon") {
                            kvRow("UTM source", utm)
                            if let c = lead.utmCampaign { kvRow("UTM campaign", c) }
                        }
                    }
                }
            }
            .navigationTitle(lead?.agencyName ?? "Lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { dismiss() }
                }
            }
            .overlay(alignment: .bottom) {
                if let snackbar {
                    Text(snackbar)
                        .padding()
                        .background(Color.black.opacity(0.85), in: Capsule())
                        .foregroundStyle(.white)
                        .padding(.bottom, 24)
                        .transition(.move(edge: .bottom))
                }
            }
            .task { await load() }
        }
    }

    @ViewBuilder
    private func kvRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.callout)
        }
    }

    private func statusLabel(_ s: String) -> String {
        switch s {
        case "new": return "Ny"
        case "contacted": return "Kontaktet"
        case "demo_booked": return "Demo booket"
        case "trial": return "Trial"
        case "customer": return "Kunde"
        case "disqualified": return "Diskvalifisert"
        case "archived": return "Arkivert"
        default: return s.capitalized
        }
    }

    private func load() async {
        do {
            let r = try await api.fetchAgencyLead(id: leadId)
            await MainActor.run {
                lead = r
                loading = false
            }
        } catch {
            await flash("Kunne ikke laste: \(error.localizedDescription)")
            await MainActor.run { loading = false }
        }
    }

    private func setStatus(_ status: String) async {
        await MainActor.run { actionBusy = true }
        do {
            try await api.updateAgencyLead(id: leadId, payload: ["status": status])
            await flash("Status oppdatert")
            await load()
            onMutate()
        } catch {
            await flash("Feilet: \(error.localizedDescription)")
        }
        await MainActor.run { actionBusy = false }
    }

    private func convertToCustomer(persona: String) async {
        await MainActor.run { actionBusy = true }
        do {
            let r = try await api.convertAgencyLeadToCustomer(
                id: leadId, persona: persona, sendEmail: true)
            await flash(r.emailed ? "E-post sendt: \(r.onboardingUrl)" : "Lenke generert")
            await load()
            onMutate()
        } catch {
            await flash("Feilet: \(error.localizedDescription)")
        }
        await MainActor.run { actionBusy = false }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 3_000_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}
