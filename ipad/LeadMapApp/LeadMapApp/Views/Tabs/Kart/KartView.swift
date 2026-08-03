// KartView.swift
//
// Pixel-perfect Leadgrid kartview matchende mockup (2026-06-29 v2):
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Kart-tittel                       [Ruteplanlegger][+ Legg til]│
//   │ Underskrift                                                  │
//   │ [Søk]  [Alle områder ▾] [Alle typer ▾] [Status ▾] [Filtre ▾] │
//   ├──────────────────────────────────────────┬───────────────────┤
//   │                                          │ Leads i området   │
//   │   MAPVIEW m/ pins (klynger + single)     │ (82)  Nær meg ▾   │
//   │   + zoom-FAB-stack bunn-venstre          │ ─────────────     │
//   │   ──────────────────────────────         │ Lead-rader        │
//   │   Status-legend (separat rad)            │                   │
//   ├──────────────────────────────────────────┤ Aktivitetshistorikk│
//   │ Valgt lead-detail (m/ tabs)              │                   │
//   └──────────────────────────────────────────┴───────────────────┘

import SwiftUI
import MapKit
import AVFoundation

// MARK: - Brand-konstanter
private enum KrBrand {
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

// MARK: - Pin shapes

fileprivate struct KartDropPin: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let w = rect.width, h = rect.height, r = w / 2
        p.addArc(center: CGPoint(x: w/2, y: r), radius: r,
                 startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false)
        p.addQuadCurve(to: CGPoint(x: w/2, y: h),
                       control: CGPoint(x: w * 0.85, y: h * 0.65))
        p.addQuadCurve(to: CGPoint(x: 0, y: r),
                       control: CGPoint(x: w * 0.15, y: h * 0.65))
        p.closeSubpath()
        return p
    }
}

fileprivate struct KartGlowHalo: View {
    let color: Color
    var body: some View {
        ZStack {
            Circle().fill(RadialGradient(colors: [color.opacity(0.55), color.opacity(0.0)],
                center: .center, startRadius: 18, endRadius: 48))
                .frame(width: 96, height: 96).blur(radius: 6)
            Circle().fill(RadialGradient(colors: [color.opacity(0.85), color.opacity(0.1)],
                center: .center, startRadius: 8, endRadius: 28))
                .frame(width: 56, height: 56).blur(radius: 2)
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Mockup-data

struct MapLeadMock: Identifiable, Hashable {
    /// Stabil id: ekte leads bruker LeadModel.id (adapteren), mock-leads
    /// får UUID. `let id = UUID()` ga ny identitet per adapt-kall →
    /// ForEach-churn + selection som aldri matchet.
    var id: String = UUID().uuidString
    let name: String
    let address: String
    let kmAway: Double
    let status: PinStatus
    let lastActivity: String?
    let lat: Double
    let lon: Double
    // Ekte felter fra LeadModel (adapteren fyller; mock-rader har nil).
    var phone: String? = nil
    var email: String? = nil
    var estimatedValue: Double? = nil
    var aiScore: Int? = nil

    /// Kontakt m/ demo-fallback: ekte lead-data vinner; demo-modus får
    /// visningsverdier så flyten kan demonstreres; ekte modus uten data → nil
    /// (handlingen skjules — ærlig i stedet for å ringe et påfunnet nummer).
    var phoneOrDemo: String? {
        phone ?? (DemoModeManager.isActiveNonisolated ? "+47 911 22 333" : nil)
    }
    var emailOrDemo: String? {
        email ?? (DemoModeManager.isActiveNonisolated ? "post@nordicelektro.no" : nil)
    }

    enum PinStatus: String, Hashable, CaseIterable {
        case hot, warm, new, customer, meeting, followup
        var label: String {
            switch self {
            case .hot:       return "Hot lead"
            case .warm:      return "Varm lead"
            case .new:       return "Ny lead"
            case .customer:  return "Kunde"
            case .meeting:   return "Møte"
            case .followup:  return "Oppfølging"
            }
        }
        var color: Color {
            switch self {
            case .hot:       return KrBrand.red
            case .warm:      return KrBrand.orange
            case .new:       return KrBrand.purple
            case .customer:  return KrBrand.green
            case .meeting:   return KrBrand.blue
            case .followup:  return KrBrand.blue
            }
        }
        var icon: String {
            switch self {
            case .hot:       return "flame.fill"
            case .warm:      return "flame"
            case .new:       return "sparkles"
            case .customer:  return "checkmark.seal.fill"
            case .meeting:   return "calendar"
            case .followup:  return "calendar.badge.clock"
            }
        }
    }
}

struct MapClusterMock: Identifiable, Hashable {
    let id = UUID()
    let count: Int
    let color: Color
    let lat: Double
    let lon: Double
}

struct ActivityItemMock: Identifiable, Hashable {
    let id = UUID()
    let icon: String
    let label: String
    let timestamp: String
}

enum AreaFilter: String, CaseIterable, Hashable {
    case all = "Alle områder"
    case oslo = "Oslo"
    case viken = "Viken"
    case bergen = "Bergen"
    case trondheim = "Trondheim"
    case stavanger = "Stavanger"
    case nearMe = "Nær meg"
    var icon: String {
        switch self {
        case .all:        return "globe"
        case .oslo:       return "building.2.fill"
        case .viken:      return "map.fill"
        case .bergen:     return "water.waves"
        case .trondheim:  return "snowflake"
        case .stavanger:  return "fuelpump.fill"
        case .nearMe:     return "location.fill"
        }
    }
}

enum Industries {
    static let all: [(String, String, Color)] = [
        ("Elektro",          "bolt.fill",            Color(red: 0.98, green: 0.75, blue: 0.14)),
        ("Bygg & anlegg",    "hammer.fill",          Color(red: 0.98, green: 0.55, blue: 0.10)),
        ("Helsetech",        "stethoscope",          Color(red: 0.20, green: 0.85, blue: 0.60)),
        ("B2B SaaS",         "laptopcomputer",       Color(red: 0.66, green: 0.32, blue: 0.99)),
        ("Detaljhandel",     "bag.fill",             Color(red: 0.34, green: 0.60, blue: 0.98)),
        ("Restaurant",       "fork.knife",           Color(red: 0.95, green: 0.20, blue: 0.20)),
        ("Konsulent",        "briefcase.fill",       Color(red: 0.75, green: 0.45, blue: 1.0)),
        ("Foto/Video",       "camera.fill",          Color(red: 0.20, green: 0.78, blue: 0.45)),
        ("Industri",         "gear.badge.checkmark", Color.gray),
        ("Eiendom",          "house.fill",           Color(red: 0.98, green: 0.75, blue: 0.14)),
        ("Transport",        "truck.box.fill",       Color(red: 0.34, green: 0.60, blue: 0.98)),
        ("Energi",           "leaf.fill",            Color(red: 0.20, green: 0.85, blue: 0.60)),
    ]
}

struct NoteItemMock: Identifiable, Hashable {
    let id = UUID()
    let author: String
    let authorInitials: String
    let authorColor: Color
    let body: String
    let timestamp: String
    let pinned: Bool
}

struct FileItemMock: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let kind: FileKind
    let size: String
    let uploadedAt: String

    enum FileKind: Hashable {
        case pdf, image, doc, spreadsheet, video
        var icon: String {
            switch self {
            case .pdf:         return "doc.fill"
            case .image:       return "photo.fill"
            case .doc:         return "doc.text.fill"
            case .spreadsheet: return "tablecells.fill"
            case .video:       return "play.rectangle.fill"
            }
        }
        var color: Color {
            switch self {
            case .pdf:         return KrBrand.red
            case .image:       return KrBrand.green
            case .doc:         return KrBrand.blue
            case .spreadsheet: return KrBrand.yellow
            case .video:       return KrBrand.purpleLight
            }
        }
    }
}

// Mock-data for pass-2 overlays
struct AILeadSuggestion: Identifiable {
    let id = UUID()
    let name: String
    let lat: Double
    let lon: Double
    let reason: String
    let score: Int
}

struct TerritoryPolygon: Identifiable {
    let id = UUID()
    let name: String
    let owner: String
    let color: Color
    let coordinates: [CLLocationCoordinate2D]
}

enum OverlayData {
    /// Mock AI-forslag — KUN i demo-modus. Ellers tegnes ingenting selv om
    /// overlayet er slått på (ærlig tomt kart i stedet for falske pins).
    static var aiLeads: [AILeadSuggestion] {
        DemoModeManager.isActiveNonisolated ? _aiLeads : []
    }
    private static let _aiLeads: [AILeadSuggestion] = [
        AILeadSuggestion(name: "Tech Norge AS", lat: 59.913, lon: 10.745,
                         reason: "Lignende kunde vant for 14 dager siden", score: 88),
        AILeadSuggestion(name: "Helsenor AS", lat: 59.921, lon: 10.770,
                         reason: "Ny bygg-tillatelse + finansiering klar", score: 76),
        AILeadSuggestion(name: "Bygg & Co", lat: 59.916, lon: 10.785,
                         reason: "Konkurrent har gått fra dem", score: 92),
    ]

    // Mockede besøk i dag (sorterte etter tid) — KUN i demo-modus.
    static var travelHistory: [CLLocationCoordinate2D] {
        DemoModeManager.isActiveNonisolated ? _travelHistory : []
    }
    private static let _travelHistory: [CLLocationCoordinate2D] = [
        CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522),  // start: Storgata
        CLLocationCoordinate2D(latitude: 59.9252, longitude: 10.7641),  // Sofienberg
        CLLocationCoordinate2D(latitude: 59.9123, longitude: 10.7741),  // Tøyen
        CLLocationCoordinate2D(latitude: 59.9094, longitude: 10.7560),  // Bjørvika
    ]

    /// Mock-territorier — KUN i demo-modus.
    static var territories: [TerritoryPolygon] {
        DemoModeManager.isActiveNonisolated ? _territories : []
    }
    private static let _territories: [TerritoryPolygon] = [
        // Min territory: Sentrum + Frogner (lilla)
        TerritoryPolygon(
            name: "Mitt", owner: "Lars",
            color: Color(red: 0.66, green: 0.32, blue: 0.99),
            coordinates: [
                CLLocationCoordinate2D(latitude: 59.920, longitude: 10.708),
                CLLocationCoordinate2D(latitude: 59.925, longitude: 10.745),
                CLLocationCoordinate2D(latitude: 59.911, longitude: 10.760),
                CLLocationCoordinate2D(latitude: 59.905, longitude: 10.722),
            ]
        ),
        // Mikkel: Grünerløkka
        TerritoryPolygon(
            name: "Mikkel", owner: "Mikkel",
            color: Color(red: 0.20, green: 0.85, blue: 0.60),
            coordinates: [
                CLLocationCoordinate2D(latitude: 59.928, longitude: 10.755),
                CLLocationCoordinate2D(latitude: 59.935, longitude: 10.775),
                CLLocationCoordinate2D(latitude: 59.925, longitude: 10.790),
                CLLocationCoordinate2D(latitude: 59.920, longitude: 10.762),
            ]
        ),
        // Udekket: Haugerud
        TerritoryPolygon(
            name: "Udekket", owner: "—",
            color: Color.gray.opacity(0.7),
            coordinates: [
                CLLocationCoordinate2D(latitude: 59.922, longitude: 10.790),
                CLLocationCoordinate2D(latitude: 59.918, longitude: 10.810),
                CLLocationCoordinate2D(latitude: 59.908, longitude: 10.798),
                CLLocationCoordinate2D(latitude: 59.913, longitude: 10.776),
            ]
        ),
    ]
}

enum KartPreviewData {
    /// Pakke 10.1 — demo-mode-gated
    private static let _leads: [MapLeadMock] = [
        MapLeadMock(name: "Nordic Elektro AS",      address: "Storgata 12, 0184 Oslo",       kmAway: 0.4, status: .hot,     lastActivity: "i dag 10:00", lat: 59.9139, lon: 10.7522),
        MapLeadMock(name: "Byggmester Hansen AS",   address: "Sofienberggata 15, 0558 Oslo", kmAway: 1.2, status: .warm,    lastActivity: "i dag 11:30", lat: 59.9252, lon: 10.7641),
        MapLeadMock(name: "Energi & Miljø AS",      address: "Tøyengata 24, 0578 Oslo",      kmAway: 1.6, status: .warm,    lastActivity: "i dag 14:00", lat: 59.9123, lon: 10.7741),
        MapLeadMock(name: "Oslo Tech AS",           address: "Dronning Eufemias gate 8",     kmAway: 2.1, status: .customer, lastActivity: "i går 16:45", lat: 59.9094, lon: 10.7560),
        MapLeadMock(name: "Kreativ Studio AS",      address: "Biskop Gunnerus' gate 14",     kmAway: 2.4, status: .new,     lastActivity: "2 dager siden", lat: 59.9116, lon: 10.7503),
    ]

    /// Demo-mode-gated leads. **Kilde: DemoModeManager.mockLeads** (adapted
    /// fra `LeadModel` — samme kilde som Oversikt-fanens mini-kart bruker),
    /// så pins er identiske på tvers av faner. `_leads` beholdes kun som
    /// krasj-safe fallback for `@State`-init.
    @MainActor
    static var leads: [MapLeadMock] {
        guard DemoModeManager.shared.isActive else { return [] }
        return DemoModeManager.shared.mockLeads.map(Self.adapt)
    }

    /// Krasj-safe fallback for `@State`-init: alltid en ekte mock-lead
    /// (fra hardkodet _leads) så SwiftUI-init aldri traff `[]` [0]-krasj.
    static var firstOrPlaceholder: MapLeadMock {
        _leads[0]
    }

    /// LeadModel → MapLeadMock adapter. Mapper status til PinStatus og
    /// bygger opp fallback-strenger for address/lastActivity.
    ///
    /// @MainActor fordi vi leser user-location for å beregne avstand.
    /// Kalles kun fra main-actor-kontekster (`leads` + `kartLeads`).
    @MainActor
    static func adapt(_ lm: LeadModel) -> MapLeadMock {
        let pin: MapLeadMock.PinStatus
        switch lm.status {
        case .proposalSent:                    pin = .hot
        case .interested, .visited:            pin = .warm
        case .meetingBooked:                   pin = .meeting
        case .return:                          pin = .followup
        case .won:                             pin = .customer
        default:                               pin = .new
        }
        let addr: String = {
            let parts = [lm.address, lm.postalCode, lm.city].compactMap { $0 }
            return parts.isEmpty ? "Ukjent adresse" : parts.joined(separator: ", ")
        }()
        let last: String? = lm.nextAction ?? (lm.lastVisitAt.map { _ in "Sist besøkt" })
        // Avstand fra brukerens posisjon. Bruker ekte user-location når
        // tilgjengelig, ellers Oslo-sentrum-fallback (samme konvensjon som
        // `centerOnMe()`), så lista aldri viser villedende «0.0 km» for alle.
        let me = KartLocationManager.shared.currentCoordinate
            ?? CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522)
        let leadCoord = CLLocationCoordinate2D(latitude: lm.latitude, longitude: lm.longitude)
        let km = LocationService.shared.distanceMeters(from: me, to: leadCoord) / 1000
        return MapLeadMock(
            id: lm.id,  // stabil identitet på tvers av re-adapt
            name: lm.name,
            address: addr,
            kmAway: km,
            status: pin,
            lastActivity: last,
            lat: lm.latitude,
            lon: lm.longitude,
            phone: lm.phone,
            email: lm.email,
            estimatedValue: lm.estimatedValue,
            aiScore: lm.aiOpportunityScore
        )
    }

    private static let _clusters: [MapClusterMock] = [
        MapClusterMock(count: 5,  color: KrBrand.green,  lat: 59.929, lon: 10.762),
        MapClusterMock(count: 12, color: KrBrand.purple, lat: 59.924, lon: 10.755),
        MapClusterMock(count: 7,  color: KrBrand.purple, lat: 59.930, lon: 10.778),
        MapClusterMock(count: 4,  color: KrBrand.orange, lat: 59.914, lon: 10.755),
        MapClusterMock(count: 8,  color: KrBrand.blue,   lat: 59.911, lon: 10.722),
        MapClusterMock(count: 15, color: KrBrand.purple, lat: 59.918, lon: 10.795),
        MapClusterMock(count: 9,  color: KrBrand.purple, lat: 59.917, lon: 10.762),
        MapClusterMock(count: 3,  color: KrBrand.green,  lat: 59.908, lon: 10.795),
    ]

    /// Demo-mode-gated clusters. Ved demo AV skjules klyngene så kartet
    /// ikke lyver om at det finnes leads i området.
    static var clusters: [MapClusterMock] {
        DemoModeManager.isActiveNonisolated ? _clusters : []
    }

    /// Mock-aktiviteter — KUN i demo-modus. Ellers tom liste + ærlig tom-tilstand i viewet.
    static var activities: [ActivityItemMock] {
        DemoModeManager.isActiveNonisolated ? _activities : []
    }
    private static let _activities: [ActivityItemMock] = [
        ActivityItemMock(icon: "calendar",          label: "Møte",           timestamp: "i dag 10:00"),
        ActivityItemMock(icon: "envelope.open",     label: "E-post åpnet",   timestamp: "i går 14:22"),
        ActivityItemMock(icon: "doc.text",          label: "Tilbud sendt",   timestamp: "20. mai 09:15"),
        ActivityItemMock(icon: "phone",             label: "Telefon",        timestamp: "19. mai 11:30"),
        ActivityItemMock(icon: "person.badge.plus", label: "Lead opprettet", timestamp: "18. mai 16:45"),
    ]

    /// Mock-notater — KUN i demo-modus.
    static var notes: [NoteItemMock] {
        DemoModeManager.isActiveNonisolated ? _notes : []
    }
    private static let _notes: [NoteItemMock] = [
        NoteItemMock(
            author: "Lars Kristensen",
            authorInitials: "LK",
            authorColor: KrBrand.purpleLight,
            body: "Anders er nøkkel-beslutningstaker. Konsernet vurderer flere leverandører, men foretrekker lokal partner. Pris-sensitiv på del 1, ikke del 2.",
            timestamp: "i dag 09:42",
            pinned: true
        ),
        NoteItemMock(
            author: "Mikkel Berg",
            authorInitials: "MB",
            authorColor: KrBrand.green,
            body: "Sendte tilbudsutkast på e-post. Anders vil ha referanseprosjekter — særlig fra finansbygg.",
            timestamp: "i går 14:22",
            pinned: false
        ),
        NoteItemMock(
            author: "Lars Kristensen",
            authorInitials: "LK",
            authorColor: KrBrand.purpleLight,
            body: "Første telefon-samtale gikk bra. De har et 4-etasjes kontorbygg som trenger oppdatering av el-anlegget. Tidsperspektiv: Q3.",
            timestamp: "19. mai 11:30",
            pinned: false
        ),
    ]

    /// Mock-filer — KUN i demo-modus.
    static var files: [FileItemMock] {
        DemoModeManager.isActiveNonisolated ? _files : []
    }
    private static let _files: [FileItemMock] = [
        FileItemMock(name: "Tilbud_NordicElektro_v3.pdf",   kind: .pdf,         size: "1.2 MB", uploadedAt: "i går 14:18"),
        FileItemMock(name: "Befaringsbilder_StorgataAS.zip", kind: .image,      size: "8.4 MB", uploadedAt: "20. mai"),
        FileItemMock(name: "Kontorbygg_arealskisse.pdf",     kind: .pdf,        size: "640 KB", uploadedAt: "19. mai"),
        FileItemMock(name: "Behovsanalyse.docx",             kind: .doc,        size: "320 KB", uploadedAt: "18. mai"),
        FileItemMock(name: "Prisliste_2026.xlsx",            kind: .spreadsheet, size: "180 KB", uploadedAt: "12. mai"),
    ]
}

// MARK: - Hoved-view

struct KartView: View {
    @State private var search: String = ""
    // Mac Catalyst Cmd+F fokuserer søkefeltet via `.leadgridFocusSearch`.
    @FocusState private var searchFieldFocused: Bool
    @State private var selectedLead: MapLeadMock = KartPreviewData.firstOrPlaceholder  // FIX #5: alltid Nordic Elektro; demo-off krasj-safe
    @State private var showUploadFile: Bool = false  // Pakke 10.1 (Kart-Filer-tab → UploadFileSheet)
    // Pakke 10.1 — 4 lead-actions som var toast-stubs:
    @State private var showStatusChange: Bool = false
    @State private var showAssignSeller: Bool = false
    @State private var showNoteEditor: Bool = false
    @State private var camera: MapCameraPosition = .region(MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 59.918, longitude: 10.762),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.13)
    ))
    /// Speiler current region fra camera så zoom-FAB-er kan endre span.
    /// Oppdateres via `.onMapCameraChange`.
    @State private var currentRegion: MKCoordinateRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 59.918, longitude: 10.762),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.13)
    )
    @State private var selectedTab: DetailTab = .info
    @State private var addLeadOpen: Bool = false
    @State private var openLeadFullSheet: Bool = false
    @State private var scheduleMeetingOpen: Bool = false

    // Filter-state — UI-fokus fase 4: fire dropdowns samlet i én
    // «Filtre · N»-pill (audit-regel 3: chip-budsjett).
    @State private var filtreOpen: Bool = false
    @State private var moreFiltersOpen: Bool = false
    /// Tegnforklaringen bor bak en liten kart-chip i stedet for egen
    /// full-bredde-rad (audit-regel 5: kartet er alltid scenen).
    @State private var legendOpen: Bool = false

    @State private var selectedArea: AreaFilter = .all
    @State private var selectedRadiusKm: Double = 5
    @State private var selectedIndustries: Set<String> = []
    @State private var selectedStatuses: Set<MapLeadMock.PinStatus> = []
    // Pakke 10.1: AppState for å hente prod-leads til rike popovere.
    @Environment(AppState.self) private var appState
    // Deep-link til operatør-app (Voi/Ryde/…) for elsparkesykkel-forslag.
    @Environment(\.openURL) private var openURL

    /// Kart-fanens leads: demo → mock (KartPreviewData), ekte →
    /// appState.leads adaptert til pin-modellen. QA-runde 3 (desktop,
    /// 2026-07-05): mock-gatingen tømte kartet i ekte modus fordi den
    /// ekte grenen aldri ble koblet — 22 leads i API, 0 pins på kartet.
    private var kartLeads: [MapLeadMock] {
        if DemoModeManager.isActiveNonisolated {
            return KartPreviewData.leads
        }
        return appState.leads
            .filter { $0.latitude != 0 || $0.longitude != 0 }
            .map(KartPreviewData.adapt)
    }

    /// Ekte modus: detail-panelet viser først noe når brukeren faktisk
    /// har valgt en pin/rad (selectedLead init-es med mock-placeholder
    /// som ellers ville lekke). Demo beholder pre-valgt lead.
    @State private var hasSelectedLead: Bool = false
    /// iPad: «Leads i området»-kolonnen kollapsbar — i portrett stjeler den
    /// kartbredde. Persistert så valget huskes mellom økter.
    /// UI-fokus fase 4 (Daniel): default KOLLAPSET — hele skjermen er kartet
    /// til man aktivt henter lista via «Leads (N) ›»-stripa.
    @AppStorage("kart.leads_panel_collapsed") private var leadsPanelCollapsed = true
    /// iPhone: «Leads i området» som draggbart halv-sheet over kartet.
    @State private var areaListOpen: Bool = false
    /// Auto-senter kun én gang per fane-liv.
    @State private var didAutoCenter: Bool = false
    // MARK: - Live navigasjons-modus
    /// Heading-up 3D turn-by-turn mot valgt lead. Utløses av «Naviger»-knappen
    /// på lead-kortet eller Navigasjon-toggle i Kartlag-arket.
    @State private var navModeActive: Bool = false
    @State private var navDestination: MapLeadMock? = nil
    /// Lilla stiplet gå-rute (ekte MKDirections) fra Meg til pin-en.
    @State private var navRoute: [CLLocationCoordinate2D]? = nil
    @State private var navDistanceText: String = ""
    @State private var navETAText: String = ""
    @State private var navETAMinutes: Int = 0
    /// Lav-pass-filtrert heading så kartet roterer jevnt (ikke rykkete).
    @State private var navHeadingSmoothed: Double? = nil
    /// Grunn til forsinkelse fra DATEX (f.eks. «en ulykke på E6») — fylles når
    /// trafikk-API-et er koblet på; brukes i «meld forsinkelse»-meldingen.
    @State private var navDelayReason: String? = nil
    /// Posisjonen ruta sist ble beregnet fra — re-ruter når du har beveget deg.
    @State private var navRerouteAnchor: CLLocationCoordinate2D? = nil
    /// Cooldown: aldri re-rut oftere enn hvert 12. sekund — reroute-stormer
    /// (GPS utenfor rute over tid) nullstilte stegene og fikk stemmen til å
    /// annonsere samme manøver i loop.
    @State private var navLastRerouteAt: Date? = nil
    /// Tale-pause etter re-rute: stegene er nye, ikke les dem opp med én gang.
    @State private var navSpeechGraceUntil: Date? = nil
    /// Faktisk bevegelses-kurs (grader, nord=0) fra siste posisjons-delta —
    /// driver kurs-pilen på avataren.
    @State private var navCourse: Double? = nil
    @State private var navCourseAnchor: CLLocationCoordinate2D? = nil

    // ── Rute-låst følgemotor (proff-nav) ──────────────────────────────
    // GPS oppdaterer KUN «hvor langt langs ruta» (s-target). Avataren og
    // kameraet glir kontinuerlig langs selve rute-polylinja (4 Hz-loop):
    // aldri over bygninger, retning = veiens tangent, tale trigges av
    // monoton s → kan ikke loope. (Omskrevet 2026-07-19 — rå-GPS-følging
    // ga ustabilt kamera, feil bil-rotasjon og posisjon utenfor vei.)
    @State private var navRouteCum: [Double] = []
    @State private var navStepS: [Double] = []
    @State private var navSTarget: Double = 0
    @State private var navSDisplay: Double = 0
    @State private var navFollowSpeed: Double = 0
    @State private var navLastFixAt: Date? = nil
    @State private var navAvatarCoord: CLLocationCoordinate2D? = nil
    @State private var navTangent: Double? = nil
    @State private var navCamHeading: Double = 0
    /// Hvor langt på ruta vi er (segment-indeks) — map-matching-lite: snapping
    /// søker kun framover herfra, så figuren aldri hopper bakover/til parallell-gate.
    @State private var navProgressIndex: Int = 0
    // MARK: POI langs ruten (lading/bensin — ekte MKLocalSearch, portert fra Møter)
    /// Alle POI langs ruta (begge typer hentes; synlighet gates av `navPOIActiveKinds`).
    @State private var navRoutePOIs: [NavRoutePOI] = []
    /// Hvilke POI-typer som vises på kartet. Tom = skjult (som Møter-mocken).
    @State private var navPOIActiveKinds: Set<NavPOIKind> = []
    /// Valgt POI (detalj-kort). POI-en brukeren avviste fra nærhets-varsler.
    @State private var navSelectedPOI: NavRoutePOI? = nil
    /// Avviste POI-varsler — stabile nøkler (navn+koordinat), ikke UUID-er
    /// som regenereres per henting (X-en «virket ikke», Daniel 2026-07-19).
    @State private var navDismissedPOIAlerts: Set<String> = []
    /// Kjøregodtgjørelse-sheet (statens sats). Portert fra Møter-mocken.
    @State private var navShowMileage: Bool = false
    /// «Min bil»-ark (drivstoff/type + regnr-oppslag).
    @State private var navShowVehicle: Bool = false
    /// Ekte bom langs ruta (NVDB) — antall + sum takst per vei (liten bil).
    @State private var navTollPerTrip: Double? = nil
    @State private var navTollCount: Int = 0
    // Leadgrid Go — kjørebok: registrer tur-start så en fullført nav auto-logges.
    @State private var navStartedAt: Date? = nil
    @State private var navStartCoord: CLLocationCoordinate2D? = nil
    @State private var navStartPlace: String = ""
    @State private var navShowKjorebok: Bool = false
    // MARK: turn-by-turn (sving-for-sving + stemme + ankomst)
    @State private var navSteps: [NavStep] = []
    @State private var navStepIndex: Int = 0
    @State private var navSpokePrepare: Bool = false
    @State private var navArrived: Bool = false
    @State private var navOffRouteCount: Int = 0
    /// Fartsgrense (NVDB) + hvor den sist ble hentet.
    @State private var navSpeedLimit: Int? = nil
    @State private var navSpeedAnchor: CLLocationCoordinate2D? = nil
    /// Stemme-guiding av/på (nb-NO).
    @State private var navVoiceOn: Bool = true

    struct NavStep: Hashable {
        let text: String                     // «Sving høyre inn i Storgata»
        let coord: CLLocationCoordinate2D    // manøver-punktet (start av steget)
        let icon: String                     // SF Symbol for manøveren
        static func == (a: NavStep, b: NavStep) -> Bool { a.text == b.text && a.coord.latitude == b.coord.latitude }
        func hash(into h: inout Hasher) { h.combine(text); h.combine(coord.latitude) }
    }
    #if DEBUG
    /// Live kamera-kalibrering (kun DEBUG): dra gliderne til det føles riktig,
    /// les av verdiene, så bakes de inn som defaults. Reverteres med #59.
    @State private var navCalibOpen: Bool = false
    @State private var navCalibPitch: Double = 55
    @State private var navCalibDist: Double = 300
    @State private var navCalibAhead: Double = 0.0008
    #endif
    /// Entur kollektiv-tilgjengelighet for valgt lead (lead-kortet).
    @State private var reachability: EnturService.Reachability? = nil
    @State private var reachabilityLoadedFor: String = ""
    /// Bilparkering nær valgt lead (Statens vegvesen p-register).
    @State private var parking: ParkingService.NearbyResult? = nil
    /// Entur «raskere alternativ» under navigering.
    @State private var navAlternatives: [EnturService.Alternative] = []
    @State private var navAltAnchor: CLLocationCoordinate2D? = nil
    @State private var navAltDismissed: Bool = false
    /// Transportform (styrer rute-type + ETA). `auto` lar Core Motion + fart
    /// avgjøre om du går/sykler/kjører.
    @State private var navTransport: NavTransport = .walking
    @State private var navTransportAuto: Bool = true
    /// Ekte ETA (min) per reisemåte for sammenligning i transport-menyen.
    /// Bil/Gå fra MKDirections; Sykkel avledet fra gå-distanse. Koll. fra Entur.
    @State private var navTransportETAs: [NavTransport: Int] = [:]
    /// Kamera-preset. Auto-velges av reisemåten, men kan overstyres med knappene.
    @State private var navPreset: NavCamPreset = .drive
    /// True når brukeren manuelt har valgt preset (da slutter auto-valg å styre).
    @State private var navPresetManual: Bool = false
    /// Husket preset-preferanse på tvers av økter ("" = auto etter reisemåte).
    @AppStorage("leadgrid.nav.presetPref") private var navPresetPref: String = ""
    /// Figuren på kartet skifter med reisemåte: gå-person / sparkesykkel / bil / buss.
    @State private var navVehicle: NavVehicle = .walk

    enum NavVehicle {
        case walk, scooter, car, bus
        var symbol: String {
            switch self { case .walk: "figure.walk"; case .scooter: "scooter"; case .car: "car.fill"; case .bus: "bus.fill" }
        }
    }

    enum NavTransport: String, CaseIterable, Hashable {
        case walking = "Gå", cycling = "Sykkel", driving = "Bil"
        var mkType: MKDirectionsTransportType { self == .driving ? .automobile : .walking }
        var icon: String {
            switch self { case .walking: "figure.walk"; case .cycling: "bicycle"; case .driving: "car.fill" }
        }
        var etaVerb: String {
            switch self { case .walking: "å gå"; case .cycling: "på sykkel"; case .driving: "kjøring" }
        }
        /// Antatt fart (m/s) for ETA-fallback når MKDirections ikke svarer.
        var fallbackSpeed: Double {
            switch self { case .walking: 1.35; case .cycling: 5.0; case .driving: 11.0 }
        }
    }

    /// Kamera-presets for navigasjon. Hver gir pitch/avstand/sikt-fram (justert
    /// litt etter reisemåte). `overview` fyller hele ruta i bildet.
    enum NavCamPreset: String, CaseIterable, Hashable {
        case firstPerson = "POV", drive = "Kjøre", walk = "Gå", overview = "Oversikt", topDown = "2D", north = "Nord"
        var icon: String {
            switch self {
            case .firstPerson: "eye.fill"
            case .drive: "location.north.line.fill"
            case .walk: "figure.walk"
            case .overview: "scope"
            case .topDown: "square.grid.2x2"
            case .north: "safari.fill"
            }
        }
        /// Nord-opp: kartet roterer IKKE (heading låst til nord).
        var northUp: Bool { self == .north }
        /// (pitch°, avstand m, sikt-fram °-lat). routeM = gjenstående rute (til fit).
        func params(_ transport: NavTransport, routeM: Double) -> (pitch: Double, dist: Double, ahead: Double) {
            switch self {
            case .firstPerson:
                return (74, 70, 0.0006)
            case .drive:
                let d: Double = transport == .driving ? 320 : (transport == .cycling ? 240 : 190)
                return (60, d, 0.0009)
            case .walk:
                // Gange (dørsalg): flat 2D heading-up — pitch 0 kan aldri
                // havne bak/i 3D-bygg, nær avstand, minimal ahead-offset.
                // Retningen du går er opp; stabil uansett bykjerne.
                return (0, 300, 0.0002)
            case .overview:
                return (42, min(2600, max(900, routeM * 2.6)), 0.0004)
            case .topDown:
                return (0, min(2200, max(700, routeM * 2.2)), 0.0002)
            case .north:
                return (0, min(2600, max(900, routeM * 2.6)), 0.0)
            }
        }
        /// Auto-valgt preset for en reisemåte.
        static func auto(for t: NavTransport) -> NavCamPreset {
            switch t { case .walking: .firstPerson; case .cycling: .drive; case .driving: .drive }
        }
    }

    #if DEBUG
    /// QA-kino (kun for reklamefilm-opptak, env QA_CINEMATIC=nordic). Skjuler
    /// detalj-panelet inntil «tap»-beaten så kortet kan poppe inn på cue.
    /// Reverteres før commit (oppgave #59).
    @State private var cinematicHideCard: Bool = false
    #endif
    private var showDetailPanel: Bool {
        guard !kartLeads.isEmpty else { return false }
        // 2026-07-18: dørsalg-modus er en egen verden — bedrifts-lead-panelet
        // under kartet skjules helt.
        guard !dorsalgModus else { return false }
        #if DEBUG
        if cinematicHideCard { return false }
        #endif
        // UI-fokus fase 4 (Daniel): hele skjermen er kartet til en lead
        // faktisk velges — også i demo. Kortet vises KUN ved valgt lead.
        return hasSelectedLead
    }

    /// Lukk detaljkortet (X-knapp / «Leads»-stripa) → kartet får hele flaten.
    private func lukkDetaljkort() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
            hasSelectedLead = false
        }
    }

    // Header: delt LeadgridTabHeader eier all popover/sheet-state selv.

    // Routes + lead-detail extras
    @State private var routePlannerOpen: Bool = false
    @State private var leadActionsOpen: Bool = false
    @State private var favorited: Bool = false
    @State private var navigateOpen: Bool = false

    // MeMapPin tap-actions (2026-07-02) — inline HUD-overlay på kartet.
    @State private var showMePinActions: Bool = false
    @State private var showMyRoute: Bool = false
    @State private var showNearbyTeam: Bool = false
    @State private var showVisitLogAtCoord: MePinCoordWrapper?
    @State private var createdLeadAtPosition: CreatedLeadAtPositionDTO?
    /// Camera-region før HUD ble åpnet — restores ved lukk.
    @State private var cameraBeforeHUD: MKCoordinateRegion?

    /// Zoom inn på user + åpne inline HUD.
    private func zoomToMeAndOpenHUD(coord: CLLocationCoordinate2D) {
        cameraBeforeHUD = currentRegion
        let zoomed = MKCoordinateRegion(
            center: coord,
            span: MKCoordinateSpan(latitudeDelta: 0.006, longitudeDelta: 0.008)
        )
        withAnimation(.easeInOut(duration: 0.45)) {
            camera = .region(zoomed)
            currentRegion = zoomed
        }
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
                camera = .region(prev)
                currentRegion = prev
            }
            cameraBeforeHUD = nil
        }
    }

    // Map-style toggle
    @State private var mapStyle: MapStyleChoice = .standardDark
    @State private var mapStyleSheetOpen: Bool = false

    // Pass-2 overlays
    @State private var activeOverlays: Set<MapOverlay> = []

    enum MapOverlay: String, CaseIterable, Hashable {
        case heatmap = "Heatmap"
        case aiLeads = "AI-foreslåtte"
        case travelHistory = "Reise-historikk"
        case territories = "Territorier"
        case dataOverlay = "Bedrifts-data"
        case teamMembers = "Team på kartet"
        var icon: String {
            switch self {
            case .heatmap:        return "flame.circle.fill"
            case .aiLeads:        return "sparkles"
            case .travelHistory:  return "road.lanes"
            case .territories:    return "rectangle.3.group.fill"
            case .dataOverlay:    return "chart.pie.fill"
            case .teamMembers:    return "person.2.circle.fill"
            }
        }
        var subtitle: String {
            switch self {
            case .heatmap:       return "Tetthet av leads visualisert som varmekart"
            case .aiLeads:       return "Pulse-pins for leads AI anbefaler å besøke i dag"
            case .travelHistory: return "Rød rute m/ dagens besøkte leads"
            case .territories:   return "Polygon-soner: din vs kollegas region"
            case .dataOverlay:   return "Pin-radius reflekterer omsetning (Brønnøysund)"
            case .teamMembers:   return "Live-avatar for selgere og promotører m/ destinasjon"
            }
        }
        var color: Color {
            switch self {
            case .heatmap:       return Color(red: 0.95, green: 0.20, blue: 0.20)
            case .aiLeads:       return Color(red: 0.75, green: 0.45, blue: 1.0)
            case .travelHistory: return Color(red: 0.98, green: 0.55, blue: 0.10)
            case .territories:   return Color(red: 0.20, green: 0.85, blue: 0.60)
            case .dataOverlay:   return Color(red: 0.34, green: 0.60, blue: 0.98)
            case .teamMembers:   return Color(red: 0.66, green: 0.32, blue: 0.99)
            }
        }
    }

    // Long-press → drop pin
    @State private var droppedPin: CLLocationCoordinate2D?
    @State private var addLeadFromPin: Bool = false

    // Mål-verktøy
    @State private var measureMode: Bool = false
    @State private var measurePointA: CLLocationCoordinate2D?
    @State private var measurePointB: CLLocationCoordinate2D?

    // MARK: - Dørsalg-modus (2026-07-18)
    // Husstandsadresser fra Kartverket som EGEN kartflate for dørsalg-org-er.
    // Blandes ALDRI med bedrifts-leads (lead-pins skjules i modusen) og
    // adressene skrives ALDRI til CRM — kun visning + Naviger.
    @State private var dorsalgModus = false
    @State private var dorsalgAdresser: [KartverketService.AdressePunkt] = []
    @State private var dorsalgLaster = false
    /// Totalt antall adresser Kartverket rapporterte for siste henting.
    @State private var dorsalgTotal: Int = 0
    /// Forrige hente-senter — re-fetch først når kartet har flyttet > 300 m.
    @State private var dorsalgFetchSenter: CLLocationCoordinate2D? = nil
    /// Valgt adresse-dot → kompakt callout nederst på kartet.
    @State private var dorsalgValgt: KartverketService.AdressePunkt? = nil
    /// Debounce: pågående hente-task kanselleres ved ny kartbevegelse.
    @State private var dorsalgFetchTask: Task<Void, Never>? = nil
    /// Husstands-status per adresse-id ("vunnet"/"avslatt") — org-lagret via
    /// backend (mig 0397), optimistisk oppdatert lokalt. Demo = kun minne.
    @State private var dorsalgStatuser: [String: String] = [:]
    @State private var dorsalgStatuserLastet = false
    /// Fullskjerm-kart: skjuler header/søk/liste + faneraden så kartet får
    /// hele flaten (viktig for dørsalg i felt).
    @State private var kartFullskjerm = false
    /// Dørsalg-filter: nil = alle, ellers "ubesokt" | "vunnet" | "avslatt".
    /// Lead-filterne (område/type/status) gjelder kun bedrifter og byttes
    /// ut med disse i dørsalg-modus.
    @State private var dorsalgFilter: String? = nil
    /// Produktkatalogen (mig 0399) — org-en kan selge for flere oppdrags-
    /// givere; selgeren ser kun produktene salgssjefen har satt dem på.
    @State private var dorsalgProdukter: KartverketService.DorsalgProductsEnvelope?
    /// Dørsalg-nav starter i oversikt; bytter til heading-up POV ved første
    /// reelle bevegelse (retningen du går = opp på kartet).
    @State private var dorsalgNavAutoPOV = false
    /// Feirings-overlay etter registrert salg (konfetti + sjekk-pop).
    @State private var dorsalgFeiring = false
    /// Motivasjons-melding etter avslag («Hvert nei er ett steg nærmere…»).
    @State private var dorsalgMotivasjon: String?
    /// Teller avslag i økta — velger neste motivasjonsfrase deterministisk.
    @State private var dorsalgAvslagTeller = 0
    /// Dagens registrerte salg (min telling) — driver milepæls-feiringen.
    @State private var dorsalgDagensSalg = 0
    /// Dagsmål per selger — resolvert fra backend (team-først, salgssjefen
    /// setter det i Salgsledelse). Default 3 til stats er hentet.
    @State private var dorsalgDagsmal = 3
    /// Adresse med «Registrer salg»-skjemaet åpent (Vunnet-knappen).
    @State private var dorsalgSalgFor: KartverketService.AdressePunkt?

    /// Org-gated + demo-gated synlighet (Daniel-regel 3, 2026-07-18):
    /// default AV — B2B-org-er skal ikke se noen referanse til modusen.
    /// Demo-modus får den også (pitch-demo).
    private var visDorsalgToggle: Bool {
        DemoModeManager.isActiveNonisolated
            || EntitlementStore.shared.isExplicitlyEnabled(.dorsalgModus)
    }

    /// REN dørsalg-org (leads låst i profilen): kartet står FAST i dørsalg —
    /// Bedrifter-verdenen finnes ikke i opplevelsen, så toggelen skjules.
    private var erRenDorsalgOrgKart: Bool {
        EntitlementStore.shared.erRenDorsalgOrg
    }

    /// Kartspenn-grense for adresse-henting (~3 km) — over dette vises
    /// «Zoom inn»-chippen i stedet for å hente tusenvis av adresser.
    private var dorsalgZoomOK: Bool {
        currentRegion.span.latitudeDelta < 0.03
    }

    /// Pins som faktisk renderes — CACHET (@State), IKKE computed: en
    /// computed property her leses av Map-builderen ved HVER kamera-tick
    /// under panorering, og distanse-sortering av 3000 adresser per frame
    /// gjorde hele appen treg (Daniel 2026-07-18). Oppdateres kun etter
    /// fetch + debounced kamerastopp via oppdaterDorsalgSynlige().
    @State private var dorsalgSynligeAdresser: [KartverketService.AdressePunkt] = []

    /// Viewport-filter + cap: adresser innenfor synlig region (+30 % margin),
    /// ved > 400 de 400 nærmeste senteret. O(n) filter først — sorterer kun
    /// det som faktisk er i viewporten.
    private func oppdaterDorsalgSynlige() {
        guard dorsalgModus else {
            if !dorsalgSynligeAdresser.isEmpty { dorsalgSynligeAdresser = [] }
            return
        }
        let region = currentRegion
        let c = region.center
        let latMargin = region.span.latitudeDelta * 0.65
        let lonMargin = region.span.longitudeDelta * 0.65
        var iViewport = dorsalgAdresser.filter {
            abs($0.lat - c.latitude) < latMargin &&
            abs($0.lon - c.longitude) < lonMargin
        }
        if let f = dorsalgFilter {
            iViewport = iViewport.filter {
                let s = dorsalgStatuser[$0.id]
                return f == "ubesokt" ? s == nil : s == f
            }
        }
        if iViewport.count > 400 {
            func d2(_ a: KartverketService.AdressePunkt) -> Double {
                let dLat = a.lat - c.latitude
                let dLon = (a.lon - c.longitude) * cos(c.latitude * .pi / 180)
                return dLat * dLat + dLon * dLon
            }
            iViewport = Array(iViewport.sorted { d2($0) < d2($1) }.prefix(400))
        }
        dorsalgSynligeAdresser = iViewport
    }

    enum MapStyleChoice: String, CaseIterable, Hashable {
        case standardDark = "Standard"
        case satellite = "Satellitt"
        case hybrid = "Hybrid 3D"
        case mute = "Minimal"
        var icon: String {
            switch self {
            case .standardDark: return "map"
            case .satellite:    return "globe"
            case .hybrid:       return "building.2.crop.circle"
            case .mute:         return "rectangle.dashed"
            }
        }
        var mapKitStyle: MapStyle {
            switch self {
            case .standardDark: return .standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll)
            case .satellite:    return .imagery(elevation: .realistic)
            case .hybrid:       return .hybrid(elevation: .realistic, pointsOfInterest: .excludingAll)
            case .mute:         return .standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll)
            }
        }
    }

    // Toast-system for actions som ikke har dedikert sheet ennå
    @State private var toastMessage: String?
    @State private var toastTask: Task<Void, Never>?

    enum DetailTab: String, CaseIterable, Hashable {
        case info = "Informasjon"
        case activities = "Aktiviteter"
        case notes = "Notater"
        case files = "Filer"
    }

    /// Visuelle overlay-lag på kartet (ekstrahert for å avlaste type-sjekkeren).
    @MapContentBuilder
    private var mapVisualLayersContent: some MapContent {
        if activeOverlays.contains(.heatmap) {
            ForEach(KartPreviewData.clusters) { c in
                MapCircle(center: CLLocationCoordinate2D(latitude: c.lat, longitude: c.lon),
                          radius: Double(c.count) * 80)
                    .foregroundStyle(.radialGradient(
                        colors: [Color.red.opacity(0.55), Color.orange.opacity(0.3), Color.yellow.opacity(0)],
                        center: .center, startRadius: 0, endRadius: Double(c.count) * 80))
                    .stroke(Color.red.opacity(0.4), lineWidth: 1)
            }
        }
        if activeOverlays.contains(.territories) {
            ForEach(OverlayData.territories) { t in
                MapPolygon(coordinates: t.coordinates)
                    .foregroundStyle(t.color.opacity(0.15))
                    .stroke(t.color.opacity(0.6), lineWidth: 2)
            }
        }
        if activeOverlays.contains(.travelHistory), !OverlayData.travelHistory.isEmpty {
            MapPolyline(coordinates: OverlayData.travelHistory)
                .stroke(KrBrand.orange, style: StrokeStyle(lineWidth: 4, lineCap: .round))
            ForEach(Array(OverlayData.travelHistory.enumerated()), id: \.offset) { (idx, coord) in
                Annotation("", coordinate: coord) {
                    ZStack {
                        Circle().fill(KrBrand.orange)
                            .overlay(Circle().stroke(Color.white, lineWidth: 2))
                            .frame(width: 22, height: 22)
                        Text("\(idx + 1)")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
            }
        }
        if activeOverlays.contains(.aiLeads) {
            ForEach(OverlayData.aiLeads) { s in
                Annotation("", coordinate: CLLocationCoordinate2D(latitude: s.lat, longitude: s.lon)) {
                    AISuggestionPin(score: s.score)
                }
            }
        }
    }

    /// Solid «casing»-rute på kartet (ekstrahert for å hjelpe type-sjekkeren).
    @MapContentBuilder
    private var navRouteMapContent: some MapContent {
        if let route = navRoute, route.count > 1 {
            MapPolyline(coordinates: route)
                .stroke(Color(red: 0.30, green: 0.14, blue: 0.55),
                        style: StrokeStyle(lineWidth: 13, lineCap: .round, lineJoin: .round))
            MapPolyline(coordinates: route)
                .stroke(LinearGradient(colors: [KrBrand.purpleLight, KrBrand.purple],
                                       startPoint: .leading, endPoint: .trailing),
                        style: StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round))
        }
        // POI langs ruta (lading/bensin) — kun de typene brukeren har slått på.
        ForEach(navRoutePOIs.filter { navPOIActiveKinds.contains($0.kind) }) { poi in
            Annotation("", coordinate: poi.coordinate) {
                Button {
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.85)) {
                        navSelectedPOI = navSelectedPOI?.id == poi.id ? nil : poi
                    }
                } label: {
                    NavPOIPin(poi: poi, isSelected: navSelectedPOI?.id == poi.id)
                }
                .buttonStyle(.plain)
            }
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            KrBrand.bg.ignoresSafeArea()
            content
            if let msg = toastMessage {
                toastBanner(msg)
                    .padding(.bottom, 24)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .preferredColorScheme(.dark)
        // Ren dørsalg-org: kartet står fast i dørsalg. Entitlements lander
        // async etter login → poll noen sekunder før vi gir oss.
        .task {
            for _ in 0..<10 {
                if erRenDorsalgOrgKart {
                    if !dorsalgModus { setDorsalgModus(true) }
                    break
                }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
        .task(id: kartLeads.first?.id) {
            // Auto-senter ved oppstart. Demo: zoom på pre-valgt mock-lead
            // (Daniel-feedback 2026-06-29). Ekte: senter over egne leads
            // når de lander fra API (task-id re-trigger), UTEN å velge —
            // detail-panelet skal ikke late som brukeren har valgt noe.
            guard !didAutoCenter else { return }
            #if DEBUG
            if ProcessInfo.processInfo.environment["QA_CINEMATIC"] == "nordic" {
                didAutoCenter = true
                runNordicCinematic()
                return
            }
            // QA-hook (landing-videoer): QA_TOUR=kart|dorsalg kjører en
            // scripted interaksjons-tour (simctl recordVideo utenpå).
            // Kun DEBUG — reverteres m/ task #59-følget.
            if let tour = ProcessInfo.processInfo.environment["QA_TOUR"] {
                didAutoCenter = true
                await runQATour(tour)
                return
            }
            // QA-hook (pitch-screenshots): QA_DORSALG=1 åpner dørsalg-modus
            // m/ demo-adresser + valgt callout; =2 viser også produktvelgeren.
            // Kun DEBUG + simulator — reverteres m/ task #59-følget.
            if let qaDorsalg = ProcessInfo.processInfo.environment["QA_DORSALG"] {
                didAutoCenter = true
                camera = .region(MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7460),
                    span: MKCoordinateSpan(latitudeDelta: 0.014, longitudeDelta: 0.02)))
                currentRegion = MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7460),
                    span: MKCoordinateSpan(latitudeDelta: 0.014, longitudeDelta: 0.02))
                setDorsalgModus(true)
                // Vent til adressene har landet (ekte Kartverket-fetch kan
                // ta et par sekunder), velg en nær senteret uten status.
                for _ in 0..<20 where dorsalgSynligeAdresser.isEmpty {
                    try? await Task.sleep(nanoseconds: 300_000_000)
                }
                let c = currentRegion.center
                if let adr = dorsalgSynligeAdresser
                    .filter({ dorsalgStatuser[$0.id] == nil })
                    .min(by: { abs($0.lat - c.latitude) + abs($0.lon - c.longitude)
                             < abs($1.lat - c.latitude) + abs($1.lon - c.longitude) }) {
                    dorsalgValgt = adr
                    if qaDorsalg == "2" { dorsalgSalgFor = adr }
                }
                return
            }
            #endif
            if DemoModeManager.isActiveNonisolated {
                didAutoCenter = true
                selectAndZoom(selectedLead)
                hasSelectedLead = false  // demo-panelet vises uansett; ikke lås ekte modus
            } else if let first = kartLeads.first {
                didAutoCenter = true
                withAnimation(.easeInOut(duration: 0.55)) {
                    camera = .region(MKCoordinateRegion(
                        center: CLLocationCoordinate2D(latitude: first.lat, longitude: first.lon),
                        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.13)
                    ))
                }
            }
        }
        // Entur: hent kollektiv-tilgjengelighet for valgt lead (lead-kortet).
        .task(id: selectedLead.id) {
            let lead = selectedLead
            guard showDetailPanel, reachabilityLoadedFor != lead.id else { return }
            reachability = nil; parking = nil
            async let rA = EnturService.shared.reachability(lat: lead.lat, lon: lead.lon, using: appState.api)
            async let pA = ParkingService.shared.nearby(lat: lead.lat, lon: lead.lon, using: appState.api)
            let (r, p) = await (rA, pA)
            if selectedLead.id == lead.id {
                reachability = r
                parking = p
                reachabilityLoadedFor = lead.id
            }
        }
        // Møter «Naviger»/«Rute til møte» → ekte nav-motor. AppState.requestNavigation
        // setter et deep-link (overlever tab-switch); her bygger vi lead-en og
        // starter ekte turn-by-turn (start=true) eller senterer for forhåndsvisning.
        .task(id: appState.deepLinkNavRequestedAt) {
            guard let at = appState.deepLinkNavRequestedAt,
                  Date().timeIntervalSince(at) < 60,
                  let lat = appState.deepLinkNavLat,
                  let lon = appState.deepLinkNavLon else { return }
            let lead = MapLeadMock(
                name: appState.deepLinkNavName ?? "Møte",
                address: appState.deepLinkNavAddress ?? "",
                kmAway: 0,
                status: .meeting,
                lastActivity: nil,
                lat: lat, lon: lon
            )
            let start = appState.deepLinkNavStart
            // Transport-hint fra avsenderen («Start kjøring» = driving) —
            // ellers arves gå-modus fra forrige økt/dørsalg.
            if let t = appState.deepLinkNavTransport {
                navTransport = t == "driving" ? .driving
                    : t == "cycling" ? .cycling : .walking
                navTransportAuto = false
            }
            appState.clearNavigationDeepLink()
            didAutoCenter = true   // ikke la oppstart-auto-senter overstyre
            if start {
                startNavigation(to: lead)
            } else {
                selectedLead = lead
                hasSelectedLead = true
                selectAndZoom(lead)
            }
        }
        // Mac Catalyst Cmd+N → åpne AddLeadSheet. NotificationCenter-broadcast
        // fra GlobalKeyboardShortcuts. No-op på iOS/iPadOS.
        .onReceive(NotificationCenter.default.publisher(for: .leadgridNewLead)) { _ in
            addLeadOpen = true
        }
        // Mac Catalyst Cmd+F → fokuser søkefelt.
        .onReceive(NotificationCenter.default.publisher(for: .leadgridFocusSearch)) { _ in
            searchFieldFocused = true
        }
        // Live navigasjon: følg posisjonen kontinuerlig (heading-up + re-rute).
        .onChange(of: KartLocationManager.shared.currentCoordinate?.latitude) { _, _ in
            navLocationTick()
        }
        .onChange(of: KartLocationManager.shared.currentCoordinate?.longitude) { _, _ in
            navLocationTick()
        }
        // Rute-låst follow-loop (4 Hz): glir avatar + kamera langs ruta
        // uavhengig av GPS-tikkene — kontinuerlig, aldri hopp.
        .task(id: navModeActive) {
            guard navModeActive else { return }
            while !Task.isCancelled && navModeActive {
                navFollowAdvance(dt: 0.25)
                try? await Task.sleep(nanoseconds: 250_000_000)
            }
        }
        .sheet(isPresented: $addLeadOpen) {
            AddLeadSheet { newLead in
                addLeadOpen = false
                // I prod ville vi sende dette til APIClient.createLead
            }
        }
        // Kjøregodtgjørelse (statens sats) — ekte km fra nav-ruta.
        .sheet(isPresented: $navShowMileage) {
            NavMileageSheet(
                leadName: navDestination?.name ?? "Reise",
                address: navDestination?.address ?? "",
                distanceKm: max(1, Int(navRouteKm.rounded())),
                profile: appState.vehicleProfile,
                realTollPerTrip: navTollPerTrip,
                realTollCount: navTollCount,
                onLog: { amount in
                    showToast("Kjøregodtgjørelse logget: \(Int(amount)) kr")
                    // TODO (#73): persister til kostnad→besøk-attribusjon.
                })
        }
        // «Min bil»-profil (drivstoff/type + regnr-oppslag).
        .sheet(isPresented: $navShowVehicle) {
            VehicleProfileSheet(profile: Bindable(appState).vehicleProfile, api: appState.api)
        }
        // Leadgrid Go — kjørebok (auto-loggede turer + formåls-bekreftelse).
        .sheet(isPresented: $navShowKjorebok) { KjorebokView() }
        .sheet(isPresented: $openLeadFullSheet) {
            // iPhone (2026-07-17): draggbart bottom-sheet med detents —
            // halvveis-posisjonen lar kartet være synlig og interaktivt bak
            // (Apple Maps-mønsteret). iPad beholder fullt sheet.
            if DeviceIdiom.isPhone {
                LeadDetailFullSheet(lead: selectedLead)
                    .presentationDetents([.medium, .large])
                    .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                    .presentationDragIndicator(.visible)
            } else {
                LeadDetailFullSheet(lead: selectedLead)
            }
        }
        // «Leads i området» som egen HUD-flate på iPhone (2026-07-17):
        // listen bor under kartet på compact — hit kommer den som draggbart
        // halv-sheet; tap på en rad zoomer kartet bak.
        .sheet(isPresented: $areaListOpen) {
            ScrollView {
                leadsInAreaCard
                    .padding(.horizontal, 14)
                    .padding(.top, 18)
                    .padding(.bottom, 24)
            }
            .background(KrBrand.bg.ignoresSafeArea())
            .presentationDetents([.medium, .large])
            .presentationBackgroundInteraction(.enabled(upThrough: .medium))
            .presentationDragIndicator(.visible)
            .preferredColorScheme(.dark)
        }
        .sheet(isPresented: $scheduleMeetingOpen) {
            ScheduleMeetingSheet(lead: selectedLead)
        }
        .sheet(isPresented: $moreFiltersOpen) {
            MoreFiltersSheet()
        }
        .sheet(isPresented: $navigateOpen) {
            NavigateSheet(lead: selectedLead)
        }
        .sheet(isPresented: $showUploadFile) {
            // Gjenbruker Leads-fanens rike UploadFileSheet (Pakke 10.1) —
            // «Fra iPad / Fra skyen / Skann dokument»-katalog med samme
            // UX på tvers av alle faner.
            UploadFileSheet(companyName: selectedLead.name, companyColor: selectedLead.status.color)
        }
        .sheet(isPresented: $showStatusChange) {
            // Workflow-QA 2026-07-05: onSave var toast-fasade — nå ekte
            // API-kall i ekte modus (id-en er LeadModel.id). Demo: toast.
            LeadStatusChangeSheet(
                companyName: selectedLead.name,
                companyColor: selectedLead.status.color,
                onSave: { newStatus, note in
                    let leadId = selectedLead.id
                    if DemoModeManager.isActiveNonisolated {
                        showToast("Status endret til \(newStatus.label)")
                    } else if let api = appState.api {
                        Task {
                            do {
                                try await api.updateStatus(leadId: leadId, status: newStatus.apiValue)
                                showToast("Status endret til \(newStatus.label)")
                                await appState.refreshLeads()
                            } catch {
                                showToast("Kunne ikke endre status")
                            }
                        }
                    }
                },
                onSaveTemperature: { temp in
                    let leadId = selectedLead.id
                    if DemoModeManager.isActiveNonisolated {
                        showToast("Temperatur endret")
                    } else if let api = appState.api {
                        Task {
                            do {
                                try await api.updateTemperature(leadId: leadId, temperature: temp)
                                showToast("Temperatur endret")
                                await appState.refreshLeads()
                            } catch {
                                showToast("Kunne ikke endre temperatur")
                            }
                        }
                    }
                }
            )
        }
        .sheet(isPresented: $showAssignSeller) {
            LeadAssignSellerSheet(
                companyName: selectedLead.name,
                companyColor: selectedLead.status.color,
                // 2026-07-17: var hardkodet «Lars Kristensen» — eier spores
                // ikke på kart-modellen, så raden utelates ærlig.
                currentSellerName: nil
            ) { newSeller in
                // 2026-07-17: var toast-fasade — nå ekte tildeling via
                // /lead-assignments (demo-valg uten userId forblir toast).
                if let userId = newSeller.userId, let api = appState.api,
                   !DemoModeManager.isActiveNonisolated {
                    let payload = LeadAssignmentPayload(
                        leadId: selectedLead.id,
                        leadName: selectedLead.name,
                        leadLat: selectedLead.lat,
                        leadLng: selectedLead.lon,
                        assigneeUserId: userId,
                        assigneeRole: "seller",
                        priority: "normal",
                        message: ""
                    )
                    Task {
                        do {
                            try await api.createLeadAssignment(payload)
                            showToast("Tildelt \(newSeller.name)")
                            await appState.refreshLeads()
                        } catch {
                            showToast("Kunne ikke tildele")
                        }
                    }
                } else {
                    showToast("Tildelt \(newSeller.name)")
                }
            }
        }
        .sheet(isPresented: $showNoteEditor) {
            LeadNoteSheet(
                companyName: selectedLead.name,
                companyColor: selectedLead.status.color
            ) { note, category, pinned in
                // 2026-07-17: var toast-fasade — lagres nå i samme lokale
                // notat-lager som Leads-fanen (nøkkel = lead-id; for ekte
                // leads er det crm-uuiden → notatet synes begge steder).
                if !DemoModeManager.isActiveNonisolated {
                    LeadLocalNotes.add(body: note, pinned: pinned,
                                       author: appState.displayName,
                                       to: selectedLead.id)
                }
                showToast("Notat lagret\(pinned ? " (festet)" : "")")
            }
        }
        // Arkiv-dialogen fjernet 2026-07-17: «Arkiver» var toast-fasade uten
        // API — dialogen lot som leaden ble flyttet til arkiv.
        // Dørsalg «Registrer salg» (mig 0400): produkt + bidrag + kunde +
        // samtykke — aldri betalingsdata. Grønn pin settes optimistisk;
        // backend lager Kvalitet-rad + sender velkomst-e-post. Demo = lokalt.
        .sheet(item: $dorsalgSalgFor) { adr in
            RegistrerSalgSheet(
                adresse: adr,
                produkter: dorsalgProdukter?.tilgjengelige ?? []
            ) { salg in
                withAnimation(.easeOut(duration: 0.2)) {
                    dorsalgStatuser[adr.id] = "vunnet"
                }
                if dorsalgFilter != nil { oppdaterDorsalgSynlige() }
                visDorsalgFeiring()
                guard !DemoModeManager.isActiveNonisolated,
                      let api = appState.api else { return }
                Task {
                    _ = await KartverketService.shared.registerDorsalgSale(
                        for: adr, productId: salg.produktId,
                        bidragBelop: salg.bidragBelop, bidragLabel: salg.bidragLabel,
                        kundeNavn: salg.kundeNavn, kundeTelefon: salg.kundeTelefon,
                        kundeEpost: salg.kundeEpost, ringBekreftet: salg.ringBekreftet,
                        samtykkeTekst: salg.samtykkeTekst, using: api)
                }
            }
        }
        .sheet(isPresented: $mapStyleSheetOpen) {
            LayersSheet(
                selectedStyle: $mapStyle,
                activeOverlays: $activeOverlays,
                navActive: navModeActive,
                canNavigate: !kartLeads.isEmpty,
                destinationName: selectedLead.name,
                dorsalg: dorsalgModus,
                onStartNav: {
                    mapStyleSheetOpen = false
                    withAnimation(.easeInOut(duration: 0.4)) { startNavigation(to: selectedLead) }
                },
                onStopNav: { withAnimation(.easeOut(duration: 0.25)) { stopNavigation() } }
            )
        }
        // MeMapPin tap-actions (2026-07-02) — inline HUD-overlay på kartet
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
        .sheet(isPresented: $showMyRoute) {
            MyRouteView()
        }
        .sheet(isPresented: $showNearbyTeam) {
            NearbyTeamView()
        }
        .sheet(item: $showVisitLogAtCoord) { wrapper in
            // Nærmeste lead auto-valgt basert på koordinat. Fallback: første lead.
            let nearest = nearestLeadFromCoord(wrapper.coordinate)
            VisitLogModal(lead: nearest)
        }
        .sheet(item: $createdLeadAtPosition) { dto in
            // Åpne AddLeadSheet med prefilled lokasjon. Vi bruker enkel
            // preview siden AddLeadSheet ikke tar CreatedLeadAtPositionDTO
            // direkte — refactor kan komme senere. For nå: vis toast +
            // trigger refresh.
            NavigationStack {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 40))
                        .foregroundStyle(.green)
                    Text("Lead opprettet")
                        .font(.headline)
                    Text(dto.displayName)
                        .font(.subheadline)
                    if let addr = dto.address {
                        Text(addr)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let lat = dto.latitude, let lon = dto.longitude {
                        Text(String(format: "%.4f, %.4f", lat, lon))
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                    }
                    Button("Ferdig") {
                        createdLeadAtPosition = nil
                    }
                    .padding(.top, 12)
                }
                .padding(24)
                .navigationTitle("Ny lead")
                .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium])
        }
    }

    /// Finn nærmeste lead-mock til gitt koord. Brukes av VisitLogModal-
    /// auto-select. Vi bygger en minimum-LeadModel via JSON-decoding for å
    /// unngå å måtte holde memberwise-init-listen synkron.
    private func nearestLeadFromCoord(_ coord: CLLocationCoordinate2D) -> LeadModel {
        // Fix 2026-07-02: gammel impl brukte JSON-decode m/ `"status": "new"` —
        // men LeadStatus har ikke `.new` → decodeFailed → fatalError krasjet
        // appen etter «Registrer besøk her» via HUD-en. Konstruerer nå
        // programmatisk med `.unvisited`.
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
            phone: nil, email: nil, websiteUrl: nil, instagramUrl: nil,
            linkedinUrl: nil, googleRating: nil, googlePlaceId: nil,
            logoUrl: nil, aiOpportunityScore: nil, estimatedValue: nil,
            leadSource: "map_tap",
            assignedUserId: nil, assignedUserName: nil, assignedUserEmail: nil,
            projectId: nil, lastVisitAt: nil, nextFollowUpAt: nil,
            nextAction: nil, tags: nil, notes: nil,
            createdAt: Date(), updatedAt: Date(),
            leadTemperature: nil, pipelineStage: nil, leadScore: nil,
            industryId: nil
        )
    }

    private var content: some View {
        // Header + søk er FAST øverst. Resten scrolles internt slik at
        // detailPanel (kan bli lang i Notater-tab) ikke dytter ut header.
        //
        // AnyView på hver hovedgren er LOAD-BEARING, ikke pynt: den samlede
        // opake typen av denne fanen ble så dypt nestet at Swift-runtimens
        // metadata-oppløsning (swift_getTypeByMangledName) rekurserte forbi
        // 1 MB-stacken på ekte enhet → SIGSEGV ved oppstart (iOS 26.5.2,
        // build 20260717). Simulator overlever (8 MB stack) — fjern ALDRI
        // erasure her uten å teste på fysisk enhet.
        VStack(spacing: 0) {
            if !kartFullskjerm {
                AnyView(kartHeader)
                    .padding(.horizontal, 20).padding(.top, 14)
                AnyView(searchAndFilters)
                    .padding(.horizontal, 20).padding(.top, 12)
                    .padding(.bottom, 12)
            }

            // Fullskjerm (2026-07-18): kun kartet, hele flaten — resten av
            // fanen (og faneraden) skjules. AnyView på hver gren holder
            // buildEither-dybden flat (jf. stack-overflow-noten over).
            if kartFullskjerm {
                AnyView(mapCard)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.horizontal, 6)
                    .padding(.bottom, 6)
            } else if dorsalgModus {
                // Dørsalg: INGEN scroll — kartet fyller ledig plass og
                // legenden står alltid synlig under (Daniels funn: fast
                // karthøyde dyttet legenden bak faneraden).
                AnyView(dorsalgLayout)
            } else if !showDetailPanel {
                // UI-fokus fase 4 (Daniel): ingen lead valgt ⇒ HELE flaten
                // er kartet — intet tomt detaljpanel, ingen scroll.
                AnyView(kartFulltLayout)
            } else {
                AnyView(kartInnholdScroll)
            }
        }
        .toolbar(kartFullskjerm ? .hidden : .automatic, for: .tabBar)
        .statusBarHidden(kartFullskjerm)
    }

    /// Dørsalg-layout uten scroll: kartet tar all ledig høyde, utfall-
    /// legenden alltid synlig nederst (over faneraden).
    private var dorsalgLayout: some View {
        VStack(spacing: 12) {
            AnyView(mapCard)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            AnyView(dorsalgLegendCard)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
    }

    /// Map-first-layout (Daniel, UI-fokus fase 4): ingen lead valgt ⇒ kartet
    /// fyller all ledig høyde. Lead-lista kan stå ved siden av (300pt) eller
    /// ligge bak «Leads (N) ›»-stripa; tegnforklaringen er kart-chip.
    private var kartFulltLayout: some View {
        let columns = DeviceIdiom.isPhone
            ? AnyLayout(VStackLayout(spacing: 12))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 14))
        return columns {
            AnyView(mapCard)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .overlay(alignment: .topTrailing) {
                    if !DeviceIdiom.isPhone && leadsPanelCollapsed {
                        leadsStripeKnapp.padding(10)
                    }
                }
                .overlay(alignment: .bottomLeading) {
                    legendChip.padding(10)
                }
            if !DeviceIdiom.isPhone && !leadsPanelCollapsed {
                VStack(spacing: 12) {
                    AnyView(leadsInAreaCard)
                    Spacer(minLength: 0)
                }
                .kartColumnWidth(300)
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
        .animation(.spring(response: 0.4, dampingFraction: 0.85),
                   value: leadsPanelCollapsed)
    }

    /// Smal «Leads (N) ›»-stripe: henter lead-lista tilbake (og lukker et
    /// eventuelt åpent detaljkort — én-ting-om-gangen).
    private var leadsStripeKnapp: some View {
        Button {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                leadsPanelCollapsed = false
            }
            lukkDetaljkort()
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "sidebar.leading")
                    .font(.appScaled(size: 11, weight: .bold))
                Text("Leads (\(kartLeads.count))")
                    .font(.appScaled(size: 11, weight: .bold))
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 9, weight: .bold))
            }
            .fixedSize()
            .foregroundStyle(.white)
            .padding(.horizontal, 11).padding(.vertical, 8)
            .background(.ultraThinMaterial, in: Capsule())
            .background(KrBrand.purple.opacity(0.45), in: Capsule())
            .overlay(Capsule().stroke(KrBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    /// Vanlig fane-layout (kart + legend + detaljpanel + områdeliste) —
    /// ekstrahert så fullskjerm-grenen i content holder seg flat.
    private var kartInnholdScroll: some View {
            ScrollView {
                // iPhone: side-kolonnen (300pt) får ikke plass ved siden av
                // kartet på compact width — stable kolonnene vertikalt i
                // stedet, med leads-i-området under detail-panelet.
                let columns = DeviceIdiom.isPhone
                    ? AnyLayout(VStackLayout(spacing: 14))
                    : AnyLayout(HStackLayout(alignment: .top, spacing: 14))
                columns {
                    VStack(spacing: 12) {
                        AnyView(mapCard)
                            // Kartet skal dominere Kart-fanen. På iPad/Mac
                            // (romslig vindu) gir vi det vesentlig mer høyde;
                            // iPhone holder en kompakt høyde så resten får plass.
                            // (Dørsalg bruker dorsalgLayout — aldri denne.)
                            .frame(minHeight: DeviceIdiom.isPhone ? 360 : 520,
                                   maxHeight: DeviceIdiom.isPhone ? 460 : 680)
                            .overlay(alignment: .topTrailing) {
                                // Detaljkortet er åpent her — lista ligger
                                // alltid bak stripa (én-ting-om-gangen).
                                if !DeviceIdiom.isPhone {
                                    leadsStripeKnapp.padding(10)
                                }
                            }
                            .overlay(alignment: .bottomLeading) {
                                // Tegnforklaringen som liten kart-chip m/
                                // popover — erstatter full-bredde legend-raden.
                                legendChip.padding(10)
                            }
                        AnyView(detailPanel)
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 16)
                // Liste ⇄ detaljkort veksler — animer fortrengningen.
                .animation(.spring(response: 0.4, dampingFraction: 0.85),
                           value: showDetailPanel)
            }
    }

    // MARK: Header — delt LeadgridTabHeader (fasit: Oversikt-fanen)

    /// Demo-aware datakilde for header-badges/popovers (samme gating som
    /// resten av fanen).
    private var headerLeads: [LeadModel] {
        DemoModeManager.isActiveNonisolated
            ? DemoModeManager.shared.mockLeads
            : appState.leads
    }

    private var kartHeader: some View {
        LeadgridTabHeader(
            subtitle: "Se dine leads, kunder og aktiviteter på kartet.",
            leads: headerLeads)
    }

    // MARK: Søk + filtre

    @ViewBuilder
    private var searchAndFilters: some View {
        // iPhone (QA-runde 2, Daniels funn): én-rads layouten delte 390pt
        // på søkefelt + 6 chips → hver chip ble en vertikal bokstav-søyle.
        // Samme mønster som Leads-fanen: søkefelt på egen rad, chips og
        // knapper i horisontal scroller med naturlig bredde.
        if DeviceIdiom.isPhone {
            VStack(spacing: 8) {
                if visKartSok { kartSearchField }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        kartChipsForMode
                    }
                    .fixedSize(horizontal: true, vertical: false)
                    .padding(.horizontal, 20)
                }
                .padding(.horizontal, -20)
            }
        } else {
            HStack(spacing: 8) {
                if visKartSok { kartSearchField }
                kartChipsForMode
            }
        }
    }

    /// Dørsalg: søkefeltet treffer bedrifts-leads og er unødvendig (adressen
    /// vises ved pin-tap) — skjult som default. Superadmin kan aktivere
    /// `dorsalgAdresseSok` i matrisen for org-er som trenger adressehopp.
    private var visKartSok: Bool {
        !dorsalgModus || EntitlementStore.shared.isExplicitlyEnabled(.dorsalgAdresseSok)
    }

    /// Dørsalg: lead-filterne (område/type/status) gjelder kun bedrifter —
    /// vis utfall-filtre i stedet.
    @ViewBuilder
    private var kartChipsForMode: some View {
        if dorsalgModus {
            dorsalgFilterChip(nil, "Alle", icon: "circle.grid.2x2")
            dorsalgFilterChip("ubesokt", "Ubesøkt", icon: "house.fill")
            dorsalgFilterChip("vunnet", "Salg", icon: "checkmark.circle.fill")
            dorsalgFilterChip("ikke_hjemme", "Ikke hjemme", icon: "clock.fill")
            dorsalgFilterChip("avslatt", "Avslått", icon: "xmark.circle.fill")
        } else {
            kartFilterAndActionChips
        }
    }

    private func dorsalgFilterChip(_ verdi: String?, _ label: String,
                                   icon: String) -> some View {
        let aktiv = dorsalgFilter == verdi
        let tint: Color = switch verdi {
        case "vunnet": KrBrand.green
        case "avslatt": KrBrand.red
        case "ikke_hjemme": KrBrand.yellow
        default: KrBrand.purpleLight
        }
        return Button {
            dorsalgFilter = verdi
            oppdaterDorsalgSynlige()
        } label: {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(aktiv ? .white : tint)
                Text(label)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(
                aktiv ? AnyShapeStyle(tint.opacity(verdi == nil ? 0.45 : 0.55))
                      : AnyShapeStyle(KrBrand.card),
                in: RoundedRectangle(cornerRadius: 9)
            )
            .overlay(RoundedRectangle(cornerRadius: 9)
                .stroke(aktiv ? tint.opacity(0.7) : KrBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var kartSearchField: some View {
        HStack(spacing: 7) {
            Image(systemName: "magnifyingglass")
                .font(.appScaled(size: 12))
                .foregroundStyle(KrBrand.textSecondary)
            TextField("", text: $search, prompt: Text("Søk etter sted, lead eller selskap…")
                .foregroundColor(KrBrand.textTertiary))
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .font(.appScaled(size: 12))
                .focused($searchFieldFocused)
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var kartFilterAndActionChips: some View {
            // UI-fokus fase 4: fire dropdowns → én «Filtre · N»-pill.
            // Innholdet er de samme popover-flatene, samlet i ett ark.
            filterChip(label: "Filtre", badge: aktiveFilterCount,
                       active: aktiveFilterCount > 0, isOpen: $filtreOpen,
                       icon: "line.3.horizontal.decrease")
                .popover(isPresented: $filtreOpen, arrowEdge: .top) {
                    SamletFilterPopover(
                        selectedArea: $selectedArea,
                        radiusKm: $selectedRadiusKm,
                        selectedIndustries: $selectedIndustries,
                        selectedStatuses: $selectedStatuses,
                        onFlereFiltre: {
                            filtreOpen = false
                            moreFiltersOpen = true
                        })
                        .presentationCompactAdaptation(.popover)
                }

            // …og handlingene samlet i én «+»-meny (audit-grep 2).
            Menu {
                // Dørsalg: husstander skal aldri inn i CRM — skjul lead-oppretting.
                if !dorsalgModus {
                    Button { addLeadOpen = true } label: {
                        Label("Legg til lead", systemImage: "person.crop.circle.badge.plus")
                    }
                }
                Button { routePlannerOpen = true } label: {
                    Label("Ruteplanlegger", systemImage: "map.fill")
                }
            } label: {
                Image(systemName: "plus")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(
                        LinearGradient(
                            colors: [KrBrand.purple, KrBrand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 9)
                    )
            }
            .buttonStyle(.plain)
    }

    /// Teller for «Filtre · N»-pillen: hver filter-dimensjon med et aktivt
    /// valg teller som 1 (område ≠ alle, ≥1 bransje, ≥1 status).
    private var aktiveFilterCount: Int {
        (selectedArea != .all ? 1 : 0)
            + (selectedIndustries.isEmpty ? 0 : 1)
            + (selectedStatuses.isEmpty ? 0 : 1)
    }

    private func filterChip(label: String, badge: Int?, active: Bool,
                              isOpen: Binding<Bool>, icon: String? = nil) -> some View {
        Button { isOpen.wrappedValue.toggle() } label: {
            HStack(spacing: 5) {
                if let icon {
                    Image(systemName: icon)
                        .font(.appScaled(size: 10, weight: .semibold))
                        .foregroundStyle(active ? KrBrand.purpleLight : KrBrand.textSecondary)
                }
                Text(label)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                if let b = badge, b > 0 {
                    Text("\(b)")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(KrBrand.purple, in: Capsule())
                }
                Image(systemName: "chevron.down")
                    .font(.appScaled(size: 9, weight: .semibold))
                    .foregroundStyle(KrBrand.textTertiary)
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(
                active ? KrBrand.purple.opacity(0.15) : KrBrand.card,
                in: RoundedRectangle(cornerRadius: 9)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 9)
                    .stroke(active ? KrBrand.purple.opacity(0.5) : KrBrand.stroke,
                            lineWidth: active ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    // MARK: Kart-card — FAB-stack bunn-HØYRE (Daniel-feedback 2026-06-29)

    private var mapCard: some View {
        ZStack(alignment: .bottomTrailing) {
            // Selve kart-flate
            Map(position: $camera, interactionModes: [.pan, .zoom]) {
                // "Meg her"-annotasjon: profil-avatar på user-location.
                // Vises kun når CLLocationManager har fått en fix.
                // Tap åpner MePinActionsSheet (2026-07-02).
                if let rawCoord = KartLocationManager.shared.currentCoordinate {
                    // I nav-modus er figuren RUTE-LÅST: den følger punktet
                    // langs rute-polylinja (follow-motoren) — aldri over bygg.
                    let coord = navModeActive
                        ? (navAvatarCoord ?? snapToRoute(rawCoord)) : rawCoord
                    // I nav-modus: 3D gå-avatar (person på puck m/ retnings-stråle
                    // + skygge + gå-bob) som beveger seg. Ellers skjerm-fast MeMapPin.
                    Annotation("Meg", coordinate: coord) {
                        if navModeActive {
                            NavAvatarPuck(initials: appState.initials,
                                          email: appState.userEmail,
                                          vehicle: navVehicle,
                                          moving: KartLocationManager.shared.isMoving
                                              || navSTarget - navSDisplay > 1
                                              || navFollowSpeed > 0.5,
                                          // Rute-tangent − kamera-heading:
                                          // bilen peker alltid LANGS VEIEN.
                                          screenCourse: navTangent.map { $0 - navCamHeading })
                        } else {
                            MeMapPin(initials: appState.initials, email: appState.userEmail)
                                .onTapGesture { zoomToMeAndOpenHUD(coord: coord) }
                        }
                    }
                }
                // 2026-07-18 dørsalg: bedrifts-pins/clusters gates på DATA-nivå
                // (tom liste i dørsalg-modus) i stedet for `if` — holder
                // MapContentBuilder-dybden flat (jf. AnyView-terskel-noten).
                ForEach(dorsalgModus ? [] : KartPreviewData.clusters) { c in
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: c.lat, longitude: c.lon)) {
                        ClusterPin(count: c.count, color: c.color)
                    }
                }
                ForEach(dorsalgModus ? [] : kartLeads) { lead in
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon)) {
                        Button {
                            if measureMode {
                                pickMeasurePoint(CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon))
                            } else {
                                selectAndZoom(lead)
                            }
                        } label: {
                            KartStatusPin(status: lead.status, isSelected: selectedLead.id == lead.id)
                                .overlay(measureRingFor(lead))
                        }
                        .buttonStyle(.plain)
                    }
                }

                // 2026-07-18 dørsalg: husstandsadresse-pins (Kartverket) i
                // systemets pin-design. Farge = utfall (vunnet/avslått).
                // Tom liste utenfor modusen — adressene lagres aldri som CRM.
                // I nav-modus vises KUN målet — 400 pins fløt i lufta i
                // POV-visningen (opptak 2026-07-19).
                ForEach(navModeActive
                        ? dorsalgSynligeAdresser.filter { $0.id == dorsalgValgt?.id }
                        : dorsalgSynligeAdresser) { adr in
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: adr.lat, longitude: adr.lon)) {
                        DorsalgAdressePin(status: dorsalgStatuser[adr.id],
                                          valgt: dorsalgValgt?.id == adr.id) {
                            selectDorsalgAdresse(adr)
                        }
                    }
                }
                // Veiviser til neste dør: stiplet linje fra DEG (Meg-pin,
                // fallback = døra du registrerte) til nærmeste ubesøkte dør.
                // Vises sammen med «Neste dør»-raden i callouten.
                if dorsalgModus, let valgt = dorsalgValgt,
                   dorsalgStatuser[valgt.id] != nil,
                   let neste = nesteDorsalgAdresse(fra: valgt) {
                    let fra = KartLocationManager.shared.currentCoordinate
                        ?? CLLocationCoordinate2D(latitude: valgt.lat, longitude: valgt.lon)
                    MapPolyline(coordinates: [
                        fra,
                        CLLocationCoordinate2D(latitude: neste.lat, longitude: neste.lon),
                    ])
                    .stroke(KrBrand.purpleLight.opacity(0.9),
                            style: StrokeStyle(lineWidth: 3.5, lineCap: .round, dash: [8, 7]))
                }

                // Dropped pin fra long-press
                if let dropped = droppedPin {
                    Annotation("", coordinate: dropped) {
                        DroppedPin()
                    }
                }

                // Mål-polyline mellom A og B
                if let a = measurePointA, let b = measurePointB {
                    MapPolyline(coordinates: [a, b])
                        .stroke(KrBrand.green, style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [8, 6]))
                }

                // Navigasjon: solid «casing»-rute (ekte nav-vei-design).
                navRouteMapContent

                // Visuelle lag (heatmap/territorier/reise-historikk/AI-leads).
                mapVisualLayersContent
            }
            // Navigasjon: standard emphasis (IKKE muted) så GATENE er tydelige —
            // muted gjorde veiene nesten usynlige i det mørke temaet. Flatt kart
            // så figuren/ruta ligger på bakkeplanet. Pitch gir road-ahead-view.
            .mapStyle(navModeActive
                ? .standard(elevation: .flat, emphasis: .automatic, pointsOfInterest: .excludingAll)
                : mapStyle.mapKitStyle)
            // Skjul Apple Maps default-kontroller (zoom-pille + kompass +
            // "Maps Legal" overlay) — vi har vår egen FAB-stack bunn-høyre.
            .mapControls { }
            .onMapCameraChange(frequency: .continuous) { ctx in
                currentRegion = ctx.region
                // 2026-07-18 dørsalg: hent adresser når senteret har flyttet
                // seg > 300 m (debounced m/ Task-cancel — billig no-op ellers).
                dorsalgMaybeFetch()
            }
            .environment(\.colorScheme, .dark)
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // FAB-stack bunn-HØYRE. Knappene fungerer nå:
            //   + / − manipulerer span på currentRegion (zoom 2x/0.5x)
            //   location.fill sentrerer på "min posisjon" (mock = sentrum Oslo)
            //   square.stack.3d.up.fill bytter map-style (kommer senere)
            VStack(spacing: 10) {
                // Zoom-gruppe
                VStack(spacing: 0) {
                    mapFABButton(icon: "plus", action: zoomIn)
                    Divider().overlay(KrBrand.stroke)
                    mapFABButton(icon: "minus", action: zoomOut)
                }
                .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))

                mapFABButton(icon: "location.fill", action: centerOnMe)
                    .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))

                // Fullskjerm-kart (2026-07-18) — hele flaten til kartet.
                mapFABButton(
                    icon: kartFullskjerm
                        ? "arrow.down.right.and.arrow.up.left"
                        : "arrow.up.left.and.arrow.down.right",
                    action: {
                        withAnimation(.easeInOut(duration: 0.25)) { kartFullskjerm.toggle() }
                    }
                )
                .background(
                    kartFullskjerm ? KrBrand.purple.opacity(0.35) : KrBrand.card,
                    in: RoundedRectangle(cornerRadius: 9)
                )
                .overlay(RoundedRectangle(cornerRadius: 9)
                    .stroke(kartFullskjerm ? KrBrand.purpleLight.opacity(0.5) : KrBrand.stroke,
                            lineWidth: 1))

                mapFABButton(icon: "square.stack.3d.up.fill", action: { mapStyleSheetOpen = true })
                    .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))

                // Mål-verktøy: tap to pins → vis distance
                mapFABButton(icon: measureMode ? "ruler.fill" : "ruler", action: toggleMeasureMode)
                    .background(
                        measureMode ? KrBrand.green.opacity(0.25) : KrBrand.card,
                        in: RoundedRectangle(cornerRadius: 9)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 9)
                            .stroke(measureMode ? KrBrand.green.opacity(0.5) : KrBrand.stroke, lineWidth: 1)
                    )

                // Drop pin: legger pin i kart-sentrum + åpner AddLeadSheet
                // forhåndsutfylt. Erstatter long-press (MapKit-gesture-konflikt).
                // Skjult i dørsalg — husstander skal aldri inn i CRM.
                if !dorsalgModus {
                    mapFABButton(icon: "mappin.and.ellipse", action: dropPinAtCenter)
                        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
                }

                // iPhone: «Leads i området» som halv-sheet — listen bor
                // ellers under kartet og krever scroll (2026-07-17).
                // Dørsalg: bedrifts-lista blandes ikke inn.
                if DeviceIdiom.isPhone && !dorsalgModus {
                    mapFABButton(icon: "list.bullet", action: { areaListOpen = true })
                        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
                }
            }
            .fixedSize()
            .padding(14)

            // 2026-07-18 dørsalg: modus-velger topp-senter over kartflaten.
            // Org-gated (visDorsalgToggle) og skjult i nav-/måle-modus.
            // Ren dørsalg-org: fast i dørsalg → ingen toggle.
            if visDorsalgToggle && !erRenDorsalgOrgKart && !navModeActive && !measureMode {
                AnyView(dorsalgModeVelger)
                    .padding(.top, 12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .allowsHitTesting(true)
            }

            // 2026-07-18 dørsalg: status-chips + adresse-callout nederst.
            if dorsalgModus && !navModeActive {
                AnyView(dorsalgBunnOverlay)
                    .padding(10)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .allowsHitTesting(true)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // Mål-banner øverst-til-venstre når i mål-modus
            if measureMode {
                measureBanner
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .allowsHitTesting(true)
            }

            // Navigasjons-banner øverst når live-nav er aktiv
            if navModeActive {
                VStack(spacing: 8) {
                    navManeuverBanner
                    navBanner
                    navPOIStrip
                    if !navAltDismissed, let alt = navAlternatives.first,
                       (alt.savedMin ?? 1) >= 1 {
                        navAlternativeBanner(alt)
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .top)
                .allowsHitTesting(true)
                .transition(.move(edge: .top).combined(with: .opacity))
            }

            // POI-detalj-kort + nærhets-varsler nederst i nav.
            // Dørsalg-gange: bil-POI (lading/bensin/parkering) er irrelevant.
            if navModeActive && !dorsalgModus {
                VStack(spacing: 8) {
                    ForEach(navProximityAlerts) { poi in
                        navProximityAlertRow(poi)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                    if let poi = navSelectedPOI {
                        NavPOIDetailCard(
                            poi: poi,
                            onClose: { withAnimation { navSelectedPOI = nil } },
                            onOpenInMaps: { openPOIInMaps(poi) })
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
                .padding(14)
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                .allowsHitTesting(true)
            }

            // Fartsgrense-skilt (NVDB) — øverst til venstre i nav.
            if navModeActive, let sl = navSpeedLimit {
                navSpeedSign(sl)
                    .padding(14)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .allowsHitTesting(false)
            }

            #if DEBUG
            // Kamera-kalibrering (kun DEBUG) — nede-til-venstre.
            if navModeActive {
                navCalibControls
                    .padding(14)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                    .allowsHitTesting(true)
            }
            #endif

            // Mobil lead-HUD (2026-07-17, Daniel-feedback): på iPhone ligger
            // detail-panelet UNDER kartet (krever scroll) — vis derfor et
            // kompakt handlingskort over kartet når en pin er valgt, samme
            // mønster som Apple Maps. iPad har side-panelet synlig og
            // trenger det ikke.
            if DeviceIdiom.isPhone && hasSelectedLead && !navModeActive && !measureMode && !dorsalgModus {
                AnyView(phoneLeadHUD)
                    .padding(10)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .allowsHitTesting(true)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(KrBrand.stroke, lineWidth: 1)
        )
        // Feiring etter registrert salg — konfetti + sjekk-pop over kartet,
        // med milepæl mot dagsmålet.
        .overlay {
            if dorsalgFeiring {
                SalgFeiringView(antall: dorsalgDagensSalg, maal: dorsalgDagsmal)
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }
        }
        // Motivasjon etter avslag — diskret kort øverst, forsvinner selv.
        .overlay(alignment: .top) {
            if let frase = dorsalgMotivasjon {
                HStack(spacing: 10) {
                    Image(systemName: "figure.walk.motion")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(KrBrand.purpleLight)
                    Text(frase)
                        .font(.appScaled(size: 14, weight: .heavy))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(.ultraThinMaterial, in: Capsule())
                .background(KrBrand.purple.opacity(0.45), in: Capsule())
                .overlay(Capsule().stroke(KrBrand.purpleLight.opacity(0.5), lineWidth: 1))
                .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
                .padding(.top, 52)
                .allowsHitTesting(false)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    // MARK: Mobil lead-HUD

    /// Kompakt kort over kartet på iPhone: navn/status/avstand + Naviger,
    /// Ring (når nummer finnes) og «Detaljer» (åpner LeadDetailFullSheet).
    private var phoneLeadHUD: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(selectedLead.status.color.opacity(0.22))
                Image(systemName: selectedLead.status.icon)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(selectedLead.status.color)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(selectedLead.name)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("\(String(format: "%.1f", selectedLead.kmAway)) km · \(selectedLead.status.label)")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(KrBrand.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 6)
            if let phone = selectedLead.phoneOrDemo {
                Button { makeCall(phone) } label: {
                    hudIcon("phone.fill")
                }
                .buttonStyle(.plain)
            }
            Button { startNavigation(to: selectedLead) } label: {
                hudIcon("location.fill")
            }
            .buttonStyle(.plain)
            Button { openLeadFullSheet = true } label: {
                Text("Detaljer")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(
                        LinearGradient(colors: [KrBrand.purple, KrBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .background(KrBrand.card.opacity(0.6), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(KrBrand.stroke, lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 10, y: 4)
    }

    private func hudIcon(_ name: String) -> some View {
        ZStack {
            Circle().fill(KrBrand.purple.opacity(0.20))
            Image(systemName: name)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(KrBrand.purpleLight)
        }
        .frame(width: 34, height: 34)
    }

    // MARK: - Dørsalg-modus (2026-07-18)

    /// Kapsel-toggle topp-senter: «Bedrifter» | «Dørsalg». To adskilte
    /// verdener på samme kart — bytte animeres.
    private var dorsalgModeVelger: some View {
        HStack(spacing: 0) {
            dorsalgSegment("Bedrifter", icon: "building.2.fill", aktiv: !dorsalgModus) {
                setDorsalgModus(false)
            }
            dorsalgSegment("Dørsalg", icon: "door.left.hand.open", aktiv: dorsalgModus) {
                setDorsalgModus(true)
            }
        }
        .padding(3)
        .background(.ultraThinMaterial, in: Capsule())
        .background(KrBrand.card.opacity(0.65), in: Capsule())
        .overlay(Capsule().stroke(KrBrand.stroke, lineWidth: 1))
        .shadow(color: .black.opacity(0.3), radius: 8, y: 3)
    }

    private func dorsalgSegment(_ label: String, icon: String, aktiv: Bool,
                                action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.appScaled(size: 11, weight: .semibold))
                Text(label)
                    .font(.appScaled(size: 12, weight: .bold))
            }
            .foregroundStyle(aktiv ? .white : KrBrand.textSecondary)
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(
                aktiv
                    ? AnyShapeStyle(LinearGradient(colors: [KrBrand.purple, KrBrand.purpleLight],
                                                   startPoint: .leading, endPoint: .trailing))
                    : AnyShapeStyle(Color.clear),
                in: Capsule()
            )
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    /// Motivasjon etter avslag: kort oppmuntring + neste-dør-fokus.
    /// Pondus-tonen: avslag er statistikk, ikke nederlag.
    private static let dorsalgMotivasjonsfraser = [
        "Hvert nei er ett steg nærmere et ja.",
        "Rist det av deg — neste dør venter.",
        "Proffene teller dører, ikke avslag.",
        "Snittet ditt vinner over tid. Videre!",
        "Ett nei til unna. Fortsett!",
    ]

    private func visDorsalgMotivasjon() {
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        let frase = Self.dorsalgMotivasjonsfraser[
            dorsalgAvslagTeller % Self.dorsalgMotivasjonsfraser.count]
        dorsalgAvslagTeller += 1
        withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
            dorsalgMotivasjon = frase
        }
        Task {
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            withAnimation(.easeOut(duration: 0.35)) { dorsalgMotivasjon = nil }
        }
    }

    /// Feiring etter registrert salg: konfetti + sjekk-pop + suksess-haptikk
    /// + milepæl mot dagsmålet («2 av 3» / «Dagsmål nådd!»).
    /// Auto-dismiss (litt lenger når målet nås).
    private func visDorsalgFeiring() {
        dorsalgDagensSalg += 1
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        withAnimation(.easeOut(duration: 0.2)) { dorsalgFeiring = true }
        let varighet: UInt64 = dorsalgDagensSalg >= dorsalgDagsmal
            ? 2_600_000_000 : 1_800_000_000
        Task {
            try? await Task.sleep(nanoseconds: varighet)
            withAnimation(.easeOut(duration: 0.35)) { dorsalgFeiring = false }
        }
    }

    /// Bytt modus (animeres). Ut av dørsalg → rydd valgt/task; inn → hent.
    private func setDorsalgModus(_ on: Bool) {
        guard dorsalgModus != on else { return }
        withAnimation(.easeInOut(duration: 0.3)) {
            dorsalgModus = on
            dorsalgValgt = nil
        }
        if on {
            // Lead-baserte kartlag av — de hører til bedrifts-verdenen
            // (territorier + team-på-kartet beholdes).
            activeOverlays.subtract([.heatmap, .aiLeads, .travelHistory, .dataOverlay])
            oppdaterDorsalgSynlige()   // vis alt cachet umiddelbart
            // Prefetch HELE nabolaget (Kartverkets 2000 m-maks) med én gang —
            // pin-til-pin og «Neste dør» skal aldri vente på nett (Daniels
            // UX-funn: treg flytting mellom pins ved zoom-styrt liten radius).
            let senter = currentRegion.center
            dorsalgFetchTask?.cancel()
            dorsalgFetchTask = Task {
                await dorsalgFetch(senter: senter, radius: 2000)
                oppdaterDorsalgSynlige()
            }
            dorsalgLastStatuser()
            dorsalgLastProdukter()
            dorsalgLastDagsmal()
        } else {
            dorsalgFetchTask?.cancel()
            dorsalgFetchTask = nil
            dorsalgLaster = false
            dorsalgSynligeAdresser = []
        }
    }

    /// Hent selgerens resolverte dagsmål (team-først) fra backend —
    /// driver milepæl-feiringen. Demo: behold 3 (salgssjef-styrt live).
    private func dorsalgLastDagsmal() {
        guard !DemoModeManager.isActiveNonisolated, let api = appState.api else { return }
        Task {
            if let m = await KartverketService.shared.fetchDorsalgMaal(using: api) {
                dorsalgDagsmal = max(1, m.mittDagsmal)
            }
        }
    }

    /// Hent org-ens husstands-statuser én gang per økt (demo: kun minne).
    private func dorsalgLastStatuser() {
        guard !dorsalgStatuserLastet else { return }
        guard !DemoModeManager.isActiveNonisolated, let api = appState.api else {
            dorsalgStatuserLastet = true
            return
        }
        Task {
            let statuser = await KartverketService.shared.fetchDorsalgStatuser(using: api)
            if !statuser.isEmpty { dorsalgStatuser = statuser }
            dorsalgStatuserLastet = true
        }
    }

    /// Produktkatalogen — hentes én gang per økt (demo: to demo-produkter).
    private func dorsalgLastProdukter() {
        guard dorsalgProdukter == nil else { return }
        if DemoModeManager.isActiveNonisolated {
            dorsalgProdukter = KartverketService.DorsalgProductsEnvelope(
                canManage: true, mine: [],
                products: [
                    .init(id: "demo-p1", navn: "SOS Barnebyer",
                          farge: "#22C55E", aktiv: true, verdiPerVunnet: 450,
                          bidrag: [.init(belop: 250, label: "Fadder"),
                                   .init(belop: 350, label: "Fadder+"),
                                   .init(belop: 500, label: "Fadder+")],
                          samtykkeTekst: "Jeg ønsker å bli fadder i SOS Barnebyer og godtar at SOS Barnebyer kontakter meg for å sette opp betalingsavtalen. Jeg har 14 dagers angrerett.",
                          signeringUrl: nil),
                    .init(id: "demo-p2", navn: "Kirkens Bymisjon",
                          farge: "#3B82F6", aktiv: true, verdiPerVunnet: 390,
                          bidrag: [.init(belop: 200, label: "Fast giver"),
                                   .init(belop: 300, label: "Fast giver")],
                          samtykkeTekst: "Jeg ønsker å bli fast giver i Kirkens Bymisjon og godtar at de kontakter meg for å sette opp betalingsavtalen. Jeg har 14 dagers angrerett.",
                          signeringUrl: nil),
                ])
            return
        }
        guard let api = appState.api else { return }
        Task {
            dorsalgProdukter = await KartverketService.shared.fetchDorsalgProducts(using: api)
        }
    }

    /// Sett/angre utfall på en dør. Optimistisk lokal oppdatering; backend
    /// best effort (org-lagret). Demo skriver ALDRI til backend.
    /// produktId: hvilket produkt som ble vunnet (org m/ flere produkter).
    private func dorsalgSettStatus(_ status: String?,
                                   produktId: String? = nil,
                                   for adr: KartverketService.AdressePunkt) {
        withAnimation(.easeOut(duration: 0.2)) {
            if let status {
                dorsalgStatuser[adr.id] = status
            } else {
                dorsalgStatuser.removeValue(forKey: adr.id)
            }
        }
        // Avslag → kort motivasjon (Neste dør-veiviseren tar over fokus).
        if status == "avslatt" { visDorsalgMotivasjon() }
        // Aktivt utfall-filter: adressen kan ha byttet gruppe.
        if dorsalgFilter != nil { oppdaterDorsalgSynlige() }
        guard !DemoModeManager.isActiveNonisolated, let api = appState.api else { return }
        Task {
            if let status {
                await KartverketService.shared.setDorsalgStatus(
                    status, for: adr, productId: produktId, using: api)
            } else {
                await KartverketService.shared.clearDorsalgStatus(adresseId: adr.id, using: api)
            }
        }
    }

    /// Status-chips + adresse-callout nederst på kartet i dørsalg-modus.
    @ViewBuilder
    private var dorsalgBunnOverlay: some View {
        VStack(spacing: 8) {
            if !dorsalgZoomOK {
                dorsalgChip(icon: "plus.magnifyingglass", text: "Zoom inn for å se adresser")
            } else if dorsalgLaster {
                dorsalgChip(icon: "antenna.radiowaves.left.and.right",
                            text: "Henter adresser fra Kartverket…")
            } else if dorsalgAdresser.count > 400 {
                // Ærlig cap-chip: vi rendrer kun de 400 nærmeste senteret.
                dorsalgChip(icon: "circle.grid.2x2.fill",
                            text: "Viser 400 av \(max(dorsalgTotal, dorsalgAdresser.count)) adresser")
            } else if !dorsalgAdresser.isEmpty {
                dorsalgChip(icon: "house.fill",
                            text: "\(dorsalgAdresser.count) adresser i området")
            }
            if let adr = dorsalgValgt {
                dorsalgCallout(adr)
            }
        }
        .frame(maxWidth: 480)
    }

    private func dorsalgChip(icon: String, text: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.appScaled(size: 10, weight: .semibold))
                .foregroundStyle(KrBrand.purpleLight)
            Text(text)
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
        .background(.ultraThinMaterial, in: Capsule())
        .background(KrBrand.card.opacity(0.6), in: Capsule())
        .overlay(Capsule().stroke(KrBrand.stroke, lineWidth: 1))
    }

    /// Kompakt callout for en valgt husstandsadresse: adresse + postnr/sted
    /// + «Naviger» + utfall-knapper (Vunnet/Avslått — org-lagret, mig 0397).
    /// Adressen selv lagres fortsatt aldri i CRM.
    private func dorsalgCallout(_ adr: KartverketService.AdressePunkt) -> some View {
        VStack(spacing: 9) {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(KrBrand.purpleLight.opacity(0.22))
                Image(systemName: "house.fill")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(KrBrand.purpleLight)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(adr.adressetekst)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("\(adr.postnummer) \(adr.poststed)")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(KrBrand.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 6)
            Button { dorsalgNaviger(til: adr) } label: {
                HStack(spacing: 5) {
                    Image(systemName: "location.fill")
                        .font(.appScaled(size: 11, weight: .semibold))
                    Text("Naviger")
                        .font(.appScaled(size: 12, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(
                    LinearGradient(colors: [KrBrand.purple, KrBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Capsule()
                )
            }
            .buttonStyle(.plain)
            Button {
                withAnimation(.easeOut(duration: 0.2)) { dorsalgValgt = nil }
            } label: {
                Image(systemName: "xmark")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(KrBrand.textSecondary)
                    .frame(width: 30, height: 30)
                    .background(KrBrand.card.opacity(0.8), in: Circle())
                    .overlay(Circle().stroke(KrBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        // Utfall på døra: toggle = angre. Pin-fargen følger valget.
        // «Registrer salg» åpner det ekte salgsskjemaet (mig 0400).
        HStack(spacing: 8) {
            dorsalgUtfallKnapp(adr, status: "vunnet", label: "Registrer salg",
                               icon: "checkmark.circle.fill", tint: KrBrand.green)
            dorsalgUtfallKnapp(adr, status: "ikke_hjemme", label: "Ikke hjemme",
                               icon: "clock.fill", tint: KrBrand.yellow)
            dorsalgUtfallKnapp(adr, status: "avslatt", label: "Avslått",
                               icon: "xmark.circle.fill", tint: KrBrand.red)
        }
        // «Neste dør»: når utfallet er registrert, vis nærmeste ubesøkte
        // dør med avstand + retning. Origo = DIN posisjon (Meg-pin) når
        // GPS har fix — ellers døra du nettopp registrerte.
        if dorsalgStatuser[adr.id] != nil,
           let neste = nesteDorsalgAdresse(fra: adr) {
            let origo = KartLocationManager.shared.currentCoordinate
                ?? CLLocationCoordinate2D(latitude: adr.lat, longitude: adr.lon)
            let meter = Int(CLLocation(latitude: origo.latitude, longitude: origo.longitude)
                .distance(from: CLLocation(latitude: neste.lat, longitude: neste.lon))
                .rounded())
            let grader = bearing(
                origo,
                CLLocationCoordinate2D(latitude: neste.lat, longitude: neste.lon))
            Button { selectDorsalgAdresse(neste) } label: {
                HStack(spacing: 10) {
                    // Mini-kompass: N-merke + nål som peker mot neste dør.
                    ZStack {
                        Circle().fill(KrBrand.purpleLight.opacity(0.16))
                        Circle().stroke(KrBrand.purpleLight.opacity(0.45), lineWidth: 1)
                        Text("N")
                            .font(.appScaled(size: 6, weight: .black))
                            .foregroundStyle(KrBrand.textSecondary)
                            .offset(y: -10)
                        Image(systemName: "location.north.fill")
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(KrBrand.purpleLight)
                            .rotationEffect(.degrees(grader))
                    }
                    .frame(width: 32, height: 32)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Neste dør: \(neste.adressetekst)")
                            .font(.appScaled(size: 12, weight: .bold))
                            .lineLimit(1)
                        Text("\(meter) m mot \(dorsalgKompassOrd(grader)) herfra")
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(KrBrand.textSecondary)
                    }
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.right")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(KrBrand.textSecondary)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10).padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(KrBrand.purple.opacity(0.28), in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11)
                    .stroke(KrBrand.purpleLight.opacity(0.5), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .transition(.opacity.combined(with: .move(edge: .bottom)))
        }
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .background(KrBrand.card.opacity(0.6), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(KrBrand.stroke, lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 10, y: 4)
    }

    private func dorsalgUtfallKnapp(_ adr: KartverketService.AdressePunkt,
                                    status: String, label: String,
                                    icon: String, tint: Color) -> some View {
        let aktiv = dorsalgStatuser[adr.id] == status
        return Button {
            if aktiv {
                dorsalgSettStatus(nil, for: adr)                 // angre
            } else if status == "vunnet" {
                // Vunnet = EKTE salg — åpne registreringsskjemaet
                // (produkt, bidrag, kunde, samtykke — aldri betalingsdata).
                dorsalgSalgFor = adr
            } else {
                dorsalgSettStatus(status, for: adr)
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.appScaled(size: 12, weight: .bold))
                Text(label)
                    .font(.appScaled(size: 12, weight: .bold))
                    .lineLimit(1)
            }
            .foregroundStyle(aktiv ? .white : tint)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9)
            .background(
                aktiv ? AnyShapeStyle(tint) : AnyShapeStyle(tint.opacity(0.14)),
                in: Capsule()
            )
            .overlay(Capsule().stroke(tint.opacity(aktiv ? 0 : 0.45), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    /// Naviger til husstandsadresse: konstruer en flyktig MapLeadMock KUN
    /// for nav-motoren (startNavigation). Ingen lagring, ingen CRM.
    private func dorsalgNaviger(til adr: KartverketService.AdressePunkt) {
        let dest = MapLeadMock(
            name: adr.adressetekst,
            address: "\(adr.adressetekst), \(adr.postnummer) \(adr.poststed)",
            kmAway: 0,
            status: .new,
            lastActivity: nil,
            lat: adr.lat, lon: adr.lon
        )
        // Dørsalg = til fots, korte etapper: tving gange (ikke auto-bil),
        // dropp bil-POI-varsler (lading/bensin) og bruk oversikts-kamera —
        // POV-pitch på 50 m gange havnet inne i 3D-bygg (opptak 2026-07-19).
        navTransport = .walking
        navTransportAuto = false
        withAnimation(.easeInOut(duration: 0.4)) { startNavigation(to: dest) }
        navPOIActiveKinds = []
        navPreset = .overview
        navPresetManual = true
        // startNavigation flyttet alt kameraet med sitt preset — flytt igjen
        // med oversikts-preset (POV sto inne i 3D-bygg på 50 m-gange).
        updateNavCamera(animated: true)
        // Når selgeren faktisk begynner å gå → auto-bytt til gå-POV.
        dorsalgNavAutoPOV = true
    }

    /// Debounced henting: no-op utenfor modusen, ved for stort kartspenn
    /// (chip sier «Zoom inn») eller når senteret er nær forrige hent
    /// (terskel = radius/3 — panorering innen samme nabolag re-fetcher ikke).
    private func dorsalgMaybeFetch(force: Bool = false) {
        guard dorsalgModus else { return }
        let senter = currentRegion.center
        // Synlig radius i meter (halve lat-spennet), klampet til Kartverkets
        // 2000 m-maks og et 800 m-gulv: husnivå-zoom skal ikke gi bittesmå
        // hyppige hentinger — nabolaget er alt prefetchet (setDorsalgModus).
        let radius = min(2000, max(800, Int(currentRegion.span.latitudeDelta * 111_000 / 2)))
        dorsalgFetchTask?.cancel()
        dorsalgFetchTask = Task {
            // Kort debounce — kanselleres av neste kamera-tick. Viktig:
            // synlig-lista oppdateres KUN her (etter at kartet har roet seg),
            // aldri per frame — det er hele ytelses-poenget.
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            oppdaterDorsalgSynlige()
            guard dorsalgZoomOK else { return }
            if !force, let forrige = dorsalgFetchSenter,
               metersBetween(forrige, senter) < max(150, Double(radius) / 3) { return }
            await dorsalgFetch(senter: senter, radius: radius)
        }
    }

    /// Hent side 0 (1000 per side — Kartverkets maks) + inntil 2 ekstra
    /// sider PARALLELT når total > 1000. Nye adresser AKKUMULERES inn i
    /// eksisterende liste (panorering blanker ikke naboområdet); ved > 3000
    /// beholdes de 3000 nærmeste senteret.
    private func dorsalgFetch(senter: CLLocationCoordinate2D, radius: Int) async {
        guard let api = appState.api else {
            // Demo uten backend: 25 statiske adresser rundt Oslo sentrum så
            // pitchen kan vises uten innlogget API.
            if DemoModeManager.isActiveNonisolated {
                dorsalgAdresser = Self.dorsalgDemoAdresser
                dorsalgTotal = Self.dorsalgDemoAdresser.count
                dorsalgFetchSenter = senter
                // Et par forhåndssatte utfall så pin-fargene vises i demo.
                if dorsalgStatuser.isEmpty {
                    dorsalgStatuser = ["Storgata 8|0155": "vunnet",
                                       "Torggata 15|0181": "vunnet",
                                       "Grensen 5|0159": "avslatt",
                                       "Møllergata 24|0179": "ikke_hjemme"]
                }
                oppdaterDorsalgSynlige()
            }
            return
        }
        dorsalgLaster = true
        let (side0, total) = await KartverketService.shared.fetchAdresser(
            lat: senter.latitude, lon: senter.longitude,
            radius: radius, side: 0, using: api)
        guard !Task.isCancelled else { dorsalgLaster = false; return }
        var alle = side0
        if total > 1000 {
            let sisteSide = min(2, (total - 1) / 1000)
            // Parallelt — sidene er uavhengige backend-cachede kall.
            await withTaskGroup(of: [KartverketService.AdressePunkt].self) { group in
                for side in 1...sisteSide {
                    group.addTask {
                        let (mer, _) = await KartverketService.shared.fetchAdresser(
                            lat: senter.latitude, lon: senter.longitude,
                            radius: radius, side: side, using: api)
                        return mer
                    }
                }
                for await mer in group { alle += mer }
            }
            guard !Task.isCancelled else { dorsalgLaster = false; return }
        }
        // Akkumuler: behold det vi alt har + nye (dedup på id) — panorering
        // føles da som at kartet «fylles på» i stedet for å blinke.
        var byId = Dictionary(dorsalgAdresser.map { ($0.id, $0) },
                              uniquingKeysWith: { a, _ in a })
        for adr in alle { byId[adr.id] = adr }
        var samlet = Array(byId.values)
        if samlet.count > 3000 {
            func d2(_ a: KartverketService.AdressePunkt) -> Double {
                let dLat = a.lat - senter.latitude
                let dLon = (a.lon - senter.longitude) * cos(senter.latitude * .pi / 180)
                return dLat * dLat + dLon * dLon
            }
            samlet = Array(samlet.sorted { d2($0) < d2($1) }.prefix(3000))
        }
        dorsalgAdresser = samlet
        dorsalgTotal = max(total, samlet.count)
        dorsalgFetchSenter = senter
        dorsalgLaster = false
        oppdaterDorsalgSynlige()
    }

    /// 25 statiske demo-adresser rundt Oslo sentrum (kun demo uten API).
    private static let dorsalgDemoAdresser: [KartverketService.AdressePunkt] = [
        .init(adressetekst: "Karl Johans gate 12", postnummer: "0154", poststed: "Oslo", lat: 59.9115, lon: 10.7454),
        .init(adressetekst: "Storgata 8",          postnummer: "0155", poststed: "Oslo", lat: 59.9132, lon: 10.7488),
        .init(adressetekst: "Storgata 21",         postnummer: "0184", poststed: "Oslo", lat: 59.9146, lon: 10.7530),
        .init(adressetekst: "Torggata 15",         postnummer: "0181", poststed: "Oslo", lat: 59.9158, lon: 10.7509),
        .init(adressetekst: "Torggata 30",         postnummer: "0183", poststed: "Oslo", lat: 59.9172, lon: 10.7521),
        .init(adressetekst: "Grensen 5",           postnummer: "0159", poststed: "Oslo", lat: 59.9139, lon: 10.7412),
        .init(adressetekst: "Akersgata 32",        postnummer: "0180", poststed: "Oslo", lat: 59.9151, lon: 10.7443),
        .init(adressetekst: "Møllergata 24",       postnummer: "0179", poststed: "Oslo", lat: 59.9163, lon: 10.7478),
        .init(adressetekst: "Youngs gate 7",       postnummer: "0181", poststed: "Oslo", lat: 59.9155, lon: 10.7495),
        .init(adressetekst: "Calmeyers gate 6",    postnummer: "0183", poststed: "Oslo", lat: 59.9178, lon: 10.7539),
        .init(adressetekst: "Hausmanns gate 19",   postnummer: "0182", poststed: "Oslo", lat: 59.9186, lon: 10.7554),
        .init(adressetekst: "Osterhaus' gate 11",  postnummer: "0183", poststed: "Oslo", lat: 59.9180, lon: 10.7518),
        .init(adressetekst: "Bernt Ankers gate 4", postnummer: "0183", poststed: "Oslo", lat: 59.9167, lon: 10.7506),
        .init(adressetekst: "Pløens gate 2",       postnummer: "0181", poststed: "Oslo", lat: 59.9150, lon: 10.7487),
        .init(adressetekst: "Skippergata 22",      postnummer: "0154", poststed: "Oslo", lat: 59.9105, lon: 10.7448),
        .init(adressetekst: "Dronningens gate 15", postnummer: "0152", poststed: "Oslo", lat: 59.9098, lon: 10.7422),
        .init(adressetekst: "Prinsens gate 10",    postnummer: "0152", poststed: "Oslo", lat: 59.9091, lon: 10.7405),
        .init(adressetekst: "Tollbugata 8",        postnummer: "0152", poststed: "Oslo", lat: 59.9084, lon: 10.7419),
        .init(adressetekst: "Kirkegata 20",        postnummer: "0153", poststed: "Oslo", lat: 59.9102, lon: 10.7401),
        .init(adressetekst: "Nedre Slottsgate 13", postnummer: "0157", poststed: "Oslo", lat: 59.9110, lon: 10.7389),
        .init(adressetekst: "Øvre Slottsgate 18",  postnummer: "0157", poststed: "Oslo", lat: 59.9121, lon: 10.7395),
        .init(adressetekst: "Rosenkrantz' gate 9", postnummer: "0159", poststed: "Oslo", lat: 59.9130, lon: 10.7378),
        .init(adressetekst: "Kristian IVs gate 6", postnummer: "0164", poststed: "Oslo", lat: 59.9142, lon: 10.7385),
        .init(adressetekst: "Pilestredet 17",      postnummer: "0164", poststed: "Oslo", lat: 59.9160, lon: 10.7392),
        .init(adressetekst: "St. Olavs gate 4",    postnummer: "0165", poststed: "Oslo", lat: 59.9171, lon: 10.7406),
    ]

    private func mapFAB(icon: String) -> some View {
        Image(systemName: icon)
            .font(.appScaled(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 32, height: 32)
    }

    /// Tappbar versjon av mapFAB — wraps Image i en Button m/ plain-style.
    private func mapFABButton(icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            mapFAB(icon: icon)
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    /// Zoom inn ved å halvere span. Klampes til min-grense slik at
    /// brukeren ikke kan zoome forbi gate-nivå (~25m).
    private func zoomIn() {
        let minDelta = 0.001  // ~100m
        let newLat = max(minDelta, currentRegion.span.latitudeDelta * 0.5)
        let newLon = max(minDelta, currentRegion.span.longitudeDelta * 0.5)
        let newRegion = MKCoordinateRegion(
            center: currentRegion.center,
            span: MKCoordinateSpan(latitudeDelta: newLat, longitudeDelta: newLon)
        )
        currentRegion = newRegion
        withAnimation(.easeInOut(duration: 0.3)) {
            camera = .region(newRegion)
        }
    }

    /// Zoom ut ved å doble span. Klampes til nesten-hele-jorden
    /// (180° lat er teoretisk max, ~120° realistisk før MapKit klamper selv).
    ///
    /// Bug-fix 2026-07-01: forrige maxDelta=10.0 gjorde at brukere fikk 7
    /// taps før knappen ble en no-op — så det så ut som «zoom-ut fungerer
    /// ikke». Nå kan man zoome helt ut til hele Norge/Skandinavia.
    private func zoomOut() {
        let maxDelta = 120.0
        let currentLat = max(currentRegion.span.latitudeDelta, 0.001)
        let currentLon = max(currentRegion.span.longitudeDelta, 0.001)
        let newLat = min(maxDelta, currentLat * 2.0)
        let newLon = min(maxDelta, currentLon * 2.0)
        let newRegion = MKCoordinateRegion(
            center: currentRegion.center,
            span: MKCoordinateSpan(latitudeDelta: newLat, longitudeDelta: newLon)
        )
        currentRegion = newRegion
        withAnimation(.easeInOut(duration: 0.35)) {
            camera = .region(newRegion)
        }
    }

    /// Vis kort toast-melding bunn-på-skjerm. Auto-dismisses etter 2.5s.
    private func showToast(_ message: String) {
        toastTask?.cancel()
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            toastMessage = message
        }
        toastTask = Task {
            try? await Task.sleep(for: .seconds(2.5))
            if !Task.isCancelled {
                await MainActor.run {
                    withAnimation(.easeOut(duration: 0.25)) {
                        toastMessage = nil
                    }
                }
            }
        }
    }

    private func toastBanner(_ msg: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(KrBrand.green)
            Text(msg)
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(KrBrand.card, in: Capsule())
        .overlay(Capsule().stroke(KrBrand.stroke, lineWidth: 1))
        .shadow(color: Color.black.opacity(0.4), radius: 12, x: 0, y: 4)
    }

    /// Helper for å ringe telefonnummer via tel:-URL.
    private func makeCall(_ number: String) {
        let cleaned = number.filter { $0.isNumber || $0 == "+" }
        if let url = URL(string: "tel://\(cleaned)") {
            UIApplication.shared.open(url) { ok in
                if !ok { Task { @MainActor in showToast("Kan ikke ringe fra denne enheten") } }
            }
        }
    }

    /// Helper for å sende e-post via mailto:-URL.
    private func sendEmail(_ email: String, subject: String = "") {
        let subj = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        if let url = URL(string: "mailto:\(email)?subject=\(subj)") {
            UIApplication.shared.open(url) { ok in
                if !ok { Task { @MainActor in showToast("Ingen e-post-app konfigurert") } }
            }
        }
    }

    /// Ett-klikks «meld forsinkelse»: komponerer en ferdig e-post til møte-
    /// kontakten om at du er forsinket, med ny beregnet ankomst og (når DATEX
    /// er koblet på) grunnen — f.eks. «en ulykke på veien». Åpner e-post-
    /// komponisten så brukeren bekrefter og sender selv.
    private func sendDelayNotice(to email: String, etaMin: Int?, reason: String?) {
        let subject = "Forsinket til møtet"
        var body = "Hei,\n\nJeg er dessverre litt forsinket til møtet vårt"
        if let r = reason, !r.isEmpty { body += " på grunn av \(r)" }
        body += "."
        if let eta = etaMin, eta > 0 { body += " Beregnet ankomst om ca. \(eta) minutter." }
        body += "\n\nBeklager ulempen — sees straks.\n\nMvh"
        let subj = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let bod = body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        if let url = URL(string: "mailto:\(email)?subject=\(subj)&body=\(bod)") {
            UIApplication.shared.open(url) { ok in
                if ok { Task { @MainActor in showToast("Forsinkelses-melding klar til sending") } }
                else { Task { @MainActor in showToast("Ingen e-post-app konfigurert") } }
            }
        }
    }

    /// Åpne adresse i Apple Maps for navigasjon.
    private func navigateTo(_ lead: MapLeadMock) {
        let q = "\(lead.name), \(lead.address)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        if let url = URL(string: "maps://?q=\(q)&ll=\(lead.lat),\(lead.lon)") {
            UIApplication.shared.open(url)
        }
    }

    /// Drop pin på kart-sentrum + åpner AddLeadSheet forhåndsutfylt.
    /// I prod: reverse-geocode koordinaten via CLGeocoder for adresse.
    private func dropPinAtCenter() {
        droppedPin = currentRegion.center
        addLeadFromPin = true
        addLeadOpen = true
        showToast("Pin droppet — fyller ut lead...")
    }

    /// Toggle mål-modus. Resetter punkter når avskrudd.
    private func toggleMeasureMode() {
        measureMode.toggle()
        if !measureMode {
            measurePointA = nil
            measurePointB = nil
        } else {
            showToast("Tap to pins på kartet for å måle")
        }
    }

    /// Tap en pin mens i mål-modus.
    private func pickMeasurePoint(_ coord: CLLocationCoordinate2D) {
        if measurePointA == nil {
            measurePointA = coord
        } else if measurePointB == nil {
            measurePointB = coord
        } else {
            // 3. tap = restart
            measurePointA = coord
            measurePointB = nil
        }
    }

    /// Vis grønt ring rundt pin når den er valgt som mål-punkt.
    @ViewBuilder
    private func measureRingFor(_ lead: MapLeadMock) -> some View {
        let coord = CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon)
        let isA = measurePointA?.latitude == coord.latitude && measurePointA?.longitude == coord.longitude
        let isB = measurePointB?.latitude == coord.latitude && measurePointB?.longitude == coord.longitude
        if isA || isB {
            Circle()
                .stroke(KrBrand.green, lineWidth: 3)
                .frame(width: 56, height: 56)
                .background(
                    Text(isA ? "A" : "B")
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(KrBrand.green, in: Capsule())
                        .offset(x: 22, y: -22)
                )
        }
    }

    /// Banner som vises øverst på kartet i mål-modus med distance.
    private var measureBanner: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(KrBrand.green.opacity(0.25))
                Image(systemName: "ruler.fill")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(KrBrand.green)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text("Mål-verktøy")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                if let a = measurePointA, let b = measurePointB {
                    let km = distanceKm(a, b)
                    let drive = Int(km * 2)
                    Text(String(format: "%.2f km · %d min kjøring", km, drive))
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(KrBrand.green)
                } else if measurePointA != nil {
                    Text("Tap pin B")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(KrBrand.textSecondary)
                } else {
                    Text("Tap pin A")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(KrBrand.textSecondary)
                }
            }
            Spacer(minLength: 4)
            Button {
                measurePointA = nil
                measurePointB = nil
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.appScaled(size: 16))
                    .foregroundStyle(KrBrand.textTertiary)
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(KrBrand.green.opacity(0.4), lineWidth: 1))
        .frame(maxWidth: 240)
    }

    /// Norsk fartsgrense-skilt (rød ring, hvit bakgrunn, svart tall).
    private func navSpeedSign(_ limit: Int) -> some View {
        ZStack {
            Circle().fill(.white).frame(width: 54, height: 54)
            Circle().strokeBorder(Color.red, lineWidth: 7).frame(width: 54, height: 54)
            Text("\(limit)").font(.system(size: 20, weight: .heavy, design: .rounded)).foregroundStyle(.black)
        }
        .shadow(color: .black.opacity(0.35), radius: 4, x: 0, y: 2)
    }

    /// Manøver-banner øverst: neste sving/instruksjon + avstand til den.
    @ViewBuilder
    private var navManeuverBanner: some View {
        if !navArrived, !navSteps.isEmpty, navStepIndex < navSteps.count {
            let step = navSteps[navStepIndex]
            let d = KartLocationManager.shared.currentCoordinate.map { metersBetween($0, step.coord) }
            HStack(spacing: 12) {
                Image(systemName: step.icon)
                    .font(.appScaled(size: 24, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 46, height: 46)
                    .background(LinearGradient(colors: [KrBrand.purpleLight, KrBrand.purple],
                                               startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    if let d {
                        Text(d < 1000 ? "\(Int(d / 5) * 5) m" : String(format: "%.1f km", d / 1000))
                            .font(.appScaled(size: 15, weight: .heavy)).foregroundStyle(KrBrand.purpleLight)
                    }
                    Text(step.text)
                        .font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white).lineLimit(2)
                }
                Spacer(minLength: 4)
                // Stemme av/på
                Button { navVoiceOn.toggle() } label: {
                    Image(systemName: navVoiceOn ? "speaker.wave.2.fill" : "speaker.slash.fill")
                        .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 34, height: 34)
                        .background(KrBrand.card, in: Circle())
                        .overlay(Circle().stroke(KrBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            .padding(12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
            .background(KrBrand.card.opacity(0.92), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(KrBrand.purpleLight.opacity(0.5), lineWidth: 1))
            .frame(maxWidth: 480)
            .shadow(color: KrBrand.purple.opacity(0.35), radius: 12, x: 0, y: 4)
        }
    }

    /// Navigasjons-banner (destinasjon + avstand/ETA + transport + POV/oversikt
    /// + Avslutt) i live turn-by-turn.
    private var navBanner: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(KrBrand.purpleLight.opacity(0.22))
                Image(systemName: navTransport.icon)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(KrBrand.purpleLight)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 1) {
                Text(navDestination?.name ?? "Navigerer")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if !navDistanceText.isEmpty {
                        Text(navDistanceText)
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(KrBrand.purpleLight)
                    }
                    if !navETAText.isEmpty {
                        Text("·").foregroundStyle(KrBrand.textTertiary)
                        Text(navETAText)
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(KrBrand.textSecondary)
                    }
                }
            }
            Spacer(minLength: 2)
            // Transportform med ekte ETA-sammenligning per reisemåte.
            Menu {
                Button { navTransportAuto = true; navTransport = resolveAutoTransport()
                    withAnimation { navVehicle = vehicleFor(navTransport) }
                    if let d = navDestination {
                        let me = KartLocationManager.shared.currentCoordinate ?? CLLocationCoordinate2D(latitude: d.lat, longitude: d.lon)
                        recomputeNavRoute(from: me, to: CLLocationCoordinate2D(latitude: d.lat, longitude: d.lon))
                    }
                } label: { Label("Auto (etter bevegelse)", systemImage: "wand.and.stars") }
                Divider()
                ForEach(NavTransport.allCases, id: \.self) { t in
                    Button { setNavTransport(t) } label: {
                        if let m = navTransportETAs[t] {
                            Label("\(t.rawValue) · \(m) min", systemImage: t.icon)
                        } else {
                            Label(t.rawValue, systemImage: t.icon)
                        }
                    }
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: navTransport.icon)
                        .font(.appScaled(size: 11, weight: .bold))
                    Text(navTransportAuto ? "Auto" : navTransport.rawValue)
                        .font(.appScaled(size: 10, weight: .bold))
                    Image(systemName: "chevron.down").font(.appScaled(size: 8, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(KrBrand.card, in: Capsule())
                .overlay(Capsule().stroke(KrBrand.stroke, lineWidth: 1))
            }
            .accessibilityLabel("Reisemåte og ETA")
            // Kamera-modus-velger (POV / Kjøre / Oversikt / 2D / Nord).
            Menu {
                ForEach(NavCamPreset.allCases, id: \.self) { preset in
                    Button { setNavPreset(preset) } label: {
                        Label(preset.rawValue, systemImage: preset.icon)
                    }
                }
                Divider()
                Button { navPresetPref = ""; navPresetManual = false; navPreset = .auto(for: navTransport); updateNavCamera(animated: true) } label: {
                    Label("Auto (etter reisemåte)", systemImage: "wand.and.stars")
                }
            } label: {
                Image(systemName: navPreset.icon)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 32, height: 32)
                    .background(KrBrand.card, in: Circle())
                    .overlay(Circle().stroke(KrBrand.stroke, lineWidth: 1))
            }
            .accessibilityLabel("Kamera-modus")
            Button { withAnimation(.easeOut(duration: 0.25)) { stopNavigation() } } label: {
                Text("Avslutt")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(KrBrand.green.opacity(0.20), in: Capsule())
                    .overlay(Capsule().stroke(KrBrand.green.opacity(0.4), lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 13))
        .background(KrBrand.card.opacity(0.85), in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(KrBrand.purpleLight.opacity(0.45), lineWidth: 1))
        .frame(maxWidth: 470)
        .shadow(color: KrBrand.purple.opacity(0.35), radius: 12, x: 0, y: 4)
    }

    // MARK: POI langs ruten — toggle-strip + kjøregodtgjørelse + nærhets-varsler

    /// Kompakt rad: vis/skjul POI (lading/bensin) + kjøregodtgjørelse-knapp.
    private var navPOIStrip: some View {
        let anyOn = !navPOIActiveKinds.isEmpty
        let allOn = navPOIActiveKinds == Set(NavPOIKind.allCases)
        return HStack(spacing: 8) {
            Menu {
                Button { navShowVehicle = true } label: {
                    Label("Min bil: \(appState.vehicleProfile.isConfigured ? appState.vehicleProfile.fuel.label : "Velg")",
                          systemImage: appState.vehicleProfile.fuel.icon)
                }
                Button { navShowKjorebok = true } label: {
                    Label(TripStore.shared.unconfirmedCount > 0
                          ? "Kjørebok (\(TripStore.shared.unconfirmedCount) ubekreftet)" : "Kjørebok",
                          systemImage: "book.closed.fill")
                }
                Divider()
                Button {
                    withAnimation { navPOIActiveKinds = Set(NavPOIKind.allCases); navDismissedPOIAlerts.removeAll() }
                } label: { Label("Vis alle POI", systemImage: "eye.fill") }
                Divider()
                ForEach(NavPOIKind.allCases, id: \.self) { kind in
                    let on = navPOIActiveKinds.contains(kind)
                    Button {
                        withAnimation { if on { navPOIActiveKinds.remove(kind) } else { navPOIActiveKinds.insert(kind) } }
                    } label: {
                        Label(on ? "Skjul \(kind.rawValue.lowercased())" : "Vis \(kind.rawValue.lowercased())",
                              systemImage: kind.icon)
                    }
                }
                Divider()
                Button { withAnimation { navPOIActiveKinds.removeAll() } } label: {
                    Label("Skjul alle POI", systemImage: "eye.slash.fill")
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: anyOn ? "eye.fill" : "eye.slash.fill")
                        .font(.appScaled(size: 11, weight: .bold))
                    Text(anyOn ? (allOn ? "POI vises" : "POI delvis") : "POI langs ruten")
                        .font(.appScaled(size: 11, weight: .bold))
                    Image(systemName: "chevron.down").font(.appScaled(size: 8, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 11).padding(.vertical, 7)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke(KrBrand.stroke, lineWidth: 1))
            }
            if !anyOn && !navProximityAlerts.isEmpty && !dorsalgModus {
                HStack(spacing: 4) {
                    Image(systemName: "bell.badge.fill").font(.appScaled(size: 10, weight: .bold))
                    Text("\(navProximityAlerts.count) i nærheten").font(.appScaled(size: 10, weight: .bold))
                }
                .foregroundStyle(KrBrand.yellow)
                .padding(.horizontal, 9).padding(.vertical, 6)
                .background(KrBrand.yellow.opacity(0.15), in: Capsule())
                .overlay(Capsule().stroke(KrBrand.yellow.opacity(0.4), lineWidth: 1))
            }
            Spacer(minLength: 2)
            // Kjøregodtgjørelse hører til KJØRING — skjules i dørsalg-gange.
            if !dorsalgModus {
                Button { navShowMileage = true } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "norwegiankronesign.circle.fill").font(.appScaled(size: 11, weight: .bold))
                        Text("Kjøregodtgjørelse").font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(LinearGradient(colors: [KrBrand.purple, KrBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing), in: Capsule())
                    .shadow(color: KrBrand.purple.opacity(0.4), radius: 6, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// «Meg»-posisjon for nærhets-beregning (live GPS, ellers rute-start).
    private var navMeCoordinate: CLLocationCoordinate2D? {
        KartLocationManager.shared.currentCoordinate ?? navRoute?.first
    }

    /// Rute-lengde i km (sum av segment-avstander) — ekte, til kjøregodtgjørelse.
    private var navRouteKm: Double {
        guard let r = navRoute, r.count > 1 else { return 0 }
        var m = 0.0
        for i in 0..<(r.count - 1) { m += NavRoutePOIService.haversine(r[i], r[i + 1]) }
        return m / 1000
    }

    /// Nærhets-varsler — REGLENE (Daniel 2026-07-19):
    ///  1. Kun POI-typer som passer BILEN (el → lading, fossil → bensin).
    ///  2. Vis nærmeste stasjon FORAN deg langs ruta (aldri bak) —
    ///     avstand langs veien, ikke luftlinje.
    ///  3. X avviser stasjonen for resten av turen (stabil nøkkel);
    ///     neste stasjon foran rykker automatisk opp.
    private var navProximityAlerts: [NavRoutePOI] {
        guard !navRoutePOIs.isEmpty else { return [] }
        let relevante = appState.vehicleProfile.defaultPOIKinds
        var result: [NavRoutePOI] = []
        for kind in relevante where !navPOIActiveKinds.contains(kind) {
            let kandidater = navRoutePOIs.filter {
                $0.kind == kind && !navDismissedPOIAlerts.contains($0.stableKey)
            }
            // Rute-låst: nærmeste langs ruta, foran deg.
            if let route = navRoute, navRouteCum.count == route.count,
               let valgt = kandidater
                   .compactMap({ p -> (NavRoutePOI, Double)? in
                       let proj = projectS(point: p.coordinate, route: route, cum: navRouteCum)
                       guard proj.dist < 600 else { return nil }        // nær ruta
                       let dS = proj.s - navSDisplay
                       guard dS > 30 else { return nil }                // foran deg
                       return (p, dS)
                   })
                   .min(by: { $0.1 < $1.1 })?.0 {
                result.append(valgt)
                continue
            }
            // Fallback uten rutegeometri: luftlinje som før.
            guard let me = navMeCoordinate else { continue }
            let radiusM = 6_000.0
            let nearest = kandidater
                .filter { $0.kind == kind && !navDismissedPOIAlerts.contains($0.stableKey) }
                .map { ($0, NavRoutePOIService.haversine(me, $0.coordinate)) }
                .filter { $0.1 <= radiusM }
                .min { $0.1 < $1.1 }
            if let n = nearest { result.append(n.0) }
        }
        return result
    }

    private func navProximityAlertRow(_ p: NavRoutePOI) -> some View {
        // Avstand LANGS RUTA når geometrien finnes (regel 2) — luftlinje
        // undervurderte avstanden i bygater.
        let meterUnna: Double = {
            if let route = navRoute, navRouteCum.count == route.count {
                let proj = projectS(point: p.coordinate, route: route, cum: navRouteCum)
                let dS = proj.s - navSDisplay
                if dS > 0 { return dS }
            }
            return navMeCoordinate.map { NavRoutePOIService.haversine($0, p.coordinate) } ?? 0
        }()
        let minsAway = max(1, Int(meterUnna / 1000 / 0.55))
        return HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(p.brandColor)
                Image(systemName: p.kind.icon).font(.appScaled(size: 13, weight: .black)).foregroundStyle(.white)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                // Nedtellings-animasjon: minuttallet ruller ned mens du
                // nærmer deg (tydeligst når du starter > 8 min unna).
                Text("\(p.kind.rawValue) \(minsAway) min unna")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    .contentTransition(.numericText(countsDown: true))
                    .animation(.snappy(duration: 0.5), value: minsAway)
                Text("\(p.name) · +\(p.detourMin) min avstikker")
                    .font(.appScaled(size: 10)).foregroundStyle(KrBrand.textSecondary).lineLimit(1)
            }
            Spacer()
            Button {
                withAnimation { navPOIActiveKinds.insert(p.kind); navSelectedPOI = p }
            } label: {
                Text("Vis").font(.appScaled(size: 11, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(p.brandColor, in: Capsule())
            }
            .buttonStyle(.plain)
            Button {
                withAnimation { _ = navDismissedPOIAlerts.insert(p.stableKey) }
            } label: {
                Image(systemName: "xmark").font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(KrBrand.textSecondary).padding(7)
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 12).fill(.ultraThinMaterial)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(p.brandColor.opacity(0.45), lineWidth: 1)))
        .shadow(color: .black.opacity(0.4), radius: 10, y: 3)
    }

    /// Åpne en POI i Apple Maps (kjørerute).
    private func openPOIInMaps(_ p: NavRoutePOI) {
        let item = MKMapItem(placemark: MKPlacemark(coordinate: p.coordinate))
        item.name = p.name
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
    }

    #if DEBUG
    /// Live kamera-kalibrering (DEBUG). Dra gliderne → kameraet oppdateres med
    /// en gang. Les av tallene nederst og gi dem til meg, så bakes de inn.
    @ViewBuilder
    private var navCalibControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            if navCalibOpen {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Kamera-kalibrering")
                        .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    calibRow("Pitch", value: $navCalibPitch, range: 20...90, fmt: "%.0f°")
                    calibRow("Avstand", value: $navCalibDist, range: 40...600, fmt: "%.0f m")
                    calibRow("Sikt fram", value: $navCalibAhead, range: 0...0.002, fmt: "%.4f")
                    Text(String(format: "pitch %.0f · dist %.0f · ahead %.4f",
                                navCalibPitch, navCalibDist, navCalibAhead))
                        .font(.appScaled(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(KrBrand.purpleLight)
                        .textSelection(.enabled)
                }
                .padding(12)
                .frame(width: 260)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                .background(KrBrand.card.opacity(0.9), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(KrBrand.stroke, lineWidth: 1))
            }
            Button { withAnimation { navCalibOpen.toggle() } } label: {
                Image(systemName: "slider.horizontal.3")
                    .font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(navCalibOpen ? KrBrand.purple.opacity(0.5) : KrBrand.card, in: Circle())
                    .overlay(Circle().stroke(KrBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private func calibRow(_ label: String, value: Binding<Double>, range: ClosedRange<Double>, fmt: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(label).font(.appScaled(size: 10, weight: .semibold)).foregroundStyle(KrBrand.textSecondary)
                Spacer()
                Text(String(format: fmt, value.wrappedValue))
                    .font(.appScaled(size: 10, weight: .bold)).foregroundStyle(.white)
            }
            Slider(value: value, in: range) { editing in
                if !editing { updateNavCamera(animated: true) }
            }
            .tint(KrBrand.purpleLight)
            .onChange(of: value.wrappedValue) { _, _ in updateNavCamera(animated: false) }
        }
    }
    #endif

    /// «Raskere alternativ»-forslag under gange: kollektiv eller elsparkesykkel
    /// som slår gå-ETA-en. Sparkesykkel deep-linker til operatørens app; Leadgrid
    /// planlegger turen, operatøren håndterer opplåsing/betaling/tur-status.
    @ViewBuilder
    private func navAlternativeBanner(_ alt: EnturService.Alternative) -> some View {
        let icon: String = alt.kind == "scooter" ? "scooter" : (alt.kind == "car" ? "car.fill" : "bus.fill")
        let accent: Color = alt.kind == "scooter" ? KrBrand.orange : (alt.kind == "car" ? KrBrand.blue : KrBrand.purpleLight)
        let actionLabel: String = alt.kind == "scooter" ? "Start" : (alt.kind == "car" ? "Kjør" : "Vis buss")
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(accent.opacity(0.22))
                Image(systemName: icon)
                    .font(.appScaled(size: 14, weight: .bold)).foregroundStyle(accent)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text("Anbefaling: \(alt.headline)")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                HStack(spacing: 5) {
                    if let saved = alt.savedMin, saved >= 1 {
                        Text("\(saved) min raskere")
                            .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(accent)
                    }
                    Text("· \(alt.etaMin) min · \(alt.detail)")
                        .font(.appScaled(size: 10)).foregroundStyle(KrBrand.textSecondary).lineLimit(1)
                }
            }
            Spacer(minLength: 2)
            Button {
                switch alt.kind {
                case "scooter":
                    withAnimation { navVehicle = .scooter }
                    if let urlStr = alt.rentalUrl, let url = URL(string: urlStr) { openURL(url) }
                case "car":
                    navTransportAuto = false
                    navTransport = .driving
                    withAnimation { navVehicle = .car }
                    if let dest = navDestination {
                        let me = KartLocationManager.shared.currentCoordinate
                            ?? CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon)
                        recomputeNavRoute(from: me, to: CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon))
                    }
                default: // transit
                    withAnimation { navVehicle = .bus }
                }
                withAnimation { navAltDismissed = true }
            } label: {
                Text(actionLabel)
                    .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(accent.opacity(0.9), in: Capsule())
            }
            .buttonStyle(.plain)
            Button { withAnimation(.easeOut(duration: 0.2)) { navAltDismissed = true } } label: {
                Image(systemName: "xmark")
                    .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(KrBrand.textTertiary)
                    .frame(width: 26, height: 26)
                    .background(KrBrand.cardHi, in: Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 13))
        .background(KrBrand.card.opacity(0.85), in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(accent.opacity(0.5), lineWidth: 1))
        .frame(maxWidth: 470)
        .shadow(color: accent.opacity(0.3), radius: 10, x: 0, y: 4)
    }

    /// Bla transportform: Auto → Gå → Sykkel → Bil → Auto. Manuelt valg låser
    /// auto-deteksjon; re-beregner rute + ETA umiddelbart.
    private func cycleNavTransport() {
        if navTransportAuto {
            navTransportAuto = false; navTransport = .walking
        } else {
            switch navTransport {
            case .walking: navTransport = .cycling
            case .cycling: navTransport = .driving
            case .driving: navTransportAuto = true; navTransport = resolveAutoTransport()
            }
        }
        withAnimation(.easeInOut(duration: 0.4)) { navVehicle = vehicleFor(navTransport) }
        if let dest = navDestination {
            let me = KartLocationManager.shared.currentCoordinate
                ?? CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon)
            recomputeNavRoute(from: me, to: CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon))
        }
    }

    /// Bytt til en spesifikk reisemåte (fra ETA-sammenligningsmenyen).
    private func setNavTransport(_ t: NavTransport) {
        navTransportAuto = false
        navTransport = t
        withAnimation(.easeInOut(duration: 0.4)) { navVehicle = vehicleFor(t) }
        if let dest = navDestination {
            let me = KartLocationManager.shared.currentCoordinate
                ?? CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon)
            recomputeNavRoute(from: me, to: CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon))
        }
    }

    /// Beregn ekte ETA per reisemåte (MKDirections for bil/gå; sykkel avledet fra
    /// gå-distanse ÷ 16 km/t; kollektiv fra Entur-alternativ hvis tilgjengelig).
    private func computeTransportETAs(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) {
        func eta(_ type: MKDirectionsTransportType) async -> (min: Int, meters: Double)? {
            let req = MKDirections.Request()
            req.source = MKMapItem(placemark: MKPlacemark(coordinate: from))
            req.destination = MKMapItem(placemark: MKPlacemark(coordinate: to))
            req.transportType = type
            guard let r = try? await MKDirections(request: req).calculateETA() else { return nil }
            return (max(1, Int(r.expectedTravelTime / 60)), r.distance)
        }
        Task { @MainActor in
            var out: [NavTransport: Int] = [:]
            if let d = await eta(.automobile) { out[.driving] = d.min }
            if let w = await eta(.walking) {
                out[.walking] = w.min
                // Sykkel ~16 km/t på gå-rutens distanse (MKDirections har ikke sykkel).
                out[.cycling] = max(1, Int((w.meters / 1000) / 16.0 * 60))
            }
            // Kollektiv dekkes av Entur-alternativ-banneren (egen flate).
            guard navModeActive else { return }
            navTransportETAs = out
        }
    }

    /// Haversine-distance i km mellom to koord.
    private func distanceKm(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let la = CLLocation(latitude: a.latitude, longitude: a.longitude)
        let lb = CLLocation(latitude: b.latitude, longitude: b.longitude)
        return la.distance(from: lb) / 1000
    }

    /// Sentrer kartet på ekte user-location via CoreLocation. Ber om
    /// WhenInUseAuthorization ved første tap. Fallback til Oslo-sentrum
    /// hvis tilgang nektes eller loc ikke er klart ennå.
    private func centerOnMe() {
        let mgr = KartLocationManager.shared
        mgr.requestIfNeeded()
        let myLocation = mgr.currentCoordinate
            ?? CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522)
        let newRegion = MKCoordinateRegion(
            center: myLocation,
            span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.03)
        )
        currentRegion = newRegion
        withAnimation(.easeInOut(duration: 0.5)) {
            camera = .region(newRegion)
        }
        if mgr.currentCoordinate == nil {
            showToast(mgr.status == .denied
                ? "Sted-tilgang avslått — bruker Oslo som fallback"
                : "Henter din posisjon…")
        }
    }

    // MARK: Legend — UI-fokus fase 4: liten kart-chip m/ popover i stedet
    // for egen full-bredde-rad (kartet er alltid scenen).

    private var legendChip: some View {
        Button { legendOpen = true } label: {
            HStack(spacing: 5) {
                Image(systemName: "circle.hexagongrid.fill")
                    .font(.appScaled(size: 10, weight: .semibold))
                Text("Tegnforklaring")
                    .font(.appScaled(size: 11, weight: .semibold))
            }
            .fixedSize()
            .foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 7)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(KrBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .popover(isPresented: $legendOpen, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 10) {
                if dorsalgModus {
                    dorsalgLegendItem(KrBrand.purpleLight, "house.fill", "Ubesøkt")
                    dorsalgLegendItem(KrBrand.green, "checkmark", "Salg")
                    dorsalgLegendItem(KrBrand.yellow, "clock", "Ikke hjemme")
                    dorsalgLegendItem(KrBrand.red, "xmark", "Avslått")
                } else {
                    legendItems
                }
            }
            .padding(14)
            .background(KrBrand.card)
            .preferredColorScheme(.dark)
            .presentationCompactAdaptation(.popover)
        }
    }

    /// Dørsalg-legenden: utfall på døra i stedet for lead-statusene.
    private var dorsalgLegendCard: some View {
        HStack(spacing: 10) {
            dorsalgLegendItem(KrBrand.purpleLight, "house.fill", "Ubesøkt")
            Spacer(minLength: 2)
            dorsalgLegendItem(KrBrand.green, "checkmark", "Salg")
            Spacer(minLength: 2)
            dorsalgLegendItem(KrBrand.yellow, "clock", "Ikke hjemme")
            Spacer(minLength: 2)
            dorsalgLegendItem(KrBrand.red, "xmark", "Avslått")
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(KrBrand.stroke, lineWidth: 1))
    }

    private func dorsalgLegendItem(_ farge: Color, _ ikon: String, _ label: String) -> some View {
        HStack(spacing: 6) {
            ZStack {
                Circle().fill(farge.opacity(0.22))
                Image(systemName: ikon)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(farge)
            }
            .frame(width: 22, height: 22)
            Text(label)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
    }

    @ViewBuilder
    private var legendItems: some View {
        ForEach(MapLeadMock.PinStatus.allCases, id: \.self) { st in
            legendItem(st)
        }
    }

    private func legendItem(_ st: MapLeadMock.PinStatus) -> some View {
        HStack(spacing: 6) {
            ZStack {
                Circle().fill(st.color.opacity(0.22))
                Image(systemName: st.icon)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(st.color)
            }
            .frame(width: 22, height: 22)
            Text(st.label)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
    }

    // MARK: Leads i området-card

    private var leadsInAreaCard: some View {
        // Skiller «tom pga demo AV / ingen data» fra «tom pga aktivt filter».
        let hasAnyLeads = !kartLeads.isEmpty
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Leads i området")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                if hasAnyLeads {
                    Text("(\(kartLeads.count))")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(KrBrand.textSecondary)
                }
                Spacer()
                HStack(spacing: 3) {
                    Text("Nær meg")
                        .font(.appScaled(size: 11, weight: .semibold))
                    Image(systemName: "chevron.down")
                        .font(.appScaled(size: 9, weight: .semibold))
                }
                .foregroundStyle(KrBrand.textSecondary)
                // Kollaps panelet → kartet får hele bredden (portrett-iPad).
                Button {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                        leadsPanelCollapsed = true
                    }
                } label: {
                    Image(systemName: "sidebar.trailing")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(KrBrand.textSecondary)
                        .frame(width: 28, height: 28)
                        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8)
                            .stroke(KrBrand.stroke, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }

            // Lazy: lista kan bli lang — radene bygges først når de scrolles inn.
            LazyVStack(spacing: 8) {
                if filteredLeads.isEmpty {
                    VStack(spacing: 6) {
                        Image(systemName: hasAnyLeads ? "magnifyingglass" : "mappin.slash")
                            .font(.appScaled(size: 18))
                            .foregroundStyle(KrBrand.textTertiary)
                        Text(hasAnyLeads ? "Ingen treff" : "Ingen leads enda")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(KrBrand.textSecondary)
                        Text(hasAnyLeads
                             ? "Prøv å justere søk eller filtre"
                             : "Bruk «+ Legg til lead» eller skru på demo-modus")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(KrBrand.textTertiary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                } else {
                    ForEach(filteredLeads) { lead in
                        leadRow(lead)
                    }
                }
            }

            Button { appState.selectedSidebarItem = .leads } label: {
                HStack(spacing: 5) {
                    Text("Se alle leads i området")
                        .font(.appScaled(size: 12, weight: .semibold))
                    Image(systemName: "arrow.right")
                        .font(.appScaled(size: 10, weight: .semibold))
                }
                .foregroundStyle(KrBrand.purpleLight)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.top, 3)
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(KrBrand.stroke, lineWidth: 1))
    }

    private func leadRow(_ lead: MapLeadMock) -> some View {
        let isSelected = selectedLead.id == lead.id
        return Button { selectAndZoom(lead) } label: {
            HStack(alignment: .top, spacing: 9) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(lead.status.color.opacity(0.18))
                    Image(systemName: "building.2.fill")
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(lead.status.color)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(lead.name)
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        statusBadge(lead.status)
                    }
                    Text(lead.address)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(KrBrand.textSecondary)
                        .lineLimit(1)
                    HStack {
                        if let act = lead.lastActivity {
                            Text("Sist aktivitet: \(act)")
                                .font(.appScaled(size: 9))
                                .foregroundStyle(KrBrand.textTertiary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text(String(format: "%.1f km", lead.kmAway))
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(KrBrand.textSecondary)
                    }
                }
            }
            .padding(8)
            .background(
                isSelected ? KrBrand.purple.opacity(0.12) : KrBrand.cardHi,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? KrBrand.purple.opacity(0.5) : KrBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func statusBadge(_ st: MapLeadMock.PinStatus) -> some View {
        Text(st.label)
            .font(.appScaled(size: 8, weight: .bold))
            .foregroundStyle(st.color)
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(st.color.opacity(0.18), in: Capsule())
    }

    /// Filtrerte leads basert på søk + status + bransje. Sidebar +
    /// kart-pins respekterer disse.
    private var filteredLeads: [MapLeadMock] {
        kartLeads.filter { lead in
            let s = search.trimmingCharacters(in: .whitespaces).lowercased()
            let matchesSearch = s.isEmpty
                || lead.name.lowercased().contains(s)
                || lead.address.lowercased().contains(s)
            let matchesStatus = selectedStatuses.isEmpty
                || selectedStatuses.contains(lead.status)
            return matchesSearch && matchesStatus
        }
    }

    /// Velger en dørsalg-adresse OG zoomer inn på pinen (speiler
    /// selectAndZoom for leads). Span ~0.0018° = helt nede på husnivå —
    /// du ser døra du står ved og nabodørene rundt.
    private func selectDorsalgAdresse(_ adr: KartverketService.AdressePunkt) {
        withAnimation(.easeOut(duration: 0.2)) { dorsalgValgt = adr }
        withAnimation(.easeInOut(duration: 0.55)) {
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: adr.lat, longitude: adr.lon),
                span: MKCoordinateSpan(latitudeDelta: 0.0018, longitudeDelta: 0.0027)
            ))
        }
    }

    /// Nærmeste ubesøkte adresse fra der du står — «Neste dør»-flyten.
    private func nesteDorsalgAdresse(fra adr: KartverketService.AdressePunkt)
        -> KartverketService.AdressePunkt? {
        dorsalgSynligeAdresser
            .filter { $0.id != adr.id && dorsalgStatuser[$0.id] == nil }
            .min(by: { dorsalgAvstand(adr, $0) < dorsalgAvstand(adr, $1) })
    }

    private func dorsalgAvstand(_ a: KartverketService.AdressePunkt,
                                _ b: KartverketService.AdressePunkt) -> Double {
        CLLocation(latitude: a.lat, longitude: a.lon)
            .distance(from: CLLocation(latitude: b.lat, longitude: b.lon))
    }

    /// Kompassretning som norsk ord («mot nordøst») for Neste dør-hintet.
    private func dorsalgKompassOrd(_ grader: Double) -> String {
        let dirs = ["nord", "nordøst", "øst", "sørøst", "sør", "sørvest", "vest", "nordvest"]
        let norm = (grader.truncatingRemainder(dividingBy: 360) + 360)
            .truncatingRemainder(dividingBy: 360)
        return dirs[Int((norm + 22.5).truncatingRemainder(dividingBy: 360) / 45)]
    }

    /// Velger en lead OG zoomer kartet inn på dens pin med smooth
    /// animation. Spans ~0.012° gir ca. gate-nivå zoom.
    private func selectAndZoom(_ lead: MapLeadMock) {
        selectedLead = lead
        hasSelectedLead = true
        withAnimation(.easeInOut(duration: 0.55)) {
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon),
                span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.018)
            ))
        }
    }

    // MARK: - Live navigasjons-modus

    /// Kompass-retning a→b i grader (nord=0, øst=90). Roterer kartet heading-up.
    private func bearing(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let lat1 = a.latitude * .pi / 180, lat2 = b.latitude * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let y = sin(dLon) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        return atan2(y, x) * 180 / .pi
    }

    /// Delt tale-synthesizer for stemme-guiding.
    private static let speechSynth = AVSpeechSynthesizer()
    /// Dedup-vakt: samme setning innen 8 s re-uttales aldri, og køen
    /// holdes på maks én ventende ytring (GPS-jitter ga tale-loop).
    private static var lastSpoken: (text: String, at: Date)?

    /// Snakk en instruksjon (norsk stemme). No-op når stemme er av.
    private func speak(_ text: String) {
        guard navVoiceOn else { return }
        if let last = Self.lastSpoken, last.text == text,
           Date().timeIntervalSince(last.at) < 8 { return }
        // Ikke stable opp kø: er hun midt i en setning, bytt til den nye
        // (den gamle er utdatert) i stedet for å lese begge.
        if Self.speechSynth.isSpeaking {
            Self.speechSynth.stopSpeaking(at: .word)
        }
        Self.lastSpoken = (text, Date())
        let u = AVSpeechUtterance(string: text)
        u.voice = AVSpeechSynthesisVoice(language: "nb-NO") ?? AVSpeechSynthesisVoice(language: "no")
        u.rate = AVSpeechUtteranceDefaultSpeechRate
        Self.speechSynth.speak(u)
    }

    /// SF Symbol for en manøver ut fra instruksjons-teksten.
    private func maneuverIcon(_ instr: String) -> String {
        let s = instr.lowercased()
        if s.contains("høyre") || s.contains("right") { return "arrow.turn.up.right" }
        if s.contains("venstre") || s.contains("left") { return "arrow.turn.up.left" }
        if s.contains("rundkjøring") || s.contains("roundabout") { return "arrow.triangle.2.circlepath" }
        if s.contains("ankom") || s.contains("arrive") || s.contains("destinasjon") { return "mappin.and.ellipse" }
        return "arrow.up"
    }

    /// Meters mellom to koordinater (Haversine).
    private func metersBetween(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }

    /// Start live turn-by-turn mot en lead: heading-up 3D som følger posisjonen,
    /// lilla stiplet MKDirections-rute, nav-banner. Utløst av «Naviger»-knappen
    /// eller Kartlag-toggle.
    private func startNavigation(to lead: MapLeadMock) {
        navDestination = lead
        selectedLead = lead
        hasSelectedLead = true
        navModeActive = true
        // Husket preferanse vinner over auto-valg (hvis satt).
        if let pref = NavCamPreset(rawValue: navPresetPref) {
            navPreset = pref
            navPresetManual = true
        } else {
            navPreset = .auto(for: navTransport)
            navPresetManual = false
        }
        navVehicle = vehicleFor(navTransport)
        navHeadingSmoothed = nil
        navProgressIndex = 0
        navSteps = []
        navStepIndex = 0
        navSpokePrepare = false
        navArrived = false
        navSpeedLimit = nil
        navSpeedAnchor = nil
        navAlternatives = []
        navAltAnchor = nil
        navAltDismissed = false
        navRoutePOIs = []
        // «Min bil» styrer hvilke POI som vises fra start (el→lading, fossil→bensin).
        navPOIActiveKinds = appState.vehicleProfile.defaultPOIKinds
        navSelectedPOI = nil
        navDismissedPOIAlerts = []
        navTransportETAs = [:]
        measureMode = false   // gjensidig utelukkende med mål-verktøyet
        KartLocationManager.shared.requestIfNeeded()
        KartLocationManager.shared.setNavigationMode(true)   // høyeste GPS-nøyaktighet
        KartLocationManager.shared.startTransportDetection()
        let me = KartLocationManager.shared.currentCoordinate
            ?? CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon)
        navRerouteAnchor = me
        // Leadgrid Go: registrer tur-start så en fullført kjøretur auto-logges.
        navStartedAt = Date()
        navStartCoord = me
        navStartPlace = "Din posisjon"
        reverseGeocodeStartPlace(me)
        recomputeNavRoute(from: me, to: CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon))
        updateNavCamera(animated: true)
    }

    /// Slå opp et lesbart start-stedsnavn (til kjøreboka). Best-effort.
    private func reverseGeocodeStartPlace(_ coord: CLLocationCoordinate2D) {
        CLGeocoder().reverseGeocodeLocation(
            CLLocation(latitude: coord.latitude, longitude: coord.longitude)
        ) { placemarks, _ in
            guard let p = placemarks?.first else { return }
            let name = [p.thoroughfare, p.locality].compactMap { $0 }.joined(separator: ", ")
            if !name.isEmpty { DispatchQueue.main.async { self.navStartPlace = name } }
        }
    }

    /// Leadgrid Go: opprett en kjørebok-oppføring fra en fullført nav-tur.
    /// Kalles ved ankomst. Formål = «ikke bekreftet» (fører attesterer i kjøreboka).
    private func logCompletedTrip() {
        guard navTransport == .driving, let start = navStartedAt, let dest = navDestination else { return }
        let km = navRouteKm
        guard km >= 0.3 else { return }   // hopp over bagatell-turer
        let profile = appState.vehicleProfile
        let trip = Trip(
            startDate: start,
            endDate: Date(),
            startPlace: navStartPlace.isEmpty ? "Din posisjon" : navStartPlace,
            endPlace: dest.name,
            startLat: navStartCoord?.latitude ?? dest.lat,
            startLon: navStartCoord?.longitude ?? dest.lon,
            endLat: dest.lat,
            endLon: dest.lon,
            distanceKm: (km * 10).rounded() / 10,
            vehicleName: profile.displayName,
            vehiclePlate: profile.plate,
            mileageAmount: (km * profile.mileageRate * 100).rounded() / 100,
            tollAmount: navTollPerTrip,
            source: "auto"
        )
        if TripStore.shared.add(trip) {
            showToast("Kjøretur logget i kjøreboka — bekreft formål")
            Task { await TripService.shared.push(trip, using: appState.api) }   // durabel backup
        }
    }

    /// Avslutt navigasjon og gjenopprett oversikts-kamera på lead-en.
    private func stopNavigation() {
        navModeActive = false
        navRoute = nil
        // Rute-låst motor: nullstill geometri + progresjon.
        navRouteCum = []
        navStepS = []
        navSTarget = 0
        navSDisplay = 0
        navFollowSpeed = 0
        navLastFixAt = nil
        navAvatarCoord = nil
        navTangent = nil
        navRoutePOIs = []
        navPOIActiveKinds = []
        navSelectedPOI = nil
        navTollPerTrip = nil
        navTollCount = 0
        KartLocationManager.shared.setNavigationMode(false)
        KartLocationManager.shared.stopTransportDetection()
        let dest = navDestination
        navDestination = nil
        withAnimation(.easeInOut(duration: 0.6)) {
            if let d = dest {
                camera = .region(MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: d.lat, longitude: d.lon),
                    span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.018)))
            }
        }
    }

    /// Beregn gå-rute (MKDirections) + avstand/ETA. Faller tilbake til rett linje
    /// hvis ruteberegning feiler (offline/sim).
    private func recomputeNavRoute(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) {
        let req = MKDirections.Request()
        req.source = MKMapItem(placemark: MKPlacemark(coordinate: from))
        req.destination = MKMapItem(placemark: MKPlacemark(coordinate: to))
        req.transportType = navTransport.mkType
        let verb = navTransport.etaVerb
        MKDirections(request: req).calculate { resp, _ in
            var coords: [CLLocationCoordinate2D] = [from, to]
            var meters = self.metersBetween(from, to)
            var seconds = meters / self.navTransport.fallbackSpeed
            var steps: [NavStep] = []
            if let route = resp?.routes.first {
                let poly = route.polyline
                var pts = [CLLocationCoordinate2D](repeating: kCLLocationCoordinate2DInvalid, count: poly.pointCount)
                poly.getCoordinates(&pts, range: NSRange(location: 0, length: poly.pointCount))
                if pts.count > 1 { coords = pts }
                meters = route.distance
                seconds = route.expectedTravelTime
                // Manøvrer (sving-for-sving) fra rute-stegene.
                for step in route.steps {
                    let instr = step.instructions.trimmingCharacters(in: .whitespaces)
                    guard !instr.isEmpty else { continue }
                    let sp = step.polyline
                    var spc = [CLLocationCoordinate2D](repeating: kCLLocationCoordinate2DInvalid, count: sp.pointCount)
                    sp.getCoordinates(&spc, range: NSRange(location: 0, length: sp.pointCount))
                    let c = spc.first ?? to
                    steps.append(NavStep(text: instr, coord: c, icon: self.maneuverIcon(instr)))
                }
            }
            DispatchQueue.main.async {
                guard self.navModeActive else { return }
                let km = meters / 1000
                self.navDistanceText = km < 1 ? "\(Int(meters)) m" : String(format: "%.1f km", km)
                self.navETAMinutes = max(1, Int(seconds / 60))
                self.navETAText = "\(self.navETAMinutes) min"
                self.navProgressIndex = 0   // ny rute → nullstill progresjon
                self.navSteps = steps
                self.navStepIndex = steps.count > 1 ? 1 : 0   // hopp over «start»-steget
                self.navSpokePrepare = false
                // Nye steg skal ikke leses opp umiddelbart (reroute-loop-vern).
                self.navSpeechGraceUntil = Date().addingTimeInterval(4)
                withAnimation(.easeInOut(duration: 0.5)) { self.navRoute = coords }
                // Rute-låst motor: bygg geometri + start s der du faktisk er.
                self.buildRouteGeometry(coords)
                if let me = KartLocationManager.shared.currentCoordinate,
                   self.navRouteCum.count == coords.count {
                    let proj = self.projectS(point: me, route: coords, cum: self.navRouteCum)
                    self.navSTarget = proj.s
                    self.navSDisplay = proj.s
                } else {
                    self.navSTarget = 0
                    self.navSDisplay = 0
                }
                self.navTangent = nil
                self.navFollowSpeed = 0
                self.navAvatarCoord = self.pointAlongRoute(self.navSDisplay)?.coord
                self.fetchNavRoutePOIs(route: coords)
                self.fetchNavTolls(route: coords)
                self.computeTransportETAs(from: from, to: to)
            }
        }
    }

    /// Hent ekte lade-/bensin-POI langs ruta (MKLocalSearch). Begge typer hentes
    /// alltid (så nærhets-varsler virker selv når overlayet er skjult); synlighet
    /// på kartet gates av `navPOIActiveKinds`.
    private func fetchNavRoutePOIs(route: [CLLocationCoordinate2D]) {
        guard route.count > 1 else { return }
        Task { @MainActor in
            let pois = await NavRoutePOIService.shared.fetchAlongRoute(
                route, kinds: Set(NavPOIKind.allCases))
            guard navModeActive else { return }
            navRoutePOIs = pois
        }
    }

    /// Hent ekte bomstasjoner (NVDB) langs ruta og summer takst per vei. Kun
    /// relevant ved bil. Filtrerer til stasjoner <400 m fra ruta.
    private func fetchNavTolls(route: [CLLocationCoordinate2D]) {
        guard route.count > 1, navTransport == .driving else {
            navTollPerTrip = nil; navTollCount = 0; return
        }
        let lats = route.map(\.latitude), lons = route.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(),
              let minLon = lons.min(), let maxLon = lons.max() else { return }
        let bbox = "\(minLon),\(minLat),\(maxLon),\(maxLat)"
        Task { @MainActor in
            let stations = await NvdbService.shared.tolls(bbox: bbox, using: appState.api)
            guard navModeActive, navTransport == .driving else { return }
            let onRoute = stations.filter {
                NavRoutePOIService.nearestDistanceToRoute(
                    CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lon), route: route) <= 400
            }
            let sum = onRoute.compactMap { $0.rateSmall }.reduce(0, +)
            navTollCount = onRoute.count
            navTollPerTrip = onRoute.isEmpty ? nil : sum
        }
    }

    /// Turn-by-turn: annonser neste manøver (forbered + «nå») og oppdag ankomst.
    private func navTurnTick(_ me: CLLocationCoordinate2D) {
        guard let dest = navDestination else { return }
        let destC = CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon)
        let toDest = metersBetween(me, destC)
        // Ankomst
        if !navArrived, navStepIndex >= max(0, navSteps.count - 1), toDest < 25 {
            navArrived = true
            logCompletedTrip()   // Leadgrid Go: auto-loggfør kjøreturen
            speak("Du er fremme ved \(dest.name)")
            showToast("Du er fremme ved \(dest.name)")
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                if navArrived { withAnimation(.easeOut(duration: 0.3)) { stopNavigation() } }
            }
            return
        }
        guard navStepIndex < navSteps.count else { return }
        // Tale-pause rett etter re-rute: stegene er ferske — vent til de er
        // stabile før de leses (ellers loop ved gjentatte re-ruter).
        let taleOK = navSpeechGraceUntil.map { Date() >= $0 } ?? true
        let step = navSteps[navStepIndex]
        let d = metersBetween(me, step.coord)
        // «Forbered»-avstand skalert til reisemåte: 130 m er bil-tunet og
        // fyrte umiddelbart på korte gå-etapper (dørsalg = 50 m-turer).
        let prep: Double = navTransport == .walking ? 55 : 130
        let prepGulv: Double = navTransport == .walking ? 20 : 40
        if taleOK, !navSpokePrepare, d < prep, d > prepGulv {
            navSpokePrepare = true
            speak("Om \(Int(d / 10) * 10) meter, \(step.text)")
        }
        // Manøver-punktet nådd → snakk + gå til neste steg. Indeksen økes
        // ALLTID (kan bli == count): å stå ved siste manøver-punkt fikk
        // stemmen til å repetere samme instruks hver posisjons-tick (loop).
        if d < (navTransport == .walking ? 14 : 22) {
            if taleOK { speak(step.text) }
            navStepIndex += 1
            navSpokePrepare = false
        }
    }

    /// Sentrer/roter kamera heading-up på brukeren. Kursen kommer fra
    /// CLLocation.course når man beveger seg, ellers peil mot destinasjonen.
    /// POV = førsteperson gate-nivå (bratt pitch, tett på). Oversikt = zoomet ut
    /// så hele ruta vises.
    private func updateNavCamera(animated: Bool) {
        guard navModeActive, let dest = navDestination else { return }
        let destC = CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon)
        // Snap kamera-referansen til veien også (jevn, på-vei-følging).
        let me = snapToRoute(KartLocationManager.shared.currentCoordinate ?? destC)
        // Kartet skal orientere seg i KJØRERETNINGEN: peil langs ruta mot et punkt
        // et stykke foran deg (ikke bare rett mot pin-en), så kartet roterer som i
        // ekte turn-by-turn. Lav-pass-filtrer så rotasjonen blir jevn, ikke rykkete.
        // Nord-opp-preset låser heading til nord (kartet roterer ikke).
        let heading: Double
        if navPreset.northUp {
            heading = 0
            navHeadingSmoothed = 0
        } else if metersBetween(me, destC) < 18, let prev = navHeadingSmoothed {
            // Ankomstsone: heading-beregningen flipper når du passerer målet
            // → kameraet spant rundt. Lås siste stabile retning.
            heading = prev
        } else {
            let rawHeading = navRouteHeading(from: me, dest: destC)
            if let prev = navHeadingSmoothed {
                // Klamp rotasjonen per tick (maks 9°): i kryss/ved svinger
                // hoppet kursen titalls grader på én oppdatering → kameraet
                // slengte rundt («ustabilt», Daniel 2026-07-19).
                let delta = angleDelta(prev, rawHeading) * 0.30
                heading = prev + max(-9, min(9, delta))
            } else {
                heading = rawHeading
            }
            navHeadingSmoothed = heading
        }
        // Parametre fra valgt preset (+ reisemåte + gjenstående rute). I DEBUG
        // overstyrer kalibrerings-gliderne når panelet er åpent (finjustering).
        var p = navPreset.params(navTransport, routeM: metersBetween(me, destC))
        #if DEBUG
        if navCalibOpen { p = (navCalibPitch, navCalibDist, navCalibAhead) }
        #endif
        let dist = p.dist, pitch = p.pitch, ahead = p.ahead
        let rad = heading * .pi / 180
        let center = CLLocationCoordinate2D(
            latitude: me.latitude + ahead * cos(rad),
            longitude: me.longitude + ahead * sin(rad) / max(0.2, cos(me.latitude * .pi / 180)))
        let cam = MapCamera(centerCoordinate: center, distance: dist, heading: heading, pitch: pitch)
        // Lineær under følging = jevn, kontinuerlig bevegelse (ikke pulsende).
        // 1,05 s > GPS-tick-avstanden (~1 s) → neste oppdatering tar over FØR
        // forrige animasjon stopper — ellers små rykk mellom hver posisjon.
        withAnimation(animated ? .easeInOut(duration: 0.9) : .linear(duration: 1.05)) {
            camera = .camera(cam)
        }
    }

    /// Bytt mellom POV (førsteperson) og Oversikt (zoomet ut). «Zoom ut»-knappen.
    /// Sett kamera-preset manuelt (overstyrer auto-valg) + husk det.
    private func setNavPreset(_ preset: NavCamPreset) {
        navPresetManual = true
        navPreset = preset
        navPresetPref = preset.rawValue   // husk til neste økt
        updateNavCamera(animated: true)
    }

    private func toggleNavView() {
        navPresetManual = true
        navPreset = (navPreset == .overview) ? .auto(for: navTransport) : .overview
        updateNavCamera(animated: true)
    }

    /// Bil-ETA (min) via MKDirections. Nil hvis ingen kjørerute.
    private func drivingEtaMinutes(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) async -> Int? {
        let req = MKDirections.Request()
        req.source = MKMapItem(placemark: MKPlacemark(coordinate: from))
        req.destination = MKMapItem(placemark: MKPlacemark(coordinate: to))
        req.transportType = .automobile
        return await withCheckedContinuation { cont in
            MKDirections(request: req).calculate { resp, _ in
                let s = resp?.routes.first?.expectedTravelTime
                cont.resume(returning: s.map { max(1, Int($0 / 60)) })
            }
        }
    }

    /// Nærmeste punkt på segmentet a–b (planar approx, lon skalert med cos(lat)).
    private func nearestPointOnSegment(_ p: CLLocationCoordinate2D, _ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        let scale = cos(a.latitude * .pi / 180)
        let px = p.longitude * scale, py = p.latitude
        let ax = a.longitude * scale, ay = a.latitude
        let bx = b.longitude * scale, by = b.latitude
        let dx = bx - ax, dy = by - ay
        let len2 = dx * dx + dy * dy
        var t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
        t = max(0, min(1, t))
        return CLLocationCoordinate2D(latitude: ay + t * dy, longitude: (ax + t * dx) / (scale == 0 ? 1 : scale))
    }

    /// «Snap-til-vei»: projiser posisjonen ned på nærmeste rute-segment, så
    /// figuren/kameraet alltid ligger på veien (fikser GPS-drift + sim-kutting).
    /// Snapper kun når nær nok (<60 m) — ellers beholdes rå posisjon (av-rute).
    // MARK: Rute-låst følgemotor — geometri

    /// Bygg kumulative lengder + steg-posisjoner (s) for gjeldende rute.
    private func buildRouteGeometry(_ route: [CLLocationCoordinate2D]) {
        guard route.count > 1 else { navRouteCum = []; navStepS = []; return }
        var cum: [Double] = [0]
        cum.reserveCapacity(route.count)
        for i in 1..<route.count {
            cum.append(cum[i - 1] + metersBetween(route[i - 1], route[i]))
        }
        navRouteCum = cum
        navStepS = navSteps.map { projectS(point: $0.coord, route: route, cum: cum).s }
    }

    /// Projiser et punkt på ruta → (s = meter langs ruta, avstand fra ruta).
    private func projectS(point: CLLocationCoordinate2D,
                          route: [CLLocationCoordinate2D],
                          cum: [Double]) -> (s: Double, dist: Double) {
        var bestS = 0.0
        var bestD = Double.greatestFiniteMagnitude
        for i in 0..<(route.count - 1) {
            let p = nearestPointOnSegment(point, route[i], route[i + 1])
            let d = metersBetween(point, p)
            if d < bestD {
                bestD = d
                bestS = cum[i] + metersBetween(route[i], p)
            }
        }
        return (bestS, bestD)
    }

    /// Punkt + tangent (grader) ved s meter langs ruta.
    private func pointAlongRoute(_ s: Double) -> (coord: CLLocationCoordinate2D, tangent: Double)? {
        guard let route = navRoute, route.count > 1,
              navRouteCum.count == route.count,
              let total = navRouteCum.last, total > 0 else { return nil }
        let sc = max(0, min(s, total))
        var i = 0
        while i < navRouteCum.count - 2 && navRouteCum[i + 1] < sc { i += 1 }
        let segLen = max(0.01, navRouteCum[i + 1] - navRouteCum[i])
        let t = (sc - navRouteCum[i]) / segLen
        let a = route[i], b = route[i + 1]
        let coord = CLLocationCoordinate2D(
            latitude: a.latitude + (b.latitude - a.latitude) * t,
            longitude: a.longitude + (b.longitude - a.longitude) * t)
        return (coord, bearing(a, b))
    }

    /// 4 Hz-framdrift: gli mot s-target langs ruta, oppdater avatar, kamera,
    /// tale og fremdrifts-UI. Kalles fra follow-loopen.
    private func navFollowAdvance(dt: Double) {
        guard navModeActive, let route = navRoute, route.count > 1,
              navRouteCum.count == route.count,
              let total = navRouteCum.last, total > 0 else { return }
        let etterslep = max(0, navSTarget - navSDisplay)
        // Fart: estimert GPS-fart + myk innhenting av etterslep — aldri hopp.
        let v = min(45, max(navFollowSpeed, etterslep > 30 ? etterslep / 3 : 0))
        let steg = min(etterslep, v * dt)
        if steg > 0.01 || navAvatarCoord == nil {
            navSDisplay += steg
            guard let p = pointAlongRoute(navSDisplay) else { return }
            withAnimation(.linear(duration: dt * 1.1)) { navAvatarCoord = p.coord }
            let forrige = navTangent ?? p.tangent
            navTangent = forrige + max(-14, min(14, angleDelta(forrige, p.tangent)))
            updateNavCameraRouteLocked(dt: dt)
            // Kompat: hold progress-indeksen i sync (snapping-vindu m.m.)
            var i = 0
            while i < navRouteCum.count - 2 && navRouteCum[i + 1] < navSDisplay { i += 1 }
            if i > navProgressIndex { navProgressIndex = i }
            let remaining = max(0, total - navSDisplay)
            navDistanceText = remaining < 1000
                ? "\(Int(remaining)) m" : String(format: "%.1f km", remaining / 1000)
            let secs = remaining / max(0.5, navTransport.fallbackSpeed)
            navETAMinutes = max(1, Int(secs / 60))
            navETAText = "\(navETAMinutes) min"
        }
        navRouteVoiceTick(total: total)
    }

    /// Kamera låst til ruta: senter = punktet litt LENGRE FREMME LANGS RUTA
    /// (ikke luftlinje), heading = glattet tangent. Én kontinuerlig bevegelse.
    private func updateNavCameraRouteLocked(dt: Double) {
        guard let tangent = navTangent else { return }
        var p = navPreset.params(navTransport,
                                 routeM: max(0, (navRouteCum.last ?? 0) - navSDisplay))
        #if DEBUG
        if navCalibOpen { p = (navCalibPitch, navCalibDist, navCalibAhead) }
        #endif
        let heading: Double = navPreset.northUp ? 0 : tangent
        navCamHeading = heading
        navHeadingSmoothed = heading
        let aheadM = p.ahead * 111_000
        guard let senter = pointAlongRoute(navSDisplay + aheadM) else { return }
        let cam = MapCamera(centerCoordinate: senter.coord, distance: p.dist,
                            heading: heading, pitch: p.pitch)
        withAnimation(.linear(duration: dt * 1.1)) { camera = .camera(cam) }
    }

    /// Tale/manøvrer drevet av s (monoton) — kan ikke loope.
    private func navRouteVoiceTick(total: Double) {
        guard let dest = navDestination else { return }
        // Ankomst
        if !navArrived, total - navSDisplay < 20 {
            navArrived = true
            logCompletedTrip()
            speak("Du er fremme ved \(dest.name)")
            showToast("Du er fremme ved \(dest.name)")
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                if navArrived { withAnimation(.easeOut(duration: 0.3)) { stopNavigation() } }
            }
            return
        }
        guard navStepIndex < navSteps.count, navStepIndex < navStepS.count else { return }
        let taleOK = navSpeechGraceUntil.map { Date() >= $0 } ?? true
        let dist = navStepS[navStepIndex] - navSDisplay
        let prep: Double = navTransport == .walking ? 55 : 130
        if taleOK, !navSpokePrepare, dist < prep, dist > 25 {
            navSpokePrepare = true
            speak("Om \(Int(dist / 10) * 10) meter, \(navSteps[navStepIndex].text)")
        }
        if dist <= (navTransport == .walking ? 12 : 18) {
            if taleOK { speak(navSteps[navStepIndex].text) }
            navStepIndex += 1
            navSpokePrepare = false
        }
    }

    private func snapToRoute(_ me: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        guard navModeActive, let route = navRoute, route.count > 1 else { return me }
        // Søk kun i et vindu FRAMOVER fra der vi er (map-matching-lite): unngår at
        // et nærliggende parallelt/kryssende segment «drar» posisjonen feil vei.
        let lo = max(0, min(navProgressIndex, route.count - 2))
        let hi = min(route.count - 2, lo + 30)
        var best = me
        var bestD = Double.greatestFiniteMagnitude
        for i in lo...hi {
            let cand = nearestPointOnSegment(me, route[i], route[i + 1])
            let d = metersBetween(me, cand)
            if d < bestD { bestD = d; best = cand }
        }
        // 110 m (før 60): GPS-drift mellom bygårder la avataren «oppå
        // bygninger». Innenfor terskelen limes den til ruta; er du GENUINT
        // av ruta tar re-rutingen over (hysterese + 12 s-cooldown).
        return bestD < 110 ? best : me
    }

    /// Korteste vinkel-differanse from→to i grader (−180…180), håndterer wrap.
    private func angleDelta(_ from: Double, _ to: Double) -> Double {
        var d = (to - from).truncatingRemainder(dividingBy: 360)
        if d > 180 { d -= 360 }
        if d < -180 { d += 360 }
        return d
    }

    /// Kjøreretning: bearing langs ruta fra din posisjon til et punkt ~et par
    /// segmenter foran deg. Gir stabil heading-up som følger veien (ikke luftlinje).
    private func navRouteHeading(from me: CLLocationCoordinate2D, dest: CLLocationCoordinate2D) -> Double {
        guard let route = navRoute, route.count > 1 else {
            return KartLocationManager.shared.heading ?? bearing(me, dest)
        }
        // nærmeste rute-punkt
        var bestI = 0
        var bestD = Double.greatestFiniteMagnitude
        for (i, p) in route.enumerated() {
            let d = metersBetween(me, p)
            if d < bestD { bestD = d; bestI = i }
        }
        // et punkt et stykke foran (hopp fram til vi er >25 m unna)
        var target = route[route.count - 1]
        var i = bestI
        while i < route.count {
            if metersBetween(me, route[i]) > 25 { target = route[i]; break }
            i += 1
        }
        if metersBetween(me, target) < 8 { return bearing(me, dest) }
        return bearing(me, target)
    }

    /// Kartfigur for en reisemåte (gå-person / sparkesykkel / bil).
    private func vehicleFor(_ t: NavTransport) -> NavVehicle {
        switch t { case .walking: .walk; case .cycling: .scooter; case .driving: .car }
    }

    /// Auto-transport fra Core Motion (primært) eller fart (fallback).
    private func resolveAutoTransport() -> NavTransport {
        if let m = KartLocationManager.shared.motionTransport {
            switch m { case .automotive: return .driving; case .cycling: return .cycling; case .walking: return .walking }
        }
        if let s = KartLocationManager.shared.speedMps {
            if s > 7 { return .driving }
            if s > 3 { return .cycling }
        }
        return .walking
    }

    /// Kalt ved hver posisjonsoppdatering mens nav er aktiv (live-følging).
    private func navLocationTick() {
        guard navModeActive, let dest = navDestination,
              let me = KartLocationManager.shared.currentCoordinate else { return }
        // Dørsalg: oversikt ved start → heading-up gå-POV idet du beveger
        // deg (>8 m fra start eller motion-deteksjon) — retningen du skal
        // gå peker da OPP på kartet.
        if dorsalgNavAutoPOV,
           KartLocationManager.shared.isMoving
            || (navStartCoord.map { metersBetween($0, me) > 8 } ?? false) {
            dorsalgNavAutoPOV = false
            // .walk: flat 2D heading-up. POV/drive klippet i 3D-byggmasse
            // (opptak 2026-07-19 «ustabilt») — pitch 0 kan ikke okkluderes.
            navPreset = .walk
            navPresetManual = true
            updateNavCamera(animated: true)
        }
        let destC = CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon)
        // Bevegelses-kurs til avatar-pilen: peiling fra forrige posisjon
        // (kun ved reell forflytning > 4 m — GPS-jitter gir ellers spinn).
        if let anker = navCourseAnchor {
            let d = metersBetween(anker, me)
            if d > 4 {
                navCourse = bearing(anker, me)
                navCourseAnchor = me
            }
        } else {
            navCourseAnchor = me
        }
        // Map-matching-lite: flytt progresjonen framover + oppdater ETA lokalt fra
        // gjenstående rute (ingen reroute nødvendig når du er på ruta).
        var onRouteDist = Double.greatestFiniteMagnitude
        if let route = navRoute, route.count > 1 {
            let lo = max(0, min(navProgressIndex, route.count - 2))
            let hi = min(route.count - 2, lo + 30)
            var bestI = lo
            var bestD = Double.greatestFiniteMagnitude
            for i in lo...hi {
                let d = metersBetween(me, nearestPointOnSegment(me, route[i], route[i + 1]))
                if d < bestD { bestD = d; bestI = i }
            }
            onRouteDist = bestD
            if bestI > navProgressIndex { navProgressIndex = bestI }
            // Rute-låst motor: GPS oppdaterer KUN s-target (monoton) + fart.
            // Avatar/kamera/tale/UI drives av follow-loopen (navFollowAdvance).
            if navRouteCum.count == route.count {
                let proj = projectS(point: me, route: route, cum: navRouteCum)
                let naa = Date()
                if let sist = navLastFixAt {
                    let dtFix = naa.timeIntervalSince(sist)
                    if dtFix > 0.2 {
                        if proj.s > navSTarget {
                            navFollowSpeed = min(45, (proj.s - navSTarget) / dtFix)
                        } else {
                            navFollowSpeed *= 0.7   // står stille → brems mykt
                        }
                    }
                }
                navLastFixAt = naa
                if proj.s > navSTarget { navSTarget = proj.s }
            }
        }
        // Auto-deteksjon: bytt transportform når Core Motion/fart endrer seg.
        if navTransportAuto {
            let detected = resolveAutoTransport()
            if detected != navTransport {
                navTransport = detected
                withAnimation(.easeInOut(duration: 0.4)) { navVehicle = vehicleFor(detected) }
                // Auto kamera-preset følger reisemåten (med mindre du overstyrte).
                if !navPresetManual { navPreset = .auto(for: detected) }
                recomputeNavRoute(from: me, to: CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon))
            }
        }
        // Kamera drives av follow-loopen når rutegeometrien finnes;
        // fallback til rå følging kun før første rute er klar.
        if navRouteCum.isEmpty { updateNavCamera(animated: false) }
        // Reroute-hysterese: bare re-rut når du er tydelig AV-rute (>50 m) i to
        // påfølgende tikk — ellers holder vi ruta + manøvrene stabile.
        if onRouteDist > 50 {
            navOffRouteCount += 1
            let sidenSist = navLastRerouteAt.map { Date().timeIntervalSince($0) } ?? .infinity
            if navOffRouteCount >= 2, sidenSist > 12 {
                navOffRouteCount = 0
                navRerouteAnchor = me
                navLastRerouteAt = Date()
                recomputeNavRoute(from: me, to: destC)
            }
        } else {
            navOffRouteCount = 0
        }
        // Turn-by-turn/ankomst drives av follow-loopen (navRouteVoiceTick,
        // monoton s → kan ikke loope); rå tick kun før geometrien er klar.
        if navRouteCum.isEmpty { navTurnTick(me) }
        // Fartsgrense (NVDB) — hent på nytt hver ~80 m.
        if navSpeedAnchor == nil || metersBetween(navSpeedAnchor!, me) > 80 {
            navSpeedAnchor = me
            Task {
                let s = await NvdbService.shared.speedLimit(lat: me.latitude, lon: me.longitude, using: appState.api)
                if navModeActive { navSpeedLimit = s }
            }
        }
        // «Raskere alternativ»: sjekk kollektiv/sparkesykkel når du GÅR (ikke
        // allerede på hjul), maks hvert ~70 m, til du evt. avviser forslaget.
        if navTransport == .walking, !navAltDismissed, navETAMinutes > 4 {
            if navAltAnchor == nil || metersBetween(navAltAnchor!, me) > 70 {
                navAltAnchor = me
                let destC = CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon)
                let walk = navETAMinutes
                let parkWalk = parking?.areas.first?.walkMin ?? 3
                Task {
                    // Kollektiv + sparkesykkel fra Entur, bil-ETA lokalt (MKDirections).
                    async let backend = EnturService.shared.alternatives(
                        from: me, to: destC, walkMin: walk, using: appState.api)
                    async let carEtaOpt = drivingEtaMinutes(from: me, to: destC)
                    var merged = await backend
                    if let carEta = await carEtaOpt {
                        // hele bil-turen: kjøring + finne-parkering + gange fra p-plass
                        let carTotal = carEta + 4 + parkWalk
                        let saved = walk - carTotal
                        if saved >= 1 {
                            merged.append(EnturService.Alternative(
                                kind: "car", etaMin: carTotal, savedMin: saved,
                                headline: "Kjør bil dit", detail: "inkl. parkering + gange",
                                distanceM: nil, rentalUrl: nil))
                        }
                    }
                    merged.sort { ($0.savedMin ?? 0) > ($1.savedMin ?? 0) }
                    if navModeActive { withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) { navAlternatives = merged } }
                }
            }
        }
    }

    #if DEBUG
    /// QA-kino for reklamefilm-opptaket: velg bedrift → fly inn → kort popper →
    /// «Naviger» (ekte startNavigation → heading-up 3D + lilla rute). Posisjonen
    /// drives eksternt via `simctl location`. Kun DEBUG + env QA_CINEMATIC=nordic.
    /// Reverteres før commit (#59).
    private func runNordicCinematic() {
        let nordic = KartPreviewData.leads.first(where: { $0.name.contains("Nordic Elektro") })
            ?? KartPreviewData.firstOrPlaceholder
        let nordicC = CLLocationCoordinate2D(latitude: nordic.lat, longitude: nordic.lon)
        let start = CLLocationCoordinate2D(latitude: 59.9112, longitude: 10.7494)

        // Beat 0 — velg bedriften på kartet: 3D fly-inn, nord-opp, kort skjult.
        cinematicHideCard = true
        hasSelectedLead = false
        selectedLead = nordic
        camera = .camera(MapCamera(centerCoordinate: start, distance: 1150, heading: 0, pitch: 56))
        withAnimation(.easeInOut(duration: 4.2)) {
            camera = .camera(MapCamera(centerCoordinate: nordicC, distance: 470, heading: 0, pitch: 60))
        }

        // Beat 1 (t≈3.4s) — kortet POPPER INN idet vi lander på bedriften.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.4) {
            withAnimation(.spring(response: 0.55, dampingFraction: 0.72)) {
                cinematicHideCard = false
                hasSelectedLead = true
            }
        }

        // Beat 2 (t≈6.2s) — «NAVIGER» trykkes → ekte live-nav (roterer + rute).
        DispatchQueue.main.asyncAfter(deadline: .now() + 6.2) {
            startNavigation(to: nordic)
        }
    }

    /// QA-tour for landing-videoene: scripted interaksjon som viser
    /// funksjonaliteten i bruk mens `simctl recordVideo` kjører utenpå.
    /// QA_TOUR=kart (pan → velg pin → callout → neste pin) eller
    /// QA_TOUR=dorsalg (modus på → adresse-callout → Registrer salg-ark).
    /// Ingen backend-skriv. Reverteres m/ task #59-følget.
    private func runQATour(_ kind: String) async {
        switch kind {
        case "kart":
            let leads = kartLeads
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522),
                span: MKCoordinateSpan(latitudeDelta: 0.16, longitudeDelta: 0.24)))
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            withAnimation(.easeInOut(duration: 1.7)) {
                camera = .region(MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522),
                    span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.075)))
            }
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            if let first = leads.first { selectAndZoom(first) }
            try? await Task.sleep(nanoseconds: 3_400_000_000)
            if leads.count > 2 { selectAndZoom(leads[2]) }
            try? await Task.sleep(nanoseconds: 3_400_000_000)

        case "dorsalg":
            let senter = CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7460)
            camera = .region(MKCoordinateRegion(
                center: senter,
                span: MKCoordinateSpan(latitudeDelta: 0.014, longitudeDelta: 0.02)))
            currentRegion = MKCoordinateRegion(
                center: senter,
                span: MKCoordinateSpan(latitudeDelta: 0.014, longitudeDelta: 0.02))
            setDorsalgModus(true)
            for _ in 0..<20 where dorsalgSynligeAdresser.isEmpty {
                try? await Task.sleep(nanoseconds: 300_000_000)
            }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            // Realistisk arbeidsdag: seed utfall på ~1/3 av dørene i området
            // (mest «ikke hjemme», en del vunnet, noen avslag) — deterministisk
            // på adresse-id så opptaket er stabilt.
            for a in dorsalgAdresser where dorsalgStatuser[a.id] == nil {
                let h = a.id.unicodeScalars.reduce(5381) { ($0 << 5) &+ $0 &+ Int($1.value) }
                switch abs(h) % 100 {
                case 0..<13: dorsalgStatuser[a.id] = "vunnet"
                case 13..<30: dorsalgStatuser[a.id] = "ikke_hjemme"
                case 30..<38: dorsalgStatuser[a.id] = "avslatt"
                default: break
                }
            }
            oppdaterDorsalgSynlige()
            let ledige = dorsalgSynligeAdresser.filter { dorsalgStatuser[$0.id] == nil }
            guard let adr = ledige.min(by: {
                abs($0.lat - senter.latitude) + abs($0.lon - senter.longitude)
                    < abs($1.lat - senter.latitude) + abs($1.lon - senter.longitude)
            }) else { return }
            selectDorsalgAdresse(adr)
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            dorsalgSalgFor = adr
            try? await Task.sleep(nanoseconds: 4_200_000_000)
            dorsalgSalgFor = nil
            try? await Task.sleep(nanoseconds: 700_000_000)
            // Utfall registrert → feiring + «Neste dør»-raden (kompass +
            // veiviser-linje) dukker opp; tour-en «trykker» den.
            // Seed 2 tidligere salg så feiringen viser «3 av 3 — dagsmål».
            dorsalgDagensSalg = 2
            dorsalgSettStatus("vunnet", for: adr)
            visDorsalgFeiring()
            try? await Task.sleep(nanoseconds: 3_100_000_000)
            guard let neste = nesteDorsalgAdresse(fra: adr) else { return }
            selectDorsalgAdresse(neste)
            try? await Task.sleep(nanoseconds: 2_400_000_000)
            // Avslag → motivasjons-dytt + veiviser videre.
            dorsalgSettStatus("avslatt", for: neste)
            try? await Task.sleep(nanoseconds: 3_100_000_000)
            if let tredje = nesteDorsalgAdresse(fra: neste) {
                selectDorsalgAdresse(tredje)
            }
            try? await Task.sleep(nanoseconds: 2_200_000_000)

        case "dorsalg-nav":
            // Feilsøk: hva skjer når «Naviger» trykkes fra dørsalg-callouten.
            let senter = CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7460)
            camera = .region(MKCoordinateRegion(
                center: senter,
                span: MKCoordinateSpan(latitudeDelta: 0.014, longitudeDelta: 0.02)))
            currentRegion = MKCoordinateRegion(
                center: senter,
                span: MKCoordinateSpan(latitudeDelta: 0.014, longitudeDelta: 0.02))
            setDorsalgModus(true)
            for _ in 0..<20 where dorsalgSynligeAdresser.isEmpty {
                try? await Task.sleep(nanoseconds: 300_000_000)
            }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            guard let adr = dorsalgSynligeAdresser.min(by: {
                abs($0.lat - senter.latitude) + abs($0.lon - senter.longitude)
                    < abs($1.lat - senter.latitude) + abs($1.lon - senter.longitude)
            }) else { return }
            selectDorsalgAdresse(adr)
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            dorsalgNaviger(til: adr)
            try? await Task.sleep(nanoseconds: 9_000_000_000)

        default:
            break
        }
    }
    #endif

    // MARK: Aktivitetshistorikk-card

    private var activitiesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Aktivitetshistorikk")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                // «Se alle»-knapp fjernet 2026-07-17: var død (tom closure) og
                // full aktivitetsliste har ingen flate enda.
            }
            if KartPreviewData.activities.isEmpty {
                Text("Ingen aktiviteter registrert enda")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(KrBrand.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            } else {
                VStack(spacing: 6) {
                    ForEach(KartPreviewData.activities) { a in
                        HStack(spacing: 9) {
                            ZStack {
                                Circle().fill(KrBrand.purple.opacity(0.18))
                                Image(systemName: a.icon)
                                    .font(.appScaled(size: 10, weight: .semibold))
                                    .foregroundStyle(KrBrand.purpleLight)
                            }
                            .frame(width: 26, height: 26)
                            Text(a.label)
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            Spacer()
                            Text(a.timestamp)
                                .font(.appScaled(size: 10))
                                .foregroundStyle(KrBrand.textSecondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(KrBrand.stroke, lineWidth: 1))
    }

    // MARK: Detail-panel — FIX #6/7: tabs uten kollaps + spacing

    private var detailPanel: some View {
        // iPhone: venstre kolonne (fast 310pt) + høyre kolonne får ikke plass
        // side-ved-side på compact width — stable dem vertikalt i stedet.
        let stack = DeviceIdiom.isPhone
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 0))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 0))
        return stack {
            // Venstre kolonne (fast bredde): lead-info + actions
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 11) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 9)
                            .fill(selectedLead.status.color.opacity(0.18))
                        Image(systemName: "building.2.fill")
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(selectedLead.status.color)
                    }
                    .frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(selectedLead.name)
                                .font(.appScaled(size: 15, weight: .bold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            statusBadge(selectedLead.status)
                            Button {
                                favorited.toggle()
                                showToast(favorited ? "Lagt til i favoritter" : "Fjernet fra favoritter")
                            } label: {
                                Image(systemName: favorited ? "star.fill" : "star")
                                    .font(.appScaled(size: 12))
                                    .foregroundStyle(favorited ? KrBrand.yellow : KrBrand.textTertiary)
                            }
                            .buttonStyle(.plain)
                        }
                        Text(selectedLead.address)
                            .font(.appScaled(size: 11))
                            .foregroundStyle(KrBrand.textSecondary)
                            .lineLimit(1)
                        Button { navigateOpen = true } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "location.north.line.fill")
                                    .font(.appScaled(size: 9, weight: .semibold))
                                Text(String(format: "%.1f km unna · Naviger", selectedLead.kmAway))
                                    .font(.appScaled(size: 10, weight: .semibold))
                            }
                            .foregroundStyle(KrBrand.purpleLight)
                        }
                        .buttonStyle(.plain)
                    }
                    Spacer(minLength: 0)
                    // UI-fokus fase 4: lukk kortet → lead-lista kommer tilbake
                    // (én-ting-om-gangen; kortet hadde ingen lukke-vei før).
                    Button { lukkDetaljkort() } label: {
                        Image(systemName: "xmark")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(KrBrand.textSecondary)
                            .frame(width: 28, height: 28)
                            .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8)
                                .stroke(KrBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }

                HStack(spacing: 8) {
                    Button { openLeadFullSheet = true } label: {
                        Text("Åpne lead")
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(
                                LinearGradient(
                                    colors: [KrBrand.purple, KrBrand.purpleLight],
                                    startPoint: .leading, endPoint: .trailing
                                ),
                                in: RoundedRectangle(cornerRadius: 9)
                            )
                    }
                    .buttonStyle(.plain)
                    Button { scheduleMeetingOpen = true } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar")
                                .font(.appScaled(size: 10, weight: .semibold))
                            Text("Planlegg møte")
                                .font(.appScaled(size: 11, weight: .semibold))
                                .lineLimit(1)
                        }
                        .fixedSize(horizontal: true, vertical: false)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 9)
                        .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    Button { withAnimation(.easeInOut(duration: 0.4)) { startNavigation(to: selectedLead) } } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "location.north.line.fill")
                                .font(.appScaled(size: 10, weight: .semibold))
                            Text("Naviger")
                                .font(.appScaled(size: 11, weight: .semibold))
                                .lineLimit(1)
                        }
                        .fixedSize(horizontal: true, vertical: false)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 9)
                        .background(KrBrand.purple.opacity(0.22), in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.purpleLight.opacity(0.5), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    Menu {
                        Button { navigateTo(selectedLead) } label: {
                            Label("Naviger i Apple Maps", systemImage: "map.fill")
                        }
                        if let phone = selectedLead.phoneOrDemo {
                            Button { makeCall(phone) } label: {
                                Label("Ring kontakt", systemImage: "phone.fill")
                            }
                        }
                        if let mail = selectedLead.emailOrDemo {
                            Button { sendEmail(mail, subject: "Oppfølging — \(selectedLead.name)") } label: {
                                Label("Send e-post", systemImage: "envelope.fill")
                            }
                            Button {
                                sendDelayNotice(to: mail,
                                                etaMin: navModeActive ? navETAMinutes : nil,
                                                reason: navDelayReason)
                            } label: {
                                Label("Meld forsinkelse til møtet", systemImage: "clock.badge.exclamationmark.fill")
                            }
                        }
                        Divider()
                        Button { showStatusChange = true } label: {
                            Label("Endre status", systemImage: "tag.fill")
                        }
                        Button { showAssignSeller = true } label: {
                            Label("Tildel selger", systemImage: "person.crop.circle.fill")
                        }
                        // «Arkiver lead» fjernet 2026-07-17: bekreftelses-
                        // dialogen var toast-fasade uten API.
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 32, height: 32)
                            .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
                    }
                }

                // Metadata-grid 2x2 (mer kompakt) — 4-kolonne på Mac
                LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 2, iPad: 2, mac: 4, spacing: 12),
                          alignment: .leading, spacing: 8) {
                    if DemoModeManager.isActiveNonisolated {
                        // Demo-visningsdata — ekte bransje/ansatte/omsetning har
                        // ingen kilde i LeadModel enda.
                        metaItem(label: "Bransje",  value: "Elektro")
                        metaItem(label: "Ansatt",   value: "25-50")
                        metaItem(label: "Omsetning", value: "10-20 mill.")
                    }
                    metaItem(label: "Sist aktivitet", value: selectedLead.lastActivity ?? "—")
                }

                // Entur: kollektiv-tilgjengelighet (vises når backend svarer)
                if let r = reachability, r.score != nil {
                    reachabilitySection(r)
                }
                // Bilparkering nær kunden (Statens vegvesen)
                if let p = parking, let area = p.areas.first {
                    parkingSection(area, apps: p.apps)
                }
            }
            .kartColumnWidth(310)

            // Divider — vertikal ved side-ved-side, horisontal ved stabling
            if DeviceIdiom.isPhone {
                Rectangle().fill(KrBrand.stroke)
                    .frame(height: 1)
                    .padding(.vertical, 14)
            } else {
                Rectangle().fill(KrBrand.stroke)
                    .frame(width: 1)
                    .padding(.horizontal, 14)
            }

            // Høyre kolonne: tabs + innhold — FIX #6: kompakt tab-rad
            VStack(alignment: .leading, spacing: 10) {
                ZStack(alignment: .bottom) {
                    Rectangle().fill(KrBrand.stroke).frame(height: 1).padding(.top, 28)
                    HStack(spacing: 0) {
                        ForEach(DetailTab.allCases, id: \.self) { tab in
                            tabButton(tab)
                        }
                        Spacer()
                    }
                }
                .frame(height: 30)

                // FIX #7: tydelig padding mellom tab og innhold
                tabContent
                    .padding(.top, 6)

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(KrBrand.stroke, lineWidth: 1))
    }

    // MARK: - Entur kollektiv-tilgjengelighet (lead-kortet)

    @ViewBuilder
    private func reachabilitySection(_ r: EnturService.Reachability) -> some View {
        let c = EnturService.labelColor(r.label)
        let col = Color(red: c.r, green: c.g, blue: c.b)
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: "tram.fill")
                    .font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(col)
                Text("Kollektivtilgjengelighet")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                Spacer()
                if let s = r.score {
                    Text("\(r.label) · \(s)")
                        .font(.appScaled(size: 10, weight: .bold)).foregroundStyle(col)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(col.opacity(0.18), in: Capsule())
                }
            }
            if let stop = r.nearestStop {
                HStack(spacing: 6) {
                    Image(systemName: "figure.walk")
                        .font(.appScaled(size: 10)).foregroundStyle(KrBrand.textSecondary)
                    Text("\(stop.name) · \(stop.walkMin) min å gå")
                        .font(.appScaled(size: 11)).foregroundStyle(KrBrand.textSecondary).lineLimit(1)
                }
            }
            if !r.departures.isEmpty {
                HStack(spacing: 6) {
                    ForEach(r.departures.prefix(3)) { d in
                        HStack(spacing: 3) {
                            Image(systemName: EnturService.modeIcon(d.mode))
                                .font(.appScaled(size: 9, weight: .semibold))
                            Text("\(d.line) \(d.inMin)m")
                                .font(.appScaled(size: 10, weight: .semibold))
                            if d.realtime { Circle().fill(KrBrand.green).frame(width: 5, height: 5) }
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 4)
                        .background(KrBrand.cardHi, in: Capsule())
                    }
                }
            }
            if r.micromobility.scooters + r.micromobility.bikes > 0 {
                HStack(spacing: 5) {
                    Image(systemName: "scooter")
                        .font(.appScaled(size: 10)).foregroundStyle(KrBrand.purpleLight)
                    Text(microText(r.micromobility))
                        .font(.appScaled(size: 10)).foregroundStyle(KrBrand.textSecondary)
                }
            }
        }
        .padding(10)
        .background(KrBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(col.opacity(0.3), lineWidth: 1))
    }

    // MARK: - Bilparkering (lead-kortet)

    @ViewBuilder
    private func parkingSection(_ area: ParkingService.Area, apps: [ParkingService.ParkingApp]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: "parkingsign.circle.fill")
                    .font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(KrBrand.blue)
                Text("Parkering nær kunden")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                Spacer()
                Text("\(area.walkMin) min å gå")
                    .font(.appScaled(size: 10, weight: .bold)).foregroundStyle(KrBrand.blue)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(KrBrand.blue.opacity(0.18), in: Capsule())
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(area.navn).font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white).lineLimit(1)
                Text("\(area.operator) · \(area.distanceM) m")
                    .font(.appScaled(size: 10)).foregroundStyle(KrBrand.textSecondary).lineLimit(1)
            }
            if !apps.isEmpty {
                HStack(spacing: 6) {
                    ForEach(apps.prefix(2)) { app in
                        Button {
                            if let url = URL(string: app.url) { openURL(url) }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.up.forward.app.fill").font(.appScaled(size: 9, weight: .semibold))
                                Text("Åpne \(app.name)").font(.appScaled(size: 10, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 9).padding(.vertical, 6)
                            .background(KrBrand.cardHi, in: Capsule())
                            .overlay(Capsule().stroke(KrBrand.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                Text("Pris står på skiltet — betaling i appen")
                    .font(.appScaled(size: 9)).foregroundStyle(KrBrand.textTertiary)
            }
        }
        .padding(10)
        .background(KrBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(KrBrand.blue.opacity(0.3), lineWidth: 1))
    }

    private func microText(_ m: EnturService.Reachability.Micromobility) -> String {
        var parts: [String] = []
        if m.scooters > 0 { parts.append("\(m.scooters) elsparkesykler") }
        if m.bikes > 0 { parts.append("\(m.bikes) bysykler") }
        var s = parts.joined(separator: ", ")
        if let n = m.nearestM { s += " · nærmeste \(n) m" }
        return s
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .info:       tabInformasjon
        case .activities: tabAktiviteter
        case .notes:      tabNotater
        case .files:      tabFiler
        }
    }

    private func metaItem(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.appScaled(size: 10))
                .foregroundStyle(KrBrand.textSecondary)
            Text(value)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
    }

    private func tabButton(_ tab: DetailTab) -> some View {
        let isSelected = tab == selectedTab
        return Button { selectedTab = tab } label: {
            VStack(spacing: 4) {
                Text(tab.rawValue)
                    .font(.appScaled(size: 12, weight: isSelected ? .bold : .semibold))
                    .foregroundStyle(isSelected ? KrBrand.purpleLight : KrBrand.textSecondary)
                    .fixedSize()
                Rectangle()
                    .fill(isSelected ? KrBrand.purpleLight : Color.clear)
                    .frame(height: 2)
            }
            .padding(.horizontal, 11)
        }
        .buttonStyle(.plain)
    }

    // MARK: Tab-innhold

    private var tabInformasjon: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("KONTAKTPERSON")
                .font(.appScaled(size: 9, weight: .bold))
                .foregroundStyle(KrBrand.textTertiary)

            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(KrBrand.purple.opacity(0.25))
                    Text("AJ")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(KrBrand.purpleLight)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Anders Johansen")
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Daglig leder")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(KrBrand.textSecondary)
                }
                Spacer()
                HStack(spacing: 6) {
                    if let phone = selectedLead.phoneOrDemo {
                        actionIcon("phone") { makeCall(phone) }
                    }
                    if let mail = selectedLead.emailOrDemo {
                        actionIcon("envelope") { sendEmail(mail) }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("NOTAT")
                    .font(.appScaled(size: 9, weight: .bold))
                    .foregroundStyle(KrBrand.textTertiary)
                Text("Interessert i nytt el-anlegg til kontorbygg. Følge opp prisforslag og referanseprosjekter.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button { openLeadFullSheet = true } label: {
                HStack(spacing: 4) {
                    Text("Se mer informasjon")
                        .font(.appScaled(size: 11, weight: .semibold))
                    Image(systemName: "arrow.right")
                        .font(.appScaled(size: 9, weight: .semibold))
                }
                .foregroundStyle(KrBrand.purpleLight)
            }
            .buttonStyle(.plain)
        }
    }

    private var tabAktiviteter: some View {
        VStack(spacing: 6) {
            if KartPreviewData.activities.isEmpty {
                detailTabEmptyState("Ingen aktiviteter registrert enda")
            }
            ForEach(KartPreviewData.activities) { a in
                HStack(spacing: 9) {
                    ZStack {
                        Circle().fill(KrBrand.purple.opacity(0.18))
                        Image(systemName: a.icon)
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(KrBrand.purpleLight)
                    }
                    .frame(width: 26, height: 26)
                    Text(a.label)
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Text(a.timestamp)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(KrBrand.textSecondary)
                }
            }
        }
    }
    private var tabNotater: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Sticky add-note-felt (Pakke 10.1: LeadNoteSheet med kategori + pin)
            Button { showNoteEditor = true } label: {
                HStack(spacing: 8) {
                    ZStack {
                        Circle().fill(KrBrand.purple.opacity(0.25))
                        Text("LK")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(KrBrand.purpleLight)
                    }
                    .frame(width: 28, height: 28)
                    HStack(spacing: 8) {
                        Image(systemName: "square.and.pencil")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(KrBrand.textTertiary)
                        Text("Skriv et notat…")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(KrBrand.textTertiary)
                        Spacer()
                    }
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(KrBrand.stroke, lineWidth: 1))
                }
            }
            .buttonStyle(.plain)

            if KartPreviewData.notes.isEmpty {
                detailTabEmptyState("Ingen notater enda")
            }
            ForEach(KartPreviewData.notes) { n in
                noteRow(n)
            }
        }
    }

    /// Ærlig tom-tilstand for detalj-tabs (ikke-demo uten ekte data).
    private func detailTabEmptyState(_ text: String) -> some View {
        Text(text)
            .font(.appScaled(size: 11, weight: .semibold))
            .foregroundStyle(KrBrand.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    private func noteRow(_ n: NoteItemMock) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 7) {
                ZStack {
                    Circle().fill(n.authorColor.opacity(0.25))
                    Text(n.authorInitials)
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(n.authorColor)
                }
                .frame(width: 22, height: 22)
                Text(n.author)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                if n.pinned {
                    Image(systemName: "pin.fill")
                        .font(.appScaled(size: 8))
                        .foregroundStyle(KrBrand.yellow)
                }
                Spacer()
                Text(n.timestamp)
                    .font(.appScaled(size: 9))
                    .foregroundStyle(KrBrand.textTertiary)
            }
            Text(n.body)
                .font(.appScaled(size: 11))
                .foregroundStyle(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(9)
        .background(
            n.pinned ? KrBrand.yellow.opacity(0.08) : KrBrand.cardHi,
            in: RoundedRectangle(cornerRadius: 9)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 9)
                .stroke(n.pinned ? KrBrand.yellow.opacity(0.35) : KrBrand.stroke, lineWidth: 1)
        )
    }

    private var tabFiler: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(KartPreviewData.files.count) filer")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(KrBrand.textSecondary)
                Spacer()
                // Pakke 10.1 (Daniel-feedback 2026-07-01): gjenbruk Leads-
                // fanens rike UploadFileSheet (Fra iPad / Fra skyen / Skann
                // dokument / Ta bilde) i stedet for lokal toast-stub.
                Button { showUploadFile = true } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus.circle.fill")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text("Last opp")
                            .font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(KrBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }

            if KartPreviewData.files.isEmpty {
                detailTabEmptyState("Ingen filer lastet opp enda")
            }
            ForEach(KartPreviewData.files) { f in
                fileRow(f)
            }
        }
    }

    // 2026-07-17: den simulerte nedlastingen («✓ lastet ned»-toast uten fil)
    // fjernet — filene er demo-mock, raden er ren datavisning nå.
    private func fileRow(_ f: FileItemMock) -> some View {
            HStack(spacing: 9) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(f.kind.color.opacity(0.22))
                    Image(systemName: f.kind.icon)
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(f.kind.color)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(f.name)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        Text(f.size)
                            .font(.appScaled(size: 9))
                            .foregroundStyle(KrBrand.textSecondary)
                        Text("·")
                            .font(.appScaled(size: 9))
                            .foregroundStyle(KrBrand.textTertiary)
                        Text(f.uploadedAt)
                            .font(.appScaled(size: 9))
                            .foregroundStyle(KrBrand.textTertiary)
                    }
                }
                Spacer()
            }
            .padding(9)
            .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
    }

    private func actionIcon(_ name: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle().fill(KrBrand.purple.opacity(0.18))
                Image(systemName: name)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(KrBrand.purpleLight)
            }
            .frame(width: 32, height: 32)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Pin-views

fileprivate struct ClusterPin: View {
    let count: Int
    let color: Color

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [color.opacity(0.40), color.opacity(0)],
                    center: .center, startRadius: 16, endRadius: 32
                ))
                .frame(width: 72, height: 72)
                .blur(radius: 5)
            Circle()
                .fill(color.opacity(0.95))
                .overlay(
                    Circle().stroke(Color.white.opacity(0.5), lineWidth: 2)
                )
                .frame(width: 44, height: 44)
                .shadow(color: color.opacity(0.6), radius: 8, x: 0, y: 2)
            Text("\(count)")
                // Kart-grafikk — fast størrelse (AX sprenger sirkelen)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
        }
    }
}

fileprivate struct KartStatusPin: View {
    let status: MapLeadMock.PinStatus
    let isSelected: Bool

    var body: some View {
        ZStack {
            if status == .hot {
                KartGlowHalo(color: KrBrand.red)
            } else if status == .warm {
                KartGlowHalo(color: KrBrand.orange)
            }
            KartDropPin()
                .fill(
                    LinearGradient(
                        colors: [status.color, status.color.opacity(0.85)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .overlay(
                    KartDropPin()
                        .fill(
                            LinearGradient(
                                colors: [Color.white.opacity(0.35), Color.white.opacity(0)],
                                startPoint: .top, endPoint: .center
                            )
                        )
                )
                .overlay(
                    KartDropPin()
                        .stroke(isSelected ? Color.white : Color.white.opacity(0.85),
                                lineWidth: isSelected ? 3 : 2)
                )
                .frame(width: 38, height: 48)
                .shadow(color: status.color.opacity(0.6), radius: isSelected ? 12 : 6, x: 0, y: 2)

            Image(systemName: "building.2.fill")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .offset(y: -6)
        }
        .frame(width: 100, height: 100)
    }
}

// MARK: - DroppedPin (drop-FAB-resultat)

fileprivate struct DroppedPin: View {
    @State private var pulse: Bool = false
    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0.6),
                                                Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0)],
                                       center: .center, startRadius: 12, endRadius: 36))
                .frame(width: 72, height: 72)
                .scaleEffect(pulse ? 1.4 : 1)
                .opacity(pulse ? 0 : 1)
                .animation(.easeOut(duration: 1.3).repeatForever(autoreverses: false), value: pulse)
            Circle()
                .fill(Color(red: 0.66, green: 0.32, blue: 0.99))
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .frame(width: 26, height: 26)
            Image(systemName: "plus")
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
        }
        .onAppear { pulse = true }
    }
}

// MARK: - Dørsalg adresse-pin (2026-07-18)

/// Husstands-pin i dørsalg-modus — SAMME dråpe-design som lead-pins
/// (KartDropPin + gradient + hvit kant), bare mindre siden det kan stå
/// hundrevis på skjermen. Fargen viser utfallet på døra:
/// lilla = ubesøkt, grønn = vunnet kunde, rød = avslått.
/// Feiring etter registrert salg: grønn sjekk popper med sprett mens
/// konfetti-partikler sprer seg utover, pluss milepæl mot dagsmålet
/// («2 av 3 mot dagsmålet» / «Dagsmål nådd!» m/ gull-variant og ekstra
/// konfetti). Ren SwiftUI — auto-drevet av onAppear, forelder styrer
/// visning/dismiss (dorsalgFeiring).
fileprivate struct SalgFeiringView: View {
    let antall: Int
    let maal: Int
    @State private var vis = false

    private var maalNaadd: Bool { antall >= maal }

    private static let farger: [Color] = [
        KrBrand.green, KrBrand.purpleLight, KrBrand.yellow, .white, KrBrand.purple,
    ]
    private static let gull = Color(red: 1.0, green: 0.80, blue: 0.25)

    var body: some View {
        let antallPartikler = maalNaadd ? 32 : 20
        ZStack {
            // Konfetti i vifte rundt sjekken — flere når dagsmålet nås.
            ForEach(0..<antallPartikler, id: \.self) { i in
                let vinkel = Double(i) / Double(antallPartikler) * 2 * .pi
                Circle()
                    .fill(maalNaadd && i % 3 == 0
                          ? Self.gull : Self.farger[i % Self.farger.count])
                    .frame(width: i % 3 == 0 ? 11 : 7,
                           height: i % 3 == 0 ? 11 : 7)
                    .offset(x: vis ? cos(vinkel) * (i % 2 == 0 ? 165 : 110) : 0,
                            y: vis ? sin(vinkel) * (i % 2 == 0 ? 165 : 110) + 30 : 0)
                    .opacity(vis ? 0 : 1)
                    .animation(.easeOut(duration: maalNaadd ? 1.15 : 0.95)
                        .delay(Double(i % 5) * 0.03), value: vis)
            }
            VStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(maalNaadd ? Self.gull : KrBrand.green)
                        .frame(width: 76, height: 76)
                        .shadow(color: (maalNaadd ? Self.gull : KrBrand.green).opacity(0.65),
                                radius: 20)
                    Image(systemName: maalNaadd ? "trophy.fill" : "checkmark")
                        .font(.system(size: maalNaadd ? 32 : 36, weight: .heavy))
                        .foregroundStyle(.white)
                }
                .scaleEffect(vis ? 1 : 0.15)
                .animation(.spring(response: 0.38, dampingFraction: 0.55), value: vis)
                VStack(spacing: 6) {
                    Text(maalNaadd ? "Dagsmål nådd!" : "Salg registrert!")
                        .font(.appScaled(size: 16, weight: .heavy))
                        .foregroundStyle(.white)
                    // Milepæl-prikker mot dagsmålet («2 av 3»)
                    HStack(spacing: 6) {
                        ForEach(0..<max(maal, antall), id: \.self) { i in
                            Circle()
                                .fill(i < antall
                                      ? (maalNaadd ? Self.gull : KrBrand.green)
                                      : Color.white.opacity(0.25))
                                .frame(width: 9, height: 9)
                        }
                        Text("\(min(antall, maal)) av \(maal)")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(.white.opacity(0.85))
                            .padding(.leading, 4)
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
                .opacity(vis ? 1 : 0)
                .offset(y: vis ? 0 : 10)
                .animation(.easeOut(duration: 0.3).delay(0.15), value: vis)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(vis ? 0.25 : 0))
        .onAppear { vis = true }
    }
}

fileprivate struct DorsalgAdressePin: View {
    let status: String?      // nil | "vunnet" | "avslatt"
    let valgt: Bool
    let onTap: () -> Void

    private var farge: Color {
        switch status {
        case "vunnet": return KrBrand.green
        case "avslatt": return KrBrand.red
        case "ikke_hjemme": return KrBrand.yellow
        default: return KrBrand.purpleLight
        }
    }
    private var ikon: String {
        switch status {
        case "vunnet": return "checkmark"
        case "avslatt": return "xmark"
        case "ikke_hjemme": return "clock"
        default: return "house.fill"
        }
    }

    var body: some View {
        // Ytelse: skygge KUN på valgt pin — soft shadow på 400 samtidige
        // annotations var GPU-tungt (treg panorering, Daniel 2026-07-18).
        Button(action: onTap) {
            ZStack {
                KartDropPin()
                    .fill(LinearGradient(colors: [farge, farge.opacity(0.85)],
                                         startPoint: .top, endPoint: .bottom))
                    .overlay(
                        KartDropPin()
                            .stroke(valgt ? Color.white : Color.white.opacity(0.85),
                                    lineWidth: valgt ? 2.5 : 1.5)
                    )
                    .frame(width: valgt ? 27 : 21, height: valgt ? 34 : 27)
                    .shadow(color: valgt ? farge.opacity(0.8) : .clear,
                            radius: valgt ? 8 : 0, y: 1)
                Image(systemName: ikon)
                    .font(.system(size: valgt ? 10 : 8, weight: .bold))
                    .foregroundStyle(.white)
                    .offset(y: valgt ? -4.5 : -3.5)
            }
            .frame(width: 32, height: 40)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // «Genie»-pop: valgt pin vokser ut av spissen med sprett (overshoot)
        // — tydelig indikasjon på hvilken dør du står på (Daniel 2026-07-19).
        .scaleEffect(valgt ? 1.35 : 1.0, anchor: .bottom)
        .animation(.spring(response: 0.34, dampingFraction: 0.55), value: valgt)
    }
}

// MARK: - MapStyleSheet

struct MapStyleSheet: View {
    @Binding var selected: KartView.MapStyleChoice
    @Environment(\.dismiss) private var dismiss

    private enum SBrand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 2, iPad: 2, mac: 4, spacing: 12), spacing: 12) {
                    ForEach(KartView.MapStyleChoice.allCases, id: \.self) { style in
                        styleCard(style)
                    }
                }
                .padding(20)
            }
            .background(SBrand.bg.ignoresSafeArea())
            .navigationTitle("Kartstil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(SBrand.purpleLight)
                }
            }
            .toolbarBackground(SBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.medium])
    }

    private func styleCard(_ style: KartView.MapStyleChoice) -> some View {
        let isSelected = selected == style
        return Button {
            selected = style
            dismiss()
        } label: {
            VStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(LinearGradient(
                            colors: [SBrand.purple.opacity(0.30), SBrand.purpleLight.opacity(0.10)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                    Image(systemName: style.icon)
                        .font(.appScaled(size: 34, weight: .semibold))
                        .foregroundStyle(SBrand.purpleLight)
                }
                .frame(height: 110)
                Text(style.rawValue)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                if isSelected {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.appScaled(size: 11))
                        Text("Aktiv")
                            .font(.appScaled(size: 10, weight: .bold))
                    }
                    .foregroundStyle(SBrand.purpleLight)
                }
            }
            .padding(12)
            .background(SBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(isSelected ? SBrand.purpleLight : SBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - NavAvatarPuck (gå/kjøretøy-avatar i navigasjons-modus)

/// «Meg» i nav: en tett bakke-skygge + gå-figur eller kjøretøy (bil/buss/
/// sparkesykkel) som ligger PÅ veien (ingen stråle/sveving). Kombinert med
/// heading-up-kameraet leser det som at man beveger seg langs ruta.
fileprivate struct NavAvatarPuck: View {
    var initials: String
    var email: String?
    var vehicle: KartView.NavVehicle
    var moving: Bool
    /// Kjøreretning i SKJERM-grader (kurs minus kamera-heading) — pilen
    /// peker dit du faktisk beveger deg, uansett kamera-modus.
    var screenCourse: Double?

    private let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    private let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)

    /// Samme portrett-oppslag som MeMapPin: `portrait-<email-local>`-asset.
    private var portraitAsset: String? {
        guard let email, let local = email.split(separator: "@").first else { return nil }
        let candidate = "portrait-\(local.lowercased())"
        return UIImage(named: candidate) != nil ? candidate : nil
    }

    var body: some View {
        ZStack {
            // Tett bakke-skygge RETT UNDER — grunner figuren på veien (ingen
            // stråle/sveve-effekt som får den til å se «flyvende» ut).
            Ellipse()
                .fill(Color.black.opacity(0.32))
                .frame(width: 40, height: 13)
                .blur(radius: 3)
                .offset(y: 24)

            // Figuren skifter med reisemåte: gå-person (leddelt, går) eller
            // kjøretøy. I bevegelse m/ kjent kurs roteres en TOP-DOWN-bil
            // etter faktisk kjøreretning (profil-bilen kan ikke roteres
            // troverdig — Daniels funn 2026-07-19); stillestående vises
            // profil-avataren som før.
            if vehicle == .walk {
                WalkingAvatar(portraitAsset: portraitAsset, initials: initials)
                // Kurs-pil for gange: peker dit du faktisk beveger deg.
                if let c = screenCourse, moving {
                    Image(systemName: "location.north.fill")
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(purpleLight)
                        .shadow(color: .black.opacity(0.6), radius: 2, y: 1)
                        .offset(y: -46)
                        .rotationEffect(.degrees(c))
                        .animation(.easeInOut(duration: 0.6), value: c)
                }
            } else if let c = screenCourse, moving {
                TopViewCarMarker(color: purple)
                    .rotationEffect(.degrees(c))
                    .animation(.easeInOut(duration: 0.6), value: c)
                // Profil-hodet flyter skjermfast over bilen (roteres ikke).
                if let asset = portraitAsset {
                    Image(asset)
                        .resizable().scaledToFill()
                        .frame(width: 26, height: 26)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                        .shadow(color: .black.opacity(0.4), radius: 3, y: 1)
                        .offset(y: -40)
                }
            } else {
                WheeledVehicleAvatar(kind: vehicle, portraitAsset: portraitAsset, initials: initials)
            }
        }
        .frame(width: 92, height: 110)
    }
}

/// Top-down-bil for nav-avataren: karosseri m/ front-/bakrute sett ovenfra,
/// nese opp — roteres av kalleren etter kjøreretning.
fileprivate struct TopViewCarMarker: View {
    var color: Color
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9)
                .fill(LinearGradient(colors: [color, color.opacity(0.78)],
                                     startPoint: .top, endPoint: .bottom))
                .frame(width: 27, height: 48)
                .overlay(RoundedRectangle(cornerRadius: 9)
                    .stroke(.white.opacity(0.9), lineWidth: 1.6))
            // Frontrute (mørk) — markerer nesen
            RoundedRectangle(cornerRadius: 3)
                .fill(Color(red: 0.07, green: 0.04, blue: 0.15).opacity(0.85))
                .frame(width: 19, height: 9)
                .offset(y: -9)
            // Bakrute
            RoundedRectangle(cornerRadius: 3)
                .fill(Color(red: 0.07, green: 0.04, blue: 0.15).opacity(0.55))
                .frame(width: 19, height: 7)
                .offset(y: 13)
        }
        .shadow(color: .black.opacity(0.45), radius: 5, y: 2)
    }
}

/// Leddelt gå-figur som faktisk går: bein og armer svinger i motfase via en
/// kontinuerlig gå-syklus (TimelineView), med bob og profilbilde som hode.
fileprivate struct WalkingAvatar: View {
    var portraitAsset: String?
    var initials: String

    private let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    private let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    private let limb = Color(red: 0.42, green: 0.22, blue: 0.72)

    var body: some View {
        TimelineView(.animation) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            let s = sin(t * 7.2)              // gå-fase
            let legAngle = s * 24.0           // bein svinger ±24°
            let armAngle = -s * 18.0          // armer i motfase
            let bob = abs(s) * 2.4            // vertikal bob per steg

            ZStack {
                // BEIN (bak torso)
                legShape(angle: legAngle).offset(x: -5, y: 20)
                legShape(angle: -legAngle).offset(x: 5, y: 20)

                // TORSO
                Capsule()
                    .fill(LinearGradient(colors: [purpleLight, purple], startPoint: .top, endPoint: .bottom))
                    .frame(width: 24, height: 34)
                    .overlay(Capsule().stroke(.white.opacity(0.85), lineWidth: 2))
                    .offset(y: -2)
                    .shadow(color: purple.opacity(0.6), radius: 6, y: 3)

                // ARMER (foran torso, svinger motsatt)
                armShape(angle: armAngle).offset(x: -12, y: -8)
                armShape(angle: -armAngle).offset(x: 12, y: -8)

                // HODE = profilbilde
                Group {
                    if let asset = portraitAsset {
                        SmartPortrait(assetName: asset)
                            .frame(width: 34, height: 34)
                            .clipShape(Circle())
                    } else {
                        Text(initials)
                            .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(LinearGradient(colors: [purpleLight, purple],
                                                       startPoint: .topLeading, endPoint: .bottomTrailing), in: Circle())
                    }
                }
                .overlay(Circle().stroke(.white, lineWidth: 2.5))
                .shadow(color: .black.opacity(0.35), radius: 3, y: 2)
                .offset(y: -32)
            }
            .offset(y: -bob)
        }
        .frame(width: 60, height: 92)
    }

    private func legShape(angle: Double) -> some View {
        Capsule().fill(limb)
            .frame(width: 9, height: 30)
            .rotationEffect(.degrees(angle), anchor: .top)
    }

    private func armShape(angle: Double) -> some View {
        Capsule().fill(purple)
            .frame(width: 7, height: 24)
            .rotationEffect(.degrees(angle), anchor: .top)
    }
}

/// Ett hjul med eiker som roterer — brukes av kjøretøy-figurene.
fileprivate struct SpinningWheel: View {
    var r: CGFloat
    var angle: Double
    var body: some View {
        ZStack {
            Circle().fill(Color(white: 0.10)).frame(width: r * 2, height: r * 2)
            Circle().strokeBorder(Color(white: 0.45), lineWidth: 2).frame(width: r * 2, height: r * 2)
            ForEach(0..<4, id: \.self) { i in
                Rectangle().fill(Color(white: 0.62))
                    .frame(width: 1.6, height: r * 1.5)
                    .rotationEffect(.degrees(Double(i) * 45))
            }
            Circle().fill(Color(white: 0.7)).frame(width: r * 0.5, height: r * 0.5)
        }
        .rotationEffect(.degrees(angle))
    }
}

/// Ekte 3D-aktig kjøretøy-figur (bil / buss / sparkesykkel) sett fra siden, med
/// HJUL SOM ROTERER mens du kjører + karosseri-bob + retnings-stråle. Analogt til
/// WalkingAvatar, men på hjul. Profil-badge viser hvem som kjører.
fileprivate struct WheeledVehicleAvatar: View {
    var kind: KartView.NavVehicle   // scooter | car | bus
    var portraitAsset: String?
    var initials: String

    private let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    private let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    private let glass = Color(red: 0.62, green: 0.80, blue: 0.98)

    var body: some View {
        TimelineView(.animation) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            let spin = (t * 520).truncatingRemainder(dividingBy: 360)  // hjul-rotasjon
            ZStack {
                // Tett skygge RETT UNDER hjulene — grunner kjøretøyet på veien
                // (ingen stråle/sveving = ser ut som det kjører, ikke flyr).
                Ellipse().fill(Color.black.opacity(0.30))
                    .frame(width: 46, height: 12).blur(radius: 3).offset(y: 24)

                Group {
                    switch kind {
                    case .car: carBody(spin: spin)
                    case .bus: busBody(spin: spin)
                    default:   scooterBody(spin: spin)
                    }
                }

                // Profil-badge (hvem kjører)
                Group {
                    if let asset = portraitAsset {
                        SmartPortrait(assetName: asset).frame(width: 24, height: 24).clipShape(Circle())
                    } else {
                        Text(initials).font(.appScaled(size: 9, weight: .bold, design: .rounded))
                            .foregroundStyle(.white).frame(width: 24, height: 24).background(purple, in: Circle())
                    }
                }
                .overlay(Circle().stroke(.white, lineWidth: 2))
                .offset(x: 24, y: -22)
            }
            .frame(width: 96, height: 96)
        }
    }

    // MARK: kjøretøy-karosserier (sett ovenfra, FRONT PEKER OPP = kjøreretning,
    // siden kartet er heading-up. Frontlys + frontrute øverst markerer fronten.)

    private func carBody(spin: Double) -> some View {
        ZStack {
            // hjul på sidene (foran + bak) — stikker litt ut, snurrer
            SpinningWheel(r: 7, angle: spin).offset(x: -17, y: -12)
            SpinningWheel(r: 7, angle: spin).offset(x: 17, y: -12)
            SpinningWheel(r: 7, angle: spin).offset(x: -17, y: 13)
            SpinningWheel(r: 7, angle: spin).offset(x: 17, y: 13)
            // karosseri (langt = peker opp)
            RoundedRectangle(cornerRadius: 11)
                .fill(LinearGradient(colors: [purpleLight, purple], startPoint: .top, endPoint: .bottom))
                .frame(width: 32, height: 50)
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(.white.opacity(0.85), lineWidth: 1.5))
            // frontrute (øverst) + bakrute
            RoundedRectangle(cornerRadius: 4).fill(glass).frame(width: 22, height: 11).offset(y: -12)
            RoundedRectangle(cornerRadius: 3).fill(glass.opacity(0.7)).frame(width: 20, height: 8).offset(y: 13)
            // frontlys (fronten = opp)
            HStack(spacing: 16) {
                Circle().fill(.white).frame(width: 4, height: 4)
                Circle().fill(.white).frame(width: 4, height: 4)
            }.offset(y: -22)
        }
        .shadow(color: purple.opacity(0.6), radius: 7, y: 4)
    }

    private func busBody(spin: Double) -> some View {
        ZStack {
            SpinningWheel(r: 7, angle: spin).offset(x: -16, y: -16)
            SpinningWheel(r: 7, angle: spin).offset(x: 16, y: -16)
            SpinningWheel(r: 7, angle: spin).offset(x: -16, y: 16)
            SpinningWheel(r: 7, angle: spin).offset(x: 16, y: 16)
            RoundedRectangle(cornerRadius: 9)
                .fill(LinearGradient(colors: [purpleLight, purple], startPoint: .top, endPoint: .bottom))
                .frame(width: 30, height: 58)
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(.white.opacity(0.85), lineWidth: 1.5))
            // frontrute øverst
            RoundedRectangle(cornerRadius: 4).fill(glass).frame(width: 22, height: 10).offset(y: -20)
            // vindus-rekker langs sidene
            VStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { _ in RoundedRectangle(cornerRadius: 2).fill(glass.opacity(0.75)).frame(width: 20, height: 7) }
            }.offset(y: 4)
        }
        .shadow(color: purple.opacity(0.6), radius: 7, y: 4)
    }

    private func scooterBody(spin: Double) -> some View {
        ZStack {
            // dekk (vertikalt), front-hjul opp / bak-hjul ned
            Capsule().fill(purpleLight).frame(width: 5, height: 30)
            SpinningWheel(r: 7, angle: spin).offset(y: -18)
            SpinningWheel(r: 7, angle: spin).offset(y: 16)
            // styre (T øverst = front)
            Capsule().fill(purple).frame(width: 20, height: 4).offset(y: -20)
        }
        .shadow(color: purple.opacity(0.6), radius: 6, y: 3)
    }
}

// MARK: - AISuggestionPin (pulse-anim m/ "AI"-badge)

fileprivate struct AISuggestionPin: View {
    let score: Int
    @State private var pulse: Bool = false

    var body: some View {
        ZStack {
            // Pulse ring
            Circle()
                .stroke(Color(red: 0.75, green: 0.45, blue: 1.0), lineWidth: 2)
                .frame(width: 60, height: 60)
                .scaleEffect(pulse ? 1.6 : 1)
                .opacity(pulse ? 0 : 0.8)
                .animation(.easeOut(duration: 1.5).repeatForever(autoreverses: false), value: pulse)
            // Halo
            Circle()
                .fill(RadialGradient(
                    colors: [Color(red: 0.75, green: 0.45, blue: 1.0).opacity(0.55),
                             Color(red: 0.75, green: 0.45, blue: 1.0).opacity(0)],
                    center: .center, startRadius: 12, endRadius: 38
                ))
                .frame(width: 72, height: 72)
                .blur(radius: 5)
            // Core
            Circle()
                .fill(LinearGradient(
                    colors: [Color(red: 0.75, green: 0.45, blue: 1.0),
                             Color(red: 0.66, green: 0.32, blue: 0.99)],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .frame(width: 34, height: 34)
                .shadow(color: Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0.7), radius: 8, x: 0, y: 2)
            Image(systemName: "sparkles")
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
            // Score-badge
            Text("\(score)")
                .font(.appScaled(size: 8, weight: .bold))
                .foregroundStyle(Color(red: 0.66, green: 0.32, blue: 0.99))
                .padding(.horizontal, 4).padding(.vertical, 1)
                .background(Color.white, in: Capsule())
                .offset(x: 16, y: -16)
        }
        .frame(width: 80, height: 80)
        .onAppear { pulse = true }
    }
}

// MARK: - LayersSheet (map-style + overlay-toggles)

struct LayersSheet: View {
    @Binding var selectedStyle: KartView.MapStyleChoice
    @Binding var activeOverlays: Set<KartView.MapOverlay>
    var navActive: Bool = false
    var canNavigate: Bool = false
    var destinationName: String = ""
    /// Dørsalg-modus: lead-baserte lag (heatmap/AI-leads/reise-historikk/
    /// bedrifts-data) og lead-nav skjules — kartstil, territorier og
    /// team-på-kartet beholdes.
    var dorsalg: Bool = false
    var onStartNav: () -> Void = {}
    var onStopNav: () -> Void = {}
    @Environment(\.dismiss) private var dismiss

    private var tilgjengeligeLag: [KartView.MapOverlay] {
        dorsalg
            ? [.territories, .teamMembers]
            : KartView.MapOverlay.allCases
    }

    private enum LBrand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let textSecondary = Color.white.opacity(0.62)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if !dorsalg { navSection }
                    styleSection
                    overlaysSection
                    Color.clear.frame(height: 16)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Kartlag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // Fix 2026-07-02: «Lukk»-tekst kuttes til «L…» på Mac Catalyst
                // fordi cancellationAction får smal ramme. Bytter til sirkulær
                // X-ikon (samme mønster som andre sheets i appen).
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 28, height: 28)
                            .background(LBrand.cardHi, in: Circle())
                            .overlay(Circle().strokeBorder(LBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Lukk")
                }
                ToolbarItem(placement: .principal) {
                    Text("Kartlag")
                        .font(.appScaled(size: 15, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }
                ToolbarItem(placement: .primaryAction) {
                    if !activeOverlays.isEmpty {
                        Button { activeOverlays.removeAll() } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.counterclockwise")
                                    .font(.appScaled(size: 10, weight: .bold))
                                Text("Nullstill (\(activeOverlays.count))")
                                    .font(.appScaled(size: 11, weight: .bold))
                                    .fixedSize(horizontal: true, vertical: false)
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(LBrand.cardHi, in: Capsule())
                            .overlay(Capsule().strokeBorder(LBrand.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .macCatalystSheetSize(minWidth: 820, minHeight: 640)
    }

    private var navSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "location.north.line.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.purpleLight)
                Text("Navigasjon")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                if navActive {
                    Text("Aktiv")
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(LBrand.purpleLight)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(LBrand.purple.opacity(0.22), in: Capsule())
                }
            }
            Button { navActive ? onStopNav() : onStartNav() } label: {
                HStack(spacing: 11) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 9)
                            .fill(LBrand.purple.opacity(navActive ? 0.32 : 0.16))
                        Image(systemName: navActive ? "xmark" : "location.north.line.fill")
                            .font(.appScaled(size: 15, weight: .bold))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                    .frame(width: 40, height: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(navActive ? "Avslutt navigasjon" : "Start 3D-navigasjon")
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        Text(navActive
                             ? "Følger \(destinationName)"
                             : (canNavigate ? "Heading-up rute til \(destinationName)" : "Velg en lead på kartet først"))
                            .font(.appScaled(size: 11))
                            .foregroundStyle(LBrand.textSecondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(LBrand.textSecondary)
                }
                .padding(11)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12)
                    .stroke(navActive ? LBrand.purpleLight : LBrand.stroke, lineWidth: navActive ? 1.5 : 1))
            }
            .buttonStyle(.plain)
            .disabled(!canNavigate && !navActive)
            .opacity((!canNavigate && !navActive) ? 0.55 : 1)
        }
    }

    private var styleSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "map.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.purpleLight)
                Text("Kartstil")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 2, iPad: 2, mac: 4, spacing: 10), spacing: 10) {
                ForEach(KartView.MapStyleChoice.allCases, id: \.self) { style in
                    styleCard(style)
                }
            }
        }
    }

    private func styleCard(_ style: KartView.MapStyleChoice) -> some View {
        let isSelected = selectedStyle == style
        return Button { selectedStyle = style } label: {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(LinearGradient(
                            colors: [LBrand.purple.opacity(0.30), LBrand.purpleLight.opacity(0.10)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                    Image(systemName: style.icon)
                        .font(.appScaled(size: 22, weight: .semibold))
                        .foregroundStyle(LBrand.purpleLight)
                }
                .frame(height: 64)
                Text(style.rawValue)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .padding(8)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? LBrand.purpleLight : LBrand.stroke,
                            lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var overlaysSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "square.stack.3d.up.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.purpleLight)
                Text("Visuelle lag")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(activeOverlays.count) aktiv\(activeOverlays.count == 1 ? "" : "e")")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
            }
            VStack(spacing: 8) {
                ForEach(tilgjengeligeLag, id: \.self) { o in
                    overlayRow(o)
                }
            }
        }
    }

    private func overlayRow(_ o: KartView.MapOverlay) -> some View {
        let isOn = activeOverlays.contains(o)
        return Button {
            if isOn { activeOverlays.remove(o) } else { activeOverlays.insert(o) }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9)
                        .fill(o.color.opacity(isOn ? 0.30 : 0.15))
                    Image(systemName: o.icon)
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(o.color)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(o.rawValue)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(o.subtitle)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer()
                Toggle("", isOn: Binding(
                    get: { isOn },
                    set: { v in
                        if v { activeOverlays.insert(o) } else { activeOverlays.remove(o) }
                    }
                ))
                .labelsHidden()
                .tint(o.color)
            }
            .padding(10)
            .background(
                isOn ? o.color.opacity(0.10) : LBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isOn ? o.color.opacity(0.45) : LBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - iPhone-tilpasning (compact width)

private extension View {
    /// Fast kolonnebredde på iPad/Mac; full bredde på iPhone der
    /// to-kolonne-layoutene stables vertikalt i stedet.
    @ViewBuilder
    func kartColumnWidth(_ width: CGFloat) -> some View {
        if DeviceIdiom.isPhone {
            self.frame(maxWidth: .infinity, alignment: .leading)
        } else {
            self.frame(width: width)
        }
    }

    /// På iPhone lar vi popoveren adapteres til sheet (detents settes av
    /// `adaptivePopoverFrame`); på iPad/Mac beholdes popover-formen.
    @ViewBuilder
    func kartPopoverAdaptation() -> some View {
        if DeviceIdiom.isPhone {
            self
        } else {
            self.presentationCompactAdaptation(.popover)
        }
    }
}

// MARK: - Registrer salg (dørsalg, mig 0400)

/// Feltene fra registreringsskjemaet — eies av KartView-callbacken
/// (demo = lokalt, ekte = POST /dorsalg/sales).
struct RegistrertSalgData {
    let produktId: String?
    let bidragBelop: Double?
    let bidragLabel: String?
    let kundeNavn: String
    let kundeTelefon: String
    let kundeEpost: String?
    let ringBekreftet: Bool
    let samtykkeTekst: String
}

/// «Registrer salg» på døra — grandma-vennlig: store flater, chips i stedet
/// for tasting, ALDRI betalingsdata, og en rolig kvitteringsskjerm selgeren
/// snur mot kunden. Telefon kan ring-bekreftes på stedet; e-post er valgfri
/// (velkomst-e-post m/ bekreftelseslenke sendes når den finnes).
fileprivate struct RegistrerSalgSheet: View {
    let adresse: KartverketService.AdressePunkt
    let produkter: [KartverketService.DorsalgProduct]
    let onRegistrer: (RegistrertSalgData) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var valgtProdukt: KartverketService.DorsalgProduct?
    @State private var valgtBidrag: KartverketService.DorsalgProduct.Bidrag?
    @State private var navn = ""
    @State private var telefon = ""
    @State private var epost = ""
    @State private var ringBekreftet = false
    @State private var samtykkeOK = false
    @State private var visKvittering = false

    private static let epostDomener = ["@gmail.com", "@outlook.com", "@hotmail.com",
                                       "@icloud.com", "@online.no"]

    private var samtykkeTekst: String {
        let fallback = "Jeg ønsker å inngå avtalen og godtar å bli kontaktet for å sette opp betalingsavtalen direkte med organisasjonen. 14 dagers angrerett."
        guard let t = valgtProdukt?.samtykkeTekst, !t.isEmpty else { return fallback }
        return t
    }

    private var kanRegistrere: Bool {
        !navn.trimmingCharacters(in: .whitespaces).isEmpty && samtykkeOK
            && (produkter.isEmpty || valgtProdukt != nil)
    }

    var body: some View {
        NavigationStack {
            Group {
                if visKvittering {
                    kvittering
                } else {
                    skjema
                }
            }
            .background(KrBrand.bg.ignoresSafeArea())
            .navigationTitle(visKvittering ? "" : "Registrer salg")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !visKvittering {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Avbryt") { dismiss() }
                            .foregroundStyle(KrBrand.textSecondary)
                    }
                }
            }
            .toolbarBackground(KrBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.large])
        .interactiveDismissDisabled(visKvittering)
        .onAppear {
            if produkter.count == 1 { valgtProdukt = produkter.first }
        }
    }

    // MARK: Skjemaet

    private var skjema: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Adressen (kontekst)
                HStack(spacing: 9) {
                    Image(systemName: "house.fill").foregroundStyle(KrBrand.purpleLight)
                    Text("\(adresse.adressetekst), \(adresse.postnummer) \(adresse.poststed)")
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(KrBrand.textSecondary)
                }

                if !produkter.isEmpty {
                    felt("Organisasjon") {
                        chipRad(produkter, label: { $0.navn },
                                valgt: valgtProdukt?.id) { p in
                            valgtProdukt = p
                            valgtBidrag = nil
                        }
                    }
                }
                if let bidrag = valgtProdukt?.bidrag, !bidrag.isEmpty {
                    felt("Bidrag per måned") {
                        chipRad(bidrag,
                                label: { "\(Int($0.belop)) kr\($0.label.isEmpty ? "" : " · \($0.label)")" },
                                valgt: valgtBidrag?.id) { valgtBidrag = $0 }
                    }
                }

                felt("Kundens navn") {
                    tekstfelt($navn, prompt: "Fornavn Etternavn", keyboard: .default)
                }
                felt("Telefon") {
                    VStack(spacing: 8) {
                        tekstfelt($telefon, prompt: "+47 …", keyboard: .phonePad)
                        // Ring-bekreftelse: kundens telefon ringer i lomma
                        // der og da — besittelse bevist uten SMS-gateway.
                        Button {
                            let ren = telefon.filter { $0.isNumber || $0 == "+" }
                            if let url = URL(string: "tel://\(ren)"), !ren.isEmpty {
                                UIApplication.shared.open(url)
                                ringBekreftet = true
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: ringBekreftet
                                      ? "checkmark.circle.fill" : "phone.fill")
                                    .font(.appScaled(size: 13, weight: .bold))
                                Text(ringBekreftet ? "Nummeret ringte" : "Ring for å bekrefte nummeret")
                                    .font(.appScaled(size: 13, weight: .bold))
                            }
                            .foregroundStyle(ringBekreftet ? KrBrand.green : .white)
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(ringBekreftet
                                        ? AnyShapeStyle(KrBrand.green.opacity(0.18))
                                        : AnyShapeStyle(KrBrand.cardHi),
                                        in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11)
                                .stroke(ringBekreftet ? KrBrand.green.opacity(0.5) : KrBrand.stroke,
                                        lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .disabled(telefon.filter(\.isNumber).count < 8)
                    }
                }
                felt("E-post (valgfritt)") {
                    VStack(spacing: 8) {
                        tekstfelt($epost, prompt: "fornavn.etternavn", keyboard: .emailAddress)
                        // Domene-chips: kunden sier «gmail» — ett trykk.
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(Self.epostDomener, id: \.self) { d in
                                    Button {
                                        if let at = epost.firstIndex(of: "@") {
                                            epost = String(epost[..<at]) + d
                                        } else {
                                            epost += d
                                        }
                                    } label: {
                                        Text(d)
                                            .font(.appScaled(size: 12, weight: .semibold))
                                            .foregroundStyle(KrBrand.purpleLight)
                                            .padding(.horizontal, 10).padding(.vertical, 6)
                                            .background(KrBrand.cardHi, in: Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }

                // Samtykket kunden faktisk godtar — teksten versjoneres
                // per salg i backend (dokumentert spor).
                felt("Samtykke") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(samtykkeTekst)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(KrBrand.textSecondary)
                        Button {
                            samtykkeOK.toggle()
                        } label: {
                            HStack(spacing: 9) {
                                Image(systemName: samtykkeOK
                                      ? "checkmark.square.fill" : "square")
                                    .font(.appScaled(size: 18))
                                    .foregroundStyle(samtykkeOK ? KrBrand.green : KrBrand.textSecondary)
                                Text("Kunden har hørt og godtatt dette")
                                    .font(.appScaled(size: 13, weight: .bold))
                                    .foregroundStyle(.white)
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(12)
                    .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(KrBrand.stroke, lineWidth: 1))
                }

                Button {
                    onRegistrer(RegistrertSalgData(
                        produktId: valgtProdukt?.id,
                        bidragBelop: valgtBidrag?.belop,
                        bidragLabel: valgtBidrag?.label,
                        kundeNavn: navn.trimmingCharacters(in: .whitespaces),
                        kundeTelefon: telefon.trimmingCharacters(in: .whitespaces),
                        kundeEpost: epost.contains("@") ? epost.trimmingCharacters(in: .whitespaces) : nil,
                        ringBekreftet: ringBekreftet,
                        samtykkeTekst: samtykkeTekst))
                    withAnimation(.easeInOut(duration: 0.3)) { visKvittering = true }
                } label: {
                    Text("Registrer salg")
                        .font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 15)
                        .background(
                            LinearGradient(colors: [KrBrand.green, KrBrand.green.opacity(0.75)],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
                .disabled(!kanRegistrere)
                .opacity(kanRegistrere ? 1 : 0.45)
                Color.clear.frame(height: 16)
            }
            .padding(18)
        }
    }

    // MARK: Kvitteringen (grandma-skjermen — snus mot kunden)

    private var kvittering: some View {
        ScrollView {
            VStack(spacing: 20) {
                Spacer().frame(height: 16)
                ZStack {
                    Circle().fill(KrBrand.green.opacity(0.18)).frame(width: 96, height: 96)
                    Image(systemName: "checkmark")
                        .font(.system(size: 44, weight: .bold))
                        .foregroundStyle(KrBrand.green)
                }
                Text("Takk, \(navn.split(separator: " ").first.map(String.init) ?? navn)!")
                    .font(.appScaled(size: 26, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                if let p = valgtProdukt {
                    Text(valgtBidrag != nil
                         ? "Du støtter nå \(p.navn) med \(Int(valgtBidrag!.belop)) kr i måneden."
                         : "Du støtter nå \(p.navn).")
                        .font(.appScaled(size: 17, weight: .semibold))
                        .foregroundStyle(KrBrand.textSecondary)
                        .multilineTextAlignment(.center)
                }
                VStack(alignment: .leading, spacing: 13) {
                    kvitteringRad("banknote", "Ingen betaling er gjort på døra — og du oppgir aldri kontonummer til selgeren.")
                    kvitteringRad("phone.fill", "Du blir ringt for en hyggelig velkomstsamtale.")
                    if epost.contains("@") {
                        kvitteringRad("envelope.fill", "Du får en e-post — trykk på knappen der for å bekrefte.")
                    }
                    kvitteringRad("checkmark.shield.fill", "Du har 14 dagers angrerett — helt uten grunn.")
                    kvitteringRad("building.columns.fill", "Betalingsavtalen setter du opp direkte med organisasjonen.")
                }
                .padding(16)
                .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(KrBrand.green.opacity(0.3), lineWidth: 1))
                Button {
                    dismiss()
                } label: {
                    Text("Ferdig")
                        .font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 15)
                        .background(KrBrand.purple, in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
                .padding(.top, 6)
            }
            .padding(22)
        }
    }

    private func kvitteringRad(_ ikon: String, _ tekst: String) -> some View {
        HStack(alignment: .top, spacing: 11) {
            Image(systemName: ikon)
                .font(.appScaled(size: 15))
                .foregroundStyle(KrBrand.green)
                .frame(width: 24)
            Text(tekst)
                .font(.appScaled(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    // MARK: Små byggeklosser

    private func felt(_ label: String, @ViewBuilder innhold: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label.uppercased())
                .font(.appScaled(size: 9, weight: .bold))
                .foregroundStyle(KrBrand.textSecondary).kerning(0.5)
            innhold()
        }
    }

    private func tekstfelt(_ tekst: Binding<String>, prompt: String,
                           keyboard: UIKeyboardType) -> some View {
        TextField("", text: tekst,
                  prompt: Text(prompt).foregroundColor(KrBrand.textTertiary))
            .textFieldStyle(.plain)
            .foregroundStyle(.white)
            .font(.appScaled(size: 16))
            .keyboardType(keyboard)
            .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
            .autocorrectionDisabled()
            .padding(13)
            .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(KrBrand.stroke, lineWidth: 1))
    }

    private func chipRad<T: Identifiable>(_ elementer: [T],
                                          label: @escaping (T) -> String, valgt: String?,
                                          onTap: @escaping (T) -> Void) -> some View
        where T.ID == String {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(elementer) { e in
                    let aktiv = e.id == valgt
                    Button { onTap(e) } label: {
                        Text(label(e))
                            .font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(aktiv ? .white : KrBrand.textSecondary)
                            .padding(.horizontal, 15).padding(.vertical, 11)
                            .background(
                                aktiv ? AnyShapeStyle(KrBrand.purple)
                                      : AnyShapeStyle(KrBrand.card),
                                in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11)
                                .stroke(aktiv ? KrBrand.purpleLight.opacity(0.6) : KrBrand.stroke,
                                        lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
