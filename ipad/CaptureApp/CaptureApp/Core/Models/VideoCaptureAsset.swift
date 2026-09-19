import Foundation

struct VideoCaptureAsset: Codable, Sendable, Equatable, Identifiable {
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
    var takeStatus: String
    var circled: Bool
    var createdAt: Date
    var updatedAt: Date
}
