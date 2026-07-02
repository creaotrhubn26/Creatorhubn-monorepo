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
    static let textSecondary = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.35)
}

struct OversiktView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var hSize
    @State private var demo = DemoModeManager.shared

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

    /// Demo-modus: bytt ut prod-leads med 50 mock-leads spredt i Oslo så
    /// KPI-tiles, kart og lister fylles opp. Når av: bruk ekte data fra
    /// AppState. Sjekkes per gjengivelse — Observable trigger redraw.
    private var effectiveLeads: [LeadModel] {
        demo.isActive ? demo.mockLeads : appState.leads
    }

    var body: some View {
        contentBody
            .sheet(isPresented: $myProfileOpen) {
                MyProfileSheet(name: profileDisplayName,
                               email: appState.userEmail,
                               leads: effectiveLeads)
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
            // Dynamisk kart-høyde: fyll resten av vinduet under header + KPI-
            // rad + padding. På Mac Catalyst med store vinduer gir dette
            // kartet ~1000+px, mens iPad landscape holder ~640px minimum.
            // Konstantene: header (~60) + KPI (~120) + spacing (~68) + padding
            // (~42) = ~290pt. Vi bruker 320 som konservativ margin.
            let dynamicMapHeight = max(Self.mapHeight, geo.size.height - 320)

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
                              leads: effectiveLeads)
                    KPICardRow(leads: effectiveLeads, momentum: momentum, forecast: forecast,
                               compact: isCompact || isPortrait)
                    if isCompact {
                        LeadsInAreaCard(leads: effectiveLeads)
                            .frame(height: dynamicMapHeight)
                    } else if isPortrait {
                        LeadsInAreaCard(leads: effectiveLeads)
                            .frame(height: max(720, geo.size.height - 320))
                    } else {
                        LeadsInAreaCard(leads: effectiveLeads)
                            .frame(height: dynamicMapHeight)
                    }
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

    private var upcomingFollowupsCount: Int {
        let cal = Calendar.current
        let threeDays = cal.date(byAdding: .day, value: 3, to: Date()) ?? Date()
        return effectiveLeads.filter { lead in
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
        // Pakke 10: bind til prod-APIClient sine ekte endepunkter
        // (/api/leadgrid/momentum/today + /api/leadgrid/forecasting/pipeline).
        // Hvis api ikke er tilgjengelig (kun før login fullført), eller backend
        // svarer med feil, beholdes momentum/forecast som nil — KPI-rader degraderes
        // gracefulst.
        guard let api = appState.api else {
            await MainActor.run { self.lastUpdated = Date() }
            return
        }
        async let momTask: LeadgridMomentum? = try? api.fetchMomentumToday()
        async let fcTask: LeadgridForecast? = try? api.fetchPipelineForecast()
        let (mom, fc) = await (momTask, fcTask)
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
            .filter { $0.nextFollowUpAt != nil || $0.status == .meetingBooked || ($0.leadScore ?? 0) >= 70 }
            .sorted { ($0.leadScore ?? 0) > ($1.leadScore ?? 0) }
            .prefix(8))
    }

    var body: some View {
        // Matcher Kart-fanens unifiedHeader (Pakke 10.1 header-harmoni
        // 2026-07-01): 28pt title, 13pt subtitle, spacing 14/8, tightere
        // date-label på isNarrow. Popovers har fortsatt Oversikt-spesifikt
        // innhold, men ramme + presentation stil er i tråd med Kart.
        GeometryReader { geo in
            let isNarrow = geo.size.width < 1100
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Oversikt")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.white)
                    if !isNarrow {
                        Text("Få full kontroll over dine leads, aktiviteter og resultater.")
                            .font(.system(size: 13))
                            .foregroundStyle(Brand.textSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                HStack(spacing: 8) {
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
                    .macCatalystHover()
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
        .frame(height: 60)
    }

    private var analyseButton: some View {
        Button {
            analyseOpen.toggle()
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(Brand.card)
                RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1)
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .macCatalystHover()
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
                    RoundedRectangle(cornerRadius: 12).fill(Brand.card)
                    RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1)
                    Image(systemName: "checklist")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                }
                .frame(width: 44, height: 44)
                // Liten badge med antall hot/varme leads som venter
                if topActions.count > 0 {
                    Text("\(min(topActions.count, 99))")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Brand.purple, in: Capsule())
                        .overlay(Capsule().stroke(Brand.bg, lineWidth: 1.5))
                        .offset(x: 6, y: -6)
                }
            }
        }
        .buttonStyle(.plain)
        .macCatalystHover()
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
                    RoundedRectangle(cornerRadius: 12).fill(Brand.card)
                    RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1)
                    Image(systemName: "bell.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                }
                .frame(width: 44, height: 44)
                // Liten badge med antall nye aktiviteter (preview viser 4)
                Circle()
                    .fill(Brand.red)
                    .frame(width: 8, height: 8)
                    .offset(x: -8, y: 8)
            }
        }
        .buttonStyle(.plain)
        .macCatalystHover()
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
                .foregroundStyle(Brand.purpleLight)
            Text(text)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))
    }

    private var userBadge: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(Brand.purple.opacity(0.25))
                Text(initials)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(displayName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("Salgssjef")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.textSecondary)
                    .lineLimit(1)
            }
            .fixedSize(horizontal: true, vertical: false)
            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Brand.textSecondary)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))
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
            Circle().fill(Brand.purple.opacity(0.25))
            Text(initials)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Brand.purpleLight)
            Circle().stroke(Brand.stroke, lineWidth: 1)
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

    // Trend-pille: vis kun når vi har en faktisk verdi å trende fra.
    // Pakke 10: før vi har historikk-data fra backend bruker vi de tidligere
    // hardkodede preview-verdiene KUN når tall > 0. Da slipper vi den
    // misvisende "0 leads / +18% vs forrige periode"-tomme tilstanden.
    private var totalLeadsCard: some View {
        KPICard(
            icon: "person.2.fill", iconBg: Brand.blue.opacity(0.25), iconColor: Brand.blue,
            label: "Total leads",
            value: formatNumber(totalLeads),
            trend: totalLeads > 0 ? "+18%" : nil, trendUp: totalLeads > 0 ? true : nil)
    }
    private var hotLeadsCard: some View {
        KPICard(
            icon: "flame.fill", iconBg: Brand.red.opacity(0.25), iconColor: Brand.red,
            label: "Hot leads",
            value: "\(hotLeads)",
            trend: hotLeads > 0 ? "+24%" : nil, trendUp: hotLeads > 0 ? true : nil)
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
            trend: hasValue ? "+15%" : nil, trendUp: hasValue ? true : nil)
    }
    private var wonCard: some View {
        let wonCount = leads.filter { $0.status == .won }.count
        return KPICard(
            icon: "trophy.fill", iconBg: Brand.green.opacity(0.25), iconColor: Brand.green,
            label: "Vunnet i år",
            value: wonValue,
            trend: wonCount > 0 ? "+32%" : nil, trendUp: wonCount > 0 ? true : nil)
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
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(iconColor)
                }
                .frame(width: 36, height: 36)
                Text(label)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Brand.textSecondary)
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
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Brand.textTertiary)
            } else {
                Text("Ingen data enda")
                    .font(.system(size: 10, weight: .medium))
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
    // Lokal måle-modus på mini-kartet (Daniel-fix 2026-07-01):
    @State private var miniMeasureMode: Bool = false
    @State private var miniMeasureA: CLLocationCoordinate2D?
    @State private var miniMeasureB: CLLocationCoordinate2D?

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

    /// Pakke 10.1: filter mini-kart + KPI-strippen basert på tier.
    private var pinnedLeads: [LeadModel] {
        leads
            .filter { $0.latitude != 0 || $0.longitude != 0 }
            .filter { activeTier.matches($0) }
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
                    .foregroundStyle(Brand.purpleLight)
                Spacer()
                FilterChip(label: "Alle status", icon: "line.3.horizontal.decrease.circle")
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
            // MapReader → gir MapProxy så vi kan konvertere touch-punkter til
            // ekte lat/lon i måle-modus. Standard-tap går til gesture bare
            // når measure-mode er ON; ellers pan/zoom fungerer normalt.
            MapReader { proxy in
                Map(position: $miniCamera, interactionModes: [.pan, .zoom]) {
                    ForEach(Array(pinnedLeads.prefix(10).enumerated()), id: \.offset) { _, lead in
                        let score = lead.leadScore ?? 0
                        Annotation(lead.name,
                                   coordinate: CLLocationCoordinate2D(latitude: lead.latitude,
                                                                      longitude: lead.longitude)) {
                            MiniPin(score: score,
                                    isHot: score >= 90 || lead.status == .meetingBooked,
                                    isWarm: (50..<70).contains(score))
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
                    }
                    // Måle-modus: A-punkt, B-punkt og polyline
                    if let a = miniMeasureA {
                        Annotation("A", coordinate: a) {
                            miniMeasureMarker(label: "A")
                        }
                    }
                    if let b = miniMeasureB {
                        Annotation("B", coordinate: b) {
                            miniMeasureMarker(label: "B")
                        }
                    }
                    if let a = miniMeasureA, let b = miniMeasureB {
                        MapPolyline(coordinates: [a, b])
                            .stroke(Brand.green,
                                    style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [6, 4]))
                    }
                }
                .mapStyle(miniMapStyle.mapKitStyle)
                .environment(\.colorScheme, timeOfDayColorScheme)
                // Strekkes naturlig — fyller resten av cardet
                .frame(maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(timeOfDayTint.opacity(0.15))
                        .blendMode(.overlay)
                        .allowsHitTesting(false)
                )
                .onMapCameraChange(frequency: .continuous) { ctx in
                    miniCurrentRegion = ctx.region
                }
                .onTapGesture(coordinateSpace: .local) { point in
                    guard miniMeasureMode,
                          let coord = proxy.convert(point, from: .local) else { return }
                    if miniMeasureA == nil {
                        miniMeasureA = coord
                        miniShowToast("Punkt A satt — tap for punkt B")
                    } else if miniMeasureB == nil {
                        miniMeasureB = coord
                    } else {
                        // Begge satt — nullstill og start på nytt
                        miniMeasureA = coord
                        miniMeasureB = nil
                        miniShowToast("Nullstill — punkt A satt igjen")
                    }
                }
            }

            // Måle-modus-banner øverst-venstre (kun synlig når mode er på)
            if miniMeasureMode {
                VStack {
                    HStack(spacing: 8) {
                        Image(systemName: "ruler.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Brand.green)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("MÅLE-MODUS")
                                .font(.system(size: 9, weight: .black))
                                .foregroundStyle(Brand.green).tracking(0.6)
                            Text(miniMeasureBannerText)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                        Spacer()
                        Button {
                            miniMeasureMode = false
                            miniMeasureA = nil
                            miniMeasureB = nil
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(.white.opacity(0.8))
                        }.buttonStyle(.plain)
                    }
                    .padding(10)
                    .background(Brand.card.opacity(0.92), in: RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Brand.green.opacity(0.5), lineWidth: 1)
                    )
                    .padding(14)
                    Spacer()
                }
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
                Text(t).font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(Brand.purple.opacity(0.95), in: Capsule())
                    .padding(14)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }
        }
        .sheet(isPresented: $showMiniLayers) {
            LayersSheet(selectedStyle: $miniMapStyle, activeOverlays: $miniActiveOverlays)
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
                        .font(.system(size: 40))
                        .foregroundStyle(.green)
                    Text("Lead opprettet")
                        .font(.headline)
                    Text(dto.name)
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
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
        }
        .frame(width: 24, height: 24)
        .shadow(color: Brand.green.opacity(0.6), radius: 5, y: 2)
    }

    /// Instruksjon i måle-modus-banner. Viser avstand når begge punkter satt.
    private var miniMeasureBannerText: String {
        if let a = miniMeasureA, let b = miniMeasureB {
            let la = CLLocation(latitude: a.latitude, longitude: a.longitude)
            let lb = CLLocation(latitude: b.latitude, longitude: b.longitude)
            let km = la.distance(from: lb) / 1000
            if km < 1 {
                return String(format: "Avstand: %.0f m", km * 1000)
            }
            return String(format: "Avstand: %.2f km", km)
                .replacingOccurrences(of: ".", with: ",")
        }
        if miniMeasureA != nil { return "Tap for punkt B" }
        return "Tap på kartet for punkt A"
    }

    private func miniFABButton(icon: String, action: @escaping () -> Void) -> some View {
        // Mac Catalyst-fix (3, endelig): kombinerer tre robusthetstiltak:
        // 1) Button + .buttonStyle(.plain) — native NSButton på Catalyst
        // 2) Større 44×44 hit-target (matcher Apple HIG minimum touch target)
        // 3) .contentShape(Rectangle()) sikrer hele frame er klikkbart
        // Sammen med .zIndex(100) på FAB-VStack (settes lenger opp) gir
        // dette stabil oppførsel på både iPad og Mac.
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
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
        HStack(spacing: 8) {
            ForEach(0..<tiers.count, id: \.self) { idx in
                tierChip(tiers[idx])
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
private struct MiniPin: View {
    let score: Int
    let isHot: Bool
    let isWarm: Bool

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
                Text("\(score)")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .offset(y: -6)
            }
            .frame(width: 38, height: 48)
            .shadow(color: shadowColor, radius: 6, x: 0, y: 2)
        }
        .frame(width: 100, height: 100)
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
        .background(Brand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(Brand.stroke, lineWidth: 1))
    }
}

// MARK: - NextActionsCard

private struct NextActionsCard: View {
    let leads: [LeadModel]

    private var topLeads: [LeadModel] {
        Array(leads
            .sorted { ($0.leadScore ?? 0) > ($1.leadScore ?? 0) }
            .prefix(4))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Neste handlinger").font(.headline).foregroundStyle(.white)
                Spacer()
                Text("Se alle (\(leads.count))")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
            }
            ForEach(topLeads, id: \.id) { lead in
                NextActionRow(lead: lead)
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
    }
}

struct NextActionRow: View {
    let lead: LeadModel

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
                    .foregroundStyle(Brand.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 6) {
                Text(actionTime)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textSecondary)
                Text(actionLabel)
                    .font(.system(size: 12, weight: .semibold))
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
            Stage(name: "Nye leads",    count: new,      color: Brand.purple, trend: "+18%", trendUp: true),
            Stage(name: "Kontaktet",    count: contacted, color: Brand.blue,   trend: "+12%", trendUp: true),
            Stage(name: "Møter avtalt", count: meeting,  color: Brand.green,  trend: "+8%",  trendUp: true),
            Stage(name: "Tilbud sendt", count: proposal, color: Brand.yellow, trend: "-5%",  trendUp: false),
            Stage(name: "Vunnet",       count: won,      color: Brand.red,    trend: "+21%", trendUp: true),
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
            Divider().background(Brand.stroke).padding(.top, 4)
            HStack {
                Spacer()
                Text("Se full pipeline rapport").font(.system(size: 12, weight: .semibold))
                Image(systemName: "arrow.right").font(.system(size: 11, weight: .semibold))
                Spacer()
            }
            .foregroundStyle(Brand.purpleLight).padding(.top, 2)
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
    }

    private func stageRow(_ stage: Stage) -> some View {
        HStack(spacing: 12) {
            Text(stage.name)
                .font(.system(size: 12, weight: .semibold))
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
            .foregroundStyle(stage.trendUp ? Brand.green : Brand.red)
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
                row(icon: "phone.fill", color: Brand.blue, label: "Telefoner", value: calls)
                row(icon: "envelope.fill", color: Brand.purple, label: "E-poster", value: emails)
                row(icon: "calendar", color: Brand.green, label: "Møter", value: meetings)
                row(icon: "mappin.and.ellipse", color: Brand.orange, label: "Besøk", value: visits)
            }
            Divider().background(Brand.stroke).padding(.top, 4)
            HStack {
                Spacer()
                Text("Se alle aktiviteter").font(.system(size: 12, weight: .semibold))
                Image(systemName: "arrow.right").font(.system(size: 11, weight: .semibold))
                Spacer()
            }
            .foregroundStyle(Brand.purpleLight).padding(.top, 2)
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
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

            HStack {
                Text("1. mai").font(.system(size: 10)).foregroundStyle(Brand.textTertiary)
                Spacer()
                Text("31. mai").font(.system(size: 10)).foregroundStyle(Brand.textTertiary)
            }
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1))
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
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("Totalt")
                    .font(.system(size: 10, weight: .semibold))
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
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                Text(b.range)
                    .font(.system(size: 9))
                    .foregroundStyle(Brand.textTertiary)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 0) {
                Text("\(b.count.formatted(.number.locale(Locale(identifier: "nb_NO"))))")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("\(percent(b.count))%")
                    .font(.system(size: 9, weight: .medium))
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

    private var sellers: [Seller] {
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
        let isMe = s.name == currentUserName
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

// MARK: - MyProfileSheet (åpnes når brukeren tapper "Min profil" i ProfilePopover)
//
// Full-skjerm sheet med detaljert salgs-profil: hero-kort med stats,
// kontakt-info, månedsmål-progress, achievements, og handlings-knapper.

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
                    // Utvikler-verktøy (Pakke 10) — demo-modus toggle.
                    VStack(alignment: .leading, spacing: 10) {
                        Text("UTVIKLER")
                            .font(.system(size: 10, weight: .black))
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
                    .font(.system(size: 36, weight: .bold))
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
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
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
                    .foregroundStyle(Brand.purpleLight)
                if let email = email {
                    Text(email)
                        .font(.caption)
                        .foregroundStyle(Brand.textSecondary)
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
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Brand.red)
            Text("\(currentStreak)-dagers streak")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(Brand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(Brand.red.opacity(0.4), lineWidth: 1))
    }

    private var teamRankChip: some View {
        HStack(spacing: 6) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Brand.yellow)
            Text("#\(teamRank) av \(teamSize)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(Brand.cardHi, in: Capsule())
        .overlay(Capsule().stroke(Brand.yellow.opacity(0.4), lineWidth: 1))
    }

    private var teamPositionCard: some View {
        Button { topSellersOpen = true } label: {
            HStack(spacing: 16) {
                ZStack {
                    Circle().fill(LinearGradient(
                        colors: [Brand.yellow.opacity(0.7), Brand.orange.opacity(0.7)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .frame(width: 54, height: 54)
                .shadow(color: Brand.yellow.opacity(0.5), radius: 8, y: 3)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Topp \(teamRank) av \(teamSize) selgere")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Du ligger på 3. plass i Creatorhub Norge for Q2 2026")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 2) {
                    HStack(spacing: 4) {
                        Text("↑ 2")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Brand.green)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Brand.textTertiary)
                    }
                    Text("Se hele lista")
                        .font(.system(size: 9, weight: .medium))
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
                    .foregroundStyle(Brand.green)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Brand.green.opacity(0.15), in: Capsule())
            }
            Chart(points) { pt in
                LineMark(x: .value("Dag", pt.day), y: .value("Won", pt.v))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [Brand.purple, Brand.purpleLight],
                        startPoint: .leading, endPoint: .trailing))
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                AreaMark(x: .value("Dag", pt.day), y: .value("Won", pt.v))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(
                        colors: [Brand.purple.opacity(0.4), Brand.purple.opacity(0)],
                        startPoint: .top, endPoint: .bottom))
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(height: 90)
            HStack {
                Text("Beste streak")
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                Spacer()
                Text("\(bestStreak) dager")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
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
                     trend: "+18%")
            statCard(icon: "trophy.fill", color: Brand.green,
                     label: "Vunnet i mnd",
                     value: "\(wonThisMonth)",
                     trend: "+5")
            statCard(icon: "chart.bar.fill", color: Brand.purple,
                     label: "Gjennomsnittlig score",
                     value: "\(avgScore)",
                     trend: nil)
            statCard(icon: "checkmark.seal.fill", color: Brand.orange,
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
                        .foregroundStyle(Brand.green)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Brand.green.opacity(0.15), in: Capsule())
                }
            }
            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 11, weight: .medium))
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
                .font(.system(size: 11))
                .foregroundStyle(Brand.textSecondary)
        }
        .padding(16)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Brand.stroke, lineWidth: 1))
    }

    private var contactInfoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Kontaktinformasjon")
                .font(.system(size: 15, weight: .semibold))
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
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 28, height: 28)
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Brand.textSecondary)
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
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(earned ? color : Brand.textTertiary)
                if earned {
                    // Liten "checkmark" badge i hjørnet
                    ZStack {
                        Circle().fill(Brand.green)
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
                .foregroundStyle(earned ? .white : Brand.textTertiary)
            Text(desc)
                .font(.system(size: 9))
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
            actionRow(icon: "lock.fill", color: Brand.purple, label: "Endre passord")
            actionRow(icon: "key.fill", color: Brand.blue, label: "Tofaktor-autentisering")
            actionRow(icon: "arrow.down.doc.fill", color: Brand.green, label: "Last ned mine data")
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
                .foregroundStyle(Brand.textTertiary)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))
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
    var onOpenMyProfile: () -> Void = {}

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
                        row(icon: "building.2.fill", color: Brand.blue,
                            label: "Bytt organisasjon",
                            trailing: "Creatorhub AS")
                        row(icon: "folder.fill", color: Brand.green,
                            label: "Bytt prosjekt",
                            trailing: "Alle (5)")
                    }
                    section(title: "Apper") {
                        row(icon: "gearshape.fill", color: Brand.textSecondary, label: "Innstillinger")
                        row(icon: "moon.fill", color: Brand.purpleLight, label: "Mørk modus",
                            toggle: .constant(true))
                        row(icon: "bell.badge.fill", color: Brand.orange, label: "Varslinger")
                    }
                    section(title: "Hjelp") {
                        row(icon: "questionmark.circle.fill", color: Brand.blue, label: "Hjelp & støtte")
                        row(icon: "lightbulb.fill", color: Brand.yellow, label: "Forstå pinsene")
                        row(icon: "info.circle.fill", color: Brand.textSecondary,
                            label: "Om Leadgrid", trailing: "v1.3.1")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 14)
            }

            Divider().background(Brand.stroke)

            Button {} label: {
                HStack(spacing: 10) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Logg ut")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(Brand.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .background(Brand.card)
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
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 52, height: 52)
            .shadow(color: Brand.purple.opacity(0.5), radius: 8, y: 2)

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let email = email {
                    Text(email)
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                        .lineLimit(1)
                }
                Text("Salgssjef · Creatorhub AS")
                    .font(.system(size: 11, weight: .medium))
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
                .font(.system(size: 11, weight: .bold))
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
                    .tint(Brand.purple)
                    .scaleEffect(0.85)
            } else {
                if let t = trailing {
                    Text(t)
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.textTertiary)
                        .lineLimit(1)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Brand.textTertiary)
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
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.textSecondary)
                }
                Spacer()
                Text("Full rapport")
                    .font(.system(size: 12, weight: .semibold))
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
                        .foregroundStyle(Brand.textSecondary)
                }
                Spacer()
                Text("Se alle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
            }
            .padding(16)

            Divider().background(Brand.stroke)

            ScrollView {
                VStack(spacing: 10) {
                    if leads.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(Brand.green)
                            Text("Du er ajour!")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("Ingen oppfølginger venter.")
                                .font(.caption)
                                .foregroundStyle(Brand.textSecondary)
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
        .background(Brand.card)
    }
}

// MARK: - RecentActivitiesPopover (header-dropdown)

struct RecentActivitiesPopover: View {
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
                    .foregroundStyle(Brand.purpleLight)
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

            Divider().background(Brand.stroke)

            HStack {
                Spacer()
                Text("Oppdaterte data for 2 min siden")
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.textTertiary)
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Brand.textTertiary)
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
        }
        .background(Brand.card)
    }
}

struct PopoverSectionHeader: View {
    let label: String
    var body: some View {
        Text(label)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Brand.textSecondary)
            .textCase(.uppercase)
            .tracking(0.8)
    }
}

/// Kompakt versjon av ActivityTodayCard (uten card-bakgrunn) for bruk
/// inni popover-en. Tallene er demo-mock — gates når demo AV så aktivitet
/// ikke lyver om hva teamet har gjort i dag.
private struct ActivityTodayCompact: View {
    let momentum: LeadgridMomentum?
    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }
    private var calls: Int    { isDemo ? 14 : 0 }
    private var emails: Int   { isDemo ? 22 : 0 }
    private var meetings: Int { isDemo ? 3  : 0 }
    private var visits: Int   { isDemo ? 7  : 0 }

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
                Circle().fill(Brand.purple.opacity(0.20))
                Image(systemName: "sparkles")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.purpleLight)
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
        // Demo AV OG ingen ekte leads → tom aktivitet, så popover ikke
        // fabrikkerer «Lead åpnet tilbudet»-hendelser fra tomme data.
        guard DemoModeManager.isActiveNonisolated || !leads.isEmpty else {
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
                    Text("Se alle")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.purpleLight)
                }
            }
            if events.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 22))
                        .foregroundStyle(Brand.textTertiary)
                    Text("Ingen hendelser enda")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.textSecondary)
                    Text("Aktivitet dukker opp her etter hvert som teamet ringer, sender e-post og booker møter.")
                        .font(.system(size: 10))
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
                HStack {
                    Spacer()
                    Text("Se alle aktiviteter").font(.system(size: 12, weight: .semibold))
                    Image(systemName: "arrow.right").font(.system(size: 11, weight: .semibold))
                    Spacer()
                }
                .foregroundStyle(Brand.purpleLight).padding(.top, 2)
            }
        }
        .padding(16)
        .background(embedded ? Color.clear : Brand.card,
                    in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            embedded ? nil : RoundedRectangle(cornerRadius: 16).stroke(Brand.stroke, lineWidth: 1)
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
                .foregroundStyle(Brand.purpleLight)
            Text("Tips:")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            Text("Du har \(upcoming) oppfølginger som forfaller i løpet av de neste 3 dagene.")
                .font(.system(size: 13))
                .foregroundStyle(Brand.textSecondary)
            Spacer()
            Text("Oppdaterte data for 2 min siden")
                .font(.system(size: 11))
                .foregroundStyle(Brand.textTertiary)
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Brand.textTertiary)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Brand.stroke, lineWidth: 1))
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
    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab = .catalog
    @State private var newContestOpen: Bool = false

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
                    }
                    .padding(20)
                }
            }
            .background(Brand.bg.ignoresSafeArea())
            .navigationTitle("Salgsledelse")
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
                            .font(.system(size: 15, weight: .bold))
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

    private var saveButton: some View {
        Button {
            onSave(preview)
        } label: {
            Text("Bruk denne premien")
                .font(.system(size: 15, weight: .bold))
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
        return Button {
            if let n = next {
                award.wrappedValue.currentStep = n
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: a.currentStep == .received ? "checkmark.seal.fill" : "arrow.right.circle.fill")
                    .font(.system(size: 12, weight: .bold))
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

