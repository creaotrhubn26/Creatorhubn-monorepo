// PhoneSession.swift
//
// WatchConnectivity-mottaker. iPhone-appen pusher leads-snapshot via
// `WCSession.updateApplicationContext([leads: ...])` — det er en
// "guaranteed eventual delivery", lavt overhead. Watch persisterer i
// UserDefaults så vi har data ved første visning før WCSession er ready.
//
// Quick-actions sendes tilbake via `sendMessage` (foreground) eller
// `transferUserInfo` (queued hvis iPhone er off) → iPhone gjør POST
// til backend.

import Foundation
import WatchConnectivity
import Combine

@MainActor
final class PhoneSession: NSObject, ObservableObject {
    static let shared = PhoneSession()

    @Published private(set) var leads: [WatchLead] = []
    @Published private(set) var lastSync: Date?
    @Published var pendingAction: (lead: WatchLead, sentAt: Date)?

    private let session: WCSession = .default
    private let storageKey = "leadgrid.watch.leads.v1"

    override init() {
        super.init()
        loadFromDisk()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        session.delegate = self
        session.activate()
    }

    /// Send quick-action til iPhone som POSTer til backend. Vi bruker
    /// `transferUserInfo` (queued hvis iPhone er offline) så ingen
    /// action går tapt selv om brukeren markerer "besøkt" mens
    /// hen er i en kjeller uten signal.
    func sendQuickAction(_ action: LeadQuickAction, for lead: WatchLead) {
        let payload: [String: Any] = [
            "type": "lead_action",
            "lead_id": lead.id,
            "action": action.rawValue,
            "ts": Date().timeIntervalSince1970,
        ]
        session.transferUserInfo(payload)
        pendingAction = (lead, Date())
    }

    /// Signaliser til iPhone at brukeren valgte en Pondus-mal på Watch.
    /// iPhone-siden switcher Leadbook > Pondus + speiler valget.
    /// Bruker `sendMessage` (foreground) hvis iPhone er reachable —
    /// da får brukeren umiddelbar respons om hen løfter iPhone-en.
    /// Ellers `transferUserInfo` (queued) så vi ikke mister eventet.
    func sendPondusActivate(templateId: String) {
        let payload: [String: Any] = [
            "type": WatchPondusMessageType.templateActivate,
            "templateId": templateId,
            "ts": Date().timeIntervalSince1970,
        ]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
                // Fallback til queued transfer hvis sendMessage feiler.
                self.session.transferUserInfo(payload)
            })
        } else {
            session.transferUserInfo(payload)
        }
    }

    private func loadFromDisk() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([WatchLead].self, from: data)
        else { return }
        leads = decoded
    }

    private func saveToDisk() {
        guard let data = try? JSONEncoder().encode(leads) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}

extension PhoneSession: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        // Bare logging — vi mottar data via applicationContext-callback.
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        let raw = applicationContext["leads"] as? [[String: Any]] ?? []
        let decoded: [WatchLead] = raw.compactMap { dict in
            guard let id = dict["id"] as? String,
                  let name = dict["name"] as? String,
                  let lat = dict["latitude"] as? Double,
                  let lng = dict["longitude"] as? Double
            else { return nil }
            return WatchLead(
                id: id,
                name: name,
                address: dict["address"] as? String,
                latitude: lat,
                longitude: lng,
                leadStatus: dict["lead_status"] as? String ?? "unvisited"
            )
        }
        Task { @MainActor in
            self.leads = decoded
            self.lastSync = Date()
            self.saveToDisk()
        }
    }

    /// Mottar transferUserInfo-payloads fra iPhone. Bruker vi denne
    /// mekanismen for pondus-templates siden det er bakgrunn-tolerant
    /// og kan levere selv om Watch var av da iPhone pushet.
    nonisolated func session(
        _ session: WCSession,
        didReceiveUserInfo userInfo: [String: Any] = [:]
    ) {
        handleIncomingPayload(userInfo)
    }

    /// Mottar sendMessage-payloads (foreground, raskest, ingen svar).
    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any]
    ) {
        handleIncomingPayload(message)
    }

    /// Felles dispatcher for både transferUserInfo + sendMessage payloads.
    nonisolated private func handleIncomingPayload(_ payload: [String: Any]) {
        guard let type = payload["type"] as? String else { return }
        switch type {
        case WatchPondusMessageType.templatesSync:
            let raw = payload["templates"] as? [[String: Any]] ?? []
            guard let data = try? JSONSerialization.data(withJSONObject: raw, options: []),
                  let decoded = try? JSONDecoder().decode([WatchPondusTemplate].self, from: data)
            else { return }
            Task { @MainActor in
                WatchPondusStore.shared.apply(decoded)
            }
        default:
            break
        }
    }
}
