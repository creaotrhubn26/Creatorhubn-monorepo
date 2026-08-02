// SuperAdmin.swift — Leadgrid SuperAdmin-konsoll for multi-tenant gating (2026-06-30)
//
// HØRER HJEMME: separat app eller skjult flate i hovedappen — KUN for Leadgrid-ansatte.
// Lar Leadgrid styre hvilke organisasjoner som har tilgang til hvilke features,
// med plan-baserte defaults + per-org overrides + usage-limits.

import SwiftUI

// MARK: - Domain-modell

enum SubscriptionPlan: String, CaseIterable, Identifiable, Hashable {
    case trial = "Trial"
    case starter = "Starter"
    case pro = "Pro"
    case enterprise = "Enterprise"
    case custom = "Custom"
    var id: String { rawValue }
    var tint: Color {
        switch self {
        case .trial: return LBrand.yellow
        case .starter: return LBrand.blue
        case .pro: return LBrand.purpleLight
        case .enterprise: return LBrand.orange
        case .custom: return LBrand.pink
        }
    }
    var monthlyPrice: Int {
        switch self {
        case .trial: return 0
        case .starter: return 2990
        case .pro: return 9900
        case .enterprise: return 29900
        case .custom: return 0
        }
    }
    var description: String {
        switch self {
        case .trial: return "14 dager · alle features · 5 maks brukere"
        case .starter: return "Basis CRM + Leads + Kart · 10 brukere"
        case .pro: return "Alt i Starter + Leadbook + Pondus + Akademi · 25 brukere"
        case .enterprise: return "Alt + SSO + audit-export + dedikert support · ubegrenset"
        case .custom: return "Skreddersydd avtale — alle features åpne for forhandling"
        }
    }
}

enum EntitlementState: String, CaseIterable, Identifiable, Hashable {
    case included = "Inkludert"
    case trial = "Trial"
    case addOn = "Tillegg"
    case locked = "Sperret"
    var id: String { rawValue }
    var color: Color {
        switch self {
        case .included: return LBrand.green
        case .trial: return LBrand.yellow
        case .addOn: return LBrand.blue
        case .locked: return LBrand.textTertiary
        }
    }
    var icon: String {
        switch self {
        case .included: return "checkmark.seal.fill"
        case .trial: return "clock.fill"
        case .addOn: return "plus.circle.fill"
        case .locked: return "lock.fill"
        }
    }

    /// Backend-verdi (mig 0370) — rawValue er norsk display-tekst.
    var apiValue: String {
        switch self {
        case .included: return "included"
        case .trial: return "trial"
        case .addOn: return "add_on"
        case .locked: return "locked"
        }
    }

    static func fromAPI(_ value: String) -> EntitlementState? {
        allCases.first { $0.apiValue == value }
    }
}

struct Entitlement: Identifiable, Hashable {
    let id = UUID()
    let feature: LeadgridFeature
    var state: EntitlementState
    var monthlyLimit: Int?        // nil = ubegrenset
    var currentUsage: Int = 0
    var trialEndsAt: Date?
    var addOnPriceMonthly: Int?
}

struct Organization: Identifiable, Hashable {
    let id = UUID()
    /// Backend-uuid når org-en kommer fra `/api/superadmin/organizations`
    /// (ekte modus). nil = demo-mock.
    var serverId: String? = nil
    let name: String
    let domain: String
    let industry: String
    let logo: String              // SF Symbol-fallback
    let logoColor: Color
    var plan: SubscriptionPlan
    var memberCount: Int
    var activeUsers30d: Int
    var monthlySpend: Int          // NOK
    var contractRenewal: Date
    var billingStatus: BillingStatus
    var country: String
    var primaryContact: String
    var entitlements: [Entitlement]
    var notes: String
    var createdAt: Date

    enum BillingStatus: String, Hashable {
        case good = "Betalt"
        case overdue = "Forfalt"
        case trial = "Trial"
        case suspended = "Suspendert"
        var color: Color {
            switch self {
            case .good: return LBrand.green
            case .overdue: return LBrand.orange
            case .trial: return LBrand.yellow
            case .suspended: return LBrand.red
            }
        }
    }
}

enum PlanDefaults {
    static func entitlement(
        for feature: LeadgridFeature,
        plan: SubscriptionPlan,
        mockUsage: Bool = true
    ) -> Entitlement {
        let state: EntitlementState
        var limit: Int? = nil
        switch plan {
        case .trial:
            state = .trial
        case .starter:
            switch feature.group {
            case .kjerne: state = .included
            case .analyseTeam: state = .included
            case .leadbook:
                state = (feature == .leadbookOversikt || feature == .leadbookMaler) ? .included : .addOn
            case .admin: state = (feature == .varsler) ? .included : .locked
            case .rapportExport:
                // Starter: CSV + Marker som lest gratis, resten som addOn
                state = (feature == .teamExportCSV || feature == .teamMarkAllRead) ? .included : .addOn
            case .analyseAI:
                // Starter: kun sammenlign-forrige gratis, AI-features som addOn
                state = (feature == .teamCompareToPrevious) ? .included : .addOn
            case .leadgridGo: state = .addOn   // tilleggstjeneste
            case .kvalitet: state = .addOn     // tilleggstjeneste
            case .anbud: state = .addOn        // tilleggstjeneste (Doffin)
            }
            if feature == .leads { limit = 500 }
        case .pro:
            switch feature.group {
            case .admin:
                state = (feature == .varsler || feature == .integrasjoner) ? .included : .locked
            case .analyseAI:
                // Pro: alle analyse-features inkludert, AI-formel som trial (14 dager)
                state = (feature == .teamAIFormulaSuggest) ? .trial : .included
            case .leadgridGo: state = .addOn   // tilleggstjeneste (også på Pro)
            case .kvalitet: state = .addOn     // tilleggstjeneste (også på Pro)
            case .anbud: state = .addOn        // tilleggstjeneste (også på Pro)
            default: state = .included
            }
        case .enterprise: state = .included
        case .custom: state = .included
        }
        return Entitlement(
            feature: feature,
            state: state,
            monthlyLimit: limit,
            // Tilfeldig forbruk er DEMO-pynt — i ekte modus finnes ingen
            // usage-måling enda, så 0 er den ærlige verdien.
            currentUsage: mockUsage ? Int.random(in: 0...(limit ?? 200)) : 0,
            trialEndsAt: state == .trial ? Calendar.current.date(byAdding: .day, value: 14, to: Date()) : nil,
            addOnPriceMonthly: state == .addOn ? 990 : nil
        )
    }

    static func allEntitlements(for plan: SubscriptionPlan, mockUsage: Bool = true) -> [Entitlement] {
        LeadgridFeature.allCases.map { entitlement(for: $0, plan: plan, mockUsage: mockUsage) }
    }
}

// MARK: - Ekte org fra backend → Organization

extension Organization {
    /// Mapper en rad fra `GET /api/superadmin/organizations` til konsollens
    /// modell. Felter backend ikke har (omsetning, aktive 30d, renewal)
    /// settes til ærlige null-verdier — IKKE oppdiktede tall.
    init(server entry: SuperAdminOrgEntry) {
        let plan: SubscriptionPlan = switch (entry.planKey ?? "").lowercased() {
        case "trial": .trial
        case "starter": .starter
        case "pro": .pro
        case "enterprise": .enterprise
        default: .custom
        }
        let created = ISO8601DateFormatter().date(
            from: entry.createdAt ?? ""
        ) ?? Date()
        self.init(
            serverId: entry.id,
            name: entry.name,
            domain: entry.ownerEmail?.split(separator: "@").last.map(String.init) ?? "—",
            industry: entry.orgType == "agency" ? "Byrå"
                : entry.orgType == "developer" ? "Utvikler" : "Kunde",
            logo: "building.2.fill",
            logoColor: LBrand.blue,
            plan: plan,
            memberCount: entry.memberCount ?? 0,
            activeUsers30d: 0,
            monthlySpend: 0,
            contractRenewal: Calendar.current.date(byAdding: .year, value: 1, to: created) ?? created,
            billingStatus: plan == .trial ? .trial : .good,
            country: "Norge",
            primaryContact: entry.ownerEmail ?? "—",
            entitlements: PlanDefaults.allEntitlements(for: plan, mockUsage: false),
            notes: "",
            createdAt: created
        )
    }
}

enum SuperAdminData {
    static let organizations: [Organization] = [
        Organization(
            name: "Skanska Norge AS", domain: "skanska.no", industry: "Bygg & anlegg",
            logo: "building.2.fill", logoColor: LBrand.blue,
            plan: .enterprise, memberCount: 142, activeUsers30d: 128, monthlySpend: 89_700,
            contractRenewal: Date().addingTimeInterval(86_400 * 92),
            billingStatus: .good, country: "Norge",
            primaryContact: "tora.eik@skanska.no",
            entitlements: PlanDefaults.allEntitlements(for: .enterprise),
            notes: "Største kunde. CSM: Marit. Q4 renewal — vurder enterprise+.",
            createdAt: Date().addingTimeInterval(-86_400 * 482)
        ),
        Organization(
            name: "Norkonsult", domain: "norkonsult.no", industry: "Rådgivning",
            logo: "person.2.crop.square.stack.fill", logoColor: LBrand.purpleLight,
            plan: .pro, memberCount: 24, activeUsers30d: 21, monthlySpend: 9_900,
            contractRenewal: Date().addingTimeInterval(86_400 * 145),
            billingStatus: .good, country: "Norge",
            primaryContact: "marit@norkonsult.no",
            entitlements: PlanDefaults.allEntitlements(for: .pro),
            notes: "Aktiv bruker av Pondus Akademi. Power-user.",
            createdAt: Date().addingTimeInterval(-86_400 * 214)
        ),
        Organization(
            name: "Acme Solutions", domain: "acme.io", industry: "SaaS",
            logo: "cube.fill", logoColor: LBrand.green,
            plan: .pro, memberCount: 18, activeUsers30d: 5, monthlySpend: 9_900,
            contractRenewal: Date().addingTimeInterval(86_400 * 38),
            billingStatus: .overdue, country: "Sverige",
            primaryContact: "anders@acme.io",
            entitlements: PlanDefaults.allEntitlements(for: .pro),
            notes: "Fakturert 2 mnd uten betaling. Risiko-tagg.",
            createdAt: Date().addingTimeInterval(-86_400 * 89)
        ),
        Organization(
            name: "FutureBank", domain: "futurebank.com", industry: "Finans",
            logo: "building.columns.fill", logoColor: LBrand.orange,
            plan: .enterprise, memberCount: 89, activeUsers30d: 81, monthlySpend: 59_800,
            contractRenewal: Date().addingTimeInterval(86_400 * 268),
            billingStatus: .good, country: "Danmark",
            primaryContact: "lars@futurebank.com",
            entitlements: PlanDefaults.allEntitlements(for: .enterprise),
            notes: "Custom SSO påkrevd. SCIM-provisioning live.",
            createdAt: Date().addingTimeInterval(-86_400 * 320)
        ),
        Organization(
            name: "Kvalitetsbygg AS", domain: "kbygg.no", industry: "Bygg",
            logo: "hammer.fill", logoColor: LBrand.yellow,
            plan: .starter, memberCount: 8, activeUsers30d: 7, monthlySpend: 2_990,
            contractRenewal: Date().addingTimeInterval(86_400 * 31),
            billingStatus: .good, country: "Norge",
            primaryContact: "frode@kbygg.no",
            entitlements: PlanDefaults.allEntitlements(for: .starter),
            notes: "Oppgraderingsmål: Pro Q3. Trenger Leadbook for å scale.",
            createdAt: Date().addingTimeInterval(-86_400 * 61)
        ),
        Organization(
            name: "MarineCo", domain: "marineco.no", industry: "Maritim",
            logo: "ferry.fill", logoColor: LBrand.blue,
            plan: .starter, memberCount: 12, activeUsers30d: 9, monthlySpend: 2_990,
            contractRenewal: Date().addingTimeInterval(86_400 * 198),
            billingStatus: .good, country: "Norge",
            primaryContact: "per@marineco.no",
            entitlements: PlanDefaults.allEntitlements(for: .starter),
            notes: "Stabil mid-tier.",
            createdAt: Date().addingTimeInterval(-86_400 * 122)
        ),
        Organization(
            name: "Nordhus Eiendom", domain: "nordhus.no", industry: "Eiendom",
            logo: "house.fill", logoColor: LBrand.pink,
            plan: .trial, memberCount: 4, activeUsers30d: 3, monthlySpend: 0,
            contractRenewal: Date().addingTimeInterval(86_400 * 8),
            billingStatus: .trial, country: "Norge",
            primaryContact: "kari@nordhus.no",
            entitlements: PlanDefaults.allEntitlements(for: .trial),
            notes: "Trial slutter om 8 dager — konverter til Pro.",
            createdAt: Date().addingTimeInterval(-86_400 * 6)
        ),
        Organization(
            name: "Acme Test Corp", domain: "acmetest.no", industry: "IT",
            logo: "wrench.and.screwdriver.fill", logoColor: LBrand.textTertiary,
            plan: .trial, memberCount: 2, activeUsers30d: 0, monthlySpend: 0,
            contractRenewal: Date().addingTimeInterval(86_400 * -3),
            billingStatus: .suspended, country: "Norge",
            primaryContact: "test@acmetest.no",
            entitlements: PlanDefaults.allEntitlements(for: .trial),
            notes: "Trial gått ut. Ingen aktivitet. Slett etter 30 dager.",
            createdAt: Date().addingTimeInterval(-86_400 * 18)
        )
    ]
}

// MARK: - SuperAdminDashboard (hovedflate)

struct SuperAdminDashboard: View {
    var onExit: () -> Void = {}
    @Environment(AppState.self) private var appState
    // Demo-modus: mock-orgs. Ekte modus: `/api/superadmin/organizations`
    // lastes i .task og ERSTATTER mocken — konsollen skal aldri vise
    // oppdiktede kunder til en innlogget Leadgrid-ansatt.
    @State private var orgs: [Organization] = DemoModeManager.isActiveNonisolated
        ? SuperAdminData.organizations : []
    @State private var isLive = false
    @State private var loadError: String?
    @State private var search: String = ""
    @State private var planFilter: SubscriptionPlan?
    @State private var billingFilter: Organization.BillingStatus?
    @State private var selectedOrg: Organization?
    @State private var sort: Sort = .revenue
    @State private var showDemoMode = false
    @State private var showFeatureCatalog = false
    @State private var showGlobalAudit = false

    /// CSV av org-listen slik den vises (LIVE fra backend eller demo-mock).
    private var mrrCSV: String {
        var lines = ["Organisasjon;Domene;Plan;Fakturering;Brukere;Aktive 30d;MRR (NOK)"]
        for o in filtered {
            lines.append("\(o.name);\(o.domain);\(o.plan.rawValue);\(o.billingStatus.rawValue);\(o.memberCount);\(o.activeUsers30d);\(o.monthlySpend)")
        }
        return lines.joined(separator: "\n")
    }

    private func loadRealOrgs() async {
        guard !DemoModeManager.isActiveNonisolated else { return }
        guard let api = appState.api else {
            loadError = "Ingen API-klient — logg inn på nytt"
            return
        }
        do {
            let resp = try await api.fetchSuperAdminOrgs()
            orgs = resp.organizations.map(Organization.init(server:))
            isLive = true
            loadError = nil
        } catch {
            loadError = "Kunne ikke hente organisasjoner: \(error.localizedDescription)"
        }
    }

    enum Sort: String, CaseIterable, Identifiable {
        case revenue = "Høyest omsetning"
        case usage = "Mest aktive"
        case alphabetic = "A–Å"
        case renewal = "Kommende renewals"
        case created = "Nyeste først"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .revenue: return "banknote.fill"
            case .usage: return "person.3.fill"
            case .alphabetic: return "textformat"
            case .renewal: return "calendar"
            case .created: return "sparkles"
            }
        }
    }

    private var filtered: [Organization] {
        var list = orgs
        if let plan = planFilter { list = list.filter { $0.plan == plan } }
        if let billing = billingFilter { list = list.filter { $0.billingStatus == billing } }
        if !search.isEmpty {
            let q = search.lowercased()
            list = list.filter {
                $0.name.lowercased().contains(q)
                    || $0.domain.lowercased().contains(q)
                    || $0.industry.lowercased().contains(q)
                    || $0.primaryContact.lowercased().contains(q)
            }
        }
        switch sort {
        case .revenue: list.sort { $0.monthlySpend > $1.monthlySpend }
        case .usage: list.sort { $0.activeUsers30d > $1.activeUsers30d }
        case .alphabetic: list.sort { $0.name < $1.name }
        case .renewal: list.sort { $0.contractRenewal < $1.contractRenewal }
        case .created: list.sort { $0.createdAt > $1.createdAt }
        }
        return list
    }

    private var totalMRR: Int { orgs.map(\.monthlySpend).reduce(0, +) }
    private var totalUsers: Int { orgs.map(\.memberCount).reduce(0, +) }
    private var atRiskCount: Int {
        orgs.filter { $0.billingStatus == .overdue || $0.billingStatus == .suspended }.count
    }
    private var renewing30dCount: Int {
        let cutoff = Date().addingTimeInterval(86_400 * 30)
        return orgs.filter { $0.contractRenewal < cutoff && $0.billingStatus != .suspended }.count
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        superAdminBadge
                        sourceStatus
                        kpiRow
                        searchAndSort
                        filterChips
                        orgGrid
                        Color.clear.frame(height: 20)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Leadgrid SuperAdmin")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        onExit()
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "arrow.uturn.backward")
                                .font(.appScaled(size: 11, weight: .bold))
                            Text("Tilbake til kundeapp").font(.appScaled(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(LBrand.purpleLight)
                        .padding(.horizontal, 11).padding(.vertical, 6)
                        .background(LBrand.cardHi, in: Capsule())
                        .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                ToolbarItem(placement: .confirmationAction) {
                    HStack(spacing: 8) {
                        Button { showDemoMode = true } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "eye.fill").font(.appScaled(size: 11, weight: .bold))
                                Text("Demo-modus").font(.appScaled(size: 11, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(
                                LinearGradient(colors: [LBrand.orange, LBrand.red.opacity(0.85)],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                        }.buttonStyle(.plain)
                        Menu {
                            // CSV fra den faktisk lastede org-listen (LIVE
                            // eller demo — begge er det brukeren ser).
                            ShareLink(
                                item: mrrCSV,
                                preview: SharePreview("Leadgrid MRR-rapport")
                            ) {
                                Label("Eksporter MRR-rapport (CSV)", systemImage: "tablecells")
                            }
                            Button { showFeatureCatalog = true } label: {
                                Label("Funksjons-katalog", systemImage: "shippingbox.fill")
                            }
                            Divider()
                            Button { showGlobalAudit = true } label: {
                                Label("Audit-logg (alle orgs)", systemImage: "clock.arrow.circlepath")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .font(.appScaled(size: 16, weight: .semibold))
                                .foregroundStyle(LBrand.orange)
                        }
                    }
                }
            }
            .sheet(item: $selectedOrg) { org in
                OrgDetailSheet(org: org) { updated in
                    if let idx = orgs.firstIndex(where: { $0.id == updated.id }) {
                        orgs[idx] = updated
                    }
                }
            }
            .sheet(isPresented: $showDemoMode) { PlanSwitcherSheet() }
            .sheet(isPresented: $showFeatureCatalog) { FeatureCatalogView() }
            .sheet(isPresented: $showGlobalAudit) { GlobalAuditSheet() }
            .task { await loadRealOrgs() }
        }
        .macCatalystSheetSize(minWidth: 1100, minHeight: 800)
    }

    /// Ærlig kilde-linje under badgen: LIVE m/ antall, demo, laster
    /// eller feil — konsollen skal aldri se «ekte» ut når den ikke er det.
    @ViewBuilder
    private var sourceStatus: some View {
        if let loadError {
            Label(loadError, systemImage: "exclamationmark.triangle.fill")
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(LBrand.red)
        } else if isLive {
            Label("LIVE — \(orgs.count) organisasjoner fra backend", systemImage: "dot.radiowaves.left.and.right")
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(LBrand.green)
        } else if DemoModeManager.isActiveNonisolated {
            Label("DEMO-DATA — mock-organisasjoner", systemImage: "eye.fill")
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(LBrand.yellow)
        } else {
            Label("Henter organisasjoner …", systemImage: "arrow.triangle.2.circlepath")
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
        }
    }

    private var superAdminBadge: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(LBrand.orange.opacity(0.28))
                Image(systemName: "crown.fill").font(.appScaled(size: 12, weight: .black))
                    .foregroundStyle(LBrand.orange)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text("DU ER LEADGRID-ANSATT")
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.orange).tracking(0.8)
                Text("Du ser data på tvers av alle kunde-organisasjoner. Alt du gjør logges i audit-trail.")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(LBrand.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.orange.opacity(0.3), lineWidth: 1))
    }

    // iPhone: fem tiles deler ikke compact width — etikettene krympet til
    // «A…»/«RE…». Scrollbar rad m/ fast bredde (Leadbook-mønsteret).
    @ViewBuilder
    private var kpiRow: some View {
        if DeviceIdiom.isPhone {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) { kpiTiles }
            }
        } else {
            HStack(spacing: 10) { kpiTiles }
        }
    }

    @ViewBuilder
    private var kpiTiles: some View {
        kpiTile("Antall orgs", "\(orgs.count)", "building.2.fill", LBrand.purpleLight)
        kpiTile("MRR", "\(totalMRR / 1000) k", "banknote.fill", LBrand.green)
        kpiTile("Brukere totalt", "\(totalUsers)", "person.3.fill", LBrand.blue)
        kpiTile("Renewal 30d", "\(renewing30dCount)", "calendar.badge.clock", LBrand.yellow)
        kpiTile("At risk", "\(atRiskCount)", "exclamationmark.triangle.fill", LBrand.red)
    }

    private func kpiTile(_ label: String, _ value: String, _ icon: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(tint)
                Text(label.uppercased()).font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Text(value).font(.appScaled(size: 20, weight: .heavy, design: .rounded))
                .foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var searchAndSort: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(LBrand.textTertiary)
                TextField("Søk org, domene, bransje eller kontakt…", text: $search)
                    .foregroundStyle(.white).textFieldStyle(.plain)
                if !search.isEmpty {
                    Button { search = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(LBrand.textTertiary)
                    }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            Menu {
                ForEach(Sort.allCases) { s in
                    Button { sort = s } label: { Label(s.rawValue, systemImage: s.icon) }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: sort.icon).font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(LBrand.orange)
                    Text(sort.rawValue).font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
        }
    }

    private var filterChips: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PLAN").font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    planChip(nil, label: "Alle planer", tint: LBrand.orange)
                    ForEach(SubscriptionPlan.allCases) { p in
                        planChip(p, label: p.rawValue, tint: p.tint)
                    }
                }
            }
            Text("FAKTURERING").font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    billingChip(nil, label: "Alle", tint: LBrand.orange)
                    billingChip(.good, label: "Betalt", tint: LBrand.green)
                    billingChip(.trial, label: "Trial", tint: LBrand.yellow)
                    billingChip(.overdue, label: "Forfalt", tint: LBrand.orange)
                    billingChip(.suspended, label: "Suspendert", tint: LBrand.red)
                }
            }
        }
    }

    private func planChip(_ p: SubscriptionPlan?, label: String, tint: Color) -> some View {
        let active = planFilter == p
        return Button { planFilter = active ? nil : p } label: {
            Text(label).font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(active ? .white : LBrand.textSecondary)
                .padding(.horizontal, 11).padding(.vertical, 6)
                .background(active ? tint.opacity(0.28) : LBrand.cardHi, in: Capsule())
                .overlay(Capsule().stroke(active ? tint.opacity(0.55) : LBrand.stroke, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    private func billingChip(_ b: Organization.BillingStatus?, label: String, tint: Color) -> some View {
        let active = billingFilter == b
        return Button { billingFilter = active ? nil : b } label: {
            Text(label).font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(active ? .white : LBrand.textSecondary)
                .padding(.horizontal, 11).padding(.vertical, 6)
                .background(active ? tint.opacity(0.28) : LBrand.cardHi, in: Capsule())
                .overlay(Capsule().stroke(active ? tint.opacity(0.55) : LBrand.stroke, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    private var orgGrid: some View {
        // Adaptiv: 1-kolonne på iPhone, 2-kolonne på iPad, 3-kolonne på
        // Mac Catalyst — bruker vindusbredden bedre for org-oversikten.
        LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 1, iPad: 2, mac: 3, spacing: 10), spacing: 10) {
            ForEach(filtered) { org in orgCard(org) }
        }
    }

    private func orgCard(_ org: Organization) -> some View {
        Button { selectedOrg = org } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10).fill(org.logoColor.opacity(0.22))
                        Image(systemName: org.logo).font(.appScaled(size: 17, weight: .bold))
                            .foregroundStyle(org.logoColor)
                    }
                    .frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(org.name)
                            .font(.appScaled(size: 15, weight: .bold))
                            .foregroundStyle(.white).lineLimit(1)
                        HStack(spacing: 5) {
                            Text(org.domain).font(.appScaled(size: 10)).foregroundStyle(LBrand.textSecondary)
                            Text("·").foregroundStyle(LBrand.textTertiary)
                            Text(org.industry).font(.appScaled(size: 10)).foregroundStyle(LBrand.textSecondary)
                        }
                    }
                    Spacer()
                    HStack(spacing: 5) {
                        Circle().fill(org.billingStatus.color).frame(width: 6, height: 6)
                        Text(org.billingStatus.rawValue.uppercased())
                            .font(.appScaled(size: 8, weight: .black))
                            .foregroundStyle(org.billingStatus.color).tracking(0.5)
                    }
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(org.billingStatus.color.opacity(0.15), in: Capsule())
                    .overlay(Capsule().stroke(org.billingStatus.color.opacity(0.4), lineWidth: 1))
                }
                HStack(spacing: 6) {
                    Text(org.plan.rawValue.uppercased())
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(org.plan.tint).tracking(0.6)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(org.plan.tint.opacity(0.18), in: Capsule())
                        .overlay(Capsule().stroke(org.plan.tint.opacity(0.4), lineWidth: 1))
                    Spacer()
                    Text("\(org.monthlySpend / 1000) k/mnd")
                        .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(LBrand.green)
                }
                HStack(spacing: 14) {
                    miniStat(icon: "person.2.fill", value: "\(org.memberCount)", label: "brukere")
                    miniStat(icon: "bolt.fill", value: "\(org.activeUsers30d)", label: "aktive 30d")
                    miniStat(icon: "calendar", value: shortDate(org.contractRenewal), label: "renewal")
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("superadmin-org-card-\(org.domain)")
    }

    private func miniStat(icon: String, value: String, label: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.appScaled(size: 9, weight: .bold))
                .foregroundStyle(LBrand.textTertiary)
            Text(value).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(.white)
            Text(label).font(.appScaled(size: 10)).foregroundStyle(LBrand.textSecondary)
        }
    }

    private func shortDate(_ d: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "d.M"
        return fmt.string(from: d)
    }
}

// MARK: - OrgDetailSheet — full org-styring

struct OrgDetailSheet: View {
    @State var org: Organization
    var onUpdate: (Organization) -> Void
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var tab: Tab = .oversikt
    @State private var showManualInvoiceInfo = false
    // Manuell faktura-skjema (mig 0407)
    @State private var invoiceEmail = ""
    @State private var invoiceAmount = ""
    @State private var invoiceDesc = "Leadgrid-abonnement"
    @State private var invoiceSending = false
    @State private var invoiceResult: LeadgridManualInvoice?
    @State private var invoiceError: String?
    @State private var showEntitlementMatrix = false
    @State private var showPlanChange = false
    @State private var showImpersonate = false
    @State private var toast: String?
    @State private var toastIsError = false
    @State private var realAuditEntries: [SuperAdminAuditEntryDTO] = []
    @State private var realAuditError: String?
    @State private var showSuspendPrompt = false
    @State private var suspendReason = ""

    /// Ekte data konsollen holder om org-en — delbar JSON (GDPR-innsyn).
    private var gdprExportJSON: String {
        var dict: [String: Any] = [
            "organization": [
                "id": org.serverId ?? org.id.uuidString,
                "name": org.name,
                "domain": org.domain,
                "plan": org.plan.rawValue,
                "billing_status": org.billingStatus.rawValue,
                "member_count": org.memberCount,
                "primary_contact": org.primaryContact,
                "created_at": ISO8601DateFormatter().string(from: org.createdAt),
            ],
            "entitlements": org.entitlements.map { e in
                [
                    "feature": e.feature.key,
                    "state": e.state.apiValue,
                    "monthly_limit": e.monthlyLimit as Any,
                ]
            },
        ]
        dict["audit_log"] = realAuditEntries.map { e in
            ["action": e.action, "by": e.superAdminEmail ?? "", "at": e.createdAt ?? ""]
        }
        let data = (try? JSONSerialization.data(
            withJSONObject: dict, options: [.prettyPrinted, .sortedKeys]
        )) ?? Data()
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    /// Suspender via ekte set-status-endepunkt (reason påkrevd). Demo:
    /// kun lokal status-endring.
    private func suspendOrg() {
        guard let sid = org.serverId, let api = appState.api,
              !DemoModeManager.isActiveNonisolated else {
            org.billingStatus = .suspended
            flash("Org suspendert (demo)", isError: false)
            onUpdate(org)
            return
        }
        // Backend krever begrunnelse ved ikke-active — stopp før kallet.
        guard !suspendReason.trimmingCharacters(in: .whitespaces).isEmpty else {
            flash("Begrunnelse er påkrevd", isError: true)
            return
        }
        Task {
            do {
                try await api.setOrgStatus(sid, status: "suspended", reason: suspendReason)
                org.billingStatus = .suspended
                flash("Org suspendert", isError: false)
            } catch {
                flash("Suspendering feilet", isError: true)
            }
            onUpdate(org)
        }
    }

    /// Ekte modus: hent lagrede overrides fra backend og legg dem oppå
    /// plan-defaults, slik at matrisen viser det som FAKTISK er gitt.
    private func loadSavedEntitlements() async {
        guard let sid = org.serverId, let api = appState.api,
              !DemoModeManager.isActiveNonisolated else { return }
        do {
            let env = try await api.fetchOrgEntitlements(sid)
            guard !env.entitlements.isEmpty else { return }
            var ents = org.entitlements
            for row in env.entitlements {
                guard let feature = LeadgridFeature.fromKey(row.featureKey),
                      let state = EntitlementState.fromAPI(row.state),
                      let idx = ents.firstIndex(where: { $0.feature == feature })
                else { continue }
                ents[idx].state = state
                ents[idx].monthlyLimit = row.monthlyLimit
                ents[idx].addOnPriceMonthly = row.addonPriceMonthly
            }
            org.entitlements = ents
        } catch {
            flash("Kunne ikke hente lagrede tilganger", isError: true)
        }
    }

    // MARK: Org-profil-presets (2026-07-18)

    /// Dørsalg-profil = husstandsmodusen eksplisitt PÅ + Leads (bedrifts-
    /// CRM) låst. Resten av matrisen defineres ikke av profilen.
    private var erDorsalgProfil: Bool {
        let dorsalg = org.entitlements.first { $0.feature == .dorsalgModus }?.state
        let leads = org.entitlements.first { $0.feature == .leads }?.state
        return dorsalg == .included && leads == .locked
    }

    private func applyOrgProfile(dorsalg: Bool) {
        var ents = org.entitlements
        func set(_ feature: LeadgridFeature, _ state: EntitlementState) {
            if let idx = ents.firstIndex(where: { $0.feature == feature }) {
                ents[idx].state = state
            } else {
                ents.append(Entitlement(feature: feature, state: state,
                                        monthlyLimit: nil, currentUsage: 0,
                                        trialEndsAt: nil, addOnPriceMonthly: nil))
            }
        }
        if dorsalg {
            set(.dorsalgModus, .included)   // husstandsmodusen på kartet
            set(.leads, .locked)            // bedrifts-CRM-et stenges
        } else {
            set(.dorsalgModus, .locked)     // ingen dørsalg-referanse
            set(.leads, .included)
        }
        org.entitlements = ents
        saveEntitlements(ents)
        flash(dorsalg ? "Org-profil satt: Dørsalg" : "Org-profil satt: B2B",
              isError: false)
    }

    private func orgProfileButton(
        title: String, icon: String, tint: Color, active: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.appScaled(size: 11, weight: .bold))
                Text(title).font(.appScaled(size: 12, weight: .bold))
                if active {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 11, weight: .bold))
                }
            }
            .foregroundStyle(active ? .white : LBrand.textSecondary)
            .padding(.horizontal, 12).padding(.vertical, 9)
            .background(
                active ? AnyShapeStyle(tint.opacity(0.85)) : AnyShapeStyle(LBrand.cardHi),
                in: Capsule()
            )
            .overlay(Capsule().stroke(active ? tint : LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    /// Ekte modus: PUT hele matrisen. Demo: kun lokal state.
    private func saveEntitlements(_ updated: [Entitlement]) {
        guard let sid = org.serverId, let api = appState.api,
              !DemoModeManager.isActiveNonisolated else {
            flash("\(updated.count) tilganger oppdatert (demo)", isError: false)
            onUpdate(org)
            return
        }
        Task {
            do {
                try await api.saveOrgEntitlements(sid, entitlements: updated)
                flash("\(updated.count) tilganger lagret", isError: false)
            } catch {
                flash("Lagring feilet — prøv igjen", isError: true)
            }
            onUpdate(org)
        }
    }

    private func flash(_ text: String, isError: Bool) {
        toastIsError = isError
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
    }

    enum Tab: String, CaseIterable, Identifiable {
        case oversikt = "Oversikt"
        case tilganger = "Tilganger"
        case fakturering = "Fakturering"
        case audit = "Audit-logg"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .oversikt: return "house.fill"
            case .tilganger: return "shippingbox.fill"
            case .fakturering: return "creditcard.fill"
            case .audit: return "clock.arrow.circlepath"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    hero
                    tabBar
                    Divider().overlay(LBrand.stroke)
                    ScrollView {
                        Group {
                            switch tab {
                            case .oversikt:    oversiktTab
                            case .tilganger:   tilgangerTab
                            case .fakturering: faktureringTab
                            case .audit:       auditTab
                            }
                        }
                        .padding(20)
                    }
                }
                if let t = toast {
                    VStack {
                        Spacer().frame(height: 80)
                        Label(t, systemImage: toastIsError
                              ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                            .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(toastIsError ? LBrand.red : LBrand.green, in: Capsule())
                        Spacer()
                    }
                }
            }
            .navigationTitle(org.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button { showImpersonate = true } label: { Label("Logg inn som org-admin", systemImage: "person.badge.shield.exclamationmark.fill") }
                        Button { showPlanChange = true } label: { Label("Endre plan", systemImage: "arrow.up.right.circle.fill") }
                        Button { showEntitlementMatrix = true } label: { Label("Rediger entitlements", systemImage: "checkmark.shield.fill") }
                        Divider()
                        // Ekte eksport: alt konsollen VET om org-en (info +
                        // entitlements + audit) som delbar JSON.
                        ShareLink(
                            item: gdprExportJSON,
                            preview: SharePreview("\(org.name) — org-data")
                        ) {
                            Label("Eksporter org-data (GDPR)", systemImage: "square.and.arrow.up")
                        }
                        Button(role: .destructive) { showSuspendPrompt = true } label: {
                            Label("Suspender org", systemImage: "pause.circle.fill")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(LBrand.orange)
                    }
                    .accessibilityIdentifier("org-detail-more")
                }
            }
            .sheet(isPresented: $showEntitlementMatrix) {
                EntitlementMatrixSheet(org: $org) { updated in
                    saveEntitlements(updated)
                }
            }
            .alert("Suspender \(org.name)?", isPresented: $showSuspendPrompt) {
                TextField("Begrunnelse (påkrevd)", text: $suspendReason)
                Button("Suspender", role: .destructive) { suspendOrg() }
                Button("Avbryt", role: .cancel) {}
            } message: {
                Text("Organisasjonen mister tilgang og Stripe-innkreving pauses. Begrunnelsen logges i audit-trail.")
            }
            .task { await loadSavedEntitlements() }
            .sheet(isPresented: $showPlanChange) {
                let isRealOrg = org.serverId != nil && !DemoModeManager.isActiveNonisolated
                PlanChangeSheet(org: $org, isReal: isRealOrg) {
                    if !isRealOrg {
                        toast = "Plan endret til \(org.plan.rawValue) (demo)"
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
                        onUpdate(org)
                    }
                }
            }
            .sheet(isPresented: $showImpersonate) {
                ImpersonationSheet(org: org)
            }
        }
    }

    private var hero: some View {
        VStack(spacing: 12) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12).fill(org.logoColor.opacity(0.22))
                    Image(systemName: org.logo).font(.appScaled(size: 22, weight: .bold))
                        .foregroundStyle(org.logoColor)
                }
                .frame(width: 56, height: 56)
                VStack(alignment: .leading, spacing: 4) {
                    Text(org.name).font(.appScaled(size: 18, weight: .heavy)).foregroundStyle(.white)
                    HStack(spacing: 6) {
                        Image(systemName: "globe").font(.appScaled(size: 9))
                        Text(org.domain).font(.appScaled(size: 11))
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text(org.industry).font(.appScaled(size: 11))
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text(org.country).font(.appScaled(size: 11))
                    }
                    .foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
            }
            HStack(spacing: 8) {
                heroBadge(org.plan.rawValue.uppercased(), tint: org.plan.tint, icon: "sparkles")
                heroBadge(org.billingStatus.rawValue, tint: org.billingStatus.color, icon: "creditcard.fill")
                heroBadge("\(org.monthlySpend / 1000) k/mnd", tint: LBrand.green, icon: "banknote.fill")
                Spacer()
            }
        }
        .padding(16)
    }

    private func heroBadge(_ text: String, tint: Color, icon: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.appScaled(size: 9, weight: .bold))
            Text(text).font(.appScaled(size: 10, weight: .bold))
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 9).padding(.vertical, 4)
        .background(tint.opacity(0.16), in: Capsule())
        .overlay(Capsule().stroke(tint.opacity(0.4), lineWidth: 1))
    }

    // iPhone: fire faner får ikke plass side om side — ordene brøt
    // («Oversi kt»). Scrollbar rad m/ .fixedSize() (Leadbook-mønsteret).
    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(Tab.allCases) { t in
                    Button { withAnimation(.easeInOut(duration: 0.15)) { tab = t } } label: {
                        HStack(spacing: 6) {
                            Image(systemName: t.icon).font(.appScaled(size: 11, weight: .bold))
                            Text(t.rawValue).font(.appScaled(size: 12, weight: tab == t ? .bold : .semibold))
                                .lineLimit(1).fixedSize()
                        }
                        .foregroundStyle(tab == t ? .white : LBrand.textSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(tab == t ? LBrand.orange.opacity(0.22) : .clear, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    // Unik id: på iPad er arket sentrert og label-søk kan
                    // treffe dashboardet BAK — tap utenfor arket lukker det.
                    .accessibilityIdentifier("orgdetail-tab-\(t.rawValue)")
                }
                Spacer()
            }
            .padding(.horizontal, 16)
        }
        .accessibilityIdentifier("orgdetail-tabbar")
        .fixedSize(horizontal: !DeviceIdiom.isPhone, vertical: true)
        .padding(.bottom, 10)
    }

    // MARK: Tab — Oversikt

    private var oversiktTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                statBox("Brukere", "\(org.memberCount)", "person.2.fill", LBrand.purpleLight)
                statBox("Aktive 30d", "\(org.activeUsers30d)", "bolt.fill", LBrand.blue)
                statBox("Adopsjon", "\(Int(Double(org.activeUsers30d) / Double(max(1, org.memberCount)) * 100))%", "chart.line.uptrend.xyaxis", LBrand.green)
                statBox("Renewal", shortDate(org.contractRenewal), "calendar.badge.clock", LBrand.yellow)
            }
            infoCard
            HStack(spacing: 10) {
                Button { showImpersonate = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "person.badge.shield.exclamationmark.fill")
                            .font(.appScaled(size: 12, weight: .bold))
                        Text("Logg inn som org-admin").font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(LBrand.orange, in: RoundedRectangle(cornerRadius: 11))
                }.buttonStyle(.plain)
                Button { showPlanChange = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.up.right.circle.fill")
                            .font(.appScaled(size: 12, weight: .bold))
                        Text("Endre plan").font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("NOTATER (KUN LEADGRID-INTERN)").font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                Text(org.notes)
                    .font(.appScaled(size: 12)).foregroundStyle(.white)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(LBrand.orange.opacity(0.06), in: RoundedRectangle(cornerRadius: 11))
                    .overlay(
                        Rectangle().fill(LBrand.orange).frame(width: 3),
                        alignment: .leading
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 11))
            }
        }
    }

    private func statBox(_ label: String, _ value: String, _ icon: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.appScaled(size: 10, weight: .bold)).foregroundStyle(tint)
                Text(label.uppercased()).font(.appScaled(size: 8, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6).lineLimit(1)
            }
            Text(value).font(.appScaled(size: 16, weight: .heavy, design: .rounded))
                .foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
    }

    private var infoCard: some View {
        VStack(spacing: 10) {
            infoRow("Primær kontakt", icon: "person.fill", value: org.primaryContact, tint: LBrand.purpleLight)
            infoRow("Etablert", icon: "calendar.badge.plus", value: longDate(org.createdAt), tint: LBrand.blue)
            infoRow("Plan", icon: "sparkles", value: "\(org.plan.rawValue) · \(org.plan.monthlyPrice) kr/mnd", tint: org.plan.tint)
            infoRow("Land", icon: "globe", value: org.country, tint: LBrand.green)
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func infoRow(_ label: String, icon: String, value: String, tint: Color) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(tint.opacity(0.22))
                Image(systemName: icon).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                Text(value).font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
            }
            Spacer()
        }
    }

    // MARK: Tab — Tilganger

    private var tilgangerTab: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("FUNKSJONS-TILGANG")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Text("Hvilke Leadgrid-funksjoner organisasjonen kan bruke")
                        .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                Button { showEntitlementMatrix = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "slider.horizontal.3").font(.appScaled(size: 11, weight: .bold))
                        Text("Rediger").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(
                        LinearGradient(colors: [LBrand.orange, LBrand.orange.opacity(0.7)],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }.buttonStyle(.plain)
            }
            // Org-profil-presets (2026-07-18, Daniel: «hvordan kan man gi
            // denne type organisasjon denne type tilgang? for kun dette?»):
            // ett klikk setter pakken for org-TYPEN. Dørsalg = husstands-
            // modusen PÅ + bedrifts-CRM-et (Leads) AV; resten av plattformen
            // (Kvalitet/Pondus/Team/Salgsledelse/utstyr/Go) er like relevant
            // for dørsalg og røres ikke. B2B = motsatt (dagens default).
            VStack(alignment: .leading, spacing: 8) {
                Text("ORG-PROFIL")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                HStack(spacing: 8) {
                    orgProfileButton(
                        title: "B2B (standard)", icon: "building.2.fill",
                        tint: LBrand.blue,
                        active: !erDorsalgProfil
                    ) { applyOrgProfile(dorsalg: false) }
                    orgProfileButton(
                        title: "Dørsalg", icon: "door.left.hand.open",
                        tint: LBrand.purpleLight,
                        active: erDorsalgProfil
                    ) { applyOrgProfile(dorsalg: true) }
                }
                Text(erDorsalgProfil
                     ? "Husstandsmodus på kartet er PÅ og bedrifts-CRM-et (Leads) er stengt."
                     : "Bedrifts-CRM-et er åpent; dørsalg-modusen vises ikke for org-en.")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(LBrand.textTertiary)
            }
            // Summary per state
            HStack(spacing: 8) {
                ForEach(EntitlementState.allCases) { s in
                    let count = org.entitlements.filter { $0.state == s }.count
                    VStack(spacing: 3) {
                        HStack(spacing: 4) {
                            Image(systemName: s.icon).font(.appScaled(size: 10, weight: .bold))
                            Text("\(count)").font(.appScaled(size: 14, weight: .heavy, design: .rounded))
                        }
                        .foregroundStyle(s.color)
                        Text(s.rawValue.uppercased()).font(.appScaled(size: 8, weight: .black))
                            .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(s.color.opacity(0.08), in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(s.color.opacity(0.25), lineWidth: 1))
                }
            }
            // Gruppert per feature-group
            ForEach(LeadgridFeature.Group.allCases) { g in
                let entries = org.entitlements.filter { $0.feature.group == g }
                if !entries.isEmpty {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(spacing: 6) {
                            Image(systemName: g.icon).foregroundStyle(g.tint)
                            Text(g.rawValue.uppercased())
                                .font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(g.tint).tracking(0.6)
                        }
                        VStack(spacing: 6) {
                            ForEach(entries) { ent in entitlementRow(ent) }
                        }
                    }
                }
            }
        }
    }

    private func entitlementRow(_ e: Entitlement) -> some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 7).fill(e.state.color.opacity(0.18))
                Image(systemName: e.feature.icon).font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(e.state.color)
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 1) {
                Text(e.feature.rawValue).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                if let limit = e.monthlyLimit {
                    HStack(spacing: 4) {
                        Text("\(e.currentUsage) / \(limit) brukt")
                            .font(.appScaled(size: 9))
                            .foregroundStyle(LBrand.textTertiary)
                        if e.currentUsage > Int(Double(limit) * 0.8) {
                            Text("· nær grense").font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(LBrand.orange)
                        }
                    }
                }
            }
            Spacer()
            HStack(spacing: 4) {
                Image(systemName: e.state.icon).font(.appScaled(size: 9, weight: .bold))
                Text(e.state.rawValue).font(.appScaled(size: 10, weight: .bold))
            }
            .foregroundStyle(e.state.color)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(e.state.color.opacity(0.15), in: Capsule())
            .overlay(Capsule().stroke(e.state.color.opacity(0.4), lineWidth: 1))
        }
        .padding(10)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: Tab — Fakturering

    /// Ekte modus: Stripe-detaljene (customer/sub-id, kort, neste faktura)
    /// er ikke koblet enda — vis ærlig tom-tilstand, ALDRI mock-ID-er på
    /// en ekte kunde-org. Demo beholder illustrasjonen.
    private var faktureringTab: some View {
        VStack(alignment: .leading, spacing: 14) {
            if org.serverId == nil {
                HStack(spacing: 10) {
                    statBox("MRR", "\(org.monthlySpend) kr", "banknote.fill", LBrand.green)
                    statBox("ARR", "\(org.monthlySpend * 12 / 1000) k kr", "calendar", LBrand.purpleLight)
                    statBox("Status", org.billingStatus.rawValue, "creditcard.fill", org.billingStatus.color)
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("STRIPE-INTEGRASJON")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                if org.serverId != nil {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Ingen Stripe-kobling for denne organisasjonen enda",
                              systemImage: "creditcard.trianglebadge.exclamationmark")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        Text("Fakturering settes opp når organisasjonen får abonnement i Stripe.")
                            .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                    }
                } else {
                    VStack(spacing: 8) {
                        stripeRow("Customer-ID", value: "cus_NXR9bK8mY3", icon: "person.badge.key.fill")
                        stripeRow("Subscription-ID", value: "sub_1OqK8m...", icon: "arrow.triangle.2.circlepath")
                        stripeRow("Default-betalingsmetode", value: "VISA •••• 4242", icon: "creditcard.fill")
                        stripeRow("Neste faktura", value: longDate(org.contractRenewal), icon: "calendar.badge.clock")
                    }
                }
            }
            .padding(14)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))

            if org.serverId == nil {
            HStack(spacing: 10) {
                Button { showManualInvoiceInfo = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "doc.text.fill").font(.appScaled(size: 11, weight: .bold))
                        Text("Send manuell faktura").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)
                Button {
                    if let url = URL(string: "https://dashboard.stripe.com") { openURL(url) }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.up.right.square.fill").font(.appScaled(size: 11, weight: .bold))
                        Text("Åpne i Stripe").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                }.buttonStyle(.plain)
            }
            .sheet(isPresented: $showManualInvoiceInfo) { manualInvoiceSheet }
            }
        }
    }

    // MARK: Manuell faktura-skjema (mig 0407)

    private var canSendInvoice: Bool {
        invoiceEmail.contains("@") && (Double(invoiceAmount.replacingOccurrences(of: " ", with: "")) ?? 0) > 0
    }

    private var manualInvoiceSheet: some View {
        NavigationStack {
            Form {
                if let inv = invoiceResult {
                    Section {
                        Label("Faktura sendt", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(LBrand.green)
                        Text("Faktura \(inv.invoiceNumber ?? "—") sendt til \(inv.recipientEmail).")
                            .font(.footnote).foregroundStyle(LBrand.textSecondary)
                    }
                } else {
                    Section("Mottaker") {
                        TextField("E-post", text: $invoiceEmail)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                    }
                    Section("Beløp") {
                        HStack {
                            Text("NOK")
                            TextField("0", text: $invoiceAmount)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                        }
                    }
                    Section("Beskrivelse") {
                        TextField("Hva faktureres", text: $invoiceDesc)
                    }
                    if let invoiceError {
                        Section { Label(invoiceError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                    }
                }
            }
            .navigationTitle("Manuell faktura")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(invoiceResult == nil ? "Avbryt" : "Lukk") { showManualInvoiceInfo = false }
                        .tint(LBrand.textSecondary)
                }
                if invoiceResult == nil {
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            Task { await sendInvoice() }
                        } label: {
                            if invoiceSending { ProgressView() } else { Text("Send faktura").fontWeight(.semibold) }
                        }
                        .disabled(!canSendInvoice || invoiceSending)
                        .tint(LBrand.purpleLight)
                    }
                }
            }
            .onAppear {
                if invoiceEmail.isEmpty, org.primaryContact.contains("@") { invoiceEmail = org.primaryContact }
                if invoiceAmount.isEmpty, org.monthlySpend > 0 { invoiceAmount = "\(org.monthlySpend)" }
            }
        }
    }

    private func sendInvoice() async {
        guard let api = appState.api else { invoiceError = "Ingen tilkobling."; return }
        invoiceSending = true
        invoiceError = nil
        let amount = Double(invoiceAmount.replacingOccurrences(of: " ", with: "")) ?? 0
        do {
            let inv = try await api.sendLeadgridManualInvoice(
                recipientEmail: invoiceEmail.trimmingCharacters(in: .whitespaces),
                amountNok: amount,
                description: invoiceDesc.isEmpty ? nil : invoiceDesc,
                orgLabel: org.name,
                organizationId: org.serverId
            )
            invoiceResult = inv
        } catch {
            invoiceError = "Kunne ikke sende faktura. Prøv igjen."
        }
        invoiceSending = false
    }

    private func stripeRow(_ label: String, value: String, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(LBrand.purpleLight).frame(width: 18)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.appScaled(size: 10)).foregroundStyle(LBrand.textSecondary)
                Text(value).font(.appScaled(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
    }

    // MARK: Tab — Audit

    /// Demo: illustrative mock-hendelser. Ekte modus: KUN rader fra
    /// superadmin_audit_log — oppdiktede «Lars Kristensen»-hendelser på
    /// en ekte kunde-org er villedende.
    @ViewBuilder
    private var auditTab: some View {
        if org.serverId != nil, !DemoModeManager.isActiveNonisolated {
            realAuditList
        } else {
            mockAuditList
        }
    }

    @ViewBuilder
    private var realAuditList: some View {
        VStack(spacing: 8) {
            if let realAuditError {
                Label(realAuditError, systemImage: "exclamationmark.triangle.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
            } else if realAuditEntries.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.appScaled(size: 26)).foregroundStyle(LBrand.textTertiary)
                    Text("Ingen audit-hendelser enda")
                        .font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
                    Text("Endringer i tilganger, plan og impersonation logges her.")
                        .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
            } else {
                ForEach(realAuditEntries, id: \.id) { entry in
                    auditEntry(
                        auditTitle(entry),
                        actor: entry.superAdminEmail ?? "Ukjent",
                        time: auditTime(entry.createdAt),
                        icon: auditIcon(entry.action).0,
                        tint: auditIcon(entry.action).1
                    )
                }
            }
        }
        .task { await loadRealAudit() }
    }

    private var mockAuditList: some View {
        VStack(spacing: 8) {
            auditEntry("Endret plan fra Pro til Enterprise", actor: "Lars Kristensen (Leadgrid)",
                       time: "2 t siden", icon: "arrow.up.right.circle.fill", tint: LBrand.green)
            auditEntry("Reduserte usage-limit på Leads fra 1000 til 500",
                       actor: "Marit Hansen (Leadgrid)", time: "i går 13:22",
                       icon: "minus.circle.fill", tint: LBrand.orange)
            auditEntry("Aktiverte Pondus-modul som addon",
                       actor: "Lars Kristensen (Leadgrid)", time: "i går 09:18",
                       icon: "plus.circle.fill", tint: LBrand.purpleLight)
            auditEntry("Stripe webhook: invoice.paid",
                       actor: "System", time: "27. juni",
                       icon: "checkmark.seal.fill", tint: LBrand.green)
            auditEntry("Logget inn som org-admin (impersonation)",
                       actor: "Lars Kristensen (Leadgrid)", time: "25. juni",
                       icon: "person.badge.shield.exclamationmark.fill", tint: LBrand.red)
            auditEntry("Org opprettet — trial startet",
                       actor: "System", time: longDate(org.createdAt),
                       icon: "sparkles", tint: LBrand.yellow)
        }
    }

    private func loadRealAudit() async {
        guard let sid = org.serverId, let api = appState.api else { return }
        do {
            let resp = try await api.fetchSuperAdminAuditLog(orgId: sid)
            realAuditEntries = resp.entries
            realAuditError = nil
        } catch {
            realAuditError = "Kunne ikke hente audit-logg"
        }
    }

    private func auditTitle(_ entry: SuperAdminAuditEntryDTO) -> String {
        switch entry.action {
        case "update_entitlements":
            if let count = entry.details?.count {
                return "Oppdaterte tilgangs-matrisen (\(count) features)"
            }
            return "Oppdaterte tilgangs-matrisen"
        case "create_organization": return "Opprettet organisasjonen"
        case "switch_org_context": return "Byttet org-kontekst"
        case "impersonate_user": return "Logget inn som org-admin (impersonation)"
        case "invite_org_admin": return "Inviterte org-admin"
        default: return entry.action
        }
    }

    private func auditIcon(_ action: String) -> (String, Color) {
        switch action {
        case "update_entitlements": return ("checkmark.shield.fill", LBrand.orange)
        case "create_organization": return ("sparkles", LBrand.yellow)
        case "impersonate_user": return ("person.badge.shield.exclamationmark.fill", LBrand.red)
        case "invite_org_admin": return ("envelope.fill", LBrand.blue)
        default: return ("clock.arrow.circlepath", LBrand.textSecondary)
        }
    }

    private func auditTime(_ iso: String?) -> String {
        guard let iso else { return "—" }
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fmt.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        let out = DateFormatter()
        out.dateFormat = "d. MMM HH:mm"
        out.locale = Locale(identifier: "nb_NO")
        return out.string(from: date)
    }

    private func auditEntry(_ title: String, actor: String, time: String, icon: String, tint: Color) -> some View {
        HStack(alignment: .top, spacing: 11) {
            ZStack {
                Circle().fill(tint.opacity(0.22))
                Image(systemName: icon).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.appScaled(size: 12)).foregroundStyle(.white)
                HStack(spacing: 5) {
                    Image(systemName: "person.fill").font(.appScaled(size: 8))
                    Text(actor).font(.appScaled(size: 10, weight: .semibold))
                    Text("·").foregroundStyle(LBrand.textTertiary)
                    Text(time).font(.appScaled(size: 10))
                }
                .foregroundStyle(LBrand.textTertiary)
            }
            Spacer()
        }
        .padding(11)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
    }

    private func shortDate(_ d: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "d.M.yy"
        return fmt.string(from: d)
    }
    private func longDate(_ d: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "d. MMM yyyy"
        fmt.locale = Locale(identifier: "nb_NO")
        return fmt.string(from: d)
    }
}

// MARK: - GlobalAuditSheet — audit-logg på tvers av alle orgs

struct GlobalAuditSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var entries: [SuperAdminAuditEntryDTO] = []
    @State private var loadError: String?
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 8) {
                        if let loadError {
                            Label(loadError, systemImage: "exclamationmark.triangle.fill")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(LBrand.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                        } else if loaded && entries.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "clock.arrow.circlepath")
                                    .font(.appScaled(size: 26)).foregroundStyle(LBrand.textTertiary)
                                Text("Ingen audit-hendelser enda")
                                    .font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                        } else {
                            ForEach(entries, id: \.id) { e in
                                HStack(alignment: .top, spacing: 11) {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .font(.appScaled(size: 11, weight: .bold))
                                        .foregroundStyle(LBrand.orange)
                                        .frame(width: 26, height: 26)
                                        .background(LBrand.orange.opacity(0.15), in: Circle())
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(e.action)
                                            .font(.appScaled(size: 12, weight: .semibold))
                                            .foregroundStyle(.white)
                                        Text("\(e.orgName ?? "—") · \(e.superAdminEmail ?? "ukjent") · \(e.createdAt?.prefix(16) ?? "—")")
                                            .font(.appScaled(size: 10))
                                            .foregroundStyle(LBrand.textTertiary)
                                    }
                                    Spacer()
                                }
                                .padding(11)
                                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Audit-logg — alle orgs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
            }
            .task {
                guard let api = appState.api else {
                    loadError = "Ingen API-klient"
                    return
                }
                do {
                    entries = try await api.fetchSuperAdminAuditLog(limit: 100).entries
                    loaded = true
                } catch {
                    loadError = "Kunne ikke hente audit-logg"
                }
            }
        }
    }
}

// MARK: - EntitlementMatrixSheet

struct EntitlementMatrixSheet: View {
    @Binding var org: Organization
    var onClose: ([Entitlement]) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var changed: Int = 0
    // Toggle-tappene skriver LIVE inn i parent-bindingen (`org.entitlements`).
    // Uten dette snapshot-et lot «Avbryt» fantom-endringene bli stående i
    // OrgDetailSheet (summary-tiles + GDPR-eksport viste ulagrede edits, og
    // en senere «Lagre» ville persistert dem). Snapshot ved åpning →
    // restore ved Avbryt.
    @State private var snapshot: [Entitlement] = []

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        header
                        ForEach(LeadgridFeature.Group.allCases) { g in
                            groupSection(g)
                        }
                        Color.clear.frame(height: 30)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Rediger entitlements")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { if snapshot.isEmpty { snapshot = org.entitlements } }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") {
                        org.entitlements = snapshot  // forkast ulagrede edits
                        dismiss()
                    }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        onClose(org.entitlements)
                        dismiss()
                    } label: {
                        Text("Lagre").font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(
                                LinearGradient(colors: [LBrand.orange, LBrand.orange.opacity(0.7)],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                    }
                    .accessibilityIdentifier("matrix-lagre")
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 7) {
                Image(systemName: "checkmark.shield.fill").foregroundStyle(LBrand.orange)
                Text("\(org.name.uppercased()) · TILGANGS-MATRISE")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.orange).tracking(0.8)
            }
            Text("Sett tilstand per funksjon. «Inkludert» = del av plan. «Tillegg» = addon m/ pris. «Trial» = tidsbegrenset. «Sperret» = ikke tilgang.")
                .font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
        }
    }

    private func groupSection(_ g: LeadgridFeature.Group) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 6) {
                Image(systemName: g.icon).foregroundStyle(g.tint)
                Text(g.rawValue.uppercased())
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(g.tint).tracking(0.6)
            }
            VStack(spacing: 6) {
                ForEach(Array(org.entitlements.enumerated()), id: \.element.id) { idx, ent in
                    if ent.feature.group == g {
                        matrixRow(idx: idx)
                    }
                }
            }
        }
    }

    private func matrixRow(idx: Int) -> some View {
        let ent = org.entitlements[idx]
        return HStack(spacing: 10) {
            Image(systemName: ent.feature.icon).font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(ent.state.color).frame(width: 18)
            Text(ent.feature.rawValue).font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
            Spacer()
            HStack(spacing: 2) {
                ForEach(EntitlementState.allCases) { state in
                    Button {
                        org.entitlements[idx].state = state
                        changed += 1
                    } label: {
                        Image(systemName: state.icon).font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(ent.state == state ? .white : state.color.opacity(0.7))
                            .frame(width: 30, height: 28)
                            .background(ent.state == state ? state.color.opacity(0.32) : .clear, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("matrix-\(idx)-\(state.rawValue)")
                }
            }
            .padding(3)
            .background(LBrand.cardHi, in: Capsule())
            .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
        }
        .padding(8)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 9))
    }
}

// MARK: - PlanChangeSheet

struct PlanChangeSheet: View {
    @Binding var org: Organization
    /// true når org-en er ekte (ikke demo-mock). Da finnes det INGEN plan-
    /// endepunkt enda, så vi persisterer ikke — og later ikke som.
    var isReal: Bool = false
    var onChange: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var newPlan: SubscriptionPlan

    init(org: Binding<Organization>, isReal: Bool = false, onChange: @escaping () -> Void) {
        self._org = org
        self.isReal = isReal
        self.onChange = onChange
        self._newPlan = State(initialValue: org.wrappedValue.plan)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("ENDRE PLAN").font(.appScaled(size: 10, weight: .black))
                            .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                        if isReal {
                            // Ærlig: plan-bytte har ingen backend enda. Ikke
                            // lov pro-rata-fakturering vi ikke utfører.
                            Label("Plan-bytte lagres ikke enda — bruk tilgangs-matrisen for å styre faktisk tilgang. Denne velgeren er forhåndsvisning.",
                                  systemImage: "info.circle.fill")
                                .font(.appScaled(size: 12)).foregroundStyle(LBrand.yellow)
                                .padding(10)
                                .background(LBrand.yellow.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                        } else {
                            Text("Velg ny plan for \(org.name). Pris justeres pro-rata på neste faktura.")
                                .font(.appScaled(size: 13)).foregroundStyle(LBrand.textSecondary)
                        }
                        VStack(spacing: 10) {
                            ForEach(SubscriptionPlan.allCases) { p in
                                Button { newPlan = p } label: {
                                    HStack(spacing: 12) {
                                        ZStack {
                                            Circle().fill(p.tint.opacity(0.22))
                                            Image(systemName: "sparkles").font(.appScaled(size: 13, weight: .bold))
                                                .foregroundStyle(p.tint)
                                        }
                                        .frame(width: 36, height: 36)
                                        VStack(alignment: .leading, spacing: 2) {
                                            HStack(spacing: 7) {
                                                Text(p.rawValue).font(.appScaled(size: 14, weight: .bold))
                                                    .foregroundStyle(.white)
                                                if org.plan == p {
                                                    Text("NÅVÆRENDE")
                                                        .font(.appScaled(size: 8, weight: .black))
                                                        .foregroundStyle(LBrand.green).tracking(0.5)
                                                        .padding(.horizontal, 5).padding(.vertical, 1)
                                                        .background(LBrand.green.opacity(0.18), in: Capsule())
                                                }
                                            }
                                            Text(p.description).font(.appScaled(size: 11))
                                                .foregroundStyle(LBrand.textSecondary).lineLimit(2)
                                            Text(p.monthlyPrice == 0 ? "Kontakt salg" : "\(p.monthlyPrice) kr/mnd")
                                                .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                                                .foregroundStyle(LBrand.green)
                                        }
                                        Spacer()
                                        Image(systemName: newPlan == p ? "largecircle.fill.circle" : "circle")
                                            .font(.appScaled(size: 18))
                                            .foregroundStyle(newPlan == p ? p.tint : LBrand.textTertiary)
                                    }
                                    .padding(12)
                                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(newPlan == p ? p.tint.opacity(0.5) : LBrand.stroke, lineWidth: 1))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Endre plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        // Ekte org: IKKE nullstill entitlements — det ville
                        // forkastet server-overrides lokalt og en påfølgende
                        // matrise-«Lagre» ville pushet plan-defaults. Demo:
                        // behold den illustrative lokale oppførselen.
                        if !isReal {
                            org.plan = newPlan
                            org.entitlements = PlanDefaults.allEntitlements(for: newPlan)
                        }
                        onChange()
                        dismiss()
                    } label: {
                        Text(isReal ? "Lukk forhåndsvisning" : "Bekreft endring")
                            .font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(
                                LinearGradient(colors: [LBrand.orange, LBrand.orange.opacity(0.7)],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                            .opacity((!isReal && newPlan == org.plan) ? 0.45 : 1)
                    }
                    .disabled(!isReal && newPlan == org.plan)
                }
            }
        }
    }
}

// MARK: - ImpersonationSheet

struct ImpersonationSheet: View {
    let org: Organization
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var ackPolicy = false
    @State private var ackAudit = false
    @State private var starting = false
    @State private var startError: String?

    /// Kaller ekte switch-context (audited backend) og bytter aktiv org
    /// slik at appen faktisk viser org-ens data. Demo-org (uten serverId)
    /// har ingenting å bytte til → bare lukk.
    private func startImpersonation() {
        guard let sid = org.serverId, let api = appState.api else {
            dismiss(); return
        }
        starting = true
        Task {
            do {
                try await api.switchOrgContext(sid, reason: "SuperAdmin impersonation")
                appState.activeOrganizationId = sid  // didSet → full refresh + entitlements
                starting = false
                dismiss()
            } catch {
                startError = "Kunne ikke starte impersonation"
                starting = false
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        warningCard
                        VStack(alignment: .leading, spacing: 10) {
                            Text("OM IMPERSONATION").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            policyRow(icon: "eye.fill", text: "Du vil se akkurat det org-admin ser — full app-tilgang som deres bruker.")
                            policyRow(icon: "lock.fill", text: "Du kan ikke endre passord, slette data eller flytte penger. Read + write på UI-nivå, men ikke admin-handlinger.")
                            policyRow(icon: "clock.fill", text: "Kontekst-sesjonen utløper automatisk etter 2 timer.")
                            policyRow(icon: "doc.text.fill", text: "Byttet logges i Leadgrid-intern audit-trail (superadmin_audit_log).")
                        }
                        if let startError {
                            Label(startError, systemImage: "exclamationmark.triangle.fill")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(LBrand.red)
                        }
                        VStack(spacing: 10) {
                            Toggle(isOn: $ackPolicy) {
                                Text("Jeg har lest og forstått retningslinjene for impersonation.")
                                    .font(.appScaled(size: 12)).foregroundStyle(.white)
                            }
                            Toggle(isOn: $ackAudit) {
                                Text("Jeg forstår at alt jeg gjør logges i audit-trail.")
                                    .font(.appScaled(size: 12)).foregroundStyle(.white)
                            }
                        }
                        .tint(LBrand.orange)
                        .padding(14)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Logg inn som org-admin")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { startImpersonation() } label: {
                        HStack(spacing: 6) {
                            if starting {
                                ProgressView().tint(.white).scaleEffect(0.8)
                            } else {
                                Image(systemName: "person.badge.shield.exclamationmark.fill")
                                    .font(.appScaled(size: 11))
                            }
                            Text("Start impersonation").font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(
                            LinearGradient(colors: [LBrand.red, LBrand.orange],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .opacity((ackPolicy && ackAudit && !starting) ? 1 : 0.45)
                    }
                    .disabled(!(ackPolicy && ackAudit) || starting)
                }
            }
        }
    }

    private var warningCard: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LBrand.red.opacity(0.22))
                Image(systemName: "exclamationmark.shield.fill").font(.appScaled(size: 16, weight: .bold))
                    .foregroundStyle(LBrand.red)
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 3) {
                Text("DU SKAL FORLATE LEADGRID-MILJØET")
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.red).tracking(0.8)
                Text("Du logger inn som org-admin hos \(org.name). De vil få beskjed om at en Leadgrid-ansatt ser data deres.")
                    .font(.appScaled(size: 12)).foregroundStyle(.white)
            }
            Spacer()
        }
        .padding(14)
        .background(LBrand.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.red.opacity(0.35), lineWidth: 1))
    }

    private func policyRow(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            Image(systemName: icon).font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(LBrand.orange).frame(width: 18)
            Text(text).font(.appScaled(size: 12)).foregroundStyle(.white)
            Spacer()
        }
        .padding(10)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
    }
}
