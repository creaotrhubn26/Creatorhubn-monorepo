// SellerPerformanceModal.swift
//
// Full breakdown for et team-medlem — åpnes når man tap'er på polygon i Teamets områder.

import SwiftUI
import Charts

struct SellerPerformanceModal: View {
    let member: TeamMember
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var period: Period = .month
    @State private var showAssign: Bool = false
    @State private var showSetGoal: Bool = false
    @State private var showReport: Bool = false
    @State private var showCompare: Bool = false
    @State private var contactNotice: ContactNotice?

    /// Ekte medlemmer bærer e-post i SalesTeamMemberDTO (oppslag på navn);
    /// demo-medlemmer har ingen kontaktinfo. TeamMember har aldri telefon.
    @MainActor private var memberEmail: String? {
        let email = TeamLiveStore.shared.memberDTOs.first { $0.name == member.name }?.email
        return (email?.isEmpty == false) ? email : nil
    }

    /// Liten info-sheet når kanalen mangler data (samme ærlige mønster som
    /// «Send melding»-plassholderen i TeamCards).
    struct ContactNotice: Identifiable {
        let id = UUID()
        let title: String
        let icon: String
        let body: String
    }

    enum Period: String, CaseIterable, Hashable {
        case week = "Uke"
        case month = "Måned"
        case quarter = "Kvartal"
        case year = "År"
    }

    // Mock deals for medlemmet
    private struct DealRow: Identifiable, Hashable {
        let id = UUID()
        let company: String
        let valueNok: Int
        let stage: String
        let stageColor: Color
        let probability: Int
    }

    private var deals: [DealRow] {
        switch member.name {
        case "Kari Nordmann":
            return [
                DealRow(company: "Sandvika Auto AS",      valueNok: 240_000, stage: "Vunnet",      stageColor: TBrand.green,  probability: 100),
                DealRow(company: "Bærum Eiendom",          valueNok: 380_000, stage: "Forhandling", stageColor: TBrand.orange, probability: 75),
                DealRow(company: "Vestre Aker Bygg",       valueNok: 150_000, stage: "Demo",         stageColor: TBrand.purple, probability: 50),
            ]
        case "Ola Magnussen":
            return [
                DealRow(company: "Aker Logistics AS",      valueNok: 180_000, stage: "Vunnet",      stageColor: TBrand.green,  probability: 100),
                DealRow(company: "Sentrum Bygg AS",        valueNok: 95_000,  stage: "Tilbud",       stageColor: TBrand.yellow, probability: 60),
                DealRow(company: "Oslo Tech AS",           valueNok: 220_000, stage: "Demo",         stageColor: TBrand.purple, probability: 50),
            ]
        case "Martine Jensen":
            return [
                DealRow(company: "Romerike Elektro AS",    valueNok: 320_000, stage: "Demo",         stageColor: TBrand.purple, probability: 65),
                DealRow(company: "Energiteknikk AS",       valueNok: 55_000,  stage: "Tilbud",       stageColor: TBrand.yellow, probability: 60),
            ]
        case "Henrik Solberg":
            return [
                DealRow(company: "Asker IT-løsninger",     valueNok: 80_000,  stage: "Discovery",   stageColor: TBrand.blue,   probability: 25),
                DealRow(company: "Bærum Service AS",       valueNok: 65_000,  stage: "Tapt",         stageColor: TBrand.red,    probability: 0),
            ]
        case "Sofie Dahl":
            return [
                DealRow(company: "Sarpsborg Industri",     valueNok: 120_000, stage: "Discovery",   stageColor: TBrand.blue,   probability: 30),
                DealRow(company: "LogiPartner AS",         valueNok: 45_000,  stage: "Discovery",   stageColor: TBrand.blue,   probability: 20),
            ]
        default: return []
        }
    }

    // 7-dagers trend (mock)
    private var trendData: [(day: String, value: Int)] {
        let base = max(20, member.leads / 12)
        return ["Ma","Ti","On","To","Fr","Lø","Sø"].enumerated().map { (i, d) in
            let noise = [1.2, 0.9, 1.1, 1.3, 0.7, 0.5, 0.8][i % 7]
            return (d, Int(Double(base) * noise))
        }
    }

    private var totalPipelineValue: Int {
        deals.reduce(0) { $0 + $1.valueNok }
    }

    // Periode-velgeren skal faktisk endre volum-tallene. Basis-tallene på
    // TeamMember representerer en måned; øvrige perioder skaleres monotont
    // (uke < måned < kvartal < år). Momentum er en «nå»-måler og skaleres ikke.
    private var periodScale: Double {
        switch period {
        case .week:    return 0.25
        case .month:   return 1.0
        case .quarter: return 3.0
        case .year:    return 12.0
        }
    }
    private var scaledLeads: Int    { Int((Double(member.leads) * periodScale).rounded()) }
    private var scaledMeetings: Int { Int((Double(member.meetings) * periodScale).rounded()) }
    private var scaledValue: Int    { Int((Double(member.valueNok) * periodScale).rounded()) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    hero
                    periodPicker
                    statsGrid
                    trendCard
                    dealsCard
                    actionsRow
                    Color.clear.frame(height: 24)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle(member.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(TBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button { showReport = true } label: { Label("Eksporter rapport", systemImage: "doc.fill") }
                        Button { sendToSeller() } label: { Label("Send til selger", systemImage: "envelope.fill") }
                        Button { showCompare = true } label: { Label("Sammenlign m/ team", systemImage: "chart.bar.xaxis") }
                        // «Endre territorium» fjernet 2026-07-17: var død knapp — territorium
                        // endres via Team-fanens Tildel område-flyt.
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
        VStack(spacing: 13) {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(member.color)
                    Text(member.initials)
                        .font(.appScaled(size: 22, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(width: 64, height: 64)
                .shadow(color: member.color.opacity(0.5), radius: 10)
                VStack(alignment: .leading, spacing: 4) {
                    Text(member.name)
                        .font(.appScaled(size: 19, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 5) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.appScaled(size: 10))
                        Text(member.area)
                            .font(.appScaled(size: 12))
                    }
                    .foregroundStyle(TBrand.textSecondary)
                    HStack(spacing: 5) {
                        Circle().fill(member.momentumColor)
                            .frame(width: 7, height: 7)
                            .shadow(color: member.momentumColor.opacity(0.5), radius: 3)
                        Text("Momentum \(member.momentum)%")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(member.momentumColor)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text("RANK")
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(TBrand.textTertiary)
                        .tracking(0.6)
                    Text("#\(rank())")
                        .font(.appScaled(size: 22, weight: .black, design: .rounded))
                        .foregroundStyle(rank() <= 2 ? TBrand.green : (rank() <= 3 ? TBrand.yellow : TBrand.orange))
                        .monospacedDigit()
                    Text("av \(TeamData.members.count)")
                        .font(.appScaled(size: 9))
                        .foregroundStyle(TBrand.textSecondary)
                        .monospacedDigit()
                }
            }
        }
        .padding(16)
        .background(
            LinearGradient(colors: [member.color.opacity(0.20), member.color.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 16)
        )
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(member.color.opacity(0.35), lineWidth: 1))
    }

    private func rank() -> Int {
        let sorted = TeamData.members.sorted { $0.valueNok > $1.valueNok }
        return (sorted.firstIndex(of: member) ?? 0) + 1
    }

    // MARK: Period picker

    private var periodPicker: some View {
        HStack(spacing: 5) {
            ForEach(Period.allCases, id: \.self) { p in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { period = p }
                } label: {
                    Text(p.rawValue)
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(period == p ? .white : TBrand.textSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(
                            period == p ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(Color.clear),
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

    // MARK: Stats grid

    private var statsGrid: some View {
        // iPhone: 2×2 i stedet for 4 kolonner — «Vunnet verdi»-tallene
        // trenger bredde på compact width.
        LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 2, iPad: 4, mac: 4, spacing: 12), spacing: 12) {
            statTile(title: "Leads",        value: "\(scaledLeads)",                    trend: member.leadsTrend,    color: TBrand.purple,      icon: "person.3.fill")
            statTile(title: "Møter",        value: "\(scaledMeetings)",                 trend: member.meetingsTrend, color: TBrand.blue,        icon: "calendar")
            statTile(title: "Vunnet verdi", value: "NOK \(formatNok(scaledValue))",      trend: member.valueTrend,    color: TBrand.green,       icon: "trophy.fill")
            statTile(title: "Momentum",     value: "\(member.momentum)%",                trend: nil,                  color: member.momentumColor, icon: "flame.fill")
        }
    }

    private func statTile(title: String, value: String, trend: Int?, color: Color, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(color)
                }
                .frame(width: 28, height: 28)
                Spacer()
                if let t = trend {
                    HStack(spacing: 2) {
                        Image(systemName: t >= 0 ? "arrow.up" : "arrow.down")
                            .font(.appScaled(size: 8, weight: .black))
                        Text("\(abs(t))%")
                            .font(.appScaled(size: 10, weight: .bold))
                            .monospacedDigit()
                    }
                    .foregroundStyle(t >= 0 ? TBrand.green : TBrand.red)
                }
            }
            Text(value)
                .font(.appScaled(size: 18, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.appScaled(size: 10))
                .foregroundStyle(TBrand.textSecondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
    }

    // MARK: Trend chart

    private var trendCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Aktivitet siste 7 dager")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(trendData.reduce(0) { $0 + $1.value }) leads totalt")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(member.color)
            }
            Chart {
                ForEach(trendData.indices, id: \.self) { i in
                    let d = trendData[i]
                    BarMark(
                        x: .value("Dag", d.day),
                        y: .value("Leads", d.value)
                    )
                    .foregroundStyle(
                        LinearGradient(colors: [member.color, member.color.opacity(0.4)],
                                       startPoint: .top, endPoint: .bottom)
                    )
                    .cornerRadius(4)
                }
            }
            .chartXAxis {
                AxisMarks { _ in
                    AxisValueLabel().foregroundStyle(TBrand.textSecondary)
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisGridLine().foregroundStyle(TBrand.stroke)
                    AxisValueLabel().foregroundStyle(TBrand.textTertiary)
                }
            }
            .frame(height: 130)
        }
        .padding(14)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
    }

    // MARK: Deals

    private var dealsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Aktive deals")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(deals.count)")
                    .font(.appScaled(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(TBrand.textSecondary)
                    .monospacedDigit()
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(TBrand.cardHi, in: Capsule())
                Spacer()
                Text("NOK \(formatNok(totalPipelineValue))")
                    .font(.appScaled(size: 13, weight: .black, design: .rounded))
                    .foregroundStyle(TBrand.green)
                    .monospacedDigit()
            }
            VStack(spacing: 7) {
                ForEach(deals) { d in
                    dealRow(d)
                }
                if deals.isEmpty {
                    Text("Ingen aktive deals i perioden")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(TBrand.textTertiary)
                        .padding(.vertical, 14)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(14)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
    }

    private func dealRow(_ d: DealRow) -> some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(d.stageColor.opacity(0.22))
                Image(systemName: stageIcon(d.stage))
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(d.stageColor)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text(d.company)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                HStack(spacing: 5) {
                    Text(d.stage)
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(d.stageColor)
                        .padding(.horizontal, 6).padding(.vertical, 1)
                        .background(d.stageColor.opacity(0.18), in: Capsule())
                    Text("\(d.probability)% sannsynlighet")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                }
            }
            Spacer()
            Text("NOK \(formatNok(d.valueNok))")
                .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
        }
        .padding(10)
        .background(TBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 11))
    }

    private func stageIcon(_ stage: String) -> String {
        switch stage.lowercased() {
        case "vunnet":      return "trophy.fill"
        case "tapt":        return "xmark.octagon.fill"
        case "forhandling": return "doc.text.fill"
        case "tilbud":      return "envelope.fill"
        case "demo":        return "play.rectangle.fill"
        case "discovery":   return "magnifyingglass"
        default:            return "circle.fill"
        }
    }

    // MARK: Actions

    private var actionsRow: some View {
        HStack(spacing: 8) {
            actionBtn(icon: "envelope.fill",            label: "Send melding", color: TBrand.blue) {
                sendMessage()
            }
            actionBtn(icon: "phone.fill",                label: "Ring",         color: TBrand.green) {
                call()
            }
            actionBtn(icon: "target",                    label: "Sett mål",     color: TBrand.purpleLight) {
                showSetGoal = true
            }
            actionBtn(icon: "mappin.and.ellipse",        label: "Område",       color: TBrand.orange) {
                showAssign = true
            }
        }
        .sheet(isPresented: $showAssign) {
            AssignAreaSheet(preselectedMember: member)
        }
        .sheet(isPresented: $showSetGoal) {
            SetKPIGoalSheet(kpi: .wonValue)
        }
        .sheet(isPresented: $showReport) {
            reportSheet
        }
        .sheet(isPresented: $showCompare) {
            compareSheet
        }
        .sheet(item: $contactNotice) { notice in
            contactNoticeSheet(notice)
        }
    }

    // MARK: ⋯-meny-handlinger (var stubs)

    /// Formatert prestasjonsrapport — brukes både av «Eksporter rapport»
    /// (ShareLink) og «Send til selger» (e-post/SMS-innhold).
    private var reportSummary: String {
        var lines = [
            "Prestasjonsrapport — \(member.name)",
            "Område: \(member.area)",
            "Periode: \(period.rawValue)",
            "",
            "Leads: \(scaledLeads)",
            "Møter: \(scaledMeetings)",
            "Vunnet verdi: NOK \(formatNok(scaledValue))",
            "Momentum: \(member.momentum)%",
            "Rank: #\(rank()) av \(TeamData.members.count)",
            "",
            "Aktive deals (\(deals.count)) — NOK \(formatNok(totalPipelineValue)):",
        ]
        if deals.isEmpty {
            lines.append("• Ingen aktive deals")
        } else {
            lines.append(contentsOf: deals.map {
                "• \($0.company): NOK \(formatNok($0.valueNok)) (\($0.stage), \($0.probability)%)"
            })
        }
        return lines.joined(separator: "\n")
    }

    /// Send rapporten til selgeren: e-post når adresse finnes, ellers SMS.
    private func sendToSeller() {
        let subject = "Din prestasjonsrapport (\(period.rawValue))"
        let body = reportSummary
        let enc = { (s: String) in s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "" }
        if let email = memberEmail,
           let url = URL(string: "mailto:\(email)?subject=\(enc(subject))&body=\(enc(body))") {
            openURL(url)
        } else if let url = URL(string: "sms:&body=\(enc(body))") {
            openURL(url)
        }
    }

    private var reportSheet: some View {
        NavigationStack {
            ScrollView {
                Text(reportSummary)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
                    .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Rapport — \(member.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { showReport = false }.foregroundStyle(TBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    ShareLink(item: reportSummary) {
                        Label("Del", systemImage: "square.and.arrow.up")
                    }
                    .foregroundStyle(TBrand.purpleLight)
                }
            }
        }
    }

    // Team-snitt for sammenligning (samme datakilde som resten av fanen).
    @MainActor private var teamMembers: [TeamMember] { TeamData.members }
    @MainActor private func teamAverage(_ keyPath: KeyPath<TeamMember, Int>) -> Int {
        let vals = teamMembers.map { $0[keyPath: keyPath] }
        guard !vals.isEmpty else { return 0 }
        return vals.reduce(0, +) / vals.count
    }

    private var compareSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    Text("\(member.name) mot team-snittet")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    compareRow(label: "Leads",        mine: member.leads,    avg: teamAverage(\.leads))
                    compareRow(label: "Møter",        mine: member.meetings, avg: teamAverage(\.meetings))
                    compareRow(label: "Vunnet verdi", mine: member.valueNok, avg: teamAverage(\.valueNok), isMoney: true)
                    compareRow(label: "Momentum",     mine: member.momentum, avg: teamAverage(\.momentum), suffix: "%")
                    HStack {
                        Text("Plassering")
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(TBrand.textSecondary)
                        Spacer()
                        Text("#\(rank()) av \(teamMembers.count)")
                            .font(.appScaled(size: 14, weight: .black, design: .rounded))
                            .foregroundStyle(rank() <= 2 ? TBrand.green : (rank() <= 3 ? TBrand.yellow : TBrand.orange))
                    }
                    .padding(14)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))

                    // Team mot team — aggregert per distriktsteam, rangert.
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Team mot team")
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        ForEach(Array(teamStandings.enumerated()), id: \.element.id) { idx, t in
                            teamStandRow(place: idx + 1, t: t)
                        }
                    }
                    .padding(14)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))

                    // Hele teamet mot hverandre (leaderboard) — så man kan
                    // sammenligne alle selgerne, ikke bare mot ett snitt.
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Selger mot selger")
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        ForEach(Array(rankedTeam.enumerated()), id: \.element.id) { idx, m in
                            rosterRow(place: idx + 1, m: m)
                        }
                    }
                    .padding(14)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Sammenlign m/ team")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lukk") { showCompare = false }.foregroundStyle(TBrand.purpleLight)
                }
            }
        }
    }

    @MainActor private var rankedTeam: [TeamMember] {
        teamMembers.sorted { $0.valueNok > $1.valueNok }
    }

    // MARK: Team-mot-team-aggregering

    /// Teamet et medlem tilhører.
    /// - Ekte modus: TeamLiveStore har allerede satt `area` = team-navnet
    ///   (fra LeadgridSalesTeamStore.team(for: userId) — ekte
    ///   leadgrid_sales_teams), så vi grupperer direkte på det.
    /// - Demo: ingen ekte team-kobling → grupper på distrikt.
    private func teamName(for m: TeamMember) -> String {
        if DemoModeManager.isActiveNonisolated {
            switch m.area {
            case "Oslo Vest", "Oslo Sentrum":  return "Team Oslo"
            case "Lørenskog", "Sarpsborg":     return "Team Øst"
            case "Asker / Bærum":              return "Team Vest"
            default:                            return "Øvrige"
            }
        }
        return m.area   // ekte team-navn (eller «Ikke tildelt område»)
    }

    struct TeamAgg: Identifiable {
        let id = UUID()
        let name: String
        let leads: Int
        let valueNok: Int
        let momentum: Int   // snitt
        let count: Int
        let containsMe: Bool
        let color: Color
    }

    @MainActor private var teamStandings: [TeamAgg] {
        let groups = Dictionary(grouping: teamMembers) { teamName(for: $0) }
        return groups.map { (name, members) -> TeamAgg in
            let leads = members.reduce(0) { $0 + $1.leads }
            let value = members.reduce(0) { $0 + $1.valueNok }
            let mom = members.isEmpty ? 0 : members.reduce(0) { $0 + $1.momentum } / members.count
            return TeamAgg(
                name: name,
                leads: leads,
                valueNok: value,
                momentum: mom,
                count: members.count,
                containsMe: members.contains { $0.id == member.id },
                color: members.first?.color ?? TBrand.purple
            )
        }
        .sorted { $0.valueNok > $1.valueNok }
    }

    private func teamStandRow(place: Int, t: TeamAgg) -> some View {
        HStack(spacing: 10) {
            Text("#\(place)")
                .font(.appScaled(size: 12, weight: .black, design: .rounded))
                .foregroundStyle(place == 1 ? TBrand.green : (place == 2 ? TBrand.yellow : TBrand.textSecondary))
                .frame(width: 28, alignment: .leading)
            VStack(alignment: .leading, spacing: 1) {
                Text(t.name)
                    .font(.appScaled(size: 12, weight: t.containsMe ? .bold : .semibold))
                    .foregroundStyle(t.containsMe ? .white : TBrand.textSecondary)
                    .lineLimit(1)
                Text("\(t.count) selgere · \(t.leads) leads · \(t.momentum)% mom.")
                    .font(.appScaled(size: 9))
                    .foregroundStyle(TBrand.textTertiary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Text("NOK \(formatNok(t.valueNok))")
                .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(t.containsMe ? .white : TBrand.textSecondary)
                .monospacedDigit()
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(
            t.containsMe ? AnyShapeStyle(t.color.opacity(0.16)) : AnyShapeStyle(Color.clear),
            in: RoundedRectangle(cornerRadius: 9)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 9)
                .stroke(t.containsMe ? t.color.opacity(0.5) : Color.clear, lineWidth: 1)
        )
    }

    private func rosterRow(place: Int, m: TeamMember) -> some View {
        let isMe = m.id == member.id
        return HStack(spacing: 10) {
            Text("#\(place)")
                .font(.appScaled(size: 12, weight: .black, design: .rounded))
                .foregroundStyle(place <= 2 ? TBrand.green : (place <= 3 ? TBrand.yellow : TBrand.textSecondary))
                .frame(width: 28, alignment: .leading)
            ZStack {
                Circle().fill(m.color.opacity(isMe ? 1 : 0.4))
                Text(m.initials)
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 1) {
                Text(m.name)
                    .font(.appScaled(size: 12, weight: isMe ? .bold : .semibold))
                    .foregroundStyle(isMe ? .white : TBrand.textSecondary)
                    .lineLimit(1)
                Text("\(m.leads) leads · \(m.momentum)% mom.")
                    .font(.appScaled(size: 9))
                    .foregroundStyle(TBrand.textTertiary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Text("NOK \(formatNok(m.valueNok))")
                .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(isMe ? .white : TBrand.textSecondary)
                .monospacedDigit()
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(
            isMe ? AnyShapeStyle(member.color.opacity(0.16)) : AnyShapeStyle(Color.clear),
            in: RoundedRectangle(cornerRadius: 9)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 9)
                .stroke(isMe ? member.color.opacity(0.5) : Color.clear, lineWidth: 1)
        )
    }

    private func compareRow(label: String, mine: Int, avg: Int, isMoney: Bool = false, suffix: String = "") -> some View {
        let delta = mine - avg
        let fmt: (Int) -> String = { isMoney ? "NOK \(self.formatNok($0))" : "\($0)\(suffix)" }
        return HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Snitt: \(fmt(avg))")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(TBrand.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(fmt(mine))
                    .font(.appScaled(size: 14, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                HStack(spacing: 3) {
                    Image(systemName: delta >= 0 ? "arrow.up" : "arrow.down")
                        .font(.appScaled(size: 8, weight: .black))
                    Text(fmt(abs(delta)))
                        .font(.appScaled(size: 10, weight: .bold))
                }
                .foregroundStyle(delta >= 0 ? TBrand.green : TBrand.red)
            }
        }
        .padding(14)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    /// Send melding: e-post når medlemmet har adresse (ekte team), ellers
    /// åpne SMS/Meldinger (blank mottaker når vi ikke har telefonnummer).
    private func sendMessage() {
        if let email = memberEmail,
           let url = URL(string: "mailto:\(email)") {
            openURL(url)
        } else if let url = URL(string: "sms:") {
            openURL(url)
        }
    }

    /// Ring: TeamMember bærer ikke telefonnummer (verken demo eller
    /// SalesTeamMemberDTO), så vi er ærlige i stedet for å ha en død knapp.
    private func call() {
        contactNotice = ContactNotice(
            title: "Ring \(member.name)",
            icon: "phone.badge.plus",
            body: "Telefonnummer er ikke registrert på teammedlemmet ennå. Legg det til i medlemsprofilen for å ringe herfra."
        )
    }

    private func contactNoticeSheet(_ notice: ContactNotice) -> some View {
        NavigationStack {
            ZStack {
                TBrand.bg.ignoresSafeArea()
                VStack(spacing: 14) {
                    Image(systemName: notice.icon)
                        .font(.appScaled(size: 42, weight: .semibold))
                        .foregroundStyle(TBrand.purpleLight)
                        .padding(.top, 60)
                    Text(notice.title)
                        .font(.appScaled(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                    Text(notice.body)
                        .font(.appScaled(size: 12))
                        .foregroundStyle(TBrand.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                    Spacer()
                }
            }
            .navigationTitle(notice.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lukk") { contactNotice = nil }.foregroundStyle(TBrand.purpleLight)
                }
            }
        }
    }

    private func actionBtn(icon: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(color)
                Text(label)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(color.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func formatNok(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n)/1_000_000) }
        if n >= 1_000     { return "\(n/1000)k" }
        return "\(n)"
    }
}
