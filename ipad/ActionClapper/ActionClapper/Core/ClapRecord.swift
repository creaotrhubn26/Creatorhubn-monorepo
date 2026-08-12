import Foundation

/// Én registrert klaff — tidsstempel, timecode og full slate-metadata.
struct ClapRecord: Identifiable, Sendable {
    let id = UUID()
    let timestamp: Date
    let timecode: String
    let production: String
    let scene: String
    let roll: String
    let take: String
    let director: String
    let camera: String

    /// Kompakt oppsummering vist i bekreftelses-badgen etter klapp.
    var summary: String {
        "\(scene) · \(roll) · TAKE \(take) — \(timecode)"
    }
}
