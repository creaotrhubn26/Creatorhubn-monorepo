// LeadgridWatchApp.swift
//
// watchOS-app entry-point. Single-target SwiftUI-app (Apple-anbefalt
// siden watchOS 7+ — ingen separat WatchKit-Extension).
//
// 3 features (roadmap #403):
//   1. NearbyLeadsView — leads sortert etter avstand fra GPS
//   2. QuickActionView — tap lead → marker visited/called/booked
//   3. LeadgridComplication — "12 leads i dag" på watch-face
//
// 4. feature (2026-07-01 Pondus overalt — trinn 1):
//   4. PondusLynkortView — mal-liste + steg + anbefalt tone (3 paged tabs)
//
// Data-flow: iPhone-appen pusher leads-snapshot via WatchConnectivity
// (PhoneSession.swift). Watch persisterer i UserDefaults så vi har data
// før første reload. Pondus-templates følger samme mønster via
// `pondus.templates.sync`-message.

import SwiftUI
import WatchConnectivity

@main
struct LeadgridWatchApp: App {
    @StateObject private var session = PhoneSession.shared
    @StateObject private var locationVM = WatchLocationModel()
    @State private var pondusStore = WatchPondusStore.shared

    var body: some Scene {
        WindowGroup {
            RootTabs()
                .environmentObject(session)
                .environmentObject(locationVM)
                .environment(pondusStore)
                .onAppear {
                    session.activate()
                    locationVM.requestPermission()
                    pondusStore.load()
                }
        }
    }
}

/// Rot-navigasjon på Watch: 3 tabs paged vertikalt/horisontalt
/// (avhenger av watchOS-versjon). Nearby leads + Quick action + Pondus.
struct RootTabs: View {
    @EnvironmentObject private var session: PhoneSession

    var body: some View {
        TabView {
            LeadsTabRoot()
            PondusLynkortView()
        }
        .tabViewStyle(.verticalPage)
    }
}

/// Første tab: Leads. Hvis vi ikke har data enda, vis empty state.
/// NearbyLeadsView router selv til QuickActionView ved tap.
struct LeadsTabRoot: View {
    @EnvironmentObject private var session: PhoneSession

    var body: some View {
        if session.leads.isEmpty {
            EmptyStateView()
        } else {
            NearbyLeadsView()
        }
    }
}
