import CryptoKit
import Foundation

/// Immutable tenant identity captured with a queued save payload. A delayed
/// operation may only reach the network while the editor is still in exactly
/// the same authenticated draft scope; it must never borrow a later org ID.
struct CanvasTenantSnapshot: Equatable, Sendable {
    let scope: String?
    let organizationId: String

    func canSend(currentScope: String?) -> Bool {
        guard let scope else { return false }
        return scope == currentScope
    }
}

/// En liten, MainActor-isolert kø som serialiserer saves per notat, samtidig
/// som forskjellige notater kan lagres uavhengig. Selve save-payloaden lages
/// før jobben legges i kø; køen eier aldri editor-state.
@MainActor
final class CanvasSaveCoordinator {
    private struct Entry {
        let ticket: UUID
        let task: Task<Void, Never>
    }

    private var entries: [String: Entry] = [:]

    var pendingNoteIDs: Set<String> {
        Set(entries.keys)
    }

    @discardableResult
    func enqueue(
        noteID: String,
        operation: @escaping @MainActor () async -> Void
    ) -> Task<Void, Never> {
        let previous = entries[noteID]?.task
        let ticket = UUID()
        let task = Task { @MainActor [weak self] in
            if let previous { await previous.value }
            guard !Task.isCancelled else { return }
            await operation()
            self?.finish(noteID: noteID, ticket: ticket)
        }
        entries[noteID] = Entry(ticket: ticket, task: task)
        return task
    }

    /// Full queue barrier: a job may enqueue a successor while the caller is
    /// waiting. Keep following tickets until the note is genuinely idle.
    func wait(for noteID: String) async {
        while let entry = entries[noteID] {
            await entry.task.value
            guard entries[noteID]?.ticket != entry.ticket else { return }
        }
    }

    func cancel(noteID: String) {
        entries.removeValue(forKey: noteID)?.task.cancel()
    }

    func cancelAll() {
        let tasks = entries.values.map(\.task)
        entries.removeAll()
        tasks.forEach { $0.cancel() }
    }

    private func finish(noteID: String, ticket: UUID) {
        guard entries[noteID]?.ticket == ticket else { return }
        entries.removeValue(forKey: noteID)
    }
}

/// Diskformatet inneholder bare en hash av bruker+organisasjon i filbanen.
/// Selve notatet er komplett (inkludert blekk og vedlegg som ikke er lastet
/// opp ennå), slik at et nettutfall eller en prosessavslutning ikke mister
/// brukerens siste arbeid.
struct CanvasDraftRecord: Codable, Equatable, Sendable {
    let schemaVersion: Int
    let noteID: String
    let generation: Int
    let savedAt: Date
    let encodedNote: Data
}

/// Atomisk og tenant-avgrenset lokal kladdlagring. Actoren serialiserer alle
/// filoperasjoner, mens generation-sjekken hindrer at en sen Task overskriver
/// en nyere kladd.
actor CanvasDraftStore {
    static let shared = CanvasDraftStore()

    private let rootURL: URL?
    private let fileManager: FileManager

    init(rootURL: URL? = nil, fileManager: FileManager = .default) {
        self.fileManager = fileManager
        if let rootURL {
            self.rootURL = rootURL
        } else {
            self.rootURL = try? fileManager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            ).appendingPathComponent("LeadgridCanvasDrafts", isDirectory: true)
        }
    }

    func save(noteID: String, generation: Int,
              encodedNote: Data, scope: String) throws {
        guard !noteID.isEmpty, !scope.isEmpty else { return }
        let directory = try scopeDirectory(scope)
        try fileManager.createDirectory(
            at: directory, withIntermediateDirectories: true)
        var url = fileURL(noteID: noteID, directory: directory)

        if let data = try? Data(contentsOf: url),
           let existing = try? decoder().decode(CanvasDraftRecord.self, from: data),
           existing.generation > generation {
            return
        }

        let record = CanvasDraftRecord(
            schemaVersion: 1,
            noteID: noteID,
            generation: generation,
            savedAt: Date(),
            encodedNote: encodedNote)
        let data = try encoder().encode(record)
        try data.write(to: url, options: .atomic)
        try? fileManager.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: url.path)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? url.setResourceValues(values)
    }

    func load(scope: String) -> [CanvasDraftRecord] {
        guard !scope.isEmpty,
              let directory = try? scopeDirectory(scope),
              let urls = try? fileManager.contentsOfDirectory(
                at: directory,
                includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles])
        else { return [] }

        var records: [CanvasDraftRecord] = []
        for url in urls where url.pathExtension == "canvasdraft" {
            guard let data = try? Data(contentsOf: url),
                  let record = try? decoder().decode(
                    CanvasDraftRecord.self, from: data),
                  record.schemaVersion == 1,
                  !record.noteID.isEmpty else {
                // En korrupt, uleselig kladd skal ikke blokkere alle andre
                // oppstarter. Den kan ikke gjenopprettes, så fjern kun filen.
                try? fileManager.removeItem(at: url)
                continue
            }
            records.append(record)
        }
        return records.sorted { $0.savedAt < $1.savedAt }
    }

    func remove(noteID: String, scope: String,
                upToGeneration: Int? = nil) {
        guard !noteID.isEmpty, !scope.isEmpty,
              let directory = try? scopeDirectory(scope) else { return }
        let url = fileURL(noteID: noteID, directory: directory)
        if let upToGeneration,
           let data = try? Data(contentsOf: url),
           let existing = try? decoder().decode(CanvasDraftRecord.self, from: data),
           existing.generation > upToGeneration {
            return
        }
        try? fileManager.removeItem(at: url)
    }

    private func scopeDirectory(_ scope: String) throws -> URL {
        guard let rootURL else {
            throw CocoaError(.fileNoSuchFile)
        }
        return rootURL.appendingPathComponent(
            Self.digest(scope), isDirectory: true)
    }

    private func fileURL(noteID: String, directory: URL) -> URL {
        directory
            .appendingPathComponent(Self.digest(noteID))
            .appendingPathExtension("canvasdraft")
    }

    private func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        return encoder
    }

    private func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        return decoder
    }

    private nonisolated static func digest(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}
