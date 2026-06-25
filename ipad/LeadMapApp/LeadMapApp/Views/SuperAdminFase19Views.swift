// SuperAdminFase19Views.swift
//
// Fase 19: Resterende admin-room paritet på iPad. 6 nye views for
// super-admin-flows som tidligere bare fantes på web.
//
// Web-paritet:
// - LeadMapPermissionsMatrix.tsx
// - LeadMapPromoteDialog.tsx (i org-tab member-context)
// - CustomerSuccessDashboard.tsx (+ renewals)
// - B2BAcquisitionPanel.tsx (cockpit funnel)
// - cockpit/linkedin/* (CAPI + LeadSync status)
// - cockpit/case-studies
// - role-nav-config

import SwiftUI

// ============================================================
// MARK: - Permissions-matrise (per-rolle defaults)
// ============================================================

struct SuperAdminPermissionsMatrixView: View {
    let api: APIClient
    let orgId: String

    @State private var roles: [PermissionsRole] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && roles.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if roles.isEmpty {
                Section { Text("Ingen roller").foregroundStyle(.secondary) }
            } else {
                Section("Roller (\(roles.count))") {
                    ForEach(roles) { r in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(r.label ?? r.key.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .font(.subheadline.bold())
                                Spacer()
                                if let c = r.memberCount {
                                    Text("\(c)").font(.caption.bold())
                                        .padding(.horizontal, 8).padding(.vertical, 2)
                                        .background(Color.purple.opacity(0.20), in: Capsule())
                                        .foregroundStyle(.purple)
                                }
                            }
                            if let perms = r.defaultPermissions {
                                Text("\(perms.count) permissions")
                                    .font(.caption2).foregroundStyle(.secondary)
                                if !perms.isEmpty {
                                    Text(perms.prefix(6).joined(separator: ", ") + (perms.count > 6 ? "…" : ""))
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
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
        .navigationTitle("RBAC matrise")
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            let r = try await api.fetchPermissionsMatrix(orgId: orgId)
            await MainActor.run {
                roles = r.roles
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
// MARK: - Promote-medlem (sales-hierarki)
// ============================================================

struct SuperAdminPromoteMemberView: View {
    let api: APIClient
    let orgId: String

    @State private var members: [OrgMember] = []
    @State private var loading = true
    @State private var selectedMember: OrgMember?
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && members.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if members.isEmpty {
                Section { Text("Ingen medlemmer").foregroundStyle(.secondary) }
            } else {
                Section("Medlemmer (\(members.count))") {
                    ForEach(members) { m in
                        Button {
                            selectedMember = m
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(m.name ?? m.email ?? "—").font(.subheadline.bold())
                                    if let role = m.role {
                                        Text(role.replacingOccurrences(of: "_", with: " ").capitalized)
                                            .font(.caption2)
                                            .padding(.horizontal, 6).padding(.vertical, 1)
                                            .background(Color.purple.opacity(0.20), in: Capsule())
                                            .foregroundStyle(.purple)
                                    }
                                }
                                Spacer()
                                Image(systemName: "arrow.up.circle").foregroundStyle(.purple)
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
        .navigationTitle("Forfremme")
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $selectedMember) { m in
            PromotionFlowSheet(
                api: api, orgId: orgId, member: m,
                onComplete: { Task { await load() } },
            )
        }
    }

    private func load() async {
        do {
            let r = try await api.fetchOrgMembersForPromote(orgId: orgId)
            await MainActor.run {
                members = r.members
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

struct PromotionFlowSheet: View {
    let api: APIClient
    let orgId: String
    let member: OrgMember
    let onComplete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var targetRole = ""
    @State private var preview: PromotionPreview?
    @State private var loading = false
    @State private var applying = false
    @State private var errorText: String?
    @State private var reason = ""

    private let availableRoles = [
        "sales_promotor", "sales_rep", "team_leader", "sales_director",
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Medlem") {
                    Text(member.name ?? member.email ?? "—")
                    if let role = member.role {
                        HStack {
                            Text("Nåværende rolle").font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text(role.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.callout.bold())
                        }
                    }
                }

                Section("Til rolle") {
                    Picker("Ny rolle", selection: $targetRole) {
                        Text("Velg…").tag("")
                        ForEach(availableRoles, id: \.self) { r in
                            Text(r.replacingOccurrences(of: "_", with: " ").capitalized).tag(r)
                        }
                    }
                    .onChange(of: targetRole) { _, newVal in
                        if !newVal.isEmpty {
                            Task { await loadPreview() }
                        }
                    }
                }

                if loading {
                    Section { HStack { Spacer(); ProgressView(); Spacer() } }
                } else if let preview {
                    Section("Forhåndsvisning") {
                        if let added = preview.permissionsAdded, !added.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Label("Får tilgang til (\(added.count))", systemImage: "plus.circle.fill")
                                    .foregroundStyle(.green)
                                    .font(.caption.bold())
                                Text(added.joined(separator: ", "))
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if let removed = preview.permissionsRemoved, !removed.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Label("Mister tilgang til (\(removed.count))", systemImage: "minus.circle.fill")
                                    .foregroundStyle(.red)
                                    .font(.caption.bold())
                                Text(removed.joined(separator: ", "))
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if let warnings = preview.warningMessages, !warnings.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(warnings, id: \.self) { w in
                                    Label(w, systemImage: "exclamationmark.triangle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                }
                            }
                        }
                    }

                    Section("Begrunnelse") {
                        TextField("Hvorfor forfremmes (audit-logg)", text: $reason, axis: .vertical)
                            .lineLimit(2...4)
                    }

                    Section {
                        Button {
                            Task { await apply() }
                        } label: {
                            if applying {
                                ProgressView()
                            } else {
                                Label("Bekreft forfremmelse", systemImage: "checkmark.circle.fill")
                            }
                        }
                        .disabled(applying || targetRole.isEmpty)
                    }
                }

                if let errorText {
                    Section { Text(errorText).foregroundStyle(.red).font(.caption) }
                }
            }
            .navigationTitle("Forfremme")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { dismiss() }
                }
            }
        }
    }

    private func loadPreview() async {
        await MainActor.run { loading = true }
        do {
            let p = try await api.previewPromotion(
                orgId: orgId, userId: member.userId, toRole: targetRole)
            await MainActor.run {
                preview = p
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste forhåndsvisning"
                loading = false
            }
        }
    }

    private func apply() async {
        await MainActor.run { applying = true }
        do {
            try await api.promoteMember(
                orgId: orgId, userId: member.userId,
                toRole: targetRole,
                reason: reason.isEmpty ? nil : reason,
            )
            onComplete()
            dismiss()
        } catch {
            await MainActor.run {
                errorText = "Forfremmelse feilet"
                applying = false
            }
        }
    }
}

// ============================================================
// MARK: - Customer Success dashboard + renewals
// ============================================================

struct SuperAdminCustomerSuccessView: View {
    let api: APIClient

    @State private var summary: CSDashboardSummary?
    @State private var renewals: [CSRenewal] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && summary == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let s = summary {
                Section("Kunde-helse") {
                    metricRow("Totalt", "\(s.totalCustomers)", icon: "person.3.fill", color: .blue)
                    metricRow("Aktive", "\(s.activeCustomers)", icon: "checkmark.circle.fill", color: .green)
                    metricRow("Risk", "\(s.atRiskCount)", icon: "exclamationmark.triangle.fill", color: .orange)
                    metricRow("Churn (30d)", "\(s.churnedLast30d)", icon: "person.fill.xmark", color: .red)
                    if let score = s.avgHealthScore {
                        metricRow("Snitt-helse", String(format: "%.0f / 100", score),
                                   icon: "heart.fill", color: .pink)
                    }
                }

                Section("MRR") {
                    metricRow("Total MRR", formatKr(s.mrrTotalKr), icon: "creditcard.fill", color: .green)
                    if s.mrrAtRiskKr > 0 {
                        metricRow("MRR i risiko", formatKr(s.mrrAtRiskKr),
                                   icon: "exclamationmark.shield.fill", color: .red)
                    }
                }

                Section("Aktivitet (30d)") {
                    metricRow("Nye kunder", "\(s.newCustomersLast30d)",
                               icon: "person.fill.badge.plus", color: .green)
                    metricRow("Kommende renewals", "\(s.upcomingRenewalsCount)",
                               icon: "calendar.circle.fill", color: .purple)
                }
            }

            if !renewals.isEmpty {
                Section("Kommende renewals (\(renewals.count))") {
                    ForEach(renewals.prefix(20)) { r in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(r.customerName ?? r.customerEmail ?? "—")
                                    .font(.subheadline.bold())
                                Spacer()
                                statusChip(r.status)
                            }
                            HStack(spacing: 12) {
                                Text(r.formattedRenewalAt).font(.caption2).foregroundStyle(.secondary)
                                if r.mrrKr > 0 {
                                    Text(formatKr(r.mrrKr)).font(.caption2.bold())
                                }
                                if let h = r.healthScore {
                                    Text("\(h)/100").font(.caption2)
                                        .foregroundStyle(healthColor(h))
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
        .navigationTitle("Customer Success")
        .superAdminBackdrop(.b2bFunnel)
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func metricRow(_ label: String, _ value: String, icon: String, color: Color) -> some View {
        HStack {
            Label(label, systemImage: icon).foregroundStyle(color)
            Spacer()
            Text(value).font(.subheadline.bold())
        }
    }

    @ViewBuilder
    private func statusChip(_ status: String) -> some View {
        let (label, color): (String, Color) = {
            switch status {
            case "pending": return ("PENDING", .orange)
            case "confirmed": return ("BEKR.", .green)
            case "churned": return ("CHURN", .red)
            case "at_risk": return ("RISK", .red)
            default: return (status.uppercased(), .secondary)
            }
        }()
        Text(label).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func healthColor(_ score: Int) -> Color {
        if score >= 70 { return .green }
        if score >= 40 { return .orange }
        return .red
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
            async let s: CSDashboardSummary = api.fetchCustomerSuccessDashboard()
            async let r: CSRenewalsResponse = api.fetchCSRenewals(daysAhead: 90)
            summary = try await s
            renewals = try await r.renewals
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
// MARK: - B2B Cockpit funnel (Daniel's B2B-pipeline-analyse)
// ============================================================

struct SuperAdminB2BCockpitView: View {
    let api: APIClient

    @State private var funnel: B2BFunnelResponse?
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && funnel == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let f = funnel {
                Section("Sammendrag") {
                    HStack {
                        Text("Totalt leads").font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Text("\(f.totalLeads)").font(.headline)
                    }
                    HStack {
                        Text("Konvertert").font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Text("\(f.totalConverted)").font(.headline).foregroundStyle(.green)
                    }
                    if let arpu = f.arpuMonthlyNok {
                        HStack {
                            Text("ARPU/mnd").font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text(String(format: "%.0f kr", arpu)).font(.headline)
                        }
                    }
                }

                Section("Funnel-steg") {
                    ForEach(f.steps) { s in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(s.step.capitalized).font(.subheadline.bold())
                                Spacer()
                                Text("\(s.count) → \(s.convertedCount)")
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
                                        .frame(width: geo.size.width * CGFloat(s.conversionPct) / 100,
                                                height: 6)
                                }
                            }
                            .frame(height: 6)
                            HStack(spacing: 12) {
                                Text("\(s.conversionPct)% konv").font(.caption2.bold())
                                Text("Drop-off: \(s.dropOffCount)").font(.caption2).foregroundStyle(.red)
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
        .navigationTitle("B2B-funnel")
        .superAdminBackdrop(.b2bFunnel)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            let f = try await api.fetchB2BFunnel()
            await MainActor.run {
                funnel = f
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
// MARK: - LinkedIn Cockpit (CAPI + LeadSync status)
// ============================================================

struct SuperAdminLinkedInCockpitView: View {
    let api: APIClient

    @State private var capi: LinkedInCapiStatus?
    @State private var leadSync: LinkedInLeadSyncStatus?
    @State private var orgs: [LinkedInCockpitOrg] = []
    @State private var loading = true
    @State private var actionBusy = false
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading && capi == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else {
                if let c = capi {
                    Section("Conversions API (CAPI)") {
                        statusRow("Tilkoblet", c.connected ? "JA" : "NEI",
                                   color: c.connected ? .green : .red)
                        if let last = c.lastSendAt {
                            statusRow("Sist sendt", LeadgridDate.formatNo(last), color: .secondary)
                        }
                        statusRow("Pending", "\(c.pendingEvents)", color: c.pendingEvents > 0 ? .orange : .secondary)
                        statusRow("Sendt (30d)", "\(c.sentLast30d)", color: .green)
                        statusRow("Feilet (30d)", "\(c.failedLast30d)", color: c.failedLast30d > 0 ? .red : .secondary)
                        if let exp = c.expiredLast30d, exp > 0 {
                            statusRow("Utgått (30d)", "\(exp)", color: .orange)
                        }
                        Button {
                            Task { await sendCapiDue() }
                        } label: {
                            Label("Send pending-events", systemImage: "paperplane.fill")
                        }
                        .disabled(actionBusy)
                    }
                }
                if let l = leadSync {
                    Section("Lead Sync") {
                        statusRow("Tilkoblet", l.connected ? "JA" : "NEI",
                                   color: l.connected ? .green : .red)
                        if let last = l.lastPollAt {
                            statusRow("Sist poll", LeadgridDate.formatNo(last), color: .secondary)
                        }
                        statusRow("Forms tilkoblet", "\(l.formsConnected)", color: .blue)
                        statusRow("Leads synket (30d)", "\(l.leadsSyncedLast30d)", color: .green)
                        Button {
                            Task { await pollLeadSync() }
                        } label: {
                            Label("Poll nå", systemImage: "arrow.triangle.2.circlepath")
                        }
                        .disabled(actionBusy)
                    }
                }
                if !orgs.isEmpty {
                    Section("LinkedIn-org-er (\(orgs.count))") {
                        ForEach(orgs) { o in
                            HStack {
                                if let urlStr = o.logoUrl, let url = URL(string: urlStr) {
                                    AsyncImage(url: url) { img in img.resizable().scaledToFit() } placeholder: {
                                        Image(systemName: "building.2.fill").foregroundStyle(.secondary)
                                    }
                                    .frame(width: 24, height: 24).clipShape(Circle())
                                }
                                Text(o.name).font(.subheadline)
                                Spacer()
                                if o.isDefault {
                                    Text("DEFAULT").font(.caption2.bold())
                                        .foregroundStyle(.purple)
                                } else {
                                    Button {
                                        Task { await setDefault(o) }
                                    } label: {
                                        Text("Sett som default").font(.caption.bold())
                                    }
                                    .disabled(actionBusy)
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
        .navigationTitle("LinkedIn Cockpit")
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
    }

    @ViewBuilder
    private func statusRow(_ label: String, _ value: String, color: Color) -> some View {
        HStack {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.callout.bold()).foregroundStyle(color)
        }
    }

    private func load() async {
        do {
            async let c: LinkedInCapiStatus? = try? await api.fetchLinkedInCapiStatus()
            async let l: LinkedInLeadSyncStatus? = try? await api.fetchLinkedInLeadSyncStatus()
            async let o: LinkedInCockpitOrgsResponse? = try? await api.fetchLinkedInCockpitOrgs()
            let cVal = await c
            let lVal = await l
            let oVal = await o
            await MainActor.run {
                capi = cVal
                leadSync = lVal
                orgs = oVal?.orgs ?? []
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func sendCapiDue() async {
        await MainActor.run { actionBusy = true }
        do {
            try await api.triggerLinkedInCapiSendDue()
            await flash("Pending events sendt")
            await load()
        } catch {
            await flash("Feilet")
        }
        await MainActor.run { actionBusy = false }
    }

    private func pollLeadSync() async {
        await MainActor.run { actionBusy = true }
        do {
            try await api.triggerLinkedInLeadSyncPoll()
            await flash("Poll trigget")
            await load()
        } catch {
            await flash("Feilet")
        }
        await MainActor.run { actionBusy = false }
    }

    private func setDefault(_ o: LinkedInCockpitOrg) async {
        do {
            try await api.setLinkedInCockpitDefaultOrg(id: o.id)
            await flash("Default: \(o.name)")
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
// MARK: - Case Studies
// ============================================================

struct SuperAdminCaseStudiesView: View {
    let api: APIClient

    @State private var caseStudies: [CaseStudy] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && caseStudies.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if caseStudies.isEmpty {
                Section { Text("Ingen case-studies").foregroundStyle(.secondary) }
            } else {
                Section("Case studies (\(caseStudies.count))") {
                    ForEach(caseStudies) { cs in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(cs.title ?? cs.customerName ?? "—")
                                    .font(.subheadline.bold())
                                Spacer()
                                statusChip(cs.status ?? "draft")
                                if cs.aiGenerated == true {
                                    Image(systemName: "sparkles").foregroundStyle(.purple)
                                }
                            }
                            if let cust = cs.customerName, cust != cs.title {
                                Text(cust).font(.caption).foregroundStyle(.secondary)
                            }
                            if let outcome = cs.outcome, !outcome.isEmpty {
                                Text(outcome).font(.caption).foregroundStyle(.purple).lineLimit(2)
                            }
                            if let metrics = cs.metrics, !metrics.isEmpty {
                                Text(metrics.joined(separator: " · "))
                                    .font(.caption2.bold())
                                    .foregroundStyle(.green)
                            }
                            if let pub = cs.publishedAt {
                                Text("Publisert: \(LeadgridDate.formatNo(pub))")
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
        .navigationTitle("Case Studies")
        .superAdminBackdrop(.marketing)
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func statusChip(_ s: String) -> some View {
        let color: Color = {
            switch s {
            case "published": return .green
            case "generating": return .orange
            default: return .secondary
            }
        }()
        Text(s.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        do {
            let r = try await api.fetchCaseStudies()
            await MainActor.run {
                caseStudies = r.caseStudies
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
// MARK: - Role Nav Config
// ============================================================

struct SuperAdminRoleNavConfigView: View {
    let api: APIClient

    @State private var configs: [RoleNavConfig] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && configs.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if configs.isEmpty {
                Section { Text("Ingen konfigurasjoner").foregroundStyle(.secondary) }
            } else {
                Section("Rolle-meny per rolle (\(configs.count))") {
                    ForEach(configs) { c in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(c.displayName ?? c.role.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.subheadline.bold())
                            if let tabs = c.tabs {
                                Text("\(tabs.count) tabs synlig")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                            if let hidden = c.hiddenTabs, !hidden.isEmpty {
                                Text("Skjult: \(hidden.joined(separator: ", "))")
                                    .font(.caption2).foregroundStyle(.orange).lineLimit(2)
                            }
                            if let landing = c.defaultLanding {
                                Text("Standard landing: \(landing)")
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
        .navigationTitle("Rolle-meny")
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            let r = try await api.fetchRoleNavConfigs()
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
