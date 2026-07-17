// SellerPerformanceModal.swift
//
// Full breakdown for et team-medlem — åpnes når man tap'er på polygon i Teamets områder.

import SwiftUI
import Charts

struct SellerPerformanceModal: View {
    let member: TeamMember
    @Environment(\.dismiss) private var dismiss
    @State private var period: Period = .month
    @State private var showAssign: Bool = false

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
                        Button { TeamStubActions.toast("Eksporter rapport") } label: { Label("Eksporter rapport", systemImage: "doc.fill") }
                        Button { TeamStubActions.toast("Send til selger") } label: { Label("Send til selger", systemImage: "envelope.fill") }
                        Button { TeamStubActions.performGated(.teamCompareToPrevious, actionName: "Sammenlign m/ team") } label: { Label("Sammenlign m/ team", systemImage: "chart.bar.xaxis") }
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
            statTile(title: "Leads",        value: "\(member.leads)",                    trend: member.leadsTrend,    color: TBrand.purple,      icon: "person.3.fill")
            statTile(title: "Møter",        value: "\(member.meetings)",                 trend: member.meetingsTrend, color: TBrand.blue,        icon: "calendar")
            statTile(title: "Vunnet verdi", value: "NOK \(formatNok(member.valueNok))",  trend: member.valueTrend,    color: TBrand.green,       icon: "trophy.fill")
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
            actionBtn(icon: "envelope.fill",            label: "Send melding", color: TBrand.blue) {}
            actionBtn(icon: "phone.fill",                label: "Ring",         color: TBrand.green) {}
            actionBtn(icon: "target",                    label: "Sett mål",     color: TBrand.purpleLight) {}
            actionBtn(icon: "mappin.and.ellipse",        label: "Område",       color: TBrand.orange) {
                showAssign = true
            }
        }
        .sheet(isPresented: $showAssign) {
            AssignAreaSheet(preselectedMember: member)
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
