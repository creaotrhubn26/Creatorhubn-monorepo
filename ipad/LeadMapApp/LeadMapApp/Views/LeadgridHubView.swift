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
                // Plan-quota øverst (fase 16) — viser kun hvis api + orgId klar.
                if let api = appState.api, let orgId = appState.activeOrganizationId {
                    Section {
                        LeadgridPlanUsageBar(api: api, orgId: orgId)
                            .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                }

                Section("CRM") {
                    // Oversikt-dashboard m/ KPI, kart, salgsledelse.
                    // Toppnivå-inngangspunkt for hele Leadgrid-erfaringen.
                    NavigationLink {
                        OversiktView()
                    } label: {
                        Label("Oversikt", systemImage: "rectangle.grid.2x2.fill")
                    }
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
                Section("Klient-onboarding") {
                    if let api = appState.api {
                        NavigationLink {
                            LeadgridChannelOnboardingWizardView(api: api)
                        } label: {
                            Label("Sett opp varslings-kanaler", systemImage: "checkmark.shield.fill")
                        }
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

                // Fase 16: Partner-program + Billing
                Section("Partnere & faktura") {
                    if let api = appState.api {
                        NavigationLink {
                            LeadgridPartnersView(api: api)
                        } label: {
                            Label("Partner-program", systemImage: "person.2.circle.fill")
                        }
                        NavigationLink {
                            LeadgridBillingView(api: api)
                        } label: {
                            Label("Faktura & abonnement", systemImage: "creditcard.fill")
                        }
                    }
                }

                // Fase 18: Super-admin (vises bare for Daniel — B2B-pipeline +
                // alle superadmin-flows fra felt).
                if appState.isSuperAdmin {
                    Section {
                        NavigationLink {
                            SuperAdminHubView()
                        } label: {
                            Label("Super Admin", systemImage: "shield.checkered")
                                .foregroundStyle(.purple)
                        }
                    }
                }
            }
            .navigationTitle("Leadgrid CRM")
            .marketingDirectorBackdrop(.crmHome)
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
