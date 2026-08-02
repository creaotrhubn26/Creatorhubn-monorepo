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

    /// Kjører transkript-analyse (delt `TranscriptIntelligence` — on-device
    /// på telefonen eller backend) på et notat diktert på Apple Watch.
    /// Settes av LeadMapApp.swift ved boot. Resultatet sendes tilbake til
    /// klokka via `sendTranscriptResult`.
    var onTranscriptRequest: (@MainActor (_ leadId: String?, _ transcript: String) async -> TranscriptIntelligenceResult?)?

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
        if handleTranscriptRequest(userInfo) { return }
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
        if handleTranscriptRequest(message) { return }
        let snapshot = SendableWatchPayload(dict: message)
        Task { @MainActor in
            PondusWatchSync.shared.handleIncomingMessage(snapshot.dict)
        }
    }

    /// Håndterer «analyser dette dikterte notatet»-forespørsel fra Watch.
    /// Returnerer true hvis payloaden ble konsumert.
    nonisolated private func handleTranscriptRequest(_ payload: [String: Any]) -> Bool {
        guard payload["type"] as? String == WatchTranscriptRelayType.analyzeRequest else {
            return false
        }
        let requestId = payload["requestId"] as? String ?? ""
        let leadId = payload["lead_id"] as? String   // NSNull → nil
        let text = payload["text"] as? String ?? ""
        Task { @MainActor in
            guard let handler = self.onTranscriptRequest else { return }
            let result = await handler(leadId, text)
            self.sendTranscriptResult(requestId: requestId, result: result)
        }
        return true
    }

    /// Sender ferdig analyse tilbake til Watch.
    @MainActor
    private func sendTranscriptResult(requestId: String, result: TranscriptIntelligenceResult?) {
        guard let result else { return }
        let a = result.analysis
        let payload: [String: Any] = [
            "type": WatchTranscriptRelayType.analyzeResult,
            "requestId": requestId,
            "resolved_text": a.resolved_text,
            "action_items": a.action_items,
            "follow_up_date": a.follow_up_date ?? NSNull(),
            "sentiment": a.sentiment,
            "source": result.source.rawValue,
        ]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: { [session] _ in
                session.transferUserInfo(payload)
            })
        } else {
            session.transferUserInfo(payload)
        }
    }
}

/// Message-type-mirror av watch-sidens `WatchTranscriptMessageType`
/// (separate kildetrær → egne kopier, må holdes i sync).
enum WatchTranscriptRelayType {
    static let analyzeRequest = "transcript.analyze.request"
    static let analyzeResult = "transcript.analyze.result"
}

/// Sendable wrapper rundt ren-verdi [String: Any]-dictionary. Vi krysser
/// aktør-grenser med primitive verdier (String/Int/Double), ikke referanser,
/// så det er trygt å markere som Sendable via en unchecked wrapper.
private struct SendableWatchPayload: @unchecked Sendable {
    let dict: [String: Any]
}

