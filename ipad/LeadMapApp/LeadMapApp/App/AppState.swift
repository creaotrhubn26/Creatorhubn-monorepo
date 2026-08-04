// AppState.swift
//
// Global observable state. Sentralisert auth + last-fetched data så
// vi unngår å re-fetche samme info i forskjellige views.
//
// Offline-strategi:
//   - bootstrap() laster fra cache først (umiddelbart synlig UI) →
//     forsøker refresh (overskriver hvis suksess)
//   - refreshAll() lagrer suksess til cache + flusher pending visits
//   - VisitLogModal sin save() går via enqueueOrSendVisit() som
//     enten kaller backend direkte eller legger i offline-kø

import Foundation
import Observation
#if canImport(UIKit)
import UIKit
#endif
#if canImport(WidgetKit)
import WidgetKit
#endif

@MainActor
@Observable
final class AppState {
    // Auth
    var authToken: String?
    var userEmail: String?
    var isAuthenticated: Bool { authToken != nil }

    /// Vist navn i header-avatarer og «Min profil». Baseres på userEmail
    /// (før login har vi ikke fullt navn tilgjengelig fra backend).
    /// Trekker fornavn/etternavn fra e-postens local-part der mulig.
    var displayName: String {
        guard let email = userEmail, let local = email.split(separator: "@").first else {
            return "Gjest"
        }
        let parts = local.split { $0 == "." || $0 == "_" || $0 == "-" }
        return parts
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    /// 1-2 bokstavers initialer for avatar-badge. Faller tilbake til «?»
    /// hvis brukeren ikke er innlogget (så UI ikke krasjer på nil).
    var initials: String {
        let name = displayName
        guard name != "Gjest" else { return "?" }
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    /// Aktivt valg i iPad-sidebar. Bevares mellom portrait/landscape så
    /// rotasjon ikke mister kontekst. Default = .oversikt (matcher mocken).
    var selectedSidebarItem: SidebarItem = .oversikt

    /// «Min bil»-profil (drivstoff/type) — skreddersyr POI-default, kjøre-
    /// godtgjørelse-sats og anbefalinger i nav. Persistert i UserDefaults.
    var vehicleProfile: VehicleProfile = VehicleProfileStore.load() {
        didSet { VehicleProfileStore.save(vehicleProfile) }
    }

    // ── Pondus deep-link (App Intents / Watch → Leadbook > Pondus) ─────
    /// Set av `AppStateBridge.navigateToPondus(...)` når en Siri Shortcut,
    /// Spotlight-treff eller Watch-aktivering vil åpne Pondus-fanen. Består
    /// gjennom cold-start: intent kjører → `perform()` setter dette → app
    /// blir launched → LeadbookView-observer plukker opp første `.task`.
    ///
    /// `deepLinkPondusTemplateName` støtter aktivering m/ navn (Siri:
    /// «Aktiver pondus første kontakt»), `deepLinkPondusTemplateId` for
    /// stabil id-basert routing (Watch-siden sender uuid).
    var deepLinkPondusTemplateId: String?
    var deepLinkPondusTemplateName: String?
    /// Tid da deep-link ble satt — brukes til å ignorere gamle deep-links
    /// (>60s) som kan ha kommet fra en tidligere session-kø.
    var deepLinkPondusRequestedAt: Date?

    /// Singleton for lettvekts observable pondus-store som App Intents kan
    /// lese uten å gå via SwiftUI-view-hierarkiet. LeadbookView bytter til
    /// denne (i stedet for lokal @State) slik at `PondusScoreIntent` og
    /// `ActivatePondusIntent` kan matche mot live data.
    let pondusStore: PondusStore = PondusStore()

    /// Sett deep-link + tidsstempel. Kalles av AppStateBridge (og indirekte
    /// av App Intents). LeadbookView.onAppear/task/onChange plukker opp
    /// dette og switch-er til Pondus-fanen.
    func setPondusDeepLink(templateId: String? = nil, templateName: String? = nil) {
        self.deepLinkPondusTemplateId = templateId
        self.deepLinkPondusTemplateName = templateName
        self.deepLinkPondusRequestedAt = Date()
        self.selectedSidebarItem = .leadbook
    }

    /// Klarer deep-linken etter at LeadbookView har konsumert den. Vi
    /// nuller ikke `selectedSidebarItem` — brukeren skal bli i Leadbook.
    func clearPondusDeepLink() {
        self.deepLinkPondusTemplateId = nil
        self.deepLinkPondusTemplateName = nil
        self.deepLinkPondusRequestedAt = nil
    }

    // ── Nav deep-link (Møter «Naviger» → Kart ekte turn-by-turn-motor) ──
    /// Set av Møter-fanen når brukeren trykker «Naviger» på et møte. KartView
    /// plukker opp dette (`.task(id: deepLinkNavRequestedAt)`), bygger en
    /// `MapLeadMock` av destinasjonen og starter ekte navigasjon (POV/Kjøre,
    /// MKDirections, stemme). Erstatter den frosne mock-`NavigationFullScreenView`.
    /// Speiler Pondus-mønsteret så det overlever tab-switch/cold-start.
    var deepLinkNavLat: Double?
    var deepLinkNavLon: Double?
    var deepLinkNavName: String?
    var deepLinkNavAddress: String?
    /// `true` = start turn-by-turn med én gang. `false` = bare senter/velg
    /// lead-en på kartet (rute-forhåndsvisning uten å gå inn i nav-modus).
    var deepLinkNavStart: Bool = true
    /// Transport-hint: "driving" fra «Start kjøring» (Leadgrid Go) — uten
    /// dette arvet nav-en gå-modus selv når du setter deg i firmabilen.
    var deepLinkNavTransport: String?
    var deepLinkNavRequestedAt: Date?

    /// Be Kart-fanen navigere til en koordinat. `start=true` går rett inn i
    /// turn-by-turn; `start=false` senterer og velger lead-en (forhåndsvisning).
    func requestNavigation(lat: Double, lon: Double, name: String, address: String,
                           start: Bool = true, transport: String? = nil) {
        self.deepLinkNavLat = lat
        self.deepLinkNavLon = lon
        self.deepLinkNavName = name
        self.deepLinkNavAddress = address
        self.deepLinkNavStart = start
        self.deepLinkNavTransport = transport
        self.deepLinkNavRequestedAt = Date()
        self.selectedSidebarItem = .kart
    }

    /// Klarer nav-deep-linken etter at KartView har konsumert den. `selectedSidebarItem`
    /// nulles ikke — brukeren skal bli på Kart-fanen.
    func clearNavigationDeepLink() {
        self.deepLinkNavLat = nil
        self.deepLinkNavLon = nil
        self.deepLinkNavName = nil
        self.deepLinkNavAddress = nil
        self.deepLinkNavTransport = nil
        self.deepLinkNavRequestedAt = nil
    }

    // ── Aktiv fler-stopp-rute (Ruteplanlegger nivå 1) ──────────────────
    /// Planlagt besøksrute fra RoutePlannerSheet. Persistert i UserDefaults
    /// så dagens rute overlever app-restart. KartViews ankomst-tilstand
    /// leser denne og tilbyr «Neste stopp (2/6)» — hele dagen kjøres uten
    /// å åpne planleggeren igjen.
    struct RuteStopp: Codable, Equatable {
        let id: String
        let name: String
        let address: String
        let lat: Double
        let lon: Double
        /// Avtalt tid (møte-anker fra nextFollowUpAt) — brukes til
        /// konflikt-varsling i planleggeren og info underveis.
        var ankerTid: Date? = nil
    }
    struct RutePlan: Codable, Equatable {
        var stopp: [RuteStopp]
        /// Indeks for NESTE stopp som skal besøkes.
        var index: Int
        var opprettet: Date
        /// Backend-id når ruta kom fra en leder-tildeling (nivå 3) —
        /// brukes til statusrapportering (akseptert/fullfort).
        var fjernId: String? = nil
    }

    private static let rutePlanKey = "leadgrid.aktiv_rute_plan"

    var rutePlan: RutePlan? = AppState.lesRutePlanFraDisk() {
        didSet {
            if let plan = rutePlan, let data = try? JSONEncoder().encode(plan) {
                UserDefaults.standard.set(data, forKey: Self.rutePlanKey)
            } else {
                UserDefaults.standard.removeObject(forKey: Self.rutePlanKey)
            }
        }
    }

    /// Last persistert rute ved oppstart. Ruter eldre enn 24t er ikke
    /// «dagens» — rydd i stedet for å gjenoppta.
    private static func lesRutePlanFraDisk() -> RutePlan? {
        guard let data = UserDefaults.standard.data(forKey: rutePlanKey),
              let plan = try? JSONDecoder().decode(RutePlan.self, from: data)
        else { return nil }
        if Date().timeIntervalSince(plan.opprettet) > 24 * 3600 {
            UserDefaults.standard.removeObject(forKey: rutePlanKey)
            return nil
        }
        return plan
    }

    /// Start planlagt rute: lagre plan + naviger til første stopp.
    func startRutePlan(_ stopp: [RuteStopp]) {
        guard let first = stopp.first else { return }
        rutePlan = RutePlan(stopp: stopp, index: 0, opprettet: Date())
        requestNavigation(lat: first.lat, lon: first.lon,
                          name: first.name, address: first.address,
                          start: true, transport: "driving")
    }

    /// Gå videre til neste stopp i ruta (fra ankomst-kortet). Returnerer
    /// stoppet det skal navigeres til, eller nil når ruta er ferdig.
    @discardableResult
    func avanserRute() -> RuteStopp? {
        guard var plan = rutePlan else { return nil }
        plan.index += 1
        guard plan.index < plan.stopp.count else {
            meldRuteStatus(plan, "fullfort")
            rutePlan = nil
            return nil
        }
        rutePlan = plan
        return plan.stopp[plan.index]
    }

    func avsluttRute() {
        if let plan = rutePlan { meldRuteStatus(plan, "avvist") }
        rutePlan = nil
    }

    /// Rapportér status til backend for leder-tildelte ruter (best effort).
    private func meldRuteStatus(_ plan: RutePlan, _ status: String) {
        guard let id = plan.fjernId, let api else { return }
        Task { try? await api.settRuteStatus(id: id, status: status) }
    }

    /// Hent nyeste tildelte rute fra backend → rett inn i rute-motoren
    /// (varsel-tap eller manuell henting). Kvitterer «akseptert».
    @MainActor
    func hentTildeltRute() async {
        guard let api else { return }
        guard let dto = try? await api.hentMinTildelteRute() else { return }
        let iso = ISO8601DateFormatter()
        let stopp = dto.stopp.map { s in
            RuteStopp(id: s.id, name: s.name, address: s.address,
                      lat: s.lat, lon: s.lon,
                      ankerTid: s.ankerTid.flatMap { iso.date(from: $0) })
        }
        guard !stopp.isEmpty else { return }
        rutePlan = RutePlan(stopp: stopp, index: 0, opprettet: Date(), fjernId: dto.id)
        try? await api.settRuteStatus(id: dto.id, status: "akseptert")
    }

    // ── Etter-møte-deep-link (lokalt varsel → EtterMoteSheet) ──────────
    var pendingEtterMoteSelskap: String?
    var pendingEtterMoteId: String?
    func clearEtterMoteDeepLink() {
        pendingEtterMoteSelskap = nil
        pendingEtterMoteId = nil
    }

    // Klienter (lazy-init når token er satt)
    private(set) var api: APIClient?

    // Cached data (refreshes ved pull-down + periodisk)
    var leads: [LeadModel] = []
    /// Eksplisitt load-state for leads (uke 2) — samme mønster som
    /// projectsLoadState: skiller «laster fortsatt» fra «ekte tom liste»
    /// så Leads-fanen kan vise skeleton i stedet for å blinke tom-tilstand
    /// ved app-start.
    var leadsLoadState: ProjectsLoadState = .idle
    /// Load-state for kalender (Møter-fanen) — samme mønster.
    var calendarLoadState: ProjectsLoadState = .idle
    /// Lead-id-er som er kommet inn via real-time WebSocket-event
    /// (typisk `lead.created` fra batch-research). Pin-viewen sjekker
    /// dette settet og pulserer i 3 sek før vi tar id-en ut igjen.
    /// Brukes kun visuelt — påvirker ikke filter/sort.
    var recentlyAddedLeadIds: Set<String> = []
    /// Lett mock-hook så tester kan injisere fake "just landed" leads.
    func markLeadAsNew(_ leadId: String, duration: TimeInterval = 3.0) {
        guard !leadId.isEmpty else { return }
        recentlyAddedLeadIds.insert(leadId)
        // AppState er @MainActor, så vi trenger ikke MainActor.run; Task
        // arver MainActor-kontekst og pulse-flagget tas ut igjen rent på
        // main-thread etter `duration` sekunder.
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            self?.recentlyAddedLeadIds.remove(leadId)
        }
    }

    /// Håndter et `lead.created`-WebSocket-event fra LeadgridRealtimeClient.
    /// userInfo-formatet er flat-string-konvertert av klienten.
    /// Effekt: trigger pulse-animasjon + sørger for at lead-en blir hentet
    /// inn i `leads` (selv om listen ikke har refresh-et enda).
    func handleLeadCreatedEvent(userInfo: [String: String]) {
        guard userInfo["type"] == "lead.created" else { return }
        let leadId = userInfo["data.lead_id"] ?? ""
        guard !leadId.isEmpty else { return }
        // Org-filter: hvis backend sendte org-id og den ikke matcher aktivt,
        // ignorer (brukeren har byttet org siden eventet ble produsert).
        if let orgIdInEvent = userInfo["data.organization_id"],
           !orgIdInEvent.isEmpty,
           let activeOrg = activeOrganizationId,
           orgIdInEvent != activeOrg {
            return
        }
        // Subtle haptic feedback når et nytt lead lander — kun hvis user er
        // i appen (UIImpactFeedbackGenerator er no-op når app er i bg).
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

        markLeadAsNew(leadId, duration: 3.0)

        // Hvis lead-en ikke finnes i listen, trigger refresh slik at pinen
        // dukker opp på kartet. Vi unngår å refresh på hver event ved å
        // bare gjøre det når leadId mangler — listen blir konsolidert via
        // refreshAll() etter en kort delay.
        if !leads.contains(where: { $0.id == leadId }) {
            Task { await refreshLeads() }
        }
    }

    /// Kun lead-fetch — billigere enn full refreshAll. Brukes av real-time-
    /// pulse-flyten for å unngå å refreshe metrics/calendar samtidig.
    func refreshLeads() async {
        guard let api else { return }
        do {
            let fresh = try await api.fetchLeads(projectId: activeProjectId)
            self.leads = fresh
            self.leadsLoadState = .loaded
        } catch {
            print("[AppState] refreshLeads failed: \(error)")
            if case .loaded = leadsLoadState {} else {
                let retryable = (error as? APIError)?.isRetryable ?? true
                leadsLoadState = .failed(error.localizedDescription, isRetryable: retryable)
            }
        }
    }
    var competitors: [CompetitorModel] = []
    var metrics: MetricsModel?
    var calendar: [CalendarEvent] = []
    var reminders: RemindersResponse?

    // Prosjekt-kontekst — hvilken bedrift jobber jeg for?
    var projects: [ProjectListItem] = []
    /// Eksplisitt load-state for prosjekter slik at UI kan skille mellom
    /// «laster fortsatt» og «ekte tom liste». Default `.idle` betyr at vi
    /// ikke har trigget fetch enda — vises som loading-skeleton i kortet
    /// så vi ikke blinker "Ingen prosjekter ennå" i 1-2 sek ved app-start.
    /// Bug fra PR #993: empty-state ble vist mens projects fortsatt lastes.
    var projectsLoadState: ProjectsLoadState = .idle
    var activeProjectSummary: ProjectSummary?
    var activeProjectId: String? {
        didSet {
            if let id = activeProjectId {
                UserDefaults.standard.set(id, forKey: "rr.lead_map.active_project")
            } else {
                UserDefaults.standard.removeObject(forKey: "rr.lead_map.active_project")
            }
            Task { await refreshAll() }
            if let id = activeProjectId {
                Task { await loadProjectSummary(id: id) }
            } else {
                self.activeProjectSummary = nil
            }
        }
    }

    // Aktivt valgt
    var selectedLead: LeadModel?
    var selectedCompetitor: CompetitorModel?

    // Offline-state
    var lastSyncAt: Date?
    var pendingVisitsCount: Int = 0
    var isUsingStaleCache: Bool = false

    // ── Session-expiry (PR fix/leadmap-apierror-localized-description) ──
    /// True når en API-call returnerte 401 (token utløpt eller ugyldig).
    /// `RootView` observer dette og presenter et "Logg inn på nytt"-sheet
    /// så brukeren slipper å se "APIError error 0" eller en evig spinner.
    /// Resetter til false ved `signOut()` / `signIn(...)`.
    var sessionExpired: Bool = false

    /// Sentralisert error-handler som setter `sessionExpired = true` hvis
    /// feilen er en `APIError.unauthorized`. Per-fetch sites kan kalle
    /// dette i sin `catch`-blokk for å trigge re-login-flyt uten å duplisere
    /// 401-sjekken overalt.
    @discardableResult
    func handleAPIError(_ error: Error) -> Bool {
        if let apiError = error as? APIError, apiError.requiresReauth {
            #if DEBUG
            if ProcessInfo.processInfo.environment["QA_CAPTURE"] == "1" { return true }
            #endif
            self.sessionExpired = true
            return true
        }
        return false
    }

    // ── Org + RBAC (PR #611–#615) ───────────────────────────────
    var organizations: [OrganizationSummary] = []
    var activeOrganizationId: String? {
        didSet {
            if let id = activeOrganizationId {
                UserDefaults.standard.set(id, forKey: "rr.lead_map.active_org")
            } else {
                UserDefaults.standard.removeObject(forKey: "rr.lead_map.active_org")
            }
            // Org-bytte MÅ oppdatere ALT org-avhengig, ikke bare org-
            // kontekst — ellers viste Leads/Oversikt/Kart forrige org sine
            // data til noe annet trigget refreshAll (QA 2026-07-06). Og
            // entitlements/gating må re-hentes for den nye aktive org-en
            // (før: kun ved bootstrap → gating frosset til primær-org).
            if oldValue != activeOrganizationId {
                Task {
                    await loadOrgContext()
                    await loadMyEntitlements()
                    await refreshAll()
                }
            }
        }
    }
    /// Effective permissions for current user i active org.
    var permissions: Set<String> = []
    var roleInOrg: String?
    var locationConsentGranted: Bool = false

    // ── Varsel-tap (Notification-QA 2026-07-06) ─────────────────
    /// Settes når brukeren tapper et push-varsel. Den delte header-en
    /// (montert på hver fane) observerer og åpner varsel-inboksen. Nil-es
    /// etter konsum. Buffres for cold-start-tap via AppStateBridge.
    var pendingNotificationTap: [String: String]?

    // ── Super-admin (fase 18) ──────────────────────────────────
    /// User-level role fra /api/auth/user (uavhengig av active org).
    /// 'super_admin' låser opp SuperAdminHub for Daniel's B2B-pipeline.
    var userRole: String?
    /// True hvis user.role == 'super_admin' eller user.isPlatformAdmin.
    var isSuperAdmin: Bool { userRole == "super_admin" }

    // ── Admin-room multi-produkt (#1318, portet i main-mergen) ──
    /// Hvilket produkt admin-room-flatene (pipeline, industry-targets)
    /// er i kontekst for. Default `.leadgrid`; persistert i UserDefaults.
    var activeAdminProduct: AdminProductKey = .leadgrid {
        didSet {
            guard oldValue != activeAdminProduct else { return }
            UserDefaults.standard.set(
                activeAdminProduct.rawValue,
                forKey: AdminProductDefaultsKey.activeProduct
            )
        }
    }

    // ── Min dag (PR #616) ───────────────────────────────────────
    var workloadLeads: [WorkloadLead] = []
    var quota: QuotaProgress?

    // ── Live selger-pins (PR #612) ─────────────────────────────
    var memberLocations: [MemberLocation] = []

    // ── Varsler (PR #622) ──────────────────────────────────────
    var unreadNotificationsCount: Int = 0
    private var notificationsPollTask: Task<Void, Never>?

    // ── Leadgrid v2 (PR #730+) ─────────────────────────────────
    /// Uleste in-app Leadgrid-varsler. Polles parallelt m/ lead-map-varsler.
    var leadgridUnreadCount: Int = 0
    /// Siste 50 Leadgrid-varsler. Caches for inbox-dropdown.
    var leadgridNotifications: [LeadgridNotification] = []
    private var leadgridPollTask: Task<Void, Never>?

    /// Sheet-presentation-state for Leadgrid-flater.
    var presentingLeadgridInbox = false
    var presentingLeadgridDashboard = false
    var presentingLeadgridReports = false
    var presentingLeadgridNotifications = false
    var presentingLeadgridPrefs = false
    var presentingLeadgridExport = false

    /// Refresh in-app Leadgrid-varsler. Kalles av poll-task + manuelt
    /// fra bell-pull-down.
    func refreshLeadgridNotifications() async {
        guard let api else { return }
        do {
            let resp = try await api.fetchMyLeadgridNotifications()
            self.leadgridNotifications = resp.items
            self.leadgridUnreadCount = resp.unreadCount
        } catch {
            // Stille — endepunktet kan returnere 401 hvis brukeren ikke har
            // Leadgrid-konto enda; det er forventet.
            print("[AppState] leadgrid notifications fetch failed: \(error)")
        }
    }

    /// Marker varsler som lest. Tom liste = alle.
    func markLeadgridNotificationsRead(ids: [String] = []) async {
        guard let api else { return }
        do {
            try await api.markLeadgridNotificationsRead(ids: ids)
            await refreshLeadgridNotifications()
        } catch {
            print("[AppState] mark-read failed: \(error)")
        }
    }

    /// Start polling for Leadgrid-varsler hvert 60s. Stoppes ved logout.
    func startLeadgridPolling() {
        leadgridPollTask?.cancel()
        leadgridPollTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                await self?.refreshLeadgridNotifications()
                try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
            }
        }
    }

    func stopLeadgridPolling() {
        leadgridPollTask?.cancel()
        leadgridPollTask = nil
    }

    /// Håndter et APNS-varsel som ble tap-pet. Backend sender 'event_type'
    /// + valgfri 'lead_id' / 'deep_link'. Vi setter relevant presentation-
    /// flag så LeadgridHubView (eller fallback i RootView) viser sheet.
    func handleLeadgridNotificationTap(_ payload: [String: String]) {
        // Trig refresh av notifikasjons-listen så badge-counter er aktuell.
        Task { await refreshLeadgridNotifications() }

        let eventType = payload["event_type"] ?? ""
        switch eventType {
        case "lead_assigned_as_team_leader",
              "lead_assigned_as_rep",
              "lead_assigned_on_accept":
            // Vis innboks slik at brukeren ser den nye tildelingen.
            presentingLeadgridNotifications = true
        case "lead_won", "lead_lost", "lead_status_change":
            // Lås på dashboard så de ser overordnet status.
            presentingLeadgridDashboard = true
        case "doffin_watch_hit":
            // Nye anbuds-treff (2026-08-03): varselet peker på
            // leadgrid://anbud — rett til Anbud-fanen, ikke innboksen.
            selectedSidebarItem = .anbud
        case "brief_klar":
            // Kveldsbriefen: rett til Møter — briefene ligger klare der.
            selectedSidebarItem = .moter
        case "etter_mote":
            // Lokalt «logg møtet»-varsel: rett til Møter, og MeetingsView
            // åpner etterarbeids-arket for selskapet.
            pendingEtterMoteSelskap = payload["selskap"]
            pendingEtterMoteId = payload["mote_id"]
            selectedSidebarItem = .moter
        case "leadgrid_rute_tildelt":
            // Rute tildelt av salgssjef (nivå 3): hent ruta rett inn i
            // Kart-fanens rute-motor.
            selectedSidebarItem = .kart
            Task { await hentTildeltRute() }
        default:
            presentingLeadgridNotifications = true
        }
    }

    // ── Kart-annotasjoner (PR #629) ────────────────────────────
    var annotations: [MapAnnotation] = []
    var canCreateAnnotations: Bool = false

    func refreshAnnotations() async {
        guard let api, let orgId = activeOrganizationId else { return }
        do {
            let resp = try await api.fetchAnnotations(organizationId: orgId)
            self.annotations = resp.annotations
            self.canCreateAnnotations = resp.canCreate
        } catch {
            print("[AppState] annotations failed: \(error)")
        }
    }

    // ── Territorie-grids (LeadGrid territory enforcement) ──────
    var myTerritories: [Territory] = []

    func refreshTerritories() async {
        guard let api, let orgId = activeOrganizationId else { return }
        do {
            let t = try await api.fetchMyTerritories(organizationId: orgId)
            self.myTerritories = t
            TerritoryMonitor.shared.configure(territories: t)
        } catch {
            print("[AppState] territories failed: \(error)")
        }
    }

    // ── Smart dagsrute ─────────────────────────────────────────
    var dayRoute: DayRoute?
    var dayRouteMessage: String?
    var planningRoute = false

    /// Planlegg dagens rute fra nåværende GPS-posisjon. Ruten vises både i
    /// MyDay-sheet og som overlay på kartet (iPad-native fortrinn).
    func planDayRoute() async {
        guard let api, let orgId = activeOrganizationId else { return }
        guard let loc = LocationService.shared.currentLocation else {
            self.dayRouteMessage = "Trenger GPS-posisjon for å bygge rute."
            return
        }
        planningRoute = true
        dayRouteMessage = nil
        defer { planningRoute = false }
        do {
            let resp = try await api.planDayRoute(
                organizationId: orgId,
                startLat: loc.coordinate.latitude,
                startLng: loc.coordinate.longitude)
            self.dayRoute = resp.route
            if resp.route == nil { self.dayRouteMessage = resp.message ?? "Ingen aktuelle leads i din sone." }
        } catch {
            self.dayRouteMessage = "Kunne ikke bygge rute: \(error.localizedDescription)"
        }
    }

    /// Innsjekk i felt: oppdater stopp-status (optimistisk lokalt).
    func updateRouteStop(stopId: String, status: String) async {
        guard let api, let route = dayRoute else { return }
        do {
            try await api.updateRouteStop(routeId: route.id, stopId: stopId, status: status)
        } catch {
            print("[AppState] route stop update failed: \(error)")
        }
    }

    // ── Heartbeat-loop ─────────────────────────────────────────
    private var heartbeatController: HeartbeatController?

    var activeOrganization: OrganizationSummary? {
        organizations.first { $0.id == activeOrganizationId }
    }

    func can(_ permissionKey: String) -> Bool {
        permissions.contains(permissionKey)
    }

    /// Klient-side filter for leads tilhørende ett spesifikt prosjekt.
    /// Brukes av multi-prosjekt-pageren på kartet for å vise per-kort-
    /// counter («X leads igjen»). Server-side filtreringen via
    /// `activeProjectId` → `fetchLeads(projectId:)` er primær-mekanismen
    /// for kart-pins; denne hjelperen er nyttig for views som vil vise
    /// leads for et NON-active prosjekt uten å bytte global state.
    func filteredLeads(forProject projectId: String) -> [LeadModel] {
        leads.filter { $0.projectId == projectId }
    }

    func bootstrap() async {
        #if DEBUG
        // QA-hook (landing-videoer): QA_TOUR kjører på ren demo-data og
        // trenger ingen backend — hopp over pairing hvis sesjonen mangler.
        // Reverteres m/ task #59-følget.
        if ProcessInfo.processInfo.environment["QA_TOUR"] != nil,
           AuthClient.loadToken() == nil {
            self.authToken = "qa-tour-demo"
            self.userEmail = "demo@leadgrid.no"
            return
        }
        #endif
        // 1. Hent persistert prosjekt + org-valg
        if let stored = UserDefaults.standard.string(forKey: "rr.lead_map.active_project"), !stored.isEmpty {
            self.activeProjectId = stored
        }
        if let storedProduct = UserDefaults.standard.string(forKey: AdminProductDefaultsKey.activeProduct),
           let product = AdminProductKey(rawValue: storedProduct) {
            self.activeAdminProduct = product
        }
        if let storedOrg = UserDefaults.standard.string(forKey: "rr.lead_map.active_org"), !storedOrg.isEmpty {
            self.activeOrganizationId = storedOrg
        }

        // 2. Last fra cache umiddelbart så UI er responsivt selv før refresh
        await loadFromCache()

        // 3. Hvis vi har token, prøv refresh — overskriver cache ved suksess
        if let token = AuthClient.loadToken() {
            self.authToken = token
            self.userEmail = AuthClient.loadEmail()
            self.api = APIClient(token: token)
            // Rolle + identitet FØRST — de gater UI (SuperAdmin-inngangen,
            // avatar-navn) og er ett billig kall. Lå sist i kjeden før →
            // super_admin så «Gjest/Salgssjef» til hele refreshen var
            // ferdig (kald backend = titalls sekunder).
            await loadUserRole()
            // Entitlements fail-open og gater-viewene re-rendrer på @Published-
            // endringen → kjør samtidig med refreshAll i stedet for å blokkere
            // first paint på et kaldt backend (QA 2026-07-06).
            async let entitlementsLoad: Void = loadMyEntitlements()
            await refreshAll()
            await entitlementsLoad
            if let id = activeProjectId {
                await loadProjectSummary(id: id)
            }
            await loadOrganizations()
            await loadOrgContext()
            // (loadUserRole lå her en gang til — fjernet; rollen er alt
            //  hentet øverst, dobbeltkallet var bortkastet.)
            await startHeartbeatIfNeeded()
            startNotificationsPolling()
            await refreshAnnotations()
            await refreshTerritories()
            if let api = self.api {
                ProximityMonitor.shared.configure(api: api)
            }
        }
    }

    /// Last alle organisasjoner brukeren er medlem av.
    func loadOrganizations() async {
        guard let api else { return }
        do {
            let orgs = try await api.fetchOrganizations()
            self.organizations = orgs
            // FIX 4: Valider at activeOrganizationId fortsatt eksisterer i
            // medlemskapslista. Stale ID i UserDefaults (typisk: brukeren
            // ble fjernet fra orgen, eller orgen ble slettet) → alle
            // org-scoped fetchers (workload/quota/permissions/territories)
            // ville feilet med 404 helt til neste app-installasjon.
            if let activeId = activeOrganizationId,
               !orgs.contains(where: { $0.id == activeId }) {
                print("[AppState] activeOrganizationId \(activeId) not in orgs list — auto-clearing")
                self.activeOrganizationId = orgs.first?.id  // didSet rydder UserDefaults
            } else if activeOrganizationId == nil, let first = orgs.first {
                // Auto-velg første hvis ingen aktiv
                self.activeOrganizationId = first.id
            }
        } catch {
            print("[AppState] loadOrganizations failed: \(error)")
            handleAPIError(error)
        }
    }

    /// Last user-level role fra /api/auth/user (fase 18: super-admin-deteksjon).
    /// Setter `userRole` slik at `isSuperAdmin` kan styre tilgang til SuperAdminHub.
    func loadUserRole() async {
        guard let api else { return }
        do {
            let resp = try await api.fetchAuthUser()
            if let user = resp.user {
                self.userRole = user.role
                // QA-hook/pairing lagrer ikke e-post i keychain — uten
                // denne sto avataren som «Gjest» selv med gyldig sesjon.
                if self.userEmail == nil || self.userEmail?.isEmpty == true {
                    self.userEmail = user.email
                }
            }
        } catch {
            print("[AppState] loadUserRole failed: \(error)")
        }
    }

    /// Egen orgs feature-entitlements (mig 0370) → EntitlementStore, slik
    /// at .gated()-flatene speiler hva SuperAdmin har gitt organisasjonen.
    /// Feiler stille: ingen data = alt åpent (bakoverkompatibelt).
    func loadMyEntitlements() async {
        guard let api else { return }
        do {
            let envelope = try await api.fetchMyEntitlements(organizationId: activeOrganizationId)
            EntitlementStore.shared.applyServer(envelope)
        } catch {
            print("[AppState] loadMyEntitlements failed: \(error)")
        }
    }

    /// Last permissions + location-consent + member-locations for active org.
    func loadOrgContext() async {
        guard let api, let orgId = activeOrganizationId else {
            self.permissions = []
            self.roleInOrg = nil
            self.locationConsentGranted = false
            self.memberLocations = []
            return
        }
        // Optimistisk: vis sist kjente rolle for org-en umiddelbart, så
        // rolle-gatede menyvalg (Salgsledelse) ikke «popper inn» etter at
        // permissions-kallet lander. Serveren bekrefter/korrigerer under, og
        // selve viewet vakter uansett server-side.
        let roleCacheKey = "leadgrid.roleInOrg.\(orgId)"
        if self.roleInOrg == nil, let cached = UserDefaults.standard.string(forKey: roleCacheKey) {
            self.roleInOrg = cached
        }
        async let permTask = api.fetchPermissions(organizationId: orgId)
        async let consentTask = api.fetchLocationConsent(orgId)
        async let locsTask = api.fetchMemberLocations(orgId)
        do {
            let perm = try await permTask
            self.permissions = Set(perm.permissions)
            self.roleInOrg = perm.role
            if let role = perm.role {
                UserDefaults.standard.set(role, forKey: roleCacheKey)
            }
        } catch {
            print("[AppState] permissions failed: \(error)")
        }
        do {
            self.locationConsentGranted = try await consentTask
        } catch {
            print("[AppState] consent failed: \(error)")
        }
        do {
            self.memberLocations = try await locsTask
        } catch {
            print("[AppState] memberLocations failed: \(error)")
        }
    }

    /// Last Min dag-data (workload + quota).
    func refreshWorkload() async {
        guard let api, let orgId = activeOrganizationId else { return }
        let loc = LocationService.shared.currentLocation
        do {
            let resp = try await api.fetchWorkload(organizationId: orgId, location: loc)
            self.workloadLeads = resp.leads
            // Re-konfigurer geofence-monitorering for de 20 nærmeste tildelte leads
            ProximityMonitor.shared.updateAssignedLeads(resp.leads)
        } catch {
            print("[AppState] workload failed: \(error)")
        }
        do {
            self.quota = try await api.fetchQuota(organizationId: orgId)
        } catch {
            print("[AppState] quota failed: \(error)")
        }
    }

    /// Start heartbeat-loopen for online-status + valgfri posisjon.
    private func startHeartbeatIfNeeded() async {
        guard let api, let orgId = activeOrganizationId else { return }
        heartbeatController?.stop()
        let hb = HeartbeatController(
            api: api,
            organizationId: orgId,
            locationService: .shared,
        )
        hb.isSharingLocation = locationConsentGranted
        hb.start()
        self.heartbeatController = hb
    }

    /// Poll unreadNotificationsCount hvert 30s — driver bell-badge på tab.
    func startNotificationsPolling() {
        notificationsPollTask?.cancel()
        notificationsPollTask = Task { @MainActor [weak self] in
            guard let self else { return }
            await self.refreshNotificationsCount()
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                if Task.isCancelled { return }
                await self.refreshNotificationsCount()
            }
        }
    }

    func refreshNotificationsCount() async {
        guard let api else { return }
        do {
            let resp = try await api.fetchNotifications(unreadOnly: true, limit: 1)
            self.unreadNotificationsCount = resp.unreadCount
        } catch {
            // Stille feil
        }
    }

    /// Toggle posisjons-deling. Bruker må eksplisitt slå PÅ.
    func setLocationConsent(_ on: Bool) async {
        guard let api, let orgId = activeOrganizationId else { return }
        do {
            try await api.setLocationConsent(orgId, consent: on)
            self.locationConsentGranted = on
            heartbeatController?.isSharingLocation = on
            if on {
                LocationService.shared.requestPermissionIfNeeded()
                LocationService.shared.startUpdating()
            }
        } catch {
            print("[AppState] setLocationConsent failed: \(error)")
        }
    }

    func loadProjectSummary(id: String) async {
        guard let api else { return }
        do {
            self.activeProjectSummary = try await api.fetchProjectSummary(id: id)
        } catch {
            // Stale `activeProjectId` (typisk arkivert/slettet prosjekt
            // som fremdeles ligger i UserDefaults) → 404. Auto-clear så
            // appen ikke hardlocker på "HTTP 404" ved start, og fallback
            // til første aktive prosjekt hvis vi har laster en liste.
            // Andre feil bare logges (matcher tidligere oppførsel).
            if let apiError = error as? APIError, apiError.isNotFound {
                print("[AppState] activeProjectId \(id) returned 404 — clearing and falling back")
                self.activeProjectSummary = nil
                // Bare auto-velg fra projects-listen hvis ID-en vi nettopp
                // ble 404 på faktisk fortsatt er den aktive. Hvis brukeren
                // har byttet til et annet prosjekt mens kallet var i flight,
                // skal vi ikke trampe over deres valg.
                if activeProjectId == id {
                    let fallback = projects.first(where: { $0.id != id })?.id
                    activeProjectId = fallback  // didSet rydder UserDefaults når nil
                }
            } else {
                print("[AppState] projectSummary failed: \(error)")
                handleAPIError(error)
            }
        }
    }

    func signIn(token: String, email: String?) async {
        AuthClient.saveToken(token, email: email)
        self.authToken = token
        self.userEmail = email
        self.api = APIClient(token: token)
        self.sessionExpired = false
        // Last user-role FØR refreshAll så SuperAdminHub-section i
        // LeadgridHubView låses opp umiddelbart for super_admin. Uten
        // dette ble userRole nil helt til neste app-start (bootstrap)
        // kjørte loadUserRole — Super Admin-section var skjult etter
        // Google login selv om DB-role var 'super_admin'.
        await loadOrganizations()
        await loadOrgContext()
        await loadUserRole()
        await refreshAll()
    }

    /// Brukes etter en vellykket pairing-kode-bytte eller Google Sign-In.
    /// Setter token + last alt frem (inkl. user-role for super_admin-deteksjon).
    func completePairing(token: String, userId: String) {
        AuthClient.saveToken(token, email: nil)
        self.authToken = token
        self.api = APIClient(token: token)
        self.sessionExpired = false
        Task {
            await loadOrganizations()
            await loadOrgContext()
            await loadUserRole()
            await refreshAll()
        }
    }

    func signOut() {
        heartbeatController?.stop()
        heartbeatController = nil
        notificationsPollTask?.cancel()
        notificationsPollTask = nil
        ProximityMonitor.shared.stopAll()
        self.unreadNotificationsCount = 0
        AuthClient.clear()
        self.authToken = nil
        self.userEmail = nil
        self.api = nil
        self.leads = []
        self.competitors = []
        self.metrics = nil
        self.calendar = []
        self.reminders = nil
        self.projects = []
        self.projectsLoadState = .idle
        self.organizations = []
        self.activeOrganizationId = nil
        self.permissions = []
        self.roleInOrg = nil
        self.workloadLeads = []
        self.quota = nil
        self.memberLocations = []
        self.sessionExpired = false
        Task { await OfflineCache.shared.clear() }
    }

    func refreshAll() async {
        guard let api else { return }
        // Marker prosjekter som «laster» FØR vi fyrer av kall. Hvis kortet
        // er i .idle vil det ellers ende på empty-state i 1-2 sek mens
        // fetchProjects pågår — bug fra PR #993 som denne fixen løser.
        if case .loaded = projectsLoadState {
            // Behold loaded-state ved bakgrunns-refresh så pageren ikke
            // blinker til skeleton; bare flip når vi er i idle/failed.
        } else {
            projectsLoadState = .loading
        }
        if case .loaded = leadsLoadState {} else { leadsLoadState = .loading }
        if case .loaded = calendarLoadState {} else { calendarLoadState = .loading }
        let proj = activeProjectId
        async let leadsTask = api.fetchLeads(projectId: proj)
        async let competitorsTask = api.fetchCompetitors(projectId: proj)
        async let metricsTask = api.fetchMetrics(projectId: proj)
        async let calendarTask = api.fetchCalendar(projectId: proj)
        async let remindersTask = api.fetchReminders(projectId: proj)
        async let projectsTask = api.fetchProjects()

        // Vent FØRST på projects-listen så vi kan validere activeProjectId
        // og auto-clear hvis den peker på et arkivert/slettet prosjekt.
        // Uten dette: 45 arkiverte testprosjekter i DB → stale UserDefaults
        // → 404 fra leads/competitors/metrics → top-level catch → ErrorCard.
        var projectsLoaded = false
        do {
            let newProjects = try await projectsTask
            self.projects = newProjects
            self.projectsLoadState = .loaded
            projectsLoaded = true

            // FIX 2: Hvis activeProjectId peker på et prosjekt som ikke
            // lenger er i lista (arkivert/slettet/byttet bruker), auto-
            // clear og fallback til første aktive. Dette tilbakestiller
            // også UserDefaults via activeProjectId.didSet.
            if let activeId = activeProjectId,
               !newProjects.contains(where: { $0.id == activeId }) {
                print("[AppState] activeProjectId \(activeId) not in projects list — auto-clearing")
                activeProjectId = newProjects.first?.id
                // didSet vil trigge ny refreshAll() + loadProjectSummary() —
                // vi avbryter resten av denne runden ettersom de pågående
                // tasks holder stale proj-ID-en og vil kunne 404.
                _ = try? await leadsTask
                _ = try? await competitorsTask
                _ = try? await metricsTask
                _ = try? await calendarTask
                _ = try? await remindersTask
                return
            }
            // Auto-velg første prosjekt hvis ingen aktiv — matcher
            // syncIndexFromActiveProject i MapProjectCard og gir
            // umiddelbart kart-pins ved første start.
            if activeProjectId == nil, let first = newProjects.first {
                activeProjectId = first.id
                _ = try? await leadsTask
                _ = try? await competitorsTask
                _ = try? await metricsTask
                _ = try? await calendarTask
                _ = try? await remindersTask
                return
            }
        } catch {
            print("[AppState] fetchProjects failed: \(error)")
            handleAPIError(error)
            let retryable = (error as? APIError)?.isRetryable ?? true
            self.projectsLoadState = .failed(error.localizedDescription, isRetryable: retryable)
        }

        do {
            // FIX 3: Pakk per-prosjekt-kall slik at 404 (stale projectId
            // som ennå ikke er fanget av FIX 2 — race-vindu) ikke kaster
            // hele refreshAll i bakken. Returnerer tom-fallback ved 404
            // som er ufarlig — neste tick rydder UserDefaults via FIX 2.
            let newLeads: [LeadModel]
            do { newLeads = try await leadsTask }
            catch let apiError as APIError where apiError.isNotFound {
                print("[AppState] fetchLeads 404 — using empty fallback (stale projectId)")
                newLeads = []
            }
            let newComps: [CompetitorModel]
            do { newComps = try await competitorsTask }
            catch let apiError as APIError where apiError.isNotFound {
                print("[AppState] fetchCompetitors 404 — using empty fallback")
                newComps = []
            }
            let newMetricsOpt: MetricsModel?
            do { newMetricsOpt = try await metricsTask }
            catch let apiError as APIError where apiError.isNotFound {
                print("[AppState] fetchMetrics 404 — keeping cached state")
                newMetricsOpt = nil
            }
            let newCal: [CalendarEvent]
            do { newCal = try await calendarTask }
            catch let apiError as APIError where apiError.isNotFound {
                print("[AppState] fetchCalendar 404 — using empty fallback")
                newCal = []
            }
            let newRemOpt: RemindersResponse?
            do { newRemOpt = try await remindersTask }
            catch let apiError as APIError where apiError.isNotFound {
                print("[AppState] fetchReminders 404 — keeping cached state")
                newRemOpt = nil
            }

            self.leads = newLeads
            self.leadsLoadState = .loaded
            self.calendarLoadState = .loaded
            self.competitors = newComps
            if let m = newMetricsOpt { self.metrics = m }
            self.calendar = newCal
            if let r = newRemOpt { self.reminders = r }
            self.lastSyncAt = Date()
            self.isUsingStaleCache = false

            // Lagre snapshot til disk
            await OfflineCache.shared.save(newLeads, named: "leads")
            await OfflineCache.shared.save(newComps, named: "competitors")
            if let m = newMetricsOpt {
                await OfflineCache.shared.save(m, named: "metrics")
            }
            await OfflineCache.shared.save(newCal, named: "calendar")
            if let r = newRemOpt {
                await OfflineCache.shared.save(r, named: "reminders")
            }

            // Flush pending visits hvis vi er online
            let result = await OfflineCache.shared.flush(using: api)
            if result.succeeded > 0 {
                print("[AppState] Flushed \(result.succeeded) pending visits")
            }
            self.pendingVisitsCount = await OfflineCache.shared.pendingCount()

            // Skriv widget-snapshot til delt App Group container
            writeWidgetSnapshot()
        } catch {
            print("[AppState] refresh failed (using cache): \(error)")
            self.isUsingStaleCache = true
            handleAPIError(error)
            // Hvis vi var midt i en initial-fetch og ALT feilet (typisk
            // network down + ingen cache), surface error i kortet i stedet
            // for å la det stå evig på «laster prosjekter…». Men hvis
            // projects ble lastet OK, behold .loaded-state.
            if !projectsLoaded, case .loading = projectsLoadState {
                let retryable = (error as? APIError)?.isRetryable ?? true
                self.projectsLoadState = .failed(error.localizedDescription, isRetryable: retryable)
            }
        }
    }


    /// Skriver siste data til App Group container så widget kan lese.
    /// Trigges automatisk etter hver vellykket refreshAll.
    private func writeWidgetSnapshot() {
        let activeName = activeProjectId.flatMap { id in
            projects.first(where: { $0.id == id })?.name
        }
        let dueItems = (reminders?.dueToday ?? []).prefix(5).compactMap { due -> WidgetSnapshot.DueItem? in
            let date = ISO8601DateFormatter().date(from: due.datetime)
            return WidgetSnapshot.DueItem(
                leadName: due.name,
                datetime: date,
                nextAction: due.nextAction
            )
        }
        let snapshot = WidgetSnapshot(
            activeProjectName: activeName,
            totalLeads: metrics?.totalLeads ?? 0,
            followUpsDue: metrics?.followUpsDue ?? 0,
            meetingsBooked: metrics?.meetingsBooked ?? 0,
            staleOver30: reminders?.buckets.over30days ?? 0,
            staleOver14: reminders?.buckets.over14days ?? 0,
            staleOver7: reminders?.buckets.over7days ?? 0,
            dueToday: Array(dueItems),
            writtenAt: Date()
        )
        WidgetSnapshotStore.write(snapshot)
        // Be WidgetCenter om å reloade timelines
        Task { @MainActor in
            #if canImport(WidgetKit)
            WidgetCenter.shared.reloadAllTimelines()
            #endif
        }
    }

    /// Log en visit — bruker backend hvis tilgjengelig, ellers
    /// legger i offline-kø som flushes ved neste vellykkede refresh.
    /// `body` serialiseres til JSON-Data før kryssing av actor-grense for
    /// å unngå non-Sendable [String:Any].
    func enqueueOrSendVisit(leadId: String, body: [String: Any]) async throws {
        guard let api else { throw URLError(.userAuthenticationRequired) }
        let payload = try JSONSerialization.data(withJSONObject: body)
        do {
            try await api.logVisitRaw(leadId: leadId, jsonBody: payload)
        } catch {
            await OfflineCache.shared.enqueueRaw(leadId: leadId, jsonBody: payload)
            self.pendingVisitsCount = await OfflineCache.shared.pendingCount()
            throw OfflineEnqueuedError()
        }
    }

    // MARK: - Cache-loading

    private func loadFromCache() async {
        if let cached: (value: [LeadModel], age: TimeInterval) = await OfflineCache.shared.load([LeadModel].self, named: "leads") {
            self.leads = cached.value
            self.lastSyncAt = Date().addingTimeInterval(-cached.age)
            self.isUsingStaleCache = true
            // Cache regnes som «loaded» — Leads-fanen skal vise dataene,
            // ikke skeleton, mens nett-refresh pågår i bakgrunnen.
            self.leadsLoadState = .loaded
        }
        if let cached: (value: [CompetitorModel], age: TimeInterval) = await OfflineCache.shared.load([CompetitorModel].self, named: "competitors") {
            self.competitors = cached.value
        }
        if let cached: (value: MetricsModel, age: TimeInterval) = await OfflineCache.shared.load(MetricsModel.self, named: "metrics") {
            self.metrics = cached.value
        }
        if let cached: (value: [CalendarEvent], age: TimeInterval) = await OfflineCache.shared.load([CalendarEvent].self, named: "calendar") {
            self.calendar = cached.value
            self.calendarLoadState = .loaded
        }
        if let cached: (value: RemindersResponse, age: TimeInterval) = await OfflineCache.shared.load(RemindersResponse.self, named: "reminders") {
            self.reminders = cached.value
        }
        self.pendingVisitsCount = await OfflineCache.shared.pendingCount()
    }
}

/// Signal til UI om at visit ble lagret offline, ikke sendt til backend ennå.
struct OfflineEnqueuedError: LocalizedError {
    var errorDescription: String? {
        "Lagret offline. Sendes når dekning er tilbake."
    }
}

/// Load-state for prosjekt-listen som vises i MapProjectCard-pageren.
///
/// PR #993 introduserte multi-prosjekt-swipe på MapProjectCard. Den viste
/// «Ingen prosjekter ennå»-empty-state hvis `appState.projects.isEmpty`,
/// men ved app-start er listen tom inntil fetchProjects returnerer →
/// brukeren så empty-state i 1-2 sek selv om de hadde 4 prosjekter.
///
/// Tre tilstander:
///   - `.idle`     — ingen fetch igangsatt enda (rett etter init)
///   - `.loading`  — fetch pågår, vis skeleton
///   - `.loaded`   — fetch fullført; bruk `projects.isEmpty` for ekte empty
///   - `.failed`   — nettverksfeil; vis retry-card
///
/// `failed`-casen carries en lokalisert melding + `isRetryable`-flag som
/// ErrorProjectCard bruker for å velge mellom "Prøv igjen" og
/// "Logg inn på nytt"-CTA. Default-init (bakvert-kompat) gir
/// `isRetryable: true`.
enum ProjectsLoadState: Equatable {
    case idle
    case loading
    case loaded
    case failed(String, isRetryable: Bool = true)

    static func == (lhs: ProjectsLoadState, rhs: ProjectsLoadState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.loading, .loading), (.loaded, .loaded):
            return true
        case let (.failed(a, ar), .failed(b, br)):
            return a == b && ar == br
        default:
            return false
        }
    }
}
