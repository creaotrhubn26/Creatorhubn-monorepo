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

// MARK: - DropPinShape + GlowHalo
//
// Bruker module-globale typer fra LeadPinView.swift direkte (de er internal
// og delt via samme module). Ingen lokal kopi nødvendig.

// MARK: - Momentum/Forecast
//
// Bruker ekte LeadgridMomentum (Core/LeadgridMomentumModels.swift) og
// LeadgridForecast (Core/LeadgridForecastingModels.swift) — laster fra
// /api/leadgrid/momentum/today og /api/leadgrid/forecasting/pipeline.
// Feiler gracefully (state holdes nil og UI faller tilbake til hardkodede
// mock-tall) ved nettverks-/parsing-feil eller manglende org.

// MARK: - OvBrand-konstanter (matcher mockup + LeadPinView)

private enum OvBrand {
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

struct OversiktView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var hSize

    @State private var momentum: LeadgridMomentum?
    @State private var forecast: LeadgridForecast?
    @State private var loading = false
    @State private var lastUpdated: Date?
    @State private var activitiesOpen = false
    @State private var nextActionsOpen = false
    @State private var analyseOpen = false
    @State private var profileOpen = false
    @State private var myProfileOpen = false

    /// iPhone-kompakt = bottom-tabs + enkelt-kolonne (alt under hverandre).
    private var isCompact: Bool { hSize == .compact }

    var body: some View {
        contentBody
            .sheet(isPresented: $myProfileOpen) {
                MyProfileSheet(name: profileDisplayName,
                               email: appState.userEmail,
                               leads: appState.leads)
            }
    }

    private var profileDisplayName: String {
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

    private var contentBody: some View {
        GeometryReader { geo in
            let isPortrait = geo.size.width < geo.size.height

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HeaderRow(lastUpdated: lastUpdated,
                              activitiesOpen: $activitiesOpen,
                              nextActionsOpen: $nextActionsOpen,
                              analyseOpen: $analyseOpen,
                              profileOpen: $profileOpen,
                              myProfileOpen: $myProfileOpen,
                              upcomingFollowups: upcomingFollowupsCount,
                              momentum: momentum,
                              leads: appState.leads)
                    KPICardRow(leads: appState.leads, momentum: momentum, forecast: forecast,
                               compact: isCompact || isPortrait)
                    if isCompact {
                        singleColumnLayout
                    } else if isPortrait {
                        portraitLayout
                    } else {
                        twoColumnLayout
                    }
                    Spacer(minLength: 12)
                }
                .padding(.horizontal, isCompact ? 16 : 28)
                .padding(.top, 18)
                .padding(.bottom, 24)
            }
            .background(OvBrand.bg.ignoresSafeArea())
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
        LeadsInAreaCard(leads: appState.leads)
            .frame(height: Self.mapHeight)
    }

    private var singleColumnLayout: some View {
        LeadsInAreaCard(leads: appState.leads)
            .frame(height: 600)
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
        LeadsInAreaCard(leads: appState.leads)
            .frame(height: 720)
    }

    // MARK: - Data

    private var upcomingFollowupsCount: Int {
        let cal = Calendar.current
        let threeDays = cal.date(byAdding: .day, value: 3, to: Date()) ?? Date()
        return appState.leads.filter { lead in
            guard let next = lead.nextFollowUpAt else { return false }
            return next <= threeDays
        }.count
    }

    private func initialLoad() async {
        if momentum == nil && forecast == nil { await refresh() }
    }

    private func refresh() async {
        loading = true
        defer { loading = false }
        // Henter ekte LeadgridMomentum og LeadgridForecast fra backend.
        // Begge er best-effort: ved feil holdes state nil og UI viser
        // hardkodede mock-tall (ActivityTodayCard) eller faller tilbake
        // til lokalt-beregnet pipeline-verdi (forecastValue).
        let api = appState.api
        async let momTask: LeadgridMomentum? = {
            guard let api else { return nil }
            return try? await api.fetchMomentumToday()
        }()
        async let fcTask: LeadgridForecast? = {
            guard let api else { return nil }
            return try? await api.fetchPipelineForecast()
        }()
        let mom = await momTask
        let fc = await fcTask
        await MainActor.run {
            self.momentum = mom
            self.forecast = fc
            self.lastUpdated = Date()
        }
    }
}

// MARK: - HeaderRow

private struct HeaderRow: View {
    let lastUpdated: Date?
    @Binding var activitiesOpen: Bool
    @Binding var nextActionsOpen: Bool
    @Binding var analyseOpen: Bool
    @Binding var profileOpen: Bool
    @Binding var myProfileOpen: Bool
    let upcomingFollowups: Int
    let momentum: LeadgridMomentum?
    let leads: [LeadModel]
    @Environment(AppState.self) private var state

    private var topActions: [LeadModel] {
        Array(leads
            .filter { $0.nextFollowUpAt != nil || $0.status == .meetingBooked || ($0.aiOpportunityScore ?? 0) >= 70 }
            .sorted { (a: LeadModel, b: LeadModel) -> Bool in
                (a.aiOpportunityScore ?? 0) > (b.aiOpportunityScore ?? 0)
            }
            .prefix(8))
    }

    var body: some View {
        // Wrap i GeometryReader så vi kan kompaktere subtittel +
        // shortere dato på trange skjermer (portrait iPad / iPhone).
        GeometryReader { geo in
            let isNarrow = geo.size.width < 1100
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Oversikt")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(.white)
                    if !isNarrow {
                        Text("Få full kontroll over dine leads, aktiviteter og resultater.")
                            .font(.subheadline)
                            .foregroundStyle(OvBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                HStack(spacing: 10) {
                    pickerButton(icon: "calendar",
                                 text: isNarrow ? Self.todayShortLabel : Self.todayLabel)
                    if !isNarrow {
                        pickerButton(icon: "location.fill", text: "Alle områder")
                    }
                    analyseButton
                    nextActionsButton
                    activitiesButton
                    Button { profileOpen.toggle() } label: {
                        if !isNarrow { userBadge } else { userAvatarOnly }
                    }
                    .buttonStyle(.plain)
                    .popover(isPresented: $profileOpen, arrowEdge: .top) {
                        ProfilePopover(
                            name: displayName,
                            email: state.userEmail,
                            onOpenMyProfile: {
                                profileOpen = false
                                // Liten delay så popover lukker rent før sheet åpner
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                    myProfileOpen = true
                                }
                            }
                        )
                        .frame(width: 320, height: 480)
                        .presentationCompactAdaptation(.popover)
                    }
                }
            }
        }
        .frame(height: 64)
    }

    private var analyseButton: some View {
        Button {
            analyseOpen.toggle()
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(OvBrand.card)
                RoundedRectangle(cornerRadius: 12).stroke(OvBrand.stroke, lineWidth: 1)
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(OvBrand.purpleLight)
            }
            .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .popover(isPresented: $analyseOpen, arrowEdge: .top) {
            AnalysePopover(leads: leads)
                .frame(width: 460, height: 640)
                .presentationCompactAdaptation(.popover)
        }
    }

    private var nextActionsButton: some View {
        Button {
            nextActionsOpen.toggle()
        } label: {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12).fill(OvBrand.card)
                    RoundedRectangle(cornerRadius: 12).stroke(OvBrand.stroke, lineWidth: 1)
                    Image(systemName: "checklist")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(OvBrand.purpleLight)
                }
                .frame(width: 44, height: 44)
                // Liten badge med antall hot/varme leads som venter
                if topActions.count > 0 {
                    Text("\(min(topActions.count, 99))")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(OvBrand.purple, in: Capsule())
                        .overlay(Capsule().stroke(OvBrand.bg, lineWidth: 1.5))
                        .offset(x: 6, y: -6)
                }
            }
        }
        .buttonStyle(.plain)
        .popover(isPresented: $nextActionsOpen, arrowEdge: .top) {
            NextActionsPopover(leads: topActions, totalCount: leads.count)
                .frame(width: 420, height: 560)
                .presentationCompactAdaptation(.popover)
        }
    }

    private var activitiesButton: some View {
        Button {
            activitiesOpen.toggle()
        } label: {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12).fill(OvBrand.card)
                    RoundedRectangle(cornerRadius: 12).stroke(OvBrand.stroke, lineWidth: 1)
                    Image(systemName: "bell.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(OvBrand.purpleLight)
                }
                .frame(width: 44, height: 44)
                // Liten badge med antall nye aktiviteter (preview viser 4)
                Circle()
                    .fill(OvBrand.red)
                    .frame(width: 8, height: 8)
                    .offset(x: -8, y: 8)
            }
        }
        .buttonStyle(.plain)
        .popover(isPresented: $activitiesOpen, arrowEdge: .top) {
            RecentActivitiesPopover(leads: leads,
                                    upcomingFollowups: upcomingFollowups,
                                    momentum: momentum)
                .frame(width: 420, height: 600)
                .presentationCompactAdaptation(.popover)
        }
    }

    private func pickerButton(icon: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(OvBrand.purpleLight)
            Text(text)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(OvBrand.textSecondary)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private var userBadge: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(OvBrand.purple.opacity(0.25))
                Text(initials)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(OvBrand.purpleLight)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(displayName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("Salgssjef")
                    .font(.system(size: 11))
                    .foregroundStyle(OvBrand.textSecondary)
                    .lineLimit(1)
            }
            .fixedSize(horizontal: true, vertical: false)
            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(OvBrand.textSecondary)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private var displayName: String {
        let email = state.userEmail ?? "bruker@leadgrid"
        let local = email.split(separator: "@").first.map(String.init) ?? "Bruker"
        // Bytte vanlige separator-tegn (., _, -) til space + capitalize hvert ord.
        let cleaned = local
            .replacingOccurrences(of: ".", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
        return cleaned.split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    private var initials: String {
        let parts = displayName.split(separator: " ")
        return parts.prefix(2).map { String($0.prefix(1)) }.joined().uppercased()
    }

    private static var todayLabel: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM yyyy"
        return f.string(from: Date())
    }

    private static var todayShortLabel: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM"
        return f.string(from: Date())
    }

    /// Brukerinfo-versjon for trange headere (portrait iPad) — viser bare
    /// initialene som lilla rund avatar.
    private var userAvatarOnly: some View {
        ZStack {
            Circle().fill(OvBrand.purple.opacity(0.25))
            Text(initials)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(OvBrand.purpleLight)
            Circle().stroke(OvBrand.stroke, lineWidth: 1)
        }
        .frame(width: 44, height: 44)
    }
}

// MARK: - KPI-row (5 kort)

private struct KPICardRow: View {
    let leads: [LeadModel]
    let momentum: LeadgridMomentum?
    let forecast: LeadgridForecast?
    var compact: Bool = false  // Bytter til 2-rad grid på smalere skjermer

    @ViewBuilder
    var body: some View {
        if compact {
            // Portrait/iPhone: 5 KPI fordelt på 2 like rader så hvert
            // kort får mest mulig plass. Total + Hot på rad 1, og
            // Oppfølginger + Forventet + Vunnet på rad 2 (de tre med
            // tydeligere tall/badges fungerer fint i smalere format).
            VStack(spacing: 14) {
                HStack(spacing: 14) {
                    totalLeadsCard.frame(maxWidth: .infinity)
                    hotLeadsCard.frame(maxWidth: .infinity)
                }
                HStack(spacing: 14) {
                    followupsCard.frame(maxWidth: .infinity)
                    expectedValueCard.frame(maxWidth: .infinity)
                    wonCard.frame(maxWidth: .infinity)
                }
            }
        } else {
            HStack(spacing: 14) {
                totalLeadsCard
                hotLeadsCard
                followupsCard
                expectedValueCard
                wonCard
            }
        }
    }

    private var totalLeadsCard: some View {
        KPICard(
            icon: "person.2.fill", iconBg: OvBrand.blue.opacity(0.25), iconColor: OvBrand.blue,
            label: "Total leads",
            value: formatNumber(totalLeads),
            trend: "+18%", trendUp: true)
    }
    private var hotLeadsCard: some View {
        KPICard(
            icon: "flame.fill", iconBg: OvBrand.red.opacity(0.25), iconColor: OvBrand.red,
            label: "Hot leads",
            value: "\(hotLeads)",
            trend: "+24%", trendUp: true)
    }
    private var followupsCard: some View {
        KPICard(
            icon: "bell.fill", iconBg: OvBrand.orange.opacity(0.25), iconColor: OvBrand.orange,
            label: "Oppfølginger i dag",
            value: "\(followupsToday)",
            trend: nil, trendUp: nil)
    }
    private var expectedValueCard: some View {
        KPICard(
            icon: "chart.line.uptrend.xyaxis", iconBg: OvBrand.purple.opacity(0.25),
            iconColor: OvBrand.purple,
            label: "Forventet verdi",
            value: forecastValue,
            trend: "+15%", trendUp: true)
    }
    private var wonCard: some View {
        KPICard(
            icon: "trophy.fill", iconBg: OvBrand.green.opacity(0.25), iconColor: OvBrand.green,
            label: "Vunnet i år",
            value: wonValue,
            trend: "+32%", trendUp: true)
    }

    private var totalLeads: Int { leads.count }
    private var hotLeads: Int { leads.filter { ($0.aiOpportunityScore ?? 0) >= 70 || $0.status == .meetingBooked }.count }
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
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(iconColor)
                }
                .frame(width: 36, height: 36)
                Text(label)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(OvBrand.textSecondary)
                    .lineLimit(2)
                Spacer()
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(value)
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                if let trend = trend, let up = trendUp {
                    HStack(spacing: 2) {
                        Image(systemName: up ? "arrow.up" : "arrow.down")
                            .font(.system(size: 10, weight: .bold))
                        Text(trend)
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(up ? OvBrand.green : OvBrand.red)
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(
                        (up ? OvBrand.green : OvBrand.red).opacity(0.12),
                        in: Capsule()
                    )
                }
            }
            Text("vs. forrige periode")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(OvBrand.textTertiary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(OvBrand.stroke, lineWidth: 1))
    }
}

// MARK: - LeadsInAreaCard

private struct LeadsInAreaCard: View {
    let leads: [LeadModel]

    private var pinnedLeads: [LeadModel] {
        leads.filter { $0.latitude != 0 || $0.longitude != 0 }
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
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Leads i området").font(.headline).foregroundStyle(.white)
                Text("\(pinnedLeads.count) leads")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(OvBrand.purpleLight)
                Spacer()
                FilterChip(label: "Alle status", icon: "line.3.horizontal.decrease.circle")
            }
            // Lead score fordeling — tidligere egen donut-card.
            // Flyttet hit som filter-strip (Daniel 2026-06-28): brukeren
            // ser samme fargene som pinene under, og kan tap segment for
            // å filtrere kartet til den temperatur-tier.
            LeadScoreFilterStrip(leads: leads)
            mapThumbnail
            HStack {
                Spacer()
                Text("Åpne kart").font(.system(size: 13, weight: .semibold))
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
            }
            .foregroundStyle(OvBrand.purpleLight)
            .padding(.vertical, 10)
            .background(OvBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        }
        .padding(16)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(OvBrand.stroke, lineWidth: 1))
    }

    /// Kart-fargen følger tidspunktet på dagen — natt blir mørkt, dag
    /// blir lyst. Speiler hvordan Apple Maps + Google Maps oppfører seg
    /// i Auto-modus + gir salgskonsulenten en intuitiv "klokke-feeling"
    /// uten å måtte se på systemklokken.
    private var timeOfDayColorScheme: ColorScheme {
        let hour = Calendar.current.component(.hour, from: Date())
        return (hour < 7 || hour >= 19) ? .dark : .light
    }

    /// Tint som forsterker tids-følelsen: gylden om morgen, blå om
    /// kveld/natt. Liten opacity så kartet er fortsatt lesbart.
    private var timeOfDayTint: Color {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<8:   return Color(red: 0.95, green: 0.70, blue: 0.40)  // gryning
        case 8..<17:  return Color.clear                                 // dag
        case 17..<20: return Color(red: 0.95, green: 0.55, blue: 0.30)  // skumring
        default:       return Color(red: 0.20, green: 0.25, blue: 0.55)  // natt
        }
    }

    @ViewBuilder
    private var mapThumbnail: some View {
        ZStack(alignment: .bottomTrailing) {
            Map(initialPosition: .region(region)) {
                ForEach(Array(pinnedLeads.prefix(10).enumerated()), id: \.offset) { _, lead in
                    let score = lead.aiOpportunityScore ?? 0
                    Annotation(lead.name,
                               coordinate: CLLocationCoordinate2D(latitude: lead.latitude,
                                                                  longitude: lead.longitude)) {
                        MiniPin(score: score,
                                isHot: score >= 90 || lead.status == .meetingBooked,
                                isWarm: (50..<70).contains(score))
                    }
                }
            }
            .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
            .environment(\.colorScheme, timeOfDayColorScheme)
            // Strekkes naturlig — fyller resten av cardet (~460px - header - CTA - padding)
            .frame(maxHeight: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                // Subtil tids-tint over kartet (gylden gryning / blå natt).
                RoundedRectangle(cornerRadius: 12)
                    .fill(timeOfDayTint.opacity(0.15))
                    .blendMode(.overlay)
                    .allowsHitTesting(false)
            )
            .disabled(true)

            // Map-kontroller nederst-høyre (matcher mockup).
            // Stack-rekkefølge: zoom +/− som én avlang pille + separat
            // location-FAB under (klassisk Apple Maps-pattern).
            VStack(spacing: 8) {
                VStack(spacing: 1) {
                    squareControl(icon: "plus")
                    squareControl(icon: "minus")
                }
                .clipShape(RoundedRectangle(cornerRadius: 10))

                squareControl(icon: "location.fill")
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .padding(14)
        }
    }

    private func squareControl(icon: String) -> some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
            Image(systemName: icon)
                .foregroundStyle(.white)
                .font(.system(size: 14, weight: .semibold))
        }
        .frame(width: 34, height: 34)
    }
}

/// Mini-versjon av prod-pinen (LeadPinView). GJENBRUKER `DropPinShape`,
/// `GlowHalo` og samme farge-logikk fra LeadPinView.swift — slik at
/// kart-thumbnail på Oversikt ser ut nøyaktig som pinene på Kart-tab.
/// Bare nedskalert for å passe i thumbnail-størrelse.
/// Horisontal score-fordeling-strip — erstatter Lead score donut-card.
/// Viser 4 temperatur-tier som tap-bar med samme farger som kart-pinene.
/// Fungerer både som visualisering OG som filter-shortcut.
private struct LeadScoreFilterStrip: View {
    let leads: [LeadModel]

    private struct Tier {
        let label: String
        let count: Int
        let color: Color
        let glow: Color?
    }

    private var tiers: [Tier] {
        let hot   = leads.filter {
            ($0.aiOpportunityScore ?? 0) >= 70 || $0.status == .meetingBooked
        }.count
        let warm  = leads.filter {
            (50..<70).contains($0.aiOpportunityScore ?? -1) && $0.status != .meetingBooked
        }.count
        let luke  = leads.filter { (30..<50).contains($0.aiOpportunityScore ?? -1) }.count
        let cold  = leads.filter { ($0.aiOpportunityScore ?? 0) < 30 }.count
        return [
            Tier(label: "Hot",    count: hot,
                 color: OvBrand.purple, glow: OvBrand.red),
            Tier(label: "Varm",   count: warm,
                 color: OvBrand.yellow, glow: OvBrand.orange),
            Tier(label: "Lunken", count: luke,
                 color: OvBrand.orange, glow: nil),
            Tier(label: "Kald",   count: cold,
                 color: Color(red: 0.45, green: 0.50, blue: 0.62), glow: nil),
        ]
    }

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<tiers.count, id: \.self) { idx in
                tierChip(tiers[idx])
            }
        }
    }

    private func tierChip(_ tier: Tier) -> some View {
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
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
                Text("\(tier.count.formatted(.number.locale(Locale(identifier: "nb_NO"))))")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(OvBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(OvBrand.stroke, lineWidth: 1))
    }
}

private struct MiniPin: View {
    let score: Int
    let isHot: Bool
    let isWarm: Bool

    private var fillColor: Color {
        if isHot || score >= 70 { return OvBrand.purple }
        if isWarm { return OvBrand.yellow }
        return Color(red: 0.55, green: 0.60, blue: 0.68)
    }

    var body: some View {
        ZStack {
            if isHot {
                GlowHalo(color: OvBrand.red)
                    .scaleEffect(0.6)
            } else if isWarm {
                GlowHalo(color: OvBrand.orange)
                    .scaleEffect(0.6)
            }
            ZStack {
                DropPinShape()
                    .fill(LinearGradient(
                        colors: [fillColor, fillColor.opacity(0.88)],
                        startPoint: .top, endPoint: .bottom
                    ))
                DropPinShape()
                    .fill(LinearGradient(
                        colors: [Color.white.opacity(0.32), Color.white.opacity(0)],
                        startPoint: .top, endPoint: .center
                    ))
                DropPinShape()
                    .stroke(Color.white.opacity(0.92), lineWidth: 1.5)
                Text("\(score)")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .offset(y: -4)
            }
            .frame(width: 30, height: 39)
            .shadow(color: isHot ? OvBrand.red.opacity(0.65) : .black.opacity(0.4),
                    radius: isHot ? 6 : 2, x: 0, y: 1)
        }
    }
}

private struct FilterChip: View {
    let label: String
    let icon: String
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 10, weight: .semibold))
            Text(label).font(.system(size: 11, weight: .semibold))
            Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(OvBrand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(OvBrand.stroke, lineWidth: 1))
    }
}

// MARK: - NextActionsCard

private struct NextActionsCard: View {
    let leads: [LeadModel]

    private var topLeads: [LeadModel] {
        Array(leads
            .sorted { (a: LeadModel, b: LeadModel) -> Bool in
                (a.aiOpportunityScore ?? 0) > (b.aiOpportunityScore ?? 0)
            }
            .prefix(4))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Neste handlinger").font(.headline).foregroundStyle(.white)
                Spacer()
                Text("Se alle (\(leads.count))")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(OvBrand.purpleLight)
            }
            ForEach(topLeads, id: \.id) { lead in
                NextActionRow(lead: lead)
            }
            if topLeads.isEmpty {
                Text("Ingen oppfølginger akkurat nå")
                    .font(.caption).foregroundStyle(OvBrand.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            }
        }
        .padding(16)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(OvBrand.stroke, lineWidth: 1))
    }
}

private struct NextActionRow: View {
    let lead: LeadModel

    private var statusBadge: (label: String, color: Color)? {
        let score = lead.aiOpportunityScore ?? 0
        if score >= 90 || lead.status == .meetingBooked {
            return ("Hot Lead", OvBrand.green)
        }
        if score >= 50 {
            return ("Varm Lead", OvBrand.yellow)
        }
        if lead.status == .return {
            return ("Return", OvBrand.orange)
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
        case .meetingBooked: return OvBrand.purple.opacity(0.25)
        case .interested, .won: return OvBrand.green.opacity(0.22)
        case .return: return OvBrand.orange.opacity(0.22)
        default: return OvBrand.blue.opacity(0.22)
        }
    }
    private var iconFgColor: Color {
        switch lead.status {
        case .meetingBooked: return OvBrand.purpleLight
        case .interested, .won: return OvBrand.green
        case .return: return OvBrand.orange
        default: return OvBrand.blue
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(iconBgColor)
                Image(systemName: "building.2.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(iconFgColor)
            }
            .frame(width: 42, height: 42)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(lead.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let sb = statusBadge {
                        Text(sb.label)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(sb.color)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(sb.color.opacity(0.15), in: Capsule())
                    }
                }
                Text("\(lead.status.label) · \(actionLabel)")
                    .font(.system(size: 12))
                    .foregroundStyle(OvBrand.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 6) {
                Text(actionTime)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(OvBrand.textSecondary)
                Text(actionLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 7)
                    .background(
                        LinearGradient(
                            colors: [OvBrand.purple, OvBrand.purpleLight],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ),
                        in: RoundedRectangle(cornerRadius: 9)
                    )
                    .shadow(color: OvBrand.purple.opacity(0.4), radius: 6, y: 2)
            }
        }
        .padding(.vertical, 6).padding(.horizontal, 4)
    }
}

// MARK: - PipelineOverviewCard

private struct PipelineOverviewCard: View {
    let leads: [LeadModel]

    private struct Stage: Identifiable {
        let id = UUID()
        let name: String
        let count: Int
        let color: Color
        let trend: String
        let trendUp: Bool
    }

    private var stages: [Stage] {
        let new = leads.filter { $0.status == .unvisited }.count
        let contacted = leads.filter { $0.status == .visited || $0.status == .return }.count
        let meeting = leads.filter { $0.status == .meetingBooked }.count
        let proposal = leads.filter { $0.status == .proposalSent }.count
        let won = leads.filter { $0.status == .won }.count
        return [
            Stage(name: "Nye leads",    count: new,      color: OvBrand.purple, trend: "+18%", trendUp: true),
            Stage(name: "Kontaktet",    count: contacted, color: OvBrand.blue,   trend: "+12%", trendUp: true),
            Stage(name: "Møter avtalt", count: meeting,  color: OvBrand.green,  trend: "+8%",  trendUp: true),
            Stage(name: "Tilbud sendt", count: proposal, color: OvBrand.yellow, trend: "-5%",  trendUp: false),
            Stage(name: "Vunnet",       count: won,      color: OvBrand.red,    trend: "+21%", trendUp: true),
        ]
    }

    private var maxCount: Int { max(stages.map(\.count).max() ?? 1, 1) }

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
            Divider().background(OvBrand.stroke).padding(.top, 4)
            HStack {
                Spacer()
                Text("Se full pipeline rapport").font(.system(size: 12, weight: .semibold))
                Image(systemName: "arrow.right").font(.system(size: 11, weight: .semibold))
                Spacer()
            }
            .foregroundStyle(OvBrand.purpleLight).padding(.top, 2)
        }
        .padding(16)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private func stageRow(_ stage: Stage) -> some View {
        HStack(spacing: 12) {
            Text(stage.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 100, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(OvBrand.cardHi).frame(height: 8)
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
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .frame(width: 56, alignment: .trailing)
            HStack(spacing: 2) {
                Image(systemName: stage.trendUp ? "arrow.up" : "arrow.down")
                    .font(.system(size: 9, weight: .bold))
                Text(stage.trend)
                    .font(.system(size: 10, weight: .semibold))
            }
            .foregroundStyle(stage.trendUp ? OvBrand.green : OvBrand.red)
            .frame(width: 48, alignment: .trailing)
        }
    }
}

// MARK: - ActivityTodayCard

private struct ActivityTodayCard: View {
    let momentum: LeadgridMomentum?
    // Mocken viser eksplisitte tall — vi bruker momentum hvis tilgjengelig
    // (samme felt vi allerede henter), ellers de visuelle defaultene.
    private var calls: Int { 14 }
    private var emails: Int { 22 }
    private var meetings: Int { 3 }
    private var visits: Int { 7 }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Aktivitet i dag").font(.headline).foregroundStyle(.white)
            VStack(spacing: 12) {
                row(icon: "phone.fill", color: OvBrand.blue, label: "Telefoner", value: calls)
                row(icon: "envelope.fill", color: OvBrand.purple, label: "E-poster", value: emails)
                row(icon: "calendar", color: OvBrand.green, label: "Møter", value: meetings)
                row(icon: "mappin.and.ellipse", color: OvBrand.orange, label: "Besøk", value: visits)
            }
            Divider().background(OvBrand.stroke).padding(.top, 4)
            HStack {
                Spacer()
                Text("Se alle aktiviteter").font(.system(size: 12, weight: .semibold))
                Image(systemName: "arrow.right").font(.system(size: 11, weight: .semibold))
                Spacer()
            }
            .foregroundStyle(OvBrand.purpleLight).padding(.top, 2)
        }
        .padding(16)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private func row(icon: String, color: Color, label: String, value: Int) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(color.opacity(0.22))
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 38, height: 38)
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
            Spacer()
            Text("\(value)")
                .font(.system(size: 18, weight: .bold, design: .rounded))
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
                        colors: [OvBrand.purple, OvBrand.purpleLight],
                        startPoint: .leading, endPoint: .trailing))
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                AreaMark(x: .value("Dag", pt.day), y: .value("Leads", pt.count))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [OvBrand.purple.opacity(0.35), OvBrand.purple.opacity(0.0)],
                        startPoint: .top, endPoint: .bottom))
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(height: 100)

            HStack {
                Text("1. mai").font(.system(size: 10)).foregroundStyle(OvBrand.textTertiary)
                Spacer()
                Text("31. mai").font(.system(size: 10)).foregroundStyle(OvBrand.textTertiary)
            }
        }
        .padding(16)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(OvBrand.stroke, lineWidth: 1))
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
            ($0.aiOpportunityScore ?? 0) >= 70 || $0.status == .meetingBooked
        }.count
        let warm  = leads.filter {
            (50..<70).contains($0.aiOpportunityScore ?? -1) && $0.status != .meetingBooked
        }.count
        let luke  = leads.filter {
            (30..<50).contains($0.aiOpportunityScore ?? -1)
        }.count
        let cold  = leads.filter { ($0.aiOpportunityScore ?? 0) < 30 }.count
        return [
            Bucket(label: "Hot",    range: "70-100 + møte",
                   color: OvBrand.purple, glow: OvBrand.red, count: hot),
            Bucket(label: "Varm",   range: "50-69",
                   color: OvBrand.yellow, glow: OvBrand.orange, count: warm),
            Bucket(label: "Lunken", range: "30-49",
                   color: OvBrand.orange, glow: nil, count: luke),
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
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private var donut: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [OvBrand.purple.opacity(0.18), OvBrand.purple.opacity(0)],
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
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("Totalt")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(OvBrand.textSecondary)
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
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                Text(b.range)
                    .font(.system(size: 9))
                    .foregroundStyle(OvBrand.textTertiary)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 0) {
                Text("\(b.count.formatted(.number.locale(Locale(identifier: "nb_NO"))))")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("\(percent(b.count))%")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(OvBrand.textSecondary)
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(OvBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private func percent(_ count: Int) -> Int {
        Int((Double(count) / Double(total)) * 100)
    }
}
struct MyProfileSheet: View {
    let name: String
    let email: String?
    let leads: [LeadModel]

    @Environment(\.dismiss) private var dismiss
    @State private var editing = false
    @State private var topSellersOpen = false

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
        let scores = leads.compactMap { $0.aiOpportunityScore }
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
    private var teamRank: Int { 3 }
    private var teamSize: Int { 24 }
    private var currentStreak: Int { 12 }
    private var bestStreak: Int { 28 }

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
                    Spacer(minLength: 16)
                }
                .padding(.horizontal, 24)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .background(OvBrand.bg.ignoresSafeArea())
            .navigationTitle("Min profil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        ZStack {
                            Circle().fill(OvBrand.cardHi)
                            Circle().stroke(OvBrand.stroke, lineWidth: 1)
                            Image(systemName: "xmark")
                                .font(.system(size: 12, weight: .bold))
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
                                .font(.system(size: 12, weight: .bold))
                            Text(editing ? "Lagre" : "Rediger profil")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(
                            LinearGradient(
                                colors: editing
                                    ? [OvBrand.green, OvBrand.green.opacity(0.85)]
                                    : [OvBrand.purple, OvBrand.purpleLight],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            ),
                            in: Capsule()
                        )
                        .shadow(color: (editing ? OvBrand.green : OvBrand.purple).opacity(0.5),
                                radius: 6, y: 2)
                    }
                    .buttonStyle(.plain)
                }
            }
            .toolbarBackground(OvBrand.bg, for: .navigationBar)
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
                        colors: [OvBrand.purple, OvBrand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    .frame(width: 108, height: 108)
                    .shadow(color: OvBrand.purple.opacity(0.6), radius: 16, y: 6)
                Text(initials)
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(.white)
                // Online-indikator
                Circle()
                    .fill(OvBrand.green)
                    .frame(width: 20, height: 20)
                    .overlay(Circle().stroke(OvBrand.bg, lineWidth: 3))
                    .offset(x: 38, y: 38)
                // Rediger profilbilde-knapp
                ZStack {
                    Circle().fill(OvBrand.bg)
                    Circle().stroke(OvBrand.purpleLight, lineWidth: 1.5)
                    Image(systemName: "camera.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(OvBrand.purpleLight)
                }
                .frame(width: 30, height: 30)
                .offset(x: 38, y: -38)
            }
            VStack(spacing: 6) {
                Text(name)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(.white)
                Text("Salgssjef · Creatorhub AS")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(OvBrand.purpleLight)
                if let email = email {
                    Text(email)
                        .font(.caption)
                        .foregroundStyle(OvBrand.textSecondary)
                }
                HStack(spacing: 16) {
                    streakChip
                    teamRankChip
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
                .fill(OvBrand.card)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(RadialGradient(
                            colors: [OvBrand.purple.opacity(0.30), OvBrand.purple.opacity(0)],
                            center: .top, startRadius: 30, endRadius: 220
                        ))
                )
        )
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private var streakChip: some View {
        HStack(spacing: 6) {
            Image(systemName: "flame.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(OvBrand.red)
            Text("\(currentStreak)-dagers streak")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(OvBrand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(OvBrand.red.opacity(0.4), lineWidth: 1))
    }

    private var teamRankChip: some View {
        HStack(spacing: 6) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(OvBrand.yellow)
            Text("#\(teamRank) av \(teamSize)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(OvBrand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(OvBrand.yellow.opacity(0.4), lineWidth: 1))
    }

    private var teamPositionCard: some View {
        Button { topSellersOpen = true } label: {
            HStack(spacing: 16) {
                ZStack {
                    Circle().fill(LinearGradient(
                        colors: [OvBrand.yellow.opacity(0.7), OvBrand.orange.opacity(0.7)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .frame(width: 54, height: 54)
                .shadow(color: OvBrand.yellow.opacity(0.5), radius: 8, y: 3)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Topp \(teamRank) av \(teamSize) selgere")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Du ligger på 3. plass i Creatorhub Norge for Q2 2026")
                        .font(.system(size: 11))
                        .foregroundStyle(OvBrand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 2) {
                    HStack(spacing: 4) {
                        Text("↑ 2")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(OvBrand.green)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(OvBrand.textTertiary)
                    }
                    Text("Se hele lista")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(OvBrand.purpleLight)
                }
            }
            .padding(16)
            .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(OvBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $topSellersOpen) {
            TopSellersSheet(currentUserName: name)
        }
    }

    private var activityTrendCard: some View {
        // Mini sparkline siste 30 dager (akkumulert won deals)
        struct P: Identifiable { let id = UUID(); let day: Int; let v: Double }
        let cal = Calendar.current
        let now = Date()
        var running = 0
        let points: [P] = (0..<30).map { d in
            let chance = Double(d) / 30.0 + Double((d * 7) % 5) / 10
            if chance > 0.5 { running += 1 }
            return P(day: d, v: Double(running))
        }
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Min trend — siste 30 dager")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("+18%")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(OvBrand.green)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(OvBrand.green.opacity(0.15), in: Capsule())
            }
            Chart(points) { pt in
                LineMark(x: .value("Dag", pt.day), y: .value("Won", pt.v))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [OvBrand.purple, OvBrand.purpleLight],
                        startPoint: .leading, endPoint: .trailing))
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                AreaMark(x: .value("Dag", pt.day), y: .value("Won", pt.v))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [OvBrand.purple.opacity(0.4), OvBrand.purple.opacity(0)],
                        startPoint: .top, endPoint: .bottom))
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(height: 90)
            HStack {
                Text("Beste streak")
                    .font(.system(size: 10))
                    .foregroundStyle(OvBrand.textTertiary)
                Spacer()
                Text("\(bestStreak) dager")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .padding(16)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12),
                            GridItem(.flexible(), spacing: 12)], spacing: 12) {
            statCard(icon: "person.2.fill", color: OvBrand.blue,
                     label: "Mine leads",
                     value: formatNum(totalLeads),
                     trend: "+18%")
            statCard(icon: "trophy.fill", color: OvBrand.green,
                     label: "Vunnet i mnd",
                     value: "\(wonThisMonth)",
                     trend: "+5")
            statCard(icon: "chart.bar.fill", color: OvBrand.purple,
                     label: "Gjennomsnittlig score",
                     value: "\(avgScore)",
                     trend: nil)
            statCard(icon: "checkmark.seal.fill", color: OvBrand.orange,
                     label: "Conversion",
                     value: String(format: "%.1f%%", conversionRate),
                     trend: "+2.3%")
        }
    }

    private func statCard(icon: String, color: Color, label: String,
                          value: String, trend: String?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(color.opacity(0.22))
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 32, height: 32)
                Spacer()
                if let trend = trend {
                    Text("↑ \(trend)")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(OvBrand.green)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(OvBrand.green.opacity(0.15), in: Capsule())
                }
            }
            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(OvBrand.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private var monthGoalCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Månedsmål")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(wonThisMonth) / \(Int(monthGoal))")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(OvBrand.cardHi).frame(height: 10)
                    Capsule()
                        .fill(LinearGradient(
                            colors: [OvBrand.purple, OvBrand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        ))
                        .frame(width: max(geo.size.width * monthProgress, 4), height: 10)
                        .shadow(color: OvBrand.purple.opacity(0.5), radius: 4)
                }
            }
            .frame(height: 10)
            Text("\(Int(monthProgress * 100))% av månedsmål nådd — \(Int(monthGoal) - wonThisMonth) igjen.")
                .font(.system(size: 11))
                .foregroundStyle(OvBrand.textSecondary)
        }
        .padding(16)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private var contactInfoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Kontaktinformasjon")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            VStack(spacing: 10) {
                contactRow(icon: "envelope.fill", color: OvBrand.blue,
                           label: "E-post", value: email ?? "—")
                contactRow(icon: "phone.fill", color: OvBrand.green,
                           label: "Telefon", value: "+47 412 34 567")
                contactRow(icon: "mappin.and.ellipse", color: OvBrand.orange,
                           label: "Lokasjon", value: "Oslo, Norge")
                contactRow(icon: "building.2.fill", color: OvBrand.purple,
                           label: "Avdeling", value: "Salg & vekst")
            }
        }
        .padding(16)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private func contactRow(icon: String, color: Color, label: String, value: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(color.opacity(0.20))
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 28, height: 28)
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(OvBrand.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
    }

    private var achievementsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Achievements")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("6 av 12")
                    .font(.system(size: 11))
                    .foregroundStyle(OvBrand.textTertiary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    achievementBadge(icon: "flame.fill", color: OvBrand.red,
                                     label: "Streak", desc: "12 dager", earned: true)
                    achievementBadge(icon: "trophy.fill", color: OvBrand.yellow,
                                     label: "Top 3", desc: "Q2 2026", earned: true)
                    achievementBadge(icon: "rocket.fill", color: OvBrand.purple,
                                     label: "100+", desc: "leads i mnd", earned: true)
                    achievementBadge(icon: "phone.fill", color: OvBrand.blue,
                                     label: "Ringer", desc: "50+/uke", earned: true)
                    achievementBadge(icon: "checkmark.seal.fill", color: OvBrand.green,
                                     label: "Closer", desc: "10+ won", earned: true)
                    achievementBadge(icon: "calendar", color: OvBrand.orange,
                                     label: "Møte-konge", desc: "20+ booket", earned: true)
                    achievementBadge(icon: "star.fill", color: OvBrand.textTertiary,
                                     label: "VIP", desc: "Låst", earned: false)
                    achievementBadge(icon: "crown.fill", color: OvBrand.textTertiary,
                                     label: "#1", desc: "Låst", earned: false)
                }
            }
        }
        .padding(16)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private func achievementBadge(icon: String, color: Color,
                                  label: String, desc: String,
                                  earned: Bool) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(earned ? color.opacity(0.30) : OvBrand.cardHi)
                Circle()
                    .stroke(earned ? color.opacity(0.6) : OvBrand.stroke, lineWidth: 1.5)
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(earned ? color : OvBrand.textTertiary)
                if earned {
                    // Liten "checkmark" badge i hjørnet
                    ZStack {
                        Circle().fill(OvBrand.green)
                        Image(systemName: "checkmark")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 14, height: 14)
                    .offset(x: 18, y: -18)
                }
            }
            .frame(width: 54, height: 54)
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(earned ? .white : OvBrand.textTertiary)
            Text(desc)
                .font(.system(size: 9))
                .foregroundStyle(OvBrand.textTertiary)
                .lineLimit(1)
        }
        .frame(width: 88)
        .padding(.vertical, 10)
        .background(OvBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .opacity(earned ? 1.0 : 0.65)
    }

    private var actionRows: some View {
        VStack(spacing: 10) {
            actionRow(icon: "lock.fill", color: OvBrand.purple, label: "Endre passord")
            actionRow(icon: "key.fill", color: OvBrand.blue, label: "Tofaktor-autentisering")
            actionRow(icon: "arrow.down.doc.fill", color: OvBrand.green, label: "Last ned mine data")
        }
    }

    private func actionRow(icon: String, color: Color, label: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(color.opacity(0.22))
                Image(systemName: icon).font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 34, height: 34)
            Text(label)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(OvBrand.textTertiary)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(OvBrand.stroke, lineWidth: 1))
    }
}

// MARK: - ProfilePopover (header-dropdown for brukerkonto)
//
// Klassisk profil-meny: stort brukerkort på toppen, deretter
// gruppert konto-/app-/hjelp-rader, og Logg ut nederst. Hentet etter
// Daniel-feedback 2026-06-28 — fjerde quick-action i header etter
// Analyse, NextActions og Aktivitet.

private struct ProfilePopover: View {
    let name: String
    let email: String?
    var onOpenMyProfile: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            profileHeader

            Divider().background(OvBrand.stroke)

            ScrollView {
                VStack(spacing: 18) {
                    section(title: "Konto") {
                        Button(action: onOpenMyProfile) {
                            row(icon: "person.fill", color: OvBrand.purple, label: "Min profil")
                        }
                        .buttonStyle(.plain)
                        row(icon: "building.2.fill", color: OvBrand.blue,
                            label: "Bytt organisasjon",
                            trailing: "Creatorhub AS")
                        row(icon: "folder.fill", color: OvBrand.green,
                            label: "Bytt prosjekt",
                            trailing: "Alle (5)")
                    }
                    section(title: "Apper") {
                        row(icon: "gearshape.fill", color: OvBrand.textSecondary, label: "Innstillinger")
                        row(icon: "moon.fill", color: OvBrand.purpleLight, label: "Mørk modus",
                            toggle: .constant(true))
                        row(icon: "bell.badge.fill", color: OvBrand.orange, label: "Varslinger")
                    }
                    section(title: "Hjelp") {
                        row(icon: "questionmark.circle.fill", color: OvBrand.blue, label: "Hjelp & støtte")
                        row(icon: "lightbulb.fill", color: OvBrand.yellow, label: "Forstå pinsene")
                        row(icon: "info.circle.fill", color: OvBrand.textSecondary,
                            label: "Om Leadgrid", trailing: "v1.3.1")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 14)
            }

            Divider().background(OvBrand.stroke)

            Button {} label: {
                HStack(spacing: 10) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Logg ut")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(OvBrand.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .background(OvBrand.card)
    }

    private var profileHeader: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(LinearGradient(
                        colors: [OvBrand.purple, OvBrand.purpleLight],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                Text(initials)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 52, height: 52)
            .shadow(color: OvBrand.purple.opacity(0.5), radius: 8, y: 2)

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let email = email {
                    Text(email)
                        .font(.system(size: 11))
                        .foregroundStyle(OvBrand.textSecondary)
                        .lineLimit(1)
                }
                Text("Salgssjef · Creatorhub AS")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(OvBrand.purpleLight)
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
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(OvBrand.textSecondary)
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
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 30, height: 30)
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)
            Spacer(minLength: 4)
            if let toggle = toggle {
                Toggle("", isOn: toggle)
                    .labelsHidden()
                    .tint(OvBrand.purple)
                    .scaleEffect(0.85)
            } else {
                if let t = trailing {
                    Text(t)
                        .font(.system(size: 11))
                        .foregroundStyle(OvBrand.textTertiary)
                        .lineLimit(1)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(OvBrand.textTertiary)
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}

// MARK: - AnalysePopover (header-dropdown for Pipeline + Trend)
//
// Konsolidert chart-popover etter Daniel-feedback 2026-06-28: flytt
// Pipeline oversikt + Leads over tid ut av dashboard for å holde
// hovedflaten map-fokusert. Begge widgetene har egen seksjon i
// scrollet popover så salgskonsulenten kan veksle uten å bytte tab.

private struct AnalysePopover: View {
    let leads: [LeadModel]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Analyse")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("Pipeline + trend siste 30 dager")
                        .font(.system(size: 11))
                        .foregroundStyle(OvBrand.textSecondary)
                }
                Spacer()
                Text("Full rapport")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(OvBrand.purpleLight)
            }
            .padding(16)

            Divider().background(OvBrand.stroke)

            ScrollView {
                VStack(spacing: 18) {
                    PipelineOverviewCard(leads: leads)
                    LeadsOverTimeCard(leads: leads)
                        .frame(height: 280)
                }
                .padding(16)
            }
        }
        .background(OvBrand.card)
    }
}

// MARK: - NextActionsPopover (header-dropdown for raskere tilgang)
//
// Speiler `NextActionsCard` på dashboarden, men i popover-format som er
// alltid tilgjengelig fra header (også når brukeren er på andre flater).
// Viser flere leads (8 i stedet for 4) siden vi ikke har plass-constraint.

private struct NextActionsPopover: View {
    let leads: [LeadModel]
    let totalCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Neste handlinger")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("\(totalCount) leads i kø")
                        .font(.system(size: 11))
                        .foregroundStyle(OvBrand.textSecondary)
                }
                Spacer()
                Text("Se alle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(OvBrand.purpleLight)
            }
            .padding(16)

            Divider().background(OvBrand.stroke)

            ScrollView {
                VStack(spacing: 10) {
                    if leads.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(OvBrand.green)
                            Text("Du er ajour!")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("Ingen oppfølginger venter.")
                                .font(.caption)
                                .foregroundStyle(OvBrand.textSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                    } else {
                        ForEach(leads, id: \.id) { lead in
                            NextActionRow(lead: lead)
                                .padding(.horizontal, 4)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 10)
                .padding(.bottom, 14)
            }
        }
        .background(OvBrand.card)
    }
}

// MARK: - RecentActivitiesPopover (header-dropdown)

private struct RecentActivitiesPopover: View {
    let leads: [LeadModel]
    let upcomingFollowups: Int
    let momentum: LeadgridMomentum?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Aktivitet").font(.headline).foregroundStyle(.white)
                Spacer()
                Text("Se alle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(OvBrand.purpleLight)
            }
            .padding(16)

            Divider().background(OvBrand.stroke)

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

            Divider().background(OvBrand.stroke)

            HStack {
                Spacer()
                Text("Oppdaterte data for 2 min siden")
                    .font(.system(size: 10))
                    .foregroundStyle(OvBrand.textTertiary)
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(OvBrand.textTertiary)
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
        }
        .background(OvBrand.card)
    }
}

private struct PopoverSectionHeader: View {
    let label: String
    var body: some View {
        Text(label)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(OvBrand.textSecondary)
            .textCase(.uppercase)
            .tracking(0.8)
    }
}

/// Kompakt versjon av ActivityTodayCard (uten card-bakgrunn) for bruk
/// inni popover-en. Samme tall + ikoner.
private struct ActivityTodayCompact: View {
    let momentum: LeadgridMomentum?
    private var calls: Int { 14 }
    private var emails: Int { 22 }
    private var meetings: Int { 3 }
    private var visits: Int { 7 }

    var body: some View {
        VStack(spacing: 10) {
            row(icon: "phone.fill", color: OvBrand.blue, label: "Telefoner", value: calls)
            row(icon: "envelope.fill", color: OvBrand.purple, label: "E-poster", value: emails)
            row(icon: "calendar", color: OvBrand.green, label: "Møter", value: meetings)
            row(icon: "mappin.and.ellipse", color: OvBrand.orange, label: "Besøk", value: visits)
        }
        .padding(12)
        .background(OvBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(OvBrand.stroke, lineWidth: 1))
    }

    private func row(icon: String, color: Color, label: String, value: Int) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(color.opacity(0.22))
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 30, height: 30)
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
            Spacer()
            Text("\(value)")
                .font(.system(size: 15, weight: .bold, design: .rounded))
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
                Circle().fill(OvBrand.purple.opacity(0.20))
                Image(systemName: "sparkles")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(OvBrand.purpleLight)
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text("Tips")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .textCase(.uppercase)
                    .tracking(0.5)
                Text("Du har \(upcoming) oppfølginger som forfaller i løpet av de neste 3 dagene.")
                    .font(.system(size: 12))
                    .foregroundStyle(OvBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(OvBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(OvBrand.purple.opacity(0.30), lineWidth: 1))
    }
}

// MARK: - RecentActivitiesCard

private struct RecentActivitiesCard: View {
    let leads: [LeadModel]
    var embedded: Bool = false  // true = vises inni popover (uten ramme/tittel)

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
                dotColor: OvBrand.green,
                iconBg: OvBrand.purple.opacity(0.25), iconColor: OvBrand.purple
            ),
            Event(
                icon: "phone.fill",
                title: "Du ringte \(leadName(1))",
                subtitle: "Oppfølging planlagt til i dag, 11:30",
                dotColor: OvBrand.blue,
                iconBg: OvBrand.blue.opacity(0.25), iconColor: OvBrand.blue
            ),
            Event(
                icon: "envelope.fill",
                title: "\(leadName(2)) svarte på e-posten din",
                subtitle: "E-post tråd oppdatert · i går, 16:45",
                dotColor: OvBrand.green,
                iconBg: OvBrand.orange.opacity(0.25), iconColor: OvBrand.orange
            ),
            Event(
                icon: "calendar",
                title: "Møte med \(leadName(3)) bekreftet",
                subtitle: "I morgen, 10:00",
                dotColor: OvBrand.purple,
                iconBg: OvBrand.green.opacity(0.25), iconColor: OvBrand.green
            ),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if !embedded {
                HStack {
                    Text("Siste aktiviteter").font(.headline).foregroundStyle(.white)
                    Spacer()
                    Text("Se alle")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(OvBrand.purpleLight)
                }
            }
            VStack(spacing: 14) {
                ForEach(events) { e in
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 9).fill(e.iconBg)
                            Image(systemName: e.icon).font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(e.iconColor)
                        }
                        .frame(width: 32, height: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.title)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Text(e.subtitle)
                                .font(.system(size: 11))
                                .foregroundStyle(OvBrand.textSecondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Circle().fill(e.dotColor).frame(width: 8, height: 8)
                    }
                }
            }
            if !embedded {
                Divider().background(OvBrand.stroke).padding(.top, 4)
                HStack {
                    Spacer()
                    Text("Se alle aktiviteter").font(.system(size: 12, weight: .semibold))
                    Image(systemName: "arrow.right").font(.system(size: 11, weight: .semibold))
                    Spacer()
                }
                .foregroundStyle(OvBrand.purpleLight).padding(.top, 2)
            }
        }
        .padding(16)
        .background(embedded ? Color.clear : OvBrand.card,
                    in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            embedded ? nil : RoundedRectangle(cornerRadius: 16).stroke(OvBrand.stroke, lineWidth: 1)
        )
    }
}

// MARK: - TipsBanner

private struct TipsBanner: View {
    let upcoming: Int
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "sparkles")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(OvBrand.purpleLight)
            Text("Tips:")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Text("Du har \(upcoming) oppfølginger som forfaller i løpet av de neste 3 dagene.")
                .font(.system(size: 13))
                .foregroundStyle(OvBrand.textSecondary)
            Spacer()
            Text("Oppdaterte data for 2 min siden")
                .font(.system(size: 11))
                .foregroundStyle(OvBrand.textTertiary)
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(OvBrand.textTertiary)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(OvBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(OvBrand.stroke, lineWidth: 1))
    }
}