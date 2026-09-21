import Foundation

enum PhotoLocalOriginalRetention {
    enum Failure: LocalizedError, Equatable {
        case uploadNotVerified
        case unmanagedFile

        var errorDescription: String? {
            switch self {
            case .uploadNotVerified:
                "Originalen kan ikke frigjøres før CreatorHub har verifisert opplastingen."
            case .unmanagedFile:
                "CreatorHub vil ikke slette en fil utenfor appens opptaksmappe."
            }
        }
    }

    /// Removes only full/RAW originals below the managed session root. The
    /// lightweight preview and derived edits are never touched, so filmstrip,
    /// compare and offline review continue to work.
    @discardableResult
    static func releaseVerifiedOriginals(
        for asset: Asset,
        managedRoot: URL,
        fileManager: FileManager = .default
    ) throws -> Set<String> {
        guard asset.cloudState == .secured else { throw Failure.uploadNotVerified }
        let protectedPaths = Set([
            asset.previewKey,
            asset.enhancedKey,
            asset.serverEnhancedKey,
            asset.autoCleanedKey,
        ].compactMap { $0 })
        let candidates = Set([asset.fullKey, asset.rawKey].compactMap { $0 })
            .subtracting(protectedPaths)
        guard !candidates.isEmpty else { return [] }

        let root = managedRoot.standardizedFileURL.resolvingSymlinksInPath()
        let validated: [(storedPath: String, url: URL)] = try candidates.map { path in
            let url = URL(fileURLWithPath: path)
                .standardizedFileURL
                .resolvingSymlinksInPath()
            guard url.path.hasPrefix(root.path + "/") else { throw Failure.unmanagedFile }
            return (path, url)
        }

        var released = Set<String>()
        for item in validated {
            if fileManager.fileExists(atPath: item.url.path) {
                try fileManager.removeItem(at: item.url)
            }
            released.insert(item.storedPath)
        }
        return released
    }
}

enum PhotoStorageUsage {
    static func allocatedBytes(
        below root: URL,
        fileManager: FileManager = .default
    ) -> Int64 {
        guard let enumerator = fileManager.enumerator(
            at: root,
            includingPropertiesForKeys: [
                .isRegularFileKey,
                .fileSizeKey,
                .fileAllocatedSizeKey,
                .totalFileAllocatedSizeKey,
            ],
            options: [.skipsHiddenFiles]
        ) else { return 0 }
        var total: Int64 = 0
        for case let url as URL in enumerator {
            guard let values = try? url.resourceValues(forKeys: [
                .isRegularFileKey,
                .fileSizeKey,
                .fileAllocatedSizeKey,
                .totalFileAllocatedSizeKey,
            ]), values.isRegularFile == true else { continue }
            total += Int64(
                values.totalFileAllocatedSize
                    ?? values.fileAllocatedSize
                    ?? values.fileSize
                    ?? 0
            )
        }
        return total
    }

    static func availableBytes(
        at url: URL,
        fileManager: FileManager = .default
    ) -> Int64? {
        let values = try? url.resourceValues(forKeys: [
            .volumeAvailableCapacityForImportantUsageKey,
            .volumeAvailableCapacityKey,
        ])
        return values?.volumeAvailableCapacityForImportantUsage
            ?? values?.volumeAvailableCapacity.map(Int64.init)
    }
}
