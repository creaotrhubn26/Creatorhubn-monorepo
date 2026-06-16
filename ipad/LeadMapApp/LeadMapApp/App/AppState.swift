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

    func bootstrap() async {
        // 1. Hent persistert prosjekt-valg før vi laster cache så
        //    refreshAll bruker riktig filter umiddelbart.
        if let stored = UserDefaults.standard.string(forKey: "rr.lead_map.active_project"), !stored.isEmpty {
            self.activeProjectId = stored
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
        AuthClient.clear()
        self.authToken = nil
        self.userEmail = nil
        self.api = nil
        self.leads = []
        self.competitors = []
        self.metrics = nil
        self.calendar = []
        self.reminders = nil
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
        } catch {
            print("[AppState] refresh failed (using cache): \(error)")
            self.isUsingStaleCache = true
        }
    }

    /// Log en visit — bruker backend hvis tilgjengelig, ellers
    /// legger i offline-kø som flushes ved neste vellykkede refresh.
    func enqueueOrSendVisit(leadId: String, body: [String: Any]) async throws {
        guard let api else { throw URLError(.userAuthenticationRequired) }
        do {
            try await api.logVisit(leadId: leadId, body: body)
        } catch {
            // Offline → legg i kø
            await OfflineCache.shared.enqueue(leadId: leadId, body: body)
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
