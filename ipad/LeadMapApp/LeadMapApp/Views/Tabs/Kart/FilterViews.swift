// FilterViews.swift
//
// Filter-popovers + flere-filtre-sheet for Kart-toppen.
//   - AreaFilterPopover    (Alle områder + radius)
//   - TypeFilterPopover    (Bransjer multi-select)
//   - StatusFilterPopover  (Lead-status multi-select)
//   - MoreFiltersSheet     (Full modal: omsetning/ansatte/score/sortering)

import SwiftUI

private enum FlBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.06)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.35)
}

// MARK: - AreaFilterPopover

struct AreaFilterPopover: View {
    @Binding var selected: AreaFilter
    @Binding var radiusKm: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            popHeader("Område", subtitle: "Velg region eller filtrer nær din posisjon")

            VStack(spacing: 4) {
                ForEach(AreaFilter.allCases, id: \.self) { area in
                    rowButton(area: area)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 8)

            if selected == .nearMe {
                Divider().overlay(FlBrand.stroke).padding(.horizontal, 16)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Radius")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(FlBrand.textSecondary)
                        Spacer()
                        Text("\(Int(radiusKm)) km")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(FlBrand.purpleLight)
                            .monospacedDigit()
                    }
                    Slider(value: $radiusKm, in: 1...50, step: 1)
                        .tint(FlBrand.purple)
                }
                .padding(.horizontal, 16).padding(.bottom, 14)
            }
        }
        .frame(width: 280)
        .background(FlBrand.card)
        .preferredColorScheme(.dark)
    }

    private func rowButton(area: AreaFilter) -> some View {
        let isSelected = selected == area
        return Button { selected = area } label: {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(isSelected ? FlBrand.purple.opacity(0.30) : FlBrand.cardHi)
                    Image(systemName: area.icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(isSelected ? FlBrand.purpleLight : FlBrand.textSecondary)
                }
                .frame(width: 32, height: 32)
                Text(area.rawValue)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(FlBrand.purpleLight)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 7)
            .background(
                isSelected ? FlBrand.purple.opacity(0.10) : Color.clear,
                in: RoundedRectangle(cornerRadius: 8)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - TypeFilterPopover

struct TypeFilterPopover: View {
    @Binding var selected: Set<String>

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            popHeader("Bransje", subtitle: "Velg én eller flere typer")
            HStack {
                Text("\(selected.count) valgt")
                    .font(.system(size: 11))
                    .foregroundStyle(FlBrand.textSecondary)
                Spacer()
                if !selected.isEmpty {
                    Button { selected.removeAll() } label: {
                        Text("Nullstill")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(FlBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 8)

            ScrollView {
                VStack(spacing: 4) {
                    ForEach(Industries.all, id: \.0) { (name, icon, color) in
                        industryRow(name: name, icon: icon, color: color)
                    }
                }
                .padding(.horizontal, 8).padding(.bottom, 8)
            }
            .frame(maxHeight: 380)
        }
        .frame(width: 280)
        .background(FlBrand.card)
        .preferredColorScheme(.dark)
    }

    private func industryRow(name: String, icon: String, color: Color) -> some View {
        let isSelected = selected.contains(name)
        return Button {
            if isSelected { selected.remove(name) } else { selected.insert(name) }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 30, height: 30)
                Text(name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .font(.system(size: 16))
                    .foregroundStyle(isSelected ? FlBrand.purpleLight : FlBrand.stroke)
            }
            .padding(.horizontal, 8).padding(.vertical, 6)
            .background(
                isSelected ? color.opacity(0.08) : Color.clear,
                in: RoundedRectangle(cornerRadius: 8)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - StatusFilterPopover

struct StatusFilterPopover: View {
    @Binding var selected: Set<MapLeadMock.PinStatus>

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            popHeader("Lead status", subtitle: "Vis kun pins med valgte statuser")
            HStack {
                Text("\(selected.count) valgt")
                    .font(.system(size: 11))
                    .foregroundStyle(FlBrand.textSecondary)
                Spacer()
                if !selected.isEmpty {
                    Button { selected.removeAll() } label: {
                        Text("Nullstill")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(FlBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 8)

            VStack(spacing: 4) {
                ForEach(MapLeadMock.PinStatus.allCases, id: \.self) { st in
                    statusRow(st)
                }
            }
            .padding(.horizontal, 8).padding(.bottom, 10)
        }
        .frame(width: 260)
        .background(FlBrand.card)
        .preferredColorScheme(.dark)
    }

    private func statusRow(_ st: MapLeadMock.PinStatus) -> some View {
        let isSelected = selected.contains(st)
        return Button {
            if isSelected { selected.remove(st) } else { selected.insert(st) }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(st.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: st.icon)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(st.color)
                }
                .frame(width: 28, height: 28)
                Text(st.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .font(.system(size: 15))
                    .foregroundStyle(isSelected ? st.color : FlBrand.stroke)
            }
            .padding(.horizontal, 8).padding(.vertical, 6)
            .background(
                isSelected ? st.color.opacity(0.08) : Color.clear,
                in: RoundedRectangle(cornerRadius: 8)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - MoreFiltersSheet

struct MoreFiltersSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var revenueRange: ClosedRange<Double> = 0...50
    @State private var employeesRange: ClosedRange<Double> = 0...500
    @State private var leadScoreRange: ClosedRange<Double> = 0...100
    @State private var lastActivity: LastActivityFilter = .anyTime
    @State private var assignedTo: AssignedTo = .anyone
    @State private var sortBy: SortBy = .lastActivity
    @State private var onlyMine: Bool = false
    @State private var onlyWithoutFollowUp: Bool = false
    @State private var onlyHighScore: Bool = false

    enum LastActivityFilter: String, CaseIterable {
        case anyTime = "Når som helst"
        case today = "I dag"
        case thisWeek = "Denne uken"
        case thisMonth = "Denne måneden"
        case stale = "Stille > 30 dager"
    }

    enum AssignedTo: String, CaseIterable {
        case anyone = "Alle"
        case me = "Meg"
        case unassigned = "Ikke tildelt"
        case team = "Mitt team"
    }

    enum SortBy: String, CaseIterable {
        case lastActivity = "Sist aktivitet"
        case score = "Lead-score"
        case revenue = "Omsetning"
        case distance = "Avstand"
        case createdAt = "Opprettet"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    quickFiltersCard
                    rangeCard(title: "Omsetning",
                              icon: "norwegiankronesign.circle.fill",
                              range: $revenueRange,
                              bounds: 0...50,
                              format: { "\($0 == 50 ? "50+" : Int($0).description) mill." })
                    rangeCard(title: "Ansatte",
                              icon: "person.3.fill",
                              range: $employeesRange,
                              bounds: 0...500,
                              format: { "\($0 == 500 ? "500+" : Int($0).description)" })
                    rangeCard(title: "Lead-score",
                              icon: "flame.fill",
                              range: $leadScoreRange,
                              bounds: 0...100,
                              format: { "\(Int($0))" })
                    pickerCard(title: "Sist aktivitet", icon: "clock.fill",
                               selection: $lastActivity)
                    pickerCard(title: "Tildelt", icon: "person.crop.circle.fill",
                               selection: $assignedTo)
                    pickerCard(title: "Sorter etter", icon: "arrow.up.arrow.down",
                               selection: $sortBy)
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(FlBrand.bg.ignoresSafeArea())
            .navigationTitle("Flere filtre")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(FlBrand.purpleLight)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button { resetAll() } label: {
                        Text("Nullstill")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(FlBrand.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .toolbarBackground(FlBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { bottomBar }
        }
        .macCatalystSheetSize(minWidth: 780, minHeight: 680)
    }

    private func resetAll() {
        revenueRange = 0...50
        employeesRange = 0...500
        leadScoreRange = 0...100
        lastActivity = .anyTime
        assignedTo = .anyone
        sortBy = .lastActivity
        onlyMine = false
        onlyWithoutFollowUp = false
        onlyHighScore = false
    }

    // MARK: Quick filters

    private var quickFiltersCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader("Hurtigvalg", icon: "bolt.fill")
            VStack(spacing: 8) {
                quickToggle(isOn: $onlyMine,
                            label: "Kun mine leads",
                            sub: "Leads tildelt deg",
                            icon: "person.crop.circle.fill",
                            color: FlBrand.purple)
                quickToggle(isOn: $onlyWithoutFollowUp,
                            label: "Mangler oppfølging",
                            sub: "Ingen planlagt aktivitet",
                            icon: "exclamationmark.bubble.fill",
                            color: FlBrand.orange)
                quickToggle(isOn: $onlyHighScore,
                            label: "Hot leads (score ≥ 80)",
                            sub: "Mest sannsynlige å vinne",
                            icon: "flame.fill",
                            color: FlBrand.red)
            }
        }
        .padding(16)
        .background(FlBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FlBrand.stroke, lineWidth: 1))
    }

    private func quickToggle(isOn: Binding<Bool>, label: String, sub: String,
                               icon: String, color: Color) -> some View {
        Toggle(isOn: isOn) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(label)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(sub)
                        .font(.system(size: 10))
                        .foregroundStyle(FlBrand.textSecondary)
                }
            }
        }
        .tint(FlBrand.purple)
        .padding(8)
        .background(FlBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: Range-card

    @ViewBuilder
    private func rangeCard(title: String, icon: String,
                            range: Binding<ClosedRange<Double>>,
                            bounds: ClosedRange<Double>,
                            format: @escaping (Double) -> String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(title, icon: icon)
            HStack {
                Text("Fra \(format(range.wrappedValue.lowerBound))")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(FlBrand.purpleLight)
                Spacer()
                Text("til \(format(range.wrappedValue.upperBound))")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(FlBrand.purpleLight)
            }
            // SwiftUI har ikke range-slider native; emuler med to slidere
            VStack(spacing: 4) {
                Slider(value: Binding(
                    get: { range.wrappedValue.lowerBound },
                    set: { newLo in
                        let hi = max(newLo + 1, range.wrappedValue.upperBound)
                        range.wrappedValue = newLo...hi
                    }
                ), in: bounds)
                    .tint(FlBrand.purple)
                Slider(value: Binding(
                    get: { range.wrappedValue.upperBound },
                    set: { newHi in
                        let lo = min(range.wrappedValue.lowerBound, newHi - 1)
                        range.wrappedValue = lo...newHi
                    }
                ), in: bounds)
                    .tint(FlBrand.purpleLight)
            }
            HStack {
                Text(format(bounds.lowerBound))
                    .font(.system(size: 10))
                    .foregroundStyle(FlBrand.textTertiary)
                Spacer()
                Text(format(bounds.upperBound))
                    .font(.system(size: 10))
                    .foregroundStyle(FlBrand.textTertiary)
            }
        }
        .padding(16)
        .background(FlBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FlBrand.stroke, lineWidth: 1))
    }

    // MARK: Picker-card

    @ViewBuilder
    private func pickerCard<T: CaseIterable & Hashable & RawRepresentable>(
        title: String, icon: String, selection: Binding<T>
    ) -> some View where T.AllCases: RandomAccessCollection, T.RawValue == String {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(title, icon: icon)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(Array(T.allCases), id: \.self) { opt in
                        Button { selection.wrappedValue = opt } label: {
                            Text(opt.rawValue)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(selection.wrappedValue == opt
                                                ? .white : FlBrand.textSecondary)
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(
                                    selection.wrappedValue == opt
                                        ? AnyShapeStyle(LinearGradient(
                                            colors: [FlBrand.purple, FlBrand.purpleLight],
                                            startPoint: .leading, endPoint: .trailing
                                        ))
                                        : AnyShapeStyle(FlBrand.cardHi),
                                    in: Capsule()
                                )
                                .overlay(Capsule().stroke(
                                    selection.wrappedValue == opt ? Color.clear : FlBrand.stroke,
                                    lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(16)
        .background(FlBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FlBrand.stroke, lineWidth: 1))
    }

    // MARK: Bottom-bar

    private var bottomBar: some View {
        HStack(spacing: 10) {
            Button { resetAll() } label: {
                Text("Nullstill alle")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(FlBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(FlBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)

            Button { dismiss() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 12, weight: .bold))
                    Text("Vis treff")
                        .font(.system(size: 14, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(
                        colors: [FlBrand.purple, FlBrand.purpleLight],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(
            FlBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(FlBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    // MARK: Section-header

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 7) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(FlBrand.purpleLight)
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Spacer()
        }
    }
}

// MARK: - Popover-header (delt)

private func popHeader(_ title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: 2) {
        Text(title)
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(.white)
        Text(subtitle)
            .font(.system(size: 10))
            .foregroundStyle(FlBrand.textSecondary)
    }
    .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 8)
}
