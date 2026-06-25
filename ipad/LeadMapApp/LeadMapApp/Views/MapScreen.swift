// MapScreen.swift
//
// Kart-flaten i Lead Map. Speilet etter Daniels UX-redesign:
//   1. Pins for alle leads m/ status-farger + pulserende lilla for "hot"
//   2. Ingen indre tab-bar (Kalender/Stille bor i Mer-fanen nå)
//   3. Aktivt prosjekt-kort øverst m/ status, neste stopp, momentum + CTA
//   4. Flytende "Neste beste handling"-knapp bottom-right
//   5. Pin-tap → bottom-sheet m/ 5 store status-knapper (rask felt-bruk)
//   6. Auto-zoom til brukerens region ved oppstart
//  10. Mørkere Leadgrid-brand overlay over Apple Maps + lilla rute-glow
//
// Detaljer for hvert lead (research, strategi, pitch-deck) ligger
// fortsatt i LeadDetailSheet — quick-sheeten har en "Detaljer"-knapp.

import SwiftUI
import MapKit
import CoreLocation

// Backward-compat: noen eldre views/cron-paths refererer til `MapHomeView`
// direkte. Gjør den til en typealias så Xcode-prosjektet ikke trenger
// fil-omdøping.
typealias MapHomeView = MapScreen

struct MapScreen: View {
    @Environment(AppState.self) private var appState
    @State private var showDrawingSheet = false
    @State private var showCardScanner = false
    @State private var showResearchStart = false
    @State private var showCoverage = false
    @State private var showRouteSheet = false
    @State private var showProjectDetail = false
    @State private var showQuickStatus = false
    @State private var quickStatusLead: LeadModel?
    @State private var showFullDetail = false
    @State private var fullDetailLead: LeadModel?
    @State private var hasCenteredOnUser = false

    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: .init(latitude: 59.9139, longitude: 10.7522), // Oslo
            span: .init(latitudeDelta: 0.08, longitudeDelta: 0.10)
        )
    )

    var body: some View {
        NavigationStack {
            ZStack {
                mapLayer
                    .ignoresSafeArea(edges: [.bottom, .horizontal])
                brandOverlay
                topOverlay
                bottomOverlay
            }
            .sheet(item: $quickStatusLead, onDismiss: { quickStatusLead = nil }) { lead in
                LeadQuickStatusSheet(
                    lead: lead,
                    onOpenFullDetail: {
                        quickStatusLead = nil
                        // Vis full sheet etter at quick-sheeten lukker
                        Task { @MainActor in
                            try? await Task.sleep(nanoseconds: 250_000_000)
                            fullDetailLead = lead
                        }
                    }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
            .sheet(item: $fullDetailLead, onDismiss: { fullDetailLead = nil }) { lead in
                LeadDetailSheet(lead: lead)
            }
            .sheet(item: Binding(
                get: { appState.selectedCompetitor },
                set: { appState.selectedCompetitor = $0 }
            )) { competitor in
                CompetitorDetailSheet(competitor: competitor)
            }
            .sheet(isPresented: $showProjectDetail) {
                ProjectDetailSheet(
                    onOpenLead: { lead in fullDetailLead = lead },
                    onStartRoute: { Task { await planRoute() } }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showRouteSheet) {
                if let route = appState.dayRoute {
                    DayRouteSheet(route: route)
                }
            }
            .sheet(isPresented: $showDrawingSheet) {
                AnnotationDrawingView(initialRegion: camera.region)
            }
            .sheet(isPresented: $showCoverage) { CoverageView() }
            .sheet(isPresented: $showCardScanner) {
                if #available(iOS 16.0, *) { BusinessCardScannerView() }
            }
            .sheet(isPresented: $showResearchStart) {
                LeadResearchStartView()
            }
            .toolbar { mapToolbar }
            .task { await initialZoomIfNeeded() }
            .onChange(of: appState.workloadLeads.count) { _, _ in
                Task { await initialZoomIfNeeded() }
            }
        }
    }

    // MARK: - Map layer

    @ViewBuilder
    private var mapLayer: some View {
        Map(position: $camera) {
            ForEach(appState.leads) { lead in
                Annotation(
                    lead.name,
                    coordinate: .init(latitude: lead.latitude, longitude: lead.longitude)
                ) {
                    LeadPinView(lead: lead, selected: quickStatusLead?.id == lead.id)
                        .onTapGesture { quickStatusLead = lead }
                }
            }
            ForEach(appState.competitors.compactMap { c -> (CompetitorModel, CLLocationCoordinate2D)? in
                guard let lat = c.latitude, let lng = c.longitude else { return nil }
                return (c, .init(latitude: lat, longitude: lng))
            }, id: \.0.id) { comp, coord in
                Annotation(comp.name, coordinate: coord) {
                    CompetitorPin(threat: comp.threatLevel,
                                  selected: appState.selectedCompetitor?.id == comp.id)
                        .onTapGesture { appState.selectedCompetitor = comp }
                }
            }
            // Live selger-pins (PR #612)
            ForEach(appState.memberLocations) { m in
                Annotation(
                    m.displayName ?? m.role,
                    coordinate: .init(latitude: m.lat, longitude: m.lng)
                ) { MemberPinView(member: m) }
            }
            // Kart-annotasjoner (PR #629)
            ForEach(appState.annotations) { annot in
                annotationOverlay(annot)
            }
            // Selgerens territorie-grids — lilla i stedet for blå for å
            // markere "mitt område" (LeadGrid-identitet).
            ForEach(appState.myTerritories) { t in
                territoryOverlay(t)
            }
            // Dagsrute med lilla glow-polyline + nummererte stopp.
            if let route = appState.dayRoute {
                let routeCoords = route.stops.compactMap { $0.coordinate }
                if routeCoords.count >= 2 {
                    // Outer glow (semi-transparent, brede strøk)
                    MapPolyline(coordinates: routeCoords)
                        .stroke(
                            Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0.35),
                            lineWidth: 12
                        )
                    MapPolyline(coordinates: routeCoords)
                        .stroke(
                            Color(red: 0.66, green: 0.32, blue: 0.99),
                            lineWidth: 4
                        )
                }
                ForEach(route.stops) { stop in
                    if let c = stop.coordinate {
                        Annotation("Stopp \(stop.position)", coordinate: c) {
                            Text("\(stop.position)")
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                                .padding(6)
                                .background(
                                    Circle().fill(Color(red: 0.66, green: 0.32, blue: 0.99))
                                )
                                .overlay(
                                    Circle().stroke(Color.white.opacity(0.7), lineWidth: 1.5)
                                )
                        }
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
    }

    /// Mørkere Leadgrid-purple overlay øverst og nederst for å bryte den
    /// rå Apple Maps-følelsen. Gradient er svak nok til at kartet er
    /// lesbart, men gir umiddelbart brand-identitet.
    @ViewBuilder
    private var brandOverlay: some View {
        LinearGradient(
            stops: [
                .init(color: Color(red: 0.10, green: 0.04, blue: 0.20).opacity(0.55), location: 0.0),
                .init(color: .clear, location: 0.25),
                .init(color: .clear, location: 0.70),
                .init(color: Color(red: 0.10, green: 0.04, blue: 0.20).opacity(0.45), location: 1.0)
            ],
            startPoint: .top, endPoint: .bottom
        )
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    // MARK: - Topp- og bunn-overlays

    @ViewBuilder
    private var topOverlay: some View {
        VStack(spacing: 8) {
            MapProjectCard(
                onStartRoute: {
                    if appState.dayRoute != nil {
                        showRouteSheet = true
                    } else {
                        Task { await planRoute() }
                    }
                },
                onOpenNext: { lead in
                    quickStatusLead = lead
                },
                onTapExpand: { showProjectDetail = true }
            )
            .padding(.top, 4)
            RemindersBanner()
            TerritoryBanner()
            Spacer()
        }
    }

    @ViewBuilder
    private var bottomOverlay: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                NextBestActionFAB { leadId in
                    if let model = appState.leads.first(where: { $0.id == leadId }) {
                        quickStatusLead = model
                    }
                }
                .padding(.trailing, 16)
                .padding(.bottom, 16)
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var mapToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            HStack(spacing: 6) {
                ProjectPicker()
                if let metrics = appState.metrics {
                    Text("\(metrics.totalLeads) leads")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                }
                if appState.isUsingStaleCache {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
                if appState.pendingVisitsCount > 0 {
                    Label("\(appState.pendingVisitsCount)", systemImage: "arrow.triangle.2.circlepath")
                        .font(.caption.bold())
                        .foregroundStyle(.orange)
                }
            }
        }
        ToolbarItem(placement: .topBarTrailing) {
            LeadgridNotificationBellView()
        }
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button("Oppdater", systemImage: "arrow.clockwise") {
                    Task { await appState.refreshAll() }
                }
                Button("Sentrer på meg", systemImage: "location") {
                    Task { await centerOnUser(animated: true) }
                }
                if #available(iOS 16.0, *) {
                    Button("Skann visittkort", systemImage: "camera.viewfinder") {
                        showCardScanner = true
                    }
                }
                if appState.canCreateAnnotations {
                    Button("Tegn på kart", systemImage: "pencil.tip.crop.circle") {
                        showDrawingSheet = true
                    }
                    Button("Territorie-dekning", systemImage: "map.circle") {
                        showCoverage = true
                    }
                }
                if appState.permissions.contains("lead_research.run") {
                    Button("Finn nye leads", systemImage: "magnifyingglass.circle") {
                        showResearchStart = true
                    }
                }
                if appState.pendingVisitsCount > 0 {
                    Button("Send \(appState.pendingVisitsCount) ventende",
                           systemImage: "paperplane") {
                        Task { await appState.refreshAll() }
                    }
                }
                Button("Logg ut", systemImage: "person.crop.circle.badge.minus") {
                    appState.signOut()
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
    }

    // MARK: - Plan route + center on user

    @MainActor
    private func planRoute() async {
        await appState.planDayRoute()
        if appState.dayRoute != nil { showRouteSheet = true }
    }

    /// Auto-zoom til brukerens region ved første kjøring. Bruker
    /// LocationService.shared.currentLocation hvis den er fixet; ellers
    /// midtpunktet av tildelte leads.
    @MainActor
    private func initialZoomIfNeeded() async {
        guard !hasCenteredOnUser else { return }
        await centerOnUser(animated: false)
    }

    @MainActor
    private func centerOnUser(animated: Bool) async {
        let coord: CLLocationCoordinate2D?
        if let loc = LocationService.shared.currentLocation {
            coord = loc.coordinate
        } else if let lead = appState.workloadLeads.first(where: { $0.coordinate != nil }),
                  let c = lead.coordinate {
            coord = CLLocationCoordinate2D(latitude: c.lat, longitude: c.lng)
        } else if let lead = appState.leads.first {
            coord = CLLocationCoordinate2D(latitude: lead.latitude, longitude: lead.longitude)
        } else {
            coord = nil
        }
        guard let center = coord else { return }
        let region = MKCoordinateRegion(
            center: center,
            span: .init(latitudeDelta: 0.06, longitudeDelta: 0.06)
        )
        if animated {
            withAnimation(.easeInOut(duration: 0.5)) {
                camera = .region(region)
            }
        } else {
            camera = .region(region)
        }
        hasCenteredOnUser = true
    }

    // MARK: - Overlays for annotasjoner og territories

    @MapContentBuilder
    private func annotationOverlay(_ annot: MapAnnotation) -> some MapContent {
        let color = Color(hex: annot.color.trimmingCharacters(in: CharacterSet(charactersIn: "#")))
        let coords = annot.coordinates
        if let type = annot.typeEnum {
            switch type {
            case .focusArea where coords.count >= 3:
                MapPolygon(coordinates: coords)
                    .stroke(color, lineWidth: annot.strokeWidth)
                    .foregroundStyle(color.opacity(0.18))
            case .route, .freehand:
                if coords.count >= 2 {
                    MapPolyline(coordinates: coords)
                        .stroke(color, lineWidth: annot.strokeWidth)
                }
            case .pinCallout:
                if let p = coords.first {
                    Annotation(annot.title ?? "Notat", coordinate: p) {
                        AnnotationCalloutPin(annot: annot, color: color)
                    }
                }
            default:
                EmptyMapContent()
            }
        }
    }

    @MapContentBuilder
    private func territoryOverlay(_ t: Territory) -> some MapContent {
        let coords = t.polygonCoordinates
        if coords.count >= 3 {
            MapPolygon(coordinates: coords)
                .stroke(Color(red: 0.66, green: 0.32, blue: 0.99), lineWidth: 2)
                .foregroundStyle(Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0.12))
        }
        if let c = t.center, let r = t.radiusM {
            MapCircle(center: c, radius: CLLocationDistance(r))
                .stroke(Color(red: 0.66, green: 0.32, blue: 0.99), lineWidth: 2)
                .foregroundStyle(Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0.12))
        }
    }
}

/// Liten "tekst-boble"-pin for pin_callout-annotasjoner.
private struct AnnotationCalloutPin: View {
    let annot: MapAnnotation
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "text.bubble.fill").font(.caption)
                Text(annot.title ?? "Notat")
                    .font(.caption.bold())
                    .lineLimit(1)
            }
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(color.opacity(0.85), in: Capsule())
            .foregroundStyle(.white)
            .shadow(radius: 2)
        }
        .accessibilityLabel(annot.title ?? "Annotasjon")
    }
}

private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
