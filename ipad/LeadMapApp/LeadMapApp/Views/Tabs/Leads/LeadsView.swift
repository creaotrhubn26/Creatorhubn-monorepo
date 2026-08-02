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
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.45)
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

    static func initials(for name: String) -> String {
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

/// Lokale lead-notater (UserDefaults per enhet, nøklet på backendId ?? company).
/// Det finnes ingen backend-flate for lead-notater enda — lagres lokalt slik at
/// «Notat lagret» faktisk er sant og notatene dukker opp i Notater-fanen.
enum LeadLocalNotes {
    struct Stored: Codable {
        let author: String
        let body: String
        let dateISO: String
        let pinned: Bool
    }
    private static let key = "leadLokaleNotater"

    private static func all() -> [String: [Stored]] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let dict = try? JSONDecoder().decode([String: [Stored]].self, from: data)
        else { return [:] }
        return dict
    }

    static func notes(for token: String) -> [LeadNoteItem] {
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        df.dateFormat = "d. MMM HH:mm"
        return (all()[token] ?? []).reversed().map { s in
            LeadNoteItem(
                author: s.author,
                initials: s.author.split(separator: " ").prefix(2)
                    .map { String($0.prefix(1)) }.joined().uppercased(),
                authorColor: Color(red: 0.75, green: 0.45, blue: 1.0),
                body: s.body,
                timestamp: ISO8601DateFormatter().date(from: s.dateISO)
                    .map { df.string(from: $0) } ?? "",
                pinned: s.pinned
            )
        }
    }

    static func add(body: String, pinned: Bool, author: String, to token: String) {
        var dict = all()
        dict[token, default: []].append(Stored(
            author: author, body: body,
            dateISO: ISO8601DateFormatter().string(from: Date()),
            pinned: pinned
        ))
        if let data = try? JSONEncoder().encode(dict) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
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
    /// Mock-aktiviteter — KUN i demo-modus. Ellers tom liste + ærlig tom-tilstand i viewet.
    static var activities: [LeadActivityItem] {
        DemoModeManager.isActiveNonisolated ? _activities : []
    }
    private static let _activities: [LeadActivityItem] = [
        LeadActivityItem(icon: "phone.fill",        title: "Telefonsamtale m/ Jonas",   subtitle: "Lars K. · 15 min · Snakket om tilbudet", timestamp: "i dag 10:14",  color: Color(red: 0.20, green: 0.85, blue: 0.60)),
        LeadActivityItem(icon: "envelope.open.fill", title: "E-post åpnet",              subtitle: "Tilbud — del 2 sett 3 ganger",            timestamp: "i går 14:22",  color: Color(red: 0.34, green: 0.60, blue: 0.98)),
        LeadActivityItem(icon: "doc.text.fill",      title: "Tilbud sendt",               subtitle: "v3 — 350 000 NOK · Lars K.",              timestamp: "20. mai 09:15", color: Color(red: 0.66, green: 0.32, blue: 0.99)),
        LeadActivityItem(icon: "calendar.badge.checkmark", title: "Befaring gjennomført", subtitle: "Storgata 12 · 1t 30min · Anders + Lars",  timestamp: "15. mai 14:00", color: Color(red: 0.98, green: 0.55, blue: 0.10)),
        LeadActivityItem(icon: "person.badge.plus",  title: "Lead opprettet",              subtitle: "Manuell · Brønnøysund-beriking auto",     timestamp: "18. apr.",      color: Color(red: 0.98, green: 0.75, blue: 0.14)),
    ]

    /// Mock-notater — KUN i demo-modus.
    static var notes: [LeadNoteItem] {
        DemoModeManager.isActiveNonisolated ? _notes : []
    }
    private static let _notes: [LeadNoteItem] = [
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

    /// Mock-filer — KUN i demo-modus.
    static var files: [LeadFileItem] {
        DemoModeManager.isActiveNonisolated ? _files : []
    }
    private static let _files: [LeadFileItem] = [
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
    @State private var showStatsModal = false
    @State private var followUpOpen: Bool = false
    // iPhone (compact): detalj-sidebaren presenteres som sheet i stedet
    // for side-stilt kolonne.
    @State private var phoneDetailOpen: Bool = false
    // Header: delt LeadgridTabHeader eier all popover/sheet-state selv.
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
    @State private var cardScannerOpen: Bool = false

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
        .sheet(isPresented: $cardScannerOpen) {
            // Visittkort → OCR → lead (backend fyrer lead.created →
            // welcome/intro-workflow). Refresh lista når sheeten lukkes.
            BusinessCardScannerView()
                .onDisappear { Task { await appState.refreshLeads() } }
        }
        .sheet(isPresented: $uploadOpen) {
            UploadFileSheet(lead: selectedLead)
        }
        // iPhone (compact): samme LeadDetailSidebar som iPad viser til
        // høyre, presentert som sheet. Egen wrapper med lokal sheet-state
        // slik at underliggende ark kan legges oppå dette sheetet.
        .sheet(isPresented: $phoneDetailOpen) {
            PhoneLeadDetailSheet(lead: selectedLead, tab: $detailTab)
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
                    // iPhone-QA: nederste innhold («+ Nytt lead»-pillen i
                    // tom-tilstand / pagineringen) lå halvt gjemt bak
                    // tab-baren — ekstra bunn-luft så alt kan scrolles helt
                    // fram (samme mønster som Salgsledelse i OversiktView).
                    // iPad har sidebar-layout uten dette problemet — urørt.
                    if DeviceIdiom.isPhone {
                        Color.clear.frame(height: 72)
                    }
                }
            }
            .frame(maxWidth: .infinity)

            // Detail sidebar høyre — tom-tilstand når ingen leads finnes.
            // iPhone (compact): 340pt side-stilt kolonne får ikke plass —
            // detaljene vises i stedet som sheet når en rad velges.
            if !DeviceIdiom.isPhone {
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
    }

    // MARK: Header — delt LeadgridTabHeader (fasit: Oversikt-fanen)

    /// Demo-aware datakilde for header-badges/popovers (samme gating som
    /// sourceLeads).
    private var headerLeads: [LeadModel] {
        DemoModeManager.isActiveNonisolated
            ? DemoModeManager.shared.mockLeads
            : appState.leads
    }

    private var header: some View {
        LeadgridTabHeader(
            subtitle: "Få full oversikt over alle dine leads og deres status.",
            leads: headerLeads)
    }

    // toolbarButton-helper fjernet — knappene er flyttet til søk-raden.

    // MARK: KPI-rad

    private var kpiRow: some View {
        // Alle idiomer (Daniel 2026-07-05): kompakt statistikk-knapp m/
        // kortene i modal — samme mønster på iPhone, iPad og Mac.
        statsButton
            .sheet(isPresented: $showStatsModal) { statsModal }
    }

    private var kpiCards: some View {
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
        return Group {
            kpiCard(.totalLeads,     icon: "person.3.fill",      iconColor: LdBrand.purple,      title: "Totalt leads", value: isDemo ? "1 248" : realValue(real.count), trend: isDemo ? "+18 %" : nil)
            kpiCard(.newLeads,       icon: "sparkles",           iconColor: LdBrand.green,       title: "Nye leads",    value: isDemo ? "842"   : realValue(real.filter { $0.createdAt >= weekAgo }.count), trend: isDemo ? "+16 %" : nil)
            kpiCard(.contacted,      icon: "phone.fill",         iconColor: LdBrand.blue,        title: "Kontaktet",    value: isDemo ? "542"   : realValue(real.filter { $0.status != .unvisited }.count), trend: isDemo ? "+11 %" : nil)
            kpiCard(.meetingsBooked, icon: "calendar",           iconColor: LdBrand.purpleLight, title: "Møter avtalt", value: isDemo ? "236"   : realValue(real.filter { $0.status == .meetingBooked }.count), trend: isDemo ? "+12 %" : nil)
            kpiCard(.won,            icon: "trophy.fill",        iconColor: LdBrand.yellow,      title: "Vunnet",       value: isDemo ? "68"    : realValue(real.filter { $0.status == .won }.count), trend: isDemo ? "+24 %" : nil)
        }
    }

    // ── iPhone: kompakt statistikk-knapp + modal ─────────────────────

    private var statsButton: some View {
        let isDemo = DemoModeManager.isActiveNonisolated
        let real = appState.leads
        let weekAgo = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        let leadsText = isDemo ? "1 248 leads" : "\(real.count) leads"
        let newCount = isDemo ? 842 : real.filter { $0.createdAt >= weekAgo }.count
        return Button {
            showStatsModal = true
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(LdBrand.purple.opacity(0.22))
                    Image(systemName: "chart.bar.fill")
                        // Fast 40pt-flis — ikonet skal ikke AX-skalere
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(LdBrand.purple)
                }
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Statistikk")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 6) {
                        Text(leadsText)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(LdBrand.textSecondary)
                        if newCount > 0 {
                            Text("+\(newCount) nye")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(LdBrand.green)
                        }
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(LdBrand.textSecondary)
            }
            .padding(14)
            .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14).stroke(LdBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var statsModal: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Statistikk")
                    .font(.appScaled(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 18)

                kpiCards
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
        .background(LdBrand.bg.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        // Kortene er drill-down-knapper — sheet må ligge PÅ modalen for at
        // KPIDetailSheet skal kunne presenteres oppå statistikk-modalen.
        .sheet(item: $kpiDrillDown) { kind in
            KPIDetailSheet(kind: kind)
        }
    }

    private func kpiCard(_ kind: KPIKind, icon: String, iconColor: Color, title: String, value: String, trend: String?) -> some View {
        Button { kpiDrillDown = kind } label: {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                ZStack {
                    Circle().fill(iconColor.opacity(0.22))
                    Image(systemName: icon)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(iconColor)
                }
                .frame(width: 28, height: 28)
                Text(title)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LdBrand.textSecondary)
                Spacer()
            }
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(value)
                    .font(.appScaled(size: 24, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                if let trend {
                    HStack(spacing: 2) {
                        Image(systemName: "arrow.up")
                            .font(.appScaled(size: 9, weight: .bold))
                        Text(trend)
                            .font(.appScaled(size: 10, weight: .bold))
                    }
                    .foregroundStyle(LdBrand.green)
                }
            }
            Text(trend == nil ? "Ingen data" : "vs. forrige periode")
                .font(.appScaled(size: 10))
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
        // iPhone: søkefelt + 5 chips + 4 knapper får ikke plass i én rad
        // på compact width — søkefeltet får egen linje og resten legges
        // i en horisontal scroller. iPad/Mac beholder én rad som før.
        Group {
            if DeviceIdiom.isPhone {
                VStack(spacing: 8) {
                    searchField
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            filterChipsRow
                            actionButtonsRow
                        }
                    }
                }
            } else {
                HStack(spacing: 8) {
                    searchField
                        .frame(maxWidth: .infinity)
                    filterChipsRow
                    actionButtonsRow
                }
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 7) {
            Image(systemName: "magnifyingglass")
                .font(.appScaled(size: 12))
                .foregroundStyle(LdBrand.textSecondary)
            TextField("", text: $search,
                      prompt: Text("Søk etter navn, selskap, bransje…")
                .foregroundColor(LdBrand.textTertiary))
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .font(.appScaled(size: 12))
                .focused($searchFieldFocused)
        }
        .padding(.horizontal, 10).padding(.vertical, 9)
        .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 9))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(LdBrand.stroke, lineWidth: 1))
    }

    @ViewBuilder
    private var filterChipsRow: some View {
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
    }

    @ViewBuilder
    private var actionButtonsRow: some View {
        Button { importOpen = true } label: {
            HStack(spacing: 5) {
                Image(systemName: "arrow.down.circle")
                    .font(.appScaled(size: 11, weight: .semibold))
                Text("Importer")
                    .font(.appScaled(size: 12, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(LdBrand.card, in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(LdBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)

        // Visittkort-skanner (2026-07-04): OCR → lead → lead.created-
        // workflow. Kjeden fantes (BusinessCardScannerView) men var
        // frakoblet etter tab-porten.
        Button { cardScannerOpen = true } label: {
            HStack(spacing: 5) {
                Image(systemName: "person.text.rectangle")
                    .font(.appScaled(size: 11, weight: .semibold))
                Text("Skann kort")
                    .font(.appScaled(size: 12, weight: .semibold))
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
                    .font(.appScaled(size: 11, weight: .semibold))
                Text("Eksporter")
                    .font(.appScaled(size: 12, weight: .semibold))
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
                    .font(.appScaled(size: 11, weight: .bold))
                Text("Nytt lead")
                    .font(.appScaled(size: 12, weight: .semibold))
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

    private func filterChip(label: String, active: Bool, badge: Int?,
                             isOpen: Binding<Bool>, icon: String? = nil) -> some View {
        Button { isOpen.wrappedValue.toggle() } label: {
            HStack(spacing: 5) {
                if let icon {
                    Image(systemName: icon)
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(active ? LdBrand.purpleLight : LdBrand.textSecondary)
                }
                Text(label)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                if let b = badge, b > 0 {
                    Text("\(b)")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(LdBrand.purple, in: Capsule())
                }
                Image(systemName: "chevron.down")
                    .font(.appScaled(size: 9, weight: .semibold))
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
            // iPhone: kolonne-headeren hører til den brede tabell-layouten
            // — kompakt-radene har ikke kolonner å overskrive.
            if !DeviceIdiom.isPhone { tableHeader }
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
                        onTap: {
                            selectedLeadID = lead.id
                            // iPhone: ingen side-stilt sidebar — åpne
                            // detaljene som sheet.
                            if DeviceIdiom.isPhone { phoneDetailOpen = true }
                        },
                        onCheck: {
                            if selectedRowIDs.contains(lead.id) {
                                selectedRowIDs.remove(lead.id)
                            } else {
                                selectedRowIDs.insert(lead.id)
                            }
                        },
                        onLogActivity: {
                            selectedLeadID = lead.id
                            logActivityOpen = true
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
                .font(.appScaled(size: 34, weight: .regular))
                .foregroundStyle(LdBrand.red.opacity(0.8))
            Text("Kunne ikke hente leads")
                .font(.appScaled(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text(message)
                .font(.appScaled(size: 12))
                .foregroundStyle(LdBrand.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 380)
                .lineLimit(3)
            if retryable {
                Button {
                    Task { await appState.refreshLeads() }
                } label: {
                    Label("Prøv igjen", systemImage: "arrow.clockwise")
                        .font(.appScaled(size: 12, weight: .semibold))
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
                .font(.appScaled(size: 34, weight: .regular))
                .foregroundStyle(LdBrand.textTertiary)
            Text("Ingen leads enda")
                .font(.appScaled(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text("Bruk «+ Nytt lead» eller skru på demo-modus i innstillinger for å se eksempeldata.")
                .font(.appScaled(size: 12))
                .foregroundStyle(LdBrand.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 380)
            Button {
                addLeadOpen = true
            } label: {
                Text("+ Nytt lead")
                    .font(.appScaled(size: 13, weight: .semibold))
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
            .font(.appScaled(size: 10, weight: .semibold))
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
                .font(.appScaled(size: 11))
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
                            .font(.appScaled(size: 12))
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
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                    Image(systemName: "chevron.down")
                        .font(.appScaled(size: 9))
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
                .font(.appScaled(size: 10, weight: .semibold))
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
                .font(.appScaled(size: 11, weight: .semibold))
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
    /// «Loggfør aktivitet» i radmenyen — parent velger raden og åpner
    /// LogActivitySheet (2026-07-17: wiret, var død knapp).
    let onLogActivity: () -> Void

    @Environment(AppState.self) private var appState
    /// Bump for å re-evaluere favoritt-label etter toggle (UserDefaults
    /// er ikke observerbar).
    @State private var favoriteTick = 0

    var body: some View {
        // iPhone (compact width): kolonnene får ikke plass side-ved-side —
        // render en enklere, stablet rad i stedet for full tabellrad.
        if DeviceIdiom.isPhone {
            compactBody
        } else {
            fullBody
        }
    }

    /// Kompakt rad for iPhone — logo + selskap/kontakt til venstre,
    /// verdi + status stablet til høyre. Gjenbruker feltene fra full-raden.
    private var compactBody: some View {
        Button(action: onTap) {
            // AXStack: på accessibility-størrelser stables verdi + status
            // under navnet i stedet for å klemme det til «Coop…» (AX5-QA).
            AXStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(lead.companyColor.opacity(0.20))
                    Image(systemName: "building.2.fill")
                        // Fast 36pt-flis — ikonet skal ikke AX-skalere
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(lead.companyColor)
                }
                .frame(width: 36, height: 36)

                VStack(alignment: .leading, spacing: 3) {
                    Text(lead.company)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .axLineLimit(1, ax: 2)
                    Text(lead.contactName.isEmpty ? lead.category : lead.contactName)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(LdBrand.textSecondary)
                        .axLineLimit(1, ax: 2)
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 4) {
                    Text("NOK \(formatThousands(lead.valueNok))")
                        .font(.appScaled(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                    statusBadge(lead.status)
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
        }
        .buttonStyle(.plain)
    }

    private var fullBody: some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                // Checkbox
                Button(action: onCheck) {
                    Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                        .font(.appScaled(size: 15))
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
                            .font(.appScaled(size: 14, weight: .semibold))
                            .foregroundStyle(lead.companyColor)
                    }
                    .frame(width: 36, height: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(lead.company)
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Text(lead.category)
                            .font(.appScaled(size: 10))
                            .foregroundStyle(LdBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Kontaktperson
                VStack(alignment: .leading, spacing: 2) {
                    Text(lead.contactName)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(lead.contactRole)
                        .font(.appScaled(size: 10))
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
                        .font(.appScaled(size: 12, weight: .bold, design: .rounded))
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
                            .font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(lead.ownerColor)
                    }
                    .frame(width: 24, height: 24)
                    Text(lead.ownerName)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                .frame(width: 110, alignment: .leading)

                // Neste oppfølging
                Text(lead.nextFollowUp ?? "–")
                    .font(.appScaled(size: 11, weight: lead.nextFollowUpOverdue ? .bold : .regular))
                    .foregroundStyle(lead.nextFollowUpOverdue ? LdBrand.red : .white)
                    .frame(width: 130, alignment: .leading)

                // Verdi
                Text("NOK \(formatThousands(lead.valueNok))")
                    .font(.appScaled(size: 11, weight: .semibold, design: .rounded))
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
                        // «Planlegg møte» fjernet 2026-07-17: var død knapp —
                        // ingen møte-bookingsflate tilgjengelig fra radmenyen.
                    }
                    Section("Lead-handlinger") {
                        Button { onLogActivity() } label: {
                            Label("Loggfør aktivitet", systemImage: "plus.circle.fill")
                        }
                        // «Endre status» kun for backend-rader — mock-rader
                        // (backendId == nil) har ingen ekte flate å oppdatere.
                        if let backendId = lead.backendId {
                            Menu {
                                ForEach(LeadTableRow.statusChoices, id: \.status) { choice in
                                    Button {
                                        changeStatus(backendId: backendId, choice: choice)
                                    } label: {
                                        Label(choice.status.label, systemImage: choice.status.icon)
                                    }
                                }
                                // .newLead utelatt 2026-07-17: har ingen
                                // meningsfull backend-status å mappe til.
                            } label: {
                                Label("Endre status", systemImage: "tag.fill")
                            }
                        }
                        if DemoModeManager.isActiveNonisolated {
                            // Demo-gated mock — navn uten backend-effekt.
                            Menu {
                                ForEach(["Kari Nordmann", "Mikkel Berg", "Anniken Sørli"], id: \.self) { n in
                                    Button {} label: { Label(n, systemImage: "person.crop.circle") }
                                }
                            } label: {
                                Label("Tilordne selger", systemImage: "person.2.fill")
                            }
                        } else if !TeamLiveStore.shared.memberDTOs.isEmpty || TeamLiveStore.shared.currentUserId != nil {
                            // 2026-07-17: wiret — sender ekte tildeling via
                            // /lead-assignments (samme API som Kart-fanens
                            // AssignToTeamMemberSheet).
                            Menu {
                                ForEach(TeamLiveStore.shared.memberDTOs) { dto in
                                    Button { assign(to: dto.userId) } label: {
                                        Label(dto.name, systemImage: "person.crop.circle")
                                    }
                                }
                                if let meId = TeamLiveStore.shared.currentUserId {
                                    Divider()
                                    Button { assign(to: meId) } label: {
                                        Label("Meg selv", systemImage: "person.crop.circle.fill")
                                    }
                                }
                            } label: {
                                Label("Tilordne selger", systemImage: "person.2.fill")
                            }
                        }
                        // 2026-07-17: wiret — favoritt persisteres i
                        // UserDefaults («leadFavoritter»).
                        Button { toggleFavorite() } label: {
                            let _ = favoriteTick // re-evaluer label etter toggle
                            Label(isFavorite ? "Fjern favoritt" : "Sett som favoritt",
                                  systemImage: isFavorite ? "star.slash.fill" : "star.fill")
                        }
                    }
                    // «Eksporter (CSV/PDF/.vcf)» + «Kopier lenke» fjernet
                    // 2026-07-17: var døde knapper — ingen eksport/lenke-flate
                    // per rad (Leads-fanen har egen eksport-sheet i headeren).
                    // «Arkiver» + «Slett lead» fjernet 2026-07-17: var døde
                    // knapper — destruktive handlinger uten bekreftelses-flyt
                    // eller API-støtte her.
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.appScaled(size: 12, weight: .semibold))
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

    // MARK: Radmeny-handlinger (2026-07-17: wiret — var døde knapper)

    /// Row-status → backend-kall. `.hot`/`.warm` er temperatur-felt,
    /// resten mapper til LeadModel.LeadStatus-rawValues (speiler
    /// LeadRow.init(from:)-mappingen). `.newLead` utelatt — ingen
    /// meningsfull backend-status.
    struct StatusChoice {
        let status: LeadRow.LeadStatus
        let temperature: String?   // updateTemperature når satt
        let backendStatus: String? // ellers updateStatus
    }
    static let statusChoices: [StatusChoice] = [
        .init(status: .hot, temperature: "hot", backendStatus: nil),
        .init(status: .warm, temperature: "warm", backendStatus: nil),
        .init(status: .interested, temperature: nil, backendStatus: "interested"),
        .init(status: .contacted, temperature: nil, backendStatus: "visited"),
        .init(status: .notContacted, temperature: nil, backendStatus: "unvisited"),
    ]

    private func changeStatus(backendId: String, choice: StatusChoice) {
        guard let api = appState.api else { return }
        Task {
            do {
                if let temp = choice.temperature {
                    try await api.updateTemperature(leadId: backendId, temperature: temp)
                } else if let st = choice.backendStatus {
                    try await api.updateStatus(leadId: backendId, status: st)
                }
                await appState.refreshLeads()
            } catch {
                print("[LeadTableRow] status-endring feilet: \(error)")
            }
        }
    }

    private func assign(to userId: String) {
        guard let api = appState.api else { return }
        let payload = LeadAssignmentPayload(
            leadId: lead.backendId,
            leadName: lead.company,
            leadLat: nil,
            leadLng: nil,
            assigneeUserId: userId,
            assigneeRole: "seller",
            priority: "normal",
            message: ""
        )
        Task {
            do {
                try await api.createLeadAssignment(payload)
                await appState.refreshLeads()
            } catch {
                print("[LeadTableRow] tildeling feilet: \(error)")
            }
        }
    }

    /// Favoritter lagres som Set av (backendId ?? company) i UserDefaults
    /// under «leadFavoritter».
    private static let favoritesKey = "leadFavoritter"
    private var favoriteToken: String { lead.backendId ?? lead.company }
    private var isFavorite: Bool {
        let favs = UserDefaults.standard.stringArray(forKey: Self.favoritesKey) ?? []
        return favs.contains(favoriteToken)
    }
    private func toggleFavorite() {
        var favs = Set(UserDefaults.standard.stringArray(forKey: Self.favoritesKey) ?? [])
        if favs.contains(favoriteToken) {
            favs.remove(favoriteToken)
        } else {
            favs.insert(favoriteToken)
        }
        UserDefaults.standard.set(Array(favs).sorted(), forKey: Self.favoritesKey)
        favoriteTick += 1
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
                .font(.appScaled(size: 9, weight: .bold))
            Text(st.label)
                .font(.appScaled(size: 10, weight: .bold))
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
                .font(.appScaled(size: 44, weight: .regular))
                .foregroundStyle(LdBrand.textTertiary)
            Text("Ingen lead valgt")
                .font(.appScaled(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text("Detaljer, kontaktinfo og pipeline-status vises her når du har valgt en lead.")
                .font(.appScaled(size: 12))
                .foregroundStyle(LdBrand.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Button {
                onAddLead()
            } label: {
                Text("+ Nytt lead")
                    .font(.appScaled(size: 13, weight: .semibold))
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

// MARK: - PhoneLeadDetailSheet (iPhone)

/// iPhone (compact): detalj-panelet vises som sheet i stedet for
/// side-stilt 340pt-kolonne. Egen lokal state for Loggfør/Oppfølging/
/// Last opp slik at de kan presenteres oppå dette sheetet uten å
/// kollidere med LeadsView sine body-nivå-sheets (som er blokkert så
/// lenge dette sheetet er åpent).
struct PhoneLeadDetailSheet: View {
    let lead: LeadRow
    @Binding var tab: LeadsView.DetailTab
    @State private var logActivityOpen: Bool = false
    @State private var followUpOpen: Bool = false
    @State private var uploadOpen: Bool = false

    var body: some View {
        LeadDetailSidebar(lead: lead, tab: $tab,
                          onLogActivity: { logActivityOpen = true },
                          onOpenFollowUp: { followUpOpen = true },
                          onUploadFile: { uploadOpen = true })
            .background(LdBrand.bg.ignoresSafeArea())
            .preferredColorScheme(.dark)
            .presentationDetents([.large])
            .sheet(isPresented: $logActivityOpen) {
                LogActivitySheet(lead: lead)
            }
            .sheet(isPresented: $followUpOpen) {
                FollowUpDetailSheet(lead: lead)
            }
            .sheet(isPresented: $uploadOpen) {
                UploadFileSheet(lead: lead)
            }
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
    // Tilbudssending (funn #7) — krever backend-lead + APIClient.
    @State private var showSendProposal: Bool = false
    // Tilbudshistorikk (2026-07-04) — hentes per lead i detaljer-fanen.
    @State private var proposals: [ProposalDTO] = []
    @Environment(AppState.self) private var appState
    @State private var actionToast: String?
    // Lokale notater for denne leaden (Notater-fanen i ekte modus).
    @State private var localNotes: [LeadNoteItem] = []
    // Re-evaluer favoritt-label/stjerne etter toggle.
    @State private var favoriteTick = 0

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
            // Workflow-QA 2026-07-05: onSave var toast-fasade — nå ekte
            // API-kall i ekte modus (LeadRow.id = crm_customers-uuid for
            // backend-rader). Demo: toast.
            LeadStatusChangeSheet(
                companyName: lead.company,
                companyColor: lead.companyColor,
                onSave: { newStatus, _ in
                    let leadId = lead.id.uuidString.lowercased()
                    if DemoModeManager.isActiveNonisolated {
                        actionToast = "Status endret til \(newStatus.label)"
                    } else if let api = appState.api {
                        Task {
                            do {
                                try await api.updateStatus(leadId: leadId, status: newStatus.apiValue)
                                actionToast = "Status endret til \(newStatus.label)"
                                await appState.refreshLeads()
                            } catch {
                                actionToast = "Kunne ikke endre status"
                            }
                        }
                    }
                },
                onSaveTemperature: { temp in
                    let leadId = lead.id.uuidString.lowercased()
                    if DemoModeManager.isActiveNonisolated {
                        actionToast = "Temperatur endret"
                    } else if let api = appState.api {
                        Task {
                            do {
                                try await api.updateTemperature(leadId: leadId, temperature: temp)
                                actionToast = "Temperatur endret"
                                await appState.refreshLeads()
                            } catch {
                                actionToast = "Kunne ikke endre temperatur"
                            }
                        }
                    }
                }
            )
        }
        .sheet(isPresented: $showLeadAssignSeller) {
            LeadAssignSellerSheet(
                companyName: lead.company,
                companyColor: lead.companyColor,
                currentSellerName: lead.ownerName
            ) { newSeller in
                // 2026-07-17: var toast-fasade — nå ekte tildeling via
                // /lead-assignments (samme payload som radmenyen). Demo-valg
                // (userId == nil) forblir toast.
                if let userId = newSeller.userId, let api = appState.api,
                   !DemoModeManager.isActiveNonisolated {
                    let payload = LeadAssignmentPayload(
                        leadId: lead.backendId,
                        leadName: lead.company,
                        leadLat: nil,
                        leadLng: nil,
                        assigneeUserId: userId,
                        assigneeRole: "seller",
                        priority: "normal",
                        message: ""
                    )
                    Task {
                        do {
                            try await api.createLeadAssignment(payload)
                            actionToast = "Tildelt \(newSeller.name)"
                            await appState.refreshLeads()
                        } catch {
                            actionToast = "Kunne ikke tildele"
                        }
                    }
                } else {
                    actionToast = "Tildelt \(newSeller.name)"
                }
            }
        }
        .sheet(isPresented: $showLeadNoteEditor) {
            LeadNoteSheet(
                companyName: lead.company,
                companyColor: lead.companyColor
            ) { text, _, pinned in
                // 2026-07-17: var toast-fasade — nå faktisk lagret (lokalt;
                // ingen backend-flate for lead-notater enda) og synlig i
                // Notater-fanen.
                LeadLocalNotes.add(body: text, pinned: pinned,
                                   author: appState.displayName,
                                   to: lead.backendId ?? lead.company)
                localNotes = LeadLocalNotes.notes(for: lead.backendId ?? lead.company)
                actionToast = "Notat lagret\(pinned ? " (festet)" : "")"
            }
        }
        .sheet(isPresented: $showLeadUploadFile) {
            UploadFileSheet(lead: lead)
        }
        .sheet(isPresented: $showSendProposal) {
            SendProposalSheet(
                leadId: lead.backendId ?? "",
                leadName: lead.company,
                leadEmail: lead.email,
                api: appState.api,
                onSent: {
                    actionToast = "Tilbud sendt til \(lead.company)"
                    Task { await loadProposals() }
                }
            )
        }
        // Arkiv-dialogen fjernet 2026-07-17: «Arkiver» var toast-fasade uten
        // API — dialogen lot som leaden ble flyttet til arkiv.
        .overlay(alignment: .top) {
            if let t = actionToast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
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
                    .font(.appScaled(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                // 2026-07-17: stjernen var statisk pynt — nå ekte favoritt-
                // toggle (samme UserDefaults-lager som radmenyen).
                Button { toggleFavorite() } label: {
                    let _ = favoriteTick
                    Image(systemName: isFavorite ? "star.fill" : "star")
                        .font(.appScaled(size: 13))
                        .foregroundStyle(isFavorite ? LdBrand.yellow : LdBrand.textTertiary)
                }
                .buttonStyle(.plain)
                Spacer()
                // Ellipsis-ikonet fjernet 2026-07-17: var dekorativt (så
                // klikkbart ut) — handlingsmenyen bor i action-baren nederst.
            }
            HStack(spacing: 5) {
                Image(systemName: lead.status.icon)
                    .font(.appScaled(size: 9, weight: .bold))
                Text(lead.status.label)
                    .font(.appScaled(size: 10, weight: .bold))
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
                        .font(.appScaled(size: 22, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("Lead score")
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    // 2026-07-17: «↑12»-trenden var mock også i ekte modus —
                    // score-historikk finnes ikke, så den vises kun i demo.
                    if lead.leadScore > 0 && DemoModeManager.isActiveNonisolated {
                        HStack(spacing: 3) {
                            Image(systemName: "arrow.up")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text("12")
                                .font(.appScaled(size: 12, weight: .bold))
                        }
                        .foregroundStyle(LdBrand.green)
                    } else if lead.leadScore == 0 {
                        Text("Ingen score enda")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(LdBrand.textSecondary)
                    }
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
                    .font(.appScaled(size: 12, weight: isSelected ? .bold : .semibold))
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
            proposalsSection
            metaSection
        }
    }

    // MARK: Tilbud (2026-07-04) — historikk fra /leads/:id/proposals

    private var proposalsSection: some View {
        Group {
            if lead.backendId != nil && !proposals.isEmpty {
                VStack(alignment: .leading, spacing: 9) {
                    sectionTitle("Tilbud")
                    ForEach(proposals) { p in
                        proposalRow(p)
                    }
                }
            }
        }
        .task(id: lead.backendId) {
            await loadProposals()
        }
    }

    private func proposalRow(_ p: ProposalDTO) -> some View {
        let (label, color): (String, Color) = {
            switch p.status {
            case "opened":   return ("Åpnet", LdBrand.blue)
            case "accepted": return ("Akseptert", LdBrand.green)
            case "rejected": return ("Avslått", LdBrand.red)
            case "expired":  return ("Utløpt", LdBrand.textTertiary)
            default:         return ("Sendt", LdBrand.orange)
            }
        }()
        return HStack(spacing: 9) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(color.opacity(0.20))
                Image(systemName: "doc.text.fill")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(p.title)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("NOK \(formatThousands(Int(p.totalAmountNok))) eks. mva.")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(LdBrand.textSecondary)
            }
            Spacer()
            // Utfall settes via meny når tilbudet er åpnet/sendt.
            if p.status == "sent" || p.status == "opened" {
                Menu {
                    Button { Task { await setProposalStatus(p, "accepted") } } label: {
                        Label("Marker som akseptert", systemImage: "checkmark.seal.fill")
                    }
                    Button(role: .destructive) { Task { await setProposalStatus(p, "rejected") } } label: {
                        Label("Marker som avslått", systemImage: "xmark.seal")
                    }
                } label: {
                    statusChip(label, color)
                }
                .buttonStyle(.plain)
            } else {
                statusChip(label, color)
            }
        }
        .padding(9)
        .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    private func statusChip(_ label: String, _ color: Color) -> some View {
        Text(label)
            .font(.appScaled(size: 10, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(color.opacity(0.16), in: Capsule())
    }

    private func loadProposals() async {
        guard let backendId = lead.backendId, let api = appState.api else {
            proposals = []
            return
        }
        proposals = (try? await api.fetchProposals(leadId: backendId)) ?? []
    }

    private func setProposalStatus(_ p: ProposalDTO, _ status: String) async {
        guard let api = appState.api else { return }
        try? await api.updateProposalStatus(id: p.id, status: status)
        actionToast = status == "accepted" ? "Tilbud markert som akseptert" : "Tilbud markert som avslått"
        await loadProposals()
    }

    // MARK: Status/favoritt-helpers (2026-07-17 — speiler radmenyens wiring)

    private func changeStatus(backendId: String, choice: LeadTableRow.StatusChoice) {
        guard let api = appState.api else { return }
        Task {
            do {
                if let temp = choice.temperature {
                    try await api.updateTemperature(leadId: backendId, temperature: temp)
                } else if let st = choice.backendStatus {
                    try await api.updateStatus(leadId: backendId, status: st)
                }
                actionToast = "Status endret til \(choice.status.label)"
                await appState.refreshLeads()
            } catch {
                actionToast = "Kunne ikke endre status"
            }
        }
    }

    private func markAsWon(backendId: String) {
        guard let api = appState.api else { return }
        Task {
            do {
                try await api.updateStatus(leadId: backendId, status: "won")
                actionToast = "\(lead.company) markert som vunnet 🏆"
                await appState.refreshLeads()
            } catch {
                actionToast = "Kunne ikke markere som vunnet"
            }
        }
    }

    /// Delt favoritt-lager med radmenyen («leadFavoritter», backendId ?? company).
    private var favoriteToken: String { lead.backendId ?? lead.company }
    private var isFavorite: Bool {
        (UserDefaults.standard.stringArray(forKey: "leadFavoritter") ?? [])
            .contains(favoriteToken)
    }
    private func toggleFavorite() {
        var favs = Set(UserDefaults.standard.stringArray(forKey: "leadFavoritter") ?? [])
        if favs.contains(favoriteToken) { favs.remove(favoriteToken) } else { favs.insert(favoriteToken) }
        UserDefaults.standard.set(Array(favs).sorted(), forKey: "leadFavoritter")
        favoriteTick += 1
    }

    private var kontaktSection: some View {
        VStack(alignment: .leading, spacing: 9) {
            sectionTitle("Kontaktperson")
            // Initialene var hardkodet «JE» og navnet ble tomt for backend-
            // leads — nå ekte initialer, og ærlig tom-tilstand uten navn.
            if lead.contactName.isEmpty {
                Text("Ingen kontaktperson registrert")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LdBrand.textSecondary)
            } else {
                HStack(spacing: 10) {
                    ZStack {
                        Circle().fill(LdBrand.purple.opacity(0.30))
                        Text(LeadRow.initials(for: lead.contactName))
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(LdBrand.purpleLight)
                    }
                    .frame(width: 38, height: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(lead.contactName)
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        if !lead.contactRole.isEmpty {
                            Text(lead.contactRole)
                                .font(.appScaled(size: 11))
                                .foregroundStyle(LdBrand.textSecondary)
                        }
                    }
                    Spacer()
                }
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
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(color)
            }
            .frame(width: 26, height: 26)
            Text(text)
                .font(.appScaled(size: 11))
                .foregroundStyle(.white)
                .lineLimit(1)
            Spacer()
        }
    }

    private var companySection: some View {
        VStack(alignment: .leading, spacing: 9) {
            sectionTitle("Om selskapet")
            // QA-runde 2: radene var hardkodet mock («Elektroinstallasjon /
            // Oslo / 25-50») for ALLE leads — nå ekte kategori, og mock kun
            // i demo-modus.
            if DemoModeManager.isActiveNonisolated {
                metaRow("Bransje", "Elektroinstallasjon")
                metaRow("Sted", "Oslo, Norge")
                metaRow("Ansatte", "25-50")
                metaRow("Omsetning", "10-20 mill. NOK")
            } else {
                metaRow("Bransje", lead.category == "—" ? "Ikke kategorisert" : lead.category)
                metaRow("Eier", lead.ownerName)
            }
            // «Se mer informasjon» fjernet 2026-07-17: var død knapp — det
            // finnes ingen utvidet selskaps-flate bak (all info vises alt her).
        }
    }

    private func metaRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.appScaled(size: 11))
                .foregroundStyle(LdBrand.textSecondary)
            Spacer()
            Text(value)
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(.white)
        }
    }

    // Pipeline

    private var pipelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Status i pipelinen")
            let stages = ["Ny lead", "Kontaktet", "Møte\navtalt", "Tilbud\nsendt", "Vunnet"]
            // QA-runde 2: steget var hardkodet til «Møte avtalt» for alle
            // leads — nå avledet fra faktisk status.
            let current: Int = {
                switch lead.status {
                case .newLead, .notContacted: return 0
                case .interested, .contacted, .warm: return 1
                case .hot: return 2
                }
            }()
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
                                    .font(.appScaled(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                            } else if i == current {
                                Circle().fill(.white).frame(width: 6, height: 6)
                            }
                        }
                        .frame(width: 18, height: 18)
                        Text(stages[i])
                            .font(.appScaled(size: 9, weight: i == current ? .bold : .regular))
                            .foregroundStyle(i <= current ? .white : LdBrand.textTertiary)
                            .multilineTextAlignment(.center)
                            // «Kontaktet» brakk til «Kontakte / t» på iPhone
                            // — skalér ned i stedet for å ordbryte.
                            .lineLimit(2)
                            .minimumScaleFactor(0.75)
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
            // Delings-ikonet fjernet 2026-07-17: var dekorativt (så klikkbart
            // ut, ingen handling).
            sectionTitle("Neste oppfølging")
            HStack(spacing: 7) {
                Image(systemName: "calendar")
                    .font(.appScaled(size: 10))
                    // Rød er alarm-farge — kun når noe faktisk haster
                    // (overforfalt), ikke for «ikke planlagt».
                    .foregroundStyle(lead.nextFollowUpOverdue ? LdBrand.red : LdBrand.textSecondary)
                Text(lead.nextFollowUp ?? "Ikke planlagt")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                if lead.nextFollowUpOverdue {
                    Text("Overforfalt")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(LdBrand.red)
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(LdBrand.red.opacity(0.18), in: Capsule())
                        .overlay(Capsule().stroke(LdBrand.red.opacity(0.4), lineWidth: 1))
                }
            }
            // Mock-beskrivelsen vises kun i demo-modus — ekte leads har
            // ingen oppfølgings-beskrivelse i dette feltet.
            if DemoModeManager.isActiveNonisolated {
                Text("Telefonmøte med Jonas Eide")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LdBrand.textSecondary)
            }
            Button { onOpenFollowUp() } label: {
                Text("Åpne oppfølging")
                    .font(.appScaled(size: 12, weight: .semibold))
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
                    .font(.appScaled(size: 10))
                    .foregroundStyle(LdBrand.textSecondary)
                Text("NOK \(formatThousands(lead.valueNok))")
                    .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                // 2026-07-17: «Høy» sannsynlighet var mock også i ekte modus —
                // ingen sannsynlighets-modell bak; vises kun i demo.
                if lead.valueNok > 0 && DemoModeManager.isActiveNonisolated {
                    Text("Høy")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(LdBrand.green)
                }
            }
            Spacer()
            // QA-runde 2: selgeren var hardkodet «Kari Nordmann» for alle
            // leads — nå faktisk eier fra tildelingen.
            HStack(spacing: 6) {
                ZStack {
                    Circle().fill(lead.ownerColor.opacity(0.30))
                    Text(lead.ownerInitials)
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(lead.ownerColor)
                }
                .frame(width: 28, height: 28)
                VStack(alignment: .leading, spacing: 1) {
                    Text(lead.ownerName)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Selger")
                        .font(.appScaled(size: 9))
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
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                // «Filtrer» fjernet 2026-07-17: var død knapp — ingen
                // filter-flate for aktivitetslisten.
            }
            if LeadsData.activities.isEmpty {
                detailEmptyState(icon: "clock.arrow.circlepath", text: "Ingen aktiviteter registrert enda")
            } else {
                VStack(spacing: 6) {
                    ForEach(LeadsData.activities) { a in
                        activityRow(a)
                    }
                }
            }
        }
    }

    /// Ærlig tom-tilstand for detalj-tabs når det ikke finnes ekte data (ikke-demo).
    private func detailEmptyState(icon: String, text: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.appScaled(size: 22, weight: .semibold))
                .foregroundStyle(LdBrand.textTertiary)
            Text(text)
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(LdBrand.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    private func activityRow(_ a: LeadActivityItem) -> some View {
        HStack(alignment: .top, spacing: 9) {
            ZStack {
                Circle().fill(a.color.opacity(0.20))
                Image(systemName: a.icon)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(a.color)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(a.title)
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(a.timestamp)
                        .font(.appScaled(size: 9))
                        .foregroundStyle(LdBrand.textTertiary)
                }
                Text(a.subtitle)
                    .font(.appScaled(size: 10))
                    .foregroundStyle(LdBrand.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(9)
        .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    // MARK: Notater-tab

    /// Demo: mock-notater. Ekte: lokalt lagrede notater for denne leaden.
    private var displayNotes: [LeadNoteItem] {
        DemoModeManager.isActiveNonisolated ? LeadsData.notes : localNotes
    }

    private var notesTab: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 2026-07-17: compose-raden var død + initialene hardkodet «LK» —
            // nå åpner den notat-editoren og viser innlogget brukers initialer.
            Button { showLeadNoteEditor = true } label: {
                HStack(spacing: 7) {
                    ZStack {
                        Circle().fill(LdBrand.purple.opacity(0.25))
                        Text(LeadRow.initials(for: appState.displayName))
                            .font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(LdBrand.purpleLight)
                    }
                    .frame(width: 26, height: 26)
                    Image(systemName: "square.and.pencil")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(LdBrand.textTertiary)
                    Text("Skriv et notat…")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(LdBrand.textTertiary)
                    Spacer()
                }
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(LdBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            if displayNotes.isEmpty {
                detailEmptyState(icon: "note.text", text: "Ingen notater enda")
            } else {
                ForEach(displayNotes) { n in
                    noteRow(n)
                }
            }
        }
        .task(id: lead.id) {
            localNotes = LeadLocalNotes.notes(for: lead.backendId ?? lead.company)
        }
    }

    private func noteRow(_ n: LeadNoteItem) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                ZStack {
                    Circle().fill(n.authorColor.opacity(0.25))
                    Text(n.initials)
                        .font(.appScaled(size: 8, weight: .bold))
                        .foregroundStyle(n.authorColor)
                }
                .frame(width: 22, height: 22)
                Text(n.author)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
                if n.pinned {
                    Image(systemName: "pin.fill")
                        .font(.appScaled(size: 8))
                        .foregroundStyle(LdBrand.yellow)
                }
                Spacer()
                Text(n.timestamp)
                    .font(.appScaled(size: 9))
                    .foregroundStyle(LdBrand.textTertiary)
            }
            Text(n.body)
                .font(.appScaled(size: 11))
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
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(LdBrand.textSecondary)
                Spacer()
                Button { onUploadFile() } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus.circle.fill")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text("Last opp")
                            .font(.appScaled(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(LdBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            if LeadsData.files.isEmpty {
                detailEmptyState(icon: "tray", text: "Ingen filer lastet opp enda")
            } else {
                ForEach(LeadsData.files) { f in
                    fileRow(f)
                }
            }
        }
    }

    // 2026-07-17: Button-wrapperen fjernet — raden var død knapp (filene er
    // demo-mock; nedlasting har ingen flate). Ren datavisning nå.
    private func fileRow(_ f: LeadFileItem) -> some View {
            HStack(spacing: 9) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(f.kind.color.opacity(0.22))
                    Image(systemName: f.kind.icon)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(f.kind.color)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text(f.name)
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        Text(f.size)
                            .font(.appScaled(size: 9))
                            .foregroundStyle(LdBrand.textSecondary)
                        Text("·")
                            .font(.appScaled(size: 9))
                            .foregroundStyle(LdBrand.textTertiary)
                        Text(f.uploadedAt)
                            .font(.appScaled(size: 9))
                            .foregroundStyle(LdBrand.textTertiary)
                    }
                }
                Spacer()
            }
            .padding(8)
            .background(LdBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    // MARK: Action-bar bunn

    private var actionBar: some View {
        HStack(spacing: 8) {
            Button { onLogActivity() } label: {
                HStack(spacing: 5) {
                    Image(systemName: "plus.circle.fill")
                        .font(.appScaled(size: 11, weight: .bold))
                    Text("Loggfør aktivitet")
                        .font(.appScaled(size: 12, weight: .bold))
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
                    // Tilbudssending (funn #7) — kun for backend-leads
                    // (mock-rader har ingen crm-id å knytte tilbudet til).
                    if lead.backendId != nil {
                        Button { showSendProposal = true } label: {
                            Label("Send tilbud", systemImage: "doc.text.fill")
                        }
                    }
                    // «Planlegg møte» + «Start video-møte» fjernet 2026-07-17:
                    // var døde knapper — ingen bookingsflate herfra (møter
                    // bookes fra Møter-fanen).
                }
                Section("Lead-handlinger") {
                    // Hurtig-statusene var døde 2026-07-17 — nå samme wiring
                    // som radmenyen (temperatur/status + refresh), kun for
                    // backend-leads. Detaljert editor var alt wiret.
                    Menu {
                        if let backendId = lead.backendId {
                            ForEach(LeadTableRow.statusChoices, id: \.status) { choice in
                                Button {
                                    changeStatus(backendId: backendId, choice: choice)
                                } label: {
                                    Label(choice.status.label, systemImage: choice.status.icon)
                                }
                            }
                            Divider()
                        }
                        Button { showLeadStatusChange = true } label: {
                            Label("Åpne detaljert status-editor…", systemImage: "square.and.pencil")
                        }
                    } label: {
                        Label("Endre status", systemImage: "tag.fill")
                    }
                    Button { showLeadAssignSeller = true } label: {
                        Label("Tilordne selger", systemImage: "person.2.fill")
                    }
                    // 2026-07-17: wiret — delt favoritt-lager med radmenyen.
                    Button { toggleFavorite() } label: {
                        let _ = favoriteTick
                        Label(isFavorite ? "Fjern favoritt" : "Sett som favoritt",
                              systemImage: isFavorite ? "star.slash.fill" : "star.fill")
                    }
                    // 2026-07-17: wiret — «won» er gyldig backend-status
                    // (samme katalog som status-editoren).
                    if let backendId = lead.backendId {
                        Button { markAsWon(backendId: backendId) } label: {
                            Label("Marker som vunnet", systemImage: "trophy.fill")
                        }
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
                // «Avansert»-seksjonen (slå sammen/eksporter/del/kopier lenke)
                // fjernet 2026-07-17: alle var døde knapper uten flater.
                // «Arkiver lead» fjernet 2026-07-17: bekreftelsesdialogen var
                // toast-fasade uten API. «Slett lead» fjernet: destruktiv uten
                // backend-støtte.
            } label: {
                HStack(spacing: 4) {
                    Text("Flere handlinger")
                        .font(.appScaled(size: 12, weight: .semibold))
                    Image(systemName: "chevron.down")
                        .font(.appScaled(size: 9))
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
            .font(.appScaled(size: 11, weight: .bold))
            .foregroundStyle(.white)
    }
}
