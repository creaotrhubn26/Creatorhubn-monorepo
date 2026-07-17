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
        // Ekte team-data når demo er AV — attach er idempotent (samme
        // mønster som TeamView) og fyller memberDTOs → sellers re-evalueres.
        .task {
            guard !DemoModeManager.isActiveNonisolated else { return }
            if let api = appState.api {
                TeamLiveStore.shared.attach(api: api, appState: appState)
            }
        }
    }

    private var inner: some View {
        VStack(spacing: 0) {
            // Cockpit-strip m/ 5 salgssjef-CTA-er (Pakke 10.1):
            // Godkjenning · Team-forecast · Coaching · Kjøregodtgjørelse · Ruter.
            // TeamRoutesTodaySheet's «Naviger dit» starter den EKTE Kart-nav-
            // motoren (POV/Kjøre, MKDirections, POI langs rute) via
            // AppState.requestNavigation.
            SalgssjefCockpitStrip()

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
