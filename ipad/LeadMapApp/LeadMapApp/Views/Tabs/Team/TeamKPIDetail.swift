// TeamKPIDetail.swift
//
// Detalj-modal som åpnes når man tap'er på en av de 5 KPI-cardene i Team-fanen.
// Drill-down m/ Swift Chart trend + per-medlem breakdown + insight + actions.

import SwiftUI
import Charts

enum TeamKPI: String, Identifiable, CaseIterable {
    case totalLeads = "Totalt leads"
    case meetings = "Møter i dag"
    case wonValue = "Vunnet verdi"
    case avgLeadScore = "Gj.snitt. lead score"
    case momentum = "Momentum (team)"
    case sales = "Antall salg"                 // ← NY built-in KPI

    var id: String { rawValue }

    var bigValue: String {
        switch self {
        case .totalLeads:   return "1 248"
        case .meetings:     return "23"
        case .wonValue:     return "NOK 350 000"
        case .avgLeadScore: return "72"
        case .momentum:     return "68 %"
        case .sales:        return "47"
        }
    }
    var trend: String {
        switch self {
        case .totalLeads: return "+18 %"; case .meetings: return "+15 %"
        case .wonValue: return "+24 %"; case .avgLeadScore: return "+8 %"; case .momentum: return "+12 %"
        case .sales: return "+11 %"
        }
    }

    /// EKTE verdi fra TeamLiveStore (uke 2) — brukes når demo er AV så
    /// KPI-kortene ikke viser mockup-tallene i `bigValue` for reelle team.
    @MainActor var liveValue: String {
        let store = TeamLiveStore.shared
        let members = store.members
        func fmt(_ n: Int) -> String {
            let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "
            return f.string(from: NSNumber(value: n)) ?? "\(n)"
        }
        switch self {
        case .totalLeads:
            return fmt(members.reduce(0) { $0 + $1.leads })
        case .meetings:
            return fmt(members.reduce(0) { $0 + $1.meetings })
        case .wonValue:
            return "NOK \(fmt(members.reduce(0) { $0 + $1.valueNok }))"
        case .avgLeadScore:
            return "\(store.avgLeadScore)"
        case .momentum:
            return members.isEmpty
                ? "0 %"
                : "\(members.reduce(0) { $0 + $1.momentum } / members.count) %"
        case .sales:
            return fmt(store.salesCount)
        }
    }

    var subtitle: String {
        switch self {
        case .totalLeads:   return "Aktive leads på tvers av teamet"
        case .meetings:     return "Møter booket i dag"
        case .wonValue:     return "Lukket verdi denne perioden"
        case .avgLeadScore: return "Gjennomsnitt på alle aktive leads"
        case .momentum:     return "Team-momentum siste 30 dager"
        case .sales:        return "Lukkede deals denne perioden"
        }
    }
    var icon: String {
        switch self {
        case .totalLeads: return "person.3.fill"
        case .meetings: return "calendar"
        case .wonValue: return "trophy.fill"
        case .avgLeadScore: return "flame.fill"
        case .momentum: return "chart.line.uptrend.xyaxis"
        case .sales: return "cart.fill"
        }
    }
    var tint: Color {
        switch self {
        case .totalLeads: return TBrand.purpleLight
        case .meetings: return TBrand.blue
        case .wonValue: return TBrand.green
        case .avgLeadScore: return TBrand.yellow
        case .momentum: return TBrand.pink
        case .sales: return TBrand.orange
        }
    }
}

struct TeamKPIDetailSheet: View {
    let kpi: TeamKPI
    @Environment(\.dismiss) private var dismiss
    @State private var period: Period = .month
    @State private var showSetGoal = false
    @State private var showAlert = false
    @State private var showBreakdown = false
    @State private var showShare = false

    enum Period: String, CaseIterable, Hashable {
        case week = "7 dgr", month = "30 dgr", quarter = "90 dgr", year = "12 mnd"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    hero
                    periodPicker
                    trendCard
                    breakdownCard
                    insightCard
                    actionsRow
                    Color.clear.frame(height: 20)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle(kpi.rawValue)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button { TeamStubActions.performGated(.teamExportCSV, actionName: "Eksporter CSV") } label: { Label("Eksporter CSV", systemImage: "tablecells") }
                        Button { TeamStubActions.toast("Sett mål") } label: { Label("Sett mål", systemImage: "target") }
                        Button { TeamStubActions.performGated(.teamCompareToPrevious, actionName: "Sammenlign m/ forrige periode") } label: { Label("Sammenlign m/ forrige", systemImage: "chart.bar.xaxis") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundStyle(TBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    // MARK: Hero

    private var hero: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [kpi.tint, kpi.tint.opacity(0.55)],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: kpi.icon)
                    .font(.system(size: 19, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 3) {
                Text(kpi.subtitle)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(TBrand.textSecondary)
                    .textCase(.uppercase)
                    .tracking(0.5)
                HStack(alignment: .firstTextBaseline, spacing: 9) {
                    Text(kpi.bigValue)
                        .font(.system(size: 30, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                        .lineLimit(1).minimumScaleFactor(0.6)
                    Text(kpi.trend)
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(TBrand.green)
                        .monospacedDigit()
                }
                Text("vs. forrige periode")
                    .font(.system(size: 11))
                    .foregroundStyle(TBrand.textTertiary)
            }
            Spacer()
        }
        .padding(16)
        .background(
            LinearGradient(colors: [kpi.tint.opacity(0.18), kpi.tint.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 16)
        )
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(kpi.tint.opacity(0.35), lineWidth: 1))
    }

    // MARK: Period picker

    private var periodPicker: some View {
        HStack(spacing: 5) {
            ForEach(Period.allCases, id: \.self) { p in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { period = p }
                } label: {
                    Text(p.rawValue)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(period == p ? .white : TBrand.textSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(
                            period == p ? AnyShapeStyle(kpi.tint) : AnyShapeStyle(Color.clear),
                            in: Capsule()
                        )
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(4)
        .background(TBrand.card, in: Capsule())
        .overlay(Capsule().stroke(TBrand.stroke, lineWidth: 1))
    }

    // MARK: Trend chart

    private var trendPoints: [(day: String, value: Double)] {
        let count: Int
        switch period {
        case .week: count = 7
        case .month: count = 30
        case .quarter: count = 13      // ukentlig
        case .year: count = 12         // månedlig
        }
        let base: Double = {
            switch kpi {
            case .totalLeads: return 1248
            case .meetings: return 23
            case .wonValue: return 350_000
            case .avgLeadScore: return 72
            case .momentum: return 68
            case .sales: return 47
            }
        }()
        return (0..<count).map { i in
            let phase = Double(i) / Double(count) * .pi * 2
            let trend = 0.4 + 0.6 * (Double(i) / Double(count))  // overordnet vekst
            let noise = 0.85 + 0.30 * sin(phase * 1.7)
            return (label(i, count: count), base * trend * noise)
        }
    }

    private func label(_ i: Int, count: Int) -> String {
        switch period {
        case .week:    return ["Ma","Ti","On","To","Fr","Lø","Sø"][i % 7]
        case .month:   return "D\(i+1)"
        case .quarter: return "U\(i+1)"
        case .year:    return ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"][i % 12]
        }
    }

    private var trendCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Trend")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                HStack(spacing: 5) {
                    Circle().fill(kpi.tint).frame(width: 7, height: 7)
                    Text(kpi.rawValue)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(TBrand.textSecondary)
                }
            }
            Chart {
                ForEach(trendPoints.indices, id: \.self) { i in
                    let p = trendPoints[i]
                    AreaMark(x: .value("Dag", p.day),
                             y: .value("Verdi", p.value))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [kpi.tint.opacity(0.5), kpi.tint.opacity(0.05)],
                                startPoint: .top, endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.catmullRom)
                    LineMark(x: .value("Dag", p.day),
                             y: .value("Verdi", p.value))
                        .foregroundStyle(kpi.tint)
                        .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                        .interpolationMethod(.catmullRom)
                }
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: period == .month ? 6 : 7)) { _ in
                    AxisValueLabel().foregroundStyle(TBrand.textSecondary)
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisGridLine().foregroundStyle(TBrand.stroke)
                    AxisValueLabel().foregroundStyle(TBrand.textTertiary)
                }
            }
            .frame(height: 200)
        }
        .padding(14)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
    }

    // MARK: Breakdown per medlem

    private var breakdownCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                Text("Per medlem")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(TeamData.members.count) selgere")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(TBrand.textSecondary)
            }
            VStack(spacing: 8) {
                let sorted = TeamData.members.sorted { memberValue($0) > memberValue($1) }
                let maxVal = max(sorted.first.map(memberValue) ?? 1, 1)
                ForEach(sorted) { m in
                    memberBarRow(m, maxValue: maxVal)
                }
            }
        }
        .padding(14)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
    }

    private func memberValue(_ m: TeamMember) -> Double {
        switch kpi {
        case .totalLeads:   return Double(m.leads)
        case .meetings:     return Double(m.meetings)
        case .wonValue:     return Double(m.valueNok)
        case .avgLeadScore: return Double(m.leads / 3 + 50)        // mock
        case .momentum:     return Double(m.momentum)
        case .sales:        return Double(m.valueNok / 50_000)     // mock: 1 salg per 50k
        }
    }

    private func formatVal(_ v: Double) -> String {
        switch kpi {
        case .wonValue:
            if v >= 1_000_000 { return String(format: "%.1fM", v / 1_000_000) }
            if v >= 1_000     { return "\(Int(v) / 1000)k" }
            return "\(Int(v))"
        case .momentum, .avgLeadScore: return "\(Int(v))%"
        default: return "\(Int(v))"
        }
    }

    private func memberBarRow(_ m: TeamMember, maxValue: Double) -> some View {
        let v = memberValue(m)
        let frac = max(0.02, v / max(1, maxValue))
        return HStack(spacing: 11) {
            ZStack {
                Circle().fill(m.color.opacity(0.85))
                Text(m.initials)
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(m.name)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer()
                    Text(formatVal(v))
                        .font(.system(size: 12, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(TBrand.cardHi).frame(height: 6)
                        Capsule()
                            .fill(LinearGradient(colors: [m.color, m.color.opacity(0.5)],
                                                 startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(8, geo.size.width * frac), height: 6)
                    }
                }
                .frame(height: 6)
            }
        }
    }

    // MARK: Insight

    private var insightCard: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [TBrand.purple, TBrand.purpleLight],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "sparkles")
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text("AI-INNSIKT")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(TBrand.purpleLight)
                    .tracking(0.6)
                Text(aiInsight)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(13)
        .background(TBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(TBrand.purple.opacity(0.35), lineWidth: 1))
    }

    private var aiInsight: String {
        switch kpi {
        case .totalLeads:   return "Kari og Ola står for 36 % av alle nye leads. Vurder å delegere noen til Henrik som ligger 5 % bak forrige periode."
        case .meetings:     return "Tirsdag har 3× flere bookede møter enn snitt. Beskytt denne dagen for selgere — ikke planlegg intern-tid her."
        case .wonValue:     return "Snitt-deal-størrelse har vokst 24 % — fortsett å fokusere på pipeline >NOK 150k for å holde trenden."
        case .avgLeadScore: return "Snittet er 72 — over terskel 65 for kvalifiserte leads. Source 'Discovery'-flyten gir best-scorede leads (snitt 84)."
        case .momentum:     return "Team-momentum 68 % er på rekord-nivå. Henrik (42 %) trenger 1:1-coaching for å løfte gjennomsnittet ytterligere."
        case .sales:        return "47 salg på 30 dager — snitt-deal-størrelse NOK 7.4k. Vurder å fokusere på større enterprise-deals for å øke ARPU."
        }
    }

    // MARK: Actions

    private var actionsRow: some View {
        HStack(spacing: 8) {
            actionBtn(icon: "target",              label: "Sett mål",    color: TBrand.purpleLight) { showSetGoal = true }
            actionBtn(icon: "bell.badge.fill",     label: "Lag alert",   color: TBrand.orange)      { showAlert = true }
            actionBtn(icon: "person.3.fill",       label: "Per medlem",  color: TBrand.blue)        { showBreakdown = true }
            actionBtn(icon: "square.and.arrow.up", label: "Del rapport", color: TBrand.green)       { showShare = true }
        }
        .sheet(isPresented: $showSetGoal)   { SetKPIGoalSheet(kpi: kpi) }
        .sheet(isPresented: $showAlert)     { CreateKPIAlertSheet(kpi: kpi) }
        .sheet(isPresented: $showBreakdown) { KPIMemberBreakdownSheet(kpi: kpi) }
        .sheet(isPresented: $showShare)     { ShareKPIReportSheet(kpi: kpi) }
    }

    private func actionBtn(icon: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(color)
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(color.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - SetKPIGoalSheet

struct SetKPIGoalSheet: View {
    let kpi: TeamKPI
    @Environment(\.dismiss) private var dismiss
    @State private var targetValue: Double = 100
    @State private var deadline = Calendar.current.date(byAdding: .month, value: 1, to: Date()) ?? Date()
    @State private var reminderFreq: Reminder = .weekly
    @State private var notifyTeam = true
    @State private var stretch = false

    enum Reminder: String, CaseIterable, Hashable {
        case daily = "Daglig", weekly = "Ukentlig", monthly = "Månedlig", never = "Aldri"
    }

    private var sliderRange: ClosedRange<Double> {
        switch kpi {
        case .totalLeads: return 100...5000
        case .meetings:   return 1...100
        case .wonValue:   return 50_000...5_000_000
        case .avgLeadScore, .momentum: return 0...100
        case .sales:      return 1...500
        }
    }

    private var formatted: String {
        switch kpi {
        case .wonValue:
            if targetValue >= 1_000_000 { return String(format: "NOK %.1fM", targetValue / 1_000_000) }
            return "NOK \(Int(targetValue/1000))k"
        case .avgLeadScore, .momentum: return "\(Int(targetValue))%"
        default: return "\(Int(targetValue))"
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    targetCard
                    deadlineCard
                    reminderCard
                    optionsCard
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Sett mål")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { saveBar }
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(kpi.tint.opacity(0.22))
                Image(systemName: "target")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(kpi.tint)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text(kpi.rawValue)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Nåværende: \(kpi.bigValue) \(kpi.trend)")
                    .font(.system(size: 11))
                    .foregroundStyle(TBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var targetCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Målverdi")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(TBrand.textSecondary)
                Spacer()
                Text(formatted)
                    .font(.system(size: 22, weight: .black, design: .rounded))
                    .foregroundStyle(kpi.tint)
                    .monospacedDigit()
            }
            Slider(value: $targetValue, in: sliderRange,
                   step: sliderRange.upperBound > 100_000 ? 10_000 : 1)
                .tint(kpi.tint)
            HStack {
                Text(formatRange(sliderRange.lowerBound))
                    .font(.system(size: 9))
                    .foregroundStyle(TBrand.textTertiary)
                Spacer()
                Text(formatRange(sliderRange.upperBound))
                    .font(.system(size: 9))
                    .foregroundStyle(TBrand.textTertiary)
            }
        }
        .padding(13)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(TBrand.stroke, lineWidth: 1))
    }

    private func formatRange(_ v: Double) -> String {
        if v >= 1_000_000 { return "\(Int(v/1_000_000))M" }
        if v >= 1_000     { return "\(Int(v/1000))k" }
        return "\(Int(v))"
    }

    private var deadlineCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Frist")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            DatePicker("Frist", selection: $deadline, in: Date()..., displayedComponents: .date)
                .datePickerStyle(.compact)
                .tint(kpi.tint)
                .colorScheme(.dark)
                .labelsHidden()
                .padding(.vertical, 4)
        }
        .padding(13)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var reminderCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Påminnelse")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            HStack(spacing: 6) {
                ForEach(Reminder.allCases, id: \.self) { r in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { reminderFreq = r }
                    } label: {
                        Text(r.rawValue)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(reminderFreq == r ? .white : TBrand.purpleLight)
                            .padding(.horizontal, 9).padding(.vertical, 7)
                            .background(
                                reminderFreq == r ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(TBrand.purple.opacity(0.15)),
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(TBrand.purple.opacity(reminderFreq == r ? 0 : 0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(13)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var optionsCard: some View {
        VStack(spacing: 8) {
            Toggle(isOn: $notifyTeam) {
                HStack(spacing: 7) {
                    Image(systemName: "person.3.fill").font(.system(size: 11)).foregroundStyle(TBrand.blue)
                    Text("Del med hele teamet").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                }
            }
            .tint(TBrand.purple)
            Divider().overlay(TBrand.stroke)
            Toggle(isOn: $stretch) {
                HStack(spacing: 7) {
                    Image(systemName: "flame.fill").font(.system(size: 11)).foregroundStyle(TBrand.orange)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Stretch-mål").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                        Text("+25 % over baseline").font(.system(size: 10)).foregroundStyle(TBrand.textSecondary)
                    }
                }
            }
            .tint(TBrand.purple)
        }
        .padding(11)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var saveBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "target")
                    .font(.system(size: 13, weight: .bold))
                Text("Sett mål: \(formatted)")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [kpi.tint, kpi.tint.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(TBrand.bg.opacity(0.95).overlay(Rectangle().fill(TBrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - CreateKPIAlertSheet

struct CreateKPIAlertSheet: View {
    let kpi: TeamKPI
    @Environment(\.dismiss) private var dismiss
    @State private var condition: Condition = .below
    @State private var threshold: Double = 50
    @State private var channels: Set<Channel> = [.push, .email]
    @State private var freq: Frequency = .immediate

    enum Condition: String, CaseIterable, Hashable {
        case below = "Under", above = "Over", changes = "Endres > 10 %"
        var icon: String {
            switch self {
            case .below: return "arrow.down.right.circle.fill"
            case .above: return "arrow.up.right.circle.fill"
            case .changes: return "arrow.up.arrow.down.circle.fill"
            }
        }
        var color: Color {
            switch self {
            case .below: return TBrand.red
            case .above: return TBrand.green
            case .changes: return TBrand.orange
            }
        }
    }

    enum Channel: String, CaseIterable, Hashable {
        case push = "Push", email = "E-post", sms = "SMS", slack = "Slack"
        var icon: String {
            switch self {
            case .push: return "iphone.gen2"
            case .email: return "envelope.fill"
            case .sms: return "message.fill"
            case .slack: return "number"
            }
        }
        var color: Color {
            switch self {
            case .push: return TBrand.purpleLight
            case .email: return TBrand.blue
            case .sms: return TBrand.green
            case .slack: return TBrand.orange
            }
        }
    }

    enum Frequency: String, CaseIterable, Hashable {
        case immediate = "Umiddelbart", once = "Én gang/dag", weekly = "Ukentlig"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    conditionCard
                    if condition != .changes { thresholdCard }
                    channelsCard
                    freqCard
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Lag alert")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { confirmBar }
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(TBrand.orange.opacity(0.22))
                Image(systemName: "bell.badge.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(TBrand.orange)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text("Varsle når \(kpi.rawValue)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Nåværende: \(kpi.bigValue)")
                    .font(.system(size: 11))
                    .foregroundStyle(TBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var conditionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Trigger")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            VStack(spacing: 6) {
                ForEach(Condition.allCases, id: \.self) { c in
                    let isSelected = condition == c
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { condition = c }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: c.icon)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(c.color)
                            Text(c.rawValue + (c == .changes ? "" : " terskel"))
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Spacer()
                            Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                                .font(.system(size: 17))
                                .foregroundStyle(isSelected ? c.color : TBrand.stroke)
                        }
                        .padding(10)
                        .background(
                            isSelected ? c.color.opacity(0.10) : TBrand.card,
                            in: RoundedRectangle(cornerRadius: 11)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(isSelected ? c.color.opacity(0.4) : TBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var thresholdCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Terskel")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(TBrand.textSecondary)
                Spacer()
                Text(thresholdFormatted)
                    .font(.system(size: 18, weight: .black, design: .rounded))
                    .foregroundStyle(condition.color)
                    .monospacedDigit()
            }
            Slider(value: $threshold, in: thresholdRange, step: 1)
                .tint(condition.color)
        }
        .padding(13)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var thresholdRange: ClosedRange<Double> {
        switch kpi {
        case .wonValue: return 0...2000      // i tusen
        case .totalLeads: return 0...2000
        case .meetings: return 0...50
        case .avgLeadScore, .momentum: return 0...100
        case .sales: return 0...200
        }
    }

    private var thresholdFormatted: String {
        switch kpi {
        case .wonValue: return "NOK \(Int(threshold))k"
        case .avgLeadScore, .momentum: return "\(Int(threshold))%"
        default: return "\(Int(threshold))"
        }
    }

    private var channelsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kanaler")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 7) {
                ForEach(Channel.allCases, id: \.self) { c in
                    let isOn = channels.contains(c)
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            if isOn { channels.remove(c) } else { _ = channels.insert(c) }
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: c.icon)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(isOn ? .white : c.color)
                            Text(c.rawValue)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                            Spacer()
                            if isOn {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 13))
                                    .foregroundStyle(.white)
                            }
                        }
                        .padding(10)
                        .background(
                            isOn ? AnyShapeStyle(c.color) : AnyShapeStyle(TBrand.card),
                            in: RoundedRectangle(cornerRadius: 11)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(isOn ? Color.clear : TBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var freqCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Frekvens")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            HStack(spacing: 6) {
                ForEach(Frequency.allCases, id: \.self) { f in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { freq = f }
                    } label: {
                        Text(f.rawValue)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(freq == f ? .white : TBrand.purpleLight)
                            .padding(.horizontal, 11).padding(.vertical, 8)
                            .background(
                                freq == f ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(TBrand.purple.opacity(0.15)),
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(TBrand.purple.opacity(freq == f ? 0 : 0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var confirmBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 13, weight: .bold))
                Text(channels.isEmpty ? "Velg minst én kanal" : "Aktiver alert")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: channels.isEmpty ? [TBrand.cardHi, TBrand.cardHi] : [TBrand.orange, TBrand.yellow],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(channels.isEmpty ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .disabled(channels.isEmpty)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(TBrand.bg.opacity(0.95).overlay(Rectangle().fill(TBrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - KPIMemberBreakdownSheet

struct KPIMemberBreakdownSheet: View {
    let kpi: TeamKPI
    @Environment(\.dismiss) private var dismiss
    @State private var sortDescending = true

    private var sorted: [TeamMember] {
        let sorted = TeamData.members.sorted { a, b in
            let va = memberValue(a), vb = memberValue(b)
            return sortDescending ? va > vb : va < vb
        }
        return sorted
    }

    private func memberValue(_ m: TeamMember) -> Double {
        switch kpi {
        case .totalLeads: return Double(m.leads)
        case .meetings: return Double(m.meetings)
        case .wonValue: return Double(m.valueNok)
        case .avgLeadScore: return Double(m.leads / 3 + 50)
        case .momentum: return Double(m.momentum)
        case .sales: return Double(m.valueNok / 50_000)
        }
    }

    private func format(_ v: Double) -> String {
        switch kpi {
        case .wonValue:
            if v >= 1_000_000 { return String(format: "NOK %.1fM", v / 1_000_000) }
            return "NOK \(Int(v) / 1000)k"
        case .momentum, .avgLeadScore: return "\(Int(v))%"
        default: return "\(Int(v))"
        }
    }

    private var maxValue: Double { max(sorted.map(memberValue).max() ?? 1, 1) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    summaryCard
                    sortToggle
                    breakdownList
                    Color.clear.frame(height: 20)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("\(kpi.rawValue) per medlem")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var summaryCard: some View {
        // Krasj-fiks (uke 2): TeamData.members[0] paniker ved tom liste —
        // treffes når KPI-kort tappes uten team-data. Vis "—" i stedet.
        let members = TeamData.members
        return HStack(spacing: 0) {
            sumStat("Topp", sorted.first.map { format(memberValue($0)) } ?? "—", TBrand.green)
            divider
            sumStat("Snitt", members.isEmpty ? "—" : format(members.map(memberValue).reduce(0, +) / Double(members.count)), kpi.tint)
            divider
            sumStat("Bunn", sorted.last.map { format(memberValue($0)) } ?? "—", TBrand.red)
        }
        .padding(.vertical, 13)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(TBrand.stroke, lineWidth: 1))
    }

    private func sumStat(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 16, weight: .black, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.system(size: 10)).foregroundStyle(TBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
    private var divider: some View { Rectangle().fill(TBrand.stroke).frame(width: 1, height: 28) }

    private var sortToggle: some View {
        HStack {
            Text("Sortering:").font(.system(size: 11, weight: .semibold)).foregroundStyle(TBrand.textSecondary)
            Button {
                withAnimation { sortDescending.toggle() }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: sortDescending ? "arrow.down" : "arrow.up")
                        .font(.system(size: 10, weight: .bold))
                    Text(sortDescending ? "Høyest øverst" : "Lavest øverst")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(TBrand.card, in: Capsule())
                .overlay(Capsule().stroke(TBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }

    private var breakdownList: some View {
        VStack(spacing: 8) {
            ForEach(Array(sorted.enumerated()), id: \.element.id) { idx, m in
                HStack(spacing: 11) {
                    Text("\(idx + 1)")
                        .font(.system(size: 11, weight: .black, design: .rounded))
                        .foregroundStyle(idx == 0 ? TBrand.yellow : (idx <= 2 ? TBrand.purpleLight : TBrand.textTertiary))
                        .monospacedDigit()
                        .frame(width: 20, alignment: .center)
                    ZStack {
                        Circle().fill(m.color.opacity(0.85))
                        Text(m.initials).font(.system(size: 10, weight: .black)).foregroundStyle(.white)
                    }
                    .frame(width: 30, height: 30)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(m.name).font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                            Spacer()
                            Text(format(memberValue(m)))
                                .font(.system(size: 12, weight: .black, design: .rounded))
                                .foregroundStyle(.white)
                                .monospacedDigit()
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(TBrand.cardHi).frame(height: 6)
                                Capsule()
                                    .fill(LinearGradient(colors: [m.color, m.color.opacity(0.5)],
                                                         startPoint: .leading, endPoint: .trailing))
                                    .frame(width: max(8, geo.size.width * memberValue(m) / maxValue), height: 6)
                            }
                        }
                        .frame(height: 6)
                    }
                }
                .padding(10)
                .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
            }
        }
    }
}

// MARK: - ShareKPIReportSheet

struct ShareKPIReportSheet: View {
    let kpi: TeamKPI
    @Environment(\.dismiss) private var dismiss
    @State private var format: Format = .pdf
    @State private var period: String = "Denne måneden"
    @State private var recipients: String = ""
    @State private var note: String = ""
    @State private var includeChart = true
    @State private var includeBreakdown = true
    @State private var scheduleWeekly = false

    enum Format: String, CaseIterable, Hashable {
        case pdf = "PDF", excel = "Excel", link = "Lenke", email = "E-post"
        var icon: String {
            switch self {
            case .pdf: return "doc.fill"
            case .excel: return "tablecells.fill"
            case .link: return "link"
            case .email: return "envelope.fill"
            }
        }
        var color: Color {
            switch self {
            case .pdf: return TBrand.red
            case .excel: return TBrand.green
            case .link: return TBrand.blue
            case .email: return TBrand.purpleLight
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    formatGrid
                    recipientsField
                    contentTogglesCard
                    scheduleCard
                    noteField
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Del rapport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
            }
            .toolbarBackground(TBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { sendBar }
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(TBrand.green.opacity(0.22))
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(TBrand.green)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text("Del \(kpi.rawValue)-rapport")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Innhold: \(kpi.bigValue) \(kpi.trend) for \(period.lowercased())")
                    .font(.system(size: 11))
                    .foregroundStyle(TBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var formatGrid: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Format")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 7) {
                ForEach(Format.allCases, id: \.self) { f in
                    let isSelected = format == f
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { format = f }
                    } label: {
                        HStack(spacing: 9) {
                            ZStack {
                                Circle().fill(f.color.opacity(isSelected ? 0.35 : 0.18))
                                Image(systemName: f.icon)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(f.color)
                            }
                            .frame(width: 30, height: 30)
                            Text(f.rawValue).font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                            Spacer()
                            Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                                .font(.system(size: 14))
                                .foregroundStyle(isSelected ? f.color : TBrand.stroke)
                        }
                        .padding(9)
                        .background(
                            isSelected ? f.color.opacity(0.10) : TBrand.card,
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(isSelected ? f.color.opacity(0.4) : TBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var recipientsField: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Mottakere")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $recipients)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                    .padding(12)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
                    .textInputAutocapitalization(.never)
                if recipients.isEmpty {
                    Text("navn@bedrift.no, eller @teamet")
                        .font(.system(size: 13))
                        .foregroundStyle(TBrand.textTertiary)
                        .padding(.horizontal, 15)
                        .allowsHitTesting(false)
                }
            }
            HStack(spacing: 5) {
                ForEach(["Hele teamet", "Salgssjef", "CEO"], id: \.self) { tag in
                    Button { recipients = (recipients.isEmpty ? tag : "\(recipients), \(tag)") } label: {
                        Text("+ \(tag)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(TBrand.purpleLight)
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(TBrand.purple.opacity(0.15), in: Capsule())
                            .overlay(Capsule().stroke(TBrand.purple.opacity(0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var contentTogglesCard: some View {
        VStack(spacing: 8) {
            Toggle(isOn: $includeChart) {
                HStack(spacing: 7) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.system(size: 11))
                        .foregroundStyle(kpi.tint)
                    Text("Inkluder trend-graf").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                }
            }.tint(TBrand.purple)
            Divider().overlay(TBrand.stroke)
            Toggle(isOn: $includeBreakdown) {
                HStack(spacing: 7) {
                    Image(systemName: "person.3.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(TBrand.blue)
                    Text("Inkluder per-medlem-breakdown").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                }
            }.tint(TBrand.purple)
        }
        .padding(11)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var scheduleCard: some View {
        Toggle(isOn: $scheduleWeekly) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(TBrand.orange.opacity(0.22))
                    Image(systemName: "calendar.badge.clock")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(TBrand.orange)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Send ukentlig automatisk")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Hver mandag kl. 08:00")
                        .font(.system(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                }
            }
        }
        .tint(TBrand.purple)
        .padding(11)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Følgenotat (valgfritt)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $note)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .frame(minHeight: 70)
                    .padding(8)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
                if note.isEmpty {
                    Text("Skriv en intro til rapporten…")
                        .font(.system(size: 12))
                        .foregroundStyle(TBrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var sendBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: format.icon)
                    .font(.system(size: 13, weight: .bold))
                Text(recipients.isEmpty ? "Legg til mottakere først" : "Send \(format.rawValue)-rapport nå")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: recipients.isEmpty ? [TBrand.cardHi, TBrand.cardHi] : [TBrand.green, TBrand.green.opacity(0.7)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(recipients.isEmpty ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .disabled(recipients.isEmpty)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(TBrand.bg.opacity(0.95).overlay(Rectangle().fill(TBrand.stroke).frame(height: 1), alignment: .top))
    }
}
