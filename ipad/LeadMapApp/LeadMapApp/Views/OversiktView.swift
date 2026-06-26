// OversiktView.swift
//
// Hovedlandings-flate for iPad-landscape (mock-paritet med
// Leadgrid marketing one-pager). Tredelt layout:
//
//   ┌───────────────────────────────┬──────────────────────┐
//   │ 4 KPI-cards (Total/Hot/...)   │ RIGHT SIDEBAR        │
//   ├───────────────────────────────┤  Valgt lead          │
//   │ KART-CARD (med pins)          │  NBA-card            │
//   ├───────────────────────────────┤  Ruteanbef.          │
//   │ TABELL "Leads i området"      │                      │
//   └───────────────────────────────┴──────────────────────┘
//
// Data hentes fra eksisterende AppState + APIClient — ingen nye
// backend-endepunkter er nødvendig:
//   • leads:       AppState.leads (allerede polled)
//   • KPI:         AppState.metrics + fetchMomentumToday + fetchPipelineForecast
//   • NBA:         fetchNBARecommendations(limit:1)
//   • ruteanbef.:  planRoute fra current location
//
// Brukes som default-flate under iPad-sidebar når horizontalSizeClass==.regular.

import SwiftUI
import MapKit

struct OversiktView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var hSize

    @State private var momentum: LeadgridMomentum?
    @State private var forecast: LeadgridForecast?
    @State private var topNBA: LeadgridNBARecommendation?
    @State private var routePreview: LeadgridRouteDetail?
    @State private var loading = false
    @State private var refreshTask: Task<Void, Never>?
    @State private var presentingLeadDetail = false
    /// Lookup-tabell for bransjer (mig 329). Brukes til å vise
    /// IndustryBadge i "Leads i området"-tabellen.
    @State private var industriesById: [String: Industry] = [:]

    /// Vis right sidebar når vi har plass — kompakt-portrait på iPad/iPhone
    /// stables seksjonene under hverandre i hovedkolonnen.
    private var showRightSidebar: Bool {
        hSize == .regular
    }

    var body: some View {
        Group {
            if showRightSidebar {
                wideLayout
            } else {
                stackedLayout
            }
        }
        .navigationTitle("Oversikt")
        .navigationBarTitleDisplayMode(.large)
        .task { await loadAll() }
        .refreshable { await loadAll(force: true) }
        .sheet(isPresented: $presentingLeadDetail) {
            if let api = appState.api, let lead = appState.selectedLead {
                LeadgridCustomerDetailView(customerId: lead.id, api: api)
            }
        }
    }

    // MARK: - Layouts

    @ViewBuilder
    private var wideLayout: some View {
        HStack(alignment: .top, spacing: 16) {
            ScrollView {
                VStack(spacing: 16) {
                    kpiRow
                    mapCard
                    leadsTable
                }
                .padding(16)
            }
            .frame(maxWidth: .infinity)

            rightSidebar
                .frame(width: 340)
                .padding(.trailing, 16)
                .padding(.top, 16)
        }
    }

    @ViewBuilder
    private var stackedLayout: some View {
        ScrollView {
            VStack(spacing: 16) {
                kpiRow
                mapCard
                leadsTable
                rightSidebar
            }
            .padding(16)
        }
    }

    // MARK: - KPI-rad

    @ViewBuilder
    private var kpiRow: some View {
        let cols = [GridItem(.adaptive(minimum: 180), spacing: 12)]
        LazyVGrid(columns: cols, alignment: .leading, spacing: 12) {
            kpiCard(
                title: "Total leads",
                value: formatInt(appState.metrics?.totalLeads ?? appState.leads.count),
                trend: appState.metrics?.trends?.totalLeads,
                icon: "person.crop.rectangle.stack.fill",
                tint: Color(red: 0.66, green: 0.32, blue: 0.99)
            )
            kpiCard(
                title: "Hot leads",
                value: formatInt(hotLeadCount),
                trend: hotLeadTrend,
                icon: "flame.fill",
                tint: Color(red: 0.97, green: 0.40, blue: 0.40)
            )
            kpiCard(
                title: "Oppfølginger i dag",
                value: formatInt(appState.metrics?.followUpsDue ?? 0),
                trend: appState.metrics?.trends?.followUpsDue,
                icon: "bell.badge.fill",
                tint: Color(red: 0.98, green: 0.75, blue: 0.14)
            )
            kpiCard(
                title: "Forventet verdi",
                value: formatMoney(forecast?.predictedRevenueMid ?? totalEstimatedValue),
                trend: nil,
                subtitle: forecast.map { "Horisont \($0.horizonDays) dager" } ?? nil,
                icon: "chart.line.uptrend.xyaxis",
                tint: Color(red: 0.20, green: 0.78, blue: 0.45)
            )
        }
    }

    @ViewBuilder
    private func kpiCard(
        title: String,
        value: String,
        trend: Double?,
        subtitle: String? = nil,
        icon: String,
        tint: Color
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .frame(width: 26, height: 26)
                    .background(tint.opacity(0.90), in: RoundedRectangle(cornerRadius: 6))
                Spacer()
                if let trend, trend != 0 {
                    TrendArrow(delta: trend, period: nil, compact: true)
                }
            }
            Text(value)
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            if let subtitle {
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            if let trend, trend != 0 {
                TrendArrow(delta: trend, period: "vs forrige periode")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            Color(.secondarySystemBackground),
            in: RoundedRectangle(cornerRadius: 16)
        )
    }

    // MARK: - Kart-card

    @ViewBuilder
    private var mapCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Kart", systemImage: "map.fill")
                    .font(.headline)
                Spacer()
                Text("\(appState.leads.count) leads")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Map {
                ForEach(appState.leads) { lead in
                    Annotation(lead.name, coordinate: CLLocationCoordinate2D(
                        latitude: lead.latitude, longitude: lead.longitude
                    )) {
                        Button {
                            appState.selectedLead = lead
                        } label: {
                            LeadPinView(lead: lead,
                                        selected: appState.selectedLead?.id == lead.id)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(height: 340)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(14)
        .background(
            Color(.secondarySystemBackground),
            in: RoundedRectangle(cornerRadius: 16)
        )
    }

    // MARK: - Leads-tabell

    @ViewBuilder
    private var leadsTable: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Label("Leads i området", systemImage: "list.bullet.rectangle")
                    .font(.headline)
                Spacer()
                Text("Topp \(min(visibleLeads.count, 50)) av \(appState.leads.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 8)
            // Header
            HStack(spacing: 8) {
                Text("Selskap").frame(maxWidth: .infinity, alignment: .leading)
                Text("Bransje").frame(width: 140, alignment: .leading)
                Text("Score").frame(width: 56, alignment: .trailing)
                Text("Status").frame(width: 110, alignment: .leading)
                Text("Neste handling").frame(width: 160, alignment: .leading)
                Text("Forv. verdi").frame(width: 100, alignment: .trailing)
            }
            .font(.caption.bold())
            .foregroundStyle(.secondary)
            .padding(.vertical, 6)
            Divider()
            ForEach(visibleLeads) { lead in
                Button {
                    appState.selectedLead = lead
                } label: {
                    leadRow(lead)
                }
                .buttonStyle(.plain)
                Divider()
            }
            if visibleLeads.isEmpty {
                Text("Ingen leads i området enda.")
                    .foregroundStyle(.secondary)
                    .font(.callout)
                    .padding(.vertical, 24)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(14)
        .background(
            Color(.secondarySystemBackground),
            in: RoundedRectangle(cornerRadius: 16)
        )
    }

    @ViewBuilder
    private func leadRow(_ lead: LeadModel) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(lead.name).font(.callout.weight(.medium)).lineLimit(1)
                if let city = lead.city {
                    Text(city).font(.caption2).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Group {
                if let iid = lead.industryId, let industry = industriesById[iid] {
                    IndustryBadge(industry: industry, style: .compact)
                } else {
                    Text("—").font(.caption2).foregroundStyle(.secondary)
                }
            }
            .frame(width: 140, alignment: .leading)
            Text(lead.leadScore.map { String($0) } ?? "—")
                .font(.callout.bold())
                .monospacedDigit()
                .frame(width: 56, alignment: .trailing)
            HStack(spacing: 4) {
                if let badge = LeadTemperatureBadge(lead: lead, style: .compact) {
                    badge
                } else {
                    Text(lead.status.label)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 110, alignment: .leading)
            Text(lead.nextAction ?? "—")
                .font(.caption)
                .lineLimit(1)
                .foregroundStyle(.secondary)
                .frame(width: 160, alignment: .leading)
            Text(lead.estimatedValue.map { formatMoney($0) } ?? "—")
                .font(.callout)
                .monospacedDigit()
                .frame(width: 100, alignment: .trailing)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }

    // MARK: - Right sidebar

    @ViewBuilder
    private var rightSidebar: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let lead = appState.selectedLead {
                selectedLeadCard(lead)
            } else {
                placeholderSelectedCard
            }
            nbaCard
            routeCard
        }
    }

    @ViewBuilder
    private var placeholderSelectedCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Valgt lead", systemImage: "hand.tap.fill")
                .font(.caption.bold()).foregroundStyle(.secondary)
            Text("Tap en pin eller en rad for å se detaljer.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private func selectedLeadCard(_ lead: LeadModel) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(lead.name).font(.headline)
                    if let badge = LeadTemperatureBadge(lead: lead, style: .pill) {
                        badge
                    }
                }
                Spacer()
                if let score = lead.leadScore {
                    LeadScoreRing(score: score, delta: nil, diameter: 56)
                }
            }
            Divider()
            if let next = lead.nextAction {
                infoRow(icon: "calendar", title: "Neste handling", value: next)
            }
            if let due = lead.nextFollowUpAt {
                infoRow(icon: "clock", title: "Oppfølging",
                        value: due.formatted(date: .abbreviated, time: .shortened))
            }
            if let value = lead.estimatedValue {
                infoRow(icon: "banknote", title: "Forventet verdi",
                        value: formatMoney(value))
            }
            Button {
                presentingLeadDetail = true
            } label: {
                Label("Åpne detalj", systemImage: "arrow.up.right.square")
                    .font(.callout.bold())
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 0.66, green: 0.32, blue: 0.99))
        }
        .padding(14)
        .background(Color(.secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private func infoRow(icon: String, title: String, value: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.caption.bold())
                .frame(width: 22, height: 22)
                .foregroundStyle(.purple)
                .background(Color.purple.opacity(0.12),
                            in: RoundedRectangle(cornerRadius: 6))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.caption2).foregroundStyle(.secondary)
                Text(value).font(.callout).lineLimit(1)
            }
            Spacer()
        }
    }

    @ViewBuilder
    private var nbaCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Neste beste handling", systemImage: "sparkles")
                .font(.caption.bold()).foregroundStyle(.purple)
            if let nba = topNBA {
                Text(nba.leadName ?? "Lead")
                    .font(.headline)
                HStack(spacing: 6) {
                    actionTypeChip(nba.actionType)
                    priorityChip(nba.priority)
                }
                Text(nba.reason)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(4)
            } else if loading {
                ProgressView().controlSize(.small)
            } else {
                Text("Ingen åpne anbefalinger akkurat nå.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            LinearGradient(
                colors: [Color.purple.opacity(0.12),
                         Color(.secondarySystemBackground)],
                startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16)
            .strokeBorder(Color.purple.opacity(0.20)))
    }

    @ViewBuilder
    private var routeCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Ruteanbefaling", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                .font(.caption.bold()).foregroundStyle(.purple)
            if let route = routePreview {
                let km = Double(route.totalDistanceMeters ?? 0) / 1000.0
                let min = (route.totalDriveSeconds ?? 0) / 60
                let h = min / 60
                let m = min % 60
                let timeStr = h > 0 ? "\(h) t \(m) min" : "\(m) min"
                Text("\(route.stops.count) stopp · \(timeStr) · \(formatKm(km))")
                    .font(.callout.bold())
                ForEach(route.stops.prefix(3)) { stop in
                    HStack(spacing: 6) {
                        Image(systemName: "\(stop.position).circle.fill")
                            .foregroundStyle(.purple)
                        Text(stop.name ?? "Stopp \(stop.position)")
                            .font(.caption)
                            .lineLimit(1)
                        Spacer()
                    }
                }
                if route.stops.count > 3 {
                    Text("+ \(route.stops.count - 3) flere")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            } else {
                Text("Bygger ruteforslag fra din posisjon …")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Chips

    private func actionTypeLabelAndIcon(_ type: String) -> (String, String) {
        switch type.lowercased() {
        case "call":    return ("Ring", "phone.fill")
        case "email":   return ("E-post", "envelope.fill")
        case "visit":   return ("Besøk", "figure.walk")
        case "sms":     return ("SMS", "message.fill")
        case "meeting": return ("Møte", "calendar")
        default:        return (type, "bolt.fill")
        }
    }

    @ViewBuilder
    private func actionTypeChip(_ type: String) -> some View {
        let pair = actionTypeLabelAndIcon(type)
        Label(pair.0, systemImage: pair.1)
            .font(.caption2.bold())
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Color.purple.opacity(0.18), in: Capsule())
            .foregroundStyle(.purple)
    }

    private func priorityColor(_ priority: String) -> Color {
        switch priority.lowercased() {
        case "urgent": return .red
        case "high":   return .orange
        case "normal": return .blue
        default:       return .secondary
        }
    }

    @ViewBuilder
    private func priorityChip(_ priority: String) -> some View {
        let color = priorityColor(priority)
        Text(priority.uppercased())
            .font(.caption2.bold())
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.18), in: Capsule())
            .foregroundStyle(color)
    }

    // MARK: - Derivatdata

    private var visibleLeads: [LeadModel] {
        appState.leads
            .sorted { (a, b) in
                (a.leadScore ?? -1) > (b.leadScore ?? -1)
            }
            .prefix(50)
            .map { $0 }
    }

    private var hotLeadCount: Int {
        appState.leads.filter { lead in
            if let t = lead.leadTemperature?.lowercased(), t == "hot" || t == "ready" { return true }
            if let s = lead.leadScore, s >= 90 { return true }
            return false
        }.count
    }

    /// Beste tilgjengelige proxy for trend siden vi ikke har historisk hot-count
    /// — bruker totalLeads-trend som peker i samme retning. Returnerer nil
    /// hvis vi ikke har noe trend-data.
    private var hotLeadTrend: Double? {
        appState.metrics?.trends?.totalLeads
    }

    private var totalEstimatedValue: Double {
        appState.leads.compactMap { $0.estimatedValue }.reduce(0, +)
    }

    // MARK: - Formatering

    private func formatInt(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = "\u{00A0}" // non-breaking space (norsk konvensjon)
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }

    private func formatMoney(_ v: Double) -> String {
        if v >= 1_000_000 {
            return String(format: "NOK %.1f mill.", v / 1_000_000)
        }
        if v >= 10_000 {
            return String(format: "NOK %.0f k", v / 1_000)
        }
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        f.groupingSeparator = "\u{00A0}"
        return "NOK \(f.string(from: NSNumber(value: v)) ?? "\(Int(v))")"
    }

    private func formatKm(_ v: Double) -> String {
        if v < 1 { return String(format: "%.0f m", v * 1000) }
        return String(format: "%.1f km", v)
    }

    // MARK: - Lasting

    private func loadAll(force: Bool = false) async {
        guard let api = appState.api else { return }
        if loading && !force { return }
        loading = true
        defer { loading = false }
        await appState.refreshAll()
        async let m: () = loadMomentum(api: api)
        async let f: () = loadForecast(api: api)
        async let n: () = loadTopNBA(api: api)
        async let r: () = loadRoutePreview(api: api)
        async let i: () = loadIndustries(api: api)
        _ = await (m, f, n, r, i)
    }

    /// Hent industries-katalog én gang (cached i view-state for sesjonen).
    private func loadIndustries(api: APIClient) async {
        guard industriesById.isEmpty else { return }
        do {
            let list = try await api.fetchIndustries()
            var map: [String: Industry] = [:]
            for ind in list { map[ind.id] = ind }
            self.industriesById = map
        } catch { print("[Oversikt] industries failed: \(error)") }
    }

    private func loadMomentum(api: APIClient) async {
        do { self.momentum = try await api.fetchMomentumToday() }
        catch { print("[Oversikt] momentum failed: \(error)") }
    }

    private func loadForecast(api: APIClient) async {
        do { self.forecast = try await api.fetchPipelineForecast(horizon: 90) }
        catch { print("[Oversikt] forecast failed: \(error)") }
    }

    private func loadTopNBA(api: APIClient) async {
        do {
            let items = try await api.fetchNBARecommendations(priority: nil, limit: 1)
            self.topNBA = items.first
        } catch { print("[Oversikt] NBA failed: \(error)") }
    }

    private func loadRoutePreview(api: APIClient) async {
        // Trenger GPS for å bygge rute — hopp over hvis vi ikke har det.
        guard let loc = LocationService.shared.currentLocation else { return }
        do {
            self.routePreview = try await api.planRoute(
                startLat: loc.coordinate.latitude,
                startLng: loc.coordinate.longitude,
                limit: 5
            )
        } catch { print("[Oversikt] route preview failed: \(error)") }
    }
}

/// Stor sirkulær score-ring m/ valgfri delta. Brukes i sidebar og lead-detail.
struct LeadScoreRing: View {
    let score: Int
    let delta: Int?
    var diameter: CGFloat = 96

    private var pct: Double { min(1, max(0, Double(score) / 100.0)) }

    private var color: Color {
        switch score {
        case 90...: return Color(red: 0.66, green: 0.32, blue: 0.99) // hot lilla
        case 70...: return Color(red: 0.46, green: 0.44, blue: 0.99) // lilla-blå
        case 50...: return Color(red: 0.98, green: 0.75, blue: 0.14) // gul
        default:    return Color(red: 0.55, green: 0.60, blue: 0.68) // grå
        }
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.18), lineWidth: diameter / 12)
            Circle()
                .trim(from: 0, to: pct)
                .stroke(
                    LinearGradient(
                        colors: [color, color.opacity(0.75)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(lineWidth: diameter / 12, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(score)")
                    .font(.system(size: diameter / 2.6, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(color)
                if let d = delta, d != 0 {
                    Text((d > 0 ? "↑" : "↓") + "\(abs(d))")
                        .font(.system(size: diameter / 7, weight: .bold))
                        .foregroundStyle(d > 0
                                          ? Color(red: 0.20, green: 0.78, blue: 0.45)
                                          : Color(red: 0.95, green: 0.40, blue: 0.40))
                }
            }
        }
        .frame(width: diameter, height: diameter)
        .accessibilityLabel("Score \(score)")
    }
}
