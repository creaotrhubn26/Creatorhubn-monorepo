// LeadgridHubView.swift
//
// Verktøy-hub for spesialiserte CRM-flater som ikke allerede har en
// naturlig plass i hovedfanene, den globale headeren eller Profil.

import SwiftUI

struct LeadgridHubView: View {
    @Environment(AppState.self) private var appState
    /// 2026-08-19: unngår nestet NavigationStack når denne pushes inn i en
    /// eksisterende stack (PhoneMerTab/iPad-sidebar-detail har begge sin
    /// egen) — samme mønster som LeadgridGoDashboardView/KvalitetView/
    /// AnbudView/SalgsledelseView allerede bruker.
    var embedded: Bool = false

    var body: some View {
        Group {
            if embedded {
                content
            } else {
                NavigationStack { content }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
            List {
                // Plan-quota øverst (fase 16) — viser kun hvis api + orgId klar.
                if appState.api != nil, appState.activeOrganizationId != nil {
                    Section {
                        LeadgridPlanUsageBar()
                            .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                }

                Section("CRM") {
                    if let api = appState.api,
                       let projectId = appState.activeLeadgridProjectId {
                        NavigationLink {
                            LeadgridWonLostDashboardView(
                                api: api,
                                projectId: projectId
                            )
                        } label: {
                            Label("Vunnet / Tapt-dashboard",
                                   systemImage: "chart.line.uptrend.xyaxis")
                        }
                    } else {
                        Label("Velg kundeprosjekt for Vunnet / Tapt",
                              systemImage: "chart.line.uptrend.xyaxis")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Research") {
                    if let api = appState.api {
                        NavigationLink {
                            LeadgridResearchListView(api: api)
                        } label: {
                            Label("Kjør AI-research på lead",
                                   systemImage: "sparkles.rectangle.stack")
                        }
                    }
                }

                Section("Discovery") {
                    Button {
                        appState.discoveryCoordinator.showWorkspace()
                    } label: {
                        Label("Profiler, kandidater og markedsinnsikt",
                              systemImage: "scope")
                            .foregroundStyle(.primary)
                    }
                }

                // Route Planner (PR #856 + #870) — kart + nummererte stopp + Apple Maps-nav.
                Section("Rute") {
                    if let api = appState.api {
                        NavigationLink {
                            LeadgridRoutePlannerView(api: api)
                        } label: {
                            Label("Dagsrute", systemImage: "map.fill")
                        }
                    }
                }

                // Intelligence Engine (PR #855) — NBA + pipeline + score-breakdown.
                Section("Intelligence") {
                    if let api = appState.api {
                        // Følg-opp-kø: portet inn i ny `LeadsView` i Pakke 10 (2026-07-01).
                        // Bruk hovedfane «Leads» — denne snarveien er fjernet.
                        NavigationLink {
                            LeadgridPipelineKanbanView(api: api)
                        } label: {
                            Label("Pipeline-kanban", systemImage: "rectangle.split.3x1.fill")
                        }
                        NavigationLink {
                            LeadgridAllRecommendationsView(api: api)
                        } label: {
                            Label("Alle NBA-anbefalinger", systemImage: "sparkles")
                        }
                    }
                }

                // Salgsledelse: portet inn i ny `OversiktView`'s
                // SalesLeadershipSheet (Pakke 10) — bruk hovedfanen «Oversikt»
                // og åpne sheet fra header-CTA.

                // Analytics Dashboard (PR #858 backend) — 7 KPI-endepunkter
                // som SwiftUI Charts (5 seksjoner).
                Section("Analyse") {
                    if let api = appState.api {
                        NavigationLink {
                            LeadgridAnalyticsDashboardView(api: api)
                        } label: {
                            Label("Analytics Dashboard",
                                   systemImage: "chart.line.uptrend.xyaxis")
                        }
                    }
                }

                Section("Rapporter & eksport") {
                    Button {
                        appState.presentingLeadgridExport = true
                    } label: {
                        Label("Eksporter leads (CSV)", systemImage: "square.and.arrow.up.fill")
                            .foregroundStyle(.primary)
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
            .navigationTitle("Verktøy")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    OrgPickerToolbarMenu()
                }
            }
            .marketingDirectorBackdrop(.crmHome)
            .sheet(isPresented: Binding(
                get: { appState.presentingLeadgridExport },
                set: { appState.presentingLeadgridExport = $0 }
            )) {
                if let api = appState.api {
                    LeadgridExportShareView(api: api)
                }
            }
            .fullScreenCover(isPresented: Binding(
                get: { appState.discoveryCoordinator.isPresented },
                set: { presented in
                    if presented { appState.discoveryCoordinator.showWorkspace() }
                    else { appState.discoveryCoordinator.dismissWorkspace() }
                }
            )) {
                DiscoveryWorkspaceView(coordinator: appState.discoveryCoordinator)
            }
    }
}
