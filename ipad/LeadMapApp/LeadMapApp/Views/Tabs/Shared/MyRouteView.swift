// MyRouteView.swift
//
// HUD Navigation Mode (redesign 2026-07-02). Fullscreen kart med svevende
// HUD-strips i F1-telemetry-stil — ikke tradisjonell sheet-med-toolbar:
//
//   • Top-strip:    NESTE STOPP + ETA · avstand-widget · retning + speed
//   • Bottom-strip: Progress-bar + antall + status-pill (PÅ RUTE/AVVIK/AV RUTE)
//   • Left-column:  Speed (km/h) · klokke · deviation (m)
//   • Kart:         gradient rute-linjer, pulserende ring på neste stopp
//
// Presenteres via `.sheet` med clear background så kartet fyller hele.
// Swipe-down eller X-knapp øverst-høyre lukker.

import SwiftUI
import MapKit

struct MyRouteView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var camera: MapCameraPosition = .automatic
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var showNavigate = false
    @State private var showTimeline = false
    @State private var currentTime = Date()
    @State private var currentCoord: CLLocationCoordinate2D?

    /// Klokke-tick hvert sekund så tid-widget oppdateres.
    private let clockTimer = Timer.publish(every: 1.0, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            mapBackground
                .ignoresSafeArea()

            if loading {
                loadingHUD
            } else if RouteTracker.shared.currentAssignment == nil {
                emptyHUD
            } else {
                hudLayout
            }
        }
        .presentationBackground(.clear)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .task { await refresh() }
        .onReceive(clockTimer) { now in
            currentTime = now
            currentCoord = KartLocationManager.shared.currentCoordinate
        }
    }

    // MARK: - Map background (fullscreen)

    private var mapBackground: some View {
        let stops = RouteTracker.shared.currentAssignment?.stops ?? []
        let visits = RouteTracker.shared.visits
        let visitedIds = Set(visits.map(\.stopLeadId))
        let completedCoords = stops.filter { visitedIds.contains($0.leadId) }.map(\.coordinate)
        let remainingCoords = stops.filter { !visitedIds.contains($0.leadId) }.map(\.coordinate)
        let nextStopId = RouteTracker.shared.nextStop?.leadId

        return Map(position: $camera, interactionModes: [.pan, .zoom]) {
            if let coord = KartLocationManager.shared.currentCoordinate {
                Annotation("Meg", coordinate: coord) {
                    MeMapPin(initials: appState.initials, email: appState.userEmail)
                }
            }
            ForEach(stops) { stop in
                Annotation("", coordinate: stop.coordinate) {
                    stopPin(
                        stop: stop,
                        visited: visitedIds.contains(stop.leadId),
                        visit: visits.first(where: { $0.stopLeadId == stop.leadId }),
                        isNext: stop.leadId == nextStopId
                    )
                }
            }
            // Utført del: gradient blå → cyan (heltrukket)
            if completedCoords.count >= 2 {
                MapPolyline(coordinates: completedCoords)
                    .stroke(HUDPalette.cyan, style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
                MapPolyline(coordinates: completedCoords)
                    .stroke(HUDPalette.blue.opacity(0.5), style: StrokeStyle(lineWidth: 10, lineCap: .round))
            }
            // Gjenstår: stiplet cyan
            if remainingCoords.count >= 2 {
                MapPolyline(coordinates: remainingCoords)
                    .stroke(HUDPalette.cyan.opacity(0.85),
                            style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [10, 8]))
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
        .onAppear {
            fitCameraToRoute()
            currentCoord = KartLocationManager.shared.currentCoordinate
        }
    }

    private func fitCameraToRoute() {
        let stops = RouteTracker.shared.currentAssignment?.stops ?? []
        guard !stops.isEmpty else { return }
        let coords = stops.map(\.coordinate)
        let lats = coords.map(\.latitude)
        let lons = coords.map(\.longitude)
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: (lats.min()! + lats.max()!) / 2,
                longitude: (lons.min()! + lons.max()!) / 2
            ),
            span: MKCoordinateSpan(
                latitudeDelta: max(0.01, (lats.max()! - lats.min()!) * 1.4),
                longitudeDelta: max(0.01, (lons.max()! - lons.min()!) * 1.4)
            )
        )
        camera = .region(region)
    }

    private func stopPin(stop: RouteStopDTO, visited: Bool, visit: RouteVisitDTO?, isNext: Bool) -> some View {
        let color: Color = {
            if visited {
                return (visit?.wasOnRoute ?? true) ? HUDPalette.green : HUDPalette.red
            }
            if isNext { return HUDPalette.yellow }
            return HUDPalette.cyan
        }()
        return ZStack {
            if isNext {
                // Pulserende ytre ring
                Circle()
                    .strokeBorder(HUDPalette.yellow.opacity(0.55), lineWidth: 3)
                    .frame(width: 60, height: 60)
                    .shadow(color: HUDPalette.yellow, radius: 12)
            }
            Circle()
                .fill(color)
                .frame(width: 32, height: 32)
                .overlay(Circle().strokeBorder(.white, lineWidth: 2))
                .shadow(color: color.opacity(0.7), radius: 6)
            Text("\(stop.orderIndex + 1)")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
    }

    // MARK: - Main HUD layout

    private var hudLayout: some View {
        ZStack {
            // Top strip
            VStack {
                topStrip
                Spacer()
            }

            // Left column (svever i venstre-side)
            HStack {
                VStack {
                    leftColumn
                        .padding(.top, 110)
                    Spacer()
                }
                Spacer()
            }

            // Right controls (X + tools) — svever øverst-høyre
            VStack {
                HStack {
                    Spacer()
                    rightControls
                }
                .padding(.top, 12)
                .padding(.trailing, 20)
                Spacer()
            }

            // Bottom strip
            VStack {
                Spacer()
                if showTimeline {
                    timelineHUD
                        .padding(.bottom, 6)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                bottomStrip
            }

            if let errorMessage {
                VStack {
                    Spacer()
                    Text(errorMessage)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(HUDPalette.red)
                        .padding(12)
                        .hudGlass(cornerRadius: 12, glow: HUDPalette.red)
                        .padding(.bottom, 140)
                }
            }
        }
        .fullScreenCover(isPresented: $showNavigate) {
            navigatePlaceholder
        }
    }

    // MARK: - Top strip (Next stop + ETA + Distance + Direction)

    private var topStrip: some View {
        let ns = RouteTracker.shared.nextStop
        let dist = RouteTracker.shared.distanceToNextStopM
        let eta = RouteTracker.shared.etaMinutes
        return HStack(alignment: .center, spacing: 14) {
            // Left: Next stop
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    HUDLiveDot(color: HUDPalette.yellow, size: 6)
                    HUDLabel(text: "NESTE STOPP", size: 10, color: HUDPalette.yellow, tracking: 1.4)
                }
                Text(ns.map { stopTitle($0) } ?? "Rute fullført")
                    .font(HUDFont.title(15))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let arrivalTime = ns?.plannedArrivalTime {
                    Text("Planlagt ankomst \(arrivalTime)")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(HUDPalette.textDim)
                }
            }

            Spacer(minLength: 8)

            // Center: Distance
            if let d = dist {
                HUDMetric(
                    value: distanceText(d),
                    label: "AVSTAND",
                    color: HUDPalette.blue,
                    valueSize: 28,
                    alignment: .center
                )
            }

            Spacer(minLength: 8)

            // Right: ETA
            HUDMetric(
                value: eta.map { "\($0)" } ?? "—",
                label: eta != nil ? "MIN ETA" : "ETA",
                color: HUDPalette.green,
                valueSize: 28,
                alignment: .trailing
            )

            // Direction-arrow (roterer med heading)
            directionArrow
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .hudGlass(cornerRadius: 20, glow: HUDPalette.blue, glowRadius: 12)
        .padding(.horizontal, 20)
        .padding(.top, 20)
    }

    private var directionArrow: some View {
        let heading = KartLocationManager.shared.heading
        return ZStack {
            Circle()
                .fill(HUDPalette.blue.opacity(0.2))
                .frame(width: 48, height: 48)
            Circle()
                .strokeBorder(HUDPalette.blue.opacity(0.7), lineWidth: 1.5)
                .frame(width: 48, height: 48)
            Image(systemName: "location.north.fill")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(HUDPalette.blue)
                .rotationEffect(.degrees(heading ?? 0))
                .shadow(color: HUDPalette.blue, radius: 4)
                .animation(.easeInOut(duration: 0.2), value: heading)
        }
    }

    // MARK: - Left column (Speed / Clock / Deviation)

    private var leftColumn: some View {
        VStack(spacing: 12) {
            leftTile(
                value: speedText,
                label: "KM/H",
                color: HUDPalette.orange
            )
            leftTile(
                value: clockText,
                label: "KLOKKE",
                color: HUDPalette.blue
            )
            leftTile(
                value: deviationText,
                label: "AVVIK M",
                color: deviationColor
            )
        }
        .padding(10)
        .hudGlass(cornerRadius: 16, glow: HUDPalette.blue.opacity(0.5), glowRadius: 8)
        .padding(.leading, 12)
    }

    private func leftTile(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(HUDFont.metric(22))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.55)
                .frame(width: 66)
            HUDLabel(text: label, size: 9, tracking: 1.1)
                .lineLimit(1)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 4)
    }

    // MARK: - Right controls (Close + Timeline + Refresh + Navigate)

    private var rightControls: some View {
        VStack(spacing: 10) {
            HUDCloseButton { dismiss() }
            hudIconButton(icon: showTimeline ? "list.bullet.rectangle.fill" : "list.bullet.rectangle",
                          color: HUDPalette.purple) {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    showTimeline.toggle()
                }
            }
            HUDRefreshButton {
                Task { await refresh() }
            }
            if RouteTracker.shared.nextStop != nil {
                hudIconButton(icon: "location.north.line.fill", color: HUDPalette.orange) {
                    showNavigate = true
                }
            }
        }
    }

    private func hudIconButton(icon: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle().fill(.ultraThinMaterial)
                Circle().strokeBorder(color.opacity(0.55), lineWidth: 1)
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(color)
            }
            .frame(width: 40, height: 40)
            .shadow(color: color.opacity(0.45), radius: 6)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Bottom strip (Progress + Adherence)

    private var bottomStrip: some View {
        let progress = RouteTracker.shared.progress
        let total = max(1, (progress?.completed ?? 0) + (progress?.remaining ?? 0))
        let completed = progress?.completed ?? 0
        let fraction = Double(completed) / Double(total)

        return VStack(spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    HUDLabel(text: "PROGRESS")
                    Text("\(completed) av \(total) stopp fullført")
                        .font(HUDFont.title(13))
                        .foregroundStyle(.white)
                }
                Spacer()
                Text("\(Int(fraction * 100)) %")
                    .font(HUDFont.metric(24))
                    .foregroundStyle(HUDPalette.green)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(HUDPalette.green.opacity(0.15), in: Capsule())
                    .overlay(Capsule().strokeBorder(HUDPalette.green.opacity(0.5), lineWidth: 1))
                adherencePill
            }
            // Progress-bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.10))
                    // Stiplet grå gjenstår-sone
                    Capsule()
                        .stroke(Color.white.opacity(0.20), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        .frame(width: geo.size.width)
                    // Heltrukket grønn utført
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [HUDPalette.green, HUDPalette.cyan],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * fraction)
                        .shadow(color: HUDPalette.green.opacity(0.7), radius: 6)
                    // Diamant-markør ved current position
                    Rectangle()
                        .fill(Color.white)
                        .frame(width: 3, height: 12)
                        .rotationEffect(.degrees(0))
                        .offset(x: geo.size.width * fraction - 1.5)
                        .shadow(color: .white, radius: 4)
                }
            }
            .frame(height: 10)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .hudGlass(cornerRadius: 20, glow: HUDPalette.green, glowRadius: 10)
        .padding(.horizontal, 20)
        .padding(.bottom, 28)
    }

    private var adherencePill: some View {
        switch RouteTracker.shared.adherenceStatus {
        case .onRoute:
            return AnyView(HUDStatusPill(icon: "checkmark.circle.fill", text: "PÅ RUTE", color: HUDPalette.green))
        case .warning:
            return AnyView(HUDStatusPill(icon: "exclamationmark.triangle.fill", text: "AVVIK", color: HUDPalette.yellow))
        case .offRoute:
            return AnyView(HUDStatusPill(icon: "xmark.octagon.fill", text: "AV RUTE", color: HUDPalette.red))
        case .noRoute:
            return AnyView(HUDStatusPill(icon: "circle.dashed", text: "INGEN RUTE", color: HUDPalette.textDim))
        }
    }

    // MARK: - Timeline HUD (list av alle stopp)

    private var timelineHUD: some View {
        let stops = RouteTracker.shared.currentAssignment?.stops ?? []
        let visits = RouteTracker.shared.visits
        let visitedById = Dictionary(uniqueKeysWithValues: visits.map { ($0.stopLeadId, $0) })

        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                HUDLabel(text: "ALLE STOPP")
                Spacer()
                Text("\(stops.count)")
                    .font(HUDFont.label(11))
                    .foregroundStyle(HUDPalette.textDim)
            }
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(stops) { stop in
                        timelineRow(stop: stop, visit: visitedById[stop.leadId])
                    }
                }
            }
            .frame(maxHeight: 220)
        }
        .padding(14)
        .hudGlass(cornerRadius: 18, glow: HUDPalette.purple, glowRadius: 8)
        .padding(.horizontal, 20)
    }

    private func timelineRow(stop: RouteStopDTO, visit: RouteVisitDTO?) -> some View {
        let visited = visit != nil
        let onRoute = visit?.wasOnRoute ?? true
        let color: Color = visited ? (onRoute ? HUDPalette.green : HUDPalette.red) : HUDPalette.cyan
        return HStack(spacing: 10) {
            ZStack {
                Circle().fill(color.opacity(0.25))
                Circle().strokeBorder(color.opacity(0.7), lineWidth: 1)
                if visited {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(color)
                } else {
                    Text("\(stop.orderIndex + 1)")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(color)
                }
            }
            .frame(width: 24, height: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(stopTitle(stop))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let t = stop.plannedArrivalTime {
                        Text(t)
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                            .foregroundStyle(HUDPalette.textFaint)
                    }
                    if let v = visit, let dev = v.deviationFromPlannedM {
                        Text("· \(dev) m avvik")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundStyle(onRoute ? HUDPalette.green : HUDPalette.red)
                    }
                }
            }
            Spacer()
        }
        .contentShape(Rectangle())
    }

    // MARK: - Loading / Empty HUDs

    private var loadingHUD: some View {
        VStack(spacing: 14) {
            ProgressView()
                .tint(HUDPalette.blue)
                .scaleEffect(1.4)
            HUDLabel(text: "Henter dagens rute…", size: 12)
        }
        .padding(30)
        .hudGlass(cornerRadius: 20, glow: HUDPalette.blue)
    }

    private var emptyHUD: some View {
        VStack(spacing: 12) {
            Image(systemName: "map.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(HUDPalette.textDim)
            Text("INGEN RUTE I DAG")
                .font(HUDFont.title(15))
                .tracking(1.5)
                .foregroundStyle(.white)
            Text("Salgssjefen kan tildele deg en planlagt rute.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(HUDPalette.textDim)
                .multilineTextAlignment(.center)
            Button {
                dismiss()
            } label: {
                Text("LUKK")
                    .font(HUDFont.label(11))
                    .tracking(1.3)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 10)
                    .background(HUDPalette.blue.opacity(0.25), in: Capsule())
                    .overlay(Capsule().strokeBorder(HUDPalette.blue.opacity(0.7), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .padding(.top, 6)
        }
        .padding(30)
        .frame(maxWidth: 320)
        .hudGlass(cornerRadius: 20, glow: HUDPalette.blue)
    }

    // MARK: - Navigate placeholder (Apple Maps hand-off)

    private var navigatePlaceholder: some View {
        let stop = RouteTracker.shared.nextStop
        return ZStack {
            HUDPalette.blue.opacity(0.05).ignoresSafeArea()
            VStack(spacing: 20) {
                Image(systemName: "location.north.line.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(HUDPalette.orange)
                    .shadow(color: HUDPalette.orange, radius: 12)
                Text("ÅPNE I APPLE MAPS")
                    .font(HUDFont.title(15))
                    .tracking(1.5)
                    .foregroundStyle(.white)
                if let stop {
                    Text(stopTitle(stop))
                        .font(.system(size: 13))
                        .foregroundStyle(HUDPalette.textDim)
                }
                HStack(spacing: 12) {
                    Button {
                        guard let stop else { return }
                        let item = MKMapItem(placemark: MKPlacemark(coordinate: stop.coordinate))
                        item.name = "Stopp #\(stop.orderIndex + 1)"
                        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
                        showNavigate = false
                    } label: {
                        Text("ÅPNE")
                            .font(HUDFont.label(12))
                            .tracking(1.3)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 30)
                            .padding(.vertical, 14)
                            .background(HUDPalette.orange, in: Capsule())
                            .shadow(color: HUDPalette.orange, radius: 10)
                    }
                    .buttonStyle(.plain)

                    Button("Avbryt") { showNavigate = false }
                        .foregroundStyle(HUDPalette.textDim)
                }
            }
            .padding(40)
            .hudGlass(cornerRadius: 22, glow: HUDPalette.orange)
            .padding(20)
        }
    }

    // MARK: - Helpers

    private func stopTitle(_ stop: RouteStopDTO) -> String {
        "Stopp #\(stop.orderIndex + 1) · \(String(stop.leadId.prefix(22)))"
    }

    private func distanceText(_ meters: Int) -> String {
        if meters >= 1000 {
            let km = Double(meters) / 1000
            return String(format: "%.1f km", km)
        }
        return "\(meters) m"
    }

    private var speedText: String {
        if let mps = KartLocationManager.shared.speedMps, mps > 0 {
            return String(Int(mps * 3.6))
        }
        return "0"
    }

    private var clockText: String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: currentTime)
    }

    private var deviationText: String {
        if let d = RouteTracker.shared.currentDeviationM {
            return "\(d)"
        }
        return "—"
    }

    private var deviationColor: Color {
        guard let d = RouteTracker.shared.currentDeviationM else { return HUDPalette.textDim }
        return HUDColorScale.forDeviation(d)
    }

    // MARK: - Data

    @MainActor
    private func refresh() async {
        loading = true
        errorMessage = nil
        defer { loading = false }
        if let api = appState.api {
            RouteTracker.shared.attach(api: api)
        }
        await RouteTracker.shared.refreshRoute()
        fitCameraToRoute()
    }
}
