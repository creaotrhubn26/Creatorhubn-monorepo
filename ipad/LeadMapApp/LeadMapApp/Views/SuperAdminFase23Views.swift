// SuperAdminFase23Views.swift
//
// Fase 23: Resterende Leadgrid-funksjonalitet — drips/scheduled-cron
// manual-trigger, marketplace, partner-application selv-tjeneste,
// developer-program-søknad.

import SwiftUI

// ============================================================
// MARK: - Drips management (super-admin cron-control)
// ============================================================

struct SuperAdminDripsManagementView: View {
    let api: APIClient

    @State private var running = false
    @State private var lastResult: DripRunResult?
    @State private var snackbar: String?
    @State private var schedRunning = false

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Drip-e-post-serier").font(.headline)
                    Text("Trigge cron manuelt — sender alle pending steps NÅ. Brukes vanligvis ved test eller om cron har stoppet.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }

            Section {
                Button {
                    Task { await runDripsCron() }
                } label: {
                    if running { ProgressView() } else {
                        Label("Kjør drip-cron nå", systemImage: "paperplane.fill")
                    }
                }
                .disabled(running)
            }

            if let r = lastResult {
                Section("Siste run") {
                    HStack {
                        miniStat("Sendt", r.sent ?? 0, .green)
                        miniStat("Skip", r.skipped ?? 0, .secondary)
                        miniStat("Feil", r.errors ?? 0, (r.errors ?? 0) > 0 ? .red : .secondary)
                    }
                }
            }

            Section("Scheduled reports") {
                Text("Trigge alle pending rapporter NÅ — som vanligvis kjøres via daglig cron.")
                    .font(.caption).foregroundStyle(.secondary)
                Button {
                    Task { await runScheduledCron() }
                } label: {
                    if schedRunning { ProgressView() } else {
                        Label("Kjør scheduled-reports-cron nå", systemImage: "clock.arrow.circlepath")
                    }
                }
                .disabled(schedRunning)
            }
        }
        .navigationTitle("Cron / drips")
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
    }

    @ViewBuilder
    private func miniStat(_ label: String, _ value: Int, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text("\(value)").font(.title3.bold()).foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
    }

    private func runDripsCron() async {
        await MainActor.run { running = true }
        do {
            let r = try await api.runDripsCron()
            await MainActor.run {
                lastResult = r
                snackbar = "Sendt \(r.sent ?? 0), feilet \(r.errors ?? 0)"
            }
        } catch {
            await MainActor.run { snackbar = "Cron feilet" }
        }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run {
            running = false
            snackbar = nil
        }
    }

    private func runScheduledCron() async {
        await MainActor.run { schedRunning = true }
        do {
            try await api.runScheduledReportsCron()
            await MainActor.run { snackbar = "Scheduled-reports trigget" }
        } catch {
            await MainActor.run { snackbar = "Trigge feilet" }
        }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run {
            schedRunning = false
            snackbar = nil
        }
    }
}

// ============================================================
// MARK: - Marketplace (public partner-marketplace)
// ============================================================

struct LeadgridMarketplaceView: View {
    let api: APIClient

    @State private var partners: [LeadgridMarketplacePartner] = []
    @State private var loading = true
    @State private var selectedType: String? = nil
    @State private var selectedTier: String? = nil
    @State private var errorText: String?

    private let types: [(String, String?)] = [
        ("Alle", nil), ("Photo/Video", "media"), ("Marketing", "marketing"),
        ("Sales", "sales"), ("Integration", "integration"),
    ]
    private let tiers: [(String, String?)] = [
        ("Alle tiers", nil), ("Strategic", "strategic"),
        ("Verified", "verified_integration"), ("Certified", "certified"),
        ("Listed", "listed"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Type-filter
                VStack(alignment: .leading, spacing: 6) {
                    Text("Type").font(.caption.bold()).foregroundStyle(.secondary)
                        .padding(.horizontal)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(types, id: \.0) { t in
                                filterChip(t.0, isActive: selectedType == t.1) {
                                    selectedType = t.1
                                    Task { await load() }
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                // Tier-filter
                VStack(alignment: .leading, spacing: 6) {
                    Text("Tier").font(.caption.bold()).foregroundStyle(.secondary)
                        .padding(.horizontal)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(tiers, id: \.0) { t in
                                filterChip(t.0, isActive: selectedTier == t.1) {
                                    selectedTier = t.1
                                    Task { await load() }
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }

                if loading && partners.isEmpty {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .frame(height: 100)
                } else if partners.isEmpty {
                    ContentUnavailableView(
                        "Ingen partnere",
                        systemImage: "person.2",
                        description: Text("Ingen partnere matcher filteret."),
                    )
                    .padding()
                } else {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 250, maximum: 360), spacing: 12)
                    ], spacing: 12) {
                        ForEach(partners) { p in
                            partnerCard(p)
                        }
                    }
                    .padding(.horizontal)
                }

                if let errorText {
                    Text(errorText).foregroundStyle(.red).font(.caption).padding()
                }
            }
        }
        .navigationTitle("Marketplace")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func filterChip(_ label: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(.caption.bold())
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(
                    isActive ? Color.purple.opacity(0.25) : Color.secondary.opacity(0.10),
                    in: Capsule(),
                )
                .foregroundStyle(isActive ? .purple : .primary)
        }
    }

    @ViewBuilder
    private func partnerCard(_ p: LeadgridMarketplacePartner) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                if let urlStr = p.logoUrl, let url = URL(string: urlStr) {
                    AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: {
                        Image(systemName: "building.2.fill").foregroundStyle(.secondary)
                    }
                    .frame(width: 40, height: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    Image(systemName: "building.2.fill")
                        .frame(width: 40, height: 40)
                        .background(Color.secondary.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                        .foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.name).font(.headline)
                    HStack(spacing: 6) {
                        if let type = p.partnerType {
                            Text(type.capitalized).font(.caption2)
                                .padding(.horizontal, 6).padding(.vertical, 1)
                                .background(Color.purple.opacity(0.20), in: Capsule())
                                .foregroundStyle(.purple)
                        }
                        if let tier = p.tier {
                            Text(tier.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.caption2.bold())
                                .padding(.horizontal, 6).padding(.vertical, 1)
                                .background(tierColor(tier).opacity(0.20), in: Capsule())
                                .foregroundStyle(tierColor(tier))
                        }
                    }
                }
                Spacer()
            }
            if let tagline = p.tagline, !tagline.isEmpty {
                Text(tagline).font(.callout).foregroundStyle(.secondary).lineLimit(3)
            }
            if let website = p.website, let url = URL(string: website) {
                Link(destination: url) {
                    Label("Besøk", systemImage: "arrow.up.right.square").font(.caption.bold())
                }
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private func tierColor(_ tier: String) -> Color {
        switch tier.lowercased() {
        case "strategic": return .purple
        case "verified_integration", "verified": return .green
        case "integration": return .blue
        case "certified": return .orange
        default: return .secondary
        }
    }

    private func load() async {
        await MainActor.run { loading = true }
        do {
            let r = try await api.fetchLeadgridMarketplace(type: selectedType, tier: selectedTier)
            await MainActor.run {
                partners = r.partners
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
// MARK: - Partner-application status (selv-tjeneste)
// ============================================================

struct LeadgridPartnerApplicationView: View {
    let api: APIClient

    @State private var resp: LeadgridMyPartnerApplicationResponse?
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && resp == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let r = resp {
                if let app = r.application {
                    Section {
                        HStack(spacing: 12) {
                            Image(systemName: statusIcon(app.status))
                                .font(.title)
                                .foregroundStyle(statusColor(app.status))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Din søknad").font(.caption).foregroundStyle(.secondary)
                                Text(statusLabel(app.status)).font(.headline.bold())
                                    .foregroundStyle(statusColor(app.status))
                            }
                            Spacer()
                        }
                    }
                    Section("Detaljer") {
                        kvRow("Organisasjon", app.organizationName ?? "—")
                        if let type = app.partnerType {
                            kvRow("Type", type.capitalized)
                        }
                        if let tag = app.proposedTagline {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Foreslått tagline").font(.caption).foregroundStyle(.secondary)
                                Text(tag).font(.callout)
                            }
                        }
                        if let reason = app.reason {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Begrunnelse").font(.caption).foregroundStyle(.secondary)
                                Text(reason).font(.callout)
                            }
                        }
                        if let docs = app.documentCount {
                            kvRow("Dokumenter", "\(docs) opplastet")
                        }
                        if let created = app.createdAt {
                            kvRow("Sendt", LeadgridDate.formatNo(created))
                        }
                        if let reviewed = app.reviewedAt {
                            kvRow("Behandlet", LeadgridDate.formatNo(reviewed))
                        }
                        if let notes = app.reviewerNotes, !notes.isEmpty {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Tilbakemelding").font(.caption.bold()).foregroundStyle(.purple)
                                Text(notes).font(.callout).foregroundStyle(.secondary)
                            }
                        }
                    }
                } else {
                    Section {
                        ContentUnavailableView(
                            "Ingen søknad ennå",
                            systemImage: "doc.badge.plus",
                            description: Text("Søk om å bli Leadgrid-partner fra Admin Room på web for å starte søknaden."),
                        )
                    }
                    if let blocked = r.blockedReason, !blocked.isEmpty {
                        Section { Text(blocked).foregroundStyle(.red).font(.caption) }
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Min partner-søknad")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func kvRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.callout)
        }
    }

    private func statusIcon(_ s: String) -> String {
        switch s {
        case "approved": return "checkmark.seal.fill"
        case "rejected": return "xmark.seal.fill"
        case "sandbox": return "testtube.2"
        default: return "clock.fill"
        }
    }

    private func statusColor(_ s: String) -> Color {
        switch s {
        case "approved": return .green
        case "rejected": return .red
        case "sandbox": return .orange
        default: return .orange
        }
    }

    private func statusLabel(_ s: String) -> String {
        switch s {
        case "pending": return "Venter på behandling"
        case "approved": return "Godkjent"
        case "rejected": return "Avslått"
        case "sandbox": return "I sandbox"
        default: return s.capitalized
        }
    }

    private func load() async {
        do {
            let r = try await api.fetchMyPartnerApplication()
            await MainActor.run {
                resp = r
                loading = false
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
// MARK: - Developer-application (Leadgrid API for utviklere)
// ============================================================

struct LeadgridDeveloperApplicationView: View {
    let api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var fullName = ""
    @State private var orgName = ""
    @State private var website = ""
    @State private var useCase = ""
    @State private var integrationDesc = ""
    @State private var expectedCalls = ""
    @State private var agreedToTerms = false
    @State private var terms: LeadgridPartnerTerms?
    @State private var sending = false
    @State private var result: String?
    @State private var showTerms = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Kontakt") {
                    TextField("E-post*", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    TextField("Fullt navn", text: $fullName)
                        .textContentType(.name)
                    TextField("Organisasjon", text: $orgName)
                    TextField("Nettside", text: $website)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                }
                Section("Bruksområde") {
                    TextField("Bruksområde (kort)", text: $useCase, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("Integrasjon (detaljert)", text: $integrationDesc, axis: .vertical)
                        .lineLimit(3...6)
                    TextField("Forventet API-kall/mnd", text: $expectedCalls)
                        .keyboardType(.numberPad)
                }
                Section("Vilkår") {
                    Button {
                        Task { await loadTerms() }
                    } label: {
                        Label("Les Leadgrid Partner-vilkår", systemImage: "doc.text.fill")
                    }
                    Toggle("Jeg godkjenner vilkårene", isOn: $agreedToTerms)
                }
                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        if sending { ProgressView() }
                        else { Label("Send søknad", systemImage: "paperplane.fill") }
                    }
                    .disabled(sending || email.isEmpty || !agreedToTerms)
                }
                if let result {
                    Section { Text(result).font(.callout).foregroundStyle(.purple) }
                }
            }
            .navigationTitle("Utvikler-program")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { dismiss() }
                }
            }
            .sheet(isPresented: $showTerms) {
                if let t = terms {
                    NavigationStack {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 12) {
                                Text(t.title).font(.title2.bold())
                                Text("Versjon: \(t.version)").font(.caption).foregroundStyle(.secondary)
                                Text(t.body).font(.callout)
                            }
                            .padding()
                        }
                        .navigationTitle("Partner-vilkår")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button("Ferdig") { showTerms = false }
                            }
                        }
                    }
                }
            }
        }
    }

    private func loadTerms() async {
        do {
            terms = try await api.fetchLeadgridPartnerTerms()
            showTerms = true
        } catch {
            result = "Kunne ikke laste vilkår"
        }
    }

    private func submit() async {
        sending = true
        do {
            try await api.submitDeveloperApplication(
                payload: LeadgridDeveloperApplication(
                    id: nil, email: email,
                    fullName: fullName.isEmpty ? nil : fullName,
                    organizationName: orgName.isEmpty ? nil : orgName,
                    website: website.isEmpty ? nil : website,
                    useCase: useCase.isEmpty ? nil : useCase,
                    integrationDescription: integrationDesc.isEmpty ? nil : integrationDesc,
                    expectedMonthlyApiCalls: Int(expectedCalls),
                    status: nil, createdAt: nil, reviewedAt: nil,
                ),
                agreedToTerms: agreedToTerms,
            )
            result = "Sendt — du får svar innen 2 virkedager"
        } catch {
            result = "Feilet: \(error.localizedDescription)"
        }
        sending = false
    }
}
