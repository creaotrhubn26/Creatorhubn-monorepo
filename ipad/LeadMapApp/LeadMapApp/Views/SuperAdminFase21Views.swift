// SuperAdminFase21Views.swift
//
// Fase 21: 9 nye iPad-views — lukker hele admin-room-paritet.
// Koblet til 4 nye backend-endepunkter + 5 eksisterende.

import SwiftUI

// ============================================================
// MARK: - Leads growth (B2B-vekst-graf)
// ============================================================

struct SuperAdminLeadsGrowthView: View {
    let api: APIClient

    @State private var data: LeadsGrowthResponse?
    @State private var loading = true
    @State private var selectedPeriod = "12m"
    @State private var errorText: String?

    var body: some View {
        List {
            Section {
                Picker("Periode", selection: $selectedPeriod) {
                    Text("3 mnd").tag("3m")
                    Text("6 mnd").tag("6m")
                    Text("12 mnd").tag("12m")
                }
                .pickerStyle(.segmented)
                .onChange(of: selectedPeriod) { _, _ in
                    Task { await load() }
                }
            }
            if loading && data == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let d = data {
                Section("Total (\(d.period))") {
                    HStack(spacing: 12) {
                        miniMetric("Nye", "\(d.totalNew)", .green)
                        miniMetric("Konvertert", "\(d.totalConverted)", .purple)
                        miniMetric("Churn", "\(d.totalChurned)", d.totalChurned > 0 ? .red : .secondary)
                    }
                }
                Section("Per måned (\(d.buckets.count))") {
                    ForEach(d.buckets) { b in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(b.month).font(.subheadline.bold())
                                Spacer()
                                Text("\(b.new) nye · \(b.converted) konv")
                                    .font(.caption.bold())
                                    .foregroundStyle(.purple)
                            }
                            GeometryReader { geo in
                                let maxVal = max(1, d.buckets.map { $0.new }.max() ?? 1)
                                let w = geo.size.width * CGFloat(b.new) / CGFloat(maxVal)
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.secondary.opacity(0.15))
                                        .frame(height: 6)
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.green)
                                        .frame(width: w, height: 6)
                                }
                            }
                            .frame(height: 6)
                            if b.churned > 0 {
                                Text("Churn: \(b.churned)").font(.caption2).foregroundStyle(.red)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Leads-vekst")
        .task { await load() }
        .refreshable { await load() }
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

    private func load() async {
        await MainActor.run { loading = true }
        do {
            let d = try await api.fetchLeadsGrowth(period: selectedPeriod)
            await MainActor.run {
                data = d
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
// MARK: - Social connections
// ============================================================

struct SuperAdminSocialConnectionsView: View {
    let api: APIClient

    @State private var data: SocialConnectionsStatusResponse?
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && data == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let d = data {
                Section {
                    HStack {
                        miniMetric("Tilkoblet", "\(d.totalConnected)", .green)
                        miniMetric("Totalt", "\(d.totalConnections)", .purple)
                    }
                }
                if let byProv = d.byProvider, !byProv.isEmpty {
                    Section("Per provider") {
                        ForEach(byProv.sorted(by: { $0.key < $1.key }), id: \.key) { prov, count in
                            HStack {
                                Image(systemName: providerIcon(prov))
                                    .foregroundStyle(providerColor(prov))
                                Text(prov.capitalized).font(.subheadline.bold())
                                Spacer()
                                Text("\(count.connected) / \(count.total)")
                                    .font(.caption.bold())
                                    .foregroundStyle(count.connected > 0 ? .green : .secondary)
                            }
                        }
                    }
                }
                if !d.connections.isEmpty {
                    Section("Koblinger (\(d.connections.count))") {
                        ForEach(d.connections) { c in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Image(systemName: providerIcon(c.provider))
                                        .foregroundStyle(providerColor(c.provider))
                                    Text(c.accountName ?? c.provider).font(.subheadline.bold())
                                    Spacer()
                                    Circle().fill(c.connected ? Color.green : Color.secondary)
                                        .frame(width: 8, height: 8)
                                }
                                if let org = c.orgName {
                                    Text(org).font(.caption2).foregroundStyle(.secondary)
                                }
                                if let exp = c.expiresAt {
                                    Text("Utløper: \(LeadgridDate.formatNo(exp))")
                                        .font(.caption2)
                                        .foregroundStyle(.orange)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                if let note = d.note {
                    Section { Text(note).font(.caption).foregroundStyle(.secondary) }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Sosiale koblinger")
        .task { await load() }
        .refreshable { await load() }
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

    private func providerIcon(_ p: String) -> String {
        switch p.lowercased() {
        case "facebook": return "f.square.fill"
        case "instagram": return "camera.fill"
        case "linkedin": return "person.crop.square.fill"
        case "tiktok": return "music.note"
        case "youtube": return "play.rectangle.fill"
        case "google": return "g.circle.fill"
        default: return "link"
        }
    }

    private func providerColor(_ p: String) -> Color {
        switch p.lowercased() {
        case "facebook": return .blue
        case "instagram": return .pink
        case "linkedin": return .indigo
        case "tiktok": return .black
        case "youtube": return .red
        case "google": return .orange
        default: return .secondary
        }
    }

    private func load() async {
        do {
            let d = try await api.fetchSocialConnectionsStatus()
            await MainActor.run {
                data = d
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
// MARK: - Competitor report (Claude SWOT)
// ============================================================

struct SuperAdminCompetitorReportView: View {
    let competitorId: String
    let competitorName: String
    let api: APIClient

    @State private var report: CompetitorReportResponse?
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if loading && report == nil {
                    HStack { Spacer(); ProgressView("Genererer rapport…"); Spacer() }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 30)
                } else if let r = report {
                    if r.cached == false {
                        Label("Frisk-generert med Claude", systemImage: "sparkles")
                            .font(.caption.bold())
                            .padding(8)
                            .background(Color.purple.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                    }

                    // SWOT-kort
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                    ], spacing: 8) {
                        swotCard("Styrker", r.swot.strengths, .green)
                        swotCard("Svakheter", r.swot.weaknesses, .red)
                        swotCard("Muligheter", r.swot.opportunities, .blue)
                        swotCard("Trusler", r.swot.threats, .orange)
                    }

                    // Anbefalinger
                    if !r.recommendations.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Anbefalte trekk", systemImage: "arrow.right.circle.fill")
                                .font(.headline)
                                .foregroundStyle(.purple)
                            ForEach(Array(r.recommendations.enumerated()), id: \.offset) { idx, rec in
                                HStack(alignment: .top, spacing: 8) {
                                    Text("\(idx + 1).").font(.caption.bold())
                                        .foregroundStyle(.purple)
                                    Text(rec).font(.callout)
                                }
                            }
                        }
                        .padding(12)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                    }

                    // Full markdown-rapport
                    if !r.reportMd.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Full rapport", systemImage: "doc.text.fill")
                                .font(.headline)
                            Text(r.reportMd)
                                .font(.callout)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(12)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                    }

                    if let gen = r.generatedAt {
                        Text("Generert: \(LeadgridDate.formatNo(gen)) (\(r.modelUsed ?? "—"))")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
                if let errorText {
                    Text(errorText).foregroundStyle(.red).font(.caption)
                }
            }
            .padding()
        }
        .navigationTitle(competitorName)
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func swotCard(_ title: String, _ items: [String], _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(.caption2.bold())
                .foregroundStyle(color)
            if items.isEmpty {
                Text("—").font(.caption).foregroundStyle(.secondary)
            } else {
                ForEach(items.prefix(4), id: \.self) { item in
                    Text("• \(item)").font(.caption).lineLimit(3)
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 80, alignment: .topLeading)
        .padding(10)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
    }

    private func load() async {
        do {
            let r = try await api.fetchCompetitorReport(competitorId: competitorId)
            await MainActor.run {
                report = r
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke generere"
                loading = false
            }
        }
    }
}

// ============================================================
// MARK: - Resend status
// ============================================================

struct SuperAdminResendStatusView: View {
    let api: APIClient

    @State private var status: ResendStatusResponse?
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && status == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let s = status {
                Section {
                    HStack(spacing: 12) {
                        Image(systemName: s.healthy ? "checkmark.shield.fill" : "exclamationmark.shield.fill")
                            .font(.title)
                            .foregroundStyle(s.healthy ? .green : .red)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.healthy ? "Sunn" : "Feil").font(.headline.bold())
                            if !s.apiConfigured {
                                Text("RESEND_API_KEY ikke satt").font(.caption).foregroundStyle(.red)
                            }
                        }
                        Spacer()
                    }
                }
                Section("Domener") {
                    HStack {
                        miniMetric("Verifiserte", "\(s.verifiedDomainCount)", .green)
                        miniMetric("Totalt", "\(s.domainCount)", .purple)
                    }
                    if let domains = s.domains, !domains.isEmpty {
                        ForEach(domains) { d in
                            HStack {
                                Text(d.name).font(.caption.monospaced())
                                Spacer()
                                statusChip(d.status)
                            }
                        }
                    }
                }
                if let emails = s.recentEmails, !emails.isEmpty {
                    Section("Siste e-poster (\(emails.count))") {
                        ForEach(emails) { e in
                            VStack(alignment: .leading, spacing: 2) {
                                HStack {
                                    Text(e.to).font(.caption.monospaced()).lineLimit(1)
                                    Spacer()
                                    statusChip(e.status)
                                }
                                Text(e.subject).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                                Text(LeadgridDate.relativeAgo(e.sentAt)).font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
                if let err = s.lastErrorMessage, !err.isEmpty {
                    Section("Siste feil") {
                        Text(err).font(.caption).foregroundStyle(.red)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Resend")
        .task { await load() }
        .refreshable { await load() }
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
    private func statusChip(_ s: String) -> some View {
        let color: Color = s == "verified" || s == "sent" || s == "delivered" ? .green
            : s == "failed" || s == "bounced" ? .red : .orange
        Text(s.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        do {
            let s = try await api.fetchResendStatus()
            await MainActor.run {
                status = s
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
// MARK: - Post drafts (eksisterende endpoint)
// ============================================================

struct SuperAdminPostDraftsView: View {
    let api: APIClient

    @State private var drafts: [MarketingPostDraft] = []
    @State private var loading = true
    @State private var statusFilter = "draft"
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            Section {
                Picker("Status", selection: $statusFilter) {
                    Text("Drafts").tag("draft")
                    Text("Planlagt").tag("scheduled")
                    Text("Publisert").tag("published")
                }
                .pickerStyle(.segmented)
                .onChange(of: statusFilter) { _, _ in
                    Task { await load() }
                }
            }
            if loading && drafts.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if drafts.isEmpty {
                Section { Text("Ingen drafts").foregroundStyle(.secondary) }
            } else {
                Section("Drafts (\(drafts.count))") {
                    ForEach(drafts) { d in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(d.platform.capitalized).font(.caption2.bold())
                                    .padding(.horizontal, 6).padding(.vertical, 1)
                                    .background(Color.purple.opacity(0.20), in: Capsule())
                                Spacer()
                                if let s = d.scheduledAt {
                                    Text(LeadgridDate.formatNo(s)).font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            if let content = d.content {
                                Text(content).font(.callout).lineLimit(3)
                            }
                            if let mediaCount = d.mediaUrls?.count, mediaCount > 0 {
                                Label("\(mediaCount) media", systemImage: "photo")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task { await deleteDraft(d) }
                            } label: {
                                Label("Slett", systemImage: "trash")
                            }
                            if d.status != "published" {
                                Button {
                                    Task { await publish(d) }
                                } label: {
                                    Label("Publiser", systemImage: "paperplane.fill")
                                }
                                .tint(.green)
                            }
                        }
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Post drafts")
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
        await MainActor.run { loading = true }
        do {
            let r = try await api.fetchPostDrafts(status: statusFilter)
            await MainActor.run {
                drafts = r.drafts
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func deleteDraft(_ d: MarketingPostDraft) async {
        do {
            try await api.deletePostDraft(id: d.id)
            await flash("Slettet")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func publish(_ d: MarketingPostDraft) async {
        do {
            try await api.publishPostDraft(id: d.id)
            await flash("Publisert")
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
// MARK: - Content calendar
// ============================================================

struct SuperAdminContentCalendarView: View {
    let api: APIClient

    @State private var items: [ContentCalendarItem] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && items.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if items.isEmpty {
                Section { Text("Ingen kalender-poster").foregroundStyle(.secondary) }
            } else {
                Section("Innhold (\(items.count))") {
                    ForEach(items) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                if let title = item.title {
                                    Text(title).font(.subheadline.bold()).lineLimit(1)
                                }
                                Spacer()
                                if let status = item.status {
                                    Text(status.uppercased()).font(.caption2.bold())
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(statusColor(status).opacity(0.20), in: Capsule())
                                        .foregroundStyle(statusColor(status))
                                }
                            }
                            if let platforms = item.platforms, !platforms.isEmpty {
                                Text(platforms.joined(separator: ", "))
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                            if let sched = item.scheduledFor {
                                Text("Planlagt: \(LeadgridDate.formatNo(sched))")
                                    .font(.caption2).foregroundStyle(.purple)
                            }
                            if let copy = item.copyText {
                                Text(copy).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Content-kalender")
        .task { await load() }
        .refreshable { await load() }
    }

    private func statusColor(_ s: String) -> Color {
        switch s {
        case "published": return .green
        case "scheduled": return .purple
        case "draft": return .secondary
        default: return .orange
        }
    }

    private func load() async {
        do {
            let r = try await api.fetchContentCalendar()
            await MainActor.run {
                items = r.items
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
// MARK: - What's new
// ============================================================

struct SuperAdminWhatsNewView: View {
    let api: APIClient

    @State private var items: [WhatsNewEntry] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && items.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if items.isEmpty {
                Section { Text("Ingen oppføringer").foregroundStyle(.secondary) }
            } else {
                ForEach(items) { e in
                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                if let cat = e.category {
                                    Text(cat.uppercased()).font(.caption2.bold())
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(catColor(cat).opacity(0.20), in: Capsule())
                                        .foregroundStyle(catColor(cat))
                                }
                                if e.pinned == true {
                                    Image(systemName: "pin.fill").foregroundStyle(.yellow)
                                }
                                Spacer()
                                if let pub = e.publishedAt {
                                    Text(LeadgridDate.formatNo(pub)).font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Text(e.title).font(.headline)
                            if let body = e.body {
                                Text(body).font(.callout).foregroundStyle(.secondary)
                            }
                            if let link = e.linkUrl, let url = URL(string: link) {
                                Link(destination: url) {
                                    Label("Les mer", systemImage: "arrow.up.right.square")
                                        .font(.caption.bold())
                                }
                            }
                        }
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("What's new")
        .task { await load() }
        .refreshable { await load() }
    }

    private func catColor(_ c: String) -> Color {
        switch c.lowercased() {
        case "feature": return .green
        case "fix": return .blue
        case "announcement": return .purple
        default: return .secondary
        }
    }

    private func load() async {
        do {
            let r = try await api.fetchWhatsNew()
            await MainActor.run {
                items = r.items
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
// MARK: - B2 Archive
// ============================================================

struct SuperAdminB2ArchiveView: View {
    let api: APIClient

    @State private var creatorhubUsage: B2ArchiveUsage?
    @State private var roleRoomUsage: B2ArchiveUsage?
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && creatorhubUsage == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else {
                if let u = creatorhubUsage {
                    bucketSection("Creatorhub-archive", u)
                }
                if let u = roleRoomUsage {
                    bucketSection("Role-Room-prod", u)
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("B2 Archive")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func bucketSection(_ title: String, _ u: B2ArchiveUsage) -> some View {
        Section(title) {
            HStack {
                Label("Bucket", systemImage: "externaldrive.fill")
                Spacer()
                Text(u.bucketName ?? "—").font(.caption.monospaced())
            }
            HStack {
                Label("Størrelse", systemImage: "ruler.fill")
                Spacer()
                Text(String(format: "%.2f GB", u.totalGB)).font(.subheadline.bold())
            }
            HStack {
                Label("Filer", systemImage: "doc.fill")
                Spacer()
                Text("\(u.fileCount ?? 0)").font(.subheadline.bold())
            }
            if let last = u.lastChangeAt {
                HStack {
                    Label("Sist endret", systemImage: "clock")
                    Spacer()
                    Text(LeadgridDate.formatNo(last)).font(.caption)
                }
            }
        }
    }

    private func load() async {
        do {
            async let c: B2ArchiveUsage? = try? await api.fetchB2ArchiveUsage(roleRoom: false)
            async let r: B2ArchiveUsage? = try? await api.fetchB2ArchiveUsage(roleRoom: true)
            let cVal = await c
            let rVal = await r
            await MainActor.run {
                creatorhubUsage = cVal
                roleRoomUsage = rVal
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
// MARK: - Migrations status
// ============================================================

struct SuperAdminMigrationsStatusView: View {
    let api: APIClient

    @State private var status: MigrationsStatus?
    @State private var loading = true
    @State private var running = false
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading && status == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let s = status {
                Section {
                    HStack(spacing: 12) {
                        Image(systemName: s.lockHeld ? "lock.fill" : "checkmark.shield.fill")
                            .font(.title)
                            .foregroundStyle(s.lockHeld ? .orange : .green)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.lockHeld ? "Run pågår" : "Klar").font(.headline.bold())
                            Text("\(s.pendingCount) pending").font(.caption)
                                .foregroundStyle(s.pendingCount > 0 ? .orange : .secondary)
                        }
                        Spacer()
                    }
                }
                if let files = s.pendingFiles, !files.isEmpty {
                    Section("Pending-filer") {
                        ForEach(files, id: \.self) { f in
                            Text(f).font(.caption.monospaced())
                        }
                    }
                }
                if let last = s.lastRunAt {
                    Section("Siste run") {
                        HStack {
                            Text("Tidspunkt").font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text(LeadgridDate.formatNo(last)).font(.caption.bold())
                        }
                        if let status = s.lastRunStatus {
                            HStack {
                                Text("Status").font(.caption).foregroundStyle(.secondary)
                                Spacer()
                                Text(status.uppercased()).font(.caption.bold())
                                    .foregroundStyle(status == "success" ? .green : .red)
                            }
                        }
                        if let err = s.lastError {
                            Text(err).font(.caption2).foregroundStyle(.red).lineLimit(3)
                        }
                    }
                }
                if s.pendingCount > 0 && !s.lockHeld {
                    Section {
                        Button {
                            Task { await runMigrate() }
                        } label: {
                            if running {
                                ProgressView()
                            } else {
                                Label("Kjør migrasjoner", systemImage: "play.fill")
                            }
                        }
                        .disabled(running)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Migrasjoner")
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
            let s = try await api.fetchMigrationsStatus()
            await MainActor.run {
                status = s
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func runMigrate() async {
        await MainActor.run { running = true }
        do {
            try await api.runMigrations()
            await flash("Migrasjon trigget")
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            await load()
        } catch {
            await flash("Feilet")
        }
        await MainActor.run { running = false }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}
