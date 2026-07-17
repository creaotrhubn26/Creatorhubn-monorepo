// KPIDetailSheet.swift
//
// Drill-down-sheet som åpnes når salgssjefen tapper et KPI-kort. Viser:
//   - Hero-tall + trend + sammenligning forrige periode
//   - Mini-graf siste 30 dager (Swift Charts)
//   - Breakdown per kilde/status/region
//   - Topp 5 relevante leads (klikkbar)
//   - Anbefalte handlinger

import SwiftUI
import Charts

enum KPIKind: Hashable, Identifiable {
    case totalLeads, newLeads, contacted, meetingsBooked, won
    var id: String {
        switch self {
        case .totalLeads:     return "totalLeads"
        case .newLeads:       return "newLeads"
        case .contacted:      return "contacted"
        case .meetingsBooked: return "meetingsBooked"
        case .won:            return "won"
        }
    }

    var title: String {
        switch self {
        case .totalLeads:     return "Totalt leads"
        case .newLeads:       return "Nye leads"
        case .contacted:      return "Kontaktet"
        case .meetingsBooked: return "Møter avtalt"
        case .won:            return "Vunnet"
        }
    }
    var icon: String {
        switch self {
        case .totalLeads:     return "person.3.fill"
        case .newLeads:       return "sparkles"
        case .contacted:      return "phone.fill"
        case .meetingsBooked: return "calendar"
        case .won:            return "trophy.fill"
        }
    }
    var color: Color {
        switch self {
        case .totalLeads:     return Color(red: 0.66, green: 0.32, blue: 0.99)
        case .newLeads:       return Color(red: 0.20, green: 0.85, blue: 0.60)
        case .contacted:      return Color(red: 0.34, green: 0.60, blue: 0.98)
        case .meetingsBooked: return Color(red: 0.75, green: 0.45, blue: 1.0)
        case .won:            return Color(red: 0.98, green: 0.75, blue: 0.14)
        }
    }
    var value: String {
        switch self {
        case .totalLeads:     return "1 248"
        case .newLeads:       return "842"
        case .contacted:      return "542"
        case .meetingsBooked: return "236"
        case .won:            return "68"
        }
    }
    var trend: String {
        switch self {
        case .totalLeads:     return "+18 %"
        case .newLeads:       return "+16 %"
        case .contacted:      return "+11 %"
        case .meetingsBooked: return "+12 %"
        case .won:            return "+24 %"
        }
    }
    var subtitle: String {
        switch self {
        case .totalLeads:     return "Alle aktive leads i pipeline"
        case .newLeads:       return "Leads opprettet denne perioden"
        case .contacted:      return "Leads med minst én logget aktivitet"
        case .meetingsBooked: return "Bookede møter (ikke ferdig avholdt)"
        case .won:            return "Closed-Won leads"
        }
    }

    /// Mockede tidsserier — siste 30 dager
    func timeSeries() -> [Int] {
        let base: Int
        switch self {
        case .totalLeads:     base = 28
        case .newLeads:       base = 18
        case .contacted:      base = 12
        case .meetingsBooked: base = 6
        case .won:            base = 2
        }
        return (0..<30).map { day in
            base + Int(sin(Double(day) * 0.5) * Double(base) * 0.3) + (day / 5)
        }
    }
}

struct KPIDetailSheet: View {
    let kind: KPIKind
    @Environment(\.dismiss) private var dismiss

    private enum KpBrand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
        static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
        static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
        static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
        static let textSecondary = Color.white.opacity(0.62)
        static let textTertiary = Color.white.opacity(0.45)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    heroCard
                    trendChart
                    breakdownCard
                    topLeadsCard
                    // suggestedActions fjernet 2026-07-17: var døde knapper —
                    // hele kortet besto av handlings-CTAer («Filtrér…»,
                    // «Eksporter…», «Ring…») uten flater å utføre dem.
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(KpBrand.bg.ignoresSafeArea())
            .navigationTitle(kind.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(KpBrand.purpleLight)
                }
                // Periode-filtermenyen («I dag»/«Denne uken»/…) fjernet
                // 2026-07-17: var døde knapper — sheeten har ingen
                // periode-parameterisert datakilde å filtrere.
            }
            .toolbarBackground(KpBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .macCatalystSheetSize(minWidth: 820, minHeight: 680)
    }

    // MARK: Hero

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11)
                        .fill(kind.color.opacity(0.22))
                    Image(systemName: kind.icon)
                        .font(.appScaled(size: 22, weight: .semibold))
                        .foregroundStyle(kind.color)
                }
                .frame(width: 56, height: 56)
                VStack(alignment: .leading, spacing: 3) {
                    Text(kind.title)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(KpBrand.textSecondary)
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(kind.value)
                            .font(.appScaled(size: 38, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                        HStack(spacing: 3) {
                            Image(systemName: "arrow.up")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text(kind.trend)
                                .font(.appScaled(size: 12, weight: .bold))
                        }
                        .foregroundStyle(KpBrand.green)
                    }
                    Text(kind.subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(KpBrand.textSecondary)
                }
                Spacer()
            }

            HStack(spacing: 10) {
                heroStat(label: "Forrige periode",  value: previousPeriodValue, color: KpBrand.textSecondary)
                heroStat(label: "Snitt per dag",    value: averagePerDay,       color: KpBrand.blue)
                heroStat(label: "Måls-progresjon",  value: "78 %",              color: KpBrand.yellow)
            }
        }
        .padding(16)
        .background(KpBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(kind.color.opacity(0.3), lineWidth: 1)
        )
    }

    private func heroStat(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.appScaled(size: 10))
                .foregroundStyle(KpBrand.textSecondary)
            Text(value)
                .font(.appScaled(size: 16, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(KpBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    private var previousPeriodValue: String {
        switch kind {
        case .totalLeads:     return "1 058"
        case .newLeads:       return "726"
        case .contacted:      return "488"
        case .meetingsBooked: return "211"
        case .won:            return "55"
        }
    }
    private var averagePerDay: String {
        switch kind {
        case .totalLeads:     return "42"
        case .newLeads:       return "28"
        case .contacted:      return "18"
        case .meetingsBooked: return "8"
        case .won:            return "2.3"
        }
    }

    // MARK: Trend-graf (Swift Charts)

    private var trendChart: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader("Siste 30 dager", icon: "chart.line.uptrend.xyaxis")
            let data = kind.timeSeries()
            Chart {
                ForEach(Array(data.enumerated()), id: \.offset) { idx, value in
                    LineMark(
                        x: .value("Dag", idx),
                        y: .value("Antall", value)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(kind.color)
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                    AreaMark(
                        x: .value("Dag", idx),
                        y: .value("Antall", value)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [kind.color.opacity(0.30), kind.color.opacity(0)],
                        startPoint: .top, endPoint: .bottom
                    ))
                }
            }
            .chartXAxis {
                AxisMarks(values: [0, 7, 14, 21, 29]) { value in
                    AxisGridLine().foregroundStyle(KpBrand.stroke)
                    AxisValueLabel {
                        if let day = value.as(Int.self) {
                            Text("-\(29 - day)d")
                                .font(.appScaled(size: 9))
                                .foregroundStyle(KpBrand.textTertiary)
                        }
                    }
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisGridLine().foregroundStyle(KpBrand.stroke)
                    AxisValueLabel()
                        .foregroundStyle(KpBrand.textTertiary)
                }
            }
            .frame(height: 180)
        }
        .padding(16)
        .background(KpBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(KpBrand.stroke, lineWidth: 1))
    }

    // MARK: Breakdown

    private var breakdownCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(breakdownTitle, icon: "square.grid.2x2.fill")
            VStack(spacing: 6) {
                ForEach(breakdownData, id: \.label) { item in
                    breakdownRow(label: item.label, value: item.value, percent: item.percent, color: item.color)
                }
            }
        }
        .padding(16)
        .background(KpBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(KpBrand.stroke, lineWidth: 1))
    }

    private var breakdownTitle: String {
        switch kind {
        case .totalLeads:     return "Per status"
        case .newLeads:       return "Per kilde"
        case .contacted:      return "Per kanal"
        case .meetingsBooked: return "Per møte-type"
        case .won:            return "Per kategori"
        }
    }

    private struct BreakdownItem { let label: String; let value: Int; let percent: Double; let color: Color }

    private var breakdownData: [BreakdownItem] {
        switch kind {
        case .totalLeads:
            return [
                BreakdownItem(label: "Hot lead",       value: 142, percent: 0.11, color: KpBrand.red),
                BreakdownItem(label: "Varm lead",      value: 268, percent: 0.21, color: KpBrand.yellow),
                BreakdownItem(label: "Interessert",    value: 198, percent: 0.16, color: KpBrand.blue),
                BreakdownItem(label: "Kontaktet",      value: 312, percent: 0.25, color: KpBrand.blue),
                BreakdownItem(label: "Ny lead",        value: 220, percent: 0.18, color: KpBrand.green),
                BreakdownItem(label: "Ikke kontaktet", value: 108, percent: 0.09, color: KpBrand.textSecondary),
            ]
        case .newLeads:
            return [
                BreakdownItem(label: "Manuell oppretting", value: 312, percent: 0.37, color: KpBrand.purpleLight),
                BreakdownItem(label: "URL-research",       value: 218, percent: 0.26, color: KpBrand.green),
                BreakdownItem(label: "Brønnøysund-import", value: 145, percent: 0.17, color: KpBrand.blue),
                BreakdownItem(label: "Partner-tips",       value: 102, percent: 0.12, color: KpBrand.yellow),
                BreakdownItem(label: "Webskjema",          value: 65,  percent: 0.08, color: KpBrand.red),
            ]
        case .contacted:
            return [
                BreakdownItem(label: "Telefon",   value: 248, percent: 0.46, color: KpBrand.green),
                BreakdownItem(label: "E-post",    value: 178, percent: 0.33, color: KpBrand.blue),
                BreakdownItem(label: "LinkedIn",  value: 68,  percent: 0.13, color: KpBrand.purple),
                BreakdownItem(label: "Personlig", value: 48,  percent: 0.09, color: Color(red: 0.98, green: 0.55, blue: 0.10)),
            ]
        case .meetingsBooked:
            return [
                BreakdownItem(label: "Fysisk møte", value: 112, percent: 0.47, color: KpBrand.purple),
                BreakdownItem(label: "Google Meet", value: 74,  percent: 0.31, color: KpBrand.blue),
                BreakdownItem(label: "Telefon",     value: 32,  percent: 0.14, color: KpBrand.green),
                BreakdownItem(label: "FaceTime",    value: 18,  percent: 0.08, color: KpBrand.purpleLight),
            ]
        case .won:
            return [
                BreakdownItem(label: "B2B SaaS",          value: 24, percent: 0.35, color: KpBrand.purple),
                BreakdownItem(label: "Helsetech",         value: 16, percent: 0.24, color: KpBrand.green),
                BreakdownItem(label: "Innholdsprod.",     value: 14, percent: 0.21, color: KpBrand.purpleLight),
                BreakdownItem(label: "Foto/Video",        value: 9,  percent: 0.13, color: KpBrand.blue),
                BreakdownItem(label: "Annet",             value: 5,  percent: 0.07, color: KpBrand.textSecondary),
            ]
        }
    }

    private func breakdownRow(label: String, value: Int, percent: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Circle().fill(color).frame(width: 8, height: 8)
                Text(label)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(value)")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text(String(format: "%.0f %%", percent * 100))
                    .font(.appScaled(size: 11))
                    .foregroundStyle(KpBrand.textSecondary)
                    .frame(width: 38, alignment: .trailing)
                    .monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(KpBrand.stroke)
                    RoundedRectangle(cornerRadius: 3)
                        .fill(color)
                        .frame(width: max(4, geo.size.width * CGFloat(percent)))
                }
            }
            .frame(height: 5)
        }
        .padding(.vertical, 4)
    }

    // MARK: Top leads

    private var topLeadsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Top 5 leads", icon: "list.star")
            VStack(spacing: 8) {
                // 2026-07-17: rad-knappene var døde (ingen lead-detaljflate
                // herfra) — innholdet beholdt som ikke-klikkbar visning,
                // chevron fjernet så raden ikke lover navigasjon.
                ForEach(topLeads, id: \.0) { (name, category, value) in
                    HStack(spacing: 10) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(kind.color.opacity(0.20))
                            Image(systemName: "building.2.fill")
                                .font(.appScaled(size: 13, weight: .semibold))
                                .foregroundStyle(kind.color)
                        }
                        .frame(width: 34, height: 34)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(name)
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            Text(category)
                                .font(.appScaled(size: 10))
                                .foregroundStyle(KpBrand.textSecondary)
                        }
                        Spacer()
                        Text(value)
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(KpBrand.green)
                            .monospacedDigit()
                    }
                    .padding(9)
                    .background(KpBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                }
            }
            // «Se alle»-knappen fjernet 2026-07-17: var død knapp — ingen
            // filtrert leads-liste å navigere til fra sheeten.
        }
        .padding(16)
        .background(KpBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(KpBrand.stroke, lineWidth: 1))
    }

    private var topLeads: [(String, String, String)] {
        switch kind {
        case .totalLeads:
            return [
                ("Nordic Elektro AS",  "Elektroinstallasjon", "350K"),
                ("Energi & Miljø AS",  "Energi",              "220K"),
                ("Byggmester Hansen",  "Bygg & Anlegg",       "180K"),
                ("Oslo Tech AS",       "IT & Programvare",    "150K"),
                ("Kreativ Studio",     "Reklame & Design",    "90K"),
            ]
        case .newLeads:
            return [
                ("Helsenor AS",          "Helsetech",       "I dag"),
                ("Tech Norge",           "B2B SaaS",        "I dag"),
                ("Bygg & Co",            "Bygg & Anlegg",   "i går"),
                ("Eiendomsdrift AS",     "Eiendom",         "i går"),
                ("Møbelringen",          "Detaljhandel",    "2 dager"),
            ]
        case .contacted:
            return [
                ("Nordic Elektro AS",  "Telefon",        "i dag"),
                ("Byggmester Hansen",  "E-post",         "i dag"),
                ("Energi & Miljø AS",  "Telefon",        "i går"),
                ("Oslo Tech AS",       "LinkedIn",       "21. mai"),
                ("Transport Partner",  "Personlig møte", "20. mai"),
            ]
        case .meetingsBooked:
            return [
                ("Nordic Elektro AS",  "I dag, 10:00",  "Fysisk"),
                ("Byggmester Hansen",  "I morgen, 11:30", "Fysisk"),
                ("Energi & Miljø AS",  "21. mai, 14:00",  "Google Meet"),
                ("Oslo Tech AS",       "23. mai, 09:00",  "Google Meet"),
                ("Kreativ Studio",     "24. mai, 10:30",  "Fysisk"),
            ]
        case .won:
            return [
                ("Equinor AS",         "B2B SaaS",            "380K"),
                ("DNB Bank",           "Innholdsproduksjon",  "320K"),
                ("Aker Solutions",     "Konsulent",           "290K"),
                ("Schibsted Media",    "B2B SaaS",            "260K"),
                ("Telenor Norge",      "B2B SaaS",            "240K"),
            ]
        }
    }

    // «Foreslåtte handlinger»-kortet fjernet 2026-07-17: var døde knapper —
    // alle radene var CTAer uten mål-flate (filtrering/eksport/kampanje
    // finnes ikke fra denne sheeten).

    // MARK: Helper

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 7) {
            Image(systemName: icon)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(KpBrand.purpleLight)
            Text(title)
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Spacer()
        }
    }
}

