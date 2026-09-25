// MapView+Content.swift
//
// Header, selve kartet (med markørene) og nærmeste-kortet — flyttet ut av
// MapView.swift for å holde den fila under SwiftLint sin
// type_body_length-grense (samme mønster som
// Features/Player/PlayerViewModel+Playback.swift). Bruker MapView sine
// interne (ikke private) lagrede/utledede verdier, se MapView.swift.

import MapKit
import SwiftUI

extension MapView {
    /// Direkte-avspill (item 5): paywall i stedet for avspilling når stedet er låst.
    func play(_ poi: GuidePOI) {
        if env.isLocked(poi) {
            paywallPoi = poi
        } else {
            env.player.start(poi: poi)
        }
    }

    var header: some View {
        HStack {
            IconCircleButton(systemImage: "chevron.left", label: "action.back") {
                if !path.isEmpty { path.removeLast() }
            }
            Spacer()
            // Tur-modus (pakke 2, item 3): liten «fortsett turen»-snarvei her
            // også, så brukeren ikke må tilbake til Utforsk for å plukke opp igjen.
            if env.tourMode.isActive {
                IconCircleButton(systemImage: "figure.walk.motion", label: "tour.resume") {
                    env.resumeTour()
                }
            }
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

    var mapArea: some View {
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
    func mapContent(markers: MapTourMarkers) -> some MapContent {
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
                    uiLanguage: uiLanguage,
                    eta: eta(for: item)
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
    var nearbyCard: some View {
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
                    eta: eta(for: item),
                    onShowDirections: { path.append(Route.veiviser(.poi(id: item.poi.id))) },
                    onPlay: { play(item.poi) }
                ) {
                    path.append(Route.poi(item.poi.id))
                }
                .shadow(color: .black.opacity(0.35), radius: 16, x: 0, y: 8)
            } else {
                nothingNearby
            }
        }
    }

    var nothingNearby: some View {
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
