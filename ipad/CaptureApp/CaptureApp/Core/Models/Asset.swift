import Foundation

struct Asset: Identifiable, Hashable, Sendable, Codable {
    let id: UUID
    let sessionId: UUID
    let originalFilename: String
    let captureTime: Date

    var previewKey: String?
    var fullKey: String?
    var rawKey: String?
    /// Locally-cached preview of the enhanced-and-returned version of this
    /// asset (photo-enhancer output). Populated once the enhancement job
    /// completes; unchanged original lives on `previewKey`/`fullKey`.
    var enhancedKey: String?
    /// On-disk path to a per-asset voice memo (m4a) recorded by the
    /// photographer mid-shoot. nil = no memo. Session-local — cleared
    /// when the session's tempDir is torn down on disconnect.
    var voiceMemoKey: String?
    /// Phase 5.4 — local path to the AI-enhanced JPEG produced by the
    /// server-side photo-enhancer service after deliver. nil =
    /// enhancement not requested or still processing. Distinct from
    /// `enhancedKey` (in-app Magic preview) so the hero comparison
    /// slider can offer both alongside the camera-baked original.
    var serverEnhancedKey: String?
    var checksumSha256: String?
    var mime: String
    var sizeBytes: Int64?

    var state: AssetState
    var signals: AssetSignals

    var rating: Int
    var colorLabel: ColorLabel?
    var flaggedForClient: Bool
    var rejected: Bool

    let createdAt: Date
    var updatedAt: Date
}

enum ColorLabel: String, Sendable, Codable, CaseIterable {
    case red, orange, yellow, green, blue, purple, pink, gray
}

struct AssetSignals: Hashable, Sendable, Codable {
    var sharpness: Double?
    var eyesOpen: Bool?
    var faceCount: Int?
    var duplicateGroupId: UUID?
    /// Opaque ref to the photographer's Apple Pencil markup layer —
    /// crop hints, retouch arrows, "remove background person"-notes.
    /// Resolves to a directory under ``Documents/markups/<ref>/``
    /// holding the composited PNG plus raw PKDrawing archive.
    /// Nil when the asset has no markup yet.
    ///
    /// Stored inline on signals (JSONB) rather than a fresh column so
    /// we don't need a v4 migration just to wire Pencil review. The
    /// backend's ``AssetSignalsJson`` gains the same field — the
    /// Postgres JSONB blob happily round-trips unknown keys in the
    /// meantime.
    var markupRef: String?

    static let empty = AssetSignals()
}
