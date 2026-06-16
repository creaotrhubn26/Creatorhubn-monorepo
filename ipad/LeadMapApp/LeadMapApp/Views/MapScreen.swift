// MapScreen.swift
//
// Hovedflyt: TabView m/ Map, Calendar, og Reminders som tabs.
// Map er hjemmebanen for feltsalg, Calendar viser hva som er
// planlagt, Reminders viser hva som ligger og venter.

import SwiftUI
import MapKit

struct MapScreen: View {
    var body: some View {
        TabView {
            MapHomeView()
                .tabItem {
                    Label("Kart", systemImage: "map.fill")
                }
            CalendarView()
                .tabItem {
                    Label("Kalender", systemImage: "calendar")
                }
            StaleLeadsList()
                .tabItem {
                    Label("Stille", systemImage: "bell.badge")
                }
        }
    }
}

/// Selve Map-tab'en — MapKit fullscreen + reminders-banner + toolbar.
struct MapHomeView: View {
    @Environment(AppState.self) private var appState
    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: .init(latitude: 59.9139, longitude: 10.7522), // Oslo
            span: .init(latitudeDelta: 0.15, longitudeDelta: 0.30)
        )
    )

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Map(position: $camera) {
                    ForEach(appState.leads) { lead in
                        Annotation(lead.name, coordinate: .init(latitude: lead.latitude, longitude: lead.longitude)) {
                            LeadPinView(lead: lead, selected: appState.selectedLead?.id == lead.id)
                                .onTapGesture { appState.selectedLead = lead }
                        }
                    }
                    ForEach(appState.competitors.compactMap { c -> (CompetitorModel, CLLocationCoordinate2D)? in
                        guard let lat = c.latitude, let lng = c.longitude else { return nil }
                        return (c, .init(latitude: lat, longitude: lng))
                    }, id: \.0.id) { comp, coord in
                        Annotation(comp.name, coordinate: coord) {
                            CompetitorPin(threat: comp.threatLevel, selected: appState.selectedCompetitor?.id == comp.id)
                                .onTapGesture { appState.selectedCompetitor = comp }
                        }
                    }
                    // Live selger-pins (PR #612)
                    ForEach(appState.memberLocations) { m in
                        Annotation(m.displayName ?? m.role,
                                   coordinate: .init(latitude: m.lat, longitude: m.lng)) {
                            MemberPinView(member: m)
                        }
                    }
                }
                .mapStyle(.standard(elevation: .flat))
                .ignoresSafeArea(edges: .bottom)

                // Topp-overlay: prosjekt-kort + reminders-banner
                VStack(spacing: 8) {
                    ProjectContextCard()
                        .padding(.top, 4)
                    RemindersBanner()
                    Spacer()
                }
            }
            .sheet(item: Binding(
                get: { appState.selectedLead },
                set: { appState.selectedLead = $0 }
            )) { lead in
                LeadDetailSheet(lead: lead)
            }
            .sheet(item: Binding(
                get: { appState.selectedCompetitor },
                set: { appState.selectedCompetitor = $0 }
            )) { competitor in
                CompetitorDetailSheet(competitor: competitor)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HStack(spacing: 6) {
                        ProjectPicker()
                        if let metrics = appState.metrics {
                            Text("\(metrics.totalLeads) leads")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                        }
                        if appState.isUsingStaleCache {
                            Image(systemName: "wifi.exclamationmark")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                        if appState.pendingVisitsCount > 0 {
                            Label("\(appState.pendingVisitsCount)", systemImage: "arrow.triangle.2.circlepath")
                                .font(.caption.bold())
                                .foregroundStyle(.orange)
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Oppdater", systemImage: "arrow.clockwise") {
                            Task { await appState.refreshAll() }
                        }
                        if appState.pendingVisitsCount > 0 {
                            Button("Send \(appState.pendingVisitsCount) ventende", systemImage: "paperplane") {
                                Task { await appState.refreshAll() }
                            }
                        }
                        Button("Logg ut", systemImage: "person.crop.circle.badge.minus") {
                            appState.signOut()
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
    }
}
