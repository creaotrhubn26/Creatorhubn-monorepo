// LeadgridHubView.swift
//
// Ny tab i MapScreen — "Leadgrid"-hub som samler alle CRM-paritets-views.
// Navigerer til inbox / dashboard / scheduled-reports / prefs / export.

import SwiftUI

struct LeadgridHubView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            List {
                Section("CRM") {
                    if let api = appState.api {
                        NavigationLink {
                            LeadgridLeadInboxView(api: api)
                        } label: {
                            Label("Mine tildelte leads", systemImage: "tray.fill")
                        }
                        NavigationLink {
                            LeadgridWonLostDashboardView(api: api)
                        } label: {
                            Label("Vunnet / Tapt-dashboard",
                                   systemImage: "chart.line.uptrend.xyaxis")
                        }
                    }
                }
                Section("Varsler") {
                    Button {
                        appState.presentingLeadgridNotifications = true
                    } label: {
                        HStack {
                            Label("Innboks", systemImage: "bell.fill")
                                .foregroundStyle(.primary)
                            Spacer()
                            if appState.leadgridUnreadCount > 0 {
                                Text("\(appState.leadgridUnreadCount)")
                                    .font(.caption.bold())
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(Color.red, in: Capsule())
                                    .foregroundStyle(.white)
                            }
                        }
                    }
                    Button {
                        appState.presentingLeadgridPrefs = true
                    } label: {
                        Label("Varsels-innstillinger", systemImage: "gearshape.fill")
                            .foregroundStyle(.primary)
                    }
                }
                Section("Rapporter & eksport") {
                    if let api = appState.api {
                        NavigationLink {
                            LeadgridScheduledReportsView(api: api)
                        } label: {
                            Label("Schedulerte rapporter", systemImage: "clock.fill")
                        }
                    }
                    Button {
                        appState.presentingLeadgridExport = true
                    } label: {
                        Label("Eksporter leads (CSV)", systemImage: "square.and.arrow.up.fill")
                            .foregroundStyle(.primary)
                    }
                }
            }
            .navigationTitle("Leadgrid CRM")
            .sheet(isPresented: Binding(
                get: { appState.presentingLeadgridNotifications },
                set: { appState.presentingLeadgridNotifications = $0 }
            )) {
                LeadgridNotificationInboxView()
            }
            .sheet(isPresented: Binding(
                get: { appState.presentingLeadgridPrefs },
                set: { appState.presentingLeadgridPrefs = $0 }
            )) {
                if let api = appState.api {
                    LeadgridNotificationPrefsView(api: api)
                }
            }
            .sheet(isPresented: Binding(
                get: { appState.presentingLeadgridExport },
                set: { appState.presentingLeadgridExport = $0 }
            )) {
                if let api = appState.api {
                    LeadgridExportShareView(api: api)
                }
            }
            .task {
                await appState.refreshLeadgridNotifications()
            }
            .onReceive(NotificationCenter.default.publisher(
                for: .leadgridNotificationTapped
            )) { notif in
                if let payload = notif.userInfo as? [String: String] {
                    appState.handleLeadgridNotificationTap(payload)
                }
            }
        }
    }
}
