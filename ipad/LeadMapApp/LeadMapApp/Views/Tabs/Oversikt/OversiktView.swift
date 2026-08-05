// OversiktView.swift
//
// Pixel-perfect iPad-dashboard (Daniel-mockup 2026-06-28). Layout matcher
// marketing-mocken eksakt: header med 3 pickers, 5 KPI-kort horisontalt,
// to-kolonne grid (venstre 55%: kart + pipeline + aktivitet, høyre 45%:
// neste handlinger + chart-rad + siste aktiviteter), tips-banner nederst.
//
// Data hentes fra eksisterende AppState + APIClient — ingen nye
// backend-endepunkter:
//   • leads:       AppState.leads (polling kjører allerede)
//   • metrics:     fetchMomentumToday + fetchPipelineForecast
//   • lead-score:  beregnes lokalt fra leads-arrayet
//
// Pin-design (LeadPinView.swift) er IKKE rørt — Daniel: "pinsene vi har
// kan du beholde". KART-thumbnail i LeadsInAreaCard reuser SwiftUI Map
// med disabled-interaksjon + en "Åpne kart"-CTA.

import SwiftUI
import MapKit
import Charts
import PhotosUI

// MARK: - Brand-konstanter (matcher mockup + LeadPinView)

// Notification-navn brukes til å propagere område-valg fra HeaderRow ned
// til OversiktView + LeadsInAreaCard uten å hoiste state gjennom private-
// struct-hierarkiet.
extension Notification.Name {
    static let oversiktAreaChanged = Notification.Name("oversiktAreaChanged")
    static let oversiktDateChanged = Notification.Name("oversiktDateChanged")
    /// Bruker trykket «Les mer» i map-pin-overlay-en → naviger til Leads-
    /// fanen og åpne full detalj-visning for denne lead-en.
    static let oversiktRequestOpenLeadInLeadsTab = Notification.Name("oversiktRequestOpenLeadInLeadsTab")
    /// Ny oppfølging ble lagret (fra NewFollowUpSheet). userInfo:
    /// { "leadName": String, "date": Date }.
    static let oversiktFollowUpCreated = Notification.Name("oversiktFollowUpCreated")
}

private enum Brand {
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

struct OversiktView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var hSize
    @State private var demo = DemoModeManager.shared

    @State private var momentum: LeadgridMomentum?
    @State private var forecast: LeadgridForecast?
    @State private var loading = false
    @State private var lastUpdated: Date?
    /// Dørsalg-oversikt (2026-07-18): aggregat fra leadgrid_dorsalg_status.
    @State private var dorsalgStats: KartverketService.DorsalgStats?

    /// Org har dørsalg-modus eksplisitt på (feature-matrisen, fail-closed).
    private var dorsalgAktivert: Bool {
        EntitlementStore.shared.isExplicitlyEnabled(.dorsalgModus)
    }
    /// REN dørsalg-org (leads låst i profilen): Oversikt byttes helt ut —
    /// bedrifts-KPI-ene og lead-kartet er meningsløse for dem.
    private var erRenDorsalgOrg: Bool {
        EntitlementStore.shared.erRenDorsalgOrg
    }
    // Header-state + kalender-quick-actions eies nå av LeadgridTabHeader
    // (Views/Tabs/Shared/LeadgridTabHeader.swift) — delt av alle faner.

    /// iPhone-kompakt = bottom-tabs + enkelt-kolonne (alt under hverandre).
    private var isCompact: Bool { hSize == .compact }

    /// Demo-modus: bytt ut prod-leads med 50 mock-leads spredt i Oslo så
    /// KPI-tiles, kart og lister fylles opp. Når av: bruk ekte data fra
    /// AppState. Sjekkes per gjengivelse — Observable trigger redraw.
    private var effectiveLeads: [LeadModel] {
        demo.isActive ? demo.mockLeads : appState.leads
    }

    /// Undertekst speiler aktivt prosjekt så konteksten synes også i
    /// tittelraden (brede skjermer) — pillen i headeren er switcheren.
    private var headerSubtitle: String {
        if erRenDorsalgOrg {
            return "Full kontroll over dørene: vunnet, avslått og innsatsen i dag."
        }
        if let id = appState.activeProjectId {
            let name = appState.projects.first(where: { $0.id == id })?.name
                ?? appState.activeProjectSummary?.project.name
            if let name {
                return "Prosjekt: \(name) — leads, aktiviteter og resultater."
            }
        }
        return "Få full kontroll over dine leads, aktiviteter og resultater."
    }

    var body: some View {
        contentBody
            // Lytter på «Les mer»-request fra map-lead-overlay → bytt
            // til Leads-fanen. Selve detalj-sheet-en åpnes av
            // Leads-fanen når den observerer samme Notification.
            .onReceive(NotificationCenter.default.publisher(
                for: .oversiktRequestOpenLeadInLeadsTab
            )) { _ in
                appState.selectedSidebarItem = .leads
            }
            .task {
                guard !DemoModeManager.isActiveNonisolated,
                      let api = appState.api else { return }
                if let p = try? await api.hentOversiktPolicy() { oversiktPolicy = p }
            }
    }

    // ── Tilpassbar Oversikt (2026-08-05): hvert kort kan kollapses og
    //    velges bort. Hierarki: admin styrer salgsleders kort («leder»-
    //    policy), salgsleder styrer selgernes («selger»-policy), og alle
    //    tilpasser personlig utvalg INNENFOR policyen (lokalt lagret).
    enum OversiktKort: String, CaseIterable {
        case kpi
        case dorsalg
        case nesteHandling = "neste_handling"
        case oppgaver
        case leads

        var tittel: String {
            switch self {
            case .kpi: return "Nøkkeltall"
            case .dorsalg: return "Dørsalg"
            case .nesteHandling: return "Neste handling"
            case .oppgaver: return "Oppgaver fra møtene"
            case .leads: return "Leads i området"
            }
        }
    }
    @AppStorage("oversikt.skjul.kpi") private var skjulKpi = false
    @AppStorage("oversikt.skjul.dorsalg") private var skjulDorsalg = false
    @AppStorage("oversikt.skjul.neste_handling") private var skjulNeste = false
    @AppStorage("oversikt.skjul.oppgaver") private var skjulOppgaver = false
    @AppStorage("oversikt.skjul.leads") private var skjulLeads = false
    @State private var oversiktPolicy = OversiktPolicyDTO()

    private var erAdminRolle: Bool {
        appState.isSuperAdmin || ["admin", "owner"].contains(appState.roleInOrg ?? "")
    }
    private var erLederRolle: Bool {
        erAdminRolle || ["markedssjef", "salgssjef", "teamleder"].contains(appState.roleInOrg ?? "")
    }
    /// Kort nivået OVER meg har skjult for mitt nivå (admin styres ikke).
    private var policySkjultForMeg: Set<String> {
        if erAdminRolle { return [] }
        return Set(erLederRolle ? oversiktPolicy.leder : oversiktPolicy.selger)
    }
    private func personligSkjult(_ k: OversiktKort) -> Binding<Bool> {
        switch k {
        case .kpi: return Binding(get: { skjulKpi }, set: { skjulKpi = $0 })
        case .dorsalg: return Binding(get: { skjulDorsalg }, set: { skjulDorsalg = $0 })
        case .nesteHandling: return Binding(get: { skjulNeste }, set: { skjulNeste = $0 })
        case .oppgaver: return Binding(get: { skjulOppgaver }, set: { skjulOppgaver = $0 })
        case .leads: return Binding(get: { skjulLeads }, set: { skjulLeads = $0 })
        }
    }
    private func kortSynlig(_ k: OversiktKort) -> Bool {
        !policySkjultForMeg.contains(k.rawValue) && !personligSkjult(k).wrappedValue
    }
    /// Leder-/admin-toggle: skriver policy for målgruppen (PUT, best effort).
    private func policyBinding(_ k: OversiktKort, gruppe: String) -> Binding<Bool> {
        Binding(
            get: {
                let liste = gruppe == "selger" ? oversiktPolicy.selger : oversiktPolicy.leder
                return !liste.contains(k.rawValue)
            },
            set: { synlig in
                var liste = gruppe == "selger" ? oversiktPolicy.selger : oversiktPolicy.leder
                if synlig {
                    liste.removeAll { $0 == k.rawValue }
                } else if !liste.contains(k.rawValue) {
                    liste.append(k.rawValue)
                }
                if gruppe == "selger" { oversiktPolicy.selger = liste }
                else { oversiktPolicy.leder = liste }
                guard !DemoModeManager.isActiveNonisolated,
                      let api = appState.api else { return }
                Task { try? await api.lagreOversiktPolicy(malgruppe: gruppe, skjulteKort: liste) }
            })
    }

    private var tilpassMeny: some View {
        Menu {
            Section("Min oversikt") {
                ForEach(OversiktKort.allCases, id: \.self) { k in
                    if !policySkjultForMeg.contains(k.rawValue) {
                        Toggle(k.tittel, isOn: Binding(
                            get: { !personligSkjult(k).wrappedValue },
                            set: { personligSkjult(k).wrappedValue = !$0 }))
                    }
                }
            }
            if erLederRolle {
                Section("Selgernes oversikt") {
                    ForEach(OversiktKort.allCases, id: \.self) { k in
                        Toggle(k.tittel, isOn: policyBinding(k, gruppe: "selger"))
                    }
                }
            }
            if erAdminRolle {
                Section("Salgsledernes oversikt") {
                    ForEach(OversiktKort.allCases, id: \.self) { k in
                        Toggle(k.tittel, isOn: policyBinding(k, gruppe: "leder"))
                    }
                }
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "slider.horizontal.3")
                    .font(.appScaled(size: 11, weight: .bold))
                Text("Tilpass")
                    .font(.appScaled(size: 12, weight: .bold))
            }
            .foregroundStyle(Brand.textSecondary)
            .padding(.horizontal, 11).padding(.vertical, 7)
            .background(Brand.card, in: Capsule())
            .overlay(Capsule().stroke(Brand.stroke, lineWidth: 1))
        }
    }

    private var contentBody: some View {
        GeometryReader { geo in
            let isPortrait = geo.size.width < geo.size.height
            // Dynamisk kart-høyde: fyll resten av vinduet under header + KPI-
            // rad + padding. På Mac Catalyst med store vinduer gir dette
            // kartet ~1000+px, mens iPad landscape holder ~640px minimum.
            // Konstantene: header (~60) + KPI (~120) + spacing (~68) + padding
            // (~42) = ~290pt. Vi bruker 320 som konservativ margin.
            // iPhone: 640pt minimum tvinger unødig scrolling (portrett-
            // vindu er ~844, landskap ~390) — bruk lavere gulv så kartet
            // følger tilgjengelig høyde i stedet.
            let minMapHeight: CGFloat = DeviceIdiom.isPhone ? 420 : Self.mapHeight
            let dynamicMapHeight = max(minMapHeight, geo.size.height - 320)

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    LeadgridTabHeader(
                        subtitle: headerSubtitle,
                        leads: effectiveLeads,
                        momentum: momentum,
                        lastUpdated: lastUpdated) {
                            // Tydelig prosjekt-kontekst (2026-08-02): pill
                            // viser + bytter hvilket prosjekt tallene på
                            // fanen gjelder.
                            ProjectContextPill()
                        }
                    HStack { Spacer(); tilpassMeny }
                    if erRenDorsalgOrg {
                        // Ren dørsalg-org: HELE oversikten er dørsalg-tall.
                        AnyView(DorsalgOversiktSection(stats: dorsalgStats))
                    } else {
                    if kortSynlig(.kpi) {
                        KPICardRow(leads: effectiveLeads, momentum: momentum, forecast: forecast,
                                   compact: isCompact || isPortrait)
                    }
                    // Hybrid-org (dørsalg + bedrifter): dørsalg-tallene som
                    // egen seksjon oppå bedrifts-dashbordet.
                    if dorsalgAktivert && kortSynlig(.dorsalg) {
                        AnyView(DorsalgOversiktSection(stats: dorsalgStats))
                    }
                    // Oversikt = beslutningsskjermen (Daniel 2026-08-04):
                    // kartet bodde både her og på Kart-fanen — duplikatet
                    // fjernet. Rekkefølgen er «hva gjør jeg nå?»-prioritert:
                    // neste møte/forfalte → oppgaver → kompakt leads-liste
                    // med hopp til Kart for alt kart-arbeid.
                    if kortSynlig(.nesteHandling) {
                        NextActionCard(leads: effectiveLeads)
                    }
                    if kortSynlig(.oppgaver) {
                        MoteOppgaverCard()
                    }
                    if kortSynlig(.leads) {
                        LeadsOversiktCard(leads: effectiveLeads)
                    }
                    }   // slutt ikke-dørsalg-gren
                    Spacer(minLength: 12)
                }
                .padding(.horizontal, isCompact ? 16 : 28)
                .padding(.top, 18)
                .padding(.bottom, 24)
            }
            .background(Brand.bg.ignoresSafeArea())
        }
        .navigationBarHidden(true)
        .task { await initialLoad() }
        .refreshable { await refresh() }
    }

    // MARK: - Layouts

    // Map-first dashboard (Daniel-konsolidering 2026-06-28):
    // KPI-rad + STORT kart fyller hele Oversikt. Alt analyse-innhold
    // (Pipeline, Trend, Aktivitet, NextActions, Lead score) er flyttet
    // til header-popovers eller kart-overlay, så brukerens øye kan
    // hvile på leadene i området.
    private static let mapHeight: CGFloat = 640

    private var twoColumnLayout: some View {
        // minHeight = tidligere fast høyde (iPad-baseline). maxHeight
        // .infinity gir Mac Catalyst-vinduer og andre store skjermer
        // rom til å strekke kartet ned til bunn av tilgjengelig plass.
        LeadsInAreaCard(leads: effectiveLeads)
            .frame(minHeight: Self.mapHeight, maxHeight: .infinity)
    }

    private var singleColumnLayout: some View {
        LeadsInAreaCard(leads: effectiveLeads)
            .frame(minHeight: 600, maxHeight: .infinity)
    }

    // Portrait iPad (~1024 bred): full-bredde rader gir hvert kort
    // ~960px arbeidsplass = god lesbarhet uten å klemme widgets.
    //
    // Rytme:
    //   1) Stort kart (400px) — full bredde
    //   2) Neste handlinger — full bredde, 4 rader (kompakt)
    //   3) 2×2 grid for 4 widget-kort (Pipeline+Aktivitet over,
    //      LeadsOverTime+Donut under) — alle 340px høye
    //
    // Spacing-rytme: 24px mellom rader (i stedet for 20 som i landscape)
    // for å gi pust på den lengre vertikale flaten.
    private var portraitLayout: some View {
        LeadsInAreaCard(leads: effectiveLeads)
            .frame(height: 720)
    }

    // MARK: - Data

    private func initialLoad() async {
        if momentum == nil && forecast == nil { await refresh() }
    }

    private func refresh() async {
        loading = true
        defer { loading = false }
        // Dørsalg-stats (kun når org-en har modusen): demo = statiske tall,
        // ekte = aggregat fra backend (mig 0397).
        if dorsalgAktivert || DemoModeManager.isActiveNonisolated {
            if DemoModeManager.isActiveNonisolated {
                if dorsalgAktivert { dorsalgStats = Self.demoDorsalgStats }
            } else if let api = appState.api {
                dorsalgStats = await KartverketService.shared.fetchDorsalgStats(using: api)
            }
        }
        // Pakke 10: bind til prod-APIClient sine ekte endepunkter
        // (/api/leadgrid/momentum/today + /api/leadgrid/forecasting/pipeline).
        // Hvis api ikke er tilgjengelig (kun før login fullført), eller backend
        // svarer med feil, beholdes momentum/forecast som nil — KPI-rader degraderes
        // gracefulst.
        guard let api = appState.api else {
            await MainActor.run { self.lastUpdated = Date() }
            return
        }
        // Team-store sync (idempotent) — backend er fasit for team-oppsettet.
        LeadgridSalesTeamStore.shared.attach(api: api)
        // Team-medlemmer (idempotent) — trengs for ekte «Tildel til
        // teammedlem»-liste og TopSellers-leaderboard når demo er AV.
        TeamLiveStore.shared.attach(api: api, appState: appState)
        async let momTask: LeadgridMomentum? = try? api.fetchMomentumToday()
        async let fcTask: LeadgridForecast? = try? api.fetchPipelineForecast()
        let (mom, fc) = await (momTask, fcTask)
        await MainActor.run {
            self.momentum = mom
            self.forecast = fc
            self.lastUpdated = Date()
        }
    }

    /// Demo-tall for dørsalg-seksjonen (aldri backend i demo).
    private static let demoDorsalgStats = KartverketService.DorsalgStats(
        vunnet: 47, avslatt: 118, iDag: 23, vunnetIDag: 6, denneUka: 96,
        meg: .init(vunnet: 6, avslatt: 14, iDag: 9, denneUka: 31),
        perProdukt: [
            .init(produktId: "demo-p1", navn: "SOS Barnebyer", vunnet: 27, avslatt: 61),
            .init(produktId: "demo-p2", navn: "Kirkens Bymisjon", vunnet: 20, avslatt: 57),
        ],
        perSelger: [
            .init(navn: "Espen Berg", vunnet: 16, avslatt: 31, verdi: 7050),
            .init(navn: "Helena Dahl", vunnet: 13, avslatt: 28, verdi: 5610),
            .init(navn: "Lars Erik Moen", vunnet: 10, avslatt: 33, verdi: 4320),
            .init(navn: "Marit Johansen", vunnet: 8, avslatt: 26, verdi: 3480),
        ],
        sisteVunnet: [
            .init(adressetekst: "Industriveien 8D", postnummer: "1461", poststed: "LØRENSKOG", settAt: ""),
            .init(adressetekst: "Solheimveien 44", postnummer: "1473", poststed: "LØRENSKOG", settAt: ""),
            .init(adressetekst: "Skårersletta 18", postnummer: "1473", poststed: "LØRENSKOG", settAt: ""),
        ], dagsmal: 3, budsjett: nil)
}

// MARK: - Dørsalg-oversikt (2026-07-18)

/// Dørsalg-tall i Oversikt: KPI-tiles + siste vunnede dører + per selger.
/// Ren dørsalg-org får denne som HELE oversikten; hybrid-org får den som
/// seksjon oppå bedrifts-dashbordet.
private struct DorsalgOversiktSection: View {
    let stats: KartverketService.DorsalgStats?
    @AppStorage("oversikt.kollaps.dorsalg") private var kollapset = false

    private var hitRate: Int? {
        guard let s = stats, s.vunnet + s.avslatt > 0 else { return nil }
        return Int((Double(s.vunnet) / Double(s.vunnet + s.avslatt) * 100).rounded())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 7) {
                Image(systemName: "door.left.hand.open")
                    .foregroundStyle(Brand.purpleLight)
                Text("Dørsalg").font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
                Spacer()
                Text("Fra utfallene på kartet")
                    .font(.appScaled(size: 9)).foregroundStyle(Brand.textTertiary)
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { kollapset.toggle() }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(Brand.textSecondary)
                        .rotationEffect(.degrees(kollapset ? -90 : 0))
                        .frame(width: 26, height: 26)
                        .background(Brand.cardHi, in: Circle())
                }
                .buttonStyle(.plain)
            }
            if !kollapset {
            if let s = stats, s.vunnet + s.avslatt + s.iDag > 0 {
                HStack(spacing: 10) {
                    tile("\(s.vunnet)", "Vunnet", Brand.green)
                    tile("\(s.avslatt)", "Avslått", Brand.red)
                    tile("\(s.iDag)", "Dører i dag", Brand.purpleLight)
                    tile("\(s.denneUka)", "Denne uka", Brand.blue)
                    if let hr = hitRate { tile("\(hr) %", "Hit-rate", Brand.orange) }
                }
                // KPI per produkt (SOS Barnebyer, Kirkens Bymisjon, …) —
                // selgere ser kun produktene de er satt på (backend-filtrert).
                if let produkter = s.perProdukt, !produkter.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Per produkt")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(Brand.textSecondary)
                        ForEach(produkter) { p in
                            HStack(spacing: 8) {
                                Image(systemName: "shippingbox.fill")
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(Brand.purpleLight)
                                Text(p.navn)
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white).lineLimit(1)
                                Spacer()
                                Text("\(p.vunnet) vunnet")
                                    .font(.appScaled(size: 11, weight: .bold))
                                    .foregroundStyle(Brand.green).monospacedDigit()
                                Text("\(p.avslatt) avslått")
                                    .font(.appScaled(size: 11, weight: .semibold))
                                    .foregroundStyle(Brand.red).monospacedDigit()
                                if p.vunnet + p.avslatt > 0 {
                                    Text("\(Int((Double(p.vunnet) / Double(p.vunnet + p.avslatt) * 100).rounded())) %")
                                        .font(.appScaled(size: 10, weight: .bold))
                                        .foregroundStyle(Brand.orange).monospacedDigit()
                                }
                            }
                        }
                    }
                }
                if !s.sisteVunnet.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Siste vunnede dører")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(Brand.textSecondary)
                        ForEach(s.sisteVunnet.prefix(5)) { d in
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.appScaled(size: 12)).foregroundStyle(Brand.green)
                                Text(d.adressetekst)
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white).lineLimit(1)
                                Text("\(d.postnummer) \(d.poststed)")
                                    .font(.appScaled(size: 10))
                                    .foregroundStyle(Brand.textSecondary).lineLimit(1)
                                Spacer()
                            }
                        }
                    }
                }
                if !s.perSelger.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Per selger")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(Brand.textSecondary)
                        ForEach(s.perSelger.prefix(6)) { sel in
                            HStack(spacing: 8) {
                                Text(sel.navn)
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white).lineLimit(1)
                                Spacer()
                                Text("\(sel.vunnet) vunnet")
                                    .font(.appScaled(size: 11, weight: .bold))
                                    .foregroundStyle(Brand.green).monospacedDigit()
                                Text("\(sel.avslatt) avslått")
                                    .font(.appScaled(size: 11, weight: .semibold))
                                    .foregroundStyle(Brand.red).monospacedDigit()
                            }
                        }
                    }
                }
            } else {
                Text("Ingen dører registrert enda. Utfall du setter i dørsalg-modus på kartet (Vunnet kunde / Avslått) lander her.")
                    .font(.appScaled(size: 11)).foregroundStyle(Brand.textSecondary)
            }
            }
        }
        .padding(14)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.purple.opacity(0.3), lineWidth: 1))
    }

    private func tile(_ value: String, _ label: String, _ tint: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.appScaled(size: 17, weight: .black, design: .rounded))
                .foregroundStyle(.white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.appScaled(size: 8, weight: .semibold)).foregroundStyle(tint)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 11)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - KPI-row (5 kort)

private struct KPICardRow: View {
    let leads: [LeadModel]
    let momentum: LeadgridMomentum?
    let forecast: LeadgridForecast?
    var compact: Bool = false  // Bytter til 2-rad grid på smalere skjermer

    @State private var showStatsModal = false

    @ViewBuilder
    var body: some View {
        // Alle idiomer (Daniel 2026-07-05): én kompakt statistikk-knapp
        // med kortene i modal — iPad-gridene tok for mye vertikal plass
        // og iPhone-mønsteret fungerer like godt der.
        statsButton
            .sheet(isPresented: $showStatsModal) { statsModal }
    }

    // ── iPhone: kompakt statistikk-knapp + modal ─────────────────────

    private var statsButton: some View {
        Button {
            showStatsModal = true
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Brand.purple.opacity(0.22))
                    Image(systemName: "chart.bar.fill")
                        // Fast 40pt-flis — ikonet skal ikke AX-skalere
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Brand.purple)
                }
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Statistikk")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    // Én sammensatt Text (ikke HStack) så underteksten
                    // wrapper som tekst på AX-størrelser. Trenden er
                    // hardkodet mockup — vises KUN i demo-modus.
                    (Text("\(formatNumber(totalLeads)) leads")
                        .font(.appScaled(size: 12))
                        .foregroundColor(Brand.textSecondary)
                     + Text(DemoModeManager.isActiveNonisolated && totalLeads > 0 ? "  ↑ +18%" : "")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundColor(Brand.green))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
            }
            .padding(14)
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var statsModal: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Statistikk")
                    .font(.appScaled(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 18)

                totalLeadsCard.frame(maxWidth: .infinity)
                hotLeadsCard.frame(maxWidth: .infinity)
                followupsCard.frame(maxWidth: .infinity)
                expectedValueCard.frame(maxWidth: .infinity)
                wonCard.frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
        .background(Brand.bg.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // Trend-pille: vis kun når vi har en faktisk verdi å trende fra.
    // Pakke 10: før vi har historikk-data fra backend bruker vi de tidligere
    // hardkodede preview-verdiene KUN når tall > 0. Da slipper vi den
    // misvisende "0 leads / +18% vs forrige periode"-tomme tilstanden.
    private var totalLeadsCard: some View {
        KPICard(
            icon: "person.2.fill", iconBg: Brand.blue.opacity(0.25), iconColor: Brand.blue,
            label: "Total leads",
            value: formatNumber(totalLeads),
            trend: DemoModeManager.isActiveNonisolated && totalLeads > 0 ? "+18%" : nil,
            trendUp: DemoModeManager.isActiveNonisolated && totalLeads > 0 ? true : nil)
    }
    private var hotLeadsCard: some View {
        KPICard(
            icon: "flame.fill", iconBg: Brand.red.opacity(0.25), iconColor: Brand.red,
            label: "Hot leads",
            value: "\(hotLeads)",
            trend: DemoModeManager.isActiveNonisolated && hotLeads > 0 ? "+24%" : nil,
            trendUp: DemoModeManager.isActiveNonisolated && hotLeads > 0 ? true : nil)
    }
    private var followupsCard: some View {
        KPICard(
            icon: "bell.fill", iconBg: Brand.orange.opacity(0.25), iconColor: Brand.orange,
            label: "Oppfølginger i dag",
            value: "\(followupsToday)",
            trend: nil, trendUp: nil)
    }
    private var expectedValueCard: some View {
        let hasValue = (forecast?.predictedRevenueMid ?? 0) > 0 ||
                       leads.contains(where: { ($0.estimatedValue ?? 0) > 0 })
        return KPICard(
            icon: "chart.line.uptrend.xyaxis", iconBg: Brand.purple.opacity(0.25),
            iconColor: Brand.purple,
            label: "Forventet verdi",
            value: forecastValue,
            trend: DemoModeManager.isActiveNonisolated && hasValue ? "+15%" : nil,
            trendUp: DemoModeManager.isActiveNonisolated && hasValue ? true : nil)
    }
    private var wonCard: some View {
        let wonCount = leads.filter { $0.status == .won }.count
        return KPICard(
            icon: "trophy.fill", iconBg: Brand.green.opacity(0.25), iconColor: Brand.green,
            label: "Vunnet i år",
            value: wonValue,
            trend: DemoModeManager.isActiveNonisolated && wonCount > 0 ? "+32%" : nil,
            trendUp: DemoModeManager.isActiveNonisolated && wonCount > 0 ? true : nil)
    }

    private var totalLeads: Int { leads.count }
    private var hotLeads: Int { leads.filter { ($0.leadScore ?? 0) >= 70 || $0.status == .meetingBooked }.count }
    private var followupsToday: Int {
        let cal = Calendar.current
        return leads.filter { lead in
            guard let next = lead.nextFollowUpAt else { return false }
            return cal.isDateInToday(next)
        }.count
    }
    private var forecastValue: String {
        let total = forecast?.predictedRevenueMid ?? Double(leads.reduce(0) { $0 + Int($1.estimatedValue ?? 0) })
        return formatNOK(total)
    }
    private var wonValue: String {
        let won = leads.filter { $0.status == .won }.reduce(0.0) { $0 + ($1.estimatedValue ?? 0) }
        return formatNOK(won)
    }
    private func formatNumber(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }
    private func formatNOK(_ v: Double) -> String {
        if v >= 1_000_000 {
            return String(format: "NOK %.1f mill.", v / 1_000_000.0)
                .replacingOccurrences(of: ".", with: ",")
        } else if v >= 1_000 {
            return "NOK \(Int(v/1000)) k"
        }
        return "NOK \(Int(v))"
    }
}

private struct KPICard: View {
    let icon: String
    let iconBg: Color
    let iconColor: Color
    let label: String
    let value: String
    let trend: String?
    let trendUp: Bool?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(iconBg)
                    Image(systemName: icon)
                        .font(.appScaled(size: 16, weight: .semibold))
                        .foregroundStyle(iconColor)
                }
                .frame(width: 36, height: 36)
                Text(label)
                    .font(.appScaled(size: 13, weight: .medium))
                    .foregroundStyle(Brand.textSecondary)
                    .lineLimit(2)
                Spacer()
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(value)
                    .font(.appScaled(size: 26, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                if let trend = trend, let up = trendUp {
                    HStack(spacing: 2) {
                        Image(systemName: up ? "arrow.up" : "arrow.down")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text(trend)
                            .font(.appScaled(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(up ? Brand.green : Brand.red)
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(
                        (up ? Brand.green : Brand.red).opacity(0.12),
                        in: Capsule()
                    )
                }
            }
            // "vs. forrige periode" vises kun når vi har en trend å sammenligne.
            // Pakke 10: tomme KPI skal ikke late som de har en historikk.
            if trend != nil {
                Text("vs. forrige periode")
                    .font(.appScaled(size: 10, weight: .medium))
                    .foregroundStyle(Brand.textTertiary)
            } else {
                Text("Ingen data enda")
                    .font(.appScaled(size: 10, weight: .medium))
                    .foregroundStyle(Brand.textTertiary.opacity(0.7))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
    }
}

// MARK: - LeadsInAreaCard

/// Pakke 10.1 — 4 temperatur-tier + «alle»-nullstill. Tap chip → filtrer
/// mini-kart + count-visning. Delt tilgjengelig så andre view-er kan
/// også reagere på samme tier.
enum LeadTemperatureTier: Hashable {
    case all, hot, warm, luke, cold

    func matches(_ lead: LeadModel) -> Bool {
        let score = lead.leadScore ?? 0
        switch self {
        case .all: return true
        case .hot:  return score >= 70 || lead.status == .meetingBooked
        case .warm: return (50..<70).contains(score) && lead.status != .meetingBooked
        case .luke: return (30..<50).contains(score)
        case .cold: return score < 30
        }
    }
}

private struct LeadsInAreaCard: View {
    let leads: [LeadModel]
    @Environment(AppState.self) private var appState
    @State private var activeTier: LeadTemperatureTier = .all
    // Mini-kart camera-state (Pakke 10.1 6-FAB-strip)
    @State private var miniCamera: MapCameraPosition = .region(MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 59.913, longitude: 10.753),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.12)
    ))
    @State private var miniCurrentRegion: MKCoordinateRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 59.913, longitude: 10.753),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.12)
    )
    @State private var miniMapStyle: KartView.MapStyleChoice = .standardDark
    @State private var miniActiveOverlays: Set<KartView.MapOverlay> = []
    @State private var showMiniLayers: Bool = false
    @State private var showMiniAddLead: Bool = false
    @State private var miniToast: String?
    /// Pin-tap åpner et lead-info-kort som overlay på selve kartet
    /// (2026-07-02). Bruker kan lese basis-info + trykke «Les mer»
    /// for å hoppe til Leads-fanen og åpne full detalj.
    @State private var mapSelectedLead: LeadModel?
    /// Tidspunkt for åpning av info-kort. Brukes til å ignorere trivielle
    /// camera-change-events rett etter åpning (layout kan trigge én liten
    /// endring). Etter 300ms lukkes kortet ved neste map-pan/zoom.
    @State private var mapSelectedLeadOpenTime: Date?
    // Lokal måle-modus på mini-kartet (Daniel-fix 2026-07-01, utvidet 07-02):
    @State private var miniMeasureMode: Bool = false
    @State private var miniMeasureA: CLLocationCoordinate2D?
    @State private var miniMeasureB: CLLocationCoordinate2D?
    // Utvidelser 2026-07-02: multi-modus (distance/radius/route),
    // rute-array, enhet-toggle, lagrede ruter + share.
    @State private var measureKind: MeasureKind = .distance
    @State private var measureRoute: [MeasurePoint] = []
    @State private var measureRadiusKm: Double = 2.0
    @State private var measureRadiusCenter: CLLocationCoordinate2D?
    @State private var measureUnit: MeasureUnit = .metric
    @State private var measureSavedRoutes: [SavedMeasureRoute] = SavedMeasureRoute.loadAll()
    @State private var showSaveMeasureSheet: Bool = false
    @State private var showSavedMeasureSheet: Bool = false
    // Ekstra 2026-07-02 (bølge 2):
    // MKDirections-resultat (async fetch etter rute-endring).
    @State private var measureRealDrive: MeasureDirections.DirectionsResult?
    // Konvex hull-toggle (rute-modus): tegn polygon rundt punkter.
    @State private var measureShowHull: Bool = false
    // Snap-til-pin når bruker tapper nær en lead uten å treffe pinen.
    private static let measureSnapDistanceMeters: Double = 50
    // Drag-startpunkt: låses ved start av drag så translation-basert
    // konvertering ikke akkumuleres (fikser jitter/hopp på Mac Catalyst).
    @State private var measureDragStartCoord: CLLocationCoordinate2D?
    // Stabil drag (2026-07-02): markøren dras VISUELT via `.offset(...)` i
    // pixler under drag. Annotation-koord endres KUN ved `onEnded`. Uten
    // dette re-rendres Annotation hver frame, hit-target rebindes, og
    // cursor + markør driver fra hverandre.
    @State private var measureDragTargetId: String?
    @State private var measureDragTranslation: CGSize = .zero
    // Bounce-feedback (2026-07-02, iter 2): Dock-style bounce når rute-
    // punkt festes på en lead. Counter per lead — `phaseAnimator` trigges
    // hver gang counteren økes, som gir den karakteristiske «opp-ned-opp-
    // ned»-bevegelsen fra macOS Dock. Vertikal translate (ikke scale) så
    // pinen «hopper» i stedet for å vokse.
    @State private var bounceCounters: [String: Int] = [:]

    // Destinasjon-tildeling (2026-07-02): bruker velger en lead som sin
    // nåværende destinasjon. Vises som stiplet linje fra avatar-en (MeMapPin)
    // + toast øverst i kartet + spesial-highlight på destinasjons-pinen.
    @State private var assignedDestination: LeadModel?
    @State private var assignedDestinationToastVisible: Bool = false

    // Team-tildeling (2026-07-02): salgssjef/teamleder sender selger/promotør
    // til en lead. Sheet-state + suksess-toast for utført tildeling.
    @State private var assignToTeamLead: LeadModel?  // sheet-item
    @State private var lastCompletedAssignment: LeadAssignment?
    @State private var assignmentSuccessToastVisible: Bool = false

    // Team-på-kartet (2026-07-02): toggle via `.teamMembers` i lag-picker.
    // Mock KUN i demo-modus; erstattes med live-data fra
    // `GET /leadgrid/team-live-locations` (kommer i backend-pakke).
    // Demo AV → tomt lag (ærlig — ingen falske selgere på kartet).
    @State private var teamOnMap: [TeamMemberOnMap] =
        DemoModeManager.isActiveNonisolated ? TeamOnMapMock.members() : []
    @State private var selectedTeamMember: TeamMemberOnMap?

    // MeMapPin tap-actions (2026-07-02)
    @State private var showMePinActions: Bool = false
    @State private var showMyRoute: Bool = false
    @State private var showNearbyTeam: Bool = false
    @State private var showVisitLogAtCoord: MePinCoordWrapper?
    @State private var createdLeadAtPosition: CreatedLeadAtPositionDTO?
    /// Camera-region før HUD ble åpnet — restores ved lukk.
    @State private var cameraBeforeHUD: MKCoordinateRegion?

    /// Zoom inn på user + åpne inline HUD. Lagrer nåværende camera-region
    /// slik at vi kan zoome tilbake når HUD lukkes.
    private func zoomToMeAndOpenHUD(coord: CLLocationCoordinate2D) {
        cameraBeforeHUD = miniCurrentRegion
        let zoomed = MKCoordinateRegion(
            center: coord,
            span: MKCoordinateSpan(latitudeDelta: 0.006, longitudeDelta: 0.008)
        )
        withAnimation(.easeInOut(duration: 0.45)) {
            miniCamera = .region(zoomed)
            miniCurrentRegion = zoomed
        }
        // Åpne HUD etter et lite delay slik at zoom-animasjonen føles først
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.easeOut(duration: 0.25)) {
                showMePinActions = true
            }
        }
    }

    /// Lukk HUD + gjenopprett camera-region.
    private func closeMePinHUD() {
        withAnimation(.easeOut(duration: 0.25)) {
            showMePinActions = false
        }
        if let prev = cameraBeforeHUD {
            withAnimation(.easeInOut(duration: 0.45)) {
                miniCamera = .region(prev)
                miniCurrentRegion = prev
            }
            cameraBeforeHUD = nil
        }
    }

    /// Status-filter fra «Alle status»-chipen (QA-runde 2: chipen var en
    /// ren visning uten handling). nil = alle statuser.
    @State private var mapStatusFilter: LeadStatus?

    /// Pakke 10.1: filter mini-kart + KPI-strippen basert på tier.
    private var pinnedLeads: [LeadModel] {
        leads
            .filter { $0.latitude != 0 || $0.longitude != 0 }
            .filter { activeTier.matches($0) }
            .filter { mapStatusFilter == nil || $0.status == mapStatusFilter }
    }

    private var region: MKCoordinateRegion {
        let coords = pinnedLeads.map { lead -> CLLocationCoordinate2D in
            CLLocationCoordinate2D(latitude: lead.latitude, longitude: lead.longitude)
        }
        guard !coords.isEmpty else {
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 59.913, longitude: 10.753),
                span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.12)
            )
        }
        let lats = coords.map(\.latitude)
        let lngs = coords.map(\.longitude)
        let center = CLLocationCoordinate2D(
            latitude: (lats.min()! + lats.max()!) / 2,
            longitude: (lngs.min()! + lngs.max()!) / 2
        )
        let span = MKCoordinateSpan(
            latitudeDelta: max((lats.max()! - lats.min()!) * 1.4, 0.04),
            longitudeDelta: max((lngs.max()! - lngs.min()!) * 1.4, 0.06)
        )
        return MKCoordinateRegion(center: center, span: span)
    }

    var body: some View {
        bodyContent
            .onReceive(NotificationCenter.default.publisher(
                for: .oversiktAreaChanged
            )) { notification in
                guard let area = notification.userInfo?["area"] as? String
                else { return }
                handleAreaChange(area)
            }
            .onReceive(NotificationCenter.default.publisher(
                for: .oversiktDateChanged
            )) { notification in
                guard let date = notification.userInfo?["date"] as? Date
                else { return }
                handleDateChange(date)
            }
    }

    // MARK: - Header-filter reaksjoner

    /// Zoome mini-kartet til valgt område. Hvis vi har leads i det området,
    /// tar vi bounding-box for dem — ellers bruker vi hardkodete koordinater
    /// for norske storbyer.
    private func handleAreaChange(_ area: String) {
        // Fall tilbake til default hvis "Alle områder"
        if area == "Alle områder" {
            withAnimation(.easeInOut(duration: 0.55)) {
                let region = MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: 59.913, longitude: 10.753),
                    span: MKCoordinateSpan(latitudeDelta: 0.30, longitudeDelta: 0.40)
                )
                miniCamera = .region(region)
                miniCurrentRegion = region
            }
            miniShowToast("Viser alle områder")
            return
        }

        // Prøv bounding-box av leads i valgt by
        let cityLeads = leads.filter {
            ($0.city?.caseInsensitiveCompare(area) == .orderedSame)
        }
        let region: MKCoordinateRegion
        if !cityLeads.isEmpty {
            let coords = cityLeads.map {
                CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
            }
            let lats = coords.map(\.latitude)
            let lons = coords.map(\.longitude)
            region = MKCoordinateRegion(
                center: CLLocationCoordinate2D(
                    latitude: (lats.min()! + lats.max()!) / 2,
                    longitude: (lons.min()! + lons.max()!) / 2
                ),
                span: MKCoordinateSpan(
                    latitudeDelta: max((lats.max()! - lats.min()!) * 1.4, 0.04),
                    longitudeDelta: max((lons.max()! - lons.min()!) * 1.4, 0.06)
                )
            )
        } else if let center = LeadsInAreaCard.coordinateFor(area: area) {
            region = MKCoordinateRegion(
                center: center,
                span: MKCoordinateSpan(latitudeDelta: 0.10, longitudeDelta: 0.14)
            )
        } else {
            return
        }
        withAnimation(.easeInOut(duration: 0.55)) {
            miniCamera = .region(region)
            miniCurrentRegion = region
        }
        miniShowToast("Sentrerte på \(area)")
    }

    /// Zoome mini-kartet til leads som har møter/oppfølging på valgt dato.
    /// Hvis ingen leads matcher, holder vi kartet der det er.
    private func handleDateChange(_ date: Date) {
        let cal = Calendar.current
        let sameDay = leads.filter { lead in
            if let mtg = lead.nextFollowUpAt,
               cal.isDate(mtg, inSameDayAs: date) { return true }
            if let last = lead.lastVisitAt,
               cal.isDate(last, inSameDayAs: date) { return true }
            return false
        }
        guard !sameDay.isEmpty else {
            miniShowToast("Ingen leads-aktivitet \(Self.dateLabel(date))")
            return
        }
        let coords = sameDay.map {
            CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
        }
        let lats = coords.map(\.latitude)
        let lons = coords.map(\.longitude)
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: (lats.min()! + lats.max()!) / 2,
                longitude: (lons.min()! + lons.max()!) / 2
            ),
            span: MKCoordinateSpan(
                latitudeDelta: max((lats.max()! - lats.min()!) * 1.6, 0.04),
                longitudeDelta: max((lons.max()! - lons.min()!) * 1.6, 0.06)
            )
        )
        withAnimation(.easeInOut(duration: 0.55)) {
            miniCamera = .region(region)
            miniCurrentRegion = region
        }
        miniShowToast("\(sameDay.count) leads \(Self.dateLabel(date))")
    }

    /// Hardkodete koordinater for norske storbyer + Lillestrøm (til
    /// områder-Menu). Gjenbruk-kandidat: legg i felles enum senere.
    static func coordinateFor(area: String) -> CLLocationCoordinate2D? {
        switch area.lowercased() {
        case "oslo": return CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522)
        case "bergen": return CLLocationCoordinate2D(latitude: 60.3913, longitude: 5.3221)
        case "trondheim": return CLLocationCoordinate2D(latitude: 63.4305, longitude: 10.3951)
        case "stavanger": return CLLocationCoordinate2D(latitude: 58.9700, longitude: 5.7331)
        case "lillestrøm", "lillestrom": return CLLocationCoordinate2D(latitude: 59.9558, longitude: 11.0492)
        case "kristiansand": return CLLocationCoordinate2D(latitude: 58.1467, longitude: 7.9956)
        case "tromsø", "tromso": return CLLocationCoordinate2D(latitude: 69.6492, longitude: 18.9553)
        case "drammen": return CLLocationCoordinate2D(latitude: 59.7439, longitude: 10.2045)
        default: return nil
        }
    }

    private static func dateLabel(_ d: Date) -> String {
        if Calendar.current.isDateInToday(d) { return "i dag" }
        if Calendar.current.isDateInTomorrow(d) { return "i morgen" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM"
        return "på \(f.string(from: d))"
    }

    private var bodyContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            // AXStack: ved accessibility-størrelser kveles tittelen ved
            // siden av filter-chipen (brakk bokstav-for-bokstav på AX5).
            AXStack {
                Text("Leads i området").font(.headline).foregroundStyle(.white)
                // iPhone: tallet står allerede i statistikk-knappen og
                // temperatur-chipsene — tre steder er to for mange.
                if !DeviceIdiom.isPhone {
                    Text("\(pinnedLeads.count) leads")
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                }
                Spacer()
                // QA-runde 2 (Daniel): chipen var død — nå ekte statusfilter
                // som snevrer pins + cluster-telling på mini-kartet.
                Menu {
                    Button {
                        mapStatusFilter = nil
                    } label: {
                        if mapStatusFilter == nil {
                            Label("Alle status", systemImage: "checkmark")
                        } else {
                            Text("Alle status")
                        }
                    }
                    Divider()
                    ForEach(LeadStatus.allCases) { status in
                        Button {
                            mapStatusFilter = status
                        } label: {
                            if mapStatusFilter == status {
                                Label(status.label, systemImage: "checkmark")
                            } else {
                                Text(status.label)
                            }
                        }
                    }
                } label: {
                    FilterChip(
                        label: mapStatusFilter?.label ?? "Alle status",
                        icon: "line.3.horizontal.decrease.circle"
                    )
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
            }
            // Lead score fordeling — filter-strip (Daniel 2026-06-28 + 07-01):
            // brukeren ser samme fargene som pinene under, tapper for å
            // filtrere mini-kartet + KPI-strippen til én temperatur.
            LeadScoreFilterStrip(leads: leads, activeTier: $activeTier)
            // Pakke 10.1 (Daniel-fix 2026-07-01): «Åpne kart»-pillen fjernet —
            // FABs på mini-kartet dekker det brukeren trenger uten ekstra CTA.
            // Bytt til Kart-fanen via sidebar/tab-bar hvis full-flate ønskes.
            mapThumbnail
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
        // iPhone: lead-info som bottom-sheet — overlay-varianten kolliderte
        // med FAB-kolonnen og klippet «Tildel»/«Les mer»-CTA-ene.
        .sheet(item: phoneLeadSheetBinding) { sel in
            leadInfoCard(for: sel)
                .padding(16)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .background(Brand.bg.ignoresSafeArea())
                .presentationDetents([.height(380), .medium])
                .presentationDragIndicator(.visible)
        }
    }

    /// Konfigurert lead-info-kort — delt mellom iPad-overlay (flytende på
    /// kartet) og iPhone-sheet (bottom-sheet, unngår FAB-kollisjon).
    private func leadInfoCard(for sel: LeadModel) -> some View {
        MapLeadInfoCard(
            lead: sel,
            onClose: {
                withAnimation(.snappy(duration: 0.18)) {
                    mapSelectedLead = nil
                }
                mapSelectedLeadOpenTime = nil
            },
            onOpenLead: { lead in
                NotificationCenter.default.post(
                    name: .oversiktRequestOpenLeadInLeadsTab,
                    object: nil,
                    userInfo: ["leadId": lead.id, "leadName": lead.name]
                )
                withAnimation(.snappy(duration: 0.18)) {
                    mapSelectedLead = nil
                }
                mapSelectedLeadOpenTime = nil
            },
            onAssignAsDestination: { lead in
                assignAsMyDestination(lead)
                withAnimation(.snappy(duration: 0.18)) {
                    mapSelectedLead = nil
                }
                mapSelectedLeadOpenTime = nil
            },
            onAssignToTeamMember: { lead in
                // Lukk info-kortet + åpne team-picker-sheet med lead.
                withAnimation(.snappy(duration: 0.18)) {
                    mapSelectedLead = nil
                }
                mapSelectedLeadOpenTime = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    assignToTeamLead = lead
                }
            },
            // Rolle-bundet: kun leder-roller kan tildele til andre.
            canAssignToOthers: ["admin", "salgssjef", "teamleder"].contains(appState.roleInOrg ?? "")
        )
    }

    /// iPhone: pin-tap → bottom-sheet i stedet for kart-overlay.
    private var phoneLeadSheetBinding: Binding<LeadModel?> {
        DeviceIdiom.isPhone ? $mapSelectedLead : .constant(nil)
    }

    // ── Cluster-logikk for mini-kartet (QA-runde 2) ──────────────────
    // Grupperer leads som ligger nærmere hverandre enn ~1/7 av synlig
    // span — gir «8»-sirkler i stedet for ti overlappende nåler, og
    // enkelt-nåler når man zoomer inn. Ren geometri, ingen ny state.

    private struct MiniCluster: Identifiable {
        let id: String
        let coordinate: CLLocationCoordinate2D
        let leads: [LeadModel]
    }

    private var miniClusters: [MiniCluster] {
        let latT = max(miniCurrentRegion.span.latitudeDelta, 0.0005) / 7
        let lonT = max(miniCurrentRegion.span.longitudeDelta, 0.0005) / 7
        var groups: [(lat: Double, lon: Double, leads: [LeadModel])] = []
        for lead in pinnedLeads.prefix(60) {
            if let idx = groups.firstIndex(where: {
                abs($0.lat - lead.latitude) < latT && abs($0.lon - lead.longitude) < lonT
            }) {
                groups[idx].leads.append(lead)
                let n = Double(groups[idx].leads.count)
                groups[idx].lat += (lead.latitude - groups[idx].lat) / n
                groups[idx].lon += (lead.longitude - groups[idx].lon) / n
            } else {
                groups.append((lead.latitude, lead.longitude, [lead]))
            }
        }
        return groups.map { g in
            MiniCluster(
                id: g.leads.map(\.id).joined(separator: "|"),
                coordinate: CLLocationCoordinate2D(latitude: g.lat, longitude: g.lon),
                leads: g.leads
            )
        }
    }

    private var miniSingleLeads: [LeadModel] {
        miniClusters.filter { $0.leads.count == 1 }.compactMap(\.leads.first)
    }

    private var miniMultiClusters: [MiniCluster] {
        miniClusters.filter { $0.leads.count > 1 }
    }

    @ViewBuilder
    private var mapThumbnail: some View {
        ZStack(alignment: .bottomTrailing) {
            // MapReader → gir MapProxy så vi kan konvertere touch-punkter til
            // ekte lat/lon i måle-modus. Standard-tap går til gesture bare
            // når measure-mode er ON; ellers pan/zoom fungerer normalt.
            MapReader { proxy in
                Map(position: $miniCamera, interactionModes: [.pan, .zoom]) {
                    // Cluster-nåler (QA-runde 2, Daniels funn): overlappende
                    // pins med «0»-score ga null informasjon — leads som
                    // ligger tett vises nå som én sirkel med ANTALL, og tap
                    // zoomer inn til klyngen. Re-clustres per zoom-nivå via
                    // miniCurrentRegion.
                    ForEach(miniMultiClusters) { cluster in
                        Annotation("", coordinate: cluster.coordinate, anchor: .center) {
                            OvClusterPin(count: cluster.leads.count)
                                .onTapGesture {
                                    let span = MKCoordinateSpan(
                                        latitudeDelta: max(miniCurrentRegion.span.latitudeDelta / 4, 0.004),
                                        longitudeDelta: max(miniCurrentRegion.span.longitudeDelta / 4, 0.004)
                                    )
                                    let region = MKCoordinateRegion(center: cluster.coordinate, span: span)
                                    withAnimation(.easeInOut(duration: 0.4)) {
                                        miniCamera = .region(region)
                                    }
                                    miniCurrentRegion = region
                                }
                        }
                    }
                    ForEach(miniSingleLeads, id: \.id) { lead in
                        let score = lead.leadScore ?? 0
                        Annotation(lead.name,
                                   coordinate: CLLocationCoordinate2D(latitude: lead.latitude,
                                                                      longitude: lead.longitude)) {
                            MiniPin(
                                score: score,
                                isHot: score >= 90 || lead.status == .meetingBooked,
                                isWarm: (50..<70).contains(score),
                                activityKind: miniPinActivityKind(for: lead)
                            )
                            // Dock-style bounce (2026-07-02, iter 3):
                            // `keyframeAnimator` gir nøyaktig kontroll per
                            // fase — rask opp (0.14s), tung ned (0.28s med
                            // spring-landing), 3 avtagende hopp (24→14→6pt).
                            // Kombinert med scale-stretch (y-strekk på vei
                            // opp, x-squash på landing) føles det som en
                            // ekte fjæret bounce, ikke bare translate.
                            .keyframeAnimator(
                                initialValue: BounceKeyframe(),
                                trigger: bounceCounters[lead.id] ?? 0
                            ) { view, k in
                                view
                                    .scaleEffect(x: k.scaleX, y: k.scaleY, anchor: .bottom)
                                    .offset(y: k.offsetY)
                            } keyframes: { _ in
                                // OffsetY — 3 avtagende hopp
                                KeyframeTrack(\.offsetY) {
                                    SpringKeyframe(-24, duration: 0.16, spring: .snappy)
                                    SpringKeyframe(0,   duration: 0.22, spring: .bouncy)
                                    SpringKeyframe(-14, duration: 0.14, spring: .snappy)
                                    SpringKeyframe(0,   duration: 0.20, spring: .bouncy)
                                    SpringKeyframe(-6,  duration: 0.12, spring: .snappy)
                                    SpringKeyframe(0,   duration: 0.18, spring: .bouncy)
                                }
                                // ScaleY — stretch opp mens den akselererer,
                                // squash ved landing (elastisk pin-følelse).
                                KeyframeTrack(\.scaleY) {
                                    CubicKeyframe(1.12, duration: 0.16)
                                    CubicKeyframe(0.94, duration: 0.05)
                                    CubicKeyframe(1.02, duration: 0.17)
                                    CubicKeyframe(1.08, duration: 0.14)
                                    CubicKeyframe(0.96, duration: 0.05)
                                    CubicKeyframe(1.0,  duration: 0.35)
                                }
                                // ScaleX — inversen (squash + stretch)
                                KeyframeTrack(\.scaleX) {
                                    CubicKeyframe(0.92, duration: 0.16)
                                    CubicKeyframe(1.08, duration: 0.05)
                                    CubicKeyframe(0.98, duration: 0.17)
                                    CubicKeyframe(0.94, duration: 0.14)
                                    CubicKeyframe(1.06, duration: 0.05)
                                    CubicKeyframe(1.0,  duration: 0.35)
                                }
                            }
                            .onTapGesture {
                                if miniMeasureMode {
                                    // Måle-modus: registrer lead-ens eksakte
                                    // koordinat som måle-punkt (istedenfor å
                                    // åpne info-card). Slik kan bruker måle
                                    // avstander mellom leadsene helt presist.
                                    handleMeasureTapOnLead(lead)
                                } else {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                                        mapSelectedLead = lead
                                    }
                                    mapSelectedLeadOpenTime = Date()
                                }
                            }
                        }
                    }
                    // "Meg her"-annotasjon: profil-avatar på user-location
                    // (2026-07-02). Bruker samme portrait-fallback som
                    // SharedProfileAvatar — SmartPortrait med initialer hvis
                    // asset mangler. Oppdateres reaktivt når userCoordinate
                    // endres (KartLocationManager publiserer @Observable).
                    if let coord = KartLocationManager.shared.currentCoordinate {
                        // Annotation-innhold har skjerm-fast størrelse — MeMapPin
                        // forblir synlig med samme visuell størrelse uansett
                        // zoom-nivå så lenge koordinaten er innenfor synlig
                        // kart-region. Tap zoomer inn + åpner inline HUD.
                        Annotation("Meg", coordinate: coord) {
                            MeMapPin(initials: appState.initials, email: appState.userEmail)
                                .onTapGesture {
                                    zoomToMeAndOpenHUD(coord: coord)
                                }
                        }
                        // Destinasjons-linje (2026-07-02): stiplet grønn linje
                        // fra avataren til tildelt destinasjon. Ren visuell
                        // «send meg dit»-guide.
                        if let dest = assignedDestination {
                            let destCoord = CLLocationCoordinate2D(
                                latitude: dest.latitude,
                                longitude: dest.longitude
                            )
                            MapPolyline(coordinates: [coord, destCoord])
                                .stroke(Brand.green,
                                        style: StrokeStyle(lineWidth: 3,
                                                           lineCap: .round,
                                                           dash: [8, 6]))
                        }
                    }
                    // Team-på-kartet (2026-07-02): synlig når `.teamMembers`
                    // er aktivt i lag-picker. Hver medlem tegnes som avatar-
                    // pin i team-farge + destinasjons-linje. Team-områder
                    // vises som fargelagte soner med svevende prestasjons-
                    // banner i sentrum.
                    if miniActiveOverlays.contains(.teamMembers) {
                        // Team-områder (bakerst, så pins ligger oppå)
                        ForEach(LeadgridSalesTeamStore.shared.teams) { team in
                            if let lat = team.areaCenterLat,
                               let lng = team.areaCenterLng,
                               let radiusKm = team.areaRadiusKm {
                                let center = CLLocationCoordinate2D(latitude: lat, longitude: lng)
                                MapCircle(center: center, radius: radiusKm * 1000)
                                    .foregroundStyle(team.color.opacity(0.12))
                                    .stroke(team.color.opacity(0.6),
                                            style: StrokeStyle(lineWidth: 2, dash: [5, 4]))
                                Annotation(team.name, coordinate: center, anchor: .center) {
                                    TeamPerformanceBanner(
                                        team: team,
                                        performance: TeamPerformanceMock.performance(for: team)
                                    )
                                }
                            }
                        }
                        // Team-medlem-avatarer
                        ForEach(teamOnMap) { member in
                            let team = LeadgridSalesTeamStore.shared.team(for: member.userId)
                            Annotation(member.name, coordinate: member.coordinate, anchor: .center) {
                                TeamMapPin(member: member, teamColor: team?.color)
                                    .onTapGesture {
                                        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                                            selectedTeamMember = member
                                            mapSelectedLead = nil
                                        }
                                    }
                            }
                            if let destCoord = member.destinationCoordinate {
                                MapPolyline(coordinates: [member.coordinate, destCoord])
                                    .stroke((team?.color ?? member.role.color).opacity(0.6),
                                            style: StrokeStyle(lineWidth: 2,
                                                               lineCap: .round,
                                                               dash: [6, 4]))
                            }
                        }
                    }
                    // Destinasjons-highlight: pulserende grønn ring rundt
                    // tildelt lead-pin for tydelig «du skal hit»-signal.
                    if let dest = assignedDestination {
                        let destCoord = CLLocationCoordinate2D(
                            latitude: dest.latitude,
                            longitude: dest.longitude
                        )
                        MapCircle(center: destCoord, radius: 60)
                            .foregroundStyle(Brand.green.opacity(0.10))
                            .stroke(Brand.green.opacity(0.7),
                                    style: StrokeStyle(lineWidth: 2, dash: [4, 3]))
                    }
                    // Måle-modus: A-punkt, B-punkt og polyline. Draggable
                    // (2026-07-02): bruker kan dra markørene for å justere
                    // uten å nullstille. `anchor: .bottom` løfter markøren
                    // OVER pin-en visuelt så tap på lead-pin under fortsatt
                    // fungerer (fikser gjenintroduksjon av «andre pin»-bug).
                    if let a = miniMeasureA {
                        Annotation("A", coordinate: a, anchor: .center) {
                            miniMeasureMarker(label: "A")
                                .offset(draggingOffset(for: "A"))
                                .highPriorityGesture(dragGesture(
                                    proxy: proxy,
                                    targetId: "A",
                                    startCoord: { miniMeasureA }
                                ) { c in
                                    miniMeasureA = c
                                })
                        }
                    }
                    if let b = miniMeasureB {
                        Annotation("B", coordinate: b, anchor: .center) {
                            miniMeasureMarker(label: "B")
                                .offset(draggingOffset(for: "B"))
                                .highPriorityGesture(dragGesture(
                                    proxy: proxy,
                                    targetId: "B",
                                    startCoord: { miniMeasureB }
                                ) { c in
                                    miniMeasureB = c
                                })
                        }
                    }
                    if let a = miniMeasureA, let b = miniMeasureB {
                        MapPolyline(coordinates: [a, b])
                            .stroke(Brand.green,
                                    style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [6, 4]))
                    }
                    // Rute-modus: multi-punkts kjede + nummererte annotations.
                    // `anchor: .center` (2026-07-02): markøren sitter PÅ lead-
                    // pinen (samme koord som MapPolyline-en ender på), slik
                    // at linjen visuelt kobler seg til rute-punktet — ikke
                    // ender i midten av pinen med markøren svevende over.
                    if measureKind == .route && !measureRoute.isEmpty {
                        ForEach(Array(measureRoute.enumerated()), id: \.offset) { i, p in
                            Annotation("\(i + 1)", coordinate: p.coordinate, anchor: .center) {
                                miniMeasureMarker(label: "\(i + 1)")
                                    .offset(draggingOffset(for: "route-\(i)"))
                                    .highPriorityGesture(dragGesture(
                                        proxy: proxy,
                                        targetId: "route-\(i)",
                                        startCoord: { measureRoute.indices.contains(i) ? measureRoute[i].coordinate : nil }
                                    ) { c in
                                        guard i < measureRoute.count else { return }
                                        measureRoute[i] = MeasurePoint(coord: c, leadName: nil)
                                    } onEnded: {
                                        Task { await recalcRealDriveTime() }
                                    })
                            }
                        }
                        if measureRoute.count >= 2 {
                            MapPolyline(coordinates: measureRoute.map(\.coordinate))
                                .stroke(Brand.green,
                                        style: StrokeStyle(lineWidth: 3, lineCap: .round,
                                                            lineJoin: .round, dash: [6, 4]))
                        }
                        // Konvex hull-polygon (bruker toggler i banneret)
                        if measureShowHull && measureRoute.count >= 3 {
                            let hull = MeasureMath.convexHull(measureRoute)
                            MapPolygon(coordinates: hull)
                                .foregroundStyle(Brand.purple.opacity(0.12))
                                .stroke(Brand.purpleLight.opacity(0.55),
                                        style: StrokeStyle(lineWidth: 2, dash: [3, 3]))
                        }
                    }
                    // Radius-modus: sentrum-marker + fylt sirkel med lead-radius
                    if measureKind == .radius, let center = measureRadiusCenter {
                        Annotation("R", coordinate: center, anchor: .center) {
                            miniMeasureMarker(label: "R")
                                .offset(draggingOffset(for: "R"))
                                .highPriorityGesture(dragGesture(
                                    proxy: proxy,
                                    targetId: "R",
                                    startCoord: { measureRadiusCenter }
                                ) { c in
                                    measureRadiusCenter = c
                                })
                        }
                        MapCircle(center: center, radius: measureRadiusKm * 1000)
                            .foregroundStyle(Brand.green.opacity(0.15))
                            .stroke(Brand.green.opacity(0.7),
                                    style: StrokeStyle(lineWidth: 2, dash: [5, 3]))
                    }
                }
                .coordinateSpace(.named("miniMap"))
                .mapStyle(miniMapStyle.mapKitStyle)
                // Alltid mørkt kart — identisk med Kart-fanen (ingen dag/natt-
                // veksling), så Oversikt matcher det mørke brand-uttrykket.
                .environment(\.colorScheme, .dark)
                // Strekkes naturlig — fyller resten av cardet
                .frame(maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .onMapCameraChange(frequency: .continuous) { ctx in
                    miniCurrentRegion = ctx.region
                    // Fallback for scroll-zoom (trackpad pinch, scroll-hjul) —
                    // disse fanges ikke av DragGesture-en lenger nede. Snappy
                    // duration + kort buffer så det ikke føles laggete.
                    closeInfoCardIfMapMoved()
                }
                .simultaneousGesture(
                    // Fanger bruker-drag PÅ Map for umiddelbar respons — ingen
                    // venting på onMapCameraChange-throttling. Krever bare 3pt
                    // bevegelse, så respons føles direkte.
                    DragGesture(minimumDistance: 3)
                        .onChanged { _ in
                            closeInfoCardIfMapMoved()
                        }
                )
                .onTapGesture(coordinateSpace: .local) { point in
                    guard miniMeasureMode,
                          let coord = proxy.convert(point, from: .local) else { return }
                    handleMeasureTapOnCoord(coord, proxy: proxy)
                }
            }

            // Måle-modus-banner øverst-venstre (kun synlig når mode er på)
            if miniMeasureMode {
                VStack(alignment: .leading, spacing: 8) {
                    measureBannerHeader
                    measureKindPicker
                    if measureKind == .radius {
                        measureRadiusSlider
                    }
                    measureBottomToolbar
                }
                .padding(DeviceIdiom.isPhone ? 8 : 10)
                .background(Brand.card.opacity(0.92), in: RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Brand.green.opacity(0.5), lineWidth: 1)
                )
                .padding([.leading, .top, .bottom], 14)
                // iPhone: 74pt trailing-marg garanterer at HUD-en ALDRI
                // overlapper FAB-kolonnen langs høyre kant (52pt strip +
                // 14pt padding, zIndex 100). iPad/Mac beholder 14pt.
                .padding(.trailing, DeviceIdiom.isPhone ? 74 : 14)
                .frame(maxWidth: DeviceIdiom.isPhone ? .infinity : 380)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .allowsHitTesting(true)
            }

            // Pakke 10.1 (Daniel 2026-07-01): full 6-FAB-strip m/ IDENTISK
            // farge og oppførsel som Kart-fanens strip (Brand.card + stroke).
            //
            // Mac Catalyst-stabilitet (2026-07-02):
            //   - 52pt bred kolonne (opp fra ~40) — større hit-target
            //   - 44×44 buttons (opp fra 32×32) — matcher HIG minimum
            //   - .zIndex(100) — eksplisitt over Map's gesture-recognizere
            //   - .allowsHitTesting(true) — sikrer children mottar events
            VStack(spacing: 10) {
                VStack(spacing: 0) {
                    miniFABButton(icon: "plus", action: miniZoomIn)
                    Divider().overlay(Brand.stroke)
                    miniFABButton(icon: "minus", action: miniZoomOut)
                }
                .background(Brand.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(Brand.stroke, lineWidth: 1))

                miniFABButton(icon: "location.fill", action: miniCenterOnMe)
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(Brand.stroke, lineWidth: 1))

                miniFABButton(icon: "square.stack.3d.up.fill", action: { showMiniLayers = true })
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(Brand.stroke, lineWidth: 1))

                miniFABButton(icon: miniMeasureMode ? "ruler.fill" : "ruler", action: {
                    miniMeasureMode.toggle()
                    if miniMeasureMode {
                        // Lukk lead-info-overlay ved aktivering av måle-modus
                        // så bruker kan tappe pin-koordinatet som måle-punkt
                        // uten at gammelt info-card henger igjen.
                        withAnimation(.easeOut(duration: 0.2)) {
                            mapSelectedLead = nil
                        }
                        miniShowToast("Tap to punkter på kartet for å måle")
                    } else {
                        miniMeasureA = nil
                        miniMeasureB = nil
                    }
                })
                    .background(
                        miniMeasureMode ? Brand.green.opacity(0.25) : Brand.card,
                        in: RoundedRectangle(cornerRadius: 11)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 11)
                            .stroke(
                                miniMeasureMode ? Brand.green.opacity(0.5) : Brand.stroke,
                                lineWidth: 1
                            )
                    )

                miniFABButton(icon: "mappin.and.ellipse", action: {
                    showMiniAddLead = true
                })
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(Brand.stroke, lineWidth: 1))
            }
            .fixedSize()   // Hindre VStack fra å strekkes til full kart-bredde
            .padding(14)
            .zIndex(100)   // Over Map's UIKit-gesture-recognizere på Catalyst
            .allowsHitTesting(true)

            // Mini-toast øverst-venstre
            if let t = miniToast {
                Text(t).font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(Brand.purple.opacity(0.95), in: Capsule())
                    .padding(14)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }

            // Lead-info-overlay nederst på kartet — vises når bruker
            // tapper en pin. Har «Les mer»-CTA som hopper til Leads-fanen.
            // iPhone (QA-runde 2): overlay-kortet kolliderte med FAB-
            // kolonnen og klippet CTA-ene — vises som bottom-sheet i stedet
            // (se .sheet på bodyContent).
            if let sel = mapSelectedLead, !DeviceIdiom.isPhone {
                leadInfoCard(for: sel)
                .padding(14)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                // Asymmetric transition (2026-07-02): fortsatt slide-opp
                // ved åpning (naturlig "kommer fra pinen"), men rask fade
                // + subtil scale-ned ved lukking. Ingen glide-til-bunn som
                // føles laggete — kortet forsvinner i sin egen posisjon.
                .transition(.asymmetric(
                    insertion: .move(edge: .bottom).combined(with: .opacity),
                    removal: .scale(scale: 0.94).combined(with: .opacity)
                ))
            }

            // Destinasjons-toast (2026-07-02): slide-in fra topp når bruker
            // har tildelt seg en ny destinasjon. Auto-skjules etter 4s,
            // men destinasjonen forblir aktiv til bruker fjerner den.
            if assignedDestinationToastVisible, let dest = assignedDestination {
                assignedDestinationToast(dest: dest)
                    .padding(.top, 14)
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            // Team-medlem info-kort (2026-07-02): vises ved tap på team-avatar.
            // Rolle-fargekodet med Send lead / Ping / Profil-CTAer.
            if let m = selectedTeamMember {
                TeamMemberInfoCard(
                    member: m,
                    distanceFromMe: distanceFromMeKm(to: m.coordinate),
                    onClose: {
                        withAnimation(.snappy(duration: 0.18)) {
                            selectedTeamMember = nil
                        }
                    },
                    onOpenProfile: { member in
                        withAnimation(.snappy(duration: 0.18)) {
                            selectedTeamMember = nil
                        }
                        miniShowToast("Profil for \(member.name) — kommer")
                    },
                    onSendLead: { member in
                        withAnimation(.snappy(duration: 0.18)) {
                            selectedTeamMember = nil
                        }
                        miniShowToast("Send lead til \(member.name) — velg lead fra kartet")
                    },
                    onPing: { member in
                        #if canImport(UIKit)
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                        #endif
                        withAnimation(.snappy(duration: 0.18)) {
                            selectedTeamMember = nil
                        }
                        miniShowToast("🔔 Ping sendt til \(member.name)")
                    }
                )
                .padding(14)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                .transition(.asymmetric(
                    insertion: .move(edge: .bottom).combined(with: .opacity),
                    removal: .scale(scale: 0.94).combined(with: .opacity)
                ))
            }

            // Suksess-toast etter team-tildeling — vises 3s deretter fade.
            if assignmentSuccessToastVisible, let a = lastCompletedAssignment {
                assignmentSuccessToast(assignment: a)
                    .padding(.top, 14)
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        // Team-tildeling sheet — presenteres når salgssjef trykker
        // «Tildel…» i info-kortet.
        .sheet(item: $assignToTeamLead) { lead in
            AssignToTeamMemberSheet(
                leadId: lead.id,
                leadName: lead.name,
                leadAddress: lead.address ?? lead.city,
                leadScore: lead.leadScore,
                leadCoordinate: CLLocationCoordinate2D(
                    latitude: lead.latitude,
                    longitude: lead.longitude
                ),
                members: assignableMembers(for: lead),
                onAssign: { assignment in
                    completeTeamAssignment(assignment)
                },
                onCancel: {}
            )
        }
        .sheet(isPresented: $showMiniLayers) {
            LayersSheet(selectedStyle: $miniMapStyle, activeOverlays: $miniActiveOverlays)
        }
        // Måle-verktøy: lagre-sheet
        .sheet(isPresented: $showSaveMeasureSheet) {
            SaveMeasureRouteSheet(
                kind: measureKind,
                distanceMeters: {
                    switch measureKind {
                    case .distance:
                        guard let a = miniMeasureA, let b = miniMeasureB else { return 0 }
                        return MeasureMath.distanceMeters(a, b)
                    case .route:
                        return MeasureMath.totalDistanceMeters(measureRoute)
                    case .radius:
                        return measureRadiusKm * 1000.0
                    }
                }(),
                unit: measureUnit,
                onSave: { name in
                    let pts: [MeasurePoint] = {
                        switch measureKind {
                        case .distance:
                            var list: [MeasurePoint] = []
                            if let a = miniMeasureA { list.append(MeasurePoint(coord: a)) }
                            if let b = miniMeasureB { list.append(MeasurePoint(coord: b)) }
                            return list
                        case .route: return measureRoute
                        case .radius:
                            if let c = measureRadiusCenter { return [MeasurePoint(coord: c)] }
                            return []
                        }
                    }()
                    let route = SavedMeasureRoute(
                        name: name,
                        kind: measureKind,
                        points: pts,
                        radiusKm: measureKind == .radius ? measureRadiusKm : nil,
                        createdAt: Date()
                    )
                    measureSavedRoutes = SavedMeasureRoute.append(route)
                    showSaveMeasureSheet = false
                    miniShowToast("Lagret: \(name)")
                },
                onCancel: { showSaveMeasureSheet = false }
            )
        }
        // Måle-verktøy: liste over lagrede ruter (åpne / slett)
        .sheet(isPresented: $showSavedMeasureSheet) {
            SavedMeasureRoutesSheet(
                routes: $measureSavedRoutes,
                unit: measureUnit,
                onOpen: { route in
                    measureKind = route.kind
                    measureResetAll()
                    switch route.kind {
                    case .distance:
                        if route.points.count >= 1 { miniMeasureA = route.points[0].coordinate }
                        if route.points.count >= 2 { miniMeasureB = route.points[1].coordinate }
                    case .route:
                        measureRoute = route.points
                    case .radius:
                        measureRadiusCenter = route.points.first?.coordinate
                        if let r = route.radiusKm { measureRadiusKm = r }
                    }
                    // Zoom mini-kartet til ruta
                    if !route.points.isEmpty {
                        let c = MeasureMath.centroid(route.points)
                        let region = MKCoordinateRegion(
                            center: c,
                            span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.20)
                        )
                        withAnimation(.easeInOut(duration: 0.5)) {
                            miniCamera = .region(region)
                            miniCurrentRegion = region
                        }
                    }
                    showSavedMeasureSheet = false
                }
            )
        }
        .sheet(isPresented: $showMiniAddLead) {
            AddLeadSheet { _ in
                miniShowToast("Lead lagt til på \(miniCurrentRegion.center.latitude), \(miniCurrentRegion.center.longitude)")
            }
        }
        // MeMapPin tap-actions (2026-07-02) — inline HUD-overlay på selve
        // kartet i stedet for sheet. Kartet zoomer inn på user når HUD
        // åpnes og gjenopprettes ved lukk.
        .overlay {
            if showMePinActions {
                MePinActionsSheet(
                    onOpenMyRoute: { showMyRoute = true },
                    onOpenVisitLog: { coord in
                        showVisitLogAtCoord = MePinCoordWrapper(coordinate: coord)
                    },
                    onOpenTeamNearby: { showNearbyTeam = true },
                    onLeadCreated: { dto in createdLeadAtPosition = dto },
                    onClose: { closeMePinHUD() }
                )
                .transition(.opacity)
            }
        }
        .sheet(isPresented: $showMyRoute) { MyRouteView() }
        .sheet(isPresented: $showNearbyTeam) { NearbyTeamView() }
        .sheet(item: $showVisitLogAtCoord) { wrapper in
            let nearest = miniNearestLead(from: wrapper.coordinate)
            VisitLogModal(lead: nearest)
        }
        .sheet(item: $createdLeadAtPosition) { dto in
            NavigationStack {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 40))
                        .foregroundStyle(.green)
                    Text("Lead opprettet")
                        .font(.headline)
                    Text(dto.displayName)
                        .font(.subheadline)
                    if let addr = dto.address {
                        Text(addr).font(.caption).foregroundStyle(.secondary)
                    }
                    Button("Ferdig") { createdLeadAtPosition = nil }
                        .padding(.top, 12)
                }
                .padding(24)
                .navigationTitle("Ny lead")
                .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium])
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.85), value: miniToast)
    }

    /// Pin-tap i måle-modus: håndter etter valgt måle-kind.
    ///   .distance → A → B (legacy 2-punkt)
    ///   .route    → append til rute-array
    ///   .radius   → sett sentrum, radius justeres via slider
    private func handleMeasureTapOnLead(_ lead: LeadModel) {
        let coord = CLLocationCoordinate2D(latitude: lead.latitude, longitude: lead.longitude)
        let point = MeasurePoint(coord: coord, leadName: lead.name)
        // Bounce ved direkte pin-tap i måle-modus — signaliserer at rute-
        // punktet ble festet til leaden (samme feedback som snap-treff).
        triggerLeadBounce(lead.id)
        switch measureKind {
        case .distance:
            if miniMeasureA == nil {
                miniMeasureA = coord
                miniShowToast("A: \(lead.name) — tap neste for B")
            } else if miniMeasureB == nil {
                miniMeasureB = coord
                let d = MeasureMath.distanceMeters(miniMeasureA!, coord)
                miniShowToast("B: \(lead.name) — \(measureUnit.format(d))")
            } else {
                miniMeasureA = coord
                miniMeasureB = nil
                miniShowToast("A: \(lead.name)")
            }
        case .route:
            // Samme 25-stopps-tak som free-map-tap.
            guard measureRoute.count < Self.measureRouteMaxPoints else {
                miniShowToast("Maks \(Self.measureRouteMaxPoints) stopp — nullstill for å starte ny rute")
                return
            }
            measureRoute.append(point)
            if measureRoute.count == 1 {
                miniShowToast("Start: \(lead.name)")
            } else {
                let total = MeasureMath.totalDistanceMeters(measureRoute)
                let mins = MeasureMath.estimatedDriveMinutes(total)
                miniShowToast("\(measureRoute.count) stopp — \(measureUnit.format(total)) · ~\(mins) min")
                Task { await recalcRealDriveTime() }
            }
        case .radius:
            measureRadiusCenter = coord
            let leadsIn = leadsWithinRadius(center: coord, km: measureRadiusKm)
            miniShowToast("Sentrum: \(lead.name) — \(leadsIn) leads i \(Self.formatRadiusKm(measureRadiusKm))")
        }
    }

    /// Free-map-tap håndtering for måle-modus. Sjekker først om tappet
    /// var innenfor snap-avstand av en lead-pin — i så fall snapper vi
    /// til lead-koordinatet + arver leadName. Ellers brukes rå tap-punkt.
    ///
    /// Fix 2026-07-02: tidligere brukte `.distance`- og `.radius`-grenene
    /// den RÅ `coord`-en i stedet for `effective`-koordinatet fra snap —
    /// så snap-til-pin fungerte bare i rute-modus. Nå gjelder snap alle
    /// tre modi konsistent.
    private func handleMeasureTapOnCoord(_ coord: CLLocationCoordinate2D, proxy: MapProxy) {
        // Snap-til-nærmeste-pin (2026-07-02, bølge 3): bruker piksel-avstand
        // via MapProxy istedenfor meter — meter blir vinzy små pikselavstander
        // ved lave zoom-nivåer (50m ~= 5-10pt på Oslo-oversikt), som gjorde at
        // bruker måtte tappe nærmest på pinen for at snap skulle utløses.
        let snapped = snapCandidateFor(coord, proxy: proxy)
        let effective = snapped?.coord ?? coord
        let leadName = snapped?.name
        // Bounce lead-pinen når snap-treff — gir visuell feedback om at
        // rute-punktet ble festet PÅ leaden.
        if let hitLeadId = snapped?.leadId {
            triggerLeadBounce(hitLeadId)
        }
        switch measureKind {
        case .distance:
            if miniMeasureA == nil {
                miniMeasureA = effective
                miniShowToast(leadName.map { "A: \($0)" } ?? "Punkt A satt")
            } else if miniMeasureB == nil {
                miniMeasureB = effective
                let d = MeasureMath.distanceMeters(miniMeasureA!, effective)
                miniShowToast("Avstand: \(measureUnit.format(d))")
            } else {
                miniMeasureA = effective
                miniMeasureB = nil
                miniShowToast(leadName.map { "Nytt A: \($0)" } ?? "Nullstill — A satt igjen")
            }
        case .route:
            // Fix 2026-07-02: tak på 25 stopp så vi ikke fyrer av 100+
            // MKDirections-kall og tapper batteri / rate-limit.
            guard measureRoute.count < Self.measureRouteMaxPoints else {
                miniShowToast("Maks \(Self.measureRouteMaxPoints) stopp — nullstill for å starte ny rute")
                return
            }
            let point = MeasurePoint(coord: effective, leadName: leadName)
            measureRoute.append(point)
            if measureRoute.count == 1 {
                miniShowToast(leadName.map { "Start: \($0)" } ?? "Startpunkt satt")
            } else {
                let total = MeasureMath.totalDistanceMeters(measureRoute)
                let mins = MeasureMath.estimatedDriveMinutes(total)
                miniShowToast("\(measureRoute.count) stopp — \(measureUnit.format(total)) · ~\(mins) min")
                Task { await recalcRealDriveTime() }
            }
        case .radius:
            measureRadiusCenter = effective
            let leadsIn = leadsWithinRadius(center: effective, km: measureRadiusKm)
            let name = leadName ?? "Sentrum"
            miniShowToast("\(name) — \(leadsIn) leads i \(Self.formatRadiusKm(measureRadiusKm))")
        }
    }

    /// Tell hvor mange leads i mini-kartets data-sett som ligger innenfor
    /// en gitt radius fra `center`. Brukes av radius-modus.
    private func leadsWithinRadius(center: CLLocationCoordinate2D, km: Double) -> Int {
        let radiusM = km * 1000.0
        return pinnedLeads.filter { lead in
            let d = MeasureMath.distanceMeters(
                center,
                CLLocationCoordinate2D(latitude: lead.latitude, longitude: lead.longitude)
            )
            return d <= radiusM
        }.count
    }

    /// Nullstill alle måle-punkter (uansett kind). Brukes av «Nullstill»-
    /// knappen i banneret + når vi bytter kind. Fix 2026-07-02:
    /// `measureShowHull` ble ikke resetet før — kunne henge igjen som
    /// «på» etter modus-bytte.
    private func measureResetAll() {
        miniMeasureA = nil
        miniMeasureB = nil
        measureRoute.removeAll()
        measureRadiusCenter = nil
        measureRealDrive = nil
        measureShowHull = false
    }

    /// Tak på rute-punkter så vi ikke fyrer av 100 MKDirections-kall.
    private static let measureRouteMaxPoints = 25

    /// Format radius i km med 1 desimal når < 10 km, ellers heltall.
    /// Fix 2026-07-02: sliderens step er 0.5, så `Int(0.5)` = 0 —
    /// «Radius: 0 km» var en klar bug. Nå viser 0,5 km / 2,5 km / 10 km.
    static func formatRadiusKm(_ km: Double) -> String {
        if km >= 10 {
            return String(format: "%d km", Int(km.rounded()))
        }
        // Nb_NO desimal-komma
        let f = NumberFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.minimumFractionDigits = km.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 1
        f.maximumFractionDigits = 1
        let str = f.string(from: NSNumber(value: km)) ?? String(format: "%.1f", km)
        return "\(str) km"
    }

    /// Snap-kandidat: finn nærmeste synlige lead-pin innen piksel-radius
    /// (`Self.measureSnapPixels = 40pt`) av gitt tap-koordinat.
    ///
    /// Fix 2026-07-02 (bølge 3): tidligere brukte vi meter (50m), som ved
    /// zoomet-ut kart-nivåer ble så små pikselavstander at snap knapt
    /// utløses. Piksel-basert snap gir konsistent «komfortabel» hit-radius
    /// uansett zoom-nivå.
    private static let measureSnapPixels: CGFloat = 40
    private func snapCandidateFor(
        _ coord: CLLocationCoordinate2D,
        proxy: MapProxy
    ) -> (coord: CLLocationCoordinate2D, name: String, leadId: String)? {
        // Bare snap til pins som faktisk vises på kartet (samme
        // `.prefix(10)`-filter som ForEach-en bruker). Uten dette kunne
        // bruker tappe midt på et tomt kart-område og bli «magisk»
        // snappet til en usynlig lead — forvirrende UX.
        let visible = Array(pinnedLeads.prefix(10))
        guard let tapPoint = proxy.convert(coord, to: .named("miniMap"))
        else { return nil }
        var best: (CGFloat, LeadModel)? = nil
        for lead in visible {
            let leadCoord = CLLocationCoordinate2D(
                latitude: lead.latitude,
                longitude: lead.longitude
            )
            guard let pinPoint = proxy.convert(leadCoord, to: .named("miniMap"))
            else { continue }
            let dx = tapPoint.x - pinPoint.x
            let dy = tapPoint.y - pinPoint.y
            let d = sqrt(dx * dx + dy * dy)
            if d <= Self.measureSnapPixels {
                if let cur = best {
                    if d < cur.0 { best = (d, lead) }
                } else {
                    best = (d, lead)
                }
            }
        }
        guard let (_, lead) = best else { return nil }
        return (
            CLLocationCoordinate2D(latitude: lead.latitude, longitude: lead.longitude),
            lead.name,
            lead.id
        )
    }

    /// Trigges når rute-modus har fått 2+ punkter — fetch ekte kjøretid
    /// asynkront via MKDirections og oppdater state slik at banneret
    /// bytter fra estimate til ekte tall.
    @MainActor
    private func recalcRealDriveTime() async {
        guard measureKind == .route, measureRoute.count >= 2 else {
            measureRealDrive = nil
            return
        }
        let snapshot = measureRoute
        if let res = await MeasureDirections.fetch(for: snapshot) {
            // Bekreft at rute-array ikke har endret seg imens
            guard snapshot == measureRoute else { return }
            measureRealDrive = res
        }
    }

    /// Bygg en delbar streng-representasjon av aktuell måling. Bruker share.
    private func measureShareText() -> String {
        switch measureKind {
        case .distance:
            guard let a = miniMeasureA, let b = miniMeasureB else {
                return "Ingen måling å dele."
            }
            let d = MeasureMath.distanceMeters(a, b)
            return "Avstand: \(measureUnit.format(d))"
        case .route:
            guard measureRoute.count >= 2 else { return "Ingen rute å dele." }
            let total = MeasureMath.totalDistanceMeters(measureRoute)
            let mins = MeasureMath.estimatedDriveMinutes(total)
            let fuel = MeasureMath.estimatedFuelKr(total)
            let names = measureRoute.map(\.displayName).joined(separator: " → ")
            return "\(names)\n\(measureUnit.format(total)) · ~\(mins) min · ~\(fuel) kr drivstoff"
        case .radius:
            guard let c = measureRadiusCenter else { return "Ingen radius å dele." }
            let leads = leadsWithinRadius(center: c, km: measureRadiusKm)
            return "Radius: \(Self.formatRadiusKm(measureRadiusKm)) · \(leads) leads innenfor"
        }
    }

    /// Aktivitets-badge på mini-kart-pin: viser om lead-en har møte booket
    /// eller er merket med oppfølging. `nil` = ingen badge.
    private func miniPinActivityKind(for lead: LeadModel) -> MiniPin.ActivityKind? {
        if lead.status == .meetingBooked { return .meeting }
        if lead.nextFollowUpAt != nil { return .followUp }
        return nil
    }

    /// Auto-velg nærmeste lead (i mini-kart-data-settet) for VisitLogModal.
    /// Hvis ingen leads finnes, bygg placeholder-LeadModel via JSON.
    private func miniNearestLead(from coord: CLLocationCoordinate2D) -> LeadModel {
        if let nearest = pinnedLeads.min(by: { a, b in
            let da = (a.latitude - coord.latitude) * (a.latitude - coord.latitude)
                   + (a.longitude - coord.longitude) * (a.longitude - coord.longitude)
            let db = (b.latitude - coord.latitude) * (b.latitude - coord.latitude)
                   + (b.longitude - coord.longitude) * (b.longitude - coord.longitude)
            return da < db
        }) {
            return nearest
        }
        // Fallback: konstruer LeadModel direkte. Tidligere brukte vi JSON-
        // decode med `"status": "new"` — men LeadStatus har ikke `.new` →
        // decodeFailed → fatalError → app-krasj når mini-kartet var tomt
        // og bruker tappet «Registrer besøk» eller «Ny lead». Fix 2026-07-02.
        return placeholderLead(at: coord)
    }

    private func placeholderLead(at coord: CLLocationCoordinate2D) -> LeadModel {
        LeadModel(
            id: "map-tap-\(Int(coord.latitude * 1000))-\(Int(coord.longitude * 1000))",
            name: "Ny besøkspunkt",
            company: nil,
            category: nil,
            status: .unvisited,
            address: nil,
            postalCode: nil,
            city: nil,
            country: "NO",
            latitude: coord.latitude,
            longitude: coord.longitude,
            phone: nil,
            email: nil,
            websiteUrl: nil,
            instagramUrl: nil,
            linkedinUrl: nil,
            googleRating: nil,
            googlePlaceId: nil,
            logoUrl: nil,
            aiOpportunityScore: nil,
            estimatedValue: nil,
            leadSource: "map_tap",
            assignedUserId: nil,
            assignedUserName: nil,
            assignedUserEmail: nil,
            projectId: nil,
            lastVisitAt: nil,
            nextFollowUpAt: nil,
            nextAction: nil,
            tags: nil,
            notes: nil,
            createdAt: Date(),
            updatedAt: Date(),
            leadTemperature: nil,
            pipelineStage: nil,
            leadScore: nil,
            industryId: nil
        )
    }

    private func miniShowToast(_ msg: String) {
        miniToast = msg
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if miniToast == msg { miniToast = nil }
        }
    }

    /// Måle-modus-marker (A eller B) — grønn sirkel m/ label.
    private func miniMeasureMarker(label: String) -> some View {
        ZStack {
            Circle().fill(Brand.green)
                .overlay(Circle().stroke(.white, lineWidth: 2))
            Text(label)
                .font(.appScaled(size: 10, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
        }
        .frame(width: 22, height: 22)
        .shadow(color: Brand.green.opacity(0.6), radius: 5, y: 2)
        // 2026-07-02 (iter 4): 22pt så pin-toppen med score fortsatt titter
        // frem. Anchor `.center` gjør at markøren sitter PÅ lead-koord —
        // MapPolyline-endepunkt = markørens sentrum = visuelt festet.
    }

    /// Stabil drag-gesture (2026-07-02, iteration 3). Markøren dras via
    /// `.offset()` pixel-vis under drag; ekte koord oppdateres kun ved
    /// `onEnded`. Det gjør Annotation-koord konstant gjennom hele drag →
    /// ingen re-render, ingen hit-target rebind, ingen jitter.
    ///
    /// `targetId` skiller markørene så bare den aktive får offset. En
    /// enkelt måle-modus krever bare én aktiv drag om gangen, så vi
    /// deler global `measureDragTranslation`/`measureDragTargetId`.
    private func dragGesture(
        proxy: MapProxy,
        targetId: String,
        startCoord: @escaping () -> CLLocationCoordinate2D?,
        onDrag: @escaping (CLLocationCoordinate2D) -> Void,
        onEnded: (() -> Void)? = nil
    ) -> some Gesture {
        DragGesture(minimumDistance: 6, coordinateSpace: .named("miniMap"))
            .onChanged { value in
                if measureDragTargetId == nil {
                    measureDragTargetId = targetId
                    measureDragStartCoord = startCoord()
                }
                guard measureDragTargetId == targetId else { return }
                measureDragTranslation = value.translation
            }
            .onEnded { value in
                defer {
                    measureDragTargetId = nil
                    measureDragTranslation = .zero
                    measureDragStartCoord = nil
                }
                guard measureDragTargetId == targetId,
                      let start = measureDragStartCoord,
                      let startPt = proxy.convert(start, to: .named("miniMap"))
                else { return }
                let endPt = CGPoint(
                    x: startPt.x + value.translation.width,
                    y: startPt.y + value.translation.height
                )
                if let newCoord = proxy.convert(endPt, from: .named("miniMap")) {
                    onDrag(newCoord)
                }
                onEnded?()
            }
    }

    /// Live offset for en markør under drag — pikselverdien. Alle andre
    /// markører får `.zero`.
    private func draggingOffset(for targetId: String) -> CGSize {
        measureDragTargetId == targetId ? measureDragTranslation : .zero
    }

    /// Trigg Dock-style bounce på en lead-pin — visuell bekreftelse på at
    /// rute-punktet «snappet på» leaden. `.keyframeAnimator` reagerer på
    /// counter-endring og går gjennom 3 avtagende hopp med elastisk
    /// stretch/squash. Samme rytme som macOS Dock når en app krever
    /// oppmerksomhet.
    private func triggerLeadBounce(_ leadId: String) {
        bounceCounters[leadId, default: 0] += 1
    }

    /// Sett en lead som min nåværende destinasjon. Trigger bounce på leaden,
    /// lagrer state, viser slide-in toast + tegner stiplet linje fra avatar
    /// til lead. Kan avbrytes ved å klikke toasten eller velge annen lead.
    private func assignAsMyDestination(_ lead: LeadModel) {
        triggerLeadBounce(lead.id)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
            assignedDestination = lead
            assignedDestinationToastVisible = true
        }
        // Haptic på iPad + Mac Catalyst — bekrefter valget.
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        #endif
        // Auto-skjul toasten etter 4 sek (destinasjonen forblir aktiv).
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) {
            withAnimation(.snappy(duration: 0.25)) {
                assignedDestinationToastVisible = false
            }
        }
    }

    /// Fullfør team-tildeling — vis suksess-toast + haptic, og persister
    /// til backend (`POST /api/leadgrid/lead-assignments`, mig 0361) så
    /// mottakeren får in-app varsel og tildelingen synkes på tvers av
    /// enheter. Fire-and-forget — toast vises uansett (optimistisk UX).
    private func completeTeamAssignment(_ assignment: LeadAssignment) {
        if let api = appState.api {
            let payload = LeadAssignmentPayload(
                leadId: assignment.leadId.hasPrefix("lead-") ? nil : assignment.leadId,
                leadName: assignment.leadName,
                leadLat: assignment.leadCoordinate.latitude,
                leadLng: assignment.leadCoordinate.longitude,
                assigneeUserId: assignment.assigneeUserId,
                assigneeRole: assignment.assigneeRole.rawValue,
                priority: assignment.priority.rawValue,
                message: assignment.message
            )
            Task { try? await api.createLeadAssignment(payload) }
        }
        lastCompletedAssignment = assignment
        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
            assignmentSuccessToastVisible = true
        }
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
        // Auto-skjul etter 3s
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            withAnimation(.snappy(duration: 0.25)) {
                assignmentSuccessToastVisible = false
            }
        }
    }

    /// Suksess-toast som viser hvem som fikk oppdraget + prioritet.
    /// Bruker rolle-fargen for tydelig avsender-visning.
    @ViewBuilder
    private func assignmentSuccessToast(assignment a: LeadAssignment) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(a.assigneeRole.color.opacity(0.22))
                Circle().strokeBorder(a.assigneeRole.color.opacity(0.55), lineWidth: 1)
                Image(systemName: "checkmark")
                    .font(.appScaled(size: 14, weight: .heavy))
                    .foregroundStyle(a.assigneeRole.color)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text("OPPDRAG SENDT")
                        .font(.appScaled(size: 9, weight: .black, design: .rounded))
                        .tracking(1.0)
                        .foregroundStyle(a.assigneeRole.color)
                    if a.priority != .normal {
                        HStack(spacing: 3) {
                            Image(systemName: a.priority.icon)
                                .font(.appScaled(size: 8, weight: .bold))
                            Text(a.priority.label.uppercased())
                                .font(.appScaled(size: 8, weight: .heavy, design: .rounded))
                                .tracking(0.6)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(a.priority.color, in: Capsule())
                    }
                }
                Text("\(a.assigneeName) → \(a.leadName)")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Button {
                withAnimation(.snappy(duration: 0.2)) {
                    assignmentSuccessToastVisible = false
                }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.appScaled(size: 16))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Brand.card.opacity(0.98), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(a.assigneeRole.color.opacity(0.5), lineWidth: 1.5)
        )
        .shadow(color: .black.opacity(0.35), radius: 12, y: 4)
        .frame(maxWidth: 420)
    }

    /// Demo → mock-liste; ellers ekte team-medlemmer fra TeamLiveStore
    /// (`/sales-leadership/team-members`). Avstand fra lead-koord har vi
    /// ingen live-posisjonskilde for i denne konteksten enda → nil (UI-et
    /// skjuler avstands-raden). Tom liste → sheetens egen empty-state.
    private func assignableMembers(for lead: LeadModel) -> [AssignableTeamMember] {
        guard !DemoModeManager.isActiveNonisolated else {
            return mockAssignableMembers(for: lead)
        }
        return TeamLiveStore.shared.memberDTOs.map { dto in
            let initials = dto.name.split(separator: " ")
                .prefix(2).compactMap { $0.first }.map(String.init).joined()
            return AssignableTeamMember(
                userId: dto.userId,
                name: dto.name,
                email: dto.email,
                title: dto.title,
                role: .seller,
                distanceKm: nil,
                weeklyWon: dto.won,
                isAvailable: nil,
                avatarInitials: initials.isEmpty ? "?" : initials
            )
        }
    }

    /// Mock team-medlem-liste — KUN demo-modus.
    private func mockAssignableMembers(for lead: LeadModel) -> [AssignableTeamMember] {
        let leadLoc = CLLocation(latitude: lead.latitude, longitude: lead.longitude)
        func dist(_ lat: Double, _ lon: Double) -> Double {
            leadLoc.distance(from: CLLocation(latitude: lat, longitude: lon)) / 1000.0
        }
        return [
            AssignableTeamMember(
                userId: "u-anne",
                name: "Anne Berg",
                email: "anne@leadgrid.no",
                title: "Senior selger",
                role: .seller,
                distanceKm: dist(59.925, 10.750),
                weeklyWon: 4,
                isAvailable: true,
                avatarInitials: "AB"
            ),
            AssignableTeamMember(
                userId: "u-lars",
                name: "Lars Kristiansen",
                email: "lars@leadgrid.no",
                title: "Selger",
                role: .seller,
                distanceKm: dist(59.910, 10.780),
                weeklyWon: 6,
                isAvailable: true,
                avatarInitials: "LK"
            ),
            AssignableTeamMember(
                userId: "u-marit",
                name: "Marit Olsen",
                email: "marit@leadgrid.no",
                title: "Promotør",
                role: .promoter,
                distanceKm: dist(59.940, 10.730),
                weeklyWon: 2,
                isAvailable: false,
                avatarInitials: "MO"
            ),
            AssignableTeamMember(
                userId: "u-espen",
                name: "Espen Haug",
                email: "espen@leadgrid.no",
                title: "Promotør",
                role: .promoter,
                distanceKm: dist(59.905, 10.760),
                weeklyWon: 3,
                isAvailable: true,
                avatarInitials: "EH"
            ),
            AssignableTeamMember(
                userId: "u-sofie",
                name: "Sofie Dahl",
                email: "sofie@leadgrid.no",
                title: "Teamleder",
                role: .manager,
                distanceKm: dist(59.920, 10.770),
                weeklyWon: 1,
                isAvailable: true,
                avatarInitials: "SD"
            ),
        ]
    }

    /// Avstand fra bruker til gitt koord i km. Nil hvis vi ikke har
    /// user-koord (location-tillatelse ikke gitt).
    private func distanceFromMeKm(to coord: CLLocationCoordinate2D) -> Double? {
        guard let me = KartLocationManager.shared.currentCoordinate else { return nil }
        return CLLocation(latitude: me.latitude, longitude: me.longitude)
            .distance(from: CLLocation(latitude: coord.latitude, longitude: coord.longitude))
            / 1000.0
    }

    /// Fjern nåværende destinasjon (bruker klikker toast eller X).
    private func clearAssignedDestination() {
        withAnimation(.spring(response: 0.28, dampingFraction: 0.85)) {
            assignedDestination = nil
            assignedDestinationToastVisible = false
        }
    }

    /// Notification-style toast for tildelt destinasjon. Viser lead-navn,
    /// «Naviger»-CTA (åpner Apple Maps) og X for å fjerne destinasjonen.
    @ViewBuilder
    private func assignedDestinationToast(dest: LeadModel) -> some View {
        HStack(spacing: 12) {
            // Grønn pulserende dot for «aktiv destinasjon»
            Circle()
                .fill(Brand.green)
                .frame(width: 8, height: 8)
                .shadow(color: Brand.green.opacity(0.7), radius: 4)
            VStack(alignment: .leading, spacing: 2) {
                Text("NY DESTINASJON")
                    .font(.appScaled(size: 9, weight: .black, design: .rounded))
                    .tracking(1.0)
                    .foregroundStyle(Brand.green)
                Text(dest.name)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            // Leadgrids egen nav-motor (Kart-fanen), ikke Apple Maps.
            Button {
                appState.requestNavigation(
                    lat: dest.latitude, lon: dest.longitude,
                    name: dest.name, address: dest.address ?? "",
                    start: true, transport: "driving")
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "location.north.line.fill")
                        .font(.appScaled(size: 10, weight: .bold))
                    Text("Naviger")
                        .font(.appScaled(size: 12, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(Brand.green, in: Capsule())
            }
            .buttonStyle(.plain)
            // Fjern destinasjon
            Button {
                clearAssignedDestination()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.appScaled(size: 16))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Brand.card.opacity(0.98), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(Brand.green.opacity(0.5), lineWidth: 1.5)
        )
        .shadow(color: .black.opacity(0.35), radius: 12, y: 4)
        .frame(maxWidth: 420)
    }

    /// Lukk info-kortet med snappy-animasjon. Gates på 80ms buffer siden
    /// åpning (så åpnings-layoutens minimale camera-nudge ikke selv-lukker)
    /// + hopper over hvis bruker drar en måle-markør. Kalles fra begge
    /// gesture-lyttere så vi fanger både pan (via DragGesture) og scroll-
    /// zoom (via onMapCameraChange) med samme respons.
    private func closeInfoCardIfMapMoved() {
        guard mapSelectedLead != nil,
              measureDragTargetId == nil,
              let openTime = mapSelectedLeadOpenTime,
              Date().timeIntervalSince(openTime) > 0.08
        else { return }
        withAnimation(.snappy(duration: 0.18)) {
            mapSelectedLead = nil
        }
        mapSelectedLeadOpenTime = nil
    }

    // MARK: - Måle-banner UI

    /// Rader i måle-banneret: header + mode-picker + radius-slider + toolbar
    /// samt visualisering-lag (linjer / sirkel) rendret INNE i Map { … }.

    private var measureBannerHeader: some View {
        HStack(spacing: DeviceIdiom.isPhone ? 6 : 8) {
            Image(systemName: "ruler.fill")
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(Brand.green)
            if DeviceIdiom.isPhone {
                // Kompakt phone-variant: kun måle-teksten — overskriften
                // sløyfes (ikonet + avstanden er nok signal).
                Text(miniMeasureBannerText)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    Text("MÅLE-VERKTØY")
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(Brand.green).tracking(0.6)
                    Text(miniMeasureBannerText)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                }
            }
            Spacer()
            Menu {
                Section("Enhet") {
                    ForEach(MeasureUnit.allCases) { u in
                        Button {
                            measureUnit = u
                        } label: {
                            if u == measureUnit {
                                Label(u.label, systemImage: "checkmark")
                            } else {
                                Text(u.label)
                            }
                        }
                    }
                }
            } label: {
                if DeviceIdiom.isPhone {
                    // Enhets-velgeren bak et kompakt ellipsis-ikon på phone
                    // (metrisk er default i Norge — sjelden brukt).
                    Image(systemName: "ellipsis")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 6)
                        .background(Brand.cardHi, in: Capsule())
                } else {
                    HStack(spacing: 3) {
                        Text(measureUnit.label)
                            .font(.appScaled(size: 10, weight: .semibold))
                        Image(systemName: "chevron.down")
                            .font(.appScaled(size: 8, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Brand.cardHi, in: Capsule())
                }
            }
            Button {
                miniMeasureMode = false
                measureResetAll()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.appScaled(size: 16))
                    .foregroundStyle(.white.opacity(0.8))
            }.buttonStyle(.plain)
        }
    }

    private var measureKindPicker: some View {
        HStack(spacing: 4) {
            ForEach(MeasureKind.allCases) { kind in
                let isActive = kind == measureKind
                Button {
                    measureKind = kind
                    // Bytt kind = nullstill så vi ikke blander punkter
                    measureResetAll()
                } label: {
                    HStack(spacing: DeviceIdiom.isPhone ? 4 : 5) {
                        Image(systemName: kind.icon)
                            .font(.appScaled(size: DeviceIdiom.isPhone ? 9 : 10, weight: .bold))
                        Text(kind.label)
                            .font(.appScaled(size: DeviceIdiom.isPhone ? 9 : 10, weight: .semibold))
                    }
                    .foregroundStyle(isActive ? .white : Brand.textSecondary)
                    .padding(.horizontal, DeviceIdiom.isPhone ? 7 : 8)
                    .padding(.vertical, DeviceIdiom.isPhone ? 4 : 5)
                    .background(
                        isActive ? Brand.green.opacity(0.55) : Color.white.opacity(0.06),
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var measureRadiusSlider: some View {
        HStack(spacing: 8) {
            Text("Radius: \(Self.formatRadiusKm(measureRadiusKm))")
                .font(.appScaled(size: 10, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 100, alignment: .leading)
            Slider(value: $measureRadiusKm, in: 0.5...25, step: 0.5)
                .tint(Brand.green)
        }
    }

    private var measureBottomToolbar: some View {
        HStack(spacing: 6) {
            // Nullstill
            Button {
                measureResetAll()
                miniShowToast("Nullstilt")
            } label: {
                Image(systemName: "arrow.counterclockwise")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(6)
                    .background(Brand.cardHi, in: Circle())
            }.buttonStyle(.plain)
            // Konvex hull-toggle (kun i rute-modus m/ 3+ punkter)
            if measureKind == .route && measureRoute.count >= 3 {
                Button {
                    measureShowHull.toggle()
                    let hull = MeasureMath.convexHull(measureRoute)
                    let area = MeasureMath.polygonAreaMeters2(hull) / 1_000_000
                    miniShowToast(
                        measureShowHull
                            ? String(format: "Dekker %.1f km²", area)
                            : "Hull skjult"
                    )
                } label: {
                    Image(systemName: measureShowHull ? "hexagon.fill" : "hexagon")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(measureShowHull ? Brand.purpleLight : .white)
                        .padding(6)
                        .background(
                            measureShowHull ? Brand.purple.opacity(0.25) : Brand.cardHi,
                            in: Circle()
                        )
                }
                .buttonStyle(.plain)
            }
            // Del
            ShareLink(item: measureShareText()) {
                Image(systemName: "square.and.arrow.up")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(6)
                    .background(Brand.cardHi, in: Circle())
            }
            // Lagre
            Button {
                showSaveMeasureSheet = true
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "bookmark.fill")
                        .font(.appScaled(size: 10, weight: .bold))
                    Text("Lagre")
                        .font(.appScaled(size: 10, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 8).padding(.vertical, 6)
                .background(Brand.green, in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(!measureHasContent)
            // Åpne lagret
            Button {
                showSavedMeasureSheet = true
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.appScaled(size: 10, weight: .bold))
                    Text("Lagret (\(measureSavedRoutes.count))")
                        .font(.appScaled(size: 10, weight: .bold))
                }
                .foregroundStyle(Brand.purpleLight)
                .padding(.horizontal, 8).padding(.vertical, 6)
                .background(Brand.card, in: Capsule())
                .overlay(Capsule().strokeBorder(Brand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Spacer(minLength: 0)
        }
    }

    /// Har vi noe å lagre / dele? Brukes til å disable lagre-knappen.
    private var measureHasContent: Bool {
        switch measureKind {
        case .distance: return miniMeasureA != nil && miniMeasureB != nil
        case .route:    return measureRoute.count >= 2
        case .radius:   return measureRadiusCenter != nil
        }
    }

    /// Instruksjon i måle-modus-banner. Viser status pr. valgt kind.
    private var miniMeasureBannerText: String {
        switch measureKind {
        case .distance:
            if let a = miniMeasureA, let b = miniMeasureB {
                let d = MeasureMath.distanceMeters(a, b)
                return "Avstand: \(measureUnit.format(d))"
            }
            if miniMeasureA != nil { return "Tap for punkt B" }
            return measureKind.tip
        case .route:
            if measureRoute.count >= 2 {
                // Foretrekk ekte MKDirections når vi har svar; ellers Haversine-est.
                if let real = measureRealDrive {
                    let mins = Int((real.expectedTravelTime / 60).rounded())
                    return "\(measureRoute.count) stopp · \(measureUnit.format(real.distanceMeters)) · \(mins) min"
                }
                let d = MeasureMath.totalDistanceMeters(measureRoute)
                let mins = MeasureMath.estimatedDriveMinutes(d)
                return "\(measureRoute.count) stopp · \(measureUnit.format(d)) · ~\(mins) min"
            }
            if measureRoute.count == 1 { return "Tap neste stopp" }
            return measureKind.tip
        case .radius:
            if let c = measureRadiusCenter {
                let leads = leadsWithinRadius(center: c, km: measureRadiusKm)
                return "\(Self.formatRadiusKm(measureRadiusKm)) · \(leads) leads innenfor"
            }
            return measureKind.tip
        }
    }

    private func miniFABButton(icon: String, action: @escaping () -> Void) -> some View {
        // Mac Catalyst-fix (3, endelig): kombinerer tre robusthetstiltak:
        // 1) Button + .buttonStyle(.plain) — native NSButton på Catalyst
        // 2) Større 44×44 hit-target (matcher Apple HIG minimum touch target)
        // 3) .contentShape(Rectangle()) sikrer hele frame er klikkbart
        // Sammen med .zIndex(100) på FAB-VStack (settes lenger opp) gir
        // dette stabil oppførsel på både iPad og Mac.
        // iPhone (QA-runde 2): 44pt-knappene dominerte det lille innfelte
        // kartet — 36×36 m/ 13pt ikon der; iPad/Mac beholder 44 (HIG).
        let side: CGFloat = DeviceIdiom.isPhone ? 36 : 44
        let iconSize: CGFloat = DeviceIdiom.isPhone ? 13 : 16
        return Button(action: action) {
            Image(systemName: icon)
                // Fast kart-FAB-ramme — ikonet skal ikke AX-skalere
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: side, height: side)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Mini-kart-actions

    /// Halverer span med animation. Klamped til 100m minimum.
    private func miniZoomIn() {
        let minDelta = 0.001
        let newLat = max(minDelta, miniCurrentRegion.span.latitudeDelta * 0.5)
        let newLon = max(minDelta, miniCurrentRegion.span.longitudeDelta * 0.5)
        let newRegion = MKCoordinateRegion(
            center: miniCurrentRegion.center,
            span: MKCoordinateSpan(latitudeDelta: newLat, longitudeDelta: newLon)
        )
        miniCurrentRegion = newRegion
        withAnimation(.easeInOut(duration: 0.3)) { miniCamera = .region(newRegion) }
    }

    /// Dobler span med animation. Klamped til 120° maks (~kontinent).
    private func miniZoomOut() {
        let maxDelta = 120.0
        let cLat = max(miniCurrentRegion.span.latitudeDelta, 0.001)
        let cLon = max(miniCurrentRegion.span.longitudeDelta, 0.001)
        let newRegion = MKCoordinateRegion(
            center: miniCurrentRegion.center,
            span: MKCoordinateSpan(
                latitudeDelta: min(maxDelta, cLat * 2.0),
                longitudeDelta: min(maxDelta, cLon * 2.0)
            )
        )
        miniCurrentRegion = newRegion
        withAnimation(.easeInOut(duration: 0.3)) { miniCamera = .region(newRegion) }
    }

    /// Sentrer på ekte user-location via KartLocationManager (gjenbruk).
    private func miniCenterOnMe() {
        KartLocationManager.shared.requestIfNeeded()
        let coord = KartLocationManager.shared.currentCoordinate
            ?? CLLocationCoordinate2D(latitude: 59.913, longitude: 10.753)
        let newRegion = MKCoordinateRegion(
            center: coord,
            span: MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.04)
        )
        miniCurrentRegion = newRegion
        withAnimation(.easeInOut(duration: 0.4)) { miniCamera = .region(newRegion) }
    }

}

/// Mini-versjon av prod-pinen (LeadPinView). GJENBRUKER `OvDropPin`,
/// `OvGlowHalo` og samme farge-logikk fra LeadPinView.swift — slik at
/// kart-thumbnail på Oversikt ser ut nøyaktig som pinene på Kart-tab.
/// Bare nedskalert for å passe i thumbnail-størrelse.
/// Horisontal score-fordeling-strip — erstatter Lead score donut-card.
/// Viser 4 temperatur-tier som tap-bar med samme farger som kart-pinene.
/// Fungerer både som visualisering OG som filter-shortcut.
private struct LeadScoreFilterStrip: View {
    let leads: [LeadModel]
    @Binding var activeTier: LeadTemperatureTier

    private struct Tier {
        let key: LeadTemperatureTier
        let label: String
        let count: Int
        let color: Color
        let glow: Color?
    }

    private var tiers: [Tier] {
        let hot   = leads.filter {
            ($0.leadScore ?? 0) >= 70 || $0.status == .meetingBooked
        }.count
        let warm  = leads.filter {
            (50..<70).contains($0.leadScore ?? -1) && $0.status != .meetingBooked
        }.count
        let luke  = leads.filter { (30..<50).contains($0.leadScore ?? -1) }.count
        let cold  = leads.filter { ($0.leadScore ?? 0) < 30 }.count
        return [
            Tier(key: .hot,  label: "Hot",    count: hot,
                 color: Brand.purple, glow: Brand.red),
            Tier(key: .warm, label: "Varm",   count: warm,
                 color: Brand.yellow, glow: Brand.orange),
            Tier(key: .luke, label: "Lunken", count: luke,
                 color: Brand.orange, glow: nil),
            Tier(key: .cold, label: "Kald",   count: cold,
                 color: Color(red: 0.45, green: 0.50, blue: 0.62), glow: nil),
        ]
    }

    var body: some View {
        // QA-runde 2 (Daniel): chips med 0 sier ingenting og stjeler en hel
        // rad — vis kun tiers med innhold (+ den aktive så toggle-tilbake
        // alltid er mulig). Alt-null → skjul hele stripen.
        let visible = tiers.filter { $0.count > 0 || activeTier == $0.key }
        if !visible.isEmpty {
            HStack(spacing: 8) {
                ForEach(0..<visible.count, id: \.self) { idx in
                    tierChip(visible[idx])
                        // 1-2 chips skal ikke strekkes over hele raden —
                        // naturlig bredde + venstrejustering ser riktig ut.
                        .fixedSize(horizontal: visible.count <= 2, vertical: false)
                }
                if visible.count <= 2 { Spacer(minLength: 0) }
            }
        }
    }

    private func tierChip(_ tier: Tier) -> some View {
        // Pakke 10.1: hver chip er nå tap-bar. Tap toggler mellom «alle» og
        // den spesifikke tier — så andre gang du tapper Hot går du tilbake
        // til «vis alle».
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                activeTier = (activeTier == tier.key) ? .all : tier.key
            }
        } label: {
            HStack(spacing: 8) {
                ZStack {
                    if let glow = tier.glow {
                        Circle().fill(glow.opacity(0.5))
                            .frame(width: 14, height: 14)
                            .blur(radius: 2)
                    }
                    Circle().fill(tier.color)
                        .overlay(Circle().stroke(Color.white.opacity(0.9), lineWidth: 1))
                        .frame(width: 10, height: 10)
                }
                .frame(width: 18, height: 14)

                VStack(alignment: .leading, spacing: 0) {
                    Text(tier.label)
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(.white)
                        // iPhone-QA: «Lunken» brakk til «Lunke / n» på 4
                        // chips over 390pt — labels skal aldri ordbrytes.
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                    Text("\(tier.count.formatted(.number.locale(Locale(identifier: "nb_NO"))))")
                        .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(
                activeTier == tier.key
                    ? tier.color.opacity(0.18)
                    : Brand.cardHi,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(
                        activeTier == tier.key ? tier.color.opacity(0.6) : Brand.stroke,
                        lineWidth: activeTier == tier.key ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

/// Pin på Oversikt-mini-kartet. **Match Kart-fanens `StatusPin`-design**
/// (Daniel-feedback 2026-07-01) — full glow, gradient-fyll med hvit
/// high-light, 2-3 px hvit stroke og status-farget shadow. Beholder
/// lead-score som tekst i pinen (mer info-tett enn bygg-ikonet på
/// hovedkartet).
/// Info-kort som overlay på selve mini-kartet når bruker tapper en pin.
/// Viser navn, logo/initialer, score-pin, adresse, telefon/e-post og status.
/// «Les mer» → NotificationCenter → bytt til Leads-fanen + åpne detalj.
private struct MapLeadInfoCard: View {
    @Environment(AppState.self) private var appState
    let lead: LeadModel
    let onClose: () -> Void
    let onOpenLead: (LeadModel) -> Void
    let onAssignAsDestination: (LeadModel) -> Void
    let onAssignToTeamMember: (LeadModel) -> Void
    /// Er innlogget bruker salgssjef/teamleder? Bestemmer om «Tildel til…»-
    /// CTA vises. False for vanlige selgere/promotører.
    let canAssignToOthers: Bool

    private var accentColor: Color {
        let score = lead.leadScore ?? 0
        if score >= 90 || lead.status == .meetingBooked { return Brand.purple }
        if score >= 70 { return Brand.red }
        if score >= 50 { return Brand.yellow }
        return Color(red: 0.55, green: 0.60, blue: 0.68)
    }

    private var statusLabel: String {
        switch lead.status {
        case .meetingBooked: return "Møte booket"
        case .interested:    return "Interessert"
        case .proposalSent:  return "Tilbud sendt"
        case .won:           return "Vunnet"
        case .lost:          return "Tapt"
        case .visited:       return "Besøkt"
        case .return:        return "Kom tilbake"
        case .notPresent:    return "Ikke tilstede"
        case .declined:      return "Avslo"
        case .doNotContact:  return "Ikke kontakt"
        case .unvisited:     return "Ikke besøkt"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            headerRow
            Divider().background(Brand.stroke)
            details
            actions
        }
        .padding(14)
        .frame(maxWidth: 420)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Brand.card)
                .shadow(color: .black.opacity(0.35), radius: 18, y: 6)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Brand.stroke, lineWidth: 1)
        )
    }

    private var headerRow: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(accentColor.opacity(0.22))
                Circle().strokeBorder(accentColor.opacity(0.55), lineWidth: 1)
                Text(String(lead.name.prefix(2)).uppercased())
                    .font(.appScaled(size: 14, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(lead.name)
                    .font(.appScaled(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let city = lead.city, !city.isEmpty {
                    Text(city)
                        .font(.appScaled(size: 12))
                        .foregroundStyle(Brand.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            // Score-badge
            HStack(spacing: 4) {
                Image(systemName: "flame.fill")
                    .font(.appScaled(size: 10, weight: .bold))
                Text("\(lead.leadScore ?? 0)")
                    .font(.appScaled(size: 12, weight: .heavy, design: .rounded))
                    .monospacedDigit()
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(accentColor, in: Capsule())
            Button {
                onClose()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.appScaled(size: 18))
                    .foregroundStyle(Brand.textSecondary)
            }
            .buttonStyle(.plain)
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(accentColor)
                Text(statusLabel)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
            }
            if let address = lead.address, !address.isEmpty {
                detailRow(icon: "mappin.and.ellipse", text: address)
            }
            if let phone = lead.phone, !phone.isEmpty {
                detailRow(icon: "phone.fill", text: phone)
            }
            if let email = lead.email, !email.isEmpty {
                detailRow(icon: "envelope.fill", text: email)
            }
            if let value = lead.estimatedValue, value > 0 {
                detailRow(
                    icon: "banknote.fill",
                    text: "NOK \(Int(value).formatted(.number.locale(Locale(identifier: "nb_NO"))))"
                )
            }
        }
    }

    private func detailRow(icon: String, text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.appScaled(size: 10, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
                .frame(width: 14)
            Text(text)
                .font(.appScaled(size: 12))
                .foregroundStyle(Brand.textSecondary)
                .lineLimit(1)
        }
    }

    private var actions: some View {
        VStack(spacing: 8) {
            // Primær-CTA-rad: Send meg dit + (salgssjef) Tildel til…
            HStack(spacing: 8) {
                // Send meg dit — «reis dit selv»-CTA (grønn)
                Button {
                    onAssignAsDestination(lead)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "target")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text("Send meg dit")
                            .font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(
                        LinearGradient(colors: [Brand.green, Brand.green.opacity(0.7)],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                    .shadow(color: Brand.green.opacity(0.4), radius: 6, y: 2)
                }
                .buttonStyle(.plain)
                .help("Sett \(lead.name) som min destinasjon")

                // Tildel til teammedlem — synlig kun for salgssjef/teamleder
                if canAssignToOthers {
                    Button {
                        onAssignToTeamMember(lead)
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "person.2.badge.plus.fill")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text("Tildel…")
                                .font(.appScaled(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .frame(maxWidth: .infinity)
                        .background(
                            LinearGradient(colors: [Brand.purple, Brand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: Capsule()
                        )
                        .shadow(color: Brand.purple.opacity(0.4), radius: 6, y: 2)
                    }
                    .buttonStyle(.plain)
                    .help("Send \(lead.name) til en selger eller promotør")
                }
            }

            // Sekundær-rad: Naviger + Ring + E-post + Les mer
            HStack(spacing: 8) {

            // Naviger — åpner Apple Maps med kjøreanvisning til lead-koord.
            Button {
                openInAppleMaps()
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "location.north.line.fill")
                        .font(.appScaled(size: 10, weight: .bold))
                    Text("Naviger")
                        .font(.appScaled(size: 12, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(Brand.green, in: Capsule())
                .shadow(color: Brand.green.opacity(0.35), radius: 5, y: 2)
            }
            .buttonStyle(.plain)
            .help("Åpne kjørerute i Apple Maps")

            // Ring — bare synlig hvis vi har telefonnummer.
            if let phone = lead.phone, !phone.isEmpty,
               let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                Link(destination: url) {
                    Image(systemName: "phone.fill")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(8)
                        .background(Brand.card, in: Circle())
                        .overlay(Circle().strokeBorder(Brand.stroke, lineWidth: 1))
                }
                .help("Ring \(phone)")
            }

            // E-post — bare synlig hvis vi har e-postadresse.
            if let email = lead.email, !email.isEmpty,
               let url = URL(string: "mailto:\(email)") {
                Link(destination: url) {
                    Image(systemName: "envelope.fill")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(8)
                        .background(Brand.card, in: Circle())
                        .overlay(Circle().strokeBorder(Brand.stroke, lineWidth: 1))
                }
                .help("Send e-post til \(email)")
            }

            Spacer(minLength: 0)

            // Les mer — primær-CTA som hopper til Leads-fanen.
            Button {
                onOpenLead(lead)
            } label: {
                HStack(spacing: 5) {
                    Text("Les mer")
                        .font(.appScaled(size: 12, weight: .bold))
                    Image(systemName: "arrow.right")
                        .font(.appScaled(size: 10, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(
                    LinearGradient(colors: [Brand.purple, Brand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Capsule()
                )
                .shadow(color: Brand.purple.opacity(0.35), radius: 5, y: 2)
            }
            .buttonStyle(.plain)
            } // slutt HStack sekundær-rad
        } // slutt VStack actions
    }

    /// Naviger til lead-en i Leadgrids egen nav-motor (Kart-fanen) —
    /// turn-by-turn in-app, ikke Apple Maps.
    private func openInAppleMaps() {
        appState.requestNavigation(
            lat: lead.latitude, lon: lead.longitude,
            name: lead.name, address: lead.address ?? "",
            start: true, transport: "driving")
    }
}

/// Keyframe-state for Dock-style bounce på lead-pins. `offsetY` er
/// vertikal translate (negative = opp), `scaleX/scaleY` er elastisk
/// stretch/squash for gummi-følelse ved landing.
private struct BounceKeyframe {
    var offsetY: CGFloat = 0
    var scaleX: CGFloat = 1.0
    var scaleY: CGFloat = 1.0
}

/// «Neste handling»-kort under mini-kartet på iPhone (QA-runde 2):
/// neste kommende møte + forfalte oppfølginger — det en selger trenger
/// på farten. Tom-tilstand med hint når ingenting er planlagt.
private struct NextActionCard: View {
    @Environment(AppState.self) private var appState
    let leads: [LeadModel]
    @AppStorage("oversikt.kollaps.neste_handling") private var kollapset = false

    private var nextMeeting: CalendarEvent? {
        appState.calendar
            .filter { ($0.datetime ?? .distantPast) >= Date() }
            .sorted { ($0.datetime ?? .distantFuture) < ($1.datetime ?? .distantFuture) }
            .first
    }

    private var overdueFollowups: [LeadModel] {
        leads.filter { ($0.nextFollowUpAt ?? .distantFuture) < Date() }
    }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "EEE d. MMM HH:mm"
        return f
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Neste handling")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { kollapset.toggle() }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(Brand.textSecondary)
                        .rotationEffect(.degrees(kollapset ? -90 : 0))
                        .frame(width: 26, height: 26)
                        .background(Brand.cardHi, in: Circle())
                }
                .buttonStyle(.plain)
            }

            if !kollapset {
            if nextMeeting == nil && overdueFollowups.isEmpty {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 16))
                        .foregroundStyle(Brand.green)
                    Text("Ingenting planlagt — book et møte eller legg til en oppfølging fra en lead.")
                        .font(.appScaled(size: 13))
                        .foregroundStyle(Brand.textSecondary)
                }
            } else {
                if let meeting = nextMeeting {
                    actionRow(
                        icon: "calendar",
                        color: Brand.purpleLight,
                        title: meeting.leadName,
                        subtitle: meeting.datetime.map { Self.timeFormatter.string(from: $0) } ?? "Tid ikke satt"
                    )
                }
                if !overdueFollowups.isEmpty {
                    actionRow(
                        icon: "bell.badge.fill",
                        color: Brand.orange,
                        title: overdueFollowups.count == 1
                            ? "1 forfalt oppfølging"
                            : "\(overdueFollowups.count) forfalte oppfølginger",
                        subtitle: overdueFollowups.first.map { "Eldst: \($0.name)" } ?? ""
                    )
                }
            }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func actionRow(icon: String, color: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(color.opacity(0.2))
                Image(systemName: icon)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.appScaled(size: 12))
                        .foregroundStyle(Brand.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

/// Cluster-sirkel for mini-kartet — viser ANTALL leads i klyngen
/// (QA-runde 2: erstatter overlappende nåler med «0»-badge).
private struct OvClusterPin: View {
    let count: Int

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [Brand.purple.opacity(0.45), Brand.purple.opacity(0)],
                    center: .center, startRadius: 12, endRadius: 26
                ))
                .frame(width: 52, height: 52)
                .blur(radius: 3)
            Circle()
                // Mørkere lilla enn Brand.purple: hvit 14pt-tekst på
                // #a852fc ga ~3.2:1 og strøk WCAG-kontrast (a11y-audit
                // 2026-07-05). Denne gir >5:1 og beholder glow-en.
                .fill(Color(red: 0.42, green: 0.16, blue: 0.72))
                .overlay(Circle().stroke(Color.white.opacity(0.85), lineWidth: 2))
                .frame(width: 34, height: 34)
                .shadow(color: Brand.purple.opacity(0.55), radius: 6, x: 0, y: 2)
            Text("\(count)")
                // Kart-grafikk — fast størrelse (AX sprenger sirkelen)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
        }
        .contentShape(Circle())
    }
}

private struct MiniPin: View {
    let score: Int
    let isHot: Bool
    let isWarm: Bool
    /// 2026-07-02: pin får en liten badge øverst-høyre som viser hva
    /// slags aktivitet lead-en har booket:
    ///   .meeting   → lilla kalender-ikon
    ///   .followUp  → blå flagg-ikon
    ///   nil        → ingen badge
    var activityKind: ActivityKind? = nil

    enum ActivityKind { case meeting, followUp }

    private var fillColor: Color {
        if isHot || score >= 70 { return Brand.purple }
        if isWarm { return Brand.yellow }
        return Color(red: 0.55, green: 0.60, blue: 0.68)
    }

    private var shadowColor: Color {
        if isHot { return Brand.red.opacity(0.6) }
        if isWarm { return Brand.orange.opacity(0.55) }
        return fillColor.opacity(0.55)
    }

    var body: some View {
        ZStack {
            if isHot {
                OvGlowHalo(color: Brand.red)
            } else if isWarm {
                OvGlowHalo(color: Brand.orange)
            }
            ZStack {
                OvDropPin()
                    .fill(LinearGradient(
                        colors: [fillColor, fillColor.opacity(0.85)],
                        startPoint: .top, endPoint: .bottom
                    ))
                OvDropPin()
                    .fill(LinearGradient(
                        colors: [Color.white.opacity(0.35), Color.white.opacity(0)],
                        startPoint: .top, endPoint: .center
                    ))
                OvDropPin()
                    .stroke(Color.white.opacity(0.92), lineWidth: 2)
                // Score 0 = ingen informasjon — vis bygnings-ikon i stedet
                // for et misvisende «0» (QA-runde 2, Daniels funn).
                if score > 0 {
                    Text("\(score)")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                        .offset(y: -6)
                } else {
                    Image(systemName: "building.2.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .offset(y: -6)
                        // Dekorativt — pin-en som helhet er treffflaten
                        // (a11y-audit: «hit area too small» på ikonet).
                        .accessibilityHidden(true)
                }
            }
            .frame(width: 38, height: 48)
            .shadow(color: shadowColor, radius: 6, x: 0, y: 2)

            // Aktivitets-badge (topp-høyre hjørne av pinnen)
            if let kind = activityKind {
                activityBadge(kind)
                    .offset(x: 14, y: -20)
            }
        }
        .frame(width: 100, height: 100)
    }

    @ViewBuilder
    private func activityBadge(_ kind: ActivityKind) -> some View {
        let (icon, color): (String, Color) = {
            switch kind {
            case .meeting:  return ("calendar.badge.plus", Brand.purpleLight)
            case .followUp: return ("flag.fill", Brand.blue)
            }
        }()
        ZStack {
            Circle().fill(color)
                .shadow(color: color.opacity(0.6), radius: 3)
            Circle().strokeBorder(.white, lineWidth: 1.5)
            Image(systemName: icon)
                .font(.appScaled(size: 8, weight: .bold))
                .foregroundStyle(.white)
        }
        .frame(width: 18, height: 18)
    }
}

private struct FilterChip: View {
    let label: String
    let icon: String
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.appScaled(size: 10, weight: .semibold))
            Text(label).font(.appScaled(size: 11, weight: .semibold))
            Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .semibold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(Brand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(Brand.stroke, lineWidth: 1))
    }
}

// MARK: - LeadsOversiktCard (kompakt leads-liste — kartet bor på Kart-fanen)

/// Leads i området uten kart: temperatur-chips som filter + topp-liste
/// sortert på score, med intern navigasjon og hopp til Kart-fanen.
private struct LeadsOversiktCard: View {
    let leads: [LeadModel]
    @Environment(AppState.self) private var appState
    @AppStorage("oversikt.kollaps.leads") private var kollapset = false
    @State private var activeTier: LeadTemperatureTier = .all
    @State private var openLead: LeadModel?

    private var filtrerte: [LeadModel] {
        leads.filter { activeTier.matches($0) }
            .sorted { ($0.leadScore ?? 0) > ($1.leadScore ?? 0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text("Leads i området").font(.headline).foregroundStyle(.white)
                Text("\(leads.count) leads")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Spacer()
                Button {
                    appState.selectedSidebarItem = .kart
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "map.fill")
                            .font(.appScaled(size: 11, weight: .bold))
                        Text("Åpne kartet")
                            .font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(Brand.purple.opacity(0.35),
                                in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9)
                        .stroke(Brand.purple.opacity(0.5), lineWidth: 1))
                }
                .buttonStyle(.plain)
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { kollapset.toggle() }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(Brand.textSecondary)
                        .rotationEffect(.degrees(kollapset ? -90 : 0))
                        .frame(width: 26, height: 26)
                        .background(Brand.cardHi, in: Circle())
                }
                .buttonStyle(.plain)
            }
            if !kollapset {
            LeadScoreFilterStrip(leads: leads, activeTier: $activeTier)
            ForEach(filtrerte.prefix(8), id: \.id) { lead in
                leadRad(lead)
            }
            if filtrerte.count > 8 {
                Text("+ \(filtrerte.count - 8) til — se alle på kartet")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            if filtrerte.isEmpty {
                Text("Ingen leads i dette filteret")
                    .font(.caption).foregroundStyle(Brand.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 10)
            }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
        .sheet(item: $openLead) { lead in
            LeadDetailSheet(lead: lead)
        }
    }

    private func leadRad(_ lead: LeadModel) -> some View {
        let score = lead.leadScore ?? 0
        return Button { openLead = lead } label: {
            HStack(spacing: 10) {
                Text("\(score)")
                    .font(.appScaled(size: 12, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 26)
                    .background(scoreFarge(lead), in: RoundedRectangle(cornerRadius: 7))
                VStack(alignment: .leading, spacing: 1) {
                    Text(lead.name)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(lead.address ?? "")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(Brand.textTertiary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                if let verdi = lead.estimatedValue, verdi > 0 {
                    Text("kr \(Int(verdi / 1000))k")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(Brand.green)
                }
                Button {
                    appState.requestNavigation(
                        lat: lead.latitude, lon: lead.longitude,
                        name: lead.name, address: lead.address ?? "",
                        start: true, transport: "driving")
                } label: {
                    Image(systemName: "location.north.line.fill")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(Brand.purpleLight)
                        .frame(width: 32, height: 32)
                        .background(Brand.purpleLight.opacity(0.12),
                                    in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .help("Naviger til \(lead.name)")
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func scoreFarge(_ lead: LeadModel) -> Color {
        let score = lead.leadScore ?? 0
        if score >= 70 || lead.status == .meetingBooked { return Brand.purple }
        if score >= 50 { return Brand.yellow.opacity(0.75) }
        if score >= 30 { return Brand.orange.opacity(0.75) }
        return Color(red: 0.45, green: 0.50, blue: 0.62)
    }
}

// MARK: - MoteOppgaverCard (oppgaver fra møtelogging — leadgrid_oppgaver)

/// Avhukbar oppgaveliste fra etter-møte-analysen: det møtet ba deg gjøre
/// dør ikke i etterarbeids-arket, men dukker opp her til det er gjort.
private struct MoteOppgaverCard: View {
    @Environment(AppState.self) private var appState
    @State private var oppgaver: [MoteOppgaveDTO] = []
    @AppStorage("oversikt.kollaps.oppgaver") private var kollapset = false

    var body: some View {
        // .task på en tom Group fyrer ikke (EmptyView-fella) — Color.clear
        // holder viewet i hierarkiet så lastingen alltid kjører.
        Group {
            if oppgaver.isEmpty {
                Color.clear.frame(height: 0)
            }
            if !oppgaver.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 7) {
                        Image(systemName: "checklist")
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(Brand.purpleLight)
                        Text("Oppgaver fra møtene")
                            .font(.headline).foregroundStyle(.white)
                        Spacer()
                        Text("\(oppgaver.count)")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(Brand.purpleLight)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Brand.purpleLight.opacity(0.14), in: Capsule())
                        Button {
                    withAnimation(.easeInOut(duration: 0.2)) { kollapset.toggle() }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(Brand.textSecondary)
                        .rotationEffect(.degrees(kollapset ? -90 : 0))
                        .frame(width: 26, height: 26)
                        .background(Brand.cardHi, in: Circle())
                }
                .buttonStyle(.plain)
                    }
                    if !kollapset {
                    ForEach(oppgaver.prefix(5)) { o in
                        Button { hukAv(o) } label: {
                            HStack(spacing: 9) {
                                Image(systemName: "circle")
                                    .font(.appScaled(size: 14))
                                    .foregroundStyle(Brand.purpleLight)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(o.tittel)
                                        .font(.appScaled(size: 12, weight: .semibold))
                                        .foregroundStyle(.white)
                                        .lineLimit(1)
                                    Text(o.selskap)
                                        .font(.appScaled(size: 10))
                                        .foregroundStyle(Brand.textTertiary)
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 6)
                                if let f = o.frist, !f.isEmpty {
                                    Text(f)
                                        .font(.appScaled(size: 9, weight: .bold))
                                        .foregroundStyle(Brand.purpleLight)
                                        .padding(.horizontal, 7).padding(.vertical, 3)
                                        .background(Brand.purpleLight.opacity(0.14),
                                                    in: Capsule())
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .help("Huk av: \(o.tittel)")
                    }
                    }
                }
                .padding(16)
                .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
            }
        }
        .task { await lastOppgaver() }
    }

    private func lastOppgaver() async {
        if DemoModeManager.isActiveNonisolated {
            if oppgaver.isEmpty { oppgaver = Self.demoOppgaver }
            return
        }
        guard let api = appState.api else { return }
        oppgaver = (try? await api.hentMoteOppgaver()) ?? []
    }

    /// Huk av: optimistisk fjerning + PATCH (demo: kun lokalt).
    private func hukAv(_ o: MoteOppgaveDTO) {
        withAnimation(.easeOut(duration: 0.2)) {
            oppgaver.removeAll { $0.id == o.id }
        }
        guard !DemoModeManager.isActiveNonisolated,
              let api = appState.api else { return }
        Task { try? await api.settMoteOppgaveStatus(id: o.id, ferdig: true) }
    }

    private static let demoOppgaver: [MoteOppgaveDTO] = [
        MoteOppgaveDTO(id: "demo-o1", selskap: "Nordic Elektro AS",
                       tittel: "Prisforslag rammeavtale", frist: "torsdag",
                       status: "open"),
        MoteOppgaveDTO(id: "demo-o2", selskap: "Nordic Elektro AS",
                       tittel: "Book befaring med teknisk sjef", frist: "neste uke",
                       status: "open"),
        MoteOppgaveDTO(id: "demo-o3", selskap: "BoligPartner AS",
                       tittel: "Send referanse fra Byggmester Hansen",
                       frist: "i morgen", status: "open"),
    ]
}

// MARK: - NextActionsCard

private struct NextActionsCard: View {
    let leads: [LeadModel]
    @State private var showAll = false
    @State private var openLead: LeadModel?

    private var sortedLeads: [LeadModel] {
        leads.sorted { ($0.leadScore ?? 0) > ($1.leadScore ?? 0) }
    }
    private var topLeads: [LeadModel] { Array(sortedLeads.prefix(4)) }


    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Neste handlinger").font(.headline).foregroundStyle(.white)
                Spacer()
                Button { showAll = true } label: {
                    Text("Se alle (\(leads.count))")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                }
                .buttonStyle(.plain)
                .disabled(leads.isEmpty)
            }
            ForEach(topLeads, id: \.id) { lead in
                NextActionRow(lead: lead, onOpen: { openLead = $0 })
            }
            if topLeads.isEmpty {
                Text("Ingen oppfølginger akkurat nå")
                    .font(.caption).foregroundStyle(Brand.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
        .sheet(isPresented: $showAll) {
            NavigationStack {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(sortedLeads, id: \.id) { lead in
                            NextActionRow(lead: lead, onOpen: { openLead = $0 })
                                .padding(.horizontal, 4)
                        }
                    }
                    .padding(16)
                }
                .background(Brand.bg.ignoresSafeArea())
                .navigationTitle("Alle oppfølginger (\(leads.count))")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Lukk") { showAll = false }.foregroundStyle(Brand.purpleLight)
                    }
                }
            }
        }
        .sheet(item: $openLead) { lead in
            LeadDetailSheet(lead: lead)
        }
    }
}

struct NextActionRow: View {
    let lead: LeadModel
    /// Åpne lead-detaljen. Hele raden kaller denne; handlings-pillen kaller
    /// den kun som fallback når vi ikke har telefon/e-post å handle på.
    var onOpen: (LeadModel) -> Void = { _ in }
    @Environment(\.openURL) private var openURL

    /// Handlings-pillen utfører den konkrete neste-handlingen:
    /// Ring → tel:, E-post → mailto:, Møte/Planlegg → åpne lead-detaljen.
    private func performAction() {
        switch lead.status {
        case .interested:
            if let email = lead.email, !email.isEmpty,
               let url = URL(string: "mailto:\(email)") { openURL(url); return }
            onOpen(lead)
        case .meetingBooked, .return:
            onOpen(lead)
        default:
            if let phone = lead.phone, !phone.isEmpty,
               let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") { openURL(url); return }
            onOpen(lead)
        }
    }

    private var statusBadge: (label: String, color: Color)? {
        let score = lead.leadScore ?? 0
        if score >= 90 || lead.status == .meetingBooked {
            return ("Hot Lead", Brand.green)
        }
        if score >= 50 {
            return ("Varm Lead", Brand.yellow)
        }
        if lead.status == .return {
            return ("Return", Brand.orange)
        }
        return nil
    }

    private var actionLabel: String {
        switch lead.status {
        case .meetingBooked: return "Møte"
        case .return:        return "Planlegg"
        case .interested:    return "E-post"
        default:             return "Ring"
        }
    }

    private var actionTime: String {
        guard let next = lead.nextFollowUpAt else { return "I dag" }
        let cal = Calendar.current
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "HH:mm"
        if cal.isDateInToday(next) { return "I dag \(f.string(from: next))" }
        if cal.isDateInTomorrow(next) { return "I morgen" }
        f.dateFormat = "d. MMM"
        return f.string(from: next)
    }

    /// Icon-bg matcher status for visuell sammenheng med statusbadge.
    private var iconBgColor: Color {
        switch lead.status {
        case .meetingBooked: return Brand.purple.opacity(0.25)
        case .interested, .won: return Brand.green.opacity(0.22)
        case .return: return Brand.orange.opacity(0.22)
        default: return Brand.blue.opacity(0.22)
        }
    }
    private var iconFgColor: Color {
        switch lead.status {
        case .meetingBooked: return Brand.purpleLight
        case .interested, .won: return Brand.green
        case .return: return Brand.orange
        default: return Brand.blue
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(iconBgColor)
                Image(systemName: "building.2.fill")
                    .font(.appScaled(size: 16))
                    .foregroundStyle(iconFgColor)
            }
            .frame(width: 42, height: 42)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(lead.name)
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let sb = statusBadge {
                        Text(sb.label)
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(sb.color)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(sb.color.opacity(0.15), in: Capsule())
                    }
                }
                Text("\(lead.status.label) · \(actionLabel)")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(Brand.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 6) {
                Text(actionTime)
                    .font(.appScaled(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textSecondary)
                Button { performAction() } label: {
                    Text(actionLabel)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 7)
                        .background(
                            LinearGradient(
                                colors: [Brand.purple, Brand.purpleLight],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            ),
                            in: RoundedRectangle(cornerRadius: 9)
                        )
                        .shadow(color: Brand.purple.opacity(0.4), radius: 6, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 6).padding(.horizontal, 4)
        .contentShape(Rectangle())
        .onTapGesture { onOpen(lead) }
    }
}

// MARK: - PipelineOverviewCard

private struct PipelineOverviewCard: View {
    let leads: [LeadModel]
    @State private var demo = DemoModeManager.shared

    private struct Stage: Identifiable {
        let id = UUID()
        let name: String
        let count: Int
        let color: Color
        /// Trend-verdier vises kun i demo-modus (mock). Uten demo har vi
        /// ikke historisk data å regne fra → skjul piler for å ikke lyve.
        let trend: String?
        let trendUp: Bool
    }

    private var stages: [Stage] {
        let new = leads.filter { $0.status == .unvisited }.count
        let contacted = leads.filter { $0.status == .visited || $0.status == .return }.count
        let meeting = leads.filter { $0.status == .meetingBooked }.count
        let proposal = leads.filter { $0.status == .proposalSent }.count
        let won = leads.filter { $0.status == .won }.count
        let isDemo = demo.isActive
        return [
            Stage(name: "Nye leads",    count: new,      color: Brand.purple, trend: isDemo ? "+18%" : nil, trendUp: true),
            Stage(name: "Kontaktet",    count: contacted, color: Brand.blue,   trend: isDemo ? "+12%" : nil, trendUp: true),
            Stage(name: "Møter avtalt", count: meeting,  color: Brand.green,  trend: isDemo ? "+8%"  : nil, trendUp: true),
            Stage(name: "Tilbud sendt", count: proposal, color: Brand.yellow, trend: isDemo ? "-5%"  : nil, trendUp: false),
            Stage(name: "Vunnet",       count: won,      color: Brand.red,    trend: isDemo ? "+21%" : nil, trendUp: true),
        ]
    }

    private var maxCount: Int { max(stages.map(\.count).max() ?? 1, 1) }

    @State private var showReport = false

    private var pipelineReport: String {
        var lines = ["Pipeline-rapport", "Totalt \(leads.count) leads", ""]
        lines.append(contentsOf: stages.map { s in
            "\(s.name): \(s.count)" + (s.trend.map { " (\($0))" } ?? "")
        })
        return lines.joined(separator: "\n")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Pipeline oversikt").font(.headline).foregroundStyle(.white)
                Spacer()
                FilterChip(label: "Denne måneden", icon: "calendar")
            }
            VStack(spacing: 10) {
                ForEach(stages) { stageRow($0) }
            }
            Divider().background(Brand.stroke).padding(.top, 4)
            Button { showReport = true } label: {
                HStack {
                    Spacer()
                    Text("Se full pipeline rapport").font(.appScaled(size: 12, weight: .semibold))
                    Image(systemName: "arrow.right").font(.appScaled(size: 11, weight: .semibold))
                    Spacer()
                }
                .foregroundStyle(Brand.purpleLight).padding(.top, 2)
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
        .sheet(isPresented: $showReport) {
            NavigationStack {
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(stages) { stageRow($0) }
                    }
                    .padding(16)
                }
                .background(Brand.bg.ignoresSafeArea())
                .navigationTitle("Pipeline-rapport")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Lukk") { showReport = false }.foregroundStyle(Brand.purpleLight)
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        ShareLink(item: pipelineReport) {
                            Label("Del", systemImage: "square.and.arrow.up")
                        }.foregroundStyle(Brand.purpleLight)
                    }
                }
            }
        }
    }

    private func stageRow(_ stage: Stage) -> some View {
        HStack(spacing: 12) {
            Text(stage.name)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 100, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Brand.cardHi).frame(height: 8)
                    Capsule()
                        .fill(LinearGradient(
                            colors: [stage.color, stage.color.opacity(0.7)],
                            startPoint: .leading, endPoint: .trailing
                        ))
                        .frame(width: max(geo.size.width * CGFloat(stage.count) / CGFloat(maxCount), 4),
                               height: 8)
                        .shadow(color: stage.color.opacity(0.5), radius: 3, y: 1)
                }
            }
            .frame(height: 8)
            Text("\(stage.count.formatted(.number.locale(Locale(identifier: "nb_NO"))))")
                .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .frame(width: 56, alignment: .trailing)
            // Trend-pil kun hvis vi har verdi (dvs. demo-modus). Ellers
            // beholder vi bredden med en tom placeholder så les-rader
            // linjerer opp fortsatt.
            HStack(spacing: 2) {
                if let trend = stage.trend {
                    Image(systemName: stage.trendUp ? "arrow.up" : "arrow.down")
                        .font(.appScaled(size: 9, weight: .bold))
                    Text(trend)
                        .font(.appScaled(size: 10, weight: .semibold))
                } else {
                    Text("—")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(Brand.textTertiary)
                }
            }
            .foregroundStyle(stage.trendUp ? Brand.green : Brand.red)
            .frame(width: 48, alignment: .trailing)
        }
    }
}

// MARK: - ActivityTodayCard

private struct ActivityTodayCard: View {
    let momentum: LeadgridMomentum?
    @State private var demo = DemoModeManager.shared
    // Demo-modus viser mock-tall; ellers ekte tellere fra
    // /api/leadgrid/momentum/today (todayActivity.calls/emails/visits).
    private var calls: Int { demo.isActive ? 14 : (momentum?.todayActivity.calls ?? 0) }
    private var emails: Int { demo.isActive ? 22 : (momentum?.todayActivity.emails ?? 0) }
    private var meetings: Int { demo.isActive ? 3 : (momentum?.todayActivity.meetings ?? 0) }
    private var visits: Int { demo.isActive ? 7 : (momentum?.todayActivity.visits ?? 0) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Aktivitet i dag").font(.headline).foregroundStyle(.white)
            VStack(spacing: 12) {
                row(icon: "phone.fill", color: Brand.blue, label: "Telefoner", value: calls)
                row(icon: "envelope.fill", color: Brand.purple, label: "E-poster", value: emails)
                row(icon: "calendar", color: Brand.green, label: "Møter", value: meetings)
                row(icon: "mappin.and.ellipse", color: Brand.orange, label: "Besøk", value: visits)
            }
            Divider().background(Brand.stroke).padding(.top, 4)
            Button { showAll = true } label: {
                HStack {
                    Spacer()
                    Text("Se alle aktiviteter").font(.appScaled(size: 12, weight: .semibold))
                    Image(systemName: "arrow.right").font(.appScaled(size: 11, weight: .semibold))
                    Spacer()
                }
                .foregroundStyle(Brand.purpleLight).padding(.top, 2)
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
        .sheet(isPresented: $showAll) {
            NavigationStack {
                ScrollView {
                    VStack(spacing: 12) {
                        row(icon: "phone.fill", color: Brand.blue, label: "Telefoner", value: calls)
                        row(icon: "envelope.fill", color: Brand.purple, label: "E-poster", value: emails)
                        row(icon: "calendar", color: Brand.green, label: "Møter", value: meetings)
                        row(icon: "mappin.and.ellipse", color: Brand.orange, label: "Besøk", value: visits)
                    }
                    .padding(16)
                }
                .background(Brand.bg.ignoresSafeArea())
                .navigationTitle("Aktivitet i dag")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Lukk") { showAll = false }.foregroundStyle(Brand.purpleLight)
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        ShareLink(item: "Aktivitet i dag\nTelefoner: \(calls)\nE-poster: \(emails)\nMøter: \(meetings)\nBesøk: \(visits)") {
                            Label("Del", systemImage: "square.and.arrow.up")
                        }.foregroundStyle(Brand.purpleLight)
                    }
                }
            }
        }
    }

    @State private var showAll = false

    private func row(icon: String, color: Color, label: String, value: Int) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(color.opacity(0.22))
                Image(systemName: icon)
                    .font(.appScaled(size: 15, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 38, height: 38)
            Text(label)
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(.white)
            Spacer()
            Text("\(value)")
                .font(.appScaled(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
        }
        .padding(.vertical, 2)
    }
}

// MARK: - LeadsOverTimeCard

private struct LeadsOverTimeCard: View {
    let leads: [LeadModel]

    private struct Point: Identifiable {
        let id = UUID()
        let day: Int
        let count: Int
    }

    private var data: [Point] {
        let cal = Calendar.current
        let now = Date()
        var counts = Array(repeating: 0, count: 30)
        for lead in leads {
            let days = cal.dateComponents([.day], from: lead.createdAt, to: now).day ?? 0
            if days >= 0 && days < 30 { counts[29 - days] += 1 }
        }
        var running = max(leads.count - counts.reduce(0, +), 0)
        return counts.enumerated().map { (i, c) in
            running += c
            return Point(day: i, count: running)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Leads over tid").font(.headline).foregroundStyle(.white)
                Spacer()
                FilterChip(label: "Denne måneden", icon: "calendar")
            }
            Chart(data) { pt in
                LineMark(x: .value("Dag", pt.day), y: .value("Leads", pt.count))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [Brand.purple, Brand.purpleLight],
                        startPoint: .leading, endPoint: .trailing))
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                AreaMark(x: .value("Dag", pt.day), y: .value("Leads", pt.count))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [Brand.purple.opacity(0.35), Brand.purple.opacity(0.0)],
                        startPoint: .top, endPoint: .bottom))
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(height: 100)

            // Ekte start-/slutt-datoer for 30-dagers-vinduet i stedet for
            // hardkodete "1. mai / 31. mai"-labels.
            HStack {
                Text(Self.dateLabel(daysAgo: 29))
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                Spacer()
                Text(Self.dateLabel(daysAgo: 0))
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private static func dateLabel(daysAgo: Int) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        let d = cal.date(byAdding: .day, value: -daysAgo, to: Date()) ?? Date()
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        f.dateFormat = "d. MMM"
        return f.string(from: d)
    }
}

// MARK: - LeadScoreDonutCard

private struct LeadScoreDonutCard: View {
    let leads: [LeadModel]

    private struct Bucket: Identifiable {
        let id = UUID()
        let label: String
        let range: String
        /// Pin-fyll-fargen for denne temperatur-tier (matcher LeadPinView).
        let color: Color
        /// Glow-fargen pinen viser på kartet (rød for hot, oransje for
        /// varm). Brukes i legend for å tydeliggjøre hva man ser visuelt.
        let glow: Color?
        let count: Int
    }

    // Buckets matcher LeadPinView.fillColor + glow-tier-systemet eksakt
    // så brukeren kan koble pin-farge på kartet til segment i donuten:
    //
    //   • Hot  (≥ 70 ELLER status=meeting_booked) → lilla pin-fyll
    //     + rød glow (samme som donut: lilla med rød accent)
    //   • Varm (50-69) → gul pin-fyll + oransje glow
    //   • Lunken (30-49) → oransje/varsel
    //   • Kald (< 30) → grå
    //
    // Buckets-grensene endret (70/50/30 i stedet for 80/60/40) for å
    // matche pin-status-bånd 1:1. Daniels feedback 2026-06-28: "fargene
    // må være konsistent".
    private var buckets: [Bucket] {
        let hot   = leads.filter {
            ($0.leadScore ?? 0) >= 70 || $0.status == .meetingBooked
        }.count
        let warm  = leads.filter {
            (50..<70).contains($0.leadScore ?? -1) && $0.status != .meetingBooked
        }.count
        let luke  = leads.filter {
            (30..<50).contains($0.leadScore ?? -1)
        }.count
        let cold  = leads.filter { ($0.leadScore ?? 0) < 30 }.count
        return [
            Bucket(label: "Hot",    range: "70-100 + møte",
                   color: Brand.purple, glow: Brand.red, count: hot),
            Bucket(label: "Varm",   range: "50-69",
                   color: Brand.yellow, glow: Brand.orange, count: warm),
            Bucket(label: "Lunken", range: "30-49",
                   color: Brand.orange, glow: nil, count: luke),
            Bucket(label: "Kald",   range: "0-29",
                   color: Color(red: 0.45, green: 0.50, blue: 0.62), glow: nil, count: cold),
        ]
    }

    private var total: Int { max(buckets.reduce(0) { $0 + $1.count }, 1) }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Lead score fordeling")
                .font(.headline)
                .foregroundStyle(.white)
            donut
            legendGrid
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private var donut: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [Brand.purple.opacity(0.18), Brand.purple.opacity(0)],
                    center: .center, startRadius: 20, endRadius: 90
                ))
                .frame(width: 160, height: 160)
                .blur(radius: 10)

            Chart(buckets) { b in
                SectorMark(
                    angle: .value("Count", b.count),
                    innerRadius: .ratio(0.70),
                    outerRadius: .ratio(0.96),
                    angularInset: 3
                )
                .foregroundStyle(b.color)
                .cornerRadius(4)
            }
            .frame(width: 150, height: 150)

            VStack(spacing: 2) {
                Text(total.formatted(.number.locale(Locale(identifier: "nb_NO"))))
                    .font(.appScaled(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("Totalt")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                    .textCase(.uppercase)
                    .tracking(0.8)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // 2×2 grid med 4 score-buckets — passer både smale + brede kort.
    private var legendGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
            spacing: 10
        ) {
            ForEach(buckets) { b in
                legendCell(b)
            }
        }
    }

    private func legendCell(_ b: Bucket) -> some View {
        HStack(spacing: 10) {
            // "Mini-pin" som matcher kart-pin-stilen: fyll-farge + valgfri
            // glow-halo. Slik kan brukeren visuelt koble en pin på kartet
            // direkte til et donut-segment.
            ZStack {
                if let glow = b.glow {
                    Circle()
                        .fill(glow.opacity(0.55))
                        .frame(width: 18, height: 18)
                        .blur(radius: 3)
                }
                Circle()
                    .fill(b.color)
                    .overlay(Circle().stroke(Color.white.opacity(0.9), lineWidth: 1))
                    .frame(width: 12, height: 12)
            }
            .frame(width: 20, height: 20)

            VStack(alignment: .leading, spacing: 0) {
                Text(b.label)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                Text(b.range)
                    .font(.appScaled(size: 9))
                    .foregroundStyle(Brand.textTertiary)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 0) {
                Text("\(b.count.formatted(.number.locale(Locale(identifier: "nb_NO"))))")
                    .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("\(percent(b.count))%")
                    .font(.appScaled(size: 9, weight: .medium))
                    .foregroundStyle(Brand.textSecondary)
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Brand.stroke, lineWidth: 1))
    }

    private func percent(_ count: Int) -> Int {
        Int((Double(count) / Double(total)) * 100)
    }
}

// MARK: - TopSellersSheet (åpnes fra teamPositionCard i MyProfileSheet)
//
// Hele leaderboarden for organisasjonen: podium for topp-3, så hele
// lista med rank/avatar/navn/tittel/KPI. Brukerens egen rad har lilla
// outline + "Du"-badge for å skille seg ut.

struct TopSellersSheet: View {
    let currentUserName: String
    @Environment(\.dismiss) private var dismiss
    @State private var period: Period = .month
    @State private var selectedSeller: Seller?
    @State private var leadershipOpen: Bool = false

    /// Sann hvis innlogget bruker har «salgssjef»-rolle og dermed kan sette
    /// provisjons-satser, opprette konkurranser, etc. I prod kobles dette
    /// til `AppState.userRole`; her hardkodet for mockup.
    private var isSalgssjef: Bool { true }

    enum Period: String, CaseIterable {
        case month = "Denne mnd"
        case quarter = "Q2 2026"
        case year = "I år"
    }

    struct Seller: Identifiable, Hashable {
        let id = UUID()
        let rank: Int
        let name: String
        let title: String
        let avatarColor: Color
        let won: Int
        let leads: Int
        let trend: Int  // antall plasser opp/ned
        /// Total verdi vunnet (NOK) — kritisk for salgssjef.
        let totalValue: Double
        /// Top 5 deals selgeren har vunnet (kunde + kategori + verdi + by).
        let topDeals: [Deal]
        /// Geografisk fordeling (by → antall won-deals).
        let regions: [RegionStat]
        /// Bransje-mix (bransje → antall + %).
        let industries: [IndustryStat]
    }

    struct Deal: Identifiable, Hashable {
        let id = UUID()
        let customer: String
        let category: String  // f.eks. "Innholdsproduksjon", "Helsetech", "B2B SaaS"
        let value: Double
        let city: String
        let daysAgo: Int
    }

    struct RegionStat: Identifiable, Hashable {
        let id = UUID()
        let city: String
        let count: Int
        let valueShare: Double  // % av selgers totale verdi
    }

    struct IndustryStat: Identifiable, Hashable {
        let id = UUID()
        let name: String
        let count: Int
        let color: Color
    }

    /// Demo → mock-leaderboard; ellers ekte selgere fra TeamLiveStore
    /// (`/sales-leadership/team-members`), rangert etter total verdi.
    /// topDeals/regions/industries har ingen backend-kilde enda → tomme.
    private var sellers: [Seller] {
        if DemoModeManager.isActiveNonisolated { return mockSellers }
        return TeamLiveStore.shared.memberDTOs
            .sorted { $0.totalValueNok > $1.totalValueNok }
            .enumerated()
            .map { idx, dto in
                Seller(rank: idx + 1, name: dto.name, title: dto.title ?? "Selger",
                       avatarColor: Brand.purpleLight,
                       won: dto.won, leads: dto.leads, trend: 0,
                       totalValue: Double(dto.totalValueNok),
                       topDeals: [], regions: [], industries: [])
            }
    }

    private var mockSellers: [Seller] {
        [
            makeSeller(rank: 1, name: "Anniken Sørli", title: "Salgsdirektør",
                       color: Brand.purple, won: 312, leads: 1820, trend: 0,
                       totalValue: 4_580_000,
                       topDeals: [
                           Deal(customer: "Equinor AS",         category: "B2B SaaS",          value: 380_000, city: "Oslo",       daysAgo: 2),
                           Deal(customer: "DNB Bank",            category: "Innholdsproduksjon", value: 320_000, city: "Oslo",       daysAgo: 5),
                           Deal(customer: "Aker Solutions",      category: "Konsulent",         value: 290_000, city: "Stavanger",  daysAgo: 8),
                           Deal(customer: "Schibsted Media",     category: "B2B SaaS",          value: 260_000, city: "Oslo",       daysAgo: 12),
                           Deal(customer: "Telenor Norge",       category: "B2B SaaS",          value: 240_000, city: "Fornebu",    daysAgo: 15),
                       ],
                       regions: [
                           RegionStat(city: "Oslo",       count: 168, valueShare: 0.54),
                           RegionStat(city: "Stavanger",  count: 62,  valueShare: 0.22),
                           RegionStat(city: "Bergen",     count: 48,  valueShare: 0.14),
                           RegionStat(city: "Trondheim",  count: 34,  valueShare: 0.10),
                       ],
                       industries: [
                           IndustryStat(name: "B2B SaaS",         count: 142, color: Brand.purple),
                           IndustryStat(name: "Innholdsproduksjon", count: 88, color: Brand.green),
                           IndustryStat(name: "Konsulent",          count: 52, color: Brand.blue),
                           IndustryStat(name: "Annet",              count: 30, color: Brand.textTertiary),
                       ]),
            makeSeller(rank: 2, name: "Mikkel Berg", title: "Senior selger",
                       color: Brand.green, won: 248, leads: 1640, trend: 1,
                       totalValue: 3_240_000,
                       topDeals: [
                           Deal(customer: "Holy Crust Pizza AS", category: "Innholdsproduksjon", value: 240_000, city: "Oslo",      daysAgo: 1),
                           Deal(customer: "MedSide AS",          category: "B2B SaaS",          value: 220_000, city: "Oslo",      daysAgo: 4),
                           Deal(customer: "Lerøy Seafood",       category: "Industri B2B",      value: 180_000, city: "Bergen",    daysAgo: 9),
                           Deal(customer: "Norge i Bilder",      category: "Foto/Video",        value: 160_000, city: "Trondheim", daysAgo: 11),
                           Deal(customer: "TeknoSpaces AS",      category: "B2B SaaS",          value: 150_000, city: "Oslo",      daysAgo: 18),
                       ],
                       regions: [
                           RegionStat(city: "Bergen",    count: 92, valueShare: 0.42),
                           RegionStat(city: "Oslo",      count: 78, valueShare: 0.31),
                           RegionStat(city: "Trondheim", count: 48, valueShare: 0.18),
                           RegionStat(city: "Tromsø",    count: 30, valueShare: 0.09),
                       ],
                       industries: [
                           IndustryStat(name: "Foto/Video",          count: 96, color: Brand.purpleLight),
                           IndustryStat(name: "B2B SaaS",            count: 78, color: Brand.purple),
                           IndustryStat(name: "Innholdsproduksjon",  count: 52, color: Brand.green),
                           IndustryStat(name: "Annet",               count: 22, color: Brand.textTertiary),
                       ]),
            makeSeller(rank: 3, name: currentUserName, title: "Salgssjef",
                       color: Brand.purpleLight, won: 166, leads: 1248, trend: 2,
                       totalValue: 2_180_000,
                       topDeals: [
                           Deal(customer: "Talkit AS",            category: "B2B SaaS",          value: 195_000, city: "Oslo",      daysAgo: 3),
                           Deal(customer: "Veggbilder AS",        category: "Foto/Video",        value: 145_000, city: "Oslo",      daysAgo: 6),
                           Deal(customer: "Holy Crust Innhold",   category: "Innholdsproduksjon", value: 130_000, city: "Oslo",      daysAgo: 10),
                           Deal(customer: "Dr.Dropin Grünerløkka", category: "Helsetech",        value: 120_000, city: "Oslo",      daysAgo: 14),
                           Deal(customer: "Oslo Helse AS",        category: "Helsetech",         value: 110_000, city: "Oslo",      daysAgo: 19),
                       ],
                       regions: [
                           RegionStat(city: "Oslo",      count: 142, valueShare: 0.78),
                           RegionStat(city: "Bærum",     count: 12,  valueShare: 0.10),
                           RegionStat(city: "Lillestrøm", count: 8,  valueShare: 0.07),
                           RegionStat(city: "Annet",     count: 4,   valueShare: 0.05),
                       ],
                       industries: [
                           IndustryStat(name: "B2B SaaS",            count: 56, color: Brand.purple),
                           IndustryStat(name: "Helsetech",           count: 42, color: Brand.green),
                           IndustryStat(name: "Innholdsproduksjon",  count: 38, color: Brand.purpleLight),
                           IndustryStat(name: "Foto/Video",          count: 30, color: Brand.blue),
                       ]),
            makeBasicSeller(rank: 4,  name: "Sara Lindberg",    title: "Salgskonsulent", color: Brand.blue,    won: 158, leads: 1190, trend: -1, totalValue: 1_980_000, primaryCity: "Trondheim", primaryIndustry: "Helsetech"),
            makeBasicSeller(rank: 5,  name: "Tobias Strand",    title: "Salgskonsulent", color: Brand.orange,  won: 142, leads: 1075, trend: 0,  totalValue: 1_720_000, primaryCity: "Bergen",    primaryIndustry: "Foto/Video"),
            makeBasicSeller(rank: 6,  name: "Karoline Nesse",   title: "Salgskonsulent", color: Brand.yellow,  won: 128, leads: 980,  trend: 3,  totalValue: 1_540_000, primaryCity: "Stavanger", primaryIndustry: "B2B SaaS"),
            makeBasicSeller(rank: 7,  name: "Henrik Aase",      title: "Salgskonsulent", color: Brand.red,     won: 117, leads: 902,  trend: -2, totalValue: 1_380_000, primaryCity: "Oslo",      primaryIndustry: "Innholdsproduksjon"),
            makeBasicSeller(rank: 8,  name: "Jonas Halvorsen",  title: "Promotør",       color: Brand.purple,  won: 98,  leads: 845,  trend: 1,  totalValue: 1_180_000, primaryCity: "Tromsø",    primaryIndustry: "Helsetech"),
            makeBasicSeller(rank: 9,  name: "Marte Johansen",   title: "Salgskonsulent", color: Brand.green,   won: 88,  leads: 720,  trend: 0,  totalValue: 1_050_000, primaryCity: "Oslo",      primaryIndustry: "B2B SaaS"),
            makeBasicSeller(rank: 10, name: "Espen Lien",       title: "Promotør",       color: Brand.blue,    won: 76,  leads: 650,  trend: -1, totalValue: 920_000,   primaryCity: "Bergen",    primaryIndustry: "Foto/Video"),
            makeBasicSeller(rank: 11, name: "Vilde Holm",       title: "Salgskonsulent", color: Brand.orange,  won: 71,  leads: 612,  trend: 2,  totalValue: 870_000,   primaryCity: "Oslo",      primaryIndustry: "Innholdsproduksjon"),
            makeBasicSeller(rank: 12, name: "Sander Vik",       title: "Promotør",       color: Brand.yellow,  won: 65,  leads: 558,  trend: 0,  totalValue: 780_000,   primaryCity: "Oslo",      primaryIndustry: "Annet"),
        ]
    }

    private func makeSeller(rank: Int, name: String, title: String, color: Color,
                            won: Int, leads: Int, trend: Int, totalValue: Double,
                            topDeals: [Deal], regions: [RegionStat],
                            industries: [IndustryStat]) -> Seller {
        Seller(rank: rank, name: name, title: title, avatarColor: color,
               won: won, leads: leads, trend: trend, totalValue: totalValue,
               topDeals: topDeals, regions: regions, industries: industries)
    }

    /// Forenklet konstruktør for selgere 4-12 — generer mock-data fra
    /// primary-city + primary-industry så detaljen er konsistent uten å
    /// duplisere all data manuelt.
    private func makeBasicSeller(rank: Int, name: String, title: String,
                                 color: Color, won: Int, leads: Int,
                                 trend: Int, totalValue: Double,
                                 primaryCity: String,
                                 primaryIndustry: String) -> Seller {
        let avgDeal = totalValue / Double(won)
        let topDeals: [Deal] = (0..<5).map { i in
            Deal(
                customer: "Kunde \(name.split(separator: " ").first ?? "X") #\(i+1)",
                category: primaryIndustry,
                value: avgDeal * Double.random(in: 1.1...2.2),
                city: primaryCity,
                daysAgo: i * 4 + 1
            )
        }
        return Seller(
            rank: rank, name: name, title: title, avatarColor: color,
            won: won, leads: leads, trend: trend, totalValue: totalValue,
            topDeals: topDeals,
            regions: [
                RegionStat(city: primaryCity,  count: Int(Double(won) * 0.65), valueShare: 0.70),
                RegionStat(city: "Oslo",       count: Int(Double(won) * 0.20), valueShare: 0.18),
                RegionStat(city: "Annet",      count: Int(Double(won) * 0.15), valueShare: 0.12),
            ],
            industries: [
                IndustryStat(name: primaryIndustry,         count: Int(Double(won) * 0.55), color: color),
                IndustryStat(name: "B2B SaaS",               count: Int(Double(won) * 0.20), color: Brand.purple),
                IndustryStat(name: "Innholdsproduksjon",     count: Int(Double(won) * 0.15), color: Brand.green),
                IndustryStat(name: "Annet",                  count: Int(Double(won) * 0.10), color: Brand.textTertiary),
            ]
        )
    }

    private var podium: [Seller] {
        Array(sellers.prefix(3))
    }
    private var rest: [Seller] {
        Array(sellers.dropFirst(3))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    periodPicker
                    // Podium krever minst 3 selgere (indekserer [0...2]);
                    // ekte team kan være mindre — da vises kun listen.
                    if sellers.count >= 3 { podiumSection }
                    if sellers.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "person.3")
                                .font(.appScaled(size: 28, weight: .semibold))
                                .foregroundStyle(Brand.textTertiary)
                            Text("Ingen selger-data enda")
                                .font(.appScaled(size: 13, weight: .bold))
                                .foregroundStyle(.white)
                            Text("Leaderboardet fylles når teamet har aktivitet.")
                                .font(.appScaled(size: 11))
                                .foregroundStyle(Brand.textSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 60)
                    } else {
                        listHeader
                        sellerList
                    }
                    Spacer(minLength: 16)
                }
                .padding(.horizontal, 24)
                .padding(.top, 14)
                .padding(.bottom, 30)
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Topp selgere")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: {
                        ZStack {
                            Circle().fill(Brand.cardHi)
                            Circle().stroke(Brand.stroke, lineWidth: 1)
                            Image(systemName: "xmark")
                                .font(.appScaled(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                }
                if isSalgssjef {
                    ToolbarItem(placement: .primaryAction) {
                        Button { leadershipOpen = true } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "slider.horizontal.3")
                                    .font(.appScaled(size: 12, weight: .bold))
                                Text("Salgsledelse")
                                    .font(.appScaled(size: 13, weight: .semibold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                LinearGradient(
                                    colors: [Brand.purple, Brand.purpleLight],
                                    startPoint: .leading, endPoint: .trailing
                                ),
                                in: Capsule()
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(item: $selectedSeller) { seller in
                SellerDetailSheet(seller: seller, isCurrentUser: seller.name == currentUserName)
            }
            .sheet(isPresented: $leadershipOpen) {
                SalesLeadershipSheet(sellers: sellers, currentUserName: currentUserName)
            }
        }
    }

    private var periodPicker: some View {
        HStack(spacing: 0) {
            ForEach(Period.allCases, id: \.self) { p in
                Button { period = p } label: {
                    Text(p.rawValue)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(period == p ? .white : Brand.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            period == p ? Brand.purple : Color.clear,
                            in: Capsule()
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Brand.card, in: Capsule())
        .overlay(Capsule().stroke(Brand.stroke, lineWidth: 1))
    }

    // Klassisk podium-layout: nr 2 venstre (litt lavere), nr 1 midten (høyest),
    // nr 3 høyre (lavest). Hver podium har avatar + navn + won-count.
    private var podiumSection: some View {
        HStack(alignment: .bottom, spacing: 14) {
            podiumColumn(sellers[1], height: 90, accent: Color(red: 0.78, green: 0.78, blue: 0.85))   // Sølv
            podiumColumn(sellers[0], height: 120, accent: Brand.yellow)                                // Gull
            podiumColumn(sellers[2], height: 70, accent: Color(red: 0.80, green: 0.50, blue: 0.30))    // Bronse
        }
        .padding(.vertical, 18)
        .padding(.horizontal, 16)
        .background(
            RoundedRectangle(cornerRadius: 18)
                .fill(Brand.card)
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .fill(RadialGradient(
                            colors: [Brand.yellow.opacity(0.18), Brand.yellow.opacity(0)],
                            center: .top, startRadius: 30, endRadius: 240
                        ))
                )
        )
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Brand.stroke, lineWidth: 1))
    }

    private func podiumColumn(_ s: Seller, height: CGFloat, accent: Color) -> some View {
        Button { selectedSeller = s } label: { podiumColumnContent(s, height: height, accent: accent) }
            .buttonStyle(.plain)
    }

    private func podiumColumnContent(_ s: Seller, height: CGFloat, accent: Color) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [s.avatarColor, s.avatarColor.opacity(0.7)],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                Text(initials(s.name))
                    .font(.appScaled(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                if s.rank == 1 {
                    Image(systemName: "crown.fill")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(accent)
                        .offset(y: -38)
                }
            }
            .frame(width: 60, height: 60)
            .shadow(color: s.avatarColor.opacity(0.5), radius: 6, y: 3)
            VStack(spacing: 2) {
                Text(s.name.split(separator: " ").first.map(String.init) ?? s.name)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("\(s.won) vunnet")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textSecondary)
            }
            // Podium-pille
            ZStack(alignment: .top) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(LinearGradient(
                        colors: [accent.opacity(0.6), accent.opacity(0.25)],
                        startPoint: .top, endPoint: .bottom
                    ))
                Text("\(s.rank)")
                    .font(.appScaled(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .padding(.top, 10)
            }
            .frame(height: height)
        }
        .frame(maxWidth: .infinity)
    }

    private var listHeader: some View {
        HStack {
            Text("Alle selgere (\(sellers.count))")
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Spacer()
            HStack(spacing: 4) {
                Image(systemName: "arrow.up.arrow.down")
                    .font(.appScaled(size: 10, weight: .semibold))
                Text("Vunnet")
                    .font(.appScaled(size: 11, weight: .semibold))
            }
            .foregroundStyle(Brand.purpleLight)
        }
        .padding(.top, 4)
    }

    private var sellerList: some View {
        VStack(spacing: 8) {
            ForEach(rest) { s in
                sellerRow(s)
            }
        }
    }

    private func sellerRow(_ s: Seller) -> some View {
        Button { selectedSeller = s } label: { sellerRowContent(s) }
            .buttonStyle(.plain)
    }

    private func sellerRowContent(_ s: Seller) -> some View {
        let isMe = s.name == currentUserName
        return HStack(spacing: 12) {
            Text("\(s.rank)")
                .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(Brand.textSecondary)
                .frame(width: 26, alignment: .leading)
            ZStack {
                Circle().fill(s.avatarColor.opacity(0.3))
                Text(initials(s.name))
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(s.avatarColor)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(s.name)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if isMe {
                        Text("Du")
                            .font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(Brand.purpleLight)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(Brand.purple.opacity(0.25), in: Capsule())
                    }
                }
                Text(s.title)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(s.won)")
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("\(s.leads) leads")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
            }
            trendBadge(s.trend)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            isMe ? Brand.purple.opacity(0.12) : Brand.card,
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isMe ? Brand.purple.opacity(0.5) : Brand.stroke,
                        lineWidth: isMe ? 1.5 : 1)
        )
    }

    @ViewBuilder
    private func trendBadge(_ trend: Int) -> some View {
        // Ekte modus har ingen rank-historikk (trend alltid 0) — en grå minus
        // ville påstått «uendret» uten datagrunnlag. Vis badge kun når det
        // finnes en reell trend, eller i demo (der 0 = ekte «uendret»).
        if trend != 0 || DemoModeManager.isActiveNonisolated {
            trendBadgeContent(trend)
        }
    }

    private func trendBadgeContent(_ trend: Int) -> some View {
        let color: Color = trend > 0 ? Brand.green : (trend < 0 ? Brand.red : Brand.textTertiary)
        let icon: String = trend > 0 ? "arrow.up" : (trend < 0 ? "arrow.down" : "minus")
        return HStack(spacing: 2) {
            Image(systemName: icon)
                .font(.appScaled(size: 9, weight: .bold))
            if trend != 0 {
                Text("\(abs(trend))")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .monospacedDigit()
            }
        }
        .foregroundStyle(color)
        .frame(width: 30, alignment: .trailing)
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        return parts.prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }
}

// MARK: - MyProfileSheet (åpnes når brukeren tapper "Min profil" i ProfilePopover)
//
// Full-skjerm sheet med detaljert salgs-profil: hero-kort med stats,
// kontakt-info, månedsmål-progress, achievements, og handlings-knapper.

struct MyProfileSheet: View {
    let name: String
    let email: String?
    let leads: [LeadModel]

    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @State private var editing = false
    @State private var topSellersOpen = false
    // «Last ned mine data» (GDPR) — ekte eksport fra backend.
    @State private var exporting = false
    @State private var exportJSON: String?
    @State private var showExportShare = false
    @State private var exportError: String?

    /// Konto-sikkerhet (passord/2FA) styres på web-kontoen — iPad logger
    /// inn via paring/Google, så disse er ærlige lenker dit, ikke native.
    private let webAccountBase = "https://theroleroom.com/innstillinger"

    private func downloadMyData() {
        guard let api = appState.api else { return }
        exporting = true
        exportError = nil
        Task {
            do {
                exportJSON = try await api.fetchMyDataExport()
                showExportShare = true
            } catch {
                exportError = "Kunne ikke laste ned data"
            }
            exporting = false
        }
    }

    private var initials: String {
        let parts = name.split(separator: " ")
        return parts.prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }

    private func formatNum(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }

    private var totalLeads: Int { leads.count }
    private var wonThisMonth: Int {
        let cal = Calendar.current
        return leads.filter { lead in
            lead.status == .won && cal.isDate(lead.createdAt, equalTo: Date(), toGranularity: .month)
        }.count
    }
    private var avgScore: Int {
        let scores = leads.compactMap { $0.leadScore }
        guard !scores.isEmpty else { return 0 }
        return scores.reduce(0, +) / scores.count
    }
    private var conversionRate: Double {
        let won = leads.filter { $0.status == .won }.count
        return totalLeads > 0 ? Double(won) / Double(totalLeads) * 100 : 0
    }
    // Realistisk månedsmål — basert på Daniels gjennomsnitt + 15% strekk.
    private var monthGoal: Int { max(wonThisMonth + 80, 250) }
    private var monthProgress: Double { min(Double(wonThisMonth) / Double(monthGoal), 1.0) }

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    /// Team-plassering: demo → mock (#3 av 24); ekte → rangert på vunnet
    /// verdi blant teamets medlemmer. Nil (skjul) med under 2 medlemmer —
    /// «#1 av 1» er ikke en plassering.
    private var teamRankInfo: (rank: Int, size: Int)? {
        if isDemo { return (3, 24) }
        let members = TeamLiveStore.shared.memberDTOs
        guard members.count >= 2 else { return nil }
        let sorted = members.sorted { $0.totalValueNok > $1.totalValueNok }
        guard let idx = sorted.firstIndex(where: { $0.name == name }) else { return nil }
        return (idx + 1, sorted.count)
    }

    /// Dager med faktisk aktivitet (lead opprettet eller besøkt).
    private var activityDays: [Date] {
        let cal = Calendar.current
        var days = Set<Date>()
        for l in leads {
            days.insert(cal.startOfDay(for: l.createdAt))
            if let v = l.lastVisitAt { days.insert(cal.startOfDay(for: v)) }
        }
        return days.sorted()
    }

    /// Streaks fra ekte aktivitetsdager (demo → mock 12/28).
    private var streaks: (current: Int, best: Int) {
        if isDemo { return (12, 28) }
        let cal = Calendar.current
        let days = activityDays
        guard !days.isEmpty else { return (0, 0) }
        // Beste: lengste sammenhengende dag-rekke
        var best = 1, run = 1
        for i in 1..<days.count {
            if cal.dateComponents([.day], from: days[i - 1], to: days[i]).day == 1 {
                run += 1
                best = max(best, run)
            } else {
                run = 1
            }
        }
        // Nåværende: tell bakover fra i dag (eller i går)
        var current = 0
        var cursor = cal.startOfDay(for: Date())
        let daySet = Set(days)
        if !daySet.contains(cursor) {
            cursor = cal.date(byAdding: .day, value: -1, to: cursor) ?? cursor
        }
        while daySet.contains(cursor) {
            current += 1
            cursor = cal.date(byAdding: .day, value: -1, to: cursor) ?? cursor
        }
        return (current, best)
    }
    private var currentStreak: Int { streaks.current }
    private var bestStreak: Int { streaks.best }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    hero
                    teamPositionCard
                    statsGrid
                    monthGoalCard
                    activityTrendCard
                    contactInfoCard
                    achievementsCard
                    actionRows
                    // Utvikler-verktøy (Pakke 10) — demo-modus toggle.
                    VStack(alignment: .leading, spacing: 10) {
                        Text("UTVIKLER")
                            .font(.appScaled(size: 10, weight: .black))
                            .foregroundStyle(.white.opacity(0.4))
                            .tracking(0.8)
                        DemoModeToggleRow()
                    }
                    .padding(.top, 8)
                    Spacer(minLength: 16)
                }
                .padding(.horizontal, 24)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Min profil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        ZStack {
                            Circle().fill(Brand.cardHi)
                            Circle().stroke(Brand.stroke, lineWidth: 1)
                            Image(systemName: "xmark")
                                .font(.appScaled(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Lukk")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        editing.toggle()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: editing ? "checkmark" : "pencil")
                                .font(.appScaled(size: 12, weight: .bold))
                            Text(editing ? "Lagre" : "Rediger profil")
                                .font(.appScaled(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(
                            LinearGradient(
                                colors: editing
                                    ? [Brand.green, Brand.green.opacity(0.85)]
                                    : [Brand.purple, Brand.purpleLight],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            ),
                            in: Capsule()
                        )
                        .shadow(color: (editing ? Brand.green : Brand.purple).opacity(0.5),
                                radius: 6, y: 2)
                    }
                    .buttonStyle(.plain)
                }
            }
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    // MARK: - Subseksjoner

    private var hero: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(LinearGradient(
                        colors: [Brand.purple, Brand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    .frame(width: 108, height: 108)
                    .shadow(color: Brand.purple.opacity(0.6), radius: 16, y: 6)
                Text(initials)
                    .font(.appScaled(size: 36, weight: .bold))
                    .foregroundStyle(.white)
                // Online-indikator
                Circle()
                    .fill(Brand.green)
                    .frame(width: 20, height: 20)
                    .overlay(Circle().stroke(Brand.bg, lineWidth: 3))
                    .offset(x: 38, y: 38)
                // Rediger profilbilde-knapp
                ZStack {
                    Circle().fill(Brand.bg)
                    Circle().stroke(Brand.purpleLight, lineWidth: 1.5)
                    Image(systemName: "camera.fill")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                }
                .frame(width: 30, height: 30)
                .offset(x: 38, y: -38)
            }
            VStack(spacing: 6) {
                Text(name)
                    .font(.appScaled(size: 24, weight: .bold))
                    .foregroundStyle(.white)
                Text("Salgssjef · Creatorhub AS")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Brand.purpleLight)
                if let email = email {
                    Text(email)
                        .font(.caption)
                        .foregroundStyle(Brand.textSecondary)
                }
                HStack(spacing: 16) {
                    if currentStreak > 0 { streakChip }
                    if teamRankInfo != nil { teamRankChip }
                }
                .padding(.top, 6)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .background(
            // Subtil banner-glow bak hero
            RoundedRectangle(cornerRadius: 20)
                .fill(Brand.card)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(RadialGradient(
                            colors: [Brand.purple.opacity(0.30), Brand.purple.opacity(0)],
                            center: .top, startRadius: 30, endRadius: 220
                        ))
                )
        )
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Brand.stroke, lineWidth: 1))
    }

    private var streakChip: some View {
        HStack(spacing: 6) {
            Image(systemName: "flame.fill")
                .font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(Brand.red)
            Text("\(currentStreak)-dagers streak")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(Brand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(Brand.red.opacity(0.4), lineWidth: 1))
    }

    private var teamRankChip: some View {
        HStack(spacing: 6) {
            Image(systemName: "trophy.fill")
                .font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(Brand.yellow)
            Text("#\(teamRankInfo?.rank ?? 0) av \(teamRankInfo?.size ?? 0)")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(Brand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(Brand.yellow.opacity(0.4), lineWidth: 1))
    }

    @ViewBuilder
    private var teamPositionCard: some View {
        if let info = teamRankInfo {
            teamPositionCardBody(info)
        }
    }

    private func teamPositionCardBody(_ info: (rank: Int, size: Int)) -> some View {
        Button { topSellersOpen = true } label: {
            HStack(spacing: 16) {
                ZStack {
                    Circle().fill(LinearGradient(
                        colors: [Brand.yellow.opacity(0.7), Brand.orange.opacity(0.7)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    Image(systemName: "trophy.fill")
                        .font(.appScaled(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .frame(width: 54, height: 54)
                .shadow(color: Brand.yellow.opacity(0.5), radius: 8, y: 3)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Topp \(info.rank) av \(info.size) selgere")
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    // Demo: mockup-tekst. Ekte: si hva rangeringen faktisk
                    // bygger på — «3. plass i Creatorhub Norge» var oppspinn.
                    Text(isDemo
                         ? "Du ligger på 3. plass i Creatorhub Norge for Q2 2026"
                         : "Rangert på vunnet verdi i teamet ditt")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 2) {
                    HStack(spacing: 4) {
                        if isDemo {
                            // Plass-endring krever historikk — kun demo.
                            Text("↑ 2")
                                .font(.appScaled(size: 14, weight: .bold))
                                .foregroundStyle(Brand.green)
                        }
                        Image(systemName: "chevron.right")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(Brand.textTertiary)
                    }
                    Text("Se hele lista")
                        .font(.appScaled(size: 9, weight: .medium))
                        .foregroundStyle(Brand.purpleLight)
                }
            }
            .padding(16)
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $topSellersOpen) {
            TopSellersSheet(currentUserName: name)
        }
    }

    /// Sparkline-serien: demo → syntetisk mockup-kurve; ekte → akkumulerte
    /// NYE leads siste 30 dager fra `createdAt` (QA 2026-07-05: kurven var
    /// syntetisk og «+18%»-pillen oppspinn også i ekte modus).
    private struct TrendPoint: Identifiable {
        let id = UUID(); let day: Int; let v: Double
    }
    private var trendPoints: [TrendPoint] {
        if isDemo {
            var running = 0
            return (0..<30).map { d in
                let chance = Double(d) / 30.0 + Double((d * 7) % 5) / 10
                if chance > 0.5 { running += 1 }
                return TrendPoint(day: d, v: Double(running))
            }
        }
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        var perDay = [Int](repeating: 0, count: 30)
        for l in leads {
            let diff = cal.dateComponents([.day], from: cal.startOfDay(for: l.createdAt), to: today).day ?? 99
            if (0..<30).contains(diff) { perDay[29 - diff] += 1 }
        }
        var running = 0
        return perDay.enumerated().map { d, c in
            running += c
            return TrendPoint(day: d, v: Double(running))
        }
    }

    /// Trend-pille: demo → mock «+18%»; ekte → siste 15 dager vs. de 15
    /// før (nil = ikke nok historikk til å si noe).
    private var trendLabel: String? {
        if isDemo { return "+18%" }
        let pts = trendPoints
        guard pts.count == 30, pts[29].v > 0 else { return nil }
        let firstHalf = pts[14].v
        let secondHalf = pts[29].v - firstHalf
        guard firstHalf > 0 else { return nil }
        let pct = Int(((secondHalf - firstHalf) / firstHalf * 100).rounded())
        return pct >= 0 ? "+\(pct)%" : "\(pct)%"
    }

    private var activityTrendCard: some View {
        let points = trendPoints
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(isDemo ? "Min trend — siste 30 dager" : "Nye leads — siste 30 dager")
                    .font(.appScaled(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                if let trend = trendLabel {
                    Text(trend)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(trend.hasPrefix("-") ? Brand.red : Brand.green)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background((trend.hasPrefix("-") ? Brand.red : Brand.green).opacity(0.15), in: Capsule())
                }
            }
            Chart(points) { pt in
                LineMark(x: .value("Dag", pt.day), y: .value("Antall", pt.v))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [Brand.purple, Brand.purpleLight],
                        startPoint: .leading, endPoint: .trailing))
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                AreaMark(x: .value("Dag", pt.day), y: .value("Antall", pt.v))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [Brand.purple.opacity(0.4), Brand.purple.opacity(0)],
                        startPoint: .top, endPoint: .bottom))
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(height: 90)
            if bestStreak > 0 {
                HStack {
                    Text("Beste streak")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(Brand.textTertiary)
                    Spacer()
                    Text("\(bestStreak) dager")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
    }

    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12),
                            GridItem(.flexible(), spacing: 12)], spacing: 12) {
            statCard(icon: "person.2.fill", color: Brand.blue,
                     label: "Mine leads",
                     value: formatNum(totalLeads),
                     trend: isDemo ? "+18%" : nil)
            statCard(icon: "trophy.fill", color: Brand.green,
                     label: "Vunnet i mnd",
                     value: "\(wonThisMonth)",
                     trend: isDemo ? "+5" : nil)
            statCard(icon: "chart.bar.fill", color: Brand.purple,
                     label: "Gjennomsnittlig score",
                     value: "\(avgScore)",
                     trend: nil)
            statCard(icon: "checkmark.seal.fill", color: Brand.orange,
                     label: "Conversion",
                     value: String(format: "%.1f%%", conversionRate),
                     trend: isDemo ? "+2.3%" : nil)
        }
    }

    private func statCard(icon: String, color: Color, label: String,
                          value: String, trend: String?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 32, height: 32)
                Spacer()
                if let trend = trend {
                    Text("↑ \(trend)")
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(Brand.green)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Brand.green.opacity(0.15), in: Capsule())
                }
            }
            Text(value)
                .font(.appScaled(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(.appScaled(size: 11, weight: .medium))
                .foregroundStyle(Brand.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
    }

    private var monthGoalCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Månedsmål")
                    .font(.appScaled(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(wonThisMonth) / \(Int(monthGoal))")
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Brand.cardHi).frame(height: 10)
                    Capsule()
                        .fill(LinearGradient(
                            colors: [Brand.purple, Brand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        ))
                        .frame(width: max(geo.size.width * monthProgress, 4), height: 10)
                        .shadow(color: Brand.purple.opacity(0.5), radius: 4)
                }
            }
            .frame(height: 10)
            Text("\(Int(monthProgress * 100))% av månedsmål nådd — \(Int(monthGoal) - wonThisMonth) igjen.")
                .font(.appScaled(size: 11))
                .foregroundStyle(Brand.textSecondary)
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
    }

    private var contactInfoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Kontaktinformasjon")
                .font(.appScaled(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            VStack(spacing: 10) {
                contactRow(icon: "envelope.fill", color: Brand.blue,
                           label: "E-post", value: email ?? "—")
                contactRow(icon: "phone.fill", color: Brand.green,
                           label: "Telefon", value: "+47 412 34 567")
                contactRow(icon: "mappin.and.ellipse", color: Brand.orange,
                           label: "Lokasjon", value: "Oslo, Norge")
                contactRow(icon: "building.2.fill", color: Brand.purple,
                           label: "Avdeling", value: "Salg & vekst")
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
    }

    private func contactRow(icon: String, color: Color, label: String, value: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(color.opacity(0.20))
                Image(systemName: icon).font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 28, height: 28)
            Text(label)
                .font(.appScaled(size: 12, weight: .medium))
                .foregroundStyle(Brand.textSecondary)
            Spacer()
            Text(value)
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
    }

    private var achievementsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Achievements")
                    .font(.appScaled(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("6 av 12")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textTertiary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    achievementBadge(icon: "flame.fill", color: Brand.red,
                                     label: "Streak", desc: "12 dager", earned: true)
                    achievementBadge(icon: "trophy.fill", color: Brand.yellow,
                                     label: "Top 3", desc: "Q2 2026", earned: true)
                    achievementBadge(icon: "rocket.fill", color: Brand.purple,
                                     label: "100+", desc: "leads i mnd", earned: true)
                    achievementBadge(icon: "phone.fill", color: Brand.blue,
                                     label: "Ringer", desc: "50+/uke", earned: true)
                    achievementBadge(icon: "checkmark.seal.fill", color: Brand.green,
                                     label: "Closer", desc: "10+ won", earned: true)
                    achievementBadge(icon: "calendar", color: Brand.orange,
                                     label: "Møte-konge", desc: "20+ booket", earned: true)
                    achievementBadge(icon: "star.fill", color: Brand.textTertiary,
                                     label: "VIP", desc: "Låst", earned: false)
                    achievementBadge(icon: "crown.fill", color: Brand.textTertiary,
                                     label: "#1", desc: "Låst", earned: false)
                }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
    }

    private func achievementBadge(icon: String, color: Color,
                                  label: String, desc: String,
                                  earned: Bool) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(earned ? color.opacity(0.30) : Brand.cardHi)
                Circle()
                    .stroke(earned ? color.opacity(0.6) : Brand.stroke, lineWidth: 1.5)
                Image(systemName: icon)
                    .font(.appScaled(size: 20, weight: .semibold))
                    .foregroundStyle(earned ? color : Brand.textTertiary)
                if earned {
                    // Liten "checkmark" badge i hjørnet
                    ZStack {
                        Circle().fill(Brand.green)
                        Image(systemName: "checkmark")
                            .font(.appScaled(size: 7, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 14, height: 14)
                    .offset(x: 18, y: -18)
                }
            }
            .frame(width: 54, height: 54)
            Text(label)
                .font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(earned ? .white : Brand.textTertiary)
            Text(desc)
                .font(.appScaled(size: 9))
                .foregroundStyle(Brand.textTertiary)
                .lineLimit(1)
        }
        .frame(width: 88)
        .padding(.vertical, 10)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .opacity(earned ? 1.0 : 0.65)
    }

    private var actionRows: some View {
        VStack(spacing: 10) {
            // Passord + 2FA styres på web-kontoen (native paring/Google-
            // login på iPad) → ærlige lenker, ikke døde rader.
            actionRow(icon: "lock.fill", color: Brand.purple,
                      label: "Endre passord", trailingIcon: "arrow.up.right") {
                if let url = URL(string: webAccountBase) { openURL(url) }
            }
            actionRow(icon: "key.fill", color: Brand.blue,
                      label: "Tofaktor-autentisering", trailingIcon: "arrow.up.right") {
                if let url = URL(string: "\(webAccountBase)/sikkerhet") { openURL(url) }
            }
            actionRow(icon: "arrow.down.doc.fill", color: Brand.green,
                      label: "Last ned mine data",
                      trailingIcon: exporting ? nil : "chevron.right",
                      showSpinner: exporting) {
                downloadMyData()
            }
            if let exportError {
                Text(exportError).font(.appScaled(size: 11)).foregroundStyle(Brand.red)
            }
        }
        .sheet(isPresented: $showExportShare) {
            if let json = exportJSON, let fileURL = exportFileURL(json) {
                ShareSheet(items: [fileURL])
            }
        }
    }

    /// Skriv JSON til en temp-fil så ShareLink/AirDrop/Filer får et ekte
    /// dokument (ikke bare en råstreng).
    private func exportFileURL(_ json: String) -> URL? {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("leadgrid-mine-data.json")
        try? json.data(using: .utf8)?.write(to: url)
        return url
    }

    private func actionRow(
        icon: String, color: Color, label: String,
        trailingIcon: String? = "chevron.right",
        showSpinner: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(color.opacity(0.22))
                    Image(systemName: icon).font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 34, height: 34)
                Text(label)
                    .font(.appScaled(size: 14, weight: .medium))
                    .foregroundStyle(.white)
                Spacer()
                if showSpinner {
                    ProgressView().tint(Brand.textTertiary)
                } else if let trailingIcon {
                    Image(systemName: trailingIcon)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(Brand.textTertiary)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - ProfilePopover (header-dropdown for brukerkonto)
//
// Klassisk profil-meny: stort brukerkort på toppen, deretter
// gruppert konto-/app-/hjelp-rader, og Logg ut nederst. Hentet etter
// Daniel-feedback 2026-06-28 — fjerde quick-action i header etter
// Analyse, NextActions og Aktivitet.

struct ProfilePopover: View {
    let name: String
    let email: String?
    /// Rolle-linje under navnet — ekte verdi fra AppState (Leadgrid-admin
    /// vs Salgssjef), ikke hardkodet mock.
    var role: String = "Salgssjef"
    var onOpenMyProfile: () -> Void = {}
    /// SuperAdmin-konsoll — kun satt for Leadgrid-ansatte på faner som
    /// eier root-switchen (Leadbook).
    var onOpenSuperAdmin: (() -> Void)? = nil
    @Environment(AppState.self) private var appState
    @State private var pinGuideOpen = false
    @State private var aboutOpen = false
    @State private var abonnementOpen = false

    /// Abonnements-oversikten er org-ledelsens domene.
    private var canSeeAbonnement: Bool {
        ["admin", "salgssjef"].contains(appState.roleInOrg ?? "") || appState.isSuperAdmin
    }

    /// Ekte app-versjon fra bundelen (før: hardkodet «v1.3.1»).
    private var appVersion: String {
        let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        return v.map { "v\($0)" } ?? "—"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            profileHeader

            Divider().background(Brand.stroke)

            ScrollView {
                VStack(spacing: 18) {
                    section(title: "Konto") {
                        Button(action: onOpenMyProfile) {
                            row(icon: "person.fill", color: Brand.purple, label: "Min profil")
                        }
                        .buttonStyle(.plain)
                        // Ekte org/prosjekt-bytte via AppState — radene var
                        // døde (ingen action) frem til 2026-07-05-QA-en.
                        Menu {
                            ForEach(appState.organizations, id: \.id) { o in
                                Button {
                                    appState.activeOrganizationId = o.id
                                    Task { await appState.loadOrgContext() }
                                } label: {
                                    if appState.activeOrganizationId == o.id {
                                        Label(o.name, systemImage: "checkmark")
                                    } else {
                                        Text(o.name)
                                    }
                                }
                            }
                        } label: {
                            row(icon: "building.2.fill", color: Brand.blue,
                                label: "Bytt organisasjon",
                                trailing: appState.organizations.first {
                                    $0.id == appState.activeOrganizationId
                                }?.name)
                        }
                        .buttonStyle(.plain)
                        Menu {
                            ForEach(appState.projects, id: \.id) { p in
                                Button {
                                    appState.activeProjectId = p.id
                                    Task { await appState.refreshLeads() }
                                } label: {
                                    if appState.activeProjectId == p.id {
                                        Label(p.name, systemImage: "checkmark")
                                    } else {
                                        Text(p.name)
                                    }
                                }
                            }
                        } label: {
                            row(icon: "folder.fill", color: Brand.green,
                                label: "Bytt prosjekt",
                                trailing: appState.projects.first {
                                    $0.id == appState.activeProjectId
                                }?.name)
                        }
                        .buttonStyle(.plain)
                        // Abonnement (2026-07-17): plan + funksjoner + fakturaer
                        // + Stripe-portal — org-ledelsens eget overblikk.
                        if canSeeAbonnement {
                            Button { abonnementOpen = true } label: {
                                row(icon: "creditcard.fill", color: Brand.green,
                                    label: "Abonnement")
                            }
                            .buttonStyle(.plain)
                        }
                        if let onOpenSuperAdmin {
                            Button(action: onOpenSuperAdmin) {
                                row(icon: "crown.fill", color: Brand.yellow,
                                    label: "SuperAdmin-konsoll")
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    section(title: "Apper") {
                        Button {
                            if let url = URL(string: UIApplication.openSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            row(icon: "gearshape.fill", color: Brand.textSecondary, label: "Innstillinger")
                        }
                        .buttonStyle(.plain)
                        // «Mørk modus»-toggle fjernet 2026-07-17: var fake
                        // (.constant(true)) — appen er låst til mørk via
                        // preferredColorScheme(.dark); ingen lys modus å bytte til.
                        Button {
                            if let url = URL(string: UIApplication.openSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            row(icon: "bell.badge.fill", color: Brand.orange, label: "Varslinger")
                        }
                        .buttonStyle(.plain)
                    }
                    section(title: "Hjelp") {
                        Button {
                            if let url = URL(string: "mailto:support@creatorhubn.com?subject=Leadgrid%20support") {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            row(icon: "questionmark.circle.fill", color: Brand.blue, label: "Hjelp & støtte")
                        }
                        .buttonStyle(.plain)
                        // Pin-guiden fantes alt som flate (Mer-fanen) — raden
                        // var bare aldri wiret hit.
                        Button { pinGuideOpen = true } label: {
                            row(icon: "lightbulb.fill", color: Brand.yellow, label: "Forstå pinsene")
                        }
                        .buttonStyle(.plain)
                        Button { aboutOpen = true } label: {
                            row(icon: "info.circle.fill", color: Brand.textSecondary,
                                label: "Om Leadgrid", trailing: appVersion)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 14)
            }

            Divider().background(Brand.stroke)

            Button {
                appState.signOut()
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.appScaled(size: 13, weight: .semibold))
                    Text("Logg ut")
                        .font(.appScaled(size: 13, weight: .semibold))
                }
                .foregroundStyle(Brand.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .background(Brand.card)
        .sheet(isPresented: $pinGuideOpen) {
            // Sheet-rot → egen NavigationStack er trygt (ikke nestet i push).
            NavigationStack { PinGuideView() }
        }
        .sheet(isPresented: $aboutOpen) {
            AboutLeadgridSheet()
        }
        .sheet(isPresented: $abonnementOpen) {
            AbonnementSheet()
        }
    }

    private var profileHeader: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(LinearGradient(
                        colors: [Brand.purple, Brand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                Text(initials)
                    .font(.appScaled(size: 18, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 52, height: 52)
            .shadow(color: Brand.purple.opacity(0.5), radius: 8, y: 2)

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.appScaled(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let email = email {
                    Text(email)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                        .lineLimit(1)
                }
                Text(role)
                    .font(.appScaled(size: 11, weight: .medium))
                    .foregroundStyle(Brand.purpleLight)
            }
            Spacer()
        }
        .padding(16)
    }

    private var initials: String {
        let parts = name.split(separator: " ")
        return parts.prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }

    @ViewBuilder
    private func section<Content: View>(
        title: String, @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(Brand.textSecondary)
                .textCase(.uppercase)
                .tracking(0.8)
            VStack(spacing: 4) {
                content()
            }
        }
    }

    private func row(icon: String, color: Color, label: String,
                     trailing: String? = nil,
                     toggle: Binding<Bool>? = nil) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(color.opacity(0.20))
                Image(systemName: icon)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 30, height: 30)
            Text(label)
                .font(.appScaled(size: 13, weight: .medium))
                .foregroundStyle(.white)
            Spacer(minLength: 4)
            if let toggle = toggle {
                Toggle("", isOn: toggle)
                    .labelsHidden()
                    .tint(Brand.purple)
                    .scaleEffect(0.85)
            } else {
                if let t = trailing {
                    Text(t)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textTertiary)
                        .lineLimit(1)
                }
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(Brand.textTertiary)
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}

// MARK: - AboutLeadgridSheet («Om Leadgrid» fra ProfilePopover)
//
// Ekte om-flate (Daniel-feedback 2026-07-17: raden skal navigere, ikke bare
// vise versjonsnummer). Alt innhold leses fra bundelen eller er statiske
// fakta — ingen mock.

struct AboutLeadgridSheet: View {
    @Environment(\.dismiss) private var dismiss

    private var version: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "—"
    }
    private var buildNumber: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String) ?? "—"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    // Merkevare-hode
                    VStack(spacing: 10) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 20)
                                .fill(LinearGradient(colors: [Brand.purple, Brand.purpleLight],
                                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                            Image(systemName: "map.fill")
                                .font(.appScaled(size: 34, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 84, height: 84)
                        .shadow(color: Brand.purple.opacity(0.45), radius: 14, y: 4)
                        Text("Leadgrid")
                            .font(.appScaled(size: 24, weight: .black))
                            .foregroundStyle(.white)
                        Text("Feltsalg, leads og ruter — samlet på ett kart.")
                            .font(.appScaled(size: 13))
                            .foregroundStyle(Brand.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 10)

                    // Versjonsinfo (fra bundelen)
                    VStack(spacing: 0) {
                        infoRow(label: "Versjon", value: version)
                        Divider().background(Brand.stroke)
                        infoRow(label: "Bygg", value: buildNumber)
                    }
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))

                    // Lenker
                    VStack(spacing: 0) {
                        linkRow(icon: "globe", label: "leadgrid.no",
                                url: "https://leadgrid.no")
                        Divider().background(Brand.stroke)
                        linkRow(icon: "hand.raised.fill", label: "Personvern",
                                url: "https://leadgrid.no/personvern")
                        Divider().background(Brand.stroke)
                        linkRow(icon: "envelope.fill", label: "Kontakt support",
                                url: "mailto:support@creatorhubn.com?subject=Leadgrid%20support")
                    }
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))

                    Text("© 2026 Creatorhub AS")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textTertiary)
                        .padding(.bottom, 10)
                }
                .padding(.horizontal, 18)
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Om Leadgrid")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                        .foregroundStyle(Brand.purpleLight)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func infoRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.appScaled(size: 13, weight: .medium))
                .foregroundStyle(.white)
            Spacer()
            Text(value)
                .font(.appScaled(size: 13))
                .foregroundStyle(Brand.textSecondary)
                .monospacedDigit()
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
    }

    private func linkRow(icon: String, label: String, url: String) -> some View {
        Button {
            if let u = URL(string: url) { UIApplication.shared.open(u) }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                    .frame(width: 22)
                Text(label)
                    .font(.appScaled(size: 13, weight: .medium))
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textTertiary)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - AnalysePopover (header-dropdown for Pipeline + Trend)
//
// Konsolidert chart-popover etter Daniel-feedback 2026-06-28: flytt
// Pipeline oversikt + Leads over tid ut av dashboard for å holde
// hovedflaten map-fokusert. Begge widgetene har egen seksjon i
// scrollet popover så salgskonsulenten kan veksle uten å bytte tab.

struct AnalysePopover: View {
    let leads: [LeadModel]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Analyse")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("Pipeline + trend siste 30 dager")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
                Spacer()
                Text("Full rapport")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .padding(16)

            Divider().background(Brand.stroke)

            ScrollView {
                VStack(spacing: 18) {
                    PipelineOverviewCard(leads: leads)
                    LeadsOverTimeCard(leads: leads)
                        .frame(height: 280)
                }
                .padding(16)
            }
        }
        .background(Brand.card)
    }
}

// MARK: - NextActionsPopover (header-dropdown for raskere tilgang)
//
// Speiler `NextActionsCard` på dashboarden, men i popover-format som er
// alltid tilgjengelig fra header (også når brukeren er på andre flater).
// Viser flere leads (8 i stedet for 4) siden vi ikke har plass-constraint.

struct NextActionsPopover: View {
    let leads: [LeadModel]
    var allLeads: [LeadModel] = []
    let totalCount: Int

    @State private var openLead: LeadModel?
    @State private var showAll = false

    /// Vis topp-8 som standard; «Se alle» utvider til hele køen.
    private var displayed: [LeadModel] { showAll ? allLeads : leads }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Neste handlinger")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("\(totalCount) leads i kø")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
                Spacer()
                if allLeads.count > leads.count {
                    Button {
                        showAll.toggle()
                    } label: {
                        Text(showAll ? "Vis færre" : "Se alle")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(Brand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)

            Divider().background(Brand.stroke)

            ScrollView {
                VStack(spacing: 10) {
                    if displayed.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.appScaled(size: 28))
                                .foregroundStyle(Brand.green)
                            Text("Du er ajour!")
                                .font(.appScaled(size: 14, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("Ingen oppfølginger venter.")
                                .font(.caption)
                                .foregroundStyle(Brand.textSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                    } else {
                        ForEach(displayed, id: \.id) { lead in
                            NextActionRow(lead: lead, onOpen: { openLead = $0 })
                                .padding(.horizontal, 4)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 10)
                .padding(.bottom, 14)
            }
        }
        .background(Brand.card)
        .sheet(item: $openLead) { lead in
            LeadDetailSheet(lead: lead)
        }
    }
}

// MARK: - RecentActivitiesPopover (header-dropdown)

struct RecentActivitiesPopover: View {
    let leads: [LeadModel]
    let upcomingFollowups: Int
    let momentum: LeadgridMomentum?
    /// Når data sist ble hentet — driver den EKTE «Oppdatert …»-teksten i
    /// footeren (før: hardkodet «Oppdaterte data for 2 min siden»).
    var lastUpdated: Date? = nil
    @State private var showAllActivities = false

    private var lastUpdatedLabel: String? {
        guard let lastUpdated else { return nil }
        let seconds = Date().timeIntervalSince(lastUpdated)
        if seconds < 60 { return "Oppdatert nettopp" }
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.unitsStyle = .short
        return "Oppdatert \(f.localizedString(for: lastUpdated, relativeTo: Date()))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Aktivitet").font(.headline).foregroundStyle(.white)
                Spacer()
                Button { showAllActivities = true } label: {
                    Text("Se alle")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            .padding(16)

            Divider().background(Brand.stroke)

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    // Tips øverst i popover.
                    if upcomingFollowups > 0 {
                        TipsRow(upcoming: upcomingFollowups)
                    }

                    // Aktivitet i dag — flyttet hit fra dashboard
                    // (Daniel-feedback: frigjør plass på Oversikt).
                    PopoverSectionHeader(label: "I dag")
                    ActivityTodayCompact(momentum: momentum)

                    // Siste aktiviteter event-stream
                    PopoverSectionHeader(label: "Siste hendelser")
                    RecentActivitiesCard(leads: leads, embedded: true)
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 18)
            }

            if let label = lastUpdatedLabel {
                Divider().background(Brand.stroke)

                HStack {
                    Spacer()
                    Text(label)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(Brand.textTertiary)
                    Image(systemName: "arrow.clockwise")
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(Brand.textTertiary)
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
            }
        }
        .background(Brand.card)
        .sheet(isPresented: $showAllActivities) {
            NavigationStack {
                ScrollView {
                    RecentActivitiesCard(leads: leads, embedded: true)
                        .padding(16)
                }
                .background(Brand.bg.ignoresSafeArea())
                .navigationTitle("Alle aktiviteter")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Lukk") { showAllActivities = false }.foregroundStyle(Brand.purpleLight)
                    }
                }
            }
        }
    }
}

struct PopoverSectionHeader: View {
    let label: String
    var body: some View {
        Text(label)
            .font(.appScaled(size: 11, weight: .bold))
            .foregroundStyle(Brand.textSecondary)
            .textCase(.uppercase)
            .tracking(0.8)
    }
}

/// Kompakt versjon av ActivityTodayCard (uten card-bakgrunn) for bruk
/// inni popover-en. Demo-modus viser mock-tall; ellers ekte tellere fra
/// /api/leadgrid/momentum/today (todayActivity.calls/emails/visits).
private struct ActivityTodayCompact: View {
    let momentum: LeadgridMomentum?
    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }
    private var calls: Int    { isDemo ? 14 : (momentum?.todayActivity.calls ?? 0) }
    private var emails: Int   { isDemo ? 22 : (momentum?.todayActivity.emails ?? 0) }
    private var meetings: Int { isDemo ? 3  : (momentum?.todayActivity.meetings ?? 0) }
    private var visits: Int   { isDemo ? 7  : (momentum?.todayActivity.visits ?? 0) }

    var body: some View {
        VStack(spacing: 10) {
            row(icon: "phone.fill", color: Brand.blue, label: "Telefoner", value: calls)
            row(icon: "envelope.fill", color: Brand.purple, label: "E-poster", value: emails)
            row(icon: "calendar", color: Brand.green, label: "Møter", value: meetings)
            row(icon: "mappin.and.ellipse", color: Brand.orange, label: "Besøk", value: visits)
        }
        .padding(12)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))
    }

    private func row(icon: String, color: Color, label: String, value: Int) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(color.opacity(0.22))
                Image(systemName: icon)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 30, height: 30)
            Text(label)
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(.white)
            Spacer()
            Text("\(value)")
                .font(.appScaled(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
        }
    }
}

// MARK: - TipsRow (inline-variant for popover)

private struct TipsRow: View {
    let upcoming: Int
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                Circle().fill(Brand.purple.opacity(0.20))
                Image(systemName: "sparkles")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text("Tips")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .textCase(.uppercase)
                    .tracking(0.5)
                Text("Du har \(upcoming) oppfølginger som forfaller i løpet av de neste 3 dagene.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(Brand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.purple.opacity(0.30), lineWidth: 1))
    }
}

// MARK: - RecentActivitiesCard

private struct RecentActivitiesCard: View {
    let leads: [LeadModel]
    var embedded: Bool = false  // true = vises inni popover (uten ramme/tittel)
    @State private var showAll = false

    private struct Event: Identifiable {
        let id = UUID()
        let icon: String
        let title: String
        let subtitle: String
        let dotColor: Color
        let iconBg: Color
        let iconColor: Color
    }

    private var events: [Event] {
        // KUN demo-modus viser eksempel-hendelser. I ekte modus har vi
        // ingen aktivitets-feed fra backend enda → ærlig tom-tilstand i
        // stedet for fabrikkerte «Lead åpnet tilbudet»-rader bygget av
        // ekte lead-navn (Daniel 2026-07-04: hele headeren = ekte data).
        guard DemoModeManager.isActiveNonisolated else {
            return []
        }
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "HH:mm"
        let baseTime = Date()
        let leadName = { (idx: Int) -> String in
            guard leads.indices.contains(idx) else { return "Lead" }
            return leads[idx].name
        }
        return [
            Event(
                icon: "building.2.fill",
                title: "\(leadName(0)) åpnet tilbudet ditt",
                subtitle: "I dag, \(f.string(from: baseTime))",
                dotColor: Brand.green,
                iconBg: Brand.purple.opacity(0.25), iconColor: Brand.purple
            ),
            Event(
                icon: "phone.fill",
                title: "Du ringte \(leadName(1))",
                subtitle: "Oppfølging planlagt til i dag, 11:30",
                dotColor: Brand.blue,
                iconBg: Brand.blue.opacity(0.25), iconColor: Brand.blue
            ),
            Event(
                icon: "envelope.fill",
                title: "\(leadName(2)) svarte på e-posten din",
                subtitle: "E-post tråd oppdatert · i går, 16:45",
                dotColor: Brand.green,
                iconBg: Brand.orange.opacity(0.25), iconColor: Brand.orange
            ),
            Event(
                icon: "calendar",
                title: "Møte med \(leadName(3)) bekreftet",
                subtitle: "I morgen, 10:00",
                dotColor: Brand.purple,
                iconBg: Brand.green.opacity(0.25), iconColor: Brand.green
            ),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if !embedded {
                HStack {
                    Text("Siste aktiviteter").font(.headline).foregroundStyle(.white)
                    Spacer()
                    Button { showAll = true } label: {
                        Text("Se alle")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(Brand.purpleLight)
                    }
                    .buttonStyle(.plain)
                }
            }
            if events.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.appScaled(size: 22))
                        .foregroundStyle(Brand.textTertiary)
                    Text("Ingen hendelser enda")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.textSecondary)
                    Text("Aktivitet dukker opp her etter hvert som teamet ringer, sender e-post og booker møter.")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(Brand.textTertiary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 260)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
            } else {
                VStack(spacing: 14) {
                    ForEach(events) { e in
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 9).fill(e.iconBg)
                                Image(systemName: e.icon).font(.appScaled(size: 13, weight: .semibold))
                                    .foregroundStyle(e.iconColor)
                            }
                            .frame(width: 32, height: 32)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(e.title)
                                    .font(.appScaled(size: 13, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                Text(e.subtitle)
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(Brand.textSecondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Circle().fill(e.dotColor).frame(width: 8, height: 8)
                        }
                    }
                }
            }
            if !embedded {
                Divider().background(Brand.stroke).padding(.top, 4)
                Button { showAll = true } label: {
                    HStack {
                        Spacer()
                        Text("Se alle aktiviteter").font(.appScaled(size: 12, weight: .semibold))
                        Image(systemName: "arrow.right").font(.appScaled(size: 11, weight: .semibold))
                        Spacer()
                    }
                    .foregroundStyle(Brand.purpleLight).padding(.top, 2)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(embedded ? Color.clear : Brand.card,
                    in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            embedded ? nil : RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1)
        )
        .sheet(isPresented: $showAll) {
            NavigationStack {
                ScrollView {
                    RecentActivitiesCard(leads: leads, embedded: true)
                        .padding(16)
                }
                .background(Brand.bg.ignoresSafeArea())
                .navigationTitle("Alle aktiviteter")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Lukk") { showAll = false }.foregroundStyle(Brand.purpleLight)
                    }
                }
            }
        }
    }
}

// MARK: - SellerDetailSheet
//
// Åpnes når salgssjefen tapper en selger i Topp selgere. Viser HVA
// selgeren har solgt og HVOR — kritisk for salgsledelse: ser om
// teamet selger riktig produkt-mix og dekker geografi.
//
// Layout:
//   1. Hero (avatar + navn + tittel + rank-badge)
//   2. 4 stats-kort (deals, NOK, snitt-deal, konv.rate)
//   3. Top vunne deals (5 stk: kunde + kategori + verdi + by + dato)
//   4. Geografisk fordeling (by-liste + andel av verdi som horisontal bar)
//   5. Bransje-mix (bransje-bar med farger + antall)

struct SellerDetailSheet: View {
    let seller: TopSellersSheet.Seller
    let isCurrentUser: Bool
    @Environment(\.dismiss) private var dismiss

    private enum Brand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
        static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
        static let textSecondary = Color.white.opacity(0.62)
        static let textTertiary = Color.white.opacity(0.45)
    }

    private func nok(_ v: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        f.groupingSeparator = " "
        return (f.string(from: NSNumber(value: v)) ?? "\(Int(v))") + " kr"
    }

    private var avgDeal: Double {
        guard seller.won > 0 else { return 0 }
        return seller.totalValue / Double(seller.won)
    }

    private var conversion: Double {
        guard seller.leads > 0 else { return 0 }
        return Double(seller.won) / Double(seller.leads) * 100
    }

    private var initials: String {
        seller.name.split(separator: " ").prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    hero
                    statsGrid
                    topDealsCard
                    regionsCard
                    industryCard
                    Spacer(minLength: 16)
                }
                .padding(20)
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle(seller.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: {
                        ZStack {
                            Circle().fill(Brand.cardHi)
                            Circle().stroke(Brand.stroke, lineWidth: 1)
                            Image(systemName: "xmark")
                                .font(.appScaled(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                }
            }
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var hero: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle().fill(seller.avatarColor.opacity(0.3))
                Text(initials)
                    .font(.appScaled(size: 26, weight: .bold))
                    .foregroundStyle(seller.avatarColor)
            }
            .frame(width: 72, height: 72)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(seller.name)
                        .font(.appScaled(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                    if isCurrentUser {
                        Text("Du")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(Brand.purpleLight)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Brand.purple.opacity(0.25), in: Capsule())
                    }
                }
                Text(seller.title)
                    .font(.appScaled(size: 13))
                    .foregroundStyle(Brand.textSecondary)
                HStack(spacing: 6) {
                    Image(systemName: "rosette")
                        .font(.appScaled(size: 11, weight: .semibold))
                    Text("Rang #\(seller.rank) i organisasjonen")
                        .font(.appScaled(size: 12, weight: .semibold))
                }
                .foregroundStyle(Brand.yellow)
            }
            Spacer()
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(seller.avatarColor.opacity(0.35), lineWidth: 1.2)
        )
    }

    private var statsGrid: some View {
        let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        return LazyVGrid(columns: cols, spacing: 10) {
            statCard(title: "Vunne deals", value: "\(seller.won)", accent: Brand.green, icon: "trophy.fill")
            statCard(title: "Total verdi", value: nok(seller.totalValue), accent: Brand.purple, icon: "norwegiankronesign.circle.fill")
            statCard(title: "Snitt-deal", value: nok(avgDeal), accent: Brand.purpleLight, icon: "chart.bar.fill")
            statCard(title: "Konv.rate", value: String(format: "%.1f %%", conversion), accent: Brand.yellow, icon: "target")
        }
    }

    private func statCard(title: String, value: String, accent: Color, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(accent)
                Spacer()
            }
            Text(value)
                .font(.appScaled(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.appScaled(size: 11))
                .foregroundStyle(Brand.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
    }

    private var topDealsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(icon: "list.bullet.rectangle.portrait.fill", title: "Top vunne deals", subtitle: "Siste \(seller.topDeals.count) vinnere")
            VStack(spacing: 8) {
                ForEach(seller.topDeals) { deal in
                    dealRow(deal)
                }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func dealRow(_ deal: TopSellersSheet.Deal) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Brand.purple.opacity(0.18))
                Image(systemName: "building.2.fill")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(deal.customer)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(deal.category)
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Brand.purple.opacity(0.18), in: Capsule())
                    HStack(spacing: 3) {
                        Image(systemName: "mappin")
                            .font(.appScaled(size: 9))
                        Text(deal.city)
                            .font(.appScaled(size: 11))
                    }
                    .foregroundStyle(Brand.textSecondary)
                }
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                Text(nok(deal.value))
                    .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(Brand.green)
                    .monospacedDigit()
                Text(deal.daysAgo == 0 ? "i dag" : "\(deal.daysAgo)d siden")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
            }
        }
        .padding(10)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    private var regionsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(icon: "map.fill", title: "Geografisk område", subtitle: "Hvor selger \(seller.name.split(separator: " ").first.map(String.init) ?? "selgeren")?")
            VStack(spacing: 8) {
                ForEach(seller.regions) { r in
                    regionRow(r)
                }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func regionRow(_ r: TopSellersSheet.RegionStat) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "mappin.circle.fill")
                    .font(.appScaled(size: 13))
                    .foregroundStyle(Brand.purpleLight)
                Text(r.city)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(r.count) deals")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Text(String(format: "%.0f %%", r.valueShare * 100))
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(Brand.green)
                    .frame(width: 44, alignment: .trailing)
                    .monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Brand.stroke)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(LinearGradient(
                            colors: [Brand.purple, Brand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        ))
                        .frame(width: max(4, geo.size.width * CGFloat(r.valueShare)))
                }
            }
            .frame(height: 6)
        }
    }

    private var industryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(icon: "square.grid.2x2.fill", title: "Bransje-mix", subtitle: "Fordeling av vunne deals")
            let total = max(1, seller.industries.reduce(0) { $0 + $1.count })
            // Stablet horisontal bar: alle bransjer i én rad m/ farge-segmenter
            GeometryReader { geo in
                HStack(spacing: 2) {
                    ForEach(seller.industries) { ind in
                        Rectangle()
                            .fill(ind.color)
                            .frame(width: max(2, geo.size.width * CGFloat(ind.count) / CGFloat(total)))
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .frame(height: 14)
            VStack(spacing: 6) {
                ForEach(seller.industries) { ind in
                    HStack(spacing: 8) {
                        Circle().fill(ind.color).frame(width: 8, height: 8)
                        Text(ind.name)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(.white)
                        Spacer()
                        Text("\(ind.count)")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                        Text(String(format: "%.0f %%", Double(ind.count) / Double(total) * 100))
                            .font(.appScaled(size: 11))
                            .foregroundStyle(Brand.textSecondary)
                            .frame(width: 44, alignment: .trailing)
                            .monospacedDigit()
                    }
                }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func sectionHeader(icon: String, title: String, subtitle: String) -> some View {
        HStack(alignment: .top) {
            Image(systemName: icon)
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textTertiary)
            }
            Spacer()
        }
    }
}

// MARK: - SalesLeadershipSheet
//
// Salgssjef-only sheet i Topp selgere: ÉN sentral plass for å sette
// provisjons-satser, lansere konkurranser og sette mål. Tre-fane-design
// holder kompleksitet skjult til det trengs.
//
// Daniel-spørsmål 2026-06-28:
//   "hvordan kan også salgsjefen sette provisjons satser og konkurranser etc."
//
// Datamodell (mock): hver fane har sin egen mock-state. I prod kobles
// sats/konkurranse/mål til backend (kommer som egne mig/tabeller når
// dette godkjennes).

struct SalesLeadershipSheet: View {
    let sellers: [TopSellersSheet.Seller]
    let currentUserName: String
    /// true når viewet vises som innebygd FANE (SalgsledelseView) i stedet
    /// for modal sheet — skjuler X-lukkeknappen som ellers ikke gir mening.
    var embedded: Bool = false
    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab = .catalog
    @State private var newContestOpen: Bool = false
    @State private var rankingOpen: Bool = false   // «Se rangering»/«Se alle selgere» → TopSellersSheet

    enum Tab: String, CaseIterable {
        case commission = "Provisjon"
        case contest = "Konkurranser"
        case catalog = "Premie-katalog"
        case goal = "Mål"
        var icon: String {
            switch self {
            case .commission: return "norwegiankronesign.circle.fill"
            case .contest: return "trophy.fill"
            case .catalog: return "gift.fill"
            case .goal: return "target"
            }
        }
    }

    // Org-spesifikke premier som salgssjefen har lagt til. Persisteres i
    // prod (per-org-rad i `org_prize_catalog`); her er det @State.
    // Mock-eksemplene (KUN demo-modus) bruker ikoner siden vi ikke har EKTE
    // produktbilder. Når salgssjefen laster opp via PhotosPicker eller
    // setter URL → vises det ekte bildet. Demo AV → tom (ærlig) liste;
    // salgssjefen kan fortsatt legge til egne via «+».
    @State private var orgCatalog: [PrizeProduct] = DemoModeManager.isActiveNonisolated ? [
        PrizeProduct(name: "Drone DJI Mavic 3",           icon: "airplane",                              priceNok: 18_500, category: .tech,       vendor: "Komplett (org)"),
        PrizeProduct(name: "Org-helgetur til Lofoten",    icon: "mountain.2.fill",                       priceNok: 14_000, category: .travel,     vendor: "Egen avtale"),
        PrizeProduct(name: "Personlig PT-pakke 10 timer", icon: "figure.strengthtraining.traditional",   priceNok: 6_500,  category: .experience, vendor: "Sats (avtale)"),
    ] : []
    @State private var newProductOpen: Bool = false

    private enum Brand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
        static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
        static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
        static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
        static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
        static let textSecondary = Color.white.opacity(0.62)
        static let textTertiary = Color.white.opacity(0.45)
    }

    // MARK: Provisjon — modell-bibliotek
    //
    // Ulike organisasjoner kjører ulike provisjons-modeller (B2B SaaS-org vs
    // konsulent-byrå vs foto/video-byrå). Salgssjefen velger bransje-preset
    // eller bygger sin egen MIX av modeller — modellene STABLES (en deal
    // kan f.eks. trigge flat-sats + accelerator + spiff samtidig).

    enum ModelType: String, CaseIterable, Identifiable {
        case flat            // Flat sats per deal-kategori
        case tiered          // Trapp: sats stiger med volum
        case accelerator     // Over måneds-mål: alle deals × N
        case recurring       // MRR-deal: % i N måneder
        case spiff           // Engangs-bonus for handling
        case split           // Splitt deal mellom 2+ selgere
        case margin          // % av bruttomargin (ikke salgssum)
        case perActivity     // Fast NOK per booket møte/demo
        case teamPool        // Felles pott delt likt
        case hybridBase      // Fast grunnlønn + komisjon over terskel

        var id: String { rawValue }
        var title: String {
            switch self {
            case .flat:        return "Flat sats per kategori"
            case .tiered:      return "Trappet (tiered)"
            case .accelerator: return "Accelerator"
            case .recurring:   return "Recurring (MRR)"
            case .spiff:       return "Spiff / aktivitets-bonus"
            case .split:       return "Splitt-deal"
            case .margin:      return "Margin-basert"
            case .perActivity: return "Per aktivitet"
            case .teamPool:    return "Team-pool"
            case .hybridBase:  return "Hybrid (base + komisjon)"
            }
        }
        var subtitle: String {
            switch self {
            case .flat:        return "Selger får % av deal-verdi, varierer per kategori"
            case .tiered:      return "Sats hopper opp ved milepæler — 5 % → 8 % → 12 %"
            case .accelerator: return "Over 100 % av mål: alle nye deals × 1.5×"
            case .recurring:   return "Abonnement-deals: % av MRR i 12-24 mnd"
            case .spiff:       return "Engangs-bonus: ny logo, booket demo, konkurrent-bytte"
            case .split:       return "To selgere på samme deal: 60/40-split"
            case .margin:      return "% av bruttomargin — incentiverer riktig prising"
            case .perActivity: return "Flat NOK per kvalifisert aktivitet (møte/demo/ringt)"
            case .teamPool:    return "Hele teamets bonus deles likt — fremmer samarbeid"
            case .hybridBase:  return "Garantilønn + komisjon over deal-terskel"
            }
        }
        var icon: String {
            switch self {
            case .flat:        return "percent"
            case .tiered:      return "chart.bar.fill"
            case .accelerator: return "arrow.up.right.circle.fill"
            case .recurring:   return "repeat.circle.fill"
            case .spiff:       return "gift.fill"
            case .split:       return "person.2.fill"
            case .margin:      return "scalemass.fill"
            case .perActivity: return "bolt.fill"
            case .teamPool:    return "person.3.sequence.fill"
            case .hybridBase:  return "house.lodge.fill"
            }
        }
        var accent: Color {
            switch self {
            case .flat:        return Color(red: 0.66, green: 0.32, blue: 0.99)
            case .tiered:      return Color(red: 0.34, green: 0.60, blue: 0.98)
            case .accelerator: return Color(red: 0.98, green: 0.55, blue: 0.10)
            case .recurring:   return Color(red: 0.20, green: 0.85, blue: 0.60)
            case .spiff:       return Color(red: 0.98, green: 0.75, blue: 0.14)
            case .split:       return Color(red: 0.75, green: 0.45, blue: 1.0)
            case .margin:      return Color(red: 0.95, green: 0.20, blue: 0.20)
            case .perActivity: return Color(red: 0.34, green: 0.60, blue: 0.98)
            case .teamPool:    return Color(red: 0.20, green: 0.85, blue: 0.60)
            case .hybridBase:  return Color(red: 0.66, green: 0.32, blue: 0.99)
            }
        }
    }

    /// Bransje-presets — auto-fyller hvilke modeller som er aktive +
    /// fornuftige default-verdier. Salgssjefen kan så finpusse hver
    /// modell, eller velge "Egen" for å bygge fra blank.
    enum OrgPreset: String, CaseIterable, Identifiable {
        case custom = "Egen"
        case classicB2B = "Klassisk B2B"
        case saas = "SaaS"
        case agency = "Byrå / konsulent"
        case fotoVideo = "Foto / video"
        case enterpriseHybrid = "Enterprise hybrid"
        var id: String { rawValue }
        var activeModels: Set<ModelType> {
            switch self {
            case .custom:           return [.flat]
            case .classicB2B:       return [.flat, .accelerator, .spiff]
            case .saas:             return [.recurring, .accelerator, .spiff]
            case .agency:           return [.flat, .margin, .perActivity]
            case .fotoVideo:        return [.flat, .split, .spiff]
            case .enterpriseHybrid: return [.hybridBase, .accelerator, .teamPool, .spiff]
            }
        }
    }

    struct CommissionTier: Identifiable, Hashable {
        let id = UUID()
        var category: String
        var basePct: Double      // f.eks. 6 → 6 %
        var bonusPct: Double     // bonus over måneds-mål
        var color: Color
    }
    @State private var preset: OrgPreset = .classicB2B
    @State private var activeModels: Set<ModelType> = [.flat, .accelerator, .spiff]
    @State private var tiers: [CommissionTier] = [
        CommissionTier(category: "B2B SaaS",           basePct: 8.0, bonusPct: 12.0, color: Color(red: 0.66, green: 0.32, blue: 0.99)),
        CommissionTier(category: "Innholdsproduksjon", basePct: 7.0, bonusPct: 10.0, color: Color(red: 0.20, green: 0.85, blue: 0.60)),
        CommissionTier(category: "Foto/Video",         basePct: 6.5, bonusPct: 9.5,  color: Color(red: 0.75, green: 0.45, blue: 1.0)),
        CommissionTier(category: "Konsulent",          basePct: 5.0, bonusPct: 8.0,  color: Color(red: 0.98, green: 0.75, blue: 0.14)),
        CommissionTier(category: "Helsetech",          basePct: 10.0, bonusPct: 14.0, color: Color(red: 0.34, green: 0.60, blue: 0.98)),
    ]
    @State private var monthlyTargetK: Double = 500  // bonus-terskel i 1000 NOK

    // --- per-modell konfig ---
    struct TieredBand: Identifiable, Hashable {
        let id = UUID()
        var fromK: Double
        var pct: Double
    }
    @State private var tieredBands: [TieredBand] = [
        TieredBand(fromK: 0,    pct: 5),
        TieredBand(fromK: 500,  pct: 8),
        TieredBand(fromK: 1000, pct: 12),
        TieredBand(fromK: 2000, pct: 16),
    ]
    @State private var acceleratorMult: Double = 1.5     // 1.5× over mål
    @State private var acceleratorThreshold: Double = 100 // % av mål

    @State private var recurringPct: Double = 15.0
    @State private var recurringMonths: Double = 12

    struct SpiffRule: Identifiable, Hashable {
        let id = UUID()
        var trigger: String
        var amountNok: Double
    }
    @State private var spiffs: [SpiffRule] = [
        SpiffRule(trigger: "Ny logo (første deal)",        amountNok: 5_000),
        SpiffRule(trigger: "Booket demo m/ enterprise",   amountNok: 1_500),
        SpiffRule(trigger: "Konkurrent-bytte",            amountNok: 8_000),
        SpiffRule(trigger: "Oppsalg ≥ 50 % på eksisterende", amountNok: 3_000),
    ]

    @State private var splitDefaultPrimary: Double = 60   // primary får 60 %
    @State private var marginPct: Double = 25.0
    @State private var perActivityNok: Double = 350       // NOK per kvalifisert møte
    @State private var teamPoolPct: Double = 5.0          // 5 % av team-omsetning i pott
    @State private var hybridBaseK: Double = 35           // 35K base/mnd
    @State private var hybridDealThresholdK: Double = 200 // komisjon starter etter 200K

    // MARK: Konkurranse state
    //
    // Konkurranser har TO lag: en MAL-katalog (org velger sine egne
    // mønstre) og AKTIVE konkurranser (lansert fra mal).
    //
    // Daniel-feedback 2026-06-28: «organisasjonen kan også ha ulike
    // konkurranser» — ulike org-typer trenger ulike maler. SaaS-org
    // vil ha MRR-focus + konkurrent-bytte; byrå vil ha mengde +
    // kvalitet; foto/video vil ha bransje-fokus + team-vs-team.

    enum ContestTemplateType: String, CaseIterable, Identifiable {
        case sprint           // Kort, intens (3-14 dager)
        case monthlyLeader    // Hele teamet, måneden ut
        case geographic       // Vinn én by/region
        case industry         // Vinn én bransje
        case teamVsTeam       // To lag konkurrerer
        case individual       // 1-mot-1 utfordring
        case volume           // Flest aktiviteter
        case quality          // Høyest snitt-deal / konv.rate
        case comeback         // Kun for selgere under target
        case onboarding       // Kun for nye selgere (< 90 dager)

        var id: String { rawValue }
        var title: String {
            switch self {
            case .sprint:        return "Sprint"
            case .monthlyLeader: return "Måneds-leaderboard"
            case .geographic:    return "Geografisk fokus"
            case .industry:      return "Bransje-fokus"
            case .teamVsTeam:    return "Team-mot-team"
            case .individual:    return "1-mot-1 utfordring"
            case .volume:        return "Mengde-konkurranse"
            case .quality:       return "Kvalitet-konkurranse"
            case .comeback:      return "Comeback challenge"
            case .onboarding:    return "Onboarding-cup"
            }
        }
        var subtitle: String {
            switch self {
            case .sprint:        return "Kort intens — alle selgere, 3-14 dager"
            case .monthlyLeader: return "Klassisk: hele måneden, mest NOK vinner"
            case .geographic:    return "Fokuser én by/region — flest nye kunder vinner"
            case .industry:      return "Vinn deals i én bransje (eks. Helsetech)"
            case .teamVsTeam:    return "Del teamet i 2 lag — lag-leder velger"
            case .individual:    return "Tilpasset utfordring til én selger"
            case .volume:        return "Flest møter / demoer / ringt — kvantitet"
            case .quality:       return "Høyest snitt-deal eller beste konv.rate"
            case .comeback:      return "Kun for selgere < 80 % mål — bonus-incentiv"
            case .onboarding:    return "Kun selgere < 90 dager — onboarding-boost"
            }
        }
        var icon: String {
            switch self {
            case .sprint:        return "bolt.fill"
            case .monthlyLeader: return "calendar"
            case .geographic:    return "map.fill"
            case .industry:      return "building.2.fill"
            case .teamVsTeam:    return "person.3.fill"
            case .individual:    return "person.fill"
            case .volume:        return "list.number"
            case .quality:       return "star.fill"
            case .comeback:      return "arrow.uturn.up.circle.fill"
            case .onboarding:    return "graduationcap.fill"
            }
        }
        var accent: Color {
            switch self {
            case .sprint:        return Color(red: 0.98, green: 0.55, blue: 0.10)
            case .monthlyLeader: return Color(red: 0.66, green: 0.32, blue: 0.99)
            case .geographic:    return Color(red: 0.34, green: 0.60, blue: 0.98)
            case .industry:      return Color(red: 0.20, green: 0.85, blue: 0.60)
            case .teamVsTeam:    return Color(red: 0.75, green: 0.45, blue: 1.0)
            case .individual:    return Color(red: 0.98, green: 0.75, blue: 0.14)
            case .volume:        return Color(red: 0.34, green: 0.60, blue: 0.98)
            case .quality:       return Color(red: 0.98, green: 0.75, blue: 0.14)
            case .comeback:      return Color(red: 0.95, green: 0.20, blue: 0.20)
            case .onboarding:    return Color(red: 0.20, green: 0.85, blue: 0.60)
            }
        }
        var defaultDays: Int {
            switch self {
            case .sprint:        return 7
            case .monthlyLeader: return 30
            case .geographic:    return 14
            case .industry:      return 21
            case .teamVsTeam:    return 14
            case .individual:    return 10
            case .volume:        return 7
            case .quality:       return 30
            case .comeback:      return 14
            case .onboarding:    return 90
            }
        }
        var defaultKpi: String {
            switch self {
            case .sprint:        return "Mest vunnet NOK"
            case .monthlyLeader: return "Mest vunnet NOK"
            case .geographic:    return "Flest nye møter i [region]"
            case .industry:      return "Mest vunnet i [bransje]"
            case .teamVsTeam:    return "Lagets totale verdi"
            case .individual:    return "Personlig 1-mot-1 KPI"
            case .volume:        return "Flest aktiviteter"
            case .quality:       return "Høyest snitt-deal"
            case .comeback:      return "Mest vunnet NOK (kun bak mål)"
            case .onboarding:    return "Mest vunnet NOK (nye selgere)"
            }
        }
        var defaultPrize: String {
            switch self {
            case .sprint:        return "Gavekort 5 000 kr"
            case .monthlyLeader: return "Gavekort 25 000 kr + Nespresso"
            case .geographic:    return "Helgetur for 2 til [region]"
            case .industry:      return "AirPods Max"
            case .teamVsTeam:    return "Vinnende lag: middag for hele teamet"
            case .individual:    return "Personlig coaching-time m/ Lars"
            case .volume:        return "iPad Air"
            case .quality:       return "Apple Watch Ultra"
            case .comeback:      return "Bonus 10 000 kr + ny startbonus"
            case .onboarding:    return "Mentor-time + 5 000 kr"
            }
        }
    }

    /// Hvilke konkurranse-maler er aktivert for denne org-en. Reuser
    /// `OrgPreset` (samme som provisjon) for konsistent merkevare.
    var contestTemplatesForPreset: Set<ContestTemplateType> {
        switch preset {
        case .custom:           return [.sprint, .monthlyLeader]
        case .classicB2B:       return [.sprint, .monthlyLeader, .geographic, .quality]
        case .saas:             return [.monthlyLeader, .industry, .quality, .comeback]
        case .agency:           return [.volume, .quality, .teamVsTeam]
        case .fotoVideo:        return [.industry, .teamVsTeam, .geographic]
        case .enterpriseHybrid: return [.individual, .onboarding, .quality, .monthlyLeader]
        }
    }
    @State private var contestPrefilledTemplate: ContestTemplateType?
    @State private var fulfillContest: Contest?

    struct Contest: Identifiable, Hashable {
        let id = UUID()
        var name: String
        var prize: String
        var kpi: String   // "Mest vunnet", "Flest møter", "Høyest snitt-deal"
        var endsInDays: Int
        var leaderName: String
        var leaderValue: String
        var participants: Int
    }
    @State private var contests: [Contest] = [
        Contest(name: "Mai-sprinten 2026 (AVSLUTTET)",
                prize: "1. iPad Pro · 2. AirPods Pro · 3. Restaurant-gavekort",
                kpi: "Mest vunnet NOK",
                endsInDays: 0, leaderName: "Mikkel Berg", leaderValue: "847K NOK",
                participants: 24),
        Contest(name: "Sommer-sprint 2026",
                prize: "Gavekort 25 000 kr + Nespresso-maskin",
                kpi: "Mest vunnet NOK",
                endsInDays: 12, leaderName: "Anniken Sørli", leaderValue: "1.2M NOK",
                participants: 24),
        Contest(name: "Oslo-storm",
                prize: "Helgetur for 2 til Bergen",
                kpi: "Flest nye møter i Oslo",
                endsInDays: 5, leaderName: "Mikkel Berg", leaderValue: "18 møter",
                participants: 12),
        Contest(name: "Helsetech-fokus",
                prize: "AirPods Max",
                kpi: "Høyest snitt-deal i Helsetech",
                endsInDays: 23, leaderName: "Sara Lindberg", leaderValue: "98 500 kr",
                participants: 8),
    ]

    // MARK: Mål state
    @State private var teamMonthlyGoalK: Double = 12_500   // 1000 NOK
    @State private var teamMonthlyAchievedK: Double = 8_140

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                tabBar
                ScrollView {
                    VStack(spacing: 16) {
                        switch tab {
                        case .commission: commissionTab
                        case .contest:    contestTab
                        case .catalog:    catalogTab
                        case .goal:       goalTab
                        }
                        Spacer(minLength: 16)
                        // Ekstra bunn-luft på iPhone så siste rad (f.eks.
                        // produktkort-griden) kan scrolles helt fram og
                        // ikke klippes bak tab-baren.
                        if DeviceIdiom.isPhone {
                            Color.clear.frame(height: 72)
                        }
                    }
                    .padding(20)
                }
            }
            .background(Brand.bg.ignoresSafeArea())
            // Fanetittelen er fjernet som innebygd fane — tab-baren viser
            // hvor du er. I sheet-modus beholdes tittelen (ingen tab-bar).
            .navigationTitle(embedded ? "" : "Salgsledelse")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // X-lukkeknapp kun i sheet-modus — som innebygd fane finnes
                // det ingenting å lukke.
                if !embedded {
                    ToolbarItem(placement: .cancellationAction) {
                        Button { dismiss() } label: {
                            ZStack {
                                Circle().fill(Brand.cardHi)
                                Circle().stroke(Brand.stroke, lineWidth: 1)
                                Image(systemName: "xmark")
                                    .font(.appScaled(size: 12, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                            .frame(width: 34, height: 34)
                        }
                        .buttonStyle(.plain)
                    }
                }
                if tab == .contest {
                    ToolbarItem(placement: .primaryAction) {
                        Button { newContestOpen = true } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "plus")
                                    .font(.appScaled(size: 12, weight: .bold))
                                Text("Ny konkurranse")
                                    .font(.appScaled(size: 13, weight: .semibold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                LinearGradient(
                                    colors: [Brand.purple, Brand.purpleLight],
                                    startPoint: .leading, endPoint: .trailing
                                ),
                                in: Capsule()
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                if tab == .catalog {
                    ToolbarItem(placement: .primaryAction) {
                        Button { newProductOpen = true } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "plus")
                                    .font(.appScaled(size: 12, weight: .bold))
                                Text("Nytt produkt")
                                    .font(.appScaled(size: 13, weight: .semibold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                LinearGradient(
                                    colors: [Brand.purple, Brand.purpleLight],
                                    startPoint: .leading, endPoint: .trailing
                                ),
                                in: Capsule()
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $rankingOpen) {
                TopSellersSheet(currentUserName: currentUserName)
            }
            .sheet(isPresented: $newContestOpen) {
                NewContestSheet(
                    template: contestPrefilledTemplate,
                    extraCatalog: orgCatalog,
                    onSave: { c in
                        contests.insert(c, at: 0)
                        newContestOpen = false
                        contestPrefilledTemplate = nil
                    }
                )
            }
            .sheet(isPresented: $newProductOpen) {
                CustomPrizeSheet { product in
                    orgCatalog.append(product)
                    newProductOpen = false
                }
            }
            .sheet(item: $fulfillContest) { c in
                PrizeFulfillmentSheet(contest: c, sellers: sellers)
            }
        }
    }

    private var tabBar: some View {
        // iPhone: pillene får naturlig bredde og rulles horisontalt i stedet
        // for å presses inn på likt fordelt bredde (ga ord-brekk midt i
        // «Konkurranser»). iPad beholder full-bredde-fordelingen.
        Group {
            if DeviceIdiom.isPhone {
                ScrollView(.horizontal, showsIndicators: false) {
                    tabBarPills
                }
            } else {
                tabBarPills
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
    }

    private var tabBarPills: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { t in
                Button { tab = t } label: {
                    HStack(spacing: 6) {
                        Image(systemName: t.icon)
                            .font(.appScaled(size: 12, weight: .semibold))
                        Text(t.rawValue)
                            .font(.appScaled(size: 13, weight: .semibold))
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                    }
                    .foregroundStyle(tab == t ? .white : Brand.textSecondary)
                    .frame(maxWidth: DeviceIdiom.isPhone ? nil : .infinity)
                    .padding(.vertical, 10)
                    .padding(.horizontal, DeviceIdiom.isPhone ? 14 : 0)
                    .background(
                        tab == t ? Brand.purple : Color.clear,
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Brand.card, in: Capsule())
        .overlay(Capsule().stroke(Brand.stroke, lineWidth: 1))
    }

    // MARK: Provisjon

    private var commissionTab: some View {
        VStack(spacing: 16) {
            commissionExplain
            presetPickerCard
            modelLibraryCard
            sellerOverrideCard
        }
    }

    private var presetPickerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "building.2.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Org-preset")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Ulike organisasjoner kjører ulike modeller — start med et preset")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textTertiary)
                }
                Spacer()
            }
            // Horisontal pille-rad m/ alle presets
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(OrgPreset.allCases) { p in
                        Button {
                            preset = p
                            if p != .custom {
                                activeModels = p.activeModels
                            }
                        } label: {
                            Text(p.rawValue)
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(preset == p ? .white : Brand.textSecondary)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(
                                    preset == p ? AnyShapeStyle(LinearGradient(
                                        colors: [Brand.purple, Brand.purpleLight],
                                        startPoint: .leading, endPoint: .trailing
                                    )) : AnyShapeStyle(Brand.cardHi),
                                    in: Capsule()
                                )
                                .overlay(
                                    Capsule()
                                        .stroke(preset == p ? Color.clear : Brand.stroke, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.green)
                Text("\(activeModels.count) modeller aktive — de stables på hver deal")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private var modelLibraryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "books.vertical.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Modell-bibliotek")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(ModelType.allCases.count) typer")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
            }
            VStack(spacing: 8) {
                ForEach(ModelType.allCases) { t in
                    modelRow(t)
                }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func modelRow(_ t: ModelType) -> some View {
        let isActive = activeModels.contains(t)
        return VStack(spacing: 0) {
            // Header-rad m/ ikon + tittel + toggle
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(t.accent.opacity(isActive ? 0.25 : 0.10))
                    Image(systemName: t.icon)
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(isActive ? t.accent : Brand.textTertiary)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.title)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(t.subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                        .lineLimit(2)
                }
                Spacer()
                Toggle("", isOn: Binding(
                    get: { activeModels.contains(t) },
                    set: { on in
                        if on { activeModels.insert(t) } else { activeModels.remove(t) }
                        preset = .custom  // bryter du presetet → custom
                    }
                ))
                .labelsHidden()
                .tint(t.accent)
            }
            .padding(12)
            // Konfig-panel (kun synlig når aktivert)
            if isActive {
                VStack(spacing: 0) {
                    Divider().overlay(Brand.stroke)
                    modelConfig(t)
                        .padding(12)
                }
                .background(Brand.cardHi.opacity(0.5))
            }
        }
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isActive ? t.accent.opacity(0.4) : Brand.stroke,
                        lineWidth: isActive ? 1.5 : 1)
        )
    }

    @ViewBuilder
    private func modelConfig(_ t: ModelType) -> some View {
        switch t {
        case .flat:        flatConfig
        case .tiered:      tieredConfig
        case .accelerator: acceleratorConfig
        case .recurring:   recurringConfig
        case .spiff:       spiffConfig
        case .split:       splitConfig
        case .margin:      marginConfig
        case .perActivity: perActivityConfig
        case .teamPool:    teamPoolConfig
        case .hybridBase:  hybridConfig
        }
    }

    private var flatConfig: some View {
        VStack(spacing: 8) {
            ForEach($tiers) { $tier in
                tierRow(tier: $tier)
            }
        }
    }

    private var tieredConfig: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Volum-trapp (NOK i måneden)")
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
            ForEach($tieredBands) { $band in
                HStack(spacing: 8) {
                    Image(systemName: "stairs")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(ModelType.tiered.accent)
                        .frame(width: 24)
                    Text(String(format: "Fra %.0fK NOK", band.fromK))
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 4) {
                        Button {
                            if band.pct > 0.5 { band.pct -= 0.5 }
                        } label: {
                            Image(systemName: "minus")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 20, height: 20)
                                .background(Brand.stroke, in: Circle())
                        }
                        .buttonStyle(.plain)
                        Text(String(format: "%.1f %%", band.pct))
                            .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(ModelType.tiered.accent)
                            .monospacedDigit()
                            .frame(width: 56)
                        Button {
                            band.pct += 0.5
                        } label: {
                            Image(systemName: "plus")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 20, height: 20)
                                .background(Brand.stroke, in: Circle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(8)
                .background(Brand.card, in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private var acceleratorConfig: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Multiplier")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.2f×", acceleratorMult))
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.accelerator.accent)
                    .monospacedDigit()
            }
            Slider(value: $acceleratorMult, in: 1.1...3.0, step: 0.05)
                .tint(ModelType.accelerator.accent)
            HStack {
                Text("Aktiveres ved")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0f %% av mål", acceleratorThreshold))
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            Slider(value: $acceleratorThreshold, in: 50...150, step: 5)
                .tint(ModelType.accelerator.accent)
        }
    }

    private var recurringConfig: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Provisjon av MRR")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.1f %%", recurringPct))
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.recurring.accent)
                    .monospacedDigit()
            }
            Slider(value: $recurringPct, in: 1...30, step: 0.5)
                .tint(ModelType.recurring.accent)
            HStack {
                Text("Varighet")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0f mnd", recurringMonths))
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            Slider(value: $recurringMonths, in: 1...36, step: 1)
                .tint(ModelType.recurring.accent)
        }
    }

    private var spiffConfig: some View {
        VStack(spacing: 8) {
            ForEach($spiffs) { $rule in
                HStack(spacing: 8) {
                    Image(systemName: "gift.fill")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(ModelType.spiff.accent)
                        .frame(width: 22)
                    Text(rule.trigger)
                        .font(.appScaled(size: 12))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(1)
                    HStack(spacing: 4) {
                        Button {
                            if rule.amountNok > 500 { rule.amountNok -= 500 }
                        } label: {
                            Image(systemName: "minus")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 20, height: 20)
                                .background(Brand.stroke, in: Circle())
                        }
                        .buttonStyle(.plain)
                        Text("\(Int(rule.amountNok)) kr")
                            .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(ModelType.spiff.accent)
                            .monospacedDigit()
                            .frame(width: 76)
                        Button {
                            rule.amountNok += 500
                        } label: {
                            Image(systemName: "plus")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 20, height: 20)
                                .background(Brand.stroke, in: Circle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(8)
                .background(Brand.card, in: RoundedRectangle(cornerRadius: 8))
            }
            Button {
                spiffs.append(SpiffRule(trigger: "Ny spiff-regel", amountNok: 1_000))
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus.circle.fill")
                        .font(.appScaled(size: 11))
                    Text("Legg til spiff-regel")
                        .font(.appScaled(size: 11, weight: .semibold))
                }
                .foregroundStyle(ModelType.spiff.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.plain)
        }
    }

    private var splitConfig: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Standard splitt")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0f / %.0f", splitDefaultPrimary, 100 - splitDefaultPrimary))
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.split.accent)
                    .monospacedDigit()
            }
            Slider(value: $splitDefaultPrimary, in: 50...95, step: 5)
                .tint(ModelType.split.accent)
            HStack(spacing: 12) {
                splitChip(label: "Primær (signed)", pct: splitDefaultPrimary, color: ModelType.split.accent)
                splitChip(label: "Sekundær (assist)", pct: 100 - splitDefaultPrimary, color: Brand.purple)
            }
        }
    }

    private func splitChip(label: String, pct: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.appScaled(size: 10))
                .foregroundStyle(Brand.textSecondary)
            Text(String(format: "%.0f %%", pct))
                .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
    }

    private var marginConfig: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Provisjon av margin")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.1f %%", marginPct))
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.margin.accent)
                    .monospacedDigit()
            }
            Slider(value: $marginPct, in: 5...60, step: 1)
                .tint(ModelType.margin.accent)
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                Text("Krever at deal-marginen er registrert i CRM")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
            }
        }
    }

    private var perActivityConfig: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Per kvalifisert aktivitet")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text("\(Int(perActivityNok)) kr")
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.perActivity.accent)
                    .monospacedDigit()
            }
            Slider(value: $perActivityNok, in: 100...2000, step: 50)
                .tint(ModelType.perActivity.accent)
            HStack(spacing: 8) {
                activityChip("Møte", color: ModelType.perActivity.accent)
                activityChip("Demo", color: Brand.purpleLight)
                activityChip("Befaring", color: Brand.green)
                activityChip("Kvalifisert lead", color: Brand.yellow)
            }
        }
    }

    private func activityChip(_ label: String, color: Color) -> some View {
        Text(label)
            .font(.appScaled(size: 10, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(color.opacity(0.15), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
    }

    private var teamPoolConfig: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Pott av team-omsetning")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.1f %%", teamPoolPct))
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.teamPool.accent)
                    .monospacedDigit()
            }
            Slider(value: $teamPoolPct, in: 1...15, step: 0.5)
                .tint(ModelType.teamPool.accent)
            HStack(spacing: 6) {
                Image(systemName: "person.3.fill")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                Text("Hele teamets sum: ca \(Int(teamPoolPct * 100 / 5 * 8))K NOK/mnd ved 8M omsetning")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
            }
        }
    }

    private var hybridConfig: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Garantilønn")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0fK / mnd", hybridBaseK))
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.hybridBase.accent)
                    .monospacedDigit()
            }
            Slider(value: $hybridBaseK, in: 20...80, step: 1)
                .tint(ModelType.hybridBase.accent)
            HStack {
                Text("Komisjon over")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0fK NOK", hybridDealThresholdK))
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            Slider(value: $hybridDealThresholdK, in: 50...500, step: 25)
                .tint(ModelType.hybridBase.accent)
        }
    }

    private var commissionExplain: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text("Provisjons-modell")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Selgere får base-sats per deal-kategori. Når selger passerer måneds-terskelen, økes alle deals samme måned til bonus-sats.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(Brand.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.purple.opacity(0.3), lineWidth: 1))
    }

    private var tierTable: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "rectangle.stack.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Satser per kategori")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button {
                    tiers.append(CommissionTier(category: "Ny kategori", basePct: 5.0,
                                                bonusPct: 8.0, color: Brand.purpleLight))
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text("Legg til")
                            .font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(Brand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            VStack(spacing: 8) {
                ForEach($tiers) { $tier in
                    tierRow(tier: $tier)
                }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func tierRow(tier: Binding<CommissionTier>) -> some View {
        HStack(spacing: 10) {
            Circle().fill(tier.wrappedValue.color).frame(width: 10, height: 10)
            Text(tier.wrappedValue.category)
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(1)
            commissionStepper(label: "Base", value: tier.basePct, color: Brand.green)
            commissionStepper(label: "Bonus", value: tier.bonusPct, color: Brand.yellow)
        }
        .padding(10)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    private func commissionStepper(label: String, value: Binding<Double>, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.appScaled(size: 9, weight: .semibold))
                .foregroundStyle(Brand.textTertiary)
            HStack(spacing: 4) {
                Button {
                    if value.wrappedValue > 0.5 {
                        value.wrappedValue -= 0.5
                    }
                } label: {
                    Image(systemName: "minus")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 20, height: 20)
                        .background(Brand.stroke, in: Circle())
                }
                .buttonStyle(.plain)
                Text(String(format: "%.1f %%", value.wrappedValue))
                    .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(color)
                    .monospacedDigit()
                    .frame(width: 50)
                Button {
                    value.wrappedValue += 0.5
                } label: {
                    Image(systemName: "plus")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 20, height: 20)
                        .background(Brand.stroke, in: Circle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var bonusThresholdCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "arrow.up.right.circle.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.yellow)
                Text("Bonus-terskel")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text(String(format: "%.0f K", monthlyTargetK))
                    .font(.appScaled(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(Brand.yellow)
                    .monospacedDigit()
            }
            Slider(value: $monthlyTargetK, in: 100...2000, step: 50)
                .tint(Brand.yellow)
            HStack {
                Text("100K")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                Spacer()
                Text("2M")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private var sellerOverrideCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "person.crop.circle.fill.badge.checkmark")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Override per selger")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("3 aktive")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
            }
            Text("Spesielle satser for utvalgte selgere (f.eks. trainees, partner-selgere).")
                .font(.appScaled(size: 11))
                .foregroundStyle(Brand.textTertiary)
            VStack(spacing: 6) {
                overrideRow(name: "Anniken Sørli",  rule: "+2 % bonus på B2B SaaS")
                overrideRow(name: "Karoline Nesse", rule: "Trainee: 50 % sats første 90 dager")
                overrideRow(name: "Espen Lien",     rule: "Promotør: kun base, ingen bonus")
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func overrideRow(name: String, rule: String) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(Brand.purple.opacity(0.25))
                Image(systemName: "person.fill")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 1) {
                Text(name)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Text(rule)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
                    .lineLimit(1)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(Brand.textTertiary)
        }
        .padding(10)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: Konkurranser

    private var contestTab: some View {
        VStack(spacing: 16) {
            contestSummary
            contestTemplateLibrary
            activeContestsSection
        }
    }

    private var contestTemplateLibrary: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "books.vertical.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Konkurranse-maler")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Org-en din kjører \(contestTemplatesForPreset.count) av \(ContestTemplateType.allCases.count) typer")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textTertiary)
                }
                Spacer()
            }
            // 2-kolonne grid m/ aktive maler først, så gråede inaktive
            let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
            LazyVGrid(columns: cols, spacing: 10) {
                ForEach(ContestTemplateType.allCases) { t in
                    contestTemplateCard(t, active: contestTemplatesForPreset.contains(t))
                }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func contestTemplateCard(_ t: ContestTemplateType, active: Bool) -> some View {
        Button {
            contestPrefilledTemplate = t
            newContestOpen = true
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(t.accent.opacity(active ? 0.25 : 0.10))
                        Image(systemName: t.icon)
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(active ? t.accent : Brand.textTertiary)
                    }
                    .frame(width: 30, height: 30)
                    Spacer()
                    if active {
                        Text("AKTIV")
                            .font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(t.accent)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(t.accent.opacity(0.18), in: Capsule())
                    }
                }
                Text(t.title)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(active ? .white : Brand.textSecondary)
                    .lineLimit(1)
                Text(t.subtitle)
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 6) {
                    Image(systemName: "clock")
                        .font(.appScaled(size: 9))
                    Text("\(t.defaultDays) dager")
                        .font(.appScaled(size: 10, weight: .semibold))
                    Spacer()
                    Image(systemName: "plus.circle.fill")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(t.accent)
                }
                .foregroundStyle(Brand.textSecondary)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(active ? t.accent.opacity(0.4) : Brand.stroke,
                            lineWidth: active ? 1.5 : 1)
            )
            .opacity(active ? 1.0 : 0.55)
        }
        .buttonStyle(.plain)
    }

    private var activeContestsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "flag.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Aktive nå (\(contests.count))")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            VStack(spacing: 12) {
                ForEach(contests) { c in
                    contestCard(c)
                }
            }
        }
    }

    private var contestSummary: some View {
        HStack(spacing: 10) {
            summaryPill(value: "\(contests.count)",        label: "Aktive", color: Brand.purpleLight, icon: "flag.fill")
            summaryPill(value: "\(contests.reduce(0) { $0 + $1.participants })", label: "Deltakere", color: Brand.green, icon: "person.2.fill")
            summaryPill(value: "kr 87K",                   label: "Premie-pott", color: Brand.yellow, icon: "gift.fill")
        }
    }

    private func summaryPill(value: String, label: String, color: Color, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon)
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(color)
            Text(value)
                .font(.appScaled(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(.appScaled(size: 10))
                .foregroundStyle(Brand.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))
    }

    private func contestCard(_ c: Contest) -> some View {
        let ended = c.endsInDays <= 0
        let urgencyColor: Color = ended ? Brand.green : (c.endsInDays <= 7 ? Brand.orange : Brand.purpleLight)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(LinearGradient(
                            colors: [Brand.yellow.opacity(0.3), Brand.orange.opacity(0.2)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                    Image(systemName: "trophy.fill")
                        .font(.appScaled(size: 16, weight: .semibold))
                        .foregroundStyle(Brand.yellow)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(c.name)
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text(c.kpi)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                }
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: ended ? "checkmark.circle.fill" : "clock.fill")
                        .font(.appScaled(size: 10, weight: .semibold))
                    Text(ended ? "Ferdig" : "\(c.endsInDays)d")
                        .font(.appScaled(size: 11, weight: .bold))
                        .monospacedDigit()
                }
                .foregroundStyle(urgencyColor)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(urgencyColor.opacity(0.15), in: Capsule())
                .overlay(Capsule().stroke(urgencyColor.opacity(0.5), lineWidth: 1))
            }
            HStack(spacing: 6) {
                Image(systemName: "gift.fill")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.yellow)
                Text(c.prize)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            Divider().overlay(Brand.stroke)
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("LEDER")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(Brand.textTertiary)
                    Text(c.leaderName)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.yellow)
                    Text(c.leaderValue)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("DELTAKERE")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(Brand.textTertiary)
                    Text("\(c.participants)")
                        .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
                if ended {
                    Button { fulfillContest = c } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "gift.fill")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text("Tildel premier")
                                .font(.appScaled(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(
                            LinearGradient(
                                colors: [Brand.green, Brand.purpleLight],
                                startPoint: .leading, endPoint: .trailing
                            ),
                            in: Capsule()
                        )
                    }
                    .buttonStyle(.plain)
                    .padding(.leading, 8)
                } else {
                    Button { rankingOpen = true } label: {
                        Text("Se rangering")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(Brand.purple, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .padding(.leading, 8)
                }
            }
        }
        .padding(14)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ended ? Brand.green.opacity(0.4) : Brand.stroke, lineWidth: ended ? 1.5 : 1))
    }

    // MARK: Mål

    private var goalTab: some View {
        VStack(spacing: 16) {
            teamGoalCard
            individualGoalsCard
        }
    }

    // MARK: Katalog
    //
    // Org-administrert premie-katalog. Salgssjefen ser STANDARD (delt av
    // alle Leadgrid-orgs) og ORG-spesifikke produkter (kun denne org).
    // «Nytt produkt»-knapp i toolbar lager nytt, kan slettes på egne.

    private var catalogTab: some View {
        VStack(spacing: 16) {
            catalogExplain
            catalogSection(title: "Egne produkter (\(orgCatalog.count))",
                           subtitle: "Org-spesifikke — kan administreres",
                           products: orgCatalog,
                           deletable: true)
            catalogSection(title: "Standard-katalog (\(PrizeCatalog.all.count))",
                           subtitle: "Delt med alle Leadgrid-orgs — kan ikke endres",
                           products: PrizeCatalog.all,
                           deletable: false)
        }
    }

    private var catalogExplain: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text("Egne produkter for org-en din")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Standard-katalogen dekker det meste, men du kan legge til produkter org-en har egne avtaler på (f.eks. drone-leverandør, hytteutleier, SATS-medlemskap).")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(Brand.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.purple.opacity(0.3), lineWidth: 1))
    }

    private func catalogSection(title: String, subtitle: String,
                                products: [PrizeProduct], deletable: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: deletable ? "person.crop.rectangle.stack.fill" : "books.vertical.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(deletable ? Brand.green : Brand.purpleLight)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textTertiary)
                }
                Spacer()
            }
            if products.isEmpty {
                Text("Ingen egne produkter enda. Tap «Nytt produkt» øverst.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(Brand.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 12)
            } else {
                let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
                LazyVGrid(columns: cols, spacing: 10) {
                    ForEach(products) { p in
                        catalogProductCard(p, deletable: deletable)
                    }
                }
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func catalogProductCard(_ p: PrizeProduct, deletable: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                PrizeImageView(product: p, cornerRadius: 12, iconSize: 36)
                    .frame(height: 100)
                if deletable {
                    Button {
                        orgCatalog.removeAll { $0.id == p.id }
                    } label: {
                        Image(systemName: "trash.fill")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 28, height: 28)
                            .background(Color.red.opacity(0.8), in: Circle())
                            .overlay(Circle().stroke(Color.white.opacity(0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .padding(6)
                } else {
                    Text("STANDARD")
                        .font(.appScaled(size: 8, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Color.black.opacity(0.55), in: Capsule())
                        .overlay(Capsule().stroke(Color.white.opacity(0.3), lineWidth: 0.5))
                        .padding(6)
                }
            }
            Text(p.name)
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 4) {
                Text(p.category.rawValue)
                    .font(.appScaled(size: 9, weight: .semibold))
                    .foregroundStyle(p.category.color)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(p.category.color.opacity(0.15), in: Capsule())
                Spacer(minLength: 0)
            }
            HStack {
                Text(PrizeCatalog.formattedPrice(p.priceNok))
                    .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Spacer()
                if let v = p.vendor {
                    Text(v)
                        .font(.appScaled(size: 9))
                        .foregroundStyle(Brand.textTertiary)
                        .lineLimit(1)
                }
            }
        }
        .padding(10)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(deletable ? Brand.green.opacity(0.3) : Brand.stroke, lineWidth: 1)
        )
    }

    private var teamGoalCard: some View {
        let progress = min(1.0, teamMonthlyAchievedK / teamMonthlyGoalK)
        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "person.3.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Team-mål denne måneden")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text(String(format: "%.0f %%", progress * 100))
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(progress >= 1.0 ? Brand.green : Brand.yellow)
                    .monospacedDigit()
            }
            VStack(alignment: .leading, spacing: 8) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Brand.stroke)
                        RoundedRectangle(cornerRadius: 8)
                            .fill(LinearGradient(
                                colors: [Brand.purple, Brand.purpleLight, Brand.green],
                                startPoint: .leading, endPoint: .trailing
                            ))
                            .frame(width: geo.size.width * CGFloat(progress))
                    }
                }
                .frame(height: 14)
                HStack {
                    Text(String(format: "%.1fM oppnådd", teamMonthlyAchievedK / 1000))
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Text(String(format: "Mål: %.1fM NOK", teamMonthlyGoalK / 1000))
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
            }
            HStack {
                Text("Juster mål")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.1f M NOK", teamMonthlyGoalK / 1000))
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(Brand.purpleLight)
                    .monospacedDigit()
            }
            Slider(value: $teamMonthlyGoalK, in: 5000...30000, step: 250)
                .tint(Brand.purple)
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private var individualGoalsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "person.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Individuelle mål")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(sellers.count) selgere")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
            }
            VStack(spacing: 8) {
                ForEach(sellers.prefix(6)) { s in
                    individualGoalRow(s)
                }
            }
            Button { rankingOpen = true } label: {
                HStack {
                    Spacer()
                    Text("Se alle \(sellers.count) selgere")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                    Image(systemName: "chevron.right")
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(Brand.purpleLight)
                    Spacer()
                }
                .padding(.vertical, 8)
                .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func individualGoalRow(_ s: TopSellersSheet.Seller) -> some View {
        // Demo: mock-mål = 150 % av total. EKTE: ingen mål-kilde finnes enda →
        // vis fremdrift uten fabrikert mål (progress skjules via goal = 0).
        let isDemo = DemoModeManager.isActiveNonisolated
        let goal = isDemo ? s.totalValue * 1.5 : 0
        let progress = goal > 0 ? min(1.0, s.totalValue / goal) : 0
        return HStack(spacing: 12) {
            ZStack {
                Circle().fill(s.avatarColor.opacity(0.3))
                Text(s.name.split(separator: " ").prefix(2).map { String($0.prefix(1)) }.joined().uppercased())
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(s.avatarColor)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(s.name)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer()
                    if goal > 0 {
                        Text(String(format: "%.0f %%", progress * 100))
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(progress >= 1.0 ? Brand.green : Brand.yellow)
                            .monospacedDigit()
                    } else {
                        // Ekte modus uten mål-kilde: vis faktisk verdi, ikke falsk prosent.
                        Text("\(Int(s.totalValue / 1_000))k kr")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(Brand.green)
                            .monospacedDigit()
                    }
                }
                if goal > 0 {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Brand.stroke)
                            RoundedRectangle(cornerRadius: 3)
                                .fill(s.avatarColor)
                                .frame(width: geo.size.width * CGFloat(progress))
                        }
                    }
                    .frame(height: 5)
                }
            }
        }
        .padding(10)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - PrizeCatalog
//
// Salgssjefen kan henge konkrete produkter (iPad, AirPods, helgetur, vin)
// på 1./2./3.plass i en konkurranse. Katalogen er org-administrert i
// prod, men her mocket m/ ~24 vanlige norske salgs-incentiv-premier.

enum PrizeCategory: String, CaseIterable, Identifiable, Hashable {
    case tech = "Tech"
    case travel = "Reise"
    case food = "Mat & drikke"
    case voucher = "Gavekort"
    case experience = "Opplevelse"
    case cash = "Cash-bonus"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .tech: return "ipad.gen2"
        case .travel: return "airplane"
        case .food: return "fork.knife"
        case .voucher: return "creditcard.fill"
        case .experience: return "ticket.fill"
        case .cash: return "norwegiankronesign.circle.fill"
        }
    }
    var color: Color {
        switch self {
        case .tech: return Color(red: 0.34, green: 0.60, blue: 0.98)
        case .travel: return Color(red: 0.20, green: 0.85, blue: 0.60)
        case .food: return Color(red: 0.98, green: 0.55, blue: 0.10)
        case .voucher: return Color(red: 0.66, green: 0.32, blue: 0.99)
        case .experience: return Color(red: 0.98, green: 0.75, blue: 0.14)
        case .cash: return Color(red: 0.20, green: 0.85, blue: 0.60)
        }
    }
}

/// Hvordan premien faktisk leveres til vinneren. Hver kategori har en
/// fornuftig default — kan overstyres per produkt i CustomPrizeSheet.
enum FulfillmentMethod: String, CaseIterable, Identifiable, Hashable {
    case digitalVoucher     // Apple/Sport1 gavekort på e-post (auto)
    case cashOnPayroll      // Bonus på neste lønnsslipp (HR-task)
    case physicalShipping   // Bestilles + sendes hjem (krever adresse)
    case experienceTicket   // Voucher/billett sendt, vinner booker selv
    case travelBooking      // Bookes via leverandør på vegne av vinner
    case internalGrant      // Org-intern (ekstra fri-dag, mentor-time)
    var id: String { rawValue }
    var title: String {
        switch self {
        case .digitalVoucher:   return "Digital — auto-send"
        case .cashOnPayroll:    return "Cash på lønnsslipp"
        case .physicalShipping: return "Fysisk leveranse"
        case .experienceTicket: return "Voucher / billett"
        case .travelBooking:    return "Reise — booking"
        case .internalGrant:    return "Org-intern"
        }
    }
    var subtitle: String {
        switch self {
        case .digitalVoucher:   return "Sendes som e-post-kode i samme sekund"
        case .cashOnPayroll:    return "HR varsles, legges på neste lønn"
        case .physicalShipping: return "Bestilles + sendes til oppgitt adresse"
        case .experienceTicket: return "Voucher e-postes; vinner booker selv"
        case .travelBooking:    return "Reisebyrå kontaktes m/ vinner-info"
        case .internalGrant:    return "Org-intern handling (fri-dag, mentor)"
        }
    }
    var icon: String {
        switch self {
        case .digitalVoucher:   return "envelope.fill"
        case .cashOnPayroll:    return "banknote.fill"
        case .physicalShipping: return "shippingbox.fill"
        case .experienceTicket: return "ticket.fill"
        case .travelBooking:    return "airplane.circle.fill"
        case .internalGrant:    return "building.2.crop.circle.fill"
        }
    }
}

extension FulfillmentMethod {
    /// Default fulfillment-metode pr. premie-kategori.
    static func defaultFor(_ category: PrizeCategory) -> FulfillmentMethod {
        switch category {
        case .tech: return .physicalShipping
        case .travel: return .travelBooking
        case .food: return .experienceTicket
        case .voucher: return .digitalVoucher
        case .experience: return .experienceTicket
        case .cash: return .cashOnPayroll
        }
    }
}

struct PrizeProduct: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let icon: String       // SF Symbol (fallback hvis bilde feiler)
    let priceNok: Int      // veiledende
    let category: PrizeCategory
    let vendor: String?    // leverandør (Komplett/Power/Apple)
    /// URL til produktbilde. Når satt, vises AsyncImage; ellers SF Symbol.
    /// Stock-bilder for katalog-produkter; salgssjefen kan også sette egen
    /// URL eller laste opp via PhotosPicker.
    var imageURL: String?
    /// Egne opplastede bilder (lagres som Data og base64-encodes i prod).
    /// I preview-app er denne nil siden vi ikke serialiserer Data.
    var imageData: Data?
    /// Hvordan premien faktisk leveres når noen vinner. Default fra kategori
    /// hvis ikke satt eksplisitt.
    var fulfillment: FulfillmentMethod? = nil
    var effectiveFulfillment: FulfillmentMethod {
        fulfillment ?? FulfillmentMethod.defaultFor(category)
    }
}

enum PrizeCatalog {
    // STANDARD-katalogen bruker SF Symbol-ikoner som visuell identifikator,
    // IKKE stock-bilder. Stock fra picsum/Unsplash matcher ikke produktet
    // (Sonos-kort fikk solnedgang, MacBook fikk fjell-bilde). Når Leadgrid
    // kuraterer ekte produktbilder i B2-CDN kan vi sette imageURL her;
    // inntil da er ikon klarest og mest profesjonelt.
    //
    // Egne produkter (orgCatalog) og opplastede via PhotosPicker bruker
    // faktisk bilde — de er bevisst valgt og matcher produktet.

    static let all: [PrizeProduct] = [
        // TECH
        PrizeProduct(name: "iPad Pro 11\"",        icon: "ipad",                 priceNok: 12_990, category: .tech, vendor: "Apple"),
        PrizeProduct(name: "iPad Air",             icon: "ipad",                 priceNok: 7_990,  category: .tech, vendor: "Apple"),
        PrizeProduct(name: "MacBook Air 13\"",     icon: "laptopcomputer",       priceNok: 14_990, category: .tech, vendor: "Apple"),
        PrizeProduct(name: "iPhone 17 Pro",        icon: "iphone",               priceNok: 15_990, category: .tech, vendor: "Apple"),
        PrizeProduct(name: "Apple Watch Ultra",    icon: "applewatch",           priceNok: 9_990,  category: .tech, vendor: "Apple"),
        PrizeProduct(name: "AirPods Max",          icon: "airpods.max",          priceNok: 6_290,  category: .tech, vendor: "Apple"),
        PrizeProduct(name: "AirPods Pro",          icon: "airpodspro",           priceNok: 3_290,  category: .tech, vendor: "Apple"),
        PrizeProduct(name: "Sony WH-1000XM5",      icon: "headphones",           priceNok: 4_490,  category: .tech, vendor: "Power"),
        PrizeProduct(name: "Sonos Era 100",        icon: "hifispeaker.fill",     priceNok: 3_490,  category: .tech, vendor: "Komplett"),
        PrizeProduct(name: "Dyson V15 støvsuger",  icon: "wind",                 priceNok: 8_990,  category: .tech, vendor: "Elkjøp"),

        // TRAVEL
        PrizeProduct(name: "Helgetur Bergen (2 pers)",      icon: "house.lodge.fill",   priceNok: 8_500,  category: .travel, vendor: "Hurtigruten"),
        PrizeProduct(name: "Weekend København (2 pers)",    icon: "airplane.departure", priceNok: 12_000, category: .travel, vendor: "SAS"),
        PrizeProduct(name: "Skitur Trysil (2 pers)",        icon: "snowflake",          priceNok: 9_500,  category: .travel, vendor: "SkiStar"),
        PrizeProduct(name: "Spa-helg Stavern",              icon: "drop.fill",          priceNok: 6_500,  category: .travel, vendor: "Stavern Hotell"),

        // FOOD
        PrizeProduct(name: "Maaemo middag (2 pers)",        icon: "fork.knife.circle",  priceNok: 7_800,  category: .food, vendor: "Maaemo"),
        PrizeProduct(name: "Vin-pakke premium",             icon: "wineglass.fill",     priceNok: 2_500,  category: .food, vendor: "Vinmonopolet"),
        PrizeProduct(name: "Whiskey-pakke (3 stk)",         icon: "wineglass",          priceNok: 3_200,  category: .food, vendor: "Vinmonopolet"),

        // VOUCHER
        PrizeProduct(name: "Apple gavekort 10 000 kr",      icon: "applelogo",          priceNok: 10_000, category: .voucher, vendor: "Apple"),
        PrizeProduct(name: "Sport 1 gavekort 5 000 kr",     icon: "figure.run",         priceNok: 5_000,  category: .voucher, vendor: "Sport 1"),
        PrizeProduct(name: "Elkjøp gavekort 5 000 kr",      icon: "bag.fill",           priceNok: 5_000,  category: .voucher, vendor: "Elkjøp"),
        PrizeProduct(name: "Restaurant-gavekort 3 000 kr",  icon: "fork.knife",         priceNok: 3_000,  category: .voucher, vendor: "GoMore"),

        // EXPERIENCE
        PrizeProduct(name: "Kinobilletter for 2",           icon: "film.fill",           priceNok: 350,    category: .experience, vendor: "Filmweb"),
        PrizeProduct(name: "Premiere-pakke kino",           icon: "film",                priceNok: 850,    category: .experience, vendor: "ODEON"),
        PrizeProduct(name: "Konsertbillett premium",        icon: "music.mic",           priceNok: 2_500,  category: .experience, vendor: "Ticketmaster"),
        PrizeProduct(name: "Fotball: VIP-billett",          icon: "soccerball",          priceNok: 4_500,  category: .experience, vendor: "Vålerenga"),
        PrizeProduct(name: "Skytrening m/ proff",           icon: "scope",               priceNok: 3_500,  category: .experience, vendor: "OSI"),
        PrizeProduct(name: "Ekstra fri-dag",                icon: "calendar.badge.plus", priceNok: 0,      category: .experience, vendor: nil),

        // CASH
        PrizeProduct(name: "Cash-bonus 5 000 kr",   icon: "norwegiankronesign", priceNok: 5_000,  category: .cash, vendor: nil),
        PrizeProduct(name: "Cash-bonus 10 000 kr",  icon: "norwegiankronesign", priceNok: 10_000, category: .cash, vendor: nil),
        PrizeProduct(name: "Cash-bonus 25 000 kr",  icon: "norwegiankronesign", priceNok: 25_000, category: .cash, vendor: nil),
    ]

    static func formattedPrice(_ nok: Int) -> String {
        if nok == 0 { return "Tidsverdi" }
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        return (f.string(from: NSNumber(value: nok)) ?? "\(nok)") + " kr"
    }
}

/// Gjenbrukbar bilde-view for premier: viser ekte bilde hvis URL/Data,
/// ellers SF Symbol som fallback. Cornerradius + gradient-bakgrunn matcher
/// produkt-kortet.
struct PrizeImageView: View {
    let product: PrizeProduct
    var cornerRadius: CGFloat = 12
    var iconSize: CGFloat = 40

    var body: some View {
        // KEY: GeometryReader låser bildet til parent-bound, og ytre
        // clipShape forhindrer at scaledToFill flyter ut av kortet.
        // Tidligere bug (2026-06-28): bildet rendret i natural size og
        // overlappet nabokort i Premie-katalog-grid.
        GeometryReader { geo in
            ZStack {
                Rectangle()
                    .fill(LinearGradient(
                        colors: [product.category.color.opacity(0.30),
                                 product.category.color.opacity(0.10)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))

                if let data = product.imageData, let ui = UIImage(data: data) {
                    Image(uiImage: ui)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height)
                } else if let urlStr = product.imageURL, let url = URL(string: urlStr) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .tint(product.category.color)
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(width: geo.size.width, height: geo.size.height)
                        case .failure:
                            Image(systemName: product.icon)
                                .font(.appScaled(size: iconSize, weight: .semibold))
                                .foregroundStyle(product.category.color)
                        @unknown default:
                            Image(systemName: product.icon)
                                .font(.appScaled(size: iconSize, weight: .semibold))
                                .foregroundStyle(product.category.color)
                        }
                    }
                } else {
                    Image(systemName: product.icon)
                        .font(.appScaled(size: iconSize, weight: .semibold))
                        .foregroundStyle(product.category.color)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        }
    }
}

/// Én premie-plass i en konkurranse — rank 1/2/3 (eller flere).
struct PrizeTier: Identifiable, Hashable {
    let id = UUID()
    var rank: Int            // 1 = 1.plass
    var product: PrizeProduct
    var rankLabel: String {
        switch rank {
        case 1: return "1.plass"
        case 2: return "2.plass"
        case 3: return "3.plass"
        default: return "\(rank).plass"
        }
    }
    var rankColor: Color {
        switch rank {
        case 1: return Color(red: 0.98, green: 0.75, blue: 0.14)    // gull
        case 2: return Color(red: 0.78, green: 0.78, blue: 0.85)    // sølv
        case 3: return Color(red: 0.80, green: 0.50, blue: 0.30)    // bronse
        default: return Color.white.opacity(0.55)
        }
    }
}

// MARK: - NewContestSheet
//
// Skjema for å lansere ny konkurranse — kalles fra Salgsledelse → Konkurranser
// → "Ny konkurranse". Navn + premier (1./2./3.plass fra katalog) + KPI + varighet.

struct NewContestSheet: View {
    var template: SalesLeadershipSheet.ContestTemplateType? = nil
    /// Org-spesifikke produkter (utover PrizeCatalog.all). Tom = bare standard.
    var extraCatalog: [PrizeProduct] = []
    let onSave: (SalesLeadershipSheet.Contest) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var kpi: String = "Mest vunnet NOK"
    @State private var days: Double = 14
    @State private var prizes: [PrizeTier] = []
    @State private var pickerOpen: Bool = false
    @State private var pickerForRank: Int = 1

    private enum Brand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
        static let textSecondary = Color.white.opacity(0.62)
    }

    private let kpiOptions = ["Mest vunnet NOK", "Flest nye møter",
                              "Høyest snitt-deal", "Flest demoer booket",
                              "Beste konv.rate"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if let t = template {
                        templateBanner(t)
                    }
                    formField(label: "Navn på konkurranse",
                              placeholder: "F.eks. Sommer-sprint 2026",
                              text: $name)
                    prizeSection
                    VStack(alignment: .leading, spacing: 8) {
                        Text("KPI å konkurrere på")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(Brand.textSecondary)
                        VStack(spacing: 6) {
                            ForEach(kpiOptions, id: \.self) { opt in
                                Button { kpi = opt } label: {
                                    HStack {
                                        Image(systemName: kpi == opt ? "largecircle.fill.circle" : "circle")
                                            .font(.appScaled(size: 14))
                                            .foregroundStyle(kpi == opt ? Brand.purpleLight : Brand.stroke)
                                        Text(opt)
                                            .font(.appScaled(size: 13))
                                            .foregroundStyle(.white)
                                        Spacer()
                                    }
                                    .padding(.horizontal, 12).padding(.vertical, 10)
                                    .background(
                                        kpi == opt ? Brand.purple.opacity(0.15) : Brand.cardHi,
                                        in: RoundedRectangle(cornerRadius: 10)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Varighet")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(Brand.textSecondary)
                            Spacer()
                            Text("\(Int(days)) dager")
                                .font(.appScaled(size: 13, weight: .bold))
                                .foregroundStyle(Brand.yellow)
                                .monospacedDigit()
                        }
                        Slider(value: $days, in: 3...60, step: 1)
                            .tint(Brand.yellow)
                    }
                    .padding(14)
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))

                    Button {
                        let contest = SalesLeadershipSheet.Contest(
                            name: name.isEmpty ? "Ny konkurranse" : name,
                            prize: prizeSummary,
                            kpi: kpi,
                            endsInDays: Int(days),
                            leaderName: "—",
                            leaderValue: "—",
                            participants: 0
                        )
                        onSave(contest)
                    } label: {
                        Text("Lanser konkurranse")
                            .font(.appScaled(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(
                                LinearGradient(
                                    colors: [Brand.purple, Brand.purpleLight],
                                    startPoint: .leading, endPoint: .trailing
                                ),
                                in: RoundedRectangle(cornerRadius: 14)
                            )
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 8)
                }
                .padding(20)
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Ny konkurranse")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(Brand.purpleLight)
                }
            }
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .onAppear {
                if let t = template {
                    if name.isEmpty { name = t.title + " — \(formattedMonth())" }
                    kpi = t.defaultKpi
                    days = Double(t.defaultDays)
                    if prizes.isEmpty {
                        // Foreslå 3 premier som matcher mal-budsjettet
                        prizes = suggestedPrizes(for: t)
                    }
                }
            }
            .sheet(isPresented: $pickerOpen) {
                PrizePickerSheet(forRank: pickerForRank, extras: extraCatalog) { product in
                    setPrize(product: product, atRank: pickerForRank)
                    pickerOpen = false
                }
            }
        }
    }

    // MARK: Premie-seksjon

    private var prizeSummary: String {
        if prizes.isEmpty { return "Premie TBD" }
        return prizes.sorted { $0.rank < $1.rank }
            .map { "\($0.rank). \($0.product.name)" }
            .joined(separator: " · ")
    }

    private var prizeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "gift.fill")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.yellow)
                Text("Premier")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(prizes.count) av 3 plasser")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
            }
            VStack(spacing: 8) {
                ForEach(1...3, id: \.self) { rank in
                    prizeSlot(rank: rank)
                }
            }
        }
        .padding(14)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
    }

    private func prizeSlot(rank: Int) -> some View {
        let existing = prizes.first { $0.rank == rank }
        return Button {
            pickerForRank = rank
            pickerOpen = true
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(rankColor(rank).opacity(0.25))
                    Text("\(rank)")
                        .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(rankColor(rank))
                }
                .frame(width: 32, height: 32)
                if let tier = existing {
                    PrizeImageView(product: tier.product, cornerRadius: 8, iconSize: 16)
                        .frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tier.product.name)
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        HStack(spacing: 6) {
                            Text(tier.product.category.rawValue)
                                .font(.appScaled(size: 10, weight: .semibold))
                                .foregroundStyle(tier.product.category.color)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(tier.product.category.color.opacity(0.15), in: Capsule())
                            Text(PrizeCatalog.formattedPrice(tier.product.priceNok))
                                .font(.appScaled(size: 10))
                                .foregroundStyle(Brand.textSecondary)
                                .monospacedDigit()
                        }
                    }
                    Spacer()
                    Button {
                        prizes.removeAll { $0.rank == rank }
                    } label: {
                        Image(systemName: "trash")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(Color.red.opacity(0.8))
                            .frame(width: 28, height: 28)
                            .background(Color.red.opacity(0.12), in: Circle())
                    }
                    .buttonStyle(.plain)
                } else {
                    Text("\(rank).plass — velg premie")
                        .font(.appScaled(size: 13))
                        .foregroundStyle(Brand.textSecondary)
                    Spacer()
                    Image(systemName: "plus.circle.fill")
                        .font(.appScaled(size: 16))
                        .foregroundStyle(Brand.purpleLight)
                }
            }
            .padding(10)
            .background(
                existing != nil ? Brand.cardHi : Color.white.opacity(0.03),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(existing != nil ? rankColor(rank).opacity(0.3) : Brand.stroke,
                            lineWidth: existing != nil ? 1.2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return Color(red: 0.98, green: 0.75, blue: 0.14)
        case 2: return Color(red: 0.78, green: 0.78, blue: 0.85)
        case 3: return Color(red: 0.80, green: 0.50, blue: 0.30)
        default: return Color.white.opacity(0.55)
        }
    }

    private func setPrize(product: PrizeProduct, atRank rank: Int) {
        prizes.removeAll { $0.rank == rank }
        prizes.append(PrizeTier(rank: rank, product: product))
        prizes.sort { $0.rank < $1.rank }
    }

    /// Anbefal 1./2./3.plass-premier ut fra mal-defaults.
    private func suggestedPrizes(for t: SalesLeadershipSheet.ContestTemplateType) -> [PrizeTier] {
        // Match mal med standard "tier" av premier — kort sprint = mindre, lang måneds-comp = stor
        switch t {
        case .monthlyLeader:
            return [
                PrizeTier(rank: 1, product: PrizeCatalog.all.first { $0.name == "iPad Pro 11\"" } ?? PrizeCatalog.all[0]),
                PrizeTier(rank: 2, product: PrizeCatalog.all.first { $0.name == "AirPods Pro" } ?? PrizeCatalog.all[0]),
                PrizeTier(rank: 3, product: PrizeCatalog.all.first { $0.name == "Restaurant-gavekort 3 000 kr" } ?? PrizeCatalog.all[0]),
            ]
        case .sprint:
            return [
                PrizeTier(rank: 1, product: PrizeCatalog.all.first { $0.name == "AirPods Pro" } ?? PrizeCatalog.all[0]),
                PrizeTier(rank: 2, product: PrizeCatalog.all.first { $0.name == "Vin-pakke premium" } ?? PrizeCatalog.all[0]),
            ]
        case .geographic:
            return [
                PrizeTier(rank: 1, product: PrizeCatalog.all.first { $0.name == "Helgetur Bergen (2 pers)" } ?? PrizeCatalog.all[0]),
            ]
        case .industry, .quality:
            return [
                PrizeTier(rank: 1, product: PrizeCatalog.all.first { $0.name == "Apple Watch Ultra" } ?? PrizeCatalog.all[0]),
            ]
        case .teamVsTeam:
            return [
                PrizeTier(rank: 1, product: PrizeCatalog.all.first { $0.name == "Maaemo middag (2 pers)" } ?? PrizeCatalog.all[0]),
            ]
        case .volume:
            return [
                PrizeTier(rank: 1, product: PrizeCatalog.all.first { $0.name == "iPad Air" } ?? PrizeCatalog.all[0]),
            ]
        case .individual:
            return [
                PrizeTier(rank: 1, product: PrizeCatalog.all.first { $0.name == "Cash-bonus 10 000 kr" } ?? PrizeCatalog.all[0]),
            ]
        case .comeback:
            return [
                PrizeTier(rank: 1, product: PrizeCatalog.all.first { $0.name == "Cash-bonus 5 000 kr" } ?? PrizeCatalog.all[0]),
            ]
        case .onboarding:
            return [
                PrizeTier(rank: 1, product: PrizeCatalog.all.first { $0.name == "AirPods Pro" } ?? PrizeCatalog.all[0]),
            ]
        }
    }

    private func formattedMonth() -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        df.dateFormat = "LLLL"
        return df.string(from: Date()).capitalized
    }

    private func templateBanner(_ t: SalesLeadershipSheet.ContestTemplateType) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(t.accent.opacity(0.25))
                Image(systemName: t.icon)
                    .font(.appScaled(size: 16, weight: .semibold))
                    .foregroundStyle(t.accent)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text("Mal: \(t.title)")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text(t.subtitle)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
        }
        .padding(14)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(t.accent.opacity(0.4), lineWidth: 1.5)
        )
    }

    private func formField(label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
            TextField("", text: text, prompt: Text(placeholder).foregroundColor(.white.opacity(0.3)))
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 12)
                .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Brand.stroke, lineWidth: 1))
        }
    }
}

// MARK: - PrizePickerSheet
//
// Modal som åpnes når salgssjefen skal velge premie til en plass i
// konkurransen. Viser hele katalogen som grid, filterbar på kategori.
// Tap = velg + lukk.

struct PrizePickerSheet: View {
    let forRank: Int
    /// Ekstra org-spesifikke produkter som vises sammen med standard-katalogen.
    var extras: [PrizeProduct] = []
    let onPick: (PrizeProduct) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var filter: PrizeCategory? = nil
    @State private var search: String = ""
    @State private var customSheetOpen: Bool = false

    private enum Brand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
        static let textSecondary = Color.white.opacity(0.62)
        static let textTertiary = Color.white.opacity(0.45)
    }

    private var filtered: [PrizeProduct] {
        // Egne produkter først så de er lett synlige for salgssjefen.
        (extras + PrizeCatalog.all).filter { p in
            (filter == nil || p.category == filter) &&
            (search.isEmpty || p.name.localizedCaseInsensitiveContains(search))
        }
    }

    private var rankLabel: String {
        switch forRank {
        case 1: return "1.plass"
        case 2: return "2.plass"
        case 3: return "3.plass"
        default: return "\(forRank).plass"
        }
    }

    private var rankColor: Color {
        switch forRank {
        case 1: return Color(red: 0.98, green: 0.75, blue: 0.14)
        case 2: return Color(red: 0.78, green: 0.78, blue: 0.85)
        case 3: return Color(red: 0.80, green: 0.50, blue: 0.30)
        default: return Color.white.opacity(0.55)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                rankBanner
                filterBar
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10),
                                        GridItem(.flexible(), spacing: 10)],
                              spacing: 10) {
                        ForEach(filtered) { p in
                            productCard(p)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Velg premie")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: "Søk i katalog")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(Brand.purpleLight)
                }
            }
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { customSheetOpen = true } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus.circle.fill")
                                .font(.appScaled(size: 11, weight: .bold))
                            Text("Egen")
                                .font(.appScaled(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(
                            LinearGradient(
                                colors: [Brand.purple, Brand.purpleLight],
                                startPoint: .leading, endPoint: .trailing
                            ),
                            in: Capsule()
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .sheet(isPresented: $customSheetOpen) {
                CustomPrizeSheet { product in
                    customSheetOpen = false
                    onPick(product)
                }
            }
        }
    }

    private var rankBanner: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(rankColor.opacity(0.25))
                Text("\(forRank)")
                    .font(.appScaled(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(rankColor)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text("Premie til \(rankLabel)")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Velg fra katalog — \(PrizeCatalog.all.count) produkter")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(Brand.card)
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip(label: "Alle", icon: "square.grid.2x2", active: filter == nil, color: Brand.purple) {
                    filter = nil
                }
                ForEach(PrizeCategory.allCases) { c in
                    filterChip(label: c.rawValue, icon: c.icon, active: filter == c, color: c.color) {
                        filter = (filter == c) ? nil : c
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(Brand.cardHi.opacity(0.5))
    }

    private func filterChip(label: String, icon: String, active: Bool, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.appScaled(size: 10, weight: .semibold))
                Text(label)
                    .font(.appScaled(size: 11, weight: .semibold))
            }
            .foregroundStyle(active ? .white : Brand.textSecondary)
            .padding(.horizontal, 11).padding(.vertical, 6)
            .background(active ? color : Brand.cardHi, in: Capsule())
            .overlay(Capsule().stroke(active ? Color.clear : Brand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func productCard(_ p: PrizeProduct) -> some View {
        Button { onPick(p) } label: {
            VStack(alignment: .leading, spacing: 8) {
                PrizeImageView(product: p, cornerRadius: 12, iconSize: 40)
                    .frame(height: 110)
                Text(p.name)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 4) {
                    Text(p.category.rawValue)
                        .font(.appScaled(size: 9, weight: .semibold))
                        .foregroundStyle(p.category.color)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(p.category.color.opacity(0.15), in: Capsule())
                    if let v = p.vendor {
                        Text(v)
                            .font(.appScaled(size: 9))
                            .foregroundStyle(Brand.textTertiary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                Text(PrizeCatalog.formattedPrice(p.priceNok))
                    .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            .padding(10)
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - CustomPrizeSheet
//
// Når katalogen ikke har riktig produkt — salgssjefen lager egen premie:
// navn, kategori, pris, og bilde (PhotosPicker fra iPad-galleri eller URL).

struct CustomPrizeSheet: View {
    let onSave: (PrizeProduct) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var category: PrizeCategory = .tech
    @State private var priceText: String = ""
    @State private var imageURL: String = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var photoData: Data?

    private enum Brand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
        static let textSecondary = Color.white.opacity(0.62)
        static let textTertiary = Color.white.opacity(0.45)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    imagePreview
                    photoControls
                    formField(label: "Produktnavn",
                              placeholder: "F.eks. Drone DJI Mavic 3",
                              text: $name)
                    categoryPicker
                    formField(label: "Verdi (NOK)",
                              placeholder: "F.eks. 15000",
                              text: $priceText,
                              keyboard: .numberPad)
                    saveButton
                }
                .padding(20)
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Egen premie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(Brand.purpleLight)
                }
            }
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .onChange(of: photoItem) { _, newItem in
                Task {
                    if let item = newItem,
                       let data = try? await item.loadTransferable(type: Data.self) {
                        photoData = data
                    }
                }
            }
        }
    }

    private var preview: PrizeProduct {
        PrizeProduct(
            name: name.isEmpty ? "Egen premie" : name,
            icon: category.icon,
            priceNok: Int(priceText) ?? 0,
            category: category,
            vendor: "Egen",
            imageURL: imageURL.isEmpty ? nil : imageURL,
            imageData: photoData
        )
    }

    private var imagePreview: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Forhåndsvisning")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
            PrizeImageView(product: preview, cornerRadius: 16, iconSize: 60)
                .frame(height: 200)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Brand.stroke, lineWidth: 1)
                )
        }
    }

    private var photoControls: some View {
        VStack(spacing: 8) {
            PhotosPicker(selection: $photoItem, matching: .images) {
                HStack {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.appScaled(size: 13, weight: .semibold))
                    Text(photoData == nil ? "Velg bilde fra galleriet" : "Bytt bilde")
                        .font(.appScaled(size: 13, weight: .semibold))
                    Spacer()
                    if photoData != nil {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.purple.opacity(0.4), lineWidth: 1))
            }
            HStack {
                Rectangle().fill(Brand.stroke).frame(height: 1)
                Text("eller")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(Brand.textTertiary)
                Rectangle().fill(Brand.stroke).frame(height: 1)
            }
            formField(label: "Bilde-URL",
                      placeholder: "https://…",
                      text: $imageURL,
                      keyboard: .URL)
        }
    }

    private var categoryPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kategori")
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(PrizeCategory.allCases) { c in
                        Button { category = c } label: {
                            HStack(spacing: 5) {
                                Image(systemName: c.icon)
                                    .font(.appScaled(size: 10, weight: .semibold))
                                Text(c.rawValue)
                                    .font(.appScaled(size: 11, weight: .semibold))
                            }
                            .foregroundStyle(category == c ? .white : Brand.textSecondary)
                            .padding(.horizontal, 11).padding(.vertical, 6)
                            .background(category == c ? c.color : Brand.cardHi, in: Capsule())
                            .overlay(Capsule().stroke(category == c ? Color.clear : Brand.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var saveButton: some View {
        Button {
            onSave(preview)
        } label: {
            Text("Bruk denne premien")
                .font(.appScaled(size: 15, weight: .bold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    LinearGradient(
                        colors: [Brand.purple, Brand.purpleLight],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 14)
                )
        }
        .buttonStyle(.plain)
        .padding(.top, 8)
        .disabled(name.isEmpty)
        .opacity(name.isEmpty ? 0.5 : 1)
    }

    private func formField(label: String, placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
            TextField("", text: text, prompt: Text(placeholder).foregroundColor(.white.opacity(0.3)))
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .keyboardType(keyboard)
                .padding(.horizontal, 12).padding(.vertical, 12)
                .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Brand.stroke, lineWidth: 1))
        }
    }
}


// MARK: - PrizeFulfillmentSheet
//
// Hvordan premien faktisk tildeles og leveres til vinneren. Åpnes når
// salgssjefen tapper "Tildel premier" på en avsluttet konkurranse.
//
// Daniel-spørsmål 2026-06-28: «hvordan tildeles gaven til den som vinner»
//
// Per vinner (1./2./3.plass): viser premie + valgt fulfillment-metode +
// status-tidslinje (Venter → Bestilt → Sendt → Mottatt). For fysisk
// leveranse må vinneren bekrefte adresse; for cash trigges HR-task.
// Alle steg er ETT klikk for salgssjefen — Leadgrid orkestrerer resten.

struct PrizeFulfillmentSheet: View {
    let contest: SalesLeadershipSheet.Contest
    let sellers: [TopSellersSheet.Seller]
    @Environment(\.dismiss) private var dismiss

    private enum Brand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
        static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
        static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
        static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
        static let textSecondary = Color.white.opacity(0.62)
        static let textTertiary = Color.white.opacity(0.45)
    }

    enum Step: String, CaseIterable {
        case pending = "Venter"
        case ordered = "Bestilt"
        case shipped = "Sendt"
        case received = "Mottatt"
        var icon: String {
            switch self {
            case .pending: return "clock"
            case .ordered: return "cart.fill"
            case .shipped: return "shippingbox.fill"
            case .received: return "checkmark.circle.fill"
            }
        }
    }

    struct Award: Identifiable {
        let id = UUID()
        let rank: Int
        let winnerName: String
        let winnerAvatar: Color
        let product: PrizeProduct
        var currentStep: Step
    }

    @State private var awards: [Award] = []

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    headerCard
                    explainCard
                    VStack(spacing: 12) {
                        ForEach($awards) { $award in
                            awardCard(award: $award)
                        }
                    }
                    allDoneCard
                    Spacer(minLength: 16)
                }
                .padding(20)
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Tildel premier")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: {
                        ZStack {
                            Circle().fill(Brand.cardHi)
                            Circle().stroke(Brand.stroke, lineWidth: 1)
                            Image(systemName: "xmark")
                                .font(.appScaled(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                }
            }
            .toolbarBackground(Brand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .onAppear { seedAwards() }
        }
    }

    private func seedAwards() {
        guard awards.isEmpty else { return }
        let topThree = Array(sellers.prefix(3))
        // Plukk realistiske premier basert på konkurranse-navnet
        let products: [PrizeProduct] = [
            PrizeCatalog.all.first { $0.name == "iPad Pro 11\"" } ?? PrizeCatalog.all[0],
            PrizeCatalog.all.first { $0.name == "AirPods Pro" } ?? PrizeCatalog.all[1],
            PrizeCatalog.all.first { $0.name == "Restaurant-gavekort 3 000 kr" } ?? PrizeCatalog.all[2],
        ]
        awards = zip(topThree.indices, topThree).map { i, s in
            Award(rank: i + 1,
                  winnerName: s.name,
                  winnerAvatar: s.avatarColor,
                  product: products[min(i, products.count - 1)],
                  currentStep: i == 0 ? .ordered : .pending)
        }
    }

    private var headerCard: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(LinearGradient(
                        colors: [Brand.yellow.opacity(0.3), Brand.orange.opacity(0.2)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                Image(systemName: "trophy.fill")
                    .font(.appScaled(size: 22, weight: .semibold))
                    .foregroundStyle(Brand.yellow)
            }
            .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 3) {
                Text(contest.name)
                    .font(.appScaled(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text(contest.kpi)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.green)
                    Text("Konkurransen er avsluttet — tildel premier")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
            }
            Spacer()
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private var explainCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text("Slik tildeles premier")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Leadgrid orkestrerer hele leveransen ut fra fulfillment-metoden. Du klikker «Tildel» — vinneren får e-post med neste steg (adresse, e-gavekort, booking-lenke).")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(Brand.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.purple.opacity(0.3), lineWidth: 1))
    }

    private func awardCard(award: Binding<Award>) -> some View {
        let a = award.wrappedValue
        let method = a.product.effectiveFulfillment
        return VStack(alignment: .leading, spacing: 12) {
            // Header: rank + vinner + premie-bilde
            HStack(spacing: 12) {
                rankBadge(a.rank)
                ZStack {
                    Circle().fill(a.winnerAvatar.opacity(0.3))
                    Text(initials(a.winnerName))
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(a.winnerAvatar)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.winnerName)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text("Vinner — \(a.rank).plass")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
                Spacer()
                PrizeImageView(product: a.product, cornerRadius: 10, iconSize: 22)
                    .frame(width: 56, height: 56)
            }
            // Premie + fulfillment-metode
            HStack(spacing: 8) {
                Image(systemName: "gift.fill")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.yellow)
                Text(a.product.name)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer()
                Text(PrizeCatalog.formattedPrice(a.product.priceNok))
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(Brand.green)
                    .monospacedDigit()
            }
            fulfillmentChip(method)
            stepperRow(currentStep: award.currentStep, method: method)
            actionButton(award: award)
        }
        .padding(14)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(rankBorderColor(a.rank).opacity(0.4), lineWidth: 1.2))
    }

    private func rankBadge(_ rank: Int) -> some View {
        ZStack {
            Circle().fill(rankBorderColor(rank).opacity(0.25))
            Text("\(rank)")
                .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(rankBorderColor(rank))
        }
        .frame(width: 32, height: 32)
    }

    private func rankBorderColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return Color(red: 0.98, green: 0.75, blue: 0.14)
        case 2: return Color(red: 0.78, green: 0.78, blue: 0.85)
        case 3: return Color(red: 0.80, green: 0.50, blue: 0.30)
        default: return Color.white.opacity(0.55)
        }
    }

    private func fulfillmentChip(_ m: FulfillmentMethod) -> some View {
        HStack(spacing: 6) {
            Image(systemName: m.icon)
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
            VStack(alignment: .leading, spacing: 1) {
                Text(m.title)
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                Text(m.subtitle)
                    .font(.appScaled(size: 10))
                    .foregroundStyle(Brand.textSecondary)
            }
            Spacer()
        }
        .padding(8)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 8))
    }

    private func stepperRow(currentStep: Binding<Step>, method: FulfillmentMethod) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(Step.allCases.enumerated()), id: \.offset) { i, step in
                let isDone = stepIndex(currentStep.wrappedValue) >= i
                VStack(spacing: 4) {
                    ZStack {
                        Circle().fill(isDone ? Brand.green : Brand.cardHi)
                        Circle().stroke(isDone ? Brand.green : Brand.stroke, lineWidth: 1)
                        Image(systemName: step.icon)
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(isDone ? .white : Brand.textTertiary)
                    }
                    .frame(width: 26, height: 26)
                    Text(step.rawValue)
                        .font(.appScaled(size: 9, weight: .semibold))
                        .foregroundStyle(isDone ? .white : Brand.textTertiary)
                }
                .frame(maxWidth: .infinity)
                if i < Step.allCases.count - 1 {
                    Rectangle()
                        .fill(stepIndex(currentStep.wrappedValue) > i ? Brand.green : Brand.stroke)
                        .frame(height: 2)
                        .frame(maxWidth: .infinity)
                        .offset(y: -8)
                }
            }
        }
        .padding(.horizontal, 8)
    }

    private func stepIndex(_ s: Step) -> Int {
        Step.allCases.firstIndex(of: s) ?? 0
    }

    private func actionButton(award: Binding<Award>) -> some View {
        let a = award.wrappedValue
        let next = nextStep(a.currentStep)
        let cta = ctaLabel(currentStep: a.currentStep, method: a.product.effectiveFulfillment)
        return Button {
            if let n = next {
                award.wrappedValue.currentStep = n
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: a.currentStep == .received ? "checkmark.seal.fill" : "arrow.right.circle.fill")
                    .font(.appScaled(size: 12, weight: .bold))
                Text(cta)
                    .font(.appScaled(size: 12, weight: .bold))
                Spacer()
                if next != nil {
                    Image(systemName: "chevron.right")
                        .font(.appScaled(size: 10, weight: .bold))
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 12).padding(.vertical, 9)
            .frame(maxWidth: .infinity)
            .background(
                a.currentStep == .received ? AnyShapeStyle(Brand.green) :
                AnyShapeStyle(LinearGradient(
                    colors: [Brand.purple, Brand.purpleLight],
                    startPoint: .leading, endPoint: .trailing
                )),
                in: RoundedRectangle(cornerRadius: 10)
            )
        }
        .buttonStyle(.plain)
        .disabled(next == nil)
        .opacity(next == nil ? 0.85 : 1.0)
    }

    private func nextStep(_ s: Step) -> Step? {
        let i = stepIndex(s)
        guard i < Step.allCases.count - 1 else { return nil }
        return Step.allCases[i + 1]
    }

    private func ctaLabel(currentStep: Step, method: FulfillmentMethod) -> String {
        switch (currentStep, method) {
        case (.pending,  .digitalVoucher):   return "Send digital gavekort nå"
        case (.pending,  .cashOnPayroll):    return "Send til HR for lønn"
        case (.pending,  .physicalShipping): return "Be vinner om adresse → bestill"
        case (.pending,  .experienceTicket): return "Send voucher på e-post"
        case (.pending,  .travelBooking):    return "Bestill via reisebyrå"
        case (.pending,  .internalGrant):    return "Marker som godkjent"
        case (.ordered,  _):                 return "Marker som sendt"
        case (.shipped,  _):                 return "Marker som mottatt"
        case (.received, _):                 return "Tildelt — sak lukket"
        }
    }

    private var allDoneCard: some View {
        let allReceived = awards.allSatisfy { $0.currentStep == .received }
        return HStack(spacing: 10) {
            Image(systemName: allReceived ? "checkmark.seal.fill" : "envelope.badge.fill")
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(allReceived ? Brand.green : Brand.purpleLight)
            VStack(alignment: .leading, spacing: 2) {
                Text(allReceived ? "Alt levert!" : "Vinnere får varsel + e-post")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text(allReceived ? "Alle premier er bekreftet mottatt. Konkurransen arkiveres automatisk."
                                 : "Hver gang du flytter en status, sender Leadgrid push + e-post til vinneren.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(Brand.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(allReceived ? Brand.green.opacity(0.5) : Brand.stroke, lineWidth: 1))
    }

    private func initials(_ name: String) -> String {
        name.split(separator: " ").prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }
}

