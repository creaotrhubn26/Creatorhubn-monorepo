import Foundation
import GRDB
import Testing
@testable import CaptureApp

@Suite("App database concurrency")
struct AppDatabaseConcurrencyTests {
    @Test("concurrent app surfaces can open the same database")
    func concurrentOpenUsesGRDBWALSetup() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("capture-db-concurrency-\(UUID().uuidString)", isDirectory: true)
        let url = directory.appendingPathComponent("capture.sqlite")
        defer { try? FileManager.default.removeItem(at: directory) }

        let databases = try await withThrowingTaskGroup(of: AppDatabase.self) { group in
            for _ in 0..<8 {
                group.addTask { try AppDatabase.openOnDisk(at: url) }
            }
            var opened: [AppDatabase] = []
            for try await database in group { opened.append(database) }
            return opened
        }

        #expect(databases.count == 8)
        for database in databases {
            let settings = try await database.dbWriter.read { db in
                (
                    try String.fetchOne(db, sql: "PRAGMA journal_mode"),
                    try Bool.fetchOne(db, sql: "PRAGMA foreign_keys")
                )
            }
            #expect(settings.0 == "wal")
            #expect(settings.1 == true)
        }
    }
}
