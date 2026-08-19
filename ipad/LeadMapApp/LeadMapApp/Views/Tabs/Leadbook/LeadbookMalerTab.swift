// LeadbookMalerTab.swift — Maler-fane inne i Leadbook (2026-06-30)
//
// Egen rik visning av mal-biblioteket (egen versjon av TemplateLibraryModal uten NavigationStack).
// Header m/ tittel + 4 CTA · hero-stats · søk + sort · filter-chips · layout-toggle · grid/liste.

import SwiftUI

struct LeadbookMalerView: View {
    @Binding var selected: LeadbookTemplate
    @Environment(AppState.self) private var appState

    @State private var query: String = ""
    @State private var sort: SortField = .topPerforming
    @State private var channels: Set<LeadbookTemplate.Channel> = []
    @State private var statuses: Set<LeadbookTemplate.Status> = []
    @State private var layout: Layout = .list
    @State private var toast: String?
    @State private var editingTemplate: LeadbookTemplate?
    @State private var testingTemplate: LeadbookTemplate?
    @State private var showNewTemplate = false
    @State private var favorited: Bool = true
    /// Brukerredigeringer per mal-id — på tvers av session
    @State private var editedSteps: [UUID: [EditableStep]] = [:]
    @State private var editedNames: [UUID: String] = [:]
    /// Kort-utvidet inline-rediger
    @State private var expandedCard: UUID?

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
        var icon: String { self == .list ? "list.bullet" : "square.grid.2x2.fill" }
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

    private var totalUsed: Int { LeadbookData.templates.map(\.used).reduce(0, +) }
    private var avgConversion: Double {
        let base = LeadbookData.templates
        return base.isEmpty ? 0 : base.map(\.conversion).reduce(0, +) / Double(base.count)
    }
    private var activeCount: Int { LeadbookData.templates.filter { $0.status == .active }.count }
    private var highPerfCount: Int { LeadbookData.templates.filter { $0.status == .highPerf }.count }

    var body: some View {
        VStack(spacing: 14) {
            malerHeader
            espenOnboardingBanner
            heroStats
            searchAndSort
            filterChips
            Group {
                if rows.isEmpty { emptyState }
                else if layout == .list { listLayout } else { gridLayout }
            }
        }
        .overlay(alignment: .top) {
            if let t = toast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(LBrand.green, in: Capsule())
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        .sheet(isPresented: $showNewTemplate) { PondusTemplateEditor(store: appState.pondusStore) }
        .fullScreenCover(item: $editingTemplate) { t in
            MalEditorSheet(
                template: t,
                draftSteps: seededSteps(for: t),
                draftName: seededName(for: t),
                onSave: { newSteps, newName in
                    persistEdit(template: t, steps: newSteps, name: newName)
                },
                onTest: { newSteps, newName in
                    editedSteps[t.id] = newSteps
                    editedNames[t.id] = newName
                    testingTemplate = t
                }
            )
        }
        .fullScreenCover(item: $testingTemplate) { t in
            MalTestSheet(
                template: t,
                steps: seededSteps(for: t),
                title: seededName(for: t)
            )
        }
    }

    // MARK: Seeding + persistering (2026-08-02)

    /// Prioritet: pågående redigering → enhets-lagret tilpasning → malens
    /// EKTE pondus-steg (før: hardkodede kanal-defaults selv for backend-
    /// maler) → kanal-defaults som siste utvei.
    private func seededSteps(for t: LeadbookTemplate) -> [EditableStep] {
        if let s = editedSteps[t.id] { return s }
        if let stored = MalTilpasningStore.get(for: t.id.uuidString) {
            return stored.steps.map {
                EditableStep(icon: $0.icon, iconColor: LBrand.purpleLight,
                             label: $0.label, content: $0.content,
                             charLimit: $0.charLimit, backendKey: $0.backendKey)
            }
        }
        if let dto = LeadbookLiveStore.shared.templateDTO(for: t), !dto.steps.isEmpty {
            return dto.orderedSteps.map { step in
                EditableStep(icon: step.icon ?? "circle.fill",
                             iconColor: LBrand.purpleLight,
                             label: step.title,
                             content: step.prompt ?? "",
                             charLimit: step.maxLength,
                             backendKey: step.id)
            }
        }
        return EditableStep.defaults(for: t)
    }

    private func seededName(for t: LeadbookTemplate) -> String {
        editedNames[t.id]
            ?? MalTilpasningStore.get(for: t.id.uuidString)?.name
            ?? t.name
    }

    /// Lagre redigering: alltid på enheten (overlever restart); SuperAdmin
    /// PATCHer i tillegg backend-malen (ny versjon for alle, audit-logget).
    private func persistEdit(template t: LeadbookTemplate,
                             steps newSteps: [EditableStep], name newName: String) {
        editedSteps[t.id] = newSteps
        editedNames[t.id] = newName
        MalTilpasningStore.set(
            StoredMalTilpasning(
                name: newName,
                steps: newSteps.map {
                    .init(icon: $0.icon, label: $0.label, content: $0.content,
                          charLimit: $0.charLimit, backendKey: $0.backendKey)
                }
            ),
            for: t.id.uuidString
        )
        // Hvem kan dele med teamet? SuperAdmin (globale maler) eller
        // org-leder (2026-08-02: org-scopede maler i backend — salgssjef/
        // teamleder/admin). Andre: kun enhets-lagring.
        let erOrgLeder = ["admin", "salgssjef", "teamleder"]
            .contains(appState.roleInOrg ?? "")
        guard let backendId = t.backendId, let api = appState.api,
              appState.isSuperAdmin || erOrgLeder else {
            flashToast("«\(newName)» lagret på denne iPaden")
            return
        }
        let dto = LeadbookLiveStore.shared.templateDTO(for: t)
        Task {
            let steps = newSteps.enumerated().map { idx, s in
                PondusStepDTO(
                    id: s.backendKey ?? "step-\(idx + 1)-\(UUID().uuidString.prefix(6).lowercased())",
                    title: s.label,
                    icon: s.icon,
                    prompt: s.content,
                    maxLength: s.charLimit,
                    order: idx
                )
            }
            do {
                if appState.isSuperAdmin || dto?.orgId != nil {
                    // SuperAdmin (alle maler) eller org-leder på org-egen
                    // mal → PATCH (backend håndhever eierskap).
                    var payload = UpdatePondusTemplatePayload()
                    payload.name = newName
                    payload.steps = steps
                    _ = try await api.pondusUpdateTemplate(id: backendId, payload)
                    await LeadbookLiveStore.shared.refresh()
                    flashToast(appState.isSuperAdmin
                               ? "«\(newName)» lagret for alle — ny versjon"
                               : "«\(newName)» lagret for teamet — ny versjon")
                } else {
                    // Org-leder på GLOBAL mal → opprett org-egen kopi
                    // (publiseres direkte av backend, synlig for hele org-en).
                    let payload = CreatePondusTemplatePayload(
                        name: newName,
                        description: dto?.description,
                        category: dto?.category ?? "custom",
                        kind: dto?.kind ?? "telephone",
                        score: dto?.score ?? 0,
                        steps: steps,
                        objections: dto?.objections ?? [],
                        analysis: dto?.analysis,
                        orgId: nil  // backend tvinger org fra sesjonen
                    )
                    _ = try await api.pondusCreateTemplate(payload)
                    await LeadbookLiveStore.shared.refresh()
                    flashToast("«\(newName)» lagret for teamet — org-kopi")
                }
            } catch {
                flashToast("Lagret på iPaden — team-lagring feilet")
            }
        }
    }

    // MARK: Header

    private var malerHeader: some View {
        // Leadbook-QA 2026-07-05 (iPhone): tittel + 3 knapper i én rad
        // klemte knappene til bokstavsøyler — telefon stabler og legger
        // knappene i horisontal scroller.
        let layout = DeviceIdiom.isPhone
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 14))
        return layout {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 9) {
                    Text("Leadbook — Maler")
                        .font(.appScaled(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                    Button { favorited.toggle() } label: {
                        Image(systemName: favorited ? "star.fill" : "star")
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(favorited ? LBrand.yellow : LBrand.textTertiary)
                    }.buttonStyle(.plain)
                }
                Text("Bibliotek av åpningsreplikker, oppfølginger og innvendinger — gjenbrukbart på tvers av teamet.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
            }
            if !DeviceIdiom.isPhone { Spacer(minLength: 12) }
            ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // «Importer» + «Eksporter» fjernet 2026-07-17: var døde
                // knapper — showImport hadde ingen sheet bak seg og eksport
                // var kun en toast uten CSV-flate.
                Button { showNewTemplate = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus").font(.appScaled(size: 11, weight: .bold))
                        Text("Ny mal").font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .shadow(color: LBrand.purple.opacity(0.45), radius: 6, y: 2)
                }.buttonStyle(.plain)
            }
            }
            .fixedSize(horizontal: !DeviceIdiom.isPhone, vertical: true)
        }
    }

    // MARK: Espen onboarding banner

    private var espenOnboardingBanner: some View {
        HStack(spacing: 14) {
            SmartPortrait(assetName: "portrait-espen")
                .frame(width: 64, height: 64)
                .overlay(Circle().stroke(LBrand.green.opacity(0.5), lineWidth: 2))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text("ESPEN HJELPER DEG")
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(LBrand.green).tracking(0.8)
                    Image(systemName: "checkmark.seal.fill")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(LBrand.green)
                }
                Text("Velkommen tilbake! Du har 5 maler. Ta en titt på «Tilbudsoppfølging» — den har 27 % konvertering og kan brukes oftere.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(.white)
                    .lineLimit(2)
            }
            Spacer()
            // «Se råd» fjernet 2026-07-17: var død knapp — kun toast,
            // rådet står allerede i banner-teksten.
        }
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.green.opacity(0.3), lineWidth: 1))
    }

    // MARK: Hero stats

    // Leadbook-QA 2026-07-05 (iPhone): 5 kort m/ fixedSize-labels tvang
    // ~700pt bredde → HELE Maler-siden (og søsken-radene i LeadbookView)
    // ble sentrert utenfor skjermen. Telefon: horisontal scroller m/
    // faste kort-bredder; iPad: som før.
    @ViewBuilder
    private var heroStats: some View {
        if DeviceIdiom.isPhone {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    statCards
                }
            }
        } else {
            HStack(spacing: 12) {
                statCards
            }
        }
    }

    @ViewBuilder
    private var statCards: some View {
        stat("Antall maler", "\(LeadbookData.templates.count)", LBrand.purpleLight, "doc.on.doc.fill")
        stat("Aktive", "\(activeCount)", LBrand.green, "checkmark.seal.fill")
        stat("Høy ytelse", "\(highPerfCount)", LBrand.orange, "star.fill")
        stat("Brukt 90 d", "\(totalUsed)", LBrand.blue, "person.2.fill")
        stat("Gj. konv.", "\(Int(avgConversion * 100))%", LBrand.pink, "chart.line.uptrend.xyaxis")
    }

    private func stat(_ label: String, _ value: String, _ tint: Color, _ icon: String) -> some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(tint.opacity(0.22))
                Image(systemName: icon).font(.appScaled(size: 14, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(1).fixedSize()
                Text(value)
                    .font(.appScaled(size: 18, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white).monospacedDigit()
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        // Telefon (i scroller): fast kort-bredde; iPad: flex som før.
        .frame(width: DeviceIdiom.isPhone ? 168 : nil)
        .frame(maxWidth: DeviceIdiom.isPhone ? nil : .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Search + sort + layout

    private var searchAndSort: some View {
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
                    Image(systemName: sort.icon).font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(LBrand.purpleLight)
                    Text(sort.rawValue).font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white).lineLimit(1).fixedSize()
                    Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
            }
            // Layout toggle
            HStack(spacing: 3) {
                ForEach(Layout.allCases) { l in
                    Button { layout = l } label: {
                        Image(systemName: l.icon)
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(layout == l ? .white : LBrand.textSecondary)
                            .frame(width: 36, height: 32)
                            .background(layout == l ? LBrand.purple.opacity(0.32) : .clear, in: RoundedRectangle(cornerRadius: 7))
                    }.buttonStyle(.plain)
                }
            }
            .padding(3)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
        }
    }

    // MARK: Filter chips

    private var filterChips: some View {
        VStack(alignment: .leading, spacing: 8) {
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
        Text(text).font(.appScaled(size: 9, weight: .black))
            .foregroundStyle(LBrand.textTertiary).tracking(0.6)
    }

    private func chip(text: String, icon: String?, active: Bool, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let icon { Image(systemName: icon).font(.appScaled(size: 10, weight: .bold)) }
                Text(text).font(.appScaled(size: 12, weight: .semibold))
            }
            .foregroundStyle(active ? .white : LBrand.textSecondary)
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(active ? tint.opacity(0.28) : LBrand.cardHi, in: Capsule())
            .overlay(Capsule().stroke(active ? tint.opacity(0.55) : LBrand.stroke, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    // MARK: Layouts

    private var listLayout: some View {
        VStack(spacing: 10) {
            ForEach(rows) { t in templateCard(t, compact: false) }
        }
    }

    private var gridLayout: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(rows) { t in templateCard(t, compact: true) }
        }
    }

    private func templateCard(_ t: LeadbookTemplate, compact: Bool) -> some View {
        let isSelected = selected.id == t.id
        let cast = PondusCast.forLeadbookTemplate(t)
        return Button { editingTemplate = t } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    // Portrett av "eieren" av malen + kanal-badge nederst-høyre
                    ZStack(alignment: .bottomTrailing) {
                        SmartPortrait(assetName: cast.assetName, cornerRadius: 11)
                            .frame(width: 52, height: 52)
                            .overlay(
                                RoundedRectangle(cornerRadius: 11)
                                    .stroke(t.channel.color.opacity(0.4), lineWidth: 1.5)
                            )
                        ZStack {
                            Circle().fill(t.channel.color)
                            Image(systemName: t.channel.icon)
                                .font(.appScaled(size: 8, weight: .heavy))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 18, height: 18)
                        .overlay(Circle().stroke(LBrand.bg, lineWidth: 2))
                        .offset(x: 4, y: 4)
                    }
                    .frame(width: 52, height: 52)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(t.name)
                            .font(.appScaled(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        HStack(spacing: 6) {
                            Text(t.channel.rawValue.uppercased())
                                .font(.appScaled(size: 9, weight: .black))
                                .foregroundStyle(t.channel.color)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(t.channel.color.opacity(0.16), in: Capsule())
                                .tracking(0.5)
                            statusBadge(t.status)
                            if t.isOrgMal {
                                Text("TEAM")
                                    .font(.appScaled(size: 9, weight: .black))
                                    .foregroundStyle(Color.indigo)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(Color.indigo.opacity(0.18), in: Capsule())
                                    .tracking(0.5)
                            }
                            if isSelected {
                                Text("VALGT")
                                    .font(.appScaled(size: 9, weight: .black))
                                    .foregroundStyle(LBrand.purpleLight)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(LBrand.purple.opacity(0.22), in: Capsule())
                                    .tracking(0.5)
                            }
                        }
                    }
                    Spacer(minLength: 4)
                    Menu {
                        Button { editingTemplate = t } label: { Label("Rediger", systemImage: "pencil") }
                        Button { testingTemplate = t } label: { Label("Test-modus", systemImage: "play.circle.fill") }
                        Button { selected = t; LeadbookLiveStore.shared.logUsage(t); flashToast("\(t.name) er valgt") } label: { Label("Bruk mal", systemImage: "play.fill") }
                        // «Dupliser» fjernet 2026-07-17: var død knapp — kun
                        // toast, ingen kopi ble opprettet.
                        Button {
                            UIPasteboard.general.string = "leadgrid://leadbook/\(t.id.uuidString.prefix(8))"
                            flashToast("Lenke kopiert")
                        } label: { Label("Kopier lenke", systemImage: "link") }
                        // «Eksporter PDF» (tom closure) + «Arkiver» (kun
                        // toast) fjernet 2026-07-17: var døde knapper.
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.appScaled(size: 14, weight: .bold))
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
                                Text("KONVERTERING").font(.appScaled(size: 9, weight: .black))
                                    .foregroundStyle(LBrand.textTertiary).tracking(0.5)
                                Spacer()
                                Text("\(Int(t.conversion * 100))%")
                                    .font(.appScaled(size: 12, weight: .bold, design: .rounded))
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
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(LBrand.textSecondary)
                        Label("\(t.used)", systemImage: "person.2.fill")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(LBrand.textSecondary)
                        Spacer()
                        Text("\(Int(t.conversion * 100))%")
                            .font(.appScaled(size: 13, weight: .bold, design: .rounded))
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
            Text(label).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.5)
            Text(value).font(.appScaled(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
        }
    }

    private func statusBadge(_ s: LeadbookTemplate.Status) -> some View {
        Text(s.rawValue.uppercased())
            .font(.appScaled(size: 9, weight: .black))
            .foregroundStyle(s.color)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(s.color.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(s.color.opacity(0.4), lineWidth: 1))
            .tracking(0.5)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.appScaled(size: 32)).foregroundStyle(LBrand.textTertiary)
            Text("Ingen maler matcher")
                .font(.appScaled(size: 15, weight: .bold)).foregroundStyle(.white)
            Text("Prøv et annet søk eller fjern noen filtre")
                .font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
            Button {
                query = ""; channels.removeAll(); statuses.removeAll()
            } label: {
                Text("Nullstill filtre").font(.appScaled(size: 12, weight: .bold))
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

// MARK: - EditableStep model + defaults

struct EditableStep: Identifiable, Hashable {
    let id = UUID()
    var icon: String
    var iconColor: Color
    var label: String
    var content: String
    var charLimit: Int?
    /// Pondus-stegets stabile `step_key` når steget kommer fra en backend-
    /// mal — bevares gjennom redigering så SuperAdmin-PATCH ikke bytter
    /// nøkler (varianter i pondus_content_by_step refererer dem).
    var backendKey: String? = nil

    static func defaults(for t: LeadbookTemplate) -> [EditableStep] {
        switch t.channel {
        case .phone:
            return [
                EditableStep(icon: "target", iconColor: LBrand.purpleLight, label: "Formål",
                             content: "Få interesse + avtale 15-min møte.", charLimit: nil),
                EditableStep(icon: "bubble.left.fill", iconColor: LBrand.blue, label: "Åpningsreplikk",
                             content: "Hei {navn}, jeg ringer fordi vi kan hjelpe {bedrift} med {kjerneverdi}. Har du 2 min?", charLimit: 200),
                EditableStep(icon: "questionmark.circle.fill", iconColor: LBrand.green, label: "Behovsspørsmål",
                             content: "Hva er viktigst å få til i år innen {område}?", charLimit: 150),
                EditableStep(icon: "arrow.right.circle.fill", iconColor: LBrand.orange, label: "Neste steg",
                             content: "Skal vi ta 15 min torsdag eller fredag?", charLimit: 100)
            ]
        case .email:
            return [
                EditableStep(icon: "target", iconColor: LBrand.purpleLight, label: "Formål",
                             content: "Få svar — JA, NEI eller «spør senere».", charLimit: nil),
                EditableStep(icon: "envelope.fill", iconColor: LBrand.blue, label: "Emnefelt",
                             content: "{bedrift} — 2 min til ett spørsmål?", charLimit: 60),
                EditableStep(icon: "bubble.left.fill", iconColor: LBrand.purpleLight, label: "Brødtekst",
                             content: "Hei {navn} — vi har hjulpet {lignende kunde} med {konkret resultat}. Er dette relevant?", charLimit: 200),
                EditableStep(icon: "arrow.right.circle.fill", iconColor: LBrand.orange, label: "Mikro-CTA",
                             content: "Et JA, NEI eller «spør om 2 mnd» er nok.", charLimit: 100)
            ]
        case .field:
            return [
                EditableStep(icon: "target", iconColor: LBrand.purpleLight, label: "Formål",
                             content: "Skap kontakt + bygg første tillit.", charLimit: nil),
                EditableStep(icon: "hand.wave.fill", iconColor: LBrand.green, label: "Hilsen",
                             content: "Hei! Jeg heter {ditt navn} fra {din bedrift}.", charLimit: 100),
                EditableStep(icon: "bubble.left.fill", iconColor: LBrand.blue, label: "Verdiforslag",
                             content: "Vi hjelper {kundetyper} med {kjerneverdi}.", charLimit: 150),
                EditableStep(icon: "arrow.right.circle.fill", iconColor: LBrand.orange, label: "Neste steg",
                             content: "Kan jeg sende deg litt info eller booke et kort møte?", charLimit: 150)
            ]
        case .video:
            return [
                EditableStep(icon: "target", iconColor: LBrand.purpleLight, label: "Formål",
                             content: "Etabler agenda + avdekk behov.", charLimit: nil),
                EditableStep(icon: "calendar.badge.checkmark", iconColor: LBrand.green, label: "Agenda",
                             content: "Jeg foreslår: 5 min om dere, 5 om oss, 5 om neste steg.", charLimit: 150),
                EditableStep(icon: "questionmark.circle.fill", iconColor: LBrand.blue, label: "Ramme-spørsmål",
                             content: "Hva er det viktigste å få ut av denne samtalen for dere?", charLimit: 150),
                EditableStep(icon: "arrow.right.circle.fill", iconColor: LBrand.orange, label: "Bekreft videre",
                             content: "Stemmer det vi snakker om med det dere håpet på?", charLimit: 100)
            ]
        }
    }
}

// MARK: - Enhets-persistert mal-tilpasning (2026-08-02)
//
// Pondus-malene er Leadgrid-globale — backend-PATCH er SuperAdmin-only
// (versjon-bump + audit). Lederens redigeringer var rene @State-dicts og
// FORDAMPET når fanen ble demontert. Nå: tilpasningene lagres på enheten
// (UserDefaults) så de overlever restart; SuperAdmin skriver i tillegg
// til backend (ekte ny versjon for alle).

struct StoredMalTilpasning: Codable {
    var name: String
    var steps: [StoredStep]

    struct StoredStep: Codable {
        var icon: String
        var label: String
        var content: String
        var charLimit: Int?
        var backendKey: String?
    }
}

enum MalTilpasningStore {
    private static let key = "leadgrid.maler.tilpasninger.v1"

    static func all() -> [String: StoredMalTilpasning] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([String: StoredMalTilpasning].self, from: data)
        else { return [:] }
        return decoded
    }

    static func get(for templateId: String) -> StoredMalTilpasning? {
        all()[templateId]
    }

    static func set(_ tilpasning: StoredMalTilpasning, for templateId: String) {
        var current = all()
        current[templateId] = tilpasning
        if let data = try? JSONEncoder().encode(current) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

// MARK: - MalEditorSheet — full editor m/ step-rediger + AI-foreslå + lagre + test

struct MalEditorSheet: View {
    let template: LeadbookTemplate
    @State var draftSteps: [EditableStep]
    @State var draftName: String
    var onSave: ([EditableStep], String) -> Void
    var onTest: ([EditableStep], String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var expandedStepID: UUID?
    @State private var aiBusyStepID: UUID?
    @State private var toast: String?

    private let variablePool: [String] = [
        "{navn}", "{ditt navn}", "{din bedrift}", "{bedrift}",
        "{målgruppe}", "{kjerneverdi}", "{kunde}", "{kundetyper}",
        "{lignende kunde}", "{konkret resultat}", "{område}"
    ]

    private var totalChars: Int { draftSteps.map { $0.content.count }.reduce(0, +) }
    private var hasErrors: Bool {
        draftSteps.contains { step in
            if let limit = step.charLimit { return step.content.count > limit }
            return false
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        nameEditor
                        meta
                        Text("STEG")
                            .font(.appScaled(size: 10, weight: .black))
                            .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                        VStack(spacing: 10) {
                            ForEach($draftSteps) { $step in
                                stepCard(step: $step)
                            }
                        }
                        addStepButton
                        Color.clear.frame(height: 80)
                    }
                    .padding(20)
                }
                if let t = toast {
                    VStack {
                        Spacer().frame(height: 70)
                        Label(t, systemImage: "checkmark.circle.fill")
                            .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(LBrand.green, in: Capsule())
                        Spacer()
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .navigationTitle("Rediger mal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    HStack(spacing: 8) {
                        Button {
                            onTest(draftSteps, draftName)
                            dismiss()
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "play.circle.fill").font(.appScaled(size: 12, weight: .bold))
                                Text("Test").font(.appScaled(size: 12, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(LBrand.blue, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(hasErrors)
                        Button {
                            onSave(draftSteps, draftName)
                            dismiss()
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "checkmark").font(.appScaled(size: 11, weight: .black))
                                Text("Lagre").font(.appScaled(size: 12, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                            .opacity(hasErrors ? 0.5 : 1)
                        }
                        .buttonStyle(.plain)
                        .disabled(hasErrors)
                    }
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        }
    }

    private var nameEditor: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("MAL-NAVN").font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            TextField("Navn på malen", text: $draftName)
                .font(.appScaled(size: 18, weight: .bold))
                .foregroundStyle(.white).textFieldStyle(.plain)
                .padding(12)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
        }
    }

    private var meta: some View {
        HStack(spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: template.channel.icon).font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(template.channel.color)
                Text(template.channel.rawValue).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(LBrand.card, in: Capsule())
            HStack(spacing: 6) {
                Text("\(draftSteps.count) steg").font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(LBrand.card, in: Capsule())
            HStack(spacing: 6) {
                Text("\(totalChars) tegn totalt").font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(LBrand.textSecondary)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(LBrand.card, in: Capsule())
            Spacer()
            if hasErrors {
                HStack(spacing: 5) {
                    Image(systemName: "exclamationmark.triangle.fill").font(.appScaled(size: 10))
                    Text("Char-limit overskredet").font(.appScaled(size: 10, weight: .bold))
                }
                .foregroundStyle(LBrand.red)
                .padding(.horizontal, 9).padding(.vertical, 4)
                .background(LBrand.red.opacity(0.15), in: Capsule())
            }
        }
    }

    private func stepCard(step: Binding<EditableStep>) -> some View {
        let isExpanded = expandedStepID == step.id
        let overLimit = (step.wrappedValue.charLimit ?? Int.max) < step.wrappedValue.content.count
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(step.wrappedValue.iconColor.opacity(0.22))
                    Image(systemName: step.wrappedValue.icon)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(step.wrappedValue.iconColor)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 4) {
                    TextField("Steg-tittel", text: step.label)
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .textFieldStyle(.plain)
                    if !isExpanded {
                        Text(step.wrappedValue.content)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(LBrand.textSecondary)
                            .lineLimit(2)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    if let limit = step.wrappedValue.charLimit {
                        Text("\(step.wrappedValue.content.count)/\(limit)")
                            .font(.appScaled(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(overLimit ? LBrand.red : LBrand.textTertiary)
                    }
                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            expandedStepID = isExpanded ? nil : step.id
                        }
                    } label: {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(LBrand.textTertiary)
                    }.buttonStyle(.plain)
                }
            }
            .padding(12)

            if isExpanded {
                VStack(alignment: .leading, spacing: 10) {
                    Divider().overlay(LBrand.stroke).padding(.horizontal, 12)
                    TextEditor(text: step.content)
                        .font(.appScaled(size: 13))
                        .foregroundStyle(.white)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 90, maxHeight: 200)
                        .padding(.horizontal, 8).padding(.vertical, 6)
                        .background(LBrand.bg.opacity(0.5), in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.stroke, lineWidth: 1))
                        .padding(.horizontal, 12)
                    // Variable chips
                    VStack(alignment: .leading, spacing: 5) {
                        Text("SETT INN VARIABEL").font(.appScaled(size: 9, weight: .black))
                            .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(variablePool, id: \.self) { v in
                                    Button {
                                        insertVariable(v, into: step)
                                    } label: {
                                        Text(v)
                                            .font(.appScaled(size: 10, weight: .semibold, design: .monospaced))
                                            .foregroundStyle(LBrand.purpleLight)
                                            .padding(.horizontal, 8).padding(.vertical, 4)
                                            .background(LBrand.purple.opacity(0.15), in: Capsule())
                                            .overlay(Capsule().stroke(LBrand.purple.opacity(0.35), lineWidth: 1))
                                    }.buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 12)
                    // Actions
                    HStack(spacing: 8) {
                        Button { aiSuggest(for: step) } label: {
                            HStack(spacing: 5) {
                                if aiBusyStepID == step.id {
                                    ProgressView().tint(.white).scaleEffect(0.7)
                                } else {
                                    Image(systemName: "sparkles").font(.appScaled(size: 10, weight: .bold))
                                }
                                Text(aiBusyStepID == step.id ? "Foreslår…" : "AI-foreslå sterkere")
                                    .font(.appScaled(size: 11, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(aiBusyStepID != nil)
                        Spacer()
                        Button(role: .destructive) {
                            draftSteps.removeAll { $0.id == step.id }
                            expandedStepID = nil
                        } label: {
                            Image(systemName: "trash")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(LBrand.red)
                                .padding(8)
                                .background(LBrand.red.opacity(0.12), in: Circle())
                        }.buttonStyle(.plain)
                    }
                    .padding(.horizontal, 12).padding(.bottom, 12)
                }
            }
        }
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(
            isExpanded ? LBrand.purple.opacity(0.35)
                       : overLimit ? LBrand.red.opacity(0.45) : LBrand.stroke, lineWidth: 1
        ))
    }

    private var addStepButton: some View {
        Button {
            let new = EditableStep(icon: "circle.fill", iconColor: LBrand.purpleLight, label: "Nytt steg", content: "", charLimit: 200)
            draftSteps.append(new)
            withAnimation { expandedStepID = new.id }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "plus").font(.appScaled(size: 11, weight: .bold))
                Text("Legg til steg").font(.appScaled(size: 12, weight: .semibold))
            }
            .foregroundStyle(LBrand.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(LBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .foregroundStyle(LBrand.stroke)
            )
        }.buttonStyle(.plain)
    }

    private func insertVariable(_ v: String, into step: Binding<EditableStep>) {
        let current = step.content.wrappedValue
        let needsSpace = !current.isEmpty && !current.hasSuffix(" ") && !current.hasSuffix("\n")
        step.content.wrappedValue = current + (needsSpace ? " " : "") + v
    }

    // 2026-08-02: var hardkodede regex-erstatningspar merket som «AI» —
    // nå ekte: LeadbookPhrasingIntelligence (on-device Apple Intelligence
    // når mulig, ellers backend-Claude bak leadbookAiStruktur-entitlement).
    // Ved feil røres teksten ALDRI — ærlig toast i stedet.
    private func aiSuggest(for step: Binding<EditableStep>) {
        guard aiBusyStepID == nil else { return }
        let original = step.content.wrappedValue
        let limit = step.charLimit.wrappedValue
        guard original.trimmingCharacters(in: .whitespacesAndNewlines).count >= 10 else {
            flash("Skriv litt tekst først — AI-en trenger noe å styrke")
            return
        }
        guard let api = appState.api else {
            flash("AI utilgjengelig — ikke innlogget mot backend")
            return
        }
        aiBusyStepID = step.id
        Task { @MainActor in
            defer { aiBusyStepID = nil }
            do {
                let intel = LeadbookExampleIntelligenceFactory.makePhrasing(api: api)
                let result = try await intel.strengthen(text: original, charLimit: limit)
                step.content.wrappedValue = result.suggestion
                flash(result.source == .onDevice
                      ? "AI foreslo sterkere formulering — på enheten"
                      : "AI foreslo sterkere formulering")
            } catch {
                let msg = String(describing: error)
                if msg.contains("entitlement_locked") {
                    flash("AI er ikke aktivert for organisasjonen — lås opp «Leadbook AI» i SuperAdmin-matrisen")
                } else if msg.contains("krever_leder_rolle") {
                    flash("AI-forslag krever leder-rolle")
                } else {
                    flash("AI-forslaget feilet — teksten er uendret")
                }
            }
        }
    }

    private func flash(_ text: String) {
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
            if toast == text { toast = nil }
        }
    }
}

// MARK: - MalTestSheet — interaktiv simulasjon av samtale

struct MalTestSheet: View {
    let template: LeadbookTemplate
    let steps: [EditableStep]
    let title: String
    @Environment(\.dismiss) private var dismiss

    @State private var currentStepIdx: Int = 0
    @State private var transcript: [TestLine] = []
    @State private var kundeReply: String = ""
    @State private var startedAt = Date()
    @State private var elapsed: Int = 0
    @State private var showCheatNote = false

    struct TestLine: Identifiable {
        let id = UUID()
        let isSelger: Bool
        let text: String
    }

    private let stubReplies: [String] = [
        "Ja, jeg har 2 min.",
        "Vi vurderer faktisk det nå.",
        "Det er litt dyrt for oss.",
        "Send meg info på e-post.",
        "Hva er sammenligningen?",
        "OK, send forslag."
    ]

    private var currentStep: EditableStep? {
        guard currentStepIdx < steps.count else { return nil }
        return steps[currentStepIdx]
    }
    private func substituted(_ raw: String) -> String {
        var s = raw
        let stub: [(String, String)] = [
            ("{navn}", "Marit"), ("{ditt navn}", "Lars"), ("{din bedrift}", "Leadgrid"),
            ("{bedrift}", "Acme AS"), ("{kjerneverdi}", "kortere salgssykluser"),
            ("{målgruppe}", "B2B-salgsteam"), ("{kunde}", "Skanska"),
            ("{kundetyper}", "ledende norske entreprenører"),
            ("{lignende kunde}", "NorthSea Logistics"),
            ("{konkret resultat}", "18 % flere møter"),
            ("{område}", "salgsproduktivitet")
        ]
        for (k, v) in stub { s = s.replacingOccurrences(of: k, with: v) }
        return s
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                if DeviceIdiom.isPhone {
                    // iPhone: steg-panelet som kompakt topp-seksjon (egen
                    // intern scroll), samtalen under — 320pt-sidebaren får
                    // ikke plass ved siden av simulatoren på compact width.
                    VStack(spacing: 0) {
                        sidebarSteps.frame(height: 280)
                        Divider().overlay(LBrand.stroke)
                        callSimulator
                    }
                } else {
                    HStack(spacing: 0) {
                        callSimulator
                        Divider().overlay(LBrand.stroke)
                        sidebarSteps.frame(width: 320)
                    }
                }
            }
            .navigationTitle("Test-modus")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text(title).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        HStack(spacing: 6) {
                            Image(systemName: template.channel.icon).font(.appScaled(size: 9))
                            Text("TEST · \(formatTime(elapsed))").font(.appScaled(size: 10, design: .monospaced))
                        }
                        .foregroundStyle(template.channel.color)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { showCheatNote.toggle() } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "doc.text.fill").font(.appScaled(size: 11, weight: .bold))
                            Text("Cheat note").font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(Color(red: 0.98, green: 0.78, blue: 0.20), in: Capsule())
                    }.buttonStyle(.plain)
                }
            }
            .onAppear { startTimer() }
        }
    }

    private var callSimulator: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if transcript.isEmpty {
                        VStack(spacing: 10) {
                            Image(systemName: "play.circle.fill")
                                .font(.appScaled(size: 48, weight: .semibold))
                                .foregroundStyle(LBrand.green)
                            Text("Start samtalen ved å lese steg 1 høyt")
                                .font(.appScaled(size: 13))
                                .foregroundStyle(LBrand.textSecondary)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 40)
                    }
                    ForEach(transcript) { line in
                        HStack {
                            if !line.isSelger { Spacer(minLength: 50) }
                            Text(line.text)
                                .font(.appScaled(size: 13, design: .serif))
                                .foregroundStyle(.white)
                                .padding(11)
                                .background(
                                    line.isSelger ? LBrand.purple.opacity(0.25) : LBrand.cardHi,
                                    in: RoundedRectangle(cornerRadius: 12)
                                )
                            if line.isSelger { Spacer(minLength: 50) }
                        }
                    }
                }
                .padding(20)
            }
            // Kunde-respons + neste-steg
            VStack(spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "person.fill").foregroundStyle(LBrand.textTertiary)
                    TextField("Kundens svar (eller velg en stub under)…", text: $kundeReply)
                        .foregroundStyle(.white).textFieldStyle(.plain)
                    Button {
                        if !kundeReply.isEmpty {
                            transcript.append(TestLine(isSelger: false, text: kundeReply))
                            kundeReply = ""
                        }
                    } label: {
                        Image(systemName: "paperplane.fill")
                            .font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(kundeReply.isEmpty ? LBrand.textTertiary : LBrand.green)
                    }.buttonStyle(.plain).disabled(kundeReply.isEmpty)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(stubReplies, id: \.self) { r in
                            Button {
                                transcript.append(TestLine(isSelger: false, text: r))
                            } label: {
                                Text(r).font(.appScaled(size: 11, weight: .semibold))
                                    .foregroundStyle(LBrand.textSecondary)
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(LBrand.cardHi, in: Capsule())
                                    .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
                            }.buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 20).padding(.bottom, 16)
        }
    }

    private var sidebarSteps: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Kunde-rolle: Helena
            HStack(spacing: 12) {
                SmartPortrait(assetName: "portrait-helena")
                    .frame(width: 44, height: 44)
                    .overlay(Circle().stroke(LBrand.orange.opacity(0.5), lineWidth: 1.5))
                VStack(alignment: .leading, spacing: 2) {
                    Text("KUNDE-ROLLE").font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(LBrand.orange).tracking(0.6)
                    Text("Helena Bjørnson")
                        .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                    Text("Innkjøpssjef, skeptisk")
                        .font(.appScaled(size: 10)).foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                Circle().fill(LBrand.green).frame(width: 8, height: 8)
            }
            .padding(14)
            .background(LBrand.card)
            Divider().overlay(LBrand.stroke)
            VStack(alignment: .leading, spacing: 6) {
                Text("DINE STEG").font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Text("Tap for å si denne replikken")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
            .padding(14)
            Divider().overlay(LBrand.stroke)
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(steps.indices, id: \.self) { idx in
                        let step = steps[idx]
                        let isDone = transcript.contains { $0.isSelger && $0.text == substituted(step.content) }
                        Button {
                            transcript.append(TestLine(isSelger: true, text: substituted(step.content)))
                            currentStepIdx = idx + 1
                        } label: {
                            HStack(alignment: .top, spacing: 10) {
                                ZStack {
                                    Circle().fill(isDone ? LBrand.green : step.iconColor.opacity(0.22))
                                    if isDone {
                                        Image(systemName: "checkmark").font(.appScaled(size: 11, weight: .black))
                                            .foregroundStyle(.white)
                                    } else {
                                        Image(systemName: step.icon).font(.appScaled(size: 11, weight: .bold))
                                            .foregroundStyle(step.iconColor)
                                    }
                                }
                                .frame(width: 28, height: 28)
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack(spacing: 5) {
                                        Text("\(idx + 1)").font(.appScaled(size: 10, weight: .bold, design: .monospaced))
                                            .foregroundStyle(LBrand.textTertiary)
                                        Text(step.label).font(.appScaled(size: 12, weight: .bold))
                                            .foregroundStyle(.white)
                                    }
                                    Text(substituted(step.content))
                                        .font(.appScaled(size: 11, design: .serif))
                                        .foregroundStyle(LBrand.textSecondary)
                                        .lineLimit(3)
                                }
                                Spacer()
                            }
                            .padding(10)
                            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(isDone ? LBrand.green.opacity(0.4) : LBrand.stroke, lineWidth: 1))
                        }.buttonStyle(.plain)
                    }
                }
                .padding(14)
            }
        }
        .background(LBrand.bg)
    }

    private func formatTime(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }
    private func startTimer() {
        elapsed = 0
        tick()
    }
    private func tick() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            elapsed += 1
            tick()
        }
    }
}
