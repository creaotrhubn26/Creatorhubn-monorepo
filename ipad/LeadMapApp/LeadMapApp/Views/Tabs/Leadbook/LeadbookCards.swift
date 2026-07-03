// LeadbookCards.swift — 5 hovedkort + NewTemplateSheet
//
//   TemplateLibraryCard   — tabell over maler (5 rader)
//   SelectedLeadbookCard  — sidebar m/ 4 steg + steg-innhold
//   ObjectionsCard        — 3 vanlige innvendinger m/ anbefalt respons
//   PerformanceCard       — ytelse per mal m/ to lilla bar-charts
//   VersionsCard          — 4 versjon-rader m/ status
//   NewTemplateSheet      — opprett ny mal

import SwiftUI

// MARK: - TemplateLibraryModal (wrapper for å vise biblioteket som sheet)

struct TemplateLibraryModal: View {
    @Binding var selected: LeadbookTemplate
    @Environment(\.dismiss) private var dismiss

    @State private var query: String = ""
    @State private var sort: SortField = .topPerforming
    @State private var channels: Set<LeadbookTemplate.Channel> = []
    @State private var statuses: Set<LeadbookTemplate.Status> = []
    @State private var layout: Layout = .list
    @State private var toast: String?
    @State private var menuTemplate: LeadbookTemplate?

    enum SortField: String, CaseIterable, Identifiable {
        case topPerforming = "Best ytelse"
        case mostUsed = "Mest brukt"
        case name = "A–Å"
        case recent = "Nylig endret"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .topPerforming: return "chart.line.uptrend.xyaxis"
            case .mostUsed: return "person.2.fill"
            case .name: return "textformat"
            case .recent: return "clock.fill"
            }
        }
    }

    enum Layout: String, CaseIterable, Identifiable {
        case list = "Liste"
        case grid = "Rutenett"
        var id: String { rawValue }
        var icon: String { self == .list ? "list.bullet" : "square.grid.2x2" }
    }

    private var rows: [LeadbookTemplate] {
        var items = LeadbookData.templates
        if !query.isEmpty {
            let q = query.lowercased()
            items = items.filter { $0.name.lowercased().contains(q) || $0.channel.rawValue.lowercased().contains(q) }
        }
        if !channels.isEmpty { items = items.filter { channels.contains($0.channel) } }
        if !statuses.isEmpty { items = items.filter { statuses.contains($0.status) } }
        switch sort {
        case .topPerforming: items.sort { $0.conversion > $1.conversion }
        case .mostUsed:      items.sort { $0.used > $1.used }
        case .name:          items.sort { $0.name < $1.name }
        case .recent:        items.sort { $0.id.uuidString < $1.id.uuidString }
        }
        return items
    }

    private var bestPerformer: LeadbookTemplate? { LeadbookData.templates.max { $0.conversion < $1.conversion } }
    private var totalUsed: Int { LeadbookData.templates.map(\.used).reduce(0, +) }
    private var avgConversion: Double {
        let base = LeadbookData.templates
        return base.isEmpty ? 0 : base.map(\.conversion).reduce(0, +) / Double(base.count)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        heroStats
                        searchBar
                        filterChips
                        Group {
                            if rows.isEmpty { emptyState }
                            else if layout == .list { listLayout } else { gridLayout }
                        }
                        Color.clear.frame(height: 12)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Bibliotek")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .principal) {
                    Picker("", selection: $layout) {
                        ForEach(Layout.allCases) { l in
                            Image(systemName: l.icon).tag(l)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 110)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Section("Sortér etter") {
                            ForEach(SortField.allCases) { s in
                                Button {
                                    sort = s
                                } label: { Label(s.rawValue, systemImage: s.icon) }
                            }
                        }
                        Divider()
                        Button {} label: { Label("Eksporter alle (CSV)", systemImage: "square.and.arrow.up") }
                        Button {} label: { Label("Importer fra fil", systemImage: "square.and.arrow.down") }
                        Divider()
                        Button {} label: { Label("Tilpass kolonner", systemImage: "slider.horizontal.3") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
            .overlay(alignment: .top) {
                if let t = toast {
                    Label(t, systemImage: "checkmark.circle.fill")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(LBrand.green, in: Capsule())
                        .padding(.top, 6)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
            .sheet(item: $menuTemplate) { t in
                NavigationStack {
                    TemplatePreviewSheet(template: t, onUse: {
                        selected = t
                        menuTemplate = nil
                        flashToast("\(t.name) er valgt")
                    })
                }
            }
        }
    }

    // MARK: Hero stats

    private var heroStats: some View {
        HStack(spacing: 12) {
            stat("ANTALL MALER", "\(LeadbookData.templates.count)", LBrand.purpleLight, "doc.on.doc.fill")
            stat("AKTIVE", "\(LeadbookData.templates.filter { $0.status == .active }.count)", LBrand.green, "checkmark.seal.fill")
            stat("BRUKT (90D)", "\(totalUsed)", LBrand.blue, "person.2.fill")
            stat("GJ.SNITT KONV.", "\(Int(avgConversion * 100))%", LBrand.orange, "chart.line.uptrend.xyaxis")
        }
    }

    private func stat(_ label: String, _ value: String, _ tint: Color, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(tint)
                Text(label).font(.system(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            }
            Text(value).font(.system(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Search + filter chips

    private var searchBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(LBrand.textTertiary)
                TextField("Søk mal, kanal eller stikkord…", text: $query)
                    .foregroundStyle(.white).textFieldStyle(.plain)
                if !query.isEmpty {
                    Button { query = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(LBrand.textTertiary)
                    }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
            Menu {
                ForEach(SortField.allCases) { s in
                    Button { sort = s } label: { Label(s.rawValue, systemImage: s.icon) }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: sort.icon).font(.system(size: 11, weight: .bold))
                        .foregroundStyle(LBrand.purpleLight)
                    Text(sort.rawValue).font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white).lineLimit(1).fixedSize()
                    Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
            }
        }
    }

    private var filterChips: some View {
        VStack(alignment: .leading, spacing: 10) {
            chipScrollLabel("KANAL")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip(text: "Alle", icon: nil, active: channels.isEmpty, tint: LBrand.purpleLight) {
                        channels.removeAll()
                    }
                    ForEach(LeadbookTemplate.Channel.allCases, id: \.self) { c in
                        chip(text: c.rawValue, icon: c.icon, active: channels.contains(c), tint: c.color) {
                            if channels.contains(c) { channels.remove(c) } else { channels.insert(c) }
                        }
                    }
                }
            }
            chipScrollLabel("STATUS")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip(text: "Alle", icon: nil, active: statuses.isEmpty, tint: LBrand.purpleLight) {
                        statuses.removeAll()
                    }
                    ForEach(LeadbookTemplate.Status.allCases, id: \.self) { s in
                        chip(text: s.rawValue, icon: nil, active: statuses.contains(s), tint: s.color) {
                            if statuses.contains(s) { statuses.remove(s) } else { statuses.insert(s) }
                        }
                    }
                }
            }
        }
    }

    private func chipScrollLabel(_ text: String) -> some View {
        Text(text).font(.system(size: 9, weight: .black))
            .foregroundStyle(LBrand.textTertiary).tracking(0.6)
    }

    private func chip(text: String, icon: String?, active: Bool, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let icon { Image(systemName: icon).font(.system(size: 10, weight: .bold)) }
                Text(text).font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(active ? .white : LBrand.textSecondary)
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(active ? tint.opacity(0.28) : LBrand.cardHi, in: Capsule())
            .overlay(Capsule().stroke(active ? tint.opacity(0.55) : LBrand.stroke, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    // MARK: List + Grid

    private var listLayout: some View {
        VStack(spacing: 10) {
            ForEach(rows) { t in templateCard(t, compact: false) }
        }
    }

    private var gridLayout: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(rows) { t in templateCard(t, compact: true) }
        }
    }

    private func templateCard(_ t: LeadbookTemplate, compact: Bool) -> some View {
        let isSelected = selected.id == t.id
        return Button { menuTemplate = t } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 11).fill(t.channel.color.opacity(0.22))
                        Image(systemName: t.channel.icon)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(t.channel.color)
                    }
                    .frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(t.name)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                        HStack(spacing: 6) {
                            Text(t.channel.rawValue.uppercased())
                                .font(.system(size: 9, weight: .black))
                                .foregroundStyle(t.channel.color)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(t.channel.color.opacity(0.16), in: Capsule())
                                .tracking(0.5)
                            statusBadge(t.status)
                            if isSelected {
                                Text("VALGT")
                                    .font(.system(size: 9, weight: .black))
                                    .foregroundStyle(LBrand.purpleLight)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(LBrand.purple.opacity(0.22), in: Capsule())
                                    .tracking(0.5)
                            }
                        }
                    }
                    Spacer(minLength: 4)
                    Menu {
                        Button { selected = t; LeadbookLiveStore.shared.logUsage(t); flashToast("\(t.name) er valgt") } label: { Label("Bruk mal", systemImage: "play.fill") }
                        Button { menuTemplate = t } label: { Label("Forhåndsvis", systemImage: "eye") }
                        Button { flashToast("Åpner editor…") } label: { Label("Rediger", systemImage: "pencil") }
                        Button { flashToast("Duplisert som «\(t.name) (kopi)»") } label: { Label("Dupliser", systemImage: "doc.on.doc") }
                        Button {
                            UIPasteboard.general.string = "leadgrid://leadbook/\(t.id.uuidString.prefix(8))"
                            flashToast("Lenke kopiert")
                        } label: { Label("Kopier lenke", systemImage: "link") }
                        Divider()
                        Button {} label: { Label("Eksporter PDF", systemImage: "square.and.arrow.up") }
                        Button(role: .destructive) { flashToast("«\(t.name)» arkivert") } label: {
                            Label("Arkiver", systemImage: "archivebox")
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(LBrand.textSecondary)
                            .frame(width: 30, height: 30)
                            .background(LBrand.cardHi, in: Circle())
                    }
                }
                if !compact {
                    HStack(spacing: 18) {
                        miniMetric(label: "STEG", value: "\(t.step) / \(t.stepTotal)", tint: LBrand.purpleLight)
                        miniMetric(label: "BRUKT 90D", value: "\(t.used)", tint: LBrand.blue)
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 4) {
                                Text("KONVERTERING").font(.system(size: 9, weight: .black))
                                    .foregroundStyle(LBrand.textTertiary).tracking(0.5)
                                Spacer()
                                Text("\(Int(t.conversion * 100))%")
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .foregroundStyle(.white).monospacedDigit()
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(LBrand.cardHi).frame(height: 6)
                                    Capsule()
                                        .fill(LinearGradient(colors: [LBrand.green, LBrand.green.opacity(0.55)],
                                                             startPoint: .leading, endPoint: .trailing))
                                        .frame(width: max(6, geo.size.width * t.conversion), height: 6)
                                }
                            }
                            .frame(height: 6)
                        }
                        .frame(maxWidth: .infinity)
                    }
                } else {
                    HStack(spacing: 12) {
                        Label("\(t.step)/\(t.stepTotal)", systemImage: "list.bullet")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(LBrand.textSecondary)
                        Label("\(t.used)", systemImage: "person.2.fill")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(LBrand.textSecondary)
                        Spacer()
                        Text("\(Int(t.conversion * 100))%")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundStyle(LBrand.green)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                isSelected ? LBrand.purple.opacity(0.13) : LBrand.card,
                in: RoundedRectangle(cornerRadius: 13)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 13)
                    .stroke(isSelected ? LBrand.purple.opacity(0.50) : LBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func miniMetric(label: String, value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(.system(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.5)
            Text(value).font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
        }
    }

    private func statusBadge(_ s: LeadbookTemplate.Status) -> some View {
        Text(s.rawValue.uppercased())
            .font(.system(size: 9, weight: .black))
            .foregroundStyle(s.color)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(s.color.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(s.color.opacity(0.4), lineWidth: 1))
            .tracking(0.5)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 32)).foregroundStyle(LBrand.textTertiary)
            Text("Ingen maler matcher")
                .font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
            Text("Prøv et annet søk eller fjern noen filtre")
                .font(.system(size: 12)).foregroundStyle(LBrand.textSecondary)
            Button {
                query = ""; channels.removeAll(); statuses.removeAll()
            } label: {
                Text("Nullstill filtre").font(.system(size: 12, weight: .bold))
                    .foregroundStyle(LBrand.purpleLight)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(LBrand.purple.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
            }.buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 40)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func flashToast(_ text: String) {
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            if toast == text { toast = nil }
        }
    }
}

// MARK: - TemplatePreviewSheet
struct TemplatePreviewSheet: View {
    let template: LeadbookTemplate
    let onUse: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            LBrand.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 13).fill(template.channel.color.opacity(0.25))
                            Image(systemName: template.channel.icon)
                                .font(.system(size: 22, weight: .bold))
                                .foregroundStyle(template.channel.color)
                        }
                        .frame(width: 56, height: 56)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(template.name)
                                .font(.system(size: 20, weight: .heavy))
                                .foregroundStyle(.white)
                            HStack(spacing: 6) {
                                Text(template.channel.rawValue.uppercased())
                                    .font(.system(size: 10, weight: .black))
                                    .foregroundStyle(template.channel.color).tracking(0.6)
                                Text("·").foregroundStyle(LBrand.textTertiary)
                                Text("\(template.stepTotal) steg")
                                    .font(.system(size: 11)).foregroundStyle(LBrand.textSecondary)
                            }
                        }
                        Spacer()
                    }
                    HStack(spacing: 10) {
                        previewStat("BRUKT", "\(template.used)", LBrand.blue)
                        previewStat("KONVERTERING", "\(Int(template.conversion * 100))%", LBrand.green)
                        previewStat("STEG", "\(template.step)/\(template.stepTotal)", LBrand.purpleLight)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("FORHÅNDSVISNING").font(.system(size: 10, weight: .black))
                            .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                        ForEach(LeadbookData.steps) { s in
                            HStack(alignment: .top, spacing: 12) {
                                ZStack {
                                    Circle().fill(LBrand.cardHi)
                                    Text("\(s.number)")
                                        .font(.system(size: 12, weight: .black, design: .rounded))
                                        .foregroundStyle(.white)
                                }
                                .frame(width: 26, height: 26)
                                Text(s.title)
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(.white)
                                Spacer()
                            }
                            .padding(12)
                            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        }
                    }
                    Button {
                        onUse()
                        dismiss()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "play.fill")
                            Text("Bruk denne malen")
                        }
                        .font(.system(size: 15, weight: .heavy))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                        .shadow(color: LBrand.purple.opacity(0.45), radius: 8, y: 3)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 4)
                }
                .padding(20)
            }
        }
        .navigationTitle("Forhåndsvis mal")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
            }
        }
    }

    private func previewStat(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            Text(value).font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(tint).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
    }
}

// MARK: - 1. TemplateLibraryCard

struct TemplateLibraryCard: View {
    @Binding var selected: LeadbookTemplate
    @State private var search: String = ""
    @State private var sortBy: SortKey = .name
    @State private var sortAscending: Bool = true
    @State private var showFilter = false
    @State private var showAll = false
    @State private var actionToast: String?
    @State private var menuTemplate: LeadbookTemplate?

    // Filter state
    @State private var filterChannels: Set<LeadbookTemplate.Channel> = []
    @State private var filterStatuses: Set<LeadbookTemplate.Status> = []

    enum SortKey: String, CaseIterable, Hashable {
        case name = "MALNAVN"
        case channel = "KANAL"
        case step = "STEG"
        case used = "BRUKT"
        case conversion = "KONVERTERING"
        case status = "STATUS"
    }

    private var filteredAndSorted: [LeadbookTemplate] {
        var items = LeadbookData.templates
        if !search.isEmpty {
            let q = search.lowercased()
            items = items.filter { $0.name.lowercased().contains(q) || $0.channel.rawValue.lowercased().contains(q) }
        }
        if !filterChannels.isEmpty {
            items = items.filter { filterChannels.contains($0.channel) }
        }
        if !filterStatuses.isEmpty {
            items = items.filter { filterStatuses.contains($0.status) }
        }
        items.sort { a, b in
            let asc: Bool
            switch sortBy {
            case .name:       asc = a.name < b.name
            case .channel:    asc = a.channel.rawValue < b.channel.rawValue
            case .step:       asc = a.step < b.step
            case .used:       asc = a.used < b.used
            case .conversion: asc = a.conversion < b.conversion
            case .status:     asc = a.status.rawValue < b.status.rawValue
            }
            return sortAscending ? asc : !asc
        }
        return items
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 11) {
                Text("Maler i biblioteket")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                searchBar
                Button { showFilter = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "line.3.horizontal.decrease")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(LBrand.purpleLight)
                        Text("Filter")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        if !filterChannels.isEmpty || !filterStatuses.isEmpty {
                            Text("\(filterChannels.count + filterStatuses.count)")
                                .font(.system(size: 9, weight: .black))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(LBrand.purple, in: Capsule())
                        }
                    }
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 13)

            // Tabell-header (klikkbar sortering)
            HStack(spacing: 0) {
                sortHeader(.name).frame(maxWidth: .infinity, alignment: .leading)
                sortHeader(.channel).frame(width: 70, alignment: .leading)
                sortHeader(.step).frame(width: 60, alignment: .leading)
                sortHeader(.used).frame(width: 60, alignment: .leading)
                sortHeader(.conversion).frame(width: 130, alignment: .leading)
                sortHeader(.status).frame(width: 110, alignment: .leading)
                Color.clear.frame(width: 28)
            }
            .padding(.horizontal, 16).padding(.bottom, 8)

            VStack(spacing: 0) {
                ForEach(filteredAndSorted) { t in
                    templateRow(t)
                    if t.id != filteredAndSorted.last?.id {
                        Divider().overlay(LBrand.stroke).padding(.horizontal, 16)
                    }
                }
                if filteredAndSorted.isEmpty { emptyState }
            }

            Button { showAll = true } label: {
                HStack(spacing: 5) {
                    Text("Se alle maler")
                        .font(.system(size: 12, weight: .semibold))
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(LBrand.purpleLight)
                .padding(.vertical, 13)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
        }
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
        .sheet(isPresented: $showFilter) {
            TemplateFilterSheet(channels: $filterChannels, statuses: $filterStatuses)
        }
        .sheet(isPresented: $showAll) {
            AllTemplatesSheet(selected: $selected)
        }
        .overlay(alignment: .top) {
            if let t = actionToast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(LBrand.green, in: Capsule())
                    .padding(.top, 14)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.85), value: actionToast)
    }

    private func sortHeader(_ key: SortKey) -> some View {
        Button {
            if sortBy == key { sortAscending.toggle() }
            else { sortBy = key; sortAscending = true }
        } label: {
            HStack(spacing: 3) {
                Text(key.rawValue)
                    .font(.system(size: 9, weight: .black))
                    .tracking(0.5)
                    .foregroundStyle(sortBy == key ? LBrand.purpleLight : LBrand.textTertiary)
                if sortBy == key {
                    Image(systemName: sortAscending ? "arrow.up" : "arrow.down")
                        .font(.system(size: 8, weight: .black))
                        .foregroundStyle(LBrand.purpleLight)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 7) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 22))
                .foregroundStyle(LBrand.textTertiary)
            Text("Ingen maler matcher")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
            Text("Prøv annet søk eller filter")
                .font(.system(size: 10))
                .foregroundStyle(LBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 26)
    }

    private func flashToast(_ text: String) {
        actionToast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            if actionToast == text { actionToast = nil }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $search)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                if search.isEmpty {
                    Text("Søk maler…")
                        .font(.system(size: 12))
                        .foregroundStyle(LBrand.textTertiary)
                        .allowsHitTesting(false)
                }
            }
            .frame(width: 150)
        }
        .padding(.horizontal, 11).padding(.vertical, 8)
        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func templateRow(_ t: LeadbookTemplate) -> some View {
        let isSelected = selected.id == t.id
        return Button {
            selected = t
        } label: {
            HStack(spacing: 0) {
                // MALNAVN m/ kanal-ikon
                HStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8).fill(t.channel.color.opacity(0.22))
                        Image(systemName: t.channel.icon)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(t.channel.color)
                    }
                    .frame(width: 30, height: 30)
                    Text(t.name)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // KANAL
                Text(t.channel.rawValue)
                    .font(.system(size: 12)).foregroundStyle(LBrand.textSecondary)
                    .frame(width: 70, alignment: .leading)

                // STEG
                Text("\(t.step) / \(t.stepTotal)")
                    .font(.system(size: 12, design: .rounded)).foregroundStyle(.white)
                    .monospacedDigit()
                    .frame(width: 60, alignment: .leading)

                // BRUKT
                Text("\(t.used)")
                    .font(.system(size: 12, design: .rounded)).foregroundStyle(.white)
                    .monospacedDigit()
                    .frame(width: 60, alignment: .leading)

                // KONVERTERING
                HStack(spacing: 7) {
                    Text("\(Int(t.conversion * 100))%")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                        .frame(width: 32, alignment: .leading)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(LBrand.cardHi).frame(height: 5)
                            Capsule()
                                .fill(LinearGradient(colors: [LBrand.green, LBrand.green.opacity(0.6)],
                                                     startPoint: .leading, endPoint: .trailing))
                                .frame(width: max(4, geo.size.width * t.conversion), height: 5)
                        }
                    }
                    .frame(height: 5)
                }
                .frame(width: 130, alignment: .leading)

                // STATUS
                statusBadge(t.status)
                    .frame(width: 110, alignment: .leading)

                // ELLIPSIS
                Menu {
                    Button {
                        selected = t
                        LeadbookLiveStore.shared.logUsage(t)
                        flashToast("\(t.name) er valgt — bruk mal i sidebar")
                    } label: { Label("Bruk mal", systemImage: "play.fill") }
                    Button { flashToast("Åpner editor…") } label: { Label("Rediger", systemImage: "pencil") }
                    Button { flashToast("Duplisert som «\(t.name) (kopi)»") } label: { Label("Dupliser", systemImage: "doc.on.doc") }
                    Button {
                        UIPasteboard.general.string = "leadgrid://leadbook/\(t.id.uuidString.prefix(8))"
                        flashToast("Lenke kopiert til utklippstavlen")
                    } label: { Label("Kopier lenke", systemImage: "link") }
                    Button { flashToast("Eksporterer som PDF…") } label: { Label("Eksporter PDF", systemImage: "square.and.arrow.up") }
                    Divider()
                    Button(role: .destructive) {
                        flashToast("«\(t.name)» arkivert")
                    } label: { Label("Arkiver", systemImage: "archivebox") }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(LBrand.textSecondary)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 11)
            .background(isSelected ? LBrand.purple.opacity(0.10) : Color.clear)
            .overlay(
                isSelected
                    ? Rectangle().fill(LBrand.purpleLight).frame(width: 3).padding(.vertical, 3)
                    : nil,
                alignment: .leading
            )
        }
        .buttonStyle(.plain)
    }

    private func statusBadge(_ s: LeadbookTemplate.Status) -> some View {
        Text(s.rawValue)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(s.color)
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(s.color.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(s.color.opacity(0.4), lineWidth: 1))
    }
}

// MARK: - 2. SelectedLeadbookCard

struct SelectedLeadbookCard: View {
    let template: LeadbookTemplate
    @Binding var currentStep: Int
    @State private var showUseMal = false
    @State private var showNewTemplate = false
    @State private var showNewObjection = false
    @State private var showImportTemplate = false
    @State private var expandedContent: LeadbookContent?
    @State private var copiedTitle: String?
    @State private var importToast: String?

    private var contentForCurrentStep: [LeadbookContent] {
        LeadbookData.contentByStep[currentStep] ?? []
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Valgt Leadbook")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                // Sekundære: Importer mal + Ny mal + Ny innvending (kontekstuelt ved siden av Bruk mal)
                Button { showImportTemplate = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "square.and.arrow.down")
                            .font(.system(size: 11, weight: .bold))
                        Text("Importer mal")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(LBrand.blue)
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(LBrand.blue.opacity(0.15), in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.blue.opacity(0.35), lineWidth: 1))
                }
                .buttonStyle(.plain)
                Button { showNewTemplate = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "doc.badge.plus")
                            .font(.system(size: 11, weight: .bold))
                        Text("Ny mal")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(LBrand.purpleLight)
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(LBrand.purple.opacity(0.15), in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.purple.opacity(0.35), lineWidth: 1))
                }
                .buttonStyle(.plain)
                Button { showNewObjection = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "shield.fill")
                            .font(.system(size: 11, weight: .bold))
                        Text("Ny innvending")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(LBrand.orange)
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(LBrand.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.orange.opacity(0.35), lineWidth: 1))
                }
                .buttonStyle(.plain)
                // Primær CTA
                Button { showUseMal = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 11, weight: .bold))
                        Text("Bruk mal")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 13).padding(.vertical, 9)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 13)

            // Tittel
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(template.channel.color.opacity(0.25))
                    Image(systemName: template.channel.icon)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(template.channel.color)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(template.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 5) {
                        Text("Steg \(currentStep) av \(template.stepTotal)")
                            .font(.system(size: 11))
                            .foregroundStyle(LBrand.textSecondary)
                        Text("•")
                            .foregroundStyle(LBrand.textTertiary)
                        Text(template.channel.rawValue.uppercased())
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(template.channel.color)
                            .tracking(0.5)
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 16).padding(.bottom, 14)

            // Steg-rad + innhold
            HStack(alignment: .top, spacing: 14) {
                stepsColumn
                    .frame(width: 124)
                contentColumn
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 16).padding(.bottom, 16)
        }
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
        .sheet(isPresented: $showUseMal) {
            UseLeadbookSheet(template: template, currentStep: currentStep)
        }
        .sheet(isPresented: $showNewTemplate) { NewTemplateSheet() }
        .sheet(isPresented: $showNewObjection) { NewObjectionSheet() }
        .sheet(isPresented: $showImportTemplate) {
            ImportTemplateSheet { name in
                importToast = "Importert \"\(name)\""
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { importToast = nil }
            }
        }
        .sheet(item: $expandedContent) { c in
            ContentDetailSheet(content: c, stepTitle: LeadbookData.steps[currentStep - 1].title)
        }
        .overlay(alignment: .top) {
            if let title = copiedTitle {
                Label("Kopiert: \(title)", systemImage: "checkmark.circle.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(LBrand.green, in: Capsule())
                    .padding(.top, 14)
                    .transition(.move(edge: .top).combined(with: .opacity))
            } else if let t = importToast {
                Label(t, systemImage: "square.and.arrow.down.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(LBrand.blue, in: Capsule())
                    .padding(.top, 14)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.85), value: copiedTitle)
        .animation(.spring(response: 0.3, dampingFraction: 0.85), value: importToast)
    }

    private var stepsColumn: some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(LeadbookData.steps) { s in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { currentStep = s.number }
                } label: {
                    HStack(spacing: 10) {
                        ZStack {
                            Circle()
                                .fill(s.number == currentStep ? LBrand.purple : LBrand.cardHi)
                            Text("\(s.number)")
                                .font(.system(size: 12, weight: .black, design: .rounded))
                                .foregroundStyle(s.number == currentStep ? .white : LBrand.textSecondary)
                                .monospacedDigit()
                        }
                        .frame(width: 26, height: 26)
                        Text(s.title)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(s.number == currentStep ? .white : LBrand.textSecondary)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(s.number == currentStep ? LBrand.purple.opacity(0.10) : Color.clear,
                                in: RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(s.number == currentStep ? LBrand.purple.opacity(0.40) : Color.clear, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var contentColumn: some View {
        VStack(spacing: 8) {
            ForEach(contentForCurrentStep) { c in
                contentRow(c)
            }
            if contentForCurrentStep.isEmpty {
                HStack {
                    Image(systemName: "doc.badge.plus")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                    Text("Ingen innhold for dette steget enda")
                        .font(.system(size: 11))
                        .foregroundStyle(LBrand.textTertiary)
                    Spacer()
                }
                .padding(.vertical, 14)
            }
        }
    }

    private func contentRow(_ c: LeadbookContent) -> some View {
        Button { expandedContent = c } label: {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    Circle().fill(c.iconColor.opacity(0.22))
                    Image(systemName: c.icon)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(c.iconColor)
                }
                .frame(width: 28, height: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(c.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text(c.body)
                        .font(.system(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineLimit(3)
                }
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
                    .padding(.top, 4)
            }
            .padding(7)
            .background(Color.white.opacity(0.02), in: RoundedRectangle(cornerRadius: 8))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button { copyContent(c) } label: { Label("Kopier", systemImage: "doc.on.doc") }
            Button {} label: { Label("Rediger", systemImage: "pencil") }
            Button {} label: { Label("Marker som brukt", systemImage: "checkmark.circle") }
            Divider()
            Button(role: .destructive) {} label: { Label("Fjern", systemImage: "trash") }
        }
    }

    private func copyContent(_ c: LeadbookContent) {
        UIPasteboard.general.string = c.body
        copiedTitle = c.title
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            if copiedTitle == c.title { copiedTitle = nil }
        }
    }
}

// MARK: - 3. ObjectionsCard

struct ObjectionsCard: View {
    @State private var selected: Objection?
    @State private var showAll = false
    @State private var toast: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Text("Innvendinger")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(LeadbookData.objections.count)")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(LBrand.textSecondary)
                    .monospacedDigit()
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(LBrand.cardHi, in: Capsule())
                Spacer()
                Button { showAll = true } label: {
                    HStack(spacing: 4) {
                        Text("Se alle")
                            .font(.system(size: 11, weight: .semibold))
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundStyle(LBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 10)

            VStack(spacing: 8) {
                ForEach(LeadbookData.objections) { o in
                    objectionRow(o)
                }
            }
            .padding(.horizontal, 14).padding(.bottom, 14)
        }
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
        .sheet(item: $selected) { o in ObjectionDetailSheet(objection: o) }
        .sheet(isPresented: $showAll) {
            AllObjectionsSheet { o in
                selected = o
            }
        }
        .overlay(alignment: .top) {
            if let t = toast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(LBrand.green, in: Capsule())
                    .padding(.top, 14)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.85), value: toast)
    }

    private func objectionRow(_ o: Objection) -> some View {
        Button { selected = o } label: {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    Circle().fill(o.iconColor.opacity(0.22))
                    Image(systemName: o.icon)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(o.iconColor)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(o.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(o.response)
                        .font(.system(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineLimit(3)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
            }
            .padding(11)
            .background(LBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 11))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                UIPasteboard.general.string = o.response
                flash("Respons kopiert")
            } label: { Label("Kopier respons", systemImage: "doc.on.doc") }
            Button { selected = o } label: { Label("Vis detaljer", systemImage: "arrow.up.right.square") }
            Button { flash("Markert som brukt") } label: { Label("Marker som brukt", systemImage: "checkmark.circle") }
            Divider()
            Button {} label: { Label("Rediger", systemImage: "pencil") }
            Button(role: .destructive) {} label: { Label("Fjern", systemImage: "trash") }
        }
    }

    private func flash(_ text: String) {
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            if toast == text { toast = nil }
        }
    }
}

// MARK: - 4. PerformanceCard

struct PerformanceCard: View {
    @State private var range = "Siste 30 dager"

    var body: some View { PerformanceModal(initialRange: range) }
}

struct PerformanceModal: View {
    var initialRange: String = "Siste 30 dager"
    @Environment(\.dismiss) private var dismiss
    @State private var range: String = "Siste 30 dager"
    @State private var sort: SortField = .response
    @State private var query: String = ""
    @State private var selected: PerformanceRow?

    enum SortField: String, CaseIterable, Identifiable {
        case response = "Respons-rate"
        case conversion = "Konvertering"
        case alpha = "A–Å"
        var id: String { rawValue }
    }

    private var rows: [PerformanceRow] {
        let base = LeadbookData.perf
        let filtered = query.isEmpty ? base
            : base.filter { $0.name.localizedCaseInsensitiveContains(query) }
        switch sort {
        case .response: return filtered.sorted { $0.responseRate > $1.responseRate }
        case .conversion: return filtered.sorted { $0.conversion > $1.conversion }
        case .alpha: return filtered.sorted { $0.name < $1.name }
        }
    }

    private var avgResponse: Double {
        guard !rows.isEmpty else { return 0 }
        return rows.map(\.responseRate).reduce(0, +) / Double(rows.count)
    }
    private var avgConversion: Double {
        guard !rows.isEmpty else { return 0 }
        return rows.map(\.conversion).reduce(0, +) / Double(rows.count)
    }
    private var best: PerformanceRow? { rows.max { $0.conversion < $1.conversion } }
    private var worst: PerformanceRow? { rows.min { $0.conversion < $1.conversion } }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        summaryRow
                        filterBar
                        tableHeader
                        VStack(spacing: 7) {
                            ForEach(rows) { p in
                                Button { selected = p } label: { perfRow(p) }
                                    .buttonStyle(.plain)
                            }
                        }
                        if let best, let worst {
                            insightsCard(best: best, worst: worst)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Ytelse per mal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button("Eksporter CSV") {}
                        Button("Eksporter PDF") {}
                        Divider()
                        Button("Del rapport…") {}
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
            .sheet(item: $selected) { p in
                PerformanceDetailSheet(row: p, range: range)
            }
        }
        .onAppear { range = initialRange }
    }

    private var summaryRow: some View {
        HStack(spacing: 12) {
            summaryTile(label: "GJ.SNITT RESPONS", value: "\(Int(avgResponse * 100))%", tint: LBrand.purpleLight, icon: "arrow.uturn.left.circle.fill")
            summaryTile(label: "GJ.SNITT KONVERTERING", value: "\(Int(avgConversion * 100))%", tint: LBrand.green, icon: "checkmark.circle.fill")
            summaryTile(label: "AKTIVE MALER", value: "\(rows.count)", tint: LBrand.blue, icon: "doc.on.doc.fill")
            summaryTile(label: "PERIODE", value: range, tint: LBrand.orange, icon: "calendar")
        }
    }

    private func summaryTile(label: String, value: String, tint: Color, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(tint)
                Text(label).font(.system(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            }
            Text(value)
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var filterBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(LBrand.textTertiary)
                TextField("Søk mal…", text: $query)
                    .foregroundStyle(.white).textFieldStyle(.plain)
            }
            .padding(.horizontal, 12).padding(.vertical, 9)
            .frame(maxWidth: .infinity)
            .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            Menu {
                ForEach(SortField.allCases) { f in
                    Button(f.rawValue) { sort = f }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.up.arrow.down").font(.system(size: 11, weight: .bold))
                    Text(sort.rawValue).font(.system(size: 12, weight: .semibold))
                    Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold)).foregroundStyle(LBrand.textTertiary)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
            Menu {
                Button("Siste 7 dager") { range = "Siste 7 dager" }
                Button("Siste 30 dager") { range = "Siste 30 dager" }
                Button("Siste 90 dager") { range = "Siste 90 dager" }
                Button("Hele året") { range = "Hele året" }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "calendar").font(.system(size: 11, weight: .bold))
                    Text(range).font(.system(size: 12, weight: .semibold))
                    Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold)).foregroundStyle(LBrand.textTertiary)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
        }
    }

    private var tableHeader: some View {
        HStack(spacing: 0) {
            Text("MAL").frame(maxWidth: .infinity, alignment: .leading)
            Text("RESPONS-RATE").frame(width: 200, alignment: .leading)
            Text("KONVERTERING").frame(width: 200, alignment: .leading)
            Text("").frame(width: 18)
        }
        .font(.system(size: 9, weight: .black))
        .tracking(0.5)
        .foregroundStyle(LBrand.textTertiary)
        .padding(.horizontal, 14).padding(.bottom, 2)
    }

    private func perfRow(_ p: PerformanceRow) -> some View {
        HStack(spacing: 0) {
            Text(p.name)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 8) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(LBrand.cardHi).frame(height: 6)
                        Capsule().fill(LBrand.purple).frame(width: max(4, geo.size.width * p.responseRate), height: 6)
                    }
                }
                .frame(height: 6)
                Text("\(Int(p.responseRate * 100))%")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .frame(width: 40, alignment: .trailing)
            }
            .frame(width: 200)
            HStack(spacing: 8) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(LBrand.cardHi).frame(height: 6)
                        Capsule().fill(LBrand.green).frame(width: max(4, geo.size.width * p.conversion), height: 6)
                    }
                }
                .frame(height: 6)
                Text("\(Int(p.conversion * 100))%")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(LBrand.green)
                    .monospacedDigit()
                    .frame(width: 40, alignment: .trailing)
            }
            .frame(width: 200)
            Image(systemName: "chevron.right")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(LBrand.textTertiary)
                .frame(width: 18)
        }
        .padding(.horizontal, 14).padding(.vertical, 11)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func insightsCard(best: PerformanceRow, worst: PerformanceRow) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .foregroundStyle(LBrand.purpleLight)
                Text("AI-INSIKT")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(LBrand.purpleLight).tracking(0.8)
            }
            (Text("Best presterende mal: ").foregroundStyle(LBrand.textSecondary)
                + Text("\(best.name) ").foregroundStyle(.white).bold()
                + Text("(\(Int(best.conversion * 100))% konvertering). ").foregroundStyle(LBrand.green)
                + Text("Lavest: ").foregroundStyle(LBrand.textSecondary)
                + Text(worst.name).foregroundStyle(.white).bold()
                + Text(" — vurder å arkivere eller re-skrive.").foregroundStyle(LBrand.textSecondary)
            )
            .font(.system(size: 13))
        }
        .padding(14)
        .background(LBrand.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.purple.opacity(0.3), lineWidth: 1))
    }
}

struct PerformanceDetailSheet: View {
    let row: PerformanceRow
    let range: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(row.name)
                                .font(.system(size: 22, weight: .heavy))
                                .foregroundStyle(.white)
                            Text("\(range) · alle kanaler")
                                .font(.system(size: 12))
                                .foregroundStyle(LBrand.textSecondary)
                        }
                        HStack(spacing: 12) {
                            metric("Sendt", "\(Int.random(in: 80...420))", LBrand.blue)
                            metric("Respons", "\(Int(row.responseRate * 100))%", LBrand.purple)
                            metric("Konvertering", "\(Int(row.conversion * 100))%", LBrand.green)
                            metric("Møter booket", "\(Int.random(in: 5...40))", LBrand.orange)
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            Text("ANBEFALTE OPTIMALISERINGER")
                                .font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            tip("Test ny åpningslinje — A/B-test 50/50 i 14 dager")
                            tip("Legg til personlig video for warm leads (+18% historisk)")
                            tip("Forenkle CTA — én tydelig handling pr. melding")
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Detalj")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
            }
        }
    }

    private func metric(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            Text(value).font(.system(size: 20, weight: .heavy, design: .rounded))
                .foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func tip(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "lightbulb.fill")
                .font(.system(size: 12))
                .foregroundStyle(LBrand.yellow)
                .padding(.top, 2)
            Text(text).font(.system(size: 13)).foregroundStyle(.white)
            Spacer()
        }
        .padding(12)
        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - 5. VersionsCard

struct VersionsCard: View {
    var body: some View { VersionsModal() }
}

struct VersionsModal: View {
    @Environment(\.dismiss) private var dismiss
    @State private var filter: VersionFilter = .all
    @State private var query: String = ""
    @State private var selected: VersionEntry?
    @State private var showCompare = false

    enum VersionFilter: String, CaseIterable, Identifiable {
        case all = "Alle"
        case current = "Gjeldende"
        case approved = "Godkjent"
        case pending = "Venter"
        var id: String { rawValue }
    }

    private var rows: [VersionEntry] {
        let base = LeadbookData.versions
        let f: [VersionEntry] = {
            switch filter {
            case .all: return base
            case .current: return base.filter { $0.status == .current }
            case .approved: return base.filter { $0.status == .approved }
            case .pending: return base.filter { $0.status == .pending }
            }
        }()
        return query.isEmpty ? f : f.filter {
            $0.summary.localizedCaseInsensitiveContains(query) ||
            $0.version.localizedCaseInsensitiveContains(query) ||
            $0.date.localizedCaseInsensitiveContains(query)
        }
    }

    private var pendingCount: Int { LeadbookData.versions.filter { $0.status == .pending }.count }
    private var approvedCount: Int { LeadbookData.versions.filter { $0.status == .approved }.count }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        summaryRow
                        filterBar
                        VStack(spacing: 8) {
                            ForEach(rows) { v in
                                Button { selected = v } label: { versionRow(v) }
                                    .buttonStyle(.plain)
                            }
                            if rows.isEmpty {
                                emptyState
                            }
                        }
                        approvalCard
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Godkjenning og versjoner")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button { showCompare = true } label: { Label("Sammenlign versjoner", systemImage: "rectangle.split.2x1") }
                        Button {} label: { Label("Eksporter versjonshistorikk", systemImage: "square.and.arrow.up") }
                        Divider()
                        Button {} label: { Label("Tilbakestill til godkjent", systemImage: "arrow.uturn.backward") }
                        Button(role: .destructive) {} label: { Label("Arkiver gamle utkast", systemImage: "archivebox") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
            .sheet(item: $selected) { v in VersionDetailSheet(version: v) }
            .sheet(isPresented: $showCompare) { CompareVersionsSheet() }
        }
    }

    private var summaryRow: some View {
        HStack(spacing: 12) {
            summaryTile("VENTER GODKJENNING", "\(pendingCount)", LBrand.orange, "clock.fill")
            summaryTile("GODKJENT", "\(approvedCount)", LBrand.green, "checkmark.seal.fill")
            summaryTile("TOTALT VERSJONER", "\(LeadbookData.versions.count)", LBrand.purpleLight, "doc.on.doc.fill")
            summaryTile("SISTE ENDRING", "20.05", LBrand.blue, "calendar")
        }
    }

    private func summaryTile(_ label: String, _ value: String, _ tint: Color, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(tint)
                Text(label).font(.system(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            }
            Text(value).font(.system(size: 20, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var filterBar: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(LBrand.textTertiary)
                TextField("Søk versjon, dato eller endring…", text: $query)
                    .foregroundStyle(.white).textFieldStyle(.plain)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(VersionFilter.allCases) { f in
                        Button { filter = f } label: {
                            Text(f.rawValue)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(filter == f ? .white : LBrand.textSecondary)
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(filter == f ? LBrand.purple.opacity(0.30) : LBrand.cardHi, in: Capsule())
                                .overlay(Capsule().stroke(filter == f ? LBrand.purple.opacity(0.55) : LBrand.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var approvalCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "person.badge.shield.checkmark.fill")
                    .foregroundStyle(LBrand.green)
                Text("GODKJENNINGS-FLYT")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(LBrand.green).tracking(0.8)
                Spacer()
            }
            (Text("\(pendingCount) versjoner venter på din godkjenning. ").foregroundStyle(.white).bold()
                + Text("Bruk Sammenlign-verktøyet for å se diff mot godkjent versjon.").foregroundStyle(LBrand.textSecondary))
                .font(.system(size: 13))
            HStack(spacing: 8) {
                Button { showCompare = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "rectangle.split.2x1")
                        Text("Sammenlign")
                    }
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(LBrand.purple, in: RoundedRectangle(cornerRadius: 9))
                }.buttonStyle(.plain)
                Button {} label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle")
                        Text("Godkjenn alle venter")
                    }
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(LBrand.green)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(LBrand.green.opacity(0.18), in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.green.opacity(0.4), lineWidth: 1))
                }.buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(LBrand.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.green.opacity(0.28), lineWidth: 1))
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 28)).foregroundStyle(LBrand.textTertiary)
            Text("Ingen versjoner i dette filteret")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
        }
        .frame(maxWidth: .infinity).padding(30)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func versionRow(_ v: VersionEntry) -> some View {
        let isCurrent = v.status == .current
        return HStack(spacing: 14) {
            Text(v.version)
                .font(.system(size: 16, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .frame(width: 56, alignment: .leading)
            VStack(alignment: .leading, spacing: 3) {
                Text(v.date)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(v.summary)
                    .font(.system(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
            statusBadge(v.status)
            Image(systemName: "chevron.right")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(LBrand.textTertiary)
        }
        .padding(14)
        .background(
            isCurrent ? LBrand.purple.opacity(0.10) : LBrand.cardHi.opacity(0.6),
            in: RoundedRectangle(cornerRadius: 11)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 11)
                .stroke(isCurrent ? LBrand.purple.opacity(0.40) : LBrand.stroke, lineWidth: 1)
        )
    }

    private func statusBadge(_ s: VersionEntry.VersionStatus) -> some View {
        HStack(spacing: 4) {
            if s == .approved {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(s.color)
            }
            Text(s.rawValue)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(s.color)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(s.color.opacity(0.18), in: Capsule())
        .overlay(Capsule().stroke(s.color.opacity(0.4), lineWidth: 1))
    }
}

// MARK: - NewTemplateSheet (pixel-perfect 2-kolonne fra mockup)

struct NewTemplateSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var category: Category?
    @State private var stage: Stage?
    @State private var templateType: TemplateType = .script
    @State private var description = ""
    @State private var goal = ""
    @State private var shareWithTeam = true
    @State private var attachedFiles: [String] = []

    enum Category: String, CaseIterable, Hashable {
        case firstContact = "Første kontakt"
        case followUp = "Oppfølging"
        case meetingBooking = "Møtebooking"
        case needsAnalysis = "Behovsavdekking"
        case proposal = "Tilbud & forslag"
        case objections = "Innvendinger"
        case closing = "Avslutning"
        case lostLead = "Tapt lead"
    }

    enum Stage: String, CaseIterable, Hashable {
        case prospecting = "Prospektering"
        case qualifying = "Kvalifisering"
        case discovery = "Discovery"
        case demo = "Demo"
        case proposal = "Tilbud"
        case negotiation = "Forhandling"
        case closing = "Lukking"
        case retention = "Retensjon"
    }

    enum TemplateType: String, CaseIterable, Hashable, Identifiable {
        case script = "Samtalemanus"
        case email = "E-post mal"
        case objection = "Innvendingshåndtering"
        case other = "Annen mal"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .script:    return "checkmark.circle.fill"
            case .email:     return "envelope.fill"
            case .objection: return "shield.fill"
            case .other:     return "doc.fill"
            }
        }
        var subtitle: String {
            switch self {
            case .script:    return "Fullt manus med ordrett dialog."
            case .email:     return "Ferdig e-postmal som kan sendes."
            case .objection: return "Svar på innvendinger og motforestillinger."
            case .other:     return "Annet innhold (mal, sjekkliste osv.)."
            }
        }
    }

    private var canSave: Bool { !title.isEmpty && category != nil && stage != nil }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                HStack(alignment: .top, spacing: 28) {
                    leftColumn
                        .frame(maxWidth: .infinity, alignment: .top)
                    rightColumn
                        .frame(maxWidth: .infinity, alignment: .top)
                }
                .padding(.horizontal, 24).padding(.top, 18).padding(.bottom, 80)
            }
            footer
        }
        .background(LBrand.bg.ignoresSafeArea())
        .frame(maxWidth: 920)              // matche mockup-bredde
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .top) {
                Text("Ny mal")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(LBrand.textSecondary)
                        .frame(width: 32, height: 32)
                        .background(LBrand.cardHi, in: Circle())
                }
                .buttonStyle(.plain)
            }
            Text("Opprett en ny salgsmal fra bunnen av.")
                .font(.system(size: 12))
                .foregroundStyle(LBrand.textSecondary)
        }
        .padding(.horizontal, 24).padding(.top, 22).padding(.bottom, 10)
    }

    // MARK: Left column

    private var leftColumn: some View {
        VStack(alignment: .leading, spacing: 16) {
            textField(label: "Maltittel", required: true,
                      binding: $title, placeholder: "F.eks. Oppfølging etter møte")
            categoryDropdown
            stageDropdown
            typePicker
        }
    }

    private var categoryDropdown: some View {
        VStack(alignment: .leading, spacing: 7) {
            labelWithRequired("Kategori", required: true)
            Menu {
                ForEach(Category.allCases, id: \.self) { c in
                    Button(c.rawValue) { category = c }
                }
            } label: {
                HStack {
                    Text(category?.rawValue ?? "Velg kategori")
                        .font(.system(size: 13))
                        .foregroundStyle(category == nil ? LBrand.textTertiary : .white)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 13).padding(.vertical, 12)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
        }
    }

    private var stageDropdown: some View {
        VStack(alignment: .leading, spacing: 7) {
            labelWithRequired("Bruksområde (steg)", required: true)
            Menu {
                ForEach(Stage.allCases, id: \.self) { s in
                    Button(s.rawValue) { stage = s }
                }
            } label: {
                HStack {
                    Text(stage?.rawValue ?? "Velg steg i salgsprosessen")
                        .font(.system(size: 13))
                        .foregroundStyle(stage == nil ? LBrand.textTertiary : .white)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 13).padding(.vertical, 12)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
        }
    }

    private var typePicker: some View {
        VStack(alignment: .leading, spacing: 7) {
            labelWithRequired("Type mal", required: true)
            VStack(spacing: 8) {
                ForEach(TemplateType.allCases) { t in
                    typeCard(t)
                }
            }
        }
    }

    private func typeCard(_ t: TemplateType) -> some View {
        let isSelected = templateType == t
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { templateType = t }
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(isSelected ? LBrand.purple : LBrand.cardHi)
                    Image(systemName: t.icon)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(isSelected ? .white : LBrand.textSecondary)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.rawValue)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(t.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
            }
            .padding(12)
            .background(
                isSelected ? LBrand.purple.opacity(0.08) : LBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isSelected ? LBrand.purpleLight : LBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Right column

    private var rightColumn: some View {
        VStack(alignment: .leading, spacing: 16) {
            textArea(label: "Beskrivelse", binding: $description,
                     placeholder: "Beskriv når og hvordan denne malen skal brukes…",
                     minHeight: 110)
            textArea(label: "Mål med malen", binding: $goal,
                     placeholder: "Hva er målet med denne malen?",
                     minHeight: 76)
            VStack(alignment: .leading, spacing: 7) {
                Text("Tilknyttede ressurser")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.textSecondary)
                fileUploadCard
            }
            shareToggle
        }
    }

    private var fileUploadCard: some View {
        Button {} label: {
            VStack(spacing: 8) {
                ZStack {
                    Circle().fill(LBrand.purple.opacity(0.20))
                    Image(systemName: "arrow.up")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(LBrand.purpleLight)
                }
                .frame(width: 36, height: 36)
                Text("Dra og slipp filer her, eller klikk for å velge")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Text("PDF, DOCX, PNG, JPG (maks 10MB)")
                    .font(.system(size: 10))
                    .foregroundStyle(LBrand.textTertiary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(LBrand.purple.opacity(0.06),
                        in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(LBrand.purple.opacity(0.40),
                            style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            )
        }
        .buttonStyle(.plain)
    }

    private var shareToggle: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Del med teamet")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Gjør malen tilgjengelig for hele teamet.")
                    .font(.system(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
            Toggle("", isOn: $shareWithTeam)
                .labelsHidden()
                .tint(LBrand.purple)
        }
    }

    // MARK: Helpers

    private func labelWithRequired(_ text: String, required: Bool) -> some View {
        HStack(spacing: 3) {
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
            if required {
                Text("*")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(LBrand.purpleLight)
            }
        }
    }

    private func textField(label: String, required: Bool, binding: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            labelWithRequired(label, required: required)
            ZStack(alignment: .leading) {
                TextField("", text: binding)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                    .padding(.horizontal, 13).padding(.vertical, 12)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                if binding.wrappedValue.isEmpty {
                    Text(placeholder)
                        .font(.system(size: 13))
                        .foregroundStyle(LBrand.textTertiary)
                        .padding(.horizontal, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private func textArea(label: String, binding: Binding<String>, placeholder: String, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: binding)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 13))
                    .frame(minHeight: minHeight)
                    .padding(8)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                if binding.wrappedValue.isEmpty {
                    Text(placeholder)
                        .font(.system(size: 13))
                        .foregroundStyle(LBrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    // MARK: Footer

    private var footer: some View {
        HStack(spacing: 10) {
            Spacer()
            Button { dismiss() } label: {
                Text("Avbryt")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22).padding(.vertical, 11)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { dismiss() } label: {
                Text("Opprett mal")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24).padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: canSave ? [LBrand.purple, LBrand.purpleLight] : [LBrand.cardHi, LBrand.cardHi],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .opacity(canSave ? 1 : 0.55)
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
        }
        .padding(.horizontal, 24).padding(.vertical, 14)
        .background(LBrand.bg.opacity(0.95).overlay(Rectangle().fill(LBrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - UseLeadbookSheet

struct UseLeadbookSheet: View {
    let template: LeadbookTemplate
    let currentStep: Int
    @Environment(\.dismiss) private var dismiss

    @State private var leadName: String = ""
    @State private var contactName: String = ""
    @State private var startLive = true
    @State private var addToCalendar = false
    @State private var trackTimer = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    contextHeader
                    leadField
                    contactField
                    optionsCard
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Bruk mal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(LBrand.purpleLight)
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { startBar }
        }
    }

    private var contextHeader: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(template.channel.color.opacity(0.25))
                Image(systemName: template.channel.icon)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(template.channel.color)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(template.name)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Starter på steg \(currentStep) av \(template.stepTotal) · \(template.channel.rawValue)")
                    .font(.system(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var leadField: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Lead / bedrift")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $leadName)
                    .foregroundStyle(.white).font(.system(size: 13))
                    .padding(12)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
                if leadName.isEmpty {
                    Text("F.eks. Nordic Elektro AS").font(.system(size: 13)).foregroundStyle(LBrand.textTertiary)
                        .padding(.horizontal, 15).allowsHitTesting(false)
                }
            }
        }
    }

    private var contactField: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Kontakt-person (valgfritt)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $contactName)
                    .foregroundStyle(.white).font(.system(size: 13))
                    .padding(12)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
                if contactName.isEmpty {
                    Text("Navn på kontakten").font(.system(size: 13)).foregroundStyle(LBrand.textTertiary)
                        .padding(.horizontal, 15).allowsHitTesting(false)
                }
            }
        }
    }

    private var optionsCard: some View {
        VStack(spacing: 9) {
            toggleRow(icon: "dot.radiowaves.left.and.right", color: LBrand.green,
                      title: "Live-modus", subtitle: "Vis steg-innhold mens samtalen pågår", binding: $startLive)
            Divider().overlay(LBrand.stroke)
            toggleRow(icon: "timer", color: LBrand.yellow,
                      title: "Spor varighet", subtitle: "Måler hvor lenge hvert steg tar", binding: $trackTimer)
            Divider().overlay(LBrand.stroke)
            toggleRow(icon: "calendar.badge.plus", color: LBrand.blue,
                      title: "Legg til i kalender", subtitle: "Bok automatisk neste-steg-møte etterpå", binding: $addToCalendar)
        }
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func toggleRow(icon: String, color: Color, title: String, subtitle: String, binding: Binding<Bool>) -> some View {
        Toggle(isOn: binding) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(color.opacity(0.22))
                    Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(color)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                    Text(subtitle).font(.system(size: 10)).foregroundStyle(LBrand.textSecondary)
                }
            }
        }
        .tint(LBrand.purple)
    }

    private var startBar: some View {
        Button {
            // Logg mal-bruken (mig 0364) — gir ekte KPI-tall i fanen.
            if !leadName.isEmpty {
                LeadbookLiveStore.shared.logUsage(template)
            }
            dismiss()
        } label: {
            HStack(spacing: 7) {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 14, weight: .bold))
                Text(leadName.isEmpty ? "Skriv inn lead først" : "Start mal-bruk for \(leadName)")
                    .font(.system(size: 14, weight: .bold))
                    .lineLimit(1).minimumScaleFactor(0.85)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: leadName.isEmpty ? [LBrand.cardHi, LBrand.cardHi] : [LBrand.purple, LBrand.purpleLight],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(leadName.isEmpty ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .disabled(leadName.isEmpty)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(LBrand.bg.opacity(0.95).overlay(Rectangle().fill(LBrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - ContentDetailSheet (åpnes ved tap på innholds-rad)

struct ContentDetailSheet: View {
    let content: LeadbookContent
    let stepTitle: String
    @Environment(\.dismiss) private var dismiss
    @State private var editing = false
    @State private var draft: String = ""
    @State private var copied = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    hero
                    if editing { editor } else { bodyCard }
                    actionsRow
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle(stepTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(LBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(editing ? "Lagre" : "Rediger") {
                        if editing {
                            // I prod: PATCH /leadbook/templates/:id/content/:contentId
                            editing = false
                        } else {
                            draft = content.body
                            editing = true
                        }
                    }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(LBrand.purpleLight)
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var hero: some View {
        HStack(spacing: 13) {
            ZStack {
                Circle().fill(content.iconColor.opacity(0.30))
                Image(systemName: content.icon)
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(content.iconColor)
            }
            .frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 2) {
                Text(stepTitle.uppercased())
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(content.iconColor)
                    .tracking(0.5)
                Text(content.title)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
        .padding(14)
        .background(
            LinearGradient(colors: [content.iconColor.opacity(0.15), content.iconColor.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(content.iconColor.opacity(0.35), lineWidth: 1))
    }

    private var bodyCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("INNHOLD")
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary)
                .tracking(0.5)
            Text(content.body)
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var editor: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("REDIGER")
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(LBrand.purpleLight)
                .tracking(0.5)
            TextEditor(text: $draft)
                .scrollContentBackground(.hidden)
                .foregroundStyle(.white)
                .font(.system(size: 14))
                .frame(minHeight: 140)
                .padding(10)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
        }
    }

    private var actionsRow: some View {
        HStack(spacing: 8) {
            Button {
                UIPasteboard.general.string = content.body
                copied = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { copied = false }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 12, weight: .bold))
                    Text(copied ? "Kopiert" : "Kopier")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(
                    LinearGradient(colors: copied ? [LBrand.green, LBrand.green.opacity(0.7)] : [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
            Button {} label: {
                HStack(spacing: 5) {
                    Image(systemName: "square.and.arrow.up").font(.system(size: 12, weight: .bold))
                    Text("Del").font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 18).padding(.vertical, 11)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - TemplateFilterSheet

struct TemplateFilterSheet: View {
    @Binding var channels: Set<LeadbookTemplate.Channel>
    @Binding var statuses: Set<LeadbookTemplate.Status>
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    section("Kanal") {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            ForEach(LeadbookTemplate.Channel.allCases, id: \.self) { c in
                                channelChip(c)
                            }
                        }
                    }
                    section("Status") {
                        VStack(spacing: 7) {
                            ForEach(LeadbookTemplate.Status.allCases, id: \.self) { s in
                                statusChip(s)
                            }
                        }
                    }
                    Color.clear.frame(height: 80)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Filter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(LBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Nullstill") {
                        channels.removeAll()
                        statuses.removeAll()
                    }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(channels.isEmpty && statuses.isEmpty ? LBrand.textTertiary : LBrand.purpleLight)
                    .disabled(channels.isEmpty && statuses.isEmpty)
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { applyBar }
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary)
                .tracking(0.5)
            content()
        }
    }

    private func channelChip(_ c: LeadbookTemplate.Channel) -> some View {
        let isOn = channels.contains(c)
        return Button {
            withAnimation { if isOn { channels.remove(c) } else { _ = channels.insert(c) } }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: c.icon)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(isOn ? .white : c.color)
                Text(c.rawValue).font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                Spacer()
                if isOn {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(.white)
                }
            }
            .padding(10)
            .background(
                isOn ? AnyShapeStyle(c.color) : AnyShapeStyle(LBrand.card),
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(isOn ? Color.clear : LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func statusChip(_ s: LeadbookTemplate.Status) -> some View {
        let isOn = statuses.contains(s)
        return Button {
            withAnimation { if isOn { statuses.remove(s) } else { _ = statuses.insert(s) } }
        } label: {
            HStack(spacing: 8) {
                Circle().fill(s.color).frame(width: 9, height: 9)
                Text(s.rawValue).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                Spacer()
                Image(systemName: isOn ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 15))
                    .foregroundStyle(isOn ? s.color : LBrand.stroke)
            }
            .padding(10)
            .background(
                isOn ? s.color.opacity(0.10) : LBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(isOn ? s.color.opacity(0.4) : LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var applyBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 13, weight: .bold))
                Text("Bruk filter (\(channels.count + statuses.count))")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(LBrand.bg.opacity(0.95).overlay(Rectangle().fill(LBrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - AllTemplatesSheet

struct AllTemplatesSheet: View {
    @Binding var selected: LeadbookTemplate
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    private var filtered: [LeadbookTemplate] {
        if search.isEmpty { return LeadbookData.templates }
        let q = search.lowercased()
        return LeadbookData.templates.filter { $0.name.lowercased().contains(q) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    summaryCard
                    searchBar
                    VStack(spacing: 7) {
                        ForEach(filtered) { t in templateCard(t) }
                    }
                    Color.clear.frame(height: 24)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Alle maler (\(LeadbookData.templates.count))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(LBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button {} label: { Label("Eksporter alle", systemImage: "square.and.arrow.up") }
                        Button {} label: { Label("Importer maler", systemImage: "square.and.arrow.down") }
                        Button {} label: { Label("Sortér etter ytelse", systemImage: "chart.bar.fill") }
                    } label: {
                        Image(systemName: "ellipsis.circle").foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var summaryCard: some View {
        HStack(spacing: 0) {
            sumStat("Maler totalt", "\(LeadbookData.templates.count)", LBrand.purpleLight)
            divider
            sumStat("Aktive", "\(LeadbookData.templates.filter { $0.status == .active }.count)", LBrand.green)
            divider
            sumStat("Høy ytelse", "\(LeadbookData.templates.filter { $0.status == .highPerf }.count)", LBrand.orange)
            divider
            sumStat("Under review", "\(LeadbookData.templates.filter { $0.status == .underReview }.count)", LBrand.yellow)
        }
        .padding(.vertical, 13)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func sumStat(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 17, weight: .black, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
            Text(label).font(.system(size: 10)).foregroundStyle(LBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
    private var divider: some View { Rectangle().fill(LBrand.stroke).frame(width: 1, height: 28) }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $search)
                    .foregroundStyle(.white).font(.system(size: 13))
                if search.isEmpty {
                    Text("Søk i alle maler…")
                        .font(.system(size: 13))
                        .foregroundStyle(LBrand.textTertiary)
                        .allowsHitTesting(false)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func templateCard(_ t: LeadbookTemplate) -> some View {
        Button {
            selected = t
            dismiss()
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(t.channel.color.opacity(0.22))
                    Image(systemName: t.channel.icon)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(t.channel.color)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.name)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        Text("\(t.channel.rawValue) · Steg \(t.step)/\(t.stepTotal)")
                            .font(.system(size: 11))
                            .foregroundStyle(LBrand.textSecondary)
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text("\(t.used) brukt")
                            .font(.system(size: 11))
                            .foregroundStyle(LBrand.textSecondary)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(Int(t.conversion * 100)) %")
                        .font(.system(size: 13, weight: .black, design: .rounded))
                        .foregroundStyle(LBrand.green)
                        .monospacedDigit()
                    Text(t.status.rawValue)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(t.status.color)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(t.status.color.opacity(0.18), in: Capsule())
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
            }
            .padding(11)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - ObjectionDetailSheet

struct ObjectionDetailSheet: View {
    let objection: Objection
    @Environment(\.dismiss) private var dismiss
    @State private var editing = false
    @State private var draft = ""
    @State private var copied = false

    // Mock: 3 alternative responses + stats
    private var alternatives: [String] {
        switch objection.title {
        case "\"Vi har allerede leverandør\"":
            return [
                "Veldig fornuftig! Hvor lenge har dere brukt dem?",
                "Helt riktig — det er nesten alltid sånn. Hva tenker du de gjør bra, og hva kunne vært bedre?",
                "Forstår! Mange av kundene våre var i samme situasjon — vi kompletterer ofte heller enn å erstatte."
            ]
        case "\"Det er for dyrt\"":
            return [
                "Sammenlignet med hva? La meg vise total kostnaden uten oss …",
                "Jeg forstår. Hvis vi tar prisen ut av ligningen — er løsningen riktig for dere?",
                "Hva ville verdien vært for dere hvis vi løste [problem] i løpet av 90 dager?"
            ]
        case "\"Send info på e-post\"":
            return [
                "Klart! Jeg sender det med en gang. Når passer det å snakke neste uke om vi får tid?",
                "Selvfølgelig. For å sende noe relevant — hva er det viktigste du vil se i materialet?",
                "Det skal jeg gjøre. Vil du heller ha en 10-min demo først, så jeg sender riktig ting?"
            ]
        default: return []
        }
    }

    private var encounteredCount: Int {
        switch objection.title {
        case "\"Vi har allerede leverandør\"": return 47
        case "\"Det er for dyrt\"":             return 31
        case "\"Send info på e-post\"":         return 28
        default: return 12
        }
    }
    private var successRate: Int {
        switch objection.title {
        case "\"Vi har allerede leverandør\"": return 38
        case "\"Det er for dyrt\"":             return 52
        case "\"Send info på e-post\"":         return 24
        default: return 30
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    hero
                    statsRow
                    responseCard
                    alternativesCard
                    coachTipCard
                    Color.clear.frame(height: 90)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Innvending")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(LBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button {} label: { Label("Rediger respons", systemImage: "pencil") }
                        Button {} label: { Label("Send til AI-coach", systemImage: "sparkles") }
                        Button {} label: { Label("Del med teamet", systemImage: "person.2.fill") }
                        Divider()
                        Button(role: .destructive) {} label: { Label("Fjern", systemImage: "trash") }
                    } label: {
                        Image(systemName: "ellipsis.circle").foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { useBar }
        }
    }

    private var hero: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(objection.iconColor.opacity(0.30))
                Image(systemName: objection.icon)
                    .font(.system(size: 19, weight: .black))
                    .foregroundStyle(objection.iconColor)
            }
            .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 3) {
                Text("INNVENDING")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(objection.iconColor)
                    .tracking(0.5)
                Text(objection.title)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
        .padding(16)
        .background(
            LinearGradient(colors: [objection.iconColor.opacity(0.18), objection.iconColor.opacity(0.05)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 16)
        )
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(objection.iconColor.opacity(0.35), lineWidth: 1))
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            statTile(icon: "chart.bar.fill", color: LBrand.blue,
                     value: "\(encounteredCount)",
                     label: "Møtt siste 30 dager")
            statTile(icon: "checkmark.seal.fill", color: LBrand.green,
                     value: "\(successRate) %",
                     label: "Suksess-rate")
            statTile(icon: "person.2.fill", color: LBrand.purpleLight,
                     value: "Kari",
                     label: "Brukt mest")
        }
    }

    private func statTile(icon: String, color: Color, value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack {
                Circle().fill(color.opacity(0.22))
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 28, height: 28)
            Text(value)
                .font(.system(size: 17, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 9))
                .foregroundStyle(LBrand.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(11)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var responseCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("ANBEFALT RESPONS")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(LBrand.green)
                    .tracking(0.5)
                Spacer()
                Button {
                    UIPasteboard.general.string = objection.response
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { copied = false }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 10, weight: .bold))
                        Text(copied ? "Kopiert" : "Kopier")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(copied ? LBrand.green : LBrand.purpleLight)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(copied ? LBrand.green.opacity(0.15) : LBrand.purple.opacity(0.15), in: Capsule())
                    .overlay(Capsule().stroke((copied ? LBrand.green : LBrand.purpleLight).opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            if editing {
                TextEditor(text: $draft)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.system(size: 14))
                    .frame(minHeight: 100)
                    .padding(8)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
            } else {
                Text(objection.response)
                    .font(.system(size: 14))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.green.opacity(0.06), in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.green.opacity(0.40), lineWidth: 1))
    }

    private var alternativesCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Text("Alternative responser")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(alternatives.count)")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(LBrand.textSecondary)
                    .monospacedDigit()
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(LBrand.cardHi, in: Capsule())
                Spacer()
            }
            VStack(spacing: 6) {
                ForEach(Array(alternatives.enumerated()), id: \.offset) { (idx, alt) in
                    alternativeRow(idx: idx + 1, text: alt)
                }
            }
        }
        .padding(13)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func alternativeRow(idx: Int, text: String) -> some View {
        Button {
            UIPasteboard.general.string = text
            copied = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { copied = false }
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Text("\(idx)")
                    .font(.system(size: 11, weight: .black, design: .rounded))
                    .foregroundStyle(LBrand.purpleLight)
                    .monospacedDigit()
                    .frame(width: 22, height: 22)
                    .background(LBrand.purple.opacity(0.18), in: Circle())
                Text(text)
                    .font(.system(size: 12))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "doc.on.doc")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
            }
            .padding(10)
            .background(LBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    private var coachTipCard: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [LBrand.purple, LBrand.purpleLight],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Image(systemName: "sparkles")
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(.white)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text("AI-COACH-TIPS")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(LBrand.purpleLight)
                    .tracking(0.5)
                Text("Lyt aktivt før du svarer. Speile kundens ord («Du sa at …») bygger tillit og gir tid til å tenke.")
                    .font(.system(size: 11))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(LBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.purple.opacity(0.35), lineWidth: 1))
    }

    private var useBar: some View {
        HStack(spacing: 9) {
            Button {
                editing.toggle()
                if editing { draft = objection.response }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: editing ? "checkmark" : "pencil")
                        .font(.system(size: 11, weight: .bold))
                    Text(editing ? "Lagre" : "Rediger")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, 11)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Button { dismiss() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 13, weight: .bold))
                    Text("Bruk denne responsen")
                        .font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(
                    LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(LBrand.bg.opacity(0.95).overlay(Rectangle().fill(LBrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - AllObjectionsSheet

struct AllObjectionsSheet: View {
    let onPick: (Objection) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    private var filtered: [Objection] {
        if search.isEmpty { return LeadbookData.objections }
        let q = search.lowercased()
        return LeadbookData.objections.filter {
            $0.title.lowercased().contains(q) || $0.response.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    summaryCard
                    searchBar
                    VStack(spacing: 8) {
                        ForEach(filtered) { o in objectionCard(o) }
                    }
                    Color.clear.frame(height: 24)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Alle innvendinger (\(LeadbookData.objections.count))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(LBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button {} label: { Label("Ny innvending", systemImage: "plus.circle") }
                        Button {} label: { Label("Importer fra Excel", systemImage: "square.and.arrow.down") }
                        Button {} label: { Label("AI-foreslå", systemImage: "sparkles") }
                    } label: {
                        Image(systemName: "plus").foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var summaryCard: some View {
        HStack(spacing: 0) {
            sumStat("Totalt", "\(LeadbookData.objections.count)", LBrand.purpleLight)
            divider
            sumStat("Møtt 30 dgr", "106", LBrand.blue)
            divider
            sumStat("Snitt suksess", "38 %", LBrand.green)
        }
        .padding(.vertical, 13)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func sumStat(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 17, weight: .black, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
            Text(label).font(.system(size: 10)).foregroundStyle(LBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
    private var divider: some View { Rectangle().fill(LBrand.stroke).frame(width: 1, height: 28) }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
            ZStack(alignment: .leading) {
                TextField("", text: $search)
                    .foregroundStyle(.white).font(.system(size: 13))
                if search.isEmpty {
                    Text("Søk innvending eller respons…")
                        .font(.system(size: 13))
                        .foregroundStyle(LBrand.textTertiary)
                        .allowsHitTesting(false)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func objectionCard(_ o: Objection) -> some View {
        Button {
            dismiss()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { onPick(o) }
        } label: {
            HStack(alignment: .top, spacing: 11) {
                ZStack {
                    Circle().fill(o.iconColor.opacity(0.22))
                    Image(systemName: o.icon)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(o.iconColor)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 3) {
                    Text(o.title)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(o.response)
                        .font(.system(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
                    .padding(.top, 8)
            }
            .padding(11)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - NewObjectionSheet

struct NewObjectionSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title: String = ""
    @State private var response: String = ""
    @State private var category: ObjCategory = .price
    @State private var iconColor: ObjColor = .yellow
    @State private var stage: TemplateStage = .discovery
    @State private var addToTemplate = true
    @State private var triggerAI = false

    enum ObjCategory: String, CaseIterable, Hashable {
        case price = "Pris / verdi"
        case timing = "Timing"
        case authority = "Beslutning"
        case need = "Behov"
        case competitor = "Konkurrent"
        case other = "Annet"
        var icon: String {
            switch self {
            case .price:       return "norwegiankronesign.circle.fill"
            case .timing:      return "clock.fill"
            case .authority:   return "person.crop.circle.badge.questionmark"
            case .need:        return "questionmark.circle.fill"
            case .competitor:  return "shield.fill"
            case .other:       return "ellipsis.circle.fill"
            }
        }
    }

    enum ObjColor: String, CaseIterable, Hashable {
        case green, blue, yellow, orange, pink, red
        var color: Color {
            switch self {
            case .green: return LBrand.green
            case .blue: return LBrand.blue
            case .yellow: return LBrand.yellow
            case .orange: return LBrand.orange
            case .pink: return LBrand.pink
            case .red: return LBrand.red
            }
        }
    }

    enum TemplateStage: String, CaseIterable, Hashable {
        case discovery = "Discovery"
        case demo = "Demo"
        case proposal = "Tilbud"
        case negotiation = "Forhandling"
        case anyStage = "Hvilket som helst steg"
    }

    private var canSave: Bool { !title.isEmpty && !response.isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    livePreview
                    titleField
                    responseField
                    categoryGrid
                    colorPicker
                    stageDropdown
                    optionsCard
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Ny innvending")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(LBrand.purpleLight)
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { saveBar }
        }
    }

    private var livePreview: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("FORHÅNDSVISNING")
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary)
                .tracking(0.6)
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    Circle().fill(iconColor.color.opacity(0.22))
                    Image(systemName: category.icon)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(iconColor.color)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title.isEmpty ? "Innvending-tittel" : title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(title.isEmpty ? LBrand.textTertiary : .white)
                    Text(response.isEmpty ? "Anbefalt respons vises her …" : response)
                        .font(.system(size: 11))
                        .foregroundStyle(response.isEmpty ? LBrand.textTertiary : LBrand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineLimit(3)
                }
                Spacer(minLength: 0)
            }
            .padding(11)
            .background(LBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(iconColor.color.opacity(0.30), lineWidth: 1))
        }
    }

    private var titleField: some View {
        VStack(alignment: .leading, spacing: 7) {
            label("Innvending *")
            ZStack(alignment: .leading) {
                TextField("", text: $title)
                    .foregroundStyle(.white).font(.system(size: 13))
                    .padding(.horizontal, 13).padding(.vertical, 12)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                if title.isEmpty {
                    Text("F.eks. «For dyrt», «Send info på e-post»")
                        .font(.system(size: 13))
                        .foregroundStyle(LBrand.textTertiary)
                        .padding(.horizontal, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var responseField: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                label("Anbefalt respons *")
                Spacer()
                Button { triggerAI.toggle() } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 10, weight: .bold))
                        Text("AI-foreslå")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(LBrand.purpleLight)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(LBrand.purple.opacity(0.18), in: Capsule())
                }
                .buttonStyle(.plain)
            }
            ZStack(alignment: .topLeading) {
                TextEditor(text: $response)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white).font(.system(size: 13))
                    .frame(minHeight: 90)
                    .padding(8)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
                if response.isEmpty {
                    Text("Skriv hvordan selgere bør svare …")
                        .font(.system(size: 13))
                        .foregroundStyle(LBrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var categoryGrid: some View {
        VStack(alignment: .leading, spacing: 7) {
            label("Kategori")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 7) {
                ForEach(ObjCategory.allCases, id: \.self) { c in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { category = c }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: c.icon)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(category == c ? .white : iconColor.color)
                            Text(c.rawValue)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Spacer()
                            if category == c {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 12)).foregroundStyle(.white)
                            }
                        }
                        .padding(.horizontal, 10).padding(.vertical, 9)
                        .background(
                            category == c ? AnyShapeStyle(iconColor.color) : AnyShapeStyle(LBrand.card),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(category == c ? Color.clear : LBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var colorPicker: some View {
        VStack(alignment: .leading, spacing: 7) {
            label("Farge")
            HStack(spacing: 8) {
                ForEach(ObjColor.allCases, id: \.self) { c in
                    Button {
                        withAnimation { iconColor = c }
                    } label: {
                        ZStack {
                            Circle().fill(c.color)
                            if iconColor == c {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 11, weight: .black))
                                    .foregroundStyle(.white)
                            }
                        }
                        .frame(width: 30, height: 30)
                        .overlay(Circle().stroke(.white.opacity(iconColor == c ? 0.85 : 0), lineWidth: 1.5))
                        .scaleEffect(iconColor == c ? 1.1 : 1)
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
        }
    }

    private var stageDropdown: some View {
        VStack(alignment: .leading, spacing: 7) {
            label("Tilhører salgs-steg")
            Menu {
                ForEach(TemplateStage.allCases, id: \.self) { s in
                    Button(s.rawValue) { stage = s }
                }
            } label: {
                HStack {
                    Text(stage.rawValue)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 13).padding(.vertical, 12)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
        }
    }

    private var optionsCard: some View {
        Toggle(isOn: $addToTemplate) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(LBrand.green.opacity(0.22))
                    Image(systemName: "doc.text.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(LBrand.green)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Legg til i alle relevante maler")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Innvendingen vises automatisk i alle maler for valgt steg")
                        .font(.system(size: 10))
                        .foregroundStyle(LBrand.textSecondary)
                }
            }
        }
        .tint(LBrand.purple)
        .padding(11)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func label(_ t: String) -> some View {
        Text(t)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(LBrand.textSecondary)
    }

    private var saveBar: some View {
        Button { dismiss() } label: {
            HStack(spacing: 7) {
                Image(systemName: "shield.fill")
                    .font(.system(size: 13, weight: .bold))
                Text(canSave ? "Opprett innvending" : "Fyll inn tittel og respons")
                    .font(.system(size: 14, weight: .bold))
                    .lineLimit(1).minimumScaleFactor(0.85)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: canSave ? [iconColor.color, iconColor.color.opacity(0.7)] : [LBrand.cardHi, LBrand.cardHi],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(canSave ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!canSave)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(LBrand.bg.opacity(0.95).overlay(Rectangle().fill(LBrand.stroke).frame(height: 1), alignment: .top))
    }
}

// MARK: - ImportTemplateSheet
struct ImportTemplateSheet: View {
    var onImported: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedSource: ImportSource = .marketplace
    @State private var marketplaceQuery: String = ""
    @State private var pastedJSON: String = ""
    @State private var selectedMarketplace: Set<String> = []
    @State private var fileName: String?
    @State private var showFilePicker = false
    @State private var importing = false
    @State private var importError: String?

    enum ImportSource: String, CaseIterable, Identifiable {
        case marketplace = "Marketplace"
        case file = "Fra fil"
        case json = "Lim inn JSON"
        case url = "Fra URL"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .marketplace: return "bag.fill"
            case .file: return "doc.fill"
            case .json: return "curlybraces"
            case .url: return "link"
            }
        }
        var tint: Color {
            switch self {
            case .marketplace: return LBrand.purpleLight
            case .file: return LBrand.blue
            case .json: return LBrand.orange
            case .url: return LBrand.green
            }
        }
    }

    private struct MarketplaceTemplate: Identifiable {
        let id = UUID()
        let name: String
        let author: String
        let category: String
        let downloads: Int
        let rating: Double
        let channel: LeadbookTemplate.Channel
        let badge: String?
    }

    private let marketplace: [MarketplaceTemplate] = [
        .init(name: "B2B SaaS Discovery → Demo", author: "Leadgrid Team", category: "Discovery", downloads: 2340, rating: 4.9, channel: .video, badge: "FEATURED"),
        .init(name: "Cold Email → Booked Meeting", author: "Sandler.no", category: "Outreach", downloads: 1820, rating: 4.7, channel: .email, badge: nil),
        .init(name: "Enterprise Pris-forhandling 5-stegs", author: "Mercuri International", category: "Forhandling", downloads: 1430, rating: 4.8, channel: .phone, badge: "BESTSELGER"),
        .init(name: "Re-engasjement etter 90 dager", author: "Leadgrid Team", category: "Vinn tilbake", downloads: 980, rating: 4.6, channel: .email, badge: nil),
        .init(name: "Video-prospekt for warm leads", author: "Vidyard Norge", category: "Discovery", downloads: 760, rating: 4.5, channel: .video, badge: "NY"),
        .init(name: "Sjekkliste: Inbound qualifier (BANT+CHAMP)", author: "HubSpot Norge", category: "Discovery", downloads: 1210, rating: 4.7, channel: .phone, badge: nil)
    ]

    private var filteredMarketplace: [MarketplaceTemplate] {
        marketplaceQuery.isEmpty ? marketplace
            : marketplace.filter {
                $0.name.localizedCaseInsensitiveContains(marketplaceQuery) ||
                $0.author.localizedCaseInsensitiveContains(marketplaceQuery) ||
                $0.category.localizedCaseInsensitiveContains(marketplaceQuery)
            }
    }

    private var canImport: Bool {
        switch selectedSource {
        case .marketplace: return !selectedMarketplace.isEmpty
        case .file: return fileName != nil
        case .json: return pastedJSON.count > 20
        case .url: return pastedJSON.hasPrefix("http")
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        sourcePicker
                        Group {
                            switch selectedSource {
                            case .marketplace: marketplaceBody
                            case .file: filePickerBody
                            case .json: jsonBody
                            case .url: urlBody
                            }
                        }
                        if let err = importError {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundStyle(LBrand.red)
                                Text(err).font(.system(size: 13))
                                    .foregroundStyle(LBrand.red)
                            }
                            .padding(10)
                            .background(LBrand.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Importer mal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { performImport() } label: {
                        HStack(spacing: 6) {
                            if importing { ProgressView().tint(.white) }
                            Text(importing ? "Importerer…" : "Importer")
                                .font(.system(size: 14, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .opacity(canImport ? 1 : 0.55)
                    }
                    .disabled(!canImport || importing)
                }
            }
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.json, .text, .pdf],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls): fileName = urls.first?.lastPathComponent
            case .failure(let e): importError = e.localizedDescription
            }
        }
    }

    private var sourcePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("KILDE")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(LBrand.textTertiary).tracking(1)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(ImportSource.allCases) { src in
                    Button { selectedSource = src } label: {
                        VStack(spacing: 6) {
                            Image(systemName: src.icon)
                                .font(.system(size: 18, weight: .bold))
                                .foregroundStyle(selectedSource == src ? src.tint : LBrand.textSecondary)
                            Text(src.rawValue)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(selectedSource == src ? .white : LBrand.textSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            selectedSource == src ? src.tint.opacity(0.18) : LBrand.cardHi,
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(selectedSource == src ? src.tint.opacity(0.5) : LBrand.stroke, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var marketplaceBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(LBrand.textTertiary)
                TextField("Søk i marketplace…", text: $marketplaceQuery)
                    .foregroundStyle(.white)
                    .textFieldStyle(.plain)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))

            VStack(spacing: 8) {
                ForEach(filteredMarketplace) { tpl in
                    Button {
                        if selectedMarketplace.contains(tpl.id.uuidString) {
                            selectedMarketplace.remove(tpl.id.uuidString)
                        } else {
                            selectedMarketplace.insert(tpl.id.uuidString)
                        }
                    } label: {
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 9).fill(tpl.channel.color.opacity(0.22))
                                Image(systemName: tpl.channel.icon)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(tpl.channel.color)
                            }
                            .frame(width: 36, height: 36)
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 6) {
                                    Text(tpl.name)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(.white)
                                    if let b = tpl.badge {
                                        Text(b)
                                            .font(.system(size: 9, weight: .heavy))
                                            .foregroundStyle(LBrand.purpleLight)
                                            .padding(.horizontal, 5).padding(.vertical, 2)
                                            .background(LBrand.purple.opacity(0.2), in: Capsule())
                                            .tracking(0.5)
                                    }
                                }
                                HStack(spacing: 8) {
                                    Text(tpl.author)
                                        .font(.system(size: 11))
                                        .foregroundStyle(LBrand.textSecondary)
                                    Text("•").foregroundStyle(LBrand.textTertiary)
                                    HStack(spacing: 3) {
                                        Image(systemName: "star.fill")
                                            .font(.system(size: 9))
                                            .foregroundStyle(LBrand.yellow)
                                        Text(String(format: "%.1f", tpl.rating))
                                            .font(.system(size: 11, weight: .semibold))
                                            .foregroundStyle(.white)
                                    }
                                    Text("•").foregroundStyle(LBrand.textTertiary)
                                    Text("\(tpl.downloads)")
                                        .font(.system(size: 11))
                                        .foregroundStyle(LBrand.textSecondary)
                                    Image(systemName: "arrow.down.circle.fill")
                                        .font(.system(size: 10))
                                        .foregroundStyle(LBrand.textTertiary)
                                }
                            }
                            Spacer()
                            Image(systemName: selectedMarketplace.contains(tpl.id.uuidString) ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(selectedMarketplace.contains(tpl.id.uuidString) ? LBrand.green : LBrand.textTertiary)
                        }
                        .padding(12)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(
                            RoundedRectangle(cornerRadius: 11)
                                .stroke(selectedMarketplace.contains(tpl.id.uuidString) ? LBrand.green.opacity(0.45) : LBrand.stroke, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var filePickerBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button { showFilePicker = true } label: {
                VStack(spacing: 10) {
                    Image(systemName: fileName == nil ? "tray.and.arrow.down.fill" : "doc.fill")
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundStyle(LBrand.blue)
                    Text(fileName ?? "Velg fil (JSON / TXT / PDF)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Maks 5 MB · Vi konverterer automatisk til Leadbook-format")
                        .font(.system(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                        .foregroundStyle(LBrand.blue.opacity(0.45))
                )
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 6) {
                Label("Støttede formater", systemImage: "info.circle.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(LBrand.textSecondary)
                Text("• Leadbook JSON-eksport · Salesforce Path Templates · HubSpot Playbooks")
                    .font(.system(size: 11)).foregroundStyle(LBrand.textTertiary)
                Text("• Outreach.io Sequences (.json) · Gong Smart Trackers")
                    .font(.system(size: 11)).foregroundStyle(LBrand.textTertiary)
            }
            .padding(12)
            .background(LBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private var jsonBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("LEADBOOK JSON").font(.system(size: 10, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary).tracking(1)
                Spacer()
                Button {
                    pastedJSON = "{\n  \"name\": \"Importert mal\",\n  \"channel\": \"phone\",\n  \"steps\": []\n}"
                } label: {
                    Text("Lim inn eksempel")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.purpleLight)
                }.buttonStyle(.plain)
            }
            TextEditor(text: $pastedJSON)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.white)
                .scrollContentBackground(.hidden)
                .padding(10)
                .frame(minHeight: 240)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            Text("Vi validerer mot Leadbook-skjema før import.")
                .font(.system(size: 11)).foregroundStyle(LBrand.textSecondary)
        }
    }

    private var urlBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("MAL-URL").font(.system(size: 10, weight: .bold))
                .foregroundStyle(LBrand.textTertiary).tracking(1)
            HStack(spacing: 8) {
                Image(systemName: "link").foregroundStyle(LBrand.textTertiary)
                TextField("https://share.leadgrid.no/templates/…", text: $pastedJSON)
                    .foregroundStyle(.white).textFieldStyle(.plain)
                    .autocapitalization(.none)
            }
            .padding(.horizontal, 12).padding(.vertical, 12)
            .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
        }
    }

    private func performImport() {
        importError = nil
        importing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            importing = false
            let name: String
            switch selectedSource {
            case .marketplace:
                name = marketplace.first { selectedMarketplace.contains($0.id.uuidString) }?.name
                    ?? "\(selectedMarketplace.count) maler"
            case .file: name = fileName ?? "Fil"
            case .json: name = "JSON-mal"
            case .url: name = "Delt mal"
            }
            onImported(name)
            dismiss()
        }
    }
}

// MARK: - VersionDetailSheet
struct VersionDetailSheet: View {
    let version: VersionEntry
    @Environment(\.dismiss) private var dismiss
    @State private var toast: String?

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 10) {
                                Text(version.version)
                                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                                    .foregroundStyle(.white).monospacedDigit()
                                statusBadge
                                Spacer()
                            }
                            Text(version.summary)
                                .font(.system(size: 14)).foregroundStyle(LBrand.textSecondary)
                            HStack(spacing: 12) {
                                Label(version.date, systemImage: "calendar")
                                Label("Endret av Lars K.", systemImage: "person.fill")
                                Label("v\(version.version)", systemImage: "doc.fill")
                            }
                            .font(.system(size: 11))
                            .foregroundStyle(LBrand.textTertiary)
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            Text("ENDRINGER")
                                .font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            diffRow(kind: .added, text: "Ny åpningslinje: «Takk for at du tok deg tid…»")
                            diffRow(kind: .modified, text: "Steg 3 — flyttet pris-spørsmål til etter behovsavdekking")
                            diffRow(kind: .removed, text: "Fjernet referanse til kampanje Q1-2025")
                            diffRow(kind: .added, text: "La til 2 nye innvendinger i steg 4")
                        }
                        actionButtons
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Versjon \(version.version)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button {} label: { Label("Sammenlign med gjeldende", systemImage: "rectangle.split.2x1") }
                        Button {} label: { Label("Dupliser som ny versjon", systemImage: "plus.square.on.square") }
                        Divider()
                        Button(role: .destructive) {} label: { Label("Slett versjon", systemImage: "trash") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
            .overlay(alignment: .top) {
                if let t = toast {
                    Label(t, systemImage: "checkmark.circle.fill")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(LBrand.green, in: Capsule())
                        .padding(.top, 6)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        }
    }

    private var statusBadge: some View {
        HStack(spacing: 4) {
            if version.status == .approved {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(version.status.color)
            }
            Text(version.status.rawValue)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(version.status.color)
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(version.status.color.opacity(0.18), in: Capsule())
        .overlay(Capsule().stroke(version.status.color.opacity(0.4), lineWidth: 1))
    }

    enum DiffKind { case added, removed, modified
        var color: Color {
            switch self {
            case .added: return LBrand.green
            case .removed: return LBrand.red
            case .modified: return LBrand.orange
            }
        }
        var icon: String {
            switch self {
            case .added: return "plus.circle.fill"
            case .removed: return "minus.circle.fill"
            case .modified: return "pencil.circle.fill"
            }
        }
        var label: String {
            switch self {
            case .added: return "LAGT TIL"
            case .removed: return "FJERNET"
            case .modified: return "ENDRET"
            }
        }
    }

    private func diffRow(kind: DiffKind, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: kind.icon)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(kind.color)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 3) {
                Text(kind.label)
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(kind.color).tracking(0.6)
                Text(text)
                    .font(.system(size: 13))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
        .padding(12)
        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
    }

    private var actionButtons: some View {
        HStack(spacing: 10) {
            if version.status == .pending {
                Button {
                    toast = "Godkjent"
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { toast = nil }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Godkjenn")
                    }
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(LBrand.green, in: RoundedRectangle(cornerRadius: 11))
                }.buttonStyle(.plain)
                Button {
                    toast = "Sendt til revisjon"
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { toast = nil }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.uturn.backward")
                        Text("Send tilbake")
                    }
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(LBrand.orange)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(LBrand.orange.opacity(0.18), in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.orange.opacity(0.4), lineWidth: 1))
                }.buttonStyle(.plain)
            } else if version.status != .current {
                Button {
                    toast = "Versjon \(version.version) satt som gjeldende"
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { toast = nil }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.uturn.backward.circle.fill")
                        Text("Sett som gjeldende")
                    }
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 11)
                    )
                }.buttonStyle(.plain)
            }
        }
        .padding(.top, 4)
    }
}

// MARK: - CompareVersionsSheet
struct CompareVersionsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var leftVersion = "v2.0"
    @State private var rightVersion = "v2.1"

    private var versions: [String] { LeadbookData.versions.map { "v\($0.version)" } }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(spacing: 10) {
                            picker(label: "FRA", value: $leftVersion, tint: LBrand.red)
                            Image(systemName: "arrow.right")
                                .foregroundStyle(LBrand.textTertiary)
                                .padding(.top, 14)
                            picker(label: "TIL", value: $rightVersion, tint: LBrand.green)
                        }
                        HStack(alignment: .top, spacing: 12) {
                            sideColumn(title: leftVersion, content: leftContent, tint: LBrand.red)
                            sideColumn(title: rightVersion, content: rightContent, tint: LBrand.green)
                        }
                        summary
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Sammenlign versjoner")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
            }
        }
    }

    private let leftContent: [String] = [
        "1. Åpne med spørsmål om dagen",
        "2. Identifiser nåværende prosess",
        "3. Pris-spørsmål (FØR behov)",
        "4. Pitch løsning",
        "5. Avslutning"
    ]
    private let rightContent: [String] = [
        "1. Takk for tiden — kort intro",
        "2. Identifiser nåværende prosess",
        "3. Behovsavdekking m/ åpne spørsmål",
        "4. Pris-spørsmål (ETTER behov)",
        "5. Pitch løsning",
        "6. Avslutning + CTA"
    ]

    private func picker(label: String, value: Binding<String>, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.system(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            Menu {
                ForEach(versions, id: \.self) { v in
                    Button(v) { value.wrappedValue = v }
                }
            } label: {
                HStack(spacing: 6) {
                    Text(value.wrappedValue).font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(tint.opacity(0.4), lineWidth: 1))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sideColumn(title: String, content: [String], tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title).font(.system(size: 14, weight: .bold)).foregroundStyle(tint)
                Spacer()
                Text("\(content.count) steg").font(.system(size: 10))
                    .foregroundStyle(LBrand.textTertiary)
            }
            VStack(alignment: .leading, spacing: 6) {
                ForEach(content, id: \.self) { line in
                    Text(line)
                        .font(.system(size: 12))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("OPPSUMMERING").font(.system(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            HStack(spacing: 14) {
                pill(label: "+2", text: "lagt til", color: LBrand.green)
                pill(label: "−1", text: "fjernet", color: LBrand.red)
                pill(label: "Δ3", text: "endret", color: LBrand.orange)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func pill(label: String, text: String, color: Color) -> some View {
        HStack(spacing: 6) {
            Text(label).font(.system(size: 14, weight: .heavy, design: .rounded))
                .foregroundStyle(color)
            Text(text).font(.system(size: 11)).foregroundStyle(LBrand.textSecondary)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(color.opacity(0.14), in: Capsule())
    }
}

// MARK: - LeadbookKPIDetailSheet
import Charts

struct LeadbookKPIDetailSheet: View {
    let kpi: LeadbookKPI
    @Environment(\.dismiss) private var dismiss
    @State private var range: Range = .d14
    @State private var showSetGoal = false
    @State private var showCreateAlert = false
    @State private var showShare = false
    @State private var toast: String?

    enum Range: String, CaseIterable, Identifiable {
        case d7 = "7 dager"
        case d14 = "14 dager"
        case d30 = "30 dager"
        case d90 = "90 dager"
        var id: String { rawValue }
    }

    private var trimmedSeries: [(Int, Double)] {
        let n: Int = {
            switch range {
            case .d7: return 7
            case .d14: return kpi.series.count
            case .d30: return 30
            case .d90: return 90
            }
        }()
        let base = kpi.series
        // For lengre rekkevidder, gjenta + ekstrapoler for å fylle
        let arr: [Double] = {
            if base.count >= n { return Array(base.suffix(n)) }
            var out: [Double] = []
            var last = base.last ?? 0
            let first = base.first ?? 0
            for i in 0..<n {
                if i < base.count { out.append(base[i]); last = base[i] }
                else { last = max(0, last - Double(i % 3)); out.append(max(first * 0.6, last)) }
            }
            return out.reversed()
        }()
        return arr.enumerated().map { ($0.offset, $0.element) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        hero
                        rangePicker
                        chartCard
                        breakdownCard
                        aiInsight
                        actionsGrid
                        Color.clear.frame(height: 12)
                    }
                    .padding(20)
                }
            }
            .navigationTitle(kpi.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button { showShare = true } label: { Label("Del rapport", systemImage: "square.and.arrow.up") }
                        Button {} label: { Label("Eksporter CSV", systemImage: "tablecells") }
                        Button {} label: { Label("Skriv ut PDF", systemImage: "printer") }
                        Divider()
                        Button { showCreateAlert = true } label: { Label("Lag varsel", systemImage: "bell.badge") }
                        Button { showSetGoal = true } label: { Label("Sett mål", systemImage: "target") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(kpi.tint)
                    }
                }
            }
            .sheet(isPresented: $showSetGoal) { LeadbookGoalSheet(kpi: kpi) { saved in
                toast = "Mål satt: \(saved)"
                schedule()
            } }
            .sheet(isPresented: $showCreateAlert) { LeadbookAlertSheet(kpi: kpi) { saved in
                toast = "Varsel opprettet: \(saved)"
                schedule()
            } }
            .sheet(isPresented: $showShare) { LeadbookShareSheet(kpi: kpi) }
            .overlay(alignment: .top) {
                if let t = toast {
                    Label(t, systemImage: "checkmark.circle.fill")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(LBrand.green, in: Capsule())
                        .padding(.top, 6)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        }
    }

    private func schedule() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            toast = nil
        }
    }

    // MARK: Subviews

    private var hero: some View {
        HStack(alignment: .top, spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 14).fill(kpi.tint.opacity(0.22))
                Image(systemName: kpi.icon)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(kpi.tint)
            }
            .frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: 6) {
                Text(kpi.value)
                    .font(.system(size: 38, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                HStack(spacing: 10) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.right").font(.system(size: 10, weight: .bold))
                        Text(kpi.trend.replacingOccurrences(of: "↑ ", with: ""))
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(LBrand.green)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(LBrand.green.opacity(0.16), in: Capsule())
                    Text("vs. forrige periode")
                        .font(.system(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
                Text(kpi.subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .padding(.top, 2)
            }
            Spacer()
        }
        .padding(18)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(kpi.tint.opacity(0.3), lineWidth: 1))
    }

    private var rangePicker: some View {
        HStack(spacing: 8) {
            ForEach(Range.allCases) { r in
                Button { range = r } label: {
                    Text(r.rawValue)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(range == r ? .white : LBrand.textSecondary)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(range == r ? kpi.tint.opacity(0.28) : LBrand.cardHi, in: Capsule())
                        .overlay(Capsule().stroke(range == r ? kpi.tint.opacity(0.55) : LBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("UTVIKLING").font(.system(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Spacer()
                Text("Siste \(range.rawValue.lowercased())")
                    .font(.system(size: 11)).foregroundStyle(LBrand.textTertiary)
            }
            Chart {
                ForEach(trimmedSeries, id: \.0) { idx, value in
                    AreaMark(x: .value("Dag", idx), y: .value(kpi.title, value))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [kpi.tint.opacity(0.35), kpi.tint.opacity(0.02)],
                                startPoint: .top, endPoint: .bottom)
                        )
                        .interpolationMethod(.catmullRom)
                    LineMark(x: .value("Dag", idx), y: .value(kpi.title, value))
                        .foregroundStyle(kpi.tint)
                        .lineStyle(StrokeStyle(lineWidth: 2.5))
                        .interpolationMethod(.catmullRom)
                }
            }
            .chartXAxis { AxisMarks(preset: .aligned) { _ in
                AxisGridLine().foregroundStyle(LBrand.stroke.opacity(0.4))
            } }
            .chartYAxis { AxisMarks(preset: .aligned, position: .leading) { _ in
                AxisGridLine().foregroundStyle(LBrand.stroke.opacity(0.4))
                AxisValueLabel().foregroundStyle(LBrand.textTertiary)
            } }
            .frame(height: 200)
        }
        .padding(16)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var breakdownCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(breakdownTitle).font(.system(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Spacer()
                Button {} label: {
                    HStack(spacing: 4) {
                        Text("Se alle").font(.system(size: 11, weight: .semibold))
                        Image(systemName: "arrow.up.right").font(.system(size: 9, weight: .bold))
                    }
                    .foregroundStyle(kpi.tint)
                }.buttonStyle(.plain)
            }
            VStack(spacing: 8) {
                ForEach(breakdownRows.indices, id: \.self) { i in
                    let row = breakdownRows[i]
                    HStack(spacing: 12) {
                        Text("#\(i + 1)")
                            .font(.system(size: 11, weight: .black, design: .rounded))
                            .foregroundStyle(LBrand.textTertiary)
                            .frame(width: 24, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.label)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Text(row.sub)
                                .font(.system(size: 10))
                                .foregroundStyle(LBrand.textSecondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(row.value)
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundStyle(.white).monospacedDigit()
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(LBrand.cardHi).frame(height: 4)
                                    Capsule().fill(kpi.tint).frame(width: max(8, geo.size.width * row.share), height: 4)
                                }
                            }
                            .frame(width: 80, height: 4)
                        }
                    }
                    .padding(10)
                    .background(LBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding(16)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private struct BreakdownRow {
        let label: String
        let sub: String
        let value: String
        let share: Double
    }

    private var breakdownTitle: String {
        switch kpi {
        case .activeTemplates: return "TOPP MALER (BRUKT)"
        case .usedToday:       return "BRUK I DAG PER MAL"
        case .meetingRate:     return "BESTE MØTERATE PER MAL"
        case .teamAdoption:    return "ADOPSJON PER MEDLEM"
        }
    }

    private var breakdownRows: [BreakdownRow] {
        switch kpi {
        case .activeTemplates:
            return [
                .init(label: "Første kontakt — Felt-besøk", sub: "Felt · 52 ganger", value: "32 %", share: 0.95),
                .init(label: "Møtebooking — Telefon", sub: "Telefon · 47 ganger", value: "41 %", share: 0.85),
                .init(label: "Oppfølging — Telefon", sub: "Telefon · 38 ganger", value: "26 %", share: 0.72),
                .init(label: "Tilbud — E-post", sub: "E-post · 31 ganger", value: "27 %", share: 0.58),
                .init(label: "Ikke svar — Felt", sub: "Felt · 19 ganger", value: "18 %", share: 0.40)
            ]
        case .usedToday:
            return [
                .init(label: "Møtebooking — Telefon", sub: "Maria L · 14, Espen · 11, +6", value: "31", share: 0.95),
                .init(label: "Første kontakt — Felt-besøk", sub: "Espen · 18, Anders · 4, +3", value: "25", share: 0.78),
                .init(label: "Oppfølging — Telefon", sub: "Maria L · 9, Lars · 6, +5", value: "20", share: 0.62),
                .init(label: "Tilbud — E-post", sub: "Lars · 8, Anders · 7, +3", value: "18", share: 0.58),
                .init(label: "Ikke svar — Felt", sub: "Anders · 6, Maria · 3, +2", value: "11", share: 0.36)
            ]
        case .meetingRate:
            return [
                .init(label: "Møtebooking — Telefon", sub: "112 forsøk · 46 møter", value: "41 %", share: 0.95),
                .init(label: "Første kontakt — Felt-besøk", sub: "184 forsøk · 59 møter", value: "32 %", share: 0.78),
                .init(label: "Tilbud — E-post", sub: "208 forsøk · 56 møter", value: "27 %", share: 0.66),
                .init(label: "Oppfølging — Telefon", sub: "240 forsøk · 62 møter", value: "26 %", share: 0.64),
                .init(label: "Ikke svar — Felt", sub: "98 forsøk · 18 møter", value: "18 %", share: 0.45)
            ]
        case .teamAdoption:
            return [
                .init(label: "Maria Lindholm", sub: "Bruker 7/8 maler aktivt", value: "94 %", share: 0.97),
                .init(label: "Espen Bråten", sub: "Bruker 6/8 maler aktivt", value: "85 %", share: 0.88),
                .init(label: "Lars Kristensen", sub: "Bruker 5/8 maler aktivt", value: "78 %", share: 0.80),
                .init(label: "Anders Solberg", sub: "Bruker 3/8 maler aktivt", value: "62 %", share: 0.65),
                .init(label: "Kari Nilsen", sub: "Brukte ingen maler siste 7 dager", value: "0 %", share: 0.05)
            ]
        }
    }

    private var aiInsight: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles").foregroundStyle(kpi.tint)
                Text("AI-INSIKT").font(.system(size: 10, weight: .black))
                    .foregroundStyle(kpi.tint).tracking(0.8)
                Spacer()
            }
            Text(insightBody)
                .font(.system(size: 13))
                .foregroundStyle(.white)
            if let action = insightAction {
                Button {} label: {
                    HStack(spacing: 6) {
                        Image(systemName: action.icon).font(.system(size: 11, weight: .bold))
                        Text(action.label).font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(kpi.tint)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(kpi.tint.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(kpi.tint.opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(kpi.tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(kpi.tint.opacity(0.3), lineWidth: 1))
    }

    private var insightBody: String {
        switch kpi {
        case .activeTemplates: return "20 % flere aktive maler enn forrige periode. «Møtebooking — Telefon» har 41 % konvertering — vurder å dele beste-praksis med teamet."
        case .usedToday:       return "Maria Lindholm har generert flest bruk i dag (34). Espen Bråten ligger 41 % under sitt eget snitt — sjekk om han trenger oppfriskning."
        case .meetingRate:     return "Møterate har steget 3,4 pp siste 14 dager. Hovedløftet kommer fra «Møtebooking — Telefon» (+8 pp). Skaler opp denne malen til hele teamet."
        case .teamAdoption:    return "76 % adopsjon, opp 12 %. Kari Nilsen har ikke brukt noen mal siste 7 dager — vurder 1:1 for å avklare blokkering."
        }
    }

    private struct InsightAction { let icon: String; let label: String }
    private var insightAction: InsightAction? {
        switch kpi {
        case .activeTemplates: return .init(icon: "square.and.arrow.up", label: "Del best-praksis")
        case .usedToday:       return .init(icon: "message.fill", label: "Send oppfriskning til Espen")
        case .meetingRate:     return .init(icon: "person.3.fill", label: "Rull ut til hele teamet")
        case .teamAdoption:    return .init(icon: "calendar.badge.clock", label: "Planlegg 1:1 med Kari")
        }
    }

    private var actionsGrid: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("HANDLINGER").font(.system(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                actionTile(icon: "target", label: "Sett mål", tint: LBrand.green) { showSetGoal = true }
                actionTile(icon: "bell.badge", label: "Lag varsel", tint: LBrand.orange) { showCreateAlert = true }
                actionTile(icon: "person.3.fill", label: "Medlem-breakdown", tint: LBrand.blue) {}
                actionTile(icon: "square.and.arrow.up", label: "Del rapport", tint: kpi.tint) { showShare = true }
            }
        }
    }

    private func actionTile(icon: String, label: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(tint.opacity(0.22))
                    Image(systemName: icon).font(.system(size: 14, weight: .bold)).foregroundStyle(tint)
                }
                .frame(width: 34, height: 34)
                Text(label).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
            }
            .padding(12)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Goal / Alert / Share sheets

struct LeadbookGoalSheet: View {
    let kpi: LeadbookKPI
    var onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var goalValue: Double = 50
    @State private var deadline: Date = Date().addingTimeInterval(30 * 24 * 3600)

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("MÅL FOR").font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            Text(kpi.title).font(.system(size: 20, weight: .heavy)).foregroundStyle(.white)
                            Text("Nåværende verdi: \(kpi.value)").font(.system(size: 12))
                                .foregroundStyle(LBrand.textSecondary)
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text("MÅLVERDI").font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            Text("\(Int(goalValue))")
                                .font(.system(size: 36, weight: .heavy, design: .rounded))
                                .foregroundStyle(kpi.tint)
                            Slider(value: $goalValue, in: 0...200, step: 1)
                                .tint(kpi.tint)
                        }
                        .padding(14)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 8) {
                            Text("FRIST").font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            DatePicker("", selection: $deadline, displayedComponents: .date)
                                .datePickerStyle(.graphical)
                                .tint(kpi.tint)
                        }
                        .padding(14)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Sett mål")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        onSave("\(Int(goalValue)) innen \(deadline.formatted(.dateTime.day().month()))")
                        dismiss()
                    } label: {
                        Text("Lagre").font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(kpi.tint, in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
        }
    }
}

struct LeadbookAlertSheet: View {
    let kpi: LeadbookKPI
    var onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var op: Operator = .below
    @State private var threshold: Double = 30
    @State private var channels: Set<Channel> = [.push, .email]

    enum Operator: String, CaseIterable, Identifiable {
        case below = "Under"
        case above = "Over"
        case change = "Endrer seg ≥ 10%"
        var id: String { rawValue }
    }
    enum Channel: String, CaseIterable, Identifiable {
        case push = "Push"
        case email = "E-post"
        case slack = "Slack"
        case sms = "SMS"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .push: return "iphone.gen3"
            case .email: return "envelope.fill"
            case .slack: return "number"
            case .sms: return "message.fill"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("VARSLE NÅR \(kpi.title.uppercased()) ER")
                                .font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            HStack(spacing: 8) {
                                ForEach(Operator.allCases) { o in
                                    Button { op = o } label: {
                                        Text(o.rawValue).font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(op == o ? .white : LBrand.textSecondary)
                                            .padding(.horizontal, 12).padding(.vertical, 7)
                                            .background(op == o ? kpi.tint.opacity(0.3) : LBrand.cardHi, in: Capsule())
                                            .overlay(Capsule().stroke(op == o ? kpi.tint.opacity(0.5) : LBrand.stroke, lineWidth: 1))
                                    }.buttonStyle(.plain)
                                }
                            }
                            if op != .change {
                                Text("\(Int(threshold))")
                                    .font(.system(size: 36, weight: .heavy, design: .rounded))
                                    .foregroundStyle(kpi.tint)
                                Slider(value: $threshold, in: 0...200, step: 1).tint(kpi.tint)
                            }
                        }
                        .padding(14)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 10) {
                            Text("KANALER").font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                                ForEach(Channel.allCases) { c in
                                    Button {
                                        if channels.contains(c) { channels.remove(c) } else { channels.insert(c) }
                                    } label: {
                                        HStack(spacing: 8) {
                                            Image(systemName: c.icon).font(.system(size: 13, weight: .bold))
                                            Text(c.rawValue).font(.system(size: 13, weight: .semibold))
                                            Spacer()
                                            Image(systemName: channels.contains(c) ? "checkmark.circle.fill" : "circle")
                                                .foregroundStyle(channels.contains(c) ? LBrand.green : LBrand.textTertiary)
                                        }
                                        .foregroundStyle(channels.contains(c) ? .white : LBrand.textSecondary)
                                        .padding(10)
                                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(channels.contains(c) ? LBrand.green.opacity(0.4) : LBrand.stroke, lineWidth: 1))
                                    }.buttonStyle(.plain)
                                }
                            }
                        }
                        .padding(14)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Lag varsel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        let desc = op == .change ? op.rawValue : "\(op.rawValue) \(Int(threshold))"
                        onSave(desc)
                        dismiss()
                    } label: {
                        Text("Aktiver").font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(kpi.tint, in: RoundedRectangle(cornerRadius: 10))
                    }.disabled(channels.isEmpty)
                }
            }
        }
    }
}

struct LeadbookShareSheet: View {
    let kpi: LeadbookKPI
    @Environment(\.dismiss) private var dismiss
    @State private var recipients: String = ""
    @State private var message: String = ""

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("DEL RAPPORT FOR").font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            Text(kpi.title).font(.system(size: 22, weight: .heavy)).foregroundStyle(.white)
                            Text("\(kpi.value) — \(kpi.trend)").font(.system(size: 13))
                                .foregroundStyle(LBrand.textSecondary)
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("MOTTAKERE").font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            TextField("E-post, kommaseparert", text: $recipients)
                                .foregroundStyle(.white).textFieldStyle(.plain)
                                .padding(12)
                                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("MELDING").font(.system(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            TextEditor(text: $message)
                                .foregroundStyle(.white)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 140)
                                .padding(8)
                                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                        }
                        HStack(spacing: 10) {
                            Button {} label: {
                                Label("Kopier lenke", systemImage: "link")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 12).padding(.vertical, 10)
                                    .frame(maxWidth: .infinity)
                                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                            }.buttonStyle(.plain)
                            Button {} label: {
                                Label("Eksporter PDF", systemImage: "square.and.arrow.down")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 12).padding(.vertical, 10)
                                    .frame(maxWidth: .infinity)
                                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                            }.buttonStyle(.plain)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Del rapport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Text("Send").font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                    }.disabled(recipients.isEmpty)
                }
            }
        }
    }
}
