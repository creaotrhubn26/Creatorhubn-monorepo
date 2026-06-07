import Foundation
import Security

/// Single source of truth for the photographer's CreatorHub identity on
/// the iPad. Wraps Keychain so the bearer survives app restarts; exposes
/// a tiny stable API the rest of the app uses without thinking about
/// storage. `LiveCaptureModel.actorUserId` and `BackendClient.authHeaders`
/// both flow from here.
///
/// **Sign-in flow today (MVP):** the user pastes a Google ID token (or a
/// CreatorHub-issued bearer) into the SignInView; we POST it to
/// `/api/auth/google/token` to upgrade an ID token into a session bearer
/// (or store an already-issued bearer directly), then save in Keychain.
///
/// **Follow-up:** swap the paste field for the GoogleSignIn-Swift SDK so
/// the user just taps "Sign in with Google". The endpoint contract is
/// already designed for both — the SDK gives an `idToken` that POSTs to
/// the same route. Tracked as task #73.
@MainActor
@Observable
final class SignInService {
    /// Reflects the currently-stored identity. Nil = signed out.
    private(set) var session: StoredSession?

    /// Convenience for views: is the user signed in to CreatorHub.
    var isSignedIn: Bool { session != nil }

    static let shared = SignInService()

    init() {
        self.session = Self.loadFromKeychain()
    }

    struct StoredSession: Codable, Equatable, Sendable {
        let backendBaseURL: URL
        let bearer: String
        let userId: String
        let email: String
        let displayName: String
    }

    /// Exchange a Google ID token for a CreatorHub bearer + persist.
    /// Caller passes the backend base URL; we store everything together
    /// so the rest of the app doesn't need to wire two settings.
    func signInWithGoogleIDToken(
        backendBaseURL: URL,
        googleIDToken: String,
        session: URLSession = .shared,
    ) async throws {
        struct Request: Encodable { let idToken: String }
        struct UserDTO: Decodable {
            let id: String
            let email: String
            let name: String
            let role: String
        }
        struct Response: Decodable {
            let success: Bool
            let token: String
            let user: UserDTO
        }

        var request = URLRequest(
            url: backendBaseURL.appendingPathComponent("/api/auth/google/token")
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(Request(idToken: googleIDToken))

        let (data, urlResponse) = try await session.data(for: request)
        guard let http = urlResponse as? HTTPURLResponse else {
            throw SignInError.transport("not HTTPURLResponse")
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw SignInError.backend(status: http.statusCode, body: body)
        }
        let decoded = try JSONDecoder().decode(Response.self, from: data)
        guard decoded.success else {
            throw SignInError.backend(status: http.statusCode, body: "success=false")
        }

        let stored = StoredSession(
            backendBaseURL: backendBaseURL,
            bearer: decoded.token,
            userId: decoded.user.id,
            email: decoded.user.email,
            displayName: decoded.user.name,
        )
        try Self.saveToKeychain(stored)
        self.session = stored
    }

    /// Bypass the Google-token exchange and persist a CreatorHub bearer
    /// directly. Useful for: (1) staging environments where Google OAuth
    /// isn't yet wired, (2) tests, (3) demoing with an already-issued
    /// session token. Same StoredSession shape so callers don't branch.
    func signInWithBearer(
        backendBaseURL: URL,
        bearer: String,
        userId: String,
        email: String,
        displayName: String,
    ) throws {
        let stored = StoredSession(
            backendBaseURL: backendBaseURL,
            bearer: bearer,
            userId: userId,
            email: email,
            displayName: displayName,
        )
        try Self.saveToKeychain(stored)
        self.session = stored
    }

    func signOut() {
        Self.deleteFromKeychain()
        session = nil
    }

    /// Authorization header dict for the BackendClient. Returns empty when
    /// signed out so the BackendClient can still be constructed; calls
    /// will then fail with 401 which the UI surfaces.
    var authHeaders: [String: String] {
        guard let bearer = session?.bearer else { return [:] }
        return ["Authorization": "Bearer \(bearer)"]
    }

    enum SignInError: Error, Sendable, LocalizedError {
        case transport(String)
        case backend(status: Int, body: String)
        case keychain(OSStatus)

        var errorDescription: String? {
            switch self {
            case let .transport(msg):
                return "Network error: \(msg)"
            case let .backend(status, body):
                return "Backend rejected sign-in (\(status)): \(body)"
            case let .keychain(status):
                return "Keychain error (\(status))"
            }
        }
    }

    // MARK: - Keychain plumbing

    private static let service = "com.creatorhubn.capture.signin"
    private static let account = "primary"

    private static func saveToKeychain(_ stored: StoredSession) throws {
        let data = try JSONEncoder().encode(stored)
        // Atomic upsert: delete-then-add, since SecItemUpdate would skip
        // missing-attribute fields and produce inconsistent state.
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)

        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else { throw SignInError.keychain(status) }
    }

    private static func loadFromKeychain() -> StoredSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let stored = try? JSONDecoder().decode(StoredSession.self, from: data)
        else { return nil }
        return stored
    }

    private static func deleteFromKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
