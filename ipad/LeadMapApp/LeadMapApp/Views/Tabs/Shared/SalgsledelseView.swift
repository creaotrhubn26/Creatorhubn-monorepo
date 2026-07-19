// SalgsledelseView.swift — 7. hovedfane for salgssjefer (Pakke 10, 2026-07-01).
//
// Wrapper SalesLeadershipSheet (portet fra over-preview) som en top-level
// fane i stedet for et modal sheet. Full-suite for provisjon, konkurranser,
// premie-katalog og fulfillment. Mock-sellers KUN i demo-modus — ellers
// ekte leaderboard fra TeamLiveStore (`/sales-leadership/team-members`).
//
// Role-gate (2026-07-17): fanen er skjult i sidebar/Mer for ikke-ledere,
// OG vaktes her i viewet (forsvar uansett inngang: deep-link, persistert
// valg, keyboard-shortcut). Entitlement-gated via .gated(.salgsledelse).

import SwiftUI

struct SalgsledelseView: View {
    @Environment(AppState.self) private var appState

    // MARK: Dørsalg-variant (2026-07-18)
    // Ren dørsalg-org har ingen CRM-pipeline — leaderboardet bygges da fra
    // dørsalg-stats (vunnet/avslått per selger) i stedet, og en KPI-strip
    // viser teamets dører. Provisjon/konkurranser/premier beholdes (rangert
    // på vunnede dører). Aktiveres av dørsalg-profilen (superadmin-preset).
    @State private var dorsalgStats: KartverketService.DorsalgStats?
    @State private var showProdukter = false

    private var erRenDorsalgOrg: Bool {
        EntitlementStore.shared.erRenDorsalgOrg
    }

    /// Innlogget bruker sitt visningsnavn — brukes til å highlighte deres rad
    /// i selgerlisten og gjenkjenne dem som "current user" i drill-down-sheets.
    private var currentUserName: String {
        let email = appState.userEmail ?? "bruker@leadgrid"
        let local = email.split(separator: "@").first.map(String.init) ?? "Bruker"
        let cleaned = local
            .replacingOccurrences(of: ".", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
        return cleaned.split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    /// Selgerlisten bak sub-tabs. Mock KUN i demo-modus — ellers ekte
    /// leaderboard fra TeamLiveStore (team-members-endepunktet), rangert
    /// etter total verdi. Tom liste = ærlig tom-tilstand (sheeten er
    /// empty-safe: bruker kun prefix/count/ForEach).
    private var sellers: [TopSellersSheet.Seller] {
        // Dørsalg SJEKKES FØR demo: en ren dørsalg-org (også QA_DORSALG_REN
        // i demo) skal aldri vise B2B-mock-leaderboardet. Rangert på vunnede
        // dører; totalValue = provisjonsgrunnlag (vunnet × produktverdi).
        if erRenDorsalgOrg {
            let per = dorsalgStats?.perSelger ?? []
            return per
                .sorted { $0.vunnet > $1.vunnet }
                .enumerated()
                .map { idx, s in
                    TopSellersSheet.Seller(
                        rank: idx + 1, name: s.navn, title: "Dørselger",
                        avatarColor: .purple,
                        won: s.vunnet, leads: s.vunnet + s.avslatt, trend: 0,
                        totalValue: s.verdi ?? 0,
                        topDeals: [], regions: [], industries: []
                    )
                }
        }
        if DemoModeManager.isActiveNonisolated {
            return SalgsledelseSellersFactory.mockSellers(currentUser: currentUserName)
        }
        let store = TeamLiveStore.shared
        // Gjenbruk fargen TeamMember-mappingen alt har regnet ut (team-farge
        // eller stabil hash-farge) så avatarer matcher Team-fanen.
        let colorByName = Dictionary(
            store.members.map { ($0.name, $0.color) },
            uniquingKeysWith: { first, _ in first }
        )
        return store.memberDTOs
            .sorted { $0.totalValueNok > $1.totalValueNok }
            .enumerated()
            .map { idx, dto in
                TopSellersSheet.Seller(
                    rank: idx + 1,
                    name: dto.name,
                    title: dto.title ?? "Selger",
                    avatarColor: colorByName[dto.name] ?? .purple,
                    won: dto.won,
                    leads: dto.leads,
                    trend: 0,  // rank-endring har ingen historikk-kilde enda
                    totalValue: Double(dto.totalValueNok),
                    topDeals: [], regions: [], industries: []
                )
            }
    }

    /// true når viewet PUSHES inn i en ytre NavigationStack (iPhone Mer-fanen).
    /// Nestet NavigationStack i en push tripper SwiftUI-assertion på enhet
    /// (samme klasse som Leadgrid Go-krasjen 2026-07-16) — da hopper vi over
    /// vår egen stack og lar den ytre eie navigasjonen.
    var embeddedInStack = false

    /// Salgsledelse er leder-domene (provisjon/premier/konkurranser).
    private var isLeder: Bool {
        ["admin", "salgssjef"].contains(appState.roleInOrg ?? "")
    }

    var body: some View {
        Group {
            if !isLeder {
                // Rolle-vakt: selgere skal aldri se provisjonsgrunnlag/premier.
                ContentUnavailableView(
                    "Krever salgssjef-rolle",
                    systemImage: "lock.shield",
                    description: Text("Salgsledelse er tilgjengelig for administratorer og salgssjefer.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(LBrand.bg.ignoresSafeArea())
            } else if embeddedInStack {
                inner
            } else {
                NavigationStack { inner }
            }
        }
        .gated(.salgsledelse)   // entitlement-laget (feature-matrisen)
        .sheet(isPresented: $showProdukter) { DorsalgProduktSheet() }
        // Ekte team-data når demo er AV — attach er idempotent (samme
        // mønster som TeamView) og fyller memberDTOs → sellers re-evalueres.
        .task {
            guard !DemoModeManager.isActiveNonisolated else {
                // Demo + ren dørsalg (QA_DORSALG_REN): demo-tall — aldri backend.
                if erRenDorsalgOrg { dorsalgStats = Self.demoDorsalgStats }
                return
            }
            if let api = appState.api {
                TeamLiveStore.shared.attach(api: api, appState: appState)
                if erRenDorsalgOrg {
                    dorsalgStats = await KartverketService.shared.fetchDorsalgStats(using: api)
                }
            }
        }
    }

    /// Demo-tall for dørsalg-leaderboardet (speiler Oversiktens demo-stats).
    private static let demoDorsalgStats = KartverketService.DorsalgStats(
        vunnet: 47, avslatt: 118, iDag: 23, vunnetIDag: 6, denneUka: 96,
        meg: nil,
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
        sisteVunnet: [])

    private var inner: some View {
        VStack(spacing: 0) {
            // Cockpit-strip m/ 5 salgssjef-CTA-er (Pakke 10.1):
            // Godkjenning · Team-forecast · Coaching · Kjøregodtgjørelse · Ruter.
            // TeamRoutesTodaySheet's «Naviger dit» starter den EKTE Kart-nav-
            // motoren (POV/Kjøre, MKDirections, POI langs rute) via
            // AppState.requestNavigation.
            SalgssjefCockpitStrip()

            // Dørsalg: teamets dører som KPI-strip over suiten + inngang
            // til produkt-styringen (hvem selger hva, verdi per produkt).
            if erRenDorsalgOrg {
                VStack(spacing: 8) {
                    if let s = dorsalgStats {
                        HStack(spacing: 10) {
                            dorsalgKpi("\(s.vunnetIDag)", "Vunnet i dag", LBrand.green)
                            dorsalgKpi("\(s.iDag)", "Dører i dag", LBrand.purpleLight)
                            dorsalgKpi("\(s.denneUka)", "Denne uka", LBrand.blue)
                            if s.vunnet + s.avslatt > 0 {
                                let hr = Int((Double(s.vunnet) / Double(s.vunnet + s.avslatt) * 100).rounded())
                                dorsalgKpi("\(hr) %", "Hit-rate", LBrand.orange)
                            }
                        }
                    }
                    Button { showProdukter = true } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "shippingbox.fill")
                                .font(.appScaled(size: 12, weight: .bold))
                            Text("Produkter & tilgang")
                                .font(.appScaled(size: 12, weight: .bold))
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.appScaled(size: 10, weight: .bold))
                                .foregroundStyle(LBrand.textSecondary)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 13).padding(.vertical, 11)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11)
                            .stroke(LBrand.purple.opacity(0.35), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
            }

            // Full Salgsledelse-suite (4 sub-tabs: Provisjon/Konkurranser/
            // Premie-katalog/Tildel premier) portet fra preview.
            // embedded: true → skjuler X-lukkeknappen (arv fra sheet-modus).
            SalesLeadershipSheet(
                sellers: sellers,
                currentUserName: currentUserName,
                embedded: true
            )
        }
    }
}

extension SalgsledelseView {
    fileprivate func dorsalgKpi(_ value: String, _ label: String, _ tint: Color) -> some View {
        VStack(spacing: 3) {
            Text(value).font(.appScaled(size: 16, weight: .black, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
            Text(label).font(.appScaled(size: 8, weight: .semibold)).foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 9)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(tint.opacity(0.25), lineWidth: 1))
    }
}

// MARK: - Mock-sellers factory

/// Genererer selgerlisten som ligger bak sub-tabs (rank/won/leads/trend/verdi).
/// Preview-versjonen brukte hardkodede seed-data inne i TopSellersSheet; her
/// eksponerer vi det som en shared factory så både SalgsledelseView og
/// TopSellersSheet (når den åpnes fra profil-menyen) kan dele én sannhet.
enum SalgsledelseSellersFactory {
    static func mockSellers(currentUser: String) -> [TopSellersSheet.Seller] {
        [
            // Topp 3 — full detalj-modell m/ topDeals + regions + industries
            .init(
                rank: 1, name: "Anniken Sørli", title: "Salgsdirektør",
                avatarColor: .purple,
                won: 312, leads: 1820, trend: 0,
                totalValue: 4_240_000,
                topDeals: [], regions: [], industries: []
            ),
            .init(
                rank: 2, name: "Mikkel Berg", title: "Senior selger",
                avatarColor: .green,
                won: 248, leads: 1640, trend: 1,
                totalValue: 3_180_000,
                topDeals: [], regions: [], industries: []
            ),
            .init(
                rank: 3, name: currentUser, title: "Salgssjef",
                avatarColor: Color(red: 0.75, green: 0.45, blue: 1.0),
                won: 166, leads: 1248, trend: 2,
                totalValue: 2_140_000,
                topDeals: [], regions: [], industries: []
            ),
            // 4-12 — enklere seed-data
            .init(rank: 4,  name: "Sara Lindberg",  title: "Salgskonsulent", avatarColor: .blue,   won: 158, leads: 1190, trend: -1, totalValue: 1_980_000, topDeals: [], regions: [], industries: []),
            .init(rank: 5,  name: "Tobias Strand",  title: "Salgskonsulent", avatarColor: .orange, won: 142, leads: 1075, trend: 0,  totalValue: 1_720_000, topDeals: [], regions: [], industries: []),
            .init(rank: 6,  name: "Karoline Nesse", title: "Salgskonsulent", avatarColor: .yellow, won: 128, leads: 980,  trend: 3,  totalValue: 1_540_000, topDeals: [], regions: [], industries: []),
            .init(rank: 7,  name: "Henrik Aase",    title: "Salgskonsulent", avatarColor: .red,    won: 117, leads: 902,  trend: -2, totalValue: 1_380_000, topDeals: [], regions: [], industries: []),
            .init(rank: 8,  name: "Jonas Halvorsen",title: "Promotør",       avatarColor: .purple, won: 98,  leads: 845,  trend: 1,  totalValue: 1_180_000, topDeals: [], regions: [], industries: []),
            .init(rank: 9,  name: "Marte Johansen", title: "Salgskonsulent", avatarColor: .green,  won: 88,  leads: 720,  trend: 0,  totalValue: 1_050_000, topDeals: [], regions: [], industries: []),
            .init(rank: 10, name: "Erik Bakken",    title: "Salgskonsulent", avatarColor: .blue,   won: 72,  leads: 615,  trend: 2,  totalValue: 880_000,   topDeals: [], regions: [], industries: []),
            .init(rank: 11, name: "Ida Fjeld",      title: "Salgskonsulent", avatarColor: .orange, won: 61,  leads: 540,  trend: -1, totalValue: 740_000,   topDeals: [], regions: [], industries: []),
            .init(rank: 12, name: "Kristian Vik",   title: "Salgskonsulent", avatarColor: .yellow, won: 48,  leads: 450,  trend: 0,  totalValue: 590_000,   topDeals: [], regions: [], industries: [])
        ]
    }
}

// MARK: - Produkter & tilgang (dørsalg, mig 0399)

/// Salgssjefens produkt-styring: katalogen org-en selger for (SOS
/// Barnebyer, Kirkens Bymisjon, …) m/ verdi per vunnet dør (provisjons-
/// grunnlag), og hvem som selger hva — en selger uten tildeling ser alle
/// produkter; tildelte ser KUN sine.
private struct DorsalgProduktSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    @State private var envelope: KartverketService.DorsalgProductsEnvelope?
    @State private var members: [KartverketService.DorsalgAccessMember] = []
    @State private var nyttNavn = ""
    @State private var nyVerdi = ""
    @State private var lagrer = false

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    produktSeksjon
                    tilgangSeksjon
                    Color.clear.frame(height: 16)
                }
                .padding(18)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Produkter & tilgang")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lukk") { dismiss() }
                        .fontWeight(.bold).foregroundStyle(LBrand.purpleLight)
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.large])
        .task { await reload() }
    }

    private func reload() async {
        if isDemo {
            envelope = KartverketService.DorsalgProductsEnvelope(
                canManage: true, mine: [],
                products: [
                    .init(id: "demo-p1", navn: "SOS Barnebyer",
                          farge: "#22C55E", aktiv: true, verdiPerVunnet: 450,
                          bidrag: [.init(belop: 250, label: "Fadder"),
                                   .init(belop: 350, label: "Fadder+")],
                          samtykkeTekst: "", signeringUrl: nil),
                    .init(id: "demo-p2", navn: "Kirkens Bymisjon",
                          farge: "#3B82F6", aktiv: true, verdiPerVunnet: 390,
                          bidrag: [.init(belop: 200, label: "Fast giver")],
                          samtykkeTekst: "", signeringUrl: nil),
                ])
            members = [
                .init(userId: "demo-espen", navn: "Espen Berg",
                      role: "salgskonsulent", productIds: ["demo-p1"]),
                .init(userId: "demo-marit", navn: "Marit Johansen",
                      role: "teamleder", productIds: ["demo-p2"]),
                .init(userId: "demo-lars", navn: "Lars Erik Moen",
                      role: "salgskonsulent", productIds: []),
                .init(userId: "demo-helena", navn: "Helena Dahl",
                      role: "salgskonsulent", productIds: []),
            ]
            return
        }
        guard let api = appState.api else { return }
        envelope = await KartverketService.shared.fetchDorsalgProducts(using: api)
        members = await KartverketService.shared.fetchDorsalgProductAccess(using: api)
    }

    // MARK: Produktkatalogen

    private var produktSeksjon: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("PRODUKTER")
                .font(.appScaled(size: 9, weight: .bold))
                .foregroundStyle(LBrand.textSecondary).kerning(0.5)
            ForEach(envelope?.products ?? []) { p in
                HStack(spacing: 10) {
                    Image(systemName: "shippingbox.fill")
                        .font(.appScaled(size: 13))
                        .foregroundStyle(p.aktiv ? LBrand.purpleLight : LBrand.textTertiary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(p.navn)
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(p.aktiv ? .white : LBrand.textSecondary)
                        if let v = p.verdiPerVunnet {
                            Text("\(Int(v)) kr per vunnet dør")
                                .font(.appScaled(size: 10)).foregroundStyle(LBrand.green)
                        } else {
                            Text("Ingen verdi satt (provisjonsgrunnlag)")
                                .font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
                        }
                    }
                    Spacer()
                    Toggle("", isOn: Binding(
                        get: { p.aktiv },
                        set: { ny in settAktiv(p, ny) }
                    ))
                    .labelsHidden().tint(LBrand.green)
                }
                .padding(11)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
            }
            // Legg til nytt produkt — «flere produkter senere» = én rad her.
            HStack(spacing: 8) {
                TextField("", text: $nyttNavn,
                          prompt: Text("Nytt produkt (f.eks. Plan Norge)")
                            .foregroundColor(LBrand.textTertiary))
                    .textFieldStyle(.plain).foregroundStyle(.white)
                    .font(.appScaled(size: 12))
                TextField("", text: $nyVerdi,
                          prompt: Text("kr/dør").foregroundColor(LBrand.textTertiary))
                    .textFieldStyle(.plain).foregroundStyle(.white)
                    .font(.appScaled(size: 12))
                    .frame(width: 60)
                    .keyboardType(.numberPad)
                Button {
                    leggTilProdukt()
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.appScaled(size: 20))
                        .foregroundStyle(nyttNavn.trimmingCharacters(in: .whitespaces).isEmpty
                                         ? LBrand.textTertiary : LBrand.green)
                }
                .buttonStyle(.plain)
                .disabled(nyttNavn.trimmingCharacters(in: .whitespaces).isEmpty || lagrer)
            }
            .padding(11)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
        }
    }

    private func settAktiv(_ p: KartverketService.DorsalgProduct, _ ny: Bool) {
        if isDemo {
            oppdaterLokalt(p.id, aktiv: ny)
            return
        }
        guard let api = appState.api else { return }
        oppdaterLokalt(p.id, aktiv: ny)
        Task {
            await KartverketService.shared.patchDorsalgProduct(
                id: p.id, aktiv: ny, verdiPerVunnet: nil, using: api)
        }
    }

    private func oppdaterLokalt(_ id: String, aktiv: Bool) {
        guard let env = envelope else { return }
        envelope = KartverketService.DorsalgProductsEnvelope(
            canManage: env.canManage, mine: env.mine,
            products: env.products.map {
                $0.id == id
                    ? .init(id: $0.id, navn: $0.navn, farge: $0.farge,
                            aktiv: aktiv, verdiPerVunnet: $0.verdiPerVunnet,
                            bidrag: $0.bidrag, samtykkeTekst: $0.samtykkeTekst,
                            signeringUrl: $0.signeringUrl)
                    : $0
            })
    }

    private func leggTilProdukt() {
        let navn = nyttNavn.trimmingCharacters(in: .whitespaces)
        guard !navn.isEmpty else { return }
        let verdi = Double(nyVerdi.replacingOccurrences(of: ",", with: "."))
        nyttNavn = ""; nyVerdi = ""
        if isDemo {
            guard let env = envelope else { return }
            envelope = KartverketService.DorsalgProductsEnvelope(
                canManage: true, mine: env.mine,
                products: env.products + [
                    .init(id: UUID().uuidString, navn: navn, farge: "#A855F7",
                          aktiv: true, verdiPerVunnet: verdi,
                          bidrag: [], samtykkeTekst: "", signeringUrl: nil)
                ])
            return
        }
        guard let api = appState.api else { return }
        lagrer = true
        Task {
            _ = await KartverketService.shared.createDorsalgProduct(
                navn: navn, verdiPerVunnet: verdi, using: api)
            await reload()
            lagrer = false
        }
    }

    // MARK: Hvem selger hva

    private var tilgangSeksjon: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("HVEM SELGER HVA")
                .font(.appScaled(size: 9, weight: .bold))
                .foregroundStyle(LBrand.textSecondary).kerning(0.5)
            Text("Uten tildeling ser selgeren alle produkter. Tildeler du ett eller flere, ser de KUN dem — til du endrer det her.")
                .font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
            ForEach(members) { m in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Text(m.navn)
                            .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        Text(m.role.capitalized)
                            .font(.appScaled(size: 9)).foregroundStyle(LBrand.textSecondary)
                        Spacer()
                        if m.productIds.isEmpty {
                            Text("Alle produkter")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(LBrand.purpleLight)
                        }
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(envelope?.products.filter(\.aktiv) ?? []) { p in
                                let valgt = m.productIds.contains(p.id)
                                Button {
                                    toggleTilgang(medlem: m, produkt: p)
                                } label: {
                                    Text(p.navn)
                                        .font(.appScaled(size: 11, weight: .bold))
                                        .foregroundStyle(valgt ? .white : LBrand.textSecondary)
                                        .padding(.horizontal, 10).padding(.vertical, 6)
                                        .background(
                                            valgt ? AnyShapeStyle(LBrand.purple)
                                                  : AnyShapeStyle(LBrand.cardHi),
                                            in: Capsule())
                                        .overlay(Capsule().stroke(
                                            valgt ? LBrand.purpleLight.opacity(0.6) : LBrand.stroke,
                                            lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(11)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
            }
        }
    }

    private func toggleTilgang(medlem: KartverketService.DorsalgAccessMember,
                               produkt: KartverketService.DorsalgProduct) {
        var ids = Set(medlem.productIds)
        if ids.contains(produkt.id) { ids.remove(produkt.id) } else { ids.insert(produkt.id) }
        let nye = Array(ids)
        members = members.map {
            $0.userId == medlem.userId
                ? .init(userId: $0.userId, navn: $0.navn, role: $0.role, productIds: nye)
                : $0
        }
        guard !isDemo, let api = appState.api else { return }
        Task {
            await KartverketService.shared.setDorsalgProductAccess(
                userId: medlem.userId, productIds: nye, using: api)
        }
    }
}
