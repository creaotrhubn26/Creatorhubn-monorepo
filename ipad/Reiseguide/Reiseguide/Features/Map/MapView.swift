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
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var rotorNamespace

    @State private var searchText = ""
    @State private var selectedCategory: String?
    @State private var selectedPoiId: String?
    @State private var cameraPosition: MapCameraPosition = .automatic
    /// Posisjonsknappen er trykket før tillatelsen er gitt: følg brukeren
    /// så snart tillatelsen og første posisjon er på plass.
    @State private var pendingFollow = false
    @State private var routeService = WalkingRouteService()

    private var locale: Locale { env.settings.locale }
    private var uiLanguage: String { env.settings.uiLanguage }

    private var showList: Bool {
        MapViewMode.showsList(storedChoice: env.settings.mapShowsList, voiceOverRunning: voiceOverEnabled)
    }

    private var filteredPois: [GuidePOI] {
        env.store.pois.filter { poi in
            (selectedCategory == nil || poi.categoryId == selectedCategory)
                && (searchText.isEmpty || poi.title.localizedCaseInsensitiveContains(searchText))
        }
    }

    private var sorted: [(poi: GuidePOI, distanceM: Double?)] {
        Geo.sortedByDistance(filteredPois, from: env.location.fix?.coordinate)
    }

    /// Kortet viser valgt POI, ellers nærmeste.
    private var highlighted: (poi: GuidePOI, distanceM: Double?)? {
        if let selectedPoiId, let match = sorted.first(where: { $0.poi.id == selectedPoiId }) { return match }
        return sorted.first
    }

    private var selectedPoi: GuidePOI? { selectedPoiId.flatMap { env.store.poi(id: $0) } }

    private var routeLine: MapRouteLine? {
        MapRouteLine.resolve(poi: selectedPoi, origin: env.location.fix?.coordinate, route: routeService.route)
    }

    private var tourMarkers: MapTourMarkers {
        MapTourMarkers(
            pois: env.store.pois,
            completedIds: env.visits.completedPoiIds,
            visitedIds: env.visits.visitedPoiIds,
            excludingId: env.player.poi?.id
        )
    }

    private var accessibilitySummary: String {
        MapAccessibilitySummary.make(pois: filteredPois, origin: env.location.fix?.coordinate).text(
            localize: { L10n.string($0, lang: uiLanguage) },
            formatDistance: { L10n.distance(meters: $0, locale: locale) }
        )
    }

    private var areaRegion: MKCoordinateRegion? {
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
                MapListView(items: sorted, locale: locale) { poi in
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
        }
        .onDisappear { routeService.clear() }
        // Nytt område (områdevelgeren): flytt kartet dit og glem valg fra det gamle.
        .onChange(of: env.store.area?.id) { _, _ in
            selectedPoiId = nil
            selectedCategory = nil
            if let areaRegion { cameraPosition = .region(areaRegion) }
        }
        .onChange(of: selectedPoiId) { _, _ in updateRoute() }
        .onChange(of: showList) { _, _ in updateRoute() }
        .onChange(of: env.location.fix) { _, newFix in
            updateRoute()
            if pendingFollow, newFix != nil { followUser() }
        }
        .onChange(of: env.location.authorization) { _, status in
            guard pendingFollow else { return }
            switch status {
            case .authorized: followUser()
            case .denied: pendingFollow = false
            case .notDetermined: break
            }
        }
    }

    private var header: some View {
        HStack {
            IconCircleButton(systemImage: "chevron.left", label: "action.back") {
                if !path.isEmpty { path.removeLast() }
            }
            Spacer()
            Button {
                env.settings.mapShowsList = !showList
            } label: {
                Label(showList ? "map.showMap" : "map.showList", systemImage: showList ? "map" : "list.bullet")
                    .font(AppFont.chip)
                    .foregroundStyle(AppColor.textPrimary)
                    .padding(.horizontal, AppSpacing.l)
                    .frame(minHeight: AppSpacing.minTapTarget)
                    .background(AppColor.bgElevated, in: Capsule())
            }
            .buttonStyle(PressableButtonStyle())
        }
        .padding(.horizontal, AppSpacing.screenMargin)
        .padding(.vertical, AppSpacing.s)
        .background(AppColor.bgBase)
    }

    private var mapArea: some View {
        ZStack(alignment: .bottom) {
            Map(position: $cameraPosition, selection: $selectedPoiId) {
                mapContent(markers: tourMarkers)
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
            .mapControls {
                MapCompass()
                MapScaleView()
            }
            .accessibilityIgnoresInvertColors()

            VStack(alignment: .leading, spacing: AppSpacing.l) {
                if voiceOverEnabled { MapSummaryBanner(text: accessibilitySummary) }
                Spacer(minLength: 0)
                if env.location.authorization == .denied {
                    ErrorStripe(message: L10n.string("map.locationDenied", lang: uiLanguage), actionTitle: "map.openSettings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                }
                HStack(alignment: .bottom, spacing: AppSpacing.m) {
                    MapLocationButton(isFollowing: cameraPosition.followsUserLocation) { locateMe() }
                    Spacer(minLength: 0)
                    if let routeLine {
                        MapRouteInfoPill(line: routeLine, uiLanguage: uiLanguage, locale: locale)
                    }
                }
                nearbyCard
            }
            .padding(.horizontal, AppSpacing.screenMargin)
            .padding(.top, AppSpacing.s)
            .padding(.bottom, AppSpacing.l)
        }
        .accessibilityRotor(Text("map.rotor.places")) {
            ForEach(sorted, id: \.poi.id) { item in
                AccessibilityRotorEntry(Text(item.poi.title), id: item.poi.id, in: rotorNamespace)
            }
        }
    }

    /// Rekkefølgen er tegnerekkefølgen: turrute og lydsoner under, valgt
    /// rute over dem, markørene øverst.
    @MapContentBuilder
    private func mapContent(markers: MapTourMarkers) -> some MapContent {
        UserAnnotation()
        MapTourOverlays.content(tourPois: env.store.pois, zonePois: filteredPois, routeLine: routeLine)
        ForEach(sorted, id: \.poi.id) { item in
            Annotation(item.poi.title, coordinate: item.poi.coordinate.clCoordinate) {
                POIMarker(
                    poi: item.poi,
                    isHighlighted: item.poi.id == highlighted?.poi.id,
                    distanceM: item.distanceM,
                    locale: locale,
                    status: markers.status(for: item.poi.id),
                    uiLanguage: uiLanguage
                ) {
                    selectedPoiId = item.poi.id
                }
                .accessibilityRotorEntry(id: item.poi.id, in: rotorNamespace)
            }
            .tag(item.poi.id)
            .annotationTitles(.hidden)
        }
    }

    @ViewBuilder
    private var nearbyCard: some View {
        switch env.store.state {
        case .loading, .idle:
            RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                .fill(AppColor.bgSurface)
                .frame(height: 104)
                .redacted(reason: .placeholder)
                .accessibilityLabel(Text("state.loading"))
        case let .failed(message):
            ErrorStripe(message: message, actionTitle: "action.retry") {
                Task { await env.store.load(lang: env.settings.guideLanguage) }
            }
        case .loaded:
            if let item = highlighted, isWithinReach(item.distanceM) {
                NearbyCard(
                    poi: item.poi,
                    distanceM: item.distanceM,
                    isLocked: env.isLocked(item.poi),
                    locale: locale,
                    onShowDirections: { path.append(Route.veiviser(.poi(id: item.poi.id))) }
                ) {
                    path.append(Route.poi(item.poi.id))
                }
                .shadow(color: .black.opacity(0.35), radius: 16, x: 0, y: 8)
            } else {
                nothingNearby
            }
        }
    }

    private var nothingNearby: some View {
        HStack {
            Text("map.nothingNearby")
                .font(AppFont.cardTitle)
                .foregroundStyle(AppColor.textPrimary)
            Spacer()
            Button("map.showDemoArea") {
                selectedPoiId = nil
                if let areaRegion { moveCamera(to: .region(areaRegion)) }
            }
            .font(AppFont.chip)
            .foregroundStyle(AppColor.accent)
            .minTapTarget()
        }
        .padding(AppSpacing.l)
        .frame(minHeight: 104)
        .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous).strokeBorder(contrast.border, lineWidth: 1))
    }

    /// Ingen POI innenfor 2 km → «Ingen severdigheter i nærheten» (6.2). Uten
    /// posisjon vises nærmeste etter backendens rekkefølge.
    private func isWithinReach(_ distanceM: Double?) -> Bool {
        guard let distanceM else { return true }
        return distanceM <= 2_000
    }
}

// MARK: - Posisjon og rute

extension MapView {
    /// Første trykk ber om tillatelse; kartet følger brukeren så snart den er
    /// gitt, uten å vente på et nytt trykk.
    private func locateMe() {
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

    /// Kamerabytter animeres ikke når «Reduser bevegelse» er på.
    private func moveCamera(to position: MapCameraPosition) {
        if reduceMotion {
            cameraPosition = position
        } else {
            withAnimation(.easeInOut(duration: 0.35)) { cameraPosition = position }
        }
    }

    private func updateRoute() {
        routeService.update(poi: showList ? nil : selectedPoi, origin: env.location.fix?.coordinate)
    }
}
