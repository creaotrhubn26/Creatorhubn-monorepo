import CryptoKit
import Foundation

actor VideoCaptureUploader {
    private let backend: BackendClient
    private let store: VideoCaptureStore
    private let partUploader: BackgroundMultipartUploader

    init(
        backend: BackendClient,
        store: VideoCaptureStore,
        partUploader: BackgroundMultipartUploader = .shared
    ) {
        self.backend = backend
        self.store = store
        self.partUploader = partUploader
    }

    func upload(_ asset: VideoCaptureAsset) async throws {
        let fileURL = URL(fileURLWithPath: asset.localPath)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            throw UploadFailure.missingLocalFile
        }
        try await store.updateState(
            id: asset.id,
            ownerUserId: asset.ownerUserId,
            state: .hashing
        )
        let checksum = try Self.sha256(fileURL)
        let initiated = try await backend.initiateVideoCapture(
            projectId: asset.projectId,
            body: BackendVideoCaptureInitiateRequest(
                assetId: asset.id,
                fileName: asset.fileName,
                sizeBytes: asset.sizeBytes,
                contentType: asset.contentType,
                checksumSha256: checksum,
                sourceType: asset.sourceType.rawValue,
                recordedAt: ISO8601DateFormatter.capture.string(from: asset.recordedAt),
                durationMs: asset.durationMs,
                frameRate: asset.frameRate,
                width: asset.width,
                height: asset.height,
                timecodeStart: asset.timecodeStart,
                cameraManufacturer: nil,
                cameraModel: asset.cameraName,
                cameraSerial: nil,
                sceneId: asset.sceneId,
                shotId: asset.shotId,
                slate: asset.slate,
                takeNumber: asset.takeNumber,
                forceMultipart: true
            )
        )
        guard let ticket = initiated.upload else {
            try await store.updateState(
                id: asset.id,
                ownerUserId: asset.ownerUserId,
                state: .ready,
                checksumSha256: checksum,
                streamUid: initiated.asset.streamUid,
                streamState: initiated.asset.streamState
            )
            return
        }
        try await store.updateState(
            id: asset.id,
            ownerUserId: asset.ownerUserId,
            state: .uploading,
            checksumSha256: checksum,
            uploadObjectId: ticket.objectId
        )

        let completedParts: [BackendVideoCompletedPart]
        if ticket.strategy == "verified" {
            completedParts = []
        } else if ticket.strategy == "single" {
            guard let rawURL = ticket.uploadUrl, let uploadURL = URL(string: rawURL) else {
                throw UploadFailure.invalidUploadTicket
            }
            _ = try await backend.putVideoCaptureFile(
                url: uploadURL,
                fileURL: fileURL,
                requiredHeaders: ticket.requiredHeaders ?? [:]
            )
            completedParts = []
        } else {
            completedParts = try await uploadMultipart(
                asset: asset,
                fileURL: fileURL,
                ticket: ticket
            )
        }

        try await store.updateState(
            id: asset.id,
            ownerUserId: asset.ownerUserId,
            state: .verifying,
            checksumSha256: checksum,
            uploadObjectId: ticket.objectId
        )
        let completed = try await backend.completeVideoCapture(
            projectId: asset.projectId,
            assetId: asset.id,
            body: BackendVideoCompleteRequest(parts: completedParts)
        )
        try await store.updateState(
            id: asset.id,
            ownerUserId: asset.ownerUserId,
            state: .ready,
            checksumSha256: checksum,
            uploadObjectId: ticket.objectId,
            streamUid: completed.asset.streamUid,
            streamState: completed.asset.streamState
        )
    }

    private func uploadMultipart(
        asset: VideoCaptureAsset,
        fileURL: URL,
        ticket: BackendVideoUploadTicket
    ) async throws -> [BackendVideoCompletedPart] {
        guard let partSize = ticket.partSize, partSize > 0,
              let partCount = ticket.partCount, partCount > 0
        else { throw UploadFailure.invalidUploadTicket }

        let remote = try await backend.videoCaptureUploadStatus(
            projectId: asset.projectId,
            assetId: asset.id
        )
        var completed = Dictionary(uniqueKeysWithValues: remote.uploadedParts.map { part in
            (part.partNumber, BackendVideoCompletedPart(
                partNumber: part.partNumber,
                etag: part.etag,
                checksumSha256: part.checksumSha256 ?? ""
            ))
        })
        let missing = (1...partCount).filter { completed[$0] == nil }

        for offset in stride(from: 0, to: missing.count, by: 100) {
            let numbers = Array(missing[offset..<min(missing.count, offset + 100)])
            let requests = try numbers.map { partNumber -> BackendVideoUploadPartRequest in
                let range = Self.partRange(
                    partNumber: partNumber,
                    partSize: partSize,
                    totalSize: asset.sizeBytes
                )
                return BackendVideoUploadPartRequest(
                    partNumber: partNumber,
                    checksumSha256: try Self.sha256(fileURL, offset: range.offset, length: range.length)
                )
            }
            let signed = try await backend.signVideoCaptureParts(
                projectId: asset.projectId,
                assetId: asset.id,
                body: BackendVideoSignPartsRequest(parts: requests)
            )
            guard signed.parts.map(\.partNumber).sorted() == numbers.sorted() else {
                throw UploadFailure.signedPartsMismatch
            }
            let checksums = Dictionary(uniqueKeysWithValues: requests.map { ($0.partNumber, $0.checksumSha256) })
            for part in signed.parts.sorted(by: { $0.partNumber < $1.partNumber }) {
                guard let destination = URL(string: part.uploadUrl),
                      let checksum = checksums[part.partNumber]
                else { throw UploadFailure.invalidUploadTicket }
                let range = Self.partRange(
                    partNumber: part.partNumber,
                    partSize: partSize,
                    totalSize: asset.sizeBytes
                )
                let etag = try await partUploader.uploadPart(
                    sourceFile: fileURL,
                    offset: range.offset,
                    length: range.length,
                    destination: destination,
                    checkpointId: "video:\(asset.id)",
                    partNumber: part.partNumber,
                    requiredHeaders: part.requiredHeaders
                )
                completed[part.partNumber] = BackendVideoCompletedPart(
                    partNumber: part.partNumber,
                    etag: etag,
                    checksumSha256: checksum
                )
            }
        }

        // Older S3-compatible providers may omit checksum in ListParts. Re-read
        // those small (normally 16 MiB) ranges so completion still verifies.
        for partNumber in 1...partCount {
            guard let part = completed[partNumber] else { throw UploadFailure.incompleteUpload }
            if part.checksumSha256.isEmpty {
                let range = Self.partRange(
                    partNumber: partNumber,
                    partSize: partSize,
                    totalSize: asset.sizeBytes
                )
                completed[partNumber] = BackendVideoCompletedPart(
                    partNumber: partNumber,
                    etag: part.etag,
                    checksumSha256: try Self.sha256(fileURL, offset: range.offset, length: range.length)
                )
            }
        }
        return completed.values.sorted { $0.partNumber < $1.partNumber }
    }

    private static func partRange(partNumber: Int, partSize: Int64, totalSize: Int64) -> (offset: Int64, length: Int64) {
        let offset = Int64(partNumber - 1) * partSize
        return (offset, min(partSize, totalSize - offset))
    }

    private static func sha256(_ url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hasher = SHA256()
        while true {
            let data = try handle.read(upToCount: 4 * 1024 * 1024) ?? Data()
            if data.isEmpty { break }
            hasher.update(data: data)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private static func sha256(_ url: URL, offset: Int64, length: Int64) throws -> String {
        guard offset >= 0, length > 0 else { throw UploadFailure.invalidPartRange }
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        try handle.seek(toOffset: UInt64(offset))
        var remaining = length
        var hasher = SHA256()
        while remaining > 0 {
            let amount = Int(min(remaining, 4 * 1024 * 1024))
            guard let data = try handle.read(upToCount: amount), !data.isEmpty else {
                throw UploadFailure.invalidPartRange
            }
            hasher.update(data: data)
            remaining -= Int64(data.count)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    enum UploadFailure: LocalizedError {
        case missingLocalFile
        case invalidUploadTicket
        case signedPartsMismatch
        case incompleteUpload
        case invalidPartRange

        var errorDescription: String? {
            switch self {
            case .missingLocalFile: "Opptaksfilen finnes ikke lenger på iPaden."
            case .invalidUploadTicket: "Backend returnerte en ugyldig opplastingsplan."
            case .signedPartsMismatch: "Signerte deler samsvarte ikke med opplastingsplanen."
            case .incompleteUpload: "Ikke alle videodelene ble lastet opp."
            case .invalidPartRange: "Videoens multipart-område var ugyldig."
            }
        }
    }
}
