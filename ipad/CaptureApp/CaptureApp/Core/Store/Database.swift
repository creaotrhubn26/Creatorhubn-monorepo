import Foundation
import GRDB

struct AppDatabase: Sendable {
    private static let diskOpenLock = NSLock()
    let dbWriter: any DatabaseWriter

    init(_ dbWriter: any DatabaseWriter) throws {
        self.dbWriter = dbWriter
        try Self.migrator.migrate(dbWriter)
    }

    static func openOnDisk(at fileURL: URL) throws -> AppDatabase {
        // GRDB enables WAL while the pool is opened. SQLite requires that
        // journal-mode transition to be exclusive, so serialize construction
        // when multiple SwiftUI surfaces (or app startup services) request the
        // same database at once. Normal reads/writes remain concurrent.
        diskOpenLock.lock()
        defer { diskOpenLock.unlock() }

        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        var configuration = Configuration()
        // DatabasePool already enables WAL, and GRDB enables foreign keys by
        // default. Re-running those PRAGMAs for every connection can require
        // an exclusive lock and made concurrent app/widget startup fail with
        // SQLITE_BUSY on physical iPads. Let GRDB own setup and wait briefly
        // when another CreatorHub connection is finishing a write/migration.
        configuration.busyMode = .timeout(5)
        let pool = try DatabasePool(path: fileURL.path, configuration: configuration)
        return try AppDatabase(pool)
    }

    static func inMemory() throws -> AppDatabase {
        try AppDatabase(DatabaseQueue())
    }

    /// Default on-disk location under the app's Documents directory.
    /// Swap to an App Group container when Files.app integration is wired.
    static func defaultDiskURL() throws -> URL {
        try FileManager.default
            .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("CaptureApp/capture.sqlite")
    }
}
