// MyPlacesView.swift
//
// «Mine steder»: favoritter lagret lokalt (AppSettings.favoritePoiIds).

import SwiftUI

struct MyPlacesView: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @State private var selectedPoiId: String?

    private var favorites: [GuidePOI] {
        env.store.pois.filter { env.settings.isFavorite(poiId: $0.id) }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.m) {
                if favorites.isEmpty {
                    VStack(spacing: AppSpacing.m) {
                        Image(systemName: "heart")
                            .font(.largeTitle)
                            .foregroundStyle(contrast.textTertiary)
                            .accessibilityHidden(true)
                        Text("myPlaces.empty")
                            .font(AppFont.body)
                            .foregroundStyle(contrast.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, AppSpacing.xxl)
                }
                ForEach(favorites) { poi in
                    NearbyCard(poi: poi, distanceM: nil, isLocked: env.isLocked(poi), locale: env.settings.locale) {
                        selectedPoiId = poi.id
                    }
                }
            }
            .padding(AppSpacing.screenMargin)
        }
        .background(AppColor.bgBase)
        .navigationTitle("tab.myPlaces")
        .toolbarBackground(AppColor.bgBase, for: .navigationBar)
        .navigationDestination(item: $selectedPoiId) { id in
            POIDetailStandalone(poiId: id)
        }
    }
}

/// Detaljside åpnet utenfor Utforsk-stacken (fra Mine steder). Tom
/// NavigationPath: tilbake-knappen i POIDetailView faller da til dismiss.
struct POIDetailStandalone: View {
    let poiId: String
    @State private var path = NavigationPath()

    var body: some View {
        POIDetailView(poiId: poiId, path: $path)
    }
}
