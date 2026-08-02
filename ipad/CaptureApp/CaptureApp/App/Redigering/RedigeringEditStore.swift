import Foundation

/// Per-asset edit state for the Redigering tab, persisted to UserDefaults so a
/// crash, app-suspend, or tab teardown never loses the photographer's in-flight
/// recipe / exposure / crop (the audit flagged the in-memory `applied`/`crops`
/// dicts as silent data loss). Same lightweight pattern as ProjectDeliverables.
enum RedigeringEditStore {
    struct EditState: Codable, Sendable, Equatable {
        /// Schema-versjon — lar oss migrere trygt hvis MagicRecipe/feltene endres,
        /// i stedet for at en decode-feil stille sletter fotografens edits. Optional
        /// så eldre lagret data (uten `version`) fortsatt dekoder (= pre-v1 → nil).
        var version: Int?
        var recipe: MagicRecipe
        var exposureEV: Double
        var crop: CGRect?

        init(recipe: MagicRecipe, exposureEV: Double, crop: CGRect?, version: Int? = 1) {
            self.version = version
            self.recipe = recipe
            self.exposureEV = exposureEV
            self.crop = crop
        }
    }

    private static func key(_ assetId: UUID) -> String {
        "creatorhub.redigering.edit.\(assetId.uuidString)"
    }

    static func load(_ assetId: UUID) -> EditState? {
        guard let data = UserDefaults.standard.data(forKey: key(assetId)) else { return nil }
        do {
            return try JSONDecoder().decode(EditState.self, from: data)
        } catch {
            // IKKE svelg feilen stille (auditen): logg + forkast korrupt/utdatert
            // state i stedet for å late som ingenting.
            NSLog("RedigeringEditStore: decode-feil for %@ — %@", assetId.uuidString, String(describing: error))
            return nil
        }
    }

    static func save(_ assetId: UUID, _ state: EditState) {
        do {
            let data = try JSONEncoder().encode(state)
            UserDefaults.standard.set(data, forKey: key(assetId))
        } catch {
            NSLog("RedigeringEditStore: encode-feil for %@ — %@", assetId.uuidString, String(describing: error))
        }
    }

    /// Rydd persistert edit-state når et asset slettes — ellers vokser
    /// UserDefaults ubegrenset over tid.
    static func remove(_ assetId: UUID) {
        UserDefaults.standard.removeObject(forKey: key(assetId))
    }

    // MARK: - Cull selections (per session)

    private static func cullKey(_ sessionId: UUID) -> String {
        "creatorhub.redigering.cull.\(sessionId.uuidString)"
    }

    /// Persisted keep-set for a cull session (asset uuid strings).
    static func loadKept(_ sessionId: UUID) -> Set<UUID>? {
        guard let arr = UserDefaults.standard.array(forKey: cullKey(sessionId)) as? [String] else { return nil }
        let ids = arr.compactMap(UUID.init(uuidString:))
        return ids.isEmpty ? nil : Set(ids)
    }

    static func saveKept(_ sessionId: UUID, _ kept: Set<UUID>) {
        UserDefaults.standard.set(kept.map(\.uuidString), forKey: cullKey(sessionId))
    }
}
