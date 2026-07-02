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
    static let textSecondary = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.35)
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
    let id = UUID()
    let name: String
    let address: String
    let kmAway: Double
    let status: PinStatus
    let lastActivity: String?
    let lat: Double
    let lon: Double

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
    static let aiLeads: [AILeadSuggestion] = [
        AILeadSuggestion(name: "Tech Norge AS", lat: 59.913, lon: 10.745,
                         reason: "Lignende kunde vant for 14 dager siden", score: 88),
        AILeadSuggestion(name: "Helsenor AS", lat: 59.921, lon: 10.770,
                         reason: "Ny bygg-tillatelse + finansiering klar", score: 76),
        AILeadSuggestion(name: "Bygg & Co", lat: 59.916, lon: 10.785,
                         reason: "Konkurrent har gått fra dem", score: 92),
    ]

    // Mockede besøk i dag (sorterte etter tid)
    static let travelHistory: [CLLocationCoordinate2D] = [
        CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522),  // start: Storgata
        CLLocationCoordinate2D(latitude: 59.9252, longitude: 10.7641),  // Sofienberg
        CLLocationCoordinate2D(latitude: 59.9123, longitude: 10.7741),  // Tøyen
        CLLocationCoordinate2D(latitude: 59.9094, longitude: 10.7560),  // Bjørvika
    ]

    static let territories: [TerritoryPolygon] = [
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
        return MapLeadMock(
            name: lm.name,
            address: addr,
            kmAway: 0,  // TODO: beregn fra user-location i egen pass
            status: pin,
            lastActivity: last,
            lat: lm.latitude,
            lon: lm.longitude
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

    static let activities: [ActivityItemMock] = [
        ActivityItemMock(icon: "calendar",          label: "Møte",           timestamp: "i dag 10:00"),
        ActivityItemMock(icon: "envelope.open",     label: "E-post åpnet",   timestamp: "i går 14:22"),
        ActivityItemMock(icon: "doc.text",          label: "Tilbud sendt",   timestamp: "20. mai 09:15"),
        ActivityItemMock(icon: "phone",             label: "Telefon",        timestamp: "19. mai 11:30"),
        ActivityItemMock(icon: "person.badge.plus", label: "Lead opprettet", timestamp: "18. mai 16:45"),
    ]

    static let notes: [NoteItemMock] = [
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

    static let files: [FileItemMock] = [
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
    @State private var showArchiveConfirm: Bool = false
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

    // Header-popovers (samme stil som Oversikt)
    @State private var datePickerOpen: Bool = false
    @State private var areaPickerOpen: Bool = false  // forskjellig fra filter-bar
    @State private var analyseOpen: Bool = false
    @State private var nextActionsOpen: Bool = false
    @State private var notificationsOpen: Bool = false
    @State private var profileOpen: Bool = false
    // Løftet Leadbook-avatar-menu til alle faner (SharedProfileAvatar).
    @State private var showMinProfil: Bool = false
    @State private var showEcosystem: Bool = false
    @State private var showTeamAccess: Bool = false
    @State private var showSuperAdmin: Bool = false

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
        var icon: String {
            switch self {
            case .heatmap:        return "flame.circle.fill"
            case .aiLeads:        return "sparkles"
            case .travelHistory:  return "road.lanes"
            case .territories:    return "rectangle.3.group.fill"
            case .dataOverlay:    return "chart.pie.fill"
            }
        }
        var subtitle: String {
            switch self {
            case .heatmap:       return "Tetthet av leads visualisert som varmekart"
            case .aiLeads:       return "Pulse-pins for leads AI anbefaler å besøke i dag"
            case .travelHistory: return "Rød rute m/ dagens besøkte leads"
            case .territories:   return "Polygon-soner: din vs kollegas region"
            case .dataOverlay:   return "Pin-radius reflekterer omsetning (Brønnøysund)"
            }
        }
        var color: Color {
            switch self {
            case .heatmap:       return Color(red: 0.95, green: 0.20, blue: 0.20)
            case .aiLeads:       return Color(red: 0.75, green: 0.45, blue: 1.0)
            case .travelHistory: return Color(red: 0.98, green: 0.55, blue: 0.10)
            case .territories:   return Color(red: 0.20, green: 0.85, blue: 0.60)
            case .dataOverlay:   return Color(red: 0.34, green: 0.60, blue: 0.98)
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
        .task {
            // Auto-zoom på valgt lead ved app-start så pin er sentrert.
            // Daniel-feedback 2026-06-29: tap på lead-rad → zoom inn.
            selectAndZoom(selectedLead)
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
        .sheet(isPresented: $addLeadOpen) {
            AddLeadSheet { newLead in
                addLeadOpen = false
                // I prod ville vi sende dette til APIClient.createLead
            }
        }
        .sheet(isPresented: $openLeadFullSheet) {
            LeadDetailFullSheet(lead: selectedLead)
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
            LeadStatusChangeSheet(
                companyName: selectedLead.name,
                companyColor: selectedLead.status.color
            ) { newStatus, note in
                showToast("Status endret til \(newStatus.label)")
            }
        }
        .sheet(isPresented: $showAssignSeller) {
            LeadAssignSellerSheet(
                companyName: selectedLead.name,
                companyColor: selectedLead.status.color,
                currentSellerName: "Lars Kristensen"
            ) { newSeller in
                showToast("Tildelt \(newSeller.name)")
            }
        }
        .sheet(isPresented: $showNoteEditor) {
            LeadNoteSheet(
                companyName: selectedLead.name,
                companyColor: selectedLead.status.color
            ) { note, category, pinned in
                showToast("Notat lagret\(pinned ? " (festet)" : "")")
            }
        }
        .confirmationDialog(
            "Arkivere \(selectedLead.name)?",
            isPresented: $showArchiveConfirm,
            titleVisibility: .visible
        ) {
            Button("Arkiver", role: .destructive) {
                showToast("\(selectedLead.name) arkivert")
            }
            Button("Avbryt", role: .cancel) { }
        } message: {
            Text("Lead-en flyttes til arkiv. Du kan hente den tilbake fra Filter → Vis arkiverte.")
        }
        .sheet(isPresented: $mapStyleSheetOpen) {
            LayersSheet(selectedStyle: $mapStyle, activeOverlays: $activeOverlays)
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
                        .font(.system(size: 40))
                        .foregroundStyle(.green)
                    Text("Lead opprettet")
                        .font(.headline)
                    Text(dto.name)
                        .font(.subheadline)
                    if let addr = dto.address {
                        Text(addr)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text(String(format: "%.4f, %.4f", dto.latitude, dto.longitude))
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
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
        VStack(spacing: 0) {
            unifiedHeader
                .padding(.horizontal, 20).padding(.top, 14)
            searchAndFilters
                .padding(.horizontal, 20).padding(.top, 12)
                .padding(.bottom, 12)

            ScrollView {
                HStack(alignment: .top, spacing: 14) {
                    VStack(spacing: 12) {
                        mapCard
                            .frame(minHeight: 380, maxHeight: 460)
                        legendCard
                        if KartPreviewData.leads.isEmpty {
                            emptyDetailPanel
                        } else {
                            detailPanel
                        }
                    }
                    .frame(maxWidth: .infinity)

                    VStack(spacing: 12) {
                        leadsInAreaCard
                        Spacer(minLength: 0)
                    }
                    .frame(width: 300)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 16)
            }
        }
    }

    // MARK: Unified header — matcher OversiktView sin TopBar

    private var unifiedHeader: some View {
        GeometryReader { geo in
            let isNarrow = geo.size.width < 1100
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Kart")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.white)
                    if !isNarrow {
                        Text("Se dine leads, kunder og aktiviteter på kartet.")
                            .font(.system(size: 13))
                            .foregroundStyle(KrBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                HStack(spacing: 8) {
                    topPicker(icon: "calendar",
                              text: isNarrow ? "Tir 14" : "Tir. 14. mai",
                              isOpen: $datePickerOpen)
                        .popover(isPresented: $datePickerOpen, arrowEdge: .top) {
                            datePickerPopover.presentationCompactAdaptation(.popover)
                        }
                    if !isNarrow {
                        topPicker(icon: "location.fill",
                                  text: "Alle områder",
                                  isOpen: $areaPickerOpen)
                            .popover(isPresented: $areaPickerOpen, arrowEdge: .top) {
                                AreaFilterPopover(selected: $selectedArea, radiusKm: $selectedRadiusKm)
                                    .presentationCompactAdaptation(.popover)
                            }
                    }
                    // Pakke 10.1 (Daniel-feedback 2026-07-01): bytt fra
                    // simplePopover til Oversikt-fanens rike popovere for
                    // konsistent look på tvers av faner.
                    topIconButton(icon: "chart.line.uptrend.xyaxis",
                                  badge: nil, isOpen: $analyseOpen)
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
                            RecentActivitiesPopover(
                                leads: appState.leads,
                                upcomingFollowups: 0,
                                momentum: nil
                            )
                            .frame(width: 380, height: 520)
                            .presentationCompactAdaptation(.popover)
                        }
                    profileAvatar(isNarrow: isNarrow)
                        .popover(isPresented: $profileOpen, arrowEdge: .top) {
                            ProfilePopover(
                                name: "Lars Kristensen",
                                email: appState.userEmail,
                                onOpenMyProfile: { profileOpen = false }
                            )
                            .frame(width: 320, height: 480)
                            .presentationCompactAdaptation(.popover)
                        }
                }
            }
        }
        .frame(height: 64)
    }

    /// Forenklet popover-stub — ekte popovers ligger i prod (OversiktView).
    private func simplePopover(title: String, subtitle: String, rows: [String]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(KrBrand.textSecondary)
            }
            .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 8)
            Divider().overlay(KrBrand.stroke)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: 8) {
                        Circle().fill(KrBrand.purpleLight).frame(width: 4, height: 4)
                        Text(row)
                            .font(.system(size: 12))
                            .foregroundStyle(.white)
                        Spacer()
                    }
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(KrBrand.card)
                }
            }
        }
        .frame(width: 280)
        .background(KrBrand.card)
        .preferredColorScheme(.dark)
    }

    private func topPicker(icon: String, text: String, isOpen: Binding<Bool>) -> some View {
        Button { isOpen.wrappedValue.toggle() } label: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(KrBrand.purpleLight)
                Text(text)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(KrBrand.textTertiary)
            }
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(KrBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private var datePickerPopover: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Velg periode")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            VStack(spacing: 6) {
                ForEach(["I dag", "Denne uken", "Denne måneden", "Q2 2026", "I år", "Egendefinert"], id: \.self) { p in
                    Button { datePickerOpen = false; showToast("Periode satt: \(p)") } label: {
                        HStack {
                            Text(p)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            Spacer()
                            if p == "I dag" {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(KrBrand.purpleLight)
                            }
                        }
                        .padding(.horizontal, 10).padding(.vertical, 8)
                        .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(16)
        .frame(width: 260)
        .background(KrBrand.card)
        .preferredColorScheme(.dark)
    }

    private func topIconButton(icon: String, badge: Int?, isOpen: Binding<Bool>) -> some View {
        Button { isOpen.wrappedValue.toggle() } label: {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11).fill(KrBrand.card)
                    RoundedRectangle(cornerRadius: 11).stroke(KrBrand.stroke, lineWidth: 1)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(KrBrand.purpleLight)
                }
                .frame(width: 42, height: 42)
                if let b = badge, b > 0 {
                    Text("\(min(b, 99))")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(KrBrand.purple, in: Capsule())
                        .overlay(Capsule().stroke(KrBrand.bg, lineWidth: 1.5))
                        .offset(x: 6, y: -6)
                }
            }
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    private func profileAvatar(isNarrow: Bool) -> some View {
        SharedProfileAvatar(
            tint: KrBrand.purpleLight,
            background: KrBrand.card,
            borderColor: KrBrand.stroke,
            secondaryText: KrBrand.textSecondary,
            tertiaryText: KrBrand.textTertiary,
            isCompact: isNarrow,
            showMinProfil: $showMinProfil,
            showEcosystem: $showEcosystem,
            showTeamAccess: $showTeamAccess,
            showSuperAdmin: $showSuperAdmin
        )
    }

    // Ubrukt legacy — bytter over til SharedProfileAvatar. Behold for
    // referanse inntil deprecation-pass er ferdig.
    private func legacyProfileAvatar(isNarrow: Bool) -> some View {
        Button { profileOpen.toggle() } label: {
            HStack(spacing: 8) {
                ZStack {
                    Circle().fill(KrBrand.purple.opacity(0.3))
                    Text(appState.initials)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(KrBrand.purpleLight)
                }
                .frame(width: 34, height: 34)
                if !isNarrow {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(appState.displayName)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        Text("Salgssjef")
                            .font(.system(size: 10))
                            .foregroundStyle(KrBrand.textSecondary)
                    }
                    Image(systemName: "chevron.down")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(KrBrand.textTertiary)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(KrBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Søk + filtre

    private var searchAndFilters: some View {
        HStack(spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundStyle(KrBrand.textSecondary)
                TextField("", text: $search, prompt: Text("Søk etter sted, lead eller selskap…")
                    .foregroundColor(KrBrand.textTertiary))
                    .textFieldStyle(.plain)
                    .foregroundStyle(.white)
                    .font(.system(size: 12))
                    .focused($searchFieldFocused)
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
            .frame(maxWidth: .infinity)

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
                        .font(.system(size: 11, weight: .semibold))
                    Text("Ruteplanlegger")
                        .font(.system(size: 12, weight: .semibold))
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
                        .font(.system(size: 11, weight: .bold))
                    Text("Legg til lead")
                        .font(.system(size: 12, weight: .semibold))
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
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(active ? KrBrand.purpleLight : KrBrand.textSecondary)
                }
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                if let b = badge, b > 0 {
                    Text("\(b)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(KrBrand.purple, in: Capsule())
                }
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
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
                if let coord = KartLocationManager.shared.currentCoordinate {
                    // Skjerm-fast MeMapPin — beholder samme visuell størrelse
                    // uansett zoom-nivå. Tap zoomer inn + åpner inline HUD.
                    Annotation("Meg", coordinate: coord) {
                        MeMapPin(initials: appState.initials, email: appState.userEmail)
                            .onTapGesture {
                                zoomToMeAndOpenHUD(coord: coord)
                            }
                    }
                }
                ForEach(KartPreviewData.clusters) { c in
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: c.lat, longitude: c.lon)) {
                        ClusterPin(count: c.count, color: c.color)
                    }
                }
                ForEach(KartPreviewData.leads) { lead in
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

                // OVERLAY: Heatmap — varme sirkler rundt lead-konsentrasjon
                if activeOverlays.contains(.heatmap) {
                    ForEach(KartPreviewData.clusters) { c in
                        MapCircle(center: CLLocationCoordinate2D(latitude: c.lat, longitude: c.lon),
                                  radius: Double(c.count) * 80)
                            .foregroundStyle(.radialGradient(
                                colors: [Color.red.opacity(0.55), Color.orange.opacity(0.3), Color.yellow.opacity(0)],
                                center: .center, startRadius: 0, endRadius: Double(c.count) * 80
                            ))
                            .stroke(Color.red.opacity(0.4), lineWidth: 1)
                    }
                }

                // OVERLAY: Territorier — fargede polygoner
                if activeOverlays.contains(.territories) {
                    ForEach(OverlayData.territories) { t in
                        MapPolygon(coordinates: t.coordinates)
                            .foregroundStyle(t.color.opacity(0.15))
                            .stroke(t.color.opacity(0.6), lineWidth: 2)
                    }
                }

                // OVERLAY: Reise-historikk — rød rute m/ tall-merker
                if activeOverlays.contains(.travelHistory) {
                    MapPolyline(coordinates: OverlayData.travelHistory)
                        .stroke(KrBrand.orange,
                                style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    ForEach(Array(OverlayData.travelHistory.enumerated()), id: \.offset) { (idx, coord) in
                        Annotation("", coordinate: coord) {
                            ZStack {
                                Circle().fill(KrBrand.orange)
                                    .overlay(Circle().stroke(Color.white, lineWidth: 2))
                                    .frame(width: 22, height: 22)
                                Text("\(idx + 1)")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                        }
                    }
                }

                // OVERLAY: AI-foreslåtte leads — pulse-pins
                if activeOverlays.contains(.aiLeads) {
                    ForEach(OverlayData.aiLeads) { s in
                        Annotation("", coordinate: CLLocationCoordinate2D(latitude: s.lat, longitude: s.lon)) {
                            AISuggestionPin(score: s.score)
                        }
                    }
                }
            }
            .mapStyle(mapStyle.mapKitStyle)
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
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(KrBrand.stroke, lineWidth: 1)
        )
    }

    private func mapFAB(icon: String) -> some View {
        Image(systemName: icon)
            .font(.system(size: 13, weight: .semibold))
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
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(KrBrand.green)
            Text(msg)
                .font(.system(size: 13, weight: .semibold))
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
                        .font(.system(size: 11, weight: .bold))
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
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(KrBrand.green)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text("Mål-verktøy")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                if let a = measurePointA, let b = measurePointB {
                    let km = distanceKm(a, b)
                    let drive = Int(km * 2)
                    Text(String(format: "%.2f km · %d min kjøring", km, drive))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(KrBrand.green)
                } else if measurePointA != nil {
                    Text("Tap pin B")
                        .font(.system(size: 11))
                        .foregroundStyle(KrBrand.textSecondary)
                } else {
                    Text("Tap pin A")
                        .font(.system(size: 11))
                        .foregroundStyle(KrBrand.textSecondary)
                }
            }
            Spacer(minLength: 4)
            Button {
                measurePointA = nil
                measurePointB = nil
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(KrBrand.textTertiary)
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(KrBrand.green.opacity(0.4), lineWidth: 1))
        .frame(maxWidth: 240)
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

    private var legendCard: some View {
        HStack(spacing: 14) {
            ForEach(MapLeadMock.PinStatus.allCases, id: \.self) { st in
                HStack(spacing: 6) {
                    ZStack {
                        Circle().fill(st.color.opacity(0.22))
                        Image(systemName: st.icon)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(st.color)
                    }
                    .frame(width: 22, height: 22)
                    Text(st.label)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                }
                if st != .followup { Spacer(minLength: 4) }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .background(KrBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(KrBrand.stroke, lineWidth: 1))
    }

    // MARK: Leads i området-card

    private var leadsInAreaCard: some View {
        // Skiller «tom pga demo AV / ingen data» fra «tom pga aktivt filter».
        let hasAnyLeads = !KartPreviewData.leads.isEmpty
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Leads i området")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                if hasAnyLeads {
                    Text("(\(KartPreviewData.leads.count))")
                        .font(.system(size: 12))
                        .foregroundStyle(KrBrand.textSecondary)
                }
                Spacer()
                HStack(spacing: 3) {
                    Text("Nær meg")
                        .font(.system(size: 11, weight: .semibold))
                    Image(systemName: "chevron.down")
                        .font(.system(size: 9, weight: .semibold))
                }
                .foregroundStyle(KrBrand.textSecondary)
            }

            VStack(spacing: 8) {
                if filteredLeads.isEmpty {
                    VStack(spacing: 6) {
                        Image(systemName: hasAnyLeads ? "magnifyingglass" : "mappin.slash")
                            .font(.system(size: 18))
                            .foregroundStyle(KrBrand.textTertiary)
                        Text(hasAnyLeads ? "Ingen treff" : "Ingen leads enda")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(KrBrand.textSecondary)
                        Text(hasAnyLeads
                             ? "Prøv å justere søk eller filtre"
                             : "Bruk «+ Legg til lead» eller skru på demo-modus")
                            .font(.system(size: 10))
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

            Button { showToast("Åpner full leads-liste") } label: {
                HStack(spacing: 5) {
                    Text("Se alle leads i området")
                        .font(.system(size: 12, weight: .semibold))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 10, weight: .semibold))
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
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(lead.status.color)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(lead.name)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        statusBadge(lead.status)
                    }
                    Text(lead.address)
                        .font(.system(size: 10))
                        .foregroundStyle(KrBrand.textSecondary)
                        .lineLimit(1)
                    HStack {
                        if let act = lead.lastActivity {
                            Text("Sist aktivitet: \(act)")
                                .font(.system(size: 9))
                                .foregroundStyle(KrBrand.textTertiary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text(String(format: "%.1f km", lead.kmAway))
                            .font(.system(size: 10, weight: .semibold))
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
            .font(.system(size: 8, weight: .bold))
            .foregroundStyle(st.color)
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(st.color.opacity(0.18), in: Capsule())
    }

    /// Filtrerte leads basert på søk + status + bransje. Sidebar +
    /// kart-pins respekterer disse.
    private var filteredLeads: [MapLeadMock] {
        KartPreviewData.leads.filter { lead in
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
        withAnimation(.easeInOut(duration: 0.55)) {
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: lead.lat, longitude: lead.lon),
                span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.018)
            ))
        }
    }

    // MARK: Aktivitetshistorikk-card

    private var activitiesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Aktivitetshistorikk")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button {} label: {
                    Text("Se alle")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(KrBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }
            VStack(spacing: 6) {
                ForEach(KartPreviewData.activities) { a in
                    HStack(spacing: 9) {
                        ZStack {
                            Circle().fill(KrBrand.purple.opacity(0.18))
                            Image(systemName: a.icon)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(KrBrand.purpleLight)
                        }
                        .frame(width: 26, height: 26)
                        Text(a.label)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        Spacer()
                        Text(a.timestamp)
                            .font(.system(size: 10))
                            .foregroundStyle(KrBrand.textSecondary)
                            .lineLimit(1)
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
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(KrBrand.textTertiary)
            }
            .frame(width: 56, height: 56)

            VStack(alignment: .leading, spacing: 4) {
                Text("Ingen lead valgt")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Tap på en pin, bruk «+ Legg til lead», eller skru på demo-modus for å se eksempeldata.")
                    .font(.system(size: 12))
                    .foregroundStyle(KrBrand.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
            Button {
                showToast("Åpner «Legg til lead»")
            } label: {
                Text("+ Legg til lead")
                    .font(.system(size: 12, weight: .semibold))
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
        HStack(alignment: .top, spacing: 0) {
            // Venstre kolonne (fast bredde): lead-info + actions
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 11) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 9)
                            .fill(selectedLead.status.color.opacity(0.18))
                        Image(systemName: "building.2.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(selectedLead.status.color)
                    }
                    .frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(selectedLead.name)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            statusBadge(selectedLead.status)
                            Button {
                                favorited.toggle()
                                showToast(favorited ? "Lagt til i favoritter" : "Fjernet fra favoritter")
                            } label: {
                                Image(systemName: favorited ? "star.fill" : "star")
                                    .font(.system(size: 12))
                                    .foregroundStyle(favorited ? KrBrand.yellow : KrBrand.textTertiary)
                            }
                            .buttonStyle(.plain)
                        }
                        Text(selectedLead.address)
                            .font(.system(size: 11))
                            .foregroundStyle(KrBrand.textSecondary)
                            .lineLimit(1)
                        Button { navigateOpen = true } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "location.north.line.fill")
                                    .font(.system(size: 9, weight: .semibold))
                                Text(String(format: "%.1f km unna · Naviger", selectedLead.kmAway))
                                    .font(.system(size: 10, weight: .semibold))
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
                            .font(.system(size: 12, weight: .bold))
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
                                .font(.system(size: 10, weight: .semibold))
                            Text("Planlegg møte")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 9)
                        .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    Button { navigateOpen = true } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "location.north.line.fill")
                                .font(.system(size: 10, weight: .semibold))
                            Text("Naviger")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 9)
                        .background(KrBrand.green.opacity(0.18), in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.green.opacity(0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    Menu {
                        Button { navigateTo(selectedLead) } label: {
                            Label("Naviger i Apple Maps", systemImage: "map.fill")
                        }
                        Button { makeCall("+47 911 22 333") } label: {
                            Label("Ring kontakt", systemImage: "phone.fill")
                        }
                        Button { sendEmail("post@nordicelektro.no", subject: "Oppfølging — \(selectedLead.name)") } label: {
                            Label("Send e-post", systemImage: "envelope.fill")
                        }
                        Divider()
                        Button { showStatusChange = true } label: {
                            Label("Endre status", systemImage: "tag.fill")
                        }
                        Button { showAssignSeller = true } label: {
                            Label("Tildel selger", systemImage: "person.crop.circle.fill")
                        }
                        Divider()
                        Button(role: .destructive) { showArchiveConfirm = true } label: {
                            Label("Arkiver lead", systemImage: "archivebox")
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 32, height: 32)
                            .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
                    }
                }

                // Metadata-grid 2x2 (mer kompakt) — 4-kolonne på Mac
                LazyVGrid(columns: MacCatalystGrid.adaptive(iPad: 2, mac: 4, spacing: 12),
                          alignment: .leading, spacing: 8) {
                    metaItem(label: "Bransje",  value: "Elektro")
                    metaItem(label: "Ansatt",   value: "25-50")
                    metaItem(label: "Omsetning", value: "10-20 mill.")
                    metaItem(label: "Sist aktivitet", value: selectedLead.lastActivity ?? "—")
                }
            }
            .frame(width: 310)

            // Vertikal divider
            Rectangle().fill(KrBrand.stroke)
                .frame(width: 1)
                .padding(.horizontal, 14)

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
                .font(.system(size: 10))
                .foregroundStyle(KrBrand.textSecondary)
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
    }

    private func tabButton(_ tab: DetailTab) -> some View {
        let isSelected = tab == selectedTab
        return Button { selectedTab = tab } label: {
            VStack(spacing: 4) {
                Text(tab.rawValue)
                    .font(.system(size: 12, weight: isSelected ? .bold : .semibold))
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
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(KrBrand.textTertiary)

            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(KrBrand.purple.opacity(0.25))
                    Text("AJ")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(KrBrand.purpleLight)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Anders Johansen")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Daglig leder")
                        .font(.system(size: 10))
                        .foregroundStyle(KrBrand.textSecondary)
                }
                Spacer()
                HStack(spacing: 6) {
                    actionIcon("phone") { makeCall("+47 911 22 333") }
                    actionIcon("envelope") { sendEmail("anders@nordicelektro.no") }
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("NOTAT")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(KrBrand.textTertiary)
                Text("Interessert i nytt el-anlegg til kontorbygg. Følge opp prisforslag og referanseprosjekter.")
                    .font(.system(size: 11))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button { openLeadFullSheet = true } label: {
                HStack(spacing: 4) {
                    Text("Se mer informasjon")
                        .font(.system(size: 11, weight: .semibold))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 9, weight: .semibold))
                }
                .foregroundStyle(KrBrand.purpleLight)
            }
            .buttonStyle(.plain)
        }
    }

    private var tabAktiviteter: some View {
        VStack(spacing: 6) {
            ForEach(KartPreviewData.activities) { a in
                HStack(spacing: 9) {
                    ZStack {
                        Circle().fill(KrBrand.purple.opacity(0.18))
                        Image(systemName: a.icon)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(KrBrand.purpleLight)
                    }
                    .frame(width: 26, height: 26)
                    Text(a.label)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Text(a.timestamp)
                        .font(.system(size: 10))
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
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(KrBrand.purpleLight)
                    }
                    .frame(width: 28, height: 28)
                    HStack(spacing: 8) {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 11))
                            .foregroundStyle(KrBrand.textTertiary)
                        Text("Skriv et notat…")
                            .font(.system(size: 11))
                            .foregroundStyle(KrBrand.textTertiary)
                        Spacer()
                    }
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(KrBrand.stroke, lineWidth: 1))
                }
            }
            .buttonStyle(.plain)

            ForEach(KartPreviewData.notes) { n in
                noteRow(n)
            }
        }
    }

    private func noteRow(_ n: NoteItemMock) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 7) {
                ZStack {
                    Circle().fill(n.authorColor.opacity(0.25))
                    Text(n.authorInitials)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(n.authorColor)
                }
                .frame(width: 22, height: 22)
                Text(n.author)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                if n.pinned {
                    Image(systemName: "pin.fill")
                        .font(.system(size: 8))
                        .foregroundStyle(KrBrand.yellow)
                }
                Spacer()
                Text(n.timestamp)
                    .font(.system(size: 9))
                    .foregroundStyle(KrBrand.textTertiary)
            }
            Text(n.body)
                .font(.system(size: 11))
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
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(KrBrand.textSecondary)
                Spacer()
                // Pakke 10.1 (Daniel-feedback 2026-07-01): gjenbruk Leads-
                // fanens rike UploadFileSheet (Fra iPad / Fra skyen / Skann
                // dokument / Ta bilde) i stedet for lokal toast-stub.
                Button { showUploadFile = true } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text("Last opp")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(KrBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }

            ForEach(KartPreviewData.files) { f in
                fileRow(f)
            }
        }
    }

    private func fileRow(_ f: FileItemMock) -> some View {
        // Pakke 10.1: simulert nedlasting med progress-toast. I prod byttes
        // dette til URLSession-download-task med .progress-observation.
        Button {
            showToast("↓ Laster ned \(f.name)…")
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
                showToast("✓ \(f.name) lastet ned")
            }
        } label: {
            HStack(spacing: 9) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(f.kind.color.opacity(0.22))
                    Image(systemName: f.kind.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(f.kind.color)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(f.name)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        Text(f.size)
                            .font(.system(size: 9))
                            .foregroundStyle(KrBrand.textSecondary)
                        Text("·")
                            .font(.system(size: 9))
                            .foregroundStyle(KrBrand.textTertiary)
                        Text(f.uploadedAt)
                            .font(.system(size: 9))
                            .foregroundStyle(KrBrand.textTertiary)
                    }
                }
                Spacer()
                Image(systemName: "arrow.down.circle")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(KrBrand.purpleLight)
            }
            .padding(9)
            .background(KrBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(KrBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func actionIcon(_ name: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle().fill(KrBrand.purple.opacity(0.18))
                Image(systemName: name)
                    .font(.system(size: 12, weight: .semibold))
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
                .font(.system(size: 12, weight: .bold))
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
                LazyVGrid(columns: MacCatalystGrid.adaptive(iPad: 2, mac: 4, spacing: 12), spacing: 12) {
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
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(SBrand.purpleLight)
                }
                .frame(height: 110)
                Text(style.rawValue)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                if isSelected {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 11))
                        Text("Aktiv")
                            .font(.system(size: 10, weight: .bold))
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
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            // Score-badge
            Text("\(score)")
                .font(.system(size: 8, weight: .bold))
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
    @Environment(\.dismiss) private var dismiss

    private enum LBrand {
        static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
        static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
        static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
        static let stroke = Color.white.opacity(0.06)
        static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
        static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
        static let textSecondary = Color.white.opacity(0.55)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
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
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .foregroundStyle(LBrand.purpleLight)
                }
                ToolbarItem(placement: .primaryAction) {
                    if !activeOverlays.isEmpty {
                        Button { activeOverlays.removeAll() } label: {
                            Text("Nullstill (\(activeOverlays.count))")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(LBrand.textSecondary)
                        }
                    }
                }
            }
            .toolbarBackground(LBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.large])
        .macCatalystSheetSize(minWidth: 820, minHeight: 640)
    }

    private var styleSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "map.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.purpleLight)
                Text("Kartstil")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            LazyVGrid(columns: MacCatalystGrid.adaptive(iPad: 2, mac: 4, spacing: 10), spacing: 10) {
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
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(LBrand.purpleLight)
                }
                .frame(height: 64)
                Text(style.rawValue)
                    .font(.system(size: 11, weight: .semibold))
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
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.purpleLight)
                Text("Visuelle lag")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(activeOverlays.count) aktiv\(activeOverlays.count == 1 ? "" : "e")")
                    .font(.system(size: 11))
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
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(o.color)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(o.rawValue)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(o.subtitle)
                        .font(.system(size: 11))
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
