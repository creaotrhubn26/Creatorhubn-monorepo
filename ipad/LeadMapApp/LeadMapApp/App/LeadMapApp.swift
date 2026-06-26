// LeadMapApp.swift
//
// Entry point for native iPad Lead Map. Tynt SwiftUI-lag over
// /api/admin-room/lead-map/* — samme backend som web.

import SwiftUI
import UIKit
@preconcurrency import UserNotifications

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
            // Real-time WebSocket-subscriber (PR #874 backend).
            // Supplerer eksisterende polling — gjør at NBA-push, lead-score
            // og followup.due dukker opp umiddelbart uten å vente på neste
            // polling-tick.
            if let token = appState.authToken,
               let orgId = appState.activeOrganizationId {
                LeadgridRealtimeClient.shared.connect(
                    baseURL: APIClient.baseURL,
                    token: token,
                    channels: ["org:\(orgId)"]
                )
            }
        }
        .onChange(of: appState.authToken) { _, newValue in
            if newValue != nil {
                appState.startLeadgridPolling()
                if let token = newValue,
                   let orgId = appState.activeOrganizationId {
                    LeadgridRealtimeClient.shared.connect(
                        baseURL: APIClient.baseURL,
                        token: token,
                        channels: ["org:\(orgId)"]
                    )
                }
            } else {
                appState.stopLeadgridPolling()
                LeadgridRealtimeClient.shared.disconnect()
            }
        }
    }
}

/// Tabs (UX-overhaul 2026-06-25): I dag · Kart · Leads · Ruter · Mer.
/// Tidligere flate strukturen hadde 8+ topp-faner (Kart, Team, Varsler,
/// Leadgrid, Pitch, Org …) — det føltes som «Apple Maps med menyer».
/// «Mer»-fanen er en samle-flate (MoreTabView) som tar Varsler, Team,
/// Stille, Prosjekter, Innboks, Leadgrid, Pitch og Org. Per-flate
/// permission-gates beholdes inni MoreTabView.
struct MainTabView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        TabView {
            MyDayView()
                .tabItem { Label("I dag", systemImage: "sun.max.fill") }

            MapScreen()
                .tabItem { Label("Kart", systemImage: "map.fill") }

            // Lead-fokus: kø av tildelte leads med Claude-prioritet og
            // status. Vi bruker LeadgridFollowUpQueueView som finnes alt.
            LeadsTabHost()
                .tabItem { Label("Leads", systemImage: "person.crop.rectangle.stack.fill") }
                .badge(state.leadgridUnreadCount > 0 ? state.leadgridUnreadCount : 0)

            // Ruter — alt om dagens rute, plan og innsjekk.
            RoutesTabHost()
                .tabItem {
                    Label("Ruter", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                }

            // Mer — samler øvrige flater for å holde top-bar enkel.
            MoreTabView()
                .tabItem { Label("Mer", systemImage: "ellipsis.circle") }
                .badge(state.unreadNotificationsCount)
        }
    }
}

/// Samlefane med alt som tidligere lå som egne topp-tabs. Bygger en
/// kategorisert liste — hver rad navigerer til den eksisterende view'en
/// uendret, så vi ikke endrer hverken backend eller delflyter.
struct MoreTabView: View {
    @Environment(AppState.self) private var state
    @State private var importSheetOpen = false

    var body: some View {
        NavigationStack {
            List {
                Section("Aktivitet") {
                    NavigationLink {
                        NotificationsView()
                    } label: {
                        moreRow(icon: "bell.fill", color: .red, title: "Varsler",
                                badge: state.unreadNotificationsCount)
                    }
                    NavigationLink {
                        CalendarView()
                    } label: {
                        moreRow(icon: "calendar", color: .blue, title: "Kalender")
                    }
                    NavigationLink {
                        StaleLeadsList()
                    } label: {
                        moreRow(icon: "bell.badge", color: .orange, title: "Stille leads")
                    }
                }
                Section("Team & marked") {
                    NavigationLink {
                        LeaderboardView()
                    } label: {
                        moreRow(icon: "trophy.fill", color: .yellow, title: "Team")
                    }
                    if state.permissions.contains("leads.view") {
                        NavigationLink {
                            ProjectsPortfolioView()
                        } label: {
                            moreRow(icon: "rectangle.stack.fill", color: .purple,
                                    title: "Prosjekter")
                        }
                    }
                    if state.permissions.contains("marketing.deliveries.execute") {
                        NavigationLink {
                            MarketingInboxView()
                        } label: {
                            moreRow(icon: "tray.fill", color: .indigo, title: "Innboks")
                        }
                    }
                    NavigationLink {
                        LeadgridHubView()
                    } label: {
                        moreRow(icon: "person.crop.rectangle.stack.fill", color: .purple,
                                title: "Leadgrid",
                                badge: state.leadgridUnreadCount > 0 ? state.leadgridUnreadCount : 0)
                    }
                }
                if state.permissions.contains("pitch_deck.access"),
                   let orgId = state.activeOrganizationId {
                    Section("Salg") {
                        NavigationLink {
                            PitchDeckStudioView(
                                organizationId: orgId,
                                permissions: state.permissions
                            )
                        } label: {
                            moreRow(icon: "rectangle.stack.fill", color: .purple,
                                    title: "Pitch Deck")
                        }
                    }
                }
                Section("Data") {
                    Button {
                        importSheetOpen = true
                    } label: {
                        moreRow(icon: "square.and.arrow.down.fill", color: .purple,
                                title: "Importer leads")
                    }
                    .buttonStyle(.plain)
                }
                Section("Innstillinger") {
                    NavigationLink {
                        OrgSettingsView()
                    } label: {
                        moreRow(icon: "building.2.fill", color: .gray, title: "Organisasjon")
                    }
                }
            }
            .navigationTitle("Mer")
            .sheet(isPresented: $importSheetOpen) {
                LeadgridImportSheet()
            }
        }
    }

    @ViewBuilder
    private func moreRow(
        icon: String,
        color: Color,
        title: String,
        badge: Int = 0
    ) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(color.opacity(0.9), in: RoundedRectangle(cornerRadius: 6))
            Text(title).font(.body)
            Spacer()
            if badge > 0 {
                Text("\(badge)")
                    .font(.caption.bold())
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.red, in: Capsule())
                    .foregroundStyle(.white)
            }
        }
    }
}

/// Host som ekstraherer APIClient fra AppState og wrapper det i en
/// NavigationStack — slik at de eksisterende view'ene som krever
/// `api: APIClient` (LeadgridFollowUpQueueView, LeadgridRoutePlannerView)
/// kan brukes direkte som tabs uten å endre signaturen deres.
struct LeadsTabHost: View {
    @Environment(AppState.self) private var state

    var body: some View {
        NavigationStack {
            if let api = state.api {
                LeadgridFollowUpQueueView(api: api)
                    .navigationTitle("Leads")
            } else {
                ContentUnavailableView(
                    "Logger inn …",
                    systemImage: "person.crop.rectangle.stack",
                    description: Text("Vent et øyeblikk mens vi henter dine leads.")
                )
            }
        }
    }
}

struct RoutesTabHost: View {
    @Environment(AppState.self) private var state

    var body: some View {
        NavigationStack {
            if let api = state.api {
                LeadgridRoutePlannerView(api: api)
                    .navigationTitle("Ruter")
            } else {
                ContentUnavailableView(
                    "Logger inn …",
                    systemImage: "point.topleft.down.to.point.bottomright.curvepath",
                    description: Text("Vent et øyeblikk mens vi henter dine ruter.")
                )
            }
        }
    }
}
