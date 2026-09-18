// ReiseguideApp.swift
//
// Lydguide-POC «Interaktiv reiseguide med tilgjengelighet». Native iPhone-app
// i SwiftUI (iOS 17+) mot /api/guide/* i Creatorhubn-backend. Designet er
// Konsept 2 «Dark Mode / Premium» (UI-spesifikasjon 18.09.2026): appen er låst
// til mørkt tema, og UI-språket følger språkvelgeren.

import SwiftUI

@main
struct ReiseguideApp: App {
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
        }
    }
}

struct RootTabView: View {
    @Environment(AppEnvironment.self) private var env
    @State private var explorePath = NavigationPath()

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
        TabView {
            NavigationStack(path: $explorePath) {
                ExploreView(path: $explorePath)
                    .navigationDestination(for: Route.self) { route in
                        switch route {
                        case .map:
                            MapView(path: $explorePath)
                        case let .poi(id):
                            POIDetailView(poiId: id, path: $explorePath)
                        }
                    }
            }
            .tabItem { Label("tab.explore", systemImage: "house") }

            NavigationStack {
                MyPlacesView()
            }
            .tabItem { Label("tab.myPlaces", systemImage: "heart") }

            NavigationStack {
                SettingsView()
            }
            .tabItem { Label("tab.settings", systemImage: "gearshape") }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if env.player.hasContent && !env.player.isPresented {
                MiniPlayerBar()
            }
        }
        .fullScreenCover(isPresented: Bindable(env.player).isPresented) {
            PlayerView()
        }
    }
}
