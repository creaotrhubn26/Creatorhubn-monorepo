import Foundation

struct VideoCaptureAsset: Codable, Sendable, Equatable, Identifiable {
    enum TakeStatus: String, Codable, Sendable, CaseIterable {
        case unrated
        case hold
        case good
        case noGood = "no_good"

        var displayName: String {
            switch self {
            case .unrated: "Umerket"
            case .hold: "KEEP · Hold"
            case .good: "OK · God"
            case .noGood: "NG · Ikke bruk"
            }
        }

        var systemImage: String {
            switch self {
            case .unrated: "minus.circle"
            case .hold: "pause.circle"
            case .good: "checkmark.circle.fill"
            case .noGood: "xmark.circle.fill"
            }
        }
    }

    enum SourceType: String, Codable, Sendable, CaseIterable {
        case ipadCamera = "ipad_camera"
        case uvc
        case canonCCAPI = "canon_ccapi"
        case blackmagicREST = "blackmagic_rest"
        case sonyCompanion = "sony_companion"
        case ndiBridge = "ndi_bridge"
        case imported = "import"
    }

    enum CaptureState: String, Codable, Sendable {
        case local
        case hashing
        case uploading
        case verifying
        case ready
        case failed
    }

    enum StoragePolicy: String, Codable, Sendable, CaseIterable {
        case localOnly = "local_only"
        case keepLocalAndCloud = "local_and_cloud"
        case creatorHubOnly = "creatorhub_only"

        var displayName: String {
            switch self {
            case .localOnly: "Kun iPad"
            case .keepLocalAndCloud: "iPad + CreatorHub"
            case .creatorHubOnly: "Kun CreatorHub etter opplasting"
            }
        }

        var detail: String {
            switch self {
            case .localOnly:
                "Ingen skyopplasting. Originalen blir bare på denne iPaden."
            case .keepLocalAndCloud:
                "Beholder originalen på iPaden etter verifisert opplasting."
            case .creatorHubOnly:
                "Frigjør lokal plass først etter at CreatorHub har verifisert originalen."
            }
        }
    }

    var id: String
    var ownerUserId: String
    var projectId: String
    var localPath: String
    var fileName: String
    var contentType: String
    var sizeBytes: Int64
    var checksumSha256: String?
    var sourceType: SourceType
    var cameraName: String?
    var durationMs: Int64?
    var frameRate: Double?
    var width: Int?
    var height: Int?
    var timecodeStart: String? = nil
    var recordedAt: Date
    var captureState: CaptureState
    var streamState: String
    var uploadObjectId: String?
    var streamUid: String?
    var lastError: String?
    var sceneId: String?
    var shotId: String?
    var slate: String?
    var takeNumber: Int
    var takeStatus: TakeStatus
    var circled: Bool
    var continuityNotes: String? = nil
    var performanceNotes: String? = nil
    var technicalNotes: String? = nil
    var takeMetadataDirty: Bool = false
    var storagePolicy: StoragePolicy = .keepLocalAndCloud
    var createdAt: Date
    var updatedAt: Date
}
