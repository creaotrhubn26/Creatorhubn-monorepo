// BackendAPI.swift — klient mot CreatorHub-backenden (/api/aerospot/*).
// Flights (OpenSky-proxy), vær (MET-proxy), loggbok, varsler.
// Mock-fallback når backend er utilgjengelig så appen alltid har innhold.

import Foundation

struct AeroSpotAPI: Sendable {
    /// Base-URL mot backend. Dev: lokal maskin. Prod: Render via Netlify-proxy.
    /// Kan overstyres i Profil (lagres i UserDefaults) — samme mønster som
    /// LeadMapApp sin APIClient.
    static var baseURL: URL {
        if let raw = UserDefaults.standard.string(forKey: "aerospot.baseURL"),
           let url = URL(string: raw) {
            return url
        }
        #if targetEnvironment(simulator)
        return URL(string: "http://localhost:3003")!
        #else
        return URL(string: "https://creatorhubn.com")!
        #endif
    }

    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config)
    }()

    private static func get<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        let url = baseURL.appending(path: path)
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    // ── Flights ──────────────────────────────────────────────────────

    private struct FlightsResponse: Decodable {
        let flights: [LiveFlight]
    }

    static func flights(
        south: Double, west: Double, north: Double, east: Double
    ) async -> [LiveFlight] {
        let path = "/api/aerospot/flights"
        var components = URLComponents(
            url: baseURL.appending(path: path), resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "south", value: String(south)),
            URLQueryItem(name: "west", value: String(west)),
            URLQueryItem(name: "north", value: String(north)),
            URLQueryItem(name: "east", value: String(east)),
        ]
        do {
            let (data, _) = try await session.data(from: components.url!)
            let decoded = try JSONDecoder().decode(FlightsResponse.self, from: data)
            return decoded.flights.isEmpty ? MockFlights.current() : decoded.flights
        } catch {
            return MockFlights.current()
        }
    }

    // ── Community / deling ────────────────────────────────────────────

    private struct CommunityResponse: Decodable { let posts: [CommunityPost] }

    static func communityFeed(airport: String?) async -> [CommunityPost] {
        var comp = URLComponents(url: baseURL.appending(path: "/api/aerospot/community"),
                                 resolvingAgainstBaseURL: false)!
        if let airport { comp.queryItems = [URLQueryItem(name: "airport", value: airport)] }
        do {
            let (data, response) = try await session.data(from: comp.url!)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode)
            else { return [] }
            return try JSONDecoder().decode(CommunityResponse.self, from: data).posts
        } catch {
            return []
        }
    }

    /// Post til community. Returnerer true ved suksess (krever innlogging).
    static func postToCommunity(_ payload: [String: Any]) async -> Bool {
        var request = URLRequest(url: baseURL.appending(path: "/api/aerospot/community"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (_, response) = try await session.data(for: request)
            return (response as? HTTPURLResponse).map { (200...299).contains($0.statusCode) } ?? false
        } catch {
            return false
        }
    }

    /// Toggle like. Returnerer ny liked-state, eller nil ved feil/uinnlogget.
    static func toggleLike(postId: String) async -> Bool? {
        var request = URLRequest(url: baseURL.appending(path: "/api/aerospot/community/\(postId)/like"))
        request.httpMethod = "POST"
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode)
            else { return nil }
            let body = try JSONDecoder().decode([String: Bool].self, from: data)
            return body["liked"]
        } catch {
            return nil
        }
    }

    // ── Fly-register (adsbdb via backend) ────────────────────────────

    struct AircraftInfo: Decodable, Sendable {
        let registration: String?
        let manufacturer: String?
        let model: String?
        let typecode: String?
        let `operator`: String?
        let isMilitary: Bool
        let isSpecialLivery: Bool
        let liveryName: String?
    }

    private struct InfoResponse: Decodable { let info: AircraftInfo? }

    static func aircraftInfo(hex: String) async -> AircraftInfo? {
        let clean = hex.replacingOccurrences(of: "mock-", with: "")
        guard !clean.isEmpty else { return nil }
        let url = baseURL.appending(path: "/api/aerospot/aircraft/\(clean)/info")
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode)
            else { return nil }
            return try JSONDecoder().decode(InfoResponse.self, from: data).info
        } catch {
            return nil
        }
    }

    // ── Arrangementer / flyshow ──────────────────────────────────────

    private struct EventsResponse: Decodable { let events: [AeroEvent] }

    // ── Moderering (admin) ────────────────────────────────────────────

    enum AdminResult { case success, forbidden, failed }

    static func pendingEvents() async -> (events: [AeroEvent], result: AdminResult) {
        let url = baseURL.appending(path: "/api/aerospot/admin/events/pending")
        do {
            let (data, response) = try await session.data(from: url)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            if code == 401 || code == 403 { return ([], .forbidden) }
            guard (200...299).contains(code) else { return ([], .failed) }
            return (try JSONDecoder().decode(EventsResponse.self, from: data).events, .success)
        } catch {
            return ([], .failed)
        }
    }

    static func moderateEvent(id: String, approve: Bool, verified: Bool = false) async -> AdminResult {
        let action = approve ? "approve" : "reject"
        var request = URLRequest(url: baseURL.appending(path: "/api/aerospot/admin/events/\(id)/\(action)"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if approve {
            request.httpBody = try? JSONSerialization.data(withJSONObject: ["verified": verified])
        }
        do {
            let (_, response) = try await session.data(for: request)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            if code == 401 || code == 403 { return .forbidden }
            return (200...299).contains(code) ? .success : .failed
        } catch {
            return .failed
        }
    }

    // ── Auth ─────────────────────────────────────────────────────────
    // Sesjon = header-token (x-session-token). Vi gjenbruker CreatorHubs
    // eksisterende /api/auth/login (e-post/passord + TOTP-2FA).

    enum LoginResult: Sendable {
        case token(String, name: String?)
        case needs2FA(tempToken: String)
        case error(String)
    }

    private struct LoginResponse: Decodable {
        let token: String?
        let needs_2fa: Bool?
        let tempToken: String?
        let error: String?
        let message: String?
        struct User: Decodable { let name: String?; let email: String? }
        let user: User?
    }

    static func login(email: String, password: String) async -> LoginResult {
        await postAuth("/api/auth/login", ["email": email, "password": password])
    }

    static func complete2FA(tempToken: String, code: String) async -> LoginResult {
        await postAuth("/api/auth/login/complete-2fa", ["tempToken": tempToken, "code": code])
    }

    private static func postAuth(_ path: String, _ payload: [String: String]) async -> LoginResult {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, _) = try await session.data(for: request)
            let body = try JSONDecoder().decode(LoginResponse.self, from: data)
            if body.needs_2fa == true, let temp = body.tempToken {
                return .needs2FA(tempToken: temp)
            }
            if let token = body.token, !token.isEmpty {
                return .token(token, name: body.user?.name ?? body.user?.email)
            }
            return .error(body.message ?? body.error ?? "Innlogging feilet")
        } catch {
            return .error("Kunne ikke nå serveren")
        }
    }

    /// Sett token-header på autentiserte kall hvis innlogget.
    fileprivate static func authorize(_ request: inout URLRequest) {
        if let token = AuthTokenStore.get() {
            request.setValue(token, forHTTPHeaderField: "x-session-token")
        }
    }

    // ── Loggbok-synk ─────────────────────────────────────────────────
    // Server er kilde for metadata; thumbnail (base64) blir lokalt (photo_url
    // er kappet til 2000 tegn, for lite for en data-URL). Server genererer
    // egen id ved POST, så klienten adopterer den returnerte id-en.

    private struct EntriesResponse: Decodable { let entries: [LogbookEntry] }
    private struct CreatedId: Decodable { let id: String }

    /// Hent brukerens loggbok fra server (nil hvis ikke innlogget / feil).
    static func fetchLogbook() async -> [LogbookEntry]? {
        guard AuthTokenStore.get() != nil else { return nil }
        var request = URLRequest(url: baseURL.appending(path: "/api/aerospot/logbook"))
        authorize(&request)
        do {
            let (data, response) = try await session.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            return try JSONDecoder().decode(EntriesResponse.self, from: data).entries
        } catch { return nil }
    }

    /// Push én oppføring. Returnerer server-tildelt id (thumb sendes ikke).
    static func pushLogbook(_ e: LogbookEntry) async -> String? {
        guard AuthTokenStore.get() != nil else { return nil }
        var payload: [String: Any] = ["dateIso": e.dateIso, "favorite": e.favorite]
        if let v = e.location { payload["location"] = v }
        if let v = e.airportIcao { payload["airportIcao"] = v }
        if let v = e.flightNumber { payload["flightNumber"] = v }
        if let v = e.callsign { payload["callsign"] = v }
        if let v = e.registration { payload["registration"] = v }
        if let v = e.aircraftType { payload["aircraftType"] = v }
        if let v = e.airline { payload["airline"] = v }
        if let v = e.latitude { payload["latitude"] = v }
        if let v = e.longitude { payload["longitude"] = v }
        if let v = e.focalLengthMm { payload["focalLengthMm"] = v }
        if let v = e.shutterSpeed { payload["shutterSpeed"] = v }
        if let v = e.aperture { payload["aperture"] = v }
        if let v = e.iso { payload["iso"] = v }
        if let v = e.cameraModel { payload["cameraModel"] = v }
        if let v = e.lensModel { payload["lensModel"] = v }
        if let v = e.rating { payload["rating"] = v }
        if let v = e.notes { payload["notes"] = v }
        if let v = e.rarity { payload["rarity"] = v.rawValue }

        var request = URLRequest(url: baseURL.appending(path: "/api/aerospot/logbook"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        authorize(&request)
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, response) = try await session.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 201 else { return nil }
            return try JSONDecoder().decode(CreatedId.self, from: data).id
        } catch { return nil }
    }

    static func deleteLogbook(id: String) async {
        guard AuthTokenStore.get() != nil else { return }
        var request = URLRequest(url: baseURL.appending(path: "/api/aerospot/logbook/\(id)"))
        request.httpMethod = "DELETE"
        authorize(&request)
        _ = try? await session.data(for: request)
    }

    static func patchLogbookFavorite(id: String, favorite: Bool) async {
        guard AuthTokenStore.get() != nil else { return }
        var request = URLRequest(url: baseURL.appending(path: "/api/aerospot/logbook/\(id)"))
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        authorize(&request)
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["favorite": favorite])
        _ = try? await session.data(for: request)
    }

    enum SubmitResult { case success, unauthorized, failed }

    /// Send inn arrangement (arrangør). Krever innlogging → status=pending.
    /// Tar ferdig-serialisert JSON (Data er Sendable, unngår data-race).
    static func submitEvent(body: Data) async -> SubmitResult {
        var request = URLRequest(url: baseURL.appending(path: "/api/aerospot/events"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        authorize(&request)
        request.httpBody = body
        do {
            let (_, response) = try await session.data(for: request)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            if (200...299).contains(code) { return .success }
            if code == 401 { return .unauthorized }
            return .failed
        } catch {
            return .failed
        }
    }

    private struct EventResponse: Decodable { let event: AeroEvent? }

    static func event(id: String) async -> AeroEvent? {
        let url = baseURL.appending(path: "/api/aerospot/events/\(id)")
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode)
            else { return nil }
            return try JSONDecoder().decode(EventResponse.self, from: data).event
        } catch {
            return nil
        }
    }

    static func events() async -> [AeroEvent] {
        let url = baseURL.appending(path: "/api/aerospot/events")
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode)
            else { return CuratedEventsFallback.all }
            return try JSONDecoder().decode(EventsResponse.self, from: data).events
        } catch {
            return CuratedEventsFallback.all
        }
    }

    // ── Aircraft photo (planespotters via backend) ───────────────────

    struct AircraftPhoto: Decodable, Sendable {
        let thumbnailUrl: String?
        let photographer: String?
        let link: String?
    }

    private struct PhotoResponse: Decodable { let photo: AircraftPhoto? }

    /// Henter flybilde per hex/registrering. nil hvis ingen finnes.
    static func aircraftPhoto(id: String) async -> AircraftPhoto? {
        let clean = id.replacingOccurrences(of: "mock-", with: "")
        guard !clean.isEmpty else { return nil }
        let url = baseURL.appending(path: "/api/aerospot/aircraft/\(clean)/photo")
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode)
            else { return nil }
            return try JSONDecoder().decode(PhotoResponse.self, from: data).photo
        } catch {
            return nil
        }
    }

    // ── Weather ──────────────────────────────────────────────────────

    private struct WeatherResponse: Decodable {
        let weather: Weather
    }

    static func weather(lat: Double, lon: Double) async -> Weather {
        var components = URLComponents(
            url: baseURL.appending(path: "/api/aerospot/weather"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "lat", value: String(format: "%.4f", lat)),
            URLQueryItem(name: "lon", value: String(format: "%.4f", lon)),
            URLQueryItem(name: "icao", value: OSLData.airport.icao),
        ]
        do {
            let (data, _) = try await session.data(from: components.url!)
            return try JSONDecoder().decode(WeatherResponse.self, from: data).weather
        } catch {
            // Mock-fallback (merket: statiske demo-verdier)
            return Weather(
                temperatureC: 17, windDirectionDeg: 220, windSpeedKt: 12,
                gustKt: 18, visibilityKm: 10, cloudCoverPct: 40,
                precipitationMmH: 0, pressureHpa: 1016,
                symbol: "partlycloudy_day",
                fetchedAtIso: ISO8601DateFormatter().string(from: Date())
            )
        }
    }
}

/// MockFlightProvider — deterministisk simulering rundt OSL når live-data
/// mangler. Tydelig merket mock (id-prefix "mock-").
enum MockFlights {
    private struct Route {
        let callsign: String, flightNumber: String, registration: String
        let type: String, icao: String, airline: String
        let origin: String, etaOffsetMin: Double, bearing: Double, speedKt: Double
    }

    private static let routes: [Route] = [
        Route(callsign: "GTI8087", flightNumber: "5Y8087", registration: "N852GT",
              type: "Boeing 747-8F", icao: "B748", airline: "Atlas Air",
              origin: "Atlanta", etaOffsetMin: 24, bearing: 225, speedKt: 460),
        Route(callsign: "UAE161", flightNumber: "EK161", registration: "A6-EVL",
              type: "Airbus A380-800", icao: "A388", airline: "Emirates",
              origin: "Dubai", etaOffsetMin: 38, bearing: 160, speedKt: 470),
        Route(callsign: "SAS1472", flightNumber: "SK1472", registration: "SE-ROJ",
              type: "Airbus A320neo", icao: "A20N", airline: "SAS",
              origin: "København", etaOffsetMin: 9, bearing: 190, speedKt: 420),
        Route(callsign: "NAX1938", flightNumber: "DY1938", registration: "LN-ENM",
              type: "Boeing 737-800", icao: "B738", airline: "Norwegian",
              origin: "Alicante", etaOffsetMin: 14, bearing: 210, speedKt: 430),
        Route(callsign: "ANA203", flightNumber: "NH203", registration: "JA795A",
              type: "Boeing 777-300ER", icao: "B77W", airline: "ANA",
              origin: "Tokyo", etaOffsetMin: 55, bearing: 70, speedKt: 480),
        Route(callsign: "WIF612", flightNumber: "WF612", registration: "LN-WEA",
              type: "DHC Dash 8-100", icao: "DH8A", airline: "Widerøe",
              origin: "Fagernes", etaOffsetMin: 6, bearing: 300, speedKt: 240),
        Route(callsign: "RCH485", flightNumber: "", registration: "08-8607",
              type: "Boeing C-17A Globemaster III", icao: "C17", airline: "US Air Force",
              origin: "Ramstein", etaOffsetMin: 30, bearing: 200, speedKt: 450),
    ]

    static func current(now: Date = Date()) -> [LiveFlight] {
        let center = OSLData.airport.coordinate
        let clockMin = now.timeIntervalSince1970 / 60
        let iso = ISO8601DateFormatter()

        return routes.enumerated().compactMap { index, route in
            // Kontinuerlig, forskjøvet syklus per rute så det ALLTID er
            // trafikk (unngår dødt vindu). En «landet» flight kommer inn igjen.
            let cycle = 42.0 + Double(index) * 6
            let phase = Double(index) * 5
            var minToLanding = route.etaOffsetMin
                - (clockMin + phase).truncatingRemainder(dividingBy: cycle)
            if minToLanding < -5 { minToLanding += cycle }
            if minToLanding < -5 { return nil }
            let landed = minToLanding <= 0
            let distKm = max(0, minToLanding) * route.speedKt / 60 * 1.852
            let radBearing = route.bearing * .pi / 180
            let lat = center.latitude + distKm / 111 * cos(radBearing)
            let lng = center.longitude
                + distKm / (111 * cos(center.latitude * .pi / 180)) * sin(radBearing)
            let altitude = landed ? 0.0 : min(38000, max(800, minToLanding * 1100))
            let speed = landed ? 15.0 : min(route.speedKt, max(140, minToLanding * 40))

            return LiveFlight(
                id: "mock-\(route.callsign)",
                callsign: route.callsign,
                flightNumber: route.flightNumber,
                registration: route.registration,
                aircraftType: route.type,
                aircraftIcao: route.icao,
                airline: route.airline,
                origin: route.origin,
                destination: "Oslo",
                latitude: lat,
                longitude: lng,
                altitudeFt: Int(altitude),
                groundSpeedKt: Int(speed),
                verticalSpeedFpm: landed ? 0 : -Int(min(1800, altitude / max(1, minToLanding))),
                headingDeg: Int((route.bearing + 180).truncatingRemainder(dividingBy: 360)),
                etaIso: iso.string(from: now.addingTimeInterval(minToLanding * 60)),
                onGround: landed,
                lastSeenIso: iso.string(from: now)
            )
        }
    }
}

/// Offline-fallback for arrangementer (speiler backend-seed).
enum CuratedEventsFallback {
    static let all: [AeroEvent] = [
        AeroEvent(id: "kjeller-flydag-2026", name: "Kjeller Flydag", type: "flydag",
                  venue: "Kjeller flyplass", country: "NO", airportIcao: "ENKJ",
                  latitude: 59.9703, longitude: 11.0361,
                  startDate: "2026-06-14", endDate: "2026-06-14",
                  description: "Norges eldste flyplass i drift. Veteranfly, oppvisninger og nær tilgang til flyene på bakken.",
                  url: "https://kjellerflyhistoriske.no"),
        AeroEvent(id: "rygge-airshow-2026", name: "Rygge Airshow", type: "airshow",
                  venue: "Moss lufthavn Rygge", country: "NO", airportIcao: "ENRY",
                  latitude: 59.3789, longitude: 10.7856,
                  startDate: "2026-08-22", endDate: "2026-08-23",
                  description: "Militær- og sivil oppvisning med Forsvarets deltakelse.", url: nil),
        AeroEvent(id: "notodden-flyshow-2026", name: "Notodden Flyshow", type: "airshow",
                  venue: "Notodden lufthavn", country: "NO", airportIcao: "ENNO",
                  latitude: 59.5657, longitude: 9.2121,
                  startDate: "2026-06-27", endDate: "2026-06-27",
                  description: "Populært flyshow på Notodden med veteranfly, akrobatikk og oppvisninger.", url: nil),
        AeroEvent(id: "eskilstuna-flygdag-2026", name: "Eskilstuna Flygdag", type: "flydag",
                  venue: "Eskilstuna flygplats", country: "SE", airportIcao: "ESSU",
                  latitude: 59.3511, longitude: 16.7089,
                  startDate: "2026-08-15", endDate: "2026-08-15",
                  description: "En av Sveriges største flygdager. Historiske og moderne fly.", url: nil),
        AeroEvent(id: "osl-spotterday-2026", name: "OSL Spotterdag", type: "spotting",
                  venue: "Oslo Gardermoen — Vollen", country: "NO", airportIcao: "ENGM",
                  latitude: 60.169, longitude: 11.0655,
                  startDate: "2026-09-05", endDate: "2026-09-05",
                  description: "Uformell samling for plane spotters ved Vollen.", url: nil),
    ]
}
