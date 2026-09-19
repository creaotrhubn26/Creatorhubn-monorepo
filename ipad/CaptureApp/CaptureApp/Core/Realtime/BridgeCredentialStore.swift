import Foundation
import Security

/// Stores the Bridge bearer token separately from paired-desk display metadata.
/// Tokens are device-only and available after first unlock so an active shoot
/// can reconnect after the app is relaunched without exposing the token through
/// UserDefaults or iCloud backup.
enum BridgeCredentialStore {
    private static let service = "com.creatorhubn.capture.bridge"

    static func save(token: String, forDeskId deskId: String) throws {
        guard token.count == 64, token.allSatisfy(\.isHexDigit) else {
            throw CredentialError.invalidToken
        }
        let query = baseQuery(deskId: deskId)
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = Data(token.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else { throw CredentialError.keychain(status) }
    }

    static func token(forDeskId deskId: String) -> String? {
        var query = baseQuery(deskId: deskId)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8)
        else { return nil }
        return token
    }

    static func remove(forDeskId deskId: String) {
        SecItemDelete(baseQuery(deskId: deskId) as CFDictionary)
    }

    private static func baseQuery(deskId: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: deskId
        ]
    }

    enum CredentialError: Error {
        case invalidToken
        case keychain(OSStatus)
    }
}
