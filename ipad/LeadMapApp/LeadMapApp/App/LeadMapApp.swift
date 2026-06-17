// LeadMapApp.swift
//
// Entry point for native iPad Lead Map. Tynt SwiftUI-lag over
// /api/admin-room/lead-map/* — samme backend som web.

import SwiftUI
import UIKit
import UserNotifications

@main
struct LeadMapApp: App {
    @State private var appState = AppState()
    @UIApplicationDelegateAdaptor(NotificationAppDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .preferredColorScheme(.dark)
                .onAppear {
                    NotificationAppDelegate.appStateRef = appState
                }
        }
    }
}

/// AppDelegate-shim som håndterer APNs device-token-registrering.
/// SwiftUI får tilgang til AppState via statisk `appStateRef`.
final class NotificationAppDelegate: NSObject, UIApplicationDelegate {
    static weak var appStateRef: AppState?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        // Be om push-permission + register for APNs
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        // Send til backend
        Task { @MainActor in
            guard let api = NotificationAppDelegate.appStateRef?.api else { return }
            try? await api.registerDeviceToken(
                token: tokenString,
                platform: "apns",
                deviceName: UIDevice.current.name,
                appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
            )
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("[APNs] Registrering feilet: \(error.localizedDescription)")
    }
}

extension NotificationAppDelegate: UNUserNotificationCenterDelegate {
    /// Vis varsel selv om app er i forgrunnen.
    /// Tar nonisolated for å unngå non-Sendable cross-actor-call på
    /// UNUserNotificationCenter + UNNotification (Swift 6).
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping @Sendable (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
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

/// Tabs: Min dag (default) + Kart + Team + Varsler + (Pitch hvis tillatt) + Org.
/// Pitch Deck-fanen vises kun hvis innlogget bruker har
/// "pitch_deck.access" i org'en — gjør at en org kan skru funksjonen
/// av/på via per-role-defaults eller per-bruker overstyringer uten at
/// vi trenger en feature-flag i Xcode-buildet.
struct MainTabView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        TabView {
            MyDayView()
                .tabItem { Label("Min dag", systemImage: "sun.max.fill") }
            MapScreen()
                .tabItem { Label("Kart", systemImage: "map.fill") }
            LeaderboardView()
                .tabItem { Label("Team", systemImage: "trophy.fill") }
            NotificationsView()
                .tabItem {
                    Label("Varsler", systemImage: "bell.fill")
                }
                .badge(state.unreadNotificationsCount)
            if state.permissions.contains("pitch_deck.access"),
               let orgId = state.activeOrganizationId {
                PitchDeckStudioView(
                    organizationId: orgId,
                    permissions: state.permissions
                )
                .tabItem { Label("Pitch", systemImage: "rectangle.stack.fill") }
            }
            OrgSettingsView()
                .tabItem { Label("Org", systemImage: "building.2.fill") }
        }
    }
}
