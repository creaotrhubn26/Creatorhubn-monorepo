// MapView.swift
//
// Kart (UI-spesifikasjon 6.2): søk, filter-chips, MapKit med mørk stil,
// POI-markører, min posisjon, nærmeste-kort og «Liste»-knapp som bytter til
// MapListView (UU-krav 8.5).
//
// Kartforbedringene (Daniel, 23.09.2026):
//   - Turruta: svak linje mellom områdets steder i sortOrder, og gangrute
//     (MKDirections, WalkingRouteService) til valgt sted med gangtid og
//     avstand; luftlinje som reserve (WalkingRoute.swift).
//   - Besøkt-hake og «neste stopp» på markørene (POIMarker, MapAccessibility).
//   - Lydsonen (`triggerRadiusM`) som svak sirkel rundt hvert sted.
//   - Posisjonsknappen følger brukeren etter første trykk; kompass og
//     målestokk via .mapControls.
//   - VoiceOver: listen er standard når VoiceOver kjører, valget huskes i
//     AppSettings.mapShowsList; oppsummering øverst på kartet og en rotor
//     over stedene sortert etter avstand.

import MapKit
import SwiftUI

struct MapView: View {
    @Binding var path: NavigationPath
    // Ikke `private`: MapView+Content.swift (header/kart/nærmeste-kort, flyttet
    // ut for SwiftLint sin type_body_length-grense) leser disse — samme
    // «internt, ikke privat»-mønster som PlayerViewModel+Playback.swift bruker.
    @Environment(AppEnvironment.self) var env
    @Environment(\.contrastColors) var contrast
    @Environment(\.accessibilityVoiceOverEnabled) var voiceOverEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace var rotorNamespace

    @State private var searchText = ""
    @State private var selectedCategory: String?
    @State var selectedPoiId: String?
    @State var cameraPosition: MapCameraPosition = .automatic
    /// Posisjonsknappen er trykket før tillatelsen er gitt: følg brukeren
    /// så snart tillatelsen og første posisjon er på plass.
    @State private var pendingFollow = false
    @State private var routeService = WalkingRouteService()
    /// Gangtid i listen og på nærmeste markør (pakke 2, item 4).
    @State private var etaBatch = WalkingETABatch()
    /// «Færre trykk til lyd» (avspiller-redesignet, item 5): nærmeste-kortets
    /// direkte-avspill-knapp åpner denne i stedet for å starte avspilling
    /// direkte, når stedet er låst — akkurat som detaljsiden.
    @State var paywallPoi: GuidePOI?

    var locale: Locale { env.settings.locale }
    var uiLanguage: String { env.settings.uiLanguage }

    var showList: Bool {
        MapViewMode.showsList(storedChoice: env.settings.mapShowsList, voiceOverRunning: voiceOverEnabled)
    }

    var filteredPois: [GuidePOI] {
        env.store.pois.filter { poi in
            (selectedCategory == nil || poi.categoryId == selectedCategory)
                && (searchText.isEmpty || poi.title.localizedCaseInsensitiveContains(searchText))
        }
    }

    var sorted: [(poi: GuidePOI, distanceM: Double?)] {
        Geo.sortedByDistance(filteredPois, from: env.location.fix?.coordinate)
    }

    /// Gangtid per sted: ekte for de nærmeste ~8 (WalkingETABatch), ellers
    /// avstandsestimat (pakke 2, item 4).
    func eta(for item: (poi: GuidePOI, distanceM: Double?)) -> WalkingETA? {
        etaBatch.eta(for: item.poi, distanceM: item.distanceM)
    }

    /// Kortet viser valgt POI, ellers nærmeste.
    var highlighted: (poi: GuidePOI, distanceM: Double?)? {
        if let selectedPoiId, let match = sorted.first(where: { $0.poi.id == selectedPoiId }) { return match }
        return sorted.first
    }

    private var selectedPoi: GuidePOI? { selectedPoiId.flatMap { env.store.poi(id: $0) } }

    var routeLine: MapRouteLine? {
        MapRouteLine.resolve(poi: selectedPoi, origin: env.location.fix?.coordinate, route: routeService.route)
    }

    var tourMarkers: MapTourMarkers {
        MapTourMarkers(
            pois: env.store.pois,
            completedIds: env.visits.completedPoiIds,
            visitedIds: env.visits.visitedPoiIds,
            excludingId: env.player.poi?.id
        )
    }

    var accessibilitySummary: String {
        MapAccessibilitySummary.make(pois: filteredPois, origin: env.location.fix?.coordinate).text(
            localize: { L10n.string($0, lang: uiLanguage) },
            formatDistance: { L10n.distance(meters: $0, locale: locale) }
        )
    }

    var areaRegion: MKCoordinateRegion? {
        guard let area = env.store.area else { return nil }
        return MKCoordinateRegion(center: area.center.clCoordinate, span: MKCoordinateSpan(latitudeDelta: 0.014, longitudeDelta: 0.02))
    }

    private var chipItems: [(id: String?, label: String)] {
        var items: [(id: String?, label: String)] = [(id: nil, label: L10n.string("filter.all", lang: uiLanguage))]
        for category in env.store.categories {
            items.append((id: category.id, label: env.categoryLabel(category.id) ?? category.label))
        }
        return items
    }

    var body: some View {
        VStack(spacing: AppSpacing.m) {
            SearchField(placeholder: "map.searchPlaceholder", text: $searchText)
                .padding(.horizontal, AppSpacing.screenMargin)
                .padding(.top, AppSpacing.s)
            FilterChipRow(items: chipItems, selectedId: $selectedCategory)
            if showList {
                MapListView(items: sorted, locale: locale, eta: { eta(for: $0) }) { poi in
                    path.append(Route.poi(poi.id))
                }
            } else {
                mapArea
            }
        }
        .background(AppColor.bgBase)
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top, spacing: 0) { header }
        .onAppear {
            if let areaRegion { cameraPosition = .region(areaRegion) }
            updateRoute()
            updateEtas()
        }
        .onDisappear {
            routeService.clear()
            etaBatch.clear()
        }
        // Nytt område (områdevelgeren): flytt kartet dit og glem valg fra det gamle.
        .onChange(of: env.store.area?.id) { _, _ in
            selectedPoiId = nil
            selectedCategory = nil
            if let areaRegion { cameraPosition = .region(areaRegion) }
            etaBatch.clear()
        }
        .onChange(of: selectedPoiId) { _, _ in updateRoute() }
        .onChange(of: showList) { _, _ in updateRoute() }
        .onChange(of: env.location.fix) { _, newFix in
            updateRoute()
            updateEtas()
            if pendingFollow, newFix != nil { followUser() }
        }
        .onChange(of: filteredPois.map(\.id)) { _, _ in updateEtas() }
        .onChange(of: env.location.authorization) { _, status in
            guard pendingFollow else { return }
            switch status {
            case .authorized: followUser()
            case .denied: pendingFollow = false
            case .notDetermined: break
            }
        }
        .sheet(item: $paywallPoi) { poi in
            MockPaywallSheet(areaId: poi.areaId)
        }
    }
}

// MARK: - Posisjon og rute

extension MapView {
    /// Første trykk ber om tillatelse; kartet følger brukeren så snart den er
    /// gitt, uten å vente på et nytt trykk. Ikke `private`: brukt fra
    /// MapView+Content.swift sin posisjonsknapp.
    func locateMe() {
        env.location.requestAndStart()
        switch env.location.authorization {
        case .authorized: followUser()
        case .notDetermined: pendingFollow = true
        case .denied: pendingFollow = false
        }
    }

    private func followUser() {
        pendingFollow = false
        var fallback = cameraPosition
        if let fix = env.location.fix {
            fallback = .region(MKCoordinateRegion(center: fix.coordinate.clCoordinate, span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.012)))
        }
        moveCamera(to: .userLocation(followsHeading: true, fallback: fallback))
    }

    /// Kamerabytter animeres ikke når «Reduser bevegelse» er på. Ikke
    /// `private`: brukt fra MapView+Content.swift («Ingen severdigheter i
    /// nærheten» sin «Vis demoområdet»-knapp).
    func moveCamera(to position: MapCameraPosition) {
        if reduceMotion {
            cameraPosition = position
        } else {
            withAnimation(.easeInOut(duration: 0.35)) { cameraPosition = position }
        }
    }

    private func updateRoute() {
        routeService.update(poi: showList ? nil : selectedPoi, origin: env.location.fix?.coordinate)
    }

    /// Gangtid i listen og på nærmeste markør (pakke 2, item 4): bare de
    /// nærmeste ~8 spørres om, se WalkingETASelection.
    private func updateEtas() {
        etaBatch.update(sortedByDistance: sorted, origin: env.location.fix?.coordinate)
    }
}
