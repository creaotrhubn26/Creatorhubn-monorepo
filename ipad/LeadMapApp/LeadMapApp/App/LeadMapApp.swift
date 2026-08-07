// LeadMapApp.swift
//
// Entry point for native iPad Lead Map. Tynt SwiftUI-lag over
// /api/admin-room/lead-map/* — samme backend som web.

import SwiftUI
import UIKit
@preconcurrency import UserNotifications

@main
struct LeadMapApp: App {
    @State private var appState: AppState

    // AppState opprettes i init for å garantere at AppStateBridge er
    // registrert FØR SwiftUI-scenens `body` evalueres første gang. Dette
    // er load-bearing for cold-start deep-linking: App Intent `.perform()`
    // med `openAppWhenRun: true` kan starte prosessen; når scene-init er
    // ferdig må bridge-en allerede peke på en gyldig AppState så
    // pending deep-link kan flush-es.
    init() {
        let state = AppState()
        self._appState = State(wrappedValue: state)
        // MainActor-isolert; init er MainActor-implisitt for @main App.
        MainActor.assumeIsolated {
            AppStateBridge.shared.register(state)
        }
    }
    @UIApplicationDelegateAdaptor(NotificationAppDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .environment(NetworkMonitor.shared)
                // Dark mode gjelder på alle plattformer inkl. Mac Catalyst.
                // Var tidligere gated til !macCatalyst, men da fikk topp-
                // menyen mørk bakgrunn + mørk system-tekst = usynlig text.
                .preferredColorScheme(.dark)
                // Mac Catalyst: minste vindusstørrelse 1024×768.
                // Under dette blir Leadgrid-layouten trang (KPI-rad + kart
                // + sidebar). No-op på iPhone/iPad hvor systemet styrer.
                .macCatalystMinFrame()
                .onAppear {
                    NotificationAppDelegate.appStateRef = appState
                    // Krasjrapportering (2026-07-18): MetricKit-abonnement —
                    // iOS leverer krasj/heng-diagnostikk ved neste oppstart.
                    CrashReporterService.shared.start()
                    // Flush eventuell buffret Pondus-deep-link fra en Intent
                    // som kjørte før scene-init var ferdig.
                    AppStateBridge.shared.flushPendingDeepLinks()
                    // Apple Watch-bro: aktiver + koble transkript-analyse fra
                    // klokka til den delte TranscriptIntelligence (on-device
                    // på telefonen, ellers backend). watchOS < 27 har ikke
                    // Foundation Models, så klokka relayer hit.
                    WatchSession.shared.activate()
                    WatchSession.shared.onTranscriptRequest = { leadId, transcript in
                        guard let api = appState.api else { return nil }
                        let intel = TranscriptIntelligenceFactory.make(api: api, leadId: leadId)
                        return try? await intel.analyze(transcript: transcript, leadName: "")
                    }
                    // MapKit SwiftUI-`Map` respekterer IKKE preferredColorScheme
                    // — flisene følger vinduets UITraitCollection. Uten dette
                    // fikk kart-fanene lyse fliser når systemet sto i lys modus
                    // (resten av appen er mørk-tvunget). Sett vindus-override.
                    Self.forceDarkWindows()
                }
                // Re-apply ved hver aktivering — nye vinduer (iPad multi-
                // window, Catalyst sekundær-vinduer) opprettet etter første
                // onAppear ville ellers mangle override → lyse kart-fliser.
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Self.forceDarkWindows()
                        sendPresenceCheckin()
                        // Flush bufrede krasjrapporter når API-klient finnes.
                        if let api = appState.api {
                            CrashReporterService.shared.flush(api: api)
                        }
                    }
                }
        }
    }
    @Environment(\.scenePhase) private var scenePhase

    /// «Sist aktiv i Leadgrid» (2026-07-18): puls ved app-aktivering i ekte
    /// modus — driver utstyrsregisterets serienr → innehaver → posisjon-
    /// kobling (appen kan ikke lese serienummer; tildelingen er broen).
    /// Posisjon sendes KUN når appen allerede har en fix (ingen ny
    /// tillatelses-prompt). Fire-and-forget — feiler stille.
    private func sendPresenceCheckin() {
        guard !DemoModeManager.isActiveNonisolated,
              let api = appState.api else { return }
        let coord = KartLocationManager.shared.currentCoordinate
        let version = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? ""
        let model = UIDevice.current.model + " (" + UIDevice.current.systemVersion + ")"
        Task.detached(priority: .utility) {
            try? await api.presenceCheckin(
                lat: coord?.latitude, lng: coord?.longitude,
                deviceModel: model, appVersion: version)
        }
    }

    /// Tvinger `overrideUserInterfaceStyle = .dark` på alle tilkoblede
    /// vinduer så MapKit-flisene alltid er mørke, uansett system-appearance.
    private static func forceDarkWindows() {
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            for window in windowScene.windows {
                window.overrideUserInterfaceStyle = .dark
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

        // Notification-QA 2026-07-06: ALLE varsel-tap rutes nå (åpner
        // inboksen), ikke bare ett hardkodet event-vokabular. Backend har
        // TO parallelle varsel-systemer (lead-map + leadgrid) med ulike
        // event_type-navn; den gamle prefiks-testen droppet halvparten
        // (lead_status_changed, lead_won_on_team, follow_up_due,
        // approaching_lead) stille → tap gjorde ingenting. Vi ruter alt
        // som har et event_type ELLER en lead_id.
        let leadId = userInfo["lead_id"] as? String
        let hasRoutable = !eventType.isEmpty || leadId != nil

        if hasRoutable {
            // Snap ut Sendable-felter FØR task-grensen (Swift 6 strict).
            let deepLink = userInfo["deep_link"] as? String
            let safeEventType = eventType
            Task { @MainActor in
                var payload: [String: String] = ["event_type": safeEventType]
                if let leadId { payload["lead_id"] = leadId }
                if let deepLink { payload["deep_link"] = deepLink }
                // Buffer via bridge: et cold-start-tap fyrer FØR noe view
                // abonnerer → gikk tapt før. Bridge-en deployer så snart en
                // header monteres.
                AppStateBridge.shared.handleNotificationTap(payload)
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
/// På iPad-landscape (regular horizontal size class) viser vi
/// `MainSidebarView` med 8-item NavigationSplitView — matcher
/// marketing-mockens iPad-layout. Portrait + iPhone bruker bottom tabs.
struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var hSize
    #if DEBUG
    @State private var qaFeedback = false
    #endif

    var body: some View {
        @Bindable var bindableState = appState
        Group {
            if appState.isAuthenticated {
                if UIDevice.current.userInterfaceIdiom == .pad && hSize == .regular {
                    MainSidebarView()
                } else {
                    MainTabView()
                }
            } else {
                PairingView()
            }
        }
        // Session-expiry-sheet — vises når en API-call returnerer 401.
        // Gir brukeren en synlig "Logg inn på nytt"-handling i stedet for
        // en kryptisk "APIError error 0" eller evig spinner.
        .sheet(isPresented: $bindableState.sessionExpired) {
            SessionExpiredSheet(
                onSignIn: {
                    appState.signOut()
                    // signOut nullstiller authToken → RootView re-renderer
                    // PairingView automatisk. Sheet lukkes av sessionExpired=false
                    // som signOut allerede setter.
                }
            )
            .interactiveDismissDisabled()
        }
        #if DEBUG
        // QA-hook (skjermbilder): `SIMCTL_CHILD_QA_FEEDBACK=1` presenterer
        // «Hva synes du om Leadgrid?»-sheeten direkte. Reverteres m/ task #59.
        .sheet(isPresented: $qaFeedback) {
            LeadgridFeedbackSheet(api: appState.api ?? APIClient(token: "qa-demo"))
        }
        .onAppear {
            if ProcessInfo.processInfo.environment["QA_FEEDBACK"] == "1" { qaFeedback = true }
        }
        #endif
        .task {
            await appState.bootstrap()
            // Start Leadgrid-polling så snart auth er på plass.
            if appState.api != nil {
                appState.startLeadgridPolling()
            }
            // Leadgrid Go: gjenoppta automatisk kjørebok hvis brukeren har samtykket.
            TripDetector.shared.startIfEnabled()
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
        // Lytt på alle WebSocket-events globalt så vi kan trigge
        // pulse-animasjon på nye pins uavhengig av hvilken fane er åpen.
        .onReceive(NotificationCenter.default.publisher(for: .leadgridRealtimeEvent)) { notif in
            guard let info = notif.userInfo as? [String: String],
                  info["type"] == "lead.created" else { return }
            Task { @MainActor in
                appState.handleLeadCreatedEvent(userInfo: info)
            }
        }
        // Mac Catalyst: Cmd+1..7 bytter hovedfane. Hidden buttons registrerer
        // shortcut med systemet uten å ta plass i layout. No-op på iOS/iPadOS
        // (macCatalystKeyboardShortcuts gater seg selv).
        .background { GlobalKeyboardShortcuts() }
    }
}

/// Hidden button-strip som registrerer keyboard shortcuts på Mac Catalyst.
/// Cmd+1..7 = bytt sidebar-item (Oversikt/Kart/Leads/Møter/Team/Leadbook/Salgsledelse).
/// Cmd+, = Innstillinger (postes som NSNotification for at aktuell fane kan reagere).
///
/// Alle buttons har frame(0) og opacity(0) — usynlig men reachable av
/// UIKit accelerator-systemet på Mac. iOS/iPadOS ignorerer `.keyboardShortcut`
/// mens en HW-tastatur ikke er parret, så dette er trygt globalt.
struct GlobalKeyboardShortcuts: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        #if targetEnvironment(macCatalyst)
        ZStack {
            // KUN idx 0..8 → Cmd+1..9 (enkelt-siffer). idx≥9 ville gitt
            // «10» = to grapheme clusters → `Character("10")` KRASJER hele
            // Mac-appen ved oppstart. SidebarItem.allCases vokste forbi 9.
            ForEach(SidebarItem.allCases.indices, id: \.self) { idx in
                if idx < 9 {
                    let item = SidebarItem.allCases[idx]
                    let key = KeyEquivalent(Character("\(idx + 1)"))
                    Button {
                        appState.selectedSidebarItem = item
                    } label: { EmptyView() }
                        .keyboardShortcut(key, modifiers: .command)
                        .frame(width: 0, height: 0)
                        .opacity(0)
                        .accessibilityHidden(true)
                }
            }
            // Cmd+, = Innstillinger (broadcast — fane-hostene kan lytte).
            Button {
                NotificationCenter.default.post(name: .leadgridOpenSettings, object: nil)
            } label: { EmptyView() }
                .keyboardShortcut(",", modifiers: .command)
                .frame(width: 0, height: 0)
                .opacity(0)
                .accessibilityHidden(true)
            // Cmd+N = nytt lead. Bytter til Kart-fanen først, så sender
            // broadcast som KartView plukker opp for å åpne AddLeadSheet.
            Button {
                appState.selectedSidebarItem = .kart
                NotificationCenter.default.post(name: .leadgridNewLead, object: nil)
            } label: { EmptyView() }
                .keyboardShortcut("n", modifiers: .command)
                .frame(width: 0, height: 0)
                .opacity(0)
                .accessibilityHidden(true)
            // Cmd+K = søk (bytter til Leads + fokuserer søkefelt).
            Button {
                appState.selectedSidebarItem = .leads
                NotificationCenter.default.post(name: .leadgridFocusSearch, object: nil)
            } label: { EmptyView() }
                .keyboardShortcut("k", modifiers: .command)
                .frame(width: 0, height: 0)
                .opacity(0)
                .accessibilityHidden(true)
            // Cmd+F = søk i aktuell tabell (broadcast — hver fane som har
            // søkefelt lytter og focus-flagger sitt tekstfelt).
            Button {
                NotificationCenter.default.post(name: .leadgridFocusSearch, object: nil)
            } label: { EmptyView() }
                .keyboardShortcut("f", modifiers: .command)
                .frame(width: 0, height: 0)
                .opacity(0)
                .accessibilityHidden(true)
        }
        .frame(width: 0, height: 0)
        #else
        EmptyView()
        #endif
    }
}

extension Notification.Name {
    /// Broadcast når brukeren trykker Cmd+, på Mac Catalyst.
    static let leadgridOpenSettings =
        Notification.Name("LeadMapApp.leadgridOpenSettings")
    /// Broadcast når brukeren trykker Cmd+N på Mac Catalyst (Kart-fanen håndterer).
    static let leadgridNewLead =
        Notification.Name("LeadMapApp.leadgridNewLead")
    /// Broadcast når brukeren trykker Cmd+K eller Cmd+F (Leads/Kart søk).
    static let leadgridFocusSearch =
        Notification.Name("LeadMapApp.leadgridFocusSearch")
}

/// Session-expiry-modal — vises når en API-call returnerte 401.
/// Forklarer at økten er utløpt og leder brukeren til pairing-flyten via
/// `signOut()`. `interactiveDismissDisabled` på sheet-en sørger for at
/// brukeren aktivt må trykke for å fortsette (ikke utilsiktet swipe-bort).
struct SessionExpiredSheet: View {
    let onSignIn: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(Color(red: 0.36, green: 0.18, blue: 0.62))
                .padding(.top, 32)

            VStack(spacing: 8) {
                Text("Din økt er utløpt")
                    .font(.title2.bold())
                Text("Av sikkerhetsgrunner må du logge inn på nytt for å fortsette.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            Spacer()

            Button {
                onSignIn()
            } label: {
                Text("Logg inn på nytt")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(red: 0.36, green: 0.18, blue: 0.62), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.hidden)
    }
}

/// Tabs (Pakke 10, 2026-07-01): 6 hovedfaner portet fra preview-appene.
/// Oversikt · Kart · Leads · Møter · Team · Leadbook.
/// Erstatter forrige 5-tab-løsning (I dag/Kart/Leads/Research/Mer); de
/// gamle visningene (MyDayView/LeadgridFollowUpQueueView/CalendarView/
/// LeadgridResearchTab/MapScreen) ble slettet og overtatt av de nye
/// preview-portene under `Views/Tabs/<Fane>/`.
struct MainTabView: View {
    @Environment(AppState.self) private var state
    /// Dynamic Type (a11y 2026-07-05): fontene bygges via Font.appScaled
    /// (UIFontMetrics) som leses når body evalueres — les env-verdien her
    /// og `.id()` roten så HELE hierarkiet re-bygges når brukeren endrer
    /// tekststørrelse i Innstillinger.
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var selection: Int = {
        #if DEBUG
        // QA-hook: `SIMCTL_CHILD_QA_TAB=<0-7> simctl launch …` åpner appen
        // rett på en gitt fane — brukes til automatiserte skjermbilde-sveip
        // på simulator. På iPhone mapper 5/6/7 til Mer-fanens under-sider
        // (Team/Leadbook/Salgsledelse, håndtert av PhoneMerTab).
        // Ingen effekt i release-bygg.
        if let raw = ProcessInfo.processInfo.environment["QA_TAB"], let idx = Int(raw) {
            if DeviceIdiom.isPhone {
                return min(max(idx, 0), 7) >= 4 ? 4 : min(max(idx, 0), 3)
            }
            return min(max(idx, 0), 6)
        }
        #endif
        return 0
    }()

    var body: some View {
        VStack(spacing: 0) {
            MockDataBanner()
            TabView(selection: $selection) {
                OversiktView()
                    .tabItem { Label("Oversikt", systemImage: "rectangle.3.group.fill") }
                    .tag(0)

                KartView()
                    .tabItem { Label("Kart", systemImage: "map.fill") }
                    .tag(1)

                // Leads (bedrifts-CRM) finnes ikke i opplevelsen for
                // dørsalg-profil-orger (2026-07-18) — skjules helt, ikke
                // lås-skjerm. Tag-ene er stabile så øvrige faner beholdes.
                if EntitlementStore.shared.canUse(.leads) {
                    LeadsView()
                        .tabItem { Label("Leads", systemImage: "person.crop.rectangle.stack.fill") }
                        .badge(state.leadgridUnreadCount > 0 ? state.leadgridUnreadCount : 0)
                        .tag(2)
                }

                MeetingsView()
                    .tabItem { Label("Møter", systemImage: "calendar") }
                    .tag(3)

                if DeviceIdiom.isPhone {
                    // iPhone har bare plass til 4 faner + én til — flere enn
                    // det gir UIKits «More»-controller (grå liste + fremmed
                    // back-knapp oppå våre egne headere). Egen Mer-fane gir
                    // samme innhold med Leadgrid-design.
                    PhoneMerTab()
                        .tabItem { Label("Mer", systemImage: "square.grid.2x2.fill") }
                        .tag(4)
                } else {
                    TeamView()
                        .tabItem { Label("Team", systemImage: "person.3.fill") }
                        .tag(4)

                    LeadbookView()
                        .tabItem { Label("Leadbook", systemImage: "book.pages.fill") }
                        .tag(5)

                    // Salgsledelse-suite (Pakke 10.1) — provisjon, konkurranser,
                    // premie-katalog, fulfillment. Bør role-gates til salgssjefer.
                    SalgsledelseView()
                        .tabItem { Label("Salgsledelse", systemImage: "rosette") }
                        .tag(6)
                }
            }
            // Møter «Naviger» → Kart-motoren. iPhone bruker lokal tab-selection
            // (ikke sidebar), så vi speiler nav-deep-linket til Kart-fanen (tag 1).
            .onChange(of: state.deepLinkNavRequestedAt) { _, newValue in
                if newValue != nil { selection = 1 }
            }
        }
        .id(dynamicTypeSize)
        // AX1-AX5 (2026-07-05): cappen på xxxLarge er fjernet — layoutene
        // er gjort adaptive (AXStack/axLineLimit i ScaledFont.swift) slik
        // at kort og rader re-flyter i stedet for å knekke.
    }
}

/// Mer-fanen på iPhone — inngangen til hovedområdene som ikke får plass i
/// tab-baren (Team/Leadbook/Salgsledelse). Under-sidene pushes med skjult
/// system-navbar (de har egne fulle headere); tilbake = swipe eller
/// tab-tap.
struct PhoneMerTab: View {
    @Environment(AppState.self) private var state

    private enum Destination: Int, Hashable {
        case team = 5, leadbook = 6, salgsledelse = 7, leadgridGo = 8, kvalitet = 9, anbud = 10
    }

    @State private var path: [Destination] = {
        #if DEBUG
        // QA-hook (se MainTabView): QA_TAB 5/6/7 → auto-push under-siden.
        if let raw = ProcessInfo.processInfo.environment["QA_TAB"],
           let idx = Int(raw), let dest = Destination(rawValue: idx) {
            return [dest]
        }
        #endif
        return []
    }()

    var body: some View {
        NavigationStack(path: $path) {
            List {
                Section("Hovedområder") {
                    merRow(.team, icon: "person.3.fill", color: .blue,
                           title: "Team", subtitle: "Områder, pipeline og aktivitet")
                    merRow(.leadbook, icon: "book.pages.fill", color: .purple,
                           title: "Leadbook", subtitle: "Maler, Pondus og innsikt")
                    if ["admin", "salgssjef"].contains(state.roleInOrg ?? "") {
                        merRow(.salgsledelse, icon: "rosette", color: .orange,
                               title: "Salgsledelse", subtitle: "Provisjon, konkurranser og premier")
                    }
                    merRow(.leadgridGo, icon: "car.circle.fill", color: .green,
                           title: "Leadgrid Go", subtitle: "Elektronisk kjørebok og kjøretøy")
                    merRow(.kvalitet, icon: "checkmark.seal.fill", color: .teal,
                           title: "Kvalitet", subtitle: "Verifiser salg med velkomstsamtale")
                    merRow(.anbud, icon: "doc.text.magnifyingglass", color: .indigo,
                           title: "Anbud", subtitle: "Offentlige anskaffelser fra Doffin")
                }
            }
            .navigationTitle("Mer")
            .navigationDestination(for: Destination.self) { dest in
                // Team/Leadbook/Salgsledelse har egne fulle headere → skjult navbar.
                // Leadgrid Go bruker system-navigasjon og pushes EMBEDDED (uten sin
                // egen NavigationStack — nestet stack i push tripper SwiftUI-assertion).
                switch dest {
                case .team:
                    TeamView().toolbar(.hidden, for: .navigationBar)
                case .leadbook:
                    LeadbookView().toolbar(.hidden, for: .navigationBar)
                case .salgsledelse:
                    SalgsledelseView(embeddedInStack: true)
                        .toolbar(.hidden, for: .navigationBar)
                case .leadgridGo:
                    LeadgridGoDashboardView(embedded: true)
                        .toolbar(.hidden, for: .navigationBar)
                case .kvalitet:
                    KvalitetView(embedded: true)
                        .toolbar(.hidden, for: .navigationBar)
                case .anbud:
                    AnbudView(embedded: true)
                        .toolbar(.hidden, for: .navigationBar)
                }
            }
        }
    }

    private func merRow(_ dest: Destination, icon: String, color: Color,
                        title: String, subtitle: String) -> some View {
        NavigationLink(value: dest) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8).fill(color.opacity(0.2))
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(color)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 15, weight: .semibold))
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 2)
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
                    // Kalender: portet inn i ny `MeetingsView` (Pakke 10) —
                    // bruk hovedfanen «Møter» istedet.
                    NavigationLink {
                        StaleLeadsList()
                    } label: {
                        moreRow(icon: "bell.badge", color: .orange, title: "Stille leads")
                    }
                    // Ruter — flyttet hit i Pakke 9 da bottom-tab-en
                    // ble byttet ut med Research. Bruker eksisterende
                    // LeadgridRoutePlannerView som tidligere var rot-tab.
                    if let api = state.api {
                        NavigationLink {
                            LeadgridRoutePlannerView(api: api)
                                .navigationTitle("Ruter")
                        } label: {
                            moreRow(
                                icon: "point.topleft.down.to.point.bottomright.curvepath",
                                color: .purple, title: "Ruter",
                            )
                        }
                    }
                    // Pin-guide — Daniel-feedback 2026-06-28: gi brukere
                    // oversikt over hva hver pin-variant betyr.
                    NavigationLink {
                        PinGuideView()
                    } label: {
                        moreRow(icon: "mappin.and.ellipse",
                                color: .purple, title: "Forstå pinsene")
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
                // Smart Workflow Builder (mig 0349, #203)
                if state.permissions.contains("workflows.view"),
                   let api = state.api {
                    Section("Automatisering") {
                        NavigationLink {
                            LeadgridWorkflowsView(api: api)
                        } label: {
                            moreRow(icon: "bolt.fill", color: .purple,
                                    title: "Workflows")
                        }
                    }
                }
                Section("Mine innstillinger") {
                    NavigationLink {
                        IndustryManagementView()
                    } label: {
                        moreRow(icon: "tag.fill", color: .purple, title: "Mine bransjer")
                    }
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

// LeadsTabHost fjernet i Pakke 10 — LeadsView fra Views/Tabs/Leads/ er ny
// hovedinngang og tar ikke api-binding (bruker LeadsData mock-seed inntil
// backend-port). Bring tilbake senere som thin wrapper hvis vi trenger
// api-injeksjon ved API-port.

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

// MARK: - iPad Sidebar (6 hovedfaner, Pakke 10)

/// Sidebar-elementer på iPad-landscape. 6 hovedfaner portet fra preview.
/// Hver case er en av de nye `Views/Tabs/<Fane>/`-toppvisningene.
enum SidebarItem: String, CaseIterable, Identifiable, Hashable {
    case oversikt
    case kart
    case leads
    case moter
    case team
    case leadbook
    case salgsledelse
    case leadgridGo
    case kvalitet
    case anbud

    var id: String { rawValue }

    var label: String {
        switch self {
        case .oversikt:     return "Oversikt"
        case .kart:         return "Kart"
        case .leads:        return "Leads"
        case .moter:        return "Møter"
        case .team:         return "Team"
        case .leadbook:     return "Leadbook"
        case .salgsledelse: return "Salgsledelse"
        case .leadgridGo:   return "Leadgrid Go"
        case .kvalitet:     return "Kvalitet"
        case .anbud:        return "Anbud"
        }
    }

    var systemImage: String {
        switch self {
        case .oversikt:     return "rectangle.3.group.fill"
        case .kart:         return "map.fill"
        case .leads:        return "person.crop.rectangle.stack.fill"
        case .moter:        return "calendar"
        case .team:         return "person.3.fill"
        case .leadbook:     return "book.pages.fill"
        case .salgsledelse: return "rosette"
        case .leadgridGo:   return "car.circle.fill"
        case .kvalitet:     return "checkmark.seal.fill"
        case .anbud:        return "doc.text.magnifyingglass"
        }
    }
}

/// Hoved-navigasjon for iPad-landscape. 8 items i venstre sidebar (matcher
/// marketing-mock), hovedinnhold på høyre side. iPhone og iPad-portrait
/// bruker fortsatt MainTabView (bottom-tabs).
struct MainSidebarView: View {
    @Environment(AppState.self) private var state
    @State private var visibility: NavigationSplitViewVisibility = {
        #if DEBUG
        if ProcessInfo.processInfo.environment["QA_CAPTURE"] == "1" { return .detailOnly }
        #endif
        return .all
    }()

    var body: some View {
        NavigationSplitView(columnVisibility: $visibility) {
            sidebarList
                // Brand-lockup øverst i sidemenyen erstatter tekst-tittelen
                // (wordmarken ligger i logoen — «Leadgrid»-tekst ville doblet).
                .navigationTitle("")
                .navigationBarTitleDisplayMode(.inline)
        } detail: {
            NavigationStack {
                detailFor(state.selectedSidebarItem)
            }
        }
        .navigationSplitViewStyle(.balanced)
        .onAppear(perform: applyQATabIfNeeded)
    }

    /// QA-hook: iPad bruker sidebar (ikke MainTabView-selection), så
    /// QA_TAB må mappes til `selectedSidebarItem` her — ellers landet
    /// alle automatiserte sveip på Oversikt uansett indeks. SidebarItem-
    /// rekkefølgen (0=oversikt … 6=salgsledelse) matcher QA_TAB direkte.
    private func applyQATabIfNeeded() {
        #if DEBUG
        guard let raw = ProcessInfo.processInfo.environment["QA_TAB"],
              let idx = Int(raw),
              SidebarItem.allCases.indices.contains(idx) else { return }
        state.selectedSidebarItem = SidebarItem.allCases[idx]
        #endif
    }

    @ViewBuilder
    private var sidebarList: some View {
        @Bindable var bindableState = state
        // iOS støtter ikke List(selection:content:) på den helt frie formen,
        // så vi bruker eksplisitt ForEach + .tag() i hver Section.
        List {
            // Leadgrid-lockup som brand-header i sidemenyen (2026-07-04).
            Section {
                Image("LeadgridLockup")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 170)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
                    .accessibilityLabel("Leadgrid")
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            Section("Hovedfaner") {
                // Salgsledelse skjules for ikke-ledere (rolle-gate; viewet
                // vakter i tillegg selv mot deep-link/persistert valg).
                // Leads (bedrifts-CRM) skjules HELT for dørsalg-profil-orger
                // (2026-07-18): en låst kjernefane skal ikke finnes i
                // opplevelsen, ikke vises med lås-skjerm.
                let visibleItems = SidebarItem.allCases.filter { item in
                    if item == .salgsledelse {
                        return ["admin", "salgssjef"].contains(state.roleInOrg ?? "")
                    }
                    if item == .leads {
                        return EntitlementStore.shared.canUse(.leads)
                    }
                    return true
                }
                ForEach(visibleItems) { item in
                    sidebarRow(
                        item,
                        badge: item == .leads ? state.leadgridUnreadCount : 0,
                        selection: $bindableState.selectedSidebarItem
                    )
                }
            }
        }
        .listStyle(.sidebar)
    }

    /// Sidebar-rad som button (alle iOS-versjoner). Highlighter aktiv valg
    /// med lilla bakgrunn — manuell paritet med iOS standard sidebar-selection.
    @ViewBuilder
    private func sidebarRow(
        _ item: SidebarItem,
        badge: Int,
        selection: Binding<SidebarItem>
    ) -> some View {
        let isActive = selection.wrappedValue == item
        Button {
            selection.wrappedValue = item
        } label: {
            HStack {
                Label(item.label, systemImage: item.systemImage)
                Spacer()
                if badge > 0 {
                    Text("\(badge)")
                        .font(.caption.bold())
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.red, in: Capsule())
                        .foregroundStyle(.white)
                }
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 6)
            .background(
                isActive
                    ? Color(red: 0.66, green: 0.32, blue: 0.99).opacity(0.20)
                    : Color.clear,
                in: RoundedRectangle(cornerRadius: 8)
            )
            .foregroundStyle(isActive
                              ? Color(red: 0.66, green: 0.32, blue: 0.99)
                              : Color.primary)
        }
        .buttonStyle(.plain)
        .macCatalystHover()
    }

    @ViewBuilder
    private func detailFor(_ item: SidebarItem) -> some View {
        switch item {
        case .oversikt:     OversiktView()
        case .kart:         KartView()
        case .leads:        LeadsView()
        case .moter:        MeetingsView()
        case .team:         TeamView()
        case .leadbook:     LeadbookView()
        case .salgsledelse: SalgsledelseView()
        case .leadgridGo:   LeadgridGoDashboardView()
        case .kvalitet:     KvalitetView()
        case .anbud:        AnbudView()
        }
    }

    @ViewBuilder
    private func loadingPlaceholder(_ title: String, systemImage: String) -> some View {
        ContentUnavailableView(
            "Logger inn …",
            systemImage: systemImage,
            description: Text("Vent et øyeblikk mens vi henter \(title.lowercased()).")
        )
    }
}
