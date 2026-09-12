// HeartbeatController.swift
//
// Sender heartbeat hvert 60s for å markere brukeren som online,
// og hvis posisjons-deling er aktivt: med live lat/lng.
// Web-pendant: useEffect i LeadMapOrgPanel.tsx (PR #612).

import Foundation
import CoreLocation
import Combine

@MainActor
final class HeartbeatController: ObservableObject {
    private let api: APIClient
    private let organizationId: String
    private let locationService: LocationService
    private var task: Task<Void, Never>?

    /// Posisjons-deling-toggle. Når true sendes lat/lng med hver beat.
    @Published var isSharingLocation: Bool = false {
        didSet {
            if isSharingLocation && oldValue != isSharingLocation {
                locationService.requestPermissionIfNeeded()
                locationService.startUpdating()
            }
        }
    }

    init(api: APIClient, organizationId: String, locationService: LocationService) {
        self.api = api
        self.organizationId = organizationId
        self.locationService = locationService
    }

    func start() {
        task?.cancel()
        task = Task { [weak self] in
            guard let self else { return }
            // Send beat med en gang
            await self.beat()
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
                if Task.isCancelled { return }
                await self.beat()
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }

    private func beat() async {
        do {
            let loc = isSharingLocation ? locationService.currentLocation : nil
            try await api.sendHeartbeat(
                organizationId: organizationId,
                location: loc,
                activity: "idle"
            )
        } catch {
            // Stille feil — beat-er er ikke kritiske
        }
    }
}
