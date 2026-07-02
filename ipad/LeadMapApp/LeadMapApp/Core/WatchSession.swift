// WatchSession.swift
//
// iPhone-side WatchConnectivity-bro. Pusher leads-snapshot til
// Apple Watch via `updateApplicationContext`, og mottar quick-actions
// fra Watch via `didReceiveUserInfo` → POSTer til backend.
//
// Roadmap #403 — Apple Watch-app for hurtig-lead-add. Watch-target:
// LeadgridWatchApp/ (separat watchOS-app, single-target).
//
// Aktivering: kall `WatchSession.shared.activate()` fra LeadMapApp.swift
// + `WatchSession.shared.pushLeads(_:)` etter hver lead-refresh.

import Foundation
import WatchConnectivity
import Combine
import CoreLocation

@MainActor
final class WatchSession: NSObject, ObservableObject {
    static let shared = WatchSession()

    @Published private(set) var watchAvailable = false
    @Published private(set) var lastPush: Date?

    /// Closure som POSTer quick-action til backend. Settes av
    /// LeadMapApp.swift ved boot — vi unngår direkte APIClient-import
    /// her for å holde modulen frittstående.
    var onQuickAction: ((_ leadId: String, _ action: String) -> Void)?

    private let session: WCSession = .default

    override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        session.delegate = self
        session.activate()
    }

    /// Sender topp-50 leads (sortert etter sist oppdatert) til Watch.
    /// `updateApplicationContext` overskriver alltid forrige snapshot.
    func pushLeads(_ leads: [LeadModel], userLocation: CLLocation? = nil) {
        guard session.isPaired, session.isWatchAppInstalled else {
            watchAvailable = false
            return
        }
        watchAvailable = true

        // Sorter etter avstand hvis vi har user-location, ellers etter
        // siste oppdatering. Begrens til 50 for å holde payload < 65 KB.
        let sorted: [LeadModel]
        if let loc = userLocation {
            sorted = leads.sorted { lhs, rhs in
                let lhsLoc = CLLocation(latitude: lhs.latitude ?? 0, longitude: lhs.longitude ?? 0)
                let rhsLoc = CLLocation(latitude: rhs.latitude ?? 0, longitude: rhs.longitude ?? 0)
                return lhsLoc.distance(from: loc) < rhsLoc.distance(from: loc)
            }
        } else {
            sorted = leads
        }
        let trimmed = Array(sorted.prefix(50))

        let payload: [String: Any] = [
            "leads": trimmed.map { lead -> [String: Any] in
                [
                    "id": lead.id,
                    "name": lead.name ?? lead.company ?? "Ukjent",
                    "address": lead.address ?? NSNull(),
                    "latitude": lead.latitude ?? 0,
                    "longitude": lead.longitude ?? 0,
                    "lead_status": lead.status ?? "unvisited",
                ]
            },
            "ts": Date().timeIntervalSince1970,
        ]

        do {
            try session.updateApplicationContext(payload)
            lastPush = Date()
        } catch {
            // Quietly fail — Watch får forrige snapshot ved neste push.
        }
    }
}

extension WatchSession: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let installed = session.isPaired && session.isWatchAppInstalled
        Task { @MainActor in
            self.watchAvailable = installed
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}
    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    /// Mottar quick-action fra Watch (sendt via `transferUserInfo`).
    /// Ukjente message-typer (f.eks. pondus.template.activate) videresendes
    /// til PondusWatchSync — vi kan ikke ha to WCSessionDelegates på samme
    /// WCSession.default.
    nonisolated func session(
        _ session: WCSession,
        didReceiveUserInfo userInfo: [String : Any] = [:]
    ) {
        if userInfo["type"] as? String == "lead_action",
           let leadId = userInfo["lead_id"] as? String,
           let action = userInfo["action"] as? String
        {
            Task { @MainActor in
                self.onQuickAction?(leadId, action)
            }
            return
        }
        // Route ukjente meldinger til andre håndterere.
        // Snapshotting userInfo som Sendable-dictionary for cross-actor-hop.
        let snapshot = SendableWatchPayload(dict: userInfo)
        Task { @MainActor in
            PondusWatchSync.shared.handleIncomingMessage(snapshot.dict)
        }
    }

    /// sendMessage-path (foreground). Samme routing som transferUserInfo.
    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any]
    ) {
        let snapshot = SendableWatchPayload(dict: message)
        Task { @MainActor in
            PondusWatchSync.shared.handleIncomingMessage(snapshot.dict)
        }
    }
}

/// Sendable wrapper rundt ren-verdi [String: Any]-dictionary. Vi krysser
/// aktør-grenser med primitive verdier (String/Int/Double), ikke referanser,
/// så det er trygt å markere som Sendable via en unchecked wrapper.
private struct SendableWatchPayload: @unchecked Sendable {
    let dict: [String: Any]
}

