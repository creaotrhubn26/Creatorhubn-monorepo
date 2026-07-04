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

@MainActor
@Observable
final class KartLocationManager: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    static let shared = KartLocationManager()

    private let manager: CLLocationManager
    private(set) var currentCoordinate: CLLocationCoordinate2D?
    private(set) var status: CLAuthorizationStatus
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
