// LeadsView.swift
//
// Pixel-perfect Leads-fane matchende mockup (2026-06-29):
//
//   ┌────────────────────────────────────────────────────┬──────────┐
//   │  Leads-tittel  [Dette kvartalet][Importer][+ Nytt] │ Lead     │
//   │  ┌─KPI─┬─KPI─┬─KPI─┬─KPI─┬─KPI─┐                  │ detail   │
//   │  │1248 │842  │542  │236  │68   │                  │ sidebar  │
//   │  └─────┴─────┴─────┴─────┴─────┘                  │          │
//   │  [Søk] [Områder ▾] [Status ▾] [Score ▾]...       │ + tabs   │
//   │  TABELL: 10 lead-rader (logo+navn / kontakt /     │ + pipe   │
//   │   score / status / eier / dato / verdi / ⋯)        │ + neste  │
//   │  «Viser 1-10 av 1 248»  [1][2][3]…[125]            │ + actions│
//   └────────────────────────────────────────────────────┴──────────┘

import SwiftUI

private enum LdBrand {
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

// MARK: - Models

struct LeadRow: Identifiable, Hashable {
    /// Mock-rader får tilfeldig UUID (statisk liste → stabil per kjøring).
    /// Backend-rader får uuid-en fra crm_customers slik at seleksjon
    /// overlever re-mapping av `sourceLeads`.
    var id = UUID()
    let company: String
    let category: String
    let contactName: String
    let contactRole: String
    let leadScore: Int
    let status: LeadStatus
    let ownerName: String
    let ownerInitials: String
    let ownerColor: Color
    let nextFollowUp: String?
    let nextFollowUpOverdue: Bool
    let valueNok: Int
    let companyColor: Color

    // Backend-binding (uke 2): ekte felter fra LeadModel når demo er AV.
    // Nil i mock-radene — FollowUpDetailSheet/sidebaren faller da tilbake
    // til demo-tekstene sine.
    var backendId: String? = nil
    var email: String? = nil
    var phone: String? = nil
    var notes: String? = nil
    var nextAction: String? = nil
    var lastVisitAt: Date? = nil
    var nextFollowUpAt: Date? = nil

    /// Telefon/e-post m/ demo-fallback: mock-rader (backendId == nil) viser
    /// demo-kontakten; ekte leads uten data gir nil → knappen skjules i
    /// stedet for å ringe/maile et fiktivt nummer.
    var displayPhone: String? { phone ?? (backendId == nil ? "+47 900 12 345" : nil) }
    var displayEmail: String? { email ?? (backendId == nil ? "jonas.eide@nordicelektro.no" : nil) }

    enum LeadStatus: String, Hashable, CaseIterable {
        case hot, warm, interested, contacted, newLead, notContacted
        var label: String {
            switch self {
            case .hot:          return "Hot lead"
            case .warm:         return "Varm lead"
            case .interested:   return "Interessert"
            case .contacted:    return "Kontaktet"
            case .newLead:      return "Ny lead"
            case .notContacted: return "Ikke kontaktet"
            }
        }
        var color: Color {
            switch self {
            case .hot:          return LdBrand.red
            case .warm:         return LdBrand.orange
            case .interested:   return LdBrand.blue
            case .contacted:    return LdBrand.blue
            case .newLead:      return LdBrand.green
            case .notContacted: return LdBrand.textSecondary
            }
        }
        var icon: String {
            switch self {
            case .hot:          return "flame.fill"
            case .warm:         return "flame"
            case .interested:   return "hand.thumbsup.fill"
            case .contacted:    return "phone.fill"
            case .newLead:      return "sparkles"
            case .notContacted: return "circle.dashed"
            }
        }
    }
}

// MARK: - LeadModel → LeadRow (backend-binding, uke 2)

extension LeadRow {
    /// Stabil farge-palett for eiere/selskaper — samme navn gir samme farge.
    private static let palette: [Color] = [
        LdBrand.purple, LdBrand.green, LdBrand.blue,
        LdBrand.orange, LdBrand.purpleLight, LdBrand.red,
    ]

    private static func stableColor(for key: String) -> Color {
        var hash = 5381
        for b in key.utf8 { hash = ((hash << 5) &+ hash) &+ Int(b) }
        return palette[abs(hash) % palette.count]
    }

    private static func initials(for name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first }.map(String.init).joined()
        return letters.isEmpty ? "–" : letters.uppercased()
    }

    /// «I dag, 10:00» / «I morgen, 11:30» / «21. mai, 14:00» — matcher
    /// formatet mock-radene bruker.
    private static func followUpLabel(for date: Date) -> String {
        let cal = Calendar.current
        let time = date.formatted(date: .omitted, time: .shortened)
        if cal.isDateInToday(date) { return "I dag, \(time)" }
        if cal.isDateInTomorrow(date) { return "I morgen, \(time)" }
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        df.dateFormat = "d. MMM"
        return "\(df.string(from: date)), \(time)"
    }

    /// Map backend-lead → tabellrad. Temperatur (hot/ready/warm) vinner
    /// over pipeline-status siden det er den mest handlingsrettede
    /// signalen for selgeren.
    init(from lead: LeadModel) {
        let rowStatus: LeadStatus
        switch (lead.leadTemperature ?? "").lowercased() {
        case "hot", "ready":
            rowStatus = .hot
        case "warm":
            rowStatus = .warm
        default:
            switch lead.status {
            case .interested:                          rowStatus = .interested
            case .visited, .return, .meetingBooked,
                 .proposalSent, .won:                  rowStatus = .contacted
            case .unvisited:                           rowStatus = .notContacted
            default:                                   rowStatus = .newLead
            }
        }
        let owner = lead.assignedUserName ?? "Ikke tildelt"
        self.init(
            id: UUID(uuidString: lead.id) ?? UUID(),
            company: lead.name,
            category: lead.category ?? "—",
            contactName: lead.company ?? "",
            contactRole: "",
            leadScore: lead.leadScore ?? lead.aiOpportunityScore ?? 0,
            status: rowStatus,
            ownerName: owner,
            ownerInitials: Self.initials(for: owner),
            ownerColor: Self.stableColor(for: owner),
            nextFollowUp: lead.nextFollowUpAt.map(Self.followUpLabel(for:)),
            nextFollowUpOverdue: lead.nextFollowUpAt.map { $0 < Date() } ?? false,
            valueNok: Int(lead.estimatedValue ?? 0),
            companyColor: Self.stableColor(for: lead.name),
            backendId: lead.id,
            email: lead.email,
            phone: lead.phone,
            notes: lead.notes,
            nextAction: lead.nextAction,
            lastVisitAt: lead.lastVisitAt,
            nextFollowUpAt: lead.nextFollowUpAt
        )
    }
}

struct LeadActivityItem: Identifiable, Hashable {
    let id = UUID()
    let icon: String
    let title: String
    let subtitle: String
    let timestamp: String
    let color: Color
}

struct LeadNoteItem: Identifiable, Hashable {
    let id = UUID()
    let author: String
    let initials: String
    let authorColor: Color
    let body: String
    let timestamp: String
    let pinned: Bool
}

struct LeadFileItem: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let kind: FileKind
    let size: String
    let uploadedAt: String
    enum FileKind: Hashable {
        case pdf, image, doc, spreadsheet, video
        var icon: String {
            switch self {
            case .pdf: return "doc.fill"
            case .image: return "photo.fill"
            case .doc: return "doc.text.fill"
            case .spreadsheet: return "tablecells.fill"
            case .video: return "play.rectangle.fill"
            }
        }
        var color: Color {
            switch self {
            case .pdf: return Color(red: 0.95, green: 0.20, blue: 0.20)
            case .image: return Color(red: 0.20, green: 0.85, blue: 0.60)
            case .doc: return Color(red: 0.34, green: 0.60, blue: 0.98)
            case .spreadsheet: return Color(red: 0.98, green: 0.75, blue: 0.14)
            case .video: return Color(red: 0.75, green: 0.45, blue: 1.0)
            }
        }
    }
}

enum LeadsData {
    static let activities: [LeadActivityItem] = [
        LeadActivityItem(icon: "phone.fill",        title: "Telefonsamtale m/ Jonas",   subtitle: "Lars K. · 15 min · Snakket om tilbudet", timestamp: "i dag 10:14",  color: Color(red: 0.20, green: 0.85, blue: 0.60)),
        LeadActivityItem(icon: "envelope.open.fill", title: "E-post åpnet",              subtitle: "Tilbud — del 2 sett 3 ganger",            timestamp: "i går 14:22",  color: Color(red: 0.34, green: 0.60, blue: 0.98)),
        LeadActivityItem(icon: "doc.text.fill",      title: "Tilbud sendt",               subtitle: "v3 — 350 000 NOK · Lars K.",              timestamp: "20. mai 09:15", color: Color(red: 0.66, green: 0.32, blue: 0.99)),
        LeadActivityItem(icon: "calendar.badge.checkmark", title: "Befaring gjennomført", subtitle: "Storgata 12 · 1t 30min · Anders + Lars",  timestamp: "15. mai 14:00", color: Color(red: 0.98, green: 0.55, blue: 0.10)),
        LeadActivityItem(icon: "person.badge.plus",  title: "Lead opprettet",              subtitle: "Manuell · Brønnøysund-beriking auto",     timestamp: "18. apr.",      color: Color(red: 0.98, green: 0.75, blue: 0.14)),
    ]

    static let notes: [LeadNoteItem] = [
        LeadNoteItem(
            author: "Lars Kristensen", initials: "LK",
            authorColor: Color(red: 0.75, green: 0.45, blue: 1.0),
            body: "Anders er nøkkel-beslutningstaker. Konsernet vurderer flere leverandører, men foretrekker lokal partner. Pris-sensitiv på del 1, ikke del 2.",
            timestamp: "i dag 09:42", pinned: true
        ),
        LeadNoteItem(
            author: "Mikkel Berg", initials: "MB",
            authorColor: Color(red: 0.20, green: 0.85, blue: 0.60),
            body: "Sendte tilbudsutkast på e-post. Anders vil ha referanseprosjekter — særlig fra finansbygg.",
            timestamp: "i går 14:22", pinned: false
        ),
        LeadNoteItem(
            author: "Lars Kristensen", initials: "LK",
            authorColor: Color(red: 0.75, green: 0.45, blue: 1.0),
            body: "Første telefon-samtale gikk bra. De har et 4-etasjes kontorbygg som trenger oppdatering av el-anlegget. Tidsperspektiv: Q3.",
            timestamp: "19. mai 11:30", pinned: false
        ),
    ]

    static let files: [LeadFileItem] = [
        LeadFileItem(name: "Tilbud_NordicElektro_v3.pdf",     kind: .pdf,         size: "1.2 MB", uploadedAt: "i går 14:18"),
        LeadFileItem(name: "Befaringsbilder_StorgataAS.zip",  kind: .image,       size: "8.4 MB", uploadedAt: "20. mai"),
        LeadFileItem(name: "Kontorbygg_arealskisse.pdf",      kind: .pdf,         size: "640 KB", uploadedAt: "19. mai"),
        LeadFileItem(name: "Behovsanalyse.docx",              kind: .doc,         size: "320 KB", uploadedAt: "18. mai"),
        LeadFileItem(name: "Prisliste_2026.xlsx",             kind: .spreadsheet, size: "180 KB", uploadedAt: "12. mai"),
    ]

    /// Pakke 10.1 — demo-mode-gated
    private static let _leads: [LeadRow] = [
        LeadRow(company: "Nordic Elektro AS",      category: "Elektroinstallasjon", contactName: "Jonas Eide",     contactRole: "Daglig leder",  leadScore: 92, status: .hot,          ownerName: "Kari N.",   ownerInitials: "KN", ownerColor: LdBrand.purple,      nextFollowUp: "I dag, 10:00",      nextFollowUpOverdue: true,  valueNok: 350_000, companyColor: LdBrand.purple),
        LeadRow(company: "Byggmester Hansen AS",   category: "Bygg & Anlegg",       contactName: "Henrik Hansen",  contactRole: "Daglig leder",  leadScore: 78, status: .warm,         ownerName: "Ola M.",    ownerInitials: "OM", ownerColor: LdBrand.green,        nextFollowUp: "I morgen, 11:30",   nextFollowUpOverdue: false, valueNok: 180_000, companyColor: LdBrand.orange),
        LeadRow(company: "Energi & Miljø AS",      category: "Energi",              contactName: "Maria Sørensen", contactRole: "Innkjøpssjef",  leadScore: 74, status: .warm,         ownerName: "Martine J.",ownerInitials: "MJ", ownerColor: LdBrand.purpleLight,  nextFollowUp: "21. mai, 14:00",    nextFollowUpOverdue: false, valueNok: 220_000, companyColor: LdBrand.purple),
        LeadRow(company: "Oslo Tech AS",           category: "IT & Programvare",    contactName: "Anders Johansen",contactRole: "CTO",            leadScore: 65, status: .interested,   ownerName: "Lars K.",   ownerInitials: "LK", ownerColor: LdBrand.purple,       nextFollowUp: "23. mai, 09:00",    nextFollowUpOverdue: false, valueNok: 150_000, companyColor: LdBrand.purpleLight),
        LeadRow(company: "Kreativ Studio AS",      category: "Reklame & Design",    contactName: "Sofie Dahl",     contactRole: "Prosjektleder", leadScore: 58, status: .contacted,    ownerName: "Henrik S.", ownerInitials: "HS", ownerColor: LdBrand.red,          nextFollowUp: "24. mai, 10:30",    nextFollowUpOverdue: false, valueNok: 90_000,  companyColor: LdBrand.purpleLight),
        LeadRow(company: "Transport Partner AS",   category: "Transport",           contactName: "Tommy Olsen",    contactRole: "Daglig leder",  leadScore: 45, status: .newLead,      ownerName: "Kari N.",   ownerInitials: "KN", ownerColor: LdBrand.purple,       nextFollowUp: "26. mai, 13:00",    nextFollowUpOverdue: false, valueNok: 75_000,  companyColor: LdBrand.purpleLight),
        LeadRow(company: "Green Solutions AS",     category: "Miljøtjenester",      contactName: "Lise Nilsen",    contactRole: "Bærekraftsjef", leadScore: 42, status: .newLead,      ownerName: "Ola M.",    ownerInitials: "OM", ownerColor: LdBrand.green,        nextFollowUp: nil,                  nextFollowUpOverdue: false, valueNok: 60_000,  companyColor: LdBrand.green),
        LeadRow(company: "Møbelringen AS",         category: "Detaljhandel",        contactName: "Per Arne Stensrud", contactRole: "Butikksjef", leadScore: 35, status: .newLead,      ownerName: "Martine J.",ownerInitials: "MJ", ownerColor: LdBrand.purpleLight,  nextFollowUp: nil,                  nextFollowUpOverdue: false, valueNok: 45_000,  companyColor: LdBrand.red),
        LeadRow(company: "Sikkerhetspartner AS",   category: "Sikkerhet",           contactName: "Roger Pettersen",contactRole: "Salgssjef",     leadScore: 28, status: .notContacted, ownerName: "Henrik S.", ownerInitials: "HS", ownerColor: LdBrand.red,          nextFollowUp: nil,                  nextFollowUpOverdue: false, valueNok: 40_000,  companyColor: LdBrand.textSecondary),
        LeadRow(company: "Eiendomsdrift AS",       category: "Eiendom",             contactName: "Anne-Lise Berg", contactRole: "Driftsleder",   leadScore: 25, status: .notContacted, ownerName: "Lars K.",   ownerInitials: "LK", ownerColor: LdBrand.purple,       nextFollowUp: nil,                  nextFollowUpOverdue: false, valueNok: 30_000,  companyColor: LdBrand.purpleLight),
    ]

    /// Demo-mode-gated computed getter
    static var leads: [LeadRow] {
        DemoModeManager.isActiveNonisolated ? _leads : []
    }

    /// Krasj-safe fallback for `@State`-init + selectedLead-getter.
    static var firstOrPlaceholder: LeadRow {
        _leads[0]
    }
}

// MARK: - Main view

struct LeadsView: View {
    @State private var search: String = ""
    @State private var selectedLeadID: UUID?
    @State private var selectedRowIDs: Set<UUID> = []
    @State private var currentPage: Int = 1
    @State private var perPage: Int = 10
    @State private var uploadOpen: Bool = false
    @State private var detailTab: DetailTab = .details
    @State private var logActivityOpen: Bool = false
    @State private var addLeadOpen: Bool = false
    @State private var kpiDrillDown: KPIKind?
    @State private var followUpOpen: Bool = false
    // Pakke 10.1 — rike header-popovere (samme som Oversikt)
    @State private var analyseOpen: Bool = false
    @State private var nextActionsOpen: Bool = false
    @State private var notificationsOpen: Bool = false
    @Environment(AppState.self) private var appState
    // Pakke 10.1: 4 sheets bor NÅ på LeadDetailSidebar (der menyene er).
    // Kun det ubrukte state-blokket er fjernet — LeadsView har ikke lenger
    // showLeadStatusChange/Assign/Note/UploadFile/Archive-referanser.

    // Filter-state
    @State private var areaFilter: LeadsArea = .all
    @State private var statusFilter: Set<LeadRow.LeadStatus> = []
    @State private var scoreRange: ClosedRange<Double> = 0...100
    @State private var scorePreset: LeadsScorePopover.ScorePreset = .all
    @State private var savedView: String = ""
    @State private var areaOpen: Bool = false
    @State private var statusOpen: Bool = false
    @State private var scoreOpen: Bool = false
    @State private var moreFiltersOpen: Bool = false
    @State private var savedViewsOpen: Bool = false
    @State private var importOpen: Bool = false
    @State private var exportOpen: Bool = false

    // Mac Catalyst: Cmd+K/Cmd+F fokuserer søkefelt via `.leadgridFocusSearch`
    // NotificationCenter-broadcast.
    @FocusState private var searchFieldFocused: Bool

    enum DetailTab: String, CaseIterable, Hashable {
        case details = "Detaljer"
        case activity = "Aktivitet"
        case notes = "Notater"
        case files = "Filer"
    }

    /// Datakilde (uke 2-binding): demo-modus → mock-rader, ellers ekte
    /// leads fra backend via AppState (samme gating som Oversikt/Kart).
    private var sourceLeads: [LeadRow] {
        DemoModeManager.isActiveNonisolated
            ? LeadsData.leads
            : appState.leads.map(LeadRow.init(from:))
    }

    private var selectedLead: LeadRow {
        sourceLeads.first { $0.id == selectedLeadID } ?? LeadsData.firstOrPlaceholder
    }

    /// Filtrert lead-liste — søk + status + score.
    private var filteredLeads: [LeadRow] {
        sourceLeads.filter { lead in
            let s = search.trimmingCharacters(in: .whitespaces).lowercased()
            let matchesSearch = s.isEmpty
                || lead.company.lowercased().contains(s)
                || lead.contactName.lowercased().contains(s)
                || lead.category.lowercased().contains(s)
            let matchesStatus = statusFilter.isEmpty || statusFilter.contains(lead.status)
            let matchesScore = (Double(lead.leadScore) >= scoreRange.lowerBound)
                && (Double(lead.leadScore) <= scoreRange.upperBound)
            return matchesSearch && matchesStatus && matchesScore
        }
    }

    var body: some View {
        ZStack {
            LdBrand.bg.ignoresSafeArea()
            content
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if selectedLeadID == nil {
                selectedLeadID = sourceLeads.first?.id
            }
        }
        .sheet(isPresented: $logActivityOpen) {
            LogActivitySheet(lead: selectedLead)
        }
        .sheet(isPresented: $addLeadOpen) {
            // Samme modal som "+ Legg til lead" i Kart-fanen.
            // Gjenbrukt fra _AddLeadSheet.swift for konsistens.
            LeadsAddLeadSheet { _ in
                addLeadOpen = false
            }
        }
        .sheet(item: $kpiDrillDown) { kind in
            KPIDetailSheet(kind: kind)
        }
        .sheet(isPresented: $followUpOpen) {
            FollowUpDetailSheet(lead: selectedLead)
        }
        .sheet(isPresented: $moreFiltersOpen) {
            LeadsMoreFiltersSheet()
        }
        .sheet(isPresented: $importOpen) {
            ImportLeadsSheet()
        }
        .sheet(isPresented: $exportOpen) {
            // Gjenbruker Hub-ens eksport-flyt (CSV → iOS share sheet).
            // Krever innlogget APIClient — knappen gjør ingenting offline.
            if let api = appState.api {
                LeadgridExportShareView(api: api)
            }
        }
        .sheet(isPresented: $uploadOpen) {
            UploadFileSheet(lead: selectedLead)
        }
        // Pakke 10.1: shared lead-action-modaler eier av LeadDetailSidebar.
        // Mac Catalyst Cmd+K/Cmd+F fokuserer søkefeltet.
        .onReceive(NotificationCenter.default.publisher(for: .leadgridFocusSearch)) { _ in
            searchFieldFocused = true
        }
    }

    private var content: some View {
        HStack(alignment: .top, spacing: 0) {
            // Hovedinnhold venstre
            VStack(spacing: 0) {
                header
                    .padding(.horizontal, 20).padding(.top, 14)
                kpiRow
                    .padding(.horizontal, 20).padding(.top, 14)
                searchAndFilters
                    .padding(.horizontal, 20).padding(.top, 14)

                ScrollView {
                    leadsTable
                        .padding(.horizontal, 20).padding(.top, 12)
                    if totalLeadsCount > 0 {
                        pagination
                            .padding(.horizontal, 20).padding(.top, 12)
                            .padding(.bottom, 16)
                    } else {
                        Color.clear.frame(height: 16)
                    }
                }
            }
            .frame(maxWidth: .infinity)

            // Detail sidebar høyre — tom-tilstand når ingen leads finnes.
            if sourceLeads.isEmpty {
                LeadDetailEmptyState(onAddLead: { addLeadOpen = true })
                    .frame(width: 340)
            } else {
                LeadDetailSidebar(lead: selectedLead, tab: $detailTab,
                                  onLogActivity: { logActivityOpen = true },
                                  onOpenFollowUp: { followUpOpen = true },
                                  onUploadFile: { uploadOpen = true })
                    .frame(width: 340)
            }
        }
    }

    // MARK: Header — samme som Oversikt/Kart (dato/område/popovers/avatar)

    private var header: some View {
        GeometryReader { geo in
            let isNarrow = geo.size.width < 1100
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Leads")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.white)
                    if !isNarrow {
                        Text("Få full oversikt over alle dine leads og deres status.")
                            .font(.system(size: 13))
                            .foregroundStyle(LdBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                HStack(spacing: 8) {
                    topPicker(icon: "calendar", text: isNarrow ? "Tir 14" : "Tir. 14. mai")
                    if !isNarrow {
                        topPicker(icon: "location.fill", text: "Alle områder")
                    }
                    topIconButton(icon: "chart.line.uptrend.xyaxis", badge: nil, isOpen: $analyseOpen)
                        .popover(isPresented: $analyseOpen, arrowEdge: .top) {
                            AnalysePopover(leads: appState.leads)
                                .frame(width: 380, height: 520)
                                .presentationCompactAdaptation(.popover)
                        }
                    topIconButton(icon: "checklist", badge: 8, isOpen: $nextActionsOpen)
                        .popover(isPresented: $nextActionsOpen, arrowEdge: .top) {
                            NextActionsPopover(leads: appState.leads, totalCount: appState.leads.count)
                                .frame(width: 380, height: 520)
                                .presentationCompactAdaptation(.popover)
                        }
                    topIconButton(icon: "bell.fill", badge: 3, isOpen: $notificationsOpen)
                        .popover(isPresented: $notificationsOpen, arrowEdge: .top) {
                            RecentActivitiesPopover(leads: appState.leads, upcomingFollowups: 0, momentum: nil)
                                .frame(width: 380, height: 520)
                                .presentationCompactAdaptation(.popover)
                        }
                    profileAvatar(isNarrow: isNarrow)
                }
            }
        }
        .frame(height: 64)
    }

    private func topPicker(icon: String, text: String) -> some View {
        Button {} label: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(LdBrand.purpleLight)
                Text(text)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(LdBrand.textTertiary)
            }
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LdBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private func topIconButton(icon: String, badge: Int?, isOpen: Binding<Bool>? = nil) -> some View {
        Button { isOpen?.wrappedValue.toggle() } label: {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11).fill(LdBrand.card)
                    RoundedRectangle(cornerRadius: 11).stroke(LdBrand.stroke, lineWidth: 1)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(LdBrand.purpleLight)
                }
                .frame(width: 42, height: 42)
                if let b = badge, b > 0 {
                    Text("\(min(b, 99))")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(LdBrand.purple, in: Capsule())
                        .overlay(Capsule().stroke(LdBrand.bg, lineWidth: 1.5))
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

    private func profileAvatar(isNarrow: Bool) -> some View {
        SharedProfileAvatar(
            tint: LdBrand.purpleLight,
            background: LdBrand.card,
            borderColor: LdBrand.stroke,
            secondaryText: LdBrand.textSecondary,
            tertiaryText: LdBrand.textTertiary,
            isCompact: isNarrow,
            showMinProfil: $showMinProfilAvatar,
            showEcosystem: $showEcosystemAvatar,
            showTeamAccess: $showTeamAccessAvatar,
            showSuperAdmin: $showSuperAdminAvatar
        )
    }

    // toolbarButton-helper fjernet — knappene er flyttet til søk-raden.

    // MARK: KPI-rad

    private var kpiRow: some View {
        // Demo PÅ → mock-tall m/ trend-piler. Demo AV → EKTE tellinger fra
        // appState.leads (trend skjules — vi har ikke historikk-serie her,
        // og en gjettet pil ville lyve om vekst). Tomt → "—".
        let isDemo = DemoModeManager.isActiveNonisolated
        let real = appState.leads
        let cal = Calendar.current
        let weekAgo = cal.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        func fmt(_ n: Int) -> String {
            let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "
            return f.string(from: NSNumber(value: n)) ?? "\(n)"
        }
        func realValue(_ n: Int) -> String { real.isEmpty ? "—" : fmt(n) }
        return HStack(spacing: 12) {
            kpiCard(.totalLeads,     icon: "person.3.fill",      iconColor: LdBrand.purple,      title: "Totalt leads", value: isDemo ? "1 248" : realValue(real.count), trend: isDemo ? "+18 %" : nil)
            kpiCard(.newLeads,       icon: "sparkles",           iconColor: LdBrand.green,       title: "Nye leads",    value: isDemo ? "842"   : realValue(real.filter { $0.createdAt >= weekAgo }.count), trend: isDemo ? "+16 %" : nil)
            kpiCard(.contacted,      icon: "phone.fill",         iconColor: LdBrand.blue,        title: "Kontaktet",    value: isDemo ? "542"   : realValue(real.filter { $0.status != .unvisited }.count), trend: isDemo ? "+11 %" : nil)
            kpiCard(.meetingsBooked, icon: "calendar",           iconColor: LdBrand.purpleLight, title: "Møter avtalt", value: isDemo ? "236"   : realValue(real.filter { $0.status == .meetingBooked }.count), trend: isDemo ? "+12 %" : nil)
            kpiCard(.won,            icon: "trophy.fill",        iconColor: LdBrand.yellow,      title: "Vunnet",       value: isDemo ? "68"    : realValue(real.filter { $0.status == .won }.count), trend: isDemo ? "+24 %" : nil)
        }
    }

    private func kpiCard(_ kind: KPIKind, icon: String, iconColor: Color, title: String, value: String, trend: String?) -> some View {
        Button { kpiDrillDown = kind } label: {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                ZStack {
                    Circle().fill(iconColor.opacity(0.22))
                    Image(systemName: icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(iconColor)
                }
                .frame(width: 28, height: 28)
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(LdBrand.textSecondary)
                Spacer()
            }
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(value)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                if let trend {
                    HStack(spacing: 2) {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 9, weight: .bold))
                        Text(trend)
                            .font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(LdBrand.green)
                }
            }
            Text(trend == nil ? "Ingen data" : "vs. forrige periode")
                .font(.system(size: 10))
                .foregroundStyle(LdBrand.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LdBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Søk + filtre

    private var searchAndFilters: some View {
        HStack(spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundStyle(LdBrand.textSecondary)
                TextField("", text: $search,
                          prompt: Text("Søk etter navn, selskap, bransje…")
                    .foregroundColor(LdBrand.textTertiary))
                    .textFieldStyle(.plain)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .focused($searchFieldFocused)
            }
            .padding(.horizontal, 10).padding(.vertical, 9)
            .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(LdBrand.stroke, lineWidth: 1))
            .frame(maxWidth: .infinity)

            filterChip(label: areaFilter == .all ? "Alle områder" : areaFilter.rawValue,
                       active: areaFilter != .all, badge: nil, isOpen: $areaOpen)
                .popover(isPresented: $areaOpen, arrowEdge: .top) {
                    LeadsAreaPopover(selected: $areaFilter)
                        .presentationCompactAdaptation(.popover)
                }
            filterChip(label: statusFilter.isEmpty ? "Alle status" : "\(statusFilter.count) status",
                       active: !statusFilter.isEmpty, badge: statusFilter.count, isOpen: $statusOpen)
                .popover(isPresented: $statusOpen, arrowEdge: .top) {
                    LeadsStatusPopover(selected: $statusFilter)
                        .presentationCompactAdaptation(.popover)
                }
            filterChip(label: scorePreset == .all ? "Alle lead score" : scorePreset.rawValue,
                       active: scorePreset != .all, badge: nil, isOpen: $scoreOpen)
                .popover(isPresented: $scoreOpen, arrowEdge: .top) {
                    LeadsScorePopover(range: $scoreRange, preset: $scorePreset)
                        .presentationCompactAdaptation(.popover)
                }
            filterChip(label: "Flere filtre", active: false, badge: nil,
                       isOpen: $moreFiltersOpen, icon: "slider.horizontal.3")
            filterChip(label: savedView.isEmpty ? "Lagret visning" : savedView,
                       active: !savedView.isEmpty, badge: nil, isOpen: $savedViewsOpen)
                .popover(isPresented: $savedViewsOpen, arrowEdge: .top) {
                    SavedViewsPopover(selected: $savedView)
                        .presentationCompactAdaptation(.popover)
                }

            Button { importOpen = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: "arrow.down.circle")
                        .font(.system(size: 11, weight: .semibold))
                    Text("Importer")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10).padding(.vertical, 8)
                .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(LdBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)

            // Eksport (uke 2): samme flyt som i Hub-en (CSV → share sheet),
            // nå tilgjengelig der man faktisk jobber med lead-lista.
            Button { exportOpen = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 11, weight: .semibold))
                    Text("Eksporter")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10).padding(.vertical, 8)
                .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(LdBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)

            Button { addLeadOpen = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: "plus")
                        .font(.system(size: 11, weight: .bold))
                    Text("Nytt lead")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(
                    LinearGradient(
                        colors: [LdBrand.purple, LdBrand.purpleLight],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 9)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func filterChip(label: String, active: Bool, badge: Int?,
                             isOpen: Binding<Bool>, icon: String? = nil) -> some View {
        Button { isOpen.wrappedValue.toggle() } label: {
            HStack(spacing: 5) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(active ? LdBrand.purpleLight : LdBrand.textSecondary)
                }
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                if let b = badge, b > 0 {
                    Text("\(b)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(LdBrand.purple, in: Capsule())
                }
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(LdBrand.textTertiary)
            }
            .padding(.horizontal, 10).padding(.vertical, 9)
            .background(
                active ? LdBrand.purple.opacity(0.15) : LdBrand.card,
                in: RoundedRectangle(cornerRadius: 9)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 9)
                    .stroke(active ? LdBrand.purple.opacity(0.5) : LdBrand.stroke,
                            lineWidth: active ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Leads-tabell

    /// Side-utsnitt av filtrert liste — mock-lista var liten nok til å
    /// vises rått, men ekte data (300+ leads) trenger paginering.
    private var pagedLeads: [LeadRow] {
        let from = (currentPage - 1) * perPage
        guard from < filteredLeads.count else { return [] }
        let to = min(from + perPage, filteredLeads.count)
        return Array(filteredLeads[from..<to])
    }

    private var leadsTable: some View {
        VStack(spacing: 0) {
            tableHeader
            if sourceLeads.isEmpty {
                // Uke 2: skill «laster»/«feilet»/«ekte tom» via
                // appState.leadsLoadState (samme mønster som prosjekt-kortet)
                // så vi ikke blinker tom-tilstand ved app-start.
                switch appState.leadsLoadState {
                case .idle, .loading:
                    loadingLeadsState
                case .failed(let message, let retryable):
                    errorLeadsState(message: message, retryable: retryable)
                case .loaded:
                    emptyLeadsState
                }
            } else {
                ForEach(pagedLeads) { lead in
                    LeadTableRow(
                        lead: lead,
                        isSelected: selectedLeadID == lead.id,
                        isChecked: selectedRowIDs.contains(lead.id),
                        onTap: { selectedLeadID = lead.id },
                        onCheck: {
                            if selectedRowIDs.contains(lead.id) {
                                selectedRowIDs.remove(lead.id)
                            } else {
                                selectedRowIDs.insert(lead.id)
                            }
                        }
                    )
                }
            }
        }
        .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LdBrand.stroke, lineWidth: 1))
    }

    /// Loading-skeleton (uke 2) — 5 pulserende rad-plassholdere mens
    /// leads hentes fra backend første gang.
    private var loadingLeadsState: some View {
        VStack(spacing: 0) {
            ForEach(0..<5, id: \.self) { i in
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(LdBrand.cardHi)
                        .frame(width: 34, height: 34)
                    VStack(alignment: .leading, spacing: 6) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(LdBrand.cardHi)
                            .frame(width: 180, height: 11)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(LdBrand.cardHi.opacity(0.6))
                            .frame(width: 110, height: 9)
                    }
                    Spacer()
                    RoundedRectangle(cornerRadius: 4)
                        .fill(LdBrand.cardHi.opacity(0.6))
                        .frame(width: 64, height: 10)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 13)
                .opacity(1.0 - Double(i) * 0.15)
                if i < 4 { Divider().background(LdBrand.stroke) }
            }
        }
        .redacted(reason: .placeholder)
        .accessibilityLabel("Laster leads")
    }

    /// Feil-tilstand (uke 2) — vis hva som gikk galt + retry-knapp i
    /// stedet for å late som lista er tom.
    private func errorLeadsState(message: String, retryable: Bool) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 34, weight: .regular))
                .foregroundStyle(LdBrand.red.opacity(0.8))
            Text("Kunne ikke hente leads")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(LdBrand.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 380)
                .lineLimit(3)
            if retryable {
                Button {
                    Task { await appState.refreshLeads() }
                } label: {
                    Label("Prøv igjen", systemImage: "arrow.clockwise")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(LdBrand.purple, in: RoundedRectangle(cornerRadius: 9))
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    /// Tom-tilstand når `LeadsData.leads.isEmpty` (typisk = demo-modus AV
    /// og backend har enda ikke levert reelle leads).
    private var emptyLeadsState: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.3.sequence.fill")
                .font(.system(size: 34, weight: .regular))
                .foregroundStyle(LdBrand.textTertiary)
            Text("Ingen leads enda")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text("Bruk «+ Nytt lead» eller skru på demo-modus i innstillinger for å se eksempeldata.")
                .font(.system(size: 12))
                .foregroundStyle(LdBrand.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 380)
            Button {
                addLeadOpen = true
            } label: {
                Text("+ Nytt lead")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(LdBrand.purple, in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 56)
    }

    private var tableHeader: some View {
        HStack(spacing: 0) {
            // Checkbox
            HStack { }.frame(width: 36)

            tableCol("Selskap").frame(maxWidth: .infinity, alignment: .leading)
            tableCol("Kontaktperson").frame(width: 160, alignment: .leading)
            tableCol("Lead score").frame(width: 80, alignment: .center)
            tableCol("Status").frame(width: 110, alignment: .leading)
            tableCol("Eier").frame(width: 110, alignment: .leading)
            tableCol("Neste oppfølging").frame(width: 130, alignment: .leading)
            tableCol("Verdi").frame(width: 96, alignment: .trailing)
            HStack { }.frame(width: 36)
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .overlay(
            Rectangle().fill(LdBrand.stroke).frame(height: 1),
            alignment: .bottom
        )
    }

    private func tableCol(_ s: String) -> some View {
        Text(s)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(LdBrand.textSecondary)
            .textCase(.uppercase)
    }

    // MARK: Pagination

    /// Totalt antall leads etter filter — pagineringen (og «Viser 1-10 av
    /// N leads»-teksten) forteller sannheten for både demo og ekte data.
    private var totalLeadsCount: Int {
        filteredLeads.count
    }

    private var totalPages: Int {
        max(1, Int(ceil(Double(totalLeadsCount) / Double(perPage))))
    }

    private var visibleRange: String {
        let from = (currentPage - 1) * perPage + 1
        let to = min(currentPage * perPage, totalLeadsCount)
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "
        let total = f.string(from: NSNumber(value: totalLeadsCount)) ?? "\(totalLeadsCount)"
        return "Viser \(from)-\(to) av \(total) leads"
    }

    /// Smart sliding-window over sider rundt currentPage + alltid 1 og siste.
    private var visiblePageNumbers: [Int] {
        let total = totalPages
        if total <= 7 { return Array(1...total) }
        var pages: [Int] = [1]
        let start = max(2, currentPage - 1)
        let end = min(total - 1, currentPage + 1)
        if start > 2 { pages.append(-1) }  // -1 = "…"
        for p in start...end { pages.append(p) }
        if end < total - 1 { pages.append(-1) }
        pages.append(total)
        return pages
    }

    private var pagination: some View {
        HStack(spacing: 10) {
            Text(visibleRange)
                .font(.system(size: 11))
                .foregroundStyle(LdBrand.textSecondary)
            Spacer()
            HStack(spacing: 4) {
                paginationButton(icon: "chevron.left",
                                 enabled: currentPage > 1) {
                    if currentPage > 1 { currentPage -= 1 }
                }
                ForEach(Array(visiblePageNumbers.enumerated()), id: \.offset) { (idx, n) in
                    if n == -1 {
                        Text("…")
                            .font(.system(size: 12))
                            .foregroundStyle(LdBrand.textSecondary)
                            .frame(minWidth: 18)
                    } else {
                        paginationNumber(n)
                    }
                }
                paginationButton(icon: "chevron.right",
                                 enabled: currentPage < totalPages) {
                    if currentPage < totalPages { currentPage += 1 }
                }
            }
            Spacer()
            Menu {
                ForEach([10, 25, 50, 100], id: \.self) { n in
                    Button {
                        perPage = n
                        currentPage = 1  // reset til side 1 når per-side endres
                    } label: {
                        if perPage == n {
                            Label("\(n) per side", systemImage: "checkmark")
                        } else {
                            Text("\(n) per side")
                        }
                    }
                }
            } label: {
                HStack(spacing: 5) {
                    Text("\(perPage) per side")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 9))
                        .foregroundStyle(LdBrand.textTertiary)
                }
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(LdBrand.stroke, lineWidth: 1))
            }
        }
    }

    private func paginationButton(icon: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(enabled ? .white : LdBrand.textTertiary)
                .frame(width: 28, height: 28)
                .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 7))
                .overlay(RoundedRectangle(cornerRadius: 7).stroke(LdBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
    }

    private func paginationNumber(_ n: Int) -> some View {
        let isCurrent = currentPage == n
        return Button { currentPage = n } label: {
            Text("\(n)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(isCurrent ? .white : .white)
                .frame(minWidth: 28, minHeight: 28)
                .padding(.horizontal, 4)
                .background(
                    isCurrent
                        ? AnyShapeStyle(LinearGradient(
                            colors: [LdBrand.purple, LdBrand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        ))
                        : AnyShapeStyle(LdBrand.card),
                    in: RoundedRectangle(cornerRadius: 7)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 7)
                        .stroke(isCurrent ? Color.clear : LdBrand.stroke, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - LeadTableRow

struct LeadTableRow: View {
    let lead: LeadRow
    let isSelected: Bool
    let isChecked: Bool
    let onTap: () -> Void
    let onCheck: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                // Checkbox
                Button(action: onCheck) {
                    Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                        .font(.system(size: 15))
                        .foregroundStyle(isChecked ? LdBrand.purpleLight : LdBrand.stroke)
                        .frame(width: 36, height: 30)
                }
                .buttonStyle(.plain)

                // Selskap
                HStack(spacing: 9) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(lead.companyColor.opacity(0.20))
                        Image(systemName: "building.2.fill")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(lead.companyColor)
                    }
                    .frame(width: 36, height: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(lead.company)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Text(lead.category)
                            .font(.system(size: 10))
                            .foregroundStyle(LdBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Kontaktperson
                VStack(alignment: .leading, spacing: 2) {
                    Text(lead.contactName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(lead.contactRole)
                        .font(.system(size: 10))
                        .foregroundStyle(LdBrand.textSecondary)
                        .lineLimit(1)
                }
                .frame(width: 160, alignment: .leading)

                // Lead score
                ZStack {
                    Circle()
                        .stroke(LdBrand.stroke, lineWidth: 3)
                        .frame(width: 38, height: 38)
                    Circle()
                        .trim(from: 0, to: Double(lead.leadScore) / 100)
                        .stroke(scoreColor(lead.leadScore), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 38, height: 38)
                    Text("\(lead.leadScore)")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
                .frame(width: 80, alignment: .center)

                // Status
                statusBadge(lead.status)
                    .frame(width: 110, alignment: .leading)

                // Eier
                HStack(spacing: 6) {
                    ZStack {
                        Circle().fill(lead.ownerColor.opacity(0.30))
                        Text(lead.ownerInitials)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(lead.ownerColor)
                    }
                    .frame(width: 24, height: 24)
                    Text(lead.ownerName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                .frame(width: 110, alignment: .leading)

                // Neste oppfølging
                Text(lead.nextFollowUp ?? "–")
                    .font(.system(size: 11, weight: lead.nextFollowUpOverdue ? .bold : .regular))
                    .foregroundStyle(lead.nextFollowUpOverdue ? LdBrand.red : .white)
                    .frame(width: 130, alignment: .leading)

                // Verdi
                Text("NOK \(formatThousands(lead.valueNok))")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .frame(width: 96, alignment: .trailing)

                // Ellipsis menu — per-rad actions
                Menu {
                    Button { onTap() } label: {
                        Label("Åpne lead", systemImage: "arrow.up.right.square")
                    }
                    Section("Kommunikasjon") {
                        if let phone = lead.displayPhone {
                            Button { call(phone) } label: {
                                Label("Ring \(lead.contactName.isEmpty ? lead.company : lead.contactName)", systemImage: "phone.fill")
                            }
                        }
                        if let mail = lead.displayEmail {
                            Button { email(mail) } label: {
                                Label("Send e-post", systemImage: "envelope.fill")
                            }
                        }
                        Button {} label: {
                            Label("Planlegg møte", systemImage: "calendar.badge.plus")
                        }
                    }
                    Section("Lead-handlinger") {
                        Button {} label: {
                            Label("Loggfør aktivitet", systemImage: "plus.circle.fill")
                        }
                        Menu {
                            ForEach(LeadRow.LeadStatus.allCases, id: \.self) { st in
                                Button {} label: {
                                    Label(st.label, systemImage: st.icon)
                                }
                            }
                        } label: {
                            Label("Endre status", systemImage: "tag.fill")
                        }
                        Menu {
                            Button {} label: { Label("Kari Nordmann", systemImage: "person.crop.circle") }
                            Button {} label: { Label("Mikkel Berg", systemImage: "person.crop.circle") }
                            Button {} label: { Label("Anniken Sørli", systemImage: "person.crop.circle") }
                            Divider()
                            Button {} label: { Label("Selv (Lars)", systemImage: "person.crop.circle.fill") }
                        } label: {
                            Label("Tilordne selger", systemImage: "person.2.fill")
                        }
                        Button {} label: {
                            Label("Sett som favoritt", systemImage: "star.fill")
                        }
                    }
                    Section("Avansert") {
                        Menu {
                            Button {} label: { Label("Som CSV", systemImage: "tablecells") }
                            Button {} label: { Label("Som PDF", systemImage: "doc.richtext") }
                            Button {} label: { Label("Som .vcf", systemImage: "person.text.rectangle") }
                        } label: {
                            Label("Eksporter", systemImage: "square.and.arrow.up")
                        }
                        Button {} label: {
                            Label("Kopier lenke", systemImage: "link")
                        }
                    }
                    Divider()
                    Button(role: .destructive) {} label: {
                        Label("Arkiver", systemImage: "archivebox.fill")
                    }
                    Button(role: .destructive) {} label: {
                        Label("Slett lead", systemImage: "trash.fill")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(LdBrand.textSecondary)
                        .frame(width: 36, height: 30)
                        .contentShape(Rectangle())
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(
                isSelected ? LdBrand.purple.opacity(0.12) : Color.clear
            )
            .overlay(
                Rectangle().fill(LdBrand.stroke).frame(height: 1),
                alignment: .bottom
            )
            .overlay(
                isSelected
                    ? RoundedRectangle(cornerRadius: 0).stroke(LdBrand.purpleLight, lineWidth: 1.5).padding(.horizontal, 2)
                    : nil
            )
        }
        .buttonStyle(.plain)
    }

    private func call(_ number: String) {
        let cleaned = number.filter { $0.isNumber || $0 == "+" }
        if let url = URL(string: "tel://\(cleaned)") {
            UIApplication.shared.open(url)
        }
    }
    private func email(_ address: String) {
        if let url = URL(string: "mailto:\(address)") {
            UIApplication.shared.open(url)
        }
    }

    private func scoreColor(_ score: Int) -> Color {
        switch score {
        case 80...: return LdBrand.purpleLight
        case 60..<80: return LdBrand.blue
        case 40..<60: return LdBrand.yellow
        default: return LdBrand.textTertiary
        }
    }

    private func statusBadge(_ st: LeadRow.LeadStatus) -> some View {
        HStack(spacing: 4) {
            Image(systemName: st.icon)
                .font(.system(size: 9, weight: .bold))
            Text(st.label)
                .font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(st == .notContacted ? LdBrand.textSecondary : st.color)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(
            st == .notContacted ? LdBrand.cardHi : st.color.opacity(0.18),
            in: Capsule()
        )
        .overlay(
            Capsule().stroke(st == .notContacted ? LdBrand.stroke : st.color.opacity(0.40), lineWidth: 1)
        )
    }
}

fileprivate func formatThousands(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.groupingSeparator = " "
    return f.string(from: NSNumber(value: n)) ?? "\(n)"
}

// MARK: - LeadDetailEmptyState (right side — når ingen leads finnes)

/// Tom-tilstand for høyre-panelet i Leads-fanen. Vises når
/// `LeadsData.leads.isEmpty` (typisk demo-modus AV + backend uten data).
/// Matcher visuell footprint av `LeadDetailSidebar` (samme bg + stroke).
struct LeadDetailEmptyState: View {
    var onAddLead: () -> Void = {}

    var body: some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: "person.crop.rectangle.stack")
                .font(.system(size: 44, weight: .regular))
                .foregroundStyle(LdBrand.textTertiary)
            Text("Ingen lead valgt")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text("Detaljer, kontaktinfo og pipeline-status vises her når du har valgt en lead.")
                .font(.system(size: 12))
                .foregroundStyle(LdBrand.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Button {
                onAddLead()
            } label: {
                Text("+ Nytt lead")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(LdBrand.purple, in: Capsule())
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LdBrand.card)
        .overlay(
            Rectangle().fill(LdBrand.stroke).frame(width: 1),
            alignment: .leading
        )
    }
}

// MARK: - LeadDetailSidebar (right side)

struct LeadDetailSidebar: View {
    let lead: LeadRow
    @Binding var tab: LeadsView.DetailTab
    var onLogActivity: () -> Void = {}
    var onOpenFollowUp: () -> Void = {}
    var onUploadFile: () -> Void = {}

    // Pakke 10.1: 4 shared lead-action-modaler + arkiv-bekreftelse.
    @State private var showLeadStatusChange: Bool = false
    @State private var showLeadAssignSeller: Bool = false
    @State private var showLeadNoteEditor: Bool = false
    @State private var showLeadUploadFile: Bool = false
    @State private var showLeadArchiveConfirm: Bool = false
    @State private var actionToast: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                headerCard
                tabPicker
                content
            }
            .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 90)
        }
        .background(LdBrand.card)
        .overlay(
            Rectangle().fill(LdBrand.stroke).frame(width: 1),
            alignment: .leading
        )
        .overlay(alignment: .bottom) {
            actionBar
        }
        // Pakke 10.1: shared lead-action-sheets
        .sheet(isPresented: $showLeadStatusChange) {
            LeadStatusChangeSheet(
                companyName: lead.company,
                companyColor: lead.companyColor
            ) { newStatus, _ in
                actionToast = "Status endret til \(newStatus.label)"
            }
        }
        .sheet(isPresented: $showLeadAssignSeller) {
            LeadAssignSellerSheet(
                companyName: lead.company,
                companyColor: lead.companyColor,
                currentSellerName: lead.ownerName
            ) { newSeller in
                actionToast = "Tildelt \(newSeller.name)"
            }
        }
        .sheet(isPresented: $showLeadNoteEditor) {
            LeadNoteSheet(
                companyName: lead.company,
                companyColor: lead.companyColor
            ) { _, _, pinned in
                actionToast = "Notat lagret\(pinned ? " (festet)" : "")"
            }
        }
        .sheet(isPresented: $showLeadUploadFile) {
            UploadFileSheet(lead: lead)
        }
        .confirmationDialog(
            "Arkivere \(lead.company)?",
            isPresented: $showLeadArchiveConfirm,
            titleVisibility: .visible
        ) {
            Button("Arkiver", role: .destructive) {
                actionToast = "\(lead.company) arkivert"
            }
            Button("Avbryt", role: .cancel) { }
        } message: {
            Text("Lead-en flyttes til arkiv. Du kan hente den tilbake fra Filter → Vis arkiverte.")
        }
        .overlay(alignment: .top) {
            if let t = actionToast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(LdBrand.green, in: Capsule())
                    .padding(.top, 10)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: actionToast)
        .onChange(of: actionToast) { _, new in
            if new != nil {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                    if actionToast == new { actionToast = nil }
                }
            }
        }
    }

    // MARK: Header

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Text(lead.company)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                Image(systemName: "star")
                    .font(.system(size: 13))
                    .foregroundStyle(LdBrand.textTertiary)
                Spacer()
                Image(systemName: "ellipsis")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(LdBrand.textSecondary)
            }
            HStack(spacing: 5) {
                Image(systemName: lead.status.icon)
                    .font(.system(size: 9, weight: .bold))
                Text(lead.status.label)
                    .font(.system(size: 10, weight: .bold))
            }
            .foregroundStyle(lead.status.color)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(lead.status.color.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(lead.status.color.opacity(0.4), lineWidth: 1))

            // Score-ring
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .stroke(LdBrand.stroke, lineWidth: 6)
                        .frame(width: 72, height: 72)
                    Circle()
                        .trim(from: 0, to: Double(lead.leadScore) / 100)
                        .stroke(LdBrand.purpleLight, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 72, height: 72)
                    Text("\(lead.leadScore)")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("Lead score")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    HStack(spacing: 3) {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 10, weight: .bold))
                        Text("12")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(LdBrand.green)
                }
                Spacer()
            }
        }
    }

    // MARK: Tab-picker

    private var tabPicker: some View {
        ZStack(alignment: .bottom) {
            Rectangle().fill(LdBrand.stroke).frame(height: 1).padding(.top, 26)
            HStack(spacing: 0) {
                ForEach(LeadsView.DetailTab.allCases, id: \.self) { t in
                    tabButton(t)
                }
                Spacer()
            }
        }
        .frame(height: 28)
    }

    private func tabButton(_ t: LeadsView.DetailTab) -> some View {
        let isSelected = tab == t
        return Button { tab = t } label: {
            VStack(spacing: 5) {
                Text(t.rawValue)
                    .font(.system(size: 12, weight: isSelected ? .bold : .semibold))
                    .foregroundStyle(isSelected ? LdBrand.purpleLight : LdBrand.textSecondary)
                Rectangle()
                    .fill(isSelected ? LdBrand.purpleLight : Color.clear)
                    .frame(height: 2)
            }
            .padding(.horizontal, 11)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var content: some View {
        switch tab {
        case .details:  detailsTab
        case .activity: activityTab
        case .notes:    notesTab
        case .files:    filesTab
        }
    }

    // MARK: Detaljer-tab

    private var detailsTab: some View {
        VStack(alignment: .leading, spacing: 14) {
            kontaktSection
            companySection
            pipelineSection
            nextFollowUpSection
            metaSection
        }
    }

    private var kontaktSection: some View {
        VStack(alignment: .leading, spacing: 9) {
            sectionTitle("Kontaktperson")
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(LdBrand.purple.opacity(0.30))
                    Text("JE")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(LdBrand.purpleLight)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(lead.contactName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(lead.contactRole)
                        .font(.system(size: 11))
                        .foregroundStyle(LdBrand.textSecondary)
                }
                Spacer()
            }
            if let phone = lead.displayPhone {
                contactRow(icon: "phone", text: phone, color: LdBrand.green)
            }
            if let mail = lead.displayEmail {
                contactRow(icon: "envelope", text: mail, color: LdBrand.blue)
            }
            if lead.backendId == nil {
                contactRow(icon: "link", text: "LinkedIn-profil", color: LdBrand.purpleLight)
            }
        }
    }

    private func contactRow(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 9) {
            ZStack {
                Circle().fill(color.opacity(0.20))
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 26, height: 26)
            Text(text)
                .font(.system(size: 11))
                .foregroundStyle(.white)
                .lineLimit(1)
            Spacer()
        }
    }

    private var companySection: some View {
        VStack(alignment: .leading, spacing: 9) {
            sectionTitle("Om selskapet")
            metaRow("Bransje", "Elektroinstallasjon")
            metaRow("Sted", "Oslo, Norge")
            metaRow("Ansatte", "25-50")
            metaRow("Omsetning", "10-20 mill. NOK")
            Button {} label: {
                HStack(spacing: 4) {
                    Text("Se mer informasjon")
                        .font(.system(size: 11, weight: .semibold))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 9, weight: .semibold))
                }
                .foregroundStyle(LdBrand.purpleLight)
            }
            .buttonStyle(.plain)
        }
    }

    private func metaRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(LdBrand.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white)
        }
    }

    // Pipeline

    private var pipelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Status i pipelinen")
            let stages = ["Ny lead", "Kontaktet", "Møte\navtalt", "Tilbud\nsendt", "Vunnet"]
            let current = 2  // Møte avtalt
            HStack(spacing: 0) {
                ForEach(0..<stages.count, id: \.self) { i in
                    VStack(spacing: 5) {
                        ZStack {
                            Circle()
                                .fill(i <= current ? LdBrand.purple : LdBrand.cardHi)
                            Circle()
                                .stroke(i <= current ? LdBrand.purpleLight : LdBrand.stroke, lineWidth: 2)
                            if i < current {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                            } else if i == current {
                                Circle().fill(.white).frame(width: 6, height: 6)
                            }
                        }
                        .frame(width: 18, height: 18)
                        Text(stages[i])
                            .font(.system(size: 9, weight: i == current ? .bold : .regular))
                            .foregroundStyle(i <= current ? .white : LdBrand.textTertiary)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity)
                    if i < stages.count - 1 {
                        Rectangle()
                            .fill(i < current ? LdBrand.purple : LdBrand.stroke)
                            .frame(height: 2)
                            .frame(maxWidth: .infinity)
                            .offset(y: -10)
                    }
                }
            }
        }
    }

    private var nextFollowUpSection: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                sectionTitle("Neste oppfølging")
                Spacer()
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 11))
                    .foregroundStyle(LdBrand.textSecondary)
            }
            HStack(spacing: 7) {
                Image(systemName: "calendar")
                    .font(.system(size: 10))
                    .foregroundStyle(LdBrand.red)
                Text(lead.nextFollowUp ?? "Ikke planlagt")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                if lead.nextFollowUpOverdue {
                    Text("Overforfalt")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(LdBrand.red)
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(LdBrand.red.opacity(0.18), in: Capsule())
                        .overlay(Capsule().stroke(LdBrand.red.opacity(0.4), lineWidth: 1))
                }
            }
            Text("Telefonmøte med Jonas Eide")
                .font(.system(size: 11))
                .foregroundStyle(LdBrand.textSecondary)
            Button { onOpenFollowUp() } label: {
                Text("Åpne oppfølging")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(LdBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private var metaSection: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Forventet verdi")
                    .font(.system(size: 10))
                    .foregroundStyle(LdBrand.textSecondary)
                Text("NOK \(formatThousands(lead.valueNok))")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("Høy")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(LdBrand.green)
            }
            Spacer()
            HStack(spacing: 6) {
                ZStack {
                    Circle().fill(LdBrand.purple.opacity(0.30))
                    Text("KN")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(LdBrand.purpleLight)
                }
                .frame(width: 28, height: 28)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Kari Nordmann")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Selger")
                        .font(.system(size: 9))
                        .foregroundStyle(LdBrand.textSecondary)
                }
            }
        }
        .padding(10)
        .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: Aktivitet-tab

    private var activityTab: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Aktivitetshistorikk")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button { } label: {
                    Text("Filtrer")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(LdBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            VStack(spacing: 6) {
                ForEach(LeadsData.activities) { a in
                    activityRow(a)
                }
            }
        }
    }

    private func activityRow(_ a: LeadActivityItem) -> some View {
        HStack(alignment: .top, spacing: 9) {
            ZStack {
                Circle().fill(a.color.opacity(0.20))
                Image(systemName: a.icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(a.color)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(a.title)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(a.timestamp)
                        .font(.system(size: 9))
                        .foregroundStyle(LdBrand.textTertiary)
                }
                Text(a.subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(LdBrand.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(9)
        .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    // MARK: Notater-tab

    private var notesTab: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { } label: {
                HStack(spacing: 7) {
                    ZStack {
                        Circle().fill(LdBrand.purple.opacity(0.25))
                        Text("LK")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(LdBrand.purpleLight)
                    }
                    .frame(width: 26, height: 26)
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 10))
                        .foregroundStyle(LdBrand.textTertiary)
                    Text("Skriv et notat…")
                        .font(.system(size: 11))
                        .foregroundStyle(LdBrand.textTertiary)
                    Spacer()
                }
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(LdBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            ForEach(LeadsData.notes) { n in
                noteRow(n)
            }
        }
    }

    private func noteRow(_ n: LeadNoteItem) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                ZStack {
                    Circle().fill(n.authorColor.opacity(0.25))
                    Text(n.initials)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(n.authorColor)
                }
                .frame(width: 22, height: 22)
                Text(n.author)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
                if n.pinned {
                    Image(systemName: "pin.fill")
                        .font(.system(size: 8))
                        .foregroundStyle(LdBrand.yellow)
                }
                Spacer()
                Text(n.timestamp)
                    .font(.system(size: 9))
                    .foregroundStyle(LdBrand.textTertiary)
            }
            Text(n.body)
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(9)
        .background(
            n.pinned ? LdBrand.yellow.opacity(0.08) : LdBrand.cardHi,
            in: RoundedRectangle(cornerRadius: 9)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 9)
                .stroke(n.pinned ? LdBrand.yellow.opacity(0.35) : LdBrand.stroke, lineWidth: 1)
        )
    }

    // MARK: Filer-tab

    private var filesTab: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(LeadsData.files.count) filer")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(LdBrand.textSecondary)
                Spacer()
                Button { onUploadFile() } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text("Last opp")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(LdBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            ForEach(LeadsData.files) { f in
                fileRow(f)
            }
        }
    }

    private func fileRow(_ f: LeadFileItem) -> some View {
        Button { } label: {
            HStack(spacing: 9) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(f.kind.color.opacity(0.22))
                    Image(systemName: f.kind.icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(f.kind.color)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text(f.name)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        Text(f.size)
                            .font(.system(size: 9))
                            .foregroundStyle(LdBrand.textSecondary)
                        Text("·")
                            .font(.system(size: 9))
                            .foregroundStyle(LdBrand.textTertiary)
                        Text(f.uploadedAt)
                            .font(.system(size: 9))
                            .foregroundStyle(LdBrand.textTertiary)
                    }
                }
                Spacer()
                Image(systemName: "arrow.down.circle")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(LdBrand.purpleLight)
            }
            .padding(8)
            .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
    }

    // MARK: Action-bar bunn

    private var actionBar: some View {
        HStack(spacing: 8) {
            Button { onLogActivity() } label: {
                HStack(spacing: 5) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 11, weight: .bold))
                    Text("Loggfør aktivitet")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(
                    LinearGradient(
                        colors: [LdBrand.purple, LdBrand.purpleLight],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 10)
                )
            }
            .buttonStyle(.plain)

            Menu {
                Section("Kommunikasjon") {
                    if let phone = lead.displayPhone {
                        Button { call(phone) } label: {
                            Label("Ring \(lead.contactName.isEmpty ? lead.company : lead.contactName)", systemImage: "phone.fill")
                        }
                    }
                    if let mail = lead.displayEmail {
                        Button { email(mail) } label: {
                            Label("Send e-post", systemImage: "envelope.fill")
                        }
                    }
                    Button {} label: {
                        Label("Planlegg møte", systemImage: "calendar.badge.plus")
                    }
                    Button {} label: {
                        Label("Start video-møte", systemImage: "video.fill")
                    }
                }
                Section("Lead-handlinger") {
                    Menu {
                        ForEach(LeadRow.LeadStatus.allCases, id: \.self) { st in
                            Button { } label: {
                                Label(st.label, systemImage: st.icon)
                            }
                        }
                        Divider()
                        Button { showLeadStatusChange = true } label: {
                            Label("Åpne detaljert status-editor…", systemImage: "square.and.pencil")
                        }
                    } label: {
                        Label("Endre status", systemImage: "tag.fill")
                    }
                    Button { showLeadAssignSeller = true } label: {
                        Label("Tilordne selger", systemImage: "person.2.fill")
                    }
                    Button { } label: {
                        Label("Sett som favoritt", systemImage: "star.fill")
                    }
                    Button { } label: {
                        Label("Marker som vunnet", systemImage: "trophy.fill")
                    }
                }
                Section("Innhold") {
                    Button { showLeadNoteEditor = true } label: {
                        Label("Legg til notat", systemImage: "note.text.badge.plus")
                    }
                    Button { showLeadUploadFile = true } label: {
                        Label("Last opp fil", systemImage: "doc.fill.badge.plus")
                    }
                }
                Section("Avansert") {
                    Button { } label: {
                        Label("Slå sammen med annen lead", systemImage: "arrow.triangle.merge")
                    }
                    Menu {
                        Button { } label: { Label("Som CSV", systemImage: "tablecells") }
                        Button { } label: { Label("Som PDF", systemImage: "doc.richtext") }
                        Button { } label: { Label("Som .vcf (kontakt)", systemImage: "person.text.rectangle") }
                    } label: {
                        Label("Eksporter", systemImage: "square.and.arrow.up")
                    }
                    Button { } label: {
                        Label("Del med team", systemImage: "person.crop.circle.badge.plus")
                    }
                    Button { } label: {
                        Label("Kopier lenke", systemImage: "link")
                    }
                }
                Divider()
                Button(role: .destructive) { showLeadArchiveConfirm = true } label: {
                    Label("Arkiver lead", systemImage: "archivebox.fill")
                }
                Button(role: .destructive) { } label: {
                    Label("Slett lead", systemImage: "trash.fill")
                }
            } label: {
                HStack(spacing: 4) {
                    Text("Flere handlinger")
                        .font(.system(size: 12, weight: .semibold))
                    Image(systemName: "chevron.down")
                        .font(.system(size: 9))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LdBrand.stroke, lineWidth: 1))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(
            LdBrand.card.overlay(
                Rectangle().fill(LdBrand.stroke).frame(height: 1),
                alignment: .top
            )
        )
    }

    private func call(_ number: String) {
        let cleaned = number.filter { $0.isNumber || $0 == "+" }
        if let url = URL(string: "tel://\(cleaned)") {
            UIApplication.shared.open(url)
        }
    }
    private func email(_ address: String) {
        if let url = URL(string: "mailto:\(address)") {
            UIApplication.shared.open(url)
        }
    }

    private func sectionTitle(_ s: String) -> some View {
        Text(s)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(.white)
    }
}
