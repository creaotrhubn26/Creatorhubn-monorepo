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
    /// Strøk-vannmerket: alt under denne indeksen er sendt (eller mottatt).
    private var sisteSendteStrok = 0

    /// Kollegaer som tegner i samme notat akkurat nå.
    var deltakere: [String] = []
    /// Kalles med delta-tegningen når en kollega har tegnet nye strøk.
    var onNyeStrok: ((PKDrawing, String) -> Void)?

    func koble(notatId: String, token: String, strokAntall: Int) {
        koblFra()
        self.notatId = notatId
        self.sisteSendteStrok = strokAntall
        var comp = URLComponents(string: APIClient.baseURL)
        comp?.scheme = "wss"
        comp?.path = "/ws/leadgrid-canvas"
        comp?.queryItems = [
            URLQueryItem(name: "notatId", value: notatId),
            URLQueryItem(name: "token", value: token),
        ]
        guard let url = comp?.url else { return }
        let t = URLSession.shared.webSocketTask(with: url)
        task = t
        t.resume()
        lytt()
    }

    func koblFra() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        notatId = nil
        deltakere = []
    }

    private func lytt() {
        task?.receive { [weak self] resultat in
            Task { @MainActor in
                guard let self, self.task != nil else { return }
                switch resultat {
                case .failure:
                    // Stille — polling-fallbacken tar over til neste velg().
                    self.koblFra()
                case .success(let melding):
                    if case .string(let tekst) = melding {
                        self.handter(tekst)
                    }
                    self.lytt()
                }
            }
        }
    }

    private func handter(_ tekst: String) {
        guard let data = tekst.data(using: .utf8),
              let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let type = obj["type"] as? String else { return }
        switch type {
        case "strokes":
            guard let b64 = obj["strokes"] as? String,
                  let d = Data(base64Encoded: b64),
                  let delta = try? PKDrawing(data: d),
                  !delta.strokes.isEmpty else { return }
            let fra = (obj["fra"] as? String) ?? "Kollega"
            onNyeStrok?(delta, fra)
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
}
