import Foundation
import Observation
import PencilKit

/// Ekte multi-penn for delte Canvas-notater: strøk relayes over
/// WebSocket i det de tegnes (append-only-modellen gjør merging
/// konfliktfri). Polling-syklusen består som fallback for visking,
/// objekter og gjenoppkobling — kanalen her er «live-blekket».
@MainActor
@Observable
final class CanvasRealtime {
    private var task: URLSessionWebSocketTask?
    private var notatId: String?
    private var connectionID = UUID()
    /// Strøk-vannmerket: alt under denne indeksen er sendt (eller mottatt).
    private var sisteSendteStrok = 0

    /// Kollegaer som tegner i samme notat akkurat nå.
    var deltakere: [String] = []
    /// Autoritativ skrivetilgang fra Canvas-kanalen. `nil` betyr at kanalen
    /// er frakoblet/ikke har svart; REST-laget er fortsatt siste kontroll.
    private(set) var canWrite: Bool?
    /// Kalles med delta-tegningen når en kollega har tegnet nye strøk.
    var onNyeStrok: ((PKDrawing, String, String) -> Void)?
    /// Serveren revaliderer sesjonen mens socketen er åpen. En eksplisitt
    /// auth-close må derfor utløse samme re-login-flyt som en REST-401.
    var onAuthenticationRequired: (() -> Void)?

    func koble(
        notatId: String,
        token: String,
        organizationId: String,
        strokAntall: Int
    ) {
        let normalizedOrganizationId = organizationId
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedOrganizationId.isEmpty else { return }
        // A known read-only decision remains sticky while the same room
        // reconnects. The server may explicitly promote it with access=true.
        let kjentSkrivetilgang = self.notatId == notatId ? canWrite : nil
        koblFra()
        self.notatId = notatId
        self.sisteSendteStrok = strokAntall
        self.canWrite = kjentSkrivetilgang
        let nyConnectionID = UUID()
        connectionID = nyConnectionID
        var comp = URLComponents(string: APIClient.baseURL)
        let websocketScheme = comp?.scheme == "http" ? "ws" : "wss"
        comp?.scheme = websocketScheme
        comp?.path = "/ws/leadgrid-canvas"
        comp?.queryItems = [
            URLQueryItem(name: "notatId", value: notatId),
            URLQueryItem(name: "organizationId", value: normalizedOrganizationId),
        ]
        guard let url = comp?.url else { return }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(
            normalizedOrganizationId,
            forHTTPHeaderField: "X-Organization-ID")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        let t = URLSession.shared.webSocketTask(with: request)
        task = t
        t.resume()
        lytt(task: t, connectionID: nyConnectionID, notatId: notatId)
    }

    func koblFra() {
        connectionID = UUID()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        notatId = nil
        deltakere = []
        canWrite = nil
    }

    private func lytt(task lyttendeTask: URLSessionWebSocketTask,
                      connectionID lyttendeConnectionID: UUID,
                      notatId lyttendeNotatId: String) {
        lyttendeTask.receive { [weak self, weak lyttendeTask] resultat in
            Task { @MainActor in
                guard let self, let lyttendeTask,
                      self.task === lyttendeTask,
                      self.connectionID == lyttendeConnectionID,
                      self.notatId == lyttendeNotatId else { return }
                switch resultat {
                case .failure:
                    if Self.kreverNyInnlogging(
                        closeCode: lyttendeTask.closeCode,
                        closeReason: lyttendeTask.closeReason
                    ) {
                        self.onAuthenticationRequired?()
                    }
                    // Andre transportbrudd er stille: polling-fallbacken tar
                    // over til neste velg().
                    self.handterTransportbrudd(
                        task: lyttendeTask,
                        connectionID: lyttendeConnectionID,
                        notatId: lyttendeNotatId)
                    return
                case .success(let melding):
                    if case .string(let tekst) = melding {
                        self.handter(tekst, notatId: lyttendeNotatId)
                    }
                    self.lytt(task: lyttendeTask,
                               connectionID: lyttendeConnectionID,
                               notatId: lyttendeNotatId)
                }
            }
        }
    }

    /// Et transportbrudd må ikke gjøre et autoritativt `canWrite=false` om
    /// til ukjent/skrivbart. Behold rom-ID og tilgang til eksplisitt frakobling
    /// eller en ny access-melding, men invalider alle callbacks fra socketen.
    private func handterTransportbrudd(
        task bruttTask: URLSessionWebSocketTask,
        connectionID bruttConnectionID: UUID,
        notatId bruttNotatId: String
    ) {
        guard task === bruttTask,
              connectionID == bruttConnectionID,
              notatId == bruttNotatId else { return }
        connectionID = UUID()
        bruttTask.cancel(with: .goingAway, reason: nil)
        task = nil
        deltakere = []
    }

    private func handter(_ tekst: String, notatId: String) {
        guard let data = tekst.data(using: .utf8),
              let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let type = obj["type"] as? String else { return }
        switch type {
        case "access":
            if let tillatt = obj["canWrite"] as? Bool {
                canWrite = tillatt
            }
        case "error":
            let error = obj["error"] as? String
            if error == "read_only" {
                canWrite = false
            } else if ["auth_required", "session_revoked"].contains(error) {
                onAuthenticationRequired?()
            }
        case "strokes":
            guard let b64 = obj["strokes"] as? String,
                  let d = Data(base64Encoded: b64),
                  let delta = try? PKDrawing(data: d),
                  !delta.strokes.isEmpty else { return }
            let fra = (obj["fra"] as? String) ?? "Kollega"
            onNyeStrok?(delta, fra, notatId)
        case "presence:snapshot":
            let brukere = (obj["users"] as? [[String: Any]]) ?? []
            deltakere = brukere.compactMap { $0["displayName"] as? String }
        case "presence:join":
            if let navn = obj["displayName"] as? String, !deltakere.contains(navn) {
                deltakere.append(navn)
            }
        case "presence:leave":
            if let navn = obj["displayName"] as? String {
                deltakere.removeAll { $0 == navn }
            }
        default:
            break
        }
    }

    /// Send strøkene som er kommet til siden sist vannmerke.
    func sendNyeStrok(fra tegning: PKDrawing) {
        let antall = tegning.strokes.count
        guard canWrite != false else {
            sisteSendteStrok = antall
            return
        }
        guard let task else {
            sisteSendteStrok = antall
            return
        }
        // Undo/visking kan ha REDUSERT antallet — nullstill vannmerket
        // uten å sende (fjerning forsones via polling/lagring).
        guard antall > sisteSendteStrok else {
            sisteSendteStrok = antall
            return
        }
        let nye = Array(tegning.strokes[sisteSendteStrok...])
        sisteSendteStrok = antall
        let delta = PKDrawing(strokes: nye)
        let b64 = delta.dataRepresentation().base64EncodedString()
        guard b64.count <= 500_000 else { return }
        guard let data = try? JSONSerialization.data(
            withJSONObject: ["type": "strokes", "strokes": b64]),
            let tekst = String(data: data, encoding: .utf8) else { return }
        task.send(.string(tekst)) { _ in }
    }

    /// Mottatte strøk legges i tegningen av view-et — flytt vannmerket
    /// forbi dem så de ikke ekkoer tilbake til rommet.
    func registrerMottatte(antall: Int) {
        sisteSendteStrok += antall
    }

    nonisolated static func kreverNyInnlogging(
        closeCode: URLSessionWebSocketTask.CloseCode,
        closeReason: Data?
    ) -> Bool {
        guard closeCode == .policyViolation,
              let closeReason,
              let reason = String(data: closeReason, encoding: .utf8) else {
            return false
        }
        return reason == "auth_required" || reason == "session_revoked"
    }
}
