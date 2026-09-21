import Foundation

/// A verified, non-destructive original from a dual-system field recorder.
/// It is deliberately separate from Sound Room mixes and review versions.
struct ProductionAudioAsset: Codable, Sendable, Equatable, Identifiable {
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
    }

    var id: String
    var ownerUserId: String
    var projectId: String
    var localPath: String
    var fileName: String
    var contentType: String
    var sizeBytes: Int64
    var checksumSha256: String?
    var recordedAt: Date
    var durationMs: Int64?
    var sampleRate: Int?
    var bitDepth: Int?
    var channelCount: Int?
    var channelNamesJson: String
    var timecodeStart: String?
    var timeReferenceSamples: Int64?
    var frameRate: Double?
    var dropFrame: Bool?
    var scene: String?
    var take: String?
    var tape: String?
    var circled: Bool?
    var recorderManufacturer: String?
    var recorderModel: String?
    var recorderSerial: String?
    var notes: String?
    var metadataJson: String
    var captureState: CaptureState
    var uploadObjectId: String?
    var lastError: String?
    var storagePolicy: StoragePolicy
    var createdAt: Date
    var updatedAt: Date

    var channelNames: [String] {
        (try? JSONDecoder().decode([String].self, from: Data(channelNamesJson.utf8))) ?? []
    }

    var metadata: [String: String] {
        (try? JSONDecoder().decode([String: String].self, from: Data(metadataJson.utf8))) ?? [:]
    }
}

struct ProductionAudioInspection: Sendable, Equatable {
    var durationMs: Int64?
    var sampleRate: Int?
    var bitDepth: Int?
    var channelCount: Int?
    var channelNames: [String]
    var timecodeStart: String?
    var timeReferenceSamples: Int64?
    var frameRate: Double?
    var dropFrame: Bool?
    var scene: String?
    var take: String?
    var tape: String?
    var circled: Bool?
    var recorderManufacturer: String?
    var recorderModel: String?
    var recorderSerial: String?
    var notes: String?
    var metadata: [String: String]

    static let empty = ProductionAudioInspection(
        durationMs: nil, sampleRate: nil, bitDepth: nil, channelCount: nil,
        channelNames: [], timecodeStart: nil, timeReferenceSamples: nil,
        frameRate: nil, dropFrame: nil, scene: nil, take: nil, tape: nil,
        circled: nil, recorderManufacturer: nil, recorderModel: nil,
        recorderSerial: nil, notes: nil, metadata: [:]
    )
}
