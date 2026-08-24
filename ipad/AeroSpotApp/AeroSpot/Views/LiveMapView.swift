// LiveMapView.swift — MapKit-kart med fly (heading-rotert, fargekodet på
// status/rarity/militær), spor, innflygingskorridorer, sol-indikator,
// spottepunkt-kort, avstandslinje, kart/satellitt-toggle og filter-chips.

import SwiftUI
import MapKit

struct LiveMapView: View {
    @Environment(AppModel.self) private var model

    @State private var cameraPosition: MapCameraPosition = .automatic
    @State private var mapStyleSatellite = false
    @State private var spotSelection: SpottingLocation?

    var body: some View {
        @Bindable var model = model
        ZStack(alignment: .top) {
            mapLayer
            topControls
        }
        .onAppear {
            model.requestLocation()
            recenter()
        }
        .onChange(of: model.activeAirportIcao) { _, _ in recenter() }
        .sheet(item: $model.selectedFlight) { flight in
            FlightDetailSheet(flight: flight)
                .presentationDetents([.medium, .large])
                .presentationBackground(Theme.surface)
        }
        .sheet(item: $spotSelection) { spot in
            SpottingLocationSheet(location: spot)
                .presentationDetents([.medium, .large])
                .presentationBackground(Theme.surface)
        }
    }

    private func recenter() {
        withAnimation {
            cameraPosition = .region(
                MKCoordinateRegion(
                    center: model.activeAirport.coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.9)
                )
            )
        }
    }

    // MARK: - Kart

    private var mapLayer: some View {
        Map(position: $cameraPosition) {
            corridorOverlay
            runwayOverlays
            trailOverlays
            distanceLine
            spotAnnotations
            flightAnnotations
            UserAnnotation()
        }
        .mapStyle(
            mapStyleSatellite
                ? .hybrid(elevation: .flat)
                : .standard(elevation: .flat, pointsOfInterest: .excludingAll)
        )
    }

    @MapContentBuilder
    private var corridorOverlay: some MapContent {
        if let runway = model.runway,
           let corridor = model.activeAirport.approachCorridor(for: runway.runway) {
            MapPolygon(coordinates: corridor)
                .foregroundStyle(Theme.primary.opacity(0.14))
                .stroke(Theme.primaryBright.opacity(0.4), lineWidth: 1)
        }
    }

    @MapContentBuilder
    private var runwayOverlays: some MapContent {
        ForEach(model.activeAirport.runways) { runway in
            MapPolyline(coordinates: [runway.thresholdA, runway.thresholdB])
                .stroke(
                    isActive(runway) ? Theme.primaryBright : Theme.textTertiary,
                    lineWidth: isActive(runway) ? 5 : 3
                )
        }
    }

    @MapContentBuilder
    private var trailOverlays: some MapContent {
        ForEach(model.visibleFlights) { flight in
            if let trail = model.trails[flight.id], trail.count > 1 {
                MapPolyline(coordinates: trail)
                    .stroke(
                        iconColor(flight).opacity(0.5),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round)
                    )
            }
        }
    }

    @MapContentBuilder
    private var distanceLine: some MapContent {
        if let selected = model.selectedFlight, let user = model.userCoordinate {
            MapPolyline(coordinates: [user, selected.coordinate])
                .stroke(Theme.primaryBright.opacity(0.7), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
        }
    }

    @MapContentBuilder
    private var spotAnnotations: some MapContent {
        ForEach(model.activeSpots) { location in
            Annotation(location.name, coordinate: location.coordinate) {
                Circle()
                    .fill(Theme.success)
                    .frame(width: 12, height: 12)
                    .overlay(Circle().stroke(.white, lineWidth: 2))
                    .onTapGesture { spotSelection = location }
            }
        }
    }

    @MapContentBuilder
    private var flightAnnotations: some MapContent {
        ForEach(model.visibleFlights) { flight in
            Annotation("", coordinate: flight.coordinate) {
                FlightMarker(
                    flight: flight,
                    color: iconColor(flight),
                    selected: flight.id == model.selectedFlight?.id
                )
                .onTapGesture { model.selectedFlight = flight }
            }
        }
    }

    // MARK: - Kontroller

    private var topControls: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack {
                infoChips
                Spacer()
                sunIndicator
                Button {
                    mapStyleSatellite.toggle()
                } label: {
                    Image(systemName: mapStyleSatellite ? "map.fill" : "globe.americas.fill")
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)
                        .padding(Theme.spacingSM)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                }
            }
            filterChips
        }
        .padding(Theme.spacingMD)
    }

    private var infoChips: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            if let weather = model.weather {
                chip(icon: "wind", text: "\(Int(weather.windDirectionDeg))° \(weather.windSpeedKt) kt")
            }
            if let runway = model.runway {
                chip(icon: "airplane.arrival", text: "Bane \(runway.runway) (estimert)")
            }
        }
    }

    private func chip(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.caption2)
            Text(text).font(.caption.weight(.semibold))
        }
        .foregroundStyle(Theme.textPrimary)
        .padding(.horizontal, Theme.spacingMD)
        .padding(.vertical, Theme.spacingSM)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
    }

    /// Sol-retningspil (asimut) — hvor lyset kommer fra.
    @ViewBuilder
    private var sunIndicator: some View {
        if let sun = model.sun, sun.elevationDeg > -4 {
            VStack(spacing: 1) {
                Image(systemName: "sun.max.fill")
                    .font(.caption)
                    .foregroundStyle(Theme.gold)
                    .rotationEffect(.degrees(sun.azimuthDeg))
                Text("\(Int(sun.azimuthDeg))°")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
            }
            .padding(Theme.spacingSM)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSm))
        }
    }

    private var filterChips: some View {
        @Bindable var model = model
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.spacingSM) {
                ForEach(AppModel.MapFilter.allCases, id: \.self) { item in
                    Button {
                        model.mapFilter = item
                    } label: {
                        Text(item.rawValue)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.vertical, Theme.spacingSM)
                            .background(model.mapFilter == item ? Theme.primary : Color.black.opacity(0.4))
                            .foregroundStyle(model.mapFilter == item ? .white : Theme.textSecondary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Hjelpere

    private func isActive(_ runway: Runway) -> Bool {
        guard let active = model.runway?.runway else { return false }
        return runway.id == active || runway.reciprocal == active
    }

    /// Fargekode: valgt = lyseblå, militær = grønn, sjelden = gull,
    /// approach (synkende, lav) = grønn-blå, ellers gul.
    private func iconColor(_ flight: LiveFlight) -> Color {
        if flight.id == model.selectedFlight?.id { return Theme.primaryBright }
        if flight.isMilitary { return Color(hex: 0x6DBE45) }
        if flight.rarity.rank >= 2 { return Theme.gold }
        if !flight.onGround, flight.verticalSpeedFpm < -200, flight.altitudeFt < 12000 {
            return Theme.success
        }
        return Color(hex: 0xF5C518).opacity(0.9)
    }
}

/// Flymarkør: ikon (militær får eget symbol) + rarity-ring + label.
private struct FlightMarker: View {
    let flight: LiveFlight
    let color: Color
    let selected: Bool

    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: flight.isMilitary ? "airplane.circle.fill" : "airplane")
                .font(.system(size: flight.isMilitary ? 20 : 18, weight: .bold))
                .foregroundStyle(color)
                .rotationEffect(.degrees(Double(flight.headingDeg) - 90))
                .background(
                    Circle()
                        .stroke(flight.rarity.rank >= 3 ? Theme.gold : .clear, lineWidth: 2)
                        .frame(width: 28, height: 28)
                )
                .shadow(radius: 2)
            if !flight.onGround {
                VStack(spacing: 0) {
                    Text(flight.callsign)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("\(flight.verticalSpeedFpm < -100 ? "↓" : flight.verticalSpeedFpm > 100 ? "↑" : "") \(flight.altitudeFt) ft")
                        .font(.system(size: 8))
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(Theme.surface.opacity(0.88))
                .clipShape(RoundedRectangle(cornerRadius: 5))
            }
        }
    }
}

struct FlightDetailSheet: View {
    @Environment(AppModel.self) private var model
    let flight: LiveFlight
    @State private var photo: AeroSpotAPI.AircraftPhoto?
    @State private var photoLoaded = false
    @State private var info: AeroSpotAPI.AircraftInfo?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.spacingLG) {
                aircraftPhoto
                header
                liveDataTiles
                photographerCard
                actionButtons
            }
            .padding(Theme.spacingLG)
        }
        .background(Theme.surface)
        .task(id: flight.id) {
            photoLoaded = false
            info = nil
            // Info via hex (adsbdb); bilde via registrering (planespotters)
            async let infoResult = AeroSpotAPI.aircraftInfo(hex: flight.id)
            let fetchedInfo = await infoResult
            info = fetchedInfo
            let lookupId = fetchedInfo?.registration ?? flight.registration ?? flight.id
            photo = await AeroSpotAPI.aircraftPhoto(id: lookupId)
            photoLoaded = true
        }
    }

    /// Beriket type: fra register hvis live-data mangler den.
    private var resolvedType: String? {
        flight.aircraftType ?? info?.model
    }
    private var resolvedRegistration: String? {
        flight.registration ?? info?.registration
    }
    private var resolvedOperator: String? {
        flight.airline ?? info?.operator
    }

    @ViewBuilder
    private var aircraftPhoto: some View {
        if let urlString = photo?.thumbnailUrl, let url = URL(string: urlString) {
            VStack(alignment: .trailing, spacing: 2) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        Rectangle().fill(Theme.surfaceElevated)
                    }
                }
                .frame(height: 180)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
                if let photographer = photo?.photographer {
                    Text("Foto: \(photographer) · planespotters.net")
                        .font(.system(size: 9))
                        .foregroundStyle(Theme.textTertiary)
                }
            }
        } else if !photoLoaded {
            RoundedRectangle(cornerRadius: Theme.radiusMd)
                .fill(Theme.surfaceElevated)
                .frame(height: 180)
                .overlay(ProgressView().tint(Theme.textSecondary))
        } else {
            // Ingen bilde funnet — pen silhuett-placeholder
            RoundedRectangle(cornerRadius: Theme.radiusMd)
                .fill(Theme.surfaceElevated)
                .frame(height: 120)
                .overlay(
                    VStack(spacing: Theme.spacingSM) {
                        Image(systemName: flight.isMilitary ? "airplane.circle" : "airplane")
                            .font(.system(size: 36, weight: .light))
                            .foregroundStyle(Theme.primaryBright.opacity(0.5))
                        Text("Ingen bilde funnet for \(flight.registration ?? flight.callsign)")
                            .font(.caption2)
                            .foregroundStyle(Theme.textTertiary)
                    }
                )
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.spacingXS) {
            HStack(spacing: Theme.spacingSM) {
                Text(flight.callsign)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.textPrimary)
                if flight.isMilitary || (info?.isMilitary ?? false) { MilitaryBadge() }
                RareBadge(rarity: flight.rarity)
            }
            if info?.isSpecialLivery ?? false, let livery = info?.liveryName {
                Label(livery, systemImage: "paintpalette.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.gold)
                    .padding(.horizontal, Theme.spacingSM)
                    .padding(.vertical, 3)
                    .background(Theme.gold.opacity(0.15))
                    .clipShape(Capsule())
            }
            let details = [resolvedOperator, resolvedType, resolvedRegistration]
                .compactMap { $0 }
            if !details.isEmpty {
                Text(details.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
            if let origin = flight.origin {
                Text("\(origin) → \(flight.destination ?? "?")")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
    }

    private var liveDataTiles: some View {
        VStack(spacing: Theme.spacingSM) {
            HStack(spacing: Theme.spacingSM) {
                ValueTile(label: "Høyde", value: "\(flight.altitudeFt) ft")
                ValueTile(label: "Fart", value: "\(flight.groundSpeedKt) kt")
                ValueTile(
                    label: "Heading",
                    value: "\(flight.headingDeg)° \(Geo.compassLabel(Double(flight.headingDeg)))"
                )
            }
            HStack(spacing: Theme.spacingSM) {
                ValueTile(label: "V/S", value: "\(flight.verticalSpeedFpm) fpm")
                ValueTile(label: "ETA", value: formatTimeIso(flight.etaIso))
                ValueTile(label: "Avstand", value: distanceText)
            }
        }
    }

    private var distanceText: String {
        guard let user = model.userCoordinate else { return "GPS av" }
        return String(format: "%.1f km", Geo.distanceKm(user, flight.coordinate))
    }

    private var photographerCard: some View {
        VStack(alignment: .leading, spacing: Theme.spacingXS) {
            Text("FOR FOTOGRAFEN")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.primaryBright)
            Text(photographerText)
                .font(.subheadline)
                .foregroundStyle(Theme.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.spacingMD)
        .background(Theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
    }

    private var photographerText: String {
        guard let user = model.userCoordinate else {
            return "Skru på posisjon for avstand, retning og objektiv-forslag."
        }
        let dist = max(0.5, Geo.distanceKm(user, flight.coordinate))
        let bearing = Geo.bearingDeg(user, flight.coordinate)
        let lens = CameraRecommendationService.estimateFocalLengthMm(distanceKm: dist)
        return "Ca. \(lens) mm på fullformat herfra. Flyet ligger \(Geo.compassLabel(bearing)) for deg (\(Int(bearing))°)."
    }

    private var actionButtons: some View {
        VStack(spacing: Theme.spacingSM) {
            Button {
                if model.followedFlightIds.contains(flight.id) {
                    model.followedFlightIds.remove(flight.id)
                } else {
                    model.followedFlightIds.insert(flight.id)
                }
            } label: {
                Text(model.followedFlightIds.contains(flight.id) ? "Følger ✓" : "Følg")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.spacingMD)
                    .background(
                        model.followedFlightIds.contains(flight.id)
                            ? Theme.primaryBright : Theme.primary.opacity(0.14)
                    )
                    .foregroundStyle(
                        model.followedFlightIds.contains(flight.id)
                            ? Theme.background : Theme.primaryBright
                    )
                    .clipShape(Capsule())
            }
            if let reg = flight.registration {
                Button {
                    NotificationService.requestAuthorization()
                    model.toggleWatchlist(reg)
                } label: {
                    Label(
                        model.isWatched(reg) ? "På watchlist (\(reg))" : "Varsle når \(reg) er i lufta",
                        systemImage: model.isWatched(reg) ? "bell.fill" : "bell"
                    )
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.spacingMD)
                    .background(model.isWatched(reg) ? Theme.warning.opacity(0.2) : Theme.surfaceElevated)
                    .foregroundStyle(model.isWatched(reg) ? Theme.warning : Theme.textSecondary)
                    .clipShape(Capsule())
                }
            }
        }
    }
}
