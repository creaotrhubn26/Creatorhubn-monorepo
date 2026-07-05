// LeadsFilterViews.swift
//
// Filter-popovers + Importer-sheet + LagretVisning + MoreFilters for Leads-fanen.

import SwiftUI

private enum LfBrand {
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
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.45)
}

// MARK: - Area popover

enum LeadsArea: String, CaseIterable, Hashable {
    case all = "Alle områder"
    case oslo = "Oslo"
    case bergen = "Bergen"
    case trondheim = "Trondheim"
    case stavanger = "Stavanger"
    case viken = "Viken"
    case norge = "Hele Norge"
    var icon: String {
        switch self {
        case .all:        return "globe"
        case .oslo:       return "building.2.fill"
        case .bergen:     return "water.waves"
        case .trondheim:  return "snowflake"
        case .stavanger:  return "fuelpump.fill"
        case .viken:      return "map.fill"
        case .norge:      return "flag.fill"
        }
    }
}

struct LeadsAreaPopover: View {
    @Binding var selected: LeadsArea
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            popHeader("Område", subtitle: "Filtrer på geografisk region")
            VStack(spacing: 4) {
                ForEach(LeadsArea.allCases, id: \.self) { a in
                    Button { selected = a } label: {
                        HStack(spacing: 11) {
                            ZStack {
                                Circle().fill(selected == a ? LfBrand.purple.opacity(0.30) : LfBrand.cardHi)
                                Image(systemName: a.icon)
                                    .font(.appScaled(size: 11, weight: .semibold))
                                    .foregroundStyle(selected == a ? LfBrand.purpleLight : LfBrand.textSecondary)
                            }
                            .frame(width: 30, height: 30)
                            Text(a.rawValue)
                                .font(.appScaled(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Spacer()
                            if selected == a {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.appScaled(size: 13))
                                    .foregroundStyle(LfBrand.purpleLight)
                            }
                        }
                        .padding(.horizontal, 8).padding(.vertical, 6)
                        .background(
                            selected == a ? LfBrand.purple.opacity(0.10) : Color.clear,
                            in: RoundedRectangle(cornerRadius: 8)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 8)
        }
        .frame(width: 260)
        .background(LfBrand.card)
        .preferredColorScheme(.dark)
    }
}

// MARK: - Status popover (multi)

struct LeadsStatusPopover: View {
    @Binding var selected: Set<LeadRow.LeadStatus>
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            popHeader("Lead status", subtitle: "Multi-velg: viser kun valgte")
            HStack {
                Text("\(selected.count) valgt")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LfBrand.textSecondary)
                Spacer()
                if !selected.isEmpty {
                    Button { selected.removeAll() } label: {
                        Text("Nullstill")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(LfBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 8)
            VStack(spacing: 4) {
                ForEach(LeadRow.LeadStatus.allCases, id: \.self) { st in
                    Button {
                        if selected.contains(st) { selected.remove(st) } else { selected.insert(st) }
                    } label: {
                        HStack(spacing: 11) {
                            ZStack {
                                Circle().fill(st.color.opacity(selected.contains(st) ? 0.30 : 0.15))
                                Image(systemName: st.icon)
                                    .font(.appScaled(size: 11, weight: .semibold))
                                    .foregroundStyle(st.color)
                            }
                            .frame(width: 28, height: 28)
                            Text(st.label)
                                .font(.appScaled(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Spacer()
                            Image(systemName: selected.contains(st) ? "checkmark.square.fill" : "square")
                                .font(.appScaled(size: 14))
                                .foregroundStyle(selected.contains(st) ? st.color : LfBrand.stroke)
                        }
                        .padding(.horizontal, 8).padding(.vertical, 6)
                        .background(
                            selected.contains(st) ? st.color.opacity(0.08) : Color.clear,
                            in: RoundedRectangle(cornerRadius: 8)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8).padding(.bottom, 8)
        }
        .frame(width: 260)
        .background(LfBrand.card)
        .preferredColorScheme(.dark)
    }
}

// MARK: - Score-popover (range)

struct LeadsScorePopover: View {
    @Binding var range: ClosedRange<Double>
    @Binding var preset: ScorePreset

    enum ScorePreset: String, CaseIterable, Hashable {
        case all = "Alle"
        case hot = "Hot (80+)"
        case warm = "Varm (60-79)"
        case cold = "Lav (<40)"
        case custom = "Egendefinert"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            popHeader("Lead score", subtitle: "Filtrer på poengsum 0-100")
            VStack(spacing: 6) {
                ForEach(ScorePreset.allCases, id: \.self) { p in
                    Button {
                        preset = p
                        switch p {
                        case .all:    range = 0...100
                        case .hot:    range = 80...100
                        case .warm:   range = 60...79
                        case .cold:   range = 0...40
                        case .custom: break
                        }
                    } label: {
                        HStack {
                            Text(p.rawValue)
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            Spacer()
                            if preset == p {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.appScaled(size: 12))
                                    .foregroundStyle(LfBrand.purpleLight)
                            }
                        }
                        .padding(.horizontal, 10).padding(.vertical, 8)
                        .background(
                            preset == p ? LfBrand.purple.opacity(0.10) : LfBrand.cardHi,
                            in: RoundedRectangle(cornerRadius: 8)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 8)

            Divider().overlay(LfBrand.stroke)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Fra \(Int(range.lowerBound))")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(LfBrand.purpleLight)
                    Spacer()
                    Text("til \(Int(range.upperBound))")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(LfBrand.purpleLight)
                }
                Slider(value: Binding(
                    get: { range.lowerBound },
                    set: { newLo in
                        preset = .custom
                        let hi = max(newLo + 1, range.upperBound)
                        range = newLo...hi
                    }
                ), in: 0...100)
                .tint(LfBrand.purple)
                Slider(value: Binding(
                    get: { range.upperBound },
                    set: { newHi in
                        preset = .custom
                        let lo = min(range.lowerBound, newHi - 1)
                        range = lo...newHi
                    }
                ), in: 0...100)
                .tint(LfBrand.purpleLight)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
        }
        .frame(width: 280)
        .background(LfBrand.card)
        .preferredColorScheme(.dark)
    }
}

// MARK: - Lagret visning popover

struct SavedViewsPopover: View {
    @Binding var selected: String
    let viewsAvailable = [
        ("Mine hot leads",           "flame.fill",         Color(red: 0.95, green: 0.20, blue: 0.20)),
        ("Trenger oppfølging",       "clock.fill",         Color(red: 0.98, green: 0.55, blue: 0.10)),
        ("Møter denne uken",         "calendar",           Color(red: 0.75, green: 0.45, blue: 1.0)),
        ("Avtaler over 200K",        "trophy.fill",        Color(red: 0.98, green: 0.75, blue: 0.14)),
        ("Stille > 14 dager",        "moon.fill",          Color(red: 0.34, green: 0.60, blue: 0.98)),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            popHeader("Lagret visning", subtitle: "5 lagrede filter-kombinasjoner")
            VStack(spacing: 4) {
                ForEach(viewsAvailable, id: \.0) { (name, icon, color) in
                    Button { selected = name } label: {
                        HStack(spacing: 11) {
                            ZStack {
                                Circle().fill(color.opacity(selected == name ? 0.30 : 0.15))
                                Image(systemName: icon)
                                    .font(.appScaled(size: 11, weight: .semibold))
                                    .foregroundStyle(color)
                            }
                            .frame(width: 28, height: 28)
                            Text(name)
                                .font(.appScaled(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Spacer()
                            if selected == name {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.appScaled(size: 13))
                                    .foregroundStyle(LfBrand.purpleLight)
                            }
                        }
                        .padding(.horizontal, 8).padding(.vertical, 6)
                        .background(
                            selected == name ? color.opacity(0.08) : Color.clear,
                            in: RoundedRectangle(cornerRadius: 8)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 8)

            Divider().overlay(LfBrand.stroke)

            HStack(spacing: 8) {
                Button { } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "plus.circle.fill")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text("Lagre nåværende visning")
                            .font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(LfBrand.purpleLight)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(LfBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
        }
        .frame(width: 280)
        .background(LfBrand.card)
        .preferredColorScheme(.dark)
    }
}

// MARK: - MoreFilters sheet

struct LeadsMoreFiltersSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var revenueRange: ClosedRange<Double> = 0...50
    @State private var employeesRange: ClosedRange<Double> = 0...500
    @State private var lastActivity: LastActivity = .anytime
    @State private var assignedTo: AssignedTo = .anyone
    @State private var sortBy: SortBy = .lastActivity
    @State private var onlyMine: Bool = false
    @State private var onlyHotScore: Bool = false
    @State private var onlyMissingFollowUp: Bool = false

    enum LastActivity: String, CaseIterable, Hashable {
        case anytime = "Når som helst"
        case today = "I dag"
        case thisWeek = "Denne uken"
        case thisMonth = "Denne måneden"
        case stale = "Stille > 30 dager"
    }
    enum AssignedTo: String, CaseIterable, Hashable {
        case anyone = "Alle"
        case me = "Meg"
        case unassigned = "Ikke tildelt"
        case team = "Mitt team"
    }
    enum SortBy: String, CaseIterable, Hashable {
        case lastActivity = "Sist aktivitet"
        case score = "Lead-score"
        case revenue = "Forventet verdi"
        case created = "Opprettet"
        case name = "Selskap A-Å"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    quickToggles
                    rangeCard("Forventet verdi", icon: "norwegiankronesign.circle.fill",
                              range: $revenueRange, bounds: 0...50,
                              format: { $0 == 50 ? "50+ mill." : "\(Int($0)) mill." })
                    rangeCard("Ansatte", icon: "person.3.fill",
                              range: $employeesRange, bounds: 0...500,
                              format: { $0 == 500 ? "500+" : "\(Int($0))" })
                    picker("Sist aktivitet", icon: "clock.fill", selection: $lastActivity)
                    picker("Tildelt", icon: "person.crop.circle.fill", selection: $assignedTo)
                    picker("Sorter etter", icon: "arrow.up.arrow.down", selection: $sortBy)
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(LfBrand.bg.ignoresSafeArea())
            .navigationTitle("Flere filtre")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(LfBrand.purpleLight)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button { } label: {
                        Text("Nullstill")
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(LfBrand.textSecondary)
                    }
                }
            }
            .toolbarBackground(LfBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                HStack(spacing: 10) {
                    Button { dismiss() } label: {
                        Text("Tøm filtre")
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(LfBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LfBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    Button { dismiss() } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "magnifyingglass")
                                .font(.appScaled(size: 12, weight: .bold))
                            Text("Vis 1 248 treff")
                                .font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(
                            LinearGradient(
                                colors: [LfBrand.purple, LfBrand.purpleLight],
                                startPoint: .leading, endPoint: .trailing
                            ),
                            in: RoundedRectangle(cornerRadius: 11)
                        )
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20).padding(.vertical, 12)
                .background(
                    LfBrand.bg.opacity(0.95)
                        .overlay(Rectangle().fill(LfBrand.stroke).frame(height: 1), alignment: .top)
                )
            }
        }
    }

    private var quickToggles: some View {
        sectionCard(title: "Hurtigvalg", icon: "bolt.fill") {
            VStack(spacing: 8) {
                toggle($onlyMine,          label: "Kun mine leads", sub: "Leads tildelt deg",                   icon: "person.crop.circle.fill", color: LfBrand.purple)
                toggle($onlyHotScore,      label: "Hot leads (80+)", sub: "Mest sannsynlige å vinne",           icon: "flame.fill",              color: LfBrand.red)
                toggle($onlyMissingFollowUp, label: "Mangler oppfølging", sub: "Ingen planlagt aktivitet",     icon: "exclamationmark.bubble",   color: LfBrand.orange)
            }
        }
    }

    private func toggle(_ binding: Binding<Bool>, label: String, sub: String, icon: String, color: Color) -> some View {
        Toggle(isOn: binding) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text(label)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(sub)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(LfBrand.textSecondary)
                }
            }
        }
        .tint(LfBrand.purple)
        .padding(8)
        .background(LfBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    @ViewBuilder
    private func rangeCard(_ title: String, icon: String,
                            range: Binding<ClosedRange<Double>>,
                            bounds: ClosedRange<Double>,
                            format: @escaping (Double) -> String) -> some View {
        sectionCard(title: title, icon: icon) {
            HStack {
                Text("Fra \(format(range.wrappedValue.lowerBound))")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LfBrand.purpleLight)
                Spacer()
                Text("til \(format(range.wrappedValue.upperBound))")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LfBrand.purpleLight)
            }
            VStack(spacing: 4) {
                Slider(value: Binding(
                    get: { range.wrappedValue.lowerBound },
                    set: { newLo in
                        let hi = max(newLo + 1, range.wrappedValue.upperBound)
                        range.wrappedValue = newLo...hi
                    }
                ), in: bounds).tint(LfBrand.purple)
                Slider(value: Binding(
                    get: { range.wrappedValue.upperBound },
                    set: { newHi in
                        let lo = min(range.wrappedValue.lowerBound, newHi - 1)
                        range.wrappedValue = lo...newHi
                    }
                ), in: bounds).tint(LfBrand.purpleLight)
            }
        }
    }

    @ViewBuilder
    private func picker<T: CaseIterable & Hashable & RawRepresentable>(
        _ title: String, icon: String, selection: Binding<T>
    ) -> some View where T.AllCases: RandomAccessCollection, T.RawValue == String {
        sectionCard(title: title, icon: icon) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(Array(T.allCases), id: \.self) { opt in
                        Button { selection.wrappedValue = opt } label: {
                            Text(opt.rawValue)
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(selection.wrappedValue == opt ? .white : LfBrand.textSecondary)
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(
                                    selection.wrappedValue == opt
                                        ? AnyShapeStyle(LinearGradient(
                                            colors: [LfBrand.purple, LfBrand.purpleLight],
                                            startPoint: .leading, endPoint: .trailing
                                        ))
                                        : AnyShapeStyle(LfBrand.cardHi),
                                    in: Capsule()
                                )
                                .overlay(Capsule().stroke(
                                    selection.wrappedValue == opt ? Color.clear : LfBrand.stroke,
                                    lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, icon: String,
                                              @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: icon)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LfBrand.purpleLight)
                Text(title)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            content()
        }
        .padding(14)
        .background(LfBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LfBrand.stroke, lineWidth: 1))
    }
}

// MARK: - ImportSheet

struct ImportLeadsSheet: View {
    @Environment(\.dismiss) private var dismiss

    enum Source: String, Identifiable {
        case csv, excel, brreg, googleContacts, hubspot, salesforce
        var id: String { rawValue }
        var title: String {
            switch self {
            case .csv:            return "CSV-fil"
            case .excel:          return "Excel-fil"
            case .brreg:          return "Brønnøysund-register"
            case .googleContacts: return "Google Contacts"
            case .hubspot:        return "HubSpot CRM"
            case .salesforce:     return "Salesforce CRM"
            }
        }
        var icon: String {
            switch self {
            case .csv:            return "tablecells"
            case .excel:          return "tablecells.badge.ellipsis"
            case .brreg:          return "building.columns.fill"
            case .googleContacts: return "person.crop.circle.badge.checkmark"
            case .hubspot:        return "h.square.fill"
            case .salesforce:     return "cloud.fill"
            }
        }
        var color: Color {
            switch self {
            case .csv:            return LfBrand.green
            case .excel:          return LfBrand.yellow
            case .brreg:          return LfBrand.blue
            case .googleContacts: return LfBrand.red
            case .hubspot:        return LfBrand.orange
            case .salesforce:     return LfBrand.purpleLight
            }
        }
        var subtitle: String {
            switch self {
            case .csv:            return "Lokal .csv med kolonner navn, e-post, telefon, adresse"
            case .excel:          return ".xlsx med kolonne-mapping i neste steg"
            case .brreg:          return "Søk org.nr → auto-fyll fra Norges enhetsregister"
            case .googleContacts: return "OAuth-import fra ditt Google-konto"
            case .hubspot:        return "Migrer leads + kontakter + deals fra HubSpot"
            case .salesforce:     return "Migrer accounts + opportunities fra Salesforce"
            }
        }
    }

    @State private var selectedSource: Source = .csv

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    explainCard
                    sourceGrid
                    optionsCard
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(LfBrand.bg.ignoresSafeArea())
            .navigationTitle("Importer leads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(LfBrand.purpleLight)
                }
            }
            .toolbarBackground(LfBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                Button { dismiss() } label: {
                    HStack(spacing: 8) {
                        Image(systemName: selectedSource.icon)
                            .font(.appScaled(size: 14, weight: .bold))
                        Text("Velg \(selectedSource.title)")
                            .font(.appScaled(size: 14, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        LinearGradient(
                            colors: [selectedSource.color, selectedSource.color.opacity(0.7)],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 12)
                    )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 20).padding(.vertical, 12)
                .background(
                    LfBrand.bg.opacity(0.95)
                        .overlay(Rectangle().fill(LfBrand.stroke).frame(height: 1), alignment: .top)
                )
            }
        }
    }

    private var explainCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .font(.appScaled(size: 14))
                .foregroundStyle(LfBrand.purpleLight)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 3) {
                Text("Importer-flyt")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Velg kilde → kart kolonner til Leadgrid-felter → forhåndsvis → bekreft. AI rydder duplikater automatisk og slår sammen leads med eksisterende.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LfBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .background(LfBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LfBrand.purple.opacity(0.30), lineWidth: 1))
    }

    private var sourceGrid: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LfBrand.purpleLight)
                Text("Velg kilde")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
            LazyVGrid(columns: cols, spacing: 10) {
                ForEach([Source.csv, .excel, .brreg, .googleContacts, .hubspot, .salesforce]) { src in
                    sourceCard(src)
                }
            }
        }
    }

    private func sourceCard(_ src: Source) -> some View {
        let isSelected = selectedSource == src
        return Button { selectedSource = src } label: {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9)
                        .fill(src.color.opacity(isSelected ? 0.30 : 0.15))
                    Image(systemName: src.icon)
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(src.color)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text(src.title)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(src.subtitle)
                        .font(.appScaled(size: 9))
                        .foregroundStyle(LfBrand.textSecondary)
                        .lineLimit(2)
                }
                Spacer()
            }
            .padding(10)
            .background(LfBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isSelected ? src.color.opacity(0.5) : LfBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var optionsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "gearshape.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LfBrand.purpleLight)
                Text("Import-innstillinger")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            VStack(spacing: 8) {
                importToggle(icon: "wand.and.stars",   label: "AI-duplikat-deteksjon",   sub: "Slå sammen med eksisterende lead automatisk", color: LfBrand.purpleLight, defaultOn: true)
                importToggle(icon: "globe",            label: "Auto-scan nettsider",      sub: "Beriking fra Brønnøysund + Google Places",     color: LfBrand.green,       defaultOn: true)
                importToggle(icon: "envelope.fill",    label: "Send velkomst-e-post",     sub: "Til alle nye leads etter import",              color: LfBrand.blue,        defaultOn: false)
                importToggle(icon: "person.crop.circle", label: "Tildel deg som eier",    sub: "Ellers settes 'ikke tildelt'",                  color: LfBrand.yellow,      defaultOn: true)
            }
        }
        .padding(14)
        .background(LfBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LfBrand.stroke, lineWidth: 1))
    }

    @State private var toggles: [String: Bool] = [:]

    private func importToggle(icon: String, label: String, sub: String, color: Color, defaultOn: Bool) -> some View {
        Toggle(isOn: Binding(
            get: { toggles[label] ?? defaultOn },
            set: { toggles[label] = $0 }
        )) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text(label)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(sub)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(LfBrand.textSecondary)
                }
            }
        }
        .tint(LfBrand.purple)
        .padding(8)
        .background(LfBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }
}

// MARK: - Felles pop-header

private func popHeader(_ title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: 2) {
        Text(title)
            .font(.appScaled(size: 14, weight: .bold))
            .foregroundStyle(.white)
        Text(subtitle)
            .font(.appScaled(size: 10))
            .foregroundStyle(LfBrand.textSecondary)
    }
    .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 8)
}
