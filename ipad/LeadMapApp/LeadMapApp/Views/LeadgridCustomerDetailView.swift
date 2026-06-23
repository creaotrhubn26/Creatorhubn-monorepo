// LeadgridCustomerDetailView.swift
//
// Full CRM-detail-view for én Leadgrid-customer. Paritet m/ web's
// CrmCustomerDetailDrawer (PR #752).
//
// Inneholder:
//   - Header: logo + navn + tier-chip + score
//   - Status-changer-knapp (åpner LeadgridStatusChangerView)
//   - Kontakt-info (e-post/tlf/website klikkbar)
//   - AssignmentStatusView (TL/rep + sett-tracking)
//   - Re-tildel-knapper
//   - Status-history-timeline

import SwiftUI

struct LeadgridCustomerDetailView: View {
    let customerId: String
    let api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var customer: LeadgridCustomerDetail?
    @State private var loading = true
    @State private var errorText: String?

    @State private var showStatusChanger = false
    @State private var showAssign = false
    @State private var assignLevel: AssignLevel = .both
    @State private var leadStatus: String = ""
    @State private var showResearch = false

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else if let c = customer {
                    detailBody(c)
                } else if let errorText {
                    ContentUnavailableView(
                        "Kunne ikke laste",
                        systemImage: "exclamationmark.triangle",
                        description: Text(errorText),
                    )
                }
            }
            .navigationTitle(customer?.name ?? "Lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
            .sheet(isPresented: $showStatusChanger) {
                if let c = customer {
                    LeadgridStatusChangerView(
                        customerId: customerId,
                        customerName: c.name,
                        currentStatus: $leadStatus,
                        api: api,
                    )
                }
            }
            .sheet(isPresented: $showAssign) {
                if let c = customer {
                    LeadgridAssignSheet(
                        customerId: customerId,
                        customerName: c.name,
                        level: assignLevel,
                        api: api,
                    )
                }
            }
            .sheet(isPresented: $showResearch) {
                if let c = customer {
                    LeadgridResearchView(
                        leadId: customerId,
                        leadName: c.name,
                        api: api,
                    )
                }
            }
        }
        .task {
            await load()
            // Auto-mark-seen ved åpning (paritet m/ web)
            try? await api.markLeadSeen(customerId: customerId)
        }
    }

    private func load() async {
        do {
            let c = try await api.fetchLeadgridCustomer(customerId: customerId)
            await MainActor.run {
                customer = c
                leadStatus = c.status
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Feil: \(error.localizedDescription)"
                loading = false
            }
        }
    }

    @ViewBuilder
    private func detailBody(_ c: LeadgridCustomerDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerCard(c)
                contactCard(c)
                if let note = c.assignmentNote, !note.isEmpty {
                    noteCard(note)
                }
                assignmentCard(c)
                researchCard(c)
                statusCard
                historyCard
            }
            .padding()
        }
    }

    @ViewBuilder
    private func researchCard(_ c: LeadgridCustomerDetail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("AI-research", systemImage: "sparkles")
                .font(.caption.bold()).foregroundStyle(.purple)
            Text("Få SWOT, beslutningstakere og en ferdig første-touch generert av Claude — basert på BRREG og deres nettside.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button {
                showResearch = true
            } label: {
                Label("Research med AI", systemImage: "sparkles.rectangle.stack")
                    .font(.callout.bold())
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
        }
        .padding()
        .background(Color.purple.opacity(0.06),
                     in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.purple.opacity(0.20)))
    }

    @ViewBuilder
    private func headerCard(_ c: LeadgridCustomerDetail) -> some View {
        HStack(alignment: .top, spacing: 16) {
            if let url = c.logoUrl.flatMap(URL.init) {
                AsyncImage(url: url) { img in
                    img.resizable().aspectRatio(contentMode: .fit)
                } placeholder: {
                    Circle().fill(Color.purple.opacity(0.20))
                }
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8).fill(Color.purple.opacity(0.20))
                    .frame(width: 56, height: 56)
                    .overlay(Text(String(c.name.prefix(1)).uppercased())
                                .font(.title.bold()).foregroundStyle(.purple))
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(c.name).font(.title3.bold())
                HStack(spacing: 6) {
                    tierChip(c.leadCategory)
                    if let score = c.aiOpportunityScore {
                        Label("\(score)", systemImage: "chart.bar.fill")
                            .font(.caption.bold())
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.15), in: Capsule())
                    }
                    statusChip(c.status)
                }
            }
            Spacer()
        }
    }

    @ViewBuilder
    private func contactCard(_ c: LeadgridCustomerDetail) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let email = c.email, !email.isEmpty {
                Link(destination: URL(string: "mailto:\(email)")!) {
                    Label(email, systemImage: "envelope.fill")
                        .font(.callout).foregroundStyle(.purple)
                }
            }
            if let phone = c.phone, !phone.isEmpty {
                Link(destination: URL(string: "tel:\(phone)")!) {
                    Label(phone, systemImage: "phone.fill")
                        .font(.callout).foregroundStyle(.purple)
                }
            }
            if let web = c.websiteUrl, !web.isEmpty,
               let url = URL(string: web.hasPrefix("http") ? web : "https://\(web)") {
                Link(destination: url) {
                    Label(web.replacingOccurrences(of: "https://", with: "")
                              .replacingOccurrences(of: "http://", with: ""),
                           systemImage: "globe")
                        .font(.callout).foregroundStyle(.purple)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func noteCard(_ note: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Notat fra markedssjef", systemImage: "text.bubble.fill")
                .font(.caption.bold()).foregroundStyle(.purple)
            Text("\"\(note)\"")
                .italic()
                .foregroundStyle(.primary)
        }
        .padding()
        .background(Color.purple.opacity(0.06),
                     in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.purple.opacity(0.20)))
    }

    @ViewBuilder
    private func assignmentCard(_ c: LeadgridCustomerDetail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Tildelt", systemImage: "person.2.fill")
                .font(.caption.bold()).foregroundStyle(.purple)
            LeadgridAssignmentStatusView(
                customerId: customerId,
                api: api,
                canReassign: true,
                onReassign: { level in
                    assignLevel = level
                    showAssign = true
                },
            )
            HStack(spacing: 8) {
                Button {
                    assignLevel = .teamLeader
                    showAssign = true
                } label: {
                    Label("Re-tildel teamleder", systemImage: "person.crop.circle.badge.plus")
                        .font(.caption.bold())
                }
                .buttonStyle(.bordered)
                Button {
                    assignLevel = .rep
                    showAssign = true
                } label: {
                    Label("Re-tildel rep", systemImage: "person.fill.badge.plus")
                        .font(.caption.bold())
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Status", systemImage: "flag.fill")
                .font(.caption.bold()).foregroundStyle(.purple)
            HStack {
                if let s = LeadgridCrmStatus(rawValue: leadStatus) {
                    Label(s.label, systemImage: s.systemIcon)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(s.color.opacity(0.20), in: Capsule())
                        .foregroundStyle(s.color)
                        .font(.callout.bold())
                }
                Spacer()
                Button {
                    showStatusChanger = true
                } label: {
                    Label("Endre", systemImage: "pencil")
                        .font(.callout.bold())
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private var historyCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Status-historikk", systemImage: "clock.arrow.circlepath")
                .font(.caption.bold()).foregroundStyle(.purple)
            LeadgridStatusHistoryView(customerId: customerId, api: api)
        }
        .padding()
        .background(Color(.secondarySystemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func tierChip(_ tier: String?) -> some View {
        switch tier {
        case "hot":
            Label("HOT", systemImage: "flame.fill")
                .font(.caption.bold())
                .padding(.horizontal, 8).padding(.vertical, 2)
                .background(Color.red.opacity(0.20), in: Capsule())
                .foregroundStyle(.red)
        case "warm":
            Label("WARM", systemImage: "thermometer.sun.fill")
                .font(.caption.bold())
                .padding(.horizontal, 8).padding(.vertical, 2)
                .background(Color.orange.opacity(0.20), in: Capsule())
                .foregroundStyle(.orange)
        case "cool":
            Label("COOL", systemImage: "snowflake")
                .font(.caption.bold())
                .padding(.horizontal, 8).padding(.vertical, 2)
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
                .font(.caption.bold())
                .padding(.horizontal, 8).padding(.vertical, 2)
                .background(s.color.opacity(0.20), in: Capsule())
                .foregroundStyle(s.color)
        }
    }
}
