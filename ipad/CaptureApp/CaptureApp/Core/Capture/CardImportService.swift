import CryptoKit
@preconcurrency import AVFoundation
import Foundation
import GRDB
import ImageIO
import UniformTypeIdentifiers

/// One media file discovered on a memory card.
struct CardMediaFile: Sendable, Hashable, Identifiable {
    var id: URL { url }
    let url: URL
    let filename: String
    /// Lowercased name without extension — used to pair a RAW with its JPEG.
    let baseName: String
    let ext: String
    let isRaw: Bool
    let sizeBytes: Int64
    let captureTime: Date
    var inspection: CardMediaInspection
}

/// A RAW+JPEG pair (either side may be missing) — one imported asset.
struct CardMediaGroup: Sendable, Identifiable {
    var id: String { baseName }
    let baseName: String
    let jpeg: CardMediaFile?
    let raw: CardMediaFile?
    /// The file shown/culled — the JPEG when present, else the RAW.
    var display: CardMediaFile { jpeg ?? raw! }
    var totalBytes: Int64 { (jpeg?.sizeBytes ?? 0) + (raw?.sizeBytes ?? 0) }
}

/// One video file discovered on a memory card. It is deliberately separate
/// from `CardMediaFile`: video clips are never paired by basename and enter
/// the native take store instead of the photo asset table.
struct CardVideoFile: Sendable, Hashable, Identifiable {
    var id: URL { url }
    let url: URL
    let filename: String
    let ext: String
    let sizeBytes: Int64
    let recordedAt: Date
    var inspection: CardMediaInspection
}

/// One original from a field recorder. WAV/BWF metadata is inspected only
/// after the verified local copy exists, so scanning never reads large bodies.
struct CardAudioFile: Sendable, Hashable, Identifiable {
    var id: URL { url }
    let url: URL
    let filename: String
    let ext: String
    let sizeBytes: Int64
    let recordedAt: Date
    var inspection: CardMediaInspection
}

struct CardAuxiliaryFile: Sendable, Hashable {
    let url: URL
    let pairingKey: String
    let isProxy: Bool
}

struct CardScanResult: Sendable {
    let photos: [CardMediaFile]
    let videos: [CardVideoFile]
    let audios: [CardAudioFile]
    let unsupportedFileCount: Int
    let sidecarFileCount: Int
    let proxyFileCount: Int
    let cardName: String
    let cardIdentifier: String
    let capacityBytes: Int64?
    let availableBytes: Int64?

    var photoGroups: [CardMediaGroup] { CardImportService.group(photos) }
    var totalBytes: Int64 {
        photos.reduce(0) { $0 + $1.sizeBytes }
            + videos.reduce(0) { $0 + $1.sizeBytes }
            + audios.reduce(0) { $0 + $1.sizeBytes }
    }
}

/// Result of importing one group into the local store.
struct ImportedAsset: Sendable {
    let asset: Asset
    /// Originals to back up to CreatorHub S3 (JPEG as `.full`, RAW as `.raw`).
    let backupItems: [DeliveryService.CardBackupItem]
    let sourceChecksums: [URL: String]
}

enum CardImportError: Error, Sendable, Equatable {
    case notAuthenticated
    case noImportableFiles
    case copyFailed(String)
}

/// Imports memory-card files into the local capture store: scans + pairs
/// RAW/JPEG, de-duplicates against everything already imported (by SHA-256),
/// copies the originals into app storage, and creates the `asset` rows. The
/// CreatorHub S3 backup is then driven by ``DeliveryService/backupCard`` using the
/// `backupItems` this produces.
actor CardImportService {
    static let rawExtensions: Set<String> = [
        "cr2", "cr3", "arw", "nef", "raf", "rw2", "orf", "dng", "raw", "srw", "pef", "ra2"
    ]
    static let imageExtensions: Set<String> = ["jpg", "jpeg", "heic", "heif", "png", "tif", "tiff"]
    static let videoExtensions: Set<String> = ["mov", "mp4", "m4v", "mxf", "crm"]
    static let audioExtensions: Set<String> = [
        "wav", "wave", "bwf", "aif", "aiff", "flac", "m4a", "aac", "mp3", "ogg"
    ]

    private let database: AppDatabase
    private let sessionStore: SessionStore
    private let videoStore: VideoCaptureStore
    private let audioStore: ProductionAudioStore

    init(database: AppDatabase) {
        self.database = database
        self.sessionStore = SessionStore(database: database)
        self.videoStore = VideoCaptureStore(database: database)
        self.audioStore = ProductionAudioStore(database: database)
    }

    // MARK: - Scan + pair (pure, no actor state)

    /// Walk the picked URLs (files and/or a card/DCIM folder) into media files.
    /// Caller is responsible for `startAccessingSecurityScopedResource()`.
    nonisolated static func scan(urls: [URL]) -> [CardMediaFile] {
        scanAll(urls: urls).photos
    }

    /// Recursively classify a picked card/folder without reading file bodies.
    /// Regular files with a supported extension and non-zero size are included;
    /// macOS metadata and unknown camera sidecars are counted, never imported.
    nonisolated static func scanAll(urls: [URL]) -> CardScanResult {
        var photos: [CardMediaFile] = []
        var videos: [CardVideoFile] = []
        var audios: [CardAudioFile] = []
        var auxiliaries: [CardAuxiliaryFile] = []
        var unsupported = 0
        let fm = FileManager.default
        func classify(_ fileURL: URL) {
            guard !fileURL.hasDirectoryPath else { return }
            if let media = mediaFile(fileURL) {
                photos.append(media)
            } else if let video = videoFile(fileURL) {
                videos.append(video)
            } else if let audio = audioFile(fileURL) {
                audios.append(audio)
            } else if let auxiliary = auxiliaryFile(fileURL) {
                auxiliaries.append(auxiliary)
            } else if (try? fileURL.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true {
                unsupported += 1
            }
        }
        for url in urls {
            var isDir: ObjCBool = false
            if fm.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue {
                let keys: [URLResourceKey] = [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey]
                if let enumerator = fm.enumerator(at: url, includingPropertiesForKeys: keys) {
                    for case let fileURL as URL in enumerator {
                        classify(fileURL)
                    }
                }
            } else {
                classify(url)
            }
        }
        let proxyKeys = Set(
            videos.filter { $0.inspection.isProxy }.map { CardMediaInspector.pairingKey($0.url) }
                + auxiliaries.filter(\.isProxy).map(\.pairingKey)
        )
        let sidecarCounts = Dictionary(grouping: auxiliaries.filter { !$0.isProxy }, by: \.pairingKey)
            .mapValues(\.count)
        photos = photos.map { photo in
            var copy = photo
            copy.inspection.sidecarCount = sidecarCounts[CardMediaInspector.pairingKey(photo.url)] ?? 0
            return copy
        }
        videos = videos.map { video in
            var copy = video
            let key = CardMediaInspector.pairingKey(video.url)
            if !copy.inspection.isProxy {
                copy.inspection.proxyState = proxyKeys.contains(key) ? .originalWithProxy : .originalMissingProxy
            }
            copy.inspection.sidecarCount = sidecarCounts[key] ?? 0
            return copy
        }
        audios = audios.map { audio in
            var copy = audio
            copy.inspection.sidecarCount = sidecarCounts[CardMediaInspector.pairingKey(audio.url)] ?? 0
            return copy
        }
        let allIdentityFiles = photos.map { ("p", $0.url, $0.sizeBytes) }
            + videos.map { ("v", $0.url, $0.sizeBytes) }
            + audios.map { ("a", $0.url, $0.sizeBytes) }
        let signatureEntries = allIdentityFiles.map { kind, url, size in
            "\(kind)|\(url.lastPathComponent.lowercased())|\(size)|\(sampleFingerprint(url))"
        }
        let card = cardIdentity(for: urls, contentEntries: signatureEntries)
        return CardScanResult(
            photos: photos.sorted { $0.captureTime < $1.captureTime },
            videos: videos.sorted { $0.recordedAt < $1.recordedAt },
            audios: audios.sorted { $0.recordedAt < $1.recordedAt },
            unsupportedFileCount: unsupported,
            sidecarFileCount: auxiliaries.filter { !$0.isProxy }.count,
            proxyFileCount: videos.filter { $0.inspection.isProxy }.count + auxiliaries.filter(\.isProxy).count,
            cardName: card.name,
            cardIdentifier: card.identifier,
            capacityBytes: card.capacity,
            availableBytes: card.available
        )
    }

    private nonisolated static func cardIdentity(
        for urls: [URL],
        contentEntries: [String]
    ) -> (name: String, identifier: String, capacity: Int64?, available: Int64?) {
        let fallbackName = urls.first?.deletingPathExtension().lastPathComponent ?? "Minnekort"
        let contentSignature = stableContentSignature(contentEntries)
        guard let url = urls.first,
              let values = try? url.resourceValues(forKeys: [
                .volumeNameKey,
                .volumeIdentifierKey,
                .volumeTotalCapacityKey,
                .volumeAvailableCapacityKey
              ])
        else {
            return (
                fallbackName,
                stableIdentifier(name: fallbackName, capacity: nil, volumeIdentifier: nil, contentSignature: contentSignature),
                nil,
                nil
            )
        }
        let name = values.volumeName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedName = (name?.isEmpty == false ? name : nil) ?? fallbackName
        let capacity = values.volumeTotalCapacity.map(Int64.init)
        let available = values.volumeAvailableCapacity.map(Int64.init)
        let systemIdentifier = values.volumeIdentifier.map { String(describing: $0) }
        let identifier = stableIdentifier(
            name: resolvedName,
            capacity: capacity,
            volumeIdentifier: systemIdentifier,
            contentSignature: contentSignature
        )
        return (resolvedName, identifier, capacity, available)
    }

    nonisolated static func stableIdentifier(
        name: String,
        capacity: Int64?,
        volumeIdentifier: String?,
        contentSignature: String
    ) -> String {
        // Prefer the filesystem's stable volume identity so adding new takes
        // does not make the same physical card look new. Some document
        // providers hide it; only then use a sampled manifest to distinguish
        // equally named/equally sized cards.
        let seed: String
        if let volumeIdentifier, !volumeIdentifier.isEmpty {
            seed = "v3|volume|\(volumeIdentifier)|\(capacity ?? -1)"
        } else {
            // The label is intentionally excluded: renaming a card must not
            // change its identity. The sampled content separates equal Canon
            // cards and changes when a card is formatted and reused.
            seed = "v4|fallback|\(capacity ?? -1)|\(contentSignature)"
        }
        let digest = SHA256.hash(data: Data(seed.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private nonisolated static func stableContentSignature(_ entries: [String]) -> String {
        let sorted = entries.sorted()
        // Camera cards normally append monotonically named files. Anchoring to
        // the first entries keeps identity stable as new takes are added while
        // their sampled bytes still distinguish otherwise identical cards.
        let sample = Array(sorted.prefix(24))
        let seed = sample.joined(separator: "\n")
        return SHA256.hash(data: Data(seed.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    /// Pair RAW + JPEG siblings (same base name) into groups.
    nonisolated static func group(_ files: [CardMediaFile]) -> [CardMediaGroup] {
        var byBase: [String: (jpeg: CardMediaFile?, raw: CardMediaFile?)] = [:]
        for file in files {
            var entry = byBase[file.baseName] ?? (nil, nil)
            if file.isRaw {
                if entry.raw == nil { entry.raw = file }
            } else if entry.jpeg == nil {
                entry.jpeg = file
            }
            byBase[file.baseName] = entry
        }
        return byBase
            .compactMap { base, pair -> CardMediaGroup? in
                guard pair.jpeg != nil || pair.raw != nil else { return nil }
                return CardMediaGroup(baseName: base, jpeg: pair.jpeg, raw: pair.raw)
            }
            .sorted { $0.display.captureTime < $1.display.captureTime }
    }

    private nonisolated static func mediaFile(_ url: URL) -> CardMediaFile? {
        let ext = url.pathExtension.lowercased()
        let isRaw = rawExtensions.contains(ext)
        guard isRaw || imageExtensions.contains(ext) else { return nil }
        let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        let size = Int64(values?.fileSize ?? 0)
        return CardMediaFile(
            url: url,
            filename: url.lastPathComponent,
            baseName: url.deletingPathExtension().lastPathComponent.lowercased(),
            ext: ext,
            isRaw: isRaw,
            sizeBytes: size,
            captureTime: values?.contentModificationDate ?? Date(),
            inspection: CardMediaInspector.inspectImage(url: url, isRaw: isRaw, sizeBytes: size)
        )
    }

    private nonisolated static func videoFile(_ url: URL) -> CardVideoFile? {
        let ext = url.pathExtension.lowercased()
        guard videoExtensions.contains(ext) else { return nil }
        let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        let size = Int64(values?.fileSize ?? 0)
        return CardVideoFile(
            url: url,
            filename: url.lastPathComponent,
            ext: ext,
            sizeBytes: size,
            recordedAt: values?.contentModificationDate ?? Date(),
            inspection: CardMediaInspector.inspectVideo(url: url, sizeBytes: size)
        )
    }

    private nonisolated static func audioFile(_ url: URL) -> CardAudioFile? {
        let ext = url.pathExtension.lowercased()
        guard audioExtensions.contains(ext) else { return nil }
        let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        let size = Int64(values?.fileSize ?? 0)
        return CardAudioFile(
            url: url,
            filename: url.lastPathComponent,
            ext: ext,
            sizeBytes: size,
            recordedAt: values?.contentModificationDate ?? Date(),
            inspection: CardMediaInspector.inspectAudio(url: url, sizeBytes: size)
        )
    }

    private nonisolated static func auxiliaryFile(_ url: URL) -> CardAuxiliaryFile? {
        let ext = url.pathExtension.lowercased()
        let isProxy = CardMediaInspector.proxyOnlyExtensions.contains(ext) || CardMediaInspector.isProxyURL(url)
        guard isProxy || CardMediaInspector.sidecarExtensions.contains(ext) else { return nil }
        return CardAuxiliaryFile(
            url: url,
            pairingKey: CardMediaInspector.pairingKey(url),
            isProxy: isProxy
        )
    }

    /// Reads at most 8 KiB per candidate for fallback card identity. This is
    /// intentionally not the integrity checksum used for import verification.
    private nonisolated static func sampleFingerprint(_ url: URL) -> String {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return "unreadable" }
        defer { try? handle.close() }
        let head = (try? handle.read(upToCount: 4_096)) ?? Data()
        let size = (try? handle.seekToEnd()) ?? 0
        let tailOffset = size > 4_096 ? size - 4_096 : 0
        try? handle.seek(toOffset: tailOffset)
        let tail = (try? handle.read(upToCount: 4_096)) ?? Data()
        var sampled = Data()
        sampled.append(head)
        sampled.append(tail)
        return SHA256.hash(data: sampled).map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Dedup + session

    /// All SHA-256 checksums already imported for this owner — so re-inserting
    /// the same card skips files we already have.
    func existingChecksums(ownerUserId: String) async throws -> Set<String> {
        try await database.dbWriter.read { db in
            let rows = try String.fetchAll(
                db,
                sql: """
                    SELECT a.checksumSha256 AS checksum FROM asset a
                      JOIN session s ON a.sessionId = s.id
                     WHERE s.ownerUserId = ? AND a.checksumSha256 IS NOT NULL
                    UNION
                    SELECT checksumSha256 AS checksum FROM cardImportedFile
                     WHERE ownerUserId = ?
                    """,
                arguments: [ownerUserId, ownerUserId],
            )
            return Set(rows)
        }
    }

    func existingVideoChecksums(ownerUserId: String) async throws -> Set<String> {
        try await database.dbWriter.read { db in
            Set(try String.fetchAll(
                db,
                sql: """
                    SELECT checksumSha256 AS checksum FROM videoCaptureAsset
                     WHERE ownerUserId = ? AND checksumSha256 IS NOT NULL
                    UNION
                    SELECT checksumSha256 AS checksum FROM cardImportedFile
                     WHERE ownerUserId = ? AND videoAssetId IS NOT NULL
                    """,
                arguments: [ownerUserId, ownerUserId]
            ))
        }
    }

    func existingAudioChecksums(ownerUserId: String) async throws -> Set<String> {
        try await database.dbWriter.read { db in
            Set(try String.fetchAll(
                db,
                sql: """
                    SELECT checksumSha256 AS checksum FROM productionAudioAsset
                     WHERE ownerUserId = ? AND checksumSha256 IS NOT NULL
                    UNION
                    SELECT checksumSha256 AS checksum FROM cardImportedFile
                     WHERE ownerUserId = ? AND audioAssetId IS NOT NULL
                    """,
                arguments: [ownerUserId, ownerUserId]
            ))
        }
    }

    /// Filename + byte-size is intentionally only a preflight hint. The item
    /// is not skipped until the full source SHA-256 confirms a real duplicate.
    func existingImportSignatures(ownerUserId: String) async throws -> Set<String> {
        try await database.dbWriter.read { db in
            Set(try String.fetchAll(
                db,
                sql: """
                    SELECT lower(originalFilename) || '|' || sizeBytes
                      FROM cardImportedFile WHERE ownerUserId = ?
                    """,
                arguments: [ownerUserId]
            ))
        }
    }

    nonisolated static func importSignature(filename: String, sizeBytes: Int64) -> String {
        "\(filename.lowercased())|\(sizeBytes)"
    }

    func createImportSession(name: String, ownerUserId: String) async throws -> Session {
        try await sessionStore.createSession(name: name, clientId: nil, ownerUserId: ownerUserId)
    }

    // MARK: - Import one group

    /// Copy a group's originals into app storage, checksum + de-dup, and create
    /// the asset row. Returns `nil` when the group's display file is a duplicate
    /// of something already imported (the copied file is removed). The returned
    /// checksum should be added to the caller's running `seen` set.
    func importGroup(
        _ group: CardMediaGroup,
        into sessionId: UUID,
        ownerUserId: String,
        seenChecksums: Set<String>,
        storagePolicy: Asset.StoragePolicy = .keepLocalAndCloud,
        onBytesCopied: (@Sendable (Int64) -> Void)? = nil,
        onFileBytesCopied: (@Sendable (URL, Int64) -> Void)? = nil,
    ) async throws -> (imported: ImportedAsset?, checksum: String?) {
        let assetId = UUID()
        let dir = try Self.photoStorageDirectory(sessionId: sessionId)

        // Copy + checksum the display file first (used for dedup).
        let display = group.display
        let displayDest = dir.appendingPathComponent("\(assetId.uuidString).\(display.ext)")
        let displayChecksum = try Self.copyAndChecksum(
            from: display.url,
            to: displayDest,
            onBytesCopied: Self.progress(for: display.url, aggregate: onBytesCopied, file: onFileBytesCopied)
        )

        if seenChecksums.contains(displayChecksum) {
            try? FileManager.default.removeItem(at: displayDest)
            return (nil, displayChecksum)
        }

        let descriptor = AssetDescriptor(
            id: assetId,
            originalFilename: display.filename,
            captureTime: display.captureTime,
            mime: Self.mime(forExtension: display.ext),
            sizeBytes: display.sizeBytes,
        )
        let asset = try await sessionStore.createAsset(
            sessionId: sessionId,
            descriptor: descriptor,
            storagePolicy: storagePolicy
        )

        do {
            var backupItems: [DeliveryService.CardBackupItem] = []
            var sourceFingerprints: [(checksum: String, file: CardMediaFile)] = []

        // The JPEG (or the only file) becomes the preview + full so it displays
        // in cull / Redigering immediately.
        if let jpeg = group.jpeg {
            let jpegDest: URL
            let jpegChecksum: String
            if display.url == jpeg.url {
                jpegDest = displayDest
                jpegChecksum = displayChecksum
            } else {
                jpegDest = dir.appendingPathComponent("\(assetId.uuidString).\(jpeg.ext)")
                jpegChecksum = try Self.copyAndChecksum(
                    from: jpeg.url,
                    to: jpegDest,
                    onBytesCopied: Self.progress(for: jpeg.url, aggregate: onBytesCopied, file: onFileBytesCopied)
                )
            }
            sourceFingerprints.append((jpegChecksum, jpeg))
            let previewDest = dir.appendingPathComponent("\(assetId.uuidString)-preview.jpg")
            let previewChecksum: String
            do {
                previewChecksum = try Self.makeDisplayPreview(from: jpegDest, to: previewDest)
            } catch {
                // A new/odd image codec must not invalidate an otherwise
                // verified original. Keep a distinct fallback copy so a later
                // cloud-only release can still remove only the full original.
                previewChecksum = try Self.copyAndChecksum(from: jpegDest, to: previewDest)
            }
            let previewSize = try Self.fileSize(previewDest)
            try await sessionStore.attachStorageKey(
                id: assetId, kind: .preview, key: previewDest.path,
                checksumSha256: previewChecksum, sizeBytes: previewSize,
            )
            try await sessionStore.attachStorageKey(
                id: assetId, kind: .full, key: jpegDest.path,
                checksumSha256: jpegChecksum, sizeBytes: jpeg.sizeBytes,
            )
            backupItems.append(.init(
                localId: assetId, originalFilename: jpeg.filename, captureTime: jpeg.captureTime,
                mime: "image/jpeg", path: previewDest.path, kind: .preview,
            ))
            backupItems.append(.init(
                localId: assetId, originalFilename: jpeg.filename, captureTime: jpeg.captureTime,
                mime: Self.mime(forExtension: jpeg.ext), path: jpegDest.path, kind: .full,
            ))
        }

        // The RAW original is attached + backed up. When there's no JPEG it is
        // also the display file (Redigering renders RAW; cull shows the name).
        if let raw = group.raw {
            let rawDest: URL
            let rawChecksum: String
            if display.url == raw.url {
                rawDest = displayDest
                rawChecksum = displayChecksum
            } else {
                rawDest = dir.appendingPathComponent("\(assetId.uuidString).\(raw.ext)")
                rawChecksum = try Self.copyAndChecksum(
                    from: raw.url,
                    to: rawDest,
                    onBytesCopied: Self.progress(for: raw.url, aggregate: onBytesCopied, file: onFileBytesCopied)
                )
            }
            sourceFingerprints.append((rawChecksum, raw))
            try await sessionStore.attachStorageKey(
                id: assetId, kind: .raw, key: rawDest.path,
                checksumSha256: rawChecksum, sizeBytes: raw.sizeBytes,
            )
            backupItems.append(.init(
                localId: assetId, originalFilename: raw.filename, captureTime: raw.captureTime,
                mime: Self.mime(forExtension: raw.ext), path: rawDest.path, kind: .raw,
            ))

            // RAW-only cards still need a lightweight local/cloud preview.
            // ImageIO supports the camera RAW types available to the OS; when
            // a newly released format is unsupported, the RAW original remains
            // valid and import succeeds without inventing preview bytes.
            if group.jpeg == nil {
                let previewDest = dir.appendingPathComponent("\(assetId.uuidString)-preview.jpg")
                if let previewChecksum = try? Self.makeDisplayPreview(from: rawDest, to: previewDest),
                   let previewSize = try? Self.fileSize(previewDest) {
                    try await sessionStore.attachStorageKey(
                        id: assetId, kind: .preview, key: previewDest.path,
                        checksumSha256: previewChecksum, sizeBytes: previewSize,
                    )
                    backupItems.insert(.init(
                        localId: assetId, originalFilename: raw.filename,
                        captureTime: raw.captureTime, mime: "image/jpeg",
                        path: previewDest.path, kind: .preview,
                    ), at: 0)
                }
            }
        }

            for fingerprint in sourceFingerprints {
                try await recordFingerprint(
                    ownerUserId: ownerUserId,
                    checksum: fingerprint.checksum,
                    assetId: assetId,
                    videoAssetId: nil,
                    audioAssetId: nil,
                    filename: fingerprint.file.filename,
                    sizeBytes: fingerprint.file.sizeBytes
                )
            }
            return (
                ImportedAsset(
                    asset: asset,
                    backupItems: backupItems,
                    sourceChecksums: Dictionary(
                        uniqueKeysWithValues: sourceFingerprints.map { ($0.file.url, $0.checksum) }
                    )
                ),
                displayChecksum
            )
        } catch {
            // Never expose a half-imported asset. Source media is untouched;
            // only CreatorHub-owned files with this new UUID are removed.
            try? await sessionStore.deleteAsset(id: assetId)
            Self.removeManagedFiles(withPrefix: assetId.uuidString, in: dir)
            throw error
        }
    }

    /// Copy and register one video clip in the same durable store used by
    /// native/UVC recordings. An empty project id means "local field session";
    /// the job binds it to a cached or online project before cloud upload.
    func importVideo(
        _ video: CardVideoFile,
        sessionId: UUID,
        ownerUserId: String,
        projectId: String?,
        takeNumber: Int,
        storagePolicy: VideoCaptureAsset.StoragePolicy,
        seenChecksums: Set<String>,
        onBytesCopied: (@Sendable (Int64) -> Void)? = nil,
        onFileBytesCopied: (@Sendable (URL, Int64) -> Void)? = nil
    ) async throws -> (asset: VideoCaptureAsset?, checksum: String) {
        let id = UUID().uuidString.lowercased()
        let dir = try Self.videoStorageDirectory(sessionId: sessionId)
        let destination = dir.appendingPathComponent("\(id).\(video.ext)")
        let checksum = try Self.copyAndChecksum(
            from: video.url,
            to: destination,
            onBytesCopied: Self.progress(for: video.url, aggregate: onBytesCopied, file: onFileBytesCopied)
        )
        guard !seenChecksums.contains(checksum) else {
            try? FileManager.default.removeItem(at: destination)
            return (nil, checksum)
        }

        let inspected = await CapturedVideoRecording.inspect(
            fileURL: destination,
            recordedAt: video.recordedAt,
            fallbackDurationMs: 0,
            sourceType: .imported,
            cameraName: "Minnekort"
        )
        let now = Date()
        let asset = VideoCaptureAsset(
            id: id,
            ownerUserId: ownerUserId,
            projectId: projectId ?? "",
            localPath: destination.path,
            fileName: video.filename,
            contentType: Self.mime(forExtension: video.ext),
            sizeBytes: video.sizeBytes,
            checksumSha256: checksum,
            sourceType: .imported,
            cameraName: "Minnekort",
            durationMs: inspected.durationMs > 0 ? inspected.durationMs : nil,
            frameRate: inspected.frameRate,
            width: inspected.width,
            height: inspected.height,
            timecodeStart: inspected.timecodeStart,
            recordedAt: video.recordedAt,
            captureState: .local,
            streamState: "pending",
            uploadObjectId: nil,
            streamUid: nil,
            lastError: nil,
            sceneId: nil,
            shotId: nil,
            slate: nil,
            takeNumber: takeNumber,
            takeStatus: .unrated,
            circled: false,
            storagePolicy: storagePolicy,
            createdAt: now,
            updatedAt: now
        )
        do {
            try await videoStore.save(asset)
            try await recordFingerprint(
                ownerUserId: ownerUserId,
                checksum: checksum,
                assetId: nil,
                videoAssetId: id,
                audioAssetId: nil,
                filename: video.filename,
                sizeBytes: video.sizeBytes
            )
        } catch {
            try? FileManager.default.removeItem(at: destination)
            throw error
        }
        return (asset, checksum)
    }

    /// Copy and register one untouched production-audio original. BWF/iXML
    /// metadata is parsed from the verified local copy, never from a file that
    /// may disappear when the removable card is disconnected.
    func importAudio(
        _ audio: CardAudioFile,
        sessionId: UUID,
        ownerUserId: String,
        projectId: String?,
        storagePolicy: ProductionAudioAsset.StoragePolicy,
        seenChecksums: Set<String>,
        onBytesCopied: (@Sendable (Int64) -> Void)? = nil,
        onFileBytesCopied: (@Sendable (URL, Int64) -> Void)? = nil
    ) async throws -> (asset: ProductionAudioAsset?, checksum: String) {
        let id = UUID().uuidString.lowercased()
        let directory = try Self.audioStorageDirectory(sessionId: sessionId)
        let destination = directory.appendingPathComponent("\(id).\(audio.ext)")
        let checksum = try Self.copyAndChecksum(
            from: audio.url,
            to: destination,
            onBytesCopied: Self.progress(for: audio.url, aggregate: onBytesCopied, file: onFileBytesCopied)
        )
        guard !seenChecksums.contains(checksum) else {
            try? FileManager.default.removeItem(at: destination)
            return (nil, checksum)
        }

        let inspection = await ProductionAudioInspector.inspect(fileURL: destination)
        let encoder = JSONEncoder()
        let channelNamesJson = String(
            data: (try? encoder.encode(inspection.channelNames)) ?? Data("[]".utf8),
            encoding: .utf8
        ) ?? "[]"
        let metadataJson = String(
            data: (try? encoder.encode(inspection.metadata)) ?? Data("{}".utf8),
            encoding: .utf8
        ) ?? "{}"
        let now = Date()
        let asset = ProductionAudioAsset(
            id: id,
            ownerUserId: ownerUserId,
            projectId: projectId ?? "",
            localPath: destination.path,
            fileName: audio.filename,
            contentType: Self.mime(forExtension: audio.ext),
            sizeBytes: audio.sizeBytes,
            checksumSha256: checksum,
            recordedAt: audio.recordedAt,
            durationMs: inspection.durationMs,
            sampleRate: inspection.sampleRate,
            bitDepth: inspection.bitDepth,
            channelCount: inspection.channelCount,
            channelNamesJson: channelNamesJson,
            timecodeStart: inspection.timecodeStart,
            timeReferenceSamples: inspection.timeReferenceSamples,
            frameRate: inspection.frameRate,
            dropFrame: inspection.dropFrame,
            scene: inspection.scene,
            take: inspection.take,
            tape: inspection.tape,
            circled: inspection.circled,
            recorderManufacturer: inspection.recorderManufacturer,
            recorderModel: inspection.recorderModel,
            recorderSerial: inspection.recorderSerial,
            notes: inspection.notes,
            metadataJson: metadataJson,
            captureState: .local,
            uploadObjectId: nil,
            lastError: nil,
            storagePolicy: storagePolicy,
            createdAt: now,
            updatedAt: now
        )
        do {
            try await audioStore.save(asset)
            try await recordFingerprint(
                ownerUserId: ownerUserId,
                checksum: checksum,
                assetId: nil,
                videoAssetId: nil,
                audioAssetId: id,
                filename: audio.filename,
                sizeBytes: audio.sizeBytes
            )
        } catch {
            try? FileManager.default.removeItem(at: destination)
            throw error
        }
        return (asset, checksum)
    }

    private func recordFingerprint(
        ownerUserId: String,
        checksum: String,
        assetId: UUID?,
        videoAssetId: String?,
        audioAssetId: String?,
        filename: String,
        sizeBytes: Int64
    ) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    INSERT INTO cardImportedFile
                      (ownerUserId, checksumSha256, assetId, videoAssetId, audioAssetId,
                       originalFilename, sizeBytes, importedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(ownerUserId, checksumSha256) DO NOTHING
                    """,
                arguments: [
                    ownerUserId,
                    checksum,
                    assetId?.uuidString.lowercased(),
                    videoAssetId,
                    audioAssetId,
                    filename,
                    sizeBytes,
                    Date()
                ]
            )
        }
    }

    // MARK: - File helpers

    static func storageDirectory(sessionId: UUID) throws -> URL {
        let base = try FileManager.default
            .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("CaptureApp/card-imports/\(sessionId.uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableBase = base
        try? mutableBase.setResourceValues(values)
        return base
    }

    static func photoStorageDirectory(sessionId: UUID) throws -> URL {
        try mediaStorageDirectory(named: "Foto", sessionId: sessionId)
    }

    static func videoStorageDirectory(sessionId: UUID) throws -> URL {
        try mediaStorageDirectory(named: "Video", sessionId: sessionId)
    }

    static func audioStorageDirectory(sessionId: UUID) throws -> URL {
        try mediaStorageDirectory(named: "Lyd", sessionId: sessionId)
    }

    /// Removes only incomplete temp files inside CreatorHub's own ingest
    /// directory. Originals on the removable card are never touched.
    static func cleanupInterruptedCopies(sessionId: UUID) throws {
        let base = try storageDirectory(sessionId: sessionId)
        guard let enumerator = FileManager.default.enumerator(
            at: base,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else { return }
        for case let url as URL in enumerator where url.pathExtension == "partial" {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private static func mediaStorageDirectory(named name: String, sessionId: UUID) throws -> URL {
        let directory = try storageDirectory(sessionId: sessionId)
            .appendingPathComponent(name, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private static func removeManagedFiles(withPrefix prefix: String, in directory: URL) {
        let files = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )) ?? []
        for file in files where file.lastPathComponent.hasPrefix(prefix) {
            try? FileManager.default.removeItem(at: file)
        }
    }

    private nonisolated static func progress(
        for sourceURL: URL,
        aggregate: (@Sendable (Int64) -> Void)?,
        file: (@Sendable (URL, Int64) -> Void)?
    ) -> (@Sendable (Int64) -> Void)? {
        guard aggregate != nil || file != nil else { return nil }
        return { delta in
            aggregate?(delta)
            file?(sourceURL, delta)
        }
    }

    /// Stream-copy a file and compute its SHA-256 in the same pass (so large
    /// RAW files are never fully held in memory).
    @discardableResult
    private static func copyAndChecksum(
        from src: URL,
        to dest: URL,
        onBytesCopied: (@Sendable (Int64) -> Void)? = nil
    ) throws -> String {
        let partial = dest.appendingPathExtension("partial")
        if FileManager.default.fileExists(atPath: partial.path) {
            try FileManager.default.removeItem(at: partial)
        }
        guard FileManager.default.createFile(atPath: partial.path, contents: nil) else {
            throw CardImportError.copyFailed("could not create \(partial.lastPathComponent)")
        }
        let input = try FileHandle(forReadingFrom: src)
        let output = try FileHandle(forWritingTo: partial)
        do {
            var hasher = SHA256()
            while true {
                let chunk = input.readData(ofLength: 4 * 1024 * 1024)
                if chunk.isEmpty { break }
                hasher.update(data: chunk)
                output.write(chunk)
                onBytesCopied?(Int64(chunk.count))
            }
            try output.synchronize()
            try input.close()
            try output.close()

            let sourceChecksum = hasher.finalize().map { String(format: "%02x", $0) }.joined()
            let copiedChecksum = try sha256(partial)
            guard copiedChecksum == sourceChecksum else {
                throw CardImportError.copyFailed("checksum stemte ikke for \(src.lastPathComponent)")
            }
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.moveItem(at: partial, to: dest)
            return sourceChecksum
        } catch {
            try? input.close()
            try? output.close()
            try? FileManager.default.removeItem(at: partial)
            throw error
        }
    }

    private static func makeDisplayPreview(from source: URL, to destination: URL) throws -> String {
        guard let imageSource = CGImageSourceCreateWithURL(source as CFURL, nil),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(
                imageSource,
                0,
                [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                    kCGImageSourceThumbnailMaxPixelSize: 2_048
                ] as CFDictionary
              ),
              let writer = CGImageDestinationCreateWithURL(
                destination as CFURL,
                UTType.jpeg.identifier as CFString,
                1,
                nil
              )
        else { throw CardImportError.copyFailed("kunne ikke lage bildepreview") }
        CGImageDestinationAddImage(
            writer,
            thumbnail,
            [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary
        )
        guard CGImageDestinationFinalize(writer) else {
            throw CardImportError.copyFailed("kunne ikke skrive bildepreview")
        }
        return try sha256(destination)
    }

    private static func fileSize(_ url: URL) throws -> Int64 {
        let values = try url.resourceValues(forKeys: [.fileSizeKey])
        guard let size = values.fileSize, size > 0 else {
            throw CardImportError.copyFailed("tom lokal fil \(url.lastPathComponent)")
        }
        return Int64(size)
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

    static func availableCapacity() -> Int64? {
        guard let documents = try? FileManager.default.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ) else { return nil }
        let values = try? documents.resourceValues(forKeys: [
            .volumeAvailableCapacityForImportantUsageKey,
            .volumeAvailableCapacityKey
        ])
        return values?.volumeAvailableCapacityForImportantUsage
            ?? values?.volumeAvailableCapacity.map(Int64.init)
    }

    static func mime(forExtension ext: String) -> String {
        switch ext.lowercased() {
        case "jpg", "jpeg": return "image/jpeg"
        case "heic", "heif": return "image/heic"
        case "png": return "image/png"
        case "tif", "tiff": return "image/tiff"
        case "cr2": return "image/x-canon-cr2"
        case "cr3": return "image/x-canon-cr3"
        case "arw": return "image/x-sony-arw"
        case "nef": return "image/x-nikon-nef"
        case "raf": return "image/x-fuji-raf"
        case "rw2": return "image/x-panasonic-rw2"
        case "orf": return "image/x-olympus-orf"
        case "dng": return "image/x-adobe-dng"
        case "mov": return "video/quicktime"
        case "mp4", "m4v": return "video/mp4"
        case "mxf": return "application/mxf"
        case "crm": return "video/x-canon-crm"
        case "wav", "wave", "bwf": return "audio/wav"
        case "aif", "aiff": return "audio/aiff"
        case "flac": return "audio/flac"
        case "m4a": return "audio/x-m4a"
        case "aac": return "audio/aac"
        case "mp3": return "audio/mpeg"
        case "ogg": return "audio/ogg"
        default: return "application/octet-stream"
        }
    }
}
