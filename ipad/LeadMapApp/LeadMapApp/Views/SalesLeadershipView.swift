// SalesLeadershipView.swift
//
// Salgsledelse-suite: provisjons-konfig, konkurranser, premie-katalog,
// fulfillment-flyt og selger-detalj-views. Isolert fra main's OversiktView
// slik at vi kan rulle ut salgsledelse-flyten uten å overskrive eksisterende
// dashboard-flate (main har sin egen 688-linjers OversiktView).
//
// Routet inn fra LeadgridHubView som egen "Salgsledelse"-seksjon.
//
// API-binding mot:
//   - APIClient+SalesLeadership.swift (commission/contests/catalog/awards)
//   - sales-leadership-routes.ts (Express)
//   - migration 0354_sales_leadership_prizes.sql

import SwiftUI
import MapKit
import Charts
import PhotosUI

// MARK: - Brand-palett (file-scoped)
//
// Salgsledelse-suiten har sin egen mørke palett (lilla aksent) som
// matcher CreatorHub admin-theme. Holdes `fileprivate` slik at den
// IKKE kolliderer med eksisterende Brand-konstanter i andre filer
// (f.eks. main's OversiktView). Hver inner-sheet kan ha sin egen
// private Brand-enum også — den lokale vinner ved navnekonflikt.

fileprivate enum Brand {
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

// MARK: - SalesLeadershipDashboardView
//
// Entry-view for Leadgrid Hub-routen. Wrapper SalesLeadershipSheet inline
// (ikke som modal) slik at salgsledelse-suiten blir hovedflaten på sin
// egen route. Selger-listen leveres tom som start-data — backend loadInitial
// fyller commission/contests/catalog uavhengig.

struct SalesLeadershipDashboardView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        SalesLeadershipSheet(
            sellers: [],
            currentUserName: derivedName
        )
    }

    /// Avled vis-navn fra userEmail siden AppState ikke har eget display-name.
    /// Faller tilbake til "Selger" hvis ikke logget inn.
    private var derivedName: String {
        guard let email = appState.userEmail, !email.isEmpty else {
            return "Selger"
        }
        let local = email.split(separator: "@").first.map(String.init) ?? email
        let parts = local.split(whereSeparator: { $0 == "." || $0 == "_" || $0 == "-" })
        return parts.map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
    }
}

struct TopSellersSheet: View {
    /// Brukt som fallback-navn for «Du»-raden hvis backend ikke gir oss
    /// `currentUserId` (matching gjøres da på navn — best-effort). Beholdt
    /// som init-arg for at SalesLeadershipDashboardView fortsatt kan
    /// avlede et display-navn fra `AppState.userEmail`.
    let currentUserName: String
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var period: Period = .month
    @State private var selectedSeller: Seller?
    @State private var leadershipOpen: Bool = false

    // ── Backend-binding (PR #1097 oppfølging) ─────────────────
    // Initial state = mock-data (12 selgere) for at podium-subscriptene
    // [0/1/2] aldri skal krasje + at UI har noe å vise mens lasting
    // pågår. `.task` overskriver fra
    // `/api/leadgrid/sales-leadership/team-members`. På feil/0 resultater
    // beholdes mock-en (bedre enn tom liste).
    @State private var sellers: [Seller] = []
    @State private var loading: Bool = true
    @State private var currentUserId: String?

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
        /// Server-side users.id (UUID-streng) — nil for mock-rader. Brukes
        /// til å markere «Du»-badgen via match mot SalesTeamMembersResponse
        /// .currentUserId, og til winner-lookup i PrizeFulfillmentSheet.
        var userId: String? = nil
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

    /// Initial fallback-data brukt før backend svarer + når
    /// `/team-members` returnerer 0 eller feiler. 12 selgere så
    /// podium-subscriptene [0/1/2] er trygge og UI-en har realistisk
    /// bredde å vise med en gang.
    private func defaultMockSellers() -> [Seller] {
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
                    podiumSection
                    listHeader
                    sellerList
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
                                .font(.system(size: 12, weight: .bold))
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
                                    .font(.system(size: 12, weight: .bold))
                                Text("Salgsledelse")
                                    .font(.system(size: 13, weight: .semibold))
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
                SellerDetailSheet(seller: seller, isCurrentUser: isCurrentUser(seller))
            }
            .sheet(isPresented: $leadershipOpen) {
                SalesLeadershipSheet(sellers: sellers, currentUserName: currentUserName)
            }
            .task {
                // Seed mock først så podium-subscriptene aldri tomme.
                if sellers.isEmpty { sellers = defaultMockSellers() }
                await loadMembers()
            }
        }
    }

    /// Hent ekte salgs-teammedlemmer fra
    /// `/api/leadgrid/sales-leadership/team-members`. Beholder mock-listen
    /// som fall-back hvis api/server-svar feiler eller er tomt.
    private func loadMembers() async {
        guard let api = appState.api else {
            await MainActor.run { loading = false }
            return
        }
        await MainActor.run { loading = true }
        defer { Task { @MainActor in loading = false } }
        do {
            let resp = try await api.fetchSalesTeamMembers()
            guard !resp.members.isEmpty else {
                // 0 medlemmer fra backend (org ikke onboardet enda) =
                // behold mock. Synlig for utvikler via print.
                print("[TopSellers] team-members tom — beholder mock-data")
                return
            }
            await MainActor.run {
                self.currentUserId = resp.currentUserId
                self.sellers = resp.members.enumerated().map { idx, m in
                    Seller(
                        userId: m.userId,
                        rank: idx + 1,
                        name: m.name,
                        title: m.title ?? "Selger",
                        avatarColor: colorForSeller(idx),
                        won: m.won,
                        leads: m.leads,
                        trend: m.trend,
                        totalValue: Double(m.totalValueNok),
                        topDeals: [],
                        regions: [],
                        industries: []
                    )
                }
            }
        } catch {
            // Stille fall-back: behold mock. Logging holder for nå —
            // SalesLeadershipSheet har egen error-banner for sin egen load.
            print("[TopSellers] team-members fetch failed: \(error)")
        }
    }

    /// Roter gjennom Brand-paletten basert på indeks — gir hver selger
    /// en stabil farge uten å duplisere makeBasicSeller-mønsteret.
    private func colorForSeller(_ idx: Int) -> Color {
        let palette: [Color] = [
            Brand.purple, Brand.green, Brand.yellow, Brand.blue,
            Brand.red, Brand.orange, Brand.purpleLight,
        ]
        return palette[idx % palette.count]
    }

    /// Sann hvis selgeren matcher innlogget bruker. Bruker server-side
    /// `currentUserId` om vi har det; ellers fall-back til navn-match.
    private func isCurrentUser(_ s: Seller) -> Bool {
        if let cid = currentUserId, let uid = s.userId {
            return cid == uid
        }
        return s.name == currentUserName
    }

    private var periodPicker: some View {
        HStack(spacing: 0) {
            ForEach(Period.allCases, id: \.self) { p in
                Button { period = p } label: {
                    Text(p.rawValue)
                        .font(.system(size: 12, weight: .semibold))
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
    //
    // Bruker `if sellers.count >= 3`-guard fordi `@State` starter tom og
    // `.task` seeder mock før første nyttige render — men en initial
    // render kan inntreffe FØR det. Tom liste = vis loading-shimmer i
    // stedet for å krasje på subscript.
    @ViewBuilder
    private var podiumSection: some View {
        if sellers.count >= 3 {
            podiumSectionContent
        } else {
            podiumPlaceholder
        }
    }

    private var podiumSectionContent: some View {
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

    /// Vist før mock seedes / data lastes — gir podium-området riktig
    /// høyde så layout ikke hopper når data dukker opp.
    private var podiumPlaceholder: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18).fill(Brand.card)
            if loading {
                ProgressView()
                    .tint(.white)
            } else {
                Text("Ingen selgere ennå")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
            }
        }
        .frame(height: 200)
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
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                if s.rank == 1 {
                    Image(systemName: "crown.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(accent)
                        .offset(y: -38)
                }
            }
            .frame(width: 60, height: 60)
            .shadow(color: s.avatarColor.opacity(0.5), radius: 6, y: 3)
            VStack(spacing: 2) {
                Text(s.name.split(separator: " ").first.map(String.init) ?? s.name)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("\(s.won) vunnet")
                    .font(.system(size: 10))
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
                    .font(.system(size: 22, weight: .bold, design: .rounded))
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
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Spacer()
            HStack(spacing: 4) {
                Image(systemName: "arrow.up.arrow.down")
                    .font(.system(size: 10, weight: .semibold))
                Text("Vunnet")
                    .font(.system(size: 11, weight: .semibold))
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
        let isMe = isCurrentUser(s)
        return HStack(spacing: 12) {
            Text("\(s.rank)")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(Brand.textSecondary)
                .frame(width: 26, alignment: .leading)
            ZStack {
                Circle().fill(s.avatarColor.opacity(0.3))
                Text(initials(s.name))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(s.avatarColor)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(s.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if isMe {
                        Text("Du")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Brand.purpleLight)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(Brand.purple.opacity(0.25), in: Capsule())
                    }
                }
                Text(s.title)
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.textSecondary)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(s.won)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("\(s.leads) leads")
                    .font(.system(size: 10))
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

    private func trendBadge(_ trend: Int) -> some View {
        let color: Color = trend > 0 ? Brand.green : (trend < 0 ? Brand.red : Brand.textTertiary)
        let icon: String = trend > 0 ? "arrow.up" : (trend < 0 ? "arrow.down" : "minus")
        return HStack(spacing: 2) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
            if trend != 0 {
                Text("\(abs(trend))")
                    .font(.system(size: 10, weight: .semibold))
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
        static let textSecondary = Color.white.opacity(0.55)
        static let textTertiary = Color.white.opacity(0.35)
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
                                .font(.system(size: 12, weight: .bold))
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
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(seller.avatarColor)
            }
            .frame(width: 72, height: 72)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(seller.name)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                    if isCurrentUser {
                        Text("Du")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Brand.purpleLight)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Brand.purple.opacity(0.25), in: Capsule())
                    }
                }
                Text(seller.title)
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.textSecondary)
                HStack(spacing: 6) {
                    Image(systemName: "rosette")
                        .font(.system(size: 11, weight: .semibold))
                    Text("Rang #\(seller.rank) i organisasjonen")
                        .font(.system(size: 12, weight: .semibold))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(accent)
                Spacer()
            }
            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.system(size: 11))
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
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(deal.customer)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(deal.category)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Brand.purple.opacity(0.18), in: Capsule())
                    HStack(spacing: 3) {
                        Image(systemName: "mappin")
                            .font(.system(size: 9))
                        Text(deal.city)
                            .font(.system(size: 11))
                    }
                    .foregroundStyle(Brand.textSecondary)
                }
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                Text(nok(deal.value))
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(Brand.green)
                    .monospacedDigit()
                Text(deal.daysAgo == 0 ? "i dag" : "\(deal.daysAgo)d siden")
                    .font(.system(size: 10))
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
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.purpleLight)
                Text(r.city)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(r.count) deals")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Text(String(format: "%.0f %%", r.valueShare * 100))
                    .font(.system(size: 11, weight: .bold))
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
                            .font(.system(size: 12))
                            .foregroundStyle(.white)
                        Spacer()
                        Text("\(ind.count)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                        Text(String(format: "%.0f %%", Double(ind.count) / Double(total) * 100))
                            .font(.system(size: 11))
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
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.textTertiary)
            }
            Spacer()
        }
    }
}


struct SalesLeadershipSheet: View {
    let sellers: [TopSellersSheet.Seller]
    let currentUserName: String
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var tab: Tab = .commission
    @State private var newContestOpen: Bool = false

    // ── Backend-binding (PR #1097 oppfølging) ─────────────────────
    // `loading` = initial fetch i gang (commission/contests/catalog/templates
    // parallelt). `loadError` = vis errorCard m/ Prøv på nytt.
    // `saveError` = vis toast/banner som auto-dismisses etter 3s.
    @State private var loading: Bool = true
    @State private var loadError: String?
    @State private var saveError: String?
    /// Debounced provisjons-lagring — kanselleres ved ny endring.
    @State private var savePending: Task<Void, Never>?
    /// Server-side commission config-payload (raw JSON-Data) — beholdes
    /// så vi kan re-sende m/ kun endrede felter ved neste lagring.
    @State private var commissionConfigData: Data = Data("{}".utf8)
    /// Server-side template-overstyringer (kun for å unngå å miste data
    /// fra felter UI-en ikke eksponerer).
    @State private var serverTemplates: [ContestTemplateDTO] = []

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
    // Mock-eksemplene bruker ikoner siden vi ikke har EKTE produktbilder.
    // Når salgssjefen laster opp via PhotosPicker eller setter URL → vises
    // det ekte bildet (siden det er aktivt valgt og matcher produktet).
    @State private var orgCatalog: [PrizeProduct] = [
        PrizeProduct(name: "Drone DJI Mavic 3",           icon: "airplane",                              priceNok: 18_500, category: .tech,       vendor: "Komplett (org)"),
        PrizeProduct(name: "Org-helgetur til Lofoten",    icon: "mountain.2.fill",                       priceNok: 14_000, category: .travel,     vendor: "Egen avtale"),
        PrizeProduct(name: "Personlig PT-pakke 10 timer", icon: "figure.strengthtraining.traditional",   priceNok: 6_500,  category: .experience, vendor: "Sats (avtale)"),
    ]
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
        static let textSecondary = Color.white.opacity(0.55)
        static let textTertiary = Color.white.opacity(0.35)
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
        /// Server-UUID når konkurransen er persistert. nil = lokal kun.
        var serverID: UUID? = nil
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
            ZStack {
                Brand.bg.ignoresSafeArea()
                if loading {
                    VStack(spacing: 12) {
                        ProgressView()
                            .tint(Brand.purpleLight)
                            .scaleEffect(1.3)
                        Text("Laster salgsledelse …")
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.textSecondary)
                    }
                } else if let loadError {
                    errorCard(loadError)
                        .padding(20)
                } else {
                    mainContent
                }
                if let saveError {
                    VStack {
                        Spacer()
                        saveBanner(saveError)
                            .padding(20)
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .navigationTitle("Salgsledelse")
            .navigationBarTitleDisplayMode(.inline)
            .task { await loadInitial() }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: {
                        ZStack {
                            Circle().fill(Brand.cardHi)
                            Circle().stroke(Brand.stroke, lineWidth: 1)
                            Image(systemName: "xmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                }
                if tab == .contest {
                    ToolbarItem(placement: .primaryAction) {
                        Button { newContestOpen = true } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "plus")
                                    .font(.system(size: 12, weight: .bold))
                                Text("Ny konkurranse")
                                    .font(.system(size: 13, weight: .semibold))
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
                                    .font(.system(size: 12, weight: .bold))
                                Text("Nytt produkt")
                                    .font(.system(size: 13, weight: .semibold))
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
                .environment(appState)
            }
            .sheet(isPresented: $newProductOpen) {
                CustomPrizeSheet(persistToCatalog: true) { product in
                    orgCatalog.append(product)
                    newProductOpen = false
                }
                .environment(appState)
            }
            .sheet(item: $fulfillContest) { c in
                PrizeFulfillmentSheet(contest: c, sellers: sellers)
                    .environment(appState)
            }
        }
    }

    // MARK: Hovedinnhold (vises etter loadInitial)

    private var mainContent: some View {
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
                }
                .padding(20)
            }
        }
    }

    // MARK: Loading + Error UI

    private func errorCard(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Brand.orange)
                Text("Kunne ikke laste salgsledelse")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(Brand.textSecondary)
                .lineLimit(6)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                Task { await loadInitial() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 11, weight: .bold))
                    Text("Prøv på nytt")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, 8)
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
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.orange.opacity(0.4), lineWidth: 1.2))
    }

    private func saveBanner(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Brand.orange)
            Text(message)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(3)
            Spacer()
        }
        .padding(12)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.orange.opacity(0.5), lineWidth: 1))
        .shadow(color: .black.opacity(0.4), radius: 12, x: 0, y: 4)
    }

    // MARK: Backend-mapping

    /// Konverter ContestDTO → lokal Contest (UI-vennlig). Server-feltene
    /// brukes som best-effort fyll; mangler de, beholder vi placeholder.
    private func mapContestDTOToLocal(_ dto: ContestDTO) -> Contest {
        // endsInDays: differensiér ISO-streng mot nå.
        let endsInDays: Int = {
            guard let endsStr = dto.endsAt else { return 0 }
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let date = f.date(from: endsStr) ?? ISO8601DateFormatter().date(from: endsStr)
            guard let d = date else { return 0 }
            let secs = d.timeIntervalSince(Date())
            return max(0, Int(secs / 86400))
        }()
        // prize-summary: ranks fra prizes[].productSnapshot (rå JSON-Data) —
        // best-effort uten å typebinde produkt-strukturen i Swift.
        let prizeText: String = {
            if dto.prizes.isEmpty { return "Premie TBD" }
            return dto.prizes
                .sorted(by: { $0.rank < $1.rank })
                .map { p in
                    if let json = try? JSONSerialization.jsonObject(with: p.productSnapshot) as? [String: Any],
                       let title = (json["title"] as? String) ?? (json["name"] as? String) {
                        return "\(p.rank). \(title)"
                    }
                    return "\(p.rank). plass"
                }
                .joined(separator: " · ")
        }()
        return Contest(
            serverID: dto.id,
            name: dto.name,
            prize: prizeText,
            kpi: dto.kpi,
            endsInDays: endsInDays,
            leaderName: "—",
            leaderValue: "—",
            participants: 0
        )
    }

    /// Konverter OrgPrizeProductDTO → lokal PrizeProduct.
    /// Backend-DTO mapper ikke vendor (catalog-tabellen har det ikke);
    /// vi setter vendor = "Egen" som default.
    private func mapPrizeDTOToLocal(_ dto: OrgPrizeProductDTO) -> PrizeProduct {
        let cat = PrizeCategory(rawValue: dto.category) ?? .voucher
        let fulfillment: FulfillmentMethod? = dto.fulfillmentMethod.flatMap { FulfillmentMethod(rawValue: $0) }
        return PrizeProduct(
            name: dto.name,
            icon: dto.icon.isEmpty ? cat.icon : dto.icon,
            priceNok: dto.priceNok,
            category: cat,
            vendor: dto.vendor ?? "Egen",
            imageURL: dto.imageUrl,
            imageData: nil,
            fulfillment: fulfillment
        )
    }

    /// Anvender server-side commission-config på lokal state. Best-effort
    /// parsing — feilende felter beholder lokal default.
    private func applyCommissionConfig(_ dto: CommissionConfigDTO) {
        // Behold rå Data så vi kan re-sende komplett payload ved neste lagring.
        self.commissionConfigData = dto.config
        if let preset = OrgPreset.allCases.first(where: { $0.rawValue == dto.preset }) {
            self.preset = preset
        }
        let mapped = dto.activeModels.compactMap { ModelType(rawValue: $0) }
        if !mapped.isEmpty {
            self.activeModels = Set(mapped)
        }
        // Forsøk å parse konfig-objektet for kjente felt-navn (best-effort).
        if let cfg = try? JSONSerialization.jsonObject(with: dto.config) as? [String: Any] {
            if let v = (cfg["monthlyTargetK"] as? Double) ?? ((cfg["monthly_target_k"] as? NSNumber)?.doubleValue) {
                self.monthlyTargetK = v
            }
            if let v = (cfg["acceleratorMult"] as? Double) ?? ((cfg["accelerator_mult"] as? NSNumber)?.doubleValue) {
                self.acceleratorMult = v
            }
            if let v = (cfg["acceleratorThreshold"] as? Double) ?? ((cfg["accelerator_threshold"] as? NSNumber)?.doubleValue) {
                self.acceleratorThreshold = v
            }
            if let v = (cfg["recurringPct"] as? Double) ?? ((cfg["recurring_pct"] as? NSNumber)?.doubleValue) {
                self.recurringPct = v
            }
            if let v = (cfg["recurringMonths"] as? Double) ?? ((cfg["recurring_months"] as? NSNumber)?.doubleValue) {
                self.recurringMonths = v
            }
            if let v = (cfg["splitDefaultPrimary"] as? Double) ?? ((cfg["split_default_primary"] as? NSNumber)?.doubleValue) {
                self.splitDefaultPrimary = v
            }
            if let v = (cfg["marginPct"] as? Double) ?? ((cfg["margin_pct"] as? NSNumber)?.doubleValue) {
                self.marginPct = v
            }
            if let v = (cfg["perActivityNok"] as? Double) ?? ((cfg["per_activity_nok"] as? NSNumber)?.doubleValue) {
                self.perActivityNok = v
            }
            if let v = (cfg["teamPoolPct"] as? Double) ?? ((cfg["team_pool_pct"] as? NSNumber)?.doubleValue) {
                self.teamPoolPct = v
            }
            if let v = (cfg["hybridBaseK"] as? Double) ?? ((cfg["hybrid_base_k"] as? NSNumber)?.doubleValue) {
                self.hybridBaseK = v
            }
            if let v = (cfg["hybridDealThresholdK"] as? Double) ?? ((cfg["hybrid_deal_threshold_k"] as? NSNumber)?.doubleValue) {
                self.hybridDealThresholdK = v
            }
        }
    }

    /// Lagre kun referansen — server-templates brukes av contest-fanen
    /// indirekte (vi kjører lokalt mal-bibliotek for nå).
    private func applyTemplates(_ dtos: [ContestTemplateDTO]) {
        self.serverTemplates = dtos
    }

    // MARK: Backend-load

    private func loadInitial() async {
        guard let api = appState.api else {
            // Ingen API — bli stående på lokal mock-state. Skjul spinner.
            self.loading = false
            return
        }
        self.loading = true
        self.loadError = nil
        defer { self.loading = false }
        do {
            async let cfgTask = api.fetchCommissionConfig()
            async let contestsTask = api.fetchContests(status: nil)
            async let catalogTask = api.fetchOrgPrizeCatalog()
            async let templatesTask = api.fetchContestTemplates()
            // 404 / fall-tilbake-til-default skal IKKE blokkere de andre.
            let cfg: CommissionConfigDTO? = try? await cfgTask
            let contestList: [ContestDTO] = (try? await contestsTask) ?? []
            let catalog: [OrgPrizeProductDTO] = (try? await catalogTask) ?? []
            let templates: [ContestTemplateDTO] = (try? await templatesTask) ?? []
            await MainActor.run {
                if let cfg { self.applyCommissionConfig(cfg) }
                let mapped = contestList.map(self.mapContestDTOToLocal)
                if !mapped.isEmpty { self.contests = mapped }
                let mappedCatalog = catalog.map(self.mapPrizeDTOToLocal)
                if !mappedCatalog.isEmpty { self.orgCatalog = mappedCatalog }
                self.applyTemplates(templates)
            }
        }
    }

    // MARK: Provisjons-lagring (debounced)

    /// Schedule en debounced save av provisjons-konfig. Cancel-erer
    /// forrige task så slidere/toggles flomly-fly ikke spammer endpoint.
    private func scheduleSave() {
        savePending?.cancel()
        savePending = Task {
            try? await Task.sleep(nanoseconds: 800_000_000)
            if Task.isCancelled { return }
            await saveCommissionConfigToBackend()
        }
    }

    private func currentCommissionConfigDTO() -> CommissionConfigDTO {
        // Slå sammen kjente UI-verdier inn i server-konfig-objektet
        // (behold ukjente felter fra server).
        var base: [String: Any] = (try? JSONSerialization.jsonObject(with: commissionConfigData) as? [String: Any]) ?? [:]
        base["monthlyTargetK"] = monthlyTargetK
        base["acceleratorMult"] = acceleratorMult
        base["acceleratorThreshold"] = acceleratorThreshold
        base["recurringPct"] = recurringPct
        base["recurringMonths"] = recurringMonths
        base["splitDefaultPrimary"] = splitDefaultPrimary
        base["marginPct"] = marginPct
        base["perActivityNok"] = perActivityNok
        base["teamPoolPct"] = teamPoolPct
        base["hybridBaseK"] = hybridBaseK
        base["hybridDealThresholdK"] = hybridDealThresholdK
        base["tieredBands"] = tieredBands.map { ["fromK": $0.fromK, "pct": $0.pct] }
        base["spiffs"] = spiffs.map { ["trigger": $0.trigger, "amountNok": $0.amountNok] }
        base["tiers"] = tiers.map { ["category": $0.category, "basePct": $0.basePct, "bonusPct": $0.bonusPct] }
        let data = (try? JSONSerialization.data(withJSONObject: base)) ?? Data("{}".utf8)
        return CommissionConfigDTO(
            preset: preset.rawValue,
            activeModels: Array(activeModels).map(\.rawValue),
            config: data
        )
    }

    private func saveCommissionConfigToBackend() async {
        guard let api = appState.api else { return }
        let dto = currentCommissionConfigDTO()
        do {
            try await api.saveCommissionConfig(dto)
            await MainActor.run {
                // Behold sist-sendt config slik at server-shape ikke driftes.
                self.commissionConfigData = dto.config
            }
        } catch {
            await MainActor.run {
                self.saveError = "Lagring feilet: \(error.localizedDescription)"
            }
            // Auto-dismiss banner etter 3s
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await MainActor.run { self.saveError = nil }
            }
        }
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { t in
                Button { tab = t } label: {
                    HStack(spacing: 6) {
                        Image(systemName: t.icon)
                            .font(.system(size: 12, weight: .semibold))
                        Text(t.rawValue)
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(tab == t ? .white : Brand.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
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
        .padding(.horizontal, 20)
        .padding(.top, 12)
    }

    // MARK: Provisjon

    private var commissionTab: some View {
        VStack(spacing: 16) {
            commissionExplain
            presetPickerCard
            modelLibraryCard
            sellerOverrideCard
        }
        // Debounce-save på alle slider-verdier i provisjons-fanen.
        // `.onChange` på primitive-double trigger ved hver step, men
        // `scheduleSave()` debouncer i 800ms.
        .onChange(of: monthlyTargetK) { _, _ in scheduleSave() }
        .onChange(of: acceleratorMult) { _, _ in scheduleSave() }
        .onChange(of: acceleratorThreshold) { _, _ in scheduleSave() }
        .onChange(of: recurringPct) { _, _ in scheduleSave() }
        .onChange(of: recurringMonths) { _, _ in scheduleSave() }
        .onChange(of: splitDefaultPrimary) { _, _ in scheduleSave() }
        .onChange(of: marginPct) { _, _ in scheduleSave() }
        .onChange(of: perActivityNok) { _, _ in scheduleSave() }
        .onChange(of: teamPoolPct) { _, _ in scheduleSave() }
        .onChange(of: hybridBaseK) { _, _ in scheduleSave() }
        .onChange(of: hybridDealThresholdK) { _, _ in scheduleSave() }
        .onChange(of: tiers) { _, _ in scheduleSave() }
        .onChange(of: tieredBands) { _, _ in scheduleSave() }
        .onChange(of: spiffs) { _, _ in scheduleSave() }
    }

    private var presetPickerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "building.2.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Org-preset")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Ulike organisasjoner kjører ulike modeller — start med et preset")
                        .font(.system(size: 11))
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
                            scheduleSave()
                        } label: {
                            Text(p.rawValue)
                                .font(.system(size: 12, weight: .semibold))
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
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.green)
                Text("\(activeModels.count) modeller aktive — de stables på hver deal")
                    .font(.system(size: 11))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Modell-bibliotek")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(ModelType.allCases.count) typer")
                    .font(.system(size: 11))
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
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(isActive ? t.accent : Brand.textTertiary)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.title)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(t.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                        .lineLimit(2)
                }
                Spacer()
                Toggle("", isOn: Binding(
                    get: { activeModels.contains(t) },
                    set: { on in
                        if on { activeModels.insert(t) } else { activeModels.remove(t) }
                        preset = .custom  // bryter du presetet → custom
                        scheduleSave()
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
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
            ForEach($tieredBands) { $band in
                HStack(spacing: 8) {
                    Image(systemName: "stairs")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(ModelType.tiered.accent)
                        .frame(width: 24)
                    Text(String(format: "Fra %.0fK NOK", band.fromK))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 4) {
                        Button {
                            if band.pct > 0.5 { band.pct -= 0.5 }
                        } label: {
                            Image(systemName: "minus")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 20, height: 20)
                                .background(Brand.stroke, in: Circle())
                        }
                        .buttonStyle(.plain)
                        Text(String(format: "%.1f %%", band.pct))
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(ModelType.tiered.accent)
                            .monospacedDigit()
                            .frame(width: 56)
                        Button {
                            band.pct += 0.5
                        } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 9, weight: .bold))
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
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.2f×", acceleratorMult))
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.accelerator.accent)
                    .monospacedDigit()
            }
            Slider(value: $acceleratorMult, in: 1.1...3.0, step: 0.05)
                .tint(ModelType.accelerator.accent)
            HStack {
                Text("Aktiveres ved")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0f %% av mål", acceleratorThreshold))
                    .font(.system(size: 13, weight: .bold))
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
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.1f %%", recurringPct))
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.recurring.accent)
                    .monospacedDigit()
            }
            Slider(value: $recurringPct, in: 1...30, step: 0.5)
                .tint(ModelType.recurring.accent)
            HStack {
                Text("Varighet")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0f mnd", recurringMonths))
                    .font(.system(size: 13, weight: .bold))
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
                        .font(.system(size: 11))
                        .foregroundStyle(ModelType.spiff.accent)
                        .frame(width: 22)
                    Text(rule.trigger)
                        .font(.system(size: 12))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(1)
                    HStack(spacing: 4) {
                        Button {
                            if rule.amountNok > 500 { rule.amountNok -= 500 }
                        } label: {
                            Image(systemName: "minus")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 20, height: 20)
                                .background(Brand.stroke, in: Circle())
                        }
                        .buttonStyle(.plain)
                        Text("\(Int(rule.amountNok)) kr")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(ModelType.spiff.accent)
                            .monospacedDigit()
                            .frame(width: 76)
                        Button {
                            rule.amountNok += 500
                        } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 9, weight: .bold))
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
            Button {} label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 11))
                    Text("Legg til spiff-regel")
                        .font(.system(size: 11, weight: .semibold))
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
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0f / %.0f", splitDefaultPrimary, 100 - splitDefaultPrimary))
                    .font(.system(size: 14, weight: .bold, design: .rounded))
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
                .font(.system(size: 10))
                .foregroundStyle(Brand.textSecondary)
            Text(String(format: "%.0f %%", pct))
                .font(.system(size: 14, weight: .bold, design: .rounded))
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
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.1f %%", marginPct))
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.margin.accent)
                    .monospacedDigit()
            }
            Slider(value: $marginPct, in: 5...60, step: 1)
                .tint(ModelType.margin.accent)
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                Text("Krever at deal-marginen er registrert i CRM")
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.textTertiary)
            }
        }
    }

    private var perActivityConfig: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Per kvalifisert aktivitet")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text("\(Int(perActivityNok)) kr")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
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
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(color.opacity(0.15), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
    }

    private var teamPoolConfig: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Pott av team-omsetning")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.1f %%", teamPoolPct))
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.teamPool.accent)
                    .monospacedDigit()
            }
            Slider(value: $teamPoolPct, in: 1...15, step: 0.5)
                .tint(ModelType.teamPool.accent)
            HStack(spacing: 6) {
                Image(systemName: "person.3.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                Text("Hele teamets sum: ca \(Int(teamPoolPct * 100 / 5 * 8))K NOK/mnd ved 8M omsetning")
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.textTertiary)
            }
        }
    }

    private var hybridConfig: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Garantilønn")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0fK / mnd", hybridBaseK))
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(ModelType.hybridBase.accent)
                    .monospacedDigit()
            }
            Slider(value: $hybridBaseK, in: 20...80, step: 1)
                .tint(ModelType.hybridBase.accent)
            HStack {
                Text("Komisjon over")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.0fK NOK", hybridDealThresholdK))
                    .font(.system(size: 13, weight: .bold))
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
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text("Provisjons-modell")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Selgere får base-sats per deal-kategori. Når selger passerer måneds-terskelen, økes alle deals samme måned til bonus-sats.")
                    .font(.system(size: 12))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Satser per kategori")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button {} label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 10, weight: .bold))
                        Text("Legg til")
                            .font(.system(size: 11, weight: .semibold))
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
                .font(.system(size: 13, weight: .semibold))
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
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Brand.textTertiary)
            HStack(spacing: 4) {
                Button {
                    if value.wrappedValue > 0.5 {
                        value.wrappedValue -= 0.5
                    }
                } label: {
                    Image(systemName: "minus")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 20, height: 20)
                        .background(Brand.stroke, in: Circle())
                }
                .buttonStyle(.plain)
                Text(String(format: "%.1f %%", value.wrappedValue))
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(color)
                    .monospacedDigit()
                    .frame(width: 50)
                Button {
                    value.wrappedValue += 0.5
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 9, weight: .bold))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.yellow)
                Text("Bonus-terskel")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text(String(format: "%.0f K", monthlyTargetK))
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(Brand.yellow)
                    .monospacedDigit()
            }
            Slider(value: $monthlyTargetK, in: 100...2000, step: 50)
                .tint(Brand.yellow)
            HStack {
                Text("100K")
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                Spacer()
                Text("2M")
                    .font(.system(size: 10))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Override per selger")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("3 aktive")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
            }
            Text("Spesielle satser for utvalgte selgere (f.eks. trainees, partner-selgere).")
                .font(.system(size: 11))
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
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 1) {
                Text(name)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Text(rule)
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.textSecondary)
                    .lineLimit(1)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .bold))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Konkurranse-maler")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Org-en din kjører \(contestTemplatesForPreset.count) av \(ContestTemplateType.allCases.count) typer")
                        .font(.system(size: 11))
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
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(active ? t.accent : Brand.textTertiary)
                    }
                    .frame(width: 30, height: 30)
                    Spacer()
                    if active {
                        Text("AKTIV")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(t.accent)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(t.accent.opacity(0.18), in: Capsule())
                    }
                }
                Text(t.title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(active ? .white : Brand.textSecondary)
                    .lineLimit(1)
                Text(t.subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 6) {
                    Image(systemName: "clock")
                        .font(.system(size: 9))
                    Text("\(t.defaultDays) dager")
                        .font(.system(size: 10, weight: .semibold))
                    Spacer()
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 11))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Aktive nå (\(contests.count))")
                    .font(.system(size: 14, weight: .bold))
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
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(color)
            Text(value)
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 10))
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
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Brand.yellow)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(c.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text(c.kpi)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                }
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: ended ? "checkmark.circle.fill" : "clock.fill")
                        .font(.system(size: 10, weight: .semibold))
                    Text(ended ? "Ferdig" : "\(c.endsInDays)d")
                        .font(.system(size: 11, weight: .bold))
                        .monospacedDigit()
                }
                .foregroundStyle(urgencyColor)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(urgencyColor.opacity(0.15), in: Capsule())
                .overlay(Capsule().stroke(urgencyColor.opacity(0.5), lineWidth: 1))
            }
            HStack(spacing: 6) {
                Image(systemName: "gift.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.yellow)
                Text(c.prize)
                    .font(.system(size: 12))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            Divider().overlay(Brand.stroke)
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("LEDER")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Brand.textTertiary)
                    Text(c.leaderName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.yellow)
                    Text(c.leaderValue)
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("DELTAKERE")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Brand.textTertiary)
                    Text("\(c.participants)")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
                if ended {
                    Button { fulfillContest = c } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "gift.fill")
                                .font(.system(size: 10, weight: .bold))
                            Text("Tildel premier")
                                .font(.system(size: 11, weight: .semibold))
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
                    Button {} label: {
                        Text("Se rangering")
                            .font(.system(size: 11, weight: .semibold))
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
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text("Egne produkter for org-en din")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Standard-katalogen dekker det meste, men du kan legge til produkter org-en har egne avtaler på (f.eks. drone-leverandør, hytteutleier, SATS-medlemskap).")
                    .font(.system(size: 12))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(deletable ? Brand.green : Brand.purpleLight)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.textTertiary)
                }
                Spacer()
            }
            if products.isEmpty {
                Text("Ingen egne produkter enda. Tap «Nytt produkt» øverst.")
                    .font(.system(size: 12))
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
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 28, height: 28)
                            .background(Color.red.opacity(0.8), in: Circle())
                            .overlay(Circle().stroke(Color.white.opacity(0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .padding(6)
                } else {
                    Text("STANDARD")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Color.black.opacity(0.55), in: Capsule())
                        .overlay(Capsule().stroke(Color.white.opacity(0.3), lineWidth: 0.5))
                        .padding(6)
                }
            }
            Text(p.name)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 4) {
                Text(p.category.rawValue)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(p.category.color)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(p.category.color.opacity(0.15), in: Capsule())
                Spacer(minLength: 0)
            }
            HStack {
                Text(PrizeCatalog.formattedPrice(p.priceNok))
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Spacer()
                if let v = p.vendor {
                    Text(v)
                        .font(.system(size: 9))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Team-mål denne måneden")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text(String(format: "%.0f %%", progress * 100))
                    .font(.system(size: 14, weight: .bold))
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
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Text(String(format: "Mål: %.1fM NOK", teamMonthlyGoalK / 1000))
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
            }
            HStack {
                Text("Juster mål")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textSecondary)
                Spacer()
                Text(String(format: "%.1f M NOK", teamMonthlyGoalK / 1000))
                    .font(.system(size: 12, weight: .bold))
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
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                Text("Individuelle mål")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(sellers.count) selgere")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.textSecondary)
            }
            VStack(spacing: 8) {
                ForEach(sellers.prefix(6)) { s in
                    individualGoalRow(s)
                }
            }
            Button {} label: {
                HStack {
                    Spacer()
                    Text("Se alle \(sellers.count) selgere")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .bold))
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
        // Mock: individuelt mål = total verdi / 0.5 (skal nå 50% mer)
        let goal = s.totalValue * 1.5
        let progress = min(1.0, s.totalValue / goal)
        return HStack(spacing: 12) {
            ZStack {
                Circle().fill(s.avatarColor.opacity(0.3))
                Text(s.name.split(separator: " ").prefix(2).map { String($0.prefix(1)) }.joined().uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(s.avatarColor)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(s.name)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer()
                    Text(String(format: "%.0f %%", progress * 100))
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(progress >= 1.0 ? Brand.green : Brand.yellow)
                        .monospacedDigit()
                }
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
                                .font(.system(size: iconSize, weight: .semibold))
                                .foregroundStyle(product.category.color)
                        @unknown default:
                            Image(systemName: product.icon)
                                .font(.system(size: iconSize, weight: .semibold))
                                .foregroundStyle(product.category.color)
                        }
                    }
                } else {
                    Image(systemName: product.icon)
                        .font(.system(size: iconSize, weight: .semibold))
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
    @Environment(AppState.self) private var appState
    @State private var name: String = ""
    @State private var kpi: String = "Mest vunnet NOK"
    @State private var days: Double = 14
    @State private var prizes: [PrizeTier] = []
    @State private var pickerOpen: Bool = false
    @State private var pickerForRank: Int = 1
    @State private var saving: Bool = false
    @State private var saveError: String?

    private enum Brand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
        static let textSecondary = Color.white.opacity(0.55)
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
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Brand.textSecondary)
                        VStack(spacing: 6) {
                            ForEach(kpiOptions, id: \.self) { opt in
                                Button { kpi = opt } label: {
                                    HStack {
                                        Image(systemName: kpi == opt ? "largecircle.fill.circle" : "circle")
                                            .font(.system(size: 14))
                                            .foregroundStyle(kpi == opt ? Brand.purpleLight : Brand.stroke)
                                        Text(opt)
                                            .font(.system(size: 13))
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
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Brand.textSecondary)
                            Spacer()
                            Text("\(Int(days)) dager")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Brand.yellow)
                                .monospacedDigit()
                        }
                        Slider(value: $days, in: 3...60, step: 1)
                            .tint(Brand.yellow)
                    }
                    .padding(14)
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))

                    if let saveError {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(Color.orange)
                            Text(saveError)
                                .font(.system(size: 11))
                                .foregroundStyle(.white)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.orange.opacity(0.5), lineWidth: 1))
                    }
                    Button {
                        Task { await launchContest() }
                    } label: {
                        HStack(spacing: 8) {
                            if saving {
                                ProgressView()
                                    .tint(.white)
                                    .scaleEffect(0.8)
                            }
                            Text(saving ? "Lanserer …" : "Lanser konkurranse")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(.white)
                        }
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
                    .disabled(saving)
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
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.yellow)
                Text("Premier")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(prizes.count) av 3 plasser")
                    .font(.system(size: 11))
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
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(rankColor(rank))
                }
                .frame(width: 32, height: 32)
                if let tier = existing {
                    PrizeImageView(product: tier.product, cornerRadius: 8, iconSize: 16)
                        .frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tier.product.name)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        HStack(spacing: 6) {
                            Text(tier.product.category.rawValue)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(tier.product.category.color)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(tier.product.category.color.opacity(0.15), in: Capsule())
                            Text(PrizeCatalog.formattedPrice(tier.product.priceNok))
                                .font(.system(size: 10))
                                .foregroundStyle(Brand.textSecondary)
                                .monospacedDigit()
                        }
                    }
                    Spacer()
                    Button {
                        prizes.removeAll { $0.rank == rank }
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.red.opacity(0.8))
                            .frame(width: 28, height: 28)
                            .background(Color.red.opacity(0.12), in: Circle())
                    }
                    .buttonStyle(.plain)
                } else {
                    Text("\(rank).plass — velg premie")
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.textSecondary)
                    Spacer()
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 16))
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
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(t.accent)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text("Mal: \(t.title)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text(t.subtitle)
                    .font(.system(size: 11))
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
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
            TextField("", text: text, prompt: Text(placeholder).foregroundColor(.white.opacity(0.3)))
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 12)
                .background(Brand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Brand.stroke, lineWidth: 1))
        }
    }

    // MARK: Backend-call

    /// Lager konkurransen på server hvis api er tilgjengelig; ellers
    /// faller den til lokal-only m/ samme Contest-objekt (mock-modus).
    private func launchContest() async {
        let effectiveName = name.isEmpty ? "Ny konkurranse" : name
        let templateType = template?.rawValue ?? "custom"
        let endsAt = Date().addingTimeInterval(TimeInterval(Int(days) * 86400))

        // Bygg payload-premier fra prizes (PrizeTier → CreateContestPrizePayload).
        // productSnapshot serialiseres som JSON-objekt m/ kjente felter slik
        // at backend kan lagre snapshot + bruke i fulfillment-flyt.
        let prizePayloads: [CreateContestPrizePayload] = prizes.map { tier in
            let p = tier.product
            let snapshot: [String: Any] = [
                "id": p.id.uuidString,
                "name": p.name,
                "title": p.name,
                "icon": p.icon,
                "category": p.category.rawValue,
                "estimated_value_nok": p.priceNok,
                "priceNok": p.priceNok,
                "vendor": p.vendor ?? "",
                "image_url": p.imageURL ?? "",
                "fulfillment_type": (p.fulfillment ?? FulfillmentMethod.defaultFor(p.category)).rawValue,
            ]
            let data = (try? JSONSerialization.data(withJSONObject: snapshot)) ?? Data("{}".utf8)
            return CreateContestPrizePayload(rank: tier.rank, productSnapshot: data)
        }

        let payload = CreateContestPayload(
            name: effectiveName,
            templateType: templateType,
            kpi: kpi,
            kpiConfig: nil,
            endsAt: endsAt,
            prizes: prizePayloads
        )

        await MainActor.run { saving = true; saveError = nil }
        defer { Task { @MainActor in saving = false } }

        // Bygg fall-back lokal Contest m/ aktuelle felt.
        let fallback = SalesLeadershipSheet.Contest(
            name: effectiveName,
            prize: prizeSummary,
            kpi: kpi,
            endsInDays: Int(days),
            leaderName: "—",
            leaderValue: "—",
            participants: 0
        )

        guard let api = appState.api else {
            // Ingen api = mock-modus. Beholde tidligere oppførsel.
            await MainActor.run { onSave(fallback) }
            return
        }
        do {
            let dto = try await api.createContest(payload)
            await MainActor.run {
                var c = fallback
                c.serverID = dto.id
                onSave(c)
            }
        } catch {
            await MainActor.run {
                saveError = "Kunne ikke lagre: \(error.localizedDescription)"
            }
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
        static let textSecondary = Color.white.opacity(0.55)
        static let textTertiary = Color.white.opacity(0.35)
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
                                .font(.system(size: 11, weight: .bold))
                            Text("Egen")
                                .font(.system(size: 12, weight: .semibold))
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
                // persistToCatalog=false: vi brukt CustomPrizeSheet for engangs-
                // premie via picker; produktet returneres lokalt og brukes kun
                // i den ene konkurranse-konfiguren.
                CustomPrizeSheet(persistToCatalog: false) { product in
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
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(rankColor)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text("Premie til \(rankLabel)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Velg fra katalog — \(PrizeCatalog.all.count) produkter")
                    .font(.system(size: 11))
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
                    .font(.system(size: 10, weight: .semibold))
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
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
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 4) {
                    Text(p.category.rawValue)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(p.category.color)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(p.category.color.opacity(0.15), in: Capsule())
                    if let v = p.vendor {
                        Text(v)
                            .font(.system(size: 9))
                            .foregroundStyle(Brand.textTertiary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                Text(PrizeCatalog.formattedPrice(p.priceNok))
                    .font(.system(size: 12, weight: .bold, design: .rounded))
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
    /// `true` = persistér til org-katalog via API (POST /prize-catalog) FØR
    /// `onSave` kalles. `false` = returner kun lokalt PrizeProduct
    /// (engangs-bruk fra PrizePickerSheet).
    var persistToCatalog: Bool = false
    let onSave: (PrizeProduct) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var name: String = ""
    @State private var category: PrizeCategory = .tech
    @State private var priceText: String = ""
    @State private var imageURL: String = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var photoData: Data?
    @State private var saving: Bool = false
    @State private var saveError: String?

    private enum Brand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
        static let textSecondary = Color.white.opacity(0.55)
        static let textTertiary = Color.white.opacity(0.35)
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
                .font(.system(size: 12, weight: .semibold))
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
                        .font(.system(size: 13, weight: .semibold))
                    Text(photoData == nil ? "Velg bilde fra galleriet" : "Bytt bilde")
                        .font(.system(size: 13, weight: .semibold))
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
                    .font(.system(size: 10, weight: .semibold))
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
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(PrizeCategory.allCases) { c in
                        Button { category = c } label: {
                            HStack(spacing: 5) {
                                Image(systemName: c.icon)
                                    .font(.system(size: 10, weight: .semibold))
                                Text(c.rawValue)
                                    .font(.system(size: 11, weight: .semibold))
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

    @ViewBuilder
    private var saveButton: some View {
        if let saveError {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Color.orange)
                Text(saveError)
                    .font(.system(size: 11))
                    .foregroundStyle(.white)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.orange.opacity(0.5), lineWidth: 1))
        }
        Button {
            Task { await persistAndReturn() }
        } label: {
            HStack(spacing: 8) {
                if saving {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.8)
                }
                Text(saving ? "Lagrer …" : (persistToCatalog ? "Legg til i katalog" : "Bruk denne premien"))
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
            }
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
        .disabled(name.isEmpty || saving)
        .opacity((name.isEmpty || saving) ? 0.5 : 1)
    }

    /// Lagrer til katalog (hvis `persistToCatalog == true` og api tilgj.),
    /// uploads bilde først hvis vi har photoData, og returnerer deretter
    /// PrizeProduct til caller. Engangs-bruk = bare returner uten persist.
    private func persistAndReturn() async {
        await MainActor.run { saving = true; saveError = nil }
        defer { Task { @MainActor in saving = false } }

        var product = preview
        guard persistToCatalog, let api = appState.api else {
            // Engangs-bruk eller ikke logget inn: returner produktet som-er.
            await MainActor.run { onSave(product) }
            return
        }

        // 1) Last opp bilde først (hvis vi har lokal Data) → URL + B2-key.
        var uploadedURL: String? = product.imageURL
        var uploadedKey: String?
        if let data = photoData {
            do {
                let (url, key) = try await api.uploadPrizeImage(data: data, mimeType: "image/jpeg")
                uploadedURL = url
                uploadedKey = key
            } catch {
                // Bilde-opplasting feilet → fortsetter uten bilde, men logg.
                print("[CustomPrizeSheet] image upload failed: \(error)")
            }
        }

        // 2) Lagre i org-katalog.
        let fulfillment = (product.fulfillment ?? FulfillmentMethod.defaultFor(category)).rawValue
        let payload = OrgPrizeProductCreatePayload(
            name: product.name,
            icon: product.icon,
            category: category.rawValue,
            priceNok: Int(priceText) ?? 0,
            vendor: "Egen",
            imageUrl: uploadedURL,
            imageB2Key: uploadedKey,
            fulfillmentMethod: fulfillment
        )
        do {
            _ = try await api.createPrizeProduct(payload)
        } catch {
            await MainActor.run {
                saveError = "Lagring feilet: \(error.localizedDescription)"
            }
            return
        }
        // 3) Returner lokal-versjon (eventuelt m/ ny URL fra opplasting).
        if let uploadedURL { product.imageURL = uploadedURL }
        await MainActor.run { onSave(product) }
    }

    private func formField(label: String, placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
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
    @Environment(AppState.self) private var appState
    @State private var loading: Bool = false
    @State private var loadError: String?
    @State private var advancing: Set<UUID> = []
    /// Cache av team-members for å mappe `award.userId` → menneske-navn.
    /// Lastes parallelt med awards i `loadAwards()`.
    @State private var teamMembers: [SalesTeamMemberDTO] = []

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
        static let textSecondary = Color.white.opacity(0.55)
        static let textTertiary = Color.white.opacity(0.35)
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
        /// Map backend-status til UI-Step. `awaiting_address` mappes til
        /// `pending` (UI viser samme stadium; backend håndterer adresse-flyt).
        static func fromBackend(_ raw: String) -> Step {
            switch raw {
            case "pending", "awaiting_address": return .pending
            case "ordered":                     return .ordered
            case "shipped":                     return .shipped
            case "received":                    return .received
            default:                            return .pending
            }
        }
    }

    struct Award: Identifiable {
        let id = UUID()
        /// Server-UUID (sales_prize_awards.id) — nil = lokal-only.
        var serverID: UUID? = nil
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
                                .font(.system(size: 12, weight: .bold))
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
            .task { await loadAwards() }
        }
    }

    /// Hent fulfillment-tildelinger fra server. Hvis konkurransen ikke er
    /// closed enda, kall `closeContest()` først (oppretter award-rader).
    /// Faller tilbake til lokal mock hvis api/server-ID mangler.
    ///
    /// Henter også team-members parallelt så `mapAwardDTOToLocal` kan
    /// slå opp vinner-NAVN (i stedet for «Vinner #abc123»).
    private func loadAwards() async {
        // Hvis vi mangler server-ID for konkurransen, fall direkte til seed-mock.
        guard let api = appState.api, let serverID = contest.serverID else {
            await MainActor.run { seedMockAwards() }
            return
        }
        await MainActor.run { loading = true; loadError = nil }
        defer { Task { @MainActor in loading = false } }

        // Last team-members i bakgrunnen (best-effort — feiler stille
        // siden award-mapping har egen fallback til "Vinner #suffix").
        async let membersTask: SalesTeamMembersResponse? = {
            do { return try await api.fetchSalesTeamMembers() }
            catch {
                print("[PrizeFulfillmentSheet] team-members fetch failed: \(error)")
                return nil
            }
        }()

        do {
            // Hent server-awards filtrert til denne konkurransen (org-wide).
            var fetched = try await api.fetchAwards(status: nil, orgWide: true)
                .filter { $0.contestId == serverID }

            // Hvis tom (konkurransen ikke close'd enda), lukk + hent på nytt.
            if fetched.isEmpty {
                _ = try? await api.closeContest(id: serverID)
                fetched = try await api.fetchAwards(status: nil, orgWide: true)
                    .filter { $0.contestId == serverID }
            }
            // Vent på members (kan være nil ved feil).
            let membersResp = await membersTask
            await MainActor.run {
                self.teamMembers = membersResp?.members ?? []
                if !fetched.isEmpty {
                    self.awards = fetched.map(mapAwardDTOToLocal)
                } else {
                    // Server returnerte ingenting; vis topp-3 mock som fall-back.
                    seedMockAwards()
                }
            }
        } catch {
            // Selv ved award-feil — sett teamMembers så seed-mock kan
            // også bruke det (om relevant).
            let membersResp = await membersTask
            await MainActor.run {
                self.teamMembers = membersResp?.members ?? []
                self.loadError = "\(error.localizedDescription)"
                seedMockAwards()
            }
        }
    }

    /// Map server-DTO → lokal Award. winnerName slås opp via teamMembers
    /// (server-svar) FØRST, deretter sellers-listen (lokal/mock), og til
    /// slutt fallback `Vinner #<userId-prefix>` om ingen match finnes.
    private func mapAwardDTOToLocal(_ dto: PrizeAwardDTO) -> Award {
        // 1) Server-svar (teamMembers): autoritativ kilde for userId → navn.
        let nameFromMembers = teamMembers.first { $0.userId == dto.userId }?.name
        // 2) Fall til sellers-listen (matcher Seller.userId først, ellers
        //    første seller — for å gi en konsistent avatar-farge).
        let sellerByUserId = sellers.first { $0.userId == dto.userId }
        let winnerName = nameFromMembers
            ?? sellerByUserId?.name
            ?? "Vinner #\(dto.userId.prefix(6))"
        let winnerColor = sellerByUserId?.avatarColor
            ?? sellers.first?.avatarColor
            ?? Color.purple
        // Bygg PrizeProduct fra productSnapshot (rå JSON-Data) — best-effort.
        let snapshot = (try? JSONSerialization.jsonObject(with: dto.productSnapshot) as? [String: Any]) ?? [:]
        let title = (snapshot["title"] as? String) ?? (snapshot["name"] as? String) ?? "Premie"
        let catRaw = (snapshot["category"] as? String) ?? "voucher"
        let priceNok = (snapshot["estimated_value_nok"] as? Int)
            ?? (snapshot["priceNok"] as? Int)
            ?? Int(((snapshot["estimated_value_nok"] as? NSNumber)?.doubleValue ?? 0))
        let cat = PrizeCategory(rawValue: catRaw) ?? .voucher
        let fulfillRaw = (snapshot["fulfillment_type"] as? String) ?? dto.fulfillmentMethod
        let fulfill = FulfillmentMethod(rawValue: fulfillRaw)
        let product = PrizeProduct(
            name: title,
            icon: (snapshot["icon"] as? String) ?? cat.icon,
            priceNok: priceNok,
            category: cat,
            vendor: snapshot["vendor"] as? String,
            imageURL: snapshot["image_url"] as? String,
            imageData: nil,
            fulfillment: fulfill
        )
        // Rank kan vi ikke utlede fra DTO (server lagrer det separat); bruk
        // award-status-ordering som fallback (1./2./3.plass i tildelings-rekkefølge).
        return Award(
            serverID: dto.id,
            rank: 1,
            winnerName: winnerName,
            winnerAvatar: winnerColor,
            product: product,
            currentStep: Step.fromBackend(dto.status)
        )
    }

    private func seedMockAwards() {
        guard awards.isEmpty else { return }
        let topThree = Array(sellers.prefix(3))
        // Plukk realistiske premier basert på konkurranse-navnet
        let products: [PrizeProduct] = [
            PrizeCatalog.all.first { $0.name == "iPad Pro 11\"" } ?? PrizeCatalog.all[0],
            PrizeCatalog.all.first { $0.name == "AirPods Pro" } ?? PrizeCatalog.all[1],
            PrizeCatalog.all.first { $0.name == "Restaurant-gavekort 3 000 kr" } ?? PrizeCatalog.all[2],
        ]
        awards = zip(topThree.indices, topThree).map { i, s in
            Award(serverID: nil,
                  rank: i + 1,
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
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Brand.yellow)
            }
            .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 3) {
                Text(contest.name)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text(contest.kpi)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.green)
                    Text("Konkurransen er avsluttet — tildel premier")
                        .font(.system(size: 11))
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
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text("Slik tildeles premier")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text("Leadgrid orkestrerer hele leveransen ut fra fulfillment-metoden. Du klikker «Tildel» — vinneren får e-post med neste steg (adresse, e-gavekort, booking-lenke).")
                    .font(.system(size: 12))
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
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(a.winnerAvatar)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.winnerName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text("Vinner — \(a.rank).plass")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
                Spacer()
                PrizeImageView(product: a.product, cornerRadius: 10, iconSize: 22)
                    .frame(width: 56, height: 56)
            }
            // Premie + fulfillment-metode
            HStack(spacing: 8) {
                Image(systemName: "gift.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.yellow)
                Text(a.product.name)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer()
                Text(PrizeCatalog.formattedPrice(a.product.priceNok))
                    .font(.system(size: 11, weight: .bold))
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
                .font(.system(size: 14, weight: .bold, design: .rounded))
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
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Brand.purpleLight)
            VStack(alignment: .leading, spacing: 1) {
                Text(m.title)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                Text(m.subtitle)
                    .font(.system(size: 10))
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
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(isDone ? .white : Brand.textTertiary)
                    }
                    .frame(width: 26, height: 26)
                    Text(step.rawValue)
                        .font(.system(size: 9, weight: .semibold))
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
        let isAdvancing = advancing.contains(a.id)
        return Button {
            Task { await advanceLocalAward(award: award) }
        } label: {
            HStack(spacing: 6) {
                if isAdvancing {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.7)
                } else {
                    Image(systemName: a.currentStep == .received ? "checkmark.seal.fill" : "arrow.right.circle.fill")
                        .font(.system(size: 12, weight: .bold))
                }
                Text(cta)
                    .font(.system(size: 12, weight: .bold))
                Spacer()
                if next != nil {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .bold))
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
        .disabled(next == nil || isAdvancing)
        .opacity((next == nil || isAdvancing) ? 0.85 : 1.0)
    }

    /// Skyv award ett steg videre. Hvis vi har serverID + api, ring
    /// advanceAward på backend; ellers oppdater kun lokalt (mock).
    private func advanceLocalAward(award: Binding<Award>) async {
        let a = award.wrappedValue
        guard let next = nextStep(a.currentStep) else { return }
        guard let api = appState.api, let serverID = a.serverID else {
            // Lokal-only: bare mutér state
            await MainActor.run { award.wrappedValue.currentStep = next }
            return
        }
        await MainActor.run { _ = advancing.insert(a.id) }
        defer { Task { @MainActor in advancing.remove(a.id) } }
        do {
            let dto = try await api.advanceAward(id: serverID, trackingNumber: nil, notes: nil)
            await MainActor.run {
                award.wrappedValue.currentStep = Step.fromBackend(dto.status)
            }
        } catch {
            // Best-effort fall-back: stille
            print("[PrizeFulfillmentSheet] advance failed: \(error)")
        }
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
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(allReceived ? Brand.green : Brand.purpleLight)
            VStack(alignment: .leading, spacing: 2) {
                Text(allReceived ? "Alt levert!" : "Vinnere får varsel + e-post")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Text(allReceived ? "Alle premier er bekreftet mottatt. Konkurransen arkiveres automatisk."
                                 : "Hver gang du flytter en status, sender Leadgrid push + e-post til vinneren.")
                    .font(.system(size: 11))
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
