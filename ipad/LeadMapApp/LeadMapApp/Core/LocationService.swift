// LocationService.swift
//
// Async/await-vennlig CLLocationManager-wrapper.
//
// Bruk:
//   let coord = try await LocationService.shared.currentLocation()
//   // coord.latitude, coord.longitude
//
// Håndterer permission-request automatisk. Kaster `LocationError.denied`
// hvis brukeren har avslått eller restricted.
//
// Beste-presisjon: kCLLocationAccuracyBest (kreves for å verifisere
// at brukeren faktisk står ved leaden).

import CoreLocation

enum LocationError: Error, LocalizedError {
    case denied
    case restricted
    case unavailable
    case timeout

    var errorDescription: String? {
        switch self {
        case .denied: return "Posisjon avslått. Gå til Innstillinger → Lead Map → Posisjon for å aktivere."
        case .restricted: return "Posisjon er begrenset på enheten."
        case .unavailable: return "Klarte ikke hente posisjon."
        case .timeout: return "Tok for lang tid å hente posisjon. Prøv igjen."
        }
    }
}

@MainActor
final class LocationService: NSObject {
    static let shared = LocationService()

    private let manager: CLLocationManager
    private var continuation: CheckedContinuation<CLLocationCoordinate2D, Error>?
    private var timeoutTask: Task<Void, Never>?

    override private init() {
        self.manager = CLLocationManager()
        super.init()
        self.manager.delegate = self
        self.manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func currentLocation(timeoutSeconds: TimeInterval = 10) async throws -> CLLocationCoordinate2D {
        // Authorization-flow
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
            // Vent på delegate-callback (foretatt rett etter)
        case .denied:
            throw LocationError.denied
        case .restricted:
            throw LocationError.restricted
        default:
            break
        }

        return try await withCheckedThrowingContinuation { continuation in
            // Kanseller forrige hvis det fortsatt henger (defensiv)
            self.continuation?.resume(throwing: LocationError.unavailable)
            self.continuation = continuation

            // Timeout
            self.timeoutTask?.cancel()
            self.timeoutTask = Task {
                try? await Task.sleep(nanoseconds: UInt64(timeoutSeconds * 1_000_000_000))
                if !Task.isCancelled {
                    await MainActor.run {
                        if let cont = self.continuation {
                            self.continuation = nil
                            cont.resume(throwing: LocationError.timeout)
                        }
                    }
                }
            }

            manager.requestLocation()
        }
    }

    /// Avstand i meter mellom to koordinater (haversine via CLLocation).
    nonisolated func distanceMeters(
        from a: CLLocationCoordinate2D,
        to b: CLLocationCoordinate2D
    ) -> Double {
        let la = CLLocation(latitude: a.latitude, longitude: a.longitude)
        let lb = CLLocation(latitude: b.latitude, longitude: b.longitude)
        return la.distance(from: lb)
    }

    // MARK: - Kontinuerlig tracking (for heartbeat + Min dag-distanse)

    /// Sist mottatte posisjon. Settes mens startUpdating() er aktiv.
    /// Nil hvis ennå ikke fixet eller authorization mangler.
    private(set) var currentLocation: CLLocation?

    /// Nåværende autorisasjons-status. Eksponert så views kan vise
    /// "Posisjon avslått"-banner uten å duplisere CLLocationManager.
    var authorizationStatus: CLAuthorizationStatus {
        manager.authorizationStatus
    }

    /// Ber om when-in-use authorization hvis ikke avgjort.
    func requestPermissionIfNeeded() {
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
    }

    /// Ber om when-in-use authorization og venter (best-effort) på at
    /// iOS-dialogen lukkes. Brukes ved første visning av kart-fanen så
    /// permission-dialogen vises proaktivt — uten dette må noe
    /// (heartbeat / VisitLog) trigge en location-spørring først.
    ///
    /// Hvis status allerede er bestemt (granted/denied), returnerer
    /// umiddelbart. Hvis bruker dismisser dialogen uten å velge, gir
    /// vi opp etter ~3 s.
    func requestAuthorizationIfNeeded() async {
        guard manager.authorizationStatus == .notDetermined else { return }
        manager.requestWhenInUseAuthorization()
        // Vent på at status endrer seg (bruker tar et valg) eller timer
        // ut. Vi poller fordi delegate-callbacken allerede er knyttet
        // til one-shot continuation-mønsteret over og vi vil ikke
        // overskrive den.
        for _ in 0..<30 { // 30 × 100ms = 3s
            if manager.authorizationStatus != .notDetermined { break }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        // Hvis autorisert: start kontinuerlig oppdatering så
        // currentLocation fylles ut umiddelbart for `UserAnnotation()`.
        let status = manager.authorizationStatus
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }

    /// Start kontinuerlig oppdatering. Trigger heartbeat-loopen.
    func startUpdating() {
        manager.startUpdatingLocation()
    }

    func stopUpdating() {
        manager.stopUpdatingLocation()
    }
}

extension LocationService: CLLocationManagerDelegate {
    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let loc = locations.last else { return }
        Task { @MainActor in
            // Lagre for heartbeat + Min dag-distanse
            self.currentLocation = loc
            // Resume one-shot continuation hvis aktiv
            self.timeoutTask?.cancel()
            self.continuation?.resume(returning: loc.coordinate)
            self.continuation = nil
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        Task { @MainActor in
            self.timeoutTask?.cancel()
            self.continuation?.resume(throwing: error)
            self.continuation = nil
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // Snapshot status FØR vi krysser actor-grensa (CLLocationManager
        // er ikke Sendable — vi får ikke sende den inn i en Task).
        let status = manager.authorizationStatus
        Task { @MainActor in
            switch status {
            case .denied:
                self.continuation?.resume(throwing: LocationError.denied)
                self.continuation = nil
            case .restricted:
                self.continuation?.resume(throwing: LocationError.restricted)
                self.continuation = nil
            case .authorizedWhenInUse, .authorizedAlways:
                self.manager.requestLocation()
            default:
                break
            }
        }
    }
}
