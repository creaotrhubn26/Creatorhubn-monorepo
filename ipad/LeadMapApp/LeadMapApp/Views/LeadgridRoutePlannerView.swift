// LeadgridRoutePlannerView.swift
//
// iPad Route Planner-UI for Leadgrid (PR #856 + #870 backend).
// 3-fase flyt: form (sett startpunkt) → planning → route (kart + stopp-liste).
// Backend autovelger in-grid leads m/ høyest priority + nærmeste-nabo via
// Google Distance Matrix (haversine-fallback). UI lar selger se kart med
// nummererte pins, navigere via Apple Maps, og oppdatere stopp-status i felt.

import SwiftUI
import MapKit
import CoreLocation
import UIKit

struct LeadgridRoutePlannerView: View {
    let api: APIClient
    @State private var phase: Phase = .form
    @State private var startLocation: CLLocationCoordinate2D?
    @State private var routeDetail: LeadgridRouteDetail?
    @State private var errorText: String?
    @State private var planning = false
    @State private var locationManager = CLLocationManager()
    @State private var selectedStop: LeadgridRouteStop?

    enum Phase { case form, planning, route }

    var body: some View {
        Group {
            switch phase {
            case .form:
                formView
            case .planning:
                ProgressView("Planlegger optimal rute...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .route:
                if let route = routeDetail {
                    routeView(route)
                }
            }
        }
        .navigationTitle("Dagsrute")
        .sheet(item: $selectedStop) { stop in
            stopDetailSheet(stop)
        }
    }

    // MARK: - Form

    @ViewBuilder
    private var formView: some View {
        Form {
            Section("Start") {
                Button {
                    requestLocation()
                } label: {
                    Label("Bruk min posisjon", systemImage: "location.fill")
                }
                if let loc = startLocation {
                    Text("Lat: \(String(format: "%.4f", loc.latitude)), Lng: \(String(format: "%.4f", loc.longitude))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Section {
                Button {
                    Task { await planRoute() }
                } label: {
                    if planning {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Label("Planlegg dagsrute", systemImage: "map.fill")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(startLocation == nil || planning)
                .buttonStyle(.borderedProminent)
                .tint(.purple)
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
            Section {
                Text("Backend velger automatisk inn-grid leads med høy prioritet, og optimaliserer nærmeste-nabo via Google Distance Matrix (m/ haversine-fallback).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Route view (stats + map + list)

    @ViewBuilder
    private func routeView(_ route: LeadgridRouteDetail) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                statPill(icon: "location.fill", value: formatDistance(route.totalDistanceMeters ?? 0))
                statPill(icon: "clock.fill", value: formatDuration(route.totalDriveSeconds ?? 0))
                statPill(icon: "banknote.fill", value: "\(Int((route.expectedRouteValue ?? 0) / 1000))k kr", color: .green)
                statPill(icon: "list.number", value: "\(route.stops.count) stopp")
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(.regularMaterial)

            mapView(route)
                .frame(maxHeight: 300)

            List {
                ForEach(route.stops) { stop in
                    Button {
                        selectedStop = stop
                    } label: {
                        stopRow(stop)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func mapView(_ route: LeadgridRouteDetail) -> some View {
        let coords = route.stops.compactMap { stop -> CLLocationCoordinate2D? in
            guard let lat = stop.latitude, let lng = stop.longitude else { return nil }
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
        let allCoords = coords + (startLocation.map { [$0] } ?? [])
        let region = computeRegion(allCoords)
        Map(initialPosition: .region(region)) {
            if let start = startLocation {
                Marker("Start", systemImage: "house.fill", coordinate: start)
                    .tint(.blue)
            }
            ForEach(route.stops) { stop in
                if let lat = stop.latitude, let lng = stop.longitude {
                    Annotation(
                        stop.name ?? "Lead",
                        coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng)
                    ) {
                        ZStack {
                            Circle().fill(.purple).frame(width: 28, height: 28)
                            Text("\(stop.position)").foregroundStyle(.white).font(.caption.bold())
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func stopRow(_ stop: LeadgridRouteStop) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(stopColor(stop.status ?? "pending")).frame(width: 30, height: 30)
                Text("\(stop.position)").foregroundStyle(.white).font(.caption.bold())
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(stop.name ?? "Lead").font(.subheadline.bold())
                HStack(spacing: 6) {
                    if let d = stop.distanceFromPreviousMeters {
                        Text(formatDistance(d)).font(.caption).foregroundStyle(.secondary)
                    }
                    if let s = stop.driveSecondsFromPrevious {
                        Text(formatDuration(s)).font(.caption).foregroundStyle(.secondary)
                    }
                    if let status = stop.status, status != "pending" {
                        Text(statusLabel(status))
                            .font(.caption2.bold())
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(stopColor(status).opacity(0.2), in: Capsule())
                            .foregroundStyle(stopColor(status))
                    }
                }
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }

    // MARK: - Action-sheet

    @ViewBuilder
    private func stopDetailSheet(_ stop: LeadgridRouteStop) -> some View {
        NavigationStack {
            Form {
                Section(stop.name ?? "Lead") {
                    if stop.stopId != nil {
                        actionButton("Naviger hit", icon: "location.north.line.fill", color: .blue) {
                            openInMaps(stop)
                        }
                        actionButton("Marker som ankommet", icon: "checkmark.circle.fill", color: .orange) {
                            Task { await updateStatus(stop, status: "arrived") }
                        }
                        actionButton("Marker som besøkt", icon: "checkmark.seal.fill", color: .green) {
                            Task { await updateStatus(stop, status: "visited") }
                        }
                        actionButton("Hopp over", icon: "forward.fill", color: .gray) {
                            Task { await updateStatus(stop, status: "skipped") }
                        }
                        actionButton("Ingen svarer", icon: "questionmark.bubble.fill", color: .orange) {
                            Task { await updateStatus(stop, status: "no_answer") }
                        }
                    } else {
                        Text("Stopp-ID mangler — kan ikke oppdatere status.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Stopp \(stop.position)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { selectedStop = nil }
                }
            }
        }
    }

    @ViewBuilder
    private func actionButton(_ title: String, icon: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .foregroundStyle(color)
        }
    }

    @ViewBuilder
    private func statPill(icon: String, value: String, color: Color = .primary) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.caption2)
            Text(value).font(.caption.bold())
        }
        .foregroundStyle(color)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(color.opacity(0.1), in: Capsule())
    }

    // MARK: - Helpers

    private func stopColor(_ status: String) -> Color {
        switch status {
        case "arrived": return .orange
        case "visited": return .green
        case "skipped": return .gray
        case "no_answer": return .red
        default: return .purple
        }
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "arrived": return "Ankommet"
        case "visited": return "Besøkt"
        case "skipped": return "Hoppet over"
        case "no_answer": return "Ingen svar"
        default: return status
        }
    }

    private func formatDistance(_ m: Int) -> String {
        if m >= 1000 { return String(format: "%.1f km", Double(m) / 1000) }
        return "\(m) m"
    }

    private func formatDuration(_ s: Int) -> String {
        if s >= 3600 { return "\(s / 3600)t \(s % 3600 / 60)m" }
        if s >= 60 { return "\(s / 60) min" }
        return "\(s) sek"
    }

    private func computeRegion(_ coords: [CLLocationCoordinate2D]) -> MKCoordinateRegion {
        guard !coords.isEmpty else {
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 59.91, longitude: 10.75),
                span: MKCoordinateSpan(latitudeDelta: 1, longitudeDelta: 1)
            )
        }
        let lats = coords.map { $0.latitude }
        let lngs = coords.map { $0.longitude }
        let minLat = lats.min() ?? 0
        let maxLat = lats.max() ?? 0
        let minLng = lngs.min() ?? 0
        let maxLng = lngs.max() ?? 0
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: (minLat + maxLat) / 2,
                longitude: (minLng + maxLng) / 2
            ),
            span: MKCoordinateSpan(
                latitudeDelta: max(0.02, (maxLat - minLat) * 1.4),
                longitudeDelta: max(0.02, (maxLng - minLng) * 1.4)
            )
        )
    }

    private func requestLocation() {
        locationManager.requestWhenInUseAuthorization()
        if let loc = locationManager.location {
            startLocation = loc.coordinate
        } else {
            // Default Oslo som fallback hvis posisjon ikke er klar enda.
            startLocation = CLLocationCoordinate2D(latitude: 59.913868, longitude: 10.752245)
        }
    }

    private func openInMaps(_ stop: LeadgridRouteStop) {
        guard let lat = stop.latitude, let lng = stop.longitude else { return }
        guard let url = URL(string: "maps://?daddr=\(lat),\(lng)&dirflg=d") else { return }
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
    }

    // MARK: - Actions

    @MainActor
    private func planRoute() async {
        guard let start = startLocation else { return }
        planning = true
        errorText = nil
        phase = .planning
        do {
            let route = try await api.planRoute(
                startLat: start.latitude,
                startLng: start.longitude,
                limit: 12
            )
            if let route {
                routeDetail = route
                phase = .route
            } else {
                errorText = "Ingen aktuelle leads i din sone akkurat nå."
                phase = .form
            }
        } catch {
            errorText = "Kunne ikke planlegge rute: \(error.localizedDescription)"
            phase = .form
        }
        planning = false
    }

    @MainActor
    private func updateStatus(_ stop: LeadgridRouteStop, status: String) async {
        guard let stopId = stop.stopId, let routeId = routeDetail?.id else { return }
        do {
            try await api.updateRouteStop(
                routeId: routeId, stopId: stopId, status: status
            )
            // Refresh route detail
            let full = try await api.fetchRoute(routeId)
            routeDetail = LeadgridRouteDetail(
                id: full.route.id,
                name: full.route.name,
                totalDistanceMeters: full.route.totalDistanceMeters,
                totalDriveSeconds: full.route.totalDriveSeconds,
                expectedRouteValue: full.route.expectedRouteValue,
                matrixSource: full.route.matrixSource,
                stops: full.stops
            )
            selectedStop = nil
        } catch {
            errorText = "Kunne ikke oppdatere: \(error.localizedDescription)"
        }
    }
}
