// SuperAdminListViews.swift
//
// Fase 18: De øvrige 11 super-admin-listene. Kompakt format —
// hver view har read-only liste + relevante actions (godkjenn/avslå/
// revoke/test/sync) som SwipeActions eller toolbar.
//
// Web-paritet: frontend/client/src/components/leadgrid/*Tab.tsx
// + /api/superadmin/*-endepunkter.

import SwiftUI

// ============================================================
// MARK: - Onboarding-funnel (B2B-pipeline analytics)
// ============================================================

struct SuperAdminOnboardingFunnelView: View {
    let api: APIClient

    @State private var steps: [OnboardingFunnelStep] = []
    @State private var totalSignups: Int? = nil
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if let total = totalSignups {
                Section {
                    HStack {
                        Text("Totalt signups").font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Text("\(total)").font(.title3.bold())
                    }
                }
            }
            if loading && steps.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if steps.isEmpty {
                Section { Text("Ingen funnel-data ennå.").foregroundStyle(.secondary) }
            } else {
                Section("Steg") {
                    ForEach(steps) { s in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(s.step.capitalized).font(.subheadline.bold())
                                Spacer()
                                Text("\(s.entered) → \(s.completed)")
                                    .font(.caption.bold())
                                    .foregroundStyle(.purple)
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.secondary.opacity(0.15))
                                        .frame(height: 6)
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.purple)
                                        .frame(
                                            width: geo.size.width * pct(s),
                                            height: 6,
                                        )
                                }
                            }
                            .frame(height: 6)
                            HStack(spacing: 12) {
                                Text("Drop-off: \(s.droppedOff)").font(.caption2)
                                    .foregroundStyle(.red)
                                if let t = s.avgTimeMinutes {
                                    Text("Snitt: \(String(format: "%.1f", t)) min")
                                        .font(.caption2).foregroundStyle(.secondary)
                                }
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
        .navigationTitle("Onboarding-funnel")
        .task { await load() }
        .refreshable { await load() }
    }

    private func pct(_ s: OnboardingFunnelStep) -> CGFloat {
        guard s.entered > 0 else { return 0 }
        return CGFloat(s.completed) / CGFloat(s.entered)
    }

    private func load() async {
        do {
            let r = try await api.fetchOnboardingFunnel()
            await MainActor.run {
                steps = r.steps
                totalSignups = r.totalSignups
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
// MARK: - Payments-overview (MRR/ARR)
// ============================================================

struct SuperAdminPaymentsView: View {
    let api: APIClient

    @State private var metrics: PaymentOverviewMetrics?
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let m = metrics {
                Section("Nøkkeltall") {
                    metricRow("MRR", formatKr(m.mrrNok), icon: "arrow.up.circle.fill", color: .green)
                    metricRow("ARR", formatKr(m.arrNok), icon: "calendar.circle.fill", color: .purple)
                    metricRow("Aktive abonnement", "\(m.activeSubscriptions)", icon: "person.3.fill", color: .blue)
                    metricRow("I grace", "\(m.inGraceCount)", icon: "exclamationmark.triangle.fill", color: .orange)
                }
                Section("Siste 30 dager") {
                    metricRow("Nye kunder", "\(m.newCustomersLast30d)", icon: "person.fill.badge.plus", color: .green)
                    metricRow("Churn", "\(m.churnedLast30d)", icon: "person.fill.xmark", color: .red)
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Inntekter")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func metricRow(_ label: String, _ value: String, icon: String, color: Color) -> some View {
        HStack {
            Label(label, systemImage: icon).foregroundStyle(color)
            Spacer()
            Text(value).font(.headline)
        }
    }

    private func formatKr(_ kr: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "NOK"
        f.locale = Locale(identifier: "nb_NO")
        return f.string(from: NSNumber(value: kr)) ?? "\(kr) kr"
    }

    private func load() async {
        do {
            let r = try await api.fetchPaymentsOverview()
            await MainActor.run {
                metrics = r.metrics
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
// MARK: - Overage stats
// ============================================================

struct SuperAdminOverageStatsView: View {
    let api: APIClient

    @State private var overages: [OverageStat] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && overages.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if overages.isEmpty {
                Section {
                    ContentUnavailableView(
                        "Ingen overage",
                        systemImage: "gauge.with.dots.needle.0percent",
                        description: Text("Ingen orger har overskredet planen."),
                    )
                }
            } else {
                Section("Org-er m/ overskridelse (\(overages.count))") {
                    ForEach(overages) { o in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(o.orgName ?? String(o.orgId.prefix(10))).font(.subheadline.bold())
                                Spacer()
                                if let plan = o.planKey {
                                    Text(plan).font(.caption2)
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(Color.purple.opacity(0.20), in: Capsule())
                                }
                            }
                            HStack(spacing: 12) {
                                Text("\(o.customersActive)/\(o.customersLimit ?? 0) leads")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text("\(o.overageCharges) × overage").font(.caption)
                                Spacer()
                                Text(formatOere(o.overageAmountOereLast30d))
                                    .font(.caption.bold())
                                    .foregroundStyle(.purple)
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
        .navigationTitle("Overage")
        .task { await load() }
        .refreshable { await load() }
    }

    private func formatOere(_ oere: Int) -> String {
        let kr = Double(oere) / 100
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "NOK"
        f.locale = Locale(identifier: "nb_NO")
        return f.string(from: NSNumber(value: kr)) ?? "\(kr) kr"
    }

    private func load() async {
        do {
            let r = try await api.fetchOverageStats()
            await MainActor.run {
                overages = r.overages
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
// MARK: - WhatsApp templates
// ============================================================

struct SuperAdminWaTemplatesView: View {
    let api: APIClient

    @State private var templates: [WaTemplate] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var syncBusy = false
    @State private var snackbar: String?
    @State private var testingTemplateName: String?

    var body: some View {
        List {
            if loading && templates.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if templates.isEmpty {
                Section { Text("Ingen templates").foregroundStyle(.secondary) }
            } else {
                Section("Templates (\(templates.count))") {
                    ForEach(templates) { t in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                statusChip(t.status)
                                if let c = t.category {
                                    Text(c).font(.caption2)
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(Color.secondary.opacity(0.15), in: Capsule())
                                }
                                Spacer()
                                if let l = t.language {
                                    Text(l.uppercased()).font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                            Text(t.name).font(.subheadline.bold())
                            if let body = t.bodyText {
                                Text(body).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task { await deleteTemplate(t) }
                            } label: {
                                Label("Slett", systemImage: "trash")
                            }
                            Button {
                                testingTemplateName = t.name
                            } label: {
                                Label("Test-send", systemImage: "paperplane.fill")
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
        .navigationTitle("WA Templates")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        Task { await syncFromMeta() }
                    } label: {
                        Label("Sync fra Meta", systemImage: "arrow.triangle.2.circlepath")
                    }
                    Button {
                        Task { await syncToLeadgrid() }
                    } label: {
                        Label("Sync til Leadgrid", systemImage: "icloud.and.arrow.up")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .disabled(syncBusy)
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
        .sheet(item: Binding(
            get: { testingTemplateName.map { IdWrap(id: $0) } },
            set: { testingTemplateName = $0?.id }
        )) { wrap in
            WaTemplateTestSendSheet(templateName: wrap.id, api: api)
        }
    }

    private struct IdWrap: Identifiable { let id: String }

    @ViewBuilder
    private func statusChip(_ status: String?) -> some View {
        let s = status ?? "UNKNOWN"
        let color: Color = {
            switch s.uppercased() {
            case "APPROVED": return .green
            case "PENDING": return .orange
            case "REJECTED": return .red
            default: return .secondary
            }
        }()
        Text(s).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        do {
            let r = try await api.fetchWaTemplates()
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

    private func deleteTemplate(_ t: WaTemplate) async {
        do {
            try await api.deleteWaTemplate(name: t.name, orgKey: t.orgKey)
            await flash("Slettet")
            await load()
        } catch {
            await flash("Feilet: \(error.localizedDescription)")
        }
    }

    private func syncFromMeta() async {
        await MainActor.run { syncBusy = true }
        do {
            try await api.syncWaTemplatesFromMeta()
            await flash("Synket fra Meta")
            await load()
        } catch {
            await flash("Sync feilet")
        }
        await MainActor.run { syncBusy = false }
    }

    private func syncToLeadgrid() async {
        await MainActor.run { syncBusy = true }
        do {
            try await api.syncWaTemplatesToLeadgrid()
            await flash("Synket til Leadgrid")
        } catch {
            await flash("Sync feilet")
        }
        await MainActor.run { syncBusy = false }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}

struct WaTemplateTestSendSheet: View {
    let templateName: String
    let api: APIClient
    @Environment(\.dismiss) private var dismiss
    @State private var phone = ""
    @State private var sending = false
    @State private var result: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Telefon (+47…)") {
                    TextField("+4712345678", text: $phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                }
                Section {
                    Button {
                        Task { await send() }
                    } label: {
                        if sending {
                            ProgressView()
                        } else {
                            Label("Send test", systemImage: "paperplane.fill")
                        }
                    }
                    .disabled(sending || phone.isEmpty)
                }
                if let result {
                    Section { Text(result).font(.caption) }
                }
            }
            .navigationTitle("Test \(templateName)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { dismiss() }
                }
            }
        }
    }

    private func send() async {
        sending = true
        do {
            try await api.sendWaTemplateTest(name: templateName, phone: phone, params: nil)
            result = "Sendt"
        } catch {
            result = "Feilet: \(error.localizedDescription)"
        }
        sending = false
    }
}

// ============================================================
// MARK: - WA Org-configs
// ============================================================

struct SuperAdminWaOrgConfigsView: View {
    let api: APIClient

    @State private var configs: [WaOrgConfig] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading && configs.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if configs.isEmpty {
                Section { Text("Ingen org-configs").foregroundStyle(.secondary) }
            } else {
                Section("Org-configs (\(configs.count))") {
                    ForEach(configs) { c in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(c.displayName ?? c.orgKey).font(.subheadline.bold())
                                Spacer()
                                Toggle("", isOn: Binding(
                                    get: { c.active },
                                    set: { newVal in
                                        Task { await toggleActive(c, active: newVal) }
                                    }
                                ))
                                .labelsHidden()
                            }
                            if let p = c.phoneNumberId {
                                Text("Phone ID: \(p)").font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                            if let s = c.senderName {
                                Text("Sender: \(s)").font(.caption2).foregroundStyle(.secondary)
                            }
                            if let b = c.monthlyBudgetNok {
                                Text("Budsjett: \(String(format: "%.0f", b)) kr/mnd").font(.caption)
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
        .navigationTitle("WA Org-config")
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
            let r = try await api.fetchWaOrgConfigs()
            await MainActor.run {
                configs = r.configs
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func toggleActive(_ c: WaOrgConfig, active: Bool) async {
        do {
            try await api.updateWaOrgConfig(orgKey: c.orgKey, payload: ["active": active])
            await flash(active ? "Aktivert" : "Deaktivert")
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
// MARK: - Partner-applications (godkjenn/avslå)
// ============================================================

struct SuperAdminPartnerApplicationsView: View {
    let api: APIClient

    @State private var apps: [PartnerApplication] = []
    @State private var loading = true
    @State private var selectedStatus: String = "pending"
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            Section {
                Picker("Status", selection: $selectedStatus) {
                    Text("Pending").tag("pending")
                    Text("Approved").tag("approved")
                    Text("Rejected").tag("rejected")
                    Text("Sandbox").tag("sandbox")
                }
                .pickerStyle(.segmented)
                .onChange(of: selectedStatus) { _, _ in
                    Task { await load() }
                }
            }
            .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))

            if loading && apps.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if apps.isEmpty {
                Section { Text("Ingen søknader med dette filteret.").foregroundStyle(.secondary) }
            } else {
                Section("Søknader (\(apps.count))") {
                    ForEach(apps) { app in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(app.companyName).font(.subheadline.bold())
                                Spacer()
                                if let r = app.riskScore {
                                    Text("Risk: \(r)")
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(riskColor(r).opacity(0.20), in: Capsule())
                                        .foregroundStyle(riskColor(r))
                                }
                            }
                            Text("\(app.contactName) · \(app.contactEmail)")
                                .font(.caption).foregroundStyle(.secondary)
                            if let pitch = app.pitchSummary, !pitch.isEmpty {
                                Text(pitch).font(.caption).foregroundStyle(.purple).lineLimit(3)
                            }
                            if app.status == "pending" {
                                HStack(spacing: 8) {
                                    Button {
                                        Task { await approve(app) }
                                    } label: {
                                        Label("Godkjenn", systemImage: "checkmark.circle.fill")
                                    }
                                    .buttonStyle(.borderedProminent)
                                    .tint(.green)
                                    .font(.caption.bold())

                                    Button {
                                        Task { await reject(app) }
                                    } label: {
                                        Label("Avslå", systemImage: "xmark.circle.fill")
                                    }
                                    .buttonStyle(.bordered)
                                    .tint(.red)
                                    .font(.caption.bold())
                                }
                                .padding(.top, 4)
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
        .navigationTitle("Søknader")
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

    private func riskColor(_ score: Int) -> Color {
        if score >= 70 { return .red }
        if score >= 40 { return .orange }
        return .green
    }

    private func load() async {
        await MainActor.run { loading = true }
        do {
            let r = try await api.fetchPartnerApplications(status: selectedStatus)
            await MainActor.run {
                apps = r.applications
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func approve(_ app: PartnerApplication) async {
        do {
            try await api.approvePartnerApplication(id: app.id, notes: nil)
            await flash("Godkjent: \(app.companyName)")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func reject(_ app: PartnerApplication) async {
        do {
            try await api.rejectPartnerApplication(id: app.id, reason: nil)
            await flash("Avslått: \(app.companyName)")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}

// ============================================================
// MARK: - Partners-list (godkjente)
// ============================================================

struct SuperAdminPartnersListView: View {
    let api: APIClient

    @State private var partners: [SuperAdminPartner] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading && partners.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if partners.isEmpty {
                Section { Text("Ingen partnere ennå").foregroundStyle(.secondary) }
            } else {
                Section("Godkjente (\(partners.count))") {
                    ForEach(partners) { p in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 6) {
                                    Text(p.name).font(.subheadline.bold())
                                    if let tier = p.tier {
                                        Text(tier).font(.caption2)
                                            .padding(.horizontal, 6).padding(.vertical, 1)
                                            .background(Color.purple.opacity(0.20), in: Capsule())
                                    }
                                }
                                if let type = p.partnerType {
                                    Text(type).font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if !p.isActive {
                                Text("INAKTIV").font(.caption2.bold()).foregroundStyle(.red)
                            }
                        }
                        .swipeActions {
                            Button(role: .destructive) {
                                Task { await revoke(p) }
                            } label: {
                                Label("Trekk", systemImage: "xmark.circle.fill")
                            }
                        }
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Partnere")
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
            let r = try await api.fetchSuperAdminPartners()
            await MainActor.run {
                partners = r.partners
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func revoke(_ p: SuperAdminPartner) async {
        do {
            try await api.revokePartner(id: p.id)
            await flash("Trakk: \(p.name)")
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
// MARK: - Email-branding (read-only liste)
// ============================================================

struct SuperAdminEmailBrandingView: View {
    let api: APIClient

    @State private var configs: [EmailBrandingConfig] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && configs.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if configs.isEmpty {
                Section { Text("Ingen branding-configs").foregroundStyle(.secondary) }
            } else {
                Section("Branding per org (\(configs.count))") {
                    ForEach(configs) { c in
                        HStack(spacing: 10) {
                            if let l = c.logoUrl, let url = URL(string: l) {
                                AsyncImage(url: url) { img in
                                    img.resizable().scaledToFit()
                                } placeholder: {
                                    Image(systemName: "photo").foregroundStyle(.secondary)
                                }
                                .frame(width: 30, height: 30)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(c.displayName ?? c.orgKey).font(.subheadline.bold())
                                if let s = c.senderEmail {
                                    Text(s).font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if let color = c.primaryColor {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(colorFromHex(color) ?? .secondary)
                                    .frame(width: 24, height: 24)
                            }
                        }
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("E-post-branding")
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            let r = try await api.fetchEmailBrandingConfigs()
            await MainActor.run {
                configs = r.configs
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
// MARK: - API keys
// ============================================================

struct SuperAdminApiKeysView: View {
    let api: APIClient

    @State private var keys: [LeadgridApiKey] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading && keys.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if keys.isEmpty {
                Section { Text("Ingen API-nøkler").foregroundStyle(.secondary) }
            } else {
                Section("Aktive nøkler (\(keys.filter { $0.revokedAt == nil }.count))") {
                    ForEach(keys) { k in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(k.label ?? k.prefix).font(.subheadline.bold())
                                Spacer()
                                if k.revokedAt != nil {
                                    Text("TRUKKET").font(.caption2.bold()).foregroundStyle(.red)
                                }
                            }
                            Text(k.prefix).font(.caption2.monospaced()).foregroundStyle(.secondary)
                            if let org = k.orgName { Text(org).font(.caption2) }
                            if let last = k.lastUsedAt {
                                Text("Sist brukt: \(LeadgridDate.formatNo(last))")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions {
                            if k.revokedAt == nil {
                                Button(role: .destructive) {
                                    Task { await revoke(k) }
                                } label: {
                                    Label("Trekk", systemImage: "xmark.circle.fill")
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
        .navigationTitle("API-nøkler")
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
            let r = try await api.fetchSuperAdminApiKeys()
            await MainActor.run {
                keys = r.keys
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func revoke(_ k: LeadgridApiKey) async {
        do {
            try await api.revokeApiKey(id: k.id)
            await flash("Trukket")
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
// MARK: - Webhooks + deliveries
// ============================================================

struct SuperAdminWebhooksView: View {
    let api: APIClient

    @State private var endpoints: [WebhookEndpoint] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading && endpoints.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if endpoints.isEmpty {
                Section { Text("Ingen endpoints").foregroundStyle(.secondary) }
            } else {
                Section("Endpoints (\(endpoints.count))") {
                    ForEach(endpoints) { e in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(e.url).font(.caption.monospaced()).lineLimit(1)
                                Spacer()
                                Circle()
                                    .fill(e.active ? Color.green : Color.secondary)
                                    .frame(width: 8, height: 8)
                            }
                            if let org = e.orgName { Text(org).font(.caption2) }
                            if let evs = e.events, !evs.isEmpty {
                                Text(evs.joined(separator: ", "))
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                            if let last = e.lastDeliveryAt {
                                Text("Sist: \(LeadgridDate.formatNo(last)) · \(e.lastDeliveryStatus ?? "")")
                                    .font(.caption2)
                                    .foregroundStyle(e.lastDeliveryStatus == "failed" ? .red : .secondary)
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions {
                            Button(role: .destructive) {
                                Task { await deleteEndpoint(e) }
                            } label: {
                                Label("Slett", systemImage: "trash")
                            }
                            Button {
                                Task { await testEndpoint(e) }
                            } label: {
                                Label("Test", systemImage: "play.fill")
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
        .navigationTitle("Webhooks")
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
            let r = try await api.fetchWebhookEndpoints()
            await MainActor.run {
                endpoints = r.endpoints
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func testEndpoint(_ e: WebhookEndpoint) async {
        do {
            try await api.testWebhookEndpoint(id: e.id)
            await flash("Test-event sendt")
        } catch {
            await flash("Feilet")
        }
    }

    private func deleteEndpoint(_ e: WebhookEndpoint) async {
        do {
            try await api.deleteWebhookEndpoint(id: e.id)
            await flash("Slettet")
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
// MARK: - Notification-log (read-only)
// ============================================================

struct SuperAdminNotificationLogView: View {
    let api: APIClient

    @State private var log: [NotificationLogEntry] = []
    @State private var total: Int? = nil
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && log.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if log.isEmpty {
                Section { Text("Tom logg").foregroundStyle(.secondary) }
            } else {
                Section("Siste 100 (av \(total ?? log.count))") {
                    ForEach(log) { l in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                channelChip(l.channel)
                                statusChip(l.status)
                                Spacer()
                                if let c = l.createdAt {
                                    Text(LeadgridDate.formatNo(c)).font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Text(l.recipient).font(.caption).lineLimit(1)
                            if let t = l.templateKey {
                                Text(t).font(.caption2.monospaced()).foregroundStyle(.secondary)
                            }
                            if let err = l.errorMessage, !err.isEmpty {
                                Text(err).font(.caption2).foregroundStyle(.red).lineLimit(2)
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
        .navigationTitle("Varsel-log")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func channelChip(_ ch: String) -> some View {
        let (icon, color): (String, Color) = {
            switch ch {
            case "email": return ("envelope", .blue)
            case "sms": return ("message", .green)
            case "whatsapp": return ("phone.fill", .green)
            case "push": return ("bell.fill", .purple)
            default: return ("ellipsis.bubble", .secondary)
            }
        }()
        Label(ch.uppercased(), systemImage: icon)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    @ViewBuilder
    private func statusChip(_ s: String) -> some View {
        let color: Color = {
            switch s {
            case "sent", "delivered": return .green
            case "failed", "bounced": return .red
            default: return .orange
            }
        }()
        Text(s.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        do {
            let r = try await api.fetchSuperAdminNotificationLog(limit: 100)
            await MainActor.run {
                log = r.log
                total = r.total
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
// MARK: - TestFlight-testere
// ============================================================

struct SuperAdminTestflightTestersView: View {
    let api: APIClient

    @State private var testers: [TestflightTester] = []
    @State private var ascHealth: AscHealthResponse?
    @State private var loading = true
    @State private var syncBusy = false
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if let h = ascHealth {
                Section("ASC-status") {
                    HStack {
                        Circle().fill(h.healthy ? Color.green : Color.red)
                            .frame(width: 10, height: 10)
                        Text(h.healthy ? "Sunn" : "Feil").font(.subheadline.bold())
                        Spacer()
                        if let last = h.lastSyncAt {
                            Text("Sist sync: \(LeadgridDate.formatNo(last))")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let err = h.lastErrorMessage {
                        Text(err).font(.caption).foregroundStyle(.red).lineLimit(2)
                    }
                }
            }
            if loading && testers.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if testers.isEmpty {
                Section { Text("Ingen testere").foregroundStyle(.secondary) }
            } else {
                Section("Testere (\(testers.count))") {
                    ForEach(testers) { t in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("\(t.firstName ?? "") \(t.lastName ?? "")".trimmingCharacters(in: .whitespaces))
                                    .font(.subheadline.bold())
                                Spacer()
                                if let s = t.inviteStatus {
                                    Text(s.uppercased()).font(.caption2.bold())
                                        .padding(.horizontal, 6).padding(.vertical, 1)
                                        .background(inviteColor(s).opacity(0.20), in: Capsule())
                                        .foregroundStyle(inviteColor(s))
                                }
                            }
                            Text(t.email).font(.caption).foregroundStyle(.secondary)
                            HStack(spacing: 8) {
                                if let nda = t.ndaStatus, nda != "none" {
                                    Label(nda, systemImage: "doc.text.fill")
                                        .font(.caption2)
                                        .foregroundStyle(nda == "signed" ? .green : .orange)
                                }
                                if let v = t.lastBuildVersion {
                                    Text("Build: \(v)").font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions {
                            Button(role: .destructive) {
                                Task { await removeT(t) }
                            } label: {
                                Label("Fjern", systemImage: "person.badge.minus")
                            }
                            Button {
                                Task { await graduateT(t) }
                            } label: {
                                Label("Grad.", systemImage: "graduationcap.fill")
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
        .navigationTitle("TestFlight")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await syncFromAsc() }
                } label: {
                    if syncBusy { ProgressView().scaleEffect(0.7) } else {
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                }
                .disabled(syncBusy)
            }
        }
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

    private func inviteColor(_ s: String) -> Color {
        switch s {
        case "installed": return .green
        case "invited": return .blue
        case "dropped": return .red
        default: return .orange
        }
    }

    private func load() async {
        do {
            async let t: TestflightTestersResponse = api.fetchTestflightTesters()
            async let h: AscHealthResponse? = (try? await api.fetchAscHealth())
            let resp = try await t
            let health = await h
            await MainActor.run {
                testers = resp.testers
                ascHealth = health
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func syncFromAsc() async {
        await MainActor.run { syncBusy = true }
        do {
            try await api.syncTestflightTestersFromAsc()
            await flash("Synket fra ASC")
            await load()
        } catch {
            await flash("Sync feilet")
        }
        await MainActor.run { syncBusy = false }
    }

    private func graduateT(_ t: TestflightTester) async {
        do {
            try await api.graduateTestflightTester(id: t.id)
            await flash("Gradert")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func removeT(_ t: TestflightTester) async {
        do {
            try await api.removeTestflightTester(id: t.id)
            await flash("Fjernet")
            await load()
        } catch {
            await flash("Feilet")
        }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}

// ============================================================
// MARK: - Color helpers
// ============================================================

/// Helper for å parse #RRGGBB-strenger (fra email-branding) til Color.
/// Returnerer `nil` for ugyldige strenger. Internal (ikke private) så
/// andre SuperAdmin-views (BrandKit, osv) kan bruke den.
func colorFromHex(_ hex: String) -> Color? {
    var hexStr = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if hexStr.hasPrefix("#") { hexStr.removeFirst() }
    guard hexStr.count == 6, let v = UInt64(hexStr, radix: 16) else {
        return nil
    }
    return Color(
        red: Double((v >> 16) & 0xFF) / 255.0,
        green: Double((v >> 8) & 0xFF) / 255.0,
        blue: Double(v & 0xFF) / 255.0,
    )
}
