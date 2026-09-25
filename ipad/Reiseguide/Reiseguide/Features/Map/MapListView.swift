// MapListView.swift
//
// Listevisning som fullverdig alternativ til kartet (UU-krav 8.5): de samme
// severdighetene som kort, sortert etter avstand. Filter-chips gjelder for
// begge visninger. Hver rad har en direkte-avspill-knapp (avspiller-
// redesignet, item 5, «Færre trykk til lyd») ved siden av hovedknappen, som
// respekterer låsen akkurat som detaljsiden.

import SwiftUI

struct MapListView: View {
    let items: [(poi: GuidePOI, distanceM: Double?)]
    let locale: Locale
    let onSelect: (GuidePOI) -> Void

    @Environment(AppEnvironment.self) private var env
    @State private var paywallPoi: GuidePOI?

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
                    NearbyCard(
                        poi: item.poi,
                        distanceM: item.distanceM,
                        isLocked: env.isLocked(item.poi),
                        locale: locale,
                        onPlay: { play(item.poi) }
                    ) {
                        onSelect(item.poi)
                    }
                }
            }
            .padding(.horizontal, AppSpacing.screenMargin)
            .padding(.bottom, AppSpacing.xl)
        }
        .accessibilityLabel(Text("map.listLabel"))
        .sheet(item: $paywallPoi) { poi in
            MockPaywallSheet(areaId: poi.areaId)
        }
    }

    private func play(_ poi: GuidePOI) {
        if env.isLocked(poi) {
            paywallPoi = poi
        } else {
            env.player.start(poi: poi)
        }
    }
}
