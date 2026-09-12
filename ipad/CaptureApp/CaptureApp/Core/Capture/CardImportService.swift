import CryptoKit
import Foundation
import GRDB

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

/// Result of importing one group into the local store.
struct ImportedAsset: Sendable {
    let asset: Asset
    /// Originals to back up to B2 (JPEG as `.full`, RAW as `.raw`).
    let backupItems: [DeliveryService.CardBackupItem]
}

enum CardImportError: Error, Sendable, Equatable {
    case notAuthenticated
    case noImportableFiles
    case copyFailed(String)
}

/// Imports memory-card files into the local capture store: scans + pairs
/// RAW/JPEG, de-duplicates against everything already imported (by SHA-256),
/// copies the originals into app storage, and creates the `asset` rows. The
/// B2 backup itself is then driven by ``DeliveryService/backupCard`` using the
/// `backupItems` this produces.
actor CardImportService {
    static let rawExtensions: Set<String> = [
        "cr2", "cr3", "arw", "nef", "raf", "rw2", "orf", "dng", "raw", "srw", "pef", "ra2"
    ]
    static let imageExtensions: Set<String> = ["jpg", "jpeg", "heic", "heif", "png", "tif", "tiff"]

    private let database: AppDatabase
    private let sessionStore: SessionStore

    init(database: AppDatabase) {
        self.database = database
        self.sessionStore = SessionStore(database: database)
    }

    // MARK: - Scan + pair (pure, no actor state)

    /// Walk the picked URLs (files and/or a card/DCIM folder) into media files.
    /// Caller is responsible for `startAccessingSecurityScopedResource()`.
    nonisolated static func scan(urls: [URL]) -> [CardMediaFile] {
        var out: [CardMediaFile] = []
        let fm = FileManager.default
        for url in urls {
            var isDir: ObjCBool = false
            if fm.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue {
                let keys: [URLResourceKey] = [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey]
                if let enumerator = fm.enumerator(at: url, includingPropertiesForKeys: keys) {
                    for case let fileURL as URL in enumerator {
                        if let media = mediaFile(fileURL) { out.append(media) }
                    }
                }
            } else if let media = mediaFile(url) {
                out.append(media)
            }
        }
        return out
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
        guard size > 0 else { return nil }
        return CardMediaFile(
            url: url,
            filename: url.lastPathComponent,
            baseName: url.deletingPathExtension().lastPathComponent.lowercased(),
            ext: ext,
            isRaw: isRaw,
            sizeBytes: size,
            captureTime: values?.contentModificationDate ?? Date(),
        )
    }

    // MARK: - Dedup + session

    /// All SHA-256 checksums already imported for this owner — so re-inserting
    /// the same card skips files we already have.
    func existingChecksums(ownerUserId: String) async throws -> Set<String> {
        try await database.dbWriter.read { db in
            let rows = try String.fetchAll(
                db,
                sql: """
                    SELECT a.checksumSha256 FROM asset a
                      JOIN session s ON a.sessionId = s.id
                     WHERE s.ownerUserId = ? AND a.checksumSha256 IS NOT NULL
                    """,
                arguments: [ownerUserId],
            )
            return Set(rows)
        }
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
        seenChecksums: Set<String>,
    ) async throws -> (imported: ImportedAsset?, checksum: String?) {
        let assetId = UUID()
        let dir = try Self.storageDirectory(sessionId: sessionId)

        // Copy + checksum the display file first (used for dedup).
        let display = group.display
        let displayDest = dir.appendingPathComponent("\(assetId.uuidString).\(display.ext)")
        let displayChecksum = try Self.copyAndChecksum(from: display.url, to: displayDest)

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
        let asset = try await sessionStore.createAsset(sessionId: sessionId, descriptor: descriptor)

        var backupItems: [DeliveryService.CardBackupItem] = []

        // The JPEG (or the only file) becomes the preview + full so it displays
        // in cull / Redigering immediately.
        if let jpeg = group.jpeg {
            let jpegDest = display.url == jpeg.url
                ? displayDest
                : try Self.copyTo(dir: dir, assetId: assetId, file: jpeg)
            try await sessionStore.attachStorageKey(
                id: assetId, kind: .preview, key: jpegDest.path,
                checksumSha256: displayChecksum, sizeBytes: jpeg.sizeBytes,
            )
            try await sessionStore.attachStorageKey(
                id: assetId, kind: .full, key: jpegDest.path,
                checksumSha256: displayChecksum, sizeBytes: jpeg.sizeBytes,
            )
            backupItems.append(.init(
                localId: assetId, originalFilename: jpeg.filename, captureTime: jpeg.captureTime,
                mime: Self.mime(forExtension: jpeg.ext), path: jpegDest.path, kind: .full,
            ))
        }

        // The RAW original is attached + backed up. When there's no JPEG it is
        // also the display file (Redigering renders RAW; cull shows the name).
        if let raw = group.raw {
            let rawDest = display.url == raw.url
                ? displayDest
                : try Self.copyTo(dir: dir, assetId: assetId, file: raw)
            try await sessionStore.attachStorageKey(
                id: assetId, kind: .raw, key: rawDest.path,
                checksumSha256: displayChecksum, sizeBytes: raw.sizeBytes,
            )
            backupItems.append(.init(
                localId: assetId, originalFilename: raw.filename, captureTime: raw.captureTime,
                mime: Self.mime(forExtension: raw.ext), path: rawDest.path, kind: .raw,
            ))
        }

        return (ImportedAsset(asset: asset, backupItems: backupItems), displayChecksum)
    }

    // MARK: - File helpers

    private static func storageDirectory(sessionId: UUID) throws -> URL {
        let base = try FileManager.default
            .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("CaptureApp/card-imports/\(sessionId.uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }

    private static func copyTo(dir: URL, assetId: UUID, file: CardMediaFile) throws -> URL {
        let dest = dir.appendingPathComponent("\(assetId.uuidString).\(file.ext)")
        _ = try copyAndChecksum(from: file.url, to: dest)
        return dest
    }

    /// Stream-copy a file and compute its SHA-256 in the same pass (so large
    /// RAW files are never fully held in memory).
    @discardableResult
    private static func copyAndChecksum(from src: URL, to dest: URL) throws -> String {
        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        guard FileManager.default.createFile(atPath: dest.path, contents: nil) else {
            throw CardImportError.copyFailed("could not create \(dest.lastPathComponent)")
        }
        let input = try FileHandle(forReadingFrom: src)
        let output = try FileHandle(forWritingTo: dest)
        defer { try? input.close(); try? output.close() }
        var hasher = SHA256()
        while true {
            let chunk = input.readData(ofLength: 4 * 1024 * 1024)
            if chunk.isEmpty { break }
            hasher.update(data: chunk)
            output.write(chunk)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
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
        default: return "application/octet-stream"
        }
    }
}
