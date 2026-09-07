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
// 5 retries med eksponentiell backoff (30s, 120s, 270s, 480s, 750s).
// Etter siste forsøk beholdes handlingen som permanent feilet til brukeren
// eksplisitt prøver igjen eller fjerner den. Brukerdata slettes aldri stille.

import Foundation

enum OfflineActionIdempotency {
    static func key(
        for action: OfflineActionQueue.PendingAction,
        organizationId: String
    ) -> String {
        if action.endpoint == "/api/admin-room/lead-map/leads"
            || isLeadVisitEndpoint(action.endpoint, method: action.httpMethod) {
            return action.id.uuidString.lowercased()
        }
        return "leadgrid:\(organizationId):\(action.id.uuidString)"
    }

    private static func isLeadVisitEndpoint(_ endpoint: String, method: String) -> Bool {
        guard method.uppercased() == "POST" else { return false }
        let path = String(endpoint.split(separator: "?", maxSplits: 1).first ?? "")
        let prefix = "/api/admin-room/lead-map/leads/"
        let suffix = "/visits"
        guard path.hasPrefix(prefix), path.hasSuffix(suffix) else { return false }
        let leadId = path.dropFirst(prefix.count).dropLast(suffix.count)
        return !leadId.isEmpty && !leadId.contains("/")
    }
}

enum OfflineActionFailureKind: String, Codable, Sendable {
    case validation
    case authorization
    case duplicateConflict
    case notFound
    case permanent
    case retryExhausted
    case missingSecurityScope
}

enum OfflineActionExecutionError: Error, Sendable {
    case permanent(kind: OfflineActionFailureKind, message: String)
    case retryable(message: String)
}

private func classifyOfflineActionError(_ error: Error) -> OfflineActionExecutionError {
    func httpFailure(code: Int, detail: String = "") -> OfflineActionExecutionError {
        let message = (error as? LocalizedError)?.errorDescription ?? String(describing: error)
        if code == 409 && detail.contains("duplicate_conflict") {
            return .permanent(kind: .duplicateConflict, message: "Leaden ligner på en som finnes fra før.")
        }
        switch code {
        case 401, 403:
            return .permanent(kind: .authorization, message: message)
        case 404:
            return .permanent(kind: .notFound, message: message)
        case 400, 409, 422:
            return .permanent(kind: .validation, message: message)
        case 429, 500...599:
            return .retryable(message: message)
        case 400...499:
            return .permanent(kind: .permanent, message: message)
        default:
            return .retryable(message: message)
        }
    }

    guard let apiError = error as? APIError else {
        return .retryable(message: error.localizedDescription)
    }
    switch apiError {
    case .unauthorized, .forbidden:
        return .permanent(kind: .authorization, message: apiError.localizedDescription)
    case .invalidURL, .decodingFailure:
        return .permanent(kind: .permanent, message: apiError.localizedDescription)
    case .duplicateLead:
        return .permanent(kind: .duplicateConflict, message: apiError.localizedDescription)
    case .idempotencyConflict:
        return .permanent(kind: .validation, message: apiError.localizedDescription)
    case .statusCode(let code):
        return httpFailure(code: code)
    case .serverError(let code, let detail):
        return httpFailure(code: code, detail: detail)
    case .networkFailure, .invalidResponse, .tooManyRequests:
        return .retryable(message: apiError.localizedDescription)
    }
}

actor OfflineActionQueue {
    static let shared = OfflineActionQueue()

    struct PendingAction: Codable, Identifiable, Sendable {
        let id: UUID
        /// Tenant-scope ved enqueue. Nil finnes bare på legacy-elementer og
        /// skal aldri draines automatisk under en tilfeldig aktiv tenant.
        let organizationId: String?
        let actorUserId: String?
        let projectId: String?
        let endpoint: String
        let httpMethod: String
        var bodyJson: Data?
        let createdAt: Date
        var attemptCount: Int
        var lastError: String?
        var nextRetryAt: Date
        var permanentlyFailedAt: Date?

        var failureKind: OfflineActionFailureKind?
        init(
            id: UUID = UUID(),
            organizationId: String,
            actorUserId: String? = nil,
            projectId: String? = nil,
            endpoint: String,
            httpMethod: String = "POST",
            bodyJson: Data? = nil,
            createdAt: Date = Date(),
            attemptCount: Int = 0,
            lastError: String? = nil,
            nextRetryAt: Date = Date(),
            permanentlyFailedAt: Date? = nil,
            failureKind: OfflineActionFailureKind? = nil
        ) {
            self.id = id
            self.organizationId = organizationId
            self.actorUserId = actorUserId
            self.projectId = projectId
            self.endpoint = endpoint
            self.httpMethod = httpMethod
            self.bodyJson = bodyJson
            self.createdAt = createdAt
            self.attemptCount = attemptCount
            self.lastError = lastError
            self.nextRetryAt = nextRetryAt
            self.permanentlyFailedAt = permanentlyFailedAt
            self.failureKind = failureKind
        }

        func bound(actorUserId: String, projectId: String? = nil) -> Self {
            .init(
                id: id,
                organizationId: organizationId ?? "",
                actorUserId: actorUserId,
                projectId: projectId ?? self.projectId,
                endpoint: endpoint,
                httpMethod: httpMethod,
                bodyJson: bodyJson,
                createdAt: createdAt,
                attemptCount: attemptCount,
                lastError: lastError,
                nextRetryAt: nextRetryAt,
                permanentlyFailedAt: permanentlyFailedAt,
                failureKind: failureKind)
        }
    }

    private var queue: [PendingAction] = []
    private var drainingBindings: Set<String> = []
    /// Actor reentrancy allows another project drain to run while an HTTP
    /// executor is suspended. Reserve logical actions across every binding.
    private var inFlightActionIds: Set<UUID> = []
    private var drainGenerationByActor: [String: UInt64] = [:]
    private(set) var lastPersistenceError: String?
    private let fileURL: URL
    private let maxAttempts: Int

    /// Internal init gjør køens state-maskin deterministisk testbar uten å
    /// skrive i appens ekte Documents-katalog.
    init(fileURL: URL? = nil, maxAttempts: Int = 5) {
        precondition(maxAttempts > 0)
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        self.fileURL = fileURL ?? docs.appendingPathComponent("leadgrid-offline-queue.json")
        self.maxAttempts = maxAttempts
        // Eager-load fra disk uten å gå via actor-isolated metode (synkron init).
        // Vi har eksklusiv tilgang her — ingen race siden ingen andre kan referere
        // self ennå.
        if let data = try? Data(contentsOf: self.fileURL) {
            do {
                queue = try Self.makeDecoder().decode([PendingAction].self, from: data)
                if Self.markUnsafeEntries(&queue, now: Date()) {
                    let migrated = try Self.makeEncoder().encode(queue)
                    try migrated.write(to: self.fileURL, options: [.atomic, .completeFileProtection])
                }
            } catch {
                let backupURL = self.fileURL
                    .deletingPathExtension()
                    .appendingPathExtension("corrupt-\(UUID().uuidString).json")
                do {
                    try FileManager.default.moveItem(at: self.fileURL, to: backupURL)
                    lastPersistenceError = "Køfilen var korrupt og ble sikkerhetskopiert som \(backupURL.lastPathComponent)."
                } catch let backupError {
                    lastPersistenceError = "Køfilen var korrupt og kunne ikke sikkerhetskopieres: \(backupError.localizedDescription)"
                }
            }
        }
    }

    // MARK: - Public API

    /// Returnerer true bare når handlingen er skrevet varig til disk. Køen
    /// beholdes i minnet ved skrivefeil, men kalleren kan da vise at offline-
    /// garantien ikke er oppfylt i stedet for å rapportere falsk trygghet.
    @discardableResult
    func enqueue(_ action: PendingAction) -> Bool {
        // WatchConnectivity kan levere samme transferUserInfo mer enn én
        // gang. Action-ID er den logiske idempotency-nøkkelen; behold første
        // payload og unngå duplikat i lokal kø.
        guard !queue.contains(where: { $0.id == action.id }) else {
            return persistToDisk()
        }
        var securedAction = action
        _ = Self.markUnsafeEntry(&securedAction, now: Date())
        queue.append(securedAction)
        return persistToDisk()
    }

    func pendingCount(
        organizationId: String,
        actorUserId: String,
        projectId: String
    ) -> Int {
        queue.filter {
            $0.organizationId == organizationId
                && $0.actorUserId == actorUserId
                && Self.isVisible($0, in: projectId)
                && $0.permanentlyFailedAt == nil
        }.count
    }

    func pendingActions() -> [PendingAction] { queue }

    /// Tenant-avgrenset snapshot til det globale synksenteret. Legacy-
    /// handlinger uten organisasjon vises kun når de allerede er permanent
    /// feilet; de må aldri bli tolket som tilhørende aktivt workspace.
    func actions(
        organizationId: String,
        actorUserId: String,
        projectId: String
    ) -> [PendingAction] {
        queue
            .filter {
                $0.organizationId == organizationId
                    && $0.actorUserId == actorUserId
                    && Self.isVisible($0, in: projectId)
            }
            .sorted { $0.createdAt < $1.createdAt }
    }

    func failedCount(
        organizationId: String,
        actorUserId: String,
        projectId: String
    ) -> Int {
        queue.filter {
            $0.organizationId == organizationId
                && $0.actorUserId == actorUserId
                && Self.isVisible($0, in: projectId)
                && $0.permanentlyFailedAt != nil
        }.count
    }

    func failedActions(
        organizationId: String,
        actorUserId: String,
        projectId: String
    ) -> [PendingAction] {
        queue.filter {
            $0.organizationId == organizationId
                && $0.actorUserId == actorUserId
                && Self.isVisible($0, in: projectId)
                && $0.permanentlyFailedAt != nil
        }
    }

    /// Gjør en permanent feilet handling klar for umiddelbart nytt forsøk.
    /// Legacy-elementer uten tenant-scope må fjernes i stedet; å gjette scope
    /// kan skrive kundedata til feil organisasjon.
    @discardableResult
    func retry(
        id: UUID,
        organizationId: String,
        actorUserId: String,
        projectId: String
    ) -> Bool {
        guard let index = queue.firstIndex(where: {
            $0.id == id
                && $0.organizationId == organizationId
                && $0.actorUserId == actorUserId
                && Self.isVisible($0, in: projectId)
                && $0.failureKind != .missingSecurityScope
        }) else { return false }
        queue[index].attemptCount = 0
        queue[index].lastError = nil
        queue[index].failureKind = nil
        queue[index].nextRetryAt = Date()
        queue[index].permanentlyFailedAt = nil
        persistToDisk()
        return true
    }

    /// Eksplisitt, brukerinitiert sletting av én handling.

    /// Duplikatkonflikter krever et eksplisitt brukerklikk. Beholder samme
    /// creationId og kø-ID, setter kun allow_duplicate og gjør klar for retry.
    @discardableResult
    func retryLeadCreationAllowingDuplicate(
        id: UUID,
        organizationId: String,
        actorUserId: String,
        projectId: String
    ) -> Bool {
        guard let index = queue.firstIndex(where: {
            $0.id == id &&
            $0.organizationId == organizationId &&
            $0.actorUserId == actorUserId &&
            $0.projectId == projectId &&
            $0.endpoint == "/api/admin-room/lead-map/leads" &&
            $0.failureKind == .duplicateConflict
        }), let body = queue[index].bodyJson else {
            return false
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        guard var draft = try? decoder.decode(LeadDraft.self, from: body) else { return false }
        draft.allowDuplicate = true
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        guard let updatedBody = try? encoder.encode(draft) else { return false }
        queue[index].bodyJson = updatedBody
        queue[index].attemptCount = 0
        queue[index].lastError = nil
        queue[index].nextRetryAt = Date()
        queue[index].permanentlyFailedAt = nil
        queue[index].failureKind = nil
        return persistToDisk()
    }
    @discardableResult
    func discard(id: UUID) -> Bool {
        let oldCount = queue.count
        queue.removeAll { $0.id == id }
        guard queue.count != oldCount else { return false }
        persistToDisk()
        return true
    }

    /// Slett alle pending actions (debug / test).
    func clearAll() {
        queue.removeAll()
        persistToDisk()
    }

    /// Stops further replay starts for this actor. An already in-flight HTTP
    /// request cannot be unsent; its action remains queued for an idempotent
    /// replay when the same user signs in again.
    func cancelDrains(actorUserId: String) {
        drainGenerationByActor[actorUserId, default: 0] &+= 1
    }

    /// Drainer køen mot APIClient. Kalles av NetworkMonitor når connectivity
    /// returnerer, ved app-boot, og periodisk hvis appen er åpen og online.
    ///
    /// - Returns: antall (success, failed) — failed = flyttet til synlig
    ///   permanent feiltilstand etter max attempts.
    func drain(
        api: APIClient,
        organizationId: String,
        actorUserId: String,
        projectId: String
    ) async -> (success: Int, failed: Int) {
        await drain(
            organizationId: organizationId,
            actorUserId: actorUserId,
            projectId: projectId
        ) { action in
            do {
                _ = try await api.executeRaw(
                    method: action.httpMethod,
                    path: action.endpoint,
                    body: action.bodyJson,
                    idempotencyKey: OfflineActionIdempotency.key(
                        for: action,
                        organizationId: organizationId),
                    organizationId: organizationId
                )
            } catch {
                throw classifyOfflineActionError(error)
            }
        }
    }

    /// Injiserbar executor for deterministiske unit-tester.
    func drain(
        organizationId: String,
        actorUserId: String,
        projectId: String,
        now: Date = Date(),
        execute: @Sendable (PendingAction) async throws -> Void
    ) async -> (success: Int, failed: Int) {
        guard !actorUserId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return (0, 0)
        }
        let binding = organizationId + "\u{1F}" + actorUserId + "\u{1F}" + projectId
        guard drainingBindings.insert(binding).inserted else { return (0, 0) }
        let generation = drainGenerationByActor[actorUserId, default: 0]
        defer { drainingBindings.remove(binding) }

        var success = 0
        var failed = 0
        let readyIds = queue.filter {
            $0.organizationId == organizationId &&
            $0.actorUserId == actorUserId &&
            Self.isDrainable($0, in: projectId) &&
            $0.permanentlyFailedAt == nil &&
            $0.nextRetryAt <= now
        }.map(\.id)
        for id in readyIds {
            guard drainGenerationByActor[actorUserId, default: 0] == generation else { break }
            guard inFlightActionIds.insert(id).inserted else { continue }
            guard let action = queue.first(where: {
                $0.id == id
                    && $0.organizationId == organizationId
                    && $0.actorUserId == actorUserId
                    && Self.isDrainable($0, in: projectId)
            }) else {
                inFlightActionIds.remove(id)
                continue
            }
            do {
                try await execute(action)
                inFlightActionIds.remove(id)
                guard drainGenerationByActor[actorUserId, default: 0] == generation else { break }
                queue.removeAll { $0.id == action.id }
                success += 1
                persistToDisk()
            } catch {
                inFlightActionIds.remove(id)
                guard drainGenerationByActor[actorUserId, default: 0] == generation else { break }
                guard let index = queue.firstIndex(where: { $0.id == action.id }) else {
                    continue
                }
                if case let OfflineActionExecutionError.permanent(kind, message) = error {
                    queue[index].attemptCount += 1
                    queue[index].lastError = message
                    queue[index].failureKind = kind
                    queue[index].permanentlyFailedAt = now
                    failed += 1
                    persistToDisk()
                    continue
                }

                let retryMessage: String
                if case let OfflineActionExecutionError.retryable(message) = error {
                    retryMessage = message
                } else {
                    retryMessage = error.localizedDescription
                }
                queue[index].attemptCount += 1
                queue[index].lastError = retryMessage
                if queue[index].attemptCount >= maxAttempts {
                    queue[index].permanentlyFailedAt = now
                    queue[index].failureKind = .retryExhausted
                    failed += 1
                } else {
                    // Eksponentiell backoff: 30s, 120s, 270s, 480s, 750s
                    let delay = 30.0 * pow(Double(queue[index].attemptCount), 2.0)
                    queue[index].nextRetryAt = now.addingTimeInterval(delay)
                }
                persistToDisk()
            }
        }
        return (success, failed)
    }

    // MARK: - Persistens

    private static func markUnsafeEntries(
        _ actions: inout [PendingAction],
        now: Date
    ) -> Bool {
        var changed = false
        for index in actions.indices {
            changed = markUnsafeEntry(&actions[index], now: now) || changed
        }
        return changed
    }

    private static func markUnsafeEntry(
        _ action: inout PendingAction,
        now: Date
    ) -> Bool {
        let reason: String?
        if action.organizationId?.isEmpty != false {
            reason = "Eldre køelement mangler workspace-binding og kan ikke synkroniseres automatisk."
        } else if action.actorUserId?.isEmpty != false {
            reason = "Eldre køelement mangler brukerbinding og kan ikke synkroniseres automatisk på en delt enhet."
        } else if requiresProjectScope(action), action.projectId?.isEmpty != false {
            reason = "Prosjekthandlingen mangler kundeprosjekt og må håndteres manuelt."
        } else {
            reason = nil
        }
        guard let reason else { return false }
        let changed = action.permanentlyFailedAt == nil
            || action.failureKind != .missingSecurityScope
            || action.lastError != reason
        action.permanentlyFailedAt = action.permanentlyFailedAt ?? now
        action.failureKind = .missingSecurityScope
        action.lastError = reason
        return changed
    }

    private static func isRecommendationMutation(_ action: PendingAction) -> Bool {
        guard action.httpMethod.uppercased() == "POST",
              action.endpoint.contains("/api/leadgrid/intelligence/recommendations/")
        else { return false }
        return ["/accept", "/execute", "/dismiss", "/snooze"].contains {
            action.endpoint.split(separator: "?", maxSplits: 1)[0].hasSuffix($0)
        }
    }

    private static func requiresProjectScope(_ action: PendingAction) -> Bool {
        if isRecommendationMutation(action) { return true }
        let method = action.httpMethod.uppercased()
        let path = String(action.endpoint.split(separator: "?", maxSplits: 1).first ?? "")
        if path == "/api/admin-room/lead-map/leads" && method == "POST" { return true }
        if path.hasPrefix("/api/leadgrid/leadbook/examples") { return true }
        if path.hasPrefix("/api/leadgrid/leadbook/feedback/") { return true }
        if path.hasPrefix("/api/admin-room/lead-map/leads/") {
            return path.hasSuffix("/visits")
                || path.hasSuffix("/follow-up")
                || path.hasSuffix("/status")
        }
        return false
    }

    /// Prosjektløse handlinger er enten ekte org-globale writes (Academy /
    /// Pondus) eller synlig legacy-karantene. De vises i synksenteret, men
    /// bare ekte globale writes får draines.
    private static func isVisible(_ action: PendingAction, in projectId: String) -> Bool {
        action.projectId == projectId || action.projectId == nil
    }

    private static func isDrainable(_ action: PendingAction, in projectId: String) -> Bool {
        action.projectId == projectId
            || (action.projectId == nil && !requiresProjectScope(action))
    }

    @discardableResult
    private func persistToDisk() -> Bool {
        do {
            let data = try Self.makeEncoder().encode(queue)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
            lastPersistenceError = nil
            return true
        } catch {
            lastPersistenceError = error.localizedDescription
            return false
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
