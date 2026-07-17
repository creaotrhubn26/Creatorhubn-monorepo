// AssignAreaSheet.swift
//
// Modal for å tildele/omfordele områder til team-medlemmer.
// 3 modus:
//   - Tildel eksisterende: overfør et eksisterende område til ny eier
//   - Fra kommune-katalog: velg en norsk kommune fra liste
//   - Tegn nytt: long-press på kart for å plassere polygon-hjørner
//
// Sluttsteg: velg eier-medlem + lokasjon-notat + varsle-toggle + Bekreft.

import SwiftUI
import MapKit

struct AssignAreaSheet: View {
    let preselectedMember: TeamMember?         // hvis åpnet fra SellerPerformanceModal
    @Environment(\.dismiss) private var dismiss

    @Environment(AppState.self) private var appState

    @State private var mode: Mode = .catalog
    @State private var selectedKommune: KartverketService.KommuneInfo?
    @State private var selectedTeam: LeadgridSalesTeam?
    @State private var selectedExistingTerritory: GeoJSONTerritory?
    @State private var drawnPoints: [CLLocationCoordinate2D] = []
    @State private var pencilOnly: Bool = false              // filter ut finger-touch i tegne-modus
    @State private var selectedMember: TeamMember?
    @State private var notifyMember: Bool = true
    @State private var handoffNote: String = ""

    // Ekte kommune-katalog fra Kartverket (via backend-proxy, 2026-07-05).
    // Gjelder BEGGE moduser — katalogen er offentlige data, ikke org-data.
    @State private var kommuneListe: [KartverketService.KommuneInfo] = []
    @State private var kommuneSearch: String = ""
    @State private var loadingKommuner: Bool = true

    init(preselectedMember: TeamMember? = nil) {
        self.preselectedMember = preselectedMember
        _selectedMember = State(initialValue: preselectedMember)
    }

    enum Mode: String, CaseIterable, Hashable {
        case catalog = "Kommune"
        case tettsted = "Tettsted"
        case existing = "Eksisterende"
        case draw = "Tegn nytt"
        var icon: String {
            switch self {
            case .catalog:  return "list.bullet.rectangle.fill"
            case .tettsted: return "building.2.fill"
            case .existing: return "arrow.left.arrow.right"
            case .draw:     return "pencil.tip"
            }
        }
    }

    // ─── Tettsted-modus (2026-07-17): SSB tettbygde strøk under kommune-
    // nivå. Teamleder/salgssjef tildeler tettsted til SELGER — lagres som
    // ekte lead_territories-rad (polygon) via POST /territories, så
    // matching/dekning/brudd-logg virker uten ny logikk.
    @State private var tettsteder: [APIClient.TettstedDTO] = []
    @State private var loadingTettsteder = false
    @State private var tettstedFeil: String?
    @State private var selectedTettsted: APIClient.TettstedDTO?
    @State private var selectedSelgerDTO: SalesTeamMemberDTO?

    /// Tettsted-fordeling er leder-domene (samme katalog som Salgsledelse-
    /// vakten); backend håndhever i tillegg territories.manage + entitlement.
    private var isLeder: Bool {
        ["admin", "salgssjef", "teamleder"].contains(appState.roleInOrg ?? "")
    }

    /// Moduser synlige for innlogget rolle — selgere ser ikke Tettsted.
    private var availableModes: [Mode] {
        isLeder ? Mode.allCases : Mode.allCases.filter { $0 != .tettsted }
    }

    /// Kommuner filtrert på søk. Uten søk vises hele katalogen (~357);
    /// LazyVStack holder det billig.
    private var filtrerteKommuner: [KartverketService.KommuneInfo] {
        let q = kommuneSearch.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return kommuneListe }
        return kommuneListe.filter {
            $0.navn.localizedCaseInsensitiveContains(q) || $0.nummer.hasPrefix(q)
        }
    }

    /// Team som allerede eier en gitt kommune (fra team-storen).
    private func eier(av kommune: KartverketService.KommuneInfo) -> LeadgridSalesTeam? {
        LeadgridSalesTeamStore.shared.teams.first {
            $0.areaKommunenummer == kommune.nummer
        }
    }

    private var canConfirm: Bool {
        switch mode {
        case .catalog:  return selectedKommune != nil && selectedTeam != nil
        case .tettsted:
            return selectedTettsted != nil
                && (DemoModeManager.isActiveNonisolated || selectedSelgerDTO != nil)
        case .existing: return selectedMember != nil && selectedExistingTerritory != nil
        case .draw:     return selectedMember != nil && drawnPoints.count >= 3
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    modePicker
                    Group {
                        switch mode {
                        case .catalog:  catalogSection
                        case .tettsted: tettstedSection.gated(.omradeTildeling)
                        case .existing: existingSection
                        case .draw:     drawSection
                        }
                    }
                    if mode == .catalog {
                        teamPicker
                    } else if mode == .tettsted {
                        tettstedSelgerPicker
                    } else {
                        memberPicker
                        if selectedMember != nil { notifyCard; handoffCard }
                    }
                    Color.clear.frame(height: 100)
                }
                .padding(20)
            }
            .background(TBrand.bg.ignoresSafeArea())
            .navigationTitle("Tildel område")
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
            .task {
                guard let api = appState.api else {
                    loadingKommuner = false
                    return
                }
                kommuneListe = await KartverketService.shared.fetchKommuneListe(using: api)
                loadingKommuner = false
            }
        }
    }

    // MARK: Mode-picker

    private var modePicker: some View {
        HStack(spacing: 5) {
            ForEach(availableModes, id: \.self) { m in
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { mode = m }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: m.icon)
                            .font(.appScaled(size: 10, weight: .bold))
                        Text(m.rawValue)
                            .font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(mode == m ? .white : TBrand.textSecondary)
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(
                        mode == m ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(Color.clear),
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

    // MARK: Catalog-modus

    private var catalogSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Velg kommune",
                         subtitle: "Offisiell katalog fra Kartverket — teamet får den ekte kommunegrensen på kartet")
            // Søkefelt — 357 kommuner uten søk er uhåndterlig
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(TBrand.textSecondary)
                TextField("Søk kommune eller kommunenummer", text: $kommuneSearch)
                    .font(.appScaled(size: 13))
                    .foregroundStyle(.white)
                    .autocorrectionDisabled()
                if !kommuneSearch.isEmpty {
                    Button {
                        kommuneSearch = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.appScaled(size: 13))
                            .foregroundStyle(TBrand.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))

            if loadingKommuner {
                HStack(spacing: 8) {
                    ProgressView().tint(TBrand.purpleLight)
                    Text("Laster kommune-katalogen fra Kartverket …")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(TBrand.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else if kommuneListe.isEmpty {
                Text("Fikk ikke lastet kommune-katalogen — sjekk nettverket og prøv igjen")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else if filtrerteKommuner.isEmpty {
                Text("Ingen kommuner matcher «\(kommuneSearch)»")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            }
            LazyVStack(spacing: 6) {
                ForEach(filtrerteKommuner) { k in kommuneRow(k) }
            }
        }
    }

    private func kommuneRow(_ k: KartverketService.KommuneInfo) -> some View {
        let isSelected = selectedKommune?.nummer == k.nummer
        let eierTeam = eier(av: k)
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selectedKommune = k }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9)
                        .fill((eierTeam != nil ? TBrand.orange : TBrand.green).opacity(0.22))
                    Image(systemName: "mappin.and.ellipse")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(eierTeam != nil ? TBrand.orange : TBrand.green)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(k.navn)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Kommunenr. \(k.nummer)")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                        .monospacedDigit()
                }
                Spacer()
                if let eierTeam {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("EIER")
                            .font(.appScaled(size: 8, weight: .black))
                            .foregroundStyle(TBrand.textTertiary)
                            .tracking(0.5)
                        Text(eierTeam.name)
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(eierTeam.color)
                            .lineLimit(1)
                    }
                } else {
                    Text("LEDIG")
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(TBrand.green)
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(TBrand.green.opacity(0.18), in: Capsule())
                        .overlay(Capsule().stroke(TBrand.green.opacity(0.4), lineWidth: 1))
                }
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.appScaled(size: 16))
                    .foregroundStyle(isSelected ? TBrand.purpleLight : TBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? TBrand.purple.opacity(0.10) : TBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? TBrand.purple.opacity(0.5) : TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Existing-modus

    private var existingSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Velg eksisterende område", subtitle: "Overfør eierskap til en annen selger")
            VStack(spacing: 6) {
                ForEach(GeoJSONLoader.loadTerritories()) { t in
                    existingRow(t)
                }
            }
        }
    }

    private func existingRow(_ t: GeoJSONTerritory) -> some View {
        let isSelected = selectedExistingTerritory?.areaName == t.areaName
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selectedExistingTerritory = t }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(Color(t.color))
                    Image(systemName: "mappin.and.ellipse")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.areaName)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 4) {
                        Text("Nåværende eier:")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(TBrand.textSecondary)
                        Text(t.memberName)
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(Color(t.color))
                    }
                }
                Spacer()
                if isSelected, let target = selectedMember {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.right")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(TBrand.purpleLight)
                        Text(target.name.split(separator: " ").first.map(String.init) ?? target.name)
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 7).padding(.vertical, 4)
                    .background(TBrand.purple.opacity(0.20), in: Capsule())
                }
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.appScaled(size: 16))
                    .foregroundStyle(isSelected ? TBrand.purpleLight : TBrand.stroke)
            }
            .padding(10)
            .background(
                isSelected ? TBrand.purple.opacity(0.10) : TBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? TBrand.purple.opacity(0.5) : TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Draw-modus

    private var drawSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                sectionTitle("Tegn nytt område",
                             subtitle: pencilOnly
                                ? "Dra med Apple Pencil for å tegne fritt omriss"
                                : "Tap for å plassere hjørner, eller dra m/ Apple Pencil for å tegne fritt")
                Spacer()
                Button {
                    withAnimation { pencilOnly.toggle() }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "applepencil.tip")
                            .font(.appScaled(size: 11, weight: .bold))
                        Text(pencilOnly ? "Bare Pencil" : "Finger + Pencil")
                            .font(.appScaled(size: 10, weight: .bold))
                    }
                    .foregroundStyle(pencilOnly ? .white : TBrand.purpleLight)
                    .padding(.horizontal, 9).padding(.vertical, 6)
                    .background(
                        pencilOnly ? AnyShapeStyle(TBrand.purple) : AnyShapeStyle(TBrand.purple.opacity(0.15)),
                        in: Capsule()
                    )
                    .overlay(Capsule().stroke(TBrand.purple.opacity(pencilOnly ? 0 : 0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            DrawableMapView(points: $drawnPoints,
                            previewColor: selectedMember?.color ?? TBrand.purpleLight,
                            pencilOnly: pencilOnly)
                .frame(height: 280)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
            if pencilOnly {
                HStack(spacing: 8) {
                    Image(systemName: "applepencil.tip")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(TBrand.purpleLight)
                    Text("Pencil-modus aktiv — finger-touch ignoreres på kartet")
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(TBrand.purpleLight)
                    Spacer()
                }
                .padding(8)
                .background(TBrand.purple.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(TBrand.purple.opacity(0.35), lineWidth: 1))
            }
            HStack(spacing: 8) {
                Button {
                    withAnimation { if !drawnPoints.isEmpty { drawnPoints.removeLast() } }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.uturn.backward")
                            .font(.appScaled(size: 11, weight: .bold))
                        Text("Angre")
                            .font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(TBrand.card, in: Capsule())
                    .overlay(Capsule().stroke(TBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(drawnPoints.isEmpty)
                Button {
                    withAnimation { drawnPoints.removeAll() }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "trash")
                            .font(.appScaled(size: 11, weight: .bold))
                        Text("Tøm")
                            .font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(TBrand.red)
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(TBrand.red.opacity(0.12), in: Capsule())
                    .overlay(Capsule().stroke(TBrand.red.opacity(0.35), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(drawnPoints.isEmpty)
                Spacer()
                Text("\(drawnPoints.count) punkter")
                    .font(.appScaled(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(drawnPoints.count >= 3 ? TBrand.green : TBrand.orange)
                    .monospacedDigit()
            }
        }
    }

    // MARK: Team-picker (kommune-modus)

    /// Kommune tildeles et TEAM (LeadgridSalesTeamStore) — det er teamene
    /// som tegnes på Team-kartet, og tildelingen lagres på teamet
    /// (area_kommunenummer, mig 0369).
    private var teamPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Tildel til team", subtitle: "Teamet får kommunen som sitt område på kartet")
            if LeadgridSalesTeamStore.shared.teams.isEmpty {
                Text("Ingen team enda — opprett et team fra Team-fanen først")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            }
            LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 1, iPad: 2, mac: 2, spacing: 8), spacing: 8) {
                ForEach(LeadgridSalesTeamStore.shared.teams) { team in teamCard(team) }
            }
        }
    }

    private func teamCard(_ team: LeadgridSalesTeam) -> some View {
        let isSelected = selectedTeam?.id == team.id
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selectedTeam = team }
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(team.color.opacity(0.85))
                    Text(team.initials)
                        .font(.appScaled(size: 11, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(team.name)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(teamOmradeTekst(team))
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 16))
                        .foregroundStyle(team.color)
                }
            }
            .padding(10)
            .background(
                isSelected ? team.color.opacity(0.12) : TBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? team.color.opacity(0.55) : TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func teamOmradeTekst(_ team: LeadgridSalesTeam) -> String {
        if let navn = team.areaKommuneNavn {
            return "Har \(navn) i dag"
        }
        if let r = team.areaRadiusKm {
            return "Har \(Int(r.rounded())) km sone i dag"
        }
        return "Ingen område enda"
    }

    // MARK: Member-picker

    private var memberPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Tildel til", subtitle: "Velg ansvarlig team-medlem")
            // iPhone: 1 kolonne — kortene har navn + område + checkmark og
            // trunkeres hardt på halv sheet-bredde.
            LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 1, iPad: 2, mac: 2, spacing: 8), spacing: 8) {
                ForEach(TeamData.members) { m in memberCard(m) }
                newMemberCard
            }
        }
    }

    private func memberCard(_ m: TeamMember) -> some View {
        let isSelected = selectedMember?.id == m.id
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selectedMember = m }
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(m.color.opacity(0.85))
                    Text(m.initials)
                        .font(.appScaled(size: 11, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(m.name)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(m.area)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 16))
                        .foregroundStyle(m.color)
                }
            }
            .padding(10)
            .background(
                isSelected ? m.color.opacity(0.12) : TBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(RoundedRectangle(cornerRadius: 11)
                .stroke(isSelected ? m.color.opacity(0.55) : TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var newMemberCard: some View {
        Button { TeamStubActions.toast("Inviter ny selger") } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(TBrand.purple.opacity(0.22))
                    Image(systemName: "person.badge.plus")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(TBrand.purpleLight)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Inviter ny selger")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Sender invitt-e-post")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(TBrand.purpleLight)
            }
            .padding(10)
            .background(TBrand.purple.opacity(0.10),
                        in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(TBrand.purple.opacity(0.40), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Notify + handoff

    private var notifyCard: some View {
        Toggle(isOn: $notifyMember) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(TBrand.green.opacity(0.22))
                    Image(systemName: "envelope.fill")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(TBrand.green)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Varsle \(selectedMember?.name.split(separator: " ").first.map(String.init) ?? "selger")")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Sender e-post + push m/ områdedetaljer")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(TBrand.textSecondary)
                }
            }
        }
        .tint(TBrand.purple)
        .padding(11)
        .background(TBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TBrand.stroke, lineWidth: 1))
    }

    private var handoffCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Overlevering-notat (valgfritt)")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(TBrand.textSecondary)
            ZStack(alignment: .topLeading) {
                TextEditor(text: $handoffNote)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.appScaled(size: 12))
                    .frame(minHeight: 70)
                    .padding(8)
                    .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
                if handoffNote.isEmpty {
                    Text("F.eks. nøkkel-leads, bransjefokus, eller forhandlingshistorikk")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(TBrand.textTertiary)
                        .padding(.horizontal, 12).padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    // MARK: Tettsted-modus

    @ViewBuilder
    private var tettstedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Tildel tettsted til selger",
                         subtitle: "SSBs offisielle tettbygde strøk — finere fordeling innenfor teamets kommune")
            if let k = selectedKommune {
                // Valgt kommune-header m/ bytt-knapp
                HStack(spacing: 10) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.appScaled(size: 15, weight: .semibold))
                        .foregroundStyle(TBrand.purpleLight)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(k.navn)
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        Text("Kommune \(k.nummer)")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(TBrand.textSecondary)
                    }
                    Spacer()
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            selectedKommune = nil
                            selectedTettsted = nil
                            tettsteder = []
                            tettstedFeil = nil
                        }
                    } label: {
                        Text("Bytt")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(TBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
                .padding(12)
                .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))

                if loadingTettsteder {
                    HStack(spacing: 8) {
                        ProgressView().tint(TBrand.purpleLight)
                        Text("Henter tettsteder fra SSB …")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(TBrand.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                } else if let feil = tettstedFeil {
                    Text(feil)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.55))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                } else if tettsteder.isEmpty {
                    Text("Ingen tettsteder registrert i \(k.navn)")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.55))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                } else {
                    LazyVStack(spacing: 6) {
                        ForEach(tettsteder) { t in tettstedRow(t) }
                    }
                }
            } else {
                // Steg 1: velg kommune (gjenbruker katalog-søket)
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(TBrand.textSecondary)
                    TextField("Søk kommune eller kommunenummer", text: $kommuneSearch)
                        .font(.appScaled(size: 13))
                        .foregroundStyle(.white)
                        .autocorrectionDisabled()
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
                LazyVStack(spacing: 6) {
                    ForEach(filtrerteKommuner) { k in
                        Button {
                            withAnimation(.easeInOut(duration: 0.15)) { selectedKommune = k }
                            Task { await loadTettsteder(for: k) }
                        } label: {
                            HStack {
                                Text(k.navn)
                                    .font(.appScaled(size: 13, weight: .semibold))
                                    .foregroundStyle(.white)
                                Spacer()
                                Text(k.nummer)
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(TBrand.textTertiary)
                                    .monospacedDigit()
                            }
                            .padding(.horizontal, 12).padding(.vertical, 11)
                            .background(TBrand.card, in: RoundedRectangle(cornerRadius: 10))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func tettstedRow(_ t: APIClient.TettstedDTO) -> some View {
        let isSelected = selectedTettsted?.tettNr == t.tettNr
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selectedTettsted = t }
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(TBrand.purple.opacity(isSelected ? 0.35 : 0.16))
                    Image(systemName: "building.2.fill")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(TBrand.purpleLight)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(t.navn)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    if let bef = t.befolkning {
                        Text("\(bef.formatted(.number.grouping(.automatic))) innbyggere")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(TBrand.textSecondary)
                    }
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(TBrand.purpleLight)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(
                isSelected ? TBrand.purple.opacity(0.14) : TBrand.card,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? TBrand.purple.opacity(0.5) : TBrand.stroke, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Selger-picker for tettsted-modus: EKTE teammedlemmer (team-members-
    /// endepunktet) med backend-bruker-id — tildelingen trenger id-en.
    /// Demo-modus viser hint i stedet for å late som den tildeler.
    @ViewBuilder
    private var tettstedSelgerPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Velg selger",
                         subtitle: "Tettstedet legges som selgerens område — matching, dekning og brudd-logg følger automatisk")
            if DemoModeManager.isActiveNonisolated {
                Text("Demo-modus: tildelingen lagres ikke. Skru av demo for ekte fordeling.")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(TBrand.orange)
            } else if TeamLiveStore.shared.memberDTOs.isEmpty {
                Text("Ingen teammedlemmer lastet enda — åpne Team-fanen først, eller sjekk nettverket.")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
            } else {
                LazyVStack(spacing: 6) {
                    ForEach(TeamLiveStore.shared.memberDTOs) { dto in
                        let isSel = selectedSelgerDTO?.userId == dto.userId
                        Button {
                            withAnimation(.easeInOut(duration: 0.15)) { selectedSelgerDTO = dto }
                        } label: {
                            HStack(spacing: 10) {
                                ZStack {
                                    Circle().fill(TBrand.purple.opacity(0.25))
                                    Text(dto.name.split(separator: " ").prefix(2)
                                        .map { String($0.prefix(1)) }.joined().uppercased())
                                        .font(.appScaled(size: 11, weight: .bold))
                                        .foregroundStyle(TBrand.purpleLight)
                                }
                                .frame(width: 32, height: 32)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(dto.name)
                                        .font(.appScaled(size: 13, weight: .bold))
                                        .foregroundStyle(.white)
                                    Text(dto.title ?? "Selger")
                                        .font(.appScaled(size: 10))
                                        .foregroundStyle(TBrand.textSecondary)
                                }
                                Spacer()
                                if isSel {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.appScaled(size: 15, weight: .bold))
                                        .foregroundStyle(TBrand.purpleLight)
                                }
                            }
                            .padding(.horizontal, 12).padding(.vertical, 10)
                            .background(
                                isSel ? TBrand.purple.opacity(0.14) : TBrand.card,
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(isSel ? TBrand.purple.opacity(0.5) : TBrand.stroke, lineWidth: 1)
                            )
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .task {
            // Attach er idempotent — sørger for at teamlisten finnes selv om
            // Team-fanen ikke er besøkt i økten.
            guard !DemoModeManager.isActiveNonisolated else { return }
            if let api = appState.api {
                TeamLiveStore.shared.attach(api: api, appState: appState)
            }
        }
    }

    private func loadTettsteder(for kommune: KartverketService.KommuneInfo) async {
        guard let api = appState.api else { return }
        loadingTettsteder = true
        tettstedFeil = nil
        do {
            tettsteder = try await api.fetchTettsteder(kommunenummer: kommune.nummer)
        } catch {
            // 403 = entitlement/rolle; ellers nettverk/oppstrøm.
            tettstedFeil = "Fikk ikke hentet tettsteder — sjekk tilgang (feature-matrisen) eller nettverk."
            tettsteder = []
        }
        loadingTettsteder = false
    }

    // MARK: Confirm-bar

    private var confirmBar: some View {
        Button { confirm() } label: {
            HStack(spacing: 7) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.appScaled(size: 14, weight: .bold))
                Text(confirmLabel)
                    .font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: canConfirm
                                ? [TBrand.purple, TBrand.purpleLight]
                                : [TBrand.cardHi, TBrand.cardHi],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(canConfirm ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!canConfirm)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(TBrand.bg.opacity(0.95).overlay(Rectangle().fill(TBrand.stroke).frame(height: 1), alignment: .top))
    }

    private var confirmLabel: String {
        if mode == .catalog {
            guard let team = selectedTeam else { return "Velg team først" }
            if let k = selectedKommune { return "Tildel \(k.navn) til \(team.name)" }
            return "Velg kommune"
        }
        if mode == .tettsted {
            guard let t = selectedTettsted else { return "Velg tettsted" }
            if DemoModeManager.isActiveNonisolated { return "Tildel \(t.navn) (demo)" }
            guard let s = selectedSelgerDTO else { return "Velg selger" }
            let first = s.name.split(separator: " ").first.map(String.init) ?? s.name
            return "Tildel \(t.navn) til \(first)"
        }
        guard let m = selectedMember else { return "Velg medlem først" }
        let first = m.name.split(separator: " ").first.map(String.init) ?? m.name
        switch mode {
        case .catalog, .tettsted:
            return "Velg kommune"
        case .existing:
            if let t = selectedExistingTerritory { return "Overfør \(t.areaName) til \(first)" }
            return "Velg eksisterende område"
        case .draw:
            if drawnPoints.count >= 3 { return "Tildel nytt område til \(first)" }
            return "Tegn minst 3 punkter"
        }
    }

    /// Bekreft tildelingen. Kommune-modus persisterer på teamet (lokal
    /// store + backend-push via upsert); tettsted-modus oppretter ekte
    /// lead_territories-rad (2026-07-17); existing/draw er fortsatt
    /// visuelle konsepter uten backend-modell.
    private func confirm() {
        if mode == .catalog, let k = selectedKommune, var team = selectedTeam {
            team.areaKommunenummer = k.nummer
            team.areaKommuneNavn = k.navn
            LeadgridSalesTeamStore.shared.upsert(team)
            TeamStubActions.toast("\(k.navn) tildelt \(team.name)")
        }
        if mode == .tettsted, let t = selectedTettsted {
            if DemoModeManager.isActiveNonisolated {
                TeamStubActions.toast("\(t.navn) tildelt (demo — lagres ikke)")
            } else if let dto = selectedSelgerDTO, let api = appState.api {
                let orgId = appState.activeOrganizationId ?? ""
                Task {
                    do {
                        _ = try await api.createTettstedTerritory(
                            organizationId: orgId,
                            tettsted: t,
                            assignedUserId: dto.userId
                        )
                        TeamStubActions.toast("Tettstedet \(t.navn) tildelt \(dto.name)")
                    } catch {
                        TeamStubActions.toast("Kunne ikke tildele \(t.navn) — prøv igjen")
                    }
                }
            }
        }
        dismiss()
    }

    private func sectionTitle(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Text(subtitle)
                .font(.appScaled(size: 11))
                .foregroundStyle(TBrand.textSecondary)
        }
    }

}

// MARK: - DrawableMapView (tap = legg til polygon-hjørne)

struct DrawableMapView: UIViewRepresentable {
    @Binding var points: [CLLocationCoordinate2D]
    let previewColor: Color
    let pencilOnly: Bool

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.overrideUserInterfaceStyle = .dark
        map.pointOfInterestFilter = .excludingAll
        map.showsCompass = false
        map.showsScale = false
        map.isPitchEnabled = false
        let conf = MKStandardMapConfiguration(elevationStyle: .flat, emphasisStyle: .muted)
        conf.pointOfInterestFilter = .excludingAll
        map.preferredConfiguration = conf
        map.setRegion(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 59.920, longitude: 10.780),
            span: MKCoordinateSpan(latitudeDelta: 0.30, longitudeDelta: 0.55)
        ), animated: false)
        map.delegate = context.coordinator
        context.coordinator.map = map
        context.coordinator.onSetPoints = { points = $0 }
        context.coordinator.onAppendPoint = { points.append($0) }

        // Tap-gesture: legg til ett hjørne
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tap.delegate = context.coordinator
        map.addGestureRecognizer(tap)
        context.coordinator.tapGesture = tap

        // Pan-gesture: kontinuerlig free-form tegning (Apple Pencil-vennlig)
        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
        pan.maximumNumberOfTouches = 1
        pan.delegate = context.coordinator
        map.addGestureRecognizer(pan)
        context.coordinator.panGesture = pan

        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.previewColor = UIColor(previewColor)
        context.coordinator.pencilOnly = pencilOnly

        // Når pencilOnly er PÅ: tillat bare pencil-touch
        if pencilOnly {
            context.coordinator.tapGesture?.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
            context.coordinator.panGesture?.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
            // Slå av map-pan/zoom så pencil kan tegne fritt (ellers fanger map gester)
            map.isScrollEnabled = false
            map.isZoomEnabled = false
            map.isRotateEnabled = false
        } else {
            context.coordinator.tapGesture?.allowedTouchTypes = [
                NSNumber(value: UITouch.TouchType.direct.rawValue),
                NSNumber(value: UITouch.TouchType.pencil.rawValue)
            ]
            context.coordinator.panGesture?.allowedTouchTypes = [
                NSNumber(value: UITouch.TouchType.pencil.rawValue)  // pan er ALLTID pencil-bare
            ]
            map.isScrollEnabled = true
            map.isZoomEnabled = true
            map.isRotateEnabled = true
        }

        // Refresh overlays + annotations
        map.removeOverlays(map.overlays)
        map.removeAnnotations(map.annotations)
        if points.count >= 3 {
            map.addOverlay(MKPolygon(coordinates: points, count: points.count), level: .aboveRoads)
        } else if points.count == 2 {
            map.addOverlay(MKPolyline(coordinates: points, count: points.count))
        }
        for (i, p) in points.enumerated() {
            let ann = DrawPointAnnotation(coordinate: p, index: i + 1)
            map.addAnnotation(ann)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
        weak var map: MKMapView?
        weak var tapGesture: UITapGestureRecognizer?
        weak var panGesture: UIPanGestureRecognizer?
        var onAppendPoint: ((CLLocationCoordinate2D) -> Void)?
        var onSetPoints: (([CLLocationCoordinate2D]) -> Void)?
        var previewColor: UIColor = .systemPurple
        var pencilOnly: Bool = false

        private var samplingBuffer: [CLLocationCoordinate2D] = []
        private var lastSampleTime: TimeInterval = 0

        // La tap + pan kjøre uavhengig av map's egne gester
        func gestureRecognizer(_ gr: UIGestureRecognizer,
                                shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let map = map else { return }
            let point = gesture.location(in: map)
            let coord = map.convert(point, toCoordinateFrom: map)
            onAppendPoint?(coord)
        }

        @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
            guard let map = map else { return }
            let location = gesture.location(in: map)
            let coord = map.convert(location, toCoordinateFrom: map)
            switch gesture.state {
            case .began:
                samplingBuffer = [coord]
                lastSampleTime = CACurrentMediaTime()
            case .changed:
                // Throttle: maks 1 punkt per 50ms for å holde polygon-density rimelig
                let now = CACurrentMediaTime()
                if now - lastSampleTime > 0.05 {
                    samplingBuffer.append(coord)
                    lastSampleTime = now
                    onSetPoints?(samplingBuffer)
                }
            case .ended:
                // Forenkle path: hold maks ~30 punkter
                if samplingBuffer.count > 30 {
                    let step = max(1, samplingBuffer.count / 28)
                    samplingBuffer = stride(from: 0, to: samplingBuffer.count, by: step).map { samplingBuffer[$0] }
                }
                onSetPoints?(samplingBuffer)
            default: break
            }
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let poly = overlay as? MKPolygon {
                let r = MKPolygonRenderer(polygon: poly)
                r.fillColor = previewColor.withAlphaComponent(0.45)
                r.strokeColor = previewColor
                r.lineWidth = 3
                r.lineJoin = .round
                return r
            }
            if let line = overlay as? MKPolyline {
                let r = MKPolylineRenderer(polyline: line)
                r.strokeColor = previewColor
                r.lineWidth = 2.5
                r.lineDashPattern = [6, 4]
                return r
            }
            return MKOverlayRenderer(overlay: overlay)
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let ann = annotation as? DrawPointAnnotation else { return nil }
            let id = "DrawPoint"
            let view = (mapView.dequeueReusableAnnotationView(withIdentifier: id) as? DrawPointView)
                ?? DrawPointView(annotation: ann, reuseIdentifier: id)
            view.configure(index: ann.index, color: previewColor)
            return view
        }
    }
}

final class DrawPointAnnotation: NSObject, MKAnnotation {
    let coordinate: CLLocationCoordinate2D
    let index: Int
    init(coordinate: CLLocationCoordinate2D, index: Int) {
        self.coordinate = coordinate
        self.index = index
    }
}

final class DrawPointView: MKAnnotationView {
    private let label = UILabel()

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setupUI()
    }
    required init?(coder: NSCoder) { fatalError() }

    private func setupUI() {
        backgroundColor = .clear
        canShowCallout = false
        label.font = .systemFont(ofSize: 10, weight: .black)
        label.textColor = .white
        label.textAlignment = .center
        label.layer.cornerRadius = 11
        label.layer.borderWidth = 1.5
        label.layer.borderColor = UIColor.white.cgColor
        label.clipsToBounds = false
        addSubview(label)
        label.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
            label.widthAnchor.constraint(equalToConstant: 22),
            label.heightAnchor.constraint(equalToConstant: 22),
        ])
        frame = CGRect(x: 0, y: 0, width: 22, height: 22)
        centerOffset = .zero
    }

    func configure(index: Int, color: UIColor) {
        label.text = "\(index)"
        label.backgroundColor = color
        label.layer.cornerRadius = 11
        label.layer.masksToBounds = true
    }
}
