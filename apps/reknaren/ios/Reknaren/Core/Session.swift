import Foundation
import Observation
import Security

/// Autentiseringstilstand. Magic-link (samme som web): be om lenke → åpne lenke →
/// verifiser token → lagre Bearer-token i Keychain. `dev-login` for test.
@MainActor
@Observable
final class Session {
    enum State { case loading, signedOut, signedIn(email: String) }

    private(set) var state: State = .loading

    private let keychainKey = "reknaren.token"

    func restore() async {
        if let token = Keychain.read(keychainKey) {
            await APIClient.shared.setToken(token)
            // Vi stoler på lagret token; server avviser hvis utløpt (401 → logg ut).
            state = .signedIn(email: UserDefaults.standard.string(forKey: "reknaren.email") ?? "")
        } else {
            state = .signedOut
        }
    }

    func requestMagicLink(email: String) async throws {
        struct Body: Encodable { let email: String }
        _ = try await APIClient.shared.post("/api/auth/request-magic-link", body: Body(email: email)) as Empty
    }

    /// Kalles når Universal Link `…/auth/verify?token=…` åpner appen.
    func verify(magicToken: String) async throws {
        struct Body: Encodable { let token: String }
        struct Resp: Decodable { let token: String; let email: String }
        let r: Resp = try await APIClient.shared.post("/api/auth/verify-magic-link", body: Body(token: magicToken))
        await signIn(token: r.token, email: r.email)
    }

    func signOut() async {
        Keychain.delete(keychainKey)
        UserDefaults.standard.removeObject(forKey: "reknaren.email")
        await APIClient.shared.setToken(nil)
        state = .signedOut
    }

    private func signIn(token: String, email: String) async {
        Keychain.save(keychainKey, value: token)
        UserDefaults.standard.set(email, forKey: "reknaren.email")
        await APIClient.shared.setToken(token)
        state = .signedIn(email: email)
    }
}

/// Minimal Keychain-wrapper for ett hemmelig token. Token er en legitimasjon → aldri UserDefaults.
enum Keychain {
    static func save(_ key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                     kSecAttrAccount as String: key]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    static func read(_ key: String) -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                     kSecAttrAccount as String: key,
                                     kSecReturnData as String: true,
                                     kSecMatchLimit as String: kSecMatchLimitOne]
        var out: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess,
              let data = out as? Data, let s = String(data: data, encoding: .utf8) else { return nil }
        return s
    }

    static func delete(_ key: String) {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword,
                       kSecAttrAccount as String: key] as CFDictionary)
    }
}
