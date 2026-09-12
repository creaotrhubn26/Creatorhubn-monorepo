import Foundation
import SwiftUI

/// Holder den aktive desk-pair-requesten (om noen) så SwiftUI kan
/// observere den og vise modal. Også ansvarlig for å route brukerens
/// "godta"/"avvis"-svar tilbake til kall-stedet (PairingConnection)
/// via en async continuation.
///
/// Kun ÉN request kan være aktiv om gangen. Hvis en ny request kommer
/// inn mens en modal allerede er åpen, avvises den nye med en
/// `busy`-feilmelding så bruker ikke får stable prompts.
@MainActor
@Observable
final class PairingRequestStore {
    static let shared = PairingRequestStore()

    private(set) var activeRequest: PairingProtocol.PairRequest?

    /// Continuation som ventes på av PairingConnection. Resumes når
    /// bruker bekrefter eller avviser modal. nil mellom requests.
    private var pendingResolve: ((PairingDecision) -> Void)?

    private init() {}

    enum PairingDecision: Sendable {
        case accept
        case reject(reason: String)
    }

    /// Kalt fra PairingConnection (off-main, men dispatcher til main her).
    /// Returnerer await'et decision når bruker har svart, eller .reject
    /// hvis vi var opptatt med en annen request.
    func await(request: PairingProtocol.PairRequest) async -> PairingDecision {
        if activeRequest != nil {
            // Allerede en aktiv prompt — avvis den nye umiddelbart
            return .reject(reason: "busy")
        }
        return await withCheckedContinuation { (cont: CheckedContinuation<PairingDecision, Never>) in
            activeRequest = request
            pendingResolve = { decision in
                cont.resume(returning: decision)
            }
        }
    }

    /// Kalt fra modal når bruker trykker "Godta".
    func accept() {
        let resolve = pendingResolve
        pendingResolve = nil
        activeRequest = nil
        resolve?(.accept)
    }

    /// Kalt fra modal når bruker trykker "Avvis" eller dismissed.
    func reject(reason: String = "user_rejected") {
        let resolve = pendingResolve
        pendingResolve = nil
        activeRequest = nil
        resolve?(.reject(reason: reason))
    }
}
