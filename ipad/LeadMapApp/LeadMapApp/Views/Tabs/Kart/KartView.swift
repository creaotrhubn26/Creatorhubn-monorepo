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

    // Filter-state
    @State private var areaFilterOpen: Bool = false
    @State private var typeFilterOpen: Bool = false
    @State private var statusFilterOpen: Bool = false
    @State private var moreFiltersOpen: Bool = false

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
    @State private var navDismissedPOIAlerts: Set<UUID> = []
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
        case firstPerson = "POV", drive = "Kjøre", overview = "Oversikt", topDown = "2D", north = "Nord"
        var icon: String {
            switch self {
            case .firstPerson: "eye.fill"
            case .drive: "location.north.line.fill"
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
        #if DEBUG
        if cinematicHideCard { return false }
        #endif
        return DemoModeManager.isActiveNonisolated || hasSelectedLead
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
        .sheet(isPresented: $mapStyleSheetOpen) {
            LayersSheet(
                selectedStyle: $mapStyle,
                activeOverlays: $activeOverlays,
                navActive: navModeActive,
                canNavigate: !kartLeads.isEmpty,
                destinationName: selectedLead.name,
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
            AnyView(kartHeader)
                .padding(.horizontal, 20).padding(.top, 14)
            AnyView(searchAndFilters)
                .padding(.horizontal, 20).padding(.top, 12)
                .padding(.bottom, 12)

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
                            .frame(minHeight: DeviceIdiom.isPhone ? 360 : 520,
                                   maxHeight: DeviceIdiom.isPhone ? 460 : 680)
                        AnyView(legendCard)
                        if showDetailPanel {
                            AnyView(detailPanel)
                        } else {
                            AnyView(emptyDetailPanel)
                        }
                    }
                    .frame(maxWidth: .infinity)

                    // iPhone (2026-07-17): listen bor nå i halv-sheeten
                    // (liste-FAB på kartet) — ikke dupliser under kartet.
                    if !DeviceIdiom.isPhone {
                        VStack(spacing: 12) {
                            AnyView(leadsInAreaCard)
                            Spacer(minLength: 0)
                        }
                        .kartColumnWidth(300)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 16)
            }
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
                kartSearchField
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        kartFilterAndActionChips
                    }
                    .fixedSize(horizontal: true, vertical: false)
                    .padding(.horizontal, 20)
                }
                .padding(.horizontal, -20)
            }
        } else {
            HStack(spacing: 8) {
                kartSearchField
                kartFilterAndActionChips
            }
        }
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
            filterChip(label: areaButtonLabel, badge: nil, active: selectedArea != .all,
                       isOpen: $areaFilterOpen)
                .popover(isPresented: $areaFilterOpen, arrowEdge: .top) {
                    AreaFilterPopover(selected: $selectedArea, radiusKm: $selectedRadiusKm)
                        .presentationCompactAdaptation(.popover)
                }
            filterChip(label: typeButtonLabel, badge: selectedIndustries.count,
                       active: !selectedIndustries.isEmpty, isOpen: $typeFilterOpen)
                .popover(isPresented: $typeFilterOpen, arrowEdge: .top) {
                    TypeFilterPopover(selected: $selectedIndustries)
                        .presentationCompactAdaptation(.popover)
                }
            filterChip(label: statusButtonLabel, badge: selectedStatuses.count,
                       active: !selectedStatuses.isEmpty, isOpen: $statusFilterOpen)
                .popover(isPresented: $statusFilterOpen, arrowEdge: .top) {
                    StatusFilterPopover(selected: $selectedStatuses)
                        .presentationCompactAdaptation(.popover)
                }
            filterChip(label: "Flere filtre", badge: nil, active: false,
                       isOpen: $moreFiltersOpen, icon: "slider.horizontal.3")

            // Action-knappene flyttet hit fra header'en
            Button { routePlannerOpen = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: "map.fill")
                        .font(.appScaled(size: 11, weight: .semibold))
                    Text("Ruteplanlegger")
                        .font(.appScaled(size: 12, weight: .semibold))
                }
                .foregroundStyle(KrBrand.purpleLight)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
                .overlay(
                    RoundedRectangle(cornerRadius: 9)
                        .stroke(KrBrand.purple.opacity(0.55), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            Button { addLeadOpen = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: "plus")
                        .font(.appScaled(size: 11, weight: .bold))
                    Text("Legg til lead")
                        .font(.appScaled(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
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

    private var areaButtonLabel: String {
        selectedArea == .all ? "Alle områder" : selectedArea.rawValue
    }
    private var typeButtonLabel: String {
        selectedIndustries.isEmpty ? "Alle typer" : "\(selectedIndustries.count) bransje\(selectedIndustries.count == 1 ? "" : "r")"
    }
    private var statusButtonLabel: String {
        selectedStatuses.isEmpty ? "Lead status" : "\(selectedStatuses.count) status"
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
                    // I nav-modus snappes figuren til nærmeste punkt på ruta så den
                    // alltid ligger på veien (ikke gjennom bygg / GPS-drift).
                    let coord = navModeActive ? snapToRoute(rawCoord) : rawCoord
                    // I nav-modus: 3D gå-avatar (person på puck m/ retnings-stråle
                    // + skygge + gå-bob) som beveger seg. Ellers skjerm-fast MeMapPin.
                    Annotation("Meg", coordinate: coord) {
                        if navModeActive {
                            NavAvatarPuck(initials: appState.initials,
                                          email: appState.userEmail,
                                          vehicle: navVehicle,
                                          moving: KartLocationManager.shared.isMoving)
                        } else {
                            MeMapPin(initials: appState.initials, email: appState.userEmail)
                                .onTapGesture { zoomToMeAndOpenHUD(coord: coord) }
                        }
                    }
                }
                ForEach(KartPreviewData.clusters) { c in
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: c.lat, longitude: c.lon)) {
                        ClusterPin(count: c.count, color: c.color)
                    }
                }
                ForEach(kartLeads) { lead in
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
                mapFABButton(icon: "mappin.and.ellipse", action: dropPinAtCenter)
                    .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))

                // iPhone: «Leads i området» som halv-sheet — listen bor
                // ellers under kartet og krever scroll (2026-07-17).
                if DeviceIdiom.isPhone {
                    mapFABButton(icon: "list.bullet", action: { areaListOpen = true })
                        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
                }
            }
            .fixedSize()
            .padding(14)

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
            if navModeActive {
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
            if DeviceIdiom.isPhone && hasSelectedLead && !navModeActive && !measureMode {
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
            if !anyOn && !navProximityAlerts.isEmpty {
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

    /// Nærmeste POI per type (innen 6 km), kun når typen er SKJULT og ikke avvist.
    private var navProximityAlerts: [NavRoutePOI] {
        guard let me = navMeCoordinate, !navRoutePOIs.isEmpty else { return [] }
        let radiusM = 6_000.0
        var result: [NavRoutePOI] = []
        for kind in NavPOIKind.allCases where !navPOIActiveKinds.contains(kind) {
            let nearest = navRoutePOIs
                .filter { $0.kind == kind && !navDismissedPOIAlerts.contains($0.id) }
                .map { ($0, NavRoutePOIService.haversine(me, $0.coordinate)) }
                .filter { $0.1 <= radiusM }
                .min { $0.1 < $1.1 }
            if let n = nearest { result.append(n.0) }
        }
        return result
    }

    private func navProximityAlertRow(_ p: NavRoutePOI) -> some View {
        let km = (navMeCoordinate.map { NavRoutePOIService.haversine($0, p.coordinate) } ?? 0) / 1000
        let minsAway = max(1, Int(km / 0.55))
        return HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(p.brandColor)
                Image(systemName: p.kind.icon).font(.appScaled(size: 13, weight: .black)).foregroundStyle(.white)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(p.kind.rawValue) \(minsAway) min unna")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
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
                withAnimation { _ = navDismissedPOIAlerts.insert(p.id) }
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

    // MARK: Legend — FIX #2: separat card UNDER kartet

    @ViewBuilder
    private var legendCard: some View {
        // iPhone (QA-runde 2): seks legend-elementer delte 390pt → labels
        // ble vertikale bokstav-søyler. Horisontal scroller m/ naturlig
        // bredde på phone; iPad/Mac beholder full-bredde-fordelingen.
        if DeviceIdiom.isPhone {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    legendItems
                }
                .fixedSize(horizontal: true, vertical: false)
                .padding(.horizontal, 14).padding(.vertical, 10)
            }
            .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(KrBrand.stroke, lineWidth: 1))
        } else {
            HStack(spacing: 14) {
                legendItemsWithSpacers
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(KrBrand.stroke, lineWidth: 1))
        }
    }

    @ViewBuilder
    private var legendItems: some View {
        ForEach(MapLeadMock.PinStatus.allCases, id: \.self) { st in
            legendItem(st)
        }
    }

    @ViewBuilder
    private var legendItemsWithSpacers: some View {
        ForEach(MapLeadMock.PinStatus.allCases, id: \.self) { st in
            legendItem(st)
            if st != .followup { Spacer(minLength: 4) }
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
            }

            VStack(spacing: 8) {
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

    /// Snakk en instruksjon (norsk stemme). No-op når stemme er av.
    private func speak(_ text: String) {
        guard navVoiceOn else { return }
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
                withAnimation(.easeInOut(duration: 0.5)) { self.navRoute = coords }
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
        let step = navSteps[navStepIndex]
        let d = metersBetween(me, step.coord)
        // «Forbered» ~130 m før manøveren
        if !navSpokePrepare, d < 130, d > 40 {
            navSpokePrepare = true
            speak("Om \(Int(d / 10) * 10) meter, \(step.text)")
        }
        // Manøver-punktet nådd → snakk + gå til neste steg
        if d < 22 {
            speak(step.text)
            if navStepIndex < navSteps.count - 1 { navStepIndex += 1 }
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
        } else {
            let rawHeading = navRouteHeading(from: me, dest: destC)
            if let prev = navHeadingSmoothed {
                heading = prev + angleDelta(prev, rawHeading) * 0.30
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
        withAnimation(animated ? .easeInOut(duration: 0.9) : .linear(duration: 0.55)) {
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
        return bestD < 60 ? best : me
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
        let destC = CLLocationCoordinate2D(latitude: dest.lat, longitude: dest.lon)
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
            // gjenstående lengde langs ruta
            let snapped = snapToRoute(me)
            var remaining = 0.0
            let nextI = min(navProgressIndex + 1, route.count - 1)
            remaining += metersBetween(snapped, route[nextI])
            var i = nextI
            while i < route.count - 1 { remaining += metersBetween(route[i], route[i + 1]); i += 1 }
            let secs = remaining / max(0.5, navTransport.fallbackSpeed)
            navDistanceText = remaining < 1000 ? "\(Int(remaining)) m" : String(format: "%.1f km", remaining / 1000)
            navETAMinutes = max(1, Int(secs / 60))
            navETAText = "\(navETAMinutes) min"
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
        updateNavCamera(animated: false)
        // Reroute-hysterese: bare re-rut når du er tydelig AV-rute (>50 m) i to
        // påfølgende tikk — ellers holder vi ruta + manøvrene stabile.
        if onRouteDist > 50 {
            navOffRouteCount += 1
            if navOffRouteCount >= 2 {
                navOffRouteCount = 0
                navRerouteAnchor = me
                recomputeNavRoute(from: me, to: destC)
            }
        } else {
            navOffRouteCount = 0
        }
        // Turn-by-turn: annonser manøvrer + oppdag ankomst.
        navTurnTick(me)
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

    // MARK: Empty detail panel (demo AV / ingen leads)

    /// Vises i stedet for `detailPanel` når `KartPreviewData.leads.isEmpty`.
    /// Beholder samme kort-visning som resten av layout så bunn-plassen
    /// ikke kollapser og skifter kart-høyden.
    private var emptyDetailPanel: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(KrBrand.cardHi)
                Image(systemName: "building.2")
                    .font(.appScaled(size: 22, weight: .regular))
                    .foregroundStyle(KrBrand.textTertiary)
            }
            .frame(width: 56, height: 56)

            VStack(alignment: .leading, spacing: 4) {
                Text("Ingen lead valgt")
                    .font(.appScaled(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Tap på en pin, bruk «+ Legg til lead», eller skru på demo-modus for å se eksempeldata.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(KrBrand.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
            Button {
                // 2026-07-17: var toast-only — åpner nå faktisk sheeten.
                addLeadOpen = true
            } label: {
                Text("+ Legg til lead")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(KrBrand.purple, in: Capsule())
            }
            .buttonStyle(.plain)
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
            // kjøretøy-puck (bil/buss/sparkesykkel) m/ profil-hode.
            if vehicle == .walk {
                WalkingAvatar(portraitAsset: portraitAsset, initials: initials)
            } else {
                WheeledVehicleAvatar(kind: vehicle, portraitAsset: portraitAsset, initials: initials)
            }
        }
        .frame(width: 92, height: 110)
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
    var onStartNav: () -> Void = {}
    var onStopNav: () -> Void = {}
    @Environment(\.dismiss) private var dismiss

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
                    navSection
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
                ForEach(KartView.MapOverlay.allCases, id: \.self) { o in
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
