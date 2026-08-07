import Foundation
import Observation

/// Sky-synk av scenen: pairing-innlogging, push ved autosave, pull ved oppstart.
/// Last-write-wins — nyeste tidsstempel vinner.
@Observable @MainActor
final class CloudSync {
    enum Status: Equatable {
        case signedOut
        case idle          // innlogget, i ro
        case syncing
        case error(String)
    }

    var status: Status = .signedOut
    var email: String?
    var lastSync: Date?
    @ObservationIgnored private var api = CloudAPI()

    static let sceneId = "default"
    static let sceneName = "Studio Scene"

    init() {
        if let token = AuthStore.token {
            api.token = token
            email = AuthStore.email
            status = .idle
        }
    }

    var isSignedIn: Bool { status != .signedOut }

    /// Pull-beslutning: hent remote bare om den er >2s nyere enn lokal lagring.
    nonisolated static func shouldPull(remoteUpdated: Date?, localSaved: Date?) -> Bool {
        guard let remoteUpdated else { return false }
        guard let localSaved else { return true }
        return remoteUpdated.timeIntervalSince(localSaved) > 2
    }

    // MARK: - Innlogging

    func signIn(shortCode: String) async throws {
        status = .syncing
        do {
            let response = try await api.exchange(shortCode: shortCode)
            AuthStore.saveSession(token: response.bearer, email: response.user.email)
            api.token = response.bearer
            email = response.user.email
            status = .idle
        } catch {
            status = .signedOut
            throw error
        }
    }

    func signOut() {
        AuthStore.clear()
        api.token = nil
        email = nil
        status = .signedOut
    }

    // MARK: - Synk

    /// Push gjeldende scene (kalles fra autosave-løypa når innlogget).
    func push(scene: SceneData) async {
        guard isSignedIn else { return }
        status = .syncing
        do {
            let response = try await api.putScene(id: Self.sceneId, name: Self.sceneName, scene: scene)
            lastSync = CloudAPI.parseDate(response.updatedAt) ?? Date()
            status = .idle
        } catch {
            status = .error((error as? LocalizedError)?.errorDescription ?? "Synk feilet")
        }
    }

    /// Hent remote-scenen om den er nyere enn lokal fil. Returnerer scenen som
    /// skal tas i bruk, ellers nil.
    func pullIfNewer(localSavedAt: Date?) async -> SceneData? {
        guard isSignedIn else { return nil }
        status = .syncing
        defer { if status == .syncing { status = .idle } }
        do {
            let remote = try await api.fetchScene(id: Self.sceneId)
            let remoteDate = CloudAPI.parseDate(remote.updatedAt)
            if Self.shouldPull(remoteUpdated: remoteDate, localSaved: localSavedAt) {
                lastSync = remoteDate
                return remote.data
            }
            return nil
        } catch CloudAPI.APIError.http(404, _) {
            return nil // ingen sky-scene enda — lokal er sannhet
        } catch {
            status = .error((error as? LocalizedError)?.errorDescription ?? "Henting feilet")
            return nil
        }
    }
}
