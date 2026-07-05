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
    static func entitlement(for feature: LeadgridFeature, plan: SubscriptionPlan) -> Entitlement {
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
            }
            if feature == .leads { limit = 500 }
        case .pro:
            switch feature.group {
            case .admin:
                state = (feature == .varsler || feature == .integrasjoner) ? .included : .locked
            case .analyseAI:
                // Pro: alle analyse-features inkludert, AI-formel som trial (14 dager)
                state = (feature == .teamAIFormulaSuggest) ? .trial : .included
            default: state = .included
            }
        case .enterprise: state = .included
        case .custom: state = .included
        }
        return Entitlement(
            feature: feature,
            state: state,
            monthlyLimit: limit,
            currentUsage: Int.random(in: 0...(limit ?? 200)),
            trialEndsAt: state == .trial ? Calendar.current.date(byAdding: .day, value: 14, to: Date()) : nil,
            addOnPriceMonthly: state == .addOn ? 990 : nil
        )
    }

    static func allEntitlements(for plan: SubscriptionPlan) -> [Entitlement] {
        LeadgridFeature.allCases.map { entitlement(for: $0, plan: plan) }
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
            notes: "⚠️ Fakturert 2 mnd uten betaling. Risiko-tagg.",
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
    @State private var orgs: [Organization] = SuperAdminData.organizations
    @State private var search: String = ""
    @State private var planFilter: SubscriptionPlan?
    @State private var billingFilter: Organization.BillingStatus?
    @State private var selectedOrg: Organization?
    @State private var sort: Sort = .revenue
    @State private var showDemoMode = false

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
                            Button {} label: { Label("Eksporter MRR-rapport", systemImage: "tablecells") }
                            Button {} label: { Label("Send Stripe-sync-trigger", systemImage: "arrow.triangle.2.circlepath") }
                            Button {} label: { Label("Funksjons-katalog", systemImage: "shippingbox.fill") }
                            Divider()
                            Button {} label: { Label("Audit-logg (alle orgs)", systemImage: "clock.arrow.circlepath") }
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
        }
        .macCatalystSheetSize(minWidth: 1100, minHeight: 800)
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

    private var kpiRow: some View {
        HStack(spacing: 10) {
            kpiTile("Antall orgs", "\(orgs.count)", "building.2.fill", LBrand.purpleLight)
            kpiTile("MRR", "\(totalMRR / 1000) k", "banknote.fill", LBrand.green)
            kpiTile("Brukere totalt", "\(totalUsers)", "person.3.fill", LBrand.blue)
            kpiTile("Renewal 30d", "\(renewing30dCount)", "calendar.badge.clock", LBrand.yellow)
            kpiTile("At risk", "\(atRiskCount)", "exclamationmark.triangle.fill", LBrand.red)
        }
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
    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab = .oversikt
    @State private var showEntitlementMatrix = false
    @State private var showPlanChange = false
    @State private var showImpersonate = false
    @State private var toast: String?

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
                        Label(t, systemImage: "checkmark.circle.fill")
                            .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(LBrand.green, in: Capsule())
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
                        Button {} label: { Label("Eksporter org-data (GDPR)", systemImage: "square.and.arrow.up") }
                        Button(role: .destructive) {} label: { Label("Suspender org", systemImage: "pause.circle.fill") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(LBrand.orange)
                    }
                }
            }
            .sheet(isPresented: $showEntitlementMatrix) {
                EntitlementMatrixSheet(org: $org) { updated in
                    toast = "\(updated.count) tilganger oppdatert"
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
                    onUpdate(org)
                }
            }
            .sheet(isPresented: $showPlanChange) {
                PlanChangeSheet(org: $org) {
                    toast = "Plan endret til \(org.plan.rawValue)"
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
                    onUpdate(org)
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

    private var tabBar: some View {
        HStack(spacing: 4) {
            ForEach(Tab.allCases) { t in
                Button { withAnimation(.easeInOut(duration: 0.15)) { tab = t } } label: {
                    HStack(spacing: 6) {
                        Image(systemName: t.icon).font(.appScaled(size: 11, weight: .bold))
                        Text(t.rawValue).font(.appScaled(size: 12, weight: tab == t ? .bold : .semibold))
                    }
                    .foregroundStyle(tab == t ? .white : LBrand.textSecondary)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(tab == t ? LBrand.orange.opacity(0.22) : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.horizontal, 16).padding(.bottom, 10)
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

    private var faktureringTab: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                statBox("MRR", "\(org.monthlySpend) kr", "banknote.fill", LBrand.green)
                statBox("ARR", "\(org.monthlySpend * 12 / 1000) k kr", "calendar", LBrand.purpleLight)
                statBox("Status", org.billingStatus.rawValue, "creditcard.fill", org.billingStatus.color)
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("STRIPE-INTEGRASJON")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                VStack(spacing: 8) {
                    stripeRow("Customer-ID", value: "cus_NXR9bK8mY3", icon: "person.badge.key.fill")
                    stripeRow("Subscription-ID", value: "sub_1OqK8m...", icon: "arrow.triangle.2.circlepath")
                    stripeRow("Default-betalingsmetode", value: "VISA •••• 4242", icon: "creditcard.fill")
                    stripeRow("Neste faktura", value: longDate(org.contractRenewal), icon: "calendar.badge.clock")
                }
            }
            .padding(14)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))

            HStack(spacing: 10) {
                Button {} label: {
                    HStack(spacing: 5) {
                        Image(systemName: "doc.text.fill").font(.appScaled(size: 11, weight: .bold))
                        Text("Send manuell faktura").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)
                Button {} label: {
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
        }
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

    private var auditTab: some View {
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

// MARK: - EntitlementMatrixSheet

struct EntitlementMatrixSheet: View {
    @Binding var org: Organization
    var onClose: ([Entitlement]) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var changed: Int = 0

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
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
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
                    }.buttonStyle(.plain)
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
    var onChange: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var newPlan: SubscriptionPlan

    init(org: Binding<Organization>, onChange: @escaping () -> Void) {
        self._org = org
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
                        Text("Velg ny plan for \(org.name). Pris justeres pro-rata på neste faktura.")
                            .font(.appScaled(size: 13)).foregroundStyle(LBrand.textSecondary)
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
                        org.plan = newPlan
                        org.entitlements = PlanDefaults.allEntitlements(for: newPlan)
                        onChange()
                        dismiss()
                    } label: {
                        Text("Bekreft endring").font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(
                                LinearGradient(colors: [LBrand.orange, LBrand.orange.opacity(0.7)],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                            .opacity(newPlan == org.plan ? 0.45 : 1)
                    }
                    .disabled(newPlan == org.plan)
                }
            }
        }
    }
}

// MARK: - ImpersonationSheet

struct ImpersonationSheet: View {
    let org: Organization
    @Environment(\.dismiss) private var dismiss
    @State private var ackPolicy = false
    @State private var ackAudit = false

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
                            policyRow(icon: "clock.fill", text: "Sesjonen utløper etter 30 minutter. Du må forlenge manuelt.")
                            policyRow(icon: "doc.text.fill", text: "Alt du gjør logges i org-ens audit-trail og i Leadgrid-intern audit.")
                            policyRow(icon: "person.crop.circle.badge.exclamationmark", text: "Org-admin vil se en notifikasjon: «Leadgrid-ansatt ser data nå».")
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
                    Button { dismiss() } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "person.badge.shield.exclamationmark.fill")
                                .font(.appScaled(size: 11))
                            Text("Start impersonation").font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(
                            LinearGradient(colors: [LBrand.red, LBrand.orange],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .opacity((ackPolicy && ackAudit) ? 1 : 0.45)
                    }
                    .disabled(!(ackPolicy && ackAudit))
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
