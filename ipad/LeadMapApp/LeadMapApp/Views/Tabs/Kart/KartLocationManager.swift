// KartLocationManager.swift — ekte CoreLocation-brukerposisjon for
// "Sentrer på meg"-FAB (Pakke 10.1, 2026-07-01).
//
// Enkel singleton som:
//   - Ber om WhenInUseAuthorization ved første `requestIfNeeded()`-kall
//   - Starter oppdatering når autorisert
//   - Cacher siste kjente koordinat i `currentCoordinate`
//   - Publiserer `status` (NSNotDetermined/Denied/Authorized) for UI-fallback
//
// I prod bør Info.plist ha NSLocationWhenInUseUsageDescription (allerede der
// via project.yml + NSLocationAlwaysAndWhenInUseUsageDescription for lead-
// nærhetsvarsler i bakgrunn).

import Foundation
import CoreLocation
import CoreMotion

/// Bevegelsesform slik Apples motion-koprosessor klassifiserer den.
enum MotionTransport: String, Sendable { case walking, cycling, automotive }

@MainActor
@Observable
final class KartLocationManager: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    static let shared = KartLocationManager()

    private let manager: CLLocationManager
    private(set) var currentCoordinate: CLLocationCoordinate2D?
    private(set) var status: CLAuthorizationStatus
    /// Apple Core Motion aktivitets-klassifikator (M-koprosessor) — skiller
    /// gå/sykkel/bil ved å fusjonere akselerometer + gyro, uavhengig av GPS.
    /// Nav-modus bruker denne til å auto-velge rute-type. `nil` til klassifisert
    /// (eller på macOS, som faller tilbake til hastighet).
    private(set) var motionTransport: MotionTransport? = nil
    #if os(iOS)
    private let activityManager = CMMotionActivityManager()
    private var activityRunning = false
    #endif
    /// Bevegelses-flag basert på CLLocation.speed. True når user beveger
    /// seg > 0.5 m/s (~1.8 km/h — gange). Går tilbake til false ~3s etter
    /// user stopper (så MeMapPin ikke flakker mellom stille/beveger).
    private(set) var isMoving: Bool = false
    /// Retning i grader (0-360, nord=0, øst=90). Brukes til å rotere
    /// MeMapPin når user beveger seg. `nil` når stille (course er ugyldig).
    private(set) var heading: CLLocationDirection?
    /// Sist rapporterte hastighet i meter/sekund (>= 0). `nil` når stille eller
    /// speed er ugyldig (CLLocation.speed < 0). Brukes av HUD-navigasjon.
    private(set) var speedMps: Double?
    private var isMovingResetTask: Task<Void, Never>?

    override init() {
        self.manager = CLLocationManager()
        self.status = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest  // Best for speed-detection
        manager.distanceFilter = 5                          // Oppdater hvert 5m for jevn bevegelses-tracking
    }

    /// Ber om tilgang hvis vi ikke har spurt før. Idempotent — trygg å kalle
    /// hver gang «Sentrer på meg»-FAB tappes.
    func requestIfNeeded() {
        switch status {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        case .denied, .restricted:
            break  // KartView fallback til Oslo + viser toast
        @unknown default:
            break
        }
    }

    // MARK: - Transport-deteksjon (gå/sykkel/bil)

    /// Start Core Motion aktivitets-klassifisering. Kalles når nav-modus åpnes.
    /// No-op på macOS eller når klassifikatoren ikke er tilgjengelig.
    func startTransportDetection() {
        #if os(iOS)
        guard CMMotionActivityManager.isActivityAvailable(), !activityRunning else { return }
        activityRunning = true
        activityManager.startActivityUpdates(to: .main) { [weak self] activity in
            guard let self, let a = activity, a.confidence != .low else { return }
            let t: MotionTransport?
            if a.automotive { t = .automotive }
            else if a.cycling { t = .cycling }
            else if a.walking || a.running { t = .walking }
            else { t = nil }   // stationary/unknown → behold forrige
            Task { @MainActor in if let t { self.motionTransport = t } }
        }
        #endif
    }

    /// Stopp aktivitets-klassifisering (spar batteri) når nav-modus lukkes.
    func stopTransportDetection() {
        #if os(iOS)
        guard activityRunning else { return }
        activityRunning = false
        activityManager.stopActivityUpdates()
        #endif
        motionTransport = nil
    }

    /// Skru på/av høyeste GPS-nøyaktighet for turn-by-turn. `BestForNavigation`
    /// bruker ekstra sensorer (bl.a. bevegelses-koprosessor) og gir tettere,
    /// mer presise fixes — men mer batteri, så vi slår det kun på under nav.
    func setNavigationMode(_ on: Bool) {
        manager.desiredAccuracy = on ? kCLLocationAccuracyBestForNavigation : kCLLocationAccuracyBest
        manager.distanceFilter = on ? kCLDistanceFilterNone : 5
        #if os(iOS)
        manager.activityType = on ? .automotiveNavigation : .other
        #endif
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let newStatus = manager.authorizationStatus
        Task { @MainActor in
            self.status = newStatus
            if newStatus == .authorizedWhenInUse || newStatus == .authorizedAlways {
                self.manager.startUpdatingLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        let coord = loc.coordinate
        let speed = loc.speed  // m/s, -1 hvis ugyldig
        let course = loc.course  // grader, -1 hvis ugyldig
        Task { @MainActor in
            self.currentCoordinate = coord

            // Bevegelses-deteksjon: > 0.5 m/s = ganger/kjører.
            // Reset-task venter 3s uten bevegelse før isMoving=false —
            // hindrer flakking når speed midlertidig dropper.
            if speed > 0.5 {
                self.isMoving = true
                self.speedMps = speed
                if course >= 0 { self.heading = course }
                // Restart reset-timeren ved hver bevegelse
                self.isMovingResetTask?.cancel()
                self.isMovingResetTask = Task { @MainActor [weak self] in
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    guard !Task.isCancelled else { return }
                    self?.isMoving = false
                    self?.heading = nil
                    self?.speedMps = nil
                }
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Ikke logg spam — bare la KartView bruke fallback.
    }
}
