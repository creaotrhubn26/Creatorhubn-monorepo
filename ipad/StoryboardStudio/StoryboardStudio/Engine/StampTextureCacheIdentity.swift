import CryptoKit
import Foundation

/// Stable, content-addressed identities for stamp textures.
///
/// Swift's `Hashable` remains suitable for an in-memory dictionary, but
/// `String.hashValue` is deliberately randomized between processes. These
/// identities instead hash a canonical payload so equal generator input maps
/// to the same key on every launch.
enum StampTextureCacheIdentity {
    private struct ProductionMaskInput: Encodable {
        let schemaVersion = 1
        let preset: String
        let variant: Int
        let seed: UInt32
        let depth: ProductionStampDepth
        let styleProfileId: String
        let perspectiveSkew: Double?
        let parameters: [String: String]
        let compoundGeometry: ProductionStampCompoundGeometry?
    }

    /// Includes every persisted value currently consumed by either the atlas
    /// path or the procedural fallback. Transform-only values (position,
    /// scale, rotation and flip) are intentionally excluded because they are
    /// applied to the generated mask later by the stroke renderer.
    static func productionKey(
        preset: DabPreset,
        stamp: ProductionStampInstance
    ) throws -> String {
        let payload = ProductionMaskInput(
            preset: preset.rawValue,
            variant: stamp.variant,
            seed: stamp.seed,
            depth: stamp.depth,
            styleProfileId: stamp.styleProfileId,
            perspectiveSkew: stamp.perspectiveSkew,
            parameters: stamp.parameters,
            compoundGeometry: stamp.compoundGeometry
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return sha256Hex(try encoder.encode(payload))
    }

    /// Hashes decoded image bytes rather than the data-URL spelling, so two
    /// equivalent data URLs reuse the same texture without process-randomized
    /// `String.hashValue` behavior.
    static func customTipKey(for data: Data) -> String {
        sha256Hex(data)
    }

    private static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
