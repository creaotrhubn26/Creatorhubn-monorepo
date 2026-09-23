// MapView.swift
//
// Kart (UI-spesifikasjon 6.2): søk, filter-chips, MapKit med mørk stil,
// POI-markører, min posisjon, nærmeste-kort og «Liste»-knapp som bytter til
// MapListView (UU-krav 8.5).

import MapKit
import SwiftUI

struct MapView: View {
    @Binding var path: NavigationPath
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast

    @State private var searchText = ""
    @State private var selectedCategory: String?
    @State private var selectedPoiId: String?
    @State private var showList = false
    @State private var cameraPosition: MapCameraPosition = .automatic

    private var locale: Locale { env.settings.locale }

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

    private var chipItems: [(id: String?, label: String)] {
        var items: [(id: String?, label: String)] = [(id: nil, label: L10n.string("filter.all", lang: env.settings.uiLanguage))]
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
        .safeAreaInset(edge: .top, spacing: 0) {
            HStack {
                IconCircleButton(systemImage: "chevron.left", label: "action.back") {
                    if !path.isEmpty { path.removeLast() }
                }
                Spacer()
                Button {
                    showList.toggle()
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
        .onAppear {
            if let area = env.store.area {
                cameraPosition = .region(MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: area.center.lat, longitude: area.center.lng),
                    span: MKCoordinateSpan(latitudeDelta: 0.014, longitudeDelta: 0.02)
                ))
            }
        }
    }

    private var mapArea: some View {
        ZStack(alignment: .bottom) {
            Map(position: $cameraPosition, selection: $selectedPoiId) {
                UserAnnotation()
                ForEach(sorted, id: \.poi.id) { item in
                    Annotation(item.poi.title, coordinate: CLLocationCoordinate2D(latitude: item.poi.lat, longitude: item.poi.lng)) {
                        POIMarker(
                            poi: item.poi,
                            isHighlighted: item.poi.id == highlighted?.poi.id,
                            distanceM: item.distanceM,
                            locale: locale
                        ) {
                            selectedPoiId = item.poi.id
                        }
                    }
                    .tag(item.poi.id)
                    .annotationTitles(.hidden)
                }
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
            .mapControls {}
            .accessibilityIgnoresInvertColors()

            VStack(alignment: .leading, spacing: AppSpacing.l) {
                if env.location.authorization == .denied {
                    ErrorStripe(message: L10n.string("map.locationDenied", lang: env.settings.uiLanguage), actionTitle: "map.openSettings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                }
                HStack(alignment: .bottom) {
                    Button {
                        env.location.requestAndStart()
                        if let fix = env.location.fix {
                            cameraPosition = .region(MKCoordinateRegion(
                                center: CLLocationCoordinate2D(latitude: fix.coordinate.lat, longitude: fix.coordinate.lng),
                                span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.012)
                            ))
                        }
                    } label: {
                        Image(systemName: "location.fill")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(AppColor.onAccent)
                            .frame(width: 48, height: 48)
                            .background(AppColor.accent, in: Circle())
                            .shadow(color: .black.opacity(0.35), radius: 16, x: 0, y: 8)
                    }
                    .buttonStyle(PressableButtonStyle())
                    .accessibilityLabel(Text("map.showMyLocation"))
                    Spacer()
                }
                nearbyCard
            }
            .padding(.horizontal, AppSpacing.screenMargin)
            .padding(.bottom, AppSpacing.l)
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
                HStack {
                    Text("map.nothingNearby")
                        .font(AppFont.cardTitle)
                        .foregroundStyle(AppColor.textPrimary)
                    Spacer()
                    Button("map.showDemoArea") {
                        selectedPoiId = nil
                        if let area = env.store.area {
                            cameraPosition = .region(MKCoordinateRegion(
                                center: CLLocationCoordinate2D(latitude: area.center.lat, longitude: area.center.lng),
                                span: MKCoordinateSpan(latitudeDelta: 0.014, longitudeDelta: 0.02)
                            ))
                        }
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
        }
    }

    /// Ingen POI innenfor 2 km → «Ingen severdigheter i nærheten» (6.2). Uten
    /// posisjon vises nærmeste etter backendens rekkefølge.
    private func isWithinReach(_ distanceM: Double?) -> Bool {
        guard let distanceM else { return true }
        return distanceM <= 2_000
    }
}

/// Kartmarkør (5.6): sirkel 56 pt (68 for valgt/nærmeste) med bilde og accent-ring.
struct POIMarker: View {
    let poi: GuidePOI
    let isHighlighted: Bool
    let distanceM: Double?
    let locale: Locale
    let action: () -> Void

    private var size: CGFloat { isHighlighted ? 68 : 56 }

    var body: some View {
        Button(action: action) {
            VStack(spacing: -2) {
                RemoteImage(url: poi.heroImageUrl)
                    .frame(width: size, height: size)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(AppColor.accent.opacity(isHighlighted ? 1 : 0.7), lineWidth: isHighlighted ? 4 : 3))
                Image(systemName: "triangle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(AppColor.accent)
                    .rotationEffect(.degrees(180))
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(markerLabel))
        .accessibilityHint(Text("map.markerHint"))
    }

    private var markerLabel: String {
        if let distanceM {
            return "\(poi.title), \(L10n.distance(meters: distanceM, locale: locale))"
        }
        return poi.title
    }
}
