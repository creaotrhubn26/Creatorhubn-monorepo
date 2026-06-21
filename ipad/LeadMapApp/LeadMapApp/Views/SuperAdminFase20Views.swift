// SuperAdminFase20Views.swift
//
// Fase 20: Platform-status + Integrations + API-endpoints-health.
// Lar Daniel sjekke plattform-helse fra felt — er Render/Neon/Vercel/
// Stripe/Anthropic OK? Er noen integrations brutt? Hvilke API-ruter
// har errors siste 24t?

import SwiftUI

// ============================================================
// MARK: - Platform-status (Render/Neon/Vercel/Stripe/Anthropic)
// ============================================================

struct SuperAdminPlatformStatusView: View {
    let api: APIClient

    @State private var status: PlatformStatusResponse?
    @State private var loading = true
    @State private var errorText: String?
    @State private var snackbar: String?

    var body: some View {
        List {
            if loading && status == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let s = status {
                Section {
                    overallBanner(s.overall, s.summary)
                }

                if let presence = s.presence {
                    Section("Bruker-aktivitet") {
                        HStack {
                            Image(systemName: "person.fill.checkmark").foregroundStyle(.green)
                            Text("Online nå").font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text("\(presence.onlineCount)").font(.subheadline.bold())
                        }
                        HStack {
                            Image(systemName: "clock.fill").foregroundStyle(.purple)
                            Text("Aktive (24t)").font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text("\(presence.totalActiveLast24h)").font(.subheadline.bold())
                        }
                    }
                }

                Section("Providers (\(s.providers.count))") {
                    ForEach(s.providers) { p in
                        providerRow(p)
                    }
                }

                if let c = s.checkedAt {
                    Section {
                        Text("Sist sjekket: \(LeadgridDate.formatNo(c))")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Plattform-status")
        .superAdminBackdrop(.platform)
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
    private func overallBanner(_ overall: String, _ summary: PlatformStatusSummary) -> some View {
        let (label, icon, color): (String, String, Color) = {
            switch overall {
            case "ok": return ("Alt OK", "checkmark.shield.fill", .green)
            case "warning": return ("Advarsler", "exclamationmark.triangle.fill", .orange)
            case "error": return ("Feil", "xmark.shield.fill", .red)
            default: return (overall.capitalized, "circle", .secondary)
            }
        }()
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.title2).foregroundStyle(color)
                Text(label).font(.headline.bold())
            }
            HStack(spacing: 12) {
                miniStat("OK", summary.okCount, .green)
                miniStat("Advarsler", summary.warningCount, .orange)
                miniStat("Feil", summary.errorCount, .red)
                if summary.unconfiguredCount > 0 {
                    miniStat("Ikke satt", summary.unconfiguredCount, .secondary)
                }
            }
        }
        .padding(.vertical, 6)
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

    @ViewBuilder
    private func providerRow(_ p: ProviderHealthStatus) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Circle().fill(providerColor(p.health))
                    .frame(width: 10, height: 10)
                Text(p.provider).font(.subheadline.bold())
                Spacer()
                if let url = p.dashboardUrl, let u = URL(string: url) {
                    Link(destination: u) {
                        Image(systemName: "arrow.up.right.square")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            if let msg = p.message, !msg.isEmpty {
                Text(msg).font(.caption)
                    .foregroundStyle(p.health == "error" ? .red : .secondary)
                    .lineLimit(2)
            }
            if let metrics = p.metrics, !metrics.isEmpty {
                Text(metrics.map { "\($0.key): \($0.value)" }.joined(separator: " · "))
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let last = p.lastCheckedAt {
                Text("Sjekket: \(LeadgridDate.formatNo(last))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func providerColor(_ health: String) -> Color {
        switch health {
        case "ok": return .green
        case "warning": return .orange
        case "error": return .red
        default: return .secondary
        }
    }

    private func load() async {
        do {
            let s = try await api.fetchPlatformStatus()
            await MainActor.run {
                status = s
                loading = false
                errorText = nil
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste plattform-status"
                loading = false
            }
        }
    }
}

// ============================================================
// MARK: - Integrations overview + keys + webhooks
// ============================================================

struct SuperAdminIntegrationsView: View {
    let api: APIClient

    @State private var overview: IntegrationsOverview?
    @State private var keys: [IntegrationKey] = []
    @State private var webhooks: [IntegrationWebhook] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && overview == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let o = overview {
                Section("Sammendrag") {
                    HStack {
                        miniMetric("Totalt", "\(o.totalIntegrations)", .purple)
                        miniMetric("Aktive", "\(o.active)", .green)
                        miniMetric("Brutt", "\(o.broken)", o.broken > 0 ? .red : .secondary)
                    }
                }

                if let byCat = o.byCategory, !byCat.isEmpty {
                    Section("Per kategori") {
                        ForEach(byCat.sorted(by: { $0.value > $1.value }), id: \.key) { cat, count in
                            HStack {
                                Label(cat.capitalized, systemImage: categoryIcon(cat))
                                    .foregroundStyle(categoryColor(cat))
                                Spacer()
                                Text("\(count)").font(.subheadline.bold())
                            }
                        }
                    }
                }
            }

            if !keys.isEmpty {
                Section("Keys (\(keys.count))") {
                    ForEach(keys) { k in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(k.name).font(.caption.monospaced())
                                Spacer()
                                if k.isActive == true {
                                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                                } else {
                                    Image(systemName: "xmark.circle.fill").foregroundStyle(.red)
                                }
                            }
                            if let cat = k.category {
                                Text(cat).font(.caption2)
                                    .padding(.horizontal, 6).padding(.vertical, 1)
                                    .background(Color.purple.opacity(0.15), in: Capsule())
                            }
                            if let last = k.lastUsedAt {
                                Text("Sist brukt: \(LeadgridDate.formatNo(last))")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }

            if !webhooks.isEmpty {
                Section("Integrasjons-webhooks (\(webhooks.count))") {
                    ForEach(webhooks) { w in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(w.url).font(.caption.monospaced()).lineLimit(1)
                                Spacer()
                                Circle()
                                    .fill(w.isActive == true ? Color.green : Color.secondary)
                                    .frame(width: 8, height: 8)
                            }
                            if let evs = w.events, !evs.isEmpty {
                                Text(evs.joined(separator: ", "))
                                    .font(.caption2).foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            if let failures = w.consecutiveFailures, failures > 0 {
                                Text("\(failures) consecutive failures")
                                    .font(.caption2.bold())
                                    .foregroundStyle(.red)
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
        .navigationTitle("Integrations")
        .superAdminBackdrop(.platform)
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

    private func categoryIcon(_ cat: String) -> String {
        switch cat {
        case "payment": return "creditcard.fill"
        case "storage": return "externaldrive.fill"
        case "ai": return "sparkles"
        case "communication": return "envelope.fill"
        case "auth": return "key.fill"
        case "infrastructure": return "server.rack"
        case "observability": return "chart.line.uptrend.xyaxis"
        case "automation": return "gearshape.2.fill"
        default: return "circle.grid.cross"
        }
    }

    private func categoryColor(_ cat: String) -> Color {
        switch cat {
        case "payment": return .green
        case "storage": return .blue
        case "ai": return .purple
        case "communication": return .orange
        case "auth": return .pink
        case "infrastructure": return .secondary
        case "observability": return .indigo
        case "automation": return .mint
        default: return .secondary
        }
    }

    private func load() async {
        do {
            async let o: IntegrationsOverview = api.fetchIntegrationsOverview()
            async let k: IntegrationKeysResponse? = (try? await api.fetchIntegrationKeys())
            async let w: IntegrationWebhooksResponse? = (try? await api.fetchIntegrationWebhooks())
            overview = try await o
            keys = (await k)?.keys ?? []
            webhooks = (await w)?.webhooks ?? []
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
// MARK: - API-endpoints-health (per-source errors siste 24t)
// ============================================================

struct SuperAdminApiHealthView: View {
    let api: APIClient

    @State private var response: ApiEndpointsHealthResponse?
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        List {
            if loading && response == nil {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if let r = response {
                Section {
                    healthScoreBanner(r.healthScore ?? 0, r.windowHours ?? 24)
                }

                let sortedEndpoints = r.endpoints.sorted { lhs, rhs in
                    lhs.errorCount24h > rhs.errorCount24h
                }

                Section("Sources (\(r.endpoints.count))") {
                    ForEach(sortedEndpoints) { ep in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(ep.source).font(.caption.monospaced())
                                Spacer()
                                healthChip(ep.health ?? inferHealth(ep))
                            }
                            HStack(spacing: 12) {
                                if ep.errorCount24h > 0 {
                                    Label("\(ep.errorCount24h)", systemImage: "xmark.octagon.fill")
                                        .foregroundStyle(.red).font(.caption2.bold())
                                }
                                if ep.warningCount24h > 0 {
                                    Label("\(ep.warningCount24h)", systemImage: "exclamationmark.triangle.fill")
                                        .foregroundStyle(.orange).font(.caption2.bold())
                                }
                                Label("\(ep.infoCount24h) info", systemImage: "info.circle")
                                    .foregroundStyle(.secondary).font(.caption2)
                                Spacer()
                                if let last = ep.lastEventAt {
                                    Text(LeadgridDate.relativeAgo(last))
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
        .navigationTitle("API-helse")
        .superAdminBackdrop(.platform)
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func healthScoreBanner(_ score: Int, _ hours: Int) -> some View {
        let color: Color = score >= 95 ? .green : score >= 80 ? .orange : .red
        VStack(spacing: 6) {
            HStack {
                Text("Health score").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Text("\(score)/100").font(.title.bold()).foregroundStyle(color)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.secondary.opacity(0.15))
                        .frame(height: 6)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(color)
                        .frame(width: geo.size.width * CGFloat(score) / 100, height: 6)
                }
            }
            .frame(height: 6)
            Text("Vindu: siste \(hours)t").font(.caption2).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func healthChip(_ health: String) -> some View {
        let (label, color): (String, Color) = {
            switch health {
            case "ok": return ("OK", .green)
            case "warning": return ("WARN", .orange)
            case "error": return ("ERR", .red)
            default: return (health.uppercased(), .secondary)
            }
        }()
        Text(label).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func inferHealth(_ ep: ApiEndpointHealth) -> String {
        if ep.errorCount24h > 5 { return "error" }
        if ep.errorCount24h > 0 || ep.warningCount24h > 10 { return "warning" }
        return "ok"
    }

    private func load() async {
        do {
            let r = try await api.fetchApiEndpointsHealth()
            await MainActor.run {
                response = r
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
