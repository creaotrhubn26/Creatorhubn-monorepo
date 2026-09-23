// ReiseguideApp.swift
//
// Lydguide-POC «Interaktiv reiseguide med tilgjengelighet». Native iPhone-app
// i SwiftUI (iOS 17+) mot /api/guide/* i Creatorhubn-backend. Designet er
// Konsept 2 «Dark Mode / Premium» (UI-spesifikasjon 18.09.2026): appen er låst
// til mørkt tema, og UI-språket følger språkvelgeren.

import SwiftUI

@main
struct ReiseguideApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var environment = AppEnvironment()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(environment)
                .environment(\.locale, Locale(identifier: environment.settings.uiLanguage))
                .preferredColorScheme(.dark)
                .tint(AppColor.accent)
                .task(id: environment.settings.guideLanguage) {
                    await environment.store.loadIfNeeded(lang: environment.settings.guideLanguage)
                }
                .onOpenURL { url in
                    environment.handle(url: url)
                }
                .onChange(of: scenePhase) { _, phase in
                    // Besøk som ikke kom fram (uten nett) sendes når appen er i forgrunnen igjen.
                    if phase == .active {
                        Task { await environment.visitSync.flush() }
                    }
                }
        }
    }
}

enum AppTab: Hashable {
    case explore, myPlaces, settings
}

struct RootTabView: View {
    @Environment(AppEnvironment.self) private var env
    @State private var explorePath = NavigationPath()
    @State private var selectedTab: AppTab = .explore

    init() {
        // Tab bar: bgBase med 0,5 pt topplinje i border (5.9).
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(AppColor.bgBase)
        appearance.shadowColor = UIColor(AppColor.border)
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack(path: $explorePath) {
                ExploreView(path: $explorePath)
                    .navigationDestination(for: Route.self) { route in
                        switch route {
                        case .map:
                            MapView(path: $explorePath)
                        case let .poi(id):
                            POIDetailView(poiId: id, path: $explorePath)
                        case let .veiviser(target):
                            VeiviserView(target: target, path: $explorePath)
                        }
                    }
            }
            .tabItem { Label("tab.explore", systemImage: "house") }
            .tag(AppTab.explore)

            NavigationStack {
                MyPlacesView()
            }
            .tabItem { Label("tab.myPlaces", systemImage: "heart") }
            .tag(AppTab.myPlaces)

            NavigationStack {
                SettingsView()
            }
            .tabItem { Label("tab.settings", systemImage: "gearshape") }
            .tag(AppTab.settings)
        }
        .onChange(of: env.pendingPoi) { _, _ in openPendingPoi() }
        .onChange(of: env.store.pois.count) { _, _ in openPendingPoi() }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if env.player.hasContent && !env.player.isPresented {
                MiniPlayerBar()
            }
        }
        .fullScreenCover(isPresented: Bindable(env.player).isPresented) {
            PlayerView()
        }
    }

    /// Deep link eller «liknende i nærheten»: hopp til Utforsk og vis stedet.
    private func openPendingPoi() {
        guard let poi = env.resolvePendingPoi() else { return }
        env.pendingPoi = nil
        selectedTab = .explore
        explorePath = NavigationPath([Route.poi(poi.id)])
    }
}
