// AuthClient.swift
//
// Keychain-wrapper for bearer-token + user-email. Bevisst minimal —
// vi gjenbruker CaptureApp's pattern når vi får tid til å migrere
// inn en delt SwiftPM-pakke.

import Foundation
import Security

enum AuthClient {
    private static let service = "com.creatorhubn.LeadMapApp.auth"
    private static let tokenAccount = "bearer_token"
    private static let emailAccount = "user_email"
    private static let actorUserIdAccount = "actor_user_id"

    static func saveToken(_ token: String, email: String?) {
        save(token, account: tokenAccount)
        if let email, !email.isEmpty {
            save(email, account: emailAccount)
        } else {
            delete(account: emailAccount)
        }
        // A new token must never inherit another account's cache identity.
        delete(account: actorUserIdAccount)
    }

    static func loadToken() -> String? {
        #if DEBUG
        // QA-hook: `SIMCTL_CHILD_QA_BEARER_TOKEN=… simctl launch …` logger
        // inn simulator uten pairing-flyt — brukes til automatisert visuell
        // QA. Ingen effekt i release-bygg (og env kan ikke settes på device).
        if let injected = ProcessInfo.processInfo.environment["QA_BEARER_TOKEN"],
           !injected.isEmpty {
            return injected
        }
        #endif
        return load(account: tokenAccount)
    }
    static func loadEmail() -> String? { load(account: emailAccount) }
    static func loadActorUserId() -> String? { load(account: actorUserIdAccount) }

    static func saveActorUserId(_ userId: String) {
        let normalized = userId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            delete(account: actorUserIdAccount)
            return
        }
        save(normalized, account: actorUserIdAccount)
    }

    static func clear() {
        delete(account: tokenAccount)
        delete(account: emailAccount)
        delete(account: actorUserIdAccount)
    }

    // MARK: - Internal

    private static func save(_ value: String, account: String) {
        delete(account: account) // overwrite
        guard let data = value.data(using: .utf8) else { return }
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        SecItemAdd(q as CFDictionary, nil)
    }

    private static func load(account: String) -> String? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var ref: AnyObject?
        let status = SecItemCopyMatching(q as CFDictionary, &ref)
        guard status == errSecSuccess, let data = ref as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func delete(account: String) {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(q as CFDictionary)
    }
}
