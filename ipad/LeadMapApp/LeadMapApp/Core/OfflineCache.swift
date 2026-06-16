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

import Foundation

actor OfflineCache {
    static let shared = OfflineCache()

    private let fm = FileManager.default
    private lazy var cacheDir: URL = {
        let docs = fm.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent("OfflineCache", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    // MARK: - Snapshot per data-type

    struct Snapshot<T: Codable>: Codable {
        let fetchedAt: Date
        let payload: T
    }

    func save<T: Codable>(_ value: T, named name: String) async {
        let snapshot = Snapshot(fetchedAt: Date(), payload: value)
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(snapshot)
            try data.write(to: cacheDir.appendingPathComponent("\(name).json"), options: .atomic)
        } catch {
            print("[OfflineCache] save \(name) failed: \(error)")
        }
    }

    func load<T: Codable>(_ type: T.Type, named name: String) async -> (value: T, age: TimeInterval)? {
        let url = cacheDir.appendingPathComponent("\(name).json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let snapshot = try decoder.decode(Snapshot<T>.self, from: data)
            return (snapshot.payload, Date().timeIntervalSince(snapshot.fetchedAt))
        } catch {
            print("[OfflineCache] load \(name) failed: \(error)")
            return nil
        }
    }

    func clear() async {
        try? fm.removeItem(at: cacheDir)
        _ = cacheDir // re-create
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

    func enqueue(leadId: String, body: [String: Any]) async {
        var queue = await loadQueue()
        guard let json = try? JSONSerialization.data(withJSONObject: body) else { return }
        let entry = PendingVisit(id: UUID(), leadId: leadId, bodyJSON: json, queuedAt: Date())
        queue.append(entry)
        await saveQueue(queue)
    }

    func pendingCount() async -> Int {
        await loadQueue().count
    }

    /// Forsøk å flushe pending visits til backend. Fjerner kun de som
    /// gikk gjennom — beholder resten for senere retry.
    func flush(using api: APIClient) async -> (succeeded: Int, failed: Int) {
        var queue = await loadQueue()
        guard !queue.isEmpty else { return (0, 0) }
        var succeeded = 0
        var failed = 0
        var remaining: [PendingVisit] = []
        for entry in queue {
            do {
                guard let body = try JSONSerialization.jsonObject(with: entry.bodyJSON) as? [String: Any] else {
                    failed += 1
                    continue
                }
                try await api.logVisit(leadId: entry.leadId, body: body)
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
