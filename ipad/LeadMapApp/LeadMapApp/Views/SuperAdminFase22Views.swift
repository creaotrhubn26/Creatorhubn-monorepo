// SuperAdminFase22Views.swift
//
// Fase 22: De 5 siste super-admin-views — full paritet med web.
// Alle endepunkter eksisterer allerede.

import SwiftUI

// ============================================================
// MARK: - Observability (errors-dashboard)
// ============================================================

struct SuperAdminObservabilityView: View {
    let api: APIClient

    @State private var stats: AdminErrorsStats?
    @State private var errors: [AdminErrorEntry] = []
    @State private var loading = true
    @State private var levelFilter: String? = nil
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if let s = stats {
                Section {
                    HStack {
                        miniMetric("Totalt", "\(s.total)", .purple)
                        miniMetric("Uløst", "\(s.unresolved)", s.unresolved > 0 ? .orange : .green)
                        miniMetric("Kritisk", "\(s.critical)", s.critical > 0 ? .red : .secondary)
                        miniMetric("24t", "\(s.last24h)", .blue)
                    }
                }
                if let bySource = s.bySource, !bySource.isEmpty {
                    Section("Per source") {
                        ForEach(bySource.sorted(by: { $0.value > $1.value }), id: \.key) { source, count in
                            HStack {
                                Text(source).font(.caption.monospaced())
                                Spacer()
                                Text("\(count)").font(.caption.bold())
                            }
                        }
                    }
                }
            }

            Section {
                Picker("Nivå", selection: $levelFilter) {
                    Text("Alle").tag(String?.none)
                    Text("Error").tag(String?.some("error"))
                    Text("Warning").tag(String?.some("warning"))
                    Text("Critical").tag(String?.some("critical"))
                }
                .pickerStyle(.segmented)
                .onChange(of: levelFilter) { _, _ in
                    Task { await load() }
                }
            }

            if loading && errors.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if errors.isEmpty {
                Section { Text("Ingen feil").foregroundStyle(.secondary) }
            } else {
                Section("Feil (\(errors.count))") {
                    ForEach(errors) { e in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                levelChip(e.level ?? "error")
                                if let count = e.occurrenceCount, count > 1 {
                                    Text("×\(count)").font(.caption2.bold())
                                        .foregroundStyle(.red)
                                }
                                Spacer()
                                if e.resolvedAt != nil {
                                    Image(systemName: "checkmark.seal.fill").foregroundStyle(.green)
                                }
                                if let created = e.createdAt {
                                    Text(LeadgridDate.relativeAgo(created)).font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            if let title = e.title { Text(title).font(.subheadline.bold()).lineLimit(2) }
                            if let msg = e.message {
                                Text(msg).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                            }
                            if let ep = e.endpoint {
                                Text(ep).font(.caption2.monospaced()).foregroundStyle(.purple).lineLimit(1)
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions {
                            if e.resolvedAt == nil {
                                Button {
                                    Task { await resolve(e) }
                                } label: {
                                    Label("Løs", systemImage: "checkmark.circle.fill")
                                }
                                .tint(.green)
                            } else {
                                Button {
                                    Task { await reopen(e) }
                                } label: {
                                    Label("Åpne igjen", systemImage: "arrow.uturn.left")
                                }
                                .tint(.orange)
                            }
                        }
                    }
                }
            }

            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Observability")
        .task { await load() }
        .refreshable { await load() }
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
    }

    @ViewBuilder
    private func miniMetric(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title3.bold()).foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
    }

    @ViewBuilder
    private func levelChip(_ level: String) -> some View {
        let color: Color = level == "critical" ? .red
            : level == "error" ? .red
            : level == "warning" ? .orange : .blue
        Text(level.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        await MainActor.run { loading = true }
        do {
            async let s: AdminErrorsStatsResponse? = try? await api.fetchAdminErrorsStats()
            async let e: AdminErrorsResponse = api.fetchAdminErrors(level: levelFilter)
            let sVal = await s
            let eVal = try await e
            await MainActor.run {
                stats = sVal?.stats
                errors = eVal.errors
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func resolve(_ e: AdminErrorEntry) async {
        do {
            try await api.resolveAdminError(id: e.id)
            await flash("Løst")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func reopen(_ e: AdminErrorEntry) async {
        do {
            try await api.reopenAdminError(id: e.id)
            await flash("Åpnet igjen")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}

// ============================================================
// MARK: - Market Intelligence (Market Scans)
// ============================================================

struct SuperAdminMarketScansView: View {
    let api: APIClient

    @State private var scans: [MarketScan] = []
    @State private var loading = true
    @State private var selectedScanId: String?
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && scans.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if scans.isEmpty {
                Section { Text("Ingen market-scans").foregroundStyle(.secondary) }
            } else {
                Section("Scans (\(scans.count))") {
                    ForEach(scans) { scan in
                        Button {
                            selectedScanId = scan.id
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(scan.name ?? "Untitled").font(.subheadline.bold())
                                    Spacer()
                                    statusChip(scan.status ?? "unknown")
                                }
                                HStack(spacing: 12) {
                                    if let industry = scan.industry {
                                        Text(industry).font(.caption2)
                                    }
                                    if let region = scan.region {
                                        Label(region, systemImage: "mappin.circle.fill")
                                            .font(.caption2).foregroundStyle(.purple)
                                    }
                                }
                                HStack(spacing: 8) {
                                    if let c = scan.competitorCount, c > 0 {
                                        Label("\(c) konkurrenter", systemImage: "person.3.fill")
                                            .font(.caption2).foregroundStyle(.secondary)
                                    }
                                    if let o = scan.opportunityCount, o > 0 {
                                        Label("\(o) muligheter", systemImage: "lightbulb.fill")
                                            .font(.caption2).foregroundStyle(.orange)
                                    }
                                }
                                if let tam = scan.totalAddressableMarketNok {
                                    Text("TAM: \(formatKr(tam))")
                                        .font(.caption.bold())
                                        .foregroundStyle(.green)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Market Scans")
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: Binding(
            get: { selectedScanId.map { IdWrap(id: $0) } },
            set: { selectedScanId = $0?.id }
        )) { wrap in
            SuperAdminMarketScanDetailView(scanId: wrap.id, api: api)
        }
    }

    private struct IdWrap: Identifiable { let id: String }

    @ViewBuilder
    private func statusChip(_ s: String) -> some View {
        let color: Color = s == "completed" ? .green
            : s == "running" ? .orange
            : s == "failed" ? .red : .secondary
        Text(s.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func formatKr(_ nok: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "NOK"
        f.locale = Locale(identifier: "nb_NO")
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: nok)) ?? "\(nok) kr"
    }

    private func load() async {
        do {
            let r = try await api.fetchMarketScans()
            await MainActor.run {
                scans = r.scans
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

struct SuperAdminMarketScanDetailView: View {
    let scanId: String
    let api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var competitors: [MarketScanCompetitor] = []
    @State private var opportunities: [MarketScanOpportunity] = []
    @State private var loading = true

    var body: some View {
        NavigationStack {
            List {
                if loading {
                    Section { HStack { Spacer(); ProgressView(); Spacer() } }
                } else {
                    if !competitors.isEmpty {
                        Section("Konkurrenter (\(competitors.count))") {
                            ForEach(competitors) { c in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(c.name).font(.subheadline.bold())
                                        Spacer()
                                        if let t = c.threatLevel {
                                            Text(t.uppercased()).font(.caption2.bold())
                                                .foregroundStyle(threatColor(t))
                                        }
                                    }
                                    if let rev = c.estimatedRevenue {
                                        Text("Omsetning: \(Int(rev/1_000_000)) M NOK")
                                            .font(.caption2).foregroundStyle(.secondary)
                                    }
                                    if let pos = c.positioningSummary {
                                        Text(pos).font(.caption).foregroundStyle(.purple).lineLimit(3)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                    if !opportunities.isEmpty {
                        Section("Muligheter (\(opportunities.count))") {
                            ForEach(opportunities) { o in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(o.title).font(.subheadline.bold())
                                        Spacer()
                                        if let p = o.priority {
                                            Text(p.uppercased()).font(.caption2.bold())
                                                .foregroundStyle(priorityColor(p))
                                        }
                                    }
                                    if let desc = o.description {
                                        Text(desc).font(.caption).foregroundStyle(.secondary)
                                    }
                                    if let v = o.estimatedValueNok {
                                        Text("Verdi: \(Int(v/1000)) k NOK")
                                            .font(.caption.bold()).foregroundStyle(.green)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Scan-detalj")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { dismiss() }
                }
            }
            .task { await load() }
        }
    }

    private func threatColor(_ t: String) -> Color {
        switch t.lowercased() {
        case "high": return .red
        case "medium": return .orange
        default: return .green
        }
    }

    private func priorityColor(_ p: String) -> Color {
        switch p.lowercased() {
        case "high", "critical": return .red
        case "medium": return .orange
        default: return .blue
        }
    }

    private func load() async {
        do {
            async let c: MarketScanCompetitorsResponse = api.fetchMarketScanCompetitors(scanId: scanId)
            async let o: MarketScanOpportunitiesResponse = api.fetchMarketScanOpportunities(scanId: scanId)
            competitors = try await c.competitors
            opportunities = try await o.opportunities
            loading = false
        } catch {
            await MainActor.run { loading = false }
        }
    }
}

// ============================================================
// MARK: - Lead Map Campaigns (ads-kampanjer)
// ============================================================

struct SuperAdminCampaignsView: View {
    let api: APIClient

    @State private var campaigns: [LeadMapCampaign] = []
    @State private var categoryConv: [CategoryConversion] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && campaigns.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else {
                if !campaigns.isEmpty {
                    Section("Kampanjer (\(campaigns.count))") {
                        ForEach(campaigns) { c in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(c.name).font(.subheadline.bold())
                                    Spacer()
                                    statusChip(c.status ?? "unknown")
                                }
                                if let p = c.platform {
                                    Text(p.replacingOccurrences(of: "_", with: " ").capitalized)
                                        .font(.caption2).foregroundStyle(.purple)
                                }
                                HStack(spacing: 10) {
                                    if let s = c.totalSpendNok {
                                        Label(String(format: "%.0f kr", s), systemImage: "creditcard")
                                            .font(.caption2)
                                    }
                                    if let l = c.totalLeads {
                                        Label("\(l)", systemImage: "person.2.fill")
                                            .font(.caption2).foregroundStyle(.green)
                                    }
                                    if let cpa = c.cpa {
                                        Text("CPA: \(Int(cpa))").font(.caption2).foregroundStyle(.orange)
                                    }
                                    if let conv = c.conversionRate {
                                        Text(String(format: "%.1f%% konv", conv * 100))
                                            .font(.caption2).foregroundStyle(.purple)
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                if !categoryConv.isEmpty {
                    Section("Konvertering per kategori") {
                        ForEach(categoryConv) { cat in
                            HStack {
                                Text(cat.category).font(.subheadline)
                                Spacer()
                                Text("\(cat.won)/\(cat.leads)").font(.caption.bold())
                                Text(String(format: "(%.0f%%)", cat.conversionPct))
                                    .font(.caption.bold()).foregroundStyle(.purple)
                            }
                        }
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Kampanjer")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func statusChip(_ s: String) -> some View {
        let color: Color = s == "active" ? .green : s == "paused" ? .orange : .secondary
        Text(s.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        do {
            async let c: LeadMapCampaignsResponse? = try? await api.fetchLeadMapCampaigns()
            async let cc: CategoryConversionResponse? = try? await api.fetchCategoryConversion()
            campaigns = (await c)?.campaigns ?? []
            categoryConv = (await cc)?.categories ?? []
            loading = false
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }
}

// ============================================================
// MARK: - Brand Kit (per prosjekt)
// ============================================================

struct SuperAdminBrandKitView: View {
    let api: APIClient
    let projectId: String

    @State private var brandKit: BrandKit?
    @State private var loading = true
    @State private var scanBusy = false
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let k = brandKit {
                if let logo = k.logoUrl, let url = URL(string: logo) {
                    Section {
                        HStack {
                            AsyncImage(url: url) { img in img.resizable().scaledToFit() } placeholder: {
                                Image(systemName: "photo").foregroundStyle(.secondary)
                            }
                            .frame(height: 60)
                            Spacer()
                        }
                    }
                }
                Section("Merkevare") {
                    if let n = k.companyName { kvRow("Selskap", n) }
                    if let t = k.tagline { kvRow("Tagline", t) }
                    if let v = k.voiceTone { kvRow("Stemme", v) }
                }
                Section("Farger") {
                    if let p = k.primaryColor {
                        HStack {
                            Text("Primær")
                            Spacer()
                            RoundedRectangle(cornerRadius: 4)
                                .fill(colorFromHex(p) ?? .secondary)
                                .frame(width: 30, height: 20)
                            Text(p).font(.caption.monospaced())
                        }
                    }
                    if let s = k.secondaryColor {
                        HStack {
                            Text("Sekundær")
                            Spacer()
                            RoundedRectangle(cornerRadius: 4)
                                .fill(colorFromHex(s) ?? .secondary)
                                .frame(width: 30, height: 20)
                            Text(s).font(.caption.monospaced())
                        }
                    }
                    if let f = k.fontFamily { kvRow("Font", f) }
                }
                if k.mission != nil || k.targetAudience != nil || k.usp != nil {
                    Section("Strategi") {
                        if let m = k.mission { textBlock("Mission", m) }
                        if let t = k.targetAudience { textBlock("Målgruppe", t) }
                        if let u = k.usp { textBlock("USP", u) }
                    }
                }
                if let socials = k.socialHandles, !socials.isEmpty {
                    Section("Sosiale") {
                        ForEach(socials.sorted(by: { $0.key < $1.key }), id: \.key) { platform, handle in
                            HStack {
                                Text(platform.capitalized)
                                Spacer()
                                Text(handle).font(.caption.monospaced())
                            }
                        }
                    }
                }
                Section {
                    Button {
                        Task { await scan() }
                    } label: {
                        if scanBusy { ProgressView() }
                        else { Label("Re-scan merkevare", systemImage: "arrow.triangle.2.circlepath") }
                    }
                    .disabled(scanBusy)
                }
                if let last = k.lastScannedAt {
                    Section {
                        Text("Sist scanned: \(LeadgridDate.formatNo(last))")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
            } else {
                Section { Text("Ingen brand-kit").foregroundStyle(.secondary) }
            }
        }
        .navigationTitle("Brand Kit")
        .task { await load() }
        .refreshable { await load() }
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
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

    @ViewBuilder
    private func textBlock(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption.bold()).foregroundStyle(.purple)
            Text(value).font(.callout).foregroundStyle(.secondary)
        }
    }

    private func load() async {
        do {
            let r = try await api.fetchBrandKit(projectId: projectId)
            await MainActor.run {
                brandKit = r.brandKit
                loading = false
            }
        } catch {
            await MainActor.run { loading = false }
        }
    }

    private func scan() async {
        await MainActor.run { scanBusy = true }
        do {
            let r = try await api.scanBrandKit(projectId: projectId)
            await MainActor.run {
                brandKit = r.brandKit
                snackbar = "Re-scannet"
            }
        } catch {
            await MainActor.run { snackbar = "Feilet" }
        }
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        await MainActor.run {
            scanBusy = false
            snackbar = nil
        }
    }
}

// ============================================================
// MARK: - Org Switcher (impersonation)
// ============================================================

struct SuperAdminOrgSwitcherView: View {
    let api: APIClient

    @State private var orgs: [SuperAdminOrgEntry] = []
    @State private var impersonation: ImpersonationStatus?
    @State private var loading = true
    @State private var snackbar: String?

    var body: some View {
        List {
            if let imp = impersonation, imp.active {
                Section {
                    HStack {
                        Image(systemName: "eye.fill").foregroundStyle(.orange)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Viser som").font(.caption).foregroundStyle(.secondary)
                            Text(imp.targetOrgName ?? imp.targetOrgId ?? "—")
                                .font(.subheadline.bold())
                        }
                        Spacer()
                        Button {
                            Task { await endImp() }
                        } label: {
                            Text("Avslutt").font(.caption.bold())
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            if loading && orgs.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if orgs.isEmpty {
                Section { Text("Ingen org-er").foregroundStyle(.secondary) }
            } else {
                Section("Organisasjoner (\(orgs.count))") {
                    ForEach(orgs) { o in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(o.name).font(.subheadline.bold())
                                Spacer()
                                if let plan = o.planKey {
                                    Text(plan).font(.caption2)
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(Color.purple.opacity(0.20), in: Capsule())
                                }
                            }
                            HStack(spacing: 12) {
                                if let c = o.memberCount {
                                    Label("\(c) medlemmer", systemImage: "person.3")
                                        .font(.caption2).foregroundStyle(.secondary)
                                }
                                if let last = o.lastActiveAt {
                                    Text("Aktiv \(LeadgridDate.relativeAgo(last))")
                                        .font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .navigationTitle("Org Switcher")
        .task { await load() }
        .refreshable { await load() }
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
    }

    private func load() async {
        do {
            async let o: SuperAdminOrgsResponse = api.fetchSuperAdminOrgs()
            async let i: ImpersonationStatus? = try? await api.fetchActiveImpersonation()
            orgs = try await o.organizations
            impersonation = await i
            loading = false
        } catch {
            await MainActor.run { loading = false }
        }
    }

    private func endImp() async {
        do {
            try await api.endImpersonation()
            await flash("Avsluttet")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}
