// TeamView.swift
//
// Pixel-perfect Team-fane matchende mockup (2026-06-29):
//
//   ┌────────────────────────────────────────────────────────┐
//   │ Team                          [📅 I dag 20.5][+ Inviter]│
//   │ Få oversikt over teamets aktivitet, resultater         │
//   │ ┌─ KPI ─┬─ KPI ─┬─ KPI ─┬─ KPI ─┬─ KPI ─┐               │
//   │ │ 1248  │ 23    │ 350k  │ 72    │ 68%  │               │
//   │ └───────┴───────┴───────┴───────┴───────┘               │
//   │ ┌─ Teamets prestasjoner ──┐  ┌─ Teamets områder ─┐    │
//   │ │ Tabell 5 medlemmer       │  │ Norge-kart 4 terr. │   │
//   │ └──────────────────────────┘  └────────────────────┘   │
//   │ ┌─ Aktivitet i sanntid ───┐  ┌─ Teamets pipeline ─┐    │
//   │ │ 5 events                 │  │ Funnel + konv-tab. │   │
//   │ └──────────────────────────┘  └────────────────────┘   │
//   └────────────────────────────────────────────────────────┘

import SwiftUI
import MapKit

enum TBrand {
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
    static let pink = Color(red: 0.98, green: 0.35, blue: 0.65)
    static let textSecondary = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.35)
}

// MARK: - Models

struct TeamMember: Identifiable, Hashable {
    /// Mock-rader får tilfeldig UUID; backend-rader får uuid fra user-id
    /// (TeamLiveStore) så identitet overlever re-fetch.
    var id = UUID()
    let name: String
    let area: String
    let initials: String
    let color: Color
    let leads: Int
    let leadsTrend: Int
    let meetings: Int
    let meetingsTrend: Int
    let valueNok: Int
    let valueTrend: Int           // % change
    let momentum: Int             // 0-100
    var momentumColor: Color {
        switch momentum {
        case 75...: return TBrand.green
        case 55..<75: return TBrand.green
        case 40..<55: return TBrand.yellow
        default: return TBrand.red
        }
    }
}

struct ActivityEvent: Identifiable, Hashable {
    let id = UUID()
    let memberName: String
    let memberInitials: String
    let memberColor: Color
    let action: String
    let highlight: String?        // valgfri farge-tekst
    let highlightColor: Color
    let timeAgo: String
}

struct PipelineStage: Identifiable, Hashable {
    let id = UUID()
    let label: String
    let count: Int
    let color: Color
    let topFraction: Double       // topp-bredde / total
    let bottomFraction: Double    // bunn-bredde / total — = topFraction til neste segment
}

struct ConversionRow: Identifiable, Hashable {
    let id = UUID()
    let label: String
    let pct: Double
    let isTotal: Bool
}

struct TeamArea: Identifiable {
    let id = UUID()
    let memberName: String
    let areaName: String
    let color: Color
    let center: CLLocationCoordinate2D
    let coords: [CLLocationCoordinate2D]   // polygon
}

// MARK: - Mock data

enum TeamData {
    // Pakke 10.1 — demo-mode-gated
    private static let _members: [TeamMember] = [
        TeamMember(name: "Kari Nordmann",   area: "Oslo Vest",     initials: "KN", color: TBrand.purple,      leads: 245, leadsTrend: 20, meetings: 8, meetingsTrend: 33,  valueNok: 180_000, valueTrend: 35,  momentum: 88),
        TeamMember(name: "Ola Magnussen",   area: "Oslo Sentrum",  initials: "OM", color: TBrand.blue,        leads: 198, leadsTrend: 12, meetings: 4, meetingsTrend: 14,  valueNok: 95_000,  valueTrend: 10,  momentum: 72),
        TeamMember(name: "Martine Jensen",  area: "Lørenskog",     initials: "MJ", color: TBrand.green,       leads: 176, leadsTrend: 8,  meetings: 3, meetingsTrend: 25,  valueNok: 55_000,  valueTrend: 15,  momentum: 61),
        TeamMember(name: "Henrik Solberg",  area: "Asker / Bærum", initials: "HS", color: TBrand.yellow,      leads: 165, leadsTrend: -5, meetings: 2, meetingsTrend: -20, valueNok: 20_000,  valueTrend: -10, momentum: 42),
        TeamMember(name: "Sofie Dahl",      area: "Sarpsborg",     initials: "SD", color: TBrand.pink,        leads: 132, leadsTrend: 10, meetings: 2, meetingsTrend: 100, valueNok: 0,       valueTrend: 0,   momentum: 28),
    ]

    /// Demo PÅ → mock; ellers EKTE medlemmer fra TeamLiveStore (uke 2:
    /// sales-leadership/team-members + kalender-møter + synkede team).
    @MainActor static var members: [TeamMember] {
        DemoModeManager.isActiveNonisolated ? _members : TeamLiveStore.shared.members
    }

    /// Demo-mode-gated aktiviteter. Ved demo AV → tom → «Ingen aktivitet
    /// enda» (ingen aktivitets-feed-endepunkt i backend enda).
    static var activities: [ActivityEvent] {
        DemoModeManager.isActiveNonisolated ? _activities : []
    }

    /// Demo PÅ → mock-trakt; ellers beregnet fra ekte lead-statuser.
    @MainActor static var pipeline: [PipelineStage] {
        DemoModeManager.isActiveNonisolated ? _pipeline : TeamLiveStore.shared.pipeline
    }

    /// Demo PÅ → mock; ellers konverteringsrater fra ekte tellinger.
    @MainActor static var conversions: [ConversionRow] {
        DemoModeManager.isActiveNonisolated ? _conversions : TeamLiveStore.shared.conversions
    }

    private static let _activities: [ActivityEvent] = [
        ActivityEvent(memberName: "Kari Nordmann",    memberInitials: "KN", memberColor: TBrand.purple, action: "Registrerte møte med Nordic Elektro AS",         highlight: nil,          highlightColor: .clear,           timeAgo: "5 min siden"),
        ActivityEvent(memberName: "Ola Magnussen",    memberInitials: "OM", memberColor: TBrand.blue,   action: "Opprettet ny lead: Byggmester Hansen AS",        highlight: nil,          highlightColor: .clear,           timeAgo: "12 min siden"),
        ActivityEvent(memberName: "Martine Jensen",   memberInitials: "MJ", memberColor: TBrand.green,  action: "Sendte tilbud til Energiteknikk AS",             highlight: nil,          highlightColor: .clear,           timeAgo: "18 min siden"),
        ActivityEvent(memberName: "Henrik Solberg",   memberInitials: "HS", memberColor: TBrand.yellow, action: "Oppdaterte status på Oslo Tech AS til ",         highlight: "Varm Lead",  highlightColor: TBrand.orange,    timeAgo: "23 min siden"),
        ActivityEvent(memberName: "Sofie Dahl",       memberInitials: "SD", memberColor: TBrand.pink,   action: "Fullførte oppfølging med LogiPartner AS",        highlight: nil,          highlightColor: .clear,           timeAgo: "1 t siden"),
        ActivityEvent(memberName: "Kari Nordmann",    memberInitials: "KN", memberColor: TBrand.purple, action: "Vant deal: Sandvika Auto AS — NOK 240 000",      highlight: "Vunnet",      highlightColor: TBrand.green,    timeAgo: "1 t siden"),
        ActivityEvent(memberName: "Ola Magnussen",    memberInitials: "OM", memberColor: TBrand.blue,   action: "Logget anrop med Skandi Bygg AS",                highlight: nil,          highlightColor: .clear,           timeAgo: "2 t siden"),
        ActivityEvent(memberName: "Martine Jensen",   memberInitials: "MJ", memberColor: TBrand.green,  action: "Bokte møte med Romerike Elektro AS",             highlight: nil,          highlightColor: .clear,           timeAgo: "2 t siden"),
        ActivityEvent(memberName: "Henrik Solberg",   memberInitials: "HS", memberColor: TBrand.yellow, action: "Markerte lead som ",                              highlight: "Tapt",        highlightColor: TBrand.red,      timeAgo: "3 t siden"),
        ActivityEvent(memberName: "Sofie Dahl",       memberInitials: "SD", memberColor: TBrand.pink,   action: "La til notat på Vestby Industri AS",             highlight: nil,          highlightColor: .clear,           timeAgo: "3 t siden"),
        ActivityEvent(memberName: "Kari Nordmann",    memberInitials: "KN", memberColor: TBrand.purple, action: "Sendte e-post-kampanje til 23 leads",            highlight: nil,          highlightColor: .clear,           timeAgo: "4 t siden"),
        ActivityEvent(memberName: "Ola Magnussen",    memberInitials: "OM", memberColor: TBrand.blue,   action: "Lukket deal med Aker Logistics AS — NOK 180 000", highlight: "Vunnet",     highlightColor: TBrand.green,    timeAgo: "5 t siden"),
    ]

    private static let _pipeline: [PipelineStage] = [
        // Litt mindre aggressiv smalning så tekst får plass selv i bunnsegmentene
        PipelineStage(label: "Nye leads",    count: 1248, color: TBrand.purple, topFraction: 1.00, bottomFraction: 0.86),
        PipelineStage(label: "Kontaktet",    count: 842,  color: TBrand.blue,   topFraction: 0.86, bottomFraction: 0.72),
        PipelineStage(label: "Møter avtalt", count: 236,  color: TBrand.green,  topFraction: 0.72, bottomFraction: 0.58),
        PipelineStage(label: "Tilbud sendt", count: 89,   color: TBrand.yellow, topFraction: 0.58, bottomFraction: 0.44),
        PipelineStage(label: "Vunnet",       count: 23,   color: TBrand.red,    topFraction: 0.44, bottomFraction: 0.30),
    ]

    private static let _conversions: [ConversionRow] = [
        ConversionRow(label: "Nye leads → Kontaktet",   pct: 67, isTotal: false),
        ConversionRow(label: "Kontaktet → Møter",       pct: 28, isTotal: false),
        ConversionRow(label: "Møter → Tilbud",          pct: 38, isTotal: false),
        ConversionRow(label: "Tilbud → Vunnet",         pct: 26, isTotal: false),
        ConversionRow(label: "Total konvertering",      pct: 1.8, isTotal: true),
    ]

    /// Demo-mode-gated computed getter for kart-områdene. Ved demo AV → tom.
    static var areas: [TeamArea] {
        DemoModeManager.isActiveNonisolated ? _areas : []
    }

    // Rene geometriske former matchende mockup (4-5 hjørner, lett rotert)
    private static let _areas: [TeamArea] = [
        // Kari — pentagon Oslo Vest
        TeamArea(memberName: "Kari", areaName: "Oslo Vest",
                 color: TBrand.purple,
                 center: CLLocationCoordinate2D(latitude: 59.955, longitude: 10.630),
                 coords: [
                    CLLocationCoordinate2D(latitude: 59.985, longitude: 10.580),
                    CLLocationCoordinate2D(latitude: 59.990, longitude: 10.690),
                    CLLocationCoordinate2D(latitude: 59.945, longitude: 10.720),
                    CLLocationCoordinate2D(latitude: 59.920, longitude: 10.640),
                    CLLocationCoordinate2D(latitude: 59.945, longitude: 10.560),
                 ]),
        // Ola — kvadrat Oslo Sentrum (litt rotert)
        TeamArea(memberName: "Ola", areaName: "Oslo Sentrum",
                 color: TBrand.blue,
                 center: CLLocationCoordinate2D(latitude: 59.918, longitude: 10.785),
                 coords: [
                    CLLocationCoordinate2D(latitude: 59.945, longitude: 10.745),
                    CLLocationCoordinate2D(latitude: 59.935, longitude: 10.830),
                    CLLocationCoordinate2D(latitude: 59.895, longitude: 10.820),
                    CLLocationCoordinate2D(latitude: 59.905, longitude: 10.740),
                 ]),
        // Martine — kvadrat Lørenskog (rotert)
        TeamArea(memberName: "Martine", areaName: "Lørenskog",
                 color: TBrand.green,
                 center: CLLocationCoordinate2D(latitude: 59.948, longitude: 10.965),
                 coords: [
                    CLLocationCoordinate2D(latitude: 59.985, longitude: 10.910),
                    CLLocationCoordinate2D(latitude: 59.980, longitude: 11.040),
                    CLLocationCoordinate2D(latitude: 59.915, longitude: 11.020),
                    CLLocationCoordinate2D(latitude: 59.925, longitude: 10.895),
                 ]),
        // Henrik — pentagon Asker/Bærum
        TeamArea(memberName: "Henrik", areaName: "Asker / Bærum",
                 color: TBrand.yellow,
                 center: CLLocationCoordinate2D(latitude: 59.855, longitude: 10.625),
                 coords: [
                    CLLocationCoordinate2D(latitude: 59.895, longitude: 10.560),
                    CLLocationCoordinate2D(latitude: 59.885, longitude: 10.700),
                    CLLocationCoordinate2D(latitude: 59.835, longitude: 10.720),
                    CLLocationCoordinate2D(latitude: 59.795, longitude: 10.640),
                    CLLocationCoordinate2D(latitude: 59.825, longitude: 10.530),
                 ]),
    ]
}

// MARK: - Main view

struct TeamView: View {
    @State private var showInvite = false
    @State private var showActivity = false
    @State private var showMembers = false
    @State private var showPipeline = false
    @State private var selectedKPI: TeamKPI?
    @State private var showNewKPI = false
    // Pakke 10.1 — rike header-popovere (chart wired til pipeline, kun checklist + bell)
    @State private var nextActionsOpen = false
    @State private var notificationsOpen = false
    // Team-tilganger flyttet fra global profil-menu → Team-fanen (2026-07-01).
    @State private var showTeamAccess = false
    // Rute-status dashboard (salgssjef+, 2026-07-02).
    @State private var showRouteAdherence = false
    @Environment(AppState.self) private var appState

    var body: some View {
        ZStack {
            TBrand.bg.ignoresSafeArea()
            VStack(spacing: 16) {
                header
                kpiRow
                TeamAreasCard()
                    .frame(maxHeight: .infinity)        // ekspander til alt gjenværende rom
            }
            .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 16)
            // Pakke 10.1: overlay-toast fra alle stubbede eksport/rapport-actions.
            TeamStubToastOverlay()
        }
        .preferredColorScheme(.dark)
        // Uke 2-binding: hent ekte team-data når APIClient er klar.
        // attach er idempotent — re-entry re-beregner bare leads-avledede
        // tall (pipeline/konvertering) så fanen følger kartet.
        .task {
            if let api = appState.api {
                TeamLiveStore.shared.attach(api: api, appState: appState)
            }
        }
        .sheet(isPresented: $showInvite) {
            InviteMemberSheet()
        }
        .sheet(isPresented: $showActivity) {
            ActivityModal()
        }
        .sheet(isPresented: $showMembers) {
            TeamMembersModal()
        }
        .sheet(isPresented: $showPipeline) {
            TeamPipelineModal()
        }
        .sheet(item: $selectedKPI) { k in
            TeamKPIDetailSheet(kpi: k)
        }
        .sheet(isPresented: $showNewKPI) {
            CreateCustomKPISheet()
        }
        .sheet(isPresented: $showTeamAccess) {
            TeamAccessControlView()
        }
        .sheet(isPresented: $showRouteAdherence) {
            RouteAdherenceDashboardView()
        }
    }

    // MARK: Header — alignet m/ Leads/Møter (6 høyre-elementer + Inviter-CTA)

    private var header: some View {
        GeometryReader { geo in
            let isCompact = geo.size.width < 1300        // iPad Pro 11" landscape = 1194pt
            let isVeryCompact = geo.size.width < 1050    // mindre enheter

            HStack(alignment: .top, spacing: 14) {
                if !isCompact { LeadgridHeaderMark().padding(.top, 4) }
                VStack(alignment: .leading, spacing: 4) {
                    Text("Team")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.white)
                    if !isCompact {
                        Text("Få oversikt over teamets aktivitet, resultater og områder.")
                            .font(.system(size: 13))
                            .foregroundStyle(TBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                HStack(spacing: 7) {
                    topPicker(icon: "calendar", text: isCompact ? "Tir 20" : "Tir. 20. mai 2025") {}
                    if !isCompact {
                        topPicker(icon: "person.3.fill", text: "Hele teamet") {
                            showMembers = true
                        }
                    }
                    if !isVeryCompact {
                        topIconButton(icon: "chart.line.uptrend.xyaxis", badge: nil) {
                            showPipeline = true
                        }
                    }
                    activityLiveButton                              // ← live-aktivitet
                    topIconButton(icon: "checklist", badge: 8) { nextActionsOpen.toggle() }
                        .popover(isPresented: $nextActionsOpen, arrowEdge: .top) {
                            NextActionsPopover(leads: appState.leads, totalCount: appState.leads.count)
                                .frame(width: 380, height: 520)
                                .presentationCompactAdaptation(.popover)
                        }
                    topIconButton(icon: "bell.fill", badge: 3) { notificationsOpen.toggle() }
                        .popover(isPresented: $notificationsOpen, arrowEdge: .top) {
                            RecentActivitiesPopover(leads: appState.leads, upcomingFollowups: 0, momentum: nil)
                                .frame(width: 380, height: 520)
                                .presentationCompactAdaptation(.popover)
                        }
                    profileAvatar(isCompact: isCompact)
                    inviteButton(isCompact: isCompact)
                }
                .fixedSize()                              // hindrer komprimering
            }
        }
        .frame(height: 64)
    }

    private func topPicker(icon: String, text: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(TBrand.purpleLight)
                Text(text)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .fixedSize()
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(TBrand.textTertiary)
            }
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(TBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    // Live-aktivitet-knapp m/ pulserende grønn prikk + count-badge
    private var activityLiveButton: some View {
        Button { showActivity = true } label: {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11).fill(TBrand.card)
                    RoundedRectangle(cornerRadius: 11).stroke(TBrand.green.opacity(0.40), lineWidth: 1)
                    Image(systemName: "dot.radiowaves.left.and.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(TBrand.green)
                }
                .frame(width: 42, height: 42)
                // Pulserende prikk
                Circle()
                    .fill(TBrand.green)
                    .frame(width: 9, height: 9)
                    .overlay(Circle().stroke(TBrand.bg, lineWidth: 1.5))
                    .shadow(color: TBrand.green, radius: 4)
                    .offset(x: 4, y: -4)
            }
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private func topIconButton(icon: String, badge: Int?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11).fill(TBrand.card)
                    RoundedRectangle(cornerRadius: 11).stroke(TBrand.stroke, lineWidth: 1)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(TBrand.purpleLight)
                }
                .frame(width: 42, height: 42)
                if let b = badge, b > 0 {
                    Text("\(min(b, 99))")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(TBrand.purple, in: Capsule())
                        .overlay(Capsule().stroke(TBrand.bg, lineWidth: 1.5))
                        .offset(x: 6, y: -6)
                }
            }
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    // Løftet Leadbook-avatar-menu til alle faner (SharedProfileAvatar).
    @State private var showMinProfilAvatar: Bool = false
    @State private var showEcosystemAvatar: Bool = false
    @State private var showTeamAccessAvatar: Bool = false
    @State private var showSuperAdminAvatar: Bool = false

    private func profileAvatar(isCompact: Bool) -> some View {
        SharedProfileAvatar(
            tint: TBrand.purpleLight,
            background: TBrand.card,
            borderColor: TBrand.stroke,
            secondaryText: TBrand.textSecondary,
            tertiaryText: TBrand.textTertiary,
            isCompact: isCompact,
            showMinProfil: $showMinProfilAvatar,
            showEcosystem: $showEcosystemAvatar,
            showTeamAccess: $showTeamAccessAvatar,
            showSuperAdmin: $showSuperAdminAvatar
        )
    }

    private func inviteButton(isCompact: Bool) -> some View {
        Menu {
            Button {
                showInvite = true
            } label: {
                Label("Inviter team-medlem", systemImage: "person.badge.plus")
            }
            Button {
                showNewKPI = true
            } label: {
                Label("Ny KPI", systemImage: "chart.bar.fill")
            }
            Divider()
            // Team-tilganger (RBAC) — flyttet fra global profil-menu 2026-07-01.
            // Bor kontekstuelt her under Team-fanen der roller + tilganger
            // faktisk administreres.
            Button {
                showTeamAccess = true
            } label: {
                Label("Team-tilganger", systemImage: "lock.shield.fill")
            }
            // Rute-status dashboard (2026-07-02, salgssjef+).
            // Åpner RouteAdherenceDashboardView med hele teamets route-
            // compliance sortert best→verst. Alle ser knappen; gate på
            // backend-siden gir 403 for ikke-salgssjef.
            Button {
                showRouteAdherence = true
            } label: {
                Label("Rute-status", systemImage: "arrow.triangle.swap")
            }
            Divider()
            Button { TeamStubActions.performGated(.teamCustomDashboard, actionName: "Tilpass dashboard") } label: {
                Label("Tilpass dashboard", systemImage: "slider.horizontal.3")
            }
            Button { TeamStubActions.performGated(.teamImportExcel, actionName: "Import fra Excel") } label: {
                Label("Importer fra Excel", systemImage: "tablecells")
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "plus")
                    .font(.system(size: 12, weight: .bold))
                if !isCompact {
                    Text("Ny")
                        .font(.system(size: 12, weight: .bold))
                        .lineLimit(1)
                        .fixedSize()
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, isCompact ? 12 : 14).padding(.vertical, 12)
            .background(
                LinearGradient(colors: [TBrand.purple, TBrand.purpleLight],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 11)
            )
            .shadow(color: TBrand.purple.opacity(0.35), radius: 6, y: 2)
        }
    }

    // MARK: KPI row

    private var kpiRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(TeamKPI.allCases) { k in
                    kpiCard(k, trend: k.trend.replacingOccurrences(of: "+", with: "↑ "))
                        .frame(width: 220)
                }
            }
        }
    }

    private func kpiCard(_ k: TeamKPI, trend: String) -> some View {
        // Demo PÅ → mockup-verdier m/ trend-pill. Demo AV → EKTE tall fra
        // TeamLiveStore (trend skjules — vi har ikke historikk-serie enda).
        let isDemo = DemoModeManager.isActiveNonisolated
        let hasData = !TeamData.members.isEmpty
        let value = isDemo ? k.bigValue : k.liveValue
        return Button { selectedKPI = k } label: {
            VStack(alignment: .leading, spacing: 7) {
                Text(k.rawValue)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(TBrand.textSecondary)
                    .lineLimit(1)
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(hasData ? value : "—")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if hasData && isDemo {
                        Text(trend)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(TBrand.green)
                            .monospacedDigit()
                    }
                }
                HStack {
                    Text(hasData ? (isDemo ? "vs. forrige periode" : "live fra teamet") : "Ingen data")
                        .font(.system(size: 10))
                        .foregroundStyle(TBrand.textTertiary)
                    Spacer()
                    if hasData && isDemo {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(k.tint)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(TBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(TBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
