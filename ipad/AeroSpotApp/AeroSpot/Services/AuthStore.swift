// AuthStore.swift — innlogging mot CreatorHub-backend. Sesjon er en
// bearer/header-token (ikke cookie), så vi henter token fra /api/auth/login
// og sender den som x-session-token på autentiserte kall. Token lagres i
// Keychain (sesjons-credential — hører ikke hjemme i UserDefaults).

import Foundation
import Observation

/// Keychain-lagring for sesjons-token. Trådsikker (Keychain er det), så både
/// AuthStore (@MainActor) og AeroSpotAPI (bakgrunn) kan lese uten data-race.
enum AuthTokenStore {
    private static let account = "aerospot.sessionToken"
    private static let service = "com.creatorhubn.aerospot"

    static func get() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let token = String(data: data, encoding: .utf8),
              !token.isEmpty
        else { return nil }
        return token
    }

    static func set(_ token: String?) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        guard let token, let data = token.data(using: .utf8) else { return }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
}

@MainActor
@Observable
final class AuthStore {
    private(set) var token: String?
    private(set) var userName: String?
    var isLoggedIn: Bool { token != nil }

    enum Outcome: Equatable {
        case ok
        case needs2FA(tempToken: String)
        case failed(String)
    }

    init() {
        token = AuthTokenStore.get()
    }

    func login(email: String, password: String) async -> Outcome {
        let res = await AeroSpotAPI.login(email: email, password: password)
        return apply(res)
    }

    func complete2FA(tempToken: String, code: String) async -> Outcome {
        let res = await AeroSpotAPI.complete2FA(tempToken: tempToken, code: code)
        return apply(res)
    }

    func logout() {
        AuthTokenStore.set(nil)
        token = nil
        userName = nil
    }

    private func apply(_ res: AeroSpotAPI.LoginResult) -> Outcome {
        switch res {
        case let .token(token, name):
            AuthTokenStore.set(token)
            self.token = token
            self.userName = name
            return .ok
        case let .needs2FA(tempToken):
            return .needs2FA(tempToken: tempToken)
        case let .error(message):
            return .failed(message)
        }
    }
}
