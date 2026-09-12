import Foundation
import Network
import UIKit

/// Håndterer én innkommende paring-connection fra Creatorhub One Desk.
///
/// Flyt:
///   1. Mottar TCP-connection fra NWListener.newConnectionHandler.
///   2. Leser opp til `maxRequestLength` bytes (typisk én linje).
///   3. Parser via ``PairingProtocol.decodeRequest``.
///   4. Bytter til @MainActor og await'er bruker-bekreftelse via
///      ``PairingRequestStore``.
///   5. Skriver OK eller ERR-respons + lukker forbindelsen.
///
/// Time-out: hvis brukeren ikke svarer innen `promptTimeoutSeconds`,
/// auto-rejecter vi med "timeout". Desk kan retry.
///
/// Krasj-safety: alle feil (parse-feil, transport-feil, timeout) lukker
/// connection-en med en ERR-respons. Vi skipper aldri response — Desk
/// skal alltid vite om paringen feilet.
enum PairingConnection {
    static func handle(_ connection: NWConnection) {
        connection.start(queue: .global(qos: .userInitiated))
        receive(on: connection)
    }

    private static func receive(on connection: NWConnection) {
        connection.receive(
            minimumIncompleteLength: 1,
            maximumLength: PairingProtocol.maxRequestLength,
        ) { data, _, isComplete, error in
            if let error {
                finish(connection, with: PairingProtocol.encodeError(reason: "receive: \(error.localizedDescription)"))
                return
            }
            guard let data, !data.isEmpty else {
                if isComplete {
                    finish(connection, with: PairingProtocol.encodeError(reason: "empty"))
                }
                return
            }

            let request: PairingProtocol.PairRequest
            do {
                request = try PairingProtocol.decodeRequest(data)
            } catch {
                finish(connection, with: PairingProtocol.encodeError(reason: String(describing: error)))
                return
            }

            // Hopp til main for å snakke med UI-stater + UIDevice.
            Task { @MainActor in
                let decision = await awaitDecisionWithTimeout(for: request)
                switch decision {
                case .accept:
                    let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
                    let deskName = request.deskName.isEmpty ? "Desk" : request.deskName
                    PairedDeskStore.shared.upsert(
                        PairedDesk(
                            deskId: request.deskId,
                            deskName: deskName,
                            pairedAt: Date(),
                        ),
                    )
                    finish(connection, with: PairingProtocol.encodeOK(iPadDeviceId: deviceId))
                case .reject(let reason):
                    finish(connection, with: PairingProtocol.encodeError(reason: reason))
                }
            }
        }
    }

    /// Race bruker-bekreftelse mot en timeout. Den som svarer først
    /// vinner; vi kansellerer den andre task'en. Hvis timeout vinner,
    /// rejecter vi modalen så den lukkes på UI-siden også.
    @MainActor
    private static func awaitDecisionWithTimeout(
        for request: PairingProtocol.PairRequest,
    ) async -> PairingRequestStore.PairingDecision {
        let store = PairingRequestStore.shared
        let result = await withTaskGroup(of: PairingRequestStore.PairingDecision.self) { group in
            group.addTask { await store.await(request: request) }
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(PairingProtocol.promptTimeoutSeconds * 1_000_000_000))
                return .reject(reason: "timeout")
            }
            let first = await group.next() ?? .reject(reason: "no_decision")
            group.cancelAll()
            return first
        }
        if case .reject(let reason) = result, reason == "timeout" {
            store.reject(reason: "timeout")
        }
        return result
    }

    private static func finish(_ connection: NWConnection, with data: Data) {
        connection.send(
            content: data,
            completion: .contentProcessed { _ in
                connection.cancel()
            },
        )
    }
}
