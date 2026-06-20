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
    @State private var visitLogShown = false
    @State private var strategyShown = false
    @State private var briefShown = false
    // Pitch Deck Studio-integrasjon: hentes når sheet åpnes, vises som
    // CTA i prosjekt-kortet KUN hvis backend bekrefter at orgen har et
    // ready-deck OG kaller har pitch_deck.access (403 ellers).
    @State private var pitchAvailability: PitchDeckAvailability?
    @State private var pitchBriefShown = false
    @State private var pitchBundleForBrief: PitchDeckBundle?

    // ── Leadgrid v2 (PR #730+) ─────────────────────────────────
    /// Backing-state for status-bytte fra Leadgrid-flow. Initialiseres
    /// fra lead.status; sync-er tilbake til appState etter endring.
    @State private var leadgridStatus: String = ""
    @State private var showLeadgridStatusChanger = false
    @State private var showLeadgridAssign = false
    @State private var showLeadgridHistory = false
    @State private var leadgridAssignLevel: AssignLevel = .both

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    headerSection
                    distanceBar
                    pitchDeckCTA
                    metaSection
                    if let enrichment, enrichment.found, let company = enrichment.company {
                        brregSection(company: company, contacts: enrichment.contacts ?? [])
                    }
                    if let demographics, demographics.found {
                        ssbSection(demo: demographics)
                    }
                    statusButtons
                    leadgridSection
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
                await loadPitchAvailability()
                await markSeenIfAssigned()
            }
            .sheet(isPresented: $showLeadgridStatusChanger) {
                if let api = appState.api {
                    LeadgridStatusChangerView(
                        customerId: lead.id,
                        customerName: lead.name,
                        currentStatus: $leadgridStatus,
                        api: api,
                    )
                }
            }
            .sheet(isPresented: $showLeadgridAssign) {
                if let api = appState.api {
                    LeadgridAssignSheet(
                        customerId: lead.id,
                        customerName: lead.name,
                        level: leadgridAssignLevel,
                        api: api,
                    )
                }
            }
            .sheet(isPresented: $showLeadgridHistory) {
                if let api = appState.api {
                    NavigationStack {
                        ScrollView {
                            LeadgridStatusHistoryView(customerId: lead.id, api: api)
                                .padding()
                        }
                        .navigationTitle("Status-historikk")
        .salesHierarchyBackdrop(.salesRep)
                        .navigationBarTitleDisplayMode(.inline)
                    }
                }
            }
            .sheet(isPresented: $pitchBriefShown) {
                if let bundle = pitchBundleForBrief {
                    PitchPreMeetingBriefView(
                        bundle: bundle,
                        leadId: lead.id,
                        leadName: lead.name
                    )
                }
            }
            .sheet(isPresented: $visitLogShown) {
                VisitLogModal(lead: lead)
            }
            .sheet(isPresented: $strategyShown) {
                StrategySheet(lead: lead)
            }
            .sheet(isPresented: $briefShown) {
                MeetingBriefSheet(lead: lead)
            }
        }
        .presentationDetents([.medium, .large])
    }

    // Distanse fra brukerens posisjon + Naviger m/ Apple Maps (PR #612)
    @ViewBuilder
    private var distanceBar: some View {
        if let me = LocationService.shared.currentLocation {
            let dist = LocationService.shared.distanceMeters(
                from: me.coordinate,
                to: .init(latitude: lead.latitude, longitude: lead.longitude)
            )
            let km = dist / 1000
            HStack(spacing: 10) {
                Image(systemName: "location.fill")
                    .foregroundStyle(Color(red: 0.75, green: 0.52, blue: 0.99))
                Text(formatDistanceKm(km))
                    .font(.headline)
                    .foregroundStyle(Color(red: 0.75, green: 0.52, blue: 0.99))
                Text("≈ \(estimatedDriveMin(km)) min m/ bil")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                if let url = URL(string: "https://maps.apple.com/?daddr=\(lead.latitude),\(lead.longitude)&dirflg=d") {
                    Link("Naviger", destination: url)
                        .font(.callout.bold())
                        .foregroundStyle(Color(red: 0.75, green: 0.52, blue: 0.99))
                }
            }
            .padding(10)
            .background(Color(red: 0.75, green: 0.52, blue: 0.99).opacity(0.10),
                        in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private func formatDistanceKm(_ km: Double) -> String {
        if km < 1 { return "\(Int(km * 1000)) m" }
        if km < 10 { return String(format: "%.1f km", km).replacingOccurrences(of: ".", with: ",") }
        return "\(Int(km)) km"
    }

    private func estimatedDriveMin(_ km: Double) -> Int {
        let avgKmh = km < 5 ? 30.0 : km < 20 ? 45.0 : 65.0
        return Int((km / avgKmh) * 60)
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

    // ── Leadgrid v2-seksjon — CRM-utvidelse ─────────────────────
    @ViewBuilder
    private var leadgridSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Leadgrid CRM", systemImage: "person.crop.rectangle.stack.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.purple)
                Spacer()
                if let api = appState.api {
                    NavigationLink {
                        ScrollView {
                            LeadgridStatusHistoryView(customerId: lead.id, api: api)
                                .padding()
                        }
                        .navigationTitle("Status-historikk")
                    } label: {
                        Label("Historikk", systemImage: "clock.arrow.circlepath")
                            .font(.caption)
                    }
                }
            }
            if appState.api != nil {
                // Tildelt-status — hvem er TL/rep + sett-tracking
                LeadgridAssignmentStatusView(
                    customerId: lead.id,
                    api: appState.api!,
                    canReassign: true,
                    onReassign: { level in
                        leadgridAssignLevel = level
                        showLeadgridAssign = true
                    },
                )
            }
            HStack(spacing: 8) {
                Button {
                    showLeadgridStatusChanger = true
                } label: {
                    Label(LeadgridCrmStatus(rawValue: leadgridStatus)?.label ?? "Endre status",
                           systemImage: "arrow.triangle.swap")
                        .font(.caption.bold())
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)

                Button {
                    leadgridAssignLevel = .both
                    showLeadgridAssign = true
                } label: {
                    Label("Tildel", systemImage: "person.fill.badge.plus")
                        .font(.caption.bold())
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(12)
        .background(Color.purple.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.purple.opacity(0.20)))
    }

    private var actionGrid: some View {
        LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 8) {
            Button {
                if #available(iOS 16.1, *) {
                    ActiveVisitManager.shared.start(lead: lead)
                }
                visitLogShown = true
            } label: {
                Label("Start besøk", systemImage: "play.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            Button { briefShown = true } label: {
                Label("Forbered møte", systemImage: "sparkles")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(Color(red: 0.98, green: 0.75, blue: 0.14))
            Button { strategyShown = true } label: {
                Label("Strategi", systemImage: "lightbulb")
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

    /// Leadgrid-paritets: marker som sett når brukeren åpner detail-sheet'et.
    /// Best-effort — feiler stille hvis brukeren ikke er tildelt.
    /// Setter også `leadgridStatus` til lead's nåværende status.
    private func markSeenIfAssigned() async {
        leadgridStatus = lead.status.rawValue
        guard let api = appState.api else { return }
        try? await api.markLeadSeen(customerId: lead.id)
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

    // MARK: - Pitch Deck-CTA (vises kun hvis orgen har et ready-deck)

    @ViewBuilder
    private var pitchDeckCTA: some View {
        if let avail = pitchAvailability, avail.available,
           let deckName = avail.deckName, let deckId = avail.deckId {
            Button {
                Task { await startPitchPresentation(deckId: deckId) }
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "rectangle.stack.fill.badge.person.crop")
                        .font(.title2)
                        .foregroundStyle(Color(red: 0.83, green: 0.64, blue: 0.45))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Presenter pitch")
                            .font(.headline)
                        Text("\(deckName) · \(avail.slideCount ?? 9) slides")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "play.fill")
                        .foregroundStyle(.tint)
                }
                .padding(12)
                .background(
                    Color(red: 0.83, green: 0.64, blue: 0.45).opacity(0.10),
                    in: RoundedRectangle(cornerRadius: 10)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func loadPitchAvailability() async {
        guard let api = appState.api,
              let orgId = appState.activeOrganizationId else { return }
        do {
            // Trenger pitch_deck.access — backend 403'er ellers og vi
            // bare skjuler CTA'en stille.
            let avail = try await api.fetchPitchDeckAvailability(orgId: orgId)
            pitchAvailability = avail
        } catch {
            pitchAvailability = nil
        }
    }

    private func startPitchPresentation(deckId: String) async {
        guard let api = appState.api else { return }
        do {
            // Pre-load deck slik at BriefView har bundle klart.
            // BriefView kaller selv POST /presentations/brief +
            // POST /presentations når selger trykker Start.
            let bundle = try await api.loadPitchDeck(deckId: deckId)
            pitchBundleForBrief = bundle
            pitchBriefShown = true
        } catch {
            // Stille fallback — knappen vises ikke neste gang hvis
            // backend mister access. Logger ikke til UI for å unngå støy.
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
