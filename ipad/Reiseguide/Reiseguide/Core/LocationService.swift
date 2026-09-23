// LocationService.swift
//
// CoreLocation i forgrunnen («når appen er i bruk»). Posisjon bes om først når
// brukeren trykker «Bruk posisjonen min» (UI-spesifikasjon 6.1). Bakgrunns-
// geofencing med CLCircularRegion (Lead Map: Core/ProximityMonitor.swift) er
// fase 2 og krever «alltid»-tillatelse.
//
// Delegatkallene kommer på en vilkårlig kø; vi trekker ut primitive verdier
// og hopper til MainActor før tilstanden oppdateres (Swift 6 strict concurrency).

import CoreLocation
import Foundation
import Observation

struct LocationFix: Sendable, Equatable {
    let coordinate: Coordinate
    let horizontalAccuracyM: Double
    let timestamp: Date

    /// POC-skissen: nøyaktighet dårligere enn 50 m ignoreres for auto-start,
    /// men kartet oppdateres.
    var isAccurateEnoughForAutoplay: Bool { horizontalAccuracyM >= 0 && horizontalAccuracyM <= 50 }
}

@MainActor
@Observable
final class LocationService: NSObject {
    enum Authorization: Sendable, Equatable {
        case notDetermined
        case denied
        case authorized
    }

    private(set) var authorization: Authorization = .notDetermined
    private(set) var fix: LocationFix?
    private(set) var lastError: String?
    /// Sann (evt. magnetisk) retning enheten peker, i grader (0 = nord).
    /// Nil når kompasset ikke er tilgjengelig eller ikke er startet
    /// (veiviseren, pakke 2 item 5, er eneste bruker per nå).
    private(set) var heading: Double?

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private var isUpdating = false
    @ObservationIgnored private var isUpdatingHeading = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        authorization = Self.map(manager.authorizationStatus)
    }

    /// Ber om tillatelse hvis den ikke er avgjort, og starter oppdateringer
    /// hvis den er gitt.
    func requestAndStart() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            start()
        default:
            authorization = .denied
        }
    }

    func start() {
        guard !isUpdating else { return }
        isUpdating = true
        manager.startUpdatingLocation()
    }

    func stop() {
        guard isUpdating else { return }
        isUpdating = false
        manager.stopUpdatingLocation()
    }

    /// Starter kompasset (veiviseren). Stopp igjen når skjermen lukkes —
    /// CLLocationManager bruker ekstra strøm på dette utover posisjon alene.
    func startUpdatingHeading() {
        guard CLLocationManager.headingAvailable(), !isUpdatingHeading else { return }
        isUpdatingHeading = true
        manager.startUpdatingHeading()
    }

    func stopUpdatingHeading() {
        guard isUpdatingHeading else { return }
        isUpdatingHeading = false
        manager.stopUpdatingHeading()
        heading = nil
    }

    nonisolated private static func map(_ status: CLAuthorizationStatus) -> Authorization {
        switch status {
        case .authorizedAlways, .authorizedWhenInUse: return .authorized
        case .denied, .restricted: return .denied
        default: return .notDetermined
        }
    }

    fileprivate func apply(status: Authorization) {
        authorization = status
        if status == .authorized { start() }
    }

    fileprivate func apply(fix: LocationFix) {
        self.fix = fix
        lastError = nil
    }

    fileprivate func apply(error: String) {
        lastError = error
    }

    fileprivate func apply(heading: Double?) {
        self.heading = heading
    }
}

extension LocationService: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = Self.map(manager.authorizationStatus)
        Task { @MainActor in self.apply(status: status) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last else { return }
        let fix = LocationFix(
            coordinate: Coordinate(lat: last.coordinate.latitude, lng: last.coordinate.longitude),
            horizontalAccuracyM: last.horizontalAccuracy,
            timestamp: last.timestamp
        )
        Task { @MainActor in self.apply(fix: fix) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor in self.apply(error: message) }
    }

    /// Negativ nøyaktighet = ugyldig avlesning (Apples dokumentasjon); da
    /// nullstilles heading i stedet for å vise en tilfeldig retning.
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        guard newHeading.headingAccuracy >= 0 else {
            Task { @MainActor in self.apply(heading: nil) }
            return
        }
        let value = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        Task { @MainActor in self.apply(heading: value) }
    }
}
