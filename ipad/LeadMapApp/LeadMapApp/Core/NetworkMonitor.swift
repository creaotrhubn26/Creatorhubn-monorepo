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
    #if DEBUG
    private var connectivityOverride: Bool?
    #endif

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
                #if DEBUG
                if let override = self.connectivityOverride {
                    self.applyConnectivity(online: override, type: "qa-override")
                    return
                }
                #endif
                let type = isWifi ? "wifi" :
                    isCellular ? "cellular" :
                    isEthernet ? "ethernet" : "unknown"
                self.applyConnectivity(online: satisfied, type: type)
            }
        }
        monitor.start(queue: queue)
    }

    private func applyConnectivity(online: Bool, type: String) {
        let wasOffline = !isOnline
        isOnline = online
        connectionType = type
        if wasOffline && online {
            onConnectivityRestored?()
        }
    }

    #if DEBUG
    /// Deterministisk UI-testhook. Påvirker bare appens nettverksbeslutning;
    /// Release/TestFlight må fortsatt testes med et fysisk nettverksbrudd.
    func setConnectivityForTesting(online: Bool) {
        connectivityOverride = online
        applyConnectivity(online: online, type: "qa-override")
    }
    #endif

    deinit {
        monitor.cancel()
    }
}
