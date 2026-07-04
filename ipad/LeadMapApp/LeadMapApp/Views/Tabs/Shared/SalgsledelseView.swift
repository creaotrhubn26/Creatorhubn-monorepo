// SalgsledelseView.swift — 7. hovedfane for salgssjefer (Pakke 10, 2026-07-01).
//
// Wrapper SalesLeadershipSheet (portet fra over-preview) som en top-level
// fane i stedet for et modal sheet. Full-suite for provisjon, konkurranser,
// premie-katalog og fulfillment. Genererer mock-sellers når `sellers`-input
// ikke kommer fra prod-API (backend-binding pending, se `APIClient+SalesLeadership`).
//
// TODO Pakke 10.x — role-gate:
//   - Sjekk `appState.userRole == "sales_manager"` FØR fanen mountes
//   - Bruk `LeadgridRole` / `AccessLevel` fra TeamAccessControl (RBAC)
//   - Hvis ikke salgssjef: skjul tab-en i MainTabView + MainSidebarView

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

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Cockpit-strip m/ 5 salgssjef-CTA-er (Pakke 10.1):
                // Godkjenning · Team-forecast · Coaching · Kjøregodtgjørelse · Ruter.
                // TeamRoutesTodaySheet's «Naviger dit»-CTA-er gjenbruker Meetings-
                // fanens NavigationFullScreenView m/ POI-radar (bensin/lade) —
                // dokumentert TODO til neste wiring-iterasjon.
                SalgssjefCockpitStrip()

                // Full Salgsledelse-suite (4 sub-tabs: Provisjon/Konkurranser/
                // Premie-katalog/Tildel premier) portet fra preview.
                // embedded: true → skjuler X-lukkeknappen (arv fra sheet-modus).
                SalesLeadershipSheet(
                    sellers: SalgsledelseSellersFactory.mockSellers(currentUser: currentUserName),
                    currentUserName: currentUserName,
                    embedded: true
                )
            }
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
