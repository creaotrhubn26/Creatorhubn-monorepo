// CreateCustomKPISheet.swift
//
// Modal for å bygge brukerdefinerte KPIer. Demonstrerer prod-arkitektur:
// admin definerer KPI som datadrevet objekt (navn + ikon + farge + datakilde +
// formel + format + sammenligning), lagres i DB, vises i samme KPI-rad som built-ins.

import SwiftUI

struct CreateCustomKPISheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var pickedIcon: String = "cart.fill"
    @State private var pickedColor: KPIColor = .orange
    @State private var dataSource: DataSource = .deals
    @State private var formula: String = "COUNT(deals) WHERE stage = 'won'"
    @State private var format: FormatType = .count
    @State private var comparison: Comparison = .previousPeriod
    @State private var period: Period = .monthly
    @State private var showOnDashboard: Bool = true

    enum DataSource: String, CaseIterable, Hashable {
        case deals = "Deals / salg"
        case leads = "Leads"
        case meetings = "Møter"
        case activities = "Aktivitet"
        case stripe = "Stripe / fakturering"
        case custom = "Egen formel / SQL"
        var icon: String {
            switch self {
            case .deals: return "cart.fill"
            case .leads: return "person.3.fill"
            case .meetings: return "calendar"
            case .activities: return "bolt.fill"
            case .stripe: return "creditcard.fill"
            case .custom: return "function"
            }
        }
        var hintFormula: String {
            switch self {
            case .deals: return "COUNT(deals) WHERE stage = 'won'"
            case .leads: return "COUNT(leads) WHERE created_at > NOW() - 7d"
            case .meetings: return "COUNT(meetings) WHERE status = 'completed'"
            case .activities: return "COUNT(activities) WHERE type = 'call'"
            case .stripe: return "SUM(invoices.amount) WHERE status = 'paid'"
            case .custom: return "SELECT ... FROM ..."
            }
        }
    }

    enum FormatType: String, CaseIterable, Hashable {
        case count = "Antall"
        case nok = "NOK"
        case percent = "%"
        case time = "Tid (timer)"
        var example: String {
            switch self {
            case .count: return "47"
            case .nok: return "NOK 350 000"
            case .percent: return "68 %"
            case .time: return "4,2 t"
            }
        }
    }

    enum Comparison: String, CaseIterable, Hashable {
        case previousPeriod = "vs. forrige periode"
        case target = "vs. mål"
        case teamAverage = "vs. team-snitt"
        case none = "ingen"
    }

    enum Period: String, CaseIterable, Hashable {
        case daily = "Daglig", weekly = "Ukentlig", monthly = "Månedlig", quarterly = "Kvartal"
    }

    enum KPIColor: String, CaseIterable, Hashable {
        case purple, blue, green, yellow, orange, pink, red
        var color: Color {
            switch self {
            case .purple: return TBrand.purpleLight
            case .blue: return TBrand.blue
            case .green: return TBrand.green
            case .yellow: return TBrand.yellow
            case .orange: return TBrand.orange
            case .pink: return TBrand.pink
            case .red: return TBrand.red
            }
        }
    }

    private let iconOptions: [String] = [
        "cart.fill", "creditcard.fill", "trophy.fill", "flame.fill",
        "chart.line.uptrend.xyaxis", "chart.bar.fill", "target", "bolt.fill",
        "person.3.fill", "calendar", "phone.fill", "envelope.fill",
        "checkmark.seal.fill", "sparkles", "star.fill", "heart.fill",
        "norwegiankronesign.circle.fill", "rosette", "leaf.fill", "globe.europe.africa.fill"
    ]

    private var canSave: Bool { !name.isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    livePreview
                    nameField
                    iconPicker
                    colorPicker
                    dataSourceCard
                    formulaCard
                    formatPickerCard
                    comparisonPickerCard
                    periodPickerCard
                    displayCard
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Ny KPI")
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

    // MARK: Live preview

    private var livePreview: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("FORHÅNDSVISNING")
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(TBrand.textTertiary)
                .tracking(0.6)
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(LinearGradient(
                        colors: [pickedColor.color, pickedColor.color.opacity(0.55)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    Image(systemName: pickedIcon)
                        .font(.system(size: 14, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 1) {
                    Text(name.isEmpty ? "KPI-navn vises her" : name)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(name.isEmpty ? TBrand.textTertiary : TBrand.textSecondary)
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Text(format.example)
                            .font(.system(size: 22, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                        if comparison != .none {
                            Text("↑ 12 %")
                                .font(.system(size: 11, weight: .black))
                                .foregroundStyle(TBrand.green)
                        }
                    }
                    Text(comparison.rawValue)
                        .font(.system(size: 9))
                        .foregroundStyle(TBrand.textTertiary)
                }
                Spacer()
            }
            .padding(14)
            .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(pickedColor.color.opacity(0.35), lineWidth: 1))
        }
    }

    // MARK: Name

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Navn på KPI")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $name)
                    .foregroundStyle(.white)
                    .font(.system(size: 14, weight: .semibold))
                    .padding(12)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
                if name.isEmpty {
                    Text("F.eks. Antall salg, Snitt deal-størrelse, Konvertering-rate")
                        .font(.system(size: 13))
                        .foregroundStyle(TBrand.textTertiary)
                        .padding(.horizontal, 15)
                        .allowsHitTesting(false)
                        .lineLimit(1)
                }
            }
        }
    }

    // MARK: Icon

    private var iconPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ikon")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(iconOptions, id: \.self) { ic in
                        let isSelected = pickedIcon == ic
                        Button {
                            withAnimation(.easeInOut(duration: 0.12)) { pickedIcon = ic }
                        } label: {
                            ZStack {
                                Circle().fill(isSelected ? pickedColor.color : TBrand.cardHi)
                                Image(systemName: ic)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(isSelected ? .white : .white.opacity(0.7))
                            }
                            .frame(width: 38, height: 38)
                            .overlay(
                                Circle().stroke(isSelected ? Color.white.opacity(0.85) : TBrand.stroke, lineWidth: isSelected ? 1.5 : 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: Color

    private var colorPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Farge")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            HStack(spacing: 8) {
                ForEach(KPIColor.allCases, id: \.self) { c in
                    let isSelected = pickedColor == c
                    Button {
                        withAnimation(.easeInOut(duration: 0.12)) { pickedColor = c }
                    } label: {
                        ZStack {
                            Circle().fill(c.color)
                            if isSelected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .black))
                                    .foregroundStyle(.white)
                            }
                        }
                        .frame(width: 32, height: 32)
                        .overlay(Circle().stroke(.white.opacity(isSelected ? 0.85 : 0), lineWidth: 1.5))
                        .scaleEffect(isSelected ? 1.1 : 1)
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
        }
    }

    // MARK: Data source

    private var dataSourceCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Datakilde")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            // iPhone: 1 kolonne — lange kilde-navn («Stripe / fakturering»)
            // trunkeres på halv sheet-bredde.
            LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 1, iPad: 2, mac: 2, spacing: 7), spacing: 7) {
                ForEach(DataSource.allCases, id: \.self) { src in
                    let isSelected = dataSource == src
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            dataSource = src
                            formula = src.hintFormula
                        }
                    } label: {
                        HStack(spacing: 9) {
                            Image(systemName: src.icon)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(isSelected ? .white : pickedColor.color)
                            Text(src.rawValue)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Spacer()
                            if isSelected {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 13))
                                    .foregroundStyle(.white)
                            }
                        }
                        .padding(.horizontal, 10).padding(.vertical, 10)
                        .background(
                            isSelected ? AnyShapeStyle(pickedColor.color) : AnyShapeStyle(TBrand.card),
                            in: RoundedRectangle(cornerRadius: 11)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(isSelected ? Color.clear : TBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Formula

    private var formulaCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 6) {
                Image(systemName: "function")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(pickedColor.color)
                Text("Formel")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(TBrand.textSecondary)
                Spacer()
                Button { TeamStubActions.toast("AI-foreslå formel") } label: {
                    Text("AI-foreslå")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(TBrand.purpleLight)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(TBrand.purple.opacity(0.18), in: Capsule())
                }
                .buttonStyle(.plain)
            }
            TextField("", text: $formula)
                .foregroundStyle(.white)
                .font(.system(size: 12, design: .monospaced))
                .padding(10)
                .background(TBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(TBrand.stroke, lineWidth: 1))
            Text("Tomt = bruk standard COUNT for datakilden. Avanserte: bruk SQL-syntax.")
                .font(.system(size: 9))
                .foregroundStyle(TBrand.textTertiary)
        }
        .padding(12)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(TBrand.stroke, lineWidth: 1))
    }

    // MARK: Format

    private var formatPickerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Vis som")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            HStack(spacing: 6) {
                ForEach(FormatType.allCases, id: \.self) { f in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { format = f }
                    } label: {
                        VStack(spacing: 3) {
                            Text(f.rawValue)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(format == f ? .white : .white.opacity(0.85))
                            Text(f.example)
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundStyle(format == f ? .white.opacity(0.85) : TBrand.textSecondary)
                                .monospacedDigit()
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            format == f ? AnyShapeStyle(pickedColor.color) : AnyShapeStyle(TBrand.card),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(format == f ? Color.clear : TBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Comparison

    private var comparisonPickerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Sammenligning")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            VStack(spacing: 5) {
                ForEach(Comparison.allCases, id: \.self) { c in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { comparison = c }
                    } label: {
                        HStack {
                            Text(c.rawValue.capitalized)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            Spacer()
                            Image(systemName: comparison == c ? "largecircle.fill.circle" : "circle")
                                .font(.system(size: 15))
                                .foregroundStyle(comparison == c ? pickedColor.color : TBrand.stroke)
                        }
                        .padding(.horizontal, 11).padding(.vertical, 9)
                        .background(
                            comparison == c ? pickedColor.color.opacity(0.10) : TBrand.card,
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(comparison == c ? pickedColor.color.opacity(0.4) : TBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Period

    private var periodPickerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Default-periode")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            HStack(spacing: 6) {
                ForEach(Period.allCases, id: \.self) { p in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { period = p }
                    } label: {
                        Text(p.rawValue)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(period == p ? .white : TBrand.purpleLight)
                            .padding(.horizontal, 11).padding(.vertical, 7)
                            .background(
                                period == p ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(TBrand.purple.opacity(0.15)),
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(TBrand.purple.opacity(period == p ? 0 : 0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Display

    private var displayCard: some View {
        Toggle(isOn: $showOnDashboard) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(TBrand.blue.opacity(0.22))
                    Image(systemName: "rectangle.grid.2x2.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(TBrand.blue)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Vis på Team-dashboard")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Vises i KPI-raden ved siden av andre KPIer")
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

    // MARK: Save

    private var saveBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 13, weight: .bold))
                Text(canSave ? "Opprett KPI «\(name)»" : "Gi KPI-en et navn")
                    .font(.system(size: 14, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: canSave
                                ? [pickedColor.color, pickedColor.color.opacity(0.7)]
                                : [TBrand.cardHi, TBrand.cardHi],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(canSave ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!canSave)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(TBrand.bg.opacity(0.95).overlay(Rectangle().fill(TBrand.stroke).frame(height: 1), alignment: .top))
    }
}
