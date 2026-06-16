// MapScreen.swift
//
// Hovedskjerm: MapKit fullscreen + bottom sheet med KPI-stripe.
// SKELETON — pin-rendering kommer i fase 3.

import SwiftUI
import MapKit

struct MapScreen: View {
    @Environment(AppState.self) private var appState
    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: .init(latitude: 59.9139, longitude: 10.7522), // Oslo
            span: .init(latitudeDelta: 0.15, longitudeDelta: 0.30)
        )
    )

    var body: some View {
        Map(position: $camera) {
            ForEach(appState.leads) { lead in
                Annotation(lead.name, coordinate: .init(latitude: lead.latitude, longitude: lead.longitude)) {
                    StatusPin(status: lead.status, selected: appState.selectedLead?.id == lead.id)
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
        }
        .mapStyle(.standard(elevation: .flat))
        .sheet(item: Binding(
            get: { appState.selectedLead },
            set: { appState.selectedLead = $0 }
        )) { lead in
            LeadDetailSheet(lead: lead)
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                if let metrics = appState.metrics {
                    Text("\(metrics.totalLeads) leads")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Oppdater", systemImage: "arrow.clockwise") {
                        Task { await appState.refreshAll() }
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
