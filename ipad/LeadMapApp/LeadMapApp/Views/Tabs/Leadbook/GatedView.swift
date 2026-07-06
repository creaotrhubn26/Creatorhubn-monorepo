// GatedView.swift — Runtime feature-gating som binder SuperAdmin til UI (2026-06-30)
//
// EntitlementStore holder gjeldende org's tilganger og overstyrer per plan.
// GatedView pakker innhold og viser UpsellSheet hvis brukeren ikke har tilgang.
// PlanSwitcher (demo-modus) lar deg se appen som Starter/Pro/Enterprise-kunde.

import SwiftUI

// MARK: - Entitlement-store

@MainActor
final class EntitlementStore: ObservableObject {
    static let shared = EntitlementStore()

    @Published var currentPlan: SubscriptionPlan = .enterprise
    @Published var entitlements: [LeadgridFeature: Entitlement] = [:]
    @Published var demoMode: Bool = false
    /// true når backend har levert ekte overrides for brukerens org
    /// (`/api/leadgrid/me/entitlements`). Da gater vi på dem — også
    /// utenfor demo-modus. Ingen rader = alt åpent (bakoverkompatibelt).
    @Published var hasServerEntitlements = false

    private init() { applyPlan(.enterprise) }

    func access(_ feature: LeadgridFeature) -> EntitlementState {
        if demoMode { return entitlements[feature]?.state ?? .locked }
        if hasServerEntitlements {
            // Manglende nøkkel = feature lansert etter forrige lagring —
            // åpen til SuperAdmin sier noe annet.
            return entitlements[feature]?.state ?? .included
        }
        // Ingen server-data og ikke demo: alt åpent (utvikler/legacy-org).
        return .included
    }

    /// Ekte overrides fra backend. Tom liste rører ingenting.
    func applyServer(_ envelope: OrgEntitlementsEnvelope) {
        guard !envelope.entitlements.isEmpty else {
            hasServerEntitlements = false
            return
        }
        // Bær ekte plan fra backend så upsell/locked-tekst ikke lyver om
        // «Din nåværende plan er Enterprise» for en Starter-org.
        if let planStr = envelope.plan,
           let plan = SubscriptionPlan.allCases.first(where: {
               $0.rawValue.lowercased() == planStr.lowercased()
           }) {
            currentPlan = plan
        }
        let isoParser = ISO8601DateFormatter()
        var dict: [LeadgridFeature: Entitlement] = [:]
        for row in envelope.entitlements {
            guard let feature = LeadgridFeature.fromKey(row.featureKey),
                  let state = EntitlementState.fromAPI(row.state) else { continue }
            dict[feature] = Entitlement(
                feature: feature,
                state: state,
                monthlyLimit: row.monthlyLimit,
                currentUsage: 0,
                // Ekte trial-slutt fra backend (før: nil → hardkodet
                // «8 dager igjen» i banneret).
                trialEndsAt: row.trialEndsAt.flatMap(isoParser.date(from:)),
                addOnPriceMonthly: row.addonPriceMonthly
            )
        }
        // Fail-CLOSED ved decode-drift: hvis backend sendte rader men
        // INGEN dekodet (f.eks. enum-case omdøpt i en nyere/eldre app-
        // versjon), ville et tomt dict + hasServerEntitlements=true låst
        // opp ALT (access() defaulter til .included på manglende nøkkel).
        // Behold da forrige tilstand og flagg — ikke lås opp stille.
        guard !dict.isEmpty else {
            print("[EntitlementStore] \(envelope.entitlements.count) rader men 0 dekodet — beholder eksisterende (fail-closed)")
            return
        }
        entitlements = dict
        hasServerEntitlements = true
    }

    func canUse(_ feature: LeadgridFeature) -> Bool {
        switch access(feature) {
        case .included, .trial, .addOn: return true
        case .locked: return false
        }
    }

    func limit(_ feature: LeadgridFeature) -> (used: Int, limit: Int)? {
        guard let ent = entitlements[feature], let max = ent.monthlyLimit else { return nil }
        return (ent.currentUsage, max)
    }

    func applyPlan(_ plan: SubscriptionPlan) {
        currentPlan = plan
        let ents = PlanDefaults.allEntitlements(for: plan)
        entitlements = Dictionary(uniqueKeysWithValues: ents.map { ($0.feature, $0) })
    }

    func suggestedUpgradePlan(for feature: LeadgridFeature) -> SubscriptionPlan {
        // Den minste planen som har feature som .included
        for plan in [SubscriptionPlan.starter, .pro, .enterprise, .custom] {
            let ent = PlanDefaults.entitlement(for: feature, plan: plan)
            if ent.state == .included { return plan }
        }
        return .custom
    }
}

// MARK: - GatedView

struct GatedView<Content: View>: View {
    let feature: LeadgridFeature
    @ViewBuilder var content: () -> Content
    @ObservedObject private var store = EntitlementStore.shared
    @State private var showUpsell = false

    var body: some View {
        Group {
            switch store.access(feature) {
            case .included:
                content()
            case .trial:
                ZStack(alignment: .top) {
                    content()
                    trialBanner
                        .padding(.horizontal, 20).padding(.top, 8)
                }
            case .addOn:
                ZStack(alignment: .top) {
                    content().opacity(0.85)
                    addOnBanner
                        .padding(.horizontal, 20).padding(.top, 8)
                }
            case .locked:
                lockedPlaceholder
            }
        }
        .sheet(isPresented: $showUpsell) {
            UpsellSheet(feature: feature)
        }
    }

    /// Ekte gjenstående trial-dager fra backend. nil = ubestemt (vis bare
    /// «TRIAL» uten oppdiktet tall — ALDRI en hardkodet «8 dager»).
    private var trialDaysLeft: Int? {
        guard let ends = store.entitlements[feature]?.trialEndsAt else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Date(), to: ends).day ?? 0
        return max(0, days)
    }

    private var trialBanner: some View {
        HStack(spacing: 7) {
            Image(systemName: "clock.fill").foregroundStyle(LBrand.yellow)
            Text(trialDaysLeft.map { "TRIAL — \($0) dager igjen" } ?? "TRIAL")
                .font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.yellow).tracking(0.7)
            Spacer()
            Button { showUpsell = true } label: {
                Text("Kjøp nå").font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(LBrand.yellow, in: Capsule())
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 11).padding(.vertical, 6)
        .background(LBrand.yellow.opacity(0.15), in: Capsule())
        .overlay(Capsule().stroke(LBrand.yellow.opacity(0.4), lineWidth: 1))
    }

    /// Ekte addon-pris fra backend. nil = vis bare «ADDON» uten pris
    /// (ALDRI hardkodet «990 kr» som kan avvike fra faktisk fakturering).
    private var addOnLabel: String {
        if let price = store.entitlements[feature]?.addOnPriceMonthly, price > 0 {
            return "ADDON · \(price) kr/mnd"
        }
        return "ADDON"
    }

    private var addOnBanner: some View {
        HStack(spacing: 7) {
            Image(systemName: "plus.circle.fill").foregroundStyle(LBrand.blue)
            Text(addOnLabel).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.blue).tracking(0.7)
            Spacer()
            Button { showUpsell = true } label: {
                Text("Aktiver").font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(LBrand.blue, in: Capsule())
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 11).padding(.vertical, 6)
        .background(LBrand.blue.opacity(0.15), in: Capsule())
        .overlay(Capsule().stroke(LBrand.blue.opacity(0.4), lineWidth: 1))
    }

    private var lockedPlaceholder: some View {
        VStack(spacing: 18) {
            Spacer().frame(height: 20)
            ZStack {
                Circle().fill(LBrand.purpleLight.opacity(0.18)).frame(width: 90, height: 90)
                Image(systemName: "lock.fill")
                    .font(.appScaled(size: 36, weight: .bold))
                    .foregroundStyle(LBrand.purpleLight)
            }
            VStack(spacing: 6) {
                Text("«\(feature.rawValue)» er ikke i din plan")
                    .font(.appScaled(size: 18, weight: .heavy))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Text("Din nåværende plan er \(store.currentPlan.rawValue). Oppgrader til \(store.suggestedUpgradePlan(for: feature).rawValue) eller høyere for å låse opp.")
                    .font(.appScaled(size: 13))
                    .foregroundStyle(LBrand.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)
            }
            HStack(spacing: 10) {
                Button { showUpsell = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles").font(.appScaled(size: 12, weight: .bold))
                        Text("Se oppgraderingsalternativer").font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                    .shadow(color: LBrand.purple.opacity(0.45), radius: 8, y: 3)
                }.buttonStyle(.plain)
            }
            HStack(spacing: 7) {
                Image(systemName: "envelope.fill").font(.appScaled(size: 11))
                Text("Spørsmål? Kontakt din Leadgrid-CSM")
                    .font(.appScaled(size: 11))
            }
            .foregroundStyle(LBrand.textTertiary)
            .padding(.top, 4)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.vertical, 60)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                .foregroundStyle(LBrand.purple.opacity(0.35))
        )
    }
}

// MARK: - UpsellSheet

struct UpsellSheet: View {
    let feature: LeadgridFeature
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var store = EntitlementStore.shared
    @State private var selectedPlan: SubscriptionPlan?

    private var suggestedPlan: SubscriptionPlan {
        store.suggestedUpgradePlan(for: feature)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        hero
                        availabilityCard
                        Text("VELG PLAN").font(.appScaled(size: 10, weight: .black))
                            .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                        ForEach(SubscriptionPlan.allCases) { plan in
                            planCard(plan)
                        }
                        contactCSM
                        Color.clear.frame(height: 12)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Oppgrader")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if let p = selectedPlan, p != store.currentPlan {
                        Button {
                            store.applyPlan(p)
                            dismiss()
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "checkmark").font(.appScaled(size: 11, weight: .black))
                                Text("Bekreft \(p.rawValue)").font(.appScaled(size: 12, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                        }.buttonStyle(.plain)
                    }
                }
            }
            .onAppear { selectedPlan = suggestedPlan }
        }
    }

    private var hero: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [LBrand.purple.opacity(0.35), LBrand.purpleLight.opacity(0.20)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                Image(systemName: feature.icon)
                    .font(.appScaled(size: 32, weight: .bold))
                    .foregroundStyle(LBrand.purpleLight)
            }
            .frame(width: 90, height: 90)
            VStack(spacing: 6) {
                Text("Lås opp «\(feature.rawValue)»")
                    .font(.appScaled(size: 22, weight: .heavy))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Text(featureDescription)
                    .font(.appScaled(size: 13))
                    .foregroundStyle(LBrand.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
    }

    private var availabilityCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("TILGJENGELIG I").font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            HStack(spacing: 8) {
                ForEach(SubscriptionPlan.allCases) { plan in
                    let ent = PlanDefaults.entitlement(for: feature, plan: plan)
                    HStack(spacing: 4) {
                        Image(systemName: ent.state.icon).font(.appScaled(size: 9, weight: .bold))
                        Text(plan.rawValue).font(.appScaled(size: 10, weight: .bold))
                    }
                    .foregroundStyle(ent.state.color)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(ent.state.color.opacity(0.16), in: Capsule())
                    .overlay(Capsule().stroke(ent.state.color.opacity(0.4), lineWidth: 1))
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
    }

    private func planCard(_ plan: SubscriptionPlan) -> some View {
        let ent = PlanDefaults.entitlement(for: feature, plan: plan)
        let isCurrent = store.currentPlan == plan
        let isSuggested = plan == suggestedPlan && !isCurrent
        let isSelected = selectedPlan == plan
        return Button { selectedPlan = plan } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10).fill(plan.tint.opacity(0.22))
                        Image(systemName: "sparkles").font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(plan.tint)
                    }
                    .frame(width: 38, height: 38)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(plan.rawValue).font(.appScaled(size: 16, weight: .bold))
                                .foregroundStyle(.white)
                            if isCurrent {
                                Text("NÅVÆRENDE").font(.appScaled(size: 8, weight: .black))
                                    .foregroundStyle(LBrand.green).tracking(0.5)
                                    .padding(.horizontal, 5).padding(.vertical, 1)
                                    .background(LBrand.green.opacity(0.18), in: Capsule())
                            }
                            if isSuggested {
                                Text("ANBEFALT").font(.appScaled(size: 8, weight: .black))
                                    .foregroundStyle(LBrand.purpleLight).tracking(0.5)
                                    .padding(.horizontal, 5).padding(.vertical, 1)
                                    .background(LBrand.purple.opacity(0.18), in: Capsule())
                            }
                        }
                        Text(plan.description).font(.appScaled(size: 11))
                            .foregroundStyle(LBrand.textSecondary).lineLimit(2)
                    }
                    Spacer()
                    Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                        .font(.appScaled(size: 20)).foregroundStyle(isSelected ? plan.tint : LBrand.textTertiary)
                }
                HStack(spacing: 10) {
                    HStack(spacing: 4) {
                        Text(plan.monthlyPrice == 0 ? "Kontakt salg" : "\(plan.monthlyPrice) kr/mnd")
                            .font(.appScaled(size: 14, weight: .heavy, design: .rounded))
                            .foregroundStyle(LBrand.green)
                    }
                    Spacer()
                    HStack(spacing: 4) {
                        Image(systemName: ent.state.icon).font(.appScaled(size: 10, weight: .bold))
                        Text(ent.state.rawValue).font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(ent.state.color)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(ent.state.color.opacity(0.15), in: Capsule())
                    .overlay(Capsule().stroke(ent.state.color.opacity(0.4), lineWidth: 1))
                }
            }
            .padding(14)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? plan.tint.opacity(0.55) : LBrand.stroke, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var contactCSM: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(LBrand.blue.opacity(0.22))
                Image(systemName: "envelope.fill").font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(LBrand.blue)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text("Trenger Custom-avtale?")
                    .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                Text("Snakk med din CSM for volume-rabatt eller skreddersydde tilganger.")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
            Button {
                // Ekte kontaktpunkt — knappen var en tom closure, og dette
                // er flaten kunder treffer når de vil KJØPE mer tilgang.
                let subject = "Leadgrid: oppgradering — \(feature.rawValue)"
                    .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
                if let url = URL(string: "mailto:salg@creatorhubn.com?subject=\(subject)") {
                    UIApplication.shared.open(url)
                }
            } label: {
                Text("Kontakt").font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(LBrand.blue, in: Capsule())
            }.buttonStyle(.plain)
        }
        .padding(12)
        .background(LBrand.blue.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.blue.opacity(0.25), lineWidth: 1))
    }

    private var featureDescription: String {
        switch feature.group {
        case .kjerne: return "Kjernefunksjonalitet i Leadgrid — pipeline-styring og lead-håndtering."
        case .analyseTeam: return "Analyse, team-styring og salgsledelse-verktøy."
        case .leadbook: return "Standardiser salgsprosessen din med maler, scripts og Pondus-coaching."
        case .admin: return "Admin-verktøy for å styre organisasjonen din."
        case .rapportExport: return "Eksport til CSV/PDF, delte rapporter (Slack + e-post) og bulk-handlinger for team-data."
        case .analyseAI: return "AI-drevne innsikts-verktøy: forecast, sammenligning, pipeline-helse og formel-forslag."
        }
    }
}

// MARK: - DemoModeBanner + PlanSwitcher

struct DemoModeBanner: View {
    @ObservedObject private var store = EntitlementStore.shared
    @State private var showSwitcher = false

    var body: some View {
        if store.demoMode {
            Button { showSwitcher = true } label: {
                HStack(spacing: 8) {
                    Image(systemName: "eye.fill").font(.appScaled(size: 11))
                    Text("DEMO-MODUS · Du ser appen som").font(.appScaled(size: 10, weight: .black)).tracking(0.5)
                    Text(store.currentPlan.rawValue.uppercased())
                        .font(.appScaled(size: 11, weight: .black))
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(store.currentPlan.tint.opacity(0.25), in: Capsule())
                        .overlay(Capsule().stroke(store.currentPlan.tint, lineWidth: 1))
                    Spacer()
                    Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(
                    LinearGradient(colors: [LBrand.orange.opacity(0.85), LBrand.red.opacity(0.85)],
                                   startPoint: .leading, endPoint: .trailing)
                )
            }
            .buttonStyle(.plain)
            .sheet(isPresented: $showSwitcher) { PlanSwitcherSheet() }
        }
    }
}

struct PlanSwitcherSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var store = EntitlementStore.shared

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("DEMO-MODUS · TEST GATING")
                                .font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.orange).tracking(0.8)
                            Text("Se appen som en kunde på en bestemt plan")
                                .font(.appScaled(size: 18, weight: .heavy))
                                .foregroundStyle(.white)
                            Text("Med denne knappen kan du som Leadgrid-utvikler test hvordan gating fungerer for hver plan. Sperrede features viser locked-skjerm + upsell-CTA.")
                                .font(.appScaled(size: 12))
                                .foregroundStyle(LBrand.textSecondary)
                        }
                        Toggle(isOn: $store.demoMode) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Aktiver demo-modus").font(.appScaled(size: 13, weight: .bold))
                                    .foregroundStyle(.white)
                                Text(store.demoMode ? "PÅ — du ser appen begrenset" : "AV — du ser alt åpent")
                                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                            }
                        }
                        .tint(LBrand.orange)
                        .padding(14)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))

                        VStack(alignment: .leading, spacing: 8) {
                            Text("VELG PLAN Å SIMULERE")
                                .font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            ForEach(SubscriptionPlan.allCases) { plan in
                                Button { store.applyPlan(plan) } label: {
                                    HStack(spacing: 12) {
                                        ZStack {
                                            Circle().fill(plan.tint.opacity(0.22))
                                            Image(systemName: "sparkles").font(.appScaled(size: 13, weight: .bold))
                                                .foregroundStyle(plan.tint)
                                        }
                                        .frame(width: 36, height: 36)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(plan.rawValue).font(.appScaled(size: 14, weight: .bold))
                                                .foregroundStyle(.white)
                                            Text(plan.description).font(.appScaled(size: 11))
                                                .foregroundStyle(LBrand.textSecondary).lineLimit(2)
                                        }
                                        Spacer()
                                        Image(systemName: store.currentPlan == plan ? "largecircle.fill.circle" : "circle")
                                            .font(.appScaled(size: 16))
                                            .foregroundStyle(store.currentPlan == plan ? plan.tint : LBrand.textTertiary)
                                    }
                                    .padding(12)
                                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(store.currentPlan == plan ? plan.tint.opacity(0.5) : LBrand.stroke, lineWidth: 1))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Demo-modus")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
            }
        }
    }
}

// MARK: - View-extension så bruken er ren

extension View {
    func gated(_ feature: LeadgridFeature) -> some View {
        GatedView(feature: feature) { self }
    }
}
