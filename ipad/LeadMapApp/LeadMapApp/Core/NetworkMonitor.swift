// NetworkMonitor.swift
//
// Robusthet-pakke 3 — observer for connectivity-transisjoner. Bruker
// NWPathMonitor (Network framework) under panseret. `onConnectivityRestored`
// kalles når vi går fra offline → online, så LeadMapApp kan trigge
// OfflineActionQueue.drain() ved reconnect.
//
// Swift 6 strict concurrency: NWPathMonitor.pathUpdateHandler er @Sendable,
// vi hopper inn på MainActor før vi muterer @Observable-state.

import Foundation
import Network
import Observation

@MainActor
@Observable
final class NetworkMonitor {
    static let shared = NetworkMonitor()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "leadgrid.network-monitor")

    private(set) var isOnline: Bool = true
    private(set) var connectionType: String = "unknown"

    /// Kalles én gang per offline→online-transisjon.
    /// LeadMapApp registrerer en handler som drainer OfflineActionQueue.
    var onConnectivityRestored: (@MainActor () -> Void)?

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            // Snap ut Sendable-felter FØR vi krysser actor-grensen
            let satisfied = path.status == .satisfied
            let isWifi = path.usesInterfaceType(.wifi)
            let isCellular = path.usesInterfaceType(.cellular)
            let isEthernet = path.usesInterfaceType(.wiredEthernet)
            Task { @MainActor in
                guard let self else { return }
                let wasOffline = !self.isOnline
                self.isOnline = satisfied
                if isWifi { self.connectionType = "wifi" }
                else if isCellular { self.connectionType = "cellular" }
                else if isEthernet { self.connectionType = "ethernet" }
                else { self.connectionType = "unknown" }

                if wasOffline && self.isOnline {
                    self.onConnectivityRestored?()
                }
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
