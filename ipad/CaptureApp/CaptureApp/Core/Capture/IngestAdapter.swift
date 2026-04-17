import Foundation

protocol IngestAdapter: Actor {
    nonisolated var adapterId: String { get }
    nonisolated var events: AsyncStream<IngestEvent> { get }

    func start() async throws
    func stop() async
    func fetch(assetId: UUID, priority: IngestPriority) async throws
}

enum IngestPriority: Int, Comparable, Sendable {
    case preview = 0
    case full = 1
    case raw = 2

    static func < (lhs: IngestPriority, rhs: IngestPriority) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

enum IngestEvent: Sendable {
    case connectionStateChanged(ConnectionState)
    case assetDiscovered(AssetDescriptor)
    case downloadProgress(assetId: UUID, bytesDownloaded: Int64, totalBytes: Int64?)
    case downloadCompleted(assetId: UUID, kind: DownloadKind, fileURL: URL, checksumSha256: String)
    case downloadFailed(assetId: UUID, kind: DownloadKind, error: IngestError)
    case cardContentsEnumerated(assetCount: Int)
    /// Partial camera state diff from the last polling response.
    /// Fields that didn't change this cycle are `nil`; consumers should
    /// accumulate non-nil updates against a persistent snapshot.
    case telemetryUpdated(CameraTelemetry)
}

/// Camera state accumulated from polling diffs — exposed to the UI so it
/// can show live EXIF + battery + storage alongside captured assets.
/// Every field is optional because Canon's polling endpoint only returns
/// what's changed; `nil` from a single diff doesn't mean "the camera
/// stopped reporting" — it means "no delta since the last poll".
struct CameraTelemetry: Sendable, Equatable {
    var batteryLevel: String?
    var apertureValue: String?
    var shutterSpeed: String?
    var isoValue: String?
    var lensName: String?
    var freeSpaceBytes: Int64?
    var totalContentsCount: Int?

    static let empty = CameraTelemetry()

    var isEmpty: Bool {
        batteryLevel == nil
        && apertureValue == nil
        && shutterSpeed == nil
        && isoValue == nil
        && lensName == nil
        && freeSpaceBytes == nil
        && totalContentsCount == nil
    }
}

enum ConnectionState: Sendable, Hashable {
    case disconnected
    case discovering
    case pairing
    case ready
    case reconnecting(attempt: Int)
    case error(String)
}

enum DownloadKind: String, Sendable, Codable {
    case preview
    case full
    case raw
}

struct AssetDescriptor: Sendable, Hashable, Codable {
    let id: UUID
    let originalFilename: String
    let captureTime: Date
    let mime: String
    let sizeBytes: Int64?
}

enum IngestError: Error, Sendable, Equatable {
    case checksumMismatch
    case cameraDisconnected
    case storageFull
    case unsupportedFile(String)
    case transportFailed(String)
}
