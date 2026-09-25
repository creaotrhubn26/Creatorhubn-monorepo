// LocationService.swift
//
// CoreLocation i forgrunnen («når appen er i bruk»). Posisjon bes om først når
// brukeren trykker «Bruk posisjonen min» (UI-spesifikasjon 6.1).
//
// Bakgrunnsvarsel (pakke 2, item 2): `requestAlwaysAuthorization()` +
// `updateMonitoredRegions(_:origin:)` overvåker de nærmeste 20 stedene med
// CLCircularRegion (RegionRotation.swift) og krever «Alltid»-tillatelse —
// bes bare om etter det to-stegs samtykket i
// Features/Settings/ArrivalNotificationsSettingsSection.swift, aldri
// automatisk. `onRegionEnter` fyrer også fra bakgrunnen, i motsetning til
// `fix`/`didUpdateLocations`.
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
    /// «Alltid»-posisjon innvilget (bakgrunnsvarsel, pakke 2 item 2). Egen
    /// verdi fra `authorization` fordi den slår sammen When-In-Use og Alltid
    /// til samme «gitt»-tilstand — regionovervåking i bakgrunnen trenger å
    /// vite forskjellen.
    private(set) var isAuthorizedAlways = false

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private var isUpdating = false
    @ObservationIgnored private var isUpdatingHeading = false
    @ObservationIgnored private var lastRegionsOrigin: Coordinate?
    private(set) var monitoredPoiIds: Set<String> = []
    /// Kalt når en overvåket sone utløses — fyrer også fra bakgrunnen, i
    /// motsetning til `fix` (bakgrunnsvarsel, pakke 2 item 2). Satt av
    /// AppEnvironment, som avgjør forgrunn/bakgrunn og videresender til
    /// ArrivalCoordinator.
    var onRegionEnter: ((String) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        // Regionovervåking (CLCircularRegion) leveres av iOS uten løpende
        // bakgrunnsoppdateringer — vi ber ALDRI om kontinuerlig posisjon i
        // bakgrunnen, bare grensekryssingsvarsler (bakgrunnsvarsel, pakke 2 item 2).
        manager.allowsBackgroundLocationUpdates = false
        authorization = Self.map(manager.authorizationStatus)
        isAuthorizedAlways = manager.authorizationStatus == .authorizedAlways
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

    /// «Alltid»-posisjon (bakgrunnsvarsel, pakke 2 item 2). Krever When-In-Use
    /// innvilget fra før (CoreLocations egen regel) — kalles bare etter det
    /// to-stegs samtykket i UI, aldri automatisk (se
    /// Features/Settings/ArrivalNotificationsSettingsSection.swift).
    func requestAlwaysAuthorization() {
        guard manager.authorizationStatus == .authorizedWhenInUse else { return }
        manager.requestAlwaysAuthorization()
    }

    /// Overvåker de nærmeste 20 stedene med CLCircularRegion (bakgrunnsvarsel,
    /// pakke 2 item 2): bytter settet ut når brukeren har beveget seg nok
    /// (RegionRotation), starter bare nye regioner og stopper de som falt ut.
    func updateMonitoredRegions(_ pois: [GuidePOI], origin: Coordinate) {
        guard isAuthorizedAlways, CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { return }
        guard RegionRotation.shouldRecompute(previousOrigin: lastRegionsOrigin, newOrigin: origin) else { return }
        lastRegionsOrigin = origin

        let nearest = RegionRotation.nearestPois(pois, from: origin)
        let desiredIds = Set(nearest.map(\.id))
        for region in manager.monitoredRegions where !desiredIds.contains(region.identifier) {
            manager.stopMonitoring(for: region)
        }
        let alreadyMonitored = Set(manager.monitoredRegions.map(\.identifier))
        for poi in nearest where !alreadyMonitored.contains(poi.id) {
            let region = CLCircularRegion(center: poi.coordinate.clCoordinate, radius: max(Double(poi.triggerRadiusM), 20), identifier: poi.id)
            region.notifyOnEntry = true
            region.notifyOnExit = false
            manager.startMonitoring(for: region)
        }
        monitoredPoiIds = desiredIds
    }

    /// Slår av bakgrunnsvarselet: stopper all regionovervåking (bryteren
    /// skrudd av, eller «Alltid»-tillatelsen ble trukket tilbake).
    func stopMonitoringAllRegions() {
        for region in manager.monitoredRegions { manager.stopMonitoring(for: region) }
        monitoredPoiIds = []
        lastRegionsOrigin = nil
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

    fileprivate func apply(status: Authorization, isAlways: Bool) {
        authorization = status
        isAuthorizedAlways = isAlways
        if status == .authorized { start() }
        if !isAlways {
            // Tillatelsen ble ikke (lenger) «Alltid»: ingen vits i å holde
            // regioner overvåket appen ikke lenger får varslet om i bakgrunnen.
            stopMonitoringAllRegions()
        }
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
        let rawStatus = manager.authorizationStatus
        let status = Self.map(rawStatus)
        let isAlways = rawStatus == .authorizedAlways
        Task { @MainActor in self.apply(status: status, isAlways: isAlways) }
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

    /// Bakgrunnsvarsel (pakke 2, item 2): en overvåket sone ble krysset —
    /// fyrer også når appen ikke kjører aktivt i forgrunnen.
    nonisolated func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        let identifier = region.identifier
        Task { @MainActor in self.onRegionEnter?(identifier) }
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
