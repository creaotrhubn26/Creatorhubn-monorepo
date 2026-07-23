// SalgssjefCockpit.swift — 4 nye salgssjef-verktøy (Pakke 10.1, 2026-07-01).
//
// Toppfelt-strip på Salgsledelse-fanen med 4 CTA-kort (badges) som åpner:
//   1. Godkjenning-kø  — deals + rabatter som venter approval
//   2. Team-forecast   — per-selger forecast + team totalt
//   3. Coaching-plan   — 1-til-1 per team-medlem (Pondus + mål + trend)
//   4. Kjøregodtgjørelse — approve utgifter + reise (fra MileageSheet)

import SwiftUI

// MARK: - Brand-palett (Salgsledelse-scope)

fileprivate enum SlBrand {
    static let bg           = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card         = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi       = Color(red: 0.14, green: 0.12, blue: 0.22)
    static let stroke       = Color.white.opacity(0.08)
    static let purple       = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight  = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let orange       = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let green        = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let red          = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let blue         = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let yellow       = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let textPrimary  = Color.white
    static let textSecondary = Color.white.opacity(0.65)
    static let textTertiary = Color.white.opacity(0.4)
}

// MARK: - CockpitStrip: 4 CTA-kort øverst på Salgsledelse-fanen

struct SalgssjefCockpitStrip: View {
    @State private var approvalsOpen = false
    @State private var forecastOpen = false
    @State private var coachingOpen = false
    @State private var mileageOpen = false
    @State private var routesOpen = false

    // Badge-tall avledet av (demo-gatede) datasettene — 0 når demo er AV,
    // til prod-API bindes:
    //  approvals   → GET /sales-leadership/approvals/pending?type=deal,discount
    //  forecast    → GET /leadgrid/forecasting/pipeline
    //  coaching    → GET /sales-leadership/coaching/upcoming
    //  mileage     → GET /sales-leadership/expenses/pending?type=mileage
    //  routes      → GET /sales-leadership/team-routes/today
    private var approvalsCount: Int { ApprovalMockData.items.count }
    private var coachingCount: Int { CoachingMockData.upcoming.count }
    private var mileageCount: Int { MileageMockData.pending.count }
    private var routesCount: Int { TeamRoutesMockData.routes.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "briefcase.circle.fill")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(SlBrand.purpleLight)
                Text("SALGSSJEF-VERKTØY")
                    .font(.appScaled(size: 11, weight: .black))
                    .tracking(0.8)
                    .foregroundStyle(SlBrand.textTertiary)
                Spacer()
            }
            .padding(.horizontal, 4)

            // Wrap i horisontal scroll for iPhone/kompakt-modus — 5 kort
            // blir trangt i iPad-portrait ellers.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    cockpitCard(
                        icon: "checkmark.seal.fill",
                        tint: SlBrand.orange,
                        title: "Godkjenning",
                        subtitle: "Deals + rabatter",
                        badge: approvalsCount,
                        action: { approvalsOpen = true }
                    )
                    cockpitCard(
                        icon: "chart.line.uptrend.xyaxis",
                        tint: SlBrand.purpleLight,
                        title: "Team-forecast",
                        subtitle: "Per selger + team",
                        badge: 0,
                        action: { forecastOpen = true }
                    )
                    cockpitCard(
                        icon: "person.badge.clock.fill",
                        tint: SlBrand.blue,
                        title: "Coaching",
                        subtitle: "1-til-1 planer",
                        badge: coachingCount,
                        action: { coachingOpen = true }
                    )
                    cockpitCard(
                        icon: "car.fill",
                        tint: SlBrand.green,
                        title: "Kjøregodtgj.",
                        subtitle: "Utgifter til approve",
                        badge: mileageCount,
                        action: { mileageOpen = true }
                    )
                    cockpitCard(
                        icon: "point.topleft.down.to.point.bottomright.curvepath",
                        tint: SlBrand.yellow,
                        title: "Ruter i dag",
                        subtitle: "Team-navigasjon",
                        badge: routesCount,
                        action: { routesOpen = true }
                    )
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Tema-bakgrunn: uten denne rendret stripen med helsvart system-
        // bakgrunn over hele bredden — skal matche resten av fanen (samme
        // mørke lilla/navy som SalesLeadershipSheet sin Brand.bg).
        .background(SlBrand.bg.ignoresSafeArea())
        .sheet(isPresented: $approvalsOpen) { ApprovalsQueueSheet() }
        .sheet(isPresented: $forecastOpen) { TeamForecastSheet() }
        .sheet(isPresented: $coachingOpen) { CoachingPlanSheet() }
        .sheet(isPresented: $mileageOpen) { MileageApprovalsSheet() }
        .sheet(isPresented: $routesOpen) { TeamRoutesTodaySheet() }
    }

    private func cockpitCard(
        icon: String,
        tint: Color,
        title: String,
        subtitle: String,
        badge: Int,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(tint.opacity(0.22))
                    Image(systemName: icon)
                        .font(.appScaled(size: 15, weight: .semibold))
                        .foregroundStyle(tint)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(title)
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(SlBrand.textPrimary)
                        if badge > 0 {
                            Text("\(badge)")
                                .font(.appScaled(size: 10, weight: .black, design: .rounded))
                                .foregroundStyle(.white).monospacedDigit()
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(tint, in: Capsule())
                        }
                    }
                    Text(subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(SlBrand.textSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(SlBrand.textTertiary)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(badge > 0 ? tint.opacity(0.4) : SlBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Delt tom-tilstand for cockpit-sheets (ikke-demo uten backend-data)

/// Ærlig tom-tilstand: demo AV og ingen ekte datakilde enda — hele sheet-
/// innholdet (inkl. mock-KPI-er) skjules så ingenting lyver.
fileprivate func cockpitEmptyState(icon: String, title: String, subtitle: String) -> some View {
    VStack(spacing: 10) {
        Image(systemName: icon)
            .font(.appScaled(size: 34, weight: .semibold))
            .foregroundStyle(SlBrand.textTertiary)
        Text(title)
            .font(.appScaled(size: 15, weight: .bold))
            .foregroundStyle(SlBrand.textPrimary)
        Text(subtitle)
            .font(.appScaled(size: 12))
            .foregroundStyle(SlBrand.textSecondary)
            .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 80)
    .padding(.horizontal, 32)
}

// MARK: - 1. ApprovalsQueueSheet — deals + rabatter til godkjenning

struct ApprovalsQueueSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var filter: ApprovalFilter = .all
    @State private var expanded: Set<String> = []
    @State private var decisions: [String: String] = [:]   // itemId → "Godkjent"/"Avslått" (demo)
    @State private var comments: [String: String] = [:]     // itemId → notat
    @State private var commentItem: ApprovalItem?
    // Ekte (backend-)saker — hentes når demo er AV (mig 0406).
    @State private var realItems: [ApprovalItem] = []
    @State private var loaded = false
    @State private var working = false

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }
    private var sourceItems: [ApprovalItem] { isDemo ? ApprovalMockData.items : realItems }

    enum ApprovalFilter: String, CaseIterable, Identifiable {
        case all = "Alle"
        case deal = "Deals"
        case discount = "Rabatter"
        case special = "Spesial"
        var id: String { rawValue }
    }

    private var filtered: [ApprovalItem] {
        let all = sourceItems
        switch filter {
        case .all: return all
        case .deal: return all.filter { $0.kind == .deal }
        case .discount: return all.filter { $0.kind == .discount }
        case .special: return all.filter { $0.kind == .special }
        }
    }

    private func kindFrom(_ s: String) -> ApprovalItem.Kind {
        switch s { case "discount": return .discount; case "special": return .special; default: return .deal }
    }
    private func toItem(_ a: LeadgridApproval) -> ApprovalItem {
        var days = 0
        if let created = a.createdAt, let d = ISO8601DateFormatter().date(from: created) {
            days = max(0, Int(Date().timeIntervalSince(d) / 86400))
        }
        return ApprovalItem(
            id: String(a.id), kind: kindFrom(a.kind), title: a.title,
            sellerName: a.sellerName ?? "Selger", customerName: a.customerName ?? "—",
            amountText: "\(Int(a.amountNok.rounded())) kr", ageDays: days,
            rationale: a.rationale ?? "", backendId: a.id
        )
    }

    private func load() async {
        guard !isDemo, let api = appState.api else { loaded = true; return }
        if let items = try? await api.fetchLeadgridApprovalsPending() {
            realItems = items.map(toItem)
        }
        loaded = true
    }

    private func decide(_ item: ApprovalItem, approve: Bool) async {
        if isDemo { decisions[item.id] = approve ? "Godkjent" : "Avslått"; return }
        guard let id = item.backendId, let api = appState.api else { return }
        working = true
        try? await api.decideLeadgridApproval(id: id, approve: approve, comment: comments[item.id])
        await load()
        working = false
    }

    private func saveComment(_ item: ApprovalItem, _ note: String) {
        comments[item.id] = note
        if !isDemo, let id = item.backendId, let api = appState.api {
            Task { try? await api.commentLeadgridApproval(id: id, comment: note) }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SlBrand.bg.ignoresSafeArea()
                ScrollView {
                    if !loaded && !isDemo {
                        ProgressView().tint(SlBrand.purpleLight).padding(.vertical, 80)
                    } else if sourceItems.isEmpty {
                        cockpitEmptyState(
                            icon: "checkmark.seal",
                            title: "Ingen ventende godkjenninger",
                            subtitle: "Deals og rabatter som venter godkjenning dukker opp her."
                        )
                    } else {
                    VStack(alignment: .leading, spacing: 14) {
                        // KPI-strip
                        HStack(spacing: 12) {
                            kpiTile(label: "VENTER", value: "\(filtered.count)", tint: SlBrand.orange)
                            kpiTile(label: "TOTAL VERDI", value: "1,8 mill.", tint: SlBrand.purple)
                            kpiTile(label: "SNITT-RABATT", value: "12 %", tint: SlBrand.blue)
                            kpiTile(label: "ELDST", value: "3 dager", tint: SlBrand.red)
                        }

                        // Filter-chips
                        HStack(spacing: 8) {
                            ForEach(ApprovalFilter.allCases) { f in
                                Button { filter = f } label: {
                                    Text(f.rawValue)
                                        .font(.appScaled(size: 12, weight: .semibold))
                                        .foregroundStyle(filter == f ? .white : SlBrand.textSecondary)
                                        .padding(.horizontal, 12).padding(.vertical, 7)
                                        .background(
                                            filter == f ? SlBrand.purple : SlBrand.cardHi,
                                            in: Capsule()
                                        )
                                }.buttonStyle(.plain)
                            }
                            Spacer()
                        }

                        // Approval-cards
                        VStack(spacing: 10) {
                            ForEach(filtered) { item in
                                approvalCard(item)
                            }
                        }

                        Color.clear.frame(height: 20)
                    }
                    .padding(20)
                    }
                }
            }
            .navigationTitle("Godkjenningskø")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(SlBrand.textSecondary)
                }
            }
            .toolbarBackground(SlBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(item: $commentItem) { item in
                ApprovalCommentSheet(item: item, existing: comments[item.id] ?? "") { note in
                    saveComment(item, note)
                }
            }
            .task { if !loaded { await load() } }
        }
    }

    private func kpiTile(label: String, value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(SlBrand.textTertiary).tracking(0.6)
            Text(value).font(.appScaled(size: 20, weight: .heavy, design: .rounded))
                .foregroundStyle(tint).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SlBrand.stroke, lineWidth: 1))
    }

    private func approvalCard(_ item: ApprovalItem) -> some View {
        let isOpen = expanded.contains(item.id)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(item.kind.color.opacity(0.22))
                    Image(systemName: item.kind.icon)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(item.kind.color)
                }.frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title).font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white).lineLimit(1)
                    Text("\(item.sellerName) · \(item.customerName) · \(item.ageDays)d siden")
                        .font(.appScaled(size: 10)).foregroundStyle(SlBrand.textSecondary)
                }
                Spacer(minLength: 6)
                Text(item.amountText)
                    .font(.appScaled(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(.white).monospacedDigit()
            }
            if isOpen {
                Divider().background(SlBrand.stroke)
                Text(item.rationale).font(.appScaled(size: 12))
                    .foregroundStyle(SlBrand.textSecondary)
                if let note = comments[item.id], !note.isEmpty {
                    Label(note, systemImage: "text.bubble.fill")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(SlBrand.purpleLight)
                }
                if let decision = decisions[item.id] {
                    HStack(spacing: 8) {
                        Label(decision == "Godkjent" ? "Godkjent" : "Avslått",
                              systemImage: decision == "Godkjent" ? "checkmark.seal.fill" : "xmark.seal.fill")
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(decision == "Godkjent" ? SlBrand.green : SlBrand.red)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background((decision == "Godkjent" ? SlBrand.green : SlBrand.red).opacity(0.16), in: Capsule())
                        Button("Angre") { decisions[item.id] = nil }
                            .buttonStyle(OutlineSlButtonStyle(tint: SlBrand.textSecondary))
                        Spacer()
                    }
                } else {
                    HStack(spacing: 8) {
                        Button("Godkjenn") { Task { await decide(item, approve: true) } }
                            .buttonStyle(FilledSlButtonStyle(tint: SlBrand.green))
                            .disabled(working)
                        Button("Avslå") { Task { await decide(item, approve: false) } }
                            .buttonStyle(OutlineSlButtonStyle(tint: SlBrand.red))
                            .disabled(working)
                        Button("Kommentar") { commentItem = item }
                            .buttonStyle(OutlineSlButtonStyle(tint: SlBrand.purpleLight))
                        Spacer()
                    }
                }
            }
        }
        .padding(12)
        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.stroke, lineWidth: 1))
        .contentShape(Rectangle())
        .onTapGesture {
            if isOpen { expanded.remove(item.id) } else { expanded.insert(item.id) }
        }
    }
}

private struct ApprovalCommentSheet: View {
    let item: ApprovalItem
    let existing: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var draft: String = ""

    var body: some View {
        NavigationStack {
            ZStack {
                SlBrand.bg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 10) {
                    Text(item.title).font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
                    Text("\(item.sellerName) · \(item.customerName)")
                        .font(.appScaled(size: 11)).foregroundStyle(SlBrand.textSecondary)
                    TextEditor(text: $draft)
                        .frame(minHeight: 140)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(SlBrand.stroke, lineWidth: 1))
                        .foregroundStyle(.white)
                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Kommentar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(SlBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") { onSave(draft); dismiss() }.tint(SlBrand.purpleLight)
                }
            }
            .toolbarBackground(SlBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .onAppear { if draft.isEmpty { draft = existing } }
        }
    }
}

struct ApprovalItem: Identifiable {
    let id: String
    let kind: Kind
    let title: String
    let sellerName: String
    let customerName: String
    let amountText: String
    let ageDays: Int
    let rationale: String
    /// Satt for ekte (backend-)saker — brukes til å avgjøre mot API.
    var backendId: Int? = nil

    enum Kind {
        case deal, discount, special
        var color: Color {
            switch self {
            case .deal: return SlBrand.purpleLight
            case .discount: return SlBrand.orange
            case .special: return SlBrand.blue
            }
        }
        var icon: String {
            switch self {
            case .deal: return "briefcase.fill"
            case .discount: return "percent"
            case .special: return "star.fill"
            }
        }
    }
}

enum ApprovalMockData {
    /// Mock — KUN i demo-modus.
    static var items: [ApprovalItem] {
        DemoModeManager.isActiveNonisolated ? _items : []
    }
    private static let _items: [ApprovalItem] = [
        ApprovalItem(id: "a1", kind: .discount, title: "18 % rabatt over grense (12 %)",
                     sellerName: "Sara Lindberg", customerName: "Nordic Elektro AS",
                     amountText: "287 000 kr", ageDays: 1,
                     rationale: "Kunde nekter over 195k. Vi holder på deal ved 18 % rabatt. Alternativ: miste hele avtalen."),
        ApprovalItem(id: "a2", kind: .deal, title: "Multi-år-kontrakt 2 år (standard 1 år)",
                     sellerName: "Mikkel Berg", customerName: "Byggmester Hansen AS",
                     amountText: "480 000 kr", ageDays: 2,
                     rationale: "Kunden vil ha 2-års-lås for prisrabatt. Sikrer 480k mot 220k/år standard. Godkjenne?"),
        ApprovalItem(id: "a3", kind: .special, title: "Free onboarding + white-glove",
                     sellerName: currentUser(), customerName: "Skøyen Software AS",
                     amountText: "540 000 kr", ageDays: 3,
                     rationale: "Enterprise-avtale. Vi tilbyr gratis 4-uker onboarding + kundeansvarlig-tildelt. Vurdert ROI: +18 % expansion.")
    ]

    private static func currentUser() -> String { "Lars Kristensen" }
}

// MARK: - 2. TeamForecastSheet — per-selger + team totalt

struct TeamForecastSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var horizon: Horizon = .q

    enum Horizon: String, CaseIterable, Identifiable {
        case m = "30d"
        case q = "Q3"
        case y = "YTD"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SlBrand.bg.ignoresSafeArea()
                ScrollView {
                    if TeamForecastMockData.rows.isEmpty {
                        cockpitEmptyState(
                            icon: "chart.line.uptrend.xyaxis",
                            title: "Ingen forecast-data enda",
                            subtitle: "Team-forecast vises her når pipeline-data er koblet til."
                        )
                    } else {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("Team-forecast")
                                .font(.appScaled(size: 22, weight: .heavy))
                                .foregroundStyle(.white)
                            Spacer()
                            Picker("", selection: $horizon) {
                                ForEach(Horizon.allCases) { h in
                                    Text(h.rawValue).tag(h)
                                }
                            }
                            .pickerStyle(.segmented)
                            .frame(width: 220)
                        }

                        // 3 hovedtall
                        HStack(spacing: 12) {
                            forecastTile("PREDIKERT", value: "14,2 mill.", trend: "+18 %", tint: SlBrand.green)
                            forecastTile("MÅL", value: "12,5 mill.", trend: "+114 %", tint: SlBrand.purpleLight)
                            forecastTile("PIPELINE", value: "38,6 mill.", trend: "83 % wgt.", tint: SlBrand.blue)
                        }

                        // Per-selger-forecast
                        VStack(alignment: .leading, spacing: 10) {
                            Text("PER SELGER")
                                .font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(SlBrand.textTertiary).tracking(0.8)
                            ForEach(TeamForecastMockData.rows) { row in
                                forecastRow(row)
                            }
                        }
                        .padding(14)
                        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.stroke, lineWidth: 1))

                        // AI-anbefaling
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "sparkles").font(.appScaled(size: 20, weight: .bold))
                                .foregroundStyle(SlBrand.purpleLight)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("CLAUDE ANALYSE")
                                    .font(.appScaled(size: 10, weight: .black))
                                    .foregroundStyle(SlBrand.purpleLight).tracking(0.8)
                                Text("Karoline og Marte har 3× mer pipeline enn kvote — flytt 4 leads fra Anniken til dem for å balansere forecast-risiko.")
                                    .font(.appScaled(size: 13, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .padding(14)
                        .background(SlBrand.purple.opacity(0.14), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.purple.opacity(0.4), lineWidth: 1))
                    }
                    .padding(20)
                    }
                }
            }
            .navigationTitle("Team-forecast")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(SlBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    ShareLink(item: forecastReport) {
                        HStack(spacing: 5) {
                            Image(systemName: "square.and.arrow.up").font(.appScaled(size: 11))
                            Text("Del rapport").font(.appScaled(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(SlBrand.purple, in: Capsule())
                    }.buttonStyle(.plain)
                }
            }
            .toolbarBackground(SlBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var forecastReport: String {
        var lines = ["Team-forecast", ""]
        for r in TeamForecastMockData.rows {
            lines.append("\(r.name): prognose \(r.predictedText) (mål \(r.goalText), \(r.trendText), \(Int(r.attainment * 100))% måloppnåelse)")
        }
        return lines.joined(separator: "\n")
    }

    private func forecastTile(_ label: String, value: String, trend: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(SlBrand.textTertiary).tracking(0.6)
            Text(value).font(.appScaled(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.55)
            HStack(spacing: 3) {
                Image(systemName: "arrow.up.right").font(.appScaled(size: 8, weight: .bold))
                Text(trend).font(.appScaled(size: 10, weight: .bold, design: .rounded))
            }.foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SlBrand.stroke, lineWidth: 1))
    }

    private func forecastRow(_ row: ForecastRow) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(row.color.opacity(0.28))
                Text(row.initials)
                    .font(.appScaled(size: 11, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }.frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.name).font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Mål: \(row.goalText)").font(.appScaled(size: 10))
                    .foregroundStyle(SlBrand.textSecondary)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 2) {
                Text(row.predictedText)
                    .font(.appScaled(size: 14, weight: .heavy, design: .rounded))
                    .foregroundStyle(row.trend >= 0 ? SlBrand.green : SlBrand.red).monospacedDigit()
                Text(row.trendText).font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(row.trend >= 0 ? SlBrand.green : SlBrand.red)
            }
            // Progress-mini-bar
            ZStack(alignment: .leading) {
                Capsule().fill(SlBrand.cardHi).frame(width: 60, height: 6)
                Capsule().fill(row.color)
                    .frame(width: max(4, min(60, 60 * row.attainment)), height: 6)
            }
        }
        .padding(.vertical, 6)
    }
}

struct ForecastRow: Identifiable {
    let id = UUID()
    let name: String
    let initials: String
    let color: Color
    let predictedText: String
    let goalText: String
    let trend: Int  // -100…+100 pct
    let trendText: String
    let attainment: Double  // 0…1
}

enum TeamForecastMockData {
    /// Mock — KUN i demo-modus.
    static var rows: [ForecastRow] {
        DemoModeManager.isActiveNonisolated ? _rows : []
    }
    private static let _rows: [ForecastRow] = [
        ForecastRow(name: "Anniken Sørli",  initials: "AS", color: SlBrand.purpleLight, predictedText: "3,2 mill.", goalText: "3,0 mill.", trend: 7,   trendText: "+7 %",   attainment: 1.06),
        ForecastRow(name: "Mikkel Berg",    initials: "MB", color: SlBrand.green,       predictedText: "2,8 mill.", goalText: "2,5 mill.", trend: 12,  trendText: "+12 %",  attainment: 1.12),
        ForecastRow(name: "Lars Kristensen",initials: "LK", color: SlBrand.blue,        predictedText: "2,1 mill.", goalText: "2,0 mill.", trend: 5,   trendText: "+5 %",   attainment: 1.05),
        ForecastRow(name: "Sara Lindberg",  initials: "SL", color: SlBrand.orange,      predictedText: "1,8 mill.", goalText: "2,2 mill.", trend: -18, trendText: "−18 %",  attainment: 0.82),
        ForecastRow(name: "Karoline Nesse", initials: "KN", color: SlBrand.yellow,      predictedText: "1,5 mill.", goalText: "1,3 mill.", trend: 15,  trendText: "+15 %",  attainment: 1.15),
        ForecastRow(name: "Marte Johansen", initials: "MJ", color: SlBrand.red,         predictedText: "1,2 mill.", goalText: "1,1 mill.", trend: 9,   trendText: "+9 %",   attainment: 1.09)
    ]
}

// MARK: - 3. CoachingPlanSheet — 1-til-1 per selger

struct CoachingPlanSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var showNew = false
    @State private var scheduled: [CoachingRow] = []      // demo: lokalt planlagte
    @State private var realSessions: [LeadgridCoachingSession] = []
    @State private var loaded = false

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    private func shortDate(_ iso: String?) -> String {
        guard let iso, let d = ISO8601DateFormatter().date(from: iso) else { return "—" }
        let f = DateFormatter(); f.locale = Locale(identifier: "nb_NO"); f.dateFormat = "d. MMM"
        return f.string(from: d)
    }
    private func rowColor(_ name: String) -> Color {
        let palette: [Color] = [SlBrand.purpleLight, SlBrand.green, SlBrand.blue, SlBrand.orange, SlBrand.yellow, SlBrand.red]
        return palette[abs(name.hashValue) % palette.count]
    }
    private func initials(_ name: String) -> String {
        let i = name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined().uppercased()
        return i.isEmpty ? "?" : i
    }
    private func toRow(_ s: LeadgridCoachingSession) -> CoachingRow {
        CoachingRow(
            name: s.memberName, initials: initials(s.memberName), color: rowColor(s.memberName),
            headline: ((s.focus?.isEmpty == false ? s.focus! : "1-til-1") + " · " + shortDate(s.scheduledAt)),
            pondusText: "—", goalText: "—", trendUp: true,
            lastMeetingText: shortDate(s.scheduledAt), isScheduled: true
        )
    }

    /// «KOMMENDE 1-TIL-1» — demo: mock; ekte: backend-økter.
    private var upcomingRows: [CoachingRow] { isDemo ? CoachingMockData.upcoming : realSessions.map(toRow) }
    /// Kandidater til «Ny 1-til-1» + «ALLE KANDIDATER» — ekte: team-medlemmer.
    private var candidateRows: [CoachingRow] {
        if isDemo { return CoachingMockData.all }
        return TeamData.members.map { m in
            CoachingRow(name: m.name, initials: m.initials, color: m.color, headline: m.area,
                        pondusText: "—", goalText: "—", trendUp: true, lastMeetingText: "—", isScheduled: false)
        }
    }

    private func load() async {
        guard !isDemo, let api = appState.api else { loaded = true; return }
        if let s = try? await api.fetchLeadgridCoachingSessions() { realSessions = s }
        loaded = true
    }
    private func schedule(name: String, date: Date, focus: String) {
        if isDemo {
            let base = candidateRows.first { $0.name == name }
            scheduled.insert(CoachingRow(
                name: name, initials: base?.initials ?? "–", color: base?.color ?? SlBrand.purpleLight,
                headline: focus.isEmpty ? "1-til-1 planlagt" : focus,
                pondusText: "—", goalText: "—", trendUp: true, lastMeetingText: "Nå", isScheduled: true), at: 0)
        } else if let api = appState.api {
            let uid = TeamLiveStore.shared.memberDTOs.first { $0.name == name }?.userId
            Task {
                try? await api.createLeadgridCoachingSession(
                    memberName: name, memberUserId: uid, scheduledAt: date, focus: focus.isEmpty ? nil : focus)
                await load()
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SlBrand.bg.ignoresSafeArea()
                ScrollView {
                    if !loaded && !isDemo {
                        ProgressView().tint(SlBrand.purpleLight).padding(.vertical, 80)
                    } else if upcomingRows.isEmpty && candidateRows.isEmpty && scheduled.isEmpty {
                        cockpitEmptyState(
                            icon: "person.badge.clock",
                            title: "Ingen coaching-planer enda",
                            subtitle: "Planlegg en 1-til-1 med «Ny 1-til-1» øverst."
                        )
                    } else {
                    VStack(alignment: .leading, spacing: 14) {
                        // Hero
                        HStack(spacing: 12) {
                            ZStack {
                                Circle().fill(SlBrand.blue.opacity(0.22))
                                Image(systemName: "person.badge.clock.fill")
                                    .font(.appScaled(size: 20, weight: .semibold))
                                    .foregroundStyle(SlBrand.blue)
                            }.frame(width: 48, height: 48)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Coaching-plan").font(.appScaled(size: 20, weight: .heavy))
                                    .foregroundStyle(.white)
                                Text("12 selgere · 2 planlagte 1-til-1 denne uka")
                                    .font(.appScaled(size: 12)).foregroundStyle(SlBrand.textSecondary)
                            }
                            Spacer()
                        }

                        if !scheduled.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("NETTOPP PLANLAGT")
                                    .font(.appScaled(size: 10, weight: .black))
                                    .foregroundStyle(SlBrand.textTertiary).tracking(0.8)
                                ForEach(scheduled) { c in
                                    coachingRow(c)
                                }
                            }
                            .padding(14)
                            .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.stroke, lineWidth: 1))
                        }

                        if !upcomingRows.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("KOMMENDE 1-TIL-1")
                                .font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(SlBrand.textTertiary).tracking(0.8)
                            ForEach(upcomingRows) { c in
                                coachingRow(c)
                            }
                        }
                        .padding(14)
                        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.stroke, lineWidth: 1))
                        }

                        if !candidateRows.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("ALLE COACHING-KANDIDATER")
                                .font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(SlBrand.textTertiary).tracking(0.8)
                            ForEach(candidateRows) { c in
                                coachingRow(c)
                            }
                        }
                        .padding(14)
                        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.stroke, lineWidth: 1))
                        }
                    }
                    .padding(20)
                    }
                }
            }
            .navigationTitle("Coaching")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(SlBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { showNew = true } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "plus").font(.appScaled(size: 11, weight: .bold))
                            Text("Ny 1-til-1").font(.appScaled(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(SlBrand.purple, in: Capsule())
                    }.buttonStyle(.plain)
                }
            }
            .toolbarBackground(SlBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $showNew) {
                NewCoachingSheet(candidates: candidateRows) { name, date, focus in
                    schedule(name: name, date: date, focus: focus)
                }
            }
            .task { if !loaded { await load() } }
        }
    }

    private func coachingRow(_ c: CoachingRow) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(c.color.opacity(0.28))
                Text(c.initials).font(.appScaled(size: 12, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }.frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(c.name).font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    if c.isScheduled {
                        Text("PÅ AGENDAEN")
                            .font(.appScaled(size: 8, weight: .black))
                            .foregroundStyle(SlBrand.blue).tracking(0.6)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(SlBrand.blue.opacity(0.18), in: Capsule())
                    }
                }
                Text(c.headline).font(.appScaled(size: 11)).foregroundStyle(SlBrand.textSecondary)
                HStack(spacing: 8) {
                    metric("Pondus", c.pondusText, tint: SlBrand.purpleLight)
                    metric("Måltrek", c.goalText, tint: c.trendUp ? SlBrand.green : SlBrand.red)
                    metric("Siste 1:1", c.lastMeetingText, tint: SlBrand.textSecondary)
                }
            }
            Spacer(minLength: 6)
            Image(systemName: "chevron.right").font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(SlBrand.textTertiary)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }

    private func metric(_ label: String, _ value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.appScaled(size: 8, weight: .black))
                .foregroundStyle(SlBrand.textTertiary).tracking(0.5)
            Text(value).font(.appScaled(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(tint).monospacedDigit()
        }
    }
}

struct CoachingRow: Identifiable {
    let id = UUID()
    let name: String
    let initials: String
    let color: Color
    let headline: String
    let pondusText: String
    let goalText: String
    let trendUp: Bool
    let lastMeetingText: String
    let isScheduled: Bool
}

enum CoachingMockData {
    /// Mock — KUN i demo-modus.
    static var upcoming: [CoachingRow] {
        DemoModeManager.isActiveNonisolated ? _upcoming : []
    }
    static var all: [CoachingRow] {
        DemoModeManager.isActiveNonisolated ? _all : []
    }
    private static let _upcoming: [CoachingRow] = [
        CoachingRow(name: "Sara Lindberg", initials: "SL", color: SlBrand.orange,
                    headline: "Under mål Q3 · Fokus: prisinnvending",
                    pondusText: "62", goalText: "−18 %", trendUp: false,
                    lastMeetingText: "3 uker", isScheduled: true),
        CoachingRow(name: "Karoline Nesse", initials: "KN", color: SlBrand.yellow,
                    headline: "Rekord Q3 · Fokus: skala metode",
                    pondusText: "89", goalText: "+15 %", trendUp: true,
                    lastMeetingText: "2 uker", isScheduled: true)
    ]
    private static let _all: [CoachingRow] = [
        CoachingRow(name: "Anniken Sørli",  initials: "AS", color: SlBrand.purpleLight,
                    headline: "Topp-selger · Delta som mentor?",
                    pondusText: "91", goalText: "+7 %",  trendUp: true,  lastMeetingText: "1 mnd", isScheduled: false),
        CoachingRow(name: "Mikkel Berg",    initials: "MB", color: SlBrand.green,
                    headline: "Stabil topp-3 · Diskuter enterprise",
                    pondusText: "85", goalText: "+12 %", trendUp: true,  lastMeetingText: "2 uker", isScheduled: false),
        CoachingRow(name: "Tobias Strand",  initials: "TS", color: SlBrand.orange,
                    headline: "Flatt · Trigg momentum",
                    pondusText: "72", goalText: "0 %",   trendUp: true,  lastMeetingText: "5 uker", isScheduled: false),
        CoachingRow(name: "Henrik Aase",    initials: "HA", color: SlBrand.red,
                    headline: "Fall −2 rank · Følges tett",
                    pondusText: "68", goalText: "−9 %",  trendUp: false, lastMeetingText: "1 uke",  isScheduled: false),
        CoachingRow(name: "Jonas Halvorsen",initials: "JH", color: SlBrand.purple,
                    headline: "Promotør-rolle · Cross-team-mentor",
                    pondusText: "76", goalText: "+3 %",  trendUp: true,  lastMeetingText: "4 uker", isScheduled: false)
    ]
}

private struct NewCoachingSheet: View {
    let candidates: [CoachingRow]
    let onSchedule: (String, Date, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedName: String = ""
    @State private var date: Date = Date()
    @State private var focus: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Selger") {
                    Picker("Velg selger", selection: $selectedName) {
                        ForEach(candidates) { c in Text(c.name).tag(c.name) }
                    }
                }
                Section("Tidspunkt") {
                    DatePicker("Dato", selection: $date, displayedComponents: [.date])
                }
                Section("Fokus") {
                    TextField("Hva skal 1-til-1-en handle om?", text: $focus)
                }
            }
            .navigationTitle("Ny 1-til-1")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Planlegg") {
                        onSchedule(selectedName, date, focus)
                        dismiss()
                    }
                    .disabled(selectedName.isEmpty)
                }
            }
            .onAppear { if selectedName.isEmpty { selectedName = candidates.first?.name ?? "" } }
        }
    }
}

// MARK: - 4. MileageApprovalsSheet — kjøregodtgjørelse

struct MileageApprovalsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var paidIds: Set<UUID> = []
    // Ekte (backend-)krav — hentes når demo er AV (mig 0405).
    @State private var realPending: [MileageEntry] = []
    @State private var realRecent: [MileageEntry] = []
    @State private var loaded = false
    @State private var working = false

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }
    private var pendingList: [MileageEntry] { isDemo ? MileageMockData.pending : realPending }
    private var recentList: [MileageEntry] { isDemo ? MileageMockData.recent : realRecent }

    private func isPaid(_ m: MileageEntry) -> Bool { m.isPaid || paidIds.contains(m.id) }
    private var allPendingPaid: Bool {
        !pendingList.isEmpty && pendingList.allSatisfy { isPaid($0) }
    }
    private var pendingTotalNok: Int {
        pendingList.reduce(0) { $0 + (Int($1.amountText.filter { $0.isNumber }) ?? 0) }
    }
    private var pendingTotalKm: Int { pendingList.reduce(0) { $0 + $1.km } }

    private var mileageCSV: String {
        var lines = ["Selger;Dato;Rute;KM;Beløp;Status"]
        for m in pendingList + recentList {
            let status = isPaid(m) ? "Utbetalt" : "Til godkjenning"
            lines.append("\(m.sellerName);\(m.dateText);\(m.routeText);\(m.km);\(m.amountText);\(status)")
        }
        return lines.joined(separator: "\n")
    }

    // Map ekte krav → visnings-MileageEntry (bærer backendId for godkjenning).
    private func toEntry(_ c: LeadgridMileageClaim) -> MileageEntry {
        let name = c.sellerName ?? "Selger"
        let inits = name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined().uppercased()
        let palette: [Color] = [SlBrand.purpleLight, SlBrand.green, SlBrand.blue, SlBrand.orange, SlBrand.yellow, SlBrand.red]
        let color = palette[abs(c.sellerUserId.hashValue) % palette.count]
        return MileageEntry(
            sellerName: name, initials: inits.isEmpty ? "?" : inits, color: color,
            dateText: c.tripDate, routeText: c.routeText ?? "",
            km: Int(c.km.rounded()), amountText: "\(Int(c.amountNok.rounded())) kr",
            isPaid: c.status != "pending", backendId: c.id, claimStatus: c.status
        )
    }

    private func load() async {
        guard !isDemo, let api = appState.api else { loaded = true; return }
        async let p = try? api.fetchLeadgridMileagePending()
        async let r = try? api.fetchLeadgridMileageRecent()
        let (pend, rec) = await (p, r)
        realPending = (pend ?? []).map(toEntry)
        realRecent = (rec ?? []).map(toEntry)
        loaded = true
    }

    private func approve(_ m: MileageEntry) async {
        if isDemo { withAnimation { _ = paidIds.insert(m.id) }; return }
        guard let id = m.backendId, let api = appState.api else { return }
        working = true
        try? await api.approveLeadgridMileage(id: id)
        await load()
        working = false
    }

    private func approveAll() async {
        if isDemo { withAnimation { for m in pendingList { paidIds.insert(m.id) } }; return }
        guard let api = appState.api else { return }
        working = true
        _ = try? await api.approveAllLeadgridMileage()
        await load()
        working = false
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SlBrand.bg.ignoresSafeArea()
                ScrollView {
                    if !loaded && !isDemo {
                        ProgressView().tint(SlBrand.purpleLight).padding(.vertical, 80)
                    } else if pendingList.isEmpty && recentList.isEmpty {
                        cockpitEmptyState(
                            icon: "car",
                            title: "Ingen kjøregodtgjørelser enda",
                            subtitle: "Krav selgerne sender inn dukker opp her til godkjenning."
                        )
                    } else {
                    VStack(alignment: .leading, spacing: 14) {
                        // KPI
                        HStack(spacing: 12) {
                            kpiTile("VENTER", "\(pendingList.count)", SlBrand.orange)
                            kpiTile("TOTAL km", "\(pendingTotalKm)", SlBrand.blue)
                            kpiTile("Å UTBETALE", "\(pendingTotalNok) kr", SlBrand.green)
                        }

                        // Ventende krav
                        if !pendingList.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("VENTER GODKJENNING (\(pendingList.count))")
                                .font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(SlBrand.textTertiary).tracking(0.8)
                            ForEach(pendingList) { m in
                                mileageRow(m)
                            }
                        }
                        .padding(14)
                        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.stroke, lineWidth: 1))

                        // Batch-godkjenn
                        Button {
                            Task { await approveAll() }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.seal.fill")
                                Text(allPendingPaid ? "Alle godkjent ✓" : "Godkjenn alle \(pendingList.count) (\(pendingTotalNok) kr)")
                                    .font(.appScaled(size: 14, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(
                                LinearGradient(colors: [SlBrand.green, SlBrand.green.opacity(0.85)],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 12)
                            )
                            .shadow(color: SlBrand.green.opacity(0.4), radius: 8, y: 2)
                            .opacity(allPendingPaid || working ? 0.6 : 1)
                        }
                        .buttonStyle(.plain)
                        .disabled(allPendingPaid || working)
                        }

                        // Historikk
                        if !recentList.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(isDemo ? "SISTE UTBETALT" : "GODKJENT")
                                .font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(SlBrand.textTertiary).tracking(0.8)
                            ForEach(recentList) { m in
                                mileageRow(m)
                            }
                        }
                        .padding(14)
                        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.stroke, lineWidth: 1))
                        }
                    }
                    .padding(20)
                    }
                }
                .task { if !loaded { await load() } }
            }
            .navigationTitle("Kjøregodtgjørelse")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(SlBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    ShareLink(item: mileageCSV) {
                        HStack(spacing: 5) {
                            Image(systemName: "arrow.down.doc").font(.appScaled(size: 11))
                            Text("Eksporter til lønn").font(.appScaled(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(SlBrand.purple, in: Capsule())
                    }.buttonStyle(.plain)
                }
            }
            .toolbarBackground(SlBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private func kpiTile(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(SlBrand.textTertiary).tracking(0.6)
            Text(value).font(.appScaled(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(tint).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SlBrand.stroke, lineWidth: 1))
    }

    private func mileageRow(_ m: MileageEntry) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(m.color.opacity(0.28))
                Text(m.initials).font(.appScaled(size: 10, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }.frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(m.sellerName) · \(m.dateText)").font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Text(m.routeText).font(.appScaled(size: 10)).foregroundStyle(SlBrand.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(m.km) km").font(.appScaled(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white).monospacedDigit()
                Text(m.amountText).font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(SlBrand.green).monospacedDigit()
            }
            if !isPaid(m) {
                Button { Task { await approve(m) } } label: {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 20, weight: .bold))
                        .foregroundStyle(SlBrand.green)
                }.buttonStyle(.plain)
            } else {
                Image(systemName: "checkmark.seal.fill")
                    .font(.appScaled(size: 16))
                    .foregroundStyle(SlBrand.textTertiary)
            }
        }
        .padding(.vertical, 6)
    }
}

struct MileageEntry: Identifiable {
    let id = UUID()
    let sellerName: String
    let initials: String
    let color: Color
    let dateText: String
    let routeText: String
    let km: Int
    let amountText: String
    let isPaid: Bool
    /// Satt for ekte (backend-)krav — brukes til å godkjenne mot API.
    var backendId: Int? = nil
    var claimStatus: String? = nil
}

enum MileageMockData {
    /// Mock — KUN i demo-modus.
    static var pending: [MileageEntry] {
        DemoModeManager.isActiveNonisolated ? _pending : []
    }
    static var recent: [MileageEntry] {
        DemoModeManager.isActiveNonisolated ? _recent : []
    }
    private static let _pending: [MileageEntry] = [
        MileageEntry(sellerName: "Sara Lindberg",   initials: "SL", color: SlBrand.blue,        dateText: "I dag", routeText: "Oslo → Sandvika → Lysaker", km: 42, amountText: "210 kr", isPaid: false),
        MileageEntry(sellerName: "Mikkel Berg",     initials: "MB", color: SlBrand.green,       dateText: "I går", routeText: "Oslo → Lillestrøm → Skedsmo", km: 68, amountText: "340 kr", isPaid: false),
        MileageEntry(sellerName: "Anniken Sørli",   initials: "AS", color: SlBrand.purpleLight, dateText: "27. juni", routeText: "Oslo → Drammen (5 kunder)", km: 110, amountText: "550 kr", isPaid: false),
        MileageEntry(sellerName: "Tobias Strand",   initials: "TS", color: SlBrand.orange,      dateText: "26. juni", routeText: "Bergen → Askøy → Nesttun", km: 95, amountText: "475 kr", isPaid: false),
        MileageEntry(sellerName: "Karoline Nesse",  initials: "KN", color: SlBrand.yellow,      dateText: "25. juni", routeText: "Stavanger → Sandnes → Klepp", km: 105, amountText: "525 kr", isPaid: false)
    ]
    private static let _recent: [MileageEntry] = [
        MileageEntry(sellerName: "Marte Johansen",  initials: "MJ", color: SlBrand.red,         dateText: "24. juni", routeText: "Oslo → Fornebu", km: 26, amountText: "130 kr", isPaid: true),
        MileageEntry(sellerName: "Henrik Aase",     initials: "HA", color: SlBrand.red,         dateText: "23. juni", routeText: "Oslo → Grorud → Bekkestua", km: 48, amountText: "240 kr", isPaid: true),
        MileageEntry(sellerName: "Jonas Halvorsen", initials: "JH", color: SlBrand.purple,      dateText: "22. juni", routeText: "Tromsø → Karlsøy", km: 82, amountText: "410 kr", isPaid: true)
    ]
}

// MARK: - 5. TeamRoutesTodaySheet — team-navigasjon: hvor er selgerne, ruter i dag

struct TeamRoutesTodaySheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var filter: RouteFilter = .active
    @State private var navigatingTo: TeamRoute?
    @State private var toast: String?
    @State private var optimized = false
    @State private var showRouteDetails = false
    @State private var showPlanner = false

    enum RouteFilter: String, CaseIterable, Identifiable {
        case active = "Aktiv"
        case planned = "Planlagt"
        case done = "Fullført"
        case idle = "Ingen rute"
        var id: String { rawValue }
    }

    private var filtered: [TeamRoute] {
        TeamRoutesMockData.routes.filter { $0.state == filter }
    }


    var body: some View {
        NavigationStack {
            ZStack {
                SlBrand.bg.ignoresSafeArea()
                ScrollView {
                    if TeamRoutesMockData.routes.isEmpty {
                        cockpitEmptyState(
                            icon: "point.topleft.down.to.point.bottomright.curvepath",
                            title: "Ingen team-ruter i dag",
                            subtitle: "Selgernes planlagte og aktive ruter vises her."
                        )
                    } else {
                    VStack(alignment: .leading, spacing: 14) {
                        // KPI-strip: hvem er ute, hvem er ikke
                        HStack(spacing: 12) {
                            kpiTile("PÅ VEIEN", "4", SlBrand.green)
                            kpiTile("PLANLAGT", "3", SlBrand.purpleLight)
                            kpiTile("HJEMME", "5", SlBrand.textTertiary)
                            kpiTile("SNITT ETA", "34 min", SlBrand.blue)
                        }

                        // AI-anbefaling for ruteoptimalisering
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "sparkles").font(.appScaled(size: 18, weight: .bold))
                                .foregroundStyle(SlBrand.purpleLight)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("RUTEOPTIMALISERING")
                                    .font(.appScaled(size: 10, weight: .black))
                                    .foregroundStyle(SlBrand.purpleLight).tracking(0.8)
                                Text("Sara og Mikkel har overlappende ruter i Sandvika-området (5 km fra hverandre). Del leads mellom dem for å spare 42 km i dag.")
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                if optimized {
                                    Label("Optimert — 42 km spart", systemImage: "checkmark.seal.fill")
                                        .font(.appScaled(size: 12, weight: .bold))
                                        .foregroundStyle(SlBrand.green)
                                        .padding(.top, 2)
                                } else {
                                    HStack(spacing: 8) {
                                        Button("Optimér ruter") {
                                            withAnimation { optimized = true }
                                            flash("Ruter optimert — 42 km spart")
                                        }
                                        .buttonStyle(FilledSlButtonStyle(tint: SlBrand.purple))
                                        Button("Se detaljer") { showRouteDetails = true }
                                            .buttonStyle(OutlineSlButtonStyle(tint: SlBrand.purpleLight))
                                        Spacer()
                                    }
                                }
                            }
                        }
                        .padding(14)
                        .background(SlBrand.purple.opacity(0.14), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.purple.opacity(0.4), lineWidth: 1))

                        // Filter-chips
                        HStack(spacing: 8) {
                            ForEach(RouteFilter.allCases) { f in
                                Button { filter = f } label: {
                                    Text(f.rawValue)
                                        .font(.appScaled(size: 12, weight: .semibold))
                                        .foregroundStyle(filter == f ? .white : SlBrand.textSecondary)
                                        .padding(.horizontal, 12).padding(.vertical, 7)
                                        .background(
                                            filter == f ? SlBrand.purple : SlBrand.cardHi,
                                            in: Capsule()
                                        )
                                }.buttonStyle(.plain)
                            }
                            Spacer()
                        }

                        // Selger-ruter
                        VStack(spacing: 10) {
                            ForEach(filtered) { route in
                                teamRouteCard(route)
                            }
                            if filtered.isEmpty {
                                Text("Ingen selgere i denne kategorien.")
                                    .font(.appScaled(size: 12))
                                    .foregroundStyle(SlBrand.textTertiary)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding(30)
                            }
                        }

                        Color.clear.frame(height: 20)
                    }
                    .padding(20)
                    }
                }
            }
            .navigationTitle("Team-ruter i dag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(SlBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { showPlanner = true } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "point.topleft.down.to.point.bottomright.curvepath")
                                .font(.appScaled(size: 11, weight: .bold))
                            Text("Planlegg ny rute").font(.appScaled(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(SlBrand.purple, in: Capsule())
                    }.buttonStyle(.plain)
                }
            }
            .toolbarBackground(SlBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            // «Naviger dit» → ekte Kart-nav-motor (POV/Kjøre, MKDirections, POI
            // langs rute, kjøregodtgjørelse) i stedet for den frosne mock-HUD-en.
            .onChange(of: navigatingTo?.id) { _, newID in
                guard newID != nil, let route = navigatingTo, let d = route.destination else { return }
                appState.requestNavigation(
                    lat: d.lat, lon: d.lon, name: d.company, address: d.address, start: true)
                navigatingTo = nil
                dismiss()
            }
            .overlay(alignment: .top) {
                if let t = toast {
                    Label(t, systemImage: "checkmark.circle.fill")
                        .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(SlBrand.green, in: Capsule())
                        .padding(.top, 8)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
            .sheet(isPresented: $showPlanner) {
                RoutePlannerSheet()
            }
            .sheet(isPresented: $showRouteDetails) {
                NavigationStack {
                    ZStack {
                        SlBrand.bg.ignoresSafeArea()
                        ScrollView {
                            VStack(alignment: .leading, spacing: 14) {
                                HStack(spacing: 10) {
                                    Image(systemName: "sparkles").font(.appScaled(size: 20, weight: .bold))
                                        .foregroundStyle(SlBrand.purpleLight)
                                    Text("Rute-overlapp").font(.appScaled(size: 18, weight: .heavy))
                                        .foregroundStyle(.white)
                                }
                                Text("Sara Lindberg og Mikkel Berg har overlappende ruter i Sandvika-området — kun ~5 km fra hverandre.")
                                    .font(.appScaled(size: 13)).foregroundStyle(SlBrand.textSecondary)
                                VStack(alignment: .leading, spacing: 10) {
                                    detailRow("Avstand mellom ruter", "≈ 5 km")
                                    detailRow("Potensiell besparelse", "42 km i dag")
                                    detailRow("Forslag", "Del leads mellom Sara og Mikkel")
                                }
                                .padding(14)
                                .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.stroke, lineWidth: 1))
                            }
                            .padding(20)
                        }
                    }
                    .navigationTitle("Ruteoptimalisering")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Lukk") { showRouteDetails = false }.tint(SlBrand.purpleLight)
                        }
                    }
                    .toolbarBackground(SlBrand.bg, for: .navigationBar)
                    .toolbarBackground(.visible, for: .navigationBar)
                    .toolbarColorScheme(.dark, for: .navigationBar)
                }
            }
        }
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.appScaled(size: 12)).foregroundStyle(SlBrand.textSecondary)
            Spacer()
            Text(value).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
        }
    }

    private func flash(_ text: String) {
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            if toast == text { toast = nil }
        }
    }

    private func kpiTile(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(SlBrand.textTertiary).tracking(0.6)
            Text(value).font(.appScaled(size: 20, weight: .heavy, design: .rounded))
                .foregroundStyle(tint).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(SlBrand.stroke, lineWidth: 1))
    }

    private func teamRouteCard(_ route: TeamRoute) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(route.color.opacity(0.28))
                    Text(route.initials)
                        .font(.appScaled(size: 12, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }.frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(route.name).font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        stateBadge(route.state)
                    }
                    Text(route.currentText)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(SlBrand.textSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(route.progressText)
                        .font(.appScaled(size: 11, weight: .bold, design: .rounded))
                        .foregroundStyle(SlBrand.textSecondary)
                    Text(route.etaText)
                        .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(.white).monospacedDigit()
                }
            }
            // Rute-progress bar
            ZStack(alignment: .leading) {
                Capsule().fill(SlBrand.cardHi).frame(height: 6)
                Capsule().fill(
                    LinearGradient(colors: [route.color, route.color.opacity(0.7)],
                                   startPoint: .leading, endPoint: .trailing)
                )
                .frame(width: max(6, min(300, 300 * route.progress)), height: 6)
            }
            // 3 CTA — «Se på kart» + «Naviger dit» åpner Meetings' full nav-HUD.
            HStack(spacing: 8) {
                Button {
                    if route.destination != nil {
                        navigatingTo = route
                    } else {
                        flash("Ingen destinasjon på ruten enda")
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "location.fill").font(.appScaled(size: 10, weight: .bold))
                        Text("Se på kart").font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(SlBrand.blue)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(SlBrand.blue.opacity(0.15), in: Capsule())
                }.buttonStyle(.plain)
                Button {
                    flash("Melding sendt til \(route.name.split(separator: " ").first ?? "")")
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "message.fill").font(.appScaled(size: 10, weight: .bold))
                        Text("Send melding").font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(SlBrand.purpleLight)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(SlBrand.purple.opacity(0.18), in: Capsule())
                }.buttonStyle(.plain)
                Button {
                    if route.destination != nil {
                        navigatingTo = route
                    } else {
                        flash("Ingen destinasjon å navigere til")
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.turn.up.right.diamond.fill").font(.appScaled(size: 10, weight: .bold))
                        Text("Naviger dit").font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(route.destination != nil ? SlBrand.green : SlBrand.textTertiary)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(
                        (route.destination != nil ? SlBrand.green : SlBrand.textTertiary).opacity(0.15),
                        in: Capsule()
                    )
                }.buttonStyle(.plain)
                .disabled(route.destination == nil)
                Spacer()
            }
        }
        .padding(12)
        .background(SlBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(SlBrand.stroke, lineWidth: 1))
    }

    private func stateBadge(_ state: RouteFilter) -> some View {
        HStack(spacing: 3) {
            Circle().fill(stateColor(state)).frame(width: 5, height: 5)
            Text(state.rawValue.uppercased())
                .font(.appScaled(size: 8, weight: .black))
                .tracking(0.6)
                .foregroundStyle(stateColor(state))
        }
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(stateColor(state).opacity(0.18), in: Capsule())
    }

    private func stateColor(_ state: RouteFilter) -> Color {
        switch state {
        case .active: return SlBrand.green
        case .planned: return SlBrand.purpleLight
        case .done: return SlBrand.blue
        case .idle: return SlBrand.textTertiary
        }
    }
}

struct TeamRoute: Identifiable {
    let id = UUID()
    let name: String
    let initials: String
    let color: Color
    let state: TeamRoutesTodaySheet.RouteFilter
    let currentText: String
    let progressText: String
    let etaText: String
    let progress: Double  // 0…1
    /// Neste destinasjon på ruten — sendes til den ekte Kart-nav-motoren via
    /// AppState.requestNavigation når salgssjef trykker «Naviger dit».
    /// nil for done/idle/planlagt-uten-lat-lon.
    let destination: TeamRouteDestination?
}

struct TeamRouteDestination {
    let company: String
    let address: String
    let lat: Double
    let lon: Double
    let driveTimeMin: Int
    let driveDistanceKm: Int
}

enum TeamRoutesMockData {
    /// Mock — KUN i demo-modus.
    static var routes: [TeamRoute] {
        DemoModeManager.isActiveNonisolated ? _routes : []
    }
    private static let _routes: [TeamRoute] = [
        // Aktive nå — hver har en destination så «Naviger dit» virker
        TeamRoute(name: "Sara Lindberg", initials: "SL", color: SlBrand.orange, state: .active,
                  currentText: "På vei til Nordic Elektro AS · 6 min igjen",
                  progressText: "3/5 stopp", etaText: "14:32", progress: 0.6,
                  destination: TeamRouteDestination(
                    company: "Nordic Elektro AS", address: "Storgata 12, 0184 Oslo",
                    lat: 59.9139, lon: 10.7522, driveTimeMin: 6, driveDistanceKm: 4)),
        TeamRoute(name: "Mikkel Berg", initials: "MB", color: SlBrand.green, state: .active,
                  currentText: "Ankommer Byggmester Hansen · nå",
                  progressText: "2/4 stopp", etaText: "13:45", progress: 0.5,
                  destination: TeamRouteDestination(
                    company: "Byggmester Hansen AS", address: "Sofienberggata 15, 0558 Oslo",
                    lat: 59.9276, lon: 10.7663, driveTimeMin: 2, driveDistanceKm: 1)),
        TeamRoute(name: "Anniken Sørli", initials: "AS", color: SlBrand.purpleLight, state: .active,
                  currentText: "Møte hos Bjørvika Innovation · +12 min",
                  progressText: "5/7 stopp", etaText: "16:20", progress: 0.71,
                  destination: TeamRouteDestination(
                    company: "Bjørvika Innovation", address: "Dronning Eufemias gate 8, 0191 Oslo",
                    lat: 59.9075, lon: 10.7565, driveTimeMin: 12, driveDistanceKm: 7)),
        TeamRoute(name: "Karoline Nesse", initials: "KN", color: SlBrand.yellow, state: .active,
                  currentText: "På vei til Sandnes → Klepp",
                  progressText: "4/6 stopp", etaText: "15:10", progress: 0.66,
                  destination: TeamRouteDestination(
                    company: "Nesse Klepp-kunder (5)", address: "Klepp stasjon, 4353 Klepp",
                    lat: 58.7787, lon: 5.6403, driveTimeMin: 18, driveDistanceKm: 22)),
        // Planlagt — også destinations så salgssjef kan preview-nav dagens ruter
        TeamRoute(name: "Tobias Strand", initials: "TS", color: SlBrand.orange, state: .planned,
                  currentText: "Rute Bergen-sentrum → Askøy (5 stopp) · starter 15:00",
                  progressText: "0/5 stopp", etaText: "Starter 15:00", progress: 0,
                  destination: TeamRouteDestination(
                    company: "Askøy Byggutstyr AS", address: "Kleppestø, 5300 Kleppestø",
                    lat: 60.4013, lon: 5.2277, driveTimeMin: 32, driveDistanceKm: 28)),
        TeamRoute(name: "Lars Kristensen", initials: "LK", color: SlBrand.blue, state: .planned,
                  currentText: "Oslo sentrum → Frogner → Majorstuen · starter i morgen 09:00",
                  progressText: "0/3 stopp", etaText: "I morgen", progress: 0,
                  destination: TeamRouteDestination(
                    company: "Frogner Tannlege", address: "Bygdøy allé 4, 0257 Oslo",
                    lat: 59.9187, lon: 10.7126, driveTimeMin: 14, driveDistanceKm: 6)),
        TeamRoute(name: "Marte Johansen", initials: "MJ", color: SlBrand.red, state: .planned,
                  currentText: "Fornebu → Lysaker · starter 14:30",
                  progressText: "0/4 stopp", etaText: "Starter 14:30", progress: 0,
                  destination: TeamRouteDestination(
                    company: "Lysaker Logistikk", address: "Lysaker Torg 5, 1366 Lysaker",
                    lat: 59.9126, lon: 10.6371, driveTimeMin: 22, driveDistanceKm: 14)),
        // Fullført — destination = nil (ingen navigering til historikk)
        TeamRoute(name: "Henrik Aase", initials: "HA", color: SlBrand.red, state: .done,
                  currentText: "Fullført Oslo → Grorud → Bekkestua (2 møter, 1 dead lead)",
                  progressText: "3/3 stopp ✓", etaText: "12:45", progress: 1.0,
                  destination: nil),
        TeamRoute(name: "Jonas Halvorsen", initials: "JH", color: SlBrand.purple, state: .done,
                  currentText: "Fullført Tromsø → Karlsøy (2 nye deals)",
                  progressText: "4/4 stopp ✓", etaText: "11:20", progress: 1.0,
                  destination: nil),
        // Ingen rute
        TeamRoute(name: "Sara Vik", initials: "SV", color: SlBrand.textTertiary, state: .idle,
                  currentText: "Ingen planlagt rute · på hjemmekontoret",
                  progressText: "—", etaText: "—", progress: 0, destination: nil),
        TeamRoute(name: "Erik Bakken", initials: "EB", color: SlBrand.textTertiary, state: .idle,
                  currentText: "Ingen planlagt rute · book-only i dag",
                  progressText: "—", etaText: "—", progress: 0, destination: nil)
    ]
}

// MARK: - Shared button styles

fileprivate struct FilledSlButtonStyle: ButtonStyle {
    let tint: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.appScaled(size: 12, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(tint, in: Capsule())
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}

fileprivate struct OutlineSlButtonStyle: ButtonStyle {
    let tint: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.appScaled(size: 12, weight: .semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(tint.opacity(0.14), in: Capsule())
            .overlay(Capsule().stroke(tint.opacity(0.4), lineWidth: 1))
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}
