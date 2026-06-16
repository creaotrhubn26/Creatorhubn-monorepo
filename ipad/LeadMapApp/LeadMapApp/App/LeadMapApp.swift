// LeadMapApp.swift
//
// Entry point for native iPad Lead Map. Tynt SwiftUI-lag over
// /api/admin-room/lead-map/* — samme backend som web.

import SwiftUI

@main
struct LeadMapApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .preferredColorScheme(.dark)
        }
    }
}

/// Rotvisning bestemmer hvilken skjerm som rendres basert på auth-state.
struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isAuthenticated {
                MainTabView()
            } else {
                PairingView()
            }
        }
        .task {
            await appState.bootstrap()
        }
    }
}

/// Tabs: Min dag (default) + Kart + Org. Etablert i v1 (PR #618).
struct MainTabView: View {
    var body: some View {
        TabView {
            MyDayView()
                .tabItem { Label("Min dag", systemImage: "sun.max.fill") }
            MapScreen()
                .tabItem { Label("Kart", systemImage: "map.fill") }
            OrgSettingsView()
                .tabItem { Label("Org", systemImage: "building.2.fill") }
        }
    }
}
