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
    @State private var showDrawingSheet = false
    @State private var showCardScanner = false
    @State private var showResearchStart = false
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
                    // Kart-annotasjoner (PR #629) — fokus-områder, ruter, callouts
                    ForEach(appState.annotations) { annot in
                        annotationOverlay(annot)
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
                    LeadgridNotificationBellView()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Oppdater", systemImage: "arrow.clockwise") {
                            Task { await appState.refreshAll() }
                        }
                        if #available(iOS 16.0, *) {
                            Button("Skann visittkort", systemImage: "camera.viewfinder") {
                                showCardScanner = true
                            }
                        }
                        if appState.canCreateAnnotations {
                            Button("Tegn på kart", systemImage: "pencil.tip.crop.circle") {
                                showDrawingSheet = true
                            }
                        }
                        // Lead Research er en VALGFRI tilleggsfunksjon.
                        // Vises kun hvis orgen har gitt brukeren
                        // lead_research.run-permission. Resten av Lead Map
                        // fungerer som vanlig uten denne — manuelle leads,
                        // kart, status, pitch-presentasjoner.
                        if appState.permissions.contains("lead_research.run") {
                            Button("Finn nye leads", systemImage: "magnifyingglass.circle") {
                                showResearchStart = true
                            }
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
            .sheet(isPresented: $showDrawingSheet) {
                AnnotationDrawingView(
                    initialRegion: camera.region
                )
            }
            .sheet(isPresented: $showCardScanner) {
                if #available(iOS 16.0, *) {
                    BusinessCardScannerView()
                }
            }
            .sheet(isPresented: $showResearchStart) {
                LeadResearchStartView()
            }
        }
    }

    /// Render én annotasjon som MapContent. Type-spesifikk: Polygon for
    /// focus_area, Polyline for route/freehand, Marker for pin_callout.
    @MapContentBuilder
    private func annotationOverlay(_ annot: MapAnnotation) -> some MapContent {
        let color = Color(hex: annot.color.trimmingCharacters(in: CharacterSet(charactersIn: "#")))
        let coords = annot.coordinates
        if let type = annot.typeEnum {
            switch type {
            case .focusArea where coords.count >= 3:
                MapPolygon(coordinates: coords)
                    .stroke(color, lineWidth: annot.strokeWidth)
                    .foregroundStyle(color.opacity(0.18))
            case .route, .freehand:
                if coords.count >= 2 {
                    MapPolyline(coordinates: coords)
                        .stroke(color, lineWidth: annot.strokeWidth)
                }
            case .pinCallout:
                if let p = coords.first {
                    Annotation(annot.title ?? "Notat", coordinate: p) {
                        AnnotationCalloutPin(annot: annot, color: color)
                    }
                }
            default:
                EmptyMapContent()
            }
        }
    }
}

/// Liten "tekst-boble"-pin for pin_callout-annotasjoner.
private struct AnnotationCalloutPin: View {
    let annot: MapAnnotation
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "text.bubble.fill")
                    .font(.caption)
                Text(annot.title ?? "Notat")
                    .font(.caption.bold())
                    .lineLimit(1)
            }
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(color.opacity(0.85), in: Capsule())
            .foregroundStyle(.white)
            .shadow(radius: 2)
        }
        .accessibilityLabel(annot.title ?? "Annotasjon")
    }
}

private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
