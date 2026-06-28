// WatchLocationModel.swift
//
// GPS-tracker for watch — gir oss "nærmeste leads"-sortering. Vi
// bruker bare `requestLocation()` (én-skudd) når NearbyLeadsView
// vises, ikke continuous tracking (sparer batteri).

import Foundation
import CoreLocation
import Combine

@MainActor
final class WatchLocationModel: NSObject, ObservableObject {
    @Published private(set) var currentLocation: CLLocation?
    @Published private(set) var permissionGranted = false

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestPermission() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            permissionGranted = true
            requestLocation()
        default:
            permissionGranted = false
        }
    }

    func requestLocation() {
        guard permissionGranted else { return }
        manager.requestLocation()
    }
}

extension WatchLocationModel: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let granted = manager.authorizationStatus == .authorizedWhenInUse
            || manager.authorizationStatus == .authorizedAlways
        Task { @MainActor in
            self.permissionGranted = granted
            if granted { self.requestLocation() }
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let loc = locations.last else { return }
        Task { @MainActor in
            self.currentLocation = loc
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        // Silent — vi viser bare "ingen GPS"-tilstand i UI hvis location er nil.
    }
}
