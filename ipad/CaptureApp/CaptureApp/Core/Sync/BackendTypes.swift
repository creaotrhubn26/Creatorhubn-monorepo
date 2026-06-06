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
    /// Signed read URL for the preview, attached by
    /// ``GET /api/capture/sessions/:id/assets`` since 23d3375. Nil when
    /// the asset has been registered but no preview has been uploaded
    /// yet, or when the endpoint was hit on an older backend.
    let previewUrl: String?
    /// Optional review fields — populated on the listing endpoint so
    /// the Live Set dashboard can render star-count + pick state
    /// without a second round-trip per asset.
    let rating: Int?
    let flaggedForClient: Bool?
    let rejected: Bool?
}

struct BackendListSessionAssetsResponse: Decodable, Sendable {
    let assets: [BackendAsset]
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

// MARK: - Projects (UniversalDashboard integration, Phase 2B Lag D)

struct BackendProjectShotListSummary: Decodable, Sendable {
    let listId: String?
    let totalShots: Int
    let completedShots: Int
    let mustHaveShots: Int
    let completedMustHave: Int
}

struct BackendProjectSummary: Decodable, Sendable, Identifiable {
    let id: String
    let title: String
    let clientName: String?
    let eventDate: String?
    let location: String?
    let projectType: String?
    let status: String
    let shotListSummary: BackendProjectShotListSummary?
    let updatedAt: String?
}

struct BackendListProjectsResponse: Decodable, Sendable {
    let projects: [BackendProjectSummary]
}

struct BackendShotListItem: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let scene: String
    let description: String?
    let estimatedDuration: Int?
    let priority: String?
    let shotType: String?
    let locationName: String?
    let notes: String?
    let scouted: Bool?
    let isCompleted: Bool?
    let capturedAssetId: String?
}

struct BackendProjectDetail: Decodable, Sendable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let clientName: String?
    let eventDate: String?
    let location: String?
    let projectType: String?
    let status: String
    let shotListSummary: BackendProjectShotListSummary?
    let updatedAt: String?
    let shotList: [BackendShotListItem]
}

struct BackendCreateMinimalProjectRequest: Encodable, Sendable {
    let title: String
    let clientName: String?
    let eventDate: String?    // YYYY-MM-DD
    let location: String?
    let projectType: String?
}

struct BackendCreatedProject: Decodable, Sendable {
    let id: String
    let title: String
    let createdAt: String
}

struct BackendLinkSessionProjectRequest: Encodable, Sendable {
    let projectId: String?
}

// MARK: - Shot → asset link (Phase 2B Lag D)

/// Marks a shot in the project's shot list as captured by a specific
/// uploaded asset. Backend updates `shot_lists.shots[*].capturedAssetId`
/// and recomputes the must-have / completed counters.
struct BackendLinkShotToAssetRequest: Encodable, Sendable {
    /// Pass `null` to unlink (clears the capturedAssetId and marks the
    /// shot as not-completed again).
    let capturedAssetId: String?
}

struct BackendShotLinkResult: Decodable, Sendable {
    let success: Bool
    let data: BackendShotLinkCounters?
}

/// Phase 2B Lag D follow-up: explicit completion toggle from the iPad
/// `ShotListPanel` that doesn't need a captured asset — the photographer
/// is just manually ticking a shot done (e.g. "got the group portrait").
struct BackendSetShotCompletionRequest: Encodable, Sendable {
    let isCompleted: Bool
}

/// Phase 4: photographer-side review POST. Mirrors the backend's
/// `createReviewBody` Zod schema — every field optional so we can
/// post a comment-only reply, a heart-only ack, or a comment+heart
/// combo without needing dummy values. Backend echoes the inserted
/// review row in the response.
struct BackendCreateReviewRequest: Encodable, Sendable {
    let heart: Bool?
    let rating: Int?
    let comment: String?
}

struct BackendCreatedReview: Decodable, Sendable {
    let id: String
    let assetId: String
    let reviewerId: String
    let reviewerType: String
    let heart: Bool?
    let rating: Int?
    let comment: String?
    let createdAt: String
}

/// Phase 5.4 — server-side enhancer round-trip.
struct BackendEnhancePicksRequest: Encodable, Sendable {
    let assetIds: [String]
    let preset: String?
}

struct BackendEnhancePicksResponse: Decodable, Sendable {
    /// Map from local asset id (string-form UUID, lowercase) to the
    /// photo-enhancer job id. Used to poll status without re-listing
    /// every asset.
    let jobs: [BackendEnhancementJobMapping]
}

struct BackendEnhancementJobMapping: Decodable, Sendable {
    let assetId: String
    let jobId: String
}

struct BackendEnhancementStatusResponse: Decodable, Sendable {
    let jobs: [BackendEnhancementJobStatus]
}

struct BackendEnhancementJobStatus: Decodable, Sendable {
    let assetId: String
    let jobId: String
    /// One of: queued / running / done / failed. Anything else from
    /// the server is treated as "queued" defensively (newer status
    /// kinds don't break older iPad builds).
    let state: String
    /// Pre-signed download URL for the enhanced JPEG when state ==
    /// "done". Otherwise nil. The iPad downloads + caches locally,
    /// then attaches the path via `SessionStore.attachServerEnhancedKey`.
    let enhancedUrl: String?
}

// MARK: - Slice 4: object-removal auto-clean

/// One distraction Claude flagged in /detect-distractions. Mirrors the
/// server-side `DistractionDetection` shape from
/// backend/server/photo-enhancer-claude-vision.ts. The web UI's
/// `AutoDistractionDetector` consumes the same JSON.
struct BackendDistraction: Decodable, Sendable, Identifiable {
    let id: String
    let type: String  // flash_strobe / light_stand / cable / boom_arm / tape_clip / sensor_dust / other_distraction
    let bbox: BackendBbox
    let confidence: Double
    let description: String
}

struct BackendBbox: Decodable, Sendable {
    let x: Int
    let y: Int
    let w: Int
    let h: Int
}

struct BackendDistractionsResponse: Decodable, Sendable {
    let success: Bool
    let detections: [BackendDistraction]
    let rationale: String?
}

/// /api/photo-enhancer/inpaint response. The cleaned JPEG comes back
/// as base64 in the JSON body — same shape the web `ObjectRemovalEditor`
/// consumes.
struct BackendInpaintResponse: Decodable, Sendable {
    let success: Bool
    let imageBase64: String
    let imageMime: String?
    let strategyUsed: String?
    let executorWarnings: [String]?
}

/// Slice 6 — POST /api/capture/sessions/:sid/assets/:aid/upload-cleaned-variant.
/// Returns the deterministic R2 key the backend stamped onto the
/// captureAssets row so the iPad can confirm the round-trip succeeded.
struct BackendCleanedVariantResponse: Decodable, Sendable {
    let assetId: String
    let autoCleanedKey: String?
    let autoCleanedDetectionCount: Int
}

struct BackendShotLinkCounters: Decodable, Sendable {
    let id: String
    let totalShots: Int
    let completedShots: Int
    let mustHaveShots: Int
    let completedMustHave: Int
}

// MARK: - UniversalShowcase delivery (Phase 2B)

enum BackendDeliverFilter: String, Encodable, Sendable {
    case flagged
    case ratingAtLeast4 = "rating_at_least_4"
    case picksOr4Plus   = "picks_or_4plus"
    case allNonRejected = "all_non_rejected"
}

struct BackendDeliverToShowcaseRequest: Encodable, Sendable {
    let filter: BackendDeliverFilter
    let clientName: String
    let clientEmail: String
    let projectTitle: String?
}

struct BackendDeliverToShowcaseResponse: Decodable, Sendable {
    let galleryId: String
    let accessToken: String
    let shareUrl: String
    let uploadedImageCount: Int
    let reusedExisting: Bool
}

// MARK: - Client tokens (Deliver flow)

struct BackendCreateClientTokenRequest: Encodable, Sendable {
    let clientLabel: String?
    let pin: String?
    let ttlMinutes: Int?
}

/// Returned only at create-time — the raw token is shown to the
/// photographer once and never persisted in plaintext on the backend
/// (only the hash). Treat as secret material in the UI.
struct BackendCreatedClientToken: Decodable, Sendable {
    let id: String
    let token: String
    let clientLabel: String?
    let expiresAt: String
    let hasPin: Bool
}

struct BackendClientTokenSummary: Decodable, Sendable {
    let id: String
    let clientLabel: String?
    let createdAt: String
    let expiresAt: String
    let revokedAt: String?
    let lastUsedAt: String?
    let hasPin: Bool
}

struct BackendListClientTokensResponse: Decodable, Sendable {
    let tokens: [BackendClientTokenSummary]
}

struct BackendListSessionsResponse: Decodable, Sendable {
    let sessions: [BackendSession]
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
/// `highlightRecovery` is optional for backwards-compatibility —
/// older backend builds without the Phase 4 audit don't return it,
/// in which case we fall back to 0 (no recovery).
struct BackendSuggestedRecipe: Decodable, Sendable {
    let warmth: Double
    let skinSmooth: Double
    let shadowLift: Double
    let contrast: Double
    let saturation: Double
    let highlightRecovery: Double?
    /// Phase 7 — Evoto-parity skin freq-sep axes. Optional because
    /// older Claude Vision builds emit only `skin_smooth`. When
    /// present, `skin_smooth` is expected to be 0 (the new shape
    /// supersedes it). When absent, iPad falls back to legacy
    /// single-slider behaviour.
    let skinHighFreq: Double?
    let skinLowFreq: Double?
    /// Phase 7B — eye axes. Optional for backwards-compat with older
    /// Claude Vision builds. When the analysis suggests
    /// "subject is portrait", the prompt should set both > 0.
    let eyeSharpen: Double?
    let eyeCatchlight: Double?
    /// Phase 7C — auto-straighten + manual horizon angle (radians).
    /// Optional for backwards-compat with older Claude Vision builds.
    let autoStraighten: Bool?
    let straightenAngle: Double?
    /// Phase 7D — teeth whitening 0…1.
    let teethWhiten: Double?
    /// Phase 7E — subject-type variant ("none" / "male" / "female"
    /// / "child" / "elderly"). Optional for backwards-compat.
    let subjectType: String?
    /// Phase 7F — face↔body skin-tone unify 0…1.
    let skinUnify: Double?

    private enum CodingKeys: String, CodingKey {
        case warmth, skinSmooth, shadowLift, contrast, saturation
        case highlightRecovery = "highlight_recovery"
        case skinHighFreq = "skin_high_freq"
        case skinLowFreq = "skin_low_freq"
        case eyeSharpen = "eye_sharpen"
        case eyeCatchlight = "eye_catchlight"
        case autoStraighten = "auto_straighten"
        case straightenAngle = "straighten_angle"
        case teethWhiten = "teeth_whiten"
        case subjectType = "subject_type"
        case skinUnify = "skin_unify"
    }
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
