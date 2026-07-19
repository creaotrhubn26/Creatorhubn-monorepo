// LeadgridGoDashboardView.swift
//
// Leadgrid Go Dashboard — hjemmet for elektronisk kjørebok + kjøretøy.
// Rolle-gating: admin/salgssjef (org velger hvem via team-styring) ser HELE
// team-oversikten (alle sjåførers km/kostnad/kjøretøy). Selgere ser kun sin
// egen kjørebok + registrerer firma-bilen de bruker.
//
// Tilleggstjeneste: hele fanen gates bak `.gated(.leadgridGoKjorebok)`
// (feature-matrise / entitlement). Server håndhever team-endepunktet (403).

import SwiftUI

struct LeadgridGoDashboardView: View {
    /// true når viewet PUSHES inn i en ytre NavigationStack (iPhone Mer-fanen).
    /// Da må vi IKKE lage vår egen NavigationStack — nestet stack i en push
    /// tripper SwiftUI-assertion (SIGTRAP i NavigationColumnState.boundPathChange,
    /// krasjlogg 2026-07-16 14:27, iOS 26.5.2). iPad/sidebar bruker default false.
    var embedded = false

    @Environment(AppState.self) private var appState
    @State private var team: GoTeamResponse?
    @State private var loadingTeam = false
    @State private var showVehicle = false
    @State private var showKjorebok = false
    @State private var showBooking = false
    /// Org-flåten (for «Start kjøring»-kortet — bil tildelt meg).
    @State private var orgFleet: [OrgVehicle] = []
    @State private var store = TripStore.shared
    @State private var detector = TripDetector.shared

    /// Org velger administrator via rolle (admin/salgssjef) — de ser hele teamet.
    private var isGoAdmin: Bool {
        if appState.isSuperAdmin { return true }
        guard let r = appState.roleInOrg else { return false }
        return r == "admin" || r == "salgssjef"
    }

    // Demo-modus: dashboardet speiler GoDemoData (som kjøreboka) — ellers
    // ville «Min kjørebok»/team-oversikten stått tomme i en salgsdemo.
    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    private var thisMonth: (km: Double, amount: Double, tolls: Double) {
        if isDemo {
            let biz = GoDemoData.trips().filter { $0.purpose.isBusiness }
            return (km: biz.reduce(0) { $0 + $1.distanceKm },
                    amount: biz.reduce(0) { $0 + ($1.mileageAmount ?? 0) },
                    tolls: biz.reduce(0) { $0 + ($1.tollAmount ?? 0) })
        }
        return store.businessSummary(inMonth: Date())
    }
    private var myUnconfirmed: Int {
        isDemo ? GoDemoData.trips().filter { $0.purpose == .unconfirmed }.count
               : store.unconfirmedCount
    }
    private var myMonthTripCount: Int {
        isDemo ? GoDemoData.trips().count : store.trips(inMonth: Date()).count
    }

    var body: some View {
        Group {
            if embedded {
                inner   // ytre stack eier navigasjonen; navbar skjules av pushen
            } else {
                NavigationStack {
                    inner.toolbar(.hidden, for: .navigationBar)
                }
            }
        }
        .gated(.leadgridGoKjorebok)   // tilleggstjeneste — låst uten entitlement
        .sheet(isPresented: $showVehicle) {
            VehicleProfileSheet(profile: Bindable(appState).vehicleProfile, api: appState.api)
        }
        .sheet(isPresented: $showKjorebok) { KjorebokView() }
        .sheet(isPresented: $showBooking) { LeadgridGoBookingView() }
        .task { await loadTeam() }
        .task { orgFleet = await TripService.shared.orgVehicles(using: appState.api) }
        #if DEBUG
        // QA (pitch-screenshots): QA_KJOREBOK=1 åpner kjørebok-sheeten
        // automatisk — reverteres m/ task #59-følget.
        .task {
            if ProcessInfo.processInfo.environment["QA_KJOREBOK"] == "1" {
                try? await Task.sleep(nanoseconds: 600_000_000)
                showKjorebok = true
            }
        }
        // QA (landing-videoer): QA_TOUR=kjorebok — dashboard → kjørebok →
        // registrer bil (regnr-oppslag) → book firmabil. Task #59-følget.
        .task {
            guard ProcessInfo.processInfo.environment["QA_TOUR"] == "kjorebok" else { return }
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            showKjorebok = true
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            showKjorebok = false
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            showVehicle = true
            try? await Task.sleep(nanoseconds: 4_500_000_000)
            showVehicle = false
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            showBooking = true
            try? await Task.sleep(nanoseconds: 4_500_000_000)
            showBooking = false
            // Finale: tildelt bil står klar → «Start kjøring» hopper til
            // Kart med kjøre-nav (kjøreboka logger turen).
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            startKjoring()
        }
        #endif
    }

    /// Demo-aware datakilde for header-badges (samme gating som søsterfanene).
    private var headerLeads: [LeadModel] {
        DemoModeManager.isActiveNonisolated
            ? DemoModeManager.shared.mockLeads
            : appState.leads
    }

    private var goHeader: some View {
        LeadgridTabHeader(
            subtitle: "Elektronisk kjørebok, flåte og kjøretøy.",
            leads: headerLeads
        ) {
            Button { showBooking = true } label: {
                // HStack + fixedSize (ikke Label): i trang header ble teksten
                // komprimert til 0 bredde → knappen så ut som en lilla klump
                // med bare ikon (Daniels screenshot 2026-07-19).
                HStack(spacing: 5) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.appScaled(size: 11, weight: .bold))
                    Text("Book bil")
                        .font(.appScaled(size: 11, weight: .bold))
                        .lineLimit(1)
                }
                .fixedSize()
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(NavPOIBrand.purple, in: Capsule())
            }
            .buttonStyle(.plain)
        }
    }

    private var inner: some View {
        // Delt fane-header (fasit: Team/Leadbook) i stedet for system-navbar —
        // pushen fra Mer skjuler navbaren, tilbake = swipe som søsterfanene.
        VStack(spacing: 0) {
            AnyView(goHeader)
                .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
            ScrollView {
                VStack(spacing: 14) {
                    if isGoAdmin {
                        adminSection
                        // Flåteregister — egen struct + AnyView-terskel med vilje
                        // (dashboard-typen skal ikke vokse, jf. KartView-krasjen).
                        AnyView(GoFleetAdminSection(drivers: team?.drivers ?? []))
                    }
                    personalSection
                    Color.clear.frame(height: 24)
                }
                .padding(16)
            }
        }
        .background(NavPOIBrand.bg.ignoresSafeArea())
    }

    private func loadTeam() async {
        if isDemo { team = GoDemoData.team(); return }
        guard isGoAdmin else { return }
        loadingTeam = true
        team = await TripService.shared.teamOverview(using: appState.api)
        loadingTeam = false
    }

    // MARK: admin — team-oversikt

    private var adminSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: "chart.bar.doc.horizontal.fill").foregroundStyle(NavPOIBrand.green)
                Text("Team-oversikt").font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
                Spacer()
                Text("Denne måneden").font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
            }
            if let t = team {
                HStack(spacing: 10) {
                    goTile("\(t.totals.activeDrivers)/\(t.totals.drivers)", "Aktive sjåfører", NavPOIBrand.purpleLight)
                    goTile("\(Int(t.totals.km)) km", "Yrkeskjøring", NavPOIBrand.green)
                    goTile("\(Int(t.totals.amount)) kr", "Godtgjørelse", NavPOIBrand.green)
                    goTile("\(Int(t.totals.tolls)) kr", "Bom", NavPOIBrand.orange)
                }
                if t.totals.unconfirmed > 0 {
                    Label("\(t.totals.unconfirmed) turer i teamet mangler formål", systemImage: "exclamationmark.circle.fill")
                        .font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(NavPOIBrand.orange)
                        .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                        .background(NavPOIBrand.orange.opacity(0.13), in: RoundedRectangle(cornerRadius: 10))
                }
                ForEach(t.drivers) { driverRow($0) }
            } else if loadingTeam {
                ProgressView().tint(.white).frame(maxWidth: .infinity).padding(.vertical, 30)
            } else {
                Text("Kunne ikke laste team-data.").font(.appScaled(size: 12)).foregroundStyle(NavPOIBrand.textSecondary)
            }
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NavPOIBrand.green.opacity(0.3), lineWidth: 1))
    }

    private func goTile(_ value: String, _ label: String, _ tint: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.appScaled(size: 15, weight: .black, design: .rounded)).foregroundStyle(.white)
                .monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.appScaled(size: 8, weight: .semibold)).foregroundStyle(tint).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 11)
        .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    private func driverRow(_ d: GoDriverSummary) -> some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(NavPOIBrand.purple.opacity(0.25))
                Text(initials(d.name)).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(NavPOIBrand.purpleLight)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text(d.name).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                HStack(spacing: 6) {
                    Text(roleLabel(d.role)).font(.appScaled(size: 9, weight: .semibold)).foregroundStyle(NavPOIBrand.textSecondary)
                    if let v = d.vehicleName { Text("· \(v)").font(.appScaled(size: 9)).foregroundStyle(NavPOIBrand.textSecondary).lineLimit(1) }
                    if d.isCompanyCar == true {
                        Text("Firmabil").font(.appScaled(size: 8, weight: .bold)).foregroundStyle(NavPOIBrand.green)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(NavPOIBrand.green.opacity(0.15), in: Capsule())
                    }
                    if let eu = euWarning(d.euControlDue) {
                        Label(eu, systemImage: "exclamationmark.triangle.fill")
                            .font(.appScaled(size: 8, weight: .bold)).foregroundStyle(NavPOIBrand.orange)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(NavPOIBrand.orange.opacity(0.15), in: Capsule())
                    }
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(Int(d.businessKm)) km").font(.appScaled(size: 13, weight: .bold, design: .rounded)).foregroundStyle(.white).monospacedDigit()
                HStack(spacing: 5) {
                    Text("\(Int(d.amount)) kr").font(.appScaled(size: 10, weight: .semibold)).foregroundStyle(NavPOIBrand.green)
                    if d.unconfirmed > 0 {
                        Text("\(d.unconfirmed)").font(.appScaled(size: 9, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 5).padding(.vertical, 1).background(NavPOIBrand.orange, in: Capsule())
                    }
                }
            }
        }
        .padding(10)
        .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
    }

    // MARK: personlig — egen kjørebok + firma bil

    /// Bilen org-en har tildelt MEG (fast, ikke delt). Demo matcher på navn.
    private var minTildelteBil: OrgVehicle? {
        orgFleet.first { !$0.isShared && $0.assignedUserName == appState.displayName }
    }

    /// «Start kjøring»: tildelt bil står klar → hopp til Kart med kjøre-nav
    /// mot dagens første lead. Kjøreboka auto-logger turen (nav-motoren).
    private func startKjoring() {
        guard let lead = headerLeads.first else { return }
        // transport: driving — du setter deg i firmabilen (uten hintet
        // arvet nav-en gå-modus fra forrige økt).
        appState.requestNavigation(
            lat: lead.latitude, lon: lead.longitude,
            name: lead.name, address: lead.address ?? "",
            start: true, transport: "driving")
    }

    /// Klar-til-kjøring-kort: vises når org-en har tildelt deg en firmabil.
    private var startKjoringCard: some View {
        Group {
            if let bil = minTildelteBil, headerLeads.first != nil {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(NavPOIBrand.green.opacity(0.18))
                        Image(systemName: "car.fill").foregroundStyle(NavPOIBrand.green)
                    }
                    .frame(width: 40, height: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(bil.label) står klar")
                            .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        Text("\(bil.plate) · \(bil.note ?? "Tildelt deg") — klar for dagens felt")
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(NavPOIBrand.textSecondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Button { startKjoring() } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "location.north.line.fill")
                                .font(.appScaled(size: 11, weight: .bold))
                            Text("Start kjøring")
                                .font(.appScaled(size: 12, weight: .bold))
                        }
                        .fixedSize()
                        .foregroundStyle(.white)
                        .padding(.horizontal, 13).padding(.vertical, 9)
                        .background(
                            LinearGradient(colors: [NavPOIBrand.green, NavPOIBrand.green.opacity(0.75)],
                                           startPoint: .leading, endPoint: .trailing),
                            in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(12)
                .background(NavPOIBrand.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 13))
                .overlay(RoundedRectangle(cornerRadius: 13)
                    .stroke(NavPOIBrand.green.opacity(0.35), lineWidth: 1))
            }
        }
    }

    private var personalSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            startKjoringCard
            HStack(spacing: 7) {
                Image(systemName: "book.closed.fill").foregroundStyle(NavPOIBrand.purpleLight)
                Text("Min kjørebok").font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
                Spacer()
                if myUnconfirmed > 0 {
                    Text("\(myUnconfirmed) ubekreftet").font(.appScaled(size: 9, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 3).background(NavPOIBrand.orange, in: Capsule())
                }
            }
            HStack(spacing: 10) {
                goTile("\(Int(thisMonth.km)) km", "Yrkeskjøring", NavPOIBrand.green)
                goTile("\(Int(thisMonth.amount)) kr", "Godtgjørelse", NavPOIBrand.green)
                goTile("\(myMonthTripCount)", "Turer", NavPOIBrand.purpleLight)
            }
            // Min bil / firma bil
            Button { showVehicle = true } label: {
                HStack(spacing: 11) {
                    ZStack {
                        Circle().fill((appState.vehicleProfile.fuel.isElectric ? NavPOIBrand.green : NavPOIBrand.purpleLight).opacity(0.2))
                        Image(systemName: appState.vehicleProfile.fuel.icon).foregroundStyle(appState.vehicleProfile.fuel.isElectric ? NavPOIBrand.green : NavPOIBrand.purpleLight)
                    }
                    .frame(width: 36, height: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(appState.vehicleProfile.displayName ?? (appState.vehicleProfile.isConfigured ? appState.vehicleProfile.fuel.label : "Registrer bilen din"))
                            .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        HStack(spacing: 6) {
                            if let p = appState.vehicleProfile.plate { Text(p).font(.appScaled(size: 10, weight: .semibold, design: .monospaced)).foregroundStyle(NavPOIBrand.textSecondary) }
                            Text(appState.vehicleProfile.isCompanyCar ? "Firmabil" : "Privat bil")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(appState.vehicleProfile.isCompanyCar ? NavPOIBrand.green : NavPOIBrand.textSecondary)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background((appState.vehicleProfile.isCompanyCar ? NavPOIBrand.green : NavPOIBrand.textSecondary).opacity(0.15), in: Capsule())
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.appScaled(size: 12, weight: .bold)).foregroundStyle(NavPOIBrand.textSecondary)
                }
                .padding(11)
                .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            // Kjøretøy-booking (del firmabil)
            Button { showBooking = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "calendar.badge.plus").font(.appScaled(size: 13, weight: .bold))
                    Text("Book firmabil").font(.appScaled(size: 13, weight: .bold))
                    Spacer()
                    Image(systemName: "chevron.right").font(.appScaled(size: 11, weight: .bold)).foregroundStyle(NavPOIBrand.textSecondary)
                }
                .foregroundStyle(.white).padding(.vertical, 12).padding(.horizontal, 14)
                .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            // Åpne full kjørebok
            Button { showKjorebok = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "book.pages.fill").font(.appScaled(size: 13, weight: .bold))
                    Text("Åpne kjørebok").font(.appScaled(size: 13, weight: .bold))
                    Spacer()
                    if detector.enabled {
                        Label("Auto", systemImage: "sparkles").font(.appScaled(size: 10, weight: .bold)).foregroundStyle(NavPOIBrand.green)
                    }
                }
                .foregroundStyle(.white).padding(.vertical, 13).padding(.horizontal, 14)
                .background(LinearGradient(colors: [NavPOIBrand.purple, NavPOIBrand.purpleLight], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    // MARK: helpers

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 { return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased() }
        return String(name.prefix(2)).uppercased()
    }
    /// «EU-kontroll» hvis frist er ≤60 dager eller forfalt (ellers nil).
    private func euWarning(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"
        guard let d = df.date(from: String(iso.prefix(10))) else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Date(), to: d).day ?? 999
        guard days <= 60 else { return nil }
        return days < 0 ? "EU-kontroll forfalt" : "EU-kontroll \(days)d"
    }

    private func roleLabel(_ r: String) -> String {
        switch r {
        case "admin": return "Admin"
        case "salgssjef": return "Salgssjef"
        case "teamleder": return "Teamleder"
        case "salgskonsulent": return "Selger"
        case "promotor": return "Promotør"
        default: return r.capitalized
        }
    }
}
