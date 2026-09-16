// AeroSpotApp.swift — app-entry: TabView med Hjem / Live / Kamera /
// Loggbok / Profil. Mørk navy premium-look via Theme.

import SwiftUI

@main
struct AeroSpotApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(.dark)
                .task { model.start() }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            HomeView()
                .tabItem { Label("Hjem", systemImage: "house.fill") }.tag(0)
            LiveMapView()
                .tabItem { Label("Live", systemImage: "location.viewfinder") }.tag(1)
            EventsView()
                .tabItem { Label("Arrangementer", systemImage: "calendar") }.tag(2)
            CameraAssistView()
                .tabItem { Label("Kamera", systemImage: "camera.fill") }.tag(3)
            LogbookView()
                .tabItem { Label("Loggbok", systemImage: "book.fill") }.tag(4)
        }
        .tint(Theme.primaryBright)
        .sheet(item: $model.selectedLocation) { location in
            SpottingLocationSheet(location: location)
                .presentationDetents([.medium, .large])
                .presentationBackground(Theme.surface)
        }
    }
}

extension SpottingLocation: Equatable {
    static func == (lhs: SpottingLocation, rhs: SpottingLocation) -> Bool {
        lhs.id == rhs.id
    }
}
