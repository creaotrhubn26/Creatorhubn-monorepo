// SuperAdminFase24Views.swift
//
// Fase 24: Newsletter-CMS + RR-økonomi + Outreach-templates.

import SwiftUI

// ============================================================
// MARK: - Newsletter
// ============================================================

struct SuperAdminNewsletterView: View {
    let api: APIClient

    @State private var stats: NewsletterStats?
    @State private var issues: [NewsletterIssue] = []
    @State private var loading = true
    @State private var selectedIssue: NewsletterIssue?
    @State private var errorText: String?
    @State private var snackbar: String?
    @State private var testRecipient = ""
    @State private var showTestSheet = false
    @State private var actingId: String?

    var body: some View {
        List {
            if let s = stats {
                Section("Sammendrag") {
                    HStack {
                        miniMetric("Issues", "\(s.totalIssues ?? 0)", .purple)
                        miniMetric("Subs", "\(s.totalSubscribers ?? 0)", .blue)
                        miniMetric("Sendt", "\(s.totalSent ?? 0)", .green)
                    }
                    if let open = s.avgOpenRate, let click = s.avgClickRate {
                        HStack {
                            miniMetric("Avg open", String(format: "%.0f%%", open * 100), .orange)
                            miniMetric("Avg click", String(format: "%.0f%%", click * 100), .indigo)
                            miniMetric("Vekst 30d", "+\(s.last30dGrowth ?? 0)", .green)
                        }
                    }
                }
            }
            if loading && issues.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if issues.isEmpty {
                Section { Text("Ingen issues").foregroundStyle(.secondary) }
            } else {
                Section("Issues (\(issues.count))") {
                    ForEach(issues) { i in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(i.title ?? "Untitled").font(.subheadline.bold()).lineLimit(1)
                                Spacer()
                                statusChip(i.status)
                            }
                            if let subject = i.subject {
                                Text(subject).font(.caption).foregroundStyle(.purple).lineLimit(1)
                            }
                            HStack(spacing: 12) {
                                if let s = i.scheduledFor {
                                    Label(LeadgridDate.formatNo(s), systemImage: "clock")
                                        .font(.caption2).foregroundStyle(.orange)
                                } else if let s = i.sentAt {
                                    Label(LeadgridDate.formatNo(s), systemImage: "paperplane.fill")
                                        .font(.caption2).foregroundStyle(.green)
                                }
                                if let count = i.sentCount, count > 0 {
                                    Text("\(count) sendt").font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                if let f = i.failedCount, f > 0 {
                                    Text("\(f) feilet").font(.caption2.bold())
                                        .foregroundStyle(.red)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions(edge: .trailing) {
                            if i.status == "draft" || i.status == "scheduled" {
                                Button {
                                    Task { await sendNow(i) }
                                } label: {
                                    Label("Send", systemImage: "paperplane.fill")
                                }
                                .tint(.green)
                            }
                            if i.status == "sent" {
                                Button {
                                    Task { await unpublish(i) }
                                } label: {
                                    Label("Avpubliser", systemImage: "eye.slash")
                                }
                                .tint(.orange)
                            }
                            Button {
                                selectedIssue = i
                                showTestSheet = true
                            } label: {
                                Label("Test", systemImage: "envelope.badge")
                            }
                            .tint(.purple)
                        }
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Newsletter")
        .superAdminBackdrop(.marketing)
        .task { await load() }
        .refreshable { await load() }
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
        .sheet(isPresented: $showTestSheet) {
            NavigationStack {
                Form {
                    if let i = selectedIssue {
                        Section("Issue") {
                            Text(i.title ?? "—").font(.callout)
                        }
                    }
                    Section("Test-mottaker") {
                        TextField("email@domene.no", text: $testRecipient)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                    }
                    Section {
                        Button {
                            Task { await sendTest() }
                        } label: {
                            Label("Send test", systemImage: "paperplane.fill")
                        }
                        .disabled(testRecipient.isEmpty || actingId != nil)
                    }
                }
                .navigationTitle("Test-send")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Avbryt") {
                            showTestSheet = false
                            testRecipient = ""
                        }
                    }
                }
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
    private func statusChip(_ s: String) -> some View {
        let color: Color = s == "sent" ? .green : s == "scheduled" ? .orange
            : s == "unpublished" ? .red : .secondary
        Text(s.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        do {
            async let stat: NewsletterStatsResponse? = try? await api.fetchNewsletterStats()
            async let iss: NewsletterIssuesResponse = api.fetchNewsletterIssues()
            stats = (await stat)?.stats
            issues = try await iss.issues
            loading = false
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func sendNow(_ i: NewsletterIssue) async {
        await MainActor.run { actingId = i.id }
        do {
            try await api.sendNewsletter(issueId: i.id)
            await flash("Sender — sjekk status om 1min")
            await load()
        } catch {
            await flash("Feilet")
        }
        await MainActor.run { actingId = nil }
    }

    private func unpublish(_ i: NewsletterIssue) async {
        do {
            try await api.unpublishNewsletter(issueId: i.id)
            await flash("Avpublisert")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func sendTest() async {
        guard let i = selectedIssue else { return }
        await MainActor.run { actingId = i.id }
        do {
            try await api.sendNewsletterTest(issueId: i.id, recipient: testRecipient)
            await flash("Test sendt til \(testRecipient)")
            await MainActor.run {
                showTestSheet = false
                testRecipient = ""
            }
        } catch {
            await flash("Feilet")
        }
        await MainActor.run { actingId = nil }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}

// ============================================================
// MARK: - RR-Økonomi (Stripe-data per RR-kunde)
// ============================================================

struct SuperAdminRREconomyView: View {
    let api: APIClient

    @State private var aggregate: RoleRoomEconomyAggregate?
    @State private var subscribers: [RoleRoomEconomySubscriber] = []
    @State private var timeseries: [RoleRoomEconomyTimeseriesPoint] = []
    @State private var statusFilter = "active"
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if let a = aggregate {
                Section("Nøkkeltall") {
                    HStack {
                        miniMetric("MRR", formatKr(a.mrrNok), .green)
                        miniMetric("ARR", formatKr(a.arrNok), .purple)
                    }
                    HStack {
                        miniMetric("Aktive", "\(a.activeSubscribers)", .blue)
                        miniMetric("Trial", "\(a.trialingCount)", .orange)
                        miniMetric("Avg ARPU", formatKr(a.avgArpuNok), .indigo)
                    }
                    if let churn = a.churnRatePct {
                        HStack {
                            miniMetric("Churn 30d", "\(a.canceledLast30d)", .red)
                            miniMetric("Nye 30d", "\(a.newLast30d)", .green)
                            miniMetric("Churn %", String(format: "%.1f%%", churn), .red)
                        }
                    }
                }
            }

            if !timeseries.isEmpty {
                Section("MRR-vekst (12 mnd)") {
                    ForEach(timeseries) { p in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(p.month).font(.subheadline.bold())
                                Spacer()
                                Text(formatKr(p.mrrNok)).font(.subheadline.bold())
                                    .foregroundStyle(.green)
                            }
                            HStack(spacing: 8) {
                                Text("Aktive: \(p.activeSubscribers)").font(.caption2)
                                Text("+\(p.newCount)").font(.caption2).foregroundStyle(.green)
                                Text("-\(p.canceledCount)").font(.caption2).foregroundStyle(.red)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            Section {
                Picker("Status", selection: $statusFilter) {
                    Text("Aktive").tag("active")
                    Text("Trial").tag("trialing")
                    Text("Past due").tag("past_due")
                    Text("Canceled").tag("canceled")
                }
                .pickerStyle(.segmented)
                .onChange(of: statusFilter) { _, _ in
                    Task { await loadSubs() }
                }
            }

            if !subscribers.isEmpty {
                Section("Abonnenter (\(subscribers.count))") {
                    ForEach(subscribers) { s in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(s.name ?? s.email ?? "—").font(.subheadline.bold())
                                Spacer()
                                if s.mrrNok > 0 {
                                    Text(formatKr(s.mrrNok)).font(.subheadline.bold())
                                        .foregroundStyle(.purple)
                                }
                            }
                            HStack(spacing: 12) {
                                if let plan = s.planKey {
                                    Text(plan).font(.caption2)
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(Color.purple.opacity(0.20), in: Capsule())
                                }
                                if let next = s.nextBillAt {
                                    Text("Neste: \(LeadgridDate.formatNo(next))").font(.caption2)
                                }
                                if let cancel = s.cancelAt {
                                    Text("Avsluttes: \(LeadgridDate.formatNo(cancel))")
                                        .font(.caption2).foregroundStyle(.red)
                                }
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("RR-økonomi")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func miniMetric(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title3.bold()).foregroundStyle(color).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
    }

    private func formatKr(_ kr: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "NOK"
        f.locale = Locale(identifier: "nb_NO")
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: kr)) ?? "\(kr)"
    }

    private func load() async {
        do {
            async let a: RoleRoomEconomyAggregate? = try? await api.fetchRoleRoomEconomyAggregate()
            async let t: RoleRoomEconomyTimeseriesResponse? = try? await api.fetchRoleRoomEconomyTimeseries(months: 12)
            async let s: RoleRoomEconomySubscribersResponse = api.fetchRoleRoomEconomySubscribers(status: statusFilter)
            aggregate = await a
            timeseries = (await t)?.points ?? []
            subscribers = try await s.subscribers
            loading = false
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func loadSubs() async {
        do {
            let r = try await api.fetchRoleRoomEconomySubscribers(status: statusFilter)
            await MainActor.run { subscribers = r.subscribers }
        } catch {
            await MainActor.run { errorText = "Kunne ikke laste subs" }
        }
    }
}

// ============================================================
// MARK: - Outreach-templates
// ============================================================

struct SuperAdminOutreachTemplatesView: View {
    let api: APIClient
    @Environment(AppState.self) private var appState

    @State private var templates: [OutreachTemplate] = []
    @State private var loading = true
    @State private var segmentFilter: String? = nil
    @State private var errorText: String?

    /// Segmenter er produkt-spesifikke (jf. mig 0335 + outreach-routes.ts).
    /// Role Room: casting/produsent/agentur etc. Leadgrid: B2B-byrå/
    /// markedssjef/franchise etc. (LEADGRID-OUTREACH-PLAN.md).
    private var segmentsForActiveProduct: [(String, String?)] {
        switch appState.activeAdminProduct {
        case .roleRoom:
            return [
                ("Alle", nil),
                ("Casting", "casting_director"),
                ("Produsent", "producer"),
                ("Agentur", "agency"),
                ("Skole", "education"),
            ]
        case .leadgrid:
            return [
                ("Alle", nil),
                ("B2B-byrå", "b2b_agency"),
                ("Markedssjef", "marketing_director"),
                ("Franchise HQ", "franchise_hq"),
                ("Bransje-foren.", "industry_assoc"),
                ("Ad-partner", "ad_partner"),
            ]
        }
    }

    var body: some View {
        List {
            // Product-velger: aktivt Admin Room-produkt styrer hvilke
            // templates som vises (per ?product=role_room|leadgrid).
            Section {
                AdminProductPicker()
            } header: {
                Text("Produkt-kontekst")
            }

            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(segmentsForActiveProduct, id: \.0) { s in
                            Button {
                                segmentFilter = s.1
                                Task { await load() }
                            } label: {
                                Text(s.0).font(.caption.bold())
                                    .padding(.horizontal, 12).padding(.vertical, 6)
                                    .background(
                                        segmentFilter == s.1
                                            ? Color.purple.opacity(0.25)
                                            : Color.secondary.opacity(0.10),
                                        in: Capsule(),
                                    )
                                    .foregroundStyle(segmentFilter == s.1 ? .purple : .primary)
                            }
                        }
                    }
                }
                .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
            }

            if loading && templates.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if templates.isEmpty {
                Section { Text("Ingen templates").foregroundStyle(.secondary) }
            } else {
                Section("Templates (\(templates.count))") {
                    ForEach(templates) { t in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                Text(t.name).font(.subheadline.bold())
                                if let seg = t.segment {
                                    Text(seg.capitalized).font(.caption2)
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(Color.purple.opacity(0.20), in: Capsule())
                                }
                                if let lang = t.language {
                                    Text(lang.uppercased()).font(.caption2)
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(Color.blue.opacity(0.20), in: Capsule())
                                }
                                Spacer()
                                if let count = t.useCount, count > 0 {
                                    Text("\(count)×").font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            if let subj = t.subjectTemplate {
                                Text(subj).font(.caption.bold()).lineLimit(1)
                            }
                            if let body = t.bodyTemplate {
                                Text(body).font(.caption).foregroundStyle(.secondary).lineLimit(3)
                            }
                            if let last = t.lastUsedAt {
                                Text("Sist brukt: \(LeadgridDate.relativeAgo(last))")
                                    .font(.caption2).foregroundStyle(.secondary)
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
        .navigationTitle("Outreach")
        .task { await load() }
        .refreshable { await load() }
        // Reload + reset segment-filter når produkt-kontekst endrer seg.
        // Segmentene er produkt-spesifikke (b2b_agency finnes ikke i
        // Role Room-katalogen).
        .onChange(of: appState.activeAdminProduct) { _, _ in
            segmentFilter = nil
            Task { await load() }
        }
    }

    private func load() async {
        await MainActor.run { loading = true }
        do {
            let r = try await api.fetchOutreachTemplates(
                product: appState.activeAdminProduct,
                segment: segmentFilter,
            )
            await MainActor.run {
                templates = r.templates
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
