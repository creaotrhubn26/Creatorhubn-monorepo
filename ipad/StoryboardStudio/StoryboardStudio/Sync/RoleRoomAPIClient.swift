import CoreFoundation
import Foundation
import UIKit
import CryptoKit

// Fase 2: sync mot The Role Room. Bruker NØYAKTIG samme HTTP-flate som
// web-klienten (manuscriptService/settingsService):
//   GET  /api/auth/user                                  → valider token + userId
//   GET  /api/casting/projects                           → prosjektliste
//   GET  /api/casting/manuscripts?projectId=…            → manus per prosjekt
//   GET  /api/casting/manuscripts/:manuscriptId/scenes → scener m/ storyboardFrames
//   POST /api/casting/scenes { …scene }               → upsert på scene.id
//   (settings-namespacet er kun web-klientens offline-cache — ikke sannheten)
//
// Scenene holdes som RÅ JSON ([String: Any]) internt i actoren så ukjente
// felter bevares tapsfritt ved skriving — UI får kun Sendable summaries.

struct ProjectSummary: Identifiable, Sendable, Equatable {
    let id: String
    let name: String
}

struct ManuscriptSummary: Identifiable, Sendable, Equatable {
    let id: String
    let title: String
    let storyboardTiming: StoryboardTiming

    init(
        id: String,
        title: String,
        storyboardTiming: StoryboardTiming = .legacyDefault
    ) {
        self.id = id
        self.title = title
        self.storyboardTiming = storyboardTiming
    }
}

struct StoryboardScenarioZoneSummary: Identifiable, Sendable, Equatable {
    let id: String
    let label: String
}

typealias StoryboardScenarioOptionSummary = StoryboardScenarioZoneSummary

struct StoryboardScenarioSubdomainSummary: Identifiable, Sendable, Equatable {
    let id: String
    let label: String
    let zones: [StoryboardScenarioZoneSummary]
    let roles: [StoryboardScenarioOptionSummary]
    let propTypes: [StoryboardScenarioOptionSummary]
    let actions: [StoryboardScenarioOptionSummary]
    let states: [StoryboardScenarioOptionSummary]
    let continuityLocks: [StoryboardScenarioOptionSummary]
}

struct StoryboardScenarioFamilySummary: Identifiable, Sendable, Equatable {
    let id: String
    let label: String
    let primaryStyleAnchor: String
    let variants: [StoryboardScenarioOptionSummary]
}

struct StoryboardScenarioPackSummary: Identifiable, Sendable, Equatable {
    let id: String
    let version: String
    let label: String
    let domain: String
    let description: String
    let subdomains: [StoryboardScenarioSubdomainSummary]
    let families: [StoryboardScenarioFamilySummary]
}

struct StoryboardAIModelSummary: Identifiable, Sendable, Equatable {
    let id: String
    let label: String
    let provider: String
    let modality: String
    let estimatedCostUsd: Double
    let configured: Bool
    let tier: String
    let recommended: Bool
}

struct StoryboardPromptConstraintSummary: Identifiable, Sendable, Equatable {
    let id: String
    let text: String
    let source: String
    let locked: Bool
}

struct StoryboardPromptModuleSummary: Identifiable, Sendable, Equatable {
    let id: String
    let label: String
    let constraints: [StoryboardPromptConstraintSummary]
}

struct StoryboardPromptIssueSummary: Identifiable, Sendable, Equatable {
    let id: String
    let severity: String
    let message: String
}

struct StoryboardPromptCompilationSummary: Sendable, Equatable {
    let compiledPrompt: String
    let modules: [StoryboardPromptModuleSummary]
    let issues: [StoryboardPromptIssueSummary]
    let valid: Bool
    let modelLabel: String
    let modelProvider: String
    let inheritedConstraintCount: Int
    let lockedProperties: [String]
    let styleLabel: String
    let scenarioLabel: String?
}

struct StoryboardAIJobSummary: Sendable, Equatable {
    let jobId: String
    let status: String
    let estimatedCostUsd: Double?
    let outputURL: String?
    let error: String?
    /// Server-authoritative result of the submit-time source/framing CAS.
    /// Nil is deliberately treated as unverified by native callers.
    let sourceCurrent: Bool?
}

/// A completed video is displayable only after the server's transactional
/// source/framing comparison adopted it. Missing legacy metadata fails closed.
enum StoryboardAIVideoCompletionPolicy {
    static func serverAdopted(_ summary: StoryboardAIJobSummary) -> Bool {
        summary.status == "completed" && summary.sourceCurrent == true
    }
}

struct StoryboardAIVideoRefreshIdentity: Sendable, Equatable {
    let sceneId: String
    let frameId: String
    let storyboardId: String
    let jobId: String
}

/// Pure guard for applying a refreshed signed URL to the in-memory snapshot.
/// Persistence remains server-owned; every identity component and the live
/// source policy must still match after the reload.
enum StoryboardAIVideoRefreshPolicy {
    static func canApply(
        _ candidate: StoryboardAIVideoRefreshIdentity,
        sceneId: String,
        frameId: String,
        storyboardId: String?,
        jobId: String?,
        sourceIdentityMatches: Bool
    ) -> Bool {
        sourceIdentityMatches
            && candidate.sceneId == sceneId
            && candidate.frameId == frameId
            && candidate.storyboardId == storyboardId
            && candidate.jobId == jobId
    }
}

struct StoryboardAnimationPreflightSummary: Identifiable, Sendable, Equatable {
    var id: String {
        "\(bindingFingerprint)-\(compilationFingerprint)"
    }
    let model: String
    let provider: String
    let duration: Int
    let estimatedCostUsd: Double
    let providerCredits: Double?
    let sourceFingerprint: String
    let bindingFingerprint: String
    let compilationFingerprint: String
}

struct StoryboardAIImageVersionSummary: Identifiable, Sendable, Equatable {
    let id: String
    let storyboardId: String
    let frameId: String?
    let stage: String
    let status: String
    let parentVersionId: String?
    let sourceFingerprint: String
    let compilationFingerprint: String?
    let imageData: String
    let width: Int?
    let height: Int?
    let model: String?
    let quality: String?
    let createdAt: String
    let approvedAt: String?
    let framingFingerprint: String?
    let sourceRevision: Int?
    /// Atmosphere candidates capture the Color overlay identity they used.
    /// Atmosphere-overlay edits do not invalidate that approved/generated
    /// base; a Color edit does.
    let paintoverColorRevision: Int?
    let paintoverColorFingerprint: String?

    var isApproved: Bool { status == "approved" }
    var aspectRatio: Double? {
        guard let width, let height, width > 0, height > 0 else { return nil }
        return Double(width) / Double(height)
    }
}

struct StoryboardAIImageStageResult: Sendable, Equatable {
    let version: StoryboardAIImageVersionSummary
    let prompt: StoryboardPromptCompilationSummary?
    let estimatedCostUsd: Double?
}

/// The versions and the storyboard row revision must be read in one response.
/// A version-local revision alone cannot prove that it still belongs to the
/// current Pencil/framing source after another client has edited the shot.
struct StoryboardAIImageVersionListSummary: Sendable, Equatable {
    let versions: [StoryboardAIImageVersionSummary]
    let currentSourceRevision: Int?
    /// Stable token for Pencil/layer/framing changes. Unlike the frame OCC
    /// timestamp, review comments and AI approval do not advance this value.
    let sourceUpdatedAt: String?
}

struct StoryboardAIImageApprovalSummary: Sendable, Equatable {
    let version: StoryboardAIImageVersionSummary
    let currentSourceRevision: Int?
    let adoptedFrameUpdatedAt: String?
    let sourceUpdatedAt: String?
}

struct StoryboardEnsureSummary: Sendable, Equatable {
    let id: String
    let currentSourceRevision: Int?
    let compatFrameUpdatedAt: String?
    let sourceUpdatedAt: String?
}

struct ReviewComment: Identifiable, Sendable {
    let id: String
    let role: String     // Director / DP / Producer / Editor / Artist
    let author: String
    let text: String
    let at: String       // ISO
    // Pin på bildet (normalisert 0–1) — mockupens nummererte markører.
    let x: Double?
    let y: Double?
    // Tråder + reaksjoner
    let parentId: String?
    let likes: Int?
    // Pin-lederlinje: valgfritt målpunkt (normalisert) linjen peker på
    let targetX: Double?
    let targetY: Double?
}

struct FrameSummary: Identifiable, Sendable {
    let id: String
    let shotNumber: String
    let detail: String
    var strokesJSON: String?
    // Intensjonslaget (native Board) — samme felter som web-Inspector
    let description: String
    let notes: String?
    var shotType: String?
    var lensMm: Int?
    var movement: String?
    var durationSec: Double
    /// Canonical rational duration. durationSec remains a compatibility/UI
    /// projection while old projects and clients are rolled forward.
    var shotDuration: MediaTime? = nil
    /// Server-owned optimistic-concurrency revision for duration mutations.
    /// Native never fabricates or increments this value locally.
    var durationRevision: Int? = nil
    /// Project clock inherited from the owning manuscript. This is repeated
    /// on the lightweight frame summary because hub/review/animatic surfaces
    /// can receive frames without holding the manuscript object themselves.
    var storyboardTiming: StoryboardTiming = .legacyDefault
    var transition: String?
    var focusDepth: String?
    var timeOfDay: String?
    var weather: String?
    var beatTag: String?
    var tags: [String]
    let thumbnailDataURL: String?
    // drawingData.width/height — koordinatrommet strøkene er lagret i.
    let drawingWidth: Double
    let drawingHeight: Double
    // Review (web-paritet): planned / in_review / needs_work / done + kommentarer
    let frameStatus: String?
    let comments: [ReviewComment]
    // Konfliktdeteksjon (samme-frame-merge): serverens updatedAt ved lasting
    var updatedAt: String?
    // Stabil AI-kilde-CAS. Kommentarer, review og approval kan endre updatedAt
    // uten å endre Pencil/layers/framing, og skal derfor ikke invalidere dette.
    var sourceUpdatedAt: String? = nil
    // Referanse-underlag (kun visning i canvas — aldri i eksport)
    let underlayDataURL: String?
    let underlayOpacity: Double?
    // Perspektiv-hjelpelinjer (persistert per frame; kun visning)
    let perspectiveMode: Int?
    let vanishingPoints: [[Double]]?
    // Voiceover (m4a base64) — synkes så animatic-lyd følger prosjektet
    let voiceoverDataURL: String?
    // Bilde-frame (importert/AI): statisk bildeinnhold som VISES og
    // EKSPORTERES (i motsetning til underlag). dataURL støttes native.
    let imageUrl: String?
    var imageSource: String? = nil
    // Review-flaten: prioritet/frist/godkjenning
    let reviewPriority: String?
    let reviewDueAt: String?
    let reviewApprovedBy: String?
    let reviewApprovedAt: String?
    let reviewStarred: Bool?
    let reviewAssignee: String?
    let reviewColorLabel: String?
    let reviewSnoozedUntil: String?
    // Produksjonsdetaljer (mockup-paritet) — defaults så eksisterende
    // init-kall ikke må endres.
    var setLocation: String? = nil
    var stageUnit: String? = nil
    var reviewFollowers: [String]? = nil
    // Versjonert scenario-kontekst for Prompt Engine. Feltene ligger på
    // framen, ikke på stampen, slik at alle modell-adaptere arver samme miljø.
    var scenarioPackId: String? = nil
    var scenarioPackVersion: String? = nil
    var scenarioSubdomainId: String? = nil
    var scenarioZoneId: String? = nil
    var scenarioRoleIds: [String] = []
    var scenarioPropTypeIds: [String] = []
    var scenarioActionIds: [String] = []
    var scenarioStateIds: [String] = []
    var scenarioContinuityLockIds: [String] = []
    var aiVideoURL: String? = nil
    var aiVideoJobId: String? = nil
    var aiVideoStatus: String? = nil
    var aiVideoModel: String? = nil
    var aiVideoSourceFramingFingerprint: String? = nil
    var aiVideoSourceRevision: Int? = nil
    var aiVideoSourceUpdatedAt: String? = nil
    var aiVideoSourceFrameUpdatedAt: String? = nil
    var aiVideoSourceBaseVersionId: String? = nil
    var aiVideoSourceStage: String? = nil
    var aiVideoSourceColorRevision: Int? = nil
    var aiVideoSourceAtmosphereRevision: Int? = nil
    var aiVideoSourceColorFingerprint: String? = nil
    var aiVideoSourceAtmosphereFingerprint: String? = nil
    var aiVideoSourceColorHasContent: Bool? = nil
    var aiVideoSourceAtmosphereHasContent: Bool? = nil
    var aiVideoSourceCompositeFingerprint: String? = nil
    var aiStoryboardId: String? = nil
    // Storyboard Document Core v2. Stored inside drawingData so the native
    // canvas and web renderer share one non-destructive layer contract.
    var layerState: BoardLayerState? = nil
    // Physical camera angle is separate from shot size. Legacy cameraAngle
    // remains a shot-size fallback; new native clients persist `angle`.
    var angle: String? = nil
    // Canonical non-destructive camera transform. It is top-level frame data,
    // deliberately separate from drawingData so autosaving strokes cannot
    // overwrite camera intent (and vice versa).
    var shotFraming: ShotFramingState? = nil
    // Durable camera motion is independent of the immutable t=0 framing.
    // A valid v1 track is renderable; malformed/future payloads remain in
    // rawScenes and are surfaced without silently becoming a static shot.
    var cameraMotionTrack: CameraMotionTrack? = nil
    var cameraMotionRevision: Int? = nil
    var cameraMotionUpdatedAt: String? = nil
    var cameraMotionFingerprint: String? = nil
    var cameraMotionBaseFramingFingerprint: String? = nil
    var cameraMotionStatus: String? = nil
    var cameraMotionReadState: FrameCameraMotionReadState = .none
    var cameraMotionRawJSON: String? = nil
    // Existing AI renders remain reviewable after reframing, but are marked
    // stale and cannot be animated until regenerated/approved.
    var aiOutputStale: Bool = false
    var aiOutputStaleReason: String? = nil
    var aiSourceFramingFingerprint: String? = nil
    /// Full authored camera transform for a viewport-bound AI raster. New
    /// versions persist this alongside the fingerprint so a later camera edit
    /// cannot accidentally reinterpret old pixels in source coordinates.
    var aiRasterPlacementFraming: ShotFramingState? = nil
    var aiColorFramingFingerprint: String? = nil
    var aiAtmosphereFramingFingerprint: String? = nil
    /// Authoritative normalized storyboard revision captured when the current
    /// approved AI raster was adopted. This is not the local Canvas revision.
    var aiSourceRevision: Int? = nil
    /// Server-owned identity for editable Color/Atmosphere overlays. Native
    /// never increments this optimistically; it changes only after a scene
    /// read or an exact frame-save acknowledgement.
    var aiPaintoverState: StoryboardPaintoverState? = nil

    var effectiveShotDuration: MediaTime {
        shotDuration
            ?? MediaTimeCoding.decodeLegacySeconds(durationSec)
            ?? (try? MediaTime(value: 2, timescale: 1))
            ?? .zero
    }

    var renderableCameraMotionTrack: CameraMotionTrack? {
        guard cameraMotionReadState == .valid,
              cameraMotionStatus == nil || cameraMotionStatus == "valid"
        else { return nil }
        return cameraMotionTrack
    }

    var hasBlockingCameraMotionDraft: Bool {
        switch cameraMotionReadState {
        case .invalid, .upgradeRequired:
            return true
        case .none:
            return cameraMotionStatus == "invalid"
                || cameraMotionStatus == "needsRebase"
        case .valid:
            return cameraMotionStatus == "invalid"
                || cameraMotionStatus == "needsRebase"
        }
    }
}

enum FrameCameraMotionReadState: String, Sendable, Equatable {
    case none
    case valid
    case invalid
    case upgradeRequired

    var isRenderable: Bool { self == .none || self == .valid }
    var isEditable: Bool { self == .none || self == .valid }
}

struct FrameCameraMotionWireValue: Sendable, Equatable {
    let state: FrameCameraMotionReadState
    let track: CameraMotionTrack?
    let rawJSON: String?
}

/// Strict native boundary for the versioned, bounded camera-motion envelope.
/// JSONDecoder supplies exact Codable enum/rational validation while the
/// domain normalizer enforces duration, unique IDs/times and finite poses.
enum CameraMotionTrackCoding {
    static let maximumPayloadBytes = 64 * 1024
    static let maximumPayloadDepth = 16

    static func decode(
        _ value: Any?,
        isPresent: Bool,
        shotDuration: MediaTime
    ) -> FrameCameraMotionWireValue {
        guard isPresent else {
            return FrameCameraMotionWireValue(
                state: .none, track: nil, rawJSON: nil)
        }
        guard let value, !(value is NSNull) else {
            return FrameCameraMotionWireValue(
                state: .none, track: nil, rawJSON: nil)
        }
        guard JSONSerialization.isValidJSONObject(value),
              jsonDepth(value) <= maximumPayloadDepth,
              let data = try? JSONSerialization.data(
                withJSONObject: value,
                options: [.sortedKeys, .withoutEscapingSlashes]),
              data.count <= maximumPayloadBytes,
              let rawJSON = String(data: data, encoding: .utf8)
        else {
            return FrameCameraMotionWireValue(
                state: .invalid, track: nil, rawJSON: nil)
        }

        let version = (value as? [String: Any]).flatMap {
            integer($0["version"])
        }
        guard version == CameraMotionTrack.schemaVersion else {
            return FrameCameraMotionWireValue(
                state: version == nil ? .invalid : .upgradeRequired,
                track: nil,
                rawJSON: rawJSON)
        }
        guard let decoded = try? JSONDecoder().decode(
                CameraMotionTrack.self, from: data),
              let normalized = try? decoded.normalized(for: shotDuration)
        else {
            return FrameCameraMotionWireValue(
                state: .invalid, track: nil, rawJSON: rawJSON)
        }
        return FrameCameraMotionWireValue(
            state: .valid, track: normalized, rawJSON: rawJSON)
    }

    static func object(
        _ track: CameraMotionTrack,
        shotDuration: MediaTime
    ) throws -> [String: Any] {
        let normalized = try track.normalized(for: shotDuration)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(normalized)
        guard data.count <= maximumPayloadBytes,
              let object = try JSONSerialization.jsonObject(with: data)
                as? [String: Any],
              jsonDepth(object) <= maximumPayloadDepth else {
            throw SyncError.malformed("cameraMotionTrack")
        }
        return object
    }

    static func integer(_ value: Any?) -> Int? {
        guard let number = value as? NSNumber,
              CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        let result = number.doubleValue
        guard result.isFinite, result.rounded(.towardZero) == result,
              result >= 0, result <= 9_007_199_254_740_991 else { return nil }
        return number.intValue
    }

    private static func jsonDepth(_ value: Any, level: Int = 1) -> Int {
        if level > maximumPayloadDepth { return level }
        if let dictionary = value as? [String: Any] {
            return dictionary.values.reduce(level) {
                max($0, jsonDepth($1, level: level + 1))
            }
        }
        if let array = value as? [Any] {
            return array.reduce(level) {
                max($0, jsonDepth($1, level: level + 1))
            }
        }
        return level
    }
}

enum FrameTimingWireError: Error, Sendable, Equatable {
    case invalidShotDuration
    case invalidLegacyDuration
    case durationMismatch
    case invalidDurationRevision
}

struct FrameTimingWireValue: Sendable, Equatable {
    let shotDuration: MediaTime?
    let effectiveDuration: MediaTime
    let durationRevision: Int?
}

/// Strict persisted-frame read boundary. Only an absent canonical field may
/// take the legacy/default migration path; present malformed canonical data,
/// divergent aliases and invalid OCC state stop the scene read.
enum FrameTimingWire {
    static func decode(
        _ frame: [String: Any]
    ) throws -> FrameTimingWireValue {
        let hasCanonical = frame.keys.contains("shotDuration")
        let canonical: MediaTime?
        if hasCanonical {
            guard let value = MediaTimeCoding.decode(frame["shotDuration"]),
                  value > .zero,
                  value.seconds <= 600 else {
                throw FrameTimingWireError.invalidShotDuration
            }
            canonical = value
        } else {
            canonical = nil
        }

        let legacy = try decodeLegacyAliases(frame)
        if let canonical, let legacy, canonical != legacy {
            throw FrameTimingWireError.durationMismatch
        }

        let revision: Int?
        if frame.keys.contains("durationRevision") {
            guard !(frame["durationRevision"] is Bool),
                  let number = frame["durationRevision"] as? NSNumber else {
                throw FrameTimingWireError.invalidDurationRevision
            }
            let raw = number.doubleValue
            guard raw.isFinite,
                  raw.rounded(.towardZero) == raw,
                  raw >= 0,
                  raw <= 9_007_199_254_740_991,
                  !(hasCanonical && raw < 1) else {
                throw FrameTimingWireError.invalidDurationRevision
            }
            revision = number.intValue
        } else {
            revision = nil
        }

        let effectiveDuration: MediaTime
        if let canonical { effectiveDuration = canonical }
        else if let legacy { effectiveDuration = legacy }
        else { effectiveDuration = try MediaTime(value: 2, timescale: 1) }

        return FrameTimingWireValue(
            shotDuration: canonical,
            effectiveDuration: effectiveDuration,
            durationRevision: revision)
    }

    private static func decodeLegacyAliases(
        _ frame: [String: Any]
    ) throws -> MediaTime? {
        let hasDuration = frame.keys.contains("duration")
        let hasDurationSec = frame.keys.contains("durationSec")
        let duration = hasDuration
            ? MediaTimeCoding.decodeLegacySeconds(frame["duration"])
            : nil
        let durationSec = hasDurationSec
            ? MediaTimeCoding.decodeLegacySeconds(frame["durationSec"])
            : nil
        guard (!hasDuration || isValidLegacy(duration)),
              (!hasDurationSec || isValidLegacy(durationSec)) else {
            throw FrameTimingWireError.invalidLegacyDuration
        }
        if let duration, let durationSec, duration != durationSec {
            throw FrameTimingWireError.durationMismatch
        }
        return duration ?? durationSec
    }

    private static func isValidLegacy(_ duration: MediaTime?) -> Bool {
        guard let duration else { return false }
        return duration > .zero && duration.seconds <= 600
    }
}

struct SceneSummary: Identifiable, Sendable {
    let id: String
    let heading: String
    var frames: [FrameSummary]
    // Presentasjonsmetadata (pitch-formatet): konsept-linje + footer-
    // seksjoner (JSON [{title, items[]}]) — lagres på første scene.
    let presentationConcept: String?
    let presentationFooter: String?
    // Hub-metadata (prosjektoversikten): oppgaver/notater/moodboard/sitat.
    let hubTasks: String?
    let hubNotes: String?
    let hubQuote: String?
    let hubMoodboard: String?
    let hubMapPositions: String?
    let hubMapNotes: String?
    let hubTeam: String?
    let hubInfo: String?
    let hubAssetFolders: String?
    let hubAssetColors: String?
    // Manusfelter (Script-fanen)
    let sceneNumber: Int?
    let intExt: String?
    let location: String?
    let timeOfDay: String?
    let descriptionText: String?
    let characters: [String]
    // Scene-defaults arves av shots uten egen scenario-overstyring.
    var scenarioPackId: String? = nil
    var scenarioPackVersion: String? = nil
    var scenarioSubdomainId: String? = nil
    var scenarioZoneId: String? = nil
    var scenarioRoleIds: [String] = []
    var scenarioPropTypeIds: [String] = []
    var scenarioActionIds: [String] = []
    var scenarioStateIds: [String] = []
    var scenarioContinuityLockIds: [String] = []
}

enum SyncError: LocalizedError {
    case notConfigured
    case http(Int)
    case unauthenticated
    case malformed(String)
    case serverMessage(String)
    case serverResponse(code: String, message: String)
    case generationInProgress

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Server og token er ikke satt."
        case .http(let code): return "Serverfeil (\(code))."
        case .unauthenticated: return "Token er ugyldig eller utløpt."
        case .malformed(let what): return "Uventet svar: \(what)."
        case .serverMessage(let message): return message
        case .serverResponse(_, let message): return message
        case .generationInProgress:
            return "Genereringen kjører fortsatt på serveren. Åpne shotet igjen for å hente samme kandidat — ikke start en ny betaling."
        }
    }
}

enum SceneFetchFallbackPolicy {
    /// Offline cache is a transport-recovery mechanism only. Authentication,
    /// HTTP/API-contract, malformed JSON and future-schema failures must be
    /// visible instead of being hidden behind a stale last-good snapshot.
    static func permitsOfflineFallback(for error: Error) -> Bool {
        if error is URLError { return true }
        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain
    }
}

/// Canonical request for the dedicated duration endpoint. Duration revision
/// is an OCC precondition only; the server owns the persisted successor.
struct FrameDurationPatchRequest: Sendable, Equatable {
    let manuscriptId: String
    let sceneId: String
    let frameId: String
    let shotDuration: MediaTime
    let duration: Double
    let durationSec: Double
    let expectedDurationRevision: Int

    init(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        shotDuration: MediaTime,
        expectedDurationRevision: Int
    ) throws {
        guard !manuscriptId.isEmpty, !sceneId.isEmpty, !frameId.isEmpty else {
            throw FrameDurationPatchError.invalidRequest("Mangler shot-identitet.")
        }
        guard shotDuration > .zero, shotDuration.seconds <= 600 else {
            throw FrameDurationPatchError.invalidRequest(
                "Varigheten må være større enn 0 og høyst 600 sekunder.")
        }
        guard expectedDurationRevision >= 0,
              Int64(expectedDurationRevision) <= 9_007_199_254_740_991 else {
            throw FrameDurationPatchError.invalidRequest(
                "Ugyldig varighetsrevisjon.")
        }
        self.manuscriptId = manuscriptId
        self.sceneId = sceneId
        self.frameId = frameId
        self.shotDuration = shotDuration
        let legacySeconds = shotDuration.seconds
        self.duration = legacySeconds
        self.durationSec = legacySeconds
        self.expectedDurationRevision = expectedDurationRevision
    }
}

struct FrameDurationCameraMotionSidecar: Sendable, Equatable {
    let track: CameraMotionTrack?
    let revision: Int
    let updatedAt: String?
    let fingerprint: String?
    let baseFramingFingerprint: String?
    let status: String
    let readState: FrameCameraMotionReadState
    let rawJSON: String?
}

struct FrameDurationPatchResponse: Sendable, Equatable {
    let shotDuration: MediaTime
    let durationRevision: Int
    let duration: Double
    let durationSec: Double
    let changed: Bool
    let updatedAt: String
    let sourceUpdatedAt: String?
    let cameraMotion: FrameDurationCameraMotionSidecar?
    let aiPaintoverState: StoryboardPaintoverState?
}

enum FrameDurationPatchError: LocalizedError, Sendable, Equatable {
    case invalidRequest(String)
    case durationMismatch
    case clientUpgradeRequired(
        currentShotDuration: MediaTime?, currentDurationRevision: Int?)
    case durationRevisionConflict(
        currentShotDuration: MediaTime?, currentDurationRevision: Int?)
    case unauthenticated
    case rejected(code: String, status: Int)
    case malformedResponse(String)

    var currentState: (shotDuration: MediaTime, revision: Int)? {
        switch self {
        case .clientUpgradeRequired(let duration, let revision),
             .durationRevisionConflict(let duration, let revision):
            guard let duration, let revision else { return nil }
            return (duration, revision)
        default:
            return nil
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidRequest(let message): return message
        case .durationMismatch:
            return "Varighetsformatene var ikke identiske. Ingen endring ble lagret."
        case .clientUpgradeRequired:
            return "Shotet har en nyere varighetskontrakt. Det ble lastet på nytt."
        case .durationRevisionConflict:
            return "Varigheten ble endret på en annen enhet. Serververdien er hentet."
        case .unauthenticated: return "Token er ugyldig eller utløpt."
        case .rejected(let code, let status):
            return "Varigheten ble avvist av serveren (\(status): \(code))."
        case .malformedResponse(let detail):
            return "Uventet varighetssvar: \(detail)."
        }
    }
}

/// Pure JSON boundary shared by the live actor and unit tests. It rejects a
/// partially migrated success response instead of letting rational and Double
/// values diverge silently in the UI.
enum FrameDurationPatchWire {
    static let path = "/api/casting/frames/duration"

    static func requestBody(_ request: FrameDurationPatchRequest) -> [String: Any] {
        [
            "manuscriptId": request.manuscriptId,
            "sceneId": request.sceneId,
            "frameId": request.frameId,
            "shotDuration": MediaTimeCoding.object(request.shotDuration),
            "duration": request.duration,
            "durationSec": request.durationSec,
            "expectedDurationRevision": request.expectedDurationRevision,
        ]
    }

    static func decodeResponse(
        data: Data,
        statusCode: Int
    ) throws -> FrameDurationPatchResponse {
        guard (200...299).contains(statusCode) else {
            let payload = (try? JSONSerialization.jsonObject(with: data))
                as? [String: Any]
            let code = payload?["error"] as? String ?? "http_error"
            // Optional dictionary chaining boxes the value as `Any?`; flatten
            // it before the strict MediaTime decoder so a valid conflict body
            // does not lose the server's canonical duration.
            let currentDuration = payload.flatMap {
                MediaTimeCoding.decode($0["currentShotDuration"])
            }
            let currentRevision = integer(payload?["currentDurationRevision"])
            if statusCode == 401 {
                throw FrameDurationPatchError.unauthenticated
            }
            switch code {
            case "duration_mismatch":
                throw FrameDurationPatchError.durationMismatch
            case "client_upgrade_required":
                throw FrameDurationPatchError.clientUpgradeRequired(
                    currentShotDuration: currentDuration,
                    currentDurationRevision: currentRevision)
            case "duration_revision_conflict":
                throw FrameDurationPatchError.durationRevisionConflict(
                    currentShotDuration: currentDuration,
                    currentDurationRevision: currentRevision)
            default:
                throw FrameDurationPatchError.rejected(
                    code: code, status: statusCode)
            }
        }

        guard let payload = try? JSONSerialization.jsonObject(with: data)
                as? [String: Any],
              let shotDuration = MediaTimeCoding.decode(payload["shotDuration"]),
              let durationRevision = integer(payload["durationRevision"]),
              durationRevision >= 1,
              let duration = number(payload["duration"]),
              let durationSec = number(payload["durationSec"]),
              let changed = payload["changed"] as? Bool,
              let updatedAt = payload["updatedAt"] as? String,
              let canonicalDuration = MediaTimeCoding.decodeLegacySeconds(duration),
              let canonicalDurationSec = MediaTimeCoding.decodeLegacySeconds(durationSec),
              canonicalDuration == shotDuration,
              canonicalDurationSec == shotDuration else {
            throw FrameDurationPatchError.malformedResponse(
                "kanonisk tid og legacy-sekunder er ikke konsistente")
        }
        let cameraMotion = try decodeCameraMotionSidecar(
            payload, shotDuration: shotDuration)
        return FrameDurationPatchResponse(
            shotDuration: shotDuration,
            durationRevision: durationRevision,
            duration: duration,
            durationSec: durationSec,
            changed: changed,
            updatedAt: updatedAt,
            sourceUpdatedAt: payload["sourceUpdatedAt"] as? String,
            cameraMotion: cameraMotion,
            aiPaintoverState: StoryboardPaintoverStateCoding.decode(
                payload["aiPaintoverState"]))
    }

    private static func decodeCameraMotionSidecar(
        _ payload: [String: Any],
        shotDuration: MediaTime
    ) throws -> FrameDurationCameraMotionSidecar? {
        let requiredKeys: Set<String> = [
            "cameraMotionTrack",
            "cameraMotionRevision",
            "cameraMotionUpdatedAt",
            "cameraMotionFingerprint",
            "cameraMotionBaseFramingFingerprint",
            "cameraMotionStatus",
        ]
        let presentKeys = requiredKeys.intersection(payload.keys)
        guard !presentKeys.isEmpty else { return nil }
        guard presentKeys == requiredKeys,
              let revision = CameraMotionTrackCoding.integer(
                payload["cameraMotionRevision"]),
              let status = payload["cameraMotionStatus"] as? String,
              ["valid", "needsRebase", "invalid"].contains(status) else {
            throw FrameDurationPatchError.malformedResponse(
                "motion-envelope mangler server-eid state")
        }
        let decoded = CameraMotionTrackCoding.decode(
            payload["cameraMotionTrack"],
            isPresent: true,
            shotDuration: shotDuration)
        return FrameDurationCameraMotionSidecar(
            track: decoded.track,
            revision: revision,
            updatedAt: payload["cameraMotionUpdatedAt"] as? String,
            fingerprint: payload["cameraMotionFingerprint"] as? String,
            baseFramingFingerprint:
                payload["cameraMotionBaseFramingFingerprint"] as? String,
            status: status,
            readState: decoded.state,
            rawJSON: decoded.rawJSON)
    }

    private static func number(_ value: Any?) -> Double? {
        guard let number = value as? NSNumber,
              CFGetTypeID(number) != CFBooleanGetTypeID() else {
            return nil
        }
        let result = number.doubleValue
        return result.isFinite ? result : nil
    }

    private static func integer(_ value: Any?) -> Int? {
        guard let number = value as? NSNumber,
              CFGetTypeID(number) != CFBooleanGetTypeID() else {
            return nil
        }
        let result = number.doubleValue
        guard result.isFinite, result.rounded(.towardZero) == result,
              result >= 0, result <= 9_007_199_254_740_991 else { return nil }
        return number.intValue
    }
}

struct FrameCameraMotionPatchRequest: Sendable, Equatable {
    let manuscriptId: String
    let sceneId: String
    let frameId: String
    let cameraMotionTrack: CameraMotionTrack?
    let expectedMotionRevision: Int
    let shotDuration: MediaTime

    init(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        cameraMotionTrack: CameraMotionTrack?,
        expectedMotionRevision: Int,
        shotDuration: MediaTime
    ) throws {
        guard !manuscriptId.isEmpty, !sceneId.isEmpty, !frameId.isEmpty else {
            throw FrameCameraMotionPatchError.invalidRequest(
                "Mangler shot-identitet.")
        }
        guard expectedMotionRevision >= 0,
              Int64(expectedMotionRevision) <= 9_007_199_254_740_991 else {
            throw FrameCameraMotionPatchError.invalidRequest(
                "Ugyldig kamerarevisjon.")
        }
        try CameraMotionTrack.validate(shotDuration: shotDuration)
        self.manuscriptId = manuscriptId
        self.sceneId = sceneId
        self.frameId = frameId
        self.cameraMotionTrack = try cameraMotionTrack?
            .normalized(for: shotDuration)
        self.expectedMotionRevision = expectedMotionRevision
        self.shotDuration = shotDuration
    }
}

struct FrameCameraMotionPatchResponse: Sendable, Equatable {
    let cameraMotionTrack: CameraMotionTrack?
    let cameraMotionRevision: Int
    let cameraMotionUpdatedAt: String?
    let cameraMotionFingerprint: String?
    let cameraMotionBaseFramingFingerprint: String?
    let cameraMotionStatus: String
    let changed: Bool
    let updatedAt: String
    let sourceUpdatedAt: String?
    let aiPaintoverState: StoryboardPaintoverState?
}

struct FrameCameraMotionConflictState: Sendable, Equatable {
    let cameraMotionTrack: CameraMotionTrack?
    let cameraMotionRevision: Int
    let cameraMotionStatus: String?
    let cameraMotionFingerprint: String?
    let cameraMotionBaseFramingFingerprint: String?
}

enum FrameCameraMotionPatchError: LocalizedError, Sendable, Equatable {
    case invalidRequest(String)
    case revisionConflict(FrameCameraMotionConflictState?)
    case upgradeRequired(FrameCameraMotionConflictState?)
    case unauthenticated
    case rejected(code: String, status: Int)
    case malformedResponse(String)

    var currentState: FrameCameraMotionConflictState? {
        switch self {
        case .revisionConflict(let state), .upgradeRequired(let state):
            return state
        default:
            return nil
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidRequest(let message):
            return message
        case .revisionConflict:
            return "Kamerabanen ble endret på en annen enhet. Serververdien er hentet."
        case .upgradeRequired:
            return "Shotet bruker et nyere kamerabaneformat. Oppgrader appen for å redigere."
        case .unauthenticated:
            return "Token er ugyldig eller utløpt."
        case .rejected(let code, let status):
            return "Kamerabanen ble avvist av serveren (\(status): \(code))."
        case .malformedResponse(let detail):
            return "Uventet kamerabanesvar: \(detail)."
        }
    }
}

enum FrameCameraMotionPatchWire {
    static let path = "/api/casting/frames/camera-motion"
    private static let allowedStatuses = Set([
        "valid", "needsRebase", "invalid",
    ])

    static func requestBody(
        _ request: FrameCameraMotionPatchRequest
    ) throws -> [String: Any] {
        let track: Any
        if let value = request.cameraMotionTrack {
            track = try CameraMotionTrackCoding.object(
                value, shotDuration: request.shotDuration)
        } else {
            track = NSNull()
        }
        return [
            "manuscriptId": request.manuscriptId,
            "sceneId": request.sceneId,
            "frameId": request.frameId,
            "cameraMotionTrack": track,
            "expectedMotionRevision": request.expectedMotionRevision,
        ]
    }

    static func decodeResponse(
        data: Data,
        statusCode: Int,
        shotDuration: MediaTime
    ) throws -> FrameCameraMotionPatchResponse {
        let payload = (try? JSONSerialization.jsonObject(with: data))
            as? [String: Any]
        guard (200...299).contains(statusCode) else {
            let code = payload?["error"] as? String ?? "http_error"
            if statusCode == 401 {
                throw FrameCameraMotionPatchError.unauthenticated
            }
            let state = decodeConflictState(
                payload, shotDuration: shotDuration)
            switch code {
            case "camera_motion_revision_conflict":
                throw FrameCameraMotionPatchError.revisionConflict(state)
            case "camera_motion_upgrade_required", "upgrade_required":
                throw FrameCameraMotionPatchError.upgradeRequired(state)
            default:
                throw FrameCameraMotionPatchError.rejected(
                    code: code, status: statusCode)
            }
        }

        guard let payload,
              payload.keys.contains("cameraMotionTrack"),
              let revision = CameraMotionTrackCoding.integer(
                payload["cameraMotionRevision"]),
              let status = payload["cameraMotionStatus"] as? String,
              allowedStatuses.contains(status),
              let changed = payload["changed"] as? Bool,
              let updatedAt = payload["updatedAt"] as? String else {
            throw FrameCameraMotionPatchError.malformedResponse(
                "mangler server-eid motion-state")
        }
        let decoded = CameraMotionTrackCoding.decode(
            payload["cameraMotionTrack"],
            isPresent: true,
            shotDuration: shotDuration)
        guard decoded.state == .none || decoded.state == .valid else {
            throw FrameCameraMotionPatchError.malformedResponse(
                "serveren returnerte en ugyldig v1-track")
        }
        return FrameCameraMotionPatchResponse(
            cameraMotionTrack: decoded.track,
            cameraMotionRevision: revision,
            cameraMotionUpdatedAt:
                payload["cameraMotionUpdatedAt"] as? String,
            cameraMotionFingerprint:
                payload["cameraMotionFingerprint"] as? String,
            cameraMotionBaseFramingFingerprint:
                payload["cameraMotionBaseFramingFingerprint"] as? String,
            cameraMotionStatus: status,
            changed: changed,
            updatedAt: updatedAt,
            sourceUpdatedAt: payload["sourceUpdatedAt"] as? String,
            aiPaintoverState: StoryboardPaintoverStateCoding.decode(
                payload["aiPaintoverState"]))
    }

    private static func decodeConflictState(
        _ payload: [String: Any]?,
        shotDuration: MediaTime
    ) -> FrameCameraMotionConflictState? {
        guard let payload,
              let revision = CameraMotionTrackCoding.integer(
                payload["currentCameraMotionRevision"]) else { return nil }
        let decoded = CameraMotionTrackCoding.decode(
            payload["currentCameraMotionTrack"],
            isPresent: payload.keys.contains("currentCameraMotionTrack"),
            shotDuration: shotDuration)
        guard decoded.state == .none || decoded.state == .valid else {
            return FrameCameraMotionConflictState(
                cameraMotionTrack: nil,
                cameraMotionRevision: revision,
                cameraMotionStatus: payload["currentCameraMotionStatus"]
                    as? String,
                cameraMotionFingerprint:
                    payload["currentCameraMotionFingerprint"] as? String,
                cameraMotionBaseFramingFingerprint:
                    payload["currentCameraMotionBaseFramingFingerprint"]
                        as? String)
        }
        return FrameCameraMotionConflictState(
            cameraMotionTrack: decoded.track,
            cameraMotionRevision: revision,
            cameraMotionStatus:
                payload["currentCameraMotionStatus"] as? String,
            cameraMotionFingerprint:
                payload["currentCameraMotionFingerprint"] as? String,
            cameraMotionBaseFramingFingerprint:
                payload["currentCameraMotionBaseFramingFingerprint"] as? String)
    }
}

// Konflikt-merge (samme frame redigert fra to enheter): union på stroke-id.
// Serverens strøk beholdes i sin rekkefølge; våre nye appendes. Tegning er
// append-dominert, så union taper aldri data (sletting på vår side i
// konflikt-tilfellet overlever ikke — akseptert trade-off).
enum StrokeMerge {
    private static func list(_ json: String) -> [[String: Any]]? {
        guard let data = json.data(using: .utf8) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]]
    }

    private static func same(_ lhs: [String: Any], _ rhs: [String: Any]) -> Bool {
        guard let left = try? JSONSerialization.data(withJSONObject: lhs, options: [.sortedKeys]),
              let right = try? JSONSerialization.data(withJSONObject: rhs, options: [.sortedKeys])
        else { return false }
        return left == right
    }

    /// Three-way merge with deletion tombstones. Additions from both clients
    /// survive; a deletion made from either client is never resurrected by a
    /// stale snapshot; server-only changes win unless the same stroke was
    /// deliberately changed locally after the shared base.
    static func threeWay(serverJSON: String, baseJSON: String,
                         oursJSON: String) -> String? {
        guard let serverList = list(serverJSON), let baseList = list(baseJSON),
              let ourList = list(oursJSON) else { return nil }
        let server = Dictionary(uniqueKeysWithValues: serverList.compactMap { stroke in
            (stroke["id"] as? String).map { id in (id, stroke) }
        })
        let base = Dictionary(uniqueKeysWithValues: baseList.compactMap { stroke in
            (stroke["id"] as? String).map { id in (id, stroke) }
        })
        let ours = Dictionary(uniqueKeysWithValues: ourList.compactMap { stroke in
            (stroke["id"] as? String).map { id in (id, stroke) }
        })
        let baseIDs = Set(base.keys)
        let deleted = baseIDs.subtracting(ours.keys)
            .union(baseIDs.subtracting(server.keys))
        var result: [[String: Any]] = []
        var emitted = Set<String>()

        for serverStroke in serverList {
            guard let id = serverStroke["id"] as? String,
                  !deleted.contains(id), emitted.insert(id).inserted else { continue }
            if let oursStroke = ours[id], let baseStroke = base[id],
               !same(oursStroke, baseStroke) {
                result.append(oursStroke)
            } else {
                result.append(serverStroke)
            }
        }
        // Local additions and local edits missing server-side retain the
        // artist's ordering after the server's established order.
        for ourStroke in ourList {
            guard let id = ourStroke["id"] as? String,
                  !deleted.contains(id), emitted.insert(id).inserted else { continue }
            result.append(ourStroke)
        }
        guard let data = try? JSONSerialization.data(withJSONObject: result) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func union(serverJSON: String, oursJSON: String) -> String? {
        guard let serverData = serverJSON.data(using: .utf8),
              let ourData = oursJSON.data(using: .utf8),
              let serverList = (try? JSONSerialization.jsonObject(with: serverData)) as? [[String: Any]],
              let ourList = (try? JSONSerialization.jsonObject(with: ourData)) as? [[String: Any]] else {
            return nil
        }
        let serverIds = Set(serverList.compactMap { $0["id"] as? String })
        let newOnes = ourList.filter { stroke in
            guard let id = stroke["id"] as? String else { return false }
            return !serverIds.contains(id)
        }
        guard let mergedData = try? JSONSerialization.data(withJSONObject: serverList + newOnes) else {
            return nil
        }
        return String(data: mergedData, encoding: .utf8)
    }
}

actor RoleRoomAPIClient {
    static let shared = RoleRoomAPIClient()
    static let scenesNamespace = "virtualStudio_manuscriptScenes"

    private var baseURL: URL?
    private var token: String?
    private var userId: String?
    private var userName: String?
    // Rå sceneliste per manuscriptId — bevares tapsfritt for PUT.
    private var rawScenes: [String: [[String: Any]]] = [:]
    // Validert prosjektklokke. Ugyldige eksplisitte verdier lagres aldri her.
    private var manuscriptTimings: [String: StoryboardTiming] = [:]

    // MARK: Konfigurasjon

    func configure(server: String, token: String) async throws -> String {
        guard let url = URL(string: server.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme?.hasPrefix("http") == true else {
            throw SyncError.notConfigured
        }
        self.baseURL = url
        self.token = token.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload = try await getJSON(path: "/api/auth/user", query: [:])
        guard let user = payload["user"] as? [String: Any],
              let id = user["id"] as? String else {
            self.token = nil
            throw SyncError.unauthenticated
        }
        self.userId = id
        let name = (user["displayName"] as? String) ?? (user["name"] as? String) ?? id
        self.userName = name
        return name
    }

    var isConfigured: Bool { baseURL != nil && token != nil && userId != nil }
    var userDisplayName: String? { userName }

    // MARK: Offline-cache (siste vellykkede svar per nøkkel — boardet skal
    // kunne åpnes uten nett; skriving synkes når nettet er tilbake)

    private static var cacheDirectory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("api-cache", isDirectory: true)
    }

    private func cacheWrite(_ object: Any, key: String) {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object) else { return }
        try? FileManager.default.createDirectory(at: Self.cacheDirectory, withIntermediateDirectories: true)
        try? data.write(to: Self.cacheDirectory.appendingPathComponent("\(key).json"))
    }

    private func cacheRead(key: String) -> Any? {
        guard let data = try? Data(contentsOf: Self.cacheDirectory.appendingPathComponent("\(key).json")) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    // MARK: Lesing

    func fetchProjects() async throws -> [ProjectSummary] {
        var projects: [[String: Any]]
        do {
            projects = try await getJSONArray(path: "/api/role-room/projects")
            // Behold eldre, eide compat-prosjekter som ennå ikke er migrert,
            // men la den kanoniske Role Room-listen være sannhetskilden.
            if let payload = try? await getJSON(path: "/api/casting/projects", query: [:]) {
                let legacy = (payload["projects"] as? [[String: Any]]) ?? []
                var known = Set(projects.compactMap { $0["id"] as? String })
                for entry in legacy {
                    guard let id = entry["id"] as? String, !known.contains(id) else { continue }
                    projects.append(entry)
                    known.insert(id)
                }
            }
            cacheWrite(projects, key: "projects")
        } catch {
            guard let cached = cacheRead(key: "projects") as? [[String: Any]] else { throw error }
            projects = cached
        }
        return projects.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            let name = (entry["name"] as? String) ?? (entry["projectName"] as? String) ?? id
            return ProjectSummary(id: id, name: name)
        }
    }

    func fetchScenarioPacks() async throws -> [StoryboardScenarioPackSummary] {
        var list: [[String: Any]]
        do {
            list = try await getJSONArray(path: "/api/role-room/storyboard-scenario-packs")
            cacheWrite(list, key: "storyboard-scenario-packs-v1")
        } catch {
            guard let cached = cacheRead(key: "storyboard-scenario-packs-v1")
                    as? [[String: Any]] else { throw error }
            list = cached
        }
        return Self.summarizeScenarioPacks(list)
    }

    func fetchStoryboardAIModels() async throws -> [StoryboardAIModelSummary] {
        let list = try await getJSONArray(path: "/api/role-room/storyboard-ai-models")
        return list.compactMap { item in
            guard let id = item["id"] as? String,
                  let label = item["label"] as? String,
                  let provider = item["provider"] as? String,
                  let modality = item["modality"] as? String else { return nil }
            return StoryboardAIModelSummary(
                id: id, label: label, provider: provider, modality: modality,
                estimatedCostUsd: (item["estimatedCostUsd"] as? NSNumber)?.doubleValue ?? 0,
                configured: item["configured"] as? Bool ?? false,
                tier: item["tier"] as? String ?? "quality",
                recommended: item["recommended"] as? Bool ?? false)
        }
    }

    /// Missing project timing is the single legacy migration path. Once the
    /// field is present, malformed and future schemas fail the whole fetch;
    /// they must never disappear through `compactMap` as if no manuscript
    /// existed.
    static func summarizeManuscripts(
        _ list: [[String: Any]]
    ) throws -> [ManuscriptSummary] {
        try list.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            let title = (entry["title"] as? String)
                ?? (entry["name"] as? String)
                ?? id
            let timing: StoryboardTiming
            if entry.keys.contains("storyboardTiming") {
                do {
                    timing = try StoryboardTimingCoding.decode(
                        entry["storyboardTiming"] as Any)
                } catch {
                    throw SyncError.malformed(
                        "storyboardTiming for manuscript \(id)")
                }
            } else {
                timing = .legacyDefault
            }
            return ManuscriptSummary(
                id: id, title: title, storyboardTiming: timing)
        }
    }

    func fetchManuscripts(projectId: String) async throws -> [ManuscriptSummary] {
        var list: [[String: Any]]
        var shouldCache = false
        do {
            // Prod kan returnere bare array ELLER objekt-innpakning — tåler begge.
            let (data, response) = try await URLSession.shared.data(
                for: request(path: "/api/casting/manuscripts", query: ["projectId": projectId]))
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200 else {
                throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
            }
            let payload = try JSONSerialization.jsonObject(with: data)
            list = (payload as? [[String: Any]])
                ?? ((payload as? [String: Any]).flatMap {
                    ($0["manuscripts"] ?? $0["data"]) as? [[String: Any]]
                })
                ?? []
            shouldCache = true
        } catch {
            guard let cached = cacheRead(key: "manuscripts-\(projectId)") as? [[String: Any]] else { throw error }
            list = cached
        }
        let summaries = try Self.summarizeManuscripts(list)
        for summary in summaries {
            manuscriptTimings[summary.id] = summary.storyboardTiming
        }
        if shouldCache { cacheWrite(list, key: "manuscripts-\(projectId)") }
        return summaries
    }

    func createManuscript(projectId: String, title: String) async throws -> ManuscriptSummary {
        let normalizedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload = try await sendJSONResponse(
            path: "/api/casting/manuscripts",
            method: "POST",
            body: [
                "id": "manuscript-\(UUID().uuidString.lowercased())",
                "projectId": projectId,
                "project_id": projectId,
                "title": normalizedTitle.isEmpty ? "Storyboard-manus" : normalizedTitle,
                "name": normalizedTitle.isEmpty ? "Storyboard-manus" : normalizedTitle,
                "status": "draft",
                "storyboardTiming": StoryboardTimingCoding.object(
                    .legacyDefault),
            ])
        guard let summary = try Self.summarizeManuscripts([payload]).first else {
            throw SyncError.malformed("opprettet manus")
        }
        manuscriptTimings[summary.id] = summary.storyboardTiming
        return summary
    }

    // ETag per manuskript (svarer serverens scenes-version): polling og
    // refresh koster 304-tomt-svar i stedet for hele scenelisten (thumbs +
    // underlag) når ingenting er endret.
    private var scenesETag: [String: String] = [:]

    /// Hent scener med If-None-Match. ETag følger svaret, men committes først
    /// etter at strict frame-timing er validert. nil = 304/uendret.
    private func fetchScenesRaw(
        manuscriptId: String
    ) async throws -> (scenes: [[String: Any]], etag: String?)? {
        var request = try request(path: "/api/casting/manuscripts/\(manuscriptId)/scenes", query: [:])
        // URLCache må ikke besvare betinget GET selv — vi styrer 304 manuelt.
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if let etag = scenesETag[manuscriptId], rawScenes[manuscriptId] != nil {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
            // Netlify-proxyen stripper If-None-Match — custom header går gjennom.
            request.setValue(etag, forHTTPHeaderField: "X-If-None-Match")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        if status == 304 { return nil }
        guard status == 200 else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        let etag = http?.value(forHTTPHeaderField: "ETag")
        let payload = try JSONSerialization.jsonObject(with: data)
        if let list = payload as? [[String: Any]] {
            return (list, etag)
        }
        if let object = payload as? [String: Any],
           let list = (object["scenes"] ?? object["data"]) as? [[String: Any]] {
            return (list, etag)
        }
        throw SyncError.malformed("scenes")
    }

    func fetchScenes(manuscriptId: String) async throws -> [SceneSummary] {
        let timing = manuscriptTimings[manuscriptId] ?? .legacyDefault
        do {
            if let fresh = try await fetchScenesRaw(manuscriptId: manuscriptId) {
                let summaries = try fresh.scenes.compactMap { scene in
                    try Self.summarize(scene: scene)
                }
                // Commit JSON, ETag and cache only after every frame passed.
                rawScenes[manuscriptId] = fresh.scenes
                if let etag = fresh.etag { scenesETag[manuscriptId] = etag }
                cacheWrite(fresh.scenes, key: "scenes-\(manuscriptId)")
                return Self.applyingStoryboardTiming(timing, to: summaries)
            }
        } catch {
            guard SceneFetchFallbackPolicy.permitsOfflineFallback(
                for: error) else { throw error }
            let fallback: [[String: Any]]
            if let current = rawScenes[manuscriptId] {
                fallback = current
            } else {
                guard let cached = cacheRead(key: "scenes-\(manuscriptId)")
                        as? [[String: Any]] else { throw error }
                fallback = cached
            }
            let summaries = try fallback.compactMap { scene in
                try Self.summarize(scene: scene)
            }
            rawScenes[manuscriptId] = fallback
            return Self.applyingStoryboardTiming(timing, to: summaries)
        }
        let summaries = try (rawScenes[manuscriptId] ?? []).compactMap {
            try Self.summarize(scene: $0)
        }
        return Self.applyingStoryboardTiming(timing, to: summaries)
    }

    /// Propagates one validated manuscript clock through value-type scene and
    /// frame summaries without mutating the raw compatibility JSON.
    static func applyingStoryboardTiming(
        _ timing: StoryboardTiming,
        to scenes: [SceneSummary]
    ) -> [SceneSummary] {
        scenes.map { sourceScene in
            var scene = sourceScene
            scene.frames = sourceScene.frames.map { sourceFrame in
                var frame = sourceFrame
                frame.storyboardTiming = timing
                return frame
            }
            return scene
        }
    }

    /// Live-polling fra boardet: har serveren en nyere sceneliste?
    /// (Billig 304 ved uendret.) true = rawScenes ble oppdatert.
    func pollScenesChanged(manuscriptId: String) async -> Bool {
        do {
            guard let fresh = try await fetchScenesRaw(
                manuscriptId: manuscriptId) else { return false }
            _ = try fresh.scenes.compactMap {
                try Self.summarize(scene: $0)
            }
            rawScenes[manuscriptId] = fresh.scenes
            if let etag = fresh.etag { scenesETag[manuscriptId] = etag }
            lastRefresh[manuscriptId] = Date()
            cacheWrite(fresh.scenes, key: "scenes-\(manuscriptId)")
            return true
        } catch { return false }
    }

    // MARK: Skriving

    /// Konfliktvern: hent fersk sceneliste rett før hver skriving så vår
    /// POST bygger på serverens nyeste versjon (frame-nivå-merge — andre
    /// enheters endringer på andre frames bevares). Feiler henting (offline)
    /// brukes cachen — bedre å skrive gammelt enn å miste tegningen.
    private var lastRefresh: [String: Date] = [:]

    private func refreshScenes(manuscriptId: String) async {
        // Throttle: autosynk-serier på samme frame trenger ikke fersk kopi
        // hver gang — 15 s-vindu balanserer konfliktvern mot trafikk.
        if let last = lastRefresh[manuscriptId], Date().timeIntervalSince(last) < 15 { return }
        if let fresh = try? await fetchScenesRaw(manuscriptId: manuscriptId),
           (try? fresh.scenes.compactMap({
               try Self.summarize(scene: $0)
           })) != nil {
            rawScenes[manuscriptId] = fresh.scenes
            if let etag = fresh.etag { scenesETag[manuscriptId] = etag }
            cacheWrite(fresh.scenes, key: "scenes-\(manuscriptId)")
        }
        // 304 teller også som fersk — serveren bekreftet at vår kopi gjelder.
        lastRefresh[manuscriptId] = Date()
    }

    /// Skriv strokes (web-JSON-STRENG — parseStoredStrokes-krav) tilbake på
    /// én frame og PUT hele scenelisten (samme granularitet som web).
    /// thumbnailDataURL settes når native har rendret en thumb (ellers
    /// nullstilles den så web regenererer).
    func saveFrameStrokes(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        strokesJSON: String,
        thumbnailDataURL: String? = nil,
        baseUpdatedAt: String? = nil,
        layerState: BoardLayerState? = nil,
        shotFraming: ShotFramingState? = nil,
        baseStrokesJSON: String? = nil,
        baseLayerState: BoardLayerState? = nil,
        baseShotFraming: ShotFramingState? = nil
    ) async throws -> (
        updatedAt: String?, merged: Bool, strokesJSON: String?,
        layerState: BoardLayerState?, shotFraming: ShotFramingState?,
        sourceRevision: Int?, sourceUpdatedAt: String?,
        paintoverState: StoryboardPaintoverState?
    ) {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId] else {
            throw SyncError.malformed("scener ikke lastet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        var found = false
        var mergedAny = false
        var persistedStrokesJSON = strokesJSON
        for sceneIndex in scenes.indices {
            guard scenes[sceneIndex]["id"] as? String == sceneId else { continue }
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            for frameIndex in frames.indices where frames[frameIndex]["id"] as? String == frameId {
                var drawingData = (frames[frameIndex]["drawingData"] as? [String: Any]) ?? [:]
                // Samme-frame-konflikt (spec: siste-vinner er datatap): har
                // serveren en NYERE versjon enn den vi bygget på, unions-
                // merges strokene på id — serverens beholdes, våre nye
                // legges til. Append-dominert tegning gjør dette trygt.
                var effectiveStrokes = strokesJSON
                var didMerge = false
                if let base = baseUpdatedAt,
                   let serverUpdated = frames[frameIndex]["updatedAt"] as? String,
                   serverUpdated != base,
                   let serverJSON = drawingData["strokes"] as? String,
                   let merged = baseStrokesJSON.flatMap({ baseJSON in
                       StrokeMerge.threeWay(serverJSON: serverJSON,
                                            baseJSON: baseJSON,
                                            oursJSON: strokesJSON)
                   }) ?? StrokeMerge.union(serverJSON: serverJSON, oursJSON: strokesJSON) {
                    effectiveStrokes = merged
                    didMerge = merged != strokesJSON
                }
                mergedAny = mergedAny || didMerge
                persistedStrokesJSON = effectiveStrokes
                drawingData["strokes"] = effectiveStrokes
                drawingData["updatedAt"] = now
                if drawingData["createdAt"] == nil { drawingData["createdAt"] = now }
                if drawingData["width"] == nil { drawingData["width"] = 1920 }
                if drawingData["height"] == nil { drawingData["height"] = 1080 }
                if let layerState, let object = BoardLayerStateCoding.object(layerState) {
                    drawingData["layerState"] = object
                }
                // Kompiler regimerker ved lagring. Originale PencilStroke-data
                // beholdes som autoritativ/redigerbar kilde; dette sidecar-feltet
                // gjør semantikken direkte tilgjengelig for Prompt Engine.
                if let decoded = try? StrokeSerialization.decodeFromWebJSON(effectiveStrokes) {
                    let width = (drawingData["width"] as? NSNumber)?.doubleValue ?? 1920
                    let height = (drawingData["height"] as? NSNumber)?.doubleValue ?? 1080
                    let payload = ProductionMarkCompiler.compile(
                        strokes: decoded, canvasWidth: width, canvasHeight: height)
                    if let data = try? JSONEncoder().encode(payload),
                       let object = try? JSONSerialization.jsonObject(with: data) {
                        drawingData["productionMarks"] = object
                    }
                }
                frames[frameIndex]["drawingData"] = drawingData
                if let shotFraming,
                   let object = ShotFramingStateCoding.object(shotFraming) {
                    frames[frameIndex]["shotFraming"] = object
                    frames[frameIndex]["shotType"] = shotFraming.shotSize
                    frames[frameIndex]["angle"] = shotFraming.angle
                    frames[frameIndex]["lensMm"] = shotFraming.lensMm
                }
                if let thumbnailDataURL {
                    frames[frameIndex]["thumbnailUrl"] = thumbnailDataURL
                } else {
                    // Web genererer thumbnail automatisk fra strokes ved
                    // visning; nullstill stale thumb så den regenereres.
                    frames[frameIndex]["thumbnailUrl"] = nil
                }
                frames[frameIndex]["updatedAt"] = now
                found = true
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        guard found else { throw SyncError.malformed("frame \(frameId) ikke funnet") }
        rawScenes[manuscriptId] = scenes

        guard let scene = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        // Per-frame PATCH (kun endrede felter — hele scenen med alle thumbs/
        // underlag POSTes ikke lenger per strøk-lagring). Legacy-fallback
        // mot eldre backend.
        if let frames = scene["storyboardFrames"] as? [[String: Any]],
           let frame = frames.first(where: { $0["id"] as? String == frameId }) {
            var drawingPatch = (frame["drawingData"] as? [String: Any]) ?? [:]
            // Review/history callers patch strokes only. Omitting this key is
            // intentional: the backend deep-merges drawingData and preserves
            // a concurrent layer sidecar owned by the drawing workspace.
            if layerState == nil { drawingPatch.removeValue(forKey: "layerState") }
            var fields: [String: Any] = ["drawingData": drawingPatch]
            fields["thumbnailUrl"] = frame["thumbnailUrl"] ?? NSNull()
            if shotFraming != nil {
                fields["shotFraming"] = frame["shotFraming"] ?? NSNull()
                fields["shotType"] = frame["shotType"] ?? NSNull()
                fields["angle"] = frame["angle"] ?? NSNull()
                fields["lensMm"] = frame["lensMm"] ?? NSNull()
            }
            if let remote = try await patchFrameRemote(
                manuscriptId: manuscriptId, sceneId: sceneId,
                frameId: frameId, fields: fields,
                baseUpdatedAt: baseUpdatedAt,
                baseStrokesJSON: baseStrokesJSON,
                baseLayerState: baseLayerState,
                baseShotFraming: baseShotFraming) {
                let effectiveLayerState = remote.layerState ?? layerState
                let effectiveShotFraming = remote.shotFraming ?? shotFraming
                applyLocalFrameSidecars(
                    manuscriptId: manuscriptId, sceneId: sceneId,
                    frameId: frameId,
                    layerState: effectiveLayerState,
                    shotFraming: effectiveShotFraming)
                if let paintoverState = remote.paintoverState {
                    applyLocalFramePaintoverState(
                        manuscriptId: manuscriptId, sceneId: sceneId,
                        frameId: frameId, state: paintoverState)
                }
                if !remote.updatedAt.isEmpty {
                    applyLocalFrameUpdatedAt(manuscriptId: manuscriptId, sceneId: sceneId,
                                             frameId: frameId, updatedAt: remote.updatedAt)
                    return (
                        remote.updatedAt,
                        mergedAny || remote.merged,
                        remote.strokesJSON ?? persistedStrokesJSON,
                        effectiveLayerState,
                        effectiveShotFraming,
                        remote.sourceRevision,
                        remote.sourceUpdatedAt,
                        remote.paintoverState)
                }
                return (
                    now, mergedAny || remote.merged,
                    remote.strokesJSON ?? persistedStrokesJSON,
                    effectiveLayerState,
                    effectiveShotFraming,
                    remote.sourceRevision,
                    remote.sourceUpdatedAt,
                    remote.paintoverState)
            }
        }
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
        // Legacy full-scene POST does not return the server's canonical source
        // token. Fail closed for paid AI until a per-frame PATCH can
        // acknowledge the exact source snapshot.
        return (
            now, mergedAny, persistedStrokesJSON, layerState, shotFraming,
            nil, nil, nil)
    }

    /// Skriv serverens autoritative updatedAt inn i lokal rå-scene så
    /// neste konfliktsjekk sammenligner mot riktig verdi.
    private func applyLocalFrameUpdatedAt(
        manuscriptId: String, sceneId: String, frameId: String, updatedAt: String
    ) {
        guard var scenes = rawScenes[manuscriptId] else { return }
        for sceneIndex in scenes.indices where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            for frameIndex in frames.indices where frames[frameIndex]["id"] as? String == frameId {
                frames[frameIndex]["updatedAt"] = updatedAt
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        rawScenes[manuscriptId] = scenes
    }

    /// Keep the actor cache aligned with the server's three-way sidecar
    /// decision. A subsequent throttled reload must not re-send stale camera
    /// or layer state after the server preserved a concurrent remote edit.
    private func applyLocalFrameSidecars(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        layerState: BoardLayerState?,
        shotFraming: ShotFramingState?
    ) {
        guard var scenes = rawScenes[manuscriptId] else { return }
        for sceneIndex in scenes.indices where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            for frameIndex in frames.indices where frames[frameIndex]["id"] as? String == frameId {
                if let layerState,
                   let object = BoardLayerStateCoding.object(layerState) {
                    var drawingData = (frames[frameIndex]["drawingData"] as? [String: Any]) ?? [:]
                    drawingData["layerState"] = object
                    frames[frameIndex]["drawingData"] = drawingData
                }
                if let shotFraming,
                   let object = ShotFramingStateCoding.object(shotFraming) {
                    frames[frameIndex]["shotFraming"] = object
                    frames[frameIndex]["shotType"] = shotFraming.shotSize
                    frames[frameIndex]["angle"] = shotFraming.angle
                    frames[frameIndex]["lensMm"] = shotFraming.lensMm
                }
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        rawScenes[manuscriptId] = scenes
    }

    /// Cache only the exact paintover state returned by PATCH. This is not an
    /// optimistic local revision update; it keeps a later throttled read from
    /// resurrecting the pre-acknowledgement identity.
    private func applyLocalFramePaintoverState(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        state: StoryboardPaintoverState
    ) {
        guard var scenes = rawScenes[manuscriptId] else { return }
        for sceneIndex in scenes.indices where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"]
                as? [[String: Any]]) ?? []
            for frameIndex in frames.indices where frames[frameIndex]["id"] as? String == frameId {
                frames[frameIndex]["aiPaintoverState"] =
                    StoryboardPaintoverStateCoding.object(state)
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        rawScenes[manuscriptId] = scenes
    }

    private func applyLocalFrameDuration(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        response: FrameDurationPatchResponse
    ) {
        guard var scenes = rawScenes[manuscriptId] else { return }
        for sceneIndex in scenes.indices
        where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"]
                as? [[String: Any]]) ?? []
            for frameIndex in frames.indices
            where frames[frameIndex]["id"] as? String == frameId {
                frames[frameIndex]["shotDuration"] =
                    MediaTimeCoding.object(response.shotDuration)
                frames[frameIndex]["durationRevision"] =
                    response.durationRevision
                frames[frameIndex]["duration"] = response.duration
                frames[frameIndex]["durationSec"] = response.durationSec
                if !response.updatedAt.isEmpty {
                    frames[frameIndex]["updatedAt"] = response.updatedAt
                }
                if let sourceUpdatedAt = response.sourceUpdatedAt {
                    frames[frameIndex]["sourceUpdatedAt"] = sourceUpdatedAt
                }
                if let motion = response.cameraMotion {
                    switch motion.readState {
                    case .valid:
                        if let track = motion.track,
                           let object = try? CameraMotionTrackCoding.object(
                            track, shotDuration: response.shotDuration) {
                            frames[frameIndex]["cameraMotionTrack"] = object
                        } else {
                            frames[frameIndex]["cameraMotionTrack"] = NSNull()
                        }
                    case .invalid, .upgradeRequired:
                        if let rawJSON = motion.rawJSON,
                           let data = rawJSON.data(using: .utf8),
                           let object = try? JSONSerialization.jsonObject(
                            with: data) {
                            frames[frameIndex]["cameraMotionTrack"] = object
                        }
                    case .none:
                        frames[frameIndex]["cameraMotionTrack"] = NSNull()
                    }
                    frames[frameIndex]["cameraMotionRevision"] =
                        motion.revision
                    frames[frameIndex]["cameraMotionUpdatedAt"] =
                        motion.updatedAt ?? NSNull()
                    frames[frameIndex]["cameraMotionFingerprint"] =
                        motion.fingerprint ?? NSNull()
                    frames[frameIndex][
                        "cameraMotionBaseFramingFingerprint"
                    ] = motion.baseFramingFingerprint ?? NSNull()
                    frames[frameIndex]["cameraMotionStatus"] =
                        motion.status
                }
                if let state = response.aiPaintoverState {
                    frames[frameIndex]["aiPaintoverState"] =
                        StoryboardPaintoverStateCoding.object(state)
                }
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        rawScenes[manuscriptId] = scenes
    }

    private func applyLocalCameraMotion(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        shotDuration: MediaTime,
        response: FrameCameraMotionPatchResponse
    ) {
        guard var scenes = rawScenes[manuscriptId] else { return }
        for sceneIndex in scenes.indices
        where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"]
                as? [[String: Any]]) ?? []
            for frameIndex in frames.indices
            where frames[frameIndex]["id"] as? String == frameId {
                if let track = response.cameraMotionTrack,
                   let object = try? CameraMotionTrackCoding.object(
                    track, shotDuration: shotDuration) {
                    frames[frameIndex]["cameraMotionTrack"] = object
                } else {
                    frames[frameIndex]["cameraMotionTrack"] = NSNull()
                }
                frames[frameIndex]["cameraMotionRevision"] =
                    response.cameraMotionRevision
                frames[frameIndex]["cameraMotionUpdatedAt"] =
                    response.cameraMotionUpdatedAt ?? NSNull()
                frames[frameIndex]["cameraMotionFingerprint"] =
                    response.cameraMotionFingerprint ?? NSNull()
                frames[frameIndex]["cameraMotionBaseFramingFingerprint"] =
                    response.cameraMotionBaseFramingFingerprint ?? NSNull()
                frames[frameIndex]["cameraMotionStatus"] =
                    response.cameraMotionStatus
                if !response.updatedAt.isEmpty {
                    frames[frameIndex]["updatedAt"] = response.updatedAt
                }
                if let sourceUpdatedAt = response.sourceUpdatedAt {
                    frames[frameIndex]["sourceUpdatedAt"] = sourceUpdatedAt
                }
                if let state = response.aiPaintoverState {
                    frames[frameIndex]["aiPaintoverState"] =
                        StoryboardPaintoverStateCoding.object(state)
                }
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        rawScenes[manuscriptId] = scenes
    }

    /// Dedicated OCC mutation for canonical shot duration. This intentionally
    /// has no legacy whole-scene fallback: once a frame has a duration
    /// revision, a generic save is not allowed to overwrite it.
    func patchFrameDuration(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        shotDuration: MediaTime,
        expectedDurationRevision: Int
    ) async throws -> FrameDurationPatchResponse {
        let payload = try FrameDurationPatchRequest(
            manuscriptId: manuscriptId,
            sceneId: sceneId,
            frameId: frameId,
            shotDuration: shotDuration,
            expectedDurationRevision: expectedDurationRevision)
        var urlRequest = try request(
            path: FrameDurationPatchWire.path, query: [:])
        urlRequest.httpMethod = "PATCH"
        urlRequest.setValue(
            "application/json", forHTTPHeaderField: "Content-Type")
        let body = FrameDurationPatchWire.requestBody(payload)
        guard JSONSerialization.isValidJSONObject(body) else {
            throw FrameDurationPatchError.invalidRequest(
                "Varighetsrequesten kunne ikke serialiseres.")
        }
        urlRequest.httpBody = try JSONSerialization.data(
            withJSONObject: body, options: [.sortedKeys])
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let result = try FrameDurationPatchWire.decodeResponse(
            data: data, statusCode: status)
        applyLocalFrameDuration(
            manuscriptId: manuscriptId, sceneId: sceneId,
            frameId: frameId, response: result)
        return result
    }

    /// Dedicated OCC mutation for camera motion. There is deliberately no
    /// whole-scene fallback: an old server must fail visibly rather than let a
    /// compatibility writer erase a newer/future motion envelope.
    func patchFrameCameraMotion(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        cameraMotionTrack: CameraMotionTrack?,
        expectedMotionRevision: Int,
        shotDuration: MediaTime
    ) async throws -> FrameCameraMotionPatchResponse {
        let payload = try FrameCameraMotionPatchRequest(
            manuscriptId: manuscriptId,
            sceneId: sceneId,
            frameId: frameId,
            cameraMotionTrack: cameraMotionTrack,
            expectedMotionRevision: expectedMotionRevision,
            shotDuration: shotDuration)
        var urlRequest = try request(
            path: FrameCameraMotionPatchWire.path, query: [:])
        urlRequest.httpMethod = "PATCH"
        urlRequest.setValue(
            "application/json", forHTTPHeaderField: "Content-Type")
        let body = try FrameCameraMotionPatchWire.requestBody(payload)
        guard JSONSerialization.isValidJSONObject(body) else {
            throw FrameCameraMotionPatchError.invalidRequest(
                "Kamerabanen kunne ikke serialiseres.")
        }
        urlRequest.httpBody = try JSONSerialization.data(
            withJSONObject: body, options: [.sortedKeys])
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let result = try FrameCameraMotionPatchWire.decodeResponse(
            data: data, statusCode: status, shotDuration: shotDuration)
        applyLocalCameraMotion(
            manuscriptId: manuscriptId, sceneId: sceneId,
            frameId: frameId, shotDuration: shotDuration, response: result)
        return result
    }

    /// Patch vilkårlige felter på én frame (Inspector) og upsert scenen.
    func saveFramePatch(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        fields: [String: any Sendable]
    ) async throws {
        let reservedMotionFields: Set<String> = [
            "cameraMotionTrack",
            "cameraMotionRevision",
            "cameraMotionUpdatedAt",
            "cameraMotionFingerprint",
            "cameraMotionBaseFramingFingerprint",
            "cameraMotionStatus",
            "expectedMotionRevision",
        ]
        guard Set(fields.keys).isDisjoint(with: reservedMotionFields) else {
            throw SyncError.serverResponse(
                code: "camera_motion_requires_dedicated_patch",
                message: "Kamerabaner må lagres med revisjonskontroll.")
        }
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId] else {
            throw SyncError.malformed("scener ikke lastet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        var found = false
        for sceneIndex in scenes.indices {
            guard scenes[sceneIndex]["id"] as? String == sceneId else { continue }
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            for frameIndex in frames.indices where frames[frameIndex]["id"] as? String == frameId {
                for (key, value) in fields {
                    frames[frameIndex][key] = value
                }
                frames[frameIndex]["updatedAt"] = now
                found = true
            }
            scenes[sceneIndex]["storyboardFrames"] = frames
        }
        guard found else { throw SyncError.malformed("frame \(frameId) ikke funnet") }
        rawScenes[manuscriptId] = scenes
        guard let scene = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        // Kun endrede felter over nettet — klobber ikke andres samtidige
        // frame-endringer i samme scene (felt-nivå granularitet).
        if let remote = try await patchFrameRemote(
            manuscriptId: manuscriptId, sceneId: sceneId, frameId: frameId,
            fields: fields as [String: Any]) {
            if !remote.updatedAt.isEmpty {
                applyLocalFrameUpdatedAt(manuscriptId: manuscriptId, sceneId: sceneId,
                                         frameId: frameId, updatedAt: remote.updatedAt)
            }
            return
        }
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
    }

    /// Scene-defaults brukes av alle shots som ikke har en eksplisitt
    /// scenario-overstyring. Ukjente manusfelt bevares tapsfritt.
    func saveScenePatch(
        manuscriptId: String, sceneId: String, fields: [String: any Sendable]
    ) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId],
              let index = scenes.firstIndex(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        for (key, value) in fields { scenes[index][key] = value }
        scenes[index]["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scenes[index])
    }

    // MARK: Production-aware AI

    private static func scenarioDictionary(
        frame: FrameSummary, scene: SceneSummary
    ) -> [String: any Sendable]? {
        let usesShotOverride = frame.scenarioPackId != nil
        guard let packId = usesShotOverride ? frame.scenarioPackId : scene.scenarioPackId,
              let version = usesShotOverride ? frame.scenarioPackVersion : scene.scenarioPackVersion,
              let subdomainId = usesShotOverride ? frame.scenarioSubdomainId : scene.scenarioSubdomainId,
              let zoneId = usesShotOverride ? frame.scenarioZoneId : scene.scenarioZoneId else {
            return nil
        }
        return [
            "packId": packId, "packVersion": version,
            "subdomainId": subdomainId, "zoneId": zoneId,
            "roleIds": usesShotOverride ? frame.scenarioRoleIds : scene.scenarioRoleIds,
            "propTypeIds": usesShotOverride ? frame.scenarioPropTypeIds : scene.scenarioPropTypeIds,
            "actionIds": usesShotOverride ? frame.scenarioActionIds : scene.scenarioActionIds,
            "stateIds": usesShotOverride ? frame.scenarioStateIds : scene.scenarioStateIds,
            "continuityLockIds": usesShotOverride
                ? frame.scenarioContinuityLockIds : scene.scenarioContinuityLockIds,
        ]
    }

    static func storyboardShotContext(
        manuscript: ManuscriptSummary, scene: SceneSummary, frame: FrameSummary,
        previous: FrameSummary? = nil, next: FrameSummary? = nil
    ) -> [String: any Sendable] {
        func neighbour(_ value: FrameSummary?) -> any Sendable {
            guard let value else { return NSNull() }
            let result: [String: any Sendable] = [
                "shotNumber": value.shotNumber, "description": value.description,
            ]
            return result
        }
        let project: [String: any Sendable] = [
            "styleProfileId": "story-pencil",
            "creativeDirection": "Hand-drawn monochrome production storyboard",
        ]
        let production: [String: any Sendable] = [
            "characters": [[String: any Sendable]](),
            "wardrobe": [[String: any Sendable]](),
            "locations": [[String: any Sendable]](),
            "props": [[String: any Sendable]](),
        ]
        let sceneContext: [String: any Sendable] = [
            "id": scene.id,
            "number": scene.sceneNumber.map { $0 as any Sendable } ?? NSNull(),
            "heading": scene.heading, "intExt": scene.intExt ?? "",
            "location": scene.location ?? "", "timeOfDay": scene.timeOfDay ?? "",
            "action": scene.descriptionText ?? "", "characters": scene.characters,
        ]
        var shotContext: [String: any Sendable] = [
            "id": frame.id, "number": frame.shotNumber,
            "description": frame.description, "notes": frame.notes ?? "",
            "shotType": frame.shotType ?? "", "angle": frame.angle ?? "",
            "lensMm": frame.lensMm.map { $0 as any Sendable } ?? NSNull(),
            "movement": frame.movement ?? "", "lighting": "",
            "durationSec": frame.durationSec, "transition": frame.transition ?? "",
            "focusDepth": frame.focusDepth ?? "", "timeOfDay": frame.timeOfDay ?? "",
            "weather": frame.weather ?? "", "beat": frame.beatTag ?? "",
            "tags": frame.tags,
        ]
        if let framing = frame.shotFraming {
            shotContext["shotFraming"] = ShotFramingStateCoding.sendableObject(framing)
        }
        let continuity: [String: any Sendable] = [
            "previous": neighbour(previous), "next": neighbour(next),
        ]
        var context: [String: any Sendable] = [
            "version": "storyboard-shot-v1",
            "manuscriptTitle": manuscript.title,
            "project": project, "production": production,
            "scene": sceneContext, "shot": shotContext, "continuity": continuity,
            "directorNote": frame.notes ?? "", "visualStyle": "",
        ]
        context["scenario"] = scenarioDictionary(frame: frame, scene: scene) ?? NSNull()
        return context
    }

    /// The provider token selects only a landscape/square/portrait raster.
    /// `targetAspectRatio` is the authoritative applied shot viewport; the
    /// backend center-crops provider pixels to that ratio without stretching.
    static func storyboardImageAspectParameters(
        context: [String: any Sendable]
    ) -> (providerToken: String, targetAspectRatio: Double) {
        let defaultAspect = 16.0 / 9.0
        let shot = context["shot"] as? [String: any Sendable]
        let framing = shot?["shotFraming"] as? [String: any Sendable]
        let candidate: Double?
        if let value = framing?["aspectRatio"] as? Double {
            candidate = value
        } else if let value = framing?["aspectRatio"] as? NSNumber {
            candidate = value.doubleValue
        } else if let value = framing?["aspectRatio"] as? Int {
            candidate = Double(value)
        } else {
            candidate = nil
        }
        let target = candidate.flatMap {
            $0.isFinite && (0.1...10).contains($0) ? $0 : nil
        } ?? defaultAspect
        let providerToken: String
        if abs(target - 1) < 0.000_001 {
            providerToken = "1024x1024"
        } else if target > 1 {
            providerToken = "1792x1024"
        } else {
            providerToken = "1024x1792"
        }
        return (providerToken, target)
    }

    func ensureStoryboard(
        projectId: String, scene: SceneSummary, frame: FrameSummary,
        strokesJSON: String?, imageDataOverride: String? = nil,
        workflowLevelOverride: String? = nil,
        preserveExistingImagePipeline: Bool = false,
        expectedSourceRevision: Int? = nil,
        expectedSourceUpdatedAt: String? = nil,
        expectedFramingFingerprint: String? = nil
    ) async throws -> StoryboardEnsureSummary {
        let decoded = strokesJSON.flatMap { $0.data(using: .utf8) }
            .flatMap { try? JSONSerialization.jsonObject(with: $0) }
        let strokes = (decoded as? [Any])
            ?? ((decoded as? [String: Any])?["strokes"] as? [Any]) ?? []
        var body: [String: Any] = [
            "sceneId": scene.id, "frameId": frame.id,
            "title": frame.description.isEmpty ? "Shot \(frame.shotNumber)" : frame.description,
            "strokes": strokes,
            "width": Int(frame.drawingWidth), "height": Int(frame.drawingHeight),
        ]
        if !preserveExistingImagePipeline {
            body["workflowLevel"] = workflowLevelOverride
                ?? (frame.imageUrl == nil ? "drawn" : "image-reference")
            if let imageData = imageDataOverride ?? frame.imageUrl {
                body["imageData"] = imageData
            }
        }
        if let expectedSourceRevision {
            body["expectedSourceRevision"] = expectedSourceRevision
        }
        if let expectedSourceUpdatedAt {
            // The backend keeps the legacy request key for wire
            // compatibility, but validates it against stable sourceUpdatedAt.
            body["expectedCompatFrameUpdatedAt"] = expectedSourceUpdatedAt
        }
        if let expectedFramingFingerprint {
            body["expectedFramingFingerprint"] = expectedFramingFingerprint
        }
        let response = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards", method: "POST",
            body: body)
        let data = response["data"] as? [String: Any]
        guard let id = data?["id"] as? String else {
            throw SyncError.malformed("storyboard-upsert")
        }
        let metadata = data?["metadata"] as? [String: Any]
        let revision = (metadata?["sourceRevision"] as? NSNumber)?.intValue
            ?? (metadata?["sourceRevision"] as? String).flatMap(Int.init)
        return StoryboardEnsureSummary(
            id: id,
            currentSourceRevision: revision,
            compatFrameUpdatedAt: metadata?["compatFrameUpdatedAt"] as? String,
            sourceUpdatedAt: (metadata?["compatSourceUpdatedAt"] as? String)
                ?? (metadata?["sourceUpdatedAt"] as? String))
    }

    func compileStoryboardPrompt(
        projectId: String, storyboardId: String, model: String, kind: String,
        context: [String: any Sendable], userAction: String? = nil
    ) async throws -> StoryboardPromptCompilationSummary {
        var body: [String: Any] = ["kind": kind, "model": model, "context": context]
        if let userAction, !userAction.isEmpty { body["userAction"] = userAction }
        let payload = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/compile-ai-prompt",
            method: "POST", body: body)
        guard let data = payload["data"] as? [String: Any] else {
            throw SyncError.malformed("prompt-inspector")
        }
        return Self.summarizePromptCompilation(data)
    }

    func generateStoryboardImage(
        projectId: String, storyboardId: String,
        context: [String: any Sendable], quality: String
    ) async throws -> (imageData: String, prompt: StoryboardPromptCompilationSummary) {
        let model = quality == "hd" ? "gpt-image-2" : "gpt-image-1-mini"
        let aspect = Self.storyboardImageAspectParameters(context: context)
        let payload = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/generate-ai-image",
            method: "POST", body: [
                "context": context, "quality": quality, "model": model,
                "aspectRatio": aspect.providerToken,
                "targetAspectRatio": aspect.targetAspectRatio,
            ])
        guard let storyboard = payload["data"] as? [String: Any],
              let imageData = storyboard["imageData"] as? String else {
            throw SyncError.malformed("generert storyboard-bilde")
        }
        let prompt = try await compileStoryboardPrompt(
            projectId: projectId, storyboardId: storyboardId, model: model,
            kind: "storyboard-image", context: context)
        return (imageData, prompt)
    }

    func fetchStoryboardImageVersions(
        projectId: String, storyboardId: String
    ) async throws -> StoryboardAIImageVersionListSummary {
        let payload = try await getJSON(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/image-stages",
            query: [:])
        let rawVersions = (payload["data"] as? [[String: Any]]) ?? []
        let versions = rawVersions.compactMap {
            Self.summarizeImageVersion($0)
        }
        let topLevelRevision = (payload["currentSourceRevision"] as? NSNumber)?.intValue
            ?? (payload["currentSourceRevision"] as? String).flatMap(Int.init)
        let entryRevisions = rawVersions.compactMap { entry -> Int? in
            (entry["currentSourceRevision"] as? NSNumber)?.intValue
                ?? (entry["currentSourceRevision"] as? String).flatMap(Int.init)
        }
        let compatibleEntryRevision = Set(entryRevisions).count == 1
            && entryRevisions.count == rawVersions.count
            ? entryRevisions.first : nil
        return StoryboardAIImageVersionListSummary(
            versions: versions,
            currentSourceRevision: topLevelRevision ?? compatibleEntryRevision,
            sourceUpdatedAt: (payload["sourceUpdatedAt"] as? String)
                ?? (payload["compatSourceUpdatedAt"] as? String))
    }

    /// Recovers immutable AI candidates after a crash between generation and
    /// approval. The normalized storyboard is already keyed by frameId even
    /// when the compatibility frame has not persisted aiStoryboardId yet.
    func resolveStoryboardId(
        projectId: String, sceneId: String, frameId: String
    ) async throws -> String? {
        let payload = try await getJSON(
            path: "/api/role-room/projects/\(projectId)/storyboards",
            query: ["sceneId": sceneId])
        let rows = (payload["data"] as? [[String: Any]]) ?? []
        return rows.first(where: { $0["frameId"] as? String == frameId })?["id"]
            as? String
    }

    func generateStoryboardImageStage(
        projectId: String, storyboardId: String, stage: String,
        context: [String: any Sendable],
        expectedSourceRevision: Int,
        expectedCompatFrameUpdatedAt: String,
        idempotencyKey: String,
        paintoverComposite: StoryboardPaintoverComposite? = nil
    ) async throws -> StoryboardAIImageStageResult {
        guard stage == "color" || stage == "atmosphere" else {
            throw SyncError.malformed("AI-bildesteg")
        }
        let body = Self.storyboardImageStageRequestBody(
            context: context,
            expectedSourceRevision: expectedSourceRevision,
            expectedCompatFrameUpdatedAt: expectedCompatFrameUpdatedAt,
            idempotencyKey: idempotencyKey,
            paintoverComposite: paintoverComposite)
        var payload: [String: Any] = [:]
        var version: StoryboardAIImageVersionSummary?
        for attempt in 0..<90 {
            payload = try await sendJSONResponse(
                path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/image-stages/\(stage)/generate",
                method: "POST", body: body)
            if let rawVersion = payload["data"] as? [String: Any],
               let summarized = Self.summarizeImageVersion(rawVersion) {
                version = summarized
                break
            }
            let status = (payload["data"] as? [String: Any])?["status"] as? String
            guard status == "processing" else {
                throw SyncError.malformed("AI-bildeversjon")
            }
            if attempt == 89 { throw SyncError.generationInProgress }
            try await Task.sleep(nanoseconds: 2_000_000_000)
        }
        guard let version else { throw SyncError.generationInProgress }
        // Return the persisted paid candidate immediately. Prompt inspection
        // is a separate presentation request; awaiting it here could leave a
        // successful generation invisible behind a slow secondary endpoint.
        return StoryboardAIImageStageResult(
            version: version, prompt: nil,
            estimatedCostUsd: (payload["estimatedCostUsd"] as? NSNumber)?.doubleValue)
    }

    static func storyboardImageStageRequestBody(
        context: [String: any Sendable],
        expectedSourceRevision: Int,
        expectedCompatFrameUpdatedAt: String,
        idempotencyKey: String,
        paintoverComposite: StoryboardPaintoverComposite?
    ) -> [String: Any] {
        let aspect = storyboardImageAspectParameters(context: context)
        var body: [String: Any] = [
            "context": context,
            "quality": "hd",
            "model": "gpt-image-2",
            "aspectRatio": aspect.providerToken,
            "targetAspectRatio": aspect.targetAspectRatio,
            "expectedSourceRevision": expectedSourceRevision,
            "expectedCompatFrameUpdatedAt": expectedCompatFrameUpdatedAt,
            "idempotencyKey": idempotencyKey,
        ]
        if let paintoverComposite {
            body["paintoverComposite"] = paintoverComposite.requestObject
        }
        return body
    }

    func approveStoryboardImageVersion(
        projectId: String, storyboardId: String, versionId: String,
        expectedFramingFingerprint: String
    ) async throws -> StoryboardAIImageApprovalSummary {
        let payload = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/image-stages/versions/\(versionId)/approve",
            method: "POST", body: [
                "expectedFramingFingerprint": expectedFramingFingerprint,
            ])
        guard let rawVersion = payload["data"] as? [String: Any],
              let version = Self.summarizeImageVersion(rawVersion) else {
            throw SyncError.malformed("godkjent AI-bildeversjon")
        }
        let currentSourceRevision = (rawVersion["currentSourceRevision"] as? NSNumber)?.intValue
            ?? (rawVersion["currentSourceRevision"] as? String).flatMap(Int.init)
        return StoryboardAIImageApprovalSummary(
            version: version,
            currentSourceRevision: currentSourceRevision,
            adoptedFrameUpdatedAt: rawVersion["adoptedFrameUpdatedAt"] as? String,
            sourceUpdatedAt: rawVersion["sourceUpdatedAt"] as? String)
    }

    func fetchProjectAIConsent(projectId: String) async throws -> Bool {
        let payload = try await getJSON(
            path: "/api/role-room/projects/\(projectId)/storyboard-ai-config", query: [:])
        let data = payload["data"] as? [String: Any]
        return (data?["consent"] as? [String: Any])?["consented"] as? Bool ?? false
    }

    func setProjectAIConsent(projectId: String, consented: Bool) async throws {
        try await sendJSON(
            path: "/api/role-room/projects/\(projectId)/storyboard-ai-consent", method: "PUT",
            body: ["consented": consented])
    }

    func startStoryboardAnimation(
        projectId: String, storyboardId: String,
        context: [String: any Sendable], model: String, duration: Double,
        confirmedPreflight: StoryboardAnimationPreflightSummary,
        paintoverComposite: StoryboardPaintoverComposite
    ) async throws -> StoryboardAIJobSummary {
        let body = Self.storyboardAnimationRequestBody(
            context: context, model: model, duration: duration,
            paintoverComposite: paintoverComposite,
            confirmedPreflight: confirmedPreflight)
        let payload = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/animate",
            method: "POST", body: body)
        let data = payload["data"] as? [String: Any]
        guard let id = data?["jobId"] as? String else {
            throw SyncError.malformed("animasjonsjobb")
        }
        return StoryboardAIJobSummary(
            jobId: id, status: data?["status"] as? String ?? "queued",
            estimatedCostUsd: (data?["estimatedCostUsd"] as? NSNumber)?.doubleValue,
            outputURL: nil, error: nil, sourceCurrent: nil)
    }

    func preflightStoryboardAnimation(
        projectId: String, storyboardId: String,
        context: [String: any Sendable], model: String, duration: Double,
        paintoverComposite: StoryboardPaintoverComposite
    ) async throws -> StoryboardAnimationPreflightSummary {
        let body = Self.storyboardAnimationRequestBody(
            context: context, model: model, duration: duration,
            paintoverComposite: paintoverComposite)
        let payload = try await sendJSONResponse(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/animation-preflight",
            method: "POST",
            body: body)
        guard let data = payload["data"] as? [String: Any],
              let model = data["model"] as? String,
              let provider = data["provider"] as? String,
              let sourceFingerprint = data["sourceFingerprint"] as? String,
              let bindingFingerprint = data["bindingFingerprint"] as? String,
              Self.isCanonicalSHA256Fingerprint(bindingFingerprint),
              let compilationFingerprint = data["compilationFingerprint"] as? String,
              let estimatedCost = data["estimatedCostUsd"] as? NSNumber else {
            throw SyncError.malformed("animasjonsforhåndsvisning")
        }
        return StoryboardAnimationPreflightSummary(
            model: model, provider: provider,
            duration: (data["duration"] as? NSNumber)?.intValue ?? 5,
            estimatedCostUsd: estimatedCost.doubleValue,
            providerCredits: (data["providerCredits"] as? NSNumber)?.doubleValue,
            sourceFingerprint: sourceFingerprint,
            bindingFingerprint: bindingFingerprint,
            compilationFingerprint: compilationFingerprint)
    }

    static func storyboardAnimationRequestBody(
        context: [String: any Sendable],
        model: String,
        duration: Double,
        paintoverComposite: StoryboardPaintoverComposite,
        confirmedPreflight: StoryboardAnimationPreflightSummary? = nil
    ) -> [String: Any] {
        var body: [String: Any] = [
            "context": context,
            "model": model,
            "duration": Int(max(4, min(15, duration.rounded()))),
        ]
        body["sourceStage"] =
            paintoverComposite.includedThroughStage.rawValue
        body["baseVersionId"] = paintoverComposite.baseVersionId
        body["paintoverComposite"] = paintoverComposite.requestObject
        if let confirmedPreflight {
            body["confirmedPreflight"] = [
                "compilationFingerprint":
                    confirmedPreflight.compilationFingerprint,
                "sourceFingerprint": confirmedPreflight.sourceFingerprint,
                "bindingFingerprint": confirmedPreflight.bindingFingerprint,
                "duration": confirmedPreflight.duration,
                "maxEstimatedCostUsd": confirmedPreflight.estimatedCostUsd,
            ]
        }
        return body
    }

    /// Canonical wire hashes are ASCII by contract. Character.isNumber also
    /// accepts non-ASCII numerals, so validation operates on exact UTF-8 bytes.
    static func isCanonicalSHA256Fingerprint(
        _ value: String
    ) -> Bool {
        let bytes = Array(value.utf8)
        let prefix = Array("sha256:".utf8)
        guard bytes.count == prefix.count + 64,
              bytes.starts(with: prefix) else { return false }
        return bytes.dropFirst(prefix.count).allSatisfy { byte in
            (48...57).contains(byte) || (97...102).contains(byte)
        }
    }

    func pollStoryboardAnimation(
        projectId: String, storyboardId: String, jobId: String
    ) async throws -> StoryboardAIJobSummary {
        let payload = try await getJSON(
            path: "/api/role-room/projects/\(projectId)/storyboards/\(storyboardId)/animations/\(jobId)",
            query: [:])
        let data = payload["data"] as? [String: Any]
        return StoryboardAIJobSummary(
            jobId: jobId, status: data?["status"] as? String ?? "running",
            estimatedCostUsd: nil, outputURL: data?["outputUrl"] as? String,
            error: data?["error"] as? String,
            sourceCurrent: data?["sourceCurrent"] as? Bool)
    }

    /// ADD SHOT: ny tom frame etter siste i scenen (shotNumber = neste
    /// bokstav i samme tallserie, «1A» → «1B»; tom scene → «1A»), upsert.
    func addFrame(manuscriptId: String, sceneId: String) async throws -> String {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId] else {
            throw SyncError.malformed("scener ikke lastet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        var newFrameId: String?
        for sceneIndex in scenes.indices where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            let lastShot = (frames.last?["shotNumber"] as? String) ?? ""
            let nextShot: String
            if let letter = lastShot.last, letter.isLetter, letter < "Z",
               let next = letter.unicodeScalars.first.flatMap({ UnicodeScalar($0.value + 1) }) {
                nextShot = String(lastShot.dropLast()) + String(Character(next))
            } else if lastShot.isEmpty {
                nextShot = "1A"
            } else {
                nextShot = lastShot + "A"
            }
            let frameId = "frame-\(Int(Date().timeIntervalSince1970 * 1000))"
            frames.append([
                "id": frameId,
                "shotNumber": nextShot,
                "description": "",
                "duration": 2,
                "imageSource": "placeholder",
                "drawingData": ["strokes": "[]", "width": 1920, "height": 1080,
                                "createdAt": now, "updatedAt": now],
                "createdAt": now,
                "updatedAt": now,
            ])
            scenes[sceneIndex]["storyboardFrames"] = frames
            scenes[sceneIndex]["updatedAt"] = now
            newFrameId = frameId
        }
        guard let frameId = newFrameId,
              let scene = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
        return frameId
    }

    /// Felles mønster for frame-mutasjoner: fersk scene → muter → upsert.
    private func mutateSceneFrames(
        manuscriptId: String, sceneId: String,
        _ mutate: (inout [[String: Any]]) -> Void
    ) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId] else {
            throw SyncError.malformed("scener ikke lastet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        for sceneIndex in scenes.indices where scenes[sceneIndex]["id"] as? String == sceneId {
            var frames = (scenes[sceneIndex]["storyboardFrames"] as? [[String: Any]]) ?? []
            mutate(&frames)
            scenes[sceneIndex]["storyboardFrames"] = frames
            scenes[sceneIndex]["updatedAt"] = now
        }
        guard let scene = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
    }

    private static func nextShotNumber(after last: String) -> String {
        if let letter = last.last, letter.isLetter, letter < "Z",
           let next = letter.unicodeScalars.first.flatMap({ UnicodeScalar($0.value + 1) }) {
            return String(last.dropLast()) + String(Character(next))
        }
        return last.isEmpty ? "1A" : last + "A"
    }

    func deleteFrame(manuscriptId: String, sceneId: String, frameId: String) async throws {
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            frames.removeAll { $0["id"] as? String == frameId }
        }
    }

    func duplicateFrame(manuscriptId: String, sceneId: String, frameId: String) async throws -> String {
        let newId = "frame-\(Int(Date().timeIntervalSince1970 * 1000))"
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            guard let index = frames.firstIndex(where: { $0["id"] as? String == frameId }) else { return }
            var copy = frames[index]
            copy["id"] = newId
            copy["shotNumber"] = Self.nextShotNumber(
                after: (frames.last?["shotNumber"] as? String) ?? "")
            copy["updatedAt"] = ISO8601DateFormatter().string(from: Date())
            frames.insert(copy, at: index + 1)
        }
        return newId
    }

    /// Flytt frame ett hakk (offset ±1) i scenens rekkefølge.
    func moveFrame(manuscriptId: String, sceneId: String, frameId: String, offset: Int) async throws {
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            guard let index = frames.firstIndex(where: { $0["id"] as? String == frameId }) else { return }
            let target = index + offset
            guard frames.indices.contains(target) else { return }
            frames.swapAt(index, target)
        }
    }

    /// Ny scene i manuset — arver prosjekt-/manusfelter fra eksisterende
    /// scene (upsert-endepunktet oppretter ved ny id).
    func addScene(manuscriptId: String, title: String, projectId: String? = nil) async throws -> String {
        await refreshScenes(manuscriptId: manuscriptId)
        var scenes = rawScenes[manuscriptId] ?? []
        let template = scenes.first
        let now = ISO8601DateFormatter().string(from: Date())
        let maxNumber = scenes.compactMap { $0["sceneNumber"] as? Int }.max() ?? scenes.count
        let sceneId = "scene-\(Int(Date().timeIntervalSince1970 * 1000))"
        var scene: [String: Any] = [
            "id": sceneId,
            "title": title,
            "sceneHeading": title,
            "sceneNumber": maxNumber + 1,
            "storyboardFrames": [[String: Any]](),
            "createdAt": now,
            "updatedAt": now,
        ]
        for key in ["manuscriptId", "manuscript_id", "projectId", "project_id", "act_id"] {
            scene[key] = template?[key]
        }
        // Tomt manus: ingen mal å arve fra — bruk kjente id-er direkte.
        if scene["manuscriptId"] == nil { scene["manuscriptId"] = manuscriptId }
        if scene["projectId"] == nil, let projectId { scene["projectId"] = projectId }
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scene)
        scenes.append(scene)
        rawScenes[manuscriptId] = scenes
        return sceneId
    }

    /// Slett én scene (nytt backend-endepunkt; ingen legacy-fallback —
    /// eldre backend gir 404 og operasjonen feiler synlig).
    func deleteScene(manuscriptId: String, sceneId: String) async throws {
        var request = try request(path: "/api/casting/scenes/\(sceneId)",
                                  query: ["manuscriptId": manuscriptId])
        request.httpMethod = "DELETE"
        let (_, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(status) else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        lastDeletedScene = rawScenes[manuscriptId]?
            .first { $0["id"] as? String == sceneId }
            .map { (manuscriptId, $0) }
        rawScenes[manuscriptId]?.removeAll { $0["id"] as? String == sceneId }
    }

    /// Dupliser scene: kopi med nye scene-/frame-id-er, «(kopi)»-tittel.
    func duplicateScene(manuscriptId: String, sceneId: String) async throws -> String {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId],
              let source = scenes.first(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        let now = ISO8601DateFormatter().string(from: Date())
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        var copy = source
        let newId = "scene-\(stamp)"
        copy["id"] = newId
        let title = (source["title"] as? String) ?? (source["sceneHeading"] as? String) ?? "Scene"
        copy["title"] = title + " (kopi)"
        copy["sceneHeading"] = title + " (kopi)"
        copy["sceneNumber"] = (scenes.compactMap { $0["sceneNumber"] as? Int }.max() ?? scenes.count) + 1
        copy["createdAt"] = now
        copy["updatedAt"] = now
        var frames = (source["storyboardFrames"] as? [[String: Any]]) ?? []
        for index in frames.indices {
            frames[index]["id"] = "frame-\(stamp)-\(index)"
        }
        copy["storyboardFrames"] = frames
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: copy)
        scenes.append(copy)
        rawScenes[manuscriptId] = scenes
        return newId
    }

    /// Omdøp scene (upsert av hele scenen — sjelden operasjon).
    func renameScene(manuscriptId: String, sceneId: String, title: String) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId],
              let index = scenes.firstIndex(where: { $0["id"] as? String == sceneId }) else {
            throw SyncError.malformed("scene \(sceneId) ikke funnet")
        }
        scenes[index]["title"] = title
        scenes[index]["sceneHeading"] = title
        scenes[index]["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scenes[index])
    }

    /// Presentasjonsmetadata (konsept + footer-seksjoner) lagres på
    /// FØRSTE scene (kjent lagringsvei; web ignorerer feltene).
    func setPresentationMeta(manuscriptId: String, concept: String,
                             footerJSON: String) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId], !scenes.isEmpty else {
            throw SyncError.malformed("scener ikke lastet")
        }
        scenes[0]["presentationConcept"] = concept
        scenes[0]["presentationFooter"] = footerJSON
        scenes[0]["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scenes[0])
    }

    /// Hub-metadata (generisk variant av presentasjons-mønsteret):
    /// vilkårlige felter på FØRSTE scene.
    func setHubMeta(manuscriptId: String, fields: [String: any Sendable]) async throws {
        await refreshScenes(manuscriptId: manuscriptId)
        guard var scenes = rawScenes[manuscriptId], !scenes.isEmpty else {
            throw SyncError.malformed("scener ikke lastet")
        }
        for (key, value) in fields { scenes[0][key] = value }
        scenes[0]["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        rawScenes[manuscriptId] = scenes
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: scenes[0])
    }

    /// Renummerer shots i rekkefølge: prefiks (tall-delen av første shot,
    /// ellers sceneNumber) + A, B, …, Z, AA.
    func renumberFrames(manuscriptId: String, sceneId: String) async throws {
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            guard !frames.isEmpty else { return }
            let firstShot = (frames[0]["shotNumber"] as? String) ?? ""
            let digits = firstShot.prefix { $0.isNumber }
            let prefix = digits.isEmpty ? "1" : String(digits)
            for index in frames.indices {
                var letters = ""
                var value = index
                repeat {
                    letters = String(UnicodeScalar(UInt8(65 + value % 26))) + letters
                    value = value / 26 - 1
                } while value >= 0
                frames[index]["shotNumber"] = prefix + letters
            }
        }
    }

    /// Presence: meld tilstedeværelse og få andre aktive (visningsnavn).
    func reportPresence(manuscriptId: String) async -> [String] {
        guard let name = userName else { return [] }
        var request = (try? request(path: "/api/casting/manuscripts/\(manuscriptId)/presence",
                                    query: [:]))
        request?.httpMethod = "POST"
        request?.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request?.httpBody = try? JSONSerialization.data(withJSONObject: ["displayName": name])
        guard let request,
              let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let others = payload["presence"] as? [[String: Any]] else { return [] }
        return others.compactMap { ($0["displayName"] as? String) ?? ($0["userId"] as? String) }
    }

    /// Tegne-historikk for én frame (server bevarer 3 siste versjoner).
    func frameHistory(manuscriptId: String, sceneId: String,
                      frameId: String) async -> [(updatedAt: String, strokes: String)] {
        await refreshScenes(manuscriptId: manuscriptId)
        guard let scenes = rawScenes[manuscriptId],
              let scene = scenes.first(where: { $0["id"] as? String == sceneId }),
              let frames = scene["storyboardFrames"] as? [[String: Any]],
              let frame = frames.first(where: { $0["id"] as? String == frameId }),
              let history = frame["drawingHistory"] as? [[String: Any]] else { return [] }
        return history.compactMap { entry in
            guard let strokes = entry["strokes"] as? String else { return nil }
            return ((entry["updatedAt"] as? String) ?? "", strokes)
        }
    }

    // Slett-angre: siste slettede scene holdes i minnet til re-upsert.
    private var lastDeletedScene: (manuscriptId: String, scene: [String: Any])?

    func undoLastSceneDelete() async throws {
        guard let deleted = lastDeletedScene else { return }
        lastDeletedScene = nil
        try await sendJSON(path: "/api/casting/scenes", method: "POST", body: deleted.scene)
        var scenes = rawScenes[deleted.manuscriptId] ?? []
        scenes.append(deleted.scene)
        rawScenes[deleted.manuscriptId] = scenes
    }

    /// Last opp panel-bilde til B2 (bruker-bucket m/ kvote). Returnerer
    /// download-stien som blir frame.imageUrl (web-img med cookies og
    /// native fetch med Bearer følger 302 til signert B2-URL).
    func uploadStorageImage(jpegData: Data, name: String,
                            projectId: String? = nil,
                            sceneId: String? = nil,
                            attachedToEntityType: String? = nil,
                            attachedToEntityId: String? = nil,
                            attachmentNote: String? = nil) async throws -> String {
        var request = try request(path: "/api/role-room/storage/upload", query: [:])
        request.httpMethod = "POST"
        let boundary = "sb-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)",
                         forHTTPHeaderField: "Content-Type")
        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
        }
        field("sourceModule", "storyboard")
        if let projectId { field("projectId", projectId) }
        if let sceneId { field("sceneId", sceneId) }
        if let attachedToEntityType { field("attachedToEntityType", attachedToEntityType) }
        if let attachedToEntityId { field("attachedToEntityId", attachedToEntityId) }
        if let attachmentNote { field("attachmentNote", attachmentNote) }
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(name)\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8))
        body.append(jpegData)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        request.httpBody = body
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200,
              let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let file = payload["file"] as? [String: Any],
              let fileId = file["id"] as? String else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        return "/api/role-room/storage/files/\(fileId)/download"
    }

    struct StorageFileSummary: Identifiable, Sendable {
        let id: String
        let displayName: String
        let sizeBytes: Int
        let contentType: String?
        let uploadedAt: String
        let entityType: String?
        var downloadPath: String { "/api/role-room/storage/files/\(id)/download" }
        var isImage: Bool { (contentType ?? "").hasPrefix("image/") }
    }

    /// Omdøp fil i Role Room-lagringen.
    func renameStorageFile(fileId: String, displayName: String) async -> Bool {
        guard var request = try? request(path: "/api/role-room/storage/files/\(fileId)",
                                         query: [:]) else { return false }
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["displayName": displayName])
        guard let (_, response) = try? await URLSession.shared.data(for: request) else { return false }
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    /// Papirkurven (soft-slettede filer).
    func listTrash() async -> [StorageFileSummary] {
        guard let payload = try? await getJSON(path: "/api/role-room/storage/trash", query: [:]),
              let files = payload["files"] as? [[String: Any]] else { return [] }
        return files.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            return StorageFileSummary(
                id: id,
                displayName: (entry["displayName"] as? String) ?? id,
                sizeBytes: (entry["sizeBytes"] as? Int) ?? 0,
                contentType: entry["contentType"] as? String,
                uploadedAt: (entry["uploadedAt"] as? String) ?? "",
                entityType: entry["attachedToEntityType"] as? String)
        }
    }

    /// Gjenopprett fra papirkurven (reserverer kvoten igjen).
    func restoreStorageFile(fileId: String) async -> Bool {
        guard var request = try? request(path: "/api/role-room/storage/files/\(fileId)/restore",
                                         query: [:]) else { return false }
        request.httpMethod = "POST"
        guard let (_, response) = try? await URLSession.shared.data(for: request) else { return false }
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    /// Soft delete (papirkurv) — frigjør kvote.
    func deleteStorageFile(fileId: String) async -> Bool {
        guard var request = try? request(path: "/api/role-room/storage/files/\(fileId)",
                                         query: [:]) else { return false }
        request.httpMethod = "DELETE"
        guard let (_, response) = try? await URLSession.shared.data(for: request) else { return false }
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    /// Lagringsstatus (kvote-måleren i hubben).
    func fetchStorageStats() async -> (used: Int, quota: Int?)? {
        guard let payload = try? await getJSON(path: "/api/role-room/storage/stats", query: [:]) else {
            return nil
        }
        let stats = (payload["stats"] as? [String: Any]) ?? payload
        guard let used = stats["usedBytes"] as? Int else { return nil }
        return (used, stats["quotaBytes"] as? Int)
    }

    /// Prosjektets filer i Role Room-lagringen (Assets-seksjonen i hubben).
    func listStorageFiles(projectId: String) async -> [StorageFileSummary] {
        guard let payload = try? await getJSON(
            path: "/api/role-room/storage/files",
            query: ["projectId": projectId, "limit": "60"]),
              let files = payload["files"] as? [[String: Any]] else { return [] }
        return files.compactMap { entry in
            guard let id = entry["id"] as? String else { return nil }
            return StorageFileSummary(
                id: id,
                displayName: (entry["displayName"] as? String) ?? id,
                sizeBytes: (entry["sizeBytes"] as? Int) ?? 0,
                contentType: entry["contentType"] as? String,
                uploadedAt: (entry["uploadedAt"] as? String) ?? "",
                entityType: entry["attachedToEntityType"] as? String)
        }
    }

    nonisolated static func stableImageCacheKey(for path: String) -> String {
        let digest = SHA256.hash(data: Data(path.utf8))
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return "img-\(hex)"
    }

    /// Hent remote panel-bilde (Bearer + 302-følging), disk-cachet.
    func fetchRemoteImageData(path: String) async -> Data? {
        // Swift hashValue randomiseres per prosess og ga derfor cache-miss
        // ved hver appstart. Stabil SHA-256 gjør at fulloppløselig original
        // er tilgjengelig umiddelbart etter første vellykkede nedlasting.
        let key = Self.stableImageCacheKey(for: path)
        if let cached = try? Data(contentsOf: Self.cacheDirectory.appendingPathComponent("\(key).bin")) {
            return cached
        }
        guard let request = try? request(path: path, query: [:]),
              let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        try? FileManager.default.createDirectory(at: Self.cacheDirectory,
                                                 withIntermediateDirectories: true)
        try? data.write(to: Self.cacheDirectory.appendingPathComponent("\(key).bin"))
        return data
    }

    /// Ark-import: legg N bilde-frames (dataURL-er) bakerst i scenen i én
    /// mutasjon (presentasjons-board → paneler).
    func importImageFrames(manuscriptId: String, sceneId: String,
                           imageURLs imageDataURLs: [String]) async throws {
        try await mutateSceneFrames(manuscriptId: manuscriptId, sceneId: sceneId) { frames in
            let stamp = Int(Date().timeIntervalSince1970 * 1000)
            for (index, dataURL) in imageDataURLs.enumerated() {
                let lastShot = (frames.last?["shotNumber"] as? String) ?? ""
                let digits = lastShot.prefix { $0.isNumber }
                let prefix = digits.isEmpty ? "1" : String(digits)
                var letters = ""
                var value = frames.count
                repeat {
                    letters = String(UnicodeScalar(UInt8(65 + value % 26))) + letters
                    value = value / 26 - 1
                } while value >= 0
                frames.append([
                    "id": "frame-\(stamp)-imp\(index)",
                    "shotNumber": prefix + letters,
                    "description": "",
                    "imageUrl": dataURL,
                    "imageSource": "imported",
                    "durationSec": 3,
                    "tags": [String](),
                ])
            }
        }
    }

    // MARK: HTTP

    private func request(path: String, query: [String: String]) throws -> URLRequest {
        guard let baseURL, let token else { throw SyncError.notConfigured }
        var components = URLComponents(url: baseURL.appendingPathComponent(path),
                                       resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }

    // ── @mention-varsler + APNs-token ──
    func fetchUnreadMentions(name _: String) async -> Int {
        guard let result = try? await getJSON(
            path: "/api/casting/storyboard-mentions",
            query: ["unread": "1"]) else { return 0 }
        return (result["mentions"] as? [[String: Any]])?.count ?? 0
    }

    func markMentionsRead(name _: String) async {
        try? await sendJSON(path: "/api/casting/storyboard-mentions/read",
                            method: "POST", body: [:])
    }

    func registerDeviceToken(_ token: String) async {
        try? await sendJSON(path: "/api/role-room/storyboard/device-token",
                            method: "POST",
                            body: ["token": token,
                                   "deviceName": UIDevice.current.name])
    }

    private func getJSON(path: String, query: [String: String]) async throws -> [String: Any] {
        let (data, response) = try await URLSession.shared.data(for: request(path: path, query: query))
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            if status == 401 { throw SyncError.unauthenticated }
            if let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = (payload["detail"] as? String) ?? (payload["message"] as? String) {
                throw SyncError.serverMessage(message)
            }
            throw SyncError.http(status)
        }
        guard let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SyncError.malformed(path)
        }
        return payload
    }

    private func getJSONArray(path: String) async throws -> [[String: Any]] {
        let (data, response) = try await URLSession.shared.data(for: request(path: path, query: [:]))
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
        }
        let payload = try JSONSerialization.jsonObject(with: data)
        if let list = payload as? [[String: Any]] { return list }
        if let object = payload as? [String: Any],
           let list = (object["scenes"] ?? object["data"]) as? [[String: Any]] {
            return list
        }
        throw SyncError.malformed(path)
    }

    // Per-frame PATCH (payload-kutt): husker om backend har endepunktet
    // så eldre backend faller tilbake til hele-scene-POST uten ekstra
    // rundtur hver gang.
    private var frameEndpointAvailable: Bool?

    static func framePatchRequestBody(
        manuscriptId: String,
        sceneId: String,
        frameId: String,
        fields: [String: Any],
        baseUpdatedAt: String? = nil,
        baseStrokesJSON: String? = nil,
        baseLayerState: BoardLayerState? = nil,
        baseShotFraming: ShotFramingState? = nil
    ) -> [String: Any] {
        var body: [String: Any] = [
            "manuscriptId": manuscriptId,
            "sceneId": sceneId,
            "frameId": frameId,
            "fields": fields,
        ]
        if let baseUpdatedAt { body["baseUpdatedAt"] = baseUpdatedAt }
        if let baseStrokesJSON { body["baseStrokesJSON"] = baseStrokesJSON }
        if let baseLayerState,
           let object = BoardLayerStateCoding.object(baseLayerState) {
            body["baseLayerState"] = object
        }
        if let baseShotFraming,
           let object = ShotFramingStateCoding.object(baseShotFraming) {
            body["baseShotFraming"] = object
        }
        return body
    }

    /// PATCH /api/casting/frames. true = håndtert; false = endepunkt
    /// finnes ikke (kaller bruker legacy-POST). Kaster ved andre feil.
    private func patchFrameRemote(
        manuscriptId: String, sceneId: String, frameId: String,
        fields: [String: Any],
        baseUpdatedAt: String? = nil,
        baseStrokesJSON: String? = nil,
        baseLayerState: BoardLayerState? = nil,
        baseShotFraming: ShotFramingState? = nil
    ) async throws -> (
        updatedAt: String, merged: Bool, strokesJSON: String?,
        layerState: BoardLayerState?, shotFraming: ShotFramingState?,
        sourceRevision: Int?, sourceUpdatedAt: String?,
        paintoverState: StoryboardPaintoverState?
    )? {
        if frameEndpointAvailable == false { return nil }
        var request = try request(path: "/api/casting/frames", query: [:])
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = Self.framePatchRequestBody(
            manuscriptId: manuscriptId,
            sceneId: sceneId,
            frameId: frameId,
            fields: fields,
            baseUpdatedAt: baseUpdatedAt,
            baseStrokesJSON: baseStrokesJSON,
            baseLayerState: baseLayerState,
            baseShotFraming: baseShotFraming)
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if (200...299).contains(status) {
            frameEndpointAvailable = true
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            return (
                (payload?["updatedAt"] as? String) ?? "",
                payload?["merged"] as? Bool ?? false,
                payload?["strokesJSON"] as? String,
                BoardLayerStateCoding.decode(payload?["layerState"]),
                ShotFramingStateCoding.decode(payload?["shotFraming"]),
                (payload?["sourceRevision"] as? NSNumber)?.intValue
                    ?? (payload?["sourceRevision"] as? String).flatMap(Int.init),
                payload?["sourceUpdatedAt"] as? String,
                StoryboardPaintoverStateCoding.decode(
                    payload?["aiPaintoverState"]))
        }
        if status == 404 || status == 405 {
            // 404 kan også bety frame ikke funnet på ny backend — legacy-
            // POST upserter uansett riktig, så fallback er trygt begge veier.
            frameEndpointAvailable = nil
            return nil
        }
        if status == 409,
           let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let current = payload["currentUpdatedAt"] as? String ?? "ukjent"
            throw SyncError.serverMessage(
                "Shotet ble endret på en annen enhet (\(current)). Lokal WAL er beholdt.")
        }
        throw status == 401 ? SyncError.unauthenticated : SyncError.http(status)
    }

    private func sendJSON(path: String, method: String, body: [String: Any]) async throws {
        var request = try request(path: path, query: [:])
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(status) else {
            if status == 401 { throw SyncError.unauthenticated }
            if let payload = try? JSONSerialization.jsonObject(with: data)
                    as? [String: Any],
               let message = (payload["detail"] as? String)
                    ?? (payload["message"] as? String) {
                throw SyncError.serverMessage(message)
            }
            throw SyncError.http(status)
        }
    }

    private func sendJSONResponse(
        path: String, method: String, body: [String: Any]
    ) async throws -> [String: Any] {
        var request = try request(path: path, query: [:])
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(status) else {
            if status == 401 { throw SyncError.unauthenticated }
            if let payload = try? JSONSerialization.jsonObject(with: data)
                    as? [String: Any] {
                let message = (payload["detail"] as? String)
                    ?? (payload["message"] as? String)
                if let code = payload["error"] as? String {
                    throw SyncError.serverResponse(
                        code: code, message: message ?? code)
                }
                if let message { throw SyncError.serverMessage(message) }
            }
            throw SyncError.http(status)
        }
        guard let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SyncError.malformed(path)
        }
        return payload
    }

    // MARK: Mapping

    private static func summarizePromptCompilation(
        _ data: [String: Any]
    ) -> StoryboardPromptCompilationSummary {
        let modules = ((data["modules"] as? [[String: Any]]) ?? []).compactMap {
            module -> StoryboardPromptModuleSummary? in
            guard let id = module["id"] as? String,
                  let label = module["label"] as? String else { return nil }
            let constraints = ((module["constraints"] as? [[String: Any]]) ?? []).compactMap {
                entry -> StoryboardPromptConstraintSummary? in
                guard let constraintId = entry["id"] as? String,
                      let text = entry["text"] as? String else { return nil }
                return StoryboardPromptConstraintSummary(
                    id: constraintId, text: text,
                    source: entry["source"] as? String ?? "production",
                    locked: entry["locked"] as? Bool ?? false)
            }
            return StoryboardPromptModuleSummary(id: id, label: label, constraints: constraints)
        }
        let validation = data["validation"] as? [String: Any]
        let issues = ((validation?["issues"] as? [[String: Any]]) ?? []).enumerated().map {
            index, issue in StoryboardPromptIssueSummary(
                id: (issue["code"] as? String) ?? "issue-\(index)",
                severity: issue["severity"] as? String ?? "warning",
                message: issue["message"] as? String ?? "Ukjent valideringsfunn")
        }
        let inspector = data["inspector"] as? [String: Any]
        let model = inspector?["model"] as? [String: Any]
        let scenario = inspector?["scenario"] as? [String: Any]
        let scenarioLabel = [scenario?["packLabel"] as? String,
                             scenario?["subdomainLabel"] as? String,
                             scenario?["zoneLabel"] as? String]
            .compactMap { $0 }.joined(separator: " · ")
        return StoryboardPromptCompilationSummary(
            compiledPrompt: data["compiledPrompt"] as? String ?? "",
            modules: modules, issues: issues,
            valid: validation?["valid"] as? Bool ?? false,
            modelLabel: model?["label"] as? String ?? "Ukjent modell",
            modelProvider: model?["provider"] as? String ?? "",
            inheritedConstraintCount: (inspector?["inheritedConstraintCount"] as? NSNumber)?.intValue ?? 0,
            lockedProperties: inspector?["lockedProperties"] as? [String] ?? [],
            styleLabel: inspector?["styleProfileLabel"] as? String ?? "",
            scenarioLabel: scenarioLabel.isEmpty ? nil : scenarioLabel)
    }

    private static func summarizeImageVersion(
        _ data: [String: Any]
    ) -> StoryboardAIImageVersionSummary? {
        guard let id = data["id"] as? String,
              let storyboardId = data["storyboardId"] as? String,
              let stage = data["stage"] as? String,
              let status = data["status"] as? String,
              let sourceFingerprint = data["sourceFingerprint"] as? String,
              let imageData = data["imageData"] as? String else { return nil }
        let metadata = data["metadata"] as? [String: Any]
        let sourceRevision = (data["sourceRevision"] as? NSNumber)?.intValue
            ?? (data["sourceRevision"] as? String).flatMap(Int.init)
            ?? (metadata?["sourceRevision"] as? NSNumber)?.intValue
            ?? (metadata?["sourceRevision"] as? String).flatMap(Int.init)
        let paintover = metadata?["paintoverComposite"] as? [String: Any]
        return StoryboardAIImageVersionSummary(
            id: id, storyboardId: storyboardId,
            frameId: metadata?["frameId"] as? String,
            stage: stage, status: status,
            parentVersionId: data["parentVersionId"] as? String,
            sourceFingerprint: sourceFingerprint,
            compilationFingerprint: data["compilationFingerprint"] as? String,
            imageData: imageData,
            width: (data["width"] as? NSNumber)?.intValue,
            height: (data["height"] as? NSNumber)?.intValue,
            model: data["model"] as? String,
            quality: data["quality"] as? String,
            createdAt: data["createdAt"] as? String ?? "",
            approvedAt: data["approvedAt"] as? String,
            framingFingerprint: metadata?["framingFingerprint"] as? String,
            sourceRevision: sourceRevision,
            paintoverColorRevision:
                (paintover?["colorRevision"] as? NSNumber)?.intValue
                    ?? (paintover?["colorRevision"] as? String).flatMap(Int.init),
            paintoverColorFingerprint:
                (paintover?["colorFingerprint"] as? String)?.lowercased())
    }

    static func summarizeScenarioPacks(
        _ list: [[String: Any]]
    ) -> [StoryboardScenarioPackSummary] {
        func options(_ value: Any?) -> [StoryboardScenarioOptionSummary] {
            ((value as? [[String: Any]]) ?? []).compactMap { entry in
                guard let id = entry["id"] as? String,
                      let label = entry["label"] as? String else { return nil }
                return StoryboardScenarioOptionSummary(id: id, label: label)
            }
        }
        return list.compactMap { pack in
            guard let id = pack["id"] as? String,
                  let version = pack["version"] as? String,
                  let label = pack["label"] as? String else { return nil }
            let subdomains = ((pack["subdomains"] as? [[String: Any]]) ?? []).compactMap {
                subdomain -> StoryboardScenarioSubdomainSummary? in
                guard let subdomainId = subdomain["id"] as? String,
                      let subdomainLabel = subdomain["label"] as? String else { return nil }
                let zones = options(subdomain["zones"])
                guard !zones.isEmpty else { return nil }
                return StoryboardScenarioSubdomainSummary(
                    id: subdomainId, label: subdomainLabel, zones: zones,
                    roles: options(subdomain["roles"]),
                    propTypes: options(subdomain["propTypes"]),
                    actions: options(subdomain["actions"]),
                    states: options(subdomain["states"]),
                    continuityLocks: options(subdomain["continuityLocks"]))
            }
            guard !subdomains.isEmpty else { return nil }
            let families = ((pack["families"] as? [[String: Any]]) ?? []).compactMap {
                family -> StoryboardScenarioFamilySummary? in
                guard let familyId = family["id"] as? String,
                      let familyLabel = family["label"] as? String else { return nil }
                return StoryboardScenarioFamilySummary(
                    id: familyId, label: familyLabel,
                    primaryStyleAnchor: (family["primaryStyleAnchor"] as? String) ?? "object-architecture",
                    variants: options(family["variants"]))
            }
            return StoryboardScenarioPackSummary(
                id: id,
                version: version,
                label: label,
                domain: (pack["domain"] as? String) ?? id,
                description: (pack["description"] as? String) ?? "",
                subdomains: subdomains,
                families: families)
        }
    }

    private static func summarize(
        scene: [String: Any]
    ) throws -> SceneSummary? {
        guard let id = scene["id"] as? String else { return nil }
        let heading = (scene["heading"] as? String)
            ?? (scene["sceneName"] as? String)
            ?? (scene["title"] as? String)
            ?? id
        let frames = try ((scene["storyboardFrames"]
            as? [[String: Any]]) ?? []).compactMap {
            frame -> FrameSummary? in
            guard let frameId = frame["id"] as? String else { return nil }
            let shot = (frame["shotNumber"] as? String) ?? "?"
            let description = (frame["description"] as? String) ?? ""
            let shotType = (frame["shotType"] as? String) ?? (frame["cameraAngle"] as? String)
            let drawingData = frame["drawingData"] as? [String: Any]
            let strokes = drawingData?["strokes"] as? String
            let frameTiming = try FrameTimingWire.decode(frame)
            let cameraMotion = CameraMotionTrackCoding.decode(
                frame["cameraMotionTrack"],
                isPresent: frame.keys.contains("cameraMotionTrack"),
                shotDuration: frameTiming.effectiveDuration)
            let lens = (frame["lensMm"] as? Int) ?? (frame["lensMm"] as? Double).map(Int.init)
            return FrameSummary(
                id: frameId,
                shotNumber: shot,
                detail: [shotType ?? "", description].filter { !$0.isEmpty }.joined(separator: " · "),
                strokesJSON: strokes,
                description: description,
                notes: frame["notes"] as? String,
                shotType: shotType,
                lensMm: lens,
                movement: frame["movement"] as? String,
                durationSec: frameTiming.effectiveDuration.seconds,
                shotDuration: frameTiming.shotDuration,
                durationRevision: frameTiming.durationRevision,
                transition: frame["transition"] as? String,
                focusDepth: frame["focusDepth"] as? String,
                timeOfDay: frame["timeOfDay"] as? String,
                weather: frame["weather"] as? String,
                beatTag: frame["beatTag"] as? String,
                tags: (frame["tags"] as? [String]) ?? [],
                thumbnailDataURL: frame["thumbnailUrl"] as? String,
                drawingWidth: (drawingData?["width"] as? Double)
                    ?? Double(drawingData?["width"] as? Int ?? 1920),
                drawingHeight: (drawingData?["height"] as? Double)
                    ?? Double(drawingData?["height"] as? Int ?? 1080),
                frameStatus: frame["frameStatus"] as? String,
                comments: ((frame["frameComments"] as? [[String: Any]]) ?? []).map { dict in
                    ReviewComment(
                        id: (dict["id"] as? String) ?? UUID().uuidString,
                        role: (dict["role"] as? String) ?? "?",
                        author: (dict["author"] as? String) ?? "",
                        text: (dict["text"] as? String) ?? "",
                        at: (dict["at"] as? String) ?? "",
                        x: dict["x"] as? Double,
                        y: dict["y"] as? Double,
                        parentId: dict["parentId"] as? String,
                        likes: dict["likes"] as? Int,
                        targetX: dict["targetX"] as? Double,
                        targetY: dict["targetY"] as? Double)
                },
                updatedAt: frame["updatedAt"] as? String,
                sourceUpdatedAt: (frame["sourceUpdatedAt"] as? String)
                    ?? (frame["updatedAt"] as? String),
                underlayDataURL: frame["underlayDataURL"] as? String,
                underlayOpacity: (frame["underlayOpacity"] as? Double)
                    ?? (frame["underlayOpacity"] as? Int).map(Double.init),
                perspectiveMode: frame["perspectiveMode"] as? Int,
                vanishingPoints: frame["vanishingPoints"] as? [[Double]],
                voiceoverDataURL: frame["voiceoverDataURL"] as? String,
                imageUrl: frame["imageUrl"] as? String,
                imageSource: frame["imageSource"] as? String,
                reviewPriority: frame["reviewPriority"] as? String,
                reviewDueAt: frame["reviewDueAt"] as? String,
                reviewApprovedBy: frame["reviewApprovedBy"] as? String,
                reviewApprovedAt: frame["reviewApprovedAt"] as? String,
                reviewStarred: (frame["reviewStarred"] as? Bool)
                    ?? (frame["reviewStarred"] as? Int).map { $0 != 0 },
                reviewAssignee: frame["reviewAssignee"] as? String,
                reviewColorLabel: frame["reviewColorLabel"] as? String,
                reviewSnoozedUntil: frame["reviewSnoozedUntil"] as? String,
                setLocation: frame["setLocation"] as? String,
                stageUnit: frame["stageUnit"] as? String,
                reviewFollowers: frame["reviewFollowers"] as? [String],
                scenarioPackId: frame["scenarioPackId"] as? String,
                scenarioPackVersion: frame["scenarioPackVersion"] as? String,
                scenarioSubdomainId: frame["scenarioSubdomainId"] as? String,
                scenarioZoneId: frame["scenarioZoneId"] as? String,
                scenarioRoleIds: frame["scenarioRoleIds"] as? [String] ?? [],
                scenarioPropTypeIds: frame["scenarioPropTypeIds"] as? [String] ?? [],
                scenarioActionIds: frame["scenarioActionIds"] as? [String] ?? [],
                scenarioStateIds: frame["scenarioStateIds"] as? [String] ?? [],
                scenarioContinuityLockIds: frame["scenarioContinuityLockIds"] as? [String] ?? [],
                aiVideoURL: frame["aiVideoURL"] as? String,
                aiVideoJobId: frame["aiVideoJobId"] as? String,
                aiVideoStatus: frame["aiVideoStatus"] as? String,
                aiVideoModel: frame["aiVideoModel"] as? String,
                aiVideoSourceFramingFingerprint:
                    frame["aiVideoSourceFramingFingerprint"] as? String,
                aiVideoSourceRevision:
                    (frame["aiVideoSourceRevision"] as? NSNumber)?.intValue
                    ?? (frame["aiVideoSourceRevision"] as? String).flatMap(Int.init),
                aiVideoSourceUpdatedAt: frame["aiVideoSourceUpdatedAt"] as? String,
                aiVideoSourceFrameUpdatedAt:
                    frame["aiVideoSourceFrameUpdatedAt"] as? String,
                aiVideoSourceBaseVersionId:
                    frame["aiVideoSourceBaseVersionId"] as? String,
                aiVideoSourceStage: frame["aiVideoSourceStage"] as? String,
                aiVideoSourceColorRevision:
                    (frame["aiVideoSourceColorRevision"] as? NSNumber)?.intValue
                    ?? (frame["aiVideoSourceColorRevision"] as? String).flatMap(Int.init),
                aiVideoSourceAtmosphereRevision:
                    (frame["aiVideoSourceAtmosphereRevision"] as? NSNumber)?.intValue
                    ?? (frame["aiVideoSourceAtmosphereRevision"] as? String).flatMap(Int.init),
                aiVideoSourceColorFingerprint:
                    frame["aiVideoSourceColorFingerprint"] as? String,
                aiVideoSourceAtmosphereFingerprint:
                    frame["aiVideoSourceAtmosphereFingerprint"] as? String,
                aiVideoSourceColorHasContent:
                    (frame["aiVideoSourceColorHasContent"] as? Bool)
                        ?? (frame["aiVideoSourceColorHasContent"] as? Int)
                            .map { $0 != 0 },
                aiVideoSourceAtmosphereHasContent:
                    (frame["aiVideoSourceAtmosphereHasContent"] as? Bool)
                        ?? (frame["aiVideoSourceAtmosphereHasContent"] as? Int)
                            .map { $0 != 0 },
                aiVideoSourceCompositeFingerprint:
                    frame["aiVideoSourceCompositeFingerprint"] as? String,
                aiStoryboardId: frame["aiStoryboardId"] as? String,
                layerState: BoardLayerStateCoding.decode(drawingData?["layerState"]),
                angle: frame["angle"] as? String,
                shotFraming: ShotFramingStateCoding.decode(frame["shotFraming"]),
                cameraMotionTrack: cameraMotion.track,
                cameraMotionRevision: CameraMotionTrackCoding.integer(
                    frame["cameraMotionRevision"]),
                cameraMotionUpdatedAt:
                    frame["cameraMotionUpdatedAt"] as? String,
                cameraMotionFingerprint:
                    frame["cameraMotionFingerprint"] as? String,
                cameraMotionBaseFramingFingerprint:
                    frame["cameraMotionBaseFramingFingerprint"] as? String,
                cameraMotionStatus: frame["cameraMotionStatus"] as? String,
                cameraMotionReadState: cameraMotion.state,
                cameraMotionRawJSON: cameraMotion.rawJSON,
                aiOutputStale: (frame["aiOutputStale"] as? Bool)
                    ?? (frame["aiOutputStale"] as? Int).map { $0 != 0 }
                    ?? false,
                aiOutputStaleReason: frame["aiOutputStaleReason"] as? String,
                aiSourceFramingFingerprint: frame["aiSourceFramingFingerprint"] as? String,
                aiRasterPlacementFraming: ShotFramingStateCoding.decode(
                    frame["aiRasterPlacementFraming"]),
                aiColorFramingFingerprint: frame["aiColorFramingFingerprint"] as? String,
                aiAtmosphereFramingFingerprint:
                    frame["aiAtmosphereFramingFingerprint"] as? String,
                aiSourceRevision: (frame["aiSourceRevision"] as? NSNumber)?.intValue
                    ?? (frame["aiSourceRevision"] as? String).flatMap(Int.init),
                aiPaintoverState: StoryboardPaintoverStateCoding.decode(
                    frame["aiPaintoverState"])
            )
        }
        return SceneSummary(
            id: id, heading: heading, frames: frames,
            presentationConcept: scene["presentationConcept"] as? String,
            presentationFooter: scene["presentationFooter"] as? String,
            hubTasks: scene["hubTasks"] as? String,
            hubNotes: scene["hubNotes"] as? String,
            hubQuote: scene["hubQuote"] as? String,
            hubMoodboard: scene["hubMoodboard"] as? String,
            hubMapPositions: scene["hubMapPositions"] as? String,
            hubMapNotes: scene["hubMapNotes"] as? String,
            hubTeam: scene["hubTeam"] as? String,
            hubInfo: scene["hubInfo"] as? String,
            hubAssetFolders: scene["hubAssetFolders"] as? String,
            hubAssetColors: scene["hubAssetColors"] as? String,
            sceneNumber: (scene["sceneNumber"] as? Int) ?? Int(scene["sceneNumber"] as? String ?? ""),
            intExt: (scene["intExt"] as? String) ?? (scene["int_ext"] as? String),
            location: (scene["locationName"] as? String) ?? (scene["location"] as? String),
            timeOfDay: (scene["timeOfDay"] as? String) ?? (scene["time_of_day"] as? String),
            descriptionText: scene["description"] as? String,
            characters: (scene["characters"] as? [String])
                ?? ((scene["characters"] as? [[String: Any]])?.compactMap { $0["name"] as? String })
                ?? [],
            scenarioPackId: scene["scenarioPackId"] as? String,
            scenarioPackVersion: scene["scenarioPackVersion"] as? String,
            scenarioSubdomainId: scene["scenarioSubdomainId"] as? String,
            scenarioZoneId: scene["scenarioZoneId"] as? String,
            scenarioRoleIds: scene["scenarioRoleIds"] as? [String] ?? [],
            scenarioPropTypeIds: scene["scenarioPropTypeIds"] as? [String] ?? [],
            scenarioActionIds: scene["scenarioActionIds"] as? [String] ?? [],
            scenarioStateIds: scene["scenarioStateIds"] as? [String] ?? [],
            scenarioContinuityLockIds: scene["scenarioContinuityLockIds"] as? [String] ?? [])
    }
}
