// TripDetector.swift
//
// Leadgrid Go — background auto-deteksjon av kjøreturer. Logger turer HELT UTEN
// at brukeren starter navigasjon: significant-location-change vekker app-en,
// Core Motion kjenner igjen bil-kjøring, og fine location-updates samler ruta
// til bilen står stille → tur ferdigstilles og legges i kjøreboka.
//
// 🔒 PERSONVERN (GDPR/Datatilsynet): AV som standard. Starter kun etter at
// brukeren eksplisitt skrur på «Automatisk kjørebok» (samtykke) + gir `Always`-
// lokasjon. Kan skrus av når som helst. Bare KJØRETURER logges (bil), og
// formålet bekreftes av føreren i kjøreboka.
//
// Entitlements finnes alt (Always + UIBackgroundModes:location + Motion) —
// delt med nær-lead-varselet.

import Foundation
import CoreLocation
#if os(iOS)
import CoreMotion
#endif

@MainActor
@Observable
final class TripDetector: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    static let shared = TripDetector()

    private let manager = CLLocationManager()
    #if os(iOS)
    private let activityManager = CMMotionActivityManager()
    #endif

    private(set) var enabled: Bool = UserDefaults.standard.bool(forKey: "leadgrid.go.autoTrip")
    private(set) var isDriving: Bool = false

    // Aktiv tur (akkumuleres under kjøring)
    private var tripCoords: [CLLocationCoordinate2D] = []
    private var tripStartDate: Date?
    private var tripStartPlace: String = "Din posisjon"
    private var stationaryTask: Task<Void, Never>?

    private override init() { super.init() }

    // MARK: på/av (samtykke)

    /// Skru automatisk kjørebok på/av. `on=true` starter bakgrunns-deteksjon
    /// (ber om Always-lokasjon). Kalles kun fra brukerens toggle.
    func setEnabled(_ on: Bool) {
        enabled = on
        UserDefaults.standard.set(on, forKey: "leadgrid.go.autoTrip")
        if on { start() } else { stop() }
    }

    /// Start ved app-oppstart hvis brukeren har samtykket tidligere.
    func startIfEnabled() { if enabled { start() } }

    private func start() {
        manager.delegate = self
        manager.requestAlwaysAuthorization()
        manager.pausesLocationUpdatesAutomatically = false
        manager.activityType = .automotiveNavigation
        #if os(iOS)
        manager.allowsBackgroundLocationUpdates = true
        #endif
        // Lav-effekt baseline: vekkes ved ~500 m bevegelse (også når app er lukket).
        manager.startMonitoringSignificantLocationChanges()
        startMotion()
    }

    private func stop() {
        manager.stopMonitoringSignificantLocationChanges()
        manager.stopUpdatingLocation()
        #if os(iOS)
        activityManager.stopActivityUpdates()
        #endif
        stationaryTask?.cancel()
        isDriving = false
        tripCoords = []
        tripStartDate = nil
    }

    // MARK: bevegelses-deteksjon (bil vs stillestående)

    private func startMotion() {
        #if os(iOS)
        guard CMMotionActivityManager.isActivityAvailable() else { return }
        activityManager.startActivityUpdates(to: .main) { [weak self] activity in
            guard let self, let a = activity else { return }
            if a.automotive && (a.confidence == .medium || a.confidence == .high) {
                self.beginDrivingIfNeeded()
            } else if a.stationary {
                self.scheduleFinalize()
            }
        }
        #endif
    }

    private func beginDrivingIfNeeded() {
        guard !isDriving else { stationaryTask?.cancel(); return }
        isDriving = true
        tripStartDate = Date()
        tripCoords = []
        tripStartPlace = "Din posisjon"
        // Fin sporing kun mens vi kjører (ruta + distanse).
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.startUpdatingLocation()
    }

    /// Stillestående → vent 3 min. Fortsatt stille = tur ferdig.
    private func scheduleFinalize() {
        guard isDriving else { return }
        stationaryTask?.cancel()
        stationaryTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 180 * 1_000_000_000)
            guard !Task.isCancelled else { return }
            self?.finalizeTrip()
        }
    }

    private func finalizeTrip() {
        guard isDriving, let start = tripStartDate else { return }
        isDriving = false
        stationaryTask?.cancel()
        // Tilbake til lav-effekt baseline.
        manager.stopUpdatingLocation()

        let coords = tripCoords
        tripCoords = []
        tripStartDate = nil
        guard coords.count >= 2 else { return }
        var meters = 0.0
        for i in 0..<(coords.count - 1) {
            meters += NavRoutePOIService.haversine(coords[i], coords[i + 1])
        }
        let km = (meters / 1000 * 10).rounded() / 10
        guard km >= 1.0 else { return }   // hopp over bagatell/parkering-vandring

        let startC = coords.first!, endC = coords.last!
        let profile = AppStateVehicleBridge.currentProfile()
        let startPlaceSnapshot = tripStartPlace
        // Reverse-geokod slutt-sted, bygg og lagre turen.
        CLGeocoder().reverseGeocodeLocation(CLLocation(latitude: endC.latitude, longitude: endC.longitude)) { placemarks, _ in
            let endPlace = placemarks?.first.map {
                [$0.thoroughfare, $0.locality].compactMap { $0 }.joined(separator: ", ")
            } ?? "Ukjent"
            Task { @MainActor in
                let trip = Trip(
                    startDate: start, endDate: Date(),
                    startPlace: startPlaceSnapshot,
                    endPlace: endPlace.isEmpty ? "Ukjent" : endPlace,
                    startLat: startC.latitude, startLon: startC.longitude,
                    endLat: endC.latitude, endLon: endC.longitude,
                    distanceKm: km,
                    vehicleName: profile.displayName, vehiclePlate: profile.plate,
                    mileageAmount: (km * profile.mileageRate * 100).rounded() / 100,
                    tollAmount: nil,
                    source: "auto")
                TripStore.shared.add(trip)
            }
        }
    }

    // MARK: CLLocationManagerDelegate

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let coords = locations.map(\.coordinate)
        let firstCoord = coords.first
        Task { @MainActor in
            guard self.isDriving else { return }
            self.tripCoords.append(contentsOf: coords)
            // Reverse-geokod start-sted første gang.
            if self.tripStartPlace == "Din posisjon", let c = firstCoord {
                CLGeocoder().reverseGeocodeLocation(CLLocation(latitude: c.latitude, longitude: c.longitude)) { pm, _ in
                    let name = pm?.first.map { [$0.thoroughfare, $0.locality].compactMap { $0 }.joined(separator: ", ") } ?? ""
                    if !name.isEmpty { Task { @MainActor in self.tripStartPlace = name } }
                }
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Ikke-blokkerende — baseline fortsetter.
    }
}

/// Liten bro så TripDetector (uten SwiftUI-miljø) kan lese «Min bil».
/// Leser samme UserDefaults-nøkkel som `AppState.vehicleProfile` persisteres i.
enum AppStateVehicleBridge {
    static func currentProfile() -> VehicleProfile { VehicleProfileStore.load() }
}
