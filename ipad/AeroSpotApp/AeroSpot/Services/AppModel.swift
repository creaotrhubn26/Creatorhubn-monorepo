// AppModel.swift — sentral app-state: flydata, vær, sol, intelligence,
// posisjon. Views leser herfra; services gjør beregningene.

import Foundation
import Observation
import CoreLocation

@MainActor
@Observable
final class AppModel: NSObject, CLLocationManagerDelegate {
    private(set) var flights: [LiveFlight] = []
    private(set) var weather: Weather?
    private(set) var sun: SunTimes?
    private(set) var runway: RunwayRecommendation?
    private(set) var ranked: [SpottingRecommendation] = []
    private(set) var flightsLoading = true
    private(set) var userCoordinate: CLLocationCoordinate2D?

    var selectedTab = 0 // 0=Hjem 1=Live 2=Arrangementer 3=Kamera 4=Loggbok
    func setTab(_ index: Int) { selectedTab = index }

    var selectedFlight: LiveFlight?
    var selectedLocation: SpottingLocation?
    var photographyMode: PhotographyMode = .freeze
    var followedFlightIds: Set<String> = []

    /// Kart-filter (Live-skjermen)
    enum MapFilter: String, CaseIterable {
        case all = "Alle"
        case rare = "Sjeldne"
        case military = "Militær"
        case approach = "Innflyving"
        case followed = "Følger"
    }
    var mapFilter: MapFilter = .all

    /// Aktiv flyplass — brukeren kan bytte. Persistert.
    var activeAirportIcao: String = UserDefaults.standard.string(forKey: "aerospot.airport") ?? "ENGM" {
        didSet {
            UserDefaults.standard.set(activeAirportIcao, forKey: "aerospot.airport")
            trails = [:]
            selectedFlight = nil
            Task { await refreshFlights(); await refreshWeather() }
        }
    }
    var activeAirport: Airport { AirportCatalog.entry(icao: activeAirportIcao).airport }
    var activeSpots: [SpottingLocation] { AirportCatalog.entry(icao: activeAirportIcao).spots }

    /// Registrerings-watchlist (lokal). Match mot live-data gir varsel-banner.
    var watchlist: [String] = (UserDefaults.standard.array(forKey: "aerospot.watchlist") as? [String]) ?? [] {
        didSet { UserDefaults.standard.set(watchlist, forKey: "aerospot.watchlist") }
    }
    /// Treff akkurat nå: registrering → fly.
    private(set) var watchlistHits: [LiveFlight] = []

    /// Siste ~12 posisjoner per fly-id, for spor-tegning. Eldst først.
    private(set) var trails: [String: [CLLocationCoordinate2D]] = [:]
    private let maxTrailPoints = 12

    let auth = AuthStore()
    let camera = CameraSyncStore()
    let session = SessionStore()
    let liveView = LiveViewStore()
    let gear = GearStore()
    let logbook = LogbookStore()
    let photoDownload = PhotoDownloadStore()

    private let locationManager = CLLocationManager()
    private var refreshTask: Task<Void, Never>?

    // Bounds ~±60 km rundt aktiv flyplass
    private var bounds: (south: Double, west: Double, north: Double, east: Double) {
        let c = activeAirport.coordinate
        return (c.latitude - 0.55, c.longitude - 1.1, c.latitude + 0.55, c.longitude + 1.1)
    }

    func start() {
        guard refreshTask == nil else { return }
        camera.onCapture = { [weak self] in
            guard let self else { return }
            self.session.registerCapture(nearest: self.nearestFlight?.flight)
        }
        // Auto-nedlasting (opt-in): last siste bilde til Photos m/ progress.
        camera.onNewContents = { [weak self] urls, session in
            guard let self, self.photoDownload.autoDownload else { return }
            for url in urls {
                let name = url.lastPathComponent.isEmpty ? "AeroSpot.jpg" : url.lastPathComponent
                // ?kind=main gir fulloppløsning
                let full = URL(string: "\(url.absoluteString)?kind=main") ?? url
                Task { await self.photoDownload.download(from: full, fileName: name, session: session) }
            }
        }
        refreshTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshFlights()
                try? await Task.sleep(for: .seconds(10))
            }
        }
        Task { await refreshWeather() }
        Task { await scheduleEventAlerts() }
        Task { await logbook.syncFromServer() } // no-op hvis ikke innlogget
    }

    /// Planlegg påminnelse for kommende fremhevede/nære arrangementer
    /// (2 dager før, kl. 09). Sporet i UserDefaults så vi ikke dobler.
    private func scheduleEventAlerts() async {
        let events = await AeroSpotAPI.events()
        let iso = DateFormatter(); iso.dateFormat = "yyyy-MM-dd"
        var notified = Set(UserDefaults.standard.stringArray(forKey: "aerospot.eventAlerts") ?? [])
        for event in events {
            let relevant = event.featured == true || event.airportIcao == activeAirportIcao
            guard relevant, !notified.contains(event.id),
                  let date = iso.date(from: event.startDate),
                  date > Date(),
                  date.timeIntervalSinceNow < 30 * 86400
            else { continue }
            let fireAt = Calendar.current.date(byAdding: .day, value: -2, to: date)
                .flatMap { Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: $0) } ?? date
            NotificationService.scheduleReminder(
                id: "event-alert-\(event.id)",
                title: event.featured == true ? "⭐️ \(event.name)" : event.name,
                body: "Om 2 dager · \(event.venue)",
                at: fireAt
            )
            notified.insert(event.id)
        }
        UserDefaults.standard.set(Array(notified), forKey: "aerospot.eventAlerts")
    }

    func refreshFlights() async {
        let b = bounds
        let result = await AeroSpotAPI.flights(
            south: b.south, west: b.west, north: b.north, east: b.east
        )
        flights = result
        flightsLoading = false
        appendTrails(result)
        updateWatchlistHits(result)
        recomputeIntelligence()
        // Hold selectedFlight oppdatert med ny posisjon
        if let selected = selectedFlight {
            selectedFlight = result.first { $0.id == selected.id } ?? selectedFlight
        }
    }

    func refreshWeather() async {
        let c = OSLData.airport.coordinate
        weather = await AeroSpotAPI.weather(lat: c.latitude, lon: c.longitude)
        recomputeIntelligence()
    }

    private func appendTrails(_ flights: [LiveFlight]) {
        let liveIds = Set(flights.map(\.id))
        for flight in flights where !flight.onGround {
            var points = trails[flight.id] ?? []
            // Unngå duplikat hvis posisjon ikke endret seg
            if let last = points.last,
               abs(last.latitude - flight.latitude) < 0.0001,
               abs(last.longitude - flight.longitude) < 0.0001 {
                continue
            }
            points.append(flight.coordinate)
            if points.count > maxTrailPoints { points.removeFirst(points.count - maxTrailPoints) }
            trails[flight.id] = points
        }
        // Rydd spor for fly som er borte
        trails = trails.filter { liveIds.contains($0.key) }
    }

    /// Fly som skal vises gitt aktivt filter.
    var visibleFlights: [LiveFlight] {
        switch mapFilter {
        case .all: return flights
        case .rare: return flights.filter { $0.rarity.rank >= 2 }
        case .military: return flights.filter(\.isMilitary)
        case .approach: return flights.filter { !$0.onGround && $0.verticalSpeedFpm < -200 && $0.altitudeFt < 12000 }
        case .followed: return flights.filter { followedFlightIds.contains($0.id) }
        }
    }

    private func recomputeIntelligence() {
        sun = SunService.times(date: Date(), coordinate: activeAirport.coordinate)
        guard let weather, let sun else { return }
        let rec = RunwayService.recommend(airport: activeAirport, weather: weather)
        runway = rec
        ranked = SpottingScoreService.rank(
            locations: activeSpots,
            weather: weather,
            sun: sun,
            runway: rec,
            trafficCount: flights.count,
            userCoordinate: userCoordinate
        )
    }

    /// Match watchlist-registreringer mot live-fly. Nye treff → banner
    /// + lokal notifikasjon.
    private var notifiedHitIds: Set<String> = []
    private func updateWatchlistHits(_ flights: [LiveFlight]) {
        guard !watchlist.isEmpty else { watchlistHits = []; return }
        let wanted = Set(watchlist.map { $0.uppercased().replacingOccurrences(of: "-", with: "") })
        let hits = flights.filter { flight in
            guard let reg = flight.registration?.uppercased().replacingOccurrences(of: "-", with: "") else { return false }
            return wanted.contains(reg)
        }
        watchlistHits = hits
        for hit in hits where !notifiedHitIds.contains(hit.id) {
            notifiedHitIds.insert(hit.id)
            NotificationService.fireWatchlistHit(flight: hit, airport: activeAirport)
        }
        // Rydd notified for fly som er borte
        let liveIds = Set(flights.map(\.id))
        notifiedHitIds = notifiedHitIds.intersection(liveIds)
    }

    func toggleWatchlist(_ registration: String) {
        let reg = registration.uppercased()
        if let idx = watchlist.firstIndex(of: reg) {
            watchlist.remove(at: idx)
        } else {
            watchlist.append(reg)
        }
    }

    func isWatched(_ registration: String?) -> Bool {
        guard let reg = registration?.uppercased() else { return false }
        return watchlist.contains(reg)
    }

    // ── Location ─────────────────────────────────────────────────────

    func requestLocation() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        locationManager.requestWhenInUseAuthorization()
        locationManager.requestLocation()
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]
    ) {
        guard let coordinate = locations.last?.coordinate else { return }
        Task { @MainActor in
            self.userCoordinate = coordinate
            self.recomputeIntelligence()
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager, didFailWithError error: Error
    ) {
        // Posisjon avslått/utilgjengelig — appen fungerer uten
    }

    // ── Avledet ──────────────────────────────────────────────────────

    var interestingFlights: [LiveFlight] {
        flights
            .filter { !$0.onGround }
            .sorted {
                if $0.rarity.rank != $1.rarity.rank { return $0.rarity.rank > $1.rarity.rank }
                return ($0.etaIso ?? "") < ($1.etaIso ?? "")
            }
    }

    /// Nærmeste fly i lufta — target for kamera-anbefaling
    var nearestFlight: (flight: LiveFlight, distanceKm: Double)? {
        let reference = userCoordinate ?? OSLData.airport.coordinate
        let airborne = flights.filter { !$0.onGround }
        guard let nearest = airborne.min(by: {
            Geo.distanceKm(reference, $0.coordinate) < Geo.distanceKm(reference, $1.coordinate)
        }) else { return nil }
        return (nearest, Geo.distanceKm(reference, nearest.coordinate))
    }
}
