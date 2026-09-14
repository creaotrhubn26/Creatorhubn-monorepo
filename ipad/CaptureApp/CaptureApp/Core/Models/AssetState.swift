import Foundation

enum AssetState: String, Sendable, Codable, CaseIterable {
    case anticipated
    case previewPending
    case previewReady
    case fullPending
    case fullReady
    case rawPending
    case rawReady
    case syncPending
    case syncInProgress
    case syncComplete
    case verified
    case failedTransient
    case failedPermanent

    var isTerminal: Bool {
        self == .verified || self == .failedPermanent
    }

    /// Bildet er lastet opp + lagret i CreatorHub S3. Driver «Sikret»-
    /// statusen på shot-oppdaterings-kortet i teamchatten.
    var isBackedUp: Bool {
        self == .syncComplete || self == .verified
    }

    var hasPreview: Bool {
        switch self {
        case .anticipated, .previewPending:
            return false
        default:
            return true
        }
    }

    var hasFull: Bool {
        switch self {
        case .anticipated, .previewPending, .previewReady, .fullPending:
            return false
        default:
            return true
        }
    }
}
