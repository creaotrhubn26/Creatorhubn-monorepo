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
import UIKit

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
    /// Sann mens MapSearchBar er ekspandert (panelet dekker området).
    /// Brukes til å skjule MapProjectCard slik at ikke empty/loading-state
    /// lyser gjennom under søke-panelet.
    @State private var searchBarExpanded = false
    // ── Industries-filter (mig 329) ──────────────────────────────────
    @State private var onlyMyIndustries = false
    @State private var myIndustryIds: Set<String> = []
    // ── Bruker-posisjon på kart ──────────────────────────────────────
    // Trackes lokalt for å vise/skjule "posisjon avslått"-banner og
    // for å forhindre at vi spør om permission flere ganger.
    @State private var locationAuthStatus: CLAuthorizationStatus = LocationService.shared.authorizationStatus
    @State private var hasRequestedAuthorization = false
    // ── Sentrer-på-meg-FAB (PR drop-pin) ───────────────────────────
    /// Live tracking-mode for kameraet. Toggles via CenterOnMeFAB.
    @State private var trackingMode: CenterTrackingMode = .off
    // ── Drop-pin long-press (PR drop-pin) ──────────────────────────
    /// Hvis non-nil → vis drop-pin-sheet. Settes av long-press på kartet
    /// (eller long-press på FAB-en for current location).
    @State private var pendingDropPin: CLLocationCoordinate2D?
    /// Holder lokalt SwiftUI-koordinat for siste long-press touch slik
    /// at MapReader-proxy kan konvertere det til geo-koordinat.
    @State private var longPressLocalPoint: CGPoint?

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
            // Drop-pin sheet (PR drop-pin): vises når brukeren long-press'er
            // kartet eller holder inne CenterOnMeFAB. Dismissal nuller
            // pendingDropPin → preview-pin fjernes automatisk.
            .sheet(item: Binding(
                get: { pendingDropPin.map { DropPinCoordinate(coordinate: $0) } },
                set: { newValue in pendingDropPin = newValue?.coordinate }
            )) { box in
                LeadgridDropPinSheet(
                    coordinate: box.coordinate,
                    onCreated: { _ in
                        zoomToNewLead(at: box.coordinate)
                    }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
            .toolbar { mapToolbar }
            .task { await requestLocationAuthorizationIfNeeded() }
            .task { await initialZoomIfNeeded() }
            .task { await loadMyIndustriesIfNeeded() }
            .onChange(of: appState.workloadLeads.count) { _, _ in
                Task { await initialZoomIfNeeded() }
            }
            // Lytt på "zoom til batch-bounds" — postet både av bulk-URL
            // success-flyten (PR #991) og Research-fanens lead-discovery
            // success-hero (Pakke 9). Centrer kamera til bounding-box
            // av alle nye pins m/ 20% padding.
            .onReceive(NotificationCenter.default.publisher(
                for: .leadgridBulkUrlBatchZoomToBounds
            )) { notif in
                handleBatchBoundsNotification(notif)
            }
        }
    }

    // MARK: - Map layer

    /// Leads etter aktive filtre (industries m.m.). Sentral
    /// filtreringsfunksjon slik at både kart-laget og bottom-overlay
    /// teller samme antall.
    private var filteredLeads: [LeadModel] {
        guard onlyMyIndustries, !myIndustryIds.isEmpty else {
            return appState.leads
        }
        return appState.leads.filter { lead in
            guard let iid = lead.industryId else { return false }
            return myIndustryIds.contains(iid)
        }
    }

    @ViewBuilder
    private var mapLayer: some View {
        // MapReader gir oss en proxy som kan konvertere lokale CGPoint-er
        // til CLLocationCoordinate2D — kritisk for long-press → drop-pin.
        MapReader { proxy in
            mapBody
                .gesture(longPressMapGesture(proxy: proxy))
                // Preview-pin tegnes som overlay i ZStack (utenfor selve
                // Map-treet for å unngå rebuild av MapContent ved hver
                // long-press).
                .overlay(alignment: .center) {
                    if let coord = pendingDropPin,
                       let p = proxy.convert(coord, to: .local) {
                        DropPinPreview()
                            .position(x: p.x, y: p.y)
                            .allowsHitTesting(false)
                    }
                }
        }
    }

    @ViewBuilder
    private var mapBody: some View {
        Map(position: $camera) {
            ForEach(filteredLeads) { lead in
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
            // Brukerens egen posisjon — Apple's animerte blå dot.
            // Krever NSLocationWhenInUseUsageDescription i Info.plist
            // (satt) + at bruker har godkjent posisjon. Hvis ikke,
            // vises ingenting (UserAnnotation feiler stille).
            UserAnnotation()
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
        // Kart-kontroller: kompass for orientering og avstandsskala.
        // `MapUserLocationButton` er fjernet til fordel for den prominente
        // `CenterOnMeFAB` i bottom-overlayet (PR drop-pin) — feltbruker
        // trenger en mye større tap-target enn Apple's lille standard-knapp.
        .mapControls {
            MapCompass()
            MapScaleView()
            MapPitchToggle()
        }
    }

    /// Long-press på kartet → konverter touch-koordinat til lat/lng via
    /// MapReader-proxy → trigger drop-pin-sheet. Bruker 0.6s minimum
    /// duration som matcher Apple Maps/Google Maps standard.
    private func longPressMapGesture(proxy: MapProxy) -> some Gesture {
        // SpatialTapGesture eksisterer kun for tap (ikke long-press), så vi
        // bruker LongPressGesture sequenced med DragGesture (minimumDistance:
        // 0) for å fange UP-event m/ koordinat. DragGesture-onChanged
        // skriver siste lokale punkt; long-press-onEnded leser det.
        return LongPressGesture(minimumDuration: 0.6)
            .sequenced(before: DragGesture(minimumDistance: 0))
            .onChanged { value in
                switch value {
                case .second(true, let drag):
                    if let d = drag {
                        longPressLocalPoint = d.location
                    }
                default:
                    break
                }
            }
            .onEnded { value in
                switch value {
                case .second(true, let drag):
                    let point = drag?.location ?? longPressLocalPoint
                    longPressLocalPoint = nil
                    guard let p = point,
                          let coord = proxy.convert(p, from: .local) else { return }
                    // Haptic + sheet trigger.
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    pendingDropPin = coord
                default:
                    longPressLocalPoint = nil
                }
            }
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
            // Søk-overlay (Pakke 9): kompakt kapsel som ekspanderer til
            // full søke-panel m/ steder, leads og bransjer. Bygges først
            // i z-stack slik at både Project-kort og banner kan dukke
            // opp under uten å bli skjult.
            MapSearchBar(
                onSelect: { target in handleMapSearchSelection(target) },
                isExpanded: $searchBarExpanded
            )
            // Skjul MapProjectCard mens søke-panelet er åpent — ellers ligger
            // empty/loading-skeleton synlig under search-overlayen og gir
            // dobbel-visuell støy. Glir tilbake inn når brukeren lukker søk.
            if !searchBarExpanded {
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
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            // Vis banner kun hvis bruker eksplisitt har avslått posisjon.
            // .notDetermined viser ingenting (vi har akkurat trigget
            // iOS-dialogen); .authorized viser ingenting (alt OK).
            if locationAuthStatus == .denied || locationAuthStatus == .restricted {
                LocationPermissionBanner(status: locationAuthStatus)
            }
            RemindersBanner()
            TerritoryBanner()
            // Empty-state-overlay når det ikke finnes leads i området.
            // Vises kun etter at vi har snakket med backend minst én gang
            // (`lastSyncAt != nil`) for å unngå at den blinker fram før
            // initial refresh er ferdig.
            if appState.leads.isEmpty && appState.lastSyncAt != nil {
                MapEmptyStateOverlay(onImport: { showResearchStart = true })
            }
            Spacer()
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.85), value: searchBarExpanded)
    }

    @ViewBuilder
    private var bottomOverlay: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                VStack(alignment: .trailing, spacing: 12) {
                    // Prominent sentrer-på-meg-FAB (PR drop-pin) over NBA.
                    // Plasseres øverst i kolonnen så tommel naturlig treffer
                    // den ved enhåndsbruk (iPad mini / iPhone-fall-back).
                    CenterOnMeFAB(
                        mode: trackingMode,
                        authStatus: locationAuthStatus,
                        onToggleMode: { handleCenterToggle() },
                        onLongPress: { dropPinAtCurrentLocation() },
                        onPermissionDenied: { openLocationSettings() }
                    )
                    NextBestActionFAB { leadId in
                        if let model = appState.leads.first(where: { $0.id == leadId }) {
                            quickStatusLead = model
                        }
                    }
                }
                .padding(.trailing, 16)
                .padding(.bottom, 16)
            }
        }
    }

    // MARK: - Center-on-me FAB handlers

    @MainActor
    private func handleCenterToggle() {
        let next = trackingMode.next
        trackingMode = next
        switch next {
        case .off:
            // Ingen kamera-bevegelse; brukerens manuelle pan/zoom respekteres.
            break
        case .follow:
            Task { await centerOnUser(animated: true) }
        case .followWithHeading:
            // SwiftUI Map (iOS 17) støtter ikke heading-binding direkte i
            // alle versjoner — vi sentrer på posisjon m/ tighter span og
            // overlater rotasjon til Apple sin egne kompass-MapControl.
            Task { await centerOnUser(animated: true, tighter: true) }
        }
    }

    @MainActor
    private func dropPinAtCurrentLocation() {
        if let loc = LocationService.shared.currentLocation {
            pendingDropPin = loc.coordinate
        } else if locationAuthStatus == .denied || locationAuthStatus == .restricted {
            openLocationSettings()
        } else {
            // Trigger ett oppdaterings-forsøk; viser ikke sheet hvis vi ikke
            // har fix enda — feilfri silent no-op er bedre enn å droppe på
            // Oslo-fallback midt i Norge.
            LocationService.shared.startUpdating()
        }
    }

    @MainActor
    private func openLocationSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
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
                Divider()
                // Industries-filter (mig 329). Toggle viser bare leads
                // i bransjene sales-rep'en har spesialisering på.
                Toggle(isOn: $onlyMyIndustries) {
                    Label("Bare mine bransjer", systemImage: "tag.fill")
                }
                .disabled(myIndustryIds.isEmpty)
                Button("Logg ut", systemImage: "person.crop.circle.badge.minus") {
                    appState.signOut()
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
    }

    /// Hent mine industries-IDer for filteret. Cachen leve­tid er hele
    /// sesjonen — bruker kan trekke ned for å oppdatere.
    @MainActor
    private func loadMyIndustriesIfNeeded() async {
        guard myIndustryIds.isEmpty, let api = appState.api else { return }
        do {
            let mine = try await api.fetchMyIndustries()
            myIndustryIds = Set(mine.map { $0.industryId })
        } catch {
            // Stille — filteret blir bare disabled til neste forsøk.
        }
    }

    // MARK: - Location authorization

    /// Spør om when-in-use posisjons-tilgang proaktivt første gang
    /// kart-fanen vises. Uten dette ville iOS-dialogen først dukke opp
    /// når noe annet (heartbeat, VisitLog) trigget en `currentLocation`-
    /// spørring — og brukeren har ingen idé om hvorfor blå-doten
    /// mangler i mellomtiden.
    @MainActor
    private func requestLocationAuthorizationIfNeeded() async {
        guard !hasRequestedAuthorization else { return }
        hasRequestedAuthorization = true
        let initial = LocationService.shared.authorizationStatus
        locationAuthStatus = initial
        if initial == .notDetermined {
            await LocationService.shared.requestAuthorizationIfNeeded()
        } else if initial == .authorizedWhenInUse || initial == .authorizedAlways {
            // Sikre at vi får posisjons-oppdateringer slik at
            // UserAnnotation faktisk har data å tegne.
            LocationService.shared.startUpdating()
        }
        locationAuthStatus = LocationService.shared.authorizationStatus
        // Re-sentrer hvis vi akkurat fikk grant og kartet sto på Oslo-fallback.
        if (locationAuthStatus == .authorizedWhenInUse
            || locationAuthStatus == .authorizedAlways) {
            // Vent kort så CLLocation rekker første fix
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            hasCenteredOnUser = false
            await centerOnUser(animated: true)
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
    private func centerOnUser(animated: Bool, tighter: Bool = false) async {
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
        let delta = tighter ? 0.015 : 0.06
        let region = MKCoordinateRegion(
            center: center,
            span: .init(latitudeDelta: delta, longitudeDelta: delta)
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

    /// Auto-zoom kameraet til en nyopprettet lead etter drop-pin.
    @MainActor
    private func zoomToNewLead(at coord: CLLocationCoordinate2D) {
        let region = MKCoordinateRegion(
            center: coord,
            span: .init(latitudeDelta: 0.005, longitudeDelta: 0.005)
        )
        withAnimation(.easeInOut(duration: 0.6)) {
            camera = .region(region)
        }
    }

    /// Zoom kameraet til en bounding-box av alle koordinatene + 20% padding.
    /// Brukt av bulk-URL/lead-discovery success-flyten.
    @MainActor
    private func handleBatchBoundsNotification(_ notif: Notification) {
        guard let raw = notif.userInfo?["coordinates"] as? [[String: Double]],
              !raw.isEmpty else { return }
        let lats = raw.compactMap { $0["lat"] }
        let lngs = raw.compactMap { $0["lng"] }
        guard !lats.isEmpty, !lngs.isEmpty else { return }
        let minLat = lats.min() ?? 0
        let maxLat = lats.max() ?? 0
        let minLng = lngs.min() ?? 0
        let maxLng = lngs.max() ?? 0
        let centerLat = (minLat + maxLat) / 2
        let centerLng = (minLng + maxLng) / 2
        let latDelta = max(0.01, (maxLat - minLat) * 1.2)
        let lngDelta = max(0.01, (maxLng - minLng) * 1.2)
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: centerLat, longitude: centerLng),
            span: MKCoordinateSpan(
                latitudeDelta: latDelta,
                longitudeDelta: lngDelta,
            )
        )
        withAnimation(.easeInOut(duration: 0.6)) {
            camera = .region(region)
        }
    }

    // MARK: - Map-søk (Pakke 9)

    /// Handler for MapSearchBar-resultater.
    ///   - sted → animér kamera til koordinatet
    ///   - lead → animér til lead-koordinatet + presenter quick-sheet
    ///   - bransje → toggle filter "Bare bransje X" via myIndustryIds
    @MainActor
    private func handleMapSearchSelection(_ target: MapSearchTarget) {
        switch target {
        case .place(let coord, _):
            let region = MKCoordinateRegion(
                center: coord,
                span: .init(latitudeDelta: 0.04, longitudeDelta: 0.04)
            )
            withAnimation(.easeInOut(duration: 0.5)) {
                camera = .region(region)
            }
        case .lead(let lead):
            let coord = CLLocationCoordinate2D(
                latitude: lead.latitude,
                longitude: lead.longitude,
            )
            let region = MKCoordinateRegion(
                center: coord,
                span: .init(latitudeDelta: 0.01, longitudeDelta: 0.01)
            )
            withAnimation(.easeInOut(duration: 0.5)) {
                camera = .region(region)
            }
            // Kort sleep så kameraet starter pan FØR sheeten slår opp.
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 250_000_000)
                quickStatusLead = lead
            }
        case .industry(let industry):
            // Toggle bransje-filter — legg til/fjern fra mine industries.
            // (Filtrering er klient-side på myIndustryIds — vi bruker
            // den eksisterende `onlyMyIndustries`-mekanismen.)
            if myIndustryIds.contains(industry.id) {
                myIndustryIds.remove(industry.id)
                if myIndustryIds.isEmpty {
                    onlyMyIndustries = false
                }
            } else {
                myIndustryIds.insert(industry.id)
                onlyMyIndustries = true
            }
        }
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

/// Banner som vises øverst på kartet hvis bruker har avslått eller
/// blokkert posisjon. Tap → Innstillinger-app for å snu på det.
/// Følger samme visuelle språk som `RemindersBanner` (kapsel-ikon +
/// tittel + chevron + farget halo) for konsistens.
private struct LocationPermissionBanner: View {
    let status: CLAuthorizationStatus

    var body: some View {
        Button {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "location.slash.fill")
                    .font(.title3)
                    .foregroundStyle(Color.orange)

                VStack(alignment: .leading, spacing: 2) {
                    Text(headline)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                    Text("Trykk for å åpne Innstillinger")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(12)
            .background(Color.orange.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.orange.opacity(0.45), lineWidth: 1)
            )
            .padding(.horizontal, 12)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Åpner iOS Innstillinger så du kan slå på posisjon for Lead Map.")
    }

    private var headline: String {
        switch status {
        case .denied: return "Posisjon er avslått"
        case .restricted: return "Posisjon er begrenset"
        default: return "Posisjon utilgjengelig"
        }
    }
}

/// Empty-state-kort som vises midt på kartet når brukeren ikke har
/// noen leads ennå. Hjelper nye sales-rep'er å skjønne hva neste steg
/// er i stedet for å se et tomt kart og lure.
private struct MapEmptyStateOverlay: View {
    @Environment(AppState.self) private var appState
    var onImport: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "mappin.slash")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Color(red: 0.66, green: 0.32, blue: 0.99))
            Text("Ingen leads i området ennå")
                .font(.subheadline.bold())
                .foregroundStyle(.primary)
            Text("Importer dine første kunder eller la Lead Map finne nye for deg.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
            if appState.permissions.contains("lead_research.run") {
                Button("Finn nye leads", action: onImport)
                    .font(.caption.bold())
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(
                        Color(red: 0.66, green: 0.32, blue: 0.99),
                        in: Capsule()
                    )
                    .foregroundStyle(.white)
                    .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.25), lineWidth: 0.5)
        )
        .padding(.horizontal, 24)
        .padding(.top, 8)
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

/// Identifiable wrapper for CLLocationCoordinate2D — kreves for å
/// presentere drop-pin-sheet via `.sheet(item:)`. CLLocationCoordinate2D
/// er ikke Hashable/Identifiable selv.
private struct DropPinCoordinate: Identifiable, Hashable {
    let coordinate: CLLocationCoordinate2D
    var id: String { "\(coordinate.latitude),\(coordinate.longitude)" }

    static func == (lhs: DropPinCoordinate, rhs: DropPinCoordinate) -> Bool {
        lhs.coordinate.latitude == rhs.coordinate.latitude
            && lhs.coordinate.longitude == rhs.coordinate.longitude
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(coordinate.latitude)
        hasher.combine(coordinate.longitude)
    }
}

/// Pulserende preview-pin vist mens drop-pin-sheet er åpen. Tegnes som
/// SwiftUI-overlay over MapReader istedenfor som MapContent slik at
/// pulse-animasjonen ikke trigger Map-rebuild.
private struct DropPinPreview: View {
    @State private var pulse = false

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    var body: some View {
        ZStack {
            Circle()
                .fill(Self.brandPurple.opacity(0.20))
                .frame(width: pulse ? 64 : 40, height: pulse ? 64 : 40)
            Circle()
                .fill(Self.brandPurple.opacity(0.35))
                .frame(width: 32, height: 32)
            Image(systemName: "mappin.circle.fill")
                .font(.system(size: 36, weight: .bold))
                .foregroundStyle(.white, Self.brandPurple)
                .shadow(color: .black.opacity(0.35), radius: 4, x: 0, y: 2)
        }
        .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulse)
        .onAppear { pulse = true }
    }
}
