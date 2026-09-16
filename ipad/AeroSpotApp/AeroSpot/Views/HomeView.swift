// HomeView.swift — intelligence-dashboardet: beste spot nå, vær, sol,
// aktiv rullebane, interessante fly.

import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var showProfile = false
    @State private var arrivalPhoto: AeroSpotAPI.AircraftPhoto?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.spacingMD) {
                    header
                    watchlistBanner
                    overviewStrip
                    nextArrivalCard
                    bestSpotCard
                    cameraAssistCard
                    sunRow
                    interestingSection
                    communityLink
                }
                .padding(Theme.spacingLG)
            }
            .background(Theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.background, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showProfile = true
                    } label: {
                        Image(systemName: "person.crop.circle")
                            .foregroundStyle(Theme.textPrimary)
                    }
                }
            }
            .sheet(isPresented: $showProfile) {
                NavigationStack { ProfileView() }
                    .presentationBackground(Theme.background)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.spacingXS) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Hei! Klar for en episk spotteøkt?")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                if !model.flightsLoading {
                    HStack(spacing: 4) {
                        Circle().fill(Theme.success).frame(width: 6, height: 6)
                        Text("Live nå")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Theme.success)
                    }
                }
            }

            // Tydelig flyplassvelger — eget pill-kort, ikke gjemt tekst
            airportSelector

            Text(model.flightsLoading ? "Henter fly…" : "\(model.flights.count) fly i lufta")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
        }
    }

    private var airportSelector: some View {
        Menu {
            ForEach(AirportCatalog.all) { entry in
                Button {
                    model.activeAirportIcao = entry.airport.icao
                } label: {
                    Label("\(entry.airport.iata) · \(entry.airport.name)",
                          systemImage: model.activeAirportIcao == entry.airport.icao ? "checkmark" : "airplane")
                }
            }
        } label: {
            HStack(spacing: Theme.spacingMD) {
                Image(systemName: "airplane.departure")
                    .font(.headline)
                    .foregroundStyle(Theme.primaryBright)
                VStack(alignment: .leading, spacing: 1) {
                    Text(model.activeAirport.iata)
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.textPrimary)
                    Text(model.activeAirport.name)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                HStack(spacing: 4) {
                    Text("Bytt")
                        .font(.caption.weight(.semibold))
                    Image(systemName: "chevron.up.chevron.down").font(.caption2)
                }
                .foregroundStyle(Theme.primaryBright)
            }
            .padding(Theme.spacingMD)
            .background(Theme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMd)
                    .stroke(Theme.primary.opacity(0.25), lineWidth: 1)
            )
        }
    }

    // ── Oversikt: tett «alt på ett blikk»-layout ─────────────────────

    /// Neste ankomst: nærmeste innkommende fly til aktiv flyplass.
    private var nextArrival: (flight: LiveFlight, distanceKm: Double)? {
        let reference = model.activeAirport.coordinate
        let airborne = model.flights.filter { !$0.onGround }
        guard let nearest = airborne.min(by: {
            Geo.distanceKm(reference, $0.coordinate) < Geo.distanceKm(reference, $1.coordinate)
        }) else { return nil }
        return (nearest, Geo.distanceKm(reference, nearest.coordinate))
    }

    /// Header-stripe: vær + aktiv rullebane, kompakt (som mockup).
    private var overviewStrip: some View {
        HStack(spacing: Theme.spacingSM) {
            HStack(spacing: Theme.spacingSM) {
                Image(systemName: "cloud.sun.fill").foregroundStyle(Theme.primaryBright)
                VStack(alignment: .leading, spacing: 1) {
                    Text(model.weather.map { "\(Int($0.temperatureC.rounded()))°C" } ?? "–")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text(weatherSymbolText).font(.caption2).foregroundStyle(Theme.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Rectangle().fill(Color.white.opacity(0.08)).frame(width: 1, height: 30)
            VStack(alignment: .trailing, spacing: 1) {
                HStack(spacing: 6) {
                    Text("Aktiv bane").font(.caption2).foregroundStyle(Theme.textSecondary)
                    Text(model.runway?.runway ?? "–")
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.primaryBright)
                }
                Text(model.weather.map {
                    "\(Geo.compassLabel($0.windDirectionDeg)) \($0.windSpeedKt) kt"
                } ?? "–")
                    .font(.caption2).foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(Theme.spacingMD)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
    }

    /// Neste ankomst-kort med fly-thumbnail + live telemetri.
    @ViewBuilder
    private var nextArrivalCard: some View {
        if let arrival = nextArrival {
            let f = arrival.flight
            VStack(alignment: .leading, spacing: Theme.spacingMD) {
                Text("NESTE ANKOMST")
                    .font(.system(size: 10, weight: .bold)).tracking(0.8)
                    .foregroundStyle(Theme.textSecondary)
                HStack(alignment: .top, spacing: Theme.spacingMD) {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: Theme.spacingSM) {
                            Text(f.callsign)
                                .font(.title3.weight(.bold))
                                .foregroundStyle(Theme.textPrimary)
                            RareBadge(rarity: f.rarity)
                        }
                        Text([f.aircraftType, f.registration].compactMap { $0 }.joined(separator: " · "))
                            .font(.caption).foregroundStyle(Theme.textSecondary)
                        if let origin = f.origin {
                            Text("\(origin) → \(f.destination ?? model.activeAirport.iata)")
                                .font(.caption).foregroundStyle(Theme.textSecondary)
                        }
                        if let eta = f.etaIso, let d = ISO8601DateFormatter().date(from: eta) {
                            Text("ETA \(d.formatted(date: .omitted, time: .shortened))")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.primaryBright)
                        }
                    }
                    Spacer()
                    arrivalThumb
                }
                HStack(spacing: Theme.spacingSM) {
                    ValueTile(label: "Avstand", value: String(format: "%.1f km", arrival.distanceKm))
                    ValueTile(label: "Høyde", value: "\(f.altitudeFt) ft")
                    ValueTile(label: "Fart", value: "\(f.groundSpeedKt) kt")
                }
            }
            .card(elevated: true)
            .onTapGesture {
                model.selectedFlight = f
                model.setTab(1)
            }
            .task(id: f.registration ?? f.id) {
                arrivalPhoto = await AeroSpotAPI.aircraftPhoto(id: f.registration ?? f.id)
            }
        }
    }

    @ViewBuilder
    private var arrivalThumb: some View {
        if let urlString = arrivalPhoto?.thumbnailUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    Rectangle().fill(Theme.surfaceElevated)
                }
            }
            .frame(width: 96, height: 64)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSm))
        } else {
            RoundedRectangle(cornerRadius: Theme.radiusSm)
                .fill(Theme.surfaceElevated)
                .frame(width: 96, height: 64)
                .overlay(Image(systemName: "airplane").foregroundStyle(Theme.textTertiary))
        }
    }

    /// Beste spottepunkt, kondensert (navn, lys, score, mini-notat).
    @ViewBuilder
    private var bestSpotCard: some View {
        if let rec = model.ranked.first {
            let light = model.sun.map {
                SunService.lightQuality(sunAzimuthDeg: $0.azimuthDeg,
                                        sunElevationDeg: $0.elevationDeg,
                                        shootingDirectionDeg: rec.location.shootingDirectionDeg)
            }
            Button {
                model.selectedLocation = rec.location
            } label: {
                HStack(spacing: Theme.spacingMD) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("SPOTTEPUNKT")
                            .font(.system(size: 10, weight: .bold)).tracking(0.8)
                            .foregroundStyle(Theme.textSecondary)
                        Text(rec.location.name)
                            .font(.headline).foregroundStyle(Theme.textPrimary)
                        Text(rec.location.bestFor.first ?? "")
                            .font(.caption).foregroundStyle(Theme.textSecondary)
                        if let light {
                            HStack(spacing: 5) {
                                Circle().fill(lightColor(light.quality)).frame(width: 6, height: 6)
                                Text(light.label).font(.caption).foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }
                    Spacer()
                    VStack(spacing: 2) {
                        Text("\(rec.score.total)")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundStyle(rec.score.total >= 80 ? Theme.success : Theme.warning)
                        Text("score").font(.caption2).foregroundStyle(Theme.textTertiary)
                    }
                }
                .card()
            }
            .buttonStyle(.plain)
        }
    }

    private func lightColor(_ q: SunService.LightQuality) -> Color {
        switch q {
        case .excellent: return Theme.success
        case .good: return Theme.success
        case .fair: return Theme.warning
        case .poor: return Theme.danger
        }
    }

    /// Kamera-anbefaling for neste ankomst, kompakt inline (som mockup).
    @ViewBuilder
    private var cameraAssistCard: some View {
        let rec = CameraRecommendationService.recommend(
            CameraRecommendationService.Input(
                aircraftSpeedKt: nextArrival?.flight.groundSpeedKt,
                aircraftDistanceKm: nextArrival?.distanceKm,
                sunElevationDeg: model.sun?.elevationDeg,
                cloudCoverPct: model.weather?.cloudCoverPct,
                current: nil, lensRange: nil,
                mode: model.photographyMode
            )
        ).recommendation
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            Text("KAMERAASSISTENT")
                .font(.system(size: 10, weight: .bold)).tracking(0.8)
                .foregroundStyle(Theme.textSecondary)
            HStack(spacing: Theme.spacingSM) {
                ValueTile(label: "Lukker", value: rec.shutterSpeed)
                ValueTile(label: "Blender", value: rec.aperture)
                ValueTile(label: "ISO", value: String(rec.iso))
            }
            HStack(spacing: Theme.spacingSM) {
                ValueTile(label: "Objektiv", value: "\(rec.focalRange.lowerBound)–\(rec.focalRange.upperBound) mm")
                ValueTile(label: "Modus", value: model.photographyMode.label)
            }
        }
        .card()
    }

    private func heroCard(_ best: SpottingRecommendation) -> some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            HStack {
                Text("BESTE SPOTTING NÅ")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(Theme.primaryBright)
                Spacer()
                Image(systemName: "sun.max.fill")
                    .foregroundStyle(Theme.gold)
            }
            PhotoPlaceholder(assetName: "hero-spotting", height: 120, symbol: "airplane.arrival")
            Text(best.location.name)
                .font(.title2.weight(.bold))
                .foregroundStyle(Theme.textPrimary)
            Text(best.explanation)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
            if let runway = model.runway {
                HStack(spacing: Theme.spacingSM) {
                    RunwayBadge(runway: runway.runway)
                    Text("Estimert aktiv bane · ikke ATC-bekreftet")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            ScoreBar(label: "Score", value: best.score.total)
            Button {
                model.selectedLocation = best.location
            } label: {
                HStack(spacing: Theme.spacingSM) {
                    Text("Se spottepunkt")
                    Image(systemName: "location.fill")
                        .font(.caption)
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.spacingMD)
                .background(Theme.primary)
                .foregroundStyle(.white)
                .clipShape(Capsule())
            }
        }
        .padding(Theme.spacingLG)
        .background(
            LinearGradient(
                colors: [Theme.surfaceElevated, Theme.surface],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLg)
                .stroke(Theme.primary.opacity(0.25), lineWidth: 1)
        )
    }

    private var weatherSymbolText: String {
        guard let symbol = model.weather?.symbol else { return "–" }
        if symbol.contains("clearsky") { return "Klarvær" }
        if symbol.contains("partlycloudy") { return "Delvis skyet" }
        if symbol.contains("fair") { return "Lettskyet" }
        if symbol.contains("cloudy") { return "Overskyet" }
        if symbol.contains("rain") { return "Regn" }
        if symbol.contains("snow") { return "Snø" }
        if symbol.contains("fog") { return "Tåke" }
        return symbol
    }

    /// Vind-karakter relativt til estimert bane: motvind/kryssvind
    private var windSubtitle: String {
        guard let weather = model.weather, let runway = model.runway,
              let heading = model.activeAirport.runways
                  .flatMap({ [($0.id, $0.headingDeg), ($0.reciprocal, $0.headingDeg + 180)] })
                  .first(where: { $0.0 == runway.runway })?.1
        else { return "" }
        let diff = Geo.angleDiffDeg(weather.windDirectionDeg, heading)
        if diff < 30 { return "Motvind for \(runway.runway)" }
        if diff > 150 { return "Medvind for \(runway.runway)" }
        return "Kryssvind for \(runway.runway)"
    }

    private var weatherRow: some View {
        HStack(spacing: Theme.spacingSM) {
            IconTile(
                icon: "cloud.sun.fill",
                label: "Vær nå",
                value: model.weather.map { "\(Int($0.temperatureC.rounded()))°C" } ?? "–",
                subtitle: weatherSymbolText
            )
            IconTile(
                icon: "wind",
                label: "Vind",
                value: model.weather.map {
                    "\(Geo.compassLabel($0.windDirectionDeg)) \($0.windSpeedKt) kt"
                } ?? "–",
                subtitle: windSubtitle
            )
            IconTile(
                icon: "eye.fill",
                label: "Sikt",
                value: model.weather.map { "\(Int($0.visibilityKm)) km" } ?? "–",
                subtitle: (model.weather?.visibilityKm ?? 0) >= 8 ? "God sikt" : "Redusert"
            )
        }
    }

    private var goldenHourSubtitle: String {
        guard let start = model.sun?.goldenHourStart, let end = model.sun?.sunset else { return "" }
        let minutes = max(0, Int(end.timeIntervalSince(start) / 60))
        return "Varer i \(minutes / 60)t \(String(format: "%02d", minutes % 60))m"
    }

    private var sunRow: some View {
        HStack(spacing: Theme.spacingSM) {
            IconTile(
                icon: "sun.horizon.fill",
                label: "Golden hour",
                value: formatTime(model.sun?.goldenHourStart),
                subtitle: goldenHourSubtitle
            )
            IconTile(
                icon: "sunset.fill",
                label: "Solnedgang",
                value: formatTime(model.sun?.sunset),
                subtitle: "I kveld"
            )
            IconTile(
                icon: "moon.stars.fill",
                label: "Blue hour",
                value: formatTime(model.sun?.blueHourStart),
                subtitle: "Etter solnedgang"
            )
        }
    }

    @ViewBuilder
    private var watchlistBanner: some View {
        if !model.watchlistHits.isEmpty {
            ForEach(model.watchlistHits) { hit in
                Button {
                    model.selectedFlight = hit
                    model.setTab(1)
                } label: {
                    HStack(spacing: Theme.spacingMD) {
                        Image(systemName: "bell.fill")
                            .foregroundStyle(Theme.warning)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(hit.registration ?? hit.callsign) er i lufta!")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Theme.textPrimary)
                            Text([hit.aircraftType, "\(hit.altitudeFt) ft"].compactMap { $0 }.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
                    }
                    .padding(Theme.spacingMD)
                    .background(Theme.warning.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusMd)
                            .stroke(Theme.warning.opacity(0.4), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var runwayCard: some View {
        if let runway = model.runway, let weather = model.weather {
            HStack(spacing: Theme.spacingMD) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("ANBEFALT RULLEBANE")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(Theme.textSecondary)
                    HStack(spacing: Theme.spacingSM) {
                        Text(runway.runway)
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .foregroundStyle(Theme.primaryBright)
                        Text("Brukes sannsynlig nå")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    Text("Vind \(Int(weather.windDirectionDeg))° / \(weather.windSpeedKt) kt · konfidens \(Int(runway.confidence * 100))%")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                }
                Spacer()
                Image(systemName: "airplane.arrival")
                    .font(.title2)
                    .foregroundStyle(Theme.primaryBright)
            }
            .card()
        }
    }

    private var communityLink: some View {
        NavigationLink {
            CommunityView()
        } label: {
            HStack(spacing: Theme.spacingMD) {
                Image(systemName: "person.2.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.primaryBright)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Community")
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)
                    Text("Se og del spotting-bilder fra andre")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
            }
            .card()
        }
        .buttonStyle(.plain)
    }

    private var interestingSection: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("Interessante fly kommer")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            if model.interestingFlights.isEmpty && !model.flightsLoading {
                EmptyStateView(title: "Stille i lufta", message: "Ingen fly i området akkurat nå.")
            }
            ForEach(model.interestingFlights.prefix(8)) { flight in
                FlightRowView(flight: flight)
            }
        }
    }

    private var spottingSection: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("Spottepunkter")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            ForEach(model.ranked) { rec in
                Button {
                    model.selectedLocation = rec.location
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: Theme.spacingXS) {
                                Text(rec.location.name)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(Theme.textPrimary)
                                Text("★ \(rec.location.rating, specifier: "%.1f")")
                                    .font(.caption)
                                    .foregroundStyle(Theme.warning)
                            }
                            Text(rec.location.bestFor.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Text("\(rec.score.total)")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(rec.score.total >= 80 ? Theme.success : Theme.textSecondary)
                    }
                    .card()
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct FlightRowView: View {
    @Environment(AppModel.self) private var model
    let flight: LiveFlight

    var body: some View {
        Button {
            model.selectedFlight = flight
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Theme.spacingSM) {
                        if flight.etaIso != nil {
                            Text(formatTimeIso(flight.etaIso))
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Text(flight.aircraftType ?? flight.callsign)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.textPrimary)
                        RareBadge(rarity: flight.rarity)
                    }
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                if let icao = flight.aircraftIcao {
                    Text(icao)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.primaryBright)
                        .padding(.horizontal, Theme.spacingSM)
                        .padding(.vertical, 3)
                        .background(Theme.primary.opacity(0.14))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSm))
                }
            }
            .card()
        }
        .buttonStyle(.plain)
    }

    private var subtitle: String {
        var parts: [String] = []
        if let reg = flight.registration { parts.append(reg) }
        if let origin = flight.origin {
            parts.append("\(origin) → \(flight.destination ?? "Oslo")")
        }
        parts.append("\(flight.altitudeFt) ft · \(flight.groundSpeedKt) kt")
        return parts.joined(separator: " · ")
    }
}
