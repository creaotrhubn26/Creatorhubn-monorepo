// ProximityMonitor.swift
//
// CLCircularRegion-monitorering for tildelte leads. Når selger kommer
// innenfor 500m av en lead → kallt backend som sender push (med 4t-
// throttle per (user, lead)).
//
// Apple gir maks 20 simultane regions per app, så vi monitorerer kun
// de 20 nærmeste leads til brukerens current location. Refresh
// periodisk (hvert 10 min ELLER ved signifikant location-change).
//
// Bakgrunns-modus:
//   - CLCircularRegion virker i bakgrunn KUN med 'always' authorization
//   - Med 'whenInUse' virker monitoreringen kun mens app er åpen
//   - Vi requester always senere når brukeren har sett verdien

import Foundation
import CoreLocation
import UIKit

/// Maks region-radius i meter. Apple anbefaler minst 100m for
/// pålitelig deteksjon.
private let REGION_RADIUS_METERS: Double = 500

/// Max regions samtidig (Apple-grense)
private let MAX_REGIONS = 20

@MainActor
final class ProximityMonitor: NSObject, ObservableObject {
    static let shared = ProximityMonitor()

    private let manager = CLLocationManager()
    private weak var api: APIClient?
    private var monitoredLeadIds: Set<String> = []
    private var lastRefreshAt: Date?

    /// Tildelte leads med koordinater. Settes fra AppState.refreshWorkload.
    private var assignedLeads: [(id: String, lat: Double, lng: Double)] = []

    /// Når monitorering er aktiv. Bytter farge på toggle i Org-tab.
    @Published var isMonitoring: Bool = false
    @Published var alwaysAuthorizationGranted: Bool = false

    override private init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.allowsBackgroundLocationUpdates = false  // toggles when always
        alwaysAuthorizationGranted =
            manager.authorizationStatus == .authorizedAlways
    }

    /// Konfigurer med API-klient (fra AppState ved bootstrap).
    func configure(api: APIClient) {
        self.api = api
    }

    /// Be om 'always' authorization. Brukeren må først ha gitt
    /// 'whenInUse'. Apple anbefaler å vente til brukeren har sett
    /// verdien (de tildelte leads-er).
    func requestAlwaysAuthorization() {
        if manager.authorizationStatus == .authorizedWhenInUse {
            manager.requestAlwaysAuthorization()
        }
    }

    /// Oppdater liste av tildelte leads. Kalles fra
    /// AppState.refreshWorkload. Re-konfigurerer regions hvis nødvendig.
    func updateAssignedLeads(_ leads: [WorkloadLead]) {
        let withCoords: [(id: String, lat: Double, lng: Double)] = leads
            .compactMap { lead in
                guard let lat = lead.latitude, let lng = lead.longitude else { return nil }
                return (lead.id, lat, lng)
            }
        // Endret ikke? Hopp.
        let newIds = Set(withCoords.map(\.id))
        if newIds == monitoredLeadIds, lastRefreshAt != nil {
            return
        }
        self.assignedLeads = withCoords
        rebuildRegions()
    }

    /// Bygg om regions: stopp gamle, registrer 20 nærmeste.
    private func rebuildRegions() {
        // Stopp eksisterende
        for region in manager.monitoredRegions where region is CLCircularRegion {
            manager.stopMonitoring(for: region)
        }
        monitoredLeadIds.removeAll()

        // Sorter etter nærhet hvis vi har current location, ellers
        // bare ta de første
        let candidates: [(id: String, lat: Double, lng: Double, dist: Double)]
        if let me = LocationService.shared.currentLocation {
            candidates = assignedLeads.map { lead in
                let leadLoc = CLLocation(latitude: lead.lat, longitude: lead.lng)
                return (lead.id, lead.lat, lead.lng, me.distance(from: leadLoc))
            }.sorted { $0.dist < $1.dist }
        } else {
            candidates = assignedLeads.map { ($0.id, $0.lat, $0.lng, Double.infinity) }
        }

        // Registrer top-N
        for candidate in candidates.prefix(MAX_REGIONS) {
            let region = CLCircularRegion(
                center: CLLocationCoordinate2D(latitude: candidate.lat, longitude: candidate.lng),
                radius: REGION_RADIUS_METERS,
                identifier: "lead.\(candidate.id)",
            )
            region.notifyOnEntry = true
            region.notifyOnExit = false
            manager.startMonitoring(for: region)
            monitoredLeadIds.insert(candidate.id)
        }
        lastRefreshAt = Date()
        isMonitoring = !monitoredLeadIds.isEmpty
    }

    /// Stopp all monitorering (signOut)
    func stopAll() {
        for region in manager.monitoredRegions {
            manager.stopMonitoring(for: region)
        }
        monitoredLeadIds.removeAll()
        isMonitoring = false
    }
}

// MARK: - Delegate

extension ProximityMonitor: CLLocationManagerDelegate {
    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didEnterRegion region: CLRegion,
    ) {
        // Trygt å unwrappe — vi laget alle regions m/ "lead.<id>" prefix
        let identifier = region.identifier
        guard identifier.hasPrefix("lead."),
              let centerRegion = region as? CLCircularRegion else { return }
        let leadId = String(identifier.dropFirst("lead.".count))
        let center = centerRegion.center
        Task { @MainActor [weak self] in
            guard let self else { return }
            let distance: Double? = LocationService.shared.currentLocation.map {
                $0.distance(from: CLLocation(latitude: center.latitude, longitude: center.longitude))
            }
            await self.postApproaching(leadId: leadId, distance: distance)
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // Snapshot status FØR Task — CLLocationManager er ikke Sendable
        let status = manager.authorizationStatus
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.alwaysAuthorizationGranted = (status == .authorizedAlways)
            if status == .authorizedAlways {
                // Bytt til bakgrunns-modus via egen manager (MainActor-iso)
                self.manager.allowsBackgroundLocationUpdates = true
            }
        }
    }

    @MainActor
    private func postApproaching(leadId: String, distance: Double?) async {
        guard let api else { return }
        do {
            try await api.notifyApproachingLead(leadId: leadId, distanceM: distance)
        } catch {
            // Stille feil — neste region-entry prøver igjen (etter 4t throttle)
            print("[ProximityMonitor] notify failed: \(error)")
        }
    }
}
