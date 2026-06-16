// AppState.swift
//
// Global observable state. Sentralisert auth + last-fetched data så
// vi unngår å re-fetche samme info i forskjellige views.

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

    // Aktivt valgt
    var selectedLead: LeadModel?
    var selectedCompetitor: CompetitorModel?

    func bootstrap() async {
        // Last token fra Keychain
        if let token = AuthClient.loadToken() {
            self.authToken = token
            self.userEmail = AuthClient.loadEmail()
            self.api = APIClient(token: token)
            await refreshAll()
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
    }

    func refreshAll() async {
        guard let api else { return }
        async let leadsTask = api.fetchLeads()
        async let competitorsTask = api.fetchCompetitors()
        async let metricsTask = api.fetchMetrics()
        async let calendarTask = api.fetchCalendar()
        async let remindersTask = api.fetchReminders()
        do {
            self.leads = try await leadsTask
            self.competitors = try await competitorsTask
            self.metrics = try await metricsTask
            self.calendar = try await calendarTask
            self.reminders = try await remindersTask
        } catch {
            print("[AppState] refresh failed: \(error)")
        }
    }
}
