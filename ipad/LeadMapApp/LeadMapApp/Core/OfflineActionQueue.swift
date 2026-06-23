// OfflineActionQueue.swift
//
// Robusthet-pakke 3 (PR feat/leadgrid-robusthet-ipad-offline):
// Persistert kø på disk for write-mutations som ikke kommer gjennom når
// selger er offline i felt (4G-drop). Drainer mot APIClient når
// connectivity returnerer (NetworkMonitor.shared.onConnectivityRestored)
// og ved app-boot.
//
// Brukstilfeller:
//   - acceptRecommendation / dismissRecommendation / executeRecommendation
//   - lead-status-updates / log-visit (kan utvides senere)
//
// MVP: enkel JSON-fil i Documents-katalogen, ikke CoreData/SwiftData.
// 5 retries med eksponentiell backoff (30s, 120s, 270s, 480s, 750s),
// så discard etter siste forsøk for å unngå evig zombie-kø.

import Foundation

actor OfflineActionQueue {
    static let shared = OfflineActionQueue()

    struct PendingAction: Codable, Identifiable, Sendable {
        let id: UUID
        let endpoint: String
        let httpMethod: String
        let bodyJson: Data?
        let createdAt: Date
        var attemptCount: Int
        var lastError: String?
        var nextRetryAt: Date

        init(endpoint: String, httpMethod: String = "POST", bodyJson: Data? = nil) {
            self.id = UUID()
            self.endpoint = endpoint
            self.httpMethod = httpMethod
            self.bodyJson = bodyJson
            self.createdAt = Date()
            self.attemptCount = 0
            self.lastError = nil
            self.nextRetryAt = Date()
        }
    }

    private var queue: [PendingAction] = []
    private let fileURL: URL
    private let maxAttempts = 5

    private init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        self.fileURL = docs.appendingPathComponent("leadgrid-offline-queue.json")
        // Eager-load fra disk uten å gå via actor-isolated metode (synkron init).
        // Vi har eksklusiv tilgang her — ingen race siden ingen andre kan referere
        // self ennå.
        if let data = try? Data(contentsOf: fileURL),
           let decoded = try? Self.makeDecoder().decode([PendingAction].self, from: data) {
            queue = decoded
        }
    }

    // MARK: - Public API

    func enqueue(_ action: PendingAction) {
        queue.append(action)
        persistToDisk()
    }

    func pendingCount() -> Int { queue.count }

    func pendingActions() -> [PendingAction] { queue }

    /// Slett alle pending actions (debug / test).
    func clearAll() {
        queue.removeAll()
        persistToDisk()
    }

    /// Drainer køen mot APIClient. Kalles av NetworkMonitor når connectivity
    /// returnerer, ved app-boot, og periodisk hvis appen er åpen og online.
    ///
    /// - Returns: antall (success, failed) — failed = discarded etter max attempts.
    func drain(api: APIClient) async -> (success: Int, failed: Int) {
        var success = 0
        var failed = 0
        let now = Date()
        let ready = queue.filter { $0.nextRetryAt <= now }
        for var action in ready {
            do {
                _ = try await api.executeRaw(
                    method: action.httpMethod,
                    path: action.endpoint,
                    body: action.bodyJson
                )
                queue.removeAll { $0.id == action.id }
                success += 1
            } catch {
                action.attemptCount += 1
                action.lastError = "\(error)"
                if action.attemptCount >= maxAttempts {
                    // Discard etter 5 forsøk — unngå evig zombie-kø
                    queue.removeAll { $0.id == action.id }
                    failed += 1
                } else {
                    // Eksponentiell backoff: 30s, 120s, 270s, 480s, 750s
                    let delay = 30.0 * pow(Double(action.attemptCount), 2.0)
                    action.nextRetryAt = now.addingTimeInterval(delay)
                    if let idx = queue.firstIndex(where: { $0.id == action.id }) {
                        queue[idx] = action
                    }
                }
            }
        }
        persistToDisk()
        return (success, failed)
    }

    // MARK: - Persistens

    private func loadFromDisk() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        if let decoded = try? Self.makeDecoder().decode([PendingAction].self, from: data) {
            queue = decoded
        }
    }

    private func persistToDisk() {
        let encoder = Self.makeEncoder()
        if let data = try? encoder.encode(queue) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }

    private static func makeDecoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    private static func makeEncoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }
}
