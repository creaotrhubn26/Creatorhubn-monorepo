// OfflineCache.swift
//
// Codable-JSON cache for Lead Map-data og en pending-queue for
// visit-logs som ikke fikk levert.
//
// Hvorfor ikke GRDB/SwiftData?
//   - Vi skriver hele datasettet på en gang (snapshot per fetch),
//     ikke per rad.
//   - Dataene er små (typisk < 500 leads = ~200 KB JSON).
//   - Codable + JSONEncoder gir 0 ekstern avhengighet.
//   - Visit-queue er en append-only liste i én fil.
//
// Failure-mode: hvis disk er full eller filsystemet feiler, logger
// vi og fortsetter — appen er fortsatt brukbar.

import CryptoKit
import Foundation

actor OfflineCache {
    static let shared = OfflineCache()

    struct Scope: Codable, Sendable, Equatable {
        let actorUserId: String
        let organizationId: String
        let projectId: String

        init?(actorUserId: String?, organizationId: String?, projectId: String?) {
            let actor = actorUserId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let organization = organizationId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let project = projectId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !actor.isEmpty, !organization.isEmpty, !project.isEmpty else { return nil }
            self.actorUserId = actor
            self.organizationId = organization
            self.projectId = project
        }

        fileprivate var storageKey: String {
            let cleartext = [actorUserId, organizationId, projectId]
                .joined(separator: "\u{001F}")
            let digest = SHA256.hash(data: Data(cleartext.utf8))
            return digest.map { String(format: "%02x", $0) }.joined()
        }
    }

    private let allowedSnapshotNames = Set([
        "leads", "competitors", "metrics", "calendar", "reminders",
        "discovery-state",
    ])

    // FileManager er ikke Sendable; bruk lokal lookup inni hver bruk
    // i stedet for å holde stored property på actor.
    private lazy var cacheDir: URL = {
        let fm = FileManager.default
        let docs = fm.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent("OfflineCache", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    // MARK: - Snapshot per data-type

    struct Snapshot<T: Codable>: Codable {
        let scope: Scope
        let fetchedAt: Date
        let payload: T
    }

    private func scopedSnapshotURL(named name: String, scope: Scope) throws -> URL {
        guard allowedSnapshotNames.contains(name) else {
            throw CocoaError(.fileWriteInvalidFileName)
        }
        let fm = FileManager.default
        let directory = cacheDir
            .appendingPathComponent("Snapshots", isDirectory: true)
            .appendingPathComponent(scope.storageKey, isDirectory: true)
        try fm.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("\(name).json", isDirectory: false)
    }

    func save<T: Codable>(_ value: T, named name: String, scope: Scope) async {
        let snapshot = Snapshot(scope: scope, fetchedAt: Date(), payload: value)
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(snapshot)
            let url = try scopedSnapshotURL(named: name, scope: scope)
            try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch {
            print("[OfflineCache] save \(name) failed: \(error)")
        }
    }

    func load<T: Codable>(
        _ type: T.Type,
        named name: String,
        scope: Scope
    ) async -> (value: T, age: TimeInterval)? {
        guard let url = try? scopedSnapshotURL(named: name, scope: scope) else { return nil }
        guard let data = try? Data(contentsOf: url) else { return nil }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let snapshot = try decoder.decode(Snapshot<T>.self, from: data)
            guard snapshot.scope == scope else { return nil }
            return (snapshot.payload, Date().timeIntervalSince(snapshot.fetchedAt))
        } catch {
            print("[OfflineCache] load \(name) failed: \(error)")
            return nil
        }
    }

    /// Legacy snapshots had no account/workspace/project identity. They are
    /// never decoded again; move them aside so a later account cannot see them.
    func quarantineLegacyUnscopedSnapshots() async {
        let fm = FileManager.default
        let quarantineDir = cacheDir.appendingPathComponent("Quarantine", isDirectory: true)
        try? fm.createDirectory(at: quarantineDir, withIntermediateDirectories: true)
        let rootFiles = (try? fm.contentsOfDirectory(
            at: cacheDir,
            includingPropertiesForKeys: nil
        )) ?? []
        let legacyFiles = rootFiles.filter { url in
            guard url.pathExtension.lowercased() == "json" else { return false }
            let stem = url.deletingPathExtension().lastPathComponent
            return allowedSnapshotNames.contains(stem) || stem.hasPrefix("discovery-v2-")
        }
        for source in legacyFiles {
            let stem = source.deletingPathExtension().lastPathComponent
            let destination = quarantineDir.appendingPathComponent(
                "legacy-\(stem)-\(UUID().uuidString.lowercased()).json"
            )
            do {
                try fm.moveItem(at: source, to: destination)
            } catch {
                print("[OfflineCache] quarantine \(stem) failed: \(error)")
            }
        }
    }

    func clear() async {
        // Snapshot data may be cleared on sign-out, but the retired legacy
        // visit queue lacks actor/workspace scope and must be quarantined —
        // never replayed as another user and never deleted silently.
        let files = (try? FileManager.default.contentsOfDirectory(
            at: cacheDir,
            includingPropertiesForKeys: nil)) ?? []
        for file in files where file.lastPathComponent != "pending-visits.json" {
            try? FileManager.default.removeItem(at: file)
        }
    }

    // MARK: - Pending-queue for visit-logs

    /// En visit som ble forsøkt lagret offline. Beholder leadId + body
    /// + lokal-uuid for å håndtere duplikat-prevention ved replay.
    struct PendingVisit: Codable, Identifiable {
        let id: UUID
        let leadId: String
        let bodyJSON: Data
        let queuedAt: Date
    }

    private var pendingQueueURL: URL {
        cacheDir.appendingPathComponent("pending-visits.json")
    }

    @available(*, unavailable, message: "Use actor-bound OfflineActionQueue")
    func enqueue(leadId: String, body: [String: Any]) async {
        var queue = await loadQueue()
        guard let json = try? JSONSerialization.data(withJSONObject: body) else { return }
        let entry = PendingVisit(id: UUID(), leadId: leadId, bodyJSON: json, queuedAt: Date())
        queue.append(entry)
        await saveQueue(queue)
    }

    /// Sendable-vennlig variant — body er ferdig serialisert som Data.
    @available(*, unavailable, message: "Use actor-bound OfflineActionQueue")
    func enqueueRaw(leadId: String, jsonBody: Data) async {
        var queue = await loadQueue()
        let entry = PendingVisit(id: UUID(), leadId: leadId, bodyJSON: jsonBody, queuedAt: Date())
        queue.append(entry)
        await saveQueue(queue)
    }

    func pendingCount() async -> Int {
        await loadQueue().count
    }

    /// Forsøk å flushe pending visits til backend. Fjerner kun de som
    /// gikk gjennom — beholder resten for senere retry.
    @available(*, unavailable, message: "Legacy visits have no actor/workspace scope and must not auto-replay")
    func flush(using api: APIClient) async -> (succeeded: Int, failed: Int) {
        var queue = await loadQueue()
        guard !queue.isEmpty else { return (0, 0) }
        var succeeded = 0
        var failed = 0
        var remaining: [PendingVisit] = []
        for entry in queue {
            do {
                // Bruk Sendable-vennlig raw-variant (Data er Sendable)
                try await api.logVisitRaw(leadId: entry.leadId, jsonBody: entry.bodyJSON)
                succeeded += 1
            } catch {
                failed += 1
                remaining.append(entry)
            }
        }
        queue = remaining
        await saveQueue(queue)
        return (succeeded, failed)
    }

    private func loadQueue() async -> [PendingVisit] {
        guard let data = try? Data(contentsOf: pendingQueueURL) else { return [] }
        return (try? JSONDecoder().decode([PendingVisit].self, from: data)) ?? []
    }

    private func saveQueue(_ queue: [PendingVisit]) async {
        guard let data = try? JSONEncoder().encode(queue) else { return }
        try? data.write(to: pendingQueueURL, options: .atomic)
    }
}
