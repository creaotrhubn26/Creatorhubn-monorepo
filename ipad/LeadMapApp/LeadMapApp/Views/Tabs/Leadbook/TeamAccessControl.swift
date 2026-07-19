// TeamAccessControl.swift — Tilgangsstyring for Leadgrid (2026-06-30)
//
// HØRER HJEMME i Team-fanen i prod-LeadMapApp som "Tilganger"-modal.
// Bygd i Leadbook-preview slik at vi kan se designet — porteres som del av Pakke #602.
//
// Modell:
//   4 roller (Salgssjef / Teamleder / Selger / Spectator) m/ standard permission-sett
//   15+ features (Leadbook + Pondus + Eksempler + Kart + Leads + Møter + Team + Analytics + etc.)
//   Hver permission = .none / .read / .write / .admin
//   Per-medlem override (kan løfte/begrense ut over rolle-default)

import SwiftUI

// MARK: - Modeller

enum LeadgridRole: String, CaseIterable, Identifiable, Hashable {
    case salgssjef = "Salgssjef"
    case teamleder = "Teamleder"
    case selger = "Selger"
    case spectator = "Spectator"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .salgssjef: return "crown.fill"
        case .teamleder: return "person.badge.shield.checkmark.fill"
        case .selger: return "person.fill"
        case .spectator: return "eye.fill"
        }
    }
    var tint: Color {
        switch self {
        case .salgssjef: return LBrand.yellow
        case .teamleder: return LBrand.purpleLight
        case .selger: return LBrand.green
        case .spectator: return LBrand.blue
        }
    }
    var description: String {
        switch self {
        case .salgssjef: return "Full kontroll. Kan endre tilganger, godkjenne maler og se all data."
        case .teamleder: return "Leder eget team. Kan se og redigere alt teamet jobber med."
        case .selger: return "Standard selger. Eier egne leads og kan bruke maler."
        case .spectator: return "Skrivebeskyttet. Brukes for nye ansatte og eksterne observatører."
        }
    }
}

enum LeadgridFeature: String, CaseIterable, Identifiable, Hashable {
    // Kjerne
    case oversikt = "Oversikt"
    case kart = "Kart"
    case leads = "Leads"
    case oppfolging = "Oppfølging"
    case moter = "Møter"
    case ruter = "Ruter"
    // Analyse + team
    case analyse = "Analyse"
    case team = "Team"
    case salgsledelse = "Salgsledelse"
    // Leadbook
    case leadbookOversikt = "Leadbook · Oversikt"
    case leadbookMaler = "Leadbook · Maler"
    case leadbookPondus = "Leadbook · Pondus"
    case leadbookEksempler = "Leadbook · Eksempler"
    case leadbookInnsikt = "Leadbook · Innsikt"
    // Admin
    case varsler = "Varsler"
    case tilganger = "Tilganger"
    case integrasjoner = "Integrasjoner"
    case fakturering = "Fakturering"
    // Rapport & eksport (Pakke 10.1 — Daniel-feedback 2026-07-01)
    case teamExportCSV = "Eksport · CSV"
    case teamExportPDF = "Eksport · PDF"
    case teamImportExcel = "Import · Excel"
    case teamShareReport = "Del rapport (Slack/e-post)"
    case teamMarkAllRead = "Marker som lest (bulk)"
    case teamCustomDashboard = "Tilpass dashboard"
    // Analyse & AI (Pakke 10.1)
    case teamCompareToPrevious = "Sammenlign m/ forrige periode"
    case teamForecast30d = "Forecast neste 30 dager"
    case teamPipelineHealth = "Pipeline-helse-rapport"
    case teamAIFormulaSuggest = "AI-foreslå KPI-formel"
    // Rute-adherence + MeMapPin tap-actions (2026-07-02)
    case routeTracking = "Live posisjons-tracking"
    case routeAdherenceReports = "Rute-status-rapporter"
    case teamNearbyView = "Team i nærheten"
    case createLeadAtPosition = "Opprett lead på kart-posisjon"
    // Leadgrid Go — tilleggstjeneste (elektronisk kjørebok + fleet). Gate GRUPPEN.
    case leadgridGoKjorebok = "Leadgrid Go · Kjørebok"
    case leadgridGoAuto = "Leadgrid Go · Auto-registrering"
    case leadgridGoDashboard = "Leadgrid Go · Team-dashbord"
    // Kvalitet-avdelingen — tilleggstjeneste (salgsverifisering). Gate GRUPPEN.
    case leadgridKvalitet = "Kvalitet · Salgsverifisering"
    // Tettsted-tildeling (2026-07-17) — SSB tettbygde strøk under kommunenivå;
    // teamleder fordeler tettsteder til selgere i «Tildel område».
    case omradeTildeling = "Områder · Tettsted-tildeling"
    // AI-strukturering av eksempler (2026-07-17) — Claude-kall er kostnads-
    // bærende → egen nøkkel, styrbar per plan uavhengig av Eksempler-fanen.
    case leadbookAIStrukturering = "Leadbook · AI-strukturering"
    // Utstyrsregister (2026-07-17) — org-eid utstyr utlevert til medlemmer
    // (nettbrett/telefon/laptop/klær/ID-kort) m/ hendelseslogg.
    case utstyrsregister = "Utstyr · Organisasjonsutstyr"
    // Dørsalg-modus (2026-07-18) — husstandsadresser som egen kartflate for
    // org-er som hovedsakelig driver dørsalg. DEFAULT AV (isExplicitlyEnabled-
    // mønsteret): B2B-org-er ser aldri modusen; blandes aldri med bedrifts-CRM.
    case dorsalgModus = "Dørsalg · Husstandsmodus"
    // Adressesøk på kartet i dørsalg-modus. DEFAULT AV (Daniel 2026-07-18:
    // selgerne ser adressen ved å tappe pinnen) — superadmin aktiverer for
    // org-er som trenger å hoppe rett til en adresse.
    case dorsalgAdresseSok = "Dørsalg · Adressesøk"

    var id: String { rawValue }

    /// Stabil API-nøkkel (Swift-casenavnet, f.eks. «leadbookMaler») —
    /// rawValue er norsk display-tekst og egner seg ikke som DB-nøkkel.
    var key: String { String(describing: self) }

    static func fromKey(_ key: String) -> LeadgridFeature? {
        allCases.first { String(describing: $0) == key }
    }

    var icon: String {
        switch self {
        case .oversikt: return "house.fill"
        case .kart: return "map.fill"
        case .leads: return "person.text.rectangle.fill"
        case .oppfolging: return "calendar.badge.clock"
        case .moter: return "video.fill"
        case .ruter: return "arrow.triangle.swap"
        case .analyse: return "chart.bar.fill"
        case .team: return "person.3.fill"
        case .salgsledelse: return "trophy.fill"
        case .leadbookOversikt: return "book.fill"
        case .leadbookMaler: return "doc.on.doc.fill"
        case .leadbookPondus: return "circle.hexagongrid.fill"
        case .leadbookEksempler: return "books.vertical.fill"
        case .leadbookInnsikt: return "chart.line.uptrend.xyaxis"
        case .varsler: return "bell.fill"
        case .tilganger: return "lock.shield.fill"
        case .integrasjoner: return "puzzlepiece.fill"
        case .fakturering: return "creditcard.fill"
        // Rapport & eksport
        case .teamExportCSV: return "tablecells"
        case .teamExportPDF: return "doc.richtext.fill"
        case .teamImportExcel: return "square.and.arrow.down.on.square.fill"
        case .teamShareReport: return "paperplane.fill"
        case .teamMarkAllRead: return "checkmark.circle.fill"
        case .teamCustomDashboard: return "slider.horizontal.3"
        // Analyse & AI
        case .teamCompareToPrevious: return "chart.bar.xaxis"
        case .teamForecast30d: return "chart.line.uptrend.xyaxis.circle.fill"
        case .teamPipelineHealth: return "heart.text.square.fill"
        case .teamAIFormulaSuggest: return "sparkles"
        // Rute-adherence
        case .routeTracking: return "location.viewfinder"
        case .routeAdherenceReports: return "chart.line.uptrend.xyaxis"
        case .teamNearbyView: return "person.3.sequence.fill"
        case .createLeadAtPosition: return "mappin.and.ellipse"
        // Leadgrid Go
        case .leadgridGoKjorebok: return "book.closed.fill"
        case .leadgridGoAuto: return "car.fill"
        case .leadgridGoDashboard: return "chart.bar.doc.horizontal.fill"
        // Kvalitet
        case .leadgridKvalitet: return "checkmark.seal.fill"
        // Områder
        case .omradeTildeling: return "map.circle.fill"
        // AI
        case .leadbookAIStrukturering: return "sparkles"
        // Utstyr
        case .utstyrsregister: return "shippingbox.fill"
        // Dørsalg
        case .dorsalgModus: return "door.left.hand.open"
        case .dorsalgAdresseSok: return "magnifyingglass"
        }
    }

    var group: Group {
        switch self {
        case .oversikt, .kart, .leads, .oppfolging, .moter, .ruter,
             .dorsalgModus, .dorsalgAdresseSok: return .kjerne
        case .analyse, .team, .salgsledelse, .omradeTildeling,
             .utstyrsregister: return .analyseTeam
        case .leadbookOversikt, .leadbookMaler, .leadbookPondus, .leadbookEksempler,
             .leadbookInnsikt, .leadbookAIStrukturering: return .leadbook
        case .varsler, .tilganger, .integrasjoner, .fakturering: return .admin
        case .teamExportCSV, .teamExportPDF, .teamImportExcel, .teamShareReport,
             .teamMarkAllRead, .teamCustomDashboard: return .rapportExport
        case .teamCompareToPrevious, .teamForecast30d, .teamPipelineHealth,
             .teamAIFormulaSuggest: return .analyseAI
        case .routeTracking, .routeAdherenceReports, .teamNearbyView,
             .createLeadAtPosition: return .kjerne
        case .leadgridGoKjorebok, .leadgridGoAuto, .leadgridGoDashboard: return .leadgridGo
        case .leadgridKvalitet: return .kvalitet
        }
    }

    enum Group: String, CaseIterable, Identifiable, Hashable {
        case kjerne = "Kjerne"
        case analyseTeam = "Analyse & team"
        case leadbook = "Leadbook"
        case admin = "Admin & innstillinger"
        case rapportExport = "Rapport & eksport"
        case analyseAI = "Analyse & AI"
        case leadgridGo = "Leadgrid Go"
        case kvalitet = "Kvalitet"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .kjerne: return "square.grid.2x2.fill"
            case .analyseTeam: return "chart.pie.fill"
            case .leadbook: return "book.fill"
            case .admin: return "gearshape.fill"
            case .rapportExport: return "square.and.arrow.up.on.square.fill"
            case .analyseAI: return "sparkles"
            case .leadgridGo: return "car.circle.fill"
            case .kvalitet: return "checkmark.seal.fill"
            }
        }
        var tint: Color {
            switch self {
            case .kjerne: return LBrand.blue
            case .analyseTeam: return LBrand.green
            case .leadbook: return LBrand.purpleLight
            case .admin: return LBrand.orange
            case .rapportExport: return LBrand.yellow
            case .analyseAI: return LBrand.pink
            case .leadgridGo: return LBrand.green
            case .kvalitet: return Color.teal
            }
        }
    }
}

enum AccessLevel: String, CaseIterable, Identifiable, Hashable {
    case none = "Ingen"
    case read = "Lese"
    case write = "Redigere"
    case admin = "Admin"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .none: return "xmark.circle.fill"
        case .read: return "eye.fill"
        case .write: return "pencil"
        case .admin: return "key.fill"
        }
    }
    var color: Color {
        switch self {
        case .none: return LBrand.textTertiary
        case .read: return LBrand.blue
        case .write: return LBrand.green
        case .admin: return LBrand.orange
        }
    }
    var rank: Int {
        switch self { case .none: return 0; case .read: return 1; case .write: return 2; case .admin: return 3 }
    }
}

/// Default-matrise: rolle × feature → tilgangsnivå
enum RoleDefaults {
    static func access(_ role: LeadgridRole, _ feature: LeadgridFeature) -> AccessLevel {
        switch role {
        case .salgssjef:
            return .admin    // Full tilgang til alt
        case .teamleder:
            switch feature {
            case .fakturering, .integrasjoner: return .none
            case .tilganger: return .read
            case .leadbookEksempler, .leadbookInnsikt: return .read
            default: return .write
            }
        case .selger:
            switch feature {
            case .tilganger, .fakturering, .integrasjoner: return .none
            case .salgsledelse, .team: return .read
            case .leadbookMaler, .leadbookPondus: return .read
            case .leadbookOversikt, .leadbookEksempler, .leadbookInnsikt: return .read
            case .analyse: return .read
            default: return .write
            }
        case .spectator:
            switch feature {
            case .tilganger, .fakturering, .integrasjoner, .varsler: return .none
            default: return .read
            }
        }
    }
}

/// Et medlem av teamet med rolle + per-feature override
struct LBTeamMember: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let initials: String
    let avatarColor: Color
    let email: String
    let title: String
    var role: LeadgridRole
    var overrides: [LeadgridFeature: AccessLevel]   // tom = bruk rolle-default
    var active: Bool

    func effectiveAccess(_ feature: LeadgridFeature) -> AccessLevel {
        overrides[feature] ?? RoleDefaults.access(role, feature)
    }
    var hasOverrides: Bool { !overrides.isEmpty }
}

enum TeamAccessData {
    /// Demo → mock-team; ellers ekte medlemmer fra TeamLiveStore
    /// (`/sales-leadership/team-members`) med default-rolle Selger og ingen
    /// overrides (RBAC-backend mangler enda). Tom liste → tom-tilstand.
    @MainActor
    static var members: [LBTeamMember] {
        if DemoModeManager.isActiveNonisolated { return _members }
        return TeamLiveStore.shared.memberDTOs.map { dto in
            let initials = dto.name.split(separator: " ")
                .prefix(2).compactMap { $0.first }.map(String.init).joined()
            return LBTeamMember(
                name: dto.name,
                initials: initials.isEmpty ? "?" : initials,
                avatarColor: LBrand.purple,
                email: dto.email ?? "",
                title: dto.title ?? "Selger",
                role: .selger,
                overrides: [:],
                active: true
            )
        }
    }
    private static let _members: [LBTeamMember] = [
        LBTeamMember(name: "Lars Kristensen", initials: "LK", avatarColor: LBrand.purple,
                   email: "lars@leadgrid.no", title: "Salgssjef", role: .salgssjef, overrides: [:], active: true),
        LBTeamMember(name: "Marit Hansen", initials: "MH", avatarColor: LBrand.green,
                   email: "marit@leadgrid.no", title: "Teamleder Oslo", role: .teamleder,
                   overrides: [.fakturering: .read], active: true),
        LBTeamMember(name: "Maria Lindholm", initials: "ML", avatarColor: LBrand.purpleLight,
                   email: "maria@leadgrid.no", title: "Senior selger", role: .selger,
                   overrides: [.leadbookMaler: .write, .analyse: .write], active: true),
        LBTeamMember(name: "Espen Bråten", initials: "EB", avatarColor: LBrand.orange,
                   email: "espen@leadgrid.no", title: "Selger", role: .selger, overrides: [:], active: true),
        LBTeamMember(name: "Anders Solberg", initials: "AS", avatarColor: LBrand.blue,
                   email: "anders@leadgrid.no", title: "Selger", role: .selger, overrides: [:], active: true),
        LBTeamMember(name: "Kari Nilsen", initials: "KN", avatarColor: LBrand.pink,
                   email: "kari@leadgrid.no", title: "Junior selger", role: .selger,
                   overrides: [.leadbookPondus: .none], active: true),
        LBTeamMember(name: "Tom Eriksen", initials: "TE", avatarColor: LBrand.yellow,
                   email: "tom.eksternal@konsulent.no", title: "Ekstern konsulent", role: .spectator, overrides: [:], active: true),
        LBTeamMember(name: "Sofie Vik", initials: "SV", avatarColor: LBrand.red,
                   email: "sofie@leadgrid.no", title: "På opplæring", role: .spectator, overrides: [:], active: false)
    ]
}

// MARK: - TeamAccessControlView (hovedmodal)

struct TeamAccessControlView: View {
    @Environment(\.dismiss) private var dismiss
    // Fylles i .task (TeamAccessData.members er @MainActor pga TeamLiveStore).
    @State private var members: [LBTeamMember] = []
    @State private var mode: Mode = .roller
    @State private var search: String = ""
    @State private var roleFilter: LeadgridRole?
    @State private var editingRole: LeadgridRole?
    @State private var editingMember: LBTeamMember?
    @State private var showInvite = false
    @State private var toast: String?
    @State private var dirty = false

    enum Mode: String, CaseIterable, Identifiable {
        case roller = "Roller"
        case medlemmer = "Medlemmer"
        case katalog = "Funksjons-katalog"
        case revisjon = "Revisjonslogg"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .roller: return "person.3.sequence.fill"
            case .medlemmer: return "person.2.fill"
            case .katalog: return "shippingbox.fill"
            case .revisjon: return "clock.arrow.circlepath"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    summaryStrip
                    modePicker
                    Divider().overlay(LBrand.stroke)
                    Group {
                        switch mode {
                        case .roller: rolesView
                        case .medlemmer: membersView
                        case .katalog: FeatureCatalogView()
                        case .revisjon: auditView
                        }
                    }
                }
            }
            .task {
                if members.isEmpty { members = TeamAccessData.members }
            }
            .navigationTitle("Tilganger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    HStack(spacing: 8) {
                        if dirty {
                            Button {
                                members = TeamAccessData.members
                                dirty = false
                                flash("Endringer forkastet")
                            } label: {
                                Text("Forkast").font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(LBrand.textSecondary)
                            }.buttonStyle(.plain)
                        }
                        Button {
                            dirty = false
                            flash("Tilganger lagret · audit-logg oppdatert")
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "checkmark").font(.appScaled(size: 10, weight: .black))
                                Text("Lagre").font(.appScaled(size: 12, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                            .opacity(dirty ? 1 : 0.4)
                        }
                        .buttonStyle(.plain)
                        .disabled(!dirty)
                    }
                }
            }
            .sheet(item: $editingRole) { role in
                EditRolePermissionsSheet(role: role) { changed in
                    if changed { dirty = true; flash("Rolle «\(role.rawValue)» oppdatert") }
                }
            }
            .sheet(item: $editingMember) { m in
                EditMemberOverrideSheet(member: m) { updated in
                    if let idx = members.firstIndex(of: m) {
                        members[idx] = updated
                        dirty = true
                        flash("«\(updated.name)» oppdatert")
                    }
                }
            }
            .sheet(isPresented: $showInvite) { LBInviteMemberSheet { flash("Invitasjon sendt") } }
            .overlay(alignment: .top) {
                if let t = toast {
                    Label(t, systemImage: "checkmark.circle.fill")
                        .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(LBrand.green, in: Capsule())
                        .padding(.top, 6)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        }
        .macCatalystSheetSize(minWidth: 1000, minHeight: 760)
    }

    // MARK: Summary strip

    private var summaryStrip: some View {
        HStack(spacing: 12) {
            summaryTile(label: "MEDLEMMER", value: "\(members.count)", icon: "person.2.fill", tint: LBrand.purpleLight)
            summaryTile(label: "ROLLER", value: "\(LeadgridRole.allCases.count)", icon: "person.3.sequence.fill", tint: LBrand.blue)
            summaryTile(label: "OVERSTYRINGER", value: "\(members.filter { $0.hasOverrides }.count)", icon: "exclamationmark.triangle.fill", tint: LBrand.orange)
            summaryTile(label: "AKTIVE", value: "\(members.filter { $0.active }.count)", icon: "checkmark.seal.fill", tint: LBrand.green)
        }
        .padding(16)
    }

    private func summaryTile(label: String, value: String, icon: String, tint: Color) -> some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(tint.opacity(0.22))
                Image(systemName: icon).font(.appScaled(size: 14, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(value).font(.appScaled(size: 18, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white).monospacedDigit()
                Text(label).font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            }
            Spacer()
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Mode picker

    private var modePicker: some View {
        HStack(spacing: 4) {
            ForEach(Mode.allCases) { m in
                Button { withAnimation(.easeInOut(duration: 0.15)) { mode = m } } label: {
                    HStack(spacing: 6) {
                        Image(systemName: m.icon).font(.appScaled(size: 11, weight: .bold))
                        Text(m.rawValue).font(.appScaled(size: 12, weight: mode == m ? .bold : .semibold))
                    }
                    .foregroundStyle(mode == m ? .white : LBrand.textSecondary)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(mode == m ? LBrand.purple.opacity(0.22) : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
            }
            Spacer()
            if mode == .medlemmer {
                Button { showInvite = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "person.badge.plus").font(.appScaled(size: 11, weight: .bold))
                        Text("Inviter").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }.buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16).padding(.bottom, 10)
    }

    // MARK: Roller-view

    private var rolesView: some View {
        ScrollView {
            VStack(spacing: 12) {
                ForEach(LeadgridRole.allCases) { role in
                    roleCard(role)
                }
                Color.clear.frame(height: 16)
            }
            .padding(16)
        }
    }

    private func roleCard(_ role: LeadgridRole) -> some View {
        let memberCount = members.filter { $0.role == role }.count
        let writeCount = LeadgridFeature.allCases.filter { RoleDefaults.access(role, $0).rank >= AccessLevel.write.rank }.count
        let readCount = LeadgridFeature.allCases.filter { RoleDefaults.access(role, $0) == .read }.count
        return Button { editingRole = role } label: {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 14) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 13).fill(role.tint.opacity(0.20))
                        Image(systemName: role.icon).font(.appScaled(size: 22, weight: .bold))
                            .foregroundStyle(role.tint)
                    }
                    .frame(width: 52, height: 52)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(role.rawValue).font(.appScaled(size: 17, weight: .heavy)).foregroundStyle(.white)
                        Text(role.description).font(.appScaled(size: 12))
                            .foregroundStyle(LBrand.textSecondary).lineLimit(2)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                HStack(spacing: 8) {
                    statBadge("\(memberCount)", "MEDLEMMER", LBrand.purpleLight)
                    statBadge("\(writeCount)", "KAN REDIGERE", LBrand.green)
                    statBadge("\(readCount)", "KAN LESE", LBrand.blue)
                    statBadge("\(LeadgridFeature.allCases.count - writeCount - readCount)", "INGEN TILGANG", LBrand.textTertiary)
                }
                // Preview-grid med 12 features for å vise hva rollen får
                VStack(alignment: .leading, spacing: 6) {
                    Text("TILGANG (UTDRAG)")
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 2, iPad: 4, mac: 4, spacing: 6), spacing: 6) {
                        ForEach(Array(LeadgridFeature.allCases.prefix(12))) { f in
                            featurePreviewChip(f, level: RoleDefaults.access(role, f))
                        }
                    }
                }
            }
            .padding(14)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(role.tint.opacity(0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func statBadge(_ value: String, _ label: String, _ tint: Color) -> some View {
        VStack(spacing: 1) {
            Text(value).font(.appScaled(size: 16, weight: .heavy, design: .rounded))
                .foregroundStyle(tint).monospacedDigit()
            Text(label).font(.appScaled(size: 8, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6).lineLimit(1).minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 8)
        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    private func featurePreviewChip(_ f: LeadgridFeature, level: AccessLevel) -> some View {
        HStack(spacing: 4) {
            Image(systemName: f.icon).font(.appScaled(size: 8, weight: .bold))
                .foregroundStyle(level == .none ? LBrand.textTertiary : level.color)
            Text(f.rawValue).font(.appScaled(size: 9, weight: .semibold))
                .foregroundStyle(level == .none ? LBrand.textTertiary : .white)
                .lineLimit(1).minimumScaleFactor(0.7)
            Image(systemName: level.icon).font(.appScaled(size: 8, weight: .bold))
                .foregroundStyle(level.color)
        }
        .padding(.horizontal, 6).padding(.vertical, 5)
        .background(LBrand.cardHi.opacity(0.6), in: RoundedRectangle(cornerRadius: 6))
    }

    // MARK: Medlemmer-view

    private var filteredMembers: [LBTeamMember] {
        var list = members
        if let r = roleFilter { list = list.filter { $0.role == r } }
        if !search.isEmpty {
            let q = search.lowercased()
            list = list.filter {
                $0.name.lowercased().contains(q)
                || $0.email.lowercased().contains(q)
                || $0.title.lowercased().contains(q)
            }
        }
        return list
    }

    private var membersView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                searchBar
                roleFilterChips
                VStack(spacing: 8) {
                    ForEach(filteredMembers) { m in memberRow(m) }
                    if filteredMembers.isEmpty {
                        Text("Ingen medlemmer matcher")
                            .font(.appScaled(size: 13)).foregroundStyle(LBrand.textSecondary)
                            .frame(maxWidth: .infinity).padding(.vertical, 40)
                    }
                }
                Color.clear.frame(height: 16)
            }
            .padding(16)
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(LBrand.textTertiary)
            TextField("Søk navn, e-post eller tittel…", text: $search)
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
    }

    private var roleFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                roleChip(nil, label: "Alle roller", tint: LBrand.purpleLight)
                ForEach(LeadgridRole.allCases) { r in
                    roleChip(r, label: r.rawValue, tint: r.tint)
                }
            }
        }
    }

    private func roleChip(_ r: LeadgridRole?, label: String, tint: Color) -> some View {
        let active = roleFilter == r
        return Button { roleFilter = active ? nil : r } label: {
            HStack(spacing: 5) {
                if let r { Image(systemName: r.icon).font(.appScaled(size: 10, weight: .bold)) }
                Text(label).font(.appScaled(size: 11, weight: .semibold))
            }
            .foregroundStyle(active ? .white : LBrand.textSecondary)
            .padding(.horizontal, 11).padding(.vertical, 6)
            .background(active ? tint.opacity(0.28) : LBrand.cardHi, in: Capsule())
            .overlay(Capsule().stroke(active ? tint.opacity(0.55) : LBrand.stroke, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    private func memberRow(_ m: LBTeamMember) -> some View {
        Button { editingMember = m } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(m.avatarColor.opacity(0.25))
                    Text(m.initials)
                        .font(.appScaled(size: 13, weight: .black))
                        .foregroundStyle(m.avatarColor)
                    if !m.active {
                        Circle().fill(.black.opacity(0.5))
                        Image(systemName: "pause.fill").font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(m.name)
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        if m.hasOverrides {
                            Text("\(m.overrides.count) OVERSTYRINGER")
                                .font(.appScaled(size: 8, weight: .black))
                                .foregroundStyle(LBrand.orange)
                                .tracking(0.5)
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(LBrand.orange.opacity(0.15), in: Capsule())
                                .overlay(Capsule().stroke(LBrand.orange.opacity(0.35), lineWidth: 1))
                        }
                        if !m.active {
                            Text("INAKTIV")
                                .font(.appScaled(size: 8, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.5)
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(LBrand.cardHi, in: Capsule())
                        }
                    }
                    HStack(spacing: 6) {
                        Text(m.title).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text(m.email).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                    }
                }
                Spacer()
                HStack(spacing: 5) {
                    Image(systemName: m.role.icon).font(.appScaled(size: 11, weight: .bold))
                    Text(m.role.rawValue).font(.appScaled(size: 11, weight: .bold))
                }
                .foregroundStyle(m.role.tint)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(m.role.tint.opacity(0.16), in: Capsule())
                .overlay(Capsule().stroke(m.role.tint.opacity(0.4), lineWidth: 1))
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(LBrand.textTertiary)
            }
            .padding(12)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Revisjon

    private var auditView: some View {
        ScrollView {
            VStack(spacing: 8) {
                if auditEntries.isEmpty {
                    Text("Ingen revisjonshendelser enda")
                        .font(.appScaled(size: 13)).foregroundStyle(LBrand.textSecondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 40)
                }
                ForEach(auditEntries) { entry in auditRow(entry) }
            }
            .padding(16)
        }
    }

    private struct AuditEntry: Identifiable { let id = UUID(); let icon: String; let tint: Color; let title: String; let actor: String; let timeAgo: String }
    /// Mock-audit — KUN i demo-modus (audit-backend mangler enda).
    private var auditEntries: [AuditEntry] {
        DemoModeManager.isActiveNonisolated ? mockAuditEntries : []
    }
    private var mockAuditEntries: [AuditEntry] {[
        .init(icon: "person.badge.plus", tint: LBrand.green, title: "Inviterte Sofie Vik som Spectator", actor: "Lars Kristensen", timeAgo: "2 t siden"),
        .init(icon: "pencil", tint: LBrand.purpleLight, title: "Endret Maria Lindholms tilgang på Leadbook · Maler fra «Lese» → «Redigere»", actor: "Lars Kristensen", timeAgo: "i går 14:22"),
        .init(icon: "lock.shield.fill", tint: LBrand.orange, title: "Reduserte rolle «Teamleder»-tilgang på Fakturering fra «Lese» → «Ingen»", actor: "Lars Kristensen", timeAgo: "i går 09:14"),
        .init(icon: "person.fill.checkmark", tint: LBrand.blue, title: "Aktiverte Tom Eriksen (ekstern konsulent)", actor: "Marit Hansen", timeAgo: "27. juni"),
        .init(icon: "pause.circle.fill", tint: LBrand.textSecondary, title: "Satte Sofie Vik som inaktiv (på opplæring)", actor: "Lars Kristensen", timeAgo: "26. juni"),
        .init(icon: "doc.text.fill", tint: LBrand.purpleLight, title: "Eksporterte tilgangs-rapport som CSV", actor: "Lars Kristensen", timeAgo: "25. juni"),
        .init(icon: "key.fill", tint: LBrand.yellow, title: "Roterte API-nøkkel for Salesforce-integrasjon", actor: "System", timeAgo: "23. juni")
    ]}

    private func auditRow(_ e: AuditEntry) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(e.tint.opacity(0.22))
                Image(systemName: e.icon).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(e.tint)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 3) {
                Text(e.title).font(.appScaled(size: 13)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 6) {
                    Image(systemName: "person.fill").font(.appScaled(size: 9))
                    Text(e.actor).font(.appScaled(size: 10, weight: .semibold))
                    Text("·").foregroundStyle(LBrand.textTertiary)
                    Image(systemName: "clock").font(.appScaled(size: 9))
                    Text(e.timeAgo).font(.appScaled(size: 10))
                }
                .foregroundStyle(LBrand.textTertiary)
            }
            Spacer()
        }
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
    }

    // MARK: Helpers

    private func flash(_ msg: String) {
        toast = msg
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.7) { if toast == msg { toast = nil } }
    }
}

// MARK: - EditRolePermissionsSheet

struct EditRolePermissionsSheet: View {
    let role: LeadgridRole
    var onClose: (Bool) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var overrides: [LeadgridFeature: AccessLevel] = [:]   // ift. RoleDefaults

    private func current(_ f: LeadgridFeature) -> AccessLevel {
        overrides[f] ?? RoleDefaults.access(role, f)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        hero
                        ForEach(LeadgridFeature.Group.allCases) { g in
                            groupSection(g)
                        }
                        Color.clear.frame(height: 20)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Rediger \(role.rawValue)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { onClose(false); dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { onClose(!overrides.isEmpty); dismiss() } label: {
                        Text("Lagre").font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                    }
                }
            }
        }
    }

    private var hero: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 13).fill(role.tint.opacity(0.22))
                Image(systemName: role.icon).font(.appScaled(size: 22, weight: .bold)).foregroundStyle(role.tint)
            }
            .frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 3) {
                Text(role.rawValue).font(.appScaled(size: 18, weight: .heavy)).foregroundStyle(.white)
                Text(role.description).font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
        }
    }

    private func groupSection(_ g: LeadgridFeature.Group) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: g.icon).foregroundStyle(g.tint)
                Text(g.rawValue.uppercased())
                    .font(.appScaled(size: 10, weight: .black)).tracking(0.8)
                    .foregroundStyle(g.tint)
                Spacer()
            }
            VStack(spacing: 8) {
                ForEach(LeadgridFeature.allCases.filter { $0.group == g }) { f in
                    permissionRow(f)
                }
            }
        }
    }

    private func permissionRow(_ f: LeadgridFeature) -> some View {
        let level = current(f)
        return HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(LBrand.cardHi)
                Image(systemName: f.icon).font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(level == .none ? LBrand.textTertiary : level.color)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(f.rawValue).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                if overrides[f] != nil {
                    Text("OVERSTYRT FRA STANDARD")
                        .font(.appScaled(size: 8, weight: .black))
                        .foregroundStyle(LBrand.orange).tracking(0.6)
                }
            }
            Spacer()
            // Segmented level picker
            HStack(spacing: 3) {
                ForEach(AccessLevel.allCases) { lvl in
                    Button {
                        if RoleDefaults.access(role, f) == lvl { overrides.removeValue(forKey: f) }
                        else { overrides[f] = lvl }
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: lvl.icon).font(.appScaled(size: 9, weight: .bold))
                            Text(lvl.rawValue).font(.appScaled(size: 10, weight: .bold))
                        }
                        .foregroundStyle(level == lvl ? .white : LBrand.textSecondary)
                        .padding(.horizontal, 8).padding(.vertical, 5)
                        .background(level == lvl ? lvl.color.opacity(0.32) : .clear, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(3)
            .background(LBrand.cardHi, in: Capsule())
            .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
        }
        .padding(10)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
    }
}

// MARK: - EditMemberOverrideSheet

struct EditMemberOverrideSheet: View {
    let member: LBTeamMember
    var onSave: (LBTeamMember) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var draft: LBTeamMember
    @State private var search: String = ""

    init(member: LBTeamMember, onSave: @escaping (LBTeamMember) -> Void) {
        self.member = member
        self.onSave = onSave
        self._draft = State(initialValue: member)
    }

    private func current(_ f: LeadgridFeature) -> AccessLevel {
        draft.overrides[f] ?? RoleDefaults.access(draft.role, f)
    }
    private func isOverridden(_ f: LeadgridFeature) -> Bool { draft.overrides[f] != nil }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        hero
                        roleSection
                        activeSection
                        Divider().overlay(LBrand.stroke)
                        searchBar
                        ForEach(LeadgridFeature.Group.allCases) { g in
                            groupSection(g)
                        }
                        Color.clear.frame(height: 20)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Rediger tilgang")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { onSave(draft); dismiss() } label: {
                        Text("Lagre").font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                    }
                }
            }
        }
    }

    private var hero: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(member.avatarColor.opacity(0.25))
                Text(member.initials)
                    .font(.appScaled(size: 17, weight: .black))
                    .foregroundStyle(member.avatarColor)
            }
            .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 3) {
                Text(member.name).font(.appScaled(size: 18, weight: .heavy)).foregroundStyle(.white)
                Text("\(member.title) · \(member.email)")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                if draft.hasOverrides {
                    Text("\(draft.overrides.count) personlige overstyringer")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(LBrand.orange)
                }
            }
            Spacer()
        }
    }

    private var roleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ROLLE").font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 1, iPad: 2, mac: 3, spacing: 8), spacing: 8) {
                ForEach(LeadgridRole.allCases) { r in
                    Button { draft.role = r } label: {
                        HStack(spacing: 9) {
                            Image(systemName: r.icon).font(.appScaled(size: 13, weight: .bold))
                                .foregroundStyle(draft.role == r ? r.tint : LBrand.textSecondary)
                                .frame(width: 18)
                            Text(r.rawValue)
                                .font(.appScaled(size: 13, weight: .semibold))
                                .foregroundStyle(draft.role == r ? .white : LBrand.textSecondary)
                            Spacer()
                            Image(systemName: draft.role == r ? "largecircle.fill.circle" : "circle")
                                .font(.appScaled(size: 14))
                                .foregroundStyle(draft.role == r ? r.tint : LBrand.textTertiary)
                        }
                        .padding(12)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(draft.role == r ? r.tint.opacity(0.45) : LBrand.stroke, lineWidth: 1))
                    }.buttonStyle(.plain)
                }
            }
        }
    }

    private var activeSection: some View {
        Toggle(isOn: $draft.active) {
            HStack(spacing: 8) {
                Image(systemName: draft.active ? "checkmark.seal.fill" : "pause.circle.fill")
                    .foregroundStyle(draft.active ? LBrand.green : LBrand.textSecondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(draft.active ? "Aktiv konto" : "Inaktiv konto")
                        .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                    Text(draft.active ? "Brukeren kan logge inn og bruke Leadgrid" : "Innlogging blokkert — beholder all data")
                        .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
            }
        }
        .tint(LBrand.green)
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(LBrand.textTertiary)
            TextField("Søk funksjon…", text: $search)
                .foregroundStyle(.white).textFieldStyle(.plain)
            if !search.isEmpty {
                Button { search = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(LBrand.textTertiary)
                }.buttonStyle(.plain)
            }
            Button {
                draft.overrides.removeAll()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.uturn.backward").font(.appScaled(size: 10, weight: .bold))
                    Text("Reset alt").font(.appScaled(size: 11, weight: .semibold))
                }
                .foregroundStyle(draft.hasOverrides ? LBrand.orange : LBrand.textTertiary)
            }
            .buttonStyle(.plain)
            .disabled(!draft.hasOverrides)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func groupSection(_ g: LeadgridFeature.Group) -> some View {
        let filtered = LeadgridFeature.allCases
            .filter { $0.group == g }
            .filter { search.isEmpty || $0.rawValue.localizedCaseInsensitiveContains(search) }
        return Group {
            if !filtered.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        Image(systemName: g.icon).foregroundStyle(g.tint)
                        Text(g.rawValue.uppercased())
                            .font(.appScaled(size: 10, weight: .black)).tracking(0.8)
                            .foregroundStyle(g.tint)
                        Spacer()
                    }
                    VStack(spacing: 6) {
                        ForEach(filtered) { f in permissionRow(f) }
                    }
                }
            }
        }
    }

    private func permissionRow(_ f: LeadgridFeature) -> some View {
        let level = current(f)
        let overridden = isOverridden(f)
        return HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(LBrand.cardHi)
                Image(systemName: f.icon).font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(level == .none ? LBrand.textTertiary : level.color)
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 1) {
                Text(f.rawValue).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                HStack(spacing: 4) {
                    if overridden {
                        Text("OVERSTYRT")
                            .font(.appScaled(size: 8, weight: .black))
                            .foregroundStyle(LBrand.orange).tracking(0.5)
                    } else {
                        Text("Følger \(draft.role.rawValue)")
                            .font(.appScaled(size: 9))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                    Text("→ \(level.rawValue)")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(level.color)
                }
            }
            Spacer()
            if overridden {
                Button { draft.overrides.removeValue(forKey: f) } label: {
                    Image(systemName: "arrow.uturn.backward.circle.fill")
                        .font(.appScaled(size: 14))
                        .foregroundStyle(LBrand.orange)
                }.buttonStyle(.plain)
            }
            HStack(spacing: 2) {
                ForEach(AccessLevel.allCases) { lvl in
                    Button {
                        if RoleDefaults.access(draft.role, f) == lvl { draft.overrides.removeValue(forKey: f) }
                        else { draft.overrides[f] = lvl }
                    } label: {
                        Image(systemName: lvl.icon)
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(level == lvl ? .white : lvl.color.opacity(0.6))
                            .frame(width: 26, height: 26)
                            .background(level == lvl ? lvl.color.opacity(0.32) : .clear, in: Circle())
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

// MARK: - LBInviteMemberSheet

struct LBInviteMemberSheet: View {
    var onInvite: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var email: String = ""
    @State private var role: LeadgridRole = .selger
    @State private var sendWelcome = true

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("NAVN").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            TextField("Fullt navn", text: $name)
                                .foregroundStyle(.white).textFieldStyle(.plain)
                                .padding(12)
                                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text("E-POST").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            TextField("ola@firma.no", text: $email)
                                .foregroundStyle(.white).textFieldStyle(.plain)
                                .padding(12)
                                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text("ROLLE").font(.appScaled(size: 10, weight: .black))
                                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                            ForEach(LeadgridRole.allCases) { r in
                                Button { role = r } label: {
                                    HStack(spacing: 12) {
                                        Image(systemName: r.icon).font(.appScaled(size: 14, weight: .bold))
                                            .foregroundStyle(role == r ? r.tint : LBrand.textSecondary)
                                            .frame(width: 24)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(r.rawValue).font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
                                            Text(r.description).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                                                .lineLimit(2)
                                        }
                                        Spacer()
                                        Image(systemName: role == r ? "largecircle.fill.circle" : "circle")
                                            .font(.appScaled(size: 18)).foregroundStyle(role == r ? r.tint : LBrand.textTertiary)
                                    }
                                    .padding(12)
                                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(role == r ? r.tint.opacity(0.45) : LBrand.stroke, lineWidth: 1))
                                }.buttonStyle(.plain)
                            }
                        }
                        Toggle("Send velkomst-e-post med onboarding-guide", isOn: $sendWelcome)
                            .tint(LBrand.purpleLight)
                            .foregroundStyle(.white)
                            .padding(14)
                            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Inviter medlem")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        onInvite()
                        dismiss()
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "paperplane.fill").font(.appScaled(size: 11))
                            Text("Send invitasjon").font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .opacity(name.isEmpty || email.isEmpty ? 0.5 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(name.isEmpty || email.isEmpty)
                }
            }
        }
    }
}

// MARK: - FeatureCatalogView — demonstrasjon av server-driven funksjons-registrering

struct FeatureCatalogView: View {
    @State private var lastSync: String = "30. juni 14:22"
    @State private var manifestVersion: String = "v0.5.0-rev42"
    @State private var checkingForUpdates = false
    @State private var newFeatures: [DiscoveredFeature] = sampleDiscovered
    @State private var expandedSource: Bool = false
    @State private var toast: String?

    /// Mock-oppdagede funksjoner — KUN i demo-modus (manifest-scan mangler).
    static var sampleDiscovered: [DiscoveredFeature] {
        DemoModeManager.isActiveNonisolated ? _sampleDiscovered : []
    }
    private static let _sampleDiscovered: [DiscoveredFeature] = [
        DiscoveredFeature(
            key: "leadbook.pondus.akademi",
            name: "Pondus Akademi",
            group: "Leadbook",
            introducedIn: "v0.5.0-rev41",
            proposedDefaults: [
                .salgssjef: .admin, .teamleder: .write, .selger: .read, .spectator: .read
            ],
            reason: "Read-by-default for alle (lærings-innhold), kun salgssjef kan publisere nye kapitler."
        ),
        DiscoveredFeature(
            key: "team.tilganger.audit_export",
            name: "Eksporter audit-logg",
            group: "Admin & innstillinger",
            introducedIn: "v0.5.0-rev42",
            proposedDefaults: [
                .salgssjef: .admin, .teamleder: .none, .selger: .none, .spectator: .none
            ],
            reason: "Admin-only basert på feature-group «Admin & innstillinger»."
        ),
        DiscoveredFeature(
            key: "leadbook.eksempler.pencil_annotation",
            name: "Pencil-annotering på Eksempler",
            group: "Leadbook",
            introducedIn: "v0.5.0-rev42",
            proposedDefaults: [
                .salgssjef: .admin, .teamleder: .write, .selger: .write, .spectator: .read
            ],
            reason: "Write-default fordi alle bør kunne tegne egne notater på case-studier."
        )
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                syncBanner
                if !newFeatures.isEmpty { newFeaturesSection }
                manifestSourceCard
                architectureDiagram
                featureRegistryCard
                Color.clear.frame(height: 16)
            }
            .padding(16)
        }
        .overlay(alignment: .top) {
            if let t = toast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(LBrand.green, in: Capsule())
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
    }

    // MARK: Sync banner

    private var syncBanner: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LBrand.green.opacity(0.22))
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(LBrand.green)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text("Funksjons-katalog er synkronisert")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(manifestVersion)
                        .font(.appScaled(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(LBrand.green)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(LBrand.green.opacity(0.15), in: Capsule())
                }
                Text("Sist synkronisert: \(lastSync) · \(LeadgridFeature.allCases.count) funksjoner registrert · \(newFeatures.count) nye siden sist")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
            Button {
                checkingForUpdates = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.3) {
                    checkingForUpdates = false
                    lastSync = "nå nettopp"
                    flashToast("Katalog oppdatert · ingen nye funksjoner")
                }
            } label: {
                HStack(spacing: 5) {
                    if checkingForUpdates { ProgressView().tint(.white).scaleEffect(0.7) }
                    else { Image(systemName: "arrow.clockwise").font(.appScaled(size: 11, weight: .bold)) }
                    Text(checkingForUpdates ? "Sjekker…" : "Sjekk for nye")
                        .font(.appScaled(size: 11, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(
                    LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Capsule()
                )
            }
            .buttonStyle(.plain)
            .disabled(checkingForUpdates)
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.green.opacity(0.3), lineWidth: 1))
    }

    // MARK: New features section (intelligent defaults)

    private var newFeaturesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "sparkles.rectangle.stack.fill")
                    .foregroundStyle(LBrand.purpleLight)
                Text("\(newFeatures.count) NYE FUNKSJONER OPPDAGET")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.purpleLight).tracking(0.8)
                Spacer()
                Button {
                    let approvedCount = newFeatures.count
                    newFeatures.removeAll()
                    flashToast("\(approvedCount) funksjoner aktivert med foreslåtte tilganger")
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark.circle.fill").font(.appScaled(size: 11, weight: .bold))
                        Text("Godkjenn alle").font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 5)
                    .background(LBrand.green, in: Capsule())
                }.buttonStyle(.plain)
            }
            Text("AI har analysert hver funksjon og foreslår standard-tilganger basert på dens feature-group og historiske mønstre. Godkjenn enkeltvis eller alle — du kan alltid endre senere.")
                .font(.appScaled(size: 12))
                .foregroundStyle(LBrand.textSecondary)
                .lineLimit(3)
            ForEach(newFeatures) { f in discoveredRow(f) }
        }
        .padding(14)
        .background(LBrand.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.purple.opacity(0.3), lineWidth: 1))
    }

    private func discoveredRow(_ f: DiscoveredFeature) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.purpleLight)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(f.name).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        Text("NY").font(.appScaled(size: 8, weight: .black))
                            .foregroundStyle(.white).tracking(0.5)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(LBrand.purpleLight, in: Capsule())
                    }
                    HStack(spacing: 6) {
                        Text(f.key).font(.appScaled(size: 10, design: .monospaced))
                            .foregroundStyle(LBrand.textTertiary)
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text(f.introducedIn).font(.appScaled(size: 10, design: .monospaced))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                }
                Spacer()
            }
            // Foreslåtte tilganger
            HStack(spacing: 6) {
                ForEach(LeadgridRole.allCases) { r in
                    let lvl = f.proposedDefaults[r] ?? .none
                    HStack(spacing: 4) {
                        Image(systemName: r.icon).font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(r.tint)
                        Text(r.rawValue)
                            .font(.appScaled(size: 9, weight: .semibold))
                            .foregroundStyle(.white)
                        Image(systemName: lvl.icon).font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(lvl.color)
                    }
                    .padding(.horizontal, 7).padding(.vertical, 4)
                    .background(LBrand.cardHi, in: Capsule())
                    .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
                }
            }
            HStack(spacing: 6) {
                Image(systemName: "lightbulb.fill").font(.appScaled(size: 10))
                    .foregroundStyle(LBrand.yellow)
                Text(f.reason)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
                Spacer()
            }
            HStack(spacing: 8) {
                Spacer()
                Button {
                    newFeatures.removeAll { $0.id == f.id }
                    flashToast("«\(f.name)» avvist — krever manuell konfigurasjon")
                } label: {
                    Text("Avvis & konfigurer manuelt")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.textSecondary)
                        .padding(.horizontal, 11).padding(.vertical, 6)
                        .background(LBrand.cardHi, in: Capsule())
                        .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)
                Button {
                    newFeatures.removeAll { $0.id == f.id }
                    flashToast("«\(f.name)» aktivert med foreslåtte tilganger")
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark").font(.appScaled(size: 10, weight: .black))
                        Text("Godta forslag").font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 6)
                    .background(LBrand.green, in: Capsule())
                }.buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.purple.opacity(0.25), lineWidth: 1))
    }

    // MARK: Manifest source

    private var manifestSourceCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { expandedSource.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "shippingbox.fill").foregroundStyle(LBrand.blue)
                    Text("KILDE OG SYNK").font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Spacer()
                    Image(systemName: expandedSource ? "chevron.up" : "chevron.down")
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(LBrand.textTertiary)
                }
            }.buttonStyle(.plain)
            if expandedSource {
                VStack(alignment: .leading, spacing: 8) {
                    sourceRow(icon: "link.icloud.fill", label: "Manifest-endepunkt",
                              value: "GET /api/leadgrid/features/manifest", tint: LBrand.blue)
                    sourceRow(icon: "key.fill", label: "Auth", value: "iPad device-token (auto-renew)", tint: LBrand.yellow)
                    sourceRow(icon: "tablecells.fill", label: "Server-tabell",
                              value: "leadgrid_features (39 felter, full historikk)", tint: LBrand.purpleLight)
                    sourceRow(icon: "clock.arrow.circlepath", label: "Cron-sjekk",
                              value: "Hver 6. time + ved hver app-launch", tint: LBrand.green)
                    sourceRow(icon: "icloud.and.arrow.down.fill", label: "Lokal cache",
                              value: "UserDefaults + Core Data (offline-fallback)", tint: LBrand.orange)
                    sourceRow(icon: "envelope.badge.fill", label: "Admin-notifikasjon",
                              value: "Push + in-app badge når nye funksjoner oppdages", tint: LBrand.pink)
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func sourceRow(icon: String, label: String, value: String, tint: Color) -> some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 7).fill(tint.opacity(0.22))
                Image(systemName: icon).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 28, height: 28)
            Text(label).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 150, alignment: .leading)
            Text(value).font(.appScaled(size: 11, design: .monospaced))
                .foregroundStyle(LBrand.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: Architecture diagram

    private var architectureDiagram: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "arrow.triangle.merge").foregroundStyle(LBrand.purpleLight)
                Text("HVORDAN KATALOGEN OPPDATERES")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Spacer()
            }
            VStack(spacing: 0) {
                pipelineStep(num: 1, icon: "swift", title: "Utvikler bygger ny funksjon",
                             desc: "@LeadgridFeature(key: \"leadbook.pondus.akademi\", group: .leadbook) på SwiftUI-view",
                             tint: LBrand.orange)
                pipelineConnector
                pipelineStep(num: 2, icon: "hammer.fill", title: "Build-script ekstraherer",
                             desc: "Kjører ved hver CI-build: scanner kodebasen, lager features.json + DB-migrasjon",
                             tint: LBrand.blue)
                pipelineConnector
                pipelineStep(num: 3, icon: "cylinder.split.1x2.fill", title: "Postgres-tabell oppdateres",
                             desc: "INSERT INTO leadgrid_features ON CONFLICT (feature_key) DO UPDATE — idempotent",
                             tint: LBrand.purpleLight)
                pipelineConnector
                pipelineStep(num: 4, icon: "antenna.radiowaves.left.and.right", title: "Backend serverer manifest",
                             desc: "GET /features/manifest svarer m/ ETag — klienter får 304 hvis ingen endring",
                             tint: LBrand.green)
                pipelineConnector
                pipelineStep(num: 5, icon: "iphone", title: "Klient differ + foreslår defaults",
                             desc: "AI matcher feature-group til historiske permission-mønstre per rolle",
                             tint: LBrand.pink)
                pipelineConnector
                pipelineStep(num: 6, icon: "bell.badge.fill", title: "Admin får varsel",
                             desc: "Push: «3 nye funksjoner trenger tilgangskonfigurasjon» — godkjenn på 1 trykk",
                             tint: LBrand.red, isLast: true)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func pipelineStep(num: Int, icon: String, title: String, desc: String, tint: Color, isLast: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                ZStack {
                    Circle().fill(tint.opacity(0.22))
                    Text("\(num)").font(.appScaled(size: 11, weight: .black, design: .rounded)).foregroundStyle(tint)
                }
                .frame(width: 28, height: 28)
            }
            HStack(spacing: 10) {
                Image(systemName: icon).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(tint)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                    Text(desc).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
            }
            .padding(10)
            .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private var pipelineConnector: some View {
        HStack {
            VStack(spacing: 2) {
                Image(systemName: "arrow.down")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
            }
            .frame(width: 28)
            Spacer()
        }
        .padding(.vertical, 2)
    }

    // MARK: Feature registry (alle registrerte)

    private var featureRegistryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "list.bullet.rectangle.fill").foregroundStyle(LBrand.purpleLight)
                Text("REGISTRERTE FUNKSJONER")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Spacer()
                Text("\(LeadgridFeature.allCases.count) totalt")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(LBrand.textTertiary)
            }
            ForEach(LeadgridFeature.Group.allCases) { g in
                let features = LeadgridFeature.allCases.filter { $0.group == g }
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Image(systemName: g.icon).font(.appScaled(size: 10, weight: .bold)).foregroundStyle(g.tint)
                        Text(g.rawValue).font(.appScaled(size: 11, weight: .black)).foregroundStyle(g.tint).tracking(0.5)
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text("\(features.count)").font(.appScaled(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(LBrand.textTertiary)
                        Spacer()
                    }
                    FlowLayoutFallback(spacing: 5) {
                        ForEach(features) { f in
                            HStack(spacing: 4) {
                                Image(systemName: f.icon).font(.appScaled(size: 9, weight: .bold))
                                Text(f.rawValue).font(.appScaled(size: 10, weight: .semibold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 7).padding(.vertical, 4)
                            .background(LBrand.cardHi, in: Capsule())
                            .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
                        }
                    }
                }
                .padding(10)
                .background(g.tint.opacity(0.06), in: RoundedRectangle(cornerRadius: 9))
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func flashToast(_ msg: String) {
        toast = msg
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.7) { if toast == msg { toast = nil } }
    }
}

struct DiscoveredFeature: Identifiable, Hashable {
    let id = UUID()
    let key: String
    let name: String
    let group: String
    let introducedIn: String
    let proposedDefaults: [LeadgridRole: AccessLevel]
    let reason: String
}

// Enkel flow-layout som fungerer på iOS 16+ (fallback siden FlowLayout var iOS 16+)
struct FlowLayoutFallback<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder var content: () -> Content

    var body: some View {
        // Bruker HStack-rader m/ wrap via GeometryReader er for komplekst — vi bruker LazyVGrid m/ adaptive
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: spacing)], alignment: .leading, spacing: spacing) {
            content()
        }
    }
}
