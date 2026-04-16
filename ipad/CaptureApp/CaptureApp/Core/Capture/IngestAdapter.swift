import Foundation

protocol IngestAdapter: Actor {
    var adapterId: String { get }
    var events: AsyncStream<IngestEvent> { get }

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
