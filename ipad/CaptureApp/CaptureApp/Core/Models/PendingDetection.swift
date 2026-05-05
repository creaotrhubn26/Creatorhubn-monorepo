import Foundation

/// Slice 7 — one stray-equipment detection waiting on photographer review.
/// Mirrors `BackendDistraction` shape so the iPad doesn't have to translate
/// between server and on-device types — the `id` here is whatever id the
/// backend stamped, the `bbox` is image-pixel coordinates against the
/// asset's preview JPEG.
struct PendingDetection: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let type: String
    let bbox: PendingBbox
    let confidence: Double
    let description: String
}

struct PendingBbox: Codable, Hashable, Sendable {
    let x: Int
    let y: Int
    let w: Int
    let h: Int
}

/// Wrapper that round-trips through GRDB as a single JSON column. We
/// can't conform `[PendingDetection]?` directly to DatabaseValueConvert-
/// ible (Optional + Array of foreign type), so we box into a struct and
/// serialise that. AssetSignals follows the same pattern.
struct PendingDetectionsList: Codable, Hashable, Sendable {
    var detections: [PendingDetection]

    static let empty = PendingDetectionsList(detections: [])

    var isEmpty: Bool { detections.isEmpty }
    var count: Int { detections.count }
}
