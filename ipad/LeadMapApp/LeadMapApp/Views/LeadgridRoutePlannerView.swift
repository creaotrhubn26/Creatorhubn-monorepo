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

    // 2026-08-19: flerdagers-tur ("kjør en uke i Nord-Norge") — se
    // planTrip()/tripView() nedenfor. Egen state fremfor å overlaste
    // routeDetail/phase.form, som er enkelt-dags-flyten uendret.
    @State private var multiDayMode = false
    @State private var tripDays = 3
    @State private var tripStartDate = Date()
    @State private var tripPlan: LeadgridRouteTripPlanResponse?
    @State private var selectedDayIndex = 0
    @State private var tripCameraPosition: MapCameraPosition = .automatic
    @State private var prewarming = false
    @State private var prewarmedDayCount = 0

    enum Phase { case form, planning, route, trip }

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
            case .trip:
                if let tripPlan {
                    tripView(tripPlan)
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
                Toggle("Flerdagerstur", isOn: $multiDayMode.animation())
                if multiDayMode {
                    DatePicker("Startdato", selection: $tripStartDate, displayedComponents: .date)
                    Stepper("Antall dager: \(tripDays)", value: $tripDays, in: 1...14)
                    Text("Hver dag planlegges som en egen dagsrute — dag 2 starter der dag 1 sluttet, så turen henger geografisk sammen i stedet for å hoppe frem og tilbake.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Section {
                Button {
                    Task { multiDayMode ? await planTrip() : await planRoute() }
                } label: {
                    if planning {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Label(multiDayMode ? "Planlegg \(tripDays)-dagers tur" : "Planlegg dagsrute", systemImage: "map.fill")
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

    // MARK: - Trip view (flerdagers, 2026-08-19)

    @ViewBuilder
    private func tripView(_ plan: LeadgridRouteTripPlanResponse) -> some View {
        VStack(spacing: 0) {
            dayTabBar(plan)
            let day = plan.days.indices.contains(selectedDayIndex) ? plan.days[selectedDayIndex] : nil
            if let route = day?.route {
                prewarmBar(plan)
                tripMapView(route)
                    .frame(maxHeight: 260)
                HStack(spacing: 12) {
                    statPill(icon: "location.fill", value: formatDistance(route.totalDistanceMeters ?? 0))
                    statPill(icon: "clock.fill", value: formatDuration(route.totalDriveSeconds ?? 0))
                    statPill(icon: "list.number", value: "\(route.stops.count) stopp")
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                List {
                    ForEach(route.stops) { stop in
                        Button { selectedStop = stop } label: { stopRow(stop) }
                            .buttonStyle(.plain)
                    }
                }
            } else {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "mappin.slash").font(.largeTitle).foregroundStyle(.secondary)
                    Text(day?.message ?? "Ingen leads denne dagen").foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            }
        }
    }

    @ViewBuilder
    private func dayTabBar(_ plan: LeadgridRouteTripPlanResponse) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(plan.days) { day in
                    Button {
                        selectedDayIndex = day.dayIndex - 1
                    } label: {
                        VStack(spacing: 2) {
                            Text("Dag \(day.dayIndex)").font(.caption.bold())
                            Text(day.plannedDate.suffix(5)).font(.caption2)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(
                            selectedDayIndex == day.dayIndex - 1 ? Color.purple : Color(.tertiarySystemBackground),
                            in: Capsule()
                        )
                        .foregroundStyle(selectedDayIndex == day.dayIndex - 1 ? .white : (day.route == nil ? .secondary : .primary))
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
        .background(.regularMaterial)
    }

    /// Best-effort: MapKit har ingen offentlig API for garantert offline
    /// kart-nedlasting (i motsetning til f.eks. Google Maps SDK). Dette
    /// panorerer kartet gjennom hele turens område mens man har nett, som
    /// nudger MapKits egen interne fliscache — reelt, men ikke garantert.
    @ViewBuilder
    private func prewarmBar(_ plan: LeadgridRouteTripPlanResponse) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi").font(.caption2).foregroundStyle(.secondary)
            if prewarming {
                Text("Forhåndslaster kart · dag \(prewarmedDayCount)/\(plan.days.count) …")
                    .font(.caption2).foregroundStyle(.secondary)
                ProgressView().controlSize(.mini)
            } else {
                Text("Forhåndsvarm kartet for hele turen før du kjører ut dødsoner — best-effort, ikke garantert.")
                    .font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Button("Forhåndsvarm") { Task { await prewarmMapForTrip(plan) } }
                    .font(.caption2.bold())
                    .disabled(plan.days.allSatisfy { $0.route == nil })
            }
        }
        .padding(.horizontal).padding(.vertical, 6)
        .background(Color.purple.opacity(0.06))
    }

    @ViewBuilder
    private func tripMapView(_ route: LeadgridRouteDetail) -> some View {
        Map(position: $tripCameraPosition) {
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
        .onAppear { focusTripCamera(on: route) }
        .onChange(of: selectedDayIndex) { _, _ in
            guard let days = tripPlan?.days, days.indices.contains(selectedDayIndex),
                  let r = days[selectedDayIndex].route else { return }
            focusTripCamera(on: r)
        }
    }

    private func focusTripCamera(on route: LeadgridRouteDetail) {
        let coords = route.stops.compactMap { stop -> CLLocationCoordinate2D? in
            guard let lat = stop.latitude, let lng = stop.longitude else { return nil }
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
        let allCoords = coords + (startLocation.map { [$0] } ?? [])
        withAnimation(.easeInOut(duration: 0.4)) {
            tripCameraPosition = .region(computeRegion(allCoords))
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
    private func planTrip() async {
        guard let start = startLocation else { return }
        planning = true
        errorText = nil
        phase = .planning
        do {
            let plan = try await api.planRouteTrip(
                startDate: Self.isoDateFormatter.string(from: tripStartDate),
                days: tripDays,
                startLat: start.latitude,
                startLng: start.longitude
            )
            if plan.days.allSatisfy({ $0.route == nil }) {
                errorText = "Ingen aktuelle leads i din sone for noen av dagene."
                phase = .form
            } else {
                tripPlan = plan
                selectedDayIndex = plan.days.firstIndex { $0.route != nil } ?? 0
                phase = .trip
            }
        } catch {
            errorText = "Kunne ikke planlegge tur: \(error.localizedDescription)"
            phase = .form
        }
        planning = false
    }

    private static let isoDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    /// Panorerer kartet gjennom hver dags område i turen mens man har nett
    /// — se prewarmBar() for begrunnelse/begrensning.
    @MainActor
    private func prewarmMapForTrip(_ plan: LeadgridRouteTripPlanResponse) async {
        prewarming = true
        prewarmedDayCount = 0
        for day in plan.days {
            guard let route = day.route else { continue }
            selectedDayIndex = day.dayIndex - 1
            focusTripCamera(on: route)
            prewarmedDayCount += 1
            try? await Task.sleep(nanoseconds: 900_000_000)
        }
        prewarming = false
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
