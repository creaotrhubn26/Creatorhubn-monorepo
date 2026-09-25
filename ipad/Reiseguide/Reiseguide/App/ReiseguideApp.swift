// ReiseguideApp.swift
//
// Lydguide-POC «Interaktiv reiseguide med tilgjengelighet». Native iPhone-app
// i SwiftUI (iOS 17+) mot /api/guide/* i Creatorhubn-backend. Designet er
// Konsept 2 «Dark Mode / Premium» (UI-spesifikasjon 18.09.2026): appen er låst
// til mørkt tema, og UI-språket følger språkvelgeren.

import SwiftUI
import UserNotifications

@main
struct ReiseguideApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var environment: AppEnvironment

    // AppEnvironment lages i init, ikke som en ren @State-standardverdi, for
    // å garantere at ReiseguideIntentBridge (pakke 2, item 6) er registrert
    // FØR et App Intent med `openAppWhenRun: true` kan kjøre `perform()` —
    // samme rekkefølge-garanti som AppStateBridge i LeadMapApp.
    init() {
        let env = AppEnvironment()
        self._environment = State(wrappedValue: env)
        MainActor.assumeIsolated {
            ReiseguideIntentBridge.shared.register(env)
            // Bakgrunnsvarsel (pakke 2, item 2): «Spill av»-handlingen.
            UNUserNotificationCenter.current().delegate = ArrivalNotificationDelegate.shared
        }
    }

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(environment)
                .environment(\.locale, Locale(identifier: environment.settings.uiLanguage))
                .preferredColorScheme(.dark)
                .tint(AppColor.accent)
                // Lastes på nytt når språket eller området (områdevelgeren) byttes.
                .task(id: AreaLoadKey(slug: environment.store.slug, lang: environment.settings.guideLanguage)) {
                    await environment.store.loadIfNeeded(lang: environment.settings.guideLanguage)
                }
                .task {
                    await environment.prepareAreas()
                }
                .onOpenURL { url in
                    environment.handle(url: url)
                }
                .onChange(of: scenePhase) { _, phase in
                    // Besøk som ikke kom fram (uten nett) sendes når appen er i forgrunnen igjen.
                    if phase == .active {
                        Task { await environment.visitSync.flush() }
                        // Ny lyd og nye steder uten å starte appen på nytt.
                        Task { await environment.store.refreshIfStale(lang: environment.settings.guideLanguage) }
                    } else {
                        // «Fortsett der du slapp» (item 3): appen kan bli drept i
                        // bakgrunnen uten en eksplisitt pause eller lukking av spilleren.
                        environment.player.persistPlaybackPositionForBackground()
                    }
                }
        }
    }
}

/// Hva innholdet i AreaStore avhenger av: område og språk.
struct AreaLoadKey: Equatable {
    let slug: String
    let lang: String
}

enum AppTab: Hashable {
    case explore, myPlaces, settings
}

struct RootTabView: View {
    @Environment(AppEnvironment.self) private var env
    @State private var explorePath = NavigationPath()
    @State private var selectedTab: AppTab = .explore
    /// «Færre trykk til lyd» (item 5): framme-kortets «Spill av» respekterer
    /// låsen akkurat som detaljsiden, i stedet for å starte avspilling direkte.
    @State private var lockedArrivalPoi: GuidePOI?

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
        // Låst sted i framme-kortet (item 5): paywall i stedet for å starte
        // avspilling direkte, akkurat som detaljsiden.
        .sheet(item: $lockedArrivalPoi) { poi in
            MockPaywallSheet(areaId: poi.areaId)
        }
        // «Gå til neste stopp» (avspiller-redesignet, punkt 2): spilleren er
        // allerede lukket av `env.openVeiviser(to:)`; bare naviger hit.
        .onChange(of: env.pendingVeiviserTarget) { _, target in
            guard let target else { return }
            env.pendingVeiviserTarget = nil
            selectedTab = .explore
            explorePath.append(Route.veiviser(target))
        }
        // «Du er framme» (pakke 1, punkt 1): ren logikk i
        // Core/ProximityMonitor.swift og Core/ArrivalCoordinator.swift, bare
        // en liten hook her som driver den fra posisjonsoppdateringer.
        .overlay(alignment: .bottom) {
            if let card = env.arrival.card {
                ArrivalCardView(
                    card: card,
                    locale: env.settings.locale,
                    onPlay: { playArrivalCardPoi(card.poi) },
                    onDismiss: { env.arrival.dismissCard() }
                )
                .padding(.bottom, env.player.hasContent && !env.player.isPresented ? 64 : AppSpacing.s)
            }
        }
        .onChange(of: env.location.fix) { _, _ in
            env.reconcileArea()
            env.evaluateArrival()
            env.updateArrivalRegions()
        }
        // Nytt område: stedene i Utforsk-stacken hører til det gamle området.
        .onChange(of: env.store.slug) { _, _ in explorePath = NavigationPath() }
        .onChange(of: env.location.authorization) { _, _ in env.evaluateArrival() }
        .onChange(of: env.arrival.pendingAnnouncement) { _, poi in
            guard let poi else { return }
            // Ikke snakk over telefonens opplesning; kortet og haptikken kommer likevel.
            if !env.player.isReadingAloud {
                let message = L10n.string("arrival.announcement", lang: env.settings.uiLanguage).replacingOccurrences(of: "%@", with: poi.title)
                AccessibilityNotification.Announcement(message).post()
            }
            env.arrival.pendingAnnouncement = nil
        }
        .sensoryFeedback(trigger: env.arrival.pendingAnnouncement) { _, newValue in
            newValue != nil ? AppHaptics.feedback(.impact(weight: .heavy), enabled: env.settings.hapticsEnabled) : nil
        }
        // Turprogresjon (pakke 1, punkt 3): feiringen når siste sted er fullført.
        .onChange(of: env.visits.entries) { _, _ in
            env.evaluateTourProgress()
            env.evaluateTourMode()
        }
        .onChange(of: env.tourProgress.celebration) { _, newValue in
            guard newValue != nil else { return }
            let message = L10n.string("tour.celebration.title", lang: env.settings.uiLanguage)
            AccessibilityNotification.Announcement(message).post()
        }
        .sensoryFeedback(trigger: env.tourProgress.celebration) { _, newValue in
            newValue != nil ? AppHaptics.feedback(.success, enabled: env.settings.hapticsEnabled) : nil
        }
        .sheet(item: Bindable(env.tourProgress).celebration) { area in
            TourCelebrationView(area: area) {
                env.tourProgress.dismissCelebration()
            }
        }
    }

    /// Deep link eller «liknende i nærheten»: hopp til Utforsk og vis stedet.
    private func openPendingPoi() {
        guard let poi = env.resolvePendingPoi() else { return }
        env.pendingPoi = nil
        selectedTab = .explore
        explorePath = NavigationPath([Route.poi(poi.id)])
    }

    /// «Spill av»/«Bytt til …» på framme-kortet (item 5): respekter låsen
    /// akkurat som detaljsiden, i stedet for å starte avspilling direkte.
    private func playArrivalCardPoi(_ poi: GuidePOI) {
        if env.isLocked(poi) {
            lockedArrivalPoi = poi
        } else {
            env.arrival.playCardPoi()
        }
    }
}
