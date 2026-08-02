import Foundation

/// Capture-edit-policy (E4): valgt FØR økten, auto-påført når nye bilder lander.
///   • `.none`         — ingen auto-edit (dagens oppførsel).
///   • `.syncPrevious` — nytt bilde arver FORRIGE bildes recipe + eksponering
///     (Evotos «Sync with Previous»). Crop arves ikke (per-bilde).
///   • `.preset(navn)` — et fast preset auto-påføres hvert nytt bilde.
/// Persisteres per sesjon; anvendes idempotent (aldri over en manuell edit).
enum CaptureEditPolicy: Equatable, Codable, Sendable {
    case none
    case syncPrevious
    case preset(String)

    /// Kort etikett for chip/meny.
    var label: String {
        switch self {
        case .none:          return "Ingen"
        case .syncPrevious:  return "Sync: forrige"
        case .preset(let n): return "Preset: \(n)"
        }
    }
    var isActive: Bool { self != .none }
}

/// Ren, testbar policy-anvendelse: gitt policyen + de relevante edit-tilstandene,
/// hva (om noe) skal skrives for et nytt bilde. Ingen I/O — kalleren leser/skriver
/// `RedigeringEditStore`.
enum CaptureEditPolicyEngine {
    /// EditState å auto-påføre for et nytt bilde, eller nil = ikke rør.
    /// IDEMPOTENT: returnerer nil når bildet ALT har en persistert edit
    /// (`existingEdit != nil`) → en reconnect/re-registrering overskriver aldri
    /// fotografens manuelle arbeid.
    static func editToApply(
        policy: CaptureEditPolicy,
        existingEdit: RedigeringEditStore.EditState?,
        previousEdit: RedigeringEditStore.EditState?,
        presetLookup: (String) -> MagicRecipe?,
    ) -> RedigeringEditStore.EditState? {
        guard existingEdit == nil else { return nil }   // aldri klobbe manuell edit
        switch policy {
        case .none:
            return nil
        case .syncPrevious:
            guard let prev = previousEdit else { return nil }
            // Arv recipe + eksponering; crop er per-bilde og arves IKKE.
            return .init(recipe: prev.recipe, exposureEV: prev.exposureEV, crop: nil)
        case .preset(let name):
            guard let recipe = presetLookup(name) else { return nil }
            return .init(recipe: recipe, exposureEV: 0, crop: nil)
        }
    }
}

/// Per-sesjon persistering av policyen (UserDefaults) — valget skal overleve
/// app-restart og reconnect innen samme økt.
enum CaptureEditPolicyStore {
    private static func key(_ sessionId: UUID) -> String {
        "creatorhub.capture.editpolicy.\(sessionId.uuidString)"
    }

    static func load(_ sessionId: UUID) -> CaptureEditPolicy {
        guard let data = UserDefaults.standard.data(forKey: key(sessionId)),
              let policy = try? JSONDecoder().decode(CaptureEditPolicy.self, from: data)
        else { return .none }
        return policy
    }

    static func save(_ sessionId: UUID, _ policy: CaptureEditPolicy) {
        if let data = try? JSONEncoder().encode(policy) {
            UserDefaults.standard.set(data, forKey: key(sessionId))
        }
    }
}
