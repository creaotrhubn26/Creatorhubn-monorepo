// MapListView.swift
//
// Listevisning som fullverdig alternativ til kartet (UU-krav 8.5): de samme
// severdighetene som kort, sortert etter avstand. Filter-chips gjelder for
// begge visninger.

import SwiftUI

struct MapListView: View {
    let items: [(poi: GuidePOI, distanceM: Double?)]
    let locale: Locale
    let onSelect: (GuidePOI) -> Void

    @Environment(AppEnvironment.self) private var env

    var body: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.m) {
                if items.isEmpty {
                    Text("map.nothingNearby")
                        .font(AppFont.body)
                        .foregroundStyle(AppColor.textSecondary)
                        .padding(.top, AppSpacing.xl)
                }
                ForEach(items, id: \.poi.id) { item in
                    NearbyCard(poi: item.poi, distanceM: item.distanceM, isLocked: env.isLocked(item.poi), locale: locale) {
                        onSelect(item.poi)
                    }
                }
            }
            .padding(.horizontal, AppSpacing.screenMargin)
            .padding(.bottom, AppSpacing.xl)
        }
        .accessibilityLabel(Text("map.listLabel"))
    }
}
