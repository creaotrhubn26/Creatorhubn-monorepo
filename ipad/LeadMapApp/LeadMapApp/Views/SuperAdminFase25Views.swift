// SuperAdminFase25Views.swift
//
// Fase 25: Ad-tech-stack på iPad. 3 views dekker hovedflyten:
// - AdsConfigsListView: liste alle configs m/ status
// - AdsConfigDetailView: per-config status + diagnose + sync-actions per platform
// - AdsApprovalsView: pending approvals (klient-rolle)

import SwiftUI

// ============================================================
// MARK: - Ads Configs List
// ============================================================

struct SuperAdminAdsConfigsView: View {
    let api: APIClient

    @State private var configs: [AdsConfig] = []
    @State private var loading = true
    @State private var selectedConfig: AdsConfig?
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && configs.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if configs.isEmpty {
                Section {
                    ContentUnavailableView(
                        "Ingen ads-configs",
                        systemImage: "megaphone",
                        description: Text("Opprett ads-configs på web først."),
                    )
                }
            } else {
                Section("Configs (\(configs.count))") {
                    ForEach(configs) { cfg in
                        Button {
                            selectedConfig = cfg
                        } label: {
                            configRow(cfg)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Ads-configs")
        .superAdminBackdrop(.adTech)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $selectedConfig) { cfg in
            SuperAdminAdsConfigDetailView(api: api, configId: cfg.id, clientName: cfg.clientName ?? "—")
        }
    }

    @ViewBuilder
    private func configRow(_ cfg: AdsConfig) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(cfg.clientName ?? "Untitled").font(.subheadline.bold())
                Spacer()
                if let status = cfg.status {
                    statusChip(status)
                }
            }
            if let url = cfg.clientWebsiteUrl {
                Text(url).font(.caption.monospaced()).foregroundStyle(.secondary).lineLimit(1)
            }
            HStack(spacing: 6) {
                if cfg.metaPixelId != nil {
                    platformBadge("Meta", color: .blue, ok: cfg.metaPixelProvisionedAt != nil)
                }
                if cfg.googleAdsCustomerId != nil {
                    platformBadge("Google", color: .red, ok: cfg.googleAdsTagId != nil)
                }
                if cfg.linkedinOrganizationId != nil {
                    platformBadge("LinkedIn", color: .indigo, ok: cfg.linkedinInsightTagId != nil)
                }
                if cfg.tiktokAdvertiserId != nil {
                    platformBadge("TikTok", color: .pink, ok: cfg.tiktokPixelId != nil)
                }
                if cfg.ga4PropertyId != nil {
                    platformBadge("GA4", color: .orange, ok: cfg.ga4ProvisionedAt != nil)
                }
            }
            if let approval = cfg.approvalStatus, approval == "awaiting_client" {
                Label("Venter på klient-godkjenning",
                       systemImage: "clock.badge.exclamationmark.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.orange)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func statusChip(_ s: String) -> some View {
        let color: Color = s == "active" ? .green : s == "paused" ? .orange
            : s == "rejected" ? .red : .secondary
        Text(s.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    @ViewBuilder
    private func platformBadge(_ label: String, color: Color, ok: Bool) -> some View {
        HStack(spacing: 3) {
            Circle().fill(ok ? Color.green : Color.secondary).frame(width: 6, height: 6)
            Text(label).font(.caption2.bold()).foregroundStyle(color)
        }
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(color.opacity(0.15), in: Capsule())
    }

    private func load() async {
        do {
            let r = try await api.fetchAdsConfigs()
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
// MARK: - Ads Config Detail (per-config m/ platform-actions)
// ============================================================

struct SuperAdminAdsConfigDetailView: View {
    let api: APIClient
    let configId: String
    let clientName: String

    @Environment(\.dismiss) private var dismiss
    @State private var config: AdsConfig?
    @State private var actions: [AdsAction] = []
    @State private var diagnostics: [AdsSetupDiagnostic] = []
    @State private var insights: AdsInsightsResponse?
    @State private var loading = true
    @State private var actingKey: String?
    @State private var snackbar: String?

    var body: some View {
        NavigationStack {
            List {
                if loading && config == nil {
                    Section { HStack { Spacer(); ProgressView(); Spacer() } }
                } else if let cfg = config {
                    if let insights {
                        insightsSection(insights)
                    }

                    if !diagnostics.isEmpty {
                        diagnosticsSection
                    }

                    // Meta-platform
                    if cfg.metaPixelId != nil || cfg.metaPixelProvisionedAt != nil {
                        platformSection(
                            title: "Meta", icon: "f.square.fill", color: .blue,
                            provisioned: cfg.metaPixelProvisionedAt,
                            lastSync: cfg.metaLastSyncAt,
                            actions: [
                                ("Provisjon pixel", "p.circle.fill",
                                 { try await api.provisionMetaPixel(id: configId) }),
                                ("Sync conversions", "arrow.triangle.2.circlepath",
                                 { try await api.syncMetaConversions(id: configId) }),
                            ],
                        )
                    }

                    // Google Ads-platform
                    if cfg.googleAdsCustomerId != nil {
                        platformSection(
                            title: "Google Ads", icon: "g.circle.fill", color: .red,
                            provisioned: cfg.googleAdsTagId != nil ? "TAG OK" : nil,
                            lastSync: cfg.googleAdsLastSyncAt,
                            actions: [
                                ("Sync til Google", "arrow.up.right.square",
                                 { try await api.syncAdsConfigToGoogle(id: configId) }),
                            ],
                        )
                    }

                    // LinkedIn-platform
                    if cfg.linkedinOrganizationId != nil {
                        platformSection(
                            title: "LinkedIn", icon: "person.crop.square.fill", color: .indigo,
                            provisioned: cfg.linkedinInsightTagId,
                            lastSync: cfg.linkedinLastSyncAt,
                            actions: [
                                ("Provisjon Insight Tag", "tag.fill",
                                 { try await api.provisionLinkedInInsightTag(id: configId) }),
                                ("Sync conversions", "arrow.triangle.2.circlepath",
                                 { try await api.syncLinkedInConversions(id: configId) }),
                            ],
                        )
                    }

                    // TikTok-platform
                    if cfg.tiktokAdvertiserId != nil {
                        platformSection(
                            title: "TikTok", icon: "music.note", color: .pink,
                            provisioned: cfg.tiktokPixelId,
                            lastSync: cfg.tiktokLastSyncAt,
                            actions: [
                                ("Provisjon pixel", "p.circle.fill",
                                 { try await api.provisionTiktokPixel(id: configId) }),
                                ("Sync events", "arrow.triangle.2.circlepath",
                                 { try await api.syncTiktokEvents(id: configId) }),
                                ("Sync leads", "person.2.fill",
                                 { try await api.syncTiktokLeads(id: configId) }),
                            ],
                        )
                    }

                    // GA4 + GTM + GSC
                    if cfg.ga4PropertyId != nil || cfg.gtmContainerId != nil || cfg.gscVerifiedAt != nil {
                        Section("Google Tools") {
                            if let ga4 = cfg.ga4PropertyId {
                                kvRow("GA4 Property", ga4)
                                if cfg.ga4ProvisionedAt == nil {
                                    Button {
                                        Task { await runAction("ga4-provision",
                                                                { try await api.provisionGa4(id: configId) }) }
                                    } label: {
                                        Label("Provisjon GA4", systemImage: "play.fill")
                                    }
                                    .disabled(actingKey != nil)
                                }
                            }
                            if let gtm = cfg.gtmContainerId {
                                kvRow("GTM Container", gtm)
                                if cfg.gtmProvisionedAt == nil {
                                    Button {
                                        Task { await runAction("gtm-provision",
                                                                { try await api.provisionGtm(id: configId) }) }
                                    } label: {
                                        Label("Provisjon GTM", systemImage: "play.fill")
                                    }
                                    .disabled(actingKey != nil)
                                }
                                Button {
                                    Task { await runAction("gtm-import",
                                                            { try await api.importGtmTags(id: configId) }) }
                                } label: {
                                    Label("Import-tags", systemImage: "tag.fill")
                                }
                                .disabled(actingKey != nil)
                            }
                            if cfg.gscVerifiedAt != nil {
                                kvRow("GSC verifisert", LeadgridDate.formatNo(cfg.gscVerifiedAt))
                                Button {
                                    Task { await runAction("gsc-sitemap",
                                                            { try await api.submitGscSitemap(id: configId) }) }
                                } label: {
                                    Label("Send sitemap", systemImage: "map.fill")
                                }
                                .disabled(actingKey != nil)
                            } else {
                                Button {
                                    Task { await runAction("gsc-verify",
                                                            { try await api.verifyGsc(id: configId) }) }
                                } label: {
                                    Label("Verifiser GSC", systemImage: "checkmark.shield.fill")
                                }
                                .disabled(actingKey != nil)
                            }
                        }
                    }

                    // Approval-flyt
                    if cfg.approvalStatus == "pending" || cfg.approvalStatus == "draft" {
                        Section("Godkjenning") {
                            Button {
                                Task { await runAction("request-approval",
                                                        { try await api.requestAdsConfigApproval(id: configId) }) }
                            } label: {
                                Label("Be klient godkjenne", systemImage: "envelope.badge.fill")
                            }
                            .disabled(actingKey != nil)
                        }
                    } else if cfg.approvalStatus == "awaiting_client" {
                        Section {
                            Label("Venter på klient-godkjenning", systemImage: "clock.fill")
                                .foregroundStyle(.orange)
                            if let deadline = cfg.approvalDeadline {
                                Text("Frist: \(LeadgridDate.formatNo(deadline))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }

                    if !actions.isEmpty {
                        Section("Action-historikk (\(actions.count))") {
                            ForEach(actions.prefix(20)) { act in
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack {
                                        Text(act.actionType).font(.caption.bold())
                                        if let plat = act.platform {
                                            Text(plat).font(.caption2)
                                                .padding(.horizontal, 6).padding(.vertical, 1)
                                                .background(Color.purple.opacity(0.20), in: Capsule())
                                        }
                                        Spacer()
                                        if let status = act.status {
                                            actionStatusChip(status)
                                        }
                                    }
                                    if let err = act.errorMessage {
                                        Text(err).font(.caption2).foregroundStyle(.red).lineLimit(2)
                                    }
                                    if let c = act.createdAt {
                                        Text(LeadgridDate.relativeAgo(c)).font(.caption2).foregroundStyle(.secondary)
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                }
            }
            .navigationTitle(clientName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await runAction("diagnose", {
                            let r = try await api.diagnoseAdsConfigSetup(id: configId)
                            await MainActor.run { diagnostics = r.diagnostics }
                        }) }
                    } label: {
                        Image(systemName: "stethoscope")
                    }
                }
            }
            .task { await load() }
            .overlay(alignment: .bottom) {
                if let snackbar {
                    Text(snackbar).padding()
                        .background(Color.black.opacity(0.85), in: Capsule())
                        .foregroundStyle(.white).padding(.bottom, 24)
                }
            }
        }
    }

    @ViewBuilder
    private func insightsSection(_ i: AdsInsightsResponse) -> some View {
        Section("Insights") {
            HStack {
                if let spend = i.totalSpendNok {
                    miniMetric("Spend", String(format: "%.0f kr", spend), .red)
                }
                if let leads = i.totalLeads {
                    miniMetric("Leads", "\(leads)", .green)
                }
                if let cpa = i.cpa {
                    miniMetric("CPA", String(format: "%.0f kr", cpa), .orange)
                }
            }
        }
    }

    @ViewBuilder
    private var diagnosticsSection: some View {
        Section("Diagnose (\(diagnostics.count))") {
            ForEach(diagnostics) { d in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: diagIcon(d.status))
                        .foregroundStyle(diagColor(d.status))
                        .font(.callout)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            if let plat = d.platform {
                                Text(plat.uppercased()).font(.caption2.bold())
                                    .foregroundStyle(.purple)
                            }
                            Text(d.category ?? "—").font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Text(d.message).font(.caption)
                        if let rec = d.recommendedAction {
                            Text("→ \(rec)").font(.caption2).foregroundStyle(.purple)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func platformSection(
        title: String, icon: String, color: Color,
        provisioned: String?, lastSync: String?,
        actions: [(label: String, icon: String, action: () async throws -> Void)],
    ) -> some View {
        Section {
            HStack(spacing: 8) {
                Image(systemName: icon).foregroundStyle(color)
                Text(title).font(.subheadline.bold())
                Spacer()
                if provisioned != nil {
                    Image(systemName: "checkmark.seal.fill").foregroundStyle(.green)
                }
            }
            if let p = provisioned {
                kvRow("Status", p)
            }
            if let s = lastSync {
                kvRow("Sist sync", LeadgridDate.formatNo(s))
            }
            ForEach(Array(actions.enumerated()), id: \.offset) { idx, act in
                Button {
                    let key = "\(title)-\(idx)"
                    Task { await runAction(key, act.action) }
                } label: {
                    Label(act.label, systemImage: act.icon)
                }
                .disabled(actingKey != nil)
            }
        }
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

    @ViewBuilder
    private func kvRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.callout)
        }
    }

    @ViewBuilder
    private func actionStatusChip(_ s: String) -> some View {
        let color: Color = s == "completed" ? .green : s == "failed" ? .red : .orange
        Text(s.uppercased()).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func diagIcon(_ s: String) -> String {
        switch s {
        case "ok": return "checkmark.circle.fill"
        case "warning": return "exclamationmark.triangle.fill"
        case "error": return "xmark.octagon.fill"
        default: return "questionmark.circle.fill"
        }
    }

    private func diagColor(_ s: String) -> Color {
        switch s {
        case "ok": return .green
        case "warning": return .orange
        case "error": return .red
        default: return .secondary
        }
    }

    private func load() async {
        do {
            async let detail: AdsConfigDetailResponse = api.fetchAdsConfig(id: configId)
            async let diag: AdsSetupDiagnoseResponse? = (try? await api.diagnoseAdsConfigSetup(id: configId))
            async let ins: AdsInsightsResponse? = (try? await api.fetchAdsConfigInsights(id: configId))
            let detailVal = try await detail
            config = detailVal.config
            actions = detailVal.actions
            diagnostics = (await diag)?.diagnostics ?? []
            insights = await ins
            loading = false
        } catch {
            loading = false
        }
    }

    private func runAction(_ key: String, _ action: () async throws -> Void) async {
        await MainActor.run { actingKey = key }
        do {
            try await action()
            await flash("Ferdig")
            await load()
        } catch {
            await flash("Feilet: \(error.localizedDescription)")
        }
        await MainActor.run { actingKey = nil }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}

// ============================================================
// MARK: - Ads Approvals (klient godkjenner Agent-anbefalinger)
// ============================================================

struct SuperAdminAdsApprovalsView: View {
    let api: APIClient

    @State private var approvals: [AdsApproval] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var snackbar: String?
    @State private var actingId: String?
    @State private var rejectingId: String?
    @State private var rejectReason = ""

    var body: some View {
        List {
            if loading && approvals.isEmpty {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if approvals.isEmpty {
                Section {
                    ContentUnavailableView(
                        "Ingen pending approvals",
                        systemImage: "checkmark.seal",
                        description: Text("Alt er godkjent eller ingen er sendt enda."),
                    )
                }
            } else {
                Section("Pending (\(approvals.count))") {
                    ForEach(approvals) { a in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(a.clientName ?? "—").font(.subheadline.bold())
                                Spacer()
                                if let total = a.totalSpendNok {
                                    Text(String(format: "%.0f kr", total))
                                        .font(.caption.bold()).foregroundStyle(.purple)
                                }
                            }
                            if let prod = a.producerName {
                                Text("Producer: \(prod)").font(.caption).foregroundStyle(.secondary)
                            }
                            if let summary = a.recommendationsSummary, !summary.isEmpty {
                                Text(summary).font(.caption).foregroundStyle(.purple).lineLimit(3)
                            }
                            if let req = a.requestedAt {
                                Text("Sendt: \(LeadgridDate.formatNo(req))")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                            if let dl = a.deadline {
                                Text("Frist: \(LeadgridDate.formatNo(dl))")
                                    .font(.caption2).foregroundStyle(.orange)
                            }
                            HStack(spacing: 8) {
                                Button {
                                    Task { await approve(a) }
                                } label: {
                                    Label("Godkjenn", systemImage: "checkmark.circle.fill")
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.green)
                                .font(.caption.bold())
                                .disabled(actingId != nil)

                                Button {
                                    rejectingId = a.configId
                                } label: {
                                    Label("Avslå", systemImage: "xmark.circle.fill")
                                }
                                .buttonStyle(.bordered)
                                .tint(.red)
                                .font(.caption.bold())
                                .disabled(actingId != nil)
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
        .navigationTitle("Ads-godkjenninger")
        .superAdminBackdrop(.adTech)
        .task { await load() }
        .refreshable { await load() }
        .overlay(alignment: .bottom) {
            if let snackbar {
                Text(snackbar).padding()
                    .background(Color.black.opacity(0.85), in: Capsule())
                    .foregroundStyle(.white).padding(.bottom, 24)
            }
        }
        .alert("Avslå?", isPresented: Binding(
            get: { rejectingId != nil },
            set: { if !$0 { rejectingId = nil; rejectReason = "" } }
        )) {
            TextField("Begrunnelse (valgfri)", text: $rejectReason)
            Button("Avbryt", role: .cancel) {
                rejectingId = nil
                rejectReason = ""
            }
            Button("Avslå", role: .destructive) {
                Task { await rejectConfirm() }
            }
        }
    }

    private func load() async {
        do {
            let r = try await api.fetchPendingAdsApprovals()
            await MainActor.run {
                approvals = r.approvals
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste"
                loading = false
            }
        }
    }

    private func approve(_ a: AdsApproval) async {
        await MainActor.run { actingId = a.configId }
        do {
            try await api.approveAdsConfig(configId: a.configId)
            await flash("Godkjent: \(a.clientName ?? "—")")
            await load()
        } catch {
            await flash("Feilet")
        }
        await MainActor.run { actingId = nil }
    }

    private func rejectConfirm() async {
        guard let id = rejectingId else { return }
        await MainActor.run { actingId = id }
        do {
            try await api.rejectAdsConfig(configId: id, reason: rejectReason.isEmpty ? nil : rejectReason)
            await flash("Avslått")
            await load()
        } catch {
            await flash("Feilet")
        }
        await MainActor.run {
            actingId = nil
            rejectingId = nil
            rejectReason = ""
        }
    }

    private func flash(_ text: String) async {
        await MainActor.run { withAnimation { snackbar = text } }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run { withAnimation { snackbar = nil } }
    }
}
