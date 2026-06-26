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
    @Environment(AppState.self) private var appState

    @State private var customer: LeadgridCustomerDetail?
    @State private var loading = true
    @State private var errorText: String?

    @State private var showStatusChanger = false
    @State private var showAssign = false
    @State private var assignLevel: AssignLevel = .both
    @State private var leadStatus: String = ""
    @State private var showResearch = false
    @State private var showNoteEditor = false

    /// Slå opp matchende LeadModel fra AppState så vi får lead-score,
    /// temperatur, next-action, expected-value, telefon etc. uten et
    /// nytt API-kall. Returnerer nil hvis kunden ikke ligger i lokal
    /// leads-cache (f.eks. åpnet direkte via push uten å være på kartet).
    private var matchingLead: LeadModel? {
        appState.leads.first { $0.id == customerId }
    }

    /// Score som drives av lead_score først, AI-opportunity-score som fallback
    /// (matcher prioriteten i web og marketing-mockene).
    private func effectiveScore(_ c: LeadgridCustomerDetail) -> Int? {
        matchingLead?.leadScore ?? c.aiOpportunityScore
    }

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
                quickActionsRow(c)
                structuredInfoCards(c)
                contactCard(c)
                if let note = c.assignmentNote, !note.isEmpty {
                    noteCard(note)
                }
                assignmentCard(c)
                // Deal Management (#154/#155, mig 0349) — probability slider,
                // expected close date, deal amount, weighted value, stage-historikk
                LeadgridDealSection(leadId: customerId, api: api)
                researchCard(c)
                statusCard
                historyCard
            }
            .padding()
        }
    }

    /// 4 store action-buttons under header — Ring / Notat / Rute / Status.
    /// Matcher MUI-ButtonGroup-stilen fra mockene: stor ikon + label, runde
    /// hjørner, brand-purple-bakgrunn.
    @ViewBuilder
    private func quickActionsRow(_ c: LeadgridCustomerDetail) -> some View {
        HStack(spacing: 10) {
            actionButton(title: "Ring",
                         icon: "phone.fill",
                         enabled: (c.phone ?? "").isEmpty == false) {
                if let p = c.phone, let url = URL(string: "tel:\(p)") {
                    UIApplication.shared.open(url)
                }
            }
            actionButton(title: "Notat", icon: "square.and.pencil") {
                showNoteEditor = true
            }
            actionButton(title: "Rute",
                         icon: "point.topleft.down.to.point.bottomright.curvepath",
                         enabled: matchingLead != nil) {
                if let lead = matchingLead {
                    let coord = "\(lead.latitude),\(lead.longitude)"
                    if let url = URL(string: "http://maps.apple.com/?daddr=\(coord)") {
                        UIApplication.shared.open(url)
                    }
                }
            }
            actionButton(title: "Status", icon: "flag.fill") {
                showStatusChanger = true
            }
        }
        // Enkel notat-editor som NotePadSheet hvis ikke laget enda —
        // bruker den eksisterende voice-memo-sheet-en for raskhet.
        .sheet(isPresented: $showNoteEditor) {
            LeadgridVoiceMemoSheet(
                api: api,
                leadId: customerId,
                leadName: customer?.name ?? "Lead"
            )
        }
    }

    @ViewBuilder
    private func actionButton(
        title: String,
        icon: String,
        enabled: Bool = true,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.title2)
                Text(title).font(.caption.bold())
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .padding(.vertical, 4)
            .background(
                enabled
                    ? Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0.92)
                    : Color.secondary.opacity(0.18),
                in: RoundedRectangle(cornerRadius: 14)
            )
            .foregroundStyle(enabled ? .white : .secondary)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    /// Strukturerte info-cards (Neste handling / Oppfølging / Forventet verdi)
    /// drevet av matchende LeadModel + customer-data. Matcher mock-paritet.
    @ViewBuilder
    private func structuredInfoCards(_ c: LeadgridCustomerDetail) -> some View {
        VStack(spacing: 10) {
            if let next = matchingLead?.nextAction, !next.isEmpty {
                infoCardRow(icon: "calendar", title: "Neste handling", value: next)
            }
            if let due = matchingLead?.nextFollowUpAt {
                infoCardRow(icon: "clock",
                            title: "Oppfølging",
                            value: due.formatted(date: .abbreviated, time: .shortened))
            }
            if let v = matchingLead?.estimatedValue {
                infoCardRow(icon: "banknote",
                            title: "Forventet verdi",
                            value: formatNok(v))
            }
        }
    }

    @ViewBuilder
    private func infoCardRow(icon: String, title: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.callout.bold())
                .frame(width: 32, height: 32)
                .foregroundStyle(.purple)
                .background(Color.purple.opacity(0.14),
                            in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.caption2).foregroundStyle(.secondary)
                Text(value).font(.callout.weight(.medium))
            }
            Spacer()
        }
        .padding(12)
        .background(Color(.secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 12))
    }

    private func formatNok(_ v: Double) -> String {
        if v >= 1_000_000 { return String(format: "NOK %.1f mill.", v / 1_000_000) }
        if v >= 10_000 { return String(format: "NOK %.0f k", v / 1_000) }
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        f.groupingSeparator = "\u{00A0}"
        return "NOK \(f.string(from: NSNumber(value: v)) ?? "\(Int(v))")"
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
            // Logo / monogram
            if let url = c.logoUrl.flatMap(URL.init) {
                AsyncImage(url: url) { img in
                    img.resizable().aspectRatio(contentMode: .fit)
                } placeholder: {
                    Circle().fill(Color.purple.opacity(0.20))
                }
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                RoundedRectangle(cornerRadius: 10).fill(Color.purple.opacity(0.20))
                    .frame(width: 64, height: 64)
                    .overlay(Text(String(c.name.prefix(1)).uppercased())
                                .font(.title.bold()).foregroundStyle(.purple))
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(c.name).font(.title3.bold()).lineLimit(2)
                HStack(spacing: 6) {
                    if let lead = matchingLead,
                       let badge = LeadTemperatureBadge(lead: lead, style: .pill) {
                        badge
                    } else {
                        // Fallback til tier-chip når vi ikke har lead_temperature
                        tierChip(c.leadCategory)
                    }
                    statusChip(c.status)
                }
            }
            Spacer()

            // Stor sirkulær score-ring m/ trend — matcher marketing-mocken.
            if let score = effectiveScore(c) {
                LeadScoreRing(score: score, delta: nil, diameter: 84)
            }
        }
        .padding(14)
        .background(
            LinearGradient(
                colors: [Color.purple.opacity(0.10),
                         Color(.secondarySystemBackground)],
                startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16)
            .strokeBorder(Color.purple.opacity(0.18)))
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
