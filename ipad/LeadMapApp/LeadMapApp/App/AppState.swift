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

    // Klienter (lazy-init når token er satt)
    private(set) var api: APIClient?

    // Cached data (refreshes ved pull-down + periodisk)
    var leads: [LeadModel] = []
    var competitors: [CompetitorModel] = []
    var metrics: MetricsModel?
    var calendar: [CalendarEvent] = []
    var reminders: RemindersResponse?

    // Prosjekt-kontekst — hvilken bedrift jobber jeg for?
    var projects: [ProjectListItem] = []
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

    // ── Org + RBAC (PR #611–#615) ───────────────────────────────
    var organizations: [OrganizationSummary] = []
    var activeOrganizationId: String? {
        didSet {
            if let id = activeOrganizationId {
                UserDefaults.standard.set(id, forKey: "rr.lead_map.active_org")
            } else {
                UserDefaults.standard.removeObject(forKey: "rr.lead_map.active_org")
            }
            Task {
                await loadOrgContext()
                await refreshWorkload()
            }
        }
    }
    /// Effective permissions for current user i active org.
    var permissions: Set<String> = []
    var roleInOrg: String?
    var locationConsentGranted: Bool = false

    // ── Min dag (PR #616) ───────────────────────────────────────
    var workloadLeads: [WorkloadLead] = []
    var quota: QuotaProgress?

    // ── Live selger-pins (PR #612) ─────────────────────────────
    var memberLocations: [MemberLocation] = []

    // ── Varsler (PR #622) ──────────────────────────────────────
    var unreadNotificationsCount: Int = 0
    private var notificationsPollTask: Task<Void, Never>?

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

    // ── Heartbeat-loop ─────────────────────────────────────────
    private var heartbeatController: HeartbeatController?

    var activeOrganization: OrganizationSummary? {
        organizations.first { $0.id == activeOrganizationId }
    }

    func can(_ permissionKey: String) -> Bool {
        permissions.contains(permissionKey)
    }

    func bootstrap() async {
        // 1. Hent persistert prosjekt + org-valg
        if let stored = UserDefaults.standard.string(forKey: "rr.lead_map.active_project"), !stored.isEmpty {
            self.activeProjectId = stored
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
            await refreshAll()
            if let id = activeProjectId {
                await loadProjectSummary(id: id)
            }
            await loadOrganizations()
            await loadOrgContext()
            await startHeartbeatIfNeeded()
            startNotificationsPolling()
            await refreshAnnotations()
            if let api = self.api {
                ProximityMonitor.shared.configure(api: api)
            }
        }
    }

    /// Last alle organisasjoner brukeren er medlem av.
    func loadOrganizations() async {
        guard let api else { return }
        do {
            self.organizations = try await api.fetchOrganizations()
            // Auto-velg første hvis ingen aktiv
            if activeOrganizationId == nil, let first = organizations.first {
                self.activeOrganizationId = first.id
            }
        } catch {
            print("[AppState] loadOrganizations failed: \(error)")
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
        async let permTask = api.fetchPermissions(organizationId: orgId)
        async let consentTask = api.fetchLocationConsent(orgId)
        async let locsTask = api.fetchMemberLocations(orgId)
        do {
            let perm = try await permTask
            self.permissions = Set(perm.permissions)
            self.roleInOrg = perm.role
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
            print("[AppState] projectSummary failed: \(error)")
        }
    }

    func signIn(token: String, email: String?) async {
        AuthClient.saveToken(token, email: email)
        self.authToken = token
        self.userEmail = email
        self.api = APIClient(token: token)
        await refreshAll()
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
        self.organizations = []
        self.activeOrganizationId = nil
        self.permissions = []
        self.roleInOrg = nil
        self.workloadLeads = []
        self.quota = nil
        self.memberLocations = []
        Task { await OfflineCache.shared.clear() }
    }

    func refreshAll() async {
        guard let api else { return }
        let proj = activeProjectId
        async let leadsTask = api.fetchLeads(projectId: proj)
        async let competitorsTask = api.fetchCompetitors(projectId: proj)
        async let metricsTask = api.fetchMetrics(projectId: proj)
        async let calendarTask = api.fetchCalendar(projectId: proj)
        async let remindersTask = api.fetchReminders(projectId: proj)
        async let projectsTask = api.fetchProjects()
        do {
            let newLeads = try await leadsTask
            let newComps = try await competitorsTask
            let newMetrics = try await metricsTask
            let newCal = try await calendarTask
            let newRem = try await remindersTask
            self.projects = (try? await projectsTask) ?? []

            self.leads = newLeads
            self.competitors = newComps
            self.metrics = newMetrics
            self.calendar = newCal
            self.reminders = newRem
            self.lastSyncAt = Date()
            self.isUsingStaleCache = false

            // Lagre snapshot til disk
            await OfflineCache.shared.save(newLeads, named: "leads")
            await OfflineCache.shared.save(newComps, named: "competitors")
            await OfflineCache.shared.save(newMetrics, named: "metrics")
            await OfflineCache.shared.save(newCal, named: "calendar")
            await OfflineCache.shared.save(newRem, named: "reminders")

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
        }
        if let cached: (value: [CompetitorModel], age: TimeInterval) = await OfflineCache.shared.load([CompetitorModel].self, named: "competitors") {
            self.competitors = cached.value
        }
        if let cached: (value: MetricsModel, age: TimeInterval) = await OfflineCache.shared.load(MetricsModel.self, named: "metrics") {
            self.metrics = cached.value
        }
        if let cached: (value: [CalendarEvent], age: TimeInterval) = await OfflineCache.shared.load([CalendarEvent].self, named: "calendar") {
            self.calendar = cached.value
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
