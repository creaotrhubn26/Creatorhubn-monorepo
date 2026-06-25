// TerritoryMonitor.swift
//
// Native geofence-håndheving for selger-grids ("hold deg i din sone").
//
//  • On-device sjekk: ved hver posisjonsoppdatering avgjøres lokalt om
//    selgeren er innenfor minst én av sine grids (polygon eller sirkel) —
//    umiddelbart, offline, batterivennlig.
//  • Bakgrunns-geofence: sirkel-grids registreres som CLCircularRegion slik
//    at iOS varsler selgeren (lokal notifikasjon) selv når appen er i
//    bakgrunnen når de forlater sonen. Polygoner dekkes av on-device-sjekken.
//
// Egen CLLocationManager (uavhengig av LocationService) for å holde
// geofence-logikken selvstendig. Krever NSLocationAlwaysAndWhenInUse-
// UsageDescription + UIBackgroundModes:location i Info.plist for pålitelig
// bakgrunns-levering. Serveren logger uansett brudd via heartbeat.

import Foundation
import CoreLocation
import UserNotifications

@MainActor
@Observable
final class TerritoryMonitor: NSObject, CLLocationManagerDelegate {
    static let shared = TerritoryMonitor()

    private let manager = CLLocationManager()

    private(set) var territories: [Territory] = []
    /// Har selgeren minst én grid? (Ingen grid ⇒ ingen håndheving.)
    private(set) var isEnforced = false
    /// Er selgeren akkurat nå utenfor alle sine grids?
    private(set) var isOutsideGrid = false

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    /// Sett (eller oppdater) hvilke grids som overvåkes.
    func configure(territories: [Territory]) {
        self.territories = territories
        self.isEnforced = !territories.isEmpty
        requestAuthIfNeeded()
        manager.startUpdatingLocation()
        registerCircleRegions()
        if let loc = manager.location { evaluate(loc.coordinate) }
    }

    private func requestAuthIfNeeded() {
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse: manager.requestAlwaysAuthorization()
        default: break
        }
        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    private func registerCircleRegions() {
        // Rydd tidligere grid-regioner.
        for region in manager.monitoredRegions where region.identifier.hasPrefix("grid:") {
            manager.stopMonitoring(for: region)
        }
        guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { return }
        // iOS tillater maks 20 regioner per app — ta de med høyest priority.
        let circles = territories
            .filter { $0.hasCircle }
            .sorted { ($0.priority ?? 0) > ($1.priority ?? 0) }
            .prefix(20)
        for t in circles {
            guard let c = t.center, let r = t.radiusM else { continue }
            let radius = min(Double(r), manager.maximumRegionMonitoringDistance)
            let region = CLCircularRegion(center: c, radius: radius, identifier: "grid:\(t.id)")
            region.notifyOnEntry = true
            region.notifyOnExit = true
            manager.startMonitoring(for: region)
        }
    }

    private func evaluate(_ coord: CLLocationCoordinate2D) {
        guard isEnforced else { isOutsideGrid = false; return }
        isOutsideGrid = !TerritoryGeo.isInsideAny(coord, territories: territories)
    }

    private func notifyExit() {
        let content = UNMutableNotificationContent()
        content.title = "Utenfor din sone"
        content.body = "Du har forlatt ditt tildelte område."
        content.sound = .default
        let req = UNNotificationRequest(
            identifier: "grid-exit-\(UUID().uuidString)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req)
    }

    // MARK: - CLLocationManagerDelegate (nonisolated → hopp til MainActor)

    nonisolated func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        Task { @MainActor in self.evaluate(loc.coordinate) }
    }

    nonisolated func locationManager(_ m: CLLocationManager, didExitRegion region: CLRegion) {
        guard region.identifier.hasPrefix("grid:") else { return }
        Task { @MainActor in
            // Bekreft on-device at vi faktisk er ute av ALLE grids (en sirkel-
            // exit kan fortsatt være innenfor et overlappende polygon).
            if let loc = self.manager.location {
                self.evaluate(loc.coordinate)
                if self.isOutsideGrid { self.notifyExit() }
            } else {
                self.isOutsideGrid = true
                self.notifyExit()
            }
        }
    }

    nonisolated func locationManager(_ m: CLLocationManager, didEnterRegion region: CLRegion) {
        Task { @MainActor in
            if let loc = self.manager.location { self.evaluate(loc.coordinate) }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        let status = m.authorizationStatus
        Task { @MainActor in
            if status == .authorizedWhenInUse { self.manager.requestAlwaysAuthorization() }
            if status == .authorizedAlways || status == .authorizedWhenInUse {
                self.manager.startUpdatingLocation()
                self.registerCircleRegions()
            }
        }
    }
}
