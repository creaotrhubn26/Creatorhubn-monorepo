import Foundation

// MARK: - Session

struct BackendCreateSessionRequest: Encodable, Sendable {
    let name: String
    let clientId: String?
    let startsAt: String  // ISO-8601

    init(name: String, clientId: UUID? = nil, startsAt: Date) {
        self.name = name
        self.clientId = clientId.map { $0.uuidString.lowercased() }
        self.startsAt = ISO8601DateFormatter.capture.string(from: startsAt)
    }
}

struct BackendSession: Decodable, Sendable {
    let id: String
    let name: String
    let status: String
    let ownerUserId: String
    let createdAt: String
    let startsAt: String?
    let endsAt: String?

    var uuid: UUID? { UUID(uuidString: id) }
}

// MARK: - Asset

struct BackendRegisterAssetRequest: Encodable, Sendable {
    let originalFilename: String
    let captureTime: String  // ISO-8601
    let mime: String
    let sizeBytes: Int64?

    init(originalFilename: String, captureTime: Date, mime: String, sizeBytes: Int64?) {
        self.originalFilename = originalFilename
        self.captureTime = ISO8601DateFormatter.capture.string(from: captureTime)
        self.mime = mime
        self.sizeBytes = sizeBytes
    }
}

struct BackendAsset: Decodable, Sendable {
    let id: String
    let sessionId: String
    let originalFilename: String
    let mime: String
    let sizeBytes: Int64?
    let previewKey: String?
    let fullKey: String?
    let rawKey: String?
    let state: String?
    let checksumSha256: String?
}

// MARK: - Multipart upload

enum BackendUploadKind: String, Codable, Sendable {
    case preview
    case full
    case raw
}

struct BackendUploadStartRequest: Encodable, Sendable {
    let kind: BackendUploadKind
    let sizeBytes: Int64
    let mime: String
    let preferredPartSize: Int?
}

struct BackendUploadPlan: Decodable, Sendable {
    let bucket: String
    let key: String
    let uploadId: String
    let partSize: Int64
    let partCount: Int
    let signedUrlTtlSeconds: Int
    let partUrlBatchMax: Int
}

struct BackendSignPartsRequest: Encodable, Sendable {
    let uploadId: String
    let key: String
    let partNumbers: [Int]
}

struct BackendSignedParts: Decodable, Sendable {
    struct Part: Decodable, Sendable {
        let partNumber: Int
        let url: String
    }
    let parts: [Part]
    let expiresInSeconds: Int
}

struct BackendCompletedPart: Encodable, Sendable {
    let partNumber: Int
    let etag: String
}

struct BackendUploadCompleteRequest: Encodable, Sendable {
    let kind: BackendUploadKind
    let uploadId: String
    let key: String
    let parts: [BackendCompletedPart]
    let checksumSha256: String
    let sizeBytes: Int64
}

// MARK: - Handoff

enum BackendHandoffPreset: String, Codable, Sendable {
    case auto, portrait, wedding, landscape, product, studio
}

/// Mirrors the discriminated union on the backend:
///   { kind: "ids", assetIds: [UUID] }
///   { kind: "flagged" }
///   { kind: "rating_at_least", rating: Int }
enum BackendHandoffFilter: Encodable, Sendable {
    case ids([UUID])
    case flagged
    case ratingAtLeast(Int)

    private enum CodingKeys: String, CodingKey { case kind, assetIds, rating }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .ids(ids):
            try container.encode("ids", forKey: .kind)
            try container.encode(ids.map { $0.uuidString.lowercased() }, forKey: .assetIds)
        case .flagged:
            try container.encode("flagged", forKey: .kind)
        case let .ratingAtLeast(rating):
            try container.encode("rating_at_least", forKey: .kind)
            try container.encode(rating, forKey: .rating)
        }
    }
}

struct BackendHandoffRequest: Encodable, Sendable {
    let preset: BackendHandoffPreset?
    let filter: BackendHandoffFilter
    let preferredSource: BackendUploadKind?
}

struct BackendHandoffResult: Decodable, Sendable {
    struct Job: Decodable, Sendable {
        let assetId: String
        let jobId: String?
        let status: String
        let error: String?
    }
    let handoffId: String
    let requestedCount: Int
    let submittedCount: Int
    let jobs: [Job]
}

// MARK: - Claude Vision analyse

/// Sent to `POST /api/capture/assets/:id/analyze`. The preview JPEG is
/// shipped inline base64 so the backend doesn't need to wait for an R2
/// round-trip — keeps end-to-end latency under ~3s on a good link.
struct BackendAnalyzeRequest: Encodable, Sendable {
    let imageBase64: String
    let mime: String
}

/// Bounded subject categories — mirrors the backend `SubjectCategory`
/// union exactly. Unknown values from the wire decode as `.neutral` so
/// a server upgrade that adds a new category can't crash the iPad.
enum BackendSubjectCategory: String, Decodable, Sendable, CaseIterable {
    case portrait, aviation, vehicle, food, landscape, product, neutral

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = BackendSubjectCategory(rawValue: raw) ?? .neutral
    }
}

/// Mirrors `MagicRecipe` on the iPad and the backend
/// `MagicRecipe` interface in capture-analyze-service.ts.
struct BackendSuggestedRecipe: Decodable, Sendable {
    let warmth: Double
    let skinSmooth: Double
    let shadowLift: Double
    let contrast: Double
    let saturation: Double
}

struct BackendPhotoAnalysis: Decodable, Sendable {
    let subject: BackendSubjectCategory
    let confidence: Double
    let tonality: String
    let suggestedRecipe: BackendSuggestedRecipe
    let qualityNotes: [String]
    let captionSuggestion: String

    private enum CodingKeys: String, CodingKey {
        case subject, confidence, tonality
        case suggestedRecipe = "suggested_recipe"
        case qualityNotes = "quality_notes"
        case captionSuggestion = "caption_suggestion"
    }
}

struct BackendAnalyzeUsage: Decodable, Sendable {
    let inputTokens: Int
    let outputTokens: Int
    let cacheCreationInputTokens: Int
    let cacheReadInputTokens: Int

    private enum CodingKeys: String, CodingKey {
        case inputTokens = "input_tokens"
        case outputTokens = "output_tokens"
        case cacheCreationInputTokens = "cache_creation_input_tokens"
        case cacheReadInputTokens = "cache_read_input_tokens"
    }
}

struct BackendAnalyzeResponse: Decodable, Sendable {
    let analysis: BackendPhotoAnalysis
    let usage: BackendAnalyzeUsage
}

// MARK: - Errors

enum BackendError: Error, Sendable, Equatable {
    case unauthorized
    case notFound
    case decode(String)
    case httpStatus(Int, body: String?)
    case transport(String)
    case notConfigured
}

// MARK: - Helpers

extension ISO8601DateFormatter {
    /// Canon shoots sub-second; we need fractional-second precision for
    /// event/capture ordering on the backend event log. Formatter access
    /// is internally synchronized; exposed as `nonisolated(unsafe)` so we
    /// can use it from Sendable contexts without wrapping it in an actor.
    nonisolated(unsafe) static let capture: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}

