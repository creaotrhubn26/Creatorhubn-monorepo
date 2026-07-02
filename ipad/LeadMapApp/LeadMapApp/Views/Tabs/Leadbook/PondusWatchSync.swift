// PondusWatchSync.swift
//
// iPhone-side bro som pusher Pondus-templates til Apple Watch, og lytter
// på tilbake-events når brukeren aktiverer en mal fra Watch.
//
// Design-valg:
//   - Payload: transferUserInfo (bakgrunn-tolerant, queued hvis Watch er
//     av). Vi trimmer til topp 8 templates + kutter prompt til 120 tegn
//     for å holde payload godt under 65 KB.
//   - Sub-observing av PondusStore: en enkel observer-shim tar snapshot
//     av `store.templates` og pusher når det endres. Kalt fra
//     `PondusStore.load()`-completion (se hook nederst i denne filen).
//
// NB: Vi deler ikke WCSessionDelegate med `WatchSession.swift`. Sistnevnte
// eier lead-quick-actions og har allerede `session.delegate = self`. Vi
// ville ellers klobbet den. Derfor lager vi INGEN egen WCSessionDelegate her
// og hooker isteden inn i eksisterende delegat via NotificationCenter (se
// WatchSession.swift → didReceiveMessage/didReceiveUserInfo).

import Foundation
import WatchConnectivity

// MARK: - Message-type-konstanter
//
// Duplisert fra `LeadgridWatchApp/Core/WatchPondusModel.swift` — iPad-
// hovedtarget kompilerer ikke Watch-target-koden, så vi må ha egne
// konstanter her. Hold dem synkronisert manuelt.

private enum PondusWatchMessageType {
    static let templatesSync = "pondus.templates.sync"
    static let templateActivate = "pondus.template.activate"
}

// MARK: - NotificationCenter events

extension Notification.Name {
    /// Watch signaliserte at brukeren valgte pondus-mal med id X.
    /// userInfo: ["templateId": String]
    /// LeadbookView observerer og switcher til .pondus + setter selected.
    static let pondusActivateTemplate =
        Notification.Name("LeadMapApp.pondusActivateTemplate")
}

// MARK: - Sync helper

@MainActor
final class PondusWatchSync {
    static let shared = PondusWatchSync()

    /// Sikrer at vi ikke pusher samme templates-snapshot to ganger på rad.
    private var lastPushSignature: String?

    private init() {}

    /// Pusher templates til Watch. Trimmer til topp `maxCount` og komprimerer
    /// prompt-strenger. Kalles fra PondusStore.load() på iPhone-siden.
    func pushTemplatesToWatch(
        _ templates: [PondusTemplateDTO],
        maxCount: Int = 8
    ) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        // Watch må være paret + installert; hvis ikke, ingen jobb.
        guard session.activationState == .activated,
              session.isPaired,
              session.isWatchAppInstalled
        else { return }

        // Sorter etter score (fallende) — mest verdifulle først.
        let sorted = templates.sorted { $0.score > $1.score }
        let trimmed = Array(sorted.prefix(maxCount))

        let watchTemplates: [[String: Any]] = trimmed.map { encode($0) }

        let payload: [String: Any] = [
            "type": PondusWatchMessageType.templatesSync,
            "templates": watchTemplates,
            "ts": Date().timeIntervalSince1970,
        ]

        // Dedup: samme signatur → hopp over. Enkelt hash på id-er + scores.
        let signature = trimmed.map { "\($0.id.uuidString):\($0.score)" }.joined(separator: "|")
        if signature == lastPushSignature { return }
        lastPushSignature = signature

        session.transferUserInfo(payload)
    }

    /// Ruter innkommende Watch → iPhone-payload. WatchSession-delegaten
    /// videreformidler ukjente message-typer hit.
    func handleIncomingMessage(_ msg: [String: Any]) {
        guard let type = msg["type"] as? String else { return }
        switch type {
        case PondusWatchMessageType.templateActivate:
            guard let id = msg["templateId"] as? String else { return }
            NotificationCenter.default.post(
                name: .pondusActivateTemplate,
                object: nil,
                userInfo: ["templateId": id]
            )
        default:
            break
        }
    }

    // MARK: - Encoding

    private func encode(_ dto: PondusTemplateDTO) -> [String: Any] {
        // Trim prompt-strenger for å holde payload liten. Watch skjerm
        // klarer likevel bare ~2-3 linjer per steg.
        let steps: [[String: Any]] = dto.orderedSteps.map { step -> [String: Any] in
            [
                "id": step.id,
                "title": step.title,
                "prompt": String((step.prompt ?? "").prefix(140)),
                "icon": step.icon ?? "",
                "order": step.order,
            ]
        }

        // Per-akse tall fra backend (mig 0356). Fallback til overall score
        // hvis backend-analysen mangler (pre-0356 DB) eller er tom.
        // Watch-siden bruker norske akse-nøkler i sin egen struct.
        let analysis: [String: Any]
        if let a = dto.analysis, !a.isEmpty {
            analysis = [
                "score": dto.score,
                "autoritet": a.authority,
                "klarhet": a.clarity,
                "troverdighet": a.trust,
                "trygghet": a.safety,
                "fremdrift": a.momentum,
            ]
        } else {
            let approxAxis = dto.score
            analysis = [
                "score": dto.score,
                "autoritet": approxAxis,
                "klarhet": approxAxis,
                "troverdighet": approxAxis,
                "trygghet": approxAxis,
                "fremdrift": approxAxis,
            ]
        }

        return [
            "id": dto.id.uuidString.lowercased(),
            "name": dto.name,
            "kind": dto.kind,
            "category": dto.category,
            "score": dto.score,
            "steps": steps,
            "analysis": analysis,
        ]
    }
}
