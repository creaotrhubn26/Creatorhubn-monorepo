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
                .environment(NetworkMonitor.shared)
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

    /// Brukeren tap-pet et varsel. Route deep-link basert på event_type.
    /// Leadgrid v2-events (PR #748): lead_assigned_as_team_leader,
    ///   lead_assigned_as_rep, lead_assigned_on_accept, lead_won,
    ///   lead_lost, lead_status_change.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping @Sendable () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let eventType = userInfo["event_type"] as? String ?? ""

        // Leadgrid v2-events → presenter Leadgrid-inbox eller refresh state
        let isLeadgridEvent = eventType.hasPrefix("lead_assigned")
                            || eventType == "lead_won"
                            || eventType == "lead_lost"
                            || eventType == "lead_status_change"

        if isLeadgridEvent {
            // Snap ut Sendable-felter FØR task-grensen (Swift 6 strict).
            // userInfo som dictionary er ikke Sendable, men individuelle
            // String-felter er det.
            let leadId = userInfo["lead_id"] as? String
            let deepLink = userInfo["deep_link"] as? String
            let safeEventType = eventType
            Task { @MainActor in
                var payload: [String: String] = ["event_type": safeEventType]
                if let leadId { payload["lead_id"] = leadId }
                if let deepLink { payload["deep_link"] = deepLink }
                NotificationCenter.default.post(
                    name: .leadgridNotificationTapped,
                    object: nil,
                    userInfo: payload,
                )
            }
        }
        completionHandler()
    }
}

/// NotificationCenter-events som broadcastes når APNS-varsel tap-pes.
/// Aktive SwiftUI-views (typisk LeadgridHubView) lytter på dette og
/// presenter relevant sheet.
extension Notification.Name {
    /// Brukeren tap-pet et Leadgrid-varsel. userInfo har 'event_type' og
    /// muligens 'lead_id' / 'deep_link'.
    static let leadgridNotificationTapped =
        Notification.Name("LeadMapApp.leadgridNotificationTapped")
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
            // Start Leadgrid-polling så snart auth er på plass.
            if appState.api != nil {
                appState.startLeadgridPolling()
            }
            // Robusthet-pakke 3: drain offline-køen ved app-start hvis online,
            // og sett opp connectivity-restore-handler.
            if let api = appState.api {
                let result = await OfflineActionQueue.shared.drain(api: api)
                if result.success > 0 || result.failed > 0 {
                    print("[offline-queue] drained at boot: \(result.success) ok, \(result.failed) failed")
                }
            }
            NetworkMonitor.shared.onConnectivityRestored = {
                Task {
                    guard let api = appState.api else { return }
                    let result = await OfflineActionQueue.shared.drain(api: api)
                    print("[offline-queue] drained on reconnect: \(result.success) ok, \(result.failed) failed")
                }
            }
        }
        .onChange(of: appState.authToken) { _, newValue in
            if newValue != nil {
                appState.startLeadgridPolling()
            } else {
                appState.stopLeadgridPolling()
            }
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
            // Portefølje — alle kundeprosjekter med logo, Leadgrid-score,
            // needs/signals-aggregat. Vises hvis bruker har leads.view.
            if state.permissions.contains("leads.view") {
                ProjectsPortfolioView()
                    .tabItem { Label("Prosjekter", systemImage: "rectangle.stack.fill") }
            }
            // Markedsfører-innboks — focus_requests fra klient
            if state.permissions.contains("marketing.deliveries.execute") {
                MarketingInboxView()
                    .tabItem { Label("Innboks", systemImage: "tray.fill") }
            }
            LeaderboardView()
                .tabItem { Label("Team", systemImage: "trophy.fill") }
            NotificationsView()
                .tabItem {
                    Label("Varsler", systemImage: "bell.fill")
                }
                .badge(state.unreadNotificationsCount)
            // Leadgrid CRM-hub (PR #760+) — paritet m/ web /api/leadgrid/*
            LeadgridHubView()
                .tabItem { Label("Leadgrid", systemImage: "person.crop.rectangle.stack.fill") }
                .badge(state.leadgridUnreadCount > 0 ? state.leadgridUnreadCount : 0)
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
